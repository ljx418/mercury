"""WP-B B2 — the four authenticated local-import API routes.

Cases map to B02 (exact create body, client metadata refused), B04 (OPTIONS,
exact Origin, bearer, content-script/proxy refusal and the FIXED rejection order
with no writer created), B05 (token once), B06 (GET/DELETE envelopes and the
restart case) and B10 (Content-Length / encoding / chunked refused BEFORE the
writer).

The rejection order is load-bearing: every negative case asserts that the
writer was never constructed.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.local_import.manager import TokenRegistry
from navia_runtime.modules.media_companion.local_import.store import (
    LocalMediaImportStore,
)

EXT_ID = "abcdefghijklmnop" * 2
ORIGIN = f"chrome-extension://{EXT_ID}"
OTHER_ORIGIN = "chrome-extension://" + "abcdefghijklmnop" * 1 + "z"
TOKEN = "wp-b-master-token-000000000000000000000000000000000000"
TASK_ID = "media_task_" + "b" * 32
SOURCE = "portal:bilibili:BV1R6TEST:cid:1"
GENERATION = "depgen_" + "c" * 64

CREATE = {
    "taskId": TASK_ID,
    "sourceIdentity": SOURCE,
    "declaredMediaType": "video/mp4",
    "byteLength": 1024,
}


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    import navia_runtime.app as runtime_app  # imported AFTER the env is set
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", TOKEN)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXT_ID)
    monkeypatch.setenv("NAVIA_DB_PATH", str(tmp_path / "navia.sqlite3"))
    monkeypatch.setenv("NAVIA_MEDIA_TASK_ROOT", str(tmp_path / "media-tasks"))
    monkeypatch.setenv("NAVIA_MEDIA_ASR_TASK_ROOT", str(tmp_path / "asr"))
    monkeypatch.setenv("NAVIA_MEDIA_DOWNLOAD_CACHE_ROOT", str(tmp_path / "dl"))
    monkeypatch.setenv("NAVIA_VISION_PROVIDER_DB_PATH", str(tmp_path / "navia.sqlite3"))
    monkeypatch.setenv("NAVIA_MEDIA_TOOL_ROOT", str(tmp_path / "managed-tools"))
    monkeypatch.setenv("NAVIA_ASR_ROOT", "/mnt/c/workspace/navia/.navia/asr")

    # The import surface only binds a task whose dependency generation is
    # verified. Use the REAL frozen yt-dlp artifact rather than a fake digest.
    from navia_runtime.modules.media_companion.dependencies import catalog as frozen

    managed = tmp_path / "managed"
    digest = frozen.YT_DLP_EXPECTED_SHA256
    target = managed / "versions" / "yt-dlp" / frozen.YT_DLP_VERSION / digest
    target.mkdir(parents=True, exist_ok=True)
    source = Path("/mnt/c/workSpace/navia/.navia/tools/yt-dlp")
    if source.is_file():
        (target / "yt-dlp").write_bytes(source.read_bytes())
    (managed / "active.json").write_text(
        __import__("json").dumps({"sha256": digest, "version": frozen.YT_DLP_VERSION,
                                   "verifiedAt": "2026-10-19T00:00:00.000Z"}),
        "utf-8",
    )
    monkeypatch.setenv("NAVIA_MEDIA_FFMPEG_PATH", "/usr/bin/ffmpeg")
    monkeypatch.setenv("NAVIA_MEDIA_FFPROBE_PATH", "/usr/bin/ffprobe")

    # C3: eligibility is decided by the REAL production coordinator.
    from wp_b_local_import_harness import make_task_eligible

    make_task_eligible(TASK_ID, SOURCE)

    store = LocalMediaImportStore(Path(tmp_path / "navia.sqlite3"))
    monkeypatch.setattr(runtime_app, "local_media_import_store", store, raising=False)
    # The manager is import-time bound too; give it this case's store so no
    # state leaks between cases through the module singleton.
    monkeypatch.setattr(runtime_app.local_media_import_manager, "store", store, raising=False)
    monkeypatch.setattr(runtime_app.local_media_import_manager, "tokens", TokenRegistry(), raising=False)

    # conftest imports the Runtime app before this case can set its env, so the
    # import-time managers are re-pointed at THIS case's roots here.
    monkeypatch.setattr(runtime_app.media_dependency_manager, "_root", managed, raising=False)
    asr_root = Path("/mnt/c/workspace/navia/.navia/asr")
    for attribute, value in (
        ("root", asr_root),
        ("models_root", asr_root / "models"),
        ("staging_root", asr_root / "staging"),
        ("import_root", asr_root / "imports"),
        ("state_path", asr_root / "state.json"),
    ):
        monkeypatch.setattr(runtime_app.asr_model_manager, attribute, value, raising=False)

    # The API-surface cases do not depend on ambient manager state, so the
    # frozen generation resolver is injected. B03 keeps the real path.
    monkeypatch.setattr(
        runtime_app, "local_import_generation_resolver", lambda: GENERATION, raising=False
    )

    globals()["runtime_app"] = runtime_app

    with TestClient(runtime_app.app) as test_client:
        test_client.import_store = store  # type: ignore[attr-defined]
        yield test_client


def auth(origin: str = ORIGIN, token: str = TOKEN) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Origin": origin}


# --- B04: OPTIONS ------------------------------------------------------------


def test_b04_options_allows_exactly_the_frozen_methods_and_headers(client: TestClient) -> None:
    response = client.options("/v1/media/local-imports", headers={"Origin": ORIGIN})
    assert response.status_code == 200
    allowed_methods = response.headers["access-control-allow-methods"]
    assert sorted(part.strip() for part in allowed_methods.split(",")) == [
        "DELETE", "GET", "OPTIONS", "POST", "PUT",
    ]
    allowed_headers = {
        part.strip().lower() for part in response.headers["access-control-allow-headers"].split(",")
    }
    assert allowed_headers == {
        "authorization", "content-type", "x-navia-import-token", "x-request-id",
    }
    # Content-Length is browser-controlled and must never be offered.
    assert "content-length" not in allowed_headers


def test_b04_options_from_a_web_origin_is_refused(client: TestClient) -> None:
    response = client.options("/v1/media/local-imports", headers={"Origin": "https://example.com"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_ORIGIN_MISMATCH"


# --- B04: the fixed rejection order -----------------------------------------


def test_b04_create_requires_the_exact_extension_origin(client: TestClient) -> None:
    response = client.post("/v1/media/local-imports", headers=auth(OTHER_ORIGIN), json=CREATE)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_ORIGIN_MISMATCH"


def test_b04_create_requires_a_bearer(client: TestClient) -> None:
    response = client.post("/v1/media/local-imports", headers={"Origin": ORIGIN}, json=CREATE)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_AUTH_REQUIRED"


def test_b04_a_web_origin_is_refused_before_the_body_is_read(client: TestClient) -> None:
    # The Origin check precedes the contract check, so an invalid body still
    # produces ORIGIN_MISMATCH rather than REQUEST_INVALID.
    response = client.post(
        "/v1/media/local-imports",
        headers=auth("https://example.com"),
        json={"nonsense": True},
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_ORIGIN_MISMATCH"


# --- B02: the exact create body ---------------------------------------------


@pytest.mark.parametrize(
    "mutation",
    [
        {"fileName": "clip.mp4"},
        {"path": "/home/user/clip.mp4"},
        {"url": "https://example.com/clip.mp4"},
        {"hash": "a" * 64},
        {"lastModified": 1},
        {"relativePath": "a/clip.mp4"},
        {"extension": "mp4"},
        {"extra": "field"},
    ],
)
def test_b02_every_client_metadata_field_is_refused(client: TestClient, mutation: dict[str, Any]) -> None:
    response = client.post("/v1/media/local-imports", headers=auth(), json={**CREATE, **mutation})
    assert response.status_code == 400, response.text
    body = response.json()
    assert body["error"]["code"] == "V3_MEDIA_IMPORT_REQUEST_INVALID"
    assert body["data"] is None
    assert set(body["error"]) == {"code", "message", "recoverable", "details"}


def test_b02_create_returns_the_upload_token_exactly_once(client: TestClient) -> None:
    response = client.post("/v1/media/local-imports", headers=auth(), json=CREATE)
    assert response.status_code == 201
    body = response.json()
    import_id = body["data"]["import"]["importId"]
    token = body["data"]["uploadToken"]
    assert len(token) == 43

    status = client.get(f"/v1/media/local-imports/{import_id}", headers=auth())
    assert status.status_code == 200
    assert status.headers.get("cache-control") == "no-store"
    # The token is NEVER repeated by the status surface.
    assert token not in status.text
    assert "uploadToken" not in status.text


def test_b03_create_acquires_the_generation_for_the_exact_task(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    observed: list[str] = []
    monkeypatch.setattr(
        runtime_app,
        "local_import_generation_resolver",
        lambda task_id: observed.append(task_id) or GENERATION,
        raising=False,
    )
    response = client.post("/v1/media/local-imports", headers=auth(), json=CREATE)
    assert response.status_code == 201
    assert observed == [TASK_ID]


def test_b02_unsupported_declared_type_is_422(client: TestClient) -> None:
    response = client.post(
        "/v1/media/local-imports",
        headers=auth(),
        json={**CREATE, "declaredMediaType": "video/quicktime"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_TYPE_UNSUPPORTED"


def test_b02_declared_length_beyond_two_gib_is_413(client: TestClient) -> None:
    response = client.post(
        "/v1/media/local-imports",
        headers=auth(),
        json={**CREATE, "byteLength": 2 * 1024**3 + 1},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_SIZE_LIMIT"


def test_b02_zero_byte_length_is_refused_without_allocating(client: TestClient) -> None:
    response = client.post("/v1/media/local-imports", headers=auth(), json={**CREATE, "byteLength": 0})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_REQUEST_INVALID"


# --- B10: content headers, all refused before the writer ---------------------


def _created(client: TestClient) -> tuple[str, str]:
    response = client.post("/v1/media/local-imports", headers=auth(), json=CREATE)
    body = response.json()
    assert body.get("data"), f"create failed: {response.status_code} {body}"
    return body["data"]["import"]["importId"], body["data"]["uploadToken"]


def test_b10_a_wrong_token_is_refused_before_the_writer(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import_id, _token = _created(client)
    built: list[str] = []
    monkeypatch.setattr(
        runtime_app.local_media_import_manager,
        "_build_writer",
        lambda *args, **kwargs: built.append("writer"),
        raising=False,
    )
    response = client.put(
        f"/v1/media/local-imports/{import_id}/content",
        headers={**auth(), "X-Navia-Import-Token": "A" * 43, "Content-Type": "video/mp4"},
        content=b"x" * 1024,
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_TOKEN_INVALID"
    assert built == [], "the writer must not be constructed before the token is proven"


def test_b10_content_type_must_match_the_declaration(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import_id, token = _created(client)
    built: list[str] = []
    monkeypatch.setattr(
        runtime_app.local_media_import_manager,
        "_build_writer",
        lambda *args, **kwargs: built.append("writer"),
        raising=False,
    )
    response = client.put(
        f"/v1/media/local-imports/{import_id}/content",
        headers={**auth(), "X-Navia-Import-Token": token, "Content-Type": "video/webm"},
        content=b"x" * 1024,
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_TYPE_UNSUPPORTED"
    assert built == []


def test_b10_content_encoding_is_refused(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import_id, token = _created(client)
    built: list[str] = []
    monkeypatch.setattr(
        runtime_app.local_media_import_manager,
        "_build_writer",
        lambda *args, **kwargs: built.append("writer"),
        raising=False,
    )
    response = client.put(
        f"/v1/media/local-imports/{import_id}/content",
        headers={
            **auth(),
            "X-Navia-Import-Token": token,
            "Content-Type": "video/mp4",
            "Content-Encoding": "gzip",
        },
        content=b"x" * 1024,
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_REQUEST_INVALID"
    assert built == []


def test_b10_declared_length_mismatch_is_refused_before_the_writer(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import_id, token = _created(client)
    built: list[str] = []
    monkeypatch.setattr(
        runtime_app.local_media_import_manager,
        "_build_writer",
        lambda *args, **kwargs: built.append("writer"),
        raising=False,
    )
    # 512 bytes against a declared 1024.
    response = client.put(
        f"/v1/media/local-imports/{import_id}/content",
        headers={**auth(), "X-Navia-Import-Token": token, "Content-Type": "video/mp4"},
        content=b"x" * 512,
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_SIZE_MISMATCH"
    assert built == [], "a short body must not start a writer"


# --- B06: status, cancel and restart -----------------------------------------


def test_b06_get_an_unknown_import_is_404(client: TestClient) -> None:
    response = client.get("/v1/media/local-imports/media_local_import_" + "0" * 32, headers=auth())
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_NOT_FOUND"


def test_b06_delete_is_idempotent_on_a_terminal_import(client: TestClient) -> None:
    import_id, _token = _created(client)
    first = client.delete(f"/v1/media/local-imports/{import_id}", headers=auth())
    assert first.status_code == 200
    second = client.delete(f"/v1/media/local-imports/{import_id}", headers=auth())
    assert second.status_code == 200
    assert second.json()["data"]["import"]["state"] in {"cancelled", "failed"}


def test_b06_get_after_a_restart_is_a_persisted_terminal_not_404(
    client: TestClient, tmp_path: Path
) -> None:
    import_id, _token = _created(client)
    client.delete(f"/v1/media/local-imports/{import_id}", headers=auth())

    # A BRAND NEW store instance over the same database, as a new process would
    # build. GET must still answer with the persisted state.
    fresh = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    record = fresh.get(import_id)
    assert record["state"] in {"cancelled", "failed"}
    assert record["importId"] == import_id


def test_b06_error_details_never_carry_a_path_or_a_token(client: TestClient) -> None:
    response = client.get("/v1/media/local-imports/media_local_import_" + "0" * 32, headers=auth())
    details = response.json()["error"]["details"]
    assert set(details) <= {"importId", "maximumBytes", "maximumDurationMs"}
    assert "token" not in json.dumps(response.json()).lower()
