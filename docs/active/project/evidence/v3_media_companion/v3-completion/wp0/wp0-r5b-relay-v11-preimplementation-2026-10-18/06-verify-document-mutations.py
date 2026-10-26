#!/usr/bin/env python3
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MUTATIONS = {
    "drop_positive": lambda d: d["positiveCases"].pop(),
    "drop_negative": lambda d: d["negativeCases"].pop(),
    "duplicate_case": lambda d: d["negativeCases"].append(dict(d["negativeCases"][0])),
    "allow_url_only": lambda d: d["invariants"].__setitem__("urlOnlyAcceptanceForbidden", False),
    "allow_no_context_id": lambda d: d["invariants"].__setitem__("authoritativeContextDocumentIdRequired", False),
    "allow_dual_version": lambda d: d["invariants"].__setitem__("dualVersionFallbackForbidden", False),
    "allow_v10_mutation": lambda d: d["invariants"].__setitem__("v10HistoricalMutationForbidden", False),
    "increase_visible_budget": lambda d: d["invariants"].__setitem__("visibleRunBudget", 2),
}

baseline = subprocess.run(["python3", "-B", str(ROOT / "05-verify-document-package.py"), "--root", str(ROOT)],
                          capture_output=True, text=True)
if baseline.returncode != 0:
    raise SystemExit(f"FAIL: baseline verifier is not green: {baseline.stdout}{baseline.stderr}")

passed = 0
for name, mutate in MUTATIONS.items():
    with tempfile.TemporaryDirectory(prefix="navia-v11-doc-") as temp:
        target = Path(temp)
        for source in ROOT.iterdir():
            if source.is_file() and source.name != "AUDIT_MANIFEST.md": shutil.copy2(source, target / source.name)
        path = target / "04-sender-case-matrix.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        mutate(data)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result = subprocess.run(["python3", "-B", str(target / "05-verify-document-package.py"), "--root", str(target)],
                                capture_output=True, text=True)
        if result.returncode == 0: raise SystemExit(f"FAIL: mutation survived: {name}")
        passed += 1
print(json.dumps({"passed": True, "rejectedMutations": passed, "total": len(MUTATIONS)}))
