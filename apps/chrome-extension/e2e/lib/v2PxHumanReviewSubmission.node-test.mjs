import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PX6_FIXTURE_PATH, PX6_SCHEMA_PATH, validateFinalState, validateReviewSubmissionSemantics } from "./v2PxExitAudit.mjs";
import { buildFinalDisposition } from "./v2PxHumanReviewSubmission.mjs";
import { validateJsonSchema, writeJson } from "./v2PxPipelineIo.mjs";

const fixture = JSON.parse(fs.readFileSync(PX6_FIXTURE_PATH, "utf8"));
const positives = Object.fromEntries(fixture.positiveInstances.map((entry) => [entry.positiveId, entry.instance]));
const submission = positives["PX6-P-005-review-submission"];

test("automation provenance cannot sign a review", () => {
  assert.throws(() => validateReviewSubmissionSemantics(submission, { automationProvenance: true }), /PX6_AUTOMATED_REVIEWER_FORBIDDEN/);
});

test("review authorization hashes the exact UTF-8 text", () => {
  const changed = structuredClone(submission);
  changed.reviewAuthorization.authorizationText += " changed";
  assert.throws(() => validateReviewSubmissionSemantics(changed), /PX6_HUMAN_AUTHORIZATION_INVALID/);
});

test("passed review requires seven passed gates", () => {
  const changed = structuredClone(submission);
  changed.gateReviews[0].status = "failed";
  assert.throws(() => validateReviewSubmissionSemantics(changed), /PX6_HUMAN_GATE_INCOMPLETE/);
});

test("failed review requires a blocking issue", () => {
  const changed = structuredClone(submission);
  changed.status = "failed";
  changed.gateReviews[0].status = "failed";
  changed.blockingIssues = [];
  assert.throws(() => validateReviewSubmissionSemantics(changed), /PX6_HUMAN_FAILURE_WITHOUT_BLOCKER/);
});

test("G7 and final state cannot diverge from human review", () => {
  assert.throws(() => validateFinalState({ submission, finalPassed: true, g7Status: "pending", claim: "PX-6 contract fixture passed; not product acceptance evidence." }), /PX6_G7_FINAL_STATE_INVALID/);
});

test("contract fixture finalizer preserves the fixture-only claim", () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "navia-px6-finalizer-test-"));
  try {
    writeJson(path.join(outputRoot, "finalization-input-audit.json"), { passed: true });
    const built = buildFinalDisposition({
      submission,
      submissionBytes: Buffer.from(JSON.stringify(submission)),
      candidateBinding: positives["PX6-P-001-candidate-binding"],
      candidateBindingRef: positives["PX6-P-006-final-disposition"].candidateBinding,
      machineExitAudit: positives["PX6-P-002-machine-exit-audit"],
      machineExitAuditRef: positives["PX6-P-006-final-disposition"].machineExitAudit,
      outputRoot
    });
    validateJsonSchema(PX6_SCHEMA_PATH, built.disposition);
    assert.equal(built.disposition.finalPassed, true);
    assert.equal(built.disposition.claim, "PX-6 contract fixture passed; not product acceptance evidence.");
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("production finalizer fails closed before a separately bound final audit", () => {
  const production = structuredClone(submission);
  production.evidenceClass = "production_acceptance";
  production.signedClaim = "V2-PX External Brain Productization passed dual-container real-Chrome acceptance.";
  assert.throws(() => buildFinalDisposition({
    submission: production,
    submissionBytes: Buffer.from(JSON.stringify(production)),
    candidateBinding: positives["PX6-P-001-candidate-binding"],
    candidateBindingRef: positives["PX6-P-006-final-disposition"].candidateBinding,
    machineExitAudit: positives["PX6-P-002-machine-exit-audit"],
    machineExitAuditRef: positives["PX6-P-006-final-disposition"].machineExitAudit,
    outputRoot: os.tmpdir()
  }), /PX6_CLAIM_OR_FINAL_AUDIT_OVERREACH/);
});
