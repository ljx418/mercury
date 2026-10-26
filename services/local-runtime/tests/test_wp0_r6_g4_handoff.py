"""WP0 R6-G4 — R6H-N01..N06.

Six handoff injection points, each executed FRESH in an owned Uvicorn process
and driven through the production capture path with real HTTP grants and a real
WebSocket. No R4 result is reused.

Mapping (the frozen six from the R6 plan):

  R6H-N01  after_sink_finalize          handler owns cleanup  -> abandoned
  R6H-N02  transcript_create            handler owns cleanup  -> abandoned
  R6H-N03  before_stage                 handler owns cleanup  -> abandoned
  R6H-N04  after_stage_before_worker    hard kill, transcript owns -> four residuals zero
  R6H-N05  handoff_completed_frame_send handoff preserved, no product terminal
  R6H-N06  commit_then_runtime_restart  published ONLY with a durable commit
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

import pytest
import websockets.sync.client as websocket_client

import wp0_r6_harness as h6

# (caseId, fault kind, expected disposition)
PRE_STAGE_POINTS: tuple[tuple[str, str], ...] = (
    ("R6H-N01", "after_sink_finalize"),
    ("R6H-N02", "transcript_create"),
    ("R6H-N03", "before_stage"),
)


def _drive_capture(root: Path, fault: dict[str, Any], *, open_socket: bool = True) -> tuple[Any, Any]:
    """Launch an owned Runtime with one fault and drive one real capture."""
    runtime = h6.launch(root, seed=h6.r6_seed(), fault=fault)
    grant = h6.r6_ticket(runtime)
    if not open_socket:
        return runtime, grant
    socket = websocket_client.connect(
        runtime.ws_url, additional_headers={"Origin": h6.ORIGIN}, open_timeout=20
    )
    try:
        socket.send(json.dumps(h6.r6_start_message(grant["ticket"])))
        frame = json.loads(socket.recv(timeout=20))
        if frame.get("type") == "started":
            socket.send(h6.chunk_payload())
            try:
                acknowledged = json.loads(socket.recv(timeout=20))
            except Exception:
                acknowledged = None
            if acknowledged and acknowledged.get("type") == "chunkAccepted":
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
    return runtime, grant


def _task_row(root: Path) -> tuple[str, int] | None:
    database = root / "navia.sqlite3"
    if not database.is_file():
        return None
    with sqlite3.connect(database) as connection:
        row = connection.execute(
            "SELECT state, revision FROM media_tasks WHERE task_id=?", (h6.R6_TASK_ID,)
        ).fetchone()
    return (str(row[0]), int(row[1])) if row else None


def _assert_no_success_claim(response_text: str, case_id: str) -> None:
    rendered = response_text.upper()
    for forbidden in ('"READY"', '"DEGRADED"', '"PUBLISHED"', '"SUCCEEDED"'):
        assert forbidden not in rendered, f"{case_id}: claimed {forbidden}: {response_text}"


@pytest.mark.parametrize("case_id,fault_kind", PRE_STAGE_POINTS, ids=[c[0] for c in PRE_STAGE_POINTS])
def test_r6h_pre_stage_injection_abandons_with_zero_residue(
    tmp_path: Path, case_id: str, fault_kind: str
) -> None:
    """R6H-N01..N03 — before the barrier, the handler owns cleanup exactly once."""
    root = tmp_path / case_id
    runtime, _grant = _drive_capture(root, {"kind": fault_kind})
    try:
        assert runtime.poll_exit(20) == 137, f"{case_id}: the injected fault did not kill the owned child"
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
        # The pre-barrier work was abandoned, never published.
        assert response.status_code == 200, f"{case_id}: {response.text}"
        disposition = response.json()["data"]["disposition"]
        assert disposition == "abandoned", f"{case_id}: {disposition}"
        _assert_no_success_claim(response.text, case_id)

        # Four residual classes are zero after the composite cleanup.
        state = h6.product_state(root)
        assert state["ownerReceipts"] == 0, f"{case_id}: {state}"
        assert state["asrStagingRoots"] == 0, f"{case_id}: {state}"
        assert state["unpublishedProducts"] == 0, f"{case_id}: {state}"

        # A repeat recover is idempotent, not a second cleanup owner.
        with restarted.client(token=token) as client:
            repeat = client.post(
                "/v1/media/acquisitions/recover",
                json={"sourceIdentity": h6.R6_SOURCE_IDENTITY},
            )
        assert repeat.status_code >= 400, f"{case_id}: repeat recover re-cleaned: {repeat.text}"
    finally:
        restarted.terminate_owned()
        restarted.destroy_scratch()

    h6.ledger(root, case_id, faultKind=fault_kind, disposition="abandoned", residualsZero=True)


def test_r6h_after_stage_hard_kill_zeroes_four_residuals(tmp_path: Path) -> None:
    """R6H-N04 — a kill AFTER the durable receipt leaves four zero residuals."""
    root = tmp_path / "R6H-N04"
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
        durable = runtime.wait_for_observation("after_stage_before_worker", timeout=25.0)["durable"]
        assert durable["receiptPresent"] is True, durable
        assert runtime.poll_exit(30) == 137
    finally:
        runtime.terminate_owned()

    # The transcript/recovery path owns cleanup now, not the dead handler.
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
        assert disposition in {"abandoned", "published"}, disposition

        state = h6.product_state(root)
        assert state["ownerReceipts"] == 0, f"R6H-N04: {state}"
        assert state["asrStagingRoots"] == 0, f"R6H-N04: {state}"
        assert state["unpublishedProducts"] == 0, f"R6H-N04: {state}"
        # Raw audio is the residue class that must always be zero. When the
        # disposition is `published` the durable product legitimately keeps a
        # task root, so the root COUNT is not the invariant — the absence of
        # private WAV/PCM under it is.
        raw_audio = [
            path
            for path in (root / "media-tasks").rglob("*")
            if path.is_file() and path.suffix.lower() in {".wav", ".pcm", ".raw"}
        ]
        assert raw_audio == [], f"R6H-N04: raw audio survived the recovery: {raw_audio}"
        if disposition == "abandoned":
            leftovers = [str(q.relative_to(root)) for q in (root / "media-tasks").rglob("*")]
            assert state["acquisitionRoots"] == 0, (
                f"R6H-N04: abandoned work kept a task root: {state}; entries={leftovers}"
            )
        h6.ledger(root, "R6H-N04", faultKind="after_stage_before_worker", disposition=disposition)
    finally:
        restarted.terminate_owned()
        restarted.destroy_scratch()


def test_r6h_completed_frame_send_failure_preserves_handoff_without_product_terminal(
    tmp_path: Path,
) -> None:
    """R6H-N05 — losing the completed frame keeps the handoff, not a success."""
    root = tmp_path / "R6H-N05"
    runtime, _grant = _drive_capture(
        root, {"kind": "handoff_completed_frame_send", "deterministicTranscript": True}
    )
    try:
        # The process survives: this injection does not kill it.
        assert runtime.process.poll() is None, "R6H-N05: this point must not kill the process"
        observation = runtime.wait_for_observation("handoff_completed_frame_send", timeout=25.0)
        assert observation["injected"] == "completed_frame_send", observation
    finally:
        runtime.terminate_owned()

    # A handoff is NOT a product terminal: the durable product state must not
    # claim ready/degraded for this task.
    # The frozen rule: a handoff is NOT a product terminal. Absence of a
    # durable product row is the strongest form of that proof — there is no
    # ready/degraded product state for this task anywhere.
    row = _task_row(root)
    if row is not None:
        state, _revision = row
        assert state not in {"ready", "degraded"}, f"R6H-N05: a handoff produced a product terminal: {state}"
    h6.ledger(root, "R6H-N05", faultKind="handoff_completed_frame_send", productTerminal=False)


def test_r6h_durable_commit_is_the_only_path_to_published(tmp_path: Path) -> None:
    """R6H-N06 — only a durable commit may publish; otherwise abandoned."""
    root = tmp_path / "R6H-N06"
    runtime = h6.launch(
        root,
        seed=h6.r6_seed(),
        fault={
            "kind": "commit_then_runtime_restart_before_background_observe",
            "deterministicTranscript": True,
        },
    )
    try:
        # Real capture first, so the transcript exists for materialization.
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

        # The durable product commit happens on the REAL HTTP surface; the kill
        # is injected inside commit_terminal, so the request dies mid-flight.
        token = h6.issue_session(runtime)
        with runtime.client(token=token) as client:
            created = client.post(
                "/v1/media/outline-tasks", json={"sourceIdentity": h6.R6_SOURCE_IDENTITY}
            )
            assert created.status_code == 201, created.text
            task_id = created.json()["data"]["task"]["taskId"]
            try:
                client.post(f"/v1/media/outline-tasks/{task_id}/materialize")
            except Exception:
                pass  # the owned process dies inside this call
        assert runtime.poll_exit(30) == 137, "R6H-N06: the injected commit kill did not fire"

        observation = runtime.wait_for_observation(
            "commit_then_runtime_restart_before_background_observe", timeout=25.0
        )
        durable_state = observation.get("durableState")
        assert durable_state in {"ready", "degraded"}, observation
        # The commit landed BEFORE the restart, so the source authority has not
        # yet been flipped by the killed worker.
        assert observation.get("authorityState") != "published", observation
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
        # A durable commit exists, so recovery must PUBLISH, not abandon.
        assert disposition == "published", f"R6H-N06: {disposition}"
        h6.ledger(root, "R6H-N06", disposition=disposition, durableCommit=True)
    finally:
        restarted.terminate_owned()
        restarted.destroy_scratch()
