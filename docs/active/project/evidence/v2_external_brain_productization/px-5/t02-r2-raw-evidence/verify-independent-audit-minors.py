#!/usr/bin/env python3
"""Read-only checks for the three non-blocking T02 independent-audit minors."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from jsonschema import Draft202012Validator


def find_repo_root() -> Path:
    for candidate in [Path.cwd().resolve(), *Path(__file__).resolve().parents]:
        if (candidate / "docs/active/project").is_dir():
            return candidate
    raise FileNotFoundError("Navia repository root was not found")


REPO_ROOT = find_repo_root()
EVIDENCE_ROOT = (
    REPO_ROOT
    / "docs/active/project/evidence/v2_external_brain_productization/px-5/t02-r2-raw-evidence"
)
RUN_ROOT = EVIDENCE_ROOT / "runs" / "t02-r2-raw-20260911T143100"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validator_for_definition(schema: dict, definition: str) -> Draft202012Validator:
    return Draft202012Validator(
        {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$defs": schema["$defs"],
            "$ref": f"#/$defs/{definition}",
        }
    )


def check_t01() -> dict:
    report = load_json(RUN_ROOT / ".infra/t01-regression/raw/t01-real-chrome-run.json")
    checks = report.get("checks", [])
    require(report.get("passed") is True, "T01 root passed is not true")
    require(len(checks) == 36, f"expected 36 T01 checks, got {len(checks)}")
    failed = [check.get("id", "<missing-id>") for check in checks if check.get("passed") is not True]
    require(not failed, f"failed T01 checks: {failed}")
    ids = [check.get("id") for check in checks]
    require(all(ids), "a T01 check has no id")
    return {"checks": len(checks), "passed": len(checks), "distinctCheckIds": len(set(ids))}


def check_runtime_transport(raw_run: dict) -> dict:
    events = raw_run["events"]
    requests = [event for event in events if event.get("kind") == "runtime_request"]
    responses = [event for event in events if event.get("kind") == "runtime_response"]
    failures = [event for event in events if event.get("kind") == "transport_failure"]
    terminals: dict[str, list[dict]] = {event["eventId"]: [] for event in requests}
    for event in [*responses, *failures]:
        request_id = event["payload"]["requestEventId"]
        require(request_id in terminals, f"terminal references unknown request: {request_id}")
        terminals[request_id].append(event)
    bad = {event_id: len(values) for event_id, values in terminals.items() if len(values) != 1}
    require(not bad, f"runtime requests without exactly one terminal: {bad}")
    require(len(requests) == 420, f"expected 420 runtime requests, got {len(requests)}")
    require(len(responses) == 403, f"expected 403 runtime responses, got {len(responses)}")
    require(len(failures) == 17, f"expected 17 transport failures, got {len(failures)}")
    require(
        all(event.get("contextId") == "ctx_runtime_transport" for event in [*requests, *responses, *failures]),
        "runtime transport event has an unexpected contextId",
    )
    require(
        all("/v1/knowledge/" in event["payload"]["url"] for event in requests),
        "runtime request outside the frozen /v1/knowledge/* scope",
    )
    runtime_log = (RUN_ROOT / "logs/runtime.log").read_text(encoding="utf-8")
    access_lines = [line for line in runtime_log.splitlines() if '"GET ' in line or '"POST ' in line]
    return {
        "evidenceLayer": "browser_runtime_transport_observation",
        "requests": len(requests),
        "responses": len(responses),
        "transportFailures": len(failures),
        "orphanOrMultiTerminal": len(bad),
        "runtimeStdoutAccessLines": len(access_lines),
        "runtimeStdoutRole": "process_lifecycle_diagnostic_only",
    }


def check_background_messages(raw_run: dict) -> dict:
    workspace_schema = load_json(
        REPO_ROOT / "docs/active/project/contracts/v2_external_brain_workspace_contracts.schema.json"
    )
    action_validator = validator_for_definition(workspace_schema, "OpenWorkspaceAction")
    result_validator = validator_for_definition(workspace_schema, "WorkspaceOpenResult")
    events = raw_run["events"]
    requests = [event for event in events if event.get("kind") == "background_request"]
    responses = [event for event in events if event.get("kind") == "background_response"]
    responses_by_request_event = {event["payload"]["requestEventId"]: event for event in responses}
    require(len(requests) == 6 and len(responses) == 6, "expected six Background request/response events")
    require(len(responses_by_request_event) == 6, "Background response requestEventId is not unique")

    origins = Counter()
    outcomes = Counter()
    for request in requests:
        message = request["payload"]["message"]
        action_validator.validate(message)
        require(request.get("actionId"), "Background request has no actionId")
        response = responses_by_request_event.get(request["eventId"])
        require(response is not None, f"Background request has no response: {request['eventId']}")
        result = response["payload"]["message"]
        result_validator.validate(result)
        require(result["requestId"] == message["requestId"], "Background requestId mismatch")
        require(response["scenarioId"] == request["scenarioId"], "Background scenarioId mismatch")
        require(response["actionId"] == request["actionId"], "Background actionId mismatch")
        require(response["sequence"] == request["sequence"] + 1, "Background response is not adjacent")

        parsed = urlparse(result["workspaceUrl"])
        route, _, fragment_query = parsed.fragment.partition("?")
        query = parse_qs(fragment_query)
        require(parsed.scheme == "chrome-extension", "Workspace result is not an extension URL")
        require(query.get("workspaceId") == [message["workspaceId"]], "workspaceId missing from result URL")
        if message["routeIntent"] == "source_library":
            require(route == "/knowledge/sources", "source_library resolved to the wrong path")
        elif message["routeIntent"] == "source_detail":
            require(route == f"/knowledge/sources/{message['sourceId']}", "source_detail sourceId mismatch")
        else:
            require(route == f"/knowledge/{message['routeIntent']}", "routeIntent resolved to the wrong path")
        origins[message["origin"]] += 1
        outcomes[result["outcome"]] += 1

    require(origins == Counter({"open_workspace": 2, "view_source": 2, "open_in_workspace": 2}), f"origin counts: {origins}")
    require(outcomes == Counter({"focused_existing": 5, "created_new": 1}), f"outcome counts: {outcomes}")
    return {
        "requests": len(requests),
        "responses": len(responses),
        "schemaErrors": 0,
        "pairingErrors": 0,
        "originCounts": dict(sorted(origins.items())),
        "outcomeCounts": dict(sorted(outcomes.items())),
    }


def main() -> int:
    require(RUN_ROOT.is_dir(), f"sealed run is missing: {RUN_ROOT}")
    raw_run = load_json(RUN_ROOT / "raw/raw-run.json")
    result = {
        "runId": raw_run["runId"],
        "readOnly": True,
        "t01": check_t01(),
        "runtimeTransport": check_runtime_transport(raw_run),
        "backgroundMessages": check_background_messages(raw_run),
        "fatal": 0,
        "major": 0,
        "minorOpen": 0,
        "passed": True,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"T02 independent-audit minor verification failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
