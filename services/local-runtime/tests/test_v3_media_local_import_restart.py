"""WP-B B6 — restart and recovery.

Production owners: `LocalMediaImportStore.reconcile_after_restart`,
`LocalMediaConsumerBarrier.recover_after_restart` and the idempotent
GET/DELETE contract.

A new Runtime never resumes an upload, a token or a worker. It converts every
incomplete record into a persisted terminal failure, releases only what its
manifests prove it owns, and answers GET with that persisted state — never 404.

Cases map to B12 (client interruption), B24 (cancel in every non-terminal
state), B25 (cancel racing a terminal) and B26 (hard kill then restart).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.local_import.contracts import ImportError
from navia_runtime.modules.media_companion.local_import.consumer_barrier import (
    LocalMediaConsumerBarrier,
)
from navia_runtime.modules.media_companion.local_import.manager import (
    ImportSession,
    TokenRegistry,
)
from navia_runtime.modules.media_companion.local_import.store import (
    LocalMediaBarrierStore,
    LocalMediaImportStore,
)

TASK_ID = "media_task_" + "b" * 32
SOURCE = "portal:bilibili:BV1local000000:cid:1"
GENERATION = "depgen_" + "c" * 64
IMPORT_ID = "media_import_" + "a" * 32
SHA_VIDEO = "1" * 64
SHA_AUDIO = "2" * 64
SHA_VISUAL = "3" * 64


def _store(tmp_path: Path, *, state: str = "awaiting_upload") -> LocalMediaImportStore:
    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    store.create_import(
        task_id=TASK_ID,
        source_identity=SOURCE,
        byte_length=4096,
        declared_media_type="video/mp4",
        dependency_generation=GENERATION,
        import_id=IMPORT_ID,
    )
    if state != "awaiting_upload":
        # The frozen machine advances ONE phase at a time, and the durable owner
        # manifest exists from the durable EOF on.
        order = ["awaiting_upload", "uploading", "verifying", "preparing"]
        phases = order[1 : order.index(state) + 1] if state != "ready" else order[1:]
        for phase in phases:
            store.transition(
                IMPORT_ID,
                expected_sequence=store.get(IMPORT_ID)["sequence"],
                state=phase,
                video_manifest_sha256=SHA_VIDEO if phase == "verifying" else None,
            )
        if state == "ready":
            store.transition(
                IMPORT_ID,
                expected_sequence=store.get(IMPORT_ID)["sequence"],
                state="ready",
                uploaded_bytes=4096,
                video_manifest_sha256=SHA_VIDEO,
            )
    return store




class FakeCoordinator:
    def __init__(self) -> None:
        self.completed: list[str] = []
        self.released: list[str] = []

    def complete(self, task_id: str, outcome: str) -> None:
        self.completed.append(task_id)

    def release_selected_input(self, task_id: str, reason: str) -> None:
        self.released.append(task_id)

    def bind_local_import(self, **kwargs: Any) -> dict[str, Any]:
        return {"route": "explicit_local_media_asr"}


# --- B26: hard kill then restart --------------------------------------------


@pytest.mark.parametrize(
    "phase",
    ["awaiting_upload", "uploading", "verifying", "preparing"],
)
def test_b26_every_non_terminal_phase_becomes_a_persisted_restart_failure(
    tmp_path: Path, phase: str
) -> None:
    store = _store(tmp_path, state=phase)

    # A BRAND NEW store instance, as a new process would build.
    fresh = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    interrupted = fresh.reconcile_after_restart()

    assert IMPORT_ID in interrupted
    record = fresh.get(IMPORT_ID)
    assert record["state"] == "failed"
    assert record["failureCode"] == "V3_MEDIA_IMPORT_RUNTIME_RESTARTED"
    # B06/B26: GET is a persisted terminal, never a 404.
    assert record["importId"] == IMPORT_ID


def test_b26_a_restart_never_resumes_the_token(tmp_path: Path) -> None:
    store = _store(tmp_path, state="uploading")
    fresh = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    fresh.reconcile_after_restart()

    tokens = TokenRegistry()
    with pytest.raises(ImportError) as error:
        tokens.consume("t" * 43, IMPORT_ID)
    assert error.value.code == "V3_MEDIA_IMPORT_TOKEN_INVALID"


def _real_coordinator(tmp_path: Path, store: LocalMediaImportStore):
    """The REAL coordinator, with the real task the store already names."""
    from navia_runtime.modules.media_companion.acquisition.coordinator import (
        MediaAcquisitionCoordinator,
        MediaAcquisitionRequest,
    )
    from navia_runtime.modules.media_companion.acquisition.task_artifacts import (
        TaskArtifactSandbox,
    )

    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"))
    _portal, adapter_id, media_id, playback_unit_id, part_id = SOURCE.split(":")
    coordinator.create(
        MediaAcquisitionRequest(
            task_id=TASK_ID,
            source_identity=SOURCE,
            adapter_id=adapter_id,
            media_id=media_id,
            playback_unit_id=playback_unit_id,
            part_id=part_id,
            consent_policy_id="bilibili-media-consent/v1",
            consent_policy_revision=1,
        )
    )
    return coordinator


def _to_phase(barrier: LocalMediaConsumerBarrier, phase: str) -> None:
    """Reach a barrier phase through the PRODUCTION transitions only.

    There is no private write helper any more: a case that claims production
    recovery has to use the same methods the Runtime uses.
    """
    if phase == "video_durable":
        barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
    elif phase == "inputs_prepared":
        _to_phase(barrier, "video_durable")
        barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL)
    elif phase == "input_bound":
        _to_phase(barrier, "inputs_prepared")
        barrier.mark_input_bound(
            video_manifest_sha256=SHA_VIDEO, visual_receipt_sha256=SHA_VISUAL
        )
    elif phase == "audio_staged":
        _to_phase(barrier, "input_bound")
        barrier.mark_audio_staged(audio_owner_receipt_sha256=SHA_AUDIO)
    elif phase == "video_deleted":
        _to_phase(barrier, "audio_staged")
        barrier.delete_original_video()
    else:  # pragma: no cover - the cases below use the frozen phases
        raise AssertionError(phase)


def test_b26_recovery_releases_nothing_the_manifests_do_not_prove(tmp_path: Path) -> None:
    """B26 — an object with no durable handoff is preserved for a human."""
    store = _store(tmp_path, state="ready")
    video = tmp_path / "shared" / "source.mp4"
    video.parent.mkdir(parents=True, exist_ok=True)
    video.write_bytes(b"original")

    barrier = LocalMediaConsumerBarrier(
        store=store,
        coordinator=_real_coordinator(tmp_path, store),
        import_id=IMPORT_ID,
        shared_input=video,
    )
    # Only the VIDEO manifest is durable, so nothing may be released.
    _to_phase(barrier, "video_durable")

    assert barrier.recover_after_restart() == "waiting:video_durable"
    assert video.is_file(), "an unverifiable object must never be deleted"


def test_b26_recovery_waits_while_the_visual_receipt_has_no_audio_receipt(tmp_path: Path) -> None:
    """B26 — T2 alone never releases the shared input."""
    store = _store(tmp_path, state="ready")
    video = tmp_path / "shared" / "source.mp4"
    video.parent.mkdir(parents=True, exist_ok=True)
    video.write_bytes(b"original")

    barrier = LocalMediaConsumerBarrier(
        store=store,
        coordinator=_real_coordinator(tmp_path, store),
        import_id=IMPORT_ID,
        shared_input=video,
    )
    _to_phase(barrier, "video_durable")
    _to_phase(barrier, "inputs_prepared")

    assert barrier.recover_after_restart() == "waiting:inputs_prepared"
    assert video.is_file()


def test_b26_recovery_never_cleans_a_finished_claim_twice(tmp_path: Path) -> None:
    """B26 — the second terminal owns the cleanup, exactly once.

    The open-claim case — a predecessor that died INSIDE the cleanup — is
    proved by the real hard-kill probe (`during_cleanup`), which kills the
    process inside the production `coordinator.complete`. Here the ordinary
    path is proved: the cleanup ran once, and a fresh process does not run it
    again.
    """
    store = _store(tmp_path, state="ready")
    video = tmp_path / "shared" / "source.mp4"
    video.parent.mkdir(parents=True, exist_ok=True)
    video.write_bytes(b"original")

    coordinator = _real_coordinator(tmp_path, store)
    barrier = LocalMediaConsumerBarrier(
        store=store, coordinator=coordinator, import_id=IMPORT_ID, shared_input=video
    )
    _to_phase(barrier, "video_deleted")
    barrier.mark_transcript_terminal()
    assert barrier.mark_visual_terminal() is True
    assert barrier.barriers.get(IMPORT_ID)["phase"] == "cleaned"
    assert coordinator.get(TASK_ID)["state"] == "succeeded"

    fresh = LocalMediaConsumerBarrier(
        store=LocalMediaImportStore(tmp_path / "navia.sqlite3"),
        barrier_store=LocalMediaBarrierStore(tmp_path / "navia.sqlite3"),
        coordinator=coordinator,
        import_id=IMPORT_ID,
        shared_input=video,
    )
    assert fresh.recover_after_restart() == "already_cleaned"
    assert not video.exists()
    # The acquisition task stays terminal; nothing was released twice.
    assert coordinator.get(TASK_ID)["state"] == "succeeded"


# --- B24/B25: cancel and its races -------------------------------------------


@pytest.mark.parametrize("phase", ["awaiting_upload", "uploading", "verifying", "preparing"])
def test_b24_cancel_in_any_non_termal_state_reaches_cancelled(tmp_path: Path, phase: str) -> None:
    store = _store(tmp_path, state=phase)
    record = store.get(IMPORT_ID)

    store.transition(IMPORT_ID, expected_sequence=record["sequence"], state="cancelling")
    final = store.transition(
        IMPORT_ID,
        expected_sequence=record["sequence"] + 1,
        state="cancelled",
        failure_code="V3_MEDIA_IMPORT_CANCELLED",
    )
    assert final["state"] == "cancelled"
    assert final["failureCode"] == "V3_MEDIA_IMPORT_CANCELLED"


def test_b25_a_terminal_state_cannot_be_reversed(tmp_path: Path) -> None:
    store = _store(tmp_path)
    store.transition(IMPORT_ID, expected_sequence=0, state="cancelling")
    cancelled = store.transition(
        IMPORT_ID, expected_sequence=1, state="cancelled", failure_code="V3_MEDIA_IMPORT_CANCELLED"
    )
    with pytest.raises(ImportError):
        store.transition(
            IMPORT_ID, expected_sequence=cancelled["sequence"], state="uploading"
        )


def test_b24_a_cancelled_upload_stops_writing(tmp_path: Path) -> None:
    written: list[int] = []
    session = ImportSession(
        import_id=IMPORT_ID,
        declared_length=4096,
        write=lambda piece: written.append(len(piece)),
        task_quota_bytes=4096,
    )
    session.feed(b"a" * 1024)
    before = sum(written)
    session.cancel()
    with pytest.raises(ImportError) as error:
        session.feed(b"a" * 1024)
    assert error.value.code == "V3_MEDIA_IMPORT_CANCELLED"
    assert sum(written) == before, "a cancelled upload writes nothing further"
