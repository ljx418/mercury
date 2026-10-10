from __future__ import annotations

import hashlib
from dataclasses import dataclass

from ..asr.provider import AsrProviderError, AsrTranscriptCandidate, RawAsrTranscript
from ..asr.srt_normalizer import normalize_srt
from .contracts import AcquisitionAudioRef


@dataclass(frozen=True)
class ValidatedTranscript:
    candidate: AsrTranscriptCandidate
    content_sha256: str
    speech_interval_count: int
    speech_duration_ms: int
    coverage_ratio: float = 1.0


def validate_transcript(
    raw: RawAsrTranscript,
    audio: AcquisitionAudioRef,
) -> ValidatedTranscript:
    if raw.task_id != audio.task_id:
        raise AsrProviderError("V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH", "ASR output belongs to another task.")
    if raw.provider_id != "funasr_edge_local" or raw.model_id != "funasr-sensevoice-small-q8":
        raise AsrProviderError("V3_MEDIA_TRANSCRIPT_MODEL_MISMATCH", "ASR output does not match the frozen model profile.")
    if raw.vad_segment_count <= 0:
        raise AsrProviderError("V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE", "FSMN-VAD segment count is unavailable.")
    try:
        candidate = normalize_srt(raw, audio_duration_ms=audio.duration_ms)
    except AsrProviderError as exc:
        code = "V3_MEDIA_TRANSCRIPT_EMPTY" if exc.code == "V3_ASR_TRANSCRIPT_EMPTY" else "V3_MEDIA_TRANSCRIPT_INVALID"
        raise AsrProviderError(code, "SenseVoice transcript failed strict SRT validation.") from exc
    if len(candidate.segments) != raw.vad_segment_count:
        raise AsrProviderError("V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE", "SRT and FSMN-VAD segment counts differ.")
    speech_duration = sum(segment.end_ms - segment.start_ms for segment in candidate.segments)
    canonical = b"".join(
        (
            f"{segment.segment_id}\t{segment.start_ms}\t{segment.end_ms}\t"
            f"{hashlib.sha256(segment.text.encode('utf-8')).hexdigest()}\n"
        ).encode("utf-8")
        for segment in candidate.segments
    )
    content_sha256 = hashlib.sha256(canonical).hexdigest()
    return ValidatedTranscript(candidate, content_sha256, raw.vad_segment_count, speech_duration)
