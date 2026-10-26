// The PROCESS-LEVEL capture-failure scenario of the runner.
//
// It is a SEPARATE process: it drives the PRODUCTION ledger, the PRODUCTION
// finalizer merge and the PRODUCTION capture gate with a capture failure
// and reports what a reader of the durable evidence would see.
//
// The scenario:
//   1. the source reached its outcome (the pre-capture state);
//   2. the review capture FAILED;
//   3. the source completion accounting is only recorded when the gate
//      allows it;
//   4. the final machine receipt is merged with the failure state.
//
// No Chrome, no Runtime, no Provider, no download, no Cookie.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { appendLedgerEvent, readStageTotals } from "../../lib/action_ledger.mjs";
import { mergeMachineReceipt } from "../../lib/audit_finalizer.mjs";
import { captureGateDecision } from "../../lib/b6_capture_gate.mjs";

const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "navia-b6a-gate-"));
const runId = "b6-gate-run";

/** The machine receipt BEFORE the capture: the source reached its outcome. */
const preCapture = {
  schemaVersion: "v3-5.10-b5-3-source-receipt/v2",
  runId,
  order: 1,
  bvid: "BV11t8w6oEtP",
  registrySha256: "9".repeat(64),
  taskId: `media_task_${"1".padStart(32, "0")}`,
  taskRevision: 7,
  sourceIdentity: "portal:bilibili:BV11t8w6oEtP:41828944992:p1",
  dependencyGeneration: `depgen_${"a".repeat(64)}`,
  disposition: "complete",
  failureCode: null,
  derivativeSha256: "b".repeat(64),
  receiptSha256: "c".repeat(64),
  evidenceSha256: "b".repeat(64),
  cleanup: { runtimeScratchDeleted: false, profileRootDeleted: false, cleanupFailure: null },
  provider: { selectedProviderId: null, selectedEndpointClass: null, attempted: {}, published: null },
  uploadCounters: {},
};

/** The capture FAILED. */
const capture = { ok: false, code: "B6_CAPTURE_ROOT_INVALID" };

const decision = captureGateDecision({ captureRequested: true, capture });
if (decision.allowSourceCompletion) {
  appendLedgerEvent({
    stageRoot,
    event: "sourceCompletion",
    candidateRunId: runId,
    count: 1,
    detail: { stage: "synthesis_published" },
  });
}

/** The failure state of the machine receipt. */
const failureState = {
  ...preCapture,
  disposition: "failed",
  failureCode: decision.failureCode,
};

const merged = mergeMachineReceipt({ previous: preCapture, next: failureState });
const totals = readStageTotals({ stageRoot, candidateRunId: runId });

process.stdout.write(`${JSON.stringify({
  decision,
  mergedDisposition: merged.disposition,
  mergedFailureCode: merged.failureCode,
  sourceCompletionCount: totals.candidate.sourceCompletion ?? 0,
  sourceAttemptCount: totals.candidate.sourceAttempt ?? 0,
})}\n`);

fs.rmSync(stageRoot, { recursive: true, force: true });
