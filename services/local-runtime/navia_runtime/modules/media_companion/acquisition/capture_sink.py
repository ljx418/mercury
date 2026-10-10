from __future__ import annotations

import hashlib
import os
import sys
import wave
from array import array
from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from typing import Any

from navia_runtime.contracts import utc_now

from .contracts import AcquisitionAudioRef
from .task_artifacts import ArtifactRef, TaskArtifactError, TaskArtifactSandbox


MAX_CAPTURE_SECONDS = 900
MAX_CAPTURE_BYTES = 512 * 1024**2
MAX_CHUNK_BYTES = 1024**2
CAPTURE_SAMPLE_RATE_HZ = 16_000
CAPTURE_CHANNELS = 1
CAPTURE_SAMPLE_WIDTH_BYTES = 2


class CaptureSinkFailure(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass
class _ActiveCapture:
    task_id: str
    source_identity: str
    acquisition_record_id: str
    grant: dict[str, Any]
    path: Path
    writer: wave.Wave_write
    next_sequence: int = 0
    byte_length: int = 0
    frame_count: int = 0
    non_zero_sample_count: int = 0
    peak_abs_sample: int = 0


class RuntimeCaptureSink:
    """Single active task-private PCM sink with deterministic cleanup."""

    def __init__(self, sandbox: TaskArtifactSandbox) -> None:
        self.sandbox = sandbox
        self._active: _ActiveCapture | None = None
        self._lock = RLock()

    def begin(
        self,
        *,
        task_id: str,
        source_identity: str,
        acquisition_record_id: str,
        grant: dict[str, Any],
        sample_rate_hz: int,
        channels: int,
        sample_width_bytes: int,
    ) -> dict[str, Any]:
        if (sample_rate_hz, channels, sample_width_bytes) != (
            CAPTURE_SAMPLE_RATE_HZ, CAPTURE_CHANNELS, CAPTURE_SAMPLE_WIDTH_BYTES
        ):
            raise CaptureSinkFailure("V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID")
        if not source_identity or len(source_identity) > 512 or not acquisition_record_id:
            raise CaptureSinkFailure("V3_MEDIA_CAPTURE_BINDING_INVALID")
        with self._lock:
            if self._active is not None:
                raise CaptureSinkFailure("V3_MEDIA_CAPTURE_ALREADY_ACTIVE")
            self.sandbox.create(task_id)
            path = self.sandbox.create_private_temp(task_id, suffix=".wav")
            try:
                writer = wave.open(str(path), "wb")
                writer.setnchannels(channels)
                writer.setsampwidth(sample_width_bytes)
                writer.setframerate(sample_rate_hz)
            except Exception:
                path.unlink(missing_ok=True)
                raise
            self._active = _ActiveCapture(
                task_id=task_id,
                source_identity=source_identity,
                acquisition_record_id=acquisition_record_id,
                grant=dict(grant),
                path=path,
                writer=writer,
            )
            return self._progress("capturing")

    def write(self, sequence: int, payload: bytes) -> dict[str, Any]:
        if type(sequence) is not int or sequence < 0 or not isinstance(payload, bytes) or not payload or len(payload) > MAX_CHUNK_BYTES:
            raise CaptureSinkFailure("V3_MEDIA_CAPTURE_CHUNK_INVALID")
        with self._lock:
            active = self._require()
            if sequence != active.next_sequence:
                raise CaptureSinkFailure("V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID")
            if active.byte_length + len(payload) > MAX_CAPTURE_BYTES:
                raise CaptureSinkFailure("V3_MEDIA_CAPTURE_BYTE_LIMIT")
            frame_size = CAPTURE_CHANNELS * CAPTURE_SAMPLE_WIDTH_BYTES
            if len(payload) % frame_size:
                raise CaptureSinkFailure("V3_MEDIA_CAPTURE_CHUNK_INVALID")
            next_frames = active.frame_count + len(payload) // frame_size
            if next_frames > CAPTURE_SAMPLE_RATE_HZ * MAX_CAPTURE_SECONDS:
                raise CaptureSinkFailure("V3_MEDIA_CAPTURE_DURATION_LIMIT")
            active.writer.writeframesraw(payload)
            samples = array("h")
            samples.frombytes(payload)
            if sys.byteorder != "little":
                samples.byteswap()
            active.non_zero_sample_count += sum(1 for sample in samples if sample != 0)
            active.peak_abs_sample = max(active.peak_abs_sample, max((abs(sample) for sample in samples), default=0))
            active.next_sequence += 1
            active.byte_length += len(payload)
            active.frame_count = next_frames
            return {
                "sequence": sequence,
                "byteLength": len(payload),
                "payloadSha256": hashlib.sha256(payload).hexdigest(),
                "receivedAt": utc_now(),
            }

    def finalize(self) -> tuple[AcquisitionAudioRef, dict[str, Any]]:
        with self._lock:
            active = self._require()
            if active.next_sequence == 0:
                raise CaptureSinkFailure("V3_MEDIA_CAPTURE_EMPTY")
            active.writer.close()
            if active.non_zero_sample_count == 0:
                self.sandbox.remove_private_temp(active.task_id, active.path)
                self._active = None
                raise CaptureSinkFailure("V3_MEDIA_CAPTURE_EMPTY")
            try:
                artifact = self.sandbox.publish_private_temp(active.task_id, "audio", active.path)
            except TaskArtifactError as exc:
                self._active = None
                raise CaptureSinkFailure("V3_MEDIA_CAPTURE_FINALIZE_FAILED") from exc
            duration_ms = round(active.frame_count * 1000 / CAPTURE_SAMPLE_RATE_HZ)
            reference = AcquisitionAudioRef(
                task_id=active.task_id,
                source_identity=active.source_identity,
                acquisition_record_id=active.acquisition_record_id,
                artifact=ArtifactRef(
                    task_id=active.task_id,
                    artifact_id=artifact.artifact_id,
                    kind=artifact.kind,
                    byte_length=artifact.byte_length,
                    sha256=artifact.sha256,
                ),
                duration_ms=duration_ms,
                sample_rate_hz=CAPTURE_SAMPLE_RATE_HZ,
                channels=CAPTURE_CHANNELS,
                sample_width_bytes=CAPTURE_SAMPLE_WIDTH_BYTES,
            )
            receipt = {
                "phase": "completed",
                "capturedMs": duration_ms,
                "byteLength": active.byte_length,
                "chunkCount": active.next_sequence,
                "nonZeroSampleCount": active.non_zero_sample_count,
                "peakAbsSample": active.peak_abs_sample,
                "artifact": artifact.public_dict(),
            }
            self._active = None
            return reference, receipt

    def abort(self) -> dict[str, Any]:
        with self._lock:
            active = self._active
            if active is None:
                return {"sinkClosed": True, "activeCaptureCount": 0, "residualRawAudioCount": 0}
            try:
                active.writer.close()
            finally:
                try:
                    self.sandbox.remove_private_temp(active.task_id, active.path)
                finally:
                    self._active = None
            return {"sinkClosed": True, "activeCaptureCount": 0, "residualRawAudioCount": 0}

    def active_count(self) -> int:
        with self._lock:
            return int(self._active is not None)

    def _require(self) -> _ActiveCapture:
        if self._active is None:
            raise CaptureSinkFailure("V3_MEDIA_CAPTURE_NOT_ACTIVE")
        return self._active

    def _progress(self, phase: str) -> dict[str, Any]:
        active = self._require()
        return {
            "phase": phase,
            "capturedMs": round(active.frame_count * 1000 / CAPTURE_SAMPLE_RATE_HZ),
            "byteLength": active.byte_length,
            "observedAt": utc_now(),
        }
