#!/usr/bin/env python3
"""Run a same-task real frame/OCR/VLM/evidence-cleanup acceptance probe."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
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


SOURCE_IDENTITY = "portal:bilibili:BV1ZpYd66ELP:41828944992:1"


def canonical_hash(value: object) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cookie", type=Path, required=True)
    parser.add_argument("--yt-dlp", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if sha256_file(args.yt_dlp) != YT_DLP_SHA256:
        raise RuntimeError("V3_EVIDENCE_YT_DLP_HASH_MISMATCH")

    private_root = Path(tempfile.mkdtemp(prefix="navia-v3-evidence-"))
    private_root.chmod(0o700)
    task_id = f"media_task_{secrets.token_hex(16)}"
    sandbox = TaskArtifactSandbox(private_root / "tasks")
    sandbox.create(task_id)
    cookie_path = private_root / "cookies.txt"
    media_path = private_root / "anchor.mp4"
    try:
        write_netscape_cookie(cookie_path, load_credentials(args.cookie))
        subprocess.run([
            str(args.yt_dlp), "--ignore-config", "--no-plugin-dirs", "--no-update", "--no-playlist", "--no-cache-dir",
            "--no-write-info-json", "--no-write-comments", "--no-write-thumbnail", "--retries", "1", "--fragment-retries", "1",
            "--socket-timeout", "20", "--cookies", str(cookie_path), "--download-sections", "*0-8", "--force-keyframes-at-cuts",
            "--format", "bv*[height<=480]+ba/b[height<=480]", "--merge-output-format", "mp4", "--output", str(media_path),
            "https://www.bilibili.com/video/BV1ZpYd66ELP?p=1",
        ], check=True, shell=False, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180,
            env={"PATH": os.environ.get("PATH", ""), "HOME": "", "XDG_CONFIG_HOME": "", "PYTHONNOUSERSITE": "1"})
        payload = media_path.read_bytes()
        media = sandbox.write_bytes(task_id, "video", payload)
        binding = VisionMediaBinding(task_id, SOURCE_IDENTITY, media, media.sha256, 8000)
        extractor = FrameExtractor(sandbox)
        sampling = FrameSelectionPolicy(extractor).sample(binding)
        selected_times = [point.timestamp_ms for point in sampling.points if point.selected][:2]
        nonselected_time = next(point.timestamp_ms for point in sampling.points if not point.selected)
        if len(selected_times) != 2:
            raise RuntimeError("V3_EVIDENCE_SELECTED_DENOMINATOR")

        builder = VisionEvidenceBuilder(sandbox, task_id, SOURCE_IDENTITY, sampling)
        records = []
        for index, (timestamp_ms, selected) in enumerate([(selected_times[0], True), (selected_times[1], True), (nonselected_time, False)]):
            frame = extractor.extract(binding, timestamp_ms)
            record = FrameEvidenceRecord(f"mev_{hashlib.sha256(f'{task_id}:{index}'.encode()).hexdigest()[:32]}", frame, selected)
            builder.add_frame(record)
            records.append(record)

        ocr = LocalOcrAdapter(sandbox)
        for record in records[:2]:
            builder.add_ocr(ocr.observe(task_id, record.frame.artifact))

        consent_store = VisionConsentStore(private_root / "consent.sqlite3")
        consent_store.grant()
        governed = GovernedMediaVisionAdapter(sandbox, consent_store, vision_provider_store, vision_provider_adapter)
        target = records[0]
        builder.add_vision(governed.dispatch(SelectedVisionFrame(task_id, target.evidence_id, target.frame.artifact, True, target.frame.width_px, target.frame.height_px)))
        consent = consent_store.receipt(task_id)
        receipt = builder.finalize("succeeded", consent)
        jsonschema.Draft202012Validator(json.loads(args.schema.read_text(encoding="utf-8")), format_checker=jsonschema.FormatChecker()).validate(receipt)
        retained = sum(sandbox.private_path(task_id, record.frame.artifact).exists() for record in records[:2])
        deleted = 0
        try:
            sandbox.private_path(task_id, records[2].frame.artifact)
        except FileNotFoundError:
            deleted = 1
        vision = receipt["visionObservations"][0]
        safe = {
            "schemaVersion": "v3-3-5-real-evidence-cleanup-acceptance/v1",
            "executedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "passed": retained == 2 and deleted == 1,
            "sourceIdentity": SOURCE_IDENTITY,
            "receiptSha256": canonical_hash(receipt),
            "samplingSha256": sampling.content_sha256,
            "counts": {"frames": len(receipt["frames"]), "selected": 2, "ocr": len(receipt["ocrObservations"]), "vision": len(receipt["visionObservations"])},
            "vision": {"providerId": vision["providerId"], "modelId": vision["modelId"], "requestSha256": vision["requestSha256"], "responseSha256": vision["responseSha256"], "captionSha256": hashlib.sha256(vision["caption"].encode()).hexdigest(), "usage": vision["usage"]},
            "cleanup": receipt["cleanup"],
            "schemaValid": True,
            "retainedSelectedFrameCount": retained,
            "deletedNonEvidenceFrameCountObserved": deleted,
            "secretMaterialIncluded": False,
            "rawFrameIncluded": False,
            "cookieSeedPersisted": False,
            "privateMediaPersisted": False,
            "publicAbsolutePathCount": 0,
        }
        consent_store.revoke(task_id)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(safe, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        args.output.chmod(0o600)
        print(json.dumps({"passed": safe["passed"], "frames": 3, "ocr": len(receipt["ocrObservations"]), "vision": 1}))
        return 0 if safe["passed"] else 1
    finally:
        try:
            sandbox.cleanup(task_id)
        except Exception:
            pass
        shutil.rmtree(private_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
