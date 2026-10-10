from __future__ import annotations

import json
from pathlib import Path
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


def test_materialize_api_requires_session_rejects_body_and_returns_same_task(tmp_path: Path, monkeypatch) -> None:
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    service = MediaProductMaterializer(store, Projection(), tmp_path / "private")
    monkeypatch.setattr(app_module, "media_product_materializer", service)
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
