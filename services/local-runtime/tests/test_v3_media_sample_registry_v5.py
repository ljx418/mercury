from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, ValidationError

from navia_runtime.modules.media_companion.acquisition.sample_registry import (
    ROUTE_B3_SAMPLE_MATRIX,
    SampleRegistryError,
    build_revision5_registry,
)


FAULTS = {
    "BV13W41137qV": "subtitle_body_http_503",
    "BV1ZpYd66ELP": "subtitle_body_http_403",
    "BV1pW421c7DH": "subtitle_body_empty",
}


def observation(definition, *, no_subtitle_bvids: set[str]):
    is_asr = definition.primary_class == "asr"
    has_subtitle = definition.primary_class in {"subtitle", "multipart"} or (
        is_asr and definition.bvid not in no_subtitle_bvids
    )
    restricted = definition.primary_class == "restricted"
    body = {
        "bvid": definition.bvid,
        "cid": str(3000 + int(definition.sample_id[-2:])),
        "partId": "1",
        "partIndex": 1,
        "navigationStatus": 200,
        "pageStateCode": 0,
        "durationSeconds": 600,
        "partCount": 100 if definition.primary_class == "multipart" else 1,
        "subtitleItems": [{"id": "real", "language": "ai-zh"}] if has_subtitle else [],
        "subtitleHtmlContributorExcerpt": "字幕制作者" if has_subtitle else "",
        "restrictionSignals": ["充电专属", "即可观看"] if restricted else [],
        "viewApi": {"code": 0},
        "playerWbiApi": {"code": 0},
        "viewResponseSha256": "b" * 64,
        "playerWbiResponseSha256": "c" * 64,
        "screenshotPath": f"screenshots/{definition.bvid}.png",
        "screenshotSha256": "d" * 64,
        "observedAt": "2026-10-07T00:00:00Z",
    }
    if is_asr:
        count = 0 if definition.bvid in no_subtitle_bvids else 1
        body["routeB3Discovery"] = {
            "subtitleItemCount": count,
            "discoverySha256": definition.sample_id[-1] * 64,
            "observedAt": "2026-10-07T00:01:00Z",
        }
        if count:
            body["acceptanceFaultScenario"] = {
                "faultClass": definition.fault_class,
                "injectionLayer": "acceptance_orchestrator",
                "productionConfigReachable": False,
                "realMediaArtifactRequired": True,
            }
    return body


def raw_probe(no_subtitle_count: int = 1):
    asr_bvids = [item.bvid for item in ROUTE_B3_SAMPLE_MATRIX if item.primary_class == "asr"]
    no_subtitle_bvids = set(asr_bvids[:no_subtitle_count])
    return {
        "runId": "v3-2-route-b3-20261007T000000Z",
        "browser": {
            "name": "Google Chrome",
            "version": "154.0.8037.95",
            "profileClass": "user_authorized_temporary_v3_2",
        },
        "createdAt": "2026-10-07T00:00:00Z",
        "observations": [observation(item, no_subtitle_bvids=no_subtitle_bvids) for item in ROUTE_B3_SAMPLE_MATRIX],
    }


def build(raw):
    return build_revision5_registry(
        raw,
        {"serverValidationStatus": "valid", "sessionAuthenticated": True, "navCode": 0, "probeSha256": "e" * 64},
        build_tree_sha256="a" * 64,
        dependency_manifest_sha256="b" * 64,
        model_manifest_sha256="c" * 64,
        revision4_artifact={"path": "history/revision4.json", "sha256": "d" * 64},
    )


def schema():
    path = next(
        candidate / "docs/active/project/contracts/v3_media_acquisition_sample_registry_v5.schema.json"
        for candidate in Path(__file__).resolve().parents
        if (candidate / "docs/active/project/contracts/v3_media_acquisition_sample_registry_v5.schema.json").is_file()
    )
    return json.loads(path.read_text("utf-8"))


@pytest.mark.parametrize("no_subtitle_count", [0, 1, 2, 3])
def test_all_runtime_capability_distributions_are_schema_valid(no_subtitle_count):
    registry = build(raw_probe(no_subtitle_count))
    contract = schema()
    Draft202012Validator.check_schema(contract)
    Draft202012Validator(contract).validate(registry)
    assert registry["asrTriggerCounts"] == {
        "runtimeNoSubtitle": no_subtitle_count,
        "auditedSubtitleFailure": 3 - no_subtitle_count,
        "totalMediaFallback": 3,
    }


def test_zero_subtitle_slot_rejects_fault_and_positive_slot_requires_prebound_fault():
    raw = raw_probe(1)
    natural = next(item for item in raw["observations"] if item["bvid"] == "BV13W41137qV")
    natural["acceptanceFaultScenario"] = {
        "faultClass": "subtitle_body_http_503",
        "injectionLayer": "acceptance_orchestrator",
        "productionConfigReachable": False,
        "realMediaArtifactRequired": True,
    }
    with pytest.raises(SampleRegistryError, match="cannot apply a fault"):
        build(raw)

    raw = raw_probe(1)
    injected = next(item for item in raw["observations"] if item["bvid"] == "BV1ZpYd66ELP")
    injected["acceptanceFaultScenario"]["faultClass"] = "subtitle_body_empty"
    with pytest.raises(SampleRegistryError, match="outside Route B3"):
        build(raw)


def test_missing_receipt_duplicate_rows_and_platform_error_shape_fail_closed():
    raw = raw_probe(1)
    del next(item for item in raw["observations"] if item["bvid"] == "BV13W41137qV")["routeB3Discovery"]
    with pytest.raises(SampleRegistryError, match="lacks acquisition-time"):
        build(raw)

    raw = raw_probe(1)
    raw["observations"][-1] = copy.deepcopy(raw["observations"][0])
    with pytest.raises(SampleRegistryError, match="must be unique"):
        build(raw)

    raw = raw_probe(1)
    receipt = next(item for item in raw["observations"] if item["bvid"] == "BV13W41137qV")["routeB3Discovery"]
    receipt["subtitleItemCount"] = -1
    with pytest.raises(SampleRegistryError, match="discovery is invalid"):
        build(raw)


def test_schema_rejects_a_trigger_count_sum_other_than_three():
    registry = build(raw_probe(1))
    registry["asrTriggerCounts"] = {
        "runtimeNoSubtitle": 1,
        "auditedSubtitleFailure": 1,
        "totalMediaFallback": 3,
    }
    with pytest.raises(ValidationError):
        Draft202012Validator(schema()).validate(registry)
