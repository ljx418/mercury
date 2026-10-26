// The durable stage action ledger (C1).
//
// It is append-only, it distinguishes the LIFETIME (stage) totals from one
// candidate run's totals, it consumes a one-shot visible authorization BEFORE
// any external action, and it reconciles the retained logs of the earlier
// attempts into a LOWER BOUND.
//
// These tests never launch Chrome, never start a Runtime, never call a
// Provider and never touch a Cookie.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeTempRoot } from "../lib/temp_roots.mjs";

import {
  LEDGER_EVENTS,
  openStageLedger,
  readLedgerEvents,
  readStageTotals,
  reconcileRetainedLogs,
  resolveStageRoot,
} from "../lib/action_ledger.mjs";
import {
  HISTORICAL_PACKAGE_PREFIXES,
  collectRetainedLogEntries,
} from "../lib/retained_logs.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");

function makeStageRoot() {
  return makeTempRoot("navia-b5-ledger-");
}

test("the stage root is owned and outside the evidence tree", () => {
  const root = resolveStageRoot({
    environment: { NAVIA_B5_STAGE_ROOT: "/tmp/owned-stage" },
    repositoryRoot: "/repo",
  });
  assert.equal(root, "/tmp/owned-stage");
  const fallback = resolveStageRoot({ environment: {}, repositoryRoot: "/repo" });
  assert.equal(fallback, path.join("/repo", ".navia/b5-stage"));
  assert.ok(!fallback.includes("evidence"));
});

test("the ledger is append-only and records the attempts and the counters", () => {
  const stageRoot = makeStageRoot();
  const ledger = openStageLedger({ stageRoot, candidateRunId: "run-a" });
  ledger.record("sourceAttempt", 1);
  ledger.record("chromeLaunch", 1);
  ledger.record("visibleWindow", 1);
  ledger.record("cookieInjection", 26);
  const totals = ledger.finalize();
  assert.equal(totals.candidate.chromeLaunch, 1);
  assert.equal(totals.candidate.cookieInjection, 26);
  assert.equal(totals.stage.chromeLaunch, 1);
  // The file is append-only: every record is on its own line.
  const text = fs.readFileSync(path.join(stageRoot, "stage-actions.jsonl"), "utf8");
  assert.equal(text.trim().split("\n").length, 4);
  for (const line of text.trim().split("\n")) {
    const record = JSON.parse(line);
    assert.equal(record.schemaVersion, "v3-5.10-b5-stage-action/v1");
    assert.ok(LEDGER_EVENTS.includes(record.event));
  }
});

test("the stage totals and the candidate totals are different numbers", () => {
  const stageRoot = makeStageRoot();
  const first = openStageLedger({ stageRoot, candidateRunId: "run-a" });
  first.record("chromeLaunch", 1);
  first.record("sourceAttempt", 1);
  const second = openStageLedger({ stageRoot, candidateRunId: "run-b" });
  second.record("chromeLaunch", 1);
  second.record("sourceAttempt", 1);
  const totals = readStageTotals({ stageRoot, candidateRunId: "run-b" });
  assert.equal(totals.stage.chromeLaunch, 2, "the stage total is the lifetime total");
  assert.equal(totals.candidate.chromeLaunch, 1, "the candidate total is this run only");
  assert.deepEqual(totals.candidateRunIds, ["run-a", "run-b"]);
});

test("an interrupted process still leaves a countable ledger", () => {
  const stageRoot = makeStageRoot();
  const ledger = openStageLedger({ stageRoot, candidateRunId: "run-interrupted" });
  ledger.record("chromeLaunch", 1);
  ledger.record("visibleWindow", 1);
  // The process dies here: no finalize, no cleanup.
  const totals = readStageTotals({ stageRoot });
  assert.equal(totals.stage.chromeLaunch, 1);
  assert.equal(totals.stage.visibleWindow, 1);
});

test("a malformed prior ledger line is skipped, not fatal", () => {
  const stageRoot = makeStageRoot();
  const file = path.join(stageRoot, "stage-actions.jsonl");
  fs.writeFileSync(
    file,
    [
      JSON.stringify({ schemaVersion: "v3-5.10-b5-stage-action/v1", event: "chromeLaunch", count: 2, candidateRunId: "run-a", at: "2026-10-24T00:00:00.000Z" }),
      "{not json at all",
      JSON.stringify({ schemaVersion: "v3-5.10-b5-stage-action/v1", event: "noEvent", count: 1, candidateRunId: "run-a", at: "2026-10-24T00:00:01.000Z" }),
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  const { events, malformed } = readLedgerEvents({ stageRoot });
  assert.equal(events.length, 1);
  assert.equal(malformed, 2);
  const totals = readStageTotals({ stageRoot });
  assert.equal(totals.stage.chromeLaunch, 2);
  assert.equal(totals.malformedLines, 2);
});

test("the reconciliation of the retained logs is a LOWER BOUND", () => {
  const dir = makeStageRoot();
  const first = path.join(dir, "attempt-1.log");
  const second = path.join(dir, "attempt-2.log");
  fs.writeFileSync(
    first,
    [
      "Chrome launched via launchPersistentContext: pid=1",
      "Chrome launched via launchPersistentContext: pid=2",
      "something else",
    ].join("\n"),
  );
  fs.writeFileSync(second, "Chrome launched via launchPersistentContext: pid=3\n");
  const reconciled = reconcileRetainedLogs({
    logEntries: [
      { label: "attempt-1", path: first },
      { label: "attempt-2", path: second },
      { label: "attempt-absent", path: path.join(dir, "absent.log") },
    ],
  });
  assert.equal(reconciled.lowerBound.chromeLaunch, 3);
  assert.equal(reconciled.unreadableOrMissing, 1);
  assert.match(reconciled.note, /lower bound/i);
  // Only the SAFE relative labels are reported: never an absolute path.
  const serialized = JSON.stringify(reconciled);
  assert.ok(!serialized.includes(dir), "the reconciliation must not carry an absolute path");
  assert.deepEqual(reconciled.perLog.map((entry) => entry.label), ["attempt-1", "attempt-2", "attempt-absent"]);
});

test("a per-source launch record is reported but NOT added to the bound", () => {
  const dir = makeStageRoot();
  const consoleLog = path.join(dir, "attempt-console.log");
  const sourceLog = path.join(dir, "bvid-1", "chrome_launch.log");
  fs.mkdirSync(path.dirname(sourceLog), { recursive: true });
  fs.writeFileSync(
    consoleLog,
    "Chrome launched via launchPersistentContext: pid=1\nChrome launched via launchPersistentContext: pid=2\n",
  );
  fs.writeFileSync(sourceLog, "pid=1 cdpPort=null profile=/tmp/owned\n--mute-audio present: true\n");
  const reconciled = reconcileRetainedLogs({
    logEntries: [
      { label: "package/attempt", kind: "console", path: consoleLog },
      { label: "package/attempt/bvid-1", kind: "source_launch_log", path: sourceLog },
    ],
  });
  assert.equal(reconciled.lowerBound.chromeLaunch, 2, "the console record counts the launches");
  assert.equal(reconciled.perSourceLaunchRecords.count, 1);
  assert.match(reconciled.perSourceLaunchRecords.note, /NOT ADDED/);
  // The combined bound is never inflated by the per-source record.
  assert.equal(reconciled.lowerBound.chromeLaunch + reconciled.perSourceLaunchRecords.count, 3);
});

test("the historical retained logs give a lower bound of at least 34 launches", () => {
  const completionRoot = path.join(
    repoRoot,
    "docs/active/project/evidence/v3_media_companion/v3-completion",
  );
  const entries = collectRetainedLogEntries({ completionRoot });
  assert.ok(entries.length > 0, "the historical packages must retain their logs");
  const reconciled = reconcileRetainedLogs({ logEntries: entries });
  assert.ok(
    reconciled.lowerBound.chromeLaunch >= 34,
    `the historical lower bound is ${reconciled.lowerBound.chromeLaunch}, it must be at least 34`,
  );
  // The report carries SAFE relative labels only.
  const serialized = JSON.stringify(reconciled);
  assert.ok(!serialized.includes(completionRoot), "the reconciliation must not carry an absolute path");
  assert.ok(!serialized.includes("/tmp/"), "the reconciliation must not carry a local path");
});

test("the historical package list is explicit", () => {
  assert.deepEqual([...HISTORICAL_PACKAGE_PREFIXES].sort(), [
    "gc-b5r-b5-offline-corrective-",
    "gc-b5r-b5-real-run-",
  ]);
  const completionRoot = path.join(
    repoRoot,
    "docs/active/project/evidence/v3_media_companion/v3-completion",
  );
  const entries = collectRetainedLogEntries({ completionRoot });
  for (const entry of entries) {
    assert.ok(
      HISTORICAL_PACKAGE_PREFIXES.some((prefix) => entry.label.startsWith(prefix)),
      `a NEW package may not enter the historical bound: ${entry.label}`,
    );
  }
});

test("the ledger never records a value, a length or a path", () => {
  const stageRoot = makeStageRoot();
  const ledger = openStageLedger({ stageRoot, candidateRunId: "run-a" });
  ledger.record("cookieInjection", 26);
  const text = fs.readFileSync(path.join(stageRoot, "stage-actions.jsonl"), "utf8");
  assert.ok(!text.includes("/home/"));
  assert.ok(!text.includes("/mnt/"));
  assert.ok(!text.includes("SESSDATA"));
  // Only the COUNT is recorded.
  assert.ok(text.includes('"count":26'));
});
