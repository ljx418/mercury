// Stage B B-5-3 sequencer — runs 6 frozen BVIDs through run_one_bvid.mjs.
//
// Async spawn + signal-forwarding contract (closes PH0 Major gap from Codex
// re-audit):
//   - Each BVID is spawned with `child_process.spawn` (NOT `spawnSync`) so
//     SIGINT/SIGTERM can be received while a runner child is active.
//   - SIGINT/SIGTERM on the sequencer is forwarded to the active child and
//     the sequencer waits up to `CHILD_TERM_TIMEOUT_MS` for graceful exit
//     before SIGKILL.
//   - Per-BVID evidence files (cleanup.json, final_disposition.txt) are
//     written regardless of outcome (including after SIGTERM).
//   - After the loop (success, STOP, or early termination) the sequencer
//     process group audit verifies no leaked runner / Runtime / Chrome
//     processes before exit.
//
// Usage:
//   node scripts/stage_b_b5_3/sequencer.mjs [--run-id=<id>] [--evidence-root=<root>]
//
// Hard constraints:
//   - Each BVID = fresh subprocess; the per-BVID runner owns its own Runtime /
//     sqlite / chrome-profile / task namespace.
//   - Sequencer enforces: ≥2 blocked BVIDs → STOP / FAIL.
//   - Sequencer enforces: any forbidden upload / secret hit / missing --mute-audio
//     → STOP / FAIL.
//   - Sequencer does NOT edit product code or restart services.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
// GC-B6H-R: the candidate path runs the sequencer FROM the sealed snapshot,
// so `here` is the snapshot's own harness directory and `runnerPath` is the
// snapshot's own runner. The DURABLE state (the authorization, the ledger
// and the stage root) stays in the repository root.
const candidateRoots = resolveCandidateRoots({
  environment: process.env,
  fallbackRepoRoot: repoRoot,
});
const stateRoot = candidateRoots.repoRoot ?? repoRoot;
const runnerPath = path.join(here, "run_one_bvid.mjs");
import {
  buildPreflightPlan,
  buildPreflightReceipt,
  readFrozenRegistry,
  readLocalAssetManifest,
} from "./lib/preflight.mjs";
import { ACTIVE_REGISTRY_PATH, FROZEN_SIX as REGISTRY_SIX, RESERVE_SOURCES } from "./lib/registry.mjs";
import { consumeAuthorization, verifyChildGrant } from "./lib/authorization.mjs";
import {
  readStageTotals,
  reconcileRetainedLogs,
  resolveStageRoot,
} from "./lib/action_ledger.mjs";
import { evaluateAggregate, REQUIRED_SOURCE_EVIDENCE, UPLOAD_COUNTER_KEYS } from "./lib/aggregate.mjs";
import { buildCandidateAuthority, candidateAuthorityDefects } from "./lib/b6_authority.mjs";
import { verifyExecutionSnapshot } from "./lib/execution_closure.mjs";
import {
  CANDIDATE_STOP_CODE,
  buildCandidateLock,
  resolveCandidateRoots,
  snapshotRequired,
} from "./lib/candidate_prepare.mjs";
import {
  CANDIDATE_DEPENDENCY_FILE_ENV,
  verifyCandidateDependencies,
} from "./lib/candidate_dependencies.mjs";
import {
  REVIEW_SENTINEL_REGISTRY_ORDER,
  buildValidatedReviewPrecommit,
  drawReviewOrder,
  drawReviewSessions,
  drawSecondPassSentinelPosition,
} from "./lib/review_protocol.mjs";
import { collectRetainedLogEntries } from "./lib/retained_logs.mjs";
import { createOwnedProcessTracker } from "./lib/process_ownership.mjs";
import { collectSourceRows } from "./lib/source_rows.mjs";

const CHILD_TERM_TIMEOUT_MS = 8_000;
const CHILD_KILL_TIMEOUT_MS = 3_000;
const STARTUP_DEADLINE_MS = 90_000;
const PROBE_INTERVAL_MS = 250;

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

const argv = parseArgs(process.argv.slice(2));
const runId = argv["run-id"] || `stage-b-b5-3-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`;
const evidenceRoot = path.resolve(argv["evidence-root"] ||
  path.join(repoRoot, "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-evidence/runs", runId));
fs.mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });

// The frozen six identities come from the ACTIVE registry (v2), and its
// digest is verified before anything runs. The canonical file is read in
// place: a local copy may not replace it, and the historical v1 registry is
// never active.
const { sha256: registrySha256, registry } = readFrozenRegistry({ registryPath: ACTIVE_REGISTRY_PATH });
const FROZEN_SIX = registry.sources.map((source) => ({
  order: String(source.order),
  bvid: String(source.bvid),
}));

const aggregatePath = path.join(evidenceRoot, "sequencer-summary.json");
const aggregate = {
  schemaVersion: "v3-5.10-b5-3-sequencer/v1",
  runId,
  startedAtUtc: new Date().toISOString(),
  finishedAtUtc: null,
  stopped: false,
  stopReason: null,
  bvids: [],
  processAudit: { leakedBefore: 0, leakedAfter: 0, ok: true, leakedPids: [] },
};
fs.writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2), { mode: 0o600 });

let blockedCount = 0;
let sequencerStopped = false;
let sequencerStopReason = null;

// ---------------------------------------------------------------------------
// Async runner invocation
// ---------------------------------------------------------------------------

/**
 * Run a single BVID via async spawn. Returns an object describing how the
 * child terminated: { exited, code, signal, durationMs, timedOut,
 *                      dispatchedSignal }.
 *
 * The function:
 *   - Forwards SIGINT/SIGTERM received by the sequencer to the child.
 *   - Hard-kills the child after CHILD_KILL_TIMEOUT_MS if SIGTERM is ignored.
 *   - Waits up to a soft timeout per the caller.
 */
function runBvidAsync({ order, bvid, grant }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    if (!grant) {
      throw new Error(`No child grant was issued for ${order}/${bvid}.`);
    }
    const child = spawn("node", [runnerPath,
      `--order=${order}`,
      `--bvid=${bvid}`,
      `--run-id=${runId}`,
      `--evidence-root=${evidenceRoot}`,
      `--grant-id=${grant.grantId}`,
      `--authorization-digest=${grant.authorizationDigest}`,
    ], {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, NAVIA_CHROME_MUTE_AUDIO: "1" },
      // Keep the child in the parent's process group so the kernel's signal
      // delivery is direct and child.on("exit") fires predictably.
    });
    let exitInfo = null;
    let killTimer = null;
    let lastDispatched = null;

    const finish = (info) => {
      if (exitInfo) return;
      exitInfo = info;
      if (killTimer) {
        clearTimeout(killTimer);
        killTimer = null;
      }
      resolve({ ...info, child, startedAt, durationMs: Date.now() - startedAt });
    };

    child.on("exit", (code, signal) => finish({ exited: true, code, signal }));
    child.on("error", (err) => finish({ exited: true, code: 1, signal: null, error: err.message }));

    // The OWNED process audit starts with the child: only its descendants
    // may ever be counted as a leak of this run. The label attributes a leak
    // to the SOURCE that produced it.
    ownedProcesses.track(child.pid, { label: `${order}/${bvid}` });

    sequencerActiveChild = child;
    sequencerActiveChildKillTimerRef = () => {
      // Forward the signal directly to the child PID, then hard-KILL
      // fallback after CHILD_KILL_TIMEOUT_MS.
      lastDispatched = "SIGTERM";
      try { child.kill("SIGTERM"); } catch { /* noop */ }
      killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          try { child.kill("SIGKILL"); } catch { /* noop */ }
        }
      }, CHILD_KILL_TIMEOUT_MS);
    };

    void lastDispatched;
  });
}

// Forwarded signal handler (mutated by runBvidAsync).
let sequencerActiveChild = null;
let sequencerActiveChildKillTimerRef = null;

function attachSignalHandlers() {
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      sequencerStopped = true;
      sequencerStopReason = `${sig}_received_and_forwarded`;
      if (sequencerActiveChild && !sequencerActiveChild.killed) {
        if (sequencerActiveChildKillTimerRef) sequencerActiveChildKillTimerRef();
      }
    });
  }
}
attachSignalHandlers();

// ---------------------------------------------------------------------------
// Process-group audit (used after each BVID and at sequencer end)
// ---------------------------------------------------------------------------

/**
 * The OWNED process audit.
 *
 * A leak is a process that THIS sequencer owns and that outlived its
 * parent. The audit NEVER scans the machine for a NAME: an unrelated
 * `run_one_bvid.mjs` of another test or another run is neither counted nor
 * killed here.
 */
const ownedProcesses = createOwnedProcessTracker();

// The LATCHED leak sightings. A descendant that is observed alive after its
// source runner exits is a LEAK, even when it exits later, while the batch
// is still running. The sighting is therefore preserved for the whole
// candidate and never cleared.
const leakSightings = [];
const leakSightingsByPid = new Map();
const killedOwnedPids = [];

function auditOwnedProcesses(label) {
  const leaks = ownedProcesses.leaks();
  for (const leak of leaks) {
    if (leakSightingsByPid.has(leak.pid)) continue;
    const sighting = {
      source: leak.label ?? null,
      pid: leak.pid,
      rootPid: leak.rootPid,
      observedIn: label,
      observedAtUtc: new Date().toISOString(),
    };
    leakSightingsByPid.set(leak.pid, sighting);
    leakSightings.push(sighting);
  }
  return {
    label,
    count: leaks.length,
    // The PIDs only: a command line carries an absolute path, and the
    // summary is an evidence file.
    pids: leaks.map((entry) => entry.pid),
    roots: [...new Set(leaks.map((entry) => entry.rootPid))],
    sources: [...new Set(leaks.map((entry) => entry.label).filter(Boolean))],
  };
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

(async () => {
  // GC-B5R G4: the PREFLIGHT-ONLY mode. It inspects the six identities and
  // the explicitly configured local-asset availability, and it starts NO
  // Chrome, NO Runtime, calls NO Provider, downloads NOTHING, imports NOTHING
  // and generates NO artifact.
  if (argv["preflight-only"] === "1") {
    const localAssets = readLocalAssetManifest({
      manifestPath: argv["local-asset-manifest"] || process.env.NAVIA_STAGE_B_LOCAL_ASSETS || null,
    });
    const plan = buildPreflightPlan({ registry, localAssets, environment: { registrySha256 } });
    const receipt = buildPreflightReceipt({
      plan,
      startedAtUtc: aggregate.startedAtUtc,
      finishedAtUtc: new Date().toISOString(),
    });
    const receiptPath = path.join(evidenceRoot, "preflight-receipt.json");
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    aggregate.mode = "preflight-only";
    aggregate.preflightReceipt = path.relative(evidenceRoot, receiptPath);
    aggregate.finishedAtUtc = receipt.finishedAtUtc;
    aggregate.stopped = false;
    aggregate.stopReason = null;
    fs.writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({
      mode: "preflight-only",
      receipt: path.relative(repoRoot, receiptPath),
      actions: receipt.actions,
      localAssetManifestUnknownKeys: receipt.localAssetManifestUnknownKeys,
      localAssetManifestDuplicatePaths: receipt.localAssetManifestDuplicatePaths,
      sources: receipt.sources.map((source) => ({
        order: source.order,
        bvid: source.bvid,
        localAssetConfigured: source.localAssetConfigured,
        localAssetAvailable: source.localAssetAvailable,
        localAssetIneligibleReason: source.localAssetIneligibleReason,
        disposition: source.disposition,
      })),
      anySourcePassed: receipt.anySourcePassed,
    }, null, 2));
    return;
  }

  // ---- the ONE-SHOT authorization for the complete candidate -------------
  // The SEQUENCER owns it. It is consumed EXACTLY ONCE, atomically across
  // processes, BEFORE any external action, and it creates the durable child
  // grants. A child only VERIFIES its grant.
  const stageRoot = resolveStageRoot({ environment: process.env, repositoryRoot: stateRoot });

  // ---- GC-B6H-R: the SEALED SNAPSHOT, BEFORE the authorization ------------
  //
  // A candidate path without a valid manifest and a valid snapshot root
  // stops HERE: before the authorization is consumed, before Chrome, before
  // the Runtime and before any Provider call.
  const closureManifestPath = candidateRoots.manifestPath;
  const snapshotRoot = candidateRoots.snapshotRoot;
  // A six-source B6 capture IS a candidate run. It may not opt out of the
  // sealed execution root by omitting the explicit preparation switch.
  const snapshotRequiredHere = snapshotRequired()
    || Boolean(process.env.NAVIA_B6_PRIVATE_ROOT);
  let preflightClosure = { present: false, ok: null, codes: [] };
  if (closureManifestPath && snapshotRoot) {
    try {
      const manifest = JSON.parse(fs.readFileSync(closureManifestPath, "utf8"));
      const verdict = verifyExecutionSnapshot({
        manifest,
        snapshotRoot,
        toolRoot: candidateRoots.toolRoot ?? stateRoot,
      });
      preflightClosure = {
        present: true,
        ok: verdict.ok,
        codes: verdict.codes,
        fileCount: Number(manifest.fileCount ?? 0),
        driftedCount: verdict.drifted.length,
        missingCount: verdict.missing.length,
        extraCount: verdict.extra.length,
      };
    } catch (closureError) {
      preflightClosure = { present: true, ok: false, codes: ["EXECUTION_CLOSURE_SCHEMA_INVALID"] };
    }
  } else if (snapshotRequiredHere) {
    preflightClosure = {
      present: false,
      ok: false,
      codes: [CANDIDATE_STOP_CODE.SNAPSHOT_ABSENT],
    };
  }
  aggregate.executionClosure = preflightClosure;
  if (preflightClosure.ok === false) {
    // The refusal happens BEFORE the authorization is consumed.
    aggregate.stopped = true;
    aggregate.stopReason = `execution_closure_invalid_before_authorization: ${preflightClosure.codes.join(",")}`;
    aggregate.finishedAtUtc = new Date().toISOString();
    fs.writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2), { mode: 0o600 });
    console.error(`The candidate path requires a valid sealed snapshot: ${preflightClosure.codes.join(",")}.`);
    process.exit(1);
  }

  // ---- GC-B6J: the DEPENDENCY PARITY, BEFORE the authorization ------------
  //
  // The child environment must resolve the SAME product dependencies that the
  // preparation bound. A child that falls back to its own module-local root
  // resolves the dependencies below the SNAPSHOT, where the product state is
  // absent, and it is refused HERE: before the authorization is consumed,
  // before Chrome, before the Runtime and before any Provider call.
  const dependencyFile = process.env[CANDIDATE_DEPENDENCY_FILE_ENV] || null;
  const dependencyProbeRoot = path.join(stageRoot, ".dependency-probe");
  const dependencyVerdict = (snapshotRequiredHere || dependencyFile)
    ? verifyCandidateDependencies({
      environment: process.env,
      childRoot: path.resolve(here, "../.."),
      dependencyFile,
      mode: "identity",
      ownedRoot: dependencyProbeRoot,
    })
    : { ok: true, codes: [] };
  try {
    fs.rmSync(dependencyProbeRoot, { recursive: true, force: true });
  } catch { /* the dependency probe is an owned temporary artifact */ }
  aggregate.dependencies = {
    ok: dependencyVerdict.ok,
    codes: dependencyVerdict.codes,
  };
  if (!dependencyVerdict.ok) {
    aggregate.stopped = true;
    aggregate.stopReason = `candidate_dependency_invalid_before_authorization: ${dependencyVerdict.codes.join(",")}`;
    aggregate.finishedAtUtc = new Date().toISOString();
    fs.writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2), { mode: 0o600 });
    console.error(`The candidate dependency binding is invalid: ${dependencyVerdict.codes.join(",")}.`);
    process.exit(1);
  }

  // ---- GC-B6H-R: the CANONICAL REVIEW PRECOMMIT, BEFORE the external action
  //
  // The precommit is built from the REPOSITORY-TRACKED canonical bytes and
  // it is validated immediately. A private or caller-supplied protocol is
  // refused here, before anything external happens.
  const registryOrder = FROZEN_SIX.map((entry) => String(entry.order));
  const reviewOrder = drawReviewOrder({ registryOrder });
  const sessions = drawReviewSessions({ runId });
  const firstPassPosition = reviewOrder.indexOf(REVIEW_SENTINEL_REGISTRY_ORDER) + 1;
  const secondPassPosition = drawSecondPassSentinelPosition({
    total: registryOrder.length,
    firstPassPosition,
  });
  const precommitVerdict = buildValidatedReviewPrecommit({
    repoRoot,
    runId,
    registryOrder,
    reviewOrder,
    firstSessionId: sessions.firstSessionId,
    secondSessionId: sessions.secondSessionId,
    secondPassSentinelPosition: secondPassPosition,
  });
  aggregate.reviewPrecommit = {
    ok: precommitVerdict.ok,
    codes: precommitVerdict.codes,
    rubricSha256: precommitVerdict.precommit?.protocol?.rubric?.sha256 ?? null,
    promptSha256: precommitVerdict.precommit?.protocol?.prompt?.sha256 ?? null,
  };
  if (!precommitVerdict.ok) {
    aggregate.stopped = true;
    aggregate.stopReason = `review_precommit_invalid: ${precommitVerdict.codes.join(",")}`;
    aggregate.finishedAtUtc = new Date().toISOString();
    fs.writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2), { mode: 0o600 });
    console.error(`The canonical review precommit is invalid: ${precommitVerdict.codes.join(",")}.`);
    process.exit(1);
  }
  fs.writeFileSync(
    path.join(evidenceRoot, "00-review-precommit.json"),
    `${JSON.stringify(precommitVerdict.precommit, null, 2)}\n`,
    { mode: 0o600 },
  );

  // The CANDIDATE LOCK is GENERATED from the sealed manifest and the
  // registry, never transcribed.
  let closureManifest = null;
  try {
    closureManifest = JSON.parse(fs.readFileSync(closureManifestPath, "utf8"));
  } catch { /* the lock carries the absent manifest */ }
  const candidateLock = buildCandidateLock({
    runId,
    registrySha256,
    registryOrder: FROZEN_SIX.map((entry) => ({ order: String(entry.order), bvid: entry.bvid })),
    reserves: RESERVE_SOURCES.map((entry) => entry.bvid),
    manifest: closureManifest,
    // The REPOSITORY-RELATIVE path of the registry: the lock names the
    // contract by its repository path, never by a local one.
    registryPath: closureManifest?.contractFiles?.find((entry) => entry.key === "registry")?.relative
      ?? path.relative(stateRoot, ACTIVE_REGISTRY_PATH),
    dependencies: dependencyVerdict.expected,
  });
  fs.writeFileSync(
    path.join(evidenceRoot, "00-candidate-lock.json"),
    `${JSON.stringify(candidateLock, null, 2)}\n`,
    { mode: 0o600 },
  );

  const authorizationId = process.env.NAVIA_B5_AUTHORIZATION_ID || null;
  const authorization = consumeAuthorization({
    stageRoot,
    authorizationId,
    runId,
    registrySha256,
    identities: FROZEN_SIX,
  });
  aggregate.authorization = {
    consumed: Boolean(authorization.ok),
    reason: authorization.reason ?? null,
    authorizationDigest: authorization.digest ?? null,
    grantCount: authorization.grants?.length ?? 0,
  };
  if (!authorization.ok) {
    // The refusal happens BEFORE Chrome, BEFORE the Runtime and BEFORE any
    // Provider call.
    aggregate.stopped = true;
    aggregate.stopReason = `visible_authorization_refused_${authorization.reason}`;
    aggregate.finishedAtUtc = new Date().toISOString();
    fs.writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2), { mode: 0o600 });
    console.error(`The visible batch is not authorized: ${authorization.reason}.`);
    process.exit(1);
  }
  const grantByIdentity = new Map(
    (authorization.grants ?? []).map((grant) => [`${grant.order}:${grant.bvid}`, grant]),
  );

  for (const { order, bvid } of FROZEN_SIX) {
    if (sequencerStopped) break;
    console.log(`\n===== BVID ${order}/${bvid} START =====`);
    const auditBefore = auditOwnedProcesses(`before-bvid-${order}`);
    const result = await runBvidAsync({
      order,
      bvid,
      grant: grantByIdentity.get(`${order}:${bvid}`) ?? null,
    });
    const auditAfter = auditOwnedProcesses(`after-bvid-${order}`);

    const bvidDir = path.join(evidenceRoot, `bvid-${order}-${bvid}`);
    const fdPath = path.join(bvidDir, "final_disposition.txt");
    const disposition = fs.existsSync(fdPath) ? fs.readFileSync(fdPath, "utf8").trim().split("\n")[0] : "failed";
    // The ATTEMPTED facts of the source: the synthesis invocations and the
    // ACTUAL outbound Provider attempts. They are the per-source side of the
    // ledger reconciliation.
    let attemptedFacts = null;
    try {
      const machineReceipt = JSON.parse(
        fs.readFileSync(path.join(bvidDir, "b5-source-receipt.json"), "utf8"),
      );
      const attempted = machineReceipt?.provider?.attempted ?? null;
      attemptedFacts = {
        attemptCount: Number.isInteger(attempted?.attemptCount) ? attempted.attemptCount : null,
        requestCount: Number.isInteger(attempted?.requestCount) ? attempted.requestCount : null,
      };
    } catch { /* the source wrote no receipt: the row reports the absence */ }
    const procSummary = {
      order, bvid, disposition,
      grantId: grantByIdentity.get(`${order}:${bvid}`)?.grantId ?? null,
      exitCode: result.code,
      signal: result.signal,
      durationMs: result.durationMs,
      error: result.error || null,
      processAuditBefore: auditBefore,
      processAuditAfter: auditAfter,
      attemptedFacts,
    };
    aggregate.bvids.push(procSummary);
    console.log(`BVID ${order}/${bvid} disposition: ${disposition} (exit ${result.code}${result.signal ? ` signal=${result.signal}` : ""})`);

    if (disposition === "blocked") blockedCount += 1;

    // The FIRST owned leak stops the batch. The sighting is preserved for the
    // whole candidate even when the process exits later, and ONLY the owned
    // descendants are cleaned.
    if (auditAfter.count > 0) {
      sequencerStopped = true;
      sequencerStopReason = `BVID ${order}/${bvid}: ${auditAfter.count} owned process leak(s) survived the source runner`;
      killedOwnedPids.push(...ownedProcesses.killOwnedLeaks());
      fs.writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2), { mode: 0o600 });
      break;
    }

    // chrome_launch.log must assert --mute-audio if present.
    const chromeLog = path.join(bvidDir, "chrome_launch.log");
    if (fs.existsSync(chromeLog)) {
      const chromeLogText = fs.readFileSync(chromeLog, "utf8");
      if (!chromeLogText.includes("--mute-audio present: true")) {
        sequencerStopped = true;
        sequencerStopReason = `BVID ${order}/${bvid}: chrome_launch.log present but --mute-audio not asserted`;
        break;
      }
    }

    // secret_scan.csv must have zero hits if present.
    const secretCsv = path.join(bvidDir, "secret_scan.csv");
    if (fs.existsSync(secretCsv)) {
      const secretHits = fs.readFileSync(secretCsv, "utf8").split("\n").slice(1).filter((line) => line.trim().length > 0);
      if (secretHits.length > 0) {
        sequencerStopped = true;
        sequencerStopReason = `BVID ${order}/${bvid}: secret_scan.csv has ${secretHits.length} hit(s)`;
        break;
      }
    }

    if (blockedCount >= 2) {
      sequencerStopped = true;
      sequencerStopReason = `${blockedCount} blocked BVIDs exceeds maximumBlockedForStageExit=1`;
      break;
    }

    fs.writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2), { mode: 0o600 });
  }

  // -----------------------------------------------------------------------
  // The per-source machine rows (R0 aggregate)
  // -----------------------------------------------------------------------

  /**
   * The retained console logs of the EARLIER attempts.
   *
   * They are read ONLY, and they are reported with a SAFE relative label: an
   * absolute path never enters the summary.
   */

  /**
   * Collect one machine row per attempted source.
   *
   * The collector is the SHARED owner: the public evidence publisher reads
   * exactly the same rows from the same evidence root, so the public
   * package is computed from the facts the machine gate saw.
   */
  function collectRows(entries) {
    return collectSourceRows({
      evidenceRoot,
      entries: entries.map((entry) => {
        // The LATCHED leak sightings of THIS source. A sighting survives the
        // exit of the process: it is the record of the boundary violation.
        const sourceLabel = `${entry.order}/${entry.bvid}`;
        return {
          ...entry,
          ownedLeakSightings: leakSightings.filter((sighting) => sighting.source === sourceLabel),
        };
      }),
    });
  }

  // -----------------------------------------------------------------------
  // Sequencer-level hard failures (M-5)
  // -----------------------------------------------------------------------
  let sequencerHardFailure = false;
  let sequencerHardReason = null;
  for (const entry of aggregate.bvids) {
    const fdPath = path.join(evidenceRoot, `bvid-${entry.order}-${entry.bvid}/final_disposition.txt`);
    if (!fs.existsSync(fdPath)) {
      sequencerHardFailure = true;
      sequencerHardReason = `BVID ${entry.order}/${entry.bvid} missing final_disposition.txt (runner exited ${entry.exitCode}${entry.signal ? ` signal=${entry.signal}` : ""})`;
      entry.disposition = "failed";
      break;
    }
    if (entry.exitCode !== 0 && entry.exitCode !== null && entry.disposition === "complete") {
      sequencerHardFailure = true;
      sequencerHardReason = `BVID ${entry.order}/${entry.bvid} marked complete but runner exited ${entry.exitCode}`;
      break;
    }
  }
  if (!sequencerStopped && aggregate.bvids.length < FROZEN_SIX.length && !sequencerHardFailure) {
    sequencerHardFailure = true;
    sequencerHardReason = `Sequencer processed ${aggregate.bvids.length}/${FROZEN_SIX.length} BVIDs without stopReason`;
  }
  if (sequencerHardFailure) {
    sequencerStopped = true;
    sequencerStopReason = sequencerHardReason;
  }
  if (sequencerStopReason) aggregate.stopReason = sequencerStopReason;

  // -----------------------------------------------------------------------
  // The AGGREGATE verdict (R0). A semantically failing aggregate NEVER
  // leaves the process with exit 0.
  // -----------------------------------------------------------------------
  const sourceRows = collectRows(aggregate.bvids);

  // ---- the action ledger (FC2) ------------------------------------------
  // The candidate's own totals, the durable stage-root LIFETIME totals, the
  // retained-log historical lower bound and a clearly labelled combined lower
  // bound. The two lower bounds are DISJOINT: the stage root holds the NEW
  // runs, the retained logs hold the OLD attempts.
  const ledgerTotals = readStageTotals({ stageRoot, candidateRunId: runId });
  const retained = reconcileRetainedLogs({
    logEntries: collectRetainedLogEntries({
      completionRoot: path.join(
        stateRoot,
        "docs/active/project/evidence/v3_media_companion/v3-completion",
      ),
    }),
  });
  const stageChromeLaunches = ledgerTotals.stage.chromeLaunch ?? 0;
  const historicalChromeLaunches = retained.lowerBound.chromeLaunch ?? 0;
  aggregate.actionLedger = {
    candidateTotals: ledgerTotals.candidate,
    stageTotals: ledgerTotals.stage,
    ledgerIntegrityOk: ledgerTotals.integrityOk,
    malformedLedgerLines: ledgerTotals.malformedLines,
    candidateRunIds: ledgerTotals.candidateRunIds,
    historicalLowerBound: {
      ownedChromeLaunches: historicalChromeLaunches,
      method: retained.method,
      unreadableOrMissing: retained.unreadableOrMissing,
      perLog: retained.perLog,
      perSourceLaunchRecordsNotAdded: {
        count: retained.perSourceLaunchRecords.count,
        perLog: retained.perSourceLaunchRecords.perLog,
        note: retained.perSourceLaunchRecords.note,
      },
      note: "A LOWER BOUND over the retained logs: only the explicit launch records of the retained CONSOLE logs are counted, and every console log is ONE attempt. The per-source launch records are reported but NOT added: they belong to attempts whose console record already counts that launch.",
    },
    combinedLowerBound: {
      ownedChromeLaunches: stageChromeLaunches + historicalChromeLaunches,
      label: "the stage-root lifetime totals PLUS the retained-log historical lower bound (disjoint sets)",
      note: "No counter is guessed and nothing is counted twice: the stage root holds the new runs and the retained logs hold the older attempts.",
    },
  };

  const verdict = evaluateAggregate({
    rows: sourceRows,
    runId,
    registrySha256,
    stopReceipt: aggregate.stopReceipt ?? null,
    ledgerIntegrityOk: ledgerTotals.integrityOk,
    // The CANDIDATE totals: they must equal the sum of the per-source
    // attempted facts.
    candidateLedgerTotals: {
      runtimeSynthesize: Number(ledgerTotals.candidate.runtimeSynthesize ?? 0),
      providerCall: Number(ledgerTotals.candidate.providerCall ?? 0),
    },
  });
  aggregate.verdict = {
    positive: verdict.positive,
    counts: verdict.counts,
    threshold: verdict.threshold,
    failures: verdict.failures,
    requiredSourceEvidence: REQUIRED_SOURCE_EVIDENCE,
    uploadCounterKeys: UPLOAD_COUNTER_KEYS,
    registrySha256,
    activeRegistryPath: path.relative(repoRoot, ACTIVE_REGISTRY_PATH),
    reserveSources: RESERVE_SOURCES.map((entry) => entry.bvid),
  };
  if (!verdict.positive) {
    sequencerStopped = true;
    sequencerStopReason = sequencerStopReason
      || `aggregate verdict is not positive: ${verdict.failures.map((f) => `${f.code}(${f.detail})`).join("; ")}`;
    aggregate.stopReason = sequencerStopReason;
  }

  // -----------------------------------------------------------------------
  // The CANDIDATE AUTHORITY (B-6).
  //
  // It is DERIVED from the SAME machine receipts and capture receipts that
  // closed the B-5 machine gate: nothing is invented here. The per-source
  // task, revision, dependency generation and derivative hash come from the
  // machine receipt; the bundle hash and the blind review-binding hash come
  // from the capture receipt that the same run produced.
  // -----------------------------------------------------------------------
  const captureReceipts = sourceRows.map((row) => row.receipt?.reviewCapture ?? null);
  const authoritySources = sourceRows.map((row, index) => {
    const receipt = row.receipt ?? {};
    const capture = captureReceipts[index];
    return {
      order: String(row.order),
      bvid: String(row.bvid),
      taskId: receipt.taskId ?? null,
      taskRevision: receipt.taskRevision ?? null,
      sourceIdentity: receipt.sourceIdentity ?? null,
      dependencyGeneration: receipt.dependencyGeneration ?? null,
      derivativeSha256: receipt.derivativeSha256 ?? null,
      captureArtifactSha256: capture?.digests?.artifactSha256 ?? null,
      bundleSha256: capture?.digests?.bundleSha256 ?? null,
      reviewBindingSha256: capture?.digests?.reviewBindingSha256 ?? null,
      captureStatus: capture?.status ?? null,
      captureCounts: capture?.counts ?? null,
      captureClosure: capture?.closure ?? null,
    };
  });
  const capturedSources = authoritySources.filter((source) => source.bundleSha256).length;
  const candidateAuthority = buildCandidateAuthority({
    runId,
    registrySha256,
    machineGatePositive: verdict.positive === true,
    sources: authoritySources,
    captureStatus: capturedSources === FROZEN_SIX.length ? "captured" : "failed",
    closureCounts: {
      evidence: captureReceipts.reduce((sum, receipt) => sum + Number(receipt?.counts?.evidence ?? 0), 0),
      thumbnails: captureReceipts.reduce((sum, receipt) => sum + Number(receipt?.counts?.thumbnails ?? 0), 0),
      chapters: captureReceipts.reduce((sum, receipt) => sum + Number(receipt?.counts?.chapters ?? 0), 0),
    },
  });
  const authorityDefects = candidateAuthorityDefects(candidateAuthority, { registrySha256 });
  aggregate.candidateAuthority = candidateAuthority;
  aggregate.candidateAuthorityDefects = authorityDefects;
  // The B-6 candidate gate: when the review capture was REQUESTED, the
  // candidate authority must be exact. A defect never leaves a zero exit
  // behind.
  const b6CaptureRequested = Boolean(process.env.NAVIA_B6_PRIVATE_ROOT);
  if (b6CaptureRequested && authorityDefects.length > 0) {
    sequencerStopped = true;
    sequencerStopReason = sequencerStopReason
      || `the candidate authority is not exact: ${authorityDefects.join("; ")}`;
    aggregate.stopReason = sequencerStopReason;
  }
  aggregate.stopped = sequencerStopped;
  aggregate.finishedAtUtc = new Date().toISOString();

  // GC-B6H-R: the SEALED SNAPSHOT is verified at the CLOSEOUT: a byte that
  // changed during the whole batch is a defect of the candidate.
  let executionClosure = { present: false, ok: null, codes: [] };
  if (closureManifestPath && snapshotRoot) {
    try {
      const manifest = JSON.parse(fs.readFileSync(closureManifestPath, "utf8"));
      const verdict = verifyExecutionSnapshot({
        manifest,
        snapshotRoot,
        toolRoot: candidateRoots.toolRoot ?? stateRoot,
      });
      executionClosure = {
        present: true,
        ok: verdict.ok,
        codes: verdict.codes,
        fileCount: Number(manifest.fileCount ?? 0),
        driftedCount: verdict.drifted.length,
        missingCount: verdict.missing.length,
        extraCount: verdict.extra.length,
      };
    } catch (closureError) {
      executionClosure = { present: true, ok: false, codes: ["EXECUTION_CLOSURE_SCHEMA_INVALID"] };
    }
  }
  aggregate.executionClosure = executionClosure;
  if (executionClosure.present && executionClosure.ok === false) {
    sequencerStopped = true;
    sequencerStopReason = sequencerStopReason
      || `the execution closure is invalid at the closeout: ${executionClosure.codes.join(",")}`;
    aggregate.stopReason = sequencerStopReason;
  }

  // Final process-group audit (M-6 close-out).
  const finalAudit = auditOwnedProcesses("sequencer-end");
  // The LATCHED sightings are the truth: a leak that was observed at a
  // source boundary is a leak even when the process exited before the
  // closeout.
  aggregate.processAudit = {
    leakedBefore: 0,
    leakedAfter: leakSightings.length,
    ok: leakSightings.length === 0,
    leakedPids: leakSightings.map((sighting) => sighting.pid),
    sightings: leakSightings,
    stillAliveAtCloseout: finalAudit.count,
    killedOwnedPids,
    note: "The LATCHED sightings of the owned descendants that survived their source runner. A sighting is never cleared by a later exit.",
  };

  fs.writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2), { mode: 0o600 });

  console.log(`\n===== SEQUENCER FINISHED =====`);
  console.log(JSON.stringify({
    runId,
    bvids: aggregate.bvids.map((b) => ({ order: b.order, bvid: b.bvid, disposition: b.disposition, exitCode: b.exitCode, signal: b.signal })),
    stopped: aggregate.stopped,
    stopReason: aggregate.stopReason,
    verdict: { positive: verdict.positive, counts: verdict.counts, failures: verdict.failures },
    processAudit: aggregate.processAudit,
  }, null, 2));

  // Exit non-zero on a hard failure, a leaked process OR a non-positive
  // aggregate verdict. A `limited` or `failed` source, two blocked sources or
  // a missing receipt may never leave a zero exit behind.
  if (sequencerHardFailure || leakSightings.length > 0 || finalAudit.count > 0 || !verdict.positive
    || (b6CaptureRequested && authorityDefects.length > 0)) {
    process.exitCode = 1;
  }
})();
