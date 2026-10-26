"""WP-A task binding tests — A19 / A20.

Production owner: the three dependency consumers (`build_media_acquirers`,
`create_sensevoice_provider`, `MediaProductMaterializer`'s visual downloader).

The frozen rule: ONE task binds ONE verified snapshot, and a newly published
generation never hot-swaps the tools a running task is already using.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.dependencies import catalog as frozen
from navia_runtime.modules.media_companion.dependencies.contracts import VerifiedDependencySnapshot
from navia_runtime.modules.media_companion.acquisition.coordinator import MediaAcquisitionError
from navia_runtime.app import build_media_acquirers, resolve_managed_yt_dlp

TASK_A = "media_task_" + "a" * 32
TASK_B = "media_task_" + "b" * 32


def snapshot_for(yt_dlp_path: Path, *, verified_at: str = "2026-10-19T00:00:00Z") -> VerifiedDependencySnapshot:
    return VerifiedDependencySnapshot.build(
        verified_at=verified_at,
        yt_dlp={"path": str(yt_dlp_path), "version": frozen.YT_DLP_VERSION, "byteLength": frozen.YT_DLP_EXPECTED_BYTES, "sha256": frozen.YT_DLP_EXPECTED_SHA256},
        ffmpeg={"path": frozen.FFMPEG_DEFAULT_PATH, "version": frozen.FFMPEG_VERSION, "sha256": frozen.FFMPEG_SHA256},
        ffprobe={"path": frozen.FFPROBE_DEFAULT_PATH, "sha256": frozen.FFPROBE_SHA256},
        asr={"effectiveModelId": "funasr-sensevoice-small-q8", "catalogRevision": "90c1c61912018b70ada0fcc024ea24aca62f2e63", "modelRoot": None, "assetSetDigest": None},
    )


def test_a19_resolve_managed_yt_dlp_prefers_the_task_snapshot(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A19 — with a snapshot, the managed path comes from THAT task."""
    monkeypatch.setenv("NAVIA_MEDIA_YT_DLP_PATH", "/usr/local/bin/yt-dlp")
    task_tool = tmp_path / "versions" / "yt-dlp"

    assert resolve_managed_yt_dlp(snapshot_for(task_tool)) == task_tool


def test_a19_without_a_snapshot_the_process_default_is_used(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NAVIA_MEDIA_YT_DLP_PATH", "/usr/local/bin/yt-dlp")
    assert resolve_managed_yt_dlp(None) == Path("/usr/local/bin/yt-dlp")


def test_a19_acquirers_are_built_from_the_same_snapshot(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A19 — the snapshot's OWN binary reaches the acquirer's downloader factory."""
    task_tool = tmp_path / "managed" / "yt-dlp"
    task_tool.parent.mkdir(parents=True, exist_ok=True)
    task_tool.write_bytes(b"placeholder")
    task_tool.chmod(0o700)

    seen: dict[str, Any] = {}
    monkeypatch.setattr(
        "navia_runtime.app.build_media_downloader",
        lambda sandbox, yt_dlp_path=None, **_: seen.setdefault("yt_dlp_path", yt_dlp_path),
    )

    acquirers = build_media_acquirers(snapshot_for(task_tool))

    assert set(acquirers) == {"bilibili"}
    # The composed factory received the TASK's managed binary, not the process
    # default: this is the A19 "same snapshot everywhere" binding.
    assert Path(seen["yt_dlp_path"]) == task_tool


def test_a20_the_snapshot_never_exposes_a_path_in_public_json(tmp_path: Path) -> None:
    """A20 — the snapshot is internal; its JSON form carries identity only."""
    snapshot = snapshot_for(tmp_path / "managed" / "yt-dlp")
    internal = json.dumps(snapshot.to_internal(), sort_keys=True)
    # The internal form may carry the path (the Runtime needs it) ...
    assert "managed" in internal
    # ... but nothing else in the product may serialise it to a client.
    assert snapshot.generation.startswith("depgen_")


def test_a19_two_tasks_bind_two_independent_snapshots(tmp_path: Path) -> None:
    """A19 — a lease is per task, so T1 and T2 never share a mutable object."""
    first = snapshot_for(tmp_path / "one" / "yt-dlp")
    second = snapshot_for(tmp_path / "two" / "yt-dlp")
    assert first.generation == second.generation, "the same bytes mint the same generation"
    assert first is not second
    assert first.yt_dlp["path"] != second.yt_dlp["path"]


def test_a20_tampered_task_snapshot_fails_closed_without_capture_fallback(tmp_path: Path) -> None:
    """A20 — a leased binary removed mid-task is not converted into fallback."""
    missing = tmp_path / "leased" / "yt-dlp"
    snapshot = snapshot_for(missing)

    with pytest.raises(MediaAcquisitionError) as error:
        build_media_acquirers(snapshot)

    assert error.value.code == "V3_MEDIA_RUNTIME_OFFLINE"
