// RC2 — the EXPLICIT field semantics of the durable audit record.
//
// The finalizer runs more than once per source: once when the source reached
// its outcome and once more in the finally path, after the cleanup. The
// durable record must merge the two states with an EXPLICIT rule per field,
// not with "never replace a non-null primitive".
//
// The merge unit cases below FAIL against the old false-preserving merge:
// a cleanup boolean that was false must converge to true after a verified
// deletion, and a frozen Runtime failure code must survive a later, weaker
// attempt.
//
// No Chrome, no real Runtime, no Provider call, no download, no import, no
// media task and no Cookie read happen here: the Runner is driven against a
// local Runtime double and the Cookie file is synthetic.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  CURRENT_RUN_FIELDS,
  DISPOSITION_PRECEDENCE,
  dispositionPrecedence,
  failureCodeStrength,
  isRealPublication,
  mergeCleanupFacts,
  mergeMachineReceipt,
  mergeProviderFacts,
  mergeTerminalPair,
  mergeUploadCounters,
  sameRunAndSource,
} from "../lib/audit_finalizer.mjs";
import { evaluateAggregate } from "../lib/aggregate.mjs";
import { ACTIVE_REGISTRY_SHA256 } from "../lib/registry.mjs";
import {
  BVID,
  driveRunner,
} from "./_fixtures/attempt_harness.mjs";

/** A receipt of the frozen shape. */
function receipt(overrides = {}) {
  return {
    schemaVersion: "v3-5.10-b5-3-source-receipt/v2",
    runId: "run-a",
    order: 1,
    bvid: BVID,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    taskId: "media_task_x",
    taskNamespace: "media_task_x",
    taskRevision: 7,
    sourceIdentity: "portal:bilibili:source:1:p1",
    dependencyGeneration: "depgen_x",
    route: "credentialed_media_asr",
    disposition: "complete",
    failureCode: null,
    startedAtUtc: "2026-10-24T00:00:00.000Z",
    finishedAtUtc: "2026-10-24T00:00:01.000Z",
    provider: {
      selectedProviderId: "minimax-cn-openai-vision",
      selectedEndpointClass: "minimax_chat_completions",
      attempted: { attemptCount: 1, providerId: "minimax-cn-openai-vision", endpointClass: "minimax_chat_completions", requestCount: 3 },
      published: null,
    },
    uploadCounters: {
      rawVideoUploadCount: 0, rawAudioUploadCount: 0, frameByteUploadCount: 0,
      cookieUploadCount: 0, apiKeyDisclosureCount: 0, localPathUploadCount: 0,
    },
    audioOutputCount: 0,
    tabCaptureCount: 0,
    focusEventCount: 0,
    focusTargetOwned: true,
    cookieInjectionCount: 26,
    extensionPermissionMode: "pregranted_test_fixture",
    muteAudioVerified: true,
    runtimeDatabaseRef: "db-ref",
    chromeProfileRef: "profile-ref",
    derivativeSha256: null,
    receiptSha256: null,
    evidenceSha256: null,
    cleanup: { runtimeScratchDeleted: null, profileRootDeleted: null, cleanupFailure: null },
    chapterDiagnostic: null,
    ...overrides,
  };
}

/**
 * A REAL publication: the full internal shape the runner writes.
 */
function realPublication(overrides = {}) {
  return {
    providerId: "minimax-cn-openai-vision",
    modelId: "MiniMax-M3",
    endpointClass: "minimax_chat_completions",
    structureMode: "strict_tool",
    attemptId: "attempt-abc",
    requestCount: 3,
    latencyMs: 12,
    requestSha256: "2".repeat(64),
    responseSha256: "3".repeat(64),
    outboundDerivedTextSha256: "1".repeat(64),
    finishReason: "stop",
    uploadCounters: {
      rawVideoUploadCount: 0,
      rawAudioUploadCount: 0,
      frameByteUploadCount: 0,
      cookieUploadCount: 0,
      apiKeyDisclosureCount: 0,
      localPathUploadCount: 0,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The merge rules, one by one.
// ---------------------------------------------------------------------------

test("RC2: the cleanup booleans CONVERGE false -> true", () => {
  const merged = mergeMachineReceipt({
    previous: receipt({ cleanup: { runtimeScratchDeleted: false, profileRootDeleted: false, cleanupFailure: null } }),
    next: receipt({ cleanup: { runtimeScratchDeleted: true, profileRootDeleted: true, cleanupFailure: null } }),
  });
  assert.equal(merged.cleanup.runtimeScratchDeleted, true);
  assert.equal(merged.cleanup.profileRootDeleted, true);
});

test("RC2: a verified deletion is never undone by a weaker observation", () => {
  const merged = mergeCleanupFacts({
    previous: { runtimeScratchDeleted: true, profileRootDeleted: true, cleanupFailure: null },
    next: { runtimeScratchDeleted: false, profileRootDeleted: false, cleanupFailure: null },
  });
  assert.equal(merged.runtimeScratchDeleted, true);
  assert.equal(merged.profileRootDeleted, true);
});

test("RC2: the cleanup failure may NOT be erased", () => {
  const merged = mergeCleanupFacts({
    previous: { runtimeScratchDeleted: true, profileRootDeleted: true, cleanupFailure: "the scratch could not be removed" },
    next: { runtimeScratchDeleted: true, profileRootDeleted: true, cleanupFailure: null },
  });
  assert.equal(merged.cleanupFailure, "the scratch could not be removed");
});

test("RC2: a published receipt may replace an earlier null", () => {
  const publication = realPublication();
  const merged = mergeProviderFacts({
    previous: { attempted: { attemptCount: 1, requestCount: 3 }, published: null },
    next: { attempted: { attemptCount: 1, requestCount: 3 }, published: publication },
  });
  assert.deepEqual(merged.published, publication);
});

test("RC2: a published receipt is never FABRICATED and never erased", () => {
  const publication = realPublication();
  // A partial object is a fabrication: it is refused.
  const partial = realPublication();
  delete partial.attemptId;
  const refused = mergeProviderFacts({
    previous: { attempted: {}, published: null },
    next: { attempted: {}, published: partial },
  });
  assert.equal(refused.published, null);
  assert.equal(isRealPublication({ providerId: "minimax-cn-openai-vision" }), false);
  assert.equal(isRealPublication(partial), false);
  assert.equal(isRealPublication(realPublication()), true);
  // A later null never erases a real publication.
  const kept = mergeProviderFacts({
    previous: { attempted: {}, published: publication },
    next: { attempted: {}, published: null },
  });
  assert.deepEqual(kept.published, publication);
});

test("RC2: the terminal pair follows an EXPLICIT precedence", () => {
  assert.deepEqual(DISPOSITION_PRECEDENCE, { complete: 1, limited: 2, blocked: 3, failed: 4 });
  // A stronger disposition wins.
  const stronger = mergeTerminalPair({
    previous: { disposition: "complete", failureCode: null },
    next: { disposition: "failed", failureCode: "V3510B_PROVIDER_RESPONSE_INVALID" },
  });
  assert.equal(stronger.disposition, "failed");
  assert.equal(stronger.failureCode, "V3510B_PROVIDER_RESPONSE_INVALID");
  // A weaker disposition never erases a stronger one.
  const weaker = mergeTerminalPair({
    previous: { disposition: "failed", failureCode: "V3510B_PROVIDER_RESPONSE_INVALID" },
    next: { disposition: "complete", failureCode: null },
  });
  assert.equal(weaker.disposition, "failed");
  assert.equal(weaker.failureCode, "V3510B_PROVIDER_RESPONSE_INVALID");
  // Within one disposition, a FROZEN code survives a weaker attempt.
  const frozen = mergeTerminalPair({
    previous: { disposition: "failed", failureCode: "V3510B_CHAPTER_TIME_INVALID" },
    next: { disposition: "failed", failureCode: "Error" },
  });
  assert.equal(frozen.failureCode, "V3510B_CHAPTER_TIME_INVALID");
  // Within one disposition and one code strength, the FINAL run state wins.
  const final = mergeTerminalPair({
    previous: { disposition: "failed", failureCode: "VISIBLE_AUTHORIZATION_REFUSED" },
    next: { disposition: "failed", failureCode: "VISIBLE_AUTHORIZATION_REFUSED" },
  });
  assert.equal(final.failureCode, "VISIBLE_AUTHORIZATION_REFUSED");
  assert.equal(dispositionPrecedence("failed"), 4);
  assert.equal(dispositionPrecedence("unknown"), 0);
  assert.equal(failureCodeStrength("V352_SYNTHESIS_RESPONSE_INVALID"), 2);
  assert.equal(failureCodeStrength("VISIBLE_AUTHORIZATION_REFUSED"), 1);
  assert.equal(failureCodeStrength("Error"), 0);
});

test("RC2: the timestamps and the attempt counts follow the FINAL run state", () => {
  const merged = mergeMachineReceipt({
    previous: receipt({
      startedAtUtc: "2026-10-24T00:00:00.000Z",
      finishedAtUtc: "2026-10-24T00:00:01.000Z",
      provider: { attempted: { attemptCount: 1, requestCount: 3 }, published: null },
    }),
    next: receipt({
      startedAtUtc: "2026-10-24T01:00:00.000Z",
      finishedAtUtc: "2026-10-24T01:00:09.000Z",
      provider: { attempted: { attemptCount: 1, requestCount: 8 }, published: null },
    }),
  });
  assert.equal(merged.startedAtUtc, "2026-10-24T01:00:00.000Z");
  assert.equal(merged.finishedAtUtc, "2026-10-24T01:00:09.000Z");
  assert.equal(merged.provider.attempted.requestCount, 8);
});

test("RC2: a retry never COMBINES the evidence of a different run or source", () => {
  assert.equal(sameRunAndSource(receipt(), receipt()), true);
  assert.equal(sameRunAndSource(receipt(), receipt({ runId: "run-b" })), false);
  assert.equal(sameRunAndSource(receipt(), receipt({ bvid: "BV1OTHER00001" })), false);
  assert.equal(sameRunAndSource(receipt(), receipt({ order: 2 })), false);
  const merged = mergeMachineReceipt({
    previous: receipt({
      runId: "run-old",
      taskId: "media_task_old",
      cleanup: { runtimeScratchDeleted: false, profileRootDeleted: false, cleanupFailure: null },
    }),
    next: receipt({ runId: "run-new", taskId: "media_task_new" }),
  });
  assert.equal(merged.runId, "run-new", "the other run's facts are not combined");
  assert.equal(merged.taskId, "media_task_new");
  assert.equal(merged.cleanup.runtimeScratchDeleted, null,
    "the other run's cleanup is not combined");
});

test("RC2: an upload violation is never erased", () => {
  const merged = mergeUploadCounters({
    previous: { rawVideoUploadCount: 1 },
    next: { rawVideoUploadCount: 0 },
  });
  assert.equal(merged.rawVideoUploadCount, 1);
});

test("RC2: the merge covers every current-run field explicitly", () => {
  for (const field of ["startedAtUtc", "finishedAtUtc", "taskId", "cookieInjectionCount", "muteAudioVerified"]) {
    assert.ok(CURRENT_RUN_FIELDS.includes(field), `${field} must have an explicit rule`);
  }
});

// ---------------------------------------------------------------------------
// The runner: the pre-cleanup finalization and the finally cleanup.
// ---------------------------------------------------------------------------

test("RC2: the runner converges the cleanup to true and the aggregate accepts it", async () => {
  const { completed, receipt: machineReceipt, evidenceRoot } = await driveRunner({
    mode: "published",
    requestCount: 3,
  });
  assert.equal(completed.status, 0, completed.stderr);
  const directory = path.join(evidenceRoot, `bvid-1-${BVID}`);
  const cleanup = JSON.parse(fs.readFileSync(path.join(directory, "cleanup.json"), "utf8"));
  assert.equal(cleanup.runtimeScratchDeleted, true);
  assert.equal(cleanup.profileRootDeleted, true);
  // The MACHINE receipt carries the same converged cleanup.
  assert.equal(machineReceipt.cleanup.runtimeScratchDeleted, true);
  assert.equal(machineReceipt.cleanup.profileRootDeleted, true);
  // The aggregate accepts the cleanup.
  const verdict = evaluateAggregate({
    rows: [{
      order: 1,
      bvid: BVID,
      disposition: machineReceipt.disposition,
      exitCode: 0,
      evidence: Object.fromEntries(
        ["final_disposition.txt", "b5-source-receipt.json", "isolation.json", "receipt.json",
          "provider_lock.txt", "chrome_launch.log", "secret_scan.csv", "cleanup.json",
          "task_namespace.json"].map((name) => [name, fs.existsSync(path.join(directory, name))]),
      ),
      receipt: machineReceipt,
      audits: {
        secretHitCount: 0,
        audioOutputCount: 0,
        tabCaptureCount: 0,
        focusEventCount: 0,
        ownedProcessLeakCount: 0,
        cleanupComplete: cleanup.runtimeScratchDeleted === true && cleanup.profileRootDeleted === true,
      },
    }],
    runId: "rc2-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    stopReceipt: null,
    ledgerIntegrityOk: true,
  });
  assert.ok(
    !verdict.failures.some((failure) => failure.code === "AGG_AUDIT_FAILED"),
    `the aggregate must accept the cleanup: ${JSON.stringify(verdict.failures)}`,
  );
});

test("RC2: the failure path converges the cleanup to true as well", async () => {
  const { completed, receipt: machineReceipt, evidenceRoot } = await driveRunner({
    mode: "rejected",
    requestCount: 3,
  });
  assert.notEqual(completed.status, 0);
  const directory = path.join(evidenceRoot, `bvid-1-${BVID}`);
  const cleanup = JSON.parse(fs.readFileSync(path.join(directory, "cleanup.json"), "utf8"));
  assert.equal(cleanup.runtimeScratchDeleted, true);
  assert.equal(cleanup.profileRootDeleted, true);
  assert.equal(machineReceipt.cleanup.runtimeScratchDeleted, true);
  assert.equal(machineReceipt.cleanup.profileRootDeleted, true);
});
