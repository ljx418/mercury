from __future__ import annotations

import json
from types import SimpleNamespace

import cv2
import numpy as np
import pytest

from navia_runtime.modules.media_companion.acquisition import TaskArtifactSandbox
from navia_runtime.modules.media_companion.vision import LocalOcrAdapter, LocalOcrError


TASK_ID = "media_task_77777777777777777777777777777777"
OTHER_TASK_ID = "media_task_88888888888888888888888888888888"


def frame_artifact(tmp_path, *, text: str = "NAVIA 2026"):
    image = np.full((180, 640, 3), 255, dtype=np.uint8)
    cv2.putText(image, text, (25, 115), cv2.FONT_HERSHEY_SIMPLEX, 2.0, (0, 0, 0), 4, cv2.LINE_AA)
    ok, encoded = cv2.imencode(".png", image)
    assert ok
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    sandbox.create(TASK_ID)
    return sandbox, sandbox.write_bytes(TASK_ID, "frame", encoded.tobytes())


def result(text="NAVIA 2026", score=0.98):
    return SimpleNamespace(
        boxes=np.array([[[20, 40], [610, 40], [610, 140], [20, 140]]], dtype=float),
        txts=(text,),
        scores=(score,),
    )


def test_ocr_observation_is_typed_deterministic_and_path_free(tmp_path) -> None:
    sandbox, frame = frame_artifact(tmp_path)
    adapter = LocalOcrAdapter(sandbox, engine_factory=lambda: lambda image: result())
    first = adapter.observe(TASK_ID, frame).public_dict()
    second = adapter.observe(TASK_ID, frame).public_dict()
    assert first == second
    assert first["provider"] == "rapidocr_local"
    assert first["engineVersion"] == "3.9.2"
    assert first["localOnly"] is True
    assert first["blocks"] == [{"text": "NAVIA 2026", "confidence": 0.98, "bbox": [0.03125, 0.222222, 0.953125, 0.777778]}]
    serialized = json.dumps(first)
    assert str(tmp_path) not in serialized
    assert "image" not in serialized.lower()


def test_ocr_allows_empty_observation_without_inventing_caption(tmp_path) -> None:
    sandbox, frame = frame_artifact(tmp_path, text="")
    empty = SimpleNamespace(boxes=None, txts=None, scores=None)
    observed = LocalOcrAdapter(sandbox, engine_factory=lambda: lambda image: empty).observe(TASK_ID, frame).public_dict()
    assert observed["blocks"] == []
    assert "caption" not in observed


def test_ocr_rejects_cross_task_hash_drift_corrupt_frame_and_bad_engine_output(tmp_path) -> None:
    sandbox, frame = frame_artifact(tmp_path)
    adapter = LocalOcrAdapter(sandbox, engine_factory=lambda: lambda image: result())
    sandbox.create(OTHER_TASK_ID)
    with pytest.raises(LocalOcrError) as cross_task:
        adapter.observe(OTHER_TASK_ID, frame)
    assert cross_task.value.code == "OCR_ASSET_INVALID"

    path = sandbox.private_path(TASK_ID, frame)
    path.write_bytes(path.read_bytes() + b"drift")
    with pytest.raises(LocalOcrError) as drift:
        adapter.observe(TASK_ID, frame)
    assert drift.value.code == "OCR_ASSET_INVALID"

    broken_sandbox = TaskArtifactSandbox(tmp_path / "broken")
    broken_sandbox.create(TASK_ID)
    broken = broken_sandbox.write_bytes(TASK_ID, "frame", b"not-an-image")
    with pytest.raises(LocalOcrError) as corrupt:
        LocalOcrAdapter(broken_sandbox, engine_factory=lambda: lambda image: result()).observe(TASK_ID, broken)
    assert corrupt.value.code == "OCR_FAILED"

    clean_sandbox, clean = frame_artifact(tmp_path / "bad-output")
    bad = SimpleNamespace(boxes=np.zeros((1, 4, 2)), txts=("",), scores=(2.0,))
    with pytest.raises(LocalOcrError) as invalid_output:
        LocalOcrAdapter(clean_sandbox, engine_factory=lambda: lambda image: bad).observe(TASK_ID, clean)
    assert invalid_output.value.code == "OCR_FAILED"


def test_real_frozen_rapidocr_engine_recognizes_generated_frame_offline(tmp_path, monkeypatch) -> None:
    sandbox, frame = frame_artifact(tmp_path)

    def denied(*args, **kwargs):
        raise AssertionError("OCR must not use the network")

    monkeypatch.setattr("socket.socket.connect", denied)
    observation = LocalOcrAdapter(sandbox).observe(TASK_ID, frame)
    assert observation.local_only is True
    assert observation.provider == "rapidocr_local"
    assert observation.blocks
    assert any("NAVIA" in block.text.upper().replace(" ", "") for block in observation.blocks)
