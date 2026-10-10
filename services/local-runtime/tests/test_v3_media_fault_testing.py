from __future__ import annotations

import json
from pathlib import Path

import pytest

from navia_runtime.modules.media_companion.acquisition.fault_testing import (
    FAULT_CLASSES,
    FaultObservationRecorder,
    sign_profile,
    verify_profile,
)


def test_signed_fault_profile_is_closed_and_bound_to_isolated_root(tmp_path: Path):
    key = b"k" * 32
    root = tmp_path / "isolated"
    root.mkdir()
    profile = {
        "schemaVersion": "v3-media-test-fault-profile/v1",
        "runId": "v3-2-6-faults-20261008T000000Z",
        "isolatedTaskRoot": str(root),
        "faultClasses": list(FAULT_CLASSES),
        "nonce": "1" * 32,
    }
    profile["signature"] = sign_profile(profile, key)
    path = tmp_path / "profile.json"
    path.write_text(json.dumps(profile), encoding="utf-8")
    assert verify_profile(path, key, root)["faultClasses"] == list(FAULT_CLASSES)
    profile["faultClasses"] = profile["faultClasses"][:-1]
    path.write_text(json.dumps(profile), encoding="utf-8")
    with pytest.raises(ValueError):
        verify_profile(path, key, root)


def test_fault_recorder_enforces_one_terminal_and_zero_committed_post_terminal_writes():
    recorder = FaultObservationRecorder("V3-2-6-F01", "downloader_403", "media_task_" + "1" * 32)
    recorder.observe("started")
    recorder.terminal("failed")
    with pytest.raises(RuntimeError):
        recorder.observe("late")
    with pytest.raises(RuntimeError):
        recorder.terminal("failed")
    receipt = recorder.receipt(residual_count=0, secret_hit_count=0)
    assert receipt["terminalCount"] == 1
    assert receipt["postTerminalWriteCount"] == 0
    assert recorder.rejected_post_terminal_writes == 1
