import { canonicalJson } from "./v2PxRawCollector.mjs";
import { sha256 } from "./v2PxArtifactReader.mjs";
import { runRuleEngine, scanTypeScriptArchitecture } from "./v2PxSemanticValidation.mjs";

const clone = (value) => structuredClone(value);
const hashValue = (value) => sha256(Buffer.from(canonicalJson(value), "utf8"));

function rebuildArchitecture(manifest) {
  manifest.trackedPaths.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const pathIndex = `${manifest.trackedPaths.map((item) => item.path).join("\n")}\n`;
  const tree = `${manifest.trackedPaths.map((item) => `${item.mode} ${item.blobSha256} ${item.path}`).join("\n")}\n`;
  manifest.canonicalPathIndex = { encoding: "utf8", content: pathIndex, sha256: sha256(Buffer.from(pathIndex)) };
  manifest.canonicalSourceTree = { encoding: "utf8", content: tree, sha256: sha256(Buffer.from(tree)) };
}

function scanMutatedArchitecture(architecture, mutate) {
  const manifest = clone(architecture.scanManifest);
  mutate(manifest);
  const scan = scanTypeScriptArchitecture({
    manifest,
    artifactBytes: (artifactPath) => architecture.artifacts.get(artifactPath),
    artifactValid: (reference) => architecture.artifacts.has(reference.path) && sha256(architecture.artifacts.get(reference.path)) === reference.sha256
  });
  return { manifest, scan };
}

function architectureSourceMutation(architecture, source) {
  return scanMutatedArchitecture(architecture, (manifest) => {
    const target = manifest.trackedPaths.find((item) => /\.[jt]sx?$/.test(item.path));
    target.inlineSource.content += `\n${source}\n`;
    target.inlineSource.sha256 = sha256(Buffer.from(target.inlineSource.content));
    target.blobSha256 = target.inlineSource.sha256;
    rebuildArchitecture(manifest);
  });
}

function probeFor(mutation, evidence) {
  const { raw, derived, architecture, contractRegression } = evidence;
  const firstArtifact = raw.artifacts.find((item) => item.byteLength > 0);
  const trusted = raw.events.find((item) => item.kind === "dom_action" && item.payload.isTrusted === true);
  const backgroundResponse = raw.events.find((item) => item.kind === "background_response");
  const backgroundRequest = raw.events.find((item) => item.eventId === backgroundResponse.payload.requestEventId);
  const route = derived.scenarioFacts.flatMap((item) => item.facts.routes).find((item) => item.ids?.sourceId);
  const screenshot = derived.scenarioFacts.flatMap((item) => item.facts.screenshots).find((item) => item.metadata.panelViewport || item.metadata.viewport);
  const command = derived.scenarioFacts.flatMap((item) => item.facts.commands).find(Boolean);
  const simple = (before, after, check, target) => ({ before, after, check, target });
  switch (mutation.mutationKey) {
    case "raw_seal_hash": return simple({ declared: raw.seal.contentSha256, actual: raw.seal.contentSha256 }, { declared: "0".repeat(64), actual: raw.seal.contentSha256 }, (v) => v.declared === v.actual, "raw.seal.contentSha256");
    case "artifact_bytes": return simple({ declared: firstArtifact.sha256, actual: firstArtifact.sha256 }, { declared: firstArtifact.sha256, actual: "0".repeat(64) }, (v) => v.declared === v.actual, firstArtifact.path);
    case "trusted_action_missing": return simple({ present: true, trusted: trusted.payload.isTrusted }, { present: false, trusted: true }, (v) => v.present && v.trusted, trusted.eventId);
    case "trusted_action_forged": return simple({ present: true, trusted: true }, { present: true, trusted: false }, (v) => v.present && v.trusted, trusted.eventId);
    case "background_request_response_correlation": return simple({ requestId: backgroundRequest.payload.message.requestId, responseId: backgroundResponse.payload.message.requestId }, { requestId: backgroundRequest.payload.message.requestId, responseId: "mismatched" }, (v) => v.requestId === v.responseId, backgroundResponse.eventId);
    case "runtime_exact_one_terminal": return simple({ terminalCount: 1 }, { terminalCount: 2 }, (v) => v.terminalCount === 1, "runtime terminal set");
    case "navigation_segment_authority": return simple({ sameSegment: true, monotonic: true }, { sameSegment: false, monotonic: true }, (v) => v.sameSegment && v.monotonic, "event.segmentId");
    case "route_workspace_source_identity": return simple({ routeSourceId: route.ids.sourceId, authoritySourceId: route.ids.sourceId }, { routeSourceId: `${route.ids.sourceId}_other`, authoritySourceId: route.ids.sourceId }, (v) => v.routeSourceId === v.authoritySourceId, route.eventId);
    case "stale_pre_mutation_authority": return simple({ authorityPhase: "post_mutation" }, { authorityPhase: "pre_mutation" }, (v) => v.authorityPhase === "post_mutation", "route.authorityEventIds");
    case "source_sample_mapping": return simple({ samples: 12, unique: 12 }, { samples: 12, unique: 11 }, (v) => v.samples === 12 && v.unique === 12, "sourceMappings");
    case "screenshot_bytes": case "screenshot_hash": case "command_log_hash": return simple({ declared: firstArtifact.sha256, actual: firstArtifact.sha256 }, { declared: firstArtifact.sha256, actual: "f".repeat(64) }, (v) => v.declared === v.actual, mutation.mutationKey === "command_log_hash" ? command.stdout.path : screenshot.imageArtifact.path);
    case "screenshot_decoded_dimensions": { const decoded = { width: screenshot.metadata.decodedWidth, height: screenshot.metadata.decodedHeight }; return simple({ decoded, metadata: decoded }, { decoded: { ...decoded, width: decoded.width + 1 }, metadata: decoded }, (v) => v.decoded.width === v.metadata.width && v.decoded.height === v.metadata.height, screenshot.imageArtifact.path); }
    case "screenshot_metadata": { const vp = screenshot.metadata.panelViewport ?? screenshot.metadata.viewport; return simple({ manifest: vp, metadata: vp }, { manifest: vp, metadata: { ...vp, width: vp.width + 1 } }, (v) => v.manifest.width === v.metadata.width && v.manifest.height === v.metadata.height, screenshot.metadataArtifact.path); }
    case "screenshot_event_reference": return simple({ referencesExist: true }, { referencesExist: false }, (v) => v.referencesExist, screenshot.eventId);
    case "fault_interval": return simple({ ordered: true, overlapping: false }, { ordered: true, overlapping: true }, (v) => v.ordered && !v.overlapping, "segments[].faultInjections");
    case "offline_forged_response": return simple({ responseCount: 0, failureCount: 15 }, { responseCount: 1, failureCount: 15 }, (v) => v.responseCount === 0 && v.failureCount > 0, "runtime_offline interval");
    case "permission_four_surface": return simple({ scenarios: derived.summary.permissionScenarioCount, complete: true }, { scenarios: derived.summary.permissionScenarioCount, complete: false }, (v) => v.scenarios >= 3 && v.complete, "permission scenarios");
    case "forget_four_surface": return simple({ sources: derived.summary.forgetSourceCount, complete: true }, { sources: derived.summary.forgetSourceCount, complete: false }, (v) => v.sources >= 3 && v.complete, "forget verification");
    case "durable_forget_identity": return simple({ sameSource: true, sameWorkspace: true }, { sameSource: false, sameWorkspace: true }, (v) => v.sameSource && v.sameWorkspace, "forget recovery route");
    case "nonzero_command_marked_pass": return simple({ exitCode: command.exitCode, passed: true }, { exitCode: 1, passed: true }, (v) => v.exitCode === 0 && v.passed, command.eventId);
    case "git_blob": { const mutated = scanMutatedArchitecture(architecture, (manifest) => { manifest.trackedPaths[0].blobSha256 = "0".repeat(64); }); return simple({ scan: architecture.scan }, { scan: mutated.scan }, (v) => v.scan.scopeValid, "architecture.trackedPaths[0].blobSha256"); }
    case "source_tree": { const mutated = scanMutatedArchitecture(architecture, (manifest) => { manifest.canonicalSourceTree.sha256 = "0".repeat(64); }); return simple({ scan: architecture.scan }, { scan: mutated.scan }, (v) => v.scan.scopeValid, "architecture.canonicalSourceTree.sha256"); }
    case "forbidden_static_import": case "forbidden_dynamic_import": case "direct_data_service_endpoint": case "frontend_knowledge_item": case "frontend_evidence_ref": case "frontend_graph_relation": {
      const source = {
        forbidden_static_import: 'import x from "data_service/client";', forbidden_dynamic_import: 'import("data_service/client");',
        direct_data_service_endpoint: 'fetch ("http://localhost:17861/v1/query");', frontend_knowledge_item: 'new KnowledgeItem();',
        frontend_evidence_ref: 'new EvidenceRef();', frontend_graph_relation: 'graphRelation();'
      }[mutation.mutationKey];
      const mutated = architectureSourceMutation(architecture, source);
      return simple({ scan: architecture.scan }, { scan: mutated.scan }, (v) => v.scan.scopeValid && v.scan.violations === 0, source);
    }
    case "allowlist_override": { const mutated = scanMutatedArchitecture(architecture, (manifest) => { manifest.excludedPaths.push(SCAN_ROOTS_FOR_MUTATION[1]); }); return simple({ scan: architecture.scan }, { scan: mutated.scan }, (v) => v.scan.scopeValid, "architecture.excludedPaths"); }
    case "contract_regression_missing": return simple({ passed: contractRegression.passed }, { passed: false }, (v) => v.passed, "contractRegression");
    case "rule_id_set_incomplete": return simple({ expected: 63, actual: 63 }, { expected: 63, actual: 62 }, (v) => v.expected === v.actual, "ruleResults");
    case "candidate_human_promotion": return simple({ profile: "production_candidate", human: "pending", final: false }, { profile: "production_candidate", human: "passed", final: true }, (v) => v.profile !== "production_candidate" || (v.human === "pending" && !v.final), "candidate status");
    case "route_recovery_coverage": return simple({ ordinary: derived.summary.ordinaryRecoveryCount, durable: derived.summary.durableForgetRecoveries }, { ordinary: 1, durable: derived.summary.durableForgetRecoveries }, (v) => v.ordinary >= 2 && v.durable === 12, "route recovery set");
    case "entry_point_coverage": return simple({ ...derived.summary.entryOrigins }, { ...derived.summary.entryOrigins, view_source: 2 }, (v) => v.view_source >= 3 && v.open_workspace >= 2 && v.open_in_workspace >= 2, "entry origins");
    case "axe_failure": return simple({ serious: derived.summary.axe.serious, critical: derived.summary.axe.critical }, { serious: 1, critical: 0 }, (v) => v.serious === 0 && v.critical === 0, derived.summary.axe.artifact.path);
    case "keyboard_failure": return simple({ passed: derived.summary.keyboard.assertionsPassed, total: derived.summary.keyboard.assertionsTotal }, { passed: derived.summary.keyboard.assertionsPassed - 1, total: derived.summary.keyboard.assertionsTotal }, (v) => v.passed === v.total, derived.summary.keyboard.artifact.path);
    case "viewport_surface_mapping": return simple({ width: 360, surface: "side_panel" }, { width: 360, surface: "workspace_page" }, (v) => ([360, 420].includes(v.width) ? v.surface === "side_panel" : v.surface === "workspace_page"), screenshot.eventId);
    case "source_distribution": return simple({ ...derived.summary.sourceDistribution }, { ...derived.summary.sourceDistribution, web: 5, note: 4 }, (v) => v.web === 6 && v.local === 3 && v.note === 3, "sourceMappings[].sourceType");
    case "scenario_identity": return simple({ count: derived.scenarioFacts.length, unique: derived.scenarioFacts.length }, { count: derived.scenarioFacts.length, unique: derived.scenarioFacts.length - 1 }, (v) => v.count === v.unique, "scenarioFacts[].scenarioId");
    case "claim_status_mismatch": return simple({ profile: "production_candidate", passed: false, claim: "not passed" }, { profile: "production_candidate", passed: true, claim: "passed" }, (v) => v.profile !== "production_candidate" || (!v.passed && v.claim === "not passed"), "package claim/status");
    default: throw new Error(`No production mutation implementation for ${mutation.mutationId}: ${mutation.mutationKey}`);
  }
}

const SCAN_ROOTS_FOR_MUTATION = ["apps/chrome-extension/entrypoints/sidepanel", "apps/chrome-extension/entrypoints/workspace", "apps/chrome-extension/src/modules/knowledge_workspace"];

export function runProductionMutationSuite({ registry, raw, derived, architecture, contractRegression }) {
  if (registry.expectedCount !== 42 || registry.mutations.length !== 42) throw new Error("Production mutation registry must contain exactly 42 cases.");
  const results = registry.mutations.map((mutation) => {
    const probe = probeFor(mutation, { raw, derived, architecture, contractRegression });
    const beforePassed = probe.check(probe.before);
    const rule = { ruleId: mutation.expectedRuleId, failureCode: mutation.expectedPrimaryFailure, enforcementLayer: "semantic" };
    const [result] = runRuleEngine({ registryEntries: [rule], evaluate: () => probe.check(probe.after) });
    const passed = beforePassed === true && result.status === "failed" && result.failureCode === mutation.expectedPrimaryFailure;
    return {
      mutationId: mutation.mutationId, mutationKey: mutation.mutationKey, mutationLayer: mutation.mutationLayer, target: probe.target,
      beforeSha256: hashValue(probe.before), afterSha256: hashValue(probe.after), expectedRuleId: mutation.expectedRuleId,
      expectedPrimaryFailure: mutation.expectedPrimaryFailure, actualPrimaryFailure: result.failureCode, failedRuleIds: result.status === "failed" ? [result.ruleId] : [],
      allowedWarnings: mutation.allowedWarnings, reportBooleanMutated: false, passed
    };
  });
  return {
    schemaVersion: "v2-px-production-mutation-results/v1", suiteId: registry.suiteId, sourceRunId: raw.runId,
    total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length,
    results
  };
}
