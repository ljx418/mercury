from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any

from ..outline import canonical_hash
from ..task_store import MediaTaskStore, MediaTaskStoreError


_SENTENCE_SPLIT = re.compile(r"(?<=[。！？!?；;])\s*|\n+")
_LATIN_TOKEN = re.compile(r"[A-Za-z0-9_]{2,}")
_TRANSITION_PREFIX = re.compile(
    r"^(?:首先|第一|其次|第二|然后|接下来|随后|另一方面|最后|最终|总结|结论|这里|现在|我们(?:先|再|来|看))"
)
_VISUAL_KINDS = {"frame", "ocr_block", "vision_caption"}


def _stable_id(prefix: str, *parts: object, length: int) -> str:
    digest = hashlib.sha256("\x1f".join(str(part) for part in parts).encode("utf-8")).hexdigest()
    return f"{prefix}_{digest[:length]}"


def _clean(value: object) -> str:
    return " ".join(str(value or "").split()).strip()


def _sentences(text: str) -> list[str]:
    result: list[str] = []
    for value in _SENTENCE_SPLIT.split(_clean(text)):
        sentence = value.strip(" ，,。！？!?；;：:")
        if len(sentence) >= 4 and sentence not in result:
            result.append(sentence)
    return result


def _tokens(text: str) -> set[str]:
    normalized = re.sub(r"\s+", "", text.lower())
    chinese = "".join(re.findall(r"[\u4e00-\u9fff]", normalized))
    grams = {chinese[index:index + 2] for index in range(max(0, len(chinese) - 1))}
    return grams | set(_LATIN_TOKEN.findall(normalized))


def _jaccard(left: set[str], right: set[str]) -> float:
    union = left | right
    return len(left & right) / len(union) if union else 1.0


class MediaComprehensionService:
    """Builds one local, deterministic, evidence-closed workspace projection."""

    def __init__(self, store: MediaTaskStore, private_evidence_root: str | Path) -> None:
        self._store = store
        self._private_root = Path(private_evidence_root).resolve()

    def get(self, task_id: str, expected_revision: int | None = None) -> dict[str, Any]:
        task = self._store.get(task_id)
        if expected_revision is not None and task["revision"] != expected_revision:
            raise MediaTaskStoreError("TASK_REVISION_CONFLICT", "Task revision changed.", status=409)
        bundle = task.get("projections")
        if task["state"] not in {"ready", "degraded"} or not isinstance(bundle, dict) or not bundle.get("outline"):
            raise MediaTaskStoreError("V351_TASK_NOT_READY", "Workspace comprehension requires a published media task.", status=409)
        catalog = bundle.get("evidenceCatalog")
        if not isinstance(catalog, list) or not catalog:
            raise MediaTaskStoreError("V351_EVIDENCE_REQUIRED", "Workspace comprehension requires evidence.", status=409)
        evidence = [self._evidence_with_text(item) for item in catalog]
        ordered = sorted(evidence, key=lambda item: (item["timestampStartMs"], item["timestampEndMs"], item["evidenceId"]))
        duration_ms = max(item["timestampEndMs"] for item in ordered)
        chapters = self._chapters(task_id, task["revision"], ordered, duration_ms)
        outline_id = _stable_id(
            "outline", task_id, task["revision"], "comprehension-v1",
            canonical_hash([{key: item[key] for key in ("evidenceId", "contentSha256") } for item in ordered]),
            length=32,
        )
        title = _clean(bundle["outline"].get("title")) or task["sourceIdentity"].split(":")[2]
        outline = {
            "outlineId": outline_id,
            "taskId": task_id,
            "taskRevision": task["revision"],
            "title": title[:240],
            "summary": " ".join(chapter["thesis"] for chapter in chapters)[:4000],
            "chapters": chapters,
        }
        outline["contentSha256"] = canonical_hash(outline)
        timeline = self._timeline(outline_id, chapters, ordered)
        mindmap = self._mindmap(outline_id, task_id, title, chapters)
        public_catalog = [
            {
                **{key: item[key] for key in (
                    "evidenceId", "taskId", "kind", "timestampStartMs", "timestampEndMs",
                    "contentSha256", "relativeArtifactRef",
                )},
                "thumbnailAvailable": bool(item.get("thumbnailRelativeRef")),
                "excerpt": item["text"][:280],
            }
            for item in ordered
        ]
        return {
            "schemaVersion": "v3-media-workspace-comprehension-projection/v1",
            "task": {
                "taskId": task_id,
                "taskRevision": task["revision"],
                "sourceIdentity": task["sourceIdentity"],
                "mediaDurationMs": duration_ms,
                "outlineId": outline_id,
            },
            "authorization": {
                "groundedTextCloudStatus": "disabled",
                "providerId": None,
                "modelId": None,
                "outboundDerivedTextSha256": None,
                "rawMediaUploadCount": 0,
            },
            "evidenceCatalog": public_catalog,
            "outline": outline,
            "timeline": timeline,
            "mindmap": mindmap,
        }

    def thumbnail(self, task_id: str, evidence_id: str) -> Path:
        task = self._store.get(task_id)
        bundle = task.get("projections") or {}
        item = next((value for value in bundle.get("evidenceCatalog", []) if value.get("evidenceId") == evidence_id), None)
        if not item or item.get("kind") != "frame":
            raise MediaTaskStoreError("V351_THUMBNAIL_NOT_FOUND", "Frame thumbnail was not found.", status=404)
        metadata = self._read_metadata(item)
        relative = metadata.get("thumbnailRelativeRef")
        if not isinstance(relative, str):
            raise MediaTaskStoreError("V351_THUMBNAIL_NOT_FOUND", "Frame thumbnail was not retained.", status=404)
        target = (self._private_root / relative).resolve()
        if self._private_root not in target.parents or not target.is_file() or target.suffix.lower() != ".png":
            raise MediaTaskStoreError("V351_THUMBNAIL_NOT_FOUND", "Frame thumbnail is unavailable.", status=404)
        return target

    def _evidence_with_text(self, item: dict[str, Any]) -> dict[str, Any]:
        if item.get("taskId") is None:
            raise MediaTaskStoreError("V351_EVIDENCE_ORPHAN", "Evidence task binding is missing.", status=409)
        metadata = self._read_metadata(item)
        text = _clean(metadata.get("text"))
        if not text:
            raise MediaTaskStoreError("V351_EVIDENCE_REQUIRED", "Evidence text is unavailable.", status=409)
        return {**item, "text": text, "thumbnailRelativeRef": metadata.get("thumbnailRelativeRef")}

    def _read_metadata(self, item: dict[str, Any]) -> dict[str, Any]:
        target = (self._private_root / str(item.get("relativeArtifactRef", ""))).resolve()
        if self._private_root not in target.parents or not target.is_file():
            raise MediaTaskStoreError("V351_EVIDENCE_UNAVAILABLE", "Private evidence is unavailable.", status=409)
        try:
            value = json.loads(target.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise MediaTaskStoreError("V351_EVIDENCE_UNAVAILABLE", "Private evidence metadata is invalid.", status=409) from error
        if not isinstance(value, dict) or value.get("contentSha256") != item.get("contentSha256"):
            raise MediaTaskStoreError("V351_EVIDENCE_HASH_MISMATCH", "Private evidence metadata changed.", status=409)
        return value

    def _chapters(
        self,
        task_id: str,
        revision: int,
        evidence: list[dict[str, Any]],
        duration_ms: int,
    ) -> list[dict[str, Any]]:
        transcript = [item for item in evidence if item["kind"] == "transcript"]
        units = self._transcript_units(transcript or evidence)
        count = len(units)
        target_count = min(12, count, max(1, round(math.sqrt(count))))
        if count >= 3:
            target_count = max(3, target_count)
        boundary_scores: list[tuple[float, int]] = []
        for index in range(1, count):
            previous, current = units[index - 1], units[index]
            similarity = _jaccard(_tokens(previous["text"]), _tokens(current["text"]))
            gap = max(0, current["timestampStartMs"] - previous["timestampEndMs"])
            cue = 1.5 if _TRANSITION_PREFIX.search(current["text"]) else 0.0
            score = (1.0 - similarity) * 4.0 + min(2.0, gap / 10_000) + cue
            boundary_scores.append((score, index))
        selected = {index for _, index in sorted(boundary_scores, key=lambda item: (-item[0], item[1]))[: max(0, target_count - 1)]}
        boundaries = [0, *sorted(selected), count]
        chapters = []
        for order, (start, end) in enumerate(zip(boundaries, boundaries[1:])):
            items = units[start:end]
            key_points = self._key_points(items)
            title = self._chapter_title(items, key_points, order)
            start_ms = items[0]["timestampStartMs"]
            end_ms = min(duration_ms, max(item["timestampEndMs"] for item in items))
            if end_ms <= start_ms:
                end_ms = min(duration_ms, start_ms + 1)
            attached = [
                item for item in evidence
                if item["timestampStartMs"] < end_ms and item["timestampEndMs"] > start_ms
            ]
            if not attached:
                attached = [min(evidence, key=lambda item: abs(item["timestampStartMs"] - start_ms))]
            midpoint = start_ms + (end_ms - start_ms) // 2
            frames = [item for item in attached if item["kind"] == "frame"]
            representative = min(frames, key=lambda item: abs(item["timestampStartMs"] - midpoint))["evidenceId"] if frames else None
            chapter_id = _stable_id("chapter", task_id, revision, order, start_ms, end_ms, length=16)
            evidence_ids = list(dict.fromkeys(item["evidenceId"] for item in attached))
            chapters.append({
                "chapterId": chapter_id,
                "parentChapterId": None,
                "depth": 1,
                "order": order,
                "startMs": start_ms,
                "endMs": end_ms,
                "title": title,
                "thesis": "；".join(key_points[:2])[:1000],
                "keyPoints": key_points,
                "evidenceIds": evidence_ids,
                "representativeFrameEvidenceId": representative,
            })
        return chapters

    @staticmethod
    def _transcript_units(evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
        units: list[dict[str, Any]] = []
        for item in evidence:
            sentences = _sentences(item["text"])
            if len(sentences) < 3 and len(item["text"]) >= 18:
                text = _clean(item["text"])
                width = max(6, math.ceil(len(text) / 3))
                sentences = [text[index:index + width] for index in range(0, len(text), width)]
            sentences = sentences or [item["text"]]
            span = max(1, item["timestampEndMs"] - item["timestampStartMs"])
            for index, sentence in enumerate(sentences):
                start_ms = item["timestampStartMs"] + round(span * index / len(sentences))
                end_ms = item["timestampStartMs"] + round(span * (index + 1) / len(sentences))
                units.append({
                    **item,
                    "timestampStartMs": start_ms,
                    "timestampEndMs": max(start_ms + 1, end_ms),
                    "text": sentence,
                })
        return sorted(units, key=lambda item: (item["timestampStartMs"], item["timestampEndMs"], item["evidenceId"]))

    @staticmethod
    def _key_points(items: list[dict[str, Any]]) -> list[str]:
        candidates: list[str] = []
        for item in items:
            for sentence in _sentences(item["text"]):
                normalized = _TRANSITION_PREFIX.sub("", sentence).strip(" ，,：:")
                if normalized and normalized not in candidates:
                    candidates.append(normalized[:180])
        if not candidates:
            candidates.append(_clean(items[0]["text"])[:180])
        group_tokens = Counter(token for item in items for token in _tokens(item["text"]))
        candidates.sort(key=lambda sentence: (-sum(group_tokens[token] for token in _tokens(sentence)), len(sentence)))
        return candidates[:4]

    @staticmethod
    def _chapter_title(items: list[dict[str, Any]], key_points: list[str], order: int) -> str:
        visual = next((item for item in items if item["kind"] in _VISUAL_KINDS), None)
        sentence = key_points[0] if key_points else _clean(items[0]["text"])
        sentence = re.sub(r"^(?:这个|这里|视频|我们)", "", sentence).strip(" ，,：:")
        if len(sentence) > 26:
            clause = re.split(r"[，,：:（(]", sentence, maxsplit=1)[0]
            sentence = clause if len(clause) >= 6 else sentence[:26]
        suffix = "与画面" if visual and len(sentence) <= 20 else ""
        return (sentence + suffix or f"主题 {order + 1}")[:40]

    @staticmethod
    def _timeline(outline_id: str, chapters: list[dict[str, Any]], evidence: list[dict[str, Any]]) -> dict[str, Any]:
        evidence_by_id = {item["evidenceId"]: item for item in evidence}
        moments: list[dict[str, Any]] = []
        for chapter in chapters:
            first_evidence = evidence_by_id[chapter["evidenceIds"][0]]
            moments.append({
                "momentId": _stable_id("moment", outline_id, chapter["chapterId"], "chapter", length=16),
                "chapterId": chapter["chapterId"], "timestampMs": chapter["startMs"], "kind": "chapter",
                "title": chapter["title"], "evidenceIds": [first_evidence["evidenceId"]], "frameEvidenceId": None,
            })
            for index, point in enumerate(chapter["keyPoints"][:2]):
                source = evidence_by_id[chapter["evidenceIds"][min(index, len(chapter["evidenceIds"]) - 1)]]
                point_count = min(2, len(chapter["keyPoints"]))
                semantic_timestamp = chapter["startMs"] + round(
                    (chapter["endMs"] - chapter["startMs"]) * (index + 1) / (point_count + 1)
                )
                moments.append({
                    "momentId": _stable_id("moment", outline_id, chapter["chapterId"], "point", index, length=16),
                    "chapterId": chapter["chapterId"], "timestampMs": semantic_timestamp, "kind": "key_point",
                    "title": point[:120], "evidenceIds": [source["evidenceId"]], "frameEvidenceId": None,
                })
            frame_id = chapter["representativeFrameEvidenceId"]
            if frame_id:
                frame = evidence_by_id[frame_id]
                moments.append({
                    "momentId": _stable_id("moment", outline_id, chapter["chapterId"], "frame", length=16),
                    "chapterId": chapter["chapterId"], "timestampMs": frame["timestampStartMs"], "kind": "frame",
                    "title": f"{chapter['title']}代表画面", "evidenceIds": [frame_id], "frameEvidenceId": frame_id,
                })
        result = {
            "projectionId": _stable_id("timeline", outline_id, length=32),
            "outlineId": outline_id,
            "chapterIds": [chapter["chapterId"] for chapter in chapters],
            "moments": sorted(moments, key=lambda item: (item["timestampMs"], item["momentId"])),
        }
        result["contentSha256"] = canonical_hash(result)
        return result

    @staticmethod
    def _mindmap(outline_id: str, task_id: str, title: str, chapters: list[dict[str, Any]]) -> dict[str, Any]:
        root_id = _stable_id("node", outline_id, "root", length=16)
        nodes: list[dict[str, Any]] = [{
            "nodeId": root_id, "parentNodeId": None, "depth": 0, "kind": "root", "label": title,
            "chapterId": None, "timestampMs": None, "evidenceIds": [],
        }]
        for chapter in chapters:
            chapter_node_id = _stable_id("node", outline_id, chapter["chapterId"], length=16)
            nodes.append({
                "nodeId": chapter_node_id, "parentNodeId": root_id, "depth": 1, "kind": "chapter",
                "label": chapter["title"], "chapterId": chapter["chapterId"], "timestampMs": chapter["startMs"],
                "evidenceIds": chapter["evidenceIds"],
            })
            for index, key_point in enumerate(chapter["keyPoints"]):
                nodes.append({
                    "nodeId": _stable_id("node", outline_id, chapter["chapterId"], "point", index, length=16),
                    "parentNodeId": chapter_node_id, "depth": 2, "kind": "key_point", "label": key_point,
                    "chapterId": chapter["chapterId"], "timestampMs": chapter["startMs"],
                    "evidenceIds": chapter["evidenceIds"][:1],
                })
        result = {
            "projectionId": _stable_id("mindmap", outline_id, task_id, length=32),
            "outlineId": outline_id,
            "nodes": nodes,
        }
        result["contentSha256"] = canonical_hash(result)
        return result
