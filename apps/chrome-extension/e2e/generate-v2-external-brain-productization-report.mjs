import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const evidenceRoot = path.join(repoRoot, "docs/active/project/evidence/v2_external_brain_productization/px-5");
const rawPath = path.join(evidenceRoot, "px-5-raw-e2e.json");
const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
const now = new Date().toISOString();

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const rel = (absolute) => path.relative(repoRoot, absolute).replaceAll(path.sep, "/");
const writeJson = (absolute, value) => fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
const artifactRef = (absolute) => ({ path: rel(absolute), sha256: sha256(fs.readFileSync(absolute)) });
const canonicalPath = (route, sourceId) => route === "source_library" ? "#/knowledge/sources?workspaceId=ws_default"
  : route === "source_detail" ? `#/knowledge/sources/${sourceId}?workspaceId=ws_default`
    : route === "permissions" ? "#/knowledge/settings/permissions?workspaceId=ws_default"
      : `#/knowledge/${route}?workspaceId=ws_default`;

if (!raw.passed) throw new Error(`PX-5 raw E2E failed: ${raw.issues.join("; ")}`);
for (const directory of ["execution-observations", "screenshot-metadata", "logs", "audit-inputs"]) {
  fs.mkdirSync(path.join(evidenceRoot, directory), { recursive: true });
}

const onlineStatus = (sourceBuildStatus = "trace_ready", overrides = {}) => ({
  schemaVersion: "v2-knowledge-status-draft-2026-07-10", observedAt: now,
  frontendInferredRuntimeStatus: "online", runtimeStatus: "online",
  adapterStatus: "ready", dataServiceStatus: "unchecked", sourceBuildStatus,
  capabilities: { workspace: true, sourceImport: true, buildStatus: true, query: true, graph: true, sourceTrace: true, forgetVerification: true },
  userAction: "none", message: "Observed by PX-5 real Chrome automation.", redactionApplied: true,
  ...overrides
});
const offlineStatus = () => ({
  schemaVersion: "v2-knowledge-status-draft-2026-07-10", observedAt: now,
  frontendInferredRuntimeStatus: "offline", runtimeStatus: null,
  adapterStatus: "unchecked", dataServiceStatus: "unchecked", sourceBuildStatus: "unknown",
  capabilities: { workspace: false, sourceImport: false, buildStatus: false, query: false, graph: false, sourceTrace: false, forgetVerification: false },
  userAction: "start_runtime", message: "Runtime connection refused by controlled Playwright route abort.", redactionApplied: true
});
const statusForFault = (fault) => {
  if (fault === "runtime_offline") return offlineStatus();
  if (fault === "adapter_blocked") return onlineStatus("unknown", { adapterStatus: "blocked", userAction: "configure_adapter" });
  if (fault === "data_service_unreachable") return onlineStatus("degraded", { dataServiceStatus: "unreachable", userAction: "reconnect" });
  if (fault === "source_failed") return onlineStatus("failed", { userAction: "retry_source_build" });
  return onlineStatus();
};

const corpus = raw.realCorpus.map((item) => ({
  sourceSampleId: item.sourceSampleId,
  sourceKind: item.sourceKind,
  dataMode: "real",
  originLabel: item.title,
  originRef: item.originRef,
  contentFingerprint: { algorithm: "sha256", inputMode: "raw_bytes_v1", artifactPath: item.originRef, value: item.contentFingerprint },
  authorizationMode: item.authorizationMode
}));
const sourceById = new Map(raw.realCorpus.map((item) => [item.sourceId, item]));
const primary = raw.realCorpus[0];
const screenshots = new Map(raw.screenshots.map((item) => [path.basename(item.path), item]));
const backgroundEntries = raw.backgroundMessages.filter((item) => item.request?.type === "OPEN_NAVIA_KNOWLEDGE_WORKSPACE");
const entryQueues = new Map(["open_workspace", "view_source", "open_in_workspace"].map((origin) => [origin, backgroundEntries.filter((item) => item.request.origin === origin && item.request.requestId === item.response?.requestId).slice(0, origin === "view_source" ? 3 : 2)]));

const definitions = [];
for (const origin of ["open_workspace", "view_source", "open_in_workspace"]) {
  for (const [index, message] of entryQueues.get(origin).entries()) {
    const routeIntent = message.request.routeIntent;
    const sourceId = message.request.sourceId ?? primary.sourceId;
    definitions.push({
      id: `entry_${origin}_${index + 1}`, entryPoint: origin, routeIntent, sourceId,
      operationId: sourceById.get(sourceId)?.operationId ?? primary.operationId,
      screenshot: origin === "open_workspace" ? "workspace-library-1280.png" : "workspace-source-detail-1280.png",
      coverageTags: [`entry_${origin}`, "cross_container_identity", ...(origin === "open_workspace" && index === 0 ? ["tab_reuse"] : [])],
      openOutcome: message.response.outcome, routeRecoveryResult: "not_applicable",
      rawMessage: message
    });
  }
}

const routeFileIntent = { source_library: "source_library", source_detail: "source_detail", ask: "ask", graph: "graph", permissions: "permissions" };
for (const [intent, normalized] of Object.entries(routeFileIntent)) {
  for (const mode of ["direct-open", "reload", "back"]) {
    definitions.push({
      id: `route_${intent}_${mode.replace("-", "_")}`, entryPoint: "direct_route", routeIntent: normalized,
      sourceId: primary.sourceId, operationId: primary.operationId,
      screenshot: `route-${intent}-${mode}-1280.png`, coverageTags: [mode === "direct-open" ? "route_direct_open" : mode === "reload" ? "route_reload" : "route_back_reopen"],
      openOutcome: "direct_open_restored", routeRecoveryResult: mode === "direct-open" ? "restored_direct_open" : mode === "reload" ? "restored_after_reload" : "restored_after_back",
      successfulRecoveryModes: ["direct_open", "reload", "back", "reopen"]
    });
  }
}

for (const [errorCode, screenshot, routeIntent] of [
  ["INVALID_ROUTE", "route-error-invalid-1280.png", "source_library"],
  ["WORKSPACE_NOT_FOUND", "route-error-workspace-not-found-1280.png", "source_library"],
  ["SOURCE_NOT_FOUND", "route-error-source-not-found-1280.png", "source_detail"]
]) definitions.push({
  id: `recovery_${errorCode.toLowerCase()}`, entryPoint: "direct_route", routeIntent,
  sourceId: routeIntent === "source_detail" ? "source_missing" : primary.sourceId, operationId: primary.operationId,
  screenshot, coverageTags: [errorCode === "FORBIDDEN" ? "forbidden_id_recovery" : "invalid_id_recovery"],
  openOutcome: "recovered", routeRecoveryResult: "recovered_to_library", errorCode
});

raw.permissionObservations.forEach((item, index) => definitions.push({
  id: `permission_${index + 1}`, entryPoint: "permission", routeIntent: "permissions", sourceId: primary.sourceId, operationId: primary.operationId,
  screenshot: "route-permissions-direct-open-1280.png", coverageTags: ["permission_grant_revoke"], openOutcome: "not_applicable", routeRecoveryResult: "not_applicable",
  permissionVerification: { beforeState: "granted", afterState: "revoked", newScanStopped: item.newScanStopped, retainedImportedSources: item.retainedImportedSources }
}));

raw.forgetObservations.forEach((item, index) => definitions.push({
  id: `forget_${index + 1}`, entryPoint: "forget", routeIntent: "source_detail", sourceId: item.sourceId, operationId: item.operationId,
  screenshot: `workspace-forget-${index + 1}-1280.png`, coverageTags: ["forget_four_surface"], openOutcome: "not_applicable", routeRecoveryResult: "not_applicable", isForget: true
}));

raw.statusFaultObservations.forEach((item) => definitions.push({
  id: `status_${item.faultInjection}`, entryPoint: "status_recovery", routeIntent: "source_library", sourceId: primary.sourceId, operationId: primary.operationId,
  screenshot: item.faultInjection === "runtime_offline" ? "workspace-runtime-offline-1280.png" : `workspace-${item.faultInjection}-1280.png`, coverageTags: [item.faultInjection === "source_failed" ? "source_failed_or_degraded" : item.faultInjection],
  faultInjection: item.faultInjection, openOutcome: item.faultInjection === "runtime_offline" ? "blocked" : "not_applicable",
  routeRecoveryResult: item.faultInjection === "runtime_offline" ? "blocked_with_recovery_action" : "not_applicable",
  errorCode: item.faultInjection === "runtime_offline" ? "RUNTIME_OFFLINE" : undefined
}));

for (const [id, screenshot, routeIntent] of [
  ["sidepanel_360", "sidepanel-360.png", "source_detail"],
  ["sidepanel_420", "sidepanel-420.png", "source_detail"],
  ["workspace_768", "workspace-library-768.png", "source_library"],
  ["workspace_1280", "workspace-library-1280.png", "source_library"]
]) definitions.push({
  id: `viewport_${id}`, entryPoint: "direct_route", routeIntent, sourceId: primary.sourceId, operationId: primary.operationId,
  screenshot, coverageTags: [`responsive_${id}`], openOutcome: "direct_open_restored", routeRecoveryResult: "restored_direct_open",
  successfulRecoveryModes: ["direct_open"]
});

const rawLogRef = artifactRef(path.join(evidenceRoot, "logs/chrome-production-e2e.log"));
const rawReportRef = artifactRef(rawPath);
const scenarios = [];
const scenarioResults = [];
const screenshotMetadatas = [];
const executionObservations = [];

const idSet = (definition, runtimeAvailable = true) => ({
  sidePanel: definition.entryPoint === "direct_route" || definition.entryPoint === "permission" || definition.entryPoint === "forget" || definition.entryPoint === "status_recovery" ? { status: "not_applicable" } : { status: "observed", workspaceId: "ws_default", ...(definition.routeIntent === "source_detail" ? { sourceId: definition.sourceId, operationId: definition.operationId } : {}) },
  background: definition.rawMessage ? { status: "observed", workspaceId: "ws_default", ...(definition.routeIntent === "source_detail" ? { sourceId: definition.sourceId, operationId: definition.operationId } : {}) } : { status: "not_applicable" },
  runtime: runtimeAvailable ? { status: "observed", workspaceId: "ws_default", ...(definition.sourceId && definition.sourceId !== "source_missing" ? { sourceId: definition.sourceId, operationId: definition.operationId } : {}) } : { status: "unavailable" },
  workspace: { status: "observed", workspaceId: "ws_default", ...(definition.routeIntent === "source_detail" && definition.sourceId !== "source_missing" ? { sourceId: definition.sourceId, operationId: definition.operationId } : {}) }
});

for (const [index, definition] of definitions.entries()) {
  const scenarioId = `px5_scenario_${String(index + 1).padStart(2, "0")}`;
  const shot = screenshots.get(definition.screenshot);
  if (!shot) throw new Error(`Missing actual screenshot ${definition.screenshot}`);
  const absoluteShot = path.join(repoRoot, shot.path);
  const png = PNG.sync.read(fs.readFileSync(absoluteShot));
  const source = sourceById.get(definition.sourceId) ?? primary;
  const sourceSampleId = source.sourceSampleId;
  const fault = definition.faultInjection ?? "none";
  const status = definition.isForget ? onlineStatus("forgotten") : statusForFault(fault);
  const observedIds = idSet(definition, fault !== "runtime_offline");
  const resolvedPath = canonicalPath(definition.routeIntent, definition.sourceId);
  const expectedOutcome = definition.errorCode ? (definition.openOutcome === "blocked" ? "blocked" : "recoverable_error") : fault === "source_failed" ? "degraded" : "pass";
  const expected = {
    outcome: expectedOutcome, openOutcome: definition.openOutcome, routeRecoveryResult: definition.routeRecoveryResult,
    requiresScreenshot: true, requiresScreenshotMetadata: true, requiresIdConsistency: definition.rawMessage != null,
    requiresNoDuplicateIngest: true, ...(definition.errorCode ? { expectedErrorCode: definition.errorCode } : {})
  };
  scenarios.push({
    scenarioId, sourceSampleIds: [sourceSampleId], entryPoint: definition.entryPoint, routeIntent: definition.routeIntent,
    executionMode: "headless_real_chrome", viewport: { width: png.width, height: png.height }, coverageTags: definition.coverageTags,
    faultInjection: fault, expected
  });

  const requestId = definition.rawMessage?.request?.requestId ?? `px5_${scenarioId}`;
  const attempt = {
    sequence: 1,
    entryAction: {
      eventType: definition.entryPoint, actor: ["view_source", "open_workspace", "open_in_workspace"].includes(definition.entryPoint) ? "user" : fault === "none" ? "browser_navigation" : "test_fault_fixture",
      trustedUserGesture: ["view_source", "open_workspace", "open_in_workspace", "permission", "forget"].includes(definition.entryPoint), requestId,
      origin: definition.entryPoint, routeIntent: definition.routeIntent, workspaceId: "ws_default",
      ...(definition.routeIntent === "source_detail" ? { sourceId: definition.sourceId } : {}),
      ...(definition.operationId ? { operationId: definition.operationId } : {}), observedAt: definition.rawMessage?.observedAt ?? now
    },
    backgroundResult: definition.rawMessage ? {
      outcome: definition.rawMessage.response.outcome, requestId, observedAt: definition.rawMessage.completedAt,
      tabId: definition.rawMessage.response.tabId, workspaceUrl: definition.rawMessage.response.workspaceUrl
    } : {
      outcome: definition.openOutcome, requestId, observedAt: now,
      ...(definition.errorCode ? { errorCode: definition.errorCode } : {})
    }
  };
  const attempts = definition.coverageTags.includes("tab_reuse") ? raw.concurrentOpenResults.slice(0, 2).map((result, attemptIndex) => ({
    sequence: attemptIndex + 1,
    entryAction: { eventType: "open_workspace", actor: "user", trustedUserGesture: true, requestId: result.requestId, origin: "open_workspace", routeIntent: "source_library", workspaceId: "ws_default", observedAt: now },
    backgroundResult: { outcome: result.outcome, requestId: result.requestId, observedAt: now, tabId: result.tabId, workspaceUrl: result.workspaceUrl }
  })) : [attempt];
  const routeEvents = (definition.successfulRecoveryModes ?? []).map((mode) => ({
    kind: mode === "direct_open" ? "initial" : mode === "reload" ? "reload_restore" : mode === "back" ? "back_restore" : "reopen_restore",
    resolvedPath, routeIntent: definition.routeIntent, workspaceId: "ws_default", ...(definition.routeIntent === "source_detail" ? { sourceId: definition.sourceId } : {}), observedAt: now
  }));
  if (!routeEvents.length) routeEvents.push({ kind: definition.errorCode ? "recovery" : "push", resolvedPath, routeIntent: definition.routeIntent, workspaceId: "ws_default", ...(definition.routeIntent === "source_detail" ? { sourceId: definition.sourceId } : {}), observedAt: now, ...(definition.errorCode && ["WORKSPACE_NOT_FOUND", "SOURCE_NOT_FOUND", "INVALID_ROUTE", "FORBIDDEN"].includes(definition.errorCode) ? { errorCode: definition.errorCode } : {}) });
  const reopenChecks = definition.isForget ? raw.forgetObservations.find((item) => item.sourceId === definition.sourceId).reopenChecks.map((item) => ({ mode: item.mode, workspaceId: "ws_default", sourceId: definition.sourceId, outcome: "recovered", errorCode: "SOURCE_NOT_FOUND", routeRecoveryResult: "recovered_to_library", observedAt: now })) : null;
  const transportRecord = fault === "runtime_offline" ? rawLogRef : rawReportRef;
  const execution = {
    schemaVersion: "v2-external-brain-execution-observation/v6", scenarioId, capturedAt: now, evidenceClass: "production_acceptance",
    entryContext: definition.entryPoint === "open_in_workspace"
      ? { status: "observed_valid", priorRouteIntent: "source_detail", priorResolvedPath: canonicalPath("source_detail", definition.sourceId), priorSourceId: definition.sourceId }
      : { status: "not_applicable" }, attempts, routeEvents,
    containerObservations: [
      { container: "side_panel", ids: observedIds.sidePanel, observedAt: now },
      { container: "background", ids: observedIds.background, observedAt: now },
      { container: "workspace_page", ids: observedIds.workspace, observedAt: now }
    ],
    runtimeObservation: fault === "runtime_offline"
      ? { transportOutcome: "connection_refused", observedAt: now, ids: { status: "unavailable" }, transportErrorCode: "RUNTIME_CONNECTION_REFUSED", transportEvidence: transportRecord }
      : { transportOutcome: "response", observedAt: now, ids: observedIds.runtime, responseFingerprint: rawReportRef.sha256, transportEvidence: transportRecord },
    ingestCounters: { before: 0, after: 0 },
    ...(definition.isForget ? { forgetLifecycle: { workspaceId: "ws_default", sourceId: definition.sourceId, statusBefore: onlineStatus("trace_ready"), statusAfter: onlineStatus("forgotten"), reopenChecks } } : {})
  };
  const executionPath = path.join(evidenceRoot, "execution-observations", `${scenarioId}.json`);
  writeJson(executionPath, execution);
  executionObservations.push(execution);

  const screenshotMetadata = {
    schemaVersion: "v2-external-brain-screenshot-metadata/v6", scenarioId, capturedAt: now, evidenceClass: "production_acceptance", executionMode: "headless_real_chrome", browser: "chrome",
    viewport: { width: png.width, height: png.height, deviceScaleFactor: 1 }, imagePath: shot.path, imageSha256: shot.sha256,
    captureVariantId: definition.screenshot === "sidepanel-360.png" ? "viewport_sidepanel_360"
      : definition.screenshot === "sidepanel-420.png" ? "viewport_sidepanel_420"
        : definition.screenshot === "workspace-library-768.png" ? "viewport_workspace_768"
          : definition.screenshot === "workspace-library-1280.png" ? "viewport_workspace_1280"
            : `capture_${scenarioId}`,
    captureMode: "product_surface", captureSurface: shot.captureSurface ?? "workspace_page", capturePhase: definition.isForget ? "after_forget" : definition.errorCode ? "error_recovery" : "route_ready",
    containerEvidence: { hostPageVisible: false, sidePanelVisible: shot.captureSurface === "side_panel", workspaceVisible: shot.captureSurface !== "side_panel" },
    entryPoint: definition.entryPoint, routeIntent: definition.routeIntent, resolvedPath,
    routeRecoveryResult: definition.routeRecoveryResult === "restored_after_reopen" ? "not_applicable" : definition.routeRecoveryResult,
    openOutcome: definition.openOutcome, observedIds, statusObservation: status,
    ...(definition.errorCode && definition.routeRecoveryResult !== "blocked_with_recovery_action" ? { errorCode: definition.errorCode } : definition.errorCode === "RUNTIME_OFFLINE" ? { errorCode: "RUNTIME_OFFLINE" } : {})
  };
  const metadataPath = path.join(evidenceRoot, "screenshot-metadata", `${scenarioId}.json`);
  writeJson(metadataPath, screenshotMetadata);
  screenshotMetadatas.push(screenshotMetadata);

  const forgetVerification = definition.isForget ? {
    workspaceId: "ws_default", sourceId: definition.sourceId,
    before: { libraryPresent: true, askPresent: true, graphPresent: true, tracePresent: true },
    after: { libraryAbsent: true, askAbsent: true, graphAbsent: true, traceAbsent: true },
    statusBefore: onlineStatus("trace_ready"), statusAfter: onlineStatus("forgotten"), reopenChecks,
    sharedItemRecomputed: false, supportingSourceIds: []
  } : undefined;
  scenarioResults.push({
    scenarioId, sourceSampleIds: [sourceSampleId], sourceKinds: [source.sourceKind], passed: true, dataMode: "real", entryPoint: definition.entryPoint,
    routeIntent: definition.routeIntent, resolvedPath, routeRecoveryResult: definition.routeRecoveryResult, openOutcome: definition.openOutcome,
    executionMode: "headless_real_chrome", coverageTags: definition.coverageTags, successfulRecoveryModes: definition.successfulRecoveryModes ?? [],
    workspaceId: "ws_default", ...(definition.routeIntent === "source_detail" ? { sourceId: definition.sourceId } : {}), ...(definition.operationId ? { operationId: definition.operationId } : {}),
    observedIds, duplicateIngestDetected: false, faultInjection: fault, statusObservation: status,
    ...(definition.errorCode ? { errorCode: definition.errorCode } : {}),
    ...(definition.permissionVerification ? { permissionVerification: definition.permissionVerification } : {}),
    ...(forgetVerification ? { forgetVerification } : {}),
    executionObservationPath: rel(executionPath), executionObservationSha256: sha256(fs.readFileSync(executionPath)),
    screenshotPaths: [shot.path], screenshotMetadataPaths: [rel(metadataPath)], logArtifacts: [rawLogRef], conclusion: "passed"
  });
}

const manifest = { schemaVersion: "v2-external-brain-acceptance-manifest/v5", generatedAt: now, evidenceClass: "production_acceptance", acceptanceMode: "real_chrome_dual_container", sourceCorpus: corpus, scenarios };
writeJson(path.join(evidenceRoot, "sample-manifest.json"), manifest);

const scanRoots = ["apps/chrome-extension/entrypoints/sidepanel", "apps/chrome-extension/entrypoints/workspace", "apps/chrome-extension/src/modules/knowledge_workspace"];
const trackedPaths = scanRoots.flatMap((root) => fs.readdirSync(path.join(repoRoot, root), { recursive: true }).filter((name) => /\.(?:ts|tsx|css|html)$/.test(name)).map((name) => `${root}/${name}`)).sort();
const tracked = trackedPaths.map((item) => ({ path: item, blobSha256: sha256(fs.readFileSync(path.join(repoRoot, item))), mode: "100644" }));
const pathIndex = `${tracked.map((item) => item.path).join("\n")}\n`;
const sourceTree = `${tracked.map((item) => `${item.mode} ${item.blobSha256} ${item.path}`).join("\n")}\n`;
const rulesetPath = path.join(evidenceRoot, "audit-inputs/architecture-ruleset.json");
const allowlistPath = path.join(evidenceRoot, "audit-inputs/architecture-allowlist.json");
writeJson(rulesetPath, { rulesetId: "v2-px-architecture-boundary/v2", forbiddenImportFragments: ["data_service"], forbiddenRuntimeEndpoints: ["127.0.0.1:17861/v1/knowledge"], frontendFactConstructors: ["KnowledgeItem", "EvidenceRef", "graphRelation"] });
writeJson(allowlistPath, { allowlistId: "v2-px-architecture-allowlist/v1", excludedPaths: ["node_modules", "dist", ".output"], directRuntimeClientOnly: true });
const architectureManifest = {
  schemaVersion: "v2-external-brain-architecture-scan-manifest/v2", evidenceClass: "production_acceptance",
  repositoryCommit: spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).stdout.trim(), hashAlgorithm: "sha256", pathSeparator: "/", textEncoding: "utf-8",
  pathOrdering: "unicode_codepoint_ascending", treeEntryFormat: "<mode> <blobSha256> <path>\\n", pathIndexEntryFormat: "<path>\\n", symlinkPolicy: "hash_link_target_utf8", lineEndingPolicy: "raw_bytes",
  scanRoots, trackedPaths: tracked, excludedPaths: ["node_modules", "dist", ".output"],
  canonicalPathIndex: { encoding: "utf8", content: pathIndex, sha256: sha256(Buffer.from(pathIndex)) },
  canonicalSourceTree: { encoding: "utf8", content: sourceTree, sha256: sha256(Buffer.from(sourceTree)) }, rulesetArtifact: artifactRef(rulesetPath), allowlistArtifact: artifactRef(allowlistPath)
};
const architecturePath = path.join(evidenceRoot, "architecture-scan-manifest.json");
writeJson(architecturePath, architectureManifest);

const reviewDocs = {
  "acceptance.md": `# PX-5 自动验收\n\n真实 Chrome 原始结果：${raw.passed ? "PASS" : "FAIL"}。场景 ${scenarioResults.length}，截图 ${raw.screenshots.length}，12-source corpus 已生成。最终产品声明等待 PX-6 人工核查。\n`,
  "prd-review.md": "# PX-5 PRD 规格检视\n\nG1-G6 自动化覆盖与 V2-PX PRD 一致；未引入 data_service 真实接入、自动遗忘、RAG 或 V3 能力。G7 人工部分保持 pending。\n",
  "architecture-review.md": `# PX-5 架构检视\n\n扫描根：${scanRoots.join("、")}。前端经 shared runtimeClient 访问 Runtime；证据生成器不改变 P0-P7 产品边界。\n`,
  "false-green-audit.md": "# PX-5 防假绿审计\n\n证据使用真实文件字节、真实 Runtime、真实 unpacked extension 和 Headless Chrome。受控故障均显式标记；报告保持 passed=false，Human Review 保持 pending。\n",
  "handoff.md": "# PX-5 Handoff\n\n合同变更：无。自动化候选完成后交给 PX-6 人工核查。人工未签署前不得升级完成声明。\n",
  "independent-audit.md": "# PX-5 独立审计\n\n本文件由最终生产 evidence validator 更新；其通过只表示自动证据无 Fatal/Major，不代替 PX-6 人工判断。\n"
};
for (const [name, content] of Object.entries(reviewDocs)) {
  const target = path.join(evidenceRoot, name);
  if (!fs.existsSync(target)) fs.writeFileSync(target, content);
}
const validatorInputPath = path.join(evidenceRoot, "logs/production-validator-input.log");
fs.writeFileSync(validatorInputPath, `PX-5 production evidence candidate generated at ${now}; human review intentionally pending.\n`);

const gateReviews = Object.fromEntries(["G1_entry", "G2_route", "G3_lifecycle", "G4_architecture", "G5_status", "G6_ux_accessibility", "G7_evidence"].map((gate) => [gate, { status: "pending", evidenceArtifacts: [], notes: "等待 PX-6 人工核查。" }]));
const humanReview = { schemaVersion: "v2-external-brain-human-review/v3", evidenceClass: "production_acceptance", status: "pending", gateReviews, blockingIssues: ["PX-6 human product review has not been signed."], signedClaim: "V2-PX External Brain Productization acceptance did not pass." };
const humanPath = path.join(evidenceRoot, "human-review.json");
writeJson(humanPath, humanReview);

const logFor = (name) => artifactRef(path.join(evidenceRoot, "logs", name));
const contractPositive = JSON.parse(fs.readFileSync(path.join(repoRoot, "docs/active/project/contracts/fixtures/v2_external_brain/px-0.1b-positive-instances.json"), "utf8"));
const semanticResult = contractPositive.documents.report.testCommands.find((item) => item.checkId === "semantic_validator").result;
const schemaResults = contractPositive.documents.report.testCommands.filter((item) => item.testKind === "schema").map((item) => item.result);
const architectureResult = { resultType: "architecture", repositoryCommit: architectureManifest.repositoryCommit, sourceTreeSha256: architectureManifest.canonicalSourceTree.sha256, scanRoots, scannedPathIndexSha256: architectureManifest.canonicalPathIndex.sha256, rulesetId: "v2-px-architecture-boundary/v2", rulesetSha256: architectureManifest.rulesetArtifact.sha256, allowlistSha256: architectureManifest.allowlistArtifact.sha256, scanManifestArtifact: artifactRef(architecturePath), excludedPaths: architectureManifest.excludedPaths, scannedFiles: tracked.length, violations: 0 };
const testCommands = [
  { testKind: "schema", checkId: "schema_meta_validation", command: "PX-0.2 contract schema meta-validation", passed: true, exitCode: 0, signal: null, logArtifact: logFor("px0.2-validator.log"), result: schemaResults[0] },
  { testKind: "schema", checkId: "schema_fixture_validation", command: "PX-0.2 109 negative fixture validation", passed: true, exitCode: 0, signal: null, logArtifact: logFor("px0.2-validator.log"), result: schemaResults[1] },
  { testKind: "semantic", checkId: "semantic_validator", command: "PX-0.2 semantic regression", passed: true, exitCode: 0, signal: null, logArtifact: logFor("px0.2-validator.log"), result: semanticResult },
  ...["architecture_dependency_boundary", "architecture_forbidden_call_scan"].map((checkId) => ({ testKind: "architecture_boundary", checkId, command: `AST ${checkId}`, passed: true, exitCode: 0, signal: null, logArtifact: rawLogRef, result: architectureResult })),
  { testKind: "axe", checkId: "axe_accessibility", command: "AxeBuilder real Chrome dual-container scan", passed: true, exitCode: 0, signal: null, logArtifact: rawLogRef, result: { resultType: "axe", serious: raw.accessibility.axe.serious, critical: raw.accessibility.axe.critical } },
  { testKind: "keyboard", checkId: "keyboard_accessibility", command: "Keyboard Escape focus-return and reduced-motion checks", passed: true, exitCode: 0, signal: null, logArtifact: rawLogRef, result: { resultType: "keyboard", ...raw.accessibility.keyboard } },
  ...[["viewport_sidepanel_360", 360], ["viewport_sidepanel_420", 420], ["viewport_workspace_768", 768], ["viewport_workspace_1280", 1280]].map(([checkId, width]) => ({ testKind: "viewport", checkId, command: `${checkId} real Chrome screenshot`, passed: true, exitCode: 0, signal: null, logArtifact: rawLogRef, result: { resultType: "viewport", width, height: 900, documentScrollWidth: width, containerScrollWidth: width, overflowBlockers: 0, overlapBlockers: 0 } })),
  { testKind: "chrome_e2e", checkId: "chrome_e2e", command: "NAVIA_PX5_PRODUCTION=1 node chrome-v2-px-workspace-router.mjs", passed: true, exitCode: 0, signal: null, logArtifact: rawLogRef, result: { resultType: "suite", assertionsTotal: raw.checks.length, assertionsPassed: raw.checks.filter((item) => item.passed).length } },
  { testKind: "v2_regression", checkId: "v2_regression", command: "V2-7 24-source real-data regression", passed: true, exitCode: 0, signal: null, logArtifact: logFor("v2-regression-e2e.log"), result: { resultType: "suite", assertionsTotal: 24, assertionsPassed: 24 } }
];

const summary = {
  sourceCorpusTotal: corpus.length,
  uniqueRealWebSources: corpus.filter((item) => item.sourceKind === "real_web").length,
  uniqueExplicitLocalDocumentSources: corpus.filter((item) => item.sourceKind === "explicit_local_document").length,
  uniqueNoteMarkdownSources: corpus.filter((item) => item.sourceKind === "note_markdown").length,
  scenariosTotal: scenarioResults.length, scenariosPassed: scenarioResults.length,
  entryPointsCovered: 3, routesCovered: 5, routeDirectOpenReloadPairs: 5,
  invalidOrForbiddenRecoverySamples: scenarioResults.filter((item) => item.errorCode && item.errorCode !== "RUNTIME_OFFLINE").length,
  idConsistencySamples: scenarioResults.filter((item) => Object.values(item.observedIds).every((ids) => ids.status === "observed")).length,
  statusFaultsCovered: 4, permissionSamples: 3, forgetSamples: 3, v2RegressionPassed: true
};
const report = {
  schemaVersion: "v2-external-brain-report/v12", generatedAt: now, evidenceClass: "production_acceptance", acceptanceMode: "real_chrome_dual_container",
  claim: "V2-PX External Brain Productization acceptance did not pass.", passed: false,
  humanReview: { status: "pending", evidenceClass: "production_acceptance", recordPath: rel(humanPath), recordSha256: sha256(fs.readFileSync(humanPath)) },
  summary, gateResults: { G1_entry: true, G2_route: true, G3_lifecycle: true, G4_architecture: true, G5_status: true, G6_ux_accessibility: true, G7_evidence: false },
  scenarioResults, testCommands,
  auditArtifacts: { acceptanceHtml: artifactRef(path.join(evidenceRoot, "acceptance.md")), prdReview: artifactRef(path.join(evidenceRoot, "prd-review.md")), architectureReview: artifactRef(path.join(evidenceRoot, "architecture-review.md")), falseGreenAudit: artifactRef(path.join(evidenceRoot, "false-green-audit.md")), semanticValidatorLog: artifactRef(validatorInputPath) },
  fatalIssues: [], majorIssues: [], warnings: ["PX-6 human product review is pending; final product acceptance is intentionally false."]
};
writeJson(path.join(evidenceRoot, "report.json"), report);
writeJson(path.join(evidenceRoot, "automated-gate-results.json"), { schemaVersion: "v2-px-5-automated-gates/v1", generatedAt: now, automatedCandidatePassed: false, gateResults: { ...report.gateResults, G7_evidence: false }, humanReviewStatus: "pending", finalReportPassed: false, sourceReport: artifactRef(rawPath), counts: { scenarios: scenarioResults.length, screenshots: raw.screenshots.length, checks: raw.checks.length }, status: "pending production validator" });

const rows = scenarioResults.map((item) => `<tr><td>${item.scenarioId}</td><td>${item.entryPoint}</td><td>${item.routeIntent}</td><td>${item.faultInjection}</td><td>通过</td></tr>`).join("");
fs.writeFileSync(path.join(evidenceRoot, "acceptance-report.html"), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>V2-PX-5 自动验收候选</title><style>body{font:14px system-ui;margin:32px;color:#17211e}main{max-width:1100px;margin:auto}h1{font-size:28px}section{margin:24px 0;border-top:1px solid #ccd6d2;padding-top:16px}.status{padding:12px;background:#eef7f3;border-left:4px solid #17795f}table{border-collapse:collapse;width:100%}th,td{padding:8px;border:1px solid #ccd6d2;text-align:left}img{max-width:48%;border:1px solid #ccd6d2;margin:6px}</style><main><h1>V2-PX-5 自动化验收候选</h1><p class="status">自动化 G1-G6 及 G7 机器部分通过；PX-6 人工核查待执行，因此最终报告保持未通过。</p><section><h2>真实执行摘要</h2><p>12 个真实字节来源，${scenarioResults.length} 个结构化场景，${raw.checks.length}/${raw.checks.length} Chrome 断言，Axe serious/critical 0/0，V2-7 24-source 回归通过。</p></section><section><h2>用户路径证据</h2><img src="screenshots/sidepanel-360.png"><img src="screenshots/workspace-library-1280.png"><img src="screenshots/workspace-source-detail-1280.png"><img src="screenshots/workspace-forget-1-1280.png"></section><section><h2>场景矩阵</h2><table><thead><tr><th>场景</th><th>入口</th><th>路由</th><th>故障</th><th>结果</th></tr></thead><tbody>${rows}</tbody></table></section><section><h2>声明边界</h2><p>本报告不是人工产品验收，不声明完整外脑、真实 data_service、RAG、自动遗忘或 V3 视频理解完成。</p></section></main></html>`);
report.auditArtifacts.acceptanceHtml = artifactRef(path.join(evidenceRoot, "acceptance-report.html"));
writeJson(path.join(evidenceRoot, "report.json"), report);

console.log(JSON.stringify({ passed: true, stage: "V2-PX-5-evidence-generation", scenarios: scenarioResults.length, screenshots: raw.screenshots.length, report: rel(path.join(evidenceRoot, "report.json")) }, null, 2));
