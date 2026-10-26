// Stage B B-5-3 P0 real-branch tests (PH0-AR-9 / PH0-AR-10).
//
// Coverage matrix (honest):
//   PH0-AR-9 (M-5):
//     - real sequencer exits non-zero on missing FD (drives real A-9)
//     - real sequencer exits 0 + 6/6 complete + 0 leaked procs (A-9)
//   PH0-AR-10 (M-6):
//     - real SIGTERM propagation + child kill + audit (A-10)
//     - real Chrome unavailable → failure-diagnostic + cleanup + non-zero (A-10)
//
// Honest exclusions (Phase 0 NO-GO; documented in
// stage-b-b5-3-phase0-test-results-2026-10-15.md §7):
//   - Real Runtime crash (kill a real Runtime mid-Stage-A): requires
//     runner signal handlers + Runtime PID tracking — out of Phase 0
//     architecture; Phase 1 must add spawn-based runner or signal handler.
//   - Real service worker missing (real Chrome + no extension worker
//     registration): requires a real Chrome build with the extension
//     partially installed; Phase 1 must use the production build.
//   - Real chrome.permissions.request denied: requires X11 ctypes
//     fake-click + native prompt interaction; Phase 1 must reproduce the
//     v3-media-experience-stage-a-fresh.mjs:340-372 pattern.
//
// Each passing test below drives REAL runner / sequencer code via
// subprocess. No stub substitution for the production code under test.
// Where a "sleep runner" fixture is used, it is only used to simulate a
// child runner lifecycle (sequencer-level signal forwarding); the real
// `run_one_bvid.mjs` is exercised directly in the Chrome-unavailable
// and 6/6-complete tests below.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createOwnedProcessTracker } from "../lib/process_ownership.mjs";
import { createSequencerCopy } from "../lib/sequencer_copy.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const sequencerPath = path.join(repoRoot, "scripts/stage_b_b5_3/sequencer.mjs");
const runnerPath = path.join(repoRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs");

// ============================================================================
// Shared helpers
// ============================================================================

function makeEvidenceRoot() {
  const root = makeTempRoot("navia-b5-3-rb-");
  fs.chmodSync(root, 0o700);
  return root;
}

function writeSleepingRunner({ mode, sleepMs }) {
  // mode: 'complete' | 'silent' | 'sleep-then-complete' | 'sleep-forever' | 'exit-on-sigterm'
  // The fixture lives in an OWNED temporary directory: no generated artefact
  // lands in the repository.
  const directory = makeTempRoot("navia-b5-3-rbsleep-");
  const dst = path.join(directory, `running_sleep_${randomUUID().slice(0, 6)}.mjs`);
  // The fixture lives in an OWNED temporary directory: its import of the
  // shared stub module is ABSOLUTE.
  const stubModuleUrl = new URL("./_fixtures/contract_shaped_stub.mjs", import.meta.url).href;
  const script = `
import fs from "node:fs";
import path from "node:path";
import { writeContractShapedEvidence } from ${JSON.stringify(stubModuleUrl)};
const argv = process.argv.slice(2);
function getArg(name) {
  const prefix = \`--\${name}=\`;
  for (const a of argv) if (a.startsWith(prefix)) return a.slice(prefix.length);
  return null;
}
const order = getArg("order");
const bvid = getArg("bvid");
const runId = getArg("run-id");
const evidenceRoot = getArg("evidence-root");
const dir = path.join(evidenceRoot, \`bvid-\${order}-\${bvid}\`);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const mode = process.env.STUB_MODE || "${mode}";

// The COMPLETE, CONTRACT-SHAPED evidence: the ledger events, the machine
// receipt with the full internal publication shape and the receipt mirror
// with the frozen V2.1 receipt identity.
function writeFd() {
  writeContractShapedEvidence({
    dir,
    order,
    bvid,
    runId,
    stageRoot: process.env.NAVIA_B5_STAGE_ROOT || null,
    mutation: "none",
    requestCount: 3,
    disposition: "complete",
    reachedSynthesis: true,
  });
}

if (mode === "complete") { writeFd(); process.exit(0); }
if (mode === "silent") { process.exit(0); }
if (mode === "sleep-then-complete") {
  setTimeout(() => { writeFd(); process.exit(0); }, ${sleepMs});
}
if (mode === "exit-on-sigterm") {
  writeFd();
  process.on("SIGTERM", () => process.exit(143));
  process.on("SIGINT", () => process.exit(130));
  setInterval(() => {}, 1000);
}
process.on("SIGTERM", () => process.exit(143));
process.on("SIGINT", () => process.exit(130));
setInterval(() => {}, 1000);
`;
  fs.writeFileSync(dst, script);
  return dst;
}

function writeAlternateSequencer({ runnerAbsPath }) {
  // The copy lives in a UNIQUE, OWNED temporary directory and it is deleted
  // when the test finishes.
  return createSequencerCopy({
    repoRoot,
    sequencerPath,
    runnerAbsPath,
    prefix: "navia-b5-3-rbseq-",
  });
}

function driveSequencerAsync({ stubMode, evidenceRoot, envOverrides = {}, sleepMs = 5_000 }) {
  const stub = writeSleepingRunner({ mode: stubMode, sleepMs });
  const altSequencer = writeAlternateSequencer({ runnerAbsPath: stub });
  // The sequencer OWNS the one-shot authorization: every invocation gets a
  // FRESH authorization and a FRESH owned stage root.
  const stageRoot = makeTempRoot("navia-b5-3-rbstage-");
  fs.chmodSync(stageRoot, 0o700);
  const proc = spawn("node", [altSequencer.path,
    `--run-id=rb-${randomUUID().slice(0, 8)}`,
    `--evidence-root=${evidenceRoot}`,
  ], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      STUB_MODE: stubMode,
      NAVIA_CHROME_MUTE_AUDIO: "1",
      NAVIA_B5_STAGE_ROOT: stageRoot,
      NAVIA_B5_AUTHORIZATION_ID: `authorization-${randomUUID()}`,
      ...envOverrides,
    },
  });
  // The OWNED process audit of the TEST: only the descendants of THIS
  // sequencer may ever be considered a leak of this run.
  const tracker = createOwnedProcessTracker();
  if (proc.pid) tracker.track(proc.pid);
  return { proc, stub, altSequencer, tracker };
}

function waitForExit(proc, timeoutMs = 30_000) {
  return new Promise((resolve) => {
    let resolved = false;
    const t = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      resolve({ code: null, signal: null, timedOut: true });
    }, timeoutMs);
    proc.on("exit", (code, signal) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(t);
      resolve({ code, signal, timedOut: false });
    });
  });
}

/**
 * The OWNED leaks of a sequencer invocation.
 *
 * A leak is a process that THIS sequencer owns and that outlived it. An
 * unrelated process of another test or another run is NEVER a leak here and
 * it is NEVER killed here.
 */
function auditLeakedSubprocesses(tracker) {
  if (!tracker) return [];
  return tracker.leaks().map((entry) => entry.pid);
}

function killLeaked(tracker) {
  for (const pid of auditLeakedSubprocesses(tracker)) {
    try { process.kill(pid, "SIGKILL"); } catch { /* noop */ }
  }
}

// ============================================================================
// PH0-AR-6 (M-2): node --check + undefined-variable audit
// ============================================================================

test("PH0-AR-6: node --check passes on runner", () => {
  const proc = spawnSync("node", ["--check", runnerPath], { encoding: "utf8" });
  assert.equal(proc.status, 0, `runner syntax check failed: ${proc.stderr}`);
});

test("PH0-AR-6: runner no longer references undefined projections symbol", () => {
  const text = fs.readFileSync(runnerPath, "utf8");
  assert.ok(!text.includes("projections.taskId"), "runner still references projections.taskId");
  assert.ok(!text.includes("projections.revision"), "runner still references projections.revision");
});

test("PH0-AR-6: sequencer syntax check passes", () => {
  const proc = spawnSync("node", ["--check", sequencerPath], { encoding: "utf8" });
  assert.equal(proc.status, 0, `sequencer syntax check failed: ${proc.stderr}`);
});

// ============================================================================
// PH0-AR-9 (M-5): real sequencer exits non-zero on missing FD / partial
// ============================================================================

test("PH0-AR-9: real sequencer exits non-zero when a BVID has no final_disposition.txt", async () => {
  const evidenceRoot = makeEvidenceRoot();
  const { proc, altSequencer, tracker } = driveSequencerAsync({ stubMode: "silent", evidenceRoot });
  try {
    const result = await waitForExit(proc, 30_000);
    assert.equal(result.timedOut, false, `sequencer hung`);
    assert.notEqual(result.code, 0, `sequencer exited 0; would be a false-green`);
    const summary = JSON.parse(fs.readFileSync(path.join(evidenceRoot, "sequencer-summary.json"), "utf8"));
    assert.equal(summary.stopped, true);
    assert.match(summary.stopReason || "", /missing final_disposition\.txt/);
  } finally {
    altSequencer.dispose();
    tracker.stop();
  }
});

test("PH0-AR-9: real sequencer exits 0 + 6/6 complete + 0 leaked when all BVIDs complete", async () => {
  const evidenceRoot = makeEvidenceRoot();
  const { proc, altSequencer, tracker } = driveSequencerAsync({ stubMode: "complete", evidenceRoot });
  try {
    const result = await waitForExit(proc, 60_000);
    assert.equal(result.timedOut, false, `sequencer hung: ${JSON.stringify(result)}`);
    const verdictSummary = JSON.parse(fs.readFileSync(path.join(evidenceRoot, "sequencer-summary.json"), "utf8"));
    assert.equal(
      result.code,
      0,
      `expected exit 0, got ${result.code}${result.signal ? ` signal=${result.signal}` : ""} verdict=${JSON.stringify(verdictSummary.verdict?.failures)}`,
    );
    const summary = JSON.parse(fs.readFileSync(path.join(evidenceRoot, "sequencer-summary.json"), "utf8"));
    assert.equal(summary.bvids.length, 6, `expected 6 BVIDs, got ${summary.bvids.length}`);
    for (const b of summary.bvids) {
      assert.equal(b.disposition, "complete", `BVID ${b.order}/${b.bvid} disposition=${b.disposition}`);
      assert.equal(b.exitCode, 0, `BVID ${b.order}/${b.bvid} exitCode=${b.exitCode}`);
    }
    // Process audit MUST be clean.
    assert.equal(summary.processAudit.leakedAfter, 0, `process audit leaked: ${JSON.stringify(summary.processAudit)}`);
    assert.equal(summary.processAudit.ok, true);
  } finally {
    altSequencer.dispose();
    tracker.stop();
  }
});

test("PH0-AR-10: an UNRELATED live runner is neither counted nor killed", async () => {
  const evidenceRoot = makeEvidenceRoot();
  // A live process whose argv names the runner, but that belongs to ANOTHER
  // run. The OWNED audit of this candidate must stay correct, and the
  // cleanup must never kill it.
  const unrelated = spawn("bash", ["-c", "exec -a 'node run_one_bvid.mjs' sleep 30"], {
    stdio: "ignore",
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const { proc, altSequencer, tracker } = driveSequencerAsync({ stubMode: "complete", evidenceRoot });
  try {
    const result = await waitForExit(proc, 60_000);
    assert.equal(result.timedOut, false, `sequencer hung: ${JSON.stringify(result)}`);
    const summary = JSON.parse(fs.readFileSync(path.join(evidenceRoot, "sequencer-summary.json"), "utf8"));
    assert.equal(summary.processAudit.leakedAfter, 0, "an unrelated process is not a leak of this run");
    assert.equal(summary.processAudit.ok, true);
    assert.equal(result.code, 0, "an unrelated process must not fail this run");
    // The cleanup of this run never touches it.
    killLeaked(tracker);
    assert.equal(unrelated.killed, false, "the unrelated process must never be killed");
    assert.equal(unrelated.exitCode, null);
  } finally {
    altSequencer.dispose();
    tracker.stop();
    unrelated.kill("SIGKILL");
  }
});

// ============================================================================
// PH0-AR-10 (M-6): real SIGTERM propagation + cleanup
// ============================================================================

/**
 * Wait until the STUB RUNNER has actually started.
 *
 * The readiness marker is the stub's own per-BVID directory: the sequencer
 * only creates it after it reached its run loop, so the SIGTERM below can
 * never arrive during the sequencer's startup. A fixed sleep was a race:
 * under load the sequencer was still starting when the signal arrived and it
 * exited before it could write its summary.
 */
async function waitForStubStart(evidenceRoot, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const entries = fs.existsSync(evidenceRoot) ? fs.readdirSync(evidenceRoot) : [];
    const started = entries.find((entry) => entry.startsWith("bvid-"));
    if (started) {
      const marker = path.join(evidenceRoot, started, "final_disposition.txt");
      if (fs.existsSync(marker)) return true;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

test("PH0-AR-10: SIGTERM to running sequencer → child killed + no leaked subprocesses", async () => {
  const evidenceRoot = makeEvidenceRoot();
  const { proc, stub, altSequencer, tracker } = driveSequencerAsync({ stubMode: "exit-on-sigterm", evidenceRoot });
  const started = await waitForStubStart(evidenceRoot, 30_000);
  assert.ok(started, "the stub runner never started; the sequencer was not in its run loop");
  assert.ok(proc.pid, "sequencer pid missing");
  proc.kill("SIGTERM");
  const result = await waitForExit(proc, 30_000);
  assert.equal(result.timedOut, false, "sequencer hung after SIGTERM");
  const summary = JSON.parse(fs.readFileSync(path.join(evidenceRoot, "sequencer-summary.json"), "utf8"));
  assert.ok(summary.processAudit, "processAudit missing from summary");
  assert.equal(summary.processAudit.leakedAfter, 0, `leaked subprocesses: ${JSON.stringify(summary.processAudit, null, 2)}`);
  killLeaked(tracker);
  altSequencer.dispose();
  tracker.stop();
});

// ============================================================================
// PH0-AR-10 (M-6): real runner Chrome-unavailable (full try/catch/finally)
// ============================================================================

test("PH0-AR-10: real runner Chrome unavailable writes cleanup.json + FD + failure-diagnostic + exits non-zero", () => {
  const evidenceRoot = makeEvidenceRoot();
  const proc = spawnSync("node", [runnerPath,
    "--order=1",
    "--bvid=BV11t8w6oEtP",
    "--run-id=rb-real-fail",
    `--evidence-root=${evidenceRoot}`,
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NAVIA_BROWSER_EXECUTABLE: "/nonexistent/chrome-binary",
      NAVIA_CHROME_MUTE_AUDIO: "1",
    },
    timeout: 90_000,
  });
  const cleanupPath = path.join(evidenceRoot, "bvid-1-BV11t8w6oEtP/cleanup.json");
  const fdPath = path.join(evidenceRoot, "bvid-1-BV11t8w6oEtP/final_disposition.txt");
  const fdDiag = path.join(evidenceRoot, "bvid-1-BV11t8w6oEtP/failure-diagnostic.json");
  assert.ok(fs.existsSync(fdPath), "FD must exist on Chrome unavailable");
  assert.ok(fs.existsSync(cleanupPath), "cleanup.json must exist on Chrome unavailable");
  assert.ok(fs.existsSync(fdDiag), "failure-diagnostic.json must exist on Chrome unavailable");
  const fdContent = fs.readFileSync(fdPath, "utf8").trim();
  assert.match(fdContent, /^failed\b/, `expected failed, got: ${fdContent}`);
  const cleanup = JSON.parse(fs.readFileSync(cleanupPath, "utf8"));
  assert.equal(cleanup.schemaVersion, "v3-5.10-b5-3-cleanup/v1");
  assert.equal(typeof cleanup.finishedAtUtc, "string");
  assert.notEqual(proc.status, 0, `runner exited 0 with Chrome unavailable; must exit non-zero`);
});

// ============================================================================
// Test cleanup
// ============================================================================

test.after(async () => {
  // The generated artefacts live in OWNED temporary roots: they are removed
  // with them. The repository never holds a generated fixture.
  await new Promise((r) => setTimeout(r, 200));
});