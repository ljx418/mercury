#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from collections import Counter
from pathlib import Path

import jsonschema


REPO = Path(__file__).resolve().parents[6]
SCHEMA = REPO / "docs/active/project/contracts/v3_media_workspace_comprehension_v1.schema.json"
SEMANTIC = Path(__file__).with_name("v3-5.1-semantic-verifier.py")
HUMAN_REVIEW_SCHEMA = Path(__file__).with_name("production-candidate") / "human-review" / "review-submission.schema.json"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def semantic_errors(value: dict) -> set[str]:
    spec = importlib.util.spec_from_file_location("v351_semantic_verifier", SEMANTIC)
    if spec is None or spec.loader is None:
        raise RuntimeError("semantic verifier could not be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.semantic_errors(value)


def human_review_errors(review: dict, candidates: list[dict], candidate_hashes: list[str]) -> list[str]:
    errors: list[str] = []
    expected_questions = {
        (index, item["questionId"])
        for index, candidate in enumerate(candidates, start=1)
        for item in candidate["askBenchmark"]
    }
    actual_questions = {
        (item["candidateIndex"], item["questionId"])
        for item in review["askJudgments"]
    }
    if actual_questions != expected_questions or len(review["askJudgments"]) != len(expected_questions):
        errors.append("V351_HUMAN_ASK_DENOMINATOR_INVALID")
    if review["candidateSha256"] != candidate_hashes:
        errors.append("V351_HUMAN_CANDIDATE_BINDING_INVALID")
    experience_ids = [item["requirementId"] for item in review["experienceJudgments"]]
    if sorted(experience_ids) != ["UX01", "UX02", "UX03", "UX04", "UX05"] or len(set(experience_ids)) != 5:
        errors.append("V351_HUMAN_EXPERIENCE_DENOMINATOR_INVALID")
    question_failed = any(
        item["criticalMeaningError"] or not item["citationSupported"]
        for item in review["askJudgments"]
    )
    experience_failed = any(item["decision"] == "FAIL" for item in review["experienceJudgments"])
    experience_blocked = any(item["decision"] == "BLOCKED" for item in review["experienceJudgments"])
    expected_overall = "FAIL" if question_failed or experience_failed else "BLOCKED" if experience_blocked else "PASS"
    if review["overallDecision"] != expected_overall:
        errors.append("V351_HUMAN_OVERALL_DECISION_INVALID")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--human-review", type=Path)
    args = parser.parse_args()
    root = args.run_root.resolve()
    schema = load(SCHEMA)
    jsonschema.Draft202012Validator.check_schema(schema)
    validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
    browser = load(root / "browser-verification-result.json")
    results = []
    candidates = []
    candidate_hashes = []
    identity_sets: dict[str, list[set[str]]] = {"taskId": [], "outlineId": [], "evidenceId": []}
    for index in range(1, 4):
        target = root / f"candidate-{index}.json"
        candidate = load(target)
        candidates.append(candidate)
        candidate_hashes.append(sha256(target))
        schema_errors = sorted(error.message for error in validator.iter_errors(candidate))
        semantic = sorted(semantic_errors(candidate))
        origins = Counter(item["origin"] for item in candidate["playbackObservations"])
        browser_row = next((item for item in browser["results"] if item["candidateIndex"] == index), None)
        hash_matches = browser_row is not None and browser_row["candidateSha256"] == sha256(target)
        identity_sets["taskId"].append({candidate["task"]["taskId"]})
        identity_sets["outlineId"].append({candidate["task"]["outlineId"]})
        identity_sets["evidenceId"].append({item["evidenceId"] for item in candidate["evidenceCatalog"]})
        passed = (
            not schema_errors
            and not semantic
            and hash_matches
            and len(candidate["playbackObservations"]) == 10
            and all(origins[name] == 2 for name in ("chapter", "moment", "frame", "mindmap_node", "ask_citation"))
        )
        results.append({
            "candidateIndex": index,
            "candidateSha256": sha256(target),
            "schemaErrorCount": len(schema_errors),
            "schemaErrors": schema_errors,
            "semanticErrors": semantic,
            "playbackObservationCount": len(candidate["playbackObservations"]),
            "originCounts": dict(sorted(origins.items())),
            "browserHashMatches": hash_matches,
            "passed": passed,
        })

    cross_candidate_isolation = all(
        not identity_sets[key][left].intersection(identity_sets[key][right])
        for key in identity_sets
        for left in range(3)
        for right in range(left + 1, 3)
    )
    machine_passed = browser.get("passed") is True and browser.get("candidateCount") == 3 and cross_candidate_isolation and all(item["passed"] for item in results)
    human_review_present = args.human_review is not None and args.human_review.is_file()
    human_review_valid = False
    review_errors: list[str] = []
    review_sha256 = None
    if human_review_present:
        review = load(args.human_review)
        review_schema = load(HUMAN_REVIEW_SCHEMA)
        jsonschema.Draft202012Validator.check_schema(review_schema)
        review_schema_errors = sorted(
            error.message
            for error in jsonschema.Draft202012Validator(
                review_schema,
                format_checker=jsonschema.FormatChecker(),
            ).iter_errors(review)
        )
        review_errors.extend(f"SCHEMA:{message}" for message in review_schema_errors)
        if not review_schema_errors:
            if review.get("runId") != browser.get("runId"):
                review_errors.append("V351_HUMAN_RUN_BINDING_INVALID")
            review_errors.extend(human_review_errors(review, candidates, candidate_hashes))
            human_review_valid = not review_errors and review.get("overallDecision") == "PASS"
        review_sha256 = sha256(args.human_review)
    passed = machine_passed and human_review_valid
    report = {
        "schemaVersion": "v3-5.1-production-candidate-verification/v1",
        "runId": browser.get("runId"),
        "schemaMetaPassed": True,
        "candidateCount": len(results),
        "crossCandidateIsolation": cross_candidate_isolation,
        "browserVerificationPassed": browser.get("passed") is True,
        "machinePassed": machine_passed,
        "humanQualityReviewPresent": human_review_present,
        "humanQualityReviewValid": human_review_valid,
        "humanQualityReviewSha256": review_sha256,
        "humanQualityReviewErrors": review_errors,
        "results": results,
        "status": "PASS" if passed else "HUMAN_REVIEW_PENDING" if machine_passed and not human_review_present else "FAIL",
        "passed": passed,
    }
    output = root / "production-verification-result.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if passed else 3 if machine_passed and not human_review_present else 2


if __name__ == "__main__":
    raise SystemExit(main())
