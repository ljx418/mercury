// The synthetic PRODUCT DEPENDENCY STATE of the GC-B6J offline cases.
//
// The four product dependency inputs of a candidate are created in an OWNED
// temporary root: the managed tools, the ASR root, the vision Provider
// source database and the extension build root. The offline cases never
// touch the machine's real product state and they never read a real
// Provider database.
//
// Nothing here launches a browser, starts a Runtime, reads a Cookie, calls a
// Provider or downloads anything.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { makeTempRoot } from "../../lib/temp_roots.mjs";
import {
  CANDIDATE_DEPENDENCY_ENV,
} from "../../lib/candidate_dependencies.mjs";

/**
 * Create the synthetic product dependency state.
 *
 * @returns {object} the owned roots and the EXPLICIT environment that binds
 *   them. The environment is what a candidate child must receive.
 */
export function createProductState(prefix = "navia-b6j-state-") {
  const root = makeTempRoot(prefix);
  const tools = path.join(root, "managed-tools");
  const asr = path.join(root, "asr");
  const database = path.join(root, "vision-providers.sqlite3");
  const extension = path.join(root, "extension");

  fs.mkdirSync(path.join(tools, "bin"), { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(tools, "bin", "ffmpeg"),
    "#!/bin/sh\nexit 0\n",
    { mode: 0o700 },
  );
  fs.writeFileSync(
    path.join(tools, "active.json"),
    `${JSON.stringify({ tool: "ffmpeg", version: "0" })}\n`,
    { mode: 0o600 },
  );

  fs.mkdirSync(path.join(asr, "models"), { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(asr, "models", "model.bin"),
    "the synthetic ASR model bytes\n",
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(asr, "state.json"),
    `${JSON.stringify({ asr: "ready" })}\n`,
    { mode: 0o600 },
  );

  // The vision Provider source database is a FILE: its presence and its
  // metadata identity are the facts the candidate depends on.
  fs.writeFileSync(database, "the synthetic Provider database bytes\n", { mode: 0o600 });

  fs.mkdirSync(extension, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(extension, "manifest.json"),
    `${JSON.stringify({ manifest_version: 3, name: "synthetic" })}\n`,
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(extension, "background.js"),
    "the synthetic extension bytes\n",
    { mode: 0o600 },
  );

  const environment = {
    [CANDIDATE_DEPENDENCY_ENV.MANAGED_TOOLS]: tools,
    [CANDIDATE_DEPENDENCY_ENV.ASR_ROOT]: asr,
    [CANDIDATE_DEPENDENCY_ENV.VISION_PROVIDER_DB]: database,
    [CANDIDATE_DEPENDENCY_ENV.EXTENSION_ROOT]: extension,
  };
  return { root, tools, asr, database, extension, environment };
}

/**
 * The SYNTHETIC Provider metadata probe.
 *
 * It never opens a database: it answers with the prepared identity.
 */
export function syntheticProviderMetadataProbe(sha256 = "c".repeat(64)) {
  return () => ({ present: true, sha256 });
}

/**
 * Drive the REAL runner in a child process.
 *
 * The runner is launched FROM the snapshot when one is given, and it inherits
 * the candidate environment. The ledger of the stage root is the record of
 * the external actions.
 */
export function driveRunner({
  repoRoot,
  runnerPath = null,
  snapshotRoot = null,
  manifestPath = null,
  dependencyFile = null,
  environment = {},
  extraEnv = {},
  runId = "gc-b6j-offline",
  order = "1",
  bvid = "BV11t8w6oEtP",
  args = [],
} = {}) {
  const evidenceRoot = makeTempRoot("navia-b6j-evidence-");
  const stageRoot = makeTempRoot("navia-b6j-stage-");
  const script = runnerPath
    ?? (snapshotRoot
      ? path.join(snapshotRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs")
      : path.join(repoRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs"));
  const env = {
    ...process.env,
    NAVIA_B5_STAGE_ROOT: stageRoot,
    // The Cookie is never read: the runner stops before it.
    NAVIA_BILIBILI_COOKIE_FILE: path.join(evidenceRoot, "no-cookie-file.txt"),
    ...environment,
    ...extraEnv,
  };
  if (manifestPath) env.NAVIA_B6_EXECUTION_CLOSURE = manifestPath;
  if (dependencyFile) env.NAVIA_B6_CANDIDATE_DEPENDENCIES = dependencyFile;
  const completed = spawnSync(
    process.execPath,
    [
      script,
      `--order=${order}`,
      `--bvid=${bvid}`,
      `--run-id=${runId}`,
      `--evidence-root=${evidenceRoot}`,
      ...args,
    ],
    {
      cwd: snapshotRoot ?? repoRoot,
      encoding: "utf8",
      env,
      timeout: 180_000,
    },
  );
  const receiptPath = path.join(evidenceRoot, `bvid-${order}-${bvid}`, "b5-source-receipt.json");
  let receipt = null;
  if (fs.existsSync(receiptPath)) {
    receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  }
  const ledgerPath = path.join(stageRoot, "stage-actions.jsonl");
  const events = fs.existsSync(ledgerPath)
    ? fs.readFileSync(ledgerPath, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line))
    : [];
  return { completed, evidenceRoot, stageRoot, receipt, events };
}
