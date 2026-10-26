#!/usr/bin/env python3
"""Build the WP-B visible-product-seam evidence package and VERIFY it.

1. it hashes the FINAL worktree;
2. it writes the hash record and the SHA-256 payload manifest;
3. it RE-HASHES every listed file and fails if anything moved;
4. it verifies the manifest.

Usage:
    python3 scripts/build_wp_b_visible_product_seam_evidence.py [--check-only]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

RUNTIME_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = RUNTIME_ROOT.parent.parent
EVIDENCE = (
    REPOSITORY_ROOT
    / "docs/active/project/evidence/v3_media_companion/v3-completion"
    / "wp-b-visible-product-seam-implementation-2026-10-20"
)

#: Every file this visible-product-seam pass changed or added.
CHANGED_FILES = (
    # The passive Extension diagnostics seam.
    "apps/chrome-extension/src/modules/media_companion/localImportDiagnostics.ts",
    "apps/chrome-extension/src/modules/media_companion/tests/localImportDiagnostics.test.ts",
    "apps/chrome-extension/src/modules/media_companion/LocalMediaImportClient.ts",
    "apps/chrome-extension/src/modules/media_companion/settings/LocalMediaImportCard.tsx",
    "apps/chrome-extension/src/modules/media_companion/tests/LocalMediaImportClient.test.tsx",
    "apps/chrome-extension/entrypoints/sidepanel/main.tsx",
    # The E2E-only, read-only Runtime observation channel.
    "services/local-runtime/navia_runtime/modules/media_companion/local_import/observations.py",
    "services/local-runtime/navia_runtime/modules/media_companion/local_import/manager.py",
    "services/local-runtime/navia_runtime/modules/media_companion/local_import/consumer_barrier.py",
    "services/local-runtime/navia_runtime/app.py",
    # The deterministic user-flow driver and the harness.
    "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/driver.mjs",
    "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/realAdapters.mjs",
    "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/index.mjs",
    "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/preflight.mjs",
    "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/cases/b27.mjs",
    "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/cases/b30.mjs",
    "apps/chrome-extension/e2e/lib/v3WpBVisibleSession.node-test.mjs",
    "apps/chrome-extension/e2e/v3-wp-b-local-import-owned-session.mjs",
    "services/local-runtime/scripts/build_wp_b_visible_product_seam_evidence.py",
)


def digest_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def snapshot() -> dict[str, dict[str, object]]:
    rows: dict[str, dict[str, object]] = {}
    for relative in CHANGED_FILES:
        path = REPOSITORY_ROOT / relative
        if not path.is_file():
            raise SystemExit(f"A listed file is missing: {relative}")
        rows[relative] = {"bytes": path.stat().st_size, "sha256": digest_of(path)}
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()

    EVIDENCE.mkdir(parents=True, exist_ok=True)
    before = snapshot()

    hash_record = EVIDENCE / "01-changed-file-hashes.json"
    if not args.check_only:
        hash_record.write_text(
            json.dumps(
                {
                    "schemaVersion": "v3-wp-b-visible-product-seam-changed-file-hashes/v1",
                    "note": "Hashes of the FINAL stable worktree. The builder re-hashes every file after writing and fails if anything moved.",
                    "files": before,
                },
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )

    manifest = EVIDENCE / "PAYLOAD_MANIFEST.sha256"
    if not args.check_only:
        lines = []
        for path in sorted(EVIDENCE.iterdir()):
            if path.is_file() and path.name != manifest.name:
                lines.append(f"{digest_of(path)}  {path.name}")
        manifest.write_text("\n".join(lines) + "\n", encoding="utf-8")

    after = snapshot()
    moved = [name for name in before if before[name]["sha256"] != after[name]["sha256"]]
    if moved:
        for name in moved:
            print(f"CHANGED WHILE THE EVIDENCE WAS BUILT: {name}", file=sys.stderr)
        return 1

    for line in manifest.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        expected, name = line.split("  ", 1)
        if digest_of(EVIDENCE / name) != expected:
            print(f"MANIFEST MISMATCH: {name}", file=sys.stderr)
            return 1

    print(
        json.dumps(
            {
                "files": len(before),
                "evidenceFiles": len(manifest.read_text(encoding="utf-8").splitlines()),
                "stable": True,
                "manifestVerified": True,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
