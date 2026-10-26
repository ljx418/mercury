from __future__ import annotations

import json
import stat
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from navia_runtime.modules.media_companion.media_cache import MediaCacheError, MediaDownloadCache
from navia_runtime.modules.media_companion.portal_settings import (
    MediaPortalSettingsError,
    MediaPortalSettingsStore,
    parse_bilibili_cookies,
)
from navia_runtime.modules.media_companion.vision.provider_settings import MemorySecretStore
from navia_runtime import app as runtime_app


def cookie_json(secret: str = "session-secret") -> str:
    return json.dumps([
        {"name": "SESSDATA", "value": secret, "domain": ".bilibili.com", "secure": True},
        {"name": "bili_jct", "value": "csrf-secret", "domain": ".bilibili.com", "secure": True},
        {"name": "ignored_cookie", "value": "not-retained", "domain": ".bilibili.com"},
    ])


def test_cookie_parser_accepts_supported_exports_and_rejects_missing_session() -> None:
    parsed = parse_bilibili_cookies(cookie_json())
    assert [item["name"] for item in parsed] == ["SESSDATA", "bili_jct"]
    assert parse_bilibili_cookies("SESSDATA=session-secret; bili_jct=csrf-secret")[0]["name"] == "SESSDATA"
    netscape = "# Netscape HTTP Cookie File\n.bilibili.com\tTRUE\t/\tTRUE\t2000000000\tSESSDATA\tsession-secret\n"
    assert parse_bilibili_cookies(netscape)[0]["domain"] == ".bilibili.com"
    with pytest.raises(MediaPortalSettingsError) as captured:
        parse_bilibili_cookies("bili_jct=csrf-only")
    assert captured.value.code == "V3_MEDIA_COOKIE_REQUIRED_MISSING"


def test_portal_settings_store_keeps_secret_out_of_sqlite_and_supports_lifecycle(tmp_path: Path) -> None:
    secrets = MemorySecretStore()
    store = MediaPortalSettingsStore(
        tmp_path / "navia.sqlite3", secrets,
        verifier=lambda cookies: {"loggedIn": any(item["name"] == "SESSDATA" for item in cookies)},
    )
    status = store.save(cookie_json())
    assert status["enabled"] is True and status["configured"] is True
    assert status["cookieCount"] == 2 and status["testStatus"]["status"] == "ok"
    assert "session-secret" not in (tmp_path / "navia.sqlite3").read_bytes().decode("utf-8", errors="ignore")
    assert store.resolve_credentials()[0]["value"] == "session-secret"
    assert store.set_enabled(False)["enabled"] is False
    with pytest.raises(Exception):
        store.resolve_credentials()
    assert store.test()["testStatus"]["loggedIn"] is True
    assert store.delete()["configured"] is False
    assert secrets.values == {}


def test_media_cache_reuses_one_private_file_and_clears_space(tmp_path: Path) -> None:
    cache = MediaDownloadCache(tmp_path / "cache", tmp_path / "navia.sqlite3")
    source = "portal:bilibili:BV1ZpYd66ELP:41828944992:p1"
    calls = 0

    def produce(path: Path) -> None:
        nonlocal calls
        calls += 1
        path.write_bytes(b"video-bytes")
        path.chmod(0o600)

    first = cache.get_or_create(source, produce)
    second = cache.get_or_create(source, produce)
    assert first == second and calls == 1
    assert stat.S_IMODE(first.stat().st_mode) == 0o600
    assert cache.status()["entryCount"] == 1
    cache.configure(1024**3, 6)
    assert cache.status()["retentionHours"] == 6
    cleared = cache.clear()
    assert cleared == {"removedEntries": 1, "removedBytes": len(b"video-bytes")}
    assert cache.status()["usedBytes"] == 0 and not first.exists()


def test_media_cache_rejects_invalid_settings_and_source(tmp_path: Path) -> None:
    cache = MediaDownloadCache(tmp_path / "cache", tmp_path / "navia.sqlite3")
    with pytest.raises(MediaCacheError):
        cache.configure(1, 24)
    with pytest.raises(MediaCacheError):
        cache.get_or_create("https://evil.invalid/video", lambda path: path.write_bytes(b"x"))


def test_portal_settings_and_cache_api_require_session_and_never_echo_secret(tmp_path: Path, monkeypatch) -> None:
    store = MediaPortalSettingsStore(
        tmp_path / "api.sqlite3", MemorySecretStore(), verifier=lambda cookies: {"loggedIn": True}
    )
    cache = MediaDownloadCache(tmp_path / "cache", tmp_path / "api.sqlite3")
    monkeypatch.setattr(runtime_app, "media_portal_settings_store", store)
    monkeypatch.setattr(runtime_app, "media_download_cache", cache)
    extension_id = "a" * 32
    origin = f"chrome-extension://{extension_id}"
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", extension_id)
    runtime_app.companion_session_broker.clear()
    client = TestClient(runtime_app.app)
    path = "/v1/media/portal-settings/bilibili"
    assert client.get(path, headers={"Origin": origin}).status_code == 401
    token = runtime_app.companion_session_broker.issue(origin)["token"]
    headers = {"Origin": origin, "Authorization": f"Bearer {token}"}
    response = client.put(path, headers=headers, json={"enabled": True, "cookieText": cookie_json()})
    assert response.status_code == 200
    serialized = response.text
    assert "session-secret" not in serialized and response.json()["data"]["settings"]["enabled"] is True
    cache_response = client.get("/v1/media/cache", headers=headers)
    assert cache_response.status_code == 200 and cache_response.json()["data"]["cache"]["entryCount"] == 0
    deleted = client.delete(path, headers=headers)
    assert deleted.status_code == 200 and deleted.json()["data"]["settings"]["configured"] is False
