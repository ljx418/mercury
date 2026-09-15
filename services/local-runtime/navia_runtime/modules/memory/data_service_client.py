from __future__ import annotations

import json
import socket
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

from navia_runtime.contracts import utc_now


class DataServiceClientError(RuntimeError):
    def __init__(self, code: str, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code


@dataclass(frozen=True)
class DataServiceClientConfig:
    base_url: str
    api_key: str | None = None
    timeout_seconds: float = 2.5


class DataServiceHttpClient:
    """Controlled HTTP boundary for the external data_service candidate.

    This client intentionally exposes only sanitized request/response helpers.
    It never reads data_service workspaces or local files directly.
    """

    def __init__(self, config: DataServiceClientConfig) -> None:
        self.config = config
        self.base_url = config.base_url.rstrip("/")

    def probe_status(self) -> dict[str, Any]:
        try:
            payload = self._request("GET", "/api/workspaces", query={"limit": "1"})
        except DataServiceClientError as exc:
            return {
                "schemaVersion": "v2-knowledge-status-draft-2026-07-10",
                "observedAt": utc_now(),
                "frontendInferredRuntimeStatus": "online",
                "runtimeStatus": "online",
                "adapterStatus": "degraded" if exc.code in {"DATA_SERVICE_UNREACHABLE", "DATA_SERVICE_AUTH_REQUIRED"} else "blocked",
                "dataServiceStatus": self._status_from_error(exc),
                "sourceBuildStatus": "not_saved",
                "capabilities": self._capabilities(False),
                "userAction": self._action_from_error(exc),
                "message": str(exc),
                "redactionApplied": True,
            }
        if not isinstance(payload, dict) or "status" not in payload:
            return {
                "schemaVersion": "v2-knowledge-status-draft-2026-07-10",
                "observedAt": utc_now(),
                "frontendInferredRuntimeStatus": "online",
                "runtimeStatus": "online",
                "adapterStatus": "blocked",
                "dataServiceStatus": "version_mismatch",
                "sourceBuildStatus": "not_saved",
                "capabilities": self._capabilities(False),
                "userAction": "upgrade_data_service",
                "message": "data_service response does not match the expected target HTTP envelope.",
                "redactionApplied": True,
            }
        return {
            "schemaVersion": "v2-knowledge-status-draft-2026-07-10",
            "observedAt": utc_now(),
            "frontendInferredRuntimeStatus": "online",
            "runtimeStatus": "online",
            "adapterStatus": "ready",
            "dataServiceStatus": "connected",
            "sourceBuildStatus": "not_saved",
            "capabilities": self._capabilities(True),
            "userAction": "none",
            "message": "data_service target HTTP boundary is reachable. Product default remains mock-first unless explicitly configured.",
            "redactionApplied": True,
        }

    def list_workspaces(self, *, limit: int = 20) -> dict[str, Any]:
        return self._request("GET", "/api/workspaces", query={"limit": str(limit)})

    def create_workspace(self, *, name: str, owner: str | None = None, tags: list[str] | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"name": name}
        if owner:
            body["owner"] = owner
        if tags:
            body["tags"] = tags
        return self._request("POST", "/api/workspaces", body=body)

    def describe_workspace(self, *, workspace_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/api/workspaces/{urllib.parse.quote(workspace_id, safe='')}",
        )

    def list_sources(self, *, workspace_id: str, limit: int = 100) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/api/workspaces/{urllib.parse.quote(workspace_id, safe='')}/sources",
            query={"limit": str(limit)},
        )

    def describe_source(self, *, workspace_id: str, source_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/api/workspaces/{urllib.parse.quote(workspace_id, safe='')}/sources/{urllib.parse.quote(source_id, safe='')}",
        )

    def import_text_source(self, *, workspace_id: str, title: str, content: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/workspaces/{urllib.parse.quote(workspace_id, safe='')}/sources",
            body={
                "texts": [
                    {
                        "title": title,
                        "content": content,
                        "metadata": metadata or {},
                    }
                ]
            },
        )

    def source_trace(self, *, workspace_id: str, source_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/api/workspaces/{urllib.parse.quote(workspace_id, safe='')}/sources/{urllib.parse.quote(source_id, safe='')}/trace",
        )

    def start_build(self, *, workspace_id: str, mode: str = "incremental") -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/workspaces/{urllib.parse.quote(workspace_id, safe='')}/build/start",
            body={"mode": mode},
        )

    def build_status(self, *, workspace_id: str, operation_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/api/workspaces/{urllib.parse.quote(workspace_id, safe='')}/build/operations/{urllib.parse.quote(operation_id, safe='')}",
        )

    def remove_source(self, *, workspace_id: str, source_id: str, reason: str = "navia_forget") -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/workspaces/{urllib.parse.quote(workspace_id, safe='')}/sources/{urllib.parse.quote(source_id, safe='')}/remove",
            body={"reason": reason},
        )

    def _request(
        self,
        method: str,
        path: str,
        *,
        query: dict[str, str] | None = None,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        if query:
            url = f"{url}?{urllib.parse.urlencode(query)}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if self.config.api_key:
            headers["X-API-Key"] = self.config.api_key
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=self.config.timeout_seconds) as response:
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            self._raise_http_error(exc)
        except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
            raise DataServiceClientError("DATA_SERVICE_UNREACHABLE", "data_service is unreachable through the configured HTTP boundary.") from exc
        try:
            parsed = json.loads(raw or "{}")
        except json.JSONDecodeError as exc:
            raise DataServiceClientError("DATA_SERVICE_VERSION_MISMATCH", "data_service returned non-JSON response.", status_code=None) from exc
        if not isinstance(parsed, dict):
            raise DataServiceClientError("DATA_SERVICE_VERSION_MISMATCH", "data_service returned an unsupported JSON shape.")
        return parsed

    @staticmethod
    def _capabilities(enabled: bool) -> dict[str, bool]:
        return {
            "workspace": enabled,
            "sourceImport": enabled,
            "buildStatus": enabled,
            "query": enabled,
            "graph": enabled,
            "sourceTrace": enabled,
            "forgetVerification": enabled,
        }

    @staticmethod
    def _status_from_error(exc: DataServiceClientError) -> str:
        if exc.code == "DATA_SERVICE_AUTH_REQUIRED":
            return "auth_required"
        if exc.code == "DATA_SERVICE_UNREACHABLE":
            return "unreachable"
        if exc.code == "DATA_SERVICE_VERSION_MISMATCH":
            return "version_mismatch"
        return "blocked_by_policy"

    @staticmethod
    def _action_from_error(exc: DataServiceClientError) -> str:
        if exc.code == "DATA_SERVICE_AUTH_REQUIRED":
            return "configure_data_service"
        if exc.code == "DATA_SERVICE_UNREACHABLE":
            return "reconnect"
        if exc.code == "DATA_SERVICE_VERSION_MISMATCH":
            return "upgrade_data_service"
        return "open_debug"

    @staticmethod
    def _raise_http_error(exc: urllib.error.HTTPError) -> None:
        if exc.code in {401, 403}:
            raise DataServiceClientError("DATA_SERVICE_AUTH_REQUIRED", "data_service requires a valid API key.", status_code=exc.code) from exc
        if 500 <= exc.code <= 599:
            raise DataServiceClientError("DATA_SERVICE_UNREACHABLE", "data_service is temporarily unavailable through the configured HTTP boundary.", status_code=exc.code) from exc
        if exc.code in {404, 409, 422}:
            raise DataServiceClientError("DATA_SERVICE_POLICY_BLOCKED", f"data_service rejected the request with HTTP {exc.code}.", status_code=exc.code) from exc
        raise DataServiceClientError("DATA_SERVICE_VERSION_MISMATCH", f"data_service returned HTTP {exc.code}.", status_code=exc.code) from exc
