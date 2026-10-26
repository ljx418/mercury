#!/usr/bin/env python3
"""Anti-false-green verifier for the V3 internal capture relay v7 contract."""
from __future__ import annotations
import base64, copy, hashlib, json
from datetime import datetime
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

HERE = Path(__file__).resolve().parent
LOCAL_SCHEMA = HERE / "15-internal-relay-v7.schema.json"
LOCAL_FIXTURES = HERE / "16-internal-relay-v7-fixtures.json"
if LOCAL_SCHEMA.exists() and LOCAL_FIXTURES.exists():
    SCHEMA, FIXTURES = LOCAL_SCHEMA, LOCAL_FIXTURES
else:
    ROOT = next((path for path in (HERE, *HERE.parents) if (path / "docs/active/project").is_dir()), None)
    if ROOT is None:
        raise SystemExit("repository root and flat audit payload were not found")
    SCHEMA = ROOT / "docs/active/project/contracts/v3_media_capture_internal_relay_v7.schema.json"
    FIXTURES = ROOT / "docs/active/project/fixtures/v3-media-capture-internal-relay-v7-fixtures.json"
schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema, format_checker=FormatChecker())
protocol, trace = fixtures["protocol"], fixtures["positiveTrace"]
restart_trace, negative = fixtures["restartRecoveryTrace"], fixtures["negativeCases"]
terminal_trace = fixtures["terminalFailureTrace"]
phase_recovery = fixtures["phaseRecoveryCases"]
terminal_cases = fixtures["terminalFailureCases"]
schema_errors = sorted(validator.iter_errors(protocol), key=lambda error: list(error.path))

EXPECTED_TRACE_SHA256 = "411446f92c3e6a831dc2359a6317891e450443d29a80b90113edbc9fb689573a"
EXPECTED_RESTART_TRACE_SHA256 = "050b12914c1f5509f7f23348b89feb601fcee6d0386a46946d47a8de5bcb8771"
EXPECTED_SCHEMA_SHA256 = "659ad26ea4b912429ac3cbe5be9088f943f5e4edf8e5927aaa6f3e9e9fcb6f0f"
EXPECTED_PROTOCOL_SHA256 = "a7f0890d0e2a68749b7e02e6a10e634f601e7aac2099e1dc7dba0868e602b8c6"
EXPECTED_TERMINAL_TRACE_SHA256 = "648118bf663a72b48cdd5d7273514fc5e3fce0741713a3fc7ce163a6765405a1"
EXPECTED_PHASE_RECOVERY_SHA256 = "1f6e45a9827aaf47d4aee5a8eec3ba804bc2e2ceb4cac1e5f34c6e0fa71dafa6"
EXPECTED_TERMINAL_CASES_SHA256 = "89dd0bb0f02189ef09c8da17282e7f3b7a3544caec82dfe79f3efd107193a300"
EXPECTED_NEGATIVE_SHA256 = "1c4c3e20f4f3b67637ef768fba6f5976ebf377041f2c09015e6aadd0202344f6"
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
boundary = protocol["boundaryFailureNormalization"]
source_inventory = set(boundary["sourceInventory"])
identity_shared = set(boundary["identityShared"])
rename_sources = set(boundary["renameMapping"])
public_only = set(boundary["publicOnlyNotEmittedOnRelayWire"])

checks = {
 "schemaMetaValid":True,
 "schemaAuthorityAllFieldsImmutable":digest(schema) == EXPECTED_SCHEMA_SHA256,
 "protocolAuthorityAllFieldsImmutable":digest(protocol) == EXPECTED_PROTOCOL_SHA256,
 "protocolAllInstancesSchemaValid":not schema_errors,
 "nineUniqueMessageVariantsExact":len(protocol["messageExamples"]) == 9 and {x["type"] for x in protocol["messageExamples"]} == {"start","chunk_credit","quiesce","abort","ready","chunk","quiesced","stopped","capture_error"},
 "unknownFailureCodeRejected":bool(list(validator.iter_errors(unknown_code))),
 "duplicateTenthMessageRejected":bool(list(validator.iter_errors(duplicate_tenth))),
 "allPositiveChunksCanonicalAndLengthExact":all(canonical_chunk(x) for x in protocol["messageExamples"] if x["type"] == "chunk") and all(canonical_chunk({"type":"chunk","pcmBase64":x["pcmBase64"],"rawByteLength":x["rawByteLength"]}) for x in trace if x["message"] == "chunk_base64"),
 "mismatchedDecodedLengthRejected":not canonical_chunk(mismatched),
 "nonCanonicalPaddingRejected":not canonical_chunk(noncanonical),
 "positiveTraceAllFieldsImmutable":digest(trace) == EXPECTED_TRACE_SHA256 and len(trace) == 24,
 "restartRecoveryAllFieldsImmutable":digest(restart_trace) == EXPECTED_RESTART_TRACE_SHA256 and len(restart_trace) == 8,
 "terminalFailureTraceAllFieldsImmutable":digest(terminal_trace) == EXPECTED_TERMINAL_TRACE_SHA256 and len(terminal_trace) == 6,
 "phaseRecoveryAllFieldsImmutable":digest(phase_recovery) == EXPECTED_PHASE_RECOVERY_SHA256 and len(phase_recovery) == 7,
 "terminalFailureCasesAllFieldsImmutable":digest(terminal_cases) == EXPECTED_TERMINAL_CASES_SHA256 and len(terminal_cases) == 5,
 "negativeSuiteAllFieldsImmutable":digest(negative) == EXPECTED_NEGATIVE_SHA256,
 "negativeIdsAndMappingAllThirtyExact":[x["caseId"] for x in negative] == [f"RLY7-N{i:02d}" for i in range(1,31)] and mapping == EXPECTED_FAILURES,
 "traceMarkerPhasesExact":[x["message"] for x in trace if x["message"].startswith("restart_marker_phase_")] == ["restart_marker_phase_runtime_started","restart_marker_phase_capturing","restart_marker_phase_draining","restart_marker_phase_cleanup_pending"],
 "traceForwardAckSequencesExact":[(x["message"],x["sequence"],x["rawByteLength"]) for x in trace if x["message"] in {"chunk_base64","runtime_binary_chunk","chunkAccepted"}] == [("chunk_base64",0,2),("runtime_binary_chunk",0,2),("chunkAccepted",0,2),("chunk_base64",1,2),("runtime_binary_chunk",1,2),("chunkAccepted",1,2)],
 "traceCreditsExact":[(x["acknowledgedSequence"],x["credit"]) for x in trace if x["message"] == "chunk_credit"] == [(-1,1),(0,1),(1,1)],
 "traceQuiescedStoppedAndStopBoundaryExact":trace[14]["outstandingRawBytes"] == 2 and trace[19]["tracksStopped"] is True and trace[19]["contextClosed"] is True and trace[21]["message"] == "runtime_stop_sent" and not any(x["message"] == "chunk_base64" for x in trace[22:]),
 "traceCleanupThreeZerosExact":[trace[22][k] for k in ("activeCaptureCount","residualRawAudioCount","privateTempAudioCount")] == [0,0,0],
 "markerFivePhasesSameIdentity":[x["phase"] for x in markers] == ["connecting","runtime_started","capturing","draining","cleanup_pending"] and len({x["captureSessionId"] for x in markers}) == len({x["taskId"] for x in markers}) == 1,
 "markerExpiryArithmeticAndNoRefresh":all((b-a).total_seconds() == 1080 for a,b in zip(started,expires)) and len(set(expires)) == 1,
 "senderSourceAndIncognitoResolutionExact":protocol["senderPolicy"] == {"minimumChromeVersion":116,"capability":"chrome.runtime.getContexts_required_no_runtime_downgrade","extensionId":"messageSender.id_equals_runtime.id","url":"messageSender.url_equals_runtime.getURL_offscreen","tab":"messageSender.tab_absent","frameId":"messageSender.frameId_absent_or_zero","documentId":"messageSender.documentId_required_nonempty_bind_first_reject_replacement","incognito":"runtime.getContexts_by_documentId_returns_exactly_one_OFFSCREEN_DOCUMENT_and_context.incognito_equals_chrome.extension.inIncognitoContext"},
 "terminalBoundaryExact":protocol["terminalBoundary"]["sinkFinalizeIsTerminal"] is False and protocol["terminalBoundary"]["failureInjectionPoints"] == ["after_sink_finalize","transcript_create","transcript_start","acquisition_complete","completed_frame_send"] and protocol["terminalBoundary"]["authoritativeTerminalCommit"] == "after_sink_finalize_transcript_create_transcript_start_and_acquisition_complete_returns_succeeded" and protocol["terminalBoundary"]["completedFrameSendFailure"] == "preserve_succeeded_task_cleanup_zero_background_GET_observes_same_terminal" and terminal_cases[-1]["expectedTaskState"] == "succeeded" and terminal_cases[-1]["expectedFailureCode"] is None,
 "restartTerminationOwnerAndNoPublicApiExact":protocol["restartTermination"]["owner"] == "runtime_websocket_handler_finally" and protocol["restartTermination"]["trigger"] == "any_handler_exit_after_valid_start" and protocol["restartTermination"]["publicApiChange"] == "none" and protocol["restartTermination"]["taskFailureMapping"]["completed_frame_send_after_authoritative_success"] == "preserve_succeeded_task_background_GET_terminal",
 "phaseRecoveryOwnersExact":[(x["phase"],x["runtimeState"],x["owner"]) for x in phase_recovery] == [("connecting","alive_before_valid_start","background_new_worker"),("runtime_started","alive_after_valid_start","runtime_websocket_handler_finally"),("capturing","alive_after_valid_start","runtime_websocket_handler_finally"),("draining","alive_after_valid_start","runtime_websocket_handler_finally"),("cleanup_pending","alive_after_valid_start","runtime_websocket_handler_finally"),("any","hard_crash_or_restarted","product_reattach_recovery"),("any","GET_404","background_new_worker")],
 "boundaryFailureNormalizationClosed":boundary["scope"] == "capture_grant_sink_controller_recovery_boundary_only_public_runtime_and_ui_codes_remain_unchanged" and len(boundary["targetInventory"]) == 20 and set(boundary["targetInventory"]) == set(protocol["failureCodes"]) and source_inventory == identity_shared | rename_sources | public_only and not (identity_shared & rename_sources or identity_shared & public_only or rename_sources & public_only) and set(boundary["renameMapping"].values()) <= set(boundary["targetInventory"]) and boundary["renameMapping"]["V3_MEDIA_CLEANUP_INCOMPLETE"] == "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE",
 "recoverEvidenceUsesExistingObservableContract":protocol["recoveryOwnership"]["runtime_hard_crash_restart"] == "existing_recover_returns_disposition_and_matching_authoritativeTaskId_cleanup_zero_is_guaranteed_by_recover_success_else_public_cleanup_error" and protocol["recoveryOwnership"]["recoverObservableEvidence"] == ["recover_http_success","disposition_published_or_abandoned","authoritativeTaskId_matches_marker","source_authority_terminal_or_published","fresh_begin_succeeds_single_sink"] and protocol["recoveryOwnership"]["publicApiChange"] == "none",
 "identityAndRevisionDomainsExact":protocol["identityAndRevisionPolicy"] == {"taskIdentity":"resolve_sourceAuthority_acquisition_transcript_outline_workspace_share_taskId_and_sourceIdentity_where_field_exists","consentRevision":"resolve_authority_and_acquisition_request_share_consentPolicyId_and_consentPolicyRevision","transcriptRevision":"independent_monotonic_transcript_projection_revision","productRevision":"outline_and_workspace_share_media_task_revision_with_expected_revision_fence","crossDomainRevisionEquality":"forbidden_transcript_consent_and_product_revisions_are_distinct_domains"},
 "restartTraceCleanupAndFreshStartExact":[restart_trace[1][k] for k in ("activeCaptureCount","residualRawAudioCount","privateTempAudioCount")] == [0,0,0] and restart_trace[2]["message"] == "internal_fail_capture_stream" and restart_trace[2]["failureCode"] == "V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED" and restart_trace[2]["publicApiCall"] is False and restart_trace[3]["message"] == "existing_get_observed_terminal" and restart_trace[3]["state"] == "failed" and restart_trace[-1] == {"step":8,"actor":"runtime","message":"fresh_started","freshCapture":True},
 "singleSinkInvariantExact":protocol["runtimeSinkInvariant"]["scope"] == "one_global_active_sink_per_runtime_process" and protocol["runtimeSinkInvariant"]["startedPrecondition"] == "RuntimeCaptureSink.begin_succeeded_with_no_prior_active_sink",
 "ownershipCapacityQuiesceExact":protocol["ordering"]["chunkOwnership"] == "local_queued_xor_credit_consumed_runtime_inflight" and protocol["ordering"]["capacityRule"] == "abort_before_enqueue_would_exceed_limit" and protocol["ordering"]["chunkRejectBoundary"] == "runtime_stop_sent",
 "capacityValuesExact":limits["maxRawChunkBytes"] == 49152 and limits["maxEncodedChunkChars"] == 65536 and limits["creditWindowChunks"] == limits["runtimeMaxInFlightChunks"] == 1 and limits["maxOutstandingChunks"] == 32 and limits["maxOutstandingRawBytes"] == 49152*32,
 "runtimeLimitsNotExpanded":limits["maxCaptureMs"] == 900000 and limits["maxCaptureBytes"] == 536870912,
}
failed = [k for k,v in checks.items() if not v]
result = {"schemaVersion":"v3-media-capture-internal-relay-v7-verification/v1","passed":not failed,"checks":checks,"schemaErrors":[e.message for e in schema_errors],"summary":{"total":len(checks),"passed":len(checks)-len(failed),"failed":len(failed)}}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result["passed"] else 2)
