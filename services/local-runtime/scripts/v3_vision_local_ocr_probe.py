#!/usr/bin/env python3
"""Run frozen local OCR against newly downloaded real Bilibili frames."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navia_runtime.modules.media_companion.acquisition import TaskArtifactSandbox
from navia_runtime.modules.media_companion.bilibili_policy import BILIBILI_CREDENTIAL_ENVELOPE_POLICY
from navia_runtime.modules.media_companion.vision import FrameExtractor, LocalOcrAdapter, VisionMediaBinding


YT_DLP_SHA256 = "1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6"
SOURCE_IDENTITY = "portal:bilibili:BV1ZpYd66ELP:41828944992:1"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_credentials(path: Path) -> list[dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("V3_OCR_COOKIE_INVALID")
    rows = [item for item in raw if isinstance(item, dict) and item.get("name") in BILIBILI_CREDENTIAL_ENVELOPE_POLICY.allowed_credential_names]
    if {item.get("name") for item in rows} != set(BILIBILI_CREDENTIAL_ENVELOPE_POLICY.allowed_credential_names):
        raise ValueError("V3_OCR_COOKIE_REGISTRY_MISMATCH")
    return rows


def write_netscape_cookie(path: Path, rows: list[dict[str, Any]]) -> None:
    lines = ["# Netscape HTTP Cookie File", "# Disposable Navia V3 OCR probe input"]
    for item in rows:
        value = item.get("value")
        if not isinstance(value, str) or not value or any(char in value for char in "\t\r\n"):
            raise ValueError("V3_OCR_COOKIE_INVALID")
        domain = str(item.get("domain") or ".bilibili.com")
        if not BILIBILI_CREDENTIAL_ENVELOPE_POLICY.domain_allowed(domain):
            raise ValueError("V3_OCR_COOKIE_INVALID")
        domain = domain if domain.startswith(".") else f".{domain}"
        expiration = item.get("expirationDate")
        expires = int(expiration) if isinstance(expiration, (int, float)) and not isinstance(expiration, bool) else 0
        lines.append("\t".join([domain, "TRUE", "/", "TRUE" if item.get("secure") else "FALSE", str(expires), str(item["name"]), value]))
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    path.chmod(0o600)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cookie", type=Path, required=True)
    parser.add_argument("--yt-dlp", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if sha256_file(args.yt_dlp) != YT_DLP_SHA256:
        raise RuntimeError("V3_OCR_YT_DLP_HASH_MISMATCH")

    task_id = f"media_task_{secrets.token_hex(16)}"
    private_root = Path(tempfile.mkdtemp(prefix="navia-v3-ocr-"))
    private_root.chmod(0o700)
    cookie_path = private_root / "cookies.txt"
    media_path = private_root / "anchor.mp4"
    sandbox = TaskArtifactSandbox(private_root / "tasks")
    sandbox.create(task_id)
    try:
        write_netscape_cookie(cookie_path, load_credentials(args.cookie))
        command = [
            str(args.yt_dlp), "--ignore-config", "--no-plugin-dirs", "--no-update", "--no-playlist",
            "--no-cache-dir", "--no-write-info-json", "--no-write-comments", "--no-write-thumbnail",
            "--retries", "1", "--fragment-retries", "1", "--socket-timeout", "20",
            "--cookies", str(cookie_path), "--download-sections", "*0-8", "--force-keyframes-at-cuts",
            "--format", "bv*[height<=480]+ba/b[height<=480]", "--merge-output-format", "mp4",
            "--output", str(media_path), "https://www.bilibili.com/video/BV1ZpYd66ELP?p=1",
        ]
        subprocess.run(
            command, check=True, shell=False, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, timeout=180, env={"PATH": os.environ.get("PATH", ""), "HOME": "", "XDG_CONFIG_HOME": "", "PYTHONNOUSERSITE": "1"},
        )
        payload = media_path.read_bytes()
        media = sandbox.write_bytes(task_id, "video", payload)
        binding = VisionMediaBinding(task_id, SOURCE_IDENTITY, media, media.sha256, 8000)
        extractor = FrameExtractor(sandbox)
        adapter = LocalOcrAdapter(sandbox)
        observations = []
        network_calls = 0
        original_connect = socket.socket.connect

        def denied_connect(self, address):
            nonlocal network_calls
            network_calls += 1
            raise OSError("network denied during local OCR")

        for timestamp_ms in (0, 4000, 7500):
            frame = extractor.extract(binding, timestamp_ms)
            socket.socket.connect = denied_connect
            try:
                first = adapter.observe(task_id, frame.artifact)
                second = adapter.observe(task_id, frame.artifact)
            finally:
                socket.socket.connect = original_connect
            observations.append({
                "timestampMs": timestamp_ms,
                "frameSha256": frame.artifact.sha256,
                "provider": first.provider,
                "engineVersion": first.engine_version,
                "localOnly": first.local_only,
                "blockCount": len(first.blocks),
                "allTextNonEmpty": all(bool(block.text.strip()) for block in first.blocks),
                "allConfidenceValid": all(0 <= block.confidence <= 1 for block in first.blocks),
                "allBboxValid": all(0 <= block.bbox[0] < block.bbox[2] <= 1 and 0 <= block.bbox[1] < block.bbox[3] <= 1 for block in first.blocks),
                "textSha256": hashlib.sha256("\n".join(block.text for block in first.blocks).encode("utf-8")).hexdigest(),
                "contentSha256": first.content_sha256,
                "repeatContentSha256": second.content_sha256,
            })
        public = {
            "schemaVersion": "v3-3-3-real-local-ocr-acceptance/v1",
            "executedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "passed": network_calls == 0 and all(item["contentSha256"] == item["repeatContentSha256"] for item in observations),
            "sourceIdentity": SOURCE_IDENTITY,
            "input": {"mediaId": "BV1ZpYd66ELP", "durationMs": 8000, "byteLength": len(payload), "sha256": media.sha256},
            "observations": observations,
            "networkCallCountDuringOcr": network_calls,
            "cookieSeedPersisted": False,
            "privateMediaPersisted": False,
            "publicAbsolutePathCount": 0,
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(public, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        args.output.chmod(0o600)
        print(json.dumps({"passed": public["passed"], "observations": len(observations), "blocks": sum(item["blockCount"] for item in observations)}))
        return 0 if public["passed"] else 1
    finally:
        try:
            sandbox.cleanup(task_id)
        except Exception:
            pass
        shutil.rmtree(private_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
