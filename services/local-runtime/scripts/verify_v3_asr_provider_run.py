#!/usr/bin/env python3
"""Recompute the fixed B01-01..B01-16 acceptance denominator."""

from __future__ import annotations

import argparse
import ast
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path


def record(checks: list[dict], check_id: str, passed: bool, detail) -> None:
    checks.append({"id": check_id, "passed": bool(passed), "detail": detail})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider-source", type=Path, required=True)
    parser.add_argument("--host-source", type=Path, required=True)
    parser.add_argument("--adapter-source", type=Path, required=True)
    parser.add_argument("--junit", type=Path, required=True)
    parser.add_argument("--real-probe", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    provider_text = args.provider_source.read_text(encoding="utf-8")
    host_text = args.host_source.read_text(encoding="utf-8")
    adapter_text = args.adapter_source.read_text(encoding="utf-8")
    provider_tree = ast.parse(provider_text)
    host_tree = ast.parse(host_text)
    probe = json.loads(args.real_probe.read_text(encoding="utf-8"))
    junit = ET.parse(args.junit).getroot()
    suites = [junit] if junit.tag == "testsuite" else list(junit.findall("testsuite"))
    testcases = [case.get("name", "") for suite in suites for case in suite.findall("testcase")]
    totals = {
        "tests": sum(int(suite.get("tests", "0")) for suite in suites),
        "failures": sum(int(suite.get("failures", "0")) for suite in suites),
        "errors": sum(int(suite.get("errors", "0")) for suite in suites),
    }
    checks: list[dict] = []

    task_fields = re.search(r"class TaskAudioRef:([\s\S]*?)\n\n", provider_text)
    portal_free = task_fields is not None and not re.search(r"cookie|bvid|portal|url", task_fields.group(1), re.I)
    record(checks, "B01-01", portal_free and "class AsrTranscriptCandidate" in provider_text, "contract types present; portal fields absent")
    record(checks, "B01-02", "test_closed_provider_registry_rejects_duplicates_unknown_and_identity_mismatch" in testcases, "closed registry regression present")
    dynamic_import = any(isinstance(node, (ast.Import, ast.ImportFrom)) and any(alias.name == "importlib" for alias in node.names) for node in ast.walk(provider_tree))
    record(checks, "B01-03", not dynamic_import and "V3_ASR_PROVIDER_UNKNOWN" in provider_text, "no dynamic import; unknown provider fail code present")

    popen_nodes = [node for node in ast.walk(host_tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "Popen"]
    shell_false = bool(popen_nodes) and all(any(keyword.arg == "shell" and isinstance(keyword.value, ast.Constant) and keyword.value.value is False for keyword in node.keywords) for node in popen_nodes)
    record(checks, "B01-04", shell_false and "platform_name" in adapter_text and probe["usageProbe"]["passed"], "shell=false; platform command; real usage matched")
    shape_cases = [name for name in testcases if name.startswith("test_audio_reference_shape_rejects_paths_and_non_contract_formats[")]
    record(checks, "B01-05", "test_audio_file_rejects_symlink_and_hardlink" in testcases and len(shape_cases) == 6, "path/link regressions passed")
    record(checks, "B01-06", "V3_ASR_AUDIO_FORMAT_UNSUPPORTED" in host_text and len(shape_cases) == 6, "WAV contract enforced")
    record(checks, "B01-07", "stdin=subprocess.DEVNULL" in host_text and "max_output_bytes" in host_text and "cwd=task_root" in host_text, "controlled cwd/stdin/output")
    record(checks, "B01-08", "test_native_process_uses_controlled_cwd_and_sanitized_environment" in testcases and "SENSITIVE_ENV_FRAGMENTS" in host_text, "sanitized environment regression passed")
    record(checks, "B01-09", totals["failures"] == 0 and totals["errors"] == 0 and probe["selfTest"]["passed"], {"junit": totals, "realSelfTest": probe["selfTest"]})
    record(checks, "B01-10", "test_process_timeout_cancel_crash_and_output_limit_fail_closed" in testcases and "V3_ASR_PROCESS_TIMEOUT" in host_text, "timeout regression passed")
    record(checks, "B01-11", "test_funasr_adapter_cancellation_cleans_task_audio" in testcases and probe["selfTest"]["taskCleaned"], "cancel and cleanup regressions passed")
    record(checks, "B01-12", "V3_ASR_PROCESS_FAILED" in host_text and "test_process_timeout_cancel_crash_and_output_limit_fail_closed" in testcases, "crash regression passed")
    record(checks, "B01-13", "overflow.is_set() and failure_code is None" in host_text and "V3_ASR_PROCESS_OUTPUT_LIMIT" in host_text, "post-join overflow race guarded")
    record(checks, "B01-14", probe["usageProbe"]["passed"], probe["usageProbe"])
    record(checks, "B01-15", "test_funasr_adapter_uses_fixed_argv_lifecycle_and_cleans_task" in testcases and probe["selfTest"]["passed"], "lifecycle mock + real self-test passed")
    public_bytes = args.real_probe.read_bytes()
    secrets = re.findall(rb"(?i)(SESSDATA|bili_jct|DedeUserID|Authorization\s*:|Cookie\s*:|/mnt/[a-z]/|/home/|[A-Z]:\\\\)", public_bytes)
    record(checks, "B01-16", not secrets and "bilibili" not in adapter_text.lower() and "youtube" not in adapter_text.lower(), {"secretHits": len(secrets), "portalReferences": 0})

    result = {
        "schemaVersion": "v3-asr-provider-acceptance/v1",
        "checks": checks,
        "summary": {"total": len(checks), "passed": sum(1 for item in checks if item["passed"]), "failed": sum(1 for item in checks if not item["passed"])},
    }
    result["passed"] = result["summary"] == {"total": 16, "passed": 16, "failed": 0}
    args.output.write_text(json.dumps(result, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": result["passed"], "summary": result["summary"]}, sort_keys=True))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
