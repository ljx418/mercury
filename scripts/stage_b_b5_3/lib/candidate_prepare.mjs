// The CANDIDATE PREPARATION of a GC-B6 batch.
//
// ONE entrypoint that turns a working tree into a SEALED, EXCLUSIVE
// candidate: it builds the execution closure, refuses every unresolved
// input, materializes the closure into a uniquely owned repository-external
// snapshot, verifies the snapshot bytes and hands the environment that
// makes the snapshot the EXECUTION ROOT.
//
// Nothing here performs an external action: no Chrome, no Runtime, no
// Cookie, no Provider, no download and no authorization.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  EXECUTION_CLOSURE_FAILURE,
  buildExecutionClosureManifest,
  executionClosureManifestDefects,
  materializeExecutionSnapshot,
  verifyExecutionSnapshot,
} from "./execution_closure.mjs";
import {
  CANDIDATE_DEPENDENCY_FILE_ENV,
  candidateDependencyDefects,
  dependencyChildEnvironment,
  publicDependencyIdentities,
  resolveCandidateDependencies,
  writeCandidateDependencyFile,
} from "./candidate_dependencies.mjs";

/** The candidate-preparation schema version. */
export const CANDIDATE_PREPARE_SCHEMA = "v3-5.10-b6-candidate-prepare/v1";

/** The stable candidate-preparation defect codes. */
export const CANDIDATE_PREPARE_FAILURE = Object.freeze({
  SCHEMA: "B6_CANDIDATE_PREPARE_SCHEMA_INVALID",
  ROOT_INVALID: "B6_CANDIDATE_PREPARE_ROOT_INVALID",
  ROOT_MUTABLE: "B6_CANDIDATE_PREPARE_ROOT_MUTABLE",
  CLOSURE_INVALID: "B6_CANDIDATE_PREPARE_CLOSURE_INVALID",
  SNAPSHOT_MUTABLE: "B6_CANDIDATE_PREPARE_SNAPSHOT_MUTABLE",
  SNAPSHOT_INVALID: "B6_CANDIDATE_PREPARE_SNAPSHOT_INVALID",
  LAUNCH_FAILED: "B6_CANDIDATE_PREPARE_LAUNCH_FAILED",
});

/** The environment variable names of the candidate path. */
export const CANDIDATE_ENV = Object.freeze({
  SNAPSHOT_ROOT: "NAVIA_B6_SNAPSHOT_ROOT",
  TOOL_ROOT: "NAVIA_B6_TOOL_ROOT",
  REPO_ROOT: "NAVIA_B6_REPO_ROOT",
  CLOSURE_MANIFEST: "NAVIA_B6_EXECUTION_CLOSURE",
  REQUIRE_SNAPSHOT: "NAVIA_B6_REQUIRE_SNAPSHOT",
  STAGE_ROOT: "NAVIA_B5_STAGE_ROOT",
  DEPENDENCIES: CANDIDATE_DEPENDENCY_FILE_ENV,
});

/**
 * The candidate path is REQUIRED to run from a sealed snapshot.
 *
 * The preparation switch identifies the official entrypoint. The sequencer
 * and runner additionally treat a normal B6 capture request as requiring a
 * snapshot, so omitting the switch cannot turn the old direct entrypoint into
 * an unsealed candidate path.
 */
export function snapshotRequired(environment = process.env) {
  return String(environment[CANDIDATE_ENV.REQUIRE_SNAPSHOT] ?? "") === "1";
}

/**
 * The CANDIDATE PATH is required.
 *
 * The candidate path runs from a sealed snapshot with an explicit dependency
 * binding. A normal B6 capture is always a candidate path; the order-2
 * diagnostic canary and the explicitly injected offline harness keep their
 * separate gates.
 */
export function candidatePathRequired({
  environment = process.env,
  canary = false,
  offlineHarness = false,
} = {}) {
  if (snapshotRequired(environment)) return true;
  return Boolean(environment.NAVIA_B6_PRIVATE_ROOT && !canary && !offlineHarness);
}

/**
 * The roots of the candidate path.
 *
 *   * the SNAPSHOT root is the executed product bytes;
 *   * the TOOL root holds the pinned third-party dependency trees and the
 *     durable state (the authorization, the ledger and the stage root);
 *   * the REPO root is the durable state root of the batch.
 */
export function resolveCandidateRoots({ environment = process.env, fallbackRepoRoot = null } = {}) {
  const snapshotRaw = environment[CANDIDATE_ENV.SNAPSHOT_ROOT] ?? null;
  const toolRaw = environment[CANDIDATE_ENV.TOOL_ROOT] ?? null;
  const repoRaw = environment[CANDIDATE_ENV.REPO_ROOT] ?? null;
  return {
    snapshotRoot: snapshotRaw ? path.resolve(snapshotRaw) : null,
    toolRoot: toolRaw ? path.resolve(toolRaw) : (fallbackRepoRoot ? path.resolve(fallbackRepoRoot) : null),
    repoRoot: repoRaw ? path.resolve(repoRaw) : (fallbackRepoRoot ? path.resolve(fallbackRepoRoot) : null),
    manifestPath: environment[CANDIDATE_ENV.CLOSURE_MANIFEST]
      ? path.resolve(environment[CANDIDATE_ENV.CLOSURE_MANIFEST])
      : null,
    required: snapshotRequired(environment),
  };
}

/**
 * Validate the PRIVATE root of a candidate.
 *
 * The root must be an absolute path OUTSIDE the repository and it must not
 * be accessible by the group or by others.
 */
export function validatePrivateRoot({ privateRoot, repoRoot }) {
  if (typeof privateRoot !== "string" || !privateRoot) {
    return { ok: false, code: CANDIDATE_PREPARE_FAILURE.ROOT_INVALID, detail: "the private root must be an explicit absolute path" };
  }
  if (!path.isAbsolute(privateRoot)) {
    return { ok: false, code: CANDIDATE_PREPARE_FAILURE.ROOT_INVALID, detail: "the private root must be an absolute path" };
  }
  const realRepo = fs.realpathSync(path.resolve(repoRoot));
  const realRoot = path.resolve(privateRoot);
  if (realRoot === realRepo || realRoot.startsWith(`${realRepo}${path.sep}`)) {
    return { ok: false, code: CANDIDATE_PREPARE_FAILURE.ROOT_INVALID, detail: "the private root is inside the repository" };
  }
  if (fs.existsSync(realRoot)) {
    const stat = fs.lstatSync(realRoot);
    if (stat.isSymbolicLink()) {
      return { ok: false, code: CANDIDATE_PREPARE_FAILURE.ROOT_MUTABLE, detail: "the private root is a symbolic link" };
    }
    if (!stat.isDirectory()) {
      return { ok: false, code: CANDIDATE_PREPARE_FAILURE.ROOT_INVALID, detail: "the private root is not a directory" };
    }
    if ((stat.mode & 0o077) !== 0) {
      return { ok: false, code: CANDIDATE_PREPARE_FAILURE.ROOT_INVALID, detail: "the private root is accessible by the group or by others" };
    }
  }
  return { ok: true, code: null, detail: null };
}

/**
 * Prepare the SEALED candidate.
 *
 * The preparation is a pure local operation: it reads the working tree,
 * copies the executed bytes into the snapshot and writes the manifest. It
 * performs no external action.
 */
export function prepareCandidate({
  repoRoot,
  toolRoot = null,
  privateRoot,
  runId = null,
  snapshotName = null,
  providerMetadataProbe = null,
  environment = process.env,
} = {}) {
  const root = path.resolve(repoRoot ?? process.cwd());
  const tools = path.resolve(toolRoot ?? root);
  const rootVerdict = validatePrivateRoot({ privateRoot, repoRoot: root });
  if (!rootVerdict.ok) {
    return {
      ok: false,
      codes: [rootVerdict.code],
      detail: rootVerdict.detail,
      manifest: null,
      manifestPath: null,
      snapshotRoot: null,
    };
  }
  fs.mkdirSync(path.resolve(privateRoot), { recursive: true, mode: 0o700 });

  const manifest = buildExecutionClosureManifest({ repoRoot: root, runId });
  const manifestVerdict = executionClosureManifestDefects(manifest);
  if (!manifestVerdict.ok) {
    return {
      ok: false,
      codes: manifestVerdict.codes,
      detail: "the execution closure may never be built from an incomplete input",
      manifest,
      manifestPath: null,
      snapshotRoot: null,
    };
  }

  const name = snapshotName ?? `snapshot-${String(runId ?? "candidate").replace(/[^A-Za-z0-9._-]/g, "_")}`;
  const snapshotRoot = path.join(path.resolve(privateRoot), name);
  if (fs.existsSync(snapshotRoot)) {
    return {
      ok: false,
      codes: [CANDIDATE_PREPARE_FAILURE.SNAPSHOT_MUTABLE],
      detail: "the snapshot root already exists: a candidate snapshot is never reused",
      manifest,
      manifestPath: null,
      snapshotRoot,
    };
  }
  const materialized = materializeExecutionSnapshot({
    manifest,
    repoRoot: root,
    toolRoot: tools,
    snapshotRoot,
  });
  if (!materialized.ok) {
    return {
      ok: false,
      codes: materialized.codes,
      detail: "the candidate snapshot could not be materialized",
      manifest,
      manifestPath: null,
      snapshotRoot,
    };
  }
  const verified = verifyExecutionSnapshot({ manifest, snapshotRoot, toolRoot: tools });
  if (!verified.ok) {
    return {
      ok: false,
      codes: verified.codes,
      detail: "the materialized snapshot does not verify against its own manifest",
      drifted: verified.drifted,
      missing: verified.missing,
      extra: verified.extra,
      manifest,
      manifestPath: null,
      snapshotRoot,
    };
  }
  const manifestPath = path.join(path.resolve(privateRoot), "execution-closure.manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  // The DEPENDENCY OBJECT of the candidate. It is resolved ONCE, from the
  // TOOL root, and it is the SAME object that the preflight validates and
  // that the snapshot child consumes. The PRIVATE form (the resolved paths)
  // lives in the owned private root; only the identities are published.
  const probeRoot = path.join(path.resolve(privateRoot), "dependency-probe");
  const dependencies = resolveCandidateDependencies({
    repositoryRoot: tools,
    environment,
    ownedRoot: probeRoot,
    providerMetadataProbe,
  });
  try {
    fs.rmSync(probeRoot, { recursive: true, force: true });
  } catch { /* the probe scratch is an owned temporary artifact */ }
  const dependencyVerdict = candidateDependencyDefects(dependencies, { mode: "identity" });
  if (!dependencyVerdict.ok) {
    return {
      ok: false,
      codes: dependencyVerdict.codes,
      detail: "the candidate product dependencies are incomplete",
      manifest,
      manifestPath,
      snapshotRoot,
    };
  }
  const dependencyFile = path.join(path.resolve(privateRoot), "candidate-dependencies.json");
  writeCandidateDependencyFile(dependencyFile, dependencies);

  return {
    ok: true,
    codes: [],
    detail: null,
    manifest,
    manifestPath,
    snapshotRoot,
    fileCount: materialized.fileCount,
    toolIdentities: manifest.toolIdentities,
    dependencies,
    dependencyFile,
  };
}

/**
 * The environment of the candidate path.
 *
 * The child inherits the snapshot root, the tool root, the durable state
 * root, the manifest location and the REQUIRED switch. The child may not
 * run without them.
 */
export function candidateEnvironment({
  environment = process.env,
  repoRoot,
  toolRoot,
  snapshotRoot,
  manifestPath,
  stageRoot = null,
  dependencies = null,
  dependencyFile = null,
} = {}) {
  const next = { ...environment };
  next[CANDIDATE_ENV.SNAPSHOT_ROOT] = path.resolve(snapshotRoot);
  next[CANDIDATE_ENV.TOOL_ROOT] = path.resolve(toolRoot);
  next[CANDIDATE_ENV.REPO_ROOT] = path.resolve(repoRoot);
  next[CANDIDATE_ENV.CLOSURE_MANIFEST] = path.resolve(manifestPath);
  next[CANDIDATE_ENV.REQUIRE_SNAPSHOT] = "1";
  if (stageRoot) next[CANDIDATE_ENV.STAGE_ROOT] = path.resolve(stageRoot);
  // The EXPLICIT dependency values of the snapshot child. Without them the
  // child resolves the product inputs below its OWN root, which is the
  // snapshot, and the product state is absent there.
  if (dependencies) {
    for (const [variable, value] of Object.entries(dependencyChildEnvironment(dependencies))) {
      next[variable] = value;
    }
  }
  if (dependencyFile) next[CANDIDATE_ENV.DEPENDENCIES] = path.resolve(dependencyFile);
  return next;
}

/**
 * Launch the SEQUENCER from the snapshot.
 *
 * The sequencer script is the SNAPSHOT's own script: the child harness
 * executes the sealed bytes.
 */
export function launchSequencerFromSnapshot({
  snapshotRoot,
  environment = process.env,
  args = [],
  stdio = "inherit",
  onExit = null,
} = {}) {
  const script = path.join(path.resolve(snapshotRoot), "scripts/stage_b_b5_3/sequencer.mjs");
  if (!fs.existsSync(script)) {
    return { ok: false, code: CANDIDATE_PREPARE_FAILURE.LAUNCH_FAILED, child: null };
  }
  const child = spawn(process.execPath, [script, ...args], {
    cwd: path.resolve(snapshotRoot),
    env: environment,
    stdio,
  });
  if (onExit) {
    child.on("exit", (code, signal) => onExit({ code, signal }));
  }
  return { ok: true, code: null, child };
}

/**
 * The stable codes of a candidate that stopped before its external action.
 */
export const CANDIDATE_STOP_CODE = Object.freeze({
  SNAPSHOT_ABSENT: "B6_EXECUTION_SNAPSHOT_REQUIRED",
  SNAPSHOT_INVALID: "B6_EXECUTION_SNAPSHOT_INVALID",
  CLOSURE_INVALID: "B6_EXECUTION_CLOSURE_INVALID",
});

/**
 * The CANDIDATE LOCK of a batch.
 *
 * The lock is GENERATED: it binds the run, the registry digest, the frozen
 * order, the reserve prohibition and the digests of the executed harness
 * files. It is written BEFORE the first external action and it is never
 * transcribed by hand.
 */
export function buildCandidateLock({
  runId,
  registrySha256,
  registryOrder = [],
  reserves = [],
  manifest = null,
  registryPath = null,
  lockedAtUtc = null,
  dependencies = null,
} = {}) {
  const harness = (manifest?.files ?? [])
    .filter((entry) => entry.relative.startsWith("scripts/stage_b_b5_3/")
      && !entry.relative.includes("/test/"))
    .map((entry) => ({ file: entry.relative, sha256: entry.sha256 }))
    .sort((left, right) => left.file.localeCompare(right.file));
  return {
    schemaVersion: "v3-5.10-b6-candidate-lock/v2",
    batch: "GC-B6 CANDIDATE LOCK",
    lockedBeforeAnyExternalAction: true,
    lockedAtUtc: lockedAtUtc ?? new Date().toISOString(),
    runId: runId ?? null,
    registry: {
      activeRegistryPath: registryPath,
      activeRegistrySha256: registrySha256 ?? null,
      expectedRegistrySha256: registrySha256 ?? null,
      digestMatches: true,
      order: registryOrder.map((entry) => (typeof entry === "object" && entry !== null
        ? { order: String(entry.order), bvid: entry.bvid ?? null }
        : { order: String(entry), bvid: null })),
      reserves: [...reserves].map(String),
      substitutionAllowed: false,
    },
    harness,
    executionClosure: {
      schemaVersion: manifest?.schemaVersion ?? null,
      fileCount: Number(manifest?.fileCount ?? 0),
      toolIdentities: manifest?.toolIdentities ?? null,
    },
    // The SAFE identities of the product dependencies. They carry no path, no
    // database name, no credential and no Provider identity.
    dependencies: dependencies
      ? {
        schemaVersion: dependencies.schemaVersion ?? null,
        identities: publicDependencyIdentities(dependencies.dependencies),
      }
      : null,
  };
}

export { EXECUTION_CLOSURE_FAILURE };
