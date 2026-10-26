#!/usr/bin/env python3
from __future__ import annotations

import copy
import hashlib
import json
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[7]
PACKAGE = Path(__file__).resolve().parent
CONTRACTS = ROOT / "docs/active/project/contracts"
FIXTURES = ROOT / "docs/active/project/fixtures"
DESIGN = ROOT / "docs/active/project/design/wp-b-explicit-local-media-import-prototype"
checks: list[tuple[str, bool]] = []


def check(name: str, value: bool) -> None:
    checks.append((name, bool(value)))


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


status_schema = load(CONTRACTS / "v3_media_local_import_status_v1.schema.json")
api_schema = load(CONTRACTS / "v3_media_local_import_api_v1.schema.json")
internal_schema = load(CONTRACTS / "v3_media_local_import_internal_v1.schema.json")
schemas = (status_schema, api_schema, internal_schema)
registry = Registry().with_resources((schema["$id"], Resource.from_contents(schema)) for schema in schemas)
validator_args = {"registry": registry, "format_checker": FormatChecker()}
status_validator = Draft202012Validator(status_schema, **validator_args)
api_validator = Draft202012Validator(api_schema, **validator_args)
internal_validator = Draft202012Validator(internal_schema, **validator_args)


def semantic_status_valid(value: dict) -> bool:
    state = value.get("state")
    size = value.get("byteLength")
    uploaded = value.get("uploadedBytes")
    failure = value.get("failureCode")
    media = value.get("media")
    if not isinstance(size, int) or not isinstance(uploaded, int) or uploaded > size:
        return False
    if state == "ready":
        return uploaded == size and failure is None and isinstance(media, dict)
    if state == "failed":
        return isinstance(failure, str) and media is None
    if state == "cancelled":
        return failure == "V3_MEDIA_IMPORT_CANCELLED" and media is None
    return failure is None and media is None


for name, schema in (("status", status_schema), ("api", api_schema), ("internal", internal_schema)):
    try:
        Draft202012Validator.check_schema(schema)
        check(f"schema_meta_{name}", True)
    except Exception:
        check(f"schema_meta_{name}", False)

create = load(FIXTURES / "v3-media-local-import-create-v1-positive.json")
status = load(FIXTURES / "v3-media-local-import-status-v1-positive.json")
api_ok = load(FIXTURES / "v3-media-local-import-api-v1-positive.json")
api_error = load(FIXTURES / "v3-media-local-import-api-v1-error.json")
internal = load(FIXTURES / "v3-media-local-import-internal-v1-positive.json")
assets = load(FIXTURES / "v3-media-local-import-acceptance-assets-v1.json")
check("fixture_create", not list(api_validator.iter_errors(create)))
check("fixture_status", not list(status_validator.iter_errors(status)) and semantic_status_valid(status))
check("fixture_api_success", not list(api_validator.iter_errors(api_ok)))
check("fixture_api_error", not list(api_validator.iter_errors(api_error)))
check("fixture_internal", not list(internal_validator.iter_errors(internal)))

for field in ("fileName", "path", "url", "hash", "lastModified", "relativePath"):
    mutation = copy.deepcopy(create)
    mutation[field] = "forbidden"
    check(f"reject_create_{field}", bool(list(api_validator.iter_errors(mutation))))

for field in ("uploadToken", "fileName", "path", "sandboxPath"):
    mutation = copy.deepcopy(internal)
    mutation["storeRecord"][field] = "forbidden"
    check(f"reject_store_{field}", bool(list(internal_validator.iter_errors(mutation))))

mutation = copy.deepcopy(internal)
mutation["visualReceipt"]["frames"] = mutation["visualReceipt"]["frames"] * 9
check("reject_visual_frame_nine", bool(list(internal_validator.iter_errors(mutation))))
mutation = copy.deepcopy(internal)
mutation["consumerBarrier"]["phase"] = "ready"
check("reject_barrier_non_phase", bool(list(internal_validator.iter_errors(mutation))))
mutation = copy.deepcopy(internal)
mutation["storeRecord"]["failureCode"] = "V3_MEDIA_IMPORT_UNKNOWN"
check("reject_store_unknown_failure_code", bool(list(internal_validator.iter_errors(mutation))))

for mime in ("video/mp4", "video/webm", "video/x-matroska", "application/octet-stream"):
    mutation = copy.deepcopy(create)
    mutation["declaredMediaType"] = mime
    check(f"accept_mime_{mime.split('/')[-1]}", not list(api_validator.iter_errors(mutation)))
mutation = copy.deepcopy(create)
mutation["declaredMediaType"] = "audio/mpeg"
check("reject_audio_mime", bool(list(api_validator.iter_errors(mutation))))

for value, expected in ((0, False), (1, True), (2147483648, True), (2147483649, False)):
    mutation = copy.deepcopy(create)
    mutation["byteLength"] = value
    check(f"byte_boundary_{value}", (not list(api_validator.iter_errors(mutation))) is expected)

terminal_mutations = []
mutation = copy.deepcopy(status); mutation["uploadedBytes"] -= 1; terminal_mutations.append(("ready_short", mutation))
mutation = copy.deepcopy(status); mutation["media"] = None; terminal_mutations.append(("ready_no_media", mutation))
mutation = copy.deepcopy(status); mutation["failureCode"] = "V3_MEDIA_IMPORT_MEDIA_INVALID"; terminal_mutations.append(("ready_failure", mutation))
mutation = copy.deepcopy(status); mutation["media"]["durationMs"] = 14400001; terminal_mutations.append(("duration_over", mutation))
mutation = copy.deepcopy(status); mutation["media"]["route"] = "credentialed_media_asr"; terminal_mutations.append(("route_wrong", mutation))
for name, mutation in terminal_mutations:
    check(f"reject_{name}", bool(list(status_validator.iter_errors(mutation))) or not semantic_status_valid(mutation))

check("asset_registry_version", assets.get("schemaVersion") == "v3-media-local-import-acceptance-assets/v1")
check("asset_registry_two", [x.get("id") for x in assets.get("assets", [])] == ["wp-b-real-100mb", "wp-b-real-1gb"])
check("asset_registry_real_media", all(x.get("minimumAllocatedRatio", 0) >= 0.95 and x.get("minimumNonEmptyTranscriptSegments", 0) >= 3 and x.get("minimumDistinctFrameHashes", 0) >= 3 for x in assets["assets"]))
check("asset_registry_resource_bounds", assets["resourceGates"] == {
    "runtimePeakRssDeltaBytesMaximum": 268435456,
    "extensionJsHeapDeltaBytesMaximum": 134217728,
    "uploadWriterSliceBytesMaximum": 1048576,
    "minimumFreeDiskBeforeGenerationBytes": 4294967296,
    "ownedArtifactsMustBeZeroAfterRun": True,
})
for forbidden in ("sparse allocation", "truncate enlargement", "trailing zero padding", "mock transcript", "mock frame"):
    check(f"asset_forbids_{forbidden.replace(' ', '_')}", forbidden in assets["generator"]["forbidden"])

required_docs = [f"0{i}-{name}.md" for i, name in [
    (0, "package-status"), (1, "target-experience-and-scope"),
    (2, "target-architecture-and-code-map"), (3, "api-contract-and-state-machine"),
    (4, "development-plan"), (5, "acceptance-plan"),
    (6, "risk-and-review"), (7, "claudecode-implementation-goal"),
]]
required_docs += ["09-independent-document-audit.md", "10-codex-implementation-gate.md"]
texts = {}
for filename in required_docs:
    path = PACKAGE / filename
    check(f"doc_exists_{filename[:2]}", path.is_file())
    texts[filename] = path.read_text(encoding="utf-8") if path.is_file() else ""

combined = "\n".join(texts.values())
for token in (
    "explicit_local_media_asr", "LocalMediaImportManager", "LocalMediaImportStore",
    "LocalMediaConsumerBarrier", "TaskArtifactSandbox", "SourceAuthority", "request.stream()",
    "BEGIN IMMEDIATE", "synchronous=FULL", "ImportedVisualReceipt", "memoryview",
    "X-Navia-Import-Token", "V3_MEDIA_IMPORT_AUTH_REQUIRED", "V3_MEDIA_IMPORT_ORIGIN_MISMATCH",
    "2,147,483,648", "14,400,000", "100 MB", "1 GB", "--mute-audio",
    "WP-B AWAITING CODEX CHECKPOINT", "不扫描目录", "不保存浏览器伪路径",
    "原始视频", "consumer barrier", "RUNTIME_RESTARTED", "CLEANUP_INCOMPLETE",
):
    check(f"required_token_{re.sub(r'[^A-Za-z0-9]+', '_', token)[:50]}", token in combined)
check("no_transport_chunk_rejection", "单块上限 1 MiB" not in combined and "1 MiB+1 单块" not in combined)

acceptance = texts["05-acceptance-plan.md"]
ids = re.findall(r"\| (B\d{2}) \|", acceptance)
check("acceptance_exact_30", ids == [f"B{i:02d}" for i in range(1, 31)])
check("acceptance_restart_oracle", "GET 非 404" in acceptance and "新 Runtime 进程" in acceptance)
check("acceptance_hard_kill", "transcript-terminal-first" in acceptance and "visual-terminal-first" in acceptance and "T1/T2/T3" in acceptance and "T4" in acceptance)
check("acceptance_no_false_green", "反假绿" in acceptance and "false green" in acceptance)

api_doc = texts["03-api-contract-and-state-machine.md"]
check("cors_methods_exact", "`POST,GET,PUT,DELETE,OPTIONS`" in api_doc)
check("cors_headers_exact", "`Content-Type,X-Request-Id,Authorization,X-Navia-Import-Token`" in api_doc and "不得列入浏览器控制的 `Content-Length`" in api_doc)

architecture = load(DESIGN / "architecture.json")
component_ids = {x.get("id") for x in architecture.get("components", [])}
check("architecture_showcase", architecture.get("meta", {}).get("quality_profile") == "showcase")
check("architecture_twelve_nodes", len(component_ids) == 12)
check("architecture_required_entities", {"store", "acquisition", "visualSandbox", "barrier", "asr", "visual"}.issubset(component_ids))
check("architecture_security_boundary", any(x.get("kind") == "security-group" for x in architecture.get("boundaries", [])))
check("architecture_html", (DESIGN / "architecture.html").is_file() and (DESIGN / "architecture.html").stat().st_size > 100000)

prototype = (DESIGN / "index.html").read_text(encoding="utf-8")
check("prototype_file_input", 'type="file"' in prototype)
check("prototype_tabs_a11y", 'role="tablist"' in prototype and len(re.findall(r'<button[^>]+role="tab"', prototype)) == 4 and prototype.count('role="tabpanel"') == 4)
check("prototype_state_a11y", 'aria-pressed="true"' in prototype and 'role="progressbar"' in prototype and 'aria-live="polite"' in prototype)

public_codes = set(re.findall(r"V3_MEDIA_IMPORT_[A-Z_]+", json.dumps(api_schema)))
check("failure_code_count_18", len(public_codes) == 18)
check("failure_code_docs_match", public_codes.issubset(set(re.findall(r"V3_MEDIA_IMPORT_[A-Z_]+", combined))))
check("independent_audit_closed", "Fatal 0 / Major 0 / Minor 0" in texts["09-independent-document-audit.md"] and "第三轮全文外审" in texts["09-independent-document-audit.md"])
check("implementation_gate", "WP-B IMPLEMENTATION MAY START" in texts["10-codex-implementation-gate.md"] and "WP-B AWAITING CODEX CHECKPOINT" in texts["10-codex-implementation-gate.md"])

manifest_path = PACKAGE / "11-handoff-manifest.sha256"
manifest_lines = [line.split(maxsplit=1) for line in manifest_path.read_text(encoding="utf-8").splitlines() if line.strip()] if manifest_path.is_file() else []
check("handoff_manifest_exact_23", len(manifest_lines) == 23)
manifest_ok = True
for digest, relative in manifest_lines:
    payload = ROOT / relative
    if not payload.is_file() or hashlib.sha256(payload.read_bytes()).hexdigest() != digest:
        manifest_ok = False
        break
check("handoff_manifest_hashes", manifest_ok)

passed = sum(ok for _, ok in checks)
for name, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'} {name}")
print(f"RESULT {passed}/{len(checks)}")
sys.exit(0 if passed == len(checks) else 2)
