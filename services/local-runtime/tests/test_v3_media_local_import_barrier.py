"""WP-B C5 — the durable consumer barrier, against the REAL coordinator.

There is no fake coordinator in this file. `LocalMediaConsumerBarrier` calls
only methods the production `MediaAcquisitionCoordinator` really has, with the
signatures it really declares: `bind_local_import(**kwargs)` and
`complete(task_id)`. The nonexistent `release_selected_input` is asserted to be
absent from the coordinator, so a future reintroduction fails here.

Cases map to the frozen barrier order:

  T1 `video_durable`      the uploaded video and its owner manifest are durable
  T2 `inputs_prepared`    the WAV, the frames and the visual receipt are durable
  T3 `input_bound`        the coordinator validated task/source/generation and
                          the SAME digests recorded at T1/T2
  audio receipt           the ASR stager committed its owner receipt
  delete the ORIGINAL video only when T3 AND both receipts are durable
  T4 `video_deleted`      then, and only then, ASR may start

plus the durable-consumer requirements: the second terminal claimant owns
exactly-once cleanup, and a fresh process observes prior terminal receipts
without repeating cleanup.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.acquisition.coordinator import (
    CAPTURE_FALLBACK_ROUTES,
    MediaAcquisitionCoordinator,
    MediaAcquisitionError,
    MediaAcquisitionRequest,
)
from navia_runtime.modules.media_companion.acquisition.task_artifacts import (
    TaskArtifactSandbox,
)
from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.local_import.consumer_barrier import (
    LocalMediaConsumerBarrier,
)
from navia_runtime.modules.media_companion.local_import.contracts import ImportError
from navia_runtime.modules.media_companion.local_import.store import (
    BARRIER_TABLE,
    LocalMediaBarrierStore,
    LocalMediaImportStore,
    TABLE,
)

TASK_ID = "media_task_" + "b" * 32
SOURCE = "portal:bilibili:BV1local000000:cid:1"
GENERATION = "depgen_" + "c" * 64
IMPORT_ID = "media_import_" + "a" * 32
VIDEO_BYTES = b"original-media-bytes-of-one-local-import"
SHA_VIDEO = hashlib.sha256(VIDEO_BYTES).hexdigest()
SHA_AUDIO_RECEIPT = "2" * 64
SHA_VISUAL_RECEIPT = "3" * 64
VIDEO_ARTIFACT = {
    "artifactId": "art_video_000000000001",
    "kind": "audio",
    "byteLength": 320_000,
    "sha256": "4" * 64,
}


@pytest.fixture
def store(tmp_path: Path) -> LocalMediaImportStore:
    instance = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    instance.create_import(
        task_id=TASK_ID,
        source_identity=SOURCE,
        byte_length=len(VIDEO_BYTES),
        declared_media_type="video/mp4",
        dependency_generation=GENERATION,
        import_id=IMPORT_ID,
    )
    # The frozen state machine advances one phase at a time.
    instance.transition(
        IMPORT_ID,
        expected_sequence=instance.get(IMPORT_ID)["sequence"],
        state="uploading",
    )
    instance.transition(
        IMPORT_ID,
        expected_sequence=instance.get(IMPORT_ID)["sequence"],
        state="verifying",
        uploaded_bytes=len(VIDEO_BYTES),
        video_manifest_sha256=SHA_VIDEO,
    )
    return instance


@pytest.fixture
def coordinator(tmp_path: Path) -> MediaAcquisitionCoordinator:
    instance = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"))
    instance.create(
        MediaAcquisitionRequest(
            task_id=TASK_ID,
            source_identity=SOURCE,
            adapter_id="bilibili",
            media_id="BV1local000000",
            playback_unit_id="cid",
            part_id="1",
            consent_policy_id="bilibili-media-consent/v1",
            consent_policy_revision=1,
        )
    )
    return instance


@pytest.fixture
def barrier(
    store: LocalMediaImportStore, coordinator: MediaAcquisitionCoordinator, tmp_path: Path
) -> LocalMediaConsumerBarrier:
    video = tmp_path / "shared" / "source.mp4"
    video.parent.mkdir(parents=True, exist_ok=True)
    video.write_bytes(VIDEO_BYTES)
    return LocalMediaConsumerBarrier(
        store=store,
        coordinator=coordinator,
        import_id=IMPORT_ID,
        shared_input=video,
    )


def _phase(barrier: LocalMediaConsumerBarrier) -> str:
    return barrier.barriers.get(IMPORT_ID)["phase"]


def _to_video_deleted(barrier: LocalMediaConsumerBarrier) -> None:
    barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
    barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL_RECEIPT)
    barrier.mark_input_bound(
        video_manifest_sha256=SHA_VIDEO,
        visual_receipt_sha256=SHA_VISUAL_RECEIPT,
        audio_artifact=VIDEO_ARTIFACT,
        duration_ms=10_000,
    )
    barrier.mark_audio_staged(audio_owner_receipt_sha256=SHA_AUDIO_RECEIPT)
    barrier.delete_original_video()


# --- the frozen T1..T4 order -------------------------------------------------


def test_c5_t1_refuses_a_digest_that_is_not_the_durable_owner_manifest(barrier) -> None:
    """C5 — T1 compares against the durable storeRecord, not an in-memory value."""
    with pytest.raises(ImportError) as error:
        barrier.mark_video_durable(video_manifest_sha256="f" * 64)
    assert error.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"
    # The frozen vocabulary's placeholder: T1 never confirmed the manifest.
    assert _phase(barrier) == C.INITIAL_BARRIER_PHASE
    assert barrier.barriers.video_manifest_of(barrier.import_id) is None


def test_c5_the_original_survives_until_the_audio_owner_receipt_is_durable(barrier) -> None:
    """C5 — T3 alone is NOT enough to release the original."""
    barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
    assert barrier.video_exists()
    assert _phase(barrier) == "video_durable"

    barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL_RECEIPT)
    assert barrier.video_exists()
    assert _phase(barrier) == "inputs_prepared"

    barrier.mark_input_bound(
        video_manifest_sha256=SHA_VIDEO, visual_receipt_sha256=SHA_VISUAL_RECEIPT
    )
    assert barrier.video_exists(), "the original must survive until the audio receipt lands"

    barrier.mark_audio_staged(audio_owner_receipt_sha256=SHA_AUDIO_RECEIPT)
    barrier.delete_original_video()

    assert not barrier.video_exists()
    assert _phase(barrier) == "video_deleted"


def test_c5_t3_consumes_the_same_digests_that_t1_and_t2_made_durable(barrier) -> None:
    """C5 — the exact expected SHA-256, checked on both manifests at T3."""
    barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
    barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL_RECEIPT)

    with pytest.raises(ImportError) as wrong_video:
        barrier.mark_input_bound(
            video_manifest_sha256="f" * 64, visual_receipt_sha256=SHA_VISUAL_RECEIPT
        )
    assert wrong_video.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"

    with pytest.raises(ImportError) as wrong_receipt:
        barrier.mark_input_bound(
            video_manifest_sha256=SHA_VIDEO, visual_receipt_sha256="f" * 64
        )
    assert wrong_receipt.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"

    # The same two digests, unchanged, bind for real.
    barrier.mark_input_bound(
        video_manifest_sha256=SHA_VIDEO, visual_receipt_sha256=SHA_VISUAL_RECEIPT
    )
    assert _phase(barrier) == "input_bound"
    bound = barrier.coordinator._local_imports[TASK_ID]
    assert bound["videoManifestSha256"] == SHA_VIDEO
    assert bound["visualReceiptSha256"] == SHA_VISUAL_RECEIPT


def test_c5_t3_places_the_local_input_where_audio_reference_reads_it(
    barrier, coordinator: MediaAcquisitionCoordinator
) -> None:
    """C5 — bind_local_import must feed the EXISTING audio-consumer structure."""
    _to_video_deleted(barrier)

    selected = coordinator.selected_input(TASK_ID)
    assert selected is not None
    assert selected["route"] == "explicit_local_media_asr"
    assert selected["artifact"]["artifactId"] == VIDEO_ARTIFACT["artifactId"]
    assert selected["durationMs"] == 10_000

    reference = coordinator.audio_reference(TASK_ID)
    reference.validate()
    assert reference.task_id == TASK_ID
    assert reference.source_identity == SOURCE
    assert reference.artifact.artifact_id == VIDEO_ARTIFACT["artifactId"]
    assert reference.duration_ms == 10_000
    assert reference.sample_rate_hz == 16_000


def test_c5_the_order_may_not_move_backwards_or_skip(barrier) -> None:
    """C5 — every step needs the step before it, in the frozen order."""
    with pytest.raises(ImportError):
        # T2 may not run before T1 has verified the owner manifest.
        barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL_RECEIPT)
    barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
    with pytest.raises(ImportError):
        # T4 may not be reached by skipping the binding.
        barrier.mark_audio_staged(audio_owner_receipt_sha256=SHA_AUDIO_RECEIPT)
    assert _phase(barrier) == "video_durable"


# --- the durable consumer claims --------------------------------------------


def test_c5_the_second_terminal_claimant_owns_exactly_once_cleanup(
    barrier, coordinator: MediaAcquisitionCoordinator
) -> None:
    """C5 — a late duplicate receipt never releases the shared input twice."""
    _to_video_deleted(barrier)

    assert barrier.mark_transcript_terminal() is False
    assert _phase(barrier) == "transcript_terminal"
    assert coordinator.get(TASK_ID)["state"] != "succeeded"

    assert barrier.mark_visual_terminal() is True
    assert _phase(barrier) == "cleaned"
    assert coordinator.get(TASK_ID)["state"] == "succeeded"

    # A duplicate late receipt must not clean again.
    assert barrier.mark_transcript_terminal() is False
    assert barrier.mark_visual_terminal() is False
    assert _phase(barrier) == "cleaned"


def test_c5_visual_terminal_first_is_equally_legal(barrier) -> None:
    _to_video_deleted(barrier)
    assert barrier.mark_visual_terminal() is False
    assert barrier.mark_transcript_terminal() is True
    assert _phase(barrier) == "cleaned"


def test_c5_a_terminal_receipt_before_the_release_is_refused(barrier) -> None:
    barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
    with pytest.raises(ImportError) as error:
        barrier.mark_transcript_terminal()
    assert error.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"


# --- only real coordinator APIs ---------------------------------------------


def test_c5_the_barrier_calls_only_real_coordinator_methods(barrier) -> None:
    """C5 — no nonexistent release method may reappear."""
    assert not hasattr(barrier.coordinator, "release_selected_input")
    _to_video_deleted(barrier)
    barrier.mark_transcript_terminal()
    barrier.mark_visual_terminal()
    # `complete(task_id)` takes exactly one positional argument.
    import inspect

    signature = inspect.signature(MediaAcquisitionCoordinator.complete)
    assert list(signature.parameters) == ["self", "task_id"]


def test_c5_the_local_route_never_names_a_downloader_or_credential(
    barrier, coordinator: MediaAcquisitionCoordinator
) -> None:
    """C5/B20 — the local route dispatches none of the automatic machinery."""
    _to_video_deleted(barrier)
    selected = coordinator.selected_input(TASK_ID) or {}
    rendered = json.dumps({key: str(value) for key, value in selected.items()})
    for forbidden in ("downloader", "credential", "tabCapture", "captureGrant"):
        assert forbidden not in rendered
    assert selected["route"] == "explicit_local_media_asr"


def test_c5_the_coordinator_refuses_a_cross_task_or_cross_source_bind(barrier) -> None:
    """C5/B19 — bind atomicity still holds under its own lock."""
    barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
    barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL_RECEIPT)
    barrier.coordinator._tasks[TASK_ID]["sourceIdentity"] = "portal:bilibili:BV1OTHER0000:cid:1"
    with pytest.raises(MediaAcquisitionError):
        barrier.mark_input_bound(
            video_manifest_sha256=SHA_VIDEO, visual_receipt_sha256=SHA_VISUAL_RECEIPT
        )


# --- durability --------------------------------------------------------------


def test_c5_the_frozen_store_record_grows_no_field(barrier) -> None:
    """C5 — the new barrier fields live in their OWN table."""
    connection = sqlite3.connect(barrier.store.database_path)
    try:
        columns = {
            row[1] for row in connection.execute(f"PRAGMA table_info({TABLE})").fetchall()
        }
        barrier_columns = {
            row[1]
            for row in connection.execute(f"PRAGMA table_info({BARRIER_TABLE})").fetchall()
        }
    finally:
        connection.close()

    assert len(columns) == 15, sorted(columns)
    for new_field in ("audio_owner_receipt_sha256", "transcript_terminal", "visual_terminal"):
        assert new_field not in columns
        assert new_field in barrier_columns


def test_c5_a_fresh_store_observes_every_prior_receipt(
    barrier, tmp_path: Path
) -> None:
    """C5 — a killed predecessor's durable facts survive into a new instance."""
    _to_video_deleted(barrier)

    fresh_barriers = LocalMediaBarrierStore(tmp_path / "navia.sqlite3")
    record = fresh_barriers.get(IMPORT_ID)
    assert record["phase"] == "video_deleted"
    assert record["audioOwnerReceiptSha256"] == SHA_AUDIO_RECEIPT
    assert record["visualReceiptSha256"] == SHA_VISUAL_RECEIPT
    assert record["transcriptTerminal"] is False
    assert record["visualTerminal"] is False

    fresh_store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    assert fresh_store.get(IMPORT_ID)["barrierPhase"] == "video_deleted"
    assert fresh_store.get(IMPORT_ID)["videoManifestSha256"] == SHA_VIDEO


def test_c5_a_fresh_process_finishes_an_open_cleanup_without_touching_a_closed_one(
    barrier, coordinator: MediaAcquisitionCoordinator, tmp_path: Path
) -> None:
    """C5 — recovery observes prior terminal receipts and never repeats cleanup."""
    _to_video_deleted(barrier)
    barrier.mark_transcript_terminal()
    barrier.mark_visual_terminal()
    assert _phase(barrier) == "cleaned"

    # A NEW process, over the same database and the same shared input path.
    fresh = LocalMediaConsumerBarrier(
        store=LocalMediaImportStore(tmp_path / "navia.sqlite3"),
        barrier_store=LocalMediaBarrierStore(tmp_path / "navia.sqlite3"),
        coordinator=coordinator,
        import_id=IMPORT_ID,
        shared_input=barrier.shared_input,
    )
    assert fresh.recover_after_restart() == "already_cleaned"
    assert not fresh.video_exists()


def test_c5_recovery_waits_while_a_consumer_still_reads_the_input(
    barrier, coordinator: MediaAcquisitionCoordinator, tmp_path: Path
) -> None:
    """C5 — T4 already released the ORIGINAL; the barrier still owns the rest."""
    _to_video_deleted(barrier)
    assert not barrier.video_exists(), "T4 deletes the original by design"

    fresh = LocalMediaConsumerBarrier(
        store=LocalMediaImportStore(tmp_path / "navia.sqlite3"),
        barrier_store=LocalMediaBarrierStore(tmp_path / "navia.sqlite3"),
        coordinator=coordinator,
        import_id=IMPORT_ID,
        shared_input=barrier.shared_input,
    )
    assert fresh.recover_after_restart() == "waiting:consumers:video_deleted"
    # Recovery must NOT claim cleanup while one consumer is still reading.
    assert fresh.barriers.claim_cleanup(IMPORT_ID) is None
    assert coordinator.get(TASK_ID)["state"] != "succeeded"


def test_c5_recovery_refuses_to_delete_an_unverifiable_input(
    barrier, tmp_path: Path
) -> None:
    """C5 — no receipt, no release."""
    barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
    fresh = LocalMediaConsumerBarrier(
        store=LocalMediaImportStore(tmp_path / "navia.sqlite3"),
        barrier_store=LocalMediaBarrierStore(tmp_path / "navia.sqlite3"),
        coordinator=barrier.coordinator,
        import_id=IMPORT_ID,
        shared_input=barrier.shared_input,
    )
    assert fresh.recover_after_restart() == "waiting:video_durable"
    assert fresh.video_exists()


def test_c5_the_barrier_table_is_listed_for_startup_reconciliation(
    barrier, tmp_path: Path
) -> None:
    _to_video_deleted(barrier)
    open_barriers = LocalMediaBarrierStore(tmp_path / "navia.sqlite3").list_open()
    assert [item["importId"] for item in open_barriers] == [IMPORT_ID]
    assert open_barriers[0]["phase"] == "video_deleted"

    barrier.mark_transcript_terminal()
    barrier.mark_visual_terminal()
    assert LocalMediaBarrierStore(tmp_path / "navia.sqlite3").list_open() == []


def test_c5_the_three_automatic_routes_still_failed_before_the_local_one(
    barrier, coordinator: MediaAcquisitionCoordinator
) -> None:
    """C5 — the local route is the documented LAST resort, not a shortcut."""
    assert [item["route"] for item in coordinator.capture_eligibility(TASK_ID)["failures"]] == []
    for route in CAPTURE_FALLBACK_ROUTES:
        coordinator.record_route_failure(TASK_ID, route, "V3_MEDIA_SUBTITLE_UNAVAILABLE")
    _to_video_deleted(barrier)
    selected = coordinator.selected_input(TASK_ID) or {}
    assert selected["fallbackReasonCodes"] == ["V3_MEDIA_SUBTITLE_UNAVAILABLE"] * 3
    assert [item["route"] for item in coordinator.capture_eligibility(TASK_ID)["failures"]] == list(
        CAPTURE_FALLBACK_ROUTES
    )
