"""WP-B runtime adapter for the local-import API.

This module owns the pieces that must exist in the Runtime process but do not
belong to the pure contracts:

* an in-process awaiting-upload token registry (digests only);
* the streaming writer, which slices ASGI transport chunks with a `memoryview`
  and never holds a second large buffer;
* the exact rejection ORDER, so a request that fails any gate is refused
  BEFORE a writer is constructed.
"""

from __future__ import annotations

import os
import shutil
import threading
from pathlib import Path
from typing import Any, AsyncIterator, Callable

from .contracts import (
    MAX_IMPORT_BYTES,
    ImportError,
    public_status,
    required_free_bytes,
    validate_create_body,
)
from .manager import ImportSession, TokenRegistry
from .store import LocalMediaImportStore

WRITER_SLICE_BYTES = 1_048_576


class LocalImportManager:
    """In-process owner of tokens, writers, cancellation and cleanup."""

    def __init__(self, store: LocalMediaImportStore, media_root: str | Path | None = None) -> None:
        self.store = store
        # The shared input root; set by the Runtime so the writer never invents
        # a location of its own.
        self._media_root = str(media_root) if media_root else ""
        self.tokens = TokenRegistry()
        self._sessions: dict[str, ImportSession] = {}
        self._cancelled: set[str] = set()
        # Bytes actually written per finished upload, carried into the durable record.
        self._finished_bytes: dict[str, int] = {}
        # C3: the production eligibility query, owned by the acquisition
        # coordinator. It is injected at Runtime startup, never faked.
        self._eligibility_resolver: Callable[[str, str], Any] | None = None
        # WP-B: the frozen public `media` projection is assembled from the
        # DURABLE barrier record, never from an in-memory preparation result.
        self._prepared_resolver: Callable[[str], Any] | None = None
        self._lock = threading.RLock()
        self._writers_built = 0

    # -- helpers used by the API layer ---------------------------------------

    def _free_bytes(self) -> int:
        """Free bytes on the volume that will hold the import.

        The probe resolves to the nearest EXISTING ancestor: `disk_usage`
        refuses a path that has not been created yet, and falling back to a
        synthetic value would wrongly refuse a healthy disk.
        """
        probe = Path(getattr(self, "_media_root", "") or self.store.database_path.parent)
        while not probe.exists() and probe != probe.parent:
            probe = probe.parent
        try:
            return shutil.disk_usage(str(probe)).free
        except OSError:
            return required_free_bytes(0)

    def _build_writer(self, import_id: str, declared_length: int) -> Callable[[memoryview], None]:
        """Construct the on-disk writer. Called ONLY after every gate passed."""
        self._writers_built += 1
        sandbox = self._sandbox_for(import_id)
        sandbox.mkdir(parents=True, exist_ok=True)
        target = sandbox / "source.bin"
        handle = target.open("wb")
        os.chmod(target, 0o600)

        def write(piece: memoryview) -> None:
            handle.write(piece)

        self._handles[import_id] = (handle, target)
        return write

    @property
    def _handles(self) -> dict[str, Any]:
        if not hasattr(self, "_handle_map"):
            self._handle_map: dict[str, Any] = {}
        return self._handle_map

    def _sandbox_for(self, import_id: str) -> Path:
        root = getattr(self, "_media_root", "") or str(self.store.database_path.parent / "local-imports")
        return Path(root) / import_id

    # -- create ---------------------------------------------------------------

    def create(self, body: Any, *, dependency_generation: str) -> dict[str, Any]:
        # C3: the eligibility gate runs BEFORE any allocation. No import
        # record, token, quota reservation, sandbox or writer may exist until
        # the production coordinator has PROVED the task/source is an eligible
        # blocked acquisition.
        payload = validate_create_body(body)
        self._require_eligible(payload["taskId"], payload["sourceIdentity"])
        # B16: the space gate runs BEFORE a writer can exist, so an import is
        # never started when the disk cannot hold it.
        required = required_free_bytes(payload["byteLength"])
        free = self._free_bytes()
        if free < required:
            raise ImportError(
                "DISK_SPACE_LOW",
                "Not enough free space to accept this media.",
                details={"maximumBytes": required},
            )
        record = self.store.create_import(
            task_id=payload["taskId"],
            source_identity=payload["sourceIdentity"],
            byte_length=payload["byteLength"],
            declared_media_type=payload["declaredMediaType"],
            dependency_generation=dependency_generation,
            import_id=_new_import_id(),
        )
        token = self.tokens.issue(record["importId"])
        return {"import": public_status(record), "uploadToken": token}

    # -- status ---------------------------------------------------------------

    def status(self, import_id: str) -> dict[str, Any]:
        record = self.store.get(import_id)
        prepared = None
        if self._prepared_resolver is not None:
            try:
                prepared = self._prepared_resolver(import_id)
            except Exception:  # noqa: BLE001 - the projection is best-effort
                prepared = None
        return public_status(record, prepared)

    # -- streaming ------------------------------------------------------------

    def begin_stream(
        self,
        import_id: str,
        *,
        token: str,
        content_type: str,
        declared_content_length: int | None,
        quota_bytes: int = MAX_IMPORT_BYTES,
        holder: dict[str, Any] | None = None,
        on_progress: Callable[[int], None] | None = None,
    ) -> ImportSession:
        """Run every gate, THEN build the writer. Returns the live session."""
        record = self.store.get(import_id)
        if record["state"] != "awaiting_upload":
            raise ImportError("TOKEN_INVALID", "This import is no longer awaiting an upload.")
        # The token is VERIFIED first, so a wrong token is refused before any
        # other gate is reported, and it is CONSUMED only when the write really
        # starts. A request that is refused for another reason therefore leaves
        # the token usable, exactly like a request that carried a wrong token.
        self.tokens.verify(token, import_id)
        if content_type != record["declaredMediaType"]:
            raise ImportError("TYPE_UNSUPPORTED", "Content type does not match the declared type.")
        if declared_content_length is None:
            raise ImportError("REQUEST_INVALID", "Content-Length is required.")
        if declared_content_length != record["byteLength"]:
            raise ImportError("SIZE_MISMATCH", "Content-Length does not equal the declared length.")
        self.tokens.consume(token, import_id)
        write = self._build_writer(import_id, record["byteLength"])
        session = ImportSession(
            import_id=import_id,
            declared_length=record["byteLength"],
            write=write,
            task_quota_bytes=min(quota_bytes, MAX_IMPORT_BYTES),
            on_progress=on_progress,
        )
        with self._lock:
            self._sessions[import_id] = session
        self.store.transition(import_id, expected_sequence=record["sequence"], state="uploading")
        if holder is not None:
            holder["session"] = session
        return session

    def complete(self, import_id: str, digest: str) -> dict[str, Any]:
        """EOF verified: the video is durable and the import moves to verifying."""
        record = self.store.get(import_id)
        written = self._finished_bytes.pop(import_id, record["uploadedBytes"])
        updated = self.store.transition(
            import_id,
            expected_sequence=record["sequence"],
            state="verifying",
            uploaded_bytes=written,
            video_manifest_sha256=digest,
        )
        return public_status(updated)

    async def stream(
        self,
        import_id: str,
        *,
        token: str,
        content_type: str,
        declared_content_length: int | None,
        chunks: AsyncIterator[bytes],
        quota_bytes: int,
        on_progress: Callable[[int], None] | None = None,
    ) -> str:
        """Consume the token, then stream the body through a sliced writer.

        Every gate (token, content type, declared length) runs BEFORE the
        writer exists, so a rejected request never touches the disk.
        """
        session = self.begin_stream(
            import_id,
            token=token,
            content_type=content_type,
            declared_content_length=declared_content_length,
            quota_bytes=quota_bytes,
            on_progress=on_progress,
        )
        async for chunk in chunks:
            session.feed(chunk)
        return session.finish()

    def feed(self, import_id: str, chunk: bytes) -> None:
        session = self._sessions.get(import_id)
        if session is None:
            raise ImportError("WRITE_FAILED", "No active upload for this import.")
        if import_id in self._cancelled:
            session.cancel()
        session.feed(chunk)

    def finish(self, import_id: str) -> str:
        session = self._sessions.get(import_id)
        if session is None:
            raise ImportError("WRITE_FAILED", "No active upload for this import.")
        digest = session.finish()
        # The byte count is recorded so the durable state (and the UI) can
        # report the REAL amount received, never a zero placeholder.
        self._finished_bytes[import_id] = session.writer.written
        with self._lock:
            self._sessions.pop(import_id, None)
        self._close_handle(import_id)
        return digest

    # -- cancel / cleanup -----------------------------------------------------

    def cancel(self, import_id: str) -> dict[str, Any]:
        record = self.store.get(import_id)
        if record["state"] in {"ready", "cancelled", "failed"}:
            return public_status(record)
        with self._lock:
            self._cancelled.add(import_id)
            session = self._sessions.get(import_id)
        if session is not None:
            session.cancel()
        self._close_handle(import_id)
        self.tokens.forget(import_id)
        with self._lock:
            self._sessions.pop(import_id, None)
        updated = self.store.transition(
            import_id, expected_sequence=record["sequence"], state="cancelling"
        )
        self._purge_sandbox(import_id)
        return public_status(
            self.store.transition(
                import_id,
                expected_sequence=updated["sequence"],
                state="cancelled",
                failure_code="V3_MEDIA_IMPORT_CANCELLED",
            )
        )

    def reconcile_after_restart(self, skip: set[str] | None = None) -> list[str]:
        """Startup recovery for imports that hold no barrier at all.

        An interrupted upload never resumes: no token, no writer, no worker.
        The record becomes a persisted terminal failure so GET keeps answering
        with the truth instead of 404.
        """
        return self.store.reconcile_after_restart(skip)

    def abort(self, import_id: str, code: str = "WRITE_FAILED") -> None:
        record = self.store.find(import_id)
        if record is None or record["state"] in {"ready", "cancelled", "failed"}:
            return
        with self._lock:
            session = self._sessions.pop(import_id, None)
            self._cancelled.add(import_id)
        if session is not None:
            session.cancel()
        self._close_handle(import_id)
        self.tokens.forget(import_id)
        self._purge_sandbox(import_id)
        current = self.store.get(import_id)
        try:
            self.store.transition(
                import_id,
                expected_sequence=current["sequence"],
                state="failed",
                failure_code=f"V3_MEDIA_IMPORT_{code}",
            )
        except ImportError:
            pass

    def _close_handle(self, import_id: str) -> None:
        entry = self._handles.pop(import_id, None)
        if entry is None:
            return
        handle, target = entry
        try:
            handle.flush()
            os.fsync(handle.fileno())
        except OSError:
            pass
        finally:
            handle.close()

    def _purge_sandbox(self, import_id: str) -> None:
        shutil.rmtree(self._sandbox_for(import_id), ignore_errors=True)

    # -- restart --------------------------------------------------------------

    def _require_eligible(self, task_id: str, source_identity: str) -> None:
        resolver = self._eligibility_resolver
        if resolver is None:
            raise ImportError(
                "TASK_NOT_ELIGIBLE",
                "The media acquisition eligibility query is not available.",
            )
        try:
            resolver(task_id, source_identity)
        except ImportError:
            raise
        except Exception as error:
            # The coordinator raises its own acquisition failure; it is mapped
            # onto the frozen import code so no new code is introduced.
            code = getattr(error, "code", "")
            if code == "V3_MEDIA_CAPTURE_NOT_ELIGIBLE":
                raise ImportError(
                    "TASK_NOT_ELIGIBLE", "The media acquisition is not eligible for a local import."
                ) from None
            if code == "V3_MEDIA_TASK_INVALID":
                raise ImportError(
                    "TASK_NOT_ELIGIBLE", "The media acquisition task was not found."
                ) from None
            raise ImportError(
                "TASK_NOT_ELIGIBLE", "The media acquisition is not eligible for a local import."
            ) from None

    def has_session(self, import_id: str) -> bool:
        """True when a live upload session (and therefore a writer) exists."""
        with self._lock:
            return import_id in self._sessions

    def release_all(self) -> None:
        """Drop every live session and close every handle (test teardown)."""
        with self._lock:
            sessions = list(self._sessions)
            self._sessions.clear()
        for import_id in sessions:
            self._close_handle(import_id)

    def recover_after_restart(self) -> list[str]:
        """Fail every interrupted import and purge what is provably ours."""
        interrupted = self.store.reconcile_after_restart()
        for import_id in interrupted:
            self.tokens.forget(import_id)
        return interrupted


def _new_import_id() -> str:
    import secrets

    return "media_import_" + secrets.token_hex(16)


#: The name the Runtime module binds; the class keeps a private constructor.
_LocalImportManagerAdapter = LocalImportManager
