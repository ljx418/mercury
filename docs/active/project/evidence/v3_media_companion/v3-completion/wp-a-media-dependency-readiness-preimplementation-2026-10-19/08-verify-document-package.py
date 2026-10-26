#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[7]
CONTRACTS = ROOT / "docs/active/project/contracts"
FIXTURES = ROOT / "docs/active/project/fixtures"
PACKAGE = Path(__file__).resolve().parent

checks: list[tuple[str, bool]] = []


def check(name: str, condition: bool) -> None:
    checks.append((name, bool(condition)))


def semantic_job_valid(value: dict) -> bool:
    progress = value.get("progress", {})
    completed = progress.get("completedBytes")
    total = progress.get("totalBytes")
    if isinstance(total, int) and isinstance(completed, int) and completed > total:
        return False
    state = value.get("state")
    failure = value.get("failureCode")
    if state in {"failed", "corrupt"} and not isinstance(failure, str):
        return False
    if state in {"ready", "cancelled"} and failure is not None:
        return False
    return True


def semantic_status_valid(value: dict) -> bool:
    for dependency in value.get("dependencies", []):
        if dependency.get("state") != "ready":
            continue
        if dependency.get("verifiedAt") is None or dependency.get("failureCode") is not None:
            return False
        if dependency.get("dependencyId") != "sensevoice":
            if not dependency.get("observedSha256") or dependency.get("observedSha256") != dependency.get("expectedSha256"):
                return False
    return True


status_schema = json.loads((CONTRACTS / "v3_media_dependency_status_v1.schema.json").read_text())
job_schema = json.loads((CONTRACTS / "v3_media_dependency_installation_v1.schema.json").read_text())
api_schema = json.loads((CONTRACTS / "v3_media_dependency_api_v1.schema.json").read_text())
status = json.loads((FIXTURES / "v3-media-dependency-status-v1-positive.json").read_text())
job = json.loads((FIXTURES / "v3-media-dependency-installation-v1-positive.json").read_text())
api_request = json.loads((FIXTURES / "v3-media-dependency-api-v1-positive.json").read_text())
api_error = json.loads((FIXTURES / "v3-media-dependency-api-v1-error.json").read_text())

for schema in (status_schema, job_schema, api_schema):
    Draft202012Validator.check_schema(schema)
Draft202012Validator(status_schema, format_checker=FormatChecker()).validate(status)
Draft202012Validator(job_schema, format_checker=FormatChecker()).validate(job)
check("positive status semantic relations", semantic_status_valid(status))
check("positive job semantic relations", semantic_job_valid(job))
registry = Registry().with_resources(
    [
        (status_schema["$id"], Resource.from_contents(status_schema)),
        (job_schema["$id"], Resource.from_contents(job_schema)),
    ]
)
api_validator = Draft202012Validator(api_schema, registry=registry, format_checker=FormatChecker())
api_validator.validate(api_request)
api_validator.validate(api_error)
api_validator.validate({"ok": True, "data": status, "error": None, "request_id": "req_9ec1bb9d4c3aa433"})
api_validator.validate({"ok": True, "data": {"job": job}, "error": None, "request_id": "req_9ec1bb9d4c3aa433"})
check("three schemas meta-validate", True)
check("positive status validates", True)
check("positive repair job validates", True)
check("API request and error validate", True)
check("API success envelopes validate", True)
check("four unique dependencies", len(status["dependencies"]) == 4 == len({d["dependencyId"] for d in status["dependencies"]}))
check("fixed dependency set", {d["dependencyId"] for d in status["dependencies"]} == {"yt-dlp", "ffmpeg", "ffprobe", "sensevoice"})
check("ready generation present", status["overallState"] != "ready" or bool(status["generation"]))
check("yt-dlp frozen hash", next(d for d in status["dependencies"] if d["dependencyId"] == "yt-dlp")["expectedSha256"] == "1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6")
check("ffmpeg frozen hash", next(d for d in status["dependencies"] if d["dependencyId"] == "ffmpeg")["expectedSha256"] == "ed16af623947494a72e284b6eb8ff225f2da22b38b5d5069c2fd4b4ba3384e41")
check("ffprobe frozen hash", next(d for d in status["dependencies"] if d["dependencyId"] == "ffprobe")["expectedSha256"] == "272f6ebc634a63d9c8b4ca68e964119d980f25154e5aa2c35e5487da48e9a58f")
check("job only requests yt-dlp", job["dependencyIds"] == ["yt-dlp"])

mutations: list[tuple[str, Draft202012Validator, dict]] = []
duplicate = copy.deepcopy(status)
duplicate["dependencies"][1]["dependencyId"] = "yt-dlp"
mutations.append(("duplicate dependency rejected", Draft202012Validator(status_schema), duplicate))
null_generation = copy.deepcopy(status)
null_generation["generation"] = None
mutations.append(("ready without generation rejected", Draft202012Validator(status_schema), null_generation))
wrong_kind = copy.deepcopy(status)
wrong_kind["dependencies"][0]["kind"] = "system_tool"
mutations.append(("dependency kind mismatch rejected", Draft202012Validator(status_schema), wrong_kind))
ready_cancelable = copy.deepcopy(job)
ready_cancelable.update(state="ready", cancelable=True, publishedGeneration=status["generation"], finishedAt="2026-10-19T08:00:04Z")
mutations.append(("ready cancelable job rejected", Draft202012Validator(job_schema), ready_cancelable))
extra_url = {"dependencyIds": ["yt-dlp"], "url": "https://example.invalid/tool"}
mutations.append(("client URL rejected", api_validator, extra_url))
missing_dependency = copy.deepcopy(status)
missing_dependency["dependencies"].pop()
mutations.append(("missing dependency rejected", Draft202012Validator(status_schema), missing_dependency))
wrong_scope = copy.deepcopy(status)
wrong_scope["dependencies"][1]["storageScope"] = "windows_persistent"
mutations.append(("system storage scope rejected", Draft202012Validator(status_schema), wrong_scope))
installing_without_job = copy.deepcopy(status)
installing_without_job.update(overallState="installing", activeJobId=None)
mutations.append(("installing without active job rejected", Draft202012Validator(status_schema), installing_without_job))
installing_cancelable = copy.deepcopy(job)
installing_cancelable.update(state="installing", cancelable=True)
mutations.append(("commit phase cancelable rejected", Draft202012Validator(job_schema), installing_cancelable))
terminal_without_finish = copy.deepcopy(job)
terminal_without_finish.update(state="failed", cancelable=False, failureCode="V3_MEDIA_DEPENDENCY_NETWORK_FAILED")
mutations.append(("terminal without finishedAt rejected", Draft202012Validator(job_schema), terminal_without_finish))
unknown_state = copy.deepcopy(job)
unknown_state["state"] = "published"
mutations.append(("unknown job state rejected", Draft202012Validator(job_schema), unknown_state))
bad_job_id = copy.deepcopy(job)
bad_job_id["jobId"] = "job_unsafe"
mutations.append(("unsafe job id rejected", Draft202012Validator(job_schema), bad_job_id))
for name, validator, instance in mutations:
    check(name, not validator.is_valid(instance))

failed_without_code = copy.deepcopy(job)
failed_without_code.update(state="failed", cancelable=False, finishedAt="2026-10-19T08:00:04Z")
check("failed job without failure code rejected", not Draft202012Validator(job_schema).is_valid(failed_without_code) and not semantic_job_valid(failed_without_code))
progress_over_total = copy.deepcopy(job)
progress_over_total["progress"].update(completedBytes=3_072_470, totalBytes=3_072_469)
check("progress one-over rejected", not semantic_job_valid(progress_over_total))
ready_without_observed = copy.deepcopy(status)
ready_without_observed["dependencies"][0]["observedSha256"] = None
check("ready dependency without observed digest rejected", not semantic_status_valid(ready_without_observed))
ready_with_failure = copy.deepcopy(status)
ready_with_failure["dependencies"][0]["failureCode"] = "V3_MEDIA_DEPENDENCY_HASH_MISMATCH"
check("ready dependency with failure code rejected", not Draft202012Validator(status_schema).is_valid(ready_with_failure) and not semantic_status_valid(ready_with_failure))

combined = "\n".join(path.read_text() for path in sorted(PACKAGE.glob("*.md")))
for endpoint in (
    "/v1/media/dependencies",
    "/v1/media/dependency-installations",
):
    check(f"documents endpoint {endpoint}", endpoint in combined)
for forbidden in ("自动执行 apt", "任意 URL", "本地文件导入"):
    check(f"documents boundary {forbidden}", forbidden in combined)
check("fixed 24-case denominator", "A01-A24" in combined and "24/24" in combined)
check("all 24 cases individually enumerated", all(f"A{number:02d}" in combined for number in range(1, 25)))
check("frozen download byte length", "3,072,469" in combined)
check("fixed download deadlines", "connect timeout=15s" in combined and "总下载 deadline=180s" in combined and "自检 deadline=30s" in combined)
check("task snapshot covers three paths", all(term in combined for term in ("acquisition", "视觉", "ASR")))
check("Claude stop condition", "WP-A AWAITING CODEX CHECKPOINT" in combined)
check("no product PASS claim", "不得宣布 WP-A/V3 PASS" in combined)

failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'} {name}")
print(f"RESULT {len(checks) - len(failed)}/{len(checks)}")
sys.exit(1 if failed else 0)
