#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, required=True)
    args = parser.parse_args()
    verification = json.loads((args.run_root / "verification-result.json").read_text(encoding="utf-8"))
    if verification.get("passed") is not True:
        raise RuntimeError("V3_TRANSCRIPT_VERIFICATION_NOT_PASSED")
    files = {
        path.name: {"sha256": sha256_file(path), "byteLength": path.stat().st_size}
        for path in sorted(args.run_root.iterdir())
        if path.is_file() and path.name != "run-seal.json"
    }
    content_sha256 = hashlib.sha256(canonical(files)).hexdigest()
    seal = {
        "schemaVersion": "v3-2-3-sensevoice-run-seal/v1", "runId": verification["runId"],
        "sealedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"), "files": files,
        "contentSha256": content_sha256, "status": "candidate", "humanReviewStatus": "not_started",
        "finalPassed": False,
    }
    (args.run_root / "run-seal.json").write_text(json.dumps(seal, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"runId": seal["runId"], "contentSha256": content_sha256, "fileCount": len(files)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
