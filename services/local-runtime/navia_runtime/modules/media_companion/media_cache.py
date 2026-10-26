from __future__ import annotations

import hashlib
import os
import re
import secrets
import sqlite3
import stat
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import RLock


CACHE_FILE_RE = re.compile(r"^media_[a-f0-9]{32}\.mp4$")
SOURCE_IDENTITY_RE = re.compile(r"^portal:[a-z][a-z0-9_-]{1,31}:[^:]+:[^:]+:[^:]+$")
MIN_QUOTA_BYTES = 512 * 1024**2
MAX_QUOTA_BYTES = 20 * 1024**3
DEFAULT_QUOTA_BYTES = 5 * 1024**3
DEFAULT_RETENTION_HOURS = 24


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class MediaCacheError(RuntimeError):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


class MediaDownloadCache:
    """Private bounded cache for one downloaded portal media file per source identity."""

    def __init__(self, root: str | Path, db_path: str | Path) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self._chmod(self.root, 0o700)
        self._lock = RLock()
        self._conn = sqlite3.connect(Path(db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS media_download_cache (
                    source_identity TEXT PRIMARY KEY,
                    filename TEXT NOT NULL UNIQUE,
                    byte_length INTEGER NOT NULL,
                    content_sha256 TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    accessed_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS media_download_cache_settings (
                    singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
                    maximum_bytes INTEGER NOT NULL,
                    retention_hours INTEGER NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                "INSERT OR IGNORE INTO media_download_cache_settings VALUES (1, ?, ?, ?)",
                (DEFAULT_QUOTA_BYTES, DEFAULT_RETENTION_HOURS, utc_now()),
            )
        self._recover()
        self.prune()

    @staticmethod
    def _chmod(path: Path, mode: int) -> None:
        try:
            path.chmod(mode)
        except OSError:
            pass

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    @staticmethod
    def _assert_source(source_identity: str) -> None:
        if not isinstance(source_identity, str) or not SOURCE_IDENTITY_RE.fullmatch(source_identity):
            raise MediaCacheError("V3_MEDIA_CACHE_SOURCE_INVALID", "缓存来源身份无效。")

    @staticmethod
    def _assert_private_file(path: Path) -> None:
        metadata = path.lstat()
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1 or metadata.st_mode & 0o077:
            raise MediaCacheError("V3_MEDIA_CACHE_FILE_INVALID", "缓存文件不是私有普通文件。", 409)

    def settings(self) -> dict[str, int]:
        with self._lock:
            row = self._conn.execute("SELECT * FROM media_download_cache_settings WHERE singleton = 1").fetchone()
        return {"maximumBytes": int(row["maximum_bytes"]), "retentionHours": int(row["retention_hours"])}

    def configure(self, maximum_bytes: int, retention_hours: int) -> dict[str, object]:
        if (
            type(maximum_bytes) is not int
            or maximum_bytes < MIN_QUOTA_BYTES
            or maximum_bytes > MAX_QUOTA_BYTES
            or type(retention_hours) is not int
            or retention_hours not in {1, 6, 24, 72, 168}
        ):
            raise MediaCacheError("V3_MEDIA_CACHE_SETTINGS_INVALID", "缓存上限或自动清理周期无效。")
        with self._lock, self._conn:
            self._conn.execute(
                "UPDATE media_download_cache_settings SET maximum_bytes = ?, retention_hours = ?, updated_at = ? WHERE singleton = 1",
                (maximum_bytes, retention_hours, utc_now()),
            )
        self.prune()
        return self.status()

    def status(self) -> dict[str, object]:
        self._remove_missing_rows()
        with self._lock:
            totals = self._conn.execute(
                "SELECT COUNT(*) count, COALESCE(SUM(byte_length), 0) bytes FROM media_download_cache"
            ).fetchone()
            oldest = self._conn.execute(
                "SELECT MIN(created_at) oldest, MIN(expires_at) next_expiry FROM media_download_cache"
            ).fetchone()
        settings = self.settings()
        return {
            "entryCount": int(totals["count"]), "usedBytes": int(totals["bytes"]),
            **settings, "oldestCreatedAt": oldest["oldest"], "nextExpiryAt": oldest["next_expiry"],
        }

    def get_or_create(self, source_identity: str, producer: Callable[[Path], None]) -> Path:
        self._assert_source(source_identity)
        self.prune()
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM media_download_cache WHERE source_identity = ?", (source_identity,)
            ).fetchone()
        if row is not None:
            path = self.root / row["filename"]
            try:
                self._assert_private_file(path)
                if path.stat().st_size == row["byte_length"] and self._sha256(path) == row["content_sha256"]:
                    with self._lock, self._conn:
                        self._conn.execute(
                            "UPDATE media_download_cache SET accessed_at = ? WHERE source_identity = ?",
                            (utc_now(), source_identity),
                        )
                    return path
            except (OSError, MediaCacheError):
                pass
            self.remove(source_identity)

        staging = self.root / f".stage_{secrets.token_hex(16)}.mp4"
        descriptor = os.open(staging, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(descriptor)
        try:
            producer(staging)
            self._chmod(staging, 0o600)
            self._assert_private_file(staging)
            size = staging.stat().st_size
            if size <= 0 or size > self.settings()["maximumBytes"]:
                raise MediaCacheError("V3_MEDIA_CACHE_QUOTA_EXCEEDED", "下载文件为空或超过缓存上限。", 409)
            digest = self._sha256(staging)
            filename = f"media_{secrets.token_hex(16)}.mp4"
            destination = self.root / filename
            staging.replace(destination)
            self._assert_private_file(destination)
            now = datetime.now(UTC)
            expires = now + timedelta(hours=self.settings()["retentionHours"])
            with self._lock, self._conn:
                self._conn.execute(
                    """
                    INSERT INTO media_download_cache (
                        source_identity, filename, byte_length, content_sha256, created_at, accessed_at, expires_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        source_identity, filename, size, digest,
                        now.isoformat().replace("+00:00", "Z"), now.isoformat().replace("+00:00", "Z"),
                        expires.isoformat().replace("+00:00", "Z"),
                    ),
                )
            self.prune(exclude=source_identity)
            return destination
        except Exception:
            staging.unlink(missing_ok=True)
            raise

    def remove(self, source_identity: str) -> int:
        self._assert_source(source_identity)
        with self._lock:
            row = self._conn.execute(
                "SELECT filename, byte_length FROM media_download_cache WHERE source_identity = ?", (source_identity,)
            ).fetchone()
        if row is None:
            return 0
        path = self.root / row["filename"]
        if CACHE_FILE_RE.fullmatch(path.name) and path.parent == self.root and path.exists():
            self._assert_private_file(path)
            path.unlink()
        with self._lock, self._conn:
            self._conn.execute("DELETE FROM media_download_cache WHERE source_identity = ?", (source_identity,))
        return int(row["byte_length"])

    def clear(self) -> dict[str, int]:
        with self._lock:
            rows = self._conn.execute("SELECT source_identity FROM media_download_cache").fetchall()
        removed_bytes = sum(self.remove(row["source_identity"]) for row in rows)
        return {"removedEntries": len(rows), "removedBytes": removed_bytes}

    def prune(self, *, exclude: str | None = None) -> dict[str, int]:
        now = utc_now()
        with self._lock:
            expired = self._conn.execute(
                "SELECT source_identity FROM media_download_cache WHERE expires_at <= ? ORDER BY accessed_at", (now,)
            ).fetchall()
        removed_entries = 0
        removed_bytes = 0
        for row in expired:
            if row["source_identity"] == exclude:
                continue
            removed_bytes += self.remove(row["source_identity"])
            removed_entries += 1
        maximum = self.settings()["maximumBytes"]
        while int(self.status_without_reconcile()["usedBytes"]) > maximum:
            with self._lock:
                row = self._conn.execute(
                    "SELECT source_identity FROM media_download_cache WHERE source_identity IS NOT ? ORDER BY accessed_at LIMIT 1",
                    (exclude,),
                ).fetchone()
            if row is None:
                break
            removed_bytes += self.remove(row["source_identity"])
            removed_entries += 1
        return {"removedEntries": removed_entries, "removedBytes": removed_bytes}

    def status_without_reconcile(self) -> dict[str, int]:
        with self._lock:
            row = self._conn.execute(
                "SELECT COUNT(*) count, COALESCE(SUM(byte_length), 0) bytes FROM media_download_cache"
            ).fetchone()
        return {"entryCount": int(row["count"]), "usedBytes": int(row["bytes"])}

    def _remove_missing_rows(self) -> None:
        with self._lock:
            rows = self._conn.execute("SELECT source_identity, filename FROM media_download_cache").fetchall()
        for row in rows:
            path = self.root / row["filename"]
            if not path.is_file() or path.is_symlink():
                with self._lock, self._conn:
                    self._conn.execute(
                        "DELETE FROM media_download_cache WHERE source_identity = ?", (row["source_identity"],)
                    )

    def _recover(self) -> None:
        known: set[str]
        with self._lock:
            known = {row["filename"] for row in self._conn.execute("SELECT filename FROM media_download_cache")}
        for path in self.root.iterdir():
            if path.name in known:
                continue
            if path.is_file() and (
                path.name.startswith(".stage_")
                or path.name.startswith(".cookie_")
                or CACHE_FILE_RE.fullmatch(path.name)
            ):
                path.unlink(missing_ok=True)
