#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator


HERE = Path(__file__).resolve().parent
if (HERE / "15-internal-relay.schema.json").is_file():
    SCHEMA = HERE / "15-internal-relay.schema.json"
    FIXTURE = HERE / "16-internal-relay-fixtures.json"
else:
    ROOT = Path(__file__).resolve().parents[6]
    SCHEMA = ROOT / "docs/active/project/contracts/v3_media_capture_internal_relay_v1.schema.json"
    FIXTURE = ROOT / "docs/active/project/fixtures/v3-media-capture-internal-relay-fixtures.json"


def main() -> int:
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    errors = sorted(Draft202012Validator(schema).iter_errors(fixture["protocol"]), key=lambda item: list(item.path))

    negative = fixture["negativeCases"]
    expected_ids = {f"RLY-N{index:02d}" for index in range(1, 17)}
    actual_ids = {item["caseId"] for item in negative}
    allowed_failure_codes = set(fixture["protocol"]["failureCodes"])
    checks = {
        "schemaMetaValid": True,
        "positiveInstanceValid": not errors,
        "negativeCaseCount": len(negative) == 16,
        "negativeCaseIdsExact": actual_ids == expected_ids,
        "negativeCaseIdsUnique": len(actual_ids) == len(negative),
        "negativeFailureCodesClosed": all(item["expectedFailureCode"] in allowed_failure_codes for item in negative),
        "positiveTraceStepsExact": [item["step"] for item in fixture["positiveTrace"]] == list(range(1, 10)),
        "singleRuntimeInFlight": fixture["protocol"]["limits"]["runtimeMaxInFlightChunks"] == 1,
        "queueBounded": fixture["protocol"]["limits"]["maxQueuedChunks"] == 32
        and fixture["protocol"]["limits"]["maxQueuedBytes"] == 2_097_152,
        "runtimeLimitsNotExpanded": fixture["protocol"]["limits"]["maxChunkBytes"] <= 1_048_576
        and fixture["protocol"]["limits"]["maxCaptureMs"] == 900_000
        and fixture["protocol"]["limits"]["maxCaptureBytes"] == 536_870_912,
        "noSilentDrop": fixture["protocol"]["ordering"]["overflowBehavior"] == "abort_without_drop",
        "internalOnly": fixture["protocol"]["visibility"] == "extension_internal_only",
        "restartMarkerNonSecret": set(fixture["protocol"]["restartMarker"]["forbiddenFields"])
        == {"ticket", "streamId", "pcm", "sourceIdentity", "absolutePath"},
        "restartNeverResumes": fixture["protocol"]["restartMarker"]["restartBehavior"]
        == "emit_worker_restarted_verify_runtime_sink_zero_never_resume",
    }
    passed = all(checks.values())
    print(json.dumps({
        "schemaVersion": "v3-media-capture-internal-relay-verification/v1",
        "passed": passed,
        "checks": checks,
        "schemaErrors": [error.message for error in errors],
        "summary": {"total": len(checks), "passed": sum(checks.values()), "failed": len(checks) - sum(checks.values())},
    }, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
