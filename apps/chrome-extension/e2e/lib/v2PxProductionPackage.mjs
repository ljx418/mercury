const CANDIDATE_CLAIM = "V2-PX External Brain Productization acceptance did not pass.";
const STEP_IDS = ["derive", "validate", "report", "package"];

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function buildCandidatePackage({ sourceRawRun, derivedFacts, productionValidation, contractRegression, humanReview, renderedReport, acceptanceHtml, derived, validation, humanReviewDocument, report }) {
  requireValue(validation.profile === "production_candidate" && validation.machinePassed === true && validation.finalPassed === false, "ProductionValidation is not a machine-passed candidate.");
  requireValue(validation.humanReviewStatus === "pending", "ProductionValidation Human Review must remain pending.");
  requireValue(derived.runId === validation.sourceRunId, "DerivedFacts and ProductionValidation source run mismatch.");
  requireValue(humanReviewDocument.evidenceClass === "production_acceptance" && humanReviewDocument.status === "pending", "Human Review must be a pending production record.");
  requireValue(report.evidenceClass === "production_acceptance" && report.passed === false && report.humanReview?.status === "pending", "Report must remain a pending production candidate.");
  requireValue(report.claim === CANDIDATE_CLAIM && humanReviewDocument.signedClaim === CANDIDATE_CLAIM, "Candidate claim boundary mismatch.");
  requireValue(report.humanReview.recordPath === humanReview.path && report.humanReview.recordSha256 === humanReview.sha256, "Report does not bind the supplied Human Review artifact.");
  requireValue(Object.entries(report.gateResults).every(([gate, passed]) => passed === (gate === "G7_evidence" ? false : true)), "Report gates are not G1-G6 true and G7 false.");
  return {
    schemaVersion: "v2-px-production-package/v1",
    evidenceClass: "production_acceptance",
    acceptanceProfile: "production_candidate",
    runId: validation.validationRunId,
    createdAt: validation.validatedAt,
    sealedRawRun: sourceRawRun,
    derivedFacts,
    productionValidation,
    contractRegression,
    humanReview,
    renderedReport,
    acceptanceHtml,
    automatedCandidatePassed: true,
    humanReviewStatus: "pending",
    passed: false,
    claim: CANDIDATE_CLAIM
  };
}

export function buildInvocationRecord({ validationRunId, sourceRunId, recordedAt, steps, productionPackage }) {
  requireValue(steps.length === STEP_IDS.length, "InvocationRecord requires exactly four steps.");
  requireValue(steps.every((step, index) => step.stepId === STEP_IDS[index]), "InvocationRecord step order must be derive, validate, report, package.");
  requireValue(steps.every((step) => step.exitCode === 0 && step.signal === null), "InvocationRecord cannot pass with a failed or signaled step.");
  return {
    schemaVersion: "v2-px-invocation-record/v1",
    evidenceClass: "production_acceptance",
    profile: "production_candidate",
    validationRunId,
    sourceRunId,
    recordedAt,
    steps,
    productionPackage,
    exitCode: 0,
    passed: true,
    claimBoundary: "T03 machine candidate only; Human Review, PX-5, PX-6 and V2 acceptance remain pending."
  };
}
