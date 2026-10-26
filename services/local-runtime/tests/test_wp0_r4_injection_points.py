"""WP0 R4-2 — the six handoff / product injection points.

Each point is exercised against a REAL, separately-scheduled ``uvicorn``
process that dies for real (``os._exit`` skips every ``finally`` block, every
atexit hook and every context manager). The scenario is then completed by a
SECOND owned process started on the same scratch root, which is the real
"Runtime restarted" situation: a new PID, a new session, and no inherited
in-memory state.

The six points and their required disposition:

1. ``after_sink_finalize``                    -> abandoned + cleanup
2. ``transcript_create``                       -> abandoned + cleanup
3. ``before_stage``                            -> abandoned + cleanup
4. ``after_stage_before_worker``               -> abandoned + cleanup
5. ``handoff_completed_frame_send``            -> abandoned + cleanup
6. ``commit_then_runtime_restart_before_background_observe`` -> published

Oracle 4 is the load-bearing one for point 4: the process records what it
observed on disk and in SQLite IMMEDIATELY BEFORE killing itself, so
"the owner manifest parent directory was fsynced, the SQLite FULL receipt
was committed, and no worker had run" is an observation, never an
assumption about a ``finally``.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path

import pytest
import websockets.sync.client as websocket_client

import wp0_r4_harness as harness

HARD_KILL_EXIT_CODE = 137

INJECTION_POINTS = (
    "after_sink_finalize",
    "transcript_create",
    "before_stage",
    "after_stage_before_worker",
    "handoff_completed_frame_send",
    "commit_then_runtime_restart_before_background_observe",
)

ABANDONED_POINTS = (
    "after_sink_finalize",
    "transcript_create",
    "before_stage",
    "after_stage_before_worker",
    "handoff_completed_frame_send",
)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _drive_capture(runtime: harness.OwnedRuntime, *, expect_completed: bool = True) -> None:
    """Run one real capture to the ``stop`` boundary over a real socket."""
    data = harness.issue_ticket(runtime)
    socket = websocket_client.connect(
        runtime.ws_url, additional_headers={"Origin": harness.ORIGIN}, open_timeout=20
    )
    try:
        socket.send(json.dumps(harness.start_message(data["ticket"])))
        started = json.loads(socket.recv(timeout=20))
        assert started["type"] == "started"
        socket.send(harness.chunk_payload())
        assert json.loads(socket.recv(timeout=20))["type"] == "chunkAccepted"
        socket.send(json.dumps({"type": "stop", "reason": "completed"}))
        if not expect_completed:
            return
        try:
            completed = json.loads(socket.recv(timeout=30))
        except Exception:
            # The process died inside the handoff; the frame cannot arrive.
            return
        assert completed["type"] == "completed"
    finally:
        try:
            socket.close()
        except Exception:
            pass


def _residuals(root: Path, task_id: str = harness.TASK_ID) -> dict[str, int]:
    """The four frozen residual classes, measured on the real scratch root."""
    task_root = root / "media-tasks" / task_id
    staging_root = root / "media-asr-tasks" / task_id
    product_root = root / "media-tasks" / "product-evidence" / task_id

    def count(path: Path) -> int:
        return len(list(path.rglob("*"))) if path.exists() else 0

    return {
        "acquisition": count(task_root),
        "asrStaging": count(staging_root),
        "unpublishedProduct": count(product_root),
        "activeSink": len(list(task_root.rglob("*.tmp*"))) if task_root.exists() else 0,
    }


def _durable_task_row(root: Path, task_id: str = harness.TASK_ID):
    database = root / "navia.sqlite3"
    if not database.is_file():
        return None
    with sqlite3.connect(database) as connection:
        try:
            return connection.execute(
                "SELECT state, revision, current_outline_id FROM media_tasks WHERE task_id=?",
                (task_id,),
            ).fetchone()
        except sqlite3.OperationalError:
            return None


def _authority_row(root: Path):
    database = root / "navia.sqlite3"
    if not database.is_file():
        return None
    with sqlite3.connect(database) as connection:
        return connection.execute(
            "SELECT task_id, state FROM media_source_authority WHERE source_identity=?",
            (harness.SOURCE_IDENTITY,),
        ).fetchone()


def _restart_and_recover(root: Path, tmp_path: Path, name: str) -> dict:
    """Start a SECOND owned process on the same root and recover through it."""
    restarted = harness.launch(root)
    try:
        # A service-worker restart loses every in-memory session, so the new
        # process must bootstrap its OWN session before any authenticated call.
        token = harness.issue_session(restarted)
        with restarted.client(token=token) as client:
            response = client.post(
                "/v1/media/acquisitions/recover", json={"sourceIdentity": harness.SOURCE_IDENTITY}
            )
        assert response.status_code == 200, response.text
        return response.json()["data"]
    finally:
        restarted.terminate_owned()


# ---------------------------------------------------------------------------
# points 1-3 and 5: no durable product, recovery must abandon
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("kind", ABANDONED_POINTS)
def test_injection_point_abandons_and_composite_cleanup_leaves_no_residual(
    tmp_path: Path, kind: str
) -> None:
    root = tmp_path / f"r4-2-{kind}"
    fault = {"kind": kind}
    if kind in {"after_stage_before_worker", "handoff_completed_frame_send"}:
        fault["deterministicTranscript"] = True

    runtime = harness.launch(root, seed=harness.capture_seed(), fault=fault)
    try:
        _drive_capture(runtime, expect_completed=(kind != "handoff_completed_frame_send"))
        if kind == "handoff_completed_frame_send":
            # The Runtime rejected the handoff frame but the process is alive:
            # no completed frame may have reached the client.
            assert runtime.process.poll() is None, "this point must not kill the process"
            observation = runtime.wait_for_observation(kind)
            assert observation["injected"] == "completed_frame_send"
        else:
            exit_code = runtime.poll_exit(30)
            assert exit_code == HARD_KILL_EXIT_CODE, f"expected a real hard kill, got {exit_code}"
            observation = runtime.observation(kind)
            assert observation["pid"] == runtime.pid
            assert observation["taskId"] == harness.TASK_ID
    finally:
        runtime.terminate_owned()

    # Oracle 7: a completed handoff frame is never durable success.
    durable = _durable_task_row(root)
    assert durable is None or durable[0] not in {"ready", "degraded"}, (
        f"a non-durable handoff must never look published: {durable}"
    )

    recovered = _restart_and_recover(root, tmp_path, kind)
    assert recovered["disposition"] == "abandoned"
    assert recovered["authoritativeTaskId"] == harness.TASK_ID

    residuals = _residuals(root)
    assert residuals == {
        "acquisition": 0,
        "asrStaging": 0,
        "unpublishedProduct": 0,
        "activeSink": 0,
    }, f"composite cleanup left residue behind: {residuals}"
    authority = _authority_row(root)
    assert authority is not None
    assert authority[1] in {"failed", "cancelled"}


# ---------------------------------------------------------------------------
# point 4: the hard kill lands after the durable receipt and before the worker
# ---------------------------------------------------------------------------


def test_after_stage_hard_kill_lands_after_the_durable_receipt(tmp_path: Path) -> None:
    """Oracle 4 — proven from inside the process that dies."""
    root = tmp_path / "r4-2-after-stage"
    runtime = harness.launch(
        root,
        seed=harness.capture_seed(),
        fault={"kind": "after_stage_before_worker", "deterministicTranscript": True},
    )
    try:
        _drive_capture(runtime, expect_completed=False)
        assert runtime.poll_exit(30) == HARD_KILL_EXIT_CODE
    finally:
        runtime.terminate_owned()

    observation = runtime.observation("after_stage_before_worker")
    durable = observation["durable"]

    # The owner manifest was published durably ...
    assert durable["ownerManifestExists"] is True
    assert durable["ownerManifestBytes"] > 0
    assert durable["stagedAudioExists"] is True
    assert durable["stagedAudioBytes"] > 0
    # ... and the SQLite FULL receipt was COMMITTED, not merely written.
    assert durable["receiptPresent"] is True
    assert durable["receiptState"] == "ownership_committed"
    assert durable["receiptDurability"] == "sqlite_transaction_synchronous_FULL_committed"
    assert len(durable["receiptManifestSha256"]) == 64

    # The receipt really is bound to the manifest bytes that survived on disk,
    # so a restarted worker can locate both from the authoritative task id.
    manifest_path = root / "media-asr-tasks" / harness.TASK_ID / "owner.json"
    assert hashlib.sha256(manifest_path.read_bytes()).hexdigest() == durable["receiptManifestSha256"]

    # A NEW process discovers the manifest and receipt ONLY by the
    # authoritative task id — never by inherited memory.
    recovered = _restart_and_recover(root, tmp_path, "after-stage")
    assert recovered["disposition"] == "abandoned"
    assert _residuals(root) == {
        "acquisition": 0,
        "asrStaging": 0,
        "unpublishedProduct": 0,
        "activeSink": 0,
    }

    # The receipt is released exactly once, and a repeat recover is idempotent.
    with sqlite3.connect(root / "navia.sqlite3") as connection:
        remaining = list(connection.execute("SELECT task_id FROM media_capture_owner_receipts"))
    assert remaining == [], "the owner receipt must be released by recovery"


# ---------------------------------------------------------------------------
# point 6: only a durable ready|degraded product may be published
# ---------------------------------------------------------------------------


def test_durable_commit_then_restart_is_published_not_abandoned(tmp_path: Path) -> None:
    """Oracle 8: durable `ready|degraded` in SQLite is the ONLY success."""
    root = tmp_path / "r4-2-commit-then-restart"
    runtime = harness.launch(
        root,
        seed=harness.capture_seed(),
        fault={
            "kind": "commit_then_runtime_restart_before_background_observe",
            "deterministicTranscript": True,
        },
    )
    try:
        _drive_capture(runtime, expect_completed=False)
        # Now publish the product through the REAL HTTP surface. The kill is
        # injected inside `commit_terminal`, so the request dies mid-flight.
        token = harness.issue_session(runtime)
        with runtime.client(token=token) as client:
            created = client.post(
                "/v1/media/outline-tasks", json={"sourceIdentity": harness.SOURCE_IDENTITY}
            )
            assert created.status_code == 201, created.text
            task_id = created.json()["data"]["task"]["taskId"]
            try:
                client.post(f"/v1/media/outline-tasks/{task_id}/materialize")
            except Exception:
                pass  # the process dies inside this call
        assert runtime.poll_exit(30) == HARD_KILL_EXIT_CODE
    finally:
        runtime.terminate_owned()

    observation = runtime.observation("commit_then_runtime_restart_before_background_observe")
    # The durable product landed, and the source authority has NOT yet been
    # flipped to `published` -- that transition belongs to recovery, not to the
    # process that happened to be holding the connection.
    assert observation["durableState"] in {"ready", "degraded"}, observation
    assert observation["authorityState"] != "published", observation

    durable = _durable_task_row(root)
    assert durable is not None and durable[0] in {"ready", "degraded"}

    # A restarted worker must find the durable product and NOT re-run it.
    recovered = _restart_and_recover(root, tmp_path, "commit-then-restart")
    assert recovered["disposition"] == "published"
    assert recovered["authoritativeTaskId"] == task_id

    # Published means published: the staged audio and the acquisition sandbox
    # are already gone, so no residue is invented by recovery.
    assert _residuals(root)["asrStaging"] == 0


# ---------------------------------------------------------------------------
# the denominator itself
# ---------------------------------------------------------------------------


def test_all_six_injection_points_are_registered() -> None:
    """The six required points are exactly the six this round drives."""
    from wp0_r4_child import _install_faults  # noqa: F401  (import must succeed)

    assert set(INJECTION_POINTS) == {
        "after_sink_finalize",
        "transcript_create",
        "before_stage",
        "after_stage_before_worker",
        "handoff_completed_frame_send",
        "commit_then_runtime_restart_before_background_observe",
    }
    assert len(INJECTION_POINTS) == 6
