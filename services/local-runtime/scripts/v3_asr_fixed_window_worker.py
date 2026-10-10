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

from navia_runtime.modules.media_companion.asr import (
    FixedWindowAsrOrchestrator,
    FunAsrLlamaCppProviderAdapter,
    TaskAudioRef,
)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--install-root", type=Path, required=True)
    parser.add_argument("--tasks-root", type=Path, required=True)
    parser.add_argument("--source-audio", type=Path, required=True)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument("--sample-id", required=True)
    parser.add_argument("--attempt-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--timeout-per-chunk", type=float, default=180.0)
    args = parser.parse_args()

    install_root = args.install_root.resolve(strict=True)
    tasks_root = args.tasks_root.resolve(strict=True)
    source_audio = args.source_audio.resolve(strict=True)
    output = args.output.resolve()
    source_task_id = f"source-{args.attempt_id.removeprefix('attempt_')}"
    source_task_root = tasks_root / source_task_id
    if source_task_root.exists():
        raise FileExistsError("V3_ASR_FW_PARTIAL_REUSE_FORBIDDEN")
    source_task_root.mkdir(mode=0o700)
    source_task_root.chmod(0o700)
    task_audio = source_task_root / "source.wav"
    shutil.copyfile(source_audio, task_audio)
    task_audio.chmod(0o600)
    if sha256_file(task_audio) != args.source_sha256:
        raise ValueError("V3_ASR_FW_SOURCE_DENOMINATOR_CHANGED")

    provider = FunAsrLlamaCppProviderAdapter(install_root, tasks_root)
    try:
        provider.load()
        result = FixedWindowAsrOrchestrator(tasks_root, provider).transcribe(
            TaskAudioRef(task_id=source_task_id, relative_path="source.wav"),
            expected_source_sha256=args.source_sha256,
            attempt_id=args.attempt_id,
            timeout_per_chunk=args.timeout_per_chunk,
        )
        segments = [
            {
                "segmentId": item.segment_id,
                "startMs": item.start_ms,
                "endMs": item.end_ms,
                "text": item.text,
            }
            for item in result.transcript.segments
        ]
        merged_hash = hashlib.sha256(
            json.dumps(segments, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        output_value = {
            "schemaVersion": "v3-asr-fixed-window-private-worker-result/v1",
            "sampleId": args.sample_id,
            "sourceAudioSha256": result.source_audio_sha256,
            "sourceFrameCount": result.source_frame_count,
            "tailPadFrames": result.tail_pad_frames,
            "attemptId": result.attempt_id,
            "elapsedMs": result.elapsed_ms,
            "chunks": [
                {
                    "chunkIndex": item.chunk_index,
                    "startMs": item.start_ms,
                    "endMs": item.end_ms,
                    "chunkSha256": item.chunk_sha256,
                    "segmentCount": item.segment_count,
                    "outputTextSha256": item.output_text_sha256,
                    "elapsedMs": item.elapsed_ms,
                }
                for item in result.chunks
            ],
            "mergedOutputSha256": merged_hash,
            "segments": segments,
            "resourceBoundary": {
                "cpuAffinity": sorted(os.sched_getaffinity(0)),
                "addressSpaceLimitBytes": resource.getrlimit(resource.RLIMIT_AS)[0],
                "cudaVisibleDevices": os.environ.get("CUDA_VISIBLE_DEVICES"),
            },
        }
        output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        output.write_text(json.dumps(output_value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        output.chmod(stat.S_IRUSR | stat.S_IWUSR)
        print(json.dumps({"sampleId": args.sample_id, "chunkCount": len(result.chunks), "segmentCount": len(segments)}))
        return 0
    finally:
        provider.close()
        if source_task_root.exists():
            shutil.rmtree(source_task_root)


if __name__ == "__main__":
    raise SystemExit(main())
