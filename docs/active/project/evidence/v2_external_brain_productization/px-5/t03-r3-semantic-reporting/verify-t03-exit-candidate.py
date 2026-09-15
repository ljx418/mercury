#!/usr/bin/env python3
"""Read-only, fail-closed verification of the T03 R3 exit candidate.

This verifier recomputes artifact references and frozen acceptance counts. It
does not sign Human Review and cannot grant organizationally independent T03
acceptance.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from collections import Counter
from pathlib import Path, PurePosixPath


SOURCE_RUN_ID = "t02-r2-t01-structured-production-input-20260914T125700"
SOURCE_RAW_SHA256 = "ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3"
SOURCE_SEAL_SHA256 = "fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f"
VALIDATION_RUN_ID = "t03-r3-production-exit-candidate-20260914T134804"
NEGATIVE_REQUIREMENT = "T03-IN-11"
PENDING_RULE_IDS = {
    "PX_RULE_FINAL_GATE_OR_HUMAN_REVIEW_FAILED",
    "PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID",
}
STEP_IDS = ["derive", "validate", "report", "package"]
EXPECTED_GATES = {
    "G1": "passed",
    "G2": "passed",
    "G3": "passed",
    "G4": "passed",
    "G5": "passed",
    "G6": "passed",
    "G7": "pending",
}
EXPECTED_REPORT_GATES = {
    "G1_entry": True,
    "G2_route": True,
    "G3_lifecycle": True,
    "G4_architecture": True,
    "G5_status": True,
    "G6_ux_accessibility": True,
    "G7_evidence": False,
}


def find_repo_root() -> Path:
    for candidate in [Path.cwd().resolve(), *Path(__file__).resolve().parents]:
        if (candidate / "docs/active/project").is_dir():
            return candidate
    raise FileNotFoundError("Navia repository root was not found")


REPO_ROOT = find_repo_root()
PX5_ROOT = REPO_ROOT / "docs/active/project/evidence/v2_external_brain_productization/px-5"
STAGE_ROOT = PX5_ROOT / "t03-r3-semantic-reporting"
DEFAULT_CANDIDATE_ROOT = STAGE_ROOT / "runs" / VALIDATION_RUN_ID
DEFAULT_SOURCE_ROOT = (
    PX5_ROOT
    / "t02.5-t01-structured-regression-recollection/runs"
    / SOURCE_RUN_ID
)
DEFAULT_NEGATIVE_ROOT = (
    STAGE_ROOT
    / "runs/t03-r3-negative-t02.4-missing-t01-20260914T132625"
)
CONTRACT_ROOT = REPO_ROOT / "docs/active/project/contracts"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def canonical_sha256(value) -> str:
    data = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha256_bytes(data)


def safe_relative_path(value: str) -> bool:
    if not isinstance(value, str) or not value or "\x00" in value:
        return False
    normalized = value.replace("\\", "/")
    pure = PurePosixPath(normalized)
    return not pure.is_absolute() and ".." not in pure.parts and not re.match(r"^[A-Za-z]:/", normalized)


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


class Audit:
    def __init__(self):
        self.checks: list[dict] = []

    def check(self, check_id: str, passed: bool, requirement: str, observed) -> None:
        self.checks.append({
            "id": check_id,
            "passed": bool(passed),
            "requirement": requirement,
            "observed": observed,
        })

    @property
    def failures(self):
        return [item for item in self.checks if not item["passed"]]


def validate_schemas(audit: Audit, candidate_root: Path) -> None:
    pairs = [
        ("v2_px_derived_facts.schema.json", "derived-facts.json"),
        ("v2_px_production_validation.schema.json", "production-validation.json"),
        ("v2_external_brain_report.schema.json", "report.json"),
        ("v2_external_brain_human_review.schema.json", "human-review.pending.json"),
        ("v2_px_production_package.schema.json", "production-package.json"),
        ("v2_px_invocation_record.schema.json", "invocation-record.json"),
        ("v2_external_brain_architecture_scan_manifest.schema.json", "architecture-scan-manifest.json"),
    ]
    try:
        from jsonschema import Draft202012Validator
        from referencing import Registry, Resource

        registry = Registry()
        for local_schema_path in CONTRACT_ROOT.glob("*.schema.json"):
            local_schema = load(local_schema_path)
            if local_schema.get("$id"):
                registry = registry.with_resource(local_schema["$id"], Resource.from_contents(local_schema))

        errors = []
        for schema_name, instance_name in pairs:
            schema = load(CONTRACT_ROOT / schema_name)
            Draft202012Validator.check_schema(schema)
            instance_errors = sorted(
                Draft202012Validator(schema, registry=registry).iter_errors(load(candidate_root / instance_name)),
                key=lambda error: list(error.path),
            )
            errors.extend(f"{instance_name}:{error.message}" for error in instance_errors)
        audit.check(
            "T03-A01-schema-meta-and-instance",
            not errors,
            "seven candidate schemas pass Draft 2020-12 meta and root-instance validation",
            errors[:30] or {"schemas": len(pairs), "errors": 0},
        )
    except Exception as exc:
        audit.check("T03-A01-schema-meta-and-instance", False, "schema validation is executable", str(exc))


def resolve_ref(ref: dict, source_root: Path, candidate_root: Path) -> Path | None:
    roots = {
        "source_run": source_root,
        "validation_run": candidate_root,
        "repository_snapshot": REPO_ROOT,
    }
    root = roots.get(ref.get("artifactRoot"))
    path_value = ref.get("path")
    if root is None or not safe_relative_path(path_value):
        return None
    candidate = (root / path_value).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def validate_artifact_refs(audit: Audit, source_root: Path, candidate_root: Path, documents: list[dict]) -> None:
    refs = []
    for document in documents:
        for item in walk(document):
            if {"artifactRoot", "path", "sha256", "byteLength", "mediaType"} <= set(item):
                refs.append(item)
    errors = []
    for ref in refs:
        target = resolve_ref(ref, source_root, candidate_root)
        if target is None or not target.is_file():
            errors.append(f"missing-or-unsafe:{ref.get('artifactRoot')}:{ref.get('path')}")
            continue
        data = target.read_bytes()
        if len(data) != ref["byteLength"] or sha256_bytes(data) != ref["sha256"]:
            errors.append(f"bytes-mismatch:{ref['artifactRoot']}:{ref['path']}")
    audit.check(
        "T03-A02-artifact-reference-bytes",
        bool(refs) and not errors,
        "all P7 ArtifactRefs resolve within their declared root and match byte length/hash",
        {"checked": len(refs), "errors": errors[:30]},
    )


def validate_source_and_derived(audit: Audit, source_root: Path, derived: dict) -> None:
    raw_path = source_root / "raw/raw-run.json"
    raw = load(raw_path)
    raw_without_seal = {key: value for key, value in raw.items() if key != "seal"}
    seal = raw.get("seal", {})
    source_ok = (
        raw.get("runId") == SOURCE_RUN_ID
        and sha256(raw_path) == SOURCE_RAW_SHA256
        and seal.get("contentSha256") == SOURCE_SEAL_SHA256
        and canonical_sha256(raw_without_seal) == SOURCE_SEAL_SHA256
    )
    audit.check(
        "T03-A01-source-seal",
        source_ok,
        "candidate binds the immutable T02.5 raw bytes and canonical seal",
        {
            "runId": raw.get("runId"),
            "rawSha256": sha256(raw_path),
            "sealSha256": seal.get("contentSha256"),
            "recomputedSeal": canonical_sha256(raw_without_seal),
        },
    )

    summary = derived.get("summary", {})
    route_matrix = summary.get("routeMatrix", {})
    matrix_ok = set(route_matrix) == {"source_library", "source_detail", "ask", "graph", "permissions"} and all(
        all(route_matrix[route].get(mode, 0) >= 1 for mode in ("direct_open", "reload", "back", "reopen"))
        for route in route_matrix
    )
    t01 = summary.get("t01Regression", {})
    coverage_ok = (
        derived.get("runId") == SOURCE_RUN_ID
        and summary.get("eventCount") == 1387
        and summary.get("artifactCount") == 1172
        and summary.get("scenarioCount") == 88
        and summary.get("entryOrigins") == {"open_workspace": 2, "view_source": 3, "open_in_workspace": 2}
        and summary.get("sourceDistribution") == {"web": 6, "note": 3, "local": 3}
        and summary.get("sourceCount") == 12
        and matrix_ok
        and summary.get("ordinaryRecoveryCount") == 2
        and summary.get("forgetSourceCount") == 3
        and summary.get("durableForgetTriggers") == 12
        and summary.get("durableForgetRecoveries") == 12
        and set(summary.get("faultTypes", [])) == {"adapter_blocked", "data_service_unreachable", "runtime_offline", "source_failed"}
        and set(summary.get("screenshotWidths", {})) == {"360", "420", "768", "1280"}
        and summary.get("axe", {}).get("serious") == 0
        and summary.get("axe", {}).get("critical") == 0
        and summary.get("keyboard", {}).get("assertionsTotal") == 5
        and summary.get("keyboard", {}).get("assertionsPassed") == 5
        and t01.get("assertionsTotal") == 36
        and t01.get("assertionsPassed") == 36
        and len(set(t01.get("assertionIds", []))) == 36
        and t01.get("passed") is True
    )
    audit.check(
        "T03-A03-A06-derived-coverage",
        coverage_ok,
        "derived facts retain the fixed production-positive source, route, recovery, fault, UX and T01 denominators",
        {
            "events": summary.get("eventCount"),
            "artifacts": summary.get("artifactCount"),
            "scenarios": summary.get("scenarioCount"),
            "sources": summary.get("sourceDistribution"),
            "routeMatrixComplete": matrix_ok,
            "ordinaryRecoveries": summary.get("ordinaryRecoveryCount"),
            "durableForget": [summary.get("durableForgetTriggers"), summary.get("durableForgetRecoveries")],
            "t01": [t01.get("assertionsPassed"), t01.get("assertionsTotal"), len(set(t01.get("assertionIds", [])))],
        },
    )
    derived_without_seal = {key: value for key, value in derived.items() if key != "seal"}
    audit.check(
        "T03-A11-derived-canonical-seal",
        derived.get("seal", {}).get("contentSha256") == canonical_sha256(derived_without_seal),
        "DerivedFacts seal is canonical JSON without seal and is independently reproducible",
        {"declared": derived.get("seal", {}).get("contentSha256"), "recomputed": canonical_sha256(derived_without_seal)},
    )


def validate_rules_and_suites(audit: Audit, candidate_root: Path, validation: dict) -> None:
    registry = load(CONTRACT_ROOT / "v2_external_brain_validation_contracts.schema.json")
    rule_registry = registry["x-navia-rule-registry"]
    expected_rules = {item["ruleId"]: item for item in rule_registry}
    actual_rules = {item["ruleId"]: item for item in validation.get("ruleResults", [])}
    statuses = Counter(item.get("status") for item in validation.get("ruleResults", []))
    pending = {item["ruleId"] for item in validation.get("ruleResults", []) if item.get("status") == "pending"}
    mappings_ok = all(
        item.get("enforcementLayer") == expected_rules[rule_id]["enforcementLayer"]
        and (item.get("failureCode") is None if item.get("status") == "passed" else item.get("failureCode") == expected_rules[rule_id]["failureCode"])
        for rule_id, item in actual_rules.items()
        if rule_id in expected_rules
    )
    audit.check(
        "T03-A04-rule-profile",
        set(actual_rules) == set(expected_rules)
        and len(actual_rules) == 63
        and statuses == Counter({"passed": 61, "pending": 2})
        and pending == PENDING_RULE_IDS
        and mappings_ok
        and validation.get("profile") == "production_candidate",
        "production_candidate executes the exact 63-rule registry with only two Human rules pending",
        {"rules": len(actual_rules), "statuses": dict(statuses), "pending": sorted(pending), "mappingsOk": mappings_ok},
    )
    audit.check(
        "T03-A10-gate-and-claim-boundary",
        validation.get("gateResults") == EXPECTED_GATES
        and validation.get("machinePassed") is True
        and validation.get("humanReviewStatus") == "pending"
        and validation.get("finalPassed") is False
        and validation.get("issues") == [],
        "G1-G6 pass while G7/Human/final remain pending/false",
        {
            "gates": validation.get("gateResults"),
            "machinePassed": validation.get("machinePassed"),
            "humanReviewStatus": validation.get("humanReviewStatus"),
            "finalPassed": validation.get("finalPassed"),
        },
    )

    contract = load(candidate_root / "contract-regression.json")
    requirements = {item["requirementId"]: item for item in registry["x-navia-requirement-registry"]}
    cases = {item["requirementId"]: item for item in contract.get("caseResults", [])}
    contract_ok = (
        contract.get("passed") is True
        and contract.get("counts", {}).get("rules") == 63
        and contract.get("counts", {}).get("semanticRules") == 41
        and contract.get("counts", {}).get("fixtures") == 109
        and set(cases) == set(requirements)
        and all(cases[key].get("expectedLayer") == value["enforcementLayer"] for key, value in requirements.items())
        and all(cases[key].get("primaryFailure") == value["expectedPrimaryFailure"] for key, value in requirements.items())
    )
    audit.check(
        "T03-A05-contract-regression",
        contract_ok,
        "109 requirements map one-to-one to the frozen requirement registry and canonical primary failures",
        {"requirements": len(requirements), "cases": len(cases), "issues": contract.get("issues")},
    )

    mutation_registry = load(CONTRACT_ROOT / "v2_px_production_mutation_registry.json")
    mutations = load(candidate_root / "production-mutation-results.json")
    expected_mutations = {item["mutationId"]: item for item in mutation_registry["mutations"]}
    actual_mutations = {item["mutationId"]: item for item in mutations.get("results", [])}
    mutation_ok = (
        mutations.get("total") == 42
        and mutations.get("passed") == 42
        and mutations.get("failed") == 0
        and set(actual_mutations) == set(expected_mutations)
        and all(
            actual_mutations[key].get("passed") is True
            and actual_mutations[key].get("reportBooleanMutated") is False
            and actual_mutations[key].get("beforeSha256") != actual_mutations[key].get("afterSha256")
            and actual_mutations[key].get("expectedRuleId") == value["expectedRuleId"]
            and actual_mutations[key].get("actualPrimaryFailure") == value["expectedPrimaryFailure"]
            for key, value in expected_mutations.items()
        )
    )
    audit.check(
        "T03-A07-production-mutations",
        mutation_ok,
        "all 42 frozen production mutations alter non-report evidence and fail with the registered primary failure",
        {"expected": len(expected_mutations), "actual": len(actual_mutations), "passed": mutations.get("passed"), "failed": mutations.get("failed")},
    )

    status = load(candidate_root / "status-contract-errors.json")
    audit.check(
        "T03-A06-status-observations",
        status == {"checked": 204, "errors": []},
        "203 Runtime responses plus one event-backed frontend offline inference validate without authority errors",
        status,
    )


def validate_architecture_manifest(audit: Audit, candidate_root: Path) -> None:
    manifest = load(candidate_root / "architecture-scan-manifest.json")
    tracked = manifest.get("trackedPaths", [])
    paths = [item.get("path") for item in tracked]
    git_errors = []
    for item in tracked:
        completed = subprocess.run(
            ["git", "show", f"{manifest.get('repositoryCommit')}:{item.get('path')}"],
            cwd=REPO_ROOT,
            check=False,
            capture_output=True,
        )
        if completed.returncode != 0 or sha256_bytes(completed.stdout) != item.get("blobSha256"):
            git_errors.append(item.get("path"))
    path_index = "".join(f"{value}\n" for value in sorted(paths))
    source_tree = "".join(f"{item['mode']} {item['blobSha256']} {item['path']}\n" for item in sorted(tracked, key=lambda value: value["path"]))
    ruleset = candidate_root / manifest.get("rulesetArtifact", {}).get("path", "")
    allowlist = candidate_root / manifest.get("allowlistArtifact", {}).get("path", "")
    manifest_ok = (
        manifest.get("repositoryCommit") == "430cddcb7ff618978851af1f3b9a3c48f2370d36"
        and manifest.get("scanRoots") == [
            "apps/chrome-extension/entrypoints/sidepanel",
            "apps/chrome-extension/entrypoints/workspace",
            "apps/chrome-extension/src/modules/knowledge_workspace",
        ]
        and manifest.get("excludedPaths") == ["node_modules", "dist", ".output"]
        and manifest.get("symlinkPolicy") == "hash_link_target_utf8"
        and paths == sorted(paths)
        and len(paths) == len(set(paths)) == 28
        and all("inlineSource" not in item for item in tracked)
        and not git_errors
        and manifest.get("canonicalPathIndex", {}).get("content") == path_index
        and manifest.get("canonicalPathIndex", {}).get("sha256") == sha256_bytes(path_index.encode("utf-8"))
        and manifest.get("canonicalSourceTree", {}).get("content") == source_tree
        and manifest.get("canonicalSourceTree", {}).get("sha256") == sha256_bytes(source_tree.encode("utf-8"))
        and ruleset.is_file()
        and sha256(ruleset) == manifest.get("rulesetArtifact", {}).get("sha256")
        and allowlist.is_file()
        and sha256(allowlist) == manifest.get("allowlistArtifact", {}).get("sha256")
    )
    audit.check(
        "T03-A08-architecture-scan-inputs",
        manifest_ok,
        "G4 scan manifest binds the frozen commit, exact roots, 28 inline blobs, path/tree indexes, ruleset and allowlist",
        {"commit": manifest.get("repositoryCommit"), "trackedPaths": len(paths), "embeddedSourceCount": sum("inlineSource" in item for item in tracked), "gitBlobErrors": git_errors},
    )


def resolve_report_artifact(path_value: str, source_root: Path, candidate_root: Path) -> Path | None:
    if not safe_relative_path(path_value):
        return None
    prefix = "evidence/source-run/"
    if path_value.startswith(prefix):
        return source_root / path_value[len(prefix):]
    return candidate_root / path_value


def validate_report_package_invocation(audit: Audit, source_root: Path, candidate_root: Path) -> None:
    report = load(candidate_root / "report.json")
    package = load(candidate_root / "production-package.json")
    invocation = load(candidate_root / "invocation-record.json")
    human = load(candidate_root / "human-review.pending.json")

    report_ref_errors = []
    report_refs = []
    for item in walk(report):
        if {"path", "sha256"} <= set(item):
            report_refs.append(item)
    for ref in report_refs:
        target = resolve_report_artifact(ref["path"], source_root, candidate_root)
        if target is None or not target.is_file() or sha256(target) != ref["sha256"]:
            report_ref_errors.append(ref["path"])
    commands = report.get("testCommands", [])
    suite_counts = [item.get("result", {}) for item in commands]
    report_ok = (
        report.get("passed") is False
        and report.get("gateResults") == EXPECTED_REPORT_GATES
        and len(report.get("scenarioResults", [])) == 17
        and all(item.get("passed") is True for item in report.get("scenarioResults", []))
        and len(commands) == 9
        and all(item.get("passed") is True and item.get("exitCode") == 0 and item.get("signal") is None for item in commands)
        and any(item.get("resultType") == "suite" and item.get("assertionsTotal") == item.get("assertionsPassed") == 36 for item in suite_counts)
        and any(item == {"resultType": "axe", "serious": 0, "critical": 0} for item in suite_counts)
        and any(item.get("resultType") == "keyboard" and item.get("assertionsTotal") == item.get("assertionsPassed") == 5 for item in suite_counts)
        and not report_ref_errors
    )
    audit.check(
        "T03-A12-report-inputs",
        report_ok,
        "pure report stays non-final and every scenario/command/audit path resolves to the declared bytes",
        {"scenarios": len(report.get("scenarioResults", [])), "commands": len(commands), "artifactRefs": len(report_refs), "errors": report_ref_errors[:30]},
    )

    package_text = (candidate_root / "production-package.json").read_text(encoding="utf-8")
    invocation_text = (candidate_root / "invocation-record.json").read_text(encoding="utf-8")
    package_ok = (
        package.get("runId") == VALIDATION_RUN_ID
        and package.get("automatedCandidatePassed") is True
        and package.get("humanReviewStatus") == "pending"
        and package.get("passed") is False
        and human.get("status") == "pending"
        and human.get("signedClaim") == package.get("claim") == report.get("claim")
        and "production-package.json" not in package_text
        and "invocation-record.json" not in package_text
    )
    audit.check(
        "T03-6-A02-A07-package-boundary",
        package_ok,
        "Package binds the candidate while Human Review/final remain pending/false and contains no self/invocation reference",
        {"runId": package.get("runId"), "human": package.get("humanReviewStatus"), "passed": package.get("passed")},
    )

    steps = invocation.get("steps", [])
    leaked = [value for value in re.findall(r'[^"\s]+', invocation_text) if "/mnt/c/workspace/navia" in value.lower()]
    invocation_ok = (
        invocation.get("validationRunId") == VALIDATION_RUN_ID
        and invocation.get("sourceRunId") == SOURCE_RUN_ID
        and [item.get("stepId") for item in steps] == STEP_IDS
        and all(item.get("exitCode") == 0 and item.get("signal") is None for item in steps)
        and invocation.get("exitCode") == 0
        and invocation.get("passed") is True
        and invocation.get("productionPackage", {}).get("sha256") == sha256(candidate_root / "production-package.json")
        and "invocation-record.json" not in invocation_text
        and not leaked
    )
    audit.check(
        "T03-6-A06-T03-7-A04-invocation",
        invocation_ok,
        "InvocationRecord has the exact four successful steps, portable paths and a final package hash without self-reference",
        {"steps": [item.get("stepId") for item in steps], "leakedAbsolutePaths": leaked},
    )


def validate_negative_path(audit: Audit, negative_root: Path) -> None:
    files = sorted(path.relative_to(negative_root).as_posix() for path in negative_root.rglob("*") if path.is_file())
    forbidden = {"production-validation.json", "report.json", "production-package.json", "invocation-record.json"}
    diagnostic = load(negative_root / "collection-diagnostic.json")
    observations = diagnostic.get("missingObservations", [])
    negative_ok = (
        diagnostic.get("passed") is False
        and len(observations) == 1
        and observations[0].get("requirementId") == NEGATIVE_REQUIREMENT
        and observations[0].get("observed") == 0
        and observations[0].get("required") == 36
        and not any(Path(value).name in forbidden for value in files)
    )
    audit.check(
        "T03-A09-T03-7-A07-negative-diagnostic",
        negative_ok,
        "T02.4 exits through the exact T03-IN-11 diagnostic and cannot emit validation/report/package/invocation success artifacts",
        {"files": files, "missingObservations": observations},
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate-root", type=Path, default=DEFAULT_CANDIDATE_ROOT)
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--negative-root", type=Path, default=DEFAULT_NEGATIVE_ROOT)
    parser.add_argument("--output", type=Path, default=STAGE_ROOT / "local-exit-verification.json")
    args = parser.parse_args()
    candidate_root = args.candidate_root.resolve()
    source_root = args.source_root.resolve()
    negative_root = args.negative_root.resolve()
    audit = Audit()

    required = [
        "derived-facts.json", "production-validation.json", "report.json",
        "human-review.pending.json", "production-package.json", "invocation-record.json",
        "contract-regression.json", "production-mutation-results.json",
        "status-contract-errors.json", "architecture-scan-manifest.json",
    ]
    missing = [name for name in required if not (candidate_root / name).is_file()]
    audit.check("T03-A01-required-artifacts", not missing, "all fixed candidate artifacts exist", missing or required)
    if missing:
        result = build_result(audit, candidate_root, source_root, negative_root)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return 1

    derived = load(candidate_root / "derived-facts.json")
    validation = load(candidate_root / "production-validation.json")
    package = load(candidate_root / "production-package.json")
    invocation = load(candidate_root / "invocation-record.json")
    validate_schemas(audit, candidate_root)
    validate_artifact_refs(audit, source_root, candidate_root, [derived, validation, package, invocation])
    validate_source_and_derived(audit, source_root, derived)
    validate_rules_and_suites(audit, candidate_root, validation)
    validate_architecture_manifest(audit, candidate_root)
    validate_report_package_invocation(audit, source_root, candidate_root)
    validate_negative_path(audit, negative_root)

    result = build_result(audit, candidate_root, source_root, negative_root)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
    return 0 if not audit.failures else 1


def build_result(audit: Audit, candidate_root: Path, source_root: Path, negative_root: Path) -> dict:
    machine_passed = not audit.failures
    return {
        "schemaVersion": "v2-px-t03-local-exit-verification/v1",
        "scope": "local_self_audit_only",
        "candidateRoot": candidate_root.relative_to(REPO_ROOT).as_posix(),
        "sourceRoot": source_root.relative_to(REPO_ROOT).as_posix(),
        "negativeRoot": negative_root.relative_to(REPO_ROOT).as_posix(),
        "checks": audit.checks,
        "summary": {
            "checksTotal": len(audit.checks),
            "checksPassed": len(audit.checks) - len(audit.failures),
            "checksFailed": len(audit.failures),
            "localExitCandidatePassed": machine_passed,
            "independentExitAudit": "pending",
            "t03Passed": False,
            "fatal": 0 if machine_passed else 1,
            "major": 0 if machine_passed else len(audit.failures),
        },
        "claimBoundary": "Local T03 implementation exit candidate only; T03, PX-5, PX-6, V2 and RKM acceptance remain pending.",
    }


if __name__ == "__main__":
    raise SystemExit(main())
