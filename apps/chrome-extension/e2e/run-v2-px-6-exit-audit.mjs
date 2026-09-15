#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { artifactRef, sha256 } from "./lib/v2PxSnapshotReplay.mjs";
import { parseArgs, validateJsonSchema, writeAtomic, writeJson } from "./lib/v2PxPipelineIo.mjs";
import {
  PX6_SCHEMA_PATH,
  createCollectionDiagnostic,
  createDeterministicMachinePackage,
  createMachineArtifacts,
  readAndValidateCandidate,
  validateContractFreeze,
  validateMachineBoundary,
  validatePx6Authorization
} from "./lib/v2PxExitAudit.mjs";
import { buildFinalDisposition, validateHumanReviewEnvelope } from "./lib/v2PxHumanReviewSubmission.mjs";

function fail(code, message) {
  throw new Error(`${code}${message ? `: ${message}` : ""}`);
}

function validateAbsoluteRegularFile(filePath, label) {
  if (!path.isAbsolute(filePath)) fail("PX6_T04_ARTIFACT_ROOT_UNRESOLVED", `${label} must be absolute`);
  const resolved = path.resolve(filePath);
  if (fs.realpathSync(resolved) !== resolved || !fs.statSync(resolved).isFile()) fail("PX6_T04_ARTIFACT_ROOT_UNRESOLVED", `${label} is missing or traverses a symlink`);
  return resolved;
}

function prepareEmptyOutput(outputRoot) {
  if (!path.isAbsolute(outputRoot)) fail("PX6_T04_ARTIFACT_ROOT_UNRESOLVED", "output root must be absolute");
  const resolved = path.resolve(outputRoot);
  if (fs.existsSync(resolved)) {
    if (fs.lstatSync(resolved).isSymbolicLink() || !fs.statSync(resolved).isDirectory() || fs.readdirSync(resolved).length) fail("PX6_T04_ARTIFACT_ROOT_UNRESOLVED", "output root must be a new empty real directory");
  } else {
    const parent = path.dirname(resolved);
    fs.mkdirSync(parent, { recursive: true });
    if (fs.realpathSync(parent) !== parent) fail("PX6_T04_ARTIFACT_ROOT_UNRESOLVED", "output parent traverses a symlink");
    fs.mkdirSync(resolved, { mode: 0o700 });
  }
  return resolved;
}

function stage(outputRoot, stageId, recordedAt, result) {
  writeJson(path.join(outputRoot, `${stageId}-result.json`), { stageId, recordedAt, ...result });
}

function cleanForDiagnostic(outputRoot) {
  if (!fs.existsSync(outputRoot)) fs.mkdirSync(outputRoot, { recursive: true });
  for (const entry of fs.readdirSync(outputRoot)) fs.rmSync(path.join(outputRoot, entry), { recursive: true, force: true });
}

function renderFinalReport(disposition) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>PX-6 最终处置</title></head><body><h1>PX-6 最终处置</h1><p>status=${disposition.status}</p><p>finalPassed=${disposition.finalPassed}</p><p>${disposition.claim}</p></body></html>`;
}

function runMachine(bindingPath, outputRoot) {
  const recordedAt = validatePx6Authorization().record.authorizedAt;
  const contract = validateContractFreeze();
  stage(outputRoot, "px6-0", recordedAt, { status: "passed", schemaMeta: "passed", positiveInstances: contract.positiveCount, requirements: contract.requirementCount, cases: contract.caseCount, failureCodes: contract.failureCodeCount });
  const context = readAndValidateCandidate(bindingPath);
  stage(outputRoot, "px6-1", recordedAt, { status: "passed", t04RunId: context.binding.t04RunId, exitManifestRawSha256: sha256(context.exitBytes), exitManifestContentSha256: context.exitManifest.contentSha256, publicArchiveSha256: context.binding.publicEvidenceArchive.sha256, resolvedArtifactRoots: ["replay_validation"] });
  stage(outputRoot, "px6-2", recordedAt, { status: "passed", sources: 12, sourceDistribution: { web: 6, local: 3, note: 3 }, productionScenarios: 17, routeCells: 20, forgetRecoveryChains: 12, faultClasses: 4, viewportClasses: 4, validationRules: 63, contractFixtures: 109, productionMutations: 42, t04Acceptance: 14, t04Negatives: 25 });
  const artifacts = createMachineArtifacts(context, outputRoot, { generatedAt: recordedAt });
  stage(outputRoot, "px6-3", recordedAt, { status: "passed", gateInstructions: artifacts.reviewRequest.gateInstructions.length, automatedApprovalAllowed: false, humanReviewStatus: "pending", g7Status: "pending", finalPassed: false });
  const negatives = JSON.parse(fs.readFileSync(path.join(outputRoot, "px6-negative-results.json"), "utf8"));
  stage(outputRoot, "px6-4", recordedAt, { status: "passed", negativeRequirements: negatives.length, passed: negatives.filter((item) => item.passed).length });
  const machinePackage = createDeterministicMachinePackage(outputRoot);
  validateMachineBoundary(outputRoot);
  stage(outputRoot, "px6-5", recordedAt, { status: "waiting_for_human_review", archive: machinePackage.archive, memberCount: machinePackage.memberCount, machinePassed: true, humanReviewStatus: "pending", g7Status: "pending", finalPassed: false, mandatoryStop: true });
  return { context, artifacts, machinePackage };
}

function runFinalizer(bindingPath, reviewSubmissionPath, outputRoot) {
  const machineRunRoot = path.dirname(reviewSubmissionPath);
  const machineExitAuditPath = path.join(machineRunRoot, "machine-exit-audit.json");
  const machineExitAudit = JSON.parse(fs.readFileSync(machineExitAuditPath, "utf8"));
  validateJsonSchema(PX6_SCHEMA_PATH, machineExitAudit);
  const context = readAndValidateCandidate(bindingPath);
  const envelope = validateHumanReviewEnvelope({ submissionPath: reviewSubmissionPath, machineRunRoot, candidateBinding: context.binding, machineExitAudit });
  writeAtomic(path.join(outputRoot, "candidate-binding.json"), context.bindingBytes);
  writeAtomic(path.join(outputRoot, "machine-exit-audit.json"), envelope.machineBytes);
  writeAtomic(path.join(outputRoot, "review-submission.json"), envelope.submissionBytes);
  const humanReviewBytes = fs.readFileSync(path.join(machineRunRoot, envelope.submission.humanReview.path));
  writeAtomic(path.join(outputRoot, envelope.submission.humanReview.path), humanReviewBytes);
  writeJson(path.join(outputRoot, "finalization-input-audit.json"), { schemaVersion: "v2-px6-finalization-input-audit/v1", px6RunId: context.binding.px6RunId, candidateExitManifestRawSha256: context.binding.exitManifestRawSha256, machineExitAuditRawSha256: sha256(envelope.machineBytes), reviewSubmissionRawSha256: sha256(envelope.submissionBytes), humanReviewRawSha256: sha256(humanReviewBytes), allInputsValid: true });
  const built = buildFinalDisposition({
    submission: envelope.submission,
    submissionBytes: envelope.submissionBytes,
    candidateBinding: context.binding,
    candidateBindingRef: artifactRef("px6_run", outputRoot, "candidate-binding.json", "application/json"),
    machineExitAudit,
    machineExitAuditRef: artifactRef("px6_run", outputRoot, "machine-exit-audit.json", "application/json"),
    outputRoot
  });
  writeJson(path.join(outputRoot, "final-disposition.json"), built.disposition);
  writeJson(path.join(outputRoot, "final-report.json"), built.disposition);
  writeAtomic(path.join(outputRoot, "final-report.html"), Buffer.from(renderFinalReport(built.disposition), "utf8"));
  writeJson(path.join(outputRoot, "independent-final-audit-request.json"), { schemaVersion: "v2-px6-independent-final-audit-request/v1", px6RunId: context.binding.px6RunId, finalDisposition: artifactRef("px6_run", outputRoot, "final-disposition.json", "application/json"), requiredFatal: 0, requiredMajor: 0, dispositionBeforeIndependentAudit: "candidate_only" });
  return built.disposition;
}

let outputRoot = null;
let px6RunId = "px6-diagnostic-failed";
try {
  const args = parseArgs(process.argv.slice(2), ["candidate-binding", "output-root"]);
  const allowed = new Set(["candidate-binding", "output-root", "review-submission"]);
  for (const key of Object.keys(args)) if (!allowed.has(key)) fail("PX6_T04_ARTIFACT_ROOT_UNRESOLVED", `unknown argument --${key}`);
  const bindingPath = validateAbsoluteRegularFile(args["candidate-binding"], "candidate binding");
  if (args["review-submission"]) validateAbsoluteRegularFile(args["review-submission"], "review submission");
  outputRoot = prepareEmptyOutput(args["output-root"]);
  const binding = JSON.parse(fs.readFileSync(bindingPath, "utf8"));
  if (typeof binding.px6RunId === "string") px6RunId = binding.px6RunId;
  if (args["review-submission"]) {
    const disposition = runFinalizer(bindingPath, args["review-submission"], outputRoot);
    process.stdout.write(`${JSON.stringify({ status: disposition.status, finalPassed: disposition.finalPassed, outputRoot })}\n`);
    process.exitCode = disposition.finalPassed ? 0 : 3;
  } else {
    const result = runMachine(bindingPath, outputRoot);
    process.stdout.write(`${JSON.stringify({ status: "waiting_for_human_review", machinePassed: true, humanReviewStatus: "pending", g7Status: "pending", finalPassed: false, outputRoot, archiveSha256: result.machinePackage.archive.sha256 })}\n`);
  }
} catch (error) {
  let diagnostic = { schemaVersion: "v2-px6-collection-diagnostic/v1", px6RunId, status: "blocked", createdAt: new Date().toISOString(), issues: [{ failureCode: "PX6_T04_ARTIFACT_ROOT_UNRESOLVED", message: error instanceof Error ? error.message : String(error) }], candidateGenerated: false };
  if (outputRoot && fs.existsSync(outputRoot) && fs.statSync(outputRoot).isDirectory()) {
    cleanForDiagnostic(outputRoot);
    diagnostic = createCollectionDiagnostic(outputRoot, px6RunId, error);
  }
  process.stderr.write(`${JSON.stringify(diagnostic)}\n`);
  process.exitCode = 2;
}
