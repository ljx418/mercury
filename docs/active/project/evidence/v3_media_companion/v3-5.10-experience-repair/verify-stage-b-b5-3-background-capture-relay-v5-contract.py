#!/usr/bin/env python3
"""Anti-false-green verifier for the V3 internal capture relay v5 contract."""
from __future__ import annotations
import base64, copy, hashlib, json
from datetime import datetime
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

HERE = Path(__file__).resolve().parent
LOCAL_SCHEMA = HERE / "15-internal-relay-v5.schema.json"
LOCAL_FIXTURES = HERE / "16-internal-relay-v5-fixtures.json"
if LOCAL_SCHEMA.exists() and LOCAL_FIXTURES.exists():
    SCHEMA, FIXTURES = LOCAL_SCHEMA, LOCAL_FIXTURES
else:
    ROOT = next((path for path in (HERE, *HERE.parents) if (path / "docs/active/project").is_dir()), None)
    if ROOT is None:
        raise SystemExit("repository root and flat audit payload were not found")
    SCHEMA = ROOT / "docs/active/project/contracts/v3_media_capture_internal_relay_v5.schema.json"
    FIXTURES = ROOT / "docs/active/project/fixtures/v3-media-capture-internal-relay-v5-fixtures.json"
schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema, format_checker=FormatChecker())
protocol, trace = fixtures["protocol"], fixtures["positiveTrace"]
restart_trace, negative = fixtures["restartRecoveryTrace"], fixtures["negativeCases"]
schema_errors = sorted(validator.iter_errors(protocol), key=lambda error: list(error.path))

EXPECTED_TRACE_SHA256 = "411446f92c3e6a831dc2359a6317891e450443d29a80b90113edbc9fb689573a"
EXPECTED_RESTART_TRACE_SHA256 = "050b12914c1f5509f7f23348b89feb601fcee6d0386a46946d47a8de5bcb8771"
EXPECTED_NEGATIVE_SHA256 = "c5f6d397d842256ab9b6e992467e167c7b057746f9e90224295601424b0f4335"
EXPECTED_FAILURES = {
    "sender_id_mismatch":"V3_MEDIA_CAPTURE_PORT_FORBIDDEN","sender_url_mismatch":"V3_MEDIA_CAPTURE_PORT_FORBIDDEN","sender_has_tab":"V3_MEDIA_CAPTURE_PORT_FORBIDDEN","sender_frame_nonzero":"V3_MEDIA_CAPTURE_PORT_FORBIDDEN","sender_document_missing_or_replaced":"V3_MEDIA_CAPTURE_PORT_FORBIDDEN","sender_incognito_mismatch":"V3_MEDIA_CAPTURE_PORT_FORBIDDEN",
    "chunk_before_runtime_started":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID","first_sequence_is_one":"V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID","duplicate_sequence":"V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID","sequence_gap":"V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID","base64_noncanonical_or_invalid":"V3_MEDIA_CAPTURE_CHUNK_INVALID","decoded_length_mismatch":"V3_MEDIA_CAPTURE_CHUNK_INVALID","raw_chunk_odd_or_exceeds_49152":"V3_MEDIA_CAPTURE_CHUNK_INVALID","encoded_chunk_exceeds_65536":"V3_MEDIA_CAPTURE_CHUNK_INVALID","chunk_without_credit":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID","enqueue_would_exceed_32_chunks":"V3_MEDIA_CAPTURE_BACKPRESSURE","enqueue_would_exceed_1572864_raw_bytes":"V3_MEDIA_CAPTURE_BACKPRESSURE","runtime_ack_timeout":"V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED","port_disconnect":"V3_MEDIA_CAPTURE_PORT_DISCONNECTED","service_worker_restart_with_marker":"V3_MEDIA_CAPTURE_WORKER_RESTARTED","chunk_after_runtime_stop_sent":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID","cleanup_timeout":"V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE","second_start_message":"V3_MEDIA_CAPTURE_STREAM_INVALID","streamId_reused_after_getUserMedia_settle":"V3_MEDIA_CAPTURE_STREAM_INVALID","streamId_reused_after_abort":"V3_MEDIA_CAPTURE_STREAM_INVALID","streamId_in_chunk_or_credit":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID","streamId_in_log":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID","streamId_in_marker_or_storage":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID","abort_receipt_missing_after_disconnect":"V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE","marker_phase_or_expiry_invalid":"V3_MEDIA_CAPTURE_PROTOCOL_INVALID"
}

def digest(value: object) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()

def canonical_chunk(message: dict) -> bool:
    if message.get("type") != "chunk": return True
    try: decoded = base64.b64decode(message["pcmBase64"], validate=True)
    except Exception: return False
    return len(decoded) == message["rawByteLength"] and len(decoded) % 2 == 0 and base64.b64encode(decoded).decode("ascii") == message["pcmBase64"]

unknown_code = copy.deepcopy(protocol)
next(x for x in unknown_code["messageExamples"] if x["type"] == "capture_error")["failureCode"] = "V3_MEDIA_CAPTURE_NOT_DECLARED"
duplicate_tenth = copy.deepcopy(protocol); duplicate_tenth["messageExamples"].append(copy.deepcopy(duplicate_tenth["messageExamples"][0]))
mismatched = copy.deepcopy(next(x for x in protocol["messageExamples"] if x["type"] == "chunk")); mismatched["rawByteLength"] = 4
noncanonical = copy.deepcopy(mismatched); noncanonical["rawByteLength"], noncanonical["pcmBase64"] = 2, "AAB="
markers = protocol["restartMarkerInstances"]
started = [datetime.fromisoformat(x["startedAt"].replace("Z", "+00:00")) for x in markers]
expires = [datetime.fromisoformat(x["expiresAt"].replace("Z", "+00:00")) for x in markers]
mapping = {x["mutation"]: x["expectedFailureCode"] for x in negative}
limits = protocol["limits"]

checks = {
 "schemaMetaValid":True,
 "protocolAllInstancesSchemaValid":not schema_errors,
 "nineUniqueMessageVariantsExact":len(protocol["messageExamples"]) == 9 and {x["type"] for x in protocol["messageExamples"]} == {"start","chunk_credit","quiesce","abort","ready","chunk","quiesced","stopped","capture_error"},
 "unknownFailureCodeRejected":bool(list(validator.iter_errors(unknown_code))),
 "duplicateTenthMessageRejected":bool(list(validator.iter_errors(duplicate_tenth))),
 "allPositiveChunksCanonicalAndLengthExact":all(canonical_chunk(x) for x in protocol["messageExamples"] if x["type"] == "chunk") and all(canonical_chunk({"type":"chunk","pcmBase64":x["pcmBase64"],"rawByteLength":x["rawByteLength"]}) for x in trace if x["message"] == "chunk_base64"),
 "mismatchedDecodedLengthRejected":not canonical_chunk(mismatched),
 "nonCanonicalPaddingRejected":not canonical_chunk(noncanonical),
 "positiveTraceAllFieldsImmutable":digest(trace) == EXPECTED_TRACE_SHA256 and len(trace) == 24,
 "restartRecoveryAllFieldsImmutable":digest(restart_trace) == EXPECTED_RESTART_TRACE_SHA256 and len(restart_trace) == 8,
 "negativeSuiteAllFieldsImmutable":digest(negative) == EXPECTED_NEGATIVE_SHA256,
 "negativeIdsAndMappingAllThirtyExact":[x["caseId"] for x in negative] == [f"RLY5-N{i:02d}" for i in range(1,31)] and mapping == EXPECTED_FAILURES,
 "traceMarkerPhasesExact":[x["message"] for x in trace if x["message"].startswith("restart_marker_phase_")] == ["restart_marker_phase_runtime_started","restart_marker_phase_capturing","restart_marker_phase_draining","restart_marker_phase_cleanup_pending"],
 "traceForwardAckSequencesExact":[(x["message"],x["sequence"],x["rawByteLength"]) for x in trace if x["message"] in {"chunk_base64","runtime_binary_chunk","chunkAccepted"}] == [("chunk_base64",0,2),("runtime_binary_chunk",0,2),("chunkAccepted",0,2),("chunk_base64",1,2),("runtime_binary_chunk",1,2),("chunkAccepted",1,2)],
 "traceCreditsExact":[(x["acknowledgedSequence"],x["credit"]) for x in trace if x["message"] == "chunk_credit"] == [(-1,1),(0,1),(1,1)],
 "traceQuiescedStoppedAndStopBoundaryExact":trace[14]["outstandingRawBytes"] == 2 and trace[19]["tracksStopped"] is True and trace[19]["contextClosed"] is True and trace[21]["message"] == "runtime_stop_sent" and not any(x["message"] == "chunk_base64" for x in trace[22:]),
 "traceCleanupThreeZerosExact":[trace[22][k] for k in ("activeCaptureCount","residualRawAudioCount","privateTempAudioCount")] == [0,0,0],
 "markerFivePhasesSameIdentity":[x["phase"] for x in markers] == ["connecting","runtime_started","capturing","draining","cleanup_pending"] and len({x["captureSessionId"] for x in markers}) == len({x["taskId"] for x in markers}) == 1,
 "markerExpiryArithmeticAndNoRefresh":all((b-a).total_seconds() == 1080 for a,b in zip(started,expires)) and len(set(expires)) == 1,
 "senderSourceAndIncognitoResolutionExact":protocol["senderPolicy"] == {"minimumChromeVersion":116,"capability":"chrome.runtime.getContexts_required_no_runtime_downgrade","extensionId":"messageSender.id_equals_runtime.id","url":"messageSender.url_equals_runtime.getURL_offscreen","tab":"messageSender.tab_absent","frameId":"messageSender.frameId_absent_or_zero","documentId":"messageSender.documentId_required_nonempty_bind_first_reject_replacement","incognito":"runtime.getContexts_by_documentId_returns_exactly_one_OFFSCREEN_DOCUMENT_and_context.incognito_equals_chrome.extension.inIncognitoContext"},
 "restartTerminationOwnerAndNoPublicApiExact":protocol["restartTermination"] == {"owner":"runtime_websocket_handler_finally","trigger":"unexpected_websocket_disconnect_after_valid_start_before_terminal","cleanup":"RuntimeCaptureSink.abort_then_require_three_zero_receipt","operation":"MediaAcquisitionCoordinator.fail_capture_stream_internal_call","taskIdSource":"validated_start.taskId","taskFailureCode":"V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED","idempotency":"terminal_returns_same_task_nonterminal_transitions_once_cleanup_failure_wins","newWorkerRole":"poll_existing_GET_acquisition_until_terminal_wait_cleanup_grace_clear_marker_never_write_task","publicApiChange":"none"},
 "restartTraceCleanupAndFreshStartExact":[restart_trace[1][k] for k in ("activeCaptureCount","residualRawAudioCount","privateTempAudioCount")] == [0,0,0] and restart_trace[2]["message"] == "internal_fail_capture_stream" and restart_trace[2]["failureCode"] == "V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED" and restart_trace[2]["publicApiCall"] is False and restart_trace[3]["message"] == "existing_get_observed_terminal" and restart_trace[3]["state"] == "failed" and restart_trace[-1] == {"step":8,"actor":"runtime","message":"fresh_started","freshCapture":True},
 "singleSinkInvariantExact":protocol["runtimeSinkInvariant"]["scope"] == "one_global_active_sink_per_runtime_process" and protocol["runtimeSinkInvariant"]["startedPrecondition"] == "RuntimeCaptureSink.begin_succeeded_with_no_prior_active_sink",
 "ownershipCapacityQuiesceExact":protocol["ordering"]["chunkOwnership"] == "local_queued_xor_credit_consumed_runtime_inflight" and protocol["ordering"]["capacityRule"] == "abort_before_enqueue_would_exceed_limit" and protocol["ordering"]["chunkRejectBoundary"] == "runtime_stop_sent",
 "capacityValuesExact":limits["maxRawChunkBytes"] == 49152 and limits["maxEncodedChunkChars"] == 65536 and limits["creditWindowChunks"] == limits["runtimeMaxInFlightChunks"] == 1 and limits["maxOutstandingChunks"] == 32 and limits["maxOutstandingRawBytes"] == 49152*32,
 "runtimeLimitsNotExpanded":limits["maxCaptureMs"] == 900000 and limits["maxCaptureBytes"] == 536870912,
}
failed = [k for k,v in checks.items() if not v]
result = {"schemaVersion":"v3-media-capture-internal-relay-v5-verification/v1","passed":not failed,"checks":checks,"schemaErrors":[e.message for e in schema_errors],"summary":{"total":len(checks),"passed":len(checks)-len(failed),"failed":len(failed)}}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result["passed"] else 2)
