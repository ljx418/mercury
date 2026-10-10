#!/usr/bin/env python3
"""Read-only semantic verifier for the V3-3..V3-7 document package."""

from __future__ import annotations

import argparse
import copy
import json
import sys
from datetime import datetime
from pathlib import Path

from jsonschema import Draft202012Validator


class SemanticError(AssertionError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SemanticError(message)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def validate_vision(value: dict) -> None:
    task_id = value["taskId"]
    frames = value["frames"]
    frame_by_id = {item["evidenceId"]: item for item in frames}
    require(len(frame_by_id) == len(frames), "vision frame evidence IDs must be unique")
    require(all(item["taskId"] == task_id for item in frames), "vision frames must remain in task")
    selected = [item for item in frames if item["selected"]]
    require(len(selected) <= value["samplingPolicy"]["selectedEvidenceLimit"], "selected frame budget exceeded")
    observations = value["visionObservations"]
    require(len(observations) <= value["samplingPolicy"]["cloudVisionFrameLimit"], "cloud vision budget exceeded")
    consent = value["consent"]
    if observations:
        require(consent["state"] == "granted", "vision dispatch requires granted consent")
        require(consent["decisionId"] is not None, "vision dispatch requires consent decision")
        require(consent["grantedAt"] is not None, "vision dispatch requires consent grant time")
        require(consent["consentCheckedPerDispatch"] is True, "consent must be checked per dispatch")
        require(consent["authorizedDispatchCount"] == len(observations), "authorized dispatch count mismatch")
        require([item["dispatchSequence"] for item in observations] == list(range(len(observations))), "dispatch sequence must be contiguous")
    revoked_at = parse_time(consent["revokedAt"]) if consent["revokedAt"] else None
    for item in value["ocrObservations"]:
        require(item["taskId"] == task_id, "OCR observation crossed task")
        require(item["frameEvidenceId"] in frame_by_id, "OCR frame is unresolved")
    for item in observations:
        require(item["taskId"] == task_id, "vision observation crossed task")
        require(item["frameEvidenceId"] in frame_by_id, "vision frame is unresolved")
        require(frame_by_id[item["frameEvidenceId"]]["selected"] is True, "unselected frame dispatched")
        require(item["authorized"] is True and item["consentValidAtDispatch"] is True, "unauthorized vision dispatch")
        require(item["consentDecisionId"] == consent["decisionId"], "consent decision drift")
        if revoked_at is not None:
            require(parse_time(item["uploadedAt"]) <= revoked_at, "post-revocation vision dispatch")
    cleanup = value["cleanup"]
    require(cleanup["candidateFrameCount"] == len(frames), "candidate cleanup count mismatch")
    require(cleanup["retainedEvidenceFrameCount"] == sum(item["retention"] == "evidence_until_task_delete" for item in frames), "retained frame count mismatch")
    require(cleanup["deletedNonEvidenceFrameCount"] == sum(item["retention"] == "delete_at_terminal" for item in frames), "deleted frame count mismatch")


def validate_outline(value: dict) -> None:
    task = value["task"]
    task_id = task["taskId"]
    catalog = value["evidenceCatalog"]
    catalog_ids = {item["evidenceId"] for item in catalog}
    require(len(catalog_ids) == len(catalog), "evidence catalog IDs must be unique")
    require(all(item["taskId"] == task_id for item in catalog), "evidence catalog crossed task")
    require(all(item["timestampStartMs"] <= item["timestampEndMs"] for item in catalog), "evidence time is reversed")
    outline = value["outline"]
    require(outline["taskId"] == task_id and outline["taskRevision"] == task["revision"], "outline task binding drift")
    sections = outline["sections"]
    section_by_id = {item["sectionId"]: item for item in sections}
    require(len(section_by_id) == len(sections), "outline section IDs must be unique")
    require(all(item["startMs"] < item["endMs"] for item in sections), "outline section time is reversed")
    require(all(set(item["evidenceIds"]) <= catalog_ids for item in sections), "outline has unresolved evidence")
    timeline = value["timeline"]
    require([item["sequence"] for item in timeline] == list(range(len(timeline))), "timeline sequence must be contiguous")
    require(all(item["outlineId"] == outline["outlineId"] for item in timeline), "timeline outline binding drift")
    require(all(item["sectionId"] in section_by_id for item in timeline), "timeline section is unresolved")
    require(all(item["startMs"] < item["endMs"] for item in timeline), "timeline time is reversed")
    require(all(set(item["evidenceIds"]) <= catalog_ids for item in timeline), "timeline has unresolved evidence")
    require(all(a["endMs"] <= b["startMs"] for a, b in zip(timeline, timeline[1:])), "timeline segments overlap or regress")
    mindmap = value["mindmap"]
    require(mindmap["taskId"] == task_id and mindmap["outlineId"] == outline["outlineId"], "mindmap binding drift")
    nodes = mindmap["nodes"]
    node_ids = {item["nodeId"] for item in nodes}
    require(len(node_ids) == len(nodes), "mindmap node IDs must be unique")
    require(sum(item["parentNodeId"] is None for item in nodes) == 1, "mindmap requires one root")
    require(all(item["parentNodeId"] is None or item["parentNodeId"] in node_ids for item in nodes), "mindmap parent is unresolved")
    require(all(item["sectionId"] is None or item["sectionId"] in section_by_id for item in nodes), "mindmap section is unresolved")
    require(all(set(item["evidenceIds"]) <= catalog_ids for item in nodes), "mindmap has unresolved evidence")
    receipt = value["transactionReceipt"]
    require(receipt["taskId"] == task_id, "transaction receipt crossed task")
    require(receipt["committedRevision"] == task["revision"], "committed task revision drift")
    require(receipt["committedRevision"] == receipt["expectedRevision"] + 1, "CAS revision did not advance once")


def validate_product(value: dict) -> None:
    require({(item["surface"], item["viewport"]) for item in value["surfaces"]} == {
        ("side_panel", "360x900"), ("side_panel", "420x900"),
        ("workspace", "768x900"), ("workspace", "1280x900"),
    }, "four required surfaces are not exact")
    route_ids = [item["routeId"] for item in value["routes"]]
    require(set(route_ids) == {
        "/media/tasks", "/media/tasks/:taskId", "/media/tasks/:taskId/outline",
        "/media/tasks/:taskId/timeline", "/media/tasks/:taskId/mindmap",
        "/media/tasks/:taskId/ask", "/media/tasks/:taskId/evidence/:evidenceId",
        "/media/tasks/:taskId/export",
    } and len(route_ids) == 8, "route coverage is not exact")
    require({item["mode"] for item in value["routes"]} == {"direct", "reload", "back", "reopen", "invalid", "forbidden"}, "route modes are incomplete")
    require([item["requirementId"] for item in value["requirements"]] == [f"V3-5-A{i:02d}" for i in range(1, 19)], "V3-5 denominator drift")
    require({item["format"] for item in value["exports"]} == {"markdown_zip", "json_bundle"}, "export formats drift")
    seeks = value["seekObservations"]
    require({item["origin"] for item in seeks} == {"outline", "timeline", "mindmap", "ask_citation", "evidence_drawer"}, "seek origins drift")
    duration = value["taskBinding"]["mediaDurationMs"]
    for item in seeks:
        require(item["deltaMs"] == abs(item["observedMs"] - item["requestedMs"]), "seek delta arithmetic mismatch")
        require(item["requestedMs"] <= duration and item["observedMs"] <= duration, "seek exceeds media duration")
        if item["outcome"] == "located":
            require(item["pageIdentityMatched"] is True and item["deltaMs"] <= 2000, "located seek is not trustworthy")


def validate_human(value: dict) -> None:
    require([item["requirementId"] for item in value["judgments"]] == [f"H{i:02d}" for i in range(1, 11)], "human denominator drift")
    decisions = [item["decision"] for item in value["judgments"]]
    expected = "BLOCKED" if "BLOCKED" in decisions else ("PASS" if all(item == "PASS" for item in decisions) else "FAIL")
    require(value["overallDecision"] == expected, "human overall decision contradicts judgments")


def validate_final(candidate: dict, disposition: dict) -> None:
    require([item["requirementId"] for item in candidate["requirements"]] == [f"V3-6-A{i:02d}" for i in range(1, 21)], "V3-6 denominator drift")
    require(sum(candidate["classificationCounts"].values()) == candidate["sampleCount"] == 12, "sample denominator drift")
    samples = candidate["samples"]
    require([item["sampleId"] for item in samples] == [f"v3-sample-{i:02d}" for i in range(1, 13)], "sample IDs drift")
    require(len({item["sourceIdentity"] for item in samples}) == 12, "source identities are reused")
    require(len({item["canonicalUrlSha256"] for item in samples}) == 12, "canonical URLs are reused")
    expected = {
        "subtitle": candidate["classificationCounts"]["subtitle"],
        "asr": candidate["classificationCounts"]["asr"],
        "multipart": candidate["classificationCounts"]["multipart"],
        "restricted": candidate["classificationCounts"]["restricted"],
        "low_signal": candidate["classificationCounts"]["lowSignal"],
    }
    actual = {key: sum(item["expectedClass"] == key for item in samples) for key in expected}
    require(actual == expected, "sample classification counts drift")
    require(all((item["expectedClass"] == "restricted") == (item["terminalStatus"] == "blocked") for item in samples), "restricted terminal drift")
    require(all((item["expectedClass"] == "low_signal") == (item["terminalStatus"] == "degraded") for item in samples), "low-signal terminal drift")
    require(candidate["candidateId"] == disposition["candidateId"], "final disposition candidate drift")
    require(candidate["finalPassed"] is False and disposition["finalPassed"] is True, "final transition drift")


def expect_rejected(name: str, validator, value: dict) -> dict:
    try:
        validator(value)
    except (SemanticError, KeyError, TypeError, ValueError):
        return {"case": name, "rejected": True}
    return {"case": name, "rejected": False}


def run(package: Path) -> dict:
    schemas = {
        "vision": load_json(package / "07-vision-evidence.schema.json"),
        "outline": load_json(package / "11-outline-taskstore.schema.json"),
        "product": load_json(package / "14-product-acceptance.schema.json"),
        "human": load_json(package / "15-human-review.schema.json"),
        "final": load_json(package / "18-finalization.schema.json"),
    }
    for schema in schemas.values():
        Draft202012Validator.check_schema(schema)
    vision_outline = load_json(package / "08-vision-outline-positive.json")
    product_final = load_json(package / "16-product-final-positive.json")
    positives = {
        "vision": vision_outline["visionEvidence"],
        "outline": vision_outline["outlineTaskStore"],
        "product": product_final["productAcceptance"],
        "human": product_final["humanReview"],
        "finalCandidate": product_final["finalizationCandidate"],
        "finalDisposition": product_final["finalDisposition"],
    }
    for key, schema_key in (("vision", "vision"), ("outline", "outline"), ("product", "product"), ("human", "human"), ("finalCandidate", "final"), ("finalDisposition", "final")):
        Draft202012Validator(schemas[schema_key]).validate(positives[key])
    validate_vision(positives["vision"])
    validate_outline(positives["outline"])
    validate_product(positives["product"])
    validate_human(positives["human"])
    validate_final(positives["finalCandidate"], positives["finalDisposition"])

    negatives = []
    candidate = copy.deepcopy(positives["vision"]); candidate["visionObservations"][0]["dispatchSequence"] = 1
    negatives.append(expect_rejected("vision-dispatch-gap", validate_vision, candidate))
    candidate = copy.deepcopy(positives["vision"]); candidate["consent"]["state"] = "not_granted"
    negatives.append(expect_rejected("vision-without-consent", validate_vision, candidate))
    candidate = copy.deepcopy(positives["outline"]); candidate["transactionReceipt"]["expectedRevision"] = candidate["transactionReceipt"]["committedRevision"]
    negatives.append(expect_rejected("outline-cas-replay", validate_outline, candidate))
    candidate = copy.deepcopy(positives["outline"]); candidate["outline"]["sections"][0]["startMs"] = candidate["outline"]["sections"][0]["endMs"]
    negatives.append(expect_rejected("outline-reversed-time", validate_outline, candidate))
    candidate = copy.deepcopy(positives["outline"]); candidate["timeline"][0]["sectionId"] = "section_deadbeefdeadbeef"
    negatives.append(expect_rejected("timeline-unresolved-section", validate_outline, candidate))
    candidate = copy.deepcopy(positives["product"]); candidate["routes"].pop()
    negatives.append(expect_rejected("product-route-shrink", validate_product, candidate))
    candidate = copy.deepcopy(positives["product"]); candidate["seekObservations"][0]["deltaMs"] = 1
    negatives.append(expect_rejected("product-seek-arithmetic", validate_product, candidate))
    candidate = copy.deepcopy(positives["product"]); candidate["seekObservations"][0]["requestedMs"] = candidate["taskBinding"]["mediaDurationMs"] + 1; candidate["seekObservations"][0]["observedMs"] = candidate["taskBinding"]["mediaDurationMs"] + 1; candidate["seekObservations"][0]["deltaMs"] = 0
    negatives.append(expect_rejected("product-seek-over-duration", validate_product, candidate))
    candidate = copy.deepcopy(positives["human"]); candidate["judgments"][0]["decision"] = "BLOCKED"
    negatives.append(expect_rejected("human-false-overall", validate_human, candidate))
    candidate = copy.deepcopy(positives["finalCandidate"]); candidate["samples"][1]["sourceIdentity"] = candidate["samples"][0]["sourceIdentity"]
    negatives.append(expect_rejected("final-source-reuse", lambda value: validate_final(value, positives["finalDisposition"]), candidate))
    require(all(item["rejected"] for item in negatives), "one or more semantic negatives were accepted")
    return {
        "schemaVersion": "v3-3-7-semantic-verifier-result/v1",
        "package": str(package),
        "schemaMetaPassed": len(schemas),
        "positiveInstancesPassed": len(positives),
        "semanticNegativeCases": negatives,
        "summary": {"total": len(negatives), "rejected": sum(item["rejected"] for item in negatives), "passed": True},
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--package", type=Path, default=Path("docs/active/project/external-audit-package"))
    args = parser.parse_args()
    try:
        result = run(args.package.resolve())
    except Exception as exc:
        print(json.dumps({"passed": False, "errorType": type(exc).__name__, "error": str(exc)}, ensure_ascii=False, indent=2))
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
