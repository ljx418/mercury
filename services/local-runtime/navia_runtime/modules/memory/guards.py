from __future__ import annotations

import hashlib
from typing import Any

from navia_runtime.contracts import ErrorCode


MAX_EVIDENCE_REFS = 12
MAX_WEB_SNAPSHOT_BYTES = 128 * 1024


class PermissionFailure(Exception):
    def __init__(self, reason: str, status: int = 403) -> None:
        self.reason = reason
        self.status = status
        self.code = {
            400: ErrorCode.REQUEST_INVALID,
            403: ErrorCode.TOOL_PERMISSION_DENIED,
            409: ErrorCode.INVALID_TRANSITION,
            413: ErrorCode.CONTEXT_TOO_LARGE,
            422: ErrorCode.SCHEMA_VALIDATION_FAILED,
        }[status]
        super().__init__(reason)


def validate_forget_input(body: Any) -> None:
    if not isinstance(body, dict) or set(body) != {"confirmationText"} or body["confirmationText"] != "forget":
        raise PermissionFailure("invalid_request", 400)


def reject_local_candidate(candidate: dict[str, Any], key: str) -> None:
    if (candidate.get("sourceType") in {"authorized_local_document", "pdf"}
            or str(candidate.get("url", "")).lower().startswith("file:")
            or "permissionRootId" in candidate
            or key.startswith("local-import:")
            or str(candidate.get("idempotencyKey", "")).startswith("local-import:")):
        raise PermissionFailure("path_not_allowed")
    snapshot = candidate.get("contentSnapshot")
    if snapshot is None:
        return
    if candidate.get("sourceType") != "web_page":
        raise PermissionFailure("path_not_allowed")
    if not isinstance(snapshot, dict) or set(snapshot) != {"encoding", "text", "byteLength", "sha256"}:
        raise PermissionFailure("invalid_request", 400)
    text = snapshot.get("text")
    if snapshot.get("encoding") != "utf8" or not isinstance(text, str) or not text.strip():
        raise PermissionFailure("invalid_request", 400)
    raw = text.encode("utf-8")
    if len(raw) > MAX_WEB_SNAPSHOT_BYTES or snapshot.get("byteLength") != len(raw):
        raise PermissionFailure("invalid_request", 400)
    digest = snapshot.get("sha256")
    if not isinstance(digest, str) or digest != hashlib.sha256(raw).hexdigest():
        raise PermissionFailure("invalid_request", 400)
