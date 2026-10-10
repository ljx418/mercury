#!/usr/bin/env python3
"""Build a blinded Paraformer-vs-Small review bundle from the accepted 0b-5 run."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import stat
import subprocess
import sys
from typing import Any


EXPECTED_SOURCE_RUN = "v3-2-0b-5-20260922T063133Z"
EXPECTED_HANDOFF_SHA256 = "726dae961e4bd75cb23a71c3d911138fc26b460adf246e0253d6f4359cb66c14"
EXPECTED_SAMPLES = (
    ("v3-asr-comparison-01", "BV1sMNtzJE5B", "30592600559", 1),
    ("v3-asr-comparison-02", "BV1xz4y1S7yF", "286754257", 1),
    ("v3-asr-comparison-03", "BV1Bb411w741", "61744125", 1),
)
MODEL_FILES = ("config.json", "model.bin", "tokenizer.json", "vocabulary.txt")
WINDOW_START_MS = 30_000
WINDOW_END_MS = 150_000
BIN_MS = 15_000
MEMORY_BYTES = 8 * 1024**3
REVIEW_DENY = (
    b"funasr", b"paraformer", b"faster-whisper", b"production_small",
    b"funasr_edge_local", b"funasr-paraformer", b"labelMap", b"candidateSide",
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"V3_ASR_JSON_OBJECT_REQUIRED:{path.name}")
    return value


def write_json(path: Path, value: Any, *, private: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if private:
        path.chmod(stat.S_IRUSR | stat.S_IWUSR)


def require_mode(path: Path, expected: int) -> None:
    observed = stat.S_IMODE(path.stat().st_mode)
    if observed != expected:
        raise PermissionError(f"V3_ASR_PRIVATE_MODE_MISMATCH:{path.name}:{oct(observed)}")


def validate_model(model_root: Path, manifest_path: Path) -> dict[str, Any]:
    manifest = load_json(manifest_path)
    expected = manifest.get("production")
    if not isinstance(expected, dict) or expected.get("modelId") != "production_small":
        raise ValueError("V3_ASR_SMALL_MANIFEST_MISSING")
    rows = []
    for name in MODEL_FILES:
        path = model_root / name
        rows.append({"path": name, "byteLength": path.stat().st_size, "sha256": sha256_file(path)})
    if rows != expected.get("files"):
        raise ValueError("V3_ASR_SMALL_MODEL_HASH_MISMATCH")
    material = "".join(f"{row['path']}\t{row['byteLength']}\t{row['sha256']}\n" for row in rows)
    if sha256_bytes(material.encode()) != expected.get("fileSetSha256"):
        raise ValueError("V3_ASR_SMALL_FILE_SET_MISMATCH")
    return {
        "modelId": expected["modelId"],
        "revision": expected["revision"],
        "fileSetSha256": expected["fileSetSha256"],
        "files": rows,
    }


def systemd_prefix(unit_name: str) -> list[str]:
    return [
        "/usr/bin/systemd-run", "--user", "--wait", "--pipe", "--collect", f"--unit={unit_name}",
        "-p", "RestrictAddressFamilies=AF_UNIX", "-p", "IPAddressDeny=any",
        "-p", "PrivateDevices=yes", "-p", "DevicePolicy=closed",
        "-p", f"MemoryMax={MEMORY_BYTES}", "-p", "MemorySwapMax=0", "-p", "RuntimeMaxSec=1800",
    ]


def run(command: list[str], timeout: int) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=timeout)


def run_isolation_probes(run_id: str) -> dict[str, Any]:
    network = run(systemd_prefix(f"{run_id}-network-probe") + [
        sys.executable, "-c",
        "import socket,sys\ntry: socket.socket(socket.AF_INET,socket.SOCK_STREAM);sys.exit(9)\nexcept OSError: sys.exit(0)",
    ], 60)
    device = run(systemd_prefix(f"{run_id}-device-probe") + [
        "/bin/sh", "-c", "test ! -e /dev/dxg && test ! -e /dev/dri",
    ], 60)
    if network.returncode != 0 or device.returncode != 0:
        raise RuntimeError(f"V3_ASR_ISOLATION_PROBE_FAILED:{network.returncode}:{device.returncode}")
    return {"networkAfInetDenied": True, "gpuDevicesHidden": True}


def validate_segments(document: dict[str, Any], expected_sample_id: str) -> list[dict[str, Any]]:
    if document.get("sampleId") != expected_sample_id:
        raise ValueError("V3_ASR_TRANSCRIPT_SAMPLE_MISMATCH")
    rows = document.get("segments")
    if not isinstance(rows, list) or not rows:
        raise ValueError("V3_ASR_TRANSCRIPT_EMPTY")
    previous_start = -1
    for row in rows:
        start = row.get("startMs")
        end = row.get("endMs")
        if not isinstance(start, int) or not isinstance(end, int) or start < previous_start or start < 0 or end <= start or end > 120_000:
            raise ValueError("V3_ASR_TRANSCRIPT_SEGMENT_INVALID")
        if not isinstance(row.get("text"), str) or not row["text"].strip():
            raise ValueError("V3_ASR_TRANSCRIPT_TEXT_INVALID")
        previous_start = start
    return rows


def bin_output(segments: list[dict[str, Any]], index: int) -> dict[str, Any]:
    start = index * BIN_MS
    end = start + BIN_MS
    selected = [row for row in segments if start <= (row["startMs"] + row["endMs"]) / 2 < end]
    text = " ".join(row["text"].strip() for row in selected).strip()
    return {"text": text, "textSha256": sha256_bytes(text.encode("utf-8")), "segmentIds": [row["segmentId"] for row in selected]}


def parse_time_metrics(path: Path) -> dict[str, Any]:
    rows = path.read_text(encoding="utf-8").splitlines()

    def value_for(prefix: str) -> str:
        for line in rows:
            normalized = line.strip()
            if normalized.startswith(prefix):
                return normalized[len(prefix):].strip()
        raise ValueError(f"V3_ASR_TIME_METRIC_MISSING:{prefix}")

    return {
        "maximumResidentSetKiB": int(value_for("Maximum resident set size (kbytes):")),
        "cpuPercent": value_for("Percent of CPU this job got:"),
        "elapsed": value_for("Elapsed (wall clock) time (h:mm:ss or m:ss):"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-run-root", type=Path, required=True)
    parser.add_argument("--source-private-root", type=Path, required=True)
    parser.add_argument("--small-model-root", type=Path, required=True)
    parser.add_argument("--model-manifest", type=Path, required=True)
    parser.add_argument("--worker", type=Path, required=True)
    parser.add_argument("--html-template", type=Path, required=True)
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    args = parser.parse_args()

    for name in ("source_run_root", "source_private_root", "small_model_root", "model_manifest", "worker", "html_template"):
        setattr(args, name, getattr(args, name).resolve(strict=True))
    args.run_root = args.run_root.resolve()
    args.private_root = args.private_root.resolve()
    if args.run_root.exists() or args.private_root.exists():
        raise FileExistsError("V3_ASR_BLIND_RUN_ALREADY_EXISTS")
    if args.source_run_root.name != EXPECTED_SOURCE_RUN or (args.source_run_root / "invalidated.json").exists():
        raise ValueError("V3_ASR_SOURCE_RUN_NOT_ACCEPTED")

    source_result = load_json(args.source_run_root / "result.json")
    source_handoff_path = args.source_private_root / "private-handoff.json"
    if sha256_file(source_handoff_path) != EXPECTED_HANDOFF_SHA256 or source_result.get("privateHandoffSha256") != EXPECTED_HANDOFF_SHA256:
        raise ValueError("V3_ASR_SOURCE_HANDOFF_HASH_MISMATCH")
    require_mode(args.source_private_root, 0o700)
    handoff = load_json(source_handoff_path)
    observed_samples = tuple((row.get("sampleId"), row.get("bvid"), str(row.get("cid")), row.get("partIndex")) for row in handoff.get("samples", []))
    if observed_samples != EXPECTED_SAMPLES:
        raise ValueError("V3_ASR_SOURCE_SAMPLE_SET_MISMATCH")
    model_facts = validate_model(args.small_model_root, args.model_manifest)

    args.run_root.mkdir(parents=True)
    args.private_root.mkdir(parents=True, mode=0o700)
    args.private_root.chmod(0o700)
    require_mode(args.private_root, 0o700)
    baseline_root = args.private_root / "baseline"
    metrics_root = args.private_root / "metrics"
    baseline_root.mkdir(mode=0o700)
    metrics_root.mkdir(mode=0o700)
    run_id = args.run_root.name
    probes = run_isolation_probes(run_id)
    baseline_records = []
    source_rows = []

    for index, row in enumerate(handoff["samples"], start=1):
        sample_id = row["sampleId"]
        audio = args.source_private_root / row["audioFile"]
        candidate = args.source_private_root / row["candidateFile"]
        require_mode(audio, 0o600)
        require_mode(candidate, 0o600)
        if sha256_file(audio) != row["audioSha256"] or sha256_file(candidate) != row["candidateSha256"]:
            raise ValueError(f"V3_ASR_SOURCE_BYTES_MISMATCH:{sample_id}")
        candidate_document = load_json(candidate)
        candidate_segments = validate_segments(candidate_document, sample_id)
        output = baseline_root / f"{sample_id}.json"
        metrics = metrics_root / f"{sample_id}.txt"
        command = systemd_prefix(f"{run_id}-small-{index}") + [
            "/usr/bin/env", "CUDA_VISIBLE_DEVICES=-1", "HF_HUB_OFFLINE=1", "TRANSFORMERS_OFFLINE=1",
            "/usr/bin/taskset", "-c", "0-7", "/usr/bin/prlimit", f"--as={MEMORY_BYTES}", "--",
            "/usr/bin/time", "-v", "-o", str(metrics), sys.executable, str(args.worker),
            "--sample-id", sample_id, "--audio", str(audio), "--model-root", str(args.small_model_root), "--output", str(output),
        ]
        completed = run(command, 1800)
        if completed.returncode != 0:
            raise RuntimeError(f"V3_ASR_SMALL_INFERENCE_FAILED:{sample_id}:{completed.returncode}:{completed.stderr.decode(errors='replace')[-800:]}")
        output.chmod(0o600)
        metrics.chmod(0o600)
        require_mode(output, 0o600)
        baseline_document = load_json(output)
        baseline_segments = validate_segments(baseline_document, sample_id)
        resources = parse_time_metrics(metrics)
        if resources["maximumResidentSetKiB"] * 1024 > MEMORY_BYTES:
            raise RuntimeError(f"V3_ASR_SMALL_RSS_EXCEEDED:{sample_id}")
        baseline_records.append({
            "sampleId": sample_id,
            "outputSha256": sha256_file(output),
            "segmentCount": len(baseline_segments),
            "characterCount": sum(len(item["text"]) for item in baseline_segments),
            "resources": resources,
        })
        source_rows.append({"source": row, "candidate": candidate_segments, "baseline": baseline_segments})

    seed = secrets.token_bytes(32)
    candidate_sides = {}
    for row in source_rows:
        sample_id = row["source"]["sampleId"]
        candidate_sides[sample_id] = "side_a" if hashlib.sha256(seed + sample_id.encode()).digest()[0] % 2 == 0 else "side_b"
    if len(set(candidate_sides.values())) == 1:
        last = EXPECTED_SAMPLES[-1][0]
        candidate_sides[last] = "side_b" if candidate_sides[last] == "side_a" else "side_a"

    samples = []
    for ordinal, row in enumerate(source_rows, start=1):
        source = row["source"]
        bins = []
        for bin_index in range(8):
            candidate_output = bin_output(row["candidate"], bin_index)
            baseline_output = bin_output(row["baseline"], bin_index)
            side_a, side_b = (candidate_output, baseline_output) if candidate_sides[source["sampleId"]] == "side_a" else (baseline_output, candidate_output)
            absolute_start = WINDOW_START_MS + bin_index * BIN_MS
            bins.append({
                "binIndex": bin_index,
                "relativeStartMs": bin_index * BIN_MS,
                "relativeEndMs": (bin_index + 1) * BIN_MS,
                "absoluteStartMs": absolute_start,
                "absoluteEndMs": absolute_start + BIN_MS,
                "deepLink": f"https://www.bilibili.com/video/{source['bvid']}?p={source['partIndex']}&t={absolute_start // 1000}",
                "sideA": side_a,
                "sideB": side_b,
            })
        samples.append({
            "sampleId": source["sampleId"],
            "displayName": f"真实样本 {ordinal}",
            "bvid": source["bvid"],
            "cid": str(source["cid"]),
            "partIndex": source["partIndex"],
            "audioSha256": source["audioSha256"],
            "bins": bins,
        })

    bundle = {
        "schemaVersion": "v3-asr-provider-qualification-blind-bundle/v1",
        "runId": run_id,
        "sourceRunId": EXPECTED_SOURCE_RUN,
        "window": {"startMs": WINDOW_START_MS, "endMs": WINDOW_END_MS, "binDurationMs": BIN_MS, "binsPerSample": 8},
        "samples": samples,
    }
    bundle_path = args.run_root / "blind-comparison-bundle.json"
    write_json(bundle_path, bundle)
    bundle_sha256 = sha256_file(bundle_path)
    label_map = {
        "schemaVersion": "v3-asr-provider-qualification-label-map/v1",
        "runId": run_id,
        "bundleSha256": bundle_sha256,
        "seedSha256": sha256_bytes(seed),
        "samples": [{"sampleId": sample_id, "candidateSide": candidate_sides[sample_id]} for sample_id, *_ in EXPECTED_SAMPLES],
    }
    label_map_path = args.private_root / "label-map.json"
    write_json(label_map_path, label_map, private=True)

    presentation = {**bundle, "bundleSha256": bundle_sha256}
    encoded = json.dumps(presentation, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    template = args.html_template.read_text(encoding="utf-8")
    placeholder = "__NAVIA_PROVIDER_QUALIFICATION_BUNDLE__"
    if template.count(placeholder) != 1:
        raise ValueError("V3_ASR_REVIEW_TEMPLATE_PLACEHOLDER_INVALID")
    page_path = args.run_root / "asr-provider-qualification-review.html"
    page_path.write_text(template.replace(placeholder, encoded), encoding="utf-8")

    review_material = bundle_path.read_bytes() + page_path.read_bytes()
    deny_hits = [needle.decode() for needle in REVIEW_DENY if needle.lower() in review_material.lower()]
    if deny_hits:
        raise RuntimeError(f"V3_ASR_REVIEW_IDENTITY_LEAK:{','.join(deny_hits)}")
    if str(args.source_private_root).encode() in review_material or str(args.private_root).encode() in review_material:
        raise RuntimeError("V3_ASR_REVIEW_PRIVATE_PATH_LEAK")

    result = {
        "schemaVersion": "v3-asr-provider-qualification-blind-material-run/v1",
        "runId": run_id,
        "source": {
            "runId": EXPECTED_SOURCE_RUN,
            "handoffSha256": EXPECTED_HANDOFF_SHA256,
            "audioSha256s": [row["source"]["audioSha256"] for row in source_rows],
            "candidateSha256s": [row["source"]["candidateSha256"] for row in source_rows],
        },
        "baselineModel": model_facts,
        "isolation": {"cpuCores": 8, "memoryMaxBytes": MEMORY_BYTES, "swapMaxBytes": 0, **probes},
        "baseline": baseline_records,
        "bundle": {
            "path": bundle_path.name,
            "sha256": bundle_sha256,
            "sampleCount": 3,
            "binCount": 24,
            "pagePath": page_path.name,
            "pageSha256": sha256_file(page_path),
            "labelMapSha256": sha256_file(label_map_path),
        },
        "reviewFacingIdentityScan": {"hitCount": 0, "needles": len(REVIEW_DENY), "passed": True},
        "humanReviewStatus": "pending",
        "claimsQualityPassed": False,
        "passed": True,
    }
    write_json(args.run_root / "result.json", result)
    shutil.rmtree(args.private_root / "tasks", ignore_errors=True)
    print(json.dumps({"runId": run_id, "bundleSha256": bundle_sha256, "baseline": baseline_records, "humanReviewStatus": "pending"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
