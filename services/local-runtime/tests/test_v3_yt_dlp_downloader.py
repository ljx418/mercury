from __future__ import annotations

import hashlib
import stat
import subprocess
import wave
from pathlib import Path

import pytest

from navia_runtime.modules.media_companion.acquisition.contracts import MediaIdentity
from navia_runtime.modules.media_companion.acquisition.coordinator import MediaAcquisitionError
from navia_runtime.modules.media_companion.acquisition.downloaders import YtDlpMediaDownloader
from navia_runtime.modules.media_companion.acquisition.task_artifacts import TaskArtifactSandbox


TASK_ID = "media_task_33333333333333333333333333333333"
IDENTITY = MediaIdentity("bilibili", "BV1ZpYd66ELP", "41828944992", "1", 1, 1, 792)
CREDENTIALS = [{
    "name": "SESSDATA", "value": "secret-value", "domain": ".bilibili.com", "secure": True,
    "expirationDate": 2000000000,
}]


def binary(path: Path, data: bytes) -> tuple[Path, str]:
    path.write_bytes(data)
    path.chmod(0o700)
    return path, hashlib.sha256(data).hexdigest()


def downloader(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    sandbox.create(TASK_ID)
    yt, yt_hash = binary(tmp_path / "yt-dlp", b"frozen-yt-dlp")
    ff, ff_hash = binary(tmp_path / "ffmpeg", b"frozen-ffmpeg")
    return sandbox, YtDlpMediaDownloader(sandbox, yt_dlp=yt, yt_dlp_sha256=yt_hash, ffmpeg=ff, ffmpeg_sha256=ff_hash)


def test_downloader_uses_closed_argv_real_task_files_and_publishes_hash(tmp_path: Path):
    sandbox, subject = downloader(tmp_path)
    commands = []

    def fake_run(command):
        commands.append(command)
        if "--output" in command:
            template = command[command.index("--output") + 1]
            Path(template.replace("%(ext)s", "webm")).write_bytes(b"real-downloaded-media")
        else:
            with wave.open(str(command[-1]), "wb") as writer:
                writer.setnchannels(1)
                writer.setsampwidth(2)
                writer.setframerate(16000)
                writer.writeframes(b"\x00\x00" * 16000)

    subject._run = fake_run
    result = subject.acquire_audio(TASK_ID, IDENTITY, CREDENTIALS)
    assert result.sample_rate_hz == 16000 and result.channels == 1
    assert result.identity.duration_seconds == 1
    published = sandbox.private_path(TASK_ID, result.artifact)
    assert result.artifact.sha256 == hashlib.sha256(published.read_bytes()).hexdigest()
    with wave.open(str(published), "rb") as reader:
        assert (reader.getframerate(), reader.getnchannels(), reader.getsampwidth(), reader.getnframes()) == (16000, 1, 2, 16000)
    assert stat.S_IMODE(published.stat().st_mode) == 0o600
    yt_command, ffmpeg_command = commands
    assert "--ignore-config" in yt_command and "--no-plugin-dirs" in yt_command and "--no-update" in yt_command
    assert "--no-playlist" in yt_command and "--exec" not in yt_command
    assert yt_command[yt_command.index("--max-filesize") + 1] == str(sandbox.maximum_audio_bytes)
    assert yt_command[-1] == "https://www.bilibili.com/video/BV1ZpYd66ELP?p=1"
    assert "file,pipe,crypto,data" in ffmpeg_command
    assert ffmpeg_command[ffmpeg_command.index("-fs") + 1] == str(sandbox.maximum_audio_bytes)
    assert "secret-value" not in " ".join(yt_command + ffmpeg_command)
    task_dir = published.parent
    assert not any(path.name.startswith(".stage_") for path in task_dir.iterdir())


def test_tool_hash_mismatch_and_cookie_injection_fail_before_subprocess(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    sandbox.create(TASK_ID)
    yt, _ = binary(tmp_path / "yt-dlp", b"yt")
    ff, ff_hash = binary(tmp_path / "ffmpeg", b"ff")
    with pytest.raises(MediaAcquisitionError) as raised:
        YtDlpMediaDownloader(sandbox, yt_dlp=yt, yt_dlp_sha256="0" * 64, ffmpeg=ff, ffmpeg_sha256=ff_hash)
    assert raised.value.code == "V3_MEDIA_RUNTIME_OFFLINE"

    subject = YtDlpMediaDownloader(
        sandbox, yt_dlp=yt, yt_dlp_sha256=hashlib.sha256(b"yt").hexdigest(),
        ffmpeg=ff, ffmpeg_sha256=ff_hash,
    )
    subject._run = lambda command: pytest.fail("subprocess must not start")
    bad = [CREDENTIALS[0] | {"value": "secret;--exec"}]
    with pytest.raises(MediaAcquisitionError) as raised:
        subject.acquire_audio(TASK_ID, IDENTITY, bad)
    assert raised.value.code == "V3_MEDIA_LEASE_REQUIRED"
    assert not any(path.name.startswith(".stage_") for path in (tmp_path / "tasks").rglob("*"))


def test_publish_private_temp_rejects_external_and_empty_files(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    sandbox.create(TASK_ID)
    empty = sandbox.create_private_temp(TASK_ID, suffix=".wav")
    with pytest.raises(Exception):
        sandbox.publish_private_temp(TASK_ID, "audio", empty)
    external = tmp_path / ".stage_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.wav"
    external.write_bytes(b"x")
    with pytest.raises(Exception):
        sandbox.publish_private_temp(TASK_ID, "audio", external)


def test_failed_download_removes_partial_staging_file(tmp_path: Path):
    sandbox, subject = downloader(tmp_path)

    def fail_after_partial(command):
        template = command[command.index("--output") + 1]
        Path(template.replace("%(ext)s", "part")).write_bytes(b"partial-secret-media")
        raise subprocess.CalledProcessError(1, command)

    subject._run = fail_after_partial
    with pytest.raises(MediaAcquisitionError) as raised:
        subject.acquire_audio(TASK_ID, IDENTITY, CREDENTIALS)
    assert raised.value.code == "V3_MEDIA_PLATFORM_REJECTED"
    assert not any(path.name.startswith(".stage_") for path in (tmp_path / "tasks").rglob("*"))
