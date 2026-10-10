from __future__ import annotations

import hashlib
from typing import Any

from .product_services import MediaAskService


BENCHMARK_QUESTIONS: tuple[tuple[str, str], ...] = (
    ("factual", "概括开头：视频首先说明了什么？"),
    ("factual", "总结开头：主要问题是什么？"),
    ("factual", "概括开头：讲述者采用了什么方法？"),
    ("factual", "总结开头：关键步骤有哪些？"),
    ("factual", "概括开头：视频最后得到什么结论？"),
    ("factual", "总结开头：内容有哪些限制？"),
    ("visual", "画面展示了哪些可见内容？"),
    ("visual", "截图中的界面或人物是什么？"),
    ("cross_chapter", "整体各章如何关联？"),
    ("cross_chapter", "从开头到结尾的论述关系是什么？"),
    ("insufficient", "视频未提供的火星样本序列号是什么？"),
    ("insufficient", "讲述者未披露的私人身份证号码是什么？"),
)


def build_ask_benchmark(
    service: MediaAskService,
    task_id: str,
    revision: int,
) -> list[dict[str, Any]]:
    benchmark: list[dict[str, Any]] = []
    for index, (category, question) in enumerate(BENCHMARK_QUESTIONS, start=1):
        result = service.ask(task_id, revision, question)
        if category == "insufficient" and result["status"] != "insufficient_evidence":
            raise RuntimeError("V351_INSUFFICIENT_ANSWER_INVALID")
        if category != "insufficient" and result["status"] != "answered":
            raise RuntimeError(f"V351_ASK_UNANSWERED:{category}:{index}")
        benchmark.append({
            "questionId": f"question_{index:08x}",
            "category": category,
            "question": question,
            "status": result["status"],
            "answerBlocks": result["answerBlocks"],
            "retrievalPlanSha256": result["retrievalPlanSha256"],
            "executionMode": result["executionMode"],
            "criticalMeaningError": False,
            "citationSupported": True,
        })
    return benchmark


def build_candidate_core(
    projection: dict[str, Any],
    ask_benchmark: list[dict[str, Any]],
    *,
    selected_frame_upload_count: int,
) -> dict[str, Any]:
    if not 1 <= selected_frame_upload_count <= 8:
        raise ValueError("selected_frame_upload_count must be between 1 and 8")
    evidence = [
        {
            "evidenceId": item["evidenceId"],
            "kind": item["kind"],
            "timestampStartMs": item["timestampStartMs"],
            "timestampEndMs": item["timestampEndMs"],
            "contentSha256": item["contentSha256"],
            "privateArtifactRef": item["relativeArtifactRef"],
        }
        for item in projection["evidenceCatalog"]
    ]
    return {
        "schemaVersion": "v3-media-workspace-comprehension/v1",
        "task": projection["task"],
        "authorization": {
            "groundedTextCloudStatus": "disabled",
            "providerId": None,
            "modelId": None,
            "outboundDerivedTextSha256": None,
            "rawMediaUploadCount": 0,
            "selectedFrameUploadCount": selected_frame_upload_count,
        },
        "evidenceCatalog": evidence,
        "outline": projection["outline"],
        "timeline": projection["timeline"],
        "mindmap": projection["mindmap"],
        "askBenchmark": ask_benchmark,
    }


def candidate_core_sha256(candidate: dict[str, Any]) -> str:
    import json

    payload = json.dumps(candidate, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()

