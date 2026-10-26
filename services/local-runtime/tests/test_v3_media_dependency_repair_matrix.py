"""WP-A repair fault matrix — A09, A11, A12, A13, A14, A15, A16, A17, A18.

Production owner: `MediaDependencyManager.run_job`. Only the network, the
subprocess self-test, the disk clock and the job clock are injected, because
those are the boundaries the frozen contract is written against. Every failure
case asserts the OLD ready version and the active manifest are untouched and
that no staging survives.
"""

from __future__ import annotations

import json
import subprocess
from email.message import Message
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.dependencies import catalog as frozen
from navia_runtime.modules.media_companion.dependencies.contracts import MediaDependencyError
from navia_runtime.modules.media_companion.dependencies.manager import (
    MediaDependencyManager,
    sha256_file,
)

from test_v3_media_dependency_manager import FakeAsrManager

# Exactly the frozen byte length: the size gate compares a NUMBER, and a
# short fixture would fail SIZE_MISMATCH before the digest is ever reached.
READY_BYTES = bytes((index % 251) + 1 for index in range(frozen.YT_DLP_EXPECTED_BYTES))
READY_SHA = frozen.YT_DLP_EXPECTED_SHA256


class FakeAsr(FakeAsrManager):
    pass


def publish_ready(root: Path) -> Path:
    """Publish a previously verified yt-dlp that a failure must NOT disturb."""
    target = root / frozen.MANAGED_TOOL_VERSIONS_DIRNAME / "yt-dlp" / frozen.YT_DLP_VERSION / READY_SHA
    target.mkdir(parents=True, exist_ok=True)
    tool = target / "yt-dlp"
    tool.write_bytes(READY_BYTES)
    tool.chmod(0o700)
    (root / frozen.MANAGED_TOOL_ACTIVE_MANIFEST).write_text(
        json.dumps({"sha256": READY_SHA, "version": frozen.YT_DLP_VERSION, "verifiedAt": "2026-10-19T00:00:00Z"}),
        "utf-8",
    )
    return tool


def make_manager(
    tmp_path: Path,
    *,
    downloader: Any = None,
    runner: Any = None,
    disk_usage: Any = None,
    root: Path | None = None,
) -> MediaDependencyManager:
    managed = root or (tmp_path / "managed-tools")
    managed.mkdir(parents=True, exist_ok=True)
    return MediaDependencyManager(
        asr_manager=FakeAsr(),
        managed_root=managed,
        now=lambda: "2026-10-19T00:00:00.000Z",
        downloader=downloader
        or (lambda url, destination: (destination.write_bytes(READY_BYTES), len(READY_BYTES), "application/octet-stream")[-2:]),
        runner=runner or (lambda command, timeout: subprocess.CompletedProcess(command, 0, f"{frozen.YT_DLP_VERSION}\n", "")),
        disk_usage=disk_usage or (lambda path: frozen.INSTALL_FREE_SPACE_BYTES + 1),
    )


def frozen_digest(path: Path) -> str:
    """The published bytes' real digest, mapped onto the frozen value.

    A unit test must not fabricate the 3,072,469-byte frozen asset, so the
    MEASURED digest is supplied for the managed tool only. Every comparison the
    manager makes still runs.
    """
    return sha256_file(path)


def assert_old_ready_intact(manager: MediaDependencyManager, tool: Path) -> None:
    assert tool.is_file(), "the previously published tool was destroyed"
    assert json.loads(manager._active_manifest_path.read_text())["sha256"] == READY_SHA


def assert_no_staging(manager: MediaDependencyManager) -> None:
    staging = manager.managed_root / frozen.MANAGED_TOOL_STAGING_DIRNAME
    leftovers = [p.name for p in staging.iterdir()] if staging.is_dir() else []
    assert leftovers == [], f"staging survived: {leftovers}"


# --- A09 --------------------------------------------------------------------


def test_a09_full_repair_walks_every_frozen_phase(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A09 — checking -> downloading -> verifying -> self_testing -> installing -> ready."""
    manager = make_manager(tmp_path)
    published: dict[str, Any] = {}

    def fake_digest(path: Path, **_: Any) -> str:
        return frozen.YT_DLP_EXPECTED_SHA256 if Path(path).name in {"yt-dlp", frozen.MANAGED_TOOL_PART_NAME} else sha256_file(Path(path))

    monkeypatch.setattr(
        "navia_runtime.modules.media_companion.dependencies.manager.sha256_file", fake_digest
    )

    job = manager.start_install(["yt-dlp"])
    seen: list[str] = []
    original = manager._advance

    def record(job: dict[str, Any], state: str, **fields: Any) -> None:
        seen.append(state)
        original(job, state, **fields)

    monkeypatch.setattr(manager, "_advance", record)
    final = manager.run_job(job["jobId"])

    assert seen == ["checking", "downloading", "verifying", "self_testing", "installing", "ready"]
    assert final["state"] == "ready"
    assert final["cancelable"] is False
    assert final["publishedGeneration"].startswith("depgen_")
    assert final["finishedAt"] is not None
    # The job starts at sequence 0 and every persisted change adds exactly 1.
    assert final["sequence"] == len(seen)
    assert_no_staging(manager)
    published.clear()


# --- A12 --------------------------------------------------------------------


def test_a12_commit_wins_over_a_cancel_that_arrives_late(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A12 — a cancel that arrives during the commit window never publishes."""
    manager = make_manager(tmp_path)
    monkeypatch.setattr(
        "navia_runtime.modules.media_companion.dependencies.manager.sha256_file",
        lambda path, **_: frozen.YT_DLP_EXPECTED_SHA256 if Path(path).name in {"yt-dlp", frozen.MANAGED_TOOL_PART_NAME} else sha256_file(Path(path)),
    )
    job = manager.start_install(["yt-dlp"])

    def cancel_mid_commit(current_job_id: str) -> bool:
        # The cancel lands exactly at the atomic commit boundary.
        return manager._jobs[current_job_id]["state"] in {"installing", "ready"}

    final = manager.run_job(job["jobId"], cancel_requested=cancel_mid_commit)
    assert final["state"] == "ready", "the commit must win the race, not the cancel"
    assert final["cancelable"] is False


# --- A13 --------------------------------------------------------------------


@pytest.mark.parametrize(
    "error",
    [
        MediaDependencyError("NETWORK_FAILED", "Download could not be completed."),
        MediaDependencyError("TIMEOUT", "Download could not be completed."),
        MediaDependencyError("SOURCE_NOT_ALLOWED", "Download host is not allowed."),
    ],
)
def test_a13_network_classes_fail_closed(tmp_path: Path, error: MediaDependencyError) -> None:
    """A13 — every network class keeps the old version and clears staging."""
    manager = make_manager(tmp_path)
    tool = publish_ready(manager.managed_root)

    def failing(url: str, destination: Path) -> tuple[int, Any]:
        raise error

    manager = make_manager(tmp_path, root=manager.managed_root, downloader=failing)
    job = manager.start_install(["yt-dlp"])
    final = manager.run_job(job["jobId"])

    assert final["state"] == "failed"
    assert final["failureCode"] == error.code
    assert_old_ready_intact(manager, tool)
    assert_no_staging(manager)


@pytest.mark.parametrize(
    ("locations", "expected_calls"),
    [
        (["http://release-assets.githubusercontent.com/tool"], 1),
        (["https://example.invalid/tool"], 1),
        ([
            "https://release-assets.githubusercontent.com/one",
            "https://github.com/two",
            "https://release-assets.githubusercontent.com/three",
        ], 3),
    ],
)
def test_a13_default_downloader_rejects_downgrade_host_and_third_redirect(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, locations: list[str], expected_calls: int
) -> None:
    calls: list[str] = []

    class RedirectingOpener:
        def open(self, request: Any, timeout: float) -> Any:
            calls.append(request.full_url)
            location = locations[len(calls) - 1]
            headers = Message()
            headers["Location"] = location
            raise __import__("urllib.error").error.HTTPError(request.full_url, 302, "redirect", headers, None)

    monkeypatch.setattr("urllib.request.build_opener", lambda *args: RedirectingOpener())
    manager = make_manager(tmp_path)
    with pytest.raises(MediaDependencyError) as error:
        manager._default_download(frozen.YT_DLP_SOURCE_URL, tmp_path / "tool.part")
    assert error.value.code == "V3_MEDIA_DEPENDENCY_SOURCE_NOT_ALLOWED"
    assert len(calls) == expected_calls


@pytest.mark.parametrize(
    ("failure", "expected_code"),
    [
        (__import__("urllib.error").error.URLError("offline"), "V3_MEDIA_DEPENDENCY_NETWORK_FAILED"),
        (TimeoutError("slow read"), "V3_MEDIA_DEPENDENCY_TIMEOUT"),
        (__import__("urllib.error").error.HTTPError("https://github.com/tool", 503, "busy", Message(), None), "V3_MEDIA_DEPENDENCY_NETWORK_FAILED"),
    ],
)
def test_a13_default_downloader_retries_only_twice_with_fresh_destination(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, failure: Exception, expected_code: str
) -> None:
    calls = 0
    destination = tmp_path / "tool.part"

    class FailingOpener:
        def open(self, request: Any, timeout: float) -> Any:
            nonlocal calls
            calls += 1
            destination.write_bytes(b"partial")
            raise failure

    monkeypatch.setattr("urllib.request.build_opener", lambda *args: FailingOpener())
    manager = make_manager(tmp_path)
    with pytest.raises(MediaDependencyError) as error:
        manager._default_download(frozen.YT_DLP_SOURCE_URL, destination)
    assert error.value.code == expected_code
    assert calls == frozen.MAX_DOWNLOAD_RETRIES + 1
    assert not destination.exists()


def test_a13_default_downloader_enforces_total_deadline(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    ticks = iter([0.0, frozen.DOWNLOAD_DEADLINE_SECONDS + 0.001])
    monkeypatch.setattr("time.monotonic", lambda: next(ticks))
    manager = make_manager(tmp_path)
    with pytest.raises(MediaDependencyError) as error:
        manager._default_download(frozen.YT_DLP_SOURCE_URL, tmp_path / "tool.part")
    assert error.value.code == "V3_MEDIA_DEPENDENCY_TIMEOUT"


# --- A14 --------------------------------------------------------------------


@pytest.mark.parametrize("written", [frozen.YT_DLP_EXPECTED_BYTES - 1, frozen.YT_DLP_EXPECTED_BYTES + 1])
def test_a14_size_must_equal_the_frozen_length(tmp_path: Path, written: int, monkeypatch: pytest.MonkeyPatch) -> None:
    """A14 — one byte under or over is SIZE_MISMATCH, refused before publish."""
    manager = make_manager(
        tmp_path,
        downloader=lambda url, destination: (destination.write_bytes(READY_BYTES[:64]), written),
    )
    tool = publish_ready(manager.managed_root)
    manager = make_manager(
        tmp_path,
        root=manager.managed_root,
        downloader=lambda url, destination: (destination.write_bytes(READY_BYTES[:64]), written),
    )
    job = manager.start_install(["yt-dlp"])
    final = manager.run_job(job["jobId"])

    assert final["state"] == "failed"
    assert final["failureCode"] == "V3_MEDIA_DEPENDENCY_SIZE_MISMATCH"
    assert_old_ready_intact(manager, tool)
    assert_no_staging(manager)


# --- A15 --------------------------------------------------------------------


def test_a15_a_digest_mutation_never_publishes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A15 — a one-nibble mutation is HASH_MISMATCH with the old ready intact."""
    manager = make_manager(tmp_path)
    tool = publish_ready(manager.managed_root)
    mutated = bytearray(READY_BYTES)
    mutated[-1] ^= 0xFF
    manager = make_manager(
        tmp_path,
        root=manager.managed_root,
        downloader=lambda url, destination: (destination.write_bytes(bytes(mutated)), len(READY_BYTES)),
    )
    job = manager.start_install(["yt-dlp"])
    final = manager.run_job(job["jobId"])

    assert final["state"] == "failed"
    assert final["failureCode"] == "V3_MEDIA_DEPENDENCY_HASH_MISMATCH"
    assert_old_ready_intact(manager, tool)
    assert_no_staging(manager)


# --- A16 --------------------------------------------------------------------


def test_a16_space_is_checked_before_any_download(tmp_path: Path) -> None:
    """A16 — one byte under the requirement stops the job before downloading."""
    downloaded: list[str] = []

    def never(url: str, destination: Path) -> tuple[int, Any]:
        downloaded.append(url)
        return len(READY_BYTES), None

    manager = make_manager(
        tmp_path, downloader=never, disk_usage=lambda path: frozen.INSTALL_FREE_SPACE_BYTES - 1
    )
    tool = publish_ready(manager.managed_root)
    job = manager.start_install(["yt-dlp"])
    final = manager.run_job(job["jobId"])

    assert final["failureCode"] == "V3_MEDIA_DEPENDENCY_DISK_SPACE_LOW"
    assert downloaded == [], "space must be checked BEFORE the download starts"
    assert_old_ready_intact(manager, tool)
    assert_no_staging(manager)


def test_a16_self_test_failure_is_fail_closed(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A16 — a non-zero self-test never publishes."""
    manager = make_manager(
        tmp_path,
        runner=lambda command, timeout: subprocess.CompletedProcess(command, 1, "", "boom"),
    )
    monkeypatch.setattr(
        "navia_runtime.modules.media_companion.dependencies.manager.sha256_file",
        lambda path, **_: frozen.YT_DLP_EXPECTED_SHA256 if Path(path).name in {"yt-dlp", frozen.MANAGED_TOOL_PART_NAME} else sha256_file(Path(path)),
    )
    job = manager.start_install(["yt-dlp"])
    final = manager.run_job(job["jobId"])

    assert final["failureCode"] == "V3_MEDIA_DEPENDENCY_SELF_TEST_FAILED"
    assert_no_staging(manager)


# --- A17 / A18 --------------------------------------------------------------


@pytest.mark.parametrize("crash_stage", ["checking", "downloading", "verifying", "self_testing", "installing"])
def test_a17_restart_fails_each_persisted_active_phase_and_clears_staging(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, crash_stage: str
) -> None:
    """A17 — a genuinely new manager discovers each interrupted phase on disk."""
    manager = make_manager(tmp_path)
    old_tool = publish_ready(manager.managed_root)
    job = manager.start_install(["yt-dlp"])
    monkeypatch.setattr(
        "navia_runtime.modules.media_companion.dependencies.manager.sha256_file",
        lambda path, **_: frozen.YT_DLP_EXPECTED_SHA256 if Path(path).name in {"yt-dlp", frozen.MANAGED_TOOL_PART_NAME} else sha256_file(Path(path)),
    )
    original_advance = manager._advance

    def crash_after_persist(current: dict[str, Any], state: str, **fields: Any) -> None:
        original_advance(current, state, **fields)
        if state == crash_stage:
            raise SystemExit(137)

    monkeypatch.setattr(manager, "_advance", crash_after_persist)
    with pytest.raises(SystemExit, match="137"):
        manager.run_job(job["jobId"])

    fresh = make_manager(tmp_path, root=manager.managed_root)
    recovered = fresh.job(job["jobId"])
    assert recovered["state"] == "failed"
    assert recovered["failureCode"] == "V3_MEDIA_DEPENDENCY_RUNTIME_RESTARTED"
    assert_no_staging(fresh)
    assert_old_ready_intact(fresh, old_tool)


def test_a18_a_late_worker_cannot_rewrite_a_terminal_job(tmp_path: Path) -> None:
    """A18 — terminal state, sequence and manifest survive a stale write."""
    manager = make_manager(tmp_path)
    job = manager.start_install(["yt-dlp"])
    cancelled = manager.cancel(job["jobId"])
    sequence = cancelled["sequence"]

    manager._advance(manager._jobs[job["jobId"]], "ready", sequence=sequence + 5)
    again = manager.job(job["jobId"])

    assert again["state"] == "cancelled"
    assert again["sequence"] == sequence


def test_a17_restart_after_manifest_commit_keeps_only_complete_new_version(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    manager = make_manager(tmp_path)
    monkeypatch.setattr(
        "navia_runtime.modules.media_companion.dependencies.manager.sha256_file",
        lambda path, **_: frozen.YT_DLP_EXPECTED_SHA256 if Path(path).name in {"yt-dlp", frozen.MANAGED_TOOL_PART_NAME} else sha256_file(Path(path)),
    )
    job = manager.start_install(["yt-dlp"])
    original_replace = __import__("os").replace

    def crash_after_manifest(source: Any, destination: Any) -> None:
        original_replace(source, destination)
        if Path(destination) == manager._active_manifest_path:
            raise SystemExit(137)

    monkeypatch.setattr("os.replace", crash_after_manifest)
    with pytest.raises(SystemExit, match="137"):
        manager.run_job(job["jobId"])
    monkeypatch.setattr("os.replace", original_replace)

    fresh = make_manager(tmp_path, root=manager.managed_root)
    recovered = fresh.job(job["jobId"])
    assert recovered["state"] == "failed"
    assert recovered["failureCode"] == "V3_MEDIA_DEPENDENCY_RUNTIME_RESTARTED"
    assert fresh._active_manifest_path.is_file()
    assert (fresh._version_dir(frozen.YT_DLP_EXPECTED_SHA256) / "yt-dlp").is_file()
    assert_no_staging(fresh)
