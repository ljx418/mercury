#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from collections import Counter
from pathlib import Path

import jsonschema


HERE = Path(__file__).resolve().parent
if (HERE / "12-v3-workspace-comprehension.schema.json").exists():
    SCHEMA = HERE / "12-v3-workspace-comprehension.schema.json"
    POSITIVE = HERE / "13-v3-workspace-comprehension-positive.json"
    NEGATIVE = HERE / "14-v3-workspace-comprehension-negative.json"
else:
    project_root = Path(__file__).resolve().parents[3]
    SCHEMA = project_root / "contracts/v3_media_workspace_comprehension_v1.schema.json"
    POSITIVE = project_root / "fixtures/v3-media-workspace-comprehension-positive.json"
    NEGATIVE = project_root / "fixtures/v3-media-workspace-comprehension-negative-cases.json"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def semantic_errors(value: dict) -> set[str]:
    errors: set[str] = set()
    task = value["task"]
    outline = value["outline"]
    timeline = value["timeline"]
    mindmap = value["mindmap"]
    evidence = {item["evidenceId"]: item for item in value["evidenceCatalog"]}
    chapters = outline["chapters"]
    chapter_by_id = {item["chapterId"]: item for item in chapters}

    if task["outlineId"] != outline["outlineId"] or task["taskId"] != outline["taskId"] or task["taskRevision"] != outline["taskRevision"]:
        errors.add("V351_IDENTITY_MISMATCH")

    orders = [item["order"] for item in chapters]
    if orders != list(range(len(chapters))) or len(chapter_by_id) != len(chapters):
        errors.add("V351_CHAPTER_ORDER_INVALID")
    roots = [item for item in chapters if item["parentChapterId"] is None]
    for index, chapter in enumerate(roots):
        if chapter["startMs"] >= chapter["endMs"] or chapter["endMs"] > task["mediaDurationMs"]:
            errors.add("V351_CHAPTER_RANGE_INVALID")
        if index and chapter["startMs"] < roots[index - 1]["endMs"]:
            errors.add("V351_CHAPTER_OVERLAP")
    for chapter in chapters:
        parent_id = chapter["parentChapterId"]
        if parent_id is not None:
            parent = chapter_by_id.get(parent_id)
            if parent is None or chapter["depth"] != parent["depth"] + 1 or chapter["startMs"] < parent["startMs"] or chapter["endMs"] > parent["endMs"]:
                errors.add("V351_CHAPTER_TREE_INVALID")
        if any(ref not in evidence for ref in chapter["evidenceIds"]):
            errors.add("V351_EVIDENCE_ORPHAN")
        frame_id = chapter["representativeFrameEvidenceId"]
        if frame_id is not None and (frame_id not in evidence or evidence[frame_id]["kind"] != "frame"):
            errors.add("V351_FRAME_KIND_INVALID")

    if timeline["outlineId"] != outline["outlineId"] or mindmap["outlineId"] != outline["outlineId"]:
        errors.add("V351_PROJECTION_IDENTITY_MISMATCH")
    if set(timeline["chapterIds"]) != set(chapter_by_id):
        errors.add("V351_TIMELINE_CHAPTER_ORPHAN")
    for moment in timeline["moments"]:
        chapter = chapter_by_id.get(moment["chapterId"])
        if chapter is None:
            errors.add("V351_TIMELINE_CHAPTER_ORPHAN")
        elif not chapter["startMs"] <= moment["timestampMs"] <= chapter["endMs"]:
            errors.add("V351_TIMELINE_RANGE_INVALID")
        if any(ref not in evidence for ref in moment["evidenceIds"]):
            errors.add("V351_EVIDENCE_ORPHAN")
        frame_id = moment["frameEvidenceId"]
        if frame_id is not None and (frame_id not in evidence or evidence[frame_id]["kind"] != "frame"):
            errors.add("V351_FRAME_KIND_INVALID")

    nodes = mindmap["nodes"]
    node_by_id = {item["nodeId"]: item for item in nodes}
    roots = [item for item in nodes if item["parentNodeId"] is None]
    if len(roots) != 1 or roots[0]["kind"] != "root" or roots[0]["depth"] != 0:
        errors.add("V351_MINDMAP_ROOT_INVALID")
    for node in nodes:
        parent_id = node["parentNodeId"]
        if parent_id is not None:
            parent = node_by_id.get(parent_id)
            if parent is None:
                errors.add("V351_MINDMAP_ORPHAN")
            elif node["depth"] != parent["depth"] + 1:
                errors.add("V351_MINDMAP_DEPTH_INVALID")
        if node["chapterId"] is not None and node["chapterId"] not in chapter_by_id:
            errors.add("V351_MINDMAP_CHAPTER_ORPHAN")
        if any(ref not in evidence for ref in node["evidenceIds"]):
            errors.add("V351_EVIDENCE_ORPHAN")
        visited: set[str] = set()
        cursor = node
        while cursor["parentNodeId"] is not None:
            if cursor["nodeId"] in visited:
                errors.add("V351_MINDMAP_CYCLE")
                break
            visited.add(cursor["nodeId"])
            parent = node_by_id.get(cursor["parentNodeId"])
            if parent is None:
                break
            cursor = parent
    if max(item["depth"] for item in nodes) < 2:
        errors.add("V351_MINDMAP_DEPTH_INSUFFICIENT")

    category_counts = Counter(item["category"] for item in value["askBenchmark"])
    if category_counts != {"factual": 6, "visual": 2, "cross_chapter": 2, "insufficient": 2}:
        errors.add("V351_ASK_DENOMINATOR_INVALID")
    visual_kinds = {"frame", "ocr_block", "vision_caption"}
    for result in value["askBenchmark"]:
        cited = [ref for block in result["answerBlocks"] for ref in block["evidenceIds"]]
        if any(ref not in evidence for ref in cited):
            errors.add("V351_ASK_CITATION_ORPHAN")
        if result["category"] == "visual" and result["status"] == "answered" and not any(evidence.get(ref, {}).get("kind") in visual_kinds for ref in cited):
            errors.add("V351_VISUAL_CITATION_INVALID")
        if result["category"] == "insufficient" and (result["status"] != "insufficient_evidence" or result["answerBlocks"]):
            errors.add("V351_INSUFFICIENT_ANSWER_INVALID")
        if result["status"] == "answered" and not result["answerBlocks"]:
            errors.add("V351_ANSWER_EMPTY")
        if result["criticalMeaningError"]:
            errors.add("V351_CRITICAL_MEANING_ERROR")
        if not result["citationSupported"]:
            errors.add("V351_CITATION_UNSUPPORTED")

    observations = value["playbackObservations"]
    origin_counts = Counter(item["origin"] for item in observations)
    if len(observations) < 10 or any(origin_counts[name] < 2 for name in ("chapter", "moment", "frame", "mindmap_node", "ask_citation")):
        errors.add("V351_SEEK_COVERAGE_INSUFFICIENT")
    for item in observations:
        if item["deltaMs"] != abs(item["observedMs"] - item["requestedMs"]):
            errors.add("V351_SEEK_DELTA_MISMATCH")
        if max(item["requestedMs"], item["observedMs"]) > task["mediaDurationMs"]:
            errors.add("V351_SEEK_RANGE_INVALID")

    authorization = value["authorization"]
    if authorization["rawMediaUploadCount"] != 0:
        errors.add("V351_RAW_MEDIA_UPLOAD_FORBIDDEN")
    if authorization["groundedTextCloudStatus"] != "granted":
        if any(authorization[key] is not None for key in ("providerId", "modelId", "outboundDerivedTextSha256")):
            errors.add("V351_CLOUD_SCOPE_INVALID")
        if any(item["executionMode"] != "local_deterministic" for item in value["askBenchmark"]):
            errors.add("V351_CLOUD_SCOPE_INVALID")
    elif any(authorization[key] is None for key in ("providerId", "modelId", "outboundDerivedTextSha256")):
        errors.add("V351_CLOUD_SCOPE_INVALID")

    resource = value["resourceVerification"]
    if resource["remoteScriptCount"] != 0:
        errors.add("V351_REMOTE_SCRIPT_FORBIDDEN")
    if resource["evalCount"] != 0:
        errors.add("V351_EVAL_FORBIDDEN")
    return errors


def mutate(case_id: str, value: dict) -> None:
    if case_id == "V351-N01": value["task"]["outlineId"] = "outline_ffffffffffffffffffffffffffffffff"
    elif case_id == "V351-N02": value["outline"]["chapters"][1]["order"] = 0
    elif case_id == "V351-N03": value["outline"]["chapters"][1]["startMs"] = 90000
    elif case_id == "V351-N04": value["outline"]["chapters"][0]["evidenceIds"][0] = "mtr_ffffffffffffffffffffffffffffffff"
    elif case_id == "V351-N05": value["outline"]["chapters"][0]["representativeFrameEvidenceId"] = "mtr_00000000000000000000000000000001"
    elif case_id == "V351-N06": value["timeline"]["outlineId"] = "outline_ffffffffffffffffffffffffffffffff"
    elif case_id == "V351-N07": value["timeline"]["moments"][0]["chapterId"] = "chapter_ffffffffffffffff"
    elif case_id == "V351-N08": value["timeline"]["moments"][1]["frameEvidenceId"] = "mtr_00000000000000000000000000000001"
    elif case_id == "V351-N09": value["mindmap"]["nodes"][0]["parentNodeId"] = "node_0000000000000002"
    elif case_id == "V351-N10": value["mindmap"]["nodes"][2]["parentNodeId"] = "node_0000000000000003"
    elif case_id == "V351-N11": value["mindmap"]["nodes"][2]["depth"] = 1
    elif case_id == "V351-N12": value["askBenchmark"][0]["answerBlocks"][0]["evidenceIds"][0] = "mtr_ffffffffffffffffffffffffffffffff"
    elif case_id == "V351-N13": value["askBenchmark"][6]["answerBlocks"][0]["evidenceIds"] = ["mtr_00000000000000000000000000000003"]
    elif case_id == "V351-N14": value["askBenchmark"][10]["status"] = "answered"
    elif case_id == "V351-N15": value["askBenchmark"][0]["criticalMeaningError"] = True
    elif case_id == "V351-N16": value["playbackObservations"][0]["deltaMs"] = 0
    elif case_id == "V351-N17": value["playbackObservations"] = value["playbackObservations"][:9]
    elif case_id == "V351-N18": value["authorization"]["providerId"] = "minimax"
    elif case_id == "V351-N19": value["authorization"]["rawMediaUploadCount"] = 1
    elif case_id == "V351-N20": value["resourceVerification"]["remoteScriptCount"] = 1
    else: raise ValueError(f"Unknown case: {case_id}")


def main() -> int:
    schema = load(SCHEMA)
    positive = load(POSITIVE)
    cases = load(NEGATIVE)["cases"]
    jsonschema.Draft202012Validator.check_schema(schema)
    validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
    validator.validate(positive)
    positive_errors = semantic_errors(positive)
    results = []
    for case in cases:
        candidate = copy.deepcopy(positive)
        mutate(case["caseId"], candidate)
        schema_errors = list(validator.iter_errors(candidate))
        semantic = semantic_errors(candidate)
        passed = bool(schema_errors) or case["expectedFailureCode"] in semantic
        results.append({"caseId": case["caseId"], "expectedFailureCode": case["expectedFailureCode"], "passed": passed, "schemaErrorCount": len(schema_errors), "semanticErrors": sorted(semantic)})
    report = {
        "schemaVersion": "v3-5.1-document-verification/v1",
        "schemaMetaPassed": True,
        "positiveSchemaPassed": True,
        "positiveSemanticErrors": sorted(positive_errors),
        "negativeTotal": len(results),
        "negativePassed": sum(item["passed"] for item in results),
        "failed": [item["caseId"] for item in results if not item["passed"]],
        "results": results,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not positive_errors and not report["failed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
