"""WP0 R1 — Runtime ownership barrier proof.

Proves the two frozen Runtime-side invariants required by
``05-wp0-relay-acceptance.md`` R1 ("worker 不早启、owner 唯一"):

1. The asynchronous transcript worker cannot start before the synchronous
   ``TaskAudioStager.stage()`` barrier has committed the durable ownership
   receipt. A barrier failure must leave no worker, no receipt and no
   ownership transfer.
2. Cleanup ownership is single and hands over exactly once: before the
   barrier the Runtime capture handler owns the acquisition sandbox; after
   it the transcript service owns staged audio and the sandbox. Recovery
   never trusts process memory — it re-validates the manifest and the
   durable receipt, and fails closed when either is missing or mismatched.

These tests are Runtime-only. No Chrome, and no audio is produced or played:
the fixtures are silent PCM WAV bytes written to disk.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import sqlite3
import wave
from pathlib import Path

import pytest

from navia_runtime.modules.media_companion.acquisition import (
    AcquisitionAudioRef,
    AudioStagingError,
    SenseVoiceTranscriptService,
    TaskArtifactSandbox,
    TaskAudioStager,
    TranscriptTask,
)
from navia_runtime.modules.media_companion.acquisition.audio_ref import process_start_token

TASK = "media_task_11111111111111111111111111111111"
SOURCE = "portal:bilibili:BV13W41137qV:123:part-1"


def wav_bytes(*, frames: int = 1600) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(16000)
        writer.writeframes(b"\x01\x00" * frames)
    return output.getvalue()


def make_audio(tmp_path: Path) -> tuple[TaskArtifactSandbox, AcquisitionAudioRef]:
    sandbox = TaskArtifactSandbox(tmp_path / "acquisition")
    sandbox.create(TASK)
    artifact = sandbox.write_bytes(TASK, "audio", wav_bytes())
    return sandbox, AcquisitionAudioRef(
        task_id=TASK,
        source_identity=SOURCE,
        acquisition_record_id="mar_22222222222222222222222222222222",
        artifact=artifact,
        duration_ms=100,
        sample_rate_hz=16000,
        channels=1,
        sample_width_bytes=2,
    )


def make_service(
    tmp_path: Path,
    sandbox: TaskArtifactSandbox,
    stager: TaskAudioStager,
    ran: list[str],
) -> SenseVoiceTranscriptService:
    class _Provider:
        def transcribe(self, audio, timeout=None, cancel_event=None):
            ran.append(audio.task_id)
            return None

        def close(self) -> None:
            return None

    return SenseVoiceTranscriptService(
        stager=stager,
        provider_factory=lambda: _Provider(),
        acquisition_cleanup=lambda task_id: {"removed": True, "residualCount": 0},
    )


def receipt_rows(tmp_path: Path, stager: TaskAudioStager) -> int:
    with sqlite3.connect(stager.receipt_db_path) as connection:
        return int(
            connection.execute(
                "SELECT COUNT(*) FROM media_capture_owner_receipts WHERE task_id=?", (TASK,)
            ).fetchone()[0]
        )


# ---------------------------------------------------------------------------
# 1. worker 不早启
# ---------------------------------------------------------------------------


def test_worker_cannot_start_before_the_ownership_receipt_is_committed(tmp_path: Path) -> None:
    """The durable receipt exists by the time ``create`` returns, and only a
    worker started afterwards ever runs ASR."""
    sandbox, reference = make_audio(tmp_path)
    stager = TaskAudioStager(sandbox, tmp_path / "asr")
    ran: list[str] = []
    service = make_service(tmp_path, sandbox, stager, ran)

    public = service.create(TranscriptTask(reference))

    receipt = stager.receipt(TASK)
    assert receipt is not None
    assert receipt["state"] == "ownership_committed"
    assert receipt["taskId"] == TASK
    assert ran == [], "no worker may have run during create()"
    assert public["state"] == "queued"

    service.start(public["taskId"])
    service.wait(public["taskId"], timeout=5)


def test_barrier_failure_leaves_no_worker_no_receipt_and_no_staged_audio(tmp_path: Path) -> None:
    """A barrier failure aborts before any worker or receipt can exist."""
    sandbox, reference = make_audio(tmp_path)
    # Corrupt the published digest so the barrier fails closed.
    tampered = AcquisitionAudioRef(
        task_id=reference.task_id,
        source_identity=reference.source_identity,
        acquisition_record_id=reference.acquisition_record_id,
        artifact=reference.artifact.__class__(
            artifact_id=reference.artifact.artifact_id,
            task_id=reference.artifact.task_id,
            kind=reference.artifact.kind,
            byte_length=reference.artifact.byte_length,
            sha256="0" * 64,
        ),
        duration_ms=reference.duration_ms,
        sample_rate_hz=reference.sample_rate_hz,
        channels=reference.channels,
        sample_width_bytes=reference.sample_width_bytes,
    )
    stager = TaskAudioStager(sandbox, tmp_path / "asr")
    ran: list[str] = []
    service = make_service(tmp_path, sandbox, stager, ran)

    with pytest.raises(Exception):
        service.create(TranscriptTask(tampered))

    assert stager.receipt(TASK) is None, "no receipt may be committed after a barrier failure"
    assert ran == [], "no worker may run when the barrier failed"
    assert not (tmp_path / "asr" / TASK).exists(), "no staged audio may survive a barrier failure"


def test_ownership_manifest_is_canonical_and_bound_to_the_durable_receipt(tmp_path: Path) -> None:
    """The manifest bytes are canonical and its digest is the receipt digest."""
    sandbox, reference = make_audio(tmp_path)
    stager = TaskAudioStager(sandbox, tmp_path / "asr")
    stager.stage(reference)

    owner_path = tmp_path / "asr" / TASK / "owner.json"
    raw = owner_path.read_bytes()
    owner = json.loads(raw)
    canonical = json.dumps(owner, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    assert raw == canonical, "the manifest on disk must be the canonical serialization"

    receipt = stager.receipt(TASK)
    assert receipt is not None
    assert receipt["manifestSha256"] == hashlib.sha256(canonical).hexdigest()

    leftovers = [item.name for item in (tmp_path / "asr" / TASK).iterdir() if item.name.startswith("owner.json.tmp")]
    assert leftovers == [], f"no temporary manifest may survive the atomic replace: {leftovers}"


# ---------------------------------------------------------------------------
# 2. owner 唯一
# ---------------------------------------------------------------------------


def test_cleanup_owner_hands_over_exactly_once_after_the_barrier(tmp_path: Path) -> None:
    """After the barrier the transcript service owns the staged audio; a
    repeat cleanup is idempotent rather than a second cleanup owner."""
    sandbox, reference = make_audio(tmp_path)
    stager = TaskAudioStager(sandbox, tmp_path / "asr")
    stager.stage(reference)

    owner = json.loads((tmp_path / "asr" / TASK / "owner.json").read_text())
    assert owner["taskId"] == TASK
    assert owner["pid"] == os.getpid()
    assert owner["processStartToken"] == process_start_token(os.getpid())
    assert owner["state"] == "staged"

    assert stager.cleanup(TASK) == {"removed": True, "residualCount": 0}
    assert stager.cleanup(TASK) == {"removed": False, "residualCount": 0}
    assert receipt_rows(tmp_path, stager) == 0, "the receipt is released exactly once"


def test_recovery_cleanup_requires_the_authoritative_receipt(tmp_path: Path) -> None:
    """Recovery never trusts process memory: a missing receipt fails closed."""
    sandbox, reference = make_audio(tmp_path)
    stager = TaskAudioStager(sandbox, tmp_path / "asr")
    stager.stage(reference)

    with sqlite3.connect(stager.receipt_db_path) as connection:
        connection.execute("DELETE FROM media_capture_owner_receipts WHERE task_id=?", (TASK,))

    with pytest.raises(AudioStagingError) as excinfo:
        stager.recover_cleanup(TASK)
    assert excinfo.value.code == "V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE"


def test_recovery_cleanup_rejects_a_tampered_manifest(tmp_path: Path) -> None:
    """A manifest that no longer matches its receipt digest fails closed."""
    sandbox, reference = make_audio(tmp_path)
    stager = TaskAudioStager(sandbox, tmp_path / "asr")
    stager.stage(reference)

    owner_path = tmp_path / "asr" / TASK / "owner.json"
    owner = json.loads(owner_path.read_text())
    owner["byteLength"] = owner["byteLength"] + 2
    owner_path.write_text(json.dumps(owner))

    with pytest.raises(AudioStagingError) as excinfo:
        stager.recover_cleanup(TASK)
    assert excinfo.value.code == "V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE"
