import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const runId = process.env.NAVIA_V3_2_7_RUN_ID || `v3-2-production-${stamp}`;
const base = path.join(repo, "docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-7-production-exit/runs");
const root = process.env.NAVIA_V3_2_7_RUN_ROOT ? path.resolve(repo, process.env.NAVIA_V3_2_7_RUN_ROOT) : path.join(base, runId);
const cookie = process.env.NAVIA_V3_BILIBILI_COOKIE_FILE || "/mnt/c/Users/Administrator/Desktop/myCk.txt";
const ytDlp = process.env.NAVIA_MEDIA_YT_DLP_PATH || "/tmp/navia-v3-tools/yt-dlp";
const ffmpeg = process.env.NAVIA_MEDIA_FFMPEG_PATH || "/usr/bin/ffmpeg";
const installRoot = process.env.NAVIA_V3_SENSEVOICE_INSTALL_ROOT || path.join(repo, ".navia/asr/models/funasr-sensevoice-small-q8");
const dependency = path.join(repo, "docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0-contract-dependency-samples/dependency-manifest.json");
const model = path.join(repo, "docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0c-sensevoice-spike/candidate-manifest.json");
const candidates = path.join(repo, "docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/probe-candidates-route-b3.json");
const revision4 = path.join(repo, "docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/runs/v3-2-route-b-20261006T190000Z/sample-registry-v4.json");
const exitSchema = path.join(repo, "docs/active/project/contracts/v3_media_transcript_exit_v1.schema.json");
const registrySchema = path.join(repo, "docs/active/project/contracts/v3_media_acquisition_sample_registry_v5.schema.json");
const relativeRoot = path.relative(repo, root).replaceAll(path.sep, "/");
const logs = path.join(root, "private/logs");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const securePrivateBase = path.join("/tmp", `navia-v3-2-7-${sha256(runId).slice(0, 16)}`);
const ensure = (value, message) => { if (!value) throw new Error(message); };
const writeJson = (target, value) => fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });

function treeHash() {
  const roots = ["apps/chrome-extension/entrypoints", "apps/chrome-extension/src/modules/media_companion", "services/local-runtime/navia_runtime/modules/media_companion", "services/local-runtime/navia_runtime/app.py"];
  const rows = [];
  const visit = (absolute) => {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`source symlink forbidden: ${absolute}`);
    if (stat.isDirectory()) for (const name of fs.readdirSync(absolute).sort()) visit(path.join(absolute, name));
    else if (stat.isFile() && !absolute.includes("/__pycache__/")) rows.push([path.relative(repo, absolute).replaceAll(path.sep, "/"), sha256(fs.readFileSync(absolute))]);
  };
  for (const item of roots) visit(path.join(repo, item));
  return sha256(JSON.stringify(rows));
}

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd || repo, env: { ...process.env, ...options.env }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: options.timeout || 3_600_000 });
  fs.writeFileSync(path.join(logs, `${label}.stdout.log`), result.stdout || "", { mode: 0o600 });
  fs.writeFileSync(path.join(logs, `${label}.stderr.log`), result.stderr || "", { mode: 0o600 });
  if (result.status !== 0) throw new Error(`${label} failed with exit ${result.status}: ${(result.stderr || result.stdout || "").slice(-1200)}`);
  return result;
}

function markFailed(error) {
  writeJson(path.join(root, "FAILED.json"), { schemaVersion: "v3-media-transcript-production-failure/v1", runId, failedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error), reusable: false });
}

function cleanupSecurePrivateBase() {
  ensure(securePrivateBase.startsWith("/tmp/navia-v3-2-7-"), "refusing unsafe private-root cleanup");
  fs.rmSync(securePrivateBase, { recursive: true, force: true });
}

async function main() {
  ensure(/^v3-2-production-\d{8}T\d{6}Z$/.test(runId), "invalid production runId");
  ensure(!fs.existsSync(root), "production run root already exists");
  for (const item of [cookie, ytDlp, ffmpeg, installRoot, dependency, model, candidates, revision4, exitSchema, registrySchema]) ensure(fs.existsSync(item), `required input missing: ${path.basename(item)}`);
  fs.mkdirSync(logs, { recursive: true, mode: 0o700 });
  const buildTreeSha256 = treeHash();
  const regression = { schemaVersion: "v3-media-transcript-regression/v1", runId, buildTreeSha256, steps: {} };
  const regressionSteps = [
    ["runtime", "python3", ["-m", "pytest", "-q"], path.join(repo, "services/local-runtime")],
    ["frontend-test", "npm", ["test", "--", "--run"], path.join(repo, "apps/chrome-extension")],
    ["frontend-typecheck", "npm", ["run", "typecheck"], path.join(repo, "apps/chrome-extension")],
    ["frontend-build", "npm", ["run", "build:e2e"], path.join(repo, "apps/chrome-extension")]
  ];
  for (const [label, command, args, cwd] of regressionSteps) {
    const started = Date.now();
    run(label, command, args, { cwd });
    regression.steps[label] = { exitCode: 0, elapsedMs: Date.now() - started };
  }
  regression.passed = true;
  writeJson(path.join(root, "regression-result.json"), regression);

  const probeRoot = path.join(root, "probe");
  const routeRunId = `v3-2-route-b3-${stamp}`;
  run("probe", "node", ["apps/chrome-extension/e2e/v3-bilibili-sample-probe.mjs"], { env: {
    NAVIA_V3_RUN_ID: routeRunId, NAVIA_V3_RUN_ROOT: path.relative(repo, probeRoot), NAVIA_V3_CANDIDATES: candidates,
    NAVIA_V3_BILIBILI_COOKIE_FILE: cookie
  }});
  const raw = path.join(probeRoot, "raw-observations.json");
  const rawSha = sha256(fs.readFileSync(raw));
  const transcriptRunId = `v3-2-3-sensevoice-${stamp}`;
  const transcriptRunRoot = path.join(root, "transcript/runs", transcriptRunId);

  run("route", "python3", [
    "services/local-runtime/scripts/v3_route_b_acquisition_runner.py", "--raw", raw, "--cookie", cookie,
    "--run-root", path.join(root, "route"), "--private-root", path.join(securePrivateBase, "route"), "--yt-dlp", ytDlp,
    "--ffmpeg", ffmpeg, "--schema", registrySchema, "--revision4-artifact", path.relative(repo, revision4).replaceAll(path.sep, "/"),
    "--dependency-manifest", dependency, "--model-manifest", model
  ]);
  run("transcript", "python3", [
    "services/local-runtime/scripts/v3_sensevoice_transcript_runner.py", "--raw", raw, "--cookie", cookie,
    "--run-root", transcriptRunRoot, "--private-root", path.join(securePrivateBase, "transcript"),
    "--yt-dlp", ytDlp, "--ffmpeg", ffmpeg, "--install-root", installRoot,
    "--source-run-id", routeRunId, "--source-content-sha256", rawSha
  ], { timeout: 7_200_000 });
  cleanupSecurePrivateBase();
  ensure(!fs.existsSync(securePrivateBase), "V3-2-7 secure private root remained after transcript cleanup");

  const uiEvidence = path.join(relativeRoot, "ui");
  const uiRunId = `v3-2-5-ui-${stamp}`;
  run("ui", "node", ["apps/chrome-extension/e2e/v3-acquisition-orchestration-e2e.mjs"], { timeout: 1_800_000, env: {
    NAVIA_V3_PRODUCT_STAGE: "2-5", NAVIA_V3_4A_RUN_ID: uiRunId, NAVIA_V3_4A_EVIDENCE_ROOT: uiEvidence,
    NAVIA_V3_BILIBILI_COOKIE_FILE: cookie
  }});

  const faultRunId = `v3-2-6-faults-${stamp}`;
  run("fault-runtime", "python3", ["services/local-runtime/scripts/v3_media_runtime_faults.py", "--output-root", path.join(root, "fault-runtime"), "--run-id", faultRunId]);
  run("fault-verify", "python3", ["services/local-runtime/scripts/v3-media-fault-verifier.py", "--run-root", path.join(root, "fault-runtime"), "--schema", exitSchema]);
  run("fault-ui", "node", ["apps/chrome-extension/e2e/v3-media-fault-runner.mjs"], { timeout: 900_000, env: {
    NAVIA_V3_2_6_UI_RUN_ID: `v3-2-6-ui-${stamp}`, NAVIA_V3_2_6_UI_RUN_ROOT: path.join(relativeRoot, "fault-ui")
  }});

  writeJson(path.join(root, "run-binding.json"), {
    schemaVersion: "v3-media-transcript-run-binding/v1", parentRunId: runId,
    childRunIds: { route: routeRunId, transcript: transcriptRunId, ui: uiRunId, fault: faultRunId, faultUi: `v3-2-6-ui-${stamp}` },
    rawSha256: rawSha, buildTreeSha256, securePrivateRootRemoved: true
  });

  run("collector", "node", ["apps/chrome-extension/e2e/v3-media-transcript-collector.mjs", root, path.join(root, "artifact-index.json")]);
  run("package-prepare", "python3", ["services/local-runtime/scripts/v3-media-transcript-package.py", "--run-root", root, "--schema", exitSchema,
    "--dependency-manifest", dependency, "--model-manifest", model, "--build-tree-sha256", buildTreeSha256, "--mode", "prepare"]);
  run("verifier", "python3", ["services/local-runtime/scripts/v3-media-transcript-verifier.py", "--run-root", root, "--schema", exitSchema,
    "--dependency-manifest", dependency, "--model-manifest", model, "--payload-package", path.join(root, "public-payload.tar.gz"),
    "--private-index", path.join(root, "private-index.json"), "--build-tree-sha256", buildTreeSha256]);
  run("package-seal", "python3", ["services/local-runtime/scripts/v3-media-transcript-package.py", "--run-root", root, "--schema", exitSchema,
    "--dependency-manifest", dependency, "--model-manifest", model, "--build-tree-sha256", buildTreeSha256, "--mode", "seal"]);
  process.stdout.write(`${JSON.stringify({ runId, root, candidate: path.join(root, "exit-candidate.json") }, null, 2)}\n`);
}

main().catch((error) => {
  try {
    cleanupSecurePrivateBase();
    if (fs.existsSync(root)) markFailed(error);
  } finally {
    console.error(error);
    process.exitCode = 2;
  }
});
