"""WP-B durable local-import store.

The store is the ONLY truth that survives a request boundary or a Runtime
restart. Every state change is one `BEGIN IMMEDIATE` transaction with
`synchronous=FULL` and a single compare-and-set on `(sequence, state)`; the
client is answered only after the commit.

The table deliberately has NO column for a token, a token digest, a file name,
a client path, a sandbox path, a cookie or a raw exception.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Final

from .contracts import (
    BARRIER_PHASES,
    CONSUMER_BARRIER_SCHEMA_VERSION,
    INITIAL_BARRIER_PHASE,
    DECLARED_MEDIA_TYPES,
    FAILURE_CODES,
    IMPORT_ID_RE,
    NON_TERMINAL_STATES,
    PREFIX,
    SCHEMA_VERSION,
    ImportError,
    can_transition,
    semantic_validate_import,
)

TABLE = "media_local_imports_v1"

_COLUMNS: tuple[str, ...] = (
    "import_id",
    "task_id",
    "source_identity",
    "state",
    "sequence",
    "byte_length",
    "uploaded_bytes",
    "declared_media_type",
    "dependency_generation",
    "video_manifest_sha256",
    "visual_receipt_sha256",
    "barrier_phase",
    "failure_code",
    "created_at",
    "updated_at",
)

_CREATE = f"""
CREATE TABLE IF NOT EXISTS {TABLE}(
    import_id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    source_identity TEXT NOT NULL,
    state TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    byte_length INTEGER NOT NULL,
    uploaded_bytes INTEGER NOT NULL,
    declared_media_type TEXT NOT NULL,
    dependency_generation TEXT NOT NULL,
    video_manifest_sha256 TEXT,
    visual_receipt_sha256 TEXT,
    barrier_phase TEXT NOT NULL,
    failure_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)
"""

# One active import per task. Terminal rows are excluded by state, so a finished
# import never blocks the next attempt.
_UNIQUE_ACTIVE = f"""
CREATE UNIQUE INDEX IF NOT EXISTS {TABLE}_active_task
ON {TABLE}(task_id)
WHERE state NOT IN ('ready','cancelled','failed')
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class LocalMediaImportStore:
    """Durable import records with FULL-synchronous compare-and-set writes."""

    def __init__(self, database_path: Path) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._ensure_schema()

    # -- schema ---------------------------------------------------------------

    def _ensure_schema(self) -> None:
        connection = self._connect()
        try:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(_CREATE)
            connection.execute(_UNIQUE_ACTIVE)
            connection.commit()
        finally:
            connection.close()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=20, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA synchronous=FULL")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    # -- reads ----------------------------------------------------------------

    def _row_to_record(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "schemaVersion": SCHEMA_VERSION,
            "importId": row["import_id"],
            "taskId": row["task_id"],
            "sourceIdentity": row["source_identity"],
            "state": row["state"],
            "sequence": row["sequence"],
            "byteLength": row["byte_length"],
            "uploadedBytes": row["uploaded_bytes"],
            "declaredMediaType": row["declared_media_type"],
            "dependencyGeneration": row["dependency_generation"],
            "videoManifestSha256": row["video_manifest_sha256"],
            "visualReceiptSha256": row["visual_receipt_sha256"],
            "barrierPhase": row["barrier_phase"],
            "failureCode": row["failure_code"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def get(self, import_id: str) -> dict[str, Any]:
        if not isinstance(import_id, str) or not IMPORT_ID_RE.fullmatch(import_id):
            raise ImportError("NOT_FOUND", "Import was not found.")
        connection = self._connect()
        try:
            row = connection.execute(
                f"SELECT * FROM {TABLE} WHERE import_id=?", (import_id,)
            ).fetchone()
        finally:
            connection.close()
        if row is None:
            raise ImportError("NOT_FOUND", "Import was not found.")
        return self._row_to_record(row)

    def find(self, import_id: str) -> dict[str, Any] | None:
        try:
            return self.get(import_id)
        except ImportError:
            return None

    def list_incomplete(self) -> list[dict[str, Any]]:
        connection = self._connect()
        try:
            rows = connection.execute(
                f"SELECT * FROM {TABLE} WHERE state NOT IN ('ready','cancelled','failed') "
                "ORDER BY created_at ASC"
            ).fetchall()
        finally:
            connection.close()
        return [self._row_to_record(row) for row in rows]

    def list_for_task(self, task_id: str) -> list[dict[str, Any]]:
        """EVERY import record of ONE task, in creation order.

        `list_incomplete` hides the `ready` records, and a ready record is the
        one that owns the CURRENT input of a task. The binding lookup needs
        the whole history of the task, including the dead records, so it can
        tell "this task never had a local import" from "this task's local
        import is closed".
        """
        connection = self._connect()
        try:
            rows = connection.execute(
                f"SELECT * FROM {TABLE} WHERE task_id=? ORDER BY created_at ASC",
                (task_id,),
            ).fetchall()
        finally:
            connection.close()
        return [self._row_to_record(row) for row in rows]

    def list_unclean_barriers(self) -> list[dict[str, Any]]:
        connection = self._connect()
        try:
            rows = connection.execute(
                f"SELECT * FROM {TABLE} WHERE barrier_phase NOT IN ('none','cleaned')"
            ).fetchall()
        finally:
            connection.close()
        return [self._row_to_record(row) for row in rows]

    # -- writes ---------------------------------------------------------------

    def create_import(
        self,
        *,
        task_id: str,
        source_identity: str,
        byte_length: int,
        declared_media_type: str,
        dependency_generation: str,
        import_id: str,
    ) -> dict[str, Any]:
        if declared_media_type not in DECLARED_MEDIA_TYPES:
            raise ImportError("TYPE_UNSUPPORTED", "Declared media type is not supported.")
        stamp = _now()
        record = {
            "schemaVersion": SCHEMA_VERSION,
            "importId": import_id,
            "taskId": task_id,
            "sourceIdentity": source_identity,
            "state": "awaiting_upload",
            "sequence": 0,
            "byteLength": byte_length,
            "uploadedBytes": 0,
            "declaredMediaType": declared_media_type,
            "dependencyGeneration": dependency_generation,
            "videoManifestSha256": None,
            "visualReceiptSha256": None,
            "barrierPhase": INITIAL_BARRIER_PHASE,
            "failureCode": None,
            "createdAt": stamp,
            "updatedAt": stamp,
        }
        semantic_validate_import(record)
        with self._lock, self._connect() as connection:
            try:
                connection.execute("BEGIN IMMEDIATE")
                active = connection.execute(
                    f"SELECT import_id FROM {TABLE} WHERE task_id=? "
                    "AND state NOT IN ('ready','cancelled','failed')",
                    (task_id,),
                ).fetchone()
                if active is not None:
                    raise ImportError(
                        "ACTIVE",
                        "An import is already active for this task.",
                        details={"importId": active["import_id"]},
                    )
                connection.execute(
                    f"INSERT INTO {TABLE}({','.join(_COLUMNS)}) "
                    f"VALUES({','.join('?' * len(_COLUMNS))})",
                    tuple(
                        [
                            record["importId"], record["taskId"], record["sourceIdentity"],
                            record["state"], record["sequence"], record["byteLength"],
                            record["uploadedBytes"], record["declaredMediaType"],
                            record["dependencyGeneration"], record["videoManifestSha256"],
                            record["visualReceiptSha256"], record["barrierPhase"],
                            record["failureCode"], record["createdAt"], record["updatedAt"],
                        ]
                    ),
                )
                connection.execute("COMMIT")
            except ImportError:
                connection.execute("ROLLBACK")
                raise
            except sqlite3.IntegrityError as error:
                connection.execute("ROLLBACK")
                raise ImportError("ACTIVE", "An import is already active for this task.") from error
            except Exception:
                connection.execute("ROLLBACK")
                raise
        return record

    def transition(
        self,
        import_id: str,
        *,
        expected_sequence: int,
        state: str,
        uploaded_bytes: int | None = None,
        barrier_phase: str | None = None,
        failure_code: str | None = None,
        video_manifest_sha256: str | None = None,
        visual_receipt_sha256: str | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            current = self.get(import_id)
            if current["sequence"] != expected_sequence:
                # A stale worker must never rewrite a newer record.
                raise ImportError(
                    "NOT_FOUND",
                    "Import was not found at the expected sequence.",
                    details={"importId": import_id},
                )
            if not can_transition(current["state"], state):
                raise ImportError("REQUEST_INVALID", "Import state transition is not allowed.")
            if barrier_phase is not None and barrier_phase not in BARRIER_PHASES:
                raise ImportError("REQUEST_INVALID", "Barrier phase is invalid.")
            if failure_code is not None and failure_code.removeprefix(PREFIX) not in FAILURE_CODES:
                raise ImportError("REQUEST_INVALID", "Import failure code is not registered.")

            updated = dict(current)
            updated["state"] = state
            updated["sequence"] = current["sequence"] + 1
            updated["updatedAt"] = _now()
            if uploaded_bytes is not None:
                updated["uploadedBytes"] = uploaded_bytes
            if barrier_phase is not None:
                updated["barrierPhase"] = barrier_phase
            if failure_code is not None:
                updated["failureCode"] = failure_code
            if video_manifest_sha256 is not None:
                updated["videoManifestSha256"] = video_manifest_sha256
            if visual_receipt_sha256 is not None:
                updated["visualReceiptSha256"] = visual_receipt_sha256
            semantic_validate_import(updated)

            with self._connect() as connection:
                try:
                    connection.execute("BEGIN IMMEDIATE")
                    cursor = connection.execute(
                        f"UPDATE {TABLE} SET state=?, sequence=?, uploaded_bytes=?, barrier_phase=?, "
                        "failure_code=?, video_manifest_sha256=?, visual_receipt_sha256=?, updated_at=? "
                        "WHERE import_id=? AND sequence=?",
                        (
                            updated["state"], updated["sequence"], updated["uploadedBytes"],
                            updated["barrierPhase"], updated["failureCode"],
                            updated["videoManifestSha256"], updated["visualReceiptSha256"],
                            updated["updatedAt"], import_id, expected_sequence,
                        ),
                    )
                    if cursor.rowcount != 1:
                        raise ImportError(
                            "NOT_FOUND",
                            "Import was not found at the expected sequence.",
                            details={"importId": import_id},
                        )
                    connection.execute("COMMIT")
                except Exception:
                    connection.execute("ROLLBACK")
                    raise
            return updated

    def advance_barrier(self, import_id: str, barrier_phase: str, **fields: Any) -> dict[str, Any]:
        """Advance only the barrier phase of a ready record, keeping its sequence CAS."""
        with self._lock:
            current = self.get(import_id)
            updated = dict(current)
            updated["sequence"] = current["sequence"] + 1
            updated["barrierPhase"] = barrier_phase
            updated["updatedAt"] = _now()
            for key, value in fields.items():
                if key in {"videoManifestSha256", "visualReceiptSha256", "failureCode", "uploadedBytes"}:
                    updated[key] = value
            semantic_validate_import(updated)
            with self._connect() as connection:
                try:
                    connection.execute("BEGIN IMMEDIATE")
                    cursor = connection.execute(
                        f"UPDATE {TABLE} SET sequence=?, barrier_phase=?, updated_at=?, "
                        "video_manifest_sha256=?, visual_receipt_sha256=?, failure_code=? "
                        "WHERE import_id=? AND sequence=?",
                        (
                            updated["sequence"],
                            barrier_phase,
                            updated["updatedAt"],
                            updated["videoManifestSha256"],
                            updated["visualReceiptSha256"],
                            updated["failureCode"],
                            import_id,
                            current["sequence"],
                        ),
                    )
                    if cursor.rowcount != 1:
                        raise ImportError("NOT_FOUND", "Import was not found at the expected sequence.")
                    connection.execute("COMMIT")
                except Exception:
                    connection.execute("ROLLBACK")
                    raise
            return updated

    # -- restart --------------------------------------------------------------

    def reconcile_after_restart(self, skip: set[str] | None = None) -> list[str]:
        """Turn every interrupted record into a persisted terminal failure.

        A new Runtime never resumes an upload, a token or a worker, and GET
        must keep answering with this persisted state instead of 404.

        `skip` names the imports whose barrier is still open: those are
        reconciled by the ORCHESTRATOR, because their shared input is still
        owned by the two-consumer barrier and only it knows what may be
        released. Everything else is an interrupted upload with no barrier at
        all and becomes a persisted terminal failure here.
        """
        skipped = set(skip or ())
        interrupted: list[str] = []
        for record in self.list_incomplete():
            import_id = record["importId"]
            if import_id in skipped:
                continue
            with self._lock:
                current = self.get(import_id)
                if current["state"] in {"ready", "cancelled", "failed"}:
                    continue
                updated = dict(current)
                updated["state"] = "failed"
                updated["sequence"] = current["sequence"] + 1
                updated["failureCode"] = f"{PREFIX}RUNTIME_RESTARTED"
                updated["updatedAt"] = _now()
                with self._connect() as connection:
                    try:
                        connection.execute("BEGIN IMMEDIATE")
                        connection.execute(
                            f"UPDATE {TABLE} SET state=?, sequence=?, failure_code=?, updated_at=? "
                            "WHERE import_id=?",
                            (updated["state"], updated["sequence"], updated["failureCode"],
                             updated["updatedAt"], import_id),
                        )
                        connection.execute("COMMIT")
                    except Exception:
                        connection.execute("ROLLBACK")
                        raise
            interrupted.append(import_id)
        return interrupted


# ---------------------------------------------------------------------------
# The consumer barrier lives in its OWN durable table.
#
# The frozen 15-column `media_local_imports_v1` storeRecord must NOT grow a
# field, so the barrier keeps its own record next to it. It persists the
# receipts the frozen T1..T4 order is decided by, so that a fresh Runtime
# process sees what a killed predecessor had already made durable.
# ---------------------------------------------------------------------------

BARRIER_TABLE = "media_local_import_barriers_v1"

_BARRIER_COLUMNS: Final[tuple[str, ...]] = (
    "import_id",
    "task_id",
    "phase",
    "sequence",
    "audio_owner_receipt_sha256",
    "visual_receipt_sha256",
    "transcript_terminal",
    "visual_terminal",
    "prepared_media",
    "video_manifest_sha256",
    "updated_at",
)

_BARRIER_CREATE: Final = f"""
CREATE TABLE IF NOT EXISTS {BARRIER_TABLE}(
    import_id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    audio_owner_receipt_sha256 TEXT,
    visual_receipt_sha256 TEXT,
    transcript_terminal INTEGER NOT NULL,
    visual_terminal INTEGER NOT NULL,
    prepared_media TEXT,
    video_manifest_sha256 TEXT,
    updated_at TEXT NOT NULL
)
"""

_BARRIER_UPDATE_SQL: Final = (
    f"UPDATE {BARRIER_TABLE} SET phase=?, sequence=?, "
    "audio_owner_receipt_sha256=?, visual_receipt_sha256=?, "
    "transcript_terminal=?, visual_terminal=?, prepared_media=?, "
    "video_manifest_sha256=?, updated_at=? "
    "WHERE import_id=? AND sequence=?"
)


class LocalMediaBarrierStore:
    """Durable consumer-barrier records with FULL-synchronous compare-and-set.

    Every mutation is one `BEGIN IMMEDIATE` transaction on a connection that
    has `synchronous=FULL`, guarded by a single compare-and-set on `sequence`.
    The caller is answered only after the commit, so a hard kill can never
    leave a receipt that no process can observe.
    """

    def __init__(self, database_path: Path) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        connection = self._connect()
        try:
            connection.execute(_BARRIER_CREATE)
            # The frozen storeRecord keeps `barrier_phase` and
            # `visual_receipt_sha256`; they are mirrored in the SAME transaction.
            # A standalone barrier store (unit tools, a probe) simply has nothing
            # to mirror into.
            self._mirrors = (
                connection.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (TABLE,)
                ).fetchone()
                is not None
            )
        finally:
            connection.close()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self.database_path, timeout=20, isolation_level=None
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA synchronous=FULL")
        return connection

    # -- reads ---------------------------------------------------------------

    def get(self, import_id: str) -> dict[str, Any]:
        connection = self._connect()
        try:
            row = connection.execute(
                f"SELECT * FROM {BARRIER_TABLE} WHERE import_id=?", (import_id,)
            ).fetchone()
        finally:
            connection.close()
        if row is None:
            raise KeyError(import_id)
        return self._row(row)

    def find(self, import_id: str) -> dict[str, Any] | None:
        try:
            return self.get(import_id)
        except KeyError:
            return None

    def sequence_of(self, import_id: str) -> int:
        """The internal compare-and-set sequence. It is NOT part of the record."""
        connection = self._connect()
        try:
            row = connection.execute(
                f"SELECT sequence FROM {BARRIER_TABLE} WHERE import_id=?", (import_id,)
            ).fetchone()
        finally:
            connection.close()
        if row is None:
            raise KeyError(import_id)
        return int(row["sequence"])

    def video_manifest_of(self, import_id: str) -> str | None:
        """The owner-manifest digest T1 verified. It is NOT part of the record."""
        connection = self._connect()
        try:
            row = connection.execute(
                f"SELECT video_manifest_sha256 FROM {BARRIER_TABLE} WHERE import_id=?", (import_id,)
            ).fetchone()
        finally:
            connection.close()
        if row is None:
            raise KeyError(import_id)
        return row["video_manifest_sha256"]

    def prepared_media_of(self, import_id: str) -> dict[str, Any] | None:
        """The durable prepared-media facts behind the frozen public projection."""
        connection = self._connect()
        try:
            row = connection.execute(
                f"SELECT prepared_media FROM {BARRIER_TABLE} WHERE import_id=?", (import_id,)
            ).fetchone()
        finally:
            connection.close()
        if row is None or not row["prepared_media"]:
            return None
        return json.loads(row["prepared_media"])

    def list_open(self) -> list[dict[str, Any]]:
        """Every barrier that has not reached the frozen terminal phase."""
        connection = self._connect()
        try:
            rows = connection.execute(
                f"SELECT * FROM {BARRIER_TABLE} WHERE phase<>? ORDER BY import_id",
                ("cleaned",),
            ).fetchall()
        finally:
            connection.close()
        return [self._row(row) for row in rows]

    @staticmethod
    def _row(row: sqlite3.Row) -> dict[str, Any]:
        """The FROZEN `consumerBarrier` record, exactly as the schema declares it.

        The internal compare-and-set sequence and the prepared-media facts are
        NOT part of that shape, so they have their own accessors.
        """
        return {
            "schemaVersion": CONSUMER_BARRIER_SCHEMA_VERSION,
            "importId": row["import_id"],
            "taskId": row["task_id"],
            "phase": row["phase"],
            "audioOwnerReceiptSha256": row["audio_owner_receipt_sha256"],
            "visualReceiptSha256": row["visual_receipt_sha256"],
            "transcriptTerminal": bool(row["transcript_terminal"]),
            "visualTerminal": bool(row["visual_terminal"]),
            "updatedAt": row["updated_at"],
        }

    # -- writes --------------------------------------------------------------

    def create(self, *, import_id: str, task_id: str) -> dict[str, Any]:
        """Open the barrier for an import. Re-opening an existing one is a no-op."""
        existing = self.find(import_id)
        if existing is not None:
            return existing
        with self._lock:
            connection = self._connect()
            try:
                connection.execute("BEGIN IMMEDIATE")
                connection.execute(
                    f"INSERT OR IGNORE INTO {BARRIER_TABLE}"
                    f"({','.join(_BARRIER_COLUMNS)}) "
                    f"VALUES({','.join('?' * len(_BARRIER_COLUMNS))})",
                    (import_id, task_id, INITIAL_BARRIER_PHASE, 0, None, None, 0, 0, None, None, _now()),
                )
                connection.execute("COMMIT")
            except BaseException:
                connection.execute("ROLLBACK")
                raise
            finally:
                connection.close()
        return self.get(import_id)

    def advance(
        self,
        import_id: str,
        *,
        expected_sequence: int,
        phase: str | None = None,
        audio_owner_receipt_sha256: str | None = None,
        visual_receipt_sha256: str | None = None,
        transcript_terminal: bool | None = None,
        visual_terminal: bool | None = None,
        prepared_media: dict[str, Any] | None = None,
        video_manifest_sha256: str | None = None,
    ) -> dict[str, Any]:
        """One FULL-synchronous compare-and-set. Raises on a lost race."""
        if phase is not None and phase not in BARRIER_PHASES:
            raise ImportError("REQUEST_INVALID", "Barrier phase is invalid.")
        with self._lock:
            current = self.get(import_id)
            sequence = self.sequence_of(import_id)
            if sequence != expected_sequence:
                raise ImportError("WRITE_FAILED", "Barrier compare-and-set lost its race.")
            merged = {
                "phase": current["phase"] if phase is None else phase,
                "audioOwnerReceiptSha256": (
                    current["audioOwnerReceiptSha256"]
                    if audio_owner_receipt_sha256 is None
                    else audio_owner_receipt_sha256
                ),
                "visualReceiptSha256": (
                    current["visualReceiptSha256"]
                    if visual_receipt_sha256 is None
                    else visual_receipt_sha256
                ),
                "transcriptTerminal": (
                    current["transcriptTerminal"]
                    if transcript_terminal is None
                    else bool(transcript_terminal)
                ),
                "visualTerminal": (
                    current["visualTerminal"]
                    if visual_terminal is None
                    else bool(visual_terminal)
                ),
                "preparedMedia": (
                    self.prepared_media_of(import_id)
                    if prepared_media is None else dict(prepared_media)
                ),
                "videoManifestSha256": (
                    self.video_manifest_of(import_id)
                    if video_manifest_sha256 is None else video_manifest_sha256
                ),
            }
            updated_at = _now()
            next_sequence = sequence + 1
            connection = self._connect()
            try:
                connection.execute("BEGIN IMMEDIATE")
                cursor = connection.execute(
                    _BARRIER_UPDATE_SQL,
                    (
                        merged["phase"],
                        next_sequence,
                        merged["audioOwnerReceiptSha256"],
                        merged["visualReceiptSha256"],
                        1 if merged["transcriptTerminal"] else 0,
                        1 if merged["visualTerminal"] else 0,
                        json.dumps(
                            merged["preparedMedia"],
                            ensure_ascii=False,
                            sort_keys=True,
                            separators=(",", ":"),
                        )
                        if merged["preparedMedia"] is not None
                        else None,
                        merged["videoManifestSha256"],
                        updated_at,
                        import_id,
                        expected_sequence,
                    ),
                )
                if cursor.rowcount != 1:
                    connection.execute("ROLLBACK")
                    raise ImportError(
                        "WRITE_FAILED", "Barrier compare-and-set lost its race."
                    )
                # The frozen storeRecord keeps its own `barrier_phase` and
                # `visual_receipt_sha256` columns. They are mirrored in the SAME
                # transaction so the public record and the barrier record can
                # never disagree, and so a kill cannot split them.
                if self._mirrors:
                    connection.execute(
                        f"UPDATE {TABLE} SET sequence=sequence+1, barrier_phase=?, "
                        "visual_receipt_sha256=COALESCE(?, visual_receipt_sha256), "
                        "updated_at=? WHERE import_id=?",
                        (
                            merged["phase"],
                            merged["visualReceiptSha256"],
                            updated_at,
                            import_id,
                        ),
                    )
                connection.execute("COMMIT")
            except BaseException:
                try:
                    connection.execute("ROLLBACK")
                except sqlite3.Error:
                    pass
                raise
            finally:
                connection.close()
        return {
            "schemaVersion": "v3-media-local-import-barrier/v1",
            "importId": import_id,
            "taskId": current["taskId"],
            "sequence": next_sequence,
            "updatedAt": updated_at,
            **merged,
        }

    def claim_cleanup(self, import_id: str) -> dict[str, Any] | None:
        """The exactly-once durable claim on shared-input cleanup.

        Only the caller that wins this compare-and-set may run cleanup. Every
        other caller — including a fresh process after a restart — gets `None`
        and must not clean again.
        """
        current = self.find(import_id)
        if current is None or current["phase"] == "cleaned":
            return None
        if not (current["transcriptTerminal"] and current["visualTerminal"]):
            return None
        if current["phase"] == "cleaning":
            return current  # a killed predecessor left the claim open; resume it
        try:
            return self.advance(
                import_id,
                expected_sequence=self.sequence_of(import_id),
                phase="cleaning",
            )
        except ImportError:
            return None
