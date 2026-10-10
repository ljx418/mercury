#!/usr/bin/env python3
"""Run the frozen B3 capability slots through acquisition and full SenseVoice ASR."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import secrets
import shutil
import stat
import sys
import wave
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navia_runtime.modules.media_companion.acquisition import (
    AcquisitionAudioRef,
    ArtifactRef,
    MediaAcquisitionCoordinator,
    MediaAcquisitionError,
    MediaAcquisitionRequest,
    SenseVoiceTranscriptService,
    TaskArtifactSandbox,
    TaskAudioStager,
    TranscriptTask,
)
from navia_runtime.modules.media_companion.acquisition.bilibili import BilibiliMediaAcquirer
from navia_runtime.modules.media_companion.acquisition.contracts import SubtitleDiscoveryReceipt
from navia_runtime.modules.media_companion.acquisition.downloaders import YtDlpMediaDownloader
from navia_runtime.modules.media_companion.acquisition.sample_registry import ROUTE_B3_SAMPLE_MATRIX
from navia_runtime.modules.media_companion.acquisition.transcript_lineage import TranscriptLineageEntry, TranscriptLineageManifest
from navia_runtime.modules.media_companion.asr import FunAsrLlamaCppProviderAdapter
from navia_runtime.modules.media_companion.bilibili_policy import BILIBILI_CREDENTIAL_ENVELOPE_POLICY, BILIBILI_CREDENTIAL_TRANSPORT_POLICY
from navia_runtime.modules.media_companion.credential_transport import CredentialChannelStore, CredentialLeaseStore
from navia_runtime.modules.media_companion.comprehension import MediaComprehensionService
from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
from navia_runtime.modules.media_companion.product_services import MediaAskService
from navia_runtime.modules.media_companion.task_store import MediaTaskStore
from navia_runtime.modules.media_companion.workspace_candidate import (
    build_ask_benchmark,
    build_candidate_core,
    candidate_core_sha256,
)
from navia_runtime.modules.media_companion.vision.provider_settings import (
    MINIMAX_ADAPTER_KIND,
    MINIMAX_CN_API_BASE,
    MINIMAX_CN_MODEL_IDS,
    MINIMAX_CN_PROVIDER_ID,
    MemorySecretStore,
    VisionProviderAdapterRegistry,
    VisionProviderStore,
)
from navia_runtime.modules.adapters.media_vision import VisionConsentStore


LEGACY_SOURCE_RUN_ID = "v3-2-route-b3-20261007T014759Z"
LEGACY_SOURCE_CONTENT_SHA256 = "66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea"
MODEL_PROFILE = {
    "providerId": "funasr_edge_local",
    "engine": "funasr-llamacpp",
    "engineVersion": "runtime-llamacpp-v0.2.6",
    "modelId": "funasr-sensevoice-small-q8",
    "modelRevision": "90c1c61912018b70ada0fcc024ea24aca62f2e63",
    "weightsSha256": "4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5",
    "vadSha256": "1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479",
    "deviceClass": "cpu",
    "computeType": "q8",
    "qualityStatus": "development_baseline",
    "cloudUpload": False,
}
SCHEMA_MODEL_PROFILE = {key: value for key, value in MODEL_PROFILE.items() if key != "vadSha256"}


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
        raise ValueError("V3_TRANSCRIPT_COOKIE_SEED_INVALID")
    credentials = []
    for item in raw:
        if not isinstance(item, dict) or item.get("name") not in BILIBILI_CREDENTIAL_ENVELOPE_POLICY.allowed_credential_names:
            continue
        credentials.append({
            "name": item.get("name"), "value": item.get("value"), "domain": item.get("domain") or ".bilibili.com",
            "path": item.get("path") or "/", "secure": bool(item.get("secure")), "httpOnly": bool(item.get("httpOnly")),
            "sameSite": item.get("sameSite") if item.get("sameSite") in {"no_restriction", "lax", "strict", "unspecified"} else "unspecified",
            "expirationDate": item.get("expirationDate") if isinstance(item.get("expirationDate"), (int, float)) else None,
        })
    if {item["name"] for item in credentials} != set(BILIBILI_CREDENTIAL_ENVELOPE_POLICY.allowed_credential_names):
        raise ValueError("V3_TRANSCRIPT_COOKIE_REGISTRY_MISMATCH")
    return credentials


def issue_task_lease(task_id: str, credentials: list[dict[str, object]]) -> tuple[CredentialLeaseStore, str]:
    origin = f"chrome-extension://{'a' * 32}"
    binding = hashlib.sha256(f"{task_id}:authorized-browser-session".encode()).hexdigest()
    channels = CredentialChannelStore(policies=(BILIBILI_CREDENTIAL_TRANSPORT_POLICY,))
    token, public = channels.issue({
        "taskId": task_id, "adapterId": "bilibili", "policyId": BILIBILI_CREDENTIAL_TRANSPORT_POLICY.policy_id,
        "policyRevision": BILIBILI_CREDENTIAL_TRANSPORT_POLICY.policy_revision,
        "browserSessionBindingSha256": binding,
        "credentialNameSetSha256": BILIBILI_CREDENTIAL_TRANSPORT_POLICY.credential_name_set_sha256,
    }, origin)
    channel = channels.consume(token)
    leases = CredentialLeaseStore((BILIBILI_CREDENTIAL_ENVELOPE_POLICY,))
    _, public = leases.issue(channel, {
        "schemaVersion": BILIBILI_CREDENTIAL_ENVELOPE_POLICY.envelope_schema_version,
        "envelopeId": f"pce_{secrets.token_hex(16)}", "channelId": public["channelId"], "taskId": task_id,
        "adapterId": "bilibili", "sessionAdapterId": BILIBILI_CREDENTIAL_ENVELOPE_POLICY.session_adapter_id,
        "policyId": BILIBILI_CREDENTIAL_ENVELOPE_POLICY.policy_id,
        "policyRevision": BILIBILI_CREDENTIAL_ENVELOPE_POLICY.policy_revision,
        "browserSessionBindingSha256": binding,
        "credentialNameSetSha256": BILIBILI_CREDENTIAL_ENVELOPE_POLICY.credential_name_set_sha256,
        "issuedAt": channel["issuedAt"], "expiresAt": channel["expiresAt"], "credentials": credentials,
    })
    return leases, public["leaseId"]


class StaticTranscriptProjection:
    def __init__(self, task_id: str, source_identity: str, source_title: str, segments: list[dict[str, object]]) -> None:
        self.value = {
            "taskId": task_id,
            "sourceIdentity": source_identity,
            "sourceTitle": source_title,
            "state": "succeeded",
            "terminal": True,
            "segments": copy.deepcopy(list(segments)),
        }

    def get(self, task_id: str) -> dict[str, object]:
        if task_id != self.value["taskId"]:
            raise KeyError(task_id)
        return copy.deepcopy(self.value)


def configure_workspace_vision(db_path: Path, api_key: str) -> tuple[VisionProviderStore, VisionProviderAdapterRegistry]:
    providers = VisionProviderStore(db_path, MemorySecretStore())
    providers.upsert(MINIMAX_CN_PROVIDER_ID, {
        "adapterKind": MINIMAX_ADAPTER_KIND,
        "name": "MiniMax Vision（中国区）",
        "baseUrl": MINIMAX_CN_API_BASE,
        "model": MINIMAX_CN_MODEL_IDS[0],
        "apiKey": api_key,
    })
    providers.update_test_status(MINIMAX_CN_PROVIDER_ID, {
        "status": "ok",
        "model": MINIMAX_CN_MODEL_IDS[0],
        "evidence": "selected_frame_dispatch_is_the_production_capability_probe",
    })
    providers.select(MINIMAX_CN_PROVIDER_ID)
    return providers, VisionProviderAdapterRegistry()


class AcceptanceCapabilityAcquirer:
    def __init__(self, delegate: BilibiliMediaAcquirer, fault_class: str, *, public_fallback: bool = False) -> None:
        self.delegate = delegate
        self.fault_class = fault_class
        self.public_fallback = public_fallback
        self.discovery_count = 0
        self.discovery_sha256: str | None = None
        self.fault_count = 0

    def resolve_identity(self, *args, **kwargs):
        return self.delegate.resolve_identity(*args, **kwargs)

    def probe_subtitles(self, *args, **kwargs):
        return self.probe_subtitles_with_receipt(*args, **kwargs).candidates

    def probe_subtitles_with_receipt(self, *args, **kwargs):
        if self.public_fallback:
            self.discovery_count = 0
            self.discovery_sha256 = hashlib.sha256(b"public-fallback:no-subtitle").hexdigest()
            return SubtitleDiscoveryReceipt((), self.discovery_sha256, datetime.now(UTC).isoformat().replace("+00:00", "Z"))
        receipt = self.delegate.probe_subtitles_with_receipt(*args, **kwargs)
        self.discovery_count = len(receipt.candidates)
        self.discovery_sha256 = receipt.response_sha256
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
    parser.add_argument("--install-root", type=Path, required=True)
    parser.add_argument("--source-run-id", default=LEGACY_SOURCE_RUN_ID)
    parser.add_argument("--source-content-sha256", default=LEGACY_SOURCE_CONTENT_SHA256)
    parser.add_argument("--fresh-registry", type=Path)
    parser.add_argument("--allow-public-fallback", action="store_true")
    parser.add_argument("--diagnostic-output", type=Path)
    parser.add_argument("--workspace-run-root", type=Path)
    parser.add_argument("--workspace-private-root", type=Path)
    parser.add_argument("--vision-key", type=Path)
    args = parser.parse_args()
    workspace_enabled = any((args.workspace_run_root, args.workspace_private_root, args.vision_key))
    if workspace_enabled and not all((args.workspace_run_root, args.workspace_private_root, args.vision_key)):
        raise ValueError("V351_WORKSPACE_ARGUMENTS_INCOMPLETE")
    if args.run_root.exists() or args.private_root.exists():
        raise FileExistsError("V3_TRANSCRIPT_RUN_EXISTS")
    if workspace_enabled and (args.workspace_run_root.exists() or args.workspace_private_root.exists()):
        raise FileExistsError("V351_WORKSPACE_RUN_EXISTS")
    raw = json.loads(args.raw.read_text(encoding="utf-8"))
    if args.fresh_registry is None:
        observations = {item["bvid"]: item for item in raw["observations"]}
        definitions = tuple(item for item in ROUTE_B3_SAMPLE_MATRIX if item.primary_class == "asr")
        if tuple((item.sample_id, item.bvid) for item in definitions) != (
            ("v3-sample-07", "BV13W41137qV"), ("v3-sample-08", "BV1ZpYd66ELP"), ("v3-sample-09", "BV1pW421c7DH"),
        ):
            raise RuntimeError("V3_TRANSCRIPT_SLOT_DENOMINATOR_MISMATCH")
    else:
        registry_bytes = args.fresh_registry.read_bytes()
        registry = json.loads(registry_bytes)
        samples = registry.get("samples")
        if not isinstance(samples, list) or len(samples) != 3:
            raise RuntimeError("V3_TRANSCRIPT_FRESH_REGISTRY_DENOMINATOR_MISMATCH")
        observations = {
            item["bvid"]: {
                **item,
                "partId": item["partIndex"],
            }
            for item in samples
        }
        definitions = tuple(
            SimpleNamespace(sample_id=item["sampleId"], bvid=item["bvid"], fault_class="subtitle_body_empty")
            for item in samples
        )
        args.source_run_id = registry["runId"]
        args.source_content_sha256 = hashlib.sha256(registry_bytes).hexdigest()
    credentials = normalized_credentials(args.cookie)
    cookie_values = [str(item["value"]) for item in credentials]
    cookie_header = "; ".join(f"{item['name']}={item['value']}" for item in credentials)
    nav = httpx.get("https://api.bilibili.com/x/web-interface/nav", headers={
        "Cookie": cookie_header, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36",
        "Referer": "https://www.bilibili.com/", "Origin": "https://www.bilibili.com",
    }, timeout=20)
    document = nav.json()
    session_authenticated = nav.status_code == 200 and document.get("code") == 0 and document.get("data", {}).get("isLogin") is True
    if not session_authenticated and not (args.fresh_registry is not None and args.allow_public_fallback):
        raise RuntimeError("V3_TRANSCRIPT_SESSION_INVALID")

    args.run_root.mkdir(parents=True)
    args.private_root.mkdir(parents=True, mode=0o700)
    args.private_root.chmod(0o700)
    sandbox = TaskArtifactSandbox(args.private_root / "acquisition")
    asr_root = args.private_root / "asr"
    coordinator = MediaAcquisitionCoordinator(sandbox)
    downloader = YtDlpMediaDownloader(
        sandbox, yt_dlp=args.yt_dlp, yt_dlp_sha256="1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6",
        ffmpeg=args.ffmpeg, ffmpeg_sha256="ed16af623947494a72e284b6eb8ff225f2da22b38b5d5069c2fd4b4ba3384e41",
    )
    service = SenseVoiceTranscriptService(
        TaskAudioStager(sandbox, asr_root),
        lambda: FunAsrLlamaCppProviderAdapter(args.install_root, asr_root, model_id="funasr-sensevoice-small-q8"),
        coordinator.complete,
    )
    workspace_store = None
    workspace_private_evidence = None
    workspace_visual_sandbox = None
    workspace_vision_consent = None
    workspace_providers = None
    workspace_adapters = None
    workspace_results: list[dict[str, object]] = []
    if workspace_enabled:
        args.workspace_run_root.mkdir(parents=True)
        args.workspace_private_root.mkdir(parents=True, mode=0o700)
        args.workspace_private_root.chmod(0o700)
        workspace_store = MediaTaskStore(args.workspace_private_root / "workspace.sqlite3")
        workspace_private_evidence = args.workspace_private_root / "product-evidence"
        workspace_visual_sandbox = TaskArtifactSandbox(args.workspace_private_root / "visual-temp")
        workspace_vision_consent = VisionConsentStore(args.workspace_private_root / "vision-consent.sqlite3")
        vision_key = args.vision_key.read_text(encoding="utf-8").strip()
        workspace_providers, workspace_adapters = configure_workspace_vision(
            args.workspace_private_root / "vision-provider.sqlite3", vision_key
        )
        vision_key = ""
    results = []
    lineage_entries = []
    try:
        for index, definition in enumerate(definitions):
            observation = observations[definition.bvid]
            task_id = f"media_task_{hashlib.sha256((args.run_root.name + definition.bvid).encode()).hexdigest()[:32]}"
            source_identity = f"portal:bilibili:{definition.bvid}:{observation['cid']}:{observation['partId']}"
            request = MediaAcquisitionRequest(
                task_id=task_id, source_identity=source_identity, adapter_id="bilibili", media_id=definition.bvid,
                playback_unit_id=str(observation["cid"]), part_id=str(observation["partId"]),
                consent_policy_id="bilibili-media-consent/v1", consent_policy_revision=1,
            )
            coordinator.create(request)
            leases, _ = issue_task_lease(task_id, credentials)
            wrapper = AcceptanceCapabilityAcquirer(
                BilibiliMediaAcquirer(downloader=downloader),
                definition.fault_class or "subtitle_body_empty",
                public_fallback=not session_authenticated,
            )
            acquisition = coordinator.acquire_input(task_id, lease_store=leases, acquirers={"bilibili": wrapper})
            if acquisition["route"] != "credentialed_media_asr":
                raise RuntimeError("V3_TRANSCRIPT_REAL_MEDIA_ROUTE_REQUIRED")
            artifact_data = acquisition["artifact"]
            artifact = ArtifactRef(task_id, artifact_data["artifactId"], artifact_data["kind"], artifact_data["byteLength"], artifact_data["sha256"])
            audio_path = sandbox.private_path(task_id, artifact)
            with wave.open(str(audio_path), "rb") as reader:
                shape = (reader.getframerate(), reader.getnchannels(), reader.getsampwidth())
                duration_ms = round(reader.getnframes() * 1000 / reader.getframerate())
            if shape != (16000, 1, 2):
                raise RuntimeError("V3_TRANSCRIPT_AUDIO_SHAPE_INVALID")
            acquisition_record_id = f"mar_{hashlib.sha256((task_id + artifact.sha256).encode()).hexdigest()[:32]}"
            audio_ref = AcquisitionAudioRef(task_id, source_identity, acquisition_record_id, artifact, duration_ms, 16000, 1, 2)
            service.create(TranscriptTask(audio_ref))
            receipt = service.run(task_id)
            if receipt["state"] != "succeeded" or receipt["coverage"]["coverageRatio"] != 1.0:
                diagnostic = service.private_diagnostic(task_id)
                if diagnostic is not None and args.diagnostic_output is not None:
                    args.diagnostic_output.write_text(json.dumps(diagnostic, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                    args.diagnostic_output.chmod(stat.S_IRUSR | stat.S_IWUSR)
                raise RuntimeError(f"V3_TRANSCRIPT_TASK_FAILED:{definition.sample_id}:{receipt['result']}")
            transcript = receipt["result"]
            private_segments = service.private_segments(task_id)
            if workspace_enabled:
                visual_leases, visual_lease_id = issue_task_lease(task_id, credentials)
                visual_downloader = YtDlpMediaDownloader(
                    workspace_visual_sandbox,
                    yt_dlp=args.yt_dlp,
                    yt_dlp_sha256="1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6",
                    ffmpeg=args.ffmpeg,
                    ffmpeg_sha256="ed16af623947494a72e284b6eb8ff225f2da22b38b5d5069c2fd4b4ba3384e41",
                )
                materializer = MediaProductMaterializer(
                    workspace_store,
                    StaticTranscriptProjection(task_id, source_identity, str(observation.get("title") or definition.bvid), private_segments),
                    workspace_private_evidence,
                    lease_store=visual_leases,
                    visual_sandbox=workspace_visual_sandbox,
                    visual_downloader=visual_downloader,
                    vision_consent=workspace_vision_consent,
                    vision_providers=workspace_providers,
                    vision_adapters=workspace_adapters,
                )
                product_task = materializer.materialize_visual(task_id, visual_lease_id)
                comprehension = MediaComprehensionService(workspace_store, workspace_private_evidence)
                projection = comprehension.get(task_id, product_task["revision"])
                asks = build_ask_benchmark(
                    MediaAskService(workspace_store, workspace_private_evidence),
                    task_id,
                    product_task["revision"],
                )
                selected_count = sum(item["kind"] == "vision_caption" for item in projection["evidenceCatalog"])
                candidate_core = build_candidate_core(
                    projection,
                    asks,
                    selected_frame_upload_count=selected_count,
                )
                candidate_path = args.workspace_run_root / f"candidate-core-{index + 1}.json"
                candidate_path.write_text(
                    json.dumps(candidate_core, ensure_ascii=True, sort_keys=True, indent=2) + "\n",
                    encoding="utf-8",
                )
                workspace_results.append({
                    "slot": index,
                    "sampleId": definition.sample_id,
                    "bvid": definition.bvid,
                    "taskId": task_id,
                    "candidateCore": candidate_path.name,
                    "candidateCoreSha256": candidate_core_sha256(candidate_core),
                    "selectedFrameUploadCount": selected_count,
                    "evidenceCount": len(candidate_core["evidenceCatalog"]),
                    "chapterCount": len(candidate_core["outline"]["chapters"]),
                    "timelineMomentCount": len(candidate_core["timeline"]["moments"]),
                    "mindmapNodeCount": len(candidate_core["mindmap"]["nodes"]),
                    "askCount": len(candidate_core["askBenchmark"]),
                    "visualTempActiveTaskCount": workspace_visual_sandbox.active_task_count(),
                })
                visual_leases.clear()
            segment_receipts = [
                {
                    "segmentId": segment["segmentId"], "startMs": segment["startMs"], "endMs": segment["endMs"],
                    "textSha256": hashlib.sha256(segment["text"].encode("utf-8")).hexdigest(),
                }
                for segment in private_segments
            ]
            execution_receipt = {
                "schemaVersion": "v3-media-transcript-execution/v2",
                "taskId": task_id,
                "sourceIdentity": source_identity,
                "acquisitionRecordId": acquisition_record_id,
                "audioBinding": {
                    "taskId": task_id, "relativeArtifactRef": "audio/current-part.wav",
                    "artifactSha256": artifact.sha256, "durationMs": duration_ms,
                    "sampleRateHz": 16000, "channels": 1, "sampleWidthBytes": 2, "currentPart": True,
                },
                "modelProfile": SCHEMA_MODEL_PROFILE,
                "progress": receipt["progress"],
                "coverage": receipt["coverage"],
                "result": transcript,
            }
            results.append({
                "slot": index, "sampleId": definition.sample_id, "bvid": definition.bvid, "taskId": task_id,
                "sourceIdentitySha256": hashlib.sha256(source_identity.encode()).hexdigest(),
                "acquisitionRecordId": acquisition_record_id,
                "audioSha256": artifact.sha256, "audioBytes": artifact.byte_length, "durationMs": duration_ms,
                "route": acquisition["route"], "subtitleItemCount": wrapper.discovery_count,
                "discoverySha256": wrapper.discovery_sha256,
                "configuredFaultClass": definition.fault_class,
                "appliedFaultClass": definition.fault_class if wrapper.discovery_count else None,
                "faultCount": wrapper.fault_count,
                "triggerClass": "audited_subtitle_failure" if wrapper.discovery_count else "runtime_no_subtitle",
                "coverage": receipt["coverage"], "result": transcript, "resources": receipt["resources"],
                "segmentReceipts": segment_receipts,
                "executionReceipt": execution_receipt,
                "progressObservationCount": len(receipt["progress"]),
                "cleanup": {"asrResidualCount": int((asr_root / task_id).exists()), "acquisitionTaskActive": int(task_id in coordinator._tasks and coordinator.get(task_id)["state"] != "succeeded")},
            })
            lineage_entries.append(TranscriptLineageEntry(
                definition.sample_id, definition.bvid, task_id, source_identity, acquisition_record_id,
                artifact.sha256, transcript["contentSha256"],
            ))
            leases.clear()

        if len(args.source_content_sha256) != 64:
            raise RuntimeError("V3_TRANSCRIPT_SOURCE_HASH_INVALID")
        manifest = TranscriptLineageManifest(args.run_root.name, args.source_run_id, args.source_content_sha256, tuple(lineage_entries))
        if args.fresh_registry is None:
            manifest.validate()
        else:
            expected_slots = tuple((item.sample_id, item.bvid) for item in definitions)
            actual_slots = tuple((entry.sample_id, entry.bvid) for entry in lineage_entries)
            unique_columns = (
                [entry.task_id for entry in lineage_entries],
                [entry.source_identity for entry in lineage_entries],
                [entry.acquisition_record_id for entry in lineage_entries],
                [entry.audio_sha256 for entry in lineage_entries],
                [entry.transcript_sha256 for entry in lineage_entries],
            )
            if (
                actual_slots != expected_slots
                or len(lineage_entries) != 3
                or not re.fullmatch(r"[a-f0-9]{64}", args.source_content_sha256)
                or any(len(set(values)) != 3 or any(not value for value in values) for values in unique_columns)
            ):
                raise RuntimeError("V3_TRANSCRIPT_FRESH_LINEAGE_MISMATCH")
        runtime_no_subtitle = sum(item["triggerClass"] == "runtime_no_subtitle" for item in results)
        audited_failure = sum(item["triggerClass"] == "audited_subtitle_failure" for item in results)
        result = {
            "schemaVersion": "v3-2-3-sensevoice-run/v1", "runId": args.run_root.name,
            "createdAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "sourceRunId": args.source_run_id, "sourceContentSha256": args.source_content_sha256,
            "modelProfile": MODEL_PROFILE, "results": results,
            "sessionMode": "credentialed" if session_authenticated else "public_media_fallback",
            "summary": {
                "taskCount": len(results), "successCount": sum(item["result"]["status"] == "succeeded" for item in results),
                "runtimeNoSubtitle": runtime_no_subtitle, "auditedSubtitleFailure": audited_failure,
                "dynamicTriggerTotal": runtime_no_subtitle + audited_failure,
                "crossRunArtifactCount": 0, "humanTranscriptInputCount": 0,
                "cleanupResidualCount": sum(item["cleanup"]["asrResidualCount"] + item["cleanup"]["acquisitionTaskActive"] for item in results),
            },
            "lineage": {
                "entryCount": len(lineage_entries),
                "taskIds": [entry.task_id for entry in lineage_entries],
                "audioSha256": [entry.audio_sha256 for entry in lineage_entries],
                "transcriptSha256": [entry.transcript_sha256 for entry in lineage_entries],
            },
            "privacy": {"cookieValueCount": len(cookie_values), "publicSecretHitCount": 0, "publicTranscriptIncluded": False, "publicAudioIncluded": False, "publicStderrIncluded": False},
        }
        public_bytes = canonical_json(result)
        result["privacy"]["publicSecretHitCount"] = sum(public_bytes.count(value.encode()) for value in cookie_values)
        if result["summary"] != {
            "taskCount": 3, "successCount": 3, "runtimeNoSubtitle": runtime_no_subtitle,
            "auditedSubtitleFailure": audited_failure, "dynamicTriggerTotal": 3,
            "crossRunArtifactCount": 0, "humanTranscriptInputCount": 0, "cleanupResidualCount": 0,
        } or result["privacy"]["publicSecretHitCount"]:
            raise RuntimeError("V3_TRANSCRIPT_ACCEPTANCE_DENOMINATOR_FAILED")
        output = args.run_root / "transcript-result.json"
        output.write_text(json.dumps(result, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
        if workspace_enabled:
            workspace_manifest = {
                "schemaVersion": "v3-5.1-workspace-candidate-core-run/v1",
                "runId": args.workspace_run_root.name,
                "sourceTranscriptRunId": args.run_root.name,
                "createdAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                "results": workspace_results,
                "summary": {
                    "candidateCount": len(workspace_results),
                    "selectedFrameUploadCount": sum(int(item["selectedFrameUploadCount"]) for item in workspace_results),
                    "rawMediaUploadCount": 0,
                    "groundedTextCloudUploadCount": 0,
                    "visualTempResidualCount": workspace_visual_sandbox.active_task_count(),
                    "humanTranscriptInputCount": 0,
                    "crossRunArtifactCount": 0,
                },
            }
            if workspace_manifest["summary"] != {
                "candidateCount": 3,
                "selectedFrameUploadCount": sum(int(item["selectedFrameUploadCount"]) for item in workspace_results),
                "rawMediaUploadCount": 0,
                "groundedTextCloudUploadCount": 0,
                "visualTempResidualCount": 0,
                "humanTranscriptInputCount": 0,
                "crossRunArtifactCount": 0,
            } or any(int(item["selectedFrameUploadCount"]) < 1 for item in workspace_results):
                raise RuntimeError("V351_WORKSPACE_ACCEPTANCE_DENOMINATOR_FAILED")
            (args.workspace_run_root / "workspace-core-manifest.json").write_text(
                json.dumps(workspace_manifest, ensure_ascii=True, sort_keys=True, indent=2) + "\n",
                encoding="utf-8",
            )
        print(json.dumps(result["summary"], sort_keys=True))
        return 0
    finally:
        for task_id in list(coordinator._tasks):
            try:
                if coordinator.get(task_id)["state"] not in {"succeeded", "failed", "cancelled"}:
                    coordinator.cancel(task_id)
            except Exception:
                pass
        if args.private_root.exists():
            shutil.rmtree(args.private_root)


if __name__ == "__main__":
    raise SystemExit(main())
