import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { artifactRef, canonicalJson, dependencyClosureSha256, readRepositoryBytes, sha256, validateArtifactRef, validateResolvedReplayInvocation } from "./v2PxSnapshotReplay.mjs";
import { scanTypeScriptArchitecture } from "./v2PxSemanticValidation.mjs";

export const EXACT_ARTIFACT_PATHS = [
  "derived-facts.json",
  "contract-regression.json",
  "production-mutation-results.json",
  "production-validation.json",
  "architecture-scan-manifest.json",
  "status-contract-errors.json",
  "human-review.pending.json",
  "report.json",
  "acceptance-report.html",
  "production-package.json"
];

export const INVOCATION_LOG_PATHS = ["derive", "validate", "report", "package"]
  .flatMap((step) => [`logs/invocation/${step}.stdout.log`, `logs/invocation/${step}.stderr.log`]);

function read(root, relativePath) {
  return fs.readFileSync(path.resolve(root, ...relativePath.split("/")));
}

function mediaType(relativePath) {
  if (relativePath.endsWith(".json")) return "application/json";
  if (relativePath.endsWith(".html")) return "text/html";
  return "text/plain";
}

export function compareRawArtifact(pathValue, baselineRoot, replayRoot, baselineArtifactRoot = "baseline_validation", replayArtifactRoot = "replay_validation") {
  const baselineBytes = read(baselineRoot, pathValue);
  const replayBytes = read(replayRoot, pathValue);
  if (!baselineBytes.equals(replayBytes)) throw new Error(`T04_REPLAY_MISMATCH: ${pathValue}`);
  return {
    path: pathValue,
    baseline: artifactRef(baselineArtifactRoot, baselineRoot, pathValue, mediaType(pathValue)),
    replay: artifactRef(replayArtifactRoot, replayRoot, pathValue, mediaType(pathValue)),
    algorithm: "raw_bytes_sha256_v1",
    ignoredJsonPointers: [],
    equal: true
  };
}

function removeRecordedAt(document, ignoredJsonPointers) {
  if (canonicalJson(ignoredJsonPointers) !== canonicalJson(["/recordedAt"])) {
    throw new Error("T04_REPLAY_NORMALIZATION_INVALID: only /recordedAt may be ignored.");
  }
  const clone = structuredClone(document);
  delete clone.recordedAt;
  return clone;
}

export function compareInvocationRecord(baselineRoot, replayRoot, ignoredJsonPointers = ["/recordedAt"]) {
  const relativePath = "invocation-record.json";
  const baseline = JSON.parse(read(baselineRoot, relativePath));
  const replay = JSON.parse(read(replayRoot, relativePath));
  if (canonicalJson(removeRecordedAt(baseline, ignoredJsonPointers)) !== canonicalJson(removeRecordedAt(replay, ignoredJsonPointers))) {
    throw new Error("T04_REPLAY_MISMATCH: invocation-record.json");
  }
  return {
    path: relativePath,
    baseline: artifactRef("baseline_validation", baselineRoot, relativePath, "application/json"),
    replay: artifactRef("replay_validation", replayRoot, relativePath, "application/json"),
    algorithm: "canonical_json_remove_registered_pointers_v1",
    ignoredJsonPointers: ["/recordedAt"],
    equal: true
  };
}

export function compareReplayOutputs(baselineRoot, replayRoot) {
  return {
    exactComparisons: EXACT_ARTIFACT_PATHS.map((relativePath) => compareRawArtifact(relativePath, baselineRoot, replayRoot)),
    normalizedComparisons: [compareInvocationRecord(baselineRoot, replayRoot)],
    stdoutStderrComparisons: INVOCATION_LOG_PATHS.map((relativePath) => compareRawArtifact(relativePath, baselineRoot, replayRoot))
  };
}

export function assertInvocationExecuted(invocation) {
  const expected = ["derive", "validate", "report", "package"];
  if (!invocation || !Array.isArray(invocation.steps) || invocation.steps.length !== expected.length) {
    throw new Error("T04_INVOCATION_EVIDENCE_INVALID: exactly four steps are required.");
  }
  invocation.steps.forEach((step, index) => {
    if (step.stepId !== expected[index] || step.exitCode !== 0 || step.signal !== null || !Array.isArray(step.argv) || step.argv.length === 0 || !step.stdout || !step.stderr) {
      throw new Error(`T04_INVOCATION_EVIDENCE_INVALID: invalid ${expected[index]} step.`);
    }
  });
  return true;
}

export function assertHumanBoundary(document) {
  if (document.humanReviewStatus !== "pending") throw new Error("T04_HUMAN_BOUNDARY_VIOLATION");
  if (document.g7Status !== undefined && document.g7Status !== "pending") throw new Error("T04_CLAIM_OVERREACH");
  if (document.finalPassed !== false) throw new Error("T04_CLAIM_OVERREACH");
  if (document.signingAllowed !== undefined && document.signingAllowed !== false) throw new Error("T04_HUMAN_BOUNDARY_VIOLATION");
  return true;
}

function fail(code, detail = "") {
  throw new Error(`${code}${detail ? `: ${detail}` : ""}`);
}

export function errorCode(error) {
  return /^([A-Z0-9_]+)/.exec(error instanceof Error ? error.message : String(error))?.[1] ?? "UNKNOWN";
}

export function validateDependencyClosureDocument(closure, snapshotRoot) {
  if (closure.algorithm !== "esm_relative_import_graph_plus_declared_artifacts_v1"
      || closure.missingEdges?.length || closure.undeclaredReads?.length || closure.unexpectedFiles?.length
      || dependencyClosureSha256(closure.files) !== closure.closureSha256) {
    fail("T04_DEPENDENCY_CLOSURE_INVALID", "closure structure or hash mismatch");
  }
  for (const file of closure.files) {
    let actual;
    try { actual = readRepositoryBytes(snapshotRoot, file.path); }
    catch { fail("T04_DEPENDENCY_CLOSURE_INVALID", `missing ${file.path}`); }
    if (actual.mode !== file.mode || actual.bytes.length !== file.byteLength || sha256(actual.bytes) !== file.sha256) {
      fail("T04_DEPENDENCY_CLOSURE_INVALID", `bytes changed for ${file.path}`);
    }
  }
  return true;
}

export function validateSnapshotManifestSemantics(manifest, { roots, snapshotRoot, expectedBaselineId, expectedRawSha256, expectedSealSha256, mainRepositoryRoot }) {
  if (manifest.baseline.t03ValidationRunId !== expectedBaselineId || manifest.baseline.forbiddenCandidateIds.includes(manifest.baseline.t03ValidationRunId)) fail("T04_BASELINE_CANDIDATE_INVALID");
  let rawRef; let raw;
  try {
    rawRef = validateArtifactRef(manifest.baseline.sealedRawRun, roots);
    raw = JSON.parse(fs.readFileSync(path.join(roots.source_run, manifest.baseline.sealedRawRun.path), "utf8"));
  } catch { fail("T04_BASELINE_INPUT_MODIFIED"); }
  if (rawRef.sha256 !== expectedRawSha256 || manifest.baseline.sealSha256 !== expectedSealSha256 || raw.seal?.contentSha256 !== expectedSealSha256) fail("T04_BASELINE_INPUT_MODIFIED");
  if (snapshotRoot === mainRepositoryRoot || manifest.snapshot.workingTreePolicy !== "detached_local_commit_main_tree_read_only") fail("T04_ISOLATION_BOUNDARY_FAILED");
  if (manifest.snapshot.mainHeadBefore !== manifest.snapshot.mainHeadAfter || manifest.snapshot.mainIndexBeforeSha256 !== manifest.snapshot.mainIndexAfterSha256) fail("T04_ISOLATION_BOUNDARY_FAILED");
  validateDependencyClosureDocument(manifest.dependencyClosure, snapshotRoot);
  for (const ref of [manifest.snapshot.snapshotBundle, manifest.snapshot.pathIndex, manifest.snapshot.sourceIndex, manifest.snapshot.buildIndex, manifest.environment.packageLock, manifest.environment.resolvedPackages, manifest.environment.runtimeRequirements, manifest.environment.runtimeLockedRequirements, manifest.environment.runtimeWheelhouseIndex]) {
    try { validateArtifactRef(ref, roots); } catch { fail("T04_ENVIRONMENT_NOT_REPRODUCIBLE", `artifact mismatch ${ref.path}`); }
  }
  const sourceIndex = JSON.parse(fs.readFileSync(path.join(roots.t04_run, manifest.snapshot.sourceIndex.path), "utf8"));
  if (sourceIndex.acceptanceCommit !== manifest.snapshot.acceptanceCommit || sourceIndex.treeSha256 !== manifest.snapshot.treeSha256) fail("T04_PRODUCT_SNAPSHOT_DRIFT");
  const productFiles = manifest.dependencyClosure.files.filter((file) => file.sourceDisposition === "product_base_commit");
  const entries = new Map(sourceIndex.entries.map((entry) => [entry.path, entry]));
  if (productFiles.some((file) => !entries.has(file.path) || entries.get(file.path).sha256 !== file.sha256 || entries.get(file.path).mode !== file.mode)) fail("T04_PRODUCT_SNAPSHOT_DRIFT");
  const authorizationBytes = fs.readFileSync(path.join(roots.repository_snapshot, manifest.governance.implementationAuthorization.path));
  const auditBytes = fs.readFileSync(path.join(roots.repository_snapshot, manifest.governance.externalDocumentAudit.path));
  const authorization = JSON.parse(authorizationBytes);
  if (sha256(authorizationBytes) !== manifest.governance.implementationAuthorization.sha256
      || sha256(auditBytes) !== manifest.governance.externalDocumentAudit.sha256
      || canonicalJson(authorization) !== canonicalJson(manifest.governance.authorizationRecord)
      || authorization.userInstructionSha256 !== sha256(Buffer.from(authorization.userInstructionText, "utf8"))
      || authorization.externalDocumentAuditSha256 !== manifest.governance.externalDocumentAudit.sha256) fail("T04_INDEPENDENT_AUDIT_REQUIRED");
  return true;
}

export function validateReplayLaneDocument(replayLane, { baselineRoot, replayRoot }) {
  assertInvocationExecuted(JSON.parse(fs.readFileSync(path.join(replayRoot, "invocation-record.json"), "utf8")));
  if (replayLane.actualInvocation?.artifactRoot !== "replay_validation" || replayLane.actualInvocation?.path !== "resolved-invocation-record.json") {
    fail("T04_INVOCATION_EVIDENCE_INVALID", "actualInvocation must reference resolved-invocation-record.json");
  }
  try { validateArtifactRef(replayLane.actualInvocation, { replay_validation: replayRoot }); }
  catch { fail("T04_INVOCATION_EVIDENCE_INVALID", "resolved invocation ArtifactRef mismatch"); }
  const resolved = JSON.parse(fs.readFileSync(path.join(replayRoot, replayLane.actualInvocation.path), "utf8"));
  try { validateResolvedReplayInvocation(resolved, replayRoot); }
  catch { fail("T04_INVOCATION_EVIDENCE_INVALID", "resolved invocation semantic mismatch"); }
  assertInvocationExecuted(resolved);
  for (let index = 0; index < resolved.steps.length; index += 1) {
    const step = resolved.steps[index]; const result = replayLane.stepResults[index];
    if (result?.stepId !== step.stepId || canonicalJson(result.stdout) !== canonicalJson(step.stdout) || canonicalJson(result.stderr) !== canonicalJson(step.stderr)) {
      fail("T04_INVOCATION_EVIDENCE_INVALID", `step result mismatch ${step.stepId}`);
    }
  }
  const expected = compareReplayOutputs(baselineRoot, replayRoot);
  const check = (actualItems, expectedItems) => {
    if (actualItems.length !== expectedItems.length) fail("T04_REPLAY_MISMATCH", "comparison denominator");
    for (let index = 0; index < actualItems.length; index += 1) {
      const actual = actualItems[index]; const wanted = expectedItems[index];
      if (actual.path !== actual.baseline.path || actual.path !== actual.replay.path || canonicalJson(actual) !== canonicalJson(wanted)) fail("T04_REPLAY_MISMATCH", actual.path);
    }
  };
  check(replayLane.exactComparisons, expected.exactComparisons);
  if (canonicalJson(replayLane.normalizedComparisons[0]?.ignoredJsonPointers) !== canonicalJson(["/recordedAt"])) fail("T04_REPLAY_NORMALIZATION_INVALID");
  check(replayLane.normalizedComparisons, expected.normalizedComparisons);
  check(replayLane.stdoutStderrComparisons, expected.stdoutStderrComparisons);
  return true;
}

export function validateFreshRaw(rawBytes, expectedRunId) {
  const raw = JSON.parse(rawBytes);
  if (raw.runId !== expectedRunId || !raw.seal || raw.seal.inputMode !== "canonical_json_without_seal_v1") fail("T04_FRESH_RAW_INVALID");
  const { seal, ...document } = raw;
  if (sha256(Buffer.from(canonicalJson(document), "utf8")) !== seal.contentSha256) fail("T04_FRESH_RAW_INVALID", "seal mismatch");
  return raw;
}

export function validateFreshLaneDocument(freshLane, { sourceRunRoot, validationRoot, baselineRawSha256 }) {
  if (!sourceRunRoot || !validationRoot || !fs.existsSync(path.join(sourceRunRoot, "raw/raw-run.json"))) fail("T04_FRESH_E2E_REQUIRED");
  const rawBytes = fs.readFileSync(path.join(sourceRunRoot, "raw/raw-run.json"));
  if (sha256(rawBytes) === baselineRawSha256 || freshLane.sealedRawRun.artifactRoot !== "fresh_source_run") fail("T04_CROSS_RUN_EVIDENCE_MIXED");
  const raw = validateFreshRaw(rawBytes, freshLane.sourceRunId);
  if (freshLane.sealSha256 !== raw.seal.contentSha256) fail("T04_FRESH_RAW_INVALID");
  const validation = JSON.parse(fs.readFileSync(path.join(validationRoot, "production-validation.json"), "utf8"));
  const contract = JSON.parse(fs.readFileSync(path.join(validationRoot, "contract-regression.json"), "utf8"));
  const mutations = JSON.parse(fs.readFileSync(path.join(validationRoot, "production-mutation-results.json"), "utf8"));
  const statuses = Object.fromEntries(["passed", "pending", "failed", "not_applicable"].map((status) => [status, validation.ruleResults.filter((item) => item.status === status).length]));
  if (validation.validationRunId !== freshLane.validationRunId || validation.sourceRunId !== freshLane.sourceRunId) fail("T04_CROSS_RUN_EVIDENCE_MIXED");
  if (validation.ruleResults.length !== 63 || statuses.passed !== 61 || statuses.pending !== 2 || statuses.failed || statuses.not_applicable
      || contract.caseResults?.length !== 109 || contract.passed !== true || mutations.total !== 42 || mutations.passed !== 42 || mutations.failed !== 0) fail("T04_VALIDATION_DENOMINATOR_MISMATCH");
  if (!freshLane.t02AcceptanceResults || freshLane.t02AcceptanceResults.length !== 12 || !freshLane.t03AcceptanceResults || freshLane.t03AcceptanceResults.length !== 14) fail("T04_T03_REGRESSION_FAILED");
  assertHumanBoundary({ humanReviewStatus: validation.humanReviewStatus, g7Status: validation.gateResults?.G7, finalPassed: validation.finalPassed, signingAllowed: false });
  return true;
}

export function validateArchitectureFromRaw({ architecture, rulesetBytes, allowlistBytes }) {
  const scan = scanTypeScriptArchitecture({
    manifest: architecture,
    artifactBytes: (artifactPath) => artifactPath === architecture.rulesetArtifact.path ? rulesetBytes : allowlistBytes,
    artifactValid: (reference) => reference.sha256 === sha256(reference.path === architecture.rulesetArtifact.path ? rulesetBytes : allowlistBytes)
  });
  if (!scan.scopeValid || scan.violations !== 0) fail("T04_ARCHITECTURE_REPLAY_FAILED");
  return true;
}

export function assertNoLegacyInvocation(invocation) {
  const forbidden = ["generate-v2-external-brain-productization-report.mjs", "validate-v2-external-brain-production-evidence.mjs", "validate-v2-external-brain-productization-report.mjs"];
  if (invocation.steps.some((step) => step.argv.some((value) => forbidden.some((name) => String(value).includes(name))))) fail("T04_LEGACY_PIPELINE_FORBIDDEN");
  return true;
}

export function validatePublicBytes(entries, { forbiddenByteValues = [] } = {}) {
  const evidenceText = /^(?:fresh\/|replay\/|t04\/(?:audits\/|acceptance-report|negative-fixture|snapshot-revalidation|tests\/))/;
  const credentialPatterns = [/Bearer\s+[A-Za-z0-9._~-]{8,}/i, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/];
  const forbidden = forbiddenByteValues
    .filter((value) => typeof value === "string" && value.length >= 4)
    .map((value) => Buffer.from(value, "utf8"));
  for (const entry of entries) {
    if (forbidden.some((value) => entry.bytes.indexOf(value) >= 0)) fail("T04_PUBLIC_EVIDENCE_LEAK", entry.path);
    if (evidenceText.test(entry.path) && credentialPatterns.some((pattern) => pattern.test(entry.bytes.toString("utf8")))) {
      fail("T04_PUBLIC_EVIDENCE_LEAK", entry.path);
    }
  }
  return true;
}

export function archiveMembers(archivePath) {
  const result = spawnSync("tar", ["-tzf", archivePath], { encoding: "utf8" });
  if (result.status !== 0) fail("T04_EXIT_MANIFEST_INVALID", "archive unreadable");
  return result.stdout.split(/\r?\n/).filter(Boolean).map((item) => item.replace(/^\.\//, ""));
}

export function validateArchiveMembership(members) {
  if (members.some((item) => /(?:^|\/)exit-manifest\.json$/.test(item) || /independent-implementation-exit-audit\.md$/.test(item))) fail("T04_EXIT_MANIFEST_INVALID", "forbidden archive member");
  return true;
}

export function validateExitManifestDocument(exitManifest, roots) {
  const clone = structuredClone(exitManifest);
  const claimed = clone.contentSha256;
  delete clone.contentSha256;
  if (sha256(Buffer.from(canonicalJson(clone), "utf8")) !== claimed) fail("T04_EXIT_MANIFEST_INVALID", "content hash mismatch");
  for (const ref of [exitManifest.snapshotInputManifest, exitManifest.snapshotRevalidation, exitManifest.freshProductionPackage, exitManifest.freshInvocationRecord, exitManifest.chineseAcceptanceHtml, exitManifest.drawio, ...exitManifest.testArtifacts, ...exitManifest.auditArtifacts, exitManifest.publicEvidenceArchive]) {
    try { validateArtifactRef(ref, roots); } catch { fail("T04_EXIT_MANIFEST_INVALID", ref.path); }
  }
  validateArchiveMembership(archiveMembers(path.join(roots.t04_run, exitManifest.publicEvidenceArchive.path)));
  assertHumanBoundary(exitManifest);
  if (exitManifest.signed !== false) fail("T04_HUMAN_BOUNDARY_VIOLATION");
  return true;
}

export function runRegisteredNegativeCases({ registry, actions }) {
  return registry.map((requirement) => {
    const action = actions[requirement.requirementId];
    if (typeof action !== "function") throw new Error(`T04_VALIDATION_DENOMINATOR_MISMATCH: missing action ${requirement.requirementId}`);
    let observed = null;
    let observedDetail = "no exception";
    try { action(); } catch (error) {
      observed = errorCode(error);
      observedDetail = error instanceof Error ? error.message : String(error);
    }
    if (observed !== requirement.expectedPrimaryFailure) throw new Error(`T04_VALIDATION_DENOMINATOR_MISMATCH: ${requirement.requirementId} expected ${requirement.expectedPrimaryFailure}, observed ${observed}; detail=${observedDetail}`);
    return { ...requirement, expectedLayer: "semantic", observedPrimaryFailure: observed, passed: true };
  });
}
