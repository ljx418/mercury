from __future__ import annotations

import hashlib
import os
import re
import subprocess
import wave
from dataclasses import replace
from collections.abc import Sequence
from pathlib import Path

from ...bilibili_policy import BILIBILI_CREDENTIAL_ENVELOPE_POLICY
from ..contracts import AcquiredMedia, MediaIdentity
from ..coordinator import MediaAcquisitionError
from ..task_artifacts import ArtifactRef, TaskArtifactError, TaskArtifactSandbox


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class YtDlpMediaDownloader:
    def __init__(
        self,
        sandbox: TaskArtifactSandbox,
        *,
        yt_dlp: Path,
        yt_dlp_sha256: str,
        ffmpeg: Path,
        ffmpeg_sha256: str,
        timeout_seconds: int = 1800,
    ) -> None:
        self._sandbox = sandbox
        self._yt_dlp = Path(yt_dlp).resolve()
        self._ffmpeg = Path(ffmpeg).resolve()
        self._timeout_seconds = timeout_seconds
        if _sha256_file(self._yt_dlp) != yt_dlp_sha256 or _sha256_file(self._ffmpeg) != ffmpeg_sha256:
            raise MediaAcquisitionError("V3_MEDIA_RUNTIME_OFFLINE", "Frozen media tool hash mismatch.", status=503)

    def acquire_audio(self, task_id: str, identity: MediaIdentity, credentials: Sequence[dict[str, object]]) -> AcquiredMedia:
        cookie_path = self._sandbox.create_private_temp(task_id, suffix=".txt")
        raw_marker = self._sandbox.create_private_temp(task_id)
        wav_path = self._sandbox.create_private_temp(task_id, suffix=".wav")
        raw_marker.unlink()
        wav_path.unlink()
        raw_files: list[Path] = []
        try:
            cookie_path.write_text(self._netscape_cookiefile(credentials), encoding="utf-8")
            cookie_path.chmod(0o600)
            output_template = f"{raw_marker}.%(ext)s"
            url = f"https://www.bilibili.com/video/{identity.media_id}?p={identity.part_index}"
            command = [
                str(self._yt_dlp), "--ignore-config", "--no-plugin-dirs", "--no-update", "--no-playlist",
                "--no-cache-dir", "--no-write-info-json", "--no-write-comments", "--no-write-thumbnail",
                "--retries", "0", "--fragment-retries", "0", "--socket-timeout", "20",
                "--max-filesize", str(self._sandbox.maximum_audio_bytes),
                "--cookies", str(cookie_path), "--format", "bestaudio/best", "--output", output_template, url,
            ]
            self._run(command)
            raw_files = [entry for entry in raw_marker.parent.glob(f"{raw_marker.name}.*") if entry != cookie_path]
            if len(raw_files) != 1 or raw_files[0].is_symlink():
                raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Media download did not produce one audio input.", status=502)
            raw = raw_files[0]
            raw.chmod(0o600)
            self._run([
                str(self._ffmpeg), "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                "-protocol_whitelist", "file,pipe,crypto,data", "-i", str(raw), "-map", "0:a:0",
                "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
                "-fs", str(self._sandbox.maximum_audio_bytes), str(wav_path),
            ])
            with wave.open(str(wav_path), "rb") as reader:
                duration_seconds = reader.getnframes() / reader.getframerate()
            artifact = self._sandbox.publish_private_temp(task_id, "audio", wav_path)
            return AcquiredMedia(replace(identity, duration_seconds=duration_seconds), artifact, "wav-pcm-s16le", 16000, 1)
        except subprocess.TimeoutExpired as exc:
            raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Media acquisition timed out.", status=504) from exc
        except (OSError, subprocess.CalledProcessError, TaskArtifactError) as exc:
            code = exc.code if isinstance(exc, TaskArtifactError) else "V3_MEDIA_PLATFORM_REJECTED"
            raise MediaAcquisitionError(code, "Media acquisition failed.", status=502) from exc
        finally:
            # A failed yt-dlp process can leave a .part file before raw_files is
            # assigned. Re-enumerate only this sandbox-generated staging prefix.
            leftovers = list(raw_marker.parent.glob(f"{raw_marker.name}.*"))
            for path in [cookie_path, wav_path, *raw_files, *leftovers]:
                try:
                    self._sandbox.remove_private_temp(task_id, path)
                except (FileNotFoundError, TaskArtifactError):
                    pass

    def acquire_video_section(
        self,
        task_id: str,
        identity: MediaIdentity,
        credentials: Sequence[dict[str, object]],
        *,
        start_seconds: int = 0,
        end_seconds: int = 8,
    ) -> tuple[ArtifactRef, int]:
        """Download a bounded low-resolution section for task-local visual evidence."""
        if (
            type(start_seconds) is not int
            or start_seconds < 0
            or type(end_seconds) is not int
            or end_seconds <= start_seconds
            or end_seconds - start_seconds > 8
            or identity.adapter_id != "bilibili"
            or re.fullmatch(r"BV[A-Za-z0-9]+", identity.media_id) is None
            or type(identity.part_index) is not int
            or identity.part_index < 1
        ):
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Visual media section is outside the frozen budget.")
        cookie_path = self._sandbox.create_private_temp(task_id, suffix=".txt")
        output_path = self._sandbox.create_private_temp(task_id, suffix=".mp4")
        output_path.unlink()
        try:
            cookie_path.write_text(self._netscape_cookiefile(credentials), encoding="utf-8")
            cookie_path.chmod(0o600)
            url = f"https://www.bilibili.com/video/{identity.media_id}?p={identity.part_index}"
            self._run([
                str(self._yt_dlp), "--ignore-config", "--no-plugin-dirs", "--no-update", "--no-playlist",
                "--no-cache-dir", "--no-write-info-json", "--no-write-comments", "--no-write-thumbnail",
                "--retries", "1", "--fragment-retries", "1", "--socket-timeout", "20",
                "--max-filesize", str(self._sandbox.maximum_video_bytes), "--cookies", str(cookie_path),
                "--download-sections", f"*{start_seconds}-{end_seconds}", "--force-keyframes-at-cuts",
                "--format", "bv*[height<=480]+ba/b[height<=480]", "--merge-output-format", "mp4",
                "--ffmpeg-location", str(self._ffmpeg.parent), "--output", str(output_path), url,
            ])
            if not output_path.is_file() or output_path.is_symlink() or output_path.stat().st_size <= 0:
                raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Visual media download did not produce one video section.", status=502)
            output_path.chmod(0o600)
            completed = self._run([
                str(self._ffmpeg.parent / "ffprobe"), "-v", "error", "-show_entries", "format=duration",
                "-of", "default=nw=1:nk=1", str(output_path),
            ], capture_text=True)
            duration_ms = round(float(completed.stdout.strip()) * 1000)
            if duration_ms <= 0 or duration_ms > (end_seconds - start_seconds + 2) * 1000:
                raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Visual media duration exceeded the frozen section.", status=502)
            artifact = self._sandbox.publish_private_temp(task_id, "video", output_path)
            return artifact, duration_ms
        except (ValueError, subprocess.TimeoutExpired) as exc:
            raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Visual media acquisition failed.", status=502) from exc
        except (OSError, subprocess.CalledProcessError, TaskArtifactError) as exc:
            code = exc.code if isinstance(exc, TaskArtifactError) else "V3_MEDIA_PLATFORM_REJECTED"
            raise MediaAcquisitionError(code, "Visual media acquisition failed.", status=502) from exc
        finally:
            for path in (cookie_path, output_path):
                try:
                    self._sandbox.remove_private_temp(task_id, path)
                except (FileNotFoundError, TaskArtifactError):
                    pass

    def _run(self, command: list[str], *, capture_text: bool = False) -> subprocess.CompletedProcess:
        env = {"PATH": os.environ.get("PATH", ""), "HOME": "", "XDG_CONFIG_HOME": "", "PYTHONNOUSERSITE": "1"}
        return subprocess.run(
            command,
            check=True,
            shell=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=capture_text,
            timeout=self._timeout_seconds,
            env=env,
        )

    @staticmethod
    def _netscape_cookiefile(credentials: Sequence[dict[str, object]]) -> str:
        rows = ["# Netscape HTTP Cookie File"]
        seen: set[str] = set()
        for item in credentials:
            name, value, domain = item.get("name"), item.get("value"), item.get("domain")
            if (
                not isinstance(name, str) or name not in BILIBILI_CREDENTIAL_ENVELOPE_POLICY.allowed_credential_names
                or name in seen or not isinstance(value, str) or not value
                or any(ord(char) < 0x21 or ord(char) == 0x7F or char in ";\t" for char in value)
                or not isinstance(domain, str) or not BILIBILI_CREDENTIAL_ENVELOPE_POLICY.domain_allowed(domain)
            ):
                raise MediaAcquisitionError("V3_MEDIA_LEASE_REQUIRED", "Credential lease is invalid.", status=403)
            seen.add(name)
            normalized_domain = domain if domain.startswith(".") else f".{domain}"
            expiration = item.get("expirationDate")
            expires = int(expiration) if isinstance(expiration, (int, float)) and not isinstance(expiration, bool) else 0
            rows.append("\t".join([normalized_domain, "TRUE", "/", "TRUE" if item.get("secure") else "FALSE", str(expires), name, value]))
        if not BILIBILI_CREDENTIAL_ENVELOPE_POLICY.required_credential_names.issubset(seen):
            raise MediaAcquisitionError("V3_MEDIA_LEASE_REQUIRED", "Credential lease is incomplete.", status=403)
        return "\n".join(rows) + "\n"
