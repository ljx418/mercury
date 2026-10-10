from __future__ import annotations

import pytest

from navia_runtime.modules.media_companion.asr import AsrProviderError, RawAsrTranscript, normalize_srt


def raw(text: str, *, format: str = "srt") -> RawAsrTranscript:
    return RawAsrTranscript("funasr_edge_local", "funasr-paraformer-q8", "task-1", format, text, 1.0)


def test_normalizes_standard_srt_without_rewriting_text():
    result = normalize_srt(
        raw("1\n00:00:00,000 --> 00:00:01,250\n第一段\n\n2\n00:00:01,250 --> 00:00:02,500\nSecond line"),
        audio_duration_ms=3000,
    )
    assert [(item.segment_id, item.start_ms, item.end_ms, item.text) for item in result.segments] == [
        ("srt-1", 0, 1250, "第一段"),
        ("srt-2", 1250, 2500, "Second line"),
    ]


def test_normalizes_bom_crlf_and_multiline_content():
    result = normalize_srt(raw("\ufeff1\r\n00:00:00,100 --> 00:00:00,900\r\nline one\r\nline two\r\n"), audio_duration_ms=1000)
    assert result.segments[0].text == "line one\nline two"
    assert result.duration_ms == 1000


@pytest.mark.parametrize("value", ("", " \n\n ", "1\n00:00:00,000 --> 00:00:01,000\n"))
def test_rejects_empty_transcript_or_segment(value: str):
    with pytest.raises(AsrProviderError) as raised:
        normalize_srt(raw(value), audio_duration_ms=1000)
    assert raised.value.code == "V3_ASR_TRANSCRIPT_EMPTY"


@pytest.mark.parametrize(
    ("value", "duration", "code"),
    (
        ("1\n00:00:AA,000 --> 00:00:01,000\ntext", 2000, "V3_ASR_SRT_TIMESTAMP_INVALID"),
        ("1\n00:00:01,000 --> 00:00:01,000\ntext", 2000, "V3_ASR_SRT_RANGE_INVALID"),
        ("1\n00:00:01,500 --> 00:00:02,000\na\n\n2\n00:00:00,000 --> 00:00:01,000\nb", 3000, "V3_ASR_SRT_ORDER_INVALID"),
        ("1\n00:00:00,000 --> 00:00:01,500\na\n\n2\n00:00:01,000 --> 00:00:02,000\nb", 3000, "V3_ASR_SRT_OVERLAP"),
        ("1\n00:00:00,000 --> 00:00:02,001\ntext", 2000, "V3_ASR_SRT_OUT_OF_BOUNDS"),
        ("1\n00:00:00,000 --> 00:00:01,000\na\n\n1\n00:00:01,000 --> 00:00:02,000\nb", 3000, "V3_ASR_SRT_ID_DUPLICATE"),
        ("1\n00:00:00,000 --> 00:00:01,000\na\n\n2\n00:00:00,000 --> 00:00:01,000\nb", 3000, "V3_ASR_SRT_RANGE_DUPLICATE"),
    ),
)
def test_rejects_timestamp_faults(value: str, duration: int, code: str):
    with pytest.raises(AsrProviderError) as raised:
        normalize_srt(raw(value), audio_duration_ms=duration)
    assert raised.value.code == code


def test_rejects_diagnostics_control_characters_and_non_srt():
    for value, expected in (
        ("progress: loading\n1\n00:00:00,000 --> 00:00:01,000\ntext", "V3_ASR_SRT_BLOCK_INVALID"),
        ("1\n00:00:00,000 --> 00:00:01,000\ntext\x00", "V3_ASR_TRANSCRIPT_CONTROL_CHARACTER"),
    ):
        with pytest.raises(AsrProviderError) as raised:
            normalize_srt(raw(value), audio_duration_ms=1000)
        assert raised.value.code == expected
    with pytest.raises(AsrProviderError) as format_error:
        normalize_srt(raw("plain", format="text"), audio_duration_ms=1000)
    assert format_error.value.code == "V3_ASR_TRANSCRIPT_FORMAT_UNSUPPORTED"


def test_rejects_all_configured_size_limits():
    valid = raw("1\n00:00:00,000 --> 00:00:01,000\ntext")
    with pytest.raises(AsrProviderError) as bytes_error:
        normalize_srt(valid, audio_duration_ms=1000, max_input_bytes=1)
    assert bytes_error.value.code == "V3_ASR_TRANSCRIPT_TOO_LARGE"
    with pytest.raises(AsrProviderError) as count_error:
        normalize_srt(valid, audio_duration_ms=1000, max_segments=0)
    assert count_error.value.code == "V3_ASR_TRANSCRIPT_TOO_MANY_SEGMENTS"
    with pytest.raises(AsrProviderError) as segment_error:
        normalize_srt(valid, audio_duration_ms=1000, max_segment_chars=1)
    assert segment_error.value.code == "V3_ASR_TRANSCRIPT_SEGMENT_TOO_LARGE"
    with pytest.raises(AsrProviderError) as total_error:
        normalize_srt(valid, audio_duration_ms=1000, max_total_chars=1)
    assert total_error.value.code == "V3_ASR_TRANSCRIPT_TOO_LARGE"
