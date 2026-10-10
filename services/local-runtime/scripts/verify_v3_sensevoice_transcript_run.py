#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator


EXPECTED = (("v3-sample-07", "BV13W41137qV"), ("v3-sample-08", "BV1ZpYd66ELP"), ("v3-sample-09", "BV1pW421c7DH"))
MODEL_FILES = {
    "llama-funasr-sensevoice": "c41a53b0156f5c6c01a4390aee601831890d2fffe272d34499e1589e64c30edd",
    "sensevoice-small-q8.gguf": "4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5",
    "fsmn-vad.gguf": "1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def content_sha256(segments: list[dict[str, object]]) -> str:
    payload = b"".join(
        f"{item['segmentId']}\t{item['startMs']}\t{item['endMs']}\t{item['textSha256']}\n".encode("utf-8")
        for item in segments
    )
    return hashlib.sha256(payload).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    parser.add_argument("--install-root", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--regression", type=Path, required=True)
    args = parser.parse_args()
    result_path = args.run_root / "transcript-result.json"
    result = json.loads(result_path.read_text(encoding="utf-8"))
    schema = json.loads(args.schema.read_text(encoding="utf-8"))
    regression = json.loads(args.regression.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    rows = result["results"]
    schema_valid = True
    try:
        for row in rows:
            Draft202012Validator(schema).validate(row["executionReceipt"])
    except Exception:
        schema_valid = False

    identities = tuple((row["sampleId"], row["bvid"]) for row in rows)
    segment_valid = all(
        row["segmentReceipts"]
        and len(row["segmentReceipts"]) == row["result"]["segmentCount"] == row["coverage"]["speechIntervalCount"]
        and all(0 <= item["startMs"] < item["endMs"] <= row["durationMs"] for item in row["segmentReceipts"])
        and all(a["endMs"] <= b["startMs"] for a, b in zip(row["segmentReceipts"], row["segmentReceipts"][1:]))
        and content_sha256(row["segmentReceipts"]) == row["result"]["contentSha256"]
        for row in rows
    )
    model_valid = set(path.name for path in args.install_root.iterdir() if path.is_file()) == set(MODEL_FILES) and all(
        sha256_file(args.install_root / name) == digest for name, digest in MODEL_FILES.items()
    )
    source_files = [
        Path("services/local-runtime/navia_runtime/app.py"),
        Path("services/local-runtime/navia_runtime/modules/media_companion/acquisition/coordinator.py"),
        Path("services/local-runtime/navia_runtime/modules/media_companion/acquisition/bilibili/acquirer.py"),
    ]
    production_fault_hits = sum(
        path.read_text(encoding="utf-8").count(token)
        for path in source_files
        for token in ("subtitle_body_http_503", "subtitle_body_http_403", "subtitle_body_empty")
    )
    public_bytes = b"".join(path.read_bytes() for path in args.run_root.iterdir() if path.is_file())
    checks = {
        "ST01": schema_valid,
        "ST02": result["sourceRunId"] == "v3-2-route-b3-20261007T014759Z" and result["sourceContentSha256"] == "66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea",
        "ST03": identities == EXPECTED and len(set(result["lineage"]["taskIds"])) == 3 and result["summary"]["crossRunArtifactCount"] == 0,
        "ST04": len(rows) == 3 and all(row["route"] == "credentialed_media_asr" and row["audioBytes"] > 44 and len(row["audioSha256"]) == 64 for row in rows),
        "ST05": result["summary"]["dynamicTriggerTotal"] == 3 and production_fault_hits == 0 and all(row["faultCount"] == int(row["subtitleItemCount"] > 0) for row in rows),
        "ST06": all(row["executionReceipt"]["audioBinding"]["artifactSha256"] == row["audioSha256"] and row["resources"]["temporaryDiskPeakBytes"] == row["audioBytes"] * 2 for row in rows),
        "ST07": regression.get("stagingNegativePassed") is True,
        "ST08": model_valid and result["modelProfile"]["deviceClass"] == "cpu" and result["modelProfile"]["computeType"] == "q8",
        "ST09": all(row["result"]["status"] == "succeeded" and row["result"]["segmentCount"] > 0 for row in rows),
        "ST10": all(row["coverage"]["speechIntervalCount"] > 0 for row in rows) and b'"stderr"' not in public_bytes.lower(),
        "ST11": all(row["coverage"]["coverageRatio"] == 1.0 and row["coverage"]["passed"] is True for row in rows),
        "ST12": segment_valid,
        "ST13": segment_valid and len(set(result["lineage"]["audioSha256"])) == 3 and len(set(result["lineage"]["transcriptSha256"])) == 3,
        "ST14": all(row["progressObservationCount"] >= 5 for row in rows),
        "ST15": regression.get("cancelPassed") is True,
        "ST16": regression.get("faultMatrixPassed") is True,
        "ST17": regression.get("credentialNegativePassed") is True and regression.get("networkNegativePassed") is True,
        "ST18": result["summary"]["cleanupResidualCount"] == 0 and not args.private_root.exists() and result["privacy"]["publicSecretHitCount"] == 0 and b'"text"' not in public_bytes,
        "ST19": all(row["resources"]["peakRssBytes"] <= 8 * 1024**3 and row["resources"]["cpuCoreLimit"] == 8 and row["resources"]["gpuUsed"] is False for row in rows) and regression.get("allPassed") is True,
        "ST20": result["summary"]["successCount"] == 3 and result["summary"]["humanTranscriptInputCount"] == 0,
    }
    output = {
        "schemaVersion": "v3-2-3-sensevoice-verification/v1", "runId": result["runId"],
        "checks": checks, "summary": {"total": len(checks), "passed": sum(checks.values()), "failed": sum(not value for value in checks.values())},
        "bindings": {"transcriptResultSha256": sha256_file(result_path), "regressionResultSha256": sha256_file(args.regression)},
        "passed": all(checks.values()),
    }
    (args.run_root / "verification-result.json").write_text(json.dumps(output, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output["summary"], sort_keys=True))
    return 0 if output["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
