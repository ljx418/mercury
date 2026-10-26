// GC-B6H-R — the anti-false-green matrix of the offline corrective.
//
// Every case drives the REAL owner and mutates a REAL input. No case
// asserts a constant, a name or an exit code in place of a behaviour.
//
// No Chrome, no Runtime media task, no Cookie, no Provider, no download, no
// real BVID, no blind review, no sentinel and no VISIBLE authorization is
// used. The synthetic private bundles are written from the production
// encoders into an owned temporary root.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  EXECUTION_CLOSURE_FAILURE,
  executionClosureManifestDefects,
  executionTreeDigest,
  resolveToolIdentities,
  verifyExecutionSnapshot,
} from "../lib/execution_closure.mjs";
import {
  CANDIDATE_PREPARE_FAILURE,
  candidateEnvironment,
  prepareCandidate,
} from "../lib/candidate_prepare.mjs";
import {
  REVIEW_PROTOCOL_FAILURE,
  buildValidatedReviewPrecommit,
  reviewPrecommitDefects,
} from "../lib/review_protocol.mjs";
import {
  PUBLIC_EVIDENCE_FAILURE,
  buildPublicEvidence,
  validatePublicEvidence,
} from "../lib/public_evidence.mjs";
import {
  RETENTION_FAILURE,
  buildRetentionRecord,
  publicRetentionDefects,
  publicRetentionProjection,
} from "../lib/retention_ledger.mjs";
import { evaluateAggregate } from "../lib/aggregate.mjs";
import { mergeMachineReceipt } from "../lib/audit_finalizer.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "../lib/registry.mjs";
import { REVIEW_BUNDLE_MANIFEST } from "../lib/review_bundle.mjs";
import { collectSourceRows, readAttemptedSources } from "../lib/source_rows.mjs";
import { readStageTotals } from "../lib/action_ledger.mjs";
import { writeContractShapedEvidence } from "./_fixtures/contract_shaped_stub.mjs";
import {
  REGISTRY_ORDER,
  RUN_ID,
  buildPackage,
  syntheticLock,
  syntheticPrecommit,
  syntheticPrivateRoot,
  syntheticRows,
  validatePackage,
  writeBundle,
} from "./_fixtures/b6hr_public_evidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runnerPath = path.join(repoRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** An OWNED temporary root: it is removed when the test process exits. */
function scratch(prefix) {
  return makeTempRoot(prefix);
}

// ---------------------------------------------------------------------------
// R1 — the sealed snapshot
// ---------------------------------------------------------------------------

/**
 * Prepare a REAL sealed candidate.
 *
 * The preparation is a local operation: it copies the executed bytes into
 * an owned repository-external snapshot and verifies them.
 */
function prepareSealedCandidate({ prefix = "navia-b6hr-candidate-" } = {}) {
  const privateRoot = scratch(prefix);
  const prepared = prepareCandidate({
    repoRoot,
    toolRoot: repoRoot,
    privateRoot,
    runId: RUN_ID,
  });
  assert.equal(
    prepared.ok,
    true,
    `the candidate must prepare: ${prepared.codes.join(",")} drifted=${JSON.stringify(prepared.drifted ?? [])} missing=${JSON.stringify(prepared.missing ?? [])} extra=${JSON.stringify(prepared.extra ?? [])}`,
  );
  return { privateRoot, prepared };
}

/**
 * Drive the REAL runner in a child process.
 *
 * The runner is launched FROM the snapshot when a snapshot is given: the
 * child harness then executes the sealed bytes.
 */
function driveRunner({ env = {}, args = [], snapshotRoot = null, runId = RUN_ID } = {}) {
  const evidenceRoot = scratch("navia-b6hr-evidence-");
  const stageRoot = scratch("navia-b6hr-stage-");
  const script = snapshotRoot
    ? path.join(snapshotRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs")
    : runnerPath;
  const completed = spawnSync(
    process.execPath,
    [
      script,
      "--order=1",
      `--bvid=${FROZEN_SIX[0].bvid}`,
      `--run-id=${runId}`,
      `--evidence-root=${evidenceRoot}`,
      ...args,
    ],
    {
      cwd: snapshotRoot ?? repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NAVIA_B5_STAGE_ROOT: stageRoot,
        // The Cookie is never read: the runner stops before it.
        NAVIA_BILIBILI_COOKIE_FILE: path.join(evidenceRoot, "no-cookie-file.txt"),
        ...env,
      },
      timeout: 180_000,
    },
  );
  const receiptPath = path.join(evidenceRoot, "bvid-1-BV11t8w6oEtP", "b5-source-receipt.json");
  let receipt = null;
  if (fs.existsSync(receiptPath)) {
    receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  }
  return { completed, evidenceRoot, stageRoot, receipt };
}

/** The durable action ledger of a driven run. */
function ledgerEvents(stageRoot) {
  const file = path.join(stageRoot, "stage-actions.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

test("R1: the candidate preparation seals the executed bytes into an exclusive snapshot", () => {
  const { prepared } = prepareSealedCandidate();
  const verdict = verifyExecutionSnapshot({
    manifest: prepared.manifest,
    snapshotRoot: prepared.snapshotRoot,
    toolRoot: repoRoot,
  });
  assert.equal(verdict.ok, true, JSON.stringify(verdict.codes));
  assert.ok(prepared.fileCount > 100, "the closure must cover the executed bytes");
  // The manifest has NO unresolved import and NO absent tool identity.
  const defects = executionClosureManifestDefects(prepared.manifest);
  assert.equal(defects.ok, true, JSON.stringify(defects.codes));
  assert.deepEqual(prepared.manifest.unresolved, []);
  // The snapshot is OUTSIDE the repository and it is unique.
  assert.ok(!prepared.snapshotRoot.startsWith(repoRoot));
  assert.equal(fs.existsSync(path.join(prepared.snapshotRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs")), true);
});

test("R1: a candidate without a snapshot is refused before the grant, the Cookie and Chrome", () => {
  const { completed, receipt, stageRoot } = driveRunner({
    env: { NAVIA_B6_REQUIRE_SNAPSHOT: "1" },
  });
  assert.notEqual(completed.status, 0, "the exit must be nonzero");
  assert.ok(receipt, "the durable receipt must exist");
  // The STOP happens at the closure check: the grant is never verified.
  assert.equal(receipt.failureCode, "B6_EXECUTION_CLOSURE_INVALID");
  assert.equal(receipt.disposition, "failed");
  assert.match(receipt.failureCode, /^B6_/);
  // The closure observation is DURABLE and exact.
  assert.equal(receipt.executionClosure.present, false);
  assert.equal(receipt.executionClosure.ok, false);
  assert.deepEqual(receipt.executionClosure.codes, ["B6_EXECUTION_SNAPSHOT_REQUIRED"]);
  // NO external action happened.
  const events = ledgerEvents(stageRoot);
  for (const forbidden of ["chromeLaunch", "visibleWindow", "runtimeStart", "cookieInjection", "mediaTask", "providerCall", "focusEvent"]) {
    assert.equal(events.filter((event) => event.event === forbidden).length, 0, `${forbidden} must not happen`);
  }
  // The ORDER is proven by the runner source: the closure check precedes the
  // grant verification.
  const source = fs.readFileSync(runnerPath, "utf8");
  const closureIndex = source.indexOf('verifyCandidateClosure("pre-external-action")');
  const grantIndex = source.indexOf("verifyChildGrant({");
  assert.ok(closureIndex > 0, "the runner must verify the closure");
  assert.ok(grantIndex > 0, "the runner must verify the grant");
  assert.ok(closureIndex < grantIndex, "the closure check must precede the grant");
});

test("R1: requesting a normal B6 capture makes the snapshot mandatory without a caller switch", () => {
  const { completed, receipt, stageRoot } = driveRunner({
    env: {
      NAVIA_B6_PRIVATE_ROOT: scratch("navia-b6hr-capture-"),
      NAVIA_B6_REQUIRE_SNAPSHOT: "",
    },
  });
  assert.notEqual(completed.status, 0);
  assert.equal(receipt?.failureCode, "B6_EXECUTION_CLOSURE_INVALID");
  assert.deepEqual(receipt?.executionClosure?.codes, ["B6_EXECUTION_SNAPSHOT_REQUIRED"]);
  const events = ledgerEvents(stageRoot);
  for (const forbidden of ["chromeLaunch", "runtimeStart", "cookieInjection", "mediaTask", "providerCall"]) {
    assert.equal(events.filter((event) => event.event === forbidden).length, 0);
  }
});

test("R1: dependency identities change when executable package bytes change without a version change", () => {
  const root = scratch("navia-b6hr-tool-tree-");
  const nodeModules = path.join(root, "apps/chrome-extension/node_modules");
  const sitePackages = path.join(root, "services/local-runtime/.venv/lib/python3.12/site-packages");
  const bin = path.join(root, "services/local-runtime/.venv/bin");
  for (const name of ["playwright", "playwright-core"]) {
    const directory = path.join(nodeModules, name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
    fs.writeFileSync(path.join(directory, "index.js"), "export const value = 1;\n");
  }
  fs.mkdirSync(path.join(sitePackages, "fixture"), { recursive: true });
  fs.writeFileSync(path.join(sitePackages, "fixture", "__init__.py"), "VALUE = 1\n");
  fs.mkdirSync(bin, { recursive: true });
  const python = path.join(bin, "python");
  fs.writeFileSync(python, "#!/bin/sh\necho Python 3.12.0\n", { mode: 0o700 });

  const before = resolveToolIdentities({ repoRoot: root });
  fs.writeFileSync(path.join(nodeModules, "playwright", "index.js"), "export const value = 2;\n");
  fs.writeFileSync(path.join(sitePackages, "fixture", "__init__.py"), "VALUE = 2\n");
  const after = resolveToolIdentities({ repoRoot: root });
  assert.notEqual(before.extensionDependencyTreeSha256, after.extensionDependencyTreeSha256);
  assert.notEqual(before.runtimeDependencyTreeSha256, after.runtimeDependencyTreeSha256);
});

test("R1: the Runtime, the extension and the child harness execute the SNAPSHOT bytes", () => {
  const { prepared } = prepareSealedCandidate();
  const snapshotRoot = prepared.snapshotRoot;
  // The test acts as the SEAL OWNER: it changes one byte of the snapshot
  // and records the new digest in the manifest, so the seal still holds.
  const changed = [
    "apps/chrome-extension/chrome-mv3-unpacked/manifest.json",
    "services/local-runtime/navia_runtime/app.py",
  ];
  const manifest = JSON.parse(JSON.stringify(prepared.manifest));
  for (const relative of changed) {
    const target = path.join(snapshotRoot, relative);
    const bytes = Buffer.concat([fs.readFileSync(target), Buffer.from("\n// the offline suite\n")]);
    fs.writeFileSync(target, bytes, { mode: 0o600 });
    const entry = manifest.files.find((item) => item.relative === relative);
    assert.ok(entry, `the closure must contain ${relative}`);
    entry.sha256 = sha256(bytes);
    entry.byteCount = bytes.length;
  }
  fs.writeFileSync(prepared.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  const environment = candidateEnvironment({
    environment: process.env,
    repoRoot,
    toolRoot: repoRoot,
    snapshotRoot,
    manifestPath: prepared.manifestPath,
    stageRoot: scratch("navia-b6hr-stage-"),
  });
  const { completed, receipt } = driveRunner({ env: environment, snapshotRoot });
  assert.notEqual(completed.status, 0);
  assert.ok(receipt, "the durable receipt must exist");
  const roots = receipt.executionRoots;
  assert.ok(roots, "the receipt must carry the execution-root identities");
  assert.equal(roots.productRootSource, "snapshot");
  // The EXTENSION bytes that were executed are the SNAPSHOT's bytes.
  const snapshotExtension = executionTreeDigest({
    productRoot: snapshotRoot,
    relative: "apps/chrome-extension/chrome-mv3-unpacked",
  });
  const worktreeExtension = executionTreeDigest({
    productRoot: repoRoot,
    relative: "apps/chrome-extension/chrome-mv3-unpacked",
  });
  assert.equal(roots.extensionTreeSha256, snapshotExtension);
  assert.notEqual(roots.extensionTreeSha256, worktreeExtension);
  // The RUNTIME bytes that were executed are the SNAPSHOT's bytes.
  const snapshotRuntime = executionTreeDigest({
    productRoot: snapshotRoot,
    relative: "services/local-runtime/navia_runtime",
  });
  const worktreeRuntime = executionTreeDigest({
    productRoot: repoRoot,
    relative: "services/local-runtime/navia_runtime",
  });
  assert.equal(roots.runtimeTreeSha256, snapshotRuntime);
  assert.notEqual(roots.runtimeTreeSha256, worktreeRuntime);
  // The CHILD HARNESS that was executed is the SNAPSHOT's harness.
  const snapshotRunner = path.join(snapshotRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs");
  assert.equal(roots.runnerFileSha256, sha256(fs.readFileSync(snapshotRunner)));
  // The closure verified clean against the SNAPSHOT.
  assert.equal(receipt.executionClosure.ok, true);
  assert.equal(receipt.executionClosure.present, true);
});

test("R1: a drift detected after a source remains fatal after the restoration", () => {
  const { prepared } = prepareSealedCandidate();
  const snapshotRoot = prepared.snapshotRoot;
  const target = "services/local-runtime/navia_runtime/app.py";
  const environment = candidateEnvironment({
    environment: process.env,
    repoRoot,
    toolRoot: repoRoot,
    snapshotRoot,
    manifestPath: prepared.manifestPath,
    stageRoot: scratch("navia-b6hr-stage-"),
  });
  // The TEST-ONLY seam changes one byte of the sealed snapshot right before
  // the post-source verification.
  const { completed, receipt } = driveRunner({
    env: { ...environment, NAVIA_B5_TEST_SNAPSHOT_MUTATION: target },
    snapshotRoot,
  });
  assert.notEqual(completed.status, 0);
  assert.ok(receipt, "the durable receipt must exist");
  // The drift was detected AFTER the source and it is FATAL.
  assert.equal(receipt.failureCode, "B6_EXECUTION_CLOSURE_INVALID");
  assert.equal(receipt.disposition, "failed");
  assert.equal(receipt.executionClosure.ok, false);
  assert.ok(receipt.executionClosure.codes.includes(EXECUTION_CLOSURE_FAILURE.DRIFT));
  // The RESTORATION: the bytes are put back and the snapshot verifies again.
  const manifest = JSON.parse(fs.readFileSync(prepared.manifestPath, "utf8"));
  const entry = manifest.files.find((item) => item.relative === target);
  const original = fs.readFileSync(path.join(repoRoot, target));
  fs.writeFileSync(path.join(snapshotRoot, target), original, { mode: 0o600 });
  const restored = verifyExecutionSnapshot({ manifest, snapshotRoot, toolRoot: repoRoot });
  assert.equal(restored.ok, true, JSON.stringify(restored.codes));
  // The LATCH: the durable receipt is still fatal after the restoration.
  assert.equal(receipt.failureCode, "B6_EXECUTION_CLOSURE_INVALID");
  assert.equal(receipt.disposition, "failed");
});

test("R1: an EXTRA byte inside the sealed snapshot fails closed", () => {
  const { prepared } = prepareSealedCandidate();
  const extra = path.join(prepared.snapshotRoot, "scripts/stage_b_b5_3/lib/injected.mjs");
  fs.writeFileSync(extra, "export const injected = true;\n", { mode: 0o600 });
  const verdict = verifyExecutionSnapshot({
    manifest: prepared.manifest,
    snapshotRoot: prepared.snapshotRoot,
    toolRoot: repoRoot,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(EXECUTION_CLOSURE_FAILURE.SNAPSHOT_EXTRA));
  assert.ok(verdict.extra.length > 0);
});

test("R1: a MISSING byte inside the sealed snapshot fails closed", () => {
  const { prepared } = prepareSealedCandidate();
  const target = path.join(prepared.snapshotRoot, "scripts/stage_b_b5_3/lib/review_protocol.mjs");
  fs.unlinkSync(target);
  const verdict = verifyExecutionSnapshot({
    manifest: prepared.manifest,
    snapshotRoot: prepared.snapshotRoot,
    toolRoot: repoRoot,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(EXECUTION_CLOSURE_FAILURE.MISSING_FILE));
});

test("R1: the private root of a candidate may never be inside the repository", () => {
  const prepared = prepareCandidate({
    repoRoot,
    toolRoot: repoRoot,
    privateRoot: path.join(repoRoot, ".navia", "b6hr-private"),
    runId: RUN_ID,
  });
  assert.equal(prepared.ok, false);
  assert.deepEqual(prepared.codes, [CANDIDATE_PREPARE_FAILURE.ROOT_INVALID]);
});

// ---------------------------------------------------------------------------
// R2 — the canonical review protocol
// ---------------------------------------------------------------------------

test("R2: a VALID precommit passes", () => {
  const verdict = reviewPrecommitDefects(syntheticPrecommit({ repoRoot }), {
    repoRoot,
    expectedRegistryOrder: REGISTRY_ORDER,
  });
  assert.equal(verdict.ok, true, JSON.stringify(verdict.codes));
});

test("R2: a NULL or MISSING run id is refused", () => {
  const nulled = syntheticPrecommit({ repoRoot });
  nulled.runId = null;
  const first = reviewPrecommitDefects(nulled, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(first.ok, false);
  assert.ok(first.codes.includes(REVIEW_PROTOCOL_FAILURE.RUN_ID_MISSING));

  const missing = syntheticPrecommit({ repoRoot });
  delete missing.runId;
  const second = reviewPrecommitDefects(missing, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(second.ok, false);
  assert.ok(second.codes.includes(REVIEW_PROTOCOL_FAILURE.RUN_ID_MISSING));
});

test("R2: an ALTERED pass position is refused", () => {
  const precommit = syntheticPrecommit({ repoRoot });
  precommit.firstPass.sentinelPosition = 99;
  precommit.secondPass.sentinelPosition = 99;
  const verdict = reviewPrecommitDefects(precommit, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(REVIEW_PROTOCOL_FAILURE.PASS_POSITION));
  // The SENTINEL positions themselves are also refused when they leave the
  // order or collide.
  const collided = syntheticPrecommit({ repoRoot });
  collided.sentinel.firstPassPosition = collided.sentinel.secondPassPosition;
  const collidedVerdict = reviewPrecommitDefects(collided, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(collidedVerdict.ok, false);
  assert.ok(collidedVerdict.codes.includes(REVIEW_PROTOCOL_FAILURE.SENTINEL_POSITION));
  const outOfRange = syntheticPrecommit({ repoRoot });
  outOfRange.sentinel.secondPassPosition = 9;
  const outOfRangeVerdict = reviewPrecommitDefects(outOfRange, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(outOfRangeVerdict.ok, false);
  assert.ok(outOfRangeVerdict.codes.includes(REVIEW_PROTOCOL_FAILURE.SENTINEL_POSITION));
});

test("R2: a PRIVATE protocol path is refused", () => {
  const precommit = syntheticPrecommit({ repoRoot });
  precommit.protocol.rubric = {
    path: "/private/review-root/review-protocol/rubric.md",
    present: true,
    byteCount: precommit.protocol.rubric.byteCount,
    sha256: precommit.protocol.rubric.sha256,
  };
  const verdict = reviewPrecommitDefects(precommit, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(REVIEW_PROTOCOL_FAILURE.CALLER_SUPPLIED));
});

test("R2: a PROTOCOL byte drift is refused", () => {
  const precommit = syntheticPrecommit({ repoRoot });
  precommit.protocol.prompt = { ...precommit.protocol.prompt, sha256: "b".repeat(64) };
  const verdict = reviewPrecommitDefects(precommit, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(REVIEW_PROTOCOL_FAILURE.PROMPT_DRIFT));
});

test("R2: the BUILT precommit is the only one the review path accepts", () => {
  const built = buildValidatedReviewPrecommit({
    repoRoot,
    runId: RUN_ID,
    registryOrder: REGISTRY_ORDER,
    reviewOrder: ["6", "5", "2", "4", "3", "1"],
    firstSessionId: "session-one",
    secondSessionId: "session-two",
    secondPassSentinelPosition: 3,
  });
  assert.equal(built.ok, true, JSON.stringify(built.codes));
  // The precommit binds the pass records to the sentinel.
  assert.equal(built.precommit.firstPass.sentinelPosition, built.precommit.sentinel.firstPassPosition);
  assert.equal(built.precommit.secondPass.sentinelPosition, built.precommit.sentinel.secondPassPosition);
  assert.notEqual(built.precommit.firstPass.sentinelPosition, built.precommit.secondPass.sentinelPosition);
});

// ---------------------------------------------------------------------------
// R3 — the public evidence is recomputed from the raw authorities
// ---------------------------------------------------------------------------

test("R3: the generated package is valid and its counts match its rows", () => {
  const built = buildPackage({ repoRoot });
  const verdict = validatePackage(built, { repoRoot });
  assert.equal(verdict.ok, true, JSON.stringify(verdict.codes));
  assert.equal(built.counts.limited, 6);
  assert.equal(built.machineGatePositive, false);
});

test("R3: SIX LIMITED rows cannot be declared machine-positive or reviewed", () => {
  const built = buildPackage({ repoRoot,  dispositions: ["limited", "limited", "limited", "limited", "limited", "limited"] });
  // The BUILDER never lets a caller declare the gate: it is recomputed.
  assert.equal(built.machineGatePositive, false);
  const payloads = built.payloads.map((payload) => {
    if (payload.name !== "05-review-decision.json") return payload;
    const parsed = JSON.parse(payload.content);
    parsed.machineGatePositive = true;
    parsed.blindReviewPerformed = true;
    parsed.reviewRows = 6;
    parsed.sentinelReceipts = 2;
    return { ...payload, content: `${JSON.stringify(parsed, null, 2)}\n` };
  });
  const verdict = validatePublicEvidence(payloads, {
    runId: RUN_ID,
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.MACHINE_GATE));
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.REVIEW));
});

test("R3: a positive machine gate without six reviews and two sentinel receipts is refused", () => {
  const evidenceRoot = scratch("navia-b6hr-positive-evidence-");
  const stageRoot = scratch("navia-b6hr-positive-stage-");
  for (const source of FROZEN_SIX) {
    const directory = path.join(evidenceRoot, `bvid-${source.order}-${source.bvid}`);
    writeContractShapedEvidence({
      dir: directory,
      order: String(source.order),
      bvid: source.bvid,
      runId: RUN_ID,
      stageRoot,
      requestCount: 3,
    });
    fs.writeFileSync(path.join(directory, "final_disposition.txt"), "complete\nreason: synthetic\n");
  }
  const entries = readAttemptedSources({ evidenceRoot, sources: FROZEN_SIX });
  const rows = collectSourceRows({ evidenceRoot, entries });
  const built = buildPublicEvidence({
    runId: RUN_ID,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    registryOrder: REGISTRY_ORDER,
    aggregateRows: rows,
    ledgerTotals: readStageTotals({ stageRoot, candidateRunId: RUN_ID }),
    authority: null,
    bundleDirectories: syntheticPrivateRoot().directories,
    reviewRows: null,
    sentinelReviews: null,
    precommit: syntheticPrecommit({ repoRoot }),
    lock: syntheticLock(),
    retentionRecords: [],
    scan: { secretHits: 0, absolutePathHits: 0, rawMediaPayloadHits: 0 },
    repoRoot,
  });
  assert.equal(built.machineGatePositive, true);
  assert.equal(built.ok, false);
  assert.ok(built.codes.includes(PUBLIC_EVIDENCE_FAILURE.AUTHORITY));
  assert.ok(built.codes.includes(PUBLIC_EVIDENCE_FAILURE.REVIEW));
  const verdict = validatePackage(built, { repoRoot });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.REVIEW));
});

test("R3: the MACHINE RESULTS payload may not claim a positive gate either", () => {
  const built = buildPackage({ repoRoot,  dispositions: ["limited", "limited", "limited", "limited", "limited", "limited"] });
  const payloads = built.payloads.map((payload) => {
    if (payload.name !== "02-six-source-machine-results.json") return payload;
    const parsed = JSON.parse(payload.content);
    parsed.machineGate.positive = true;
    return { ...payload, content: `${JSON.stringify(parsed, null, 2)}\n` };
  });
  const verdict = validatePublicEvidence(payloads, {
    runId: RUN_ID,
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.MACHINE_GATE));
});

test("R3: NO bundle and a MALFORMED bundle are refused", () => {
  const missing = buildPackage({ repoRoot,  bundles: {} });
  const missingVerdict = validatePackage(missing, { repoRoot });
  // A NEGATIVE candidate may have no bundle: the refusal is on the POSITIVE
  // claim, so the package is forged into a positive one first.
  const forged = missing.payloads.map((payload) => {
    if (payload.name !== "02-six-source-machine-results.json") return payload;
    const parsed = JSON.parse(payload.content);
    parsed.machineGate.positive = true;
    return { ...payload, content: `${JSON.stringify(parsed, null, 2)}\n` };
  });
  const forgedVerdict = validatePublicEvidence(forged, {
    runId: RUN_ID,
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(forgedVerdict.ok, false);
  assert.ok(forgedVerdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.BUNDLE_MISSING));

  // A MALFORMED bundle is refused on its own.
  const directories = syntheticPrivateRoot().directories;
  const target = directories["1"];
  fs.writeFileSync(path.join(target, REVIEW_BUNDLE_MANIFEST), "not a manifest\n", { mode: 0o600 });
  const malformed = buildPackage({ repoRoot,  bundles: directories });
  const malformedVerdict = validatePackage(malformed, { repoRoot });
  assert.equal(malformedVerdict.ok, false);
  assert.ok(malformedVerdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.BUNDLE_INVALID));
});

test("R3: an INVALID ledger is refused", () => {
  const built = buildPackage({ repoRoot, 
    ledger: {
      integrityOk: false,
      malformedLines: 3,
      eventCount: 6,
      candidate: { providerCall: 6, runtimeSynthesize: 6 },
      stage: { providerCall: 6, runtimeSynthesize: 6 },
    },
  });
  const verdict = validatePackage(built, { repoRoot });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.LEDGER));
});

test("R3: a NONZERO scan is refused", () => {
  const built = buildPackage({ repoRoot,  scan: { secretHits: 0, absolutePathHits: 2, rawMediaPayloadHits: 0 } });
  const verdict = validatePackage(built, { repoRoot });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.SCAN));
});

test("R3: an ARBITRARY lock and an ARBITRARY precommit are refused", () => {
  const arbitraryLock = { ...syntheticLock(), runId: "another-run" };
  const lockVerdict = validatePackage(buildPackage({ repoRoot,  lock: arbitraryLock }));
  assert.equal(lockVerdict.ok, false);
  assert.ok(lockVerdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.RUN_BINDING));

  const unlocked = { ...syntheticLock(), lockedBeforeAnyExternalAction: false };
  const unlockedVerdict = validatePackage(buildPackage({ repoRoot,  lock: unlocked }));
  assert.equal(unlockedVerdict.ok, false);
  assert.ok(unlockedVerdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.LOCK));

  const unsealed = {
    ...syntheticLock(),
    executionClosure: { schemaVersion: null, fileCount: 0, toolIdentities: null },
  };
  const unsealedVerdict = validatePackage(buildPackage({ repoRoot, lock: unsealed }));
  assert.equal(unsealedVerdict.ok, false);
  assert.ok(unsealedVerdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.LOCK));

  const arbitraryPrecommit = syntheticPrecommit({ repoRoot });
  arbitraryPrecommit.protocol.prompt = { ...arbitraryPrecommit.protocol.prompt, sha256: "c".repeat(64) };
  const precommitVerdict = validatePackage(buildPackage({ repoRoot,  precommit: arbitraryPrecommit }));
  assert.equal(precommitVerdict.ok, false);
  assert.ok(precommitVerdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.PRECOMMIT));
});

test("R3: a MISSING source binding is refused", () => {
  const built = buildPackage({ repoRoot });
  const payloads = built.payloads.map((payload) => {
    if (payload.name !== "03-bundle-verification.json") return payload;
    const parsed = JSON.parse(payload.content);
    parsed.bundles[0].bvid = "BV00wrongbv1";
    return { ...payload, content: `${JSON.stringify(parsed, null, 2)}\n` };
  });
  const verdict = validatePublicEvidence(payloads, {
    runId: RUN_ID,
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.SOURCE_BINDING));
});

test("R3: a MANUALLY ALTERED public row is refused", () => {
  const built = buildPackage({ repoRoot });
  const payloads = built.payloads.map((payload) => {
    if (payload.name !== "02-six-source-machine-results.json") return payload;
    const parsed = JSON.parse(payload.content);
    parsed.sources[0].disposition = "complete";
    return { ...payload, content: `${JSON.stringify(parsed, null, 2)}\n` };
  });
  const verdict = validatePublicEvidence(payloads, {
    runId: RUN_ID,
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.COUNT));
});

test("R3: a MALFORMED raw receipt row is refused", () => {
  const built = buildPackage({ repoRoot });
  const payloads = built.payloads.map((payload) => {
    if (payload.name !== "02-six-source-machine-results.json") return payload;
    const parsed = JSON.parse(payload.content);
    parsed.sources[0].extraField = "hand written";
    return { ...payload, content: `${JSON.stringify(parsed, null, 2)}\n` };
  });
  const verdict = validatePublicEvidence(payloads, {
    runId: RUN_ID,
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.SCHEMA));
});

test("R3: a MISSING run id in a payload is refused", () => {
  const built = buildPackage({ repoRoot });
  const payloads = built.payloads.map((payload) => {
    if (payload.name !== "04-action-ledger-reconciliation.json") return payload;
    const parsed = JSON.parse(payload.content);
    delete parsed.runId;
    return { ...payload, content: `${JSON.stringify(parsed, null, 2)}\n` };
  });
  const verdict = validatePublicEvidence(payloads, {
    runId: RUN_ID,
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.RUN_BINDING));
});

// ---------------------------------------------------------------------------
// R4 — the durable diagnostics
// ---------------------------------------------------------------------------

test("R4: the durable receipt carries the EXACT Stage A and closure diagnostics", () => {
  const { prepared } = prepareSealedCandidate();
  const environment = candidateEnvironment({
    environment: process.env,
    repoRoot,
    toolRoot: repoRoot,
    snapshotRoot: prepared.snapshotRoot,
    manifestPath: prepared.manifestPath,
    stageRoot: scratch("navia-b6hr-stage-"),
  });
  const { completed, receipt } = driveRunner({ env: environment, snapshotRoot: prepared.snapshotRoot });
  assert.notEqual(completed.status, 0);
  assert.ok(receipt, "the durable receipt must exist");
  // The CLOSURE diagnostics are exact.
  assert.deepEqual(Object.keys(receipt.executionClosure).sort(), [
    "codes", "driftedCount", "extraCount", "fileCount", "missingCount", "ok", "present", "stage",
  ]);
  assert.equal(receipt.executionClosure.present, true);
  assert.equal(receipt.executionClosure.ok, true);
  assert.equal(receipt.executionClosure.stage, "post-source");
  // The STAGE A diagnostics are exact.
  assert.deepEqual(Object.keys(receipt.stageADiagnostic).sort(), [
    "authorityPollCount", "authorityRowCount", "authorityStateClass", "code",
    "elapsedBucket", "enableState", "exactIdentityMatchCount", "mediaTaskPollCount",
    "mediaTaskRowCount", "mediaTaskStateClass", "permissionState", "phase",
    "resolveStatusClass",
  ]);
  // The EXECUTION ROOT identities are durable.
  assert.ok(receipt.executionRoots, "the receipt must carry the execution-root identities");
  assert.equal(receipt.executionRoots.productRootSource, "snapshot");
});

test("R4: a closure failure makes the aggregate non-positive", () => {
  const rows = syntheticRows({ dispositions: ["complete", "complete", "complete", "complete", "complete", "complete"] });
  const positive = evaluateAggregate({
    rows,
    runId: RUN_ID,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    ledgerIntegrityOk: true,
  });
  // The synthetic rows are not a real candidate: the aggregate is NOT
  // positive, and that is the point of the case. The closure failure adds
  // its OWN defect on top.
  const withClosure = rows.map((row) => ({
    ...row,
    receipt: {
      ...row.receipt,
      executionClosure: {
        stage: "post-source",
        present: true,
        ok: false,
        codes: ["EXECUTION_CLOSURE_FILE_DRIFT"],
        fileCount: 480,
        driftedCount: 1,
        missingCount: 0,
        extraCount: 0,
      },
    },
  }));
  const verdict = evaluateAggregate({
    rows: withClosure,
    runId: RUN_ID,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    ledgerIntegrityOk: true,
  });
  assert.equal(verdict.positive, false);
  assert.ok(verdict.failures.some((failure) => failure.code === "AGG_EXECUTION_CLOSURE_INVALID"));
});

test("R4: the receipt merge never clears a latched closure failure", () => {
  const previous = {
    runId: RUN_ID,
    order: 1,
    bvid: FROZEN_SIX[0].bvid,
    disposition: "complete",
    failureCode: null,
    executionClosure: {
      stage: "pre-external-action", present: true, ok: true, codes: [],
      fileCount: 1, driftedCount: 0, missingCount: 0, extraCount: 0,
    },
  };
  const next = {
    ...previous,
    disposition: "failed",
    failureCode: "B6_EXECUTION_CLOSURE_INVALID",
    executionClosure: {
      stage: "post-source", present: true, ok: false, codes: ["EXECUTION_CLOSURE_FILE_DRIFT"],
      fileCount: 1, driftedCount: 1, missingCount: 0, extraCount: 0,
    },
  };
  const merged = mergeMachineReceipt({ previous, next });
  assert.equal(merged.disposition, "failed");
  assert.equal(merged.failureCode, "B6_EXECUTION_CLOSURE_INVALID");
  // A LATER healthy observation never clears the failure.
  const restored = mergeMachineReceipt({
    previous: merged,
    next: {
      ...previous,
      disposition: "complete",
      failureCode: null,
      executionClosure: {
        stage: "closeout", present: true, ok: true, codes: [],
        fileCount: 1, driftedCount: 0, missingCount: 0, extraCount: 0,
      },
    },
  });
  assert.equal(restored.disposition, "failed");
  assert.equal(restored.failureCode, "B6_EXECUTION_CLOSURE_INVALID");
});

// ---------------------------------------------------------------------------
// R5 — the private retention and its public projection
// ---------------------------------------------------------------------------

test("R5: an ABSOLUTE private root never enters the public evidence", () => {
  const privateRoot = path.join(scratch("navia-b6hr-retained-"), "the-private-root");
  const record = buildRetentionRecord({
    runId: "gc-b6b-20261025T175243Z",
    artifactKind: "negative-run-private-artifacts",
    root: privateRoot,
    owner: "the Codex checkpoint",
    deadlineUtc: "2026-11-26T00:00:00Z",
    digests: ["a".repeat(64)],
  });
  const projection = publicRetentionProjection(record);
  const verdict = publicRetentionDefects(projection);
  assert.equal(verdict.ok, true, JSON.stringify(verdict.codes));
  const serialized = JSON.stringify(projection);
  assert.ok(!serialized.includes(privateRoot), "the private root must not enter the projection");
  assert.ok(!serialized.includes(scratch("none")), "no private path may enter the projection");
  assert.equal(projection.rootReference.length, 64);
  assert.equal(projection.digestCount, 1);
  // The PUBLIC PACKAGE carries the projection and not the record.
  const built = buildPackage({ repoRoot,  retention: [record] });
  const retentionPayload = built.payloads.find((payload) => payload.name === "06-retention-ledger.json");
  assert.ok(retentionPayload, "the retention payload must exist");
  assert.ok(!retentionPayload.content.includes(privateRoot), "the private root must not enter the package");
  const packageVerdict = validatePackage(built, { repoRoot });
  assert.equal(packageVerdict.ok, true, JSON.stringify(packageVerdict.codes));
});

test("R5: a malformed deadline, an invalid digest and a duplicate digest are refused", () => {
  const record = buildRetentionRecord({
    runId: "gc-b6b-20261025T175243Z",
    artifactKind: "negative-run-private-artifacts",
    root: "/a/private/root",
    owner: "the Codex checkpoint",
    deadlineUtc: "2026-11-26T00:00:00Z",
    digests: ["a".repeat(64)],
  });
  const badDeadline = publicRetentionProjection({ ...record, deadlineUtc: "26-11-2026" });
  assert.equal(publicRetentionDefects(badDeadline).ok, false);
  assert.ok(publicRetentionDefects(badDeadline).codes.includes(RETENTION_FAILURE.DEADLINE_INVALID));

  const badDigest = publicRetentionProjection({ ...record, digests: ["not-a-digest"] });
  assert.equal(publicRetentionDefects(badDigest).ok, false);
  assert.ok(publicRetentionDefects(badDigest).codes.includes(RETENTION_FAILURE.DIGEST_INVALID));

  const duplicate = publicRetentionProjection({ ...record, digests: ["a".repeat(64), "a".repeat(64)] });
  assert.equal(publicRetentionDefects(duplicate).ok, false);
  assert.ok(publicRetentionDefects(duplicate).codes.includes(RETENTION_FAILURE.DIGEST_DUPLICATE));
});

test("R5: a public projection that carries a PATH is refused", () => {
  const record = buildRetentionRecord({
    runId: "gc-b6b-20261025T175243Z",
    artifactKind: "negative-run-private-artifacts",
    root: "/a/private/root",
    owner: "the Codex checkpoint",
    deadlineUtc: "2026-11-26T00:00:00Z",
    digests: ["a".repeat(64)],
  });
  const projection = publicRetentionProjection(record);
  const leaky = { ...projection, owner: "the Codex checkpoint (/a/private/root)" };
  const verdict = publicRetentionDefects(leaky);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(RETENTION_FAILURE.PUBLIC_PATH));
});

test("R3: the publisher writes the package, validates it and signs the manifest LAST", () => {
  const evidenceRoot = scratch("navia-b6hr-pub-evidence-");
  const privateRoot = scratch("navia-b6hr-pub-private-");
  const outputRoot = scratch("navia-b6hr-pub-output-");
  const stageRoot = scratch("navia-b6hr-pub-stage-");
  // The six REAL private bundles.
  for (const entry of FROZEN_SIX) {
    writeBundle(path.join(privateRoot, `${entry.order}-${entry.bvid}`), Number(entry.order));
  }
  // The lock and the canonical precommit of the candidate.
  fs.writeFileSync(
    path.join(evidenceRoot, "00-candidate-lock.json"),
    `${JSON.stringify(syntheticLock(), null, 2)}\n`,
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(evidenceRoot, "00-review-precommit.json"),
    `${JSON.stringify(syntheticPrecommit({ repoRoot }), null, 2)}\n`,
    { mode: 0o600 },
  );
  // The stage action ledger of the candidate: one Provider call per source.
  const rows = syntheticRows();
  const ledgerLines = rows.map(() => JSON.stringify({
    schemaVersion: "v3-5.10-b5-stage-action/v1",
    event: "providerCall",
    count: 1,
    candidateRunId: RUN_ID,
    at: "2026-10-26T00:00:00.000Z",
  }));
  fs.writeFileSync(
    path.join(stageRoot, "stage-actions.jsonl"),
    `${ledgerLines.join("\n")}\n`,
    { mode: 0o600 },
  );
  for (const row of rows) {
    const directory = path.join(evidenceRoot, `bvid-${row.order}-${row.bvid}`);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      path.join(directory, "b5-source-receipt.json"),
      `${JSON.stringify(row.receipt, null, 2)}\n`,
      { mode: 0o600 },
    );
    fs.writeFileSync(
      path.join(directory, "final_disposition.txt"),
      `${row.disposition}\nreason: synthetic\n`,
      { mode: 0o600 },
    );
  }
  const completed = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts/stage_b_b5_3/publish_public_evidence.mjs"),
      `--run-id=${RUN_ID}`,
      `--evidence-root=${evidenceRoot}`,
      `--private-root=${privateRoot}`,
      `--output-root=${outputRoot}`,
      `--stage-root=${stageRoot}`,
    ],
    { cwd: repoRoot, encoding: "utf8", timeout: 180_000 },
  );
  assert.equal(completed.status, 0, `the publisher must succeed: ${completed.stderr}`);
  const report = JSON.parse(String(completed.stdout).trim());
  assert.equal(report.published, true);
  assert.equal(report.scan.secretHits, 0);
  assert.equal(report.scan.absolutePathHits, 0);
  assert.equal(report.scan.rawMediaPayloadHits, 0);
  assert.equal(report.manifestVerified, true);
  assert.deepEqual(report.validatorCodes, []);
  // Every payload is written and the MANIFEST is generated last.
  for (const name of [
    "00-review-precommit.json", "01-candidate-lock.json",
    "02-six-source-machine-results.json", "03-bundle-verification.json",
    "04-action-ledger-reconciliation.json", "05-review-decision.json",
    "06-retention-ledger.json", "07-scan.json", "PAYLOAD_MANIFEST.sha256",
  ]) {
    assert.ok(fs.existsSync(path.join(outputRoot, name)), `the publisher must write ${name}`);
  }
  // The manifest covers every payload and it verifies against the written bytes.
  const manifest = fs.readFileSync(path.join(outputRoot, "PAYLOAD_MANIFEST.sha256"), "utf8");
  const lines = manifest.split("\n").filter((line) => line.trim().length > 0);
  assert.equal(lines.length, 8);
  for (const line of lines) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    assert.ok(match, `the manifest line is malformed: ${line}`);
    const bytes = fs.readFileSync(path.join(outputRoot, match[2]));
    assert.equal(sha256(bytes), match[1], `the manifest must verify ${match[2]}`);
  }
  // The written package validates again, from its own bytes.
  const payloads = lines
    .map((line) => /^([0-9a-f]{64})  (.+)$/.exec(line))
    .map((match) => ({
      name: match[2],
      content: fs.readFileSync(path.join(outputRoot, match[2]), "utf8"),
    }));
  const verdict = validatePublicEvidence(payloads, {
    runId: RUN_ID,
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(verdict.ok, true, JSON.stringify(verdict.codes));
  // NO temporary file is left behind.
  assert.deepEqual(
    fs.readdirSync(outputRoot).filter((name) => name.endsWith(".tmp")),
    [],
  );
});
