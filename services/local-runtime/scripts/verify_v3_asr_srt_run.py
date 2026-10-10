#!/usr/bin/env python3
"""Recompute B03-01..B03-12 for the strict SRT normalizer."""

from __future__ import annotations

import argparse
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navia_runtime.modules.media_companion.asr import AsrProviderError, RawAsrTranscript, normalize_srt


def raw(text: str, format: str = "srt") -> RawAsrTranscript:
    return RawAsrTranscript("funasr_edge_local", "funasr-paraformer-q8", "audit-task", format, text, 1.0)


def fails(value: str, duration: int, code: str, **limits) -> bool:
    try:
        normalize_srt(raw(value), audio_duration_ms=duration, **limits)
    except AsrProviderError as exc:
        return exc.code == code
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--junit", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = ET.parse(args.junit).getroot()
    suites = [root] if root.tag == "testsuite" else list(root.findall("testsuite"))
    totals = {key: sum(int(suite.get(key, "0")) for suite in suites) for key in ("tests", "failures", "errors")}
    checks: list[dict] = []

    def add(check_id: str, passed: bool, detail: str) -> None:
        checks.append({"id": check_id, "passed": bool(passed), "detail": detail})

    standard = normalize_srt(raw("1\n00:00:00,000 --> 00:00:01,000\nA\n\n2\n00:00:01,000 --> 00:00:02,000\nB"), audio_duration_ms=2000)
    add("B03-01", [(x.start_ms, x.end_ms, x.text) for x in standard.segments] == [(0, 1000, "A"), (1000, 2000, "B")], "standard mapping")
    multiline = normalize_srt(raw("\ufeff1\r\n00:00:00,000 --> 00:00:01,000\r\nline one\r\nline two"), audio_duration_ms=1000)
    add("B03-02", multiline.segments[0].text == "line one\nline two", "BOM/CRLF/multiline")
    add("B03-03", fails("", 1000, "V3_ASR_TRANSCRIPT_EMPTY") and fails("1\n00:00:00,000 --> 00:00:01,000\n", 1000, "V3_ASR_TRANSCRIPT_EMPTY"), "empty transcript/segment")
    add("B03-04", fails("1\n00:00:AA,000 --> 00:00:01,000\nx", 1000, "V3_ASR_SRT_TIMESTAMP_INVALID"), "bad timestamp")
    add("B03-05", fails("1\n00:00:01,000 --> 00:00:01,000\nx", 2000, "V3_ASR_SRT_RANGE_INVALID"), "invalid range")
    add("B03-06", fails("1\n00:00:01,000 --> 00:00:02,000\na\n\n2\n00:00:00,000 --> 00:00:01,000\nb", 3000, "V3_ASR_SRT_ORDER_INVALID"), "reverse order")
    add("B03-07", fails("1\n00:00:00,000 --> 00:00:01,500\na\n\n2\n00:00:01,000 --> 00:00:02,000\nb", 3000, "V3_ASR_SRT_OVERLAP"), "overlap")
    add("B03-08", fails("1\n00:00:00,000 --> 00:00:01,001\nx", 1000, "V3_ASR_SRT_OUT_OF_BOUNDS"), "out of bounds")
    add("B03-09", fails("1\n00:00:00,000 --> 00:00:01,000\na\n\n1\n00:00:01,000 --> 00:00:02,000\nb", 3000, "V3_ASR_SRT_ID_DUPLICATE") and fails("1\n00:00:00,000 --> 00:00:01,000\na\n\n2\n00:00:00,000 --> 00:00:01,000\nb", 3000, "V3_ASR_SRT_RANGE_DUPLICATE"), "duplicate id/range")
    add("B03-10", fails("progress\n1\n00:00:00,000 --> 00:00:01,000\nx", 1000, "V3_ASR_SRT_BLOCK_INVALID") and fails("1\n00:00:00,000 --> 00:00:01,000\nx\x00", 1000, "V3_ASR_TRANSCRIPT_CONTROL_CHARACTER"), "diagnostic/control")
    valid = "1\n00:00:00,000 --> 00:00:01,000\ntext"
    add("B03-11", fails(valid, 1000, "V3_ASR_TRANSCRIPT_TOO_LARGE", max_input_bytes=1) and fails(valid, 1000, "V3_ASR_TRANSCRIPT_TOO_MANY_SEGMENTS", max_segments=0) and fails(valid, 1000, "V3_ASR_TRANSCRIPT_SEGMENT_TOO_LARGE", max_segment_chars=1), "all size limits")
    add("B03-12", totals["failures"] == 0 and totals["errors"] == 0 and totals["tests"] >= 51, json.dumps(totals, sort_keys=True))
    result = {"schemaVersion": "v3-asr-srt-acceptance/v1", "checks": checks, "summary": {"total": len(checks), "passed": sum(x["passed"] for x in checks), "failed": sum(not x["passed"] for x in checks)}}
    result["passed"] = result["summary"] == {"total": 12, "passed": 12, "failed": 0}
    args.output.write_text(json.dumps(result, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": result["passed"], "summary": result["summary"]}, sort_keys=True))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
