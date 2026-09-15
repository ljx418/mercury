import fs from "node:fs";
import path from "node:path";
import { validateRawRun } from "./v2PxRawCollector.mjs";
import { artifactRefFromRecord, readArtifact, sha256 } from "./v2PxArtifactReader.mjs";
import { sealCanonical } from "./v2PxPipelineIo.mjs";

const EVENT_ARRAYS = {
  dom_action: "domActionEventIds", background_request: "backgroundRequestEventIds", background_response: "backgroundResponseEventIds",
  runtime_request: "runtimeRequestEventIds", runtime_response: "runtimeTerminalEventIds", transport_failure: "runtimeTerminalEventIds",
  route_observation: "routeObservationEventIds", container_observation: "containerObservationEventIds", screenshot: "screenshotEventIds",
  command_result: "commandResultEventIds", fault_start: "faultEventIds", fault_end: "faultEventIds"
};
const ROUTE_MODES = ["direct_open", "reload", "back", "reopen"];
const ROUTE_INTENTS = ["source_library", "source_detail", "ask", "graph", "permissions"];

function walk(value) {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!value || typeof value !== "object") return [];
  return [value, ...Object.values(value).flatMap(walk)];
}

function routeIntent(url = "") {
  if (/\/knowledge\/sources\/[^/?#]+/.test(url)) return "source_detail";
  if (url.includes("/knowledge/sources")) return "source_library";
  if (url.includes("/knowledge/ask")) return "ask";
  if (url.includes("/knowledge/graph")) return "graph";
  if (url.includes("/knowledge/settings/permissions")) return "permissions";
  return null;
}

function recordFor(raw, reference) {
  const record = raw.artifacts.find((item) => item.path === reference.path);
  if (!record || record.sha256 !== reference.sha256) throw new Error(`Artifact record mismatch: ${reference.path}`);
  return record;
}

function readJsonArtifact(runRoot, raw, reference) {
  const record = recordFor(raw, reference);
  return JSON.parse(readArtifact(runRoot, artifactRefFromRecord(record)).bytes.toString("utf8"));
}

function terminalIndex(events) {
  const result = new Map();
  for (const event of events.filter((item) => item.kind === "runtime_response" || item.kind === "transport_failure")) {
    const requestId = event.payload.requestEventId;
    if (!result.has(requestId)) result.set(requestId, []);
    result.get(requestId).push(event);
  }
  return result;
}

function sourceMappings(runRoot, raw, structured) {
  const samples = structured.source_corpus?.value.samples ?? [];
  const responses = raw.events.filter((event) => event.kind === "runtime_response" && [200, 202].includes(event.payload.status)).map((event) => {
    try { return { event, body: readJsonArtifact(runRoot, raw, event.payload.bodyArtifact) }; } catch { return null; }
  }).filter(Boolean);
  const eventById = new Map(raw.events.map((event) => [event.eventId, event]));
  return samples.map((sample) => {
    const response = responses.find(({ body }) => walk(body).some((item) => item.sourceId === sample.sourceId && item.operationId === sample.operationId));
    if (!response) throw new Error(`No successful import response for ${sample.sourceSampleId}`);
    const request = eventById.get(response.event.payload.requestEventId);
    const isImportEndpoint = request?.payload?.url?.endsWith("/v1/knowledge/sources") || /\/v1\/knowledge\/permissions\/[^/]+\/imports$/.test(request?.payload?.url ?? "");
    if (!request || request.kind !== "runtime_request" || request.payload.method !== "POST" || !isImportEndpoint) throw new Error(`No import request for ${sample.sourceSampleId}`);
    const source = walk(response.body).find((item) => item.sourceId === sample.sourceId && item.workspaceId);
    const kind = { real_web: "web", explicit_local_document: "local", note_markdown: "note" }[sample.sourceKind];
    return {
      sourceSampleId: sample.sourceSampleId, sourceId: sample.sourceId, workspaceId: source.workspaceId, sourceType: kind,
      contentFingerprint: `sha256:${sample.contentFingerprint}`, registrationArtifactRef: artifactRefFromRecord(recordFor(raw, sample.contentArtifact)),
      importRequestEventId: request.eventId, importResponseEventId: response.event.eventId, operationId: sample.operationId
    };
  });
}

function structuredResults(runRoot, raw) {
  const output = {};
  for (const event of raw.events.filter((item) => item.kind === "command_result" && item.payload.structuredResult)) {
    const value = readJsonArtifact(runRoot, raw, event.payload.structuredResult);
    if (!value.resultType) throw new Error(`Structured command result lacks resultType: ${event.eventId}`);
    output[value.resultType] = { event, value, reference: artifactRefFromRecord(recordFor(raw, event.payload.structuredResult)) };
  }
  return output;
}

function deriveScenarioFacts(runRoot, raw) {
  const eventById = new Map(raw.events.map((event) => [event.eventId, event]));
  const grouped = new Map();
  for (const event of raw.events) {
    if (!grouped.has(event.scenarioId)) grouped.set(event.scenarioId, []);
    grouped.get(event.scenarioId).push(event);
  }
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right, "en")).map(([scenarioId, events]) => {
    const provenance = Object.fromEntries(Object.values(EVENT_ARRAYS).map((key) => [key, []]));
    const facts = {
      eventCount: events.length,
      eventKinds: {},
      trustedActions: [],
      backgroundRequests: [],
      backgroundResponses: [],
      routes: [],
      containers: [],
      screenshots: [],
      commands: [],
      faults: [],
      statusObservations: []
    };
    let passed = true;
    for (const event of events.sort((left, right) => left.sequence - right.sequence)) {
      facts.eventKinds[event.kind] = (facts.eventKinds[event.kind] ?? 0) + 1;
      if (EVENT_ARRAYS[event.kind]) provenance[EVENT_ARRAYS[event.kind]].push(event.eventId);
      if (event.kind === "dom_action" && event.payload.isTrusted === true) facts.trustedActions.push({ eventId: event.eventId, actionId: event.actionId, target: event.payload.target, sequence: event.sequence });
      if (event.kind === "background_request") {
        facts.backgroundRequests.push({
          eventId: event.eventId,
          actionId: event.actionId,
          navigationId: event.navigationId,
          sequence: event.sequence,
          message: event.payload.message
        });
      }
      if (event.kind === "background_response") {
        facts.backgroundResponses.push({
          eventId: event.eventId,
          requestEventId: event.payload.requestEventId,
          actionId: event.actionId,
          navigationId: event.navigationId,
          sequence: event.sequence,
          message: event.payload.message
        });
      }
      if (event.kind === "route_observation") {
        const unknownAuthority = (event.payload.authorityEventIds ?? []).filter((id) => !eventById.has(id));
        if (unknownAuthority.length) passed = false;
        facts.routes.push({ eventId: event.eventId, sequence: event.sequence, mode: event.payload.mode, routeIntent: routeIntent(event.payload.url), url: event.payload.url, ids: event.payload.ids, errorCode: event.payload.errorCode ?? null, authorityEventIds: event.payload.authorityEventIds ?? [] });
      }
      if (event.kind === "container_observation") facts.containers.push({ eventId: event.eventId, sequence: event.sequence, surface: event.payload.surface, ids: event.payload.ids, authorityEventIds: event.payload.authorityEventIds ?? [] });
      if (event.kind === "screenshot") {
        const image = artifactRefFromRecord(recordFor(raw, event.payload.imageArtifact));
        const metadata = artifactRefFromRecord(recordFor(raw, event.payload.metadataArtifact));
        readArtifact(runRoot, image); readArtifact(runRoot, metadata);
        facts.screenshots.push({ eventId: event.eventId, sequence: event.sequence, surface: event.payload.surface, imageArtifact: image, metadataArtifact: metadata, metadata: readJsonArtifact(runRoot, raw, event.payload.metadataArtifact), observationEventIds: event.payload.observationEventIds });
      }
      if (event.kind === "command_result") {
        if (event.payload.exitCode !== 0) passed = false;
        facts.commands.push({ eventId: event.eventId, sequence: event.sequence, command: event.payload.command, cwd: event.payload.cwd, exitCode: event.payload.exitCode, stdout: artifactRefFromRecord(recordFor(raw, event.payload.stdout)), stderr: artifactRefFromRecord(recordFor(raw, event.payload.stderr)), structuredResult: event.payload.structuredResult ? artifactRefFromRecord(recordFor(raw, event.payload.structuredResult)) : null });
      }
      if (event.kind === "runtime_response") {
        const request = eventById.get(event.payload.requestEventId);
        if (request?.kind === "runtime_request" && request.payload.url.endsWith("/v1/knowledge/status")) {
          try {
            const body = readJsonArtifact(runRoot, raw, event.payload.bodyArtifact);
            const observation = body?.data;
            if (observation?.schemaVersion === "v2-knowledge-status-draft-2026-07-10") {
              facts.statusObservations.push({
                eventId: event.eventId,
                requestEventId: request.eventId,
                authority: "runtime_response",
                value: observation
              });
            }
          } catch {
            passed = false;
          }
        }
      }
      if (event.kind === "fault_start" || event.kind === "fault_end") facts.faults.push({ eventId: event.eventId, sequence: event.sequence, phase: event.kind === "fault_start" ? "start" : "end", ...event.payload });
    }
    if (facts.faults.some((item) => item.phase === "start" && item.faultType === "runtime_offline") && facts.statusObservations.length === 0) {
      const faultStart = events.find((event) => event.kind === "fault_start" && event.payload.faultType === "runtime_offline");
      facts.statusObservations.push({
        eventId: faultStart.eventId,
        requestEventId: null,
        authority: "frontend_transport_inference",
        value: {
          schemaVersion: "v2-knowledge-status-draft-2026-07-10",
          observedAt: faultStart.observedAt,
          frontendInferredRuntimeStatus: "offline",
          runtimeStatus: null,
          adapterStatus: "unchecked",
          dataServiceStatus: "unchecked",
          sourceBuildStatus: "unknown",
          userAction: "start_runtime",
          message: "Runtime transport was unreachable during the controlled runtime_offline interval.",
          redactionApplied: true
        }
      });
    }
    return { scenarioId, passed, provenance, facts };
  });
}

function deriveSummary(runRoot, raw, mappings, scenarios, structured) {
  const entries = {};
  for (const event of raw.events.filter((item) => item.kind === "background_request")) entries[event.payload.message.origin] = (entries[event.payload.message.origin] ?? 0) + 1;
  const routeMatrix = Object.fromEntries(ROUTE_INTENTS.map((intent) => [intent, Object.fromEntries(ROUTE_MODES.map((mode) => [mode, 0]))]));
  const routeErrors = [];
  for (const event of raw.events.filter((item) => item.kind === "route_observation")) {
    const intent = routeIntent(event.payload.url);
    if (intent && routeMatrix[intent] && Object.hasOwn(routeMatrix[intent], event.payload.mode)) routeMatrix[intent][event.payload.mode] += 1;
    if (event.payload.errorCode) routeErrors.push({ scenarioId: event.scenarioId, eventId: event.eventId, errorCode: event.payload.errorCode, mode: event.payload.mode });
  }
  const recoveries = raw.events.filter((item) => item.kind === "route_observation" && item.payload.mode === "recovery");
  const trustedRecoveryScenarios = new Set(raw.events.filter((item) => item.kind === "dom_action" && item.payload.isTrusted === true && item.payload.target === "button:返回来源库").map((item) => item.scenarioId));
  const ordinaryRecoveries = routeErrors.filter((error) => ["INVALID_ROUTE", "WORKSPACE_NOT_FOUND", "FORBIDDEN"].includes(error.errorCode) && recoveries.some((event) => event.scenarioId === `${error.scenarioId}_recovery`) && trustedRecoveryScenarios.has(`${error.scenarioId}_recovery`));
  const durableErrors = routeErrors.filter((item) => item.errorCode === "SOURCE_NOT_FOUND");
  const durableRecoveries = recoveries.filter((event) => event.scenarioId.startsWith("scenario_forget_") && trustedRecoveryScenarios.has(event.scenarioId));
  const terminals = terminalIndex(raw.events);
  const requests = raw.events.filter((item) => item.kind === "runtime_request");
  const exactOne = requests.filter((request) => (terminals.get(request.eventId) ?? []).length === 1).length;
  const widths = {};
  const surfaces = {};
  for (const scenario of scenarios) for (const screenshot of scenario.facts.screenshots) {
    const viewport = screenshot.metadata.panelViewport ?? screenshot.metadata.viewport;
    if (viewport?.width) widths[viewport.width] = (widths[viewport.width] ?? 0) + 1;
    surfaces[screenshot.surface] = (surfaces[screenshot.surface] ?? 0) + 1;
  }
  const sourceDistribution = mappings.reduce((result, item) => ({ ...result, [item.sourceType]: (result[item.sourceType] ?? 0) + 1 }), {});
  const faultTypes = [...new Set(raw.segments.flatMap((segment) => segment.faultInjections.map((item) => item.faultType)))].sort();
  const axe = structured.axe?.value ?? null;
  const keyboard = structured.keyboard?.value ?? null;
  const t01 = structured.t01_real_chrome_regression?.value ?? null;
  const prerequisiteCommands = scenarios.flatMap((scenario) => scenario.facts.commands).filter((item) => item.command);
  return {
    eventCount: raw.events.length, artifactCount: raw.artifacts.length, scenarioCount: scenarios.length,
    entryOrigins: entries, routeMatrix, routeErrors, ordinaryRecoveryCount: ordinaryRecoveries.length,
    sourceDistribution, sourceCount: mappings.length, runtimeRequests: requests.length, runtimeExactOneTerminals: exactOne,
    permissionScenarioCount: new Set(raw.events.filter((event) => event.scenarioId.startsWith("scenario_permission_") && event.scenarioId !== "scenario_permission_prepare").map((event) => event.scenarioId)).size,
    forgetSourceCount: new Set(raw.events.filter((event) => /^scenario_forget_[123](?:_|$)/.test(event.scenarioId)).map((event) => event.scenarioId.match(/^scenario_forget_[123]/)[0])).size,
    durableForgetTriggers: durableErrors.length, durableForgetRecoveries: durableRecoveries.length,
    faultTypes, screenshotWidths: widths, screenshotSurfaces: surfaces,
    axe: axe ? { serious: axe.serious, critical: axe.critical, violations: axe.violations.length, artifact: structured.axe.reference } : null,
    keyboard: keyboard ? { assertionsTotal: keyboard.assertionsTotal, assertionsPassed: keyboard.assertionsPassed, traceOpenedByKeyboard: keyboard.traceOpenedByKeyboard, escapePassed: keyboard.escapePassed, focusReturnPassed: keyboard.focusReturnPassed, tabReachedInteractive: keyboard.tabReachedInteractive, reducedMotionPassed: keyboard.reducedMotionPassed, artifact: structured.keyboard.reference } : null,
    t01Regression: t01 ? { assertionsTotal: t01.assertionsTotal, assertionsPassed: t01.assertionsPassed, assertionIds: t01.assertionResults.map((item) => item.assertionId), passed: t01.passed, sourceSha256: t01.sourceSha256, artifact: structured.t01_real_chrome_regression.reference } : null,
    prerequisiteCommands: prerequisiteCommands.map(({ command, exitCode, eventId }) => ({ command, exitCode, eventId }))
  };
}

export function missingObservations(summary) {
  const missing = [];
  const add = (requirementId, numerator, denominator, observed, required, eventKinds = [], scenarioIds = []) => missing.push({ requirementId, numerator, denominator, observed, required, eventKinds, scenarioIds });
  if ((summary.entryOrigins.view_source ?? 0) < 3) add("T03-IN-01", "view_source", "trusted entry actions", summary.entryOrigins.view_source ?? 0, 3, ["background_request"]);
  if (summary.sourceCount !== 12 || summary.sourceDistribution.web !== 6 || summary.sourceDistribution.local !== 3 || summary.sourceDistribution.note !== 3) add("T03-IN-02", "registered sources", "6 web + 3 local + 3 note", summary.sourceCount, 12, ["runtime_request", "runtime_response", "command_result"]);
  if (summary.ordinaryRecoveryCount < 2) add("T03-IN-03", "ordinary recoveries", "invalid/forbidden recoveries", summary.ordinaryRecoveryCount, 2, ["route_observation", "dom_action"]);
  if (!summary.axe || summary.axe.serious !== 0 || summary.axe.critical !== 0 || !summary.keyboard || summary.keyboard.assertionsTotal !== summary.keyboard.assertionsPassed) add("T03-IN-04", "passing typed accessibility results", "Axe and Keyboard", Number(Boolean(summary.axe)) + Number(Boolean(summary.keyboard)), 2, ["command_result"]);
  const completeRoutes = Object.values(summary.routeMatrix).filter((modes) => ROUTE_MODES.every((mode) => modes[mode] >= 1)).length;
  if (completeRoutes !== 5) add("T03-IN-05", "complete route intents", "5 intents x 4 modes", completeRoutes, 5, ["route_observation"]);
  if (summary.permissionScenarioCount < 3 || summary.forgetSourceCount < 3) add("T03-IN-06", "permission and forget scenarios", "3 + 3", summary.permissionScenarioCount + summary.forgetSourceCount, 6, ["runtime_request"]);
  if (summary.faultTypes.length !== 4) add("T03-IN-07", "controlled fault types", "four fault types", summary.faultTypes.length, 4, ["fault_start", "fault_end"]);
  if (![360, 420, 768, 1280].every((width) => summary.screenshotWidths[width] >= 1)) add("T03-IN-08", "product viewport widths", "360/420/768/1280", Object.keys(summary.screenshotWidths).length, 4, ["screenshot"]);
  if (summary.durableForgetTriggers !== 12 || summary.durableForgetRecoveries !== 12) add("T03-IN-09", "durable Forget trigger/recovery pairs", "3 sources x 4 modes", Math.min(summary.durableForgetTriggers, summary.durableForgetRecoveries), 12, ["route_observation", "dom_action"]);
  if (summary.runtimeExactOneTerminals !== summary.runtimeRequests) add("T03-IN-10", "runtime requests with exactly one terminal", "all runtime requests", summary.runtimeExactOneTerminals, summary.runtimeRequests, ["runtime_request", "runtime_response", "transport_failure"]);
  const t01AssertionIds = new Set(summary.t01Regression?.assertionIds ?? []);
  const t01Ready = summary.t01Regression?.passed === true
    && summary.t01Regression.assertionsTotal === 36
    && summary.t01Regression.assertionsPassed === 36
    && t01AssertionIds.size === 36;
  if (!t01Ready) add("T03-IN-11", "sealed passing T01 assertions", "36 unique passed assertion IDs", t01AssertionIds.size, 36, ["command_result"]);
  return missing;
}

export function deriveFacts({ runRoot, sealedRawRun, generatorImplementation, generatedAt = null }) {
  const root = path.resolve(runRoot);
  const rawPath = path.join(root, "raw/raw-run.json");
  const rawBytes = fs.readFileSync(rawPath);
  if (sealedRawRun && sha256(rawBytes) !== sealedRawRun.sha256) throw new Error("Sealed raw-run file hash mismatch.");
  const raw = JSON.parse(rawBytes.toString("utf8"));
  const rawErrors = validateRawRun(raw, { runRoot: root });
  if (rawErrors.length) throw new Error(`Raw run validation failed:\n${rawErrors.join("\n")}`);
  const structured = structuredResults(root, raw);
  const mappings = sourceMappings(root, raw, structured);
  const scenarios = deriveScenarioFacts(root, raw);
  const summary = deriveSummary(root, raw, mappings, scenarios, structured);
  const base = {
    schemaVersion: "v2-px-derived-facts/v1", evidenceClass: "production_acceptance", runId: raw.runId,
    generatedAt: generatedAt ?? raw.seal.sealedAt,
    sealedRawRun: sealedRawRun ?? { artifactRoot: "source_run", path: "raw/raw-run.json", sha256: sha256(rawBytes), byteLength: rawBytes.length, mediaType: "application/json" },
    generatorImplementation, sourceMappings: mappings, scenarioFacts: scenarios, summary
  };
  const gaps = missingObservations(summary);
  return { raw, facts: { ...base, seal: sealCanonical(base) }, gaps };
}
