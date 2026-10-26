// B6C — the ORDER-2 DIAGNOSTIC CANARY anti-false-green matrix.
//
// Every negative drives the REAL canary entry point as a SEPARATE PROCESS
// and asserts the process exit code and the durable receipt. A test never
// re-implements a rule: the entry point and the production contract decide.
//
// The matrix:
//
//   1. the wrong registry order is refused before any external action
//   2. a reserve source is refused before any external action
//   3. an authorization replay is refused before any external action
//   4. a missing child grant is refused before any external action
//   5. a READY claim without an attempted visual route is BLOCKED
//   6. an unknown HTTP status or an un-allowlisted error code is refused
//   7. a DEGRADED task may never claim READY
//   8. a fabricated frame count is refused
//   9. a PNG route 404 or an invalid PNG leaves no PNG-backed frame
//  10. a capture that did not close is BLOCKED
//  11. an unclosed cleanup or an owned leak is BLOCKED
//  12. candidate / PASS / review language is refused
//  13. the DEFAULT entry performs ZERO external actions
//  14. the canary source never calls an aggregate, a blind evaluator or a
//      sentinel
//
// No Chrome, no Runtime, no Provider, no Cookie, no download, no real BVID
// and no authorization is consumed by this matrix.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  CANARY_EXIT,
  CANARY_VERDICT,
  order2DiagnosticVerdict,
  validateObservations,
} from "../lib/order2_canary.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";
import { buildObservations, ORDER2_BVID } from "./_fixtures/order2_observations_fixture.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const entryPath = path.join(repoRoot, "scripts/stage_b_b5_3/order2_diagnostic_canary.mjs");

/**
 * Drive the REAL canary entry point.
 *
 * @returns {{status: number, stdout: string, stderr: string, receipt: object|null}}
 */
function driveCanary(args, { env = {}, bindObservationRunId = true } = {}) {
  const observationArg = args.find((arg) => arg.startsWith("--observations="));
  const runIdArg = args.find((arg) => arg.startsWith("--run-id="));
  if (bindObservationRunId && observationArg && runIdArg) {
    const observationPath = observationArg.slice("--observations=".length);
    const payload = JSON.parse(fs.readFileSync(observationPath, "utf8"));
    payload.runId = runIdArg.slice("--run-id=".length);
    fs.writeFileSync(observationPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  }
  const result = spawnSync(process.execPath, [entryPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 120_000,
  });
  let receipt = null;
  const evidenceRoot = args.find((arg) => arg.startsWith("--evidence-root="))?.slice("--evidence-root=".length);
  if (evidenceRoot) {
    try {
      receipt = JSON.parse(fs.readFileSync(path.join(evidenceRoot, "order2-diagnostic-canary.json"), "utf8"));
    } catch { /* no receipt */ }
  }
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", receipt };
}

/** Write an observation set into a temporary file. */
function writeObservations(observations) {
  const root = makeTempRoot("navia-b6c-obs-");
  const file = path.join(root, "observations.json");
  fs.writeFileSync(file, `${JSON.stringify(observations, null, 2)}\n`, { mode: 0o600 });
  return file;
}

// ============================================================================
// The positive control
// ============================================================================

test("B6C canary 1: READY logic is proven but an offline entry can only report NOT EXECUTED", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const payload = buildObservations();
  const admissibility = validateObservations(payload, { expectedRunId: payload.runId });
  assert.equal(admissibility.ok, true, admissibility.codes.join(", "));
  assert.equal(order2DiagnosticVerdict(payload).verdict, CANARY_VERDICT.READY);
  const observations = writeObservations(payload);
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-offline-positive",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.NOT_EXECUTED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt, "the canary must write its receipt");
  assert.equal(run.receipt.candidate, false);
  assert.equal(run.receipt.semanticReviewPerformed, false);
  assert.equal(run.receipt.stagePass, false);
  assert.equal(run.receipt.executed, false);
  assert.equal(run.receipt.verdict, CANARY_VERDICT.BLOCKED);
  assert.deepEqual(run.receipt.codes, ["CANARY_NOT_EXECUTED"]);
  assert.equal(run.receipt.registryOrder, "2");
  assert.equal(run.receipt.bvid, ORDER2_BVID);
});

// ============================================================================
// The identity refusals (before any external action)
// ============================================================================

test("B6C canary 2: the WRONG registry order is refused", () => {
  for (const order of ["1", "3", "6"]) {
    const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
    const run = driveCanary([
      `--order=${order}`,
      `--bvid=${ORDER2_BVID}`,
      "--run-id=b6c-wrong-order",
      `--evidence-root=${evidenceRoot}`,
    ]);
    assert.equal(run.status, CANARY_EXIT.REFUSED, `the order ${order} must be refused`);
    assert.equal(run.receipt?.refusal?.code, "CANARY_IDENTITY_REFUSED");
  }
});

test("B6C canary 3: a RESERVE source is refused", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const run = driveCanary([
    "--order=2",
    "--bvid=BV16woRBfEsH",
    "--run-id=b6c-reserve",
    `--evidence-root=${evidenceRoot}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.REFUSED);
  assert.equal(run.receipt?.refusal?.code, "CANARY_RESERVE_REFUSED");
});

test("B6C canary 4: a SUBSTITUTED bvid is refused", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const run = driveCanary([
    "--order=2",
    "--bvid=BV11t8w6oEtP",
    "--run-id=b6c-substituted",
    `--evidence-root=${evidenceRoot}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.REFUSED);
  assert.equal(run.receipt?.refusal?.code, "CANARY_IDENTITY_REFUSED");
});

// ============================================================================
// The authorization refusals (before any external action)
// ============================================================================

test("B6C canary 5: an AUTHORIZATION REPLAY is refused before any external action", () => {
  const stageRoot = makeTempRoot("navia-b6c-stage-");
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const digest = "b".repeat(64);
  // The SYNTHETIC consumption marker of the authorization owner: the canary
  // only READS it. The test never consumes an authorization.
  fs.mkdirSync(path.join(stageRoot, "authorizations"), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(stageRoot, "authorizations", `${digest}.consumed`), "{}\n", { mode: 0o600 });
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-replay",
    `--evidence-root=${evidenceRoot}`,
    `--stage-root=${stageRoot}`,
    `--authorization-digest=${digest}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.REFUSED, `${run.stdout} ${run.stderr}`);
  assert.equal(run.receipt?.refusal?.code, "CANARY_AUTHORIZATION_REPLAYED");
  // The refusal happens before anything is started and it writes no source
  // evidence.
  assert.ok(!fs.existsSync(path.join(evidenceRoot, "bvid-2-BV1QcYx6VEAj")), "the refusal must write no source evidence");
});

test("B6C canary 6: a MISSING child grant is refused before any external action", () => {
  const stageRoot = makeTempRoot("navia-b6c-stage-");
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  fs.mkdirSync(path.join(stageRoot, "grants"), { recursive: true, mode: 0o700 });
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-missing-grant",
    `--evidence-root=${evidenceRoot}`,
    `--stage-root=${stageRoot}`,
    "--grant-id=grant-that-was-never-issued",
  ]);
  assert.equal(run.status, CANARY_EXIT.REFUSED, `${run.stdout} ${run.stderr}`);
  assert.equal(run.receipt?.refusal?.code, "CANARY_GRANT_MISSING");
  // No owned Chrome and no owned Runtime were started.
  assert.ok(!run.stdout.includes("Chrome launched"), "the refusal must happen before the Chrome");
  assert.ok(!fs.existsSync(path.join(evidenceRoot, "bvid-2-BV1QcYx6VEAj")), "the refusal must write no source evidence");
});

test("B6C canary 6b: a REPLAYED child grant is refused before any external action", () => {
  const stageRoot = makeTempRoot("navia-b6c-stage-");
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  fs.mkdirSync(path.join(stageRoot, "grants"), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(stageRoot, "grants", "grant-1.grant.json"), "{}\n", { mode: 0o600 });
  fs.writeFileSync(path.join(stageRoot, "grants", "grant-1.used"), "{}\n", { mode: 0o600 });
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-replayed-grant",
    `--evidence-root=${evidenceRoot}`,
    `--stage-root=${stageRoot}`,
    "--grant-id=grant-1",
  ]);
  assert.equal(run.status, CANARY_EXIT.REFUSED, `${run.stdout} ${run.stderr}`);
  assert.equal(run.receipt?.refusal?.code, "CANARY_GRANT_REPLAYED");
});

// ============================================================================
// The diagnostic refusals
// ============================================================================

test("B6C canary 7: a READY claim without an ATTEMPTED visual route is BLOCKED", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({ visualObservations: [] }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-no-route",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.BLOCKED, `${run.stdout} ${run.stderr}`);
  assert.equal(run.receipt.verdict, CANARY_VERDICT.BLOCKED);
  assert.ok(run.receipt.codes.includes("CANARY_ROUTE_NOT_ATTEMPTED"));
});

test("B6C canary 8: an UNKNOWN HTTP status is refused as a contract violation", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    visualObservations: [{ method: "POST", routeClass: "materialize-visual", status: 599, errorCode: null }],
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-unknown-status",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.CONTRACT_VIOLATION, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_STATUS_UNKNOWN"));
});

test("B6C canary 9: an UN-ALLOWLISTED product error code is refused", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    visualObservations: [{
      method: "POST",
      routeClass: "materialize-visual",
      status: 409,
      errorCode: "SOMETHING_ELSE_ENTIRELY",
    }],
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-unknown-code",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.CONTRACT_VIOLATION, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_ERROR_CODE_NOT_ALLOWLISTED"));
  // The un-allowlisted code is NEVER persisted.
  assert.ok(!JSON.stringify(run.receipt).includes("SOMETHING_ELSE_ENTIRELY"));
});

test("B6C canary 10: a DEGRADED task may never claim READY", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    taskState: "degraded",
    terminalFailureCode: "VISUAL_EVIDENCE_UNAVAILABLE",
    visualObservations: [
      { method: "POST", routeClass: "materialize-visual", status: 409, errorCode: "VISUAL_EVIDENCE_UNAVAILABLE" },
      { method: "POST", routeClass: "materialize", status: 200, errorCode: null },
    ],
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-degraded",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.BLOCKED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_TASK_NOT_READY"));
});

test("B6C canary 11: a FABRICATED frame count is refused", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    evidenceKindCounts: { transcript: 84, frame: 2, ocr_block: 4, vision_caption: 4 },
    pngConfirmedFrameCount: 4,
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-fabricated-count",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.CONTRACT_VIOLATION, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_COUNT_FABRICATED"));
});

test("B6C canary 12: a PNG route 404 leaves NO PNG-backed frame", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    pngConfirmedFrameCount: 0,
    pngFailureCodes: ["CANARY_PNG_ROUTE_ERROR"],
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-png-404",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.BLOCKED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_NO_PNG_BACKED_FRAME"));
  assert.ok(run.receipt.codes.includes("CANARY_PNG_ROUTE_ERROR"));
});

test("B6C canary 13: an INVALID PNG leaves NO PNG-backed frame", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    pngConfirmedFrameCount: 0,
    pngFailureCodes: ["CANARY_PNG_INVALID"],
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-png-invalid",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.BLOCKED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_PNG_INVALID"));
});

test("B6C canary 14: a CAPTURE that did not close is BLOCKED", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    capture: {
      status: "failed",
      failureCodes: ["B6_BUNDLE_CATALOG_HASH_MISMATCH", "B6_BUNDLE_RECEIPT_INVALID"],
      counts: { evidence: 0, thumbnails: 0, chapters: 0 },
    },
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-capture-open",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.BLOCKED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_CAPTURE_NOT_CLOSED"));
});

test("B6C canary 15: an UNCLEANED owner is BLOCKED", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    cleanup: { runtimeScratchDeleted: false, profileRootDeleted: true, cleanupFailure: null },
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-cleanup",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.BLOCKED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_CLEANUP_NOT_CLOSED"));
});

test("B6C canary 16: an OWNED LEAK SIGHTING is BLOCKED", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({ ownedLeakSightings: 1 }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-leak",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.BLOCKED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_OWNED_LEAK"));
});

test("B6C canary 17: a NON-ZERO upload counter is BLOCKED", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    uploadCounters: {
      rawVideoUploadCount: 1,
      rawAudioUploadCount: 0,
      frameByteUploadCount: 0,
      cookieUploadCount: 0,
      apiKeyDisclosureCount: 0,
      localPathUploadCount: 0,
    },
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-upload",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.BLOCKED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_UPLOAD_COUNTER_NOT_ZERO"));
});

test("B6C canary 18: a COMPLETED source accounting is BLOCKED (a diagnostic is never a candidate)", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    actionCounters: {
      chromeLaunchCount: 1,
      visibleWindowCount: 1,
      runtimeStartCount: 1,
      cookieInjectionCount: 26,
      focusEventCount: 1,
      mediaTaskCount: 1,
      runtimeSynthesizeCount: 1,
      providerCallCount: 3,
      sourceCompletionCount: 1,
      audioOutputCount: 0,
      tabCaptureActionCount: 0,
    },
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-completion",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.BLOCKED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_ACTION_ACCOUNTING_MISMATCH"));
});

test("B6C canary 19: CANDIDATE language in the observations is refused", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    stagePass: true,
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-candidate-language",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.CONTRACT_VIOLATION, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_CANDIDATE_LANGUAGE_REFUSED"));
});

// ============================================================================
// The zero-action guarantee
// ============================================================================

test("B6C canary 20: the DEFAULT entry performs ZERO external actions", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-default",
    `--evidence-root=${evidenceRoot}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.NOT_EXECUTED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt, "the default entry must still write its receipt");
  assert.equal(run.receipt.executed, false);
  assert.equal(run.receipt.candidate, false);
  assert.equal(run.receipt.stagePass, false);
  for (const [key, value] of Object.entries(run.receipt.actionCounters ?? {})) {
    assert.equal(value, 0, `${key} must be zero`);
  }
  // No Chrome and no Runtime were started by the default entry.
  assert.ok(!run.stdout.includes("Chrome launched"), "the default entry must start no Chrome");
  assert.ok(!fs.existsSync(path.join(evidenceRoot, "bvid-2-BV1QcYx6VEAj")), "the default entry must write no source evidence");
});

// ============================================================================
// The structural guarantee
// ============================================================================

test("B6C canary 21: the canary never calls an aggregate, a blind evaluator or a sentinel", () => {
  const sources = [
    "scripts/stage_b_b5_3/order2_diagnostic_canary.mjs",
    "scripts/stage_b_b5_3/lib/order2_canary.mjs",
  ];
  for (const file of sources) {
    const text = fs.readFileSync(path.join(repoRoot, file), "utf8");
    for (const forbidden of [
      "evaluateAggregate", "evaluateB6Aggregate", "buildBlindProjection",
      "sentinel", "reviewRows",
    ]) {
      const uses = (text.match(new RegExp(forbidden, "g")) ?? []).length;
      const allowed = file.endsWith("lib/order2_canary.mjs")
        && ["sentinel", "reviewRows"].includes(forbidden);
      if (allowed) {
        // The pure contract NAMES the forbidden keys in order to REFUSE
        // them: the string may appear, the FUNCTION may not be called.
        assert.ok(
          !new RegExp(`\\b${forbidden}\\s*\\(`).test(text),
          `${file} must not CALL ${forbidden}`,
        );
        continue;
      }
      assert.equal(uses, 0, `${file} must not reference ${forbidden}`);
    }
  }
});

test("B6C canary 22: a failed visual route cannot produce READY without a product code", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    runId: "b6c-route-failed",
    visualObservations: [
      { method: "POST", routeClass: "materialize-visual", status: 500, errorCode: null },
    ],
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-route-failed",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.BLOCKED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_VISUAL_ROUTE_FAILED"));
});

test("B6C canary 23: observations are bound to the requested run id", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations());
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=a-different-run",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ], { bindObservationRunId: false });
  assert.equal(run.status, CANARY_EXIT.CONTRACT_VIOLATION, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_IDENTITY_REFUSED"));
});

test("B6C canary 24: unknown terminal codes never enter durable evidence", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    terminalFailureCode: "PRIVATE_UNFROZEN_DETAIL",
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-offline-positive",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.CONTRACT_VIOLATION, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_ERROR_CODE_NOT_ALLOWLISTED"));
  assert.ok(!JSON.stringify(run.receipt).includes("PRIVATE_UNFROZEN_DETAIL"));
});

test("B6C canary 25: the visible wrapper forwards its resolved stage root and audits only after child exit", () => {
  const source = fs.readFileSync(entryPath, "utf8");
  assert.match(source, /NAVIA_B5_STAGE_ROOT:\s*stageRoot/);
  const waitIndex = source.indexOf('child.on("exit"');
  const leakIndex = source.indexOf("ownedProcesses.leaks()", waitIndex);
  assert.ok(waitIndex >= 0 && leakIndex > waitIndex, "owned descendants are only classified after the owner exits");
  assert.ok(!source.includes("auditTimer"), "normal live descendants must not be latched as leaks");
});

test("B6C canary 26: a receipt write failure cannot exit READY or disclose the target path", () => {
  const root = makeTempRoot("navia-b6c-write-");
  const evidenceFile = path.join(root, "not-a-directory");
  fs.writeFileSync(evidenceFile, "occupied\n", { mode: 0o600 });
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-write-failure",
    `--evidence-root=${evidenceFile}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.CONTRACT_VIOLATION, `${run.stdout} ${run.stderr}`);
  assert.ok(run.stderr.includes("CANARY_RECEIPT_WRITE_FAILED"));
  assert.ok(!run.stderr.includes(evidenceFile));
});

test("B6C canary 27: an owner failure code makes an otherwise ready observation BLOCKED", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    runId: "b6c-owner-failed",
    observationCodes: ["CANARY_OWNER_FAILED"],
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-owner-failed",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.BLOCKED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_OWNER_FAILED"));
});

test("B6C canary 28: undeclared observation fields are rejected", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    runId: "b6c-extra-field",
    hiddenDetail: "must-not-survive",
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-extra-field",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.CONTRACT_VIOLATION, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_OBSERVATIONS_INVALID"));
  assert.ok(!JSON.stringify(run.receipt).includes("must-not-survive"));
});

test("B6C canary 29: a pre-task owner failure may carry null taskId but is permanently BLOCKED", () => {
  const evidenceRoot = makeTempRoot("navia-b6c-evidence-");
  const observations = writeObservations(buildObservations({
    runId: "b6c-pre-task-owner-failed",
    taskId: null,
    taskState: null,
    terminalFailureCode: null,
    visualObservations: [],
    observationCodes: ["CANARY_OWNER_FAILED"],
    pngConfirmedFrameCount: 0,
    capture: { status: "failed", failureCodes: [], counts: { evidence: 0, thumbnails: 0, chapters: 0 } },
  }));
  const run = driveCanary([
    "--order=2",
    `--bvid=${ORDER2_BVID}`,
    "--run-id=b6c-pre-task-owner-failed",
    `--evidence-root=${evidenceRoot}`,
    `--observations=${observations}`,
  ]);
  assert.equal(run.status, CANARY_EXIT.BLOCKED, `${run.stdout} ${run.stderr}`);
  assert.ok(run.receipt.codes.includes("CANARY_OWNER_FAILED"));
  assert.equal(run.receipt.verdict, "ORDER2 DIAGNOSTIC BLOCKED");
});
