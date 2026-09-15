from __future__ import annotations

import copy
import importlib
import json
import pickle
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from navia_runtime.modules.memory.permissions import PermissionFailure, PermissionService
from navia_runtime.modules.memory.runtime import MockKnowledgeServiceAdapter


PROJECT = Path(__file__).resolve().parents[3]


@pytest.fixture
def adapter():
    return MockKnowledgeServiceAdapter()


@pytest.fixture
def local(adapter, tmp_path):
    service = PermissionService(adapter)
    file = tmp_path / "prd.md"
    file.write_bytes((PROJECT / "docs/active/project/01-prd.md").read_bytes())
    root_id = service.grant({"workspaceId": "ws_default", "displayName": "PRD", "scope": "single_file", "path": str(file)})["permissionRoot"]["permissionRootId"]
    scan = service.scan(root_id, "ws_default")
    body = {"workspaceId": "ws_default", "scanId": scan["scanId"], "fileIds": [item["fileId"] for item in scan["files"]]}
    yield service, root_id, body, file
    service.close()


def source(adapter):
    return adapter.save_source({"workspaceId": "ws_default", "title": "Test note", "sourceType": "note",
                                "sourceRefs": [{"textQuote": "Test note", "status": "fallback_shown"}]},
                               idempotency_key="note-key")["source"]["sourceId"]


def test_replay_rechecks_captured_epoch_after_revoke(local, monkeypatch):
    service, root, body, _ = local
    initial = service.import_files(root, body, "replay-key")
    verify = service._verify_path
    def revoke_between_locks(value):
        epoch = verify(value)
        service.revoke(root)
        return epoch
    monkeypatch.setattr(service, "_verify_path", revoke_between_locks)
    with pytest.raises(PermissionFailure, match="revoked_permission") as failure:
        service.import_files(root, body, "replay-key")
    assert failure.value.status == 403
    assert len(service.adapter.sources) == 1
    assert service.adapter.get_source(initial["sources"][0]["sourceId"])["contentSnapshot"]


INVALID_CONFIRMATIONS = [{}, {"confirmationText": ""}, {"confirmationText": "delete"}, {"confirmationText": "EVIL"},
                         {"confirmationText": None}, {"confirmationText": True}, {"confirmationText": 1},
                         {"confirmationText": " forget"}, {"confirmationText": "forget", "requestedByUser": False}, [], None]


@pytest.mark.parametrize("body", INVALID_CONFIRMATIONS)
def test_invalid_confirmation_cannot_mutate_local_source(local, body):
    service, root, request, _ = local
    sid = service.import_files(root, request, "confirmation-key")["sources"][0]["sourceId"]
    before = copy.deepcopy((service.adapter.sources, service.adapter.operations))
    with pytest.raises(PermissionFailure, match="invalid_request") as failure:
        service.adapter.forget_source(sid, body)
    assert failure.value.status == 400
    assert (service.adapter.sources, service.adapter.operations) == before
    assert service.adapter.query("ws_default", "source", [sid])["evidenceRefs"]
    assert service.adapter.trace(sid)["entries"]
    assert any(node["id"] == sid for node in service.adapter.graph("ws_default")["nodes"])


@pytest.mark.parametrize("body", INVALID_CONFIRMATIONS)
def test_http_rejects_invalid_confirmation(adapter, monkeypatch, body):
    module = importlib.import_module("navia_runtime.app")
    monkeypatch.setattr(module, "knowledge_adapter", adapter)
    monkeypatch.delenv("NAVIA_LOCAL_FILES_TOKEN", raising=False)
    sid = source(adapter)
    before = copy.deepcopy(adapter.sources)
    with TestClient(module.app) as client:
        response = client.post(f"/v1/knowledge/sources/{sid}/forget", content=json.dumps(body), headers={"Content-Type": "application/json"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "REQUEST_INVALID"
    assert response.json()["error"]["details"]["reason"] == "invalid_request"
    assert adapter.sources == before


@pytest.mark.parametrize("surface", ["list_sources", "query", "graph", "graph_edge", "trace"])
def test_forget_detects_each_residual_surface(adapter, monkeypatch, surface):
    sid = source(adapter)
    responses = {
        "list_sources": {"workspaceId": "ws_default", "sources": [{"sourceId": sid}], "cursor": None},
        "query": {"workspaceId": "ws_default", "answer": "residual", "evidenceRefs": [{"sourceId": sid}], "status": "source_supported", "lookupOutcome": "found"},
        "graph": {"workspaceId": "ws_default", "nodes": [{"id": sid}], "edges": [], "status": "ready"},
        "graph_edge": {"workspaceId": "ws_default", "nodes": [], "edges": [{"from": sid, "to": "workspace_root"}], "status": "ready"},
        "trace": {"sourceId": sid, "status": "located", "entries": [{"sourceId": sid}], "lookupOutcome": "found"},
    }
    method = "graph" if surface == "graph_edge" else surface
    monkeypatch.setattr(adapter, method, Mock(return_value=responses[surface]))
    result = adapter.forget_source(sid, {"confirmationText": "forget"})
    field = {"list_sources": "libraryAbsent", "query": "askAbsent", "graph": "graphAbsent", "trace": "traceAbsent"}[method]
    assert result["verification"][field] is False
    assert result["operation"]["status"] == "degraded"
    assert result["operation"]["error"]["code"] == "FORGET_VERIFICATION_FAILED"
    assert adapter.get_source(sid)["status"] == "forgotten"
    getattr(adapter, method).assert_called_once()


@pytest.mark.parametrize("surface", ["list_sources", "query", "graph", "trace"])
@pytest.mark.parametrize("mode", ["exception", "malformed"])
def test_forget_failed_verification_never_claims_success(adapter, monkeypatch, surface, mode):
    sid = source(adapter)
    method = Mock(side_effect=RuntimeError("private detail")) if mode == "exception" else Mock(return_value={})
    monkeypatch.setattr(adapter, surface, method)
    result = adapter.forget_source(sid, {"confirmationText": "forget"})
    field = {"list_sources": "libraryAbsent", "query": "askAbsent", "graph": "graphAbsent", "trace": "traceAbsent"}[surface]
    assert result["verification"][field] is False
    assert result["operation"]["status"] == "failed"
    assert "private detail" not in json.dumps(result)


def test_forget_requeries_four_surfaces_on_every_request(local, monkeypatch):
    service, root, body, _ = local
    adapter = service.adapter
    sid = service.import_files(root, body, "four-faces-key")["sources"][0]["sourceId"]
    spies = {}
    for name in ["list_sources", "query", "graph", "trace"]:
        spies[name] = Mock(wraps=getattr(adapter, name))
        monkeypatch.setattr(adapter, name, spies[name])
    for _ in range(2):
        result = adapter.forget_source(sid, {"confirmationText": "forget"})
        assert result["operation"]["status"] == "succeeded"
        assert all(result["verification"][name] for name in ["libraryAbsent", "askAbsent", "graphAbsent", "traceAbsent"])
        assert result["operation"]["createdAt"] <= result["operation"]["updatedAt"]
    assert all(spy.call_count == 2 for spy in spies.values())
    assert "contentSnapshot" not in adapter.get_source(sid)


@pytest.mark.parametrize("status", ["failed", "degraded", None, "missing"])
def test_failed_or_incomplete_graph_cannot_prove_absence(adapter, monkeypatch, status):
    sid = source(adapter)
    response = {"workspaceId": "ws_default", "nodes": [], "edges": []}
    if status != "missing":
        response["status"] = status
    monkeypatch.setattr(adapter, "graph", Mock(return_value=response))
    result = adapter.forget_source(sid, {"confirmationText": "forget"})
    assert result["verification"]["graphAbsent"] is False
    assert result["operation"]["status"] == "failed"
    assert result["operation"]["error"]["code"] == "FORGET_VERIFICATION_FAILED"


@pytest.mark.parametrize("surface", ["query", "trace"])
@pytest.mark.parametrize("outcome", ["missing", "unavailable", "unexpected", None])
def test_unreadable_ask_trace_cannot_prove_absence(adapter, monkeypatch, surface, outcome):
    sid = source(adapter)
    response = ({"workspaceId": "ws_default", "answer": "", "evidenceRefs": [], "status": "degraded", "degradedReason": "Runtime timeout"}
                if surface == "query" else {"sourceId": sid, "entries": [], "status": "blocked", "degradedReason": "Permission denied"})
    if outcome != "missing":
        response["lookupOutcome"] = outcome
    monkeypatch.setattr(adapter, surface, Mock(return_value=response))
    result = adapter.forget_source(sid, {"confirmationText": "forget"})
    assert result["verification"]["askAbsent" if surface == "query" else "traceAbsent"] is False
    assert result["operation"]["status"] == "failed"


@pytest.mark.parametrize("lines", [200, 2621440])
def test_evidence_construction_has_hard_bound(local, monkeypatch, lines):
    service, root, _, file = local
    file.write_bytes(b"x\n" * lines)
    scan = service.scan(root, "ws_default")
    module = importlib.import_module("navia_runtime.modules.memory.permissions")
    opaque = module.opaque
    count = 0
    def counted(prefix):
        nonlocal count
        if prefix == "ev_":
            count += 1
            assert count <= 12, "Reference construction exceeded the frozen bound"
        return opaque(prefix)
    monkeypatch.setattr(module, "opaque", counted)
    result = service.import_files(root, {"workspaceId": "ws_default", "scanId": scan["scanId"], "fileIds": [item["fileId"] for item in scan["files"]]}, "bounded-ref-key")
    assert count == len(result["sources"][0]["evidenceRefs"]) == 12
    assert result["sources"][0]["contentSnapshot"]["byteLength"] == lines * 2


@pytest.mark.parametrize("field,value", [("sourceType", "authorized_local_document"), ("sourceType", "pdf"),
                                         ("url", "file:///secret"), ("contentSnapshot", {}), ("permissionRootId", "perm_fake")])
@pytest.mark.parametrize("batch", [False, True])
def test_general_adapter_entry_rejects_local_fields_before_cache(adapter, field, value, batch):
    source(adapter)
    candidate = {"workspaceId": "ws_default", "sourceType": "note", field: value}
    before = copy.deepcopy((adapter.sources, adapter.operations))
    with pytest.raises(PermissionFailure, match="path_not_allowed"):
        if batch:
            adapter.save_batch([candidate], ["note-key"])
        else:
            adapter.save_source(candidate, idempotency_key="note-key")
    assert (adapter.sources, adapter.operations) == before


@pytest.mark.parametrize("batch", [False, True])
def test_general_adapter_entry_rejects_reserved_keys(adapter, batch):
    with pytest.raises(PermissionFailure, match="path_not_allowed"):
        if batch:
            adapter.save_batch([{"sourceType": "note"}], ["local-import:forged"])
        else:
            adapter.save_source({"sourceType": "note"}, idempotency_key="local-import:forged")


def test_forged_authorized_ticket_rejected(local):
    service, _, _, _ = local
    for ticket in [None, {}, object()]:
        with pytest.raises(PermissionFailure, match="path_not_allowed"):
            service.adapter.commit_authorized_batch(ticket)


def test_forget_input_and_output_contracts(adapter):
    schema = json.loads((PROJECT / "docs/active/project/contracts/v2_local_permission.schema.json").read_text())
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator({**schema, "$ref": "#/$defs/ForgetInput"})
    validator.validate({"confirmationText": "forget"})
    for value in INVALID_CONFIRMATIONS:
        assert not validator.is_valid(value)
    schema = json.loads((PROJECT / "docs/active/project/contracts/v2_memory_contracts.schema.json").read_text())
    result = adapter.forget_source(source(adapter), {"confirmationText": "forget"})
    for name, key in [("ForgetRequest", "forgetRequest"), ("ForgetVerification", "verification"), ("KnowledgeOperation", "operation")]:
        Draft202012Validator({"$defs": schema["$defs"], "$ref": f"#/$defs/{name}"}).validate(result[key])
    schema = json.loads((PROJECT / "docs/active/project/contracts/v2_local_permission.schema.json").read_text())
    observations = [("AskAbsenceObservation", adapter.query("ws_default", "source", [result["forgetRequest"]["sourceId"]])),
                    ("TraceAbsenceObservation", adapter.trace(result["forgetRequest"]["sourceId"]))]
    for name, observation in observations:
        validator = Draft202012Validator({"$defs": schema["$defs"], "$ref": f"#/$defs/{name}"})
        validator.validate(observation)
        assert not validator.is_valid({**observation, "lookupOutcome": "unavailable"})


@pytest.mark.parametrize("surface", ["list_sources", "query", "graph", "trace"])
def test_wrong_identity_never_proves_absence(adapter, monkeypatch, surface):
    sid = source(adapter)
    responses = {
        "list_sources": {"workspaceId": "ws_wrong", "sources": [], "cursor": None},
        "query": {"workspaceId": "ws_wrong", "answer": "", "evidenceRefs": [], "status": "degraded", "lookupOutcome": "empty"},
        "graph": {"workspaceId": "ws_wrong", "nodes": [], "edges": [], "status": "ready"},
        "trace": {"sourceId": "src_wrong", "entries": [], "status": "blocked", "lookupOutcome": "forgotten"},
    }
    monkeypatch.setattr(adapter, surface, Mock(return_value=responses[surface]))
    result = adapter.forget_source(sid, {"confirmationText": "forget"})
    assert result["operation"]["status"] == "failed"


def ticket_batch(local):
    service, root_id, _, file = local
    root = service._root(root_id)
    epoch = service._verify_path(root)
    candidates = [{"workspaceId": "ws_default", "sourceType": "authorized_local_document", "permissionRootId": root_id,
                   "title": file.name, "contentSnapshot": {"text": file.read_text(), "encoding": "utf8"},
                   "sourceRefs": [{"textQuote": "PRD", "lineStart": 1, "lineEnd": 1}]}]
    keys = [f"local-import:{root_id}:ticket-test:file-test"]
    return root, epoch, candidates, keys


def test_ticket_is_one_shot_and_batch_is_copied(local):
    service, _, _, _ = local
    root, epoch, candidates, keys = ticket_batch(local)
    ticket = service._issue_import_ticket(root, epoch, candidates, keys)
    with pytest.raises(TypeError):
        pickle.dumps(ticket)
    candidates[0]["workspaceId"] = "ws_injected"
    result = service.adapter.commit_authorized_batch(ticket)
    assert result["sources"][0]["workspaceId"] == "ws_default"
    with pytest.raises(PermissionFailure, match="path_not_allowed"):
        service.adapter.commit_authorized_batch(ticket)


@pytest.mark.parametrize("change,reason", [("workspace", "workspace_mismatch"), ("root", "path_not_allowed"), ("key", "path_not_allowed"), ("epoch", "revoked_permission"), ("revoke", "revoked_permission")])
def test_ticket_rejects_wrong_authority(local, change, reason):
    service, root_id, _, _ = local
    root, epoch, candidates, keys = ticket_batch(local)
    if change == "workspace": candidates[0]["workspaceId"] = "ws_other"
    if change == "root": candidates[0]["permissionRootId"] = "perm_other"
    if change == "key": keys[0] = "uncontrolled-key"
    ticket = service._issue_import_ticket(root, epoch, candidates, keys)
    if change == "epoch": root.epoch += 1
    if change == "revoke": service.revoke(root_id)
    with pytest.raises(PermissionFailure, match=reason):
        service.adapter.commit_authorized_batch(ticket)
    assert not service.adapter.sources
    with pytest.raises(PermissionFailure, match="path_not_allowed"):
        service.adapter.commit_authorized_batch(ticket)


def test_ticket_failure_consumes_ticket_and_rolls_back(local, monkeypatch):
    service, _, _, _ = local
    root, epoch, candidates, keys = ticket_batch(local)
    original = service.adapter._store_source
    ticket = service._issue_import_ticket(root, epoch, candidates, keys)
    monkeypatch.setattr(service.adapter, "_store_source", Mock(side_effect=RuntimeError("commit failure")))
    with pytest.raises(RuntimeError, match="commit failure"):
        service.adapter.commit_authorized_batch(ticket)
    assert not service.adapter.sources
    with pytest.raises(PermissionFailure, match="path_not_allowed"):
        service.adapter.commit_authorized_batch(ticket)
    monkeypatch.setattr(service.adapter, "_store_source", original)
    retry = service._issue_import_ticket(root, epoch, candidates, keys)
    assert service.adapter.commit_authorized_batch(retry)["sources"]


@pytest.mark.parametrize("mutation", ["revoke", "close"])
def test_commit_window_rechecks_authority(local, monkeypatch, mutation):
    service, root, body, _ = local
    original = service.adapter.commit_authorized_batch
    def change_before_commit(ticket):
        service.revoke(root) if mutation == "revoke" else service.close()
        return original(ticket)
    monkeypatch.setattr(service.adapter, "commit_authorized_batch", change_before_commit)
    with pytest.raises(PermissionFailure) as error:
        service.import_files(root, body, "commit-window-key")
    assert error.value.status == 403
    assert not service.adapter.sources and not service.adapter.operations


def test_close_waits_for_atomic_commit_without_deadlock(local, monkeypatch):
    service, root, body, _ = local
    entered, release, closing = Event(), Event(), Event()
    original = service.adapter._store_source
    def paused(*args, **kwargs):
        entered.set()
        assert release.wait(5)
        return original(*args, **kwargs)
    def close():
        closing.set()
        service.close()
    monkeypatch.setattr(service.adapter, "_store_source", paused)
    with ThreadPoolExecutor(max_workers=2) as pool:
        importing = pool.submit(service.import_files, root, body, "close-atomic-key")
        assert entered.wait(5)
        closed = pool.submit(close)
        assert closing.wait(5)
        assert not closed.done()
        release.set()
        assert importing.result(timeout=5)["sources"]
        closed.result(timeout=5)
    assert service.list("ws_default")["permissions"][0]["state"] == "revoked"
    with pytest.raises(PermissionFailure, match="revoked_permission"):
        service.import_files(root, body, "close-atomic-key")


def test_general_batch_rejection_is_atomic(adapter):
    before = copy.deepcopy(adapter.workspaces)
    with pytest.raises(PermissionFailure):
        adapter.save_batch([{"sourceType": "note"}, {"sourceType": "authorized_local_document"}], ["first", "second"])
    assert not adapter.sources and not adapter.operations and adapter.workspaces == before


def test_blank_lines_do_not_use_reference_budget(local):
    service, root, _, file = local
    file.write_bytes((b"\r\nx\r\n" * 20))
    scan = service.scan(root, "ws_default")
    result = service.import_files(root, {"workspaceId": "ws_default", "scanId": scan["scanId"], "fileIds": [item["fileId"] for item in scan["files"]]}, "blank-line-key")
    assert [ref["lineStart"] for ref in result["sources"][0]["evidenceRefs"]] == list(range(2, 25, 2))
    assert result["sources"][0]["contentSnapshot"]["text"] == file.read_bytes().decode()
