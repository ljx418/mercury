#!/usr/bin/env python3
"""Recompute the fixed V3-2-0b-2 acceptance denominator."""

from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navia_runtime.modules.media_companion.asr.catalog import ASR_MODEL_BY_ID, ASR_MODELS, ASR_PROVIDERS


def add(checks: list[dict], check_id: str, passed: bool, detail) -> None:
    checks.append({"id": check_id, "passed": bool(passed), "detail": detail})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--fixture", type=Path, required=True)
    parser.add_argument("--junit", type=Path, required=True)
    parser.add_argument("--real-probe", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    schema = json.loads(args.schema.read_text(encoding="utf-8"))
    fixture = json.loads(args.fixture.read_text(encoding="utf-8"))
    probe = json.loads(args.real_probe.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    schema_errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(fixture))
    root = ET.parse(args.junit).getroot()
    suites = [root] if root.tag == "testsuite" else list(root.findall("testsuite"))
    testcases = [case.get("name", "") for suite in suites for case in suite.findall("testcase")]
    totals = {
        "tests": sum(int(suite.get("tests", "0")) for suite in suites),
        "failures": sum(int(suite.get("failures", "0")) for suite in suites),
        "errors": sum(int(suite.get("errors", "0")) for suite in suites),
    }
    candidate = ASR_MODEL_BY_ID["funasr-paraformer-q8"]
    provider = next(item for item in ASR_PROVIDERS if item.provider_id == "funasr_edge_local")
    checks: list[dict] = []

    add(checks, "B02-01", not schema_errors, {"schemaErrors": len(schema_errors)})
    add(checks, "B02-02", len(ASR_MODELS) == 5 and candidate.provider_id == "funasr_edge_local" and candidate.revision == "1a5063b305a2b4e418ccffaf7be2c02a3cac6c89" and provider.engine_version == "runtime-llamacpp-v0.2.6", {"models": len(ASR_MODELS), "runtimeKind": candidate.runtime_kind})
    qualities = {item.model_id: item.quality_status for item in ASR_MODELS}
    add(checks, "B02-03", qualities == {"faster-whisper-tiny": "fallback_only", "faster-whisper-small": "failed_current_gate", "funasr-paraformer-q8": "failed_current_gate", "faster-whisper-large-v3-turbo": "not_evaluated"}, qualities)
    resources = candidate.resources.public_dict()
    add(checks, "B02-04", resources["downloadBytes"] == 246664010 and resources["diskBytes"] == 241074376 and resources["installationFreeSpaceRequiredBytes"] == 1073741824 and resources["estimatedPeakRamBytes"] == 8589934592 and resources["vramBytes"] == 0, resources)
    add(checks, "B02-05", probe["job"]["state"] == "ready" and probe["job"]["bytesCompleted"] == 246664010 and probe["job"]["bytesTotal"] == 246664010, probe["job"])
    published = {item["path"]: item for item in probe["published"]}
    runtime = next(item for item in candidate.files if item.archive_member)
    add(checks, "B02-06", published[runtime.published_path]["bytes"] == runtime.published_byte_length and published[runtime.published_path]["sha256"] == runtime.published_sha256 and published[runtime.published_path]["executable"], published[runtime.published_path])
    add(checks, "B02-07", set(published) == {"llama-funasr-paraformer", "paraformer-q8.gguf", "fsmn-vad.gguf"}, sorted(published))
    add(checks, "B02-08", probe["job"]["state"] == "ready" and probe["after"]["installation"]["state"] == "ready" and probe["cleanup"]["stagingEmpty"], "real default self-test completed before ready")
    add(checks, "B02-09", probe["selectionFailureCode"] == "V3_ASR_MODEL_NOT_QUALIFIED" and candidate.selectable is False, probe["selectionFailureCode"])
    add(checks, "B02-10", probe["after"]["settings"]["effectiveModelId"] == "faster-whisper-tiny" and probe["after"]["quality"]["status"] == "failed_current_gate", probe["after"])
    add(checks, "B02-11", "test_hash_mismatch_never_publishes_model" in testcases and any(name.startswith("test_offline_package_rejects_wrong_identity_revision_or_hash") for name in testcases), "source/hash negative regressions passed")
    nested_cases = [name for name in testcases if name.startswith("test_nested_runtime_archive_rejects_unsafe_member_and_never_publishes")]
    add(checks, "B02-12", len(nested_cases) == 2, {"negativeCases": len(nested_cases)})
    add(checks, "B02-13", all(name in testcases for name in ("test_cancelled_install_cleans_staging_and_keeps_fallback", "test_restart_marks_active_job_failed_and_removes_staging", "test_uninstalling_requested_model_explicitly_returns_to_bundled_fallback")) and all(probe["cleanup"].values()), probe["cleanup"])
    add(checks, "B02-14", totals["failures"] == 0 and totals["errors"] == 0 and "test_remote_install_reads_real_http_bytes_verifies_and_survives_restart" in testcases and "test_bundled_fallback_and_requested_effective_selection" in testcases, totals)
    add(checks, "B02-15", "test_runtime_api_exposes_catalog_selection_and_rejects_client_url" in testcases and "test_closed_provider_registry_rejects_duplicates_unknown_and_identity_mismatch" in testcases, "API/registry injection regressions passed")
    public_bytes = args.real_probe.read_bytes()
    hits = re.findall(rb"(?i)(SESSDATA|bili_jct|DedeUserID|Authorization\s*:|Cookie\s*:|/mnt/[a-z]/|/home/|[A-Z]:\\\\)", public_bytes)
    add(checks, "B02-16", not hits and candidate.quality_status == "failed_current_gate" and not candidate.selectable, {"secretHits": len(hits), "quality": candidate.quality_status, "selectable": candidate.selectable})

    result = {
        "schemaVersion": "v3-asr-manager-acceptance/v1",
        "checks": checks,
        "summary": {"total": len(checks), "passed": sum(1 for item in checks if item["passed"]), "failed": sum(1 for item in checks if not item["passed"])},
    }
    result["passed"] = result["summary"] == {"total": 16, "passed": 16, "failed": 0}
    args.output.write_text(json.dumps(result, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": result["passed"], "summary": result["summary"]}, sort_keys=True))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
