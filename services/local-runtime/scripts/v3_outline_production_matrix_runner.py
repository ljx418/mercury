#!/usr/bin/env python3
"""Run the frozen V3-4 twelve-sample production outline matrix."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import wave
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import jsonschema

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navia_runtime.app import vision_provider_adapter, vision_provider_store
from navia_runtime.modules.adapters.media_vision import GovernedMediaVisionAdapter, SelectedVisionFrame, VisionConsentStore
from navia_runtime.modules.media_companion.acquisition import (
    ArtifactRef,
    MediaAcquisitionCoordinator,
    MediaAcquisitionRequest,
    SenseVoiceTranscriptService,
    TaskArtifactSandbox,
    TaskAudioStager,
    TranscriptTask,
)
from navia_runtime.modules.media_companion.acquisition.bilibili import BilibiliMediaAcquirer
from navia_runtime.modules.media_companion.acquisition.downloaders import YtDlpMediaDownloader
from navia_runtime.modules.media_companion.asr import FunAsrLlamaCppProviderAdapter
from navia_runtime.modules.media_companion.outline import DeterministicExtractiveOutlineGenerator, canonical_hash
from navia_runtime.modules.media_companion.task_store import MediaTaskStore
from navia_runtime.modules.media_companion.vision import FrameExtractor, FrameSelectionPolicy, LocalOcrAdapter, VisionMediaBinding
from v3_sensevoice_transcript_runner import AcceptanceCapabilityAcquirer, issue_task_lease, normalized_credentials
from v3_vision_local_ocr_probe import YT_DLP_SHA256, load_credentials, sha256_file, write_netscape_cookie
from v3_vision_production_matrix_runner import download_section, media_duration_ms


RUN_ID_RE = re.compile(r"^v3-4-outline-production-[0-9]{8}T[0-9]{6}Z$")
PROVIDER_MIN_DISPATCH_INTERVAL_SECONDS = 65.0
FFMPEG_SHA256 = "ed16af623947494a72e284b6eb8ff225f2da22b38b5d5069c2fd4b4ba3384e41"
EXPECTED_CLASSES = ["subtitle"] * 6 + ["asr"] * 3 + ["multipart", "restricted", "low_signal"]
MEDIA_SUFFIXES = {".mp4", ".media", ".wav", ".png", ".jpg", ".jpeg", ".webp"}


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def evidence_item(task_id: str, kind: str, start_ms: int, end_ms: int, text: str, sequence: int) -> dict[str, Any]:
    normalized = " ".join(text.split()).strip()
    if not normalized:
        raise RuntimeError("V3_OUTLINE_EMPTY_EVIDENCE")
    if end_ms <= start_ms:
        end_ms = start_ms + 1
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    identity = hashlib.sha256(f"{task_id}:{kind}:{sequence}:{start_ms}:{end_ms}:{digest}".encode()).hexdigest()[:32]
    return {
        "evidenceId": f"mtr_{identity}" if kind == "transcript" else f"mev_{identity}",
        "taskId": task_id,
        "kind": kind,
        "timestampStartMs": start_ms,
        "timestampEndMs": end_ms,
        "contentSha256": digest,
        "relativeArtifactRef": f"evidence/{task_id}/{sequence:04d}.json",
        "text": normalized,
    }


def compact_segments(task_id: str, segments: tuple[dict[str, Any], ...], start_sequence: int = 0) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    bucket: list[dict[str, Any]] = []
    for segment in segments:
        bucket.append(segment)
        elapsed = int(bucket[-1]["endMs"]) - int(bucket[0]["startMs"])
        if len(bucket) >= 12 or elapsed >= 45_000:
            result.append(evidence_item(task_id, "transcript", int(bucket[0]["startMs"]), int(bucket[-1]["endMs"]), " ".join(str(item["text"]) for item in bucket), start_sequence + len(result)))
            bucket = []
    if bucket:
        result.append(evidence_item(task_id, "transcript", int(bucket[0]["startMs"]), int(bucket[-1]["endMs"]), " ".join(str(item["text"]) for item in bucket), start_sequence + len(result)))
    return result


def persist_private_evidence(root: Path, evidence: list[dict[str, Any]]) -> None:
    for item in evidence:
        path = root / item["relativeArtifactRef"]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"text": item["text"], "contentSha256": item["contentSha256"]}, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
        try:
            path.chmod(0o600)
        except OSError:
            pass


def residual_media(root: Path) -> list[str]:
    return sorted(str(path.relative_to(root)) for path in root.rglob("*") if path.is_file() and path.suffix.lower() in MEDIA_SUFFIXES)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--cookie", type=Path, required=True)
    parser.add_argument("--yt-dlp", type=Path, required=True)
    parser.add_argument("--ffmpeg", type=Path, required=True)
    parser.add_argument("--asr-install-root", type=Path, required=True)
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    args = parser.parse_args()
    if not RUN_ID_RE.fullmatch(args.run_id) or args.run_root.exists() or args.private_root.exists():
        raise RuntimeError("V3_OUTLINE_RUN_NAMESPACE_INVALID")
    if sha256_file(args.yt_dlp) != YT_DLP_SHA256:
        raise RuntimeError("V3_OUTLINE_YT_DLP_HASH_MISMATCH")
    if sha256_file(args.ffmpeg) != FFMPEG_SHA256:
        raise RuntimeError("V3_OUTLINE_FFMPEG_HASH_MISMATCH")

    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    samples = registry.get("samples")
    if not isinstance(samples, list) or len(samples) != 12:
        raise RuntimeError("V3_OUTLINE_SAMPLE_DENOMINATOR_INVALID")
    if [item.get("sampleId") for item in samples] != [f"v3-sample-{index:02d}" for index in range(1, 13)]:
        raise RuntimeError("V3_OUTLINE_SAMPLE_ORDER_INVALID")
    if [item.get("primaryClass") for item in samples] != EXPECTED_CLASSES:
        raise RuntimeError("V3_OUTLINE_CLASS_DENOMINATOR_INVALID")

    schema = json.loads(args.schema.read_text(encoding="utf-8"))
    validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
    credentials = normalized_credentials(args.cookie)
    cookie_values = [str(item["value"]) for item in credentials]
    args.run_root.mkdir(parents=True)
    args.private_root.mkdir(parents=True, mode=0o700)
    try:
        args.private_root.chmod(0o700)
    except OSError:
        pass
    cookie_path = args.private_root / "cookies.txt"
    write_netscape_cookie(cookie_path, load_credentials(args.cookie))

    acquisition_sandbox = TaskArtifactSandbox(args.private_root / "acquisition")
    vision_sandbox = TaskArtifactSandbox(args.private_root / "vision")
    coordinator = MediaAcquisitionCoordinator(acquisition_sandbox)
    downloader = YtDlpMediaDownloader(
        acquisition_sandbox,
        yt_dlp=args.yt_dlp,
        yt_dlp_sha256=YT_DLP_SHA256,
        ffmpeg=args.ffmpeg,
        ffmpeg_sha256=FFMPEG_SHA256,
    )
    asr_root = args.private_root / "asr"
    transcript_service = SenseVoiceTranscriptService(
        TaskAudioStager(acquisition_sandbox, asr_root),
        lambda: FunAsrLlamaCppProviderAdapter(args.asr_install_root, asr_root, model_id="funasr-sensevoice-small-q8"),
        coordinator.complete,
    )
    consent_store = VisionConsentStore(args.private_root / "vision-consent.sqlite3")
    task_store = MediaTaskStore(args.private_root / "media-outline.sqlite3")
    generator = DeterministicExtractiveOutlineGenerator()
    provider_id = vision_provider_store.selected_provider_id()
    provider = vision_provider_store.get(provider_id, include_secret=True) if provider_id else None
    if not provider or provider.get("testStatus", {}).get("status") != "ok" or provider.get("model") != "MiniMax-M3":
        raise RuntimeError("V3_OUTLINE_VERIFIED_MINIMAX_REQUIRED")
    api_key = str(provider["apiKey"])

    summaries: list[dict[str, Any]] = []
    cloud_dispatch_count = 0
    last_cloud_at: float | None = None
    active_acquisition: set[str] = set()
    active_vision: set[str] = set()
    try:
        for index, sample in enumerate(samples):
            sample_id = sample["sampleId"]
            task_id = f"media_task_{hashlib.sha256(f'{args.run_id}:{sample_id}'.encode()).hexdigest()[:32]}"
            source_identity = f"portal:bilibili:{sample['mediaId']}:{sample['playbackUnitId']}:{sample['partId']}"
            print(json.dumps({"event": "sample_started", "sampleId": sample_id}), flush=True)
            task = task_store.create(task_id, source_identity)
            if sample["primaryClass"] == "restricted":
                bundle = generator.blocked(task_id=task_id, source_identity=source_identity, revision=task["revision"] + 1, failure_code="MEDIA_ACCESS_RESTRICTED")
                envelope = task_store.commit_terminal(bundle, expected_revision=task["revision"], idempotency_key=f"{args.run_id}:{sample_id}:terminal")
                validator.validate(envelope)
                summaries.append({"sampleId": sample_id, "taskIdSha256": hashlib.sha256(task_id.encode()).hexdigest(), "state": "blocked", "evidenceCount": 0, "sectionCount": 0, "timelineCount": 0, "mindmapNodeCount": 0, "cloudDispatchCount": 0, "transactionReceiptSha256": canonical_hash(envelope["transactionReceipt"])})
                print(json.dumps({"event": "sample_completed", "sampleId": sample_id, "state": "blocked"}), flush=True)
                continue

            task = task_store.transition(task_id, task["revision"], "acquiring")
            evidence: list[dict[str, Any]] = []
            route = "visual_low_signal"
            if sample["primaryClass"] != "low_signal":
                request = MediaAcquisitionRequest(
                    task_id=task_id,
                    source_identity=source_identity,
                    adapter_id="bilibili",
                    media_id=sample["mediaId"],
                    playback_unit_id=str(sample["playbackUnitId"]),
                    part_id=str(sample["partId"]),
                    consent_policy_id="bilibili-media-consent/v1",
                    consent_policy_revision=1,
                )
                coordinator.create(request)
                active_acquisition.add(task_id)
                leases = issue_task_lease(task_id, credentials)
                definition_fault = (sample.get("faultScenario") or {}).get("faultClass")
                base_acquirer = BilibiliMediaAcquirer(downloader=downloader)
                acquirer = AcceptanceCapabilityAcquirer(base_acquirer, definition_fault) if definition_fault else base_acquirer
                acquired = coordinator.acquire_input(task_id, lease_store=leases, acquirers={"bilibili": acquirer})
                leases.clear()
                route = acquired["route"]
                task = task_store.transition(task_id, task["revision"], "transcribing")
                if route == "credentialed_subtitle":
                    segments = coordinator.public_segments(task_id)
                    evidence.extend(compact_segments(task_id, segments))
                    coordinator.complete(task_id)
                    active_acquisition.discard(task_id)
                elif route == "credentialed_media_asr":
                    audio_ref = coordinator.audio_reference(task_id)
                    audio_path = acquisition_sandbox.private_path(task_id, audio_ref.artifact)
                    with wave.open(str(audio_path), "rb") as reader:
                        if (reader.getframerate(), reader.getnchannels(), reader.getsampwidth()) != (16000, 1, 2):
                            raise RuntimeError("V3_OUTLINE_AUDIO_SHAPE_INVALID")
                    transcript_service.create(TranscriptTask(audio_ref))
                    receipt = transcript_service.run(task_id)
                    if receipt["state"] != "succeeded" or receipt["coverage"]["coverageRatio"] != 1.0:
                        raise RuntimeError(f"V3_OUTLINE_ASR_FAILED:{sample_id}")
                    evidence.extend(compact_segments(task_id, transcript_service.private_segments(task_id)))
                    active_acquisition.discard(task_id)
                else:
                    raise RuntimeError("V3_OUTLINE_UNEXPECTED_ROUTE")
            else:
                task = task_store.transition(task_id, task["revision"], "extracting_frames")

            if task["state"] == "transcribing":
                task = task_store.transition(task_id, task["revision"], "extracting_frames")

            vision_sandbox.create(task_id)
            active_vision.add(task_id)
            download_path = args.private_root / f"download-{index:02d}.mp4"
            download_section(args.yt_dlp, cookie_path, sample["url"], download_path)
            payload = download_path.read_bytes()
            duration_ms = media_duration_ms(download_path)
            download_path.unlink(missing_ok=True)
            media = vision_sandbox.write_bytes(task_id, "video", payload)
            del payload
            binding = VisionMediaBinding(task_id, source_identity, media, media.sha256, duration_ms)
            extractor = FrameExtractor(vision_sandbox)
            sampling = FrameSelectionPolicy(extractor).sample(binding)
            selected = next(point for point in sampling.points if point.selected)
            frame = extractor.extract(binding, selected.timestamp_ms)
            ocr = LocalOcrAdapter(vision_sandbox).observe(task_id, frame.artifact)
            for block in ocr.blocks:
                evidence.append(evidence_item(task_id, "ocr_block", selected.timestamp_ms, selected.timestamp_ms + 1, block.text, len(evidence)))

            consent_hash = None
            vision_hash = None
            task_cloud_count = 0
            if index < 8:
                task = task_store.transition(task_id, task["revision"], "analyzing_vision")
                if last_cloud_at is not None:
                    remaining = PROVIDER_MIN_DISPATCH_INTERVAL_SECONDS - (time.monotonic() - last_cloud_at)
                    if remaining > 0:
                        print(json.dumps({"event": "provider_rate_cooldown", "sampleId": sample_id, "seconds": round(remaining, 3)}), flush=True)
                        time.sleep(remaining)
                granted = consent_store.grant()
                frame_evidence_id = f"mev_{hashlib.sha256(f'{task_id}:selected-frame'.encode()).hexdigest()[:32]}"
                governed = GovernedMediaVisionAdapter(vision_sandbox, consent_store, vision_provider_store, vision_provider_adapter)
                last_cloud_at = time.monotonic()
                observation = governed.dispatch(SelectedVisionFrame(task_id, frame_evidence_id, frame.artifact, True, frame.width_px, frame.height_px))
                evidence.append(evidence_item(task_id, "vision_caption", selected.timestamp_ms, selected.timestamp_ms + 1, observation.caption, len(evidence)))
                revoked = consent_store.revoke(task_id)
                if revoked["postRevocationDispatchCount"] != 0:
                    raise RuntimeError("V3_OUTLINE_POST_REVOKE_DISPATCH")
                consent_hash = hashlib.sha256(granted["decisionId"].encode()).hexdigest()
                vision_hash = observation.response_sha256
                cloud_dispatch_count += 1
                task_cloud_count = 1
                task = task_store.transition(task_id, task["revision"], "synthesizing")
            else:
                task = task_store.transition(task_id, task["revision"], "synthesizing")

            if sample["primaryClass"] == "low_signal" and not evidence:
                evidence.append(evidence_item(task_id, "frame", selected.timestamp_ms, selected.timestamp_ms + 1, f"低信号画面，尺寸 {frame.width_px}x{frame.height_px}，本地采样哈希 {frame.artifact.sha256[:16]}", 0))
            if not evidence:
                raise RuntimeError(f"V3_OUTLINE_NO_REAL_EVIDENCE:{sample_id}")
            persist_private_evidence(args.private_root, evidence)
            terminal_state = "degraded" if sample["primaryClass"] == "low_signal" else "ready"
            failure_code = "LOW_SIGNAL_CONTENT" if terminal_state == "degraded" else None
            bundle = generator.generate(
                task_id=task_id,
                source_identity=source_identity,
                revision=task["revision"] + 1,
                source_title=sample["mediaId"],
                evidence=evidence,
                state=terminal_state,
                terminal_failure_code=failure_code,
            )
            envelope = task_store.commit_terminal(bundle, expected_revision=task["revision"], idempotency_key=f"{args.run_id}:{sample_id}:terminal")
            validator.validate(envelope)
            replay = task_store.commit_terminal(bundle, expected_revision=task["revision"], idempotency_key=f"{args.run_id}:{sample_id}:terminal")
            if canonical(replay) != canonical(envelope):
                raise RuntimeError("V3_OUTLINE_IDEMPOTENT_REPLAY_DRIFT")
            vision_sandbox.cleanup(task_id)
            active_vision.discard(task_id)
            summaries.append({
                "sampleId": sample_id,
                "taskIdSha256": hashlib.sha256(task_id.encode()).hexdigest(),
                "state": terminal_state,
                "route": route,
                "evidenceCount": len(evidence),
                "evidenceCatalogSha256": canonical_hash(envelope["evidenceCatalog"]),
                "outlineSha256": envelope["outline"]["contentSha256"],
                "sectionCount": len(envelope["outline"]["sections"]),
                "timelineCount": len(envelope["timeline"]),
                "mindmapNodeCount": len(envelope["mindmap"]["nodes"]),
                "cloudDispatchCount": task_cloud_count,
                "consentDecisionIdSha256": consent_hash,
                "visionResponseSha256": vision_hash,
                "transactionReceiptSha256": canonical_hash(envelope["transactionReceipt"]),
                "idempotentReplayMatched": True,
            })
            print(json.dumps({"event": "sample_completed", "sampleId": sample_id, "state": terminal_state, "evidenceCount": len(evidence)}), flush=True)

        cookie_path.unlink(missing_ok=True)
        for path in list(args.private_root.glob("download-*")):
            path.unlink(missing_ok=True)
        residual = residual_media(args.private_root)
        state_counts = {state: sum(item["state"] == state for item in summaries) for state in ("ready", "degraded", "blocked")}
        public = {
            "schemaVersion": "v3-4-production-matrix/v1",
            "runId": args.run_id,
            "executedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "sourceRegistrySha256": sha256_file(args.registry),
            "sourceRegistryRunId": registry["runId"],
            "provider": {"providerId": provider_id, "modelId": provider["model"]},
            "summary": {
                "sampleCount": len(summaries),
                "readyCount": state_counts["ready"],
                "degradedCount": state_counts["degraded"],
                "blockedCount": state_counts["blocked"],
                "cloudVisionDispatchCount": cloud_dispatch_count,
                "schemaValidCount": len(summaries),
                "idempotentReplayCount": sum(item.get("idempotentReplayMatched") is True for item in summaries),
                "rawMediaResidualCount": len(residual),
            },
            "samples": summaries,
            "privacy": {
                "rawVideoIncluded": False,
                "rawAudioIncluded": False,
                "rawFrameIncluded": False,
                "fullTranscriptIncluded": False,
                "ocrTextIncluded": False,
                "cookieIncluded": False,
                "apiKeyIncluded": False,
                "publicAbsolutePathCount": 0,
            },
            "cleanup": {"residualMediaPaths": residual, "developmentScreenshotResidualCount": 0},
        }
        encoded = canonical(public)
        secret_hits = sum(encoded.count(value.encode()) for value in cookie_values + [api_key])
        if secret_hits:
            raise RuntimeError("V3_OUTLINE_PUBLIC_SECRET_LEAK")
        if public["summary"] != {"sampleCount": 12, "readyCount": 10, "degradedCount": 1, "blockedCount": 1, "cloudVisionDispatchCount": 8, "schemaValidCount": 12, "idempotentReplayCount": 11, "rawMediaResidualCount": 0}:
            raise RuntimeError(f"V3_OUTLINE_ACCEPTANCE_DENOMINATOR_FAILED:{public['summary']}")
        public["contentSha256"] = canonical_hash(public)
        result_path = args.run_root / "run-result.json"
        result_path.write_text(json.dumps(public, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
        seal = {"schemaVersion": "v3-4-run-seal/v1", "runId": args.run_id, "contentSha256": public["contentSha256"], "resultSha256": sha256_file(result_path)}
        (args.run_root / "run-seal.json").write_text(json.dumps(seal, sort_keys=True, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"passed": True, "runId": args.run_id, **public["summary"]}, sort_keys=True), flush=True)
        return 0
    finally:
        for task_id in active_acquisition:
            try:
                coordinator.cancel(task_id)
            except Exception:
                pass
        for task_id in active_vision:
            try:
                vision_sandbox.cleanup(task_id)
            except Exception:
                pass
        cookie_path.unlink(missing_ok=True)
        for path in list(args.private_root.glob("download-*")):
            path.unlink(missing_ok=True)
        task_store.close()


if __name__ == "__main__":
    raise SystemExit(main())
