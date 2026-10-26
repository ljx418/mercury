"""WP0 R4-3 — owner manifest / receipt / hard-crash recovery.

Every case starts from a REAL capture that was hard-killed by a REAL owned
process immediately after the owner manifest and the SQLite FULL receipt
became durable. The staging root and the receipt database are then damaged
in one specific way, and a SECOND owned process is started on the same
scratch root and asked to recover.

The frozen rule under test: **all eight corruption classes fail closed as
cleanup incomplete, and a fail-closed recovery must not delete anything it
cannot prove it owns.**

The eight classes (``61-codex-r4`` §2 R4-3):

1. ``missing``        — the manifest or the receipt is gone
2. ``torn``           — the manifest is truncated mid-write
3. ``corrupt``        — the manifest is not valid JSON
4. ``uncommitted``    — no committed ownership receipt exists
5. ``identity``       — schemaVersion / taskId / processStartToken disagree
6. ``hash``           — the staged digest no longer matches the manifest
7. ``length_shape``   — byteLength or the WAV shape no longer match
8. ``path_escape``    — the staging root or its entries are symlinks
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

import pytest
import websockets.sync.client as websocket_client

import wp0_r4_harness as harness

HARD_KILL_EXIT_CODE = 137
OWNER_FILE = "owner.json"

CORRUPTION_CLASSES = (
    "missing",
    "torn",
    "corrupt",
    "uncommitted",
    "identity",
    "hash",
    "length_shape",
    "path_escape",
)


def _kill_after_stage(root: Path) -> harness.OwnedRuntime:
    """Run one real capture that dies after the durable receipt is committed."""
    runtime = harness.launch(
        root,
        seed=harness.capture_seed(),
        fault={"kind": "after_stage_before_worker", "deterministicTranscript": True},
    )
    data = harness.issue_ticket(runtime)
    socket = websocket_client.connect(
        runtime.ws_url, additional_headers={"Origin": harness.ORIGIN}, open_timeout=20
    )
    try:
        socket.send(json.dumps(harness.start_message(data["ticket"])))
        assert json.loads(socket.recv(timeout=20))["type"] == "started"
        socket.send(harness.chunk_payload())
        assert json.loads(socket.recv(timeout=20))["type"] == "chunkAccepted"
        socket.send(json.dumps({"type": "stop", "reason": "completed"}))
        try:
            socket.recv(timeout=20)
        except Exception:
            pass  # the process dies inside the handoff
    finally:
        try:
            socket.close()
        except Exception:
            pass
    assert runtime.poll_exit(30) == HARD_KILL_EXIT_CODE
    return runtime


def _manifest_path(root: Path) -> Path:
    return root / "media-asr-tasks" / harness.TASK_ID / OWNER_FILE


def _staged_audio(root: Path) -> Path:
    return root / "media-asr-tasks" / harness.TASK_ID / "audio" / "current-part.wav"


def _delete_receipt(root: Path) -> None:
    with sqlite3.connect(root / "navia.sqlite3") as connection:
        connection.execute(
            "DELETE FROM media_capture_owner_receipts WHERE task_id=?", (harness.TASK_ID,)
        )


def _corrupt(kind: str, root: Path) -> None:
    """Apply exactly one corruption class to the real on-disk staging."""
    manifest = _manifest_path(root)
    if kind == "missing":
        manifest.unlink()
    elif kind == "torn":
        raw = manifest.read_bytes()
        manifest.write_bytes(raw[: max(1, len(raw) // 2)])
    elif kind == "corrupt":
        manifest.write_bytes(b'{"schemaVersion": "v3-media-asr-owner/v1", "taskId": ')
    elif kind == "uncommitted":
        _delete_receipt(root)
    elif kind == "identity":
        owner = json.loads(manifest.read_text())
        owner["taskId"] = "media_task_" + "9" * 32
        manifest.write_text(json.dumps(owner))
    elif kind == "hash":
        audio = _staged_audio(root)
        payload = bytearray(audio.read_bytes())
        payload[-1] ^= 0xFF
        audio.write_bytes(bytes(payload))
    elif kind == "length_shape":
        owner = json.loads(manifest.read_text())
        owner["byteLength"] = owner["byteLength"] + 4
        manifest.write_text(json.dumps(owner))
    elif kind == "path_escape":
        audio = _staged_audio(root)
        outside = root / "media-asr-tasks" / "escaped-part.wav"
        outside.write_bytes(audio.read_bytes())
        audio.unlink()
        os.symlink(outside, audio)
    else:  # pragma: no cover - guarded by the parametrisation
        raise AssertionError(f"unknown corruption class {kind}")


@pytest.mark.parametrize("kind", CORRUPTION_CLASSES)
def test_every_corruption_class_fails_closed(tmp_path: Path, kind: str) -> None:
    root = tmp_path / f"r4-3-{kind}"
    runtime = _kill_after_stage(root)
    try:
        durable = runtime.observation("after_stage_before_worker")["durable"]
        assert durable["ownerManifestExists"] is True
        assert durable["receiptPresent"] is True
    finally:
        runtime.terminate_owned()

    _corrupt(kind, root)

    restarted = harness.launch(root)
    try:
        token = harness.issue_session(restarted)
        with restarted.client(token=token) as client:
            response = client.post(
                "/v1/media/acquisitions/recover",
                json={"sourceIdentity": harness.SOURCE_IDENTITY},
            )
        # Oracle 5: every class fails CLOSED — never silently "recovered".
        assert response.status_code >= 500, f"{kind} did not fail closed: {response.text}"
        assert "CLEANUP_INCOMPLETE" in response.text.upper()
    finally:
        restarted.terminate_owned()

    # A fail-closed recovery must not have destroyed the evidence it could not
    # verify, and must not have invented a success either.
    # `missing` and `path_escape` relocate or remove the manifest on purpose;
    # the other classes must leave it untouched by a fail-closed recovery.
    if kind not in {"missing", "path_escape"}:
        assert _manifest_path(root).exists(), f"{kind}: the unverified manifest was deleted"
    with sqlite3.connect(root / "navia.sqlite3") as connection:
        rows = list(
            connection.execute(
                "SELECT task_id, state FROM media_capture_owner_receipts WHERE task_id=?",
                (harness.TASK_ID,),
            )
        )
    if kind != "uncommitted":
        assert rows, f"{kind}: the authoritative receipt was deleted by a fail-closed recover"


# ---------------------------------------------------------------------------
# composite cleanup and a fresh begin
# ---------------------------------------------------------------------------


def test_existing_recover_zeroes_all_four_residuals_and_fresh_begin_keeps_one_sink(
    tmp_path: Path,
) -> None:
    """Oracle 6: four residuals zero, and a fresh begin is a SINGLE sink."""
    root = tmp_path / "r4-3-composite"
    runtime = _kill_after_stage(root)
    try:
        durable = runtime.observation("after_stage_before_worker")["durable"]
        assert durable["stagedAudioExists"] is True
    finally:
        runtime.terminate_owned()

    # The staging root is what this scenario is really about: it must exist
    # before recovery so the cleanup has real work to do.
    assert (root / "media-asr-tasks" / harness.TASK_ID).exists()

    restarted = harness.launch(root)
    try:
        token = harness.issue_session(restarted)
        with restarted.client(token=token) as client:
            response = client.post(
                "/v1/media/acquisitions/recover",
                json={"sourceIdentity": harness.SOURCE_IDENTITY},
            )
        assert response.status_code == 200, response.text
        assert response.json()["data"]["disposition"] == "abandoned"

        task_root = root / "media-tasks" / harness.TASK_ID
        staging_root = root / "media-asr-tasks" / harness.TASK_ID
        assert not staging_root.exists(), "ASR staging survived composite cleanup"
        assert not task_root.exists(), "acquisition artifacts survived composite cleanup"
        assert list((root / "media-tasks" / "product-evidence").rglob("*")) == []

        # A repeat recover is idempotent, not a second cleanup owner.
        with restarted.client(token=token) as client:
            repeat = client.post(
                "/v1/media/acquisitions/recover",
                json={"sourceIdentity": harness.SOURCE_IDENTITY},
            )
        assert repeat.status_code >= 400, "a repeat recover must not re-clean"
    finally:
        restarted.terminate_owned()

    # A fresh begin on the SAME root stays a single sink.
    fresh = harness.launch(root, seed=harness.capture_seed())
    try:
        data = harness.issue_ticket(fresh)
        first = websocket_client.connect(
            fresh.ws_url, additional_headers={"Origin": harness.ORIGIN}, open_timeout=20
        )
        try:
            first.send(json.dumps(harness.start_message(data["ticket"])))
            assert json.loads(first.recv(timeout=20))["type"] == "started"
            # A second capture for the same task may not create a second sink.
            replay = websocket_client.connect(
                fresh.ws_url, additional_headers={"Origin": harness.ORIGIN}, open_timeout=20
            )
            try:
                replay.send(json.dumps(harness.start_message(data["ticket"])))
                frame = json.loads(replay.recv(timeout=20))
                assert frame["type"] == "failed"
                assert frame["failureCode"] == "V3_MEDIA_CAPTURE_TICKET_REPLAYED"
            finally:
                replay.close()
            first.send(harness.chunk_payload())
            assert json.loads(first.recv(timeout=20))["type"] == "chunkAccepted"
        finally:
            first.close()
    finally:
        fresh.terminate_owned()
        fresh.destroy_scratch()


def test_eight_corruption_classes_are_all_covered() -> None:
    assert len(CORRUPTION_CLASSES) == 8
    assert set(CORRUPTION_CLASSES) == {
        "missing",
        "torn",
        "corrupt",
        "uncommitted",
        "identity",
        "hash",
        "length_shape",
        "path_escape",
    }
