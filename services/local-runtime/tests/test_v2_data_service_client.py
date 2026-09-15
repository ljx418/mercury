from __future__ import annotations

import json
import threading
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from jsonschema import Draft202012Validator
import pytest

from navia_runtime.modules.memory.data_service_client import DataServiceClientConfig, DataServiceClientError, DataServiceHttpClient


class _Server:
    def __init__(self, *, require_key: bool = False, malformed_status: bool = False) -> None:
        self.require_key = require_key
        self.malformed_status = malformed_status
        self.requests: list[dict[str, Any]] = []
        server_ref = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                server_ref._record(self)
                if server_ref._auth_failed(self):
                    return
                if self.path.startswith("/api/workspaces?"):
                    if server_ref.malformed_status:
                        self._send({"unexpected": True})
                        return
                    self._send({"status": "ok", "workspace_id": "_list", "data": {"items": []}})
                    return
                if self.path == "/api/workspaces/ws_default/sources/src_123/trace":
                    self._send({
                        "status": "ok",
                        "workspace_id": "ws_default",
                        "data": {"trace": {"source_id": "src_123", "trace_available": True}},
                    })
                    return
                self.send_error(404)

            def do_POST(self) -> None:  # noqa: N802
                server_ref._record(self)
                if server_ref._auth_failed(self):
                    return
                if self.path == "/api/workspaces":
                    self._send({"status": "ok", "workspace_id": "ws_default", "data": {"workspace": {"workspace_id": "ws_default"}}})
                    return
                if self.path == "/api/workspaces/ws_default/sources":
                    self._send({
                        "status": "ok",
                        "workspace_id": "ws_default",
                        "data": {"sources": [{"source_id": "src_123", "status": "active", "artifact_ref": "source://src_123"}]},
                    })
                    return
                if self.path == "/api/workspaces/ws_default/sources/src_123/remove":
                    self._send({"status": "ok", "workspace_id": "ws_default", "data": {"source": {"source_id": "src_123", "status": "removed"}}})
                    return
                self.send_error(404)

            def log_message(self, _format: str, *_args: Any) -> None:
                return

            def _send(self, body: dict[str, Any], *, status: int = 200) -> None:
                raw = json.dumps(body).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    @property
    def base_url(self) -> str:
        host, port = self.httpd.server_address
        return f"http://{host}:{port}"

    def close(self) -> None:
        self.httpd.shutdown()
        self.thread.join(timeout=3)
        self.httpd.server_close()

    def _auth_failed(self, handler: BaseHTTPRequestHandler) -> bool:
        if not self.require_key:
            return False
        if handler.headers.get("X-API-Key") == "target-key":
            return False
        raw = json.dumps({"detail": "Unauthorized"}).encode("utf-8")
        handler.send_response(401)
        handler.send_header("Content-Type", "application/json")
        handler.send_header("Content-Length", str(len(raw)))
        handler.end_headers()
        handler.wfile.write(raw)
        return True

    def _record(self, handler: BaseHTTPRequestHandler) -> None:
        length = int(handler.headers.get("Content-Length", "0") or "0")
        body = handler.rfile.read(length).decode("utf-8") if length else ""
        self.requests.append({
            "method": handler.command,
            "path": handler.path,
            "apiKey": handler.headers.get("X-API-Key"),
            "body": json.loads(body) if body else None,
        })


def test_v2_data_service_client_probe_connected_and_schema_valid() -> None:
    server = _Server()
    try:
        status = DataServiceHttpClient(DataServiceClientConfig(base_url=server.base_url)).probe_status()
    finally:
        server.close()

    assert status["adapterStatus"] == "ready"
    assert status["dataServiceStatus"] == "connected"
    Draft202012Validator({
        "type": "object",
        "required": ["schemaVersion", "adapterStatus", "dataServiceStatus", "capabilities"],
    }).validate(status)


def test_v2_data_service_client_maps_auth_required_and_sends_api_key() -> None:
    server = _Server(require_key=True)
    try:
        without_key = DataServiceHttpClient(DataServiceClientConfig(base_url=server.base_url)).probe_status()
        with_key = DataServiceHttpClient(DataServiceClientConfig(base_url=server.base_url, api_key="target-key")).probe_status()
    finally:
        server.close()

    assert without_key["dataServiceStatus"] == "auth_required"
    assert without_key["userAction"] == "configure_data_service"
    assert with_key["dataServiceStatus"] == "connected"
    assert any(request["apiKey"] == "target-key" for request in server.requests)


def test_v2_data_service_client_maps_http_5xx_to_unreachable() -> None:
    error = urllib.error.HTTPError("http://127.0.0.1:8003", 503, "unavailable", {}, None)
    with pytest.raises(DataServiceClientError, match="temporarily unavailable") as failure:
        DataServiceHttpClient._raise_http_error(error)
    assert failure.value.code == "DATA_SERVICE_UNREACHABLE"


def test_v2_data_service_client_source_lifecycle_mapping() -> None:
    server = _Server()
    client = DataServiceHttpClient(DataServiceClientConfig(base_url=server.base_url))
    try:
        workspace = client.create_workspace(name="Navia V2")
        imported = client.import_text_source(
            workspace_id="ws_default",
            title="Saved page",
            content="Captured page summary and evidence quote.",
            metadata={"sourceType": "web_page"},
        )
        trace = client.source_trace(workspace_id="ws_default", source_id="src_123")
        removed = client.remove_source(workspace_id="ws_default", source_id="src_123", reason="forget")
    finally:
        server.close()

    assert workspace["data"]["workspace"]["workspace_id"] == "ws_default"
    assert imported["data"]["sources"][0]["source_id"] == "src_123"
    assert trace["data"]["trace"]["source_id"] == "src_123"
    assert removed["data"]["source"]["status"] == "removed"
    source_request = next(request for request in server.requests if request["path"] == "/api/workspaces/ws_default/sources")
    assert source_request["body"]["texts"][0]["title"] == "Saved page"
    assert source_request["body"]["texts"][0]["metadata"]["sourceType"] == "web_page"


def test_v2_data_service_client_maps_malformed_response_to_version_mismatch() -> None:
    server = _Server(malformed_status=True)
    try:
        status = DataServiceHttpClient(DataServiceClientConfig(base_url=server.base_url)).probe_status()
    finally:
        server.close()

    assert status["adapterStatus"] == "blocked"
    assert status["dataServiceStatus"] == "version_mismatch"
    assert status["userAction"] == "upgrade_data_service"
