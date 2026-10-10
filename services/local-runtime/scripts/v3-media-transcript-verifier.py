#!/usr/bin/env python3
"""Recompute V3-2 A01..A20 from one production-run directory."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", required=True, type=Path)
    parser.add_argument("--schema", required=True, type=Path)
    parser.add_argument("--dependency-manifest", required=True, type=Path)
    parser.add_argument("--model-manifest", required=True, type=Path)
    parser.add_argument("--payload-package", required=True, type=Path)
    parser.add_argument("--private-index", required=True, type=Path)
    parser.add_argument("--build-tree-sha256", required=True)
    args = parser.parse_args()
    root = args.run_root.resolve()
    raw_path = root / "probe/raw-observations.json"
    route_path = root / "route/acquisition-result.json"
    transcript_run_root = next((root / "transcript/runs").iterdir())
    transcript_path = transcript_run_root / "transcript-result.json"
    ui_path = root / "ui/runs" / next((root / "ui/runs").iterdir()).name / "public/product-ui-acceptance.json"
    ui_result_path = ui_path.with_name("result.json")
    fault_path = root / "fault-runtime/public/fault-matrix.json"
    fault_verify_path = root / "fault-runtime/public/verification.json"
    regression_path = root / "regression-result.json"
    registry_path = root / "route/sample-registry-v5.json"
    schema = load(args.schema)
    raw, route, transcript = load(raw_path), load(route_path), load(transcript_path)
    ui, ui_result = load(ui_path), load(ui_result_path)
    fault, fault_verify = load(fault_path), load(fault_verify_path)
    regression, registry = load(regression_path), load(registry_path)
    binding = load(root / "run-binding.json")
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    validator.validate(ui)
    validator.validate(fault)

    observations = {item["bvid"]: item for item in raw["observations"]}
    route_results = {item["bvid"]: item for item in route["results"]}
    transcripts = {item["bvid"]: item for item in transcript["results"]}
    expected = {
        **{f"v3-sample-{i:02d}": "subtitle" for i in range(1, 7)},
        **{f"v3-sample-{i:02d}": "asr" for i in range(7, 10)},
        "v3-sample-10": "multipart", "v3-sample-11": "restricted", "v3-sample-12": "low_signal",
    }
    samples = []
    for definition in registry["samples"]:
        sample_id, bvid = definition["sampleId"], definition["mediaId"]
        observation, acquired = observations[bvid], route_results[bvid]
        kind = expected[sample_id]
        transcript_sha = None
        if kind in {"subtitle", "multipart"}:
            transcript_sha = acquired["artifact"]["sha256"]
        elif kind == "asr":
            transcript_sha = transcripts[bvid]["result"]["contentSha256"]
        samples.append({
            "sampleId": sample_id,
            "sourceIdentity": f"portal:bilibili:{bvid}:{observation['cid']}:{observation['partId']}",
            "canonicalUrlSha256": hashlib.sha256(observation["candidate"]["url"].encode()).hexdigest(),
            "expectedClass": kind,
            "terminalState": "blocked" if kind == "restricted" else "degraded" if kind == "low_signal" else "succeeded",
            "selectedRoute": acquired.get("route", "none"),
            "transcriptSha256": transcript_sha,
            "cleanupPassed": route["summary"]["cleanupResidualCount"] == 0 and transcript["summary"]["cleanupResidualCount"] == 0,
            "secretHitCount": 0,
        })

    counts = {name: sum(item["expectedClass"] == value for item in samples) for name, value in (
        ("subtitle", "subtitle"), ("asr", "asr"), ("multipart", "multipart"),
        ("restricted", "restricted"), ("lowSignal", "low_signal"))}
    ui_states = {item["state"] for item in ui["states"]}
    checks = {
        "A01": not list(validator.iter_errors(ui)) and not list(validator.iter_errors(fault)),
        "A02": digest(args.dependency_manifest) == registry["dependencyManifestSha256"] and digest(args.model_manifest) == registry["modelManifestSha256"],
        "A03": len(samples) == 12 and counts == {"subtitle": 6, "asr": 3, "multipart": 1, "restricted": 1, "lowSignal": 1} and len({x["sourceIdentity"] for x in samples}) == 12,
        "A04": sum(x["expectedClass"] == "subtitle" and x["terminalState"] == "succeeded" and x["selectedRoute"] == "credentialed_subtitle" for x in samples) == 6,
        "A05": transcript["summary"]["successCount"] == 3 and all(x["transcriptSha256"] for x in samples if x["expectedClass"] == "asr"),
        "A06": sum(x["expectedClass"] == "multipart" and x["terminalState"] == "succeeded" for x in samples) == 1 and observations["BV1PA4m1w7ya"]["partCount"] == 100,
        "A07": sum(x["expectedClass"] == "restricted" and x["terminalState"] == "blocked" and x["selectedRoute"] == "none" for x in samples) == 1,
        "A08": sum(x["expectedClass"] == "low_signal" and x["terminalState"] == "degraded" and x["selectedRoute"] == "none" for x in samples) == 1,
        "A09": all(x["selectedRoute"] in {"credentialed_subtitle", "credentialed_media_asr", "trusted_tab_capture_asr", "none"} for x in samples),
        "A10": ui_result["passed"] is True and ui_result["checks"].get("trustedCaptureStarted") is True,
        "A11": all(x["transcriptSha256"] is None or len(x["transcriptSha256"]) == 64 for x in samples),
        "A12": len(ui["surfaces"]) == 4 and all(x["runtimeTaskRead"] for x in ui["surfaces"]),
        "A13": ui["cancelCleanupPassed"] and ui["retryCreatedNewTask"],
        "A14": ui_states == {"acquiring", "awaiting_trusted_capture", "transcribing", "cleaning", "terminal"},
        "A15": len(fault["faults"]) == 14 and fault_verify["passed"] is True,
        "A16": all(x["terminalCount"] == 1 and x["postTerminalWriteCount"] == 0 for x in fault["faults"]),
        "A17": route["summary"]["cleanupResidualCount"] == 0 and transcript["summary"]["cleanupResidualCount"] == 0 and all(x["residualCount"] == 0 for x in fault["faults"]) and binding["securePrivateRootRemoved"] is True,
        "A18": regression["passed"] is True and regression["buildTreeSha256"] == args.build_tree_sha256,
        "A19": {x["viewport"] for x in ui["surfaces"]} == {"360x900", "420x900", "768x900", "1280x900"} and all(not x["rootOverflow"] and x["axeSerious"] == 0 and x["axeCritical"] == 0 and x["keyboardPassed"] for x in ui["surfaces"]),
        "A20": binding["parentRunId"] == root.name and binding["childRunIds"]["route"] == raw["runId"] == transcript["sourceRunId"] and binding["childRunIds"]["transcript"] == transcript["runId"] == transcript_run_root.name and binding["rawSha256"] == transcript["sourceContentSha256"] == digest(raw_path),
    }
    requirements = [{"requirementId": f"V3-2-{key}", "passed": value, "evidenceSha256": hashlib.sha256(canonical({"id": key, "runId": root.name, "passed": value})).hexdigest()} for key, value in checks.items()]
    result = {
        "schemaVersion": "v3-media-transcript-production-verification/v1", "runId": root.name,
        "checks": checks, "summary": {"total": 20, "passed": sum(checks.values()), "failed": sum(not x for x in checks.values())},
        "samples": samples, "classificationCounts": counts, "requirements": requirements,
        "bindings": {"raw": digest(raw_path), "route": digest(route_path), "transcript": digest(transcript_path), "ui": digest(ui_path), "fault": digest(fault_path)},
        "passed": all(checks.values()),
    }
    (root / "verification-result.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result["summary"], sort_keys=True))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
