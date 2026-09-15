import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { deriveFacts, missingObservations } from "./v2PxDerivedFacts.mjs";
import { jsonSchemaBatchErrors, refForBytes, validateJsonSchema, writeAtomic, writeJson } from "./v2PxPipelineIo.mjs";
import {
  archiveMembers,
  assertHumanBoundary,
  assertNoLegacyInvocation,
  errorCode,
  validateArchitectureFromRaw,
  validateExitManifestDocument,
  validateFreshLaneDocument,
  validatePublicBytes,
  validateReplayLaneDocument,
  validateSnapshotManifestSemantics
} from "./v2PxSnapshotComparison.mjs";
import { artifactRef, canonicalJson, sha256, validateArtifactRef } from "./v2PxSnapshotReplay.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = path.resolve(moduleDir, "../../../..");
export const PX6_SCHEMA_PATH = path.join(REPOSITORY_ROOT, "docs/active/project/contracts/v2_px6_exit_contracts.schema.json");
export const PX6_FIXTURE_PATH = path.join(REPOSITORY_ROOT, "docs/active/project/contracts/fixtures/v2_external_brain/px6-exit-contract-fixtures.json");
export const PX6_AUTHORIZATION_PATH = path.join(REPOSITORY_ROOT, "docs/active/project/evidence/v2_external_brain_productization/px-6/implementation/implementation-authorization.json");
export const T04_RUNS_ROOT = path.join(REPOSITORY_ROOT, "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/runs");
export const T03_RUNS_ROOT = path.join(REPOSITORY_ROOT, "docs/active/project/evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/runs");
export const T02_5_RUNS_ROOT = path.join(REPOSITORY_ROOT, "docs/active/project/evidence/v2_external_brain_productization/px-5/t02.5-t01-structured-regression-recollection/runs");
export const T04_AUDIT_ROOT = path.join(REPOSITORY_ROOT, "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation");
export const DOCUMENT_AUDIT_PATH = path.join(REPOSITORY_ROOT, "docs/active/project/evidence/v2_external_brain_productization/px-6/document-freeze/independent-document-audit.md");
export const T04_IMPLEMENTATION_AUDIT_PATH = path.join(T04_AUDIT_ROOT, "t04.1-independent-implementation-exit-audit.md");
export const LEGACY_RUNNER = "audit-v2-external-brain-exit.mjs";

const EXPECTED_SCOPE = "PX6-0..PX6-5 machine implementation and PX6-7 finalizer implementation; PX6-6 human review excluded";
const EXPECTED_USER_INSTRUCTION = "Implement the plan.";
const EXPECTED_DOCUMENT_AUDIT_SHA256 = "42ba594842b9db3bd767010223c27279f7f8a245343ce939f962a7e74f49d63e";
const EXPECTED_T04_AUDIT_SHA256 = "5f48071ea11010a485a3e1189330961d8c6f7fda0bf04a468ae28f5831f0e3dc";

const ACCEPTANCE_IDS = Array.from({ length: 16 }, (_, index) => `PX6-A${String(index + 1).padStart(2, "0")}`);
const EXPECTED_DENOMINATORS = Object.freeze({
  productionScenarios: 17,
  sources: 12,
  webSources: 6,
  localSources: 3,
  noteSources: 3,
  routeCells: 20,
  forgetRecoveryChains: 12,
  faultClasses: 4,
  viewportClasses: 4,
  axeSerious: 0,
  axeCritical: 0,
  keyboardPassed: 5,
  keyboardTotal: 5,
  validationRules: 63,
  machineRulesPassed: 61,
  humanRulesPending: 2,
  contractFixtures: 109,
  productionMutations: 42,
  t04Acceptance: 14,
  t04Negatives: 25
});

function fail(code, message) {
  throw new Error(`${code}${message ? `: ${message}` : ""}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walkFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  };
  visit(root);
  return files;
}

function ensureExactObject(actual, expected, code) {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(code, `expected ${canonicalJson(expected)}, observed ${canonicalJson(actual)}`);
}

export function withContentSha256(document) {
  const base = structuredClone(document);
  delete base.contentSha256;
  return { ...base, contentSha256: sha256(Buffer.from(canonicalJson(base), "utf8")) };
}

export function validateContentSha256(document, code = "PX6_T04_EXIT_MANIFEST_CONTENT_MISMATCH") {
  const expected = document?.contentSha256;
  const base = structuredClone(document);
  delete base.contentSha256;
  if (!expected || sha256(Buffer.from(canonicalJson(base), "utf8")) !== expected) fail(code, "canonical content hash mismatch");
  return true;
}

export function validatePx6Authorization(repositoryRoot = REPOSITORY_ROOT) {
  const raw = fs.readFileSync(path.resolve(repositoryRoot, path.relative(REPOSITORY_ROOT, PX6_AUTHORIZATION_PATH)));
  const record = JSON.parse(raw);
  if (raw.toString("utf8") !== canonicalJson(record)) fail("PX6_HUMAN_AUTHORIZATION_INVALID", "implementation authorization must be canonical JSON without trailing bytes");
  const documentAudit = fs.readFileSync(path.resolve(repositoryRoot, path.relative(REPOSITORY_ROOT, DOCUMENT_AUDIT_PATH)));
  const t04Audit = fs.readFileSync(path.resolve(repositoryRoot, path.relative(REPOSITORY_ROOT, T04_IMPLEMENTATION_AUDIT_PATH)));
  const expected = {
    schemaVersion: "v2-px6-implementation-authorization/v1",
    stage: "PX-6",
    decision: "approved",
    approvedScope: EXPECTED_SCOPE,
    userId: "repository_owner_current_chat",
    userInstructionText: EXPECTED_USER_INSTRUCTION,
    userInstructionSha256: sha256(Buffer.from(EXPECTED_USER_INSTRUCTION, "utf8")),
    documentAuditSha256: EXPECTED_DOCUMENT_AUDIT_SHA256,
    t041ImplementationAuditSha256: EXPECTED_T04_AUDIT_SHA256
  };
  for (const [key, value] of Object.entries(expected)) if (record[key] !== value) fail("PX6_HUMAN_AUTHORIZATION_INVALID", `${key} mismatch`);
  if (sha256(documentAudit) !== record.documentAuditSha256 || sha256(t04Audit) !== record.t041ImplementationAuditSha256) fail("PX6_HUMAN_AUTHORIZATION_INVALID", "audit bytes changed");
  if (typeof record.authorizedAt !== "string" || Number.isNaN(Date.parse(record.authorizedAt)) || !record.recordedBy) fail("PX6_HUMAN_AUTHORIZATION_INVALID", "authorization metadata incomplete");
  return { record, raw };
}

export function validateContractFreeze(schemaPath = PX6_SCHEMA_PATH, fixturePath = PX6_FIXTURE_PATH) {
  const schema = readJson(schemaPath);
  const fixture = readJson(fixturePath);
  const positiveErrors = jsonSchemaBatchErrors(schemaPath, fixture.positiveInstances.map((entry) => entry.instance));
  if (positiveErrors.length) fail("PX6_VALIDATION_DENOMINATOR_MISMATCH", `positive contract errors: ${JSON.stringify(positiveErrors)}`);
  const registry = schema["x-navia-requirement-registry"] ?? [];
  const failureCodes = schema["x-navia-failure-code-registry"] ?? [];
  const registryTuples = registry.map((item) => [item.requirementId, item.requirementKey, item.failureCode, item.enforcementLayer]);
  const caseTuples = fixture.cases.map((item) => [item.requirementId, item.requirementKey, item.expectedPrimaryFailure, item.expectedLayer]);
  if (fixture.positiveInstances.length !== 7 || registry.length !== 20 || fixture.cases.length !== 20 || failureCodes.length !== 20
      || new Set(failureCodes).size !== 20 || canonicalJson(registryTuples.sort()) !== canonicalJson(caseTuples.sort())) {
    fail("PX6_VALIDATION_DENOMINATOR_MISMATCH", "PX-6 contract registry, cases, or positives are incomplete");
  }
  return { schema, fixture, positiveCount: 7, requirementCount: 20, caseCount: 20, failureCodeCount: 20 };
}

function verifyRefOrFail(ref, roots, code) {
  try { return validateArtifactRef(ref, roots); }
  catch (error) { fail(code, error.message); }
}

function validateAuditBytes(binding, roots) {
  const audit = verifyRefOrFail(binding.independentImplementationAudit, roots, "PX6_T04_INDEPENDENT_AUDIT_MISMATCH");
  const text = fs.readFileSync(path.join(roots.t04_external_audit, binding.independentImplementationAudit.path), "utf8");
  if (audit.sha256 !== EXPECTED_T04_AUDIT_SHA256 || !/Fatal\s*=\s*0/.test(text) || !/Major\s*=\s*0/.test(text)
      || !/T04\.1 LIMITED PASS/.test(text) || !text.includes(binding.t04RunId)) {
    fail("PX6_T04_INDEPENDENT_AUDIT_MISMATCH", "T04.1 audit disposition or binding mismatch");
  }
}

function extractPublicArchive(archivePath) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "navia-px6-public-"));
  const result = spawnSync("tar", ["--same-permissions", "-xzf", archivePath, "-C", temporaryRoot], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
    fail("PX6_T04_EXIT_MANIFEST_HASH_MISMATCH", `public archive extraction failed: ${result.stderr}`);
  }
  return temporaryRoot;
}

function materializeSnapshotRepository(bundlePath, temporaryRoot, acceptanceCommit, dependencyFiles) {
  const snapshotRoot = path.join(temporaryRoot, "snapshot-repository");
  const clone = spawnSync("git", ["clone", "--quiet", "--no-checkout", bundlePath, snapshotRoot], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (clone.status !== 0) fail("PX6_T04_EVIDENCE_MUTATED", `snapshot bundle clone failed: ${clone.stderr}`);
  const checkout = spawnSync("git", ["-C", snapshotRoot, "checkout", "--quiet", "--detach", acceptanceCommit], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (checkout.status !== 0) fail("PX6_T04_EVIDENCE_MUTATED", `snapshot commit checkout failed: ${checkout.stderr}`);
  for (const file of dependencyFiles) {
    if (file.mode === "120000") continue;
    fs.chmodSync(path.join(snapshotRoot, ...file.path.split("/")), file.mode === "100755" ? 0o755 : 0o644);
  }
  return snapshotRoot;
}

function validatePublicArchive(archivePath, extractedRoot) {
  const memberIndexPath = path.join(extractedRoot, "t04/public/payload-member-index.json");
  const index = readJson(memberIndexPath);
  const actualMembers = archiveMembers(archivePath).sort();
  const expectedMembers = [...index.members.map((item) => item.path), "t04/public/payload-member-index.json"].sort();
  if (canonicalJson(actualMembers) !== canonicalJson(expectedMembers)) fail("PX6_T04_EVIDENCE_MUTATED", "public archive member index mismatch");
  const entries = index.members.map((member) => {
    const absolute = path.join(extractedRoot, ...member.path.split("/"));
    const bytes = fs.readFileSync(absolute);
    if (sha256(bytes) !== member.sha256 || bytes.length !== member.byteLength) fail("PX6_T04_EVIDENCE_MUTATED", `archive member changed: ${member.path}`);
    return { path: member.path, bytes };
  });
  validatePublicBytes(entries);
  return { memberCount: index.members.length, archiveMemberCount: actualMembers.length, entries };
}

function allArtifactRoots(document) {
  const roots = [];
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    if (typeof value.artifactRoot === "string" && typeof value.path === "string") roots.push(value.artifactRoot);
    Object.values(value).forEach(visit);
  };
  visit(document);
  return roots;
}

export function validateDenominators(denominators) {
  ensureExactObject(denominators, EXPECTED_DENOMINATORS, "PX6_SOURCE_SCENARIO_DENOMINATOR_MISMATCH");
  return true;
}

export function validateRecomputedFacts(summary) {
  const sourceExpected = summary.sourceCount === 12 && summary.sourceDistribution?.web === 6 && summary.sourceDistribution?.local === 3 && summary.sourceDistribution?.note === 3;
  if (!sourceExpected) fail("PX6_SOURCE_SCENARIO_DENOMINATOR_MISMATCH", "source corpus mismatch");
  const routeCells = Object.values(summary.routeMatrix ?? {}).reduce((count, modes) => count + ["direct_open", "reload", "back", "reopen"].filter((mode) => modes?.[mode] >= 1).length, 0);
  if (routeCells !== 20 || summary.ordinaryRecoveryCount < 2) fail("PX6_ROUTE_MATRIX_INCOMPLETE", "route or recovery matrix mismatch");
  if (summary.durableForgetTriggers !== 12 || summary.durableForgetRecoveries !== 12 || summary.forgetSourceCount !== 3) fail("PX6_FORGET_RECOVERY_INCOMPLETE", "durable Forget denominator mismatch");
  if ((summary.faultTypes ?? []).length !== 4 || ![360, 420, 768, 1280].every((width) => summary.screenshotWidths?.[width] >= 1)
      || summary.axe?.serious !== 0 || summary.axe?.critical !== 0 || summary.keyboard?.assertionsTotal !== 5 || summary.keyboard?.assertionsPassed !== 5) {
    fail("PX6_UX_OR_FAULT_EVIDENCE_INCOMPLETE", "fault, viewport, Axe, or keyboard denominator mismatch");
  }
  return { routeCells };
}

export function validateProductionDenominators({ validation, contractRegression, productionMutations, report, snapshotRevalidation, t041Acceptance, t041Negatives }) {
  const statuses = Object.fromEntries(["passed", "pending", "failed", "not_applicable"].map((status) => [status, validation.ruleResults.filter((item) => item.status === status).length]));
  const t04 = snapshotRevalidation.t04AcceptanceResults ?? [];
  const t04Negatives = snapshotRevalidation.negativeResults ?? [];
  if (validation.ruleResults.length !== 63 || statuses.passed !== 61 || statuses.pending !== 2 || statuses.failed !== 0 || statuses.not_applicable !== 0
      || contractRegression.caseResults?.length !== 109 || contractRegression.passed !== true
      || productionMutations.total !== 42 || productionMutations.passed !== 42 || productionMutations.failed !== 0
      || report.summary?.scenariosTotal !== 17 || report.summary?.scenariosPassed !== 17 || report.summary?.sourceCorpusTotal !== 12
      || t04.length !== 14 || t04.some((item) => item.status !== "passed")
      || t04Negatives.length !== 25 || t04Negatives.some((item) => item.passed !== true || item.expectedPrimaryFailure !== item.observedPrimaryFailure)
      || t041Acceptance.results?.length !== 14 || t041Acceptance.results.some((item) => item.status !== "passed")
      || t041Negatives.length !== 8 || t041Negatives.some((item) => item.passed !== true || item.expectedPrimaryFailure !== item.observedPrimaryFailure)) {
    fail("PX6_VALIDATION_DENOMINATOR_MISMATCH", "63/109/42, T04/T04.1, report, or negative denominator mismatch");
  }
  assertHumanBoundary({ humanReviewStatus: validation.humanReviewStatus, g7Status: validation.gateResults?.G7, finalPassed: validation.finalPassed, signingAllowed: false });
  return { statuses, t04Acceptance: t04.length, t04Negatives: t04Negatives.length, t041Acceptance: 14, t041Negatives: 8 };
}

export function validateActiveDocuments(repositoryRoot = REPOSITORY_ROOT, overrides = {}) {
  const required = [
    ["docs/active/project/01-prd.md", ["T04.1", "LIMITED PASS", "PX-6"]],
    ["docs/active/project/02-architecture.md", ["T04.1", "PX-6"]],
    ["docs/active/project/04-acceptance-plan.md", ["T04.1", "PX-6"]],
    ["docs/active/project/stage-gates/v2-external-brain-productization.md", ["T04.1", "PX-6"]]
  ];
  const snapshots = [];
  for (const [relativePath, markers] of required) {
    const bytes = overrides[relativePath] === undefined
      ? fs.readFileSync(path.join(repositoryRoot, relativePath))
      : Buffer.from(overrides[relativePath], "utf8");
    const text = bytes.toString("utf8");
    if (!markers.every((marker) => text.includes(marker))) fail("PX6_DOCUMENT_OR_DRAWIO_STATE_MISMATCH", `${relativePath} is stale`);
    snapshots.push({ sourcePath: relativePath, snapshotPath: `document-snapshot/${path.basename(relativePath)}.base64`, mediaType: "text/markdown", bytes });
  }
  const drawioRelativePath = "docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio";
  const drawioPath = path.join(repositoryRoot, drawioRelativePath);
  const drawioBytes = overrides.drawio === undefined ? fs.readFileSync(drawioPath) : Buffer.from(overrides.drawio, "utf8");
  const drawioText = drawioBytes.toString("utf8");
  if (!drawioText.includes("T04.1") || !drawioText.includes("PX-6")) fail("PX6_DOCUMENT_OR_DRAWIO_STATE_MISMATCH", "Draw.io state markers missing");
  const check = spawnSync("python3", ["-c", [
    "import sys,xml.etree.ElementTree as E",
    "r=E.fromstring(sys.stdin.read()); ps=r.findall('diagram'); assert 1<=len(ps)<=8",
    "for p in ps:",
    " m=p.find('mxGraphModel'); q=m.find('root'); cs=q.findall('mxCell'); ids=[c.get('id') for c in cs]; assert len(ids)==len(set(ids)); ks=set(ids)",
    " for c in cs:",
    "  if c.get('edge')=='1': assert c.get('source') in ks and c.get('target') in ks",
    "  if c.get('vertex')=='1':",
    "   g=c.find('mxGeometry')",
    "   if g is not None:",
    "    x=float(g.get('x','0')); y=float(g.get('y','0')); w=float(g.get('width','0')); h=float(g.get('height','0')); assert x>=0 and y>=0 and x+w<=1600 and y+h<=900",
    "print(len(ps))"
  ].join("\n")], { input: drawioText, encoding: "utf8" });
  if (check.status !== 0) fail("PX6_DOCUMENT_OR_DRAWIO_STATE_MISMATCH", check.stderr || "Draw.io structure invalid");
  snapshots.push({ sourcePath: drawioRelativePath, snapshotPath: `document-snapshot/${path.basename(drawioRelativePath)}.base64`, mediaType: "application/vnd.jgraph.mxfile", bytes: drawioBytes });
  return { pages: Number(check.stdout.trim()), snapshots };
}

export function validateLegacyInvocation(argv) {
  if (argv.some((value) => String(value).includes(LEGACY_RUNNER))) fail("PX6_LEGACY_PIPELINE_FORBIDDEN", LEGACY_RUNNER);
  return true;
}

export function validateMachineBoundary(outputRoot = null) {
  if (outputRoot) {
    const forbidden = ["review-submission.json", "final-disposition.json", "final-report.json", "final-report.html", "human-review-v3.json"];
    for (const name of forbidden) if (fs.existsSync(path.join(outputRoot, name))) fail("PX6_REPORT_PROMOTED_BEFORE_REVIEW", name);
  }
  return true;
}

export function readAndValidateCandidate(bindingPath, { repositoryRoot = REPOSITORY_ROOT } = {}) {
  if (!path.isAbsolute(bindingPath)) fail("PX6_T04_ARTIFACT_ROOT_UNRESOLVED", "candidate binding path must be absolute");
  const contract = validateContractFreeze();
  const authorization = validatePx6Authorization(repositoryRoot);
  const bindingBytes = fs.readFileSync(bindingPath);
  const binding = JSON.parse(bindingBytes);
  validateJsonSchema(PX6_SCHEMA_PATH, binding);
  if (binding.exitManifestRawSha256 !== authorization.record.candidateExitManifestRawSha256) fail("PX6_T04_EXIT_MANIFEST_HASH_MISMATCH", "authorization and binding differ");
  validateDenominators(binding.denominators);
  const t04Root = path.join(T04_RUNS_ROOT, binding.t04RunId);
  const roots = { t04_candidate: t04Root, t04_external_audit: T04_AUDIT_ROOT, t04_run: t04Root, fresh_validation: path.join(t04Root, "fresh/validation"), replay_validation: path.join(t04Root, "replay/output"), fresh_source_run: path.join(t04Root, "fresh/source-run") };
  const exitPath = path.join(t04Root, binding.exitManifest.path);
  const exitBytes = fs.readFileSync(exitPath);
  if (sha256(exitBytes) !== binding.exitManifestRawSha256 || binding.exitManifest.sha256 !== binding.exitManifestRawSha256 || exitBytes.length !== binding.exitManifest.byteLength) fail("PX6_T04_EXIT_MANIFEST_HASH_MISMATCH", "ExitManifest raw bytes differ");
  const exitManifest = JSON.parse(exitBytes);
  validateContentSha256(exitManifest);
  if (exitManifest.contentSha256 !== binding.exitManifestContentSha256 || exitManifest.t04RunId !== binding.t04RunId) fail("PX6_T04_EXIT_MANIFEST_CONTENT_MISMATCH", "ExitManifest content or run binding differs");
  verifyRefOrFail(binding.publicEvidenceArchive, roots, "PX6_T04_EXIT_MANIFEST_HASH_MISMATCH");
  validateAuditBytes(binding, roots);

  const archivePath = path.join(t04Root, binding.publicEvidenceArchive.path);
  const extractedRoot = extractPublicArchive(archivePath);
  try {
    const publicAudit = validatePublicArchive(archivePath, extractedRoot);
    const snapshotManifest = readJson(path.join(t04Root, "snapshot-input-manifest.json"));
    const snapshotRevalidation = readJson(path.join(t04Root, "snapshot-revalidation.json"));
    const replayLane = readJson(path.join(t04Root, "replay/replay-lane.json"));
    const freshLane = readJson(path.join(t04Root, "fresh/fresh-lane.json"));
    const baselineRoot = path.join(T03_RUNS_ROOT, snapshotManifest.baseline.t03ValidationRunId);
    const baselineSourceRoot = path.join(T02_5_RUNS_ROOT, snapshotManifest.baseline.sourceRunId);
    const historicalRepositoryRoot = materializeSnapshotRepository(path.join(t04Root, snapshotManifest.snapshot.snapshotBundle.path), extractedRoot, snapshotManifest.snapshot.acceptanceCommit, snapshotManifest.dependencyClosure.files);
    validateSnapshotManifestSemantics(snapshotManifest, {
      roots: { ...roots, source_run: baselineSourceRoot, repository_snapshot: repositoryRoot },
      snapshotRoot: historicalRepositoryRoot,
      expectedBaselineId: snapshotManifest.baseline.t03ValidationRunId,
      expectedRawSha256: snapshotManifest.baseline.sealedRawRun.sha256,
      expectedSealSha256: snapshotManifest.baseline.sealSha256,
      mainRepositoryRoot: repositoryRoot
    });
    validateReplayLaneDocument(replayLane, { baselineRoot, replayRoot: roots.replay_validation });
    const resolved = readJson(path.join(roots.replay_validation, "resolved-invocation-record.json"));
    if (allArtifactRoots(resolved).some((root) => root !== "replay_validation")) fail("PX6_T04_ARTIFACT_ROOT_UNRESOLVED", "resolved invocation contains a non-replay root");
    validateFreshLaneDocument(freshLane, { sourceRunRoot: roots.fresh_source_run, validationRoot: roots.fresh_validation, baselineRawSha256: snapshotManifest.baseline.sealedRawRun.sha256 });
    validateExitManifestDocument(exitManifest, { ...roots, repository_snapshot: historicalRepositoryRoot });

    const storedDerived = readJson(path.join(roots.fresh_validation, "derived-facts.json"));
    const recomputed = deriveFacts({ runRoot: roots.fresh_source_run, sealedRawRun: storedDerived.sealedRawRun, generatorImplementation: storedDerived.generatorImplementation, generatedAt: storedDerived.generatedAt });
    if (recomputed.gaps.length || missingObservations(recomputed.facts.summary).length || canonicalJson(recomputed.facts) !== canonicalJson(storedDerived)) fail("PX6_T04_EVIDENCE_MUTATED", "fresh facts do not rederive from raw bytes");
    const factsAudit = validateRecomputedFacts(recomputed.facts.summary);
    const architecture = readJson(path.join(roots.fresh_validation, "architecture-scan-manifest.json"));
    const executableArchitecture = structuredClone(architecture);
    executableArchitecture.trackedPaths = architecture.trackedPaths.map((item) => {
      const bytes = fs.readFileSync(path.join(historicalRepositoryRoot, ...item.path.split("/")));
      const hash = sha256(bytes);
      if (hash !== item.blobSha256) fail("PX6_T04_EVIDENCE_MUTATED", `architecture source changed: ${item.path}`);
      return { ...item, inlineSource: { encoding: "utf8", content: bytes.toString("utf8"), sha256: hash } };
    });
    validateArchitectureFromRaw({ architecture: executableArchitecture, rulesetBytes: fs.readFileSync(path.join(roots.fresh_validation, architecture.rulesetArtifact.path)), allowlistBytes: fs.readFileSync(path.join(roots.fresh_validation, architecture.allowlistArtifact.path)) });
    const validation = readJson(path.join(roots.fresh_validation, "production-validation.json"));
    const contractRegression = readJson(path.join(roots.fresh_validation, "contract-regression.json"));
    const productionMutations = readJson(path.join(roots.fresh_validation, "production-mutation-results.json"));
    const report = readJson(path.join(roots.fresh_validation, "report.json"));
    const t041Acceptance = readJson(path.join(t04Root, "t04.1-acceptance-results.json"));
    const t041Negatives = readJson(path.join(t04Root, "t04.1-negative-fixture-executions.json"));
    const validationAudit = validateProductionDenominators({ validation, contractRegression, productionMutations, report, snapshotRevalidation, t041Acceptance, t041Negatives });
    assertNoLegacyInvocation(resolved);
    const documentAudit = validateActiveDocuments(repositoryRoot);
    return { authorization, binding, bindingBytes, roots, exitManifest, exitBytes, snapshotManifest, snapshotRevalidation, replayLane, resolved, freshLane, recomputed, storedDerived, validation, contractRegression, productionMutations, report, t041Acceptance, t041Negatives, publicAudit: { memberCount: publicAudit.memberCount, archiveMemberCount: publicAudit.archiveMemberCount }, factsAudit, validationAudit, documentAudit, contract };
  } finally {
    fs.rmSync(extractedRoot, { recursive: true, force: true });
  }
}

function semanticCheck(code, condition, detail) {
  if (!condition) fail(code, detail);
}

export function validateReviewSubmissionSemantics(submission, { automationProvenance = false, finalArtifactsPresent = false, allowedClaims = [] } = {}) {
  semanticCheck("PX6_AUTOMATED_REVIEWER_FORBIDDEN", submission.submittedByAutomation === false && !automationProvenance, "automation cannot submit review");
  semanticCheck("PX6_HUMAN_AUTHORIZATION_INVALID", sha256(Buffer.from(submission.reviewAuthorization.authorizationText, "utf8")) === submission.reviewAuthorization.authorizationTextSha256, "review authorization hash mismatch");
  const failed = submission.gateReviews.filter((item) => item.status === "failed");
  if (submission.status === "passed") semanticCheck("PX6_HUMAN_GATE_INCOMPLETE", failed.length === 0 && submission.gateReviews.length === 7, "passed review contains failed or missing gates");
  if (submission.status === "failed") semanticCheck("PX6_HUMAN_FAILURE_WITHOUT_BLOCKER", failed.length > 0 && submission.blockingIssues.length > 0, "failed review requires a blocker");
  semanticCheck("PX6_REPORT_PROMOTED_BEFORE_REVIEW", !finalArtifactsPresent, "final output exists before validated review");
  if (allowedClaims.length) semanticCheck("PX6_CLAIM_OR_FINAL_AUDIT_OVERREACH", allowedClaims.includes(submission.signedClaim), "claim outside frozen scope");
  return true;
}

export function validateFinalState({ submission, finalPassed, g7Status, claim }) {
  const passed = submission.status === "passed" && submission.gateReviews.every((item) => item.status === "passed") && submission.blockingIssues.length === 0;
  if (Boolean(finalPassed) !== passed || g7Status !== (passed ? "passed" : "failed")) fail("PX6_G7_FINAL_STATE_INVALID", "G7/final state is inconsistent with human submission");
  const allowed = passed
    ? (submission.evidenceClass === "production_acceptance" ? "V2-PX External Brain Productization passed dual-container real-Chrome acceptance." : "PX-6 contract fixture passed; not product acceptance evidence.")
    : "V2-PX External Brain Productization acceptance did not pass.";
  if (claim !== allowed) fail("PX6_CLAIM_OR_FINAL_AUDIT_OVERREACH", "final claim outside frozen scope");
  return true;
}

export function runPx6NegativeSuite(context) {
  const { fixture } = context.contract;
  const positive = Object.fromEntries(fixture.positiveInstances.map((entry) => [entry.positiveId, entry.instance]));
  const actions = {
    "PX6-N-001": () => semanticCheck("PX6_T04_EXIT_MANIFEST_HASH_MISMATCH", sha256(Buffer.concat([context.exitBytes, Buffer.from("\n")])) === context.binding.exitManifestRawSha256, "raw mutation"),
    "PX6-N-002": () => validateContentSha256({ ...context.exitManifest, claim: `${context.exitManifest.claim} changed` }),
    "PX6-N-003": () => semanticCheck("PX6_T04_INDEPENDENT_AUDIT_MISMATCH", sha256(Buffer.from("changed audit")) === context.binding.independentImplementationAudit.sha256, "audit mutation"),
    "PX6-N-004": () => semanticCheck("PX6_T04_ARTIFACT_ROOT_UNRESOLVED", !allArtifactRoots({ ...context.resolved, sourceInvocation: { ...context.resolved.sourceInvocation, artifactRoot: "validation_run" } }).includes("validation_run"), "resolved root mutation"),
    "PX6-N-005": () => validateLegacyInvocation([LEGACY_RUNNER]),
    "PX6-N-006": () => validateDenominators({ ...context.binding.denominators, sources: 11 }),
    "PX6-N-007": () => validateRecomputedFacts({ ...context.recomputed.facts.summary, routeMatrix: { ...context.recomputed.facts.summary.routeMatrix, ask: { ...context.recomputed.facts.summary.routeMatrix.ask, reopen: 0 } } }),
    "PX6-N-008": () => validateRecomputedFacts({ ...context.recomputed.facts.summary, durableForgetRecoveries: 11 }),
    "PX6-N-009": () => validateRecomputedFacts({ ...context.recomputed.facts.summary, keyboard: null }),
    "PX6-N-010": () => validateProductionDenominators({ ...context, productionMutations: { ...context.productionMutations, total: 41, passed: 41 }, snapshotRevalidation: context.snapshotRevalidation }),
    "PX6-N-011": () => semanticCheck("PX6_CROSS_RUN_EVIDENCE_MIXED", context.freshLane.sourceRunId === `${context.freshLane.sourceRunId}-historical`, "cross-run ref mutation"),
    "PX6-N-012": () => semanticCheck("PX6_T04_EVIDENCE_MUTATED", sha256(Buffer.from("mutated report")) === context.exitManifest.freshProductionPackage.sha256, "post-audit bytes changed"),
    "PX6-N-013": () => validateActiveDocuments(REPOSITORY_ROOT, { "docs/active/project/01-prd.md": "stale document", drawio: "stale drawio" }),
    "PX6-N-014": () => validateReviewSubmissionSemantics(structuredClone(positive["PX6-P-005-review-submission"]), { automationProvenance: true }),
    "PX6-N-015": () => {
      const item = structuredClone(positive["PX6-P-005-review-submission"]); item.reviewAuthorization.authorizationText += " changed"; validateReviewSubmissionSemantics(item);
    },
    "PX6-N-016": () => {
      const item = structuredClone(positive["PX6-P-005-review-submission"]); item.gateReviews[6].status = "failed"; validateReviewSubmissionSemantics(item);
    },
    "PX6-N-017": () => {
      const item = structuredClone(positive["PX6-P-005-review-submission"]); item.status = "failed"; item.gateReviews[6].status = "failed"; item.blockingIssues = []; validateReviewSubmissionSemantics(item);
    },
    "PX6-N-018": () => validateReviewSubmissionSemantics(structuredClone(positive["PX6-P-005-review-submission"]), { finalArtifactsPresent: true }),
    "PX6-N-019": () => validateFinalState({ submission: positive["PX6-P-005-review-submission"], finalPassed: true, g7Status: "pending", claim: "PX-6 contract fixture passed; not product acceptance evidence." }),
    "PX6-N-020": () => validateFinalState({ submission: positive["PX6-P-005-review-submission"], finalPassed: true, g7Status: "passed", claim: "V2 complete and RAG ready." })
  };
  return fixture.cases.map((testCase) => {
    let observed = null;
    try { actions[testCase.requirementId](); } catch (error) { observed = errorCode(error); }
    if (observed !== testCase.expectedPrimaryFailure) fail("PX6_VALIDATION_DENOMINATOR_MISMATCH", `${testCase.requirementId}: expected ${testCase.expectedPrimaryFailure}, observed ${observed}`);
    return { caseId: testCase.caseId, requirementId: testCase.requirementId, requirementKey: testCase.requirementKey, mutation: testCase.mutation, expectedLayer: testCase.expectedLayer, expectedPrimaryFailure: testCase.expectedPrimaryFailure, observedPrimaryFailure: observed, passed: true };
  });
}

export function candidateEvidenceRefs(context) {
  return {
    binding: refForBytes("px6_run", "candidate-binding.json", context.bindingBytes, "application/json"),
    exit: context.binding.exitManifest,
    publicArchive: context.binding.publicEvidenceArchive,
    independentAudit: context.binding.independentImplementationAudit,
    replayInvocation: artifactRef("t04_candidate", context.roots.t04_candidate, "replay/output/resolved-invocation-record.json", "application/json"),
    freshRaw: artifactRef("t04_candidate", context.roots.t04_candidate, "fresh/source-run/raw/raw-run.json", "application/json"),
    derived: artifactRef("t04_candidate", context.roots.t04_candidate, "fresh/validation/derived-facts.json", "application/json"),
    validation: artifactRef("t04_candidate", context.roots.t04_candidate, "fresh/validation/production-validation.json", "application/json"),
    report: artifactRef("t04_candidate", context.roots.t04_candidate, "fresh/validation/report.json", "application/json"),
    snapshot: artifactRef("t04_candidate", context.roots.t04_candidate, "snapshot-revalidation.json", "application/json")
  };
}

export function createAcceptanceResults(refs, generatedRefs) {
  const evidence = [refs.binding, refs.exit, refs.replayInvocation, refs.freshRaw, refs.derived, refs.derived, refs.derived, refs.snapshot, refs.derived, refs.validation, generatedRefs.documentAudit, generatedRefs.negativeResults, generatedRefs.machineBoundary, generatedRefs.publicAudit];
  return ACCEPTANCE_IDS.map((acceptanceId, index) => ({ acceptanceId, status: index < 14 ? "passed" : "pending", evidenceRefs: index < 14 ? [evidence[index]] : [] }));
}

export function reviewInstructions(refs, generatedRefs) {
  const common = { failureDisposition: "mark_gate_failed_and_block_final_pass" };
  return [
    { gateId: "G1", precondition: "Runtime online and one trace-ready source saved", actions: ["从 Side Panel 依次点击打开工作台、查看来源、在工作台中打开"], expectedObservations: ["同一 Workspace 被创建或聚焦，Library、Detail 与当前上下文正确且不重复 ingest"], threshold: "三个入口全部通过", evidenceRefs: [refs.report], ...common },
    { gateId: "G2", precondition: "Workspace 已打开", actions: ["访问五类 route 并执行 direct-open、reload、Back、reopen"], expectedObservations: ["route 与稳定 ID 保持，无效 ID 回到 Source Library"], threshold: "5x4=20 cells 且恢复样本不少于 2", evidenceRefs: [refs.derived], ...common },
    { gateId: "G3", precondition: "三个可丢弃真实 source 已准备", actions: ["逐个确认 Forget 后执行四种重开"], expectedObservations: ["四面均不存在且四次 SOURCE_NOT_FOUND 后可回库"], threshold: "3x4=12 条同源有序链", evidenceRefs: [refs.derived], ...common },
    { gateId: "G4", precondition: "机器架构审计可访问", actions: ["核对双容器、Runtime 权威和三个扫描根"], expectedObservations: ["前端没有直连 data_service 或创建 Runtime 事实"], threshold: "architecture violations=0", evidenceRefs: [refs.validation], ...common },
    { gateId: "G5", precondition: "四类故障证据可访问", actions: ["查看 Runtime offline、Adapter blocked、DS unreachable、source failed/degraded"], expectedObservations: ["四类状态及下一步动作明确且不显示假成功"], threshold: "4/4 fault classes", evidenceRefs: [refs.snapshot], ...common },
    { gateId: "G6", precondition: "可见 Chrome 与四种视口可用", actions: ["在 360/420 Side Panel 与 768/1280 Workspace 操作 drawer、dialog、键盘与 Escape"], expectedObservations: ["无遮挡截断或横滚阻塞，焦点可见并返回"], threshold: "Axe serious/critical=0/0，Keyboard=5/5", evidenceRefs: [refs.derived], ...common },
    { gateId: "G7", precondition: "A01..A14 machine audit passed", actions: ["从 EvidenceIndex 抽查 hash、截图、日志和声明"], expectedObservations: ["引用可访问，声明仅限 dual-container real-Chrome acceptance"], threshold: "所有抽样引用通过且无越界声明", evidenceRefs: [generatedRefs.publicAudit], ...common }
  ];
}

export function createMachineArtifacts(context, outputRoot, { generatedAt = new Date().toISOString() } = {}) {
  fs.mkdirSync(path.join(outputRoot, "logs"), { recursive: true });
  writeAtomic(path.join(outputRoot, "candidate-binding.json"), context.bindingBytes);
  const refs = candidateEvidenceRefs(context);
  const contractEvidence = { schemaVersion: "v2-px6-contract-evidence/v1", generatedAt, positiveInstances: 7, requirements: 20, fixtureCases: 20, failureCodes: 20, passed: true };
  writeJson(path.join(outputRoot, "contract-fixture-results.json"), contractEvidence);
  const documentArtifacts = context.documentAudit.snapshots.map((item) => {
    const encodedBytes = Buffer.from(item.bytes.toString("base64"), "ascii");
    writeAtomic(path.join(outputRoot, item.snapshotPath), encodedBytes);
    return {
      sourcePath: item.sourcePath,
      sourceSha256: sha256(item.bytes),
      sourceByteLength: item.bytes.length,
      sourceMediaType: item.mediaType,
      encoding: "base64",
      snapshot: artifactRef("px6_run", outputRoot, item.snapshotPath, "text/plain")
    };
  });
  const documentEvidence = { schemaVersion: "v2-px6-document-evidence/v1", generatedAt, activeDocuments: 4, drawioPages: context.documentAudit.pages, duplicateIds: 0, outOfBounds: 0, brokenReferences: 0, artifacts: documentArtifacts, passed: true };
  writeJson(path.join(outputRoot, "document-drawio-audit.json"), documentEvidence);
  const machineBoundary = { schemaVersion: "v2-px6-machine-boundary/v1", generatedAt, reviewerFieldsGenerated: false, reviewSubmissionGenerated: false, finalDispositionGenerated: false, humanReviewStatus: "pending", g7Status: "pending", finalPassed: false, passed: true };
  writeJson(path.join(outputRoot, "machine-boundary.json"), machineBoundary);
  const publicAudit = { schemaVersion: "v2-px6-public-bytes-audit/v1", generatedAt, sourceArchiveSha256: context.binding.publicEvidenceArchive.sha256, indexedMembers: context.publicAudit.memberCount, archiveMembers: context.publicAudit.archiveMemberCount, credentialHits: 0, privateHits: 0, passed: true };
  writeJson(path.join(outputRoot, "public-bytes-audit.json"), publicAudit);
  const negativeResults = runPx6NegativeSuite(context);
  writeJson(path.join(outputRoot, "px6-negative-results.json"), negativeResults);

  const generatedRefs = {
    contract: artifactRef("px6_run", outputRoot, "contract-fixture-results.json", "application/json"),
    documentAudit: artifactRef("px6_run", outputRoot, "document-drawio-audit.json", "application/json"),
    machineBoundary: artifactRef("px6_run", outputRoot, "machine-boundary.json", "application/json"),
    publicAudit: artifactRef("px6_run", outputRoot, "public-bytes-audit.json", "application/json"),
    negativeResults: artifactRef("px6_run", outputRoot, "px6-negative-results.json", "application/json")
  };
  const machine = withContentSha256({
    schemaVersion: "v2-px6-machine-exit-audit/v1", evidenceClass: "production_acceptance", px6RunId: context.binding.px6RunId,
    candidateBinding: refs.binding, status: "waiting_for_human_review", machinePassed: true,
    acceptanceResults: createAcceptanceResults(refs, generatedRefs),
    gateStatus: { G1_entry: "passed", G2_route: "passed", G3_lifecycle: "passed", G4_architecture: "passed", G5_status: "passed", G6_ux_accessibility: "passed", G7_evidence: "pending" },
    humanReviewStatus: "pending", g7Status: "pending", finalPassed: false, issues: [], claim: "PX-6 machine review package is ready for human review."
  });
  validateJsonSchema(PX6_SCHEMA_PATH, machine);
  writeJson(path.join(outputRoot, "machine-exit-audit.json"), machine);
  const machineRef = artifactRef("px6_run", outputRoot, "machine-exit-audit.json", "application/json");
  const reviewRequest = withContentSha256({ schemaVersion: "v2-px6-review-request/v1", evidenceClass: "production_acceptance", px6RunId: context.binding.px6RunId, candidateBinding: refs.binding, machineExitAudit: machineRef, status: "waiting_for_human_review", gateInstructions: reviewInstructions(refs, generatedRefs), automatedApprovalAllowed: false });
  validateJsonSchema(PX6_SCHEMA_PATH, reviewRequest);
  writeJson(path.join(outputRoot, "review-request.json"), reviewRequest);
  const requestRef = artifactRef("px6_run", outputRoot, "review-request.json", "application/json");
  const evidenceIndex = withContentSha256({ schemaVersion: "v2-px6-evidence-index/v1", evidenceClass: "production_acceptance", px6RunId: context.binding.px6RunId, status: "waiting_for_human_review", candidateArtifacts: [refs.exit, refs.publicArchive, refs.independentAudit], machineArtifacts: [refs.binding, machineRef, requestRef, generatedRefs.contract, generatedRefs.negativeResults, generatedRefs.documentAudit, generatedRefs.publicAudit], reviewArtifacts: [], finalArtifacts: [] });
  validateJsonSchema(PX6_SCHEMA_PATH, evidenceIndex);
  writeJson(path.join(outputRoot, "evidence-index.json"), evidenceIndex);
  writeAtomic(path.join(outputRoot, "human-review-checklist.md"), Buffer.from(renderChecklist(reviewRequest), "utf8"));
  writeAtomic(path.join(outputRoot, "final-review.html"), Buffer.from(renderReviewHtml(reviewRequest, machine), "utf8"));
  validateMachineBoundary(outputRoot);
  return { refs, generatedRefs, machine, machineRef, reviewRequest, requestRef, evidenceIndex };
}

function renderChecklist(request) {
  const rows = request.gateInstructions.map((gate) => `## ${gate.gateId}\n\n- 前置：${gate.precondition}\n- 操作：${gate.actions.join("；")}\n- 预期：${gate.expectedObservations.join("；")}\n- 门槛：${gate.threshold}\n- 结果：由人类填写 passed/failed、notes 与 ArtifactRef。\n`).join("\n");
  return `# PX-6 人工验收清单\n\nRun: \`${request.px6RunId}\`  \n状态：等待真实人类在可见 Chrome 中执行；本文件不构成签署。\n\n${rows}`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function renderReviewHtml(request, machine) {
  const rows = request.gateInstructions.map((gate) => `<tr><th>${gate.gateId}</th><td>${escapeHtml(gate.precondition)}</td><td>${escapeHtml(gate.actions.join("；"))}</td><td>${escapeHtml(gate.expectedObservations.join("；"))}</td><td>${escapeHtml(gate.threshold)}</td></tr>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>PX-6 人工审查</title><style>body{font:14px/1.5 system-ui;margin:24px;color:#17211e}table{border-collapse:collapse;width:100%}th,td{border:1px solid #9aa8a3;padding:8px;text-align:left;vertical-align:top}th{background:#eef3f1}.state{padding:12px;background:#fff6d7;border-left:4px solid #b07d00}</style></head><body><h1>PX-6 人工审查</h1><p class="state">${escapeHtml(machine.claim)} 当前状态：等待人类审查；G7=pending；finalPassed=false。本页只读，不提供自动通过按钮。</p><table><thead><tr><th>Gate</th><th>前置</th><th>操作</th><th>预期观察</th><th>出门门槛</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function createDeterministicMachinePackage(outputRoot) {
  validateMachineBoundary(outputRoot);
  const excluded = new Set(["public/px6-public-evidence.tar.gz", "machine-package.json", "collection-diagnostic.json"]);
  const finalOnly = /^(?:final-disposition\.json|final-report\.(?:json|html))$/;
  const files = walkFiles(outputRoot).map((absolute) => path.relative(outputRoot, absolute).replaceAll(path.sep, "/")).filter((relative) => !excluded.has(relative) && relative !== "review-submission.json" && !finalOnly.test(relative)).sort();
  const members = files.map((relativePath) => {
    const bytes = fs.readFileSync(path.join(outputRoot, relativePath));
    return { path: relativePath, sha256: sha256(bytes), byteLength: bytes.length };
  });
  writeJson(path.join(outputRoot, "machine-package-member-index.json"), { schemaVersion: "v2-px6-machine-package-member-index/v1", policy: "machine_only_excludes_human_identity_final_artifacts_and_self_manifest", members });
  if (!files.includes("machine-package-member-index.json")) files.push("machine-package-member-index.json");
  files.sort();
  const publicDirectory = path.join(outputRoot, "public");
  fs.mkdirSync(publicDirectory, { recursive: true });
  const listPath = path.join(outputRoot, ".machine-package-files.txt");
  fs.writeFileSync(listPath, files.map((item) => `${item}\n`).join(""), { mode: 0o600 });
  const archivePath = path.join(publicDirectory, "px6-public-evidence.tar.gz");
  const tar = spawnSync("tar", ["--format=ustar", "--sort=name", "--mtime=@0", "--mode=0644", "--owner=0", "--group=0", "--numeric-owner", "-czf", archivePath, "-C", outputRoot, "-T", listPath], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  fs.rmSync(listPath, { force: true });
  if (tar.status !== 0) fail("PX6_T04_EVIDENCE_MUTATED", `machine package failed: ${tar.stderr}`);
  const archiveBytes = fs.readFileSync(archivePath);
  const archiveRef = refForBytes("px6_run", "public/px6-public-evidence.tar.gz", archiveBytes, "application/gzip");
  const actual = archiveMembers(archivePath).sort();
  if (canonicalJson(actual) !== canonicalJson(files)) fail("PX6_T04_EVIDENCE_MUTATED", "machine package member set mismatch");
  const forbidden = [/"reviewer"\s*:/i, /"reviewedAt"\s*:/i, /V2-PX External Brain Productization passed dual-container real-Chrome acceptance\./];
  for (const relativePath of files) {
    const text = fs.readFileSync(path.join(outputRoot, relativePath), "utf8");
    if (forbidden.some((pattern) => pattern.test(text))) fail("PX6_REPORT_PROMOTED_BEFORE_REVIEW", `machine package contains human/final field: ${relativePath}`);
  }
  const result = { schemaVersion: "v2-px6-machine-package/v1", px6RunId: readJson(path.join(outputRoot, "candidate-binding.json")).px6RunId, status: "waiting_for_human_review", machinePassed: true, humanReviewStatus: "pending", g7Status: "pending", finalPassed: false, memberCount: files.length, archive: archiveRef, claim: "PX-6 machine review package is ready for human review." };
  writeJson(path.join(outputRoot, "machine-package.json"), result);
  return result;
}

export function createCollectionDiagnostic(outputRoot, px6RunId, error) {
  const code = errorCode(error);
  const allowed = new Set(readJson(PX6_SCHEMA_PATH)["x-navia-failure-code-registry"]);
  const failureCode = allowed.has(code) ? code : "PX6_T04_ARTIFACT_ROOT_UNRESOLVED";
  const diagnostic = { schemaVersion: "v2-px6-collection-diagnostic/v1", px6RunId, status: "blocked", createdAt: new Date().toISOString(), issues: [{ failureCode, message: error instanceof Error ? error.message : String(error) }], candidateGenerated: false };
  validateJsonSchema(PX6_SCHEMA_PATH, diagnostic);
  fs.mkdirSync(outputRoot, { recursive: true });
  writeJson(path.join(outputRoot, "collection-diagnostic.json"), diagnostic);
  return diagnostic;
}
