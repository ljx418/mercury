from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from navia_runtime import app as app_module
from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
from navia_runtime.modules.media_companion.acquisition.task_artifacts import TaskArtifactSandbox
from navia_runtime.modules.media_companion.credential_transport import MediaCredentialFailure
from navia_runtime.modules.media_companion.task_store import MediaTaskStore, MediaTaskStoreError


TASK = "media_task_" + "a" * 32
SOURCE = "portal:bilibili:BV1ZpYd66ELP:41828944992:1"


class Projection:
    def get(self, task_id: str):
        return {
            "taskId": task_id,
            "sourceIdentity": SOURCE,
            "sourceTitle": "真实视频标题",
            "state": "succeeded",
            "terminal": True,
            "segments": [
                {"segmentId": "seg_1", "startMs": 0, "endMs": 20_000, "text": "第一段真实转写内容"},
                {"segmentId": "seg_2", "startMs": 20_000, "endMs": 50_000, "text": "第二段真实转写内容"},
            ],
        }


def test_materializer_publishes_degraded_transcript_outline_and_is_idempotent(tmp_path: Path) -> None:
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    service = MediaProductMaterializer(store, Projection(), tmp_path / "private")
    first = service.materialize(TASK)
    second = service.materialize(TASK)
    assert first == second
    assert first["state"] == "degraded"
    assert first["terminalFailureCode"] == "VISUAL_EVIDENCE_UNAVAILABLE"
    assert first["projections"]["outline"]["taskId"] == TASK
    assert first["projections"]["outline"]["taskRevision"] == first["revision"]
    assert all("text" not in item for item in first["projections"]["evidenceCatalog"])
    relative = first["projections"]["evidenceCatalog"][0]["relativeArtifactRef"]
    private = tmp_path / "private" / relative
    assert private.is_file()
    assert "真实转写内容" in json.loads(private.read_text(encoding="utf-8"))["text"]
    assert store.transaction_counts(TASK)["outlineCount"] == 1


def test_materializer_serializes_concurrent_requests_for_one_task(tmp_path: Path) -> None:
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    service = MediaProductMaterializer(store, Projection(), tmp_path / "private")
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(service.materialize, [TASK] * 8))
    assert all(result["taskId"] == TASK and result["state"] == "degraded" for result in results)
    assert len({result["revision"] for result in results}) == 1
    assert store.transaction_counts(TASK)["outlineCount"] == 1


def test_materialize_api_requires_session_rejects_body_and_returns_same_task(tmp_path: Path, monkeypatch) -> None:
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    service = MediaProductMaterializer(store, Projection(), tmp_path / "private")
    monkeypatch.setattr(app_module, "media_product_materializer", service)
    monkeypatch.setattr(app_module, "media_outline_task_store", store)
    extension_id = "a" * 32
    origin = f"chrome-extension://{extension_id}"
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", extension_id)
    app_module.companion_session_broker.clear()
    client = TestClient(app_module.app)
    path = f"/v1/media/outline-tasks/{TASK}/materialize"
    assert client.post(path).status_code == 401
    token = app_module.companion_session_broker.issue(origin)["token"]
    headers = {"Authorization": f"Bearer {token}", "Origin": origin}
    rejected = client.post(path, headers=headers, json={"segments": []})
    assert rejected.status_code == 400
    response = client.post(path, headers=headers)
    assert response.status_code == 200
    assert response.json()["data"]["task"]["taskId"] == TASK


def test_visual_materializer_commits_typed_evidence_and_cleans_media(tmp_path: Path, monkeypatch) -> None:
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    sandbox = TaskArtifactSandbox(tmp_path / "visual")

    class LeaseStore:
        def resolve_credentials(self, lease_id, task_id):
            assert lease_id == "pcl_" + "b" * 32
            assert task_id == TASK
            return [{"name": "SESSDATA", "value": "private", "domain": ".bilibili.com"}]

    class Downloader:
        def acquire_video_section(self, task_id, identity, credentials, *, start_seconds, end_seconds):
            assert identity.media_id == "BV1ZpYd66ELP"
            assert credentials[0]["value"] == "private"
            assert (start_seconds, end_seconds) == (23, 31)
            return sandbox.write_bytes(task_id, "video", b"private-video"), 8_000

    class Extractor:
        def __init__(self, owned):
            assert owned is sandbox

        def extract(self, binding, timestamp_ms):
            artifact = sandbox.write_bytes(TASK, "frame", b"private-frame")
            return SimpleNamespace(artifact=artifact, width_px=640, height_px=360)

    class Ocr:
        initialization_count = 0

        def __init__(self, owned):
            Ocr.initialization_count += 1

        def observe(self, task_id, artifact):
            return SimpleNamespace(blocks=(SimpleNamespace(text="真实画面文字"),))

    class Consent:
        def __init__(self):
            self.state = "not_granted"

        def grant(self):
            self.state = "granted"
            return {"state": self.state}

        def revoke(self, task_id):
            self.state = "revoked"
            return {"state": self.state}

    class Governed:
        def __init__(self, *args):
            pass

        def dispatch(self, selected):
            assert selected.selected is True
            return SimpleNamespace(caption="画面中展示了真实界面和人物")

    import navia_runtime.modules.media_companion.product_materializer as module
    monkeypatch.setattr(module, "FrameExtractor", Extractor)
    monkeypatch.setattr(module, "LocalOcrAdapter", Ocr)
    monkeypatch.setattr(module, "GovernedMediaVisionAdapter", Governed)
    consent = Consent()
    service = MediaProductMaterializer(
        store,
        Projection(),
        tmp_path / "private",
        lease_store=LeaseStore(),
        visual_sandbox=sandbox,
        visual_downloader=Downloader(),
        vision_consent=consent,
        vision_providers=object(),
        vision_adapters=object(),
    )
    monkeypatch.setattr(service, "_distributed_frame_timestamps", lambda duration_ms: (25_000, 25_000))
    result = service.materialize_visual(TASK, "pcl_" + "b" * 32)
    assert result["state"] == "ready"
    assert result["projections"]["outline"]["title"] == "真实视频标题"
    kinds = {item["kind"] for item in result["projections"]["evidenceCatalog"]}
    assert {"transcript", "frame", "ocr_block", "vision_caption"} <= kinds
    assert result["projections"]["outline"]["taskRevision"] == result["revision"]
    assert consent.state == "revoked"
    assert Ocr.initialization_count == 1
    assert sum(item["kind"] == "frame" for item in result["projections"]["evidenceCatalog"]) == 2
    assert sandbox.active_task_count() == 0
    assert not list((tmp_path / "visual").rglob("*.media"))
    assert not list((tmp_path / "visual").rglob("*.png"))
    frame = next(item for item in result["projections"]["evidenceCatalog"] if item["kind"] == "frame")
    metadata = json.loads((tmp_path / "private" / frame["relativeArtifactRef"]).read_text(encoding="utf-8"))
    thumbnail = tmp_path / "private" / metadata["thumbnailRelativeRef"]
    assert thumbnail.read_bytes() == b"private-frame"
    assert thumbnail.stat().st_mode & 0o777 == 0o600


@pytest.mark.parametrize("pause_at", ["download", "thumbnail"])
def test_cancel_during_visual_materialization_stops_dispatch_and_cleans_evidence(
    tmp_path: Path, monkeypatch, pause_at: str
) -> None:
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    store.reserve_source_authority(SOURCE, TASK, "bilibili", "bilibili-media-consent/v1", 1)
    sandbox = TaskArtifactSandbox(tmp_path / "visual")
    entered = Event()
    release = Event()
    calls = {"download": 0, "vision": 0}

    class LeaseStore:
        def resolve_credentials(self, *_):
            return [{"name": "SESSDATA", "value": "private", "domain": ".bilibili.com"}]

    class Downloader:
        def acquire_video_section(self, task_id, identity, credentials, *, start_seconds, end_seconds):
            calls["download"] += 1
            if pause_at == "download" and calls["download"] == 1:
                entered.set()
                assert release.wait(timeout=5)
            return sandbox.write_bytes(task_id, "video", b"video"), 8_000

    class Extractor:
        def __init__(self, owned):
            assert owned is sandbox

        def extract(self, binding, timestamp_ms):
            return SimpleNamespace(artifact=sandbox.write_bytes(TASK, "frame", b"frame"), width_px=640, height_px=360)

    class Ocr:
        def __init__(self, owned):
            assert owned is sandbox

        def observe(self, task_id, artifact):
            return SimpleNamespace(blocks=(SimpleNamespace(text="画面文字"),))

    class Consent:
        def grant(self):
            return None

        def revoke(self, task_id):
            return None

    class Governed:
        def __init__(self, *args):
            pass

        def dispatch(self, selected):
            calls["vision"] += 1
            return SimpleNamespace(caption="真实画面")

    import navia_runtime.modules.media_companion.product_materializer as module
    monkeypatch.setattr(module, "FrameExtractor", Extractor)
    monkeypatch.setattr(module, "LocalOcrAdapter", Ocr)
    monkeypatch.setattr(module, "GovernedMediaVisionAdapter", Governed)
    service = MediaProductMaterializer(
        store, Projection(), tmp_path / "private", lease_store=LeaseStore(),
        visual_sandbox=sandbox, visual_downloader=Downloader(), vision_consent=Consent(),
        vision_providers=object(), vision_adapters=object(),
    )
    monkeypatch.setattr(service, "_distributed_frame_timestamps", lambda duration_ms: (25_000, 35_000))
    if pause_at == "thumbnail":
        original = service._persist_frame_thumbnail

        def pause_after_thumbnail(task_id, evidence_id, artifact):
            relative = original(task_id, evidence_id, artifact)
            entered.set()
            assert release.wait(timeout=5)
            return relative

        monkeypatch.setattr(service, "_persist_frame_thumbnail", pause_after_thumbnail)
    with ThreadPoolExecutor(max_workers=2) as pool:
        materializing = pool.submit(service.materialize_visual, TASK, "pcl_" + "b" * 32)
        assert entered.wait(timeout=5)
        cancelling = pool.submit(service.cancel, TASK)
        for _ in range(200):
            if store.source_authority(SOURCE)["state"] == "cancelling":
                break
            time.sleep(0.01)
        assert store.source_authority(SOURCE)["state"] == "cancelling"
        replacement = "media_task_" + "b" * 32
        blocked = store.reserve_source_authority(SOURCE, replacement, "bilibili", "bilibili-media-consent/v1", 1)
        assert blocked["task_id"] == TASK and blocked["state"] == "cancelling"
        release.set()
        with pytest.raises(MediaTaskStoreError) as stopped:
            materializing.result(timeout=5)
        assert stopped.value.code == "TASK_CANCELLED"
        assert cancelling.result(timeout=5) == "cancelled"
    assert calls["download"] == 1
    assert calls["vision"] == (1 if pause_at == "thumbnail" else 0)
    assert not (tmp_path / "private" / "evidence" / TASK).exists()
    assert sandbox.active_task_count() == 0
    assert store.source_authority(SOURCE)["state"] == "cancelled"


def test_cancel_cleanup_failure_keeps_source_blocked(tmp_path: Path, monkeypatch) -> None:
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    store.reserve_source_authority(SOURCE, TASK, "bilibili", "bilibili-media-consent/v1", 1)
    service = MediaProductMaterializer(store, Projection(), tmp_path / "private")
    monkeypatch.setattr(service, "_discard_unpublished_evidence", lambda task_id: (_ for _ in ()).throw(OSError("disk error")))
    with pytest.raises(MediaTaskStoreError) as failed:
        service.cancel(TASK)
    assert failed.value.code == "V3_MEDIA_CLEANUP_INCOMPLETE"
    assert store.source_authority(SOURCE)["state"] == "cleanup_incomplete"
    blocked = store.reserve_source_authority(SOURCE, "media_task_" + "b" * 32, "bilibili", "bilibili-media-consent/v1", 1)
    assert blocked["task_id"] == TASK and blocked["state"] == "cleanup_incomplete"


def test_visual_materializer_distributes_at_most_eight_frames_across_full_duration() -> None:
    assert MediaProductMaterializer._distributed_frame_timestamps(50_000) == (25_000,)
    points = MediaProductMaterializer._distributed_frame_timestamps(10 * 60 * 1000)
    assert len(points) == 8
    assert points == tuple(sorted(points))
    assert points[0] > 0
    assert points[-1] < 10 * 60 * 1000


def test_visual_materializer_rejects_missing_dependencies(tmp_path: Path) -> None:
    service = MediaProductMaterializer(
        MediaTaskStore(tmp_path / "runtime.sqlite3"),
        Projection(),
        tmp_path / "private",
    )

    with pytest.raises(MediaTaskStoreError) as captured:
        service.materialize_visual(TASK, "pcl_" + "b" * 32)

    assert captured.value.code == "VISUAL_PIPELINE_UNAVAILABLE"


def test_visual_materializer_rejects_wrong_task_lease_before_download(tmp_path: Path) -> None:
    class LeaseStore:
        def resolve_credentials(self, lease_id, task_id):
            raise MediaCredentialFailure("V3_MEDIA_LEASE_TASK_MISMATCH", 403)

    class Downloader:
        def acquire_video_section(self, *args):
            raise AssertionError("download must not start for a mismatched task lease")

    service = MediaProductMaterializer(
        MediaTaskStore(tmp_path / "runtime.sqlite3"),
        Projection(),
        tmp_path / "private",
        lease_store=LeaseStore(),
        visual_sandbox=TaskArtifactSandbox(tmp_path / "visual"),
        visual_downloader=Downloader(),
        vision_consent=object(),
        vision_providers=object(),
        vision_adapters=object(),
    )

    with pytest.raises(MediaCredentialFailure) as captured:
        service.materialize_visual(TASK, "pcl_" + "b" * 32)

    assert captured.value.code == "V3_MEDIA_LEASE_TASK_MISMATCH"
    assert not (tmp_path / "visual" / TASK).exists()
