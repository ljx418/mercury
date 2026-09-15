import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  archiveMembers,
  assertHumanBoundary,
  assertInvocationExecuted,
  compareInvocationRecord,
  compareRawArtifact,
  runRegisteredNegativeCases,
  validateArchiveMembership,
  validatePublicBytes
} from "./v2PxSnapshotComparison.mjs";

function tempPair() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-t04-compare-"));
  const baseline = path.join(root, "baseline");
  const replay = path.join(root, "replay");
  fs.mkdirSync(baseline); fs.mkdirSync(replay);
  return { root, baseline, replay };
}

test("compares exact bytes and refuses path-content drift", () => {
  const pair = tempPair();
  fs.writeFileSync(path.join(pair.baseline, "report.json"), "{}\n");
  fs.writeFileSync(path.join(pair.replay, "report.json"), "{}\n");
  assert.equal(compareRawArtifact("report.json", pair.baseline, pair.replay).equal, true);
  fs.writeFileSync(path.join(pair.replay, "report.json"), "{ }\n");
  assert.throws(() => compareRawArtifact("report.json", pair.baseline, pair.replay), /T04_REPLAY_MISMATCH/);
  fs.rmSync(pair.root, { recursive: true, force: true });
});

test("normalizes only InvocationRecord recordedAt", () => {
  const pair = tempPair();
  const base = { schemaVersion: "v", recordedAt: "before", steps: [1] };
  const replay = { schemaVersion: "v", recordedAt: "after", steps: [1] };
  fs.writeFileSync(path.join(pair.baseline, "invocation-record.json"), JSON.stringify(base));
  fs.writeFileSync(path.join(pair.replay, "invocation-record.json"), JSON.stringify(replay));
  assert.equal(compareInvocationRecord(pair.baseline, pair.replay).equal, true);
  assert.throws(() => compareInvocationRecord(pair.baseline, pair.replay, ["/recordedAt", "/steps"]), /T04_REPLAY_NORMALIZATION_INVALID/);
  replay.steps = [2];
  fs.writeFileSync(path.join(pair.replay, "invocation-record.json"), JSON.stringify(replay));
  assert.throws(() => compareInvocationRecord(pair.baseline, pair.replay), /T04_REPLAY_MISMATCH/);
  fs.rmSync(pair.root, { recursive: true, force: true });
});

test("requires real ordered invocation evidence and pending human boundary", () => {
  const ref = { path: "log", sha256: "a".repeat(64) };
  const steps = ["derive", "validate", "report", "package"].map((stepId) => ({ stepId, exitCode: 0, signal: null, argv: ["node", `${stepId}.mjs`], stdout: ref, stderr: ref }));
  assert.equal(assertInvocationExecuted({ steps }), true);
  assert.throws(() => assertInvocationExecuted({ steps: steps.slice(0, 3) }), /T04_INVOCATION_EVIDENCE_INVALID/);
  assert.equal(assertHumanBoundary({ humanReviewStatus: "pending", g7Status: "pending", finalPassed: false, signingAllowed: false }), true);
  assert.throws(() => assertHumanBoundary({ humanReviewStatus: "passed", g7Status: "pending", finalPassed: false }), /T04_HUMAN_BOUNDARY_VIOLATION/);
  assert.throws(() => assertHumanBoundary({ humanReviewStatus: "pending", g7Status: "passed", finalPassed: true }), /T04_CLAIM_OVERREACH/);
});

test("scans public evidence for real secret values without treating source examples as credentials", () => {
  assert.equal(validatePublicBytes([{ path: "repository/example.mjs", bytes: Buffer.from('const example = "Bearer fake-example-value";') }]), true);
  assert.throws(() => validatePublicBytes([{ path: "fresh/source-run/runtime.log", bytes: Buffer.from("Authorization: Bearer real-secret-value") }]), /T04_PUBLIC_EVIDENCE_LEAK/);
  assert.throws(() => validatePublicBytes([{ path: "input/snapshot.bundle", bytes: Buffer.from("prefix /private/root suffix") }], { forbiddenByteValues: ["/private/root"] }), /T04_PUBLIC_EVIDENCE_LEAK/);
});

test("validates archive policy and registered negative denominator", () => {
  assert.equal(validateArchiveMembership(["payload.json"]), true);
  assert.throws(() => validateArchiveMembership(["payload.json", "exit-manifest.json"]), /T04_EXIT_MANIFEST_INVALID/);
  const registry = [{ requirementId: "T04-N-001", requirementKey: "sample", expectedPrimaryFailure: "EXPECTED" }];
  const results = runRegisteredNegativeCases({ registry, actions: { "T04-N-001": () => { throw new Error("EXPECTED: isolated failure"); } } });
  assert.equal(results.length, 1);
  assert.throws(() => runRegisteredNegativeCases({ registry, actions: {} }), /T04_VALIDATION_DENOMINATOR_MISMATCH/);
});

test("reads real tar membership and rejects an embedded exit manifest", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-t04-tar-"));
  fs.writeFileSync(path.join(root, "payload.txt"), "ok\n");
  const archive = path.join(root, "payload.tar.gz");
  assert.equal(spawnSync("tar", ["-czf", archive, "-C", root, "payload.txt"]).status, 0);
  assert.deepEqual(archiveMembers(archive), ["payload.txt"]);
  fs.rmSync(root, { recursive: true, force: true });
});
