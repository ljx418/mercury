from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from threading import RLock
from typing import Any

from .acquisition import MediaAcquisitionCoordinator, MediaAcquisitionError
from .asr.provider import AsrProviderError


TERMINAL_STATES = {"succeeded", "degraded", "blocked", "failed", "cancelled"}


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class MediaTranscriptProjectionService:
    """Build the closed-set product read model shared by extension surfaces."""

    def __init__(self, acquisition: MediaAcquisitionCoordinator, transcripts: Any) -> None:
        self._acquisition = acquisition
        self._transcripts = transcripts
        self._snapshots: dict[str, tuple[str, int, str]] = {}
        self._lock = RLock()

    def get(self, task_id: str) -> dict[str, Any]:
        acquisition = self._acquisition.get(task_id)
        eligibility = self._acquisition.capture_eligibility(task_id)
        selected_input = self._acquisition.selected_input(task_id)
        transcript = self._transcript_or_none(task_id)
        state = self._state(acquisition, eligibility, transcript)
        route = self._route(acquisition, selected_input)
        segments = self._segments(task_id, transcript)
        failure_code = acquisition.get("failureCode")
        if transcript and transcript.get("result"):
            failure_code = transcript["result"].get("failureCode") or failure_code
        terminal = state in TERMINAL_STATES
        progress = self._progress(state, transcript)
        body = {
            "schemaVersion": "v3-media-transcript-projection/v1",
            "taskId": task_id,
            "sourceIdentity": acquisition["sourceIdentity"],
            "adapterId": acquisition["adapterId"],
            "state": state,
            "route": route,
            "progressPercent": progress,
            "failureCode": failure_code,
            "terminal": terminal,
            "cleanupStatus": "complete" if terminal else ("pending" if state == "cleaning" else "not_applicable"),
            "canCancel": not terminal,
            "canRetry": state in {"blocked", "failed", "cancelled"},
            "failures": eligibility["failures"],
            "segments": segments,
            "resources": dict(transcript["resources"]) if transcript and transcript.get("resources") else None,
        }
        revision, updated_at = self._version(task_id, body, acquisition, transcript)
        return {**body, "revision": revision, "updatedAt": updated_at}

    def latest_for_source(self, source_identity: str) -> dict[str, Any]:
        return self.get(self._acquisition.latest_for_source(source_identity)["taskId"])

    def _transcript_or_none(self, task_id: str) -> dict[str, Any] | None:
        try:
            return self._transcripts.get(task_id)
        except AsrProviderError:
            return None

    def _segments(self, task_id: str, transcript: dict[str, Any] | None) -> list[dict[str, Any]]:
        if transcript and transcript["state"] == "succeeded":
            return [dict(item) for item in self._transcripts.private_segments(task_id)]
        return [dict(item) for item in self._acquisition.public_segments(task_id)]

    @staticmethod
    def _state(acquisition: dict[str, Any], eligibility: dict[str, Any], transcript: dict[str, Any] | None) -> str:
        if transcript:
            state = transcript["state"]
            if state in {"queued", "loading_model", "transcribing", "validating"}:
                return "transcribing"
            return state
        if eligibility["captureFallbackEligible"] and acquisition["state"] == "acquiring":
            return "awaiting_trusted_capture"
        return acquisition["state"]

    @staticmethod
    def _route(acquisition: dict[str, Any], selected_input: dict[str, Any] | None) -> str:
        if selected_input is not None:
            return str(selected_input["route"])
        if acquisition.get("captureGrantId"):
            return "trusted_tab_capture_asr"
        return "none"

    @staticmethod
    def _progress(state: str, transcript: dict[str, Any] | None) -> int:
        if transcript and transcript.get("progress"):
            return int(transcript["progress"][-1]["percent"])
        return {
            "created": 0,
            "acquiring": 10,
            "awaiting_trusted_capture": 25,
            "capturing": 40,
            "cleaning": 99,
            "succeeded": 100,
            "degraded": 100,
            "blocked": 100,
            "failed": 100,
            "cancelled": 100,
        }.get(state, 0)

    def _version(
        self,
        task_id: str,
        body: dict[str, Any],
        acquisition: dict[str, Any],
        transcript: dict[str, Any] | None,
    ) -> tuple[int, str]:
        digest = hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
        observed_at = transcript["progress"][-1]["observedAt"] if transcript and transcript.get("progress") else utc_now()
        with self._lock:
            previous = self._snapshots.get(task_id)
            if previous is None:
                revision = 1
            elif previous[0] == digest:
                return previous[1], previous[2]
            else:
                revision = previous[1] + 1
            self._snapshots[task_id] = (digest, revision, observed_at)
            return revision, observed_at
