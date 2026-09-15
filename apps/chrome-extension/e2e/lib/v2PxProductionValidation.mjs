import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { canonicalJson } from "./v2PxRawCollector.mjs";
import { artifactRefFromRecord, listGitEntries, readArtifact, readGitBlob, sha256 } from "./v2PxArtifactReader.mjs";
import { readRuleRegistry, runRuleEngine, scanTypeScriptArchitecture } from "./v2PxSemanticValidation.mjs";

export const HUMAN_RULES = ["PX_RULE_FINAL_GATE_OR_HUMAN_REVIEW_FAILED", "PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID"];

export const PRODUCTION_GATE_RULES = Object.freeze({
  G1: [
    "PX_RULE_ENTRY_COVERAGE_FAILED",
    "PX_RULE_ENTRY_ACTION_OBSERVATION_INVALID",
    "PX_RULE_REQUEST_ID_CORRELATION_INVALID",
    "PX_RULE_ACTION_ROUTE_MISMATCH",
    "PX_RULE_ACTION_ROUTE_SHAPE_INVALID"
  ],
  G2: [
    "PX_RULE_ROUTE_COVERAGE_FAILED",
    "PX_RULE_RECOVERY_COVERAGE_FAILED",
    "PX_RULE_EXPECTED_RESULT_MAPPING_MISMATCH",
    "PX_RULE_ROUTE_PATH_ID_MISMATCH",
    "PX_RULE_HOST_STRATEGY_URL_MISMATCH",
    "PX_RULE_ROUTE_ERROR_CODE_MISMATCH",
    "PX_RULE_OPEN_IN_WORKSPACE_CONTEXT_INVALID",
    "PX_RULE_OPEN_IN_WORKSPACE_CAUSALITY_INVALID",
    "PX_RULE_ATTEMPT_SEQUENCE_INVALID",
    "PX_RULE_ROUTE_EVENT_IDENTITY_INVALID",
    "PX_RULE_ROUTE_ERROR_SHAPE_INVALID",
    "PX_RULE_EXPECTED_RESULT_SHAPE_INVALID"
  ],
  G3: [
    "PX_RULE_IDENTITY_OR_IDEMPOTENCY_FAILED",
    "PX_RULE_GOVERNANCE_COVERAGE_FAILED",
    "PX_RULE_PERMISSION_VERIFICATION_INVALID",
    "PX_RULE_FORGET_FOUR_SURFACE_INVALID",
    "PX_RULE_SHARED_ITEM_RECOMPUTE_INVALID",
    "PX_RULE_EXECUTION_OBSERVATION_INVALID",
    "PX_RULE_TAB_REUSE_SEQUENCE_INVALID",
    "PX_RULE_FORGET_DURABLE_RECOVERY_INVALID",
    "PX_RULE_FORGET_DURABLE_IDENTITY_INVALID"
  ],
  G4: [
    "PX_RULE_ARCHITECTURE_CHECK_COVERAGE_MISSING",
    "PX_RULE_ARCHITECTURE_BOUNDARY_FAILED",
    "PX_RULE_ARCHITECTURE_SCAN_SCOPE_INVALID",
    "PX_RULE_ARCHITECTURE_RESULT_SHAPE_INVALID"
  ],
  G5: [
    "PX_RULE_STATUS_COVERAGE_FAILED",
    "PX_RULE_FAULT_INJECTION_MISMATCH",
    "PX_RULE_RUNTIME_OFFLINE_AUTHORITY_VIOLATION"
  ],
  G6: [
    "PX_RULE_SCREENSHOT_EVIDENCE_INVALID",
    "PX_RULE_SCREENSHOT_METADATA_MISMATCH",
    "PX_RULE_SCREENSHOT_DECODED_DIMENSION_MISMATCH",
    "PX_RULE_VIEWPORT_SURFACE_MAPPING_INVALID",
    "PX_RULE_UX_ACCESSIBILITY_FAILED"
  ],
  G7: [
    "PX_RULE_REPORT_ISSUES_NOT_EMPTY",
    "PX_RULE_CHILD_RESULT_FAILED",
    "PX_RULE_CLAIM_STATUS_MISMATCH",
    "PX_RULE_FINAL_GATE_OR_HUMAN_REVIEW_FAILED",
    "PX_RULE_SOURCE_CORPUS_INVALID",
    "PX_RULE_SCENARIO_ID_DUPLICATED",
    "PX_RULE_SCENARIO_SET_MISMATCH",
    "PX_RULE_SUMMARY_RECOMPUTE_MISMATCH",
    "PX_RULE_SOURCE_DISTRIBUTION_FAILED",
    "PX_RULE_SCENARIO_SOURCE_REFERENCE_INVALID",
    "PX_RULE_SOURCE_KIND_RECOMPUTE_MISMATCH",
    "PX_RULE_ARTIFACT_PATH_OR_HASH_INVALID",
    "PX_RULE_V2_REGRESSION_FAILED",
    "PX_RULE_SCOPE_OVERCLAIM",
    "PX_RULE_COVERAGE_TAG_SEMANTIC_MISMATCH",
    "PX_RULE_TEST_COMMAND_RESULT_INVALID",
    "PX_RULE_SCHEMA_CHECK_SET_MISMATCH",
    "PX_RULE_SEMANTIC_POSITIVE_BASE_INVALID",
    "PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID",
    "PX_RULE_FIXTURE_EVIDENCE_PROMOTION_INVALID",
    "PX_RULE_SOURCE_FIXTURE_UNIQUENESS_INVALID",
    "PX_RULE_SOURCE_CORPUS_SHAPE_INVALID",
    "PX_RULE_HUMAN_REVIEW_SHAPE_INVALID",
    "PX_RULE_SCHEMA_RESULT_SHAPE_INVALID",
    "PX_RULE_SEMANTIC_RESULT_SHAPE_INVALID"
  ]
});

export function deriveProductionGateResults(ruleResults) {
  const resultById = new Map(ruleResults.map((item) => [item.ruleId, item]));
  if (resultById.size !== ruleResults.length) throw new Error("Production validation contains duplicate RuleId results.");
  const mapped = Object.values(PRODUCTION_GATE_RULES).flat();
  if (new Set(mapped).size !== mapped.length) throw new Error("Production gate mapping contains duplicate RuleId values.");
  const actualIds = [...resultById.keys()].sort();
  const mappedIds = [...mapped].sort();
  if (!deepEqual(actualIds, mappedIds)) throw new Error("Production gate mapping does not exactly cover the RuleId registry.");
  return Object.fromEntries(Object.entries(PRODUCTION_GATE_RULES).map(([gateId, ruleIds]) => {
    const statuses = ruleIds.map((ruleId) => resultById.get(ruleId).status);
    const status = statuses.includes("failed") || statuses.includes("not_applicable") ? "failed" : statuses.includes("pending") ? "pending" : "passed";
    return [gateId, status];
  }));
}
export const SCAN_ROOTS = ["apps/chrome-extension/entrypoints/sidepanel", "apps/chrome-extension/entrypoints/workspace", "apps/chrome-extension/src/modules/knowledge_workspace"];

function sorted(values) { return [...values].sort((left, right) => left.localeCompare(right, "en")); }
function deepEqual(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

export function loadFrozenArchitecturePolicy(repoRoot) {
  const payloadPath = path.join(repoRoot, "docs/active/project/contracts/fixtures/v2_external_brain/px-0.1b-positive-evidence-payload.json");
  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
  const contract = payload.virtualArtifactContract;
  const manifest = payload.documents.architectureScanManifest;
  const read = (reference) => Buffer.from(contract.artifactsByPath[reference.path].content, "utf8");
  return { rulesetBytes: read(manifest.rulesetArtifact), allowlistBytes: read(manifest.allowlistArtifact) };
}

export function buildArchitectureSnapshot({ repoRoot, commit, rulesetBytes, allowlistBytes }) {
  const scanTrackedPaths = listGitEntries(repoRoot, commit, SCAN_ROOTS).filter((item) => /\.(?:[cm]?[jt]sx?|html)$/.test(item.path)).map((item) => {
    const bytes = readGitBlob(repoRoot, commit, item.path);
    const hash = sha256(bytes);
    return { path: item.path, blobSha256: hash, mode: item.mode, inlineSource: { encoding: "utf8", content: bytes.toString("utf8"), sha256: hash } };
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const trackedPaths = scanTrackedPaths.map(({ inlineSource: _inlineSource, ...item }) => item);
  const pathIndex = `${trackedPaths.map((item) => item.path).join("\n")}\n`;
  const tree = `${trackedPaths.map((item) => `${item.mode} ${item.blobSha256} ${item.path}`).join("\n")}\n`;
  const artifacts = new Map([
    ["input/architecture-ruleset.json", rulesetBytes], ["input/architecture-allowlist.json", allowlistBytes]
  ]);
  const manifest = {
    schemaVersion: "v2-external-brain-architecture-scan-manifest/v2", evidenceClass: "production_acceptance", repositoryCommit: commit,
    hashAlgorithm: "sha256", pathSeparator: "/", textEncoding: "utf-8", pathOrdering: "unicode_codepoint_ascending",
    treeEntryFormat: "<mode> <blobSha256> <path>\\n", pathIndexEntryFormat: "<path>\\n", symlinkPolicy: "hash_link_target_utf8", lineEndingPolicy: "raw_bytes",
    scanRoots: SCAN_ROOTS, trackedPaths, excludedPaths: ["node_modules", "dist", ".output"],
    canonicalPathIndex: { encoding: "utf8", content: pathIndex, sha256: sha256(Buffer.from(pathIndex)) },
    canonicalSourceTree: { encoding: "utf8", content: tree, sha256: sha256(Buffer.from(tree)) },
    rulesetArtifact: { path: "input/architecture-ruleset.json", sha256: sha256(rulesetBytes) },
    allowlistArtifact: { path: "input/architecture-allowlist.json", sha256: sha256(allowlistBytes) }
  };
  const scanManifest = { ...manifest, trackedPaths: scanTrackedPaths };
  const scan = scanTypeScriptArchitecture({ manifest: scanManifest, artifactBytes: (artifactPath) => artifacts.get(artifactPath), artifactValid: (reference) => artifacts.has(reference.path) && sha256(artifacts.get(reference.path)) === reference.sha256 });
  return { manifest, scanManifest, scan, artifacts };
}

function productionRulePassed(ruleId, context) {
  const s = context.derived.summary;
  const routeComplete = Object.values(s.routeMatrix).every((modes) => ["direct_open", "reload", "back", "reopen"].every((mode) => modes[mode] >= 1));
  const sourceUnique = new Set(context.derived.sourceMappings.map((item) => item.sourceId)).size === 12
    && new Set(context.derived.sourceMappings.map((item) => item.sourceSampleId)).size === 12
    && new Set(context.derived.sourceMappings.map((item) => item.contentFingerprint)).size === 12;
  const screenshotRecords = context.derived.scenarioFacts.flatMap((scenario) => scenario.facts.screenshots ?? []);
  const screenshotIntegrity = screenshotRecords.every((item) => item.imageArtifact.sha256 && item.metadataArtifact.sha256 && item.observationEventIds?.length >= 1);
  const t01 = s.t01Regression;
  const t01Passed = t01?.passed === true && t01.assertionsTotal === 36 && t01.assertionsPassed === 36 && t01.assertionIds?.length === 36 && new Set(t01.assertionIds).size === 36;
  const allCommandsPass = context.derived.scenarioFacts.flatMap((scenario) => scenario.facts.commands ?? []).every((item) => item.exitCode === 0);
  const schemasPassed = context.schemaContractsPassed === true;
  switch (ruleId) {
    case "PX_RULE_REPORT_ISSUES_NOT_EMPTY": return context.issues.length === 0;
    case "PX_RULE_CHILD_RESULT_FAILED": return context.contractRegression.passed && context.productionMutations.passed;
    case "PX_RULE_CLAIM_STATUS_MISMATCH": return context.profile === "production_candidate" && context.finalPassed === false;
    case "PX_RULE_FINAL_GATE_OR_HUMAN_REVIEW_FAILED": return false;
    case "PX_RULE_SOURCE_CORPUS_INVALID": case "PX_RULE_SOURCE_FIXTURE_UNIQUENESS_INVALID": return sourceUnique;
    case "PX_RULE_SCENARIO_ID_DUPLICATED": return new Set(context.derived.scenarioFacts.map((item) => item.scenarioId)).size === context.derived.scenarioFacts.length;
    case "PX_RULE_SCENARIO_SET_MISMATCH": return context.derived.scenarioFacts.length === s.scenarioCount;
    case "PX_RULE_SUMMARY_RECOMPUTE_MISMATCH": return s.eventCount === context.raw.events.length && s.artifactCount === context.raw.artifacts.length;
    case "PX_RULE_SOURCE_DISTRIBUTION_FAILED": return deepEqual(s.sourceDistribution, { web: 6, note: 3, local: 3 });
    case "PX_RULE_SCENARIO_SOURCE_REFERENCE_INVALID": return context.derived.sourceMappings.every((item) => item.sourceId && item.importRequestEventId && item.importResponseEventId);
    case "PX_RULE_SOURCE_KIND_RECOMPUTE_MISMATCH": return context.derived.sourceMappings.every((item) => ["web", "local", "note"].includes(item.sourceType));
    case "PX_RULE_ENTRY_COVERAGE_FAILED": return s.entryOrigins.view_source >= 3 && s.entryOrigins.open_workspace >= 2 && s.entryOrigins.open_in_workspace >= 2;
    case "PX_RULE_ROUTE_COVERAGE_FAILED": return routeComplete;
    case "PX_RULE_RECOVERY_COVERAGE_FAILED": return s.ordinaryRecoveryCount >= 2 && s.durableForgetRecoveries === 12;
    case "PX_RULE_IDENTITY_OR_IDEMPOTENCY_FAILED": return context.identityValid;
    case "PX_RULE_STATUS_COVERAGE_FAILED": return context.statusContractsPassed && deepEqual(s.faultTypes, ["adapter_blocked", "data_service_unreachable", "runtime_offline", "source_failed"]);
    case "PX_RULE_GOVERNANCE_COVERAGE_FAILED": return s.permissionScenarioCount >= 3 && s.forgetSourceCount >= 3;
    case "PX_RULE_SCREENSHOT_EVIDENCE_INVALID": return screenshotIntegrity;
    case "PX_RULE_SCREENSHOT_METADATA_MISMATCH": case "PX_RULE_SCREENSHOT_DECODED_DIMENSION_MISMATCH": case "PX_RULE_VIEWPORT_SURFACE_MAPPING_INVALID": return context.screenshotValidationPassed;
    case "PX_RULE_ARTIFACT_PATH_OR_HASH_INVALID": return context.artifactIntegrityPassed;
    case "PX_RULE_V2_REGRESSION_FAILED": return allCommandsPass && t01Passed;
    case "PX_RULE_TEST_COMMAND_RESULT_INVALID": return allCommandsPass;
    case "PX_RULE_SCOPE_OVERCLAIM": case "PX_RULE_FIXTURE_EVIDENCE_PROMOTION_INVALID": return context.profile === "production_candidate" && context.evidenceClass === "production_acceptance";
    case "PX_RULE_FAULT_INJECTION_MISMATCH": return context.faultIntervalsValid;
    case "PX_RULE_RUNTIME_OFFLINE_AUTHORITY_VIOLATION": return context.runtimeOfflineAuthorityValid;
    case "PX_RULE_PERMISSION_VERIFICATION_INVALID": return s.permissionScenarioCount >= 3;
    case "PX_RULE_FORGET_FOUR_SURFACE_INVALID": return s.forgetSourceCount >= 3;
    case "PX_RULE_EXECUTION_OBSERVATION_INVALID": return s.runtimeRequests === s.runtimeExactOneTerminals;
    case "PX_RULE_ENTRY_ACTION_OBSERVATION_INVALID": return context.entryActionsValid;
    case "PX_RULE_REQUEST_ID_CORRELATION_INVALID": return context.backgroundCorrelationValid;
    case "PX_RULE_FORGET_DURABLE_RECOVERY_INVALID": case "PX_RULE_FORGET_DURABLE_IDENTITY_INVALID": return s.durableForgetTriggers === 12 && s.durableForgetRecoveries === 12 && context.durableForgetIdentityValid;
    case "PX_RULE_ROUTE_EVENT_IDENTITY_INVALID": return context.routeIdentityValid;
    case "PX_RULE_ARCHITECTURE_CHECK_COVERAGE_MISSING": case "PX_RULE_ARCHITECTURE_SCAN_SCOPE_INVALID": return context.architecture.scan.scopeValid;
    case "PX_RULE_ARCHITECTURE_BOUNDARY_FAILED": return context.architecture.scan.scopeValid && context.architecture.scan.violations === 0;
    case "PX_RULE_UX_ACCESSIBILITY_FAILED": return s.axe?.serious === 0 && s.axe?.critical === 0 && s.keyboard?.assertionsPassed === s.keyboard?.assertionsTotal;
    case "PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID": return false;
    case "PX_RULE_SCHEMA_CHECK_SET_MISMATCH": return context.ruleSetComplete;
    case "PX_RULE_SEMANTIC_POSITIVE_BASE_INVALID": return context.contractRegression.passed;
    default: return schemasPassed;
  }
}

function verifyArtifacts(runRoot, raw) {
  try { for (const record of raw.artifacts) readArtifact(runRoot, artifactRefFromRecord(record)); return true; } catch { return false; }
}

function verifyScreenshots(runRoot, raw, derived) {
  try {
    const records = derived.scenarioFacts.flatMap((scenario) => scenario.facts.screenshots ?? []);
    return records.every((item) => {
      const image = readArtifact(runRoot, item.imageArtifact).bytes;
      const decoded = PNG.sync.read(image);
      const viewport = item.metadata.panelViewport ?? item.metadata.viewport;
      const decodedMatches = decoded.width === item.metadata.decodedWidth && decoded.height === item.metadata.decodedHeight;
      if (!viewport) return decodedMatches;
      const expectedSurface = [360, 420].includes(viewport.width) ? "side_panel" : [768, 1280].includes(viewport.width) ? "workspace_page" : null;
      return decodedMatches && expectedSurface !== null && item.surface === expectedSurface;
    });
  } catch { return false; }
}

function correlationChecks(raw) {
  const events = new Map(raw.events.map((event) => [event.eventId, event]));
  const background = raw.events.filter((event) => event.kind === "background_response").every((response) => {
    const request = events.get(response.payload.requestEventId);
    return request?.kind === "background_request" && request.payload.message.requestId === response.payload.message.requestId && request.actionId === response.actionId && request.navigationId === response.navigationId;
  });
  const entries = raw.events.filter((event) => event.kind === "background_request").every((request) => raw.events.some((event) => event.kind === "dom_action" && event.actionId === request.actionId && event.navigationId === request.navigationId && event.payload.isTrusted === true));
  return { background, entries };
}

function routeIdentity(derived) {
  return derived.scenarioFacts.every((scenario) => scenario.facts.routes.every((route) => {
    const containers = scenario.facts.containers.filter((item) => item.surface === (route.routeIntent === null ? item.surface : item.surface));
    return containers.length === 0 || containers.some((item) => ["workspaceId", "sourceId", "operationId"].every((key) => !route.ids?.[key] || !item.ids?.[key] || route.ids[key] === item.ids[key]));
  }));
}

function faultIntervals(raw) {
  const intervals = raw.segments.flatMap((segment) => segment.faultInjections).sort((left, right) => left.startSequence - right.startSequence);
  return intervals.every((item, index) => item.startSequence < item.endSequence && (index === 0 || intervals[index - 1].endSequence < item.startSequence));
}

function runtimeOfflineAuthority(raw) {
  const offline = raw.segments.flatMap((segment) => segment.faultInjections.filter((item) => item.faultType === "runtime_offline"));
  return offline.every((interval) => raw.events.filter((event) => event.kind === "runtime_request" && event.sequence >= interval.startSequence && event.sequence <= interval.endSequence).every((request) => raw.events.some((event) => event.kind === "transport_failure" && event.payload.requestEventId === request.eventId) && !raw.events.some((event) => event.kind === "runtime_response" && event.payload.requestEventId === request.eventId)));
}

export function validateProductionCandidate({ runRoot, raw, derived, validationSchema, architecture, contractRegression, productionMutations, inputs, validationRunId, validatedAt, statusContractsPassed = false }) {
  const registry = readRuleRegistry(validationSchema);
  const correlation = correlationChecks(raw);
  const context = {
    profile: "production_candidate", evidenceClass: "production_acceptance", raw, derived, architecture, contractRegression, productionMutations, inputs,
    schemaContractsPassed: true, statusContractsPassed, artifactIntegrityPassed: verifyArtifacts(runRoot, raw), screenshotValidationPassed: verifyScreenshots(runRoot, raw, derived),
    faultIntervalsValid: faultIntervals(raw), runtimeOfflineAuthorityValid: runtimeOfflineAuthority(raw), entryActionsValid: correlation.entries,
    backgroundCorrelationValid: correlation.background, durableForgetIdentityValid: derived.summary.durableForgetTriggers === 12 && derived.summary.durableForgetRecoveries === 12,
    routeIdentityValid: routeIdentity(derived), identityValid: routeIdentity(derived), ruleSetComplete: registry.length === 63,
    issues: [], finalPassed: false
  };
  const ruleResults = runRuleEngine({ registryEntries: registry, pendingRuleIds: HUMAN_RULES, evaluate: (ruleId) => productionRulePassed(ruleId, context) }).map(({ ruleId, enforcementLayer, status, failureCode, evidenceRefs = [], notes = "" }) => ({ ruleId, enforcementLayer, status, failureCode, evidenceRefs, notes }));
  const machineFailures = ruleResults.filter((item) => item.status === "failed" && !HUMAN_RULES.includes(item.ruleId));
  const machinePassed = machineFailures.length === 0 && ruleResults.filter((item) => item.status === "pending").every((item) => HUMAN_RULES.includes(item.ruleId));
  const gateResults = deriveProductionGateResults(ruleResults);
  return {
    schemaVersion: "v2-px-production-validation/v1", profile: "production_candidate", validationRunId, sourceRunId: raw.runId, validatedAt,
    inputs, ruleResults, gateResults, contractRegression: contractRegression.summary, productionMutationResults: productionMutations.summary,
    machinePassed: machinePassed && Object.entries(gateResults).filter(([key]) => key !== "G7").every(([, value]) => value === "passed"), humanReviewStatus: "pending", finalPassed: false,
    issues: machineFailures.map((item) => `${item.ruleId}:${item.failureCode}`)
  };
}

export function architecturePolicyArtifacts(architecture) {
  return [...architecture.artifacts.entries()].map(([relativePath, bytes]) => ({ relativePath, bytes, mediaType: "application/json" }));
}
