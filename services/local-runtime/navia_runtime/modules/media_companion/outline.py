from __future__ import annotations

import hashlib
import json
import math
import re
from collections import defaultdict
from typing import Any


TASK_ID_RE = re.compile(r"^media_task_[a-f0-9]{32}$")
EVIDENCE_ID_RE = re.compile(r"^(?:mev|mtr)_[a-f0-9]{32}$")
TERMINAL_STATES = {"ready", "degraded", "blocked", "failed", "cancelled"}
PUBLISHABLE_STATES = {"ready", "degraded"}


class MediaOutlineError(RuntimeError):
    def __init__(self, code: str, message: str, *, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def canonical_hash(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def _stable_id(prefix: str, *parts: object, length: int) -> str:
    digest = hashlib.sha256("\x1f".join(str(part) for part in parts).encode("utf-8")).hexdigest()
    return f"{prefix}_{digest[:length]}"


def _clean_text(value: object) -> str:
    return " ".join(str(value or "").split()).strip()


def _title(text: str, fallback: str) -> str:
    candidate = re.split(r"[。！？!?；;\n]", text, maxsplit=1)[0].strip()
    return (candidate or fallback)[:80]


def _safe_relative_ref(value: str) -> bool:
    if not value or value.startswith("/") or "\\" in value:
        return False
    return all(part not in {"", ".."} for part in value.split("/"))


class DeterministicExtractiveOutlineGenerator:
    """Builds one evidence-grounded outline without any model or network call."""

    def __init__(self, *, max_sections: int = 12, minimum_window_ms: int = 60_000) -> None:
        self.max_sections = max_sections
        self.minimum_window_ms = minimum_window_ms

    def generate(
        self,
        *,
        task_id: str,
        source_identity: str,
        revision: int,
        source_title: str,
        evidence: list[dict[str, Any]],
        state: str = "ready",
        terminal_failure_code: str | None = None,
    ) -> dict[str, Any]:
        if state not in PUBLISHABLE_STATES or not evidence:
            raise MediaOutlineError("OUTLINE_EVIDENCE_REQUIRED", "Publishable outlines require real evidence.")
        ordered = sorted(evidence, key=lambda item: (item["timestampStartMs"], item["timestampEndMs"], item["evidenceId"]))
        self._validate_private_evidence(task_id, ordered)
        max_end = max(int(item["timestampEndMs"]) for item in ordered)
        window_ms = max(self.minimum_window_ms, math.ceil(max_end / self.max_sections))
        groups: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for item in ordered:
            groups[int(item["timestampStartMs"]) // window_ms].append(item)

        outline_id = _stable_id("outline", task_id, revision, canonical_hash([
            {key: item[key] for key in ("evidenceId", "contentSha256", "timestampStartMs", "timestampEndMs")}
            for item in ordered
        ]), length=32)
        sections = []
        for sequence, (_, items) in enumerate(sorted(groups.items())):
            texts = []
            for item in items:
                text = _clean_text(item.get("text"))
                if text and text not in texts:
                    texts.append(text)
            if not texts:
                raise MediaOutlineError("OUTLINE_EVIDENCE_REQUIRED", "Evidence text is unavailable for extraction.")
            summary = " ".join(texts)[:2000]
            start_ms = min(int(item["timestampStartMs"]) for item in items)
            end_ms = max(int(item["timestampEndMs"]) for item in items)
            if end_ms <= start_ms:
                end_ms = start_ms + 1
            sections.append({
                "sectionId": _stable_id("section", outline_id, sequence, length=16),
                "title": _title(texts[0], f"片段 {sequence + 1}"),
                "summary": summary,
                "startMs": start_ms,
                "endMs": end_ms,
                "evidenceIds": [item["evidenceId"] for item in items],
            })

        normalized_title = _clean_text(source_title)[:240] or source_identity.split(":")[2][:240]
        outline = {
            "outlineId": outline_id,
            "taskId": task_id,
            "taskRevision": revision,
            "title": normalized_title,
            "summary": " ".join(section["summary"] for section in sections)[:4000],
            "sections": sections,
        }
        outline["contentSha256"] = canonical_hash(outline)
        timeline = [
            {
                "segmentId": _stable_id("timeline", outline_id, index, length=16),
                "outlineId": outline_id,
                "sectionId": section["sectionId"],
                "sequence": index,
                "startMs": section["startMs"],
                "endMs": section["endMs"],
                "evidenceIds": list(section["evidenceIds"]),
            }
            for index, section in enumerate(sections)
        ]
        root_id = _stable_id("node", outline_id, "root", length=16)
        nodes = [{
            "nodeId": root_id,
            "parentNodeId": None,
            "sectionId": None,
            "label": normalized_title,
            "evidenceIds": [],
        }]
        nodes.extend({
            "nodeId": _stable_id("node", outline_id, section["sectionId"], length=16),
            "parentNodeId": root_id,
            "sectionId": section["sectionId"],
            "label": section["title"],
            "evidenceIds": list(section["evidenceIds"]),
        } for section in sections)
        mindmap = {
            "projectionId": _stable_id("mindmap", outline_id, length=32),
            "outlineId": outline_id,
            "taskId": task_id,
            "nodes": nodes,
        }
        mindmap["contentSha256"] = canonical_hash(mindmap)
        public_evidence = [
            {key: item[key] for key in (
                "evidenceId", "taskId", "kind", "timestampStartMs", "timestampEndMs",
                "contentSha256", "relativeArtifactRef",
            )}
            for item in ordered
        ]
        return {
            "schemaVersion": "v3-media-outline-taskstore/v2",
            "task": {
                "taskId": task_id,
                "sourceIdentity": source_identity,
                "state": state,
                "revision": revision,
                "knowledgeImportStatus": "deferred_to_v4",
            },
            "evidenceCatalog": public_evidence,
            "outline": outline,
            "timeline": timeline,
            "mindmap": mindmap,
            "terminalFailureCode": terminal_failure_code,
        }

    @staticmethod
    def blocked(
        *, task_id: str, source_identity: str, revision: int, failure_code: str,
    ) -> dict[str, Any]:
        return {
            "schemaVersion": "v3-media-outline-taskstore/v2",
            "task": {
                "taskId": task_id,
                "sourceIdentity": source_identity,
                "state": "blocked",
                "revision": revision,
                "knowledgeImportStatus": "deferred_to_v4",
            },
            "evidenceCatalog": [],
            "outline": None,
            "timeline": [],
            "mindmap": None,
            "terminalFailureCode": failure_code,
        }

    @staticmethod
    def _validate_private_evidence(task_id: str, evidence: list[dict[str, Any]]) -> None:
        ids = set()
        for item in evidence:
            if item.get("taskId") != task_id or not EVIDENCE_ID_RE.fullmatch(str(item.get("evidenceId", ""))):
                raise MediaOutlineError("EVIDENCE_TASK_MISMATCH", "Evidence does not belong to this task.")
            if item["evidenceId"] in ids:
                raise MediaOutlineError("OUTLINE_VALIDATION_FAILED", "Evidence IDs must be unique.")
            ids.add(item["evidenceId"])
            if int(item.get("timestampStartMs", -1)) < 0 or int(item.get("timestampEndMs", -1)) < int(item.get("timestampStartMs", -1)):
                raise MediaOutlineError("EVIDENCE_TIME_INVALID", "Evidence time range is invalid.")
            if not re.fullmatch(r"[a-f0-9]{64}", str(item.get("contentSha256", ""))):
                raise MediaOutlineError("OUTLINE_VALIDATION_FAILED", "Evidence hash is invalid.")
            if not _safe_relative_ref(str(item.get("relativeArtifactRef", ""))):
                raise MediaOutlineError("OUTLINE_VALIDATION_FAILED", "Evidence path is invalid.")


def validate_outline_bundle(bundle: dict[str, Any]) -> None:
    task = bundle.get("task") or {}
    task_id = str(task.get("taskId", ""))
    state = task.get("state")
    if not TASK_ID_RE.fullmatch(task_id) or state not in TERMINAL_STATES:
        raise MediaOutlineError("OUTLINE_VALIDATION_FAILED", "Task identity or terminal state is invalid.")
    if task.get("knowledgeImportStatus") != "deferred_to_v4":
        raise MediaOutlineError("OUTLINE_VALIDATION_FAILED", "Knowledge import is outside V3.")
    catalog = bundle.get("evidenceCatalog")
    if not isinstance(catalog, list):
        raise MediaOutlineError("OUTLINE_VALIDATION_FAILED", "Evidence catalog is invalid.")
    DeterministicExtractiveOutlineGenerator._validate_private_evidence(task_id, [dict(item, text="validated") for item in catalog])
    ids = {item["evidenceId"] for item in catalog}
    outline, timeline, mindmap = bundle.get("outline"), bundle.get("timeline"), bundle.get("mindmap")
    failure_code = bundle.get("terminalFailureCode")
    if state in PUBLISHABLE_STATES:
        if not catalog or not isinstance(outline, dict) or not isinstance(timeline, list) or not timeline or not isinstance(mindmap, dict):
            raise MediaOutlineError("OUTLINE_EVIDENCE_REQUIRED", "Publishable terminal state requires evidence and projections.")
        if state == "ready" and failure_code is not None:
            raise MediaOutlineError("OUTLINE_VALIDATION_FAILED", "Ready state cannot carry a failure code.")
        if state == "degraded" and not failure_code:
            raise MediaOutlineError("OUTLINE_VALIDATION_FAILED", "Degraded state requires a failure code.")
        if outline.get("taskId") != task_id or outline.get("taskRevision") != task.get("revision"):
            raise MediaOutlineError("TASK_IDENTITY_MISMATCH", "Outline identity does not match task revision.")
        sections = outline.get("sections")
        if not isinstance(sections, list) or not sections:
            raise MediaOutlineError("OUTLINE_EVIDENCE_REQUIRED", "Outline sections are missing.")
        section_ids = {item.get("sectionId") for item in sections}
        if len(section_ids) != len(sections):
            raise MediaOutlineError("OUTLINE_VALIDATION_FAILED", "Section IDs are not unique.")
        for section in sections:
            if section.get("startMs", -1) >= section.get("endMs", -1) or not set(section.get("evidenceIds", ())) <= ids:
                raise MediaOutlineError("OUTLINE_VALIDATION_FAILED", "Section evidence or time is invalid.")
        if [item.get("sequence") for item in timeline] != list(range(len(timeline))):
            raise MediaOutlineError("PROJECTION_DRIFT", "Timeline sequence is invalid.")
        if any(item.get("outlineId") != outline["outlineId"] or item.get("sectionId") not in section_ids or not set(item.get("evidenceIds", ())) <= ids for item in timeline):
            raise MediaOutlineError("PROJECTION_DRIFT", "Timeline is not closed over the outline.")
        nodes = mindmap.get("nodes")
        if mindmap.get("taskId") != task_id or mindmap.get("outlineId") != outline["outlineId"] or not isinstance(nodes, list):
            raise MediaOutlineError("PROJECTION_DRIFT", "Mindmap identity is invalid.")
        node_ids = {item.get("nodeId") for item in nodes}
        if len(node_ids) != len(nodes) or len([item for item in nodes if item.get("parentNodeId") is None]) != 1:
            raise MediaOutlineError("PROJECTION_DRIFT", "Mindmap tree is invalid.")
        if any(item.get("parentNodeId") is not None and item.get("parentNodeId") not in node_ids for item in nodes):
            raise MediaOutlineError("PROJECTION_DRIFT", "Mindmap parent is unresolved.")
        if any(item.get("sectionId") is not None and item.get("sectionId") not in section_ids for item in nodes):
            raise MediaOutlineError("PROJECTION_DRIFT", "Mindmap section is unresolved.")
        if any(not set(item.get("evidenceIds", ())) <= ids for item in nodes):
            raise MediaOutlineError("PROJECTION_DRIFT", "Mindmap evidence is unresolved.")
    else:
        if outline is not None or timeline != [] or mindmap is not None or not failure_code:
            raise MediaOutlineError("OUTLINE_VALIDATION_FAILED", "Non-publishable terminal state must have zero projections.")
