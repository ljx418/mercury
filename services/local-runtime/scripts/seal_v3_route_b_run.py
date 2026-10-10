#!/usr/bin/env python3
"""Seal a public-safe Route B run without embedding private media or credentials."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.run_root.resolve(strict=True)
    output = args.output.resolve()
    files = []
    for path in sorted(root.rglob("*")):
        if path == output or not path.is_file():
            continue
        if path.is_symlink():
            raise ValueError("V3_ROUTE_B_SEAL_SYMLINK_REJECTED")
        relative = path.relative_to(root).as_posix()
        files.append({"path": relative, "bytes": path.stat().st_size, "sha256": sha256_file(path)})
    content = {
        "schemaVersion": "v3-route-b-public-run-seal/v1",
        "runId": root.name,
        "fileCount": len(files),
        "files": files,
        "privateMediaIncluded": False,
        "credentialMaterialIncluded": False,
    }
    canonical = json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    content["contentSha256"] = hashlib.sha256(canonical).hexdigest()
    output.write_text(json.dumps(content, ensure_ascii=True, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"fileCount": len(files), "contentSha256": content["contentSha256"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
