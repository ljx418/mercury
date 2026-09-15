const REPORT_SCENARIOS = [
  "scenario_entry_open_workspace_1",
  "scenario_entry_view_source_3",
  "scenario_entry_open_in_workspace_6",
  "scenario_route_source_library_reload",
  "scenario_route_source_detail_reload",
  "scenario_route_ask_back",
  "scenario_route_graph_reopen",
  "scenario_route_permissions_direct_open",
  "scenario_route_error_invalid",
  "scenario_route_error_workspace_missing",
  "scenario_fault_adapter_blocked",
  "scenario_fault_data_service_unreachable",
  "scenario_fault_source_failed",
  "scenario_fault_runtime_offline",
  "scenario_forget_1_direct_open",
  "scenario_forget_2_direct_open",
  "scenario_forget_3_direct_open"
];

const REPORT_CLAIM = "V2-PX External Brain Productization acceptance did not pass.";
const GATE_KEYS = {
  G1: "G1_entry",
  G2: "G2_route",
  G3: "G3_lifecycle",
  G4: "G4_architecture",
  G5: "G5_status",
  G6: "G6_ux_accessibility",
  G7: "G7_evidence"
};

function legacyRef(reference) {
  return { path: reference.path, sha256: reference.sha256 };
}

function outputEvidencePath(reference) {
  return `evidence/source-run/${reference.path}`;
}

function resolvedPath(url) {
  const marker = "workspace.html";
  const index = url?.indexOf(marker) ?? -1;
  const suffix = index >= 0 ? url.slice(index + marker.length) : "";
  return suffix.startsWith("#/knowledge/") ? suffix : "#/knowledge/sources?workspaceId=ws_default";
}

function idsFor(status, ids = {}) {
  if (status !== "observed") return { status };
  const result = { status, workspaceId: ids.workspaceId };
  if (ids.sourceId) result.sourceId = ids.sourceId;
  if (ids.operationId) result.operationId = ids.operationId;
  return result;
}

function observedIds(scenario, route, status) {
  const ids = route?.ids?.status === "observed" ? route.ids : null;
  const workspace = scenario.facts.containers.find((item) => item.surface === "workspace_page" && item.ids?.status === "observed");
  const sidePanelObserved = scenario.facts.trustedActions.length > 0 && ids;
  const backgroundObserved = scenario.provenance.backgroundRequestEventIds.length > 0 && scenario.provenance.backgroundResponseEventIds.length > 0 && ids;
  const runtimeObserved = status?.authority === "runtime_response" && ids;
  return {
    sidePanel: sidePanelObserved ? idsFor("observed", ids) : { status: "not_applicable" },
    background: backgroundObserved ? idsFor("observed", ids) : { status: "not_applicable" },
    runtime: runtimeObserved ? idsFor("observed", ids) : { status: "unavailable" },
    workspace: workspace ? idsFor("observed", workspace.ids) : { status: "unavailable" }
  };
}

function sourceForScenario(derived, route, index) {
  const sourceId = route?.ids?.sourceId;
  const exact = derived.sourceMappings.find((item) => item.sourceId === sourceId);
  return exact
    ? { value: exact, representative: false }
    : { value: derived.sourceMappings[index % derived.sourceMappings.length], representative: true };
}

function commandResult(command, summary) {
  if (command.command === "axe-core:side-panel+workspace") {
    return {
      testKind: "axe",
      checkId: "axe_accessibility",
      result: { resultType: "axe", serious: summary.axe.serious, critical: summary.axe.critical }
    };
  }
  if (command.command === "playwright:keyboard-accessibility") {
    return {
      testKind: "keyboard",
      checkId: "keyboard_accessibility",
      result: {
        resultType: "keyboard",
        assertionsTotal: summary.keyboard.assertionsTotal,
        assertionsPassed: summary.keyboard.assertionsPassed,
        focusReturnPassed: summary.keyboard.focusReturnPassed,
        escapePassed: summary.keyboard.escapePassed,
        reducedMotionPassed: summary.keyboard.reducedMotionPassed
      }
    };
  }
  if (command.command.includes("chrome-v2-t01-r1-frontend.mjs")) {
    return {
      testKind: "chrome_e2e",
      checkId: "chrome_e2e",
      result: {
        resultType: "suite",
        assertionsTotal: summary.t01Regression.assertionsTotal,
        assertionsPassed: summary.t01Regression.assertionsPassed
      }
    };
  }
  return {
    testKind: "v2_regression",
    checkId: "v2_regression",
    result: { resultType: "suite", assertionsTotal: 1, assertionsPassed: command.exitCode === 0 ? 1 : 0 }
  };
}

function reportTestCommands(derived) {
  return derived.scenarioFacts
    .flatMap((scenario) => scenario.facts.commands)
    .sort((left, right) => left.sequence - right.sequence)
    .map((command) => ({
      ...commandResult(command, derived.summary),
      command: command.command,
      passed: command.exitCode === 0,
      exitCode: command.exitCode,
      signal: null,
      logArtifact: legacyRef({ ...command.stdout, path: outputEvidencePath(command.stdout) })
    }));
}

function entryPoint(scenarioId) {
  if (scenarioId.includes("entry_open_workspace")) return "open_workspace";
  if (scenarioId.includes("entry_view_source")) return "view_source";
  if (scenarioId.includes("entry_open_in_workspace")) return "open_in_workspace";
  if (scenarioId.includes("permission") || scenarioId.includes("route_permissions")) return "permission";
  if (scenarioId.includes("forget")) return "forget";
  if (scenarioId.includes("fault") || scenarioId.includes("route_error")) return "status_recovery";
  return "direct_route";
}

function recoveryResult(mode, errorCode) {
  if (errorCode) return "recovered_to_library";
  return {
    direct_open: "restored_direct_open",
    reload: "restored_after_reload",
    back: "restored_after_back",
    reopen: "restored_after_reopen"
  }[mode] ?? "not_applicable";
}

function scenarioOpenOutcome(scenario, route, errorCode) {
  const background = scenario.facts.backgroundResponses.at(-1)?.message?.outcome;
  if (["focused_existing", "created_new"].includes(background)) return background;
  if (errorCode) return "recovered";
  if (["direct_open", "reload", "back", "reopen"].includes(route?.mode)) return "direct_open_restored";
  return "not_applicable";
}

function representativeScreenshot(scenario, screenshots, index) {
  if (scenario.facts.screenshots.length) return { value: scenario.facts.screenshots[0], representative: false };
  const preferSidePanel = scenario.scenarioId.startsWith("scenario_entry_");
  const candidates = screenshots.filter((item) => preferSidePanel ? item.value.surface === "side_panel" : item.value.surface === "workspace_page");
  return { value: (candidates.length ? candidates : screenshots)[index % (candidates.length || screenshots.length)].value, representative: true };
}

function statusForScenario(scenario, allStatuses) {
  const local = scenario.facts.statusObservations.at(-1);
  return { value: local ?? allStatuses[0].value, inherited: !local };
}

function reportRoute(scenario, byId) {
  const errorRoute = scenario.facts.routes.find((item) => item.errorCode);
  if (scenario.scenarioId.startsWith("scenario_route_error_")) {
    const recovery = byId.get(`${scenario.scenarioId}_recovery`)?.facts.routes.find((item) => item.mode === "recovery");
    return { route: recovery ?? errorRoute, errorRoute };
  }
  const recovery = scenario.facts.routes.find((item) => item.mode === "recovery");
  return { route: recovery ?? scenario.facts.routes.at(-1), errorRoute };
}

export function createPendingHumanReview() {
  const gateReviews = Object.fromEntries(Object.values(GATE_KEYS).map((key) => [key, {
    status: "pending",
    evidenceArtifacts: [],
    notes: "Awaiting independent human review of the production candidate."
  }]));
  return {
    schemaVersion: "v2-external-brain-human-review/v3",
    evidenceClass: "production_acceptance",
    status: "pending",
    gateReviews,
    blockingIssues: ["Independent Human Review has not been signed."],
    signedClaim: REPORT_CLAIM
  };
}

export function buildProductionReport({ derived, validation, humanReview, references }) {
  if (validation.profile !== "production_candidate" || validation.machinePassed !== true || validation.finalPassed !== false) {
    throw new Error("Report renderer requires a machine-passed production candidate that is not final.");
  }
  if (humanReview.status !== "pending" || humanReview.evidenceClass !== "production_acceptance") {
    throw new Error("T03 report renderer requires pending production Human Review.");
  }
  const byId = new Map(derived.scenarioFacts.map((item) => [item.scenarioId, item]));
  const selected = REPORT_SCENARIOS.map((id) => {
    const value = byId.get(id);
    if (!value) throw new Error(`Missing report scenario: ${id}`);
    return value;
  });
  const screenshots = derived.scenarioFacts.flatMap((scenario) => scenario.facts.screenshots.map((value) => ({ scenarioId: scenario.scenarioId, value })));
  const allStatuses = derived.scenarioFacts.flatMap((scenario) => scenario.facts.statusObservations.map((value) => ({ scenarioId: scenario.scenarioId, value })));
  if (!screenshots.length || !allStatuses.length) throw new Error("Report rendering requires real screenshot and status observations.");
  const scenarioResults = selected.map((scenario, index) => {
    const { route, errorRoute } = reportRoute(scenario, byId);
    const sourceSelection = sourceForScenario(derived, errorRoute ?? route, index);
    const source = sourceSelection.value;
    const screenshot = representativeScreenshot(scenario, screenshots, index);
    const status = statusForScenario(scenario, allStatuses);
    const errorCode = errorRoute?.errorCode ?? null;
    const coverageTags = [
      `raw_scenario:${scenario.scenarioId}`,
      `route_mode:${errorRoute?.mode ?? route?.mode ?? "none"}`,
      `status_event:${status.value.eventId}`,
      `screenshot_event:${screenshot.value.eventId}`
    ];
    if (screenshot.representative) coverageTags.push("representative_visual_state:not_same_scenario");
    if (status.inherited) coverageTags.push("representative_status_snapshot:not_same_scenario");
    if (sourceSelection.representative) coverageTags.push("representative_source_context:not_same_scenario");
    const result = {
      scenarioId: scenario.scenarioId,
      sourceSampleIds: [source.sourceSampleId],
      sourceKinds: [{ web: "real_web", local: "explicit_local_document", note: "note_markdown" }[source.sourceType]],
      passed: scenario.passed,
      dataMode: "real",
      entryPoint: entryPoint(scenario.scenarioId),
      routeIntent: route?.routeIntent ?? "source_library",
      resolvedPath: resolvedPath(route?.url),
      routeRecoveryResult: recoveryResult(errorRoute?.mode ?? route?.mode, errorCode),
      openOutcome: scenarioOpenOutcome(scenario, errorRoute ?? route, errorCode),
      executionMode: "headless_real_chrome",
      coverageTags,
      successfulRecoveryModes: !errorCode && ["direct_open", "reload", "back", "reopen"].includes(route?.mode) ? [route.mode] : [],
      workspaceId: route?.ids?.workspaceId ?? source.workspaceId,
      observedIds: observedIds(scenario, route, status.value),
      duplicateIngestDetected: false,
      faultInjection: scenario.facts.faults.find((item) => item.phase === "start")?.faultType ?? "none",
      statusObservation: status.value.value,
      executionObservationPath: references.derived.path,
      executionObservationSha256: references.derived.sha256,
      screenshotPaths: [outputEvidencePath(screenshot.value.imageArtifact)],
      screenshotMetadataPaths: [outputEvidencePath(screenshot.value.metadataArtifact)],
      logArtifacts: [legacyRef(references.productionValidation)],
      conclusion: scenario.passed ? "passed" : "failed"
    };
    if (errorCode) result.errorCode = errorCode;
    if (errorRoute?.ids?.sourceId ?? route?.ids?.sourceId) result.sourceId = errorRoute?.ids?.sourceId ?? route.ids.sourceId;
    if (source.operationId) result.operationId = source.operationId;
    return result;
  });
  const s = derived.summary;
  const report = {
    schemaVersion: "v2-external-brain-report/v12",
    generatedAt: validation.validatedAt,
    evidenceClass: "production_acceptance",
    acceptanceMode: "real_chrome_dual_container",
    claim: REPORT_CLAIM,
    passed: false,
    humanReview: { status: humanReview.status, evidenceClass: humanReview.evidenceClass, recordPath: references.humanReview.path, recordSha256: references.humanReview.sha256 },
    summary: {
      sourceCorpusTotal: s.sourceCount,
      uniqueRealWebSources: s.sourceDistribution.web,
      uniqueExplicitLocalDocumentSources: s.sourceDistribution.local,
      uniqueNoteMarkdownSources: s.sourceDistribution.note,
      scenariosTotal: scenarioResults.length,
      scenariosPassed: scenarioResults.filter((item) => item.passed).length,
      entryPointsCovered: Object.keys(s.entryOrigins).length,
      routesCovered: Object.keys(s.routeMatrix).length,
      routeDirectOpenReloadPairs: Object.values(s.routeMatrix).filter((modes) => modes.direct_open >= 1 && modes.reload >= 1).length,
      invalidOrForbiddenRecoverySamples: s.ordinaryRecoveryCount,
      idConsistencySamples: Object.values(s.routeMatrix).filter((modes) => Object.values(modes).every((count) => count >= 1)).length,
      statusFaultsCovered: s.faultTypes.length,
      permissionSamples: s.permissionScenarioCount,
      forgetSamples: s.forgetSourceCount,
      v2RegressionPassed: s.prerequisiteCommands.every((item) => item.exitCode === 0)
    },
    gateResults: Object.fromEntries(Object.entries(GATE_KEYS).map(([gate, key]) => [key, validation.gateResults[gate] === "passed"])),
    scenarioResults,
    testCommands: reportTestCommands(derived),
    auditArtifacts: Object.fromEntries(Object.entries(references.auditArtifacts).map(([key, value]) => [key, legacyRef(value)])),
    fatalIssues: [],
    majorIssues: [],
    warnings: [
      "Human Review is pending; this report is an automated production candidate and is not PX-5 or V2 acceptance.",
      `The report projects ${scenarioResults.length} auditable scenarios from ${s.scenarioCount} raw scenarios; DerivedFacts remains authoritative.`,
      "Representative screenshots are explicitly tagged when a raw scenario has no dedicated screenshot."
    ]
  };
  return report;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function renderCandidateHtml({ derived, validation, humanReview }) {
  const rules = validation.ruleResults.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] ?? 0) + 1 }), {});
  const gates = Object.entries(validation.gateResults).map(([gate, status]) => `<tr><th>${escapeHtml(gate)}</th><td>${escapeHtml(status)}</td></tr>`).join("");
  const sources = Object.entries(derived.summary.sourceDistribution).map(([kind, count]) => `<li>${escapeHtml(kind)}: ${count}</li>`).join("");
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Navia V2-PX T03 自动验收候选</title>
<style>body{font-family:system-ui,sans-serif;max-width:960px;margin:32px auto;padding:0 20px;color:#18211e;background:#fff}h1{font-size:28px}h2{font-size:20px;margin-top:28px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9d2ce;padding:8px;text-align:left}.pending{color:#7a4d00;font-weight:700}.ok{color:#12633f;font-weight:700}code{background:#eef2f0;padding:2px 4px}</style></head><body>
<h1>Navia V2-PX T03 自动验收候选</h1>
<p class="pending">最终状态：未通过。Human Review 为 ${escapeHtml(humanReview.status)}，不得扩展为 PX-5、PX-6 或 V2 完成声明。</p>
<h2>机器结果</h2><p class="ok">machinePassed=${validation.machinePassed}</p><ul><li>通过规则：${rules.passed ?? 0}</li><li>待人工：${rules.pending ?? 0}</li><li>失败：${rules.failed ?? 0}</li></ul>
<h2>门禁</h2><table>${gates}</table>
<h2>真实输入</h2><p>sourceRunId=<code>${escapeHtml(validation.sourceRunId)}</code></p><ul>${sources}</ul><p>原始场景 ${derived.summary.scenarioCount}，Runtime 请求 ${derived.summary.runtimeRequests}，唯一终态 ${derived.summary.runtimeExactOneTerminals}。</p>
<h2>范围边界</h2><p>本页只呈现 T03 机器候选。独立人工审查尚未签署，RKM、RAG、自动知识维护与完整产品验收不在本候选声明内。</p>
</body></html>\n`;
}
