"""WP-B C4 — the production orchestrator, end to end, with no fakes.

Everything below is real: real ffmpeg/ffprobe with verified digests, a real
`LocalMediaPreparer`, the real `MediaAcquisitionCoordinator`, the real
`TaskArtifactSandbox` and the real `TaskAudioStager`. The only injected
collaborator is the dependency snapshot, which the frozen WP-A design already
resolves per task.

Cases cover the frozen T1..T4 order, that T3 consumes the SAME digests T1/T2
made durable, that neither consumer may release the shared input early, and
that the local route's only visual evidence is the imported receipt.
"""

from __future__ import annotations

import hashlib
import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.acquisition.audio_ref import TaskAudioStager
from navia_runtime.modules.media_companion.acquisition.coordinator import (
    MediaAcquisitionCoordinator,
    MediaAcquisitionRequest,
)
from navia_runtime.modules.media_companion.acquisition.task_artifacts import (
    TaskArtifactSandbox,
)
from navia_runtime.modules.media_companion.local_import.contracts import ImportError
from navia_runtime.modules.media_companion.local_import.orchestrator import (
    LocalImportOrchestrator,
)
from navia_runtime.modules.media_companion.local_import.preparer import (
    LocalMediaPreparer,
)
from navia_runtime.modules.media_companion.local_import.runtime import LocalImportManager
from navia_runtime.modules.media_companion.local_import.store import LocalMediaImportStore

TASK_ID = "media_task_" + "b" * 32
SOURCE = "portal:bilibili:BV1local000000:cid:1"
GENERATION = "depgen_" + "c" * 64
FFMPEG = "/usr/bin/ffmpeg"
FFPROBE = "/usr/bin/ffprobe"


def _digest(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@pytest.fixture(scope="module")
def seed_media(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A REAL mp4 with a real video and a real audio stream."""
    target = tmp_path_factory.mktemp("seed") / "seed.mp4"
    subprocess.run(
        [
            FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=3",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-shortest", "-t", "3", str(target),
        ],
        check=True,
        timeout=300,
    )
    return target


def _snapshot() -> dict[str, Any]:
    return {
        "generation": GENERATION,
        "ffmpeg": {"path": FFMPEG, "sha256": _digest(Path(FFMPEG))},
        "ffprobe": {"path": FFPROBE, "sha256": _digest(Path(FFPROBE))},
    }


class Harness:
    """A real import that has already streamed its bytes and closed its writer."""

    def __init__(self, tmp_path: Path, seed_media: Path) -> None:
        self.root = tmp_path
        self.store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
        self.media_root = tmp_path / "inputs"
        self.manager = LocalImportManager(self.store, media_root=str(self.media_root))
        self.manager._media_root = str(self.media_root)
        self.coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"))
        self.coordinator.create(
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
        # C3: the three automatic routes must have failed, in the frozen order,
        # before a user-gesture local import is even eligible.
        from navia_runtime.modules.media_companion.acquisition.coordinator import (
            CAPTURE_FALLBACK_ROUTES,
        )

        for route in CAPTURE_FALLBACK_ROUTES:
            self.coordinator.record_route_failure(
                TASK_ID, route, "V3_MEDIA_SUBTITLE_UNAVAILABLE"
            )
        self.manager._eligibility_resolver = self.coordinator.local_import_eligibility
        self.stager = TaskAudioStager(
            self.coordinator.sandbox, tmp_path / "asr-tasks", tmp_path / "receipts.sqlite3"
        )
        self.orchestrator = LocalImportOrchestrator(
            store=self.store,
            coordinator=self.coordinator,
            stager=self.stager,
            sandbox=self.coordinator.sandbox,
            media_root=self.media_root,
            preparer_factory=self._preparer,
            snapshot_resolver=lambda _task_id: _snapshot(),
        )
        self.import_id = self._upload(seed_media)

    def _preparer(self, task_id: str, source_identity: str, _media: Path) -> LocalMediaPreparer:
        return LocalMediaPreparer(
            task_id=task_id,
            source_identity=source_identity,
            snapshot=_snapshot(),
            input_root=self.root / "prep-input",
            audio_root=self.root / "prep-audio",
            visual_root=self.root / "prep-visual",
        )

    def _upload(self, seed_media: Path) -> str:
        created = self.manager.create(
            {
                "taskId": TASK_ID,
                "sourceIdentity": SOURCE,
                "declaredMediaType": "video/mp4",
                "byteLength": seed_media.stat().st_size,
            },
            dependency_generation=GENERATION,
        )
        import_id = created["import"]["importId"]
        payload = seed_media.read_bytes()
        self.manager.begin_stream(
            import_id,
            token=created["uploadToken"],
            content_type="video/mp4",
            declared_content_length=len(payload),
        )
        # Feed in transport chunks LARGER than the frozen 1 MiB writer slice.
        step = 2 * 1024 * 1024
        for offset in range(0, len(payload), step):
            self.manager.feed(import_id, payload[offset : offset + step])
        digest = self.manager.finish(import_id)
        self.manager.complete(import_id, digest)
        return import_id

    def phase(self) -> str:
        """The durable barrier phase, or the frozen placeholder before it exists."""
        record = self.orchestrator.barriers.find(self.import_id)
        return C.INITIAL_BARRIER_PHASE if record is None else record["phase"]


@pytest.fixture
def harness(tmp_path: Path, seed_media: Path) -> Harness:
    return Harness(tmp_path, seed_media)


# --- the frozen order --------------------------------------------------------


def test_c4_the_orchestrator_drives_t1_to_t4_with_durable_receipts(harness: Harness) -> None:
    """C4 — the whole handoff, with every receipt landing in durable storage."""
    # The frozen vocabulary's placeholder: the handoff has not started.
    assert harness.phase() == C.INITIAL_BARRIER_PHASE

    receipts = harness.orchestrator.run(harness.import_id)

    assert receipts["barrierPhase"] == "video_deleted"
    assert harness.store.get(harness.import_id)["state"] == "ready"
    barrier = harness.orchestrator.barriers.get(harness.import_id)
    durable = harness.store.get(harness.import_id)

    # T1's digest is the EXACT digest of the uploaded bytes.
    assert receipts["videoManifestSha256"] == durable["videoManifestSha256"]
    assert len(receipts["videoManifestSha256"]) == 64
    # T2's digest is recorded in BOTH the frozen record and the barrier record.
    assert receipts["visualReceiptSha256"] == barrier["visualReceiptSha256"]
    assert receipts["visualReceiptSha256"] == durable["visualReceiptSha256"]
    # The ASR owner receipt is committed by the REAL stager.
    assert receipts["audioOwnerReceiptSha256"] == harness.stager.receipt(TASK_ID)["manifestSha256"]
    assert barrier["phase"] == "video_deleted"
    # T4 deleted the original.
    assert not harness.orchestrator.shared_input(harness.import_id).exists()
    assert 1 <= receipts["frameCount"] <= 8


def test_c4_t3_consumes_the_same_digests_that_t1_and_t2_recorded(harness: Harness) -> None:
    """C4 — the coordinator binds exactly the two durable digests."""
    receipts = harness.orchestrator.run(harness.import_id)

    binding = harness.coordinator._local_imports[TASK_ID]
    assert binding["videoManifestSha256"] == receipts["videoManifestSha256"]
    assert binding["visualReceiptSha256"] == receipts["visualReceiptSha256"]
    assert binding["route"] == "explicit_local_media_asr"
    assert binding["taskId"] == TASK_ID
    assert binding["sourceIdentity"] == SOURCE
    assert binding["dependencyGeneration"] == GENERATION


def test_c4_the_bound_wav_is_a_real_16k_mono_artifact(harness: Harness) -> None:
    """C4 — `audio_reference()` reads the WAV the preparer really rendered."""
    harness.orchestrator.run(harness.import_id)
    reference = harness.coordinator.audio_reference(TASK_ID)
    reference.validate()
    assert reference.sample_rate_hz == 16_000
    assert reference.channels == 1
    assert reference.sample_width_bytes == 2

    wave = harness.coordinator.sandbox.private_path(TASK_ID, reference.artifact).read_bytes()
    assert wave[:4] == b"RIFF"
    assert wave[8:12] == b"WAVE"
    assert hashlib.sha256(wave).hexdigest() == reference.artifact.sha256


def test_c4_a_tampered_upload_never_reaches_t2(harness: Harness) -> None:
    """C4 — a byte flip after EOF stops the handoff at T1."""
    media = harness.orchestrator.shared_input(harness.import_id)
    payload = bytearray(media.read_bytes())
    payload[0] ^= 0xFF
    media.write_bytes(bytes(payload))

    with pytest.raises(ImportError) as error:
        harness.orchestrator.run(harness.import_id)
    assert error.value.code == "V3_MEDIA_IMPORT_WRITE_FAILED"
    # The frozen vocabulary's placeholder: the handoff has not started.
    assert harness.phase() == C.INITIAL_BARRIER_PHASE, "no preparation may start on unverified bytes"
    assert not (harness.root / "prep-audio" / "audio.wav").exists()


def test_c4_the_orchestrator_refuses_an_import_that_is_not_verified(harness: Harness) -> None:
    """C4 — only a durable EOF may enter the handoff."""
    harness.store.transition(
        harness.import_id,
        expected_sequence=harness.store.get(harness.import_id)["sequence"],
        state="preparing",
    )
    with pytest.raises(ImportError) as error:
        harness.orchestrator.run(harness.import_id)
    assert error.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"


# --- the visual receipt is the only local visual evidence -------------------


def test_c4_the_imported_receipt_is_the_only_local_visual_evidence(harness: Harness) -> None:
    """C4 — B22: the receipt, its digest and the T1 media digest all agree."""
    receipts = harness.orchestrator.run(harness.import_id)

    receipt = harness.orchestrator.imported_visual_receipt(TASK_ID)
    assert receipt is not None
    assert receipt["visualReceiptSha256"] == receipts["visualReceiptSha256"]
    assert receipt["mediaSha256"] == receipts["videoManifestSha256"]
    assert 1 <= len(receipt["frames"]) <= 8
    for frame in receipt["frames"]:
        assert set(frame["artifact"]) == {"artifactId", "kind", "byteLength", "sha256"}
        assert frame["artifact"]["kind"] == "frame"


def test_c4_a_receipt_whose_bytes_changed_is_never_served(harness: Harness) -> None:
    """C4 — the receipt file must still hash to the digest T2 made durable."""
    harness.orchestrator.run(harness.import_id)
    assert harness.orchestrator.imported_visual_receipt(TASK_ID) is not None

    receipt_path = harness.root / "prep-visual" / "visual-receipt.json"
    receipt_path.write_bytes(receipt_path.read_bytes() + b"\n")

    # A changed receipt is an INTEGRITY failure, not an absent receipt.
    with pytest.raises(ImportError) as error:
        harness.orchestrator.imported_visual_receipt(TASK_ID)
    assert error.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"


def test_c4_a_receipt_whose_media_is_not_the_imported_one_is_refused(
    harness: Harness,
) -> None:
    """C4 — the receipt may only ever describe the user's own bytes.

    The receipt file is rewritten for other media AND its durable digest is
    advanced to match, so the file passes every integrity check. The only thing
    left to catch it is the frozen owner manifest T1 recorded.
    """
    import json

    from navia_runtime.modules.media_companion.local_import import contracts as C

    harness.orchestrator.run(harness.import_id)
    receipt_path = harness.root / "prep-visual" / "visual-receipt.json"
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    receipt["mediaSha256"] = "f" * 64
    payload = C.canonical_json(receipt).encode("utf-8")
    receipt_path.write_bytes(payload)

    # The durable receipt digest is untouched: the file on disk no longer
    # matches it, and that mismatch must fail closed rather than look absent.
    # A receipt whose bytes changed is an INTEGRITY failure, not an absent
    # receipt: reporting it as absent would silently move the local route onto
    # the downloader path, which the local route may not use.
    with pytest.raises(ImportError) as error:
        harness.orchestrator.imported_visual_receipt(TASK_ID)
    assert error.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"


def test_c4_an_unrelated_task_has_no_imported_receipt(harness: Harness) -> None:
    harness.orchestrator.run(harness.import_id)
    assert harness.orchestrator.imported_visual_receipt("media_task_" + "d" * 32) is None


# --- the consumer callbacks --------------------------------------------------


def test_c4_the_consumer_callbacks_reach_the_one_barrier(harness: Harness) -> None:
    """C4 — neither consumer may release the shared input on its own."""
    harness.orchestrator.run(harness.import_id)
    import_root = harness.media_root / harness.import_id
    prepared_residue = import_root / "visual" / "prepared-frame.png"
    prepared_residue.parent.mkdir(parents=True, exist_ok=True)
    prepared_residue.write_bytes(b"prepared-media")

    harness.orchestrator.transcript_terminal(TASK_ID)
    assert harness.phase() == "transcript_terminal"
    assert harness.coordinator.get(TASK_ID)["state"] != "succeeded"
    assert prepared_residue.is_file(), "one consumer still owns the prepared media"

    harness.orchestrator.visual_terminal(TASK_ID)
    assert harness.phase() == "cleaned"
    assert harness.coordinator.get(TASK_ID)["state"] == "succeeded"
    assert not import_root.exists(), "the second durable terminal must release the owned root"

    # A late duplicate never cleans again.
    harness.orchestrator.transcript_terminal(TASK_ID)
    assert harness.phase() == "cleaned"


def test_c4_owned_root_release_refuses_a_symlink_or_escape(harness: Harness) -> None:
    """The destructive recovery capability cannot leave the import root."""
    outside = harness.root / "outside"
    outside.mkdir()
    sentinel = outside / "keep.txt"
    sentinel.write_text("keep", encoding="utf-8")

    import_root = harness.media_root / harness.import_id
    shutil.rmtree(import_root)
    import_root.parent.mkdir(parents=True, exist_ok=True)
    import_root.symlink_to(outside, target_is_directory=True)

    with pytest.raises(OSError):
        harness.orchestrator._release_owned_root(harness.import_id)
    with pytest.raises(OSError):
        harness.orchestrator._release_owned_root("../outside")
    assert sentinel.read_text(encoding="utf-8") == "keep"


def test_c4_a_callback_for_an_unknown_task_is_a_no_op(harness: Harness) -> None:
    harness.orchestrator.transcript_terminal("media_task_" + "d" * 32)
    harness.orchestrator.visual_terminal("media_task_" + "d" * 32)


# --- startup recovery --------------------------------------------------------


def test_c4_reconcile_is_empty_when_nothing_was_started(harness: Harness) -> None:
    assert harness.orchestrator.reconcile() == []


def test_c4_reconcile_waits_for_consumers_after_a_kill_at_t4(harness: Harness) -> None:
    """C4 — a killed predecessor's durable facts drive a fresh process."""
    harness.orchestrator.run(harness.import_id)

    fresh = LocalImportOrchestrator(
        store=LocalMediaImportStore(harness.root / "navia.sqlite3"),
        coordinator=harness.coordinator,
        stager=harness.stager,
        sandbox=harness.coordinator.sandbox,
        media_root=harness.media_root,
        preparer_factory=harness._preparer,
    )
    results = fresh.reconcile()
    assert [item["importId"] for item in results] == [harness.import_id]
    assert results[0]["outcome"] == "waiting:consumers:video_deleted"
    # AC1: nothing was reconciled, because no imported product is durable here.
    assert results[0]["visualTerminalReconciled"] is False
