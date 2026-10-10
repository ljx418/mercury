from __future__ import annotations

import re

from .provider import AsrProviderError, AsrSegment, AsrTranscriptCandidate, RawAsrTranscript


TIMESTAMP_RE = re.compile(
    r"^(?P<sh>\d{2}):(?P<sm>[0-5]\d):(?P<ss>[0-5]\d),(?P<sms>\d{3})"
    r"\s+-->\s+"
    r"(?P<eh>\d{2}):(?P<em>[0-5]\d):(?P<es>[0-5]\d),(?P<ems>\d{3})$"
)
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _milliseconds(hours: str, minutes: str, seconds: str, milliseconds: str) -> int:
    return (((int(hours) * 60) + int(minutes)) * 60 + int(seconds)) * 1000 + int(milliseconds)


def normalize_srt(
    raw: RawAsrTranscript,
    *,
    audio_duration_ms: int,
    max_input_bytes: int = 4 * 1024 * 1024,
    max_segments: int = 10000,
    max_segment_chars: int = 8192,
    max_total_chars: int = 2 * 1024 * 1024,
) -> AsrTranscriptCandidate:
    if raw.format != "srt":
        raise AsrProviderError("V3_ASR_TRANSCRIPT_FORMAT_UNSUPPORTED", "ASR transcript format must be SRT.")
    if audio_duration_ms <= 0:
        raise AsrProviderError("V3_ASR_AUDIO_DURATION_INVALID", "ASR audio duration must be positive.")
    encoded = raw.text.encode("utf-8")
    if len(encoded) > max_input_bytes:
        raise AsrProviderError("V3_ASR_TRANSCRIPT_TOO_LARGE", "ASR transcript input exceeded the byte limit.")
    text = raw.text.removeprefix("\ufeff").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        raise AsrProviderError("V3_ASR_TRANSCRIPT_EMPTY", "ASR transcript contained no segments.")
    if CONTROL_RE.search(text):
        raise AsrProviderError("V3_ASR_TRANSCRIPT_CONTROL_CHARACTER", "ASR transcript contained a control character.")

    blocks = re.split(r"\n[ \t]*\n", text)
    if len(blocks) > max_segments:
        raise AsrProviderError("V3_ASR_TRANSCRIPT_TOO_MANY_SEGMENTS", "ASR transcript exceeded the segment limit.")
    segments: list[AsrSegment] = []
    source_ids: set[int] = set()
    ranges: set[tuple[int, int]] = set()
    total_chars = 0
    previous_start = -1
    previous_end = -1
    for block in blocks:
        lines = block.split("\n")
        if len(lines) < 2 or not lines[0].isdigit() or int(lines[0]) <= 0:
            raise AsrProviderError("V3_ASR_SRT_BLOCK_INVALID", "SRT block did not start with a positive numeric ID.")
        source_id = int(lines[0])
        if source_id in source_ids:
            raise AsrProviderError("V3_ASR_SRT_ID_DUPLICATE", "SRT segment ID was duplicated.")
        match = TIMESTAMP_RE.fullmatch(lines[1])
        if match is None:
            raise AsrProviderError("V3_ASR_SRT_TIMESTAMP_INVALID", "SRT timestamp line was invalid.")
        start_ms = _milliseconds(match["sh"], match["sm"], match["ss"], match["sms"])
        end_ms = _milliseconds(match["eh"], match["em"], match["es"], match["ems"])
        content = "\n".join(lines[2:]).strip() if len(lines) >= 3 else ""
        if not content:
            raise AsrProviderError("V3_ASR_TRANSCRIPT_EMPTY", "SRT segment text was empty.")
        if len(content) > max_segment_chars:
            raise AsrProviderError("V3_ASR_TRANSCRIPT_SEGMENT_TOO_LARGE", "SRT segment text exceeded the character limit.")
        total_chars += len(content)
        if total_chars > max_total_chars:
            raise AsrProviderError("V3_ASR_TRANSCRIPT_TOO_LARGE", "ASR transcript text exceeded the character limit.")
        if start_ms >= end_ms:
            raise AsrProviderError("V3_ASR_SRT_RANGE_INVALID", "SRT segment start must be before end.")
        if end_ms > audio_duration_ms:
            raise AsrProviderError("V3_ASR_SRT_OUT_OF_BOUNDS", "SRT segment exceeded the controlled audio duration.")
        if (start_ms, end_ms) in ranges:
            raise AsrProviderError("V3_ASR_SRT_RANGE_DUPLICATE", "SRT segment range was duplicated.")
        if start_ms < previous_start:
            raise AsrProviderError("V3_ASR_SRT_ORDER_INVALID", "SRT segments were not ordered by start time.")
        if start_ms < previous_end:
            raise AsrProviderError("V3_ASR_SRT_OVERLAP", "SRT segments overlapped.")
        source_ids.add(source_id)
        ranges.add((start_ms, end_ms))
        segments.append(AsrSegment(segment_id=f"srt-{source_id}", start_ms=start_ms, end_ms=end_ms, text=content))
        previous_start = start_ms
        previous_end = end_ms
    if not segments:
        raise AsrProviderError("V3_ASR_TRANSCRIPT_EMPTY", "ASR transcript contained no segments.")
    return AsrTranscriptCandidate(
        provider_id=raw.provider_id,
        model_id=raw.model_id,
        task_id=raw.task_id,
        duration_ms=audio_duration_ms,
        segments=tuple(segments),
    )
