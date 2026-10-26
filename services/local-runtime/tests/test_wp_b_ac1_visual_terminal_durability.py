"""WP-B AC1 — the visual terminal receipt is crash-durable.

The defect: the materializer durably commits and publishes the visual product
and THEN submits the barrier's visual-terminal receipt. A kill in that window
left the barrier with `visualTerminal=false` forever, because the materializer
returned the already-terminal product on the next call and the startup
reconciliation only waited for the receipts.

These tests kill a real process inside that window and then let a genuinely
fresh set of production objects — reading only the durable SQLite and the
filesystem — close it. Nothing is restarted from memory.
"""

from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from navia_runtime.modules.media_companion.local_import.consumer_barrier import (
    LocalMediaConsumerBarrier,
)

from wp_b_ac1_stack import (
    IMPORT_ID,
    TASK_ID,
    Paths,
    build_frames,
    build_media,
    build_stack,
    digest_of,
    drive_the_barrier_to_t4,
    open_the_import,
    wire_receipt,
)


@pytest.fixture
def paths(tmp_path: Path) -> Paths:
    return Paths(root=tmp_path / "ac1")


def _receipt(paths: Paths) -> dict:
    media = build_media(paths)
    frames = build_frames(paths, media)
    return {
        "taskId": TASK_ID,
        "sourceIdentity": "portal:bilibili:BV1AC1TEST:cid:1",
        "mediaSha256": digest_of(media),
        "durationMs": 3_000,
        "frames": frames,
    }


def _child_drive_to_the_crash_window(paths: Paths) -> None:
    """The child: a real product, committed, then killed before the receipt.

    The kill is at the SEAM the materializer uses to submit the receipt, so
    the product commit and the source-authority publication are already
    durable and the barrier's receipt is not.
    """
    import navia_runtime.modules.media_companion.product_materializer as module

    class Governed:
        """The external vision capability, substituted (see the module docstring)."""

        def __init__(self, *args):
            pass

        def dispatch(self, selected):
            return SimpleNamespace(caption="AC1 crash window caption")

    module.GovernedMediaVisionAdapter = Governed

    receipt = _receipt(paths)
    store = open_the_import(paths, receipt["mediaSha256"])
    stack = build_stack(paths, receipt=receipt)
    stack.store = store
    stack.barriers = type(stack.barriers)(paths.import_db)
    drive_the_barrier_to_t4(stack)
    wire_receipt(stack, receipt)

    def _kill_at_the_receipt(task_id: str) -> None:
        # The product is already committed and published. Die here: before the
        # barrier's visual-terminal receipt is durable.
        sys.stdout.write("KILLED_AT_THE_VISUAL_RECEIPT")
        sys.stdout.flush()
        os._exit(137)

    stack.materializer._visual_terminal = _kill_at_the_receipt
    stack.materializer.materialize_visual(TASK_ID)
    os._exit(3)  # the receipt seam was never reached


def _run_child(paths: Paths) -> int:
    pid = os.fork()
    if pid == 0:  # pragma: no cover - the child never returns
        try:
            _child_drive_to_the_crash_window(paths)
        except BaseException:  # noqa: BLE001
            os._exit(4)
    _, status = os.waitpid(pid, 0)
    if os.WIFSIGNALED(status):
        return -os.WTERMSIG(status)
    return os.WEXITSTATUS(status)


def test_ac1_a_kill_after_the_product_commit_leaves_the_receipt_missing(paths: Paths) -> None:
    """AC1 — the crash window is real: the product is terminal, the receipt is not."""
    exit_code = _run_child(paths)
    assert exit_code == 137, exit_code

    # A FRESH set of production objects over the same durable paths.
    receipt = _receipt(paths)
    stack = build_stack(paths, receipt=receipt)
    wire_receipt(stack, receipt)

    product = stack.product_store.get(TASK_ID)
    assert product["state"] in {"ready", "degraded"}, product["state"]

    barrier = stack.barriers.get(IMPORT_ID)
    # The FROZEN vocabulary: the transcript's terminal is a PHASE as well as a
    # flag, and the visual receipt is still missing.
    assert barrier["phase"] == "transcript_terminal", barrier
    assert barrier["transcriptTerminal"] is True, barrier
    assert barrier["visualTerminal"] is False, "the kill must leave the receipt missing"


def test_ac1_the_startup_reconciliation_closes_the_window_without_a_retry(
    paths: Paths,
) -> None:
    """AC1 — a fresh process repairs the receipt and cleans up exactly once."""
    assert _run_child(paths) == 137

    receipt = _receipt(paths)
    stack = build_stack(paths, receipt=receipt)
    wire_receipt(stack, receipt)

    cleanup_calls: list[str] = []
    original_complete = stack.coordinator.complete

    def _counting_complete(task_id: str):
        cleanup_calls.append(task_id)
        return original_complete(task_id)

    stack.coordinator.complete = _counting_complete  # type: ignore[method-assign]
    stack.orchestrator.coordinator.complete = _counting_complete  # type: ignore[method-assign]

    results = stack.orchestrator.reconcile()

    assert any(item["visualTerminalReconciled"] for item in results), results
    barrier = stack.barriers.get(IMPORT_ID)
    assert barrier["visualTerminal"] is True, barrier
    assert barrier["phase"] == "cleaned", barrier
    # The cleanup ran exactly once.
    assert len(cleanup_calls) == 1, cleanup_calls
    assert stack.coordinator.get(TASK_ID)["state"] == "succeeded"

    # A second reconciliation changes nothing and cleans nothing again.
    stack.orchestrator.reconcile()
    assert len(cleanup_calls) == 1, cleanup_calls
    assert stack.barriers.get(IMPORT_ID)["phase"] == "cleaned"

    # ...and the residues are zero.
    assert not (paths.media_root / IMPORT_ID / "source.bin").exists()
    residual = [
        path for path in paths.tasks_root.rglob("*")
        if path.is_file() and path.name != ".navia-owner.json"
    ]
    assert residual == [], residual


def test_ac1_a_materialize_call_on_the_terminal_product_reconciles_the_receipt(
    paths: Paths,
) -> None:
    """AC1 — the materializer reconciles instead of returning early."""
    assert _run_child(paths) == 137

    receipt = _receipt(paths)
    stack = build_stack(paths, receipt=receipt)
    wire_receipt(stack, receipt)

    assert stack.barriers.get(IMPORT_ID)["visualTerminal"] is False

    result = stack.materializer.materialize_visual(TASK_ID)

    assert result["taskId"] == TASK_ID
    assert stack.barriers.get(IMPORT_ID)["visualTerminal"] is True
    assert stack.barriers.get(IMPORT_ID)["phase"] == "cleaned"
    assert stack.coordinator.get(TASK_ID)["state"] == "succeeded"


def test_ac1_a_duplicate_submission_is_harmless(paths: Paths) -> None:
    """AC1 — the durable barrier is idempotent, so a duplicate receipt is fine."""
    assert _run_child(paths) == 137

    receipt = _receipt(paths)
    stack = build_stack(paths, receipt=receipt)
    wire_receipt(stack, receipt)

    cleanup_calls: list[str] = []
    original_complete = stack.coordinator.complete

    def _counting_complete(task_id: str):
        cleanup_calls.append(task_id)
        return original_complete(task_id)

    stack.coordinator.complete = _counting_complete  # type: ignore[method-assign]

    stack.orchestrator.reconcile()
    assert len(cleanup_calls) == 1, cleanup_calls
    # A second submission of the same receipt must not clean again.
    stack.materializer.reconcile_visual_terminal(TASK_ID)
    stack.materializer.reconcile_visual_terminal(TASK_ID)
    assert len(cleanup_calls) == 1, cleanup_calls
    assert stack.barriers.get(IMPORT_ID)["phase"] == "cleaned"


def test_ac1_the_claim_is_not_kept_in_process_memory(paths: Paths) -> None:
    """AC1 — there is no in-memory claim that could mask a lost receipt."""
    import inspect

    from navia_runtime.modules.media_companion.product_materializer import (
        MediaProductMaterializer,
    )

    source = inspect.getsource(MediaProductMaterializer)
    assert "_visual_terminal_claimed" not in source
    # The submission is not marked as done before the hook succeeded.
    body = inspect.getsource(MediaProductMaterializer._submit_visual_terminal)
    assert "hook(task_id)" in body
    assert body.index("hook(task_id)") > body.index("with self._task_lock(task_id)")
