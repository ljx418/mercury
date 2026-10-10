#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


EXPECTED_CHECKS = [f"B04-{index:02d}" for index in range(1, 17)]
EXPECTED_HISTORY = ["checking", "downloading", "verifying", "self_testing", "installing", "ready"]
EXPECTED_FILES = {
    "fsmn-vad.gguf": (1720512, "1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479"),
    "llama-funasr-paraformer": (2424840, "aec677df81ac5d8a2274342d92df1290e4bc901f4ebb74f113d3e5d95377c0c2"),
    "paraformer-q8.gguf": (236929024, "42bf76ea1575a336aaca4c1b7c01a82b79113e6d04d0d6b799561bfcf07ee011"),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("run_root", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    run_root = args.run_root.resolve()
    result = json.loads((run_root / "result.json").read_text(encoding="utf-8"))
    prerequisites = json.loads((run_root / "prerequisites.json").read_text(encoding="utf-8"))
    checks: list[dict[str, object]] = []

    def record(identifier: str, passed: bool, detail: object) -> None:
        checks.append({"id": identifier, "passed": bool(passed), "detail": detail})

    acceptance = result.get("checks", [])
    acceptance_ids = [item.get("id") for item in acceptance]
    record("V01", acceptance_ids == EXPECTED_CHECKS and all(item.get("passed") is True for item in acceptance), acceptance_ids)
    record("V02", result.get("summary") == {"total": 16, "passed": 16, "failed": 0} and result.get("passed") is True, result.get("summary"))
    record("V03", all(item.get("exitCode") == 0 for item in prerequisites.get("records", [])) and len(prerequisites.get("records", [])) == 4, [item.get("label") for item in prerequisites.get("records", [])])
    boundaries = result.get("boundaries", {})
    record("V04", boundaries == {"officialRemoteAssets": True, "playwrightRouteInterception": False, "productionSelectionEnabled": False, "claimsV3_2A06": False}, boundaries)
    runtime = result.get("runtime", {})
    record("V05", runtime.get("history") == EXPECTED_HISTORY and runtime.get("finalState") == "ready", runtime.get("history"))
    installed = runtime.get("installedFilesBeforeUninstall", [])
    installed_map = {item.get("name"): (item.get("byteLength"), item.get("sha256")) for item in installed}
    record("V06", installed_map == EXPECTED_FILES, installed_map)
    record("V07", runtime.get("effectiveModelBeforeAndAfter") == ["faster-whisper-tiny", "faster-whisper-tiny"], runtime.get("effectiveModelBeforeAndAfter"))
    accessibility = result.get("accessibility", [])
    record("V08", len(accessibility) == 5 and all(item.get("violations") == [] for item in accessibility), [(item.get("surface"), item.get("width")) for item in accessibility])
    layouts = result.get("layouts", [])
    record("V09", len(layouts) == 4 and all(item.get("scrollWidth", 1) <= item.get("clientWidth", 0) for item in layouts), [(item.get("surface"), item.get("width")) for item in layouts])
    screenshots = result.get("screenshots", [])
    screenshot_valid = len(screenshots) == 6
    for item in screenshots:
        target = run_root / str(item.get("file", ""))
        screenshot_valid = screenshot_valid and target.is_file() and target.stat().st_size == item.get("byteLength") and sha256(target) == item.get("sha256")
    record("V10", screenshot_valid, [item.get("file") for item in screenshots])
    secret_scan = result.get("secretScan", {})
    record("V11", secret_scan.get("hits") == [] and secret_scan.get("forbiddenBinaryExtensions") == [], secret_scan)
    record("V12", not (run_root / "failure.json").exists(), "accepted run must not contain failure.json")

    output = {
        "schemaVersion": "v3-asr-provider-settings-run-verification/v1",
        "runId": result.get("runId"),
        "summary": {"total": len(checks), "passed": sum(item["passed"] is True for item in checks), "failed": sum(item["passed"] is not True for item in checks)},
        "checks": checks,
    }
    output["passed"] = output["summary"]["failed"] == 0
    output_path = args.output or run_root / "verification.json"
    output_path.write_text(json.dumps(output, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output["summary"], sort_keys=True))
    return 0 if output["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
