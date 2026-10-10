#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from pathlib import Path

import jsonschema


ROOT = Path(__file__).resolve().parent


def load(name: str) -> dict:
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def main() -> int:
    v1 = load("10-product-acceptance-v1.schema.json")
    v2 = load("11-product-acceptance-v2.schema.json")
    human = load("12-human-review-v1.schema.json")
    fixture = load("13-product-human-positive-fixture.json")
    checks: list[dict[str, object]] = []

    def check(check_id: str, passed: bool) -> None:
        checks.append({"id": check_id, "passed": passed})

    for schema in (v1, v2, human):
        jsonschema.Draft202012Validator.check_schema(schema)
    check("schema_meta", True)
    jsonschema.Draft202012Validator(v1).validate(fixture["productAcceptance"])
    jsonschema.Draft202012Validator(human).validate(fixture["humanReview"])
    check("historical_v1_and_human_positive", True)

    candidate = copy.deepcopy(fixture["productAcceptance"])
    candidate["schemaVersion"] = "v3-media-product-acceptance/v2"
    candidate["taskExecution"] = {
        "registryClass": "subtitle",
        "observedRoute": "credentialed_media_asr",
        "routeDrift": True,
        "fallbackReasonCodes": ["SUBTITLE_UNAVAILABLE_AT_EXECUTION"],
        "resourceNotice": {
            "shown": True,
            "localAsr": True,
            "expectedWaitClass": "long",
            "cpuImpact": "high",
            "memoryMiB": 1536,
            "temporaryDiskBytes": 33554432,
            "cancelAvailable": True,
            "temporaryMediaDeleted": True,
        },
    }
    validator = jsonschema.Draft202012Validator(v2)
    validator.validate(candidate)
    check("v2_asr_fallback_positive", True)

    mutations = {
        "route_drift_false": lambda v: v["taskExecution"].update(routeDrift=False),
        "fallback_reason_missing": lambda v: v["taskExecution"].update(fallbackReasonCodes=[]),
        "notice_hidden": lambda v: v["taskExecution"]["resourceNotice"].update(shown=False),
        "local_asr_false": lambda v: v["taskExecution"]["resourceNotice"].update(localAsr=False),
        "cancel_missing": lambda v: v["taskExecution"]["resourceNotice"].update(cancelAvailable=False),
        "temporary_media_retained": lambda v: v["taskExecution"]["resourceNotice"].update(temporaryMediaDeleted=False),
    }
    for check_id, mutate in mutations.items():
        invalid = copy.deepcopy(candidate)
        mutate(invalid)
        check(check_id, not validator.is_valid(invalid))

    allowed = {
        "subtitle": {"credentialed_subtitle", "public_or_page_subtitle"},
        "asr": {"credentialed_media_asr", "trusted_tab_capture_asr"},
        "multipart": {"credentialed_media_asr", "trusted_tab_capture_asr"},
        "restricted": {"blocked"},
        "low_signal": {"visual_low_signal"},
    }
    execution = candidate["taskExecution"]
    expected_drift = execution["observedRoute"] not in allowed[execution["registryClass"]]
    check("semantic_route_drift_recomputed", execution["routeDrift"] is expected_drift)
    notice = execution["resourceNotice"]
    check("semantic_nonzero_resources", notice["memoryMiB"] > 0 and notice["temporaryDiskBytes"] > 0)

    result = {
        "schemaVersion": "v3-5-document-verification/v1",
        "total": len(checks),
        "passed": sum(item["passed"] is True for item in checks),
        "failed": [item["id"] for item in checks if item["passed"] is not True],
        "checks": checks,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not result["failed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
