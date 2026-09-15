from __future__ import annotations

import hashlib

import pytest

from navia_runtime.modules.memory.data_service_adapter import (
    DataServiceKnowledgeAdapter,
    build_knowledge_adapter_from_env,
)
from navia_runtime.modules.memory.data_service_client import DataServiceClientError
from navia_runtime.modules.memory.guards import PermissionFailure
from navia_runtime.modules.memory.runtime import MockKnowledgeServiceAdapter


class FakeDataServiceClient:
    def __init__(self) -> None:
        self.workspaces: dict[str, dict] = {}
        self.sources: dict[str, dict] = {}
        self.builds = 0

    def probe_status(self):
        return {
            "schemaVersion": "v2-knowledge-status-draft-2026-07-10",
            "observedAt": "2026-09-15T00:00:00Z",
            "frontendInferredRuntimeStatus": "online",
            "runtimeStatus": "online",
            "adapterStatus": "ready",
            "dataServiceStatus": "connected",
            "sourceBuildStatus": "not_saved",
            "capabilities": {},
            "userAction": "none",
            "message": "connected",
            "redactionApplied": True,
        }

    def list_workspaces(self, *, limit=20):
        return {"status": "ok", "data": {"items": list(self.workspaces.values())[:limit]}}

    def create_workspace(self, *, name, owner=None, tags=None):
        item = {
            "workspace_id": name,
            "name": name,
            "owner": owner,
            "tags": tags or [],
            "created_at": "2026-09-15T00:00:00Z",
            "updated_at": "2026-09-15T00:00:00Z",
        }
        self.workspaces[name] = item
        return {"status": "ok", "data": {"workspace": item}}

    def list_sources(self, *, workspace_id, limit=100):
        items = [item for item in self.sources.values() if item["workspace_id"] == workspace_id]
        return {"status": "ok", "data": {"items": items[:limit]}}

    def import_text_source(self, *, workspace_id, title, content, metadata=None):
        digest = hashlib.sha256(content.encode()).hexdigest()
        source_id = f"src_{digest[:16]}"
        self.sources.setdefault(source_id, {
            "workspace_id": workspace_id,
            "source_id": source_id,
            "title": title,
            "status": "active",
            "ingest_status": "pending",
            "source_type": "markdown",
            "metadata": metadata or {},
            "created_at": "2026-09-15T00:00:00Z",
            "updated_at": "2026-09-15T00:00:00Z",
        })
        return {"status": "ok", "data": {"sources": [self.sources[source_id]]}}

    def start_build(self, *, workspace_id, mode="incremental"):
        self.builds += 1
        for source in self.sources.values():
            if source["workspace_id"] == workspace_id:
                source["ingest_status"] = "built"
        return {
            "workspace_id": workspace_id,
            "operation_id": f"op_build_{self.builds:08d}",
            "status": "completed",
            "data": {
                "created_at": "2026-09-15T00:00:00Z",
                "updated_at": "2026-09-15T00:00:01Z",
                "retryable": False,
            },
        }

    def build_status(self, *, workspace_id, operation_id):
        return {
            "workspace_id": workspace_id,
            "operation_id": operation_id,
            "status": "completed",
            "data": {"created_at": "2026-09-15T00:00:00Z", "updated_at": "2026-09-15T00:00:01Z"},
        }

    def describe_source(self, *, workspace_id, source_id):
        return {"status": "ok", "data": {"source": self.sources[source_id]}}

    def source_trace(self, *, workspace_id, source_id):
        source = self.sources[source_id]
        return {
            "status": "ok",
            "data": {
                "trace": {
                    "source_id": source_id,
                    "trace_available": source["ingest_status"] == "built",
                    "source": {**source, "record": {"units": [{"text": "Persisted real source text."}]}},
                }
            },
        }


def candidate() -> dict:
    text = "# Real page\n\nPersisted real source text."
    raw = text.encode()
    return {
        "candidateId": "cand_real_page_001",
        "workspaceId": "ws_default",
        "sourceType": "web_page",
        "title": "Real page",
        "url": "https://example.com/real",
        "pageId": "page_real_001",
        "createdAt": "2026-09-15T00:00:00Z",
        "sourceRefs": [{"textQuote": "Persisted real source text.", "status": "located"}],
        "contentSnapshot": {
            "encoding": "utf8",
            "text": text,
            "byteLength": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
        },
    }


def test_real_adapter_imports_builds_traces_and_replays_without_new_build() -> None:
    client = FakeDataServiceClient()
    adapter = DataServiceKnowledgeAdapter(client)

    first = adapter.save_source(candidate(), idempotency_key="navia-real-page-key")
    replay = adapter.save_source(candidate(), idempotency_key="navia-real-page-key")

    assert first["source"]["status"] == "trace_ready"
    assert first["operation"]["status"] == "succeeded"
    assert replay["source"]["sourceId"] == first["source"]["sourceId"]
    assert replay["idempotentReplay"] is True
    assert client.builds == 1
    assert len(adapter.list_sources("ws_default")["sources"]) == 1
    assert adapter.trace(first["source"]["sourceId"])["entries"][0]["textQuote"] == "Persisted real source text."

    restarted_adapter = DataServiceKnowledgeAdapter(client)
    persisted = restarted_adapter.get_source(first["source"]["sourceId"])
    assert persisted is not None
    assert persisted["evidenceRefs"][0]["textQuote"] == "Persisted real source text."
    assert restarted_adapter.trace(first["source"]["sourceId"])["entries"][0]["textQuote"] == "Persisted real source text."


def test_real_adapter_does_not_collapse_different_urls_with_identical_page_text() -> None:
    client = FakeDataServiceClient()
    adapter = DataServiceKnowledgeAdapter(client)
    first_candidate = candidate()
    second_candidate = candidate()
    second_candidate["candidateId"] = "cand_real_page_002"
    second_candidate["url"] = "https://example.com/another-real-page"
    second_candidate["pageId"] = "page_real_002"

    first = adapter.save_source(first_candidate, idempotency_key="navia-real-page-key-1")
    second = adapter.save_source(second_candidate, idempotency_key="navia-real-page-key-2")

    assert first["source"]["sourceId"] != second["source"]["sourceId"]
    assert len(adapter.list_sources("ws_default")["sources"]) == 2


def test_status_fails_closed_when_source_listing_fails_after_successful_probe() -> None:
    class FailingSourceClient(FakeDataServiceClient):
        def list_workspaces(self, *, limit=20):
            raise DataServiceClientError("DATA_SERVICE_UNREACHABLE", "list failed")

    status = DataServiceKnowledgeAdapter(FailingSourceClient()).status()

    assert status["adapterStatus"] == "degraded"
    assert status["dataServiceStatus"] == "unreachable"
    assert status["userAction"] == "reconnect"
    assert all(value is False for value in status["capabilities"].values())


def test_real_adapter_capabilities_do_not_claim_query_graph_or_forget() -> None:
    adapter = DataServiceKnowledgeAdapter(FakeDataServiceClient())
    status = adapter.status()
    assert status["dataServiceStatus"] == "connected"
    assert status["capabilities"] == {
        "workspace": True,
        "sourceImport": True,
        "buildStatus": True,
        "query": False,
        "graph": False,
        "sourceTrace": True,
        "forgetVerification": False,
    }
    assert adapter.query("ws_default", "question")["status"] == "degraded"
    assert adapter.graph("ws_default")["status"] == "degraded"


def test_adapter_factory_is_explicit_and_localhost_only(monkeypatch) -> None:
    monkeypatch.delenv("NAVIA_KNOWLEDGE_ADAPTER", raising=False)
    assert isinstance(build_knowledge_adapter_from_env(), MockKnowledgeServiceAdapter)

    monkeypatch.setenv("NAVIA_KNOWLEDGE_ADAPTER", "unknown")
    with pytest.raises(RuntimeError, match="mock.*data_service"):
        build_knowledge_adapter_from_env()

    monkeypatch.setenv("NAVIA_KNOWLEDGE_ADAPTER", "data_service")
    monkeypatch.setenv("NAVIA_DATA_SERVICE_URL", "https://example.com")
    with pytest.raises(RuntimeError, match="localhost"):
        build_knowledge_adapter_from_env()


@pytest.mark.parametrize("mutation", ["length", "hash", "shape"])
def test_web_snapshot_integrity_is_verified_before_import(mutation: str) -> None:
    adapter = DataServiceKnowledgeAdapter(FakeDataServiceClient())
    body = candidate()
    if mutation == "length":
        body["contentSnapshot"]["byteLength"] += 1
    elif mutation == "hash":
        body["contentSnapshot"]["sha256"] = "0" * 64
    else:
        body["contentSnapshot"]["unexpected"] = True
    with pytest.raises(PermissionFailure, match="invalid_request"):
        adapter.save_source(body, idempotency_key="navia-real-page-key")
