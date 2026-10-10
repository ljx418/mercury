#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import resource
import shutil
import stat
from pathlib import Path

from navia_runtime.modules.media_companion.asr.funasr_llamacpp import FunAsrLlamaCppProviderAdapter
from navia_runtime.modules.media_companion.asr.provider import TaskAudioRef
from navia_runtime.modules.media_companion.asr.srt_normalizer import normalize_srt


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--install-root", type=Path, required=True)
    parser.add_argument("--tasks-root", type=Path, required=True)
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--sample-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--duration-ms", type=int, default=120000)
    args = parser.parse_args()

    task_id = f"qualification-{args.sample_id}"
    task_root = args.tasks_root / task_id
    task_root.mkdir(parents=True, exist_ok=False, mode=0o700)
    task_audio = task_root / "window.wav"
    shutil.copyfile(args.audio, task_audio)
    task_audio.chmod(stat.S_IRUSR | stat.S_IWUSR)
    provider = FunAsrLlamaCppProviderAdapter(args.install_root, args.tasks_root)
    try:
        provider.load()
        raw = provider.transcribe(TaskAudioRef(task_id, "window.wav"), timeout=1800.0)
        candidate = normalize_srt(raw, audio_duration_ms=args.duration_ms)
        output = {
            "schemaVersion": "v3-asr-qualification-worker-result/v1",
            "sampleId": args.sample_id,
            "providerId": candidate.provider_id,
            "modelId": candidate.model_id,
            "taskId": candidate.task_id,
            "durationMs": candidate.duration_ms,
            "providerElapsedSeconds": raw.elapsed_seconds,
            "rawSrtSha256": sha256_bytes(raw.text.encode("utf-8")),
            "rawSrtByteLength": len(raw.text.encode("utf-8")),
            "segments": [
                {"segmentId": item.segment_id, "startMs": item.start_ms, "endMs": item.end_ms, "text": item.text}
                for item in candidate.segments
            ],
            "resourceBoundary": {
                "cpuAffinity": sorted(os.sched_getaffinity(0)),
                "addressSpaceLimitBytes": resource.getrlimit(resource.RLIMIT_AS)[0],
                "cudaVisibleDevices": os.environ.get("CUDA_VISIBLE_DEVICES"),
            },
        }
        args.output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        args.output.chmod(stat.S_IRUSR | stat.S_IWUSR)
        print(json.dumps({"sampleId": args.sample_id, "segments": len(candidate.segments), "durationMs": candidate.duration_ms}))
        return 0
    finally:
        provider.close()
        if task_root.exists():
            shutil.rmtree(task_root)


if __name__ == "__main__":
    raise SystemExit(main())
