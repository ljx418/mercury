from __future__ import annotations

import copy
import json
from pathlib import Path

import jsonschema
import pytest


ROOT = Path(__file__).resolve().parents[3]
CONTRACTS = ROOT / "docs/active/project/contracts"
FIXTURES = ROOT / "docs/active/project/fixtures"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


PRODUCT_SCHEMA = load_json(CONTRACTS / "v3_media_product_acceptance_v1.schema.json")
PRODUCT_SCHEMA_V2 = load_json(CONTRACTS / "v3_media_product_acceptance_v2.schema.json")
HUMAN_SCHEMA = load_json(CONTRACTS / "v3_media_human_review_v1.schema.json")
FINAL_SCHEMA = load_json(CONTRACTS / "v3_media_finalization_v1.schema.json")
POSITIVE = load_json(FIXTURES / "v3-media-product-final-positive.json")


def product_v2_positive() -> dict:
    value = copy.deepcopy(POSITIVE["productAcceptance"])
    value["schemaVersion"] = "v3-media-product-acceptance/v2"
    value["taskExecution"] = {
        "registryClass": "subtitle",
        "observedRoute": "credentialed_media_asr",
        "routeDrift": True,
        "fallbackReasonCodes": ["SUBTITLE_UNAVAILABLE_AT_EXECUTION"],
        "resourceNotice": {
            "shown": True,
            "localAsr": True,
            "expectedWaitClass": "long",
            "cpuImpact": "high",
            "memoryMiB": 1536,
            "temporaryDiskBytes": 33554432,
            "cancelAvailable": True,
            "temporaryMediaDeleted": True,
        },
    }
    return value


def validate_product_v2_semantics(value: dict) -> None:
    validate_product_semantics(value)
    execution = value["taskExecution"]
    expected_routes = {
        "subtitle": {"credentialed_subtitle", "public_or_page_subtitle"},
        "asr": {"credentialed_media_asr", "trusted_tab_capture_asr"},
        "multipart": {"credentialed_media_asr", "trusted_tab_capture_asr"},
        "restricted": {"blocked"},
        "low_signal": {"visual_low_signal"},
    }
    drift = execution["observedRoute"] not in expected_routes[execution["registryClass"]]
    assert execution["routeDrift"] is drift
    assert bool(execution["fallbackReasonCodes"]) is drift
    notice = execution["resourceNotice"]
    is_local_asr = execution["observedRoute"] in {"credentialed_media_asr", "trusted_tab_capture_asr"}
    assert notice["localAsr"] is is_local_asr
    if is_local_asr:
        assert notice["shown"] is True
        assert notice["expectedWaitClass"] != "none"
        assert notice["cpuImpact"] != "none"
        assert notice["memoryMiB"] > 0
        assert notice["temporaryDiskBytes"] > 0
        assert notice["cancelAvailable"] is True
        assert notice["temporaryMediaDeleted"] is True
    else:
        assert notice == {
            "shown": False,
            "localAsr": False,
            "expectedWaitClass": "none",
            "cpuImpact": "none",
            "memoryMiB": 0,
            "temporaryDiskBytes": 0,
            "cancelAvailable": False,
            "temporaryMediaDeleted": True,
        }


def validate_product_semantics(value: dict) -> None:
    surfaces = {(item["surface"], item["viewport"]) for item in value["surfaces"]}
    assert surfaces == {
        ("side_panel", "360x900"),
        ("side_panel", "420x900"),
        ("workspace", "768x900"),
        ("workspace", "1280x900"),
    }
    requirement_ids = [item["requirementId"] for item in value["requirements"]]
    assert requirement_ids == [f"V3-5-A{i:02d}" for i in range(1, 19)]
    assert {item["format"] for item in value["exports"]} == {"markdown_zip", "json_bundle"}
    assert {item["origin"] for item in value["seekObservations"]} == {
        "outline",
        "timeline",
        "mindmap",
        "ask_citation",
        "evidence_drawer",
    }
    for item in value["seekObservations"]:
        assert item["deltaMs"] == abs(item["observedMs"] - item["requestedMs"])
        assert item["requestedMs"] <= value["taskBinding"]["mediaDurationMs"]
        assert item["observedMs"] <= value["taskBinding"]["mediaDurationMs"]
        if item["outcome"] == "located":
            assert item["pageIdentityMatched"] is True
            assert abs(item["observedMs"] - item["requestedMs"]) <= 2000


def validate_human_semantics(value: dict) -> None:
    ids = [item["requirementId"] for item in value["judgments"]]
    assert ids == [f"H{i:02d}" for i in range(1, 11)]
    decisions = [item["decision"] for item in value["judgments"]]
    expected = "PASS" if all(item == "PASS" for item in decisions) else "FAIL"
    if "BLOCKED" in decisions:
        expected = "BLOCKED"
    assert value["overallDecision"] == expected


def validate_final_semantics(candidate: dict, disposition: dict) -> None:
    ids = [item["requirementId"] for item in candidate["requirements"]]
    assert ids == [f"V3-6-A{i:02d}" for i in range(1, 21)]
    assert sum(candidate["classificationCounts"].values()) == candidate["sampleCount"] == 12
    samples = candidate["samples"]
    assert [item["sampleId"] for item in samples] == [f"v3-sample-{i:02d}" for i in range(1, 13)]
    assert len({item["sourceIdentity"] for item in samples}) == 12
    assert len({item["canonicalUrlSha256"] for item in samples}) == 12
    expected_counts = {
        "subtitle": candidate["classificationCounts"]["subtitle"],
        "asr": candidate["classificationCounts"]["asr"],
        "multipart": candidate["classificationCounts"]["multipart"],
        "restricted": candidate["classificationCounts"]["restricted"],
        "low_signal": candidate["classificationCounts"]["lowSignal"],
    }
    actual_counts = {key: sum(item["expectedClass"] == key for item in samples) for key in expected_counts}
    assert actual_counts == expected_counts
    assert all(
        (item["expectedClass"] == "restricted") == (item["terminalStatus"] == "blocked")
        for item in samples
    )
    assert all(
        (item["expectedClass"] == "low_signal") == (item["terminalStatus"] == "degraded")
        for item in samples
    )
    assert candidate["candidateId"] == disposition["candidateId"]
    assert candidate["finalPassed"] is False
    assert disposition["finalPassed"] is True


def test_product_human_final_schemas_and_positive_fixture() -> None:
    for schema in (PRODUCT_SCHEMA, PRODUCT_SCHEMA_V2, HUMAN_SCHEMA, FINAL_SCHEMA):
        jsonschema.Draft202012Validator.check_schema(schema)
    jsonschema.Draft202012Validator(PRODUCT_SCHEMA).validate(POSITIVE["productAcceptance"])
    jsonschema.Draft202012Validator(HUMAN_SCHEMA).validate(POSITIVE["humanReview"])
    jsonschema.Draft202012Validator(FINAL_SCHEMA).validate(POSITIVE["finalizationCandidate"])
    jsonschema.Draft202012Validator(FINAL_SCHEMA).validate(POSITIVE["finalDisposition"])
    validate_product_semantics(POSITIVE["productAcceptance"])
    validate_human_semantics(POSITIVE["humanReview"])
    validate_final_semantics(POSITIVE["finalizationCandidate"], POSITIVE["finalDisposition"])


def test_product_v2_accepts_observed_asr_fallback_with_resource_notice() -> None:
    candidate = product_v2_positive()
    jsonschema.Draft202012Validator(PRODUCT_SCHEMA_V2).validate(candidate)
    validate_product_v2_semantics(candidate)


@pytest.mark.parametrize(
    ("mutation", "schema_failure"),
    [
        (lambda value: value["taskExecution"].update({"routeDrift": False}), True),
        (lambda value: value["taskExecution"].update({"fallbackReasonCodes": []}), True),
        (lambda value: value["taskExecution"]["resourceNotice"].update({"shown": False}), True),
        (lambda value: value["taskExecution"]["resourceNotice"].update({"localAsr": False}), True),
        (lambda value: value["taskExecution"]["resourceNotice"].update({"cancelAvailable": False}), True),
        (lambda value: value["taskExecution"]["resourceNotice"].update({"temporaryMediaDeleted": False}), True),
        (lambda value: value["taskExecution"]["resourceNotice"].update({"memoryMiB": 0}), False),
        (lambda value: value["taskExecution"]["resourceNotice"].update({"temporaryDiskBytes": 0}), False),
    ],
)
def test_product_v2_rejects_route_drift_false_green(mutation, schema_failure: bool) -> None:
    candidate = product_v2_positive()
    mutation(candidate)
    if schema_failure:
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.Draft202012Validator(PRODUCT_SCHEMA_V2).validate(candidate)
    else:
        jsonschema.Draft202012Validator(PRODUCT_SCHEMA_V2).validate(candidate)
        with pytest.raises(AssertionError):
            validate_product_v2_semantics(candidate)


def test_product_v2_accepts_true_subtitle_fast_path_without_resource_cost() -> None:
    candidate = product_v2_positive()
    candidate["taskExecution"] = {
        "registryClass": "subtitle",
        "observedRoute": "credentialed_subtitle",
        "routeDrift": False,
        "fallbackReasonCodes": [],
        "resourceNotice": {
            "shown": False,
            "localAsr": False,
            "expectedWaitClass": "none",
            "cpuImpact": "none",
            "memoryMiB": 0,
            "temporaryDiskBytes": 0,
            "cancelAvailable": False,
            "temporaryMediaDeleted": True,
        },
    }
    jsonschema.Draft202012Validator(PRODUCT_SCHEMA_V2).validate(candidate)
    validate_product_v2_semantics(candidate)


def test_product_rejects_mocked_machine_pass_and_v4_import() -> None:
    candidate = copy.deepcopy(POSITIVE["productAcceptance"])
    candidate["machinePassed"] = False
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(PRODUCT_SCHEMA).validate(candidate)
    candidate = copy.deepcopy(POSITIVE["productAcceptance"])
    candidate["exports"][0]["knowledgeImportStatus"] = "imported"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(PRODUCT_SCHEMA).validate(candidate)


def test_product_rejects_false_seek_and_requirement_shrink() -> None:
    candidate = copy.deepcopy(POSITIVE["productAcceptance"])
    candidate["seekObservations"][0]["observedMs"] += 5000
    with pytest.raises(AssertionError):
        validate_product_semantics(candidate)
    candidate = copy.deepcopy(POSITIVE["productAcceptance"])
    candidate["seekObservations"][0]["deltaMs"] = 5001
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(PRODUCT_SCHEMA).validate(candidate)
    candidate = copy.deepcopy(POSITIVE["productAcceptance"])
    candidate["seekObservations"][0]["pageIdentityMatched"] = False
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(PRODUCT_SCHEMA).validate(candidate)
    candidate = copy.deepcopy(POSITIVE["productAcceptance"])
    candidate["seekObservations"][0]["requestedMs"] = candidate["taskBinding"]["mediaDurationMs"] + 1
    candidate["seekObservations"][0]["observedMs"] = candidate["taskBinding"]["mediaDurationMs"] + 1
    candidate["seekObservations"][0]["deltaMs"] = 0
    with pytest.raises(AssertionError):
        validate_product_semantics(candidate)
    candidate = copy.deepcopy(POSITIVE["productAcceptance"])
    candidate["requirements"].pop()
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(PRODUCT_SCHEMA).validate(candidate)


def test_human_review_rejects_missing_or_automatic_judgment() -> None:
    candidate = copy.deepcopy(POSITIVE["humanReview"])
    candidate["judgments"].pop()
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(HUMAN_SCHEMA).validate(candidate)
    candidate = copy.deepcopy(POSITIVE["humanReview"])
    candidate["reviewerRole"] = "automation"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(HUMAN_SCHEMA).validate(candidate)


def test_human_review_semantics_rejects_false_overall_pass() -> None:
    candidate = copy.deepcopy(POSITIVE["humanReview"])
    candidate["judgments"][0]["decision"] = "FAIL"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(HUMAN_SCHEMA).validate(candidate)
    with pytest.raises(AssertionError):
        validate_human_semantics(candidate)


def test_human_review_schema_enforces_blocked_precedence() -> None:
    candidate = copy.deepcopy(POSITIVE["humanReview"])
    candidate["judgments"][0]["decision"] = "FAIL"
    candidate["judgments"][1]["decision"] = "BLOCKED"
    candidate["overallDecision"] = "FAIL"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(HUMAN_SCHEMA).validate(candidate)


def test_final_candidate_cannot_claim_final_pass() -> None:
    candidate = copy.deepcopy(POSITIVE["finalizationCandidate"])
    candidate["finalPassed"] = True
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(FINAL_SCHEMA).validate(candidate)


def test_final_candidate_rejects_duplicate_or_reclassified_sample() -> None:
    candidate = copy.deepcopy(POSITIVE["finalizationCandidate"])
    candidate["samples"][1]["sourceIdentity"] = candidate["samples"][0]["sourceIdentity"]
    with pytest.raises(AssertionError):
        validate_final_semantics(candidate, POSITIVE["finalDisposition"])
    candidate = copy.deepcopy(POSITIVE["finalizationCandidate"])
    candidate["samples"][0]["expectedClass"] = "asr"
    with pytest.raises(AssertionError):
        validate_final_semantics(candidate, POSITIVE["finalDisposition"])


@pytest.mark.parametrize(
    ("field", "value"),
    [("secretHitCount", 1), ("residualCount", 1), ("sampleCount", 11), ("humanReviewStatus", "FAIL")],
)
def test_final_candidate_rejects_false_green(field: str, value: object) -> None:
    candidate = copy.deepcopy(POSITIVE["finalizationCandidate"])
    candidate[field] = value
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(FINAL_SCHEMA).validate(candidate)


def test_final_disposition_requires_zero_fatal_major_and_exact_claim() -> None:
    candidate = copy.deepcopy(POSITIVE["finalDisposition"])
    candidate["majorCount"] = 1
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(FINAL_SCHEMA).validate(candidate)
    candidate = copy.deepcopy(POSITIVE["finalDisposition"])
    candidate["allowedClaim"] = "V3 complete on every portal"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(FINAL_SCHEMA).validate(candidate)
