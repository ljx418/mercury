from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from navia_runtime.modules.media_companion.vision import (
    MemorySecretStore,
    MiniMaxChatVisionAdapter,
    OpenAIResponsesVisionAdapter,
    SecretStoreError,
    VisionProviderError,
    VisionProviderStore,
    WindowsCredentialVaultSecretStore,
)
from navia_runtime.modules.media_companion.vision.provider_settings import (
    MINIMAX_ADAPTER_KIND,
    MINIMAX_API_BASE,
    MINIMAX_CN_API_BASE,
    MINIMAX_CN_MODEL_IDS,
    MINIMAX_CN_PROVIDER_ID,
    MINIMAX_MODEL_IDS,
    MINIMAX_PROVIDER_ID,
    OPENAI_API_BASE,
    OPENAI_MODEL_ID,
    OPENAI_PROVIDER_ID,
)


SECRET = "sk-test-" + "s" * 48
EXTENSION_ID = "a" * 32
ORIGIN = f"chrome-extension://{EXTENSION_ID}"


def provider_body() -> dict[str, str]:
    return {
        "adapterKind": "openai_responses",
        "name": "OpenAI Vision",
        "baseUrl": OPENAI_API_BASE,
        "model": OPENAI_MODEL_ID,
        "apiKey": SECRET,
    }


def minimax_provider_body(model: str = MINIMAX_MODEL_IDS[0]) -> dict[str, str]:
    return {
        "adapterKind": MINIMAX_ADAPTER_KIND,
        "name": "MiniMax Vision（国际区）",
        "baseUrl": MINIMAX_API_BASE,
        "model": model,
        "apiKey": SECRET,
    }


def test_store_keeps_secret_out_of_sqlite_and_public_dto(tmp_path: Path) -> None:
    db = tmp_path / "navia.sqlite3"
    secrets = MemorySecretStore()
    store = VisionProviderStore(db, secrets)

    visible = store.upsert(OPENAI_PROVIDER_ID, provider_body())

    assert visible["credentialConfigured"] is True
    assert visible["apiKeyMasked"].endswith(SECRET[-4:])
    assert "apiKey" not in visible
    assert SECRET.encode() not in db.read_bytes()
    assert secrets.get(visible["secretRef"]) == SECRET
    private = store.get(OPENAI_PROVIDER_ID, include_secret=True)
    assert private and private["apiKey"] == SECRET

    store.delete(OPENAI_PROVIDER_ID)
    assert store.list() == []
    assert secrets.values == {}


def test_store_rejects_contract_drift_before_secret_write(tmp_path: Path) -> None:
    secrets = MemorySecretStore()
    store = VisionProviderStore(tmp_path / "navia.sqlite3", secrets)
    invalid = provider_body() | {"baseUrl": "http://127.0.0.1:9999"}
    with pytest.raises(VisionProviderError, match="冻结合同"):
        store.upsert(OPENAI_PROVIDER_ID, invalid)
    assert secrets.values == {}


def test_store_supports_isolated_minimax_config_and_verified_selection(tmp_path: Path) -> None:
    secrets = MemorySecretStore()
    store = VisionProviderStore(tmp_path / "navia.sqlite3", secrets)
    minimax = store.upsert(MINIMAX_PROVIDER_ID, minimax_provider_body(MINIMAX_MODEL_IDS[1]))
    assert minimax["model"] == MINIMAX_MODEL_IDS[1]
    assert len(store.catalog()) == 3
    with pytest.raises(VisionProviderError, match="先通过"):
        store.select(MINIMAX_PROVIDER_ID)
    store.update_test_status(MINIMAX_PROVIDER_ID, {"status": "ok", "model": MINIMAX_MODEL_IDS[1]})
    assert store.selected_provider_id() == MINIMAX_PROVIDER_ID
    store.upsert(OPENAI_PROVIDER_ID, provider_body() | {"apiKey": SECRET + "openai"})
    assert len(secrets.values) == 2
    store.delete(OPENAI_PROVIDER_ID)
    assert list(secrets.values.values()) == [SECRET]
    assert store.selected_provider_id() == MINIMAX_PROVIDER_ID


def test_store_supports_china_minimax_as_a_separate_closed_provider(tmp_path: Path) -> None:
    secrets = MemorySecretStore()
    store = VisionProviderStore(tmp_path / "navia.sqlite3", secrets)
    body = {
        "adapterKind": MINIMAX_ADAPTER_KIND,
        "name": "MiniMax Vision（中国区）",
        "baseUrl": MINIMAX_CN_API_BASE,
        "model": MINIMAX_CN_MODEL_IDS[0],
        "apiKey": SECRET,
    }
    configured = store.upsert(MINIMAX_CN_PROVIDER_ID, body)
    assert configured["baseUrl"] == MINIMAX_CN_API_BASE
    assert configured["model"] == "MiniMax-M3"
    assert configured["secretRef"] == f"vision-provider:{MINIMAX_CN_PROVIDER_ID}:api-key"

    with pytest.raises(VisionProviderError, match="冻结合同"):
        store.upsert(MINIMAX_CN_PROVIDER_ID, body | {"baseUrl": MINIMAX_API_BASE})
    assert list(secrets.values.values()) == [SECRET]


def test_store_rejects_unregistered_minimax_model_and_custom_base(tmp_path: Path) -> None:
    secrets = MemorySecretStore()
    store = VisionProviderStore(tmp_path / "navia.sqlite3", secrets)
    with pytest.raises(VisionProviderError, match="冻结合同"):
        store.upsert(MINIMAX_PROVIDER_ID, minimax_provider_body("unknown-model"))
    with pytest.raises(VisionProviderError, match="冻结合同"):
        store.upsert(MINIMAX_PROVIDER_ID, minimax_provider_body() | {"baseUrl": "https://example.com/v1"})
    assert secrets.values == {}


def test_store_fails_closed_when_secret_backend_fails(tmp_path: Path) -> None:
    class BrokenSecretStore(MemorySecretStore):
        storage_kind = "unavailable"

        def set(self, reference: str, secret: str) -> None:
            raise SecretStoreError()

    db = tmp_path / "navia.sqlite3"
    store = VisionProviderStore(db, BrokenSecretStore())
    with pytest.raises(SecretStoreError):
        store.upsert(OPENAI_PROVIDER_ID, provider_body())
    assert SECRET.encode() not in db.read_bytes()
    assert store._conn.execute("SELECT COUNT(*) FROM vision_providers").fetchone()[0] == 0


def test_windows_vault_never_places_secret_in_process_arguments() -> None:
    calls: list[tuple[list[str], str]] = []

    class Completed:
        returncode = 0
        stderr = ""

        def __init__(self, stdout: str) -> None:
            self.stdout = stdout

    outputs = iter(["READY\n", "OK\n", "VALUE:" + __import__("base64").b64encode(SECRET.encode()).decode() + "\n", "OK\n"])

    def runner(args, **kwargs):
        calls.append((args, kwargs["input"]))
        return Completed(next(outputs))

    store = WindowsCredentialVaultSecretStore("powershell.exe", runner=runner)
    store.set("vision-provider:test", SECRET)
    assert store.get("vision-provider:test") == SECRET
    store.delete("vision-provider:test")
    assert all(SECRET not in " ".join(args) for args, _ in calls)
    assert SECRET in calls[1][1]
    assert all(item[0][0] == "powershell.exe" for item in calls)


def test_neutral_provider_test_returns_typed_public_result() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == f"Bearer {SECRET}"
        body = json.loads(request.content)
        assert body["store"] is False
        assert body["input"][0]["content"][1]["image_url"].startswith("data:image/png;base64,")
        return httpx.Response(200, json={
            "id": "resp_private_identifier",
            "status": "completed",
            "model": OPENAI_MODEL_ID,
            "usage": {"input_tokens": 10, "output_tokens": 8, "total_tokens": 18},
            "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps({
                "summary": "A geometric checkerboard.", "containsText": False, "dominantColors": ["green", "white"]
            })}]}],
        })

    client = httpx.Client(transport=httpx.MockTransport(handler))
    result = OpenAIResponsesVisionAdapter(lambda: client).test({
        "baseUrl": OPENAI_API_BASE,
        "model": OPENAI_MODEL_ID,
        "apiKey": SECRET,
    })
    assert result["status"] == "ok"
    assert result["containsUserContent"] is False
    assert result["usage"]["total_tokens"] == 18
    assert result["observation"]["containsText"] is False
    assert SECRET not in json.dumps(result)


def test_minimax_neutral_provider_test_uses_official_multimodal_shape() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://api.minimax.io/v1/chat/completions"
        assert request.headers["authorization"] == f"Bearer {SECRET}"
        body = json.loads(request.content)
        assert body["model"] == MINIMAX_MODEL_IDS[0]
        assert body["thinking"] == {"type": "disabled"}
        assert body["temperature"] == 0.1
        assert body["max_completion_tokens"] == 300
        image_part = body["messages"][0]["content"][1]
        assert image_part["type"] == "image_url"
        assert image_part["image_url"]["url"].startswith("data:image/png;base64,")
        return httpx.Response(200, json={
            "id": "private-minimax-id",
            "model": MINIMAX_MODEL_IDS[0],
            "choices": [{"finish_reason": "stop", "message": {"content": "```json\n" + json.dumps({
                "summary": "A geometric checkerboard.", "containsText": False, "dominantColors": ["green", "white"]
            }) + "\n```"}}],
            "usage": {"prompt_tokens": 20, "completion_tokens": 10, "total_tokens": 30},
            "base_resp": {"status_code": 0, "status_msg": ""},
        })

    client = httpx.Client(transport=httpx.MockTransport(handler))
    result = MiniMaxChatVisionAdapter(lambda: client).test({
        "baseUrl": MINIMAX_API_BASE,
        "model": MINIMAX_MODEL_IDS[0],
        "apiKey": SECRET,
    })
    assert result["status"] == "ok"
    assert result["usage"] == {"input_tokens": 20, "output_tokens": 10, "total_tokens": 30}
    assert result["containsUserContent"] is False
    assert SECRET not in json.dumps(result)


def test_minimax_auth_failure_reports_region_mismatch() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "invalid api key (2049)"}})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(VisionProviderError) as caught:
        MiniMaxChatVisionAdapter(lambda: client).test({
            "baseUrl": MINIMAX_API_BASE,
            "model": MINIMAX_MODEL_IDS[0],
            "apiKey": SECRET,
        })
    assert caught.value.code == "VISION_CREDENTIAL_REGION_MISMATCH"
    assert caught.value.status == 401
    assert "中国区/国际区" in str(caught.value)


def test_runtime_vision_api_requires_exact_origin_and_companion_session(monkeypatch, tmp_path: Path) -> None:
    import navia_runtime.app as runtime_app

    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    runtime_app.companion_session_broker.clear()
    memory = MemorySecretStore()
    monkeypatch.setattr(runtime_app, "vision_provider_store", VisionProviderStore(tmp_path / "api.sqlite3", memory))
    client = TestClient(runtime_app.app)

    assert client.get("/v1/vision/providers", headers={"Origin": ORIGIN}).status_code == 401
    assert client.get("/v1/vision/providers", headers={"Origin": "https://evil.example"}).status_code == 403

    issued = client.post("/v1/companion/sessions", headers={"Origin": ORIGIN}).json()["data"]
    headers = {"Origin": ORIGIN, "Authorization": f"Bearer {issued['token']}"}
    saved = client.put(f"/v1/vision/providers/{OPENAI_PROVIDER_ID}", headers=headers, json=provider_body())
    assert saved.status_code == 200
    serialized = json.dumps(saved.json())
    assert SECRET not in serialized
    assert saved.json()["data"]["provider"]["credentialConfigured"] is True
    listing = client.get("/v1/vision/providers", headers=headers).json()["data"]
    assert {item["id"] for item in listing["catalog"]} == {
        OPENAI_PROVIDER_ID,
        MINIMAX_PROVIDER_ID,
        MINIMAX_CN_PROVIDER_ID,
    }
    assert listing["selectedProviderId"] is None
    assert client.patch(f"/v1/vision/providers/{OPENAI_PROVIDER_ID}/select", headers=headers).status_code == 409

    class FakeAdapterRegistry:
        def test(self, private_provider):
            assert private_provider["apiKey"] == SECRET
            return {"status": "ok", "model": OPENAI_MODEL_ID, "testedAt": "2026-10-08T00:00:00Z"}

    monkeypatch.setattr(runtime_app, "vision_provider_adapter", FakeAdapterRegistry())
    assert client.post(f"/v1/vision/providers/{OPENAI_PROVIDER_ID}/test", headers=headers).status_code == 200
    selected = client.patch(f"/v1/vision/providers/{OPENAI_PROVIDER_ID}/select", headers=headers)
    assert selected.status_code == 200
    assert selected.json()["data"]["selectedProviderId"] == OPENAI_PROVIDER_ID

    removed = client.delete(f"/v1/vision/providers/{OPENAI_PROVIDER_ID}", headers=headers)
    assert removed.status_code == 200
    assert memory.values == {}
