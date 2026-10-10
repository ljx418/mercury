#!/usr/bin/env python3
"""Convert blind-side reviews into the frozen provider qualification contracts."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import stat
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


SAMPLE_IDS = {"v3-asr-comparison-01", "v3-asr-comparison-02", "v3-asr-comparison-03"}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"V3_ASR_REVIEW_OBJECT_REQUIRED:{path.name}")
    return value


def validate_blind_review(value: dict[str, Any], bundle_sha256: str) -> None:
    if value.get("schemaVersion") != "v3-asr-blind-side-review/v1" or value.get("bundleSha256") != bundle_sha256:
        raise ValueError("V3_ASR_REVIEW_BINDING_MISMATCH")
    judgments = value.get("judgments")
    if not isinstance(judgments, list) or len(judgments) != 24:
        raise ValueError("V3_ASR_REVIEW_DENOMINATOR_MISMATCH")
    keys = {(row.get("sampleId"), row.get("binIndex")) for row in judgments}
    expected = {(sample_id, index) for sample_id in SAMPLE_IDS for index in range(8)}
    if keys != expected:
        raise ValueError("V3_ASR_REVIEW_KEY_SET_MISMATCH")


def map_choice(choice: str, candidate_side: str) -> str:
    if choice in {"equivalent", "neither_acceptable"}:
        return choice
    if choice == "side_a_better":
        return "candidate_better" if candidate_side == "side_a" else "baseline_better"
    if choice == "side_b_better":
        return "candidate_better" if candidate_side == "side_b" else "baseline_better"
    raise ValueError("V3_ASR_REVIEW_CHOICE_INVALID")


def convert_judgment(row: dict[str, Any], label_map: dict[str, str]) -> dict[str, Any]:
    sample_id = row["sampleId"]
    candidate_side = label_map[sample_id]
    candidate_key = "sideAMeaningPreserved" if candidate_side == "side_a" else "sideBMeaningPreserved"
    baseline_key = "sideBMeaningPreserved" if candidate_side == "side_a" else "sideAMeaningPreserved"
    return {
        "sampleId": sample_id,
        "binIndex": row["binIndex"],
        "choice": map_choice(row["choice"], candidate_side),
        "candidateMeaningPreserved": row[candidate_key],
        "baselineMeaningPreserved": row[baseline_key],
        "criticalMeaningError": row["criticalMeaningError"],
        "errorCodes": sorted(set(row["errorCodes"])),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--label-map", type=Path, required=True)
    parser.add_argument("--review-a", type=Path, required=True)
    parser.add_argument("--review-b", type=Path, required=True)
    parser.add_argument("--blind-adjudication", type=Path, required=True)
    parser.add_argument("--contract-schema", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()

    bundle_sha256 = sha256_file(args.bundle)
    mapping_document = load(args.label_map)
    if mapping_document.get("bundleSha256") != bundle_sha256:
        raise ValueError("V3_ASR_LABEL_MAP_BINDING_MISMATCH")
    label_map = {row["sampleId"]: row["candidateSide"] for row in mapping_document["samples"]}
    if set(label_map) != SAMPLE_IDS or any(side not in {"side_a", "side_b"} for side in label_map.values()):
        raise ValueError("V3_ASR_LABEL_MAP_INVALID")

    reviews = [load(args.review_a), load(args.review_b)]
    for review in reviews:
        validate_blind_review(review, bundle_sha256)
    reviewer_ids = [review["reviewerId"] for review in reviews]
    if len(set(reviewer_ids)) != 2:
        raise ValueError("V3_ASR_REVIEWERS_NOT_DISTINCT")

    blind_adjudication = load(args.blind_adjudication)
    if blind_adjudication.get("schemaVersion") != "v3-asr-blind-side-adjudication/v1" or blind_adjudication.get("bundleSha256") != bundle_sha256:
        raise ValueError("V3_ASR_ADJUDICATION_BINDING_MISMATCH")
    adjudicator_id = blind_adjudication.get("adjudicatorId")
    if adjudicator_id in reviewer_ids:
        raise ValueError("V3_ASR_ADJUDICATOR_NOT_DISTINCT")
    if blind_adjudication.get("reviewerIds") != reviewer_ids:
        raise ValueError("V3_ASR_ADJUDICATION_REVIEWER_BINDING_MISMATCH")
    expected_review_hashes = [sha256_file(args.review_a), sha256_file(args.review_b)]
    if blind_adjudication.get("reviewSha256s") != expected_review_hashes:
        raise ValueError("V3_ASR_ADJUDICATION_REVIEW_HASH_MISMATCH")

    converted_reviews = []
    for review in reviews:
        converted_reviews.append({
            "schemaVersion": "v3-asr-provider-qualification-review/v1",
            "bundleSha256": bundle_sha256,
            "reviewerId": review["reviewerId"],
            "reviewerRole": "independent_human_listener",
            "submittedAt": review["submittedAt"],
            "judgments": [convert_judgment(row, label_map) for row in review["judgments"]],
        })

    independent = [row for review in converted_reviews for row in review["judgments"]]
    candidate_count = sum(row["candidateMeaningPreserved"] for row in independent)
    per_sample = [sum(row["candidateMeaningPreserved"] for row in independent if row["sampleId"] == sample_id) for sample_id in sorted(SAMPLE_IDS)]
    critical_count = sum(row["criticalMeaningError"] for row in independent)
    neither_count = sum(row["choice"] == "neither_acceptable" for row in independent)

    first_map = {(row["sampleId"], row["binIndex"]): row for row in reviews[0]["judgments"]}
    second_map = {(row["sampleId"], row["binIndex"]): row for row in reviews[1]["judgments"]}
    fields = ("choice", "sideAMeaningPreserved", "sideBMeaningPreserved", "criticalMeaningError", "errorCodes")
    disagreement_keys = {key for key in first_map if any(first_map[key][field] != second_map[key][field] for field in fields)}
    raw_resolutions = blind_adjudication.get("disagreementResolutions")
    resolution_keys = {(row.get("sampleId"), row.get("binIndex")) for row in raw_resolutions or []}
    if resolution_keys != disagreement_keys:
        raise ValueError("V3_ASR_ADJUDICATION_RESOLUTION_SET_MISMATCH")
    resolutions = [{
        "sampleId": row["sampleId"],
        "binIndex": row["binIndex"],
        "resolution": map_choice(row["resolution"], label_map[row["sampleId"]]) if row["resolution"] != "reviewer_disagreement_retained" else row["resolution"],
        "note": row["note"],
    } for row in raw_resolutions]

    passed = candidate_count >= 44 and min(per_sample) >= 15 and critical_count == 0 and neither_count == 0
    adjudication = {
        "schemaVersion": "v3-asr-provider-qualification-adjudication/v1",
        "bundleSha256": bundle_sha256,
        "reviewerIds": reviewer_ids,
        "reviewSha256s": expected_review_hashes,
        "adjudicatorId": adjudicator_id,
        "submittedAt": blind_adjudication["submittedAt"],
        "disagreementResolutions": resolutions,
        "summary": {
            "totalIndependentJudgments": 48,
            "uniqueReviewerBinKeys": 48,
            "uniqueSampleBinKeys": 24,
            "reviewerIdsDistinct": True,
            "adjudicatorDistinct": True,
            "candidateMeaningPreservedCount": candidate_count,
            "perSampleMinimumCount": min(per_sample),
            "criticalMeaningErrorCount": critical_count,
            "neitherAcceptableCount": neither_count,
            "disagreementCount": len(disagreement_keys),
            "resolutionCount": len(resolutions),
        },
        "passed": passed,
    }

    schema = load(args.contract_schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    for document in [*converted_reviews, adjudication]:
        errors = sorted(validator.iter_errors(document), key=lambda item: list(item.path))
        if errors:
            raise ValueError(f"V3_ASR_QUALIFICATION_SCHEMA_FAILED:{errors[0].message}")

    args.output_root.mkdir(parents=True, exist_ok=False)
    args.output_root.chmod(stat.S_IRWXU)
    for index, review in enumerate(converted_reviews, start=1):
        output = args.output_root / f"qualification-review-{index}.json"
        output.write_text(json.dumps(review, indent=2) + "\n", encoding="utf-8")
        output.chmod(stat.S_IRUSR | stat.S_IWUSR)
    output = args.output_root / "qualification-adjudication.json"
    output.write_text(json.dumps(adjudication, indent=2) + "\n", encoding="utf-8")
    output.chmod(stat.S_IRUSR | stat.S_IWUSR)
    print(json.dumps(adjudication["summary"] | {"passed": passed}, indent=2))
    return 0 if passed else 2


if __name__ == "__main__":
    raise SystemExit(main())
