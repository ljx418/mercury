from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from typing import Any, Callable

from .outline import MediaOutlineError, canonical_bytes, canonical_hash, validate_outline_bundle


TERMINAL_STATES = {"ready", "degraded", "blocked", "failed", "cancelled"}


def process_start_token(pid: int) -> str | None:
    try:
        stat_text = Path(f"/proc/{pid}/stat").read_text(encoding="ascii")
        return stat_text.rsplit(") ", 1)[1].split()[19]
    except (OSError, IndexError):
        return None
ALLOWED_TRANSITIONS = {
    "created": {"acquiring", "cancelled", "blocked", "failed"},
    "acquiring": {"transcribing", "extracting_frames", "cancelled", "blocked", "failed"},
    "transcribing": {"extracting_frames", "cancelled", "failed"},
    "extracting_frames": {"analyzing_vision", "synthesizing", "cancelled", "failed"},
    "analyzing_vision": {"synthesizing", "cancelled", "failed"},
    "synthesizing": {"ready", "degraded", "cancelled", "failed"},
}


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class MediaTaskStoreError(RuntimeError):
    def __init__(self, code: str, message: str, *, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


class MediaTaskStore:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._migrate()

    def _migrate(self) -> None:
        with self._lock, self._conn:
            self._conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS media_outline_schema_versions(
                    version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS media_tasks(
                    task_id TEXT PRIMARY KEY, source_identity TEXT NOT NULL, state TEXT NOT NULL,
                    revision INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                    knowledge_import_status TEXT NOT NULL, terminal_failure_code TEXT,
                    current_outline_id TEXT
                );
                CREATE TABLE IF NOT EXISTS media_evidence_refs(
                    task_id TEXT NOT NULL, evidence_id TEXT NOT NULL, task_revision INTEGER NOT NULL,
                    kind TEXT NOT NULL, start_ms INTEGER NOT NULL, end_ms INTEGER NOT NULL,
                    content_sha256 TEXT NOT NULL, relative_ref TEXT NOT NULL,
                    PRIMARY KEY(task_id, evidence_id, task_revision),
                    FOREIGN KEY(task_id) REFERENCES media_tasks(task_id)
                );
                CREATE TABLE IF NOT EXISTS media_outlines(
                    task_id TEXT NOT NULL, task_revision INTEGER NOT NULL, outline_id TEXT NOT NULL,
                    canonical_json TEXT NOT NULL, content_sha256 TEXT NOT NULL, published INTEGER NOT NULL,
                    PRIMARY KEY(task_id, task_revision), UNIQUE(outline_id),
                    FOREIGN KEY(task_id) REFERENCES media_tasks(task_id)
                );
                CREATE TABLE IF NOT EXISTS media_task_events(
                    task_id TEXT NOT NULL, sequence INTEGER NOT NULL, task_revision INTEGER NOT NULL,
                    event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL,
                    PRIMARY KEY(task_id, sequence), FOREIGN KEY(task_id) REFERENCES media_tasks(task_id)
                );
                CREATE TABLE IF NOT EXISTS media_task_outbox(
                    outbox_id TEXT PRIMARY KEY, task_id TEXT NOT NULL, task_revision INTEGER NOT NULL,
                    action TEXT NOT NULL, status TEXT NOT NULL, payload_sha256 TEXT NOT NULL,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                    FOREIGN KEY(task_id) REFERENCES media_tasks(task_id)
                );
                CREATE TABLE IF NOT EXISTS media_task_idempotency(
                    task_id TEXT NOT NULL, operation TEXT NOT NULL, idempotency_key TEXT NOT NULL,
                    request_sha256 TEXT NOT NULL, response_json TEXT NOT NULL,
                    PRIMARY KEY(task_id, operation, idempotency_key),
                    FOREIGN KEY(task_id) REFERENCES media_tasks(task_id)
                );
                CREATE TABLE IF NOT EXISTS media_source_authority(
                    source_identity TEXT PRIMARY KEY, task_id TEXT NOT NULL,
                    adapter_id TEXT NOT NULL, consent_policy_id TEXT NOT NULL,
                    consent_policy_revision INTEGER NOT NULL, state TEXT NOT NULL,
                    updated_at TEXT NOT NULL, owner_pid INTEGER, owner_start TEXT
                );
                CREATE TABLE IF NOT EXISTS media_source_policy_switches(
                    new_task_id TEXT PRIMARY KEY, source_identity TEXT NOT NULL,
                    old_task_id TEXT NOT NULL, old_policy_id TEXT NOT NULL,
                    old_policy_revision INTEGER NOT NULL, new_policy_id TEXT NOT NULL,
                    new_policy_revision INTEGER NOT NULL, confirmed_at TEXT NOT NULL,
                    confirmation TEXT NOT NULL,
                    FOREIGN KEY(new_task_id) REFERENCES media_tasks(task_id),
                    FOREIGN KEY(old_task_id) REFERENCES media_tasks(task_id)
                );
                """
            )
            authority_columns = {row["name"] for row in self._conn.execute("PRAGMA table_info(media_source_authority)")}
            if "owner_pid" not in authority_columns:
                self._conn.execute("ALTER TABLE media_source_authority ADD COLUMN owner_pid INTEGER")
            if "owner_start" not in authority_columns:
                self._conn.execute("ALTER TABLE media_source_authority ADD COLUMN owner_start TEXT")
            self._conn.execute(
                "INSERT OR IGNORE INTO media_outline_schema_versions(version, applied_at) VALUES (2, ?)",
                (utc_now(),),
            )

    def source_authority(self, source_identity: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM media_source_authority WHERE source_identity=?", (source_identity,)
            ).fetchone()
            return dict(row) if row is not None else None

    def source_authority_by_task(self, task_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM media_source_authority WHERE task_id=?", (task_id,)
            ).fetchone()
            return dict(row) if row is not None else None

    def policy_switch_receipt(self, new_task_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM media_source_policy_switches WHERE new_task_id=?", (new_task_id,)
            ).fetchone()
            return dict(row) if row is not None else None

    def require_current_authority(self, task_id: str) -> None:
        with self._lock:
            task = self._require_row(task_id)
            authority = self._conn.execute(
                "SELECT task_id FROM media_source_authority WHERE source_identity=?",
                (task["source_identity"],),
            ).fetchone()
            if authority is not None and authority["task_id"] != task_id:
                raise MediaTaskStoreError(
                    "V3_MEDIA_HISTORICAL_READ_ONLY",
                    "Historical media results cannot start new processing.", status=409,
                )

    def adopt_published_source(
        self, source_identity: str, adapter_id: str,
        consent_policy_id: str, consent_policy_revision: int,
    ) -> dict[str, Any] | None:
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                authority = self._conn.execute(
                    "SELECT * FROM media_source_authority WHERE source_identity=?", (source_identity,)
                ).fetchone()
                if authority is None:
                    published = self._conn.execute(
                        """SELECT task_id FROM media_tasks WHERE source_identity=?
                           AND state IN ('ready','degraded') AND current_outline_id IS NOT NULL
                           ORDER BY updated_at DESC,task_id DESC LIMIT 1""",
                        (source_identity,),
                    ).fetchone()
                    if published is not None:
                        self._conn.execute(
                            """INSERT INTO media_source_authority
                               (source_identity,task_id,adapter_id,consent_policy_id,
                                consent_policy_revision,state,updated_at,owner_pid,owner_start)
                               VALUES (?,?,?,?,?,'published',?,?,?)""",
                            (source_identity, published["task_id"], adapter_id,
                             "legacy-unverified", 0, utc_now(),
                             os.getpid(), process_start_token(os.getpid())),
                        )
                        authority = self._conn.execute(
                            "SELECT * FROM media_source_authority WHERE source_identity=?", (source_identity,)
                        ).fetchone()
                self._conn.execute("COMMIT")
                return dict(authority) if authority is not None else None
            except Exception:
                self._conn.execute("ROLLBACK")
                raise

    def reserve_source_authority(
        self, source_identity: str, task_id: str, adapter_id: str,
        consent_policy_id: str, consent_policy_revision: int,
    ) -> dict[str, Any]:
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                row = self._conn.execute(
                    "SELECT * FROM media_source_authority WHERE source_identity=?", (source_identity,)
                ).fetchone()
                if row is not None and row["state"] not in {"failed", "cancelled"}:
                    self._conn.execute("COMMIT")
                    return dict(row)
                now = utc_now()
                self._conn.execute(
                    """INSERT INTO media_source_authority
                       (source_identity,task_id,adapter_id,consent_policy_id,
                        consent_policy_revision,state,updated_at,owner_pid,owner_start)
                       VALUES (?,?,?,?,?,'active',?,?,?)
                       ON CONFLICT(source_identity) DO UPDATE SET
                       task_id=excluded.task_id,adapter_id=excluded.adapter_id,
                       consent_policy_id=excluded.consent_policy_id,
                       consent_policy_revision=excluded.consent_policy_revision,
                       state='active',updated_at=excluded.updated_at,
                       owner_pid=excluded.owner_pid,owner_start=excluded.owner_start""",
                    (source_identity, task_id, adapter_id, consent_policy_id,
                     consent_policy_revision, now, os.getpid(), process_start_token(os.getpid())),
                )
                self._conn.execute("COMMIT")
                return dict(self._conn.execute(
                    "SELECT * FROM media_source_authority WHERE source_identity=?", (source_identity,)
                ).fetchone())
            except Exception:
                self._conn.execute("ROLLBACK")
                raise

    def mark_source_authority(self, task_id: str, state: str) -> None:
        if state not in {"published", "failed", "cancelled", "cleanup_incomplete"}:
            raise ValueError("Invalid source authority state")
        with self._lock:
            self._conn.execute(
                "UPDATE media_source_authority SET state=?,updated_at=? WHERE task_id=?",
                (state, utc_now(), task_id),
            )

    def replace_published_source_authority(
        self, *, source_identity: str, old_task_id: str, old_policy_id: str,
        old_policy_revision: int, new_task_id: str, adapter_id: str,
        new_policy_id: str, new_policy_revision: int,
    ) -> dict[str, Any]:
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                authority = self._conn.execute(
                    "SELECT * FROM media_source_authority WHERE source_identity=?", (source_identity,)
                ).fetchone()
                if authority is None or (
                    authority["task_id"], authority["consent_policy_id"], authority["consent_policy_revision"], authority["adapter_id"]
                ) != (old_task_id, old_policy_id, old_policy_revision, adapter_id):
                    raise MediaTaskStoreError("V3_MEDIA_SOURCE_POLICY_CONFLICT", "Source authority changed before confirmation.", status=409)
                if authority["state"] != "published" or (old_policy_id, old_policy_revision) == (new_policy_id, new_policy_revision):
                    raise MediaTaskStoreError("V3_MEDIA_SOURCE_POLICY_CONFLICT", "Only a published result under an older policy can be replaced.", status=409)
                previous = self._conn.execute(
                    "SELECT state,current_outline_id FROM media_tasks WHERE task_id=? AND source_identity=?",
                    (old_task_id, source_identity),
                ).fetchone()
                if previous is None or previous["state"] not in {"ready", "degraded"} or previous["current_outline_id"] is None:
                    raise MediaTaskStoreError("V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN", "Published source result is not verifiable.", status=409)
                now = utc_now()
                self._conn.execute(
                    "INSERT INTO media_tasks VALUES (?,?,'created',1,?,?,'deferred_to_v4',NULL,NULL)",
                    (new_task_id, source_identity, now, now),
                )
                self._append_event(new_task_id, 1, "task.created", {"sourceIdentity": source_identity}, now)
                self._conn.execute(
                    """INSERT INTO media_source_policy_switches
                       (new_task_id,source_identity,old_task_id,old_policy_id,old_policy_revision,
                        new_policy_id,new_policy_revision,confirmed_at,confirmation)
                       VALUES (?,?,?,?,?,?,?,?,?)""",
                    (new_task_id, source_identity, old_task_id, old_policy_id, old_policy_revision,
                     new_policy_id, new_policy_revision, now, "reanalyze_under_current_policy"),
                )
                updated = self._conn.execute(
                    """UPDATE media_source_authority SET task_id=?,consent_policy_id=?,
                       consent_policy_revision=?,state='active',updated_at=?,owner_pid=?,owner_start=?
                       WHERE source_identity=? AND task_id=? AND state='published'
                       AND consent_policy_id=? AND consent_policy_revision=?""",
                    (new_task_id, new_policy_id, new_policy_revision, now, os.getpid(),
                     process_start_token(os.getpid()), source_identity, old_task_id,
                     old_policy_id, old_policy_revision),
                )
                if updated.rowcount != 1:
                    raise MediaTaskStoreError("V3_MEDIA_SOURCE_POLICY_CONFLICT", "Source authority changed during confirmation.", status=409)
                self._conn.execute("COMMIT")
                return {"oldTaskId": old_task_id, "newTaskId": new_task_id, "confirmedAt": now}
            except Exception:
                self._conn.execute("ROLLBACK")
                raise

    def begin_cancel_source_task(self, task_id: str) -> str:
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                authority = self._conn.execute(
                    "SELECT state FROM media_source_authority WHERE task_id=?", (task_id,)
                ).fetchone()
                if authority is None:
                    raise MediaTaskStoreError("TASK_NOT_FOUND", "Source task authority was not found.", status=404)
                if authority["state"] != "active":
                    self._conn.execute("COMMIT")
                    return authority["state"]
                row = self._conn.execute("SELECT * FROM media_tasks WHERE task_id=?", (task_id,)).fetchone()
                if row is not None and row["state"] in {"ready", "degraded"}:
                    state = "published"
                else:
                    state = "cancelling"
                    if row is not None and row["state"] not in TERMINAL_STATES:
                        now = utc_now()
                        revision = row["revision"] + 1
                        self._conn.execute(
                            "UPDATE media_tasks SET state='cancelled',revision=?,updated_at=?,terminal_failure_code='TASK_CANCELLED' WHERE task_id=?",
                            (revision, now, task_id),
                        )
                        self._append_event(task_id, revision, "task.cancelled", {}, now)
                self._conn.execute(
                    "UPDATE media_source_authority SET state=?,updated_at=? WHERE task_id=?",
                    (state, utc_now(), task_id),
                )
                self._conn.execute("COMMIT")
                return state
            except Exception:
                self._conn.execute("ROLLBACK")
                raise

    def finish_cancel_source_task(self, task_id: str) -> str:
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                authority = self._conn.execute(
                    "SELECT state FROM media_source_authority WHERE task_id=?", (task_id,)
                ).fetchone()
                if authority is None:
                    raise MediaTaskStoreError("TASK_NOT_FOUND", "Source task authority was not found.", status=404)
                if authority["state"] == "cancelling":
                    self._conn.execute(
                        "UPDATE media_source_authority SET state='cancelled',updated_at=? WHERE task_id=?",
                        (utc_now(), task_id),
                    )
                    self._conn.execute("COMMIT")
                    return "cancelled"
                if authority["state"] == "cancelled":
                    self._conn.execute("COMMIT")
                    return "cancelled"
                raise MediaTaskStoreError("TASK_TRANSITION_INVALID", "Cancellation cleanup has not completed.", status=409)
            except Exception:
                self._conn.execute("ROLLBACK")
                raise

    def create(self, task_id: str, source_identity: str) -> dict[str, Any]:
        now = utc_now()
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                authority = self._conn.execute(
                    "SELECT task_id,state FROM media_source_authority WHERE source_identity=?", (source_identity,)
                ).fetchone()
                if authority is not None and authority["task_id"] != task_id:
                    raise MediaTaskStoreError("V3_MEDIA_HISTORICAL_READ_ONLY", "Historical media results are read-only.", status=409)
                if authority is not None and authority["state"] in {"cancelling", "cancelled", "failed", "cleanup_incomplete"}:
                    raise MediaTaskStoreError("TASK_CANCELLED", "Source task can no longer publish.", status=409)
                row = self._conn.execute("SELECT * FROM media_tasks WHERE task_id=?", (task_id,)).fetchone()
                if row:
                    if row["source_identity"] != source_identity:
                        raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "Task is bound to another source.", status=409)
                    self._conn.execute("COMMIT")
                    return self._task(row)
                self._conn.execute(
                    "INSERT INTO media_tasks VALUES (?,?,'created',1,?,?,'deferred_to_v4',NULL,NULL)",
                    (task_id, source_identity, now, now),
                )
                self._append_event(task_id, 1, "task.created", {"sourceIdentity": source_identity}, now)
                self._conn.execute("COMMIT")
            except Exception:
                self._conn.execute("ROLLBACK")
                raise
        return self.get(task_id)

    def transition(self, task_id: str, expected_revision: int, state: str) -> dict[str, Any]:
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                row = self._require_row(task_id)
                self._require_revision(row, expected_revision)
                authority = self._conn.execute(
                    "SELECT task_id,state FROM media_source_authority WHERE source_identity=?", (row["source_identity"],)
                ).fetchone()
                if authority is not None and authority["task_id"] != task_id:
                    raise MediaTaskStoreError("V3_MEDIA_HISTORICAL_READ_ONLY", "Historical media results are read-only.", status=409)
                if authority is not None and authority["state"] in {"cancelling", "cancelled", "failed", "cleanup_incomplete"}:
                    raise MediaTaskStoreError("TASK_CANCELLED", "Source task can no longer publish.", status=409)
                if state not in ALLOWED_TRANSITIONS.get(row["state"], set()):
                    raise MediaTaskStoreError("TASK_TRANSITION_INVALID", "Task transition is not allowed.", status=409)
                revision = expected_revision + 1
                now = utc_now()
                failure = "TASK_CANCELLED" if state == "cancelled" else None
                updated = self._conn.execute(
                    "UPDATE media_tasks SET state=?, revision=?, updated_at=?, terminal_failure_code=? WHERE task_id=? AND revision=?",
                    (state, revision, now, failure, task_id, expected_revision),
                )
                if updated.rowcount != 1:
                    raise MediaTaskStoreError("TASK_REVISION_CONFLICT", "Task revision changed.", status=409)
                self._append_event(task_id, revision, f"task.{state}", {}, now)
                self._conn.execute("COMMIT")
            except Exception:
                self._conn.execute("ROLLBACK")
                raise
        return self.get(task_id)

    def commit_terminal(
        self,
        bundle: dict[str, Any],
        *,
        expected_revision: int,
        idempotency_key: str,
        fault_at: str | None = None,
    ) -> dict[str, Any]:
        if len(idempotency_key) < 8:
            raise MediaTaskStoreError("TASK_TRANSACTION_FAILED", "Idempotency key is required.")
        validate_outline_bundle(bundle)
        task = bundle["task"]
        task_id = task["taskId"]
        if task["revision"] != expected_revision + 1:
            raise MediaTaskStoreError("TASK_REVISION_CONFLICT", "Bundle revision is stale.", status=409)
        request_hash = canonical_hash(bundle)
        with self._lock:
            prior = self._conn.execute(
                "SELECT request_sha256,response_json FROM media_task_idempotency WHERE task_id=? AND operation='commit_terminal' AND idempotency_key=?",
                (task_id, idempotency_key),
            ).fetchone()
            if prior:
                if prior["request_sha256"] != request_hash:
                    raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "Idempotency key payload changed.", status=409)
                return json.loads(prior["response_json"])
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                row = self._require_row(task_id)
                self._require_revision(row, expected_revision)
                authority = self._conn.execute(
                    "SELECT task_id,state FROM media_source_authority WHERE source_identity=?", (row["source_identity"],)
                ).fetchone()
                if authority is not None and authority["task_id"] != task_id:
                    raise MediaTaskStoreError("V3_MEDIA_HISTORICAL_READ_ONLY", "Historical media results are read-only.", status=409)
                if authority is not None and authority["state"] in {"cancelling", "cancelled", "failed", "cleanup_incomplete"}:
                    raise MediaTaskStoreError("TASK_CANCELLED", "Source task can no longer publish.", status=409)
                if row["source_identity"] != task["sourceIdentity"]:
                    raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "Source identity changed.", status=409)
                if task["state"] in {"ready", "degraded"} and row["state"] != "synthesizing":
                    raise MediaTaskStoreError("TASK_TRANSITION_INVALID", "Only a synthesizing task can publish projections.", status=409)
                if task["state"] == "blocked" and row["state"] not in {"created", "acquiring"}:
                    raise MediaTaskStoreError("TASK_TRANSITION_INVALID", "Blocked terminal is invalid from the current state.", status=409)
                if task["state"] in {"failed", "cancelled"} and row["state"] in TERMINAL_STATES:
                    raise MediaTaskStoreError("TASK_TRANSITION_INVALID", "Terminal task cannot be overwritten.", status=409)
                now = utc_now()
                revision = expected_revision + 1
                if fault_at == "before_aggregate":
                    raise RuntimeError("fault:before_aggregate")
                self._conn.execute(
                    "UPDATE media_tasks SET state=?,revision=?,updated_at=?,terminal_failure_code=?,current_outline_id=? WHERE task_id=?",
                    (task["state"], revision, now, bundle.get("terminalFailureCode"), bundle["outline"]["outlineId"] if bundle["outline"] else None, task_id),
                )
                if fault_at == "after_aggregate":
                    raise RuntimeError("fault:after_aggregate")
                for item in bundle["evidenceCatalog"]:
                    self._conn.execute(
                        "INSERT INTO media_evidence_refs VALUES (?,?,?,?,?,?,?,?)",
                        (task_id, item["evidenceId"], revision, item["kind"], item["timestampStartMs"], item["timestampEndMs"], item["contentSha256"], item["relativeArtifactRef"]),
                    )
                if bundle["outline"]:
                    outline_json = canonical_bytes({
                        "outline": bundle["outline"], "timeline": bundle["timeline"], "mindmap": bundle["mindmap"],
                    }).decode("utf-8")
                    self._conn.execute(
                        "INSERT INTO media_outlines VALUES (?,?,?,?,?,1)",
                        (task_id, revision, bundle["outline"]["outlineId"], outline_json, hashlib.sha256(outline_json.encode()).hexdigest()),
                    )
                self._append_event(task_id, revision, f"task.{task['state']}", {"terminalFailureCode": bundle.get("terminalFailureCode")}, now)
                if fault_at == "after_event":
                    raise RuntimeError("fault:after_event")
                outbox_id = f"outbox_{secrets.token_hex(16)}"
                self._conn.execute(
                    "INSERT INTO media_task_outbox VALUES (?,?,?,?,?,?,?,?)",
                    (outbox_id, task_id, revision, "publish_projections", "completed", request_hash, now, now),
                )
                if fault_at == "after_outbox":
                    raise RuntimeError("fault:after_outbox")
                envelope = self._envelope(bundle, row["created_at"], now, expected_revision, outbox_id)
                response_json = canonical_bytes(envelope).decode("utf-8")
                self._conn.execute(
                    "INSERT INTO media_task_idempotency VALUES (?, 'commit_terminal', ?, ?, ?)",
                    (task_id, idempotency_key, request_hash, response_json),
                )
                if fault_at == "before_commit":
                    raise RuntimeError("fault:before_commit")
                self._conn.execute("COMMIT")
                return deepcopy(envelope)
            except Exception:
                self._conn.execute("ROLLBACK")
                raise

    def cancel(self, task_id: str, expected_revision: int) -> dict[str, Any]:
        row = self._require_row(task_id)
        if row["state"] in TERMINAL_STATES:
            return self.get(task_id)
        return self.transition(task_id, expected_revision, "cancelled")

    def retry(self, task_id: str, expected_revision: int) -> dict[str, Any]:
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                row = self._require_row(task_id)
                self._require_revision(row, expected_revision)
                if row["state"] not in {"degraded", "failed", "blocked", "cancelled"}:
                    raise MediaTaskStoreError("TASK_TRANSITION_INVALID", "Only a terminal task can retry.", status=409)
                revision, now = expected_revision + 1, utc_now()
                self._conn.execute(
                    "UPDATE media_tasks SET state='created',revision=?,updated_at=?,terminal_failure_code=NULL,current_outline_id=NULL WHERE task_id=?",
                    (revision, now, task_id),
                )
                self._append_event(task_id, revision, "task.retry_created", {}, now)
                self._conn.execute("COMMIT")
            except Exception:
                self._conn.execute("ROLLBACK")
                raise
        return self.get(task_id)

    def recover(self) -> list[dict[str, Any]]:
        recovered = []
        with self._lock:
            rows = self._conn.execute(
                "SELECT DISTINCT task_id FROM media_task_outbox WHERE status IN ('pending','in_progress')"
            ).fetchall()
            for item in rows:
                task_id = item["task_id"]
                self._conn.execute("BEGIN IMMEDIATE")
                try:
                    row = self._require_row(task_id)
                    if row["state"] not in TERMINAL_STATES:
                        revision, now = int(row["revision"]) + 1, utc_now()
                        self._conn.execute(
                            "UPDATE media_tasks SET state='failed',revision=?,updated_at=?,terminal_failure_code='TASK_RECOVERY_UNCERTAIN' WHERE task_id=?",
                            (revision, now, task_id),
                        )
                        self._append_event(task_id, revision, "task.recovery_uncertain", {}, now)
                    self._conn.execute(
                        "UPDATE media_task_outbox SET status='uncertain',updated_at=? WHERE task_id=? AND status IN ('pending','in_progress')",
                        (utc_now(), task_id),
                    )
                    self._conn.execute("COMMIT")
                    recovered.append(self.get(task_id))
                except Exception:
                    self._conn.execute("ROLLBACK")
                    raise
        return recovered

    def get(self, task_id: str) -> dict[str, Any]:
        with self._lock:
            row = self._require_row(task_id)
            result = self._task(row)
            result["policyContext"] = self._policy_context(row)
            outline = self._conn.execute(
                "SELECT canonical_json FROM media_outlines WHERE task_id=? AND task_revision=? AND published=1",
                (task_id, row["revision"]),
            ).fetchone()
            if outline:
                stored = json.loads(outline["canonical_json"])
                evidence = [dict(item) for item in self._conn.execute(
                    """SELECT evidence_id AS evidenceId, task_id AS taskId, kind,
                              start_ms AS timestampStartMs, end_ms AS timestampEndMs,
                              content_sha256 AS contentSha256, relative_ref AS relativeArtifactRef
                       FROM media_evidence_refs
                       WHERE task_id=? AND task_revision=? ORDER BY start_ms,evidence_id""",
                    (task_id, row["revision"]),
                ).fetchall()]
                result["projections"] = {
                    "schemaVersion": "v3-media-outline-taskstore/v2",
                    "task": {
                        "taskId": result["taskId"],
                        "sourceIdentity": result["sourceIdentity"],
                        "state": result["state"],
                        "revision": result["revision"],
                        "knowledgeImportStatus": result["knowledgeImportStatus"],
                    },
                    "evidenceCatalog": evidence,
                    **stored,
                    "terminalFailureCode": result["terminalFailureCode"],
                }
            else:
                result["projections"] = None
            result["events"] = [dict(item) for item in self._conn.execute(
                "SELECT sequence,task_revision AS taskRevision,event_type AS eventType,created_at AS createdAt FROM media_task_events WHERE task_id=? ORDER BY sequence",
                (task_id,),
            ).fetchall()]
            return result

    def latest_for_source(self, source_identity: str) -> dict[str, Any]:
        with self._lock:
            authority = self._conn.execute(
                "SELECT task_id FROM media_source_authority WHERE source_identity=?", (source_identity,)
            ).fetchone()
            row = authority or self._conn.execute(
                "SELECT task_id FROM media_tasks WHERE source_identity=? ORDER BY updated_at DESC,task_id DESC LIMIT 1", (source_identity,)
            ).fetchone()
        if not row:
            raise MediaTaskStoreError("TASK_NOT_FOUND", "Media outline task was not found.", status=404)
        return self.get(row["task_id"])

    def list_tasks(self, *, limit: int = 50) -> list[dict[str, Any]]:
        if type(limit) is not int or not 1 <= limit <= 100:
            raise MediaTaskStoreError("TASK_LIST_LIMIT_INVALID", "Task list limit must be between 1 and 100.")
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM media_tasks ORDER BY updated_at DESC, task_id DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [{**self._task(row), "policyContext": self._policy_context(row)} for row in rows]

    def _policy_context(self, row: sqlite3.Row) -> dict[str, Any]:
        authority = self._conn.execute(
            "SELECT task_id,consent_policy_id,consent_policy_revision FROM media_source_authority WHERE source_identity=?",
            (row["source_identity"],),
        ).fetchone()
        if authority is None:
            return {"status": "unverified", "consentPolicyId": None, "consentPolicyRevision": None}
        if authority["task_id"] == row["task_id"]:
            return {
                "status": "unverified" if authority["consent_policy_id"] == "legacy-unverified" else "current",
                "consentPolicyId": authority["consent_policy_id"],
                "consentPolicyRevision": authority["consent_policy_revision"],
            }
        switch = self._conn.execute(
            """SELECT old_policy_id,old_policy_revision FROM media_source_policy_switches
               WHERE old_task_id=? ORDER BY confirmed_at DESC LIMIT 1""",
            (row["task_id"],),
        ).fetchone()
        return {
            "status": "historical",
            "consentPolicyId": switch["old_policy_id"] if switch else None,
            "consentPolicyRevision": switch["old_policy_revision"] if switch else None,
        }

    def transaction_counts(self, task_id: str) -> dict[str, int]:
        with self._lock:
            return {
                "eventCount": self._conn.execute("SELECT COUNT(*) FROM media_task_events WHERE task_id=?", (task_id,)).fetchone()[0],
                "outboxCount": self._conn.execute("SELECT COUNT(*) FROM media_task_outbox WHERE task_id=?", (task_id,)).fetchone()[0],
                "outlineCount": self._conn.execute("SELECT COUNT(*) FROM media_outlines WHERE task_id=?", (task_id,)).fetchone()[0],
            }

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def _append_event(self, task_id: str, revision: int, event_type: str, payload: dict[str, Any], now: str) -> None:
        sequence = self._conn.execute(
            "SELECT COALESCE(MAX(sequence),-1)+1 FROM media_task_events WHERE task_id=?", (task_id,)
        ).fetchone()[0]
        self._conn.execute(
            "INSERT INTO media_task_events VALUES (?,?,?,?,?,?)",
            (task_id, sequence, revision, event_type, canonical_bytes(payload).decode("utf-8"), now),
        )

    def _require_row(self, task_id: str) -> sqlite3.Row:
        row = self._conn.execute("SELECT * FROM media_tasks WHERE task_id=?", (task_id,)).fetchone()
        if not row:
            raise MediaTaskStoreError("TASK_NOT_FOUND", "Media outline task was not found.", status=404)
        return row

    @staticmethod
    def _require_revision(row: sqlite3.Row, expected: int) -> None:
        if int(row["revision"]) != expected:
            raise MediaTaskStoreError("TASK_REVISION_CONFLICT", "Task revision changed.", status=409)

    @staticmethod
    def _task(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "taskId": row["task_id"], "sourceIdentity": row["source_identity"], "state": row["state"],
            "revision": row["revision"], "createdAt": row["created_at"], "updatedAt": row["updated_at"],
            "knowledgeImportStatus": row["knowledge_import_status"], "terminalFailureCode": row["terminal_failure_code"],
            "currentOutlineId": row["current_outline_id"],
        }

    @staticmethod
    def _envelope(bundle: dict[str, Any], created_at: str, committed_at: str, expected_revision: int, outbox_id: str) -> dict[str, Any]:
        result = deepcopy(bundle)
        result["task"]["createdAt"] = created_at
        result["task"]["updatedAt"] = committed_at
        published = result["outline"] is not None
        result.pop("terminalFailureCode", None)
        result["transactionReceipt"] = {
            "transactionId": "mtx_" + hashlib.sha256(outbox_id.encode()).hexdigest()[:32],
            "taskId": result["task"]["taskId"], "expectedRevision": expected_revision,
            "committedRevision": expected_revision + 1, "aggregateCommitted": True,
            "eventCommitted": True, "outboxCommitted": True, "outlinePublished": published,
            "projectionPublished": published, "terminalFailureCode": bundle.get("terminalFailureCode"),
            "duplicateWriteCount": 0, "unresolvedEvidenceReferenceCount": 0,
            "crossTaskEvidenceReferenceCount": 0, "projectionEvidenceClosurePassed": published,
            "committedAt": committed_at,
        }
        return result
