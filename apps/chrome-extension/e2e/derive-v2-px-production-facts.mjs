import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveFacts } from "./lib/v2PxDerivedFacts.mjs";
import { copyAsArtifact, parseArgs, writeJson } from "./lib/v2PxPipelineIo.mjs";
import { sha256 } from "./lib/v2PxArtifactReader.mjs";

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv, ["run-root", "output-root"]);
  const runRoot = path.resolve(args["run-root"]);
  const outputRoot = path.resolve(args["output-root"]);
  const implementationPath = fileURLToPath(new URL("./lib/v2PxDerivedFacts.mjs", import.meta.url));
  const implementation = copyAsArtifact(implementationPath, outputRoot, "input/v2PxDerivedFacts.mjs", "text/javascript");
  const rawPath = path.join(runRoot, "raw/raw-run.json");
  const rawBytes = fs.readFileSync(rawPath);
  const sealedRawRun = { artifactRoot: "source_run", path: "raw/raw-run.json", sha256: sha256(rawBytes), byteLength: rawBytes.length, mediaType: "application/json" };
  const { raw, facts, gaps } = deriveFacts({ runRoot, sealedRawRun, generatorImplementation: implementation });
  if (gaps.length) {
    const diagnostic = { schemaVersion: "v2-px-collection-diagnostic/v1", runId: raw.runId, sourceRawRun: sealedRawRun, generatedAt: raw.seal.sealedAt, passed: false, missingObservations: gaps, issues: gaps.map((gap) => `${gap.requirementId}: ${gap.observed}/${gap.required}`), generatorImplementation: implementation };
    writeJson(path.join(outputRoot, "collection-diagnostic.json"), diagnostic);
    return 2;
  }
  writeJson(path.join(outputRoot, "derived-facts.json"), facts);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}

