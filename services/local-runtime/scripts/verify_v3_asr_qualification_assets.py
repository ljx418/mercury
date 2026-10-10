#!/usr/bin/env python3
"""Independently verify a V3-2-0b-0 asset qualification run."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ALLOWED_FINAL_HOSTS = frozenset({"release-assets.githubusercontent.com", "us.aws.cdn.hf.co"})


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def canonical_hash(value: Any) -> str:
    data = json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def check(checks: list[dict[str, Any]], check_id: str, condition: bool, detail: Any) -> None:
    checks.append({"id": check_id, "passed": bool(condition), "detail": detail})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    candidate = load(args.candidate)
    assets = load(args.run / "asset-verification.json")
    archives = load(args.run / "archive-inventory.json")
    licenses = load(args.run / "license-verification.json")
    dependency = load(args.run / "dependency-manifest.json")
    secret_scan = load(args.run / "secret-scan.json")
    checks: list[dict[str, Any]] = []

    expected: dict[str, tuple[int, str]] = {}
    for item in candidate["runtimeAssets"]:
        expected[f"runtime:{item['platform']}"] = (item["byteLength"], item["sha256"])
    for item in candidate["modelAssets"]:
        expected[f"model:{item['role']}"] = (item["byteLength"], item["sha256"])
    actual = {item["assetId"]: (item["byteLength"], item["sha256"]) for item in assets["assets"]}
    check(checks, "B00-01", len(expected) == 4 and len(actual) == 4 and set(expected) == set(actual), sorted(actual))
    for check_id, asset_id in (
        ("B00-02", "runtime:linux-x64-portable"),
        ("B00-03", "runtime:windows-x64-portable"),
        ("B00-04", "model:asr_model"),
        ("B00-05", "model:vad_model"),
    ):
        private_file = next(args.private_root / item["fileName"] for item in candidate["runtimeAssets"] + candidate["modelAssets"] if asset_id in {f"runtime:{item.get('platform')}", f"model:{item.get('role')}"})
        digest = hashlib.sha256(private_file.read_bytes()).hexdigest()
        observed = (private_file.stat().st_size, digest)
        check(checks, check_id, observed == expected[asset_id] == actual[asset_id], {"assetId": asset_id, "bytes": observed[0], "sha256": observed[1]})

    hosts_ok = all(
        urlparse(item["sourceUrl"]).scheme == "https"
        and item["finalHost"] in ALLOWED_FINAL_HOSTS
        and not urlparse(item["sourceUrl"]).username
        and not urlparse(item["sourceUrl"]).password
        for item in assets["assets"]
    )
    check(checks, "B00-06", hosts_ok, sorted({item["finalHost"] for item in assets["assets"]}))

    archive_items = archives["archives"]
    paths_safe = all(
        not member["path"].startswith("/") and ".." not in Path(member["path"]).parts
        for archive in archive_items
        for member in archive["members"]
    )
    types_safe = all(member["type"] in {"file", "directory", "symlink", "hardlink"} for archive in archive_items for member in archive["members"])
    check(checks, "B00-07", len(archive_items) == 2 and archives["summary"]["unsafe"] == 0 and paths_safe and types_safe, {"archives": len(archive_items), "members": sum(item["memberCount"] for item in archive_items)})

    revisions_ok = (
        dependency["provider"]["engineVersion"] == "runtime-llamacpp-v0.2.6"
        and all(len(item["revision"]) == 40 for item in candidate["modelAssets"])
        and candidate["modelAssets"][0]["revision"] == "1a5063b305a2b4e418ccffaf7be2c02a3cac6c89"
        and candidate["modelAssets"][1]["revision"] == "6840bae4c5c92ee8c04faaf4db23dd0105098d7f"
    )
    check(checks, "B00-08", revisions_ok, {"runtime": dependency["provider"]["engineVersion"], "models": [item["revision"] for item in candidate["modelAssets"]]})

    license_map = {item["subject"]: item for item in licenses["licenses"]}
    licenses_ok = (
        licenses["summary"] == {"failed": 0, "total": 3, "verified": 3}
        and license_map["provider:funasr-llamacpp"]["observedLicense"] == "MIT"
        and license_map["model:asr_model"]["observedLicense"].lower() == "apache-2.0"
        and license_map["model:vad_model"]["observedLicense"].lower() == "apache-2.0"
        and all(item["revisionMatches"] for item in licenses["licenses"])
    )
    check(checks, "B00-09", licenses_ok, {key: item["observedLicense"] for key, item in license_map.items()})

    dependency_ok = (
        dependency["assetSetSha256"] == canonical_hash(assets["assets"])
        and dependency["archiveInventorySha256"] == canonical_hash(archives)
        and dependency["licenseVerificationSha256"] == canonical_hash(licenses)
        and dependency["status"] == "verified_not_installed_not_qualified"
    )
    check(checks, "B00-10", dependency_ok, {"status": dependency["status"], "assetSetSha256": dependency["assetSetSha256"]})

    ignored = subprocess.run(
        ["git", "check-ignore", "-q", str(args.private_root)],
        check=False,
        cwd=Path.cwd(),
    ).returncode == 0
    check(checks, "B00-11", secret_scan["passed"] and not secret_scan["hits"] and ignored, {"secretScan": secret_scan, "privateRootIgnored": ignored})

    boundary_ok = (
        candidate["status"] == "document_candidate_not_qualified"
        and dependency["qualityStatus"] == "qualification_pending"
        and dependency["nextStage"] == "V3-2-0b-1"
    )
    check(checks, "B00-12", boundary_ok, {"candidateStatus": candidate["status"], "qualityStatus": dependency["qualityStatus"], "nextStage": dependency["nextStage"]})

    result = {
        "schemaVersion": "v3-asr-qualification-asset-acceptance/v1",
        "runId": assets["runId"],
        "checks": checks,
        "summary": {"total": len(checks), "passed": sum(1 for item in checks if item["passed"]), "failed": sum(1 for item in checks if not item["passed"])},
    }
    result["passed"] = result["summary"]["failed"] == 0 and result["summary"]["total"] == 12
    args.output.write_text(json.dumps(result, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"summary": result["summary"], "passed": result["passed"]}, sort_keys=True))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
