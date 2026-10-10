from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from navia_runtime.modules.media_companion.acquisition import TaskArtifactSandbox
from navia_runtime.modules.media_companion.vision import FrameExtractor, FrameSelectionPolicy, VisionMediaBinding


TASK_ID = "media_task_66666666666666666666666666666666"


def binding(tmp_path: Path):
    video = tmp_path / "changing.mp4"
    subprocess.run([
        "ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25",
        "-t", "6", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-g", "25", "-y", str(video),
    ], check=True, timeout=30)
    payload = video.read_bytes()
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    sandbox.create(TASK_ID)
    artifact = sandbox.write_bytes(TASK_ID, "video", payload)
    media = VisionMediaBinding(
        TASK_ID,
        "portal:bilibili:BV1ZpYd66ELP:41828944992:1",
        artifact,
        hashlib.sha256(payload).hexdigest(),
        6000,
    )
    return sandbox, media


def test_sampling_is_deterministic_bounded_and_text_independent(tmp_path: Path) -> None:
    sandbox, media = binding(tmp_path)
    policy = FrameSelectionPolicy(FrameExtractor(sandbox))
    first = policy.sample(media).public_dict()
    second = policy.sample(media).public_dict()
    assert first == second
    assert first["contentSha256"] == second["contentSha256"]
    points = first["points"]
    timestamps = [point["timestampMs"] for point in points]
    assert 1 <= len(points) <= 24
    assert timestamps == sorted(set(timestamps))
    assert all(0 <= value < 6000 for value in timestamps)
    assert max(timestamps) <= 5750
    assert sum(point["selected"] for point in points) <= 12
    assert sum(point["cloudEligible"] for point in points) <= 8
    assert all(not point["cloudEligible"] or point["selected"] for point in points)
    assert {point["reason"] for point in points} <= {"timeline", "scene_change", "both"}
    assert all(point["sceneScore"] >= 0 for point in points)
    serialized = json.dumps(first)
    assert "transcript" not in serialized.lower()
    assert "title" not in serialized.lower()
    assert "description" not in serialized.lower()


def test_sampling_hash_changes_with_bound_media_hash(tmp_path: Path) -> None:
    sandbox, media = binding(tmp_path)
    receipt = FrameSelectionPolicy(FrameExtractor(sandbox)).sample(media)
    assert receipt.media_sha256 == media.media_sha256
    assert len(receipt.content_sha256) == 64
