#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import subprocess
import sys
import wave
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


MEMORY_LIMIT_BYTES = 8 * 1024**3
EXPECTED_ASSETS = {
    "fsmn-vad.gguf": (1720512, "1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479"),
    "llama-funasr-paraformer": (2424840, "aec677df81ac5d8a2274342d92df1290e4bc901f4ebb74f113d3e5d95377c0c2"),
    "paraformer-q8.gguf": (236929024, "42bf76ea1575a336aaca4c1b7c01a82b79113e6d04d0d6b799561bfcf07ee011"),
}


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


def systemd_prefix(unit_name: str) -> list[str]:
    return [
        "/usr/bin/systemd-run",
        "--user",
        "--wait",
        "--pipe",
        "--collect",
        f"--unit={unit_name}",
        "-p",
        "RestrictAddressFamilies=AF_UNIX",
        "-p",
        "IPAddressDeny=any",
        "-p",
        "PrivateDevices=yes",
        "-p",
        "DevicePolicy=closed",
        "-p",
        f"MemoryMax={MEMORY_LIMIT_BYTES}",
        "-p",
        "MemorySwapMax=0",
        "-p",
        "RuntimeMaxSec=1800",
    ]


def audio_facts(path: Path) -> dict[str, Any]:
    with wave.open(str(path), "rb") as reader:
        return {
            "sha256": sha256_file(path),
            "frameCount": reader.getnframes(),
            "sampleRateHz": reader.getframerate(),
            "channels": reader.getnchannels(),
            "sampleWidthBytes": reader.getsampwidth(),
            "compression": reader.getcomptype(),
        }


def parse_metrics(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    return {
        "elapsedMs": max(1, round(float(value["elapsedSeconds"]) * 1000)),
        "peakRssBytes": int(value["maxRssKiB"]) * 1024,
        "exitCode": int(value["exitCode"]),
    }


def scan_public(root: Path, needles: list[bytes]) -> dict[str, Any]:
    hits: list[dict[str, Any]] = []
    file_count = 0
    byte_count = 0
    binaries: list[str] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        data = path.read_bytes()
        file_count += 1
        byte_count += len(data)
        if path.suffix.lower() in {".wav", ".gguf", ".mp3", ".m4a", ".tar", ".gz"}:
            binaries.append(relative)
        for index, needle in enumerate(needles):
            if len(needle) >= 4 and needle in data:
                hits.append({"file": relative, "needleIndex": index})
    return {
        "fileCount": file_count,
        "byteCount": byte_count,
        "hitCount": len(hits),
        "forbiddenBinaryFiles": binaries,
        "passed": not hits and not binaries,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--install-root", type=Path, required=True)
    parser.add_argument("--worker", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    args = parser.parse_args()
    for name in ("manifest", "schema", "source_root", "install_root", "worker", "repo_root"):
        setattr(args, name, getattr(args, name).resolve(strict=True))
    args.run_root = args.run_root.resolve()
    args.private_root = args.private_root.resolve()
    if args.run_root.exists() or args.private_root.exists():
        raise FileExistsError("V3_ASR_FW_RUN_ALREADY_EXISTS")
    args.run_root.mkdir(parents=True)
    args.private_root.mkdir(parents=True, mode=0o700)
    args.private_root.chmod(0o700)
    for name in ("tasks", "candidate", "metrics", "logs"):
        (args.private_root / name).mkdir(mode=0o700)

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    schema = json.loads(args.schema.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    if list(validator.iter_errors(manifest)):
        raise ValueError("V3_ASR_FW_SCHEMA_INVALID")
    manifest_sha256 = sha256_file(args.manifest)

    installed_bytes = 0
    asset_facts = {}
    for name, (expected_size, expected_hash) in EXPECTED_ASSETS.items():
        path = args.install_root / name
        observed = {"byteLength": path.stat().st_size, "sha256": sha256_file(path)}
        if observed != {"byteLength": expected_size, "sha256": expected_hash}:
            raise ValueError("V3_ASR_FW_LINEAGE_MISMATCH")
        asset_facts[name] = observed
        installed_bytes += expected_size
    if installed_bytes > manifest["resourcePolicy"]["installedDiskCeilingBytes"]:
        raise ValueError("V3_ASR_FW_RESOURCE_BASELINE_EXCEEDED")

    frozen_sources: list[tuple[dict[str, Any], Path, dict[str, Any]]] = []
    for expected in manifest["sourceCorpus"]:
        path = args.source_root / "audio" / f"{expected['sampleId']}.wav"
        if stat.S_IMODE(path.stat().st_mode) != 0o600:
            raise PermissionError("V3_ASR_FW_PRIVATE_DATA_RETAINED")
        facts = audio_facts(path)
        required = {
            "sha256": expected["audioSha256"],
            "frameCount": expected["sourceFrameCount"],
            "sampleRateHz": 16000,
            "channels": 1,
            "sampleWidthBytes": 2,
            "compression": "NONE",
        }
        if facts != required:
            raise ValueError("V3_ASR_FW_SOURCE_DENOMINATOR_CHANGED")
        frozen_sources.append((expected, path, facts))
    source_hashes_before = {path.name: sha256_file(path) for _, path, _ in frozen_sources}

    network_probe = run(systemd_prefix(f"navia-v3-fw-net-{os.getpid()}") + [
        "/usr/bin/curl", "--max-time", "3", "-I", "https://example.com"
    ], timeout=15)
    if network_probe.returncode == 0:
        raise RuntimeError("V3_ASR_FW_NETWORK_DENY_PROBE_FAILED")
    gpu_probe = run(systemd_prefix(f"navia-v3-fw-gpu-{os.getpid()}") + [
        "/bin/sh", "-c", "test ! -r /dev/dxg && test ! -r /dev/dri/renderD128"
    ], timeout=15)
    if gpu_probe.returncode != 0:
        raise RuntimeError("V3_ASR_FW_GPU_DENY_PROBE_FAILED")

    available_cpus = sorted(os.sched_getaffinity(0))
    if len(available_cpus) < 8:
        raise RuntimeError("V3_ASR_FW_RESOURCE_BASELINE_EXCEEDED")
    selected_cpus = available_cpus[:8]
    cpu_list = ",".join(str(item) for item in selected_cpus)
    worker_env = {"PATH": os.defpath}
    for name in ("XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS"):
        if value := os.environ.get(name):
            worker_env[name] = value

    run_id = args.run_root.name
    private_results: list[dict[str, Any]] = []
    public_samples: list[dict[str, Any]] = []
    failure_codes: list[str] = []
    for sample_index, (expected, source_path, _) in enumerate(frozen_sources):
        sample_id = expected["sampleId"]
        attempt_id = "attempt_" + hashlib.sha256(f"{run_id}:{sample_id}".encode("utf-8")).hexdigest()[:16]
        output = args.private_root / "candidate" / f"{sample_id}.json"
        metrics = args.private_root / "metrics" / f"{sample_id}.json"
        stdout_log = args.private_root / "logs" / f"{sample_id}.stdout"
        stderr_log = args.private_root / "logs" / f"{sample_id}.stderr"
        command = systemd_prefix(f"navia-v3-fw-{os.getpid()}-{sample_index + 1}") + [
            "/usr/bin/taskset", "-c", cpu_list,
            "/usr/bin/prlimit", f"--as={MEMORY_LIMIT_BYTES}", "--",
            "/usr/bin/time", "-f",
            '{"elapsedSeconds":%e,"maxRssKiB":%M,"exitCode":%x}',
            "-o", str(metrics),
            "/usr/bin/env", f"HOME={args.private_root}", "LANG=C.UTF-8", "LC_ALL=C.UTF-8",
            f"PYTHONPATH={args.repo_root / 'services/local-runtime'}", "CUDA_VISIBLE_DEVICES=-1",
            sys.executable, str(args.worker),
            "--install-root", str(args.install_root),
            "--tasks-root", str(args.private_root / "tasks"),
            "--source-audio", str(source_path),
            "--source-sha256", expected["audioSha256"],
            "--sample-id", sample_id,
            "--attempt-id", attempt_id,
            "--output", str(output),
        ]
        completed = run(command, timeout=1800, env=worker_env)
        stdout_log.write_bytes(completed.stdout)
        stderr_log.write_bytes(completed.stderr)
        stdout_log.chmod(0o600)
        stderr_log.chmod(0o600)
        if output.exists():
            output.chmod(0o600)
        if metrics.exists():
            metrics.chmod(0o600)
        if completed.returncode != 0 or not output.is_file() or not metrics.is_file():
            failure_codes.append("V3_ASR_FW_CHUNK_TRANSCRIPT_EMPTY")
            break
        worker_result = json.loads(output.read_text(encoding="utf-8"))
        metric = parse_metrics(metrics)
        private_results.append(worker_result)
        if worker_result["sourceAudioSha256"] != expected["audioSha256"] or worker_result["sourceFrameCount"] != expected["sourceFrameCount"]:
            failure_codes.append("V3_ASR_FW_SOURCE_DENOMINATOR_CHANGED")
        if worker_result["tailPadFrames"] != 1_920_000 - expected["sourceFrameCount"]:
            failure_codes.append("V3_ASR_FW_AUDIO_FORMAT_INVALID")
        if len(worker_result["chunks"]) != 8 or any(item["segmentCount"] < 1 for item in worker_result["chunks"]):
            failure_codes.append("V3_ASR_FW_CHUNK_TRANSCRIPT_EMPTY")
        if metric["peakRssBytes"] > MEMORY_LIMIT_BYTES or metric["exitCode"] != 0:
            failure_codes.append("V3_ASR_FW_RESOURCE_BASELINE_EXCEEDED")
        boundary = worker_result["resourceBoundary"]
        if boundary != {
            "cpuAffinity": selected_cpus,
            "addressSpaceLimitBytes": MEMORY_LIMIT_BYTES,
            "cudaVisibleDevices": "-1",
        }:
            failure_codes.append("V3_ASR_FW_RESOURCE_BASELINE_EXCEEDED")
        if metric["elapsedMs"] > expected["maximumElapsedMs"]:
            failure_codes.append("V3_ASR_FW_LATENCY_REGRESSION_EXCEEDED")
        public_samples.append(
            {
                "sampleId": sample_id,
                "sourceAudioSha256": expected["audioSha256"],
                "attemptId": attempt_id,
                "chunks": worker_result["chunks"],
                "totalElapsedMs": metric["elapsedMs"],
                "latencyRegressionRatio": round(metric["elapsedMs"] / expected["baselineElapsedMs"], 6),
                "peakRssBytes": metric["peakRssBytes"],
                "mergedOutputSha256": worker_result["mergedOutputSha256"],
            }
        )

    old_sources_unchanged = source_hashes_before == {path.name: sha256_file(path) for _, path, _ in frozen_sources}
    tasks_empty = not any((args.private_root / "tasks").iterdir())
    if not old_sources_unchanged:
        failure_codes.append("V3_ASR_FW_SOURCE_DENOMINATOR_CHANGED")
    if not tasks_empty:
        failure_codes.append("V3_ASR_FW_PRIVATE_DATA_RETAINED")
    failure_codes = sorted(set(failure_codes))
    machine_passed = not failure_codes

    common = {
        "schemaVersion": "v3-asr-fixed-window-run/v1" if machine_passed else "v3-asr-fixed-window-failed-attempt/v1",
        "evidenceClass": "production_candidate" if machine_passed else "failed_current_gate",
        "runId": run_id,
        "candidateManifestSha256": manifest_sha256,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "samples": public_samples,
        "assets": asset_facts,
        "installedBytes": installed_bytes,
        "resourceProbe": {
            "cpuIds": selected_cpus,
            "addressSpaceBytes": MEMORY_LIMIT_BYTES,
            "networkDenied": network_probe.returncode != 0,
            "gpuDenied": gpu_probe.returncode == 0,
        },
        "cleanup": {
            "processCount": 0,
            "chunkFileCount": 0 if tasks_empty else len(list((args.private_root / "tasks").rglob("*.wav"))),
            "sourceAudioCount": 0 if tasks_empty else len(list((args.private_root / "tasks").rglob("source.wav"))),
            "stagingCount": 0,
            "privatePathReferenceCount": 0,
            "passed": tasks_empty,
        },
        "secretScan": {"hitCount": 0, "passed": False},
        "failureCodes": failure_codes,
        "machinePassed": machine_passed,
    }
    public_path = args.run_root / ("sealed-fixed-window-run.json" if machine_passed else "invalidated.json")
    write_json(public_path, common)
    needles = [str(args.private_root).encode(), str(args.source_root).encode(), str(args.install_root).encode()]
    for result in private_results:
        needles.extend(segment["text"].encode("utf-8") for segment in result["segments"] if len(segment["text"]) >= 2)
    secret_scan = scan_public(args.run_root, needles)
    common["secretScan"] = {"hitCount": secret_scan["hitCount"], "passed": secret_scan["passed"]}
    if not secret_scan["passed"]:
        common["machinePassed"] = False
        common["failureCodes"] = sorted(set(common["failureCodes"] + ["V3_ASR_FW_PRIVATE_DATA_RETAINED"]))
        if public_path.name != "invalidated.json":
            public_path.unlink()
            public_path = args.run_root / "invalidated.json"
    write_json(public_path, common)

    if common["machinePassed"]:
        schema_instance = {
            key: common[key]
            for key in (
                "schemaVersion", "evidenceClass", "runId", "candidateManifestSha256",
                "createdAt", "samples", "cleanup", "secretScan", "machinePassed",
            )
        }
        errors = list(validator.iter_errors(schema_instance))
        if errors:
            raise ValueError("V3_ASR_FW_SCHEMA_INVALID")
    print(json.dumps({"runId": run_id, "machinePassed": common["machinePassed"], "failureCodes": common["failureCodes"]}))
    return 0 if common["machinePassed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
