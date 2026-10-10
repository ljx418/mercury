from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from typing import Any, Callable

from .outline import MediaOutlineError, canonical_bytes, canonical_hash, validate_outline_bundle


TERMINAL_STATES = {"ready", "degraded", "blocked", "failed", "cancelled"}
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
                """
            )
            self._conn.execute(
                "INSERT OR IGNORE INTO media_outline_schema_versions(version, applied_at) VALUES (2, ?)",
                (utc_now(),),
            )

    def create(self, task_id: str, source_identity: str) -> dict[str, Any]:
        now = utc_now()
        with self._lock:
            row = self._conn.execute("SELECT * FROM media_tasks WHERE task_id=?", (task_id,)).fetchone()
            if row:
                if row["source_identity"] != source_identity:
                    raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "Task is bound to another source.", status=409)
                return self._task(row)
            self._conn.execute("BEGIN IMMEDIATE")
            try:
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
            row = self._conn.execute(
                "SELECT task_id FROM media_tasks WHERE source_identity=? ORDER BY updated_at DESC,task_id DESC LIMIT 1",
                (source_identity,),
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
            return [self._task(row) for row in rows]

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
