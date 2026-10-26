#!/usr/bin/env python3
"""Anti-false-green verifier for the V3 internal capture relay v8 contract."""
from __future__ import annotations

import base64
import copy
import hashlib
import json
import os
from datetime import datetime
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


HERE = Path(__file__).resolve().parent
LOCAL_SCHEMA = HERE / "15-internal-relay-v8.schema.json"
LOCAL_FIXTURES = HERE / "16-internal-relay-v8-fixtures.json"
ROOT = next(
    (
        path
        for path in (
            Path(os.environ["NAVIA_REPO_ROOT"]).resolve()
            if os.environ.get("NAVIA_REPO_ROOT")
            else HERE,
            HERE,
            *HERE.parents,
        )
        if (path / "docs/active/project").is_dir()
    ),
    None,
)
if LOCAL_SCHEMA.exists() and LOCAL_FIXTURES.exists():
    SCHEMA, FIXTURES = LOCAL_SCHEMA, LOCAL_FIXTURES
elif ROOT is not None:
    SCHEMA = ROOT / "docs/active/project/contracts/v3_media_capture_internal_relay_v8.schema.json"
    FIXTURES = ROOT / "docs/active/project/fixtures/v3-media-capture-internal-relay-v8-fixtures.json"
else:
    raise SystemExit("repository root and flat audit payload were not found")


def digest(value: object) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_chunk(message: dict) -> bool:
    if message.get("type") != "chunk":
        return True
    try:
        decoded = base64.b64decode(message.get("pcmBase64", ""), validate=True)
    except Exception:
        return False
    return (
        len(decoded) == message.get("rawByteLength")
        and len(decoded) % 2 == 0
        and base64.b64encode(decoded).decode("ascii") == message.get("pcmBase64")
    )


schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema, format_checker=FormatChecker())
protocol = fixtures.get("protocol", {})
trace = fixtures.get("positiveTrace", [])
restart_trace = fixtures.get("restartRecoveryTrace", [])
phase_recovery = fixtures.get("phaseRecoveryCases", [])
negative = fixtures.get("negativeCases", [])
handoff_trace = fixtures.get("handoffFailureTrace", [])
handoff_cases = fixtures.get("handoffFailureCases", [])
source_evidence = fixtures.get("sourceInventoryEvidence", {})
schema_errors = sorted(validator.iter_errors(protocol), key=lambda error: list(error.path))

EXPECTED = {
    "schema": "e110416a132e5d6c4303af46e2a678803db9aef80a6f7aa2605f8bebc8f8d92d",
    "protocol": "415dbfad3e52dca21133b97275e157b8fc458fee46f47ca934cce1a842595b55",
    "positive": "411446f92c3e6a831dc2359a6317891e450443d29a80b90113edbc9fb689573a",
    "restart": "050b12914c1f5509f7f23348b89feb601fcee6d0386a46946d47a8de5bcb8771",
    "phase": "6f96615abaeb4f458625e91f6ba937c5626cdb4cbd183a2ec8e74fca1648cb37",
    "negative": "d69844e4d66a9e9e8d11a3dd6297e0658155c76c3fcb74aba95d7e0c35b0cb21",
    "handoffTrace": "d60ab20a24a79ff8521dcb7b098c2a557734708d2c73f950f150d005b116a933",
    "handoffCases": "d9e9e92616e25be8a957fdbb9df27f987fce9fed993588b68c1b55f4c966d532",
    "sourceEvidence": "f730f703af3a7a3361429c66e2e53c2139965ef326e22fa53248cefc6cc59014",
}
EXPECTED_FAILURES = {
    "sender_id_mismatch": "V3_MEDIA_CAPTURE_PORT_FORBIDDEN",
    "sender_url_mismatch": "V3_MEDIA_CAPTURE_PORT_FORBIDDEN",
    "sender_has_tab": "V3_MEDIA_CAPTURE_PORT_FORBIDDEN",
    "sender_frame_nonzero": "V3_MEDIA_CAPTURE_PORT_FORBIDDEN",
    "sender_document_missing_or_replaced": "V3_MEDIA_CAPTURE_PORT_FORBIDDEN",
    "sender_incognito_mismatch": "V3_MEDIA_CAPTURE_PORT_FORBIDDEN",
    "chunk_before_runtime_started": "V3_MEDIA_CAPTURE_PROTOCOL_INVALID",
    "first_sequence_is_one": "V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID",
    "duplicate_sequence": "V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID",
    "sequence_gap": "V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID",
    "base64_noncanonical_or_invalid": "V3_MEDIA_CAPTURE_CHUNK_INVALID",
    "decoded_length_mismatch": "V3_MEDIA_CAPTURE_CHUNK_INVALID",
    "raw_chunk_odd_or_exceeds_49152": "V3_MEDIA_CAPTURE_CHUNK_INVALID",
    "encoded_chunk_exceeds_65536": "V3_MEDIA_CAPTURE_CHUNK_INVALID",
    "chunk_without_credit": "V3_MEDIA_CAPTURE_PROTOCOL_INVALID",
    "enqueue_would_exceed_32_chunks": "V3_MEDIA_CAPTURE_BACKPRESSURE",
    "enqueue_would_exceed_1572864_raw_bytes": "V3_MEDIA_CAPTURE_BACKPRESSURE",
    "runtime_ack_timeout": "V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED",
    "port_disconnect": "V3_MEDIA_CAPTURE_PORT_DISCONNECTED",
    "service_worker_restart_with_marker": "V3_MEDIA_CAPTURE_WORKER_RESTARTED",
    "chunk_after_runtime_stop_sent": "V3_MEDIA_CAPTURE_PROTOCOL_INVALID",
    "cleanup_timeout": "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE",
    "second_start_message": "V3_MEDIA_CAPTURE_STREAM_INVALID",
    "streamId_reused_after_getUserMedia_settle": "V3_MEDIA_CAPTURE_STREAM_INVALID",
    "streamId_reused_after_abort": "V3_MEDIA_CAPTURE_STREAM_INVALID",
    "streamId_in_chunk_or_credit": "V3_MEDIA_CAPTURE_PROTOCOL_INVALID",
    "streamId_in_log": "V3_MEDIA_CAPTURE_PROTOCOL_INVALID",
    "streamId_in_marker_or_storage": "V3_MEDIA_CAPTURE_PROTOCOL_INVALID",
    "abort_receipt_missing_after_disconnect": "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE",
    "marker_phase_or_expiry_invalid": "V3_MEDIA_CAPTURE_PROTOCOL_INVALID",
}

unknown_code = copy.deepcopy(protocol)
examples = unknown_code.get("messageExamples", [])
capture_error = next((item for item in examples if item.get("type") == "capture_error"), None)
if capture_error is not None:
    capture_error["failureCode"] = "V3_MEDIA_CAPTURE_NOT_DECLARED"
duplicate_tenth = copy.deepcopy(protocol)
if duplicate_tenth.get("messageExamples"):
    duplicate_tenth["messageExamples"].append(copy.deepcopy(duplicate_tenth["messageExamples"][0]))
mismatched = copy.deepcopy(next((x for x in protocol.get("messageExamples", []) if x.get("type") == "chunk"), {}))
mismatched["rawByteLength"] = 4
noncanonical = copy.deepcopy(mismatched)
noncanonical["rawByteLength"], noncanonical["pcmBase64"] = 2, "AAB="

boundary = protocol.get("boundaryFailureNormalization", {})
source_inventory = set(boundary.get("sourceInventory", []))
target_inventory = set(boundary.get("targetInventory", []))
identity_shared = set(boundary.get("identityShared", []))
rename_mapping = boundary.get("renameMapping", {})
rename_sources = set(rename_mapping)
public_only = set(boundary.get("publicOnlyNotEmittedOnRelayWire", []))
handoff = protocol.get("captureHandoffBoundary", {})
ownership = protocol.get("artifactOwnershipPolicy", {})
revision = protocol.get("identityAndRevisionPolicy", {})
markers = protocol.get("restartMarkerInstances", [])
started = [datetime.fromisoformat(x["startedAt"].replace("Z", "+00:00")) for x in markers]
expires = [datetime.fromisoformat(x["expiresAt"].replace("Z", "+00:00")) for x in markers]
negative_mapping = {x.get("mutation"): x.get("expectedFailureCode") for x in negative}

source_files_valid = True
source_codes_present = True
if ROOT is not None:
    for item in source_evidence.get("files", []):
        path = ROOT / item.get("path", "")
        source_files_valid &= path.is_file() and file_digest(path) == item.get("sha256")
    source_text = "\n".join(
        (ROOT / item["path"]).read_text(encoding="utf-8")
        for item in source_evidence.get("files", [])
        if (ROOT / item.get("path", "")).is_file()
    )
    source_codes_present = all(code in source_text for code in source_evidence.get("requiredObservedCodes", []))

checks = {
    "schemaMetaValid": True,
    "schemaAuthorityAllFieldsImmutable": digest(schema) == EXPECTED["schema"],
    "protocolAuthorityAllFieldsImmutable": digest(protocol) == EXPECTED["protocol"],
    "allFixtureAuthoritiesImmutable": all(
        digest(value) == EXPECTED[key]
        for key, value in (
            ("positive", trace), ("restart", restart_trace), ("phase", phase_recovery),
            ("negative", negative), ("handoffTrace", handoff_trace),
            ("handoffCases", handoff_cases), ("sourceEvidence", source_evidence),
        )
    ),
    "protocolInstanceSchemaValid": not schema_errors,
    "nineUniqueMessageVariantsExact": len(protocol.get("messageExamples", [])) == 9 and {x.get("type") for x in protocol.get("messageExamples", [])} == {"start", "chunk_credit", "quiesce", "abort", "ready", "chunk", "quiesced", "stopped", "capture_error"},
    "unknownFailureCodeRejected": bool(list(validator.iter_errors(unknown_code))),
    "duplicateTenthMessageRejected": bool(list(validator.iter_errors(duplicate_tenth))),
    "positiveChunksCanonicalAndLengthExact": all(canonical_chunk(x) for x in protocol.get("messageExamples", [])) and all(canonical_chunk({"type": "chunk", "pcmBase64": x.get("pcmBase64"), "rawByteLength": x.get("rawByteLength")}) for x in trace if x.get("message") == "chunk_base64"),
    "malformedChunksRejected": not canonical_chunk(mismatched) and not canonical_chunk(noncanonical),
    "traceCountsExact": len(trace) == 24 and len(restart_trace) == 8 and len(phase_recovery) == 7 and len(negative) == 30 and len(handoff_trace) == 6 and len(handoff_cases) == 6,
    "negativeIdsAndMappingExact": [x.get("caseId") for x in negative] == [f"RLY8-N{i:02d}" for i in range(1, 31)] and negative_mapping == EXPECTED_FAILURES,
    "positiveTraceCleanupExact": [trace[22].get(k) for k in ("activeCaptureCount", "residualRawAudioCount", "privateTempAudioCount")] == [0, 0, 0],
    "traceOrderingAndAckExact": [(x.get("message"), x.get("sequence"), x.get("rawByteLength")) for x in trace if x.get("message") in {"chunk_base64", "runtime_binary_chunk", "chunkAccepted"}] == [("chunk_base64", 0, 2), ("runtime_binary_chunk", 0, 2), ("chunkAccepted", 0, 2), ("chunk_base64", 1, 2), ("runtime_binary_chunk", 1, 2), ("chunkAccepted", 1, 2)],
    "markerFivePhasesSameIdentity": [x.get("phase") for x in markers] == ["connecting", "runtime_started", "capturing", "draining", "cleanup_pending"] and len({x.get("captureSessionId") for x in markers}) == len({x.get("taskId") for x in markers}) == 1,
    "markerExpiryArithmeticNoRefresh": len(markers) == 5 and all((b - a).total_seconds() == 1080 for a, b in zip(started, expires)) and len(set(expires)) == 1,
    "handoffIsNotProductTerminal": handoff.get("captureStreamDurability") == "ephemeral_transport_handoff_not_authoritative_product_terminal" and handoff.get("sinkFinalizeIsTerminal") is False and handoff.get("completedFrameDelivery") == "best_effort_capture_handoff_notification_not_task_success",
    "existingPersistentProductAuthorityExact": handoff.get("productDurableAuthority") == "MediaTaskStore_commit_terminal_ready_or_degraded" and handoff.get("runtimeRestartBeforeProductPublish") == "existing_recover_returns_abandoned_cleanup_then_fresh_analysis_required",
    "synchronousStageBarrierBeforeWorkerExact": handoff.get("handoffAcceptedAt") == "after_sink_finalize_transcript_create_and_synchronous_stage_barrier_before_async_worker" and handoff.get("successPreconditions", [])[2:] == ["stage_copy_fsync_hash_shape_barrier_succeeded", "async_transcript_worker_started"],
    "artifactOwnershipTransferExact": ownership.get("beforeStageBarrierOwner") == "runtime_capture_handler_owns_acquisition_sandbox" and ownership.get("afterStageBarrierOwner") == "transcript_service_owns_staged_audio_and_acquisition_sandbox_until_terminal_cleanup" and ownership.get("handlerCleanupAfterTransfer") == "forbidden",
    "stageBarrierIntegrityExact": ownership.get("stageBarrier") == "TaskAudioStager_stage_copy_fsync_sha256_byte_length_wave_shape_all_match_before_return" and ownership.get("asyncWorkerPrecondition") == "stage_barrier_receipt_published_in_memory_before_thread_start",
    "handoffTraceProvesBarrierAndNoFalseTerminal": handoff_trace[1].get("sourceSha256EqualsStagedSha256") is True and handoff_trace[1].get("fsyncCompleted") is True and handoff_trace[3].get("handoffAccepted") is True and handoff_trace[3].get("productTerminal") is False and handoff_trace[-1].get("publishedRequiresDurableProductCommit") is True,
    "handoffInjectionOwnersExact": [(x.get("injectionPoint"), x.get("owner")) for x in handoff_cases] == [("after_sink_finalize", "runtime_capture_handler"), ("transcript_create", "runtime_capture_handler"), ("before_stage", "runtime_capture_handler"), ("after_stage_before_worker", "transcript_service"), ("handoff_completed_frame_send", "transcript_service"), ("commit_then_runtime_restart_before_background_observe", "product_reattach_recovery")],
    "completedNotificationFailurePreservesHandoffNotSuccess": handoff_cases[4].get("expectedHandoffAccepted") is True and handoff_cases[4].get("productTerminal") is False and handoff_cases[4].get("expectedFailureCode") is None,
    "restartDispositionBoundToPersistentCommit": handoff_cases[5].get("expectedDisposition") == "published_only_if_MediaTaskStore_terminal_commit_exists_else_abandoned" and handoff_cases[5].get("requiresFreshBegin") is True,
    "sourceInventoryExact36": len(source_inventory) == source_evidence.get("sourceInventoryCount") == 36,
    "targetInventoryExact20": len(target_inventory) == source_evidence.get("targetInventoryCount") == 20 and target_inventory == set(protocol.get("failureCodes", [])),
    "sourceClassificationClosedAndDisjoint": source_inventory == identity_shared | rename_sources | public_only and not (identity_shared & rename_sources or identity_shared & public_only or rename_sources & public_only),
    "renameTargetsDeclared": set(rename_mapping.values()) <= target_inventory,
    "missingCurrentRelayCodesClosed": {"V3_MEDIA_CAPTURE_CHUNK_INVALID", "V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID", "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE", "V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED"} <= identity_shared,
    "taskArtifactCodesMappedExact": rename_mapping.get("V3_MEDIA_CROSS_TASK_REUSE") == "V3_MEDIA_CAPTURE_BINDING_MISMATCH" and rename_mapping.get("V3_MEDIA_TEMP_FILE_MODE_INVALID") == "V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID",
    "r0RegistryAndAstScanRequired": boundary.get("sourceAuthority", {}).get("r0Registry") == "captureRelaySourceFailureCodes" and boundary.get("sourceAuthority", {}).get("implementationVerification") == "AST_scan_emit_sites_equals_registry_equals_frozen_sourceInventory",
    "sourceEvidenceHashesCurrent": source_files_valid,
    "requiredObservedCodesExistInCurrentSources": source_codes_present,
    "sourceEvidenceListsAllSixKnownOmissions": set(source_evidence.get("requiredObservedCodes", [])) == {"V3_MEDIA_CAPTURE_CHUNK_INVALID", "V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID", "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE", "V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED", "V3_MEDIA_CROSS_TASK_REUSE", "V3_MEDIA_TEMP_FILE_MODE_INVALID"},
    "threeRevisionDomainsExplicit": revision.get("revisionDomainCount") == 3 and revision.get("crossDomainRevisionEquality") == "forbidden_transcript_consent_and_product_revisions_are_distinct_domains",
    "noPublicApiExpansion": protocol.get("restartTermination", {}).get("publicApiChange") == "none" and protocol.get("recoveryOwnership", {}).get("publicApiChange") == "none" and protocol.get("recoveryOwnership", {}).get("newUserAction") == "none",
    "restartRecoveryNoInMemorySuccessClaim": phase_recovery[1].get("requiredReceipt") == "single_cleanup_owner_then_published_or_abandoned_no_in_memory_success_claim" and phase_recovery[5].get("requiredReceipt") == "recover_success_disposition_and_matching_taskId_imply_internal_cleanup_pass_else_cleanup_error_then_fresh_begin",
    "limitsRemainBounded": protocol.get("limits", {}).get("maxRawChunkBytes") == 49152 and protocol.get("limits", {}).get("maxOutstandingChunks") == 32 and protocol.get("limits", {}).get("maxCaptureMs") == 900000 and protocol.get("limits", {}).get("maxCaptureBytes") == 536870912,
}

failed = [name for name, passed in checks.items() if not passed]
result = {
    "schemaVersion": "v3-media-capture-internal-relay-v8-verification/v1",
    "passed": not failed,
    "checks": checks,
    "schemaErrors": [error.message for error in schema_errors],
    "failedChecks": failed,
    "summary": {"total": len(checks), "passed": len(checks) - len(failed), "failed": len(failed)},
}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result["passed"] else 2)
