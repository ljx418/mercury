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

    provider = fixtures["positiveInstances"][0]["instance"]
    composer = apply_mutations(provider, fixtures["positiveInstances"][1]["mutations"])
    assert not list(validator.iter_errors(provider)), "provider positive instance failed"
    assert not list(validator.iter_errors(composer)), "composer positive instance failed"

    one_claim = copy.deepcopy(composer)
    one_claim["brief"]["sourceClaimIds"] = one_claim["brief"]["sourceClaimIds"][:1]
    assert list(validator.iter_errors(one_claim)), "N01 was not rejected by schema"

    false_provider = copy.deepcopy(composer)
    false_provider["brief"]["origin"] = "provider"
    assert list(validator.iter_errors(false_provider)), "N07 was not rejected by schema"

    required = {f"V3510B21-N{index:02d}" for index in range(1, 11)}
    actual = {case["caseId"] for case in fixtures["negativeCases"]}
    assert actual == required, f"negative registry mismatch: {sorted(required ^ actual)}"

    pending = [case["caseId"] for case in fixtures["negativeCases"] if case["layer"] not in {"schema_and_semantic"}]
    print(json.dumps({
        "schemaMeta": "PASS",
        "positiveInstances": "2/2 PASS",
        "schemaNegatives": "2/2 PASS",
        "registry": "10/10 present",
        "implementationPending": pending,
        "implementationAuthorized": False,
    }, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
