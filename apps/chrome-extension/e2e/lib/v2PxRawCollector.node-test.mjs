import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { V2PxRawCollector, canonicalJson, scanPublicArtifacts, sha256, validateRawRun } from "./v2PxRawCollector.mjs";
import { CONTROLLED_FAULT_STATUS_POLICIES, controlledFaultStatus, inspectRuntimeOfflineAuthority, parseKnowledgeStatusResponse, validateKnowledgeStatusObservations } from "./v2PxKnowledgeStatusEvidence.mjs";
import { summarizeT01Regression } from "./v2PxPrerequisiteEvidence.mjs";
import { resolveObservedRouteErrorCode } from "./v2PxRouteEvidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const e2eRoot = path.resolve(__dirname, "..");
const knowledgeStatusSchemaPath = path.resolve(e2eRoot, "../../../docs/active/project/contracts/v2_knowledge_status.schema.json");

test("seals a redacted T01 summary only when all 36 unique assertions pass", () => {
  const checks = Array.from({ length: 36 }, (_, index) => ({ id: `t01-check-${index + 1}`, passed: true, detail: `/private/path/${index + 1}` }));
  const summary = summarizeT01Regression({ schemaVersion: "t01/v1", runId: "t01-run", passed: true, checks }, "a".repeat(64));
  assert.equal(summary.assertionsTotal, 36);
  assert.equal(summary.assertionsPassed, 36);
  assert.equal(summary.assertionResults.length, 36);
  assert.equal(JSON.stringify(summary).includes("/private/path"), false);
  assert.throws(() => summarizeT01Regression({ passed: true, checks: checks.slice(1) }, "a".repeat(64)), /36 unique passing assertions/);
  assert.throws(() => summarizeT01Regression({ passed: true, checks: [...checks.slice(0, 35), checks[0]] }, "a".repeat(64)), /36 unique passing assertions/);
  assert.throws(() => summarizeT01Regression({ passed: true, checks: checks.map((item, index) => index === 2 ? { ...item, passed: false } : item) }, "a".repeat(64)), /36 unique passing assertions/);
});

test("uses a closed canonical userAction mapping for controlled Knowledge Status faults", () => {
  assert.deepEqual(
    Object.fromEntries(Object.values(CONTROLLED_FAULT_STATUS_POLICIES).map((item) => [item.faultType, item.userAction])),
    {
      adapter_blocked: "configure_adapter",
      data_service_unreachable: "reconnect",
      source_failed: "retry_source_build"
    }
  );
  assert.throws(() => controlledFaultStatus("unknown_fault", "2026-09-13T00:00:00.000Z"), /Unknown controlled Knowledge Status fault/);
});

test("validates all controlled Knowledge Status payloads against the frozen schema", () => {
  const observations = Object.keys(CONTROLLED_FAULT_STATUS_POLICIES).map((faultType, index) => ({
    scenarioId: `scenario_${faultType}`,
    requestEventId: `request_${index}`,
    responseEventId: `response_${index}`,
    value: controlledFaultStatus(faultType, "2026-09-13T00:00:00.000Z")
  }));
  const result = validateKnowledgeStatusObservations({ schemaPath: knowledgeStatusSchemaPath, observations });
  assert.equal(result.checked, 3);
  assert.deepEqual(result.errors, []);
});

test("rejects generic retry and malformed successful Knowledge Status response bytes", () => {
  const invalid = controlledFaultStatus("source_failed", "2026-09-13T00:00:00.000Z");
  invalid.userAction = "retry";
  const result = validateKnowledgeStatusObservations({
    schemaPath: knowledgeStatusSchemaPath,
    observations: [{ scenarioId: "scenario_fault", requestEventId: "request", responseEventId: "response", value: invalid }]
  });
  assert.equal(result.checked, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, "STATUS_SCHEMA_INVALID");

  const parsed = parseKnowledgeStatusResponse({
    requestEvent: { eventId: "request", kind: "runtime_request", payload: { url: "http://127.0.0.1:17861/v1/knowledge/status" } },
    responseEvent: { eventId: "response", scenarioId: "scenario_fault", kind: "runtime_response", payload: { status: 200 } },
    responseBytes: Buffer.from("not-json")
  });
  assert.equal(parsed.error.code, "STATUS_RESPONSE_JSON_INVALID");
});

function fixture() {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "navia-t02-collector-"));
  let time = 0;
  let id = 0;
  const inputs = {
    buildIndex: Buffer.from("build"),
    collectorImplementation: Buffer.from("collector"),
    rawSchemaArtifact: Buffer.from("schema")
  };
  const collector = new V2PxRawCollector({
    runRoot,
    runId: "t02-test-run",
    snapshotCommit: "a".repeat(40),
    buildIndex: { path: "input/build-index.json", sha256: sha256(inputs.buildIndex) },
    collectorImplementation: { path: "input/collector.mjs", sha256: sha256(inputs.collectorImplementation) },
    rawSchemaArtifact: { path: "input/raw-schema.json", sha256: sha256(inputs.rawSchemaArtifact) },
    clock: () => new Date(Date.UTC(2026, 8, 11, 0, 0, time++)).toISOString(),
    monotonic: () => time,
    uuid: () => String(++id).padStart(4, "0")
  });
  collector.writeArtifact({ relativePath: "input/build-index.json", bytes: inputs.buildIndex, mediaType: "application/json" });
  collector.writeArtifact({ relativePath: "input/collector.mjs", bytes: inputs.collectorImplementation, mediaType: "text/javascript" });
  collector.writeArtifact({ relativePath: "input/raw-schema.json", bytes: inputs.rawSchemaArtifact, mediaType: "application/schema+json" });
  return { collector, runRoot };
}

function completeRun() {
  const { collector, runRoot } = fixture();
  const segment = collector.startSegment({ runtimePid: 1234, runtimeStartedAt: "2026-09-11T00:00:00.000Z", browserContextId: "bcx_test" });
  const navigationId = "nav_source_detail";
  const actionId = "act_view_source";
  collector.appendEvent({ scenarioId: "scenario_entry", kind: "navigation_start", contextId: "ctx_side_panel", navigationId, payload: { url: "chrome-extension://id/sidepanel.html#knowledge", mode: "push", priorNavigationId: null } });
  collector.appendEvent({ scenarioId: "scenario_entry", kind: "dom_action", contextId: "ctx_side_panel", navigationId, actionId, payload: { isTrusted: true, eventType: "click", target: "[data-testid=view-source]", url: "chrome-extension://id/sidepanel.html#knowledge", priorPath: "chrome-extension://id/sidepanel.html#knowledge" } });
  const backgroundRequest = collector.appendEvent({ scenarioId: "scenario_entry", kind: "background_request", contextId: "ctx_background", navigationId, actionId, payload: { message: { type: "OPEN_NAVIA_KNOWLEDGE_WORKSPACE", requestId: "req_entry" } } });
  collector.appendEvent({ scenarioId: "scenario_entry", kind: "background_response", contextId: "ctx_background", navigationId, actionId, payload: { requestEventId: backgroundRequest.eventId, message: { requestId: "req_entry", outcome: "created_new" } } });
  const requestBytes = Buffer.from('{"workspaceId":"ws_default"}\n');
  const requestArtifact = collector.writeArtifact({ relativePath: "artifacts/public/runtime/request.json", bytes: requestBytes, mediaType: "application/json" });
  const runtimeRequest = collector.appendEvent({ scenarioId: "scenario_entry", kind: "runtime_request", contextId: "ctx_runtime", navigationId, actionId, payload: { method: "GET", url: "http://127.0.0.1:17861/v1/knowledge/sources?workspaceId=ws_default", requestId: "req_runtime", bodyArtifact: requestArtifact }, artifactRefs: [requestArtifact] });
  const responseBytes = Buffer.from('{\n  "ok": true, "data": {"workspaceId":"ws_default"}\n}\n');
  const responseArtifact = collector.writeArtifact({ relativePath: "artifacts/public/runtime/response.json", bytes: responseBytes, mediaType: "application/json" });
  const runtimeResponse = collector.appendEvent({ scenarioId: "scenario_entry", kind: "runtime_response", contextId: "ctx_runtime", navigationId, actionId, payload: { requestEventId: runtimeRequest.eventId, status: 200, bodyArtifact: responseArtifact, contentType: "application/json" }, artifactRefs: [responseArtifact] });
  const route = collector.appendEvent({ scenarioId: "scenario_entry", kind: "route_observation", contextId: "ctx_workspace", navigationId, actionId, payload: { url: "chrome-extension://id/workspace.html#/knowledge/sources/src_1?workspaceId=ws_default", mode: "push", ids: { status: "observed", workspaceId: "ws_default", sourceId: "src_1" }, authorityEventIds: [runtimeResponse.eventId] } });
  collector.appendEvent({ scenarioId: "scenario_route_error", kind: "route_observation", contextId: "ctx_workspace", navigationId, payload: { url: "chrome-extension://id/workspace.html#/foreign", mode: "direct_open", errorCode: "INVALID_ROUTE", ids: { status: "unavailable" }, authorityEventIds: [] } });
  const container = collector.appendEvent({ scenarioId: "scenario_entry", kind: "container_observation", contextId: "ctx_workspace", navigationId, actionId, payload: { surface: "workspace_page", ids: { status: "observed", workspaceId: "ws_default", sourceId: "src_1" }, authorityEventIds: [runtimeResponse.eventId] } });
  const image = collector.writeArtifact({ relativePath: "screenshots/source.png", bytes: Buffer.from([137, 80, 78, 71]), mediaType: "image/png" });
  const metadata = collector.writeArtifact({ relativePath: "screenshot-metadata/source.json", bytes: JSON.stringify({ width: 1280, height: 900 }), mediaType: "application/json" });
  collector.appendEvent({ scenarioId: "scenario_entry", kind: "screenshot", contextId: "ctx_workspace", navigationId, actionId, payload: { surface: "workspace_page", imageArtifact: image, metadataArtifact: metadata, observationEventIds: [route.eventId, container.eventId] }, artifactRefs: [image, metadata] });
  const stdout = collector.writeArtifact({ relativePath: "logs/command.stdout", bytes: "ok\n", mediaType: "text/plain" });
  const stderr = collector.writeArtifact({ relativePath: "logs/command.stderr", bytes: "", mediaType: "text/plain" });
  const structuredResult = collector.writeArtifact({ relativePath: "logs/axe-result.json", bytes: JSON.stringify({ resultType: "axe", serious: 0, critical: 0 }), mediaType: "application/json" });
  collector.appendEvent({ scenarioId: "scenario_command", kind: "command_result", contextId: "ctx_command", payload: { command: "pnpm typecheck", cwd: ".", exitCode: 0, signal: null, stdout, stderr, structuredResult }, artifactRefs: [stdout, stderr, structuredResult] });
  collector.startFault({ scenarioId: "scenario_fault", faultType: "runtime_offline", target: "runtime_transport", contextId: "ctx_runtime", navigationId });
  const failedRequest = collector.appendEvent({ scenarioId: "scenario_fault", kind: "runtime_request", contextId: "ctx_runtime", navigationId, payload: { method: "GET", url: "http://127.0.0.1:17861/v1/knowledge/status", requestId: "req_offline", bodyArtifact: null } });
  collector.appendEvent({ scenarioId: "scenario_fault", kind: "transport_failure", contextId: "ctx_runtime", navigationId, payload: { requestEventId: failedRequest.eventId, errorCode: "connection_refused" } });
  collector.endFault({ scenarioId: "scenario_fault", faultType: "runtime_offline", target: "runtime_transport", contextId: "ctx_runtime", navigationId });
  collector.endSegment(segment.segmentId);
  return { collector, runRoot, responseBytes };
}

function schemaValidity(documents) {
  const script = [
    "import json,sys",
    "from jsonschema import Draft202012Validator",
    "schema=json.load(open('docs/active/project/contracts/v2_px_raw_run.schema.json'))",
    "validator=Draft202012Validator(schema)",
    "documents=json.load(sys.stdin)",
    "print(json.dumps([not any(validator.iter_errors(document)) for document in documents]))"
  ].join("\n");
  const result = spawnSync("python3", ["-c", script], {
    cwd: path.resolve(e2eRoot, "../../.."),
    encoding: "utf8",
    input: JSON.stringify(documents)
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("seals a deterministic v2 raw run and rejects post-seal writes", () => {
  const { collector, runRoot, responseBytes } = completeRun();
  const sealed = collector.seal();
  assert.deepEqual(validateRawRun(sealed.document, { runRoot }), []);
  assert.equal(sealed.document.schemaVersion, "v2-px-raw-run/v2");
  assert.equal(sealed.document.seal.eventCount, sealed.document.events.length);
  assert.equal(sealed.document.seal.artifactCount, sealed.document.artifacts.length);
  const response = sealed.document.artifacts.find((artifact) => artifact.path.endsWith("response.json"));
  assert.equal(response.sha256, sha256(responseBytes));
  assert.notEqual(response.sha256, sha256(Buffer.from(JSON.stringify(JSON.parse(responseBytes)))));
  assert.throws(() => collector.writeArtifact({ relativePath: "late.txt", bytes: "late", mediaType: "text/plain" }), /sealed/);
  assert.ok(fs.existsSync(path.join(runRoot, "raw/raw-run.json")));
  const schemaValidation = spawnSync("python3", ["-", path.join(runRoot, "raw/raw-run.json")], {
    cwd: path.resolve(e2eRoot, "../../.."),
    encoding: "utf8",
    input: [
      "import json,sys",
      "from jsonschema import Draft202012Validator",
      "schema=json.load(open('docs/active/project/contracts/v2_px_raw_run.schema.json'))",
      "Draft202012Validator.check_schema(schema)",
      "document=json.load(open(sys.argv[1]))",
      "errors=list(Draft202012Validator(schema).iter_errors(document))",
      "assert not errors, '\\n'.join(error.message for error in errors)",
      "print('raw-schema-instance: PASS')"
    ].join("\n")
  });
  assert.equal(schemaValidation.status, 0, schemaValidation.stderr || schemaValidation.stdout);
});

test("requires exactly one terminal outcome for every background and Runtime request", () => {
  const { collector } = completeRun();
  const valid = collector.seal().document;

  const orphan = structuredClone(valid);
  const runtimeResponseIndex = orphan.events.findIndex((event) => event.kind === "runtime_response");
  orphan.events.splice(runtimeResponseIndex, 1);
  orphan.events.forEach((event, index) => { event.sequence = index + 1; });
  orphan.segments[0].endedSequence = orphan.events.length;
  assert.match(validateRawRun(orphan).join("\n"), /runtime_request .* exactly one terminal outcome; found 0/);

  const duplicate = structuredClone(valid);
  const response = structuredClone(duplicate.events.find((event) => event.kind === "runtime_response"));
  response.eventId = "evt_duplicate_runtime_response";
  duplicate.events.push(response);
  duplicate.events.forEach((event, index) => { event.sequence = index + 1; });
  duplicate.segments[0].endedSequence = duplicate.events.length;
  assert.match(validateRawRun(duplicate).join("\n"), /runtime_request .* exactly one terminal outcome; found 2/);
});

test("rejects missing, changed and mismatched top-level input artifacts", () => {
  const { collector, runRoot } = completeRun();
  const sealed = collector.seal().document;
  const mismatchedReference = structuredClone(sealed);
  mismatchedReference.buildIndex.sha256 = "f".repeat(64);
  assert.ok(validateRawRun(mismatchedReference).some((error) => error.includes("buildIndex references")));

  const changedArtifact = structuredClone(sealed);
  fs.writeFileSync(path.join(runRoot, changedArtifact.collectorImplementation.path), "changed");
  assert.ok(validateRawRun(changedArtifact, { runRoot }).some((error) => error.includes("collector.mjs sha256 mismatch")));

  const missingArtifact = structuredClone(sealed);
  fs.rmSync(path.join(runRoot, missingArtifact.rawSchemaArtifact.path));
  assert.ok(validateRawRun(missingArtifact, { runRoot }).some((error) => error.includes("raw-schema.json is missing")));
});

test("detects run, count, request, authority and command invariant failures", () => {
  const { collector } = completeRun();
  const sealed = collector.seal().document;
  const broken = structuredClone(sealed);
  broken.events[0].runId = "other";
  broken.seal.eventCount += 1;
  const runtimeRequest = broken.events.find((event) => event.kind === "runtime_request");
  runtimeRequest.payload.requestId = null;
  const route = broken.events.find((event) => event.kind === "route_observation");
  route.payload.authorityEventIds = [broken.events.find((event) => event.kind === "dom_action").eventId];
  const command = broken.events.find((event) => event.kind === "command_result");
  command.payload.exitCode = null;
  command.payload.signal = null;
  const errors = validateRawRun(broken).join("\n");
  assert.match(errors, /different runId/);
  assert.match(errors, /eventCount/);
  assert.match(errors, /no requestId/);
  assert.match(errors, /invalid authority/);
  assert.match(errors, /no terminal result/);
});

test("schema rejects one malformed event for every event kind", () => {
  const { collector } = completeRun();
  const valid = collector.seal().document;
  const mutations = {
    navigation_start: (event) => { delete event.payload.mode; },
    fault_start: (event) => { event.payload.target = "invalid"; },
    fault_end: (event) => { event.payload.faultType = "invalid"; },
    dom_action: (event) => { event.payload.isTrusted = "yes"; },
    background_request: (event) => { delete event.payload.message; },
    background_response: (event) => { delete event.payload.requestEventId; },
    runtime_request: (event) => { delete event.payload.method; },
    runtime_response: (event) => { delete event.payload.bodyArtifact; },
    transport_failure: (event) => { delete event.payload.errorCode; },
    route_observation: (event) => { event.payload.mode = "invalid"; },
    container_observation: (event) => { event.payload.surface = "invalid"; },
    screenshot: (event) => { delete event.payload.metadataArtifact; },
    command_result: (event) => { delete event.payload.stdout; }
  };
  const documents = Object.entries(mutations).map(([kind, mutate]) => {
    const document = structuredClone(valid);
    const event = document.events.find((candidate) => candidate.kind === kind);
    assert.ok(event, `complete fixture is missing ${kind}`);
    mutate(event);
    return document;
  });
  assert.deepEqual(schemaValidity(documents), documents.map(() => false));
});

test("schema accepts canonical route errors and rejects unknown route errors", () => {
  const { collector } = completeRun();
  const valid = collector.seal().document;
  assert.deepEqual(schemaValidity([valid]), [true]);
  const invalid = structuredClone(valid);
  invalid.events.find((event) => event.scenarioId === "scenario_route_error").payload.errorCode = "MADE_UP_ROUTE_ERROR";
  assert.deepEqual(schemaValidity([invalid]), [false]);
});

test("detects cross-record linkage, artifact, fault and segment failures", () => {
  const { collector, runRoot } = completeRun();
  const valid = collector.seal().document;

  const linkage = structuredClone(valid);
  const backgroundResponse = linkage.events.find((event) => event.kind === "background_response");
  backgroundResponse.payload.message.requestId = "req_other";
  backgroundResponse.navigationId = "nav_other";
  const runtimeResponse = linkage.events.find((event) => event.kind === "runtime_response");
  runtimeResponse.artifactRefs = [];
  const route = linkage.events.find((event) => event.kind === "route_observation");
  route.navigationId = "nav_other";
  const screenshot = linkage.events.find((event) => event.kind === "screenshot");
  screenshot.payload.observationEventIds = screenshot.payload.observationEventIds.slice(0, 1);
  const linkageErrors = validateRawRun(linkage).join("\n");
  assert.match(linkageErrors, /different requestId/);
  assert.match(linkageErrors, /does not match request navigation\/action/);
  assert.match(linkageErrors, /runtime_response .* invalid body artifact/);
  assert.match(linkageErrors, /invalid authority/);
  assert.match(linkageErrors, /missing route\/container observations/);

  const lifecycle = structuredClone(valid);
  lifecycle.segments[0].startedSequence = 2;
  lifecycle.segments[0].endedSequence -= 1;
  lifecycle.segments[0].faultInjections = [];
  lifecycle.events[1].sequence = 99;
  lifecycle.events[1].monotonicMs = -1;
  const lifecycleErrors = validateRawRun(lifecycle).join("\n");
  assert.match(lifecycleErrors, /does not start after the previous segment/);
  assert.match(lifecycleErrors, /segments do not cover/);
  assert.match(lifecycleErrors, /sequence is not contiguous/);
  assert.match(lifecycleErrors, /monotonicMs moved backwards/);
  assert.match(lifecycleErrors, /fault_start .* not represented/);
  assert.match(lifecycleErrors, /fault_end .* not represented/);

  const artifact = structuredClone(valid);
  const responseArtifact = artifact.artifacts.find((item) => item.path.endsWith("response.json"));
  responseArtifact.sha256 = "f".repeat(64);
  const artifactErrors = validateRawRun(artifact, { runRoot }).join("\n");
  assert.match(artifactErrors, /unknown artifact|sha256 mismatch/);

  const overlap = structuredClone(valid);
  overlap.segments[0].faultInjections.push({ ...overlap.segments[0].faultInjections[0] });
  assert.match(validateRawRun(overlap).join("\n"), /invalid or overlapping fault intervals/);
});

test("requires a trusted DOM action before a background request", () => {
  const { collector } = completeRun();
  const sealed = collector.seal().document;
  const broken = structuredClone(sealed);
  broken.events = broken.events.filter((event) => event.kind !== "dom_action");
  broken.events.forEach((event, index) => { event.sequence = index + 1; });
  broken.segments[0].endedSequence = broken.events.length;
  broken.seal.eventCount = broken.events.length;
  const { seal: _seal, ...payload } = broken;
  broken.seal.contentSha256 = sha256(Buffer.from(canonicalJson(payload)));
  assert.match(validateRawRun(broken).join("\n"), /no trusted dom_action/);
});

test("records ordered fault intervals", () => {
  const { collector } = fixture();
  const segment = collector.startSegment({ runtimePid: 22, runtimeStartedAt: "2026-09-11T00:00:00.000Z", browserContextId: "bcx_fault" });
  collector.startFault({ scenarioId: "fault", faultType: "runtime_offline", target: "runtime_transport", contextId: "ctx_runtime" });
  collector.endFault({ scenarioId: "fault", faultType: "runtime_offline", target: "runtime_transport", contextId: "ctx_runtime" });
  collector.endSegment(segment.segmentId);
  const document = collector.seal().document;
  assert.deepEqual(validateRawRun(document), []);
  assert.deepEqual(document.segments[0].faultInjections, [{ faultType: "runtime_offline", startSequence: 1, endSequence: 2 }]);
});

test("requires every Runtime request inside an offline interval to end only in one transport failure", () => {
  const valid = completeRun().collector.seal().document;
  const accepted = inspectRuntimeOfflineAuthority({ events: valid.events, segments: valid.segments });
  assert.equal(accepted.intervalsChecked, 1);
  assert.equal(accepted.requestsChecked, 1);
  assert.deepEqual(accepted.errors, []);
  assert.deepEqual(inspectRuntimeOfflineAuthority({ events: valid.events }).errors, []);

  const invalid = structuredClone(valid);
  const failure = invalid.events.find((event) => event.kind === "transport_failure");
  failure.kind = "runtime_response";
  failure.payload.status = 200;
  const rejected = inspectRuntimeOfflineAuthority({ events: invalid.events, segments: invalid.segments });
  assert.equal(rejected.errors.filter((error) => error.code === "RUNTIME_OFFLINE_RESPONSE_OBSERVED").length, 1);
  assert.equal(rejected.errors.filter((error) => error.code === "RUNTIME_OFFLINE_TERMINAL_INVALID").length, 1);
});

test("scans public artifacts without reading private artifacts", () => {
  const { collector, runRoot } = fixture();
  collector.writeArtifact({ relativePath: "artifacts/public/clean.txt", bytes: "clean", mediaType: "text/plain" });
  collector.writeArtifact({ relativePath: "artifacts/private/token.txt", bytes: "secret-token", mediaType: "text/plain", visibility: "private_local_only" });
  const visibleLeak = collector.writeArtifact({ relativePath: "artifacts/public/leak.txt", bytes: "Bearer abcdefghijklmnopqrstuvwxyz", mediaType: "text/plain" });
  const artifacts = [
    { ...visibleLeak, mediaType: "text/plain", byteLength: 33, visibility: "public" },
    { path: "artifacts/private/token.txt", sha256: sha256(Buffer.from("secret-token")), mediaType: "text/plain", byteLength: 12, visibility: "private_local_only" }
  ];
  assert.deepEqual(scanPublicArtifacts({ runRoot, artifacts, secrets: ["secret-token"] }), [{ path: "artifacts/public/leak.txt", reason: "bearer_shape" }]);
});

test("accepts only an observed canonical route error and never fills a missing expected value", () => {
  assert.equal(resolveObservedRouteErrorCode(" SOURCE_NOT_FOUND ", "SOURCE_NOT_FOUND"), "SOURCE_NOT_FOUND");
  assert.equal(resolveObservedRouteErrorCode(null), null);
  assert.throws(
    () => resolveObservedRouteErrorCode(null, "SOURCE_NOT_FOUND"),
    /Expected route error SOURCE_NOT_FOUND, but no RouteError code was observed/
  );
  assert.throws(
    () => resolveObservedRouteErrorCode("MADE_UP", "SOURCE_NOT_FOUND"),
    /Unknown observed route error code: MADE_UP/
  );
  assert.throws(
    () => resolveObservedRouteErrorCode("FORBIDDEN", "SOURCE_NOT_FOUND"),
    /Expected route error SOURCE_NOT_FOUND, observed FORBIDDEN/
  );
});

test("legacy PX-5 report-shaped collection exits before extension build access", () => {
  const runner = path.join(e2eRoot, "chrome-v2-px-workspace-router.mjs");
  const result = spawnSync(process.execPath, [runner], {
    cwd: path.resolve(e2eRoot, "../../.."),
    env: { ...process.env, NAVIA_PX5_PRODUCTION: "1" },
    encoding: "utf8"
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /PX_LEGACY_RAW_COLLECTION_BLOCKED/);
  const source = fs.readFileSync(runner, "utf8");
  assert.doesNotMatch(source, /v2-px-5-production-raw-e2e\/v1/);
  assert.doesNotMatch(source, /JSON\.stringify\(responseBody\)/);
  assert.doesNotMatch(source, /__naviaPx5Messages/);
});
