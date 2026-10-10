from __future__ import annotations

import hashlib
import re
import shutil
import stat
import time
import wave
from dataclasses import dataclass
from pathlib import Path
from threading import Event

from .provider import (
    AsrProviderAdapter,
    AsrProviderError,
    AsrSegment,
    AsrTranscriptCandidate,
    TaskAudioRef,
)
from .srt_normalizer import normalize_srt


ATTEMPT_ID_RE = re.compile(r"^attempt_[a-f0-9]{16}$")
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")


@dataclass(frozen=True)
class FixedWindowPlan:
    window_duration_ms: int = 120_000
    chunk_duration_ms: int = 15_000
    chunk_count: int = 8
    overlap_ms: int = 0
    max_concurrency: int = 1
    sample_rate_hz: int = 16_000
    channels: int = 1
    sample_width_bytes: int = 2
    expected_frame_count: int = 1_920_000
    maximum_tail_pad_frames: int = 16

    @property
    def frames_per_chunk(self) -> int:
        return self.sample_rate_hz * self.chunk_duration_ms // 1000

    def validate(self) -> None:
        expected = FixedWindowPlan()
        if self != expected or self.frames_per_chunk * self.chunk_count != self.expected_frame_count:
            raise AsrProviderError(
                "V3_ASR_FW_CHUNK_PLAN_DRIFT",
                "The fixed-window plan does not match the frozen qualification contract.",
            )


@dataclass(frozen=True)
class FixedWindowChunkObservation:
    chunk_index: int
    start_ms: int
    end_ms: int
    chunk_sha256: str
    segment_count: int
    output_text_sha256: str
    elapsed_ms: int


@dataclass(frozen=True)
class FixedWindowSampleResult:
    source_audio_sha256: str
    source_frame_count: int
    tail_pad_frames: int
    attempt_id: str
    elapsed_ms: int
    chunks: tuple[FixedWindowChunkObservation, ...]
    transcript: AsrTranscriptCandidate


class FixedWindowAsrOrchestrator:
    """Sequential, portal-neutral fixed-window ASR orchestration."""

    def __init__(
        self,
        tasks_root: Path,
        provider: AsrProviderAdapter,
        *,
        plan: FixedWindowPlan | None = None,
    ):
        if tasks_root.is_symlink() or not tasks_root.is_dir():
            raise AsrProviderError("V3_ASR_TASK_PATH_UNSAFE", "The ASR tasks root is not a real directory.")
        self._tasks_root = tasks_root.resolve(strict=True)
        self._provider = provider
        self._plan = plan or FixedWindowPlan()
        self._plan.validate()

    def transcribe(
        self,
        audio: TaskAudioRef,
        *,
        expected_source_sha256: str,
        attempt_id: str,
        timeout_per_chunk: float,
        cancel_event: Event | None = None,
    ) -> FixedWindowSampleResult:
        self._plan.validate()
        audio.validate_shape()
        if not SHA256_RE.fullmatch(expected_source_sha256):
            raise AsrProviderError("V3_ASR_FW_SOURCE_DENOMINATOR_CHANGED", "The source hash is invalid.")
        if not ATTEMPT_ID_RE.fullmatch(attempt_id):
            raise AsrProviderError("V3_ASR_FW_PARTIAL_REUSE_FORBIDDEN", "The attempt identity is invalid.")
        if timeout_per_chunk <= 0:
            raise AsrProviderError("V3_ASR_FW_CHUNK_PLAN_DRIFT", "The chunk timeout must be positive.")

        source_root, source_path = self._resolve_source(audio)
        owned_roots: list[Path] = [source_root]
        started = time.monotonic()
        result: FixedWindowSampleResult | None = None
        failure: BaseException | None = None
        try:
            source_bytes = source_path.read_bytes()
            source_sha256 = hashlib.sha256(source_bytes).hexdigest()
            if source_sha256 != expected_source_sha256:
                raise AsrProviderError(
                    "V3_ASR_FW_SOURCE_DENOMINATOR_CHANGED",
                    "The source audio does not match the frozen corpus.",
                )
            frames, source_frame_count = self._read_pcm_frames(source_path)
            tail_pad_frames = self._plan.expected_frame_count - source_frame_count
            if tail_pad_frames < 0 or tail_pad_frames > self._plan.maximum_tail_pad_frames:
                raise AsrProviderError(
                    "V3_ASR_FW_AUDIO_FORMAT_INVALID",
                    "The source frame count is outside the frozen tail-padding policy.",
                )
            if tail_pad_frames:
                frames += b"\x00" * tail_pad_frames * self._plan.sample_width_bytes

            observations: list[FixedWindowChunkObservation] = []
            merged_segments: list[AsrSegment] = []
            identity = hashlib.sha256(source_sha256.encode("ascii")).hexdigest()[:8]
            provider_id: str | None = None
            model_id: str | None = None
            for chunk_index in range(self._plan.chunk_count):
                if cancel_event is not None and cancel_event.is_set():
                    raise AsrProviderError("V3_ASR_PROCESS_CANCELLED", "Fixed-window ASR was cancelled.")
                child_root, chunk_ref, chunk_sha256 = self._write_chunk(
                    frames,
                    source_task_id=audio.task_id,
                    attempt_id=attempt_id,
                    chunk_index=chunk_index,
                )
                owned_roots.append(child_root)
                try:
                    raw = self._provider.transcribe(
                        chunk_ref,
                        timeout=timeout_per_chunk,
                        cancel_event=cancel_event,
                    )
                    if (
                        raw.task_id != chunk_ref.task_id
                        or raw.provider_id != self._provider.provider_id
                        or raw.model_id != self._provider.model_id
                    ):
                        raise AsrProviderError(
                            "V3_ASR_FW_PROVIDER_BOUNDARY_BYPASSED",
                            "The provider result identity did not match the closed adapter boundary.",
                        )
                    try:
                        local = normalize_srt(raw, audio_duration_ms=self._plan.chunk_duration_ms)
                    except AsrProviderError as exc:
                        if exc.code == "V3_ASR_TRANSCRIPT_EMPTY":
                            raise AsrProviderError(
                                "V3_ASR_FW_CHUNK_TRANSCRIPT_EMPTY",
                                f"Fixed-window chunk {chunk_index} produced no transcript segments.",
                            ) from exc
                        raise AsrProviderError(
                            "V3_ASR_FW_LOCAL_TIMESTAMP_INVALID",
                            f"Fixed-window chunk {chunk_index} returned an invalid local transcript.",
                        ) from exc
                    offset_ms = chunk_index * self._plan.chunk_duration_ms
                    for local_index, segment in enumerate(local.segments):
                        merged_segments.append(
                            AsrSegment(
                                segment_id=f"fw_{identity}_{chunk_index:02d}_{local_index:04d}",
                                start_ms=offset_ms + segment.start_ms,
                                end_ms=offset_ms + segment.end_ms,
                                text=segment.text,
                            )
                        )
                    observations.append(
                        FixedWindowChunkObservation(
                            chunk_index=chunk_index,
                            start_ms=offset_ms,
                            end_ms=offset_ms + self._plan.chunk_duration_ms,
                            chunk_sha256=chunk_sha256,
                            segment_count=len(local.segments),
                            output_text_sha256=hashlib.sha256(raw.text.encode("utf-8")).hexdigest(),
                            elapsed_ms=max(1, round(raw.elapsed_seconds * 1000)),
                        )
                    )
                    provider_id = raw.provider_id
                    model_id = raw.model_id
                finally:
                    self._remove_owned_task(child_root)

            self._validate_merged(merged_segments)
            transcript = AsrTranscriptCandidate(
                provider_id=provider_id or self._provider.provider_id,
                model_id=model_id or self._provider.model_id,
                task_id=audio.task_id,
                duration_ms=self._plan.window_duration_ms,
                segments=tuple(merged_segments),
            )
            result = FixedWindowSampleResult(
                source_audio_sha256=source_sha256,
                source_frame_count=source_frame_count,
                tail_pad_frames=tail_pad_frames,
                attempt_id=attempt_id,
                elapsed_ms=max(1, round((time.monotonic() - started) * 1000)),
                chunks=tuple(observations),
                transcript=transcript,
            )
        except BaseException as exc:
            failure = exc
        cleanup_failed = False
        for owned_root in reversed(owned_roots):
            try:
                self._remove_owned_task(owned_root)
            except OSError:
                cleanup_failed = True
        if cleanup_failed or any(root.exists() for root in owned_roots):
            raise AsrProviderError(
                "V3_ASR_FW_PRIVATE_DATA_RETAINED",
                "Fixed-window private task data could not be fully removed.",
            ) from failure
        if failure is not None:
            raise failure
        if result is None:
            raise AsrProviderError("V3_ASR_FW_CHUNK_TRANSCRIPT_EMPTY", "Fixed-window ASR produced no result.")
        return result

    def _resolve_source(self, audio: TaskAudioRef) -> tuple[Path, Path]:
        source_root = self._tasks_root / audio.task_id
        source_path = source_root / Path(*Path(audio.relative_path).parts)
        for candidate in (source_root, source_path):
            if candidate.is_symlink():
                raise AsrProviderError("V3_ASR_PATH_LINK_REJECTED", "Links are not accepted in ASR task inputs.")
        if not source_root.is_dir() or not source_path.is_file():
            raise AsrProviderError("V3_ASR_TASK_NOT_FOUND", "The source ASR task was not found.")
        resolved_root = source_root.resolve(strict=True)
        resolved_path = source_path.resolve(strict=True)
        if not resolved_root.is_relative_to(self._tasks_root) or not resolved_path.is_relative_to(resolved_root):
            raise AsrProviderError("V3_ASR_TASK_PATH_UNSAFE", "The source ASR task escaped its controlled root.")
        if stat.S_ISLNK(source_path.lstat().st_mode) or source_path.stat().st_nlink != 1:
            raise AsrProviderError("V3_ASR_AUDIO_FILE_UNSAFE", "The source ASR audio is linked.")
        return resolved_root, resolved_path

    def _read_pcm_frames(self, path: Path) -> tuple[bytes, int]:
        try:
            with wave.open(str(path), "rb") as reader:
                frame_count = reader.getnframes()
                if (
                    reader.getnchannels() != self._plan.channels
                    or reader.getsampwidth() != self._plan.sample_width_bytes
                    or reader.getframerate() != self._plan.sample_rate_hz
                    or reader.getcomptype() != "NONE"
                ):
                    raise AsrProviderError(
                        "V3_ASR_FW_AUDIO_FORMAT_INVALID",
                        "The source WAV is not frozen PCM16 mono 16 kHz audio.",
                    )
                frames = reader.readframes(frame_count)
        except (EOFError, wave.Error) as exc:
            raise AsrProviderError("V3_ASR_FW_AUDIO_FORMAT_INVALID", "The source WAV could not be parsed.") from exc
        if len(frames) != frame_count * self._plan.sample_width_bytes:
            raise AsrProviderError("V3_ASR_FW_AUDIO_FORMAT_INVALID", "The source WAV frame payload is incomplete.")
        return frames, frame_count

    def _write_chunk(
        self,
        frames: bytes,
        *,
        source_task_id: str,
        attempt_id: str,
        chunk_index: int,
    ) -> tuple[Path, TaskAudioRef, str]:
        identity = hashlib.sha256(f"{source_task_id}:{attempt_id}".encode("utf-8")).hexdigest()[:16]
        task_id = f"fw-{identity}-{chunk_index:02d}"
        child_root = self._tasks_root / task_id
        if child_root.exists() or child_root.is_symlink():
            raise AsrProviderError(
                "V3_ASR_FW_PARTIAL_REUSE_FORBIDDEN",
                "A fixed-window child task already exists.",
            )
        child_root.mkdir(mode=0o700)
        child_root.chmod(0o700)
        try:
            start = chunk_index * self._plan.frames_per_chunk * self._plan.sample_width_bytes
            end = start + self._plan.frames_per_chunk * self._plan.sample_width_bytes
            payload = frames[start:end]
            if len(payload) != self._plan.frames_per_chunk * self._plan.sample_width_bytes:
                raise AsrProviderError("V3_ASR_FW_AUDIO_FORMAT_INVALID", "A fixed-window chunk is incomplete.")
            chunk_path = child_root / "audio.wav"
            with wave.open(str(chunk_path), "wb") as writer:
                writer.setnchannels(self._plan.channels)
                writer.setsampwidth(self._plan.sample_width_bytes)
                writer.setframerate(self._plan.sample_rate_hz)
                writer.writeframes(payload)
            chunk_path.chmod(0o600)
            chunk_sha256 = hashlib.sha256(chunk_path.read_bytes()).hexdigest()
            return child_root, TaskAudioRef(task_id=task_id, relative_path="audio.wav"), chunk_sha256
        except BaseException:
            try:
                self._remove_owned_task(child_root)
            except OSError as cleanup_error:
                raise AsrProviderError(
                    "V3_ASR_FW_PRIVATE_DATA_RETAINED",
                    "A failed fixed-window chunk could not be removed.",
                ) from cleanup_error
            raise

    def _validate_merged(self, segments: list[AsrSegment]) -> None:
        if not segments:
            raise AsrProviderError("V3_ASR_FW_CHUNK_TRANSCRIPT_EMPTY", "Fixed-window ASR produced no segments.")
        seen: set[str] = set()
        previous_end = 0
        for segment in segments:
            if (
                segment.segment_id in seen
                or segment.start_ms < previous_end
                or segment.start_ms >= segment.end_ms
                or segment.end_ms > self._plan.window_duration_ms
            ):
                raise AsrProviderError(
                    "V3_ASR_FW_GLOBAL_TIMESTAMP_INVALID",
                    "Merged fixed-window segments violate the global timestamp contract.",
                )
            seen.add(segment.segment_id)
            previous_end = segment.end_ms

    def _remove_owned_task(self, task_root: Path) -> None:
        if task_root.exists():
            resolved = task_root.resolve(strict=True)
            if not resolved.is_relative_to(self._tasks_root) or resolved == self._tasks_root:
                raise OSError("unsafe task cleanup target")
            shutil.rmtree(resolved)
