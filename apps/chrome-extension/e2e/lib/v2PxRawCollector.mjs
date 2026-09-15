import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

const KNOWLEDGE_URL = /^https?:\/\/[^/]+\/v1\/knowledge(?:\/|$)/;

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON does not allow non-finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.keys(value)
      .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  throw new TypeError(`Canonical JSON cannot encode ${typeof value}.`);
}

function normalizeRelativePath(relativePath) {
  if (typeof relativePath !== "string" || !relativePath.trim()) throw new TypeError("Artifact path is required.");
  const normalized = relativePath.replaceAll("\\", "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) throw new Error(`Artifact path must be relative: ${relativePath}`);
  const clean = path.posix.normalize(normalized);
  if (clean === ".." || clean.startsWith("../") || clean.includes("/../")) throw new Error(`Artifact path escapes the run root: ${relativePath}`);
  return clean;
}

function writeAtomic(target, bytes) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  const descriptor = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(temporary, target);
}

function artifactKey(reference) {
  return `${reference.path}\0${reference.sha256}`;
}

export class V2PxRawCollector {
  #runRoot;
  #runId;
  #snapshotCommit;
  #buildIndex;
  #adapterMode;
  #collectorImplementation;
  #rawSchemaArtifact;
  #generatedAt;
  #clock;
  #monotonic;
  #uuid;
  #sequence = 0;
  #events = [];
  #artifacts = [];
  #artifactByPath = new Map();
  #segments = [];
  #segmentById = new Map();
  #activeSegmentId = null;
  #activeFaults = new Map();
  #sealed = false;

  constructor({
    runRoot,
    runId,
    snapshotCommit,
    buildIndex,
    adapterMode = "mock",
    collectorImplementation,
    rawSchemaArtifact,
    generatedAt = new Date().toISOString(),
    clock = () => new Date().toISOString(),
    monotonic = () => performance.now(),
    uuid = () => randomUUID()
  }) {
    if (!/^[a-f0-9]{40}$/.test(snapshotCommit)) throw new Error("snapshotCommit must be a 40-character lowercase Git SHA.");
    if (!runId || !runRoot) throw new Error("runId and runRoot are required.");
    if (!["mock", "data_service"].includes(adapterMode)) throw new Error(`Unsupported adapter mode: ${adapterMode}`);
    this.#runRoot = path.resolve(runRoot);
    this.#runId = runId;
    this.#snapshotCommit = snapshotCommit;
    this.#buildIndex = buildIndex;
    this.#adapterMode = adapterMode;
    this.#collectorImplementation = collectorImplementation;
    this.#rawSchemaArtifact = rawSchemaArtifact;
    this.#generatedAt = generatedAt;
    this.#clock = clock;
    this.#monotonic = monotonic;
    this.#uuid = uuid;
  }

  get runId() {
    return this.#runId;
  }

  get sealed() {
    return this.#sealed;
  }

  nextId(prefix) {
    return `${prefix}_${this.#uuid()}`;
  }

  writeArtifact({ relativePath, bytes, mediaType, visibility = "public" }) {
    this.#assertWritable();
    const cleanPath = normalizeRelativePath(relativePath);
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    if (!mediaType) throw new Error("Artifact mediaType is required.");
    if (!["public", "private_local_only"].includes(visibility)) throw new Error(`Invalid artifact visibility: ${visibility}`);
    const record = {
      path: cleanPath,
      sha256: sha256(buffer),
      mediaType,
      byteLength: buffer.length,
      visibility
    };
    const existing = this.#artifactByPath.get(cleanPath);
    if (existing) {
      if (artifactKey(existing) !== artifactKey(record) || existing.mediaType !== mediaType || existing.visibility !== visibility) {
        throw new Error(`Artifact path already contains different bytes or metadata: ${cleanPath}`);
      }
      return { path: existing.path, sha256: existing.sha256 };
    }
    writeAtomic(path.join(this.#runRoot, cleanPath), buffer);
    this.#artifactByPath.set(cleanPath, record);
    this.#artifacts.push(record);
    return { path: record.path, sha256: record.sha256 };
  }

  startSegment({ runtimePid, runtimeStartedAt, browserContextId, adapterMode = this.#adapterMode }) {
    this.#assertWritable();
    if (this.#activeSegmentId) throw new Error(`Segment ${this.#activeSegmentId} is still active.`);
    const segmentId = this.nextId("seg");
    const segment = {
      segmentId,
      runtimeSessionId: this.nextId("rts"),
      runtimePid,
      runtimeStartedAt,
      browserContextId,
      startedSequence: this.#sequence + 1,
      endedSequence: null,
      adapterMode,
      faultInjections: []
    };
    this.#segments.push(segment);
    this.#segmentById.set(segmentId, segment);
    this.#activeSegmentId = segmentId;
    return { ...segment };
  }

  endSegment(segmentId = this.#activeSegmentId) {
    this.#assertWritable();
    const segment = this.#segmentById.get(segmentId);
    if (!segment || segmentId !== this.#activeSegmentId) throw new Error(`Segment is not active: ${segmentId}`);
    if ([...this.#activeFaults.values()].some((fault) => fault.segmentId === segmentId)) throw new Error(`Segment ${segmentId} has an open fault.`);
    if (this.#sequence < segment.startedSequence) throw new Error(`Segment ${segmentId} contains no events.`);
    segment.endedSequence = this.#sequence;
    this.#activeSegmentId = null;
    return { ...segment, faultInjections: segment.faultInjections.map((item) => ({ ...item })) };
  }

  appendEvent({ scenarioId, kind, contextId, navigationId = null, actionId = null, payload, artifactRefs = [], segmentId = this.#activeSegmentId }) {
    this.#assertWritable();
    if (!segmentId || !this.#segmentById.has(segmentId)) throw new Error(`Unknown segment: ${segmentId}`);
    if (!scenarioId || !contextId || !kind || !payload) throw new Error("scenarioId, contextId, kind and payload are required.");
    const event = {
      eventId: this.nextId("evt"),
      runId: this.#runId,
      scenarioId,
      sequence: ++this.#sequence,
      observedAt: this.#clock(),
      monotonicMs: this.#monotonic(),
      segmentId,
      contextId,
      navigationId,
      actionId,
      kind,
      payload,
      artifactRefs: artifactRefs.map((reference) => ({ path: normalizeRelativePath(reference.path), sha256: reference.sha256 }))
    };
    this.#events.push(event);
    return structuredClone(event);
  }

  startFault({ scenarioId, faultType, target, contextId, navigationId = null, actionId = null }) {
    const key = `${this.#activeSegmentId}:${faultType}`;
    if (this.#activeFaults.has(key)) throw new Error(`Fault is already active: ${faultType}`);
    const event = this.appendEvent({ scenarioId, kind: "fault_start", contextId, navigationId, actionId, payload: { faultType, target } });
    this.#activeFaults.set(key, { segmentId: event.segmentId, faultType, target, startSequence: event.sequence });
    return event;
  }

  endFault({ scenarioId, faultType, target, contextId, navigationId = null, actionId = null }) {
    const key = `${this.#activeSegmentId}:${faultType}`;
    const active = this.#activeFaults.get(key);
    if (!active || active.target !== target) throw new Error(`No matching active fault: ${faultType}`);
    const event = this.appendEvent({ scenarioId, kind: "fault_end", contextId, navigationId, actionId, payload: { faultType, target } });
    const segment = this.#segmentById.get(event.segmentId);
    segment.faultInjections.push({ faultType, startSequence: active.startSequence, endSequence: event.sequence });
    segment.faultInjections.sort((left, right) => left.startSequence - right.startSequence);
    this.#activeFaults.delete(key);
    return event;
  }

  seal({ relativePath = "raw/raw-run.json" } = {}) {
    this.#assertWritable();
    if (this.#activeSegmentId) throw new Error(`Segment ${this.#activeSegmentId} must be ended before sealing.`);
    if (this.#activeFaults.size) throw new Error("All fault intervals must be closed before sealing.");
    const payload = {
      schemaVersion: "v2-px-raw-run/v2",
      runId: this.#runId,
      evidenceClass: "production_acceptance",
      acceptanceProfile: "px5_r2_production_collection",
      generatedAt: this.#generatedAt,
      snapshotCommit: this.#snapshotCommit,
      buildIndex: this.#buildIndex,
      collectorImplementation: this.#collectorImplementation,
      rawSchemaArtifact: this.#rawSchemaArtifact,
      adapterMode: this.#adapterMode,
      segments: this.#segments.map((segment) => ({ ...segment, faultInjections: segment.faultInjections.map((fault) => ({ ...fault })) })),
      events: structuredClone(this.#events),
      artifacts: structuredClone(this.#artifacts)
    };
    const seal = {
      sealedAt: this.#clock(),
      algorithm: "sha256",
      inputMode: "canonical_json_without_seal_v1",
      contentSha256: sha256(Buffer.from(canonicalJson(payload), "utf8")),
      eventCount: payload.events.length,
      artifactCount: payload.artifacts.length
    };
    const document = { ...payload, seal };
    const errors = validateRawRun(document, { runRoot: this.#runRoot });
    if (errors.length) throw new Error(`Raw run invariant failure:\n${errors.join("\n")}`);
    const cleanPath = normalizeRelativePath(relativePath);
    writeAtomic(path.join(this.#runRoot, cleanPath), Buffer.from(`${JSON.stringify(document, null, 2)}\n`, "utf8"));
    this.#sealed = true;
    return { document, path: cleanPath, sha256: sha256(fs.readFileSync(path.join(this.#runRoot, cleanPath))) };
  }

  #assertWritable() {
    if (this.#sealed) throw new Error("Raw run is sealed and cannot be modified.");
  }
}

export function validateRawRun(document, { runRoot = null } = {}) {
  const errors = [];
  const events = Array.isArray(document?.events) ? document.events : [];
  const artifacts = Array.isArray(document?.artifacts) ? document.artifacts : [];
  const segments = Array.isArray(document?.segments) ? document.segments : [];
  if (document?.seal?.eventCount !== events.length) errors.push("seal.eventCount does not equal events.length");
  if (document?.seal?.artifactCount !== artifacts.length) errors.push("seal.artifactCount does not equal artifacts.length");
  if (document?.seal?.contentSha256) {
    const { seal: _seal, ...payload } = document;
    if (sha256(Buffer.from(canonicalJson(payload), "utf8")) !== document.seal.contentSha256) errors.push("seal.contentSha256 mismatch");
  }

  const artifactByPath = new Map(artifacts.map((artifact) => [artifact.path, artifact]));
  for (const [name, reference] of [
    ["buildIndex", document?.buildIndex],
    ["collectorImplementation", document?.collectorImplementation],
    ["rawSchemaArtifact", document?.rawSchemaArtifact]
  ]) {
    const artifact = artifactByPath.get(reference?.path);
    if (!artifact || artifact.sha256 !== reference?.sha256) errors.push(`${name} references an unknown artifact`);
  }
  if (runRoot) {
    for (const artifact of artifacts) {
      const absolutePath = path.join(path.resolve(runRoot), normalizeRelativePath(artifact.path));
      if (!fs.existsSync(absolutePath)) {
        errors.push(`artifact ${artifact.path} is missing from disk`);
        continue;
      }
      const bytes = fs.readFileSync(absolutePath);
      if (bytes.length !== artifact.byteLength) errors.push(`artifact ${artifact.path} byteLength mismatch`);
      if (sha256(bytes) !== artifact.sha256) errors.push(`artifact ${artifact.path} sha256 mismatch`);
    }
  }
  const eventById = new Map();
  let previousMonotonic = -1;
  for (const [index, event] of events.entries()) {
    if (event.runId !== document.runId) errors.push(`event ${event.eventId} has a different runId`);
    if (event.sequence !== index + 1) errors.push(`event ${event.eventId} sequence is not contiguous`);
    if (event.monotonicMs < previousMonotonic) errors.push(`event ${event.eventId} monotonicMs moved backwards`);
    previousMonotonic = event.monotonicMs;
    if (eventById.has(event.eventId)) errors.push(`duplicate eventId ${event.eventId}`);
    eventById.set(event.eventId, event);
    for (const reference of event.artifactRefs ?? []) {
      const artifact = artifactByPath.get(reference.path);
      if (!artifact || artifact.sha256 !== reference.sha256) errors.push(`event ${event.eventId} references an unknown artifact`);
    }
  }

  const segmentById = new Map();
  const faultSequences = new Set();
  let expectedSegmentStart = 1;
  for (const segment of segments) {
    if (segmentById.has(segment.segmentId)) errors.push(`duplicate segmentId ${segment.segmentId}`);
    segmentById.set(segment.segmentId, segment);
    if (segment.startedSequence !== expectedSegmentStart) errors.push(`segment ${segment.segmentId} does not start after the previous segment`);
    if (segment.startedSequence > segment.endedSequence) errors.push(`segment ${segment.segmentId} has an invalid sequence range`);
    expectedSegmentStart = segment.endedSequence + 1;
    let previousEnd = 0;
    for (const fault of segment.faultInjections ?? []) {
      if (fault.startSequence <= previousEnd || fault.startSequence >= fault.endSequence) errors.push(`segment ${segment.segmentId} has invalid or overlapping fault intervals`);
      previousEnd = fault.endSequence;
      const start = events[fault.startSequence - 1];
      const end = events[fault.endSequence - 1];
      if (start?.kind !== "fault_start" || end?.kind !== "fault_end" || start.segmentId !== segment.segmentId || end.segmentId !== segment.segmentId || start.payload?.faultType !== fault.faultType || end.payload?.faultType !== fault.faultType || start.payload?.target !== end.payload?.target) {
        errors.push(`segment ${segment.segmentId} fault interval does not match fault events`);
      }
      faultSequences.add(fault.startSequence);
      faultSequences.add(fault.endSequence);
    }
  }
  if (expectedSegmentStart !== events.length + 1) errors.push("segments do not cover the complete event sequence");

  const terminalEventsByRequestId = new Map();
  for (const event of events) {
    if (!["background_response", "runtime_response", "transport_failure"].includes(event.kind)) continue;
    const requestEventId = event.payload?.requestEventId;
    if (!terminalEventsByRequestId.has(requestEventId)) terminalEventsByRequestId.set(requestEventId, []);
    terminalEventsByRequestId.get(requestEventId).push(event);
  }

  for (const event of events) {
    const segment = segmentById.get(event.segmentId);
    if (!segment || event.sequence < segment.startedSequence || event.sequence > segment.endedSequence) errors.push(`event ${event.eventId} is outside its segment`);
    if (event.kind === "dom_action" && event.payload?.isTrusted !== true) errors.push(`dom_action ${event.eventId} is not trusted`);
    if (event.kind === "background_request") {
      const action = events.find((candidate) => candidate.kind === "dom_action" && candidate.actionId === event.actionId && candidate.sequence < event.sequence);
      if (!action) errors.push(`background_request ${event.eventId} has no trusted dom_action`);
    }
    if (["background_request", "runtime_request"].includes(event.kind)) {
      const expectedKinds = event.kind === "background_request" ? new Set(["background_response"]) : new Set(["runtime_response", "transport_failure"]);
      const terminalEvents = (terminalEventsByRequestId.get(event.eventId) ?? []).filter((candidate) => expectedKinds.has(candidate.kind));
      if (terminalEvents.length !== 1) errors.push(`${event.kind} ${event.eventId} must have exactly one terminal outcome; found ${terminalEvents.length}`);
    }
    if (["background_response", "runtime_response", "transport_failure"].includes(event.kind)) {
      const request = eventById.get(event.payload?.requestEventId);
      const expectedKind = event.kind === "background_response" ? "background_request" : "runtime_request";
      if (!request || request.kind !== expectedKind || request.segmentId !== event.segmentId) errors.push(`${event.kind} ${event.eventId} has an invalid requestEventId`);
      if (request && (request.navigationId !== event.navigationId || request.actionId !== event.actionId)) errors.push(`${event.kind} ${event.eventId} does not match request navigation/action`);
      if (event.kind === "background_response" && request?.payload?.message?.requestId !== event.payload?.message?.requestId) errors.push(`background_response ${event.eventId} has a different requestId`);
    }
    if (event.kind === "runtime_request" && KNOWLEDGE_URL.test(event.payload?.url ?? "") && !event.payload?.requestId) errors.push(`knowledge request ${event.eventId} has no requestId`);
    if (event.kind === "runtime_request" && event.payload?.bodyArtifact) {
      const artifact = artifactByPath.get(event.payload.bodyArtifact.path);
      if (!artifact || artifact.sha256 !== event.payload.bodyArtifact.sha256 || !(event.artifactRefs ?? []).some((reference) => reference.path === event.payload.bodyArtifact.path && reference.sha256 === event.payload.bodyArtifact.sha256)) errors.push(`runtime_request ${event.eventId} has an invalid body artifact`);
    }
    if (event.kind === "runtime_response") {
      const artifact = artifactByPath.get(event.payload?.bodyArtifact?.path);
      if (!artifact || artifact.sha256 !== event.payload?.bodyArtifact?.sha256 || !(event.artifactRefs ?? []).some((reference) => reference.path === event.payload?.bodyArtifact?.path && reference.sha256 === event.payload?.bodyArtifact?.sha256)) errors.push(`runtime_response ${event.eventId} has an invalid body artifact`);
    }
    if (["fault_start", "fault_end"].includes(event.kind) && !faultSequences.has(event.sequence)) errors.push(`${event.kind} ${event.eventId} is not represented by a segment fault interval`);
    if (["route_observation", "container_observation"].includes(event.kind)) {
      for (const authorityId of event.payload?.authorityEventIds ?? []) {
        const authority = eventById.get(authorityId);
        if (!authority || !["runtime_response", "transport_failure"].includes(authority.kind) || authority.segmentId !== event.segmentId || authority.navigationId !== event.navigationId || authority.sequence >= event.sequence) {
          errors.push(`${event.kind} ${event.eventId} has an invalid authority reference`);
        }
      }
    }
    if (event.kind === "screenshot") {
      const observationKinds = (event.payload?.observationEventIds ?? []).map((eventId) => eventById.get(eventId)?.kind);
      if (!observationKinds.includes("route_observation") || !observationKinds.includes("container_observation")) errors.push(`screenshot ${event.eventId} is missing route/container observations`);
      for (const observationId of event.payload?.observationEventIds ?? []) {
        const observation = eventById.get(observationId);
        if (!observation || observation.segmentId !== event.segmentId || observation.navigationId !== event.navigationId || observation.sequence >= event.sequence) errors.push(`screenshot ${event.eventId} has an invalid observation reference`);
      }
      for (const reference of [event.payload?.imageArtifact, event.payload?.metadataArtifact]) {
        const artifact = artifactByPath.get(reference?.path);
        if (!artifact || artifact.sha256 !== reference.sha256) errors.push(`screenshot ${event.eventId} has a missing image or metadata artifact`);
      }
    }
    if (event.kind === "command_result" && event.payload?.exitCode == null && event.payload?.signal == null) errors.push(`command_result ${event.eventId} has no terminal result`);
  }
  return [...new Set(errors)];
}

export function scanPublicArtifacts({ runRoot, artifacts, secrets = [], privatePathValues = [] }) {
  const hits = [];
  const secretBuffers = secrets.filter(Boolean).map((value) => Buffer.from(value));
  const pathBuffers = privatePathValues.filter(Boolean).map((value) => Buffer.from(value));
  for (const artifact of artifacts.filter((item) => item.visibility === "public")) {
    const bytes = fs.readFileSync(path.join(runRoot, normalizeRelativePath(artifact.path)));
    if (secretBuffers.some((secret) => bytes.includes(secret))) hits.push({ path: artifact.path, reason: "secret_exact_match" });
    if (pathBuffers.some((privatePath) => bytes.includes(privatePath))) hits.push({ path: artifact.path, reason: "private_path_exact_match" });
    if (/Bearer\s+[A-Za-z0-9._-]{20,}/.test(bytes.toString("utf8"))) hits.push({ path: artifact.path, reason: "bearer_shape" });
  }
  return hits;
}
