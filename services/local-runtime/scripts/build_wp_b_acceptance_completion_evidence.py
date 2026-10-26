#!/usr/bin/env python3
"""Build the WP-B acceptance-completion evidence package and VERIFY it.

The builder is deliberately paranoid about the one thing that invalidated the
previous candidate: a listed file that changed after the hashes were taken.

1. it hashes the FINAL worktree;
2. it writes the hash record and the SHA-256 payload manifest;
3. it RE-HASHES every listed file and fails if anything moved.

Usage:
    python3 scripts/build_wp_b_acceptance_completion_evidence.py [--check-only]
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
    / "wp-b-explicit-local-media-import-acceptance-completion-offline-2026-10-20"
)

#: Every file this acceptance-completion phase changed or added.
CHANGED_FILES = (
    # Runtime production code
    "services/local-runtime/navia_runtime/app.py",
    "services/local-runtime/navia_runtime/modules/media_companion/acquisition/coordinator.py",
    "services/local-runtime/navia_runtime/modules/media_companion/acquisition/transcript_service.py",
    "services/local-runtime/navia_runtime/modules/media_companion/product_materializer.py",
    "services/local-runtime/navia_runtime/modules/media_companion/local_import/consumer_barrier.py",
    "services/local-runtime/navia_runtime/modules/media_companion/local_import/contracts.py",
    "services/local-runtime/navia_runtime/modules/media_companion/local_import/manager.py",
    "services/local-runtime/navia_runtime/modules/media_companion/local_import/orchestrator.py",
    "services/local-runtime/navia_runtime/modules/media_companion/local_import/preparer.py",
    "services/local-runtime/navia_runtime/modules/media_companion/local_import/runtime.py",
    "services/local-runtime/navia_runtime/modules/media_companion/local_import/store.py",
    "services/local-runtime/scripts/v3_media_local_import_wp_b_probe.py",
    "services/local-runtime/scripts/build_wp_b_acceptance_completion_evidence.py",
    # Runtime tests
    "services/local-runtime/tests/test_v3_media_local_import_contracts_store.py",
    "services/local-runtime/tests/test_v3_media_local_import_manager.py",
    "services/local-runtime/tests/test_v3_media_local_import_api.py",
    "services/local-runtime/tests/test_v3_media_local_import_preparer.py",
    "services/local-runtime/tests/test_v3_media_local_import_barrier.py",
    "services/local-runtime/tests/test_v3_media_local_import_restart.py",
    "services/local-runtime/tests/test_v3_media_local_import_gates.py",
    "services/local-runtime/tests/test_wp_b_c2_streaming_put.py",
    "services/local-runtime/tests/test_wp_b_c3_eligibility.py",
    "services/local-runtime/tests/test_wp_b_c4_orchestrator.py",
    "services/local-runtime/tests/test_wp_b_c5_startup_recovery.py",
    "services/local-runtime/tests/test_wp_b_c6_routed_http.py",
    "services/local-runtime/tests/test_wp_b_c7_production.py",
    "services/local-runtime/tests/test_wp_b_fc1_client_headers.py",
    "services/local-runtime/tests/test_wp_b_fc4_fixed_cases.py",
    "services/local-runtime/tests/test_wp_b_ac1_visual_terminal_durability.py",
    "services/local-runtime/tests/test_wp_b_ac2_b01_schemas_fixtures.py",
    "services/local-runtime/tests/test_wp_b_ac2_routed_transport.py",
    "services/local-runtime/tests/test_wp_b_ac2_preparation.py",
    "services/local-runtime/tests/test_wp_b_ac2_lifecycle.py",
    "services/local-runtime/tests/wp_b_local_import_harness.py",
    "services/local-runtime/tests/wp_b_ac1_stack.py",
    "services/local-runtime/tests/test_wp0_r4_restart_and_security.py",
    # Extension
    "apps/chrome-extension/src/modules/media_companion/LocalMediaImportClient.ts",
    "apps/chrome-extension/src/modules/media_companion/MediaCredentialWorkspacePage.tsx",
    "apps/chrome-extension/src/modules/media_companion/createLocalImportRuntimeClient.ts",
    "apps/chrome-extension/src/modules/media_companion/localImportEntry.ts",
    "apps/chrome-extension/src/modules/media_companion/settings/LocalMediaImportCard.tsx",
    "apps/chrome-extension/src/modules/media_companion/tests/LocalMediaImportClient.test.tsx",
    "apps/chrome-extension/src/modules/media_companion/tests/MediaCredentialWorkspacePageComposition.test.tsx",
    "apps/chrome-extension/src/runtimeClient.ts",
    "apps/chrome-extension/e2e/lib/v3WpBLocalImportOwnedSession.mjs",
    "apps/chrome-extension/e2e/lib/v3WpBLocalImportOwnedSession.node-test.mjs",
    "apps/chrome-extension/e2e/v3-wp-b-local-import-owned-session.mjs",
    "apps/chrome-extension/package.json",
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
        rows[relative] = {
            "bytes": path.stat().st_size,
            "sha256": digest_of(path),
        }
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
                    "schemaVersion": "v3-wp-b-changed-file-hashes/v1",
                    "note": "Hashes of the FINAL stable worktree. The builder re-hashes every file after writing and fails if anything moved.",
                    "files": before,
                },
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )

    # The payload manifest covers the evidence directory itself.
    manifest = EVIDENCE / "PAYLOAD_MANIFEST.sha256"
    if not args.check_only:
        lines = []
        for path in sorted(EVIDENCE.iterdir()):
            if path.is_file() and path.name != manifest.name:
                lines.append(f"{digest_of(path)}  {path.name}")
        manifest.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # THE GUARD: nothing may have moved while the package was written.
    after = snapshot()
    moved = [name for name in before if before[name]["sha256"] != after[name]["sha256"]]
    if moved:
        for name in moved:
            print(f"CHANGED WHILE THE EVIDENCE WAS BUILT: {name}", file=sys.stderr)
        return 1

    # And the manifest must verify.
    for line in manifest.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        expected, name = line.split("  ", 1)
        actual = digest_of(EVIDENCE / name)
        if actual != expected:
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
