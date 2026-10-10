from __future__ import annotations

import hashlib
import os
import subprocess
from pathlib import Path

import pytest

from navia_runtime.modules.media_companion.acquisition import TaskArtifactSandbox
from navia_runtime.modules.media_companion.vision import FrameExtractionError, FrameExtractor, VisionMediaBinding


TASK_ID = "media_task_33333333333333333333333333333333"
SOURCE = "portal:bilibili:BV1ZpYd66ELP:41828944992:1"


def real_video_bytes(tmp_path: Path) -> bytes:
    output = tmp_path / "real-input.mp4"
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25",
            "-t", "3", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-movflags", "+faststart", "-y", str(output),
        ],
        check=True,
        timeout=30,
    )
    return output.read_bytes()


def setup_binding(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    sandbox.create(TASK_ID)
    payload = real_video_bytes(tmp_path)
    artifact = sandbox.write_bytes(TASK_ID, "video", payload)
    binding = VisionMediaBinding(TASK_ID, SOURCE, artifact, hashlib.sha256(payload).hexdigest(), 3000)
    return sandbox, binding


def test_real_video_binding_and_frame_extraction_are_deterministic(tmp_path: Path) -> None:
    sandbox, binding = setup_binding(tmp_path)
    extractor = FrameExtractor(sandbox)
    _, probe = extractor.bind(binding)
    assert probe.duration_ms == 3000
    assert (probe.width_px, probe.height_px) == (640, 360)

    first = extractor.extract(binding, 1500)
    second = extractor.extract(binding, 1500)
    assert first.artifact.sha256 == second.artifact.sha256
    assert (first.width_px, first.height_px) == (640, 360)
    assert set(first.public_dict()) == {"taskId", "timestampMs", "artifact", "relativeArtifactRef", "widthPx", "heightPx"}
    assert str(tmp_path) not in str(first.public_dict())
    assert first.public_dict()["relativeArtifactRef"].endswith(".png")
    assert oct(os.stat(sandbox.private_path(TASK_ID, first.artifact)).st_mode & 0o777) == "0o600"


@pytest.mark.parametrize("timestamp", [-1, 3000, 4000])
def test_frame_extractor_rejects_out_of_range_timestamps(tmp_path: Path, timestamp: int) -> None:
    sandbox, binding = setup_binding(tmp_path)
    with pytest.raises(FrameExtractionError) as raised:
        FrameExtractor(sandbox).extract(binding, timestamp)
    assert raised.value.code == "FRAME_TIME_OUT_OF_RANGE"


def test_frame_extractor_rejects_cross_task_hash_drift_and_invalid_media(tmp_path: Path) -> None:
    sandbox, binding = setup_binding(tmp_path)
    extractor = FrameExtractor(sandbox)

    other = "media_task_44444444444444444444444444444444"
    sandbox.create(other)
    with pytest.raises(FrameExtractionError) as cross_task:
        extractor.bind(VisionMediaBinding(other, SOURCE, binding.artifact, binding.media_sha256, 3000))
    assert cross_task.value.code == "MEDIA_BINDING_INVALID"

    path = sandbox.private_path(TASK_ID, binding.artifact)
    with path.open("ab") as handle:
        handle.write(b"tamper")
    with pytest.raises(FrameExtractionError) as drift:
        extractor.bind(binding)
    assert drift.value.code == "MEDIA_BINDING_INVALID"

    broken_sandbox = TaskArtifactSandbox(tmp_path / "broken")
    broken_sandbox.create(TASK_ID)
    broken = broken_sandbox.write_bytes(TASK_ID, "video", b"not-a-real-video")
    broken_binding = VisionMediaBinding(TASK_ID, SOURCE, broken, broken.sha256, 1000)
    with pytest.raises(FrameExtractionError) as invalid:
        FrameExtractor(broken_sandbox).bind(broken_binding)
    assert invalid.value.code == "MEDIA_BINDING_INVALID"


def test_frame_extractor_cleans_staging_file_after_ffmpeg_failure(tmp_path: Path) -> None:
    sandbox, binding = setup_binding(tmp_path)

    def failing_runner(command, **kwargs):
        if command[0] == "ffprobe":
            return subprocess.run(command, **kwargs)
        return subprocess.CompletedProcess(command, 1, "", "failure")

    with pytest.raises(FrameExtractionError) as raised:
        FrameExtractor(sandbox, runner=failing_runner).extract(binding, 1000)
    assert raised.value.code == "FRAME_EXTRACTION_FAILED"
    task_dir = next((tmp_path / "tasks").iterdir())
    assert not list(task_dir.glob(".stage_*.png"))
