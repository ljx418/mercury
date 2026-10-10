from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

from ..acquisition.task_artifacts import TaskArtifactError, TaskArtifactSandbox
from .frame_extractor import ExtractedFrame
from .ocr import OcrObservation
from .sampling import SamplingReceipt


OCR_MODEL_REVISION = "3cff6d5868824c357d0609671669511a507bb25fef64ed4030450ebb8f73d81f"


class VisionEvidenceError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class GovernedVisionObservationLike(Protocol):
    task_id: str
    frame_evidence_id: str
    consent_decision_id: str
    dispatch_sequence: int

    def public_dict(self) -> dict[str, Any]: ...


@dataclass(frozen=True)
class FrameEvidenceRecord:
    evidence_id: str
    frame: ExtractedFrame
    selected: bool

    def public_dict(self) -> dict[str, Any]:
        return {
            "evidenceId": self.evidence_id,
            "taskId": self.frame.task_id,
            "timestampMs": self.frame.timestamp_ms,
            "kind": "frame",
            "selected": self.selected,
            "relativeArtifactRef": f"frames/{self.frame.artifact.artifact_id}.png",
            "artifactSha256": self.frame.artifact.sha256,
            "widthPx": self.frame.width_px,
            "heightPx": self.frame.height_px,
            "retention": "evidence_until_task_delete" if self.selected else "delete_at_terminal",
        }


class VisionEvidenceBuilder:
    def __init__(self, sandbox: TaskArtifactSandbox, task_id: str, source_identity: str, sampling: SamplingReceipt) -> None:
        self.sandbox = sandbox
        self.task_id = task_id
        self.source_identity = source_identity
        self.sampling = sampling
        self._frames: dict[str, FrameEvidenceRecord] = {}
        self._artifact_to_evidence: dict[str, str] = {}
        self._ocr: list[OcrObservation] = []
        self._vision: list[GovernedVisionObservationLike] = []

    @staticmethod
    def _valid_evidence_id(value: str) -> bool:
        return value.startswith("mev_") and len(value) == 36 and all(char in "0123456789abcdef" for char in value[4:])

    def add_frame(self, record: FrameEvidenceRecord) -> None:
        if not self._valid_evidence_id(record.evidence_id) or record.frame.task_id != self.task_id or record.evidence_id in self._frames or record.frame.artifact.artifact_id in self._artifact_to_evidence:
            raise VisionEvidenceError("EVIDENCE_IDENTITY_MISMATCH", "Frame evidence identity is invalid or duplicated.")
        if max(record.frame.width_px, record.frame.height_px) > 1280:
            raise VisionEvidenceError("FRAME_BUDGET_EXCEEDED", "Frame exceeds the frozen dimension limit.")
        if len(self._frames) >= 24 or record.selected and sum(item.selected for item in self._frames.values()) >= 12:
            raise VisionEvidenceError("FRAME_BUDGET_EXCEEDED", "Frame evidence budget is exceeded.")
        try:
            self.sandbox.private_path(self.task_id, record.frame.artifact)
        except (OSError, TaskArtifactError) as exc:
            raise VisionEvidenceError("EVIDENCE_IDENTITY_MISMATCH", "Frame artifact is not owned by this task.") from exc
        self._frames[record.evidence_id] = record
        self._artifact_to_evidence[record.frame.artifact.artifact_id] = record.evidence_id

    def add_ocr(self, observation: OcrObservation) -> None:
        frame_evidence_id = self._artifact_to_evidence.get(observation.frame_artifact_id)
        frame = self._frames.get(frame_evidence_id or "")
        if observation.task_id != self.task_id or frame is None or not frame.selected or any(item.frame_artifact_id == observation.frame_artifact_id for item in self._ocr):
            raise VisionEvidenceError("EVIDENCE_IDENTITY_MISMATCH", "OCR observation does not reference this task's frame.")
        self._ocr.append(observation)

    def add_vision(self, observation: GovernedVisionObservationLike) -> None:
        frame = self._frames.get(observation.frame_evidence_id)
        if observation.task_id != self.task_id or frame is None or not frame.selected or any(item.frame_evidence_id == observation.frame_evidence_id for item in self._vision):
            raise VisionEvidenceError("EVIDENCE_IDENTITY_MISMATCH", "VLM observation does not reference a selected task frame.")
        if len(self._vision) >= 8:
            raise VisionEvidenceError("VISION_BUDGET_EXCEEDED", "VLM observation budget is exceeded.")
        self._vision.append(observation)

    def finalize(self, terminal_status: str, consent: dict[str, Any], *, pending_outbound_request_count: int = 0) -> dict[str, Any]:
        if terminal_status not in {"succeeded", "failed", "cancelled"} or pending_outbound_request_count != 0 or not self._frames:
            raise VisionEvidenceError("VISION_CLEANUP_FAILED", "Vision evidence cannot finalize with pending or invalid state.")
        if self._vision:
            sequences = [item.dispatch_sequence for item in self._vision]
            if consent.get("state") != "granted" or consent.get("decisionId") is None or sequences != list(range(len(sequences))) or consent.get("authorizedDispatchCount") != len(self._vision) or any(item.consent_decision_id != consent["decisionId"] for item in self._vision):
                raise VisionEvidenceError("EVIDENCE_IDENTITY_MISMATCH", "VLM consent and dispatch closure is invalid.")

        deleted = 0
        for record in self._frames.values():
            try:
                path = self.sandbox.private_path(self.task_id, record.frame.artifact)
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
            except (OSError, TaskArtifactError) as exc:
                raise VisionEvidenceError("VISION_CLEANUP_FAILED", "Frame integrity verification failed at terminal.") from exc
            if digest != record.frame.artifact.sha256:
                raise VisionEvidenceError("VISION_CLEANUP_FAILED", "Frame bytes changed before terminal cleanup.")
            if not record.selected:
                try:
                    self.sandbox.delete_artifact(self.task_id, record.frame.artifact)
                    deleted += 1
                except (OSError, TaskArtifactError) as exc:
                    raise VisionEvidenceError("VISION_CLEANUP_FAILED", "Non-evidence frame cleanup failed.") from exc

        frames = [record.public_dict() for record in sorted(self._frames.values(), key=lambda item: (item.frame.timestamp_ms, item.evidence_id))]
        ocr = []
        for observation in self._ocr:
            frame_evidence_id = self._artifact_to_evidence[observation.frame_artifact_id]
            blocks = []
            for index, block in enumerate(observation.blocks):
                block_id = "ocr_" + hashlib.sha256(f"{frame_evidence_id}:{index}:{block.text}:{block.confidence}:{block.bbox}".encode("utf-8")).hexdigest()[:32]
                blocks.append({"blockId": block_id, "text": block.text, "confidence": block.confidence, "box": list(block.bbox)})
            evidence_id = "mev_" + hashlib.sha256(f"ocr:{frame_evidence_id}:{observation.content_sha256}".encode()).hexdigest()[:32]
            ocr.append({
                "evidenceId": evidence_id,
                "taskId": self.task_id,
                "frameEvidenceId": frame_evidence_id,
                "kind": "ocr_block",
                "providerId": observation.provider,
                "engineVersion": observation.engine_version,
                "modelRevision": OCR_MODEL_REVISION,
                "localOnly": observation.local_only,
                "blocks": blocks,
                "contentSha256": observation.content_sha256,
            })
        return {
            "schemaVersion": "v3-media-vision-evidence/v1",
            "taskId": self.task_id,
            "sourceIdentity": self.source_identity,
            "samplingPolicy": {
                "policyVersion": self.sampling.policy_version,
                "algorithm": self.sampling.algorithm,
                "candidateFrameLimit": 24,
                "selectedEvidenceLimit": 12,
                "cloudVisionFrameLimit": 8,
                "maxDimensionPx": 1280,
                "rawVideoUploadAllowed": False,
            },
            "consent": consent,
            "frames": frames,
            "ocrObservations": ocr,
            "visionObservations": [item.public_dict() for item in sorted(self._vision, key=lambda item: item.dispatch_sequence)],
            "cleanup": {
                "terminalStatus": terminal_status,
                "candidateFrameCount": len(frames),
                "retainedEvidenceFrameCount": sum(record.selected for record in self._frames.values()),
                "deletedNonEvidenceFrameCount": deleted,
                "residualNonEvidenceFrameCount": 0,
                "pendingOutboundRequestCount": 0,
                "cleanedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            },
        }
