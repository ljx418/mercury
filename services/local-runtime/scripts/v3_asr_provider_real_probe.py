#!/usr/bin/env python3
"""Run the private real-binary probe for V3-2-0b-1 and emit public-safe JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import subprocess
import sys
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navia_runtime.modules.media_companion.asr import FunAsrLlamaCppProviderAdapter, TaskAudioRef


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--install-root", type=Path, required=True)
    parser.add_argument("--tasks-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.install_root = args.install_root.resolve(strict=True)
    args.tasks_root = args.tasks_root.resolve()
    binary = args.install_root / "llama-funasr-paraformer"
    model = args.install_root / "paraformer-q8.gguf"
    vad = args.install_root / "fsmn-vad.gguf"

    usage = subprocess.run(
        [str(binary), "--help"],
        cwd=args.install_root,
        env={"HOME": str(args.tasks_root), "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "PATH": os.defpath},
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )
    usage_text = usage.stdout + usage.stderr
    markers = ["-m paraformer.gguf", "-a audio.wav", "--vad fsmn-vad.gguf", "--srt"]

    symbols = subprocess.run(
        ["readelf", "-Ws", str(binary)],
        capture_output=True,
        text=True,
        timeout=10,
        check=True,
    ).stdout.lower()
    network_symbols = [name for name in (" socket", " connect", "getaddrinfo", " curl", "http") if name in symbols]

    task_id = "real-provider-self-test"
    audio = args.tasks_root / task_id / "audio.wav"
    audio.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(audio), "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(16000)
        frames = bytearray()
        for index in range(16000):
            sample = int(1600 * math.sin(2 * math.pi * 440 * index / 16000))
            frames.extend(sample.to_bytes(2, "little", signed=True))
        writer.writeframes(frames)

    adapter = FunAsrLlamaCppProviderAdapter(args.install_root, args.tasks_root)
    adapter.load()
    transcript = adapter.self_test(TaskAudioRef(task_id, "audio.wav"))
    adapter.close()
    result = {
        "schemaVersion": "v3-asr-provider-real-probe/v1",
        "assets": {
            "runtime": {"bytes": binary.stat().st_size, "sha256": sha256_file(binary)},
            "model": {"bytes": model.stat().st_size, "sha256": sha256_file(model)},
            "vad": {"bytes": vad.stat().st_size, "sha256": sha256_file(vad)},
        },
        "usageProbe": {
            "exitCode": usage.returncode,
            "markers": {marker: marker in usage_text for marker in markers},
            "networkSymbols": network_symbols,
            "passed": usage.returncode == 1 and all(marker in usage_text for marker in markers) and not network_symbols,
        },
        "selfTest": {
            "providerId": transcript.provider_id,
            "modelId": transcript.model_id,
            "format": transcript.format,
            "elapsedSeconds": round(transcript.elapsed_seconds, 3),
            "outputBytes": len(transcript.text.encode("utf-8")),
            "taskCleaned": not (args.tasks_root / task_id).exists(),
            "passed": transcript.provider_id == "funasr_edge_local" and transcript.format == "srt" and not (args.tasks_root / task_id).exists(),
        },
    }
    result["passed"] = result["usageProbe"]["passed"] and result["selfTest"]["passed"]
    args.output.write_text(json.dumps(result, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": result["passed"], "usageExit": usage.returncode, "selfTestSeconds": result["selfTest"]["elapsedSeconds"]}, sort_keys=True))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
