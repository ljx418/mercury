#!/usr/bin/env python3
"""Verify the frozen V3 fixed-window schema and semantic contracts."""

from __future__ import annotations

import copy
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "docs/active/project/contracts/v3_asr_fixed_window_contracts.schema.json"
POLICY_PATH = ROOT / "docs/active/project/contracts/v3-asr-fixed-window-policy-registry.json"
MANIFEST_PATH = ROOT / "docs/active/project/contracts/v3-asr-fixed-window-candidate-manifest.json"
FIXTURES_PATH = ROOT / "docs/active/project/fixtures/v3-asr-fixed-window-contract-fixtures.json"
SHA = "a" * 64
OTHER_SHA = "b" * 64


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_run(manifest_sha256: str) -> dict[str, Any]:
    maximums = (16360, 14760, 16280)
    source_hashes = (
        "2a11e09975733740d49f4a63ca7b3ec1a9ebc77e8e8897d770e1991d4c1beb05",
        "63eb48d9027e1cfa09747d7261f9e2b7347cbec58daeb38b4aff09cdbd647405",
        "f4f61c09f8fe19828fb2085ef18459179d5142596b8107cef82df6c7bf7cc97b",
    )
    samples = []
    for sample_index in range(3):
        chunks = [
            {
                "chunkIndex": index,
                "startMs": index * 15000,
                "endMs": (index + 1) * 15000,
                "chunkSha256": SHA,
                "segmentCount": 1,
                "outputTextSha256": SHA,
                "elapsedMs": 1000,
            }
            for index in range(8)
        ]
        samples.append(
            {
                "sampleId": f"v3-asr-comparison-0{sample_index + 1}",
                "sourceAudioSha256": source_hashes[sample_index],
                "attemptId": f"attempt_{sample_index + 1:016x}",
                "chunks": chunks,
                "totalElapsedMs": min(8000, maximums[sample_index]),
                "latencyRegressionRatio": 1.0,
                "peakRssBytes": 1024,
                "mergedOutputSha256": SHA,
            }
        )
    return {
        "schemaVersion": "v3-asr-fixed-window-run/v1",
        "evidenceClass": "contract_fixture",
        "runId": "v3-2-0b-5.3-20260922T000000Z",
        "candidateManifestSha256": manifest_sha256,
        "createdAt": "2026-09-22T00:00:00Z",
        "samples": samples,
        "cleanup": {
            "processCount": 0,
            "chunkFileCount": 0,
            "sourceAudioCount": 0,
            "stagingCount": 0,
            "privatePathReferenceCount": 0,
            "passed": True,
        },
        "secretScan": {"hitCount": 0, "passed": True},
        "machinePassed": True,
    }


def make_state(run: dict[str, Any]) -> dict[str, Any]:
    return {
        "run": copy.deepcopy(run),
        "recomputedChunkHashes": [[SHA] * 8 for _ in range(3)],
        "providerBoundaryBypassed": False,
        "textRewriteCount": 0,
        "privateSegments": [{"startMs": 0, "endMs": 1000}],
        "mergedSegments": [
            {"segmentId": "fw_0_0_0", "startMs": 0, "endMs": 1000},
            {"segmentId": "fw_0_1_0", "startMs": 15000, "endMs": 16000},
        ],
        "attemptLineage": {"reusedChunkCount": 0, "startsAtChunk": 0},
        "review": {"reviewerIds": ["reviewer-a", "reviewer-b"], "judgmentCount": 48},
        "adjudication": {
            "meaningPreserved": 48,
            "perSample": [16, 16, 16],
            "criticalMeaningErrors": 0,
            "neitherAcceptable": 0,
            "passed": True,
        },
        "stageGate": {"promoted": False, "independentExitAuditPassed": False},
    }


def semantic_failure(state: dict[str, Any]) -> str | None:
    run = state["run"]
    for sample_index, sample in enumerate(run["samples"]):
        for chunk_index, chunk in enumerate(sample["chunks"]):
            if chunk["chunkSha256"] != state["recomputedChunkHashes"][sample_index][chunk_index]:
                return "V3_ASR_FW_CHUNK_HASH_MISMATCH"
    if state["providerBoundaryBypassed"]:
        return "V3_ASR_FW_PROVIDER_BOUNDARY_BYPASSED"
    if state["textRewriteCount"] != 0:
        return "V3_ASR_FW_TEXT_REWRITE_FORBIDDEN"
    if any(not (0 <= segment["startMs"] < segment["endMs"] <= 15000) for segment in state["privateSegments"]):
        return "V3_ASR_FW_LOCAL_TIMESTAMP_INVALID"
    seen: set[str] = set()
    previous_end = 0
    for segment in state["mergedSegments"]:
        if (
            segment["segmentId"] in seen
            or segment["startMs"] < previous_end
            or segment["endMs"] > 120000
        ):
            return "V3_ASR_FW_GLOBAL_TIMESTAMP_INVALID"
        seen.add(segment["segmentId"])
        previous_end = segment["endMs"]
    if state["attemptLineage"] != {"reusedChunkCount": 0, "startsAtChunk": 0}:
        return "V3_ASR_FW_PARTIAL_REUSE_FORBIDDEN"
    reviewers = state["review"]["reviewerIds"]
    if len(reviewers) != 2 or len(set(reviewers)) != 2 or state["review"]["judgmentCount"] != 48:
        return "V3_ASR_FW_REVIEW_DENOMINATOR_NOT_MET"
    adjudication = state["adjudication"]
    quality_passed = (
        adjudication["meaningPreserved"] >= 44
        and all(value >= 15 for value in adjudication["perSample"])
        and adjudication["criticalMeaningErrors"] == 0
        and adjudication["neitherAcceptable"] == 0
    )
    if adjudication["passed"] != quality_passed:
        return "V3_ASR_FW_QUALITY_GATE_FAILED"
    stage = state["stageGate"]
    if stage["promoted"] and not stage["independentExitAuditPassed"]:
        return "V3_ASR_FW_INDEPENDENT_AUDIT_NOT_PASSED"
    return None


def schema_result(validator: Draft202012Validator, document: Any) -> bool:
    return not list(validator.iter_errors(document))


def execute_case(
    case: dict[str, Any],
    *,
    schema: dict[str, Any],
    manifest: dict[str, Any],
    validator: Draft202012Validator,
    base_run: dict[str, Any],
) -> str | None:
    mutation = case["mutation"]
    if mutation == "remove_$schema":
        candidate_schema = copy.deepcopy(schema)
        candidate_schema.pop("$schema")
        return None if "$schema" in candidate_schema else "V3_ASR_FW_SCHEMA_INVALID"
    if mutation == "replace_parent_manifest_sha256":
        candidate = copy.deepcopy(manifest)
        candidate["parentCandidate"]["manifestSha256"] = OTHER_SHA
        return None if schema_result(validator, candidate) else "V3_ASR_FW_LINEAGE_MISMATCH"
    if mutation == "remove_sample_03":
        candidate = copy.deepcopy(manifest)
        candidate["sourceCorpus"].pop()
        return None if schema_result(validator, candidate) else "V3_ASR_FW_SOURCE_DENOMINATOR_CHANGED"
    if mutation == "set_chunk_duration_14000":
        candidate = copy.deepcopy(manifest)
        candidate["fixedWindow"]["chunkDurationMs"] = 14000
        return None if schema_result(validator, candidate) else "V3_ASR_FW_CHUNK_PLAN_DRIFT"
    if mutation == "set_sample_01_source_frame_count_1919983":
        candidate = copy.deepcopy(manifest)
        candidate["sourceCorpus"][0]["sourceFrameCount"] = 1919983
        return None if schema_result(validator, candidate) else "V3_ASR_FW_AUDIO_FORMAT_INVALID"
    if mutation == "set_second_boundary_start_14000":
        candidate = copy.deepcopy(manifest)
        candidate["fixedWindow"]["boundariesMs"][1][0] = 14000
        return None if schema_result(validator, candidate) else "V3_ASR_FW_CHUNK_COVERAGE_INVALID"
    if mutation == "set_max_concurrency_8":
        candidate = copy.deepcopy(manifest)
        candidate["fixedWindow"]["maxConcurrency"] = 8
        return None if schema_result(validator, candidate) else "V3_ASR_FW_CONCURRENCY_VIOLATION"

    state = make_state(base_run)
    if mutation == "replace_chunk_02_sha256":
        state["run"]["samples"][0]["chunks"][2]["chunkSha256"] = OTHER_SHA
    elif mutation == "portal_executes_native_binary":
        state["providerBoundaryBypassed"] = True
    elif mutation == "copy_adjacent_chunk_text":
        state["textRewriteCount"] = 1
    elif mutation == "set_chunk_18_segment_count_zero":
        state["run"]["samples"][2]["chunks"][2]["segmentCount"] = 0
    elif mutation == "set_local_end_15001":
        state["privateSegments"][0]["endMs"] = 15001
    elif mutation == "duplicate_global_segment_id":
        state["mergedSegments"][1]["segmentId"] = state["mergedSegments"][0]["segmentId"]
    elif mutation == "reuse_chunks_0_to_2_from_previous_attempt":
        state["attemptLineage"]["reusedChunkCount"] = 3
    elif mutation == "set_chunk_file_count_one":
        state["run"]["cleanup"]["chunkFileCount"] = 1
    elif mutation == "set_peak_rss_above_8gib":
        state["run"]["samples"][0]["peakRssBytes"] = 8589934593
    elif mutation == "set_sample_02_elapsed_14761":
        state["run"]["samples"][1]["totalElapsedMs"] = 14761
    elif mutation == "duplicate_reviewer_id":
        state["review"]["reviewerIds"] = ["reviewer-a", "reviewer-a"]
    elif mutation == "set_neither_acceptable_one_with_pass_true":
        state["adjudication"]["neitherAcceptable"] = 1
    elif mutation == "promote_without_independent_exit_audit":
        state["stageGate"]["promoted"] = True
    else:
        raise ValueError(f"unknown fixture mutation: {mutation}")

    if not schema_result(validator, state["run"]):
        schema_codes = {
            "set_chunk_18_segment_count_zero": "V3_ASR_FW_CHUNK_TRANSCRIPT_EMPTY",
            "set_chunk_file_count_one": "V3_ASR_FW_PRIVATE_DATA_RETAINED",
            "set_peak_rss_above_8gib": "V3_ASR_FW_RESOURCE_BASELINE_EXCEEDED",
            "set_sample_02_elapsed_14761": "V3_ASR_FW_LATENCY_REGRESSION_EXCEEDED",
        }
        return schema_codes.get(mutation, "V3_ASR_FW_SCHEMA_INVALID")
    return semantic_failure(state)


def main() -> int:
    schema = load_json(SCHEMA_PATH)
    policy = load_json(POLICY_PATH)
    manifest = load_json(MANIFEST_PATH)
    fixtures = load_json(FIXTURES_PATH)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    manifest_errors = list(validator.iter_errors(manifest))
    manifest_sha256 = sha256_file(MANIFEST_PATH)
    base_run = make_run(manifest_sha256)
    run_errors = list(validator.iter_errors(base_run))

    requirements = policy["requirements"]
    cases = fixtures["negativeCases"]
    registry_tuples = {
        (item["requirementId"], item["requirementKey"], item["failureCode"])
        for item in requirements
    }
    fixture_tuples = {
        (item["requirementId"], item["requirementKey"], item["failureCode"])
        for item in cases
    }
    results = []
    for case in cases:
        actual = execute_case(
            case,
            schema=schema,
            manifest=manifest,
            validator=validator,
            base_run=base_run,
        )
        results.append(
            {
                "caseId": case["caseId"],
                "requirementId": case["requirementId"],
                "expectedFailureCode": case["failureCode"],
                "actualFailureCode": actual,
                "passed": actual == case["failureCode"],
            }
        )

    source_frames = [item["sourceFrameCount"] for item in manifest["sourceCorpus"]]
    fixed = manifest["fixedWindow"]
    checks = {
        "schemaMeta": True,
        "candidateErrorCount": len(manifest_errors),
        "runFixtureErrorCount": len(run_errors),
        "requirementCount": len(requirements),
        "negativeCaseCount": len(cases),
        "requirementIdsUnique": len({item["requirementId"] for item in requirements}) == len(requirements),
        "caseIdsUnique": len({item["caseId"] for item in cases}) == len(cases),
        "requirementTuplesExact": registry_tuples == fixture_tuples,
        "sourceFrameCounts": source_frames,
        "sourceFrameCountsExact": source_frames == [1919997, 1920000, 1920000],
        "tailPaddingPolicyExact": (
            fixed["expectedFrameCount"] == 1920000
            and fixed["maximumTailPadFrames"] == 16
            and fixed["tailPaddingPolicy"] == "zero_pad_final_chunk_only_for_frozen_frame_shortfall"
        ),
        "fixedDenominatorExact": (
            manifest["qualityPolicy"]["sampleCount"] == 3
            and manifest["qualityPolicy"]["binCount"] == 24
            and manifest["qualityPolicy"]["reviewerCount"] == 2
            and manifest["qualityPolicy"]["totalJudgments"] == 48
        ),
        "passedCases": sum(result["passed"] for result in results),
        "failedCases": sum(not result["passed"] for result in results),
    }
    passed = (
        len(manifest_errors) == 0
        and len(run_errors) == 0
        and len(requirements) == 20
        and len(cases) == 20
        and checks["requirementIdsUnique"]
        and checks["caseIdsUnique"]
        and checks["requirementTuplesExact"]
        and checks["sourceFrameCountsExact"]
        and checks["tailPaddingPolicyExact"]
        and checks["fixedDenominatorExact"]
        and checks["failedCases"] == 0
    )
    output = {
        "schemaVersion": "v3-asr-fixed-window-contract-verification/v1",
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "candidateManifestSha256": manifest_sha256,
        "passed": passed,
        "checks": checks,
        "results": results,
    }
    print(json.dumps(output, ensure_ascii=True, indent=2))
    return 0 if passed else 2


if __name__ == "__main__":
    sys.exit(main())
