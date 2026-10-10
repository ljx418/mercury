from __future__ import annotations

import hashlib
import json
import os
import stat
import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from navia_runtime.modules.media_companion.acquisition import (
    MediaAcquisitionCoordinator,
    MediaAcquisitionError,
    MediaAcquisitionRequest,
    TaskArtifactError,
    TaskArtifactSandbox,
)
from navia_runtime.modules.media_companion.acquisition.contracts import (
    AcquiredMedia,
    MediaIdentity,
    ResolvedSubtitle,
    SubtitleCandidate,
    SubtitleDiscoveryReceipt,
    SubtitleSegment,
)
from navia_runtime.modules.media_companion.credential_transport import MediaCredentialFailure


TASK_ID = "media_task_11111111111111111111111111111111"


def request(**changes) -> MediaAcquisitionRequest:
    values = {
        "task_id": TASK_ID,
        "source_identity": "portal:bilibili:BV1ZpYd66ELP:41828944992:1",
        "adapter_id": "bilibili",
        "media_id": "BV1ZpYd66ELP",
        "playback_unit_id": "41828944992",
        "part_id": "1",
        "consent_policy_id": "bilibili-media-consent/v1",
        "consent_policy_revision": 1,
    }
    values.update(changes)
    return MediaAcquisitionRequest(**values)


def test_sandbox_uses_random_private_directory_and_public_ref_has_no_path(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    sandbox.create(TASK_ID)
    directory = next((tmp_path / "tasks").iterdir())
    assert TASK_ID not in directory.name
    assert stat.S_IMODE(directory.stat().st_mode) == 0o700
    owner = directory / ".navia-owner.json"
    assert stat.S_IMODE(owner.stat().st_mode) == 0o600
    payload = b"RIFF-real-controlled-bytes"
    artifact = sandbox.write_bytes(TASK_ID, "audio", payload)
    assert artifact.byte_length == len(payload)
    assert artifact.sha256 == hashlib.sha256(payload).hexdigest()
    assert set(artifact.public_dict()) == {"artifactId", "kind", "byteLength", "sha256"}
    path = sandbox.private_path(TASK_ID, artifact)
    assert path.read_bytes() == payload
    assert stat.S_IMODE(path.stat().st_mode) == 0o600


def test_sandbox_rejects_paths_cross_task_links_and_quotas(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks", maximum_audio_bytes=4, maximum_video_bytes=8, maximum_task_bytes=8)
    sandbox.create(TASK_ID)
    with pytest.raises(TaskArtifactError) as traversal:
        sandbox.write_bytes(TASK_ID, "../audio", b"x")
    assert traversal.value.code == "V3_MEDIA_TASK_INVALID"
    with pytest.raises(TaskArtifactError) as quota:
        sandbox.write_bytes(TASK_ID, "audio", b"12345")
    assert quota.value.code == "V3_MEDIA_TASK_INVALID"
    artifact = sandbox.write_bytes(TASK_ID, "audio", b"1234")
    with pytest.raises(TaskArtifactError) as cumulative_quota:
        sandbox.write_bytes(TASK_ID, "audio", b"1")
    assert cumulative_quota.value.code == "V3_MEDIA_TASK_INVALID"
    other = "media_task_22222222222222222222222222222222"
    sandbox.create(other)
    with pytest.raises(TaskArtifactError) as cross_task:
        sandbox.private_path(other, artifact)
    assert cross_task.value.code == "V3_MEDIA_CROSS_TASK_REUSE"
    private_path = sandbox.private_path(TASK_ID, artifact)
    os.link(private_path, private_path.with_name("linked.wav"))
    with pytest.raises(TaskArtifactError) as unsafe:
        sandbox.cleanup(TASK_ID)
    assert unsafe.value.code == "V3_MEDIA_TEMP_FILE_MODE_INVALID"

    video_sandbox = TaskArtifactSandbox(tmp_path / "video-tasks", maximum_audio_bytes=4, maximum_video_bytes=8, maximum_task_bytes=8)
    video_sandbox.create(TASK_ID)
    video_sandbox.write_bytes(TASK_ID, "video", b"12345678")
    with pytest.raises(TaskArtifactError):
        video_sandbox.write_bytes(TASK_ID, "video", b"1")

    total_sandbox = TaskArtifactSandbox(tmp_path / "total-tasks", maximum_audio_bytes=4, maximum_video_bytes=8, maximum_task_bytes=8)
    total_sandbox.create(TASK_ID)
    total_sandbox.write_bytes(TASK_ID, "audio", b"1234")
    total_sandbox.write_bytes(TASK_ID, "video", b"1234")
    with pytest.raises(TaskArtifactError):
        total_sandbox.write_bytes(TASK_ID, "other", b"1")


def test_sandbox_rejects_file_symlink_during_cleanup(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    sandbox.create(TASK_ID)
    artifact = sandbox.write_bytes(TASK_ID, "audio", b"1234")
    private = sandbox.private_path(TASK_ID, artifact)
    (private.parent / "linked.wav").symlink_to(private)
    with pytest.raises(TaskArtifactError) as raised:
        sandbox.cleanup(TASK_ID)
    assert raised.value.code == "V3_MEDIA_TEMP_FILE_MODE_INVALID"


def test_startup_recovery_removes_only_valid_owned_orphans(tmp_path: Path):
    root = tmp_path / "tasks"
    first = TaskArtifactSandbox(root)
    first.create(TASK_ID)
    first.write_bytes(TASK_ID, "audio", b"real bytes")
    unknown = root / "user-data"
    unknown.mkdir(mode=0o700)
    (unknown / "keep.txt").write_text("keep", encoding="utf-8")
    linked = root / "task_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    linked.symlink_to(unknown, target_is_directory=True)
    restarted = TaskArtifactSandbox(root)
    assert restarted.recovered_orphan_count == 1
    assert unknown.is_dir() and (unknown / "keep.txt").read_text(encoding="utf-8") == "keep"
    assert linked.is_symlink()


def test_coordinator_is_idempotent_rejects_identity_conflict_and_cleans_after_hook(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    coordinator = MediaAcquisitionCoordinator(sandbox)
    created = coordinator.create(request())
    assert created["state"] == "created"
    assert coordinator.create(request()) == created
    assert sandbox.active_task_count() == 1
    with pytest.raises(MediaAcquisitionError) as conflict:
        coordinator.create(request(part_id="2"))
    assert conflict.value.code == "V3_MEDIA_TASK_INVALID"
    artifact = sandbox.write_bytes(TASK_ID, "audio", b"private real audio bytes")
    assert sandbox.private_path(TASK_ID, artifact).is_file()
    calls = []
    coordinator.register_cancel_hook(TASK_ID, lambda: calls.append("stopped"))
    cancelled = coordinator.cancel(TASK_ID)
    assert calls == ["stopped"]
    assert cancelled["state"] == "cancelled"
    assert cancelled["terminalAt"] is not None
    assert sandbox.active_task_count() == 0
    assert coordinator.cancel(TASK_ID) == cancelled
    assert calls == ["stopped"]


def test_cancel_hook_failure_never_reports_cancelled(tmp_path: Path):
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"))
    coordinator.create(request())

    def fail():
        raise RuntimeError("subprocess did not stop")

    coordinator.register_cancel_hook(TASK_ID, fail)
    with pytest.raises(MediaAcquisitionError) as raised:
        coordinator.cancel(TASK_ID)
    assert raised.value.code == "V3_MEDIA_CLEANUP_INCOMPLETE"
    task = coordinator.get(TASK_ID)
    assert task["state"] == "failed"
    assert task["failureCode"] == "V3_MEDIA_CLEANUP_INCOMPLETE"


def test_concurrent_cancel_uses_one_cleanup_and_one_terminal(tmp_path: Path):
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"))
    coordinator.create(request())
    coordinator.sandbox.write_bytes(TASK_ID, "other", b"private")
    entered = threading.Event()
    release = threading.Event()
    calls = []

    def cleanup_hook():
        calls.append("cleanup")
        entered.set()
        assert release.wait(timeout=2)

    coordinator.register_cancel_hook(TASK_ID, cleanup_hook)
    results = []
    threads = [threading.Thread(target=lambda: results.append(coordinator.cancel(TASK_ID)["state"])) for _ in range(2)]
    threads[0].start()
    assert entered.wait(timeout=2)
    threads[1].start()
    time.sleep(0.05)
    release.set()
    for thread in threads:
        thread.join(timeout=2)
    assert sorted(results) == ["cancelled", "cancelled"]
    assert calls == ["cleanup"]
    assert coordinator.get(TASK_ID)["state"] == "cancelled"
    assert coordinator.sandbox.active_task_count() == 0


@pytest.mark.parametrize(
    "changes",
    [
        {"adapter_id": "youtube"},
        {"source_identity": "portal:youtube:x:y:z"},
        {"source_identity": "portal:bilibili:OTHER:41828944992:1"},
        {"task_id": "../task"},
        {"consent_policy_revision": 2},
        {"consent_policy_id": "other-media-consent/v1"},
        {"part_id": ""},
    ],
)
def test_coordinator_rejects_out_of_contract_requests(tmp_path: Path, changes: dict):
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"))
    with pytest.raises(MediaAcquisitionError) as raised:
        coordinator.create(request(**changes))
    assert raised.value.code == "V3_MEDIA_TASK_INVALID"
    assert coordinator.active_task_count() == 0


def test_runtime_api_create_get_cancel_and_closed_request(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import navia_runtime.app as runtime_app

    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"))
    monkeypatch.setattr(runtime_app, "media_acquisition_coordinator", coordinator)
    client = TestClient(runtime_app.app)
    body = {
        "taskId": TASK_ID,
        "sourceIdentity": "portal:bilibili:BV1ZpYd66ELP:41828944992:1",
        "adapterId": "bilibili",
        "mediaId": "BV1ZpYd66ELP",
        "playbackUnitId": "41828944992",
        "partId": "1",
        "consentPolicyId": "bilibili-media-consent/v1",
        "consentPolicyRevision": 1,
    }
    created = client.post("/v1/media/acquisitions", json=body)
    assert created.status_code == 201
    assert created.headers["cache-control"] == "no-store"
    assert created.json()["data"]["task"]["state"] == "created"
    assert client.get(f"/v1/media/acquisitions/{TASK_ID}").json()["data"]["task"]["taskId"] == TASK_ID
    rejected = client.post("/v1/media/acquisitions", json=body | {"cookie": "secret"})
    assert rejected.status_code == 400
    assert rejected.json()["error"]["code"] == "V3_MEDIA_TASK_INVALID"
    cancelled = client.delete(f"/v1/media/acquisitions/{TASK_ID}")
    assert cancelled.status_code == 200
    assert cancelled.headers["cache-control"] == "no-store"
    assert cancelled.json()["data"]["task"]["state"] == "cancelled"
    missing = client.get("/v1/media/acquisitions/media_task_22222222222222222222222222222222")
    assert missing.status_code == 404


def test_default_media_roots_use_private_linux_cache(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    import navia_runtime.app as runtime_app

    cache_root = tmp_path / "cache"
    monkeypatch.delenv("NAVIA_MEDIA_TASK_ROOT", raising=False)
    monkeypatch.delenv("NAVIA_MEDIA_ASR_TASK_ROOT", raising=False)
    monkeypatch.setenv("XDG_CACHE_HOME", str(cache_root))

    assert runtime_app.default_media_task_root() == cache_root / "navia/media-tasks"
    assert runtime_app.default_media_asr_task_root() == cache_root / "navia/media-asr-tasks"


def test_execute_maps_task_artifact_failure_to_structured_response(monkeypatch: pytest.MonkeyPatch):
    import navia_runtime.app as runtime_app

    token = "runtime-token-" + "x" * 32
    origin = "chrome-extension://" + "a" * 32
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", "a" * 32)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", token)

    class BrokenCoordinator:
        def acquire_input(self, *args, **kwargs):
            raise TaskArtifactError(
                "V3_MEDIA_TEMP_FILE_MODE_INVALID",
                "Task directory is not a private owned directory.",
            )

    monkeypatch.setattr(runtime_app, "media_acquisition_coordinator", BrokenCoordinator())
    monkeypatch.setattr(runtime_app, "build_media_acquirers", lambda: {})
    response = TestClient(runtime_app.app).post(
        f"/v1/media/acquisitions/{TASK_ID}/execute",
        headers={"Origin": origin, "Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 500
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["error"] == {
        "code": "V3_MEDIA_TEMP_FILE_MODE_INVALID",
        "message": "Task directory is not a private owned directory.",
        "recoverable": False,
    }


class FakeLeaseStore:
    def __init__(self, *, fail=False):
        self.fail = fail

    def resolve_for_task(self, task_id, adapter_id):
        if self.fail:
            raise MediaCredentialFailure("V3_MEDIA_LEASE_REQUIRED", 403)
        assert task_id == TASK_ID and adapter_id == "bilibili"
        return [{"name": "SESSDATA", "value": "private"}]


class FakeAcquirer:
    def __init__(self, sandbox, *, candidates=True, subtitle_failure=False, audio_failure=None):
        self.sandbox = sandbox
        self.candidates = candidates
        self.subtitle_failure = subtitle_failure
        self.audio_failure = audio_failure
        self.calls = []

    def resolve_identity(self, media_id, playback_unit_id, part_id, credentials):
        self.calls.append("identity")
        return MediaIdentity("bilibili", media_id, playback_unit_id, part_id, 1, 1, 792)

    def probe_subtitles(self, identity, credentials):
        self.calls.append("probe")
        return (SubtitleCandidate("candidate", "zh", "中文", "https://private", "a" * 64),) if self.candidates else ()

    def probe_subtitles_with_receipt(self, identity, credentials):
        candidates = self.probe_subtitles(identity, credentials)
        return SubtitleDiscoveryReceipt(candidates, "9" * 64, "2026-10-07T00:00:00Z")

    def acquire_subtitle(self, identity, candidate, credentials):
        self.calls.append("subtitle")
        if self.subtitle_failure:
            raise MediaAcquisitionError("V3_MEDIA_SUBTITLE_UNAVAILABLE", "unavailable")
        segment = SubtitleSegment(0, 1000, "真实字幕", hashlib.sha256("真实字幕".encode()).hexdigest())
        return ResolvedSubtitle("zh", (segment,), "b" * 64, "c" * 64)

    def acquire_audio(self, task_id, identity, credentials):
        self.calls.append("audio")
        if self.audio_failure:
            raise MediaAcquisitionError(self.audio_failure, "audio unavailable")
        artifact = self.sandbox.write_bytes(task_id, "audio", b"RIFF-real-audio")
        return AcquiredMedia(identity, artifact, "wav-pcm-s16le", 16000, 1)


def test_coordinator_prefers_subtitle_and_is_idempotent(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    coordinator = MediaAcquisitionCoordinator(sandbox)
    coordinator.create(request())
    acquirer = FakeAcquirer(sandbox)
    first = coordinator.acquire_input(TASK_ID, lease_store=FakeLeaseStore(), acquirers={"bilibili": acquirer})
    second = coordinator.acquire_input(TASK_ID, lease_store=FakeLeaseStore(fail=True), acquirers={"bilibili": acquirer})
    assert first == second
    assert first["route"] == "credentialed_subtitle"
    assert acquirer.calls == ["identity", "probe", "subtitle"]
    assert sandbox.active_task_count() == 1


@pytest.mark.parametrize("candidates,subtitle_failure", [(False, False), (True, True)])
def test_coordinator_falls_back_to_real_audio_only_after_subtitle_unavailable(tmp_path: Path, candidates, subtitle_failure):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    coordinator = MediaAcquisitionCoordinator(sandbox)
    coordinator.create(request())
    acquirer = FakeAcquirer(sandbox, candidates=candidates, subtitle_failure=subtitle_failure)
    result = coordinator.acquire_input(TASK_ID, lease_store=FakeLeaseStore(), acquirers={"bilibili": acquirer})
    assert result["route"] == "credentialed_media_asr"
    assert result["artifact"]["sha256"] == hashlib.sha256(b"RIFF-real-audio").hexdigest()
    assert acquirer.calls[-1] == "audio"
    reference = coordinator.audio_reference(TASK_ID)
    assert reference.task_id == TASK_ID
    assert reference.source_identity == request().source_identity
    assert reference.artifact.sha256 == result["artifact"]["sha256"]
    assert reference.acquisition_record_id.startswith("mar_")
    if subtitle_failure:
        assert result["fallbackReasonCodes"] == ["V3_MEDIA_SUBTITLE_UNAVAILABLE"]
    cancelled = coordinator.cancel(TASK_ID)
    assert cancelled["state"] == "cancelled" and sandbox.active_task_count() == 0


def test_coordinator_missing_task_lease_fails_before_platform_call(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    coordinator = MediaAcquisitionCoordinator(sandbox)
    coordinator.create(request())
    acquirer = FakeAcquirer(sandbox)
    with pytest.raises(MediaAcquisitionError) as raised:
        coordinator.acquire_input(TASK_ID, lease_store=FakeLeaseStore(fail=True), acquirers={"bilibili": acquirer})
    assert raised.value.code == "V3_MEDIA_LEASE_REQUIRED"
    assert acquirer.calls == []
    assert coordinator.get(TASK_ID)["state"] == "failed"


def test_product_execution_preserves_expected_failures_for_public_subtitle_route(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    coordinator = MediaAcquisitionCoordinator(sandbox)
    coordinator.create(request())
    acquirer = FakeAcquirer(sandbox, candidates=False, audio_failure="V3_MEDIA_RUNTIME_OFFLINE")
    result = coordinator.acquire_input(
        TASK_ID,
        lease_store=FakeLeaseStore(),
        acquirers={"bilibili": acquirer},
        preserve_expected_failures=True,
    )
    assert result == {
        "outcome": "awaiting_public_subtitle",
        "input": None,
        "failures": [
            {"route": "credentialed_subtitle", "failureCode": "V3_MEDIA_SUBTITLE_UNAVAILABLE"},
            {"route": "credentialed_media_asr", "failureCode": "V3_MEDIA_RUNTIME_OFFLINE"},
        ],
    }
    assert coordinator.get(TASK_ID)["state"] == "acquiring"
    assert coordinator.acquire_input(
        TASK_ID,
        lease_store=FakeLeaseStore(fail=True),
        acquirers={"bilibili": acquirer},
        preserve_expected_failures=True,
    ) == result
    eligibility = coordinator.record_route_failure(TASK_ID, "public_or_page_subtitle", "V3_MEDIA_SUBTITLE_UNAVAILABLE")
    assert eligibility["captureFallbackEligible"] is True
    assert coordinator.get(TASK_ID)["state"] == "acquiring"


def test_audio_reference_rejects_subtitle_and_missing_inputs(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    coordinator = MediaAcquisitionCoordinator(sandbox)
    coordinator.create(request())
    with pytest.raises(MediaAcquisitionError) as missing:
        coordinator.audio_reference(TASK_ID)
    assert missing.value.code == "V3_MEDIA_TRANSCRIPT_AUDIO_UNAVAILABLE"
    coordinator.acquire_input(TASK_ID, lease_store=FakeLeaseStore(), acquirers={"bilibili": FakeAcquirer(sandbox)})
    with pytest.raises(MediaAcquisitionError) as subtitle:
        coordinator.audio_reference(TASK_ID)
    assert subtitle.value.code == "V3_MEDIA_TRANSCRIPT_AUDIO_UNAVAILABLE"


def test_execute_endpoint_starts_transcript_for_audio_route(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import navia_runtime.app as runtime_app

    token = "runtime-token-" + "x" * 32
    origin = "chrome-extension://" + "a" * 32
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", "a" * 32)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", token)
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    coordinator = MediaAcquisitionCoordinator(sandbox)
    coordinator.create(request())
    acquirer = FakeAcquirer(sandbox, candidates=False)

    class TranscriptStub:
        def __init__(self):
            self.reference = None

        def create(self, transcript_request):
            self.reference = transcript_request.audio
            return {"taskId": transcript_request.audio.task_id, "state": "queued"}

        def start(self, task_id):
            return {"taskId": task_id, "state": "queued"}

    transcript = TranscriptStub()
    monkeypatch.setattr(runtime_app, "media_acquisition_coordinator", coordinator)
    monkeypatch.setattr(runtime_app, "media_credential_lease_store", FakeLeaseStore())
    monkeypatch.setattr(runtime_app, "media_transcript_service", transcript)
    monkeypatch.setattr(runtime_app, "build_media_acquirers", lambda: {"bilibili": acquirer})
    response = TestClient(runtime_app.app).post(
        f"/v1/media/acquisitions/{TASK_ID}/execute",
        headers={"Origin": origin, "Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["input"]["route"] == "credentialed_media_asr"
    assert data["transcript"] == {"taskId": TASK_ID, "state": "queued"}
    assert transcript.reference.task_id == TASK_ID
    assert transcript.reference.source_identity == request().source_identity
