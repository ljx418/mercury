#!/usr/bin/env python3
"""Run the frozen ten-sample V3-3 production vision matrix as one run."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import jsonschema

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navia_runtime.app import vision_provider_adapter, vision_provider_store
from navia_runtime.modules.adapters.media_vision import GovernedMediaVisionAdapter, SelectedVisionFrame, VisionConsentStore
from navia_runtime.modules.media_companion.acquisition import TaskArtifactSandbox
from navia_runtime.modules.media_companion.vision import (
    FrameEvidenceRecord,
    FrameExtractor,
    FrameSelectionPolicy,
    LocalOcrAdapter,
    VisionEvidenceBuilder,
    VisionMediaBinding,
)
from v3_vision_local_ocr_probe import YT_DLP_SHA256, load_credentials, sha256_file, write_netscape_cookie


RUN_ID_RE = re.compile(r"^v3-3-vision-production-[0-9]{8}T[0-9]{6}Z$")
PROVIDER_MIN_DISPATCH_INTERVAL_SECONDS = 65.0


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def canonical_hash(value: object) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def media_duration_ms(path: Path) -> int:
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path),
    ], check=True, capture_output=True, text=True, timeout=30)
    value = round(float(result.stdout.strip()) * 1000)
    if value <= 0:
        raise RuntimeError("V3_VISION_MEDIA_DURATION_INVALID")
    return value


def download_section(yt_dlp: Path, cookie: Path, url: str, output: Path) -> None:
    subprocess.run([
        str(yt_dlp), "--ignore-config", "--no-plugin-dirs", "--no-update", "--no-playlist", "--no-cache-dir",
        "--no-write-info-json", "--no-write-comments", "--no-write-thumbnail", "--retries", "1", "--fragment-retries", "1",
        "--socket-timeout", "20", "--cookies", str(cookie), "--download-sections", "*0-8", "--force-keyframes-at-cuts",
        "--format", "bv*[height<=480]+ba/b[height<=480]", "--merge-output-format", "mp4", "--output", str(output), url,
    ], check=True, shell=False, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180,
        env={"PATH": os.environ.get("PATH", ""), "HOME": "", "XDG_CONFIG_HOME": "", "PYTHONNOUSERSITE": "1"})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--cookie", type=Path, required=True)
    parser.add_argument("--yt-dlp", type=Path, required=True)
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    args = parser.parse_args()
    if not RUN_ID_RE.fullmatch(args.run_id) or args.run_root.exists() or args.private_root.exists():
        raise RuntimeError("V3_VISION_RUN_NAMESPACE_INVALID")
    if sha256_file(args.yt_dlp) != YT_DLP_SHA256:
        raise RuntimeError("V3_VISION_YT_DLP_HASH_MISMATCH")

    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    samples = registry.get("samples")
    if registry.get("sourceRunId") != "v3-2-production-20261007T174158Z" or not isinstance(samples, list) or len(samples) != 10:
        raise RuntimeError("V3_VISION_REGISTRY_INVALID")
    if [item.get("sampleId") for item in samples] != [f"v3-sample-{index:02d}" for index in range(1, 11)]:
        raise RuntimeError("V3_VISION_SAMPLE_ORDER_INVALID")
    if [item.get("sourceClass") for item in samples].count("subtitle") != 6 or [item.get("sourceClass") for item in samples].count("asr") != 3 or [item.get("sourceClass") for item in samples].count("multipart") != 1:
        raise RuntimeError("V3_VISION_CLASS_DENOMINATOR_INVALID")
    if [item.get("cloudVisionTarget") for item in samples] != [True] * 8 + [False] * 2:
        raise RuntimeError("V3_VISION_CLOUD_DENOMINATOR_INVALID")

    args.private_root.mkdir(parents=True, mode=0o700)
    args.private_root.chmod(0o700)
    args.run_root.mkdir(parents=True)
    cookie_path = args.private_root / "cookies.txt"
    write_netscape_cookie(cookie_path, load_credentials(args.cookie))
    sandbox = TaskArtifactSandbox(args.private_root / "tasks")
    consent_store = VisionConsentStore(args.private_root / "consent.sqlite3")
    schema = json.loads(args.schema.read_text(encoding="utf-8"))
    validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
    results = []
    active_task: str | None = None
    last_provider_dispatch_at: float | None = None
    try:
        for index, sample in enumerate(samples):
            print(json.dumps({"event": "sample_started", "sampleId": sample["sampleId"], "cloudVisionTarget": sample["cloudVisionTarget"]}), flush=True)
            task_id = f"media_task_{hashlib.sha256(f'{args.run_id}:{sample['sampleId']}'.encode()).hexdigest()[:32]}"
            active_task = task_id
            sandbox.create(task_id)
            media_path = args.private_root / f"download-{index:02d}.mp4"
            download_section(args.yt_dlp, cookie_path, sample["url"], media_path)
            payload = media_path.read_bytes()
            duration_ms = media_duration_ms(media_path)
            media_path.unlink()
            media = sandbox.write_bytes(task_id, "video", payload)
            source_identity = f"portal:bilibili:{sample['mediaId']}:{sample['playbackUnitId']}:{sample['partId']}"
            binding = VisionMediaBinding(task_id, source_identity, media, media.sha256, duration_ms)
            extractor = FrameExtractor(sandbox)
            sampling = FrameSelectionPolicy(extractor).sample(binding)
            selected_point = next(point for point in sampling.points if point.selected)
            frame = extractor.extract(binding, selected_point.timestamp_ms)
            evidence_id = f"mev_{hashlib.sha256(f'{task_id}:frame'.encode()).hexdigest()[:32]}"
            record = FrameEvidenceRecord(evidence_id, frame, True)
            builder = VisionEvidenceBuilder(sandbox, task_id, source_identity, sampling)
            builder.add_frame(record)
            ocr = LocalOcrAdapter(sandbox).observe(task_id, frame.artifact)
            builder.add_ocr(ocr)

            vision_public = None
            if sample["cloudVisionTarget"]:
                if last_provider_dispatch_at is not None:
                    remaining = PROVIDER_MIN_DISPATCH_INTERVAL_SECONDS - (time.monotonic() - last_provider_dispatch_at)
                    if remaining > 0:
                        print(json.dumps({"event": "provider_rate_cooldown", "sampleId": sample["sampleId"], "seconds": round(remaining, 3)}), flush=True)
                        time.sleep(remaining)
                granted = consent_store.grant()
                governed = GovernedMediaVisionAdapter(sandbox, consent_store, vision_provider_store, vision_provider_adapter)
                last_provider_dispatch_at = time.monotonic()
                observation = governed.dispatch(SelectedVisionFrame(task_id, evidence_id, frame.artifact, True, frame.width_px, frame.height_px))
                builder.add_vision(observation)
                consent = consent_store.receipt(task_id)
                vision_public = observation.public_dict()
            else:
                granted = None
                consent = {
                    "scope": "selected_frame_cloud_vision", "state": "not_granted", "decisionId": None,
                    "grantedAt": None, "revokedAt": None, "outboundBarrierAt": None,
                    "authorizedDispatchCount": 0, "postRevocationDispatchCount": 0, "consentCheckedPerDispatch": True,
                }
            receipt = builder.finalize("succeeded", consent)
            validator.validate(receipt)
            safe_vision = None if vision_public is None else {
                "providerId": vision_public["providerId"], "modelId": vision_public["modelId"],
                "requestSha256": vision_public["requestSha256"], "responseSha256": vision_public["responseSha256"],
                "captionSha256": hashlib.sha256(vision_public["caption"].encode("utf-8")).hexdigest(), "usage": vision_public["usage"],
            }
            results.append({
                "sampleId": sample["sampleId"], "mediaId": sample["mediaId"], "playbackUnitId": sample["playbackUnitId"],
                "sourceClass": sample["sourceClass"], "cloudVisionTarget": sample["cloudVisionTarget"],
                "taskIdSha256": hashlib.sha256(task_id.encode()).hexdigest(),
                "media": {"byteLength": len(payload), "sha256": media.sha256, "durationMs": duration_ms},
                "samplingSha256": sampling.content_sha256,
                "frame": {"timestampMs": frame.timestamp_ms, "byteLength": frame.artifact.byte_length, "sha256": frame.artifact.sha256, "widthPx": frame.width_px, "heightPx": frame.height_px},
                "ocr": {"completed": True, "blockCount": len(ocr.blocks), "contentSha256": ocr.content_sha256, "networkDispatchCount": 0},
                "vision": safe_vision,
                "consentDecisionIdSha256": hashlib.sha256(granted["decisionId"].encode()).hexdigest() if granted else None,
                "receiptSha256": canonical_hash(receipt),
                "cleanup": receipt["cleanup"],
                "schemaValid": True,
            })
            if sample["cloudVisionTarget"]:
                revoked = consent_store.revoke(task_id)
                if revoked["postRevocationDispatchCount"] != 0:
                    raise RuntimeError("V3_VISION_POST_REVOKE_DISPATCH")
            sandbox.cleanup(task_id)
            active_task = None
            print(json.dumps({"event": "sample_completed", "sampleId": sample["sampleId"]}), flush=True)

        public = {
            "schemaVersion": "v3-3-6-production-matrix/v1",
            "runId": args.run_id,
            "executedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "sourceRunId": registry["sourceRunId"],
            "registryFileSha256": sha256_file(args.registry),
            "registryContentSha256": registry["contentSha256"],
            "provider": {"providerId": vision_provider_store.selected_provider_id(), "modelId": results[0]["vision"]["modelId"]},
            "summary": {
                "sampleCount": len(results), "classificationCounts": registry["classificationCounts"],
                "ocrCompletedCount": sum(item["ocr"]["completed"] for item in results),
                "visionTargetCount": sum(item["cloudVisionTarget"] for item in results),
                "visionSucceededCount": sum(item["vision"] is not None for item in results),
                "nonTargetProviderDispatchCount": 0,
                "schemaValidReceiptCount": sum(item["schemaValid"] for item in results),
                "cleanupPassedCount": sum(item["cleanup"]["residualNonEvidenceFrameCount"] == 0 and item["cleanup"]["pendingOutboundRequestCount"] == 0 for item in results),
            },
            "samples": results,
            "secretMaterialIncluded": False,
            "rawFrameIncluded": False,
            "captionTextIncluded": False,
            "publicAbsolutePathCount": 0,
            "privateTaskRootResidualCount": sandbox.active_task_count(),
        }
        required = public["summary"]
        if not (required["sampleCount"] == required["ocrCompletedCount"] == required["schemaValidReceiptCount"] == required["cleanupPassedCount"] == 10 and required["visionTargetCount"] == required["visionSucceededCount"] == 8 and public["privateTaskRootResidualCount"] == 0):
            raise RuntimeError("V3_VISION_MATRIX_DENOMINATOR_FAILED")
        public["contentSha256"] = canonical_hash(public)
        (args.run_root / "run-result.json").write_text(json.dumps(public, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        seal = {"schemaVersion": "v3-3-6-run-seal/v1", "runId": args.run_id, "contentSha256": public["contentSha256"], "resultSha256": sha256_file(args.run_root / "run-result.json")}
        (args.run_root / "run-seal.json").write_text(json.dumps(seal, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"passed": True, "runId": args.run_id, "ocr": 10, "vision": 8}))
        return 0
    finally:
        if active_task:
            try:
                sandbox.cleanup(active_task)
            except Exception:
                pass
        cookie_path.unlink(missing_ok=True)
        for path in args.private_root.glob("download-*"):
            path.unlink(missing_ok=True)
        shutil.rmtree(args.private_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
