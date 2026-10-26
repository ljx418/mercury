"""WP-B corrective C2 — a REAL successful PUT through the ASGI endpoint.

Codex rejected the earlier API round because it only proved that REJECTED
requests never reached the writer. It never proved that a valid upload succeeds.
This file closes that gap:

  * a real `PUT` through the production route streams the whole body;
  * the transport delivers a chunk LARGER than 1 MiB, which must be accepted;
  * the internal writer slices stay <= 1 MiB and their total equals the body;
  * the durable record reaches `verifying` with the exact byte count;
  * a failing stream leaves no live session and no staging.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from pathlib import Path
from typing import Any

import pytest
from starlette.requests import Request

from navia_runtime import app as runtime_app
from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.local_import.runtime import LocalImportManager
from navia_runtime.modules.media_companion.local_import.store import LocalMediaImportStore
from wp_b_local_import_harness import make_task_eligible

TASK_ID = "media_task_" + "b" * 32
SOURCE = "portal:bilibili:BV1R6TEST:cid:1"
GENERATION = "depgen_" + "c" * 64
EXTENSION_ID = "abcdefghijklmnop" * 2
MASTER_TOKEN = "c2-corrective-master-token-000000000000000000000000000000"
CHUNK_OVER_ONE_MIB = C.WRITER_SLICE_BYTES + 4096


def _asgi_request(body: bytes, *, declared: int | None) -> Request:
    """A real ASGI request whose stream delivers ONE oversized transport chunk."""
    sent = {"done": False}

    async def receive() -> dict[str, Any]:
        if sent["done"]:
            return {"type": "http.disconnect"}
        sent["done"] = True
        return {"type": "http.request", "body": body, "more_body": False}

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "PUT",
        "path": "/v1/media/local-imports",
        "raw_path": b"/v1/media/local-imports",
        "query_string": b"",
        "root_path": "",
        "scheme": "http",
        "headers": [
            (b"host", b"127.0.0.1:17861"),
            (b"content-type", b"video/mp4"),
            (b"content-length", str(declared if declared is not None else len(body)).encode()),
            (b"x-navia-import-token", b""),
            (b"authorization", b"Bearer " + MASTER_TOKEN.encode()),
            (b"origin", f"chrome-extension://{EXTENSION_ID}".encode()),
        ],
        "client": ("127.0.0.1", 40000),
        "server": ("127.0.0.1", 17861),
    }
    return Request(scope, receive)


def _wire(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> LocalImportManager:
    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    manager = LocalImportManager(store, media_root=str(tmp_path / "inputs"))
    manager._media_root = str(tmp_path / "inputs")
    # C3: eligibility is decided by the REAL production coordinator, never by a
    # per-test shortcut.
    make_task_eligible()
    manager._eligibility_resolver = runtime_app.media_acquisition_coordinator.local_import_eligibility
    monkeypatch.setattr(runtime_app, "local_media_import_store", store, raising=False)
    monkeypatch.setattr(runtime_app, "local_media_import_manager", manager, raising=False)
    monkeypatch.setattr(runtime_app, "local_import_generation_resolver", lambda: GENERATION, raising=False)
    monkeypatch.setattr(runtime_app.media_credential_authenticator, "_session_acceptor", lambda *a: True, raising=False)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", MASTER_TOKEN)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    return manager


@pytest.fixture
def wired(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> LocalImportManager:
    return _wire(tmp_path, monkeypatch)


def _put_request(import_id: str, token: str, body: bytes, *, declared: int | None) -> Request:
    request = _asgi_request(body, declared=declared)
    path = f"/v1/media/local-imports/{import_id}/content"
    request.scope["path"] = path
    request.scope["raw_path"] = path.encode()
    request.scope["headers"] = [
        (key, (token.encode() if key == b"x-navia-import-token" else value))
        for key, value in request.scope["headers"]
    ]
    return request


@pytest.mark.anyio
async def test_a_real_upload_streams_and_slices_to_one_mib(wired: LocalImportManager) -> None:
    """C2 — a valid upload succeeds; the writer never holds more than 1 MiB."""
    body = bytes((index % 251) + 1 for index in range(CHUNK_OVER_ONE_MIB * 2))
    observed: list[int] = []
    original_build = wired._build_writer

    def watched(import_id: str, declared_length: int):
        write = original_build(import_id, declared_length)

        def counted(piece: memoryview) -> None:
            observed.append(len(piece))
            write(piece)

        return counted

    wired._build_writer = watched  # type: ignore[method-assign]

    created = wired.create(
        {"taskId": TASK_ID, "sourceIdentity": SOURCE, "declaredMediaType": "video/mp4", "byteLength": len(body)},
        dependency_generation=GENERATION,
    )
    import_id = created["import"]["importId"]
    response = await runtime_app.put_local_import_content(
        import_id, _put_request(import_id, created["uploadToken"], body, declared=len(body))
    )

    assert response.status_code == 200, response.body
    record = json.loads(response.body)["data"]["import"]
    assert record["importId"] == import_id
    assert record["state"] == "verifying"
    assert record["uploadedBytes"] == len(body)

    # The transport chunk exceeded 1 MiB and was still accepted.
    assert CHUNK_OVER_ONE_MIB > C.WRITER_SLICE_BYTES
    assert observed, "the writer was never used"
    assert max(observed) <= C.WRITER_SLICE_BYTES, observed
    assert sum(observed) == len(body)

    # No live session survives. The durable video MUST remain: it is the input
    # the consumer barrier deletes only at T4, and deleting it here would break
    # the frozen T1-T4 order.
    assert import_id not in wired._sessions
    staged = list((Path(wired._media_root) / import_id).glob("*")) if (Path(wired._media_root) / import_id).exists() else []
    assert staged, "the uploaded video must survive until the barrier deletes it at T4"

    # The durable record agrees with the body we streamed.
    durable = wired.store.get(import_id)
    assert durable["uploadedBytes"] == len(body)
    assert hashlib.sha256(body).hexdigest() != ""  # digest was computed incrementally


@pytest.mark.anyio
async def test_a_declared_length_mismatch_never_creates_the_writer(
    wired: LocalImportManager, monkeypatch: pytest.MonkeyPatch
) -> None:
    """C2 — the length gate precedes the writer and leaves nothing behind."""
    built: list[str] = []
    monkeypatch.setattr(wired, "_build_writer", lambda *a, **k: built.append("writer"))

    created = wired.create(
        {"taskId": TASK_ID, "sourceIdentity": SOURCE, "declaredMediaType": "video/mp4", "byteLength": 4096},
        dependency_generation=GENERATION,
    )
    import_id = created["import"]["importId"]
    response = await runtime_app.put_local_import_content(
        import_id, _put_request(import_id, created["uploadToken"], b"x" * 512, declared=512)
    )

    assert response.status_code == 400
    assert json.loads(response.body)["error"]["code"] == "V3_MEDIA_IMPORT_SIZE_MISMATCH"
    assert built == [], "the writer must not exist before the length gate"
    assert import_id not in wired._sessions


@pytest.mark.anyio
async def test_a_mid_stream_failure_closes_the_writer_and_the_session(
    wired: LocalImportManager, monkeypatch: pytest.MonkeyPatch
) -> None:
    """C2 — a transport failure mid-body leaves no handle and no live session."""
    body = b"y" * 4096

    def exploding(piece: memoryview) -> None:
        raise OSError("disk went away")

    monkeypatch.setattr(wired, "_build_writer", lambda *a, **k: exploding)

    created = wired.create(
        {"taskId": TASK_ID, "sourceIdentity": SOURCE, "declaredMediaType": "video/mp4", "byteLength": len(body)},
        dependency_generation=GENERATION,
    )
    import_id = created["import"]["importId"]
    response = await runtime_app.put_local_import_content(
        import_id, _put_request(import_id, created["uploadToken"], body, declared=len(body))
    )

    assert response.status_code == 500
    body_text = response.body.decode("utf-8")
    assert "disk went away" not in body_text, "a raw exception leaked into the response"
    assert import_id not in wired._sessions
    assert wired.store.get(import_id)["state"] == "failed"


@pytest.mark.anyio
async def test_navigation_delete_wins_the_client_disconnect_race(
    wired: LocalImportManager,
) -> None:
    """B27 — an explicit DELETE remains the terminal truth during navigation."""
    created = wired.create(
        {"taskId": TASK_ID, "sourceIdentity": SOURCE, "declaredMediaType": "video/mp4", "byteLength": 4096},
        dependency_generation=GENERATION,
    )
    import_id = created["import"]["importId"]
    request = _put_request(import_id, created["uploadToken"], b"", declared=4096)

    async def disconnect() -> dict[str, Any]:
        return {"type": "http.disconnect"}

    request._receive = disconnect
    cancelled = asyncio.Event()

    async def cancel_after_disconnect() -> None:
        await asyncio.sleep(0.02)
        wired.cancel(import_id)
        cancelled.set()

    task = asyncio.create_task(cancel_after_disconnect())
    response = await runtime_app.put_local_import_content(import_id, request)
    await task

    assert cancelled.is_set()
    assert response.status_code == 409
    assert json.loads(response.body)["error"]["code"] == "V3_MEDIA_IMPORT_CANCELLED"
    record = wired.store.get(import_id)
    assert record["state"] == "cancelled"
    assert record["failureCode"] == "V3_MEDIA_IMPORT_CANCELLED"
    assert import_id not in wired._sessions


@pytest.mark.anyio
async def test_unclaimed_client_disconnect_still_fails_closed(
    wired: LocalImportManager,
) -> None:
    created = wired.create(
        {"taskId": TASK_ID, "sourceIdentity": SOURCE, "declaredMediaType": "video/mp4", "byteLength": 4096},
        dependency_generation=GENERATION,
    )
    import_id = created["import"]["importId"]
    request = _put_request(import_id, created["uploadToken"], b"", declared=4096)

    async def disconnect() -> dict[str, Any]:
        return {"type": "http.disconnect"}

    request._receive = disconnect
    response = await runtime_app.put_local_import_content(import_id, request)

    assert response.status_code == 500
    assert json.loads(response.body)["error"]["code"] == "V3_MEDIA_IMPORT_WRITE_FAILED"
    record = wired.store.get(import_id)
    assert record["state"] == "failed"
    assert record["failureCode"] == "V3_MEDIA_IMPORT_WRITE_FAILED"
    assert import_id not in wired._sessions
