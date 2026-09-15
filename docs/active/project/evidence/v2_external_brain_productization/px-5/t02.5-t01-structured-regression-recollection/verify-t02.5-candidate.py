#!/usr/bin/env python3
"""Fail-closed verification for the T02.5 T01 structured-evidence candidate.

This verifier reads the sealed R2 run and recomputes the machine-verifiable
T02 through T02.4 acceptance facts plus the T02.5 T01 assertion evidence.
It deliberately does not grant organizational independence or PX-5 acceptance.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import struct
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from urllib.parse import parse_qs, urlparse


CURRENT_RUN_ID = ""
CURRENT_SNAPSHOT = ""
CURRENT_RAW_SHA256 = ""
CURRENT_SEAL_SHA256 = ""
OLD_RUN_ID = "t02-r2-durable-forget-production-input-20260912T165535"
OLD_RAW_SHA256 = "d0309d8bc946229fcef3862508648cef295cf3f124a758be9d3636b8e2eb107d"
OLD_SEAL_SHA256 = "50489670ce76462105bb923b8b90044f9e3075f225941af5103911208b560624"
OLD_BOUNDARY_RUN_ID = "t02-r2-status-contract-production-input-20260914T001017"
OLD_BOUNDARY_RAW_SHA256 = "7fd641697f508c9e9fb81ab2d3af8a1248b1df61e90c83346617f9b2596266a1"
OLD_BOUNDARY_SEAL_SHA256 = "430207668675497c9a9d5b22f8539ae66537c72a172ed35d18fafe8e28ba8270"
REQUIRED_ROUTES = {"source_library", "source_detail", "ask", "graph", "permissions"}
REQUIRED_MODES = {"direct_open", "reload", "back", "reopen"}
REQUIRED_FAULTS = {"runtime_offline", "adapter_blocked", "data_service_unreachable", "source_failed"}
CANONICAL_ROUTE_ERRORS = {"INVALID_ROUTE", "WORKSPACE_NOT_FOUND", "SOURCE_NOT_FOUND", "FORBIDDEN"}


def find_repo_root() -> Path:
    for candidate in [Path.cwd().resolve(), *Path(__file__).resolve().parents]:
        if (candidate / "docs/active/project").is_dir():
            return candidate
    raise FileNotFoundError("Navia repository root was not found")


REPO_ROOT = find_repo_root()
DEFAULT_STAGE_ROOT = (
    REPO_ROOT
    / "docs/active/project/evidence/v2_external_brain_productization/px-5"
    / "t02.5-t01-structured-regression-recollection"
)


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_sha256(value) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def scalar_values(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from scalar_values(child)
    elif isinstance(value, list):
        for child in value:
            yield from scalar_values(child)
    elif value is not None:
        yield value


def route_intent(url: str) -> str | None:
    if "/knowledge/sources/" in url:
        return "source_detail"
    if "/knowledge/sources" in url:
        return "source_library"
    if "/knowledge/ask" in url:
        return "ask"
    if "/knowledge/graph" in url:
        return "graph"
    if "/knowledge/settings/permissions" in url:
        return "permissions"
    return None


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError(f"not a decodable PNG header: {path}")
    return struct.unpack(">II", data[16:24])


def safe_relative_path(value: str) -> bool:
    try:
        pure = PurePosixPath(value.replace("\\", "/"))
    except (AttributeError, TypeError):
        return False
    return bool(value) and not pure.is_absolute() and ".." not in pure.parts and not re.match(r"^[A-Za-z]:/", value)


class Audit:
    def __init__(self):
        self.checks: list[dict] = []

    def check(self, check_id: str, passed: bool, requirement: str, observed) -> None:
        self.checks.append(
            {
                "id": check_id,
                "passed": bool(passed),
                "requirement": requirement,
                "observed": observed,
            }
        )

    @property
    def failures(self) -> list[dict]:
        return [item for item in self.checks if not item["passed"]]


def validate_schema(audit: Audit, run_root: Path, raw: dict) -> None:
    schema_path = run_root / raw["rawSchemaArtifact"]["path"]
    try:
        from jsonschema import Draft202012Validator

        schema = load(schema_path)
        Draft202012Validator.check_schema(schema)
        errors = sorted(Draft202012Validator(schema).iter_errors(raw), key=lambda error: list(error.path))
        audit.check("T02-A01-schema-meta", True, "Draft 2020-12 schema meta-validation", "PASS")
        audit.check(
            "T02-A01-schema-instance",
            not errors,
            "sealed raw run validates against its captured schema",
            [error.message for error in errors[:20]],
        )
    except Exception as exc:  # pragma: no cover - fail-closed environment handling
        audit.check("T02-A01-schema-meta", False, "Draft 2020-12 schema meta-validation", str(exc))
        audit.check("T02-A01-schema-instance", False, "sealed raw run validates against its captured schema", str(exc))


def validate_collector(audit: Audit, run_root: Path, raw: dict, public_package: bool) -> None:
    raw_path = run_root / "raw/raw-run.json"
    collector_path = run_root / raw["collectorImplementation"]["path"]
    script = """
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const [rawPath, collectorPath, runRoot, mode] = process.argv.slice(1);
const { validateRawRun } = await import(pathToFileURL(collectorPath).href);
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const options = mode === 'public' ? {} : { runRoot };
process.stdout.write(JSON.stringify(validateRawRun(raw, options)));
"""
    try:
        completed = subprocess.run(
            ["node", "--input-type=module", "-e", script, str(raw_path), str(collector_path), str(run_root), "public" if public_package else "local"],
            check=False,
            capture_output=True,
            text=True,
            timeout=120,
        )
        errors = json.loads(completed.stdout) if completed.returncode == 0 and completed.stdout else [completed.stderr.strip()]
        audit.check(
            "T02-A01-collector-invariants",
            completed.returncode == 0 and not errors,
            "captured collector validateRawRun returns no invariant errors",
            {"exitCode": completed.returncode, "errors": errors[:30]},
        )
    except Exception as exc:  # pragma: no cover - fail-closed environment handling
        audit.check("T02-A01-collector-invariants", False, "captured collector invariants", str(exc))


def validate_inputs(audit: Audit, run_root: Path, build_root: Path | None, raw: dict) -> None:
    snapshot = load(run_root / "input/snapshot-input-manifest.json")
    refs = {
        "buildIndex": raw["buildIndex"],
        "collectorImplementation": raw["collectorImplementation"],
        "rawSchemaArtifact": raw["rawSchemaArtifact"],
    }
    ref_results = {}
    for key, reference in refs.items():
        target = run_root / reference["path"]
        ref_results[key] = target.is_file() and sha256(target) == reference["sha256"] and snapshot[key] == reference
    audit.check(
        "T02-A02-captured-inputs",
        snapshot.get("snapshotCommit") == raw.get("snapshotCommit") == CURRENT_SNAPSHOT and all(ref_results.values()),
        "snapshot/build/collector/schema references bind captured bytes",
        {"snapshotCommit": snapshot.get("snapshotCommit"), "references": ref_results},
    )

    if build_root is None:
        audit.check("T02-A02-build-index", True, "build index recomputation", "NOT_RUN: no --build-root; independent archive must supply it")
        return
    build_index = load(run_root / raw["buildIndex"]["path"])
    expected = build_index.get("files", [])
    actual_files = sorted(path for path in build_root.rglob("*") if path.is_file()) if build_root.is_dir() else []
    errors = []
    for item in expected:
        target = build_root / item["path"]
        if not target.is_file():
            errors.append(f"missing:{item['path']}")
            continue
        mode = format(stat.S_IMODE(target.stat().st_mode), "o")
        if target.stat().st_size != item["byteLength"] or sha256(target) != item["sha256"] or mode != item["mode"]:
            errors.append(f"mismatch:{item['path']}")
    indexed = {item["path"] for item in expected}
    actual = {path.relative_to(build_root).as_posix() for path in actual_files}
    errors.extend(f"unindexed:{path}" for path in sorted(actual - indexed))
    audit.check(
        "T02-A02-build-index",
        len(expected) == 91 and not errors,
        "all fresh extension build files match path/mode/length/hash index",
        {"indexedFiles": len(expected), "actualFiles": len(actual), "errors": errors[:30]},
    )


def validate_artifacts(audit: Audit, run_root: Path, raw: dict, public_package: bool) -> dict[str, dict]:
    artifacts = raw.get("artifacts", [])
    artifact_index = load(run_root / "raw/artifact-index.json")
    duplicate_paths = [path for path, count in Counter(item.get("path") for item in artifacts).items() if count != 1]
    audit.check(
        "T02-A10-artifact-index",
        artifacts == artifact_index and not duplicate_paths,
        "raw artifacts equal the authoritative index and paths are unique",
        {"raw": len(artifacts), "index": len(artifact_index), "duplicatePaths": duplicate_paths[:20]},
    )
    by_path = {item["path"]: item for item in artifacts}
    errors = []
    public_count = 0
    private_count = 0
    public_bytes = 0
    for item in artifacts:
        path_value = item.get("path")
        visibility = item.get("visibility")
        if visibility == "public":
            public_count += 1
        elif visibility == "private_local_only":
            private_count += 1
        if not safe_relative_path(path_value):
            errors.append(f"unsafe:{path_value}")
            continue
        target = run_root / path_value
        if public_package and visibility == "private_local_only":
            if target.exists():
                errors.append(f"private-present:{path_value}")
            continue
        if not target.is_file():
            errors.append(f"missing:{path_value}")
            continue
        data = target.read_bytes()
        if visibility == "public":
            public_bytes += len(data)
        if len(data) != item.get("byteLength") or hashlib.sha256(data).hexdigest() != item.get("sha256"):
            errors.append(f"bytes-mismatch:{path_value}")
    audit.check(
        "T02-A10-artifact-bytes",
        not errors and public_count >= 947 and private_count == 6,
        "every allowed artifact path has matching length/hash and public/private classification without shrinking the accepted public baseline",
        {
            "public": public_count,
            "privateLocalOnly": private_count,
            "publicBytes": public_bytes,
            "mode": "public-package" if public_package else "local-complete-run",
            "errors": errors[:30],
        },
    )
    ref_errors = []
    for event in raw.get("events", []):
        for reference in event.get("artifactRefs", []):
            record = by_path.get(reference.get("path"))
            if not record or record.get("sha256") != reference.get("sha256"):
                ref_errors.append(f"{event.get('eventId')}:{reference}")
    audit.check(
        "T02-A10-artifact-references",
        not ref_errors,
        "all event artifact references resolve to the authoritative artifact index",
        ref_errors[:30],
    )
    return by_path


def validate_seal_and_old_run(audit: Audit, run_root: Path, old_run_root: Path, raw: dict) -> None:
    raw_path = run_root / "raw/raw-run.json"
    without_seal = {key: value for key, value in raw.items() if key != "seal"}
    seal = raw.get("seal", {})
    audit.check(
        "T02.1-A01-current-seal",
        raw.get("runId") == CURRENT_RUN_ID
        and raw.get("snapshotCommit") == CURRENT_SNAPSHOT
        and sha256(raw_path) == CURRENT_RAW_SHA256
        and seal.get("contentSha256") == CURRENT_SEAL_SHA256
        and canonical_sha256(without_seal) == CURRENT_SEAL_SHA256
        and seal.get("eventCount") == len(raw.get("events", []))
        and seal.get("artifactCount") == len(raw.get("artifacts", [])),
        "new run identity, raw bytes, canonical seal and counts are immutable",
        {
            "runId": raw.get("runId"),
            "snapshotCommit": raw.get("snapshotCommit"),
            "rawSha256": sha256(raw_path),
            "sealSha256": seal.get("contentSha256"),
            "recomputedSeal": canonical_sha256(without_seal),
            "events": len(raw.get("events", [])),
            "artifacts": len(raw.get("artifacts", [])),
        },
    )
    old_raw_path = old_run_root / "raw/raw-run.json"
    old = load(old_raw_path) if old_raw_path.is_file() else {}
    audit.check(
        "T02.1-A01-old-run-immutable",
        old_raw_path.is_file()
        and sha256(old_raw_path) == OLD_RAW_SHA256
        and old.get("runId") == OLD_RUN_ID
        and old.get("seal", {}).get("contentSha256") == OLD_SEAL_SHA256,
        "previous accepted T02 raw run remains byte-identical and separate",
        {
            "rawExists": old_raw_path.is_file(),
            "rawSha256": sha256(old_raw_path) if old_raw_path.is_file() else None,
            "sealSha256": old.get("seal", {}).get("contentSha256"),
        },
    )
    current_text = raw_path.read_text(encoding="utf-8")
    audit.check(
        "T02.1-A01-no-cross-run-reference",
        OLD_RUN_ID not in current_text and CURRENT_RUN_ID != OLD_RUN_ID,
        "new sealed raw run contains no old run identifier or cross-run merge",
        {"oldRunIdOccurrences": current_text.count(OLD_RUN_ID)},
    )


def validate_events(audit: Audit, run_root: Path, raw: dict) -> dict:
    events = raw.get("events", [])
    by_id = {event.get("eventId"): event for event in events}
    kinds = Counter(event.get("kind") for event in events)
    sequence_ok = [event.get("sequence") for event in events] == list(range(1, len(events) + 1))
    event_ids_ok = len(by_id) == len(events) and None not in by_id
    run_ids_ok = all(event.get("runId") == raw.get("runId") for event in events)
    audit.check(
        "T02-A03-event-order",
        sequence_ok and event_ids_ok and run_ids_ok,
        "events have unique IDs, current run ID and contiguous collector sequence",
        {"events": len(events), "eventKinds": dict(sorted(kinds.items()))},
    )

    segments = raw.get("segments", [])
    distinct = {
        "segmentId": len({item.get("segmentId") for item in segments}),
        "runtimeSessionId": len({item.get("runtimeSessionId") for item in segments}),
        "runtimePid": len({item.get("runtimePid") for item in segments}),
        "browserContextId": len({item.get("browserContextId") for item in segments}),
    }
    ranges = [(item.get("startedSequence"), item.get("endedSequence")) for item in segments]
    coverage_ok = len(segments) == 2 and ranges[0][0] == 1 and ranges[-1][1] == len(events)
    coverage_ok = coverage_ok and all(ranges[index][1] + 1 == ranges[index + 1][0] for index in range(len(ranges) - 1))
    audit.check(
        "T02-A03-segments",
        coverage_ok and all(value == 2 for value in distinct.values()),
        "two complete segments prove a distinct Runtime restart authority",
        {"ranges": ranges, "distinct": distinct},
    )

    terminal_by_request: dict[str, list[dict]] = defaultdict(list)
    for event in events:
        if event.get("kind") in {"background_response", "runtime_response", "transport_failure"}:
            terminal_by_request[event.get("payload", {}).get("requestEventId")].append(event)
    terminal_errors = []
    for request in (event for event in events if event.get("kind") in {"background_request", "runtime_request"}):
        allowed = {"background_response"} if request["kind"] == "background_request" else {"runtime_response", "transport_failure"}
        terminals = [item for item in terminal_by_request.get(request["eventId"], []) if item.get("kind") in allowed]
        if len(terminals) != 1:
            terminal_errors.append(f"{request['eventId']}:{len(terminals)}")
            continue
        terminal = terminals[0]
        if terminal.get("segmentId") != request.get("segmentId") or terminal.get("navigationId") != request.get("navigationId") or terminal.get("actionId") != request.get("actionId"):
            terminal_errors.append(f"linkage:{request['eventId']}")
        if request["kind"] == "background_request" and terminal.get("payload", {}).get("message", {}).get("requestId") != request.get("payload", {}).get("message", {}).get("requestId"):
            terminal_errors.append(f"requestId:{request['eventId']}")
    orphan_terminals = [key for key in terminal_by_request if key not in by_id]
    audit.check(
        "T02-A06-exact-one-terminal",
        not terminal_errors and not orphan_terminals,
        "every Background/Runtime request has exactly one linked terminal outcome",
        {
            "runtimeRequests": kinds.get("runtime_request", 0),
            "runtimeResponses": kinds.get("runtime_response", 0),
            "transportFailures": kinds.get("transport_failure", 0),
            "backgroundRequests": kinds.get("background_request", 0),
            "backgroundResponses": kinds.get("background_response", 0),
            "errors": terminal_errors[:30],
            "orphans": orphan_terminals[:30],
        },
    )

    origins = Counter()
    entry_errors = []
    for request in (event for event in events if event.get("kind") == "background_request"):
        message = request.get("payload", {}).get("message", {})
        origin = message.get("origin")
        origins[origin] += 1
        actions = [
            event
            for event in events
            if event.get("kind") == "dom_action"
            and event.get("actionId") == request.get("actionId")
            and event.get("sequence", 0) < request.get("sequence", 0)
            and event.get("payload", {}).get("isTrusted") is True
            and event.get("segmentId") == request.get("segmentId")
            and event.get("navigationId") == request.get("navigationId")
        ]
        terminals = terminal_by_request.get(request["eventId"], [])
        route_observed = any(
            event.get("kind") == "route_observation"
            and event.get("navigationId") == request.get("navigationId")
            and event.get("sequence", 0) > request.get("sequence", 0)
            for event in events
        )
        if len(actions) != 1 or len(terminals) != 1 or not route_observed:
            entry_errors.append(request["eventId"])
    entries_ok = origins.get("open_workspace", 0) >= 2 and origins.get("open_in_workspace", 0) >= 2 and origins.get("view_source", 0) >= 3
    audit.check(
        "T02.1-A03-trusted-entries",
        entries_ok and not entry_errors,
        "three production entry origins meet counts and trusted action/background/route chains",
        {"origins": dict(sorted(origins.items())), "invalidChains": entry_errors},
    )

    response_values: dict[str, set] = {}
    parsed_response_bodies: dict[str, object] = {}
    for event in events:
        if event.get("kind") != "runtime_response":
            continue
        reference = event.get("payload", {}).get("bodyArtifact", {})
        try:
            body = load(run_root / reference["path"])
            parsed_response_bodies[event["eventId"]] = body
            response_values[event["eventId"]] = set(scalar_values(body))
        except (OSError, KeyError, UnicodeDecodeError, json.JSONDecodeError):
            response_values[event["eventId"]] = set()

    authority_errors = []
    for observation in (event for event in events if event.get("kind") in {"route_observation", "container_observation"}):
        references = observation.get("payload", {}).get("authorityEventIds", [])
        ids = observation.get("payload", {}).get("ids", {})
        for reference in references:
            authority = by_id.get(reference)
            if (
                not authority
                or authority.get("kind") not in {"runtime_response", "transport_failure"}
                or authority.get("segmentId") != observation.get("segmentId")
                or authority.get("navigationId") != observation.get("navigationId")
                or authority.get("sequence", 0) >= observation.get("sequence", 0)
            ):
                authority_errors.append(f"bad-ref:{observation.get('eventId')}:{reference}")
        if ids.get("status") == "observed" and observation.get("scenarioId") != "scenario_runtime_restart":
            prior_values = set()
            for authority in events:
                if (
                    authority.get("kind") == "runtime_response"
                    and authority.get("segmentId") == observation.get("segmentId")
                    and authority.get("navigationId") == observation.get("navigationId")
                    and authority.get("sequence", 0) < observation.get("sequence", 0)
                ):
                    prior_values.update(response_values.get(authority["eventId"], set()))
            for key, value in ids.items():
                if key != "status" and value not in prior_values:
                    authority_errors.append(f"unproven-{key}:{observation.get('eventId')}:{value}")
    audit.check(
        "T02-A05-runtime-authority",
        not authority_errors,
        "route/container stable IDs are linked to prior same-navigation Runtime authority",
        authority_errors[:30],
    )

    route_modes: dict[str, set[str]] = defaultdict(set)
    route_errors: list[tuple[str, str]] = []
    recovery_scenarios = set()
    trusted_recovery_scenarios = set()
    for event in events:
        if event.get("kind") == "dom_action" and event.get("payload", {}).get("isTrusted") is True and event.get("payload", {}).get("target") == "button:返回来源库":
            trusted_recovery_scenarios.add(event.get("scenarioId"))
        if event.get("kind") != "route_observation":
            continue
        payload = event.get("payload", {})
        error_code = payload.get("errorCode")
        if error_code in CANONICAL_ROUTE_ERRORS:
            route_errors.append((event.get("scenarioId"), error_code))
        intent = route_intent(payload.get("url", ""))
        mode = payload.get("mode")
        if intent and mode:
            route_modes[intent].add(mode)
        if intent == "source_library" and mode == "recovery":
            recovery_scenarios.add(event.get("scenarioId"))
    complete_routes = sorted(route for route in REQUIRED_ROUTES if REQUIRED_MODES.issubset(route_modes.get(route, set())))
    audit.check(
        "T02.1-A05-route-matrix",
        set(complete_routes) == REQUIRED_ROUTES,
        "five canonical routes each have direct-open/reload/Back/reopen observations",
        {route: sorted(route_modes.get(route, set())) for route in sorted(REQUIRED_ROUTES)},
    )
    valid_recoveries = [
        code
        for scenario, code in route_errors
        if f"{scenario}_recovery" in recovery_scenarios and f"{scenario}_recovery" in trusted_recovery_scenarios
    ]
    audit.check(
        "T02.1-A06-route-recovery",
        len(valid_recoveries) >= 2 and len(set(valid_recoveries)) >= 2,
        "at least two canonical route errors have trusted recovery to Source Library",
        {"errors": route_errors, "pairedRecoveries": valid_recoveries},
    )

    return {
        "byId": by_id,
        "kinds": kinds,
        "responseBodies": parsed_response_bodies,
        "routeModes": route_modes,
        "origins": origins,
    }


def structured_commands(run_root: Path, raw: dict) -> dict[str, tuple[dict, dict]]:
    results = {}
    for event in raw.get("events", []):
        if event.get("kind") != "command_result":
            continue
        reference = event.get("payload", {}).get("structuredResult")
        if not isinstance(reference, dict):
            continue
        target = run_root / reference.get("path", "")
        if target.is_file() and sha256(target) == reference.get("sha256"):
            result = load(target)
            results[result.get("resultType")] = (event, result)
    return results


def validate_structured_results(audit: Audit, run_root: Path, raw: dict, event_facts: dict, public_package: bool) -> None:
    commands = structured_commands(run_root, raw)
    axe_event, axe = commands.get("axe", ({}, {}))
    keyboard_event, keyboard = commands.get("keyboard", ({}, {}))
    corpus_event, corpus = commands.get("source_corpus", ({}, {}))
    t01_event, t01 = commands.get("t01_real_chrome_regression", ({}, {}))
    axe_ok = (
        axe_event.get("payload", {}).get("exitCode") == 0
        and axe.get("engine") == "axe-core"
        and axe.get("serious") == 0
        and axe.get("critical") == 0
        and set(axe.get("surfaces", [])) == {"side_panel", "workspace_page"}
        and axe.get("violations") == []
    )
    audit.check(
        "T02.1-A07-axe",
        axe_ok,
        "real typed axe-core result covers both product surfaces with serious=0 and critical=0",
        axe,
    )
    keyboard_keys = ["traceOpenedByKeyboard", "escapePassed", "focusReturnPassed", "tabReachedInteractive", "reducedMotionPassed"]
    keyboard_ok = (
        keyboard_event.get("payload", {}).get("exitCode") == 0
        and keyboard.get("assertionsTotal") == 5
        and keyboard.get("assertionsPassed") == 5
        and all(keyboard.get(key) is True for key in keyboard_keys)
    )
    audit.check(
        "T02.1-A08-keyboard",
        keyboard_ok,
        "typed keyboard result has all five real interaction assertions passing",
        keyboard,
    )

    samples = corpus.get("samples", [])
    kinds = Counter(item.get("sourceKind") for item in samples)
    unique = {
        "sourceSampleId": len({item.get("sourceSampleId") for item in samples}),
        "sourceId": len({item.get("sourceId") for item in samples}),
        "operationId": len({item.get("operationId") for item in samples}),
        "contentFingerprint": len({item.get("contentFingerprint") for item in samples}),
    }
    body_values = set()
    source_types = {}
    for body in event_facts["responseBodies"].values():
        body_values.update(scalar_values(body))
        for candidate in walk(body):
            if candidate.get("sourceId") and candidate.get("sourceType") and candidate.get("workspaceId"):
                source_types[candidate["sourceId"]] = candidate["sourceType"]
    sample_errors = []
    artifacts_by_path = {artifact.get("path"): artifact for artifact in raw.get("artifacts", [])}
    for sample in samples:
        reference = sample.get("contentArtifact", {})
        target = run_root / reference.get("path", "")
        declared = artifacts_by_path.get(reference.get("path"))
        private_record_ok = bool(
            public_package
            and reference.get("path", "").startswith("private/")
            and declared
            and declared.get("visibility") == "private_local_only"
            and declared.get("sha256") == reference.get("sha256")
            and isinstance(declared.get("byteLength"), int)
            and declared.get("byteLength") > 0
        )
        bytes_ok = target.is_file() and sha256(target) == reference.get("sha256")
        if (not bytes_ok and not private_record_ok) or reference.get("sha256") != sample.get("contentFingerprint"):
            sample_errors.append(f"artifact:{sample.get('sourceSampleId')}")
        if sample.get("sourceId") not in source_types or sample.get("operationId") not in body_values:
            sample_errors.append(f"runtime:{sample.get('sourceSampleId')}")
        expected_type = {
            "real_web": "web_page",
            "explicit_local_document": "authorized_local_document",
            "note_markdown": "user_note",
        }.get(sample.get("sourceKind"))
        if sample.get("sourceType") != expected_type or source_types.get(sample.get("sourceId")) != expected_type:
            sample_errors.append(f"type:{sample.get('sourceSampleId')}")
    corpus_ok = (
        corpus_event.get("payload", {}).get("exitCode") == 0
        and corpus.get("runId") == raw.get("runId")
        and len(samples) == 12
        and kinds == Counter({"real_web": 6, "explicit_local_document": 3, "note_markdown": 3})
        and all(value == 12 for value in unique.values())
        and not sample_errors
    )
    audit.check(
        "T02.1-A04-source-corpus",
        corpus_ok,
        "single-run corpus is exactly 6 web + 3 explicit local + 3 note with unique bytes and Runtime IDs",
        {
            "samples": len(samples),
            "kinds": dict(sorted(kinds.items())),
            "unique": unique,
            "runtimeSourceTypes": dict(sorted(Counter(source_types.values()).items())),
            "errors": sample_errors,
        },
    )

    t01_assertions = t01.get("assertionResults", [])
    t01_ids = [item.get("assertionId") for item in t01_assertions]
    t01_reference = t01_event.get("payload", {}).get("structuredResult", {})
    t01_artifact_refs = t01_event.get("artifactRefs", [])
    t01_source_path = run_root / ".infra/t01-regression/raw/t01-real-chrome-run.json"
    source_hash_ok = (
        isinstance(t01.get("sourceSha256"), str)
        and bool(re.fullmatch(r"[a-f0-9]{64}", t01.get("sourceSha256", "")))
        and (public_package or (t01_source_path.is_file() and sha256(t01_source_path) == t01.get("sourceSha256")))
    )
    t01_ok = (
        t01_event.get("payload", {}).get("exitCode") == 0
        and t01.get("passed") is True
        and t01.get("assertionsTotal") == 36
        and t01.get("assertionsPassed") == 36
        and len(t01_assertions) == 36
        and len(set(t01_ids)) == 36
        and all(isinstance(item, dict) and item.get("passed") is True and isinstance(item.get("assertionId"), str) and item.get("assertionId") for item in t01_assertions)
        and t01_reference in t01_artifact_refs
        and t01_reference.get("path") == "artifacts/public/structured/t01_real_chrome_regression.json"
        and source_hash_ok
        and "detail" not in json.dumps(t01, ensure_ascii=False)
    )
    audit.check(
        "T02.5-A02-A04-t01-structured-evidence",
        t01_ok,
        "the sealed T01 artifact contains 36 unique passing IDs, binds its source bytes and omits private details",
        {
            "artifact": t01_reference,
            "sourceSha256": t01.get("sourceSha256"),
            "sourceHashRecomputed": None if public_package or not t01_source_path.is_file() else sha256(t01_source_path),
            "assertionsTotal": len(t01_assertions),
            "uniqueAssertionIds": len(set(t01_ids)),
            "assertionsPassed": sum(item.get("passed") is True for item in t01_assertions if isinstance(item, dict)),
            "containsDetailKey": "detail" in json.dumps(t01, ensure_ascii=False),
        },
    )


def validate_permission_forget_faults(audit: Audit, run_root: Path, raw: dict, event_facts: dict) -> None:
    events = raw.get("events", [])
    permission_scenarios = {
        event.get("scenarioId")
        for event in events
        if re.fullmatch(r"scenario_permission_[123]", event.get("scenarioId", ""))
    }
    permission_ok = len(permission_scenarios) == 3
    for scenario in permission_scenarios:
        requests = [event for event in events if event.get("scenarioId") == scenario and event.get("kind") == "runtime_request"]
        permission_ok = permission_ok and any("/v1/knowledge/permissions" in event.get("payload", {}).get("url", "") for event in requests)
    audit.check(
        "T02.1-A09-permission",
        permission_ok,
        "three independent Permission scenarios include real Runtime operations",
        sorted(permission_scenarios),
    )

    forget_errors = []
    for number in (1, 2, 3):
        base = f"scenario_forget_{number}"
        forget_requests = [
            event
            for event in events
            if event.get("scenarioId") == base
            and event.get("kind") == "runtime_request"
            and event.get("payload", {}).get("url", "").endswith("/forget")
        ]
        if len(forget_requests) != 1:
            forget_errors.append(f"{base}:forget-request-count={len(forget_requests)}")
            continue
        source_id = forget_requests[0]["payload"]["url"].split("/sources/")[1].split("/forget")[0]
        terminals = [
            event
            for event in events
            if event.get("kind") == "runtime_response"
            and event.get("payload", {}).get("requestEventId") == forget_requests[0]["eventId"]
        ]
        if len(terminals) != 1:
            forget_errors.append(f"{base}:terminal")
            continue
        forget_body = event_facts["responseBodies"].get(terminals[0]["eventId"], {})
        verification = next((item.get("verification") for item in walk(forget_body) if isinstance(item.get("verification"), dict)), None)
        if not verification or verification.get("sourceId") != source_id or not all(verification.get(key) is True for key in ["libraryAbsent", "askAbsent", "graphAbsent", "traceAbsent"]):
            forget_errors.append(f"{base}:four-surface")
        authorities = set()
        for mode in REQUIRED_MODES:
            scenario = f"{base}_{mode if mode != 'direct_open' else 'direct_open'}"
            observations = [event for event in events if event.get("scenarioId") == scenario and event.get("kind") == "route_observation"]
            triggers = [event for event in observations if event.get("payload", {}).get("mode") == mode]
            recoveries = [event for event in observations if event.get("payload", {}).get("mode") == "recovery"]
            if (
                len(triggers) != 1
                or triggers[0].get("payload", {}).get("ids", {}).get("sourceId") != source_id
                or triggers[0].get("payload", {}).get("errorCode") != "SOURCE_NOT_FOUND"
                or len(recoveries) != 1
                or recoveries[0].get("payload", {}).get("ids", {}).get("sourceId") is not None
                or triggers[0].get("navigationId") != recoveries[0].get("navigationId")
                or triggers[0].get("sequence", 0) >= recoveries[0].get("sequence", 0)
            ):
                forget_errors.append(f"{base}:{mode}:trigger-recovery-route")
                continue
            refs = triggers[0].get("payload", {}).get("authorityEventIds", [])
            authorities.update(refs)
            bodies = [event_facts["responseBodies"].get(reference, {}) for reference in refs]
            if not any(
                any(candidate.get("sourceId") == source_id and candidate.get("status") == "forgotten" for candidate in walk(body))
                for body in bodies
            ):
                forget_errors.append(f"{base}:{mode}:not-forgotten")
        if len(authorities) != 4:
            forget_errors.append(f"{base}:authority-count={len(authorities)}")
    audit.check(
        "T02.1-A09-durable-forget",
        not forget_errors,
        "three Forget mutations have four-surface verification plus four same-source SOURCE_NOT_FOUND and recovery chains",
        forget_errors,
    )

    fault_intervals = []
    fault_errors = []
    fault_types = set()
    for segment in raw.get("segments", []):
        for fault in segment.get("faultInjections", []):
            fault_types.add(fault.get("faultType"))
            fault_intervals.append((fault.get("startSequence"), fault.get("endSequence"), fault.get("faultType")))
            start = events[fault["startSequence"] - 1]
            end = events[fault["endSequence"] - 1]
            if start.get("kind") != "fault_start" or end.get("kind") != "fault_end" or start.get("payload", {}).get("faultType") != fault.get("faultType") or end.get("payload", {}).get("faultType") != fault.get("faultType"):
                fault_errors.append(f"events:{fault.get('faultType')}")
            if not any(event.get("kind") == "screenshot" and fault["startSequence"] < event.get("sequence", 0) < fault["endSequence"] for event in events):
                fault_errors.append(f"screenshot:{fault.get('faultType')}")
    ordered = sorted(fault_intervals)
    nonoverlap = all(ordered[index][1] < ordered[index + 1][0] for index in range(len(ordered) - 1))
    audit.check(
        "T02.1-A09-faults",
        fault_types == REQUIRED_FAULTS and len(fault_intervals) == 4 and nonoverlap and not fault_errors,
        "four controlled fault intervals are non-overlapping and contain observed screenshots",
        {"intervals": ordered, "errors": fault_errors},
    )


def validate_screenshots(audit: Audit, run_root: Path, raw: dict, event_facts: dict) -> None:
    errors = []
    product_pairs = set()
    by_id = event_facts["byId"]
    screenshot_events = [event for event in raw.get("events", []) if event.get("kind") == "screenshot"]
    for event in screenshot_events:
        payload = event.get("payload", {})
        image_ref = payload.get("imageArtifact", {})
        metadata_ref = payload.get("metadataArtifact", {})
        image_path = run_root / image_ref.get("path", "")
        metadata_path = run_root / metadata_ref.get("path", "")
        try:
            metadata = load(metadata_path)
            decoded = png_size(image_path)
        except Exception as exc:
            errors.append(f"decode:{event.get('eventId')}:{exc}")
            continue
        if sha256(image_path) != image_ref.get("sha256") or sha256(metadata_path) != metadata_ref.get("sha256"):
            errors.append(f"hash:{event.get('eventId')}")
        if metadata.get("imagePath") != image_ref.get("path") or metadata.get("imageSha256") != image_ref.get("sha256") or decoded != (metadata.get("decodedWidth"), metadata.get("decodedHeight")):
            errors.append(f"metadata:{event.get('eventId')}")
        refs = [by_id.get(reference) for reference in payload.get("observationEventIds", [])]
        if not any(item and item.get("kind") == "route_observation" for item in refs) or not any(item and item.get("kind") == "container_observation" for item in refs):
            errors.append(f"observation:{event.get('eventId')}")
        viewport = metadata.get("panelViewport") or metadata.get("viewport")
        width = viewport.get("width") if isinstance(viewport, dict) else None
        if width in {360, 420}:
            if payload.get("surface") != "side_panel" or metadata.get("captureSurface") != "native_side_panel_with_host":
                errors.append(f"surface:{width}")
            product_pairs.add(("side_panel", width))
        elif width in {768, 1280}:
            if payload.get("surface") != "workspace_page" or metadata.get("surface") != "workspace_page" or decoded != (width, viewport.get("height")):
                errors.append(f"surface:{width}")
            product_pairs.add(("workspace_page", width))
    required = {("side_panel", 360), ("side_panel", 420), ("workspace_page", 768), ("workspace_page", 1280)}
    audit.check(
        "T02.1-A09-screenshots",
        len(screenshot_events) == 10 and required.issubset(product_pairs) and not errors,
        "all screenshots have real PNG/hash/metadata/observation linkage and four product viewport mappings",
        {"screenshots": len(screenshot_events), "productPairs": sorted(product_pairs), "errors": errors[:30]},
    )


def validate_security_cleanup_commands(audit: Audit, run_root: Path, raw: dict, public_package: bool) -> None:
    high_risk_patterns = {
        "bearer": re.compile(rb"Bearer\s+[A-Za-z0-9._-]{20,}"),
        "jwt": re.compile(rb"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
        "windows-user-path": re.compile(rb"[A-Za-z]:\\\\Users\\\\[^\\\\\r\n]+"),
        "wsl-user-path": re.compile(rb"/mnt/[a-z]/Users/[^/\r\n]+"),
        "home-user-path": re.compile(rb"/home/[A-Za-z0-9._-]+/"),
    }
    hits = []
    public_files = 0
    for artifact in raw.get("artifacts", []):
        if artifact.get("visibility") != "public":
            continue
        target = run_root / artifact["path"]
        if not target.is_file():
            continue
        public_files += 1
        data = target.read_bytes()
        for name, pattern in high_risk_patterns.items():
            if pattern.search(data):
                hits.append({"path": artifact["path"], "pattern": name})
    private_paths = [artifact["path"] for artifact in raw.get("artifacts", []) if artifact.get("visibility") == "private_local_only"]
    private_state_ok = all(not (run_root / path).exists() for path in private_paths) if public_package else all((run_root / path).is_file() for path in private_paths)
    audit.check(
        "T02-A10-public-private",
        not hits and private_state_ok,
        "public bytes contain no credential/private-user-path shapes and private bytes follow package mode",
        {"scannedPublicFiles": public_files, "hits": hits, "privatePaths": len(private_paths), "mode": "public-package" if public_package else "local"},
    )

    cleanup = load(run_root / "cleanup-manifest.json")
    cleanup_ok = cleanup.get("runId") == raw.get("runId") and cleanup.get("passed") is True and all(cleanup.get(key) is True for key in ["browserClosed", "runtimeStopped", "fixtureServerClosed", "profileRemoved"])
    audit.check("T02-A10-cleanup", cleanup_ok, "browser/runtime/fixture server/profile cleanup is complete", cleanup)

    command_events = [event for event in raw.get("events", []) if event.get("kind") == "command_result"]
    command_map = {event.get("payload", {}).get("command"): event for event in command_events}
    required_commands = {
        "pnpm build:e2e",
        "pnpm typecheck",
        "pnpm test:v2-px-r2-raw-collector",
        "pnpm test",
        "python3 -m pytest -q",
        "node e2e/chrome-v2-t01-r1-frontend.mjs",
        "axe-core:side-panel+workspace",
        "playwright:keyboard-accessibility",
        "r2:register-source-corpus",
    }
    commands_ok = set(command_map) == required_commands and all(event.get("payload", {}).get("exitCode") == 0 for event in command_events)
    audit.check(
        "T02-A12-command-results",
        commands_ok,
        "all six prerequisites and three structured real-browser commands terminated with exitCode=0",
        {command: command_map.get(command, {}).get("payload", {}).get("exitCode") for command in sorted(required_commands)},
    )

    logs = {
        "collector": (run_root / "logs/prerequisites/raw_collector_tests.stdout.log").read_text(encoding="utf-8", errors="replace"),
        "frontend": (run_root / "logs/prerequisites/frontend_full_tests.stdout.log").read_text(encoding="utf-8", errors="replace"),
        "runtime": (run_root / "logs/prerequisites/runtime_full_tests.stdout.log").read_text(encoding="utf-8", errors="replace"),
    }
    counts_ok = "# pass 17" in logs["collector"] and "Tests  169 passed (169)" in logs["frontend"] and "307 passed" in logs["runtime"]
    t01_path = run_root / ".infra/t01-regression/raw/t01-real-chrome-run.json"
    t01 = load(t01_path) if t01_path.is_file() else {}
    t01_checks = t01.get("checks", [])
    t01_ids = [item.get("id") for item in t01_checks]
    t01_ok = t01.get("passed") is True and len(t01_checks) == 36 and len(set(t01_ids)) == 36 and all(item.get("passed") is True for item in t01_checks)
    audit.check(
        "T02-A12-test-counts",
        counts_ok and t01_ok,
        "collector 17, frontend 169, Runtime 307 and T01 real Chrome 36 unique assertions all pass",
        {
            "collector17": "# pass 17" in logs["collector"],
            "frontend169": "Tests  169 passed (169)" in logs["frontend"],
            "runtime307": "307 passed" in logs["runtime"],
            "t01RawPresent": t01_path.is_file(),
            "t01Checks": len(t01_checks),
            "t01UniqueAssertionIds": len(set(t01_ids)),
            "t01Passed": t01.get("passed"),
        },
    )

    diagnostic = load(run_root / "raw/collection-diagnostic.json")
    diagnostic_ok = diagnostic.get("passed") is True and diagnostic.get("runId") == raw.get("runId") and diagnostic.get("missingObservations") == [] and diagnostic.get("sealedRawRun", {}).get("sha256") == CURRENT_RAW_SHA256
    audit.check("T02-A11-collection-diagnostic", diagnostic_ok, "post-seal collection diagnostic is empty and binds the raw bytes", diagnostic)


def validate_t03_readiness(audit: Audit, run_root: Path, checker_path: Path, public_package: bool) -> dict:
    try:
        command = [sys.executable, str(checker_path), "--run-root", str(run_root)]
        if public_package:
            command.append("--public-package")
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=120,
        )
        result = json.loads(completed.stdout)
        passed = completed.returncode == 0 and result.get("major") == 0 and result.get("fatal") == 0 and result.get("readyForPositiveProductionValidation") is True
        audit.check(
            "T02.2-A09-t03-input-readiness",
            passed,
            "independent T03 input checker exits 0 with no Fatal/Major gaps",
            {"exitCode": completed.returncode, "result": result},
        )
        durable = result.get("observed", {}).get("durableForgetRecovery", {})
        audit.check(
            "T02.2-A04-A07-durable-forget-recovery",
            durable.get("passed") is True
            and durable.get("triggerCount") == 12
            and durable.get("recoveryCount") == 12
            and durable.get("errors") == [],
            "three sources by four navigation modes have observed SOURCE_NOT_FOUND and trusted Source Library recovery",
            durable,
        )
        return result
    except Exception as exc:  # pragma: no cover - fail-closed environment handling
        audit.check("T02.2-A09-t03-input-readiness", False, "T03 input checker", str(exc))
        audit.check("T02.2-A04-A07-durable-forget-recovery", False, "durable Forget recovery evidence", str(exc))
        return {}


def recompute_status_contract(run_root: Path) -> dict:
    from jsonschema import Draft202012Validator, FormatChecker

    raw = load(run_root / "raw/raw-run.json")
    events = raw.get("events", [])
    by_id = {event.get("eventId"): event for event in events}
    by_path = {item.get("path"): item for item in raw.get("artifacts", [])}
    values = []
    identities = []
    errors = []
    for response in events:
        if response.get("kind") != "runtime_response" or not 200 <= response.get("payload", {}).get("status", 0) < 300:
            continue
        request = by_id.get(response.get("payload", {}).get("requestEventId"))
        if request is None or urlparse(request.get("payload", {}).get("url", "")).path != "/v1/knowledge/status":
            continue
        reference = response.get("payload", {}).get("bodyArtifact", {})
        artifact = by_path.get(reference.get("path"))
        target = run_root / reference.get("path", "")
        identity = {
            "scenarioId": response.get("scenarioId"),
            "requestEventId": request.get("eventId"),
            "responseEventId": response.get("eventId"),
        }
        if artifact is None or not target.is_file() or artifact.get("sha256") != reference.get("sha256"):
            errors.append({**identity, "path": reference.get("path"), "message": "status artifact missing or unindexed"})
            continue
        payload = target.read_bytes()
        if len(payload) != artifact.get("byteLength") or hashlib.sha256(payload).hexdigest() != artifact.get("sha256"):
            errors.append({**identity, "path": reference.get("path"), "message": "status artifact bytes mismatch"})
            continue
        try:
            envelope = json.loads(payload)
        except Exception as exc:
            errors.append({**identity, "path": "", "message": f"invalid JSON: {exc}"})
            continue
        if envelope.get("ok") is not True or not isinstance(envelope.get("data"), dict):
            errors.append({**identity, "path": "", "message": "invalid status envelope"})
            continue
        values.append(envelope["data"])
        identities.append(identity)

    schema = load(REPO_ROOT / "docs/active/project/contracts/v2_knowledge_status.schema.json")
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    for index, value in enumerate(values):
        for error in validator.iter_errors(value):
            errors.append({
                **identities[index],
                "path": "/".join(str(item) for item in error.absolute_path),
                "message": error.message,
            })
    return {"checked": len(values), "errors": errors, "values": values}


def validate_status_contract(audit: Audit, run_root: Path, old_run_root: Path, raw: dict) -> dict:
    result_path = run_root / "artifacts/public/validation/knowledge-status-contract.json"
    recorded = load(result_path) if result_path.is_file() else {}
    expected_faults = {
        "scenario_fault_adapter_blocked": ("adapterStatus", "blocked", "configure_adapter"),
        "scenario_fault_data_service_unreachable": ("dataServiceStatus", "unreachable", "reconnect"),
        "scenario_fault_source_failed": ("sourceBuildStatus", "failed", "retry_source_build"),
    }
    action_errors = []
    current_with_identity = recompute_status_contract(run_root)
    raw_events = raw.get("events", [])
    event_by_id = {event.get("eventId"): event for event in raw_events}
    scenario_actions = defaultdict(list)
    for response in raw_events:
        request = event_by_id.get(response.get("payload", {}).get("requestEventId")) if response.get("kind") == "runtime_response" else None
        if request and urlparse(request.get("payload", {}).get("url", "")).path == "/v1/knowledge/status" and 200 <= response.get("payload", {}).get("status", 0) < 300:
            artifact = response.get("payload", {}).get("bodyArtifact", {})
            target = run_root / artifact.get("path", "")
            if target.is_file():
                try:
                    data = json.loads(target.read_bytes()).get("data", {})
                    scenario_id = response.get("scenarioId")
                    fault = expected_faults.get(scenario_id)
                    if fault and data.get(fault[0]) == fault[1]:
                        scenario_actions[scenario_id].append(data.get("userAction"))
                except Exception:
                    pass
    for scenario_id, (_, _, expected) in expected_faults.items():
        observed = scenario_actions.get(scenario_id, [])
        if not observed or any(action != expected for action in observed):
            action_errors.append({"scenarioId": scenario_id, "expected": expected, "observed": observed})
    audit.check(
        "T02.3-A03-A05-current-status-contract",
        current_with_identity["checked"] > 0
        and current_with_identity["errors"] == []
        and recorded.get("checked") == current_with_identity["checked"]
        and recorded.get("errors") == []
        and action_errors == [],
        "all successful raw Status responses validate before seal and controlled faults use canonical actions",
        {"checked": current_with_identity["checked"], "errors": current_with_identity["errors"], "recorded": recorded, "actionErrors": action_errors},
    )

    old = recompute_status_contract(old_run_root)
    old_scenarios = Counter(error.get("scenarioId") for error in old["errors"])
    old_ok = (
        old["checked"] == 178
        and len(old["errors"]) == 7
        and old_scenarios == Counter({
            "scenario_fault_adapter_blocked": 2,
            "scenario_fault_data_service_unreachable": 3,
            "scenario_fault_source_failed": 2,
        })
        and all(error.get("path") == "userAction" and "'retry' is not one of" in error.get("message", "") for error in old["errors"])
    )
    audit.check(
        "T02.3-A06-old-status-fail-closed",
        old_ok,
        "old T02.2 raw remains invalid only for seven generic retry actions",
        {"checked": old["checked"], "errorCount": len(old["errors"]), "scenarios": dict(old_scenarios), "errors": old["errors"]},
    )
    return {"current": {"checked": current_with_identity["checked"], "errors": current_with_identity["errors"]}, "old": {"checked": old["checked"], "errors": old["errors"]}}


def recompute_runtime_offline_authority(raw: dict) -> dict:
    events = raw.get("events", [])
    terminals = defaultdict(list)
    for event in events:
        if event.get("kind") in {"runtime_response", "transport_failure"}:
            terminals[event.get("payload", {}).get("requestEventId")].append(event)
    starts = []
    intervals = []
    for event in events:
        if event.get("kind") == "fault_start" and event.get("payload", {}).get("faultType") == "runtime_offline":
            starts.append(event)
        elif event.get("kind") == "fault_end" and event.get("payload", {}).get("faultType") == "runtime_offline" and starts:
            intervals.append((starts.pop(0), event))
    errors = []
    checked = 0
    for start, end in intervals:
        requests = [
            event for event in events
            if event.get("kind") == "runtime_request" and start["sequence"] <= event.get("sequence", 0) <= end["sequence"]
        ]
        if not requests:
            errors.append({"code": "RUNTIME_OFFLINE_REQUEST_MISSING", "startSequence": start["sequence"], "endSequence": end["sequence"]})
        checked += len(requests)
        for request in requests:
            outcomes = terminals.get(request.get("eventId"), [])
            responses = [event for event in outcomes if event.get("kind") == "runtime_response"]
            failures = [event for event in outcomes if event.get("kind") == "transport_failure"]
            if responses:
                errors.append({
                    "code": "RUNTIME_OFFLINE_RESPONSE_OBSERVED",
                    "requestSequence": request["sequence"],
                    "responseSequences": [event["sequence"] for event in responses],
                })
            if len(outcomes) != 1 or len(failures) != 1:
                errors.append({
                    "code": "RUNTIME_OFFLINE_TERMINAL_INVALID",
                    "requestSequence": request["sequence"],
                    "responseCount": len(responses),
                    "transportFailureCount": len(failures),
                })
    return {
        "intervalsChecked": len(intervals),
        "requestsChecked": checked,
        "errors": errors,
        "bounds": [[start["sequence"], end["sequence"]] for start, end in intervals],
    }


def validate_runtime_offline_boundary(audit: Audit, run_root: Path, old_boundary_run_root: Path, raw: dict) -> dict:
    current = recompute_runtime_offline_authority(raw)
    recorded_path = run_root / "artifacts/public/validation/runtime-offline-authority.json"
    recorded = load(recorded_path) if recorded_path.is_file() else {}
    current_ok = (
        current["intervalsChecked"] == 1
        and current["requestsChecked"] > 0
        and current["errors"] == []
        and recorded.get("intervalsChecked") == current["intervalsChecked"]
        and recorded.get("requestsChecked") == current["requestsChecked"]
        and recorded.get("errors") == []
    )
    audit.check(
        "T02.4-A03-A05-runtime-offline-boundary",
        current_ok,
        "the sealed offline interval has requests, zero Runtime responses and exactly one transport failure per request",
        {"recomputed": current, "recorded": recorded},
    )

    old_path = old_boundary_run_root / "raw/raw-run.json"
    old = load(old_path) if old_path.is_file() else {}
    old_result = recompute_runtime_offline_authority(old) if old else {}
    response_errors = [error for error in old_result.get("errors", []) if error.get("code") == "RUNTIME_OFFLINE_RESPONSE_OBSERVED"]
    old_ok = (
        old_path.is_file()
        and sha256(old_path) == OLD_BOUNDARY_RAW_SHA256
        and old.get("runId") == OLD_BOUNDARY_RUN_ID
        and old.get("seal", {}).get("contentSha256") == OLD_BOUNDARY_SEAL_SHA256
        and old_result.get("bounds") == [[1330, 1370]]
        and old_result.get("requestsChecked") == 18
        and response_errors == [{"code": "RUNTIME_OFFLINE_RESPONSE_OBSERVED", "requestSequence": 1331, "responseSequences": [1332]}]
    )
    audit.check(
        "T02.4-A02-A06-old-t02.3-fail-closed",
        old_ok,
        "the immutable T02.3 run is rejected for its exact request 1331 and response 1332 offline-boundary violation",
        {"rawSha256": sha256(old_path) if old_path.is_file() else None, "recomputed": old_result},
    )
    return {"current": current, "oldT02_3": old_result}


def main() -> int:
    global CURRENT_RUN_ID, CURRENT_SNAPSHOT, CURRENT_RAW_SHA256, CURRENT_SEAL_SHA256

    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--old-run-root", type=Path, required=True)
    parser.add_argument("--old-boundary-run-root", type=Path, required=True)
    parser.add_argument("--build-root", type=Path, required=True)
    parser.add_argument("--expected-run-id", required=True)
    parser.add_argument("--expected-snapshot", required=True)
    parser.add_argument("--expected-raw-sha256", required=True)
    parser.add_argument("--expected-seal-sha256", required=True)
    parser.add_argument("--checker", type=Path, default=DEFAULT_STAGE_ROOT.parent / "t03-r3-semantic-reporting/audit-t03-input-readiness.py")
    parser.add_argument("--public-package", action="store_true", help="Private local artifacts must be absent; collector skips on-disk private-byte checks.")
    args = parser.parse_args()

    CURRENT_RUN_ID = args.expected_run_id
    CURRENT_SNAPSHOT = args.expected_snapshot
    CURRENT_RAW_SHA256 = args.expected_raw_sha256
    CURRENT_SEAL_SHA256 = args.expected_seal_sha256

    run_root = args.run_root.resolve()
    old_run_root = args.old_run_root.resolve()
    old_boundary_run_root = args.old_boundary_run_root.resolve()
    build_root = args.build_root.resolve() if args.build_root else None
    checker_path = args.checker.resolve()
    raw = load(run_root / "raw/raw-run.json")
    audit = Audit()

    validate_schema(audit, run_root, raw)
    validate_collector(audit, run_root, raw, args.public_package)
    validate_inputs(audit, run_root, build_root, raw)
    validate_artifacts(audit, run_root, raw, args.public_package)
    validate_seal_and_old_run(audit, run_root, old_run_root, raw)
    event_facts = validate_events(audit, run_root, raw)
    validate_structured_results(audit, run_root, raw, event_facts, args.public_package)
    validate_permission_forget_faults(audit, run_root, raw, event_facts)
    validate_screenshots(audit, run_root, raw, event_facts)
    validate_security_cleanup_commands(audit, run_root, raw, args.public_package)
    readiness = validate_t03_readiness(audit, run_root, checker_path, args.public_package)
    status_contract = validate_status_contract(audit, run_root, old_run_root, raw)
    offline_authority = validate_runtime_offline_boundary(audit, run_root, old_boundary_run_root, raw)

    failures = audit.failures
    result = {
        "schemaVersion": "v2-px-t02.5-candidate-verification/v1",
        "runId": raw.get("runId"),
        "snapshotCommit": raw.get("snapshotCommit"),
        "rawSha256": sha256(run_root / "raw/raw-run.json"),
        "sealSha256": raw.get("seal", {}).get("contentSha256"),
        "mode": "public_package" if args.public_package else "local_complete_run",
        "machineChecks": len(audit.checks),
        "machinePassed": len(audit.checks) - len(failures),
        "machineFailed": len(failures),
        "checks": audit.checks,
        "t03InputReadiness": readiness,
        "knowledgeStatusContract": status_contract,
        "runtimeOfflineAuthority": offline_authority,
        "fatal": 0,
        "major": len(failures),
        "localCandidatePassed": not failures,
        "reviewMode": "SELF_AUDIT_USER_AUTHORIZED",
        "t02_5Status": "SELF_AUDIT_PASS" if not failures else "FAIL_REPLAN",
        "t03Implementation": "NO_GO",
        "px5": "FAIL_REOPENED",
        "claimBoundary": "A self-audit pass qualifies only this T02.5 production input; it is not T03, PX-5, PX-6 or V2 acceptance.",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not failures else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"T02.5 candidate verification failed unexpectedly: {exc}", file=sys.stderr)
        raise SystemExit(3)
