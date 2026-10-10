from __future__ import annotations

import hashlib
import hmac
import os
import stat
from copy import deepcopy
from contextlib import contextmanager
from dataclasses import dataclass, field
from io import StringIO
from threading import RLock
from typing import Any, Callable
from uuid import uuid4

from navia_runtime.contracts import utc_now
from navia_runtime.modules.memory.guards import MAX_EVIDENCE_REFS, PermissionFailure


MAX_FILE = 5 * 1024 * 1024
MAX_BATCH = 20 * 1024 * 1024


class _ImportTicket:
    def __reduce__(self):
        raise TypeError("Local import tickets cannot be serialized")


def opaque(prefix: str) -> str:
    return prefix + uuid4().hex


def identity(fd: int) -> tuple[int, int]:
    info = os.fstat(fd)
    return info.st_dev, info.st_ino


def open_absolute(value: str, directory: bool) -> tuple[int, tuple[tuple[int, int], ...]]:
    if os.name != "posix" or not hasattr(os, "O_NOFOLLOW"):
        raise PermissionFailure("unsupported_platform", 422)
    if not isinstance(value, str) or not value.startswith("/") or "\0" in value or ".." in value.split("/"):
        raise PermissionFailure("path_not_allowed")
    parts = [part for part in value.split("/") if part not in {"", "."}]
    fd = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    chain = [identity(fd)]
    try:
        for index, part in enumerate(parts):
            flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
            if index < len(parts) - 1 or directory:
                flags |= os.O_DIRECTORY
            next_fd = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = next_fd
            chain.append(identity(fd))
        info = os.fstat(fd)
        if not (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)):
            raise PermissionFailure("path_not_allowed")
        return fd, tuple(chain)
    except BaseException:
        os.close(fd)
        raise


@dataclass
class Root:
    public: dict[str, Any]
    path: str
    fd: int
    chain: tuple[tuple[int, int], ...]
    epoch: int = 0
    lock: Any = field(default_factory=RLock)
    scans: dict[str, dict[str, Any]] = field(default_factory=dict)
    imports: dict[str, tuple[tuple[Any, ...], dict[str, Any]]] = field(default_factory=dict)


class PermissionService:
    def __init__(self, adapter: Any, session_acceptor: Callable[[str | None, str | None], bool] | None = None) -> None:
        self.adapter = adapter
        self._session_acceptor = session_acceptor
        self.roots: dict[str, Root] = {}
        self.lock = RLock()
        self._ticket_lock = RLock()
        self._tickets: dict[_ImportTicket, tuple[Any, ...]] = {}
        adapter.bind_local_import_consumer(self._consume_import_ticket)

    def _issue_import_ticket(self, root: Root, epoch: int, candidates: list[dict[str, Any]], keys: list[str]) -> _ImportTicket:
        with root.lock:
            self._active(root, epoch)
            ticket = _ImportTicket()
            record = (root, epoch, root.public["workspaceId"], deepcopy(candidates), list(keys))
            with self._ticket_lock:
                self._tickets[ticket] = record
            return ticket

    def _discard_import_ticket(self, ticket: _ImportTicket) -> None:
        with self._ticket_lock:
            self._tickets.pop(ticket, None)

    @contextmanager
    def _consume_import_ticket(self, ticket: Any):
        if type(ticket) is not _ImportTicket:
            raise PermissionFailure("path_not_allowed")
        with self._ticket_lock:
            record = self._tickets.pop(ticket, None)
        if record is None:
            raise PermissionFailure("path_not_allowed")
        root, epoch, workspace, candidates, keys = record
        # Never hold the ticket registry lock while waiting for a root or adapter.
        with root.lock:
            self._active(root, epoch)
            if not candidates or len(candidates) != len(keys):
                raise PermissionFailure("path_not_allowed")
            for candidate, key in zip(candidates, keys):
                if candidate.get("workspaceId") != workspace:
                    raise PermissionFailure("workspace_mismatch")
                if (candidate.get("permissionRootId") != root.public["permissionRootId"]
                        or candidate.get("sourceType") != "authorized_local_document"
                        or not key.startswith(f"local-import:{root.public['permissionRootId']}:")):
                    raise PermissionFailure("path_not_allowed")
            yield candidates, keys

    def enabled(self) -> bool:
        token = os.environ.get("NAVIA_LOCAL_FILES_TOKEN", "")
        extension_id = os.environ.get("NAVIA_LOCAL_FILES_EXTENSION_ID", "")
        return len(token) >= 32 and len(extension_id) == 32 and all(c in "abcdefghijklmnop" for c in extension_id)

    def authenticate(self, authorization: str | None, origin: str | None) -> None:
        if self._session_acceptor is not None and self._session_acceptor(authorization, origin):
            return
        expected = os.environ.get("NAVIA_LOCAL_FILES_TOKEN", "")
        extension = os.environ.get("NAVIA_LOCAL_FILES_EXTENSION_ID", "")
        if not self.enabled() or (origin is not None and origin != f"chrome-extension://{extension}"):
            raise PermissionFailure("missing_permission")
        supplied = (authorization or "").removeprefix("Bearer ")
        master_matches = (authorization or "").startswith("Bearer ") and hmac.compare_digest(supplied.encode(), expected.encode())
        if master_matches:
            return
        raise PermissionFailure("missing_permission")

    def close(self) -> None:
        with self.lock:
            for root in self.roots.values():
                with root.lock:
                    if root.fd >= 0:
                        os.close(root.fd)
                        root.fd = -1
                    root.epoch += 1
                    root.public["state"] = "revoked"
        with self._ticket_lock:
            self._tickets.clear()

    def _root(self, root_id: str, workspace: str | None = None) -> Root:
        with self.lock:
            root = self.roots.get(root_id)
        if root is None:
            raise PermissionFailure("missing_permission")
        if workspace is not None and root.public["workspaceId"] != workspace:
            raise PermissionFailure("workspace_mismatch")
        return root

    @staticmethod
    def _active(root: Root, epoch: int | None = None) -> None:
        if root.public["state"] != "granted" or (epoch is not None and epoch != root.epoch):
            raise PermissionFailure("revoked_permission")

    def grant(self, body: dict[str, Any]) -> dict[str, Any]:
        required = {"workspaceId", "displayName", "path", "scope"}
        if set(body) != required or any(not isinstance(body[k], str) or not body[k].strip() for k in required):
            raise PermissionFailure("invalid_request", 400)
        if body["scope"] not in {"single_file", "directory"} or len(body["displayName"]) > 120 or len(body["path"]) > 4096:
            raise PermissionFailure("invalid_request", 400)
        if not any(item["workspaceId"] == body["workspaceId"] for item in self.adapter.list_workspaces()["workspaces"]):
            raise PermissionFailure("workspace_mismatch")
        try:
            fd, chain = open_absolute(body["path"], body["scope"] == "directory")
        except (OSError, ValueError):
            raise PermissionFailure("path_not_allowed") from None
        public = {
            "permissionRootId": opaque("perm_"), "workspaceId": body["workspaceId"],
            "displayName": body["displayName"], "redactedPath": "[authorized local path]",
            "scope": body["scope"], "state": "granted", "createdAt": utc_now(),
        }
        with self.lock:
            self.roots[public["permissionRootId"]] = Root(public, body["path"], fd, chain)
        return {"permissionRoot": deepcopy(public), "operation": self._operation("grant_permission")}

    @staticmethod
    def _operation(kind: str) -> dict[str, Any]:
        now = utc_now()
        return {"operationId": opaque("op_"), "operationType": kind, "status": "succeeded", "createdAt": now, "updatedAt": now}

    def list(self, workspace: str) -> dict[str, Any]:
        with self.lock:
            roots = list(self.roots.values())
        records = []
        for root in roots:
            with root.lock:
                if root.public["workspaceId"] == workspace:
                    records.append(deepcopy(root.public))
        return {"workspaceId": workspace, "permissions": records}

    def revoke(self, root_id: str) -> dict[str, Any]:
        root = self._root(root_id)
        with root.lock:
            if root.public["state"] != "revoked":
                root.public.update(state="revoked", revokedAt=utc_now())
                root.epoch += 1
                root.scans.clear()
                if root.fd >= 0:
                    os.close(root.fd)
                    root.fd = -1
            return {"permissionRoot": deepcopy(root.public), "operation": self._operation("revoke_permission")}

    def _verify_path(self, root: Root) -> int:
        with root.lock:
            self._active(root)
            try:
                fd, chain = open_absolute(root.path, root.public["scope"] == "directory")
            except (OSError, ValueError):
                raise PermissionFailure("path_not_allowed") from None
            os.close(fd)
            if chain != root.chain:
                raise PermissionFailure("path_not_allowed")
            return root.epoch

    def _open(self, root: Root, relative: str, epoch: int, directory: bool = False) -> int:
        with root.lock:
            self._active(root, epoch)
            if root.public["scope"] == "single_file":
                fd, chain = open_absolute(root.path, False)
                if chain != root.chain:
                    os.close(fd)
                    raise PermissionFailure("path_not_allowed")
                return fd
            fd = os.dup(root.fd)
            try:
                if root.public["scope"] == "directory":
                    parts = relative.split("/") if relative else []
                    for index, part in enumerate(parts):
                        if part in {"", ".", ".."} or "\0" in part:
                            raise PermissionFailure("path_not_allowed")
                        flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
                        if index < len(parts) - 1 or directory:
                            flags |= os.O_DIRECTORY
                        next_fd = os.open(part, flags, dir_fd=fd)
                        os.close(fd)
                        fd = next_fd
                return fd
            except BaseException:
                os.close(fd)
                raise

    def _read(self, root: Root, relative: str, epoch: int) -> tuple[bytes, tuple[int, int]]:
        if os.path.splitext(relative)[1].lower() not in {".md", ".txt"}:
            raise PermissionFailure("unsupported_file", 422)
        fd = self._open(root, relative, epoch)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode):
                raise PermissionFailure("path_not_allowed")
            if info.st_size > MAX_FILE:
                raise PermissionFailure("limit_exceeded", 413)
            chunks, size = [], 0
            while True:
                with root.lock:
                    self._active(root, epoch)
                    chunk = os.read(fd, 65536)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_FILE:
                    raise PermissionFailure("limit_exceeded", 413)
                chunks.append(chunk)
            data = b"".join(chunks)
            after = os.fstat(fd)
            if (info.st_size, info.st_mtime_ns, info.st_ctime_ns) != (after.st_size, after.st_mtime_ns, after.st_ctime_ns):
                raise PermissionFailure("file_changed", 409)
            try:
                data.decode("utf-8")
            except UnicodeDecodeError:
                raise PermissionFailure("unsupported_file", 422) from None
            return data, (info.st_dev, info.st_ino)
        finally:
            os.close(fd)

    def scan(self, root_id: str, workspace: str) -> dict[str, Any]:
        root = self._root(root_id, workspace)
        epoch = self._verify_path(root)
        pending = [("", 0)] if root.public["scope"] == "directory" else []
        files = [os.path.basename(root.path)] if not pending else []
        directories = 0
        try:
            while pending:
                relative, depth = pending.pop()
                directories += 1
                if directories > 256 or depth > 16:
                    raise PermissionFailure("limit_exceeded", 413)
                fd = self._open(root, relative, epoch, directory=True)
                try:
                    with root.lock:
                        self._active(root, epoch)
                        names = sorted(os.listdir(fd))
                    for name in names:
                        with root.lock:
                            self._active(root, epoch)
                            info = os.stat(name, dir_fd=fd, follow_symlinks=False)
                        child = f"{relative}/{name}" if relative else name
                        if stat.S_ISDIR(info.st_mode):
                            pending.append((child, depth + 1))
                        elif stat.S_ISREG(info.st_mode):
                            files.append(child)
                        else:
                            raise PermissionFailure("path_not_allowed")
                        if len(files) > 256 or len(pending) + directories > 256:
                            raise PermissionFailure("limit_exceeded", 413)
                finally:
                    os.close(fd)
            file_map = {}
            for relative in sorted(files):
                data, inode = self._read(root, relative, epoch)
                file_id = opaque("file_")
                file_map[file_id] = {"relative": relative, "inode": inode, "fileId": file_id,
                                     "displayName": os.path.basename(relative), "sizeBytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        except OSError:
            raise PermissionFailure("path_not_allowed") from None
        scan_id = opaque("scan_")
        with root.lock:
            self._active(root, epoch)
            root.scans[scan_id] = file_map
        return {"scanId": scan_id, "permissionRootId": root_id, "workspaceId": workspace,
                "files": [{k: v for k, v in record.items() if k not in {"relative", "inode"}} for record in file_map.values()]}

    def import_files(self, root_id: str, body: dict[str, Any], key: str) -> dict[str, Any]:
        if set(body) != {"workspaceId", "scanId", "fileIds"} or not isinstance(body["workspaceId"], str) or not isinstance(body["scanId"], str):
            raise PermissionFailure("invalid_request", 400)
        ids = body["fileIds"]
        if not isinstance(ids, list) or not ids or len(ids) > 256 or not all(isinstance(i, str) for i in ids) or len(set(ids)) != len(ids) or not 8 <= len(key) <= 160:
            raise PermissionFailure("invalid_request", 400)
        root = self._root(root_id, body["workspaceId"])
        epoch = self._verify_path(root)
        fingerprint = (body["workspaceId"], body["scanId"], tuple(sorted(ids)))
        with root.lock:
            self._active(root, epoch)
            prior = root.imports.get(key)
            if prior:
                if prior[0] != fingerprint:
                    raise PermissionFailure("idempotency_conflict", 409)
                return self._replay(prior[1])
            records = root.scans.get(body["scanId"], {})
            if any(file_id not in records for file_id in ids):
                raise PermissionFailure("path_not_allowed")
        candidates, keys, total = [], [], 0
        try:
            for file_id in sorted(ids):
                record = records[file_id]
                data, inode = self._read(root, record["relative"], epoch)
                total += len(data)
                if total > MAX_BATCH:
                    raise PermissionFailure("limit_exceeded", 413)
                if inode != record["inode"] or hashlib.sha256(data).hexdigest() != record["sha256"]:
                    raise PermissionFailure("file_changed", 409)
                content = data.decode("utf-8")
                refs = []
                for index, raw_line in enumerate(StringIO(content, newline=None), 1):
                    line = raw_line.rstrip("\r\n")
                    if not line.strip():
                        continue
                    refs.append({"evidenceRefId": opaque("ev_"), "sourceId": "src_pending", "locatorType": "markdown_line",
                                 "lineStart": index, "lineEnd": index, "textQuote": line, "status": "fallback_shown", "redactionApplied": True})
                    if len(refs) == MAX_EVIDENCE_REFS:
                        break
                if not refs:
                    raise PermissionFailure("unsupported_file", 422)
                candidates.append({"candidateId": opaque("cand_"), "workspaceId": body["workspaceId"],
                                   "sourceType": "authorized_local_document", "title": record["displayName"], "createdAt": utc_now(),
                                   "sourceRefs": refs, "contentSnapshot": {"encoding": "utf8", "text": content, "sha256": record["sha256"], "byteLength": len(data)},
                                   "permissionRootId": root_id})
                keys.append(f"local-import:{root_id}:{hashlib.sha256(key.encode()).hexdigest()}:{file_id}")
        except OSError:
            raise PermissionFailure("path_not_allowed") from None
        with root.lock:
            self._active(root, epoch)
            prior = root.imports.get(key)
            if prior:
                if prior[0] != fingerprint:
                    raise PermissionFailure("idempotency_conflict", 409)
                return self._replay(prior[1])
            ticket = self._issue_import_ticket(root, epoch, candidates, keys)
            try:
                result = self.adapter.commit_authorized_batch(ticket)
            finally:
                self._discard_import_ticket(ticket)
            root.imports[key] = (fingerprint, {"sourceIds": [source["sourceId"] for source in result["sources"]], "operations": deepcopy(result["operations"])})
            return result

    def _replay(self, result: dict[str, Any]) -> dict[str, Any]:
        sources = [self.adapter.get_source(source_id) for source_id in result["sourceIds"]]
        if any(source is None or source["status"] == "forgotten" for source in sources):
            raise PermissionFailure("idempotency_conflict", 409)
        return {"sources": sources, "operations": deepcopy(result["operations"]), "idempotentReplay": True}
