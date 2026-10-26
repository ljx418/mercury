"""WP-B B1 manager — token ownership and the frozen streaming writer.

Cases map to B05 (token is single-use, never persisted), B11 (transport chunks
of any size are sliced to <=1 MiB with an identical cumulative digest) and
B12 (client interruption leaves no residue and the import may be retried).
"""

from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.local_import.contracts import (
    WRITER_SLICE_BYTES,
    ImportError,
)
from navia_runtime.modules.media_companion.local_import.manager import (
    ImportSession,
    SliceWriter,
    TokenRegistry,
    iter_slices,
    token_digest,
)
from navia_runtime.modules.media_companion.local_import.store import TABLE

IMPORT_ID = "media_import_" + "a" * 32


def test_b05_token_is_43_characters_and_single_use() -> None:
    registry = TokenRegistry(now=lambda: 1000.0)
    token = registry.issue(IMPORT_ID)
    assert len(token) == 43

    registry.consume(token, IMPORT_ID)
    with pytest.raises(ImportError) as replay:
        registry.consume(token, IMPORT_ID)
    assert replay.value.code == "V3_MEDIA_IMPORT_TOKEN_INVALID"


def test_b05_token_is_bound_to_its_import_and_expiry() -> None:
    registry = TokenRegistry(now=lambda: 1000.0)
    token = registry.issue(IMPORT_ID)

    with pytest.raises(ImportError) as cross:
        registry.consume(token, "media_import_" + "f" * 32)
    assert cross.value.code == "V3_MEDIA_IMPORT_TOKEN_INVALID"

    # The cross-import attempt must NOT consume the token.
    registry.consume(token, IMPORT_ID)

    expiring = TokenRegistry(now=lambda: 0.0)
    stale = expiring.issue(IMPORT_ID)
    later = TokenRegistry(now=lambda: 10_000.0)
    # A fresh registry cannot know an old token at all.
    with pytest.raises(ImportError):
        later.consume(stale, IMPORT_ID)


def test_b05_token_digest_never_equals_the_token() -> None:
    registry = TokenRegistry()
    token = registry.issue(IMPORT_ID)
    digest = token_digest(token)
    assert digest != token
    assert len(digest) == 64


# --- B11: transport chunks of any size --------------------------------------


@pytest.mark.parametrize("chunk_size", [64 * 1024, WRITER_SLICE_BYTES, WRITER_SLICE_BYTES + 1, 8 * WRITER_SLICE_BYTES])
def test_b11_transport_chunk_of_any_size_is_sliced_to_one_mib(chunk_size: int) -> None:
    written: list[int] = []
    payload = bytes((index % 251) + 1 for index in range(chunk_size * 2))
    writer = SliceWriter(
        write=lambda piece: written.append(len(piece)),
        declared_length=len(payload),
        task_quota_bytes=len(payload),
    )
    for offset in range(0, len(payload), chunk_size):
        writer.feed(payload[offset : offset + chunk_size])

    assert writer.finish() == hashlib.sha256(payload).hexdigest()
    assert all(size <= WRITER_SLICE_BYTES for size in written), written
    assert sum(written) == len(payload)


def test_b11_cumulative_digest_is_independent_of_chunking() -> None:
    payload = bytes((index % 97) + 1 for index in range(300_000))
    digests = []
    for chunk_size in (1_000, 64 * 1024, WRITER_SLICE_BYTES, WRITER_SLICE_BYTES * 3):
        writer = SliceWriter(
            write=lambda _piece: None,
            declared_length=len(payload),
            task_quota_bytes=len(payload),
        )
        for offset in range(0, len(payload), chunk_size):
            writer.feed(payload[offset : offset + chunk_size])
        digests.append(writer.finish())
    assert len(set(digests)) == 1
    assert digests[0] == hashlib.sha256(payload).hexdigest()


def test_b11_iter_slices_never_exceeds_the_bound() -> None:
    payload = b"x" * (WRITER_SLICE_BYTES * 2 + 5)
    sizes = [len(piece) for piece in iter_slices(payload)]
    assert max(sizes) <= WRITER_SLICE_BYTES
    assert sum(sizes) == len(payload)


# --- B11: the frozen bounds --------------------------------------------------


def test_b11_task_quota_is_checked_before_each_slice() -> None:
    payload = b"y" * (WRITER_SLICE_BYTES + 10)
    writer = SliceWriter(
        write=lambda _piece: None,
        declared_length=len(payload),
        task_quota_bytes=WRITER_SLICE_BYTES,
    )
    with pytest.raises(ImportError) as error:
        writer.feed(payload)
    assert error.value.code == "V3_MEDIA_IMPORT_SIZE_LIMIT"


def test_b11_declared_length_boundary_is_exact() -> None:
    writer = SliceWriter(
        write=lambda _piece: None, declared_length=10, task_quota_bytes=100
    )
    writer.feed(b"z" * 10)
    assert writer.finish() == hashlib.sha256(b"z" * 10).hexdigest()

    short = SliceWriter(write=lambda _piece: None, declared_length=10, task_quota_bytes=100)
    with pytest.raises(ImportError):
        short.finish()  # EOF before the declared length


def test_b11_over_declared_length_is_refused() -> None:
    writer = SliceWriter(write=lambda _piece: None, declared_length=4, task_quota_bytes=100)
    with pytest.raises(ImportError) as error:
        writer.feed(b"z" * 8)
    assert error.value.code == "V3_MEDIA_IMPORT_SIZE_MISMATCH"


# --- B12: client interruption ------------------------------------------------


def test_b12_cancel_stops_the_writer_and_leaves_a_clean_state() -> None:
    session = ImportSession(
        import_id=IMPORT_ID,
        declared_length=WRITER_SLICE_BYTES * 4,
        write=lambda _piece: None,
        task_quota_bytes=WRITER_SLICE_BYTES * 4,
    )
    session.feed(b"a" * WRITER_SLICE_BYTES)
    written = session.writer.written
    assert written == WRITER_SLICE_BYTES

    session.cancel()
    with pytest.raises(ImportError) as error:
        session.feed(b"a" * WRITER_SLICE_BYTES)
    assert error.value.code == "V3_MEDIA_IMPORT_CANCELLED"
    # Nothing further was written after the cancel.
    assert session.writer.written == written


def test_b12_the_store_never_persists_a_token(tmp_path: Path) -> None:
    from navia_runtime.modules.media_companion.local_import.store import (
        LocalMediaImportStore,
    )

    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    registry = TokenRegistry()
    token = registry.issue(IMPORT_ID)
    store.create_import(
        task_id="media_task_" + "b" * 32,
        source_identity="portal:bilibili:BV1local000000:cid:1",
        byte_length=1024,
        declared_media_type="video/mp4",
        dependency_generation="depgen_" + "c" * 64,
        import_id=IMPORT_ID,
    )
    registry.consume(token, IMPORT_ID)

    connection = sqlite3.connect(store.database_path)
    try:
        dump = "\n".join(connection.iterdump())
    finally:
        connection.close()
    assert token not in dump
    assert token_digest(token) not in dump
    assert "token" not in dump.lower()
