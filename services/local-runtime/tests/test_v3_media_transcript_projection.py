from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from fastapi.testclient import TestClient

from navia_runtime.modules.media_companion.acquisition import (
    MediaAcquisitionCoordinator,
    MediaAcquisitionRequest,
    TaskArtifactSandbox,
)
from navia_runtime.modules.media_companion.asr import AsrProviderError
from navia_runtime.modules.media_companion.transcript_projection import MediaTranscriptProjectionService


TASK = "media_task_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
SOURCE = "portal:bilibili:BV1ZpYd66ELP:41828944992:1"


class FakeTranscripts:
    def __init__(self) -> None:
        self.task = None

    def get(self, task_id: str):
        if self.task is None:
            raise AsrProviderError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "missing")
        return self.task

    def private_segments(self, task_id: str):
        return ({"segmentId": "seg_1", "startMs": 0, "endMs": 800, "text": "真实转写"},)


def create_coordinator(tmp_path: Path) -> MediaAcquisitionCoordinator:
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"))
    coordinator.create(MediaAcquisitionRequest(
        task_id=TASK,
        source_identity=SOURCE,
        adapter_id="bilibili",
        media_id="BV1ZpYd66ELP",
        playback_unit_id="41828944992",
        part_id="1",
        consent_policy_id="bilibili-media-consent/v1",
        consent_policy_revision=1,
    ))
    return coordinator


def test_projection_is_single_closed_set_authority_with_monotonic_revision(tmp_path: Path):
    coordinator = create_coordinator(tmp_path)
    transcripts = FakeTranscripts()
    service = MediaTranscriptProjectionService(coordinator, transcripts)
    first = service.get(TASK)
    assert first["state"] == "created"
    assert first["resources"] is None
    assert first["revision"] == 1
    assert service.get(TASK)["revision"] == 1

    for route in ("credentialed_subtitle", "credentialed_media_asr", "public_or_page_subtitle"):
        coordinator.record_route_failure(TASK, route, "V3_MEDIA_SUBTITLE_UNAVAILABLE")
    awaiting = service.latest_for_source(SOURCE)
    assert awaiting["state"] == "awaiting_trusted_capture"
    assert awaiting["revision"] == 2
    assert len(awaiting["failures"]) == 3

    coordinator.bind_capture_grant(TASK, "mcg_11111111111111111111111111111111")
    transcripts.task = {
        "taskId": TASK,
        "state": "transcribing",
        "progress": [{"percent": 40, "observedAt": "2026-10-07T15:00:00Z"}],
        "result": None,
        "resources": {
            "cpuCoreLimit": 8,
            "memoryLimitBytes": 8 * 1024**3,
            "temporaryDiskPeakBytes": 4 * 1024**2,
            "gpuUsed": False,
        },
    }
    active = service.get(TASK)
    assert active["state"] == "transcribing"
    assert active["route"] == "trusted_tab_capture_asr"
    assert active["progressPercent"] == 40
    assert active["resources"]["temporaryDiskPeakBytes"] == 4 * 1024**2
    assert active["resources"] is not transcripts.task["resources"]
    assert active["revision"] == 3

    transcripts.task = {
        "taskId": TASK,
        "state": "succeeded",
        "progress": [{"percent": 100, "observedAt": "2026-10-07T15:01:00Z"}],
        "result": {"failureCode": None},
        "resources": transcripts.task["resources"],
    }
    terminal = service.get(TASK)
    assert terminal["state"] == "succeeded"
    assert terminal["terminal"] is True
    assert terminal["cleanupStatus"] == "complete"
    assert terminal["segments"][0]["text"] == "真实转写"
    assert terminal["revision"] == 4
    assert not ({"credentialLeaseId", "captureGrantId", "artifact", "ticket", "streamId"} & set(terminal))


def test_projection_schema_accepts_runtime_shape(tmp_path: Path):
    root = Path(__file__).resolve().parents[3]
    schema = json.loads((root / "docs/active/project/contracts/v3_media_transcript_projection_v1.schema.json").read_text())
    Draft202012Validator.check_schema(schema)
    coordinator = create_coordinator(tmp_path)
    projection = MediaTranscriptProjectionService(coordinator, FakeTranscripts()).get(TASK)
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(projection)


def test_projection_api_requires_companion_session_and_supports_source_resume(tmp_path: Path, monkeypatch):
    import navia_runtime.app as runtime_app

    extension_id = "a" * 32
    origin = f"chrome-extension://{extension_id}"
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", extension_id)
    runtime_app.companion_session_broker.clear()
    coordinator = create_coordinator(tmp_path)
    projection = MediaTranscriptProjectionService(coordinator, FakeTranscripts())
    monkeypatch.setattr(runtime_app, "media_transcript_projection_service", projection)
    client = TestClient(runtime_app.app)

    denied = client.get(f"/v1/media/task-projections/{TASK}")
    assert denied.status_code == 401
    session = client.post("/v1/companion/sessions", headers={"Origin": origin}).json()["data"]
    headers = {"Authorization": f"Bearer {session['token']}"}
    by_task = client.get(f"/v1/media/task-projections/{TASK}", headers=headers)
    assert by_task.status_code == 200
    assert by_task.headers["cache-control"] == "no-store"
    assert by_task.json()["data"]["projection"]["taskId"] == TASK
    by_source = client.get("/v1/media/task-projections", params={"sourceIdentity": SOURCE}, headers=headers)
    assert by_source.status_code == 200
    assert by_source.json()["data"]["projection"]["sourceIdentity"] == SOURCE
    wrong_origin = client.get(
        f"/v1/media/task-projections/{TASK}",
        headers={**headers, "Origin": "chrome-extension://" + "b" * 32},
    )
    assert wrong_origin.status_code == 403
