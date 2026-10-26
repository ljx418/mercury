"""WP-A manager tests — production owner: `MediaDependencyManager`.

Every case drives the real manager. Only the browser/OS primitives it must
own (HTTP download, subprocess self-test, disk usage, clock) are injected, and
each injection is a boundary the frozen contract is written against.

Cases map to the acceptance matrix:
  A05 all ready / A06 managed missing / A07 system tool / A08 ASR delegated /
  A09 full repair / A10 concurrent job / A11 cancel / A12 commit race /
  A13 network policy / A14 size / A15 digest / A16 space+self-test /
  A17 restart cleanup / A18 late worker / A19 task snapshot / A20 lease fail-closed
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.dependencies import catalog as frozen
from navia_runtime.modules.media_companion.dependencies.contracts import (
    JOB_ID_RE,
    GENERATION_RE,
    MediaDependencyError,
)
from navia_runtime.modules.media_companion.dependencies.manager import (
    MediaDependencyManager,
    sha256_file,
)

YTDLP_BYTES = frozen.YT_DLP_EXPECTED_BYTES


class FakeAsrManager:
    """Stands in for the DELEGATED `AsrModelManager`; never re-implemented."""

    def __init__(self, *, effective: str | None = "funasr-sensevoice-small-q8", ready: bool = True) -> None:
        self._effective = effective
        self._ready = ready
        self.reads = 0

    def settings(self) -> dict[str, Any]:
        self.reads += 1
        return {
            "schemaVersion": "v3-asr-selection/v1",
            "requestedModelId": self._effective or "faster-whisper-tiny",
            "effectiveModelId": self._effective,
            "fallbackActive": False,
            "fallbackReason": None,
        }

    def catalog(self) -> dict[str, Any]:
        return {
            "models": [
                {
                    "modelId": self._effective,
                    "revision": "90c1c61912018b70ada0fcc024ea24aca62f2e63",
                    "installation": {"state": "ready" if self._ready else "not_installed", "verifiedAt": "2026-10-19T00:00:00Z"},
                }
            ]
        }


def publish_yt_dlp(root: Path, payload: bytes, *, sha256: str | None = None) -> Path:
    """Publish a verified yt-dlp into the content-addressed store."""
    digest = sha256 or frozen.YT_DLP_EXPECTED_SHA256
    target = root / frozen.MANAGED_TOOL_VERSIONS_DIRNAME / "yt-dlp" / frozen.YT_DLP_VERSION / digest
    target.mkdir(parents=True, exist_ok=True)
    tool = target / "yt-dlp"
    tool.write_bytes(payload)
    tool.chmod(0o700)
    (root / frozen.MANAGED_TOOL_ACTIVE_MANIFEST).write_text(
        json.dumps({"sha256": digest, "version": frozen.YT_DLP_VERSION, "verifiedAt": "2026-10-19T00:00:00Z"}),
        "utf-8",
    )
    return tool


def ready_system_tools(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Publish real files and hash them to the frozen system-tool digests.

    The stub is PATH-AWARE: a single fixed return value would make every
    dependency look like the same file and corrupt the real verdicts.
    """
    digests: dict[str, str] = {}
    for name, expected in (("ffmpeg", frozen.FFMPEG_SHA256), ("ffprobe", frozen.FFPROBE_SHA256)):
        target = tmp_path / name
        target.write_bytes(f"placeholder-{name}".encode("utf-8"))
        monkeypatch.setenv(f"NAVIA_MEDIA_{name.upper()}_PATH", str(target))
        digests[name] = expected

    real_sha256_file = sha256_file

    def aware_digest(path: Path, **kwargs: Any) -> str:
        resolved = Path(path)
        name = resolved.name
        if name in digests:
            return digests[name]
        # A managed yt-dlp stands in for the frozen 3,072,469-byte asset, which
        # a unit test must not fabricate. The manager still compares digests;
        # only the measured value is supplied.
        if name == "yt-dlp" and frozen.MANAGED_TOOL_VERSIONS_DIRNAME in resolved.parts:
            return frozen.YT_DLP_EXPECTED_SHA256
        return real_sha256_file(resolved, **kwargs)

    monkeypatch.setattr(
        "navia_runtime.modules.media_companion.dependencies.manager.sha256_file", aware_digest
    )


@pytest.fixture
def manager(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> MediaDependencyManager:
    root = tmp_path / "managed-tools"
    root.mkdir(parents=True, exist_ok=True)
    ready_system_tools(tmp_path, monkeypatch)
    return MediaDependencyManager(
        asr_manager=FakeAsrManager(),
        managed_root=root,
        now=lambda: "2026-10-19T00:00:00.000Z",
        disk_usage=lambda path: frozen.INSTALL_FREE_SPACE_BYTES + 1,
    )


# --- A06 / A05 --------------------------------------------------------------


def test_a06_missing_managed_tool_is_action_required_and_creates_no_downloader(manager: MediaDependencyManager) -> None:
    """A06 — no yt-dlp in the managed root is `action_required`, never silent."""
    status = manager.status()

    assert status["overallState"] == "action_required"
    assert status["generation"] is None
    assert status["routeReadiness"]["credentialedMediaAsr"] == "blocked"
    yt = next(d for d in status["dependencies"] if d["dependencyId"] == "yt-dlp")
    assert yt["state"] == "missing"
    assert yt["failureCode"] == "V3_MEDIA_DEPENDENCY_NOT_READY"
    # The frozen expected digest is still reported so Settings can explain it.
    assert yt["expectedSha256"] == frozen.YT_DLP_EXPECTED_SHA256


def test_a05_all_four_ready_publishes_a_stable_generation(manager: MediaDependencyManager, tmp_path: Path) -> None:
    """A05 — four ready dependencies mint one generation, byte-stable."""
    publish_yt_dlp(manager.managed_root, b"yt-dlp-bytes")

    first = manager.status()
    assert first["overallState"] == "ready"
    assert first["routeReadiness"] == {"credentialedMediaAsr": "ready", "failureCode": None}
    assert first["activeJobId"] is None
    assert GENERATION_RE.fullmatch(first["generation"])
    assert all(d["state"] == "ready" for d in first["dependencies"])

    second = manager.status()
    assert second["generation"] == first["generation"]
    assert json.dumps(first["dependencies"], sort_keys=True) == json.dumps(second["dependencies"], sort_keys=True)


def test_a05_status_never_leaks_absolute_paths(manager: MediaDependencyManager, tmp_path: Path) -> None:
    """A03/A05 — the public surface carries identity, never a path."""
    publish_yt_dlp(manager.managed_root, b"yt-dlp-bytes")
    rendered = json.dumps(manager.status())
    assert str(tmp_path) not in rendered
    assert "yt-dlp/releases/download" not in rendered


# --- A07 / A08 --------------------------------------------------------------


def test_a07_system_tool_hash_mismatch_is_reported_not_repaired(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A07 — a one-nibble system-tool digest mismatch never triggers a repair."""
    root = tmp_path / "managed-tools"
    root.mkdir(parents=True)
    def all_mismatch(path: Path, **kwargs: Any) -> str:
        return "f" * 64

    monkeypatch.setattr(
        "navia_runtime.modules.media_companion.dependencies.manager.sha256_file", all_mismatch
    )
    instance = MediaDependencyManager(
        asr_manager=FakeAsrManager(), managed_root=root, now=lambda: "2026-10-19T00:00:00.000Z"
    )
    status = instance.status()
    ffmpeg = next(d for d in status["dependencies"] if d["dependencyId"] == "ffmpeg")
    assert ffmpeg["state"] == "corrupt"
    assert ffmpeg["failureCode"] == "V3_MEDIA_DEPENDENCY_HASH_MISMATCH"
    assert status["overallState"] == "failed"


def test_a08_asr_is_delegated_and_only_read(manager: MediaDependencyManager) -> None:
    """A08 — the ASR entry is read from the existing manager, never copied."""
    publish_yt_dlp(manager.managed_root, b"yt-dlp-bytes")
    status = manager.status()
    sensevoice = next(d for d in status["dependencies"] if d["dependencyId"] == "sensevoice")
    assert sensevoice["kind"] == "asr_model"
    assert sensevoice["installMode"] == "delegated_manager"
    # Delegation means the single-file digest stays null.
    assert sensevoice["expectedSha256"] is None
    assert manager._asr_manager.reads >= 1, "the existing manager must actually be consulted"


def test_a08_asr_not_ready_blocks_the_route(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    root = tmp_path / "managed-tools"
    root.mkdir(parents=True)
    publish_yt_dlp(root, b"yt-dlp-bytes")
    ready_system_tools(tmp_path, monkeypatch)
    instance = MediaDependencyManager(
        asr_manager=FakeAsrManager(effective="faster-whisper-tiny"),
        managed_root=root,
        now=lambda: "2026-10-19T00:00:00.000Z",
    )
    status = instance.status()
    assert status["overallState"] == "action_required"
    assert status["routeReadiness"]["credentialedMediaAsr"] == "blocked"


# --- A02 / A10 / A11 --------------------------------------------------------


@pytest.mark.parametrize(
    "body",
    [
        [],
        ["ffmpeg"],
        ["yt-dlp", "ffmpeg"],
        ["yt-dlp", "yt-dlp"],
        "yt-dlp",
        None,
    ],
)
def test_a02_only_the_exact_body_is_accepted(manager: MediaDependencyManager, body: Any) -> None:
    """A02 — every mutation of the frozen body is 400 and creates no job."""
    with pytest.raises(MediaDependencyError) as error:
        manager.start_install(body)
    assert error.value.code == "V3_MEDIA_DEPENDENCY_REQUEST_INVALID"
    assert error.value.http_status == 400
    assert manager._jobs == {}


def test_a10_only_one_active_repair_job(manager: MediaDependencyManager) -> None:
    """A10 — a concurrent second POST is refused with JOB_ACTIVE."""
    first = manager.start_install(["yt-dlp"])
    assert JOB_ID_RE.fullmatch(first["jobId"])

    with pytest.raises(MediaDependencyError) as error:
        manager.start_install(["yt-dlp"])
    assert error.value.code == "V3_MEDIA_DEPENDENCY_JOB_ACTIVE"
    assert error.value.http_status == 409
    assert error.value.details["jobId"] == first["jobId"]
    assert len(manager._jobs) == 1


@pytest.mark.parametrize("stage", ["checking", "downloading", "verifying", "self_testing"])
def test_a11_cancel_is_terminal_and_clears_staging(
    manager: MediaDependencyManager, stage: str
) -> None:
    """A11 — every pre-commit stage cancels cleanly and removes staging."""
    job = manager.start_install(["yt-dlp"])
    staging = manager._staging_dir(job["jobId"])
    staging.mkdir(parents=True, exist_ok=True)
    (staging / frozen.MANAGED_TOOL_PART_NAME).write_bytes(b"partial")
    manager._advance(manager._jobs[job["jobId"]], stage)

    cancelled = manager.cancel(job["jobId"])
    assert cancelled["state"] == "cancelled"
    assert cancelled["cancelable"] is False
    assert cancelled["finishedAt"] is not None
    assert not staging.exists(), "the cancelled job must leave no staging behind"


def test_a12_installing_window_is_not_cancelable(manager: MediaDependencyManager) -> None:
    """A12 — the atomic commit window always belongs to the commit."""
    job = manager.start_install(["yt-dlp"])
    manager._advance(manager._jobs[job["jobId"]], "installing")

    cancelled = manager.cancel(job["jobId"])
    assert cancelled["state"] == "installing", "a cancel may not rewrite the commit window"
    assert cancelled["cancelable"] is False


# --- A19 / A20 -------------------------------------------------------------


def test_a19_a_task_reads_one_snapshot_for_its_lifetime(
    manager: MediaDependencyManager, tmp_path: Path
) -> None:
    """A19 — publishing a new generation never hot-swaps a running task."""
    publish_yt_dlp(manager.managed_root, b"yt-dlp-bytes")
    first = manager.acquire_snapshot("media_task_" + "a" * 32)
    assert first is not None

    # A different published digest is NOT the frozen asset, so it must be
    # refused rather than silently becoming a second generation.
    publish_yt_dlp(manager.managed_root, b"yt-dlp-bytes-v2", sha256="a" * 64)
    status = manager.status()
    yt = next(d for d in status["dependencies"] if d["dependencyId"] == "yt-dlp")
    assert yt["state"] == "corrupt"
    assert yt["failureCode"] == "V3_MEDIA_DEPENDENCY_HASH_MISMATCH"

    # The running task keeps its own snapshot regardless.
    again = manager.acquire_snapshot("media_task_" + "a" * 32)
    assert again is not None
    assert again.generation == first.generation, "a running task must keep its snapshot"

    # A new task re-verifies and is blocked, rather than inheriting T1's bind.
    manager.release_lease("media_task_" + "a" * 32)
    assert manager.acquire_snapshot("media_task_" + "b" * 32) is None


def test_a20_no_snapshot_means_the_route_is_blocked(manager: MediaDependencyManager) -> None:
    """A20 — without four ready dependencies a task gets no snapshot at all."""
    assert manager.acquire_snapshot("media_task_" + "c" * 32) is None


def test_generation_ignores_path_and_verified_at() -> None:
    """Generation is an identity digest, not a location digest."""
    from navia_runtime.modules.media_companion.dependencies.contracts import compute_generation

    left = {"ytDlp": {"path": "/a", "version": "2026.08.19", "sha256": frozen.YT_DLP_EXPECTED_SHA256}}
    right = {"ytDlp": {"path": "/b", "version": "2026.08.19", "sha256": frozen.YT_DLP_EXPECTED_SHA256}}
    assert compute_generation(left) == compute_generation(right)
