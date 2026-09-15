import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildProductionReport, createPendingHumanReview } from "./v2PxProductionReport.mjs";
import { refForBytes, validateJsonSchema } from "./v2PxPipelineIo.mjs";
import { sha256 } from "./v2PxArtifactReader.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const validationRunId = "t03-r3-production-candidate-20260914T131056";
const outputRoot = path.join(repoRoot, "docs/active/project/evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/runs", validationRunId);
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(outputRoot, name), "utf8"));
const ref = (name, mediaType = "application/json") => refForBytes("validation_run", name, fs.readFileSync(path.join(outputRoot, name)), mediaType);

test("renders a schema-valid pending report from real command and scenario artifacts", () => {
  const derived = readJson("derived-facts.json");
  const validation = readJson("production-validation.json");
  const humanReview = createPendingHumanReview();
  const references = {
    derived: ref("derived-facts.json"),
    productionValidation: ref("production-validation.json"),
    humanReview: { artifactRoot: "validation_run", path: "human-review.pending.json", sha256: "a".repeat(64), byteLength: 1, mediaType: "application/json" },
    auditArtifacts: Object.fromEntries([
      ["acceptanceHtml", "acceptance-report.html", "text/html"],
      ["prdReview", "audits/prd-coverage-review.md", "text/markdown"],
      ["architectureReview", "audits/architecture-review.md", "text/markdown"],
      ["falseGreenAudit", "audits/false-green-audit.md", "text/markdown"],
      ["semanticValidatorLog", "logs/semantic-validator.log", "text/plain"]
    ].map(([key, name, mediaType]) => [key, { artifactRoot: "validation_run", path: name, sha256: "b".repeat(64), byteLength: 1, mediaType }]))
  };
  const report = buildProductionReport({ derived, validation, humanReview, references });
  validateJsonSchema(path.join(repoRoot, "docs/active/project/contracts/v2_external_brain_report.schema.json"), report);

  assert.equal(report.testCommands.length, 9);
  const byCommand = new Map(report.testCommands.map((item) => [item.command, item]));
  assert.equal(byCommand.get("axe-core:side-panel+workspace").result.resultType, "axe");
  assert.equal(byCommand.get("playwright:keyboard-accessibility").result.resultType, "keyboard");
  assert.deepEqual(byCommand.get("node e2e/chrome-v2-t01-r1-frontend.mjs").result, { resultType: "suite", assertionsTotal: 36, assertionsPassed: 36 });
  for (const command of report.testCommands) {
    assert.match(command.logArtifact.path, /^evidence\/source-run\/logs\/(?:prerequisites|structured)\//);
    const target = path.join(outputRoot, command.logArtifact.path);
    assert.equal(fs.existsSync(target), true, command.logArtifact.path);
    assert.equal(sha256(fs.readFileSync(target)), command.logArtifact.sha256, command.logArtifact.path);
  }
  assert.ok(report.scenarioResults.some((scenario) => scenario.coverageTags.includes("representative_source_context:not_same_scenario")));
  assert.equal(report.passed, false);
  assert.equal(report.gateResults.G7_evidence, false);
});
