// RC3 — the ACTUAL outbound Provider HTTP attempts.
//
// Three facts are SEPARATED:
//
//   1. the Runtime synthesize ENDPOINT invocation (one per call),
//   2. the ACTUAL outbound Provider HTTP attempts (timeouts, retries,
//      regenerations and a terminal rejection included),
//   3. the successful publication and its receipt request count.
//
// The stage ledger's `providerCall` total must equal the ACTUAL outbound
// Provider HTTP attempts, NOT one per synthesize endpoint invocation.
//
// The count is owned by the Runtime: the published receipt on the success
// path and the Runtime's INTERNAL diagnostic on the failure path. No public
// endpoint is added and no response text, prompt, evidence id, path or
// secret ever reaches the evidence.
//
// No Chrome, no real Runtime, no Provider call, no download, no import, no
// media task and no Cookie read happen here: the Runtime is a local double
// and the Cookie file is synthetic.

import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

import fs from "node:fs";
import path from "node:path";

import { isRealPublication } from "../lib/audit_finalizer.mjs";
import {
  BVID,
  driveRunner,
  ledgerTotals,
} from "./_fixtures/attempt_harness.mjs";

test("RC3: a successful synthesis records the ACTUAL outbound Provider attempts", async () => {
  const { completed, receipt, ledger, evidenceRoot } = await driveRunner({ mode: "published", requestCount: 3 });
  assert.equal(completed.status, 0, `the runner must succeed: ${completed.stderr}`);
  // The ledger separates the endpoint invocation from the Provider attempts.
  assert.equal(ledger.byEvent.runtimeSynthesize, 1, "one Runtime synthesize endpoint invocation");
  assert.equal(ledger.byEvent.providerCall, 3, "three ACTUAL outbound Provider attempts");
  // The receipt separates the same facts.
  assert.equal(receipt.provider.attempted.attemptCount, 1, "the endpoint invocation count");
  assert.equal(receipt.provider.attempted.requestCount, 3, "the outbound Provider attempt count");
  assert.equal(receipt.provider.published.requestCount, 3, "the published receipt request count");
  assert.equal(receipt.disposition, "complete");
  // The publication of the REAL runner carries the FULL internal shape, and
  // the MIRROR carries the frozen V2.1 receipt identity.
  assert.equal(isRealPublication(receipt.provider.published), true,
    `the publication is not contract-shaped: ${JSON.stringify(receipt.provider.published)}`);
  const mirror = JSON.parse(fs.readFileSync(
    path.join(evidenceRoot, `bvid-1-${BVID}`, "receipt.json"),
    "utf8",
  ));
  assert.equal(mirror.published, true);
  assert.equal(mirror.receipt.providerId, "minimax-cn-openai-vision");
  assert.equal(mirror.receipt.endpointClass, "minimax_chat_completions");
  assert.equal(mirror.receipt.requestCount, 3);
  assert.equal(mirror.taskId, receipt.taskId);
  assert.equal(mirror.derivativeSha256, receipt.derivativeSha256);
});

test("RC3: a successful synthesis with ONE request records ONE attempt", async () => {
  const { completed, receipt, ledger } = await driveRunner({ mode: "published", requestCount: 1 });
  assert.equal(completed.status, 0, completed.stderr);
  assert.equal(ledger.byEvent.runtimeSynthesize, 1);
  assert.equal(ledger.byEvent.providerCall, 1);
  assert.equal(receipt.provider.attempted.requestCount, 1);
  assert.equal(receipt.provider.published.requestCount, 1);
});

test("RC3: a REJECTED synthesis records the ACTUAL attempts and publishes nothing", async () => {
  const { completed, receipt, ledger } = await driveRunner({ mode: "rejected", requestCount: 3 });
  assert.notEqual(completed.status, 0, "a rejected synthesis must exit non-zero");
  assert.equal(ledger.byEvent.runtimeSynthesize, 1, "one Runtime synthesize endpoint invocation");
  assert.equal(ledger.byEvent.providerCall, 3, "three ACTUAL outbound Provider attempts");
  assert.equal(receipt.provider.attempted.requestCount, 3);
  // The publication stays null on failure.
  assert.equal(receipt.provider.published, null);
  assert.equal(receipt.disposition, "failed");
});

test("RC3: a REJECTED synthesis at the request cap records EIGHT attempts", async () => {
  const { completed, receipt, ledger } = await driveRunner({ mode: "rejected", requestCount: 8 });
  assert.notEqual(completed.status, 0);
  assert.equal(ledger.byEvent.runtimeSynthesize, 1);
  assert.equal(ledger.byEvent.providerCall, 8, "the hard cap of eight outbound attempts");
  assert.equal(receipt.provider.attempted.requestCount, 8);
  assert.equal(receipt.provider.published, null);
});

test("RC3: the candidate and the stage totals are EXACT and are not double counted", async () => {
  const { ledger, stageRoot } = await driveRunner({ mode: "rejected", requestCount: 3 });
  // The candidate total and the stage total are the same numbers here: one
  // candidate run in a fresh stage root.
  const totals = ledgerTotals(stageRoot);
  const candidate = totals.events.filter((event) => event.candidateRunId === "rc3-run");
  const candidateProviderCalls = candidate
    .filter((event) => event.event === "providerCall")
    .reduce((total, event) => total + event.count, 0);
  assert.equal(candidateProviderCalls, 3);
  assert.equal(totals.byEvent.providerCall, 3);
  // Exactly ONE providerCall line: the count is a count, not a line per
  // attempt, and nothing is counted twice.
  assert.equal(totals.events.filter((event) => event.event === "providerCall").length, 1);
});
