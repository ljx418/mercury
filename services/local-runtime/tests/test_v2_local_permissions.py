from __future__ import annotations

import hashlib
import importlib
import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from navia_runtime.modules.memory.permissions import PermissionFailure, PermissionService, MAX_FILE
from navia_runtime.modules.memory.runtime import MockKnowledgeServiceAdapter


PROJECT = Path(__file__).resolve().parents[3]
TOKEN = "test-only-local-files-token-0123456789"
ORIGIN = "chrome-extension://" + "a" * 32


@pytest.fixture
def service():
    value = PermissionService(MockKnowledgeServiceAdapter())
    yield value
    value.close()


@pytest.fixture
def document(tmp_path):
    target = tmp_path / "prd.md"
    target.write_bytes((PROJECT / "docs/active/project/01-prd.md").read_bytes())
    return target


def grant(service, document, workspace="ws_default"):
    return service.grant({"workspaceId": workspace, "displayName": "Review document", "path": str(document),
                          "scope": "directory" if document.is_dir() else "single_file"})["permissionRoot"]["permissionRootId"]


def scan_body(service, root):
    scan = service.scan(root, "ws_default")
    return {"workspaceId": "ws_default", "scanId": scan["scanId"], "fileIds": [item["fileId"] for item in scan["files"]]}


def test_default_grant_and_list_never_read_or_enumerate(service, document, monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("Unexpected content read or directory enumeration")
    monkeypatch.setattr(os, "read", forbidden)
    monkeypatch.setattr(os, "listdir", forbidden)
    root = grant(service, document)
    assert service.list("ws_default")["permissions"][0]["permissionRootId"] == root
    assert service.adapter.list_sources("ws_default")["sources"] == []


@pytest.mark.parametrize("kind", ["single", "directory", "nested"])
def test_real_content_import_revoke_and_retention(service, document, kind):
    target = document
    if kind == "directory":
        target = document.parent
    elif kind == "nested":
        nested = document.parent / "nested"
        nested.mkdir()
        document.rename(nested / document.name)
        document = nested / document.name
        target = nested.parent
    root = grant(service, target)
    body = scan_body(service, root)
    assert service.adapter.list_sources("ws_default")["sources"] == []
    result = service.import_files(root, body, "real-file-import")
    source = result["sources"][0]
    source_id = source["sourceId"]
    raw = document.read_bytes()
    assert source["contentSnapshot"] == {"encoding": "utf8", "text": raw.decode(), "byteLength": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    for ref in source["evidenceRefs"]:
        assert ref["textQuote"] == raw.decode().splitlines()[ref["lineStart"] - 1]
        assert ref["sourceId"] == source_id
    assert service.import_files(root, body, "real-file-import")["sources"][0]["sourceId"] == source_id
    document.write_text("changed after import", encoding="utf8")
    service.revoke(root)
    service.revoke(root)
    for call in [lambda: service.scan(root, "ws_default"), lambda: service.import_files(root, body, "real-file-import")]:
        with pytest.raises(PermissionFailure, match="revoked_permission"):
            call()
    assert service.adapter.get_source(source_id)["contentSnapshot"]["sha256"] == hashlib.sha256(raw).hexdigest()
    assert source_id in {item["sourceId"] for item in service.adapter.list_sources("ws_default")["sources"]}
    assert service.adapter.query("ws_default", "saved?", [source_id])["evidenceRefs"]
    assert any(node["id"] == source_id for node in service.adapter.graph("ws_default")["nodes"])
    assert service.adapter.trace(source_id)["entries"]
    service.adapter.forget_source(source_id, {"confirmationText": "forget"})
    assert "contentSnapshot" not in service.adapter.get_source(source_id)
    assert not service.adapter.query("ws_default", "saved?", [source_id])["evidenceRefs"]
    assert not service.adapter.trace(source_id)["entries"]


def test_default_disabled_and_exact_origin_authentication(service, monkeypatch):
    monkeypatch.delenv("NAVIA_LOCAL_FILES_TOKEN", raising=False)
    monkeypatch.delenv("NAVIA_LOCAL_FILES_EXTENSION_ID", raising=False)
    with pytest.raises(PermissionFailure):
        service.authenticate("Bearer " + TOKEN, ORIGIN)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", TOKEN)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", "a" * 32)
    for authorization, origin in [(None, ORIGIN), ("Bearer wrong", ORIGIN), ("Bearer " + TOKEN, "chrome-extension://" + "b" * 32), ("Bearer " + TOKEN, "https://example.com")]:
        with pytest.raises(PermissionFailure):
            service.authenticate(authorization, origin)
    service.authenticate("Bearer " + TOKEN, ORIGIN)
    service.authenticate("Bearer " + TOKEN, None)


def test_cross_workspace_and_ungranted(service, document):
    with pytest.raises(PermissionFailure, match="workspace_mismatch"):
        grant(service, document, "ws_unknown")
    root = grant(service, document)
    with pytest.raises(PermissionFailure, match="workspace_mismatch"):
        service.scan(root, "ws_other")
    with pytest.raises(PermissionFailure, match="missing_permission"):
        service.scan("perm_unknown", "ws_default")


def test_root_and_ancestor_replacement_are_denied(service, document):
    root = grant(service, document)
    old = document.with_name("original.md")
    document.rename(old)
    document.write_bytes(old.read_bytes())
    with pytest.raises(PermissionFailure, match="path_not_allowed"):
        service.scan(root, "ws_default")
    root2 = grant(service, document)
    parent = document.parent
    moved = parent.with_name(parent.name + "-moved")
    parent.rename(moved)
    parent.mkdir()
    os.link(moved / document.name, document)
    with pytest.raises(PermissionFailure, match="path_not_allowed"):
        service.scan(root2, "ws_default")


def test_symlinks_and_traversal_are_denied(service, document):
    link = document.with_name("link.md")
    link.symlink_to(document)
    with pytest.raises(PermissionFailure, match="path_not_allowed"):
        grant(service, link)
    root = grant(service, document.parent)
    with pytest.raises(PermissionFailure, match="path_not_allowed"):
        service.scan(root, "ws_default")
    with pytest.raises(PermissionFailure, match="path_not_allowed"):
        service.grant({"workspaceId": "ws_default", "displayName": "Bad", "scope": "single_file", "path": str(document.parent) + "/../" + document.parent.name + "/prd.md"})


@pytest.mark.parametrize("name,content,status", [("binary.md", b"\xff", 422), ("file.pdf", b"pdf", 422), ("huge.md", b"x" * (MAX_FILE + 1), 413), ("empty.md", b"", 422)])
def test_invalid_files_never_create_sources(service, tmp_path, name, content, status):
    file = tmp_path / name
    file.write_bytes(content)
    root = grant(service, file)
    with pytest.raises(PermissionFailure) as error:
        service.import_files(root, scan_body(service, root), "invalid-file-import")
    assert error.value.status == status
    assert not service.adapter.sources


def test_changed_file_forged_id_and_idempotency_conflict(service, document):
    root = grant(service, document)
    body = scan_body(service, root)
    with pytest.raises(PermissionFailure, match="path_not_allowed"):
        service.import_files(root, {**body, "fileIds": ["../../etc/passwd"]}, "invalid-file-id")
    document.write_text("changed", encoding="utf8")
    with pytest.raises(PermissionFailure, match="file_changed"):
        service.import_files(root, body, "changed-file-import")
    body = scan_body(service, root)
    result = service.import_files(root, body, "same-key-import")
    with pytest.raises(PermissionFailure, match="idempotency_conflict"):
        service.import_files(root, {**body, "scanId": "scan_different"}, "same-key-import")
    service.adapter.forget_source(result["sources"][0]["sourceId"], {"confirmationText": "forget"})
    with pytest.raises(PermissionFailure, match="idempotency_conflict"):
        service.import_files(root, body, "same-key-import")


def test_concurrent_same_request_imports_once(service, document):
    root = grant(service, document)
    body = scan_body(service, root)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: service.import_files(root, body, "concurrent-import"), range(8)))
    assert len({result["sources"][0]["sourceId"] for result in results}) == 1
    assert len(service.adapter.sources) == 1


def test_revoke_before_file_open_prevents_read_and_commit(service, document, monkeypatch):
    root = grant(service, document)
    body = scan_body(service, root)
    reached, resume = Event(), Event()
    original = service._open
    def paused(*args, **kwargs):
        reached.set()
        assert resume.wait(5)
        return original(*args, **kwargs)
    monkeypatch.setattr(service, "_open", paused)
    reads = []
    read = os.read
    monkeypatch.setattr(os, "read", lambda *args: (reads.append(args), read(*args))[1])
    with ThreadPoolExecutor() as pool:
        future = pool.submit(service.import_files, root, body, "concurrent-revoke")
        assert reached.wait(5)
        service.revoke(root)
        resume.set()
        with pytest.raises(PermissionFailure, match="revoked_permission"):
            future.result()
    assert not reads and not service.adapter.sources


def test_batch_failure_rolls_back_and_retry_succeeds(service, document, monkeypatch):
    second = document.with_name("architecture.md")
    second.write_bytes((PROJECT / "docs/active/project/02-architecture.md").read_bytes())
    root = grant(service, document.parent)
    body = scan_body(service, root)
    original = service.adapter._store_source
    calls = 0
    def fail_second(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("injected batch failure")
        return original(*args, **kwargs)
    monkeypatch.setattr(service.adapter, "_store_source", fail_second)
    with pytest.raises(RuntimeError, match="injected batch"):
        service.import_files(root, body, "atomic-batch-import")
    assert not service.adapter.sources and not service.adapter.operations and not service.adapter.idempotency_index
    monkeypatch.setattr(service.adapter, "_store_source", original)
    assert len(service.import_files(root, body, "atomic-batch-import")["sources"]) == 2


def test_permission_expired_in_new_runtime(service, document):
    root = grant(service, document)
    new = PermissionService(MockKnowledgeServiceAdapter())
    with pytest.raises(PermissionFailure, match="missing_permission"):
        new.scan(root, "ws_default")


def test_authenticated_real_file_api_and_read_protection(service, document, monkeypatch):
    module = importlib.import_module("navia_runtime.app")
    monkeypatch.setattr(module, "permission_service", service)
    monkeypatch.setattr(module, "knowledge_adapter", service.adapter)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", TOKEN)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", "a" * 32)
    client = TestClient(module.app)
    assert client.post("/v1/knowledge/permissions", json={}).status_code == 403
    headers = {"Authorization": "Bearer " + TOKEN, "Origin": ORIGIN}
    response = client.post("/v1/knowledge/permissions", json={"workspaceId": "ws_default", "displayName": "PRD", "path": str(document), "scope": "single_file"}, headers=headers)
    assert response.status_code == 202
    public = response.json()["data"]["permissionRoot"]
    schema = json.loads((PROJECT / "docs/active/project/contracts/v2_local_permission.schema.json").read_text())
    Draft202012Validator({**schema, "$ref": "#/$defs/PermissionRoot"}).validate(public)
    assert str(document) not in response.text
    prefix = "/v1/knowledge/permissions/" + public["permissionRootId"]
    scan = client.post(prefix + "/scan", json={"workspaceId": "ws_default"}, headers=headers).json()["data"]
    Draft202012Validator({**schema, "$ref": "#/$defs/ScanResult"}).validate(scan)
    body = {"workspaceId": "ws_default", "scanId": scan["scanId"], "fileIds": [scan["files"][0]["fileId"]]}
    imported = client.post(prefix + "/imports", json=body, headers={**headers, "Idempotency-Key": "api-file-import"})
    assert imported.status_code == 202
    source_id = imported.json()["data"]["sources"][0]["sourceId"]
    for endpoint in ["/v1/knowledge/sources?workspaceId=ws_default", "/v1/knowledge/sources/" + source_id, "/v1/knowledge/graph?workspaceId=ws_default", "/v1/knowledge/source/" + source_id + "/trace"]:
        assert client.get(endpoint).status_code == 403
        assert client.get(endpoint, headers=headers).status_code == 200
    assert client.post("/v1/knowledge/query", json={"workspaceId": "ws_default", "question": "test"}).status_code == 403
    forged = client.post("/v1/knowledge/sources", json={"sourceType": "authorized_local_document"}, headers={**headers, "Idempotency-Key": "forged-import-key"})
    assert forged.status_code == 403
    assert client.delete(prefix, headers=headers).status_code == 202
    assert client.post(prefix + "/scan", json={"workspaceId": "ws_default"}, headers=headers).status_code == 403
    assert client.post(prefix + "/imports", json=body, headers={**headers, "Idempotency-Key": "api-file-import"}).status_code == 403
