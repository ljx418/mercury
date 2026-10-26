#!/usr/bin/env python3
"""Document-stage verifier for the Stage B route-2 schema fixtures.

This verifier proves only schema/meta and registry obligations. Semantic,
orchestration, persistence and real-run cases remain pending product
implementation and cannot be reported as passed by this script.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator


HERE = Path(__file__).resolve().parent
ROOT = Path(__file__).resolve().parents[3]
FIXTURES = next(path for path in (
    HERE / "stage-b-route-2-contract-fixtures.json",
    HERE / "14-route-2-contract-fixtures.json",
) if path.is_file())
SCHEMA = next(path for path in (
    ROOT / "contracts" / "v3_media_grounded_comprehension_v2_1.schema.json",
    HERE / "10-v2.1.schema.json",
    HERE / "12-v2.1.schema.json",
) if path.is_file())


def apply_mutations(value: dict, mutations: list[dict]) -> dict:
    result = copy.deepcopy(value)
    for mutation in mutations:
        target = result
        parts = mutation["path"].strip("/").split("/")
        for part in parts[:-1]:
            target = target[part]
        target[parts[-1]] = mutation["value"]
    return result


def main() -> int:
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)

    positive_total = 0
    positive_passed = 0
    for entry in fixtures["positiveInstances"]:
        if "instance" in entry:
            instance = entry["instance"]
        elif "copyFrom" in entry:
            base = next(
                item for item in fixtures["positiveInstances"]
                if item.get("fixtureId") == entry["copyFrom"]
            )["instance"]
            instance = apply_mutations(base, entry["mutations"])
        else:
            raise AssertionError(f"positive entry missing instance/copyFrom: {entry}")
        positive_total += 1
        errors = list(validator.iter_errors(instance))
        assert not errors, f"positive instance {entry.get('fixtureId', '?')} failed: {errors[:3]}"
        positive_passed += 1

    composer = next(
        apply_mutations(
            next(item for item in fixtures["positiveInstances"] if item.get("fixtureId") == entry["copyFrom"])["instance"],
            entry["mutations"],
        )
        for entry in fixtures["positiveInstances"]
        if entry.get("copyFrom") == "V3510B21-P01-provider"
    )

    one_claim = copy.deepcopy(composer)
    one_claim["brief"]["sourceClaimIds"] = one_claim["brief"]["sourceClaimIds"][:1]
    assert list(validator.iter_errors(one_claim)), "N01 was not rejected by schema"

    false_provider = copy.deepcopy(composer)
    false_provider["brief"]["origin"] = "provider"
    assert list(validator.iter_errors(false_provider)), "N07 was not rejected by schema"

    # N11: V2.1 receipt must reject undeclared extras (additionalProperties=false on Receipt).
    b5_1_extras = next(
        item for item in fixtures["positiveInstances"]
        if item.get("fixtureId") == "V3510B21-P03-provider-b5-1-receipt-extras"
    )["instance"]
    receipt_extras_violation = copy.deepcopy(b5_1_extras)
    receipt_extras_violation["receipt"]["notAnAllowedExtra"] = "x"
    assert list(validator.iter_errors(receipt_extras_violation)), (
        "N11 was not rejected by schema (V2.1 receipt must reject undeclared fields)"
    )

    # N5.1: V2.1 receipt must reject bad finishReason (enum constraint).
    finish_reason_violation = copy.deepcopy(b5_1_extras)
    finish_reason_violation["receipt"]["finishReason"] = "not-in-enum"
    assert list(validator.iter_errors(finish_reason_violation)), (
        "V2.1 receipt must reject finishReason outside the allowed enum"
    )

    # N5.2: V2.1 receipt must reject bad attemptId pattern.
    attempt_id_violation = copy.deepcopy(b5_1_extras)
    attempt_id_violation["receipt"]["attemptId"] = "no-prefix-1234"
    assert list(validator.iter_errors(attempt_id_violation)), (
        "V2.1 receipt must reject attemptId that does not match ^attempt-[a-f0-9]{1,32}$"
    )

    required = {f"V3510B21-N{index:02d}" for index in range(1, 12)}
    actual = {case["caseId"] for case in fixtures["negativeCases"]}
    assert actual == required, f"negative registry mismatch: {sorted(required ^ actual)}"

    pending = [case["caseId"] for case in fixtures["negativeCases"] if case["layer"] not in {"schema_and_semantic"}]
    print(json.dumps({
        "schemaMeta": "PASS",
        "positiveInstances": f"{positive_passed}/{positive_total} PASS",
        "schemaNegatives": "5/5 PASS",
        "registry": f"{len(actual)}/11 present",
        "implementationPending": pending,
        "implementationAuthorized": False,
    }, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
