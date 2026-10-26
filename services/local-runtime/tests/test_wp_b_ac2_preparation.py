"""WP-B AC2 — the preparation oracles: B13, B14 and B15.

* **B13** — a REAL MP4, WebM and Matroska each pass the preparation; a faked
  MIME and a file with no video stream both fail.
* **B14** — a DETERMINISTIC ffprobe runner proves the exact four-hour boundary
  and one millisecond past it, and the exact dimension boundary and one column
  past it, without allocating a four-hour media file.
* **B15** — a missing verified tool, a digest drift, a timeout, a non-zero exit
  and a hostile output are all refused, and no private diagnostic leaks.
"""

from __future__ import annotations

import json
import hashlib
import subprocess
import tracemalloc
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.local_import.contracts import ImportError
from navia_runtime.modules.media_companion.local_import.preparer import (
    DIGEST_CHUNK_BYTES,
    LocalMediaPreparer,
    _digest as production_digest,
)

FFMPEG = "/usr/bin/ffmpeg"
FFPROBE = "/usr/bin/ffprobe"
TASK_ID = "media_task_" + "b" * 32
SOURCE = "portal:bilibili:BV1AC2TEST:cid:1"
GENERATION = "depgen_" + "c" * 64


def _digest(path: Path) -> str:
    import hashlib

    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _snapshot() -> dict[str, Any]:
    return {
        "generation": GENERATION,
        "ffmpeg": {"path": FFMPEG, "sha256": _digest(Path(FFMPEG))},
        "ffprobe": {"path": FFPROBE, "sha256": _digest(Path(FFPROBE))},
    }


@pytest.fixture(scope="module")
def real_media(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Path]:
    """REAL containers, produced by the verified ffmpeg."""
    root = tmp_path_factory.mktemp("ac2-prep")
    produced: dict[str, Path] = {}
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
    produced["video/mp4"] = mp4

    webm = root / "sample.webm"
    subprocess.run(
        [
            FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=3",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libvpx-vp9", "-b:v", "200k", "-c:a", "libopus",
            "-shortest", "-t", "3", str(webm),
        ],
        check=True, timeout=900,
    )
    produced["video/webm"] = webm

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
    produced["video/x-matroska"] = mkv

    # A file with a real audio stream and NO video stream.
    audio_only = root / "audio-only.m4a"
    subprocess.run(
        [
            FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
            "-c:a", "aac", str(audio_only),
        ],
        check=True, timeout=300,
    )
    produced["audio-only"] = audio_only
    return produced


def _preparer(tmp_path: Path, **overrides: Any) -> LocalMediaPreparer:
    return LocalMediaPreparer(
        task_id=TASK_ID,
        source_identity=SOURCE,
        snapshot=_snapshot(),
        input_root=tmp_path / "in",
        audio_root=tmp_path / "audio",
        visual_root=tmp_path / "visual",
        **overrides,
    )


def test_large_media_digest_is_incremental_and_memory_bounded(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "large-media.bin"
    block = bytes((index % 251 for index in range(DIGEST_CHUNK_BYTES)))
    expected = hashlib.sha256()
    with target.open("wb") as output:
        for _ in range(32):
            output.write(block)
            expected.update(block)

    def forbid_whole_file_read(_path: Path) -> bytes:
        raise AssertionError("large media hashing must not call Path.read_bytes()")

    monkeypatch.setattr(Path, "read_bytes", forbid_whole_file_read)
    tracemalloc.start()
    try:
        actual = production_digest(target)
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()

    assert actual == expected.hexdigest()
    assert peak <= DIGEST_CHUNK_BYTES * 3


# ---------------------------------------------------------------------------
# B13 — the three real containers.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("declared", "key"),
    [("video/mp4", "video/mp4"), ("video/webm", "video/webm"), ("video/x-matroska", "video/x-matroska")],
)
def test_b13_every_real_container_passes_the_preparation(
    tmp_path: Path, real_media, declared: str, key: str
) -> None:
    """B13 — MP4, WebM and Matroska each prepare."""
    prepared = _preparer(tmp_path).prepare(real_media[key], declared_media_type=declared)
    assert prepared.duration_ms > 0
    assert 1 <= len(prepared.frames) <= 8
    assert prepared.wav_path.is_file()
    # The public container is the FROZEN enum, never the raw ffprobe string.
    assert prepared.container in C.MEDIA_CONTAINERS
    assert prepared.container == {
        "video/mp4": "mp4",
        "video/webm": "webm",
        "video/x-matroska": "matroska",
    }[declared]


def test_b13_a_faked_mime_is_refused(tmp_path: Path, real_media) -> None:
    """B13 — a WebM declared as MP4 is refused."""
    with pytest.raises(ImportError) as error:
        _preparer(tmp_path).prepare(real_media["video/webm"], declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_MEDIA_INVALID"


def test_b13_a_file_without_a_video_stream_is_refused(tmp_path: Path, real_media) -> None:
    """B13 — audio only is not a video."""
    with pytest.raises(ImportError) as error:
        _preparer(tmp_path).prepare(real_media["audio-only"], declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_MEDIA_INVALID"


def test_b13_a_refused_preparation_publishes_nothing(tmp_path: Path, real_media) -> None:
    """B13 — a refusal leaves no WAV, no frame and no receipt."""
    preparer = _preparer(tmp_path)
    with pytest.raises(ImportError):
        preparer.prepare(real_media["video/webm"], declared_media_type="video/mp4")
    assert not (tmp_path / "audio" / "audio.wav").exists()
    assert not list((tmp_path / "visual").glob("*.png")) if (tmp_path / "visual").exists() else True
    assert not (tmp_path / "visual" / "visual-receipt.json").exists()


# ---------------------------------------------------------------------------
# B14 — the exact boundaries, with a deterministic ffprobe runner.
# ---------------------------------------------------------------------------


def _probe_runner(duration_ms: int, width: int, height: int, container: str = "mov,mp4,m4a"):
    """A deterministic ffprobe: the REAL probe's JSON shape, a chosen answer."""
    payload = {
        "streams": [
            {
                "codec_type": "video",
                "codec_name": "h264",
                "width": width,
                "height": height,
            },
            {"codec_type": "audio", "codec_name": "aac"},
        ],
        "format": {"format_name": container, "duration": f"{duration_ms / 1000:.3f}"},
    }

    real_runner = _default_runner

    def runner(command: list[str], timeout: float) -> subprocess.CompletedProcess[str]:
        # Only the PROBE is deterministic. The render still runs the real tool,
        # so the case proves the boundary and not a fabricated result.
        if any("ffprobe" in part for part in command):
            return subprocess.CompletedProcess(
                args=command, returncode=0, stdout=json.dumps(payload), stderr=""
            )
        return real_runner(command, timeout)

    return runner


def _default_runner(command: list[str], timeout: float) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command, capture_output=True, text=True, timeout=timeout, check=False
    )


def test_b14_exactly_four_hours_is_allowed(tmp_path: Path, real_media) -> None:
    """B14 — 14,400,000 ms is the frozen boundary and it is ALLOWED.

    The duration is proven with a DETERMINISTIC probe so no four-hour file is
    ever allocated. The fixture is three seconds long, so the frame extraction
    that follows may fail on the real media; what this case proves is that the
    DURATION gate accepted the exact boundary instead of refusing it.
    """
    preparer = _preparer(
        tmp_path, runner=_probe_runner(C.MAX_DURATION_MS, 320, 240)
    )
    try:
        prepared = preparer.prepare(real_media["video/mp4"], declared_media_type="video/mp4")
    except ImportError as error:
        assert error.code != "V3_MEDIA_IMPORT_DURATION_LIMIT", error.code
        return
    assert prepared.duration_ms == C.MAX_DURATION_MS


def test_b14_one_millisecond_past_four_hours_is_refused(tmp_path: Path, real_media) -> None:
    """B14 — one millisecond past the boundary is refused, and no media is made."""
    preparer = _preparer(
        tmp_path, runner=_probe_runner(C.MAX_DURATION_MS + 1, 320, 240)
    )
    with pytest.raises(ImportError) as error:
        preparer.prepare(real_media["video/mp4"], declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_DURATION_LIMIT"
    assert not (tmp_path / "audio" / "audio.wav").exists()


def test_b14_the_exact_dimension_boundary_is_allowed(tmp_path: Path, real_media) -> None:
    """B14 — 7680x4320 is the frozen boundary and it is ALLOWED."""
    preparer = _preparer(tmp_path, runner=_probe_runner(3_000, 7680, 4320))
    prepared = preparer.prepare(real_media["video/mp4"], declared_media_type="video/mp4")
    assert prepared.width == 7680
    assert prepared.height == 4320


def test_b14_one_column_past_the_dimension_boundary_is_refused(
    tmp_path: Path, real_media
) -> None:
    """B14 — one column past the boundary is refused."""
    preparer = _preparer(tmp_path, runner=_probe_runner(3_000, 7681, 4320))
    with pytest.raises(ImportError) as error:
        preparer.prepare(real_media["video/mp4"], declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_MEDIA_INVALID"
    assert not (tmp_path / "audio" / "audio.wav").exists()


# ---------------------------------------------------------------------------
# B15 — the tool failures.
# ---------------------------------------------------------------------------


def test_b15_a_missing_verified_tool_is_refused(tmp_path: Path, real_media) -> None:
    """B15 — a snapshot without the tool fails closed before any subprocess."""
    snapshot = _snapshot()
    snapshot.pop("ffprobe")
    preparer = LocalMediaPreparer(
        task_id=TASK_ID,
        source_identity=SOURCE,
        snapshot=snapshot,
        input_root=tmp_path / "in",
        audio_root=tmp_path / "audio",
        visual_root=tmp_path / "visual",
    )
    with pytest.raises(ImportError) as error:
        preparer.prepare(real_media["video/mp4"], declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_PREPARE_FAILED"


def test_b15_a_digest_drift_is_refused(tmp_path: Path, real_media) -> None:
    """B15 — the verified digest is checked before the tool runs."""
    snapshot = _snapshot()
    snapshot["ffmpeg"] = {"path": FFMPEG, "sha256": "0" * 64}
    preparer = LocalMediaPreparer(
        task_id=TASK_ID,
        source_identity=SOURCE,
        snapshot=snapshot,
        input_root=tmp_path / "in",
        audio_root=tmp_path / "audio",
        visual_root=tmp_path / "visual",
    )
    with pytest.raises(ImportError) as error:
        preparer.prepare(real_media["video/mp4"], declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_PREPARE_FAILED"
    assert not (tmp_path / "audio" / "audio.wav").exists()


def test_b15_a_timeout_is_refused(tmp_path: Path, real_media) -> None:
    """B15 — a tool that does not finish in time is refused."""
    def runner(command: list[str], timeout: float) -> subprocess.CompletedProcess[str]:
        raise subprocess.TimeoutExpired(cmd=command, timeout=timeout)

    preparer = _preparer(tmp_path, runner=runner)
    with pytest.raises(ImportError) as error:
        preparer.prepare(real_media["video/mp4"], declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_PREPARE_FAILED"
    assert not (tmp_path / "audio" / "audio.wav").exists()


def test_b15_a_non_zero_exit_is_refused(tmp_path: Path, real_media) -> None:
    """B15 — a tool that fails is refused."""
    def runner(command: list[str], timeout: float) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(args=command, returncode=1, stdout="", stderr="boom")

    preparer = _preparer(tmp_path, runner=runner)
    with pytest.raises(ImportError) as error:
        preparer.prepare(real_media["video/mp4"], declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_PREPARE_FAILED"
    assert not (tmp_path / "audio" / "audio.wav").exists()


def test_b15_a_hostile_output_never_leaks_into_the_error(tmp_path: Path, real_media) -> None:
    """B15 — the tool's own output is never published, not even in the error."""
    secret = "/home/somebody/private/path/secret-token"

    def runner(command: list[str], timeout: float) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            args=command, returncode=1, stdout="", stderr=f"fatal: {secret}"
        )

    preparer = _preparer(tmp_path, runner=runner)
    with pytest.raises(ImportError) as error:
        preparer.prepare(real_media["video/mp4"], declared_media_type="video/mp4")
    rendered = f"{error.value} {error.value.args} {error.value.details if hasattr(error.value, 'details') else ''}"
    assert secret not in rendered
    assert "fatal" not in rendered


def test_b15_a_hostile_probe_output_is_refused(tmp_path: Path, real_media) -> None:
    """B15 — a probe that answers with rubbish is refused, not believed."""
    def runner(command: list[str], timeout: float) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            args=command, returncode=0, stdout="not json at all", stderr=""
        )

    preparer = _preparer(tmp_path, runner=runner)
    with pytest.raises(ImportError) as error:
        preparer.prepare(real_media["video/mp4"], declared_media_type="video/mp4")
    assert error.value.code == "V3_MEDIA_IMPORT_MEDIA_INVALID"
    assert not (tmp_path / "audio" / "audio.wav").exists()
