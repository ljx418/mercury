#!/usr/bin/env python3
"""Static anti-false-green verifier for the V3 internal capture relay v3 contract."""

from __future__ import annotations

import base64
import json
from pathlib import Path

from jsonschema import Draft202012Validator


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[5]
SCHEMA = ROOT / "docs/active/project/contracts/v3_media_capture_internal_relay_v3.schema.json"
FIXTURES = ROOT / "docs/active/project/fixtures/v3-media-capture-internal-relay-v3-fixtures.json"
if (HERE / "15-internal-relay-v3.schema.json").exists():
    SCHEMA = HERE / "15-internal-relay-v3.schema.json"
    FIXTURES = HERE / "16-internal-relay-v3-fixtures.json"

schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
schema_errors = sorted(Draft202012Validator(schema).iter_errors(fixtures["protocol"]), key=lambda error: list(error.path))
protocol = fixtures["protocol"]
trace = fixtures["positiveTrace"]
negative = fixtures["negativeCases"]

expected_trace = [
    (1,"background","restart_marker_write","connecting"),(2,"background","runtime_start","connecting"),
    (3,"runtime","started","runtime_started"),(4,"background","restart_marker_phase_runtime_started","runtime_started"),
    (5,"background","start_with_streamId_once","runtime_started"),(6,"offscreen","ready","capturing"),
    (7,"background","chunk_credit","capturing"),(8,"offscreen","chunk_base64","capturing"),
    (9,"background","runtime_binary_chunk","capturing"),(10,"runtime","chunkAccepted","capturing"),
    (11,"background","chunk_credit","capturing"),(12,"background","quiesce","draining"),
    (13,"offscreen","quiesced","draining"),(14,"offscreen","chunk_base64","draining"),
    (15,"background","runtime_binary_chunk","draining"),(16,"runtime","chunkAccepted","draining"),
    (17,"background","chunk_credit","draining"),(18,"offscreen","stopped","draining"),
    (19,"background","runtime_stop_completed","cleanup_pending"),(20,"runtime","completed_with_cleanup","finalized"),
    (21,"background","restart_marker_clear","finalized")
]
expected_mapping = {
    "sender_id_mismatch":"V3_MEDIA_CAPTURE_PORT_FORBIDDEN","sender_url_mismatch":"V3_MEDIA_CAPTURE_PORT_FORBIDDEN",
    "sender_has_tab":"V3_MEDIA_CAPTURE_PORT_FORBIDDEN","sender_frame_nonzero":"V3_MEDIA_CAPTURE_PORT_FORBIDDEN",
    "sender_document_missing_or_replaced":"V3_MEDIA_CAPTURE_PORT_FORBIDDEN","sender_incognito_mismatch":"V3_MEDIA_CAPTURE_PORT_FORBIDDEN",
    "chunk_before_runtime_started":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID","first_sequence_is_one":"V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID",
    "duplicate_sequence":"V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID","sequence_gap":"V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID",
    "base64_noncanonical_or_invalid":"V3_MEDIA_CAPTURE_CHUNK_INVALID","decoded_length_mismatch":"V3_MEDIA_CAPTURE_CHUNK_INVALID",
    "raw_chunk_odd_or_exceeds_49152":"V3_MEDIA_CAPTURE_CHUNK_INVALID","encoded_chunk_exceeds_65536":"V3_MEDIA_CAPTURE_CHUNK_INVALID",
    "chunk_without_credit":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID","enqueue_would_exceed_32_chunks":"V3_MEDIA_CAPTURE_BACKPRESSURE",
    "enqueue_would_exceed_1572864_raw_bytes":"V3_MEDIA_CAPTURE_BACKPRESSURE","runtime_ack_timeout":"V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED",
    "port_disconnect":"V3_MEDIA_CAPTURE_PORT_DISCONNECTED","service_worker_restart_with_marker":"V3_MEDIA_CAPTURE_WORKER_RESTARTED",
    "chunk_after_runtime_stop_sent":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID","cleanup_timeout":"V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE",
    "second_start_message":"V3_MEDIA_CAPTURE_STREAM_INVALID","streamId_reused_after_getUserMedia_settle":"V3_MEDIA_CAPTURE_STREAM_INVALID",
    "streamId_reused_after_abort":"V3_MEDIA_CAPTURE_STREAM_INVALID","streamId_in_chunk_or_credit":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID",
    "streamId_in_log":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID","streamId_in_marker_or_storage":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID",
    "abort_receipt_missing_after_disconnect":"V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE","marker_phase_or_expiry_invalid":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID"
}

def canonical_base64(value: str, expected_length: int) -> bool:
    try:
        decoded = base64.b64decode(value, validate=True)
    except Exception:
        return False
    return len(decoded) == expected_length and base64.b64encode(decoded).decode("ascii") == value

chunk_messages = [item for item in protocol["messageExamples"] if item["type"] == "chunk"]
trace_chunks = [item for item in trace if item["message"] == "chunk_base64"]
limits = protocol["limits"]
marker = protocol["restartMarker"]
observed_mapping = {case["mutation"]: case["expectedFailureCode"] for case in negative}
checks = {
    "schemaMetaValid": True,
    "protocolAndMessageExamplesValid": not schema_errors,
    "allNineMessageVariantsPresent": {item["type"] for item in protocol["messageExamples"]} == {"start","chunk_credit","quiesce","abort","ready","chunk","quiesced","stopped","capture_error"},
    "messageObjectsRejectAdditionalFields": all(schema["$defs"][name]["additionalProperties"] is False for name in ("start","credit","quiesce","abort","ready","chunk","quiesced","stopped","captureError")),
    "canonicalBase64AndDecodedLength": all(canonical_base64(item["pcmBase64"], item["rawByteLength"]) for item in chunk_messages + trace_chunks),
    "negativeCaseIdsExact": [case["caseId"] for case in negative] == [f"RLY3-N{index:02d}" for index in range(1,31)],
    "failureMappingAllThirtyExact": observed_mapping == expected_mapping,
    "negativeFailureCodesClosed": all(code in protocol["failureCodes"] for code in observed_mapping.values()),
    "positiveTraceAllFieldsExact": [(item["step"],item["actor"],item["message"],item["requiredState"]) for item in trace] == expected_trace,
    "captureAndDrainSequencesExact": [(item["sequence"],item["rawByteLength"]) for item in trace_chunks] == [(0,2),(1,2)],
    "creditSequenceExact": [(item["acknowledgedSequence"],item["credit"]) for item in trace if item["message"] == "chunk_credit"] == [(-1,1),(0,1),(1,1)],
    "quiesceDrainFinalizeExact": [item["message"] for item in trace][11:21] == ["quiesce","quiesced","chunk_base64","runtime_binary_chunk","chunkAccepted","chunk_credit","stopped","runtime_stop_completed","completed_with_cleanup","restart_marker_clear"],
    "cleanupReceiptZeroExact": trace[19]["activeCaptureCount"] == 0 and trace[19]["residualRawAudioCount"] == 0,
    "jsonCapacityExact": limits["maxRawChunkBytes"] == 49152 and limits["maxEncodedChunkChars"] == 65536,
    "singleCreditAndBoundedOutstanding": limits["creditWindowChunks"] == limits["runtimeMaxInFlightChunks"] == 1 and limits["maxOutstandingChunks"] == 32 and limits["maxOutstandingRawBytes"] == 49152 * 32,
    "ownershipAndCapacitySemanticsExact": protocol["ordering"]["chunkOwnership"] == "local_queued_xor_credit_consumed_runtime_inflight" and protocol["ordering"]["capacityRule"] == "abort_before_enqueue_would_exceed_limit",
    "quiesceBoundaryExact": protocol["ordering"]["quiesceRule"] == "stop_audio_source_then_drain_existing_queue_under_credit" and protocol["ordering"]["chunkRejectBoundary"] == "runtime_stop_sent",
    "streamIdExactlyOnceAndForbidden": protocol["streamIdPolicy"]["allowedMessage"] == "background_to_offscreen_start_exactly_once" and set(protocol["streamIdPolicy"]["forbiddenLocations"]) == {"chunk","credit","log","restartMarker","storage","publicEvidence"},
    "senderSixRulesExact": set(protocol["senderPolicy"]) == {"extensionId","url","tab","frameId","documentId","incognito"} and protocol["senderPolicy"]["documentId"].startswith("required_nonempty"),
    "markerFieldsAndPhasesExact": marker["fields"] == ["schemaVersion","captureSessionId","taskId","startedAt","phase","expiresAt"] and marker["phaseValues"] == ["connecting","runtime_started","capturing","draining","cleanup_pending"] and marker["phaseTransitions"] == ["connecting->runtime_started","runtime_started->capturing","capturing->draining","draining->cleanup_pending"],
    "markerExpiryAndAccessExact": marker["accessLevel"] == "TRUSTED_CONTEXTS" and marker["expiryRule"] == "set_once_startedAt_plus_1080000_never_refresh" and marker["maxRetentionMs"] == 1080000,
    "markerSecretsForbidden": {"ticket","grantId","streamId","pcm","sourceIdentity","absolutePath","cookie","apiKey"}.issubset(marker["forbiddenFields"]),
    "runtimeSingleSinkEvidenceExact": protocol["runtimeSinkInvariant"]["scope"] == "one_global_active_sink_per_runtime_process" and protocol["runtimeSinkInvariant"]["observerChecks"] == ["old_task_cleanup_receipt_activeCaptureCount_zero","old_task_residualRawAudioCount_zero","old_task_private_temp_audio_count_zero","fresh_capture_receives_started"],
    "runtimeLimitsNotExpanded": limits["maxCaptureMs"] == 900000 and limits["maxCaptureBytes"] == 536870912,
}

failed = [name for name, passed in checks.items() if not passed]
result = {"schemaVersion":"v3-media-capture-internal-relay-v3-verification/v1","passed":not failed,"checks":checks,"schemaErrors":[error.message for error in schema_errors],"summary":{"total":len(checks),"passed":len(checks)-len(failed),"failed":len(failed)}}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result["passed"] else 2)
