import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const contractsRoot = path.join(repoRoot, "docs/active/project/contracts");
const schemaFiles = [
  "v2_px_derived_facts.schema.json",
  "v2_px_production_validation.schema.json",
  "v2_px_production_package.schema.json",
  "v2_px_invocation_record.schema.json",
  "v2_px_collection_diagnostic.schema.json"
];

const ref = (name = "artifact.json") => ({
  artifactRoot: "validation_run",
  path: `artifacts/${name}`,
  sha256: "a".repeat(64),
  byteLength: 1,
  mediaType: "application/json"
});

const provenance = Object.fromEntries([
  "domActionEventIds", "backgroundRequestEventIds", "backgroundResponseEventIds",
  "runtimeRequestEventIds", "runtimeTerminalEventIds", "routeObservationEventIds",
  "containerObservationEventIds", "screenshotEventIds", "commandResultEventIds", "faultEventIds"
].map((key) => [key, []]));

const examples = {
  "v2_px_derived_facts.schema.json": {
    schemaVersion: "v2-px-derived-facts/v1", evidenceClass: "production_acceptance", runId: "run",
    generatedAt: "2026-09-13T00:00:00Z", sealedRawRun: ref("raw.json"), generatorImplementation: ref("generator.mjs"),
    sourceMappings: Array.from({ length: 12 }, (_, index) => ({
      sourceSampleId: `sample_${index}`, sourceId: `source_${index}`, workspaceId: "ws_default",
      sourceType: index < 6 ? "web" : index < 9 ? "local" : "note",
      contentFingerprint: `sha256:${String(index).padStart(64, "0")}`,
      registrationArtifactRef: ref(`source-${index}.json`), importRequestEventId: `request_${index}`, importResponseEventId: `response_${index}`
    })),
    scenarioFacts: [{ scenarioId: "scenario", passed: true, provenance, facts: {} }], summary: { scenarioCount: 1 },
    seal: { inputMode: "canonical_json_without_seal_v1", contentSha256: "b".repeat(64) }
  },
  "v2_px_production_validation.schema.json": {
    schemaVersion: "v2-px-production-validation/v1", profile: "production_candidate", validationRunId: "validation", sourceRunId: "run", validatedAt: "2026-09-13T00:00:00Z",
    inputs: Object.fromEntries(["raw", "derived", "validator", "semanticSpec", "registry", "fixtureSuite"].map((key) => [key, ref(`${key}.json`)])),
    ruleResults: Array.from({ length: 63 }, (_, index) => ({ ruleId: `PX_RULE_TEST_${index}`, enforcementLayer: "semantic", status: "passed", failureCode: null, evidenceRefs: [], notes: "" })),
    gateResults: Object.fromEntries(["G1", "G2", "G3", "G4", "G5", "G6", "G7"].map((key) => [key, key === "G7" ? "pending" : "passed"])),
    contractRegression: { suiteId: "contract", total: 109, passed: 109, failed: 0, resultArtifact: ref("contract.json") },
    productionMutationResults: { suiteId: "mutation", total: 42, passed: 42, failed: 0, resultArtifact: ref("mutation.json") },
    machinePassed: true, humanReviewStatus: "pending", finalPassed: false, issues: []
  },
  "v2_px_production_package.schema.json": {
    schemaVersion: "v2-px-production-package/v1", evidenceClass: "production_acceptance", acceptanceProfile: "production_candidate", runId: "run", createdAt: "2026-09-13T00:00:00Z",
    sealedRawRun: ref("raw.json"), derivedFacts: ref("derived.json"), productionValidation: ref("validation.json"), contractRegression: ref("contract.json"), humanReview: ref("human.json"), renderedReport: ref("report.json"), acceptanceHtml: { ...ref("report.html"), mediaType: "text/html" },
    automatedCandidatePassed: true, humanReviewStatus: "pending", passed: false, claim: "R3 production candidate only; not final acceptance."
  },
  "v2_px_invocation_record.schema.json": {
    schemaVersion: "v2-px-invocation-record/v1", evidenceClass: "production_acceptance", profile: "production_candidate",
    validationRunId: "validation", sourceRunId: "run", recordedAt: "2026-09-13T00:00:00Z",
    steps: ["derive", "validate", "report", "package"].map((stepId) => ({
      stepId, implementation: { ...ref(`${stepId}.mjs`), mediaType: "text/javascript" }, cwdRole: "extension_root",
      argv: ["node", `input/${stepId}.mjs`], exitCode: 0, signal: null,
      stdout: { ...ref(`${stepId}.stdout.log`), mediaType: "text/plain" }, stderr: { ...ref(`${stepId}.stderr.log`), mediaType: "text/plain" }
    })),
    productionPackage: ref("production-package.json"), exitCode: 0, passed: true,
    claimBoundary: "T03 machine candidate only; not final acceptance."
  },
  "v2_px_collection_diagnostic.schema.json": {
    schemaVersion: "v2-px-collection-diagnostic/v1", runId: "run", sourceRawRun: ref("raw.json"), generatedAt: "2026-09-13T00:00:00Z", passed: false,
    missingObservations: [{ requirementId: "T03-IN-01", numerator: "view_source", denominator: "required", observed: 2, required: 3, eventKinds: ["dom_action"], scenarioIds: [] }],
    issues: ["missing observation"], generatorImplementation: ref("generator.mjs")
  }
};

function validateWithPython(schema, instance) {
  const program = [
    "import json,sys", "from jsonschema import Draft202012Validator", "p=json.load(sys.stdin)",
    "Draft202012Validator.check_schema(p['schema'])", "e=list(Draft202012Validator(p['schema']).iter_errors(p['instance']))",
    "print(json.dumps([x.message for x in e]))", "sys.exit(1 if e else 0)"
  ].join(";");
  return spawnSync("python3", ["-c", program], { input: JSON.stringify({ schema, instance }), encoding: "utf8" });
}

test("T03 schemas pass Draft 2020-12 meta-validation and positive root validation", () => {
  for (const file of schemaFiles) {
    const schema = JSON.parse(fs.readFileSync(path.join(contractsRoot, file), "utf8"));
    const result = validateWithPython(schema, examples[file]);
    assert.equal(result.status, 0, `${file}: ${result.stdout}${result.stderr}`);
  }
});

test("T03 schemas reject a root missing a required field", () => {
  for (const file of schemaFiles) {
    const schema = JSON.parse(fs.readFileSync(path.join(contractsRoot, file), "utf8"));
    const invalid = structuredClone(examples[file]);
    delete invalid[schema.required[0]];
    const result = validateWithPython(schema, invalid);
    assert.equal(result.status, 1, `${file} accepted a root without ${schema.required[0]}`);
  }
});

test("production mutation registry is exact and uses canonical RuleId/FailureCode mappings", () => {
  const registry = JSON.parse(fs.readFileSync(path.join(contractsRoot, "v2_px_production_mutation_registry.json"), "utf8"));
  const validation = JSON.parse(fs.readFileSync(path.join(contractsRoot, "v2_external_brain_validation_contracts.schema.json"), "utf8"));
  const mapping = new Map(validation["x-navia-rule-registry"].map((entry) => [entry.ruleId, entry.failureCode]));
  assert.equal(registry.expectedCount, 42);
  assert.equal(registry.mutations.length, 42);
  assert.equal(new Set(registry.mutations.map((item) => item.mutationId)).size, 42);
  assert.deepEqual(registry.mutations.map((item) => item.mutationId), Array.from({ length: 42 }, (_, index) => `T03-PM-${String(index + 1).padStart(3, "0")}`));
  for (const mutation of registry.mutations) {
    assert.ok(mutation.expectedRuleId.startsWith("PX_RULE_"));
    assert.equal(mapping.get(mutation.expectedRuleId), mutation.expectedPrimaryFailure);
    assert.deepEqual(mutation.allowedWarnings, []);
  }
});
