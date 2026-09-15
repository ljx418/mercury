import fs from "node:fs";
import path from "node:path";

import { validateJsonSchema } from "./v2PxPipelineIo.mjs";
import { artifactRef, sha256, validateArtifactRef } from "./v2PxSnapshotReplay.mjs";
import { PX6_SCHEMA_PATH, validateFinalState, validateReviewSubmissionSemantics, withContentSha256 } from "./v2PxExitAudit.mjs";

const HUMAN_REVIEW_SCHEMA = path.resolve(path.dirname(PX6_SCHEMA_PATH), "v2_external_brain_human_review.schema.json");
const GATE_KEYS = Object.freeze({ G1: "G1_entry", G2: "G2_route", G3: "G3_lifecycle", G4: "G4_architecture", G5: "G5_status", G6: "G6_ux_accessibility", G7: "G7_evidence" });

function fail(code, message) {
  throw new Error(`${code}${message ? `: ${message}` : ""}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function validateHumanReviewEnvelope({ submissionPath, machineRunRoot, candidateBinding, machineExitAudit }) {
  if (!path.isAbsolute(submissionPath)) fail("PX6_HUMAN_AUTHORIZATION_INVALID", "ReviewSubmission path must be absolute");
  const submissionBytes = fs.readFileSync(submissionPath);
  const submission = JSON.parse(submissionBytes);
  validateJsonSchema(PX6_SCHEMA_PATH, submission);
  validateReviewSubmissionSemantics(submission, {
    automationProvenance: false,
    allowedClaims: submission.evidenceClass === "production_acceptance"
      ? ["V2-PX External Brain Productization passed dual-container real-Chrome acceptance.", "V2-PX External Brain Productization acceptance did not pass."]
      : ["PX-6 contract fixture passed; not product acceptance evidence.", "V2-PX External Brain Productization acceptance did not pass."]
  });
  if (submission.px6RunId !== candidateBinding.px6RunId || submission.candidateExitManifestRawSha256 !== candidateBinding.exitManifestRawSha256) fail("PX6_CROSS_RUN_EVIDENCE_MIXED", "ReviewSubmission candidate binding mismatch");
  const machinePath = path.join(machineRunRoot, "machine-exit-audit.json");
  const machineBytes = fs.readFileSync(machinePath);
  if (sha256(machineBytes) !== submission.machineExitAuditRawSha256 || machineExitAudit.px6RunId !== submission.px6RunId || machineExitAudit.machinePassed !== true || machineExitAudit.finalPassed !== false) fail("PX6_CROSS_RUN_EVIDENCE_MIXED", "ReviewSubmission machine audit mismatch");
  let humanReview;
  try {
    validateArtifactRef(submission.humanReview, { px6_run: machineRunRoot });
    humanReview = readJson(path.join(machineRunRoot, submission.humanReview.path));
    validateJsonSchema(HUMAN_REVIEW_SCHEMA, humanReview);
  } catch (error) {
    fail("PX6_HUMAN_AUTHORIZATION_INVALID", `Human Review v3 is invalid: ${error.message}`);
  }
  if (humanReview.evidenceClass !== submission.evidenceClass || humanReview.status !== submission.status || humanReview.reviewer !== submission.reviewer
      || humanReview.reviewedAt !== submission.reviewedAt || humanReview.signedClaim !== submission.signedClaim
      || JSON.stringify(humanReview.blockingIssues) !== JSON.stringify(submission.blockingIssues)) {
    fail("PX6_HUMAN_AUTHORIZATION_INVALID", "outer submission and Human Review v3 fields differ");
  }
  for (const gate of submission.gateReviews) {
    const inner = humanReview.gateReviews[GATE_KEYS[gate.gateId]];
    if (!inner || inner.status !== gate.status || inner.notes !== gate.notes) fail("PX6_HUMAN_AUTHORIZATION_INVALID", `${gate.gateId} differs from Human Review v3`);
    if (inner.evidenceArtifacts.length !== gate.evidenceRefs.length || inner.evidenceArtifacts.some((ref, index) => ref.path !== gate.evidenceRefs[index].path || ref.sha256 !== gate.evidenceRefs[index].sha256)) {
      fail("PX6_HUMAN_AUTHORIZATION_INVALID", `${gate.gateId} evidence differs from Human Review v3`);
    }
  }
  return { submission, submissionBytes, humanReview, machineBytes };
}

export function buildFinalDisposition({ submission, submissionBytes, candidateBinding, candidateBindingRef, machineExitAudit, machineExitAuditRef, outputRoot, independentFinalAuditVerified = false }) {
  if (submission.evidenceClass === "production_acceptance" && independentFinalAuditVerified !== true) {
    fail("PX6_CLAIM_OR_FINAL_AUDIT_OVERREACH", "production FinalDisposition requires a separately bound independent final audit");
  }
  const passed = submission.status === "passed" && submission.gateReviews.every((gate) => gate.status === "passed") && submission.blockingIssues.length === 0;
  const g7 = passed ? "passed" : "failed";
  const claim = passed
    ? (submission.evidenceClass === "production_acceptance" ? "V2-PX External Brain Productization passed dual-container real-Chrome acceptance." : "PX-6 contract fixture passed; not product acceptance evidence.")
    : "V2-PX External Brain Productization acceptance did not pass.";
  validateFinalState({ submission, finalPassed: passed, g7Status: g7, claim });
  const reviewSubmissionRef = {
    artifactRoot: "px6_run", path: "review-submission.json", sha256: sha256(submissionBytes), byteLength: submissionBytes.length, mediaType: "application/json"
  };
  const evidenceByAcceptance = machineExitAudit.acceptanceResults.map((item) => ({ ...item, status: "passed", evidenceRefs: item.acceptanceId === "PX6-A15" ? [reviewSubmissionRef] : item.acceptanceId === "PX6-A16" ? [artifactRef("px6_run", outputRoot, "finalization-input-audit.json", "application/json")] : item.evidenceRefs }));
  const issues = passed ? [] : submission.blockingIssues.map((message) => ({ failureCode: "PX6_HUMAN_GATE_INCOMPLETE", message }));
  const disposition = withContentSha256({
    schemaVersion: "v2-px6-final-disposition/v1", evidenceClass: submission.evidenceClass, px6RunId: submission.px6RunId,
    candidateBinding: candidateBindingRef, machineExitAudit: machineExitAuditRef, reviewSubmission: reviewSubmissionRef,
    status: passed ? "passed" : "failed", acceptanceResults: evidenceByAcceptance,
    gateStatus: { G1_entry: submission.gateReviews.find((item) => item.gateId === "G1").status, G2_route: submission.gateReviews.find((item) => item.gateId === "G2").status, G3_lifecycle: submission.gateReviews.find((item) => item.gateId === "G3").status, G4_architecture: submission.gateReviews.find((item) => item.gateId === "G4").status, G5_status: submission.gateReviews.find((item) => item.gateId === "G5").status, G6_ux_accessibility: submission.gateReviews.find((item) => item.gateId === "G6").status, G7_evidence: g7 },
    humanReviewStatus: submission.status, g7Status: g7, finalPassed: passed, fatal: 0, major: passed ? 0 : Math.max(1, submission.blockingIssues.length), issues, claim
  });
  validateJsonSchema(PX6_SCHEMA_PATH, disposition);
  return { disposition, reviewSubmissionRef };
}
