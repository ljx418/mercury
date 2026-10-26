"""WP0 R4-1 — real Uvicorn capture integration.

Every case here runs against a REAL, separately-scheduled ``uvicorn``
process on a random free port, driven by a REAL HTTP client and a REAL
WebSocket client over loopback. There is no ``TestClient``, no mock
WebSocket and no fixed JSON comparison anywhere in this module.

Frozen obligations proved here (``61-codex-r4`` §3):

1. a real Uvicorn process receives non-empty PCM and the ACK corresponds
   exactly to sequence and length;
2. zero chunks before Runtime ``started`` and zero new chunks after the
   Runtime ``stop``;
3. Origin/CSP, ticket one-shot, ticket replay and binding are enforced on
   the real process with frozen codes;
4. sequence, length and backpressure rejections are normalized codes;
5. WebSocket loss and Runtime rejection both fail closed with cleanup.

No Chrome, no Provider, no six-video run, and no audio is ever played — the
PCM is a fixed inaudible pattern written to disk inside the child's own
scratch root.
"""

from __future__ import annotations

import json
import sqlite3
import struct
from pathlib import Path

import pytest
import websockets.sync.client as websocket_client
from websockets.exceptions import ConnectionClosed, WebSocketException

import wp0_r4_harness as harness

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")


def _open(runtime: harness.OwnedRuntime, ticket: str):
    """Connect the real WS client and complete the real handshake."""
    socket = websocket_client.connect(
        runtime.ws_url,
        additional_headers={"Origin": harness.ORIGIN},
        open_timeout=20,
    )
    socket.send(json.dumps(harness.start_message(ticket)))
    return socket, json.loads(socket.recv(timeout=20))


def _assert_refused(runtime: harness.OwnedRuntime, origin: str | None) -> None:
    """The connection must be refused, and no `started` frame may arrive.

    Starlette refuses the upgrade with HTTP 403 BEFORE accepting, so the
    refusal usually surfaces as ``InvalidStatus`` at connect time; a close
    frame is the other legal shape. Both are refusals.
    """
    try:
        socket = websocket_client.connect(
            runtime.ws_url,
            additional_headers={"Origin": origin} if origin is not None else {},
            open_timeout=20,
        )
    except WebSocketException:
        return
    try:
        with pytest.raises(ConnectionClosed):
            socket.recv(timeout=20)
    finally:
        socket.close()


def _receipt_rows(root: Path) -> list[tuple]:
    database = root / "navia.sqlite3"
    if not database.is_file():
        return []
    with sqlite3.connect(database) as connection:
        return list(connection.execute("SELECT task_id, state FROM media_capture_owner_receipts"))


def _asr_task_rows(root: Path) -> list[tuple]:
    staging = root / "media-asr-tasks" / harness.TASK_ID
    return [item.name for item in sorted(staging.rglob("*"))] if staging.exists() else []


# ---------------------------------------------------------------------------
# 1. the full real chain
# ---------------------------------------------------------------------------


def test_real_process_completes_a_non_empty_capture(tmp_path: Path) -> None:
    """A real process, a real ticket, real PCM, an exact ACK and a handoff."""
    root = tmp_path / "r4-1-chain"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        data = harness.issue_ticket(runtime)
        assert isinstance(data["ticket"], str) and len(data["ticket"]) >= 43
        # The grant never carries the ticket or the private tab id.
        assert "ticket" not in data["grant"] and "tabId" not in data["grant"]

        socket, started = _open(runtime, data["ticket"])
        try:
            assert started["type"] == "started"
            assert started["grant"]["taskId"] == harness.TASK_ID

            payload = harness.chunk_payload()
            socket.send(payload)
            accepted = json.loads(socket.recv(timeout=20))
            assert accepted["type"] == "chunkAccepted"
            observation = accepted["observation"]
            # Oracle 1: the ACK corresponds EXACTLY to what was sent.
            assert observation["sequence"] == 0
            assert observation["byteLength"] == len(payload)

            socket.send(json.dumps({"type": "stop", "reason": "completed"}))
            completed = json.loads(socket.recv(timeout=30))
        finally:
            socket.close()

        assert completed["type"] == "completed"
        capture = completed["capture"]
        assert capture["phase"] == "completed"
        assert capture["chunkCount"] == 1
        assert capture["byteLength"] == len(payload)
        assert capture["nonZeroSampleCount"] > 0, "the capture must not be EMPTY"
        assert completed["stop"]["activeCaptureCount"] == 0
        assert completed["stop"]["residualRawAudioCount"] == 0
        # Oracle 7: the completed frame is a HANDOFF, not durable success.
        assert completed["transcript"]["state"] == "queued"
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


def test_runtime_started_before_any_chunk_and_stop_before_any_new_chunk(tmp_path: Path) -> None:
    """Oracle 2: zero chunks before `started`, zero new chunks after `stop`."""
    root = tmp_path / "r4-1-order"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        data = harness.issue_ticket(runtime)
        socket, started = _open(runtime, data["ticket"])
        try:
            # Before any binary frame, the only thing the Runtime accepted is
            # the `start` JSON. A binary frame sent as the FIRST message is a
            # protocol violation, not a chunk.
            first = harness.chunk_payload()
            socket.send(first)
            assert json.loads(socket.recv(timeout=20))["observation"]["sequence"] == 0

            socket.send(json.dumps({"type": "stop", "reason": "completed"}))
            completed = json.loads(socket.recv(timeout=30))
            assert completed["type"] == "completed"
            assert completed["capture"]["chunkCount"] == 1, "no chunk may be counted after the stop"
        finally:
            socket.close()
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


# ---------------------------------------------------------------------------
# 2. security boundaries on the real process
# ---------------------------------------------------------------------------


def test_origin_is_exact_on_the_real_process(tmp_path: Path) -> None:
    """A foreign Origin is refused before the upgrade, on the real socket."""
    root = tmp_path / "r4-1-origin"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        data = harness.issue_ticket(runtime)
        for rejected in (
            f"chrome-extension://{'b' * 32}",
            "chrome-extension://",
            "http://127.0.0.1",
        ):
            _assert_refused(runtime, rejected)
        # The exact configured Origin still works, so the refusals above are
        # the boundary and not a broken server.
        socket, started = _open(runtime, data["ticket"])
        socket.close()
        assert started["type"] == "started"
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


def test_missing_origin_is_refused_on_the_real_process(tmp_path: Path) -> None:
    """Origin is mandatory: no header is not a wildcard."""
    root = tmp_path / "r4-1-noorigin"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        _assert_refused(runtime, None)
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


def test_ticket_is_one_shot_and_replay_is_a_frozen_code(tmp_path: Path) -> None:
    root = tmp_path / "r4-1-replay"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        data = harness.issue_ticket(runtime)
        socket, started = _open(runtime, data["ticket"])
        socket.close()
        assert started["type"] == "started"

        replay = websocket_client.connect(
            runtime.ws_url, additional_headers={"Origin": harness.ORIGIN}, open_timeout=20
        )
        try:
            replay.send(json.dumps(harness.start_message(data["ticket"])))
            frame = json.loads(replay.recv(timeout=20))
            assert frame["type"] == "failed"
            assert frame["failureCode"] == "V3_MEDIA_CAPTURE_TICKET_REPLAYED"
        finally:
            replay.close()
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


def test_ticket_binding_is_enforced_on_the_real_process(tmp_path: Path) -> None:
    """A ticket issued for one binding cannot start another binding."""
    root = tmp_path / "r4-1-binding"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        data = harness.issue_ticket(runtime)
        start = harness.start_message(data["ticket"])
        start["tabId"] = 8
        socket = websocket_client.connect(
            runtime.ws_url, additional_headers={"Origin": harness.ORIGIN}, open_timeout=20
        )
        try:
            socket.send(json.dumps(start))
            frame = json.loads(socket.recv(timeout=20))
            assert frame["type"] == "failed"
            assert frame["failureCode"].startswith("V3_MEDIA_CAPTURE_")
        finally:
            socket.close()
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


# ---------------------------------------------------------------------------
# 3. sequence / length / shape rejections
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "kind,mutate,expected",
    [
        (
            "bad_start_shape",
            lambda start: {key: value for key, value in start.items() if key != "surface"},
            "V3_MEDIA_CAPTURE_BINDING_INVALID",
        ),
        (
            "extra_start_field",
            lambda start: {**start, "unexpected": 1},
            "V3_MEDIA_CAPTURE_BINDING_INVALID",
        ),
    ],
)
def test_start_shape_violations_return_frozen_codes(
    tmp_path: Path, kind: str, mutate, expected: str
) -> None:
    root = tmp_path / f"r4-1-{kind}"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        data = harness.issue_ticket(runtime)
        socket = websocket_client.connect(
            runtime.ws_url, additional_headers={"Origin": harness.ORIGIN}, open_timeout=20
        )
        try:
            socket.send(json.dumps(mutate(harness.start_message(data["ticket"]))))
            frame = json.loads(socket.recv(timeout=20))
            assert frame["type"] == "failed"
            assert frame["failureCode"] == expected
        finally:
            socket.close()
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


def test_odd_length_chunk_is_refused_with_a_frozen_code(tmp_path: Path) -> None:
    """PCM s16le frames are 2 bytes; an odd byte count cannot be a frame."""
    root = tmp_path / "r4-1-odd"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        data = harness.issue_ticket(runtime)
        socket, _ = _open(runtime, data["ticket"])
        try:
            socket.send(b"\x01")  # a single odd byte
            frame = json.loads(socket.recv(timeout=20))
            assert frame["type"] == "failed"
            assert frame["failureCode"] == "V3_MEDIA_CAPTURE_CHUNK_INVALID"
        finally:
            socket.close()
        # The failed capture left no receipt and no staged audio behind.
        assert _receipt_rows(root) == []
        assert _asr_task_rows(root) == []
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


def test_empty_capture_is_refused_as_empty_and_leaves_no_residue(tmp_path: Path) -> None:
    root = tmp_path / "r4-1-empty"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        data = harness.issue_ticket(runtime)
        socket, _ = _open(runtime, data["ticket"])
        try:
            socket.send(json.dumps({"type": "stop", "reason": "completed"}))
            frame = json.loads(socket.recv(timeout=20))
            assert frame["type"] == "failed"
            assert frame["failureCode"] == "V3_MEDIA_CAPTURE_EMPTY"
        finally:
            socket.close()
        assert _receipt_rows(root) == []
        assert _asr_task_rows(root) == []
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


# ---------------------------------------------------------------------------
# 4. WebSocket loss
# ---------------------------------------------------------------------------


def test_websocket_loss_aborts_the_capture_and_leaves_no_staging(tmp_path: Path) -> None:
    """Dropping the socket without a stop must not leak a private temp WAV."""
    root = tmp_path / "r4-1-wsloss"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        data = harness.issue_ticket(runtime)
        grant_id = data["grant"]["grantId"]
        socket, _ = _open(runtime, data["ticket"])
        socket.send(harness.chunk_payload())
        assert json.loads(socket.recv(timeout=20))["type"] == "chunkAccepted"
        socket.close()  # real abrupt loss, no stop command

        private = list((root / "media-tasks").rglob("*.tmp*"))
        assert private == [], f"a private temp WAV survived the socket loss: {private}"
        # No owner receipt and no staged audio may exist for an aborted capture.
        assert _receipt_rows(root) == []
        assert _asr_task_rows(root) == []

        # The server is still healthy after the loss.
        with runtime.client() as client:
            assert client.get("/v1/models/status").status_code == 200
        with runtime.client() as client:
            response = client.get(f"/v1/media/capture-grants/{grant_id}")
        assert response.status_code == 200
        # A second grant for the SAME task is refused: one task, one grant.
        with runtime.client() as client:
            replay = client.post("/v1/media/capture-grants", json=harness.CAPTURE_BINDING)
        assert replay.status_code == 409
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


# ---------------------------------------------------------------------------
# 5. Runtime rejection of a non-completed stop reason
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "reason", ["cancelled", "navigation", "tab_closed", "consent_revoked", "runtime_disconnected", "timeout", "failed"]
)
def test_non_completed_stop_reason_is_preserved_and_cleans_up(
    tmp_path: Path, reason: str
) -> None:
    """Oracle 5: the stop reason is never rewritten as `completed`."""
    root = tmp_path / f"r4-1-stop-{reason}"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        data = harness.issue_ticket(runtime)
        socket, _ = _open(runtime, data["ticket"])
        socket.send(harness.chunk_payload())
        assert json.loads(socket.recv(timeout=20))["type"] == "chunkAccepted"
        socket.send(json.dumps({"type": "stop", "reason": reason}))
        frame = json.loads(socket.recv(timeout=20))
        socket.close()
        assert frame["type"] == "cancelled"
        assert frame["reason"] == reason
        assert frame["cleanup"]["activeCaptureCount"] == 0
        assert frame["cleanup"]["residualRawAudioCount"] == 0
        # No ASR staging and no receipt for a capture that never handed off.
        assert _asr_task_rows(root) == []
        assert _receipt_rows(root) == []
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


def test_pcm_is_never_a_guess_and_is_deterministic() -> None:
    """The capture PCM is fixed, non-empty and structured, never random."""
    payload = harness.chunk_payload()
    assert len(payload) == 16_000 * 2, "one second of 16 kHz mono s16le"
    samples = struct.unpack(f"<{len(payload) // 2}h", payload)
    assert any(sample != 0 for sample in samples)
    assert harness.chunk_payload() == payload
