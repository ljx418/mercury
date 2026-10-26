"""WP-B FC1 — the REAL Extension transport against the REAL Runtime endpoint.

This is a cross-boundary contract test. It reads the header set the shipped
Extension client actually sets on its content XHR, then drives a real routed PUT
through the real ASGI app with exactly those headers.

The expected set is NOT restated here. It is derived from what the Runtime's own
`_local_import_authorize` and the frozen CORS preflight actually require, so a
renamed or dropped header on either side fails this test instead of quietly
making both sides agree.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.local_import.runtime import LocalImportManager

from wp_b_local_import_harness import (  # noqa: F401  (fixtures/helpers used below)
    MASTER_TOKEN,
    ORIGIN,
    auth_headers,
    make_task_eligible,
    owned_client,
    production,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
CLIENT_SOURCE = (
    REPOSITORY_ROOT
    / "apps/chrome-extension/src/modules/media_companion/LocalMediaImportClient.ts"
)

#: What the Runtime endpoint itself demands of a content PUT. Derived from the
#: endpoint's own authorization and the frozen CORS allow-header list, not from
#: the Extension.
REQUIRED_BY_RUNTIME = frozenset({"Authorization", "X-Navia-Import-Token", "Content-Type"})
#: Headers the browser controls; the client must never set them by hand.
FORBIDDEN_BY_CLIENT = frozenset({"Content-Length"})


def _client_upload_headers() -> dict[str, str]:
    """Extract the literal header map the shipped client sends."""
    source = CLIENT_SOURCE.read_text(encoding="utf-8")
    match = re.search(
        r"function uploadHeaders\((?P<args>[^)]*)\)\s*:\s*Record<string, string>\s*\{\s*return\s*\{(?P<body>.*?)\}\s*;",
        source,
        re.DOTALL,
    )
    assert match, "The Extension client's uploadHeaders() could not be read."
    headers: dict[str, str] = {}
    for name, expression in re.findall(
        r'(?:"(?P<quoted>[^"]+)"|(?P<bare>[A-Za-z]+))\s*:\s*`?[^,\n}]+', match.group("body")
    ):
        key = name or None
        headers[key or expression] = ""
    assert headers, "The Extension client's uploadHeaders() returned no header literal."
    return headers


def test_fc1_the_client_sends_exactly_what_the_runtime_requires() -> None:
    """FC1 — the two sides must agree without either restating the other."""
    sent = set(_client_upload_headers())
    assert sent == set(REQUIRED_BY_RUNTIME), (
        "the Extension content PUT headers drifted from what the Runtime requires"
    )
    assert not (sent & FORBIDDEN_BY_CLIENT)


def test_fc1_the_client_reads_the_bearer_before_it_creates_a_transport() -> None:
    """FC1 — a missing bearer must create no XHR at all."""
    source = CLIENT_SOURCE.read_text(encoding="utf-8")
    body = source[source.index("upload(input:"):]
    bearer_read = body.index("const bearer = options.bearer();")
    transport_created = body.index("makeXhr()")
    assert bearer_read < transport_created, (
        "the client must read the bearer before any XMLHttpRequest exists"
    )
    # ...and it must refuse with the FROZEN code, before the transport exists.
    guard = body[bearer_read:transport_created]
    assert "if (!bearer)" in guard, "an absent bearer must be refused outright"
    assert "V3_MEDIA_IMPORT_AUTH_REQUIRED" in guard
    assert "reject(" in guard, "the refusal must happen before the request is opened"


def test_fc1_the_client_never_sets_content_length() -> None:
    """FC1 — Content-Length is browser-controlled."""
    assert "Content-Length" not in _client_upload_headers()


def test_fc1_the_client_never_persists_or_logs_a_credential() -> None:
    """FC1 — neither the bearer nor the one-shot token may be stored or logged."""
    source = CLIENT_SOURCE.read_text(encoding="utf-8")
    for forbidden in ("localStorage", "sessionStorage", "chrome.storage", "console.log", "console.debug"):
        assert forbidden not in source, f"the local-import client must not use {forbidden}"


@pytest.mark.anyio
async def test_fc1_the_production_headers_pass_the_real_routed_put(production: LocalImportManager) -> None:
    """FC1 — the REAL header set authenticates against the REAL endpoint."""
    make_task_eligible()
    production._eligibility_resolver = production._eligibility_resolver or None

    body = bytes((index % 251) + 1 for index in range(64 * 1024))
    async with owned_client() as client:
        created = await client.post(
            "/v1/media/local-imports",
            headers=auth_headers(**{"Content-Type": "application/json"}),
            json={
                "taskId": "media_task_" + "b" * 32,
                "sourceIdentity": "portal:bilibili:BV1R6TEST:cid:1",
                "declaredMediaType": "video/mp4",
                "byteLength": len(body),
            },
        )
        assert created.status_code == 201, created.text
        import_id = created.json()["data"]["import"]["importId"]
        upload_token = created.json()["data"]["uploadToken"]

        # EXACTLY the header names the shipped Extension client sends.
        headers = auth_headers(
            **{
                "X-Navia-Import-Token": upload_token,
                "Content-Type": "video/mp4",
                "Content-Length": str(len(body)),
            }
        )
        assert set(headers) == set(auth_headers()) | {
            "X-Navia-Import-Token",
            "Content-Type",
            "Content-Length",
        }
        response = await client.put(
            f"/v1/media/local-imports/{import_id}/content", headers=headers, content=body
        )

    assert response.status_code == 200, response.text
    envelope = response.json()
    # The REAL success envelope the client now unwraps.
    assert envelope["ok"] is True
    assert envelope["data"]["import"]["importId"] == import_id
    assert envelope["data"]["import"]["schemaVersion"] == C.PUBLIC_STATUS_SCHEMA_VERSION


@pytest.mark.anyio
async def test_fc1_a_missing_or_stale_bearer_fails_before_writer_allocation(
    production: LocalImportManager,
) -> None:
    """FC1 — a stale session is refused, and nothing is allocated."""
    make_task_eligible()
    body = b"x" * 4096

    async with owned_client() as client:
        created = await client.post(
            "/v1/media/local-imports",
            headers=auth_headers(**{"Content-Type": "application/json"}),
            json={
                "taskId": "media_task_" + "b" * 32,
                "sourceIdentity": "portal:bilibili:BV1R6TEST:cid:1",
                "declaredMediaType": "video/mp4",
                "byteLength": len(body),
            },
        )
        assert created.status_code == 201, created.text
        import_id = created.json()["data"]["import"]["importId"]
        upload_token = created.json()["data"]["uploadToken"]

        # A STALE bearer from a previous Runtime session: no Authorization at all.
        stale = await client.put(
            f"/v1/media/local-imports/{import_id}/content",
            headers={
                "Origin": ORIGIN,
                "X-Navia-Import-Token": upload_token,
                "Content-Type": "video/mp4",
                "Content-Length": str(len(body)),
            },
            content=body,
        )
        # ...and a bearer that is present but not this Runtime's.
        wrong = await client.put(
            f"/v1/media/local-imports/{import_id}/content",
            headers={
                "Authorization": "Bearer a-previous-runtime-session",
                "Origin": ORIGIN,
                "X-Navia-Import-Token": upload_token,
                "Content-Type": "video/mp4",
                "Content-Length": str(len(body)),
            },
            content=body,
        )

    for refused in (stale, wrong):
        assert refused.status_code == 401, refused.text
        envelope = refused.json()
        # The client must see an ERROR envelope, never a record.
        assert envelope["ok"] is False
        assert envelope["data"] is None
        assert envelope["error"]["code"] == "V3_MEDIA_IMPORT_AUTH_REQUIRED"

    # No writer was created and the import is still awaiting its real upload,
    # so the legitimate client can still complete it.
    assert production.has_session(import_id) is False
    assert production.store.get(import_id)["state"] == "awaiting_upload"
    assert production.store.get(import_id)["uploadedBytes"] == 0
    assert not (Path(production._media_root) / import_id / "source.bin").exists()
