#!/usr/bin/env python3
"""Run the frozen Route B acquisition matrix against real Bilibili inputs."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import secrets
import sys
import wave
from datetime import datetime, timezone
from pathlib import Path

import httpx
from jsonschema import Draft202012Validator

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navia_runtime.modules.media_companion.acquisition.bilibili import BilibiliMediaAcquirer
from navia_runtime.modules.media_companion.acquisition.coordinator import (
    MediaAcquisitionCoordinator,
    MediaAcquisitionError,
    MediaAcquisitionRequest,
)
from navia_runtime.modules.media_companion.acquisition.downloaders import YtDlpMediaDownloader
from navia_runtime.modules.media_companion.acquisition.sample_registry import (
    ROUTE_B3_SAMPLE_MATRIX,
    build_revision5_registry,
)
from navia_runtime.modules.media_companion.acquisition.contracts import SubtitleDiscoveryReceipt
from navia_runtime.modules.media_companion.acquisition.task_artifacts import TaskArtifactSandbox
from navia_runtime.modules.media_companion.bilibili_policy import (
    BILIBILI_CREDENTIAL_ENVELOPE_POLICY,
    BILIBILI_CREDENTIAL_TRANSPORT_POLICY,
)
from navia_runtime.modules.media_companion.credential_transport import CredentialChannelStore, CredentialLeaseStore


def canonical_json(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalized_credentials(path: Path) -> list[dict[str, object]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("V3_ROUTE_B_COOKIE_SEED_INVALID")
    credentials = []
    for item in raw:
        if not isinstance(item, dict) or item.get("name") not in BILIBILI_CREDENTIAL_ENVELOPE_POLICY.allowed_credential_names:
            continue
        credentials.append({
            "name": item.get("name"),
            "value": item.get("value"),
            "domain": item.get("domain") or ".bilibili.com",
            "path": item.get("path") or "/",
            "secure": bool(item.get("secure")),
            "httpOnly": bool(item.get("httpOnly")),
            "sameSite": item.get("sameSite") if item.get("sameSite") in {"no_restriction", "lax", "strict", "unspecified"} else "unspecified",
            "expirationDate": item.get("expirationDate") if isinstance(item.get("expirationDate"), (int, float)) else None,
        })
    names = {item["name"] for item in credentials}
    if names != set(BILIBILI_CREDENTIAL_ENVELOPE_POLICY.allowed_credential_names):
        raise ValueError("V3_ROUTE_B_COOKIE_REGISTRY_MISMATCH")
    return credentials


def issue_task_lease(task_id: str, credentials: list[dict[str, object]]) -> CredentialLeaseStore:
    origin = f"chrome-extension://{'a' * 32}"
    binding = hashlib.sha256(f"{task_id}:authorized-browser-session".encode()).hexdigest()
    channels = CredentialChannelStore(policies=(BILIBILI_CREDENTIAL_TRANSPORT_POLICY,))
    token, public = channels.issue({
        "taskId": task_id,
        "adapterId": "bilibili",
        "policyId": BILIBILI_CREDENTIAL_TRANSPORT_POLICY.policy_id,
        "policyRevision": BILIBILI_CREDENTIAL_TRANSPORT_POLICY.policy_revision,
        "browserSessionBindingSha256": binding,
        "credentialNameSetSha256": BILIBILI_CREDENTIAL_TRANSPORT_POLICY.credential_name_set_sha256,
    }, origin)
    channel = channels.consume(token)
    leases = CredentialLeaseStore((BILIBILI_CREDENTIAL_ENVELOPE_POLICY,))
    leases.issue(channel, {
        "schemaVersion": BILIBILI_CREDENTIAL_ENVELOPE_POLICY.envelope_schema_version,
        "envelopeId": f"pce_{secrets.token_hex(16)}",
        "channelId": public["channelId"],
        "taskId": task_id,
        "adapterId": "bilibili",
        "sessionAdapterId": BILIBILI_CREDENTIAL_ENVELOPE_POLICY.session_adapter_id,
        "policyId": BILIBILI_CREDENTIAL_ENVELOPE_POLICY.policy_id,
        "policyRevision": BILIBILI_CREDENTIAL_ENVELOPE_POLICY.policy_revision,
        "browserSessionBindingSha256": binding,
        "credentialNameSetSha256": BILIBILI_CREDENTIAL_ENVELOPE_POLICY.credential_name_set_sha256,
        "issuedAt": channel["issuedAt"],
        "expiresAt": channel["expiresAt"],
        "credentials": credentials,
    })
    return leases


class AcceptanceCapabilityAcquirer:
    """Route by real discovery; inject a prebound fault only when subtitles exist."""

    def __init__(self, delegate: BilibiliMediaAcquirer, fault_class: str) -> None:
        self.delegate = delegate
        self.fault_class = fault_class
        self.discovery_sha256: str | None = None
        self.discovery_observed_at: str | None = None
        self.discovery_count = 0
        self.fault_count = 0

    def resolve_identity(self, *args, **kwargs):
        return self.delegate.resolve_identity(*args, **kwargs)

    def probe_subtitles(self, *args, **kwargs):
        return self.probe_subtitles_with_receipt(*args, **kwargs).candidates

    def probe_subtitles_with_receipt(self, *args, **kwargs):
        receipt = self.delegate.probe_subtitles_with_receipt(*args, **kwargs)
        self.discovery_sha256 = receipt.response_sha256
        self.discovery_observed_at = receipt.observed_at
        self.discovery_count = len(receipt.candidates)
        return SubtitleDiscoveryReceipt(receipt.candidates[:1], receipt.response_sha256, receipt.observed_at)

    def acquire_subtitle(self, *args, **kwargs):
        self.fault_count += 1
        if self.fault_class == "subtitle_body_http_503":
            raise MediaAcquisitionError("V3_MEDIA_SUBTITLE_UNAVAILABLE", "Acceptance-injected subtitle service outage.", status=503)
        if self.fault_class == "subtitle_body_http_403":
            raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Acceptance-injected subtitle body rejection.", status=403)
        raise MediaAcquisitionError("V3_MEDIA_SUBTITLE_UNAVAILABLE", "Acceptance-injected empty subtitle body.", status=502)

    def acquire_audio(self, *args, **kwargs):
        return self.delegate.acquire_audio(*args, **kwargs)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", type=Path, required=True)
    parser.add_argument("--cookie", type=Path, required=True)
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    parser.add_argument("--yt-dlp", type=Path, required=True)
    parser.add_argument("--ffmpeg", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--revision4-artifact", type=Path, required=True)
    parser.add_argument("--dependency-manifest", type=Path, required=True)
    parser.add_argument("--model-manifest", type=Path, required=True)
    args = parser.parse_args()

    raw = json.loads(args.raw.read_text(encoding="utf-8"))
    observations = {item["bvid"]: item for item in raw["observations"]}
    if set(observations) != {item.bvid for item in ROUTE_B3_SAMPLE_MATRIX}:
        raise RuntimeError("V3_ROUTE_B_RAW_DENOMINATOR_MISMATCH")
    credentials = normalized_credentials(args.cookie)
    cookie_values = [str(item["value"]) for item in credentials]
    cookie_header = "; ".join(f"{item['name']}={item['value']}" for item in credentials)
    nav = httpx.get("https://api.bilibili.com/x/web-interface/nav", headers={
        "Cookie": cookie_header,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
        "Referer": "https://www.bilibili.com/",
        "Origin": "https://www.bilibili.com",
    }, timeout=20)
    try:
        nav_document = nav.json()
    except ValueError as exc:
        raise RuntimeError("V3_ROUTE_B_SESSION_RESPONSE_INVALID") from exc
    session_validation = {
        "serverValidationStatus": "valid" if nav.status_code == 200 and nav_document.get("code") == 0 and nav_document.get("data", {}).get("isLogin") is True else "invalid",
        "sessionAuthenticated": nav.status_code == 200 and nav_document.get("code") == 0 and nav_document.get("data", {}).get("isLogin") is True,
        "navCode": nav_document.get("code"),
        "probeSha256": hashlib.sha256(canonical_json(nav_document)).hexdigest(),
    }
    if session_validation["serverValidationStatus"] != "valid":
        raise RuntimeError("V3_ROUTE_B_SESSION_INVALID")

    args.private_root.mkdir(parents=True, mode=0o700, exist_ok=False)
    sandbox = TaskArtifactSandbox(args.private_root / "tasks")
    downloader = YtDlpMediaDownloader(
        sandbox,
        yt_dlp=args.yt_dlp,
        yt_dlp_sha256="1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6",
        ffmpeg=args.ffmpeg,
        ffmpeg_sha256="ed16af623947494a72e284b6eb8ff225f2da22b38b5d5069c2fd4b4ba3384e41",
    )
    coordinator = MediaAcquisitionCoordinator(sandbox)
    enriched = copy.deepcopy(raw)
    enriched_by_bvid = {item["bvid"]: item for item in enriched["observations"]}
    results = []
    try:
        for definition in ROUTE_B3_SAMPLE_MATRIX:
            observation = observations[definition.bvid]
            if definition.primary_class in {"restricted", "low_signal"}:
                results.append({
                    "sampleId": definition.sample_id,
                    "bvid": definition.bvid,
                    "outcome": "blocked" if definition.primary_class == "restricted" else "degraded",
                    "artifactCount": 0,
                })
                continue
            task_id = f"media_task_{hashlib.sha256((raw['runId'] + definition.bvid).encode()).hexdigest()[:32]}"
            request = MediaAcquisitionRequest(
                task_id=task_id,
                source_identity=f"portal:bilibili:{definition.bvid}:{observation['cid']}:{observation['partId']}",
                adapter_id="bilibili",
                media_id=definition.bvid,
                playback_unit_id=str(observation["cid"]),
                part_id=str(observation["partId"]),
                consent_policy_id="bilibili-media-consent/v1",
                consent_policy_revision=1,
            )
            coordinator.create(request)
            leases = issue_task_lease(task_id, credentials)
            base = BilibiliMediaAcquirer(downloader=downloader)
            acquirer = base
            fault = None
            if definition.primary_class == "asr":
                fault = AcceptanceCapabilityAcquirer(base, definition.fault_class or "subtitle_body_empty")
                acquirer = fault
            result = coordinator.acquire_input(task_id, lease_store=leases, acquirers={"bilibili": acquirer})
            artifact = result["artifact"]
            artifact_ref = next(value for value in coordinator.sandbox._task_root(task_id).iterdir() if value.name.startswith(artifact["artifactId"]))
            media_shape = None
            if result["route"] == "credentialed_media_asr":
                with wave.open(str(artifact_ref), "rb") as source:
                    media_shape = {
                        "channels": source.getnchannels(),
                        "sampleWidth": source.getsampwidth(),
                        "sampleRateHz": source.getframerate(),
                        "frames": source.getnframes(),
                    }
                if media_shape["channels"] != 1 or media_shape["sampleWidth"] != 2 or media_shape["sampleRateHz"] != 16000:
                    raise RuntimeError("V3_ROUTE_B_AUDIO_SHAPE_INVALID")
            results.append({
                "sampleId": definition.sample_id,
                "bvid": definition.bvid,
                "route": result["route"],
                "fallbackReasonCodes": result["fallbackReasonCodes"],
                "artifact": artifact,
                "mediaShape": media_shape,
                "configuredFaultClass": definition.fault_class,
                "appliedFaultClass": definition.fault_class if fault and fault.discovery_count > 0 else None,
                "faultCount": fault.fault_count if fault else 0,
                "realSubtitleItemCount": result["subtitleDiscovery"]["subtitleItemCount"],
                "subtitleDiscovery": result["subtitleDiscovery"],
            })
            if fault:
                target = enriched_by_bvid[definition.bvid]
                target["routeB3Discovery"] = {
                    "subtitleItemCount": fault.discovery_count,
                    "discoverySha256": fault.discovery_sha256,
                    "observedAt": fault.discovery_observed_at,
                }
                if fault.discovery_count > 0:
                    target["acceptanceFaultScenario"] = {
                        "faultClass": definition.fault_class,
                        "injectionLayer": "acceptance_orchestrator",
                        "productionConfigReachable": False,
                        "realMediaArtifactRequired": True,
                    }
                else:
                    target.pop("acceptanceFaultScenario", None)
            coordinator.cancel(task_id)
            leases.clear()

        dependency_sha = sha256_file(args.dependency_manifest)
        model_sha = sha256_file(args.model_manifest)
        revision4_sha = sha256_file(args.revision4_artifact)
        build_paths = [
            Path("services/local-runtime/navia_runtime/modules/media_companion/acquisition/contracts.py"),
            Path("services/local-runtime/navia_runtime/modules/media_companion/acquisition/coordinator.py"),
            Path("services/local-runtime/navia_runtime/modules/media_companion/acquisition/task_artifacts.py"),
            Path("services/local-runtime/navia_runtime/modules/media_companion/acquisition/subtitle_resolver.py"),
            Path("services/local-runtime/navia_runtime/modules/media_companion/acquisition/bilibili/acquirer.py"),
            Path("services/local-runtime/navia_runtime/modules/media_companion/acquisition/downloaders/yt_dlp.py"),
            Path("services/local-runtime/navia_runtime/modules/media_companion/acquisition/sample_registry.py"),
        ]
        build_tree_sha = hashlib.sha256(canonical_json({str(path): sha256_file(path) for path in build_paths})).hexdigest()
        registry = build_revision5_registry(
            enriched,
            session_validation,
            build_tree_sha256=build_tree_sha,
            dependency_manifest_sha256=dependency_sha,
            model_manifest_sha256=model_sha,
            revision4_artifact={"path": str(args.revision4_artifact), "sha256": revision4_sha},
        )
        schema = json.loads(args.schema.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema).validate(registry)
        result_document = {
            "schemaVersion": "v3-route-b-acquisition-run/v1",
            "runId": raw["runId"],
            "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "sessionValidation": session_validation,
            "toolHashes": {"ytDlp": sha256_file(args.yt_dlp), "ffmpeg": sha256_file(args.ffmpeg)},
            "summary": {
                "total": len(results),
                "subtitleSuccess": sum(item.get("route") == "credentialed_subtitle" for item in results),
                "mediaSuccess": sum(item.get("route") == "credentialed_media_asr" for item in results),
                "blocked": sum(item.get("outcome") == "blocked" for item in results),
                "degraded": sum(item.get("outcome") == "degraded" for item in results),
                "cleanupResidualCount": sum(1 for _ in args.private_root.rglob("artifact_*")),
            },
            "results": results,
            "secretScan": {"cookieValueCount": len(cookie_values), "publicHitCount": 0},
        }
        public_bytes = canonical_json({"registry": registry, "result": result_document})
        result_document["secretScan"]["publicHitCount"] = sum(public_bytes.count(value.encode()) for value in cookie_values)
        if result_document["summary"] != {
            "total": 12, "subtitleSuccess": 7, "mediaSuccess": 3, "blocked": 1, "degraded": 1, "cleanupResidualCount": 0,
        } or result_document["secretScan"]["publicHitCount"]:
            raise RuntimeError("V3_ROUTE_B_ACCEPTANCE_DENOMINATOR_FAILED")
        args.run_root.mkdir(parents=True, exist_ok=True)
        (args.run_root / "enriched-observations.json").write_text(json.dumps(enriched, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
        (args.run_root / "sample-registry-v5.json").write_text(json.dumps(registry, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
        (args.run_root / "acquisition-result.json").write_text(json.dumps(result_document, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result_document["summary"], sort_keys=True))
        return 0
    finally:
        for task_id in list(coordinator._tasks):
            try:
                coordinator.cancel(task_id)
            except Exception:
                pass
        for child in sorted(args.private_root.rglob("*"), reverse=True):
            if child.is_file():
                child.unlink()
            elif child.is_dir():
                child.rmdir()
        args.private_root.rmdir()


if __name__ == "__main__":
    raise SystemExit(main())
