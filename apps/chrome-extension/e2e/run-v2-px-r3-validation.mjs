import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildInvocationRecord } from "./lib/v2PxProductionPackage.mjs";
import { copyAsArtifact, parseArgs, refForBytes, validateJsonSchema, writeAtomic, writeJson } from "./lib/v2PxPipelineIo.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const extensionRoot = path.join(repoRoot, "apps/chrome-extension");
const invocationSchema = path.join(repoRoot, "docs/active/project/contracts/v2_px_invocation_record.schema.json");

export function ensureFreshOutputRoot(outputRoot) {
  if (fs.existsSync(outputRoot) && fs.readdirSync(outputRoot).length > 0) throw new Error("T03 output root must be empty.");
  fs.mkdirSync(outputRoot, { recursive: true });
}

export function portableArgv(values, runRoot, outputRoot) {
  return values.map((value) => String(value).replaceAll(runRoot, "$SOURCE_RUN").replaceAll(outputRoot, "$OUTPUT_ROOT").replaceAll(repoRoot, "$REPOSITORY"));
}

function outputRef(outputRoot, relativePath, mediaType) {
  const bytes = fs.readFileSync(path.join(outputRoot, relativePath));
  return refForBytes("validation_run", relativePath, bytes, mediaType);
}

function runStep({ stepId, scriptName, args, runRoot, outputRoot }) {
  const scriptPath = path.join(__dirname, scriptName);
  const implementation = copyAsArtifact(scriptPath, outputRoot, `input/invocation/${stepId}.mjs`, "text/javascript");
  const completed = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: extensionRoot,
    env: process.env,
    encoding: null,
    maxBuffer: 64 * 1024 * 1024
  });
  const stdoutBytes = Buffer.from(completed.stdout ?? "");
  const stderrBytes = Buffer.from(completed.stderr ?? "");
  const stdoutPath = `logs/invocation/${stepId}.stdout.log`;
  const stderrPath = `logs/invocation/${stepId}.stderr.log`;
  writeAtomic(path.join(outputRoot, stdoutPath), stdoutBytes);
  writeAtomic(path.join(outputRoot, stderrPath), stderrBytes);
  const record = {
    stepId,
    implementation,
    cwdRole: "extension_root",
    argv: portableArgv(["node", scriptPath, ...args], runRoot, outputRoot),
    exitCode: completed.status ?? 1,
    signal: completed.signal ?? null,
    stdout: outputRef(outputRoot, stdoutPath, "text/plain"),
    stderr: outputRef(outputRoot, stderrPath, "text/plain")
  };
  return { record, code: record.exitCode };
}

export function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv, ["run-root", "output-root", "validation-run-id"]);
  const runRoot = path.resolve(parsed["run-root"]);
  const outputRoot = path.resolve(parsed["output-root"]);
  const validationRunId = parsed["validation-run-id"];
  ensureFreshOutputRoot(outputRoot);

  const steps = [];
  const execute = (stepId, scriptName, args) => {
    const result = runStep({ stepId, scriptName, args, runRoot, outputRoot });
    steps.push(result.record);
    return result.code;
  };
  let code = execute("derive", "derive-v2-px-production-facts.mjs", ["--run-root", runRoot, "--output-root", outputRoot]);
  if (code !== 0) return code;
  const derivedPath = path.join(outputRoot, "derived-facts.json");
  code = execute("validate", "validate-v2-px-production-package.mjs", ["--run-root", runRoot, "--output-root", outputRoot, "--derived", derivedPath, "--validation-run-id", validationRunId]);
  if (code !== 0) return code;
  const validationPath = path.join(outputRoot, "production-validation.json");
  code = execute("report", "generate-v2-px-production-report.mjs", ["--derived", derivedPath, "--validation", validationPath, "--output-root", outputRoot]);
  if (code !== 0) return code;
  code = execute("package", "package-v2-px-production-candidate.mjs", [
    "--run-root", runRoot,
    "--output-root", outputRoot,
    "--derived", derivedPath,
    "--validation", validationPath,
    "--contract", path.join(outputRoot, "contract-regression.json"),
    "--human-review", path.join(outputRoot, "human-review.pending.json"),
    "--report", path.join(outputRoot, "report.json"),
    "--html", path.join(outputRoot, "acceptance-report.html")
  ]);
  if (code !== 0) return code;

  const validation = JSON.parse(fs.readFileSync(validationPath, "utf8"));
  const invocation = buildInvocationRecord({
    validationRunId,
    sourceRunId: validation.sourceRunId,
    recordedAt: new Date().toISOString(),
    steps,
    productionPackage: outputRef(outputRoot, "production-package.json", "application/json")
  });
  writeJson(path.join(outputRoot, "invocation-record.json"), invocation);
  validateJsonSchema(invocationSchema, invocation);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); } catch (error) { console.error(error.stack ?? error.message); process.exitCode = 1; }
}
