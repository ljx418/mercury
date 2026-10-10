from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Any, Callable


SESSION_TTL_SECONDS = 15 * 60
_EXTENSION_ID = re.compile(r"^[a-p]{32}$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class CompanionFailure(RuntimeError):
    def __init__(self, code: str, status: int) -> None:
        super().__init__(code)
        self.code = code
        self.status = status


@dataclass
class _Session:
    token_sha256: str
    public: dict[str, Any]
    revoked: bool = False


class CompanionSessionBroker:
    """Issues process-scoped loopback sessions without persisting bearer material."""

    def __init__(
        self,
        *,
        now: Callable[[], datetime] = _now,
        ttl_seconds: int = SESSION_TTL_SECONDS,
    ) -> None:
        self._now = now
        self._ttl_seconds = ttl_seconds
        self._runtime_instance_id = f"runtime_{secrets.token_hex(16)}"
        self._started_at = _iso(now())
        self._sessions: dict[str, _Session] = {}
        self._lock = RLock()
        self._stopping = False

    @property
    def runtime_instance_id(self) -> str:
        return self._runtime_instance_id

    def configured_origin(self) -> str | None:
        extension_id = os.environ.get("NAVIA_LOCAL_FILES_EXTENSION_ID", "")
        if not _EXTENSION_ID.fullmatch(extension_id):
            return None
        return f"chrome-extension://{extension_id}"

    def is_exact_origin(self, origin: str | None) -> bool:
        expected = self.configured_origin()
        return expected is not None and origin == expected

    def status(self) -> dict[str, Any]:
        return {
            "schemaVersion": "navia-companion-status/v1",
            "status": "stopping" if self._stopping else "online",
            "runtimeInstanceId": self._runtime_instance_id,
            "startedAt": self._started_at,
            "sessionBootstrapAvailable": self.configured_origin() is not None and not self._stopping,
        }

    def issue(self, origin: str | None) -> dict[str, Any]:
        if self.configured_origin() is None:
            raise CompanionFailure("V3_COMPANION_NOT_CONFIGURED", 503)
        if not self.is_exact_origin(origin):
            raise CompanionFailure("V3_COMPANION_ORIGIN_MISMATCH", 403)
        if self._stopping:
            raise CompanionFailure("V3_COMPANION_STOP_REJECTED", 409)
        now = self._now()
        token = secrets.token_urlsafe(32)
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        public = {
            "schemaVersion": "navia-companion-session/v1",
            "sessionId": f"comp_session_{secrets.token_hex(16)}",
            "runtimeInstanceId": self._runtime_instance_id,
            "extensionOriginSha256": hashlib.sha256(origin.encode("utf-8")).hexdigest(),
            "issuedAt": _iso(now),
            "expiresAt": _iso(now + timedelta(seconds=self._ttl_seconds)),
            "token": token,
            "persisted": False,
        }
        with self._lock:
            self._sessions[digest] = _Session(token_sha256=digest, public=public)
        return deepcopy(public)

    def authenticate(self, authorization: str | None, origin: str | None) -> dict[str, Any]:
        # Chromium may omit Origin on extension GET requests. Session issuance
        # remains exact-origin only; any Origin that is present must still match.
        if origin is not None and not self.is_exact_origin(origin):
            raise CompanionFailure("V3_COMPANION_ORIGIN_MISMATCH", 403)
        prefix = "Bearer "
        if not authorization or not authorization.startswith(prefix):
            raise CompanionFailure("V3_COMPANION_SESSION_REQUIRED", 401)
        supplied = authorization.removeprefix(prefix)
        digest = hashlib.sha256(supplied.encode("utf-8")).hexdigest()
        with self._lock:
            entry = self._sessions.get(digest)
            if entry is None:
                raise CompanionFailure("V3_COMPANION_SESSION_REQUIRED", 401)
            if entry.revoked:
                raise CompanionFailure("V3_COMPANION_SESSION_REVOKED", 401)
            expires = datetime.fromisoformat(entry.public["expiresAt"].replace("Z", "+00:00"))
            if self._now() >= expires:
                del self._sessions[digest]
                raise CompanionFailure("V3_COMPANION_SESSION_EXPIRED", 401)
            if not hmac.compare_digest(digest, entry.token_sha256):
                raise CompanionFailure("V3_COMPANION_SESSION_REQUIRED", 401)
            return deepcopy(entry.public)

    def accepts(self, authorization: str | None, origin: str | None) -> bool:
        try:
            self.authenticate(authorization, origin)
            return True
        except CompanionFailure:
            return False

    def revoke(self, authorization: str | None, origin: str | None) -> dict[str, Any]:
        record = self.authenticate(authorization, origin)
        token = (authorization or "").removeprefix("Bearer ")
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with self._lock:
            entry = self._sessions[digest]
            entry.revoked = True
        return {key: value for key, value in record.items() if key != "token"} | {"status": "revoked"}

    def begin_stop(self, authorization: str | None, origin: str | None) -> dict[str, Any]:
        self.authenticate(authorization, origin)
        self._stopping = True
        return {
            "schemaVersion": "navia-companion-stop/v1",
            "runtimeInstanceId": self._runtime_instance_id,
            "status": "stopping",
            "acceptedAt": _iso(self._now()),
        }

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()
            self._stopping = False
