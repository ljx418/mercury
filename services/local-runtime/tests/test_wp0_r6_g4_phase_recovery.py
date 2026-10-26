"""WP0 R6-G4 — R6P-N02..N06, R6B-N09, R6B-N11.

* R6P-N02..N06 — five producer stop reasons, each proving there is exactly ONE
  cleanup owner and that no residue survives the terminal.
* R6B-N09       — a hard kill mid-capture, then restart: published OR abandoned
                  with all four residual classes zero.
* R6B-N11       — a cleanup fault fails closed and never claims success.

All run against real owned Uvicorn processes over real HTTP and WebSockets.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
import websockets.sync.client as websocket_client

import wp0_r6_harness as h6

STOP_REASONS: tuple[tuple[str, str], ...] = (
    ("R6P-N02", "cancelled"),
    ("R6P-N03", "failed"),
    ("R6P-N04", "timeout"),
    ("R6P-N05", "navigation"),
    ("R6P-N06", "tab_closed"),
)


def _drive_capture(runtime: Any, *, stop_reason: str | None = "completed") -> dict[str, Any]:
    """One real capture over one real socket, with an optional stop reason."""
    grant = h6.r6_ticket(runtime)
    socket = websocket_client.connect(
        runtime.ws_url, additional_headers={"Origin": h6.ORIGIN}, open_timeout=20
    )
    frames: list[dict[str, Any]] = []
    try:
        socket.send(json.dumps(h6.r6_start_message(grant["ticket"])))
        frames.append(json.loads(socket.recv(timeout=20)))
        if frames[-1].get("type") != "started":
            return {"frames": frames, "grant": grant}
        socket.send(h6.chunk_payload())
        frames.append(json.loads(socket.recv(timeout=20)))
        socket.send(json.dumps({"type": "stop", "reason": stop_reason}))
        try:
            socket.send(json.dumps({"type": "stop", "reason": stop_reason}))
        except Exception:
            pass
        for _ in range(3):
            try:
                frames.append(json.loads(socket.recv(timeout=10)))
            except Exception:
                break
    finally:
        try:
            socket.close()
        except Exception:
            pass
    return {"frames": frames, "grant": grant}


def _assert_zero_residue(root: Path, runtime: Any, grant_id: str, case_id: str) -> None:
    """Exactly the frozen cleanup contract, read from the product itself."""
    sinks = h6.sink_state(runtime, grant_id)
    assert sinks["activeCaptureCount"] == 0, f"{case_id}: {sinks}"
    assert sinks["residualRawAudioCount"] == 0, f"{case_id}: {sinks}"
    raw = [
        str(path)
        for path in (root / "media-tasks").rglob("*")
        if path.is_file() and path.suffix.lower() in {".wav", ".pcm", ".raw"}
    ] if (root / "media-tasks").is_dir() else []
    assert raw == [], f"{case_id}: raw audio survived: {raw}"


@pytest.mark.parametrize("case_id,stop_reason", STOP_REASONS, ids=[c[0] for c in STOP_REASONS])
def test_r6p_each_stop_reason_has_exactly_one_cleanup_owner(
    tmp_path: Path, case_id: str, stop_reason: str
) -> None:
    """R6P-N02..N06 — the stop reason is preserved and one owner cleans up."""
    root = tmp_path / case_id
    with h6.owned_runtime(root) as runtime:
        result = _drive_capture(runtime, stop_reason=stop_reason)
        grant_id = result["grant"]["grant"]["grantId"]

        # The Runtime reports the producer's reason verbatim — it never invents
        # a different terminal for the same action.
        cancelled = [f for f in result["frames"] if f.get("type") == "cancelled"]
        if cancelled:
            assert cancelled[0].get("reason") == stop_reason, cancelled[0]

        # No terminal may claim a durable product success from a capture stop.
        for frame in result["frames"]:
            assert frame.get("type") != "ready", f"{case_id}: a capture stop claimed ready"
            assert frame.get("type") != "degraded", f"{case_id}: a capture stop claimed degraded"

        _assert_zero_residue(root, runtime, grant_id, case_id)
        h6.ledger(root, case_id, stopReason=stop_reason, singleOwner=True, residuesZero=True)


def test_r6b_n09_hard_kill_then_restart_resolves_with_zero_residuals(tmp_path: Path) -> None:
    """R6B-N09 — a hard kill mid-capture leaves published-or-abandoned, clean."""
    root = tmp_path / "R6B-N09"
    runtime = h6.launch(root, seed=h6.r6_seed())
    try:
        result = _drive_capture(runtime, stop_reason=None)
        grant_id = result["grant"]["grant"]["grantId"]
        # SIGKILL: no finally, no atexit, no graceful drain.
        runtime.process.kill()
        # `subprocess` reports a signal death as -SIGKILL; a child that calls
        # os._exit(137) reports 137. Both encodings are the same SIGKILL.
        exit_code = runtime.poll_exit(20)
        assert exit_code in {-9, 137}, f"R6B-N09: the owned child was not hard killed ({exit_code})"
    finally:
        runtime.terminate_owned()

    restarted = h6.launch(root)
    try:
        token = h6.issue_session(restarted)
        with restarted.client(token=token) as client:
            response = client.post(
                "/v1/media/acquisitions/recover",
                json={"sourceIdentity": h6.R6_SOURCE_IDENTITY},
            )
        assert response.status_code == 200, response.text
        disposition = response.json()["data"]["disposition"]
        assert disposition in {"abandoned", "published"}, f"R6B-N09: {disposition}"

        state = h6.product_state(root)
        assert state["ownerReceipts"] == 0, f"R6B-N09: {state}"
        assert state["asrStagingRoots"] == 0, f"R6B-N09: {state}"
        assert state["unpublishedProducts"] == 0, f"R6B-N09: {state}"
        assert state["acquisitionRoots"] == 0, f"R6B-N09: {state}"

        raw = [
            str(path)
            for path in (root / "media-tasks").rglob("*")
            if path.is_file() and path.suffix.lower() in {".wav", ".pcm", ".raw"}
        ]
        assert raw == [], f"R6B-N09: raw audio survived: {raw}"
        h6.ledger(root, "R6B-N09", disposition=disposition, fourResidualsZero=True)
    finally:
        restarted.terminate_owned()
        restarted.destroy_scratch()


def test_r6b_n11_cleanup_fault_fails_closed_without_success(tmp_path: Path) -> None:
    """R6B-N11 — an un-cleanable owner manifest fails closed, never succeeds."""
    root = tmp_path / "R6B-N11"
    # Drive to a durable receipt, then make the staged audio unreadable so the
    # cleanup owner provably cannot complete.
    runtime = h6.launch(
        root,
        seed=h6.r6_seed(),
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
                pass
        finally:
            try:
                socket.close()
            except Exception:
                pass
        runtime.wait_for_observation("after_stage_before_worker", timeout=25.0)
        assert runtime.poll_exit(30) == 137
    finally:
        runtime.terminate_owned()

    # Make the owner's staged audio disappear: the cleanup can then neither
    # verify the manifest nor finish the release.
    staged = root / "media-asr-tasks" / h6.R6_TASK_ID / "audio" / "current-part.wav"
    assert staged.exists(), "R6B-N11: the durable staged audio is missing"
    staged.unlink()

    restarted = h6.launch(root)
    try:
        token = h6.issue_session(restarted)
        with restarted.client(token=token) as client:
            response = client.post(
                "/v1/media/acquisitions/recover",
                json={"sourceIdentity": h6.R6_SOURCE_IDENTITY},
            )
        assert response.status_code >= 500, f"R6B-N11: did not fail closed: {response.text}"
        assert "CLEANUP_INCOMPLETE" in response.text.upper(), response.text
        rendered = response.text.upper()
        for forbidden in ('"READY"', '"DEGRADED"', '"PUBLISHED"'):
            assert forbidden not in rendered, f"R6B-N11: fail-closed claimed {forbidden}"

        state = h6.product_state(root)
        assert state["unpublishedProducts"] == 0, f"R6B-N11: {state}"
        h6.ledger(root, "R6B-N11", disposition="fail_closed", successClaimed=False)
    finally:
        restarted.terminate_owned()
        restarted.destroy_scratch()
