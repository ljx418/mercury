#!/usr/bin/env python3
"""Run one governed selected-frame request using the configured real Provider."""

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

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navia_runtime.app import vision_provider_adapter, vision_provider_store
from navia_runtime.modules.adapters.media_vision import (
    GovernedMediaVisionAdapter,
    GovernedVisionError,
    SelectedVisionFrame,
    VisionConsentStore,
)
from navia_runtime.modules.media_companion.acquisition import TaskArtifactSandbox
from navia_runtime.modules.media_companion.vision import FrameExtractor, VisionMediaBinding
from v3_vision_local_ocr_probe import YT_DLP_SHA256, load_credentials, sha256_file, write_netscape_cookie


SOURCE_IDENTITY = "portal:bilibili:BV1ZpYd66ELP:41828944992:1"


class CountingRegistry:
    def __init__(self, delegate) -> None:
        self.delegate = delegate
        self.calls = 0

    def analyze_frame(self, provider, image):
        self.calls += 1
        return self.delegate.analyze_frame(provider, image)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cookie", type=Path, required=True)
    parser.add_argument("--yt-dlp", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if sha256_file(args.yt_dlp) != YT_DLP_SHA256:
        raise RuntimeError("V3_VLM_YT_DLP_HASH_MISMATCH")

    private_root = Path(tempfile.mkdtemp(prefix="navia-v3-vlm-"))
    private_root.chmod(0o700)
    task_id = f"media_task_{secrets.token_hex(16)}"
    sandbox = TaskArtifactSandbox(private_root / "tasks")
    sandbox.create(task_id)
    cookie_path = private_root / "cookies.txt"
    media_path = private_root / "anchor.mp4"
    try:
        write_netscape_cookie(cookie_path, load_credentials(args.cookie))
        subprocess.run([
            str(args.yt_dlp), "--ignore-config", "--no-plugin-dirs", "--no-update", "--no-playlist",
            "--no-cache-dir", "--no-write-info-json", "--no-write-comments", "--no-write-thumbnail",
            "--retries", "1", "--fragment-retries", "1", "--socket-timeout", "20",
            "--cookies", str(cookie_path), "--download-sections", "*0-8", "--force-keyframes-at-cuts",
            "--format", "bv*[height<=480]+ba/b[height<=480]", "--merge-output-format", "mp4",
            "--output", str(media_path), "https://www.bilibili.com/video/BV1ZpYd66ELP?p=1",
        ], check=True, shell=False, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180,
            env={"PATH": os.environ.get("PATH", ""), "HOME": "", "XDG_CONFIG_HOME": "", "PYTHONNOUSERSITE": "1"})
        payload = media_path.read_bytes()
        media = sandbox.write_bytes(task_id, "video", payload)
        binding = VisionMediaBinding(task_id, SOURCE_IDENTITY, media, media.sha256, 8000)
        frame = FrameExtractor(sandbox).extract(binding, 4000)
        selected = SelectedVisionFrame(task_id, f"mev_{secrets.token_hex(16)}", frame.artifact, True, frame.width_px, frame.height_px)
        consent = VisionConsentStore(private_root / "consent.sqlite3")
        counting = CountingRegistry(vision_provider_adapter)
        governed = GovernedMediaVisionAdapter(sandbox, consent, vision_provider_store, counting)

        pregrant_code = None
        try:
            governed.dispatch(selected)
        except GovernedVisionError as exc:
            pregrant_code = exc.code
        if pregrant_code != "VISION_CONSENT_REQUIRED" or counting.calls != 0:
            raise RuntimeError("V3_VLM_PREGRANT_BARRIER_FAILED")

        granted = consent.grant()
        observation = governed.dispatch(selected)
        revoked = consent.revoke(task_id)
        before_rejected = counting.calls
        post_revoke_code = None
        try:
            governed.dispatch(selected)
        except GovernedVisionError as exc:
            post_revoke_code = exc.code
        if post_revoke_code != "VISION_CONSENT_REVOKED" or counting.calls != before_rejected:
            raise RuntimeError("V3_VLM_REVOKE_BARRIER_FAILED")

        public = observation.public_dict()
        safe = {
            "schemaVersion": "v3-3-4-real-governed-vlm-acceptance/v1",
            "executedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "passed": True,
            "sourceIdentity": SOURCE_IDENTITY,
            "input": {"mediaId": "BV1ZpYd66ELP", "timestampMs": 4000, "frameSha256": frame.artifact.sha256, "frameBytes": frame.artifact.byte_length, "widthPx": frame.width_px, "heightPx": frame.height_px},
            "provider": {"providerId": public["providerId"], "modelId": public["modelId"]},
            "consent": {
                "scope": revoked["scope"], "decisionIdSha256": hashlib.sha256(granted["decisionId"].encode()).hexdigest(),
                "dispatchSequence": public["dispatchSequence"], "authorizedDispatchCount": revoked["authorizedDispatchCount"],
                "postRevocationDispatchCount": revoked["postRevocationDispatchCount"], "postRevokeFailureCode": post_revoke_code,
            },
            "observation": {
                "requestSha256": public["requestSha256"], "responseSha256": public["responseSha256"],
                "captionSha256": hashlib.sha256(public["caption"].encode("utf-8")).hexdigest(), "captionCharacters": len(public["caption"]),
                "usage": public["usage"], "status": public["status"],
            },
            "providerDispatchCount": counting.calls,
            "pregrantFailureCode": pregrant_code,
            "secretMaterialIncluded": False,
            "rawFrameIncluded": False,
            "cookieSeedPersisted": False,
            "privateMediaPersisted": False,
            "publicAbsolutePathCount": 0,
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(safe, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        args.output.chmod(0o600)
        print(json.dumps({"passed": True, "providerId": public["providerId"], "modelId": public["modelId"], "dispatchCount": counting.calls}))
        return 0
    finally:
        try:
            sandbox.cleanup(task_id)
        except Exception:
            pass
        shutil.rmtree(private_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
