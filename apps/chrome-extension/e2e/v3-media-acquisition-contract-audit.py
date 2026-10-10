#!/usr/bin/env python3
"""Execute the V3-2 schema and semantic contract fixture suite."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SCHEMA = ROOT / "docs/active/project/contracts/v3_media_acquisition_contracts.schema.json"
DEFAULT_POLICY = ROOT / "docs/active/project/contracts/v3-media-acquisition-policy-registry.json"
DEFAULT_FIXTURES = ROOT / "docs/active/project/fixtures/v3-media-acquisition-contract-fixtures.json"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def transcript_hash(segments: list[dict[str, Any]]) -> str:
    payload = "".join(
        f"{segment['segmentId']}\t{segment['startMs']}\t{segment['endMs']}\t{segment['textSha256']}\n"
        for segment in segments
    )
    return sha256_text(payload)


def apply_patch(document: Any, patch: dict[str, Any]) -> Any:
    if patch.get("op") not in {"add", "replace"}:
        raise ValueError(f"unsupported patch op: {patch.get('op')}")
    result = copy.deepcopy(document)
    tokens = [token.replace("~1", "/").replace("~0", "~") for token in patch["path"].split("/")[1:]]
    parent = result
    for token in tokens[:-1]:
        parent = parent[int(token)] if isinstance(parent, list) else parent[token]
    leaf = tokens[-1]
    if isinstance(parent, list):
        index = int(leaf)
        if patch["op"] == "replace" and not 0 <= index < len(parent):
            raise IndexError(patch["path"])
        if patch["op"] == "add" and index == len(parent):
            parent.append(copy.deepcopy(patch["value"]))
        else:
            parent[index] = copy.deepcopy(patch["value"])
    else:
        if patch["op"] == "replace" and leaf not in parent:
            raise KeyError(patch["path"])
        parent[leaf] = copy.deepcopy(patch["value"])
    return result


def schema_failure(error: Any) -> str:
    codes = {
        "additionalProperties": "SCHEMA_ADDITIONAL_PROPERTY",
        "const": "SCHEMA_CONST_MISMATCH",
        "enum": "SCHEMA_ENUM_MISMATCH",
        "minLength": "SCHEMA_MIN_LENGTH",
        "pattern": "SCHEMA_PATTERN_MISMATCH",
    }
    if error.validator in codes:
        return codes[error.validator]
    for child in error.context:
        child_code = schema_failure(child)
        if child_code not in {"SCHEMA_TYPE", "SCHEMA_ONEOF", "SCHEMA_ANYOF"}:
            return child_code
    return f"SCHEMA_{str(error.validator).upper()}"


def semantic_failure(instance: dict[str, Any], policy: dict[str, Any]) -> str | None:
    task = instance["task"]
    acquisition = instance["acquisition"]
    capture = instance["captureGrant"]
    asr = instance["asr"]
    transcript = instance["transcript"]
    cleanup = instance["cleanup"]
    privacy = instance["privacyAudit"]
    attempts = acquisition["attempts"]

    if acquisition["taskId"] != task["taskId"] or transcript["taskId"] != task["taskId"] or cleanup["taskId"] != task["taskId"]:
        return "V3_MEDIA_CROSS_TASK_REUSE"
    if capture is not None and capture["taskId"] != task["taskId"]:
        return "V3_MEDIA_CAPTURE_GRANT_INVALID"
    if asr is not None and asr["taskId"] != task["taskId"]:
        return "V3_MEDIA_CROSS_TASK_REUSE"
    if acquisition["sourceIdentity"] != task["sourceIdentity"] or transcript["sourceIdentity"] != task["sourceIdentity"]:
        return "V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID"
    if transcript["acquisitionRecordId"] != acquisition["recordId"]:
        return "V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID"

    if [attempt["sequence"] for attempt in attempts] != list(range(1, len(attempts) + 1)):
        return "V3_MEDIA_ROUTE_ORDER_INVALID"
    previous_completed: datetime | None = None
    for attempt in attempts:
        started = parse_time(attempt["startedAt"])
        completed = parse_time(attempt["completedAt"])
        if started > completed or (previous_completed is not None and started < previous_completed):
            return "V3_MEDIA_ROUTE_ORDER_INVALID"
        previous_completed = completed
        if attempt["status"] == "failed" and attempt["failureCode"] is None:
            return "V3_MEDIA_ROUTE_ORDER_INVALID"
        if attempt["status"] == "succeeded" and attempt["failureCode"] is not None:
            return "V3_MEDIA_ROUTE_ORDER_INVALID"

    route_order = policy["routePolicy"]["orderedRoutes"]
    if [attempt["route"] for attempt in attempts] != route_order[: len(attempts)]:
        return "V3_MEDIA_ROUTE_ORDER_INVALID"
    successful = [index for index, attempt in enumerate(attempts) if attempt["status"] == "succeeded"]
    if len(successful) != 1 or successful[0] != len(attempts) - 1:
        return "V3_MEDIA_ROUTE_ORDER_INVALID"
    if acquisition["selectedRoute"] != attempts[successful[0]]["route"]:
        return "V3_MEDIA_ROUTE_ORDER_INVALID"
    expected_fallback: list[str] = []
    for attempt in attempts:
        code = attempt["failureCode"]
        if attempt["status"] == "failed" and code not in expected_fallback:
            expected_fallback.append(code)
    if acquisition["fallbackReasonCodes"] != expected_fallback:
        return "V3_MEDIA_ROUTE_ORDER_INVALID"

    credential_routes = {"credentialed_subtitle", "credentialed_media_asr"}
    for attempt in attempts:
        if attempt["route"] not in credential_routes:
            continue
        if task["credentialLeaseId"] is None or attempt["authorityClass"] != "credential_lease":
            return "V3_MEDIA_LEASE_REQUIRED"
        if attempt["authorityId"] != task["credentialLeaseId"]:
            return "V3_MEDIA_LEASE_TASK_MISMATCH"

    capture_attempts = [attempt for attempt in attempts if attempt["route"] == "trusted_tab_capture_asr"]
    if capture_attempts:
        if capture is None:
            return "V3_MEDIA_CAPTURE_GRANT_REQUIRED"
        capture_attempt = capture_attempts[0]
        if (
            task["captureGrantId"] != capture["grantId"]
            or capture_attempt["authorityId"] != capture["grantId"]
            or capture_attempt["authorityClass"] != "trusted_capture_grant"
            or capture["adapterId"] != task["adapterId"]
            or not capture["oneShot"]
            or capture["persisted"]
            or capture["state"] != "consumed"
        ):
            return "V3_MEDIA_CAPTURE_GRANT_INVALID"
        issued = parse_time(capture["issuedAt"])
        expires = parse_time(capture["expiresAt"])
        if (expires - issued).total_seconds() > policy["capturePolicy"]["grantTtlSeconds"] or parse_time(capture_attempt["startedAt"]) > expires:
            return "V3_MEDIA_CAPTURE_GRANT_EXPIRED"

    asr_routes = {"credentialed_media_asr", "trusted_tab_capture_asr"}
    selected_attempt = attempts[successful[0]]
    if acquisition["selectedRoute"] in asr_routes:
        if asr is None:
            return "V3_MEDIA_ASR_UNAVAILABLE"
        asr_policy = policy["localAsrPolicy"]
        if (
            asr["engineId"] != asr_policy["candidateEngine"]
            or asr["engineVersion"] != asr_policy["candidateVersion"]
            or asr["modelId"] != asr_policy["candidateModel"]
            or asr["deviceClass"] != asr_policy["candidateDevice"]
            or asr["computeType"] != asr_policy["candidateComputeType"]
            or not asr["executedLocally"]
            or asr["cloudUpload"]
        ):
            return "V3_MEDIA_ASR_UNAVAILABLE"
        if selected_attempt["artifactSha256"] is None or asr["inputArtifactSha256"] != selected_attempt["artifactSha256"]:
            return "V3_MEDIA_ASR_OUTPUT_INVALID"
        if asr["segmentCount"] != len(transcript["segments"]):
            return "V3_MEDIA_ASR_OUTPUT_INVALID"

    if transcript["route"] != acquisition["selectedRoute"]:
        return "V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID"
    segments = transcript["segments"]
    if not segments:
        return "V3_MEDIA_TRANSCRIPT_EMPTY"
    previous_end = 0
    for segment in segments:
        if segment["startMs"] < previous_end or segment["startMs"] >= segment["endMs"] or segment["endMs"] > transcript["durationMs"]:
            return "V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID"
        if sha256_text(segment["text"]) != segment["textSha256"]:
            return "V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID"
        previous_end = segment["endMs"]
    if transcript_hash(segments) != transcript["contentSha256"]:
        return "V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID"
    if acquisition["transcriptSha256"] != transcript["contentSha256"]:
        return "V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID"
    if asr is not None and asr["outputTranscriptSha256"] != transcript["contentSha256"]:
        return "V3_MEDIA_ASR_OUTPUT_INVALID"

    if task["state"] == "cancelled" and (acquisition["status"] == "succeeded" or selected_attempt["artifactSha256"] is not None):
        return "V3_MEDIA_CANCEL_NOT_HONORED"
    if task["state"] != acquisition["status"]:
        return "V3_MEDIA_TASK_INVALID"
    if task["state"] == "succeeded" and (task["failureCode"] is not None or acquisition["failureCode"] is not None):
        return "V3_MEDIA_TASK_INVALID"

    if cleanup["terminalState"] != task["state"]:
        return "V3_MEDIA_CLEANUP_INCOMPLETE"
    last_processing = max(
        [parse_time(attempt["completedAt"]) for attempt in attempts]
        + ([parse_time(asr["completedAt"])] if asr is not None else [])
    )
    cleanup_started = parse_time(cleanup["cleanupStartedAt"])
    cleanup_completed = parse_time(cleanup["cleanupCompletedAt"])
    terminal_at = parse_time(task["terminalAt"])
    residual_fields = (
        "cookieFileResidualCount", "temporaryMediaResidualCount", "rawAudioResidualCount",
        "rawVideoResidualCount", "activeCaptureCount", "privatePathDisclosureCount",
    )
    if (
        cleanup_started < last_processing
        or cleanup_completed < cleanup_started
        or cleanup_completed > terminal_at
        or not cleanup["passed"]
        or any(cleanup[field] != 0 for field in residual_fields)
    ):
        return "V3_MEDIA_CLEANUP_INCOMPLETE"

    rejected_bools = (
        "cookieValuePersisted", "cookieValueHashed", "cookieFilePathPublished", "rawAudioPublished",
        "rawVideoPublished", "accountIdentityPublished", "profilePathPublished", "genericRuntimeProxyUsed",
    )
    if any(privacy[field] for field in rejected_bools) or privacy["crossTaskArtifactReuseCount"] != 0 or privacy["publicSecretHitCount"] != 0:
        return "V3_MEDIA_PUBLIC_ARTIFACT_SECRET"
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--fixtures", type=Path, default=DEFAULT_FIXTURES)
    args = parser.parse_args()

    schema = load_json(args.schema.resolve())
    policy = load_json(args.policy.resolve())
    fixture_suite = load_json(args.fixtures.resolve())
    base_path = (ROOT / fixture_suite["baseInstance"]).resolve()
    if ROOT not in base_path.parents:
        raise ValueError("baseInstance escapes repository root")
    base = load_json(base_path)

    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    base_errors = sorted(validator.iter_errors(base), key=lambda error: list(error.absolute_path))
    base_semantic = None if base_errors else semantic_failure(base, policy)

    requirements = fixture_suite["requirements"]
    cases = fixture_suite["cases"]
    requirement_pairs = {(item["requirementId"], item["requirementKey"]) for item in requirements}
    requirement_by_id = {item["requirementId"]: item for item in requirements}
    case_pairs = {(case["requirementId"], requirement_by_id[case["requirementId"]]["requirementKey"]) for case in cases}
    declared_failure_codes = set(policy["failureCodes"])
    schema_failure_codes = set(schema["$defs"]["NonNullFailureCode"]["enum"])

    results = []
    for case in cases:
        candidate = apply_patch(base, case["patch"])
        errors = sorted(validator.iter_errors(candidate), key=lambda error: list(error.absolute_path))
        schema_valid = not errors
        actual_failure = schema_failure(errors[0]) if errors else semantic_failure(candidate, policy)
        passed = schema_valid == case["expectedSchemaValid"] and actual_failure == case["expectedFailureCode"]
        results.append({
            "caseId": case["caseId"],
            "requirementId": case["requirementId"],
            "expectedSchemaValid": case["expectedSchemaValid"],
            "actualSchemaValid": schema_valid,
            "expectedFailureCode": case["expectedFailureCode"],
            "actualFailureCode": actual_failure,
            "passed": passed,
        })

    checks = {
        "schemaMeta": True,
        "positiveSchemaErrors": len(base_errors),
        "positiveSemanticFailure": base_semantic,
        "requirementCount": len(requirements),
        "caseCount": len(cases),
        "requirementIdsUnique": len(requirement_by_id) == len(requirements),
        "caseIdsUnique": len({case["caseId"] for case in cases}) == len(cases),
        "requirementCasePairsEqual": requirement_pairs == case_pairs,
        "policySchemaFailureCodesEqual": declared_failure_codes == schema_failure_codes,
        "passedCases": sum(result["passed"] for result in results),
        "failedCases": sum(not result["passed"] for result in results),
    }
    passed = (
        checks["positiveSchemaErrors"] == 0
        and checks["positiveSemanticFailure"] is None
        and checks["requirementIdsUnique"]
        and checks["caseIdsUnique"]
        and checks["requirementCasePairsEqual"]
        and checks["policySchemaFailureCodesEqual"]
        and checks["failedCases"] == 0
    )
    output = {"schemaVersion": "v3-media-acquisition-contract-audit/v1", "passed": passed, "checks": checks, "results": results}
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
