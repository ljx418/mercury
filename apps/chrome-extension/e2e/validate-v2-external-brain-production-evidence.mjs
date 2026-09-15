import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import ts from "typescript";
import { runSchemaRequests } from "./validate-v2-external-brain-productization-report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const evidenceRoot = path.join(repoRoot, "docs/active/project/evidence/v2_external_brain_productization/px-5");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const manifest = readJson(path.join(evidenceRoot, "sample-manifest.json"));
const report = readJson(path.join(evidenceRoot, "report.json"));
const human = readJson(path.join(evidenceRoot, "human-review.json"));
const architecture = readJson(path.join(evidenceRoot, "architecture-scan-manifest.json"));
const observations = fs.readdirSync(path.join(evidenceRoot, "execution-observations")).filter((name) => name.endsWith(".json")).sort().map((name) => readJson(path.join(evidenceRoot, "execution-observations", name)));
const screenshots = fs.readdirSync(path.join(evidenceRoot, "screenshot-metadata")).filter((name) => name.endsWith(".json")).sort().map((name) => readJson(path.join(evidenceRoot, "screenshot-metadata", name)));
const issues = [];
const gate = {};
const fail = (message) => issues.push(message);

const schemaRequests = [
  { schema: "manifest", instance: manifest }, { schema: "report", instance: report }, { schema: "human", instance: human }, { schema: "architecture", instance: architecture },
  ...observations.map((instance) => ({ schema: "execution", instance })), ...screenshots.map((instance) => ({ schema: "screenshot", instance }))
];
runSchemaRequests(schemaRequests).forEach((result, index) => { if (!result.valid) fail(`schema request ${index + 1}: ${result.error}`); });

function artifact(pathValue, expectedHash) {
  if (!pathValue || path.isAbsolute(pathValue) || pathValue.split("/").includes("..") || pathValue.startsWith("virtual/")) return false;
  const absolute = path.join(repoRoot, pathValue);
  return fs.existsSync(absolute) && sha256(fs.readFileSync(absolute)) === expectedHash;
}

for (const source of manifest.sourceCorpus) {
  if (!artifact(source.contentFingerprint.artifactPath, source.contentFingerprint.value)) fail(`source fingerprint mismatch: ${source.sourceSampleId}`);
}
for (const result of report.scenarioResults) {
  if (!artifact(result.executionObservationPath, result.executionObservationSha256)) fail(`execution observation mismatch: ${result.scenarioId}`);
  for (const ref of result.logArtifacts) if (!artifact(ref.path, ref.sha256)) fail(`scenario log mismatch: ${result.scenarioId}`);
  for (const screenshotPath of result.screenshotPaths) if (!fs.existsSync(path.join(repoRoot, screenshotPath))) fail(`missing screenshot: ${screenshotPath}`);
  for (const metadataPath of result.screenshotMetadataPaths) if (!fs.existsSync(path.join(repoRoot, metadataPath))) fail(`missing screenshot metadata: ${metadataPath}`);
}
for (const ref of [report.humanReview, ...Object.values(report.auditArtifacts), ...report.testCommands.map((item) => item.logArtifact)]) {
  const pathValue = ref.recordPath ?? ref.path; const hash = ref.recordSha256 ?? ref.sha256;
  if (!artifact(pathValue, hash)) fail(`report artifact mismatch: ${pathValue}`);
}

const manifestScenarios = new Map(manifest.scenarios.map((item) => [item.scenarioId, item]));
const resultScenarios = new Map(report.scenarioResults.map((item) => [item.scenarioId, item]));
const observationScenarios = new Map(observations.map((item) => [item.scenarioId, item]));
const screenshotScenarios = new Map(screenshots.map((item) => [item.scenarioId, item]));
const scenarioIds = [...manifestScenarios.keys()].sort();
if (JSON.stringify(scenarioIds) !== JSON.stringify([...resultScenarios.keys()].sort()) || JSON.stringify(scenarioIds) !== JSON.stringify([...observationScenarios.keys()].sort()) || JSON.stringify(scenarioIds) !== JSON.stringify([...screenshotScenarios.keys()].sort())) fail("scenario sets differ");

for (const shot of screenshots) {
  const absolute = path.join(repoRoot, shot.imagePath);
  if (!fs.existsSync(absolute) || sha256(fs.readFileSync(absolute)) !== shot.imageSha256) { fail(`screenshot hash mismatch: ${shot.scenarioId}`); continue; }
  try {
    const decoded = PNG.sync.read(fs.readFileSync(absolute));
    if (decoded.width !== shot.viewport.width || decoded.height !== shot.viewport.height) fail(`screenshot dimensions mismatch: ${shot.scenarioId}`);
  } catch { fail(`screenshot decode failed: ${shot.scenarioId}`); }
  const expectedViewport = manifestScenarios.get(shot.scenarioId)?.viewport;
  if (expectedViewport?.width !== shot.viewport.width || expectedViewport?.height !== shot.viewport.height) fail(`manifest/screenshot viewport mismatch: ${shot.scenarioId}`);
}
const surfaceWidths = new Map([[360, "side_panel"], [420, "side_panel"], [768, "workspace_page"], [1280, "workspace_page"]]);
for (const [width, surface] of surfaceWidths) if (!screenshots.some((shot) => shot.viewport.width === width && shot.captureSurface === surface)) fail(`missing ${width}px ${surface} screenshot`);

const entryCounts = Object.fromEntries(["open_workspace", "view_source", "open_in_workspace"].map((entry) => [entry, report.scenarioResults.filter((item) => item.entryPoint === entry && item.passed).length]));
gate.G1_entry = Object.values(entryCounts).every((count) => count >= 2) && report.scenarioResults.filter((item) => item.entryPoint === "view_source" && item.statusObservation.sourceBuildStatus === "trace_ready").length >= 3
  && observations.filter((item) => ["open_workspace", "view_source", "open_in_workspace"].includes(item.attempts[0]?.entryAction.eventType)).every((item) => item.attempts.every((attempt) => attempt.entryAction.trustedUserGesture && attempt.entryAction.requestId === attempt.backgroundResult.requestId));

gate.G2_route = ["source_library", "source_detail", "ask", "graph", "permissions"].every((route) => {
  const modes = new Set(report.scenarioResults.filter((item) => item.routeIntent === route).flatMap((item) => item.successfulRecoveryModes));
  return ["direct_open", "reload", "back", "reopen"].every((mode) => modes.has(mode));
}) && report.scenarioResults.filter((item) => ["WORKSPACE_NOT_FOUND", "SOURCE_NOT_FOUND", "FORBIDDEN", "INVALID_ROUTE"].includes(item.errorCode)).length >= 2;

const forgetResults = report.scenarioResults.filter((item) => item.forgetVerification);
const permissionResults = report.scenarioResults.filter((item) => item.permissionVerification);
const crossContainer = report.scenarioResults.filter((item) => Object.values(item.observedIds).every((entry) => entry.status === "observed"));
const tabReuse = observations.some((item) => item.attempts.length >= 2 && item.attempts[0].backgroundResult.outcome === "created_new" && item.attempts[1].backgroundResult.outcome === "focused_existing" && item.attempts[0].backgroundResult.tabId === item.attempts[1].backgroundResult.tabId && item.ingestCounters.before === item.ingestCounters.after);
gate.G3_lifecycle = crossContainer.length >= 4 && tabReuse && permissionResults.length >= 3 && permissionResults.every((item) => item.permissionVerification.newScanStopped && item.permissionVerification.retainedImportedSources)
  && forgetResults.length >= 3 && forgetResults.every((item) => item.forgetVerification.reopenChecks.length === 4 && item.forgetVerification.reopenChecks.every((check) => check.sourceId === item.sourceId && check.workspaceId === item.workspaceId && check.errorCode === "SOURCE_NOT_FOUND"));

function architectureViolations() {
  const requiredRoots = ["apps/chrome-extension/entrypoints/sidepanel", "apps/chrome-extension/entrypoints/workspace", "apps/chrome-extension/src/modules/knowledge_workspace"];
  if (JSON.stringify([...architecture.scanRoots].sort()) !== JSON.stringify(requiredRoots.sort())) return 1;
  const paths = architecture.trackedPaths.map((item) => item.path).sort();
  const pathIndex = `${paths.join("\n")}\n`;
  const tree = `${[...architecture.trackedPaths].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map((item) => `${item.mode} ${item.blobSha256} ${item.path}`).join("\n")}\n`;
  if (architecture.canonicalPathIndex.content !== pathIndex || architecture.canonicalPathIndex.sha256 !== sha256(Buffer.from(pathIndex)) || architecture.canonicalSourceTree.content !== tree || architecture.canonicalSourceTree.sha256 !== sha256(Buffer.from(tree))) return 1;
  let violations = 0;
  for (const tracked of architecture.trackedPaths) {
    const absolute = path.join(repoRoot, tracked.path);
    if (!fs.existsSync(absolute) || sha256(fs.readFileSync(absolute)) !== tracked.blobSha256) { violations += 1; continue; }
    if (!/\.[jt]sx?$/.test(tracked.path)) continue;
    const source = fs.readFileSync(absolute, "utf8");
    const ast = ts.createSourceFile(tracked.path, source, ts.ScriptTarget.Latest, true, tracked.path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node) => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && ts.isStringLiteralLike(node.moduleSpecifier) && node.moduleSpecifier.text.includes("data_service")) violations += 1;
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const expression = node.expression?.getText(ast).replace(/^(window|globalThis)\./, "");
        if (["KnowledgeItem", "EvidenceRef", "graphRelation"].includes(expression)) violations += 1;
        if (["fetch", "axios.get", "axios.post", "WebSocket", "EventSource", "XMLHttpRequest"].includes(expression)) {
          const text = node.arguments?.[0]?.getText(ast) ?? "";
          if (/localhost|127\.0\.0\.1|data_service|\/v1\/knowledge/.test(text)) violations += 1;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  return violations;
}
const computedArchitectureViolations = architectureViolations();
gate.G4_architecture = computedArchitectureViolations === 0 && report.testCommands.filter((item) => item.testKind === "architecture_boundary").length === 2 && report.testCommands.filter((item) => item.testKind === "architecture_boundary").every((item) => item.result.violations === 0);

gate.G5_status = ["runtime_offline", "adapter_blocked", "data_service_unreachable", "source_failed"].every((fault) => report.scenarioResults.some((item) => item.faultInjection === fault));
const commands = new Map(report.testCommands.map((item) => [item.checkId, item]));
const axe = commands.get("axe_accessibility")?.result; const keyboard = commands.get("keyboard_accessibility")?.result;
gate.G6_ux_accessibility = axe?.serious === 0 && axe?.critical === 0 && keyboard?.assertionsTotal === keyboard?.assertionsPassed && keyboard?.focusReturnPassed && keyboard?.escapePassed && keyboard?.reducedMotionPassed
  && ["viewport_sidepanel_360", "viewport_sidepanel_420", "viewport_workspace_768", "viewport_workspace_1280"].every((id) => { const result = commands.get(id)?.result; return result && result.overflowBlockers === 0 && result.overlapBlockers === 0 && result.documentScrollWidth <= result.containerScrollWidth; });
gate.G7_evidence = !issues.length && commands.get("schema_fixture_validation")?.passed && commands.get("semantic_validator")?.passed && commands.get("chrome_e2e")?.passed && commands.get("v2_regression")?.passed;

for (const [name, passed] of Object.entries(gate)) if (!passed) fail(`${name} failed`);
if (report.evidenceClass !== "production_acceptance" || report.acceptanceMode !== "real_chrome_dual_container") fail("production evidence classification invalid");
if (report.passed !== false || report.claim !== "V2-PX External Brain Productization acceptance did not pass." || human.status !== "pending" || report.humanReview.status !== "pending") fail("PX-5 must preserve pending human review and failed final claim");
if (report.scenarioResults.some((item) => item.executionMode !== "headless_real_chrome" || item.dataMode !== "real" || !item.passed)) fail("scenario execution classification invalid");

const output = {
  passed: issues.length === 0, stage: "V2-PX-5-production-evidence-validation", automatedCandidatePassed: issues.length === 0,
  finalReportPassed: report.passed, humanReviewStatus: human.status,
  counts: { schemas: 9, schemaInstances: schemaRequests.length, sources: manifest.sourceCorpus.length, scenarios: report.scenarioResults.length, screenshots: screenshots.length, executionObservations: observations.length, architectureFiles: architecture.trackedPaths.length, architectureViolations: computedArchitectureViolations },
  gateResults: gate, issues
};
fs.writeFileSync(path.join(evidenceRoot, "automated-gate-results.json"), `${JSON.stringify({ schemaVersion: "v2-px-5-automated-gates/v1", generatedAt: new Date().toISOString(), automatedCandidatePassed: output.passed, gateResults: gate, humanReviewStatus: human.status, finalReportPassed: report.passed, sourceReport: { path: path.relative(repoRoot, path.join(evidenceRoot, "report.json")).replaceAll(path.sep, "/"), sha256: sha256(fs.readFileSync(path.join(evidenceRoot, "report.json"))) }, counts: output.counts, issues }, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
if (!output.passed) process.exitCode = 2;
