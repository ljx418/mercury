from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath
from threading import Event
from typing import Callable, Protocol


class AsrProviderError(RuntimeError):
    def __init__(self, code: str, message: str, *, private_diagnostic: dict[str, object] | None = None):
        super().__init__(message)
        self.code = code
        self.private_diagnostic = private_diagnostic


@dataclass(frozen=True)
class TaskAudioRef:
    task_id: str
    relative_path: str
    media_type: str = "audio/wav"
    sample_rate_hz: int = 16000
    channels: int = 1
    sample_format: str = "pcm_s16le"

    def validate_shape(self) -> None:
        path = PurePosixPath(self.relative_path)
        if (
            not self.task_id
            or "/" in self.task_id
            or "\\" in self.task_id
            or self.task_id in {".", ".."}
            or "\\" in self.relative_path
            or path.is_absolute()
            or ".." in path.parts
            or path.suffix.lower() != ".wav"
        ):
            raise AsrProviderError("V3_ASR_AUDIO_REF_INVALID", "Task audio reference is not a controlled relative WAV path.")
        if self.media_type != "audio/wav" or self.sample_rate_hz != 16000 or self.channels != 1 or self.sample_format != "pcm_s16le":
            raise AsrProviderError("V3_ASR_AUDIO_FORMAT_UNSUPPORTED", "Task audio must be mono PCM S16LE at 16 kHz.")


@dataclass(frozen=True)
class RawAsrTranscript:
    provider_id: str
    model_id: str
    task_id: str
    format: str
    text: str
    elapsed_seconds: float
    vad_segment_count: int = 0
    peak_rss_bytes: int = 0


@dataclass(frozen=True)
class AsrSegment:
    segment_id: str
    start_ms: int
    end_ms: int
    text: str


@dataclass(frozen=True)
class AsrTranscriptCandidate:
    provider_id: str
    model_id: str
    task_id: str
    duration_ms: int
    segments: tuple[AsrSegment, ...]


class AsrProviderAdapter(Protocol):
    provider_id: str
    model_id: str

    def load(self) -> None: ...

    def self_test(self, audio: TaskAudioRef, *, cancel_event: Event | None = None) -> RawAsrTranscript: ...

    def transcribe(self, audio: TaskAudioRef, *, timeout: float, cancel_event: Event | None = None) -> RawAsrTranscript: ...

    def close(self) -> None: ...


ProviderFactory = Callable[[], AsrProviderAdapter]


class AsrProviderRegistry:
    """Closed provider registry. It never imports classes from client input."""

    def __init__(self, factories: dict[str, ProviderFactory] | None = None):
        self._factories: dict[str, ProviderFactory] = {}
        for provider_id, factory in (factories or {}).items():
            self.register(provider_id, factory)

    def register(self, provider_id: str, factory: ProviderFactory) -> None:
        if not provider_id or provider_id in self._factories:
            raise AsrProviderError("V3_ASR_PROVIDER_DUPLICATE", "ASR provider registration is invalid or duplicated.")
        if not callable(factory):
            raise AsrProviderError("V3_ASR_PROVIDER_FACTORY_INVALID", "ASR provider factory must be callable.")
        self._factories[provider_id] = factory

    def create(self, provider_id: str) -> AsrProviderAdapter:
        factory = self._factories.get(provider_id)
        if factory is None:
            raise AsrProviderError("V3_ASR_PROVIDER_UNKNOWN", "ASR provider is not in the closed registry.")
        provider = factory()
        if provider.provider_id != provider_id:
            raise AsrProviderError("V3_ASR_PROVIDER_ID_MISMATCH", "ASR provider factory returned a different provider identity.")
        return provider

    def provider_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._factories))
