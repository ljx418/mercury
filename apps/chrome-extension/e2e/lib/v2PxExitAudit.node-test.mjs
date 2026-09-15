import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  PX6_SCHEMA_PATH,
  REPOSITORY_ROOT,
  createDeterministicMachinePackage,
  createMachineArtifacts,
  readAndValidateCandidate,
  runPx6NegativeSuite,
  validateActiveDocuments,
  validateContentSha256,
  validateContractFreeze,
  validateLegacyInvocation,
  validateMachineBoundary,
  withContentSha256
} from "./v2PxExitAudit.mjs";
import { validateJsonSchema } from "./v2PxPipelineIo.mjs";

const bindingPath = path.join(REPOSITORY_ROOT, "docs/active/project/evidence/v2_external_brain_productization/px-6/implementation/candidate-binding-px6-machine-exit-20260914t164500z.json");
let realContext;

test("PX6-0 contract freeze has seven positives and twenty exact cases", () => {
  const result = validateContractFreeze();
  assert.deepEqual([result.positiveCount, result.requirementCount, result.caseCount, result.failureCodeCount], [7, 20, 20, 20]);
});

test("content hash uses canonical JSON without its own field", () => {
  const document = withContentSha256({ schemaVersion: "fixture", nested: { b: 2, a: 1 } });
  assert.equal(validateContentSha256(document), true);
  assert.throws(() => validateContentSha256({ ...document, nested: { a: 9 } }), /PX6_T04_EXIT_MANIFEST_CONTENT_MISMATCH/);
});

test("active documents and Draw.io are structurally aligned", () => {
  const audit = validateActiveDocuments();
  assert.equal(audit.pages, 8);
  assert.equal(audit.snapshots.length, 5);
  assert.equal(audit.snapshots.every((item) => item.sourcePath.startsWith("docs/active/project/") && item.snapshotPath.startsWith("document-snapshot/") && item.bytes.length > 0), true);
});

test("legacy PX-6 runner is rejected", () => {
  assert.throws(() => validateLegacyInvocation(["node", "e2e/audit-v2-external-brain-exit.mjs"]), /PX6_LEGACY_PIPELINE_FORBIDDEN/);
});

test("PX6-1 and PX6-2 independently revalidate the real T04.1 candidate", { timeout: 120_000 }, () => {
  realContext = readAndValidateCandidate(bindingPath);
  assert.equal(realContext.binding.t04RunId, "t04-r4-resolved-invocation-20260914t145648z");
  assert.equal(realContext.recomputed.gaps.length, 0);
  assert.equal(realContext.publicAudit.memberCount, 1358);
  assert.equal(realContext.validation.ruleResults.length, 63);
});

test("PX6-4 executes all twenty registered mutations against real candidate facts", { timeout: 120_000 }, () => {
  realContext ??= readAndValidateCandidate(bindingPath);
  const results = runPx6NegativeSuite(realContext);
  assert.equal(results.length, 20);
  assert.equal(results.filter((item) => item.passed).length, 20);
  assert.equal(new Set(results.map((item) => item.observedPrimaryFailure)).size, 20);
});

test("PX6-3 and PX6-5 create a schema-valid machine-only package", { timeout: 120_000 }, () => {
  realContext ??= readAndValidateCandidate(bindingPath);
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "navia-px6-test-"));
  try {
    const result = createMachineArtifacts(realContext, outputRoot, { generatedAt: "2026-09-14T16:00:00.000Z" });
    validateJsonSchema(PX6_SCHEMA_PATH, result.machine);
    validateJsonSchema(PX6_SCHEMA_PATH, result.reviewRequest);
    validateJsonSchema(PX6_SCHEMA_PATH, result.evidenceIndex);
    const machinePackage = createDeterministicMachinePackage(outputRoot);
    assert.equal(machinePackage.machinePassed, true);
    assert.equal(machinePackage.finalPassed, false);
    assert.equal(validateMachineBoundary(outputRoot), true);
    const documentAudit = JSON.parse(fs.readFileSync(path.join(outputRoot, "document-drawio-audit.json"), "utf8"));
    assert.equal(documentAudit.artifacts.length, 5);
    for (const item of documentAudit.artifacts) {
      assert.equal(item.snapshot.artifactRoot, "px6_run");
      const encoded = fs.readFileSync(path.join(outputRoot, item.snapshot.path));
      assert.equal(item.encoding, "base64");
      assert.equal(Buffer.from(encoded.toString("ascii"), "base64").length, item.sourceByteLength);
      assert.equal(fs.existsSync(path.join(outputRoot, item.snapshot.path)), true);
    }
    for (const forbidden of ["review-submission.json", "final-disposition.json", "final-report.json"]) assert.equal(fs.existsSync(path.join(outputRoot, forbidden)), false);
    const html = fs.readFileSync(path.join(outputRoot, "final-review.html"), "utf8");
    assert.match(html, /只读/);
    assert.doesNotMatch(html, /<button/i);
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("CLI rejects a relative binding with exit code 2", () => {
  const outputRoot = path.join(os.tmpdir(), `navia-px6-cli-relative-${process.pid}`);
  const result = spawnSync(process.execPath, [path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/run-v2-px-6-exit-audit.mjs"), "--candidate-binding", "relative.json", "--output-root", outputRoot], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /PX6_T04_ARTIFACT_ROOT_UNRESOLVED/);
});

test("CLI never clears a non-empty output root", () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "navia-px6-cli-nonempty-"));
  try {
    fs.writeFileSync(path.join(outputRoot, "sentinel.txt"), "keep");
    const result = spawnSync(process.execPath, [path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/run-v2-px-6-exit-audit.mjs"), "--candidate-binding", bindingPath, "--output-root", outputRoot], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.equal(fs.readFileSync(path.join(outputRoot, "sentinel.txt"), "utf8"), "keep");
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
});
