"""Contract tests for shape-only V3-2-5..7 receipts.

The positive fixture intentionally uses repeating 64-character digest values. They
prove schema shape and denominator handling only; production evidence hashes must
always be derived from the sealed runtime run.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import jsonschema
import pytest


def find_repo_root() -> Path | None:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "docs/active/project/contracts/v3_media_transcript_exit_v1.schema.json"
        if candidate.is_file():
            return parent
    return None


ROOT = find_repo_root()
if ROOT is None:
    SCHEMA_PATH = Path(__file__).with_name("15-transcript-exit.schema.json")
    FIXTURE_PATH = Path(__file__).with_name("16-positive-fixture.json")
else:
    SCHEMA_PATH = ROOT / "docs/active/project/contracts/v3_media_transcript_exit_v1.schema.json"
    FIXTURE_PATH = ROOT / "docs/active/project/fixtures/v3-media-transcript-exit-positive.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


SCHEMA = load_json(SCHEMA_PATH)
POSITIVE = load_json(FIXTURE_PATH)
VALIDATOR = jsonschema.Draft202012Validator(SCHEMA)


def validate_ui_semantics(value: dict) -> None:
    assert {(item["surface"], item["viewport"]) for item in value["surfaces"]} == {
        ("side_panel", "360x900"),
        ("side_panel", "420x900"),
        ("workspace", "768x900"),
        ("workspace", "1280x900"),
    }
    assert {item["state"] for item in value["states"]} == {
        "acquiring",
        "awaiting_trusted_capture",
        "transcribing",
        "cleaning",
        "terminal",
    }
    assert [item["requirementId"] for item in value["requirements"]] == [
        f"V3-2-5-A{i:02d}" for i in range(1, 15)
    ]


def validate_fault_semantics(value: dict) -> None:
    assert [item["faultId"] for item in value["faults"]] == [
        f"V3-2-6-F{i:02d}" for i in range(1, 15)
    ]
    assert len({item["faultClass"] for item in value["faults"]}) == 14
    assert [item["requirementId"] for item in value["requirements"]] == [
        f"V3-2-6-A{i:02d}" for i in range(1, 13)
    ]


def validate_exit_semantics(value: dict) -> None:
    assert [item["requirementId"] for item in value["requirements"]] == [
        f"V3-2-A{i:02d}" for i in range(1, 21)
    ]
    assert [item["sampleId"] for item in value["samples"]] == [
        f"v3-sample-{i:02d}" for i in range(1, 13)
    ]
    assert len({item["sourceIdentity"] for item in value["samples"]}) == 12
    assert len({item["canonicalUrlSha256"] for item in value["samples"]}) == 12
    expected = {
        "subtitle": value["classificationCounts"]["subtitle"],
        "asr": value["classificationCounts"]["asr"],
        "multipart": value["classificationCounts"]["multipart"],
        "restricted": value["classificationCounts"]["restricted"],
        "low_signal": value["classificationCounts"]["lowSignal"],
    }
    actual = {key: sum(item["expectedClass"] == key for item in value["samples"]) for key in expected}
    assert actual == expected
    restricted = next(item for item in value["samples"] if item["expectedClass"] == "restricted")
    low_signal = next(item for item in value["samples"] if item["expectedClass"] == "low_signal")
    assert restricted["terminalState"] == "blocked" and restricted["transcriptSha256"] is None
    assert low_signal["terminalState"] == "degraded" and low_signal["transcriptSha256"] is None
    assert sum(item["selectedRoute"] == "trusted_tab_capture_asr" for item in value["samples"]) >= 1
    assert sum(item["expectedClass"] == "asr" and item["transcriptSha256"] is not None for item in value["samples"]) == 3


def test_schema_and_positive_receipts() -> None:
    jsonschema.Draft202012Validator.check_schema(SCHEMA)
    for value in POSITIVE.values():
        VALIDATOR.validate(value)
    validate_ui_semantics(POSITIVE["uiAcceptance"])
    validate_fault_semantics(POSITIVE["faultMatrix"])
    validate_exit_semantics(POSITIVE["exitCandidate"])


@pytest.mark.parametrize("field", ["cookieVisible", "privatePathVisible", "forbiddenV3ClaimVisible"])
def test_ui_rejects_private_or_early_claim(field: str) -> None:
    candidate = copy.deepcopy(POSITIVE["uiAcceptance"])
    candidate["states"][0][field] = True
    with pytest.raises(jsonschema.ValidationError):
        VALIDATOR.validate(candidate)


def test_ui_semantics_rejects_missing_viewport_or_state() -> None:
    candidate = copy.deepcopy(POSITIVE["uiAcceptance"])
    candidate["surfaces"][0]["viewport"] = "420x900"
    with pytest.raises(AssertionError):
        validate_ui_semantics(candidate)
    candidate = copy.deepcopy(POSITIVE["uiAcceptance"])
    candidate["states"][0]["state"] = "terminal"
    with pytest.raises(AssertionError):
        validate_ui_semantics(candidate)


@pytest.mark.parametrize(
    ("field", "value"),
    [("terminalCount", 2), ("postTerminalWriteCount", 1), ("residualCount", 1), ("secretHitCount", 1)],
)
def test_fault_matrix_rejects_false_cleanup(field: str, value: int) -> None:
    candidate = copy.deepcopy(POSITIVE["faultMatrix"])
    candidate["faults"][0][field] = value
    with pytest.raises(jsonschema.ValidationError):
        VALIDATOR.validate(candidate)


def test_fault_semantics_rejects_duplicate_or_missing_fault() -> None:
    candidate = copy.deepcopy(POSITIVE["faultMatrix"])
    candidate["faults"][1]["faultClass"] = candidate["faults"][0]["faultClass"]
    with pytest.raises(AssertionError):
        validate_fault_semantics(candidate)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("sampleCount", 11),
        ("captureCount", 0),
        ("fullAsrCount", 2),
        ("secretHitCount", 1),
        ("residualCount", 1),
        ("independentAuditStatus", "passed"),
        ("v3_2Passed", True),
    ],
)
def test_exit_candidate_rejects_early_or_incomplete_pass(field: str, value: object) -> None:
    candidate = copy.deepcopy(POSITIVE["exitCandidate"])
    candidate[field] = value
    with pytest.raises(jsonschema.ValidationError):
        VALIDATOR.validate(candidate)


def test_exit_semantics_rejects_denominator_reclassification_and_cross_run_reuse() -> None:
    candidate = copy.deepcopy(POSITIVE["exitCandidate"])
    candidate["samples"][0]["expectedClass"] = "asr"
    with pytest.raises(AssertionError):
        validate_exit_semantics(candidate)
    candidate = copy.deepcopy(POSITIVE["exitCandidate"])
    candidate["samples"][1]["sourceIdentity"] = candidate["samples"][0]["sourceIdentity"]
    with pytest.raises(AssertionError):
        validate_exit_semantics(candidate)


def test_exit_semantics_rejects_missing_real_capture_or_asr() -> None:
    candidate = copy.deepcopy(POSITIVE["exitCandidate"])
    capture = next(item for item in candidate["samples"] if item["selectedRoute"] == "trusted_tab_capture_asr")
    capture["selectedRoute"] = "credentialed_media_asr"
    with pytest.raises(AssertionError):
        validate_exit_semantics(candidate)
    candidate = copy.deepcopy(POSITIVE["exitCandidate"])
    asr = next(item for item in candidate["samples"] if item["expectedClass"] == "asr")
    asr["transcriptSha256"] = None
    with pytest.raises(AssertionError):
        validate_exit_semantics(candidate)
