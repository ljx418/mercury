from __future__ import annotations

import json
import secrets
import sqlite3
from pathlib import Path
from threading import RLock
from typing import Any
from urllib.parse import urlparse

from navia_runtime.contracts import utc_now


class KnowledgeV3Error(RuntimeError):
    def __init__(self, code: str, message: str, *, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


class KnowledgeV3Store:
    """Persistent, user-confirmed V3 Draft/Item store."""

    def __init__(self, db_path: str | Path) -> None:
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._migrate()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def _migrate(self) -> None:
        with self._connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS v3_knowledge_drafts (
                    draft_id TEXT PRIMARY KEY, state TEXT NOT NULL, source_refs_json TEXT NOT NULL,
                    title TEXT NOT NULL, summary TEXT NOT NULL, body TEXT NOT NULL,
                    tags_json TEXT NOT NULL, custom_fields_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL, context_hash TEXT NOT NULL,
                    revision INTEGER NOT NULL, item_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS v3_knowledge_items (
                    item_id TEXT PRIMARY KEY, source_refs_json TEXT NOT NULL,
                    title TEXT NOT NULL, summary TEXT NOT NULL, body TEXT NOT NULL,
                    tags_json TEXT NOT NULL, custom_fields_json TEXT NOT NULL,
                    priority INTEGER NOT NULL, lifecycle_state TEXT NOT NULL,
                    revision INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_v3_knowledge_items_updated
                    ON v3_knowledge_items(updated_at DESC, item_id ASC);
            """)

    def create_draft(self, value: dict[str, Any]) -> dict[str, Any]:
        normalized = self._validate_content(value, require_context=True)
        now = utc_now()
        draft_id = "knd_" + secrets.token_hex(16)
        with self._lock, self._connect() as db:
            db.execute(
                "INSERT INTO v3_knowledge_drafts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (draft_id, "editing", self._dump(normalized["sourceRefs"]), normalized["title"],
                 normalized["summary"], normalized["body"], self._dump(normalized["tags"]),
                 self._dump(normalized["customFields"]), self._dump(normalized["provenance"]),
                 normalized["createdFromContextHash"], 1, None, now, now),
            )
        return self.get_draft(draft_id)

    def get_draft(self, draft_id: str) -> dict[str, Any]:
        with self._connect() as db:
            row = db.execute("SELECT * FROM v3_knowledge_drafts WHERE draft_id=?", (draft_id,)).fetchone()
        if row is None:
            raise KnowledgeV3Error("KNOWLEDGE_DRAFT_NOT_FOUND", "Knowledge draft was not found.", status=404)
        return self._draft(row)

    def update_draft(self, draft_id: str, value: dict[str, Any]) -> dict[str, Any]:
        current = self.get_draft(draft_id)
        if current["state"] != "editing":
            raise KnowledgeV3Error("KNOWLEDGE_DRAFT_NOT_EDITABLE", "Knowledge draft is no longer editable.", status=409)
        if value.get("revision") != current["revision"]:
            raise KnowledgeV3Error("KNOWLEDGE_REVISION_CONFLICT", "Knowledge draft revision changed.", status=409)
        merged = {**current, **{key: value[key] for key in ("title", "summary", "body", "tags", "customFields") if key in value}}
        normalized = self._validate_content(merged, require_context=True)
        now = utc_now()
        with self._lock, self._connect() as db:
            db.execute(
                "UPDATE v3_knowledge_drafts SET title=?,summary=?,body=?,tags_json=?,custom_fields_json=?,revision=revision+1,updated_at=? WHERE draft_id=? AND revision=?",
                (normalized["title"], normalized["summary"], normalized["body"], self._dump(normalized["tags"]),
                 self._dump(normalized["customFields"]), now, draft_id, current["revision"]),
            )
        return self.get_draft(draft_id)

    def cancel_draft(self, draft_id: str) -> dict[str, Any]:
        current = self.get_draft(draft_id)
        if current["state"] == "saved":
            raise KnowledgeV3Error("KNOWLEDGE_DRAFT_NOT_EDITABLE", "Saved knowledge draft cannot be cancelled.", status=409)
        if current["state"] == "cancelled":
            return current
        now = utc_now()
        with self._lock, self._connect() as db:
            db.execute("UPDATE v3_knowledge_drafts SET state='cancelled',revision=revision+1,updated_at=? WHERE draft_id=?", (now, draft_id))
        return self.get_draft(draft_id)

    def save_draft(self, draft_id: str) -> dict[str, Any]:
        with self._lock, self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM v3_knowledge_drafts WHERE draft_id=?", (draft_id,)).fetchone()
            if row is None:
                raise KnowledgeV3Error("KNOWLEDGE_DRAFT_NOT_FOUND", "Knowledge draft was not found.", status=404)
            draft = self._draft(row)
            if draft["state"] == "saved":
                item = db.execute("SELECT * FROM v3_knowledge_items WHERE item_id=?", (draft["itemId"],)).fetchone()
                return {"draft": draft, "item": self._item(item), "idempotentReplay": True}
            if draft["state"] != "editing":
                raise KnowledgeV3Error("KNOWLEDGE_DRAFT_NOT_EDITABLE", "Cancelled knowledge draft cannot be saved.", status=409)
            item_id = "kni_" + secrets.token_hex(16)
            now = utc_now()
            db.execute(
                "INSERT INTO v3_knowledge_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (item_id, self._dump(draft["sourceRefs"]), draft["title"], draft["summary"], draft["body"],
                 self._dump(draft["tags"]), self._dump(draft["customFields"]), 50, "active", 1, now, now),
            )
            db.execute(
                "UPDATE v3_knowledge_drafts SET state='saved',item_id=?,revision=revision+1,updated_at=? WHERE draft_id=?",
                (item_id, now, draft_id),
            )
        return {"draft": self.get_draft(draft_id), "item": self.get_item(item_id), "idempotentReplay": False}

    def list_items(self, *, sort: str = "updated_desc") -> list[dict[str, Any]]:
        order = {
            "created_desc": "created_at DESC, item_id ASC",
            "updated_desc": "updated_at DESC, item_id ASC",
            "title_asc": "title COLLATE NOCASE ASC, item_id ASC",
            "priority_desc": "priority DESC, updated_at DESC, item_id ASC",
        }.get(sort)
        if order is None:
            raise KnowledgeV3Error("KNOWLEDGE_SORT_INVALID", "Knowledge sort is invalid.")
        with self._connect() as db:
            rows = db.execute(f"SELECT * FROM v3_knowledge_items ORDER BY {order}").fetchall()
        return [self._item(row) for row in rows]

    def get_item(self, item_id: str) -> dict[str, Any]:
        with self._connect() as db:
            row = db.execute("SELECT * FROM v3_knowledge_items WHERE item_id=?", (item_id,)).fetchone()
        if row is None:
            raise KnowledgeV3Error("KNOWLEDGE_ITEM_NOT_FOUND", "Knowledge item was not found.", status=404)
        return self._item(row)

    def update_item(self, item_id: str, value: dict[str, Any]) -> dict[str, Any]:
        current = self.get_item(item_id)
        if value.get("revision") != current["revision"]:
            raise KnowledgeV3Error("KNOWLEDGE_REVISION_CONFLICT", "Knowledge item revision changed.", status=409)
        merged = {**current, **{key: value[key] for key in ("title", "summary", "body", "tags", "customFields", "priority", "lifecycleState") if key in value}}
        normalized = self._validate_content(merged)
        priority = merged.get("priority")
        lifecycle = merged.get("lifecycleState")
        if type(priority) is not int or not 0 <= priority <= 100 or lifecycle not in {"active", "aging", "archived"}:
            raise KnowledgeV3Error("KNOWLEDGE_ITEM_INVALID", "Knowledge priority or lifecycle is invalid.")
        now = utc_now()
        with self._lock, self._connect() as db:
            db.execute(
                "UPDATE v3_knowledge_items SET title=?,summary=?,body=?,tags_json=?,custom_fields_json=?,priority=?,lifecycle_state=?,revision=revision+1,updated_at=? WHERE item_id=? AND revision=?",
                (normalized["title"], normalized["summary"], normalized["body"], self._dump(normalized["tags"]),
                 self._dump(normalized["customFields"]), priority, lifecycle, now, item_id, current["revision"]),
            )
        return self.get_item(item_id)

    def delete_item(self, item_id: str) -> dict[str, Any]:
        self.get_item(item_id)
        with self._lock, self._connect() as db:
            db.execute("DELETE FROM v3_knowledge_items WHERE item_id=?", (item_id,))
        return {"itemId": item_id, "deleted": True, "deletionScope": "local_single_store"}

    @staticmethod
    def _validate_content(value: dict[str, Any], *, require_context: bool = False) -> dict[str, Any]:
        title = " ".join(str(value.get("title") or "").split()).strip()
        summary = str(value.get("summary") or "").strip()
        body = str(value.get("body") or "").strip()
        tags = value.get("tags", [])
        custom = value.get("customFields", {})
        refs = value.get("sourceRefs")
        provenance = value.get("provenance", {})
        context_hash = value.get("createdFromContextHash", "")
        if not title or len(title) > 240 or not body or len(body) > 100_000 or len(summary) > 4_000:
            raise KnowledgeV3Error("KNOWLEDGE_CONTENT_INVALID", "Knowledge title, summary, or body is invalid.")
        if not isinstance(tags, list) or len(tags) > 32 or any(not isinstance(tag, str) or not tag.strip() or len(tag) > 64 for tag in tags):
            raise KnowledgeV3Error("KNOWLEDGE_CONTENT_INVALID", "Knowledge tags are invalid.")
        tags = list(dict.fromkeys(tag.strip() for tag in tags))
        if not isinstance(custom, dict) or len(custom) > 32 or any(not isinstance(key, str) or not key or not isinstance(item, str) or len(item) > 2_000 for key, item in custom.items()):
            raise KnowledgeV3Error("KNOWLEDGE_CONTENT_INVALID", "Knowledge custom fields are invalid.")
        if not isinstance(refs, list) or not refs or any(not isinstance(ref, dict) for ref in refs):
            raise KnowledgeV3Error("KNOWLEDGE_SOURCE_REQUIRED", "At least one source reference is required.")
        for ref in refs:
            url = ref.get("url")
            if not isinstance(url, str) or urlparse(url).scheme not in {"http", "https"}:
                raise KnowledgeV3Error("KNOWLEDGE_SOURCE_INVALID", "Knowledge source URL is invalid.")
        if require_context and (not isinstance(context_hash, str) or len(context_hash) != 64):
            raise KnowledgeV3Error("KNOWLEDGE_CONTEXT_INVALID", "Knowledge context hash is invalid.")
        if not isinstance(provenance, dict):
            raise KnowledgeV3Error("KNOWLEDGE_CONTENT_INVALID", "Knowledge provenance is invalid.")
        return {"title": title, "summary": summary, "body": body, "tags": tags, "customFields": custom,
                "sourceRefs": refs, "provenance": provenance, "createdFromContextHash": context_hash}

    @staticmethod
    def _dump(value: Any) -> str:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

    @staticmethod
    def _draft(row: sqlite3.Row) -> dict[str, Any]:
        return {"schemaVersion": "v3-knowledge-draft/v1", "draftId": row["draft_id"], "state": row["state"],
                "sourceRefs": json.loads(row["source_refs_json"]), "title": row["title"], "summary": row["summary"],
                "body": row["body"], "tags": json.loads(row["tags_json"]), "customFields": json.loads(row["custom_fields_json"]),
                "provenance": json.loads(row["provenance_json"]), "createdFromContextHash": row["context_hash"],
                "revision": row["revision"], "itemId": row["item_id"], "createdAt": row["created_at"], "updatedAt": row["updated_at"]}

    @staticmethod
    def _item(row: sqlite3.Row) -> dict[str, Any]:
        return {"schemaVersion": "v3-knowledge-item/v1", "itemId": row["item_id"],
                "sourceRefs": json.loads(row["source_refs_json"]), "title": row["title"], "summary": row["summary"],
                "body": row["body"], "tags": json.loads(row["tags_json"]), "customFields": json.loads(row["custom_fields_json"]),
                "priority": row["priority"], "lifecycleState": row["lifecycle_state"], "revision": row["revision"],
                "createdAt": row["created_at"], "updatedAt": row["updated_at"]}
