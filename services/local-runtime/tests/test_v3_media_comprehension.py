from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from navia_runtime.modules.media_companion.comprehension import MediaComprehensionService
from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
from navia_runtime.modules.media_companion.task_store import MediaTaskStore, MediaTaskStoreError


TASK = "media_task_" + "5" * 32
SOURCE = "portal:bilibili:BV1ZpYd66ELP:41828944992:1"


class Projection:
    def get(self, task_id: str):
        topics = (
            "首先介绍问题背景和目标",
            "接下来演示方法步骤和界面操作",
            "最后总结结果限制和适用范围",
        )
        segments = []
        for index in range(36):
            start = index * 10_000
            topic = topics[min(2, index // 12)]
            segments.append({
                "segmentId": f"seg_{index}",
                "startMs": start,
                "endMs": start + 9_000,
                "text": f"{topic}，这是第 {index + 1} 条真实转写证据。",
            })
        return {
            "taskId": task_id,
            "sourceIdentity": SOURCE,
            "state": "succeeded",
            "terminal": True,
            "segments": segments,
        }


def build(tmp_path: Path):
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    private = tmp_path / "private"
    task = MediaProductMaterializer(store, Projection(), private).materialize(TASK)
    return store, private, task, MediaComprehensionService(store, private)


def test_comprehension_builds_one_closed_semantic_projection_without_cloud(tmp_path: Path):
    _, _, task, service = build(tmp_path)
    projection = service.get(TASK, task["revision"])

    assert projection["schemaVersion"] == "v3-media-workspace-comprehension-projection/v1"
    assert projection["task"]["taskRevision"] == task["revision"]
    assert projection["authorization"] == {
        "groundedTextCloudStatus": "disabled",
        "providerId": None,
        "modelId": None,
        "outboundDerivedTextSha256": None,
        "rawMediaUploadCount": 0,
    }
    chapters = projection["outline"]["chapters"]
    assert 3 <= len(chapters) <= 12
    assert [chapter["order"] for chapter in chapters] == list(range(len(chapters)))
    assert all(chapter["keyPoints"] and chapter["evidenceIds"] for chapter in chapters)
    assert all(left["endMs"] <= right["startMs"] for left, right in zip(chapters, chapters[1:]))
    assert projection["timeline"]["outlineId"] == projection["outline"]["outlineId"]
    assert len(projection["timeline"]["moments"]) >= 8
    for chapter in chapters:
        chapter_moments = [
            moment for moment in projection["timeline"]["moments"]
            if moment["chapterId"] == chapter["chapterId"]
        ]
        key_point_times = [moment["timestampMs"] for moment in chapter_moments if moment["kind"] == "key_point"]
        assert len(key_point_times) == len(set(key_point_times))
        assert all(chapter["startMs"] < value < chapter["endMs"] for value in key_point_times)
    assert projection["mindmap"]["outlineId"] == projection["outline"]["outlineId"]
    assert max(node["depth"] for node in projection["mindmap"]["nodes"]) >= 2


def test_comprehension_rejects_stale_revision_and_missing_thumbnail(tmp_path: Path):
    _, _, task, service = build(tmp_path)
    try:
        service.get(TASK, task["revision"] - 1)
        raise AssertionError("stale revision should fail")
    except MediaTaskStoreError as error:
        assert error.code == "TASK_REVISION_CONFLICT"
    try:
        service.thumbnail(TASK, task["projections"]["evidenceCatalog"][0]["evidenceId"])
        raise AssertionError("transcript thumbnail should fail")
    except MediaTaskStoreError as error:
        assert error.code == "V351_THUMBNAIL_NOT_FOUND"


def test_comprehension_api_requires_companion_session(tmp_path: Path, monkeypatch):
    import navia_runtime.app as runtime_app

    store, private, task, service = build(tmp_path)
    extension_id = "a" * 32
    origin = f"chrome-extension://{extension_id}"
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", extension_id)
    runtime_app.companion_session_broker.clear()
    monkeypatch.setattr(runtime_app, "media_outline_task_store", store)
    monkeypatch.setattr(runtime_app, "media_comprehension_service", service)
    client = TestClient(runtime_app.app)

    denied = client.get(f"/v1/media/tasks/{TASK}/comprehension", params={"revision": task["revision"]})
    assert denied.status_code == 401
    session = client.post("/v1/companion/sessions", headers={"Origin": origin}).json()["data"]
    response = client.get(
        f"/v1/media/tasks/{TASK}/comprehension",
        params={"revision": task["revision"]},
        headers={"Authorization": f"Bearer {session['token']}"},
    )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["data"]["projection"]["task"]["taskId"] == TASK
