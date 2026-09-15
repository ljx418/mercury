#!/usr/bin/env python3
"""Read-only audit for the frozen durable Forget production-input denominator."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse


MODES = ("direct_open", "reload", "back", "reopen")
EXPECTED_RAW_SHA256 = "711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2"
EXPECTED_SEAL = "acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def is_source_library(url: str, workspace_id: str) -> bool:
    parsed = urlparse(url)
    return (
        parsed.scheme == "chrome-extension"
        and parsed.fragment == f"/knowledge/sources?workspaceId={workspace_id}"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, required=True)
    args = parser.parse_args()

    raw_path = args.run_root / "raw" / "raw-run.json"
    raw = json.loads(raw_path.read_text(encoding="utf-8"))
    by_id = {event["eventId"]: event for event in raw["events"]}
    failures: list[dict[str, object]] = []
    observations: list[dict[str, object]] = []

    actual_raw_sha256 = sha256(raw_path)
    if actual_raw_sha256 != EXPECTED_RAW_SHA256:
        failures.append({"check": "rawSha256", "actual": actual_raw_sha256})
    if raw.get("seal", {}).get("contentSha256") != EXPECTED_SEAL:
        failures.append({"check": "seal.contentSha256", "actual": raw.get("seal")})

    for index in (1, 2, 3):
        expected_source_id: str | None = None
        expected_workspace_id: str | None = None
        for mode in MODES:
            scenario_id = f"scenario_forget_{index}_{mode}"
            events = [event for event in raw["events"] if event["scenarioId"] == scenario_id]
            routes = [event for event in events if event["kind"] == "route_observation"]
            trigger = next((event for event in routes if event["payload"].get("mode") == mode), None)
            if trigger is None:
                failures.append({"scenarioId": scenario_id, "check": "trigger route missing"})
                continue

            payload = trigger["payload"]
            ids = payload["ids"]
            source_id = ids.get("sourceId")
            workspace_id = ids.get("workspaceId")
            if expected_source_id is None:
                expected_source_id = source_id
                expected_workspace_id = workspace_id
            if (source_id, workspace_id) != (expected_source_id, expected_workspace_id):
                failures.append({"scenarioId": scenario_id, "check": "durable identity mismatch"})

            authority_ids = payload.get("authorityEventIds", [])
            terminal = by_id.get(authority_ids[0]) if authority_ids else None
            runtime_source = None
            if terminal and terminal["kind"] == "runtime_response":
                body_ref = terminal["payload"]["bodyArtifact"]
                body = json.loads((args.run_root / body_ref["path"]).read_bytes())
                runtime_source = body.get("data", {}).get("source")

            recovery = next(
                (
                    event
                    for event in routes
                    if event["payload"].get("mode") == "recovery"
                    and workspace_id
                    and is_source_library(event["payload"]["url"], workspace_id)
                ),
                None,
            )
            result = {
                "scenarioId": scenario_id,
                "routeSequence": trigger["sequence"],
                "errorCode": payload.get("errorCode"),
                "idsStatus": ids.get("status"),
                "sourceId": source_id,
                "workspaceId": workspace_id,
                "runtimeSourceStatus": runtime_source.get("status") if runtime_source else None,
                "sourceLibraryRecoveryObserved": recovery is not None,
            }
            observations.append(result)

            if payload.get("errorCode") != "SOURCE_NOT_FOUND":
                failures.append({"scenarioId": scenario_id, "check": "SOURCE_NOT_FOUND missing"})
            if runtime_source is None or runtime_source.get("status") != "forgotten":
                failures.append({"scenarioId": scenario_id, "check": "Runtime forgotten authority missing"})
            elif (runtime_source.get("sourceId"), runtime_source.get("workspaceId")) != (
                source_id,
                workspace_id,
            ):
                failures.append({"scenarioId": scenario_id, "check": "Runtime identity mismatch"})
            if recovery is None:
                failures.append({"scenarioId": scenario_id, "check": "Source Library recovery missing"})

    output = {
        "runId": raw.get("runId"),
        "rawSha256": actual_raw_sha256,
        "sealContentSha256": raw.get("seal", {}).get("contentSha256"),
        "requiredChains": 3,
        "requiredModesPerChain": list(MODES),
        "observations": observations,
        "failureCount": len(failures),
        "failures": failures,
        "eligibleAsT03ProductionPositiveBase": not failures,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
