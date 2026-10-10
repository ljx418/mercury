from __future__ import annotations

import re
import json
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Event, RLock
from typing import Any

from ..credential_transport import MediaCredentialFailure
from .contracts import AcquisitionAudioRef, MediaAcquirer
from .task_artifacts import ArtifactRef, TASK_ID_RE, TaskArtifactError, TaskArtifactSandbox


ADAPTER_RE = re.compile(r"^[a-z][a-z0-9_-]{1,31}$")
SOURCE_IDENTITY_RE = re.compile(r"^portal:([a-z][a-z0-9_-]{1,31}):([^:]+):([^:]+):([^:]+)$")
POLICY_RE = re.compile(r"^[a-z0-9_-]+-media-consent/v([1-9][0-9]*)$")
TERMINAL_STATES = {"succeeded", "degraded", "blocked", "failed", "cancelled"}
CAPTURE_FALLBACK_ROUTES = (
    "credentialed_subtitle",
    "credentialed_media_asr",
    "public_or_page_subtitle",
)
ROUTE_FAILURE_CODES = {
    "V3_MEDIA_SUBTITLE_UNAVAILABLE",
    "V3_MEDIA_PLATFORM_REJECTED",
    "V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID",
    "V3_MEDIA_RUNTIME_OFFLINE",
}


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class MediaAcquisitionError(RuntimeError):
    def __init__(self, code: str, message: str, *, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


@dataclass(frozen=True)
class MediaAcquisitionRequest:
    task_id: str
    source_identity: str
    adapter_id: str
    media_id: str
    playback_unit_id: str
    part_id: str
    consent_policy_id: str
    consent_policy_revision: int


class MediaAcquisitionCoordinator:
    def __init__(self, sandbox: TaskArtifactSandbox, *, adapter_policies: dict[str, tuple[str, int]] | None = None) -> None:
        self.sandbox = sandbox
        self._adapter_policies = dict(adapter_policies or {"bilibili": ("bilibili-media-consent/v1", 1)})
        self._tasks: dict[str, dict[str, Any]] = {}
        self._requests: dict[str, MediaAcquisitionRequest] = {}
        self._cancel_hooks: dict[str, list[Callable[[], None]]] = {}
        self._inputs: dict[str, dict[str, Any]] = {}
        self._public_segments: dict[str, tuple[dict[str, Any], ...]] = {}
        self._route_failures: dict[str, list[dict[str, str]]] = {}
        self._cleanup_events: dict[str, Event] = {}
        self._lock = RLock()

    def create(self, request: MediaAcquisitionRequest) -> dict[str, Any]:
        self._validate_request(request)
        with self._lock:
            previous = self._requests.get(request.task_id)
            if previous is not None:
                if previous != request:
                    raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Task ID is already bound to another source.", status=409)
                return dict(self._tasks[request.task_id])
            try:
                self.sandbox.create(request.task_id)
            except TaskArtifactError as exc:
                raise MediaAcquisitionError(exc.code, str(exc), status=409) from exc
            task = {
                "schemaVersion": "media-acquisition-task/v1",
                "taskId": request.task_id,
                "sourceIdentity": request.source_identity,
                "adapterId": request.adapter_id,
                "mediaId": request.media_id,
                "playbackUnitId": request.playback_unit_id,
                "partId": request.part_id,
                "state": "created",
                "consentPolicyId": request.consent_policy_id,
                "consentPolicyRevision": request.consent_policy_revision,
                "credentialLeaseId": None,
                "captureGrantId": None,
                "startedAt": utc_now(),
                "terminalAt": None,
                "failureCode": None,
            }
            self._requests[request.task_id] = request
            self._tasks[request.task_id] = task
            self._cancel_hooks[request.task_id] = []
            self._route_failures[request.task_id] = []
            self._cleanup_events[request.task_id] = Event()
            return dict(task)

    def record_route_failure(self, task_id: str, route: str, failure_code: str) -> dict[str, Any]:
        if not re.fullmatch(r"V3_MEDIA_[A-Z0-9_]{3,80}", failure_code):
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Route failure code is invalid.", status=400)
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None or task["state"] in TERMINAL_STATES:
                raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Task cannot record route failure.", status=409)
            failures = self._route_failures[task_id]
            expected_index = len(failures)
            if expected_index >= len(CAPTURE_FALLBACK_ROUTES) or route != CAPTURE_FALLBACK_ROUTES[expected_index]:
                raise MediaAcquisitionError("V3_MEDIA_ROUTE_ORDER_INVALID", "Route failures must follow the frozen order.", status=409)
            failures.append({"route": route, "failureCode": failure_code})
            eligible = len(failures) == len(CAPTURE_FALLBACK_ROUTES)
            task["state"] = "acquiring"
            return {"taskId": task_id, "failures": [dict(item) for item in failures], "captureFallbackEligible": eligible}

    def capture_eligibility(self, task_id: str) -> dict[str, Any]:
        with self._lock:
            if task_id not in self._tasks:
                raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media acquisition task was not found.", status=404)
            failures = self._route_failures.get(task_id, [])
            return {
                "taskId": task_id,
                "failures": [dict(item) for item in failures],
                "captureFallbackEligible": len(failures) == len(CAPTURE_FALLBACK_ROUTES),
            }

    def bind_capture_grant(self, task_id: str, grant_id: str) -> dict[str, Any]:
        with self._lock:
            task = self._tasks.get(task_id)
            failures = self._route_failures.get(task_id, [])
            if task is None or task["state"] in TERMINAL_STATES or len(failures) != len(CAPTURE_FALLBACK_ROUTES):
                raise MediaAcquisitionError("V3_MEDIA_CAPTURE_NOT_ELIGIBLE", "Task has not exhausted the three prior routes.", status=409)
            if task["captureGrantId"] not in {None, grant_id}:
                raise MediaAcquisitionError("V3_MEDIA_CAPTURE_ALREADY_ACTIVE", "Task already has a capture grant.", status=409)
            task["captureGrantId"] = grant_id
            task["state"] = "capturing"
            return dict(task)

    def acquire_input(
        self,
        task_id: str,
        *,
        lease_store: Any,
        acquirers: dict[str, MediaAcquirer],
        preserve_expected_failures: bool = False,
    ) -> dict[str, Any]:
        with self._lock:
            task = self._tasks.get(task_id)
            request = self._requests.get(task_id)
            if task is None or request is None or task["state"] in TERMINAL_STATES:
                raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Task cannot acquire media input.", status=409)
            existing = self._inputs.get(task_id)
            if existing is not None:
                return dict(existing)
            existing_failures = self._route_failures.get(task_id, [])
            if preserve_expected_failures and len(existing_failures) >= 2:
                return {
                    "outcome": "awaiting_public_subtitle",
                    "input": None,
                    "failures": [dict(item) for item in existing_failures],
                }
            acquirer = acquirers.get(request.adapter_id)
            if acquirer is None:
                raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "No registered media acquirer exists.")
            task["state"] = "acquiring"
        try:
            credentials = lease_store.resolve_for_task(task_id, request.adapter_id)
            try:
                identity = acquirer.resolve_identity(request.media_id, request.playback_unit_id, request.part_id, credentials)
            except MediaAcquisitionError as exc:
                if not preserve_expected_failures or exc.code not in ROUTE_FAILURE_CODES:
                    raise
                self.record_route_failure(task_id, "credentialed_subtitle", exc.code)
                second = self.record_route_failure(task_id, "credentialed_media_asr", exc.code)
                return {
                    "outcome": "awaiting_public_subtitle",
                    "input": None,
                    "failures": second["failures"],
                }
            subtitle_failures: list[str] = []
            try:
                discovery = acquirer.probe_subtitles_with_receipt(identity, credentials)
                candidates = discovery.candidates
                discovery_receipt = {
                    "authority": "acquisition_task",
                    "subtitleItemCount": len(candidates),
                    "discoverySha256": discovery.response_sha256,
                    "observedAt": discovery.observed_at,
                }
            except MediaAcquisitionError as exc:
                if not preserve_expected_failures or exc.code not in ROUTE_FAILURE_CODES:
                    raise
                candidates = ()
                discovery_receipt = None
                subtitle_failures.append(exc.code)
            for candidate in candidates:
                try:
                    subtitle = acquirer.acquire_subtitle(identity, candidate, credentials)
                    payload = json.dumps({
                        "language": subtitle.language,
                        "bodySha256": subtitle.body_sha256,
                        "sourceSha256": subtitle.source_sha256,
                        "segments": [
                            {"startMs": item.start_ms, "endMs": item.end_ms, "text": item.text, "textSha256": item.text_sha256}
                            for item in subtitle.segments
                        ],
                    }, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
                    artifact = self.sandbox.write_bytes(task_id, "subtitle", payload)
                    self._public_segments[task_id] = tuple(
                        {
                            "segmentId": f"seg_{index:06d}",
                            "startMs": item.start_ms,
                            "endMs": item.end_ms,
                            "text": item.text,
                        }
                        for index, item in enumerate(subtitle.segments)
                    )
                    result = {
                        "route": "credentialed_subtitle",
                        "artifact": artifact.public_dict(),
                        "fallbackReasonCodes": [],
                        "subtitleDiscovery": discovery_receipt,
                    }
                    break
                except MediaAcquisitionError as exc:
                    if exc.code not in {"V3_MEDIA_SUBTITLE_UNAVAILABLE", "V3_MEDIA_PLATFORM_REJECTED", "V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID"}:
                        raise
                    subtitle_failures.append(exc.code)
            else:
                first_failure = subtitle_failures[0] if subtitle_failures else "V3_MEDIA_SUBTITLE_UNAVAILABLE"
                try:
                    media = acquirer.acquire_audio(task_id, identity, credentials)
                except MediaAcquisitionError as exc:
                    if not preserve_expected_failures or exc.code not in ROUTE_FAILURE_CODES:
                        raise
                    first = self.record_route_failure(task_id, "credentialed_subtitle", first_failure)
                    second = self.record_route_failure(task_id, "credentialed_media_asr", exc.code)
                    return {
                        "outcome": "awaiting_public_subtitle",
                        "input": None,
                        "failures": second["failures"],
                    }
                result = {
                    "route": "credentialed_media_asr",
                    "artifact": media.artifact.public_dict(),
                    "fallbackReasonCodes": [first_failure],
                    "subtitleDiscovery": discovery_receipt,
                    "durationMs": round(media.identity.duration_seconds * 1000),
                    "sampleRateHz": media.sample_rate_hz,
                    "channels": media.channels,
                    "sampleWidthBytes": 2,
                }
        except MediaCredentialFailure as exc:
            with self._lock:
                self._tasks[task_id].update(state="failed", terminalAt=utc_now(), failureCode=exc.code)
            raise MediaAcquisitionError(exc.code, "Credential lease is unavailable.", status=exc.status) from exc
        except Exception:
            with self._lock:
                current = self._tasks[task_id]
                if current["state"] not in TERMINAL_STATES:
                    current.update(state="failed", terminalAt=utc_now(), failureCode="V3_MEDIA_PLATFORM_REJECTED")
            raise
        with self._lock:
            self._inputs[task_id] = result
            return dict(result)

    def get(self, task_id: str) -> dict[str, Any]:
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media acquisition task was not found.", status=404)
            return dict(task)

    def latest_for_source(self, source_identity: str) -> dict[str, Any]:
        with self._lock:
            candidates = [task for task in self._tasks.values() if task["sourceIdentity"] == source_identity]
            if not candidates:
                raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media acquisition task was not found.", status=404)
            return dict(max(candidates, key=lambda item: (item["startedAt"], item["taskId"])))

    def selected_input(self, task_id: str) -> dict[str, Any] | None:
        with self._lock:
            self.get(task_id)
            value = self._inputs.get(task_id)
            return dict(value) if value is not None else None

    def public_segments(self, task_id: str) -> tuple[dict[str, Any], ...]:
        with self._lock:
            self.get(task_id)
            return tuple(dict(item) for item in self._public_segments.get(task_id, ()))

    def audio_reference(self, task_id: str) -> AcquisitionAudioRef:
        """Rebuild a private, task-bound ASR input from a successful audio route."""
        with self._lock:
            task = self._tasks.get(task_id)
            result = self._inputs.get(task_id)
            if task is None or result is None or result.get("route") != "credentialed_media_asr":
                raise MediaAcquisitionError("V3_MEDIA_TRANSCRIPT_AUDIO_UNAVAILABLE", "Task has no acquired audio input.", status=409)
            artifact = result.get("artifact")
            if not isinstance(artifact, dict):
                raise MediaAcquisitionError("V3_MEDIA_TRANSCRIPT_AUDIO_UNAVAILABLE", "Task audio receipt is invalid.", status=409)
            return AcquisitionAudioRef(
                task_id=task_id,
                source_identity=task["sourceIdentity"],
                acquisition_record_id=f"mar_{secrets.token_hex(16)}",
                artifact=ArtifactRef(
                    task_id=task_id,
                    artifact_id=str(artifact["artifactId"]),
                    kind=str(artifact["kind"]),
                    byte_length=int(artifact["byteLength"]),
                    sha256=str(artifact["sha256"]),
                ),
                duration_ms=int(result["durationMs"]),
                sample_rate_hz=int(result["sampleRateHz"]),
                channels=int(result["channels"]),
                sample_width_bytes=int(result["sampleWidthBytes"]),
            )

    def register_cancel_hook(self, task_id: str, callback: Callable[[], None]) -> None:
        if not callable(callback):
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Cancellation hook must be callable.")
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None or task["state"] in TERMINAL_STATES:
                raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Task cannot accept cancellation work.", status=409)
            self._cancel_hooks[task_id].append(callback)

    def cancel(self, task_id: str) -> dict[str, Any]:
        wait_for_cleanup: Event | None = None
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media acquisition task was not found.", status=404)
            if task["state"] == "cancelled":
                return dict(task)
            if task["state"] in TERMINAL_STATES:
                return dict(task)
            cleanup_event = self._cleanup_events[task_id]
            if task["state"] == "cleaning":
                wait_for_cleanup = cleanup_event
                hooks = ()
            else:
                cleanup_event.clear()
                task["state"] = "cleaning"
                hooks = tuple(self._cancel_hooks.get(task_id, ()))
                self._cancel_hooks[task_id] = []
        if wait_for_cleanup is not None:
            if not wait_for_cleanup.wait(timeout=30):
                raise MediaAcquisitionError("V3_MEDIA_CLEANUP_INCOMPLETE", "Task cleanup did not reach a terminal state.", status=500)
            return self.get(task_id)
        try:
            for callback in hooks:
                callback()
            receipt = self.sandbox.cleanup(task_id)
            if receipt["residualCount"] != 0:
                raise TaskArtifactError("V3_MEDIA_CLEANUP_INCOMPLETE", "Task sandbox retained artifacts.")
        except Exception as exc:
            with self._lock:
                task = self._tasks[task_id]
                task.update(state="failed", terminalAt=utc_now(), failureCode="V3_MEDIA_CLEANUP_INCOMPLETE")
                cleanup_event.set()
            raise MediaAcquisitionError("V3_MEDIA_CLEANUP_INCOMPLETE", "Task cancellation cleanup did not complete.", status=500) from exc
        with self._lock:
            task = self._tasks[task_id]
            task.update(state="cancelled", terminalAt=utc_now(), failureCode=None)
            cleanup_event.set()
            return dict(task)

    def complete(self, task_id: str) -> dict[str, Any]:
        wait_for_cleanup: Event | None = None
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media acquisition task was not found.", status=404)
            if task["state"] == "succeeded":
                return dict(task)
            if task["state"] in TERMINAL_STATES:
                raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media acquisition task cannot complete.", status=409)
            cleanup_event = self._cleanup_events[task_id]
            if task["state"] == "cleaning":
                wait_for_cleanup = cleanup_event
                hooks = ()
            else:
                cleanup_event.clear()
                task["state"] = "cleaning"
                hooks = tuple(self._cancel_hooks.get(task_id, ()))
                self._cancel_hooks[task_id] = []
        if wait_for_cleanup is not None:
            if not wait_for_cleanup.wait(timeout=30):
                raise MediaAcquisitionError("V3_MEDIA_CLEANUP_INCOMPLETE", "Task cleanup did not reach a terminal state.", status=500)
            current = self.get(task_id)
            if current["state"] == "succeeded":
                return current
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media acquisition task cannot complete.", status=409)
        try:
            for callback in hooks:
                callback()
            receipt = self.sandbox.cleanup(task_id)
            if receipt["residualCount"] != 0:
                raise TaskArtifactError("V3_MEDIA_CLEANUP_INCOMPLETE", "Task sandbox retained artifacts.")
        except Exception as exc:
            with self._lock:
                task = self._tasks[task_id]
                task.update(state="failed", terminalAt=utc_now(), failureCode="V3_MEDIA_CLEANUP_INCOMPLETE")
                cleanup_event.set()
            raise MediaAcquisitionError("V3_MEDIA_CLEANUP_INCOMPLETE", "Task completion cleanup did not complete.", status=500) from exc
        with self._lock:
            task = self._tasks[task_id]
            task.update(state="succeeded", terminalAt=utc_now(), failureCode=None)
            cleanup_event.set()
            return dict(task)

    def active_task_count(self) -> int:
        with self._lock:
            return sum(task["state"] not in TERMINAL_STATES for task in self._tasks.values())

    def _validate_request(self, request: MediaAcquisitionRequest) -> None:
        identity = SOURCE_IDENTITY_RE.fullmatch(request.source_identity)
        policy = POLICY_RE.fullmatch(request.consent_policy_id)
        registered_policy = self._adapter_policies.get(request.adapter_id)
        if (
            not TASK_ID_RE.fullmatch(request.task_id)
            or not ADAPTER_RE.fullmatch(request.adapter_id)
            or registered_policy is None
            or identity is None
            or identity.group(1) != request.adapter_id
            or identity.groups()[1:] != (request.media_id, request.playback_unit_id, request.part_id)
            or any(not isinstance(value, str) or not value or len(value) > 128 for value in (request.media_id, request.playback_unit_id, request.part_id))
            or policy is None
            or int(policy.group(1)) != request.consent_policy_revision
            or registered_policy != (request.consent_policy_id, request.consent_policy_revision)
        ):
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media acquisition request is outside the frozen contract.")


def request_from_payload(payload: dict[str, Any]) -> MediaAcquisitionRequest:
    return MediaAcquisitionRequest(
        task_id=payload["taskId"],
        source_identity=payload["sourceIdentity"],
        adapter_id=payload["adapterId"],
        media_id=payload["mediaId"],
        playback_unit_id=payload["playbackUnitId"],
        part_id=payload["partId"],
        consent_policy_id=payload["consentPolicyId"],
        consent_policy_revision=payload["consentPolicyRevision"],
    )
