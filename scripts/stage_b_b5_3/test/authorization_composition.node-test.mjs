// The BATCH-OWNED, ATOMIC, ONE-SHOT visible authorization (RC1).
//
// The SEQUENCER owns the authorization: it consumes it once for the complete
// six-source candidate and issues the durable child grants. A child only
// VERIFIES (and consumes) its grant.
//
// THE AUTHORITY IS THE CONSUMPTION MARKER: it is created once, atomically,
// and it holds the authoritative copy of every child grant's id and digest.
// A grant's OWN digest is self-computed and unkeyed, so it is never an
// authority on its own: a forged, self-signed grant is refused.
//
// These tests never launch Chrome, never start a Runtime, never call a
// Provider and never read a Cookie: the sequencer is driven against a STUB
// runner and the child is driven with the test-only fault seam.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  AUTHORIZATION_REFUSAL,
  authorizationDigest,
  childGrantId,
  consumeAuthorization,
  grantDigest,
  verifyChildGrant,
} from "../lib/authorization.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "../lib/registry.mjs";
import { createSequencerCopy } from "../lib/sequencer_copy.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const sequencerPath = path.join(repoRoot, "scripts/stage_b_b5_3/sequencer.mjs");
const runnerPath = path.join(repoRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs");

const IDENTITIES = FROZEN_SIX.map((entry) => ({ order: entry.order, bvid: entry.bvid }));

function makeStageRoot() {
  return makeTempRoot("navia-b5-auth-");
}

/** The STUB runner: it records its argv and writes the complete audit set. */
function stubRunnerPath() {
  return path.join(__dirname, "_fixtures", "grant_stub_runner.mjs");
}

/**
 * A sequencer copy that points at the stub runner.
 *
 * The copy lives in a UNIQUE, OWNED temporary directory and it is deleted
 * when the test finishes: no generated artefact lands in the repository.
 */
function writeAlternateSequencer({ runnerAbsPath }) {
  return createSequencerCopy({
    repoRoot,
    sequencerPath,
    runnerAbsPath,
    prefix: "navia-b5-authseq-",
  });
}

function runSequencer({ alt, stageRoot, evidenceRoot, authorizationId, runId = "grant-run" }) {
  return spawnSync("node", [alt.path, `--run-id=${runId}`, `--evidence-root=${evidenceRoot}`], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NAVIA_B5_STAGE_ROOT: stageRoot,
      NAVIA_B5_AUTHORIZATION_ID: authorizationId,
      NAVIA_CHROME_MUTE_AUDIO: "1",
    },
    timeout: 120_000,
  });
}

/** Run the REAL runner as a child of the sequencer. */
function runChild({
  stageRoot,
  evidenceRoot,
  grantId,
  digest,
  order = "1",
  bvid = IDENTITIES[0].bvid,
  runId = "rc1-child",
}) {
  const argv = [
    runnerPath,
    `--order=${order}`,
    `--bvid=${bvid}`,
    `--run-id=${runId}`,
    `--evidence-root=${evidenceRoot}`,
  ];
  if (grantId) argv.push(`--grant-id=${grantId}`);
  if (digest) argv.push(`--authorization-digest=${digest}`);
  return spawnSync("node", argv, {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NAVIA_B5_STAGE_ROOT: stageRoot,
      // The Cookie file NEVER exists in these tests: a refusal must happen
      // before it is read.
      NAVIA_BILIBILI_COOKIE_FILE: path.join(evidenceRoot, "no-cookie-file.txt"),
    },
    timeout: 120_000,
  });
}

/** The ledger events of a stage root. */
function ledgerEvents(stageRoot) {
  const file = path.join(stageRoot, "stage-actions.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

/**
 * Assert that a refused child performed NO external action at all.
 *
 * Zero Cookie read, zero Chrome launch, zero Runtime start and zero ledger
 * external action.
 */
function assertNoExternalAction(completed, {
  stageRoot,
  evidenceRoot,
  order = "1",
  bvid = IDENTITIES[0].bvid,
  expectedLedgerEvents = 0,
}) {
  assert.notEqual(completed.status, 0, "a refused child must exit non-zero");
  const output = `${completed.stdout}${completed.stderr}`;
  assert.ok(!output.includes("authorized cookies"), "no Cookie may be read");
  assert.ok(!output.includes("Chrome launched"), "no Chrome may be launched");
  assert.ok(!output.includes("Runtime ready on port"), "no Runtime may be started");
  assert.equal(
    ledgerEvents(stageRoot).length,
    expectedLedgerEvents,
    "a refused child records no action",
  );
  const directory = path.join(evidenceRoot, `bvid-${order}-${bvid}`);
  const receipt = JSON.parse(fs.readFileSync(
    path.join(directory, "b5-source-receipt.json"),
    "utf8",
  ));
  assert.equal(receipt.cookieInjectionCount, 0);
  assert.equal(receipt.muteAudioVerified, false);
  assert.equal(receipt.provider.attempted.attemptCount, 0);
  assert.equal(receipt.provider.published, null);
  assert.equal(receipt.disposition, "failed");
  assert.equal(receipt.failureCode, "VISIBLE_AUTHORIZATION_REFUSED");
  // The exact refusal reason is durable.
  const dispositionText = fs.readFileSync(path.join(directory, "final_disposition.txt"), "utf8");
  const reason = (dispositionText.match(/^reason:\s*(.+)$/m) ?? [])[1] ?? "";
  assert.match(reason, /^visible_authorization_refused_/);
  return { ...receipt, refusalReason: reason };
}

test("RC1: one sequencer authorization permits exactly the six expected children", () => {
  const stageRoot = makeStageRoot();
  const evidenceRoot = makeTempRoot("navia-b5-auth-ev-");
  const alt = writeAlternateSequencer({ runnerAbsPath: stubRunnerPath() });
  try {
    const completed = runSequencer({
      alt,
      stageRoot,
      evidenceRoot,
      authorizationId: "fc1-six-children",
    });
    assert.equal(completed.status, 0, completed.stderr);
    for (const identity of IDENTITIES) {
      const recorded = JSON.parse(fs.readFileSync(
        path.join(evidenceRoot, `bvid-${identity.order}-${identity.bvid}`, "stub-argv.json"),
        "utf8",
      ));
      assert.equal(recorded.order, identity.order);
      assert.equal(recorded.bvid, identity.bvid);
      assert.ok(recorded.grantId, "the child must receive its grant");
      assert.equal(recorded.authorizationDigest, authorizationDigest("fc1-six-children"));
    }
  } finally {
    alt.dispose();
  }
});

test("RC1: a second sequencer with the same authorization is refused before Chrome", () => {
  const stageRoot = makeStageRoot();
  const alt = writeAlternateSequencer({ runnerAbsPath: stubRunnerPath() });
  try {
    const first = runSequencer({
      alt,
      stageRoot,
      evidenceRoot: makeTempRoot("navia-b5-auth-ev-"),
      authorizationId: "fc1-single-use",
    });
    assert.equal(first.status, 0, first.stderr);
    const second = runSequencer({
      alt,
      stageRoot,
      evidenceRoot: makeTempRoot("navia-b5-auth-ev-"),
      authorizationId: "fc1-single-use",
    });
    assert.notEqual(second.status, 0, "the second sequencer must be refused");
    assert.match(second.stdout + second.stderr, /authorization_already_consumed/);
  } finally {
    alt.dispose();
  }
});

test("RC1: two concurrent sequencers produce exactly one winner", () => {
  const stageRoot = makeStageRoot();
  const alt = writeAlternateSequencer({ runnerAbsPath: stubRunnerPath() });
  const run = () => new Promise((resolve) => {
    const child = spawn("node", [
      alt.path,
      "--run-id=fc1-race",
      `--evidence-root=${makeTempRoot("navia-b5-auth-ev-")}`,
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NAVIA_B5_STAGE_ROOT: stageRoot,
        NAVIA_B5_AUTHORIZATION_ID: "fc1-race",
        NAVIA_CHROME_MUTE_AUDIO: "1",
      },
    });
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { out += chunk; });
    child.on("exit", (code) => resolve({ code, out }));
  });
  return Promise.all([run(), run()]).then(([first, second]) => {
    alt.dispose();
    const winners = [first, second].filter((result) => result.code === 0);
    const losers = [first, second].filter((result) => result.code !== 0);
    assert.equal(winners.length, 1, "exactly one sequencer may win");
    assert.equal(losers.length, 1);
    assert.match(losers[0].out, /authorization_already_consumed/);
  });
});

test("RC1: a missing authorization refuses the sequencer before any child", () => {
  const stageRoot = makeStageRoot();
  const alt = writeAlternateSequencer({ runnerAbsPath: stubRunnerPath() });
  try {
    const completed = spawnSync("node", [
      alt.path,
      "--run-id=fc1-missing",
      `--evidence-root=${makeTempRoot("navia-b5-auth-ev-")}`,
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, NAVIA_B5_STAGE_ROOT: stageRoot, NAVIA_CHROME_MUTE_AUDIO: "1" },
      timeout: 120_000,
    });
    assert.notEqual(completed.status, 0);
    assert.match(completed.stdout + completed.stderr, /authorization_missing/);
  } finally {
    alt.dispose();
  }
});

test("RC1: a corrupt authorization state fails closed", () => {
  const stageRoot = makeStageRoot();
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "fc1-corrupt",
    runId: "fc1-corrupt",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: IDENTITIES,
  });
  assert.equal(consumed.ok, true);
  // Corrupt the consumed marker: it must never authorize a second run.
  const marker = path.join(stageRoot, "authorizations", `${consumed.digest}.consumed`);
  fs.writeFileSync(marker, "{not json", { mode: 0o600 });
  const second = consumeAuthorization({
    stageRoot,
    authorizationId: "fc1-corrupt",
    runId: "fc1-corrupt",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: IDENTITIES,
  });
  assert.equal(second.ok, false);
  assert.equal(second.reason, AUTHORIZATION_REFUSAL.ALREADY_CONSUMED);
});

test("RC1: the raw authorization value is never persisted", () => {
  const stageRoot = makeStageRoot();
  const secret = "fc1-raw-authorization-value";
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: secret,
    runId: "fc1-raw",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: IDENTITIES,
  });
  assert.equal(consumed.ok, true);
  const found = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (fs.readFileSync(target, "utf8").includes(secret)) found.push(entry.name);
    }
  };
  walk(stageRoot);
  assert.deepEqual(found, [], "the raw authorization must never be persisted");
  // The digest IS persisted: it is the one-way key.
  assert.ok(fs.existsSync(path.join(stageRoot, "authorizations", `${consumed.digest}.consumed`)));
});

test("RC1: a substituted, reordered, stale or cross-run grant is refused", () => {
  const stageRoot = makeStageRoot();
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "fc1-tamper",
    runId: "fc1-tamper-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: IDENTITIES,
  });
  assert.equal(consumed.ok, true);
  const grant = consumed.grants.find((item) => item.order === "1");
  const grantPath = path.join(stageRoot, "grants", `${grant.grantId}.grant.json`);
  const original = JSON.parse(fs.readFileSync(grantPath, "utf8"));

  const base = {
    stageRoot,
    grantId: grant.grantId,
    authorizationDigest: consumed.digest,
    runId: "fc1-tamper-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    order: "1",
    bvid: IDENTITIES[0].bvid,
    identities: IDENTITIES,
  };
  assert.equal(verifyChildGrant(base).ok, true);

  // A SUBSTITUTED identity.
  const substituted = verifyChildGrant({ ...base, bvid: IDENTITIES[1].bvid });
  assert.equal(substituted.ok, false);
  assert.equal(substituted.reason, AUTHORIZATION_REFUSAL.GRANT_ORDER_MISMATCH);

  // A REORDERED identity set.
  const reordered = verifyChildGrant({
    ...base,
    identities: [...IDENTITIES].reverse(),
  });
  assert.equal(reordered.ok, false);
  assert.equal(reordered.reason, AUTHORIZATION_REFUSAL.GRANT_IDENTITY_MISMATCH);

  // A STALE run id.
  const stale = verifyChildGrant({ ...base, runId: "another-run" });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, AUTHORIZATION_REFUSAL.MARKER_RUN_MISMATCH);

  // A CROSS-RUN registry digest.
  const crossRun = verifyChildGrant({ ...base, registrySha256: "0".repeat(64) });
  assert.equal(crossRun.ok, false);
  assert.equal(crossRun.reason, AUTHORIZATION_REFUSAL.MARKER_REGISTRY_MISMATCH);

  // A TAMPERED grant body: the createdAt is not part of the checked facts,
  // so the digest must catch it.
  fs.writeFileSync(grantPath, JSON.stringify({ ...original, createdAt: "1999-01-01T00:00:00.000Z" }), { mode: 0o600 });
  const tampered = verifyChildGrant(base);
  assert.equal(tampered.ok, false);
  assert.equal(tampered.reason, AUTHORIZATION_REFUSAL.GRANT_DIGEST_MISMATCH);

  // A TAMPERED identity inside the grant body: the digest catches it first.
  fs.writeFileSync(grantPath, JSON.stringify({ ...original, bvid: "BV1TAMPERED" }), { mode: 0o600 });
  const substitutedBody = verifyChildGrant(base);
  assert.equal(substitutedBody.ok, false);
  assert.equal(substitutedBody.reason, AUTHORIZATION_REFUSAL.GRANT_ORDER_MISMATCH);
});

test("RC1: a directly invoked child without a grant performs no external action", () => {
  const stageRoot = makeStageRoot();
  const evidenceRoot = makeTempRoot("navia-b5-auth-ev-");
  const completed = runChild({ stageRoot, evidenceRoot });
  assertNoExternalAction(completed, { stageRoot, evidenceRoot });
});

// ---------------------------------------------------------------------------
// RC1 — the grant is AUTHORITATIVE and ONE-USE.
// ---------------------------------------------------------------------------

test("RC1: an entirely forged, self-signed grant is refused", () => {
  const stageRoot = makeStageRoot();
  const evidenceRoot = makeTempRoot("navia-b5-auth-ev-");
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "rc1-forged",
    runId: "rc1-forged-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: IDENTITIES,
  });
  assert.equal(consumed.ok, true);
  const grant = consumed.grants.find((item) => item.order === "1");
  const grantPath = path.join(stageRoot, "grants", `${grant.grantId}.grant.json`);
  const original = JSON.parse(fs.readFileSync(grantPath, "utf8"));
  // The forger keeps every BOUND field and tampers with one unbound field,
  // then recomputes the grant's OWN digest: a self-signed forgery.
  const forged = { ...original, createdAt: "1999-01-01T00:00:00.000Z" };
  forged.grantDigest = grantDigest(forged);
  assert.notEqual(forged.grantDigest, original.grantDigest);
  fs.writeFileSync(grantPath, JSON.stringify(forged), { mode: 0o600 });

  const completed = runChild({
    stageRoot,
    evidenceRoot,
    grantId: grant.grantId,
    digest: consumed.digest,
    runId: "rc1-forged-run",
  });
  const receipt = assertNoExternalAction(completed, { stageRoot, evidenceRoot });
  assert.match(receipt.refusalReason, /child_grant_digest_mismatch/);
});

test("RC1: a grant under an arbitrary file name is refused", () => {
  const stageRoot = makeStageRoot();
  const evidenceRoot = makeTempRoot("navia-b5-auth-ev-");
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "rc1-arbitrary-name",
    runId: "rc1-arbitrary-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: IDENTITIES,
  });
  const grant = consumed.grants.find((item) => item.order === "1");
  const arbitraryId = "f".repeat(32);
  const original = fs.readFileSync(
    path.join(stageRoot, "grants", `${grant.grantId}.grant.json`),
    "utf8",
  );
  fs.writeFileSync(
    path.join(stageRoot, "grants", `${arbitraryId}.grant.json`),
    original,
    { mode: 0o600 },
  );
  const completed = runChild({
    stageRoot,
    evidenceRoot,
    grantId: arbitraryId,
    digest: consumed.digest,
    runId: "rc1-arbitrary-run",
  });
  const receipt = assertNoExternalAction(completed, { stageRoot, evidenceRoot });
  assert.match(receipt.refusalReason, /child_grant_filename_mismatch/);
});

test("RC1: an absent consumption marker is refused", () => {
  const stageRoot = makeStageRoot();
  const evidenceRoot = makeTempRoot("navia-b5-auth-ev-");
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "rc1-absent-marker",
    runId: "rc1-absent-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: IDENTITIES,
  });
  const grant = consumed.grants.find((item) => item.order === "1");
  fs.rmSync(path.join(stageRoot, "authorizations", `${consumed.digest}.consumed`), { force: true });
  const completed = runChild({
    stageRoot,
    evidenceRoot,
    grantId: grant.grantId,
    digest: consumed.digest,
    runId: "rc1-absent-run",
  });
  const receipt = assertNoExternalAction(completed, { stageRoot, evidenceRoot });
  assert.match(receipt.refusalReason, /authorization_marker_missing/);
});

test("RC1: a mismatched consumption marker is refused", () => {
  const stageRoot = makeStageRoot();
  const evidenceRoot = makeTempRoot("navia-b5-auth-ev-");
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "rc1-mismatched-marker",
    runId: "rc1-mismatched-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: IDENTITIES,
  });
  const grant = consumed.grants.find((item) => item.order === "1");
  const markerPath = path.join(stageRoot, "authorizations", `${consumed.digest}.consumed`);
  const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  // The marker no longer carries the digest the sequencer supplied.
  fs.writeFileSync(
    markerPath,
    JSON.stringify({ ...marker, authorizationDigest: "0".repeat(64) }),
    { mode: 0o600 },
  );
  const completed = runChild({
    stageRoot,
    evidenceRoot,
    grantId: grant.grantId,
    digest: consumed.digest,
    runId: "rc1-mismatched-run",
  });
  const receipt = assertNoExternalAction(completed, { stageRoot, evidenceRoot });
  assert.match(receipt.refusalReason, /authorization_marker_digest_mismatch/);
});

test("RC1: a mismatched authorization digest is refused", () => {
  const stageRoot = makeStageRoot();
  const evidenceRoot = makeTempRoot("navia-b5-auth-ev-");
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "rc1-mismatched-digest",
    runId: "rc1-digest-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: IDENTITIES,
  });
  const grant = consumed.grants.find((item) => item.order === "1");
  const completed = runChild({
    stageRoot,
    evidenceRoot,
    grantId: grant.grantId,
    digest: "0".repeat(64),
    runId: "rc1-digest-run",
  });
  const receipt = assertNoExternalAction(completed, { stageRoot, evidenceRoot });
  assert.match(receipt.refusalReason, /authorization_marker_missing/);
  // The legitimate grant is still intact and was NOT consumed.
  const verified = verifyChildGrant({
    stageRoot,
    grantId: grant.grantId,
    authorizationDigest: consumed.digest,
    runId: "rc1-digest-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    order: "1",
    bvid: IDENTITIES[0].bvid,
    identities: IDENTITIES,
  });
  assert.equal(verified.ok, true, verified.reason ?? "");
});

test("RC1: a second use of a valid child grant is refused", () => {
  const stageRoot = makeStageRoot();
  const evidenceRoot = makeTempRoot("navia-b5-auth-ev-");
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "rc1-replay",
    runId: "rc1-replay-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: IDENTITIES,
  });
  const grant = consumed.grants.find((item) => item.order === "1");
  const invoke = () => runChild({
    stageRoot,
    evidenceRoot,
    grantId: grant.grantId,
    digest: consumed.digest,
    runId: "rc1-replay-run",
  });
  // The FIRST use consumes the grant. It then fails on the (absent) Cookie
  // file, which is AFTER the grant check and BEFORE any external action.
  const first = invoke();
  assert.notEqual(first.status, 0);
  assert.doesNotMatch(first.stdout + first.stderr, /visible_authorization_refused_/);
  const afterFirst = ledgerEvents(stageRoot);
  assert.equal(afterFirst.length, 1, "only the source attempt is recorded");
  assert.equal(afterFirst[0].event, "sourceAttempt");

  // The SECOND use is refused BEFORE any action.
  const second = invoke();
  const receipt = assertNoExternalAction(second, { stageRoot, evidenceRoot, expectedLedgerEvents: 1 });
  assert.match(receipt.refusalReason, /child_grant_already_used/);
  // The ledger did not grow.
  assert.equal(ledgerEvents(stageRoot).length, 1, "a replay records no action");
});

test("RC1: the grant id and the digest are one-way", () => {
  const id = childGrantId({
    authorizationDigest: authorizationDigest("x"),
    runId: "r",
    order: "1",
    bvid: "BV1TEST00001",
  });
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.ok(!id.includes("x"));
  const grant = {
    schemaVersion: "v3-5.10-b5-child-grant/v2",
    authorizationDigest: authorizationDigest("x"),
    runId: "r",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    order: "1",
    bvid: "BV1TEST00001",
    identities: IDENTITIES,
  };
  assert.match(grantDigest(grant), /^[0-9a-f]{64}$/);
});
