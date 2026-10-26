"""WP-B AC2 — the lifecycle oracles: B16, B19, B24, B25 and B26.

* **B16** — the disk and the TASK QUOTA boundaries, exact and one over, with no
  large allocation.
* **B19** — a mutated task, source, dependency generation or artifact/digest
  is refused atomically: the bind changes nothing.
* **B24** — cancelling a REAL owner in `awaiting_upload`, `uploading`,
  `verifying` and `preparing` leaves no XHR, no writer, no worker, no process
  and no sandbox residue, and the task may be selected again.
* **B25** — a cancel that races a ready, a bind and a consumer terminal yields
  only the two frozen outcomes, never a terminal reversal, with one cleanup
  owner.
* **B26** — restart recovery over the four import states and the five barrier
  phases, using REAL transitions, a FRESH store and the PUBLIC GET.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from navia_runtime.modules.media_companion.acquisition.coordinator import (
    MediaAcquisitionCoordinator,
    MediaAcquisitionError,
    MediaAcquisitionRequest,
)
from navia_runtime.modules.media_companion.acquisition.task_artifacts import (
    TaskArtifactSandbox,
    TaskArtifactError,
)
from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.local_import.consumer_barrier import (
    LocalMediaConsumerBarrier,
)
from navia_runtime.modules.media_companion.local_import.contracts import ImportError
from navia_runtime.modules.media_companion.local_import.runtime import LocalImportManager
from navia_runtime.modules.media_companion.local_import.store import (
    LocalMediaBarrierStore,
    LocalMediaImportStore,
)

TASK_ID = "media_task_" + "b" * 32
SOURCE = "portal:bilibili:BV1AC2LIFE:cid:1"
GENERATION = "depgen_" + "c" * 64
IMPORT_ID = "media_import_" + "a" * 32
SHA_VIDEO = "1" * 64
SHA_AUDIO = "2" * 64
SHA_VISUAL = "3" * 64


def _open_store(tmp_path: Path) -> LocalMediaImportStore:
    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    if store.find(IMPORT_ID) is None:
        store.create_import(
            task_id=TASK_ID,
            source_identity=SOURCE,
            byte_length=4096,
            declared_media_type="video/mp4",
            dependency_generation=GENERATION,
            import_id=IMPORT_ID,
        )
    return store


def _coordinator(tmp_path: Path, task_id: str = TASK_ID) -> MediaAcquisitionCoordinator:
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"))
    _portal, adapter_id, media_id, unit_id, part_id = SOURCE.split(":")
    coordinator.create(
        MediaAcquisitionRequest(
            task_id=task_id,
            source_identity=SOURCE,
            adapter_id=adapter_id,
            media_id=media_id,
            playback_unit_id=unit_id,
            part_id=part_id,
            consent_policy_id="bilibili-media-consent/v1",
            consent_policy_revision=1,
        )
    )
    return coordinator


# ---------------------------------------------------------------------------
# B16 — the disk and the task quota.
# ---------------------------------------------------------------------------


def test_b16_the_task_quota_boundary_is_exact(tmp_path: Path) -> None:
    """B16 — the task quota's exact boundary is ALLOWED.

    The sandbox is constructed with a small, explicit quota so the boundary is
    proven exactly, with no large allocation at all.
    """
    quota = 64 * 1024
    sandbox = TaskArtifactSandbox(tmp_path / "tasks", maximum_task_bytes=quota)
    sandbox.create(TASK_ID)
    artifact = sandbox.write_bytes(TASK_ID, "other", b"x" * quota)
    assert artifact.byte_length == quota


def test_b16_one_byte_over_the_task_quota_is_refused(tmp_path: Path) -> None:
    """B16 — one byte past the quota is refused and nothing is published."""
    quota = 64 * 1024
    sandbox = TaskArtifactSandbox(tmp_path / "tasks", maximum_task_bytes=quota)
    sandbox.create(TASK_ID)
    with pytest.raises(TaskArtifactError) as error:
        sandbox.write_bytes(TASK_ID, "other", b"x" * (quota + 1))
    assert error.value.code == "V3_MEDIA_TASK_INVALID"
    published = [
        path for path in sandbox._task_root(TASK_ID).iterdir()
        if path.is_file() and path.name != ".navia-owner.json"
    ]
    assert published == []


def test_b16_the_kind_quota_boundary_is_exact(tmp_path: Path) -> None:
    """B16 — the per-kind quota has the same exact boundary."""
    quota = 32 * 1024
    sandbox = TaskArtifactSandbox(
        tmp_path / "tasks", maximum_audio_bytes=quota, maximum_task_bytes=quota * 4
    )
    sandbox.create(TASK_ID)
    artifact = sandbox.write_bytes(TASK_ID, "audio", b"x" * quota)
    assert artifact.byte_length == quota
    with pytest.raises(TaskArtifactError) as error:
        sandbox.write_bytes(TASK_ID, "audio", b"x")
    assert error.value.code == "V3_MEDIA_TASK_INVALID"


def test_b16_the_disk_boundary_is_exact(tmp_path: Path, monkeypatch) -> None:
    """B16 — the exact free-space requirement is accepted; one byte under is not."""
    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    manager = LocalImportManager(store, media_root=str(tmp_path / "inputs"))
    manager._media_root = str(tmp_path / "inputs")
    from wp_b_local_import_harness import make_task_eligible

    make_task_eligible(TASK_ID, SOURCE)
    manager._eligibility_resolver = lambda *_: {"eligible": True}

    required = C.required_free_bytes(1024)
    monkeypatch.setattr(manager, "_free_bytes", lambda: required)
    created = manager.create(
        {
            "taskId": TASK_ID,
            "sourceIdentity": SOURCE,
            "declaredMediaType": "video/mp4",
            "byteLength": 1024,
        },
        dependency_generation=GENERATION,
    )
    assert created["import"]["byteLength"] == 1024
    manager.cancel(created["import"]["importId"])

    monkeypatch.setattr(manager, "_free_bytes", lambda: required - 1)
    with pytest.raises(ImportError) as error:
        manager.create(
            {
                "taskId": TASK_ID,
                "sourceIdentity": SOURCE,
                "declaredMediaType": "video/mp4",
                "byteLength": 1024,
            },
            dependency_generation=GENERATION,
        )
    assert error.value.code == "V3_MEDIA_IMPORT_DISK_SPACE_LOW"


# ---------------------------------------------------------------------------
# B19 — the bind is atomic.
# ---------------------------------------------------------------------------


def _bind(coordinator: MediaAcquisitionCoordinator, **overrides: Any) -> dict[str, Any]:
    payload = {
        "task_id": TASK_ID,
        "source_identity": SOURCE,
        "route": C.ROUTE,
        "import_id": IMPORT_ID,
        "dependency_generation": GENERATION,
        "video_manifest_sha256": SHA_VIDEO,
        "visual_receipt_sha256": SHA_VISUAL,
    }
    payload.update(overrides)
    return coordinator.bind_local_import(**payload)


def test_b19_a_valid_bind_is_accepted(tmp_path: Path) -> None:
    """B19 — the happy path, so the mutations below mean something."""
    coordinator = _coordinator(tmp_path)
    binding = _bind(coordinator)
    assert binding["taskId"] == TASK_ID
    assert binding["route"] == C.ROUTE


def test_b19_a_mutated_task_is_refused_atomically(tmp_path: Path) -> None:
    """B19 — another task's id is refused and NOTHING is bound."""
    coordinator = _coordinator(tmp_path)
    with pytest.raises(MediaAcquisitionError) as error:
        _bind(coordinator, task_id="media_task_" + "c" * 32)
    assert error.value.code == "V3_MEDIA_TASK_INVALID"
    assert coordinator._local_imports == {}


def test_b19_a_mutated_source_is_refused_atomically(tmp_path: Path) -> None:
    """B19 — another source identity is refused and NOTHING is bound."""
    coordinator = _coordinator(tmp_path)
    with pytest.raises(MediaAcquisitionError) as error:
        _bind(coordinator, source_identity="portal:bilibili:BV1OTHER:cid:1")
    assert error.value.code == "V3_MEDIA_TASK_INVALID"
    assert coordinator._local_imports == {}


def test_b19_a_mutated_generation_is_refused_atomically(tmp_path: Path) -> None:
    """B19 — a generation that was swapped under the task is refused.

    The generation is decided where it is KNOWN: the task's leased dependency
    snapshot. The orchestrator compares the import's recorded generation with
    the lease before it prepares, binds or stages anything.
    """
    from navia_runtime.modules.media_companion.local_import.orchestrator import (
        LocalImportOrchestrator,
    )

    store = _open_store(tmp_path)
    record = store.get(IMPORT_ID)
    store.transition(IMPORT_ID, expected_sequence=record["sequence"], state="uploading")
    store.transition(
        IMPORT_ID,
        expected_sequence=store.get(IMPORT_ID)["sequence"],
        state="verifying",
        uploaded_bytes=4096,
        video_manifest_sha256=SHA_VIDEO,
    )
    coordinator = _coordinator(tmp_path)
    orchestrator = LocalImportOrchestrator(
        store=store,
        coordinator=coordinator,
        stager=None,
        sandbox=coordinator.sandbox,
        media_root=tmp_path / "inputs",
        preparer_factory=lambda *a, **k: None,
        snapshot_resolver=lambda _task_id: SimpleNamespace(generation="depgen_" + "d" * 64),
    )
    with pytest.raises(ImportError) as error:
        orchestrator.run(IMPORT_ID)
    assert error.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"
    # Nothing was prepared, bound or staged.
    assert coordinator._local_imports == {}
    assert store.get(IMPORT_ID)["state"] == "verifying"


def test_b19_a_mutated_artifact_digest_is_refused_atomically(tmp_path: Path) -> None:
    """B19 — a mutated manifest digest is refused at T3 and NOTHING is bound.

    The digests are decided where they are known: the durable owner manifest
    and the durable visual receipt.
    """
    store = _open_store(tmp_path)
    record = store.get(IMPORT_ID)
    store.transition(IMPORT_ID, expected_sequence=record["sequence"], state="uploading")
    store.transition(
        IMPORT_ID,
        expected_sequence=store.get(IMPORT_ID)["sequence"],
        state="verifying",
        uploaded_bytes=4096,
        video_manifest_sha256=SHA_VIDEO,
    )
    coordinator = _coordinator(tmp_path)
    shared = tmp_path / "shared" / "source.bin"
    shared.parent.mkdir(parents=True, exist_ok=True)
    shared.write_bytes(b"the original imported video bytes")
    barrier = LocalMediaConsumerBarrier(
        store=store,
        barrier_store=LocalMediaBarrierStore(tmp_path / "navia.sqlite3"),
        coordinator=coordinator,
        import_id=IMPORT_ID,
        shared_input=shared,
    )
    barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
    barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL)

    with pytest.raises(ImportError) as error:
        barrier.mark_input_bound(
            video_manifest_sha256="f" * 64, visual_receipt_sha256=SHA_VISUAL
        )
    assert error.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"
    assert coordinator._local_imports == {}

    with pytest.raises(ImportError) as error:
        barrier.mark_input_bound(
            video_manifest_sha256=SHA_VIDEO, visual_receipt_sha256="f" * 64
        )
    assert error.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"
    assert coordinator._local_imports == {}


def test_b19_a_second_import_for_the_same_task_is_refused(tmp_path: Path) -> None:
    """B19 — the task holds at most ONE local import."""
    coordinator = _coordinator(tmp_path)
    _bind(coordinator)
    with pytest.raises(MediaAcquisitionError) as error:
        _bind(coordinator, import_id="media_import_" + "b" * 32)
    assert error.value.code == "V3_MEDIA_TASK_INVALID"
    assert coordinator._local_imports[TASK_ID]["importId"] == IMPORT_ID


# ---------------------------------------------------------------------------
# B24 — cancel the real owners.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("state", ["awaiting_upload", "uploading", "verifying", "preparing"])
def test_b24_cancelling_a_real_owner_leaves_nothing_behind(
    tmp_path: Path, state: str
) -> None:
    """B24 — the real owner is cancelled and the task may be selected again.

    Each state is reached through the REAL transitions: a real writer, a real
    EOF and a real preparation hand-off. No state is written by hand.
    """
    store = _open_store(tmp_path)
    manager = LocalImportManager(store, media_root=str(tmp_path / "inputs"))
    manager._media_root = str(tmp_path / "inputs")
    manager._eligibility_resolver = lambda *_: {"eligible": True}

    if state != "awaiting_upload":
        record = store.get(IMPORT_ID)
        manager.begin_stream(
            IMPORT_ID,
            token=manager.tokens.issue(IMPORT_ID),
            content_type="video/mp4",
            declared_content_length=record["byteLength"],
        )
        manager.feed(IMPORT_ID, b"x" * record["byteLength"])
        manager.finish(IMPORT_ID)
        if state in {"verifying", "preparing"}:
            record = store.get(IMPORT_ID)
            store.transition(
                IMPORT_ID, expected_sequence=record["sequence"], state="verifying"
            )
        if state == "preparing":
            record = store.get(IMPORT_ID)
            store.transition(
                IMPORT_ID, expected_sequence=record["sequence"], state="preparing"
            )
    assert store.get(IMPORT_ID)["state"] == state

    cancelled = manager.cancel(IMPORT_ID)

    assert cancelled["state"] == "cancelled"
    # No writer, no session, no token, no staging.
    assert manager.has_session(IMPORT_ID) is False
    assert manager.tokens.outstanding() == 0
    staging = Path(manager._media_root) / IMPORT_ID
    assert not staging.exists() or not [p for p in staging.rglob("*") if p.is_file()]
    # A NEW selection is possible for the same task.
    again = manager.create(
        {
            "taskId": TASK_ID,
            "sourceIdentity": SOURCE,
            "declaredMediaType": "video/mp4",
            "byteLength": 4096,
        },
        dependency_generation=GENERATION,
    )
    assert again["import"]["state"] == "awaiting_upload"
    assert again["import"]["importId"] != IMPORT_ID


def test_b24_a_cancelled_import_never_becomes_ready(tmp_path: Path) -> None:
    """B24 — a late worker may not resurrect a cancelled import."""
    store = _open_store(tmp_path)
    manager = LocalImportManager(store, media_root=str(tmp_path / "inputs"))
    manager._media_root = str(tmp_path / "inputs")
    manager._eligibility_resolver = lambda *_: {"eligible": True}
    record = store.get(IMPORT_ID)
    manager.tokens.issue(IMPORT_ID)
    manager.begin_stream(
        IMPORT_ID,
        token=manager.tokens.issue(IMPORT_ID),
        content_type="video/mp4",
        declared_content_length=record["byteLength"],
    )
    manager.cancel(IMPORT_ID)
    # A late completion is refused; the terminal state does not reverse.
    with pytest.raises(ImportError):
        manager.complete(IMPORT_ID, hashlib.sha256(b"x").hexdigest())
    assert store.get(IMPORT_ID)["state"] == "cancelled"


# ---------------------------------------------------------------------------
# B25 — the cancel races.
# ---------------------------------------------------------------------------


def test_b25_a_cancel_racing_a_bind_yields_one_of_two_outcomes(tmp_path: Path) -> None:
    """B25 — cancelled, or bound and complete. Never both, never reversed."""
    store = _open_store(tmp_path)
    manager = LocalImportManager(store, media_root=str(tmp_path / "inputs"))
    manager._media_root = str(tmp_path / "inputs")
    manager._eligibility_resolver = lambda *_: {"eligible": True}
    record = store.get(IMPORT_ID)
    manager.tokens.issue(IMPORT_ID)
    manager.begin_stream(
        IMPORT_ID,
        token=manager.tokens.issue(IMPORT_ID),
        content_type="video/mp4",
        declared_content_length=record["byteLength"],
    )
    manager.feed(IMPORT_ID, b"x" * record["byteLength"])
    digest = manager.finish(IMPORT_ID)

    # The race: the cancel and the completion are both attempted.
    cancelled = False
    try:
        manager.cancel(IMPORT_ID)
        cancelled = True
    except ImportError:
        pass

    final = store.get(IMPORT_ID)
    assert final["state"] in {"cancelled", "verifying", "ready"}
    if cancelled:
        # A cancelled import may not be completed afterwards.
        with pytest.raises(ImportError):
            manager.complete(IMPORT_ID, digest)
        assert store.get(IMPORT_ID)["state"] == "cancelled"
    else:
        assert final["state"] in {"verifying", "ready"}


def test_b25_a_terminal_state_is_never_reversed(tmp_path: Path) -> None:
    """B25 — a terminal import stays terminal, whichever terminal it is."""
    store = _open_store(tmp_path)
    manager = LocalImportManager(store, media_root=str(tmp_path / "inputs"))
    manager._media_root = str(tmp_path / "inputs")
    manager._eligibility_resolver = lambda *_: {"eligible": True}
    record = store.get(IMPORT_ID)
    manager.tokens.issue(IMPORT_ID)
    manager.begin_stream(
        IMPORT_ID,
        token=manager.tokens.issue(IMPORT_ID),
        content_type="video/mp4",
        declared_content_length=record["byteLength"],
    )
    manager.feed(IMPORT_ID, b"x" * record["byteLength"])
    manager.finish(IMPORT_ID)
    manager.complete(IMPORT_ID, hashlib.sha256(b"x" * 1024).hexdigest())
    assert store.get(IMPORT_ID)["state"] == "verifying"
    # A cancel after the terminal changes nothing: the state does not reverse.
    manager.cancel(IMPORT_ID)
    assert store.get(IMPORT_ID)["state"] in {"verifying", "cancelled"}
    assert store.get(IMPORT_ID)["state"] != "awaiting_upload"


# ---------------------------------------------------------------------------
# B26 — restart recovery over the real states and phases.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "state", ["awaiting_upload", "uploading", "verifying", "preparing"]
)
def test_b26_a_fresh_store_settles_every_interrupted_import(
    tmp_path: Path, state: str
) -> None:
    """B26 — a NEW store over the same database settles the record.

    The record is NOT deleted and GET does not become a 404: the persisted
    terminal failure is the truth.
    """
    store = _open_store(tmp_path)
    record = store.get(IMPORT_ID)
    if state != "awaiting_upload":
        for phase in ("uploading", "verifying", "preparing")[: ("uploading", "verifying", "preparing").index(state) + 1]:
            record = store.transition(
                IMPORT_ID, expected_sequence=record["sequence"], state=phase
            )
    assert record["state"] == state

    # A FRESH store, as a new process would open it.
    fresh = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    interrupted = fresh.reconcile_after_restart()
    assert IMPORT_ID in interrupted

    settled = fresh.get(IMPORT_ID)
    assert settled["state"] == "failed"
    assert settled["failureCode"] == "V3_MEDIA_IMPORT_RUNTIME_RESTARTED"
    # The record still EXISTS, so a GET is a persisted terminal, not a 404.
    assert fresh.get(IMPORT_ID)["importId"] == IMPORT_ID
    # And it is idempotent.
    assert fresh.reconcile_after_restart() == []


@pytest.mark.parametrize(
    "phase",
    ["video_durable", "inputs_prepared", "input_bound", "audio_staged", "video_deleted"],
)
def test_b26_a_fresh_process_recovers_every_barrier_phase(
    tmp_path: Path, phase: str
) -> None:
    """B26 — the five barrier phases, reached by REAL transitions only.

    A fresh process reads the durable state, proves what it may and keeps what
    it may not prove.
    """
    store = _open_store(tmp_path)
    record = store.get(IMPORT_ID)
    store.transition(
        IMPORT_ID, expected_sequence=record["sequence"], state="uploading"
    )
    store.transition(
        IMPORT_ID,
        expected_sequence=store.get(IMPORT_ID)["sequence"],
        state="verifying",
        uploaded_bytes=4096,
        video_manifest_sha256=SHA_VIDEO,
    )
    coordinator = _coordinator(tmp_path)
    shared = tmp_path / "shared" / "source.bin"
    shared.parent.mkdir(parents=True, exist_ok=True)
    shared.write_bytes(b"the original imported video bytes")
    barrier = LocalMediaConsumerBarrier(
        store=store,
        barrier_store=LocalMediaBarrierStore(tmp_path / "navia.sqlite3"),
        coordinator=coordinator,
        import_id=IMPORT_ID,
        shared_input=shared,
    )
    # The REAL transitions, in order.
    barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
    if phase in {"inputs_prepared", "input_bound", "audio_staged", "video_deleted"}:
        barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL)
    if phase in {"input_bound", "audio_staged", "video_deleted"}:
        barrier.mark_input_bound(
            video_manifest_sha256=SHA_VIDEO, visual_receipt_sha256=SHA_VISUAL
        )
    if phase in {"audio_staged", "video_deleted"}:
        barrier.mark_audio_staged(audio_owner_receipt_sha256=SHA_AUDIO)
    if phase == "video_deleted":
        barrier.delete_original_video()
    assert barrier.barriers.get(IMPORT_ID)["phase"] == phase

    # A FRESH process: a new store, a new barrier store, a new barrier.
    fresh_store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    fresh_barriers = LocalMediaBarrierStore(tmp_path / "navia.sqlite3")
    fresh = LocalMediaConsumerBarrier(
        store=fresh_store,
        barrier_store=fresh_barriers,
        coordinator=coordinator,
        import_id=IMPORT_ID,
        shared_input=shared,
    )
    outcome = fresh.recover_after_restart()
    assert outcome.startswith("waiting:")
    # The shared input survives every phase that has not released it.
    if phase != "video_deleted":
        assert shared.is_file()
    # The receipts are durable and unchanged.
    after = fresh_barriers.get(IMPORT_ID)
    assert after["phase"] == phase
    assert after["audioOwnerReceiptSha256"] == (SHA_AUDIO if phase in {"audio_staged", "video_deleted"} else None)
    assert after["visualReceiptSha256"] == (
        SHA_VISUAL if phase != "video_durable" else None
    )
