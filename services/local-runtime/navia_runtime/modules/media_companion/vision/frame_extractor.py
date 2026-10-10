from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import cv2

from ..acquisition.task_artifacts import ArtifactRef, TaskArtifactError, TaskArtifactSandbox


class FrameExtractionError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class VisionMediaBinding:
    task_id: str
    source_identity: str
    artifact: ArtifactRef
    media_sha256: str
    declared_duration_ms: int


@dataclass(frozen=True)
class MediaProbe:
    duration_ms: int
    width_px: int
    height_px: int


@dataclass(frozen=True)
class ExtractedFrame:
    task_id: str
    timestamp_ms: int
    artifact: ArtifactRef
    width_px: int
    height_px: int

    def public_dict(self) -> dict[str, Any]:
        return {
            "taskId": self.task_id,
            "timestampMs": self.timestamp_ms,
            "artifact": self.artifact.public_dict(),
            "relativeArtifactRef": f"frames/{self.artifact.artifact_id}.png",
            "widthPx": self.width_px,
            "heightPx": self.height_px,
        }


class FrameExtractor:
    def __init__(
        self,
        sandbox: TaskArtifactSandbox,
        *,
        ffmpeg_binary: str = "ffmpeg",
        ffprobe_binary: str = "ffprobe",
        timeout_seconds: float = 30.0,
        runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
    ) -> None:
        self.sandbox = sandbox
        self.ffmpeg_binary = ffmpeg_binary
        self.ffprobe_binary = ffprobe_binary
        self.timeout_seconds = timeout_seconds
        self.runner = runner

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def bind(self, binding: VisionMediaBinding) -> tuple[Path, MediaProbe]:
        if (
            binding.artifact.task_id != binding.task_id
            or binding.artifact.kind != "video"
            or not binding.source_identity.startswith("portal:")
            or len(binding.media_sha256) != 64
            or binding.declared_duration_ms <= 0
        ):
            raise FrameExtractionError("MEDIA_BINDING_INVALID", "Vision media binding is outside the frozen contract.")
        try:
            media_path = self.sandbox.private_path(binding.task_id, binding.artifact)
        except (TaskArtifactError, OSError) as exc:
            raise FrameExtractionError("MEDIA_BINDING_INVALID", "Vision media artifact is not owned by this task.") from exc
        if self._sha256(media_path) != binding.media_sha256:
            raise FrameExtractionError("MEDIA_BINDING_INVALID", "Vision media bytes changed after acquisition.")
        probe = self._probe(media_path)
        tolerance_ms = max(1000, round(probe.duration_ms * 0.01))
        if abs(probe.duration_ms - binding.declared_duration_ms) > tolerance_ms:
            raise FrameExtractionError("MEDIA_BINDING_INVALID", "Declared media duration does not match the artifact.")
        return media_path, probe

    def _probe(self, media_path: Path) -> MediaProbe:
        if shutil.which(self.ffprobe_binary) is None:
            raise FrameExtractionError("FRAME_EXTRACTOR_UNAVAILABLE", "FFprobe is unavailable.")
        command = [
            self.ffprobe_binary,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height:format=duration",
            "-of",
            "json",
            str(media_path),
        ]
        try:
            completed = self.runner(command, capture_output=True, text=True, timeout=self.timeout_seconds, check=False)
            if completed.returncode != 0:
                raise ValueError("ffprobe_exit")
            payload = json.loads(completed.stdout)
            stream = payload["streams"][0]
            duration_ms = round(float(payload["format"]["duration"]) * 1000)
            width, height = int(stream["width"]), int(stream["height"])
            if duration_ms <= 0 or width <= 0 or height <= 0:
                raise ValueError("media_shape")
            return MediaProbe(duration_ms=duration_ms, width_px=width, height_px=height)
        except FileNotFoundError as exc:
            raise FrameExtractionError("FRAME_EXTRACTOR_UNAVAILABLE", "FFprobe is unavailable.") from exc
        except subprocess.TimeoutExpired as exc:
            raise FrameExtractionError("FRAME_EXTRACTION_FAILED", "FFprobe timed out.") from exc
        except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise FrameExtractionError("MEDIA_BINDING_INVALID", "Media has no valid video stream.") from exc

    def extract(self, binding: VisionMediaBinding, timestamp_ms: int) -> ExtractedFrame:
        media_path, probe = self.bind(binding)
        if type(timestamp_ms) is not int or timestamp_ms < 0 or timestamp_ms >= probe.duration_ms:
            raise FrameExtractionError("FRAME_TIME_OUT_OF_RANGE", "Frame timestamp is outside the current media part.")
        if shutil.which(self.ffmpeg_binary) is None:
            raise FrameExtractionError("FRAME_EXTRACTOR_UNAVAILABLE", "FFmpeg is unavailable.")
        staging = self.sandbox.create_private_temp(binding.task_id, suffix=".png")
        command = [
            self.ffmpeg_binary,
            "-v",
            "error",
            "-nostdin",
            "-ss",
            f"{timestamp_ms / 1000:.3f}",
            "-i",
            str(media_path),
            "-frames:v",
            "1",
            "-vf",
            "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease",
            "-f",
            "image2",
            "-y",
            str(staging),
        ]
        try:
            completed = self.runner(command, capture_output=True, text=True, timeout=self.timeout_seconds, check=False)
            if completed.returncode != 0 or staging.stat().st_size <= 0:
                raise FrameExtractionError("FRAME_EXTRACTION_FAILED", "FFmpeg did not produce a frame.")
            image = cv2.imread(str(staging), cv2.IMREAD_UNCHANGED)
            if image is None or image.ndim < 2:
                raise FrameExtractionError("FRAME_EXTRACTION_FAILED", "Extracted frame is not a valid image.")
            height, width = image.shape[:2]
            if max(width, height) > 1280:
                raise FrameExtractionError("FRAME_EXTRACTION_FAILED", "Extracted frame exceeds the frozen dimension limit.")
            artifact = self.sandbox.publish_private_temp(binding.task_id, "frame", staging)
            return ExtractedFrame(binding.task_id, timestamp_ms, artifact, width, height)
        except FileNotFoundError as exc:
            raise FrameExtractionError("FRAME_EXTRACTOR_UNAVAILABLE", "FFmpeg is unavailable.") from exc
        except subprocess.TimeoutExpired as exc:
            raise FrameExtractionError("FRAME_EXTRACTION_FAILED", "FFmpeg timed out.") from exc
        finally:
            if staging.exists():
                try:
                    self.sandbox.remove_private_temp(binding.task_id, staging)
                except (OSError, TaskArtifactError):
                    pass
