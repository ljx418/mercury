// GC-B6J — the anti-false-green matrix of the snapshot dependency parity.
//
// Every case drives the REAL owner and mutates a REAL input. No case
// asserts a constant, a name or an exit code in place of a behaviour.
//
// No Chrome, no Runtime media task, no Cookie, no Provider, no download, no
// real BVID, no blind review, no sentinel and NO authorization is consumed.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  CANDIDATE_DEPENDENCY_CODE,
  CANDIDATE_DEPENDENCY_ENV,
  CANDIDATE_DEPENDENCY_KIND,
  CANDIDATE_DEPENDENCY_SCHEMA,
  candidateDependencyDefects,
  dependencyChildEnvironment,
  preflightDependencyCheck,
  publicDependencyIdentities,
  readCandidateDependencyFile,
  resolveCandidateDependencies,
  verifyCandidateDependencies,
  writeCandidateDependencyFile,
} from "../lib/candidate_dependencies.mjs";
import {
  buildCandidateLock,
  candidateEnvironment,
  prepareCandidate,
} from "../lib/candidate_prepare.mjs";
import { mergeMachineReceipt } from "../lib/audit_finalizer.mjs";
import { validatePublicEvidence } from "../lib/public_evidence.mjs";
import {
  buildRetentionRecord,
  collectArtifactDigests,
  publicRetentionDefects,
  publicRetentionProjection,
} from "../lib/retention_ledger.mjs";
import { isPublicFailureCode } from "../lib/stable_failure_codes.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "../lib/registry.mjs";
import { detectAbsolutePaths } from "../lib/privacy.mjs";
import {
  createProductState,
  driveRunner,
  syntheticProviderMetadataProbe,
} from "./_fixtures/b6j_dependency_fixture.mjs";
import { buildPackage } from "./_fixtures/b6hr_public_evidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const RUN_ID = "gc-b6hr-offline";
const REGISTRY_ORDER = FROZEN_SIX.map((entry) => String(entry.order));

/**
 * Prepare a SEALED candidate whose product dependencies are the synthetic
 * ones. The private root is owned and repository-external.
 */
function prepareCandidateWithDependencies({ state, privateRoot = null, environment = null } = {}) {
  const root = privateRoot ?? makeTempRoot("navia-b6j-candidate-");
  const prepared = prepareCandidate({
    repoRoot,
    toolRoot: repoRoot,
    privateRoot: root,
    runId: RUN_ID,
    environment: environment ?? state.environment,
    providerMetadataProbe: syntheticProviderMetadataProbe(),
  });
  assert.equal(prepared.ok, true, `the candidate must prepare: ${prepared.codes.join(",")}`);
  return { privateRoot: root, prepared };
}

// ---------------------------------------------------------------------------
// J1 — one dependency-resolution authority
// ---------------------------------------------------------------------------

test("J1: the authority resolves the four product dependencies and binds the child environment", () => {
  const state = createProductState();
  const resolved = resolveCandidateDependencies({
    repositoryRoot: repoRoot,
    environment: state.environment,
    ownedRoot: makeTempRoot("navia-b6j-probe-"),
    providerMetadataProbe: syntheticProviderMetadataProbe(),
  });
  assert.equal(resolved.schemaVersion, CANDIDATE_DEPENDENCY_SCHEMA);
  for (const kind of Object.values(CANDIDATE_DEPENDENCY_KIND)) {
    assert.ok(resolved.dependencies[kind], `the ${kind} dependency must be resolved`);
    assert.equal(resolved.dependencies[kind].kind, kind);
  }
  // The EXPLICIT child environment values are the resolved paths.
  assert.equal(resolved.childEnvironment[CANDIDATE_DEPENDENCY_ENV.MANAGED_TOOLS], state.tools);
  assert.equal(resolved.childEnvironment[CANDIDATE_DEPENDENCY_ENV.ASR_ROOT], state.asr);
  assert.equal(resolved.childEnvironment[CANDIDATE_DEPENDENCY_ENV.VISION_PROVIDER_DB], state.database);
  assert.equal(resolved.childEnvironment[CANDIDATE_DEPENDENCY_ENV.EXTENSION_ROOT], state.extension);
});

test("J1: the safe identities carry no path, no database name, no credential and no Provider identity", () => {
  const state = createProductState();
  const resolved = resolveCandidateDependencies({
    repositoryRoot: repoRoot,
    environment: state.environment,
    ownedRoot: makeTempRoot("navia-b6j-probe-"),
    providerMetadataProbe: syntheticProviderMetadataProbe(),
  });
  const identities = publicDependencyIdentities(resolved.dependencies);
  const serialized = JSON.stringify(identities);
  assert.equal(detectAbsolutePaths(serialized).length, 0, "an identity may never carry a path");
  for (const forbidden of [
    state.root, state.tools, state.asr, state.database, state.extension,
    "navia.sqlite3", "minimax", "MiniMax", "sk-", "secret",
  ]) {
    assert.ok(!serialized.includes(forbidden), `the identity must not carry ${forbidden}`);
  }
  // The LOCK carries the identities and never the paths.
  const lock = buildCandidateLock({
    runId: RUN_ID,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    registryOrder: REGISTRY_ORDER,
    manifest: null,
    dependencies: resolved,
  });
  const lockText = JSON.stringify(lock);
  assert.equal(detectAbsolutePaths(lockText).length, 0, "the lock may never carry a path");
  assert.ok(lock.dependencies.identities, "the lock must carry the dependency identities");
});

// ---------------------------------------------------------------------------
// J2 — the preflight and the child parity
// ---------------------------------------------------------------------------

test("J2: a child WITHOUT the explicit binding resolves ANOTHER dependency and is refused", () => {
  const state = createProductState();
  const { prepared } = prepareCandidateWithDependencies({ state });
  // The child receives the prepared object but NOT the explicit values: it
  // falls back to its own module-local root, which is the snapshot.
  const childRoot = path.join(prepared.snapshotRoot, "scripts/stage_b_b5_3");
  const verdict = verifyCandidateDependencies({
    environment: { ...process.env, NAVIA_B6_CANDIDATE_DEPENDENCIES: prepared.dependencyFile },
    childRoot,
    dependencyFile: prepared.dependencyFile,
    mode: "resolution",
  });
  assert.equal(verdict.ok, false, "a child without the binding must be refused");
  assert.ok(verdict.codes.includes(CANDIDATE_DEPENDENCY_CODE.MISMATCH));
});

test("J2: the child WITH the explicit binding resolves the SAME dependency and passes", () => {
  const state = createProductState();
  const { prepared } = prepareCandidateWithDependencies({ state });
  const childRoot = path.join(prepared.snapshotRoot, "scripts/stage_b_b5_3");
  const environment = candidateEnvironment({
    // Deliberately do not pre-seed any dependency variable. This proves
    // candidateEnvironment() performs the binding instead of inheriting a
    // conveniently prepared caller environment.
    environment: { ...process.env },
    repoRoot,
    toolRoot: repoRoot,
    snapshotRoot: prepared.snapshotRoot,
    manifestPath: prepared.manifestPath,
    dependencies: prepared.dependencies,
    dependencyFile: prepared.dependencyFile,
  });
  assert.equal(environment[CANDIDATE_DEPENDENCY_ENV.MANAGED_TOOLS], state.tools);
  assert.equal(environment[CANDIDATE_DEPENDENCY_ENV.ASR_ROOT], state.asr);
  assert.equal(environment[CANDIDATE_DEPENDENCY_ENV.VISION_PROVIDER_DB], state.database);
  assert.equal(environment[CANDIDATE_DEPENDENCY_ENV.EXTENSION_ROOT], state.extension);
  const verdict = verifyCandidateDependencies({
    environment,
    childRoot,
    dependencyFile: prepared.dependencyFile,
    mode: "resolution",
  });
  assert.equal(verdict.ok, true, JSON.stringify(verdict.codes));
});

test("J2: dependencyChildEnvironment maps the prepared environment names, not enum member names", () => {
  const state = createProductState();
  const resolved = resolveCandidateDependencies({
    repositoryRoot: repoRoot,
    environment: state.environment,
    ownedRoot: makeTempRoot("navia-b6j-probe-"),
    providerMetadataProbe: syntheticProviderMetadataProbe(),
  });
  assert.deepEqual(dependencyChildEnvironment(resolved), {
    [CANDIDATE_DEPENDENCY_ENV.MANAGED_TOOLS]: state.tools,
    [CANDIDATE_DEPENDENCY_ENV.ASR_ROOT]: state.asr,
    [CANDIDATE_DEPENDENCY_ENV.VISION_PROVIDER_DB]: state.database,
    [CANDIDATE_DEPENDENCY_ENV.EXTENSION_ROOT]: state.extension,
  });
});

test("J2: the private dependency object has an exact fail-closed shape", () => {
  const state = createProductState();
  const { privateRoot, prepared } = prepareCandidateWithDependencies({ state });
  const valid = JSON.parse(fs.readFileSync(prepared.dependencyFile, "utf8"));
  const mutations = [
    (value) => { value.unlisted = true; },
    (value) => { delete value.childEnvironment[CANDIDATE_DEPENDENCY_ENV.ASR_ROOT]; },
    (value) => { value.dependencies.managedTools.unlisted = true; },
    (value) => { value.paths.asrRoot = "relative/asr"; },
    (value) => { value.childEnvironment.NAVIA_ASR_ROOT = value.paths.managedTools; },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const changed = structuredClone(valid);
    mutate(changed);
    const file = path.join(privateRoot, `malformed-${index}.json`);
    fs.writeFileSync(file, `${JSON.stringify(changed)}\n`, { mode: 0o600 });
    const read = readCandidateDependencyFile(file);
    assert.equal(read.ok, false, `mutation ${index} must be refused`);
    assert.deepEqual(read.codes, [CANDIDATE_DEPENDENCY_CODE.UNREADABLE]);
  }
});

test("J2: a dependency that DISAPPEARS after the preflight is refused", () => {
  const state = createProductState();
  const { prepared } = prepareCandidateWithDependencies({ state });
  // The product state is gone: the dependency no longer resolves.
  fs.rmSync(state.asr, { recursive: true, force: true });
  const environment = candidateEnvironment({
    environment: { ...process.env, ...state.environment },
    repoRoot,
    toolRoot: repoRoot,
    snapshotRoot: prepared.snapshotRoot,
    manifestPath: prepared.manifestPath,
    dependencies: prepared.dependencies,
    dependencyFile: prepared.dependencyFile,
  });
  const childRoot = path.join(prepared.snapshotRoot, "scripts/stage_b_b5_3");
  const verdict = verifyCandidateDependencies({
    environment,
    childRoot,
    dependencyFile: prepared.dependencyFile,
    mode: "resolution",
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(CANDIDATE_DEPENDENCY_CODE.MISSING));
});

test("J2: a DRIFTED dependency is refused by the identity comparison", () => {
  const state = createProductState();
  const resolved = resolveCandidateDependencies({
    repositoryRoot: repoRoot,
    environment: state.environment,
    ownedRoot: makeTempRoot("navia-b6j-probe-"),
    providerMetadataProbe: syntheticProviderMetadataProbe(),
  });
  // The managed tools change after the preflight.
  fs.writeFileSync(
    path.join(state.tools, "active.json"),
    `${JSON.stringify({ tool: "ffmpeg", version: "1" })}\n`,
    { mode: 0o600 },
  );
  const observed = resolveCandidateDependencies({
    repositoryRoot: repoRoot,
    environment: state.environment,
    ownedRoot: makeTempRoot("navia-b6j-probe-"),
    providerMetadataProbe: syntheticProviderMetadataProbe(),
  });
  const verdict = candidateDependencyDefects(observed, { expected: resolved, mode: "identity" });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(CANDIDATE_DEPENDENCY_CODE.DRIFTED));
});

test("J2: the preflight and the child identities that DIFFER are refused", () => {
  const state = createProductState();
  const { privateRoot, prepared } = prepareCandidateWithDependencies({ state });
  // A prepared object whose identities are NOT the observed ones.
  const drifted = JSON.parse(fs.readFileSync(prepared.dependencyFile, "utf8"));
  drifted.dependencies.managedTools.treeSha256 = "0".repeat(64);
  const driftedFile = path.join(privateRoot, "drifted-dependencies.json");
  writeCandidateDependencyFile(driftedFile, drifted);
  const verdict = verifyCandidateDependencies({
    environment: { ...process.env, ...state.environment },
    childRoot: repoRoot,
    dependencyFile: driftedFile,
    mode: "identity",
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(CANDIDATE_DEPENDENCY_CODE.DRIFTED));
});

test("J2: identity-mode child verification rejects Provider metadata drift", () => {
  const state = createProductState();
  const { prepared } = prepareCandidateWithDependencies({ state });
  const environment = candidateEnvironment({
    environment: { ...process.env },
    repoRoot,
    toolRoot: repoRoot,
    snapshotRoot: prepared.snapshotRoot,
    manifestPath: prepared.manifestPath,
    dependencies: prepared.dependencies,
    dependencyFile: prepared.dependencyFile,
  });
  const verdict = verifyCandidateDependencies({
    environment,
    childRoot: path.join(prepared.snapshotRoot, "scripts/stage_b_b5_3"),
    dependencyFile: prepared.dependencyFile,
    mode: "identity",
    ownedRoot: makeTempRoot("navia-b6j-child-probe-"),
    providerMetadataProbe: () => ({ present: true, sha256: "0".repeat(64) }),
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(CANDIDATE_DEPENDENCY_CODE.DRIFTED));
});

test("J2: the generated candidate lock binds the prepared dependency identities", () => {
  const state = createProductState();
  const { prepared } = prepareCandidateWithDependencies({ state });
  const lock = buildCandidateLock({
    runId: RUN_ID,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    registryOrder: FROZEN_SIX.map((entry) => ({ order: String(entry.order), bvid: entry.bvid })),
    manifest: prepared.manifest,
    dependencies: prepared.dependencies,
  });
  assert.deepEqual(
    lock.dependencies.identities,
    publicDependencyIdentities(prepared.dependencies.dependencies),
  );
  assert.equal(detectAbsolutePaths(JSON.stringify(lock.dependencies)).length, 0);
});

test("J2: the PREFLIGHT validates the exact object that the child consumes", () => {
  const state = createProductState();
  const { privateRoot, prepared } = prepareCandidateWithDependencies({ state });
  const check = preflightDependencyCheck({
    environment: { ...process.env, ...state.environment },
    repositoryRoot: repoRoot,
    dependencyFile: prepared.dependencyFile,
    ownedRoot: makeTempRoot("navia-b6j-preflight-"),
    providerMetadataProbe: syntheticProviderMetadataProbe(),
  });
  assert.equal(check.ok, true, JSON.stringify(check.codes));
  assert.equal(detectAbsolutePaths(JSON.stringify(check.identities)).length, 0);
  // The prepared object and the preflight resolution that DIFFER are refused.
  const drifted = JSON.parse(fs.readFileSync(prepared.dependencyFile, "utf8"));
  drifted.dependencies.extensionRoot.treeSha256 = "0".repeat(64);
  const driftedFile = path.join(privateRoot, "drifted-preflight.json");
  writeCandidateDependencyFile(driftedFile, drifted);
  const second = preflightDependencyCheck({
    environment: { ...process.env, ...state.environment },
    repositoryRoot: repoRoot,
    dependencyFile: driftedFile,
    ownedRoot: makeTempRoot("navia-b6j-preflight-"),
    providerMetadataProbe: syntheticProviderMetadataProbe(),
  });
  assert.equal(second.ok, false);
  assert.ok(second.codes.includes(CANDIDATE_DEPENDENCY_CODE.DRIFTED));
});

test("J2: a preflight without a prepared object still refuses a missing product dependency", () => {
  const state = createProductState();
  fs.rmSync(state.asr, { recursive: true, force: true });
  const check = preflightDependencyCheck({
    environment: state.environment,
    repositoryRoot: repoRoot,
    ownedRoot: makeTempRoot("navia-b6j-preflight-"),
    providerMetadataProbe: syntheticProviderMetadataProbe(),
  });
  assert.equal(check.ok, false);
  assert.ok(check.codes.includes(CANDIDATE_DEPENDENCY_CODE.MISSING));
});

// ---------------------------------------------------------------------------
// J3 — the stable failure code
// ---------------------------------------------------------------------------

test("J3: the runner refuses a mismatched dependency BEFORE any external action", () => {
  const state = createProductState();
  const { prepared } = prepareCandidateWithDependencies({ state });
  // The child receives NO explicit dependency values: it resolves the
  // snapshot's own roots and the dependency check refuses it.
  const environment = candidateEnvironment({
    environment: { ...process.env },
    repoRoot,
    toolRoot: repoRoot,
    snapshotRoot: prepared.snapshotRoot,
    manifestPath: prepared.manifestPath,
    dependencies: null,
    dependencyFile: prepared.dependencyFile,
  });
  const run = driveRunner({
    repoRoot,
    snapshotRoot: prepared.snapshotRoot,
    manifestPath: prepared.manifestPath,
    dependencyFile: prepared.dependencyFile,
    environment,
    extraEnv: {
      NAVIA_MEDIA_TOOL_ROOT: "",
      NAVIA_ASR_ROOT: "",
      NAVIA_WP_B_VISION_PROVIDER_DB: "",
      NAVIA_WP_B_EXTENSION_ROOT: "",
    },
  });
  assert.notEqual(run.completed.status, 0, "the exit must be nonzero");
  assert.ok(run.receipt, "the durable receipt must exist");
  // The STABLE code, never a generic `Error` and never an exception text.
  assert.ok(
    isPublicFailureCode(run.receipt.failureCode),
    `the code must be stable: ${run.receipt.failureCode}`,
  );
  assert.ok(
    String(run.receipt.failureCode).startsWith("B6_DEPENDENCY_"),
    `the code must be a dependency code: ${run.receipt.failureCode}`,
  );
  // ZERO external actions before the refusal.
  for (const forbidden of [
    "chromeLaunch", "visibleWindow", "runtimeStart", "cookieInjection",
    "mediaTask", "providerCall", "focusEvent", "sourceAttempt",
  ]) {
    assert.equal(
      run.events.filter((event) => event.event === forbidden).length,
      0,
      `${forbidden} must not happen`,
    );
  }
  // The refusal carries no path, no database name and no exception text.
  const serialized = JSON.stringify(run.receipt);
  assert.equal(detectAbsolutePaths(serialized).length, 0, "the receipt may never carry a path");
  assert.ok(!serialized.includes("navia.sqlite3"), "the receipt may never name the database");
});

test("J3: the stable code survives the runner finalization", () => {
  const previous = {
    runId: RUN_ID,
    order: 1,
    bvid: FROZEN_SIX[0].bvid,
    disposition: "complete",
    failureCode: null,
  };
  const next = {
    ...previous,
    disposition: "failed",
    failureCode: CANDIDATE_DEPENDENCY_CODE.MISMATCH,
  };
  const merged = mergeMachineReceipt({ previous, next });
  assert.equal(merged.disposition, "failed");
  assert.equal(merged.failureCode, CANDIDATE_DEPENDENCY_CODE.MISMATCH);
  // A later healthy observation never clears the stable code.
  const restored = mergeMachineReceipt({
    previous: merged,
    next: { ...previous, disposition: "complete", failureCode: null },
  });
  assert.equal(restored.failureCode, CANDIDATE_DEPENDENCY_CODE.MISMATCH);
});

test("J3: the stable code survives the public projection and a generic Error is refused", () => {
  const built = buildPackage({
    repoRoot,
    dispositions: ["failed", "failed", "failed", "failed", "failed", "failed"],
    failureCode: CANDIDATE_DEPENDENCY_CODE.MISSING,
  });
  const machine = JSON.parse(
    built.payloads.find((p) => p.name === "02-six-source-machine-results.json").content,
  );
  assert.equal(machine.sources[0].failureCode, CANDIDATE_DEPENDENCY_CODE.MISSING);
  // A generic `Error` is NEVER publishable.
  const forged = built.payloads.map((payload) => {
    if (payload.name !== "02-six-source-machine-results.json") return payload;
    const parsed = JSON.parse(payload.content);
    parsed.sources[0].failureCode = "Error";
    return { ...payload, content: `${JSON.stringify(parsed, null, 2)}\n` };
  });
  const verdict = validatePublicEvidence(forged, {
    runId: RUN_ID,
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes("PUBLIC_EVIDENCE_FAILURE_CODE_NOT_ALLOWLISTED"));
});

// ---------------------------------------------------------------------------
// J4 — the retention digests are a set
// ---------------------------------------------------------------------------

test("J4: two byte-identical private artifacts produce ONE retention digest", () => {
  const root = makeTempRoot("navia-b6j-retained-");
  fs.writeFileSync(path.join(root, "one.bin"), "identical bytes\n", { mode: 0o600 });
  fs.writeFileSync(path.join(root, "two.bin"), "identical bytes\n", { mode: 0o600 });
  fs.writeFileSync(path.join(root, "three.bin"), "different bytes\n", { mode: 0o600 });
  const digests = collectArtifactDigests(root);
  assert.equal(digests.length, 2, "the digest set is unique");
  assert.deepEqual(digests, [...digests].sort(), "the digest set is sorted");
  assert.equal(new Set(digests).size, digests.length);
});

test("J4: the public retention validator still refuses a caller-supplied duplicate", () => {
  const record = buildRetentionRecord({
    runId: RUN_ID,
    artifactKind: "negative-run-private-artifacts",
    root: "/a/private/root",
    owner: "the Codex checkpoint",
    deadlineUtc: "2026-11-02T00:00:00Z",
    digests: ["a".repeat(64), "a".repeat(64)],
  });
  const projection = publicRetentionProjection(record);
  const verdict = publicRetentionDefects(projection);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes("RETENTION_ARTIFACT_DIGEST_DUPLICATE"));
});

// ---------------------------------------------------------------------------
// J5 — the direct entry may not bypass the sealed preparation
// ---------------------------------------------------------------------------

test("J5: a direct runner entry with a B6 capture request refuses the unsealed path", () => {
  const state = createProductState();
  const run = driveRunner({
    repoRoot,
    environment: state.environment,
    extraEnv: { NAVIA_B6_PRIVATE_ROOT: makeTempRoot("navia-b6j-private-") },
  });
  assert.notEqual(run.completed.status, 0);
  assert.ok(run.receipt, "the durable receipt must exist");
  assert.equal(run.receipt.failureCode, "B6_EXECUTION_CLOSURE_INVALID");
  for (const forbidden of ["chromeLaunch", "runtimeStart", "cookieInjection", "mediaTask", "providerCall"]) {
    assert.equal(
      run.events.filter((event) => event.event === forbidden).length,
      0,
      `${forbidden} must not happen`,
    );
  }
});

test("J5: the sequencer refuses an invalid dependency binding BEFORE the authorization", () => {
  const state = createProductState();
  const { privateRoot, prepared } = prepareCandidateWithDependencies({ state });
  // The prepared object is present but its identities do NOT match the
  // observed ones.
  const drifted = JSON.parse(fs.readFileSync(prepared.dependencyFile, "utf8"));
  drifted.dependencies.managedTools.treeSha256 = "0".repeat(64);
  const driftedFile = path.join(privateRoot, "drifted-dependencies.json");
  writeCandidateDependencyFile(driftedFile, drifted);
  const stageRoot = makeTempRoot("navia-b6j-seqstage-");
  const environment = candidateEnvironment({
    environment: { ...process.env, ...state.environment },
    repoRoot,
    toolRoot: repoRoot,
    snapshotRoot: prepared.snapshotRoot,
    manifestPath: prepared.manifestPath,
    dependencies: prepared.dependencies,
    dependencyFile: driftedFile,
    stageRoot,
  });
  const completed = spawnSync(
    process.execPath,
    [
      path.join(prepared.snapshotRoot, "scripts/stage_b_b5_3/sequencer.mjs"),
      `--run-id=${RUN_ID}`,
      `--evidence-root=${makeTempRoot("navia-b6j-seqevidence-")}`,
    ],
    {
      cwd: prepared.snapshotRoot,
      encoding: "utf8",
      env: environment,
      timeout: 180_000,
    },
  );
  assert.notEqual(completed.status, 0, "the sequencer must refuse");
  assert.match(completed.stderr, /candidate dependency binding is invalid/);
  // NO authorization was consumed.
  const authorizations = path.join(stageRoot, "authorizations");
  const markers = fs.existsSync(authorizations) ? fs.readdirSync(authorizations) : [];
  assert.deepEqual(markers, [], "the authorization must not be consumed");
});
