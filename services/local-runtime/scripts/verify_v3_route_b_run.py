#!/usr/bin/env python3
"""Independently verify the public-safe Route B run outputs."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--cookie", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    parser.add_argument("--regression", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    raw = json.loads((args.run_root / "raw-observations.json").read_text(encoding="utf-8"))
    enriched = json.loads((args.run_root / "enriched-observations.json").read_text(encoding="utf-8"))
    registry = json.loads((args.run_root / "sample-registry-v5.json").read_text(encoding="utf-8"))
    result = json.loads((args.run_root / "acquisition-result.json").read_text(encoding="utf-8"))
    regression = json.loads(args.regression.read_text(encoding="utf-8"))
    schema = json.loads(args.schema.read_text(encoding="utf-8"))
    errors = list(Draft202012Validator(schema).iter_errors(registry))
    observations = {item["bvid"]: item for item in enriched["observations"]}
    samples = {item["bvid"]: item for item in result["results"]}
    registry_samples = {item["mediaId"]: item for item in registry["samples"]}
    allowed_names = {"DedeUserID", "DedeUserID__ckMd5", "SESSDATA", "b_nut", "bili_jct", "buvid3", "buvid4", "buvid_fp", "sid"}
    cookie_values = [str(item["value"]).encode() for item in json.loads(args.cookie.read_text(encoding="utf-8")) if item.get("name") in allowed_names]
    public_files = [path for path in args.run_root.rglob("*") if path.is_file()]
    value_hits = sum(path.read_bytes().count(value) for path in public_files for value in cookie_values)
    context_needles = (b"SESSDATA", b"Cookie:", b"Bearer ", b"aisubtitle.hdslb.com", b"myCk.txt", b"/mnt/c/Users")
    context_hits = sum(path.read_bytes().count(needle) for path in public_files for needle in context_needles)
    screenshot_ok = all(
        (args.run_root / item["screenshot"]["path"]).is_file()
        and sha256_file(args.run_root / item["screenshot"]["path"]) == item["screenshot"]["sha256"]
        for item in registry["samples"]
    )
    asr_bvids = ("BV13W41137qV", "BV1ZpYd66ELP", "BV1pW421c7DH")
    expected_faults = {
        "BV13W41137qV": "subtitle_body_http_503",
        "BV1ZpYd66ELP": "subtitle_body_http_403",
        "BV1pW421c7DH": "subtitle_body_empty",
    }
    asr_samples = [registry_samples[bvid] for bvid in asr_bvids]
    runtime_no_subtitle = [item for item in asr_samples if item["asrTriggerClass"] == "runtime_no_subtitle"]
    injected = [item for item in asr_samples if item["asrTriggerClass"] == "audited_subtitle_failure"]
    media = [item for item in result["results"] if item.get("route") == "credentialed_media_asr"]
    checks = {
        "B3-01": not errors and registry["revision"] == 5 and registry["supersedesRevision4Artifact"]["sha256"] == sha256_file(Path(registry["supersedesRevision4Artifact"]["path"])),
        "B3-02": len(observations) == 12 and len(set(observations)) == 12 and screenshot_ok,
        "B3-03": tuple(item["mediaId"] for item in asr_samples) == asr_bvids,
        "B3-04": all(item["subtitleDiscovery"]["authority"] == "acquisition_task" and len(item["subtitleDiscovery"]["discoverySha256"]) == 64 for item in asr_samples),
        "B3-05": all((item["subtitleDiscovery"]["subtitleItemCount"] == 0) == (item["asrTriggerClass"] == "runtime_no_subtitle") for item in asr_samples),
        "B3-06": registry["asrTriggerCounts"]["totalMediaFallback"] == 3 and registry["asrTriggerCounts"]["runtimeNoSubtitle"] + registry["asrTriggerCounts"]["auditedSubtitleFailure"] == 3,
        "B3-07": all(item["faultScenario"]["faultClass"] == expected_faults[item["mediaId"]] and samples[item["mediaId"]]["faultCount"] == 1 and samples[item["mediaId"]]["appliedFaultClass"] == expected_faults[item["mediaId"]] for item in injected),
        "B3-08": all(item["faultScenario"] is None and samples[item["mediaId"]]["faultCount"] == 0 and samples[item["mediaId"]]["fallbackReasonCodes"] == ["V3_MEDIA_SUBTITLE_UNAVAILABLE"] for item in runtime_no_subtitle),
        "B3-09": regression["productionFaultReachability"]["passed"] is True and regression["productionFaultReachability"]["hitCount"] == 0,
        "B3-10": regression["focusedRuntime"]["exitCode"] == 0 and regression["focusedRuntime"]["failed"] == 0,
        "B3-11": result["toolHashes"]["ytDlp"] == "1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6",
        "B3-12": result["summary"]["subtitleSuccess"] == 7 and all(samples[bvid]["artifact"]["byteLength"] > 0 for bvid in list(samples)[:6]),
        "B3-13": len(media) == 3 and all(item["artifact"]["byteLength"] > 44 and len(item["artifact"]["sha256"]) == 64 and item["mediaShape"]["sampleRateHz"] == 16000 and item["mediaShape"]["channels"] == 1 and item["mediaShape"]["sampleWidth"] == 2 for item in media),
        "B3-14": observations["BV1PA4m1w7ya"]["partCount"] == 100 and samples["BV1PA4m1w7ya"]["route"] == "credentialed_subtitle",
        "B3-15": samples["BV1vt1sBgEzc"]["outcome"] == "blocked" and samples["BV1goA2zrEEq"]["outcome"] == "degraded",
        "B3-16": regression["focusedRuntime"]["exitCode"] == 0,
        "B3-17": result["summary"]["cleanupResidualCount"] == 0 and not args.private_root.exists(),
        "B3-18": regression["runtimeFull"]["passed"] >= 441 and regression["runtimeFull"]["failed"] == 0 and regression["runtimeFull"]["exitCode"] == 0 and regression["frontend"]["typecheckExitCode"] == 0 and regression["frontend"]["testsFailed"] == 0 and regression["frontend"]["buildExitCode"] == 0,
        "B3-19": value_hits == 0 and context_hits == 0,
        "B3-20": registry["productionReady"] is True and result["summary"]["total"] == 12 and len(media) == 3,
    }
    evidence = {
        "schemaVersion": "v3-route-b3-verification/v1",
        "runId": registry["runId"],
        "checks": [{"id": key, "passed": value} for key, value in checks.items()],
        "summary": {"total": len(checks), "passed": sum(checks.values()), "failed": len(checks) - sum(checks.values())},
        "bindings": {name: sha256_file(args.run_root / name) for name in ("raw-observations.json", "enriched-observations.json", "sample-registry-v5.json", "acquisition-result.json", "regression-result.json")},
        "secretScan": {"registeredCredentialValueHits": value_hits, "forbiddenContextHits": context_hits, "files": len(public_files)},
        "limitations": {
            "B3-09_B3-10_B3-16": "Bound to focused automated regression; independent exit audit must rerun negative cases.",
            "B3-13": "Media bytes were hashed and inspected inside the task sandbox, then deleted by policy; public evidence contains hash/length/shape, not copyrighted audio.",
            "B3-18": "Bound to regression-result.json; independent exit audit must rerun or inspect captured logs.",
        },
    }
    args.output.write_text(json.dumps(evidence, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(evidence["summary"], sort_keys=True))
    return 0 if evidence["summary"]["failed"] == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
