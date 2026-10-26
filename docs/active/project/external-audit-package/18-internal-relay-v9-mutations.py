#!/usr/bin/env python3
"""Isolated adversarial mutations for the V3 capture relay v9 verifier."""
from __future__ import annotations

import copy
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = next(
    (
        candidate
        for candidate in (HERE, *HERE.parents)
        if (candidate / "docs/active/project").is_dir()
    ),
    None,
)
if ROOT is None:
    raise SystemExit("repository root was not found")
VERIFIER = ROOT / "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v9-contract.py"
SCHEMA = ROOT / "docs/active/project/contracts/v3_media_capture_internal_relay_v9.schema.json"
FIXTURES = ROOT / "docs/active/project/fixtures/v3-media-capture-internal-relay-v9-fixtures.json"


def run_verifier(verifier: Path, repo_root: Path) -> tuple[int, dict]:
    completed = subprocess.run(
        ["python3", str(verifier)],
        cwd=repo_root,
        env={**os.environ, "NAVIA_REPO_ROOT": str(repo_root)},
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"verifier emitted invalid JSON: {completed.stdout!r} {completed.stderr!r}") from error
    return completed.returncode, payload


def fixture_case(name: str, mutate, expected_checks: set[str]) -> dict:
    with tempfile.TemporaryDirectory(prefix="navia-relay-v9-fixture-") as raw:
        audit = Path(raw)
        shutil.copy2(VERIFIER, audit / VERIFIER.name)
        shutil.copy2(SCHEMA, audit / "15-internal-relay-v9.schema.json")
        payload = json.loads(FIXTURES.read_text(encoding="utf-8"))
        mutate(payload)
        (audit / "16-internal-relay-v9-fixtures.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        code, result = run_verifier(audit / VERIFIER.name, ROOT)
        failed = set(result.get("failedChecks", []))
        return {
            "name": name,
            "expectedExit": 2,
            "actualExit": code,
            "expectedChecks": sorted(expected_checks),
            "observedChecks": sorted(failed),
            "passed": code == 2 and expected_checks <= failed,
        }


def isolated_source_root(raw: str) -> Path:
    root = Path(raw)
    (root / "docs/active/project").mkdir(parents=True)
    isolated_schema = root / "docs/active/project/contracts/v3_media_capture_internal_relay_v9.schema.json"
    isolated_fixtures = root / "docs/active/project/fixtures/v3-media-capture-internal-relay-v9-fixtures.json"
    isolated_schema.parent.mkdir(parents=True, exist_ok=True)
    isolated_fixtures.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SCHEMA, isolated_schema)
    shutil.copy2(FIXTURES, isolated_fixtures)
    for relative in (
        "services/local-runtime/navia_runtime",
        "apps/chrome-extension/src/modules/media_companion/capture",
        "apps/chrome-extension/entrypoints/media-capture-offscreen",
    ):
        source = ROOT / relative
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, target)
    node_modules = ROOT / "apps/chrome-extension/node_modules"
    isolated_modules = root / "apps/chrome-extension/node_modules"
    if node_modules.exists():
        isolated_modules.symlink_to(node_modules, target_is_directory=True)
    return root


def source_case(name: str, relative: str, content: str, expected_exit: int, expected_checks: set[str]) -> dict:
    with tempfile.TemporaryDirectory(prefix="navia-relay-v9-source-") as raw:
        root = isolated_source_root(raw)
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        code, result = run_verifier(VERIFIER, root)
        failed = set(result.get("failedChecks", []))
        return {
            "name": name,
            "expectedExit": expected_exit,
            "actualExit": code,
            "expectedChecks": sorted(expected_checks),
            "observedChecks": sorted(failed),
            "unlistedBoundaryEmits": result.get("unlistedBoundaryEmits", {}),
            "passed": code == expected_exit and expected_checks <= failed,
        }


def main() -> int:
    cases = [
        fixture_case(
            "owner_manifest_failure_removed",
            lambda value: value["ownerManifestFailureCases"].pop(),
            {"allFixtureAuthoritiesImmutable", "traceCountsExact", "ownerManifestInvalidFailClosedExact"},
        ),
        fixture_case(
            "owner_manifest_parent_fsync_removed",
            lambda value: value["protocol"]["artifactOwnershipPolicy"].__setitem__(
                "stagedAudioOwnerManifestWrite",
                "canonical_json_to_owner.json.tmp.<random>_open_O_EXCL_then_file_fsync_then_atomic_replace_owner.json",
            ),
            {"protocolAuthorityAllFieldsImmutable", "ownerManifestAtomicDurabilityExact"},
        ),
        fixture_case(
            "hard_crash_trace_step_removed",
            lambda value: value["hardCrashRecoveryTrace"].pop(4),
            {"allFixtureAuthoritiesImmutable", "traceCountsExact", "hardCrashTraceRecoveryBarrierExact"},
        ),
        fixture_case(
            "authoritative_scope_removed",
            lambda value: value["sourceInventoryEvidence"]["scopes"].pop(),
            {"allFixtureAuthoritiesImmutable", "sourceManifestPathsExact"},
        ),
        fixture_case(
            "source_inventory_entry_removed",
            lambda value: value["protocol"]["boundaryFailureNormalization"]["sourceInventory"].pop(),
            {"protocolAuthorityAllFieldsImmutable", "sourceInventoryExact40", "sourceClassificationClosedAndDisjoint"},
        ),
        fixture_case(
            "source_inventory_entry_added",
            lambda value: value["protocol"]["boundaryFailureNormalization"]["sourceInventory"].append(
                "V3_MEDIA_CAPTURE_MUTATION_ONLY"
            ),
            {"protocolAuthorityAllFieldsImmutable", "sourceInventoryExact40", "sourceClassificationClosedAndDisjoint"},
        ),
        fixture_case(
            "non_relay_allowlist_entry_removed",
            lambda value: value["sourceInventoryEvidence"]["nonRelayCodeAllowlist"].pop(),
            {"allFixtureAuthoritiesImmutable", "discoveredCodeUniverseClosed"},
        ),
        fixture_case(
            "non_relay_allowlist_entry_added",
            lambda value: value["sourceInventoryEvidence"]["nonRelayCodeAllowlist"].append(
                "V3_MEDIA_CAPTURE_MUTATION_ALLOWLIST"
            ),
            {"allFixtureAuthoritiesImmutable", "discoveredCodeUniverseClosed"},
        ),
        source_case(
            "offscreen_direct_boundary_emit",
            "apps/chrome-extension/entrypoints/media-capture-offscreen/BoundaryFailureHelper.ts",
            'export const failureCode = "V3_MEDIA_CAPTURE_MUTATION_DIRECT";\n',
            2,
            {"unlistedSourceFilesEmitNoBoundaryCodes", "discoveredCodeUniverseClosed"},
        ),
        source_case(
            "offscreen_nested_boundary_emit",
            "apps/chrome-extension/entrypoints/media-capture-offscreen/helpers/BoundaryFailureHelper.ts",
            'export function fail() { return "V3_MEDIA_CAPTURE_MUTATION_NESTED"; }\n',
            2,
            {"unlistedSourceFilesEmitNoBoundaryCodes", "discoveredCodeUniverseClosed"},
        ),
        source_case(
            "python_acquisition_boundary_emit",
            "services/local-runtime/navia_runtime/modules/media_companion/acquisition/mutation_helper.py",
            'def fail():\n    return "V3_MEDIA_CAPTURE_MUTATION_PYTHON"\n',
            2,
            {"unlistedSourceFilesEmitNoBoundaryCodes", "discoveredCodeUniverseClosed"},
        ),
        source_case(
            "non_boundary_lexical_string_control",
            "apps/chrome-extension/entrypoints/media-capture-offscreen/NonBoundaryText.ts",
            '// V3_MEDIA_CAPTURE_COMMENT_ONLY\n"V3_MEDIA_CAPTURE_EXPRESSION_ONLY";\n',
            0,
            set(),
        ),
    ]
    failed = [case["name"] for case in cases if not case["passed"]]
    result = {
        "schemaVersion": "v3-media-capture-internal-relay-v9-mutation-verification/v1",
        "passed": not failed,
        "summary": {"total": len(cases), "passed": len(cases) - len(failed), "failed": len(failed)},
        "failedCases": failed,
        "cases": cases,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
