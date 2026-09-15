import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import AxeBuilder from "@axe-core/playwright";
import { V2PxRawCollector, scanPublicArtifacts, sha256, validateRawRun } from "./lib/v2PxRawCollector.mjs";
import { CONTROLLED_FAULT_STATUS_POLICIES, controlledFaultStatus, inspectRuntimeOfflineAuthority, parseKnowledgeStatusResponse, validateKnowledgeStatusObservations } from "./lib/v2PxKnowledgeStatusEvidence.mjs";
import { summarizeT01Regression } from "./lib/v2PxPrerequisiteEvidence.mjs";
import { resolveObservedRouteErrorCode } from "./lib/v2PxRouteEvidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const localExtensionBuildRoot = path.resolve(__dirname, "../chrome-mv3-unpacked");
const extensionRoot = path.resolve(process.env.NAVIA_T02_EXTENSION_ROOT || localExtensionBuildRoot);
const runId = process.env.NAVIA_T02_RUN_ID || `t02-r2-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const evidenceRoot = path.resolve(process.env.NAVIA_T02_EVIDENCE_ROOT || path.join(
  repoRoot,
  "docs/active/project/evidence/v2_external_brain_productization/px-5/t02-r2-raw-evidence/runs",
  runId
));
const infraRoot = path.join(evidenceRoot, ".infra");
const rawSchemaPath = path.join(repoRoot, "docs/active/project/contracts/v2_px_raw_run.schema.json");
const collectorPath = path.join(__dirname, "lib/v2PxRawCollector.mjs");
const workspaceId = "ws_default";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const privatePathValues = new Set();
const requestEventByRequestId = new Map();
const pendingRuntimeObservationRequestIds = new Set();
const knowledgeStatusObservations = [];
const knowledgeStatusExtractionErrors = [];
let collector = null;
let segment = null;
let currentNavigationId = null;
let previousNavigationId = null;
let browser = null;
let runtime = null;
let fixtureServer = null;
let profilePath = null;
let token = null;
let worker = null;
let sealedResult = null;
let runCompleted = false;
const secretValues = [];

const SUPPLEMENTAL_SOURCE_SPECS = [
  ...[
    "domestic-article-36kr-news",
    "domestic-article-cctv-tech",
    "domestic-article-cnblogs",
    "domestic-article-guancha-detail",
    "domestic-article-juejin"
  ].map((id) => ({
    sourceKind: "real_web",
    sourceType: "web_page",
    originRef: `docs/active/project/evidence/v1_mvp_content_quality/pages/${id}/dom-snapshot.json`,
    authorizationMode: "current_page_user_save"
  })),
  ...[
    "docs/active/project/design/v2-knowledge-maintenance-dream-cycle-adr.md",
    "docs/active/project/design/v2-external-brain-workspace-hosting-adr.md",
    "docs/active/project/design/v2-memory-personal-knowledge-lifecycle-adr.md"
  ].map((originRef) => ({
    sourceKind: "note_markdown",
    sourceType: "user_note",
    originRef,
    authorizationMode: "user_authored"
  }))
];

for (const directory of [evidenceRoot, infraRoot]) fs.mkdirSync(directory, { recursive: true });
process.env.NAVIA_T01_EVIDENCE_ROOT = infraRoot;
process.env.NAVIA_T01_HEADLESS = process.env.NAVIA_T02_HEADLESS || "0";

function writeDiagnostic(code, message, details = {}) {
  const redacted = redactPrivateValues({
    schemaVersion: "v2-px-collection-diagnostic/v1",
    runId,
    generatedAt: new Date().toISOString(),
    passed: false,
    code,
    message,
    details
  });
  fs.mkdirSync(path.join(evidenceRoot, "raw"), { recursive: true });
  fs.writeFileSync(path.join(evidenceRoot, "raw/collection-diagnostic.json"), `${JSON.stringify(redacted, null, 2)}\n`);
}

function redactPrivateValues(value) {
  let text = JSON.stringify(value);
  for (const privateValue of publicPrivateValues()) {
    text = text.replaceAll(String(privateValue), "[private-local-value]");
  }
  return JSON.parse(text);
}

function publicPrivateValues() {
  return [...new Set([
    ...privatePathValues,
    ...secretValues,
    token,
    os.homedir(),
    repoRoot,
    extensionRoot,
    evidenceRoot,
    process.env.NAVIA_T02_PROFILE_ROOT
  ].filter(Boolean).map(String))].sort((left, right) => right.length - left.length);
}

function recordKnowledgeStatusResponse(requestEvent, responseEvent, responseBytes) {
  const parsed = parseKnowledgeStatusResponse({ requestEvent, responseEvent, responseBytes });
  if (parsed?.error) knowledgeStatusExtractionErrors.push(parsed.error);
  if (parsed?.observation) knowledgeStatusObservations.push(parsed.observation);
}

function redactPublicTextBytes(bytes) {
  let text = Buffer.from(bytes).toString("utf8");
  for (const privateValue of publicPrivateValues()) text = text.replaceAll(privateValue, "[private-local-value]");
  return Buffer.from(text, "utf8");
}

function scanPublicBytes(relativePath, bytes) {
  const hits = [];
  for (const secret of secretValues.filter(Boolean)) {
    if (bytes.includes(Buffer.from(secret))) hits.push({ path: relativePath, reason: "secret_exact_match" });
  }
  for (const privateValue of publicPrivateValues()) {
    if (bytes.includes(Buffer.from(String(privateValue)))) hits.push({ path: relativePath, reason: "private_path_exact_match" });
  }
  if (/Bearer\s+[A-Za-z0-9._-]{20,}/.test(bytes.toString("utf8"))) hits.push({ path: relativePath, reason: "bearer_shape" });
  return hits;
}

function runCommand(command, args, { cwd = repoRoot, env = {}, name } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024
  });
  return {
    name: name || [command, ...args].join(" "),
    command: [command, ...args].join(" "),
    cwd,
    exitCode: result.status,
    signal: result.signal,
    stdout: result.stdout ?? Buffer.alloc(0),
    stderr: result.stderr ?? Buffer.alloc(0),
    error: result.error?.message ?? null
  };
}

function requireCommandSuccess(result) {
  if (result.exitCode !== 0 || result.signal || result.error) {
    const outputTail = (bytes) => Buffer.from(bytes ?? Buffer.alloc(0))
      .toString("utf8")
      .slice(-8_000)
      .trim();
    const stdoutTail = outputTail(result.stdout);
    const stderrTail = outputTail(result.stderr);
    throw new Error([
      `${result.name} failed: exit=${result.exitCode} signal=${result.signal ?? "none"} ${result.error ?? ""}`.trim(),
      stdoutTail ? `stdout tail:\n${stdoutTail}` : "stdout tail: <empty>",
      stderrTail ? `stderr tail:\n${stderrTail}` : "stderr tail: <empty>"
    ].join("\n"));
  }
}

function refreshCustomExtensionRoot() {
  if (extensionRoot === localExtensionBuildRoot) return;
  const targetName = path.basename(extensionRoot);
  if (path.basename(path.dirname(extensionRoot)) !== ".tmp" || !/^t02-extension-build-[A-Za-z0-9._-]+$/.test(targetName)) {
    throw new Error(`Refusing to refresh unsafe custom extension root: ${extensionRoot}`);
  }
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    fs.rmSync(extensionRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
    try {
      fs.cpSync(localExtensionBuildRoot, extensionRoot, { recursive: true });
      return;
    } catch (error) {
      if (error?.code !== "EINTR" || attempt === maxAttempts) throw error;
    }
  }
}

function collectPrerequisiteCommands() {
  if (process.env.NAVIA_T02_SKIP_PREREQUISITES === "1") return [];
  const extensionCwd = path.join(repoRoot, "apps/chrome-extension");
  const commands = [];
  const buildResult = runCommand("pnpm", ["build:e2e"], { cwd: extensionCwd, name: "fresh_extension_build" });
  requireCommandSuccess(buildResult);
  commands.push(buildResult);
  refreshCustomExtensionRoot();
  const remainingCommands = [
    ["pnpm", ["typecheck"], { cwd: extensionCwd, name: "frontend_typecheck" }],
    ["pnpm", ["test:v2-px-r2-raw-collector"], { cwd: extensionCwd, name: "raw_collector_tests" }],
    ["pnpm", ["test"], { cwd: extensionCwd, name: "frontend_full_tests" }],
    ["python3", ["-m", "pytest", "-q"], { cwd: path.join(repoRoot, "services/local-runtime"), name: "runtime_full_tests" }],
    ["node", ["e2e/chrome-v2-t01-r1-frontend.mjs"], {
      cwd: extensionCwd,
      name: "t01_real_chrome_regression",
      env: {
        NAVIA_T01_HEADLESS: "0",
        NAVIA_T01_EVIDENCE_ROOT: path.join(infraRoot, "t01-regression"),
        NAVIA_T01_PROFILE_ROOT: path.resolve(process.env.NAVIA_T02_PROFILE_ROOT || path.join(repoRoot, ".tmp/t02-browser-profiles")),
        NAVIA_T01_EXTENSION_ROOT: extensionRoot
      }
    }]
  ];
  for (const [command, args, options] of remainingCommands) {
    const result = runCommand(command, args, options);
    requireCommandSuccess(result);
    if (options.name === "t01_real_chrome_regression") {
      const t01Path = path.join(infraRoot, "t01-regression/raw/t01-real-chrome-run.json");
      const t01Bytes = fs.readFileSync(t01Path);
      result.structuredResult = summarizeT01Regression(JSON.parse(t01Bytes.toString("utf8")), sha256(t01Bytes));
    }
    commands.push(result);
  }
  return commands;
}

function buildFileIndex(root) {
  const records = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        const bytes = fs.readFileSync(absolute);
        records.push({
          path: path.relative(root, absolute).replaceAll(path.sep, "/"),
          mode: (fs.statSync(absolute).mode & 0o777).toString(8).padStart(3, "0"),
          byteLength: bytes.length,
          sha256: sha256(bytes)
        });
      }
    }
  };
  visit(root);
  return Buffer.from(`${JSON.stringify({ schemaVersion: "navia-build-index/v1", files: records }, null, 2)}\n`);
}

function createCollector() {
  const snapshotCommit = runCommand("git", ["rev-parse", "HEAD"], { name: "snapshot_commit" }).stdout.toString("utf8").trim();
  const buildIndexBytes = buildFileIndex(extensionRoot);
  const collectorBytes = fs.readFileSync(collectorPath);
  const schemaBytes = fs.readFileSync(rawSchemaPath);
  const buildIndex = { path: "input/build-index.json", sha256: sha256(buildIndexBytes) };
  const collectorImplementation = { path: "input/v2PxRawCollector.mjs", sha256: sha256(collectorBytes) };
  const rawSchemaArtifact = { path: "input/v2_px_raw_run.schema.json", sha256: sha256(schemaBytes) };
  const snapshotInputManifestBytes = Buffer.from(`${JSON.stringify({
    schemaVersion: "v2-px-snapshot-input-manifest/v1",
    snapshotCommit,
    buildIndex,
    collectorImplementation,
    rawSchemaArtifact
  }, null, 2)}\n`);
  const publicPackageManifestBytes = Buffer.from(`${JSON.stringify({
    schemaVersion: "v2-px-public-artifact-package/v1",
    authoritativeArtifactIndex: "raw/artifact-index.json",
    publicSelectionRule: "raw-run.artifacts[visibility=public]",
    privatePrefix: "private/"
  }, null, 2)}\n`);
  const instance = new V2PxRawCollector({
    runRoot: evidenceRoot,
    runId,
    snapshotCommit,
    buildIndex,
    collectorImplementation,
    rawSchemaArtifact
  });
  instance.writeArtifact({ relativePath: "input/build-index.json", bytes: buildIndexBytes, mediaType: "application/json" });
  instance.writeArtifact({ relativePath: "input/v2PxRawCollector.mjs", bytes: collectorBytes, mediaType: "text/javascript" });
  instance.writeArtifact({ relativePath: "input/v2_px_raw_run.schema.json", bytes: schemaBytes, mediaType: "application/schema+json" });
  instance.writeArtifact({ relativePath: "input/snapshot-input-manifest.json", bytes: snapshotInputManifestBytes, mediaType: "application/json" });
  instance.writeArtifact({ relativePath: "artifacts/public/manifest.json", bytes: publicPackageManifestBytes, mediaType: "application/json" });
  return instance;
}

function appendPrerequisiteResults(results) {
  for (const result of results) {
    const id = result.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const stdout = collector.writeArtifact({ relativePath: `logs/prerequisites/${id}.stdout.log`, bytes: redactPublicTextBytes(result.stdout), mediaType: "text/plain" });
    const stderr = collector.writeArtifact({ relativePath: `logs/prerequisites/${id}.stderr.log`, bytes: redactPublicTextBytes(result.stderr), mediaType: "text/plain" });
    const structuredResult = result.structuredResult
      ? collector.writeArtifact({ relativePath: `artifacts/public/structured/${id}.json`, bytes: Buffer.from(`${JSON.stringify(result.structuredResult, null, 2)}\n`, "utf8"), mediaType: "application/json" })
      : null;
    collector.appendEvent({
      scenarioId: "scenario_prerequisites",
      kind: "command_result",
      contextId: "ctx_command_prerequisites",
      payload: {
        command: result.command,
        cwd: path.relative(repoRoot, result.cwd).replaceAll(path.sep, "/") || ".",
        exitCode: result.exitCode,
        signal: result.signal,
        stdout,
        stderr,
        structuredResult
      },
      artifactRefs: [stdout, stderr, structuredResult].filter(Boolean)
    });
  }
}

function appendStructuredCommandResult({ scenarioId, command, result, passed }) {
  const id = command.replace(/[^a-zA-Z0-9_-]/g, "_");
  const structuredBytes = Buffer.from(`${JSON.stringify(result, null, 2)}\n`);
  const stdoutBytes = Buffer.from(`${JSON.stringify({ resultType: result.resultType, passed })}\n`);
  const stdout = collector.writeArtifact({ relativePath: `logs/structured/${id}.stdout.log`, bytes: stdoutBytes, mediaType: "text/plain" });
  const stderr = collector.writeArtifact({ relativePath: `logs/structured/${id}.stderr.log`, bytes: Buffer.alloc(0), mediaType: "text/plain" });
  const structuredResult = collector.writeArtifact({ relativePath: `artifacts/public/structured/${id}.json`, bytes: structuredBytes, mediaType: "application/json" });
  collector.appendEvent({
    scenarioId,
    kind: "command_result",
    contextId: "ctx_command_structured",
    payload: {
      command,
      cwd: "apps/chrome-extension",
      exitCode: passed ? 0 : 1,
      signal: null,
      stdout,
      stderr,
      structuredResult
    },
    artifactRefs: [stdout, stderr, structuredResult]
  });
  return structuredResult;
}

async function drainR2Observations({ scenarioId, navigationId = currentNavigationId, actionId = null } = {}) {
  await wait(150);
  const observations = await worker.evaluate(() => globalThis.__naviaE2EDrainR2Observations?.() ?? []);
  const appended = [];
  for (const observation of observations) {
    if (observation.kind === "dom_action") {
      appended.push(collector.appendEvent({
        scenarioId,
        kind: "dom_action",
        contextId: "ctx_side_panel_native",
        navigationId,
        actionId: observation.actionId,
        payload: {
          isTrusted: observation.isTrusted,
          eventType: observation.eventType,
          target: observation.target,
          url: observation.priorPath,
          priorPath: observation.priorPath ?? null
        }
      }));
      continue;
    }
    if (observation.kind === "background_request") {
      const event = collector.appendEvent({
        scenarioId,
        kind: "background_request",
        contextId: "ctx_background",
        navigationId,
        actionId: observation.actionId ?? actionId,
        payload: { message: observation.message }
      });
      requestEventByRequestId.set(`background:${observation.requestId}`, event);
      appended.push(event);
      continue;
    }
    if (observation.kind === "background_response") {
      const request = requestEventByRequestId.get(`background:${observation.requestId}`);
      appended.push(collector.appendEvent({
        scenarioId,
        kind: "background_response",
        contextId: "ctx_background",
        navigationId,
        actionId: observation.actionId ?? actionId,
        payload: { requestEventId: request?.eventId ?? "missing_background_request", message: observation.response }
      }));
      continue;
    }
    if (observation.kind !== "runtime_transport" || !observation.observation) continue;
    const transport = observation.observation;
    const requestKey = `runtime:${transport.requestId}`;
    if (transport.phase === "request") {
      if (!String(transport.url ?? "").includes("/v1/knowledge/")) continue;
      const bodyBytes = transport.bodyBase64 ? Buffer.from(transport.bodyBase64, "base64") : Buffer.alloc(0);
      const visibility = transport.containsPrivatePath ? "private_local_only" : "public";
      const bodyArtifact = collector.writeArtifact({
        relativePath: `${visibility === "public" ? "artifacts/public" : "private"}/runtime/${transport.requestId}-request.bin`,
        bytes: bodyBytes,
        mediaType: transport.contentType || "application/octet-stream",
        visibility
      });
      const event = collector.appendEvent({
        scenarioId,
        kind: "runtime_request",
        contextId: "ctx_runtime_transport",
        navigationId,
        actionId,
        payload: { method: transport.method, url: transport.url, requestId: transport.requestId, bodyArtifact },
        artifactRefs: [bodyArtifact]
      });
      requestEventByRequestId.set(requestKey, event);
      pendingRuntimeObservationRequestIds.add(requestKey);
      appended.push(event);
      continue;
    }
    const request = requestEventByRequestId.get(requestKey);
    if (!request) continue;
    if (transport.phase === "response") {
      const bodyBytes = Buffer.from(transport.bodyBase64, "base64");
      const bodyArtifact = collector.writeArtifact({
        relativePath: `artifacts/public/runtime/${transport.requestId}-response.bin`,
        bytes: bodyBytes,
        mediaType: transport.contentType || "application/octet-stream"
      });
      const responseEvent = collector.appendEvent({
        scenarioId,
        kind: "runtime_response",
        contextId: "ctx_runtime_transport",
        navigationId,
        actionId,
        payload: { requestEventId: request?.eventId ?? "missing_runtime_request", status: transport.status, bodyArtifact, contentType: transport.contentType || "application/octet-stream" },
        artifactRefs: [bodyArtifact]
      });
      appended.push(responseEvent);
      recordKnowledgeStatusResponse(request, responseEvent, bodyBytes);
      pendingRuntimeObservationRequestIds.delete(requestKey);
    } else if (transport.phase === "transport_failure") {
      appended.push(collector.appendEvent({
        scenarioId,
        kind: "transport_failure",
        contextId: "ctx_runtime_transport",
        navigationId,
        actionId,
        payload: { requestEventId: request?.eventId ?? "missing_runtime_request", errorCode: "RUNTIME_TRANSPORT_FAILED" }
      }));
      pendingRuntimeObservationRequestIds.delete(requestKey);
    }
  }
  return appended;
}

async function drainR2ObservationsUntilSettled(options = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const deadline = Date.now() + timeoutMs;
  const appended = [];
  let quietCycles = 0;
  while (Date.now() < deadline) {
    const batch = await drainR2Observations(options);
    appended.push(...batch);
    if (pendingRuntimeObservationRequestIds.size === 0 && batch.length === 0) quietCycles += 1;
    else quietCycles = 0;
    if (quietCycles >= 2) return appended;
    await wait(100);
  }
  const pending = [...pendingRuntimeObservationRequestIds].map((requestKey) => {
    const event = requestEventByRequestId.get(requestKey);
    return {
      requestKey,
      eventId: event?.eventId ?? null,
      scenarioId: event?.scenarioId ?? null,
      url: event?.payload?.url ?? null,
      segmentId: event?.segmentId ?? null,
      navigationId: event?.navigationId ?? null,
      actionId: event?.actionId ?? null
    };
  });
  throw new Error(`Runtime observation queue did not settle: ${JSON.stringify(pending)}`);
}

function startNavigation(scenarioId, url, mode) {
  previousNavigationId = currentNavigationId;
  currentNavigationId = collector.nextId("nav");
  collector.appendEvent({
    scenarioId,
    kind: "navigation_start",
    contextId: "ctx_navigation",
    navigationId: currentNavigationId,
    payload: { url, mode, priorNavigationId: previousNavigationId }
  });
  return currentNavigationId;
}

async function browserRuntimeRequest(page, { scenarioId, navigationId = currentNavigationId, actionId = null, requestPath, method = "GET", body = null, privateBody = false, headers = {} }) {
  const requestId = `req_${crypto.randomUUID().replace(/-/g, "")}`;
  const requestBytes = body === null ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
  const visibility = privateBody ? "private_local_only" : "public";
  const bodyArtifact = collector.writeArtifact({
    relativePath: `${visibility === "public" ? "artifacts/public" : "private"}/runtime/${requestId}-request.bin`,
    bytes: requestBytes,
    mediaType: body === null ? "application/octet-stream" : "application/json",
    visibility
  });
  const requestEvent = collector.appendEvent({
    scenarioId,
    kind: "runtime_request",
    contextId: "ctx_runtime_transport",
    navigationId,
    actionId,
    payload: { method, url: `http://127.0.0.1:17861${requestPath}`, requestId, bodyArtifact },
    artifactRefs: [bodyArtifact]
  });
  try {
    const result = await page.evaluate(async ({ requestPath: urlPath, method: requestMethod, requestId: id, bodyText, sessionToken, extraHeaders }) => {
      const response = await fetch(`http://127.0.0.1:17861${urlPath}`, {
        method: requestMethod,
        headers: {
          "X-Request-ID": id,
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
          ...(bodyText ? { "Content-Type": "application/json" } : {}),
          ...extraHeaders
        },
        body: bodyText || undefined
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      return { status: response.status, contentType: response.headers.get("content-type") || "application/octet-stream", bodyBase64: btoa(binary) };
    }, { requestPath, method, requestId, bodyText: requestBytes.length ? requestBytes.toString("utf8") : "", sessionToken: token, extraHeaders: headers });
    const responseBytes = Buffer.from(result.bodyBase64, "base64");
    const responseArtifact = collector.writeArtifact({
      relativePath: `artifacts/public/runtime/${requestId}-response.bin`,
      bytes: responseBytes,
      mediaType: result.contentType
    });
    const responseEvent = collector.appendEvent({
      scenarioId,
      kind: "runtime_response",
      contextId: "ctx_runtime_transport",
      navigationId,
      actionId,
      payload: { requestEventId: requestEvent.eventId, status: result.status, bodyArtifact: responseArtifact, contentType: result.contentType },
      artifactRefs: [responseArtifact]
    });
    recordKnowledgeStatusResponse(requestEvent, responseEvent, responseBytes);
    let parsed = null;
    try { parsed = JSON.parse(responseBytes.toString("utf8")); } catch { parsed = null; }
    return { requestEvent, responseEvent, status: result.status, body: parsed };
  } catch (error) {
    const failureEvent = collector.appendEvent({
      scenarioId,
      kind: "transport_failure",
      contextId: "ctx_runtime_transport",
      navigationId,
      actionId,
      payload: { requestEventId: requestEvent.eventId, errorCode: "RUNTIME_TRANSPORT_FAILED" }
    });
    return { requestEvent, failureEvent, status: null, body: null, error };
  }
}

async function observeRoute(page, { scenarioId, mode, actionId = null, expectedSourceId = null, expectedErrorCode = null, surface = "workspace_page" }) {
  const url = page.url();
  const parsed = new URL(url);
  const routeError = page.locator("[data-testid='workspace-route-error'] .route-error-code");
  const observedErrorText = await routeError.count() ? await routeError.textContent() : null;
  const errorCode = resolveObservedRouteErrorCode(observedErrorText, expectedErrorCode);
  const routeSourceId = parsed.hash.match(/^#\/knowledge\/sources\/([^?]+)/)?.[1] ?? null;
  const observedWorkspaceId = new URLSearchParams(parsed.hash.split("?")[1] || "").get("workspaceId") || workspaceId;
  const authorityPath = routeSourceId
    ? `/v1/knowledge/sources/${routeSourceId}`
    : parsed.hash.startsWith("#/knowledge/graph")
      ? `/v1/knowledge/graph?workspaceId=${observedWorkspaceId}`
      : parsed.hash.startsWith("#/knowledge/settings/permissions")
        ? `/v1/knowledge/permissions?workspaceId=${observedWorkspaceId}`
        : `/v1/knowledge/sources?workspaceId=${observedWorkspaceId}`;
  const authority = await browserRuntimeRequest(page, { scenarioId, actionId, requestPath: authorityPath });
  const authorityEvent = authority.responseEvent ?? authority.failureEvent;
  const ids = {
    status: authorityEvent ? "observed" : "unavailable",
    workspaceId: observedWorkspaceId,
    ...((routeSourceId || expectedSourceId) ? { sourceId: routeSourceId || expectedSourceId } : {})
  };
  const routeEvent = collector.appendEvent({
    scenarioId,
    kind: "route_observation",
    contextId: "ctx_workspace_page",
    navigationId: currentNavigationId,
    actionId,
    payload: { url, mode, ...(errorCode ? { errorCode } : {}), ids, authorityEventIds: authorityEvent ? [authorityEvent.eventId] : [] }
  });
  const containerEvent = collector.appendEvent({
    scenarioId,
    kind: "container_observation",
    contextId: surface === "side_panel" ? "ctx_side_panel_native" : "ctx_workspace_page",
    navigationId: currentNavigationId,
    actionId,
    payload: { surface, ids, authorityEventIds: authorityEvent ? [authorityEvent.eventId] : [] }
  });
  return { authority, routeEvent, containerEvent, ids, errorCode };
}

async function recoverRouteToSourceLibrary(page, { scenarioId, expectedSourceId }) {
  const priorPath = page.url();
  const actionId = collector.nextId("act");
  const observedClick = page.evaluate(() => new Promise((resolve, reject) => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "返回来源库");
    if (!button) {
      reject(new Error("Recovery button is missing."));
      return;
    }
    button.addEventListener("click", (event) => resolve({ isTrusted: event.isTrusted, target: "button:返回来源库" }), { once: true });
  }));
  await page.getByRole("button", { name: "返回来源库", exact: true }).click();
  const click = await observedClick;
  if (!click?.isTrusted) throw new Error(`Forgotten source recovery was not a trusted browser click: ${expectedSourceId}`);
  collector.appendEvent({
    scenarioId,
    kind: "dom_action",
    contextId: "ctx_workspace_page",
    navigationId: currentNavigationId,
    actionId,
    payload: { isTrusted: true, eventType: "click", target: click.target, url: priorPath, priorPath }
  });
  await page.locator("[data-testid='route-source-library']").waitFor({ timeout: 15_000 });
  const recovered = await observeRoute(page, { scenarioId, mode: "recovery", actionId });
  const expectedUrl = `chrome-extension://${new URL(page.url()).host}/workspace.html#/knowledge/sources?workspaceId=${workspaceId}`;
  if (page.url() !== expectedUrl || recovered.ids.workspaceId !== workspaceId || recovered.ids.sourceId) {
    throw new Error(`Forgotten source recovered to an unexpected route: ${page.url()}`);
  }
  const recoveredSources = recovered.authority.body?.data?.sources;
  if (!Array.isArray(recoveredSources) || recoveredSources.some((item) => item.sourceId === expectedSourceId)) {
    throw new Error(`Forgotten source is present after Source Library recovery: ${expectedSourceId}`);
  }
  return { actionId, recovered };
}

async function capturePage(page, { scenarioId, name, surface, observationEvents, actionId = null }) {
  const bytes = await page.screenshot({ fullPage: false, type: "png" });
  const decoded = PNG.sync.read(bytes);
  const imageArtifact = collector.writeArtifact({ relativePath: `screenshots/${name}.png`, bytes, mediaType: "image/png" });
  const metadataBytes = Buffer.from(`${JSON.stringify({
    imagePath: imageArtifact.path,
    imageSha256: imageArtifact.sha256,
    decodedWidth: decoded.width,
    decodedHeight: decoded.height,
    viewport: page.viewportSize(),
    url: page.url(),
    surface,
    capturedAt: new Date().toISOString()
  }, null, 2)}\n`);
  const metadataArtifact = collector.writeArtifact({ relativePath: `screenshot-metadata/${name}.json`, bytes: metadataBytes, mediaType: "application/json" });
  collector.appendEvent({
    scenarioId,
    kind: "screenshot",
    contextId: surface === "side_panel" ? "ctx_side_panel_native" : "ctx_workspace_page",
    navigationId: currentNavigationId,
    actionId,
    payload: { surface, imageArtifact, metadataArtifact, observationEventIds: observationEvents.map((event) => event.eventId) },
    artifactRefs: [imageArtifact, metadataArtifact]
  });
}

class RawCdpTarget {
  constructor(socket) {
    this.socket = socket;
    this.nextMessageId = 0;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  static async connect(port, urlFragment, timeoutMs = 15_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const target = targets
        .filter((item) => String(item.url).includes(urlFragment) && item.webSocketDebuggerUrl)
        .sort((left, right) => Number(String(right.url).includes("naviaE2ETabId=")) - Number(String(left.url).includes("naviaE2ETabId=")))[0];
      if (target) {
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          socket.addEventListener("open", resolve, { once: true });
          socket.addEventListener("error", reject, { once: true });
        });
        return new RawCdpTarget(socket);
      }
      await wait(200);
    }
    throw new Error(`CDP target not found: ${urlFragment}`);
  }

  send(method, params = {}) {
    const id = ++this.nextMessageId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "CDP evaluation failed");
    return response.result?.value;
  }

  async clickTestId(testId) {
    const point = await this.evaluate(`(async () => { const element = document.querySelector(${JSON.stringify(`[data-testid='${testId}']`)}); if (!element) return { missing: true, href: location.href, title: document.title, testIds: [...document.querySelectorAll('[data-testid]')].map((node) => node.getAttribute('data-testid')).filter(Boolean) }; element.scrollIntoView({ block: "center", inline: "nearest" }); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); const rect = element.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, disabled: Boolean(element.disabled), width: innerWidth, height: innerHeight, href: location.href }; })()`);
    if (!point || point.missing || point.disabled) throw new Error(`Native Side Panel target is unavailable or disabled: ${testId} ${JSON.stringify(point)}`);
    if (point.x < 0 || point.y < 0 || point.x > point.width || point.y > point.height) {
      throw new Error(`Native Side Panel target is outside the viewport: ${testId} ${JSON.stringify(point)}`);
    }
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
    return point;
  }

  close() {
    this.socket.close();
  }
}

function windowsPath(filePath) {
  const result = spawnSync("wslpath", ["-w", filePath], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`wslpath failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function windowsChromeCommand(profilePath, commands) {
  const profileName = path.basename(profilePath).replaceAll("'", "''");
  const script = [
    "Add-Type -AssemblyName System.Drawing",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaR2Native { [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left; public int Top; public int Right; public int Bottom; } [DllImport(\"user32.dll\")] public static extern bool SetProcessDPIAware(); [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr hWnd, out Rect rect); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int command); [DllImport(\"user32.dll\")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags); [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int X, int Y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo); }'",
    "$null=[NaviaR2Native]::SetProcessDPIAware()",
    `$profileName='${profileName}'`,
    "$processInfo=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profileName) -and -not $_.CommandLine.Contains('--type=') } | Select-Object -First 1",
    "if (-not $processInfo) { throw 'R2 Chrome main process not found' }",
    "$process=Get-Process -Id $processInfo.ProcessId",
    "$handle=$process.MainWindowHandle",
    "$null=[NaviaR2Native]::ShowWindow($handle,9)",
    "$null=[NaviaR2Native]::SetWindowPos($handle,[IntPtr](-1),0,0,0,0,0x0003)",
    "$rect=New-Object NaviaR2Native+Rect",
    "if ($handle -eq 0 -or -not [NaviaR2Native]::GetWindowRect($handle,[ref]$rect)) { throw 'R2 Chrome bounds unavailable' }",
    "$null=[NaviaR2Native]::SetForegroundWindow($handle)",
    ...commands,
    "$null=[NaviaR2Native]::SetWindowPos($handle,[IntPtr](-2),0,0,0,0,0x0003)"
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Windows Chrome command failed");
  return result.stdout.trim();
}

async function resizeNativeSidePanel(target, desiredWidth) {
  const splitterInsets = [60, 56, 64, 52, 68, 48, 72, 44, 76, 40, 80, 36, 84, 32, 88, 28, 92, 24, 96, 20, 100];
  for (const splitterInset of splitterInsets) {
    for (let correction = 0; correction < 3; correction += 1) {
      const viewport = await target.evaluate("({ width: innerWidth, scale: devicePixelRatio || 1 })");
      const currentWidth = Number(viewport.width);
      const scale = Number(viewport.scale);
      if (currentWidth === desiredWidth) return currentWidth;
      windowsChromeCommand(profilePath, [
        `$current=${currentWidth}`,
        `$desired=${desiredWidth}`,
        `$scale=${scale}`,
        `$splitterInset=${splitterInset}`,
        "$startX=$rect.Right-[Math]::Round($current*$scale)-$splitterInset",
        "$endX=$startX+[Math]::Round(($current-$desired)*$scale)",
        "$y=$rect.Top+420",
        "$null=[NaviaR2Native]::SetCursorPos($startX,$y)",
        "Start-Sleep -Milliseconds 180",
        "[NaviaR2Native]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero)",
        "Start-Sleep -Milliseconds 120",
        "$null=[NaviaR2Native]::SetCursorPos($endX,$y)",
        "Start-Sleep -Milliseconds 180",
        "[NaviaR2Native]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero)"
      ]);
      await wait(650);
      const resizedWidth = Number(await target.evaluate("innerWidth"));
      if (resizedWidth === desiredWidth) return resizedWidth;
      if (resizedWidth === currentWidth) break;
    }
  }
  const actual = Number(await target.evaluate("innerWidth"));
  if (actual !== desiredWidth) throw new Error(`Native Side Panel width is ${actual}, expected ${desiredWidth}.`);
  return actual;
}

function captureNativeChrome(name, panelViewport) {
  const temporaryRoot = path.join(infraRoot, "native-captures");
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const temporary = path.join(temporaryRoot, `${runId}-${name}.png`);
  const target = windowsPath(temporary).replaceAll("'", "''");
  windowsChromeCommand(profilePath, [
    "Start-Sleep -Milliseconds 250",
    "$width=$rect.Right-$rect.Left",
    "$height=$rect.Bottom-$rect.Top",
    "$bitmap=New-Object System.Drawing.Bitmap $width,$height",
    "$graphics=[System.Drawing.Graphics]::FromImage($bitmap)",
    "$graphics.CopyFromScreen($rect.Left,$rect.Top,0,0,$bitmap.Size)",
    `$bitmap.Save('${target}',[System.Drawing.Imaging.ImageFormat]::Png)`,
    "$graphics.Dispose()",
    "$bitmap.Dispose()"
  ]);
  const bytes = fs.readFileSync(temporary);
  fs.rmSync(temporary, { force: true });
  const decoded = PNG.sync.read(bytes);
  return { bytes, decoded, panelViewport };
}

async function captureNativeSidePanel({ scenarioId, name, target, observationEvents }) {
  const panelViewport = {
    width: Number(await target.evaluate("innerWidth")),
    height: Number(await target.evaluate("innerHeight"))
  };
  const capture = captureNativeChrome(name, panelViewport);
  const imageArtifact = collector.writeArtifact({ relativePath: `screenshots/${name}.png`, bytes: capture.bytes, mediaType: "image/png" });
  const metadata = Buffer.from(`${JSON.stringify({
    imagePath: imageArtifact.path,
    imageSha256: imageArtifact.sha256,
    decodedWidth: capture.decoded.width,
    decodedHeight: capture.decoded.height,
    panelViewport,
    captureSurface: "native_side_panel_with_host",
    capturedAt: new Date().toISOString()
  }, null, 2)}\n`);
  const metadataArtifact = collector.writeArtifact({ relativePath: `screenshot-metadata/${name}.json`, bytes: metadata, mediaType: "application/json" });
  collector.appendEvent({
    scenarioId,
    kind: "screenshot",
    contextId: "ctx_side_panel_native",
    navigationId: currentNavigationId,
    payload: { surface: "side_panel", imageArtifact, metadataArtifact, observationEventIds: observationEvents.map((event) => event.eventId) },
    artifactRefs: [imageArtifact, metadataArtifact]
  });
}

async function ensureWorkspaceConnected(page, connectRuntime) {
  const input = page.locator("[data-testid='local-runtime-token-input']");
  if (await input.count()) await connectRuntime(page, token);
}

async function trustedNativeEntry({ testId, origin, expectedHash, scenarioId, hostPage, context, extensionId, connectRuntime }) {
  await hostPage.bringToFront();
  await wait(500);
  await drainR2ObservationsUntilSettled({ scenarioId: `${scenarioId}_preflight`, navigationId: currentNavigationId });
  startNavigation(scenarioId, `chrome-extension://${extensionId}/workspace.html${expectedHash}`, "push");
  const target = await RawCdpTarget.connect(browser.cdpPort, "/sidepanel.html");
  await target.clickTestId(testId);
  target.close();
  let workspace = null;
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    workspace = context.pages().find((page) => page.url().startsWith(`chrome-extension://${extensionId}/workspace.html`));
    if (workspace && new URL(workspace.url()).hash === expectedHash) break;
    await wait(200);
  }
  if (!workspace || new URL(workspace.url()).hash !== expectedHash) throw new Error(`${origin} did not open ${expectedHash}`);
  const chain = await drainR2ObservationsUntilSettled({ scenarioId, navigationId: currentNavigationId });
  const action = chain.find((event) => event.kind === "dom_action" && event.payload.target.includes(testId));
  const backgroundRequest = chain.find((event) => event.kind === "background_request" && event.actionId === action?.actionId);
  const backgroundResponse = chain.find((event) => event.kind === "background_response" && event.actionId === action?.actionId);
  if (!action || !backgroundRequest || !backgroundResponse) throw new Error(`${origin} is missing trusted DOM/background causality.`);
  await ensureWorkspaceConnected(workspace, connectRuntime);
  const route = await observeRoute(workspace, { scenarioId, mode: "push", actionId: action.actionId });
  return { workspace, action, backgroundRequest, backgroundResponse, route };
}

async function collectSupplementalSources(page, { fixtureUrl, sourceId, operationId }) {
  const samples = [];
  const fixtureBytes = Buffer.from(await fetch(fixtureUrl).then((response) => response.arrayBuffer()));
  const currentArtifact = collector.writeArtifact({
    relativePath: "artifacts/public/corpus/sample_01-host-page.html",
    bytes: fixtureBytes,
    mediaType: "text/html"
  });
  samples.push({
    sourceSampleId: "sample_01",
    sourceKind: "real_web",
    sourceType: "web_page",
    authorizationMode: "current_page_user_save",
    originRef: new URL(fixtureUrl).pathname,
    contentArtifact: currentArtifact,
    contentFingerprint: sha256(fixtureBytes),
    sourceId,
    operationId
  });

  for (const [index, spec] of SUPPLEMENTAL_SOURCE_SPECS.entries()) {
    const sampleNumber = index + 2;
    const sourceSampleId = `sample_${String(sampleNumber).padStart(2, "0")}`;
    const bytes = fs.readFileSync(path.join(repoRoot, spec.originRef));
    const contentFingerprint = sha256(bytes);
    const contentArtifact = collector.writeArtifact({
      relativePath: `artifacts/public/corpus/${sourceSampleId}-${path.basename(spec.originRef)}`,
      bytes,
      mediaType: spec.sourceKind === "real_web" ? "application/json" : "text/markdown"
    });
    const text = bytes.toString("utf8");
    const saved = await browserRuntimeRequest(page, {
      scenarioId: `scenario_corpus_${sourceSampleId}`,
      requestPath: "/v1/knowledge/sources",
      method: "POST",
      headers: { "Idempotency-Key": `t021-${contentFingerprint.slice(0, 32)}` },
      body: {
        candidateId: `cand_t021_${contentFingerprint.slice(0, 20)}`,
        workspaceId,
        sourceType: spec.sourceType,
        title: `T02.1 ${spec.sourceKind} ${sampleNumber}: ${path.basename(spec.originRef)}`,
        url: `navia://${spec.originRef}`,
        pageId: `page_${contentFingerprint.slice(0, 20)}`,
        createdAt: new Date().toISOString(),
        artifactIds: [contentArtifact.path],
        sourceRefs: [{
          evidenceRefId: `ev_${contentFingerprint.slice(0, 20)}`,
          sourceId: "src_pending",
          locatorType: "fallback_text",
          textQuote: text.slice(0, 360),
          status: "fallback_shown",
          fallbackText: text.slice(0, 360),
          redactionApplied: true
        }]
      }
    });
    const source = saved.body?.data?.source;
    const savedOperation = saved.body?.data?.operation;
    if (saved.status !== 202 || !source?.sourceId || !savedOperation?.operationId) {
      throw new Error(`Source corpus save failed for ${sourceSampleId}: ${JSON.stringify(saved.body)}`);
    }
    samples.push({
      sourceSampleId,
      sourceKind: spec.sourceKind,
      sourceType: spec.sourceType,
      authorizationMode: spec.authorizationMode,
      originRef: spec.originRef,
      contentArtifact,
      contentFingerprint,
      sourceId: source.sourceId,
      operationId: savedOperation.operationId
    });
  }
  return samples;
}

function recordSourceCorpus(samples) {
  const counts = Object.fromEntries(["real_web", "explicit_local_document", "note_markdown"].map((kind) => [
    kind,
    samples.filter((sample) => sample.sourceKind === kind).length
  ]));
  const uniqueSamples = new Set(samples.map((sample) => sample.sourceSampleId));
  const uniqueSources = new Set(samples.map((sample) => sample.sourceId));
  const uniqueFingerprints = new Set(samples.map((sample) => sample.contentFingerprint));
  const passed = samples.length === 12
    && uniqueSamples.size === 12
    && uniqueSources.size === 12
    && uniqueFingerprints.size === 12
    && counts.real_web === 6
    && counts.explicit_local_document === 3
    && counts.note_markdown === 3;
  const result = {
    schemaVersion: "v2-px-r2-source-corpus/v1",
    resultType: "source_corpus",
    runId,
    counts,
    samples
  };
  appendStructuredCommandResult({ scenarioId: "scenario_source_corpus", command: "r2:register-source-corpus", result, passed });
  if (!passed) throw new Error(`Source corpus does not satisfy 6+3+3: ${JSON.stringify(counts)}`);
}

async function collectInvalidRouteRecoveries(workspace, connectRuntime, extensionId) {
  const base = `chrome-extension://${extensionId}/workspace.html`;
  const cases = [
    { scenarioId: "scenario_route_error_invalid", url: `${base}#/foreign`, errorCode: "INVALID_ROUTE" },
    { scenarioId: "scenario_route_error_workspace_missing", url: `${base}#/knowledge/sources?workspaceId=workspace_missing`, errorCode: "WORKSPACE_NOT_FOUND" }
  ];
  for (const routeCase of cases) {
    startNavigation(routeCase.scenarioId, routeCase.url, "direct_open");
    await workspace.goto(routeCase.url);
    await workspace.locator("[data-testid='workspace-route-error']").waitFor({ timeout: 15_000 });
    await ensureWorkspaceConnected(workspace, connectRuntime);
    await drainR2ObservationsUntilSettled({ scenarioId: routeCase.scenarioId });
    const body = await workspace.textContent("body");
    if (!body?.includes(routeCase.errorCode)) throw new Error(`Expected ${routeCase.errorCode}, observed ${body}`);
    const errorRoute = collector.appendEvent({
      scenarioId: routeCase.scenarioId,
      kind: "route_observation",
      contextId: "ctx_workspace_page",
      navigationId: currentNavigationId,
      payload: {
        url: workspace.url(),
        mode: "direct_open",
        errorCode: routeCase.errorCode,
        ids: { status: "unavailable" },
        authorityEventIds: []
      }
    });
    const errorContainer = collector.appendEvent({
      scenarioId: routeCase.scenarioId,
      kind: "container_observation",
      contextId: "ctx_workspace_page",
      navigationId: currentNavigationId,
      payload: { surface: "workspace_page", ids: { status: "unavailable" }, authorityEventIds: [] }
    });
    await capturePage(workspace, {
      scenarioId: routeCase.scenarioId,
      name: `${routeCase.errorCode.toLowerCase()}-recovery-1280`,
      surface: "workspace_page",
      observationEvents: [errorRoute, errorContainer]
    });

    const recoveryUrl = `${base}#/knowledge/sources?workspaceId=${workspaceId}`;
    const priorPath = workspace.url();
    const actionId = collector.nextId("act");
    const observedClick = workspace.evaluate(() => new Promise((resolve, reject) => {
      const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "返回来源库");
      if (!button) {
        reject(new Error("Recovery button is missing."));
        return;
      }
      button.addEventListener("click", (event) => resolve({ isTrusted: event.isTrusted, target: "button:返回来源库" }), { once: true });
    }));
    startNavigation(`${routeCase.scenarioId}_recovery`, recoveryUrl, "recovery");
    await workspace.getByRole("button", { name: "返回来源库", exact: true }).click();
    const click = await observedClick;
    if (!click?.isTrusted) throw new Error(`${routeCase.errorCode} recovery was not a trusted browser click.`);
    collector.appendEvent({
      scenarioId: `${routeCase.scenarioId}_recovery`,
      kind: "dom_action",
      contextId: "ctx_workspace_page",
      navigationId: currentNavigationId,
      actionId,
      payload: { isTrusted: true, eventType: "click", target: click.target, url: priorPath, priorPath }
    });
    await workspace.locator("[data-testid='route-source-library']").waitFor({ timeout: 15_000 });
    const recovered = await observeRoute(workspace, {
      scenarioId: `${routeCase.scenarioId}_recovery`,
      mode: "recovery",
      actionId
    });
    if (workspace.url() !== recoveryUrl || recovered.ids.workspaceId !== workspaceId) {
      throw new Error(`${routeCase.errorCode} recovered to an unexpected route: ${workspace.url()}`);
    }
  }
}

function normalizeAxeViolations(violations, surface) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    surface,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      html: node.html,
      failureSummary: node.failureSummary
    }))
  }));
}

async function runNativeSidePanelAxe(target) {
  const packageRoot = fs.realpathSync(path.join(__dirname, "../node_modules/@axe-core/playwright"));
  const axeSourcePath = path.resolve(packageRoot, "../../axe-core/axe.min.js");
  const axeSource = fs.readFileSync(axeSourcePath, "utf8");
  await target.evaluate(`(() => { ${axeSource}\n; return Boolean(globalThis.axe); })()`);
  return await target.evaluate(`globalThis.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag22aa"] } })`);
}

async function collectAccessibilityEvidence({ workspace, sidePanelPage, sourceId, connectRuntime, extensionId }) {
  const scenarioId = "scenario_accessibility";
  const detailUrl = `chrome-extension://${extensionId}/workspace.html#/knowledge/sources/${sourceId}?workspaceId=${workspaceId}`;
  startNavigation(scenarioId, detailUrl, "direct_open");
  await workspace.goto(detailUrl);
  await ensureWorkspaceConnected(workspace, connectRuntime);
  await workspace.locator("[data-testid='route-source-detail']").waitFor({ timeout: 15_000 });

  const workspaceAxe = await new AxeBuilder({ page: workspace })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  let sidePanelAxe;
  if (sidePanelPage) {
    sidePanelAxe = await new AxeBuilder({ page: sidePanelPage })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
  } else {
    const target = await RawCdpTarget.connect(browser.cdpPort, "/sidepanel.html");
    try {
      sidePanelAxe = await runNativeSidePanelAxe(target);
    } finally {
      target.close();
    }
  }
  const violations = [
    ...normalizeAxeViolations(workspaceAxe.violations, "workspace_page"),
    ...normalizeAxeViolations(sidePanelAxe.violations, "side_panel")
  ];
  const axeResult = {
    schemaVersion: "v2-px-axe-result/v1",
    resultType: "axe",
    engine: "axe-core",
    serious: violations.filter((item) => item.impact === "serious").length,
    critical: violations.filter((item) => item.impact === "critical").length,
    surfaces: ["side_panel", "workspace_page"],
    violations
  };
  const axePassed = axeResult.serious === 0 && axeResult.critical === 0;
  appendStructuredCommandResult({
    scenarioId,
    command: "axe-core:side-panel+workspace",
    result: axeResult,
    passed: axePassed
  });

  const traceButton = workspace.getByRole("button", { name: "查看 Trace", exact: true });
  await traceButton.focus();
  await workspace.keyboard.press("Enter");
  await workspace.locator("[data-testid='evidence-trace-drawer']").waitFor({ timeout: 15_000 });
  const traceOpenedByKeyboard = await workspace.getByRole("button", { name: "关闭 Evidence Trace" }).evaluate((element) => document.activeElement === element);
  await workspace.keyboard.press("Escape");
  await workspace.locator("[data-testid='evidence-trace-drawer']").waitFor({ state: "detached", timeout: 15_000 });
  const focusReturnPassed = await traceButton.evaluate((element) => document.activeElement === element);
  await workspace.keyboard.press("Tab");
  const tabReachedInteractive = await workspace.evaluate(() => {
    const active = document.activeElement;
    return Boolean(active && active !== document.body && active.matches("button,a,input,textarea,select,[tabindex]:not([tabindex='-1'])"));
  });
  await workspace.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionPassed = await workspace.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const keyboardAssertions = {
    traceOpenedByKeyboard,
    escapePassed: await workspace.locator("[data-testid='evidence-trace-drawer']").count() === 0,
    focusReturnPassed,
    tabReachedInteractive,
    reducedMotionPassed
  };
  const keyboardResult = {
    schemaVersion: "v2-px-keyboard-result/v1",
    resultType: "keyboard",
    surface: "workspace_page",
    assertionsTotal: Object.keys(keyboardAssertions).length,
    assertionsPassed: Object.values(keyboardAssertions).filter(Boolean).length,
    ...keyboardAssertions
  };
  const keyboardPassed = keyboardResult.assertionsPassed === keyboardResult.assertionsTotal;
  appendStructuredCommandResult({
    scenarioId,
    command: "playwright:keyboard-accessibility",
    result: keyboardResult,
    passed: keyboardPassed
  });
  if (!axePassed || !keyboardPassed) {
    throw new Error(`Accessibility evidence failed: ${JSON.stringify({ axeResult, keyboardResult })}`);
  }
}

async function collectRouteMatrix(workspace, connectRuntime, extensionId, sourceId) {
  const base = `chrome-extension://${extensionId}/workspace.html`;
  const routes = [
    { intent: "source_library", hash: `#/knowledge/sources?workspaceId=${workspaceId}`, selector: "route-source-library" },
    { intent: "source_detail", hash: `#/knowledge/sources/${sourceId}?workspaceId=${workspaceId}`, selector: "route-source-detail" },
    { intent: "ask", hash: `#/knowledge/ask?workspaceId=${workspaceId}`, selector: "route-ask" },
    { intent: "graph", hash: `#/knowledge/graph?workspaceId=${workspaceId}`, selector: "route-graph" },
    { intent: "permissions", hash: `#/knowledge/settings/permissions?workspaceId=${workspaceId}`, selector: "route-permissions" }
  ];
  for (const routeCase of routes) {
    for (const mode of ["direct_open", "reload", "back", "reopen"]) {
      const scenarioId = `scenario_route_${routeCase.intent}_${mode}`;
      const url = `${base}${routeCase.hash}`;
      let page = workspace;
      if (mode === "direct_open") {
        startNavigation(scenarioId, url, mode);
        await page.goto(url);
      }
      else if (mode === "reload") {
        if (new URL(page.url()).hash !== routeCase.hash) {
          startNavigation(`${scenarioId}_prepare`, url, "direct_open");
          await page.goto(url);
        }
        startNavigation(scenarioId, url, mode);
        await page.reload();
      } else if (mode === "back") {
        const alternateHash = routeCase.intent === "ask"
          ? `#/knowledge/graph?workspaceId=${workspaceId}`
          : `#/knowledge/ask?workspaceId=${workspaceId}`;
        startNavigation(`${scenarioId}_prepare`, `${base}${alternateHash}`, "push");
        await page.goto(`${base}${alternateHash}`);
        startNavigation(scenarioId, url, mode);
        await page.goBack();
      } else {
        startNavigation(scenarioId, url, mode);
        page = await workspace.context().newPage();
        await page.goto(url);
      }
      await page.waitForSelector("[data-testid='workspace-shell']", { timeout: 15_000 });
      await ensureWorkspaceConnected(page, connectRuntime);
      await page.locator(`[data-testid='${routeCase.selector}'],[data-testid='workspace-route-error']`).first().waitFor({ timeout: 15_000 });
      const route = await observeRoute(page, { scenarioId, mode, expectedSourceId: routeCase.intent === "source_detail" ? sourceId : null });
      if (new URL(page.url()).hash !== routeCase.hash) throw new Error(`${routeCase.intent}/${mode} changed route: ${page.url()}`);
      await drainR2ObservationsUntilSettled({ scenarioId, navigationId: currentNavigationId });
      if (mode === "reopen") await page.close();
    }
  }
}

async function collectPermissionRoots(workspace) {
  const sourceFiles = ["01-prd.md", "02-architecture.md", "04-acceptance-plan.md"];
  const imported = [];
  const permissionsUrl = `chrome-extension://${new URL(workspace.url()).host}/workspace.html#/knowledge/settings/permissions?workspaceId=${workspaceId}`;
  startNavigation("scenario_permission_prepare", permissionsUrl, "push");
  await workspace.goto(permissionsUrl);
  await ensureWorkspaceConnected(workspace, (page, value) => page.locator("[data-testid='local-runtime-token-input']").fill(value)
    .then(() => page.locator("[data-testid='local-runtime-connect']").click())
    .then(() => page.locator("[data-testid='local-runtime-disconnect']").waitFor()));
  for (const [index, fileName] of sourceFiles.entries()) {
    const scenarioId = `scenario_permission_${index + 1}`;
    startNavigation(scenarioId, workspace.url(), "push");
    const targetPath = path.join(infraRoot, "authorized-documents", fileName);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, "docs/active/project", fileName), targetPath);
    privatePathValues.add(targetPath);
    const originalBytes = fs.readFileSync(targetPath);
    const contentArtifact = collector.writeArtifact({ relativePath: `private/authorized-documents/${fileName}`, bytes: originalBytes, mediaType: "text/markdown", visibility: "private_local_only" });
    const displayName = `T02 document ${index + 1}`;
    await workspace.getByLabel("授权名称").fill(displayName);
    await workspace.getByLabel("Runtime 绝对路径").fill(targetPath);
    await workspace.getByRole("button", { name: "授权", exact: true }).click();
    const article = workspace.locator(".permission-list article").filter({ hasText: displayName });
    await article.waitFor({ timeout: 15_000 });
    await article.getByRole("button", { name: "扫描", exact: true }).click();
    const fieldset = workspace.locator("fieldset");
    await fieldset.getByText(fileName, { exact: false }).waitFor({ timeout: 15_000 });
    await fieldset.locator("input[type='checkbox']").check();
    await fieldset.getByRole("button", { name: "导入所选文件", exact: true }).click();
    await workspace.getByText("已导入 1 个来源", { exact: false }).waitFor({ timeout: 15_000 });
    await article.getByRole("button", { name: "撤销", exact: true }).click();
    await article.getByText("revoked", { exact: false }).waitFor({ timeout: 15_000 });
    await drainR2ObservationsUntilSettled({ scenarioId });
    const permissions = await browserRuntimeRequest(workspace, { scenarioId, requestPath: `/v1/knowledge/permissions?workspaceId=${workspaceId}` });
    const permission = permissions.body?.data?.permissions?.find((item) => item.displayName === displayName);
    if (!permission || permission.state !== "revoked") throw new Error(`Permission ${displayName} was not revoked.`);
    const sources = await browserRuntimeRequest(workspace, { scenarioId, requestPath: `/v1/knowledge/sources?workspaceId=${workspaceId}` });
    const source = sources.body?.data?.sources?.find((item) => item.title === fileName);
    if (!source) throw new Error(`Imported source ${fileName} was not retained.`);
    const detail = await browserRuntimeRequest(workspace, { scenarioId, requestPath: `/v1/knowledge/sources/${source.sourceId}` });
    if (detail.body?.data?.source?.contentSnapshot?.sha256 !== sha256(originalBytes)) throw new Error(`Retained source hash mismatch: ${fileName}`);
    const deniedScan = await browserRuntimeRequest(workspace, { scenarioId, requestPath: `/v1/knowledge/permissions/${permission.permissionRootId}/scan`, method: "POST", body: { workspaceId } });
    const deniedImport = await browserRuntimeRequest(workspace, {
      scenarioId,
      requestPath: `/v1/knowledge/permissions/${permission.permissionRootId}/imports`,
      method: "POST",
      body: { workspaceId, scanId: "scan_revoked", fileIds: ["file_revoked"] },
      headers: { "Idempotency-Key": `t02-revoked-import-${index + 1}` }
    });
    if (deniedScan.status !== 403 || deniedImport.status !== 403) throw new Error(`Revoked root ${displayName} still accepts scan/import.`);
    imported.push({
      sourceSampleId: `sample_${String(index + 10).padStart(2, "0")}`,
      sourceKind: "explicit_local_document",
      sourceType: "authorized_local_document",
      authorizationMode: "explicit_permission_root",
      originRef: `docs/active/project/${fileName}`,
      contentArtifact,
      contentFingerprint: sha256(originalBytes),
      sourceId: source.sourceId,
      operationId: source.operationId,
      title: source.title,
      permissionRootId: permission.permissionRootId
    });
  }
  return imported;
}

async function collectForgetChains(workspace, importedSources, connectRuntime, extensionId) {
  const base = `chrome-extension://${extensionId}/workspace.html`;
  for (const [index, source] of importedSources.entries()) {
    const scenarioId = `scenario_forget_${index + 1}`;
    const sourceUrl = `${base}#/knowledge/sources/${source.sourceId}?workspaceId=${workspaceId}`;
    startNavigation(scenarioId, sourceUrl, "push");
    await workspace.goto(sourceUrl);
    await ensureWorkspaceConnected(workspace, connectRuntime);
    await workspace.locator("[data-testid='route-source-detail']").waitFor({ timeout: 15_000 });
    await workspace.getByRole("button", { name: "遗忘来源", exact: true }).click();
    const dialog = workspace.locator("[data-testid='forget-source-dialog']");
    await dialog.getByLabel("确认文本").fill("forget");
    await dialog.getByRole("button", { name: "确认遗忘", exact: true }).click();
    await workspace.locator("[data-testid='route-source-library']").waitFor({ timeout: 15_000 });
    await drainR2ObservationsUntilSettled({ scenarioId });
    const verification = [
      await browserRuntimeRequest(workspace, { scenarioId, requestPath: `/v1/knowledge/sources?workspaceId=${workspaceId}` }),
      await browserRuntimeRequest(workspace, { scenarioId, requestPath: "/v1/knowledge/query", method: "POST", body: { workspaceId, question: "forgotten source", sourceIds: [source.sourceId] } }),
      await browserRuntimeRequest(workspace, { scenarioId, requestPath: `/v1/knowledge/graph?workspaceId=${workspaceId}` }),
      await browserRuntimeRequest(workspace, { scenarioId, requestPath: `/v1/knowledge/source/${source.sourceId}/trace` })
    ];
    const [library, ask, graph, trace] = verification;
    const absent = !library.body?.data?.sources?.some((item) => item.sourceId === source.sourceId)
      && ask.body?.data?.evidenceRefs?.length === 0
      && !graph.body?.data?.nodes?.some((item) => item.id === source.sourceId)
      && trace.body?.data?.lookupOutcome === "forgotten";
    if (!absent) throw new Error(`Forget four-surface verification failed: ${source.sourceId}`);
    for (const mode of ["direct_open", "reload", "back", "reopen"]) {
      const recoveryScenarioId = `${scenarioId}_${mode}`;
      let page = workspace;
      if (mode === "direct_open") {
        startNavigation(recoveryScenarioId, sourceUrl, mode);
        await page.goto(sourceUrl);
      }
      else if (mode === "reload") {
        if (page.url() !== sourceUrl) {
          const prepareScenarioId = `${recoveryScenarioId}_prepare`;
          startNavigation(prepareScenarioId, sourceUrl, "direct_open");
          await page.goto(sourceUrl);
          await page.waitForSelector("[data-testid='workspace-shell']", { timeout: 15_000 });
          await ensureWorkspaceConnected(page, connectRuntime);
          await page.locator("[data-testid='workspace-route-error']").waitFor({ timeout: 15_000 });
          await drainR2ObservationsUntilSettled({ scenarioId: prepareScenarioId, navigationId: currentNavigationId });
        }
        startNavigation(recoveryScenarioId, sourceUrl, mode);
        await page.reload();
      } else if (mode === "back") {
        if (page.url() !== sourceUrl) {
          const sourcePrepareScenarioId = `${recoveryScenarioId}_source_prepare`;
          startNavigation(sourcePrepareScenarioId, sourceUrl, "direct_open");
          await page.goto(sourceUrl);
          await page.waitForSelector("[data-testid='workspace-shell']", { timeout: 15_000 });
          await ensureWorkspaceConnected(page, connectRuntime);
          await page.locator("[data-testid='workspace-route-error']").waitFor({ timeout: 15_000 });
          await drainR2ObservationsUntilSettled({ scenarioId: sourcePrepareScenarioId, navigationId: currentNavigationId });
        }
        const libraryUrl = `${base}#/knowledge/sources?workspaceId=${workspaceId}`;
        const libraryPrepareScenarioId = `${recoveryScenarioId}_library_prepare`;
        startNavigation(libraryPrepareScenarioId, libraryUrl, "push");
        await page.goto(libraryUrl);
        await page.waitForSelector("[data-testid='route-source-library']", { timeout: 15_000 });
        await drainR2ObservationsUntilSettled({ scenarioId: libraryPrepareScenarioId, navigationId: currentNavigationId });
        startNavigation(recoveryScenarioId, sourceUrl, mode);
        await page.goBack();
      } else {
        startNavigation(recoveryScenarioId, sourceUrl, mode);
        page = await workspace.context().newPage();
        await page.goto(sourceUrl);
      }
      await page.waitForSelector("[data-testid='workspace-shell']", { timeout: 15_000 });
      await ensureWorkspaceConnected(page, connectRuntime);
      await page.locator("[data-testid='workspace-route-error']").waitFor({ timeout: 15_000 });
      if (!(await page.textContent("body"))?.includes("SOURCE_NOT_FOUND")) throw new Error(`Forgotten source revived via ${mode}: ${source.sourceId}`);
      await observeRoute(page, {
        scenarioId: recoveryScenarioId,
        mode,
        expectedSourceId: source.sourceId,
        expectedErrorCode: "SOURCE_NOT_FOUND"
      });
      // Finish error-view requests before the trusted route transition can abort them.
      await drainR2ObservationsUntilSettled({ scenarioId: recoveryScenarioId, navigationId: currentNavigationId });
      await recoverRouteToSourceLibrary(page, { scenarioId: recoveryScenarioId, expectedSourceId: source.sourceId });
      await drainR2ObservationsUntilSettled({ scenarioId: recoveryScenarioId, navigationId: currentNavigationId });
      if (mode === "reopen") await page.close();
    }
  }
}

async function collectControlledFaults(context, connectRuntime, extensionId) {
  const faults = Object.values(CONTROLLED_FAULT_STATUS_POLICIES);
  for (const fault of faults) {
    const scenarioId = `scenario_fault_${fault.faultType}`;
    const faultTarget = fault.target;
    const url = `chrome-extension://${extensionId}/workspace.html#/knowledge/sources?workspaceId=${workspaceId}`;
    startNavigation(scenarioId, url, "direct_open");
    collector.startFault({ scenarioId, faultType: fault.faultType, target: faultTarget, contextId: "ctx_workspace_page", navigationId: currentNavigationId });
    const page = await context.newPage();
    await page.route("http://127.0.0.1:17861/v1/knowledge/status**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: controlledFaultStatus(fault.faultType, new Date().toISOString()), error: null, request_id: `req_${fault.faultType}` })
      });
    });
    await page.goto(url);
    await page.waitForSelector("[data-testid='workspace-shell']", { timeout: 15_000 });
    await page.waitForFunction(
      ({ adapterStatus, dataServiceStatus, sourceBuildStatus }) => {
        const text = document.querySelector("[data-testid='workspace-service-status']")?.textContent ?? "";
        return text.includes(adapterStatus) && text.includes(dataServiceStatus) && text.includes(sourceBuildStatus);
      },
      fault,
      { timeout: 15_000 }
    ).catch(async () => {
      const actual = await page.locator("[data-testid='workspace-service-status']").textContent();
      throw new Error(`Fault UI mismatch: ${fault.faultType}; actual=${JSON.stringify(actual)}`);
    });
    const events = await drainR2ObservationsUntilSettled({ scenarioId });
    const authority = events.filter((event) => event.kind === "runtime_response").at(-1);
    if (!authority) throw new Error(`Fault ${fault.faultType} has no raw Runtime response.`);
    const ids = { status: "observed", workspaceId };
    const routeEvent = collector.appendEvent({ scenarioId, kind: "route_observation", contextId: "ctx_workspace_page", navigationId: currentNavigationId, payload: { url: page.url(), mode: "direct_open", ids, authorityEventIds: [authority.eventId] } });
    const containerEvent = collector.appendEvent({ scenarioId, kind: "container_observation", contextId: "ctx_workspace_page", navigationId: currentNavigationId, payload: { surface: "workspace_page", ids, authorityEventIds: [authority.eventId] } });
    await capturePage(page, { scenarioId, name: `fault-${fault.faultType}-1280`, surface: "workspace_page", observationEvents: [routeEvent, containerEvent] });
    collector.endFault({ scenarioId, faultType: fault.faultType, target: faultTarget, contextId: "ctx_workspace_page", navigationId: currentNavigationId });
    await page.close();
  }
}

async function main() {
  const prerequisiteResults = collectPrerequisiteCommands();
  if (!fs.existsSync(path.join(extensionRoot, "manifest.json")) || !fs.existsSync(path.join(extensionRoot, "workspace.html"))) {
    throw new Error("Fresh extension build is missing manifest.json or workspace.html.");
  }
  collector = createCollector();
  const toolkit = await import("./chrome-v2-t01-r1-frontend.mjs");
  await toolkit.ensurePortFree();
  const fixture = await toolkit.startFixtureServer();
  fixtureServer = fixture.server;
  const profileRoot = path.resolve(process.env.NAVIA_T02_PROFILE_ROOT || path.join(repoRoot, ".tmp/t02-browser-profiles"));
  fs.mkdirSync(profileRoot, { recursive: true });
  profilePath = fs.mkdtempSync(path.join(profileRoot, "navia-t01-profile-"));
  browser = await toolkit.launchExtension(profilePath);
  if (!browser.cdpPort) throw new Error("T02 requires the Windows Chrome CDP target for native Side Panel evidence.");
  const context = browser.context;
  const hostPage = context.pages()[0] || await context.newPage();
  await hostPage.goto(fixture.url);
  worker = await toolkit.extensionWorker(context);
  const extensionId = new URL(worker.url()).host;
  token = crypto.randomBytes(32).toString("base64url");
  secretValues.push(token);
  const runtimeStartedAt = new Date().toISOString();
  runtime = toolkit.startRuntime(extensionId, token);
  await toolkit.waitForRuntime();
  segment = collector.startSegment({
    runtimePid: runtime.child.pid,
    runtimeStartedAt,
    browserContextId: collector.nextId("bcx")
  });
  appendPrerequisiteResults(prerequisiteResults);
  startNavigation("scenario_setup", fixture.url, "direct_open");
  await hostPage.reload();

  const sidePanelResult = await toolkit.openNativeSidePanel(context, worker, hostPage);
  const sidePanelDriver = toolkit.createSidePanelDriver(sidePanelResult.page, worker);
  await sidePanelDriver.click("read-current-page");
  await sidePanelDriver.waitForText("current-page-context-card", "Browser extension");
  await sidePanelDriver.click("nav-knowledge-tab");
  await sidePanelDriver.waitForCount("local-runtime-token-input", 1);
  await sidePanelDriver.fill("local-runtime-token-input", token);
  await sidePanelDriver.click("local-runtime-connect");
  await sidePanelDriver.waitForText("local-runtime-status", "本页面会话已认证");
  await sidePanelDriver.click("save-current-source");
  const sideIdentity = await sidePanelDriver.waitForText("quick-source-identity", "trace_ready");
  const sourceId = sideIdentity.match(/src_[a-zA-Z0-9]+/)?.[0];
  const operationId = sideIdentity.match(/op_[a-zA-Z0-9]+/)?.[0];
  if (!sourceId || !operationId) throw new Error(`Saved source identity is missing: ${sideIdentity}`);
  const setupEvents = await drainR2ObservationsUntilSettled({ scenarioId: "scenario_setup" });
  const setupAuthority = setupEvents.filter((event) => event.kind === "runtime_response").at(-1);
  if (!setupAuthority) throw new Error("Side Panel setup has no Runtime authority response.");
  const sideIds = { status: "observed", workspaceId, sourceId, operationId };
  const sideRoute = collector.appendEvent({ scenarioId: "scenario_setup", kind: "route_observation", contextId: "ctx_side_panel_native", navigationId: currentNavigationId, payload: { url: String((await toolkit.executeSidePanelBridge(worker, { action: "panel_identity" })).locationHref), mode: "direct_open", ids: sideIds, authorityEventIds: [setupAuthority.eventId] } });
  const sideContainer = collector.appendEvent({ scenarioId: "scenario_setup", kind: "container_observation", contextId: "ctx_side_panel_native", navigationId: currentNavigationId, payload: { surface: "side_panel", ids: sideIds, authorityEventIds: [setupAuthority.eventId] } });
  let nativeTarget = await RawCdpTarget.connect(browser.cdpPort, "/sidepanel.html");
  await resizeNativeSidePanel(nativeTarget, 360);
  await captureNativeSidePanel({ scenarioId: "scenario_setup", name: "sidepanel-360", target: nativeTarget, observationEvents: [sideRoute, sideContainer] });
  await resizeNativeSidePanel(nativeTarget, 420);
  await captureNativeSidePanel({ scenarioId: "scenario_setup", name: "sidepanel-420", target: nativeTarget, observationEvents: [sideRoute, sideContainer] });
  nativeTarget.close();

  const entrySpecs = [
    { testId: "open-workspace", origin: "open_workspace", hash: `#/knowledge/sources?workspaceId=${workspaceId}` },
    { testId: "open-workspace", origin: "open_workspace", hash: `#/knowledge/sources?workspaceId=${workspaceId}` },
    { testId: "view-source", origin: "view_source", hash: `#/knowledge/sources/${sourceId}?workspaceId=${workspaceId}` },
    { testId: "view-source", origin: "view_source", hash: `#/knowledge/sources/${sourceId}?workspaceId=${workspaceId}` },
    { testId: "view-source", origin: "view_source", hash: `#/knowledge/sources/${sourceId}?workspaceId=${workspaceId}` },
    { testId: "open-in-workspace", origin: "open_in_workspace", hash: `#/knowledge/sources/${sourceId}?workspaceId=${workspaceId}` },
    { testId: "ask-current-workspace", origin: "open_in_workspace", hash: `#/knowledge/ask?workspaceId=${workspaceId}` }
  ];
  let workspace = null;
  for (const [index, entry] of entrySpecs.entries()) {
    await hostPage.bringToFront();
    await toolkit.waitForSidePanelBridge(worker);
    await sidePanelDriver.click("nav-knowledge-tab");
    if (await sidePanelDriver.count("local-runtime-token-input")) {
      await sidePanelDriver.fill("local-runtime-token-input", token);
      await sidePanelDriver.click("local-runtime-connect");
      await sidePanelDriver.waitForText("local-runtime-status", "本页面会话已认证");
    }
    if (entry.testId === "view-source") await sidePanelDriver.waitForCount(entry.testId, 1);
    const result = await trustedNativeEntry({
      ...entry,
      expectedHash: entry.hash,
      scenarioId: `scenario_entry_${entry.origin}_${index + 1}`,
      hostPage,
      context,
      extensionId,
      connectRuntime: toolkit.connectRuntime
    });
    workspace = result.workspace;
  }
  if (!workspace) throw new Error("Workspace was not opened by a trusted production entry.");
  const sourceSamples = await collectSupplementalSources(workspace, {
    fixtureUrl: fixture.url,
    sourceId,
    operationId
  });
  await collectRouteMatrix(workspace, toolkit.connectRuntime, extensionId, sourceId);
  await collectInvalidRouteRecoveries(workspace, toolkit.connectRuntime, extensionId);
  await collectAccessibilityEvidence({
    workspace,
    sidePanelPage: sidePanelResult.page,
    sourceId,
    connectRuntime: toolkit.connectRuntime,
    extensionId
  });

  await workspace.setViewportSize({ width: 768, height: 900 });
  startNavigation("scenario_workspace_768", workspace.url(), "push");
  await workspace.goto(workspace.url());
  await ensureWorkspaceConnected(workspace, toolkit.connectRuntime);
  const route768 = await observeRoute(workspace, { scenarioId: "scenario_workspace_768", mode: "push" });
  await capturePage(workspace, { scenarioId: "scenario_workspace_768", name: "workspace-768", surface: "workspace_page", observationEvents: [route768.routeEvent, route768.containerEvent] });
  await workspace.setViewportSize({ width: 1280, height: 900 });
  startNavigation("scenario_workspace_1280", workspace.url(), "push");
  await workspace.goto(workspace.url());
  await ensureWorkspaceConnected(workspace, toolkit.connectRuntime);
  const route1280 = await observeRoute(workspace, { scenarioId: "scenario_workspace_1280", mode: "push" });
  await capturePage(workspace, { scenarioId: "scenario_workspace_1280", name: "workspace-1280", surface: "workspace_page", observationEvents: [route1280.routeEvent, route1280.containerEvent] });

  await ensureWorkspaceConnected(workspace, toolkit.connectRuntime);
  const importedSources = await collectPermissionRoots(workspace);
  recordSourceCorpus([...sourceSamples, ...importedSources]);
  await collectForgetChains(workspace, importedSources, toolkit.connectRuntime, extensionId);
  await collectControlledFaults(context, toolkit.connectRuntime, extensionId);

  const offlineScenario = "scenario_fault_runtime_offline";
  startNavigation(offlineScenario, `chrome-extension://${extensionId}/workspace.html#/knowledge/sources?workspaceId=${workspaceId}`, "direct_open");
  runtime.child.kill("SIGTERM");
  await new Promise((resolve) => runtime.child.once("exit", resolve));
  runtime.flush();
  await drainR2ObservationsUntilSettled({ scenarioId: `${offlineScenario}_shutdown_drain`, navigationId: currentNavigationId });
  const offlineStart = collector.startFault({ scenarioId: offlineScenario, faultType: "runtime_offline", target: "runtime_transport", contextId: "ctx_runtime_transport", navigationId: currentNavigationId });
  const offlinePage = await context.newPage();
  await offlinePage.goto(`chrome-extension://${extensionId}/workspace.html#/knowledge/sources?workspaceId=${workspaceId}`);
  await offlinePage.waitForSelector("[data-testid='workspace-runtime-offline']", { timeout: 15_000 });
  const offlineEvents = await drainR2ObservationsUntilSettled({ scenarioId: offlineScenario });
  const offlineAuthority = offlineEvents.filter((event) => event.kind === "transport_failure").at(-1);
  if (!offlineAuthority) throw new Error("Runtime offline has no transport failure authority.");
  const offlineIds = { status: "unavailable" };
  const offlineRoute = collector.appendEvent({ scenarioId: offlineScenario, kind: "route_observation", contextId: "ctx_workspace_page", navigationId: currentNavigationId, payload: { url: offlinePage.url(), mode: "direct_open", ids: offlineIds, authorityEventIds: [offlineAuthority.eventId] } });
  const offlineContainer = collector.appendEvent({ scenarioId: offlineScenario, kind: "container_observation", contextId: "ctx_workspace_page", navigationId: currentNavigationId, payload: { surface: "workspace_page", ids: offlineIds, authorityEventIds: [offlineAuthority.eventId] } });
  await capturePage(offlinePage, { scenarioId: offlineScenario, name: "fault-runtime-offline-1280", surface: "workspace_page", observationEvents: [offlineRoute, offlineContainer] });
  offlineEvents.push(...await drainR2ObservationsUntilSettled({ scenarioId: offlineScenario, navigationId: currentNavigationId }));
  const offlineEnd = collector.endFault({ scenarioId: offlineScenario, faultType: "runtime_offline", target: "runtime_transport", contextId: "ctx_runtime_transport", navigationId: currentNavigationId });
  const offlineAuthorityResult = inspectRuntimeOfflineAuthority({
    events: [offlineStart, ...offlineEvents, offlineEnd],
    faultInjections: [{ faultType: "runtime_offline", startSequence: offlineStart.sequence, endSequence: offlineEnd.sequence }]
  });
  collector.writeArtifact({
    relativePath: "artifacts/public/validation/runtime-offline-authority.json",
    bytes: Buffer.from(`${JSON.stringify(offlineAuthorityResult, null, 2)}\n`, "utf8"),
    mediaType: "application/json"
  });
  if (offlineAuthorityResult.intervalsChecked !== 1 || offlineAuthorityResult.requestsChecked === 0 || offlineAuthorityResult.errors.length) {
    throw new Error(`Runtime offline authority validation failed before seal: ${JSON.stringify(offlineAuthorityResult)}`);
  }
  collector.endSegment(segment.segmentId);

  token = crypto.randomBytes(32).toString("base64url");
  secretValues.push(token);
  const restartedAt = new Date().toISOString();
  runtime = toolkit.startRuntime(extensionId, token);
  await toolkit.waitForRuntime();
  segment = collector.startSegment({ runtimePid: runtime.child.pid, runtimeStartedAt: restartedAt, browserContextId: collector.nextId("bcx") });
  startNavigation("scenario_runtime_restart", offlinePage.url(), "reload");
  const restarted = await browserRuntimeRequest(offlinePage, { scenarioId: "scenario_runtime_restart", requestPath: "/v1/knowledge/status" });
  if (restarted.status !== 200) throw new Error("Restarted Runtime did not return status 200.");
  const restartedRoute = collector.appendEvent({ scenarioId: "scenario_runtime_restart", kind: "route_observation", contextId: "ctx_workspace_page", navigationId: currentNavigationId, payload: { url: offlinePage.url(), mode: "reload", ids: { status: "observed", workspaceId }, authorityEventIds: [restarted.responseEvent.eventId] } });
  collector.appendEvent({ scenarioId: "scenario_runtime_restart", kind: "container_observation", contextId: "ctx_workspace_page", navigationId: currentNavigationId, payload: { surface: "workspace_page", ids: { status: "observed", workspaceId }, authorityEventIds: [restarted.responseEvent.eventId] } });
  if (!restartedRoute) throw new Error("Restart route observation failed.");

  const statusContractResult = validateKnowledgeStatusObservations({
    schemaPath: path.join(repoRoot, "docs/active/project/contracts/v2_knowledge_status.schema.json"),
    observations: knowledgeStatusObservations,
    extractionErrors: knowledgeStatusExtractionErrors
  });
  collector.writeArtifact({
    relativePath: "artifacts/public/validation/knowledge-status-contract.json",
    bytes: Buffer.from(`${JSON.stringify(statusContractResult, null, 2)}\n`, "utf8"),
    mediaType: "application/json"
  });
  if (statusContractResult.checked === 0 || statusContractResult.errors.length) {
    throw new Error(`Knowledge Status evidence validation failed before seal: ${JSON.stringify(statusContractResult)}`);
  }

  runtime.flush();
  browser.flush();
  for (const [source, destination] of [
    [path.join(infraRoot, "logs/runtime.log"), "logs/runtime.log"],
    [path.join(infraRoot, "logs/chrome.log"), "logs/chrome.log"]
  ]) {
    if (fs.existsSync(source)) collector.writeArtifact({ relativePath: destination, bytes: fs.readFileSync(source), mediaType: "text/plain" });
  }
  collector.endSegment(segment.segmentId);
  const sealed = collector.seal();
  sealedResult = sealed;
  const invariantErrors = validateRawRun(sealed.document, { runRoot: evidenceRoot });
  if (invariantErrors.length) throw new Error(invariantErrors.join("\n"));
  const artifactIndexBytes = Buffer.from(`${JSON.stringify(sealed.document.artifacts, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceRoot, "raw/artifact-index.json"), artifactIndexBytes);
  const publicScan = scanPublicArtifacts({
    runRoot: evidenceRoot,
    artifacts: sealed.document.artifacts,
    secrets: secretValues,
    privatePathValues: [...privatePathValues, os.homedir()]
  });
  publicScan.push(...scanPublicBytes(sealed.path, fs.readFileSync(path.join(evidenceRoot, sealed.path))));
  publicScan.push(...scanPublicBytes("raw/artifact-index.json", artifactIndexBytes));
  if (publicScan.length) throw new Error(`Public artifacts contain private values: ${JSON.stringify(publicScan)}`);
  const schemaScript = [
    "import json,sys",
    "from jsonschema import Draft202012Validator",
    "schema=json.load(open('docs/active/project/contracts/v2_px_raw_run.schema.json'))",
    "Draft202012Validator.check_schema(schema)",
    "document=json.load(open(sys.argv[1]))",
    "errors=list(Draft202012Validator(schema).iter_errors(document))",
    "assert not errors, '\\n'.join(error.message for error in errors)"
  ].join(";");
  const schemaValidation = runCommand("python3", ["-c", schemaScript, path.join(evidenceRoot, sealed.path)], { name: "sealed_raw_schema_validation" });
  if (schemaValidation.exitCode !== 0) throw new Error(`Sealed raw schema validation failed: ${schemaValidation.stderr.toString("utf8")}`);
  runCompleted = true;
}

async function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return await Promise.race([
    new Promise((resolve) => {
      const settled = () => resolve(true);
      child.once("exit", settled);
      child.once("close", settled);
    }),
    wait(timeoutMs).then(() => false)
  ]);
}

main().catch((error) => {
  writeDiagnostic("PX_R2_COLLECTION_FAILED", error instanceof Error ? error.message : String(error), {
    stack: error instanceof Error ? error.stack : null
  });
  console.error(error);
  process.exitCode = 2;
}).finally(async () => {
  let cleanupError = null;
  let runtimeStopped = !runtime?.child || runtime.child.exitCode !== null || runtime.child.signalCode !== null;
  if (runtime?.child && !runtimeStopped) {
    runtime.child.kill("SIGTERM");
    runtimeStopped = await waitForChildExit(runtime.child, 5_000);
    if (!runtimeStopped) {
      runtime.child.kill("SIGKILL");
      runtimeStopped = await waitForChildExit(runtime.child, 2_000);
    }
    runtimeStopped = runtimeStopped || runtime.child.exitCode !== null || runtime.child.signalCode !== null;
    if (!runtimeStopped) cleanupError = new Error("Runtime process did not exit during cleanup.");
  }
  runtime?.flush?.();
  let browserClosed = !browser;
  if (browser) {
    try { await browser.close(); browserClosed = true; }
    catch (error) { cleanupError = cleanupError ?? error; }
  }
  let fixtureServerClosed = !fixtureServer;
  if (fixtureServer) {
    try {
      await new Promise((resolve, reject) => fixtureServer.close((error) => error ? reject(error) : resolve()));
      fixtureServerClosed = true;
    } catch (error) {
      cleanupError = cleanupError ?? error;
    }
  }
  if (profilePath) {
    try { fs.rmSync(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); }
    catch (error) { cleanupError = cleanupError ?? error; }
  }
  fs.mkdirSync(path.join(evidenceRoot, "raw"), { recursive: true });
  fs.writeFileSync(path.join(evidenceRoot, "cleanup-manifest.json"), `${JSON.stringify({
    schemaVersion: "v2-px-r2-cleanup/v1",
    runId,
    generatedAt: new Date().toISOString(),
    browserClosed,
    runtimeStopped,
    fixtureServerClosed,
    profileRemoved: !profilePath || !fs.existsSync(profilePath),
    passed: !cleanupError
  }, null, 2)}\n`);
  if (runCompleted && !cleanupError && sealedResult) {
    fs.writeFileSync(path.join(evidenceRoot, "raw/collection-diagnostic.json"), `${JSON.stringify({
      schemaVersion: "v2-px-collection-diagnostic/v1",
      runId,
      generatedAt: new Date().toISOString(),
      passed: true,
      sealedRawRun: { path: sealedResult.path, sha256: sealedResult.sha256 },
      missingObservations: []
    }, null, 2)}\n`);
  } else if (cleanupError) {
    writeDiagnostic("PX_R2_CLEANUP_FAILED", cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
    process.exitCode = 2;
  }
});
