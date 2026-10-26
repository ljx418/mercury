// GC-B6H — the anti-false-green matrix of the offline correction.
//
// Every case drives the REAL owner and mutates a REAL input. No case
// asserts a constant, a name or an exit code in place of a behaviour.
//
// No Chrome, no Runtime task, no Cookie, no Provider, no download, no real
// BVID, no blind review, no sentinel and no authorization is used.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXECUTION_CLOSURE_FAILURE,
  buildExecutionClosureManifest,
  materializeExecutionSnapshot,
  verifyExecutionClosure,
  verifyExecutionSnapshot,
} from "../lib/execution_closure.mjs";
import {
  REVIEW_PROTOCOL_FAILURE,
  buildReviewPrecommit,
  loadCanonicalReviewProtocol,
  reviewPrecommitDefects,
} from "../lib/review_protocol.mjs";
import {
  PUBLIC_EVIDENCE_FAILURE,
  publicEvidenceManifest,
  validatePublicEvidence,
} from "../lib/public_evidence.mjs";
import {
  REGISTRY_ORDER,
  buildPackage as buildSharedPackage,
} from "./_fixtures/b6hr_public_evidence.mjs";
import { ACTIVE_REGISTRY_SHA256 } from "../lib/registry.mjs";
import {
  RETENTION_FAILURE,
  buildRetentionRecord,
  collectArtifactDigests,
  rejectRetainedArtifacts,
  retentionRecordDefects,
} from "../lib/retention_ledger.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";
import {
  STAGE_A_BUDGETS,
  STAGE_A_CODE,
  elapsedBucket,
  matchesFrozenIdentity,
  timeoutText,
} from "../lib/stage_a_diagnostics.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

/**
 * An OWNED temporary root.
 *
 * It is registered in the harness registry and it is removed when the test
 * process exits: a test never leaves a residue behind.
 */
function scratch(prefix) {
  return makeTempRoot(prefix);
}

// ---------------------------------------------------------------------------
// H1 — the sealed execution closure
// ---------------------------------------------------------------------------

test("H1: the closure resolves the executed roots and verifies clean", () => {
  const manifest = buildExecutionClosureManifest({ repoRoot });
  assert.ok(manifest.fileCount > 100, "the closure must cover the executed trees");
  const verdict = verifyExecutionClosure({ manifest, repoRoot });
  assert.equal(verdict.ok, true, JSON.stringify(verdict.codes));
  assert.deepEqual(verdict.missing, []);
  assert.deepEqual(verdict.extra, []);
  assert.deepEqual(verdict.drifted, []);
});

test("H1: a byte drift in an executed file invalidates the closure", () => {
  const manifest = buildExecutionClosureManifest({ repoRoot });
  const target = manifest.files.find((entry) => entry.relative.endsWith("quality.py"));
  assert.ok(target, "the Runtime comprehension module must be in the closure");
  const drifted = { ...manifest, files: manifest.files.map((entry) => (
    entry.relative === target.relative ? { ...entry, sha256: "0".repeat(64) } : entry
  )) };
  const verdict = verifyExecutionClosure({ manifest: drifted, repoRoot });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(EXECUTION_CLOSURE_FAILURE.DRIFT));
});

test("H1: an omitted executed file and an extra file invalidate the closure", () => {
  const manifest = buildExecutionClosureManifest({ repoRoot });
  const omitted = {
    ...manifest,
    files: manifest.files.filter((entry) => !entry.relative.endsWith("stage_a_diagnostics.mjs")),
  };
  const missingVerdict = verifyExecutionClosure({ manifest: omitted, repoRoot });
  assert.equal(missingVerdict.ok, false);
  assert.ok(missingVerdict.codes.includes(EXECUTION_CLOSURE_FAILURE.EXTRA_FILE));

  const extra = {
    ...manifest,
    files: [...manifest.files, { relative: "scripts/stage_b_b5_3/lib/injected.mjs", sha256: "1".repeat(64), byteCount: 1 }],
  };
  const extraVerdict = verifyExecutionClosure({ manifest: extra, repoRoot });
  assert.equal(extraVerdict.ok, false);
  assert.ok(extraVerdict.codes.includes(EXECUTION_CLOSURE_FAILURE.MISSING_FILE));
});

test("H1: the snapshot is immutable and a symlinked or drifted snapshot file is refused", () => {
  const manifest = buildExecutionClosureManifest({ repoRoot });
  const snapshotRoot = path.join(scratch("navia-b6h-snapshot-"), "candidate");
  const materialized = materializeExecutionSnapshot({ manifest, repoRoot, snapshotRoot });
  assert.equal(materialized.ok, true, JSON.stringify(materialized.codes));
  const verdict = verifyExecutionSnapshot({ manifest, snapshotRoot });
  assert.equal(verdict.ok, true, JSON.stringify(verdict.codes));

  // A symlink in the snapshot is a MUTABLE PATH: it is refused.
  const target = manifest.files.find((entry) => entry.relative.endsWith("review_protocol.mjs"));
  const file = path.join(snapshotRoot, target.relative);
  fs.unlinkSync(file);
  fs.symlinkSync(path.join(repoRoot, target.relative), file);
  const symlinkVerdict = verifyExecutionSnapshot({ manifest, snapshotRoot });
  assert.equal(symlinkVerdict.ok, false);
  assert.ok(symlinkVerdict.codes.includes(EXECUTION_CLOSURE_FAILURE.SYMLINK));
});

test("H1: the snapshot is uniquely owned and an existing snapshot is refused", () => {
  const manifest = buildExecutionClosureManifest({ repoRoot });
  const snapshotRoot = path.join(scratch("navia-b6h-snapshot-"), "candidate");
  assert.equal(materializeExecutionSnapshot({ manifest, repoRoot, snapshotRoot }).ok, true);
  const second = materializeExecutionSnapshot({ manifest, repoRoot, snapshotRoot });
  assert.equal(second.ok, false);
  assert.ok(second.codes.includes(EXECUTION_CLOSURE_FAILURE.MUTABLE));
});

// ---------------------------------------------------------------------------
// H2 — the canonical review protocol
// ---------------------------------------------------------------------------

function validPrecommit() {
  return buildReviewPrecommit({
    repoRoot,
    runId: "b6h-offline",
    registryOrder: REGISTRY_ORDER,
    reviewOrder: ["6", "5", "2", "4", "3", "1"],
    firstSessionId: "session-one",
    secondSessionId: "session-two",
    secondPassSentinelPosition: 3,
  });
}

test("H2: the canonical protocol is loaded from the repository files", () => {
  const canonical = loadCanonicalReviewProtocol({ repoRoot });
  assert.equal(canonical.rubric.present, true);
  assert.equal(canonical.prompt.present, true);
  assert.ok(canonical.rubric.byteCount > 0);
  assert.match(canonical.rubric.sha256, /^[0-9a-f]{64}$/);
});

test("H2: a VALID precommit passes", () => {
  const verdict = reviewPrecommitDefects(validPrecommit(), { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(verdict.ok, true, JSON.stringify(verdict.codes));
});

test("H2: a CALLER-SUPPLIED rubric with self-consistent hashes is refused", () => {
  const precommit = validPrecommit();
  precommit.protocol.rubric = {
    path: "somewhere/else.md",
    present: true,
    byteCount: 999,
    sha256: "a".repeat(64),
  };
  const verdict = reviewPrecommitDefects(precommit, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(REVIEW_PROTOCOL_FAILURE.RUBRIC_DRIFT));
  assert.ok(verdict.codes.includes(REVIEW_PROTOCOL_FAILURE.CALLER_SUPPLIED));
});

test("H2: a ONE-BYTE canonical protocol drift is refused", () => {
  const precommit = validPrecommit();
  precommit.protocol.prompt = { ...precommit.protocol.prompt, sha256: "b".repeat(64) };
  const verdict = reviewPrecommitDefects(precommit, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(REVIEW_PROTOCOL_FAILURE.PROMPT_DRIFT));
});

test("H2: the WRONG byte count is refused", () => {
  const precommit = validPrecommit();
  precommit.protocol.rubric = { ...precommit.protocol.rubric, byteCount: precommit.protocol.rubric.byteCount + 1 };
  const verdict = reviewPrecommitDefects(precommit, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(REVIEW_PROTOCOL_FAILURE.BYTE_COUNT));
});

test("H2: the SWAPPED registry and review orders are refused", () => {
  const precommit = validPrecommit();
  precommit.registryOrder = [...precommit.reviewOrder];
  const verdict = reviewPrecommitDefects(precommit, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(REVIEW_PROTOCOL_FAILURE.REGISTRY_ORDER));
});

test("H2: a REPEATED review session is refused", () => {
  const precommit = validPrecommit();
  precommit.secondPass.sessionId = precommit.firstPass.sessionId;
  const verdict = reviewPrecommitDefects(precommit, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(REVIEW_PROTOCOL_FAILURE.SESSION_REUSED));
});

test("H2: an INVALID sentinel position is refused", () => {
  const precommit = validPrecommit();
  precommit.sentinel.firstPassPosition = precommit.sentinel.secondPassPosition;
  const verdict = reviewPrecommitDefects(precommit, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(REVIEW_PROTOCOL_FAILURE.SENTINEL_POSITION));

  const outOfRange = validPrecommit();
  outOfRange.sentinel.secondPassPosition = 9;
  const second = reviewPrecommitDefects(outOfRange, { repoRoot, expectedRegistryOrder: REGISTRY_ORDER });
  assert.equal(second.ok, false);
  assert.ok(second.codes.includes(REVIEW_PROTOCOL_FAILURE.SENTINEL_POSITION));
});

// ---------------------------------------------------------------------------
// H3 — the deterministic public evidence builder
// ---------------------------------------------------------------------------

function buildPackage(overrides = {}) {
  return buildSharedPackage({ repoRoot, ...overrides });
}

test("H3: the generated package is valid and its counts match its rows", () => {
  const built = buildPackage();
  const verdict = validatePublicEvidence(built.payloads, {
    runId: "gc-b6hr-offline",
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(verdict.ok, true, JSON.stringify(verdict.codes));
  assert.equal(built.counts.limited, 6);
  assert.equal(built.machineGatePositive, false);
});

test("H3: a MANUALLY ALTERED public row is refused", () => {
  const built = buildPackage();
  const payloads = built.payloads.map((payload) => {
    if (payload.name !== "02-six-source-machine-results.json") return payload;
    const parsed = JSON.parse(payload.content);
    parsed.sources[0].disposition = "complete";
    return { ...payload, content: `${JSON.stringify(parsed, null, 2)}\n` };
  });
  const verdict = validatePublicEvidence(payloads, {
    runId: "gc-b6hr-offline",
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.COUNT));
});

test("H3: a MALFORMED raw receipt is refused", () => {
  const built = buildPackage();
  const payloads = built.payloads.map((payload) => {
    if (payload.name !== "02-six-source-machine-results.json") return payload;
    const parsed = JSON.parse(payload.content);
    parsed.sources[0].extraField = "hand written";
    return { ...payload, content: `${JSON.stringify(parsed, null, 2)}\n` };
  });
  const verdict = validatePublicEvidence(payloads, {
    runId: "gc-b6hr-offline",
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.SCHEMA));
});

test("H3: a RUN BINDING mismatch is refused", () => {
  const built = buildPackage();
  const verdict = validatePublicEvidence(built.payloads, {
    runId: "another-run",
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(PUBLIC_EVIDENCE_FAILURE.RUN_BINDING));
});

test("H3: the manifest is generated from the payload bytes", () => {
  const built = buildPackage();
  const manifest = publicEvidenceManifest(built.payloads);
  assert.equal(manifest.split("\n").filter(Boolean).length, built.payloads.length);
  assert.match(manifest, /^[0-9a-f]{64} {2}00-review-precommit\.json$/m);
});

// ---------------------------------------------------------------------------
// H4 — the stable Stage A codes and the exact identity
// ---------------------------------------------------------------------------

test("H4: the authority budget is five minutes and the media budget is twenty", () => {
  assert.equal(STAGE_A_BUDGETS.authorityDeadlineMs, 5 * 60_000);
  assert.equal(STAGE_A_BUDGETS.mediaTaskDeadlineMs, 20 * 60_000);
  assert.equal(timeoutText(STAGE_A_BUDGETS.authorityDeadlineMs), "5 minutes");
  assert.equal(timeoutText(STAGE_A_BUDGETS.mediaTaskDeadlineMs), "20 minutes");
});

test("H4: the elapsed bucket is exact at the boundaries", () => {
  assert.equal(elapsedBucket(0), "under-1m");
  assert.equal(elapsedBucket(59_999), "under-1m");
  assert.equal(elapsedBucket(60_000), "1m-5m");
  assert.equal(elapsedBucket(5 * 60_000), "1m-5m");
  assert.equal(elapsedBucket(5 * 60_000 + 1), "5m-20m");
  assert.equal(elapsedBucket(20 * 60_000), "5m-20m");
  assert.equal(elapsedBucket(20 * 60_000 + 1), "over-20m");
});

test("H4: a FOREIGN identity that CONTAINS the bvid is not a match", () => {
  const bvid = "BV11t8w6oEtP";
  assert.equal(matchesFrozenIdentity(`portal:bilibili:${bvid}:1:p1`, { bvid }), true);
  // The bvid as a SUBSTRING of another id: never a match.
  assert.equal(matchesFrozenIdentity(`portal:bilibili:XBV11t8w6oEtP:1:p1`, { bvid }), false);
  assert.equal(matchesFrozenIdentity(`portal:bilibili:${bvid}2:1:p1`, { bvid }), false);
  // A foreign adapter: never a match.
  assert.equal(matchesFrozenIdentity(`portal:attacker:${bvid}:1:p1`, { bvid }), false);
  // A foreign namespace: never a match.
  assert.equal(matchesFrozenIdentity(`attacker:bilibili:${bvid}:1:p1`, { bvid }), false);
  // A malformed identity: never a match.
  assert.equal(matchesFrozenIdentity(`bilibili:${bvid}`, { bvid }), false);
  assert.equal(matchesFrozenIdentity(null, { bvid }), false);
});

test("H4: the stable codes are the frozen enums", () => {
  for (const code of Object.values(STAGE_A_CODE)) {
    assert.match(code, /^B6_STAGE_A_[A-Z_]+$/);
  }
  assert.equal(new Set(Object.values(STAGE_A_CODE)).size, Object.values(STAGE_A_CODE).length);
});

// ---------------------------------------------------------------------------
// H6 — the retention lifecycle
// ---------------------------------------------------------------------------

test("H6: a retention record must be diagnosis-only with an owner and a deadline", () => {
  const record = buildRetentionRecord({
    runId: "gc-b6b-20261025T175243Z",
    artifactKind: "private-review-bundle",
    root: "<private-root>",
    owner: "the Codex checkpoint",
    deadlineUtc: "2026-11-01T00:00:00Z",
    digests: ["a".repeat(64)],
  });
  const verdict = retentionRecordDefects(record);
  assert.equal(verdict.ok, true, JSON.stringify(verdict.codes));
  assert.equal(record.eligibleAsCandidateRow, false);
  assert.equal(record.eligibleAsBlindReviewInput, false);
  assert.equal(record.impliesB7Authorization, false);
  assert.equal(record.deletionReceiptRequired, true);
});

test("H6: a retention record without an owner, a deadline or the diagnosis-only flag is refused", () => {
  const record = buildRetentionRecord({ runId: "x", artifactKind: "y", root: "<private-root>" });
  const verdict = retentionRecordDefects(record);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.codes.includes(RETENTION_FAILURE.OWNER_MISSING));
  assert.ok(verdict.codes.includes(RETENTION_FAILURE.DEADLINE_MISSING));
  const eligible = { ...record, diagnosisOnly: false, eligibleAsCandidateRow: true };
  const second = retentionRecordDefects(eligible);
  assert.equal(second.ok, false);
  assert.ok(second.codes.includes(RETENTION_FAILURE.NOT_DIAGNOSIS_ONLY));
});

test("H6: a RETAINED negative-run artifact cannot enter a new candidate or review", () => {
  const root = scratch("navia-b6h-retained-");
  fs.writeFileSync(path.join(root, "artifact.json"), "{\"diagnostic\":true}\n", { mode: 0o600 });
  const digests = collectArtifactDigests(root);
  assert.ok(digests.length > 0);
  const record = buildRetentionRecord({
    runId: "gc-b6b-20261025T175243Z",
    artifactKind: "private-review-bundle",
    root,
    owner: "the Codex checkpoint",
    deadlineUtc: "2026-11-01T00:00:00Z",
    digests,
  });
  const verdict = rejectRetainedArtifacts({ digests, retentionRecords: [record] });
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.refused, digests);
  // A digest that is NOT retained is accepted.
  const other = rejectRetainedArtifacts({ digests: ["b".repeat(64)], retentionRecords: [record] });
  assert.equal(other.ok, true);
});
