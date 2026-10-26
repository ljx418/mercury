#!/usr/bin/env python3
"""Verify the R6 planning matrix against the frozen v11 machine authority."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path


REPO = Path(__file__).resolve().parents[8]
PACKAGE = Path(__file__).resolve().parent
MATRIX_PATH = Path(os.environ.get("NAVIA_R6_MATRIX_PATH", PACKAGE / "04-r6-case-matrix.json"))
FIXTURE_PATH = REPO / "docs/active/project/fixtures/v3-media-capture-internal-relay-v11-fixtures.json"
SCHEMA_PATH = REPO / "docs/active/project/contracts/v3_media_capture_internal_relay_v11.schema.json"
EXPECTED_MATRIX_SHA256 = "2b209e3930aa7a785d3f1af69e6f07f2928450ec3bec98affec60440a1e106cc"
ACCEPTED_R5 = REPO / "docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r5-accepted-2026-10-19"
ACCEPTED_PAYLOAD = ACCEPTED_R5 / "60-payload-manifest.sha256"


def reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict:
    result: dict = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def unique_ids(rows: list[dict], prefix: str | tuple[str, ...]) -> bool:
    ids = [row.get("caseId") for row in rows]
    return len(ids) == len(set(ids)) and all(isinstance(case_id, str) and case_id.startswith(prefix) for case_id in ids)


def main() -> int:
    matrix = json.loads(MATRIX_PATH.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicate_keys)
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    cases = matrix.get("fixtureCases", [])
    phases = matrix.get("phaseRecoveryCases", [])
    handoffs = matrix.get("handoffCases", [])
    supplements = matrix.get("realBoundarySupplements", [])
    groups = matrix.get("executionGroups", {})
    owner_registry = matrix.get("productionOwnerRegistry", {})
    all_behaviors = cases + phases + handoffs + supplements

    fixture_expected = {
        row["caseId"]: row["expectedFailureCode"]
        for row in fixture["negativeCases"] + fixture["ownerManifestFailureCases"]
    }
    fixture_mutations = {
        row["caseId"]: row["mutation"]
        for row in fixture["negativeCases"] + fixture["ownerManifestFailureCases"]
    }
    matrix_expected = {row.get("caseId"): row.get("expected") for row in cases}
    matrix_mutations = {row.get("caseId"): row.get("fixtureMutation") for row in cases}
    expected_rly = {f"RLY11-N{index:02d}" for index in range(1, 31)}
    expected_om = {f"OM11-N{index:02d}" for index in range(1, 9)}
    expected_phase_pairs = {
        (row["phase"], row["runtimeState"]) for row in fixture["phaseRecoveryCases"]
    }
    matrix_phase_pairs = {
        (row.get("fixturePhase"), row.get("runtimeState")) for row in phases
    }
    expected_handoffs = {row["injectionPoint"] for row in fixture["handoffFailureCases"]}
    matrix_handoffs = {row.get("injectionPoint") for row in handoffs}
    expected_supplements = {
        "permission_missing",
        "offscreen_context_missing_or_replaced",
        "offscreen_port_disconnect",
        "runtime_ws_loss",
        "tab_close",
        "navigation",
        "user_cancel",
        "runtime_graceful_sigterm",
        "runtime_hard_crash_restart",
        "service_worker_restart_with_live_marker",
        "cleanup_failure",
        "ticket_expired",
        "ticket_replayed",
        "binding_mismatch",
    }
    required_package_files = {
        "00-package-status.md",
        "01-r6-target-architecture.md",
        "02-r6-development-plan.md",
        "03-r6-acceptance-plan.md",
        "04-r6-case-matrix.json",
        "05-verify-r6-document-package.py",
        "06-r6-risk-register.md",
        "07-claudecode-r6-goal.md",
        "08-internal-document-audit.md",
        "09-verify-r6-document-mutations.py",
        "10-compute-r5-candidate-digests.py",
        "11-independent-document-audit.md",
        "AUDIT_MANIFEST.md",
    }
    expected_horizontal_gates = {
        "secret_scan_zero", "owned_resource_cleanup_zero", "typecheck", "media_subtree_regression",
        "full_unit_regression_once", "production_build", "runtime_focused", "relay_static",
        "v11_baseline_50_of_50", "v11_mutations_16_of_16", "prd_review_no_drift",
    }
    expected_source_closure_paths = [
        "apps/chrome-extension/entrypoints/background/index.ts",
        "apps/chrome-extension/entrypoints/media-capture-offscreen/main.ts",
        "apps/chrome-extension/entrypoints/sidepanel/main.tsx",
        "apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureController.ts",
        "apps/chrome-extension/src/modules/media_companion/capture/OffscreenAudioPort.ts",
        "apps/chrome-extension/src/modules/media_companion/capture/OffscreenProducerBootstrap.ts",
        "apps/chrome-extension/src/modules/media_companion/capture/RelayRestartReconciler.ts",
        "apps/chrome-extension/src/modules/media_companion/capture/RuntimeCaptureTransport.ts",
        "apps/chrome-extension/src/modules/media_companion/capture/RuntimeRelayRecoveryAdapter.ts",
        "apps/chrome-extension/src/modules/media_companion/capture/TrustedTabCaptureCard.tsx",
        "apps/chrome-extension/src/modules/media_companion/capture/audioChunk.ts",
        "apps/chrome-extension/src/modules/media_companion/capture/relayContracts.ts",
        "services/local-runtime/navia_runtime/app.py",
        "services/local-runtime/navia_runtime/modules/media_companion/acquisition/audio_ref.py",
        "services/local-runtime/navia_runtime/modules/media_companion/acquisition/capture_grants.py",
        "services/local-runtime/navia_runtime/modules/media_companion/acquisition/capture_sink.py",
        "services/local-runtime/navia_runtime/modules/media_companion/acquisition/coordinator.py",
        "services/local-runtime/navia_runtime/modules/media_companion/acquisition/transcript_service.py",
        "apps/chrome-extension/e2e/v3-acquisition-orchestration-e2e.mjs",
        "apps/chrome-extension/e2e/lib/windowsExtensionInvocation.mjs",
        "apps/chrome-extension/public/capture-audio-worklet.js",
        "apps/chrome-extension/e2e/lib/windowsOwnedAudioIsolation.mjs",
        "apps/chrome-extension/e2e/lib/windows-owned-audio-session-mute.ps1",
    ]

    def owner_registry_is_current() -> bool:
        if not owner_registry:
            return False
        for anchors in owner_registry.values():
            if not isinstance(anchors, list) or not anchors:
                return False
            for anchor in anchors:
                path = REPO / str(anchor.get("path", ""))
                symbol = anchor.get("symbol")
                if not path.is_file() or not isinstance(symbol, str) or symbol not in path.read_text(encoding="utf-8"):
                    return False
        return True

    checks = {
        "matrixSemanticDigestExact": digest(MATRIX_PATH) == EXPECTED_MATRIX_SHA256,
        "matrixSchemaVersion": matrix.get("schemaVersion") == "navia-wp0-r6-case-matrix/v1",
        "statusAllowsR6": matrix.get("status") == "document_pass_r6_may_start",
        "fixturePathExact": matrix.get("authority", {}).get("fixturePath") == str(FIXTURE_PATH.relative_to(REPO)),
        "schemaPathExact": matrix.get("authority", {}).get("schemaPath") == str(SCHEMA_PATH.relative_to(REPO)),
        "fixtureDigestCurrent": matrix.get("authority", {}).get("fixtureSha256") == digest(FIXTURE_PATH),
        "schemaDigestCurrent": matrix.get("authority", {}).get("schemaSha256") == digest(SCHEMA_PATH),
        "fixtureCaseCount38": len(cases) == 38,
        "fixtureCaseIdsUnique": unique_ids(cases, ("RLY11-", "OM11-")),
        "rlyIdsExact30": {row.get("caseId") for row in cases if str(row.get("caseId", "")).startswith("RLY11-")} == expected_rly,
        "omIdsExact8": {row.get("caseId") for row in cases if str(row.get("caseId", "")).startswith("OM11-")} == expected_om,
        "fixtureExpectedCodesExact": matrix_expected == fixture_expected,
        "fixtureMutationsExact": matrix_mutations == fixture_mutations,
        "fixtureMappingsComplete": all(
            row.get("group") in groups
            and row.get("productionOwner")
            and row.get("driverType")
            and row.get("ownerKey") in owner_registry
            and row.get("semanticKey") == f"fixture:{row.get('caseId')}"
            and row.get("evidence") == "fresh"
            for row in cases
        ),
        "phaseCount7": len(phases) == 7,
        "phaseIdsExact": {row.get("caseId") for row in phases} == {f"R6P-N{index:02d}" for index in range(1, 8)},
        "phasePairsExact": matrix_phase_pairs == expected_phase_pairs,
        "phaseFixtureAuthorityExact": [row.get("fixtureAuthority") for row in phases] == fixture["phaseRecoveryCases"],
        "phaseMappingsComplete": all(
            row.get("productionOwner") and row.get("driverType") and row.get("expected")
            and row.get("ownerKey") in owner_registry and row.get("evidence") == "fresh"
            and row.get("semanticKey") == f"phase:{row.get('fixturePhase')}:{row.get('runtimeState')}"
            for row in phases
        ),
        "handoffCount6": len(handoffs) == 6,
        "handoffIdsExact": {row.get("caseId") for row in handoffs} == {f"R6H-N{index:02d}" for index in range(1, 7)},
        "handoffPointsExact": matrix_handoffs == expected_handoffs,
        "handoffFixtureAuthorityExact": [row.get("fixtureAuthority") for row in handoffs] == fixture["handoffFailureCases"],
        "handoffMappingsComplete": all(
            row.get("productionOwner") and row.get("driverType") and row.get("expected")
            and row.get("ownerKey") in owner_registry and row.get("evidence") == "fresh"
            and row.get("semanticKey") == f"handoff:{row.get('injectionPoint')}"
            for row in handoffs
        ),
        "supplementCount14": len(supplements) == 14,
        "supplementIdsExact": {row.get("caseId") for row in supplements} == {f"R6B-N{index:02d}" for index in range(1, 15)},
        "supplementScenariosExact": {row.get("scenario") for row in supplements} == expected_supplements,
        "supplementMappingsComplete": all(
            row.get("productionOwner") and row.get("driverType") and row.get("expected")
            and row.get("ownerKey") in owner_registry and row.get("evidence") == "fresh"
            and row.get("semanticKey") == f"boundary:{row.get('scenario')}"
            for row in supplements
        ),
        "allBehaviorIdsGloballyUnique": len({row.get("caseId") for row in all_behaviors}) == len(all_behaviors),
        "allSemanticKeysGloballyUnique": len({row.get("semanticKey") for row in all_behaviors}) == len(all_behaviors),
        "ownerRegistryCurrent": owner_registry_is_current(),
        "allCasesFreshNoR4BehaviorReuse": all(row.get("evidence") == "fresh" for row in all_behaviors)
        and matrix.get("evidencePolicy", {}).get("r4BehaviorReuseEligibleCaseIds") == [],
        "fiveExecutionGroups": set(groups) == {f"R6-G{index}" for index in range(1, 6)},
        "allGroupReferencesValid": all(row.get("group") in groups for row in all_behaviors),
        "visibleChromeOnlyG2": groups.get("R6-G2", {}).get("visibleChrome") is True
        and all(groups[group].get("visibleChrome") is False for group in groups if group != "R6-G2"),
        "browserSupplementsOnlyG2": all(row.get("group") == "R6-G2" for row in supplements if row.get("driverType", "").startswith("owned_visible_chrome")),
        "horizontalGatesNotCountedAsCases": set(matrix.get("horizontalGates", [])) == expected_horizontal_gates
        and not ({row.get("caseId") for row in cases + phases + handoffs + supplements} & set(matrix.get("horizontalGates", []))),
        "requiredPackageFilesExactAndPresent": set(matrix.get("requiredPackageFiles", [])) == required_package_files
        and all((PACKAGE / name).is_file() for name in required_package_files),
        "r5CandidateBoundEntryGate": matrix.get("r5EntryGate", {}).get("requiredDecision") == "R5 PASS / R6 MAY START"
        and matrix.get("r5EntryGate", {}).get("requiredFields")
        == ["checkpointPath", "payloadManifestSha256", "buildTreeSha256", "productionSourceClosureSha256"]
        and matrix.get("r5EntryGate", {}).get("payloadManifestAlgorithm") == "sha256_bytes_of_checkpoint_payload_manifest_file"
        and matrix.get("r5EntryGate", {}).get("buildTreeRoot") == "apps/chrome-extension/chrome-mv3-unpacked"
        and matrix.get("r5EntryGate", {}).get("buildTreeAlgorithm") == "sha256_of_utf8_lines_sorted_by_posix_relative_path_each_line_path_NUL_file_sha256_LF"
        and matrix.get("r5EntryGate", {}).get("productionSourceClosureAlgorithm") == "sha256_of_utf8_lines_in_declared_order_each_line_path_NUL_file_sha256_LF"
        and matrix.get("r5EntryGate", {}).get("productionSourceClosurePaths") == expected_source_closure_paths
        and matrix.get("r5EntryGate", {}).get("equalityRule") == "R6-0 recomputes all three digests with the declared algorithms and exact inventory; every value must equal the accepted R5-B checkpoint or execution returns to R5-B acceptance."
        and matrix.get("r5EntryGate", {}).get("acceptedCheckpointPath") == str(ACCEPTED_R5.relative_to(REPO))
        and matrix.get("r5EntryGate", {}).get("acceptedPayloadManifestPath") == str(ACCEPTED_PAYLOAD.relative_to(REPO))
        and matrix.get("r5EntryGate", {}).get("acceptedPayloadManifestSha256") == "7ff78a7c15ca2b9eced7978f784f5d5e3517f293b6bc3e1b6351251f2b235a2f"
        and matrix.get("r5EntryGate", {}).get("acceptedBuildTreeSha256") == "2ed5f6fd789826c63fbbcea94a581c10b666e147003ad85c016221e94d6694da"
        and matrix.get("r5EntryGate", {}).get("acceptedProductionSourceClosureSha256") == "cd587f88e794f63452fbca98f1f6ffe6b5b47f657a9dea059e3e0a456c3bf4c2"
        and ACCEPTED_PAYLOAD.is_file()
        and digest(ACCEPTED_PAYLOAD) == matrix.get("r5EntryGate", {}).get("acceptedPayloadManifestSha256")
        and matrix.get("r5EntryGate", {}).get("currentState") == "accepted_same_candidate",
    }
    failed = [name for name, passed in checks.items() if not passed]
    report = {
        "schemaVersion": "navia-wp0-r6-document-verification/v1",
        "passed": not failed,
        "summary": {"total": len(checks), "passed": len(checks) - len(failed), "failed": len(failed)},
        "counts": {
            "fixtureCases": len(cases),
            "phaseRecoveryCases": len(phases),
            "handoffCases": len(handoffs),
            "realBoundarySupplements": len(supplements),
            "totalBehavioralCases": len(cases) + len(phases) + len(handoffs) + len(supplements),
        },
        "checks": checks,
        "failedChecks": failed,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not failed else 2


if __name__ == "__main__":
    raise SystemExit(main())
