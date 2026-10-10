from __future__ import annotations

import hashlib
import io
import json
import zipfile
from pathlib import Path

import pytest

from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
from navia_runtime.modules.media_companion.product_services import MediaAskService, MediaExportService
from navia_runtime.modules.media_companion.comprehension import MediaComprehensionService
from navia_runtime.modules.media_companion.task_store import MediaTaskStore, MediaTaskStoreError


TASK = "media_task_" + "c" * 32
SOURCE = "portal:bilibili:BV1ZpYd66ELP:41828944992:1"


class Projection:
    def get(self, task_id: str):
        return {
            "taskId": task_id,
            "sourceIdentity": SOURCE,
            "state": "succeeded",
            "terminal": True,
            "segments": [
                {"segmentId": "seg_1", "startMs": 0, "endMs": 8_000, "text": "开头介绍本机媒体理解和证据引用"},
                {"segmentId": "seg_2", "startMs": 8_000, "endMs": 16_000, "text": "随后说明本地语音转写的处理过程"},
            ],
        }


def services(tmp_path: Path):
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    private = tmp_path / "private"
    task = MediaProductMaterializer(store, Projection(), private).materialize(TASK)
    asks = MediaAskService(store, private)
    exports = MediaExportService(store, asks, tmp_path / "exports")
    return store, task, asks, exports


def test_ask_is_grounded_durable_and_rejects_unsupported_visual_question(tmp_path: Path) -> None:
    _, task, asks, _ = services(tmp_path)
    answered = asks.ask(TASK, task["revision"], "请概括开头内容")
    replay = asks.ask(TASK, task["revision"], "请概括开头内容")
    visual = asks.ask(TASK, task["revision"], "画面里出现了什么人物？")
    unsupported = asks.ask(TASK, task["revision"], "是否提到火星殖民预算？")

    assert answered == replay
    assert answered["status"] == "answered"
    assert answered["answer"]
    assert len(answered["evidenceIds"]) >= 1
    assert answered["category"] == "factual"
    assert answered["executionMode"] == "local_deterministic"
    assert answered["answerBlocks"]
    assert all(block["evidenceIds"] for block in answered["answerBlocks"])
    assert len(answered["retrievalPlanSha256"]) == 64
    assert visual["status"] == "insufficient_evidence"
    assert visual["answer"] == ""
    assert visual["evidenceIds"] == []
    assert unsupported["status"] == "insufficient_evidence"
    assert unsupported["answer"] == ""
    assert unsupported["evidenceIds"] == []


def test_cross_chapter_ask_refuses_when_only_one_evidence_block_exists(tmp_path: Path) -> None:
    _, task, asks, _ = services(tmp_path)
    result = asks.ask(TASK, task["revision"], "开头和后续内容有什么前后关系？")

    assert result["status"] == "insufficient_evidence"
    assert result["category"] == "cross_chapter"
    assert result["answerBlocks"] == []
    assert result["evidenceIds"] == []


def test_ask_rejects_stale_revision_and_unknown_evidence(tmp_path: Path) -> None:
    _, task, asks, _ = services(tmp_path)
    with pytest.raises(MediaTaskStoreError, match="revision") as stale:
        asks.ask(TASK, task["revision"] - 1, "请概括开头内容")
    assert stale.value.code == "TASK_REVISION_CONFLICT"


def test_exports_are_deterministic_allowlisted_and_v4_deferred(tmp_path: Path) -> None:
    _, task, asks, exports = services(tmp_path)
    asks.ask(TASK, task["revision"], "请概括开头内容")
    json_manifest = exports.create(TASK, task["revision"], "json_bundle")
    json_replay = exports.create(TASK, task["revision"], "json_bundle")
    zip_manifest = exports.create(TASK, task["revision"], "markdown_zip")

    assert json_manifest == json_replay
    assert json_manifest["knowledgeImportStatus"] == "deferred_to_v4"
    json_path, json_type = exports.artifact(TASK, json_manifest["exportId"])
    assert json_type == "application/json"
    assert hashlib.sha256(json_path.read_bytes()).hexdigest() == json_manifest["artifactSha256"]
    assert json.loads(json_path.read_text())["knowledgeImportStatus"] == "deferred_to_v4"

    zip_path, zip_type = exports.artifact(TASK, zip_manifest["exportId"])
    assert zip_type == "application/zip"
    with zipfile.ZipFile(io.BytesIO(zip_path.read_bytes())) as archive:
        assert set(archive.namelist()) == {
            "README.md", "outline.md", "timeline.json", "mindmap.json", "asks.json", "evidence-index.json"
        }
        assert all(not name.startswith("/") and ".." not in name for name in archive.namelist())
        assert "知识导入将在 V4 提供" in archive.read("README.md").decode()


def test_export_uses_the_same_semantic_projection_as_workspace(tmp_path: Path) -> None:
    store, task, asks, _ = services(tmp_path)
    comprehension = MediaComprehensionService(store, tmp_path / "private")
    exports = MediaExportService(store, asks, tmp_path / "semantic-exports", comprehension=comprehension)

    manifest = exports.create(TASK, task["revision"], "json_bundle")
    path, _ = exports.artifact(TASK, manifest["exportId"])
    bundle = json.loads(path.read_text(encoding="utf-8"))
    workspace = comprehension.get(TASK, task["revision"])

    assert bundle["schemaVersion"] == "v3-media-local-export/v2"
    assert bundle["groundedTextCloudStatus"] == "disabled"
    assert bundle["outline"]["contentSha256"] == workspace["outline"]["contentSha256"]
    assert bundle["timeline"]["contentSha256"] == workspace["timeline"]["contentSha256"]
    assert bundle["mindmap"]["contentSha256"] == workspace["mindmap"]["contentSha256"]


def test_export_rejects_invalid_format_and_cross_task_download(tmp_path: Path) -> None:
    _, task, _, exports = services(tmp_path)
    with pytest.raises(MediaTaskStoreError) as invalid:
        exports.create(TASK, task["revision"], "raw_video")
    assert invalid.value.code == "EXPORT_FORMAT_INVALID"
    with pytest.raises(MediaTaskStoreError) as missing:
        exports.artifact("media_task_" + "d" * 32, "export_" + "a" * 16)
    assert missing.value.code == "EXPORT_NOT_FOUND"
