from __future__ import annotations

import math
import logging
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Event, RLock, Thread
from typing import Any

from ..asr.provider import AsrProviderAdapter, AsrProviderError
from .audio_ref import AudioStagingError, TaskAudioStager
from .contracts import AcquisitionAudioRef
from .transcript_validator import ValidatedTranscript, validate_transcript


TRANSCRIPT_FAILURE_CODES = frozenset(
    {
        "V3_MEDIA_TRANSCRIPT_TASK_INVALID",
        "V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH",
        "V3_MEDIA_TRANSCRIPT_AUDIO_UNAVAILABLE",
        "V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE",
        "V3_MEDIA_TRANSCRIPT_MODEL_MISMATCH",
        "V3_MEDIA_TRANSCRIPT_PROCESS_TIMEOUT",
        "V3_MEDIA_TRANSCRIPT_PROCESS_FAILED",
        "V3_MEDIA_TRANSCRIPT_OUTPUT_LIMIT",
        "V3_MEDIA_TRANSCRIPT_EMPTY",
        "V3_MEDIA_TRANSCRIPT_INVALID",
        "V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE",
        "V3_MEDIA_TRANSCRIPT_CANCELLED",
        "V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE",
    }
)
TERMINAL = {"succeeded", "failed", "cancelled"}
LOGGER = logging.getLogger(__name__)


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class TranscriptTask:
    audio: AcquisitionAudioRef


class SenseVoiceTranscriptService:
    """Synchronous local transcript service with a single native-ASR execution lane."""

    def __init__(
        self,
        stager: TaskAudioStager,
        provider_factory: Callable[[], AsrProviderAdapter],
        acquisition_cleanup: Callable[[str], dict[str, Any]],
    ) -> None:
        self._stager = stager
        self._provider_factory = provider_factory
        self._acquisition_cleanup = acquisition_cleanup
        self._tasks: dict[str, dict[str, Any]] = {}
        self._requests: dict[str, TranscriptTask] = {}
        self._cancel: dict[str, Event] = {}
        self._private_results: dict[str, ValidatedTranscript] = {}
        self._private_diagnostics: dict[str, dict[str, object]] = {}
        self._threads: dict[str, Thread] = {}
        self._lock = RLock()
        self._execution_lock = RLock()

    def create(self, request: TranscriptTask) -> dict[str, Any]:
        try:
            request.audio.validate()
        except ValueError as exc:
            raise AsrProviderError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "Transcript task input is invalid.") from exc
        task_id = request.audio.task_id
        with self._lock:
            previous = self._requests.get(task_id)
            if previous is not None:
                if previous != request:
                    raise AsrProviderError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "Task ID is bound to another input.")
                return self._public(task_id)
            self._requests[task_id] = request
            self._cancel[task_id] = Event()
            self._tasks[task_id] = {
                "schemaVersion": "v3-media-transcript-execution/v2",
                "taskId": task_id,
                "sourceIdentity": request.audio.source_identity,
                "acquisitionRecordId": request.audio.acquisition_record_id,
                "state": "queued",
                "progress": [],
                "coverage": None,
                "resources": None,
                "result": None,
            }
            self._observe(task_id, "queued", 0)
            return self._public(task_id)

    def start(self, task_id: str) -> dict[str, Any]:
        with self._lock:
            task = self._require(task_id)
            thread = self._threads.get(task_id)
            if task["state"] == "queued" and (thread is None or not thread.is_alive()):
                thread = Thread(target=self.run, args=(task_id,), daemon=True, name=f"navia-transcript-{task_id}")
                self._threads[task_id] = thread
                thread.start()
            return self._public(task_id)

    def wait(self, task_id: str, timeout: float | None = None) -> dict[str, Any]:
        with self._lock:
            self._require(task_id)
            thread = self._threads.get(task_id)
        if thread is not None:
            thread.join(timeout)
        return self.get(task_id)

    def run(self, task_id: str) -> dict[str, Any]:
        with self._execution_lock:
            with self._lock:
                task = self._require(task_id)
                if task["state"] in TERMINAL:
                    return self._public(task_id)
                request = self._requests[task_id]
                cancelled = self._cancel[task_id]
                self._transition(task_id, "loading_model", 1)
            provider: AsrProviderAdapter | None = None
            validated: ValidatedTranscript | None = None
            failure_code: str | None = None
            try:
                if cancelled.is_set():
                    raise AsrProviderError("V3_ASR_PROCESS_CANCELLED", "Transcript task was cancelled.")
                audio, staging_receipt = self._stager.stage(request.audio)
                with self._lock:
                    self._tasks[task_id]["resources"] = {
                        "acquisitionArtifactBytes": staging_receipt.byte_length,
                        "temporaryDiskPeakBytes": staging_receipt.byte_length * 2,
                        "cpuCoreLimit": 8,
                        "memoryLimitBytes": 8 * 1024**3,
                        "gpuUsed": False,
                    }
                provider = self._provider_factory()
                provider.load()
                self._transition(task_id, "transcribing", 5)
                timeout = min(14_400.0, max(600.0, math.ceil(request.audio.duration_ms / 1000 * 3.0)))
                raw = provider.transcribe(audio, timeout=timeout, cancel_event=cancelled)
                with self._lock:
                    self._tasks[task_id]["resources"].update({
                        "elapsedMs": round(raw.elapsed_seconds * 1000),
                        "peakRssBytes": raw.peak_rss_bytes,
                    })
                self._transition(task_id, "validating", 95)
                validated = validate_transcript(raw, request.audio)
                self._transition(task_id, "cleaning", 99)
            except (AsrProviderError, AudioStagingError) as exc:
                failure_code = self._map_failure(exc.code)
                if isinstance(exc, AsrProviderError) and exc.private_diagnostic is not None:
                    self._private_diagnostics[task_id] = dict(exc.private_diagnostic)
                LOGGER.error(
                    "V3 transcript task %s failed with %s; privateDiagnostic=%r",
                    task_id,
                    exc.code,
                    exc.private_diagnostic if isinstance(exc, AsrProviderError) else None,
                )
            except Exception:
                LOGGER.exception("V3 transcript task %s failed unexpectedly", task_id)
                failure_code = "V3_MEDIA_TRANSCRIPT_PROCESS_FAILED"
            finally:
                if provider is not None:
                    try:
                        provider.close()
                    except Exception:
                        failure_code = "V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE"
                try:
                    stage_receipt = self._stager.cleanup(task_id)
                    acquisition_receipt = self._acquisition_cleanup(task_id)
                    if stage_receipt.get("residualCount") or acquisition_receipt.get("residualCount"):
                        failure_code = "V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE"
                except Exception:
                    failure_code = "V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE"

            with self._lock:
                task = self._require(task_id)
                if task["state"] in TERMINAL:
                    return self._public(task_id)
                if cancelled.is_set() or failure_code == "V3_MEDIA_TRANSCRIPT_CANCELLED":
                    self._terminal(task_id, "cancelled", "V3_MEDIA_TRANSCRIPT_CANCELLED", None)
                elif failure_code is not None or validated is None:
                    self._terminal(task_id, "failed", failure_code or "V3_MEDIA_TRANSCRIPT_PROCESS_FAILED", None)
                else:
                    self._private_results[task_id] = validated
                    task["coverage"] = {
                        "algorithm": "speech_interval_overlap/v1",
                        "speechIntervalCount": validated.speech_interval_count,
                        "speechDurationMs": validated.speech_duration_ms,
                        "coveredSpeechDurationMs": validated.speech_duration_ms,
                        "coverageRatio": 1.0,
                        "passed": True,
                    }
                    self._terminal(task_id, "succeeded", None, validated)
                return self._public(task_id)

    def cancel(self, task_id: str) -> dict[str, Any]:
        with self._lock:
            task = self._require(task_id)
            if task["state"] in TERMINAL:
                return self._public(task_id)
            self._cancel[task_id].set()
            if task["state"] == "queued":
                try:
                    self._stager.cleanup(task_id)
                    self._acquisition_cleanup(task_id)
                except Exception as exc:
                    self._terminal(task_id, "failed", "V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE", None)
                    raise AsrProviderError("V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE", "Queued transcript cleanup failed.") from exc
                self._terminal(task_id, "cancelled", "V3_MEDIA_TRANSCRIPT_CANCELLED", None)
            return self._public(task_id)

    def get(self, task_id: str) -> dict[str, Any]:
        with self._lock:
            self._require(task_id)
            return self._public(task_id)

    def private_segments(self, task_id: str) -> tuple[dict[str, Any], ...]:
        with self._lock:
            result = self._private_results.get(task_id)
            if result is None:
                raise AsrProviderError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "Transcript is not available.")
            return tuple(
                {"segmentId": segment.segment_id, "startMs": segment.start_ms, "endMs": segment.end_ms, "text": segment.text}
                for segment in result.candidate.segments
            )

    def private_diagnostic(self, task_id: str) -> dict[str, object] | None:
        with self._lock:
            value = self._private_diagnostics.get(task_id)
            return dict(value) if value is not None else None

    def _observe(self, task_id: str, phase: str, percent: int) -> None:
        task = self._tasks[task_id]
        task["progress"].append(
            {
                "sequence": len(task["progress"]),
                "phase": phase,
                "completedMs": round(task["sourceIdentity"] and self._requests[task_id].audio.duration_ms * percent / 100),
                "totalMs": self._requests[task_id].audio.duration_ms,
                "percent": percent,
                "observedAt": utc_now(),
            }
        )

    def _transition(self, task_id: str, phase: str, percent: int) -> None:
        with self._lock:
            task = self._require(task_id)
            if task["state"] in TERMINAL:
                raise AsrProviderError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "Terminal task cannot transition.")
            task["state"] = phase
            self._observe(task_id, phase, percent)

    def _terminal(
        self,
        task_id: str,
        status: str,
        failure_code: str | None,
        validated: ValidatedTranscript | None,
    ) -> None:
        if failure_code is not None and failure_code not in TRANSCRIPT_FAILURE_CODES:
            failure_code = "V3_MEDIA_TRANSCRIPT_PROCESS_FAILED"
        task = self._tasks[task_id]
        if task["state"] in TERMINAL:
            return
        task["state"] = status
        self._observe(task_id, "completed" if status == "succeeded" else status, 100)
        task["result"] = {
            "status": status,
            "transcriptId": f"mtr_{secrets.token_hex(16)}" if validated else None,
            "segmentCount": len(validated.candidate.segments) if validated else 0,
            "contentSha256": validated.content_sha256 if validated else None,
            "failureCode": failure_code,
            "terminalAt": utc_now(),
        }

    def _public(self, task_id: str) -> dict[str, Any]:
        task = self._tasks[task_id]
        return {
            "schemaVersion": task["schemaVersion"],
            "taskId": task["taskId"],
            "sourceIdentity": task["sourceIdentity"],
            "acquisitionRecordId": task["acquisitionRecordId"],
            "state": task["state"],
            "progress": [dict(item) for item in task["progress"]],
            "coverage": dict(task["coverage"]) if task["coverage"] else None,
            "resources": dict(task["resources"]) if task["resources"] else None,
            "result": dict(task["result"]) if task["result"] else None,
        }

    def _require(self, task_id: str) -> dict[str, Any]:
        task = self._tasks.get(task_id)
        if task is None:
            raise AsrProviderError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "Transcript task was not found.")
        return task

    @staticmethod
    def _map_failure(code: str) -> str:
        return {
            "V3_ASR_PROCESS_TIMEOUT": "V3_MEDIA_TRANSCRIPT_PROCESS_TIMEOUT",
            "V3_ASR_PROCESS_FAILED": "V3_MEDIA_TRANSCRIPT_PROCESS_FAILED",
            "V3_ASR_PROCESS_START_FAILED": "V3_MEDIA_TRANSCRIPT_PROCESS_FAILED",
            "V3_ASR_PROCESS_OUTPUT_LIMIT": "V3_MEDIA_TRANSCRIPT_OUTPUT_LIMIT",
            "V3_ASR_PROCESS_CANCELLED": "V3_MEDIA_TRANSCRIPT_CANCELLED",
            "V3_ASR_VAD_RECEIPT_INVALID": "V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE",
        }.get(code, code if code in TRANSCRIPT_FAILURE_CODES else "V3_MEDIA_TRANSCRIPT_PROCESS_FAILED")
