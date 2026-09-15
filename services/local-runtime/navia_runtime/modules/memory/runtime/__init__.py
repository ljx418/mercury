from __future__ import annotations

from copy import deepcopy
from functools import wraps
from threading import RLock
from typing import Any

from navia_runtime.contracts import new_id, utc_now
from navia_runtime.modules.memory.guards import MAX_EVIDENCE_REFS, PermissionFailure, reject_local_candidate, validate_forget_input


DEFAULT_WORKSPACE_ID = "ws_default"


def synchronized(method):
    @wraps(method)
    def call(self, *args, **kwargs):
        with self._lock:
            return method(self, *args, **kwargs)
    return call


class MockKnowledgeServiceAdapter:
    """Deterministic mock-first adapter for V2-1 Runtime contract work.

    The adapter intentionally does not call data_service. It provides stable
    contract behavior so Runtime and frontend work can proceed while the real
    data_service adapter remains gated behind V2-3.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self.workspaces: dict[str, dict[str, Any]] = {
            DEFAULT_WORKSPACE_ID: {
                "workspaceId": DEFAULT_WORKSPACE_ID,
                "name": "Navia Knowledge",
                "description": "Default mock-first V2 knowledge workspace.",
                "sourceCount": 0,
                "pendingBuildCount": 0,
                "traceCoverage": 0,
                "createdAt": utc_now(),
                "updatedAt": utc_now(),
            }
        }
        self.sources: dict[str, dict[str, Any]] = {}
        self.operations: dict[str, dict[str, Any]] = {}
        self.permissions: dict[str, dict[str, Any]] = {}
        self.idempotency_index: dict[str, str] = {}
        self._local_import_consumer = None

    @synchronized
    def bind_local_import_consumer(self, consumer) -> None:
        if self._local_import_consumer is not None:
            raise PermissionFailure("path_not_allowed")
        self._local_import_consumer = consumer

    def commit_authorized_batch(self, ticket: Any) -> dict[str, Any]:
        if self._local_import_consumer is None:
            raise PermissionFailure("path_not_allowed")
        # The consumer holds the permission root lock before we acquire the adapter lock.
        with self._local_import_consumer(ticket) as (candidates, keys):
            with self._lock:
                return self._commit_batch(candidates, keys)

    @synchronized
    def status(self) -> dict[str, Any]:
        return {
            "schemaVersion": "v2-knowledge-status-draft-2026-07-10",
            "observedAt": utc_now(),
            "frontendInferredRuntimeStatus": "online",
            "runtimeStatus": "online",
            "adapterStatus": "ready",
            "dataServiceStatus": "unchecked",
            "sourceBuildStatus": self._latest_source_status(),
            "capabilities": {
                "workspace": True,
                "sourceImport": True,
                "buildStatus": True,
                "query": True,
                "graph": True,
                "sourceTrace": True,
                "forgetVerification": True,
            },
            "userAction": "none",
            "message": "V2 mock adapter is ready. Real data_service adapter is not enabled in V2-1.",
            "redactionApplied": True,
        }

    @synchronized
    def list_workspaces(self) -> dict[str, Any]:
        return {"workspaces": [self._workspace_summary(workspace_id) for workspace_id in self.workspaces], "cursor": None}

    @synchronized
    def list_sources(self, workspace_id: str) -> dict[str, Any]:
        sources = [
            deepcopy(source)
            for source in self.sources.values()
            if source.get("workspaceId") == workspace_id
            and source.get("status") != "forgotten"
        ]
        sources.sort(key=lambda item: str(item.get("updatedAt") or item.get("createdAt") or ""), reverse=True)
        return {"workspaceId": workspace_id, "sources": sources, "cursor": None}

    @synchronized
    def get_source(self, source_id: str) -> dict[str, Any] | None:
        source = self.sources.get(source_id)
        return deepcopy(source) if source else None

    @synchronized
    def save_source(self, candidate: dict[str, Any], *, idempotency_key: str) -> dict[str, Any]:
        reject_local_candidate(candidate, idempotency_key)
        return self._store_source(candidate, idempotency_key=idempotency_key)

    def _store_source(self, candidate: dict[str, Any], *, idempotency_key: str) -> dict[str, Any]:
        if idempotency_key in self.idempotency_index:
            operation = self.operations[self.idempotency_index[idempotency_key]]
            source = self.sources.get(str(operation.get("sourceId")))
            return {"source": deepcopy(source), "operation": deepcopy(operation), "idempotentReplay": True}

        workspace_id = str(candidate.get("workspaceId") or DEFAULT_WORKSPACE_ID)
        if workspace_id not in self.workspaces:
            self.workspaces[workspace_id] = {
                "workspaceId": workspace_id,
                "name": f"Workspace {workspace_id}",
                "description": "Created by V2 mock adapter.",
                "sourceCount": 0,
                "pendingBuildCount": 0,
                "traceCoverage": 0,
                "createdAt": utc_now(),
                "updatedAt": utc_now(),
            }

        source_id = new_id("src_")
        operation_id = new_id("op_")
        evidence_refs = self._normalize_evidence_refs(candidate.get("sourceRefs"), source_id)
        now = utc_now()
        source = {
            "sourceId": source_id,
            "workspaceId": workspace_id,
            "sourceType": candidate.get("sourceType") or "web_page",
            "title": str(candidate.get("title") or candidate.get("url") or "Untitled source")[:240],
            "originUrl": candidate.get("url"),
            "status": "trace_ready",
            "revision": 1,
            "operationId": operation_id,
            "evidenceRefs": evidence_refs,
            "createdAt": now,
            "updatedAt": now,
        }
        if candidate.get("sourceType") == "authorized_local_document" and candidate.get("contentSnapshot"):
            source["contentSnapshot"] = deepcopy(candidate["contentSnapshot"])
            source["permissionRootId"] = candidate["permissionRootId"]
        operation = {
            "operationId": operation_id,
            "operationType": "save_source",
            "status": "succeeded",
            "sourceId": source_id,
            "workspaceId": workspace_id,
            "idempotencyKey": idempotency_key,
            "createdAt": now,
            "updatedAt": now,
        }
        self.sources[source_id] = source
        self.operations[operation_id] = operation
        self.idempotency_index[idempotency_key] = operation_id
        self._refresh_workspace(workspace_id)
        return {"source": deepcopy(source), "operation": deepcopy(operation), "idempotentReplay": False}

    @synchronized
    def save_batch(self, candidates: list[dict[str, Any]], keys: list[str]) -> dict[str, Any]:
        if len(candidates) != len(keys):
            raise ValueError("Batch key count mismatch")
        for candidate, key in zip(candidates, keys):
            reject_local_candidate(candidate, key)
        return self._commit_batch(candidates, keys)

    def _commit_batch(self, candidates: list[dict[str, Any]], keys: list[str]) -> dict[str, Any]:
        names = ("sources", "operations", "workspaces", "idempotency_index")
        before = {name: deepcopy(getattr(self, name)) for name in names}
        try:
            results = [self._store_source(candidate, idempotency_key=key) for candidate, key in zip(candidates, keys)]
        except BaseException:
            for name, value in before.items():
                setattr(self, name, value)
            raise
        return {"sources": [item["source"] for item in results], "operations": [item["operation"] for item in results], "idempotentReplay": False}

    @synchronized
    def get_operation(self, operation_id: str) -> dict[str, Any] | None:
        operation = self.operations.get(operation_id)
        return deepcopy(operation) if operation else None

    @synchronized
    def query(self, workspace_id: str, question: str, source_ids: list[str] | None = None) -> dict[str, Any]:
        sources = self._active_sources(workspace_id, source_ids)
        if not sources:
            return {
                "workspaceId": workspace_id,
                "question": question,
                "answer": "",
                "status": "degraded",
                "lookupOutcome": "empty",
                "degradedReason": "No active sources are available for this workspace.",
                "evidenceRefs": [],
            }
        evidence_refs = sources[0].get("evidenceRefs", [])
        return {
            "workspaceId": workspace_id,
            "question": question,
            "answer": f"基于已保存来源《{sources[0].get('title')}》，Navia 可以回答当前问题，但 V2-1 仍使用 mock adapter。",
            "status": "source_supported",
            "lookupOutcome": "found",
            "evidenceRefs": deepcopy(evidence_refs[:3]),
        }

    @synchronized
    def graph(self, workspace_id: str) -> dict[str, Any]:
        sources = self._active_sources(workspace_id)
        nodes = [
            {"id": source["sourceId"], "label": source.get("title") or source["sourceId"], "type": "source"}
            for source in sources
        ]
        edges = [
            {"id": f"edge_{source['sourceId']}", "from": source["sourceId"], "to": "workspace_root", "type": "belongs_to"}
            for source in sources
        ]
        if sources:
            nodes.insert(0, {"id": "workspace_root", "label": "Navia Knowledge", "type": "workspace"})
        return {"workspaceId": workspace_id, "nodes": nodes, "edges": edges, "status": "ready"}

    @synchronized
    def trace(self, source_id: str) -> dict[str, Any] | None:
        source = self.sources.get(source_id)
        if not source:
            return None
        if source.get("status") == "forgotten":
            return {"sourceId": source_id, "status": "blocked", "lookupOutcome": "forgotten", "entries": [], "degradedReason": "Source has been forgotten."}
        return {
            "sourceId": source_id,
            "status": "located",
            "lookupOutcome": "found",
            "entries": deepcopy(source.get("evidenceRefs", [])),
        }

    @synchronized
    def grant_permission(self, body: dict[str, Any]) -> dict[str, Any]:
        now = utc_now()
        permission = {
            "permissionRootId": new_id("perm_"),
            "displayName": str(body.get("displayName") or "User selected source"),
            "redactedPath": str(body.get("redactedPath") or body.get("path") or "user-authorized-path").replace("\\", "/"),
            "state": "granted",
            "scope": body.get("scope") if body.get("scope") in {"single_file", "directory", "workspace_export"} else "single_file",
            "createdAt": now,
        }
        operation = {
            "operationId": new_id("op_"),
            "operationType": "grant_permission",
            "status": "succeeded",
            "createdAt": now,
            "updatedAt": now,
        }
        self.permissions[permission["permissionRootId"]] = permission
        self.operations[operation["operationId"]] = operation
        return {"permissionRoot": deepcopy(permission), "operation": deepcopy(operation)}

    @synchronized
    def revoke_permission(self, permission_root_id: str) -> dict[str, Any] | None:
        permission = self.permissions.get(permission_root_id)
        if not permission:
            return None
        now = utc_now()
        permission["state"] = "revoked"
        permission["revokedAt"] = now
        operation = {
            "operationId": new_id("op_"),
            "operationType": "revoke_permission",
            "status": "succeeded",
            "createdAt": now,
            "updatedAt": now,
        }
        self.operations[operation["operationId"]] = operation
        return {"permissionRoot": deepcopy(permission), "operation": deepcopy(operation)}

    @synchronized
    def forget_source(self, source_id: str, body: dict[str, Any]) -> dict[str, Any] | None:
        validate_forget_input(body)
        source = self.sources.get(source_id)
        if not source:
            return None
        now = utc_now()
        source["status"] = "forgotten"
        source["updatedAt"] = now
        source.pop("contentSnapshot", None)
        source["evidenceRefs"] = []
        forget_request = {
            "forgetRequestId": new_id("forget_"),
            "sourceId": source_id,
            "workspaceId": source["workspaceId"],
            "requestedAt": now,
            "requestedByUser": True,
            "confirmationText": body["confirmationText"],
        }
        absence, check_failed = self._verify_forget(source_id, source["workspaceId"])
        verified_at = utc_now()
        verification = {
            "verificationId": new_id("verify_"),
            "forgetRequestId": forget_request["forgetRequestId"],
            "sourceId": source_id,
            **absence,
            "verifiedAt": verified_at,
        }
        operation = {
            "operationId": new_id("op_"),
            "operationType": "forget_source",
            "status": "failed" if check_failed else "succeeded" if all(absence.values()) else "degraded",
            "sourceId": source_id,
            "workspaceId": source["workspaceId"],
            "createdAt": now,
            "updatedAt": verified_at,
        }
        if operation["status"] != "succeeded":
            operation["error"] = {"code": "FORGET_VERIFICATION_FAILED", "message": "Source absence has not been verified on all surfaces.", "retryable": True, "userAction": "retry_verification"}
        self.operations[operation["operationId"]] = operation
        self._refresh_workspace(source["workspaceId"])
        return {
            "forgetRequest": forget_request,
            "verification": verification,
            "operation": operation,
        }

    def _verify_forget(self, source_id: str, workspace_id: str) -> tuple[dict[str, bool], bool]:
        def records(value, field, keys):
            items = value[field]
            if not isinstance(items, list) or any(not isinstance(item, dict) or any(not isinstance(item.get(key), str) or not item[key] for key in keys) for item in items):
                raise ValueError("Invalid verification records")
            return items

        def library():
            result = self.list_sources(workspace_id)
            if result["workspaceId"] != workspace_id or result["cursor"] is not None:
                raise ValueError("Incomplete library response")
            return not any(item["sourceId"] == source_id for item in records(result, "sources", ["sourceId"]))

        def ask():
            result = self.query(workspace_id, "Verify absence of forgotten source", [source_id])
            if result["workspaceId"] != workspace_id or not isinstance(result["answer"], str) or result["status"] not in {"source_supported", "degraded"}:
                raise ValueError("Invalid query response")
            refs = records(result, "evidenceRefs", ["sourceId"])
            if result["lookupOutcome"] == "found" and result["status"] == "source_supported":
                return False
            if result["lookupOutcome"] != "empty" or result["status"] != "degraded":
                raise ValueError("Incomplete query lookup")
            return not refs and not result["answer"]

        def graph():
            result = self.graph(workspace_id)
            if result["workspaceId"] != workspace_id or result["status"] != "ready":
                raise ValueError("Incomplete graph response")
            nodes = records(result, "nodes", ["id"])
            edges = records(result, "edges", ["from", "to"])
            return not any(item["id"] == source_id for item in nodes) and not any(source_id in {item["from"], item["to"]} for item in edges)

        def trace():
            result = self.trace(source_id)
            if not isinstance(result, dict) or result["sourceId"] != source_id or result["status"] not in {"located", "fallback_shown", "blocked"}:
                raise ValueError("Invalid trace response")
            entries = records(result, "entries", ["sourceId"])
            if result["lookupOutcome"] == "found" and result["status"] in {"located", "fallback_shown"}:
                return False
            if result["lookupOutcome"] != "forgotten" or result["status"] != "blocked":
                raise ValueError("Incomplete trace lookup")
            return not entries

        absence, failed = {}, False
        for name, read in [("libraryAbsent", library), ("askAbsent", ask), ("graphAbsent", graph), ("traceAbsent", trace)]:
            try:
                absence[name] = read()
            except Exception:
                absence[name] = False
                failed = True
        return absence, failed

    def _active_sources(self, workspace_id: str, source_ids: list[str] | None = None) -> list[dict[str, Any]]:
        allowed = set(source_ids or [])
        return [
            source
            for source in self.sources.values()
            if source.get("workspaceId") == workspace_id
            and source.get("status") != "forgotten"
            and (not allowed or source.get("sourceId") in allowed)
        ]

    def _latest_source_status(self) -> str:
        if not self.sources:
            return "not_saved"
        latest = next(reversed(self.sources.values()))
        return str(latest.get("status") or "not_saved")

    def _refresh_workspace(self, workspace_id: str) -> None:
        workspace = self.workspaces[workspace_id]
        active_sources = self._active_sources(workspace_id)
        workspace["sourceCount"] = len(active_sources)
        workspace["pendingBuildCount"] = len([source for source in active_sources if source.get("status") in {"queued", "ingesting", "building"}])
        workspace["traceCoverage"] = 1 if active_sources else 0
        workspace["updatedAt"] = utc_now()

    def _workspace_summary(self, workspace_id: str) -> dict[str, Any]:
        self._refresh_workspace(workspace_id)
        return deepcopy(self.workspaces[workspace_id])

    @staticmethod
    def _normalize_evidence_refs(value: Any, source_id: str) -> list[dict[str, Any]]:
        refs = value if isinstance(value, list) else []
        normalized: list[dict[str, Any]] = []
        for index, ref in enumerate(refs[:MAX_EVIDENCE_REFS]):
            item = ref if isinstance(ref, dict) else {}
            locator_type = item.get("locatorType") if item.get("locatorType") in {
                "dom_text_quote",
                "dom_selector",
                "pdf_page",
                "markdown_line",
                "note_block",
                "fallback_text",
            } else "fallback_text"
            status = item.get("status") if item.get("status") in {"located", "fallback_shown", "blocked"} else "fallback_shown"
            normalized.append({
                "evidenceRefId": str(item.get("evidenceRefId") or new_id("ev_")),
                "sourceId": source_id,
                "locatorType": locator_type,
                "textQuote": item.get("textQuote") if isinstance(item.get("textQuote"), str) else None,
                "selector": item.get("selector") if isinstance(item.get("selector"), str) else None,
                "lineStart": item.get("lineStart") if type(item.get("lineStart")) is int and item["lineStart"] > 0 else None,
                "lineEnd": item.get("lineEnd") if type(item.get("lineEnd")) is int and item["lineEnd"] > 0 else None,
                "status": status,
                "fallbackText": item.get("fallbackText") if isinstance(item.get("fallbackText"), str) else "Mock evidence fallback text.",
                "redactionApplied": True,
            })
        if not normalized:
            normalized.append({
                "evidenceRefId": new_id("ev_"),
                "sourceId": source_id,
                "locatorType": "fallback_text",
                "status": "fallback_shown",
                "fallbackText": "Mock adapter generated fallback evidence because no source refs were supplied.",
                "redactionApplied": True,
            })
        return [
            {key: val for key, val in item.items() if val is not None}
            for item in normalized
        ]
