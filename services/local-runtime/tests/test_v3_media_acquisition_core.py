from __future__ import annotations

import hashlib
import json
import os
import select
import stat
import subprocess
import sys
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
from navia_runtime.modules.media_companion.asr.provider import AsrProviderError
from navia_runtime.modules.media_companion.task_store import MediaTaskStore, MediaTaskStoreError


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
    live = TaskArtifactSandbox(root)
    assert live.recovered_orphan_count == 0
    owner_path = first._task_roots[TASK_ID] / ".navia-owner.json"
    owner = json.loads(owner_path.read_text(encoding="utf-8"))
    owner.update(ownerPid=999_999_999, ownerStart="1")
    owner_path.write_text(json.dumps(owner), encoding="utf-8")
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


def test_resolve_concurrent_surfaces_share_one_authoritative_source_task(tmp_path: Path):
    from concurrent.futures import ThreadPoolExecutor

    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"))
    candidates = [request(task_id=f"media_task_{index:032x}") for index in range(1, 17)]
    with ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(coordinator.resolve, candidates))
    assert [item["disposition"] for item in results].count("created") == 1
    assert [item["disposition"] for item in results].count("attached") == 15
    assert len({item["authoritativeTaskId"] for item in results}) == 1
    assert coordinator.active_task_count() == 1
    assert coordinator.sandbox.active_task_count() == 1
    with pytest.raises(MediaAcquisitionError) as legacy_collision:
        coordinator.create(request(task_id="media_task_" + "f" * 32))
    assert legacy_collision.value.code == "V3_MEDIA_SOURCE_TASK_ACTIVE"


def test_authority_reservation_failure_leaves_no_half_created_task(tmp_path: Path):
    class BrokenAuthority:
        def source_authority(self, source_identity):
            return None

        def adopt_published_source(self, *args):
            return None

        def reserve_source_authority(self, *args):
            raise OSError("database unavailable")

    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    coordinator = MediaAcquisitionCoordinator(sandbox, authority_store=BrokenAuthority())
    with pytest.raises(OSError, match="database unavailable"):
        coordinator.resolve(request())
    assert sandbox.active_task_count() == 0
    assert coordinator.active_task_count() == 0


def test_resolve_separates_source_parts_and_rejects_changed_policy(tmp_path: Path):
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"))
    first = coordinator.resolve(request())
    other_part = coordinator.resolve(request(
        task_id="media_task_" + "2" * 32,
        source_identity="portal:bilibili:BV1ZpYd66ELP:41828944993:2",
        playback_unit_id="41828944993", part_id="2",
    ))
    assert first["disposition"] == other_part["disposition"] == "created"
    assert first["authoritativeTaskId"] != other_part["authoritativeTaskId"]
    coordinator._adapter_policies["bilibili"] = ("bilibili-media-consent/v2", 2)
    with pytest.raises(MediaAcquisitionError) as conflict:
        coordinator.resolve(request(
            task_id="media_task_" + "3" * 32,
            consent_policy_id="bilibili-media-consent/v2", consent_policy_revision=2,
        ))
    assert conflict.value.code == "V3_MEDIA_SOURCE_POLICY_CONFLICT"
    assert coordinator.active_task_count() == 2


def test_same_source_retry_requires_terminal_cleanup(tmp_path: Path):
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    coordinator = MediaAcquisitionCoordinator(sandbox, authority_store=store)
    first = coordinator.resolve(request())
    retry = request(task_id="media_task_" + "2" * 32)
    assert coordinator.resolve(retry)["disposition"] == "attached"
    assert coordinator.resolve(retry)["authoritativeTaskId"] == first["authoritativeTaskId"]
    assert coordinator.source_authority(request().source_identity) == {
        "taskId": TASK_ID, "state": "active", "adapterId": "bilibili",
        "consentPolicyId": "bilibili-media-consent/v1", "consentPolicyRevision": 1,
        "policyProvenance": "verified_current",
    }
    coordinator.cancel(TASK_ID)
    assert sandbox.active_task_count() == 0
    assert store.source_authority(request().source_identity)["state"] == "cancelled"
    next_task = coordinator.resolve(retry)
    assert next_task["disposition"] == "created"
    assert next_task["authoritativeTaskId"] == retry.task_id
    assert store.source_authority(request().source_identity)["task_id"] == retry.task_id


def test_resolve_restart_restores_only_policy_matched_published_task(tmp_path: Path):
    from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    first = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "first"), authority_store=store)
    assert first.resolve(request())["disposition"] == "created"

    class Projection:
        def get(self, task_id):
            return {
                "taskId": task_id, "sourceIdentity": request().source_identity,
                "state": "succeeded", "terminal": True,
                "segments": [{"startMs": 0, "endMs": 1_000, "text": "真实字幕"}],
            }

    restarted_before_publish = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "before"), authority_store=store)
    assert restarted_before_publish.source_authority(request().source_identity)["state"] == "active_elsewhere"
    with pytest.raises(MediaAcquisitionError) as uncertain:
        restarted_before_publish.resolve(request(task_id="media_task_" + "2" * 32))
    assert uncertain.value.code == "V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN"
    MediaProductMaterializer(store, Projection(), tmp_path / "evidence").materialize(TASK_ID)
    restarted = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "after"), authority_store=store)
    published = restarted.resolve(request(task_id="media_task_" + "3" * 32))
    assert published["disposition"] == "published"
    assert published["authoritativeTaskId"] == TASK_ID
    assert published["publishedRevision"] == store.get(TASK_ID)["revision"]
    assert restarted.active_task_count() == 0
    with store._lock:
        store._conn.execute(
            "UPDATE media_source_authority SET state='active' WHERE task_id=?", (TASK_ID,)
        )
    recovered = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "recover"), authority_store=store)
    assert recovered.resolve(request(task_id="media_task_" + "5" * 32))["disposition"] == "published"
    assert store.source_authority(request().source_identity)["state"] == "published"
    restarted._adapter_policies["bilibili"] = ("bilibili-media-consent/v2", 2)
    with pytest.raises(MediaAcquisitionError) as wrong_policy:
        restarted.resolve(request(
            task_id="media_task_" + "4" * 32,
            consent_policy_id="bilibili-media-consent/v2", consent_policy_revision=2,
        ))
    assert wrong_policy.value.code == "V3_MEDIA_SOURCE_POLICY_CONFLICT"


def test_explicit_policy_switch_preserves_history_and_isolates_source_reads(tmp_path: Path):
    from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    coordinator = MediaAcquisitionCoordinator(sandbox, authority_store=store)
    coordinator.resolve(request())

    class Projection:
        def get(self, task_id):
            return {
                "taskId": task_id, "sourceIdentity": request().source_identity,
                "state": "succeeded", "terminal": True,
                "segments": [{"startMs": 0, "endMs": 1_000, "text": "真实字幕"}],
            }

    MediaProductMaterializer(store, Projection(), tmp_path / "evidence").materialize(TASK_ID)
    old = store.get(TASK_ID)
    old_outline = old["projections"]["outline"]
    coordinator._adapter_policies["bilibili"] = ("bilibili-media-consent/v2", 2)
    next_request = request(
        task_id="media_task_" + "2" * 32,
        consent_policy_id="bilibili-media-consent/v2", consent_policy_revision=2,
    )
    with pytest.raises(MediaAcquisitionError) as conflict:
        coordinator.resolve(next_request)
    assert conflict.value.code == "V3_MEDIA_SOURCE_POLICY_CONFLICT"
    with pytest.raises(MediaAcquisitionError) as missing_confirmation:
        coordinator.replace_published_policy(
            next_request, old_task_id=TASK_ID, old_policy_id="bilibili-media-consent/v1",
            old_policy_revision=1, confirmation="",
        )
    assert missing_confirmation.value.code == "V3_MEDIA_POLICY_SWITCH_INVALID"
    assert store.latest_for_source(request().source_identity)["taskId"] == TASK_ID

    switched = coordinator.replace_published_policy(
        next_request, old_task_id=TASK_ID, old_policy_id="bilibili-media-consent/v1",
        old_policy_revision=1, confirmation="reanalyze_under_current_policy",
    )
    assert switched["disposition"] == "created"
    assert switched["authoritativeTaskId"] == next_request.task_id
    assert store.source_authority(request().source_identity)["task_id"] == next_request.task_id
    assert store.latest_for_source(request().source_identity)["taskId"] == next_request.task_id
    assert store.latest_for_source(request().source_identity)["projections"] is None
    assert store.latest_for_source(request().source_identity)["policyContext"]["status"] == "current"
    assert coordinator.latest_for_source(request().source_identity)["taskId"] == next_request.task_id
    coordinator._tasks[TASK_ID]["startedAt"] = "9999-01-01T00:00:00Z"
    assert coordinator.resolve(next_request)["authoritativeTaskId"] == next_request.task_id
    assert store.get(TASK_ID)["projections"]["outline"] == old_outline
    assert store.get(TASK_ID)["revision"] == old["revision"]
    assert store.get(TASK_ID)["policyContext"] == {
        "status": "historical", "consentPolicyId": "bilibili-media-consent/v1", "consentPolicyRevision": 1,
    }
    with pytest.raises(MediaTaskStoreError) as historical_write:
        store.require_current_authority(TASK_ID)
    assert historical_write.value.code == "V3_MEDIA_HISTORICAL_READ_ONLY"
    assert coordinator.replace_published_policy(
        next_request, old_task_id=TASK_ID, old_policy_id="bilibili-media-consent/v1",
        old_policy_revision=1, confirmation="reanalyze_under_current_policy",
    )["disposition"] == "replayed"
    restarted_store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    restarted = MediaAcquisitionCoordinator(sandbox, authority_store=restarted_store)
    restarted._adapter_policies["bilibili"] = ("bilibili-media-consent/v2", 2)
    replay = restarted.replace_published_policy(
        next_request, old_task_id=TASK_ID, old_policy_id="bilibili-media-consent/v1",
        old_policy_revision=1, confirmation="reanalyze_under_current_policy",
    )
    assert replay == {"disposition": "replayed", "authoritativeTaskId": next_request.task_id, "task": None}
    assert store.source_authority(request().source_identity)["task_id"] == next_request.task_id
    restarted_store.close()
    with pytest.raises(MediaAcquisitionError) as obsolete_policy:
        coordinator.resolve(request(task_id="media_task_" + "4" * 32))
    assert obsolete_policy.value.code == "V3_MEDIA_TASK_INVALID"
    sandbox_count_before_stale = sandbox.active_task_count()
    with pytest.raises(MediaAcquisitionError) as stale:
        coordinator.replace_published_policy(
            request(task_id="media_task_" + "3" * 32, consent_policy_id="bilibili-media-consent/v2", consent_policy_revision=2),
            old_task_id=TASK_ID, old_policy_id="bilibili-media-consent/v1",
            old_policy_revision=1, confirmation="reanalyze_under_current_policy",
        )
    assert stale.value.code == "V3_MEDIA_SOURCE_POLICY_CONFLICT"
    assert sandbox.active_task_count() == sandbox_count_before_stale
    new_product = MediaProductMaterializer(store, Projection(), tmp_path / "evidence").materialize(next_request.task_id)
    assert new_product["state"] == "degraded"
    assert store.latest_for_source(request().source_identity)["taskId"] == next_request.task_id


def test_policy_switch_api_rejects_unconfirmed_and_extra_fields(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import navia_runtime.app as runtime_app
    from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"), authority_store=store)
    coordinator.resolve(request())

    class Projection:
        def get(self, task_id):
            return {
                "taskId": task_id, "sourceIdentity": request().source_identity,
                "state": "succeeded", "terminal": True,
                "segments": [{"startMs": 0, "endMs": 1_000, "text": "真实字幕"}],
            }

    MediaProductMaterializer(store, Projection(), tmp_path / "evidence").materialize(TASK_ID)
    coordinator._adapter_policies["bilibili"] = ("bilibili-media-consent/v2", 2)
    monkeypatch.setattr(runtime_app, "media_acquisition_coordinator", coordinator)
    monkeypatch.setattr(runtime_app, "media_outline_task_store", store)
    from navia_runtime.modules.media_companion.transcript_projection import MediaTranscriptProjectionService
    monkeypatch.setattr(runtime_app, "media_transcript_projection_service", MediaTranscriptProjectionService(
        coordinator, runtime_app.media_transcript_service, store,
    ))
    extension_id = "a" * 32
    origin = f"chrome-extension://{extension_id}"
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", extension_id)
    runtime_app.companion_session_broker.clear()
    client = TestClient(runtime_app.app)
    token = runtime_app.companion_session_broker.issue(origin)["token"]
    headers = {"Origin": origin, "Authorization": f"Bearer {token}"}
    path = "/v1/media/acquisitions/replace-policy"
    body = {
        "taskId": "media_task_" + "2" * 32, "sourceIdentity": request().source_identity,
        "adapterId": "bilibili", "mediaId": "BV1ZpYd66ELP",
        "playbackUnitId": "41828944992", "partId": "1",
        "consentPolicyId": "bilibili-media-consent/v2", "consentPolicyRevision": 2,
        "expectedPreviousTaskId": TASK_ID,
        "expectedPreviousConsentPolicyId": "bilibili-media-consent/v1",
        "expectedPreviousConsentPolicyRevision": 1,
        "confirmation": "reanalyze_under_current_policy",
    }
    assert client.post(path, json=body, headers={"Origin": origin}).status_code == 401
    assert client.post(path, json=body | {"cookie": "private"}, headers=headers).status_code == 400
    denied = client.post(path, json=body | {"confirmation": ""}, headers=headers)
    assert denied.status_code == 400
    assert denied.json()["error"]["code"] == "V3_MEDIA_POLICY_SWITCH_INVALID"
    assert store.source_authority(request().source_identity)["task_id"] == TASK_ID
    switched = client.post(path, json=body, headers=headers)
    assert switched.status_code == 201
    assert switched.headers["cache-control"] == "no-store"
    assert switched.json()["data"]["authoritativeTaskId"] == body["taskId"]
    assert "private" not in switched.text.lower()
    for operation, payload in [
        ("ask", {"expectedRevision": store.get(TASK_ID)["revision"], "question": "这段讲什么？"}),
        ("exports", {"expectedRevision": store.get(TASK_ID)["revision"], "format": "json_bundle"}),
    ]:
        rejected = client.post(f"/v1/media/outline-tasks/{TASK_ID}/{operation}", json=payload, headers=headers)
        assert rejected.status_code == 409
        assert rejected.json()["error"]["code"] == "V3_MEDIA_HISTORICAL_READ_ONLY"
    replay = client.post(path, json=body, headers=headers)
    assert replay.status_code == 200
    assert replay.json()["data"]["disposition"] == "replayed"
    current = client.get(f"/v1/media/outline-tasks?sourceIdentity={request().source_identity}", headers=headers)
    assert current.status_code == 200
    assert current.json()["data"]["task"]["taskId"] == body["taskId"]
    assert current.json()["data"]["task"]["projections"] is None
    transcript = client.get(f"/v1/media/task-projections?sourceIdentity={request().source_identity}", headers=headers)
    assert transcript.status_code == 200
    assert transcript.json()["data"]["projection"]["taskId"] == body["taskId"]
    assert store.get(TASK_ID)["policyContext"]["status"] == "historical"
    restarted_store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    restarted_coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"), authority_store=restarted_store)
    restarted_coordinator._adapter_policies["bilibili"] = ("bilibili-media-consent/v2", 2)
    monkeypatch.setattr(runtime_app, "media_acquisition_coordinator", restarted_coordinator)
    after_restart = client.post(path, json=body, headers=headers)
    assert after_restart.status_code == 200
    assert after_restart.json()["data"] == {
        "disposition": "replayed", "authoritativeTaskId": body["taskId"], "task": None,
    }
    assert restarted_store.source_authority(request().source_identity)["task_id"] == body["taskId"]
    restarted_store.close()


def test_policy_switch_two_sqlite_connections_select_one_authority(tmp_path: Path):
    from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer

    db = tmp_path / "runtime.sqlite3"
    first_store = MediaTaskStore(db)
    second_store = MediaTaskStore(db)
    first = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "first"), authority_store=first_store)
    second = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "second"), authority_store=second_store)
    first.resolve(request())

    class Projection:
        def get(self, task_id):
            return {
                "taskId": task_id, "sourceIdentity": request().source_identity,
                "state": "succeeded", "terminal": True,
                "segments": [{"startMs": 0, "endMs": 1_000, "text": "真实字幕"}],
            }

    MediaProductMaterializer(first_store, Projection(), tmp_path / "evidence").materialize(TASK_ID)
    old_hash = first_store.get(TASK_ID)["projections"]["outline"]["contentSha256"]
    for coordinator in (first, second):
        coordinator._adapter_policies["bilibili"] = ("bilibili-media-consent/v2", 2)
    barrier = threading.Barrier(2)
    results: list[tuple[str, str]] = []

    def run(coordinator: MediaAcquisitionCoordinator, task_id: str) -> None:
        barrier.wait(timeout=5)
        try:
            value = coordinator.replace_published_policy(
                request(task_id=task_id, consent_policy_id="bilibili-media-consent/v2", consent_policy_revision=2),
                old_task_id=TASK_ID, old_policy_id="bilibili-media-consent/v1",
                old_policy_revision=1, confirmation="reanalyze_under_current_policy",
            )
            results.append(("created", value["authoritativeTaskId"]))
        except MediaAcquisitionError as error:
            results.append(("rejected", error.code))

    threads = [
        threading.Thread(target=run, args=(first, "media_task_" + "2" * 32)),
        threading.Thread(target=run, args=(second, "media_task_" + "3" * 32)),
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=10)
    assert len(results) == 2
    assert sorted(item[0] for item in results) == ["created", "rejected"]
    assert next(item[1] for item in results if item[0] == "rejected") == "V3_MEDIA_SOURCE_POLICY_CONFLICT"
    winner = next(item[1] for item in results if item[0] == "created")
    assert first_store.source_authority(request().source_identity)["task_id"] == winner
    assert second_store.latest_for_source(request().source_identity)["taskId"] == winner
    assert first_store.get(TASK_ID)["projections"]["outline"]["contentSha256"] == old_hash
    with first_store._lock:
        assert first_store._conn.execute("SELECT COUNT(*) FROM media_source_policy_switches").fetchone()[0] == 1
    assert first.sandbox.active_task_count() + second.sandbox.active_task_count() == 2


def test_policy_switch_storage_failure_rolls_back_and_cleans_candidate(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    coordinator = MediaAcquisitionCoordinator(sandbox, authority_store=store)
    coordinator.resolve(request())

    class Projection:
        def get(self, task_id):
            return {
                "taskId": task_id, "sourceIdentity": request().source_identity,
                "state": "succeeded", "terminal": True,
                "segments": [{"startMs": 0, "endMs": 1_000, "text": "真实字幕"}],
            }

    MediaProductMaterializer(store, Projection(), tmp_path / "evidence").materialize(TASK_ID)
    old = store.get(TASK_ID)
    coordinator._adapter_policies["bilibili"] = ("bilibili-media-consent/v2", 2)
    new_task_id = "media_task_" + "2" * 32
    original_append = store._append_event

    def fail_new_event(task_id, revision, event_type, payload, now):
        if task_id == new_task_id:
            raise OSError("injected storage failure")
        return original_append(task_id, revision, event_type, payload, now)

    monkeypatch.setattr(store, "_append_event", fail_new_event)
    with pytest.raises(MediaAcquisitionError) as failed:
        coordinator.replace_published_policy(
            request(task_id=new_task_id, consent_policy_id="bilibili-media-consent/v2", consent_policy_revision=2),
            old_task_id=TASK_ID, old_policy_id="bilibili-media-consent/v1",
            old_policy_revision=1, confirmation="reanalyze_under_current_policy",
        )
    assert failed.value.code == "V3_MEDIA_POLICY_SWITCH_FAILED"
    assert store.source_authority(request().source_identity)["task_id"] == TASK_ID
    assert store.latest_for_source(request().source_identity)["taskId"] == TASK_ID
    assert store.get(TASK_ID)["revision"] == old["revision"]
    assert store.get(TASK_ID)["projections"] == old["projections"]
    with store._lock:
        assert store._conn.execute("SELECT COUNT(*) FROM media_source_policy_switches").fetchone()[0] == 0
        assert store._conn.execute("SELECT COUNT(*) FROM media_tasks WHERE task_id=?", (new_task_id,)).fetchone()[0] == 0
    assert sandbox.active_task_count() == 1


def test_resolve_adopts_legacy_published_product_without_creating_second_task(tmp_path: Path):
    from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")

    class Projection:
        def get(self, task_id):
            return {
                "taskId": task_id, "sourceIdentity": request().source_identity,
                "state": "succeeded", "terminal": True,
                "segments": [{"startMs": 0, "endMs": 1_000, "text": "真实字幕"}],
            }

    MediaProductMaterializer(store, Projection(), tmp_path / "evidence").materialize(TASK_ID)
    assert store.source_authority(request().source_identity) is None
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"), authority_store=store)
    restored = coordinator.resolve(request(task_id="media_task_" + "6" * 32))
    assert restored["disposition"] == "published"
    assert restored["authoritativeTaskId"] == TASK_ID
    assert restored["policyProvenance"] == "unverified_legacy"
    assert coordinator.active_task_count() == 0
    assert store.source_authority(request().source_identity)["task_id"] == TASK_ID
    assert store.source_authority(request().source_identity)["consent_policy_id"] == "legacy-unverified"


def test_interrupted_recovery_requires_absent_memory_owner_and_preserves_published(tmp_path: Path):
    from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    first = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "owned"), authority_store=store)
    first.resolve(request())
    with pytest.raises(MediaAcquisitionError) as active:
        first.recover_interrupted(request().source_identity)
    assert active.value.code == "V3_MEDIA_SOURCE_TASK_ACTIVE"

    restarted = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "owned"), authority_store=store)
    with pytest.raises(MediaAcquisitionError) as uncertain:
        restarted.resolve(request(task_id="media_task_" + "7" * 32))
    assert uncertain.value.code == "V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN"
    with pytest.raises(MediaAcquisitionError) as live_owner:
        restarted.recover_interrupted(request().source_identity)
    assert live_owner.value.code == "V3_MEDIA_SOURCE_TASK_ACTIVE"
    with store._lock:
        store._conn.execute(
            "UPDATE media_source_authority SET owner_pid=?,owner_start=? WHERE task_id=?",
            (999_999_999, "1", TASK_ID),
        )
    owner_path = next((tmp_path / "owned").iterdir()) / ".navia-owner.json"
    owner = json.loads(owner_path.read_text(encoding="utf-8"))
    owner.update(ownerPid=999_999_999, ownerStart="1")
    owner_path.write_text(json.dumps(owner), encoding="utf-8")
    owner_path.chmod(0o600)
    assert restarted.recover_interrupted(request().source_identity) == {
        "disposition": "abandoned", "authoritativeTaskId": TASK_ID,
    }
    next_task = restarted.resolve(request(task_id="media_task_" + "7" * 32))
    assert next_task["disposition"] == "created"

    class Projection:
        def get(self, task_id):
            return {
                "taskId": task_id, "sourceIdentity": request().source_identity,
                "state": "succeeded", "terminal": True,
                "segments": [{"startMs": 0, "endMs": 1_000, "text": "真实字幕"}],
            }

    MediaProductMaterializer(store, Projection(), tmp_path / "evidence").materialize(next_task["authoritativeTaskId"])
    with store._lock:
        store._conn.execute(
            "UPDATE media_source_authority SET state='active' WHERE task_id=?",
            (next_task["authoritativeTaskId"],),
        )
    final = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "final"), authority_store=store)
    assert final.recover_interrupted(request().source_identity) == {
        "disposition": "published", "authoritativeTaskId": next_task["authoritativeTaskId"],
    }
    assert store.source_authority(request().source_identity)["state"] == "published"


def test_recovery_rejects_truncated_owner_manifest_and_retains_source_lock(tmp_path: Path):
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    sandbox_root = tmp_path / "tasks"
    first = MediaAcquisitionCoordinator(TaskArtifactSandbox(sandbox_root), authority_store=store)
    first.resolve(request())
    first.sandbox.write_bytes(TASK_ID, "other", b"private evidence")
    with store._lock:
        store._conn.execute(
            "UPDATE media_source_authority SET owner_pid=?,owner_start=? WHERE task_id=?",
            (999_999_999, "1", TASK_ID),
        )
    directory = next(sandbox_root.iterdir())
    (directory / ".navia-owner.json").write_text("{", encoding="utf-8")
    restarted = MediaAcquisitionCoordinator(TaskArtifactSandbox(sandbox_root), authority_store=store)
    with pytest.raises(MediaAcquisitionError) as blocked:
        restarted.recover_interrupted(request().source_identity)
    assert blocked.value.code == "V3_MEDIA_CLEANUP_INCOMPLETE"
    assert store.source_authority(request().source_identity)["state"] == "active"
    assert any(directory.iterdir())
    with pytest.raises(MediaAcquisitionError) as retry:
        restarted.resolve(request(task_id="media_task_" + "a" * 32))
    assert retry.value.code == "V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN"


def test_recovery_cleans_unpublished_product_evidence_before_releasing_source(tmp_path: Path):
    from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    sandbox_root = tmp_path / "tasks"
    first = MediaAcquisitionCoordinator(TaskArtifactSandbox(sandbox_root), authority_store=store)
    first.resolve(request())
    first.sandbox.write_bytes(TASK_ID, "other", b"private input")
    (sandbox_root / "visual-products").mkdir(mode=0o700)
    (sandbox_root / "product-exports").mkdir(mode=0o700)
    evidence_dir = sandbox_root / "product-evidence" / "evidence" / TASK_ID
    evidence_dir.mkdir(parents=True)
    (evidence_dir / "unpublished.json").write_text('{"text":"private"}', encoding="utf-8")
    owner_path = next(entry for entry in sandbox_root.iterdir() if entry.name.startswith("task_")) / ".navia-owner.json"
    owner = json.loads(owner_path.read_text(encoding="utf-8"))
    owner.update(ownerPid=999_999_999, ownerStart="1")
    owner_path.write_text(json.dumps(owner), encoding="utf-8")
    owner_path.chmod(0o600)
    with store._lock:
        store._conn.execute(
            "UPDATE media_source_authority SET owner_pid=?,owner_start=? WHERE task_id=?",
            (999_999_999, "1", TASK_ID),
        )
    restarted = MediaAcquisitionCoordinator(TaskArtifactSandbox(sandbox_root), authority_store=store)
    materializer = MediaProductMaterializer(store, object(), sandbox_root / "product-evidence")
    with pytest.raises(MediaAcquisitionError) as failed_cleanup:
        restarted.recover_interrupted(request().source_identity, lambda _: (_ for _ in ()).throw(OSError("disk error")))
    assert failed_cleanup.value.code == "V3_MEDIA_CLEANUP_INCOMPLETE"
    assert evidence_dir.exists()
    assert store.source_authority(request().source_identity)["state"] == "active"
    assert restarted.recover_interrupted(request().source_identity, materializer.cleanup_abandoned) == {
        "disposition": "abandoned", "authoritativeTaskId": TASK_ID,
    }
    assert not evidence_dir.exists()
    assert {entry.name for entry in sandbox_root.iterdir()} == {
        "visual-products", "product-evidence", "product-exports"
    }
    assert store.source_authority(request().source_identity)["state"] == "failed"


def test_restart_during_cancellation_requires_cleanup_before_retry(tmp_path: Path):
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    sandbox_root = tmp_path / "tasks"
    first = MediaAcquisitionCoordinator(TaskArtifactSandbox(sandbox_root), authority_store=store)
    first.resolve(request())
    first.sandbox.write_bytes(TASK_ID, "other", b"unfinished private artifact")
    assert store.begin_cancel_source_task(TASK_ID) == "cancelling"
    with pytest.raises(MediaAcquisitionError) as pending:
        first.resolve(request(task_id="media_task_" + "b" * 32))
    assert pending.value.code == "V3_MEDIA_CANCELLATION_IN_PROGRESS"
    owner_path = next(sandbox_root.iterdir()) / ".navia-owner.json"
    owner = json.loads(owner_path.read_text(encoding="utf-8"))
    owner.update(ownerPid=999_999_999, ownerStart="1")
    owner_path.write_text(json.dumps(owner), encoding="utf-8")
    owner_path.chmod(0o600)
    with store._lock:
        store._conn.execute(
            "UPDATE media_source_authority SET owner_pid=?,owner_start=? WHERE task_id=?",
            (999_999_999, "1", TASK_ID),
        )
    restarted = MediaAcquisitionCoordinator(TaskArtifactSandbox(sandbox_root), authority_store=store)
    assert restarted.source_authority(request().source_identity)["state"] == "interrupted"
    assert restarted.recover_interrupted(request().source_identity) == {
        "disposition": "abandoned", "authoritativeTaskId": TASK_ID,
    }
    assert store.source_authority(request().source_identity)["state"] == "cancelled"
    assert restarted.resolve(request(task_id="media_task_" + "b" * 32))["disposition"] == "created"


def test_second_runtime_cannot_recover_live_owner_but_can_after_exit(tmp_path: Path):
    db = tmp_path / "runtime.sqlite3"
    root = tmp_path / "tasks"
    child_code = """
import sys
from pathlib import Path
from navia_runtime.modules.media_companion.acquisition import MediaAcquisitionCoordinator, MediaAcquisitionRequest, TaskArtifactSandbox
from navia_runtime.modules.media_companion.task_store import MediaTaskStore
task, source, db, root = sys.argv[1:]
coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(Path(root)), authority_store=MediaTaskStore(db))
coordinator.resolve(MediaAcquisitionRequest(task, source, 'bilibili', 'BV1ZpYd66ELP', '41828944992', '1', 'bilibili-media-consent/v1', 1))
coordinator.sandbox.write_bytes(task, 'other', b'private input')
print('READY', flush=True)
sys.stdin.readline()
"""
    child = subprocess.Popen(
        [sys.executable, "-c", child_code, TASK_ID, request().source_identity, str(db), str(root)],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        env={**os.environ, "PYTHONPATH": str(Path(__file__).resolve().parents[1])},
    )
    try:
        assert child.stdout is not None
        assert select.select([child.stdout], [], [], 5)[0]
        ready = child.stdout.readline().strip()
        if ready != "READY":
            child.wait(timeout=2)
            pytest.fail(f"child exit={child.returncode}: {child.stderr.read()}")
        store = MediaTaskStore(db)
        second = MediaAcquisitionCoordinator(TaskArtifactSandbox(root), authority_store=store)
        assert second.source_authority(request().source_identity)["state"] == "active_elsewhere"
        with pytest.raises(MediaAcquisitionError) as live:
            second.recover_interrupted(request().source_identity)
        assert live.value.code == "V3_MEDIA_SOURCE_TASK_ACTIVE"
        child.terminate()
        child.wait(timeout=5)
        assert second.source_authority(request().source_identity)["state"] == "interrupted"
        assert second.recover_interrupted(request().source_identity) == {
            "disposition": "abandoned", "authoritativeTaskId": TASK_ID,
        }
        assert not list(root.iterdir())
        assert second.resolve(request(task_id="media_task_" + "c" * 32))["disposition"] == "created"
    finally:
        if child.poll() is None:
            child.terminate()
            child.wait(timeout=5)
        child.stdout.close()
        child.stderr.close()
        child.stdin.close()


def test_cancel_after_transcript_success_blocks_late_product_publication(tmp_path: Path):
    from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
    from navia_runtime.modules.media_companion.task_store import MediaTaskStoreError
    from navia_runtime.modules.media_companion.transcript_projection import MediaTranscriptProjectionService

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"), authority_store=store)
    coordinator.resolve(request())
    coordinator.complete(TASK_ID)

    class NoTranscript:
        def get(self, task_id):
            raise AsrProviderError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "not present")

    class Projection:
        def get(self, task_id):
            return {
                "taskId": task_id, "sourceIdentity": request().source_identity,
                "state": "succeeded", "terminal": True,
                "segments": [{"startMs": 0, "endMs": 1_000, "text": "真实字幕"}],
            }

    store.create(TASK_ID, request().source_identity)
    active_projection = MediaTranscriptProjectionService(coordinator, NoTranscript(), store).get(TASK_ID)
    assert active_projection["state"] == "succeeded"
    assert active_projection["canCancel"] is True
    assert store.begin_cancel_source_task(TASK_ID) == "cancelling"
    with pytest.raises(MediaTaskStoreError) as blocked_transition:
        store.transition(TASK_ID, store.get(TASK_ID)["revision"], "acquiring")
    assert blocked_transition.value.code == "TASK_CANCELLED"
    assert store.finish_cancel_source_task(TASK_ID) == "cancelled"
    assert MediaTranscriptProjectionService(coordinator, NoTranscript(), store).get(TASK_ID)["state"] == "cancelled"
    with pytest.raises(MediaTaskStoreError) as blocked:
        MediaProductMaterializer(store, Projection(), tmp_path / "evidence").materialize(TASK_ID)
    assert blocked.value.code == "TASK_CANCELLED"
    assert store.get(TASK_ID)["state"] == "cancelled"
    retry = coordinator.resolve(request(task_id="media_task_" + "8" * 32))
    assert retry["disposition"] == "created"
    assert retry["authoritativeTaskId"] != TASK_ID


def test_failed_post_transcript_cancel_is_visible_and_requires_dead_owner_recovery(tmp_path: Path, monkeypatch):
    from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
    from navia_runtime.modules.media_companion.task_store import MediaTaskStoreError
    from navia_runtime.modules.media_companion.transcript_projection import MediaTranscriptProjectionService

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    sandbox_root = tmp_path / "tasks"
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(sandbox_root), authority_store=store)
    coordinator.resolve(request())
    coordinator.complete(TASK_ID)
    evidence_dir = sandbox_root / "product-evidence" / "evidence" / TASK_ID
    evidence_dir.mkdir(parents=True)
    (evidence_dir / "private.json").write_text('{"private":true}', encoding="utf-8")

    class SuccessfulTranscript:
        def get(self, task_id):
            return {"state": "succeeded", "result": {}, "progress": [], "resources": None}

        def private_segments(self, task_id):
            return [{"segmentId": "s1", "startMs": 0, "endMs": 1000, "text": "真实字幕"}]

    materializer = MediaProductMaterializer(store, object(), sandbox_root / "product-evidence")
    original_discard = materializer._discard_unpublished_evidence
    monkeypatch.setattr(materializer, "_discard_unpublished_evidence", lambda _: (_ for _ in ()).throw(OSError("disk error")))
    with pytest.raises(MediaTaskStoreError) as failed:
        materializer.cancel(TASK_ID)
    assert failed.value.code == "V3_MEDIA_CLEANUP_INCOMPLETE"
    projection = MediaTranscriptProjectionService(coordinator, SuccessfulTranscript(), store).get(TASK_ID)
    assert projection["state"] == "failed"
    assert projection["failureCode"] == "V3_MEDIA_CLEANUP_INCOMPLETE"
    assert projection["cleanupStatus"] == "pending"
    assert projection["canRetry"] is False
    assert evidence_dir.exists()
    restarted = MediaAcquisitionCoordinator(TaskArtifactSandbox(sandbox_root), authority_store=store)
    with pytest.raises(MediaAcquisitionError) as live_owner:
        restarted.recover_interrupted(request().source_identity, materializer.cleanup_abandoned)
    assert live_owner.value.code == "V3_MEDIA_SOURCE_TASK_ACTIVE"
    monkeypatch.setattr(materializer, "_discard_unpublished_evidence", original_discard)
    with store._lock:
        store._conn.execute(
            "UPDATE media_source_authority SET owner_pid=?,owner_start=? WHERE task_id=?",
            (999_999_999, "1", TASK_ID),
        )
    assert restarted.recover_interrupted(request().source_identity, materializer.cleanup_abandoned) == {
        "disposition": "abandoned", "authoritativeTaskId": TASK_ID,
    }
    assert not evidence_dir.exists()
    assert store.source_authority(request().source_identity)["state"] == "failed"
    assert restarted.resolve(request(task_id="media_task_" + "8" * 32))["disposition"] == "created"


def test_cancel_after_product_commit_reports_published_without_rollback(tmp_path: Path):
    from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"), authority_store=store)
    coordinator.resolve(request())
    coordinator.complete(TASK_ID)

    class Projection:
        def get(self, task_id):
            return {
                "taskId": task_id, "sourceIdentity": request().source_identity,
                "state": "succeeded", "terminal": True,
                "segments": [{"startMs": 0, "endMs": 1_000, "text": "真实字幕"}],
            }

    published = MediaProductMaterializer(store, Projection(), tmp_path / "evidence").materialize(TASK_ID)
    assert published["state"] == "degraded"
    assert store.begin_cancel_source_task(TASK_ID) == "published"
    assert store.get(TASK_ID)["revision"] == published["revision"]
    assert store.source_authority(request().source_identity)["state"] == "published"


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


def test_cleanup_incomplete_blocks_same_source_replacement(tmp_path: Path):
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"), authority_store=store)
    coordinator.resolve(request())

    def fail():
        raise RuntimeError("cleanup hook failed")

    coordinator.register_cancel_hook(TASK_ID, fail)
    with pytest.raises(MediaAcquisitionError) as cleanup:
        coordinator.cancel(TASK_ID)
    assert cleanup.value.code == "V3_MEDIA_CLEANUP_INCOMPLETE"
    assert store.source_authority(request().source_identity)["state"] == "cleanup_incomplete"
    with pytest.raises(MediaAcquisitionError) as retry:
        coordinator.resolve(request(task_id="media_task_" + "9" * 32))
    assert retry.value.code == "V3_MEDIA_CLEANUP_INCOMPLETE"


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
    extension_id = "a" * 32
    origin = f"chrome-extension://{extension_id}"
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", extension_id)
    runtime_app.companion_session_broker.clear()
    token = runtime_app.companion_session_broker.issue(origin)["token"]
    headers = {"Origin": origin, "Authorization": f"Bearer {token}"}
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
    assert client.post("/v1/media/acquisitions", json=body).status_code == 401
    created = client.post("/v1/media/acquisitions", json=body, headers=headers)
    assert created.status_code == 201
    assert created.headers["cache-control"] == "no-store"
    assert created.json()["data"]["task"]["state"] == "created"
    assert client.get(f"/v1/media/acquisitions/{TASK_ID}", headers=headers).json()["data"]["task"]["taskId"] == TASK_ID
    rejected = client.post("/v1/media/acquisitions", json=body | {"cookie": "secret"}, headers=headers)
    assert rejected.status_code == 400
    assert rejected.json()["error"]["code"] == "V3_MEDIA_TASK_INVALID"
    assert client.delete(f"/v1/media/acquisitions/{TASK_ID}").status_code == 401
    cancelled = client.delete(f"/v1/media/acquisitions/{TASK_ID}", headers=headers)
    assert cancelled.status_code == 200
    assert cancelled.headers["cache-control"] == "no-store"
    assert cancelled.json()["data"]["task"]["state"] == "cancelled"
    missing = client.get("/v1/media/acquisitions/media_task_22222222222222222222222222222222", headers=headers)
    assert missing.status_code == 404


def test_resolve_api_authenticates_and_attaches_same_source(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import navia_runtime.app as runtime_app

    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"))
    monkeypatch.setattr(runtime_app, "media_acquisition_coordinator", coordinator)
    extension_id = "a" * 32
    origin = f"chrome-extension://{extension_id}"
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", extension_id)
    runtime_app.companion_session_broker.clear()
    client = TestClient(runtime_app.app)
    body = {
        "taskId": TASK_ID, "sourceIdentity": request().source_identity,
        "adapterId": "bilibili", "mediaId": "BV1ZpYd66ELP",
        "playbackUnitId": "41828944992", "partId": "1",
        "consentPolicyId": "bilibili-media-consent/v1", "consentPolicyRevision": 1,
    }
    path = "/v1/media/acquisitions/resolve"
    assert client.post(path, json=body, headers={"Origin": origin}).status_code == 401
    token = runtime_app.companion_session_broker.issue(origin)["token"]
    headers = {"Origin": origin, "Authorization": f"Bearer {token}"}
    created = client.post(path, json=body, headers=headers)
    assert created.status_code == 201
    assert created.json()["data"]["disposition"] == "created"
    attached = client.post(path, json=body | {"taskId": "media_task_" + "2" * 32}, headers=headers)
    assert attached.status_code == 200
    assert attached.json()["data"]["authoritativeTaskId"] == TASK_ID
    assert attached.json()["data"]["disposition"] == "attached"
    assert attached.headers["cache-control"] == "no-store"
    assert "private" not in attached.text.lower()
    assert client.post(path, json=body | {"cookie": "secret"}, headers=headers).status_code == 400


def test_recover_api_requires_bootstrap_and_refuses_live_owner(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import navia_runtime.app as runtime_app

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(tmp_path / "tasks"), authority_store=store)
    coordinator.resolve(request())
    monkeypatch.setattr(runtime_app, "media_acquisition_coordinator", coordinator)
    extension_id = "a" * 32
    origin = f"chrome-extension://{extension_id}"
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", extension_id)
    runtime_app.companion_session_broker.clear()
    client = TestClient(runtime_app.app)
    path = "/v1/media/acquisitions/recover"
    body = {"sourceIdentity": request().source_identity}
    assert client.post(path, json=body, headers={"Origin": origin}).status_code == 401
    token = runtime_app.companion_session_broker.issue(origin)["token"]
    headers = {"Origin": origin, "Authorization": f"Bearer {token}"}
    active = client.post(path, json=body, headers=headers)
    assert active.status_code == 409
    assert active.json()["error"]["code"] == "V3_MEDIA_SOURCE_TASK_ACTIVE"
    assert active.headers["cache-control"] == "no-store"
    assert client.post(path, json=body | {"cookie": "private"}, headers=headers).status_code == 400


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
        def get(self, task_id):
            return {"taskId": task_id, "state": "created"}

        def selected_input(self, task_id):
            return None

        def acquire_input(self, *args, **kwargs):
            raise TaskArtifactError(
                "V3_MEDIA_TEMP_FILE_MODE_INVALID",
                "Task directory is not a private owned directory.",
            )

    monkeypatch.setattr(runtime_app, "media_acquisition_coordinator", BrokenCoordinator())
    monkeypatch.setattr(runtime_app, "build_media_acquirers", lambda snapshot=None: {})
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


def test_execute_replay_during_inflight_acquisition_never_calls_acquirer_twice(tmp_path: Path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    coordinator = MediaAcquisitionCoordinator(sandbox)
    coordinator.create(request())
    entered = threading.Event()
    release = threading.Event()

    class SlowAcquirer(FakeAcquirer):
        def resolve_identity(self, *args):
            entered.set()
            assert release.wait(timeout=3)
            return super().resolve_identity(*args)

    acquirer = SlowAcquirer(sandbox)
    results = []
    thread = threading.Thread(target=lambda: results.append(coordinator.acquire_input(
        TASK_ID, lease_store=FakeLeaseStore(), acquirers={"bilibili": acquirer},
    )))
    thread.start()
    assert entered.wait(timeout=3)
    with pytest.raises(MediaAcquisitionError) as replay:
        coordinator.acquire_input(TASK_ID, lease_store=FakeLeaseStore(), acquirers={"bilibili": acquirer})
    assert replay.value.code == "V3_MEDIA_ACQUISITION_IN_PROGRESS"
    with pytest.raises(MediaAcquisitionError) as cancellation:
        coordinator.cancel(TASK_ID)
    assert cancellation.value.code == "V3_MEDIA_ACQUISITION_IN_PROGRESS"
    assert coordinator.get(TASK_ID)["state"] == "acquiring"
    release.set()
    thread.join(timeout=3)
    assert not thread.is_alive()
    assert len(results) == 1
    assert acquirer.calls == ["identity", "probe", "subtitle"]


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
    monkeypatch.setattr(runtime_app, "build_media_acquirers", lambda snapshot=None: {"bilibili": acquirer})
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
