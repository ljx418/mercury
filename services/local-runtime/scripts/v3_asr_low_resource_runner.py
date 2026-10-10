#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


COOKIE_NAMES = {
    "DedeUserID", "DedeUserID__ckMd5", "SESSDATA", "b_nut", "bili_jct",
    "buvid3", "buvid4", "buvid_fp", "sid",
}
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
MEMORY_LIMIT_BYTES = 8 * 1024**3
WINDOW_SECONDS = 120


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: Any, *, private: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=not private, indent=2) + "\n", encoding="utf-8")
    if private:
        path.chmod(stat.S_IRUSR | stat.S_IWUSR)


def require_private_mode(path: Path, expected: int) -> None:
    observed = stat.S_IMODE(path.stat().st_mode)
    if observed != expected:
        raise PermissionError(f"V3_ASR_PRIVATE_MODE_UNENFORCEABLE:{path.name}:{oct(observed)}")


def run(command: list[str], *, timeout: int, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        command,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
        check=False,
        env=env,
    )


def load_samples(path: Path) -> list[dict[str, Any]]:
    document = json.loads(path.read_text(encoding="utf-8"))
    if document.get("window") != {"startMs": 30000, "endMs": 150000, "durationMs": 120000, "binDurationMs": 15000}:
        raise ValueError("V3_ASR_SAMPLE_WINDOW_MISMATCH")
    rows = document.get("candidates")
    observed = tuple((row.get("sampleId"), row.get("bvid"), str(row.get("cid")), row.get("partIndex")) for row in rows or [])
    if observed != EXPECTED_SAMPLES:
        raise ValueError("V3_ASR_SAMPLE_REGISTRY_MISMATCH")
    for row in rows:
        parsed = urlparse(str(row.get("url", "")))
        if parsed.scheme != "https" or parsed.hostname != "www.bilibili.com" or f"/video/{row['bvid']}" not in parsed.path:
            raise ValueError("V3_ASR_SAMPLE_URL_INVALID")
    return rows


def load_cookie_rows(path: Path) -> tuple[list[dict[str, Any]], list[bytes]]:
    parsed = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(parsed, list):
        raise ValueError("V3_ASR_COOKIE_SEED_INVALID")
    rows: list[dict[str, Any]] = []
    raw_values: list[bytes] = []
    for row in parsed:
        if not isinstance(row, dict) or row.get("name") not in COOKIE_NAMES:
            continue
        value = row.get("value")
        domain = str(row.get("domain", "")).lower().lstrip(".")
        if not isinstance(value, str) or not value or (domain != "bilibili.com" and not domain.endswith(".bilibili.com")):
            raise ValueError("V3_ASR_COOKIE_SEED_INVALID")
        rows.append(row)
        raw_values.append(value.encode("utf-8"))
    if {row["name"] for row in rows} != COOKIE_NAMES:
        raise ValueError("V3_ASR_COOKIE_REGISTRY_MISMATCH")
    return rows, raw_values


def write_cookie_file(path: Path, rows: list[dict[str, Any]]) -> None:
    lines = ["# Netscape HTTP Cookie File", "# Disposable Navia V3 qualification input"]
    for row in sorted(rows, key=lambda item: str(item["name"])):
        lines.append("\t".join([
            ".bilibili.com", "TRUE", str(row.get("path") or "/"),
            "TRUE" if row.get("secure") is True else "FALSE",
            str(int(float(row.get("expirationDate", 0) or 0))), str(row["name"]), str(row["value"]),
        ]))
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    path.chmod(stat.S_IRUSR | stat.S_IWUSR)


def validate_hashes(yt_dlp: Path, ffmpeg: Path, ffprobe: Path, install_root: Path) -> dict[str, Any]:
    tools = {"yt-dlp": yt_dlp, "ffmpeg": ffmpeg, "ffprobe": ffprobe}
    tool_facts = {name: {"sha256": sha256_file(path), "byteLength": path.stat().st_size} for name, path in tools.items()}
    if any(tool_facts[name]["sha256"] != expected for name, expected in EXPECTED_TOOLS.items()):
        raise ValueError("V3_ASR_TOOL_HASH_MISMATCH")
    install_facts = {}
    if set(path.name for path in install_root.iterdir() if path.is_file()) != set(EXPECTED_INSTALL):
        raise ValueError("V3_ASR_INSTALL_FILE_SET_MISMATCH")
    for name, (size, expected_hash) in EXPECTED_INSTALL.items():
        path = install_root / name
        facts = {"byteLength": path.stat().st_size, "sha256": sha256_file(path)}
        if facts != {"byteLength": size, "sha256": expected_hash}:
            raise ValueError("V3_ASR_INSTALL_HASH_MISMATCH")
        install_facts[name] = facts
    return {"tools": tool_facts, "install": install_facts}


def audio_facts(path: Path) -> dict[str, Any]:
    with wave.open(str(path), "rb") as reader:
        frames = reader.getnframes()
        facts = {
            "sampleRateHz": reader.getframerate(),
            "channels": reader.getnchannels(),
            "sampleWidthBytes": reader.getsampwidth(),
            "compression": reader.getcomptype(),
            "frames": frames,
            "durationSeconds": frames / reader.getframerate(),
        }
    if (
        facts["sampleRateHz"] != 16000
        or facts["channels"] != 1
        or facts["sampleWidthBytes"] != 2
        or facts["compression"] != "NONE"
        or abs(facts["durationSeconds"] - WINDOW_SECONDS) > 0.05
    ):
        raise ValueError("V3_ASR_AUDIO_SHAPE_MISMATCH")
    return {**facts, "byteLength": path.stat().st_size, "sha256": sha256_file(path)}


def systemd_prefix(unit_name: str) -> list[str]:
    return [
        "/usr/bin/systemd-run", "--user", "--wait", "--pipe", "--collect", f"--unit={unit_name}",
        "-p", "RestrictAddressFamilies=AF_UNIX", "-p", "IPAddressDeny=any",
        "-p", "PrivateDevices=yes", "-p", "DevicePolicy=closed",
        "-p", f"MemoryMax={MEMORY_LIMIT_BYTES}", "-p", "MemorySwapMax=0", "-p", "RuntimeMaxSec=1800",
    ]


def parse_metrics(path: Path) -> dict[str, Any]:
    metrics = json.loads(path.read_text(encoding="utf-8"))
    metrics["cpuPercent"] = float(str(metrics["cpuPercent"]).rstrip("%"))
    metrics["peakRssBytes"] = int(metrics.pop("maxRssKiB")) * 1024
    return metrics


def scan_public(root: Path, raw_values: list[bytes], forbidden_paths: list[Path]) -> dict[str, Any]:
    needles = [value for value in raw_values if len(value) >= 6]
    needles.extend(str(path.resolve()).encode("utf-8") for path in forbidden_paths)
    hits = []
    files = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        data = path.read_bytes()
        files.append(relative)
        for index, needle in enumerate(needles):
            if needle in data:
                hits.append({"file": relative, "needleIndex": index})
    binaries = [name for name in files if Path(name).suffix.lower() in {".wav", ".gguf", ".zip", ".gz", ".exe"}]
    return {"fileCount": len(files), "hitCount": len(hits), "hits": hits, "forbiddenBinaryFiles": binaries, "passed": not hits and not binaries}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=Path, required=True)
    parser.add_argument("--cookie-seed", type=Path, required=True)
    parser.add_argument("--yt-dlp", type=Path, required=True)
    parser.add_argument("--ffmpeg", type=Path, required=True)
    parser.add_argument("--ffprobe", type=Path, required=True)
    parser.add_argument("--install-root", type=Path, required=True)
    parser.add_argument("--worker", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    args = parser.parse_args()

    for name in ("samples", "cookie_seed", "yt_dlp", "ffmpeg", "ffprobe", "install_root", "worker", "repo_root"):
        setattr(args, name, getattr(args, name).resolve(strict=True))
    args.run_root = args.run_root.resolve()
    args.private_root = args.private_root.resolve()

    if args.run_root.exists() or args.private_root.exists():
        raise FileExistsError("V3_ASR_QUALIFICATION_RUN_ALREADY_EXISTS")
    args.run_root.mkdir(parents=True)
    args.private_root.mkdir(parents=True, mode=0o700)
    args.private_root.chmod(0o700)
    require_private_mode(args.private_root, 0o700)
    (args.private_root / "audio").mkdir(mode=0o700)
    (args.private_root / "candidate").mkdir(mode=0o700)
    (args.private_root / "metrics").mkdir(mode=0o700)
    tasks_root = args.private_root / "tasks"
    tasks_root.mkdir(mode=0o700)
    samples = load_samples(args.samples)
    rows, raw_values = load_cookie_rows(args.cookie_seed)
    asset_facts = validate_hashes(args.yt_dlp, args.ffmpeg, args.ffprobe, args.install_root)
    run_id = args.run_root.name
    audio_records = []
    inference_records = []
    credential_root = Path(tempfile.mkdtemp(prefix="credential-", dir=args.private_root))
    cookie_file = credential_root / "cookies.txt"
    write_cookie_file(cookie_file, rows)
    try:
        for sample in samples:
            sample_root = args.private_root / f"download-{sample['sampleId']}"
            sample_root.mkdir(mode=0o700)
            output_template = str(sample_root / "source.%(ext)s")
            download = run([
                str(args.yt_dlp), "--ignore-config", "--no-plugin-dirs", "--no-update", "--no-playlist",
                "--cookies", str(cookie_file), "--format", "ba/b", "--concurrent-fragments", "1",
                "--retries", "1", "--fragment-retries", "1", "--socket-timeout", "30",
                "--no-write-comments", "--no-write-info-json", "--no-write-thumbnail", "--no-write-subs",
                "--no-write-auto-subs", "--quiet", "--output", output_template, str(sample["url"]),
            ], timeout=600)
            sources = [path for path in sample_root.glob("source.*") if path.is_file() and not path.name.endswith(".part")]
            if download.returncode != 0 or len(sources) != 1:
                raise RuntimeError(f"V3_ASR_AUDIO_DOWNLOAD_FAILED:{sample['sampleId']}:{download.returncode}")
            audio_path = args.private_root / "audio" / f"{sample['sampleId']}.wav"
            trim = run([
                str(args.ffmpeg), "-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file,pipe",
                "-ss", "30", "-t", str(WINDOW_SECONDS), "-i", str(sources[0]), "-vn", "-ac", "1", "-ar", "16000",
                "-c:a", "pcm_s16le", "-y", str(audio_path),
            ], timeout=240)
            shutil.rmtree(sample_root)
            if trim.returncode != 0 or not audio_path.is_file():
                raise RuntimeError(f"V3_ASR_AUDIO_TRIM_FAILED:{sample['sampleId']}:{trim.returncode}")
            audio_path.chmod(stat.S_IRUSR | stat.S_IWUSR)
            require_private_mode(audio_path, 0o600)
            audio_records.append({"sampleId": sample["sampleId"], "bvid": sample["bvid"], "cid": str(sample["cid"]), "partIndex": sample["partIndex"], **audio_facts(audio_path)})
    finally:
        shutil.rmtree(credential_root, ignore_errors=True)

    network_probe = run(systemd_prefix(f"navia-v3-asr-net-{os.getpid()}") + [
        "/usr/bin/curl", "--max-time", "3", "-I", "https://example.com",
    ], timeout=15)
    if network_probe.returncode == 0:
        raise RuntimeError("V3_ASR_NETWORK_DENY_PROBE_FAILED")
    gpu_probe = run(systemd_prefix(f"navia-v3-asr-gpu-{os.getpid()}") + [
        "/bin/sh", "-c", "test ! -r /dev/dxg && test ! -r /dev/dri/renderD128",
    ], timeout=15)
    if gpu_probe.returncode != 0:
        raise RuntimeError("V3_ASR_GPU_DENY_PROBE_FAILED")

    worker_env = {"PATH": os.defpath}
    for name in ("XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS"):
        if value := os.environ.get(name):
            worker_env[name] = value
    for sample in samples:
        sample_id = sample["sampleId"]
        private_output = args.private_root / "candidate" / f"{sample_id}.json"
        metrics_path = args.private_root / "metrics" / f"{sample_id}.json"
        command = systemd_prefix(f"navia-v3-asr-{os.getpid()}-{sample_id[-2:]}") + [
            "/usr/bin/taskset", "-c", "0-7", "/usr/bin/prlimit", f"--as={MEMORY_LIMIT_BYTES}", "--",
            "/usr/bin/time", "-f", '{"elapsedSeconds":%e,"userSeconds":%U,"systemSeconds":%S,"cpuPercent":"%P","maxRssKiB":%M,"exitCode":%x}', "-o", str(metrics_path),
            "/usr/bin/env", f"HOME={args.private_root}", "LANG=C.UTF-8", "LC_ALL=C.UTF-8",
            f"PYTHONPATH={args.repo_root / 'services/local-runtime'}", "CUDA_VISIBLE_DEVICES=-1",
            "/usr/bin/python3", str(args.worker), "--install-root", str(args.install_root), "--tasks-root", str(tasks_root),
            "--audio", str(args.private_root / "audio" / f"{sample_id}.wav"), "--sample-id", sample_id,
            "--output", str(private_output), "--duration-ms", "120000",
        ]
        completed = run(command, timeout=1900, env=worker_env)
        if completed.returncode != 0 or not private_output.is_file() or not metrics_path.is_file():
            raise RuntimeError(f"V3_ASR_INFERENCE_FAILED:{sample_id}:{completed.returncode}")
        metrics_path.chmod(stat.S_IRUSR | stat.S_IWUSR)
        require_private_mode(metrics_path, 0o600)
        worker_result = json.loads(private_output.read_text(encoding="utf-8"))
        require_private_mode(private_output, 0o600)
        metrics = parse_metrics(metrics_path)
        segments = worker_result.get("segments", [])
        valid_segments = bool(segments) and all(
            isinstance(item.get("startMs"), int) and isinstance(item.get("endMs"), int)
            and 0 <= item["startMs"] < item["endMs"] <= 120000
            and (index == 0 or segments[index - 1]["endMs"] <= item["startMs"])
            for index, item in enumerate(segments)
        )
        boundary = worker_result.get("resourceBoundary", {})
        if not valid_segments or worker_result.get("durationMs") != 120000:
            raise RuntimeError(f"V3_ASR_TRANSCRIPT_INVALID:{sample_id}")
        if boundary.get("cpuAffinity") != list(range(8)) or boundary.get("addressSpaceLimitBytes") != MEMORY_LIMIT_BYTES or boundary.get("cudaVisibleDevices") != "-1":
            raise RuntimeError(f"V3_ASR_RESOURCE_BOUNDARY_INVALID:{sample_id}")
        if metrics.get("exitCode") != 0 or metrics["peakRssBytes"] > MEMORY_LIMIT_BYTES:
            raise RuntimeError(f"V3_ASR_RESOURCE_LIMIT_FAILED:{sample_id}")
        candidate_hash = sha256_file(private_output)
        inference_records.append({
            "sampleId": sample_id, "candidateSha256": candidate_hash, "segmentCount": len(segments),
            "characterCount": sum(len(item["text"]) for item in segments),
            "firstStartMs": segments[0]["startMs"], "lastEndMs": segments[-1]["endMs"],
            "providerElapsedSeconds": worker_result["providerElapsedSeconds"],
            "elapsedSeconds": metrics["elapsedSeconds"], "rtf": metrics["elapsedSeconds"] / WINDOW_SECONDS,
            "userSeconds": metrics["userSeconds"], "systemSeconds": metrics["systemSeconds"],
            "cpuPercent": metrics["cpuPercent"], "peakRssBytes": metrics["peakRssBytes"],
            "cpuAffinity": boundary["cpuAffinity"], "addressSpaceLimitBytes": boundary["addressSpaceLimitBytes"],
        })

    if any(tasks_root.iterdir()):
        raise RuntimeError("V3_ASR_TASK_CLEANUP_FAILED")
    install_bytes = sum(item[0] for item in EXPECTED_INSTALL.values())
    handoff = {
        "schemaVersion": "v3-asr-qualification-private-handoff/v1", "runId": run_id,
        "candidateId": "funasr-paraformer-q8-cpu-v1", "window": {"startMs": 30000, "endMs": 150000, "durationMs": 120000, "binDurationMs": 15000},
        "samples": [
            {
                "sampleId": row["sampleId"], "bvid": row["bvid"], "cid": row["cid"], "partIndex": row["partIndex"],
                "audioFile": f"audio/{row['sampleId']}.wav", "audioSha256": row["sha256"],
                "candidateFile": f"candidate/{row['sampleId']}.json",
                "candidateSha256": next(item["candidateSha256"] for item in inference_records if item["sampleId"] == row["sampleId"]),
            }
            for row in audio_records
        ],
    }
    handoff_path = args.private_root / "private-handoff.json"
    write_json(handoff_path, handoff, private=True)
    require_private_mode(handoff_path, 0o600)
    handoff_hash = sha256_file(handoff_path)
    public = {
        "schemaVersion": "v3-asr-low-resource-qualification-run/v1", "runId": run_id,
        "boundaries": {"cpuCores": 8, "memoryMaxBytes": MEMORY_LIMIT_BYTES, "addressSpaceMaxBytes": MEMORY_LIMIT_BYTES, "swapMaxBytes": 0, "networkDuringInference": "denied_by_systemd", "gpuDevice": "denied_by_systemd", "claimsQualityPassed": False},
        "assets": asset_facts, "audio": audio_records, "inference": inference_records,
        "installedBytes": install_bytes, "privateHandoffSha256": handoff_hash,
        "cleanup": {"cookieFileDeleted": not cookie_file.exists(), "sourceMediaDeleted": not any(args.private_root.glob("download-*")), "workerTaskRootsEmpty": not any(tasks_root.iterdir()), "privateAudioRetainedFor0b6": True},
    }
    write_json(args.run_root / "result.json", public)
    scan = scan_public(args.run_root, raw_values, [args.private_root, args.cookie_seed, args.install_root])
    public["secretScan"] = scan
    public["passed"] = scan["passed"] and len(inference_records) == 3 and all(item["peakRssBytes"] <= MEMORY_LIMIT_BYTES for item in inference_records)
    write_json(args.run_root / "result.json", public)
    if not public["passed"]:
        raise RuntimeError("V3_ASR_PUBLIC_EVIDENCE_SCAN_FAILED")
    print(json.dumps({"runId": run_id, "samples": len(inference_records), "passed": True}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
