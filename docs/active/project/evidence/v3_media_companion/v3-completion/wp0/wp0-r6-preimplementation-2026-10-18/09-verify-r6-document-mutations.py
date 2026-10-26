#!/usr/bin/env python3
"""Prove meaning-changing R6 planning mutations fail the document verifier."""

from __future__ import annotations

import copy
import json
import os
import subprocess
import tempfile
from pathlib import Path


PACKAGE = Path(__file__).resolve().parent
MATRIX = json.loads((PACKAGE / "04-r6-case-matrix.json").read_text(encoding="utf-8"))
VERIFIER = PACKAGE / "05-verify-r6-document-package.py"


def run_mutation(name: str, mutate) -> tuple[str, bool]:
    candidate = copy.deepcopy(MATRIX)
    mutate(candidate)
    with tempfile.TemporaryDirectory(prefix="navia-r6-doc-mutation-") as root:
        path = Path(root) / "matrix.json"
        path.write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        env = dict(os.environ, NAVIA_R6_MATRIX_PATH=str(path))
        result = subprocess.run(
            ["python3", "-B", str(VERIFIER)], env=env, capture_output=True, text=True, check=False
        )
    return name, result.returncode != 0


def main() -> int:
    mutations = [
        ("fixture_owner", lambda m: m["fixtureCases"][0].__setitem__("ownerKey", "controller")),
        ("fixture_driver", lambda m: m["fixtureCases"][0].__setitem__("driverType", "shape_only")),
        ("phase_oracle", lambda m: m["phaseRecoveryCases"][0].__setitem__("expected", "success")),
        ("handoff_oracle", lambda m: m["handoffCases"][0].__setitem__("expected", "published")),
        ("supplement_oracle", lambda m: m["realBoundarySupplements"][0].__setitem__("expected", "")),
        ("visible_reclassified", lambda m: m["realBoundarySupplements"][0].__setitem__("group", "R6-G3")),
        ("horizontal_gate", lambda m: m["horizontalGates"].__setitem__(0, "secret_scan_optional")),
        ("r5_equality", lambda m: m["r5EntryGate"].__setitem__("equalityRule", "decision text is enough")),
        ("owner_symbol", lambda m: m["productionOwnerRegistry"]["controller"][0].__setitem__("symbol", "import")),
    ]
    results = [run_mutation(name, mutate) for name, mutate in mutations]
    report = {"total": len(results), "passed": sum(ok for _, ok in results), "results": dict(results)}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if all(ok for _, ok in results) else 2


if __name__ == "__main__":
    raise SystemExit(main())
