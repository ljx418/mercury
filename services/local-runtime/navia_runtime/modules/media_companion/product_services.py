from __future__ import annotations

import hashlib
import io
import json
import re
import sqlite3
import zipfile
from copy import deepcopy
from pathlib import Path
from threading import RLock
from typing import Any

from .outline import canonical_bytes
from .task_store import MediaTaskStore, MediaTaskStoreError, utc_now


_VISUAL_TERMS = ("画面", "屏幕", "显示", "人物", "图像", "截图", "视觉")
_BROAD_QUESTIONS = ("概括开头", "总结开头", "开头内容")
_CROSS_CHAPTER_TERMS = ("各章", "跨章节", "前后", "整体", "关系", "如何关联", "比较", "分别", "从开头到结尾")
_TOKEN = re.compile(r"[\u4e00-\u9fff]{2,}|[A-Za-z0-9_]{2,}")


class MediaAskService:
    """Low-resource evidence-grounded Ask provider with durable deterministic results."""

    def __init__(self, store: MediaTaskStore, private_evidence_root: str | Path) -> None:
        self._store = store
        self._private_root = Path(private_evidence_root).resolve()
        self._lock = RLock()
        self._conn = sqlite3.connect(store.db_path, check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS media_ask_results(
                answer_id TEXT PRIMARY KEY, task_id TEXT NOT NULL, task_revision INTEGER NOT NULL,
                question TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL,
                UNIQUE(task_id, task_revision, question),
                FOREIGN KEY(task_id) REFERENCES media_tasks(task_id)
            )
            """
        )

    def ask(self, task_id: str, expected_revision: int, question: str) -> dict[str, Any]:
        normalized = " ".join(question.split()).strip() if isinstance(question, str) else ""
        if not normalized or len(normalized) > 500:
            raise MediaTaskStoreError("ASK_QUESTION_INVALID", "Question must contain 1 to 500 characters.")
        task = self._store.get(task_id)
        if task["revision"] != expected_revision:
            raise MediaTaskStoreError("TASK_REVISION_CONFLICT", "Task revision changed.", status=409)
        if task["state"] not in {"ready", "degraded"} or not task.get("projections"):
            raise MediaTaskStoreError("ASK_TASK_NOT_READY", "Task evidence is not ready.", status=409)
        with self._lock:
            prior = self._conn.execute(
                "SELECT result_json FROM media_ask_results WHERE task_id=? AND task_revision=? AND question=?",
                (task_id, expected_revision, normalized),
            ).fetchone()
            if prior:
                return json.loads(prior["result_json"])

        catalog = task["projections"]["evidenceCatalog"]
        category = self._category(normalized)
        visual = category == "visual"
        cross_chapter = category == "cross_chapter"
        allowed_kinds = {"frame", "ocr_block", "vision_caption"} if visual else {"transcript", "ocr_block", "vision_caption"}
        candidates = []
        for item in catalog:
            if item["kind"] not in allowed_kinds:
                continue
            text = self._read_text(item)
            score = self._score(normalized, text)
            if score >= 4 or visual or cross_chapter or (not visual and any(intent in normalized for intent in _BROAD_QUESTIONS)):
                candidates.append((score, item, text))
        candidates.sort(key=lambda value: (-value[0], value[1]["timestampStartMs"], value[1]["evidenceId"]))
        if cross_chapter and len(candidates) < 2:
            candidates = []

        created_at = utc_now()
        digest = hashlib.sha256(f"{task_id}:{expected_revision}:{normalized}".encode()).hexdigest()[:16]
        retrieval_plan = {
            "category": category,
            "allowedKinds": sorted(allowed_kinds),
            "candidateEvidenceIds": [value[1]["evidenceId"] for value in candidates],
            "executionMode": "local_deterministic",
        }
        retrieval_plan_sha256 = hashlib.sha256(canonical_bytes(retrieval_plan)).hexdigest()
        if not candidates:
            result = {
                "answerId": f"answer_{digest}", "taskId": task_id, "taskRevision": expected_revision,
                "question": normalized, "answer": "", "evidenceIds": [], "status": "insufficient_evidence",
                "failureCode": "ASK_EVIDENCE_INSUFFICIENT", "createdAt": created_at,
                "category": category, "answerBlocks": [], "retrievalPlanSha256": retrieval_plan_sha256,
                "executionMode": "local_deterministic",
            }
        else:
            selected = self._select(candidates, cross_chapter=cross_chapter)
            answer_blocks = [
                {
                    "text": self._best_sentence(normalized, value[2]),
                    "evidenceIds": [value[1]["evidenceId"]],
                    "timestampMs": value[1]["timestampStartMs"],
                }
                for value in selected
            ]
            answer = "；".join(block["text"].rstrip("。；") for block in answer_blocks).strip()[:1600]
            result = {
                "answerId": f"answer_{digest}", "taskId": task_id, "taskRevision": expected_revision,
                "question": normalized, "answer": answer,
                "evidenceIds": [value[1]["evidenceId"] for value in selected],
                "status": "answered", "failureCode": None, "createdAt": created_at,
                "category": category, "answerBlocks": answer_blocks,
                "retrievalPlanSha256": retrieval_plan_sha256, "executionMode": "local_deterministic",
            }
        payload = canonical_bytes(result).decode("utf-8")
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT OR IGNORE INTO media_ask_results VALUES (?,?,?,?,?,?)",
                (result["answerId"], task_id, expected_revision, normalized, payload, created_at),
            )
            stored = self._conn.execute(
                "SELECT result_json FROM media_ask_results WHERE task_id=? AND task_revision=? AND question=?",
                (task_id, expected_revision, normalized),
            ).fetchone()
        return json.loads(stored["result_json"])

    def list_results(self, task_id: str, revision: int) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT result_json FROM media_ask_results WHERE task_id=? AND task_revision=? ORDER BY answer_id",
                (task_id, revision),
            ).fetchall()
        return [json.loads(row["result_json"]) for row in rows]

    def _read_text(self, evidence: dict[str, Any]) -> str:
        target = (self._private_root / evidence["relativeArtifactRef"]).resolve()
        if self._private_root not in target.parents or not target.is_file():
            raise MediaTaskStoreError("ASK_EVIDENCE_UNAVAILABLE", "Private evidence is unavailable.", status=409)
        raw = target.read_bytes()
        if hashlib.sha256(raw).hexdigest() == evidence["contentSha256"]:
            return raw.decode("utf-8", errors="replace")
        value = json.loads(raw)
        text = value.get("text") if isinstance(value, dict) else None
        if not isinstance(text, str) or hashlib.sha256(text.encode()).hexdigest() != evidence["contentSha256"]:
            raise MediaTaskStoreError("ASK_EVIDENCE_HASH_MISMATCH", "Private evidence hash mismatch.", status=409)
        return text

    @staticmethod
    def _score(question: str, text: str) -> int:
        q_tokens = MediaAskService._tokens(question)
        t = text.lower()
        return sum(3 if len(token) >= 3 else 1 for token in q_tokens if token in t)

    @staticmethod
    def _tokens(value: str) -> set[str]:
        normalized = value.lower()
        tokens = set(_TOKEN.findall(normalized))
        chinese = "".join(re.findall(r"[\u4e00-\u9fff]", normalized))
        tokens.update(chinese[index:index + 2] for index in range(max(0, len(chinese) - 1)))
        return tokens

    @staticmethod
    def _category(question: str) -> str:
        if any(term in question for term in _VISUAL_TERMS):
            return "visual"
        if any(term in question for term in _CROSS_CHAPTER_TERMS):
            return "cross_chapter"
        return "factual"

    @staticmethod
    def _select(candidates: list[tuple[int, dict[str, Any], str]], *, cross_chapter: bool) -> list[tuple[int, dict[str, Any], str]]:
        if not cross_chapter:
            return candidates[:2]
        selected: list[tuple[int, dict[str, Any], str]] = []
        buckets: set[int] = set()
        maximum_time = max(value[1]["timestampEndMs"] for value in candidates) or 1
        for candidate in candidates:
            bucket = min(2, int(candidate[1]["timestampStartMs"] * 3 / maximum_time))
            if bucket not in buckets:
                selected.append(candidate)
                buckets.add(bucket)
            if len(selected) == 3:
                break
        if len(selected) < 2:
            for candidate in candidates:
                if candidate not in selected:
                    selected.append(candidate)
                if len(selected) == 2:
                    break
        return selected

    @staticmethod
    def _best_sentence(question: str, text: str) -> str:
        sentences = [item.strip() for item in re.split(r"(?<=[。！？!?；;])", text) if item.strip()]
        if not sentences:
            return text[:360]
        q_tokens = MediaAskService._tokens(question)
        ranked = sorted(
            sentences,
            key=lambda sentence: (-sum(token in sentence.lower() for token in q_tokens), len(sentence)),
        )
        return ranked[0][:360]


class MediaExportService:
    FORMATS = {"json_bundle", "markdown_zip"}

    def __init__(
        self,
        store: MediaTaskStore,
        asks: MediaAskService,
        export_root: str | Path,
        comprehension: Any | None = None,
    ) -> None:
        self._store = store
        self._asks = asks
        self._root = Path(export_root).resolve()
        self._comprehension = comprehension

    def create(self, task_id: str, expected_revision: int, format_name: str) -> dict[str, Any]:
        if format_name not in self.FORMATS:
            raise MediaTaskStoreError("EXPORT_FORMAT_INVALID", "Unsupported export format.")
        task = self._store.get(task_id)
        if task["revision"] != expected_revision:
            raise MediaTaskStoreError("TASK_REVISION_CONFLICT", "Task revision changed.", status=409)
        if task["state"] not in {"ready", "degraded"} or not task.get("projections"):
            raise MediaTaskStoreError("EXPORT_TASK_NOT_READY", "Task is not exportable.", status=409)
        asks = self._asks.list_results(task_id, expected_revision)
        export_id = "export_" + hashlib.sha256(f"{task_id}:{expected_revision}:{format_name}".encode()).hexdigest()[:16]
        directory = self._root / task_id
        directory.mkdir(parents=True, exist_ok=True)
        if format_name == "json_bundle":
            members = {"bundle.json": canonical_bytes(self._bundle(task, asks))}
            artifact = members["bundle.json"]
            filename = f"{export_id}.json"
        else:
            members = self._markdown_members(task, asks)
            artifact = self._zip(members)
            filename = f"{export_id}.zip"
        member_index = [
            {"name": name, "byteLength": len(value), "sha256": hashlib.sha256(value).hexdigest()}
            for name, value in sorted(members.items())
        ]
        path = directory / filename
        path.write_bytes(artifact)
        manifest = {
            "exportId": export_id, "taskId": task_id, "taskRevision": expected_revision,
            "format": format_name, "filename": filename, "artifactSha256": hashlib.sha256(artifact).hexdigest(),
            "memberIndex": member_index, "memberIndexSha256": hashlib.sha256(canonical_bytes(member_index)).hexdigest(),
            "byteLength": len(artifact), "createdAt": task["updatedAt"],
            "knowledgeImportStatus": "deferred_to_v4",
        }
        (directory / f"{export_id}.manifest.json").write_bytes(canonical_bytes(manifest))
        return deepcopy(manifest)

    def artifact(self, task_id: str, export_id: str) -> tuple[Path, str]:
        if not re.fullmatch(r"export_[a-f0-9]{16}", export_id):
            raise MediaTaskStoreError("EXPORT_NOT_FOUND", "Export artifact was not found.", status=404)
        directory = (self._root / task_id).resolve()
        for suffix, media_type in ((".json", "application/json"), (".zip", "application/zip")):
            target = (directory / f"{export_id}{suffix}").resolve()
            if directory in target.parents and target.is_file():
                return target, media_type
        raise MediaTaskStoreError("EXPORT_NOT_FOUND", "Export artifact was not found.", status=404)

    def _bundle(self, task: dict[str, Any], asks: list[dict[str, Any]]) -> dict[str, Any]:
        projections = task["projections"]
        comprehension = self._comprehension.get(task["taskId"], task["revision"]) if self._comprehension else None
        return {
            "schemaVersion": "v3-media-local-export/v2" if comprehension else "v3-media-local-export/v1",
            "taskId": task["taskId"],
            "taskRevision": task["revision"], "sourceIdentity": task["sourceIdentity"],
            "knowledgeImportStatus": "deferred_to_v4",
            "groundedTextCloudStatus": "disabled",
            "outline": comprehension["outline"] if comprehension else projections["outline"],
            "timeline": comprehension["timeline"] if comprehension else projections["timeline"],
            "mindmap": comprehension["mindmap"] if comprehension else projections["mindmap"],
            "evidenceIndex": comprehension["evidenceCatalog"] if comprehension else projections["evidenceCatalog"],
            "askResults": asks,
        }

    def _markdown_members(self, task: dict[str, Any], asks: list[dict[str, Any]]) -> dict[str, bytes]:
        bundle = self._bundle(task, asks)
        outline = bundle["outline"]
        lines = [f"# {outline['title']}", "", outline["summary"], ""]
        for section in outline.get("chapters", outline.get("sections", [])):
            summary = section.get("thesis", section.get("summary", ""))
            lines.extend((f"## {section['title']}", "", summary, ""))
            for point in section.get("keyPoints", []):
                lines.append(f"- {point}")
            if section.get("keyPoints"):
                lines.append("")
        readme = "# Navia Media Export\n\n本地导出，不代表已保存到知识库。知识导入将在 V4 提供。\n"
        return {
            "README.md": readme.encode(), "outline.md": "\n".join(lines).encode(),
            "timeline.json": canonical_bytes(bundle["timeline"]), "mindmap.json": canonical_bytes(bundle["mindmap"]),
            "asks.json": canonical_bytes(asks), "evidence-index.json": canonical_bytes(bundle["evidenceIndex"]),
        }

    @staticmethod
    def _zip(members: dict[str, bytes]) -> bytes:
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, value in sorted(members.items()):
                info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o600 << 16
                archive.writestr(info, value)
        return output.getvalue()
