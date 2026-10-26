"""WP-B AC2 — the routed transport oracles: B10, B11 and B12.

Every request below travels the REAL router, the REAL privileged-Origin
middleware, the REAL bearer check, the REAL one-shot token and the REAL
endpoint, over the REAL ASGI transport.

* **B10** — a missing Content-Length and a chunked transfer are refused BEFORE
  the writer exists, and the one-shot token survives the refusal.
* **B11** — transport chunks of 64 KiB, 1 MiB + 1 and 8 MiB are all legal; the
  writer slices stay <= 1 MiB and the cumulative bytes and digest match.
* **B12** — an interruption at 0 %, at 50 % and before the EOF closes the
  writer, settles the record, leaves no staging and allows a retry.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any, AsyncIterator

import httpx
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

TASK_ID = "media_task_" + "b" * 32
SOURCE_IDENTITY = "portal:bilibili:BV1R6TEST:cid:1"


async def _create(client: httpx.AsyncClient, byte_length: int) -> tuple[str, str]:
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
    data = response.json()["data"]
    return data["import"]["importId"], data["uploadToken"]


def _staging_files(production: LocalImportManager, import_id: str) -> list[Path]:
    root = Path(production._media_root) / import_id
    return [path for path in root.rglob("*") if path.is_file()] if root.exists() else []


# ---------------------------------------------------------------------------
# B10 — a missing Content-Length and a chunked transfer.
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_b10_a_missing_content_length_is_refused_before_the_writer(
    production: LocalImportManager,
) -> None:
    """B10 — the length is mandatory and the refusal costs no writer."""
    make_task_eligible()
    async with owned_client() as client:
        import_id, token = await _create(client, 1024)
        # No Content-Length at all: the body is sent chunked.
        response = await client.put(
            f"/v1/media/local-imports/{import_id}/content",
            headers=auth_headers(
                **{"X-Navia-Import-Token": token, "Content-Type": "video/mp4"}
            ),
            content=_Stream([b"x" * 1024]),
        )

    assert response.status_code == 400, response.text
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_REQUEST_INVALID"
    # No writer, no session, no staging, and the import still awaits its upload.
    assert production.has_session(import_id) is False
    assert _staging_files(production, import_id) == []
    assert production.store.get(import_id)["state"] == "awaiting_upload"
    assert production.store.get(import_id)["uploadedBytes"] == 0


@pytest.mark.anyio
async def test_b10_a_chunked_transfer_is_refused_before_the_writer(
    production: LocalImportManager,
) -> None:
    """B10 — `Transfer-Encoding: chunked` is the same refusal."""
    make_task_eligible()
    async with owned_client() as client:
        import_id, token = await _create(client, 1024)
        response = await client.put(
            f"/v1/media/local-imports/{import_id}/content",
            headers=auth_headers(
                **{
                    "X-Navia-Import-Token": token,
                    "Content-Type": "video/mp4",
                    "Transfer-Encoding": "chunked",
                }
            ),
            content=_Stream([b"x" * 1024]),
        )

    assert response.status_code == 400, response.text
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_REQUEST_INVALID"
    assert production.has_session(import_id) is False
    assert _staging_files(production, import_id) == []
    assert production.store.get(import_id)["state"] == "awaiting_upload"


@pytest.mark.anyio
async def test_b10_a_refused_upload_leaves_the_one_shot_token_usable(
    production: LocalImportManager,
) -> None:
    """B10 — a pre-writer refusal must not burn the token."""
    make_task_eligible()
    async with owned_client() as client:
        import_id, token = await _create(client, 1024)
        refused = await client.put(
            f"/v1/media/local-imports/{import_id}/content",
            headers=auth_headers(
                **{"X-Navia-Import-Token": token, "Content-Type": "video/mp4"}
            ),
            content=_Stream([b"x" * 1024]),
        )
        assert refused.status_code == 400
        # The very same token still completes the upload.
        accepted = await client.put(
            f"/v1/media/local-imports/{import_id}/content",
            headers=auth_headers(
                **{
                    "X-Navia-Import-Token": token,
                    "Content-Type": "video/mp4",
                    "Content-Length": "1024",
                }
            ),
            content=b"x" * 1024,
        )
    assert accepted.status_code == 200, accepted.text


# ---------------------------------------------------------------------------
# B11 — the transport chunk sizes.
# ---------------------------------------------------------------------------


class _Stream(httpx.AsyncByteStream):
    """A real chunked request body."""

    def __init__(self, chunks: list[bytes]) -> None:
        self._chunks = chunks

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for chunk in self._chunks:
            yield chunk


def _chunked(payload: bytes, chunk_size: int) -> list[bytes]:
    return [
        payload[offset : offset + chunk_size]
        for offset in range(0, len(payload), chunk_size)
    ]


@pytest.mark.anyio
@pytest.mark.parametrize("chunk_size", [64 * 1024, 1024 * 1024 + 1, 8 * 1024 * 1024])
async def test_b11_every_transport_chunk_size_is_legal_and_sliced(
    production: LocalImportManager, chunk_size: int
) -> None:
    """B11 — the transport chunk is legal at any size; the WRITER slices it."""
    make_task_eligible()
    payload = bytes((index % 251) + 1 for index in range(chunk_size + 4096))
    expected = hashlib.sha256(payload).hexdigest()
    sizes: list[int] = []
    original = production._build_writer

    def watched(import_id: str, declared_length: int):
        write = original(import_id, declared_length)

        def measured(piece: memoryview) -> None:
            sizes.append(len(piece))
            write(piece)

        return measured

    production._build_writer = watched  # type: ignore[method-assign]
    try:
        async with owned_client() as client:
            import_id, token = await _create(client, len(payload))
            response = await client.put(
                f"/v1/media/local-imports/{import_id}/content",
                headers=auth_headers(
                    **{
                        "X-Navia-Import-Token": token,
                        "Content-Type": "video/mp4",
                        "Content-Length": str(len(payload)),
                    }
                ),
                content=_Stream(_chunked(payload, chunk_size)),
            )
    finally:
        production._build_writer = original  # type: ignore[method-assign]

    assert response.status_code == 200, response.text
    # Every writer slice is within the frozen bound.
    assert sizes, "the writer never ran"
    assert max(sizes) <= C.WRITER_SLICE_BYTES, sizes
    # The cumulative bytes and the digest are exactly the payload's.
    assert sum(sizes) == len(payload)
    record = production.store.get(import_id)
    assert record["uploadedBytes"] == len(payload)
    assert record["videoManifestSha256"] == expected


# ---------------------------------------------------------------------------
# B12 — the public-path interruption.
# ---------------------------------------------------------------------------


class _Interrupted(httpx.AsyncByteStream):
    """A body that stops in the middle, exactly like a dropped connection."""

    def __init__(self, payload: bytes, *, stop_after: int) -> None:
        self._payload = payload
        self._stop_after = stop_after
        self.sent = 0

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for offset in range(0, len(self._payload), 4096):
            chunk = self._payload[offset : offset + 4096]
            if self.sent >= self._stop_after:
                raise httpx.ReadError("the client went away")
            self.sent += len(chunk)
            yield chunk


@pytest.mark.anyio
@pytest.mark.parametrize("fraction", [0.0, 0.5])
async def test_b12_an_interrupted_upload_leaves_nothing_and_allows_a_retry(
    production: LocalImportManager, fraction: float
) -> None:
    """B12 — 0 % and 50 %: the writer closes, the staging is empty, a retry works."""
    make_task_eligible()
    payload = bytes((index % 251) + 1 for index in range(64 * 1024))
    stop_after = int(len(payload) * fraction)

    async with owned_client() as client:
        import_id, token = await _create(client, len(payload))
        # A dropped connection may surface as a transport error or as the
        # endpoint's own fail-closed error. Both are acceptable; the STATE is
        # what this case proves.
        try:
            response = await client.put(
                f"/v1/media/local-imports/{import_id}/content",
                headers=auth_headers(
                    **{
                        "X-Navia-Import-Token": token,
                        "Content-Type": "video/mp4",
                        "Content-Length": str(len(payload)),
                    }
                ),
                content=_Interrupted(payload, stop_after=stop_after),
            )
        except httpx.ReadError:
            response = None
        if response is not None:
            assert response.status_code >= 400, response.text

    # The writer is closed and no staging survived.
    assert production.has_session(import_id) is False
    assert _staging_files(production, import_id) == []
    record = production.store.get(import_id)
    assert record["state"] in {"failed", "cancelled"}, record
    assert record["failureCode"] in {
        "V3_MEDIA_IMPORT_WRITE_FAILED",
        "V3_MEDIA_IMPORT_CANCELLED",
    }
    # A NEW selection is possible for the same task.
    async with owned_client() as client:
        retried, _retry_token = await _create(client, len(payload))
    assert retried != import_id
    assert production.store.get(retried)["state"] == "awaiting_upload"


@pytest.mark.anyio
async def test_b12_an_eof_before_the_complete_is_refused(
    production: LocalImportManager,
) -> None:
    """B12 — a body that ends before the declared length is a size mismatch."""
    make_task_eligible()
    payload = bytes((index % 251) + 1 for index in range(64 * 1024))
    short = payload[: 32 * 1024]

    async with owned_client() as client:
        import_id, token = await _create(client, len(payload))
        response = await client.put(
            f"/v1/media/local-imports/{import_id}/content",
            headers=auth_headers(
                **{
                    "X-Navia-Import-Token": token,
                    "Content-Type": "video/mp4",
                    "Content-Length": str(len(payload)),
                }
            ),
            content=_Stream(_chunked(short, 8192)),
        )

    assert response.status_code == 400, response.text
    assert response.json()["error"]["code"] == "V3_MEDIA_IMPORT_SIZE_MISMATCH"
    assert production.has_session(import_id) is False
    assert _staging_files(production, import_id) == []
    record = production.store.get(import_id)
    assert record["state"] in {"failed", "cancelled"}, record
    assert record["uploadedBytes"] != len(payload)
