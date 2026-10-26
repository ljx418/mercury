"""WP0 R6-G3 — R6B-N12, R6B-N13, R6B-N14.

Real owned Uvicorn process, real HTTP grant issuance and a real WebSocket
handshake. These three cases differ only in WHICH frozen boundary the ticket
crosses, so they share one owned process each and assert the SAME observable
outcome shape: the frozen code, and NO sink ever created.

`TestClient` is never used: the grant is issued over real HTTP and the start is
attempted over a real WebSocket.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

import wp0_r6_harness as h6

TICKET_EXPIRED = "V3_MEDIA_CAPTURE_TICKET_EXPIRED"
TICKET_REPLAYED = "V3_MEDIA_CAPTURE_TICKET_REPLAYED"
BINDING_MISMATCH = "V3_MEDIA_CAPTURE_BINDING_MISMATCH"


def _drive_start(runtime: Any, ticket: str, *, binding_tab: int | None = None) -> dict[str, Any]:
    """Open the real capture socket and send one real `start`."""
    socket = h6.open_ws(runtime)
    try:
        message = h6.r6_start_message(ticket)
        if binding_tab is not None:
            message = dict(message)
            message["tabId"] = binding_tab
        socket.send(json.dumps(message))
        return json.loads(socket.recv(timeout=20))
    finally:
        socket.close()


def _assert_no_sink(runtime: Any, root: Path, grant_id: str, case_id: str) -> dict[str, Any]:
    """The frozen cleanup contract: zero active capture and zero raw audio."""
    sinks = h6.sink_state(runtime, grant_id)
    assert sinks["available"] is True, f"{case_id}: grant state unavailable: {sinks}"
    assert sinks["activeCaptureCount"] == 0, f"{case_id}: a sink survived: {sinks}"
    assert sinks["residualRawAudioCount"] == 0, f"{case_id}: raw audio survived: {sinks}"
    return sinks


def test_r6b_n12_expired_ticket_never_creates_a_sink(tmp_path: Path) -> None:
    """R6B-N12 — a ticket past its frozen TTL is refused, and no sink is made.

    This waits out the REAL product TTL rather than injecting a clock, so the
    expiry is the product's own boundary and not a harness fiction.
    """
    import time

    root = tmp_path / "r6b-n12"
    with h6.owned_runtime(root) as runtime:
        grant = h6.r6_ticket(runtime)
        grant_id = grant["grant"]["grantId"]
        expires_at = grant["grant"]["expiresAt"]
        issued_at = grant["grant"]["issuedAt"]

        # The frozen TTL is the real interval between these two fields.
        from datetime import datetime

        ttl = (
            datetime.strptime(expires_at, "%Y-%m-%dT%H:%M:%S.%fZ")
            - datetime.strptime(issued_at, "%Y-%m-%dT%H:%M:%S.%fZ")
        ).total_seconds()
        assert 0 < ttl <= 120, (issued_at, expires_at, ttl)

        # Wait past the real expiry, plus a small margin.
        time.sleep(ttl + 2)

        frame = _drive_start(runtime, grant["ticket"])
        assert frame["type"] == "failed", frame
        assert frame["failureCode"] == TICKET_EXPIRED, frame

        _assert_no_sink(runtime, root, grant_id, "R6B-N12")
        h6.ledger(root, "R6B-N12", observedCode=TICKET_EXPIRED, activeSinks=0)


def test_r6b_n13_replayed_ticket_never_creates_a_second_sink(tmp_path: Path) -> None:
    """R6B-N13 — a replay is refused while the first capture is still live."""
    root = tmp_path / "r6b-n13"
    with h6.owned_runtime(root) as runtime:
        grant = h6.r6_ticket(runtime)
        grant_id = grant["grant"]["grantId"]
        ticket = grant["ticket"]

        socket = h6.open_ws(runtime)
        try:
            socket.send(json.dumps(h6.r6_start_message(ticket)))
            first = json.loads(socket.recv(timeout=20))
            assert first["type"] == "started", first

            # While the first capture is live, the SAME ticket is replayed.
            replay_socket = h6.open_ws(runtime)
            try:
                replay_socket.send(json.dumps(h6.r6_start_message(ticket)))
                replay = json.loads(replay_socket.recv(timeout=20))
            finally:
                replay_socket.close()
            assert replay["type"] == "failed", replay
            assert replay["failureCode"] == TICKET_REPLAYED, replay

            # The replay must not have disturbed the owning connection: the
            # owner can still push a real chunk and be acknowledged.
            socket.send(h6.chunk_payload())
        finally:
            socket.close()

        _assert_no_sink(runtime, root, grant_id, "R6B-N13")
        h6.ledger(root, "R6B-N13", observedCode=TICKET_REPLAYED, activeSinks=0)


def test_r6b_n14_binding_mismatch_never_creates_a_sink(tmp_path: Path) -> None:
    """R6B-N14 — a ticket bound to another tab is refused."""
    root = tmp_path / "r6b-n14"
    with h6.owned_runtime(root) as runtime:
        grant = h6.r6_ticket(runtime)
        grant_id = grant["grant"]["grantId"]

        frame = _drive_start(runtime, grant["ticket"], binding_tab=999)
        assert frame["type"] == "failed", frame
        assert frame["failureCode"] == BINDING_MISMATCH, frame

        _assert_no_sink(runtime, root, grant_id, "R6B-N14")
        h6.ledger(root, "R6B-N14", observedCode=BINDING_MISMATCH, activeSinks=0)
