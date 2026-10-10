from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence

from .task_artifacts import ArtifactRef


@dataclass(frozen=True)
class MediaIdentity:
    adapter_id: str
    media_id: str
    playback_unit_id: str
    part_id: str
    part_index: int
    part_count: int
    duration_seconds: float


@dataclass(frozen=True)
class SubtitleCandidate:
    candidate_id: str
    language: str
    label: str
    private_body_url: str
    discovery_sha256: str


@dataclass(frozen=True)
class SubtitleDiscoveryReceipt:
    candidates: tuple[SubtitleCandidate, ...]
    response_sha256: str
    observed_at: str


@dataclass(frozen=True)
class SubtitleSegment:
    start_ms: int
    end_ms: int
    text: str
    text_sha256: str


@dataclass(frozen=True)
class ResolvedSubtitle:
    language: str
    segments: tuple[SubtitleSegment, ...]
    body_sha256: str
    source_sha256: str


@dataclass(frozen=True)
class AcquiredMedia:
    identity: MediaIdentity
    artifact: ArtifactRef
    container: str
    sample_rate_hz: int | None
    channels: int | None


@dataclass(frozen=True)
class AcquisitionAudioRef:
    task_id: str
    source_identity: str
    acquisition_record_id: str
    artifact: ArtifactRef
    duration_ms: int
    sample_rate_hz: int
    channels: int
    sample_width_bytes: int

    def validate(self) -> None:
        if (
            self.artifact.task_id != self.task_id
            or self.artifact.kind != "audio"
            or not self.source_identity.startswith("portal:")
            or not self.acquisition_record_id.startswith("mar_")
            or len(self.acquisition_record_id) != 36
            or self.duration_ms <= 0
            or self.sample_rate_hz != 16000
            or self.channels != 1
            or self.sample_width_bytes != 2
        ):
            raise ValueError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE")


class MediaAcquirer(Protocol):
    def resolve_identity(self, media_id: str, playback_unit_id: str, part_id: str, credentials: Sequence[dict[str, object]]) -> MediaIdentity: ...

    def probe_subtitles(self, identity: MediaIdentity, credentials: Sequence[dict[str, object]]) -> tuple[SubtitleCandidate, ...]: ...

    def probe_subtitles_with_receipt(
        self, identity: MediaIdentity, credentials: Sequence[dict[str, object]]
    ) -> SubtitleDiscoveryReceipt: ...

    def acquire_subtitle(self, identity: MediaIdentity, candidate: SubtitleCandidate, credentials: Sequence[dict[str, object]]) -> ResolvedSubtitle: ...

    def acquire_audio(self, task_id: str, identity: MediaIdentity, credentials: Sequence[dict[str, object]]) -> AcquiredMedia: ...
