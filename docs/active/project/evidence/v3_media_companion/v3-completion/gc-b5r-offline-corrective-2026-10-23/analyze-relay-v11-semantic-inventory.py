#!/usr/bin/env python3
"""The relay v11 SEMANTIC inventory, extracted from the CURRENT sources.

The relay v11 contract verifier compares each listed source file against the
SHA-256 recorded in the frozen evidence and SKIPS a file whose hash drifted.
The skip cascades into the semantic inventory, so a verifier run after an
authorized source change reports fewer codes than the sources actually emit.

This script answers the question the verifier cannot answer after such a
change: what do the CURRENT sources emit?

It does NOT re-implement the extraction. It loads the verifier's own
`python_codes` / `typescript_codes` helpers (read-only) and runs them over the
CURRENT files, then compares the result with the frozen inventories. The
verifier, the fixtures, the inventories and the schemas are never modified.

Usage:
    python3 analyze-relay-v11-semantic-inventory.py
"""

from __future__ import annotations

import ast
import json
import re
import subprocess
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
REPO = next(
    path
    for path in (HERE, *HERE.parents)
    if (path / "docs/active/project").is_dir()
)
VERIFIER = (
    REPO
    / "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair"
    / "verify-stage-b-b5-3-background-capture-relay-v11-contract.py"
)
FIXTURES = (
    REPO
    / "docs/active/project/fixtures/v3-media-capture-internal-relay-v11-fixtures.json"
)


def load_extractors() -> dict[str, Any]:
    """The verifier's own extraction helpers, loaded without running it."""
    tree = ast.parse(VERIFIER.read_text(encoding="utf-8"))
    wanted = {"python_codes", "typescript_codes"}
    selected = [
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name in wanted
    ]
    namespace: dict[str, Any] = {
        "ast": ast,
        "re": re,
        "json": json,
        "subprocess": subprocess,
        "Path": Path,
        "ROOT": REPO,
    }
    # The two module constants the helpers close over. They are evaluated in
    # the same namespace the verifier evaluates them in.
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if isinstance(target, ast.Name) and target.id in {
                "CODE_PATTERN",
                "PYTHON_BOUNDARY_PARENTS",
            }:
                exec(  # noqa: S102 - the verifier's own constant, loaded read-only
                    compile(
                        ast.Module(body=[node], type_ignores=[]), str(VERIFIER), "exec"
                    ),
                    namespace,
                )
    exec(  # noqa: S102 - the verifier's own helper code, loaded read-only
        compile(ast.Module(body=selected, type_ignores=[]), str(VERIFIER), "exec"),
        namespace,
    )
    return namespace


def main() -> int:
    namespace = load_extractors()
    python_codes = namespace["python_codes"]
    typescript_codes = namespace["typescript_codes"]

    fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))
    protocol = fixtures.get("protocol", {})
    boundary = protocol.get("boundaryFailureNormalization", {})
    evidence = fixtures.get("sourceInventoryEvidence", {})
    # The SAME inventories the verifier compares against.
    frozen_source = set(boundary.get("sourceInventory", []))
    frozen_target = set(boundary.get("targetInventory", []))
    non_relay_allowlist = set(evidence.get("nonRelayCodeAllowlist", []))

    actual_source: set[str] = set()
    actual_target: set[str] = set()
    discovered: set[str] = set()
    unlisted_boundary_emits: dict[str, list[str]] = {}
    per_scope: list[dict[str, Any]] = []
    drifted: list[str] = []

    for item in evidence.get("scopes", []):
        path = REPO / item["path"]
        if item.get("language") == "python":
            codes, valid = python_codes(path, item.get("extractor", ""), item.get("symbols", []))
        else:
            codes, valid = typescript_codes(path, item.get("extractor", ""))
        actual_source |= codes
        discovered |= codes
        current = digest(path)
        if current != item.get("sha256"):
            drifted.append(item["path"])
        per_scope.append({
            "path": item["path"],
            "extractorValid": valid,
            "sha256MatchesFrozenEvidence": current == item.get("sha256"),
            "emittedCodeCount": len(codes),
        })

    for item in evidence.get("targetScopes", []):
        path = REPO / item["path"]
        codes, valid = typescript_codes(path, item.get("extractor", ""))
        # The verifier counts a target-scope code into the source inventory
        # only when the frozen source inventory declares it.
        actual_source |= codes & frozen_source
        actual_target |= codes & frozen_target
        discovered |= codes
        current = digest(path)
        if current != item.get("sha256"):
            drifted.append(item["path"])
        per_scope.append({
            "path": item["path"],
            "extractorValid": valid,
            "sha256MatchesFrozenEvidence": current == item.get("sha256"),
            "emittedCodeCount": len(codes),
        })

    # The discovery-root scan: an UNLISTED file in a boundary root may not
    # emit a frozen source code. This is the verifier's own rule.
    listed = {item["path"] for item in evidence.get("scopes", [])}
    listed |= {item["path"] for item in evidence.get("targetScopes", [])}
    for pattern in evidence.get("discoveryRoots", []):
        for path in sorted(REPO.glob(pattern)):
            relative = path.relative_to(REPO).as_posix()
            if relative in listed or not path.is_file():
                continue
            if path.suffix == ".py":
                codes, _valid = python_codes(path, "python_ast_boundary_module", [])
            elif path.suffix == ".ts":
                codes, _valid = typescript_codes(path, "typescript_compiler_ast_boundary_values")
            else:
                continue
            discovered |= codes
            boundary_codes = codes - frozen_source - non_relay_allowlist
            if boundary_codes:
                unlisted_boundary_emits[relative] = sorted(boundary_codes)

    # The verifier's own comparison rules: the source scope must emit exactly
    # the frozen source inventory, and the target scope exactly the frozen
    # target inventory, with the non-relay allowlist excluded from both.
    source_exact = actual_source == frozen_source
    target_exact = actual_target == frozen_target
    universe_exact = discovered == (frozen_source | frozen_target | non_relay_allowlist)

    result = {
        "schemaVersion": "v3-5.10-gc-b5r-relay-v11-semantic-inventory/v1",
        "verifier": str(VERIFIER.relative_to(REPO)),
        "note": (
            "The extraction is the verifier's own code, applied to the CURRENT "
            "sources. The verifier, the fixtures and the inventories are "
            "unmodified."
        ),
        "sourceInventory": {
            "frozenCount": len(frozen_source),
            "actualCount": len(actual_source),
            "missing": sorted(frozen_source - actual_source),
            "extra": sorted(actual_source - frozen_source),
            "exact": frozen_source == actual_source,
        },
        "targetInventory": {
            "frozenCount": len(frozen_target),
            "actualCount": len(actual_target),
            "missing": sorted(frozen_target - actual_target),
            "extra": sorted(actual_target - frozen_target),
            "exact": frozen_target == actual_target,
        },
        "codeUniverse": {
            "frozenUniverseCount": len(frozen_source | frozen_target | non_relay_allowlist),
            "actualUniverseCount": len(discovered),
            "missing": sorted((frozen_source | frozen_target | non_relay_allowlist) - discovered),
            "extra": sorted(discovered - (frozen_source | frozen_target | non_relay_allowlist)),
            "exact": universe_exact,
        },
        "unlistedBoundaryEmits": unlisted_boundary_emits,
        "driftedSourceScopes": sorted(set(drifted)),
        "perScope": per_scope,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    ok = (
        source_exact
        and target_exact
        and universe_exact
        and all(item["extractorValid"] for item in per_scope)
    )
    return 0 if ok else 2


def digest(path: Path) -> str:
    import hashlib

    return hashlib.sha256(path.read_bytes()).hexdigest()


def protocol_codes(fixtures: dict[str, Any]) -> list[str]:
    protocol = fixtures.get("protocol", {})
    return list(protocol.get("failureCodes", []))


if __name__ == "__main__":
    raise SystemExit(main())
