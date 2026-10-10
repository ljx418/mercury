from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np

from .frame_extractor import FrameExtractionError, FrameExtractor, VisionMediaBinding


POLICY_VERSION = "v3-frame-sampling/v1"
ALGORITHM = "scene-change-plus-timeline-budget/v1"
CANDIDATE_LIMIT = 24
SELECTED_LIMIT = 12
CLOUD_LIMIT = 8


@dataclass(frozen=True)
class SamplingPoint:
    timestamp_ms: int
    reason: str
    scene_score: float
    selected: bool
    cloud_eligible: bool

    def public_dict(self) -> dict[str, Any]:
        return {
            "timestampMs": self.timestamp_ms,
            "reason": self.reason,
            "sceneScore": self.scene_score,
            "selected": self.selected,
            "cloudEligible": self.cloud_eligible,
        }


@dataclass(frozen=True)
class SamplingReceipt:
    policy_version: str
    algorithm: str
    media_sha256: str
    duration_ms: int
    points: tuple[SamplingPoint, ...]
    content_sha256: str

    def public_dict(self) -> dict[str, Any]:
        return {
            "policyVersion": self.policy_version,
            "algorithm": self.algorithm,
            "candidateFrameLimit": CANDIDATE_LIMIT,
            "selectedEvidenceLimit": SELECTED_LIMIT,
            "cloudVisionFrameLimit": CLOUD_LIMIT,
            "maxDimensionPx": 1280,
            "rawVideoUploadAllowed": False,
            "mediaSha256": self.media_sha256,
            "durationMs": self.duration_ms,
            "points": [point.public_dict() for point in self.points],
            "contentSha256": self.content_sha256,
        }


def _timeline(duration_ms: int, count: int) -> list[int]:
    if count <= 1:
        return [0]
    last = duration_ms - 1
    return sorted({round(index * last / (count - 1)) for index in range(count)})


class FrameSelectionPolicy:
    def __init__(self, extractor: FrameExtractor) -> None:
        self.extractor = extractor

    def sample(self, binding: VisionMediaBinding) -> SamplingReceipt:
        media_path, probe = self.extractor.bind(binding)
        tail_margin_ms = min(250, max(40, probe.duration_ms // 20))
        decodable_duration_ms = max(1, probe.duration_ms - tail_margin_ms + 1)
        scan_count = min(96, max(12, math.ceil(probe.duration_ms / 250)))
        scan_timestamps = _timeline(decodable_duration_ms, scan_count)
        capture = cv2.VideoCapture(str(media_path))
        if not capture.isOpened():
            raise FrameExtractionError("FRAME_EXTRACTION_FAILED", "OpenCV could not open the bound media.")
        scores: dict[int, float] = {}
        previous: np.ndarray[Any, Any] | None = None
        try:
            for timestamp in scan_timestamps:
                capture.set(cv2.CAP_PROP_POS_MSEC, timestamp)
                ok, frame = capture.read()
                if not ok or frame is None:
                    raise FrameExtractionError("FRAME_EXTRACTION_FAILED", "OpenCV could not decode a sampling frame.")
                gray = cv2.cvtColor(cv2.resize(frame, (64, 36), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
                score = 0.0 if previous is None else float(np.mean(cv2.absdiff(gray, previous))) / 255.0
                scores[timestamp] = round(score, 6)
                previous = gray
        finally:
            capture.release()

        timeline_candidates = _timeline(decodable_duration_ms, 12)
        minimum_gap = max(250, probe.duration_ms // 48)
        scene_candidates: list[int] = []
        for timestamp, _ in sorted(scores.items(), key=lambda item: (-item[1], item[0])):
            if scores[timestamp] <= 0:
                continue
            if all(abs(timestamp - existing) >= minimum_gap for existing in scene_candidates):
                scene_candidates.append(timestamp)
            if len(scene_candidates) == 12:
                break

        candidates = sorted(set(timeline_candidates + scene_candidates))[:CANDIDATE_LIMIT]
        selected_timeline = set(_timeline(decodable_duration_ms, 8))
        selected = {min(candidates, key=lambda value: (abs(value - target), value)) for target in selected_timeline}
        for timestamp in scene_candidates:
            if timestamp in candidates:
                selected.add(timestamp)
            if len(selected) >= SELECTED_LIMIT:
                break
        selected = set(sorted(selected)[:SELECTED_LIMIT])
        cloud = set(sorted(selected)[:CLOUD_LIMIT])

        points = tuple(
            SamplingPoint(
                timestamp_ms=timestamp,
                reason=("both" if timestamp in timeline_candidates and timestamp in scene_candidates else "timeline" if timestamp in timeline_candidates else "scene_change"),
                scene_score=scores.get(timestamp, 0.0),
                selected=timestamp in selected,
                cloud_eligible=timestamp in cloud,
            )
            for timestamp in candidates
        )
        canonical = {
            "policyVersion": POLICY_VERSION,
            "algorithm": ALGORITHM,
            "mediaSha256": binding.media_sha256,
            "durationMs": probe.duration_ms,
            "points": [point.public_dict() for point in points],
        }
        digest = hashlib.sha256(json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        return SamplingReceipt(POLICY_VERSION, ALGORITHM, binding.media_sha256, probe.duration_ms, points, digest)
