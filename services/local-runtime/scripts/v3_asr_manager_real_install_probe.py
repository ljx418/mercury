#!/usr/bin/env python3
"""Exercise the production ASR manager with the real frozen Paraformer assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navia_runtime.modules.media_companion.asr.catalog import ASR_MODEL_BY_ID
from navia_runtime.modules.media_companion.asr.model_manager import AsrModelManager, AsrModelManagerError


MODEL_ID = "funasr-paraformer-q8"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets-root", type=Path, required=True)
    parser.add_argument("--state-root", type=Path, required=True)
    parser.add_argument("--bundled-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.assets_root = args.assets_root.resolve(strict=True)
    args.state_root = args.state_root.resolve()
    args.bundled_root = args.bundled_root.resolve(strict=True)
    if args.state_root.exists():
        shutil.rmtree(args.state_root)

    descriptor = ASR_MODEL_BY_ID[MODEL_ID]
    manager = AsrModelManager(args.state_root, bundled_root=args.bundled_root)
    catalog_before = manager.catalog()
    settings_before = manager.settings()
    _, package_path = manager.create_import_path(MODEL_ID)
    package_manifest = {
        "schemaVersion": "v3-asr-offline-package/v1",
        "modelId": descriptor.model_id,
        "revision": descriptor.revision,
        "files": [{"path": item.path, "byteLength": item.byte_length, "sha256": item.sha256} for item in descriptor.files],
    }
    with zipfile.ZipFile(package_path, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
        archive.writestr("manifest.json", json.dumps(package_manifest, ensure_ascii=True, sort_keys=True, separators=(",", ":")))
        for item in descriptor.files:
            archive.write(args.assets_root / item.path, item.path)

    job = manager.start_import(MODEL_ID, package_path, asynchronous=False)
    catalog_after = manager.catalog()
    settings_after = manager.settings()
    published_root = manager.model_path(MODEL_ID)
    if published_root is None:
        raise RuntimeError("real candidate was not published")
    published = []
    for item in descriptor.files:
        path = published_root / item.published_path
        published.append(
            {
                "path": item.published_path,
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
                "executable": bool(os.access(path, os.X_OK)) if os.name != "nt" else item.executable,
            }
        )
    selection_failure = None
    try:
        manager.patch_settings({"requestedModelId": MODEL_ID})
    except AsrModelManagerError as exc:
        selection_failure = exc.code

    restarted = AsrModelManager(args.state_root, bundled_root=args.bundled_root)
    restart_state = next(item for item in restarted.catalog()["models"] if item["modelId"] == MODEL_ID)["installation"]["state"]
    uninstalled_settings = restarted.uninstall(MODEL_ID)
    candidate_before = next(item for item in catalog_before["models"] if item["modelId"] == MODEL_ID)
    candidate_after = next(item for item in catalog_after["models"] if item["modelId"] == MODEL_ID)
    result = {
        "schemaVersion": "v3-asr-manager-real-install-probe/v1",
        "modelId": MODEL_ID,
        "before": {"installation": candidate_before["installation"], "quality": candidate_before["quality"], "settings": settings_before},
        "job": {key: job[key] for key in ("state", "source", "bytesCompleted", "bytesTotal", "percent", "failureCode", "history")},
        "after": {"installation": candidate_after["installation"], "quality": candidate_after["quality"], "settings": settings_after},
        "published": published,
        "selectionFailureCode": selection_failure,
        "restartInstallationState": restart_state,
        "uninstalledSettings": uninstalled_settings,
        "cleanup": {
            "packageRemoved": not package_path.exists(),
            "stagingEmpty": not any(manager.staging_root.iterdir()),
            "candidateRemovedAfterUninstall": manager.model_path(MODEL_ID) is None,
        },
    }
    result["passed"] = (
        job["state"] == "ready"
        and job["bytesCompleted"] == job["bytesTotal"]
        and candidate_after["installation"]["state"] == "ready"
        and candidate_after["quality"]["status"] == descriptor.quality_status
        and settings_after["effectiveModelId"] == "faster-whisper-tiny"
        and selection_failure == "V3_ASR_MODEL_NOT_QUALIFIED"
        and restart_state == "ready"
        and uninstalled_settings["effectiveModelId"] == "faster-whisper-tiny"
        and all(item["bytes"] == expected.published_byte_length and item["sha256"] == expected.published_sha256 for item, expected in zip(published, descriptor.files, strict=True))
        and result["cleanup"] == {"packageRemoved": True, "stagingEmpty": True, "candidateRemovedAfterUninstall": True}
    )
    args.output.write_text(json.dumps(result, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": result["passed"], "jobState": job["state"], "selectionFailureCode": selection_failure, "publishedFiles": len(published)}, sort_keys=True))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
