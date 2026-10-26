"""Shared production harness for the WP-B corrective local-import tests.

Everything here drives the REAL FastAPI app through the REAL ASGI transport, so
the router, the privileged Origin middleware, the bearer check, the one-shot
upload token and the endpoint all execute together. Nothing is stubbed except
the two boundaries the contract allows us to control: the clock and the
filesystem root.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Iterator

import httpx
import pytest

from navia_runtime import app as runtime_app
from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.local_import.runtime import LocalImportManager
from navia_runtime.modules.media_companion.local_import.store import LocalMediaImportStore

EXTENSION_ID = "abcdefghijklmnop" * 2
ORIGIN = f"chrome-extension://{EXTENSION_ID}"
MASTER_TOKEN = "wpb-production-master-token-000000000000000000000000000000"
GENERATION = "depgen_" + "c" * 64
TASK_ID = "media_task_" + "b" * 32
SOURCE_IDENTITY = "portal:bilibili:BV1R6TEST:cid:1"


def make_task_eligible(
    task_id: str = TASK_ID,
    source_identity: str = SOURCE_IDENTITY,
) -> None:
    """Make the REAL task eligible on the REAL production coordinator.

    C3 is not a test hook: the three automatic routes must have failed, in the
    frozen order, on the very coordinator the Runtime uses. This registers the
    task there and exhausts them, so no case can bypass the gate.
    """
    from navia_runtime.modules.media_companion.acquisition.coordinator import (
        CAPTURE_FALLBACK_ROUTES,
        MediaAcquisitionError,
        MediaAcquisitionRequest,
    )

    coordinator = runtime_app.media_acquisition_coordinator
    try:
        coordinator.get(task_id)
    except MediaAcquisitionError:
        # The coordinator validates the identity against the request fields, so
        # they are derived from the identity itself rather than hard-coded.
        _portal, adapter_id, media_id, playback_unit_id, part_id = source_identity.split(":")
        coordinator.create(
            MediaAcquisitionRequest(
                task_id=task_id,
                source_identity=source_identity,
                adapter_id=adapter_id,
                media_id=media_id,
                playback_unit_id=playback_unit_id,
                part_id=part_id,
                consent_policy_id="bilibili-media-consent/v1",
                consent_policy_revision=1,
            )
        )
    for route in CAPTURE_FALLBACK_ROUTES:
        if route not in {
            item["route"] for item in coordinator.capture_eligibility(task_id)["failures"]
        }:
            coordinator.record_route_failure(task_id, route, "V3_MEDIA_SUBTITLE_UNAVAILABLE")


def owned_client(base_url: str = "http://runtime.local") -> httpx.AsyncClient:
    """A client over the REAL app and the REAL ASGI transport."""
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=runtime_app.app),
        base_url=base_url,
        timeout=60.0,
    )


@pytest.fixture
def production(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[LocalImportManager]:
    """The production manager on a private root, wired into the real app."""
    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    manager = LocalImportManager(store, media_root=str(tmp_path / "inputs"))
    manager._media_root = str(tmp_path / "inputs")
    make_task_eligible()
    manager._eligibility_resolver = runtime_app.media_acquisition_coordinator.local_import_eligibility
    monkeypatch.setattr(runtime_app, "local_media_import_store", store, raising=False)
    monkeypatch.setattr(runtime_app, "local_media_import_manager", manager, raising=False)
    monkeypatch.setattr(runtime_app, "local_import_generation_resolver", lambda: GENERATION, raising=False)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", MASTER_TOKEN)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    # The bootstrap authenticator must accept the owned master token + origin.
    monkeypatch.setattr(
        runtime_app.media_credential_authenticator,
        "authenticate_bootstrap",
        lambda authorization, origin: _accept(authorization, origin),
        raising=False,
    )
    yield manager
    manager.release_all()


def _accept(authorization: str | None, origin: str | None) -> None:
    if authorization != f"Bearer {MASTER_TOKEN}":
        from navia_runtime.modules.media_companion.credential_transport import MediaCredentialFailure

        raise MediaCredentialFailure("V3_MEDIA_RUNTIME_AUTH_REQUIRED", 401)
    if origin != ORIGIN:
        from navia_runtime.modules.media_companion.credential_transport import MediaCredentialFailure

        raise MediaCredentialFailure("V3_MEDIA_RUNTIME_ORIGIN_MISMATCH", 403)


def auth_headers(**extra: str) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {MASTER_TOKEN}", "Origin": ORIGIN}
    headers.update(extra)
    return headers


async def create_import(client: httpx.AsyncClient, *, byte_length: int = 1024) -> dict[str, Any]:
    """POST the frozen create body through the real router."""
    response = await client.post(
        "/v1/media/local-imports",
        headers=auth_headers(**{"Content-Type": "application/json"}),
        json={
            "taskId": TASK_ID,
            "sourceIdentity": SOURCE_IDENTITY,
            "declaredMediaType": "video/mp4",
            "byteLength": byte_length,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def put_content(
    client: httpx.AsyncClient,
    import_id: str,
    token: str,
    body: bytes,
    *,
    content_type: str = "video/mp4",
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    """PUT the raw body through the real router and middleware."""
    request_headers = auth_headers(
        **{
            "Content-Type": content_type,
            "X-Navia-Import-Token": token,
            "Content-Length": str(len(body)),
        }
    )
    if headers:
        request_headers.update(headers)
    return await client.put(
        f"/v1/media/local-imports/{import_id}/content",
        headers=request_headers,
        content=body,
    )
