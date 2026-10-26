#!/usr/bin/env python3
"""Anti-false-green verifier for the V3 internal capture relay v10 contract."""
from __future__ import annotations

import base64
import ast
import copy
import hashlib
import json
import os
import re
import subprocess
from datetime import datetime
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


HERE = Path(__file__).resolve().parent
LOCAL_SCHEMA = HERE / "15-internal-relay-v10.schema.json"
LOCAL_FIXTURES = HERE / "16-internal-relay-v10-fixtures.json"
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
    SCHEMA = ROOT / "docs/active/project/contracts/v3_media_capture_internal_relay_v10.schema.json"
    FIXTURES = ROOT / "docs/active/project/fixtures/v3-media-capture-internal-relay-v10-fixtures.json"
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
hard_crash_trace = fixtures.get("hardCrashRecoveryTrace", [])
owner_manifest_failures = fixtures.get("ownerManifestFailureCases", [])
source_evidence = fixtures.get("sourceInventoryEvidence", {})
schema_errors = sorted(validator.iter_errors(protocol), key=lambda error: list(error.path))

EXPECTED = {
    "schema": "2a603ff045049e389e080582c013eaa128d0e400a4fa6fd1a8be83a9971aaa8d",
    "protocol": "fbb0a3136cade9810e4457f1702e6d8bf82022a538747a0f94f62b6146a12884",
    "positive": "411446f92c3e6a831dc2359a6317891e450443d29a80b90113edbc9fb689573a",
    "restart": "050b12914c1f5509f7f23348b89feb601fcee6d0386a46946d47a8de5bcb8771",
    "phase": "6f96615abaeb4f458625e91f6ba937c5626cdb4cbd183a2ec8e74fca1648cb37",
    "negative": "abb8dd16fe5e145bc9b04016ac2841eec71c6518e3b7c48ca0c304136ed7b868",
    "handoffTrace": "d60ab20a24a79ff8521dcb7b098c2a557734708d2c73f950f150d005b116a933",
    "handoffCases": "1a1fb3ea55050240aff223740dbf4b845472dfaef9ebeb7d40a53a1d9eb1610c",
    "hardCrashTrace": "7e1a6348f85764f983208b2afbb22b247dbd9604cdcc66610186124e2029f904",
    "ownerManifestFailures": "138e8c41ccc3fa7e33fe72ccbc5bbbe2a66d73159dfcb325ab10e24c950b3893",
    "sourceEvidence": "cd8d0e4c81c7a409a41f52684e711ef315e8046b4a350181b9c1199c760a088b",
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
owner_manifest_example = protocol.get("ownerManifestExample", {})
owner_receipt_example = protocol.get("ownerReceiptExample", {})
revision = protocol.get("identityAndRevisionPolicy", {})
markers = protocol.get("restartMarkerInstances", [])
started = [datetime.fromisoformat(x["startedAt"].replace("Z", "+00:00")) for x in markers]
expires = [datetime.fromisoformat(x["expiresAt"].replace("Z", "+00:00")) for x in markers]
negative_mapping = {x.get("mutation"): x.get("expectedFailureCode") for x in negative}
handoff_by_point = {
    item.get("injectionPoint"): item
    for item in handoff_cases
    if isinstance(item, dict) and isinstance(item.get("injectionPoint"), str)
}

CODE_PATTERN = re.compile(r"V3_MEDIA_[A-Z0-9_]*[A-Z0-9]")


PYTHON_BOUNDARY_PARENTS = (
    ast.Call, ast.keyword, ast.Dict, ast.Assign, ast.AnnAssign, ast.Return,
    ast.Tuple, ast.List, ast.Set, ast.IfExp,
)


def python_codes(path: Path, extractor: str, symbols: list[str]) -> tuple[set[str], bool]:
    try:
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source)
    except (OSError, SyntaxError, UnicodeError):
        return set(), False
    if extractor == "python_ast_boundary_module":
        nodes = [tree]
    elif extractor == "python_ast_boundary_symbols":
        found: dict[str, ast.AST] = {}
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                found[node.name] = node
            elif isinstance(node, ast.ClassDef):
                for child in node.body:
                    if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        found[f"{node.name}.{child.name}"] = child
        if any(symbol not in found for symbol in symbols):
            return set(), False
        nodes = [found[symbol] for symbol in symbols]
    else:
        return set(), False
    codes: set[str] = set()
    for node in nodes:
        parents = {child: parent for parent in ast.walk(node) for child in ast.iter_child_nodes(parent)}
        for child in ast.walk(node):
            if (
                isinstance(child, ast.Constant)
                and isinstance(child.value, str)
                and CODE_PATTERN.fullmatch(child.value)
                and isinstance(parents.get(child), PYTHON_BOUNDARY_PARENTS)
            ):
                codes.add(child.value)
    return codes, True


def typescript_codes(path: Path, extractor: str) -> tuple[set[str], bool]:
    if extractor != "typescript_compiler_ast_boundary_values" or ROOT is None:
        return set(), False
    script = r'''
const ts = require("typescript");
const fs = require("fs");
const path = process.argv[1];
const source = ts.createSourceFile(path, fs.readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
const pattern = /^V3_MEDIA_[A-Z0-9_]*[A-Z0-9]$/;
const values = new Set();
function unwrapParent(node) {
  let parent = node.parent;
  while (parent && (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) ||
    ts.isSatisfiesExpression(parent) || ts.isNonNullExpression(parent))) parent = parent.parent;
  return parent;
}
function isBoundaryValue(node) {
  const parent = unwrapParent(node);
  return !!parent && (ts.isNewExpression(parent) || ts.isCallExpression(parent) ||
    ts.isPropertyAssignment(parent) || ts.isReturnStatement(parent) ||
    ts.isVariableDeclaration(parent) || ts.isBinaryExpression(parent) ||
    ts.isConditionalExpression(parent) || ts.isCaseClause(parent) ||
    ts.isArrayLiteralExpression(parent) || ts.isThrowStatement(parent) ||
    ts.isEnumMember(parent));
}
function visit(node) {
  if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      pattern.test(node.text) && isBoundaryValue(node)) values.add(node.text);
  ts.forEachChild(node, visit);
}
visit(source);
process.stdout.write(JSON.stringify([...values].sort()));
'''
    try:
        completed = subprocess.run(
            ["node", "-e", script, str(path)],
            cwd=ROOT / "apps/chrome-extension",
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
        values = json.loads(completed.stdout) if completed.returncode == 0 else []
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
        return set(), False
    return set(values), completed.returncode == 0 and all(CODE_PATTERN.fullmatch(value) for value in values)

source_files_valid = ROOT is not None
source_extractors_valid = ROOT is not None
actual_emit_codes: set[str] = set()
target_emit_codes: set[str] = set()
target_scope_unexpected_codes: dict[str, list[str]] = {}
listed_paths: set[str] = set()
unlisted_boundary_emits: dict[str, list[str]] = {}
all_discovered_codes: set[str] = set()
non_relay_allowlist = set(source_evidence.get("nonRelayCodeAllowlist", []))
if ROOT is not None:
    for item in source_evidence.get("scopes", []):
        path = ROOT / item.get("path", "")
        relative = item.get("path", "")
        listed_paths.add(relative)
        current = path.is_file() and file_digest(path) == item.get("sha256")
        source_files_valid &= current
        if not current:
            source_extractors_valid = False
            continue
        if item.get("language") == "python":
            codes, valid = python_codes(path, item.get("extractor", ""), item.get("symbols", []))
        elif item.get("language") == "typescript":
            codes, valid = typescript_codes(path, item.get("extractor", ""))
        else:
            codes, valid = set(), False
        source_extractors_valid &= valid
        actual_emit_codes.update(codes)
        all_discovered_codes.update(codes)
    for item in source_evidence.get("targetScopes", []):
        path = ROOT / item.get("path", "")
        relative = item.get("path", "")
        listed_paths.add(relative)
        current = path.is_file() and file_digest(path) == item.get("sha256")
        source_files_valid &= current
        if not current:
            source_extractors_valid = False
            continue
        if item.get("language") == "typescript":
            codes, valid = typescript_codes(path, item.get("extractor", ""))
        else:
            codes, valid = set(), False
        source_extractors_valid &= valid
        all_discovered_codes.update(codes)
        actual_emit_codes.update(codes & source_inventory)
        target_emit_codes.update(codes & target_inventory)
        unexpected = codes - target_inventory - source_inventory - non_relay_allowlist
        if unexpected:
            target_scope_unexpected_codes[relative] = sorted(unexpected)
    for pattern in source_evidence.get("discoveryRoots", []):
        for path in ROOT.glob(pattern):
            relative = path.relative_to(ROOT).as_posix()
            if relative in listed_paths or not path.is_file():
                continue
            if path.suffix == ".py":
                codes, valid = python_codes(path, "python_ast_boundary_module", [])
            elif path.suffix == ".ts":
                codes, valid = typescript_codes(path, "typescript_compiler_ast_boundary_values")
            else:
                codes, valid = set(), False
            source_extractors_valid &= valid
            all_discovered_codes.update(codes)
            boundary_codes = codes - source_inventory - non_relay_allowlist
            if boundary_codes:
                unlisted_boundary_emits[relative] = sorted(boundary_codes)

checks = {
    "schemaMetaValid": True,
    "schemaAuthorityAllFieldsImmutable": digest(schema) == EXPECTED["schema"],
    "protocolAuthorityAllFieldsImmutable": digest(protocol) == EXPECTED["protocol"],
    "allFixtureAuthoritiesImmutable": all(
        digest(value) == EXPECTED[key]
        for key, value in (
            ("positive", trace), ("restart", restart_trace), ("phase", phase_recovery),
            ("negative", negative), ("handoffTrace", handoff_trace),
            ("handoffCases", handoff_cases), ("hardCrashTrace", hard_crash_trace),
            ("ownerManifestFailures", owner_manifest_failures),
            ("sourceEvidence", source_evidence),
        )
    ),
    "protocolInstanceSchemaValid": not schema_errors,
    "nineUniqueMessageVariantsExact": len(protocol.get("messageExamples", [])) == 9 and {x.get("type") for x in protocol.get("messageExamples", [])} == {"start", "chunk_credit", "quiesce", "abort", "ready", "chunk", "quiesced", "stopped", "capture_error"},
    "unknownFailureCodeRejected": bool(list(validator.iter_errors(unknown_code))),
    "duplicateTenthMessageRejected": bool(list(validator.iter_errors(duplicate_tenth))),
    "positiveChunksCanonicalAndLengthExact": all(canonical_chunk(x) for x in protocol.get("messageExamples", [])) and all(canonical_chunk({"type": "chunk", "pcmBase64": x.get("pcmBase64"), "rawByteLength": x.get("rawByteLength")}) for x in trace if x.get("message") == "chunk_base64"),
    "malformedChunksRejected": not canonical_chunk(mismatched) and not canonical_chunk(noncanonical),
    "traceCountsExact": len(trace) == 24 and len(restart_trace) == 8 and len(phase_recovery) == 7 and len(negative) == 30 and len(handoff_trace) == 6 and len(handoff_cases) == 6 and len(hard_crash_trace) == 13 and len(owner_manifest_failures) == 8,
    "negativeIdsAndMappingExact": [x.get("caseId") for x in negative] == [f"RLY10-N{i:02d}" for i in range(1, 31)] and negative_mapping == EXPECTED_FAILURES,
    "positiveTraceCleanupExact": len(trace) > 22 and [trace[22].get(k) for k in ("activeCaptureCount", "residualRawAudioCount", "privateTempAudioCount")] == [0, 0, 0],
    "traceOrderingAndAckExact": [(x.get("message"), x.get("sequence"), x.get("rawByteLength")) for x in trace if x.get("message") in {"chunk_base64", "runtime_binary_chunk", "chunkAccepted"}] == [("chunk_base64", 0, 2), ("runtime_binary_chunk", 0, 2), ("chunkAccepted", 0, 2), ("chunk_base64", 1, 2), ("runtime_binary_chunk", 1, 2), ("chunkAccepted", 1, 2)],
    "markerFivePhasesSameIdentity": [x.get("phase") for x in markers] == ["connecting", "runtime_started", "capturing", "draining", "cleanup_pending"] and len({x.get("captureSessionId") for x in markers}) == len({x.get("taskId") for x in markers}) == 1,
    "markerExpiryArithmeticNoRefresh": len(markers) == 5 and all((b - a).total_seconds() == 1080 for a, b in zip(started, expires)) and len(set(expires)) == 1,
    "handoffIsNotProductTerminal": handoff.get("captureStreamDurability") == "ephemeral_transport_handoff_not_authoritative_product_terminal" and handoff.get("sinkFinalizeIsTerminal") is False and handoff.get("completedFrameDelivery") == "best_effort_capture_handoff_notification_not_task_success",
    "existingPersistentProductAuthorityExact": handoff.get("productDurableAuthority") == "MediaTaskStore_commit_terminal_ready_or_degraded" and handoff.get("runtimeRestartBeforeProductPublish") == "existing_recover_returns_abandoned_cleanup_then_fresh_analysis_required",
    "synchronousStageBarrierBeforeWorkerExact": handoff.get("handoffAcceptedAt") == "after_sink_finalize_transcript_create_and_synchronous_stage_barrier_before_async_worker" and handoff.get("successPreconditions", [])[2:] == ["stage_copy_fsync_hash_shape_barrier_succeeded", "async_transcript_worker_started"],
    "artifactOwnershipTransferExact": ownership.get("beforeStageBarrierOwner") == "runtime_capture_handler_owns_acquisition_sandbox" and ownership.get("afterStageBarrierOwner") == "transcript_service_owns_staged_audio_and_acquisition_sandbox_until_terminal_cleanup" and ownership.get("handlerCleanupAfterTransfer") == "forbidden",
    "stageBarrierIntegrityExact": ownership.get("stageBarrier") == "TaskAudioStager_stage_copy_fsync_sha256_byte_length_wave_shape_all_match_before_return" and ownership.get("asyncWorkerPrecondition") == "matching_SQLite_owner_receipt_transaction_synchronous_FULL_committed_after_manifest_parent_directory_fsync_before_thread_start",
    "handoffTraceProvesBarrierAndNoFalseTerminal": len(handoff_trace) == 6 and handoff_trace[1].get("sourceSha256EqualsStagedSha256") is True and handoff_trace[1].get("fsyncCompleted") is True and handoff_trace[3].get("handoffAccepted") is True and handoff_trace[3].get("productTerminal") is False and handoff_trace[-1].get("publishedRequiresDurableProductCommit") is True,
    "handoffInjectionOwnersExact": [(x.get("injectionPoint"), x.get("owner")) for x in handoff_cases] == [("after_sink_finalize", "runtime_capture_handler"), ("transcript_create", "runtime_capture_handler"), ("before_stage", "runtime_capture_handler"), ("after_stage_before_worker", "transcript_service"), ("handoff_completed_frame_send", "transcript_service"), ("commit_then_runtime_restart_before_background_observe", "product_reattach_recovery")],
    "completedNotificationFailurePreservesHandoffNotSuccess": handoff_by_point.get("handoff_completed_frame_send", {}).get("expectedHandoffAccepted") is True and handoff_by_point.get("handoff_completed_frame_send", {}).get("productTerminal") is False and handoff_by_point.get("handoff_completed_frame_send", {}).get("expectedFailureCode") is None,
    "restartDispositionBoundToPersistentCommit": handoff_by_point.get("commit_then_runtime_restart_before_background_observe", {}).get("expectedDisposition") == "published_only_if_MediaTaskStore_terminal_commit_exists_else_abandoned" and handoff_by_point.get("commit_then_runtime_restart_before_background_observe", {}).get("requiresFreshBegin") is True,
    "afterStageHardCrashCaseExact": handoff_by_point.get("after_stage_before_worker", {}).get("faultMode") == "hard_process_crash" and handoff_by_point.get("after_stage_before_worker", {}).get("restartAction") == "existing_recover_composite_cleanup" and set(handoff_by_point.get("after_stage_before_worker", {}).get("requiredResiduals", {}).values()) == {0} and handoff_by_point.get("after_stage_before_worker", {}).get("requiresFreshBegin") is True,
    "hardCrashTraceRecoveryBarrierExact": len(hard_crash_trace) == 13 and [item.get("message") for item in hard_crash_trace] == ["staged_audio_copy_file_fsynced", "owner_manifest_temp_written_canonical", "owner_manifest_file_fsynced", "owner_manifest_atomic_replace", "owner_manifest_parent_directory_fsynced", "ownership_transfer_receipt_SQLite_FULL_committed", "hard_crash_after_durable_manifest_and_SQLite_receipt_before_worker", "existing_recover_discovered_manifest_and_matching_SQLite_receipt_by_authoritative_taskId", "acquisition_sandbox_cleanup", "asr_staged_root_cleanup", "unpublished_product_cleanup", "recover_abandoned", "fresh_begin_succeeds"] and hard_crash_trace[1].get("openMode") == "O_EXCL" and hard_crash_trace[5].get("receiptStore") == "media_capture_owner_receipts" and hard_crash_trace[5].get("transactionCommitted") is True and hard_crash_trace[5].get("synchronous") == "FULL" and hard_crash_trace[5].get("manifestSha256Matches") is True and hard_crash_trace[5].get("asyncWorkerStarted") is False and hard_crash_trace[6].get("finallyExecuted") is False and hard_crash_trace[7].get("processMemoryUsed") is False and [hard_crash_trace[index].get(key) for index, key in ((8, "acquisitionResidualCount"), (9, "asrResidualCount"), (10, "productResidualCount"), (11, "activeSinkCount"))] == [0, 0, 0, 0] and hard_crash_trace[-1].get("singleActiveSink") is True,
    "stagedAudioCrashOwnerFrozen": ownership.get("stagedAudioOwnerManifest") == "schema_v3_media_capture_owner_manifest_v10_taskId_pid_processStartToken_sourceSha256_stagedSha256_byteLength_waveShape_state_staged" and ownership.get("stagedAudioOwnerManifestPath") == "private_asr_staging_root/<taskId>/owner.json" and ownership.get("stagedAudioOwnerManifestDiscovery") == "existing_recover_resolves_exact_path_from_validated_authoritative_taskId_without_process_memory" and ownership.get("hardCrashRecoveryOwner") == "MediaRecoveryCleanupCoordinator_called_by_existing_recover_internal_cleanup_callback" and owner_manifest_example.get("schemaVersion") == "v3-media-capture-owner-manifest/v10" and owner_manifest_example.get("state") == "staged" and owner_receipt_example.get("schemaVersion") == "v3-media-capture-owner-receipt/v10" and owner_receipt_example.get("state") == "ownership_committed" and owner_receipt_example.get("taskId") == owner_manifest_example.get("taskId") and owner_receipt_example.get("manifestSha256") == digest(owner_manifest_example) and owner_receipt_example.get("durability") == "sqlite_transaction_synchronous_FULL_committed",
    "ownerManifestAtomicDurabilityExact": ownership.get("stagedAudioOwnerManifestWrite") == "canonical_json_to_owner.json.tmp.<random>_open_O_EXCL_then_file_fsync_then_atomic_replace_owner.json_then_parent_directory_fsync" and ownership.get("stagedAudioOwnerManifestReceipt") == "SQLite_media_capture_owner_receipts_taskId_manifestSha256_ownership_committed_transaction_synchronous_FULL" and ownership.get("stagedAudioOwnerReceiptTable") == "media_capture_owner_receipts_internal_taskId_primary_key_manifestSha256_state_committedAt" and ownership.get("stagedAudioOwnerReceiptWrite") == "after_manifest_parent_directory_fsync_begin_immediate_SQLite_transaction_synchronous_FULL_insert_ownership_committed_then_commit" and ownership.get("stagedAudioOwnerReceiptRecovery") == "recover_requires_valid_manifest_and_matching_committed_receipt_manifestSha256_without_process_memory" and ownership.get("hardCrashKillPoint") == "after_SQLite_owner_receipt_FULL_commit_before_async_worker_start",
    "ownerManifestInvalidFailClosedExact": ownership.get("stagedAudioOwnerManifestValidation") == "manifest_and_SQLite_receipt_schema_valid_exact_taskId_manifestSha256_process_identity_hash_length_wave_shape_state_safe_path_match_else_V3_MEDIA_CLEANUP_INCOMPLETE" and [item.get("caseId") for item in owner_manifest_failures] == [f"OM10-N{i:02d}" for i in range(1, 9)] and owner_manifest_failures[-1].get("mutation") == "SQLite_owner_receipt_missing_uncommitted_or_manifestSha256_mismatch_after_manifest_publish" and {item.get("expectedFailureCode") for item in owner_manifest_failures} == {"V3_MEDIA_CLEANUP_INCOMPLETE"},
    "compositeRecoveryCleanupFailClosed": ownership.get("hardCrashCleanupOrder") == "acquisition_sandbox_then_asr_staged_root_then_unpublished_product_evidence" and ownership.get("hardCrashCleanupReceipt") == "acquisitionResidualCount_asrResidualCount_productResidualCount_activeSinkCount_all_zero" and ownership.get("hardCrashCleanupFailure") == "any_error_or_nonzero_residual_fail_closed_V3_MEDIA_CLEANUP_INCOMPLETE" and ownership.get("freshBeginPrecondition") == "recover_abandoned_and_all_four_residual_counts_zero",
    "sourceInventoryExact40": len(source_inventory) == source_evidence.get("sourceInventoryCount") == 40,
    "targetInventoryExact20": len(target_inventory) == source_evidence.get("targetInventoryCount") == 20 and target_inventory == set(protocol.get("failureCodes", [])),
    "sourceClassificationClosedAndDisjoint": source_inventory == identity_shared | rename_sources | public_only and not (identity_shared & rename_sources or identity_shared & public_only or rename_sources & public_only),
    "renameTargetsDeclared": set(rename_mapping.values()) <= target_inventory,
    "missingCurrentRelayCodesClosed": {"V3_MEDIA_CAPTURE_CHUNK_INVALID", "V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID", "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE", "V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED"} <= identity_shared,
    "taskArtifactCodesMappedExact": rename_mapping.get("V3_MEDIA_CROSS_TASK_REUSE") == "V3_MEDIA_CAPTURE_BINDING_MISMATCH" and rename_mapping.get("V3_MEDIA_TEMP_FILE_MODE_INVALID") == "V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID",
    "r0RegistryAndAstScanRequired": boundary.get("sourceAuthority", {}).get("r0Registry") == "captureRelaySourceFailureCodes" and boundary.get("sourceAuthority", {}).get("implementationVerification") == "semantic_AST_boundary_sites_equals_registry_equals_frozen_sourceInventory",
    "sourceEvidenceHashesCurrent": source_files_valid,
    "sourceScopeExtractorsValid": source_extractors_valid,
    "sourceManifestPathsExact": set(boundary.get("sourceAuthority", {}).get("authoritativeScopes", [])) == {f"{item.get('path')}#{item.get('extractor')}" + (":" + ",".join(item.get("symbols", [])) if item.get("symbols") else "") for item in source_evidence.get("scopes", [])},
    "sourceEmitSetEqualsFrozenInventory": actual_emit_codes == source_inventory,
    "unlistedSourceFilesEmitNoBoundaryCodes": not unlisted_boundary_emits and not target_scope_unexpected_codes and target_emit_codes == target_inventory,
    "discoveredCodeUniverseClosed": all_discovered_codes == source_inventory | target_inventory | non_relay_allowlist and not (source_inventory & non_relay_allowlist) and non_relay_allowlist == set(boundary.get("sourceAuthority", {}).get("nonRelayCodeAllowlist", [])),
    "discoveryRootsAndPolicyExact": source_evidence.get("discoveryRoots") == boundary.get("sourceAuthority", {}).get("discoveryRoots") == ["services/local-runtime/navia_runtime/modules/media_companion/acquisition/**/*.py", "services/local-runtime/navia_runtime/*.py", "apps/chrome-extension/src/modules/media_companion/capture/**/*.ts", "apps/chrome-extension/entrypoints/media-capture-offscreen/**/*.ts"] and source_evidence.get("unlistedEmitPolicy") == boundary.get("sourceAuthority", {}).get("unlistedEmitPolicy") == "reject_unlisted_file_in_recursive_boundary_roots_containing_any_frozen_source_code_or_new_V3_MEDIA_CAPTURE_code",
    "threeRevisionDomainsExplicit": revision.get("revisionDomainCount") == 3 and revision.get("crossDomainRevisionEquality") == "forbidden_transcript_consent_and_product_revisions_are_distinct_domains",
    "noPublicApiExpansion": protocol.get("restartTermination", {}).get("publicApiChange") == "none" and protocol.get("recoveryOwnership", {}).get("publicApiChange") == "none" and protocol.get("recoveryOwnership", {}).get("newUserAction") == "none",
    "recoverCompositeCleanupEntityExact": protocol.get("recoveryOwnership", {}).get("stagedAudioRecoveryEntity") == "MediaRecoveryCleanupCoordinator_internal_callback" and protocol.get("recoveryOwnership", {}).get("stagedAudioOwnerDiscovery") == "deterministic_private_asr_staging_root_taskId_owner.json_from_authoritativeTaskId" and protocol.get("recoveryOwnership", {}).get("stagedAudioOwnerPublish") == "manifest_temp_O_EXCL_write_file_fsync_atomic_replace_parent_directory_fsync_then_SQLite_synchronous_FULL_receipt_commit" and protocol.get("recoveryOwnership", {}).get("stagedAudioOwnerInvalid") == "missing_torn_corrupt_mismatch_unsafe_manifest_or_missing_mismatched_uncommitted_receipt_returns_V3_MEDIA_CLEANUP_INCOMPLETE" and protocol.get("recoveryOwnership", {}).get("recoverCleanupBarrier") == "acquisition_sandbox_then_asr_staged_root_then_unpublished_product_evidence_all_residual_zero" and protocol.get("recoveryOwnership", {}).get("recoverFailureRule") == "any_cleanup_error_or_nonzero_residual_returns_V3_MEDIA_CLEANUP_INCOMPLETE",
    "restartRecoveryNoInMemorySuccessClaim": phase_recovery[1].get("requiredReceipt") == "single_cleanup_owner_then_published_or_abandoned_no_in_memory_success_claim" and phase_recovery[5].get("requiredReceipt") == "recover_success_disposition_and_matching_taskId_imply_internal_cleanup_pass_else_cleanup_error_then_fresh_begin",
    "limitsRemainBounded": protocol.get("limits", {}).get("maxRawChunkBytes") == 49152 and protocol.get("limits", {}).get("maxOutstandingChunks") == 32 and protocol.get("limits", {}).get("maxCaptureMs") == 900000 and protocol.get("limits", {}).get("maxCaptureBytes") == 536870912,
}

failed = [name for name, passed in checks.items() if not passed]
result = {
    "schemaVersion": "v3-media-capture-internal-relay-v10-verification/v1",
    "passed": not failed,
    "checks": checks,
    "schemaErrors": [error.message for error in schema_errors],
    "unlistedBoundaryEmits": unlisted_boundary_emits,
    "targetScopeUnexpectedCodes": target_scope_unexpected_codes,
    "targetInventoryDiff": {
        "actualCount": len(target_emit_codes),
        "frozenCount": len(target_inventory),
        "missing": sorted(target_inventory - target_emit_codes),
        "extra": sorted(target_emit_codes - target_inventory),
    },
    "sourceInventoryDiff": {
        "actualCount": len(actual_emit_codes),
        "frozenCount": len(source_inventory),
        "missing": sorted(source_inventory - actual_emit_codes),
        "extra": sorted(actual_emit_codes - source_inventory),
    },
    "failedChecks": failed,
    "summary": {"total": len(checks), "passed": len(checks) - len(failed), "failed": len(failed)},
}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result["passed"] else 2)
