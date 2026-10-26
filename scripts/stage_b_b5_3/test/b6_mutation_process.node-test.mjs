// B6A — the PROCESS-LEVEL mutation matrix of the bundle closure.
//
// Every case is a SEPARATE PROCESS: the mutation is applied to a REAL bundle
// and the PRODUCTION validator decides. The exit code and the stable
// failure codes are the oracle.
//
// The four CODEX REPRODUCTIONS of the bundle defect classes are part of the
// matrix: the foreign adapter, the stale revision, the detached manifest
// bytes, the false closure flags and the wrong counts/hashes.
//
// No Chrome, no Runtime, no Provider, no download, no Cookie.

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { REVIEW_BUNDLE_FAILURE } from "../lib/review_bundle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(__dirname, "_fixtures/b6_mutation_runner.mjs");

/**
 * Run ONE mutation in a separate process.
 *
 * @returns {{status: number, payload: object}}
 */
function runMutation(name) {
  const result = spawnSync(process.execPath, [runner, name], { encoding: "utf8" });
  assert.equal(result.status, result.status, "the mutation runner must exit");
  const line = String(result.stdout ?? "").trim().split("\n").filter(Boolean).pop() ?? "{}";
  return { status: result.status, payload: JSON.parse(line) };
}

/** The mutation must be REFUSED with the expected stable code. */
function assertRefused(name, expectedCode) {
  const { status, payload } = runMutation(name);
  assert.equal(status, 0, `the mutation ${name} must be refused: ${JSON.stringify(payload)}`);
  assert.equal(payload.ok, false, `the mutation ${name} must not pass`);
  assert.ok(
    (payload.codes ?? []).includes(expectedCode),
    `the mutation ${name} must carry ${expectedCode}, got ${JSON.stringify(payload.codes)}`,
  );
}

test("B6 process: the positive control is ACCEPTED by the production validator", () => {
  const { status, payload } = runMutation("none");
  assert.equal(status, 3, `the control must be accepted: ${JSON.stringify(payload)}`);
  assert.equal(payload.ok, true, JSON.stringify(payload));
  assert.deepEqual(payload.codes, []);
});

test("B6 process: a FOREIGN adapter is refused (the strict identity grammar)", () => {
  assertRefused("foreign-adapter", REVIEW_BUNDLE_FAILURE.IDENTITY);
});

test("B6 process: a STALE revision is refused", () => {
  assertRefused("stale-revision", REVIEW_BUNDLE_FAILURE.IDENTITY);
});

test("B6 process: DETACHED manifest bytes are refused (the byte closure)", () => {
  assertRefused("detached-manifest-bytes", REVIEW_BUNDLE_FAILURE.MANIFEST);
});

test("B6 process: a FALSE closure flag is refused", () => {
  assertRefused("false-closure", REVIEW_BUNDLE_FAILURE.RECEIPT);
});

test("B6 process: WRONG counts are refused", () => {
  assertRefused("wrong-counts", REVIEW_BUNDLE_FAILURE.RECEIPT);
});

test("B6 process: WRONG hashes are refused", () => {
  assertRefused("wrong-hashes", REVIEW_BUNDLE_FAILURE.RECEIPT);
});

test("B6 process: a WRONG receipt schema is refused", () => {
  assertRefused("wrong-receipt-schema", REVIEW_BUNDLE_FAILURE.RECEIPT);
});

test("B6 process: the FAILED status is refused", () => {
  assertRefused("failed-status", REVIEW_BUNDLE_FAILURE.RECEIPT);
});

test("B6 process: a TRAVERSING manifest path is refused", () => {
  assertRefused("manifest-traversal", REVIEW_BUNDLE_FAILURE.MANIFEST_PATH);
});

test("B6 process: an UNDECLARED manifest file is refused", () => {
  assertRefused("manifest-undeclared", REVIEW_BUNDLE_FAILURE.MANIFEST);
});

test("B6 process: a MISSING contracted file is refused", () => {
  assertRefused("manifest-missing", REVIEW_BUNDLE_FAILURE.MANIFEST);
});

test("B6 process: a PROVIDER identity in the public receipt is refused", () => {
  assertRefused("provider-in-receipt", REVIEW_BUNDLE_FAILURE.PROVIDER_LEAK);
});
