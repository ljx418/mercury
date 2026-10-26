"""WP-B B1 — contracts and store.

Production owners: `local_import.contracts` (frozen 18-code set, public state,
internal receipts, semantic validator) and `local_import.store` (SQLite durable
record, FULL-synchronous transactions, single-active-per-task, startup scan).

Cases map to B01 (contract closure), B07 (state/sequence/barrier mutations) and
the store half of B06/B26 (restart returns a persisted terminal, never 404).
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.local_import.store import (
    LocalMediaImportStore,
    SCHEMA_VERSION,
    TABLE,
)

IMPORT_ID = "media_import_" + "a" * 32
TASK_ID = "media_task_" + "b" * 32
SOURCE_IDENTITY = "portal:bilibili:BV1local000000:cid:1"
GENERATION = "depgen_" + "c" * 64
SHA = "d" * 64


# --- B01: the contract is a closed set --------------------------------------


def test_b01_failure_codes_are_the_frozen_eighteen() -> None:
    assert len(C.FAILURE_CODES) == 18
    assert C.FAILURE_CODES == (
        "REQUEST_INVALID", "AUTH_REQUIRED", "ORIGIN_MISMATCH", "NOT_FOUND",
        "TASK_NOT_ELIGIBLE", "ACTIVE", "TOKEN_INVALID", "SIZE_MISMATCH",
        "SIZE_LIMIT", "TYPE_UNSUPPORTED", "MEDIA_INVALID", "DURATION_LIMIT",
        "DISK_SPACE_LOW", "WRITE_FAILED", "PREPARE_FAILED",
        "RUNTIME_RESTARTED", "CANCELLED", "CLEANUP_INCOMPLETE",
    )
    # The set stores BARE codes; `ImportError.code` applies the frozen prefix.
    assert all(not code.startswith(C.PREFIX) for code in C.FAILURE_CODES)
    assert C.ImportError("NOT_FOUND", "x").code == "V3_MEDIA_IMPORT_NOT_FOUND"


def test_b01_http_status_mapping_is_frozen() -> None:
    assert C.HTTP_STATUS["REQUEST_INVALID"] == 400
    assert C.HTTP_STATUS["AUTH_REQUIRED"] == 401
    assert C.HTTP_STATUS["ORIGIN_MISMATCH"] == 403
    assert C.HTTP_STATUS["NOT_FOUND"] == 404
    assert C.HTTP_STATUS["ACTIVE"] == 409
    assert C.HTTP_STATUS["SIZE_LIMIT"] == 413
    assert C.HTTP_STATUS["DURATION_LIMIT"] == 422
    assert C.HTTP_STATUS["DISK_SPACE_LOW"] == 507
    assert C.HTTP_STATUS["WRITE_FAILED"] == 500
    assert C.HTTP_STATUS["CANCELLED"] == 409
    assert C.HTTP_STATUS["PREPARE_FAILED"] == 422
    assert C.HTTP_STATUS["CLEANUP_INCOMPLETE"] == 500


def test_b01_error_details_may_only_carry_three_keys() -> None:
    error = C.ImportError("NOT_FOUND", "Import was not found.", details={"importId": IMPORT_ID})
    assert set(error.to_envelope()["error"]) == {"code", "message", "recoverable", "details"}
    with pytest.raises(AssertionError):
        C.ImportError("NOT_FOUND", "x", details={"path": "/home/x.mp4"})
    with pytest.raises(AssertionError):
        C.ImportError("NOT_PRESENT", "x")


# --- B07: state machine and semantic validation ------------------------------


def test_b07_states_and_barrier_phases_are_frozen() -> None:
    assert C.STATES == (
        "awaiting_upload", "uploading", "verifying", "preparing", "ready",
        "cancelling", "cancelled", "failed",
    )
    assert C.TERMINAL_STATES == {"ready", "cancelled", "failed"}
    # The FROZEN vocabulary, exactly as the internal schema declares it.
    assert C.BARRIER_PHASES == (
        "video_durable", "inputs_prepared", "input_bound", "audio_staged",
        "video_deleted", "transcript_terminal", "visual_terminal",
        "cleaning", "cleaned", "failed",
    )


def test_b07_terminal_states_cannot_transition() -> None:
    assert not C.can_transition("ready", "uploading")
    assert not C.can_transition("cancelled", "uploading")
    assert not C.can_transition("failed", "preparing")
    assert C.can_transition("uploading", "verifying")
    assert C.can_transition("preparing", "ready")


@pytest.mark.parametrize(
    "mutate",
    [
        lambda s: s.update(state="ready"),  # awaiting_upload may not jump to ready
        lambda s: s.update(uploadedBytes=-1),
        lambda s: s.update(uploadedBytes=s["byteLength"] + 1),
        lambda s: s.update(sequence=-1),
        lambda s: s.update(failureCode="V3_MEDIA_IMPORT_NOT_PRESENT"),
        lambda s: s.update(barrierPhase="not_a_phase"),
        lambda s: s.update(declaredMediaType="video/quicktime"),
    ],
)
def test_b07_semantic_validator_rejects_every_mutation(mutate) -> None:
    record = _valid_record()
    C.semantic_validate_import(record)
    mutate(record)
    with pytest.raises(C.ImportError):
        C.semantic_validate_import(record)


def test_b07_ready_requires_equal_length_and_no_failure() -> None:
    record = _valid_record()
    record.update(
        state="ready",
        uploadedBytes=record["byteLength"],
        barrierPhase="input_bound",
        videoManifestSha256=SHA,
    )
    C.semantic_validate_import(record)

    record["failureCode"] = "V3_MEDIA_IMPORT_WRITE_FAILED"
    with pytest.raises(C.ImportError):
        C.semantic_validate_import(record)

    record["failureCode"] = None
    record["uploadedBytes"] = record["byteLength"] - 1
    with pytest.raises(C.ImportError):
        C.semantic_validate_import(record)


def test_b07_failed_requires_a_failure_and_null_media() -> None:
    record = _valid_record()
    record.update(state="failed", failureCode="V3_MEDIA_IMPORT_WRITE_FAILED", videoManifestSha256=SHA)
    # A failed record must NOT claim a durable video manifest.
    with pytest.raises(C.ImportError):
        C.semantic_validate_import(record)


def _valid_record() -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "importId": IMPORT_ID,
        "taskId": TASK_ID,
        "sourceIdentity": SOURCE_IDENTITY,
        "state": "awaiting_upload",
        "sequence": 0,
        "byteLength": 1024,
        "uploadedBytes": 0,
        "declaredMediaType": "video/mp4",
        "dependencyGeneration": GENERATION,
        "videoManifestSha256": None,
        "visualReceiptSha256": None,
        # The frozen vocabulary's placeholder: the handoff has not started.
        "barrierPhase": C.INITIAL_BARRIER_PHASE,
        "failureCode": None,
        "createdAt": "2026-10-19T00:00:00.000Z",
        "updatedAt": "2026-10-19T00:00:00.000Z",
    }


# --- B01/B06/B26: the durable store -----------------------------------------


@pytest.fixture
def store(tmp_path: Path) -> LocalMediaImportStore:
    return LocalMediaImportStore(tmp_path / "navia.sqlite3")


def test_store_creates_only_the_allowed_columns(store: LocalMediaImportStore) -> None:
    columns = [row[1] for row in _raw(store).execute(f"PRAGMA table_info({TABLE})")]
    assert columns == [
        "import_id", "task_id", "source_identity", "state", "sequence",
        "byte_length", "uploaded_bytes", "declared_media_type",
        "dependency_generation", "video_manifest_sha256",
        "visual_receipt_sha256", "barrier_phase", "failure_code",
        "created_at", "updated_at",
    ]
    # Forbidden columns must never exist.
    for banned in ("token", "token_digest", "file_name", "path", "cookie", "stderr"):
        assert banned not in columns


def test_store_round_trips_and_increments_sequence(store: LocalMediaImportStore) -> None:
    created = store.create_import(
        task_id=TASK_ID,
        source_identity=SOURCE_IDENTITY,
        byte_length=1024,
        declared_media_type="video/mp4",
        dependency_generation=GENERATION,
        import_id=IMPORT_ID,
    )
    assert created["sequence"] == 0
    assert created["state"] == "awaiting_upload"

    updated = store.transition(
        IMPORT_ID,
        expected_sequence=0,
        state="uploading",
        uploaded_bytes=512,
    )
    assert updated["state"] == "uploading"
    assert updated["uploadedBytes"] == 512
    assert updated["sequence"] == 1


def test_store_compare_and_set_rejects_a_stale_sequence(store: LocalMediaImportStore) -> None:
    store.create_import(
        task_id=TASK_ID, source_identity=SOURCE_IDENTITY, byte_length=1024,
        declared_media_type="video/mp4", dependency_generation=GENERATION,
        import_id=IMPORT_ID,
    )
    store.transition(IMPORT_ID, expected_sequence=0, state="uploading", uploaded_bytes=1)

    with pytest.raises(C.ImportError) as error:
        store.transition(IMPORT_ID, expected_sequence=0, state="verifying", uploaded_bytes=2)
    assert error.value.code == "V3_MEDIA_IMPORT_NOT_FOUND"


def test_store_allows_only_one_active_import_per_task(store: LocalMediaImportStore) -> None:
    store.create_import(
        task_id=TASK_ID, source_identity=SOURCE_IDENTITY, byte_length=1024,
        declared_media_type="video/mp4", dependency_generation=GENERATION,
        import_id=IMPORT_ID,
    )
    with pytest.raises(C.ImportError) as error:
        store.create_import(
            task_id=TASK_ID, source_identity=SOURCE_IDENTITY, byte_length=2048,
            declared_media_type="video/mp4", dependency_generation=GENERATION,
            import_id="media_import_" + "f" * 32,
        )
    assert error.value.code == "V3_MEDIA_IMPORT_ACTIVE"


def test_store_startup_scan_fails_incomplete_records_and_keeps_terminal(store: LocalMediaImportStore) -> None:
    store.create_import(
        task_id=TASK_ID, source_identity=SOURCE_IDENTITY, byte_length=1024,
        declared_media_type="video/mp4", dependency_generation=GENERATION,
        import_id=IMPORT_ID,
    )
    store.create_import(
        task_id="media_task_" + "e" * 32, source_identity="portal:bilibili:BV1other0000:cid:1",
        byte_length=2048, declared_media_type="video/mp4",
        dependency_generation=GENERATION, import_id="media_import_" + "e" * 32,
    )
    # A terminal record must survive the scan untouched.
    store.transition("media_import_" + "e" * 32, expected_sequence=0,
                     state="cancelled", failure_code="V3_MEDIA_IMPORT_CANCELLED")

    interrupted = store.reconcile_after_restart()

    assert IMPORT_ID in interrupted
    assert store.get(IMPORT_ID)["state"] == "failed"
    assert store.get(IMPORT_ID)["failureCode"] == "V3_MEDIA_IMPORT_RUNTIME_RESTARTED"
    # B26: a terminal record is NOT rewritten, and GET is never 404.
    assert "media_import_" + "e" * 32 not in interrupted
    assert store.get("media_import_" + "e" * 32)["state"] == "cancelled"


def test_store_missing_import_raises_not_found(store: LocalMediaImportStore) -> None:
    with pytest.raises(C.ImportError) as error:
        store.get("media_import_" + "0" * 32)
    assert error.value.code == "V3_MEDIA_IMPORT_NOT_FOUND"
    assert error.value.http_status == 404


def _raw(store: LocalMediaImportStore) -> sqlite3.Connection:
    return sqlite3.connect(store.database_path)
