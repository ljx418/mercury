#!/usr/bin/env python3
"""Exercise V3-2-1 task state, private artifacts, API and restart cleanup with real audio bytes."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import stat
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from navia_runtime.modules.media_companion.acquisition import MediaAcquisitionCoordinator, MediaAcquisitionRequest, TaskArtifactSandbox


SOURCE_SHA256 = "f4f61c09f8fe19828fb2085ef18459179d5142596b8107cef82df6c7bf7cc97b"
TASK_ID = "media_task_1234567890abcdef1234567890abcdef"
ORPHAN_TASK_ID = "media_task_abcdef1234567890abcdef1234567890"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def request(task_id: str = TASK_ID) -> MediaAcquisitionRequest:
    return MediaAcquisitionRequest(
        task_id=task_id,
        source_identity="portal:bilibili:BV1ZpYd66ELP:41828944992:1",
        adapter_id="bilibili",
        media_id="BV1ZpYd66ELP",
        playback_unit_id="41828944992",
        part_id="1",
        consent_policy_id="bilibili-media-consent/v1",
        consent_policy_revision=1,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--private-root", type=Path, required=True)
    parser.add_argument("--source-audio", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.private_root = args.private_root.resolve()
    args.source_audio = args.source_audio.resolve(strict=True)
    args.output = args.output.resolve()
    if args.private_root.exists():
        shutil.rmtree(args.private_root)
    args.private_root.mkdir(parents=True, mode=0o700)
    if sha256_file(args.source_audio) != SOURCE_SHA256 or args.source_audio.stat().st_mode & 0o077:
        raise RuntimeError("real private audio identity or mode mismatch")

    sandbox_root = args.private_root / "tasks"
    sandbox = TaskArtifactSandbox(sandbox_root)
    coordinator = MediaAcquisitionCoordinator(sandbox)
    created = coordinator.create(request())
    duplicate = coordinator.create(request())
    payload = args.source_audio.read_bytes()
    artifact = sandbox.write_bytes(TASK_ID, "audio", payload)
    private_path = sandbox.private_path(TASK_ID, artifact)
    task_directory = private_path.parent
    task_directory_mode = stat.S_IMODE(task_directory.stat().st_mode)
    artifact_file_mode = stat.S_IMODE(private_path.stat().st_mode)
    hook_calls = []
    coordinator.register_cancel_hook(TASK_ID, lambda: hook_calls.append("stopped"))
    cancelled = coordinator.cancel(TASK_ID)
    cancelled_again = coordinator.cancel(TASK_ID)

    orphan_sandbox = TaskArtifactSandbox(sandbox_root)
    orphan_sandbox.create(ORPHAN_TASK_ID)
    orphan_sandbox.write_bytes(ORPHAN_TASK_ID, "audio", payload[:480_044])
    unknown = sandbox_root / "unknown-user-directory"
    unknown.mkdir(mode=0o700)
    (unknown / "keep.txt").write_text("keep", encoding="utf-8")
    restarted = TaskArtifactSandbox(sandbox_root)
    unknown_preserved = (unknown / "keep.txt").read_text(encoding="utf-8") == "keep"

    import navia_runtime.app as runtime_app

    api_root = args.private_root / "api-tasks"
    api_coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(api_root))
    previous = runtime_app.media_acquisition_coordinator
    runtime_app.media_acquisition_coordinator = api_coordinator
    try:
        client = TestClient(runtime_app.app)
        body = {
            "taskId": TASK_ID,
            "sourceIdentity": "portal:bilibili:BV1ZpYd66ELP:41828944992:1",
            "adapterId": "bilibili",
            "mediaId": "BV1ZpYd66ELP",
            "playbackUnitId": "41828944992",
            "partId": "1",
            "consentPolicyId": "bilibili-media-consent/v1",
            "consentPolicyRevision": 1,
        }
        post = client.post("/v1/media/acquisitions", json=body)
        get = client.get(f"/v1/media/acquisitions/{TASK_ID}")
        reject = client.post("/v1/media/acquisitions", json=body | {"cookie": "forbidden"})
        delete = client.delete(f"/v1/media/acquisitions/{TASK_ID}")
    finally:
        runtime_app.media_acquisition_coordinator = previous

    result = {
        "schemaVersion": "v3-media-acquisition-core-run/v1",
        "task": {
            "createdState": created["state"],
            "idempotent": duplicate == created,
            "cancelledState": cancelled["state"],
            "cancelIdempotent": cancelled_again == cancelled,
            "cancelHookCalls": len(hook_calls),
        },
        "realArtifact": {
            **artifact.public_dict(),
            "sourceKind": "private_real_bilibili_audio",
            "sourceBytesMatched": artifact.byte_length == len(payload),
            "sourceSha256Matched": artifact.sha256 == SOURCE_SHA256,
            "taskDirectoryMode": "0700" if task_directory_mode == 0o700 else "invalid",
            "artifactFileMode": "0600" if artifact_file_mode == 0o600 else "invalid",
            "publicPathIncluded": False,
        },
        "cleanup": {
            "cancelledTaskDirectoryRemoved": not task_directory.exists(),
            "startupRecoveredOrphans": restarted.recovered_orphan_count,
            "unknownDirectoryPreserved": unknown_preserved,
        },
        "api": {
            "postStatus": post.status_code,
            "getStatus": get.status_code,
            "deleteStatus": delete.status_code,
            "closedRequestStatus": reject.status_code,
            "closedRequestCode": reject.json()["error"]["code"],
            "cacheControlNoStore": all(response.headers.get("cache-control") == "no-store" for response in (post, get, delete, reject)),
        },
    }
    result["passed"] = (
        result["task"] == {"createdState": "created", "idempotent": True, "cancelledState": "cancelled", "cancelIdempotent": True, "cancelHookCalls": 1}
        and all(result["realArtifact"][key] for key in ("sourceBytesMatched", "sourceSha256Matched"))
        and result["realArtifact"]["taskDirectoryMode"] == "0700"
        and result["realArtifact"]["artifactFileMode"] == "0600"
        and result["cleanup"] == {"cancelledTaskDirectoryRemoved": True, "startupRecoveredOrphans": 1, "unknownDirectoryPreserved": True}
        and result["api"] == {"postStatus": 201, "getStatus": 200, "deleteStatus": 200, "closedRequestStatus": 400, "closedRequestCode": "V3_MEDIA_TASK_INVALID", "cacheControlNoStore": True}
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    shutil.rmtree(unknown)
    shutil.rmtree(args.private_root, ignore_errors=True)
    print(json.dumps({"passed": result["passed"], "artifactBytes": artifact.byte_length, "orphanRecovered": restarted.recovered_orphan_count, "api": result["api"]}, sort_keys=True))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
