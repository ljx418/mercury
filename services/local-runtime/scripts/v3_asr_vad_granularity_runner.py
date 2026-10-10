#!/usr/bin/env python3
"""Re-run the accepted V3 ASR audio with the production 15-second VAD cap."""

from __future__ import annotations

import argparse
from array import array
import hashlib
import json
import math
from pathlib import Path
import shutil
import stat
import subprocess
import sys
from typing import Any
import wave


SOURCE_RUN = "v3-2-0b-5-20260922T063133Z"
SOURCE_HANDOFF_SHA = "726dae961e4bd75cb23a71c3d911138fc26b460adf246e0253d6f4359cb66c14"
EXPECTED = (
    ("v3-asr-comparison-01", "BV1sMNtzJE5B", "30592600559", 1, "2a11e09975733740d49f4a63ca7b3ec1a9ebc77e8e8897d770e1991d4c1beb05"),
    ("v3-asr-comparison-02", "BV1xz4y1S7yF", "286754257", 1, "63eb48d9027e1cfa09747d7261f9e2b7347cbec58daeb38b4aff09cdbd647405"),
    ("v3-asr-comparison-03", "BV1Bb411w741", "61744125", 1, "f4f61c09f8fe19828fb2085ef18459179d5142596b8107cef82df6c7bf7cc97b"),
)
INSTALL = {
    "fsmn-vad.gguf": (1720512, "1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479"),
    "llama-funasr-paraformer": (2424840, "aec677df81ac5d8a2274342d92df1290e4bc901f4ebb74f113d3e5d95377c0c2"),
    "paraformer-q8.gguf": (236929024, "42bf76ea1575a336aaca4c1b7c01a82b79113e6d04d0d6b799561bfcf07ee011"),
}
MEMORY_BYTES = 8 * 1024**3


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("V3_ASR_OBJECT_REQUIRED")
    return value


def write_json(path: Path, value: Any, private: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if private:
        path.chmod(stat.S_IRUSR | stat.S_IWUSR)


def systemd_prefix(unit: str) -> list[str]:
    return [
        "/usr/bin/systemd-run", "--user", "--wait", "--pipe", "--collect", f"--unit={unit}",
        "-p", "RestrictAddressFamilies=AF_UNIX", "-p", "IPAddressDeny=any",
        "-p", "PrivateDevices=yes", "-p", "DevicePolicy=closed",
        "-p", f"MemoryMax={MEMORY_BYTES}", "-p", "MemorySwapMax=0", "-p", "RuntimeMaxSec=1800",
    ]


def run(command: list[str], timeout: int) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=timeout)


def time_metrics(path: Path) -> dict[str, Any]:
    lines = path.read_text(encoding="utf-8").splitlines()
    def value(prefix: str) -> str:
        return next(line.strip()[len(prefix):].strip() for line in lines if line.strip().startswith(prefix))
    return {
        "peakRssBytes": int(value("Maximum resident set size (kbytes):")) * 1024,
        "cpuPercent": value("Percent of CPU this job got:"),
        "elapsed": value("Elapsed (wall clock) time (h:mm:ss or m:ss):"),
    }


def validate_segments(rows: Any) -> tuple[int, list[int], list[int]]:
    if not isinstance(rows, list) or not rows:
        raise ValueError("V3_ASR_15S_TRANSCRIPT_EMPTY")
    bins = [0] * 8
    characters = [0] * 8
    previous_end = 0
    maximum = 0
    for row in rows:
        start, end = row.get("startMs"), row.get("endMs")
        if not isinstance(start, int) or not isinstance(end, int) or start < previous_end or end <= start or end > 120_000:
            raise ValueError("V3_ASR_15S_SEGMENT_INVALID")
        duration = end - start
        if duration > 15_000:
            raise ValueError(f"V3_ASR_15S_SEGMENT_TOO_LONG:{duration}")
        midpoint = (start + end) / 2
        index = min(7, int(midpoint // 15_000))
        bins[index] += 1
        text = row.get("text")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("V3_ASR_15S_TEXT_INVALID")
        characters[index] += len(text.strip())
        previous_end = end
        maximum = max(maximum, duration)
    return maximum, bins, characters


def pcm16_rms_bins(path: Path) -> list[int]:
    with wave.open(str(path), "rb") as stream:
        if stream.getnchannels() != 1 or stream.getsampwidth() != 2 or stream.getframerate() != 16_000:
            raise ValueError("V3_ASR_15S_AUDIO_FORMAT_INVALID")
        values = []
        for _ in range(8):
            samples = array("h")
            samples.frombytes(stream.readframes(15 * 16_000))
            if sys.byteorder != "little":
                samples.byteswap()
            if not samples:
                raise ValueError("V3_ASR_15S_AUDIO_BIN_EMPTY")
            values.append(math.isqrt(sum(sample * sample for sample in samples) // len(samples)))
        return values


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-run-root", type=Path, required=True)
    parser.add_argument("--source-private-root", type=Path, required=True)
    parser.add_argument("--install-root", type=Path, required=True)
    parser.add_argument("--worker", type=Path, required=True)
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    args = parser.parse_args()
    for name in ("source_run_root", "source_private_root", "install_root", "worker"):
        setattr(args, name, getattr(args, name).resolve(strict=True))
    args.run_root = args.run_root.resolve()
    args.private_root = args.private_root.resolve()
    if args.run_root.exists() or args.private_root.exists():
        raise FileExistsError("V3_ASR_15S_RUN_EXISTS")
    if args.source_run_root.name != SOURCE_RUN or (args.source_run_root / "invalidated.json").exists():
        raise ValueError("V3_ASR_15S_SOURCE_INVALID")
    handoff_path = args.source_private_root / "private-handoff.json"
    if sha256_file(handoff_path) != SOURCE_HANDOFF_SHA:
        raise ValueError("V3_ASR_15S_HANDOFF_MISMATCH")
    handoff = load(handoff_path)
    if tuple((row["sampleId"], row["bvid"], str(row["cid"]), row["partIndex"], row["audioSha256"]) for row in handoff["samples"]) != EXPECTED:
        raise ValueError("V3_ASR_15S_SAMPLE_MISMATCH")
    if set(path.name for path in args.install_root.iterdir() if path.is_file()) != set(INSTALL):
        raise ValueError("V3_ASR_15S_INSTALL_SET_MISMATCH")
    for name, (size, digest) in INSTALL.items():
        path = args.install_root / name
        if path.stat().st_size != size or sha256_file(path) != digest:
            raise ValueError(f"V3_ASR_15S_INSTALL_HASH_MISMATCH:{name}")

    args.run_root.mkdir(parents=True)
    args.private_root.mkdir(parents=True, mode=0o700)
    args.private_root.chmod(0o700)
    for name in ("audio", "candidate", "metrics", "tasks"):
        (args.private_root / name).mkdir(mode=0o700)
    run_id = args.run_root.name
    network = run(systemd_prefix(f"{run_id}-network") + [sys.executable, "-c", "import socket,sys\ntry: socket.socket(socket.AF_INET,socket.SOCK_STREAM);sys.exit(9)\nexcept OSError: sys.exit(0)"], 60)
    device = run(systemd_prefix(f"{run_id}-device") + ["/bin/sh", "-c", "test ! -e /dev/dxg && test ! -e /dev/dri"], 60)
    if network.returncode or device.returncode:
        raise RuntimeError("V3_ASR_15S_ISOLATION_FAILED")

    records = []
    private_samples = []
    empty_bins = []
    for ordinal, (source, expected) in enumerate(zip(handoff["samples"], EXPECTED), start=1):
        sample_id = source["sampleId"]
        source_audio = args.source_private_root / source["audioFile"]
        if sha256_file(source_audio) != expected[4]:
            raise ValueError(f"V3_ASR_15S_AUDIO_HASH_MISMATCH:{sample_id}")
        audio = args.private_root / "audio" / f"{sample_id}.wav"
        shutil.copyfile(source_audio, audio)
        audio.chmod(0o600)
        output = args.private_root / "candidate" / f"{sample_id}.json"
        metrics = args.private_root / "metrics" / f"{sample_id}.txt"
        command = systemd_prefix(f"{run_id}-candidate-{ordinal}") + [
            "/usr/bin/env", f"HOME={args.private_root}", "LANG=C.UTF-8", "LC_ALL=C.UTF-8",
            f"PYTHONPATH={args.worker.resolve().parents[1]}", "CUDA_VISIBLE_DEVICES=-1",
            "/usr/bin/taskset", "-c", "0-7", "/usr/bin/prlimit", f"--as={MEMORY_BYTES}", "--",
            "/usr/bin/time", "-v", "-o", str(metrics), "/usr/bin/python3", str(args.worker),
            "--install-root", str(args.install_root), "--tasks-root", str(args.private_root / "tasks"),
            "--audio", str(audio), "--sample-id", sample_id, "--output", str(output),
        ]
        completed = run(command, 1800)
        if completed.returncode:
            raise RuntimeError(f"V3_ASR_15S_INFERENCE_FAILED:{sample_id}:{completed.returncode}:{completed.stderr.decode(errors='replace')[-800:]}")
        output.chmod(0o600)
        metrics.chmod(0o600)
        document = load(output)
        maximum, bins, characters = validate_segments(document["segments"])
        rms = pcm16_rms_bins(audio)
        resources = time_metrics(metrics)
        if resources["peakRssBytes"] > MEMORY_BYTES:
            raise RuntimeError(f"V3_ASR_15S_RSS_EXCEEDED:{sample_id}")
        candidate_sha = sha256_file(output)
        records.append({
            "sampleId": sample_id,
            "audioSha256": sha256_file(audio),
            "candidateSha256": candidate_sha,
            "segmentCount": len(document["segments"]),
            "maxSegmentDurationMs": maximum,
            "binSegmentCounts": bins,
            "binCharacterCounts": characters,
            "binPcm16Rms": rms,
            "resources": resources,
        })
        empty_bins.extend(
            {"sampleId": sample_id, "binIndex": index, "pcm16Rms": rms[index]}
            for index, count in enumerate(bins)
            if count == 0
        )
        private_samples.append({
            "sampleId": sample_id, "bvid": source["bvid"], "cid": str(source["cid"]), "partIndex": source["partIndex"],
            "audioFile": f"audio/{sample_id}.wav", "audioSha256": sha256_file(audio),
            "candidateFile": f"candidate/{sample_id}.json", "candidateSha256": candidate_sha,
        })

    if any((args.private_root / "tasks").iterdir()):
        raise RuntimeError("V3_ASR_15S_TASK_CLEANUP_FAILED")
    if empty_bins:
        diagnostic = {
            "schemaVersion": "v3-asr-vad-granularity-failure/v1",
            "runId": run_id,
            "sourceRunId": SOURCE_RUN,
            "sourceHandoffSha256": SOURCE_HANDOFF_SHA,
            "failureCode": "V3_ASR_QUAL_REAL_SPEECH_BIN_OMITTED",
            "vadMaxSegmentMs": 15_000,
            "samples": records,
            "emptyBins": empty_bins,
            "cleanup": {"tasksEmpty": True, "sourceAudioUnchanged": True, "cookieUsed": False},
            "humanReviewStatus": "not_started",
            "claimsQualityPassed": False,
            "passed": False,
        }
        diagnostic_path = args.run_root / "failure-diagnostic.json"
        write_json(diagnostic_path, diagnostic)
        invalidated = {
            "schemaVersion": "v3-asr-run-invalidation/v1",
            "runId": run_id,
            "status": "invalidated",
            "failureCode": diagnostic["failureCode"],
            "diagnosticSha256": sha256_file(diagnostic_path),
            "reason": "A non-silent fixed 15-second review bin has no candidate transcript output.",
            "humanReviewAllowed": False,
            "mayEnterV3_2_0b_6": False,
        }
        write_json(args.run_root / "invalidated.json", invalidated)
        print(json.dumps({"runId": run_id, "failureCode": diagnostic["failureCode"], "emptyBins": empty_bins, "passed": False}, indent=2))
        return 2
    private_handoff = {
        "schemaVersion": "v3-asr-qualification-private-handoff/v2",
        "runId": run_id,
        "sourceRunId": SOURCE_RUN,
        "candidateId": "funasr-paraformer-q8-cpu-v1",
        "vadMaxSegmentMs": 15000,
        "window": {"startMs": 30000, "endMs": 150000, "durationMs": 120000, "binDurationMs": 15000},
        "samples": private_samples,
    }
    handoff_output = args.private_root / "private-handoff.json"
    write_json(handoff_output, private_handoff, private=True)
    result = {
        "schemaVersion": "v3-asr-vad-granularity-run/v1",
        "runId": run_id,
        "sourceRunId": SOURCE_RUN,
        "sourceHandoffSha256": SOURCE_HANDOFF_SHA,
        "vadMaxSegmentMs": 15000,
        "isolation": {"cpuCores": 8, "memoryMaxBytes": MEMORY_BYTES, "swapMaxBytes": 0, "networkAfInetDenied": True, "gpuDevicesHidden": True},
        "install": {name: {"byteLength": size, "sha256": digest} for name, (size, digest) in INSTALL.items()},
        "samples": records,
        "privateHandoffSha256": sha256_file(handoff_output),
        "cleanup": {"tasksEmpty": True, "sourceAudioUnchanged": True, "cookieUsed": False},
        "humanReviewStatus": "pending",
        "claimsQualityPassed": False,
        "passed": True,
    }
    write_json(args.run_root / "result.json", result)
    print(json.dumps({"runId": run_id, "samples": records, "privateHandoffSha256": result["privateHandoffSha256"], "passed": True}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
