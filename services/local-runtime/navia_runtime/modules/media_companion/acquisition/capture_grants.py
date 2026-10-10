from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Any, Callable


CAPTURE_GRANT_TTL_SECONDS = 30

_TASK_ID = re.compile(r"^media_task_[a-f0-9]{32}$")
_ADAPTER_ID = re.compile(r"^[a-z][a-z0-9_-]{1,31}$")
_SHA256 = re.compile(r"^[a-f0-9]{64}$")
_GRANT_ID = re.compile(r"^mcg_[a-f0-9]{32}$")
_SURFACES = frozenset({"side_panel", "workspace"})


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def isoformat(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class MediaCaptureFailure(RuntimeError):
    def __init__(self, code: str, status: int = 409) -> None:
        super().__init__(code)
        self.code = code
        self.status = status


@dataclass
class _GrantEntry:
    ticket_digest: str
    private_tab_id: int
    public: dict[str, Any]


class MediaCaptureGrantService:
    """Process-memory-only, one-shot capability bound to one browser capture."""

    def __init__(self, now: Callable[[], datetime] = utc_now) -> None:
        self._now = now
        self._entries: dict[str, _GrantEntry] = {}
        self._records: dict[str, dict[str, Any]] = {}
        self._terminal_ticket_failures: dict[str, str] = {}
        self._lock = RLock()

    @staticmethod
    def _ticket_digest(ticket: str) -> str:
        return hashlib.sha256(ticket.encode("utf-8")).hexdigest()

    @staticmethod
    def validate_binding(value: Any, *, include_tab_id: bool) -> dict[str, Any]:
        required = {
            "taskId", "adapterId", "pageIdentitySha256", "tabIdSha256", "surface"
        }
        if include_tab_id:
            required.add("tabId")
        if not isinstance(value, dict) or set(value) != required:
            raise MediaCaptureFailure("V3_MEDIA_CAPTURE_BINDING_INVALID", 400)
        if not isinstance(value["taskId"], str) or not _TASK_ID.fullmatch(value["taskId"]):
            raise MediaCaptureFailure("V3_MEDIA_CAPTURE_BINDING_INVALID", 400)
        if not isinstance(value["adapterId"], str) or not _ADAPTER_ID.fullmatch(value["adapterId"]):
            raise MediaCaptureFailure("V3_MEDIA_CAPTURE_BINDING_INVALID", 400)
        if value["surface"] not in _SURFACES:
            raise MediaCaptureFailure("V3_MEDIA_CAPTURE_BINDING_INVALID", 400)
        for key in ("pageIdentitySha256", "tabIdSha256"):
            if not isinstance(value[key], str) or not _SHA256.fullmatch(value[key]):
                raise MediaCaptureFailure("V3_MEDIA_CAPTURE_BINDING_INVALID", 400)
        if include_tab_id and (type(value["tabId"]) is not int or value["tabId"] < 0):
            raise MediaCaptureFailure("V3_MEDIA_CAPTURE_BINDING_INVALID", 400)
        return dict(value)

    def issue(self, value: Any) -> tuple[str, dict[str, Any]]:
        binding = self.validate_binding(value, include_tab_id=True)
        now = self._now().astimezone(timezone.utc)
        expires = now + timedelta(seconds=CAPTURE_GRANT_TTL_SECONDS)
        ticket = secrets.token_urlsafe(32)
        ticket_digest = self._ticket_digest(ticket)
        grant_id = f"mcg_{secrets.token_hex(16)}"
        public = {
            "grantId": grant_id,
            "taskId": binding["taskId"],
            "adapterId": binding["adapterId"],
            "pageIdentitySha256": binding["pageIdentitySha256"],
            "tabIdSha256": binding["tabIdSha256"],
            "surface": binding["surface"],
            "issuedAt": isoformat(now),
            "expiresAt": isoformat(expires),
            "oneShot": True,
            "persisted": False,
            "state": "issued",
        }
        entry = _GrantEntry(ticket_digest, binding["tabId"], public)
        with self._lock:
            self._entries[ticket_digest] = entry
            self._records[grant_id] = public
        return ticket, deepcopy(public)

    def consume(self, ticket: str, value: Any) -> dict[str, Any]:
        binding = self.validate_binding(value, include_tab_id=True)
        if not isinstance(ticket, str) or len(ticket.encode("utf-8")) < 43:
            raise MediaCaptureFailure("V3_MEDIA_CAPTURE_TICKET_INVALID", 401)
        digest = self._ticket_digest(ticket)
        with self._lock:
            entry = self._entries.pop(digest, None)
            if entry is None:
                code = self._terminal_ticket_failures.get(digest, "V3_MEDIA_CAPTURE_TICKET_INVALID")
                status = 410 if code == "V3_MEDIA_CAPTURE_TICKET_EXPIRED" else 409 if code == "V3_MEDIA_CAPTURE_TICKET_REPLAYED" else 401
                raise MediaCaptureFailure(code, status)
            expires = datetime.fromisoformat(entry.public["expiresAt"].replace("Z", "+00:00"))
            if self._now().astimezone(timezone.utc) > expires:
                entry.public["state"] = "expired"
                self._terminal_ticket_failures[digest] = "V3_MEDIA_CAPTURE_TICKET_EXPIRED"
                raise MediaCaptureFailure("V3_MEDIA_CAPTURE_TICKET_EXPIRED", 410)
            expected = {
                "taskId": entry.public["taskId"],
                "adapterId": entry.public["adapterId"],
                "pageIdentitySha256": entry.public["pageIdentitySha256"],
                "tabIdSha256": entry.public["tabIdSha256"],
                "surface": entry.public["surface"],
                "tabId": entry.private_tab_id,
            }
            if any(not hmac.compare_digest(str(binding[key]), str(expected[key])) for key in expected):
                entry.public["state"] = "failed"
                self._terminal_ticket_failures[digest] = "V3_MEDIA_CAPTURE_TICKET_REPLAYED"
                raise MediaCaptureFailure("V3_MEDIA_CAPTURE_BINDING_MISMATCH", 403)
            entry.public["state"] = "consumed"
            self._terminal_ticket_failures[digest] = "V3_MEDIA_CAPTURE_TICKET_REPLAYED"
            return deepcopy(entry.public)

    def revoke(self, grant_id: str) -> dict[str, Any]:
        if not _GRANT_ID.fullmatch(grant_id):
            raise MediaCaptureFailure("V3_MEDIA_CAPTURE_GRANT_INVALID", 404)
        with self._lock:
            public = self._records.get(grant_id)
            if public is None:
                raise MediaCaptureFailure("V3_MEDIA_CAPTURE_GRANT_INVALID", 404)
            public["state"] = "revoked"
            for digest, entry in list(self._entries.items()):
                if entry.public["grantId"] == grant_id:
                    self._entries.pop(digest)
                    self._terminal_ticket_failures[digest] = "V3_MEDIA_CAPTURE_TICKET_EXPIRED"
            return deepcopy(public)

    def public_record(self, grant_id: str) -> dict[str, Any] | None:
        if not _GRANT_ID.fullmatch(grant_id):
            return None
        with self._lock:
            value = self._records.get(grant_id)
            return deepcopy(value) if value else None

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
            self._records.clear()
            self._terminal_ticket_failures.clear()

