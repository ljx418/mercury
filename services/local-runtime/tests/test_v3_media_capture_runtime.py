from __future__ import annotations

import wave
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from navia_runtime.modules.media_companion.acquisition.capture_grants import (
    MediaCaptureFailure,
    MediaCaptureGrantService,
)
from navia_runtime.modules.media_companion.acquisition.capture_sink import (
    CaptureSinkFailure,
    RuntimeCaptureSink,
)
from navia_runtime.modules.media_companion.acquisition.task_artifacts import TaskArtifactSandbox
from navia_runtime.modules.media_companion.acquisition.coordinator import MediaAcquisitionCoordinator, MediaAcquisitionRequest, MediaAcquisitionError


TASK_ID = "media_task_" + "1" * 32
BINDING = {
    "taskId": TASK_ID,
    "adapterId": "bilibili",
    "pageIdentitySha256": "2" * 64,
    "tabId": 7,
    "tabIdSha256": "3" * 64,
    "surface": "side_panel",
}


def test_capture_grant_is_private_bound_one_shot_and_expires():
    clock = [datetime(2026, 10, 7, tzinfo=timezone.utc)]
    service = MediaCaptureGrantService(now=lambda: clock[0])
    ticket, public = service.issue(BINDING)
    assert len(ticket) >= 43
    assert set(public).isdisjoint({"ticket", "tabId", "streamId", "absolutePath"})
    assert public["oneShot"] is True and public["persisted"] is False
    assert service.consume(ticket, BINDING)["state"] == "consumed"
    with pytest.raises(MediaCaptureFailure, match="V3_MEDIA_CAPTURE_TICKET_REPLAYED"):
        service.consume(ticket, BINDING)

    ticket, _ = service.issue(BINDING)
    clock[0] += timedelta(seconds=31)
    with pytest.raises(MediaCaptureFailure, match="V3_MEDIA_CAPTURE_TICKET_EXPIRED"):
        service.consume(ticket, BINDING)


@pytest.mark.parametrize("field,value", [
    ("taskId", "media_task_" + "4" * 32),
    ("adapterId", "youtube"),
    ("pageIdentitySha256", "5" * 64),
    ("tabId", 8),
    ("tabIdSha256", "6" * 64),
    ("surface", "workspace"),
])
def test_capture_grant_rejects_every_binding_mismatch(field, value):
    service = MediaCaptureGrantService()
    ticket, _ = service.issue(BINDING)
    with pytest.raises(MediaCaptureFailure, match="V3_MEDIA_CAPTURE_BINDING_MISMATCH"):
        service.consume(ticket, {**BINDING, field: value})
    with pytest.raises(MediaCaptureFailure, match="V3_MEDIA_CAPTURE_TICKET_REPLAYED"):
        service.consume(ticket, BINDING)


def test_capture_sink_writes_private_pcm_wave_and_rejects_reordering(tmp_path):
    sandbox = TaskArtifactSandbox(tmp_path / "media")
    sink = RuntimeCaptureSink(sandbox)
    grant = {"grantId": "mcg_" + "7" * 32, "taskId": TASK_ID}
    sink.begin(
        task_id=TASK_ID,
        source_identity="bilibili:BV1ZpYd66ELP:p1",
        acquisition_record_id="mar_" + "8" * 32,
        grant=grant,
        sample_rate_hz=16_000,
        channels=1,
        sample_width_bytes=2,
    )
    with pytest.raises(CaptureSinkFailure, match="V3_MEDIA_CAPTURE_ALREADY_ACTIVE"):
        sink.begin(
            task_id=TASK_ID, source_identity="same", acquisition_record_id="same", grant=grant,
            sample_rate_hz=16_000, channels=1, sample_width_bytes=2,
        )
    with pytest.raises(CaptureSinkFailure, match="V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID"):
        sink.write(1, b"\x00\x00")
    payload = b"\x01\x00" * 16_000
    observation = sink.write(0, payload)
    assert observation["sequence"] == 0 and observation["byteLength"] == len(payload)
    reference, receipt = sink.finalize()
    assert receipt["capturedMs"] == 1000 and receipt["chunkCount"] == 1
    assert receipt["nonZeroSampleCount"] == 16_000 and receipt["peakAbsSample"] == 1
    with wave.open(str(sandbox.private_path(TASK_ID, reference.artifact)), "rb") as reader:
        assert (reader.getframerate(), reader.getnchannels(), reader.getsampwidth(), reader.getnframes()) == (16_000, 1, 2, 16_000)
    assert sink.active_count() == 0


def test_capture_sink_rejects_acoustically_empty_pcm(tmp_path):
    sandbox = TaskArtifactSandbox(tmp_path / "media")
    sink = RuntimeCaptureSink(sandbox)
    sink.begin(
        task_id=TASK_ID,
        source_identity="bilibili:BV1ZpYd66ELP:p1",
        acquisition_record_id="mar_" + "8" * 32,
        grant={"grantId": "mcg_" + "7" * 32},
        sample_rate_hz=16_000,
        channels=1,
        sample_width_bytes=2,
    )
    sink.write(0, b"\x00\x00" * 16_000)
    with pytest.raises(CaptureSinkFailure, match="V3_MEDIA_CAPTURE_EMPTY"):
        sink.finalize()
    assert sink.active_count() == 0


def test_capture_sink_abort_removes_private_staging_file(tmp_path):
    sandbox = TaskArtifactSandbox(tmp_path / "media")
    sink = RuntimeCaptureSink(sandbox)
    sink.begin(
        task_id=TASK_ID,
        source_identity="bilibili:BV1ZpYd66ELP:p1",
        acquisition_record_id="mar_" + "8" * 32,
        grant={"grantId": "mcg_" + "7" * 32},
        sample_rate_hz=16_000,
        channels=1,
        sample_width_bytes=2,
    )
    sink.write(0, b"\x00\x00" * 32)
    assert sink.abort() == {"sinkClosed": True, "activeCaptureCount": 0, "residualRawAudioCount": 0}
    task_files = [path.name for path in (next((tmp_path / "media").iterdir())).iterdir()]
    assert not any(name.startswith(".stage_") for name in task_files)


def test_capture_http_and_websocket_require_exact_origin_and_complete_once(monkeypatch, tmp_path):
    import navia_runtime.app as runtime_app

    token = "runtime-token-" + "x" * 32
    origin = "chrome-extension://" + "a" * 32
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", "a" * 32)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", token)
    monkeypatch.setattr(runtime_app, "media_capture_grant_service", MediaCaptureGrantService())
    sandbox = TaskArtifactSandbox(tmp_path / "media")
    monkeypatch.setattr(runtime_app, "media_acquisition_coordinator", MediaAcquisitionCoordinator(sandbox))
    monkeypatch.setattr(runtime_app, "runtime_capture_sink", RuntimeCaptureSink(sandbox))
    runtime_app.media_acquisition_coordinator.create(MediaAcquisitionRequest(
        task_id=TASK_ID,
        source_identity="portal:bilibili:BV1ZpYd66ELP:cid:1",
        adapter_id="bilibili",
        media_id="BV1ZpYd66ELP",
        playback_unit_id="cid",
        part_id="1",
        consent_policy_id="bilibili-media-consent/v1",
        consent_policy_revision=1,
    ))
    for route in ("credentialed_subtitle", "credentialed_media_asr", "public_or_page_subtitle"):
        runtime_app.media_acquisition_coordinator.record_route_failure(TASK_ID, route, "V3_MEDIA_SUBTITLE_UNAVAILABLE")

    class TranscriptStub:
        def create(self, request):
            return {"taskId": request.audio.task_id, "state": "queued"}

        def start(self, task_id):
            return {"taskId": task_id, "state": "succeeded", "result": {"status": "succeeded"}}

    monkeypatch.setattr(runtime_app, "media_transcript_service", TranscriptStub())
    client = TestClient(runtime_app.app)
    response = client.post(
        "/v1/media/capture-grants",
        json=BINDING,
        headers={"Origin": origin, "Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert "ticket" in data and "ticket" not in data["grant"] and "tabId" not in data["grant"]

    start = {
        "type": "start",
        "ticket": data["ticket"],
        **BINDING,
        "sourceIdentity": "bilibili:BV1ZpYd66ELP:p1",
        "acquisitionRecordId": "mar_" + "8" * 32,
        "sampleRateHz": 16_000,
        "channels": 1,
        "sampleWidthBytes": 2,
    }
    with client.websocket_connect("/v1/media/capture-stream", headers={"Origin": origin}) as socket:
        socket.send_json(start)
        assert socket.receive_json()["type"] == "started"
        socket.send_bytes(b"\x01\x00" * 16_000)
        assert socket.receive_json()["observation"]["sequence"] == 0
        socket.send_json({"type": "stop", "reason": "completed"})
        completed = socket.receive_json()
        assert completed["type"] == "completed"
        assert completed["capture"]["capturedMs"] == 1000
        assert completed["transcript"]["state"] == "succeeded"
        assert completed["stop"]["activeCaptureCount"] == 0

    with client.websocket_connect("/v1/media/capture-stream", headers={"Origin": origin}) as socket:
        socket.send_json(start)
        assert socket.receive_json()["failureCode"] == "V3_MEDIA_CAPTURE_TICKET_REPLAYED"


def test_capture_grant_endpoint_rejects_generic_and_wrong_origin(monkeypatch):
    import navia_runtime.app as runtime_app

    token = "runtime-token-" + "x" * 32
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", "a" * 32)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", token)
    monkeypatch.setattr(runtime_app, "media_capture_grant_service", MediaCaptureGrantService())
    client = TestClient(runtime_app.app)
    missing = client.post("/v1/media/capture-grants", json=BINDING)
    assert missing.status_code == 401
    wrong = client.post(
        "/v1/media/capture-grants",
        json=BINDING,
        headers={"Origin": "chrome-extension://" + "b" * 32, "Authorization": f"Bearer {token}"},
    )
    assert wrong.status_code == 403


def test_capture_eligibility_requires_three_ordered_machine_failures(tmp_path):
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "media"))
    coordinator.create(MediaAcquisitionRequest(
        task_id=TASK_ID,
        source_identity="portal:bilibili:BV1ZpYd66ELP:cid:1",
        adapter_id="bilibili",
        media_id="BV1ZpYd66ELP",
        playback_unit_id="cid",
        part_id="1",
        consent_policy_id="bilibili-media-consent/v1",
        consent_policy_revision=1,
    ))
    with pytest.raises(MediaAcquisitionError) as error:
        coordinator.record_route_failure(TASK_ID, "credentialed_media_asr", "V3_MEDIA_PLATFORM_REJECTED")
    assert error.value.code == "V3_MEDIA_ROUTE_ORDER_INVALID"
    for index, route in enumerate(("credentialed_subtitle", "credentialed_media_asr", "public_or_page_subtitle")):
        result = coordinator.record_route_failure(TASK_ID, route, "V3_MEDIA_PLATFORM_REJECTED")
        assert result["captureFallbackEligible"] is (index == 2)
    task = coordinator.bind_capture_grant(TASK_ID, "mcg_" + "9" * 32)
    assert task["captureGrantId"] == "mcg_" + "9" * 32
