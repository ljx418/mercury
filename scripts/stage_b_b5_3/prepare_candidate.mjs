#!/usr/bin/env node
// The GC-B6H-R CANDIDATE PREPARATION entrypoint.
//
// It turns a working tree into a SEALED, EXCLUSIVE candidate:
//
//   1. it builds the execution closure and refuses every unresolved input;
//   2. it materializes the closure into a uniquely owned, repository-external
//      snapshot and verifies the snapshot bytes;
//   3. it writes the manifest and the candidate lock;
//   4. it launches the SEQUENCER FROM the snapshot, with the candidate
//      environment: the snapshot is the execution root, the tool root holds
//      the pinned dependency trees and the repository root holds the durable
//      state.
//
// The preparation itself performs NO external action: no Chrome, no
// Runtime, no Cookie, no Provider, no download and no authorization.
//
// Usage:
//   node scripts/stage_b_b5_3/prepare_candidate.mjs \
//     --run-id=<id> --private-root=<0700 dir outside the repository> \
//     --evidence-root=<dir> [--stage-root=<dir>] [--prepare-only]
//
// Exit 0 when the candidate is prepared (and the sequencer finished with a
// zero exit), 1 otherwise.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  candidateEnvironment,
  launchSequencerFromSnapshot,
  prepareCandidate,
  validatePrivateRoot,
} from "./lib/candidate_prepare.mjs";
import { buildCandidateLock } from "./lib/candidate_prepare.mjs";
import { preflightDependencyCheck } from "./lib/candidate_dependencies.mjs";
import { ACTIVE_REGISTRY_PATH, ACTIVE_REGISTRY_SHA256, FROZEN_SIX, RESERVE_SOURCES } from "./lib/registry.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) out[arg.slice(2)] = "1";
    else out[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] || `gc-b6-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`;
const privateRoot = path.resolve(args["private-root"] || path.join("/tmp", `navia-b6-candidate-${runId}`));
const evidenceRoot = path.resolve(args["evidence-root"] || path.join(privateRoot, "evidence"));
const stageRoot = args["stage-root"] ? path.resolve(args["stage-root"]) : path.join(privateRoot, "stage");
const prepareOnly = args["prepare-only"] === "1";

const rootVerdict = validatePrivateRoot({ privateRoot, repoRoot });
if (!rootVerdict.ok) {
  console.error(`The candidate private root is refused: ${rootVerdict.detail}`);
  process.exit(1);
}
fs.mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
fs.mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
fs.mkdirSync(stageRoot, { recursive: true, mode: 0o700 });

const prepared = prepareCandidate({
  repoRoot,
  toolRoot: repoRoot,
  privateRoot,
  runId,
});
if (!prepared.ok) {
  console.error(`The candidate could not be prepared: ${prepared.codes.join(",")} ${prepared.detail ?? ""}`);
  process.exit(1);
}

const lock = buildCandidateLock({
  runId,
  registrySha256: ACTIVE_REGISTRY_SHA256,
  registryOrder: FROZEN_SIX.map((entry) => ({ order: String(entry.order), bvid: entry.bvid })),
  reserves: RESERVE_SOURCES.map((entry) => entry.bvid),
  manifest: prepared.manifest,
  registryPath: path.relative(repoRoot, ACTIVE_REGISTRY_PATH),
  // The SAFE dependency identities: the child must consume exactly these.
  dependencies: prepared.dependencies,
});
fs.writeFileSync(
  path.join(evidenceRoot, "00-candidate-lock.json"),
  `${JSON.stringify(lock, null, 2)}\n`,
  { mode: 0o600 },
);

const environment = candidateEnvironment({
  environment: process.env,
  repoRoot,
  toolRoot: repoRoot,
  snapshotRoot: prepared.snapshotRoot,
  manifestPath: prepared.manifestPath,
  stageRoot,
  // The EXPLICIT product dependency values of the snapshot child and the
  // location of the prepared dependency object.
  dependencies: prepared.dependencies,
  dependencyFile: prepared.dependencyFile,
});

// Re-resolve and identify the exact dependencies carried by the CHILD
// environment. This is the prepared-object preflight that the old manual
// preflight could not perform because the object did not exist yet. It is
// still local and happens before authorization, Cookie access or Chrome.
const dependencyPreflightRoot = path.join(privateRoot, "dependency-preflight");
const dependencyPreflight = preflightDependencyCheck({
  environment,
  repositoryRoot: repoRoot,
  dependencyFile: prepared.dependencyFile,
  ownedRoot: dependencyPreflightRoot,
});
try {
  fs.rmSync(dependencyPreflightRoot, { recursive: true, force: true });
} catch { /* the dependency probe is an owned temporary artifact */ }
if (!dependencyPreflight.ok) {
  console.error(`The prepared candidate dependency preflight failed: ${dependencyPreflight.codes.join(",")}`);
  process.exit(1);
}

console.log(JSON.stringify({
  prepared: true,
  runId,
  fileCount: prepared.fileCount,
  toolIdentities: prepared.toolIdentities,
  dependencyIdentities: prepared.dependencies?.dependencies ?? null,
  dependencyPreflight: { ok: true, codes: [] },
}, null, 2));

if (prepareOnly) {
  process.exit(0);
}

const launched = launchSequencerFromSnapshot({
  snapshotRoot: prepared.snapshotRoot,
  environment,
  args: [`--run-id=${runId}`, `--evidence-root=${evidenceRoot}`],
  stdio: "inherit",
  onExit: ({ code }) => {
    process.exitCode = code === null ? 1 : code;
  },
});
if (!launched.ok) {
  console.error("The sequencer could not be launched from the snapshot.");
  process.exit(1);
}
