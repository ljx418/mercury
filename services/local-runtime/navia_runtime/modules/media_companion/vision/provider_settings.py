from __future__ import annotations

import base64
import hashlib
import json
import re
import shutil
import sqlite3
import struct
import subprocess
import time
import zlib
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any, Protocol

import httpx


OPENAI_PROVIDER_ID = "openai-responses-vision"
OPENAI_ADAPTER_KIND = "openai_responses"
OPENAI_API_BASE = "https://api.openai.com/v1"
OPENAI_MODEL_ID = "gpt-4.1-mini-2025-04-14"
MINIMAX_PROVIDER_ID = "minimax-openai-vision"
MINIMAX_CN_PROVIDER_ID = "minimax-cn-openai-vision"
MINIMAX_ADAPTER_KIND = "minimax_chat_completions"
MINIMAX_API_BASE = "https://api.minimax.io/v1"
MINIMAX_CN_API_BASE = "https://api.minimaxi.com/v1"
MINIMAX_MODEL_IDS = ("MiniMax-M3", "MiniMax-M3.1-Flash-Preview")
MINIMAX_CN_MODEL_IDS = ("MiniMax-M3",)
KEYRING_SERVICE = "navia.vision-provider"
_PROVIDER_ID = re.compile(r"^[a-z][a-z0-9-]{2,63}$")

VISION_PROVIDER_CATALOG: dict[str, dict[str, Any]] = {
    OPENAI_PROVIDER_ID: {
        "id": OPENAI_PROVIDER_ID,
        "adapterKind": OPENAI_ADAPTER_KIND,
        "name": "OpenAI Vision",
        "baseUrl": OPENAI_API_BASE,
        "models": (OPENAI_MODEL_ID,),
        "defaultModel": OPENAI_MODEL_ID,
    },
    MINIMAX_PROVIDER_ID: {
        "id": MINIMAX_PROVIDER_ID,
        "adapterKind": MINIMAX_ADAPTER_KIND,
        "name": "MiniMax Vision（国际区）",
        "baseUrl": MINIMAX_API_BASE,
        "models": MINIMAX_MODEL_IDS,
        "defaultModel": MINIMAX_MODEL_IDS[0],
    },
    MINIMAX_CN_PROVIDER_ID: {
        "id": MINIMAX_CN_PROVIDER_ID,
        "adapterKind": MINIMAX_ADAPTER_KIND,
        "name": "MiniMax Vision（中国区）",
        "baseUrl": MINIMAX_CN_API_BASE,
        "models": MINIMAX_CN_MODEL_IDS,
        "defaultModel": MINIMAX_CN_MODEL_IDS[0],
    },
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class VisionProviderError(RuntimeError):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


class SecretStoreError(VisionProviderError):
    def __init__(self, code: str = "VISION_SECRET_STORE_UNAVAILABLE", message: str = "系统凭据库不可用。") -> None:
        super().__init__(code, message, 503)


class SecretStore(Protocol):
    storage_kind: str

    def set(self, reference: str, secret: str) -> None: ...
    def get(self, reference: str) -> str | None: ...
    def delete(self, reference: str) -> None: ...


class KeyringSecretStore:
    """Fail-closed adapter for native OS credential backends."""

    storage_kind = "os_keyring"

    def __init__(self, keyring_module: Any | None = None) -> None:
        try:
            if keyring_module is None:
                import keyring as keyring_module  # type: ignore[no-redef]
            backend = keyring_module.get_keyring()
        except Exception as exc:
            raise SecretStoreError(message="系统凭据库组件未安装或无法初始化。") from exc
        backend_name = f"{type(backend).__module__}.{type(backend).__name__}".lower()
        try:
            priority = float(backend.priority)
        except Exception as exc:
            raise SecretStoreError(message="系统凭据库 backend 不可用。") from exc
        if priority <= 0 or any(marker in backend_name for marker in ("fail", "null", "plaintext")):
            raise SecretStoreError(message="未检测到安全的系统凭据库 backend。")
        self._keyring = keyring_module

    def set(self, reference: str, secret: str) -> None:
        try:
            self._keyring.set_password(KEYRING_SERVICE, reference, secret)
        except Exception as exc:
            raise SecretStoreError(message="无法写入系统凭据库。") from exc

    def get(self, reference: str) -> str | None:
        try:
            return self._keyring.get_password(KEYRING_SERVICE, reference)
        except Exception as exc:
            raise SecretStoreError(message="无法读取系统凭据库。") from exc

    def delete(self, reference: str) -> None:
        try:
            if self._keyring.get_password(KEYRING_SERVICE, reference) is not None:
                self._keyring.delete_password(KEYRING_SERVICE, reference)
        except Exception as exc:
            raise SecretStoreError(message="无法删除系统凭据。") from exc


class WindowsCredentialVaultSecretStore:
    """Uses Windows PasswordVault from a WSL Runtime without exposing secrets in argv."""

    storage_kind = "windows_credential_vault"
    _resource = "Navia Vision Provider"

    def __init__(self, executable: str | None = None, runner: Callable[..., Any] = subprocess.run) -> None:
        self._executable = executable or shutil.which("powershell.exe") or ""
        self._runner = runner
        if not self._executable:
            raise SecretStoreError(message="Windows Credential Manager 不可用。")
        self._run(
            "$null=[Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime];"
            "$null=[Windows.Security.Credentials.PasswordVault]::new();Write-Output 'READY'",
            {},
            expected="READY",
        )

    def set(self, reference: str, secret: str) -> None:
        self._run(
            "$p=($input|Out-String|ConvertFrom-Json);"
            "$null=[Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime];"
            "$v=[Windows.Security.Credentials.PasswordVault]::new();"
            "try{$old=$v.Retrieve($p.resource,$p.user);$v.Remove($old)}catch{};"
            "$c=[Windows.Security.Credentials.PasswordCredential]::new($p.resource,$p.user,$p.secret);"
            "$v.Add($c);Write-Output 'OK'",
            {"resource": self._resource, "user": reference, "secret": secret},
        )

    def get(self, reference: str) -> str | None:
        output = self._run(
            "$p=($input|Out-String|ConvertFrom-Json);"
            "$null=[Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime];"
            "$v=[Windows.Security.Credentials.PasswordVault]::new();"
            "try{$c=$v.Retrieve($p.resource,$p.user);$c.RetrievePassword();"
            "$b=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($c.Password));Write-Output ('VALUE:'+ $b)}"
            "catch{Write-Output 'MISSING'}",
            {"resource": self._resource, "user": reference},
            expected=None,
        )
        if output == "MISSING":
            return None
        if not output.startswith("VALUE:"):
            raise SecretStoreError(message="Windows Credential Manager 返回无效响应。")
        try:
            return base64.b64decode(output.removeprefix("VALUE:"), validate=True).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise SecretStoreError(message="Windows Credential Manager 返回无效凭据。") from exc

    def delete(self, reference: str) -> None:
        self._run(
            "$p=($input|Out-String|ConvertFrom-Json);"
            "$null=[Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime];"
            "$v=[Windows.Security.Credentials.PasswordVault]::new();"
            "try{$c=$v.Retrieve($p.resource,$p.user);$v.Remove($c)}catch{};Write-Output 'OK'",
            {"resource": self._resource, "user": reference},
        )

    def _run(self, script: str, payload: dict[str, str], *, expected: str | None = "OK") -> str:
        try:
            completed = self._runner(
                [self._executable, "-NoProfile", "-NonInteractive", "-Command", script],
                input=json.dumps(payload, separators=(",", ":")),
                text=True,
                capture_output=True,
                timeout=10,
                check=False,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            raise SecretStoreError(message="Windows Credential Manager 调用失败。") from exc
        output = completed.stdout.strip().replace("\r", "")
        if completed.returncode != 0 or (expected is not None and output != expected):
            raise SecretStoreError(message="Windows Credential Manager 拒绝了凭据操作。")
        return output


def create_system_secret_store() -> SecretStore:
    failures: list[Exception] = []
    try:
        return KeyringSecretStore()
    except SecretStoreError as exc:
        failures.append(exc)
    try:
        return WindowsCredentialVaultSecretStore()
    except SecretStoreError as exc:
        failures.append(exc)
    raise SecretStoreError(message="未检测到可用的系统凭据库（Keyring 或 Windows Credential Manager）。") from failures[-1]


class MemorySecretStore:
    """Tests only; never selected by the Runtime."""

    storage_kind = "memory_test_only"

    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    def set(self, reference: str, secret: str) -> None:
        self.values[reference] = secret

    def get(self, reference: str) -> str | None:
        return self.values.get(reference)

    def delete(self, reference: str) -> None:
        self.values.pop(reference, None)


class UnavailableSecretStore:
    """Keeps Runtime healthy while every secret operation fails closed."""

    storage_kind = "unavailable"

    def set(self, reference: str, secret: str) -> None:
        raise SecretStoreError()

    def get(self, reference: str) -> str | None:
        raise SecretStoreError()

    def delete(self, reference: str) -> None:
        raise SecretStoreError()


def _mask(secret: str) -> str:
    if len(secret) < 8:
        return "*" * len(secret)
    return f"{secret[:3]}{'*' * min(12, len(secret) - 7)}{secret[-4:]}"


class VisionProviderStore:
    def __init__(self, db_path: str | Path, secret_store: SecretStore) -> None:
        self.secret_store = secret_store
        self._lock = RLock()
        self._conn = sqlite3.connect(Path(db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS vision_providers (
                    id TEXT PRIMARY KEY,
                    adapter_kind TEXT NOT NULL,
                    name TEXT NOT NULL,
                    base_url TEXT NOT NULL,
                    model TEXT NOT NULL,
                    secret_ref TEXT NOT NULL,
                    secret_storage TEXT NOT NULL,
                    test_status_json TEXT,
                    enabled INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS vision_provider_settings (
                    singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
                    selected_provider_id TEXT,
                    updated_at TEXT NOT NULL
                )
                """
            )

    @staticmethod
    def catalog() -> list[dict[str, Any]]:
        return [
            {
                "id": spec["id"],
                "adapterKind": spec["adapterKind"],
                "name": spec["name"],
                "baseUrl": spec["baseUrl"],
                "models": list(spec["models"]),
                "defaultModel": spec["defaultModel"],
            }
            for spec in VISION_PROVIDER_CATALOG.values()
        ]

    def selected_provider_id(self) -> str | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT selected_provider_id FROM vision_provider_settings WHERE singleton = 1"
            ).fetchone()
        return str(row["selected_provider_id"]) if row and row["selected_provider_id"] else None

    def select(self, provider_id: str) -> dict[str, Any]:
        provider = self.get(provider_id)
        if provider is None:
            raise VisionProviderError("VISION_PROVIDER_MISSING", "视觉 Provider 不存在。", 404)
        if provider.get("testStatus", {}).get("status") != "ok":
            raise VisionProviderError("VISION_PROVIDER_NOT_VERIFIED", "请先通过该 Provider 的能力测试。", 409)
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT INTO vision_provider_settings(singleton, selected_provider_id, updated_at)
                VALUES (1, ?, ?)
                ON CONFLICT(singleton) DO UPDATE SET
                    selected_provider_id=excluded.selected_provider_id,
                    updated_at=excluded.updated_at
                """,
                (provider_id, utc_now()),
            )
        return self.get(provider_id) or provider

    def list(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM vision_providers WHERE enabled = 1 ORDER BY rowid").fetchall()
        return [self._present(row) for row in rows]

    def get(self, provider_id: str, *, include_secret: bool = False) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM vision_providers WHERE id = ? AND enabled = 1", (provider_id,)).fetchone()
        if row is None:
            return None
        result = self._present(row)
        if include_secret:
            secret = self.secret_store.get(row["secret_ref"])
            if not secret:
                raise SecretStoreError("VISION_CREDENTIAL_MISSING", "系统凭据库中没有该 Provider 的密钥。")
            result["apiKey"] = secret
        return result

    def upsert(self, provider_id: str, body: dict[str, Any]) -> dict[str, Any]:
        spec = self._validate_body(provider_id, body)
        secret = str(body["apiKey"]).strip()
        reference = f"vision-provider:{provider_id}:api-key"
        existing = self.get(provider_id, include_secret=True)
        previous_secret = existing.get("apiKey") if existing else None
        self.secret_store.set(reference, secret)
        now = utc_now()
        try:
            with self._lock, self._conn:
                self._conn.execute(
                    """
                    INSERT INTO vision_providers(
                        id, adapter_kind, name, base_url, model, secret_ref, secret_storage,
                        test_status_json, enabled, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        adapter_kind=excluded.adapter_kind, name=excluded.name,
                        base_url=excluded.base_url, model=excluded.model,
                        secret_ref=excluded.secret_ref, secret_storage=excluded.secret_storage,
                        test_status_json=excluded.test_status_json, enabled=1, updated_at=excluded.updated_at
                    """,
                    (
                        provider_id,
                        spec["adapterKind"],
                        spec["name"],
                        spec["baseUrl"],
                        str(body.get("model") or spec["defaultModel"]),
                        reference,
                        self.secret_store.storage_kind,
                        json.dumps({"status": "untested", "message": "尚未执行能力测试。"}, ensure_ascii=False),
                        existing["createdAt"] if existing else now,
                        now,
                    ),
                )
        except Exception:
            if previous_secret:
                self.secret_store.set(reference, previous_secret)
            else:
                self.secret_store.delete(reference)
            raise
        configured = self.get(provider_id)
        if configured is None:
            raise VisionProviderError("VISION_PROVIDER_SAVE_FAILED", "视觉 Provider 保存失败。", 500)
        return configured

    def update_test_status(self, provider_id: str, result: dict[str, Any]) -> dict[str, Any]:
        with self._lock, self._conn:
            self._conn.execute(
                "UPDATE vision_providers SET test_status_json = ?, updated_at = ? WHERE id = ? AND enabled = 1",
                (json.dumps(result, ensure_ascii=False, separators=(",", ":")), utc_now(), provider_id),
            )
        provider = self.get(provider_id)
        if provider is None:
            raise VisionProviderError("VISION_PROVIDER_MISSING", "视觉 Provider 不存在。", 404)
        if self.selected_provider_id() is None and result.get("status") == "ok":
            return self.select(provider_id)
        return provider

    def delete(self, provider_id: str) -> None:
        with self._lock:
            row = self._conn.execute("SELECT secret_ref FROM vision_providers WHERE id = ?", (provider_id,)).fetchone()
        if row is None:
            return
        self.secret_store.delete(row["secret_ref"])
        with self._lock, self._conn:
            self._conn.execute("DELETE FROM vision_providers WHERE id = ?", (provider_id,))
            self._conn.execute(
                "UPDATE vision_provider_settings SET selected_provider_id = NULL, updated_at = ? WHERE selected_provider_id = ?",
                (utc_now(), provider_id),
            )

    def _present(self, row: sqlite3.Row) -> dict[str, Any]:
        secret = self.secret_store.get(row["secret_ref"])
        return {
            "id": row["id"],
            "adapterKind": row["adapter_kind"],
            "name": row["name"],
            "baseUrl": row["base_url"],
            "model": row["model"],
            "secretRef": row["secret_ref"],
            "secretStorage": row["secret_storage"],
            "credentialConfigured": bool(secret),
            "apiKeyMasked": _mask(secret) if secret else "",
            "testStatus": json.loads(row["test_status_json"]) if row["test_status_json"] else None,
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "selected": self.selected_provider_id() == row["id"],
        }

    @staticmethod
    def _validate_body(provider_id: str, body: dict[str, Any]) -> dict[str, Any]:
        allowed = {"adapterKind", "name", "baseUrl", "model", "apiKey"}
        if set(body) - allowed:
            raise VisionProviderError("VISION_PROVIDER_INVALID", "包含不支持的视觉 Provider 字段。")
        if not _PROVIDER_ID.fullmatch(provider_id) or provider_id not in VISION_PROVIDER_CATALOG:
            raise VisionProviderError("VISION_PROVIDER_UNSUPPORTED", "视觉 Provider 不在受控注册表中。")
        spec = VISION_PROVIDER_CATALOG[provider_id]
        if body.get("adapterKind", spec["adapterKind"]) != spec["adapterKind"]:
            raise VisionProviderError("VISION_PROVIDER_UNSUPPORTED", "视觉 Provider adapter 不受支持。")
        if body.get("baseUrl", spec["baseUrl"]) != spec["baseUrl"] or body.get("model", spec["defaultModel"]) not in spec["models"]:
            raise VisionProviderError("VISION_PROVIDER_CONTRACT_MISMATCH", "Provider 地址或模型不符合 V3-3 冻结合同。")
        secret = body.get("apiKey")
        if not isinstance(secret, str) or not 20 <= len(secret.strip()) <= 512:
            raise VisionProviderError("VISION_CREDENTIAL_INVALID", "API Key 长度无效。")
        name = body.get("name", spec["name"])
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
            raise VisionProviderError("VISION_PROVIDER_INVALID", "Provider 名称无效。")
        if name.strip() != spec["name"]:
            raise VisionProviderError("VISION_PROVIDER_CONTRACT_MISMATCH", "Provider 名称不符合受控注册表。")
        return spec


def _png_chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)


def neutral_probe_png() -> bytes:
    width, height = 256, 128
    colors = ((28, 112, 104), (242, 246, 245), (218, 78, 68), (246, 191, 38))
    rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            row.extend(colors[(x // 64 + y // 64) % len(colors)])
        rows.append(bytes(row))
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", header) + _png_chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + _png_chunk(b"IEND", b"")


class OpenAIResponsesVisionAdapter:
    def __init__(self, client_factory: Callable[[], httpx.Client] | None = None) -> None:
        self.client_factory = client_factory or (lambda: httpx.Client(timeout=30.0, follow_redirects=False))

    def test(self, provider: dict[str, Any]) -> dict[str, Any]:
        image = neutral_probe_png()
        schema = {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "minLength": 1, "maxLength": 240},
                "containsText": {"type": "boolean"},
                "dominantColors": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 4},
            },
            "required": ["summary", "containsText", "dominantColors"],
            "additionalProperties": False,
        }
        payload = {
            "model": provider["model"],
            "input": [{"role": "user", "content": [
                {"type": "input_text", "text": "Describe only visible colors and geometry in this generated neutral test image."},
                {"type": "input_image", "image_url": "data:image/png;base64," + base64.b64encode(image).decode("ascii"), "detail": "low"},
            ]}],
            "text": {"format": {"type": "json_schema", "name": "navia_v3_vision_capability", "strict": True, "schema": schema}},
            "store": False,
            "max_output_tokens": 300,
        }
        started = time.monotonic()
        try:
            with self.client_factory() as client:
                response = client.post(
                    provider["baseUrl"].rstrip("/") + "/responses",
                    headers={"Authorization": f"Bearer {provider['apiKey']}", "Content-Type": "application/json"},
                    json=payload,
                )
            response.raise_for_status()
            result = response.json()
            if result.get("status") != "completed" or result.get("model") != provider["model"]:
                raise ValueError("model_or_status")
            usage = result.get("usage")
            if not isinstance(usage, dict) or any(type(usage.get(key)) is not int for key in ("input_tokens", "output_tokens", "total_tokens")):
                raise ValueError("usage")
            output_text = next(
                (
                    content.get("text")
                    for item in result.get("output", []) if isinstance(item, dict) and item.get("type") == "message"
                    for content in item.get("content", []) if isinstance(content, dict) and content.get("type") == "output_text"
                ),
                None,
            )
            observation = json.loads(output_text) if isinstance(output_text, str) else None
            if not isinstance(observation, dict) or set(observation) != {"summary", "containsText", "dominantColors"}:
                raise ValueError("structured_output")
            if not isinstance(observation["summary"], str) or not 1 <= len(observation["summary"]) <= 240:
                raise ValueError("structured_output")
            if type(observation["containsText"]) is not bool:
                raise ValueError("structured_output")
            colors = observation["dominantColors"]
            if not isinstance(colors, list) or not 1 <= len(colors) <= 4 or any(not isinstance(item, str) or not item for item in colors):
                raise ValueError("structured_output")
        except (httpx.HTTPError, ValueError, json.JSONDecodeError) as exc:
            raise VisionProviderError("VISION_PROVIDER_TEST_FAILED", "视觉 Provider 能力测试失败。", 502) from exc
        return {
            "status": "ok",
            "model": result["model"],
            "latencyMs": round((time.monotonic() - started) * 1000),
            "usage": {key: usage[key] for key in ("input_tokens", "output_tokens", "total_tokens")},
            "observation": observation,
            "imageSha256": hashlib.sha256(image).hexdigest(),
            "containsUserContent": False,
            "store": False,
            "testedAt": utc_now(),
        }

    def analyze_frame(self, provider: dict[str, Any], image: bytes) -> dict[str, Any]:
        schema = {
            "type": "object",
            "properties": {"caption": {"type": "string", "minLength": 1, "maxLength": 2000}},
            "required": ["caption"],
            "additionalProperties": False,
        }
        payload = {
            "model": provider["model"],
            "input": [{"role": "user", "content": [
                {"type": "input_text", "text": "Describe only directly visible people, objects, actions, layout, and on-screen text. Do not infer unstated context."},
                {"type": "input_image", "image_url": "data:image/png;base64," + base64.b64encode(image).decode("ascii"), "detail": "low"},
            ]}],
            "text": {"format": {"type": "json_schema", "name": "navia_v3_frame_caption", "strict": True, "schema": schema}},
            "store": False,
            "max_output_tokens": 500,
        }
        started = time.monotonic()
        try:
            with self.client_factory() as client:
                response = client.post(
                    provider["baseUrl"].rstrip("/") + "/responses",
                    headers={"Authorization": f"Bearer {provider['apiKey']}", "Content-Type": "application/json"},
                    json=payload,
                )
            response.raise_for_status()
            result = response.json()
            output_text = next((content.get("text") for item in result.get("output", []) if isinstance(item, dict) for content in item.get("content", []) if isinstance(content, dict) and content.get("type") == "output_text"), None)
            parsed = json.loads(output_text) if isinstance(output_text, str) else None
            raw_usage = result.get("usage")
            if result.get("status") != "completed" or result.get("model") != provider["model"] or not isinstance(parsed, dict) or set(parsed) != {"caption"} or not isinstance(parsed["caption"], str) or not 1 <= len(parsed["caption"].strip()) <= 2000 or not isinstance(raw_usage, dict):
                raise ValueError("vision_response")
            usage = {"inputTokens": raw_usage.get("input_tokens"), "outputTokens": raw_usage.get("output_tokens"), "estimatedCostUsd": None}
            if any(value is not None and type(value) is not int for value in (usage["inputTokens"], usage["outputTokens"])):
                raise ValueError("vision_usage")
        except httpx.TimeoutException as exc:
            raise VisionProviderError("VISION_TIMEOUT", "视觉 Provider 请求超时。", 504) from exc
        except httpx.HTTPStatusError as exc:
            code = "VISION_RATE_LIMITED" if exc.response.status_code == 429 else "VISION_PROVIDER_UNAVAILABLE"
            raise VisionProviderError(code, "视觉 Provider 请求失败。", 503) from exc
        except (httpx.HTTPError, ValueError, json.JSONDecodeError) as exc:
            raise VisionProviderError("VISION_RESPONSE_INVALID", "视觉 Provider 返回无效响应。", 502) from exc
        return {"caption": parsed["caption"].strip(), "model": result["model"], "usage": usage, "latencyMs": round((time.monotonic() - started) * 1000)}


def _parse_probe_observation(raw: str) -> dict[str, Any]:
    candidate = raw.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*|\s*```$", "", candidate, flags=re.IGNORECASE)
    try:
        observation = json.loads(candidate)
    except json.JSONDecodeError:
        start, end = candidate.find("{"), candidate.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("structured_output") from None
        observation = json.loads(candidate[start : end + 1])
    if not isinstance(observation, dict) or set(observation) != {"summary", "containsText", "dominantColors"}:
        raise ValueError("structured_output")
    if not isinstance(observation["summary"], str) or not 1 <= len(observation["summary"]) <= 240:
        raise ValueError("structured_output")
    if type(observation["containsText"]) is not bool:
        raise ValueError("structured_output")
    colors = observation["dominantColors"]
    if not isinstance(colors, list) or not 1 <= len(colors) <= 4 or any(not isinstance(item, str) or not item for item in colors):
        raise ValueError("structured_output")
    return observation


class MiniMaxChatVisionAdapter:
    """Pinned MiniMax OpenAI-compatible multimodal adapter."""

    def __init__(self, client_factory: Callable[[], httpx.Client] | None = None) -> None:
        self.client_factory = client_factory or (lambda: httpx.Client(timeout=120.0, follow_redirects=False))

    def test(self, provider: dict[str, Any]) -> dict[str, Any]:
        image = neutral_probe_png()
        prompt = (
            "Inspect only this generated neutral test image. Return exactly one raw JSON object, "
            "no Markdown and no reasoning. Required keys: summary (a string no longer than 120 characters), "
            "containsText (boolean), and dominantColors (1 to 4 short color strings)."
        )
        payload = {
            "model": provider["model"],
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "data:image/png;base64," + base64.b64encode(image).decode("ascii"),
                            "detail": "low",
                        },
                    },
                ],
            }],
            "thinking": {"type": "disabled"},
            "temperature": 0.1,
            "max_completion_tokens": 300,
            "stream": False,
        }
        started = time.monotonic()
        try:
            with self.client_factory() as client:
                response = client.post(
                    provider["baseUrl"].rstrip("/") + "/chat/completions",
                    headers={"Authorization": f"Bearer {provider['apiKey']}", "Content-Type": "application/json"},
                    json=payload,
                )
            response.raise_for_status()
            result = response.json()
            if result.get("model") != provider["model"]:
                raise ValueError("model")
            base_response = result.get("base_resp")
            if isinstance(base_response, dict) and base_response.get("status_code", 0) != 0:
                raise ValueError("provider_status")
            choices = result.get("choices")
            if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
                raise ValueError("choices")
            message = choices[0].get("message")
            if not isinstance(message, dict) or not isinstance(message.get("content"), str):
                raise ValueError("content")
            observation = _parse_probe_observation(message["content"])
            raw_usage = result.get("usage")
            if not isinstance(raw_usage, dict) or any(
                type(raw_usage.get(key)) is not int for key in ("prompt_tokens", "completion_tokens", "total_tokens")
            ):
                raise ValueError("usage")
            usage = {
                "input_tokens": raw_usage["prompt_tokens"],
                "output_tokens": raw_usage["completion_tokens"],
                "total_tokens": raw_usage["total_tokens"],
            }
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in (401, 403):
                raise VisionProviderError(
                    "VISION_CREDENTIAL_REGION_MISMATCH",
                    "MiniMax API Key 与所选区域不匹配或没有模型访问权限，请切换中国区/国际区后重试。",
                    401,
                ) from exc
            raise VisionProviderError("VISION_PROVIDER_TEST_FAILED", "MiniMax 视觉 Provider 能力测试失败。", 502) from exc
        except (httpx.HTTPError, ValueError, json.JSONDecodeError) as exc:
            raise VisionProviderError("VISION_PROVIDER_TEST_FAILED", "MiniMax 视觉 Provider 能力测试失败。", 502) from exc
        return {
            "status": "ok",
            "model": result["model"],
            "latencyMs": round((time.monotonic() - started) * 1000),
            "usage": usage,
            "observation": observation,
            "imageSha256": hashlib.sha256(image).hexdigest(),
            "containsUserContent": False,
            "store": False,
            "testedAt": utc_now(),
        }

    def analyze_frame(self, provider: dict[str, Any], image: bytes) -> dict[str, Any]:
        prompt = (
            "Describe only directly visible people, objects, actions, layout, and on-screen text in this single frame. "
            "Do not infer unstated context. Return exactly one raw JSON object with one key caption, whose value is a concise string no longer than 1000 characters."
        )
        payload = {
            "model": provider["model"],
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(image).decode("ascii"), "detail": "low"}},
            ]}],
            "thinking": {"type": "disabled"},
            "temperature": 0.1,
            "max_completion_tokens": 500,
            "stream": False,
        }
        started = time.monotonic()
        try:
            with self.client_factory() as client:
                response = client.post(
                    provider["baseUrl"].rstrip("/") + "/chat/completions",
                    headers={"Authorization": f"Bearer {provider['apiKey']}", "Content-Type": "application/json"},
                    json=payload,
                )
            response.raise_for_status()
            result = response.json()
            base_response = result.get("base_resp")
            if isinstance(base_response, dict) and base_response.get("status_code", 0) != 0:
                raise ValueError("provider_status")
            choices = result.get("choices")
            message = choices[0].get("message") if isinstance(choices, list) and choices and isinstance(choices[0], dict) else None
            candidate = message.get("content") if isinstance(message, dict) else None
            if not isinstance(candidate, str):
                raise ValueError("vision_content")
            candidate = candidate.strip()
            if candidate.startswith("```"):
                candidate = re.sub(r"^```(?:json)?\s*|\s*```$", "", candidate, flags=re.IGNORECASE)
            parsed = json.loads(candidate)
            raw_usage = result.get("usage")
            if result.get("model") != provider["model"] or not isinstance(parsed, dict) or set(parsed) != {"caption"} or not isinstance(parsed["caption"], str) or not parsed["caption"].strip() or not isinstance(raw_usage, dict):
                raise ValueError("vision_response")
            caption = parsed["caption"].strip()[:1000].rstrip()
            usage = {"inputTokens": raw_usage.get("prompt_tokens"), "outputTokens": raw_usage.get("completion_tokens"), "estimatedCostUsd": None}
            if any(value is not None and type(value) is not int for value in (usage["inputTokens"], usage["outputTokens"])):
                raise ValueError("vision_usage")
        except httpx.TimeoutException as exc:
            raise VisionProviderError("VISION_TIMEOUT", "视觉 Provider 请求超时。", 504) from exc
        except httpx.HTTPStatusError as exc:
            code = "VISION_RATE_LIMITED" if exc.response.status_code == 429 else "VISION_PROVIDER_UNAVAILABLE"
            raise VisionProviderError(code, "视觉 Provider 请求失败。", 503) from exc
        except (httpx.HTTPError, ValueError, json.JSONDecodeError) as exc:
            raise VisionProviderError("VISION_RESPONSE_INVALID", "视觉 Provider 返回无效响应。", 502) from exc
        return {"caption": caption, "model": result["model"], "usage": usage, "latencyMs": round((time.monotonic() - started) * 1000)}


class VisionProviderAdapterRegistry:
    def __init__(
        self,
        openai: OpenAIResponsesVisionAdapter | None = None,
        minimax: MiniMaxChatVisionAdapter | None = None,
    ) -> None:
        self._adapters = {
            OPENAI_ADAPTER_KIND: openai or OpenAIResponsesVisionAdapter(),
            MINIMAX_ADAPTER_KIND: minimax or MiniMaxChatVisionAdapter(),
        }

    def test(self, provider: dict[str, Any]) -> dict[str, Any]:
        adapter = self._adapters.get(str(provider.get("adapterKind")))
        if adapter is None:
            raise VisionProviderError("VISION_PROVIDER_UNSUPPORTED", "视觉 Provider adapter 不受支持。")
        return adapter.test(provider)

    def analyze_frame(self, provider: dict[str, Any], image: bytes) -> dict[str, Any]:
        adapter = self._adapters.get(str(provider.get("adapterKind")))
        if adapter is None:
            raise VisionProviderError("VISION_PROVIDER_UNAVAILABLE", "视觉 Provider adapter 不可用。", 503)
        return adapter.analyze_frame(provider, image)
