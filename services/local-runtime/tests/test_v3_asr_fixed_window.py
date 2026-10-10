from __future__ import annotations

import hashlib
import os
import threading
import wave
from dataclasses import fields
from pathlib import Path

import pytest

from navia_runtime.modules.media_companion.asr import (
    AsrProviderError,
    FixedWindowAsrOrchestrator,
    FixedWindowPlan,
    RawAsrTranscript,
    TaskAudioRef,
)


def write_source(
    tasks: Path,
    task_id: str,
    *,
    frame_count: int = 1_920_000,
    channels: int = 1,
) -> tuple[TaskAudioRef, str]:
    root = tasks / task_id
    root.mkdir(parents=True)
    path = root / "source.wav"
    frame = b"\x01\x00" * channels
    with wave.open(str(path), "wb") as writer:
        writer.setnchannels(channels)
        writer.setsampwidth(2)
        writer.setframerate(16_000)
        writer.writeframes(frame * frame_count)
    path.chmod(0o600)
    return TaskAudioRef(task_id=task_id, relative_path="source.wav"), hashlib.sha256(path.read_bytes()).hexdigest()


class RecordingProvider:
    provider_id = "funasr_edge_local"
    model_id = "funasr-paraformer-q8"

    def __init__(self, tasks: Path, *, fail_at: int | None = None, invalid_at: int | None = None):
        self.tasks = tasks
        self.fail_at = fail_at
        self.invalid_at = invalid_at
        self.calls: list[int] = []
        self.chunk_hashes: list[str] = []
        self.frame_counts: list[int] = []
        self.last_payloads: list[bytes] = []
        self.active = 0
        self.max_active = 0

    def load(self) -> None:
        pass

    def close(self) -> None:
        pass

    def self_test(self, audio: TaskAudioRef, *, cancel_event=None):
        return self.transcribe(audio, timeout=1, cancel_event=cancel_event)

    def transcribe(self, audio: TaskAudioRef, *, timeout: float, cancel_event=None) -> RawAsrTranscript:
        index = int(audio.task_id.rsplit("-", 1)[1])
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            path = self.tasks / audio.task_id / audio.relative_path
            data = path.read_bytes()
            self.chunk_hashes.append(hashlib.sha256(data).hexdigest())
            with wave.open(str(path), "rb") as reader:
                self.frame_counts.append(reader.getnframes())
                payload = reader.readframes(reader.getnframes())
                self.last_payloads.append(payload[-8:])
            self.calls.append(index)
            if cancel_event is not None and cancel_event.is_set():
                raise AsrProviderError("V3_ASR_PROCESS_CANCELLED", "cancelled")
            if self.fail_at == index:
                raise AsrProviderError("V3_ASR_PROCESS_FAILED", "failed")
            end = 15001 if self.invalid_at == index else 1000
            return RawAsrTranscript(
                provider_id=self.provider_id,
                model_id=self.model_id,
                task_id=audio.task_id,
                format="srt",
                text=f"1\n00:00:00,000 --> 00:00:{end // 1000:02d},{end % 1000:03d}\nchunk-{index}\n",
                elapsed_seconds=0.001,
            )
        finally:
            self.active -= 1


def run_once(tasks: Path, provider: RecordingProvider, task_id: str, *, frames: int = 1_920_000):
    audio, source_hash = write_source(tasks, task_id, frame_count=frames)
    orchestrator = FixedWindowAsrOrchestrator(tasks, provider)
    return orchestrator.transcribe(
        audio,
        expected_source_sha256=source_hash,
        attempt_id="attempt_0123456789abcdef",
        timeout_per_chunk=2,
    )


def test_fixed_window_contract_has_no_portal_fields():
    names = {field.name.lower() for field in fields(FixedWindowPlan)}
    assert not names & {"bvid", "cid", "cookie", "portal", "youtube", "xiaohongshu"}
    FixedWindowPlan().validate()
    with pytest.raises(AsrProviderError) as raised:
        FixedWindowPlan(chunk_duration_ms=14_000).validate()
    assert raised.value.code == "V3_ASR_FW_CHUNK_PLAN_DRIFT"


def test_deterministic_eight_chunk_sequence_merge_and_cleanup(tmp_path: Path):
    tasks = tmp_path / "tasks"
    tasks.mkdir()
    first_provider = RecordingProvider(tasks)
    first = run_once(tasks, first_provider, "source-a")
    second_provider = RecordingProvider(tasks)
    second = run_once(tasks, second_provider, "source-b")

    assert first_provider.calls == list(range(8))
    assert first_provider.max_active == 1
    assert first_provider.frame_counts == [240_000] * 8
    assert first_provider.chunk_hashes == second_provider.chunk_hashes
    assert [item.chunk_sha256 for item in first.chunks] == first_provider.chunk_hashes
    assert [segment.start_ms for segment in first.transcript.segments] == [index * 15_000 for index in range(8)]
    assert [segment.text for segment in first.transcript.segments] == [f"chunk-{index}" for index in range(8)]
    assert len({segment.segment_id for segment in first.transcript.segments}) == 8
    assert first.transcript.duration_ms == 120_000
    assert first.transcript.task_id == "source-a"
    assert not any(tasks.iterdir())


def test_three_frame_tail_padding_is_final_only_and_hashed(tmp_path: Path):
    tasks = tmp_path / "tasks"
    tasks.mkdir()
    provider = RecordingProvider(tasks)
    result = run_once(tasks, provider, "source-short", frames=1_919_997)
    assert result.source_frame_count == 1_919_997
    assert result.tail_pad_frames == 3
    assert provider.frame_counts == [240_000] * 8
    assert provider.last_payloads[-1][-6:] == b"\x00" * 6
    assert all(payload[-6:] != b"\x00" * 6 for payload in provider.last_payloads[:-1])


@pytest.mark.parametrize("frame_count", (1_919_983, 1_920_001))
def test_frame_count_outside_tail_policy_fails_closed(tmp_path: Path, frame_count: int):
    tasks = tmp_path / "tasks"
    tasks.mkdir()
    provider = RecordingProvider(tasks)
    with pytest.raises(AsrProviderError) as raised:
        run_once(tasks, provider, f"source-{frame_count}", frames=frame_count)
    assert raised.value.code == "V3_ASR_FW_AUDIO_FORMAT_INVALID"
    assert provider.calls == []
    assert not any(tasks.iterdir())


def test_source_hash_format_and_link_inputs_are_rejected(tmp_path: Path):
    tasks = tmp_path / "tasks"
    tasks.mkdir()
    provider = RecordingProvider(tasks)
    audio, _ = write_source(tasks, "hash-mismatch")
    orchestrator = FixedWindowAsrOrchestrator(tasks, provider)
    with pytest.raises(AsrProviderError) as raised:
        orchestrator.transcribe(
            audio,
            expected_source_sha256="0" * 64,
            attempt_id="attempt_0123456789abcdef",
            timeout_per_chunk=2,
        )
    assert raised.value.code == "V3_ASR_FW_SOURCE_DENOMINATOR_CHANGED"
    assert not any(tasks.iterdir())

    audio, source_hash = write_source(tasks, "stereo", channels=2)
    with pytest.raises(AsrProviderError) as raised:
        orchestrator.transcribe(
            audio,
            expected_source_sha256=source_hash,
            attempt_id="attempt_0123456789abcdef",
            timeout_per_chunk=2,
        )
    assert raised.value.code == "V3_ASR_FW_AUDIO_FORMAT_INVALID"
    assert not any(tasks.iterdir())

    original, _ = write_source(tasks, "link-original")
    linked_root = tasks / "link-task"
    linked_root.mkdir()
    os.link(tasks / original.task_id / original.relative_path, linked_root / "source.wav")
    linked_hash = hashlib.sha256((linked_root / "source.wav").read_bytes()).hexdigest()
    with pytest.raises(AsrProviderError) as raised:
        orchestrator.transcribe(
            TaskAudioRef("link-task", "source.wav"),
            expected_source_sha256=linked_hash,
            attempt_id="attempt_0123456789abcdef",
            timeout_per_chunk=2,
        )
    assert raised.value.code == "V3_ASR_AUDIO_FILE_UNSAFE"
    for child in list(tasks.iterdir()):
        if child.is_dir():
            for path in child.iterdir():
                path.unlink()
            child.rmdir()


def test_failure_stops_current_attempt_and_fresh_attempt_restarts_zero(tmp_path: Path):
    tasks = tmp_path / "tasks"
    tasks.mkdir()
    failing = RecordingProvider(tasks, fail_at=3)
    with pytest.raises(AsrProviderError) as raised:
        run_once(tasks, failing, "source-fail")
    assert raised.value.code == "V3_ASR_PROCESS_FAILED"
    assert failing.calls == [0, 1, 2, 3]
    assert not any(tasks.iterdir())

    succeeding = RecordingProvider(tasks)
    result = run_once(tasks, succeeding, "source-retry")
    assert succeeding.calls == list(range(8))
    assert len(result.chunks) == 8


def test_invalid_local_timestamps_and_cancel_fail_closed(tmp_path: Path):
    tasks = tmp_path / "tasks"
    tasks.mkdir()
    invalid = RecordingProvider(tasks, invalid_at=2)
    with pytest.raises(AsrProviderError) as raised:
        run_once(tasks, invalid, "source-invalid")
    assert raised.value.code == "V3_ASR_FW_LOCAL_TIMESTAMP_INVALID"
    assert not any(tasks.iterdir())

    audio, source_hash = write_source(tasks, "source-cancel")
    cancelled = threading.Event()
    cancelled.set()
    with pytest.raises(AsrProviderError) as raised:
        FixedWindowAsrOrchestrator(tasks, RecordingProvider(tasks)).transcribe(
            audio,
            expected_source_sha256=source_hash,
            attempt_id="attempt_0123456789abcdef",
            timeout_per_chunk=2,
            cancel_event=cancelled,
        )
    assert raised.value.code == "V3_ASR_PROCESS_CANCELLED"
    assert not any(tasks.iterdir())


def test_cleanup_failure_overrides_success(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    tasks = tmp_path / "tasks"
    tasks.mkdir()
    provider = RecordingProvider(tasks)
    audio, source_hash = write_source(tasks, "source-cleanup")
    orchestrator = FixedWindowAsrOrchestrator(tasks, provider)
    original_remove = orchestrator._remove_owned_task

    def fail_source(root: Path) -> None:
        if root.name == "source-cleanup":
            raise OSError("injected cleanup failure")
        original_remove(root)

    monkeypatch.setattr(orchestrator, "_remove_owned_task", fail_source)
    with pytest.raises(AsrProviderError) as raised:
        orchestrator.transcribe(
            audio,
            expected_source_sha256=source_hash,
            attempt_id="attempt_0123456789abcdef",
            timeout_per_chunk=2,
        )
    assert raised.value.code == "V3_ASR_FW_PRIVATE_DATA_RETAINED"
    original_remove(tasks / "source-cleanup")
