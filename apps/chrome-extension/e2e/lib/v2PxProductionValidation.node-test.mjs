import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { deriveFacts } from "./v2PxDerivedFacts.mjs";
import { buildArchitectureSnapshot, deriveProductionGateResults, HUMAN_RULES, loadFrozenArchitecturePolicy, PRODUCTION_GATE_RULES, validateProductionCandidate } from "./v2PxProductionValidation.mjs";
import { runProductionMutationSuite } from "./v2PxProductionMutations.mjs";
import { jsonSchemaBatchErrors } from "./v2PxPipelineIo.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const base = path.join(repoRoot, "docs/active/project/evidence/v2_external_brain_productization/px-5");
const runRoot = path.join(base, "t02.5-t01-structured-regression-recollection/runs/t02-r2-t01-structured-production-input-20260914T125700");
const oldT02_4RunRoot = path.join(base, "t02.4-runtime-offline-boundary-recollection/runs/t02-r2-runtime-offline-boundary-production-input-20260914T095030");
const oldBoundaryRunRoot = path.join(base, "t02.3-status-contract-recollection/runs/t02-r2-status-contract-production-input-20260914T001017");
const oldStatusRunRoot = path.join(base, "t02.2-durable-forget-recovery/runs/t02-r2-durable-forget-production-input-20260912T165535");
const contracts = path.join(repoRoot, "docs/active/project/contracts");
const ref = (name) => ({ artifactRoot: "validation_run", path: name, sha256: "a".repeat(64), byteLength: 1, mediaType: "application/json" });
const implementation = { ...ref("input/v2PxDerivedFacts.mjs"), mediaType: "text/javascript" };

function statusErrors(derived) {
  const statuses = derived.scenarioFacts.flatMap((scenario) => scenario.facts.statusObservations.map((observation) => observation.value));
  return jsonSchemaBatchErrors(path.join(contracts, "v2_knowledge_status.schema.json"), statuses);
}

function buildCandidate(root, validationRunId, expectedGaps = []) {
  const { raw, facts: derived, gaps } = deriveFacts({ runRoot: root, generatorImplementation: implementation });
  assert.deepEqual(gaps.map((gap) => gap.requirementId), expectedGaps);
  const policy = loadFrozenArchitecturePolicy(repoRoot);
  const architecture = buildArchitectureSnapshot({ repoRoot, commit: raw.snapshotCommit, ...policy });
  assert.equal(architecture.manifest.symlinkPolicy, "hash_link_target_utf8");
  assert.ok(architecture.manifest.trackedPaths.every((item) => item.inlineSource === undefined));
  assert.ok(architecture.scanManifest.trackedPaths.every((item) => item.inlineSource?.sha256 === item.blobSha256));
  assert.deepEqual(jsonSchemaBatchErrors(path.join(contracts, "v2_external_brain_architecture_scan_manifest.schema.json"), [architecture.manifest]), []);
  assert.equal(architecture.scan.scopeValid, true);
  assert.equal(architecture.scan.violations, 0);
  const mutationRegistry = JSON.parse(fs.readFileSync(path.join(contracts, "v2_px_production_mutation_registry.json"), "utf8"));
  const contractRegression = { passed: true, summary: { suiteId: "v2-px-contract-fixtures/v4", total: 109, passed: 109, failed: 0, resultArtifact: ref("contract-regression.json") } };
  const mutationResults = runProductionMutationSuite({ registry: mutationRegistry, raw, derived, architecture, contractRegression });
  assert.equal(mutationResults.total, 42);
  assert.equal(mutationResults.passed, 42);
  assert.equal(mutationResults.failed, 0, JSON.stringify(mutationResults.results.filter((item) => !item.passed), null, 2));
  assert.ok(mutationResults.results.every((item) => item.reportBooleanMutated === false && item.beforeSha256 !== item.afterSha256));
  const productionMutations = { passed: true, summary: { suiteId: mutationResults.suiteId, total: 42, passed: 42, failed: 0, resultArtifact: ref("production-mutation-results.json") } };
  const validationSchema = JSON.parse(fs.readFileSync(path.join(contracts, "v2_external_brain_validation_contracts.schema.json"), "utf8"));
  const inputs = Object.fromEntries(["raw", "derived", "validator", "semanticSpec", "registry", "fixtureSuite"].map((key) => [key, ref(`input/${key}.json`)]));
  const errors = statusErrors(derived);
  const validation = validateProductionCandidate({ runRoot: root, raw, derived, validationSchema, architecture, contractRegression, productionMutations, inputs, validationRunId, validatedAt: raw.seal.sealedAt, statusContractsPassed: errors.length === 0 });
  return { validation, errors };
}

test("production validator runs 63 rules and 42 mutations on the T02.5 positive input", () => {
  const { validation, errors } = buildCandidate(runRoot, "t03-test-positive");
  assert.equal(errors.length, 0);
  assert.equal(validation.ruleResults.length, 63);
  assert.equal(validation.ruleResults.filter((item) => item.status === "passed").length, 61);
  assert.deepEqual(validation.ruleResults.filter((item) => item.status === "failed").map((item) => item.ruleId), []);
  assert.deepEqual(validation.ruleResults.filter((item) => item.status === "pending").map((item) => item.ruleId), ["PX_RULE_FINAL_GATE_OR_HUMAN_REVIEW_FAILED", "PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID"]);
  assert.equal(validation.ruleResults.filter((item) => item.status === "not_applicable").length, 0);
  assert.equal(validation.machinePassed, true);
  assert.deepEqual(validation.gateResults, { G1: "passed", G2: "passed", G3: "passed", G4: "passed", G5: "passed", G6: "passed", G7: "pending" });
  assert.equal(validation.finalPassed, false);
});

test("the same production validator rejects T02.4 without sealed T01 assertions", () => {
  const { validation, errors } = buildCandidate(oldT02_4RunRoot, "t03-test-old-t02-4", ["T03-IN-11"]);
  assert.equal(errors.length, 0);
  assert.deepEqual(validation.ruleResults.filter((item) => item.status === "failed").map((item) => item.ruleId), ["PX_RULE_V2_REGRESSION_FAILED"]);
  assert.equal(validation.machinePassed, false);
  assert.equal(validation.gateResults.G7, "failed");
  assert.equal(validation.finalPassed, false);
});

test("the gate mapping covers every production RuleId exactly once and fails the owning gate", () => {
  const validationSchema = JSON.parse(fs.readFileSync(path.join(contracts, "v2_external_brain_validation_contracts.schema.json"), "utf8"));
  const registry = validationSchema["x-navia-rule-registry"];
  const mapped = Object.values(PRODUCTION_GATE_RULES).flat();
  assert.equal(mapped.length, 63);
  assert.equal(new Set(mapped).size, 63);
  assert.deepEqual([...mapped].sort(), registry.map((item) => item.ruleId).sort());
  const humanRules = new Set(HUMAN_RULES);
  const results = registry.map((item) => ({ ...item, status: item.ruleId === "PX_RULE_RUNTIME_OFFLINE_AUTHORITY_VIOLATION" ? "failed" : humanRules.has(item.ruleId) ? "pending" : "passed" }));
  assert.deepEqual(deriveProductionGateResults(results), { G1: "passed", G2: "passed", G3: "passed", G4: "passed", G5: "failed", G6: "passed", G7: "pending" });
});

test("the same production validator rejects the old T02.3 offline authority boundary", () => {
  const { validation, errors } = buildCandidate(oldBoundaryRunRoot, "t03-test-old-offline-boundary", ["T03-IN-11"]);
  assert.equal(errors.length, 0);
  assert.deepEqual(new Set(validation.ruleResults.filter((item) => item.status === "failed").map((item) => item.ruleId)), new Set(["PX_RULE_RUNTIME_OFFLINE_AUTHORITY_VIOLATION", "PX_RULE_V2_REGRESSION_FAILED"]));
  assert.equal(validation.machinePassed, false);
  assert.equal(validation.gateResults.G5, "failed");
  assert.equal(validation.gateResults.G7, "failed");
  assert.equal(validation.finalPassed, false);
});

test("the same production validator rejects the old T02.2 status contract without normalization", () => {
  const { validation, errors } = buildCandidate(oldStatusRunRoot, "t03-test-old-status", ["T03-IN-11"]);
  assert.equal(errors.length, 7);
  assert.ok(errors.every((error) => error.path === "userAction" && error.message.includes("'retry'")));
  assert.deepEqual(new Set(validation.ruleResults.filter((item) => item.status === "failed").map((item) => item.ruleId)), new Set(["PX_RULE_STATUS_COVERAGE_FAILED", "PX_RULE_V2_REGRESSION_FAILED"]));
  assert.equal(validation.machinePassed, false);
  assert.equal(validation.gateResults.G5, "failed");
  assert.equal(validation.gateResults.G7, "failed");
  assert.equal(validation.finalPassed, false);
});
