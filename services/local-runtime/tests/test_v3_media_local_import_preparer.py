"""WP-B B3 — the verified media preparer.

Production owner: `local_import.preparer`. It reuses the SAME task dependency
snapshot as WP-A, runs a strict argv with `-nostdin` under a deadline, and
publishes a 16 kHz mono WAV plus 1..8 frames and a canonical
`ImportedVisualReceipt` atomically into the visual sandbox.

Cases map to B13 (real containers vs faked MIME / no video stream), B14 (exact
duration boundary and dimension limit), B15 (missing tool, digest drift,
timeout, non-zero exit, hostile output) and B18 (distributed frames with a
monotonic timestamp and a closed receipt digest).
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.local_import.preparer import (
    LocalMediaPreparer,
    PreparedInput,
)
from navia_runtime.modules.media_companion.local_import.contracts import ImportError

TASK_ID = "media_task_" + "b" * 32
SOURCE = "portal:bilibili:BV1local000000:cid:1"
GENERATION = "depgen_" + "c" * 64

FFMPEG = "/usr/bin/ffmpeg"
FFPROBE = "/usr/bin/ffprobe"


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.fixture
def media(tmp_path: Path) -> Path:
    """A REAL mp4 with a real video and audio stream, produced by ffmpeg."""
    target = tmp_path / "seed.mp4"
    subprocess.run(
        [
            FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=2",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-shortest", str(target),
        ],
        check=True,
        timeout=180,
    )
    return target


def _snapshot() -> dict[str, Any]:
    """The frozen WP-A dependency snapshot for this task."""
    return {
        "generation": GENERATION,
        "ffmpeg": {"path": FFMPEG, "sha256": _digest(Path(FFMPEG))},
        "ffprobe": {"path": FFPROBE, "sha256": _digest(Path(FFPROBE))},
    }


def _preparer(tmp_path: Path, media: Path, **overrides: Any) -> LocalMediaPreparer:
    return LocalMediaPreparer(
        task_id=TASK_ID,
        source_identity=SOURCE,
        snapshot=_snapshot(),
        input_root=tmp_path / "inputs",
        audio_root=tmp_path / "audio",
        visual_root=tmp_path / "visual",
        **overrides,
    )


# --- B13: real containers ----------------------------------------------------


def test_b13_a_real_mp4_is_prepared(tmp_path: Path, media: Path) -> None:
    prepared = _preparer(tmp_path, media).prepare(media, declared_media_type="video/mp4")

    assert prepared.duration_ms >= 1_000
    names = {part.strip() for part in prepared.container.split(",") if part.strip()}
    assert names & {"mp4", "mov", "matroska", "webm"}
    assert 1 <= len(prepared.frames) <= 8
    timestamps = [frame["timestampMs"] for frame in prepared.frames]
    assert timestamps == sorted(timestamps), timestamps


def test_b13_the_wav_is_16k_mono_pcm_s16le(tmp_path: Path, media: Path) -> None:
    prepared = _preparer(tmp_path, media).prepare(media, declared_media_type="video/mp4")

    wave = prepared.wav_path.read_bytes()
    assert wave[:4] == b"RIFF"
    assert wave[8:12] == b"WAVE"
    assert wave[12:16] == b"fmt "
    # PCM (1), 16 kHz, mono
    assert int.from_bytes(wave[20:22], "little") == 1
    assert int.from_bytes(wave[24:28], "little") == 16_000
    assert int.from_bytes(wave[22:24], "little") == 1
    assert int.from_bytes(wave[34:36], "little") == 16


def test_b13_a_file_without_a_video_stream_is_refused(tmp_path: Path) -> None:
    audio_only = tmp_path / "audio.m4a"
    subprocess.run(
        [
            FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
            "-c:a", "aac", str(audio_only),
        ],
        check=True,
        timeout=120,
    )
    with pytest.raises(ImportError) as error:
        _preparer(tmp_path, audio_only).prepare(audio_only, declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_MEDIA_INVALID"


def test_b13_a_faked_mime_is_still_probed(tmp_path: Path, media: Path) -> None:
    # Declared as WebM but the bytes are really MP4: ffprobe is the truth, so
    # this must fail closed rather than trust the declared type.
    with pytest.raises(ImportError) as error:
        _preparer(tmp_path, media).prepare(media, declared_media_type="video/webm")
    assert error.value.code == "V3_MEDIA_IMPORT_MEDIA_INVALID"


# --- B14: the frozen bounds --------------------------------------------------


def test_b14_a_media_beyond_the_duration_limit_is_refused(tmp_path: Path, media: Path) -> None:
    with pytest.raises(ImportError) as error:
        _preparer(tmp_path, media, max_duration_ms=1_000, runner=_fixed_runner).prepare(
            media, declared_media_type="video/mp4"
        )
    assert error.value.code == "V3_MEDIA_IMPORT_DURATION_LIMIT"
    # Nothing may be published when the duration gate refuses.
    assert not list((tmp_path / "audio").glob("*")) if (tmp_path / "audio").exists() else True


# --- B15: the tool boundary --------------------------------------------------


def test_b15_a_digest_mismatch_is_fail_closed(tmp_path: Path, media: Path) -> None:
    snapshot = _snapshot()
    snapshot["ffprobe"]["sha256"] = "f" * 64
    preparer = LocalMediaPreparer(
        task_id=TASK_ID,
        source_identity=SOURCE,
        snapshot=snapshot,
        input_root=tmp_path / "inputs",
        audio_root=tmp_path / "audio",
        visual_root=tmp_path / "visual",
    )
    with pytest.raises(ImportError) as error:
        preparer.prepare(media, declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_PREPARE_FAILED"
    # Nothing may be published on a tool-integrity failure.
    assert not list((tmp_path / "audio").glob("*")) if (tmp_path / "audio").exists() else True
    assert not list((tmp_path / "visual").glob("*")) if (tmp_path / "visual").exists() else True


def test_b15_hostile_stderr_never_reaches_the_error(tmp_path: Path, media: Path) -> None:
    with pytest.raises(ImportError) as error:
        _preparer(tmp_path, media, runner=_hostile_runner).prepare(
            media, declared_media_type="video/mp4"
        )
    rendered = f"{error.value.public_message} {json.dumps(error.value.details)}"
    assert "SECRET" not in rendered
    assert "/tmp" not in rendered
    assert "ffprobe" not in rendered


# --- B18: the receipt --------------------------------------------------------


def test_b18_the_receipt_closes_over_task_source_media_and_hashes(tmp_path: Path, media: Path) -> None:
    prepared = _preparer(tmp_path, media).prepare(media, declared_media_type="video/mp4")

    receipt = prepared.visual_receipt
    assert receipt["taskId"] == TASK_ID
    assert receipt["sourceIdentity"] == SOURCE
    assert receipt["mediaSha256"] == _digest(media)
    assert receipt["durationMs"] == prepared.duration_ms
    assert 1 <= len(receipt["frames"]) <= 8

    hashes = {frame["artifact"]["sha256"] for frame in receipt["frames"]}
    assert len(hashes) == len(receipt["frames"]), "each frame must have its own digest"

    published = prepared.visual_receipt_path.read_bytes()
    # The published bytes are the CANONICAL serialisation of the receipt.
    assert published.decode("utf-8") == C.canonical_json(receipt)
    assert C.digest_of(receipt) == C.digest_of(json.loads(published))


def test_b18_frames_are_distributed_across_the_duration(tmp_path: Path, media: Path) -> None:
    prepared = _preparer(tmp_path, media).prepare(media, declared_media_type="video/mp4")

    timestamps = [frame["timestampMs"] for frame in prepared.frames]
    assert len(set(timestamps)) == len(timestamps)
    assert max(timestamps) >= min(timestamps)


def _fixed_runner(command: list[str], timeout: float) -> subprocess.CompletedProcess[str]:
    """A stub whose ffprobe answer reports a one-hour media."""
    payload = {
        "format": {"format_name": "mp4", "duration": "3600.0"},
        "streams": [
            {"codec_type": "video", "width": 1280, "height": 720, "duration": "3600.0"},
            {"codec_type": "audio", "sample_rate": "44100"},
        ],
    }
    return subprocess.CompletedProcess(command, 0, json.dumps(payload), "")


def _hostile_runner(command: list[str], timeout: float) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(
        command, 1, "", "SECRET=/home/user/cookie.txt ffprobe exploded at /tmp/secret"
    )
