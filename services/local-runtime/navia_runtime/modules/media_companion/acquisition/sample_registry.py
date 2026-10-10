from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any


class SampleRegistryError(ValueError):
    pass


@dataclass(frozen=True)
class SampleDefinition:
    sample_id: str
    bvid: str
    primary_class: str
    expected_outcome: str


@dataclass(frozen=True)
class RouteBSampleDefinition(SampleDefinition):
    asr_trigger_class: str | None = None
    fault_class: str | None = None


SAMPLE_MATRIX = (
    SampleDefinition("v3-sample-01", "BV1yLuwzpEt2", "subtitle", "success"),
    SampleDefinition("v3-sample-02", "BV1VG4117775", "subtitle", "success"),
    SampleDefinition("v3-sample-03", "BV1Bt411D78C", "subtitle", "success"),
    SampleDefinition("v3-sample-04", "BV1CiFMenEye", "subtitle", "success"),
    SampleDefinition("v3-sample-05", "BV1Fh1VYFEDu", "subtitle", "success"),
    SampleDefinition("v3-sample-06", "BV1ZpYd66ELP", "subtitle", "success"),
    SampleDefinition("v3-sample-07", "BV1Jm4y1k7SL", "asr", "success"),
    SampleDefinition("v3-sample-08", "BV1Bb411w741", "asr", "success"),
    SampleDefinition("v3-sample-09", "BV17x411i7Kh", "asr", "success"),
    SampleDefinition("v3-sample-10", "BV1PA4m1w7ya", "multipart", "success"),
    SampleDefinition("v3-sample-11", "BV1vt1sBgEzc", "restricted", "blocked"),
    SampleDefinition("v3-sample-12", "BV1goA2zrEEq", "low_signal", "degraded"),
)


ROUTE_B_SAMPLE_MATRIX = (
    RouteBSampleDefinition("v3-sample-01", "BV1yLuwzpEt2", "subtitle", "success"),
    RouteBSampleDefinition("v3-sample-02", "BV1VG4117775", "subtitle", "success"),
    RouteBSampleDefinition("v3-sample-03", "BV1Bt411D78C", "subtitle", "success"),
    RouteBSampleDefinition("v3-sample-04", "BV1CiFMenEye", "subtitle", "success"),
    RouteBSampleDefinition("v3-sample-05", "BV1Fh1VYFEDu", "subtitle", "success"),
    RouteBSampleDefinition("v3-sample-06", "BV1iv411j7wL", "subtitle", "success"),
    RouteBSampleDefinition("v3-sample-07", "BV13W41137qV", "asr", "success", "natural_no_subtitle"),
    RouteBSampleDefinition(
        "v3-sample-08", "BV1ZpYd66ELP", "asr", "success", "audited_subtitle_failure", "subtitle_body_http_403"
    ),
    RouteBSampleDefinition(
        "v3-sample-09", "BV1pW421c7DH", "asr", "success", "audited_subtitle_failure", "subtitle_body_empty"
    ),
    RouteBSampleDefinition("v3-sample-10", "BV1PA4m1w7ya", "multipart", "success"),
    RouteBSampleDefinition("v3-sample-11", "BV1vt1sBgEzc", "restricted", "blocked"),
    RouteBSampleDefinition("v3-sample-12", "BV1goA2zrEEq", "low_signal", "degraded"),
)


ROUTE_B3_SAMPLE_MATRIX = (
    RouteBSampleDefinition("v3-sample-01", "BV1yLuwzpEt2", "subtitle", "success"),
    RouteBSampleDefinition("v3-sample-02", "BV1VG4117775", "subtitle", "success"),
    RouteBSampleDefinition("v3-sample-03", "BV1Bt411D78C", "subtitle", "success"),
    RouteBSampleDefinition("v3-sample-04", "BV1CiFMenEye", "subtitle", "success"),
    RouteBSampleDefinition("v3-sample-05", "BV1Fh1VYFEDu", "subtitle", "success"),
    RouteBSampleDefinition("v3-sample-06", "BV1iv411j7wL", "subtitle", "success"),
    RouteBSampleDefinition(
        "v3-sample-07", "BV13W41137qV", "asr", "success", "runtime_capability", "subtitle_body_http_503"
    ),
    RouteBSampleDefinition(
        "v3-sample-08", "BV1ZpYd66ELP", "asr", "success", "runtime_capability", "subtitle_body_http_403"
    ),
    RouteBSampleDefinition(
        "v3-sample-09", "BV1pW421c7DH", "asr", "success", "runtime_capability", "subtitle_body_empty"
    ),
    RouteBSampleDefinition("v3-sample-10", "BV1PA4m1w7ya", "multipart", "success"),
    RouteBSampleDefinition("v3-sample-11", "BV1vt1sBgEzc", "restricted", "blocked"),
    RouteBSampleDefinition("v3-sample-12", "BV1goA2zrEEq", "low_signal", "degraded"),
)

ASR_BASELINE = {
    "modelId": "funasr-sensevoice-small-q8",
    "quality": "development_baseline",
    "engine": "funasr-llamacpp",
    "engineVersion": "runtime-llamacpp-v0.2.6",
    "modelRevision": "90c1c61912018b70ada0fcc024ea24aca62f2e63",
    "weightsSha256": "4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5",
    "crossModelQualityGate": "deferred_to_v4",
}

ASR_MAX_DURATION_SECONDS = 1200


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value)).hexdigest()


def _require_sha256(value: Any, field: str) -> str:
    if not isinstance(value, str) or len(value) != 64 or any(char not in "0123456789abcdef" for char in value):
        raise SampleRegistryError(f"{field} must be a lowercase SHA-256")
    return value


def _route_for(sample: SampleDefinition, observation: dict[str, Any]) -> tuple[str, str, list[str]]:
    if sample.primary_class == "subtitle":
        if not observation.get("subtitleItems"):
            raise SampleRegistryError(f"{sample.bvid} has no current subtitle items")
        return "subtitle", "page_player_item", ["credentialed_subtitle", "public_or_page_subtitle"]
    if sample.primary_class == "asr":
        if observation.get("subtitleItems") or observation.get("subtitleHtmlContributorExcerpt"):
            raise SampleRegistryError(f"{sample.bvid} is no longer a no-subtitle ASR sample")
        if not isinstance(observation.get("durationSeconds"), (int, float)) or observation["durationSeconds"] > ASR_MAX_DURATION_SECONDS:
            raise SampleRegistryError(f"{sample.bvid} exceeds the low-resource ASR duration limit")
        return "asr", "none", ["credentialed_media_asr", "trusted_tab_capture_asr"]
    if sample.primary_class == "multipart":
        if int(observation.get("partCount", 0)) < 2:
            raise SampleRegistryError(f"{sample.bvid} is no longer multipart")
        return "asr", "none", ["credentialed_media_asr"]
    if sample.primary_class == "restricted":
        signals = set(observation.get("restrictionSignals") or [])
        if not {"充电专属", "即可观看"}.issubset(signals):
            raise SampleRegistryError(f"{sample.bvid} restriction markers are missing")
        return "blocked", "restricted", ["blocked"]
    if sample.primary_class == "low_signal":
        return "degraded", "none", ["degraded"]
    raise SampleRegistryError(f"unsupported primary class: {sample.primary_class}")


def build_revision3_registry(
    raw: dict[str, Any],
    session_validation: dict[str, Any],
    *,
    build_tree_sha256: str,
    dependency_manifest_sha256: str,
    model_manifest_sha256: str,
    revision2_artifact: dict[str, str],
) -> dict[str, Any]:
    if session_validation != {
        "serverValidationStatus": "valid",
        "sessionAuthenticated": True,
        "navCode": 0,
        "probeSha256": session_validation.get("probeSha256"),
    }:
        raise SampleRegistryError("authorized Bilibili session validation did not pass")
    _require_sha256(session_validation.get("probeSha256"), "sessionValidation.probeSha256")
    for field, value in (
        ("buildTreeSha256", build_tree_sha256),
        ("dependencyManifestSha256", dependency_manifest_sha256),
        ("modelManifestSha256", model_manifest_sha256),
        ("revision2Artifact.sha256", revision2_artifact.get("sha256")),
    ):
        _require_sha256(value, field)
    if not isinstance(revision2_artifact.get("path"), str) or not revision2_artifact["path"]:
        raise SampleRegistryError("revision2Artifact.path is required")
    browser = raw.get("browser")
    if not isinstance(browser, dict) or browser.get("profileClass") != "user_authorized_temporary_v3_2":
        raise SampleRegistryError("probe did not use the authorized temporary profile")
    version = str(browser.get("version", ""))
    try:
        major_version = int(version.split(".", 1)[0])
    except ValueError as exc:
        raise SampleRegistryError("browser version is invalid") from exc
    if major_version < 116:
        raise SampleRegistryError("Chrome 116+ is required")
    observations = raw.get("observations")
    if not isinstance(observations, list) or len(observations) != 12:
        raise SampleRegistryError("exactly 12 observations are required")
    by_bvid = {item.get("bvid"): item for item in observations if isinstance(item, dict)}
    if set(by_bvid) != {sample.bvid for sample in SAMPLE_MATRIX}:
        raise SampleRegistryError("observation BVID set does not match revision 3")

    samples: list[dict[str, Any]] = []
    for definition in SAMPLE_MATRIX:
        observation = by_bvid[definition.bvid]
        if observation.get("navigationStatus") != 200 or observation.get("pageStateCode") != 0:
            raise SampleRegistryError(f"{definition.bvid} page probe failed")
        cid = str(observation.get("cid", ""))
        duration = observation.get("durationSeconds")
        part_count = int(observation.get("partCount", 0))
        if not cid.isdigit() or not isinstance(duration, (int, float)) or duration <= 0 or part_count < 1:
            raise SampleRegistryError(f"{definition.bvid} identity is incomplete")
        expected_route, subtitle_evidence, route_availability = _route_for(definition, observation)
        page_context = {
            "adapterId": "bilibili",
            "mediaId": definition.bvid,
            "playbackUnitId": cid,
            "partId": "1",
            "partIndex": 1,
            "partCount": part_count,
            "durationSeconds": duration,
        }
        server_probe = {
            "navigationStatus": observation.get("navigationStatus"),
            "pageStateCode": observation.get("pageStateCode"),
            "viewApiCode": observation.get("viewApi", {}).get("code"),
            "playerApiCode": observation.get("playerWbiApi", {}).get("code"),
            "viewApiResponseSha256": _require_sha256(
                observation.get("viewResponseSha256"), f"{definition.bvid}.viewResponseSha256"
            ),
            "playerApiResponseSha256": observation.get("playerWbiResponseSha256"),
        }
        _require_sha256(server_probe["playerApiResponseSha256"], f"{definition.bvid}.playerWbiResponseSha256")
        screenshot_path = observation.get("screenshotPath")
        screenshot_sha256 = _require_sha256(observation.get("screenshotSha256"), f"{definition.bvid}.screenshotSha256")
        if not isinstance(screenshot_path, str) or screenshot_path.startswith("/") or ".." in screenshot_path.split("/"):
            raise SampleRegistryError(f"{definition.bvid} screenshot path is invalid")
        authorized_probe = {
            "sessionAuthenticated": True,
            "pageStatus": 200,
            "viewApiCode": int(server_probe["viewApiCode"]),
            "playerApiCode": int(server_probe["playerApiCode"]),
            "routeAvailability": route_availability,
        }
        authorized_probe["probeSha256"] = sha256_json({
            "sessionProbeSha256": session_validation["probeSha256"],
            "pageContext": page_context,
            "serverProbe": server_probe,
            "routeAvailability": route_availability,
        })
        samples.append({
            "sampleId": definition.sample_id,
            "url": f"https://www.bilibili.com/video/{definition.bvid}",
            **page_context,
            "primaryClass": definition.primary_class,
            "expectedOutcome": definition.expected_outcome,
            "expectedRouteClass": expected_route,
            "subtitleEvidence": subtitle_evidence,
            "observedAt": observation.get("observedAt"),
            "pageContextSha256": sha256_json(page_context),
            "serverProbeSha256": sha256_json(server_probe),
            "authorizedProbe": authorized_probe,
            "screenshot": {"path": screenshot_path, "sha256": screenshot_sha256},
        })

    return {
        "schemaVersion": "v3-media-acquisition-sample-registry/v3",
        "revision": 3,
        "supersedesRevision2Artifact": dict(revision2_artifact),
        "runId": raw.get("runId"),
        "buildTreeSha256": build_tree_sha256,
        "dependencyManifestSha256": dependency_manifest_sha256,
        "modelManifestSha256": model_manifest_sha256,
        "browser": {
            "name": browser.get("name"),
            "version": version,
            "majorVersion": major_version,
            "profileClass": browser.get("profileClass"),
        },
        "credentialEvidenceClass": "user_authorized_cookie_lease",
        "createdAt": raw.get("createdAt"),
        "classificationCounts": {"subtitle": 6, "asr": 3, "multipart": 1, "restricted": 1, "lowSignal": 1},
        "asrBaseline": dict(ASR_BASELINE),
        "productionReady": True,
        "samples": samples,
    }


def build_revision4_registry(
    raw: dict[str, Any],
    session_validation: dict[str, Any],
    *,
    build_tree_sha256: str,
    dependency_manifest_sha256: str,
    model_manifest_sha256: str,
    revision3_artifact: dict[str, str],
) -> dict[str, Any]:
    """Build Route B evidence without making its fault plan reachable by product code."""
    if session_validation != {
        "serverValidationStatus": "valid",
        "sessionAuthenticated": True,
        "navCode": 0,
        "probeSha256": session_validation.get("probeSha256"),
    }:
        raise SampleRegistryError("authorized Bilibili session validation did not pass")
    _require_sha256(session_validation.get("probeSha256"), "sessionValidation.probeSha256")
    for field, value in (
        ("buildTreeSha256", build_tree_sha256),
        ("dependencyManifestSha256", dependency_manifest_sha256),
        ("modelManifestSha256", model_manifest_sha256),
        ("revision3Artifact.sha256", revision3_artifact.get("sha256")),
    ):
        _require_sha256(value, field)
    if not isinstance(revision3_artifact.get("path"), str) or not revision3_artifact["path"]:
        raise SampleRegistryError("revision3Artifact.path is required")
    browser = raw.get("browser")
    if not isinstance(browser, dict) or browser.get("profileClass") != "user_authorized_temporary_v3_2":
        raise SampleRegistryError("probe did not use the authorized temporary profile")
    version = str(browser.get("version", ""))
    try:
        major_version = int(version.split(".", 1)[0])
    except ValueError as exc:
        raise SampleRegistryError("browser version is invalid") from exc
    if major_version < 116:
        raise SampleRegistryError("Chrome 116+ is required")
    observations = raw.get("observations")
    if not isinstance(observations, list) or len(observations) != 12:
        raise SampleRegistryError("exactly 12 observations are required")
    by_bvid = {item.get("bvid"): item for item in observations if isinstance(item, dict)}
    if len(by_bvid) != len(observations):
        raise SampleRegistryError("observation BVID rows must be unique")
    if set(by_bvid) != {sample.bvid for sample in ROUTE_B_SAMPLE_MATRIX}:
        raise SampleRegistryError("observation BVID set does not match revision 4 Route B")

    samples: list[dict[str, Any]] = []
    for definition in ROUTE_B_SAMPLE_MATRIX:
        observation = by_bvid[definition.bvid]
        if observation.get("navigationStatus") != 200 or observation.get("pageStateCode") != 0:
            raise SampleRegistryError(f"{definition.bvid} page probe failed")
        cid = str(observation.get("cid", ""))
        duration = observation.get("durationSeconds")
        part_count = int(observation.get("partCount", 0))
        part_index = int(observation.get("partIndex", 1))
        part_id = str(observation.get("partId", part_index))
        if not cid.isdigit() or not isinstance(duration, (int, float)) or duration <= 0 or part_count < 1:
            raise SampleRegistryError(f"{definition.bvid} identity is incomplete")
        if part_index < 1 or part_index > part_count or not part_id:
            raise SampleRegistryError(f"{definition.bvid} part identity is invalid")

        subtitle_items = observation.get("subtitleItems") or []
        natural_evidence = None
        fault_scenario = None
        if definition.primary_class == "asr" and definition.asr_trigger_class == "natural_no_subtitle":
            probes = observation.get("naturalNoSubtitleProbes")
            if subtitle_items or not isinstance(probes, list) or len(probes) != 2:
                raise SampleRegistryError(f"{definition.bvid} natural no-subtitle evidence is incomplete")
            if any(int(probe.get("subtitleCount", -1)) != 0 for probe in probes if isinstance(probe, dict)):
                raise SampleRegistryError(f"{definition.bvid} natural probe contains subtitles")
            if any(not isinstance(probe, dict) for probe in probes):
                raise SampleRegistryError(f"{definition.bvid} natural probe is invalid")
            interval = int(observation.get("naturalProbeIntervalSeconds", 0))
            if interval < 30:
                raise SampleRegistryError(f"{definition.bvid} natural probe interval is too short")
            first_hash = _require_sha256(probes[0].get("probeSha256"), f"{definition.bvid}.natural.first")
            second_hash = _require_sha256(probes[1].get("probeSha256"), f"{definition.bvid}.natural.second")
            first_at = probes[0].get("observedAt")
            second_at = probes[1].get("observedAt")
            if not isinstance(first_at, str) or not isinstance(second_at, str) or not first_at or not second_at:
                raise SampleRegistryError(f"{definition.bvid} natural probe timestamps are required")
            if first_hash == second_hash:
                raise SampleRegistryError(f"{definition.bvid} natural probes must be independently hashed")
            natural_evidence = {
                "firstProbeAt": first_at,
                "secondProbeAt": second_at,
                "firstProbeSha256": first_hash,
                "secondProbeSha256": second_hash,
                "firstSubtitleCount": 0,
                "secondSubtitleCount": 0,
                "minimumIntervalSeconds": interval,
            }
            expected_route, subtitle_evidence, route_availability = "asr", "none", ["credentialed_media_asr"]
        elif definition.primary_class == "asr" and definition.asr_trigger_class == "audited_subtitle_failure":
            plan = observation.get("acceptanceFaultScenario")
            if not subtitle_items or not isinstance(plan, dict):
                raise SampleRegistryError(f"{definition.bvid} audited subtitle failure lacks real discovery")
            expected = {
                "faultClass": definition.fault_class,
                "injectionLayer": "acceptance_orchestrator",
                "productionConfigReachable": False,
                "realMediaArtifactRequired": True,
            }
            if any(plan.get(key) != value for key, value in expected.items()):
                raise SampleRegistryError(f"{definition.bvid} fault scenario is outside Route B")
            discovery_hash = _require_sha256(
                observation.get("realSubtitleDiscoverySha256"), f"{definition.bvid}.realSubtitleDiscoverySha256"
            )
            fault_scenario = {
                "faultId": "route_b_fault_01" if definition.fault_class == "subtitle_body_http_403" else "route_b_fault_02",
                "faultClass": definition.fault_class,
                "injectionLayer": "acceptance_orchestrator",
                "productionConfigReachable": False,
                "realSubtitleItemCount": len(subtitle_items),
                "realSubtitleDiscoverySha256": discovery_hash,
                "realMediaArtifactRequired": True,
            }
            expected_route, subtitle_evidence, route_availability = (
                "asr", "credentialed_api_item", ["credentialed_subtitle", "credentialed_media_asr"]
            )
        else:
            expected_route, subtitle_evidence, route_availability = _route_for(definition, observation)

        page_context = {
            "adapterId": "bilibili",
            "mediaId": definition.bvid,
            "playbackUnitId": cid,
            "partId": part_id,
            "partIndex": part_index,
            "partCount": part_count,
            "durationSeconds": duration,
        }
        server_probe = {
            "navigationStatus": observation.get("navigationStatus"),
            "pageStateCode": observation.get("pageStateCode"),
            "viewApiCode": observation.get("viewApi", {}).get("code"),
            "playerApiCode": observation.get("playerWbiApi", {}).get("code"),
            "viewApiResponseSha256": _require_sha256(
                observation.get("viewResponseSha256"), f"{definition.bvid}.viewResponseSha256"
            ),
            "playerApiResponseSha256": _require_sha256(
                observation.get("playerWbiResponseSha256"), f"{definition.bvid}.playerWbiResponseSha256"
            ),
        }
        screenshot_path = observation.get("screenshotPath")
        screenshot_sha256 = _require_sha256(observation.get("screenshotSha256"), f"{definition.bvid}.screenshotSha256")
        if not isinstance(screenshot_path, str) or screenshot_path.startswith("/") or ".." in screenshot_path.split("/"):
            raise SampleRegistryError(f"{definition.bvid} screenshot path is invalid")
        authorized_probe = {
            "sessionAuthenticated": True,
            "pageStatus": 200,
            "viewApiCode": int(server_probe["viewApiCode"]),
            "playerApiCode": int(server_probe["playerApiCode"]),
            "routeAvailability": route_availability,
        }
        authorized_probe["probeSha256"] = sha256_json({
            "sessionProbeSha256": session_validation["probeSha256"],
            "pageContext": page_context,
            "serverProbe": server_probe,
            "routeAvailability": route_availability,
        })
        samples.append({
            "sampleId": definition.sample_id,
            "url": f"https://www.bilibili.com/video/{definition.bvid}",
            **page_context,
            "primaryClass": definition.primary_class,
            "expectedOutcome": definition.expected_outcome,
            "expectedRouteClass": expected_route,
            "subtitleEvidence": subtitle_evidence,
            "asrTriggerClass": definition.asr_trigger_class,
            "naturalEvidence": natural_evidence,
            "faultScenario": fault_scenario,
            "observedAt": observation.get("observedAt"),
            "pageContextSha256": sha256_json(page_context),
            "serverProbeSha256": sha256_json(server_probe),
            "authorizedProbe": authorized_probe,
            "screenshot": {"path": screenshot_path, "sha256": screenshot_sha256},
        })

    return {
        "schemaVersion": "v3-media-acquisition-sample-registry/v4",
        "revision": 4,
        "supersedesRevision3Artifact": dict(revision3_artifact),
        "runId": raw.get("runId"),
        "buildTreeSha256": build_tree_sha256,
        "dependencyManifestSha256": dependency_manifest_sha256,
        "modelManifestSha256": model_manifest_sha256,
        "browser": {"name": browser.get("name"), "version": version, "majorVersion": major_version, "profileClass": browser.get("profileClass")},
        "credentialEvidenceClass": "user_authorized_cookie_lease",
        "createdAt": raw.get("createdAt"),
        "classificationCounts": {"subtitle": 6, "asr": 3, "multipart": 1, "restricted": 1, "lowSignal": 1},
        "asrTriggerCounts": {"naturalNoSubtitle": 1, "auditedSubtitleFailure": 2},
        "asrBaseline": dict(ASR_BASELINE),
        "productionReady": True,
        "samples": samples,
    }


def build_revision5_registry(
    raw: dict[str, Any],
    session_validation: dict[str, Any],
    *,
    build_tree_sha256: str,
    dependency_manifest_sha256: str,
    model_manifest_sha256: str,
    revision4_artifact: dict[str, str],
) -> dict[str, Any]:
    """Build B3 evidence from acquisition-time subtitle capability facts."""
    if session_validation != {
        "serverValidationStatus": "valid",
        "sessionAuthenticated": True,
        "navCode": 0,
        "probeSha256": session_validation.get("probeSha256"),
    }:
        raise SampleRegistryError("authorized Bilibili session validation did not pass")
    _require_sha256(session_validation.get("probeSha256"), "sessionValidation.probeSha256")
    for field, value in (
        ("buildTreeSha256", build_tree_sha256),
        ("dependencyManifestSha256", dependency_manifest_sha256),
        ("modelManifestSha256", model_manifest_sha256),
        ("revision4Artifact.sha256", revision4_artifact.get("sha256")),
    ):
        _require_sha256(value, field)
    if not isinstance(revision4_artifact.get("path"), str) or not revision4_artifact["path"]:
        raise SampleRegistryError("revision4Artifact.path is required")

    browser = raw.get("browser")
    if not isinstance(browser, dict) or browser.get("profileClass") != "user_authorized_temporary_v3_2":
        raise SampleRegistryError("probe did not use the authorized temporary profile")
    version = str(browser.get("version", ""))
    try:
        major_version = int(version.split(".", 1)[0])
    except ValueError as exc:
        raise SampleRegistryError("browser version is invalid") from exc
    if major_version < 116:
        raise SampleRegistryError("Chrome 116+ is required")

    observations = raw.get("observations")
    if not isinstance(observations, list) or len(observations) != 12:
        raise SampleRegistryError("exactly 12 observations are required")
    by_bvid = {item.get("bvid"): item for item in observations if isinstance(item, dict)}
    if len(by_bvid) != len(observations):
        raise SampleRegistryError("observation BVID rows must be unique")
    if set(by_bvid) != {sample.bvid for sample in ROUTE_B3_SAMPLE_MATRIX}:
        raise SampleRegistryError("observation BVID set does not match revision 5 Route B3")

    samples: list[dict[str, Any]] = []
    trigger_counts = {"runtimeNoSubtitle": 0, "auditedSubtitleFailure": 0, "totalMediaFallback": 0}
    for definition in ROUTE_B3_SAMPLE_MATRIX:
        observation = by_bvid[definition.bvid]
        if observation.get("navigationStatus") != 200 or observation.get("pageStateCode") != 0:
            raise SampleRegistryError(f"{definition.bvid} page probe failed")
        cid = str(observation.get("cid", ""))
        duration = observation.get("durationSeconds")
        part_count = int(observation.get("partCount", 0))
        part_index = int(observation.get("partIndex", 1))
        part_id = str(observation.get("partId", part_index))
        if not cid.isdigit() or not isinstance(duration, (int, float)) or duration <= 0 or part_count < 1:
            raise SampleRegistryError(f"{definition.bvid} identity is incomplete")
        if part_index < 1 or part_index > part_count or not part_id:
            raise SampleRegistryError(f"{definition.bvid} part identity is invalid")

        asr_trigger_class = None
        subtitle_discovery = None
        fault_scenario = None
        if definition.primary_class == "asr":
            discovery = observation.get("routeB3Discovery")
            if not isinstance(discovery, dict):
                raise SampleRegistryError(f"{definition.bvid} lacks acquisition-time subtitle discovery")
            count = discovery.get("subtitleItemCount")
            observed_at = discovery.get("observedAt")
            if not isinstance(count, int) or count < 0 or not isinstance(observed_at, str) or not observed_at:
                raise SampleRegistryError(f"{definition.bvid} subtitle discovery is invalid")
            discovery_sha = _require_sha256(discovery.get("discoverySha256"), f"{definition.bvid}.discoverySha256")
            subtitle_discovery = {
                "authority": "acquisition_task",
                "subtitleItemCount": count,
                "discoverySha256": discovery_sha,
                "observedAt": observed_at,
            }
            trigger_counts["totalMediaFallback"] += 1
            if count == 0:
                asr_trigger_class = "runtime_no_subtitle"
                trigger_counts["runtimeNoSubtitle"] += 1
                if observation.get("acceptanceFaultScenario") is not None:
                    raise SampleRegistryError(f"{definition.bvid} no-subtitle route cannot apply a fault")
                subtitle_evidence = "none"
                route_availability = ["credentialed_media_asr"]
            else:
                asr_trigger_class = "audited_subtitle_failure"
                trigger_counts["auditedSubtitleFailure"] += 1
                plan = observation.get("acceptanceFaultScenario")
                expected = {
                    "faultClass": definition.fault_class,
                    "injectionLayer": "acceptance_orchestrator",
                    "productionConfigReachable": False,
                    "realMediaArtifactRequired": True,
                }
                if not isinstance(plan, dict) or any(plan.get(key) != value for key, value in expected.items()):
                    raise SampleRegistryError(f"{definition.bvid} fault scenario is outside Route B3")
                fault_scenario = {
                    "faultId": f"route_b3_fault_{int(definition.sample_id[-2:]) - 6:02d}",
                    **expected,
                    "realSubtitleItemCount": count,
                    "realSubtitleDiscoverySha256": discovery_sha,
                }
                subtitle_evidence = "credentialed_api_item"
                route_availability = ["credentialed_subtitle", "credentialed_media_asr"]
            expected_route = "asr"
        else:
            expected_route, subtitle_evidence, route_availability = _route_for(definition, observation)

        page_context = {
            "adapterId": "bilibili",
            "mediaId": definition.bvid,
            "playbackUnitId": cid,
            "partId": part_id,
            "partIndex": part_index,
            "partCount": part_count,
            "durationSeconds": duration,
        }
        server_probe = {
            "navigationStatus": observation.get("navigationStatus"),
            "pageStateCode": observation.get("pageStateCode"),
            "viewApiCode": observation.get("viewApi", {}).get("code"),
            "playerApiCode": observation.get("playerWbiApi", {}).get("code"),
            "viewApiResponseSha256": _require_sha256(
                observation.get("viewResponseSha256"), f"{definition.bvid}.viewResponseSha256"
            ),
            "playerApiResponseSha256": _require_sha256(
                observation.get("playerWbiResponseSha256"), f"{definition.bvid}.playerWbiResponseSha256"
            ),
        }
        screenshot_path = observation.get("screenshotPath")
        screenshot_sha256 = _require_sha256(observation.get("screenshotSha256"), f"{definition.bvid}.screenshotSha256")
        if not isinstance(screenshot_path, str) or screenshot_path.startswith("/") or ".." in screenshot_path.split("/"):
            raise SampleRegistryError(f"{definition.bvid} screenshot path is invalid")
        authorized_probe = {
            "sessionAuthenticated": True,
            "pageStatus": 200,
            "viewApiCode": int(server_probe["viewApiCode"]),
            "playerApiCode": int(server_probe["playerApiCode"]),
            "routeAvailability": route_availability,
        }
        authorized_probe["probeSha256"] = sha256_json({
            "sessionProbeSha256": session_validation["probeSha256"],
            "pageContext": page_context,
            "serverProbe": server_probe,
            "routeAvailability": route_availability,
        })
        samples.append({
            "sampleId": definition.sample_id,
            "url": f"https://www.bilibili.com/video/{definition.bvid}",
            **page_context,
            "primaryClass": definition.primary_class,
            "expectedOutcome": definition.expected_outcome,
            "expectedRouteClass": expected_route,
            "subtitleEvidence": subtitle_evidence,
            "asrTriggerClass": asr_trigger_class,
            "subtitleDiscovery": subtitle_discovery,
            "faultScenario": fault_scenario,
            "observedAt": observation.get("observedAt"),
            "pageContextSha256": sha256_json(page_context),
            "serverProbeSha256": sha256_json(server_probe),
            "authorizedProbe": authorized_probe,
            "screenshot": {"path": screenshot_path, "sha256": screenshot_sha256},
        })

    if trigger_counts["totalMediaFallback"] != 3 or (
        trigger_counts["runtimeNoSubtitle"] + trigger_counts["auditedSubtitleFailure"] != 3
    ):
        raise SampleRegistryError("Route B3 requires exactly three media fallback slots")
    return {
        "schemaVersion": "v3-media-acquisition-sample-registry/v5",
        "revision": 5,
        "supersedesRevision4Artifact": dict(revision4_artifact),
        "runId": raw.get("runId"),
        "buildTreeSha256": build_tree_sha256,
        "dependencyManifestSha256": dependency_manifest_sha256,
        "modelManifestSha256": model_manifest_sha256,
        "browser": {"name": browser.get("name"), "version": version, "majorVersion": major_version, "profileClass": browser.get("profileClass")},
        "credentialEvidenceClass": "user_authorized_cookie_lease",
        "routingPolicy": "runtime_capability_b3",
        "createdAt": raw.get("createdAt"),
        "classificationCounts": {"subtitle": 6, "asr": 3, "multipart": 1, "restricted": 1, "lowSignal": 1},
        "asrTriggerCounts": trigger_counts,
        "asrBaseline": dict(ASR_BASELINE),
        "productionReady": True,
        "samples": samples,
    }
