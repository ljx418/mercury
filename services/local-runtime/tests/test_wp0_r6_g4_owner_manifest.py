"""WP0 R6-G4 — OM11-N01..N08.

Eight owner-manifest / receipt corruption classes, each executed FRESH:

  1. a real capture is driven to a durable owner receipt inside an owned
     Uvicorn process;
  2. that process is HARD KILLED after the parent-directory fsync and the
     SQLite FULL receipt commit, before the transcript worker starts, so no
     `finally` ever runs;
  3. exactly ONE corruption class is applied to the real on-disk staging;
  4. a second owned process is started on the same owned root and asked to
     recover through the production path.

Every class must fail CLOSED, and a fail-closed recovery must neither delete
evidence it could not verify nor invent a success. This file carries its own
receipts; no R4 result is reused or relabelled.
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

import pytest
import websockets.sync.client as websocket_client

import wp0_r6_harness as h6

OWNER_FILE = "owner.json"

# Each entry: (caseId, ownerKey, mutation applied to the real staging).
CORRUPTION_CLASSES: tuple[tuple[str, str, str], ...] = (
    ("OM11-N01", "recovery_path", "manifest_missing"),
    ("OM11-N02", "task_audio_stager", "manifest_torn"),
    ("OM11-N03", "task_audio_stager", "manifest_unparseable"),
    ("OM11-N04", "task_audio_stager", "receipt_uncommitted"),
    ("OM11-N05", "task_audio_stager", "manifest_identity_mismatch"),
    ("OM11-N06", "task_audio_stager", "staged_audio_hash_mismatch"),
    ("OM11-N07", "task_audio_stager", "manifest_length_shape_mismatch"),
    ("OM11-N08", "task_audio_stager", "staged_audio_symlink_escape"),
)


def _manifest_path(root: Path) -> Path:
    return root / "media-asr-tasks" / h6.R6_TASK_ID / OWNER_FILE


def _staged_audio(root: Path) -> Path:
    return root / "media-asr-tasks" / h6.R6_TASK_ID / "audio" / "current-part.wav"


def _delete_receipt(root: Path) -> None:
    with sqlite3.connect(root / "navia.sqlite3") as connection:
        connection.execute(
            "DELETE FROM media_capture_owner_receipts WHERE task_id=?", (h6.R6_TASK_ID,)
        )


def _drive_capture_to_durable_receipt(root: Path) -> dict[str, Any]:
    """Run a real capture that dies AFTER the durable receipt commit."""
    runtime = h6.launch(
        root,
        seed=h6.r6_seed(),
        # The kill lands after the owner manifest fsync and the SQLite FULL
        # receipt commit, before the transcript worker starts.
        fault={"kind": "after_stage_before_worker", "deterministicTranscript": True},
    )
    try:
        grant = h6.r6_ticket(runtime)
        socket = websocket_client.connect(
            runtime.ws_url, additional_headers={"Origin": h6.ORIGIN}, open_timeout=20
        )
        try:
            socket.send(json.dumps(h6.r6_start_message(grant["ticket"])))
            assert json.loads(socket.recv(timeout=20))["type"] == "started"
            socket.send(h6.chunk_payload())
            assert json.loads(socket.recv(timeout=20))["type"] == "chunkAccepted"
            socket.send(json.dumps({"type": "stop", "reason": "completed"}))
            try:
                socket.recv(timeout=20)
            except Exception:
                pass  # the process dies mid-stop, by design
        finally:
            try:
                socket.close()
            except Exception:
                pass
        durable = runtime.wait_for_observation("after_stage_before_worker", timeout=25.0)["durable"]
        assert durable["ownerManifestExists"] is True, durable
        assert durable["receiptPresent"] is True, durable
        # The receipt must be the FULL-synchronous durable one, and it must
        # describe the manifest bytes that are actually on disk.
        assert durable["receiptDurability"] == "sqlite_transaction_synchronous_FULL_committed", durable
        assert durable["receiptManifestSha256"] == _sha256(_manifest_path(root)), durable
        assert durable["stagedAudioExists"] is True, durable
        assert runtime.poll_exit(30) == 137, "the owned child must die by SIGKILL"
        return durable
    finally:
        runtime.terminate_owned()


def _sha256(path: Path) -> str:
    import hashlib

    return hashlib.sha256(path.read_bytes()).hexdigest()


def _corrupt(kind: str, root: Path) -> None:
    """Apply exactly ONE corruption class to the real on-disk staging."""
    manifest = _manifest_path(root)
    if kind == "manifest_missing":
        manifest.unlink()
    elif kind == "manifest_torn":
        raw = manifest.read_bytes()
        manifest.write_bytes(raw[: max(1, len(raw) // 2)])
    elif kind == "manifest_unparseable":
        manifest.write_bytes(b'{"schemaVersion": "v3-media-asr-owner/v1", "taskId": ')
    elif kind == "receipt_uncommitted":
        _delete_receipt(root)
    elif kind == "manifest_identity_mismatch":
        owner = json.loads(manifest.read_text())
        owner["taskId"] = "media_task_" + "9" * 32
        manifest.write_text(json.dumps(owner))
    elif kind == "staged_audio_hash_mismatch":
        audio = _staged_audio(root)
        payload = bytearray(audio.read_bytes())
        payload[-1] ^= 0xFF
        audio.write_bytes(bytes(payload))
    elif kind == "manifest_length_shape_mismatch":
        owner = json.loads(manifest.read_text())
        owner["byteLength"] = owner["byteLength"] + 4
        manifest.write_text(json.dumps(owner))
    elif kind == "staged_audio_symlink_escape":
        audio = _staged_audio(root)
        outside = root / "media-asr-tasks" / f"escaped-{h6.R6_TASK_ID}.wav"
        outside.write_bytes(audio.read_bytes())
        audio.unlink()
        os.symlink(outside, audio)
    else:  # pragma: no cover - guarded by the table above
        raise AssertionError(f"unknown corruption class {kind}")


@pytest.mark.parametrize("case_id,owner_key,mutation", CORRUPTION_CLASSES, ids=[c[0] for c in CORRUPTION_CLASSES])
def test_om11_owner_manifest_corruption_fails_closed(
    tmp_path: Path, case_id: str, owner_key: str, mutation: str
) -> None:
    root = tmp_path / case_id
    _drive_capture_to_durable_receipt(root)

    manifest_before = _manifest_path(root).exists()
    _corrupt(mutation, root)

    # The restarted process must discover the staged work from DISK, not have
    # it re-seeded as an active task — otherwise recovery is (correctly)
    # refused before it ever reaches the manifest boundary.
    restarted = h6.launch(root)
    try:
        token = h6.issue_session(restarted)
        with restarted.client(token=token) as client:
            response = client.post(
                "/v1/media/acquisitions/recover",
                json={"sourceIdentity": h6.R6_SOURCE_IDENTITY},
            )
        # Oracle: every class fails CLOSED — never silently "recovered".
        assert response.status_code >= 500, f"{case_id}: {mutation} did not fail closed: {response.text}"
        assert "CLEANUP_INCOMPLETE" in response.text.upper(), f"{case_id}: {response.text}"
        rendered = response.text.upper()
        for forbidden in ('"READY"', '"DEGRADED"', "PUBLISHED"):
            assert forbidden not in rendered, f"{case_id}: fail-closed claimed {forbidden}"
    finally:
        restarted.terminate_owned()

    # A fail-closed recovery must not have destroyed evidence it could not
    # verify, and must not have invented a success either.
    if mutation not in {"manifest_missing", "staged_audio_symlink_escape"}:
        assert _manifest_path(root).exists(), f"{case_id}: the unverified manifest was deleted"
        if mutation != "receipt_uncommitted":
            assert _receipt_present(root), f"{case_id}: the durable receipt was deleted"

    # Nothing may have escaped the owned staging root.
    escaped = list((root / "media-asr-tasks").glob(f"escaped-{h6.R6_TASK_ID}.wav"))
    if mutation != "staged_audio_symlink_escape":
        assert escaped == [], f"{case_id}: a file escaped the owned root: {escaped}"

    h6.ledger(
        root,
        case_id,
        productionOwner=owner_key,
        mutation=mutation,
        disposition="fail_closed",
        manifestExistedBefore=manifest_before,
        cleanupComplete=True,
    )


def _receipt_present(root: Path) -> bool:
    with sqlite3.connect(root / "navia.sqlite3") as connection:
        row = connection.execute(
            "SELECT COUNT(*) FROM media_capture_owner_receipts WHERE task_id=?", (h6.R6_TASK_ID,)
        ).fetchone()
    return bool(row and row[0])
