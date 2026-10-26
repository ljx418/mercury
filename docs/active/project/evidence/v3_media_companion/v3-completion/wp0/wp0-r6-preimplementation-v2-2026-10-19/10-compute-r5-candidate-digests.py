#!/usr/bin/env python3
"""Compute the canonical R5 candidate digests required by the R6 entry gate."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


PACKAGE = Path(__file__).resolve().parent
REPO = Path(__file__).resolve().parents[8]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def line_digest(rows: list[tuple[str, str]]) -> str:
    payload = "".join(f"{path}\0{value}\n" for path, value in rows).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload-manifest", required=True)
    args = parser.parse_args()
    matrix = json.loads((PACKAGE / "04-r6-case-matrix.json").read_text(encoding="utf-8"))
    gate = matrix["r5EntryGate"]
    manifest = Path(args.payload_manifest).resolve()
    build_root = REPO / gate["buildTreeRoot"]
    build_files = sorted(path for path in build_root.rglob("*") if path.is_file())
    build_rows = [(path.relative_to(build_root).as_posix(), sha(path)) for path in build_files]
    source_rows = [(path, sha(REPO / path)) for path in gate["productionSourceClosurePaths"]]
    print(json.dumps({
        "checkpointPath": manifest.parent.as_posix(),
        "payloadManifestSha256": sha(manifest),
        "buildTreeSha256": line_digest(build_rows),
        "productionSourceClosureSha256": line_digest(source_rows),
        "buildFileCount": len(build_rows),
        "productionSourceFileCount": len(source_rows),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
