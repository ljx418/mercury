#!/usr/bin/env python3
"""Install the frozen SenseVoice baseline and transcribe one real private audio window."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navia_runtime.modules.media_companion.asr.catalog import ASR_MODEL_BY_ID, V3_BASELINE_ASR_MODEL_ID
from navia_runtime.modules.media_companion.asr.funasr_llamacpp import FunAsrLlamaCppProviderAdapter
from navia_runtime.modules.media_companion.asr.model_manager import AsrModelManager
from navia_runtime.modules.media_companion.asr.provider import TaskAudioRef
from navia_runtime.modules.media_companion.asr.srt_normalizer import normalize_srt


SOURCE_SHA256 = "f4f61c09f8fe19828fb2085ef18459179d5142596b8107cef82df6c7bf7cc97b"
CHUNK_INDEX = 4
CHUNK_FRAMES = 240_000
CHUNK_PAYLOAD_SHA256 = "6271ffeeb1f1f1d144bcc0402027c7abc5acf67b1b72c49064094511360c090b"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-root", type=Path, required=True)
    parser.add_argument("--source-audio", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.state_root = args.state_root.resolve()
    args.source_audio = args.source_audio.resolve(strict=True)
    args.output = args.output.resolve()
    if args.state_root.exists():
        shutil.rmtree(args.state_root)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    descriptor = ASR_MODEL_BY_ID[V3_BASELINE_ASR_MODEL_ID]
    if sha256_file(args.source_audio) != SOURCE_SHA256 or args.source_audio.stat().st_mode & 0o077:
        raise RuntimeError("private source audio identity or mode mismatch")

    manager = AsrModelManager(args.state_root)
    uninstalled_selection_code = None
    try:
        manager.patch_settings({"requestedModelId": descriptor.model_id})
    except Exception as exc:
        uninstalled_selection_code = getattr(exc, "code", type(exc).__name__)

    job = manager.start_install(descriptor.model_id, asynchronous=False)
    installed_root = manager.model_path(descriptor.model_id)
    if installed_root is None:
        raise RuntimeError("SenseVoice baseline was not published")
    selection = manager.patch_settings({"requestedModelId": descriptor.model_id})
    restarted = AsrModelManager(args.state_root)
    restart_selection = restarted.settings()

    task_id = "real-bilibili-sample03-chunk4"
    task_root = args.state_root / "acceptance-tasks"
    task_audio = task_root / task_id / "audio.wav"
    task_audio.parent.mkdir(parents=True, mode=0o700)
    with wave.open(str(args.source_audio), "rb") as source:
        if (source.getnchannels(), source.getsampwidth(), source.getframerate()) != (1, 2, 16000):
            raise RuntimeError("private source audio format mismatch")
        source.setpos(CHUNK_INDEX * CHUNK_FRAMES)
        payload = source.readframes(CHUNK_FRAMES)
    if len(payload) != CHUNK_FRAMES * 2 or hashlib.sha256(payload).hexdigest() != CHUNK_PAYLOAD_SHA256:
        raise RuntimeError("private source chunk identity mismatch")
    with wave.open(str(task_audio), "wb") as target:
        target.setparams((1, 2, 16000, CHUNK_FRAMES, "NONE", "not compressed"))
        target.writeframes(payload)
    task_audio.chmod(0o600)

    adapter = FunAsrLlamaCppProviderAdapter(installed_root, task_root, model_id=descriptor.model_id)
    adapter.load()
    raw = adapter.transcribe(TaskAudioRef(task_id, "audio.wav"), timeout=120)
    adapter.close()
    normalized = normalize_srt(raw, audio_duration_ms=15_000)
    transcript_text = "\n".join(segment.text for segment in normalized.segments)

    published = []
    for expected in descriptor.files:
        path = installed_root / expected.published_path
        published.append({
            "path": expected.published_path,
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
            "executable": os.access(path, os.X_OK) if expected.executable else False,
        })
    result = {
        "schemaVersion": "v3-asr-sensevoice-baseline-run/v1",
        "modelId": descriptor.model_id,
        "qualityStatus": descriptor.quality_status,
        "uninstalledSelectionFailureCode": uninstalled_selection_code,
        "installation": {
            key: job[key]
            for key in ("state", "source", "bytesCompleted", "bytesTotal", "percent", "failureCode", "history")
        },
        "selection": selection,
        "restartSelection": restart_selection,
        "published": published,
        "realAudio": {
            "sourceKind": "private_real_bilibili_audio",
            "window": {"startMs": 60_000, "endMs": 75_000},
            "wavSha256": hashlib.sha256(payload).hexdigest(),
            "segmentCount": len(normalized.segments),
            "nonEmpty": bool(transcript_text.strip()),
            "timestampsValid": all(0 <= item.start_ms < item.end_ms <= 15_000 for item in normalized.segments),
            "elapsedMs": round(raw.elapsed_seconds * 1000),
            "transcriptSha256": hashlib.sha256(transcript_text.encode("utf-8")).hexdigest(),
        },
        "privacy": {
            "publicTranscriptIncluded": False,
            "publicAudioIncluded": False,
            "taskDirectoryRemoved": not (task_root / task_id).exists(),
        },
        "v4Deferred": ["cross_model_degradation_detection", "automatic_quality_fallback"],
    }
    result["passed"] = (
        uninstalled_selection_code == "V3_ASR_MODEL_NOT_READY"
        and job["state"] == "ready"
        and job["bytesCompleted"] == job["bytesTotal"]
        and selection["requestedModelId"] == descriptor.model_id
        and selection["effectiveModelId"] == descriptor.model_id
        and not selection["fallbackActive"]
        and restart_selection["effectiveModelId"] == descriptor.model_id
        and len(published) == len(descriptor.files)
        and all(
            actual["bytes"] == expected.published_byte_length
            and actual["sha256"] == expected.published_sha256
            and (not expected.executable or actual["executable"])
            for actual, expected in zip(published, descriptor.files, strict=True)
        )
        and result["realAudio"]["nonEmpty"]
        and result["realAudio"]["timestampsValid"]
        and result["privacy"]["taskDirectoryRemoved"]
    )
    args.output.write_text(json.dumps(result, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "passed": result["passed"],
        "jobState": job["state"],
        "effectiveModelId": selection["effectiveModelId"],
        "segmentCount": result["realAudio"]["segmentCount"],
        "elapsedMs": result["realAudio"]["elapsedMs"],
    }, sort_keys=True))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
