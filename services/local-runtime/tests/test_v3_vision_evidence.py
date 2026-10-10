from __future__ import annotations

import json
from pathlib import Path

import cv2
import jsonschema
import numpy as np
import pytest

from navia_runtime.modules.adapters.media_vision import GovernedVisionObservation
from navia_runtime.modules.media_companion.acquisition import TaskArtifactSandbox
from navia_runtime.modules.media_companion.vision import (
    ExtractedFrame,
    FrameEvidenceRecord,
    OcrBlock,
    OcrObservation,
    SamplingReceipt,
    VisionEvidenceBuilder,
    VisionEvidenceError,
)


ROOT = Path(__file__).resolve().parents[3]
SCHEMA = json.loads((ROOT / "docs/active/project/contracts/v3_media_vision_evidence_v1.schema.json").read_text(encoding="utf-8"))
TASK_ID = "media_task_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
SOURCE = "portal:bilibili:BV1ZpYd66ELP:41828944992:1"


def image_bytes(label: str) -> bytes:
    image = np.full((120, 240, 3), 250, dtype=np.uint8)
    cv2.putText(image, label, (15, 75), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2, cv2.LINE_AA)
    ok, encoded = cv2.imencode(".png", image)
    assert ok
    return encoded.tobytes()


def setup_builder(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    sandbox.create(TASK_ID)
    selected_artifact = sandbox.write_bytes(TASK_ID, "frame", image_bytes("KEEP"))
    transient_artifact = sandbox.write_bytes(TASK_ID, "frame", image_bytes("DROP"))
    selected = FrameEvidenceRecord("mev_11111111111111111111111111111111", ExtractedFrame(TASK_ID, 1000, selected_artifact, 240, 120), True)
    transient = FrameEvidenceRecord("mev_22222222222222222222222222222222", ExtractedFrame(TASK_ID, 2000, transient_artifact, 240, 120), False)
    sampling = SamplingReceipt("v3-frame-sampling/v1", "scene-change-plus-timeline-budget/v1", "a" * 64, 8000, (), "b" * 64)
    builder = VisionEvidenceBuilder(sandbox, TASK_ID, SOURCE, sampling)
    builder.add_frame(selected)
    builder.add_frame(transient)
    ocr = OcrObservation(TASK_ID, selected_artifact.artifact_id, selected_artifact.sha256, "rapidocr_local", "3.9.2", True, (OcrBlock("VISIBLE", 0.97, (0.1, 0.2, 0.8, 0.6)),), "c" * 64)
    builder.add_ocr(ocr)
    vision = GovernedVisionObservation(
        TASK_ID, selected.evidence_id, "minimax-cn-openai-vision", "MiniMax-M3", "d" * 64, "e" * 64,
        "consent_33333333333333333333333333333333", 0, "2026-10-08T06:00:00Z", "A directly visible interface.",
        selected_artifact.byte_length, 100, 20, None,
    )
    builder.add_vision(vision)
    consent = {
        "scope": "selected_frame_cloud_vision", "state": "granted", "decisionId": vision.consent_decision_id,
        "grantedAt": "2026-10-08T05:59:00Z", "revokedAt": None, "outboundBarrierAt": None,
        "authorizedDispatchCount": 1, "postRevocationDispatchCount": 0, "consentCheckedPerDispatch": True,
    }
    return sandbox, builder, selected, transient, consent


@pytest.mark.parametrize("terminal", ["succeeded", "failed", "cancelled"])
def test_vision_evidence_is_schema_valid_and_cleans_non_evidence_for_every_terminal(tmp_path: Path, terminal: str) -> None:
    sandbox, builder, selected, transient, consent = setup_builder(tmp_path)
    result = builder.finalize(terminal, consent)
    jsonschema.Draft202012Validator(SCHEMA, format_checker=jsonschema.FormatChecker()).validate(result)
    assert result["cleanup"] == {
        "terminalStatus": terminal,
        "candidateFrameCount": 2,
        "retainedEvidenceFrameCount": 1,
        "deletedNonEvidenceFrameCount": 1,
        "residualNonEvidenceFrameCount": 0,
        "pendingOutboundRequestCount": 0,
        "cleanedAt": result["cleanup"]["cleanedAt"],
    }
    assert sandbox.private_path(TASK_ID, selected.frame.artifact).exists()
    with pytest.raises(FileNotFoundError):
        sandbox.private_path(TASK_ID, transient.frame.artifact)
    serialized = json.dumps(result)
    assert str(tmp_path) not in serialized
    assert "base64" not in serialized
    assert result["ocrObservations"][0]["blocks"][0]["text"] == "VISIBLE"
    assert result["visionObservations"][0]["frameEvidenceId"] == selected.evidence_id


def test_evidence_rejects_cross_task_unselected_vision_and_pending_outbound(tmp_path: Path) -> None:
    _, builder, _, transient, consent = setup_builder(tmp_path)
    bad = GovernedVisionObservation(
        TASK_ID, transient.evidence_id, "minimax-cn-openai-vision", "MiniMax-M3", "d" * 64, "e" * 64,
        consent["decisionId"], 0, "2026-10-08T06:00:00Z", "bad", 1, 1, 1, None,
    )
    with pytest.raises(VisionEvidenceError) as unselected:
        builder.add_vision(bad)
    assert unselected.value.code == "EVIDENCE_IDENTITY_MISMATCH"
    with pytest.raises(VisionEvidenceError) as pending:
        builder.finalize("succeeded", consent, pending_outbound_request_count=1)
    assert pending.value.code == "VISION_CLEANUP_FAILED"


def test_cleanup_hash_drift_fails_closed(tmp_path: Path) -> None:
    sandbox, builder, _, transient, consent = setup_builder(tmp_path)
    path = sandbox.private_path(TASK_ID, transient.frame.artifact)
    path.write_bytes(path.read_bytes() + b"drift")
    with pytest.raises(VisionEvidenceError) as cleanup:
        builder.finalize("failed", consent)
    assert cleanup.value.code == "VISION_CLEANUP_FAILED"
