from __future__ import annotations

import hashlib
import os
import stat
import wave
from dataclasses import dataclass
from pathlib import Path

from ..asr.provider import TaskAudioRef
from .contracts import AcquisitionAudioRef
from .task_artifacts import TaskArtifactError, TaskArtifactSandbox


class AudioStagingError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class AudioStagingReceipt:
    task_id: str
    source_sha256: str
    staged_sha256: str
    byte_length: int
    duration_ms: int
    sample_rate_hz: int
    channels: int
    sample_width_bytes: int
    relative_path: str = "audio/current-part.wav"


class TaskAudioStager:
    """Copy a published acquisition artifact into an isolated ASR task root."""

    def __init__(self, sandbox: TaskArtifactSandbox, tasks_root: Path) -> None:
        self.sandbox = sandbox
        self.tasks_root = tasks_root.resolve()
        self.tasks_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self._chmod(self.tasks_root, 0o700)

    def stage(self, reference: AcquisitionAudioRef) -> tuple[TaskAudioRef, AudioStagingReceipt]:
        try:
            reference.validate()
            source = self.sandbox.private_path(reference.task_id, reference.artifact)
        except (ValueError, TaskArtifactError) as exc:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "Acquisition audio reference is invalid.") from exc
        source_before = source.stat()
        if not stat.S_ISREG(source_before.st_mode) or source_before.st_nlink != 1:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "Acquisition audio must be a single-link regular file.")
        source_sha = self._sha256(source)
        if source_sha != reference.artifact.sha256 or source_before.st_size != reference.artifact.byte_length:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "Acquisition audio changed after publication.")
        shape = self._wave_shape(source)
        expected = (reference.sample_rate_hz, reference.channels, reference.sample_width_bytes)
        if shape[:3] != expected or shape[3] != reference.duration_ms:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "Acquisition audio shape does not match its binding.")

        task_root = self.tasks_root / reference.task_id
        if task_root.exists() or task_root.is_symlink():
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "ASR task staging root already exists.")
        audio_root = task_root / "audio"
        destination = audio_root / "current-part.wav"
        try:
            task_root.mkdir(mode=0o700)
            audio_root.mkdir(mode=0o700)
            descriptor = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            digest = hashlib.sha256()
            copied = 0
            with source.open("rb") as source_handle, os.fdopen(descriptor, "wb") as target_handle:
                for chunk in iter(lambda: source_handle.read(1024 * 1024), b""):
                    target_handle.write(chunk)
                    digest.update(chunk)
                    copied += len(chunk)
                target_handle.flush()
                os.fsync(target_handle.fileno())
            self._chmod(destination, 0o600)
            source_after = source.stat()
            target = destination.stat()
            staged_sha = digest.hexdigest()
            if (
                (source_before.st_size, source_before.st_mtime_ns, source_before.st_ino)
                != (source_after.st_size, source_after.st_mtime_ns, source_after.st_ino)
                or copied != reference.artifact.byte_length
                or target.st_nlink != 1
                or target.st_mode & 0o077
                or staged_sha != source_sha
                or self._wave_shape(destination) != shape
            ):
                raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "Staged audio failed the byte and shape binding.")
        except Exception:
            self.cleanup(reference.task_id)
            raise
        audio = TaskAudioRef(task_id=reference.task_id, relative_path="audio/current-part.wav")
        return audio, AudioStagingReceipt(
            task_id=reference.task_id,
            source_sha256=source_sha,
            staged_sha256=staged_sha,
            byte_length=copied,
            duration_ms=shape[3],
            sample_rate_hz=shape[0],
            channels=shape[1],
            sample_width_bytes=shape[2],
        )

    def cleanup(self, task_id: str) -> dict[str, int | bool]:
        if not task_id or "/" in task_id or "\\" in task_id or task_id in {".", ".."}:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "ASR task ID is invalid.")
        task_root = self.tasks_root / task_id
        if task_root.is_symlink():
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "ASR task root cannot be a link.")
        if not task_root.exists():
            return {"removed": False, "residualCount": 0}
        for path in sorted(task_root.rglob("*"), reverse=True):
            metadata = path.lstat()
            if stat.S_ISREG(metadata.st_mode) and metadata.st_nlink == 1:
                path.unlink()
            elif stat.S_ISDIR(metadata.st_mode):
                path.rmdir()
            else:
                raise AudioStagingError("V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE", "Unsafe ASR staging entry blocked cleanup.")
        task_root.rmdir()
        residual = int(task_root.exists())
        return {"removed": True, "residualCount": residual}

    @staticmethod
    def _chmod(path: Path, mode: int) -> None:
        try:
            path.chmod(mode)
        except OSError:
            pass

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for block in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest()

    @staticmethod
    def _wave_shape(path: Path) -> tuple[int, int, int, int]:
        try:
            with wave.open(str(path), "rb") as reader:
                rate = reader.getframerate()
                channels = reader.getnchannels()
                width = reader.getsampwidth()
                if reader.getcomptype() != "NONE" or rate <= 0:
                    raise wave.Error("unsupported")
                duration_ms = round(reader.getnframes() * 1000 / rate)
        except (OSError, EOFError, wave.Error) as exc:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "Acquisition audio is not controlled PCM WAV.") from exc
        return rate, channels, width, duration_ms
