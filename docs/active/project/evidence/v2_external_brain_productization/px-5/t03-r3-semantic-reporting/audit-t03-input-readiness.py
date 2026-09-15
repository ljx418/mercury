#!/usr/bin/env python3
"""Read-only audit of whether the accepted T02 run can be a positive T03 production base."""

from __future__ import annotations

import json
import argparse
import hashlib
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import parse_qs, urlparse


def find_repo_root() -> Path:
    for candidate in [Path.cwd().resolve(), *Path(__file__).resolve().parents]:
        if (candidate / "docs/active/project").is_dir():
            return candidate
    raise FileNotFoundError("Navia repository root was not found")


REPO_ROOT = find_repo_root()
DEFAULT_T02 = (
    REPO_ROOT
    / "docs/active/project/evidence/v2_external_brain_productization/px-5/t02-r2-raw-evidence/runs/t02-r2-raw-20260911T143100"
)


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def artifact_matches(run_root: Path, reference: dict | None) -> bool:
    if not isinstance(reference, dict):
        return False
    try:
        path = run_root / reference["path"]
        return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == reference["sha256"]
    except (KeyError, OSError, TypeError):
        return False


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def source_library_workspace_id(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.scheme != "chrome-extension" or not parsed.fragment.startswith("/knowledge/sources?"):
        return None
    if parsed.fragment.startswith("/knowledge/sources/"):
        return None
    values = parse_qs(parsed.fragment.split("?", 1)[1]).get("workspaceId", [])
    return values[0] if len(values) == 1 and values[0] else None


def validate_durable_forget(run_root: Path, events: list[dict], response_bodies: dict[str, dict]) -> dict:
    errors = []
    trigger_count = 0
    recovery_count = 0
    modes = ("direct_open", "reload", "back", "reopen")
    for number in (1, 2, 3):
        base = f"scenario_forget_{number}"
        forget_requests = [
            event for event in events
            if event.get("scenarioId") == base
            and event.get("kind") == "runtime_request"
            and event.get("payload", {}).get("url", "").endswith("/forget")
        ]
        if len(forget_requests) != 1:
            errors.append(f"{base}:forget-request-count={len(forget_requests)}")
            continue
        source_id = forget_requests[0]["payload"]["url"].split("/sources/", 1)[1].split("/forget", 1)[0]
        expected_workspace_id = None
        for mode in modes:
            scenario_id = f"{base}_{mode}"
            scenario_events = [event for event in events if event.get("scenarioId") == scenario_id]
            routes = [event for event in scenario_events if event.get("kind") == "route_observation"]
            triggers = [event for event in routes if event.get("payload", {}).get("mode") == mode]
            recoveries = [event for event in routes if event.get("payload", {}).get("mode") == "recovery"]
            if len(triggers) != 1:
                errors.append(f"{scenario_id}:trigger-count={len(triggers)}")
                continue
            trigger = triggers[0]
            trigger_count += 1
            trigger_payload = trigger["payload"]
            trigger_ids = trigger_payload.get("ids", {})
            workspace_id = trigger_ids.get("workspaceId")
            if expected_workspace_id is None:
                expected_workspace_id = workspace_id
            if trigger_payload.get("errorCode") != "SOURCE_NOT_FOUND":
                errors.append(f"{scenario_id}:errorCode={trigger_payload.get('errorCode')}")
            if trigger_ids.get("sourceId") != source_id or workspace_id != expected_workspace_id:
                errors.append(f"{scenario_id}:trigger-identity")
            trigger_refs = trigger_payload.get("authorityEventIds", [])
            trigger_bodies = [response_bodies.get(reference, {}) for reference in trigger_refs]
            if len(trigger_refs) != 1 or not any(
                any(
                    candidate.get("sourceId") == source_id
                    and candidate.get("workspaceId") == workspace_id
                    and candidate.get("status") == "forgotten"
                    for candidate in walk(body)
                )
                for body in trigger_bodies
            ):
                errors.append(f"{scenario_id}:forgotten-authority")

            if len(recoveries) != 1:
                errors.append(f"{scenario_id}:recovery-count={len(recoveries)}")
                continue
            recovery = recoveries[0]
            recovery_count += 1
            recovery_payload = recovery["payload"]
            recovery_ids = recovery_payload.get("ids", {})
            recovered_workspace_id = source_library_workspace_id(recovery_payload.get("url", ""))
            if (
                recovered_workspace_id != workspace_id
                or recovery_ids.get("workspaceId") != workspace_id
                or "sourceId" in recovery_ids
            ):
                errors.append(f"{scenario_id}:recovery-route-or-identity")
            if trigger.get("navigationId") != recovery.get("navigationId") or trigger.get("sequence", 0) >= recovery.get("sequence", 0):
                errors.append(f"{scenario_id}:recovery-order-or-navigation")
            actions = [
                event for event in scenario_events
                if event.get("kind") == "dom_action"
                and event.get("payload", {}).get("target") == "button:返回来源库"
                and event.get("payload", {}).get("isTrusted") is True
                and trigger.get("sequence", 0) < event.get("sequence", 0) < recovery.get("sequence", 0)
                and event.get("navigationId") == trigger.get("navigationId")
            ]
            if len(actions) != 1 or recovery.get("actionId") != actions[0].get("actionId"):
                errors.append(f"{scenario_id}:trusted-recovery-action")
            recovery_refs = recovery_payload.get("authorityEventIds", [])
            recovery_bodies = [response_bodies.get(reference, {}) for reference in recovery_refs]
            source_lists = [
                candidate.get("sources")
                for body in recovery_bodies
                for candidate in walk(body)
                if isinstance(candidate.get("sources"), list)
            ]
            if len(recovery_refs) != 1 or not source_lists or any(
                any(item.get("sourceId") == source_id for item in sources if isinstance(item, dict))
                for sources in source_lists
            ):
                errors.append(f"{scenario_id}:recovery-source-list-authority")
    return {
        "requiredChains": 3,
        "requiredModes": list(modes),
        "triggerCount": trigger_count,
        "recoveryCount": recovery_count,
        "errors": errors,
        "passed": trigger_count == 12 and recovery_count == 12 and not errors,
    }
def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, default=DEFAULT_T02)
    parser.add_argument(
        "--public-package",
        action="store_true",
        help="Accept absent private_local_only bytes only when their sealed artifact records and hashes remain present.",
    )
    args = parser.parse_args()
    run_root = args.run_root.resolve()
    raw = load(run_root / "raw/raw-run.json")
    events = raw["events"]
    artifacts_by_path = {artifact.get("path"): artifact for artifact in raw.get("artifacts", [])}
    requests = {event["eventId"]: event for event in events if event["kind"] == "runtime_request"}
    origins = Counter(
        event["payload"]["message"]["origin"]
        for event in events
        if event["kind"] == "background_request"
    )
    route_modes = defaultdict(set)
    route_errors = []
    recovery_scenarios = set()
    trusted_recovery_scenarios = {
        event["scenarioId"]
        for event in events
        if event["kind"] == "dom_action"
        and event["payload"].get("isTrusted") is True
        and event["payload"].get("target") == "button:返回来源库"
    }
    for event in events:
        if event["kind"] != "route_observation":
            continue
        if event["payload"].get("errorCode") in {
            "INVALID_ROUTE", "WORKSPACE_NOT_FOUND", "SOURCE_NOT_FOUND", "FORBIDDEN"
        }:
            route_errors.append((event["scenarioId"], event["payload"]["errorCode"]))
        url = event["payload"].get("url", "")
        if "/knowledge/sources/" in url:
            intent = "source_detail"
        elif "/knowledge/sources" in url:
            intent = "source_library"
        elif "/knowledge/ask" in url:
            intent = "ask"
        elif "/knowledge/graph" in url:
            intent = "graph"
        elif "/knowledge/settings/permissions" in url:
            intent = "permissions"
        else:
            continue
        route_modes[intent].add(event["payload"].get("mode"))
        if event["payload"].get("mode") == "recovery" and intent == "source_library":
            recovery_scenarios.add(event["scenarioId"])

    sources = {}
    response_bodies = {}
    for event in events:
        if event["kind"] != "runtime_response" or event["payload"].get("status") != 200:
            continue
        artifact = event["payload"].get("bodyArtifact")
        if not artifact:
            continue
        try:
            body = load(run_root / artifact["path"])
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            continue
        response_bodies[event["eventId"]] = body
        for candidate in walk(body):
            source_id = candidate.get("sourceId")
            source_type = candidate.get("sourceType")
            workspace_id = candidate.get("workspaceId")
            if source_id and source_type and workspace_id:
                sources[source_id] = source_type

    screenshot_surfaces = Counter()
    screenshot_widths = Counter()
    screenshots_without_product_viewport = 0
    for event in events:
        if event["kind"] != "screenshot":
            continue
        metadata = load(run_root / event["payload"]["metadataArtifact"]["path"])
        screenshot_surfaces[event["payload"]["surface"]] += 1
        width = (metadata.get("panelViewport") or metadata.get("viewport") or {}).get("width")
        if width is None:
            screenshots_without_product_viewport += 1
        else:
            screenshot_widths[width] += 1

    structured_results = []
    structured_commands = {}
    for event in events:
        if event["kind"] != "command_result":
            continue
        reference = event["payload"].get("structuredResult")
        if not artifact_matches(run_root, reference):
            continue
        try:
            result = load(run_root / reference["path"])
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            continue
        if isinstance(result, dict):
            structured_results.append(result)
            structured_commands[result.get("resultType", "unknown")] = {
                "event": event,
                "result": result,
            }
    structured_types = Counter(
        result.get("resultType", "unknown") for result in structured_results if isinstance(result, dict)
    )
    required_routes = {"source_library", "source_detail", "ask", "graph", "permissions"}
    required_modes = {"direct_open", "reload", "back", "reopen"}
    complete_routes = sorted(
        intent for intent in required_routes if required_modes.issubset(route_modes.get(intent, set()))
    )
    source_types = Counter(sources.values())
    corpus_result = structured_commands.get("source_corpus", {}).get("result")
    corpus_samples = corpus_result.get("samples", []) if isinstance(corpus_result, dict) else []
    corpus_counts = Counter(sample.get("sourceKind") for sample in corpus_samples)
    def corpus_artifact_matches(sample: dict) -> bool:
        reference = sample.get("contentArtifact")
        path_value = reference.get("path") if isinstance(reference, dict) else None
        if args.public_package and isinstance(path_value, str) and path_value.startswith("private/"):
            artifact = artifacts_by_path.get(path_value)
            return bool(
                artifact
                and artifact.get("visibility") == "private_local_only"
                and artifact.get("sha256") == reference.get("sha256")
                and isinstance(artifact.get("byteLength"), int)
                and artifact.get("byteLength") > 0
            )
        return artifact_matches(run_root, reference)

    corpus_integrity = bool(corpus_samples) and all(
        corpus_artifact_matches(sample)
        and sample.get("sourceId") in sources
        and isinstance(sample.get("operationId"), str)
        and len(sample.get("operationId")) > 0
        for sample in corpus_samples
    )
    valid_route_recoveries = [
        code
        for scenario_id, code in route_errors
        if f"{scenario_id}_recovery" in recovery_scenarios
        and f"{scenario_id}_recovery" in trusted_recovery_scenarios
    ]
    axe = structured_commands.get("axe")
    keyboard = structured_commands.get("keyboard")
    axe_valid = bool(axe) and axe["event"]["payload"].get("exitCode") == 0 \
        and axe["result"].get("serious") == 0 and axe["result"].get("critical") == 0
    keyboard_result = keyboard["result"] if keyboard else {}
    keyboard_valid = bool(keyboard) and keyboard["event"]["payload"].get("exitCode") == 0 \
        and keyboard_result.get("assertionsTotal", 0) > 0 \
        and keyboard_result.get("assertionsPassed") == keyboard_result.get("assertionsTotal") \
        and all(keyboard_result.get(key) is True for key in [
            "traceOpenedByKeyboard", "escapePassed", "focusReturnPassed", "tabReachedInteractive", "reducedMotionPassed"
        ])
    durable_forget = validate_durable_forget(run_root, events, response_bodies)

    permission_scenarios = {event["scenarioId"] for event in events if event["scenarioId"].startswith("scenario_permission_") and event["scenarioId"] != "scenario_permission_prepare"}
    forget_scenarios = {event["scenarioId"].split("_direct_open")[0].split("_reload")[0].split("_back")[0].split("_reopen")[0] for event in events if event["scenarioId"].startswith("scenario_forget_")}
    fault_types = {fault["faultType"] for segment in raw["segments"] for fault in segment.get("faultInjections", [])}
    gaps = []

    def gap(gap_id, requirement, observed):
        gaps.append({"id": gap_id, "severity": "major", "requirement": requirement, "observed": observed})

    if origins.get("view_source", 0) < 3 or origins.get("open_workspace", 0) < 2 or origins.get("open_in_workspace", 0) < 2:
        gap("T03-IN-01", "trusted entries: view_source >= 3; other origins >= 2", dict(sorted(origins.items())))
    if not (
        len(corpus_samples) == 12
        and len({sample.get("sourceSampleId") for sample in corpus_samples}) == 12
        and len({sample.get("sourceId") for sample in corpus_samples}) == 12
        and len({sample.get("contentFingerprint") for sample in corpus_samples}) == 12
        and corpus_counts == Counter({"real_web": 6, "explicit_local_document": 3, "note_markdown": 3})
        and corpus_integrity
    ):
        gap("T03-IN-02", "single-run source corpus = 6 web + 3 explicit local + 3 note/markdown with raw-byte/runtime linkage", {
            "uniqueRuntimeSources": len(sources),
            "runtimeSourceTypes": dict(sorted(source_types.items())),
            "registeredSamples": len(corpus_samples),
            "registeredKinds": dict(sorted(corpus_counts.items())),
            "artifactAndRuntimeLinkage": corpus_integrity,
        })
    if len(valid_route_recoveries) < 2:
        gap("T03-IN-03", "invalid/forbidden route error plus trusted recovery samples >= 2", {
            "errorCodes": [code for _, code in route_errors],
            "pairedRecoveries": valid_route_recoveries,
        })
    if not axe_valid or not keyboard_valid:
        gap("T03-IN-04", "typed passing AxeResult + KeyboardResult", {
            "typedResultTypes": dict(sorted(structured_types.items())),
            "axeValid": axe_valid,
            "keyboardValid": keyboard_valid,
        })
    if len(complete_routes) != 5:
        gap("T03-IN-05", "five route intents each cover direct_open/reload/back/reopen", complete_routes)
    if len(permission_scenarios) < 3 or len(forget_scenarios) < 3:
        gap("T03-IN-06", "Permission >= 3 and Forget >= 3", {"permission": len(permission_scenarios), "forget": len(forget_scenarios)})
    if fault_types != {"runtime_offline", "adapter_blocked", "data_service_unreachable", "source_failed"}:
        gap("T03-IN-07", "all four controlled fault intervals", sorted(fault_types))
    if not {360, 420, 768, 1280}.issubset(screenshot_widths):
        gap("T03-IN-08", "product screenshots include widths 360, 420, 768, 1280", sorted(screenshot_widths))
    if not durable_forget["passed"]:
        gap("T03-IN-09", "three same-source Forget chains each prove SOURCE_NOT_FOUND plus trusted Source Library recovery for direct_open/reload/back/reopen", durable_forget)
    result = {
        "schemaVersion": "v2-px-t03-input-readiness/v1",
        "sourceRunId": raw["runId"],
        "sourceSnapshotCommit": raw["snapshotCommit"],
        "sourceRawSeal": raw["seal"]["contentSha256"],
        "readOnly": True,
        "observed": {
            "entryOrigins": dict(sorted(origins.items())),
            "completeRouteRecoveryIntents": complete_routes,
            "routeRecoveryIntentCount": len(complete_routes),
            "invalidOrForbiddenRouteRecoveries": valid_route_recoveries,
            "uniqueRuntimeSources": len(sources),
            "runtimeSourceTypes": dict(sorted(source_types.items())),
            "registeredSourceCorpus": {
                "samples": len(corpus_samples),
                "kinds": dict(sorted(corpus_counts.items())),
                "artifactAndRuntimeLinkage": corpus_integrity,
            },
            "screenshotsBySurface": dict(sorted(screenshot_surfaces.items())),
            "screenshotWidths": {str(key): value for key, value in sorted(screenshot_widths.items(), key=lambda item: str(item[0]))},
            "screenshotsWithoutProductViewport": screenshots_without_product_viewport,
            "typedCommandResultTypes": dict(sorted(structured_types.items())),
            "durableForgetRecovery": durable_forget,
        },
        "gaps": gaps,
        "fatal": 0,
        "major": len(gaps),
        "readyForPositiveProductionValidation": not gaps,
        "allowedUse": "production_positive_input_candidate" if not gaps else "fail_closed_input_and_regression_only",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not gaps else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"T03 input readiness audit failed unexpectedly: {exc}", file=sys.stderr)
        raise SystemExit(3)
