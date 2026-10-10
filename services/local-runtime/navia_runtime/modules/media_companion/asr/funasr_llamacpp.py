from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from threading import Event

from .native_process import NativeAsrProcessHost, NativeProcessSpec
from .provider import AsrProviderError, RawAsrTranscript, TaskAudioRef


@dataclass(frozen=True)
class FunAsrLlamaCppModelSpec:
    model_id: str
    executable_base_name: str
    model_name: str
    extra_arguments: tuple[str, ...] = ()


FUNASR_MODEL_SPECS = {
    "funasr-paraformer-q8": FunAsrLlamaCppModelSpec(
        "funasr-paraformer-q8", "llama-funasr-paraformer", "paraformer-q8.gguf"
    ),
    "funasr-sensevoice-small-q8": FunAsrLlamaCppModelSpec(
        "funasr-sensevoice-small-q8", "llama-funasr-sensevoice", "sensevoice-small-q8.gguf", ("--backend", "cpu")
    ),
}

VAD_READY_RE = re.compile(r"(?m)^\[sensevoice\] VAD ready: (0|[1-9][0-9]*) segments\s*$")
VAD_TERMINAL_RE = re.compile(r"(?m)^\[sensevoice\] (0|[1-9][0-9]*) vad segments\s*$")


class FunAsrLlamaCppProviderAdapter:
    provider_id = "funasr_edge_local"
    vad_name = "fsmn-vad.gguf"
    vad_max_segment_ms = 15_000

    def __init__(
        self,
        install_root: Path,
        tasks_root: Path,
        *,
        model_id: str = "funasr-paraformer-q8",
        max_output_bytes: int = 4 * 1024 * 1024,
        platform_name: str | None = None,
    ):
        try:
            self._model_spec = FUNASR_MODEL_SPECS[model_id]
        except KeyError as exc:
            raise AsrProviderError("V3_ASR_MODEL_NOT_REGISTERED", "ASR model is not registered for the FunASR runtime.") from exc
        self.model_id = self._model_spec.model_id
        self.model_name = self._model_spec.model_name
        target_platform = platform_name or ("windows" if os.name == "nt" else "linux")
        if target_platform not in {"linux", "windows"}:
            raise AsrProviderError("V3_ASR_PLATFORM_UNSUPPORTED", "ASR provider platform is not supported.")
        self.executable_name = self._model_spec.executable_base_name + (".exe" if target_platform == "windows" else "")
        self._host = NativeAsrProcessHost(
            install_root,
            tasks_root,
            allowed_executables=frozenset({self.executable_name}),
            max_output_bytes=max_output_bytes,
        )
        self._loaded = False
        self._closed = False

    def load(self) -> None:
        if self._closed:
            raise AsrProviderError("V3_ASR_PROVIDER_CLOSED", "ASR provider is closed.")
        self._host.validate_install_file(self.executable_name)
        self._host.validate_install_file(self.model_name)
        self._host.validate_install_file(self.vad_name)
        self._loaded = True

    def self_test(self, audio: TaskAudioRef, *, cancel_event: Event | None = None) -> RawAsrTranscript:
        return self._transcribe(audio, timeout=120.0, cancel_event=cancel_event, require_positive_vad=False)

    def transcribe(self, audio: TaskAudioRef, *, timeout: float, cancel_event: Event | None = None) -> RawAsrTranscript:
        return self._transcribe(audio, timeout=timeout, cancel_event=cancel_event, require_positive_vad=True)

    def _transcribe(
        self,
        audio: TaskAudioRef,
        *,
        timeout: float,
        cancel_event: Event | None,
        require_positive_vad: bool,
    ) -> RawAsrTranscript:
        if self._closed:
            raise AsrProviderError("V3_ASR_PROVIDER_CLOSED", "ASR provider is closed.")
        if not self._loaded:
            raise AsrProviderError("V3_ASR_PROVIDER_NOT_LOADED", "ASR provider must be loaded before transcription.")
        audio_path = self._host.validate_audio(audio)
        model_path = self._host.validate_install_file(self.model_name)
        vad_path = self._host.validate_install_file(self.vad_name)
        spec = NativeProcessSpec(
            executable_name=self.executable_name,
            task_id=audio.task_id,
            arguments=(
                "-m", str(model_path),
                "--vad", str(vad_path),
                "--vad-maxseg", str(self.vad_max_segment_ms),
                "-a", str(audio_path),
                *self._model_spec.extra_arguments,
                "--srt",
            ),
        )
        try:
            result = self._host.run(spec, timeout=timeout, cancel_event=cancel_event)
            vad_segment_count = 0
            if self.model_id == "funasr-sensevoice-small-q8":
                ready = VAD_READY_RE.findall(result.stderr)
                terminal = VAD_TERMINAL_RE.findall(result.stderr)
                if (
                    len(ready) != 1
                    or len(terminal) != 1
                    or ready[0] != terminal[0]
                    or (require_positive_vad and int(ready[0]) <= 0)
                ):
                    raise AsrProviderError(
                        "V3_ASR_VAD_RECEIPT_INVALID",
                        "Native ASR did not emit one consistent FSMN-VAD count receipt.",
                    )
                vad_segment_count = int(ready[0])
            return RawAsrTranscript(
                provider_id=self.provider_id,
                model_id=self.model_id,
                task_id=audio.task_id,
                format="srt",
                text=result.stdout,
                elapsed_seconds=result.elapsed_seconds,
                vad_segment_count=vad_segment_count,
                peak_rss_bytes=result.peak_rss_bytes,
            )
        finally:
            self._host.cleanup_task(audio.task_id)

    def close(self) -> None:
        if self._closed:
            return
        self._host.close()
        self._loaded = False
        self._closed = True
