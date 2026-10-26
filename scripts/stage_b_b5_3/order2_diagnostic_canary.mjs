#!/usr/bin/env node
// The GC-B6C ORDER-2 DIAGNOSTIC CANARY (acceptance harness only).
//
// It is a NON-CANDIDATE diagnostic. It may ONLY diagnose the frozen active
// registry order 2 and it can NEVER emit a candidate, a semantic review, an
// aggregate or a stage PASS.
//
// It REUSES the existing owners: the authorization owner
// (`lib/authorization.mjs`), the stage action ledger, the owned
// Chrome/Runtime isolation, the B-6 capture and the cleanup owner — all of
// them live in `run_one_bvid.mjs`, which this entry drives in its canary
// mode. It creates NO second owner path and it duplicates NO product flow.
//
// The DEFAULT and the `offline` mode perform ZERO external actions: no
// Chrome, no Runtime, no Provider call, no Cookie read, no download, no
// real BVID and no authorization consumption.
//
// Usage:
//
//   node scripts/stage_b_b5_3/order2_diagnostic_canary.mjs \
//     --order=2 --bvid=BV1QcYx6VEAj \
//     --run-id=<run id> --evidence-root=<the evidence directory> \
//     [--mode=offline|visible] [--observations=<file>] \
//     [--authorization-id=<id>] [--grant-id=<id>] [--authorization-digest=<hex>]
//
// Exit codes:
//
//   0  ORDER2 DIAGNOSTIC READY FOR CODEX
//   1  ORDER2 DIAGNOSTIC BLOCKED
//   2  REFUSED (the identity, the authorization or the grant)
//   3  CONTRACT VIOLATION (the observations are not admissible)
//   4  NOT EXECUTED (the offline entry validated itself and did nothing)

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  CANARY_CODE,
  CANARY_EXIT,
  CANARY_VERDICT,
  ORDER2_FROZEN,
  assertOrder2Identity,
  buildOrder2DiagnosticReceipt,
  inspectAuthorizationState,
  order2DiagnosticReceiptDefects,
  sanitizeObservedErrorCode,
  order2DiagnosticVerdict,
  validateObservations,
} from "./lib/order2_canary.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "./lib/registry.mjs";
import { consumeAuthorization } from "./lib/authorization.mjs";
import { createOwnedProcessTracker } from "./lib/process_ownership.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const runnerPath = path.join(here, "run_one_bvid.mjs");

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) out[arg.slice(2)] = "1";
    else out[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const mode = args.mode === "visible" ? "visible" : "offline";
const runId = args["run-id"] ?? null;
const evidenceRoot = path.resolve(args["evidence-root"] ?? path.join(repoRoot, ".navia/b6c-canary"));

/** The refusal receipt of the canary. It is NEVER a candidate. */
function refuse(code, detail) {
  const receipt = buildOrder2DiagnosticReceipt({
    mode,
    executed: false,
    runId,
    verdict: CANARY_VERDICT.BLOCKED,
    codes: [code],
    generatedAtUtc: new Date().toISOString(),
  });
  receipt.refusal = { code };
  writeReceipt(receipt);
  process.stderr.write(`The order-2 diagnostic canary refused: ${code}\n`);
  process.exit(CANARY_EXIT.REFUSED);
}

function writeReceipt(receipt) {
  try {
    fs.mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      path.join(evidenceRoot, "order2-diagnostic-canary.json"),
      `${JSON.stringify(receipt, null, 2)}\n`,
      { mode: 0o600 },
    );
  } catch {
    process.stderr.write(`${CANARY_CODE.RECEIPT_WRITE_FAILED}\n`);
    process.exit(CANARY_EXIT.CONTRACT_VIOLATION);
  }
}

// ---- 1. the identity guard (BEFORE any external action) -----------------
const identity = assertOrder2Identity({ order: args.order, bvid: args.bvid });
if (!identity.ok) {
  refuse(identity.code, identity.detail);
}

// ---- 1b. the authorization state inspection (READ ONLY) -------------------
//
// It can only REFUSE: it never consumes an authorization, it never issues a
// grant and it never marks a grant as used. The one-shot consumption and the
// child-grant verification stay with the authorization owner.
const stageRootArg = args["stage-root"] ?? process.env.NAVIA_B5_STAGE_ROOT ?? null;
if (stageRootArg && (args["authorization-digest"] || args["grant-id"])) {
  const state = inspectAuthorizationState({
    stageRoot: stageRootArg,
    authorizationDigest: args["authorization-digest"] ?? null,
    grantId: args["grant-id"] ?? null,
  });
  if (!state.ok) {
    refuse(state.code, state.detail);
  }
}

// ---- 2. the offline mode: ZERO external actions -------------------------
if (mode === "offline") {
  // The optional observations file is the canary's INPUT. It is evaluated by
  // the PRODUCTION evaluation, never by a test re-implementation.
  const observationsPath = args.observations ? path.resolve(args.observations) : null;
  if (!observationsPath) {
    // The DEFAULT entry: it validates its own identity and it performs NO
    // external action at all.
    const receipt = buildOrder2DiagnosticReceipt({
      mode,
      executed: false,
      runId,
      verdict: CANARY_VERDICT.BLOCKED,
      codes: [CANARY_CODE.NOT_EXECUTED],
      actionCounters: {
        chromeLaunchCount: 0, visibleWindowCount: 0, runtimeStartCount: 0,
        cookieInjectionCount: 0, focusEventCount: 0, mediaTaskCount: 0,
        runtimeSynthesizeCount: 0, providerCallCount: 0,
        sourceCompletionCount: 0, audioOutputCount: 0, tabCaptureActionCount: 0,
      },
      generatedAtUtc: new Date().toISOString(),
    });
    writeReceipt(receipt);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.exit(CANARY_EXIT.NOT_EXECUTED);
  }
  let observations = null;
  try {
    observations = JSON.parse(fs.readFileSync(observationsPath, "utf8"));
  } catch (error) {
    refuse(CANARY_CODE.OBSERVATIONS_INVALID, `the observations file could not be read: ${String(error?.message ?? error).slice(0, 120)}`);
  }
  const admissibility = validateObservations(observations, { expectedRunId: runId });
  if (!admissibility.ok) {
    const receipt = buildOrder2DiagnosticReceipt({
      mode,
      executed: false,
      runId,
      verdict: CANARY_VERDICT.BLOCKED,
      codes: admissibility.codes,
      observations: summarize(observations),
      generatedAtUtc: new Date().toISOString(),
    });
    writeReceipt(receipt);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.exit(CANARY_EXIT.CONTRACT_VIOLATION);
  }
  const verdict = order2DiagnosticVerdict(observations);
  if (verdict.verdict === CANARY_VERDICT.READY) {
    const receipt = buildOrder2DiagnosticReceipt({
      mode,
      executed: false,
      runId,
      verdict: CANARY_VERDICT.BLOCKED,
      codes: [CANARY_CODE.NOT_EXECUTED],
      observations: summarize(observations),
      actionCounters: {
        chromeLaunchCount: 0, visibleWindowCount: 0, runtimeStartCount: 0,
        cookieInjectionCount: 0, focusEventCount: 0, mediaTaskCount: 0,
        runtimeSynthesizeCount: 0, providerCallCount: 0,
        sourceCompletionCount: 0, audioOutputCount: 0, tabCaptureActionCount: 0,
      },
      generatedAtUtc: new Date().toISOString(),
    });
    writeReceipt(receipt);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.exit(CANARY_EXIT.NOT_EXECUTED);
  }
  const receipt = buildOrder2DiagnosticReceipt({
    mode,
    executed: true,
    runId,
    verdict: verdict.verdict,
    codes: verdict.codes,
    observations: summarize(observations),
    actionCounters: observations.actionCounters ?? null,
    generatedAtUtc: new Date().toISOString(),
  });
  const defects = order2DiagnosticReceiptDefects(receipt);
  if (!defects.ok) {
    process.stderr.write(`The canary receipt violates its own contract: ${defects.codes.join(", ")}\n`);
    process.exit(CANARY_EXIT.CONTRACT_VIOLATION);
  }
  writeReceipt(receipt);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  process.exit(verdict.verdict === CANARY_VERDICT.READY ? CANARY_EXIT.READY : CANARY_EXIT.BLOCKED);
}

// ---- 3. the visible mode: the ONE order-2 child grant -------------------
//
// The visible phase consumes EXACTLY ONE child grant: the frozen order-2
// grant of ONE NEW authorization id. The other five grants are issued and
// NEVER consumed.
const bvidDir = path.join(evidenceRoot, `bvid-2-${ORDER2_FROZEN.bvid}`);
if (fs.existsSync(bvidDir)) {
  refuse(CANARY_CODE.EVIDENCE_NOT_FRESH, "the source evidence directory already exists");
}
const stageRoot = path.resolve(args["stage-root"] ?? process.env.NAVIA_B5_STAGE_ROOT ?? path.join(repoRoot, ".navia/b5-stage"));
if (!runId) {
  refuse(CANARY_CODE.IDENTITY_REFUSED, "the visible mode needs an explicit run id");
}
let grantId = args["grant-id"] ?? null;
let authorizationDigest = args["authorization-digest"] ?? null;

if (!grantId || !authorizationDigest) {
  const authorizationId = args["authorization-id"] ?? process.env.NAVIA_B5_AUTHORIZATION_ID ?? null;
  if (!authorizationId) {
    refuse(CANARY_CODE.AUTHORIZATION_MISSING, "the visible mode needs an explicit one-use authorization id");
  }
  const authorization = consumeAuthorization({
    stageRoot,
    authorizationId,
    runId,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: FROZEN_SIX.map((entry) => ({ order: entry.order, bvid: entry.bvid })),
  });
  if (!authorization.ok) {
    const code = authorization.reason === "authorization_already_consumed"
      ? CANARY_CODE.AUTHORIZATION_REPLAYED
      : CANARY_CODE.AUTHORIZATION_MISSING;
    refuse(code, `the one-use authorization was refused: ${authorization.reason}`);
  }
  const grant = (authorization.grants ?? []).find((item) => String(item.order) === "2");
  if (!grant) {
    refuse(CANARY_CODE.GRANT_MISSING, "the authorization issued no order-2 child grant");
  }
  grantId = grant.grantId;
  authorizationDigest = authorization.digest;
}

const childArgs = [
  runnerPath,
  "--order=2",
  `--bvid=${ORDER2_FROZEN.bvid}`,
  `--run-id=${runId ?? "b6c-order2-diagnostic"}`,
  `--evidence-root=${evidenceRoot}`,
  `--grant-id=${grantId}`,
  `--authorization-digest=${authorizationDigest}`,
  "--canary=order2-diagnostic",
];

const child = spawn(process.execPath, childArgs, {
  cwd: repoRoot,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    NAVIA_B5_STAGE_ROOT: stageRoot,
    NAVIA_CHROME_MUTE_AUDIO: "1",
  },
});
let childStdout = "";
child.stdout.on("data", (chunk) => { childStdout += chunk; });
child.stderr.on("data", () => { /* the runner's diagnostics are not the canary's evidence */ });

// The OWNED process audit: the existing owner. A sighting is LATCHED: it
// is never cleared by a later exit and it makes the diagnostic BLOCKED.
const ownedProcesses = createOwnedProcessTracker();
ownedProcesses.track(child.pid, { label: "2/order2-diagnostic" });
const childExit = await new Promise((resolve) => {
  let settled = false;
  const finish = (result) => {
    if (settled) return;
    settled = true;
    resolve(result);
  };
  child.on("error", () => finish({ code: null, signal: "spawn_error" }));
  child.on("exit", (code, signal) => finish({ code, signal }));
});
const latchedSightings = [];
for (const leak of ownedProcesses.leaks()) {
  if (!latchedSightings.some((sighting) => sighting.pid === leak.pid)) {
    latchedSightings.push({ pid: leak.pid, label: leak.label });
  }
}
const killedOwnedPids = ownedProcesses.killOwnedLeaks();
ownedProcesses.stop();

// The runner's own receipt: the refusal of the grant or the owner's outcome.
let machineReceipt = null;
try {
  machineReceipt = JSON.parse(fs.readFileSync(path.join(bvidDir, "b5-source-receipt.json"), "utf8"));
} catch { /* no receipt: the canary records the absence */ }
if (machineReceipt?.failureCode && String(machineReceipt.failureCode).startsWith("visible_authorization_refused")) {
  refuse(CANARY_CODE.GRANT_MISMATCH, `the owner refused the child grant: ${machineReceipt.failureCode}`);
}

let observations = null;
try {
  observations = JSON.parse(fs.readFileSync(path.join(bvidDir, "order2-diagnostic-observations.json"), "utf8"));
} catch { /* no observations: the canary records the absence */ }
if (!observations) {
  refuse(CANARY_CODE.OBSERVATIONS_MISSING, "the owner produced no diagnostic observations");
}
observations.ownedLeakSightings = latchedSightings.length;
if (childExit.code !== 0 || childExit.signal !== null) {
  observations.observationCodes = [
    ...new Set([...(observations.observationCodes ?? []), CANARY_CODE.OWNER_FAILED]),
  ].sort();
}

const admissibility = validateObservations(observations, { expectedRunId: runId });
if (!admissibility.ok) {
  const receipt = buildOrder2DiagnosticReceipt({
    mode,
    executed: true,
    runId,
    verdict: CANARY_VERDICT.BLOCKED,
    codes: admissibility.codes,
    observations: summarize(observations),
    generatedAtUtc: new Date().toISOString(),
  });
  writeReceipt(receipt);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  process.exit(CANARY_EXIT.CONTRACT_VIOLATION);
}
const verdict = order2DiagnosticVerdict(observations);
const receipt = buildOrder2DiagnosticReceipt({
  mode,
  executed: true,
  runId,
  verdict: verdict.verdict,
  codes: verdict.codes,
  observations: summarize(observations),
  actionCounters: observations.actionCounters ?? null,
  generatedAtUtc: new Date().toISOString(),
});
const defects = order2DiagnosticReceiptDefects(receipt);
if (!defects.ok) {
  process.stderr.write(`The canary receipt violates its own contract: ${defects.codes.join(", ")}\n`);
  process.exit(CANARY_EXIT.CONTRACT_VIOLATION);
}
writeReceipt(receipt);
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
process.exit(verdict.verdict === CANARY_VERDICT.READY ? CANARY_EXIT.READY : CANARY_EXIT.BLOCKED);

/**
 * The compact summary of the observations.
 *
 * It carries counts, a state and stable codes ONLY: never a body, a header,
 * a token, a Cookie, a path, the Provider identity or any text.
 */
function summarize(observations) {
  if (!observations || typeof observations !== "object") return null;
  return {
    visualObservations: (observations.visualObservations ?? []).map((item) => ({
      method: item?.method ?? null,
      routeClass: item?.routeClass ?? null,
      status: item?.status ?? null,
      // The product error code is SANITIZED: an allowlisted code is kept and
      // any other code is dropped, so an unknown product string can never
      // reach the durable evidence.
      errorCode: sanitizeObservedErrorCode(item?.errorCode ?? null).errorCode,
    })),
    observationCodes: observations.observationCodes ?? [],
    taskState: observations.taskState ?? null,
    terminalFailureCode: sanitizeObservedErrorCode(observations.terminalFailureCode ?? null).errorCode,
    evidenceKindCounts: observations.evidenceKindCounts ?? null,
    pngConfirmedFrameCount: observations.pngConfirmedFrameCount ?? null,
    pngFailureCodes: observations.pngFailureCodes ?? [],
    captureStatus: observations.capture?.status ?? null,
    captureFailureCodes: observations.capture?.failureCodes ?? [],
    captureCounts: observations.capture?.counts ?? null,
    cleanup: observations.cleanup ?? null,
    ownedLeakSightings: observations.ownedLeakSightings ?? null,
    actionCounters: observations.actionCounters ?? null,
    uploadCounters: observations.uploadCounters ?? null,
  };
}
