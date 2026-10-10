from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from navia_runtime.modules.media_companion.acquisition.sample_registry import (
    SAMPLE_MATRIX,
    SampleRegistryError,
    build_revision3_registry,
)


SHA = "a" * 64


def observation(definition):
    subtitle = definition.primary_class == "subtitle"
    restricted = definition.primary_class == "restricted"
    part_count = 100 if definition.primary_class == "multipart" else 1
    body = {
        "bvid": definition.bvid,
        "cid": str(1000 + int(definition.sample_id[-2:])),
        "navigationStatus": 200,
        "pageStateCode": 0,
        "durationSeconds": 600,
        "partCount": part_count,
        "subtitleItems": [{"id": "1", "language": "zh-CN", "label": "中文"}] if subtitle else [],
        "subtitleHtmlContributorExcerpt": "字幕制作者" if subtitle else "",
        "restrictionSignals": ["充电专属", "即可观看"] if restricted else [],
        "viewApi": {"code": 0},
        "playerWbiApi": {"code": 0},
        "viewResponseSha256": "b" * 64,
        "playerWbiResponseSha256": "c" * 64,
        "screenshotPath": f"candidate-screenshots/{definition.bvid}.png",
        "screenshotSha256": "d" * 64,
        "observedAt": "2026-10-06T12:00:00Z",
    }
    return body


def raw_probe():
    return {
        "runId": "v3-2-sample-probe-20261006T120000Z",
        "browser": {"name": "Google Chrome", "version": "154.0.8037.95", "profileClass": "user_authorized_temporary_v3_2"},
        "createdAt": "2026-10-06T12:00:00Z",
        "observations": [observation(item) for item in SAMPLE_MATRIX],
    }


def valid_session():
    return {"serverValidationStatus": "valid", "sessionAuthenticated": True, "navCode": 0, "probeSha256": "e" * 64}


def build(raw=None, session=None):
    return build_revision3_registry(
        raw or raw_probe(),
        session or valid_session(),
        build_tree_sha256=SHA,
        dependency_manifest_sha256="b" * 64,
        model_manifest_sha256="c" * 64,
        revision2_artifact={"path": "history/revision2.json", "sha256": "d" * 64},
    )


def test_revision3_registry_is_schema_valid_and_preserves_denominator():
    registry = build()
    schema_path = Path(__file__).parents[3] / "docs/active/project/contracts/v3_media_acquisition_sample_registry_v3.schema.json"
    schema = json.loads(schema_path.read_text("utf-8"))
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(registry)
    assert len(registry["samples"]) == 12
    assert registry["classificationCounts"] == {"subtitle": 6, "asr": 3, "multipart": 1, "restricted": 1, "lowSignal": 1}
    anchor = next(item for item in registry["samples"] if item["mediaId"] == "BV1ZpYd66ELP")
    assert anchor["primaryClass"] == "subtitle"
    assert registry["asrBaseline"]["crossModelQualityGate"] == "deferred_to_v4"
    serialized = json.dumps(registry)
    assert "comparisonWindow" not in serialized
    assert "reviewer" not in serialized
    assert "adjudication" not in serialized


def test_expired_or_anonymous_session_is_rejected():
    with pytest.raises(SampleRegistryError, match="session validation"):
        build(session={"serverValidationStatus": "invalid", "sessionAuthenticated": False, "navCode": -101, "probeSha256": "e" * 64})


def test_missing_or_extra_observation_is_rejected():
    raw = raw_probe()
    raw["observations"].pop()
    with pytest.raises(SampleRegistryError, match="12 observations"):
        build(raw=raw)


def test_anchor_requires_current_subtitle_items():
    raw = raw_probe()
    anchor = next(item for item in raw["observations"] if item["bvid"] == "BV1ZpYd66ELP")
    anchor["subtitleItems"] = []
    with pytest.raises(SampleRegistryError, match="no current subtitle items"):
        build(raw=raw)


def test_subtitle_sample_requires_current_api_item():
    raw = raw_probe()
    raw["observations"][0]["subtitleItems"] = []
    with pytest.raises(SampleRegistryError, match="no current subtitle items"):
        build(raw=raw)


def test_asr_sample_rejects_platform_added_subtitle():
    raw = raw_probe()
    asr = next(item for item in raw["observations"] if item["bvid"] == "BV1Jm4y1k7SL")
    asr["subtitleItems"] = [{"id": "late-caption"}]
    with pytest.raises(SampleRegistryError, match="no longer a no-subtitle ASR sample"):
        build(raw=raw)


def test_response_hashes_are_required_from_real_probe_fields():
    raw = raw_probe()
    raw["observations"][0]["viewResponseSha256"] = None
    with pytest.raises(SampleRegistryError, match="viewResponseSha256"):
        build(raw=raw)


def test_asr_sample_rejects_duration_above_low_resource_limit():
    raw = raw_probe()
    asr = next(item for item in raw["observations"] if item["bvid"] == "BV1Jm4y1k7SL")
    asr["durationSeconds"] = 1201
    with pytest.raises(SampleRegistryError, match="low-resource ASR duration limit"):
        build(raw=raw)


def test_browser_must_be_authorized_temporary_profile():
    raw = raw_probe()
    raw["browser"]["profileClass"] = "fresh_temporary_public"
    with pytest.raises(SampleRegistryError, match="authorized temporary profile"):
        build(raw=raw)
