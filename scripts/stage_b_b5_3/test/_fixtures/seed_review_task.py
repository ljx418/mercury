#!/usr/bin/env python3
"""Seed ONE synthetic media task for the B-6A offline composition tests.

The task is created through the PRODUCTION store API and the PRODUCTION
outline generator. Nothing here writes raw SQL, nothing here calls the
materializer and nothing here downloads or decodes media.

The private derived evidence (the transcript text and one PNG thumbnail) is
written exactly where the production materializer writes it, so the PUBLIC
workspace route and the AUTHENTICATED thumbnail route serve the REAL
retained artifacts.

The script prints one JSON object:

    {"taskId": "...", "evidenceIds": ["..."], "thumbnailEvidenceId": "..."}

Usage:

    NAVIA_DB_PATH=... NAVIA_MEDIA_TASK_ROOT=... python3 seed_review_task.py
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "services/local-runtime"))

from navia_runtime.modules.media_companion.outline import (  # noqa: E402
    DeterministicExtractiveOutlineGenerator,
)
from navia_runtime.modules.media_companion.task_store import MediaTaskStore  # noqa: E402

#: A 1x1 opaque black PNG.
PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d4944415478da63fccfc0500f000485018084a98c210000000049454e44ae426082"
)

TASK_ID = "media_task_" + "b6" + "a" * 30
SOURCE_IDENTITY = "portal:bilibili:BV11t8w6oEtP:41828944992:p1"


def _normalized(text: str) -> str:
    return " ".join(text.split()).strip()


def main() -> int:
    db_path = os.environ.get("NAVIA_DB_PATH")
    media_task_root = os.environ.get("NAVIA_MEDIA_TASK_ROOT")
    if not db_path or not media_task_root:
        print("NAVIA_DB_PATH and NAVIA_MEDIA_TASK_ROOT are required", file=sys.stderr)
        return 2

    private_root = Path(media_task_root) / "product-evidence"
    evidence_dir = private_root / "evidence" / TASK_ID
    frames_dir = evidence_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    # Mirror the first failed real source's catalog cardinality without
    # copying any real content: 84 transcript records plus four typed visual
    # triples (frame/OCR/caption) = 96 records.
    texts: list[tuple[str, str, int, int]] = []
    for index in range(84):
        start_ms = index * 20_000
        texts.append((
            "transcript",
            f"离线派生字幕片段 {index + 1}，用于验证长目录的生产排序与捕获闭合。",
            start_ms,
            start_ms + 15_000,
        ))
    for visual_index, timestamp_ms in enumerate((0, 600_000, 1_200_000, 1_800_000)):
        texts.extend([
            ("frame", f"选中画面 1280x720，离线序号 {visual_index + 1}", timestamp_ms, timestamp_ms + 1),
            ("ocr_block", f"离线 OCR 片段 {visual_index + 1}", timestamp_ms, timestamp_ms + 1),
            ("vision_caption", f"离线视觉描述 {visual_index + 1}", timestamp_ms, timestamp_ms + 1),
        ])
    evidence: list[dict[str, object]] = []
    first_thumbnail_evidence_id: str | None = None
    for index, (kind, text, timestamp_start_ms, timestamp_end_ms) in enumerate(texts):
        evidence_id = f"mtr_{index:032x}"
        normalized = _normalized(text)
        digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        relative = f"evidence/{TASK_ID}/{index:04d}.json"
        payload: dict[str, object] = {"text": normalized, "contentSha256": digest}
        if kind == "frame":
            thumbnail_relative = f"evidence/{TASK_ID}/frames/{evidence_id}.png"
            (private_root / thumbnail_relative).write_bytes(PNG_BYTES)
            payload["thumbnailRelativeRef"] = thumbnail_relative
            if first_thumbnail_evidence_id is None:
                first_thumbnail_evidence_id = evidence_id
        (private_root / relative).write_text(
            json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
            encoding="utf-8",
        )
        evidence.append({
            "evidenceId": evidence_id,
            "taskId": TASK_ID,
            "kind": kind,
            "timestampStartMs": timestamp_start_ms,
            "timestampEndMs": timestamp_end_ms,
            "contentSha256": digest,
            "relativeArtifactRef": relative,
            "text": normalized,
            **({"thumbnailRelativeRef": payload["thumbnailRelativeRef"]} if "thumbnailRelativeRef" in payload else {}),
        })

    store = MediaTaskStore(db_path)
    try:
        store.create(TASK_ID, SOURCE_IDENTITY)
        # The PRODUCTION state machine: every transition is a store API call.
        revision = 1
        for state in ("acquiring", "transcribing", "extracting_frames", "analyzing_vision", "synthesizing"):
            store.transition(TASK_ID, revision, state)
            revision += 1
        bundle = DeterministicExtractiveOutlineGenerator().generate(
            task_id=TASK_ID,
            source_identity=SOURCE_IDENTITY,
            revision=revision + 1,
            source_title="离线评审捕获测试",
            evidence=evidence,
            state="ready",
        )
        store.commit_terminal(bundle, expected_revision=revision, idempotency_key="b6a-seed-terminal-0001")
    finally:
        store.close()

    print(json.dumps({
        "taskId": TASK_ID,
        "evidenceIds": [item["evidenceId"] for item in evidence],
        "thumbnailEvidenceId": first_thumbnail_evidence_id,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
