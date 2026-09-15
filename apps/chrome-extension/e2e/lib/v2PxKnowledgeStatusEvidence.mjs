import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const CONTROLLED_FAULT_STATUS_POLICIES = Object.freeze({
  adapter_blocked: Object.freeze({
    faultType: "adapter_blocked",
    target: "adapter_status",
    adapterStatus: "blocked",
    dataServiceStatus: "unchecked",
    sourceBuildStatus: "unknown",
    userAction: "configure_adapter"
  }),
  data_service_unreachable: Object.freeze({
    faultType: "data_service_unreachable",
    target: "data_service_status",
    adapterStatus: "ready",
    dataServiceStatus: "unreachable",
    sourceBuildStatus: "degraded",
    userAction: "reconnect"
  }),
  source_failed: Object.freeze({
    faultType: "source_failed",
    target: "source_operation",
    adapterStatus: "ready",
    dataServiceStatus: "unchecked",
    sourceBuildStatus: "failed",
    userAction: "retry_source_build"
  })
});

export function controlledFaultStatus(faultType, observedAt) {
  const policy = CONTROLLED_FAULT_STATUS_POLICIES[faultType];
  if (!policy) throw new Error(`Unknown controlled Knowledge Status fault: ${faultType}`);
  return {
    schemaVersion: "v2-knowledge-status-draft-2026-07-10",
    observedAt,
    frontendInferredRuntimeStatus: "online",
    runtimeStatus: "online",
    adapterStatus: policy.adapterStatus,
    dataServiceStatus: policy.dataServiceStatus,
    sourceBuildStatus: policy.sourceBuildStatus,
    capabilities: {},
    userAction: policy.userAction,
    message: `controlled ${faultType}`,
    redactionApplied: true
  };
}

function isKnowledgeStatusRequest(requestEvent) {
  if (requestEvent?.kind !== "runtime_request") return false;
  try {
    return new URL(requestEvent.payload?.url).pathname === "/v1/knowledge/status";
  } catch {
    return false;
  }
}

export function parseKnowledgeStatusResponse({ requestEvent, responseEvent, responseBytes }) {
  if (!isKnowledgeStatusRequest(requestEvent)) return null;
  if (responseEvent?.kind !== "runtime_response" || responseEvent.payload?.status < 200 || responseEvent.payload?.status >= 300) return null;
  const identity = {
    scenarioId: responseEvent.scenarioId ?? requestEvent.scenarioId ?? null,
    requestEventId: requestEvent.eventId ?? null,
    responseEventId: responseEvent.eventId ?? null
  };
  let envelope;
  try {
    envelope = JSON.parse(Buffer.from(responseBytes).toString("utf8"));
  } catch (error) {
    return { error: { ...identity, code: "STATUS_RESPONSE_JSON_INVALID", path: "", message: error.message } };
  }
  if (envelope?.ok !== true || !envelope.data || typeof envelope.data !== "object" || Array.isArray(envelope.data)) {
    return { error: { ...identity, code: "STATUS_RESPONSE_ENVELOPE_INVALID", path: "", message: "Expected ok=true and an object data payload." } };
  }
  return { observation: { ...identity, value: envelope.data } };
}

export function validateKnowledgeStatusObservations({ schemaPath, observations, extractionErrors = [] }) {
  const program = [
    "import glob,json,os,sys",
    "from jsonschema import Draft202012Validator,FormatChecker,RefResolver",
    "p=json.load(sys.stdin)",
    "s=json.load(open(p['schema'],encoding='utf-8'))",
    "Draft202012Validator.check_schema(s)",
    "store={}",
    "for f in glob.glob(os.path.join(os.path.dirname(p['schema']),'*.schema.json')):",
    " d=json.load(open(f,encoding='utf-8'))",
    " if d.get('$id'): store[d['$id']]=d",
    "v=Draft202012Validator(s,resolver=RefResolver.from_schema(s,store=store),format_checker=FormatChecker())",
    "out=[]",
    "for i,x in enumerate(p['instances']):",
    " out.extend({'index':i,'message':e.message,'path':'/'.join(str(y) for y in e.absolute_path)} for e in v.iter_errors(x))",
    "print(json.dumps(out))"
  ].join("\n");
  const result = spawnSync("python3", ["-c", program], {
    input: JSON.stringify({ schema: path.resolve(schemaPath), instances: observations.map((item) => item.value) }),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(`Knowledge Status schema validator failed: ${result.stdout}${result.stderr}`);
  const schemaErrors = JSON.parse(result.stdout).map((error) => ({
    scenarioId: observations[error.index]?.scenarioId ?? null,
    requestEventId: observations[error.index]?.requestEventId ?? null,
    responseEventId: observations[error.index]?.responseEventId ?? null,
    code: "STATUS_SCHEMA_INVALID",
    path: error.path,
    message: error.message
  }));
  return {
    schemaVersion: "v2-px-knowledge-status-evidence-check/v1",
    checked: observations.length,
    errors: [...extractionErrors, ...schemaErrors]
  };
}

export function inspectKnowledgeStatusRawRun({ document, runRoot, schemaPath }) {
  const eventsById = new Map((document.events ?? []).map((event) => [event.eventId, event]));
  const artifactsByPath = new Map((document.artifacts ?? []).map((artifact) => [artifact.path, artifact]));
  const root = path.resolve(runRoot);
  const observations = [];
  const extractionErrors = [];
  for (const responseEvent of document.events ?? []) {
    if (responseEvent.kind !== "runtime_response") continue;
    const requestEvent = eventsById.get(responseEvent.payload?.requestEventId);
    if (!isKnowledgeStatusRequest(requestEvent) || responseEvent.payload?.status < 200 || responseEvent.payload?.status >= 300) continue;
    const reference = responseEvent.payload?.bodyArtifact;
    const artifact = artifactsByPath.get(reference?.path);
    const target = reference?.path ? path.resolve(root, ...reference.path.replaceAll("\\", "/").split("/")) : null;
    const identity = { scenarioId: responseEvent.scenarioId ?? null, requestEventId: requestEvent?.eventId ?? null, responseEventId: responseEvent.eventId ?? null };
    if (!artifact || artifact.sha256 !== reference?.sha256 || !target || !target.startsWith(`${root}${path.sep}`) || !fs.existsSync(target)) {
      extractionErrors.push({ ...identity, code: "STATUS_RESPONSE_ARTIFACT_INVALID", path: reference?.path ?? "", message: "Status response artifact is missing or does not match the raw index." });
      continue;
    }
    const responseBytes = fs.readFileSync(target);
    const actualSha256 = crypto.createHash("sha256").update(responseBytes).digest("hex");
    if (responseBytes.length !== artifact.byteLength || actualSha256 !== artifact.sha256) {
      extractionErrors.push({ ...identity, code: "STATUS_RESPONSE_ARTIFACT_INVALID", path: reference.path, message: "Status response artifact length or SHA-256 mismatch." });
      continue;
    }
    const parsed = parseKnowledgeStatusResponse({ requestEvent, responseEvent, responseBytes });
    if (parsed?.error) extractionErrors.push(parsed.error);
    if (parsed?.observation) observations.push(parsed.observation);
  }
  return validateKnowledgeStatusObservations({ schemaPath, observations, extractionErrors });
}

export function inspectRuntimeOfflineAuthority({ events = [], segments = [], faultInjections = null }) {
  const eventIntervals = [];
  const openIntervals = [];
  for (const event of events) {
    if (event.kind === "fault_start" && event.payload?.faultType === "runtime_offline") {
      openIntervals.push(event);
    } else if (event.kind === "fault_end" && event.payload?.faultType === "runtime_offline") {
      const start = openIntervals.shift();
      if (start) eventIntervals.push({ faultType: "runtime_offline", startSequence: start.sequence, endSequence: event.sequence });
    }
  }
  const intervals = (faultInjections ?? segments.flatMap((segment) => segment.faultInjections ?? []))
    .filter((fault) => fault.faultType === "runtime_offline");
  if (faultInjections === null && intervals.length === 0) intervals.push(...eventIntervals);
  const terminalsByRequestId = new Map();
  for (const event of events) {
    if (!["runtime_response", "transport_failure"].includes(event.kind)) continue;
    const requestEventId = event.payload?.requestEventId;
    if (!terminalsByRequestId.has(requestEventId)) terminalsByRequestId.set(requestEventId, []);
    terminalsByRequestId.get(requestEventId).push(event);
  }
  const errors = [];
  let checkedRequests = 0;
  for (const interval of intervals) {
    const requests = events.filter((event) => event.kind === "runtime_request"
      && event.sequence >= interval.startSequence && event.sequence <= interval.endSequence);
    if (requests.length === 0) {
      errors.push({
        code: "RUNTIME_OFFLINE_REQUEST_MISSING",
        startSequence: interval.startSequence,
        endSequence: interval.endSequence,
        requestEventId: null,
        terminalEventIds: []
      });
      continue;
    }
    checkedRequests += requests.length;
    for (const request of requests) {
      const terminals = terminalsByRequestId.get(request.eventId) ?? [];
      const responses = terminals.filter((event) => event.kind === "runtime_response");
      const failures = terminals.filter((event) => event.kind === "transport_failure");
      if (responses.length > 0) {
        errors.push({
          code: "RUNTIME_OFFLINE_RESPONSE_OBSERVED",
          startSequence: interval.startSequence,
          endSequence: interval.endSequence,
          requestEventId: request.eventId,
          requestSequence: request.sequence,
          terminalEventIds: terminals.map((event) => event.eventId),
          responseSequences: responses.map((event) => event.sequence)
        });
      }
      if (failures.length !== 1 || terminals.length !== 1) {
        errors.push({
          code: "RUNTIME_OFFLINE_TERMINAL_INVALID",
          startSequence: interval.startSequence,
          endSequence: interval.endSequence,
          requestEventId: request.eventId,
          requestSequence: request.sequence,
          terminalEventIds: terminals.map((event) => event.eventId),
          responseCount: responses.length,
          transportFailureCount: failures.length
        });
      }
    }
  }
  return {
    schemaVersion: "v2-px-runtime-offline-authority-check/v1",
    intervalsChecked: intervals.length,
    requestsChecked: checkedRequests,
    errors
  };
}
