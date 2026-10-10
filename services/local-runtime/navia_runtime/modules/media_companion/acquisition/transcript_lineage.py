from __future__ import annotations

from dataclasses import dataclass
import re


EXPECTED_SLOTS = (
    ("v3-sample-07", "BV13W41137qV"),
    ("v3-sample-08", "BV1ZpYd66ELP"),
    ("v3-sample-09", "BV1pW421c7DH"),
)


@dataclass(frozen=True)
class TranscriptLineageEntry:
    sample_id: str
    bvid: str
    task_id: str
    source_identity: str
    acquisition_record_id: str
    audio_sha256: str
    transcript_sha256: str


@dataclass(frozen=True)
class TranscriptLineageManifest:
    run_id: str
    source_run_id: str
    source_content_sha256: str
    entries: tuple[TranscriptLineageEntry, ...]
    cross_run_artifact_count: int = 0
    human_transcript_input_count: int = 0

    def validate(self) -> None:
        if not re.fullmatch(r"v3-2-3-sensevoice-[0-9]{8}T[0-9]{6}Z", self.run_id):
            raise ValueError("V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH")
        if not re.fullmatch(r"v3-2-route-b3-[0-9]{8}T[0-9]{6}Z", self.source_run_id):
            raise ValueError("V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH")
        if not re.fullmatch(r"[a-f0-9]{64}", self.source_content_sha256):
            raise ValueError("V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH")
        if self.cross_run_artifact_count or self.human_transcript_input_count or len(self.entries) != 3:
            raise ValueError("V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH")
        if tuple((entry.sample_id, entry.bvid) for entry in self.entries) != EXPECTED_SLOTS:
            raise ValueError("V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH")
        for values in (
            [entry.task_id for entry in self.entries],
            [entry.source_identity for entry in self.entries],
            [entry.acquisition_record_id for entry in self.entries],
            [entry.audio_sha256 for entry in self.entries],
            [entry.transcript_sha256 for entry in self.entries],
        ):
            if len(set(values)) != 3 or any(not value for value in values):
                raise ValueError("V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH")
