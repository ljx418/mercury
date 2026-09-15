import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCandidatePackage } from "./lib/v2PxProductionPackage.mjs";
import { parseArgs, refForBytes, validateJsonSchema, writeJson } from "./lib/v2PxPipelineIo.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const contractsRoot = path.join(repoRoot, "docs/active/project/contracts");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ref(root, filePath, relativePath, mediaType) {
  return refForBytes(root, relativePath, fs.readFileSync(filePath), mediaType);
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv, ["run-root", "output-root", "derived", "validation", "contract", "human-review", "report", "html"]);
  const runRoot = path.resolve(args["run-root"]);
  const outputRoot = path.resolve(args["output-root"]);
  const files = Object.fromEntries(["derived", "validation", "contract", "human-review", "report", "html"].map((key) => [key, path.resolve(args[key])]));
  for (const [key, filePath] of Object.entries(files)) {
    if (path.dirname(filePath) !== outputRoot) throw new Error(`--${key} must be a direct child of --output-root.`);
  }
  const rawPath = path.join(runRoot, "raw/raw-run.json");
  const derived = readJson(files.derived);
  const validation = readJson(files.validation);
  const humanReviewDocument = readJson(files["human-review"]);
  const report = readJson(files.report);
  validateJsonSchema(path.join(contractsRoot, "v2_px_derived_facts.schema.json"), derived);
  validateJsonSchema(path.join(contractsRoot, "v2_px_production_validation.schema.json"), validation);
  validateJsonSchema(path.join(contractsRoot, "v2_external_brain_human_review.schema.json"), humanReviewDocument);
  validateJsonSchema(path.join(contractsRoot, "v2_external_brain_report.schema.json"), report);

  const packageDocument = buildCandidatePackage({
    sourceRawRun: ref("source_run", rawPath, "raw/raw-run.json", "application/json"),
    derivedFacts: ref("validation_run", files.derived, path.basename(files.derived), "application/json"),
    productionValidation: ref("validation_run", files.validation, path.basename(files.validation), "application/json"),
    contractRegression: ref("validation_run", files.contract, path.basename(files.contract), "application/json"),
    humanReview: ref("validation_run", files["human-review"], path.basename(files["human-review"]), "application/json"),
    renderedReport: ref("validation_run", files.report, path.basename(files.report), "application/json"),
    acceptanceHtml: ref("validation_run", files.html, path.basename(files.html), "text/html"),
    derived,
    validation,
    humanReviewDocument,
    report
  });
  writeJson(path.join(outputRoot, "production-package.json"), packageDocument);
  validateJsonSchema(path.join(contractsRoot, "v2_px_production_package.schema.json"), packageDocument);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); } catch (error) { console.error(error.stack ?? error.message); process.exitCode = 1; }
}
