from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from navia_runtime.app import app, knowledge_adapter


ROOT = Path(__file__).resolve().parents[3]
CONTRACTS = ROOT / "docs/active/project/contracts"


def validate_status(payload: dict) -> None:
    schema = json.loads((CONTRACTS / "v2_knowledge_status.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(payload)


def candidate() -> dict:
    return {
        "candidateId": "cand_test_001",
        "workspaceId": "ws_default",
        "sourceType": "web_page",
        "title": "V2 mock source",
        "url": "https://example.com/v2-memory",
        "createdAt": "2026-07-10T00:00:00Z",
        "sourceRefs": [
            {
                "evidenceRefId": "ev_input_001",
                "sourceId": "src_pending",
                "locatorType": "dom_text_quote",
                "textQuote": "Navia V2 memory source evidence.",
                "status": "located",
                "redactionApplied": True,
            }
        ],
        "idempotencyKey": "idem-test-v2-memory",
    }


def test_v2_knowledge_status_uses_frontend_runtime_semantics() -> None:
    client = TestClient(app)
    body = client.get("/v1/knowledge/status").json()

    assert body["ok"] is True
    validate_status(body["data"])
    assert body["data"]["runtimeStatus"] == "online"
    assert body["data"]["frontendInferredRuntimeStatus"] == "online"
    assert body["data"]["adapterStatus"] == "ready"
    assert body["data"]["dataServiceStatus"] == "unchecked"
    assert "data_service" in body["data"]["message"]


def test_v2_knowledge_source_save_is_idempotent_and_queryable() -> None:
    client = TestClient(app)
    headers = {"Idempotency-Key": "idem-test-v2-memory-save"}

    created = client.post("/v1/knowledge/sources", json=candidate(), headers=headers)
    replay = client.post("/v1/knowledge/sources", json=candidate(), headers=headers)

    assert created.status_code == 202
    assert replay.status_code == 202
    created_data = created.json()["data"]
    replay_data = replay.json()["data"]
    source_id = created_data["source"]["sourceId"]
    operation_id = created_data["operation"]["operationId"]
    assert replay_data["source"]["sourceId"] == source_id
    assert replay_data["operation"]["operationId"] == operation_id
    assert replay_data["idempotentReplay"] is True
    assert created_data["source"]["evidenceRefs"][0]["sourceId"] == source_id

    operation = client.get(f"/v1/knowledge/operations/{operation_id}").json()
    assert operation["data"]["operation"]["status"] == "succeeded"

    query = client.post("/v1/knowledge/query", json={"workspaceId": "ws_default", "question": "What is saved?", "sourceIds": [source_id]}).json()
    assert query["data"]["status"] == "source_supported"
    assert query["data"]["evidenceRefs"][0]["sourceId"] == source_id

    graph = client.get("/v1/knowledge/graph", params={"workspaceId": "ws_default"}).json()
    assert any(node["id"] == source_id for node in graph["data"]["nodes"])

    sources = client.get("/v1/knowledge/sources", params={"workspaceId": "ws_default"}).json()
    assert any(source["sourceId"] == source_id for source in sources["data"]["sources"])

    detail = client.get(f"/v1/knowledge/sources/{source_id}").json()
    assert detail["data"]["source"]["sourceId"] == source_id

    trace = client.get(f"/v1/knowledge/source/{source_id}/trace").json()
    assert trace["data"]["status"] == "located"
    assert trace["data"]["entries"][0]["sourceId"] == source_id


def test_v2_knowledge_save_requires_idempotency_key() -> None:
    client = TestClient(app)
    response = client.post("/v1/knowledge/sources", json=candidate())

    assert response.status_code == 400
    body = response.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "REQUEST_INVALID"


def test_v2_permission_and_forget_are_auditable(tmp_path, monkeypatch) -> None:
    token = "test-only-local-files-token-0123456789"
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", token)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", "a" * 32)
    client = TestClient(app)
    client.headers["Authorization"] = "Bearer " + token
    document = tmp_path / "prd.md"
    document.write_bytes((ROOT / "docs/active/project/01-prd.md").read_bytes())
    created = client.post(
        "/v1/knowledge/sources",
        json={**candidate(), "candidateId": "cand_forget_001", "title": "Forget source"},
        headers={"Idempotency-Key": "idem-test-v2-memory-forget"},
    ).json()["data"]
    source_id = created["source"]["sourceId"]

    permission = client.post("/v1/knowledge/permissions", json={"workspaceId": "ws_default", "displayName": "One file", "scope": "single_file", "path": str(document)}).json()["data"]
    permission_root_id = permission["permissionRoot"]["permissionRootId"]
    assert permission["permissionRoot"]["state"] == "granted"

    revoked = client.delete(f"/v1/knowledge/permissions/{permission_root_id}").json()["data"]
    assert revoked["permissionRoot"]["state"] == "revoked"

    forgotten = client.post(f"/v1/knowledge/sources/{source_id}/forget", json={"confirmationText": "forget"}).json()["data"]
    assert forgotten["verification"]["libraryAbsent"] is True
    assert forgotten["verification"]["askAbsent"] is True
    assert forgotten["verification"]["graphAbsent"] is True
    assert forgotten["verification"]["traceAbsent"] is True

    sources_after_forget = client.get("/v1/knowledge/sources?workspaceId=ws_default").json()["data"]["sources"]
    assert source_id not in {source["sourceId"] for source in sources_after_forget}

    trace = client.get(f"/v1/knowledge/source/{source_id}/trace").json()
    assert trace["data"]["status"] == "blocked"
