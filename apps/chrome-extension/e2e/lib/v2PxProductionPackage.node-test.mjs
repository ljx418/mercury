import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildCandidatePackage, buildInvocationRecord } from "./v2PxProductionPackage.mjs";
import { refForBytes, validateJsonSchema } from "./v2PxPipelineIo.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const outputRoot = path.join(repoRoot, "docs/active/project/evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/runs/t03-r3-production-candidate-20260914T131056");
const sourceRoot = path.join(repoRoot, "docs/active/project/evidence/v2_external_brain_productization/px-5/t02.5-t01-structured-regression-recollection/runs/t02-r2-t01-structured-production-input-20260914T125700");
const readJson = (root, name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const ref = (rootName, root, name, mediaType = "application/json") => refForBytes(rootName, name, fs.readFileSync(path.join(root, name)), mediaType);

function inputs() {
  const derived = readJson(outputRoot, "derived-facts.json");
  const validation = readJson(outputRoot, "production-validation.json");
  const humanReviewDocument = readJson(outputRoot, "human-review.pending.json");
  const report = readJson(outputRoot, "report.json");
  return {
    sourceRawRun: ref("source_run", sourceRoot, "raw/raw-run.json"),
    derivedFacts: ref("validation_run", outputRoot, "derived-facts.json"),
    productionValidation: ref("validation_run", outputRoot, "production-validation.json"),
    contractRegression: ref("validation_run", outputRoot, "contract-regression.json"),
    humanReview: ref("validation_run", outputRoot, "human-review.pending.json"),
    renderedReport: ref("validation_run", outputRoot, "report.json"),
    acceptanceHtml: ref("validation_run", outputRoot, "acceptance-report.html", "text/html"),
    derived,
    validation,
    humanReviewDocument,
    report
  };
}

test("builds a schema-valid pending package without self reference", () => {
  const packageDocument = buildCandidatePackage(inputs());
  validateJsonSchema(path.join(repoRoot, "docs/active/project/contracts/v2_px_production_package.schema.json"), packageDocument);
  assert.equal(packageDocument.passed, false);
  assert.equal(packageDocument.humanReviewStatus, "pending");
  assert.equal(JSON.stringify(packageDocument).includes("production-package.json"), false);
  assert.throws(() => buildCandidatePackage({ ...inputs(), humanReviewDocument: { ...inputs().humanReviewDocument, status: "passed" } }), /pending production record/);
});

test("builds a schema-valid ordered invocation and rejects partial execution", () => {
  const artifact = { artifactRoot: "validation_run", path: "input/tool.mjs", sha256: "a".repeat(64), byteLength: 1, mediaType: "text/javascript" };
  const log = { artifactRoot: "validation_run", path: "logs/tool.log", sha256: "b".repeat(64), byteLength: 1, mediaType: "text/plain" };
  const steps = ["derive", "validate", "report", "package"].map((stepId) => ({ stepId, implementation: artifact, cwdRole: "extension_root", argv: ["node", `e2e/${stepId}.mjs`], exitCode: 0, signal: null, stdout: log, stderr: log }));
  const invocation = buildInvocationRecord({ validationRunId: "validation-1", sourceRunId: "source-1", recordedAt: "2026-09-14T00:00:00.000Z", steps, productionPackage: { ...artifact, path: "production-package.json", mediaType: "application/json" } });
  validateJsonSchema(path.join(repoRoot, "docs/active/project/contracts/v2_px_invocation_record.schema.json"), invocation);
  assert.throws(() => buildInvocationRecord({ validationRunId: "validation-1", sourceRunId: "source-1", recordedAt: "2026-09-14T00:00:00.000Z", steps: steps.slice(0, 3), productionPackage: invocation.productionPackage }), /exactly four/);
  assert.throws(() => buildInvocationRecord({ validationRunId: "validation-1", sourceRunId: "source-1", recordedAt: "2026-09-14T00:00:00.000Z", steps: steps.map((step, index) => index === 2 ? { ...step, exitCode: 1 } : step), productionPackage: invocation.productionPackage }), /failed or signaled/);
});
