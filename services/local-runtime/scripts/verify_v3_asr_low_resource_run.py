#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import subprocess
import wave
from pathlib import Path
from typing import Any


EXPECTED_SAMPLES = (
    ("v3-asr-comparison-01", "BV1sMNtzJE5B", "30592600559", 1),
    ("v3-asr-comparison-02", "BV1xz4y1S7yF", "286754257", 1),
    ("v3-asr-comparison-03", "BV1Bb411w741", "61744125", 1),
)
EXPECTED_TOOLS = {
    "yt-dlp": "1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6",
    "ffmpeg": "ed16af623947494a72e284b6eb8ff225f2da22b38b5d5069c2fd4b4ba3384e41",
    "ffprobe": "272f6ebc634a63d9c8b4ca68e964119d980f25154e5aa2c35e5487da48e9a58f",
}
EXPECTED_INSTALL = {
    "fsmn-vad.gguf": (1720512, "1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479"),
    "llama-funasr-paraformer": (2424840, "aec677df81ac5d8a2274342d92df1290e4bc901f4ebb74f113d3e5d95377c0c2"),
    "paraformer-q8.gguf": (236929024, "42bf76ea1575a336aaca4c1b7c01a82b79113e6d04d0d6b799561bfcf07ee011"),
}
COOKIE_NAMES = {"DedeUserID", "DedeUserID__ckMd5", "SESSDATA", "b_nut", "bili_jct", "buvid3", "buvid4", "buvid_fp", "sid"}
MEMORY_LIMIT_BYTES = 8 * 1024**3


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def mode(path: Path) -> int:
    return stat.S_IMODE(path.stat().st_mode)


def systemd_prefix(unit: str) -> list[str]:
    return [
        "/usr/bin/systemd-run", "--user", "--wait", "--pipe", "--collect", f"--unit={unit}",
        "-p", "RestrictAddressFamilies=AF_UNIX", "-p", "IPAddressDeny=any",
        "-p", "PrivateDevices=yes", "-p", "DevicePolicy=closed",
        "-p", f"MemoryMax={MEMORY_LIMIT_BYTES}", "-p", "MemorySwapMax=0",
    ]


def probe(command: list[str]) -> int:
    completed = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=15)
    return completed.returncode


def cookie_values(path: Path) -> tuple[bool, list[bytes]]:
    document = json.loads(path.read_text(encoding="utf-8"))
    rows = [row for row in document if isinstance(row, dict) and row.get("name") in COOKIE_NAMES]
    valid = (
        isinstance(document, list)
        and {row.get("name") for row in rows} == COOKIE_NAMES
        and all(str(row.get("domain", "")).lower().lstrip(".") == "bilibili.com" for row in rows)
    )
    return valid, [str(row.get("value", "")).encode("utf-8") for row in rows if len(str(row.get("value", ""))) >= 6]


def scan_public(root: Path, needles: list[bytes]) -> tuple[int, list[str]]:
    hits = []
    count = 0
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        count += 1
        data = path.read_bytes()
        if any(needle in data for needle in needles):
            hits.append(path.relative_to(root).as_posix())
    return count, hits


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    parser.add_argument("--cookie-seed", type=Path, required=True)
    args = parser.parse_args()
    run_root = args.run_root.resolve(strict=True)
    private_root = args.private_root.resolve(strict=True)
    result = json.loads((run_root / "result.json").read_text(encoding="utf-8"))
    handoff_path = private_root / "private-handoff.json"
    handoff = json.loads(handoff_path.read_text(encoding="utf-8"))
    checks: list[dict[str, Any]] = []

    def check(identifier: str, passed: bool, detail: Any) -> None:
        checks.append({"id": identifier, "passed": bool(passed), "detail": detail})

    sample_identity = tuple((row.get("sampleId"), row.get("bvid"), str(row.get("cid")), row.get("partIndex")) for row in result.get("audio", []))
    check("B05-01", sample_identity == EXPECTED_SAMPLES, sample_identity)
    tools = result.get("assets", {}).get("tools", {})
    install = result.get("assets", {}).get("install", {})
    hashes_ok = all(tools.get(name, {}).get("sha256") == digest for name, digest in EXPECTED_TOOLS.items())
    hashes_ok = hashes_ok and all((install.get(name, {}).get("byteLength"), install.get(name, {}).get("sha256")) == expected for name, expected in EXPECTED_INSTALL.items())
    check("B05-02", hashes_ok, {"tools": sorted(tools), "install": sorted(install)})
    cookies_ok, raw_values = cookie_values(args.cookie_seed.resolve(strict=True))
    check("B05-03", cookies_ok, {"cookieNameCount": len(COOKIE_NAMES), "domain": "bilibili.com"})

    audio_ok = True
    audio_details = []
    for row in result.get("audio", []):
        path = private_root / "audio" / f"{row['sampleId']}.wav"
        with wave.open(str(path), "rb") as reader:
            duration = reader.getnframes() / reader.getframerate()
            shape = (reader.getframerate(), reader.getnchannels(), reader.getsampwidth(), reader.getcomptype())
        valid = shape == (16000, 1, 2, "NONE") and abs(duration - 120.0) <= 0.05 and sha256(path) == row.get("sha256") and mode(path) == 0o600
        audio_ok = audio_ok and valid
        audio_details.append({"sampleId": row["sampleId"], "durationSeconds": duration, "mode": oct(mode(path))})
    check("B05-04", audio_ok and len(audio_details) == 3, audio_details)
    boundaries = result.get("boundaries", {})
    inference = result.get("inference", [])
    resource_shape = boundaries.get("cpuCores") == 8 and boundaries.get("memoryMaxBytes") == MEMORY_LIMIT_BYTES and boundaries.get("addressSpaceMaxBytes") == MEMORY_LIMIT_BYTES and boundaries.get("swapMaxBytes") == 0
    resource_shape = resource_shape and all(item.get("cpuAffinity") == list(range(8)) and item.get("addressSpaceLimitBytes") == MEMORY_LIMIT_BYTES for item in inference)
    check("B05-05", resource_shape, boundaries)
    network_exit = probe(systemd_prefix(f"navia-v3-asr-verify-net-{os.getpid()}") + ["/usr/bin/curl", "--max-time", "3", "-I", "https://example.com"])
    check("B05-06", network_exit != 0 and boundaries.get("networkDuringInference") == "denied_by_systemd", {"probeExitCode": network_exit})
    gpu_exit = probe(systemd_prefix(f"navia-v3-asr-verify-gpu-{os.getpid()}") + ["/bin/sh", "-c", "test ! -r /dev/dxg && test ! -r /dev/dri/renderD128"])
    check("B05-07", gpu_exit == 0 and boundaries.get("gpuDevice") == "denied_by_systemd", {"probeExitCode": gpu_exit})

    worker_ok = len(inference) == 3
    transcript_ok = True
    duration_ok = True
    handoff_samples = {row["sampleId"]: row for row in handoff.get("samples", [])}
    private_permissions = mode(private_root) == 0o700
    for row in inference:
        sample_id = row["sampleId"]
        candidate_path = private_root / "candidate" / f"{sample_id}.json"
        metrics_path = private_root / "metrics" / f"{sample_id}.json"
        candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
        segments = candidate.get("segments", [])
        worker_ok = worker_ok and candidate.get("providerId") == "funasr_edge_local" and candidate.get("modelId") == "funasr-paraformer-q8" and sha256(candidate_path) == row.get("candidateSha256")
        transcript_ok = transcript_ok and bool(segments) and len(segments) == row.get("segmentCount")
        transcript_ok = transcript_ok and all(0 <= item["startMs"] < item["endMs"] <= 120000 and (index == 0 or segments[index - 1]["endMs"] <= item["startMs"]) for index, item in enumerate(segments))
        duration_ok = duration_ok and candidate.get("durationMs") == 120000
        private_permissions = private_permissions and mode(candidate_path) == 0o600 and mode(metrics_path) == 0o600
        private_permissions = private_permissions and handoff_samples.get(sample_id, {}).get("candidateSha256") == sha256(candidate_path)
    check("B05-08", worker_ok, {"workers": len(inference)})
    check("B05-09", transcript_ok, [{"sampleId": row["sampleId"], "segments": row["segmentCount"]} for row in inference])
    check("B05-10", duration_ok, [{"sampleId": row["sampleId"], "firstStartMs": row["firstStartMs"], "lastEndMs": row["lastEndMs"]} for row in inference])
    measurements_ok = all(all(isinstance(item.get(key), (int, float)) and item.get(key) >= 0 for key in ("elapsedSeconds", "rtf", "peakRssBytes", "userSeconds", "systemSeconds")) for item in inference)
    check("B05-11", measurements_ok, [{key: item[key] for key in ("sampleId", "elapsedSeconds", "rtf", "peakRssBytes")} for item in inference])
    resource_ok = all(0 < item.get("peakRssBytes", MEMORY_LIMIT_BYTES + 1) <= MEMORY_LIMIT_BYTES for item in inference) and result.get("installedBytes", 0) <= 512 * 1024**2
    check("B05-12", resource_ok, {"installedBytes": result.get("installedBytes"), "maxPeakRssBytes": max(item["peakRssBytes"] for item in inference)})
    handoff_ok = handoff.get("runId") == result.get("runId") and sha256(handoff_path) == result.get("privateHandoffSha256") and len(handoff_samples) == 3 and private_permissions and mode(handoff_path) == 0o600
    check("B05-13", handoff_ok, {"rootMode": oct(mode(private_root)), "fileModes": "0600", "sampleCount": len(handoff_samples)})
    cleanup = result.get("cleanup", {})
    cleanup_ok = cleanup.get("cookieFileDeleted") is True and cleanup.get("sourceMediaDeleted") is True and cleanup.get("workerTaskRootsEmpty") is True
    cleanup_ok = cleanup_ok and not any(private_root.glob("credential-*")) and not any(private_root.glob("download-*")) and not any((private_root / "tasks").iterdir())
    check("B05-14", cleanup_ok, cleanup)
    _, independent_hits = scan_public(run_root, raw_values + [str(private_root).encode(), str(args.cookie_seed.resolve()).encode()])
    scan = result.get("secretScan", {})
    binary_files = [path.relative_to(run_root).as_posix() for path in run_root.rglob("*") if path.is_file() and path.suffix.lower() in {".wav", ".gguf", ".zip", ".gz", ".exe"}]
    check("B05-15", not independent_hits and not binary_files and scan.get("passed") is True, {"independentHits": independent_hits, "forbiddenBinaryFiles": binary_files})
    check("B05-16", boundaries.get("claimsQualityPassed") is False and not (run_root / "invalidated.json").exists(), {"claimsQualityPassed": boundaries.get("claimsQualityPassed")})

    output = {
        "schemaVersion": "v3-asr-low-resource-run-verification/v1",
        "runId": result.get("runId"),
        "summary": {"total": len(checks), "passed": sum(item["passed"] for item in checks), "failed": sum(not item["passed"] for item in checks)},
        "checks": checks,
    }
    output["passed"] = output["summary"]["failed"] == 0 and len(checks) == 16
    (run_root / "verification.json").write_text(json.dumps(output, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output["summary"], sort_keys=True))
    return 0 if output["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
