from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

import navia_runtime.app as app_module
from navia_runtime.provider_settings import ProviderRegistry, SettingsStore
from navia_runtime.modules.media_companion.comprehension import DeepSeekStrictGroundedSynthesisProvider
from navia_runtime.modules.media_companion.vision.provider_settings import MemorySecretStore


ROOT = Path(__file__).resolve().parents[3]
CONTRACTS = ROOT / "docs/active/project/contracts"
SECRET = "sk-secret-1234567890"


def parse_sse(raw: str) -> list[dict]:
    events = []
    for block in [block for block in raw.strip().split("\n\n") if block.strip()]:
        data_line = next(line for line in block.splitlines() if line.startswith("data:"))
        events.append(json.loads(data_line.split(":", 1)[1].strip()))
    return events


def create_session_with_page(client: TestClient) -> str:
    session = client.post("/v1/sessions", json={"client": "chrome-extension", "metadata": {}}).json()
    session_id = session["data"]["session_id"]
    sample = json.loads((CONTRACTS / "samples/page-context-article.json").read_text())
    sample["session_id"] = session_id
    client.post("/v1/page/context", json=sample)
    app_module.event_store.events.clear()
    app_module.event_stream.published.clear()
    return session_id


def install_mock_provider(monkeypatch, handler) -> None:
    monkeypatch.setattr(
        app_module,
        "provider_registry",
        ProviderRegistry(app_module.settings_store, lambda: httpx.Client(transport=httpx.MockTransport(handler))),
    )


def import_provider(client: TestClient) -> dict:
    response = client.post(
        "/v1/llm/providers/import",
        json={
            "type": "deepseek",
            "name": "DeepSeek",
            "baseUrl": "https://api.deepseek.com",
            "apiKey": SECRET,
            "models": ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"],
            "defaultModel": "deepseek-chat",
        },
    )
    assert response.status_code == 200
    return response.json()["data"]["provider"]


def setup_function() -> None:
    app_module.settings_store.clear()
    app_module.event_store.events.clear()
    app_module.event_stream.published.clear()


def test_provider_import_get_and_test_do_not_return_api_key(monkeypatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert request.url.path == "/beta/chat/completions"
        assert body["tools"][0]["function"]["strict"] is True
        return httpx.Response(200, json={"choices": [{"message": {"tool_calls": [{"function": {
            "name": "confirm_navia_structure_capability",
            "arguments": json.dumps({"ok": True, "nonce": "navia-structure-check-v1"}),
        }}]}}]})

    install_mock_provider(monkeypatch, handler)
    client = TestClient(app_module.app)
    provider = import_provider(client)
    assert provider["id"]
    assert "apiKey" not in provider
    assert provider["apiKeyMasked"].startswith("sk-s")
    assert SECRET not in json.dumps(provider)

    settings = client.get("/v1/settings").json()
    listed = client.get("/v1/llm/providers").json()
    assert SECRET not in json.dumps(settings)
    assert SECRET not in json.dumps(listed)

    tested = client.post(f"/v1/llm/providers/{provider['id']}/test").json()
    assert tested["data"]["result"]["status"] == "ok"
    assert tested["data"]["result"]["capabilities"]["structuredOutput"] == "deepseek_beta_strict_tool_v1"
    assert SECRET not in json.dumps(tested)
    assert SECRET.encode() not in app_module.settings_store.db_path.read_bytes()
    assert tested["data"]["provider"]["secretStorage"] != "sqlite_plaintext"


def test_settings_store_migrates_legacy_plaintext_secret_to_secure_store(tmp_path: Path) -> None:
    db_path = tmp_path / "settings.sqlite3"
    secrets = MemorySecretStore()
    store = SettingsStore(db_path, secrets)
    provider = store.import_provider({
        "type": "deepseek",
        "name": "DeepSeek",
        "baseUrl": "https://api.deepseek.com",
        "apiKey": SECRET,
        "models": ["deepseek-chat"],
        "defaultModel": "deepseek-chat",
    }, "legacy-provider")
    reference = "llm:legacy-provider:api-key"
    secrets.delete(reference)
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "UPDATE llm_providers SET api_key = ?, secret_storage = 'sqlite_plaintext', api_key_ref = 'sqlite:legacy' WHERE id = ?",
            (SECRET, provider["id"]),
        )
    migrated = SettingsStore(db_path, secrets)
    assert migrated.get_provider(provider["id"], include_secret=True)["apiKey"] == SECRET
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT api_key, secret_storage, api_key_ref FROM llm_providers WHERE id = ?",
            (provider["id"],),
        ).fetchone()
    assert row == ("", "memory_test_only", reference)
    assert SECRET.encode() not in db_path.read_bytes()


def test_patch_settings_rejects_model_outside_provider_models() -> None:
    client = TestClient(app_module.app)
    provider = import_provider(client)
    response = client.patch("/v1/settings", json={"defaultProviderId": provider["id"], "defaultModel": "not-a-model"})
    body = response.json()
    assert response.status_code == 400
    assert body["ok"] is False
    assert body["error"]["details"]["code"] == "model_invalid"


def test_delete_default_provider_clears_default_settings() -> None:
    client = TestClient(app_module.app)
    provider = import_provider(client)
    settings = client.delete(f"/v1/llm/providers/{provider['id']}").json()["data"]
    assert settings["providers"] == []
    assert settings["defaultProviderId"] is None
    assert settings["defaultModel"] is None


def test_provider_missing_chat_stream_returns_recoverable_error() -> None:
    client = TestClient(app_module.app)
    session_id = create_session_with_page(client)
    response = client.post("/v1/chat/stream", json={"session_id": session_id, "message": "hello"})
    events = parse_sse(response.text)
    assert events[0]["type"] == "error"
    assert events[0]["data"]["code"] == "provider_missing"
    assert events[0]["data"]["recoverable"] is True


def test_deepseek_stream_chunks_become_response_delta_and_do_not_leak_secret(monkeypatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == f"Bearer {SECRET}"
        body = b'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n'
        return httpx.Response(200, content=body, headers={"content-type": "text/event-stream"})

    install_mock_provider(monkeypatch, handler)
    client = TestClient(app_module.app)
    provider = import_provider(client)
    selected = client.patch("/v1/settings", json={
        "defaultProviderId": provider["id"],
        "defaultModel": provider["defaultModel"],
        "chatProvider": {
            "coreProvider": "llm_direct",
            "llmProviderId": provider["id"],
            "model": provider["defaultModel"],
        },
    })
    assert selected.status_code == 200
    session_id = create_session_with_page(client)
    response = client.post("/v1/chat/stream", json={"session_id": session_id, "message": "hello", "request_id": "req_test"})
    events = parse_sse(response.text)
    assert [event["type"] for event in events] == ["response.delta", "response.delta", "response.done"]
    assert "".join(event["data"].get("text", "") for event in events) == "Hello world"
    assert SECRET not in response.text
    trace = client.get(f"/v1/sessions/{session_id}/trace").json()
    assert SECRET not in json.dumps(trace)


def test_deepseek_import_is_saved_but_not_selected() -> None:
    client = TestClient(app_module.app)
    provider = import_provider(client)
    settings = client.get("/v1/settings").json()["data"]
    assert provider["type"] == "deepseek"
    assert settings["defaultProviderId"] is None
    assert settings["chatProvider"].get("llmProviderId") is None


def test_deepseek_strict_provider_requires_explicit_verified_selection(monkeypatch) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"tool_calls": [{"function": {
            "name": "confirm_navia_structure_capability",
            "arguments": json.dumps({"ok": True, "nonce": "navia-structure-check-v1"}),
        }}]}}]})

    install_mock_provider(monkeypatch, handler)
    client = TestClient(app_module.app)
    provider = import_provider(client)
    assert app_module.settings_store.get_settings()["defaultProviderId"] is None
    tested = client.post(f"/v1/llm/providers/{provider['id']}/test").json()["data"]
    assert tested["result"]["status"] == "ok"
    selected = client.patch("/v1/settings", json={
        "chatProvider": {
            "coreProvider": "llm_direct",
            "llmProviderId": provider["id"],
            "model": "deepseek-chat",
        },
    })
    assert selected.status_code == 200
    assert isinstance(app_module.create_grounded_media_synthesis_provider(), DeepSeekStrictGroundedSynthesisProvider)


def test_minimax_import_initializes_empty_default_without_branding_deepseek() -> None:
    client = TestClient(app_module.app)
    response = client.post("/v1/llm/providers/import", json={
        "type": "minimax",
        "name": "MiniMax",
        "baseUrl": "https://api.minimax.io/v1",
        "apiKey": SECRET,
        "models": ["MiniMax-M3"],
        "defaultModel": "MiniMax-M3",
    })
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["provider"]["type"] == "minimax"
    assert data["settings"]["defaultProviderId"] == data["provider"]["id"]
    assert data["settings"]["defaultModel"] == "MiniMax-M3"

def test_deepseek_test_error_is_wrapped_without_secret(monkeypatch) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "bad key"}})

    install_mock_provider(monkeypatch, handler)
    client = TestClient(app_module.app)
    provider = import_provider(client)
    response = client.post(f"/v1/llm/providers/{provider['id']}/test").json()
    assert response["data"]["result"]["status"] == "error"
    assert "Provider strict structure test failed" in response["data"]["result"]["message"]
    assert SECRET not in json.dumps(response)
