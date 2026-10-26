from __future__ import annotations

import json
import os
import sqlite3
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from time import perf_counter
from typing import Any, Protocol

import httpx
from jsonschema import Draft202012Validator

from navia_runtime.contracts import utc_now
from navia_runtime.runtime_profile import default_profiles, normalize_profile


DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash"
DEFAULT_DEEPSEEK_MODELS = ("deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner")
DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io/v1"
DEFAULT_MINIMAX_MODEL = "MiniMax-M3"
DEFAULT_MINIMAX_MODELS = ("MiniMax-M3", "MiniMax-M3.1-Flash-Preview")
SUPPORTED_LLM_PROVIDER_TYPES = {"deepseek", "minimax"}
ALLOWED_CORE_PROVIDERS = {"mock", "llm_direct", "piagent", "custom"}
V1_10_PIAGENT_DEFAULT_MARKER = "v1_10_piagent_default_applied"
V1_10_MANUAL_CORE_PROVIDER_MARKER = "v1_10_manual_core_provider_saved"


class ProviderSettingsError(RuntimeError):
    def __init__(self, message: str, *, code: str = "provider_error", recoverable: bool = True) -> None:
        super().__init__(message)
        self.code = code
        self.recoverable = recoverable


class ProviderMissingError(ProviderSettingsError):
    def __init__(self) -> None:
        super().__init__("Provider is not configured. Open Settings to add a model provider.", code="provider_missing")


class ProviderIncompleteError(ProviderSettingsError):
    def __init__(self) -> None:
        super().__init__("Provider configuration is incomplete. Open Settings to update it.", code="provider_incomplete")


class ProviderSecretStore(Protocol):
    storage_kind: str

    def set(self, reference: str, secret: str) -> None: ...
    def get(self, reference: str) -> str | None: ...
    def delete(self, reference: str) -> None: ...


def configured_deepseek_models() -> list[str]:
    configured = os.environ.get("NAVIA_DEEPSEEK_MODELS")
    if configured:
        models = [model.strip() for model in configured.split(",") if model.strip()]
        if models:
            return models
    return list(DEFAULT_DEEPSEEK_MODELS)


def configured_deepseek_default_model(models: list[str]) -> str:
    preferred = os.environ.get("NAVIA_DEEPSEEK_DEFAULT_MODEL") or DEFAULT_DEEPSEEK_MODEL
    return preferred if preferred in models else models[0]


def mask_api_key(api_key: str) -> str:
    if len(api_key) <= 8:
        return "********"
    return f"{api_key[:4]}****{api_key[-4:]}"


def _to_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _from_json(value: str | None, default: Any) -> Any:
    if not value:
        return default
    return json.loads(value)


@dataclass
class DeepSeekProvider:
    provider: dict[str, Any]
    client_factory: Callable[[], httpx.Client] = lambda: httpx.Client(timeout=30.0)

    def test(self) -> dict[str, Any]:
        start = perf_counter()
        if self.provider.get("type") == "deepseek":
            return self._test_deepseek_strict_structure(start)
        try:
            with self.client_factory() as client:
                response = client.post(
                    self._chat_url(),
                    headers=self._headers(),
                    json={
                        "model": self.provider["defaultModel"],
                        "messages": [{"role": "user", "content": "ping"}],
                        "stream": False,
                        "max_tokens": 1,
                    },
                )
                response.raise_for_status()
        except Exception as exc:  # httpx wraps transport and status failures separately.
            raise RuntimeError(f"Provider connection test failed: {exc}") from exc
        return {
            "status": "ok",
            "latencyMs": max(1, round((perf_counter() - start) * 1000)),
            "message": "API Key 校验成功，连接正常。",
        }

    def _test_deepseek_strict_structure(self, start: float) -> dict[str, Any]:
        if self.provider.get("defaultModel") != "deepseek-chat":
            raise RuntimeError("DeepSeek 结构化视频理解当前仅验证 deepseek-chat，请先手动选择该模型。")
        schema = {
            "type": "object",
            "additionalProperties": False,
            "required": ["ok", "nonce"],
            "properties": {
                "ok": {"type": "boolean", "enum": [True]},
                "nonce": {"type": "string", "enum": ["navia-structure-check-v1"]},
            },
        }
        try:
            with self.client_factory() as client:
                response = client.post(
                    f"{str(self.provider['baseUrl']).rstrip('/')}/beta/chat/completions",
                    headers=self._headers(),
                    json={
                        "model": "deepseek-chat",
                        "messages": [{"role": "user", "content": "Call the required tool with the fixed values."}],
                        "tools": [{"type": "function", "function": {
                            "name": "confirm_navia_structure_capability",
                            "description": "Confirm strict structured-output capability.",
                            "strict": True,
                            "parameters": schema,
                        }}],
                        "tool_choice": {"type": "function", "function": {"name": "confirm_navia_structure_capability"}},
                        "temperature": 0,
                        "max_tokens": 128,
                        "stream": False,
                    },
                )
                response.raise_for_status()
                body = response.json()
            calls = body["choices"][0]["message"]["tool_calls"]
            if len(calls) != 1 or calls[0]["function"]["name"] != "confirm_navia_structure_capability":
                raise ValueError("strict tool call missing")
            value = json.loads(calls[0]["function"]["arguments"])
            if list(Draft202012Validator(schema).iter_errors(value)):
                raise ValueError("strict tool payload invalid")
        except Exception as exc:
            raise RuntimeError(f"Provider strict structure test failed: {type(exc).__name__}") from exc
        return {
            "status": "ok",
            "latencyMs": max(1, round((perf_counter() - start) * 1000)),
            "message": "API Key 与严格结构能力校验成功。",
            "capabilities": {"structuredOutput": "deepseek_beta_strict_tool_v1"},
        }

    def stream_chat(self, prompt: str, *, page_context: dict[str, Any] | None = None) -> Iterable[str]:
        messages = [
            {
                "role": "system",
                "content": "You are Navia, a concise companion reading assistant. Answer using the submitted page context when available.",
            }
        ]
        if page_context:
            messages.append({"role": "system", "content": f"Page context:\n{json.dumps(page_context, ensure_ascii=False)[:12000]}"})
        messages.append({"role": "user", "content": prompt})
        try:
            with self.client_factory() as client:
                with client.stream(
                    "POST",
                    self._chat_url(),
                    headers=self._headers(),
                    json={"model": self.provider["defaultModel"], "messages": messages, "stream": True},
                ) as response:
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if not line.startswith("data:"):
                            continue
                        payload = line[5:].strip()
                        if not payload or payload == "[DONE]":
                            continue
                        try:
                            data = json.loads(payload)
                        except json.JSONDecodeError:
                            continue
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        text = delta.get("content")
                        if isinstance(text, str) and text:
                            yield text
        except Exception as exc:
            raise RuntimeError(f"Provider chat stream failed: {exc}") from exc

    def _chat_url(self) -> str:
        return f"{str(self.provider['baseUrl']).rstrip('/')}/chat/completions"

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.provider['apiKey']}", "Content-Type": "application/json"}


class ProviderRegistry:
    def __init__(self, store: "SettingsStore", client_factory: Callable[[], httpx.Client] | None = None) -> None:
        self.store = store
        self.client_factory = client_factory or (lambda: httpx.Client(timeout=30.0))

    def get_default_provider(self) -> DeepSeekProvider:
        provider = self.store.get_default_provider(include_secret=True)
        if provider is None:
            raise ProviderMissingError()
        if not provider.get("apiKey") or not provider.get("baseUrl") or not provider.get("defaultModel"):
            raise ProviderIncompleteError()
        if provider.get("type") not in SUPPORTED_LLM_PROVIDER_TYPES:
            raise ProviderSettingsError("The selected model provider is not supported.", code="provider_unsupported")
        return DeepSeekProvider(provider, self.client_factory)


class SettingsStore:
    def __init__(self, db_path: str | Path, secret_store: ProviderSecretStore) -> None:
        self.db_path = Path(db_path)
        self.secret_store = secret_store
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS llm_settings (
                    id TEXT PRIMARY KEY,
                    default_provider_id TEXT,
                    default_model TEXT,
                    core_provider TEXT,
                    chat_provider_json TEXT,
                    default_profile TEXT,
                    profiles_json TEXT,
                    settings_migration_json TEXT,
                    updated_at TEXT NOT NULL
                )
                """
            )
            settings_columns = {row["name"] for row in self._conn.execute("PRAGMA table_info(llm_settings)").fetchall()}
            if "core_provider" not in settings_columns:
                self._conn.execute("ALTER TABLE llm_settings ADD COLUMN core_provider TEXT")
            if "chat_provider_json" not in settings_columns:
                self._conn.execute("ALTER TABLE llm_settings ADD COLUMN chat_provider_json TEXT")
            if "default_profile" not in settings_columns:
                self._conn.execute("ALTER TABLE llm_settings ADD COLUMN default_profile TEXT")
            if "profiles_json" not in settings_columns:
                self._conn.execute("ALTER TABLE llm_settings ADD COLUMN profiles_json TEXT")
            if "settings_migration_json" not in settings_columns:
                self._conn.execute("ALTER TABLE llm_settings ADD COLUMN settings_migration_json TEXT")
            self._create_provider_table()
            columns = {row["name"] for row in self._conn.execute("PRAGMA table_info(llm_providers)").fetchall()}
            if columns and "id" not in columns:
                self._conn.execute("DROP TABLE llm_providers")
                self._conn.execute("DELETE FROM llm_settings")
                self._create_provider_table()
                columns = {row["name"] for row in self._conn.execute("PRAGMA table_info(llm_providers)").fetchall()}
            if "api_key_masked" not in columns:
                self._conn.execute("ALTER TABLE llm_providers ADD COLUMN api_key_masked TEXT")
        self._migrate_plaintext_provider_secrets()

    def _create_provider_table(self) -> None:
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS llm_providers (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                models_json TEXT NOT NULL,
                default_model TEXT NOT NULL,
                api_key TEXT NOT NULL,
                secret_storage TEXT NOT NULL,
                api_key_ref TEXT NOT NULL,
                api_key_masked TEXT,
                test_status_json TEXT,
                enabled INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

    def get_settings(self) -> dict[str, Any]:
        settings = self._settings_row()
        providers = self.list_providers()
        return {
            "defaultProviderId": settings.get("defaultProviderId"),
            "defaultModel": settings.get("defaultModel"),
            "coreProvider": settings.get("coreProvider"),
            "chatProvider": settings.get("chatProvider"),
            "defaultProfile": settings.get("defaultProfile"),
            "profiles": settings.get("profiles"),
            "settingsMigration": settings.get("settingsMigration"),
            "updatedAt": settings["updatedAt"],
            "providers": providers,
        }

    def patch_settings(self, body: dict[str, Any]) -> dict[str, Any]:
        current = self._settings_row()
        default_provider_id = body.get("defaultProviderId", current.get("defaultProviderId"))
        default_model = body.get("defaultModel", current.get("defaultModel"))
        if default_provider_id is None:
            default_model = None
        default_profile = normalize_profile(body.get("defaultProfile", current.get("defaultProfile")))
        root_core_provider = self._validate_core_provider(body.get("coreProvider", current.get("coreProvider")))
        chat_provider = self._validate_chat_provider(body.get("chatProvider", current.get("chatProvider")))
        profiles = self._validate_profiles(body.get("profiles", current.get("profiles")), default_provider_id, default_model, root_core_provider)
        if "chatProvider" in body and "profiles" not in body:
            profiles = self._profiles_with_chat_provider(profiles, chat_provider, clear_model=body.get("chatProvider") is None)
        profiles = self._fill_profile_provider_defaults(profiles, default_provider_id, default_model)
        chat_provider = self._chat_provider_from_profiles(profiles)
        core_provider = chat_provider["coreProvider"]
        settings_migration = self._settings_migration_for_save(current, body)
        if default_provider_id is not None and not isinstance(default_provider_id, str):
            raise ProviderSettingsError("defaultProviderId must be a string or null.", code="settings_invalid")
        elif isinstance(default_provider_id, str):
            provider = self.get_provider(default_provider_id, include_secret=False)
            if provider is None:
                raise ProviderSettingsError("Default provider not found.", code="provider_missing")
            if not isinstance(default_model, str) or default_model not in provider["models"]:
                raise ProviderSettingsError("defaultModel must belong to the default provider models.", code="model_invalid")
        if chat_provider is not None:
            llm_provider_id = chat_provider.get("llmProviderId")
            model = chat_provider.get("model")
            if llm_provider_id is not None:
                provider = self.get_provider(str(llm_provider_id), include_secret=False)
                if provider is None:
                    raise ProviderSettingsError("Chat LLM provider not found.", code="llm_provider_missing")
                if not isinstance(model, str) or model not in provider["models"]:
                    raise ProviderSettingsError("Chat model must belong to the selected LLM provider models.", code="llm_model_invalid")
        updated_at = utc_now()
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT OR REPLACE INTO llm_settings(
                    id, default_provider_id, default_model, core_provider, chat_provider_json,
                    default_profile, profiles_json, settings_migration_json, updated_at
                )
                VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    default_provider_id,
                    default_model,
                    core_provider,
                    _to_json(chat_provider) if chat_provider is not None else None,
                    default_profile,
                    _to_json(profiles),
                    _to_json(settings_migration),
                    updated_at,
                ),
            )
        return self.get_settings()

    def list_providers(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM llm_providers WHERE enabled = 1 ORDER BY rowid").fetchall()
        settings = self._settings_row()
        return [self._present_provider(row, is_default=row["id"] == settings.get("defaultProviderId")) for row in rows]

    def get_provider(self, provider_id: str, *, include_secret: bool) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM llm_providers WHERE id = ? AND enabled = 1", (provider_id,)).fetchone()
        if not row:
            return None
        settings = self._settings_row()
        provider = self._present_provider(row, is_default=row["id"] == settings.get("defaultProviderId"))
        if include_secret:
            try:
                secret = self.secret_store.get(str(row["api_key_ref"]))
            except Exception as exc:
                raise ProviderSettingsError("系统凭据库不可用。", code="provider_secret_unavailable") from exc
            if not secret:
                raise ProviderSettingsError("Provider 密钥在系统凭据库中不存在。", code="provider_secret_missing")
            provider["apiKey"] = secret
        return provider

    def get_default_provider(self, *, include_secret: bool) -> dict[str, Any] | None:
        settings = self._settings_row()
        provider_id = settings.get("defaultProviderId")
        if not provider_id:
            return None
        return self.get_provider(str(provider_id), include_secret=include_secret)

    def get_llm_provider_for_chat(self, provider_id: str | None, model: str | None, *, include_secret: bool) -> dict[str, Any]:
        if not provider_id:
            raise ProviderSettingsError("LLM Provider 未配置，请在 Settings 中选择模型服务。", code="llm_provider_missing")
        provider = self.get_provider(provider_id, include_secret=include_secret)
        if provider is None:
            raise ProviderSettingsError("LLM Provider 不存在或已被删除。", code="llm_provider_missing")
        selected_model = model or provider.get("defaultModel")
        if not isinstance(selected_model, str) or selected_model not in provider["models"]:
            raise ProviderSettingsError("当前模型不属于所选 LLM Provider。", code="llm_model_invalid")
        return {**provider, "selectedModel": selected_model}

    def resolve_chat_provider(self, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
        overrides = overrides if isinstance(overrides, dict) else {}
        settings = self._settings_row()
        profiles = settings.get("profiles") if isinstance(settings.get("profiles"), dict) else default_profiles()
        chat_profile = profiles.get("chat") if isinstance(profiles.get("chat"), dict) else {}
        configured_chat = settings.get("chatProvider") if isinstance(settings.get("chatProvider"), dict) else {}
        core_provider = overrides.get("coreProvider") or configured_chat.get("coreProvider") or chat_profile.get("coreProvider") or settings.get("coreProvider")
        llm_provider_id = overrides.get("llmProviderId") or configured_chat.get("llmProviderId") or chat_profile.get("llmProviderId") or settings.get("defaultProviderId")
        model = overrides.get("model") or configured_chat.get("model") or chat_profile.get("model") or settings.get("defaultModel")
        core_provider = self._validate_core_provider(core_provider)
        return {
            "coreProvider": core_provider,
            "llmProviderId": llm_provider_id if isinstance(llm_provider_id, str) else None,
            "model": model if isinstance(model, str) else None,
        }

    def import_provider(self, body: dict[str, Any], provider_id: str) -> dict[str, Any]:
        provider_type = str(body.get("type") or body.get("providerType") or "").strip().lower()
        if provider_type not in SUPPORTED_LLM_PROVIDER_TYPES:
            raise ProviderSettingsError("Provider type is not supported.", code="provider_unsupported")
        api_key = str(body.get("apiKey") or "").strip()
        if not api_key:
            raise ProviderSettingsError("apiKey is required.", code="provider_incomplete")
        models = self._read_models(body.get("models"))
        fallback_model = DEFAULT_MINIMAX_MODEL if provider_type == "minimax" else configured_deepseek_default_model(models)
        default_model = str(body.get("defaultModel") or fallback_model)
        if default_model not in models:
            raise ProviderSettingsError("defaultModel must belong to provider models.", code="model_invalid")
        now = utc_now()
        secret_ref = self._secret_ref(provider_id)
        try:
            self.secret_store.set(secret_ref, api_key)
            with self._lock, self._conn:
                self._conn.execute(
                    """
                    INSERT OR REPLACE INTO llm_providers(
                        id, type, name, base_url, models_json, default_model, api_key,
                        secret_storage, api_key_ref, api_key_masked, test_status_json,
                        enabled, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, 1, ?, ?)
                    """,
                    (
                        provider_id,
                        provider_type,
                        str(body.get("name") or body.get("displayName") or ("MiniMax" if provider_type == "minimax" else "DeepSeek")),
                        str(body.get("baseUrl") or (DEFAULT_MINIMAX_BASE_URL if provider_type == "minimax" else DEFAULT_DEEPSEEK_BASE_URL)),
                        _to_json(models),
                        default_model,
                        self.secret_store.storage_kind,
                        secret_ref,
                        mask_api_key(api_key),
                        _to_json({"status": "untested", "message": "Not tested yet."}),
                        now,
                        now,
                    ),
                )
        except ProviderSettingsError:
            raise
        except Exception as exc:
            raise ProviderSettingsError("无法将 Provider 密钥保存到系统凭据库。", code="provider_secret_unavailable") from exc
        # Saving credentials never changes the active Chat provider. MiniMax may
        # initialize an otherwise empty default; every non-default provider
        # requires an explicit Settings selection before it is used.
        if provider_type == "minimax" and self.get_default_provider(include_secret=False) is None:
            self.patch_settings({"defaultProviderId": provider_id, "defaultModel": default_model})
        provider = self.get_provider(provider_id, include_secret=False)
        if provider is None:
            raise ProviderSettingsError("Provider import failed.", code="runtime_internal")
        return provider

    def import_deepseek(self, body: dict[str, Any], provider_id: str) -> dict[str, Any]:
        return self.import_provider({**body, "type": "deepseek"}, provider_id)

    def patch_provider(self, provider_id: str, body: dict[str, Any]) -> dict[str, Any]:
        provider = self.get_provider(provider_id, include_secret=True)
        if provider is None:
            raise ProviderMissingError()
        models = self._read_models(body.get("models", provider["models"]))
        default_model = str(body.get("defaultModel") or provider["defaultModel"])
        if default_model not in models:
            raise ProviderSettingsError("defaultModel must belong to provider models.", code="model_invalid")
        api_key = str(body.get("apiKey") or provider["apiKey"])
        now = utc_now()
        secret_ref = self._secret_ref(provider_id)
        try:
            self.secret_store.set(secret_ref, api_key)
            with self._lock, self._conn:
                self._conn.execute(
                    """
                    UPDATE llm_providers
                    SET name = ?, base_url = ?, models_json = ?, default_model = ?, api_key = '',
                        secret_storage = ?, api_key_ref = ?, api_key_masked = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        str(body.get("name") or provider["name"]),
                        str(body.get("baseUrl") or provider["baseUrl"]),
                        _to_json(models),
                        default_model,
                        self.secret_store.storage_kind,
                        secret_ref,
                        mask_api_key(api_key),
                        now,
                        provider_id,
                    ),
                )
        except Exception as exc:
            raise ProviderSettingsError("无法更新系统凭据库中的 Provider 密钥。", code="provider_secret_unavailable") from exc
        settings = self._settings_row()
        if settings.get("defaultProviderId") == provider_id:
            self.patch_settings({"defaultProviderId": provider_id, "defaultModel": default_model})
        updated = self.get_provider(provider_id, include_secret=False)
        if updated is None:
            raise ProviderMissingError()
        return updated

    def delete_provider(self, provider_id: str) -> dict[str, Any]:
        with self._lock:
            row = self._conn.execute("SELECT api_key_ref FROM llm_providers WHERE id = ?", (provider_id,)).fetchone()
        if row:
            try:
                self.secret_store.delete(str(row["api_key_ref"]))
            except Exception as exc:
                raise ProviderSettingsError("无法删除系统凭据库中的 Provider 密钥。", code="provider_secret_unavailable") from exc
        with self._lock, self._conn:
            self._conn.execute("UPDATE llm_providers SET enabled = 0, updated_at = ? WHERE id = ?", (utc_now(), provider_id))
        settings = self._settings_row()
        settings_patch: dict[str, Any] = {}
        chat_provider = settings.get("chatProvider")
        if isinstance(chat_provider, dict) and chat_provider.get("llmProviderId") == provider_id:
            settings_patch["chatProvider"] = None
        if settings.get("defaultProviderId") == provider_id:
            providers = self.list_providers()
            if providers:
                settings_patch.update({"defaultProviderId": providers[0]["id"], "defaultModel": providers[0]["defaultModel"]})
            else:
                settings_patch.update({"defaultProviderId": None, "defaultModel": None})
        if settings_patch:
            self.patch_settings(settings_patch)
        return self.get_settings()

    def update_test_status(self, provider_id: str, result: dict[str, Any]) -> dict[str, Any]:
        with self._lock, self._conn:
            self._conn.execute(
                "UPDATE llm_providers SET test_status_json = ?, updated_at = ? WHERE id = ?",
                (_to_json(result), utc_now(), provider_id),
            )
        provider = self.get_provider(provider_id, include_secret=False)
        if provider is None:
            raise ProviderMissingError()
        return provider

    def clear(self) -> None:
        with self._lock:
            references = [str(row["api_key_ref"]) for row in self._conn.execute("SELECT api_key_ref FROM llm_providers").fetchall()]
        for reference in references:
            try:
                self.secret_store.delete(reference)
            except Exception as exc:
                raise ProviderSettingsError("无法清理系统凭据库中的 Provider 密钥。", code="provider_secret_unavailable") from exc
        with self._lock, self._conn:
            self._conn.execute("DELETE FROM llm_settings")
            self._conn.execute("DELETE FROM llm_providers")

    def _settings_row(self) -> dict[str, Any]:
        with self._lock:
            row = self._conn.execute("SELECT * FROM llm_settings WHERE id = 'default'").fetchone()
        if row:
            profiles = _from_json(row["profiles_json"], None)
            default_profile = normalize_profile(row["default_profile"])
            settings_migration = self._normalize_settings_migration(_from_json(row["settings_migration_json"], {}))
            if not isinstance(profiles, dict):
                profiles = default_profiles(row["core_provider"], row["default_provider_id"], row["default_model"])
            chat_provider = _from_json(row["chat_provider_json"], None)
            settings = {
                "defaultProviderId": row["default_provider_id"],
                "defaultModel": row["default_model"],
                "coreProvider": row["core_provider"],
                "chatProvider": chat_provider,
                "defaultProfile": default_profile,
                "profiles": profiles,
                "settingsMigration": settings_migration,
                "updatedAt": row["updated_at"],
            }
            if self._needs_v1_10_piagent_migration(settings):
                return self._apply_v1_10_piagent_migration(settings)
            normalized_profiles = self._validate_profiles(profiles, row["default_provider_id"], row["default_model"], row["core_provider"])
            normalized_profiles = self._fill_profile_provider_defaults(normalized_profiles, row["default_provider_id"], row["default_model"])
            canonical_chat_provider = self._chat_provider_from_profiles(normalized_profiles)
            return {
                "defaultProviderId": row["default_provider_id"],
                "defaultModel": row["default_model"],
                "coreProvider": canonical_chat_provider["coreProvider"],
                "chatProvider": canonical_chat_provider,
                "defaultProfile": default_profile,
                "profiles": normalized_profiles,
                "settingsMigration": settings_migration,
                "updatedAt": row["updated_at"],
            }
        profiles = default_profiles()
        chat_provider = self._chat_provider_from_profiles(profiles)
        return {
            "defaultProviderId": None,
            "defaultModel": None,
            "coreProvider": chat_provider["coreProvider"],
            "chatProvider": chat_provider,
            "defaultProfile": "chat",
            "profiles": profiles,
            "settingsMigration": {},
            "updatedAt": utc_now(),
        }

    def _present_provider(self, row: sqlite3.Row, *, is_default: bool) -> dict[str, Any]:
        return {
            "id": row["id"],
            "type": row["type"],
            "name": row["name"],
            "baseUrl": row["base_url"],
            "models": _from_json(row["models_json"], []),
            "defaultModel": row["default_model"],
            "isDefault": is_default,
            "apiKeyMasked": row["api_key_masked"] or mask_api_key(row["api_key"]),
            "secretStorage": row["secret_storage"],
            "testStatus": _from_json(row["test_status_json"], None),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    @staticmethod
    def _secret_ref(provider_id: str) -> str:
        return f"llm:{provider_id}:api-key"

    def _migrate_plaintext_provider_secrets(self) -> None:
        with self._lock:
            rows = self._conn.execute(
                "SELECT id, api_key FROM llm_providers WHERE api_key <> ''"
            ).fetchall()
        for row in rows:
            provider_id = str(row["id"])
            secret = str(row["api_key"])
            secret_ref = self._secret_ref(provider_id)
            try:
                self.secret_store.set(secret_ref, secret)
                with self._lock, self._conn:
                    self._conn.execute(
                        """
                        UPDATE llm_providers
                        SET api_key = '', secret_storage = ?, api_key_ref = ?, api_key_masked = ?
                        WHERE id = ? AND api_key = ?
                        """,
                        (self.secret_store.storage_kind, secret_ref, mask_api_key(secret), provider_id, secret),
                    )
            except Exception as exc:
                raise ProviderSettingsError(
                    "检测到历史明文 Provider 密钥，但系统凭据库迁移失败。",
                    code="provider_secret_migration_failed",
                ) from exc

    def _read_models(self, value: Any) -> list[str]:
        if isinstance(value, list):
            models = [str(model).strip() for model in value if str(model).strip()]
        else:
            models = configured_deepseek_models()
        if not models:
            raise ProviderSettingsError("Provider models must not be empty.", code="model_invalid")
        return list(dict.fromkeys(models))

    def _validate_core_provider(self, value: Any) -> str | None:
        if value is None or value == "":
            return None
        provider = str(value)
        if provider not in ALLOWED_CORE_PROVIDERS:
            raise ProviderSettingsError("Unsupported coreProvider.", code="core_provider_missing")
        return provider

    def _validate_chat_provider(self, value: Any) -> dict[str, Any] | None:
        if value is None:
            return None
        if not isinstance(value, dict):
            raise ProviderSettingsError("chatProvider must be an object or null.", code="settings_invalid")
        core_provider = self._validate_core_provider(value.get("coreProvider"))
        if core_provider is None:
            raise ProviderSettingsError("chatProvider.coreProvider is required.", code="core_provider_missing")
        result: dict[str, Any] = {"coreProvider": core_provider}
        if isinstance(value.get("llmProviderId"), str):
            result["llmProviderId"] = value["llmProviderId"]
        if isinstance(value.get("model"), str):
            result["model"] = value["model"]
        return result

    def _validate_profiles(self, value: Any, default_provider_id: str | None, default_model: str | None, core_provider: str | None) -> dict[str, Any]:
        if not isinstance(value, dict):
            return default_profiles(core_provider, default_provider_id, default_model)
        defaults = default_profiles(core_provider, default_provider_id, default_model)
        result: dict[str, Any] = {}
        for profile_name in ("chat", "agent"):
            raw = value.get(profile_name)
            if not isinstance(raw, dict):
                result[profile_name] = defaults[profile_name]
                continue
            tool_policy = raw.get("toolPolicy") if isinstance(raw.get("toolPolicy"), dict) else {"mode": "disabled", "allowedTools": []}
            mode = tool_policy.get("mode") if tool_policy.get("mode") in {"disabled", "approval_allowlist"} else "disabled"
            allowed_tools = tool_policy.get("allowedTools") if isinstance(tool_policy.get("allowedTools"), list) else []
            result[profile_name] = {
                "profile": profile_name,
                "coreProvider": self._validate_core_provider(raw.get("coreProvider")) or defaults[profile_name]["coreProvider"],
                "llmProviderId": raw.get("llmProviderId") if isinstance(raw.get("llmProviderId"), str) else defaults[profile_name].get("llmProviderId"),
                "model": raw.get("model") if isinstance(raw.get("model"), str) else defaults[profile_name].get("model"),
                "toolPolicy": {"mode": mode, "allowedTools": [str(tool) for tool in allowed_tools]},
                "enabled": bool(raw.get("enabled", defaults[profile_name]["enabled"])),
            }
        return result

    def _profiles_with_chat_provider(self, profiles: dict[str, Any], chat_provider: dict[str, Any] | None, *, clear_model: bool = False) -> dict[str, Any]:
        result = dict(profiles)
        chat_profile = dict(result.get("chat") if isinstance(result.get("chat"), dict) else default_profiles()["chat"])
        if chat_provider is None:
            if clear_model:
                chat_profile.pop("llmProviderId", None)
                chat_profile.pop("model", None)
            result["chat"] = chat_profile
            return result
        chat_profile["coreProvider"] = chat_provider["coreProvider"]
        if "llmProviderId" in chat_provider:
            chat_profile["llmProviderId"] = chat_provider["llmProviderId"]
        if "model" in chat_provider:
            chat_profile["model"] = chat_provider["model"]
        result["chat"] = chat_profile
        return result

    def _fill_profile_provider_defaults(self, profiles: dict[str, Any], default_provider_id: str | None, default_model: str | None) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for profile_name, raw in profiles.items():
            profile = dict(raw) if isinstance(raw, dict) else {}
            if not isinstance(profile.get("llmProviderId"), str) and isinstance(default_provider_id, str):
                profile["llmProviderId"] = default_provider_id
            if not isinstance(profile.get("model"), str) and isinstance(default_model, str):
                profile["model"] = default_model
            result[profile_name] = profile
        return result

    def _chat_provider_from_profiles(self, profiles: dict[str, Any]) -> dict[str, Any]:
        chat_profile = profiles.get("chat") if isinstance(profiles.get("chat"), dict) else default_profiles()["chat"]
        provider = {
            "coreProvider": self._validate_core_provider(chat_profile.get("coreProvider")) or "piagent",
        }
        if isinstance(chat_profile.get("llmProviderId"), str):
            provider["llmProviderId"] = chat_profile["llmProviderId"]
        if isinstance(chat_profile.get("model"), str):
            provider["model"] = chat_profile["model"]
        return provider

    def _normalize_settings_migration(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            return {}
        result: dict[str, Any] = {}
        if value.get(V1_10_PIAGENT_DEFAULT_MARKER) is True:
            result[V1_10_PIAGENT_DEFAULT_MARKER] = True
        if value.get(V1_10_MANUAL_CORE_PROVIDER_MARKER) is True:
            result[V1_10_MANUAL_CORE_PROVIDER_MARKER] = True
        return result

    def _settings_migration_for_save(self, current: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
        existing = self._normalize_settings_migration(current.get("settingsMigration"))
        if V1_10_PIAGENT_DEFAULT_MARKER in existing:
            return existing
        # A user-initiated settings write from a V1.10 runtime is migration-aware,
        # but it is not the legacy auto-migration success marker.
        return {V1_10_MANUAL_CORE_PROVIDER_MARKER: True}

    def _needs_v1_10_piagent_migration(self, settings: dict[str, Any]) -> bool:
        migration = self._normalize_settings_migration(settings.get("settingsMigration"))
        if migration.get(V1_10_PIAGENT_DEFAULT_MARKER) is True:
            return False
        if migration.get(V1_10_MANUAL_CORE_PROVIDER_MARKER) is True:
            return False
        profiles = settings.get("profiles") if isinstance(settings.get("profiles"), dict) else {}
        chat_profile = profiles.get("chat") if isinstance(profiles.get("chat"), dict) else {}
        chat_provider = settings.get("chatProvider") if isinstance(settings.get("chatProvider"), dict) else {}
        return (
            settings.get("coreProvider") == "llm_direct"
            or chat_profile.get("coreProvider") == "llm_direct"
            or chat_provider.get("coreProvider") == "llm_direct"
        )

    def _apply_v1_10_piagent_migration(self, settings: dict[str, Any]) -> dict[str, Any]:
        profiles = self._validate_profiles(settings.get("profiles"), settings.get("defaultProviderId"), settings.get("defaultModel"), "piagent")
        chat_profile = dict(profiles.get("chat") if isinstance(profiles.get("chat"), dict) else default_profiles()["chat"])
        chat_profile["coreProvider"] = "piagent"
        profiles["chat"] = chat_profile
        profiles = self._fill_profile_provider_defaults(profiles, settings.get("defaultProviderId"), settings.get("defaultModel"))
        chat_provider = self._chat_provider_from_profiles(profiles)
        settings_migration = {V1_10_PIAGENT_DEFAULT_MARKER: True}
        updated_at = utc_now()
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT OR REPLACE INTO llm_settings(
                    id, default_provider_id, default_model, core_provider, chat_provider_json,
                    default_profile, profiles_json, settings_migration_json, updated_at
                )
                VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    settings.get("defaultProviderId"),
                    settings.get("defaultModel"),
                    chat_provider["coreProvider"],
                    _to_json(chat_provider),
                    settings.get("defaultProfile") or "chat",
                    _to_json(profiles),
                    _to_json(settings_migration),
                    updated_at,
                ),
            )
        return {
            "defaultProviderId": settings.get("defaultProviderId"),
            "defaultModel": settings.get("defaultModel"),
            "coreProvider": chat_provider["coreProvider"],
            "chatProvider": chat_provider,
            "defaultProfile": settings.get("defaultProfile") or "chat",
            "profiles": profiles,
            "settingsMigration": settings_migration,
            "updatedAt": updated_at,
        }
