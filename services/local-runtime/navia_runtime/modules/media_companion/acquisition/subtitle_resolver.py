from __future__ import annotations

import hashlib
import json
from typing import Any

from .contracts import ResolvedSubtitle, SubtitleCandidate, SubtitleSegment
from .coordinator import MediaAcquisitionError


class SubtitleResolver:
    def resolve(self, candidate: SubtitleCandidate, payload: bytes, *, duration_seconds: float) -> ResolvedSubtitle:
        if not payload:
            raise MediaAcquisitionError("V3_MEDIA_SUBTITLE_UNAVAILABLE", "Subtitle body is empty.")
        try:
            document = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise MediaAcquisitionError("V3_MEDIA_SUBTITLE_UNAVAILABLE", "Subtitle body is not valid JSON.") from exc
        body = document.get("body") if isinstance(document, dict) else None
        if not isinstance(body, list) or not body:
            raise MediaAcquisitionError("V3_MEDIA_SUBTITLE_UNAVAILABLE", "Subtitle body contains no segments.")
        maximum_ms = int(duration_seconds * 1000)
        previous_end = 0
        segments: list[SubtitleSegment] = []
        for raw in body:
            if not isinstance(raw, dict):
                raise MediaAcquisitionError("V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID", "Subtitle segment is invalid.")
            start = raw.get("from")
            end = raw.get("to")
            text = raw.get("content")
            if (
                not isinstance(start, (int, float))
                or isinstance(start, bool)
                or not isinstance(end, (int, float))
                or isinstance(end, bool)
                or not isinstance(text, str)
            ):
                raise MediaAcquisitionError("V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID", "Subtitle segment fields are invalid.")
            normalized = " ".join(text.split())
            start_ms = int(round(float(start) * 1000))
            end_ms = int(round(float(end) * 1000))
            if not normalized or start_ms < 0 or end_ms <= start_ms or end_ms > maximum_ms or start_ms < previous_end:
                raise MediaAcquisitionError("V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID", "Subtitle segment timing or text is invalid.")
            segments.append(SubtitleSegment(start_ms, end_ms, normalized, hashlib.sha256(normalized.encode("utf-8")).hexdigest()))
            previous_end = end_ms
        body_sha256 = hashlib.sha256(payload).hexdigest()
        source = {
            "candidateId": candidate.candidate_id,
            "discoverySha256": candidate.discovery_sha256,
            "bodySha256": body_sha256,
            "language": candidate.language,
            "segmentCount": len(segments),
        }
        source_sha256 = hashlib.sha256(json.dumps(source, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
        return ResolvedSubtitle(candidate.language, tuple(segments), body_sha256, source_sha256)

