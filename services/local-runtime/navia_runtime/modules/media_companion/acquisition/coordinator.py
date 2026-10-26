from __future__ import annotations

import re
import json
import os
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Event, RLock
from typing import Any

from ..credential_transport import MediaCredentialFailure
from ..task_store import MediaTaskStoreError, process_start_token
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


#: Routes that produce a real ASR input and may therefore back an
#: `AcquisitionAudioRef`. The explicit local route is the user-gesture one.
AUDIO_INPUT_ROUTES: tuple[str, ...] = ("credentialed_media_asr", "explicit_local_media_asr")


class MediaAcquisitionCoordinator:
    def __init__(self, sandbox: TaskArtifactSandbox, *, adapter_policies: dict[str, tuple[str, int]] | None = None, authority_store: Any = None) -> None:
        self.sandbox = sandbox
        self._authority_store = authority_store
        self._adapter_policies = dict(adapter_policies or {"bilibili": ("bilibili-media-consent/v1", 1)})
        self._tasks: dict[str, dict[str, Any]] = {}
        self._requests: dict[str, MediaAcquisitionRequest] = {}
        # WP-B: local-import bindings are keyed by the SAME task; this is not a
        # second task registry and never creates a second source authority.
        self._local_imports: dict[str, dict[str, Any]] = {}
        self._cancel_hooks: dict[str, list[Callable[[], None]]] = {}
        self._inputs: dict[str, dict[str, Any]] = {}
        self._public_segments: dict[str, tuple[dict[str, Any], ...]] = {}
        self._route_failures: dict[str, list[dict[str, str]]] = {}
        self._cleanup_events: dict[str, Event] = {}
        self._executing: set[str] = set()
        self._lock = RLock()

    def create(self, request: MediaAcquisitionRequest) -> dict[str, Any]:
        self._validate_request(request)
        with self._lock:
            previous = self._requests.get(request.task_id)
            if previous is not None:
                if previous != request:
                    raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Task ID is already bound to another source.", status=409)
                return dict(self._tasks[request.task_id])
            if self._active_for_source(request.source_identity) is not None:
                raise MediaAcquisitionError("V3_MEDIA_SOURCE_TASK_ACTIVE", "Another task already owns this media source.", status=409)
            return self._create_locked(request)

    def bind_local_import(
        self,
        *,
        task_id: str,
        source_identity: str,
        route: str,
        import_id: str,
        dependency_generation: str,
        video_manifest_sha256: str,
        visual_receipt_sha256: str,
        audio_artifact: dict[str, Any] | None = None,
        duration_ms: int | None = None,
        sample_rate_hz: int | None = None,
        channels: int | None = None,
        sample_width_bytes: int | None = None,
    ) -> dict[str, Any]:
        """Bind the explicit local-import route under THIS task's lock.

        The automatic route order, the credential resolver, the downloader and
        tabCapture are all untouched: this only adds one selected route to an
        EXISTING task. No second source authority and no second task is created.
        """
        if route != "explicit_local_media_asr":
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Unknown local import route.", status=400)
        if not task_id or not source_identity or not import_id:
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Local import binding is incomplete.", status=400)
        if not dependency_generation or not video_manifest_sha256 or not visual_receipt_sha256:
            raise MediaAcquisitionError(
                "V3_MEDIA_TASK_INVALID", "Local import binding is missing a durable manifest.", status=400
            )
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise MediaAcquisitionError(
                    "V3_MEDIA_TASK_INVALID", "Local import is not bound to a known task.", status=404
                )
            if task.get("sourceIdentity") != source_identity:
                raise MediaAcquisitionError(
                    "V3_MEDIA_TASK_INVALID", "Local import source does not match the task.", status=409
                )
            existing = self._local_imports.get(task_id)
            if existing is not None:
                if existing["importId"] != import_id:
                    raise MediaAcquisitionError(
                        "V3_MEDIA_TASK_INVALID", "Task already holds another local import.", status=409
                    )
                return dict(existing)
            binding = {
                "taskId": task_id,
                "sourceIdentity": source_identity,
                "route": route,
                "importId": import_id,
                "dependencyGeneration": dependency_generation,
                "videoManifestSha256": video_manifest_sha256,
                "visualReceiptSha256": visual_receipt_sha256,
            }
            self._local_imports[task_id] = binding
            if audio_artifact is not None:
                # The selected local input must live in the SAME structure the
                # audio consumers already read, so `selected_input()` and
                # `audio_reference()` see one truthful record under its real
                # route name instead of a second, private one.
                self._inputs[task_id] = {
                    "route": "explicit_local_media_asr",
                    "artifact": dict(audio_artifact),
                    "fallbackReasonCodes": [
                        str(item["failureCode"])
                        for item in self.capture_eligibility(task_id)["failures"]
                    ],
                    "subtitleDiscovery": None,
                    # These are the MEASURED WAV facts, never the container's:
                    # `audio_reference()` must bind what the ASR will really read.
                    "durationMs": int(duration_ms or 0),
                    "sampleRateHz": int(sample_rate_hz or 16000),
                    "channels": int(channels or 1),
                    "sampleWidthBytes": int(sample_width_bytes or 2),
                    "importId": import_id,
                    "videoManifestSha256": video_manifest_sha256,
                    "visualReceiptSha256": visual_receipt_sha256,
                }
            return dict(binding)

    def resolve(self, request: MediaAcquisitionRequest) -> dict[str, Any]:
        self._validate_request(request)
        with self._lock:
            previous = self._requests.get(request.task_id)
            if previous is not None and previous != request:
                raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Task ID is already bound to another source.", status=409)
            active = self._active_for_source(request.source_identity)
            if active is not None:
                owner_request = self._requests[active["taskId"]]
                if (owner_request.adapter_id, owner_request.consent_policy_id, owner_request.consent_policy_revision) != (
                    request.adapter_id, request.consent_policy_id, request.consent_policy_revision
                ):
                    raise MediaAcquisitionError("V3_MEDIA_SOURCE_POLICY_CONFLICT", "An existing source task uses a different consent policy.", status=409)
                disposition = "created" if active["taskId"] == request.task_id and active["state"] == "created" else "attached"
                return {"disposition": disposition, "authoritativeTaskId": active["taskId"], "task": dict(active)}
            if previous is not None:
                raise MediaAcquisitionError("V3_MEDIA_TASK_TERMINAL", "A terminal task ID cannot be reused for retry.", status=409)
            if self._authority_store is not None:
                authority = self._authority_store.source_authority(request.source_identity)
                if authority is None:
                    authority = self._authority_store.adopt_published_source(
                        request.source_identity, request.adapter_id,
                        request.consent_policy_id, request.consent_policy_revision,
                    )
                if authority is not None and authority["state"] == "cleanup_incomplete":
                    raise MediaAcquisitionError(
                        "V3_MEDIA_CLEANUP_INCOMPLETE", "Stored task cleanup is incomplete.", status=409
                    )
                if authority is not None and authority["state"] == "cancelling":
                    raise MediaAcquisitionError(
                        "V3_MEDIA_CANCELLATION_IN_PROGRESS", "Stored task cancellation is still cleaning up.", status=409
                    )
                if authority is not None and authority["state"] not in {"failed", "cancelled"}:
                    legacy_published = authority["state"] == "published" and authority["consent_policy_id"] == "legacy-unverified"
                    if not legacy_published and (authority["adapter_id"], authority["consent_policy_id"], authority["consent_policy_revision"]) != (
                        request.adapter_id, request.consent_policy_id, request.consent_policy_revision
                    ):
                        raise MediaAcquisitionError("V3_MEDIA_SOURCE_POLICY_CONFLICT", "A stored source task uses another consent policy.", status=409)
                    try:
                        published = self._authority_store.get(authority["task_id"])
                    except Exception as error:
                        raise MediaAcquisitionError("V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN", "Stored media authority is unavailable.", status=409) from error
                    if (published["sourceIdentity"] != request.source_identity
                        or published["state"] not in {"ready", "degraded"}
                        or published["projections"] is None):
                        raise MediaAcquisitionError("V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN", "Stored media result is not published.", status=409)
                    if authority["state"] != "published":
                        self._authority_store.mark_source_authority(authority["task_id"], "published")
                    return {
                        "disposition": "published", "authoritativeTaskId": published["taskId"],
                        "task": None, "publishedRevision": published["revision"],
                        "policyProvenance": "unverified_legacy" if legacy_published else "verified_current",
                    }
            task = self._create_locked(request)
            return {"disposition": "created", "authoritativeTaskId": task["taskId"], "task": task}

    def replace_published_policy(
        self, request: MediaAcquisitionRequest, *, old_task_id: str,
        old_policy_id: str, old_policy_revision: int, confirmation: str,
    ) -> dict[str, Any]:
        self._validate_request(request)
        if (
            not isinstance(old_task_id, str) or not TASK_ID_RE.fullmatch(old_task_id)
            or not isinstance(old_policy_id, str) or not POLICY_RE.fullmatch(old_policy_id)
            or type(old_policy_revision) is not int
            or confirmation != "reanalyze_under_current_policy"
            or self._authority_store is None
        ):
            raise MediaAcquisitionError("V3_MEDIA_POLICY_SWITCH_INVALID", "Policy switch confirmation is invalid.", status=400)
        with self._lock:
            previous = self._requests.get(request.task_id)
            if previous is not None:
                authority = self._authority_store.source_authority(request.source_identity)
                if previous != request or authority is None or authority["task_id"] != request.task_id:
                    raise MediaAcquisitionError("V3_MEDIA_SOURCE_POLICY_CONFLICT", "Policy switch task is no longer authoritative.", status=409)
                task = dict(self._tasks[request.task_id])
                return {"disposition": "replayed", "authoritativeTaskId": request.task_id, "task": task}
            receipt = self._authority_store.policy_switch_receipt(request.task_id)
            if receipt is not None:
                authority = self._authority_store.source_authority(request.source_identity)
                if authority is None or (
                    authority["task_id"] != request.task_id
                    or receipt["source_identity"] != request.source_identity
                    or receipt["old_task_id"] != old_task_id
                    or receipt["old_policy_id"] != old_policy_id
                    or receipt["old_policy_revision"] != old_policy_revision
                    or receipt["new_policy_id"] != request.consent_policy_id
                    or receipt["new_policy_revision"] != request.consent_policy_revision
                    or authority["adapter_id"] != request.adapter_id
                ):
                    raise MediaAcquisitionError("V3_MEDIA_SOURCE_POLICY_CONFLICT", "Policy switch replay no longer owns this source.", status=409)
                return {"disposition": "replayed", "authoritativeTaskId": request.task_id, "task": None}
            try:
                self.sandbox.create(request.task_id)
            except TaskArtifactError as exc:
                raise MediaAcquisitionError(exc.code, str(exc), status=409) from exc
            try:
                receipt = self._authority_store.replace_published_source_authority(
                    source_identity=request.source_identity, old_task_id=old_task_id,
                    old_policy_id=old_policy_id, old_policy_revision=old_policy_revision,
                    new_task_id=request.task_id, adapter_id=request.adapter_id,
                    new_policy_id=request.consent_policy_id,
                    new_policy_revision=request.consent_policy_revision,
                )
            except Exception as exc:
                self.sandbox.cleanup(request.task_id)
                if isinstance(exc, MediaTaskStoreError):
                    raise MediaAcquisitionError(exc.code, str(exc), status=exc.status) from exc
                raise MediaAcquisitionError("V3_MEDIA_POLICY_SWITCH_FAILED", "Policy switch did not commit.", status=500) from exc
            task = self._remember_created_request(request)
            return {"disposition": "created", "authoritativeTaskId": request.task_id, "task": task, "switchReceipt": receipt}

    def _active_for_source(self, source_identity: str) -> dict[str, Any] | None:
        if self._authority_store is not None:
            authority = self._authority_store.source_authority(source_identity)
            if authority is not None:
                if authority["state"] in {"cancelling", "failed", "cancelled", "cleanup_incomplete"}:
                    return None
                task = self._tasks.get(authority["task_id"])
                if task is None or task["state"] in {"failed", "cancelled", "blocked", "degraded"}:
                    return None
                return task
        candidates = [task for task in self._tasks.values() if task["sourceIdentity"] == source_identity]
        if not candidates:
            return None
        latest = max(candidates, key=lambda item: (item["startedAt"], item["taskId"]))
        if latest["state"] in {"failed", "cancelled", "blocked", "degraded"}:
            return None
        return latest

    def source_authority(self, source_identity: str) -> dict[str, Any] | None:
        identity = SOURCE_IDENTITY_RE.fullmatch(source_identity)
        if identity is None or self._authority_store is None:
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media source identity is invalid.")
        with self._lock:
            authority = self._authority_store.source_authority(source_identity)
            if authority is None:
                authority = self._authority_store.adopt_published_source(
                    source_identity, identity.group(1), "legacy-unverified", 0,
                )
            if authority is None:
                return None
            state = authority["state"]
            if state in {"active", "cancelling"} and self._active_for_source(source_identity) is None:
                owner_pid = authority.get("owner_pid")
                owner_start = authority.get("owner_start")
                if not isinstance(owner_pid, int) or not isinstance(owner_start, str):
                    state = "ownership_uncertain"
                else:
                    observed_start = process_start_token(owner_pid)
                    if observed_start is not None:
                        state = ("active_elsewhere" if state == "active" else "cancelling") if observed_start == owner_start else "ownership_uncertain"
                    else:
                        try:
                            os.kill(owner_pid, 0)
                        except ProcessLookupError:
                            state = "interrupted"
                        except OSError:
                            state = "ownership_uncertain"
                        else:
                            state = "active_elsewhere" if state == "active" else "cancelling"
            return {
                "taskId": authority["task_id"], "state": state,
                "adapterId": authority["adapter_id"],
                "consentPolicyId": authority["consent_policy_id"],
                "consentPolicyRevision": authority["consent_policy_revision"],
                "policyProvenance": "unverified_legacy" if authority["consent_policy_id"] == "legacy-unverified" else "verified_current",
            }

    def recover_interrupted(
        self, source_identity: str, cleanup_unpublished: Callable[[str], None] | None = None,
        cleanup_staged_audio: Callable[[str], dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        if SOURCE_IDENTITY_RE.fullmatch(source_identity) is None or self._authority_store is None:
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media source identity is invalid.")
        with self._lock:
            if self._active_for_source(source_identity) is not None:
                raise MediaAcquisitionError("V3_MEDIA_SOURCE_TASK_ACTIVE", "An active Runtime task cannot be recovered.", status=409)
            authority = self._authority_store.source_authority(source_identity)
            if authority is None or authority["state"] not in {"active", "cancelling", "cleanup_incomplete"}:
                raise MediaAcquisitionError("V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN", "No interrupted source task is available for recovery.", status=409)
            task_id = authority["task_id"]
            try:
                product = self._authority_store.get(task_id)
            except Exception:
                product = None
            if authority["state"] != "cleanup_incomplete" and product is not None and product["sourceIdentity"] == source_identity and product["state"] in {"ready", "degraded"} and product["projections"] is not None:
                self._authority_store.mark_source_authority(task_id, "published")
                return {"disposition": "published", "authoritativeTaskId": task_id}
            owner_pid = authority.get("owner_pid")
            owner_start = authority.get("owner_start")
            if not isinstance(owner_pid, int) or not isinstance(owner_start, str) or not owner_start:
                raise MediaAcquisitionError("V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN", "Interrupted task ownership is unverified.", status=409)
            observed_start = process_start_token(owner_pid)
            if observed_start is not None:
                raise MediaAcquisitionError("V3_MEDIA_SOURCE_TASK_ACTIVE" if observed_start == owner_start else "V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN", "Task owner process is still running or has been reused.", status=409)
            try:
                os.kill(owner_pid, 0)
            except ProcessLookupError:
                pass
            except OSError as exc:
                raise MediaAcquisitionError("V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN", "Task owner liveness cannot be verified.", status=409) from exc
            else:
                raise MediaAcquisitionError("V3_MEDIA_SOURCE_TASK_ACTIVE", "Task owner process is still running.", status=409)
            try:
                receipt = self.sandbox.cleanup(task_id)
            except TaskArtifactError as exc:
                raise MediaAcquisitionError("V3_MEDIA_CLEANUP_INCOMPLETE", "Interrupted task cleanup failed.", status=500) from exc
            if receipt["residualCount"] != 0:
                raise MediaAcquisitionError("V3_MEDIA_CLEANUP_INCOMPLETE", "Interrupted task retains private artifacts.", status=500)
            if cleanup_staged_audio is not None:
                try:
                    staged_receipt = cleanup_staged_audio(task_id)
                except Exception as exc:
                    raise MediaAcquisitionError(
                        "V3_MEDIA_CLEANUP_INCOMPLETE", "Interrupted ASR staging cleanup failed.", status=500
                    ) from exc
                if staged_receipt.get("residualCount") != 0:
                    raise MediaAcquisitionError(
                        "V3_MEDIA_CLEANUP_INCOMPLETE", "Interrupted ASR staging retains private artifacts.", status=500
                    )
            if cleanup_unpublished is not None:
                try:
                    cleanup_unpublished(task_id)
                except Exception as exc:
                    raise MediaAcquisitionError(
                        "V3_MEDIA_CLEANUP_INCOMPLETE", "Interrupted product evidence cleanup failed.", status=500
                    ) from exc
            self._authority_store.mark_source_authority(
                task_id, "cancelled" if authority["state"] == "cancelling" else "failed"
            )
            return {"disposition": "abandoned", "authoritativeTaskId": task_id}

    def _create_locked(self, request: MediaAcquisitionRequest) -> dict[str, Any]:
        try:
            self.sandbox.create(request.task_id)
        except TaskArtifactError as exc:
            raise MediaAcquisitionError(exc.code, str(exc), status=409) from exc
        if self._authority_store is not None:
            try:
                authority = self._authority_store.reserve_source_authority(
                    request.source_identity, request.task_id, request.adapter_id,
                    request.consent_policy_id, request.consent_policy_revision,
                )
            except Exception:
                self.sandbox.cleanup(request.task_id)
                raise
            if authority["task_id"] != request.task_id:
                self.sandbox.cleanup(request.task_id)
                raise MediaAcquisitionError("V3_MEDIA_SOURCE_TASK_ACTIVE", "Another Runtime owns this media source.", status=409)
        return self._remember_created_request(request)

    def _remember_created_request(self, request: MediaAcquisitionRequest) -> dict[str, Any]:
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

    def local_import_eligibility(self, task_id: str, source_identity: str) -> dict[str, Any]:
        """Prove a task/source is an eligible BLOCKED acquisition for a local import.

        This is the PRODUCTION eligibility query. It is the only thing that may
        authorise allocating an import record, a token, a quota reservation, a
        sandbox or a writer, so every condition is checked here and nowhere
        else:

          * the exact taskId AND sourceIdentity are the ones this task owns;
          * all three automatic routes have failed in the frozen order;
          * there is NO selected input yet;
          * there is NO active capture on the task;
          * there is NO terminal or published source authority.
        """
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise MediaAcquisitionError(
                    "V3_MEDIA_TASK_INVALID", "Media acquisition task was not found.", status=404
                )
            if task["sourceIdentity"] != source_identity:
                raise MediaAcquisitionError(
                    "V3_MEDIA_TASK_INVALID", "Media source identity does not match the task.", status=409
                )
            failures = self._route_failures.get(task_id, [])
            if len(failures) != len(CAPTURE_FALLBACK_ROUTES):
                raise MediaAcquisitionError(
                    "V3_MEDIA_CAPTURE_NOT_ELIGIBLE",
                    "The three automatic routes have not all failed.",
                    status=409,
                )
            if task.get("selectedInput") is not None:
                raise MediaAcquisitionError(
                    "V3_MEDIA_CAPTURE_NOT_ELIGIBLE", "The task already holds a selected input.", status=409
                )
            if task.get("captureGrantId") is not None or task["state"] == "capturing":
                raise MediaAcquisitionError(
                    "V3_MEDIA_CAPTURE_NOT_ELIGIBLE", "The task already has an active capture.", status=409
                )
            if task["state"] in TERMINAL_STATES:
                raise MediaAcquisitionError(
                    "V3_MEDIA_CAPTURE_NOT_ELIGIBLE", "The task already reached a terminal state.", status=409
                )
            authority = self._authority_store.source_authority(source_identity) if self._authority_store is not None else None
            if authority is not None and authority["state"] in {
                "published", "cancelling", "failed", "cancelled", "cleanup_incomplete",
            }:
                raise MediaAcquisitionError(
                    "V3_MEDIA_CAPTURE_NOT_ELIGIBLE", "The media source already has a terminal authority.", status=409
                )
            return {
                "taskId": task_id,
                "sourceIdentity": source_identity,
                "failures": [dict(item) for item in failures],
                "eligible": True,
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
            if task_id in self._executing:
                raise MediaAcquisitionError("V3_MEDIA_ACQUISITION_IN_PROGRESS", "Media acquisition is already running.", status=409)
            self._executing.add(task_id)
        try:
            return self._acquire_input(
                task_id, lease_store=lease_store, acquirers=acquirers,
                preserve_expected_failures=preserve_expected_failures,
            )
        finally:
            with self._lock:
                self._executing.discard(task_id)

    def _acquire_input(
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
            if not self._fail_acquisition(task_id, exc.code):
                raise MediaAcquisitionError("V3_MEDIA_CLEANUP_INCOMPLETE", "Acquisition cleanup failed.", status=500) from exc
            raise MediaAcquisitionError(exc.code, "Credential lease is unavailable.", status=exc.status) from exc
        except Exception as exc:
            if not self._fail_acquisition(task_id, "V3_MEDIA_PLATFORM_REJECTED"):
                raise MediaAcquisitionError("V3_MEDIA_CLEANUP_INCOMPLETE", "Acquisition cleanup failed.", status=500) from exc
            raise
        with self._lock:
            self._inputs[task_id] = result
            return dict(result)

    def _fail_acquisition(self, task_id: str, failure_code: str) -> bool:
        with self._lock:
            try:
                receipt = self.sandbox.cleanup(task_id)
                cleaned = receipt["residualCount"] == 0
            except Exception:
                cleaned = False
            current = self._tasks[task_id]
            current.update(
                state="failed", terminalAt=utc_now(),
                failureCode=failure_code if cleaned else "V3_MEDIA_CLEANUP_INCOMPLETE",
            )
            if self._authority_store is not None:
                self._authority_store.mark_source_authority(task_id, "failed" if cleaned else "cleanup_incomplete")
            return cleaned

    def get(self, task_id: str) -> dict[str, Any]:
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media acquisition task was not found.", status=404)
            return dict(task)

    def latest_for_source(self, source_identity: str) -> dict[str, Any]:
        with self._lock:
            if self._authority_store is not None:
                authority = self._authority_store.source_authority(source_identity)
                if authority is not None:
                    task = self._tasks.get(authority["task_id"])
                    if task is None:
                        raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Current source task is unavailable in this Runtime.", status=404)
                    return dict(task)
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
            # `explicit_local_media_asr` is the user-gesture route; it lands in
            # this same structure, so both audio routes are rebuilt here.
            if task is None or result is None or result.get("route") not in AUDIO_INPUT_ROUTES:
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
            if task_id in self._executing:
                raise MediaAcquisitionError("V3_MEDIA_ACQUISITION_IN_PROGRESS", "Acquisition must finish before task cleanup can begin.", status=409)
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
                if self._authority_store is not None:
                    self._authority_store.mark_source_authority(task_id, "cleanup_incomplete")
                cleanup_event.set()
            raise MediaAcquisitionError("V3_MEDIA_CLEANUP_INCOMPLETE", "Task cancellation cleanup did not complete.", status=500) from exc
        with self._lock:
            task = self._tasks[task_id]
            task.update(state="cancelled", terminalAt=utc_now(), failureCode=None)
            if self._authority_store is not None:
                self._authority_store.mark_source_authority(task_id, "cancelled")
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
                if self._authority_store is not None:
                    self._authority_store.mark_source_authority(task_id, "cleanup_incomplete")
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
