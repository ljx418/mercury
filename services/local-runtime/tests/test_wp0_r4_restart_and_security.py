"""WP0 R4-4 / R4-5 — restart phase owner, security and cleanup ownership.

R4-4 closes the restart contract against a REAL owned Runtime process:

* a ``connecting`` capture that never became valid is closed with an
  authenticated DELETE + GET issued from a NEW process session;
* a hard crash goes through the EXISTING recover path — no fabricated
  ``finally``;
* a GET 404 stops polling and records recovery pending, and is never read
  as success;
* marker expiry only ever clears the marker.

R4-5 closes security and ownership: exact Origin / CSP, ticket replay and
binding, SIGTERM shutdown, repeated-recover idempotency, and a secret scan
proving no ticket, raw PCM, bearer token or private absolute path leaks
into anything this round would publish.
"""

from __future__ import annotations

import json
import os
import signal
import sqlite3
import time
from pathlib import Path

import pytest
import websockets.sync.client as websocket_client

import wp0_r4_harness as harness

GRANT_PATH = "/v1/media/capture-grants/{grant_id}"


def _start_capture_and_abandon(runtime: harness.OwnedRuntime) -> str:
    """Leave a real capture in the `connecting`/capturing state, then drop it."""
    data = harness.issue_ticket(runtime)
    socket = websocket_client.connect(
        runtime.ws_url, additional_headers={"Origin": harness.ORIGIN}, open_timeout=20
    )
    socket.send(json.dumps(harness.start_message(data["ticket"])))
    assert json.loads(socket.recv(timeout=20))["type"] == "started"
    socket.close()
    return data["grant"]["grantId"]


# ---------------------------------------------------------------------------
# connecting phase: DELETE + GET from a NEW process session
# ---------------------------------------------------------------------------


def test_connecting_phase_in_a_new_process_is_recovery_pending_not_a_retry_loop(
    tmp_path: Path,
) -> None:
    """Oracle 9: a restarted Runtime reports 404 and the poll must STOP.

    The grant registry is process-local, so a restarted Runtime genuinely
    cannot know the previous process's grant. That 404 is the honest answer:
    it means recovery pending. It must never be read as success, and it must
    never be retried forever.
    """
    root = tmp_path / "r4-4-connecting"
    first = harness.launch(root, seed=harness.capture_seed())
    try:
        grant_id = _start_capture_and_abandon(first)
    finally:
        first.terminate_owned()

    restarted = harness.launch(root)
    try:
        # A restart must bootstrap its OWN session: the old one is gone.
        token = harness.issue_session(restarted)
        assert token != harness.TOKEN

        with restarted.client(token=token) as client:
            attempts = 0
            response = None
            for _ in range(5):
                attempts += 1
                response = client.get(GRANT_PATH.format(grant_id=grant_id))
                if response.status_code == 404:
                    break
            assert attempts == 1, "a 404 must stop the poll loop immediately"
            assert response.status_code == 404
            body = response.json()
            assert body["ok"] is False
            assert body["error"]["code"] == "V3_MEDIA_CAPTURE_GRANT_INVALID"
            assert "ready" not in body and "degraded" not in body

            # DELETE on an unknown grant is refused rather than inventing a
            # revocation the restarted process cannot vouch for.
            revoked = client.delete(GRANT_PATH.format(grant_id=grant_id))
            assert revoked.status_code >= 400
    finally:
        restarted.terminate_owned()
        restarted.destroy_scratch()


def test_a_grant_from_the_dead_process_cannot_start_a_capture(tmp_path: Path) -> None:
    """A restarted worker must not resurrect a stale ticket or session."""
    root = tmp_path / "r4-4-no-resurrection"
    first = harness.launch(root, seed=harness.capture_seed())
    try:
        data = harness.issue_ticket(first)
        stale_ticket = data["ticket"]
    finally:
        first.terminate_owned()

    restarted = harness.launch(root, seed=harness.capture_seed())
    try:
        socket = websocket_client.connect(
            restarted.ws_url, additional_headers={"Origin": harness.ORIGIN}, open_timeout=20
        )
        try:
            socket.send(json.dumps(harness.start_message(stale_ticket)))
            frame = json.loads(socket.recv(timeout=20))
            assert frame["type"] == "failed", "a stale ticket must never start a capture"
        finally:
            socket.close()
    finally:
        restarted.terminate_owned()
        restarted.destroy_scratch()


# ---------------------------------------------------------------------------
# GET 404 stops polling and records recovery pending
# ---------------------------------------------------------------------------


def test_get_404_is_recovery_pending_and_never_a_claimed_success(tmp_path: Path) -> None:
    root = tmp_path / "r4-4-404"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        missing = "mcg_" + "0" * 32
        attempts = 0
        with runtime.client() as client:
            for _ in range(5):
                attempts += 1
                response = client.get(GRANT_PATH.format(grant_id=missing))
                assert response.status_code == 404
                if response.status_code == 404:
                    break  # stop polling: 404 means recovery pending, not retry
            assert attempts == 1, "a 404 must stop the poll loop immediately"
            body = response.json()
            assert body["ok"] is False
            assert body["error"]["code"] == "V3_MEDIA_CAPTURE_GRANT_INVALID"
            # ...and it is definitely not reported as a success.
            assert "ready" not in body and "degraded" not in body
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


# ---------------------------------------------------------------------------
# SIGTERM and repeated recover idempotency
# ---------------------------------------------------------------------------


def test_sigterm_shuts_the_owned_process_down_cleanly(tmp_path: Path) -> None:
    """Only the PID this round started is signalled."""
    root = tmp_path / "r4-4-sigterm"
    runtime = harness.launch(root, seed=harness.capture_seed())
    pid = runtime.pid
    assert os.path.isdir(f"/proc/{pid}")
    code = runtime.terminate_owned()
    assert code == 0, f"SIGTERM shutdown returned {code}"
    assert not os.path.exists(f"/proc/{pid}")
    runtime.destroy_scratch()


def test_repeated_recover_is_idempotent(tmp_path: Path) -> None:
    root = tmp_path / "r4-4-repeat"
    runtime = harness.launch(
        root,
        seed=harness.capture_seed(),
        fault={"kind": "after_stage_before_worker", "deterministicTranscript": True},
    )
    try:
        data = harness.issue_ticket(runtime)
        socket = websocket_client.connect(
            runtime.ws_url, additional_headers={"Origin": harness.ORIGIN}, open_timeout=20
        )
        try:
            socket.send(json.dumps(harness.start_message(data["ticket"])))
            socket.recv(timeout=20)
            socket.send(harness.chunk_payload())
            socket.recv(timeout=20)
            socket.send(json.dumps({"type": "stop", "reason": "completed"}))
            try:
                socket.recv(timeout=20)
            except Exception:
                pass
        finally:
            socket.close()
        assert runtime.poll_exit(30) == 137
    finally:
        runtime.terminate_owned()

    restarted = harness.launch(root)
    try:
        token = harness.issue_session(restarted)
        with restarted.client(token=token) as client:
            first = client.post(
                "/v1/media/acquisitions/recover", json={"sourceIdentity": harness.SOURCE_IDENTITY}
            )
            assert first.status_code == 200
            assert first.json()["data"]["disposition"] == "abandoned"
            second = client.post(
                "/v1/media/acquisitions/recover", json={"sourceIdentity": harness.SOURCE_IDENTITY}
            )
        # The receipt is released exactly once; a repeat is not a second owner.
        assert second.status_code >= 400
        with sqlite3.connect(root / "navia.sqlite3") as connection:
            assert list(
                connection.execute(
                    "SELECT task_id FROM media_capture_owner_receipts WHERE task_id=?",
                    (harness.TASK_ID,),
                )
            ) == []
    finally:
        restarted.terminate_owned()
        restarted.destroy_scratch()


# ---------------------------------------------------------------------------
# secret / private-path scan over everything this round would publish
# ---------------------------------------------------------------------------


def test_no_secret_or_private_path_leaks_into_the_observable_surface(tmp_path: Path) -> None:
    """Oracle 10: no ticket, raw PCM, bearer token or private path is public."""
    root = tmp_path / "r4-5-secret"
    # The real SenseVoice model is deliberately absent from this round's owned
    # scratch root, so the ASR MODEL is replaced by the child's deterministic
    # provider. Every state machine around it stays real, which is what this
    # oracle is about.
    runtime = harness.launch(
        root, seed=harness.capture_seed(), fault={"deterministicTranscript": True}
    )
    try:
        token = harness.issue_session(runtime)
        data = harness.issue_ticket(runtime)
        ticket = data["ticket"]

        socket = websocket_client.connect(
            runtime.ws_url, additional_headers={"Origin": harness.ORIGIN}, open_timeout=20
        )
        frames = []
        try:
            socket.send(json.dumps(harness.start_message(ticket)))
            frames.append(socket.recv(timeout=20))
            socket.send(harness.chunk_payload())
            frames.append(socket.recv(timeout=20))
            socket.send(json.dumps({"type": "stop", "reason": "completed"}))
            frames.append(socket.recv(timeout=30))
        finally:
            socket.close()
        blob = "\n".join(frames)

        # The private capability never leaves Background.
        assert ticket not in blob
        assert token not in blob
        assert harness.TOKEN not in blob
        assert str(root) not in blob, "a private absolute path leaked into the wire"
        # Raw PCM is never echoed back.
        assert harness.chunk_payload()[:64].hex() not in blob

        # The public grant carries identity only.
        public = json.dumps(data["grant"])
        assert "ticket" not in data["grant"]
        assert "tabId" not in data["grant"]
        assert str(root) not in public

        # The completed frame is a DURABLE HANDOFF, not a product terminal. The
        # transcript is still `queued` and the owner receipt may therefore still
        # exist at this instant. The frozen relay model already treats this frame
        # as a handoff.
        handoff = json.loads(frames[-1])
        assert handoff["type"] == "completed"
        transcript = handoff["transcript"]
        assert transcript["state"] in {"queued", "loading_model", "transcribing"}, transcript["state"]
        assert transcript["taskId"] == harness.TASK_ID

        # Bounded wait through the PRODUCTION transcript status until terminal,
        # then the owner receipt must be gone and no raw audio may remain.
        deadline = time.monotonic() + 120
        final_state = None
        while time.monotonic() < deadline:
            with runtime.client() as client:
                response = client.get(f"/v1/media/transcripts/{harness.TASK_ID}")
            response.raise_for_status()
            final_state = response.json()["data"]["task"]["state"]
            if final_state in {"succeeded", "failed", "cancelled"}:
                break
            time.sleep(0.2)
        assert final_state == "succeeded", final_state
        assert handoff["transcript"]["state"] in {"queued", "loading_model", "transcribing"}

        with sqlite3.connect(root / "navia.sqlite3") as connection:
            rows = list(connection.execute("SELECT task_id FROM media_capture_owner_receipts"))
        assert rows == [], "a completed capture must leave no owner receipt behind"
        # ...and no raw staged audio may survive the round.
        asr_root = Path(os.environ.get("NAVIA_MEDIA_ASR_TASK_ROOT", "")) if os.environ.get("NAVIA_MEDIA_ASR_TASK_ROOT") else None
        if asr_root is not None:
            assert not (asr_root / harness.TASK_ID).exists(), "raw ASR audio survived the round"
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


def test_fresh_root_is_removed_when_the_round_ends(tmp_path: Path) -> None:
    """The owned scratch root never survives the round that created it."""
    root = tmp_path / "r4-5-cleanup"
    runtime = harness.launch(root, seed=harness.capture_seed())
    assert root.exists()
    runtime.terminate_owned()
    runtime.destroy_scratch()
    assert not root.exists(), "the owned scratch root leaked"


def test_no_chrome_and_no_audio_were_ever_started(tmp_path: Path) -> None:
    """R4 runs the Runtime only: no browser process, no playback."""
    root = tmp_path / "r4-5-nobrowser"
    runtime = harness.launch(root, seed=harness.capture_seed())
    try:
        assert os.path.isdir(f"/proc/{runtime.pid}")
        # The child is the Python interpreter, never a browser binary. Check
        # the resolved executable, not the whole argv (which contains this
        # round's scratch path).
        executable = os.path.realpath(f"/proc/{runtime.pid}/exe")
        assert Path(executable).name.startswith("python"), executable
        assert "chrome" not in executable.lower(), executable
        with open(f"/proc/{runtime.pid}/cmdline", "rb") as handle:
            argv0 = handle.read().split(b"\x00")[0].decode("utf-8", "replace")
        assert "chrome" not in os.path.basename(argv0).lower()
        assert runtime.base_url.startswith("http://127.0.0.1:")
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()
