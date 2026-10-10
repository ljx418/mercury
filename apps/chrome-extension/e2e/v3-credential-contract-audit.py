#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator


REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = REPO_ROOT / "docs/active/project/contracts/v3_media_credential_lease_contracts.schema.json"
POSITIVE_PATH = REPO_ROOT / "docs/active/project/fixtures/v3-media-credential-lease-contract-positive.json"
FIXTURES_PATH = REPO_ROOT / "docs/active/project/fixtures/v3-media-credential-lease-contract-fixtures.json"


def apply_patch(instance: dict, patch: dict) -> dict:
    output = copy.deepcopy(instance)
    segments = [segment.replace("~1", "/").replace("~0", "~") for segment in patch["path"][1:].split("/")]
    target = output
    for segment in segments[:-1]:
        target = target[segment]
    if patch["op"] not in {"add", "replace"}:
        raise ValueError(f"Unsupported fixture patch operation: {patch['op']}")
    target[segments[-1]] = copy.deepcopy(patch["value"])
    return output


schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
positive = json.loads(POSITIVE_PATH.read_text(encoding="utf-8"))
fixtures = json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))
base_path = (REPO_ROOT / fixtures["baseInstance"]).resolve()
if not base_path.is_relative_to(REPO_ROOT.resolve()):
    raise ValueError("Fixture baseInstance escapes the repository root")
fixture_base = json.loads(base_path.read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)
positive_errors = list(validator.iter_errors(positive))
case_results = []
for case in fixtures["cases"]:
    patches = case.get("patches") or ([case["patch"]] if "patch" in case else [])
    if not patches:
        raise ValueError(f"Fixture case has no patch operation: {case['caseId']}")
    mutated = copy.deepcopy(fixture_base)
    for patch in patches:
        mutated = apply_patch(mutated, patch)
    actual_schema_valid = validator.is_valid(mutated)
    case_results.append({
        "caseId": case["caseId"],
        "declaredSchemaValid": case["expectedSchemaValid"],
        "actualSchemaValid": actual_schema_valid,
        "passed": actual_schema_valid == case["expectedSchemaValid"],
    })

result = {
    "schemaVersion": "v3-media-credential-contract-audit/v1",
    "schemaMetaValid": True,
    "positiveErrorCount": len(positive_errors),
    "caseCount": len(case_results),
    "schemaNegativeCount": sum(1 for case in fixtures["cases"] if not case["expectedSchemaValid"]),
    "semanticShapeValidCount": sum(1 for case in fixtures["cases"] if case["expectedSchemaValid"]),
    "failedCaseCount": sum(1 for case in case_results if not case["passed"]),
    "passed": not positive_errors and len(case_results) == 25 and all(case["passed"] for case in case_results),
}
print(json.dumps(result, ensure_ascii=True, indent=2))
raise SystemExit(0 if result["passed"] else 2)
