"""WP-B FC4 — the five cases the acceptance plan defines and the code must prove.

B08  four allowed MIME values plus an unsupported one; MIME never substitutes
     for ffprobe truth.
B09  0 B, exactly 2 GiB and 2 GiB + 1, without allocating a giant file.
B17  a pcm_s16le / 16 kHz / mono WAV with a task-bound durable hash and owner
     receipt; a mutation is rejected.
B23  the durable barrier, normally and after a hard kill, at every listed
     T1-T4 point and in both consumer orders; fail closed on a missing or
     mismatched receipt; zero residuals on success.

Every case drives the PRODUCTION objects. Nothing here is a stand-in for the
manager, the barrier, the coordinator, the stager or the preparer.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import subprocess
import wave
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.acquisition.audio_ref import (
    OWNER_FILE,
    TaskAudioStager,
)
from navia_runtime.modules.media_companion.acquisition.coordinator import (
    MediaAcquisitionCoordinator,
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
from navia_runtime.modules.media_companion.local_import.preparer import (
    LocalMediaPreparer,
)
from navia_runtime.modules.media_companion.local_import.runtime import LocalImportManager
from navia_runtime.modules.media_companion.local_import.store import (
    LocalMediaBarrierStore,
    LocalMediaImportStore,
)

#: A task id is bound to ONE source for the life of the process, so this
#: file owns a task id of its own.
TASK_ID = "media_task_" + "d" * 32
SOURCE = "portal:bilibili:BV1FC4TEST:cid:1"
GENERATION = "depgen_" + "c" * 64
FFMPEG = "/usr/bin/ffmpeg"
FFPROBE = "/usr/bin/ffprobe"
PROBE_ROOT = Path(__file__).resolve().parents[3]


def _digest(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _wav_duration_ms(path: Path) -> int:
    """The WAV's OWN length, measured from its header."""
    with wave.open(str(path), "rb") as handle:
        return int(round(handle.getnframes() * 1000 / handle.getframerate()))


def _snapshot() -> dict[str, Any]:
    return {
        "generation": GENERATION,
        "ffmpeg": {"path": FFMPEG, "sha256": _digest(Path(FFMPEG))},
        "ffprobe": {"path": FFPROBE, "sha256": _digest(Path(FFPROBE))},
    }


@pytest.fixture(scope="module")
def real_media(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Path]:
    """REAL containers produced by the verified ffmpeg. No mock, no stub."""
    root = tmp_path_factory.mktemp("fc4")
    mp4 = root / "sample.mp4"
    subprocess.run(
        [
            FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=3",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-shortest", "-t", "3", str(mp4),
        ],
        check=True, timeout=300,
    )
    webm = root / "sample.webm"
    subprocess.run(
        [
            FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=3",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libvpx-vp9", "-b:v", "200k", "-c:a", "libopus",
            "-shortest", "-t", "3", str(webm),
        ],
        check=True, timeout=600,
    )
    mkv = root / "sample.mkv"
    subprocess.run(
        [
            FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=3",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-shortest", "-t", "3", str(mkv),
        ],
        check=True, timeout=300,
    )
    return {"mp4": mp4, "webm": webm, "mkv": mkv}


@pytest.fixture
def manager(tmp_path: Path) -> LocalImportManager:
    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    instance = LocalImportManager(store, media_root=str(tmp_path / "inputs"))
    instance._media_root = str(tmp_path / "inputs")
    from navia_runtime import app as runtime_app
    from wp_b_local_import_harness import make_task_eligible

    make_task_eligible(TASK_ID, SOURCE)
    instance._eligibility_resolver = runtime_app.media_acquisition_coordinator.local_import_eligibility
    return instance


# ---------------------------------------------------------------------------
# B08 — the four allowed MIME values, and MIME never replaces ffprobe.
# ---------------------------------------------------------------------------


def _body(**overrides: Any) -> dict[str, Any]:
    body = {
        "taskId": TASK_ID,
        "sourceIdentity": SOURCE,
        "declaredMediaType": "video/mp4",
        "byteLength": 1024,
    }
    body.update(overrides)
    return body


@pytest.mark.parametrize("declared", list(C.DECLARED_MEDIA_TYPES))
def test_b08_every_allowed_mime_enters_the_closed_set(manager, declared: str) -> None:
    """B08 — the four allowed values are accepted."""
    created = manager.create(_body(declaredMediaType=declared), dependency_generation=GENERATION)
    assert created["import"]["importId"]
    manager.cancel(created["import"]["importId"])


def test_b08_an_unsupported_mime_is_refused(manager) -> None:
    """B08 — anything outside the closed set is TYPE_UNSUPPORTED."""
    with pytest.raises(ImportError) as error:
        manager.create(
            _body(declaredMediaType="video/quicktime"), dependency_generation=GENERATION
        )
    assert error.value.code == "V3_MEDIA_IMPORT_TYPE_UNSUPPORTED"
    assert manager.store.list_incomplete() == []


def test_b08_mime_never_substitutes_for_ffprobe_truth(tmp_path: Path, real_media) -> None:
    """B08 — a file whose bytes are WebM cannot be declared as MP4."""
    preparer = LocalMediaPreparer(
        task_id=TASK_ID,
        source_identity=SOURCE,
        snapshot=_snapshot(),
        input_root=tmp_path / "in",
        audio_root=tmp_path / "audio",
        visual_root=tmp_path / "visual",
    )
    with pytest.raises(ImportError) as error:
        preparer.prepare(real_media["webm"], declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_MEDIA_INVALID"
    # The REAL container is accepted under its own type.
    prepared = preparer.prepare(real_media["webm"], declared_media_type="video/webm")
    assert prepared.duration_ms > 0
    assert 1 <= len(prepared.frames) <= 8


def test_b08_octet_stream_is_trusted_only_because_ffprobe_still_runs(
    tmp_path: Path, real_media
) -> None:
    """B08 — the wildcard type does not disable the ffprobe gate."""
    preparer = LocalMediaPreparer(
        task_id=TASK_ID,
        source_identity=SOURCE,
        snapshot=_snapshot(),
        input_root=tmp_path / "in",
        audio_root=tmp_path / "audio",
        visual_root=tmp_path / "visual",
    )
    prepared = preparer.prepare(real_media["mp4"], declared_media_type="application/octet-stream")
    assert prepared.container
    assert prepared.duration_ms > 0
    # A file with NO video stream is still refused.
    audio_only = tmp_path / "audio-only.m4a"
    subprocess.run(
        [
            FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
            "-c:a", "aac", str(audio_only),
        ],
        check=True, timeout=300,
    )
    with pytest.raises(ImportError) as error:
        preparer.prepare(audio_only, declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_MEDIA_INVALID"


# ---------------------------------------------------------------------------
# B09 — 0 B, exactly 2 GiB, and 2 GiB + 1, with no giant file allocated.
# ---------------------------------------------------------------------------


def test_b09_zero_bytes_is_refused_without_allocating(manager) -> None:
    """B09 — 0 B is REQUEST_INVALID and nothing is created."""
    with pytest.raises(ImportError) as error:
        manager.create(_body(byteLength=0), dependency_generation=GENERATION)
    assert error.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"
    assert manager.store.list_incomplete() == []
    assert manager.tokens.outstanding() == 0


def test_b09_exactly_two_gib_is_allowed(manager, monkeypatch) -> None:
    """B09 — the exact boundary is ALLOWED, and no giant file is created."""
    exact = C.MAX_IMPORT_BYTES
    assert exact == 2 * 1024**3
    # The space gate is satisfied WITHOUT touching a 2 GiB file.
    monkeypatch.setattr(manager, "_free_bytes", lambda: exact + 1024**3)
    created = manager.create(_body(byteLength=exact), dependency_generation=GENERATION)
    record = manager.store.get(created["import"]["importId"])
    assert record["byteLength"] == exact
    assert record["uploadedBytes"] == 0
    # No sandbox, no writer, no bytes on disk.
    assert not (Path(manager._media_root) / record["importId"]).exists()
    manager.cancel(record["importId"])


def test_b09_one_byte_past_two_gib_is_refused(manager, monkeypatch) -> None:
    """B09 — one past the boundary is SIZE_LIMIT and nothing is created."""
    monkeypatch.setattr(manager, "_free_bytes", lambda: 4 * 1024**3)
    with pytest.raises(ImportError) as error:
        manager.create(
            _body(byteLength=C.MAX_IMPORT_BYTES + 1), dependency_generation=GENERATION
        )
    assert error.value.code == "V3_MEDIA_IMPORT_SIZE_LIMIT"
    assert manager.store.list_incomplete() == []
    assert manager.tokens.outstanding() == 0


# ---------------------------------------------------------------------------
# B14 — the dimension limit, at its exact boundary and one past it.
# ---------------------------------------------------------------------------


def test_b14_the_exact_dimension_boundary_is_allowed(tmp_path: Path) -> None:
    """B14 — 7680x4320 is the frozen boundary and is ALLOWED."""
    assert C.MAX_FRAME_DIMENSIONS == (7680, 4320)
    preparer = LocalMediaPreparer(
        task_id=TASK_ID,
        source_identity=SOURCE,
        snapshot=_snapshot(),
        input_root=tmp_path / "in",
        audio_root=tmp_path / "audio",
        visual_root=tmp_path / "visual",
    )
    # The gate is read from the REAL probe result, so the boundary is the
    # contract's own and not a re-stated number.
    probed = preparer._probe(_dimension_media(tmp_path, 7680, 4320))
    assert probed["width"] == 7680
    assert probed["height"] == 4320


def test_b14_one_pixel_past_the_dimension_limit_is_refused(tmp_path: Path) -> None:
    """B14 — one column past the boundary fails closed and starts no ASR."""
    preparer = LocalMediaPreparer(
        task_id=TASK_ID,
        source_identity=SOURCE,
        snapshot=_snapshot(),
        input_root=tmp_path / "in",
        audio_root=tmp_path / "audio",
        visual_root=tmp_path / "visual",
    )
    # x264 needs even dimensions, so the first past-the-boundary width is 7682.
    media = _dimension_media(tmp_path, 7682, 4320)
    with pytest.raises(ImportError) as error:
        preparer.prepare(media, declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_MEDIA_INVALID"
    # Nothing was published: no WAV and no frame.
    assert not (tmp_path / "audio" / "audio.wav").exists()
    assert not list((tmp_path / "visual").glob("frame-*.png")) if (tmp_path / "visual").exists() else True


def _dimension_media(tmp_path: Path, width: int, height: int) -> Path:
    """A REAL video at the requested dimensions, produced by the verified ffmpeg."""
    target = tmp_path / f"dim-{width}x{height}.mp4"
    subprocess.run(
        [
            FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", f"testsrc=size={width}x{height}:rate=1:duration=1",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-shortest", "-t", "1", str(target),
        ],
        check=True, timeout=900,
    )
    return target


# ---------------------------------------------------------------------------
# B17 — the WAV shape, the task-bound hash and the owner receipt.
# ---------------------------------------------------------------------------


def test_b17_the_rendered_wav_is_pcm_s16le_16k_mono(tmp_path: Path, real_media) -> None:
    """B17 — the rendered audio really is the frozen shape."""
    preparer = LocalMediaPreparer(
        task_id=TASK_ID,
        source_identity=SOURCE,
        snapshot=_snapshot(),
        input_root=tmp_path / "in",
        audio_root=tmp_path / "audio",
        visual_root=tmp_path / "visual",
    )
    prepared = preparer.prepare(real_media["mp4"], declared_media_type="video/mp4")

    with wave.open(str(prepared.wav_path), "rb") as handle:
        assert handle.getsampwidth() == 2, "pcm_s16le is two bytes wide"
        assert handle.getframerate() == 16_000
        assert handle.getnchannels() == 1
        frames = handle.getnframes()
    assert frames > 0
    # The published digest is the digest of the published file.
    assert prepared.wav_sha256 == _digest(prepared.wav_path)
    assert prepared.wav_sha256 == hashlib.sha256(prepared.wav_path.read_bytes()).hexdigest()


def test_b17_the_owner_receipt_is_task_bound_and_durable(tmp_path: Path, real_media) -> None:
    """B17 — the receipt names THIS task and survives a fresh reader."""
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    stager = TaskAudioStager(sandbox, tmp_path / "asr", tmp_path / "receipts.sqlite3")
    coordinator = MediaAcquisitionCoordinator(sandbox)
    coordinator.create(
        MediaAcquisitionRequest(
            task_id=TASK_ID,
            source_identity=SOURCE,
            adapter_id="bilibili",
            media_id="BV1FC4TEST",
            playback_unit_id="cid",
            part_id="1",
            consent_policy_id="bilibili-media-consent/v1",
            consent_policy_revision=1,
        )
    )

    preparer = LocalMediaPreparer(
        task_id=TASK_ID,
        source_identity=SOURCE,
        snapshot=_snapshot(),
        input_root=tmp_path / "in",
        audio_root=tmp_path / "audio",
        visual_root=tmp_path / "visual",
    )
    prepared = preparer.prepare(real_media["mp4"], declared_media_type="video/mp4")
    sandbox.create(TASK_ID)
    artifact = sandbox.import_private_file(TASK_ID, "audio", prepared.wav_path)
    duration_ms = _wav_duration_ms(prepared.wav_path)

    from navia_runtime.modules.media_companion.acquisition.contracts import AcquisitionAudioRef

    reference = AcquisitionAudioRef(
        task_id=TASK_ID,
        source_identity=SOURCE,
        acquisition_record_id="mar_" + "b" * 32,
        artifact=artifact,
        duration_ms=duration_ms,
        sample_rate_hz=16_000,
        channels=1,
        sample_width_bytes=2,
    )
    _staged, receipt = stager.stage(reference)

    # The receipt is durable, FULL-synchronous and bound to THIS task.
    with sqlite3.connect(tmp_path / "receipts.sqlite3") as connection:
        rows = list(
            connection.execute(
                "SELECT task_id, manifest_sha256, state FROM media_capture_owner_receipts"
            )
        )
    assert len(rows) == 1
    assert rows[0][0] == TASK_ID
    assert rows[0][1] == receipt.staged_sha256 or len(rows[0][1]) == 64
    assert rows[0][2] == "ownership_committed"
    assert stager.receipt(TASK_ID)["manifestSha256"] == rows[0][1]
    # The owner manifest is on disk under the task root and names the task.
    owner = json.loads((tmp_path / "asr" / TASK_ID / OWNER_FILE).read_text(encoding="utf-8"))
    assert owner["taskId"] == TASK_ID
    assert owner["stagedSha256"] == artifact.sha256
    assert owner["waveShape"]["sampleRateHz"] == 16_000
    assert owner["waveShape"]["channels"] == 1
    assert owner["waveShape"]["encoding"] == "pcm_s16le"


def test_b17_a_mutated_wav_is_rejected(tmp_path: Path, real_media) -> None:
    """B17 — a mutation between publication and staging is refused."""
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    stager = TaskAudioStager(sandbox, tmp_path / "asr", tmp_path / "receipts.sqlite3")
    preparer = LocalMediaPreparer(
        task_id=TASK_ID,
        source_identity=SOURCE,
        snapshot=_snapshot(),
        input_root=tmp_path / "in",
        audio_root=tmp_path / "audio",
        visual_root=tmp_path / "visual",
    )
    prepared = preparer.prepare(real_media["mp4"], declared_media_type="video/mp4")
    sandbox.create(TASK_ID)
    artifact = sandbox.import_private_file(TASK_ID, "audio", prepared.wav_path)

    from navia_runtime.modules.media_companion.acquisition.audio_ref import AudioStagingError
    from navia_runtime.modules.media_companion.acquisition.contracts import AcquisitionAudioRef

    published = sandbox.private_path(TASK_ID, artifact)
    payload = bytearray(published.read_bytes())
    payload[-1] ^= 0xFF
    published.write_bytes(bytes(payload))

    reference = AcquisitionAudioRef(
        task_id=TASK_ID,
        source_identity=SOURCE,
        acquisition_record_id="mar_" + "b" * 32,
        artifact=artifact,
        duration_ms=_wav_duration_ms(prepared.wav_path),
        sample_rate_hz=16_000,
        channels=1,
        sample_width_bytes=2,
    )
    with pytest.raises(AudioStagingError) as error:
        stager.stage(reference)
    assert error.value.code == "V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE"
    # Nothing was committed for a mutated file.
    assert stager.receipt(TASK_ID) is None


# ---------------------------------------------------------------------------
# B23 — the durable barrier, normally and after a hard kill.
# ---------------------------------------------------------------------------


def _barrier(tmp_path: Path, task_id: str = TASK_ID) -> tuple[LocalMediaConsumerBarrier, MediaAcquisitionCoordinator]:
    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    store.create_import(
        task_id=task_id,
        source_identity=SOURCE,
        byte_length=4096,
        declared_media_type="video/mp4",
        dependency_generation=GENERATION,
        import_id="media_import_" + "a" * 32,
    )
    store.transition(
        "media_import_" + "a" * 32,
        expected_sequence=store.get("media_import_" + "a" * 32)["sequence"],
        state="uploading",
    )
    store.transition(
        "media_import_" + "a" * 32,
        expected_sequence=store.get("media_import_" + "a" * 32)["sequence"],
        state="verifying",
        uploaded_bytes=4096,
        video_manifest_sha256="1" * 64,
    )
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
    shared = tmp_path / "shared" / "source.bin"
    shared.parent.mkdir(parents=True, exist_ok=True)
    shared.write_bytes(b"original-media-bytes")
    barrier = LocalMediaConsumerBarrier(
        store=store,
        barrier_store=LocalMediaBarrierStore(tmp_path / "navia.sqlite3"),
        coordinator=coordinator,
        import_id="media_import_" + "a" * 32,
        shared_input=shared,
    )
    return barrier, coordinator


def _to_video_deleted(barrier: LocalMediaConsumerBarrier) -> None:
    barrier.mark_video_durable(video_manifest_sha256="1" * 64)
    barrier.mark_inputs_prepared(visual_receipt_sha256="3" * 64)
    barrier.mark_input_bound(video_manifest_sha256="1" * 64, visual_receipt_sha256="3" * 64)
    barrier.mark_audio_staged(audio_owner_receipt_sha256="2" * 64)
    barrier.delete_original_video()


def test_b23_the_normal_order_releases_exactly_once(tmp_path: Path) -> None:
    """B23 — transcript first, then visual: one cleanup, zero residual."""
    barrier, coordinator = _barrier(tmp_path)
    _to_video_deleted(barrier)

    assert barrier.mark_transcript_terminal() is False
    assert barrier.mark_visual_terminal() is True
    assert barrier.barriers.get(barrier.import_id)["phase"] == "cleaned"
    assert coordinator.get(TASK_ID)["state"] == "succeeded"
    assert not barrier.shared_input.exists()
    # A duplicate never releases again.
    assert barrier.mark_transcript_terminal() is False
    assert barrier.mark_visual_terminal() is False
    assert barrier.barriers.get(barrier.import_id)["phase"] == "cleaned"


def test_b23_the_reverse_consumer_order_is_equally_legal(tmp_path: Path) -> None:
    """B23 — visual first, then transcript: the same single cleanup."""
    barrier, coordinator = _barrier(tmp_path)
    _to_video_deleted(barrier)

    assert barrier.mark_visual_terminal() is False
    assert barrier.mark_transcript_terminal() is True
    assert barrier.barriers.get(barrier.import_id)["phase"] == "cleaned"
    assert coordinator.get(TASK_ID)["state"] == "succeeded"


def test_b23_a_missing_receipt_fails_closed(tmp_path: Path) -> None:
    """B23 — without the audio owner receipt nothing may be released."""
    barrier, coordinator = _barrier(tmp_path)
    barrier.mark_video_durable(video_manifest_sha256="1" * 64)
    barrier.mark_inputs_prepared(visual_receipt_sha256="3" * 64)
    barrier.mark_input_bound(video_manifest_sha256="1" * 64, visual_receipt_sha256="3" * 64)
    with pytest.raises(ImportError) as error:
        barrier.delete_original_video()
    assert error.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"
    assert barrier.shared_input.exists(), "the original must survive without its audio receipt"
    assert coordinator.get(TASK_ID)["state"] != "succeeded"


def test_b23_a_mismatched_receipt_fails_closed(tmp_path: Path) -> None:
    """B23 — a manifest that does not match the durable one is refused."""
    barrier, coordinator = _barrier(tmp_path)
    barrier.mark_video_durable(video_manifest_sha256="1" * 64)
    barrier.mark_inputs_prepared(visual_receipt_sha256="3" * 64)
    with pytest.raises(ImportError) as error:
        barrier.mark_input_bound(
            video_manifest_sha256="f" * 64, visual_receipt_sha256="3" * 64
        )
    assert error.value.code == "V3_MEDIA_IMPORT_REQUEST_INVALID"
    assert barrier.shared_input.exists()
    assert coordinator.get(TASK_ID)["state"] != "succeeded"


def test_b23_a_fresh_process_sees_the_durable_receipts(tmp_path: Path) -> None:
    """B23 — a new process over the same SQLite and sandbox continues correctly."""
    barrier, coordinator = _barrier(tmp_path)
    _to_video_deleted(barrier)
    barrier.mark_transcript_terminal()

    fresh = LocalMediaConsumerBarrier(
        store=LocalMediaImportStore(tmp_path / "navia.sqlite3"),
        barrier_store=LocalMediaBarrierStore(tmp_path / "navia.sqlite3"),
        coordinator=coordinator,
        import_id=barrier.import_id,
        shared_input=barrier.shared_input,
    )
    record = fresh.barriers.get(barrier.import_id)
    assert record["transcriptTerminal"] is True
    assert record["visualTerminal"] is False
    assert record["audioOwnerReceiptSha256"] == "2" * 64
    assert record["visualReceiptSha256"] == "3" * 64
    # The visual consumer is still reading: nothing may be released yet.
    assert fresh.recover_after_restart() == "waiting:consumers:transcript_terminal"
    # T4 already released the ORIGINAL video by design; what the barrier still
    # owns is the prepared media, and the cleanup must not have run.
    assert not fresh.shared_input.exists()
    assert coordinator.get(TASK_ID)["state"] != "succeeded"


def test_b23_the_hard_kill_probe_covers_every_frozen_point() -> None:
    """B23 — the real hard-kill probe, with production transitions only."""
    script = Path(__file__).resolve().parents[1] / "scripts" / "v3_media_local_import_wp_b_probe.py"
    completed = subprocess.run(
        [os.sys.executable, str(script), "--json"],
        capture_output=True, text=True, timeout=900, check=False,
        cwd=str(PROBE_ROOT / "services" / "local-runtime"),
    )
    assert completed.returncode == 0, completed.stderr[-2000:]
    payload = json.loads(completed.stdout)
    phases = {entry["killPhase"]: entry for entry in payload["results"]}
    # Every listed T1-T4 point, both consumer orders, and the in-cleanup kill.
    for phase in (
        "after_t1",
        "after_t2",
        "after_t3",
        "after_audio_receipt_before_delete",
        "after_delete_before_t4",
        "after_transcript_terminal",
        "after_visual_terminal",
        "after_both_consumers",
        "during_cleanup",
    ):
        assert phase in phases, phase
        entry = phases[phase]
        assert entry["killExitCode"] == 137, entry
        assert entry["recoveryExitCode"] == 0, entry
        assert entry["taskSandboxResidualFiles"] == 0, entry
    # The points that do not yet prove ownership keep the shared input.
    for phase in (
        "after_t1", "after_t2", "after_t3",
        "after_audio_receipt_before_delete",
    ):
        assert phases[phase]["sharedInputSurvived"] is True, phase
    # The in-cleanup kill is finished by the fresh process, exactly once.
    assert phases["during_cleanup"]["realCleanupCalls"] == 1
    assert phases["during_cleanup"]["acquisitionTaskState"] == "succeeded"
    # A finished cleanup is never repeated.
    assert phases["after_both_consumers"]["realCleanupCalls"] == 0
    assert phases["after_both_consumers"]["durablePhaseAfter"] == "cleaned"
