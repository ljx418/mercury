#!/usr/bin/env python3
"""Run the frozen Faster-Whisper Small baseline for one V3 qualification sample."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import stat

from faster_whisper import WhisperModel


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample-id", required=True)
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--model-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    audio = args.audio.resolve(strict=True)
    model_root = args.model_root.resolve(strict=True)
    output = args.output.resolve()
    if output.exists():
        raise FileExistsError("V3_ASR_BASELINE_OUTPUT_ALREADY_EXISTS")
    if os.environ.get("CUDA_VISIBLE_DEVICES") != "-1":
        raise RuntimeError("V3_ASR_BASELINE_GPU_POLICY_MISSING")
    if os.environ.get("HF_HUB_OFFLINE") != "1":
        raise RuntimeError("V3_ASR_BASELINE_OFFLINE_POLICY_MISSING")

    model = WhisperModel(
        str(model_root),
        device="cpu",
        compute_type="int8",
        cpu_threads=8,
        num_workers=1,
        local_files_only=True,
    )
    iterator, info = model.transcribe(
        str(audio),
        beam_size=1,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        condition_on_previous_text=False,
    )
    segments = []
    for index, segment in enumerate(iterator, start=1):
        text = segment.text.strip()
        if not text:
            continue
        start_ms = int(round(float(segment.start) * 1000))
        end_ms = int(round(float(segment.end) * 1000))
        if start_ms < 0 or start_ms >= 120_000 or end_ms <= start_ms:
            raise RuntimeError("V3_ASR_BASELINE_SEGMENT_OUT_OF_RANGE")
        end_ms = min(end_ms, 120_000)
        segments.append({
            "segmentId": f"small-{index:03d}",
            "startMs": start_ms,
            "endMs": end_ms,
            "text": text,
            "textSha256": sha256_text(text),
            "avgLogprob": round(float(segment.avg_logprob), 6),
        })
    if not segments:
        raise RuntimeError("V3_ASR_BASELINE_EMPTY")
    for previous, current in zip(segments, segments[1:]):
        if current["startMs"] < previous["startMs"]:
            raise RuntimeError("V3_ASR_BASELINE_NON_MONOTONIC")

    payload = {
        "schemaVersion": "v3-asr-small-baseline-worker-result/v1",
        "sampleId": args.sample_id,
        "decodeProfile": "cpu-int8-beam1-vad500-no-context-v1",
        "language": info.language,
        "languageProbability": round(float(info.language_probability), 6),
        "segments": segments,
        "resourceBoundary": {
            "cpuAffinity": sorted(os.sched_getaffinity(0)),
            "addressSpaceLimitBytes": 8 * 1024**3,
            "cudaVisibleDevices": os.environ["CUDA_VISIBLE_DEVICES"],
            "hubOffline": True,
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    output.chmod(stat.S_IRUSR | stat.S_IWUSR)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
