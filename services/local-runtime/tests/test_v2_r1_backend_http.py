from __future__ import annotations

import hashlib
import json
import os
import secrets
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest


PROJECT = Path(__file__).resolve().parents[3]


@pytest.fixture
def runtime_http(tmp_path):
    with socket.socket() as bound:
        bound.bind(("127.0.0.1", 0))
        port = bound.getsockname()[1]
    token = secrets.token_urlsafe(36)
    env = {**os.environ, "PYTHONPATH": str(PROJECT / "services/local-runtime"),
           "NAVIA_DB_PATH": str(tmp_path / "runtime.sqlite3"), "NAVIA_LOCAL_FILES_TOKEN": token,
           "NAVIA_LOCAL_FILES_EXTENSION_ID": "a" * 32}
    with (tmp_path / "runtime.log").open("wb") as log:
        process = subprocess.Popen([sys.executable, "-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", str(port)],
                                   env=env, cwd=tmp_path, stdout=log, stderr=subprocess.STDOUT)
        try:
            with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=10, trust_env=False) as client:
                for _ in range(100):
                    assert process.poll() is None, "Isolated Runtime exited before health check"
                    try:
                        if client.get("/v1/health").status_code == 200:
                            break
                    except httpx.TransportError:
                        pass
                    time.sleep(0.1)
                else:
                    pytest.fail("Isolated Runtime did not become healthy")
                yield client, token
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)
            print(json.dumps({"check": "isolated_runtime_cleanup", "process_exited": process.poll() is not None}))


def test_real_http_permission_import_revoke_forget(runtime_http, tmp_path):
    client, token = runtime_http
    folder = tmp_path / "authorized-documents"
    folder.mkdir()
    raw = {}
    for name in ["01-prd.md", "02-architecture.md"]:
        raw[name] = (PROJECT / "docs/active/project" / name).read_bytes()
        (folder / name).write_bytes(raw[name])

    def request(method, path, status=200, **kwargs):
        response = client.request(method, path, **kwargs)
        assert response.status_code == status, (path, response.status_code)
        print(json.dumps({"method": method, "path": path, "status": response.status_code,
                          "responseSha256": hashlib.sha256(response.content).hexdigest()}))
        return response.json()

    request("GET", "/v1/knowledge/permissions?workspaceId=ws_default", 403)
    client.headers.update({"Authorization": "Bearer " + token, "Origin": "chrome-extension://" + "a" * 32})
    request("GET", "/v1/knowledge/permissions?workspaceId=ws_default", 403, headers={"Origin": "https://untrusted.example"})
    root = request("POST", "/v1/knowledge/permissions", 202, json={"workspaceId": "ws_default", "displayName": "Repository review documents", "path": str(folder), "scope": "directory"})["data"]["permissionRoot"]
    assert str(folder) not in json.dumps(root)
    assert not request("GET", "/v1/knowledge/sources?workspaceId=ws_default")["data"]["sources"]
    endpoint = f"/v1/knowledge/permissions/{root['permissionRootId']}"
    scan = request("POST", endpoint + "/scan", json={"workspaceId": "ws_default"})["data"]
    body = {"workspaceId": "ws_default", "scanId": scan["scanId"], "fileIds": [item["fileId"] for item in scan["files"]]}
    headers = {"Idempotency-Key": "real-http-import-key"}
    imported = request("POST", endpoint + "/imports", 202, json=body, headers=headers)["data"]
    assert len(imported["sources"]) == 2
    replay = request("POST", endpoint + "/imports", 202, json=body, headers=headers)["data"]
    assert replay["idempotentReplay"] is True
    assert [item["sourceId"] for item in replay["sources"]] == [item["sourceId"] for item in imported["sources"]]
    for item in imported["sources"]:
        snapshot = item["contentSnapshot"]
        assert snapshot["text"].encode("utf8") == raw[item["title"]]
        assert snapshot["sha256"] == hashlib.sha256(raw[item["title"]]).hexdigest()
        for ref in item["evidenceRefs"]:
            assert ref["textQuote"] == raw[item["title"]].decode().splitlines()[ref["lineStart"] - 1]
    sid = imported["sources"][0]["sourceId"]
    source_endpoint = f"/v1/knowledge/sources/{sid}"
    for confirmation in [{}, {"confirmationText": "delete"}, {"confirmationText": ""}]:
        error = request("POST", source_endpoint + "/forget", 400, json=confirmation)
        assert error["error"]["details"]["reason"] == "invalid_request"
        assert request("GET", source_endpoint)["data"]["source"]["contentSnapshot"]
    request("POST", "/v1/knowledge/sources", 403, json={"sourceType": "authorized_local_document", "permissionRootId": root["permissionRootId"]}, headers={"Idempotency-Key": "bypass-import-key"})
    request("DELETE", endpoint, 202)
    request("POST", endpoint + "/scan", 403, json={"workspaceId": "ws_default"})
    request("POST", endpoint + "/imports", 403, json=body, headers=headers)
    assert request("GET", source_endpoint)["data"]["source"]["contentSnapshot"]
    assert request("POST", "/v1/knowledge/query", json={"workspaceId": "ws_default", "question": "source", "sourceIds": [sid]})["data"]["evidenceRefs"]
    assert any(node["id"] == sid for node in request("GET", "/v1/knowledge/graph?workspaceId=ws_default")["data"]["nodes"])
    assert request("GET", f"/v1/knowledge/source/{sid}/trace")["data"]["entries"]
    result = request("POST", source_endpoint + "/forget", 202, json={"confirmationText": "forget"})["data"]
    assert result["operation"]["status"] == "succeeded"
    assert all(result["verification"][key] for key in ["libraryAbsent", "askAbsent", "graphAbsent", "traceAbsent"])
    assert sid not in {item["sourceId"] for item in request("GET", "/v1/knowledge/sources?workspaceId=ws_default")["data"]["sources"]}
    assert not request("POST", "/v1/knowledge/query", json={"workspaceId": "ws_default", "question": "source", "sourceIds": [sid]})["data"]["evidenceRefs"]
    assert all(node["id"] != sid for node in request("GET", "/v1/knowledge/graph?workspaceId=ws_default")["data"]["nodes"])
    assert not request("GET", f"/v1/knowledge/source/{sid}/trace")["data"]["entries"]
    assert "contentSnapshot" not in request("GET", source_endpoint)["data"]["source"]
    print(json.dumps({"check": "real_repository_file_snapshots_and_four_surface_queries", "passed": True,
                      "adapter": "MockKnowledgeServiceAdapter", "browserAcceptance": False}))
