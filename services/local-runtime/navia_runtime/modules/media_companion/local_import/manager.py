"""WP-B local media import manager.

The manager owns, in-process: the awaiting upload tokens (digests only), the
streaming writer, the state transitions, cancellation and the composite
cleanup. It never sees a client file name, a client path, a URL or a hash that
the client supplied.

Streaming rules (frozen):

* content arrives through the ASGI `request.stream()`; a transport chunk LARGER
  than 1 MiB is legal and is never rejected;
* the writer slices every transport chunk with a `memoryview` into
  `<= 1,048,576` byte pieces, so the process never holds a second large buffer;
* the cumulative 2 GiB bound and the task quota are checked BEFORE each slice;
* SHA-256 is updated incrementally; EOF must match the declared length exactly.
"""

from __future__ import annotations

import hashlib
import secrets
import threading
from pathlib import Path
from typing import Any, Callable, Iterable

from .observations import observations
from .contracts import (
    AWAITING_TOKEN_TTL_SECONDS,
    MAX_IMPORT_BYTES,
    UPLOAD_WALL_CLOCK_SECONDS,
    WRITER_SLICE_BYTES,
    ImportError,
)

TOKEN_BYTES = 32  # 256-bit, encoded as 43 base64url characters


def issue_upload_token() -> str:
    """A 256-bit base64url token (43 characters)."""
    return secrets.token_urlsafe(TOKEN_BYTES)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class TokenRegistry:
    """In-memory, single-use upload tokens. Only the digest is ever stored."""

    def __init__(self, *, now: Callable[[], float] | None = None) -> None:
        self._entries: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()
        self._now = now or __import__("time").monotonic

    def issue(self, import_id: str) -> str:
        token = issue_upload_token()
        with self._lock:
            self._entries[token_digest(token)] = {
                "importId": import_id,
                "expiresAt": self._now() + AWAITING_TOKEN_TTL_SECONDS,
                "consumed": False,
            }
        return token

    def verify(self, token: str, import_id: str) -> None:
        """Check the token WITHOUT consuming it.

        The endpoint verifies the token first, so a wrong token is refused
        before any other gate is reported, and consumes it only when the write
        really starts. A request that is refused for another reason therefore
        leaves the token usable.
        """
        digest = token_digest(token)
        with self._lock:
            entry = self._entries.get(digest)
            if entry is None:
                raise ImportError("TOKEN_INVALID", "Upload token is not valid for this import.")
            if entry["importId"] != import_id:
                raise ImportError("TOKEN_INVALID", "Upload token is not valid for this import.")
            if entry["consumed"]:
                raise ImportError("TOKEN_INVALID", "Upload token has already been used.")
            if self._now() > entry["expiresAt"]:
                self._entries.pop(digest, None)
                raise ImportError("TOKEN_INVALID", "Upload token has expired.")

    def consume(self, token: str, import_id: str) -> None:
        """Consume once. A replay, a cross-import or an expired token fails."""
        digest = token_digest(token)
        with self._lock:
            entry = self._entries.get(digest)
            if entry is None:
                raise ImportError("TOKEN_INVALID", "Upload token is not valid for this import.")
            if entry["importId"] != import_id:
                raise ImportError("TOKEN_INVALID", "Upload token is not valid for this import.")
            if entry["consumed"]:
                raise ImportError("TOKEN_INVALID", "Upload token has already been used.")
            if self._now() > entry["expiresAt"]:
                self._entries.pop(digest, None)
                raise ImportError("TOKEN_INVALID", "Upload token has expired.")
            entry["consumed"] = True

    def forget(self, import_id: str) -> None:
        with self._lock:
            for digest in [
                key for key, entry in self._entries.items() if entry["importId"] == import_id
            ]:
                self._entries.pop(digest, None)

    def outstanding(self) -> int:
        with self._lock:
            return len(self._entries)


class SliceWriter:
    """Writes streamed content in <=1 MiB slices with quota and cancel checks."""

    def __init__(
        self,
        *,
        write: Callable[[memoryview], None],
        declared_length: int,
        task_quota_bytes: int,
        is_cancelled: Callable[[], bool] | None = None,
        on_progress: Callable[[int], None] | None = None,
        import_id: str = "",
    ) -> None:
        self._import_id = import_id
        self._write = write
        self._declared = declared_length
        self._quota = task_quota_bytes
        self._is_cancelled = is_cancelled or (lambda: False)
        self._on_progress = on_progress
        self._digest = hashlib.sha256()
        self.written = 0

    def feed(self, transport_chunk: bytes) -> None:
        """Accept one ASGI transport chunk of ANY size and slice it.

        A single chunk larger than 1 MiB is legal: the slice, not the chunk,
        is the unit of accounting and of writing.
        """
        if self.written > self._declared:
            raise ImportError("SIZE_MISMATCH", "Received more bytes than declared.")
        view = memoryview(transport_chunk)
        try:
            for offset in range(0, len(view), WRITER_SLICE_BYTES):
                if self._is_cancelled():
                    raise ImportError("CANCELLED", "Import was cancelled by the user.")
                piece = view[offset : offset + WRITER_SLICE_BYTES]
                if self.written + len(piece) > self._declared:
                    raise ImportError("SIZE_MISMATCH", "Received more bytes than declared.")
                if self.written + len(piece) > self._quota:
                    raise ImportError("SIZE_LIMIT", "Import exceeds the task quota.")
                if self.written + len(piece) > MAX_IMPORT_BYTES:
                    raise ImportError("SIZE_LIMIT", "Import exceeds the frozen maximum.")
                self._write(piece)
                self._digest.update(piece)
                self.written += len(piece)
                # The E2E-only channel observes the server-side slice size. In a
                # production Runtime this is a single attribute check.
                if self._import_id:
                    observations.record_writer_slice(self._import_id, len(piece))
                if self._on_progress is not None:
                    self._on_progress(self.written)
        finally:
            view.release()

    def finish(self) -> str:
        """EOF: the byte count must equal the declaration exactly."""
        if self.written != self._declared:
            raise ImportError("SIZE_MISMATCH", "Received fewer bytes than declared.")
        return self._digest.hexdigest()


def iter_slices(payload: bytes, size: int = WRITER_SLICE_BYTES) -> Iterable[memoryview]:
    """Expose the slicing rule for tests and for the runtime writer."""
    view = memoryview(payload)
    try:
        for offset in range(0, len(view), size):
            yield view[offset : offset + size]
    finally:
        view.release()


def fsync_file(path: Path) -> None:
    import os

    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def fsync_directory(path: Path) -> None:
    """Fsync a directory so an atomic replace inside it is durable."""
    import os

    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


class ImportSession:
    """One in-flight upload: its writer, its cancellation and its progress."""

    def __init__(
        self,
        *,
        import_id: str,
        declared_length: int,
        write: Callable[[memoryview], None],
        task_quota_bytes: int,
        on_progress: Callable[[int], None] | None = None,
    ) -> None:
        self.import_id = import_id
        self.cancelled = False
        self.writer = SliceWriter(
            write=write,
            declared_length=declared_length,
            task_quota_bytes=task_quota_bytes,
            is_cancelled=lambda: self.cancelled,
            on_progress=on_progress,
            import_id=import_id,
        )
        self.started_monotonic = __import__("time").monotonic()

    def cancel(self) -> None:
        self.cancelled = True

    def over_wall_clock(self) -> bool:
        elapsed = __import__("time").monotonic() - self.started_monotonic
        return elapsed > UPLOAD_WALL_CLOCK_SECONDS

    def feed(self, chunk: bytes) -> None:
        if self.over_wall_clock():
            self.cancel()
            raise ImportError("WRITE_FAILED", "Upload exceeded its wall-clock budget.")
        self.writer.feed(chunk)

    def finish(self) -> str:
        return self.writer.finish()
