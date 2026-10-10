from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import RLock, Timer
from typing import Any, Callable


CHANNEL_TTL_SECONDS = 20
LEASE_TTL_SECONDS = 60
MAX_ENVELOPE_BODY_BYTES = 32_768

_EXTENSION_ID = re.compile(r"^[a-p]{32}$")
_CHANNEL_ID = re.compile(r"^pch_[a-f0-9]{32}$")
_LEASE_ID = re.compile(r"^pcl_[a-f0-9]{32}$")
_ENVELOPE_ID = re.compile(r"^pce_[a-f0-9]{32}$")
_TASK_ID = re.compile(r"^media_task_[a-f0-9]{32}$")
_ADAPTER_ID = re.compile(r"^[a-z][a-z0-9_-]{1,31}$")
_POLICY_ID = re.compile(r"^[a-z0-9_-]+-media-consent/v[1-9][0-9]*$")
_SHA256 = re.compile(r"^[a-f0-9]{64}$")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def isoformat(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class MediaCredentialFailure(RuntimeError):
    def __init__(self, code: str, status: int) -> None:
        super().__init__(code)
        self.code = code
        self.status = status


class MediaCredentialAuthenticator:
    """Authenticates only the narrow browser-to-runtime credential endpoints."""

    def __init__(self, session_acceptor: Callable[[str | None, str | None], bool] | None = None) -> None:
        self._session_acceptor = session_acceptor

    def configured_extension_origin(self) -> str | None:
        extension_id = os.environ.get("NAVIA_LOCAL_FILES_EXTENSION_ID", "")
        if not _EXTENSION_ID.fullmatch(extension_id):
            return None
        return f"chrome-extension://{extension_id}"

    def is_exact_origin(self, origin: str | None) -> bool:
        expected = self.configured_extension_origin()
        return expected is not None and origin == expected

    def authenticate_bootstrap(self, authorization: str | None, origin: str | None) -> None:
        expected = os.environ.get("NAVIA_LOCAL_FILES_TOKEN", "")
        prefix = "Bearer "
        if not authorization or not authorization.startswith(prefix):
            raise MediaCredentialFailure("V3_MEDIA_RUNTIME_AUTH_REQUIRED", 401)
        if origin is not None and not self.is_exact_origin(origin):
            raise MediaCredentialFailure("V3_MEDIA_RUNTIME_ORIGIN_MISMATCH", 403)
        supplied = authorization.removeprefix(prefix)
        master_matches = len(expected.encode("utf-8")) >= 32 and hmac.compare_digest(
            supplied.encode("utf-8"), expected.encode("utf-8")
        )
        if master_matches and self.is_exact_origin(origin):
            return
        if self._session_acceptor is not None and self._session_acceptor(authorization, origin):
            return
        raise MediaCredentialFailure("V3_MEDIA_RUNTIME_AUTH_REQUIRED", 401)


@dataclass
class _ChannelEntry:
    token: str
    public: dict[str, Any]


@dataclass(frozen=True)
class CredentialTransportPolicy:
    adapter_id: str
    policy_id: str
    policy_revision: int
    credential_name_set_sha256: str


@dataclass(frozen=True)
class CredentialEnvelopePolicy:
    adapter_id: str
    session_adapter_id: str
    policy_id: str
    policy_revision: int
    envelope_schema_version: str
    credential_name_set_sha256: str
    allowed_credential_names: frozenset[str]
    required_credential_names: frozenset[str]
    domain_allowed: Callable[[str], bool]


@dataclass
class _LeaseEntry:
    public: dict[str, Any]
    credentials: list[dict[str, Any]]
    revocation_token: str
    cancel_expiry: Callable[[], None]


def schedule_expiry(delay_seconds: float, callback: Callable[[], None]) -> Callable[[], None]:
    timer = Timer(delay_seconds, callback)
    timer.daemon = True
    timer.start()
    return timer.cancel


class CredentialChannelStore:
    """Process-memory-only, one-shot channel capability store."""

    def __init__(
        self,
        now: Callable[[], datetime] = utc_now,
        policies: tuple[CredentialTransportPolicy, ...] = (),
    ) -> None:
        self._now = now
        self._policies = {policy.adapter_id: policy for policy in policies}
        self._entries: dict[str, _ChannelEntry] = {}
        self._records: dict[str, dict[str, Any]] = {}
        self._terminal_token_failures: dict[str, str] = {}
        self._lock = RLock()

    @staticmethod
    def _token_digest(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def validate_metadata(body: Any) -> dict[str, Any]:
        required = {
            "taskId", "adapterId", "policyId", "policyRevision",
            "browserSessionBindingSha256", "credentialNameSetSha256",
        }
        if not isinstance(body, dict) or set(body) != required:
            raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 400)
        if not isinstance(body["taskId"], str) or not _TASK_ID.fullmatch(body["taskId"]):
            raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 400)
        if not isinstance(body["adapterId"], str) or not _ADAPTER_ID.fullmatch(body["adapterId"]):
            raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 400)
        if not isinstance(body["policyId"], str) or not _POLICY_ID.fullmatch(body["policyId"]):
            raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 400)
        if type(body["policyRevision"]) is not int or body["policyRevision"] < 1:
            raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 400)
        for key in ("browserSessionBindingSha256", "credentialNameSetSha256"):
            if not isinstance(body[key], str) or not _SHA256.fullmatch(body[key]):
                raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 400)
        return dict(body)

    def issue(self, metadata: Any, extension_origin: str) -> tuple[str, dict[str, Any]]:
        body = self.validate_metadata(metadata)
        if self._policies:
            policy = self._policies.get(body["adapterId"])
            if policy is None:
                raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 400)
            if body["policyId"] != policy.policy_id:
                raise MediaCredentialFailure("V3_MEDIA_POLICY_NOT_GRANTED", 403)
            if body["policyRevision"] != policy.policy_revision:
                raise MediaCredentialFailure("V3_MEDIA_POLICY_REVISION_MISMATCH", 409)
            if body["credentialNameSetSha256"] != policy.credential_name_set_sha256:
                raise MediaCredentialFailure("V3_MEDIA_CREDENTIAL_SET_INVALID", 400)
        now = self._now()
        expires = now + timedelta(seconds=CHANNEL_TTL_SECONDS)
        token = secrets.token_urlsafe(32)
        channel_id = f"pch_{secrets.token_hex(16)}"
        public = {
            "schemaVersion": "portal-credential-channel-record/v1",
            "channelId": channel_id,
            **body,
            "extensionOriginSha256": hashlib.sha256(extension_origin.encode("utf-8")).hexdigest(),
            "transport": "authenticated_loopback_one_shot",
            "oneShot": True,
            "channelTokenPersisted": False,
            "issuedAt": isoformat(now),
            "expiresAt": isoformat(expires),
            "status": "issued",
            "failureCode": None,
        }
        with self._lock:
            self._entries[token] = _ChannelEntry(token=token, public=public)
            self._records[channel_id] = public
        return token, deepcopy(public)

    def consume(self, token: str) -> dict[str, Any]:
        with self._lock:
            token_digest = self._token_digest(token)
            entry = self._entries.pop(token, None)
            if entry is None:
                terminal_failure = self._terminal_token_failures.get(token_digest)
                if terminal_failure == "V3_MEDIA_CHANNEL_REPLAYED":
                    raise MediaCredentialFailure(terminal_failure, 409)
                if terminal_failure == "V3_MEDIA_CHANNEL_EXPIRED":
                    raise MediaCredentialFailure(terminal_failure, 410)
                raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 401)
            expires_at = datetime.fromisoformat(entry.public["expiresAt"].replace("Z", "+00:00"))
            if self._now() > expires_at:
                entry.public.update(status="expired", failureCode="V3_MEDIA_CHANNEL_EXPIRED")
                self._terminal_token_failures[token_digest] = "V3_MEDIA_CHANNEL_EXPIRED"
                raise MediaCredentialFailure("V3_MEDIA_CHANNEL_EXPIRED", 410)
            if entry.public["status"] != "issued":
                raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 401)
            entry.public.update(status="consumed", failureCode=None)
            self._terminal_token_failures[token_digest] = "V3_MEDIA_CHANNEL_REPLAYED"
            return deepcopy(entry.public)

    def public_record(self, channel_id: str) -> dict[str, Any] | None:
        if not _CHANNEL_ID.fullmatch(channel_id):
            return None
        with self._lock:
            record = self._records.get(channel_id)
            return deepcopy(record) if record is not None else None

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
            self._records.clear()
            self._terminal_token_failures.clear()

    def size(self) -> int:
        with self._lock:
            now = self._now()
            for token, entry in list(self._entries.items()):
                expires_at = datetime.fromisoformat(entry.public["expiresAt"].replace("Z", "+00:00"))
                if now > expires_at:
                    entry.public.update(status="expired", failureCode="V3_MEDIA_CHANNEL_EXPIRED")
                    self._terminal_token_failures[self._token_digest(token)] = "V3_MEDIA_CHANNEL_EXPIRED"
                    del self._entries[token]
            return len(self._entries)


class CredentialLeaseStore:
    """Short-lived credential material that can never be serialized by this API."""

    def __init__(
        self,
        policies: tuple[CredentialEnvelopePolicy, ...],
        now: Callable[[], datetime] = utc_now,
        schedule: Callable[[float, Callable[[], None]], Callable[[], None]] = schedule_expiry,
    ) -> None:
        self._policies = {policy.adapter_id: policy for policy in policies}
        self._now = now
        self._schedule = schedule
        self._leases: dict[str, _LeaseEntry] = {}
        self._seen_envelope_ids: set[str] = set()
        self._lock = RLock()

    @staticmethod
    def _parse_datetime(value: Any) -> datetime:
        if not isinstance(value, str):
            raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_INVALID", 400)
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_INVALID", 400) from None
        if parsed.tzinfo is None:
            raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_INVALID", 400)
        return parsed.astimezone(timezone.utc)

    def issue(self, channel: dict[str, Any], envelope: Any) -> tuple[str, dict[str, Any]]:
        envelope_keys = {
            "schemaVersion", "envelopeId", "channelId", "taskId", "adapterId", "sessionAdapterId",
            "policyId", "policyRevision", "browserSessionBindingSha256", "credentialNameSetSha256",
            "issuedAt", "expiresAt", "credentials",
        }
        if not isinstance(envelope, dict) or set(envelope) != envelope_keys:
            raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_INVALID", 400)
        envelope_id = envelope.get("envelopeId")
        if not isinstance(envelope_id, str) or not _ENVELOPE_ID.fullmatch(envelope_id):
            raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_INVALID", 400)
        with self._lock:
            if envelope_id in self._seen_envelope_ids:
                raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_REPLAYED", 409)
            self._seen_envelope_ids.add(envelope_id)

        adapter_id = envelope.get("adapterId")
        policy = self._policies.get(adapter_id) if isinstance(adapter_id, str) else None
        if policy is None or envelope.get("schemaVersion") != policy.envelope_schema_version:
            raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_INVALID", 400)
        if envelope.get("sessionAdapterId") != policy.session_adapter_id:
            raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_INVALID", 400)
        if envelope.get("channelId") != channel["channelId"]:
            raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 400)
        if envelope.get("taskId") != channel["taskId"]:
            raise MediaCredentialFailure("V3_MEDIA_LEASE_TASK_MISMATCH", 409)
        if adapter_id != channel["adapterId"]:
            raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_INVALID", 400)
        if envelope.get("policyId") != channel["policyId"] or envelope.get("policyId") != policy.policy_id:
            raise MediaCredentialFailure("V3_MEDIA_POLICY_NOT_GRANTED", 403)
        if (
            type(envelope.get("policyRevision")) is not int
            or envelope["policyRevision"] != channel["policyRevision"]
            or envelope["policyRevision"] != policy.policy_revision
        ):
            raise MediaCredentialFailure("V3_MEDIA_POLICY_REVISION_MISMATCH", 409)
        if envelope.get("browserSessionBindingSha256") != channel["browserSessionBindingSha256"]:
            raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 400)
        if (
            envelope.get("credentialNameSetSha256") != channel["credentialNameSetSha256"]
            or envelope.get("credentialNameSetSha256") != policy.credential_name_set_sha256
        ):
            raise MediaCredentialFailure("V3_MEDIA_CREDENTIAL_SET_INVALID", 400)

        channel_issued = self._parse_datetime(channel["issuedAt"])
        channel_expires = self._parse_datetime(channel["expiresAt"])
        envelope_issued = self._parse_datetime(envelope.get("issuedAt"))
        envelope_expires = self._parse_datetime(envelope.get("expiresAt"))
        now = self._now().astimezone(timezone.utc)
        if envelope_issued < channel_issued or envelope_issued > channel_expires:
            raise MediaCredentialFailure("V3_MEDIA_CHANNEL_EXPIRED", 410)
        if envelope_expires <= envelope_issued or envelope_expires > channel_expires or now > envelope_expires:
            raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_EXPIRED", 410)

        raw_credentials = envelope.get("credentials")
        if not isinstance(raw_credentials, list) or not 1 <= len(raw_credentials) <= len(policy.allowed_credential_names):
            raise MediaCredentialFailure("V3_MEDIA_CREDENTIAL_SET_INVALID", 400)
        credential_keys = {"name", "value", "domain", "path", "secure", "httpOnly", "sameSite", "expirationDate"}
        credentials: list[dict[str, Any]] = []
        names: set[str] = set()
        for raw in raw_credentials:
            if not isinstance(raw, dict) or set(raw) != credential_keys:
                raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_INVALID", 400)
            name = raw.get("name")
            value = raw.get("value")
            domain = raw.get("domain")
            path = raw.get("path")
            expiration = raw.get("expirationDate")
            if (
                not isinstance(name, str)
                or name not in policy.allowed_credential_names
                or name in names
                or not isinstance(value, str)
                or not value
                or not isinstance(domain, str)
                or not policy.domain_allowed(domain)
                or not isinstance(path, str)
                or not path.startswith("/")
                or type(raw.get("secure")) is not bool
                or type(raw.get("httpOnly")) is not bool
                or raw.get("sameSite") not in {"no_restriction", "lax", "strict", "unspecified"}
                or not (expiration is None or (isinstance(expiration, (int, float)) and not isinstance(expiration, bool)))
            ):
                raise MediaCredentialFailure("V3_MEDIA_CREDENTIAL_SET_INVALID", 400)
            names.add(name)
            credentials.append(dict(raw))
        if not policy.required_credential_names.issubset(names):
            raise MediaCredentialFailure("V3_MEDIA_CREDENTIAL_SET_INVALID", 400)

        issued_at = now
        expires_at = issued_at + timedelta(seconds=LEASE_TTL_SECONDS)
        lease_id = f"pcl_{secrets.token_hex(16)}"
        revocation_token = secrets.token_urlsafe(32)
        public = {
            "schemaVersion": "portal-credential-lease/v1",
            "leaseId": lease_id,
            "envelopeId": envelope_id,
            "taskId": channel["taskId"],
            "adapterId": policy.adapter_id,
            "policyId": policy.policy_id,
            "policyRevision": policy.policy_revision,
            "browserSessionBindingSha256": channel["browserSessionBindingSha256"],
            "credentialNameSetSha256": policy.credential_name_set_sha256,
            "credentialCount": len(credentials),
            "transportMode": "one_shot_envelope",
            "secretStorage": "runtime_process_memory_only",
            "serverValidationStatus": "not_performed",
            "issuedAt": isoformat(issued_at),
            "expiresAt": isoformat(expires_at),
            "state": "active",
            "failureCode": None,
        }
        with self._lock:
            entry = _LeaseEntry(
                public=public,
                credentials=credentials,
                revocation_token=revocation_token,
                cancel_expiry=lambda: None,
            )
            self._leases[lease_id] = entry
            entry.cancel_expiry = self._schedule(
                LEASE_TTL_SECONDS,
                lambda: self._expire_lease(lease_id),
            )
        return revocation_token, deepcopy(public)

    def _expire_entry(self, entry: _LeaseEntry) -> None:
        entry.cancel_expiry()
        entry.credentials.clear()
        entry.revocation_token = ""
        entry.public.update(state="expired", failureCode="V3_MEDIA_LEASE_EXPIRED")

    def _expire_lease(self, lease_id: str) -> None:
        with self._lock:
            entry = self._leases.get(lease_id)
            if entry is not None and entry.public["state"] == "active":
                self._expire_entry(entry)

    def resolve_credentials(self, lease_id: str, task_id: str) -> list[dict[str, Any]]:
        if not _LEASE_ID.fullmatch(lease_id):
            raise MediaCredentialFailure("V3_MEDIA_LEASE_EXPIRED", 410)
        with self._lock:
            entry = self._leases.get(lease_id)
            if entry is None:
                raise MediaCredentialFailure("V3_MEDIA_LEASE_EXPIRED", 410)
            expires_at = self._parse_datetime(entry.public["expiresAt"])
            if self._now().astimezone(timezone.utc) > expires_at:
                self._expire_entry(entry)
                raise MediaCredentialFailure("V3_MEDIA_LEASE_EXPIRED", 410)
            if entry.public["taskId"] != task_id:
                raise MediaCredentialFailure("V3_MEDIA_LEASE_TASK_MISMATCH", 403)
            if entry.public["state"] != "active":
                raise MediaCredentialFailure("V3_MEDIA_LEASE_EXPIRED", 410)
            return deepcopy(entry.credentials)

    def resolve_for_task(self, task_id: str, adapter_id: str) -> list[dict[str, Any]]:
        """Private task-bound lookup; public task records never need a lease capability."""
        if not _TASK_ID.fullmatch(task_id) or not _ADAPTER_ID.fullmatch(adapter_id):
            raise MediaCredentialFailure("V3_MEDIA_LEASE_REQUIRED", 403)
        with self._lock:
            now = self._now().astimezone(timezone.utc)
            matches: list[_LeaseEntry] = []
            for entry in self._leases.values():
                if entry.public["state"] == "active" and now > self._parse_datetime(entry.public["expiresAt"]):
                    self._expire_entry(entry)
                if (
                    entry.public["state"] == "active"
                    and entry.public["taskId"] == task_id
                    and entry.public["adapterId"] == adapter_id
                ):
                    matches.append(entry)
            if len(matches) != 1:
                raise MediaCredentialFailure("V3_MEDIA_LEASE_REQUIRED", 403)
            return deepcopy(matches[0].credentials)

    def revoke(self, lease_id: str, revocation_token: str) -> dict[str, Any]:
        if not _LEASE_ID.fullmatch(lease_id):
            raise MediaCredentialFailure("V3_MEDIA_LEASE_EXPIRED", 410)
        with self._lock:
            entry = self._leases.get(lease_id)
            if entry is None:
                raise MediaCredentialFailure("V3_MEDIA_LEASE_EXPIRED", 410)
            if (
                entry.public["state"] != "active"
                or self._now().astimezone(timezone.utc) > self._parse_datetime(entry.public["expiresAt"])
            ):
                self._expire_entry(entry)
                raise MediaCredentialFailure("V3_MEDIA_LEASE_EXPIRED", 410)
            if not hmac.compare_digest(entry.revocation_token.encode("utf-8"), revocation_token.encode("utf-8")):
                raise MediaCredentialFailure("V3_MEDIA_LEASE_REVOKED", 403)
            entry.cancel_expiry()
            entry.credentials.clear()
            entry.revocation_token = ""
            entry.public.update(state="revoked", failureCode="V3_MEDIA_LEASE_REVOKED")
            return deepcopy(entry.public)

    def clear(self) -> None:
        with self._lock:
            for entry in self._leases.values():
                entry.cancel_expiry()
                entry.credentials.clear()
                entry.revocation_token = ""
            self._leases.clear()
            self._seen_envelope_ids.clear()

    def size(self) -> int:
        with self._lock:
            now = self._now().astimezone(timezone.utc)
            for entry in self._leases.values():
                if entry.public["state"] == "active" and now > self._parse_datetime(entry.public["expiresAt"]):
                    self._expire_entry(entry)
            return sum(1 for entry in self._leases.values() if entry.public["state"] == "active")
