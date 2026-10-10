from __future__ import annotations

import hashlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from navia_runtime.modules.knowledge_v3 import KnowledgeV3Error, KnowledgeV3Store


def candidate(title: str = "真实页面知识") -> dict:
    body = "这是从真实当前页面提取并由用户确认的正文。"
    return {
        "sourceRefs": [{"url": "https://example.com/article", "kind": "web_page", "anchor": "main"}],
        "title": title,
        "summary": "页面重点",
        "body": body,
        "tags": ["阅读", "示例"],
        "customFields": {"作者": "Example"},
        "provenance": {"contextType": "web_page", "adapterId": "web_page"},
        "createdFromContextHash": hashlib.sha256(body.encode()).hexdigest(),
    }


def test_draft_cancel_never_creates_item(tmp_path: Path) -> None:
    store = KnowledgeV3Store(tmp_path / "runtime.sqlite3")
    draft = store.create_draft(candidate())
    assert draft["state"] == "editing"
    updated = store.update_draft(draft["draftId"], {"revision": 1, "title": "编辑后的标题", "tags": ["确认"]})
    assert updated["revision"] == 2
    assert store.cancel_draft(draft["draftId"])["state"] == "cancelled"
    assert store.list_items() == []
    with pytest.raises(KnowledgeV3Error) as captured:
        store.save_draft(draft["draftId"])
    assert captured.value.code == "KNOWLEDGE_DRAFT_NOT_EDITABLE"


def test_save_is_atomic_idempotent_persistent_and_editable(tmp_path: Path) -> None:
    path = tmp_path / "runtime.sqlite3"
    store = KnowledgeV3Store(path)
    draft = store.create_draft(candidate())
    first = store.save_draft(draft["draftId"])
    replay = store.save_draft(draft["draftId"])
    assert replay["idempotentReplay"] is True
    assert replay["item"]["itemId"] == first["item"]["itemId"]
    assert len(store.list_items()) == 1

    restarted = KnowledgeV3Store(path)
    item = restarted.get_item(first["item"]["itemId"])
    changed = restarted.update_item(item["itemId"], {
        "revision": item["revision"], "priority": 90, "lifecycleState": "aging",
        "title": "重启后编辑", "customFields": {"复核": "完成"},
    })
    assert changed["revision"] == 2
    assert changed["lifecycleState"] == "aging"
    assert restarted.list_items(sort="priority_desc")[0]["itemId"] == item["itemId"]
    assert restarted.delete_item(item["itemId"])["deletionScope"] == "local_single_store"
    assert restarted.list_items() == []


def test_invalid_source_revision_and_sort_fail_closed(tmp_path: Path) -> None:
    store = KnowledgeV3Store(tmp_path / "runtime.sqlite3")
    invalid = candidate()
    invalid["sourceRefs"] = [{"url": "javascript:alert(1)"}]
    with pytest.raises(KnowledgeV3Error) as captured:
        store.create_draft(invalid)
    assert captured.value.code == "KNOWLEDGE_SOURCE_INVALID"
    draft = store.create_draft(candidate())
    with pytest.raises(KnowledgeV3Error) as captured:
        store.update_draft(draft["draftId"], {"revision": 99, "title": "冲突"})
    assert captured.value.code == "KNOWLEDGE_REVISION_CONFLICT"
    with pytest.raises(KnowledgeV3Error) as captured:
        store.list_items(sort="random")
    assert captured.value.code == "KNOWLEDGE_SORT_INVALID"


def test_authenticated_http_roundtrip_uses_one_persistent_store(tmp_path: Path, monkeypatch) -> None:
    import navia_runtime.app as runtime_app

    origin = "chrome-extension://" + "a" * 32
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", "a" * 32)
    monkeypatch.setattr(runtime_app, "knowledge_v3_store", KnowledgeV3Store(tmp_path / "runtime.sqlite3"))
    runtime_app.companion_session_broker.clear()
    token = runtime_app.companion_session_broker.issue(origin)["token"]
    client = TestClient(runtime_app.app)
    headers = {"Origin": origin, "Authorization": f"Bearer {token}", "X-Request-ID": "req_v3_knowledge_roundtrip"}

    denied = client.post("/v3/knowledge/drafts", json=candidate())
    assert denied.status_code == 401
    created = client.post("/v3/knowledge/drafts", json=candidate(), headers=headers)
    assert created.status_code == 201
    draft = created.json()["data"]["draft"]
    saved = client.post(f"/v3/knowledge/drafts/{draft['draftId']}/save", headers=headers)
    assert saved.status_code == 200
    item = saved.json()["data"]["item"]

    listed = client.get("/v3/knowledge/items?sort=priority_desc", headers=headers)
    assert [entry["itemId"] for entry in listed.json()["data"]["items"]] == [item["itemId"]]
    updated = client.patch(
        f"/v3/knowledge/items/{item['itemId']}",
        headers=headers,
        json={**item, "priority": 88, "lifecycleState": "aging"},
    )
    updated_item = updated.json()["data"]["item"]
    assert updated_item["priority"] == 88
    assert updated_item["lifecycleState"] == "aging"
    deleted = client.delete(f"/v3/knowledge/items/{item['itemId']}", headers=headers)
    assert deleted.json()["data"] == {"itemId": item["itemId"], "deleted": True, "deletionScope": "local_single_store"}
