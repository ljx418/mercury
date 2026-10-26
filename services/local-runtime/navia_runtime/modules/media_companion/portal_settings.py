from __future__ import annotations

import json
import re
import sqlite3
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from typing import Any

import httpx

from .bilibili_policy import BILIBILI_CREDENTIAL_ENVELOPE_POLICY
from .credential_transport import MediaCredentialFailure
from .vision.provider_settings import SecretStore, SecretStoreError


PORTAL_SECRET_REF = "media-portal-session:bilibili"
MAX_COOKIE_INPUT_BYTES = 128 * 1024
COOKIE_NAME = re.compile(r"^[A-Za-z0-9_]{1,64}$")


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class MediaPortalSettingsError(RuntimeError):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


def parse_bilibili_cookies(value: str) -> tuple[dict[str, object], ...]:
    """Parse Chrome JSON, Netscape cookies.txt, or a Cookie header without retaining unknown cookies."""
    if not isinstance(value, str) or not value.strip() or len(value.encode("utf-8")) > MAX_COOKIE_INPUT_BYTES:
        raise MediaPortalSettingsError("V3_MEDIA_COOKIE_INPUT_INVALID", "Cookie 内容为空或超过 128 KiB。")
    stripped = value.strip()
    candidates: list[dict[str, object]] = []
    if stripped.startswith("["):
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise MediaPortalSettingsError("V3_MEDIA_COOKIE_INPUT_INVALID", "Cookie JSON 无法解析。") from exc
        if not isinstance(parsed, list) or len(parsed) > 64:
            raise MediaPortalSettingsError("V3_MEDIA_COOKIE_INPUT_INVALID", "Cookie JSON 必须是最多 64 项的数组。")
        for item in parsed:
            if not isinstance(item, dict):
                raise MediaPortalSettingsError("V3_MEDIA_COOKIE_INPUT_INVALID", "Cookie JSON 项格式无效。")
            candidates.append({
                "name": item.get("name"),
                "value": item.get("value"),
                "domain": item.get("domain") or ".bilibili.com",
                "secure": bool(item.get("secure", True)),
                "expirationDate": item.get("expirationDate") or item.get("expiration_date"),
            })
    elif "\t" in stripped or stripped.startswith("# Netscape HTTP Cookie File"):
        for line in stripped.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            fields = line.split("\t")
            if len(fields) != 7:
                raise MediaPortalSettingsError("V3_MEDIA_COOKIE_INPUT_INVALID", "Netscape Cookie 行格式无效。")
            domain, _include_subdomains, _path, secure, expires, name, secret = fields
            candidates.append({
                "name": name,
                "value": secret,
                "domain": domain,
                "secure": secure.upper() == "TRUE",
                "expirationDate": int(expires) if expires.isdigit() else None,
            })
    else:
        normalized = stripped.replace("\r", "").replace("\n", ";")
        for pair in normalized.split(";"):
            pair = pair.strip()
            if not pair:
                continue
            name, separator, secret = pair.partition("=")
            if not separator:
                raise MediaPortalSettingsError("V3_MEDIA_COOKIE_INPUT_INVALID", "Cookie Header 项缺少等号。")
            candidates.append({
                "name": name.strip(), "value": secret.strip(), "domain": ".bilibili.com", "secure": True,
            })

    allowed = BILIBILI_CREDENTIAL_ENVELOPE_POLICY.allowed_credential_names
    selected: dict[str, dict[str, object]] = {}
    for item in candidates:
        name, secret, domain = item.get("name"), item.get("value"), item.get("domain")
        if not isinstance(name, str) or name not in allowed:
            continue
        if (
            not COOKIE_NAME.fullmatch(name)
            or not isinstance(secret, str)
            or not secret
            or len(secret) > 4096
            or any(ord(char) < 0x21 or ord(char) == 0x7F or char in ";\t\r\n" for char in secret)
            or not isinstance(domain, str)
            or not BILIBILI_CREDENTIAL_ENVELOPE_POLICY.domain_allowed(domain)
            or name in selected
        ):
            raise MediaPortalSettingsError("V3_MEDIA_COOKIE_INPUT_INVALID", "Cookie 包含重复项或不安全字段。")
        expiration = item.get("expirationDate")
        selected[name] = {
            "name": name,
            "value": secret,
            "domain": domain,
            "secure": bool(item.get("secure", True)),
            **(
                {"expirationDate": float(expiration)}
                if isinstance(expiration, (int, float)) and not isinstance(expiration, bool)
                else {}
            ),
        }
    if not BILIBILI_CREDENTIAL_ENVELOPE_POLICY.required_credential_names.issubset(selected):
        raise MediaPortalSettingsError("V3_MEDIA_COOKIE_REQUIRED_MISSING", "Cookie 中缺少 SESSDATA。")
    return tuple(selected[name] for name in sorted(selected))


class MediaPortalSettingsStore:
    def __init__(
        self,
        db_path: str | Path,
        secret_store: SecretStore,
        *,
        verifier: Callable[[Sequence[dict[str, object]]], dict[str, object]] | None = None,
    ) -> None:
        self.secret_store = secret_store
        self._verifier = verifier or self._verify_bilibili
        self._lock = RLock()
        self._conn = sqlite3.connect(Path(db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS media_portal_settings (
                    adapter_id TEXT PRIMARY KEY,
                    enabled INTEGER NOT NULL,
                    secret_ref TEXT NOT NULL,
                    secret_storage TEXT NOT NULL,
                    cookie_count INTEGER NOT NULL,
                    expires_at TEXT,
                    test_status_json TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )

    def status(self) -> dict[str, object]:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM media_portal_settings WHERE adapter_id = 'bilibili'"
            ).fetchone()
        if row is None:
            return {
                "adapterId": "bilibili", "enabled": False, "configured": False,
                "cookieCount": 0, "expiresAt": None, "testStatus": None,
                "secretStorage": None, "updatedAt": None,
            }
        return {
            "adapterId": row["adapter_id"], "enabled": bool(row["enabled"]), "configured": True,
            "cookieCount": row["cookie_count"], "expiresAt": row["expires_at"],
            "testStatus": json.loads(row["test_status_json"]) if row["test_status_json"] else None,
            "secretStorage": row["secret_storage"], "updatedAt": row["updated_at"],
        }

    def save(self, cookie_text: str, *, enabled: bool = True) -> dict[str, object]:
        cookies = parse_bilibili_cookies(cookie_text)
        result = self._verifier(cookies)
        now = utc_now()
        expires = [float(item["expirationDate"]) for item in cookies if isinstance(item.get("expirationDate"), (int, float))]
        expires_at = datetime.fromtimestamp(min(expires), UTC).isoformat().replace("+00:00", "Z") if expires else None
        payload = json.dumps(cookies, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        try:
            self.secret_store.set(PORTAL_SECRET_REF, payload)
        except SecretStoreError as exc:
            raise MediaPortalSettingsError(exc.code, str(exc), exc.status) from exc
        test_status = {"status": "ok", "verifiedAt": now, **result}
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT INTO media_portal_settings (
                    adapter_id, enabled, secret_ref, secret_storage, cookie_count, expires_at,
                    test_status_json, created_at, updated_at
                ) VALUES ('bilibili', ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(adapter_id) DO UPDATE SET
                    enabled=excluded.enabled, secret_ref=excluded.secret_ref,
                    secret_storage=excluded.secret_storage, cookie_count=excluded.cookie_count,
                    expires_at=excluded.expires_at, test_status_json=excluded.test_status_json,
                    updated_at=excluded.updated_at
                """,
                (
                    int(enabled), PORTAL_SECRET_REF, self.secret_store.storage_kind, len(cookies), expires_at,
                    json.dumps(test_status, ensure_ascii=False, sort_keys=True, separators=(",", ":")), now, now,
                ),
            )
        return self.status()

    def set_enabled(self, enabled: bool) -> dict[str, object]:
        with self._lock, self._conn:
            changed = self._conn.execute(
                "UPDATE media_portal_settings SET enabled = ?, updated_at = ? WHERE adapter_id = 'bilibili'",
                (int(enabled), utc_now()),
            ).rowcount
        if not changed:
            raise MediaPortalSettingsError("V3_MEDIA_COOKIE_NOT_CONFIGURED", "请先导入并验证 B站 Cookie。", 409)
        return self.status()

    def test(self) -> dict[str, object]:
        cookies = self.resolve_credentials(require_enabled=False)
        result = self._verifier(cookies)
        now = utc_now()
        test_status = {"status": "ok", "verifiedAt": now, **result}
        with self._lock, self._conn:
            self._conn.execute(
                "UPDATE media_portal_settings SET test_status_json = ?, updated_at = ? WHERE adapter_id = 'bilibili'",
                (json.dumps(test_status, ensure_ascii=False, sort_keys=True, separators=(",", ":")), now),
            )
        return self.status()

    def delete(self) -> dict[str, object]:
        try:
            self.secret_store.delete(PORTAL_SECRET_REF)
        except SecretStoreError as exc:
            raise MediaPortalSettingsError(exc.code, str(exc), exc.status) from exc
        with self._lock, self._conn:
            self._conn.execute("DELETE FROM media_portal_settings WHERE adapter_id = 'bilibili'")
        return self.status()

    def resolve_credentials(self, *, require_enabled: bool = True) -> list[dict[str, object]]:
        status = self.status()
        if not status["configured"] or (require_enabled and not status["enabled"]):
            raise MediaCredentialFailure("V3_MEDIA_PERSISTENT_SESSION_UNAVAILABLE", 409)
        try:
            secret = self.secret_store.get(PORTAL_SECRET_REF)
        except SecretStoreError as exc:
            raise MediaCredentialFailure(exc.code, exc.status) from exc
        if not secret:
            raise MediaCredentialFailure("V3_MEDIA_PERSISTENT_SESSION_UNAVAILABLE", 409)
        try:
            value = json.loads(secret)
        except json.JSONDecodeError as exc:
            raise MediaCredentialFailure("V3_MEDIA_PERSISTENT_SESSION_INVALID", 409) from exc
        if not isinstance(value, list):
            raise MediaCredentialFailure("V3_MEDIA_PERSISTENT_SESSION_INVALID", 409)
        return [dict(item) for item in value if isinstance(item, dict)]

    def resolve_for_task(self, task_id: str, adapter_id: str) -> list[dict[str, object]]:
        if adapter_id != "bilibili":
            raise MediaCredentialFailure("V3_MEDIA_PERSISTENT_SESSION_UNAVAILABLE", 409)
        return self.resolve_credentials()

    @staticmethod
    def _verify_bilibili(cookies: Sequence[dict[str, object]]) -> dict[str, object]:
        header = "; ".join(f"{item['name']}={item['value']}" for item in cookies)
        try:
            response = httpx.get(
                "https://api.bilibili.com/x/web-interface/nav",
                headers={"Cookie": header, "User-Agent": "Mozilla/5.0 Navia/3", "Referer": "https://www.bilibili.com/"},
                timeout=20,
                follow_redirects=False,
            )
            document = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise MediaPortalSettingsError("V3_MEDIA_COOKIE_VERIFY_FAILED", "无法验证 B站 Cookie。", 502) from exc
        data = document.get("data") if isinstance(document, dict) else None
        if response.status_code != 200 or document.get("code") != 0 or not isinstance(data, dict) or data.get("isLogin") is not True:
            raise MediaPortalSettingsError("V3_MEDIA_COOKIE_EXPIRED", "B站 Cookie 无效或已过期。", 403)
        return {"loggedIn": True}


class PreferredCredentialResolver:
    """Use the configured local portal session first, preserving task leases as fallback."""

    def __init__(self, persistent: MediaPortalSettingsStore, leases: Any) -> None:
        self.persistent = persistent
        self.leases = leases

    def resolve_for_task(self, task_id: str, adapter_id: str) -> list[dict[str, object]]:
        try:
            return self.persistent.resolve_for_task(task_id, adapter_id)
        except MediaCredentialFailure:
            return self.leases.resolve_for_task(task_id, adapter_id)

    def resolve_credentials(self, lease_id: str | None, task_id: str) -> list[dict[str, object]]:
        try:
            return self.persistent.resolve_credentials()
        except MediaCredentialFailure:
            if not lease_id:
                raise
            return self.leases.resolve_credentials(lease_id, task_id)
