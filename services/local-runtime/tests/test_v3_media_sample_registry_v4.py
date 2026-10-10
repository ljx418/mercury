from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from navia_runtime.modules.media_companion.acquisition.sample_registry import (
    ROUTE_B_SAMPLE_MATRIX,
    SampleRegistryError,
    build_revision4_registry,
)


def observation(definition):
    subtitle = definition.primary_class == "subtitle" or definition.asr_trigger_class == "audited_subtitle_failure"
    restricted = definition.primary_class == "restricted"
    part_count = 100 if definition.primary_class == "multipart" else 1
    body = {
        "bvid": definition.bvid, "cid": str(2000 + int(definition.sample_id[-2:])),
        "partId": "1", "partIndex": 1, "navigationStatus": 200, "pageStateCode": 0,
        "durationSeconds": 600, "partCount": part_count,
        "subtitleItems": [{"id": "real", "language": "ai-zh"}] if subtitle else [],
        "subtitleHtmlContributorExcerpt": "字幕制作者" if subtitle else "",
        "restrictionSignals": ["充电专属", "即可观看"] if restricted else [],
        "viewApi": {"code": 0}, "playerWbiApi": {"code": 0},
        "viewResponseSha256": "b" * 64, "playerWbiResponseSha256": "c" * 64,
        "screenshotPath": f"screenshots/{definition.bvid}.png", "screenshotSha256": "d" * 64,
        "observedAt": "2026-10-06T12:00:00Z",
    }
    if definition.asr_trigger_class == "natural_no_subtitle":
        body["naturalNoSubtitleProbes"] = [
            {"subtitleCount": 0, "probeSha256": "1" * 64, "observedAt": "2026-10-06T11:59:00Z"},
            {"subtitleCount": 0, "probeSha256": "2" * 64, "observedAt": "2026-10-06T12:00:00Z"},
        ]
        body["naturalProbeIntervalSeconds"] = 30
    if definition.asr_trigger_class == "audited_subtitle_failure":
        body["realSubtitleDiscoverySha256"] = "f" * 64
        body["acceptanceFaultScenario"] = {
            "faultClass": definition.fault_class,
            "injectionLayer": "acceptance_orchestrator",
            "productionConfigReachable": False,
            "realMediaArtifactRequired": True,
        }
    return body


def raw_probe():
    return {
        "runId": "v3-2-route-b-20261006T120000Z",
        "browser": {"name": "Google Chrome", "version": "154.0.8037.95", "profileClass": "user_authorized_temporary_v3_2"},
        "createdAt": "2026-10-06T12:00:00Z",
        "observations": [observation(item) for item in ROUTE_B_SAMPLE_MATRIX],
    }


def build(raw=None):
    return build_revision4_registry(
        raw or raw_probe(),
        {"serverValidationStatus": "valid", "sessionAuthenticated": True, "navCode": 0, "probeSha256": "e" * 64},
        build_tree_sha256="a" * 64, dependency_manifest_sha256="b" * 64,
        model_manifest_sha256="c" * 64,
        revision3_artifact={"path": "history/revision3.json", "sha256": "d" * 64},
    )


def test_route_b_registry_is_schema_valid_and_preserves_denominators():
    registry = build()
    schema_path = next(
        candidate / "docs/active/project/contracts/v3_media_acquisition_sample_registry_v4.schema.json"
        for candidate in Path(__file__).resolve().parents
        if (candidate / "docs/active/project/contracts/v3_media_acquisition_sample_registry_v4.schema.json").is_file()
    )
    schema = json.loads(schema_path.read_text("utf-8"))
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(registry)
    assert registry["classificationCounts"] == {"subtitle": 6, "asr": 3, "multipart": 1, "restricted": 1, "lowSignal": 1}
    assert registry["asrTriggerCounts"] == {"naturalNoSubtitle": 1, "auditedSubtitleFailure": 2}
    triggers = [sample["asrTriggerClass"] for sample in registry["samples"] if sample["primaryClass"] == "asr"]
    assert triggers.count("natural_no_subtitle") == 1
    assert triggers.count("audited_subtitle_failure") == 2
    anchor = next(sample for sample in registry["samples"] if sample["mediaId"] == "BV1ZpYd66ELP")
    assert anchor["faultScenario"]["faultClass"] == "subtitle_body_http_403"
    assert anchor["faultScenario"]["productionConfigReachable"] is False


def test_natural_sample_requires_two_independent_zero_subtitle_probes():
    raw = raw_probe()
    natural = next(item for item in raw["observations"] if item["bvid"] == "BV13W41137qV")
    natural["naturalNoSubtitleProbes"][1]["subtitleCount"] = 1
    with pytest.raises(SampleRegistryError, match="contains subtitles"):
        build(raw)
    raw = raw_probe()
    natural = next(item for item in raw["observations"] if item["bvid"] == "BV13W41137qV")
    natural["naturalNoSubtitleProbes"][1]["probeSha256"] = "1" * 64
    with pytest.raises(SampleRegistryError, match="independently hashed"):
        build(raw)


@pytest.mark.parametrize("field,value", [
    ("injectionLayer", "production_runtime"),
    ("productionConfigReachable", True),
    ("realMediaArtifactRequired", False),
])
def test_fault_plan_must_be_acceptance_only(field, value):
    raw = raw_probe()
    injected = next(item for item in raw["observations"] if item["bvid"] == "BV1ZpYd66ELP")
    injected["acceptanceFaultScenario"][field] = value
    with pytest.raises(SampleRegistryError, match="outside Route B"):
        build(raw)


def test_fault_sample_requires_real_subtitle_discovery():
    raw = raw_probe()
    injected = next(item for item in raw["observations"] if item["bvid"] == "BV1pW421c7DH")
    injected["subtitleItems"] = []
    with pytest.raises(SampleRegistryError, match="lacks real discovery"):
        build(raw)


def test_duplicate_observation_row_is_rejected_before_dictionary_collapse():
    raw = raw_probe()
    raw["observations"][-1] = copy.deepcopy(raw["observations"][0])
    with pytest.raises(SampleRegistryError, match="must be unique"):
        build(raw)


def test_natural_probe_timestamps_are_required():
    raw = raw_probe()
    natural = next(item for item in raw["observations"] if item["bvid"] == "BV13W41137qV")
    del natural["naturalNoSubtitleProbes"][0]["observedAt"]
    with pytest.raises(SampleRegistryError, match="timestamps are required"):
        build(raw)


def test_revision3_builder_source_remains_separate():
    import inspect
    from navia_runtime.modules.media_companion.acquisition.sample_registry import build_revision3_registry

    assert "revision4" not in inspect.getsource(build_revision3_registry).lower()
    assert copy.deepcopy(raw_probe())["runId"].startswith("v3-2-route-b-")
