"""WP-B verified media preparation.

The preparer is the ONLY place that shells out for media work. It:

* takes the SAME frozen dependency snapshot as WP-A (ffmpeg/ffprobe paths and
  digests, plus the generation), so a task never switches tools mid-flight;
* verifies the container, a video stream, the duration and the dimensions with
  `ffprobe`, under a deadline and with `-nostdin`;
* renders a 16 kHz mono `pcm_s16le` WAV and 1..8 distributed frames;
* publishes both, and a canonical `ImportedVisualReceipt`, atomically.

Tool stderr never leaves this module: a failure is normalised to a fixed code
and a category message, so no path, command line or raw diagnostic can escape.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from . import contracts as C

Runner = Callable[[list[str], float], "subprocess.CompletedProcess[str]"]

FRAME_FORMAT = "png"
AUDIO_CODEC = C.AUDIO_CODEC
AUDIO_SAMPLE_RATE = str(C.AUDIO_SAMPLE_RATE_HZ)
AUDIO_CHANNELS = str(C.AUDIO_CHANNELS)
MAX_FRAMES = C.MAX_IMPORT_FRAMES
DIGEST_CHUNK_BYTES = 1024 * 1024


@dataclass(frozen=True)
class PreparedInput:
    task_id: str
    source_identity: str
    duration_ms: int
    container: str
    width: int
    height: int
    wav_path: Path
    wav_sha256: str
    frames: tuple[dict[str, Any], ...]
    visual_receipt: dict[str, Any]
    visual_receipt_path: Path


def _default_runner(command: list[str], timeout: float) -> "subprocess.CompletedProcess[str]":
    return subprocess.run(  # noqa: S603 - argv is frozen and allowlisted below
        command,
        capture_output=True,
        text=True,
        timeout=timeout,
        stdin=subprocess.DEVNULL,
        check=False,
        start_new_session=True,
    )


def _digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(DIGEST_CHUNK_BYTES), b""):
            digest.update(chunk)
    return digest.hexdigest()


class LocalMediaPreparer:
    """Verified preparation of one user-selected media file."""

    def __init__(
        self,
        *,
        task_id: str,
        source_identity: str,
        snapshot: dict[str, Any],
        input_root: Path,
        audio_root: Path,
        visual_root: Path,
        runner: Runner | None = None,
        max_duration_ms: int = C.MAX_DURATION_MS,
        ffprobe_deadline: float = C.FFPROBE_DEADLINE_SECONDS,
    ) -> None:
        self.task_id = task_id
        self.source_identity = source_identity
        self.snapshot = snapshot
        self.input_root = Path(input_root)
        self.audio_root = Path(audio_root)
        self.visual_root = Path(visual_root)
        self.runner = runner or _default_runner
        self.max_duration_ms = max_duration_ms
        self.ffprobe_deadline = ffprobe_deadline

    # -- tool boundary --------------------------------------------------------

    def _tool(self, name: str) -> str:
        """Resolve a verified tool or fail closed BEFORE any subprocess runs."""
        entry = self.snapshot.get(name)
        if not isinstance(entry, dict):
            raise C.ImportError("PREPARE_FAILED", "The task tool set is not verified.")
        path = entry.get("path")
        expected = entry.get("sha256")
        if not isinstance(path, str) or not Path(path).is_file():
            raise C.ImportError("PREPARE_FAILED", "The task tool set is not verified.")
        if _digest(Path(path)) != expected:
            raise C.ImportError("PREPARE_FAILED", "The task tool set is not verified.")
        return path

    def _run(self, command: list[str], timeout: float) -> "subprocess.CompletedProcess[str]":
        try:
            completed = self.runner(command, timeout)
        except subprocess.TimeoutExpired as error:
            raise C.ImportError("PREPARE_FAILED", "Media preparation did not finish in time.") from None
        except OSError:
            raise C.ImportError("PREPARE_FAILED", "Media preparation could not start.") from None
        return completed

    # -- probe ----------------------------------------------------------------

    def _probe(self, media: Path, declared_media_type: str | None = None) -> dict[str, Any]:
        ffprobe = self._tool("ffprobe")
        completed = self._run(
            [
                ffprobe, "-v", "error", "-print_format", "json",
                "-show_format", "-show_streams", str(media),
            ],
            self.ffprobe_deadline,
        )
        if completed.returncode != 0:
            # A tool that failed is a PREPARE failure, not a verdict about the
            # media: the acceptance plan names the non-zero exit explicitly.
            raise C.ImportError(
                "PREPARE_FAILED", "The media could not be probed with the verified tool."
            )
        try:
            payload = json.loads(completed.stdout or "{}")
        except (json.JSONDecodeError, TypeError):
            raise C.ImportError("MEDIA_INVALID", "The selected file is not a readable media container.") from None
        if not isinstance(payload, dict):
            raise C.ImportError("MEDIA_INVALID", "The selected file is not a readable media container.")

        streams = payload.get("streams") or []
        if not isinstance(streams, list):
            raise C.ImportError("MEDIA_INVALID", "The selected file has no readable stream list.")
        video = next(
            (s for s in streams if isinstance(s, dict) and s.get("codec_type") == "video"), None
        )
        if video is None:
            raise C.ImportError("MEDIA_INVALID", "The selected file has no video stream.")
        fmt = payload.get("format") or {}
        raw_duration = fmt.get("duration") if isinstance(fmt, dict) else None
        try:
            duration_ms = int(round(float(raw_duration) * 1000))
        except (TypeError, ValueError):
            raise C.ImportError("MEDIA_INVALID", "The selected file has no readable duration.") from None

        container = str(fmt.get("format_name") or "") if isinstance(fmt, dict) else ""
        if not _container_allowed(container):
            raise C.ImportError("MEDIA_INVALID", "The selected container is not supported.")
        if duration_ms <= 0:
            raise C.ImportError("MEDIA_INVALID", "The selected file has no readable duration.")
        if duration_ms > self.max_duration_ms:
            raise C.ImportError(
                "DURATION_LIMIT",
                "The selected media is longer than the frozen limit.",
                details={"maximumDurationMs": self.max_duration_ms},
            )
        try:
            width = int(video.get("width"))
            height = int(video.get("height"))
        except (TypeError, ValueError):
            raise C.ImportError("MEDIA_INVALID", "The selected file has no readable dimensions.") from None
        max_width, max_height = C.MAX_FRAME_DIMENSIONS
        if width <= 0 or height <= 0 or width > max_width or height > max_height:
            raise C.ImportError("MEDIA_INVALID", "The selected frame dimensions are not supported.")
        return {
            "duration_ms": duration_ms,
            "container": container,
            "public_container": _public_container(container, declared_media_type),
            "width": width,
            "height": height,
        }

    # -- render ---------------------------------------------------------------

    def _render_wav(self, media: Path) -> Path:
        ffmpeg = self._tool("ffmpeg")
        self.audio_root.mkdir(parents=True, exist_ok=True)
        os.chmod(self.audio_root, 0o700)
        target = self.audio_root / "audio.wav"
        temporary = self.audio_root / "audio.wav.part"
        completed = self._run(
            [
                ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                "-i", str(media),
                "-vn", "-ac", AUDIO_CHANNELS, "-ar", AUDIO_SAMPLE_RATE,
                "-c:a", "pcm_s16le", "-f", "wav", str(temporary),
            ],
            C.PREPARING_DEADLINE_SECONDS,
        )
        if completed.returncode != 0 or not temporary.is_file():
            raise C.ImportError("PREPARE_FAILED", "Media preparation could not produce local audio.")
        descriptor = os.open(temporary, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        os.replace(temporary, target)
        os.chmod(target, 0o600)
        return target

    def _render_frames(self, media: Path, duration_ms: int) -> tuple[dict[str, Any], ...]:
        ffmpeg = self._tool("ffmpeg")
        self.visual_root.mkdir(parents=True, exist_ok=True)
        os.chmod(self.visual_root, 0o700)
        count = max(1, min(MAX_FRAMES, _frame_count(duration_ms)))
        frames: list[dict[str, Any]] = []
        for index in range(count):
            timestamp_ms = int(duration_ms * (index + 1) / (count + 1))
            # The artifact id IS the file name, exactly as the frozen
            # `artifact` definition and the frozen receipt imply.
            artifact_id = f"artifact_{secrets.token_hex(16)}"
            target = self.visual_root / f"{artifact_id}.{FRAME_FORMAT}"
            temporary = self.visual_root / f".{artifact_id}.{FRAME_FORMAT}.part"
            completed = self._run(
                [
                    ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                        "-ss", f"{timestamp_ms / 1000:.3f}", "-i", str(media),
                    # The encoder is named EXPLICITLY: the temporary file ends in
                    # `.part`, so the image2 muxer would otherwise pick its
                    # default (mjpeg) and publish JPEG bytes under a `.png`
                    # name. Every downstream consumer reads the PNG header.
                    "-frames:v", "1", "-c:v", "png", "-f", "image2", str(temporary),
                ],
                C.PREPARING_DEADLINE_SECONDS,
            )
            if completed.returncode != 0 or not temporary.is_file() or temporary.stat().st_size == 0:
                raise C.ImportError("PREPARE_FAILED", "Media preparation could not produce local frames.")
            os.replace(temporary, target)
            os.chmod(target, 0o600)
            frames.append(
                {
                    "timestampMs": timestamp_ms,
                    "artifact": {
                        "artifactId": artifact_id,
                        "kind": "frame",
                        "byteLength": target.stat().st_size,
                        "sha256": _digest(target),
                    },
                }
            )
        return tuple(frames)

    # -- entry ----------------------------------------------------------------

    def prepare(self, media: Path, *, declared_media_type: str | None = None) -> PreparedInput:
        """Verify, render and publish. Nothing is published on any failure."""
        media = Path(media)
        probed = self._probe(media, declared_media_type)
        if declared_media_type is not None and not _declared_matches(
            declared_media_type, probed["container"]
        ):
            # ffprobe is the truth: a declared type the bytes do not support is
            # a faked MIME, never a licence to trust the client.
            raise C.ImportError(
                "MEDIA_INVALID", "The selected file does not match its declared media type."
            )

        wav_path = self._render_wav(media)
        try:
            frames = self._render_frames(media, probed["duration_ms"])
        except C.ImportError:
            wav_path.unlink(missing_ok=True)
            raise
        if not frames:
            raise C.ImportError("PREPARE_FAILED", "Media preparation produced no frame.")

        receipt = {
            "schemaVersion": C.VISUAL_RECEIPT_SCHEMA_VERSION,
            "taskId": self.task_id,
            "sourceIdentity": self.source_identity,
            "mediaSha256": _digest(media),
            "durationMs": probed["duration_ms"],
            "frames": list(frames),
        }
        receipt_path = self.visual_root / "visual-receipt.json"
        temporary = self.visual_root / "visual-receipt.json.part"
        temporary.write_bytes(C.canonical_json(receipt).encode("utf-8"))
        os.chmod(temporary, 0o600)
        descriptor = os.open(temporary, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        os.replace(temporary, receipt_path)
        os.chmod(receipt_path, 0o600)

        return PreparedInput(
            task_id=self.task_id,
            source_identity=self.source_identity,
            duration_ms=probed["duration_ms"],
            container=probed["public_container"],
            width=probed["width"],
            height=probed["height"],
            wav_path=wav_path,
            wav_sha256=_digest(wav_path),
            frames=frames,
            visual_receipt=receipt,
            visual_receipt_path=receipt_path,
        )


def _frame_count(duration_ms: int) -> int:
    """One frame per 5 seconds, clamped to the frozen 1..8 window."""
    return max(1, min(MAX_FRAMES, int(duration_ms // 5000) + 1))


#: Which containers each declared type is allowed to actually be.
_DECLARED_CONTAINERS: dict[str, frozenset[str]] = {
    "video/mp4": frozenset({"mp4", "mov"}),
    "video/webm": frozenset({"webm", "matroska"}),
    "video/x-matroska": frozenset({"matroska", "webm"}),
}


def _declared_matches(declared_media_type: str, format_name: str) -> bool:
    allowed = _DECLARED_CONTAINERS.get(declared_media_type)
    if allowed is None:
        # `application/octet-stream` declares nothing, so ffprobe alone decides.
        return True
    names = {part.strip() for part in format_name.split(",") if part.strip()}
    return bool(names & set(allowed))


def _public_container(format_name: str, declared_media_type: str | None) -> str:
    """The FROZEN public container enum.

    The raw ffprobe format string never leaves the Runtime: the public
    projection carries exactly `mp4`, `webm` or `matroska`.
    """
    names = {part.strip() for part in format_name.split(",") if part.strip()}
    if names & {"mp4", "mov", "m4a", "3gp", "3g2", "mj2"}:
        return "mp4"
    if "matroska" in names or "webm" in names:
        if declared_media_type == "video/x-matroska":
            return "matroska"
        if declared_media_type == "video/webm":
            return "webm"
        # A wildcard declaration still needs a truthful container. The Matroska
        # and WebM families share a format string, so the declared type decides
        # and a wildcard is resolved by the file extension.
        return "matroska"
    raise C.ImportError("MEDIA_INVALID", "The selected container is not supported.")


def _container_allowed(format_name: str) -> bool:
    """ffprobe reports a comma list; mp4/mov, webm and matroska are allowed."""
    names = {part.strip() for part in format_name.split(",") if part.strip()}
    return bool(names & {"mp4", "mov", "matroska", "webm"})
