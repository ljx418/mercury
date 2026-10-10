#!/usr/bin/env python3
"""Independently verify a V3-2.6 public fault run."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import jsonschema


FAULTS = (
    "downloader_403", "downloader_timeout", "redirect_private_network", "quota_exceeded",
    "disk_readonly", "disk_full", "ffmpeg_exit", "asr_exit", "runtime_disconnect",
    "capture_socket_loss", "lease_expired", "consent_revoked", "cancel_race", "orphan_process",
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", required=True, type=Path)
    parser.add_argument("--schema", required=True, type=Path)
    args = parser.parse_args()
    root = args.run_root.resolve()
    matrix_path = root / "public/fault-matrix.json"
    diagnostic_path = root / "public/diagnostics.json"
    matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
    diagnostic = json.loads(diagnostic_path.read_text(encoding="utf-8"))
    schema = json.loads(args.schema.read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator.check_schema(schema)
    jsonschema.Draft202012Validator(schema).validate(matrix)
    checks = {
        "faultIds": [item["faultId"] for item in matrix["faults"]] == [f"V3-2-6-F{i:02d}" for i in range(1, 15)],
        "faultClasses": tuple(item["faultClass"] for item in matrix["faults"]) == FAULTS,
        "uniqueEvidence": len({item["evidenceSha256"] for item in matrix["faults"]}) == 14,
        "singleTerminal": all(item["terminalCount"] == 1 for item in matrix["faults"]),
        "zeroPostTerminalWrites": all(item["postTerminalWriteCount"] == 0 for item in matrix["faults"]),
        "zeroResidual": all(item["residualCount"] == 0 for item in matrix["faults"]),
        "zeroSecret": all(item["secretHitCount"] == 0 for item in matrix["faults"]),
        "requirements": [item["requirementId"] for item in matrix["requirements"]] == [f"V3-2-6-A{i:02d}" for i in range(1, 13)],
        "postTerminalRejected": all(item["postTerminalRejected"] for item in diagnostic["faults"]),
        "productionEntryNotImported": diagnostic["productionEntryImported"] is False,
        "privateRemoved": not (root / "private").exists(),
    }
    byte_patterns = (b"SESSDATA", b"bili_jct", b"private-test-value", str(Path.home()).encode())
    hits = []
    for path in (matrix_path, diagnostic_path):
        payload = path.read_bytes()
        hits.extend(pattern.decode(errors="replace") for pattern in byte_patterns if pattern and pattern in payload)
    checks["publicSecretScan"] = not hits
    result = {
        "schemaVersion": "v3-media-fault-verification/v1",
        "runId": matrix["runId"],
        "checks": checks,
        "summary": {"total": len(checks), "passed": sum(checks.values()), "failed": sum(not value for value in checks.values())},
        "matrixSha256": hashlib.sha256(matrix_path.read_bytes()).hexdigest(),
        "passed": all(checks.values()),
    }
    result_path = root / "public/verification.json"
    result_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
