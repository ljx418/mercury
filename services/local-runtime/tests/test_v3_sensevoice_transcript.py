from __future__ import annotations

import io
import os
import threading
import time
import wave
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from navia_runtime.modules.media_companion.acquisition import (
    AcquisitionAudioRef,
    AudioStagingError,
    TaskArtifactSandbox,
    TaskAudioStager,
    SenseVoiceTranscriptService,
    TranscriptTask,
)
from navia_runtime.modules.media_companion.acquisition.transcript_lineage import (
    TranscriptLineageEntry,
    TranscriptLineageManifest,
)
from navia_runtime.modules.media_companion.acquisition.transcript_validator import validate_transcript
from navia_runtime.modules.media_companion.asr.provider import AsrProviderError, RawAsrTranscript


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


def test_task_audio_stager_copies_exact_private_pcm_and_cleans(tmp_path: Path) -> None:
    sandbox, reference = make_audio(tmp_path)
    stager = TaskAudioStager(sandbox, tmp_path / "asr")
    audio, receipt = stager.stage(reference)
    target = tmp_path / "asr" / TASK / audio.relative_path
    assert target.is_file()
    assert target.stat().st_nlink == 1
    assert target.stat().st_mode & 0o077 == 0
    assert receipt.source_sha256 == receipt.staged_sha256 == reference.artifact.sha256
    assert receipt.byte_length == reference.artifact.byte_length
    assert (receipt.sample_rate_hz, receipt.channels, receipt.sample_width_bytes, receipt.duration_ms) == (16000, 1, 2, 100)
    assert stager.cleanup(TASK) == {"removed": True, "residualCount": 0}
    assert sandbox.private_path(TASK, reference.artifact).is_file()


def test_task_audio_stager_rejects_cross_task_mutation_and_existing_root(tmp_path: Path) -> None:
    sandbox, reference = make_audio(tmp_path)
    stager = TaskAudioStager(sandbox, tmp_path / "asr")
    wrong = AcquisitionAudioRef(
        **{**reference.__dict__, "task_id": "media_task_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
    )
    with pytest.raises(AudioStagingError) as cross_task:
        stager.stage(wrong)
    assert cross_task.value.code == "V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE"

    source = sandbox.private_path(TASK, reference.artifact)
    source.write_bytes(source.read_bytes() + b"mutated")
    with pytest.raises(AudioStagingError) as mutation:
        stager.stage(reference)
    assert mutation.value.code == "V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE"

    sandbox.cleanup(TASK)
    sandbox, reference = make_audio(tmp_path / "second")
    stager = TaskAudioStager(sandbox, tmp_path / "second" / "asr")
    (tmp_path / "second" / "asr" / TASK).mkdir()
    with pytest.raises(AudioStagingError) as existing:
        stager.stage(reference)
    assert existing.value.code == "V3_MEDIA_TRANSCRIPT_TASK_INVALID"


def test_task_audio_stager_rejects_hardlinked_source(tmp_path: Path) -> None:
    sandbox, reference = make_audio(tmp_path)
    source = sandbox.private_path(TASK, reference.artifact)
    os.link(source, tmp_path / "alias.wav")
    with pytest.raises(AudioStagingError) as raised:
        TaskAudioStager(sandbox, tmp_path / "asr").stage(reference)
    assert raised.value.code == "V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE"


def test_transcript_validator_requires_sensevoice_vad_count_and_strict_srt(tmp_path: Path) -> None:
    _, audio = make_audio(tmp_path)
    raw = RawAsrTranscript(
        provider_id="funasr_edge_local",
        model_id="funasr-sensevoice-small-q8",
        task_id=TASK,
        format="srt",
        text="1\n00:00:00,000 --> 00:00:00,100\nhello\n",
        elapsed_seconds=0.1,
        vad_segment_count=1,
    )
    result = validate_transcript(raw, audio)
    assert result.speech_interval_count == len(result.candidate.segments) == 1
    assert result.speech_duration_ms == 100
    assert result.coverage_ratio == 1.0
    assert len(result.content_sha256) == 64

    with pytest.raises(AsrProviderError) as mismatch:
        validate_transcript(RawAsrTranscript(**{**raw.__dict__, "vad_segment_count": 2}), audio)
    assert mismatch.value.code == "V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE"


def test_lineage_manifest_rejects_slot_or_cross_run_drift() -> None:
    entries = tuple(
        TranscriptLineageEntry(
            sample_id=sample,
            bvid=bvid,
            task_id=f"media_task_{index + 1:032x}",
            source_identity=f"portal:bilibili:{bvid}:{100 + index}:part-1",
            acquisition_record_id=f"mar_{index + 11:032x}",
            audio_sha256=f"{index + 21:064x}",
            transcript_sha256=f"{index + 31:064x}",
        )
        for index, (sample, bvid) in enumerate(
            (("v3-sample-07", "BV13W41137qV"), ("v3-sample-08", "BV1ZpYd66ELP"), ("v3-sample-09", "BV1pW421c7DH"))
        )
    )
    manifest = TranscriptLineageManifest(
        run_id="v3-2-3-sensevoice-20261007T120000Z",
        source_run_id="v3-2-route-b3-20261007T014759Z",
        source_content_sha256="66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea",
        entries=entries,
    )
    manifest.validate()
    TranscriptLineageManifest(
        run_id="v3-2-3-sensevoice-20261008T010203Z",
        source_run_id="v3-2-route-b3-20261008T010203Z",
        source_content_sha256="a" * 64,
        entries=tuple(entries),
    ).validate()
    with pytest.raises(ValueError, match="V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH"):
        TranscriptLineageManifest(**{**manifest.__dict__, "cross_run_artifact_count": 1}).validate()
    with pytest.raises(ValueError, match="V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH"):
        TranscriptLineageManifest(**{**manifest.__dict__, "source_run_id": "v3-2-production-20261008T010203Z"}).validate()
    with pytest.raises(ValueError, match="V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH"):
        TranscriptLineageManifest(**{**manifest.__dict__, "source_content_sha256": "a" * 63}).validate()
    with pytest.raises(ValueError, match="V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH"):
        TranscriptLineageManifest(**{**manifest.__dict__, "entries": tuple(reversed(entries))}).validate()


class FakeSenseVoiceProvider:
    provider_id = "funasr_edge_local"
    model_id = "funasr-sensevoice-small-q8"

    def __init__(self, *, failure: str | None = None) -> None:
        self.failure = failure
        self.closed = False

    def load(self) -> None:
        return None

    def self_test(self, audio, *, cancel_event=None):
        return self.transcribe(audio, timeout=1, cancel_event=cancel_event)

    def transcribe(self, audio, *, timeout, cancel_event=None):
        if self.failure:
            raise AsrProviderError(self.failure, "fake failure")
        return RawAsrTranscript(
            provider_id=self.provider_id,
            model_id=self.model_id,
            task_id=audio.task_id,
            format="srt",
            text="1\n00:00:00,000 --> 00:00:00,100\nhello\n",
            elapsed_seconds=0.1,
            vad_segment_count=1,
        )

    def close(self) -> None:
        self.closed = True


def test_transcript_service_publishes_only_after_double_cleanup(tmp_path: Path) -> None:
    sandbox, audio = make_audio(tmp_path)
    providers: list[FakeSenseVoiceProvider] = []

    def factory() -> FakeSenseVoiceProvider:
        provider = FakeSenseVoiceProvider()
        providers.append(provider)
        return provider

    service = SenseVoiceTranscriptService(
        TaskAudioStager(sandbox, tmp_path / "asr"),
        factory,
        sandbox.cleanup,
    )
    created = service.create(TranscriptTask(audio))
    assert created["state"] == "queued"
    result = service.run(TASK)
    assert result["state"] == "succeeded"
    assert result["coverage"]["coverageRatio"] == 1.0
    assert result["result"]["segmentCount"] == 1
    assert result["result"]["failureCode"] is None
    assert providers[0].closed is True
    assert sandbox.active_task_count() == 0
    assert not (tmp_path / "asr" / TASK).exists()
    assert service.private_segments(TASK)[0]["text"] == "hello"
    terminal_count = sum(item["phase"] == "completed" for item in result["progress"])
    assert terminal_count == 1
    assert service.run(TASK) == result


def test_transcript_service_cancel_and_native_failure_are_single_terminal(tmp_path: Path) -> None:
    sandbox, audio = make_audio(tmp_path / "cancel")
    service = SenseVoiceTranscriptService(
        TaskAudioStager(sandbox, tmp_path / "cancel" / "asr"),
        FakeSenseVoiceProvider,
        sandbox.cleanup,
    )
    service.create(TranscriptTask(audio))
    cancelled = service.cancel(TASK)
    assert cancelled["state"] == "cancelled"
    assert cancelled["result"]["failureCode"] == "V3_MEDIA_TRANSCRIPT_CANCELLED"
    assert service.cancel(TASK) == cancelled
    assert sandbox.active_task_count() == 0


def test_transcript_service_cancels_running_provider_and_cleans_once(tmp_path: Path) -> None:
    sandbox, audio = make_audio(tmp_path)
    started = threading.Event()

    class BlockingProvider(FakeSenseVoiceProvider):
        def transcribe(self, audio, *, timeout, cancel_event=None):
            started.set()
            while cancel_event is not None and not cancel_event.wait(0.01):
                time.sleep(0.001)
            raise AsrProviderError("V3_ASR_PROCESS_CANCELLED", "cancelled")

    service = SenseVoiceTranscriptService(
        TaskAudioStager(sandbox, tmp_path / "asr"),
        BlockingProvider,
        sandbox.cleanup,
    )
    service.create(TranscriptTask(audio))
    service.start(TASK)
    assert started.wait(2)
    in_flight = service.cancel(TASK)
    assert in_flight["state"] == "transcribing"
    terminal = service.wait(TASK, 2)
    assert terminal["state"] == "cancelled"
    assert terminal["result"]["failureCode"] == "V3_MEDIA_TRANSCRIPT_CANCELLED"
    assert sum(item["phase"] == "cancelled" for item in terminal["progress"]) == 1
    assert sandbox.active_task_count() == 0
    assert not (tmp_path / "asr" / TASK).exists()


@pytest.mark.parametrize(
    ("provider_code", "public_code"),
    (
        ("V3_ASR_PROCESS_TIMEOUT", "V3_MEDIA_TRANSCRIPT_PROCESS_TIMEOUT"),
        ("V3_ASR_PROCESS_FAILED", "V3_MEDIA_TRANSCRIPT_PROCESS_FAILED"),
        ("V3_ASR_PROCESS_START_FAILED", "V3_MEDIA_TRANSCRIPT_PROCESS_FAILED"),
        ("V3_ASR_PROCESS_OUTPUT_LIMIT", "V3_MEDIA_TRANSCRIPT_OUTPUT_LIMIT"),
        ("V3_ASR_VAD_RECEIPT_INVALID", "V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE"),
    ),
)
def test_transcript_service_maps_native_faults_to_closed_public_codes(
    tmp_path: Path,
    provider_code: str,
    public_code: str,
) -> None:
    sandbox, audio = make_audio(tmp_path)
    service = SenseVoiceTranscriptService(
        TaskAudioStager(sandbox, tmp_path / "asr"),
        lambda: FakeSenseVoiceProvider(failure=provider_code),
        sandbox.cleanup,
    )
    service.create(TranscriptTask(audio))
    terminal = service.run(TASK)
    assert terminal["state"] == "failed"
    assert terminal["result"]["failureCode"] == public_code
    assert terminal["result"]["transcriptId"] is None
    assert sandbox.active_task_count() == 0


@pytest.mark.parametrize(
    ("text", "vad_count", "public_code"),
    (
        ("", 1, "V3_MEDIA_TRANSCRIPT_EMPTY"),
        ("not-srt", 1, "V3_MEDIA_TRANSCRIPT_INVALID"),
        ("1\n00:00:00,000 --> 00:00:00,100\nhello\n", 2, "V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE"),
    ),
)
def test_transcript_service_rejects_empty_invalid_and_vad_mismatch(
    tmp_path: Path,
    text: str,
    vad_count: int,
    public_code: str,
) -> None:
    sandbox, audio = make_audio(tmp_path)

    class OutputProvider(FakeSenseVoiceProvider):
        def transcribe(self, audio, *, timeout, cancel_event=None):
            return RawAsrTranscript(
                provider_id=self.provider_id,
                model_id=self.model_id,
                task_id=audio.task_id,
                format="srt",
                text=text,
                elapsed_seconds=0.1,
                vad_segment_count=vad_count,
            )

    service = SenseVoiceTranscriptService(
        TaskAudioStager(sandbox, tmp_path / "asr"),
        OutputProvider,
        sandbox.cleanup,
    )
    service.create(TranscriptTask(audio))
    terminal = service.run(TASK)
    assert terminal["state"] == "failed"
    assert terminal["result"]["failureCode"] == public_code
    assert terminal["result"]["segmentCount"] == 0
    assert sandbox.active_task_count() == 0

    sandbox, audio = make_audio(tmp_path / "failed")
    service = SenseVoiceTranscriptService(
        TaskAudioStager(sandbox, tmp_path / "failed" / "asr"),
        lambda: FakeSenseVoiceProvider(failure="V3_ASR_PROCESS_TIMEOUT"),
        sandbox.cleanup,
    )
    service.create(TranscriptTask(audio))
    failed = service.run(TASK)
    assert failed["state"] == "failed"
    assert failed["result"]["failureCode"] == "V3_MEDIA_TRANSCRIPT_PROCESS_TIMEOUT"
    assert failed["result"]["transcriptId"] is None
    assert sandbox.active_task_count() == 0


class FakeRuntimeTranscriptService:
    def __init__(self) -> None:
        self.request = None
        self.state = "queued"

    def create(self, request):
        self.request = request
        return {"taskId": request.audio.task_id, "state": self.state}

    def start(self, task_id):
        return {"taskId": task_id, "state": self.state}

    def get(self, task_id):
        if task_id != TASK:
            raise AsrProviderError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "missing")
        return {"taskId": task_id, "state": self.state, "result": None}

    def private_segments(self, task_id):
        return ({"segmentId": "srt-1", "startMs": 0, "endMs": 100, "text": "local"},)

    def cancel(self, task_id):
        self.state = "cancelled"
        return {"taskId": task_id, "state": self.state}


def test_runtime_transcript_api_is_closed_and_does_not_accept_private_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    import navia_runtime.app as runtime_app

    service = FakeRuntimeTranscriptService()
    monkeypatch.setattr(runtime_app, "media_transcript_service", service)
    client = TestClient(runtime_app.app)
    body = {
        "taskId": TASK,
        "sourceIdentity": SOURCE,
        "acquisitionRecordId": "mar_22222222222222222222222222222222",
        "artifact": {
            "artifactId": "artifact_33333333333333333333333333333333",
            "kind": "audio",
            "byteLength": 3244,
            "sha256": "a" * 64,
        },
        "durationMs": 100,
        "sampleRateHz": 16000,
        "channels": 1,
        "sampleWidthBytes": 2,
    }
    created = client.post("/v1/media/transcripts", json=body)
    assert created.status_code == 202
    assert created.headers["cache-control"] == "no-store"
    assert service.request.audio.source_identity == SOURCE
    assert "path" not in created.text.lower() and "stderr" not in created.text.lower()
    rejected = client.post("/v1/media/transcripts", json=body | {"cookie": "forbidden"})
    assert rejected.status_code == 404
    assert rejected.json()["error"]["code"] == "V3_MEDIA_TRANSCRIPT_TASK_INVALID"
    fetched = client.get(f"/v1/media/transcripts/{TASK}")
    assert fetched.status_code == 200 and "segments" not in fetched.json()["data"]
    cancelled = client.delete(f"/v1/media/transcripts/{TASK}")
    assert cancelled.status_code == 200
    missing = client.get("/v1/media/transcripts/media_task_99999999999999999999999999999999")
    assert missing.status_code == 404
