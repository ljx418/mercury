import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runContractFixtureSuite, repoRoot } from "./validate-v2-external-brain-productization-report.mjs";
import { buildArchitectureSnapshot, loadFrozenArchitecturePolicy, validateProductionCandidate, architecturePolicyArtifacts } from "./lib/v2PxProductionValidation.mjs";
import { runProductionMutationSuite } from "./lib/v2PxProductionMutations.mjs";
import { copyAsArtifact, jsonSchemaBatchErrors, parseArgs, refForBytes, validateJsonSchema, writeAtomic, writeJson } from "./lib/v2PxPipelineIo.mjs";
import { readArtifact, sha256 } from "./lib/v2PxArtifactReader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.join(repoRoot, "docs/active/project/contracts");

function outputRef(outputRoot, relativePath, mediaType = "application/json") {
  const bytes = fs.readFileSync(path.join(outputRoot, relativePath));
  return refForBytes("validation_run", relativePath, bytes, mediaType);
}

function materializeVerifiedSourceEvidence(runRoot, outputRoot, derived) {
  const references = derived.scenarioFacts.flatMap((scenario) => [
    ...(scenario.facts.screenshots ?? []).flatMap((item) => [item.imageArtifact, item.metadataArtifact]),
    ...(scenario.facts.commands ?? []).flatMap((item) => [item.stdout, item.stderr, item.structuredResult].filter(Boolean))
  ]);
  const copied = new Set();
  for (const reference of references) {
    const targetPath = `evidence/source-run/${reference.path}`;
    if (copied.has(targetPath)) continue;
    writeAtomic(path.join(outputRoot, targetPath), readArtifact(runRoot, reference).bytes);
    copied.add(targetPath);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv, ["run-root", "output-root", "derived", "validation-run-id"]);
  const runRoot = path.resolve(args["run-root"]);
  const outputRoot = path.resolve(args["output-root"]);
  const derivedPath = path.resolve(args.derived);
  if (path.dirname(derivedPath) !== outputRoot) throw new Error("--derived must be a direct child of --output-root.");
  const rawPath = path.join(runRoot, "raw/raw-run.json");
  const rawBytes = fs.readFileSync(rawPath);
  const raw = JSON.parse(rawBytes.toString("utf8"));
  const derived = JSON.parse(fs.readFileSync(derivedPath, "utf8"));
  if (raw.runId !== derived.runId) throw new Error("Raw and DerivedFacts runId mismatch.");

  validateJsonSchema(path.join(contractsRoot, "v2_px_derived_facts.schema.json"), derived);
  materializeVerifiedSourceEvidence(runRoot, outputRoot, derived);
  const statusObservations = derived.scenarioFacts.flatMap((scenario) => (scenario.facts.statusObservations ?? []).map((observation) => ({ scenarioId: scenario.scenarioId, eventId: observation.eventId, value: observation.value })));
  const statusSchemaErrors = jsonSchemaBatchErrors(path.join(contractsRoot, "v2_knowledge_status.schema.json"), statusObservations.map((item) => item.value)).map((error) => ({
    scenarioId: statusObservations[error.index]?.scenarioId,
    eventId: statusObservations[error.index]?.eventId,
    path: error.path,
    message: error.message
  }));
  writeJson(path.join(outputRoot, "status-contract-errors.json"), { checked: statusObservations.length, errors: statusSchemaErrors });
  const validationSchema = JSON.parse(fs.readFileSync(path.join(contractsRoot, "v2_external_brain_validation_contracts.schema.json"), "utf8"));
  const mutationRegistry = JSON.parse(fs.readFileSync(path.join(contractsRoot, "v2_px_production_mutation_registry.json"), "utf8"));
  const policy = loadFrozenArchitecturePolicy(repoRoot);
  const architecture = buildArchitectureSnapshot({ repoRoot, commit: raw.snapshotCommit, ...policy });
  for (const artifact of architecturePolicyArtifacts(architecture)) writeAtomic(path.join(outputRoot, artifact.relativePath), artifact.bytes);
  writeJson(path.join(outputRoot, "architecture-scan-manifest.json"), architecture.manifest);
  validateJsonSchema(path.join(contractsRoot, "v2_external_brain_architecture_scan_manifest.schema.json"), architecture.manifest);

  const contractResult = runContractFixtureSuite();
  writeJson(path.join(outputRoot, "contract-regression.json"), contractResult);
  const contractRegression = {
    passed: contractResult.passed,
    summary: { suiteId: "v2-px-contract-fixtures/v4", total: contractResult.counts.fixtures, passed: contractResult.counts.fixtures - contractResult.issues.length, failed: contractResult.issues.length, resultArtifact: outputRef(outputRoot, "contract-regression.json") }
  };
  const mutationResult = runProductionMutationSuite({ registry: mutationRegistry, raw, derived, architecture, contractRegression });
  writeJson(path.join(outputRoot, "production-mutation-results.json"), mutationResult);
  const productionMutations = {
    passed: mutationResult.failed === 0,
    summary: { suiteId: mutationResult.suiteId, total: mutationResult.total, passed: mutationResult.passed, failed: mutationResult.failed, resultArtifact: outputRef(outputRoot, "production-mutation-results.json") }
  };

  const validatorRef = copyAsArtifact(fileURLToPath(new URL("./lib/v2PxProductionValidation.mjs", import.meta.url)), outputRoot, "input/v2PxProductionValidation.mjs", "text/javascript");
  const semanticSpecRef = copyAsArtifact(path.join(repoRoot, "docs/active/project/design/v2-external-brain-productization-semantic-validator.md"), outputRoot, "input/v2-external-brain-productization-semantic-validator.md", "text/markdown");
  const registryRef = copyAsArtifact(path.join(contractsRoot, "v2_external_brain_validation_contracts.schema.json"), outputRoot, "input/v2_external_brain_validation_contracts.schema.json", "application/schema+json");
  const fixtureRef = copyAsArtifact(path.join(contractsRoot, "fixtures/v2_external_brain/px-0.1-contract-fixtures.json"), outputRoot, "input/px-0.1-contract-fixtures.json", "application/json");
  const inputs = {
    raw: { artifactRoot: "source_run", path: "raw/raw-run.json", sha256: sha256(rawBytes), byteLength: rawBytes.length, mediaType: "application/json" },
    derived: outputRef(outputRoot, path.basename(derivedPath)), validator: validatorRef, semanticSpec: semanticSpecRef, registry: registryRef, fixtureSuite: fixtureRef
  };
  const validation = validateProductionCandidate({
    runRoot, raw, derived, validationSchema, architecture, contractRegression, productionMutations, inputs,
    validationRunId: args["validation-run-id"], validatedAt: raw.seal.sealedAt, statusContractsPassed: statusSchemaErrors.length === 0
  });
  writeJson(path.join(outputRoot, "production-validation.json"), validation);
  validateJsonSchema(path.join(contractsRoot, "v2_px_production_validation.schema.json"), validation);
  return validation.machinePassed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
