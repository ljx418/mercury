from __future__ import annotations

import hashlib
import json
import os
import time
from copy import deepcopy
from threading import RLock
from typing import Any

from navia_runtime.contracts import utc_now
from navia_runtime.modules.memory.data_service_client import (
    DataServiceClientConfig,
    DataServiceClientError,
    DataServiceHttpClient,
)
from navia_runtime.modules.memory.guards import PermissionFailure, reject_local_candidate, validate_forget_input


DEFAULT_WORKSPACE_ID = "ws_default"
_TERMINAL_BUILD_STATUSES = {"completed", "failed", "blocked", "cancelled"}


class KnowledgeAdapterError(RuntimeError):
    def __init__(self, code: str, message: str, *, status_code: int = 503) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class DataServiceKnowledgeAdapter:
    """Narrow real-data adapter used by the H01 persistence prerequisite.

    Workspace/source/build/trace are real data_service operations. Query, graph,
    and durable Forget deliberately remain fail-closed until their own gates.
    """

    def __init__(
        self,
        client: DataServiceHttpClient,
        *,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
        build_timeout_seconds: float = 30.0,
        poll_interval_seconds: float = 0.1,
    ) -> None:
        self.client = client
        self.workspace_id = workspace_id
        self.build_timeout_seconds = build_timeout_seconds
        self.poll_interval_seconds = poll_interval_seconds
        self._lock = RLock()
        self._operations: dict[str, dict[str, Any]] = {}
        self._evidence_by_source: dict[str, list[dict[str, Any]]] = {}
        self._local_import_consumer = None

    def bind_local_import_consumer(self, consumer) -> None:
        with self._lock:
            if self._local_import_consumer is not None:
                raise PermissionFailure("path_not_allowed")
            self._local_import_consumer = consumer

    def commit_authorized_batch(self, ticket: Any) -> dict[str, Any]:
        if self._local_import_consumer is None:
            raise PermissionFailure("path_not_allowed")
        with self._local_import_consumer(ticket) as (candidates, keys):
            results = [self._save_candidate(candidate, key, trusted_local=True) for candidate, key in zip(candidates, keys)]
        return {
            "sources": [item["source"] for item in results],
            "operations": [item["operation"] for item in results],
            "idempotentReplay": all(item["idempotentReplay"] for item in results),
        }

    def status(self) -> dict[str, Any]:
        status = self.client.probe_status()
        if status.get("dataServiceStatus") != "connected":
            return status
        try:
            source_status = self._latest_source_status()
        except DataServiceClientError as exc:
            return self._status_from_error(exc)
        return {
            **status,
            "sourceBuildStatus": source_status,
            "capabilities": self._capabilities(),
            "message": "Real data_service adapter is connected. Workspace, source import, build status, and trace are enabled.",
        }

    def list_workspaces(self) -> dict[str, Any]:
        self._ensure_workspace()
        payload = self.client.list_workspaces(limit=20)
        items = self._data(payload, "items")
        workspaces = []
        for item in items if isinstance(items, list) else []:
            if not isinstance(item, dict) or not item.get("workspace_id"):
                continue
            workspace_id = str(item["workspace_id"])
            sources = self._source_items(workspace_id)
            active = [source for source in sources if source.get("status") != "removed"]
            trace_ready = [source for source in active if self._source_status(source) == "trace_ready"]
            workspaces.append({
                "workspaceId": workspace_id,
                "name": str(item.get("name") or workspace_id),
                "description": "Managed by the configured data_service HTTP boundary.",
                "sourceCount": len(active),
                "pendingBuildCount": sum(self._source_status(source) in {"queued", "ingesting", "building"} for source in active),
                "traceCoverage": len(trace_ready) / len(active) if active else 0,
                "createdAt": self._timestamp(item.get("created_at")),
                "updatedAt": self._timestamp(item.get("updated_at") or item.get("created_at")),
            })
        return {"workspaces": workspaces, "cursor": None}

    def list_sources(self, workspace_id: str) -> dict[str, Any]:
        self._require_workspace(workspace_id)
        sources = [self._map_source(item) for item in self._source_items(workspace_id) if item.get("status") != "removed"]
        return {"workspaceId": workspace_id, "sources": sources, "cursor": None}

    def get_source(self, source_id: str) -> dict[str, Any] | None:
        try:
            payload = self.client.describe_source(workspace_id=self.workspace_id, source_id=source_id)
        except DataServiceClientError as exc:
            if exc.status_code == 404:
                return None
            raise
        source = self._data(payload, "source")
        return self._map_source(source) if isinstance(source, dict) else None

    def save_source(self, candidate: dict[str, Any], *, idempotency_key: str) -> dict[str, Any]:
        reject_local_candidate(candidate, idempotency_key)
        return self._save_candidate(candidate, idempotency_key, trusted_local=False)

    def save_batch(self, candidates: list[dict[str, Any]], keys: list[str]) -> dict[str, Any]:
        if len(candidates) != len(keys):
            raise ValueError("Batch key count mismatch")
        results = [self.save_source(candidate, idempotency_key=key) for candidate, key in zip(candidates, keys)]
        return {
            "sources": [item["source"] for item in results],
            "operations": [item["operation"] for item in results],
            "idempotentReplay": all(item["idempotentReplay"] for item in results),
        }

    def get_operation(self, operation_id: str) -> dict[str, Any] | None:
        with self._lock:
            operation = self._operations.get(operation_id)
        if operation:
            return deepcopy(operation)
        try:
            payload = self.client.build_status(workspace_id=self.workspace_id, operation_id=operation_id)
        except DataServiceClientError as exc:
            if exc.status_code == 404:
                return None
            raise
        return self._map_operation(payload)

    def trace(self, source_id: str) -> dict[str, Any] | None:
        try:
            payload = self.client.source_trace(workspace_id=self.workspace_id, source_id=source_id)
        except DataServiceClientError as exc:
            if exc.status_code == 404:
                return None
            raise
        trace = self._data(payload, "trace")
        if not isinstance(trace, dict):
            raise KnowledgeAdapterError("DATA_SERVICE_VERSION_MISMATCH", "data_service trace response has an unsupported shape.")
        if trace.get("trace_available") is not True:
            return {
                "sourceId": source_id,
                "status": "blocked",
                "lookupOutcome": "unavailable",
                "entries": [],
                "degradedReason": str(trace.get("unavailable_reason") or "Trace is not available."),
            }
        entries = self._trace_entries(source_id, trace)
        return {"sourceId": source_id, "status": "located", "lookupOutcome": "found", "entries": entries}

    def query(self, workspace_id: str, question: str, source_ids: list[str] | None = None) -> dict[str, Any]:
        self._require_workspace(workspace_id)
        return {
            "workspaceId": workspace_id,
            "question": question,
            "answer": "",
            "status": "degraded",
            "lookupOutcome": "empty",
            "degradedReason": "Real data_service query is not enabled by the H01-RDS persistence-only gate.",
            "evidenceRefs": [],
        }

    def graph(self, workspace_id: str) -> dict[str, Any]:
        self._require_workspace(workspace_id)
        return {
            "workspaceId": workspace_id,
            "nodes": [],
            "edges": [],
            "status": "degraded",
            "degradedReason": "Real data_service graph is not enabled by the H01-RDS persistence-only gate.",
        }

    def forget_source(self, source_id: str, body: dict[str, Any]) -> dict[str, Any] | None:
        validate_forget_input(body)
        source = self.get_source(source_id)
        if source is None:
            return None
        now = utc_now()
        forget_request_id = f"forget_{hashlib.sha256((source_id + now).encode()).hexdigest()[:24]}"
        return {
            "forgetRequest": {
                "forgetRequestId": forget_request_id,
                "sourceId": source_id,
                "workspaceId": source["workspaceId"],
                "requestedAt": now,
                "requestedByUser": True,
                "confirmationText": "forget",
            },
            "verification": {
                "verificationId": f"verify_{hashlib.sha256(forget_request_id.encode()).hexdigest()[:24]}",
                "forgetRequestId": forget_request_id,
                "sourceId": source_id,
                "libraryAbsent": False,
                "askAbsent": False,
                "graphAbsent": False,
                "traceAbsent": False,
                "verifiedAt": now,
            },
            "operation": {
                "operationId": f"op_{hashlib.sha256(('unsupported:' + forget_request_id).encode()).hexdigest()[:24]}",
                "operationType": "forget_source",
                "status": "failed",
                "sourceId": source_id,
                "workspaceId": source["workspaceId"],
                "createdAt": now,
                "updatedAt": now,
                "error": {
                    "code": "UNSUPPORTED_CAPABILITY",
                    "message": "Durable Forget is not enabled by the H01-RDS persistence-only gate.",
                    "retryable": False,
                    "userAction": "wait_for_px6_forget_gate",
                },
            },
        }

    def _save_candidate(self, candidate: dict[str, Any], idempotency_key: str, *, trusted_local: bool) -> dict[str, Any]:
        workspace_id = str(candidate.get("workspaceId") or self.workspace_id)
        self._require_workspace(workspace_id)
        self._ensure_workspace()
        snapshot = candidate.get("contentSnapshot")
        if not isinstance(snapshot, dict) or not isinstance(snapshot.get("text"), str) or not snapshot["text"].strip():
            raise PermissionFailure("invalid_request", 400)
        if not trusted_local:
            reject_local_candidate(candidate, idempotency_key)
        before_ids = {str(item.get("source_id")) for item in self._source_items(workspace_id)}
        canonical_content = self._canonical_source_text(candidate, snapshot["text"])
        metadata = {
            "source_type": str(candidate.get("sourceType") or "web_page"),
            "originUrl": candidate.get("url"),
            "pageId": candidate.get("pageId"),
            "naviaCandidateId": candidate.get("candidateId"),
            "naviaIdempotencyKey": idempotency_key,
            "naviaSourceRefs": deepcopy(candidate.get("sourceRefs") or [])[:12],
            "contentSha256": snapshot.get("sha256"),
            "canonicalContentSha256": hashlib.sha256(canonical_content.encode("utf-8")).hexdigest(),
        }
        imported = self.client.import_text_source(
            workspace_id=workspace_id,
            title=str(candidate.get("title") or candidate.get("url") or "Navia source")[:240],
            content=canonical_content,
            metadata={key: value for key, value in metadata.items() if value is not None},
        )
        sources = self._data(imported, "sources")
        if not isinstance(sources, list) or not sources or not isinstance(sources[0], dict) or not sources[0].get("source_id"):
            raise KnowledgeAdapterError("DATA_SERVICE_VERSION_MISMATCH", "data_service source import response has an unsupported shape.")
        source_id = str(sources[0]["source_id"])
        idempotent_replay = source_id in before_ids
        with self._lock:
            self._evidence_by_source[source_id] = deepcopy(candidate.get("sourceRefs") or [])
        if idempotent_replay and self._source_status(sources[0]) == "trace_ready":
            operation = self._replay_operation(source_id, workspace_id, idempotency_key)
        else:
            operation = self._build_until_terminal(workspace_id, source_id)
        described = self.client.describe_source(workspace_id=workspace_id, source_id=source_id)
        source_payload = self._data(described, "source")
        if not isinstance(source_payload, dict):
            raise KnowledgeAdapterError("DATA_SERVICE_VERSION_MISMATCH", "data_service source detail response has an unsupported shape.")
        source = self._map_source(source_payload, operation_id=operation["operationId"])
        if operation["status"] != "succeeded" or source["status"] != "trace_ready":
            raise KnowledgeAdapterError("SOURCE_BUILD_FAILED", "data_service did not produce a trace-ready source.", status_code=502)
        return {"source": source, "operation": operation, "idempotentReplay": idempotent_replay}

    def _build_until_terminal(self, workspace_id: str, source_id: str) -> dict[str, Any]:
        started = self.client.start_build(workspace_id=workspace_id, mode="incremental")
        operation_id = str(started.get("operation_id") or "")
        if not operation_id:
            raise KnowledgeAdapterError("DATA_SERVICE_VERSION_MISMATCH", "data_service build response omitted operation_id.")
        deadline = time.monotonic() + self.build_timeout_seconds
        payload = started
        while str(payload.get("status") or "") not in _TERMINAL_BUILD_STATUSES:
            if time.monotonic() >= deadline:
                raise KnowledgeAdapterError("TIMEOUT", "data_service build did not finish before the H01-RDS timeout.", status_code=504)
            time.sleep(self.poll_interval_seconds)
            payload = self.client.build_status(workspace_id=workspace_id, operation_id=operation_id)
        operation = self._map_operation(payload, source_id=source_id)
        with self._lock:
            self._operations[operation_id] = deepcopy(operation)
        return operation

    def _ensure_workspace(self) -> None:
        payload = self.client.list_workspaces(limit=200)
        items = self._data(payload, "items")
        if isinstance(items, list) and any(isinstance(item, dict) and item.get("workspace_id") == self.workspace_id for item in items):
            return
        created = self.client.create_workspace(name=self.workspace_id, owner="navia-h01-rds", tags=["navia", "h01-rds"])
        workspace = self._data(created, "workspace")
        if not isinstance(workspace, dict) or workspace.get("workspace_id") != self.workspace_id:
            raise KnowledgeAdapterError("DATA_SERVICE_VERSION_MISMATCH", "data_service did not create the required ws_default workspace.")

    def _source_items(self, workspace_id: str) -> list[dict[str, Any]]:
        try:
            payload = self.client.list_sources(workspace_id=workspace_id, limit=500)
        except DataServiceClientError as exc:
            if exc.status_code == 404:
                return []
            raise
        items = self._data(payload, "items")
        if not isinstance(items, list):
            raise KnowledgeAdapterError("DATA_SERVICE_VERSION_MISMATCH", "data_service source list response has an unsupported shape.")
        return [item for item in items if isinstance(item, dict)]

    def _latest_source_status(self) -> str:
        payload = self.client.list_workspaces(limit=200)
        items = self._data(payload, "items")
        if not isinstance(items, list) or not any(isinstance(item, dict) and item.get("workspace_id") == self.workspace_id for item in items):
            return "not_saved"
        sources = self._source_items(self.workspace_id)
        return self._source_status(sources[-1]) if sources else "not_saved"

    def _map_source(self, item: dict[str, Any], *, operation_id: str | None = None) -> dict[str, Any]:
        source_id = str(item.get("source_id") or "")
        metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
        persisted_refs = metadata.get("naviaSourceRefs") if isinstance(metadata.get("naviaSourceRefs"), list) else []
        result = {
            "sourceId": source_id,
            "workspaceId": str(item.get("workspace_id") or self.workspace_id),
            "sourceType": str(metadata.get("source_type") or item.get("source_type") or "other_supported_source"),
            "title": str(item.get("title") or source_id)[:240],
            "status": self._source_status(item),
            "revision": 1,
            "evidenceRefs": self._normalize_evidence_refs(
                source_id,
                self._evidence_by_source.get(source_id, []) or persisted_refs,
            ),
            "createdAt": self._timestamp(item.get("created_at") or item.get("updated_at")),
            "updatedAt": self._timestamp(item.get("updated_at") or item.get("created_at")),
        }
        origin_url = metadata.get("originUrl") or metadata.get("source_url") or item.get("url")
        if isinstance(origin_url, str) and origin_url:
            result["originUrl"] = origin_url
        if operation_id:
            result["operationId"] = operation_id
        return result

    def _map_operation(self, payload: dict[str, Any], *, source_id: str | None = None) -> dict[str, Any]:
        raw_status = str(payload.get("status") or "")
        status = {
            "completed": "succeeded",
            "queued": "queued",
            "running": "running",
            "failed": "failed",
            "blocked": "failed",
            "cancelled": "cancelled",
        }.get(raw_status, "failed")
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        operation = {
            "operationId": str(payload.get("operation_id") or ""),
            "operationType": "save_source",
            "status": status,
            "workspaceId": str(payload.get("workspace_id") or self.workspace_id),
            "createdAt": self._timestamp(data.get("created_at")),
            "updatedAt": self._timestamp(data.get("updated_at") or data.get("created_at")),
        }
        if source_id:
            operation["sourceId"] = source_id
        if status == "failed":
            operation["error"] = {
                "code": "SOURCE_BUILD_FAILED",
                "message": "data_service build failed or was blocked.",
                "retryable": bool(data.get("retryable", True)),
                "userAction": "retry_source_build",
            }
        return operation

    def _replay_operation(self, source_id: str, workspace_id: str, key: str) -> dict[str, Any]:
        now = utc_now()
        operation_id = f"op_{hashlib.sha256(('replay:' + key).encode()).hexdigest()[:24]}"
        operation = {
            "operationId": operation_id,
            "operationType": "save_source",
            "status": "succeeded",
            "sourceId": source_id,
            "workspaceId": workspace_id,
            "createdAt": now,
            "updatedAt": now,
        }
        with self._lock:
            self._operations[operation_id] = deepcopy(operation)
        return operation

    def _trace_entries(self, source_id: str, trace: dict[str, Any]) -> list[dict[str, Any]]:
        with self._lock:
            original = deepcopy(self._evidence_by_source.get(source_id, []))
        if original:
            return self._normalize_evidence_refs(source_id, original)
        source = trace.get("source") if isinstance(trace.get("source"), dict) else {}
        metadata = source.get("metadata") if isinstance(source.get("metadata"), dict) else {}
        persisted = metadata.get("naviaSourceRefs") if isinstance(metadata.get("naviaSourceRefs"), list) else []
        if persisted:
            return self._normalize_evidence_refs(source_id, persisted)
        record = source.get("record") if isinstance(source.get("record"), dict) else {}
        units = record.get("units") if isinstance(record.get("units"), list) else []
        refs = [{"textQuote": unit.get("text"), "status": "fallback_shown"} for unit in units if isinstance(unit, dict) and unit.get("text")]
        return self._normalize_evidence_refs(source_id, refs)

    @staticmethod
    def _normalize_evidence_refs(source_id: str, refs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized = []
        for index, ref in enumerate(refs[:12]):
            text = str(ref.get("textQuote") or ref.get("fallbackText") or "").strip()[:500]
            if not text:
                continue
            normalized.append({
                "evidenceRefId": str(ref.get("evidenceRefId") or f"ev_{hashlib.sha256((source_id + ':' + str(index) + ':' + text).encode()).hexdigest()[:24]}"),
                "sourceId": source_id,
                "locatorType": str(ref.get("locatorType") or "fallback_text"),
                "textQuote": text,
                "status": str(ref.get("status") or "fallback_shown"),
                "fallbackText": str(ref.get("fallbackText") or text),
                "redactionApplied": True,
            })
        return normalized

    @staticmethod
    def _source_status(item: dict[str, Any]) -> str:
        if item.get("status") == "removed":
            return "forgotten"
        return {
            "built": "trace_ready",
            "indexed": "trace_ready",
            "pending": "ingesting",
            "queued": "queued",
            "running": "building",
            "failed": "failed",
        }.get(str(item.get("ingest_status") or "pending"), "unknown")

    @staticmethod
    def _data(payload: dict[str, Any], field: str) -> Any:
        if payload.get("status") == "blocked":
            raise KnowledgeAdapterError("DATA_SERVICE_POLICY_BLOCKED", "data_service blocked the requested operation.", status_code=409)
        data = payload.get("data")
        if not isinstance(data, dict):
            raise KnowledgeAdapterError("DATA_SERVICE_VERSION_MISMATCH", "data_service response omitted the data envelope.")
        return data.get(field)

    def _require_workspace(self, workspace_id: str) -> None:
        if workspace_id != self.workspace_id:
            raise KnowledgeAdapterError("WORKSPACE_NOT_FOUND", "H01-RDS only permits the configured ws_default workspace.", status_code=404)

    @staticmethod
    def _timestamp(value: Any) -> str:
        return str(value) if isinstance(value, str) and value else utc_now()

    @staticmethod
    def _capabilities() -> dict[str, bool]:
        return {
            "workspace": True,
            "sourceImport": True,
            "buildStatus": True,
            "query": False,
            "graph": False,
            "sourceTrace": True,
            "forgetVerification": False,
        }

    def _status_from_error(self, exc: DataServiceClientError) -> dict[str, Any]:
        data_service_status = {
            "DATA_SERVICE_AUTH_REQUIRED": "auth_required",
            "DATA_SERVICE_UNREACHABLE": "unreachable",
            "DATA_SERVICE_VERSION_MISMATCH": "version_mismatch",
        }.get(exc.code, "blocked_by_policy")
        return {
            "schemaVersion": "v2-knowledge-status-draft-2026-07-10",
            "observedAt": utc_now(),
            "frontendInferredRuntimeStatus": "online",
            "runtimeStatus": "online",
            "adapterStatus": "degraded" if data_service_status in {"auth_required", "unreachable"} else "blocked",
            "dataServiceStatus": data_service_status,
            "sourceBuildStatus": "not_saved",
            "capabilities": {key: False for key in self._capabilities()},
            "userAction": {
                "auth_required": "configure_data_service",
                "unreachable": "reconnect",
                "version_mismatch": "upgrade_data_service",
            }.get(data_service_status, "open_debug"),
            "message": str(exc),
            "redactionApplied": True,
        }

    @staticmethod
    def _canonical_source_text(candidate: dict[str, Any], snapshot_text: str) -> str:
        identity = {
            "contentSha256": candidate.get("contentSnapshot", {}).get("sha256"),
            "originUrl": candidate.get("url"),
            "pageId": candidate.get("pageId"),
            "sourceType": candidate.get("sourceType"),
            "title": candidate.get("title"),
        }
        header = json.dumps(identity, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return f"<!-- navia-source-identity {header} -->\n\n{snapshot_text}"


def build_knowledge_adapter_from_env() -> Any:
    mode = os.environ.get("NAVIA_KNOWLEDGE_ADAPTER", "mock").strip().lower()
    if mode == "mock":
        from navia_runtime.modules.memory.runtime import MockKnowledgeServiceAdapter

        return MockKnowledgeServiceAdapter()
    if mode != "data_service":
        raise RuntimeError("NAVIA_KNOWLEDGE_ADAPTER must be 'mock' or 'data_service'.")
    base_url = os.environ.get("NAVIA_DATA_SERVICE_URL", "http://127.0.0.1:8003").strip()
    if not base_url.startswith(("http://127.0.0.1:", "http://localhost:")):
        raise RuntimeError("NAVIA_DATA_SERVICE_URL must target localhost for H01-RDS.")
    api_key = os.environ.get("NAVIA_DATA_SERVICE_API_KEY") or None
    timeout = float(os.environ.get("NAVIA_DATA_SERVICE_TIMEOUT_SECONDS", "2.5"))
    build_timeout = float(os.environ.get("NAVIA_DATA_SERVICE_BUILD_TIMEOUT_SECONDS", "30"))
    return DataServiceKnowledgeAdapter(
        DataServiceHttpClient(DataServiceClientConfig(base_url=base_url, api_key=api_key, timeout_seconds=timeout)),
        build_timeout_seconds=build_timeout,
    )
