#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path

EXPECTED_POSITIVE = [f"SP11-P{i:02d}" for i in range(1, 4)]
EXPECTED_NEGATIVE = [f"SP11-N{i:02d}" for i in range(1, 15)]
REQUIRED_DOCS = [
    "01-target-architecture.md", "02-development-plan.md",
    "03-acceptance-plan.md", "04-sender-case-matrix.json", "08-execution-prompt.md"
]

def fail(message):
    raise SystemExit(f"FAIL: {message}")

def load_json_unique(path):
    def pairs(values):
        result = {}
        for key, value in values:
            if key in result:
                fail(f"duplicate JSON key: {key}")
            result[key] = value
        return result
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=pairs)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    root = args.root.resolve()
    for name in REQUIRED_DOCS:
        if not (root / name).is_file(): fail(f"missing {name}")
    matrix = load_json_unique(root / "04-sender-case-matrix.json")
    positives = [row.get("caseId") for row in matrix.get("positiveCases", [])]
    negatives = [row.get("caseId") for row in matrix.get("negativeCases", [])]
    if positives != EXPECTED_POSITIVE: fail(f"positive IDs: {positives}")
    if negatives != EXPECTED_NEGATIVE: fail(f"negative IDs: {negatives}")
    if len(set(positives + negatives)) != 17: fail("duplicate case ID")
    inv = matrix.get("invariants", {})
    required_true = ["senderDocumentIdOptional", "authoritativeContextDocumentIdRequired",
                     "urlOnlyAcceptanceForbidden", "boundedWait", "dualVersionFallbackForbidden",
                     "v10HistoricalMutationForbidden", "chromeMuteAudioRequired"]
    for key in required_true:
        if inv.get(key) is not True: fail(f"invariant not true: {key}")
    if inv.get("exactContextCount") != 1: fail("context count is not exactly one")
    if inv.get("visibleRunBudget") != 1: fail("visible run budget is not one")
    text = "\n".join((root / name).read_text(encoding="utf-8") for name in REQUIRED_DOCS if name.endswith(".md"))
    for token in ["relay v11", "v10", "--mute-audio", "R6", "IMPLEMENTATION NO-GO"]:
        if token not in text: fail(f"required token absent: {token}")
    forbidden = ["SESSDATA=", "bili_jct=", "DedeUserID=", "Bearer sk-"]
    for token in forbidden:
        if token in text: fail(f"secret-like token present: {token}")
    digest = hashlib.sha256((root / "04-sender-case-matrix.json").read_bytes()).hexdigest()
    print(json.dumps({"passed": True, "checks": 17, "positive": 3, "negative": 14,
                      "matrixSha256": digest}, ensure_ascii=False))

if __name__ == "__main__":
    main()
