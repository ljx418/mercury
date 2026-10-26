#!/usr/bin/env python3
"""WP-B real hard-kill probe over the frozen barrier.

For each production-reachable injection point the probe runs TWO distinct
processes over the same owned SQLite, sandbox and shared input:

1. ``--internal-kill``      drives a real import to the phase through the REAL
   barrier and the REAL coordinator, then dies with ``os._exit(137)`` — no
   ``finally``, no atexit, no graceful drain, no flush;
2. ``--internal-recover``  a NEW process that must discover the interrupted
   record from disk alone and release only what its durable receipts prove.

The receipt records the kill phase, the kill exit code, the durable barrier
phase, both receipts, both terminal flags, the recovery outcome and the
residual count. A phase is only reported ``released`` when the receipts prove
the object is ours; anything less must preserve it.

Output is redacted JSON: identifiers, phases, digests and counts only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

RUNTIME_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RUNTIME_ROOT))

from navia_runtime.modules.media_companion.acquisition.coordinator import (  # noqa: E402
    MediaAcquisitionCoordinator,
    MediaAcquisitionRequest,
)
from navia_runtime.modules.media_companion.acquisition.task_artifacts import (  # noqa: E402
    TaskArtifactSandbox,
)
from navia_runtime.modules.media_companion.local_import.consumer_barrier import (  # noqa: E402
    LocalMediaConsumerBarrier,
)
from navia_runtime.modules.media_companion.local_import.contracts import (  # noqa: E402
    ImportError,
)
from navia_runtime.modules.media_companion.local_import.store import (  # noqa: E402
    LocalMediaBarrierStore,
    LocalMediaImportStore,
)

TASK_ID = "media_task_" + "b" * 32
SOURCE = "portal:bilibili:BV1local000000:cid:1"
GENERATION = "depgen_" + "c" * 64
IMPORT_ID = "media_import_" + "a" * 32
VIDEO_BYTES = b"wp-b-real-hard-kill-probe-source-bytes"
SHA_VIDEO = hashlib.sha256(VIDEO_BYTES).hexdigest()
SHA_AUDIO_RECEIPT = "2" * 64
SHA_VISUAL_RECEIPT = "3" * 64

#: The production-reachable kill points, in the frozen order. There is
#: deliberately no point between the audio owner receipt and the delete, nor
#: between the delete and T4: neither ordering can occur.
KILL_PHASES = (
    "after_t1",
    "after_t2",
    "after_t3",
    "after_audio_receipt_before_delete",
    "after_delete_before_t4",
    "after_transcript_terminal",
    "after_visual_terminal",
    "after_both_consumers",
    "during_cleanup",
)


def _real_coordinator(root: Path) -> MediaAcquisitionCoordinator:
    """The REAL coordinator. A fresh process re-registers the same task id."""
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(root / "tasks"))
    _portal, adapter_id, media_id, playback_unit_id, part_id = SOURCE.split(":")
    coordinator.create(
        MediaAcquisitionRequest(
            task_id=TASK_ID,
            source_identity=SOURCE,
            adapter_id=adapter_id,
            media_id=media_id,
            playback_unit_id=playback_unit_id,
            part_id=part_id,
            consent_policy_id="bilibili-media-consent/v1",
            consent_policy_revision=1,
        )
    )
    return coordinator


def _store(root: Path) -> LocalMediaImportStore:
    store = LocalMediaImportStore(root / "navia.sqlite3")
    if store.find(IMPORT_ID) is None:
        store.create_import(
            task_id=TASK_ID,
            source_identity=SOURCE,
            byte_length=len(VIDEO_BYTES),
            declared_media_type="video/mp4",
            dependency_generation=GENERATION,
            import_id=IMPORT_ID,
        )
        store.transition(
            IMPORT_ID, expected_sequence=store.get(IMPORT_ID)["sequence"], state="uploading"
        )
        store.transition(
            IMPORT_ID,
            expected_sequence=store.get(IMPORT_ID)["sequence"],
            state="verifying",
            uploaded_bytes=len(VIDEO_BYTES),
            video_manifest_sha256=SHA_VIDEO,
        )
    return store


def _shared_input(root: Path) -> Path:
    path = root / "shared" / "source.bin"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(VIDEO_BYTES)
        os.chmod(path, 0o600)
    return path


def _barrier(root: Path, store: LocalMediaImportStore) -> LocalMediaConsumerBarrier:
    return LocalMediaConsumerBarrier(
        store=store,
        barrier_store=LocalMediaBarrierStore(root / "navia.sqlite3"),
        coordinator=_real_coordinator(root),
        import_id=IMPORT_ID,
        shared_input=_shared_input(root),
    )


def _kill_inside_cleanup(task_id: str):
    """Die inside the REAL cleanup, after the durable claim was written."""
    sys.stdout.write(json.dumps({"killedInside": "coordinator.complete", "taskId": task_id}))
    sys.stdout.flush()
    os._exit(137)


def _to_video_deleted(barrier: LocalMediaConsumerBarrier) -> None:
    """The PRODUCTION T1..T4 transitions, in the only legal order."""
    barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
    barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL_RECEIPT)
    barrier.mark_input_bound(
        video_manifest_sha256=SHA_VIDEO, visual_receipt_sha256=SHA_VISUAL_RECEIPT
    )
    barrier.mark_audio_staged(audio_owner_receipt_sha256=SHA_AUDIO_RECEIPT)
    barrier.delete_original_video()


def _terminal(barrier: LocalMediaConsumerBarrier, which: str) -> None:
    """The PRODUCTION terminal receipts. Nothing is fabricated here."""
    if which == "transcript":
        barrier.mark_transcript_terminal()
    else:
        barrier.mark_visual_terminal()


def kill(root: Path, phase: str) -> None:
    """Drive the REAL production barrier to `phase`, then die with no drain.

    Every step below is a PRODUCTION transition: the same methods the Runtime
    calls, in the same order. No phase is fabricated by writing a private
    record, so what a fresh process reads is exactly what production wrote.
    """
    store = _store(root)
    barrier = _barrier(root, store)

    if phase == "after_t1":
        barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
    elif phase == "after_t2":
        barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
        barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL_RECEIPT)
    elif phase == "after_t3":
        barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
        barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL_RECEIPT)
        barrier.mark_input_bound(
            video_manifest_sha256=SHA_VIDEO, visual_receipt_sha256=SHA_VISUAL_RECEIPT
        )
    elif phase == "after_audio_receipt_before_delete":
        barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
        barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL_RECEIPT)
        barrier.mark_input_bound(
            video_manifest_sha256=SHA_VIDEO, visual_receipt_sha256=SHA_VISUAL_RECEIPT
        )
        barrier.mark_audio_staged(audio_owner_receipt_sha256=SHA_AUDIO_RECEIPT)
    elif phase == "after_delete_before_t4":
        barrier.mark_video_durable(video_manifest_sha256=SHA_VIDEO)
        barrier.mark_inputs_prepared(visual_receipt_sha256=SHA_VISUAL_RECEIPT)
        barrier.mark_input_bound(
            video_manifest_sha256=SHA_VIDEO, visual_receipt_sha256=SHA_VISUAL_RECEIPT
        )
        barrier.mark_audio_staged(audio_owner_receipt_sha256=SHA_AUDIO_RECEIPT)
        barrier.delete_original_video()
    elif phase == "after_transcript_terminal":
        _to_video_deleted(barrier)
        _terminal(barrier, "transcript")
    elif phase == "after_visual_terminal":
        _to_video_deleted(barrier)
        _terminal(barrier, "visual")
    elif phase == "after_both_consumers":
        _to_video_deleted(barrier)
        _terminal(barrier, "transcript")
        # The SECOND terminal receipt claims the cleanup and runs it through
        # the production coordinator. The kill happens AFTER that, so a fresh
        # process must observe the durable receipts and NOT release again.
        _terminal(barrier, "visual")
    elif phase == "during_cleanup":
        _to_video_deleted(barrier)
        _terminal(barrier, "transcript")
        # The kill happens INSIDE the real production cleanup, between the
        # durable claim and the completion of the coordinator's own release.
        # A fresh process must find the claim open and finish it exactly once.
        barrier.coordinator.complete = _kill_inside_cleanup  # type: ignore[method-assign]
        # The second terminal receipt claims the cleanup and calls the REAL
        # coordinator, which is where the kill lands.
        _terminal(barrier, "visual")
    else:  # pragma: no cover - the CLI validates the phase first
        raise SystemExit(2)
    sys.stdout.write(json.dumps({"killedAt": phase}))
    sys.stdout.flush()
    os._exit(137)


def _media_residuals(coordinator: Any) -> int:
    """Media artifacts left in the task sandbox.

    The sandbox's own ownership marker is not media and is not a residual; it
    is created whenever the task is registered.
    """
    try:
        task_root = coordinator.sandbox._task_root(TASK_ID)
    except Exception:  # noqa: BLE001
        return 0
    if not task_root.exists():
        return 0
    return sum(
        1 for path in task_root.rglob("*")
        if path.is_file() and path.name != ".navia-owner.json"
    )


def recover(root: Path) -> dict[str, Any]:
    """A NEW process: read the durable record, act only on what it proves.

    It also proves the REAL cleanup ran: the acquisition task must be
    terminal, the task sandbox must hold no residual artifact, and the shared
    input must be gone exactly once.
    """
    store = _store(root)
    barriers = LocalMediaBarrierStore(root / "navia.sqlite3")
    record = barriers.get(IMPORT_ID)
    sequence_before = barriers.sequence_of(IMPORT_ID)
    shared = root / "shared" / "source.bin"
    coordinator = _real_coordinator(root)
    cleanup_calls: list[str] = []
    real_complete = coordinator.complete

    def _counting_complete(task_id: str) -> dict[str, Any]:
        cleanup_calls.append(task_id)
        return real_complete(task_id)

    coordinator.complete = _counting_complete  # type: ignore[method-assign]
    barrier = LocalMediaConsumerBarrier(
        store=store,
        barrier_store=barriers,
        coordinator=coordinator,
        import_id=IMPORT_ID,
        shared_input=shared,
    )
    try:
        outcome = barrier.recover_after_restart()
        blocked = None
    except ImportError as error:
        outcome, blocked = "blocked", error.code
    after = barriers.get(IMPORT_ID)
    try:
        task_state = coordinator.get(TASK_ID)["state"]
    except Exception:  # noqa: BLE001
        task_state = "unknown"
    residual = _media_residuals(coordinator)
    return {
        "durablePhaseBefore": record["phase"],
        "audioOwnerReceiptPresent": bool(record["audioOwnerReceiptSha256"]),
        "visualReceiptPresent": bool(record["visualReceiptSha256"]),
        "transcriptTerminal": record["transcriptTerminal"],
        "visualTerminal": record["visualTerminal"],
        "outcome": outcome,
        "blockedCode": blocked,
        "durablePhaseAfter": after["phase"],
        "sharedInputSurvived": shared.is_file(),
        "sequenceAdvanced": barriers.sequence_of(IMPORT_ID) > sequence_before,
        "acquisitionTaskState": task_state,
        "taskSandboxResidualFiles": residual,
        "realCleanupCalls": len(cleanup_calls),
    }


def _spawn(root: Path, mode: str, phase: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), "--internal", mode,
         "--root", str(root), "--phase", phase],
        capture_output=True,
        text=True,
        timeout=180,
        env={**os.environ, "PYTHONPATH": str(RUNTIME_ROOT)},
    )


def run_probe() -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    for phase in KILL_PHASES:
        with tempfile.TemporaryDirectory(prefix="wpb-kill-") as directory:
            root = Path(directory)
            killed = _spawn(root, "kill", phase)
            recovered = _spawn(root, "recover", phase)
            results.append(
                {
                    "killPhase": phase,
                    "killExitCode": killed.returncode,
                    "recoveryExitCode": recovered.returncode,
                    **json.loads(recovered.stdout or "{}"),
                }
            )
    return {"probe": "wp-b-local-import-hard-kill", "results": results}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--internal", choices=["kill", "recover"])
    parser.add_argument("--root")
    parser.add_argument("--phase", choices=list(KILL_PHASES))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    if args.internal:
        root = Path(args.root)
        if args.internal == "kill":
            kill(root, args.phase)
            return 0
        print(json.dumps(recover(root)))
        return 0
    payload = run_probe()
    print(json.dumps(payload, indent=None if args.json else 2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
