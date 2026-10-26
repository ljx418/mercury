// B6A — the RUNNER INTEGRATION of the review capture (C5).
//
// The oracle is the PRODUCTION capture gate, the PRODUCTION ledger and the
// PRODUCTION finalizer merge, driven in a SEPARATE PROCESS.
//
// The two invariants:
//
//   1. a capture failure never leaves a `sourceCompletion` accounting;
//   2. a capture failure never leaves a final machine receipt that can be
//      interpreted as a complete source.
//
// The third case is the SOURCE-ORDER invariant of the runner itself: the
// completion accounting and the first finalization of the audit set happen
// AFTER the review capture.
//
// No Chrome, no Runtime, no Provider, no download, no Cookie.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { captureGateDecision } from "../lib/b6_capture_gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenario = path.join(__dirname, "_fixtures/b6_capture_gate_scenario.mjs");
const runnerPath = path.join(__dirname, "..", "run_one_bvid.mjs");

test("B6 gate 1: a capture that was NOT requested allows the completion", () => {
  const decision = captureGateDecision({ captureRequested: false, capture: null });
  assert.equal(decision.allowSourceCompletion, true);
  assert.equal(decision.failureCode, null);
  assert.equal(decision.captureStatus, "not_requested");
});

test("B6 gate 2: a CLOSED capture allows the completion", () => {
  const decision = captureGateDecision({ captureRequested: true, capture: { ok: true } });
  assert.equal(decision.allowSourceCompletion, true);
  assert.equal(decision.failureCode, null);
  assert.equal(decision.captureStatus, "captured");
});

test("B6 gate 3: a FAILED capture refuses the completion and names the code", () => {
  const decision = captureGateDecision({
    captureRequested: true,
    capture: { ok: false, code: "B6_CAPTURE_ROOT_INVALID" },
  });
  assert.equal(decision.allowSourceCompletion, false);
  assert.equal(decision.failureCode, "B6_CAPTURE_ROOT_INVALID");
  assert.equal(decision.captureStatus, "failed");
});

test("B6 gate 4: a FAILED capture leaves NO completion accounting and NO complete receipt", () => {
  const result = spawnSync(process.execPath, [scenario], { encoding: "utf8" });
  assert.equal(result.status, 0, `the scenario must run: ${result.stderr ?? ""}`);
  const line = String(result.stdout ?? "").trim().split("\n").filter(Boolean).pop() ?? "{}";
  const payload = JSON.parse(line);
  assert.equal(payload.sourceCompletionCount, 0, "a failed capture must leave no completion accounting");
  assert.equal(payload.mergedDisposition, "failed", "the final machine receipt must not be complete");
  assert.equal(payload.mergedFailureCode, "B6_CAPTURE_ROOT_INVALID");
});

test("B6 gate 5: the runner records the completion AFTER the review capture", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  const captureIndex = source.indexOf("the B-6 REVIEW CAPTURE");
  const completionIndex = source.indexOf('ledger.record("sourceCompletion"');
  assert.ok(captureIndex > 0, "the runner must contain the review capture block");
  assert.ok(completionIndex > 0, "the runner must record the source completion");
  assert.ok(
    captureIndex < completionIndex,
    "the source completion accounting must come AFTER the review capture",
  );
  // The FIRST finalization of the audit set after the publication must also
  // come after the capture: the durable machine receipt may never be
  // interpretable as complete before the capture closed.
  const publicationIndex = source.indexOf("publishedDerivativeBytes = derivativeBytes;");
  assert.ok(publicationIndex > 0, "the runner must publish the derivative bytes");
  const firstFinalize = source.indexOf("finalizeAuditEvidence();", publicationIndex);
  assert.ok(firstFinalize > publicationIndex, "the runner must finalize the audit set");
  assert.ok(
    firstFinalize > captureIndex,
    "the first finalization must come AFTER the review capture",
  );
});
