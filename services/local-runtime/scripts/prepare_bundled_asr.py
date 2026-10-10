#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from navia_runtime.modules.media_companion.asr.catalog import ASR_MODEL_BY_ID, DEFAULT_ASR_MODEL_ID
from navia_runtime.modules.media_companion.asr.model_manager import AsrModelManager


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare Navia's immutable bundled ASR fallback asset.")
    parser.add_argument("--source", type=Path, required=True, help="Local immutable faster-whisper tiny snapshot.")
    parser.add_argument("--output", type=Path, required=True, help="Release asset root; modelId is appended.")
    args = parser.parse_args()
    descriptor = ASR_MODEL_BY_ID[DEFAULT_ASR_MODEL_ID]
    target = args.output / descriptor.model_id
    temporary = args.output / f".{descriptor.model_id}.staging"
    if temporary.exists():
        shutil.rmtree(temporary)
    temporary.mkdir(parents=True)
    for expected in descriptor.files:
        source = args.source / expected.path
        if not source.is_file():
            raise SystemExit(f"missing required source file: {expected.path}")
        shutil.copyfile(source, temporary / expected.path)
    verifier = AsrModelManager(args.output / ".verification", bundled_root=args.output, self_test=lambda *_: None)
    verifier._verify_directory(descriptor, temporary)
    manifest_path = args.output / "bundled-asr-manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schemaVersion": "v3-asr-bundled-asset/v1",
                "modelId": descriptor.model_id,
                "repository": descriptor.repository,
                "revision": descriptor.revision,
                "files": [{"path": item.path, "byteLength": item.byte_length, "sha256": item.sha256} for item in descriptor.files],
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    if target.exists():
        shutil.rmtree(target)
    temporary.rename(target)
    shutil.rmtree(args.output / ".verification", ignore_errors=True)
    print(target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
