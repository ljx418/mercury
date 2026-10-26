#!/usr/bin/env python3
"""Static verifier for the V3 internal capture relay v2 document contract."""

from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[5]
SCHEMA = ROOT / "docs/active/project/contracts/v3_media_capture_internal_relay_v2.schema.json"
FIXTURES = ROOT / "docs/active/project/fixtures/v3-media-capture-internal-relay-v2-fixtures.json"
if (HERE / "15-internal-relay-v2.schema.json").exists():
    SCHEMA = HERE / "15-internal-relay-v2.schema.json"
    FIXTURES = HERE / "16-internal-relay-v2-fixtures.json"

schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
errors = sorted(Draft202012Validator(schema).iter_errors(fixtures["protocol"]), key=lambda error: list(error.path))

protocol = fixtures["protocol"]
trace = fixtures["positiveTrace"]
negative = fixtures["negativeCases"]
expected_ids = [f"RLY2-N{index:02d}" for index in range(1, 25)]
expected_trace = [
    (1, "background", "restart_marker_write"),
    (2, "background", "runtime_start"),
    (3, "runtime", "started"),
    (4, "background", "start_with_streamId_once"),
    (5, "offscreen", "ready"),
    (6, "background", "chunk_credit"),
    (7, "offscreen", "chunk_base64"),
    (8, "background", "runtime_binary_chunk"),
    (9, "runtime", "chunkAccepted"),
    (10, "background", "chunk_credit"),
    (11, "background", "stop"),
    (12, "offscreen", "stopped_and_drained"),
    (13, "background", "runtime_stop_completed"),
    (14, "runtime", "completed_with_cleanup"),
    (15, "background", "restart_marker_clear"),
]
failure_by_mutation = {case["mutation"]: case["expectedFailureCode"] for case in negative}
limits = protocol["limits"]
marker = protocol["restartMarker"]
checks = {
    "schemaMetaValid": True,
    "positiveInstanceValid": not errors,
    "negativeCaseIdsExact": [case["caseId"] for case in negative] == expected_ids,
    "negativeCaseIdsUnique": len({case["caseId"] for case in negative}) == 24,
    "negativeFailureCodesClosed": all(case["expectedFailureCode"] in protocol["failureCodes"] for case in negative),
    "failureMappingExact": failure_by_mutation["duplicate_sequence"] == "V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID"
        and failure_by_mutation["base64_invalid"] == "V3_MEDIA_CAPTURE_CHUNK_INVALID"
        and failure_by_mutation["cleanup_timeout"] == "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE",
    "positiveTraceExact": [(item["step"], item["actor"], item["message"]) for item in trace] == expected_trace,
    "stopDrainFinalizeOrdered": [item["message"] for item in trace][10:15] == [
        "stop", "stopped_and_drained", "runtime_stop_completed", "completed_with_cleanup", "restart_marker_clear"
    ],
    "jsonPayloadEncoding": protocol["audioShape"]["payloadTransport"] == "base64_json_string",
    "base64CapacityExact": limits["maxRawChunkBytes"] * 4 // 3 == limits["maxEncodedChunkChars"],
    "singleCreditAndRuntimeInFlight": limits["creditWindowChunks"] == limits["runtimeMaxInFlightChunks"] == 1,
    "outstandingQueueBounded": limits["maxOutstandingChunks"] == 32
        and limits["maxOutstandingRawBytes"] == limits["maxRawChunkBytes"] * 32,
    "runtimeLimitsNotExpanded": limits["maxCaptureMs"] == 900000 and limits["maxCaptureBytes"] == 536870912,
    "noSilentDrop": protocol["ordering"]["overflowBehavior"] == "abort_without_drop",
    "streamIdOneShotOnly": protocol["streamIdPolicy"]["allowedMessage"] == "background_to_offscreen_start_once"
        and "storage" in protocol["streamIdPolicy"]["forbiddenLocations"],
    "senderPolicyClosed": set(protocol["senderPolicy"]) == {"extensionId", "url", "tab", "frameId", "documentId", "incognito"},
    "restartMarkerNonSecret": set(marker["fields"]) == {"schemaVersion", "captureSessionId", "taskId", "startedAt", "phase", "expiresAt"}
        and {"ticket", "grantId", "streamId", "pcm", "sourceIdentity", "absolutePath", "cookie", "apiKey"}.issubset(marker["forbiddenFields"]),
    "restartOwnershipHonest": marker["restartBehavior"] == "fail_old_task_wait_cleanup_grace_clear_marker_never_resume"
        and marker["sinkZeroEvidenceOwner"] == "runtime_finally_plus_real_integration_observer",
    "restartAccessAndExpiryFrozen": marker["accessLevel"] == "TRUSTED_CONTEXTS"
        and marker["maxRetentionMs"] == 1020000
        and len(marker["phaseValues"]) == 5,
}

failed = [name for name, passed in checks.items() if not passed]
result = {
    "schemaVersion": "v3-media-capture-internal-relay-v2-verification/v1",
    "passed": not failed,
    "checks": checks,
    "schemaErrors": [error.message for error in errors],
    "summary": {"total": len(checks), "passed": len(checks) - len(failed), "failed": len(failed)},
}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result["passed"] else 2)
