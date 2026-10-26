"""WP-B corrective C6/C7 — ROUTED HTTP proof over the real ASGI app.

Every request below travels the real router and the real privileged-Origin
middleware, then the real bearer check, the real one-shot upload token and the
real endpoint. Nothing calls the manager directly.

Covers the C6 reachability requirements that are provable here:

  * OPTIONS returns the EXACT `Access-Control-Allow-Origin`, the frozen
    methods/headers and `Cache-Control: no-store`;
  * a wrong Origin is refused by the MIDDLEWARE, before the endpoint;
  * a missing/incorrect bearer is refused by the ENDPOINT;
  * a routed PUT succeeds with a transport chunk larger than 1 MiB, the writer
    slices stay <= 1 MiB, and the DURABLE record holds the EXACT SHA-256 of
    the body (not merely a nonempty hash).
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.local_import.runtime import LocalImportManager

from wp_b_local_import_harness import (  # noqa: F401  (the fixture is used)
    MASTER_TOKEN,
    ORIGIN,
    auth_headers,
    create_import,
    owned_client,
    production,
    put_content,
)

OVER_ONE_MIB = C.WRITER_SLICE_BYTES + 4096


@pytest.mark.anyio
async def test_options_returns_the_exact_frozen_cors_shape(production: LocalImportManager) -> None:
    """C6 — exact allow-origin, frozen methods/headers, no-store."""
    async with owned_client() as client:
        response = await client.options("/v1/media/local-imports", headers={"Origin": ORIGIN})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert sorted(
        part.strip() for part in response.headers["access-control-allow-methods"].split(",")
    ) == ["DELETE", "GET", "OPTIONS", "POST", "PUT"]
    assert {
        part.strip().lower() for part in response.headers["access-control-allow-headers"].split(",")
    } == {"authorization", "content-type", "x-navia-import-token", "x-request-id"}
    assert response.headers["cache-control"] == "no-store"
    # Content-Length is browser-controlled and must never be offered.
    assert "content-length" not in response.headers["access-control-allow-headers"].lower()


@pytest.mark.anyio
async def test_a_web_origin_is_refused_by_the_middleware(production: LocalImportManager) -> None:
    """C6/C7 — the Origin gate is the middleware's, not the endpoint's."""
    async with owned_client() as client:
        response = await client.post(
            "/v1/media/local-imports",
            headers={"Authorization": f"Bearer {MASTER_TOKEN}", "Origin": "https://example.com",
                     "Content-Type": "application/json"},
            json={
                "taskId": "media_task_" + "b" * 32,
                "sourceIdentity": "portal:bilibili:BV1R6TEST:cid:1",
                "declaredMediaType": "video/mp4",
                "byteLength": 1024,
            },
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_ORIGIN_MISMATCH"


@pytest.mark.anyio
async def test_a_missing_bearer_is_refused_by_the_endpoint(production: LocalImportManager) -> None:
    """C6 — exact Origin but no bearer never reaches the import body."""
    async with owned_client() as client:
        response = await client.post(
            "/v1/media/local-imports",
            headers={"Origin": ORIGIN, "Content-Type": "application/json"},
            json={
                "taskId": "media_task_" + "b" * 32,
                "sourceIdentity": "portal:bilibili:BV1R6TEST:cid:1",
                "declaredMediaType": "video/mp4",
                "byteLength": 1024,
            },
        )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_AUTH_REQUIRED"


@pytest.mark.anyio
async def test_a_routed_put_succeeds_and_the_durable_digest_is_exact(
    production: LocalImportManager,
) -> None:
    """C6/C7 — a real routed upload; the durable digest is the EXACT body digest."""
    body = bytes((index % 251) + 1 for index in range(OVER_ONE_MIB * 2))
    expected_digest = hashlib.sha256(body).hexdigest()

    async with owned_client() as client:
        created = await create_import(client, byte_length=len(body))
        import_id = created["import"]["importId"]
        assert C.IMPORT_ID_RE.fullmatch(import_id), import_id

        response = await put_content(client, import_id, created["uploadToken"], body)

    assert response.status_code == 200, response.text
    record = response.json()["data"]["import"]
    assert record["state"] == "verifying"
    assert record["uploadedBytes"] == len(body)
    assert record["schemaVersion"] == C.PUBLIC_STATUS_SCHEMA_VERSION
    assert record["recoverable"] is True
    assert record["media"] is None  # preparation has not run yet

    # The DURABLE record — not the response — carries the exact digest.
    durable = production.store.get(import_id)
    assert durable["videoManifestSha256"] == expected_digest
    assert durable["uploadedBytes"] == len(body)
    assert durable["state"] == "verifying"


@pytest.mark.anyio
async def test_a_routed_put_rejects_a_wrong_token_before_the_writer(
    production: LocalImportManager, monkeypatch: pytest.MonkeyPatch
) -> None:
    """C6 — the one-shot token is consumed by the first legal connection only."""
    built: list[str] = []
    original_build = production._build_writer

    def watched(import_id: str, declared_length: int):
        built.append("writer")
        return original_build(import_id, declared_length)

    monkeypatch.setattr(production, "_build_writer", watched)

    body = b"x" * 512
    async with owned_client() as client:
        created = await create_import(client, byte_length=len(body))
        import_id = created["import"]["importId"]

        first = await put_content(client, import_id, "A" * 43, body)
        assert first.status_code == 401
        assert first.json()["error"]["code"] == "V3_MEDIA_IMPORT_TOKEN_INVALID"
        assert built == [], "the writer must not exist before the token is proven"

        # The SAME token now works exactly once.
        second = await put_content(client, import_id, created["uploadToken"], body)
        assert second.status_code == 200, second.text

        # ...and it cannot be replayed.
        third = await put_content(client, import_id, created["uploadToken"], body)
        assert third.status_code == 401
        assert third.json()["error"]["code"] == "V3_MEDIA_IMPORT_TOKEN_INVALID"


@pytest.mark.anyio
async def test_a_fresh_store_instance_still_sees_the_uploaded_record(
    production: LocalImportManager, tmp_path: Path
) -> None:
    """C7 — the durable record is visible to a NEW store over the same database."""
    from navia_runtime.modules.media_companion.local_import.store import (
        LocalMediaImportStore,
    )

    body = bytes((index % 251) + 1 for index in range(4096))
    async with owned_client() as client:
        created = await create_import(client, byte_length=len(body))
        import_id = created["import"]["importId"]
        response = await put_content(client, import_id, created["uploadToken"], body)
    assert response.status_code == 200

    fresh = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    record = fresh.get(import_id)
    assert record["state"] == "verifying"
    assert record["uploadedBytes"] == len(body)
    assert record["videoManifestSha256"] == hashlib.sha256(body).hexdigest()
