"""WP-B C5 — startup recovery is invoked by PRODUCTION startup, not by a test.

The Runtime must reconcile every non-terminal import on startup, and a fresh
process must be able to act on a predecessor's durable receipts. The real hard
kill across a process boundary is proved separately by
`scripts/v3_media_local_import_wp_b_probe.py`; these cases pin the wiring and
the no-restore rules.
"""

from __future__ import annotations

import inspect
from pathlib import Path

import pytest

from navia_runtime import app as runtime_app
from navia_runtime.modules.media_companion.local_import.consumer_barrier import (
    LocalMediaConsumerBarrier,
)
from navia_runtime.modules.media_companion.local_import.store import (
    LocalMediaBarrierStore,
    LocalMediaImportStore,
)

from test_v3_media_local_import_restart import (  # noqa: F401  (shared constants)
    GENERATION,
    IMPORT_ID,
    SHA_AUDIO,
    SHA_VIDEO,
    SHA_VISUAL,
    SOURCE,
    TASK_ID,
    _real_coordinator,
)


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    store.create_import(
        task_id=TASK_ID,
        source_identity=SOURCE,
        byte_length=4096,
        declared_media_type="video/mp4",
        dependency_generation=GENERATION,
        import_id=IMPORT_ID,
    )
    store.transition(
        IMPORT_ID, expected_sequence=store.get(IMPORT_ID)["sequence"], state="uploading"
    )
    store.transition(
        IMPORT_ID,
        expected_sequence=store.get(IMPORT_ID)["sequence"],
        state="verifying",
        uploaded_bytes=4096,
        video_manifest_sha256=SHA_VIDEO,
    )
    return tmp_path


def _advance(barrier: LocalMediaConsumerBarrier, **fields) -> None:
    """Walk the barrier to the requested phase through PRODUCTION transitions.

    There is no private write helper: every step uses the same methods the
    Runtime uses, and a phase is only reached by the step before it.
    """
    target = fields.get("phase")
    order = ["video_durable", "inputs_prepared", "input_bound", "audio_staged", "video_deleted"]
    current = barrier.barriers.get(barrier.import_id)["phase"]
    start = order.index(current) if current in order else 0
    for phase in order[start : order.index(target) + 1]:
        if phase == "video_durable":
            barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
        elif phase == "inputs_prepared":
            barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL)
        elif phase == "input_bound":
            barrier.mark_input_bound(
                video_manifest_sha256=SHA_VIDEO, visual_receipt_sha256=SHA_VISUAL
            )
        elif phase == "audio_staged":
            barrier.mark_audio_staged(audio_owner_receipt_sha256=SHA_AUDIO)
        elif phase == "video_deleted":
            barrier.delete_original_video()


def test_c5_production_startup_registers_the_reconciliation() -> None:
    """C5 — the hook is on the REAL app, not on a test double."""
    hooks = runtime_app.app.router.on_startup
    assert any(
        hook.__name__ == "_reconcile_local_imports_on_startup" for hook in hooks
    ), [hook.__name__ for hook in hooks]


def test_c5_the_startup_hook_never_raises_into_the_runtime() -> None:
    """C5 — a reconciliation problem must not take the Runtime down."""
    hook = next(
        hook
        for hook in runtime_app.app.router.on_startup
        if hook.__name__ == "_reconcile_local_imports_on_startup"
    )
    assert inspect.iscoroutinefunction(hook)
    # It swallows every failure by contract; prove it by breaking the store.
    original = runtime_app.media_local_import_orchestrator.store

    class Broken:
        def list_incomplete(self):
            raise RuntimeError("disk is on fire")

    runtime_app.media_local_import_orchestrator.store = Broken()
    try:
        import asyncio

        asyncio.run(hook())  # must not raise
    finally:
        runtime_app.media_local_import_orchestrator.store = original


def test_c5_a_fresh_process_reconciles_a_killed_import(
    workspace: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """C5 — a NEW process over the same database acts on the durable receipts."""
    store = LocalMediaImportStore(workspace / "navia.sqlite3")
    shared = workspace / "shared" / "source.bin"
    shared.parent.mkdir(parents=True, exist_ok=True)
    shared.write_bytes(b"imported-bytes")

    first = LocalMediaConsumerBarrier(
        store=store,
        barrier_store=LocalMediaBarrierStore(workspace / "navia.sqlite3"),
        coordinator=_real_coordinator(workspace, store),
        import_id=IMPORT_ID,
        shared_input=shared,
    )
    _advance(first, phase="video_deleted")

    # A genuinely new store, barrier store and process-local state.
    fresh_store = LocalMediaImportStore(workspace / "navia.sqlite3")
    fresh = LocalMediaConsumerBarrier(
        store=fresh_store,
        barrier_store=LocalMediaBarrierStore(workspace / "navia.sqlite3"),
        coordinator=_real_coordinator(workspace, fresh_store),
        import_id=IMPORT_ID,
        shared_input=shared,
    )
    assert fresh.recover_after_restart() == "waiting:consumers:video_deleted"
    # T4 already released the ORIGINAL video by design; the barrier still owns
    # the prepared media, and the cleanup must not have run.
    assert fresh.barriers.get(IMPORT_ID)["phase"] == "video_deleted"


def test_c5_recovery_never_restores_a_token_or_a_worker(workspace: Path) -> None:
    """C5 — a fresh Runtime starts with an empty token registry and no sessions."""
    store = LocalMediaImportStore(workspace / "navia.sqlite3")
    coordinator = _real_coordinator(workspace, store)
    barrier = LocalMediaConsumerBarrier(
        store=store,
        barrier_store=LocalMediaBarrierStore(workspace / "navia.sqlite3"),
        coordinator=coordinator,
        import_id=IMPORT_ID,
        shared_input=workspace / "shared" / "source.bin",
    )
    _advance(barrier, phase="video_durable")
    barrier.recover_after_restart()

    fresh_manager = runtime_app.LocalImportManager(store)
    assert fresh_manager.tokens.outstanding() == 0
    assert fresh_manager.has_session(IMPORT_ID) is False
    assert fresh_manager.store.get(IMPORT_ID)["state"] == "verifying"


def test_c5_startup_splits_manager_recovery_from_barrier_reconciliation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """FC3: an import with NO barrier is a failed upload; one WITH a barrier
    belongs to the orchestrator, because only the barrier knows what the
    shared input is."""
    from navia_runtime import app as runtime_app

    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    barriers = LocalMediaBarrierStore(tmp_path / "navia.sqlite3")

    # One interrupted upload with no barrier at all.
    store.create_import(
        task_id=TASK_ID,
        source_identity=SOURCE,
        byte_length=4096,
        declared_media_type="video/mp4",
        dependency_generation=GENERATION,
        import_id=IMPORT_ID,
    )
    store.transition(
        IMPORT_ID, expected_sequence=store.get(IMPORT_ID)["sequence"], state="uploading"
    )

    # One import that already reached the barrier.
    barrier_import = "media_import_" + "b" * 32
    store.create_import(
        task_id="media_task_" + "c" * 32,
        source_identity=SOURCE,
        byte_length=4096,
        declared_media_type="video/mp4",
        dependency_generation=GENERATION,
        import_id=barrier_import,
    )
    store.transition(
        barrier_import,
        expected_sequence=store.get(barrier_import)["sequence"],
        state="uploading",
    )
    store.transition(
        barrier_import,
        expected_sequence=store.get(barrier_import)["sequence"],
        state="verifying",
        uploaded_bytes=4096,
        video_manifest_sha256=SHA_VIDEO,
    )
    barriers.create(import_id=barrier_import, task_id="media_task_" + "c" * 32)
    barriers.advance(
        barrier_import, expected_sequence=0, phase="video_durable"
    )

    monkeypatch.setattr(runtime_app, "local_media_import_store", store, raising=False)
    monkeypatch.setattr(runtime_app.local_media_import_manager, "store", store, raising=False)
    monkeypatch.setattr(
        runtime_app.media_local_import_orchestrator, "barriers", barriers, raising=False
    )

    import asyncio

    asyncio.run(runtime_app._reconcile_local_imports_on_startup())

    # The barrier-less upload became a persisted terminal failure.
    interrupted = store.get(IMPORT_ID)
    assert interrupted["state"] == "failed"
    assert interrupted["failureCode"] == "V3_MEDIA_IMPORT_RUNTIME_RESTARTED"
    # The barrier-held import was NOT failed by the manager; the orchestrator
    # owns it and it keeps waiting for its consumers.
    held = store.get(barrier_import)
    assert held["state"] == "verifying"
    assert held["failureCode"] is None
    assert barriers.get(barrier_import)["phase"] == "video_durable"


def test_c5_startup_never_restores_a_token_a_writer_or_a_worker(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """FC3: a fresh Runtime starts with nothing that belonged to a predecessor."""
    from navia_runtime import app as runtime_app

    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    store.create_import(
        task_id=TASK_ID,
        source_identity=SOURCE,
        byte_length=4096,
        declared_media_type="video/mp4",
        dependency_generation=GENERATION,
        import_id=IMPORT_ID,
    )
    monkeypatch.setattr(runtime_app, "local_media_import_store", store, raising=False)
    monkeypatch.setattr(runtime_app.local_media_import_manager, "store", store, raising=False)

    import asyncio

    asyncio.run(runtime_app._reconcile_local_imports_on_startup())

    manager = runtime_app.local_media_import_manager
    assert manager.tokens.outstanding() == 0
    assert manager.has_session(IMPORT_ID) is False
    assert store.get(IMPORT_ID)["state"] == "failed"
    # The token was never written to the store, so a restart cannot revive it.
    import sqlite3

    with sqlite3.connect(store.database_path) as connection:
        dump = "\n".join(connection.iterdump())
    assert "token" not in dump.lower()
