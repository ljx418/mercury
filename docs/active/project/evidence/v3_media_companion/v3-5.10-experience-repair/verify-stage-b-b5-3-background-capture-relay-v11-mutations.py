#!/usr/bin/env python3
"""Isolated adversarial mutations for the V3 capture relay v11 verifier."""
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
CANONICAL_VERIFIER = ROOT / "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-contract.py"
CANONICAL_SCHEMA = ROOT / "docs/active/project/contracts/v3_media_capture_internal_relay_v11.schema.json"
CANONICAL_FIXTURES = ROOT / "docs/active/project/fixtures/v3-media-capture-internal-relay-v11-fixtures.json"
VERIFIER = HERE / "17-internal-relay-v11-verifier.py"
SCHEMA = HERE / "15-internal-relay-v11.schema.json"
FIXTURES = HERE / "16-internal-relay-v11-fixtures.json"
if not (VERIFIER.is_file() and SCHEMA.is_file() and FIXTURES.is_file()):
    VERIFIER, SCHEMA, FIXTURES = CANONICAL_VERIFIER, CANONICAL_SCHEMA, CANONICAL_FIXTURES


def run_verifier(verifier: Path, repo_root: Path) -> tuple[int, dict]:
    completed = subprocess.run(
        ["python3", "-B", str(verifier)],
        cwd=repo_root,
        env={
            **os.environ,
            "NAVIA_REPO_ROOT": str(repo_root),
            "PYTHONDONTWRITEBYTECODE": "1",
        },
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
    with tempfile.TemporaryDirectory(prefix="navia-relay-v11-fixture-") as raw:
        audit = Path(raw)
        shutil.copy2(VERIFIER, audit / VERIFIER.name)
        shutil.copy2(SCHEMA, audit / "15-internal-relay-v11.schema.json")
        payload = json.loads(FIXTURES.read_text(encoding="utf-8"))
        mutate(payload)
        (audit / "16-internal-relay-v11-fixtures.json").write_text(
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
    isolated_schema = root / "docs/active/project/contracts/v3_media_capture_internal_relay_v11.schema.json"
    isolated_fixtures = root / "docs/active/project/fixtures/v3-media-capture-internal-relay-v11-fixtures.json"
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
    with tempfile.TemporaryDirectory(prefix="navia-relay-v11-source-") as raw:
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


def source_files_case(name: str, files: dict[str, str], expected_exit: int, expected_checks: set[str]) -> dict:
    with tempfile.TemporaryDirectory(prefix="navia-relay-v11-source-files-") as raw:
        root = isolated_source_root(raw)
        for relative, content in files.items():
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
    baseline_code, baseline = run_verifier(VERIFIER, ROOT)
    if baseline_code != 0 or baseline.get("summary") != {"total": 50, "passed": 50, "failed": 0}:
        print(json.dumps({
            "schemaVersion": "v3-media-capture-internal-relay-v11-mutation-verification/v1",
            "passed": False,
            "reason": "canonical_baseline_not_green",
            "baselineExit": baseline_code,
            "baselineSummary": baseline.get("summary"),
        }, ensure_ascii=False, indent=2))
        return 2
    cases = [
        fixture_case(
            "sender_policy_weakened_to_url_only",
            lambda value: value["protocol"]["senderPolicy"].update({
                "senderDocumentId": "ignored",
                "contextLookup": "url_only",
                "contextIdentity": "url_only",
                "documentBinding": "none",
            }),
            {"protocolAuthorityAllFieldsImmutable"},
        ),
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
            "owner_receipt_write_removed",
            lambda value: value["protocol"]["artifactOwnershipPolicy"].pop(
                "stagedAudioOwnerReceiptWrite"
            ),
            {"protocolAuthorityAllFieldsImmutable", "ownerManifestAtomicDurabilityExact"},
        ),
        fixture_case(
            "owner_receipt_manifest_hash_mismatch",
            lambda value: value["protocol"]["ownerReceiptExample"].__setitem__(
                "manifestSha256", "b" * 64
            ),
            {"protocolAuthorityAllFieldsImmutable", "stagedAudioCrashOwnerFrozen"},
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
        source_files_case(
            "offscreen_imported_enum_boundary_emit",
            {
                "apps/chrome-extension/entrypoints/media-capture-offscreen/helpers/IndependentFailure.ts": (
                    'export enum IndependentFailure { Code = "V3_MEDIA_CAPTURE_INDEPENDENT_IMPORTED" }\n'
                ),
                "apps/chrome-extension/entrypoints/media-capture-offscreen/ImportedEmitter.ts": (
                    'import { IndependentFailure } from "./helpers/IndependentFailure";\n'
                    'export function fail() { throw new Error(IndependentFailure.Code); }\n'
                ),
            },
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
        "schemaVersion": "v3-media-capture-internal-relay-v11-mutation-verification/v1",
        "passed": not failed,
        "summary": {"total": len(cases), "passed": len(cases) - len(failed), "failed": len(failed)},
        "failedCases": failed,
        "cases": cases,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
