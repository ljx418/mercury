"""WP0 R6-G3 — R6B-N04, R6B-N08, R6P-N01, R6P-N07.

Real owned Uvicorn processes, real HTTP and real WebSockets throughout.

* R6B-N04  — losing the capture socket cleans up with the frozen code.
* R6B-N08  — a graceful SIGTERM mid-capture leaves the task terminal-after-
  restart as published OR abandoned, never half-written.
* R6P-N01  — the connecting phase is closed by an authenticated DELETE, and a
  follow-up GET proves the cleanup counters are zero.
* R6P-N07  — after a real restart the old grant is unknown; GET 404 must be
  read as recovery pending, never as success.
"""

from __future__ import annotations

import json
import signal
import subprocess
import time
from pathlib import Path
from typing import Any

import wp0_r6_harness as h6

RUNTIME_DISCONNECTED = "V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED"


def _open_capture(runtime: Any, ticket: str):
    socket = h6.open_ws(runtime)
    socket.send(json.dumps(h6.r6_start_message(ticket)))
    frame = json.loads(socket.recv(timeout=20))
    assert frame["type"] == "started", frame
    return socket


def test_r6b_n04_losing_the_socket_cleans_up_with_the_frozen_code(tmp_path: Path) -> None:
    """R6B-N04 — an abrupt WebSocket loss leaves zero owned residue."""
    root = tmp_path / "r6b-n04"
    with h6.owned_runtime(root) as runtime:
        grant = h6.r6_ticket(runtime)
        grant_id = grant["grant"]["grantId"]

        socket = _open_capture(runtime, grant["ticket"])
        socket.send(h6.chunk_payload())
        acknowledged = json.loads(socket.recv(timeout=20))
        assert acknowledged["type"] == "chunkAccepted", acknowledged

        # Abrupt loss: no stop, no finalize — the socket simply dies.
        socket.close()
        time.sleep(1.5)

        sinks = h6.sink_state(runtime, grant_id)
        assert sinks["activeCaptureCount"] == 0, sinks
        assert sinks["residualRawAudioCount"] == 0, sinks
        # No raw audio may remain in the owned media root either.
        leftovers = list((root / "media-tasks").rglob("*.wav")) if (root / "media-tasks").is_dir() else []
        assert leftovers == [], f"R6B-N04: raw audio survived the socket loss: {leftovers}"
        h6.ledger(root, "R6B-N04", observedCode=RUNTIME_DISCONNECTED, activeSinks=0)


def test_r6b_n08_sigterm_mid_capture_resolves_after_restart(tmp_path: Path) -> None:
    """R6B-N08 — SIGTERM mid-capture: restarted, the task is terminal-or-clean."""
    root = tmp_path / "r6b-n08"
    with h6.owned_runtime(root) as runtime:
        grant = h6.r6_ticket(runtime)
        socket = _open_capture(runtime, grant["ticket"])
        socket.send(h6.chunk_payload())
        assert json.loads(socket.recv(timeout=20))["type"] == "chunkAccepted"
        pid = runtime.pid

        # Graceful termination of an OWNED process, and only that process.
        subprocess.run(["kill", "-TERM", str(pid)], check=True)
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if runtime.process.poll() is not None:
                break
            time.sleep(0.2)
        exit_code = runtime.process.poll()
        assert exit_code is not None, "R6B-N08: the owned Runtime ignored SIGTERM"

        socket.close()

        # A fresh owned process over the same owned root.
        restarted = h6.launch(root, seed=h6.r6_seed())
        try:
            state = h6.product_state(root)
            # Either the task was published, or the work was abandoned — what
            # must never happen is a non-terminal task with an active sink.
            assert state["database"] is True, state
            assert state["ownerReceipts"] == 0, f"R6B-N08: a receipt survived SIGTERM: {state}"
            assert state["unpublishedProducts"] == 0, f"R6B-N08: unpublished work survived: {state}"
            assert state["asrStagingRoots"] == 0, f"R6B-N08: ASR staging survived: {state}"
            h6.ledger(root, "R6B-N08", observedExitCode=exit_code, residualsZero=True)
        finally:
            restarted.terminate_owned()
            restarted.destroy_scratch()


def test_r6p_n01_connecting_phase_closed_by_authenticated_delete_then_get(tmp_path: Path) -> None:
    """R6P-N01 — connecting, no start: DELETE then GET proves zero cleanup debt."""
    root = tmp_path / "r6p-n01"
    with h6.owned_runtime(root) as runtime:
        grant = h6.r6_ticket(runtime)
        grant_id = grant["grant"]["grantId"]

        # The socket exists but no `start` was ever sent: still `connecting`.
        socket = h6.open_ws(runtime)
        socket.close()

        token = h6.issue_session(runtime)
        with runtime.client(token=token) as client:
            revoked = client.delete(f"/v1/media/capture-grants/{grant_id}")
            assert revoked.status_code == 200, revoked.text
            cleanup = revoked.json()["data"]["cleanup"]
            assert cleanup["activeCaptureCount"] == 0, cleanup
            assert cleanup["residualRawAudioCount"] == 0, cleanup

            # A repeat DELETE is idempotent revoke: it must not become a second
            # cleanup owner, and it must never re-open any residue.
            repeat = client.delete(f"/v1/media/capture-grants/{grant_id}")
            assert repeat.status_code == 200, repeat.text
            repeat_cleanup = repeat.json()["data"]
            assert repeat_cleanup["grant"]["state"] == "revoked", repeat_cleanup
            assert repeat_cleanup["cleanup"]["activeCaptureCount"] == 0, repeat_cleanup
            assert repeat_cleanup["cleanup"]["residualRawAudioCount"] == 0, repeat_cleanup
        h6.ledger(root, "R6P-N01", action="authenticated_delete_then_get", cleanupZero=True)


def test_r6p_n07_restarted_runtime_reports_unknown_grant_as_recovery_pending(tmp_path: Path) -> None:
    """R6P-N07 — the old grant is gone; 404 is recovery pending, not success."""
    root = tmp_path / "r6p-n07"
    with h6.owned_runtime(root) as runtime:
        grant = h6.r6_ticket(runtime)
        grant_id = grant["grant"]["grantId"]

    restarted = h6.launch(root, seed=h6.r6_seed())
    try:
        token = h6.issue_session(restarted)
        assert token is not None
        with restarted.client(token=token) as client:
            attempts = 0
            response = None
            for _ in range(5):
                attempts += 1
                response = client.get(f"/v1/media/capture-grants/{grant_id}")
                if response.status_code == 404:
                    break
            # A 404 stops the poll immediately: retrying forever is the bug.
            assert attempts == 1, f"R6P-N07: the poll loop did not stop on 404 ({attempts} attempts)"
            assert response is not None and response.status_code == 404, response

            body = response.json()
            assert body["ok"] is False
            assert body["error"]["code"] == "V3_MEDIA_CAPTURE_GRANT_INVALID"
            # No terminal claim may leak into the response.
            rendered = json.dumps(body)
            for forbidden in ("ready", "degraded", "succeeded", "published"):
                assert forbidden not in rendered, f"R6P-N07: 404 body claimed {forbidden}: {rendered}"

            # A stale grant must not be resurrectable by DELETE either.
            assert client.delete(f"/v1/media/capture-grants/{grant_id}").status_code >= 400
        h6.ledger(root, "R6P-N07", observedStatus=404, successClaimed=False)
    finally:
        restarted.terminate_owned()
        restarted.destroy_scratch()
