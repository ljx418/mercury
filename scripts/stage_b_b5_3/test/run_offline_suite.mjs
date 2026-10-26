// The ONE offline Stage B runner test command.
//
//   node scripts/stage_b_b5_3/test/run_offline_suite.mjs
//
// It runs every offline Stage B runner test file SERIALLY and exits 0 when
// they all pass.
//
// The EXTERNAL / VISIBLE canary is NOT part of this command:
//   `canary_bvid1.node-test.mjs` (PH0-AR-12) drives a real Chrome, a real
//   cookie and the real Runtime. It is classified here as
//   `external_not_run` and it is NOT counted as a pass. Running it needs the
//   separate real-run checkpoint.
//
// EVERY offline file runs CONCURRENTLY. The ownership tests are deterministic
// on their own: the process audit is OWNERSHIP-based (the descendants of the
// sequencer that this test started), so an unrelated runner of another file
// is neither counted nor killed. Serialising the files would hide exactly
// the defect that the concurrency exposes.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

/** The external canary: real Chrome, real cookie, real Runtime. NOT offline. */
const EXTERNAL_FILES = Object.freeze(["canary_bvid1.node-test.mjs"]);

function listTestFiles() {
  return fs
    .readdirSync(here)
    .filter((name) => name.endsWith(".node-test.mjs"))
    .filter((name) => !EXTERNAL_FILES.includes(name))
    .sort();
}

function runPhase(label, files) {
  if (files.length === 0) return 0;
  console.log(`\n===== offline suite phase: ${label} (${files.join(", ")}) =====`);
  const completed = spawnSync(
    process.execPath,
    ["--test", "--test-concurrency=1", ...files.map((name) => path.join(here, name))],
    { cwd: repoRoot, stdio: "inherit" },
  );
  return completed.status === null ? 1 : completed.status;
}

const all = listTestFiles();

console.log("GC-B5R offline Stage B runner suite");
console.log(`offline files: ${all.length}`);
console.log(
  `external_not_run: ${EXTERNAL_FILES.join(", ")} (real Chrome + real cookie + real Runtime; ` +
  "not a pass, not an offline failure)",
);

let status = 0;
const concurrentExit = runPhase("concurrent", all);
if (concurrentExit !== 0) status = concurrentExit;

console.log(
  status === 0
    ? "\nOFFLINE SUITE PASSED"
    : "\nOFFLINE SUITE FAILED",
);
process.exit(status);
