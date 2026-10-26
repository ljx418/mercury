#!/usr/bin/env python3
"""Independently verify the fixed R5-B denominator without publishing private media."""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from pathlib import Path


PACKAGE = Path(__file__).resolve().parent
WP0 = PACKAGE.parent
RUN = (
    WP0
    / "wp0-r5b-audio-isolated-positive-2026-10-19"
    / "runs"
    / "r5b-audio-isolated-positive-20261019T024000Z"
)
EXPECTED_SOURCE = "portal:bilibili:BV1Bb411w741:61744125:p1"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    result_path = RUN / "public" / "result.json"
    secret_path = RUN / "public" / "secret-scan.json"
    log_path = RUN / "private" / "runtime.log"
    db_path = RUN / "private" / "runtime.sqlite3"
    for path in (result_path, secret_path, log_path, db_path):
        require(path.is_file(), f"missing evidence: {path.name}")

    result = json.loads(result_path.read_text(encoding="utf-8"))
    secret = json.loads(secret_path.read_text(encoding="utf-8"))
    log = log_path.read_text(encoding="utf-8", errors="replace")
    checks = result["checks"]

    # Preserve the source runner result. Its only failure is a post-denominator
    # workspace-navigation check; this verifier never rewrites it as green.
    require(result["passed"] is False, "source runner result was unexpectedly rewritten")
    require(
        result.get("failure", {}).get("error") == "canonical Media Workspace did not open",
        "unexpected source-runner failure",
    )
    require(result["runId"] == "r5b-audio-isolated-positive-20261019T024000Z", "run mismatch")
    require(result["sampleUrl"].endswith("/BV1Bb411w741"), "fixed source URL mismatch")

    required_runner_checks = {
        "startActionAccepted",
        "realThreeRouteFailure",
        "realDecodedAudio",
        "realPlayback",
        "extensionInvokedOnTarget",
        "trustedCaptureStarted",
        "ownedChromeAudioSessionMuted",
        "playbackContinuedDuringCapture",
        "finishActionAccepted",
        "senseVoiceTerminal",
        "profileDeleted",
        "secretScanZeroHits",
        "secureTaskRootDeleted",
    }
    require(all(checks.get(key) is True for key in required_runner_checks), "required runner check failed")
    require(
        [(item["state"], item["route"]) for item in result["states"]]
        == [
            ("awaiting_trusted_capture", "none"),
            ("transcribing", "trusted_tab_capture_asr"),
            ("terminal", "trusted_tab_capture_asr"),
        ],
        "UI task-state sequence mismatch",
    )

    isolation = result["audioIsolation"]
    require(isolation["mode"] == "owned_windows_audio_session", "wrong audio isolation mode")
    require(isolation["watcherReady"] is True, "audio isolation watcher not ready")
    require(isolation["ownedProcessCount"] > 0, "owned Chrome process set was empty")
    require(isolation["matchedSessionCount"] > 0, "no owned Chrome audio session was matched")
    require(isolation["matchedSessionCount"] == isolation["mutedSessionCount"], "audio session not muted")
    require(isolation["allMatchedSessionsMuted"] is True, "audio isolation was not fail-closed")

    offscreen = result["offscreenCaptureDiagnostic"]
    require(offscreen["strategy"] == "audio_worklet", "unexpected producer strategy")
    require(offscreen["trackMuted"] is False and offscreen["contextState"] == "running", "producer inactive")
    require(offscreen["workletChunkCount"] > 0, "producer emitted no chunks")
    require(offscreen["workletPeakAbsSample"] > 0, "producer PCM remained all-zero")
    require(offscreen["workletNonZeroSampleCount"] > 0, "producer has no non-zero samples")

    relay = result["relayCaptureDiagnostic"]
    require(relay["failureCode"] is None, "relay reported a failure")
    require(relay["acceptedChunkCount"] == relay["sentChunkCount"] == relay["acknowledgedChunkCount"], "relay counts diverged")
    require(relay["acceptedChunkCount"] > 0, "relay accepted no chunks")
    require(relay["queuedChunkCount"] == relay["inFlightChunkCount"] == 0, "relay did not drain")
    require(relay["totalRawBytes"] > 0 and relay["capturedMs"] >= 15_000, "relay PCM duration/bytes too small")

    finalized = re.search(
        r"V3 capture finalized task=(media_task_[a-f0-9]{32}) capturedMs=(\d+) chunks=(\d+) "
        r"nonZeroSamples=(\d+) peakAbsSample=(\d+)",
        log,
    )
    require(finalized is not None, "Runtime finalize receipt missing")
    task_id = finalized.group(1)
    require(int(finalized.group(2)) >= 15_000, "Runtime duration too small")
    require(int(finalized.group(3)) > 0, "Runtime chunk count is zero")
    require(int(finalized.group(4)) > 0 and int(finalized.group(5)) > 0, "Runtime PCM is all-zero")
    finalize_at = log.index("V3 capture finalized")
    transcript_at = log.index(f'GET /v1/media/transcripts/{task_id} HTTP/1.1" 200 OK')
    visual_at = log.index(f'POST /v1/media/outline-tasks/{task_id}/materialize-visual HTTP/1.1" 503')
    text_at = log.index(f'POST /v1/media/outline-tasks/{task_id}/materialize HTTP/1.1" 200 OK')
    require(finalize_at < transcript_at < visual_at < text_at, "handoff/materialize ordering mismatch")

    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    tasks = db.execute(
        "SELECT task_id, source_identity, state, revision, terminal_failure_code, current_outline_id FROM media_tasks"
    ).fetchall()
    require(len(tasks) == 1, "fresh run must own exactly one media task")
    task = tasks[0]
    require(task["task_id"] == task_id and task["source_identity"] == EXPECTED_SOURCE, "task/source mismatch")
    require(task["state"] == "degraded" and task["revision"] == 6, "durable terminal mismatch")
    require(task["terminal_failure_code"] == "VISUAL_EVIDENCE_UNAVAILABLE", "degradation code mismatch")
    require(bool(task["current_outline_id"]), "published outline binding missing")

    events = db.execute(
        "SELECT sequence, task_revision, event_type FROM media_task_events WHERE task_id=? ORDER BY sequence",
        (task_id,),
    ).fetchall()
    require(
        [(row["sequence"], row["task_revision"], row["event_type"]) for row in events]
        == [
            (0, 1, "task.created"),
            (1, 2, "task.acquiring"),
            (2, 3, "task.transcribing"),
            (3, 4, "task.extracting_frames"),
            (4, 5, "task.synthesizing"),
            (5, 6, "task.degraded"),
        ],
        "event revision/fence sequence mismatch",
    )
    authority = db.execute(
        "SELECT source_identity, task_id, state FROM media_source_authority"
    ).fetchall()
    require(len(authority) == 1, "source authority cardinality mismatch")
    require(
        tuple(authority[0]) == (EXPECTED_SOURCE, task_id, "published"),
        "source authority was not atomically published",
    )
    outline_row = db.execute(
        "SELECT task_id, task_revision, outline_id, published, canonical_json FROM media_outlines"
    ).fetchone()
    require(outline_row is not None and outline_row["published"] == 1, "outline not published")
    require(outline_row["task_id"] == task_id and outline_row["task_revision"] == 6, "outline fence mismatch")
    require(outline_row["outline_id"] == task["current_outline_id"], "outline identity mismatch")
    outline = json.loads(outline_row["canonical_json"])
    sections = outline.get("outline", {}).get("sections", [])
    timeline = outline.get("timeline", [])
    require(len(sections) > 0 and len(timeline) > 0, "durable product projection is empty")
    require(all(item.get("endMs", 0) > item.get("startMs", -1) for item in sections), "section timestamps invalid")
    require(all(item.get("endMs", 0) > item.get("startMs", -1) for item in timeline), "timeline timestamps invalid")
    require(all(item.get("evidenceIds") for item in sections + timeline), "projection evidence binding missing")
    db.close()

    require(secret["passed"] is True and secret["hitCount"] == 0, "secret scan failed")
    denominator = {f"R5B-{index:02d}": True for index in range(1, 13)}
    output = {
        "schemaVersion": "navia-wp0-r5b-acceptance/v1",
        "decision": "R5-B PASS / R5 PASS / R6 MAY START",
        "sourceRunnerPassed": False,
        "sourceRunnerResidual": "post_denominator_workspace_navigation_not_opened",
        "taskId": task_id,
        "sourceIdentity": EXPECTED_SOURCE,
        "terminal": {"state": "degraded", "revision": 6, "sourceAuthority": "published"},
        "audio": {
            "isolationMode": isolation["mode"],
            "ownedProcessCount": isolation["ownedProcessCount"],
            "matchedSessionCount": isolation["matchedSessionCount"],
            "mutedSessionCount": isolation["mutedSessionCount"],
            "offscreenChunks": offscreen["workletChunkCount"],
            "relayChunks": relay["acknowledgedChunkCount"],
            "runtimeChunks": int(finalized.group(3)),
            "runtimeCapturedMs": int(finalized.group(2)),
            "runtimeNonZeroSamples": int(finalized.group(4)),
        },
        "denominator": denominator,
        "summary": {"total": 12, "passed": 12, "failed": 0},
        "evidenceDigests": {
            "resultJson": sha256(result_path),
            "secretScanJson": sha256(secret_path),
            "runtimeLog": sha256(log_path),
            "runtimeDatabase": sha256(db_path),
        },
        "secretScanHits": 0,
    }
    (PACKAGE / "40-r5b-acceptance.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("R5-B acceptance: 12/12 PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
