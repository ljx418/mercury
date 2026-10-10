from __future__ import annotations

from pathlib import Path

from navia_runtime.modules.media_companion.comprehension import MediaComprehensionService
from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
from navia_runtime.modules.media_companion.task_store import MediaTaskStore
from navia_runtime.modules.media_companion.workspace_candidate import build_ask_benchmark, build_candidate_core


TASK = "media_task_" + "7" * 32
SOURCE = "portal:bilibili:BV1ZpYd66ELP:41828944992:1"


class Projection:
    def get(self, task_id: str):
        return {
            "taskId": task_id,
            "sourceIdentity": SOURCE,
            "state": "succeeded",
            "terminal": True,
            "segments": [
                {
                    "segmentId": f"seg_{index}",
                    "startMs": index * 10_000,
                    "endMs": index * 10_000 + 9_000,
                    "text": f"首先介绍问题背景，随后演示方法步骤，最后归纳结论。这是第 {index + 1} 条证据。",
                }
                for index in range(36)
            ],
        }


def test_candidate_core_uses_runtime_projection_and_twelve_real_ask_results(tmp_path: Path) -> None:
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    private = tmp_path / "private"
    task = MediaProductMaterializer(store, Projection(), private).materialize(TASK)
    projection = MediaComprehensionService(store, private).get(TASK, task["revision"])
    evidence = projection["evidenceCatalog"][0]

    class AskService:
        def ask(self, task_id, revision, question):
            insufficient = "火星" in question or "身份证" in question
            return {
                "status": "insufficient_evidence" if insufficient else "answered",
                "answerBlocks": [] if insufficient else [{
                    "text": "有证据支持的回答",
                    "evidenceIds": [evidence["evidenceId"]],
                    "timestampMs": evidence["timestampStartMs"],
                }],
                "retrievalPlanSha256": "a" * 64,
                "executionMode": "local_deterministic",
            }

    asks = build_ask_benchmark(AskService(), TASK, task["revision"])
    candidate = build_candidate_core(projection, asks, selected_frame_upload_count=1)

    assert len(candidate["askBenchmark"]) == 12
    assert [item["category"] for item in asks].count("insufficient") == 2
    assert all(item["status"] == "insufficient_evidence" for item in asks[-2:])
    assert candidate["authorization"]["selectedFrameUploadCount"] == 1
    assert all("taskId" not in item and "privateArtifactRef" in item for item in candidate["evidenceCatalog"])

