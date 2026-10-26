// B6A — the candidate-bound aggregate and the repeated sentinel.
//
// The oracle is the PRODUCTION aggregate evaluator
// (`lib/b6_aggregate.mjs`) and the PRODUCTION candidate authority
// (`lib/b6_authority.mjs`). There are NO DEFAULTS: a missing authority, a
// missing rubric or prompt hash, a missing machine gate, a non-complete row,
// a changed sentinel claim set and a Provider identity at ANY depth are all
// refusals with a stable internal code.
//
// The four CODEX REPRODUCTIONS are the process-independent regression tests.
//
// No Chrome, no Runtime, no Provider, no download, no Cookie.

import test from "node:test";
import assert from "node:assert/strict";

import {
  B6_AGGREGATE_FAILURE,
  B6_AXIS_MINIMUM,
  B6_RUBRIC_AXES,
  evaluateB6Aggregate,
} from "../lib/b6_aggregate.mjs";
import { buildCandidateAuthority } from "../lib/b6_authority.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "../lib/registry.mjs";
import { sha256Hex } from "../lib/v21_artifact.mjs";

const RUBRIC_SHA256 = "a".repeat(64);
const PROMPT_SHA256 = "b".repeat(64);

/** The candidate authority of the fixture candidate. */
function authorityFixture(overrides = {}) {
  const sources = FROZEN_SIX.map((row) => ({
    order: row.order,
    bvid: row.bvid,
    taskId: `media_task_${row.order.padStart(32, "0")}`,
    taskRevision: 7,
    sourceIdentity: `portal:bilibili:${row.bvid}:41828944992:p1`,
    dependencyGeneration: `depgen_${sha256Hex(`dependency-${row.order}`)}`,
    derivativeSha256: sha256Hex(`derivative-${row.order}`),
    captureArtifactSha256: sha256Hex(`derivative-${row.order}`),
    bundleSha256: sha256Hex(`bundle-${row.order}`),
    reviewBindingSha256: sha256Hex(`review-${row.order}`),
    captureStatus: "captured",
    captureCounts: { evidence: 4, thumbnails: 1, chapters: 2 },
    captureClosure: {
      identityClosed: true,
      catalogClosed: true,
      thumbnailsClosed: true,
      seekClosed: true,
    },
  }));
  return buildCandidateAuthority({
    runId: "b6-candidate-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    machineGatePositive: true,
    sources,
    captureStatus: "captured",
    closureCounts: { evidence: 24, thumbnails: 6, chapters: 12 },
    ...overrides,
  });
}

/** The authority source of one order. */
function sourceOf(authority, order) {
  return authority.sources.find((source) => source.order === String(order));
}

function reviewRow(order, authority, overrides = {}) {
  const row = FROZEN_SIX.find((entry) => entry.order === String(order));
  const source = sourceOf(authority, order);
  return {
    order: String(order),
    bvid: row.bvid,
    taskId: source.taskId,
    taskRevision: source.taskRevision,
    sourceIdentity: source.sourceIdentity,
    bundleSha256: source.bundleSha256,
    reviewBindingSha256: source.reviewBindingSha256,
    reviewSessionId: `session-${order}`,
    rubricSha256: RUBRIC_SHA256,
    promptSha256: PROMPT_SHA256,
    axes: {
      factualAccuracy: 5,
      wholeVideoCoverage: 4,
      contentValueFit: 4,
      chapterBoundaryQuality: 5,
    },
    criticalErrors: [],
    thesisVerdict: "supported",
    materialClaimVerdicts: [{ claimId: `claim_${String(order).padStart(16, "0")}`, verdict: "supported" }],
    disposition: "complete",
    ...overrides,
  };
}

function sentinel(authority, overrides = {}) {
  const source = sourceOf(authority, "3");
  const base = {
    sourceOrder: "3",
    reviews: [
      {
        order: "3",
        reviewSessionId: "sentinel-session-a",
        position: 2,
        rubricSha256: RUBRIC_SHA256,
        promptSha256: PROMPT_SHA256,
        axes: { factualAccuracy: 5, wholeVideoCoverage: 4, contentValueFit: 4, chapterBoundaryQuality: 5 },
        criticalErrors: [],
        thesisVerdict: "supported",
        materialClaimVerdicts: [{ claimId: `claim_${"3".padStart(16, "0")}`, verdict: "supported" }],
        reviewBindingSha256: source.reviewBindingSha256,
      },
      {
        order: "3",
        reviewSessionId: "sentinel-session-b",
        position: 5,
        rubricSha256: RUBRIC_SHA256,
        promptSha256: PROMPT_SHA256,
        axes: { factualAccuracy: 4, wholeVideoCoverage: 4, contentValueFit: 4, chapterBoundaryQuality: 5 },
        criticalErrors: [],
        thesisVerdict: "supported",
        materialClaimVerdicts: [{ claimId: `claim_${"3".padStart(16, "0")}`, verdict: "supported" }],
        reviewBindingSha256: source.reviewBindingSha256,
      },
    ],
  };
  const merged = { ...base, ...overrides };
  if (overrides.reviews) merged.reviews = overrides.reviews;
  return merged;
}

function evaluate(rows, sentinelValue = null, expected = {}, authority = null) {
  const candidate = authority ?? authorityFixture();
  return evaluateB6Aggregate({
    rows,
    sentinel: sentinelValue ?? sentinel(candidate),
    authority: candidate,
    expected: {
      rubricSha256: RUBRIC_SHA256,
      promptSha256: PROMPT_SHA256,
      ...expected,
    },
  });
}

function codesOf(verdict) {
  return verdict.failures.map((failure) => failure.code);
}

function sixRows(authority = authorityFixture()) {
  return FROZEN_SIX.map((entry) => reviewRow(entry.order, authority));
}

// ============================================================================
// Group 6 — the aggregate and the sentinel (10)
// ============================================================================

test("B6 aggregate 1/10: the positive control passes", () => {
  const authority = authorityFixture();
  const verdict = evaluate(sixRows(authority), sentinel(authority), {}, authority);
  assert.deepEqual(verdict.failures, [], JSON.stringify(verdict.failures));
  assert.equal(verdict.positive, true);
  assert.equal(verdict.counts.complete, 6);
});

test("B6 aggregate 2/10: the EXACT threshold (every axis = 4) passes", () => {
  const authority = authorityFixture();
  const rows = sixRows(authority).map((row) => ({
    ...row,
    axes: Object.fromEntries(B6_RUBRIC_AXES.map((axis) => [axis, B6_AXIS_MINIMUM])),
  }));
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.deepEqual(verdict.failures, [], JSON.stringify(verdict.failures));
});

test("B6 aggregate 3/10: ONE UNDER the threshold fails", () => {
  const authority = authorityFixture();
  const rows = sixRows(authority);
  rows[2].axes = { ...rows[2].axes, factualAccuracy: B6_AXIS_MINIMUM - 1 };
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.AXIS_BELOW_MINIMUM));
});

test("B6 aggregate 4/10: a MISSING row fails", () => {
  const authority = authorityFixture();
  const rows = sixRows(authority).slice(0, 5);
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.ROW_MISSING));
});

test("B6 aggregate 5/10: a DUPLICATE row fails", () => {
  const authority = authorityFixture();
  const rows = sixRows(authority);
  // The SAME source is reviewed twice: the fourth row repeats the third.
  rows[3] = { ...rows[2], reviewSessionId: "session-duplicate" };
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.ROW_DUPLICATE));
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.ROW_MISSING));
});

test("B6 aggregate 6/10: a CRITICAL error fails", () => {
  const authority = authorityFixture();
  const rows = sixRows(authority);
  rows[1].criticalErrors = ["materialFactContradiction"];
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.CRITICAL_ERROR));
});

test("B6 aggregate 7/10: a REVERSED sentinel fails", () => {
  const authority = authorityFixture();
  const reversed = sentinel(authority);
  reversed.reviews[1].thesisVerdict = "unsupported";
  const verdict = evaluate(sixRows(authority), reversed, {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.SENTINEL_REVERSED));
});

test("B6 aggregate 8/10: the sentinel in the SAME session fails", () => {
  const authority = authorityFixture();
  const shared = sentinel(authority);
  shared.reviews[1].reviewSessionId = shared.reviews[0].reviewSessionId;
  const verdict = evaluate(sixRows(authority), shared, {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.SENTINEL_SESSION));
});

test("B6 aggregate 9/10: a RUBRIC hash drift fails", () => {
  const authority = authorityFixture();
  const rows = sixRows(authority);
  rows[4].rubricSha256 = "c".repeat(64);
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.RUBRIC_DRIFT));
});

test("B6 aggregate 10/10: a VISIBLE Provider identity fails", () => {
  const authority = authorityFixture();
  const rows = sixRows(authority);
  rows[0].providerId = "minimax-cn-openai-vision";
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.PROVIDER_LEAK));
});

test("B6 aggregate: the sentinel position and the machine gate are enforced", () => {
  const authority = authorityFixture();
  const samePosition = sentinel(authority);
  samePosition.reviews[1].position = samePosition.reviews[0].position;
  assert.ok(
    codesOf(evaluate(sixRows(authority), samePosition, {}, authority))
      .includes(B6_AGGREGATE_FAILURE.SENTINEL_POSITION),
  );
  const drifted = sentinel(authority);
  drifted.reviews[1].axes = { ...drifted.reviews[1].axes, factualAccuracy: 1 };
  assert.ok(
    codesOf(evaluate(sixRows(authority), drifted, {}, authority))
      .includes(B6_AGGREGATE_FAILURE.SENTINEL_SCORE_DRIFT),
  );
  const negativeGate = authorityFixture({ machineGatePositive: false });
  assert.ok(
    codesOf(evaluate(sixRows(negativeGate), sentinel(negativeGate), {}, negativeGate))
      .includes(B6_AGGREGATE_FAILURE.MACHINE_GATE),
  );
});

// ============================================================================
// The CODEX REPRODUCTIONS (process-independent regressions)
// ============================================================================

test("B6 codex 1/4: a MISSING authority fails (the old default was true)", () => {
  const authority = authorityFixture();
  const verdict = evaluateB6Aggregate({
    rows: sixRows(authority),
    sentinel: sentinel(authority),
    authority: null,
    expected: { rubricSha256: RUBRIC_SHA256, promptSha256: PROMPT_SHA256 },
  });
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.AUTHORITY_MISSING));
});

test("B6 codex 2/4: six FAILED rows fail (a failed row is never a complete review)", () => {
  const authority = authorityFixture();
  const rows = sixRows(authority).map((row) => ({ ...row, disposition: "failed" }));
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.ROW_NOT_COMPLETE));
});

test("B6 codex 3/4: a NESTED Provider identity fails (any depth)", () => {
  const authority = authorityFixture();
  const rows = sixRows(authority);
  rows[0].meta = { providerId: "minimax-cn-openai-vision" };
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.PROVIDER_LEAK));
});

test("B6 codex 4/4: an EMPTY second sentinel claim set fails", () => {
  const authority = authorityFixture();
  const changed = sentinel(authority);
  changed.reviews[1].materialClaimVerdicts = [];
  const verdict = evaluate(sixRows(authority), changed, {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.SENTINEL_CLAIM_SET));
});

// ============================================================================
// The defect CLASSES of the candidate authority
// ============================================================================

test("B6 authority 1: a MISSING rubric hash is a refusal, never a default", () => {
  const authority = authorityFixture();
  const verdict = evaluateB6Aggregate({
    rows: sixRows(authority),
    sentinel: sentinel(authority),
    authority,
    expected: { promptSha256: PROMPT_SHA256 },
  });
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.HASH_MISSING));
});

test("B6 authority 2: a row that is NOT bound to the authority source fails", () => {
  const authority = authorityFixture();
  const rows = sixRows(authority);
  rows[3].bundleSha256 = "d".repeat(64);
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.BINDING));
});

test("B6 authority 3: a row with a STALE task revision fails", () => {
  const authority = authorityFixture();
  const rows = sixRows(authority);
  rows[0].taskRevision = 6;
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.BINDING));
});

test("B6 authority 4: an authority that is NOT captured fails", () => {
  const authority = authorityFixture({ captureStatus: "failed" });
  const verdict = evaluate(sixRows(authority), sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.AUTHORITY_INVALID));
});

test("B6 authority 5: an authority with FIVE sources fails", () => {
  const authority = authorityFixture();
  authority.sources = authority.sources.slice(0, 5);
  const verdict = evaluate(sixRows(authorityFixture()), sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.AUTHORITY_INVALID));
});

test("B6 authority 6: a sentinel that is NOT bound to the authority fails", () => {
  const authority = authorityFixture();
  const changed = sentinel(authority);
  changed.reviews[1].reviewBindingSha256 = "e".repeat(64);
  const verdict = evaluate(sixRows(authority), changed, {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.BINDING));
});

test("B6 authority 7: a sentinel with a CHANGED claim set fails", () => {
  const authority = authorityFixture();
  const changed = sentinel(authority);
  changed.reviews[1].materialClaimVerdicts = [
    { claimId: `claim_${"9".padStart(16, "0")}`, verdict: "supported" },
  ];
  const verdict = evaluate(sixRows(authority), changed, {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.SENTINEL_CLAIM_SET));
});

test("B6 authority 8: a row with an UNEXPECTED key is a schema failure", () => {
  const authority = authorityFixture();
  const rows = sixRows(authority);
  rows[0].extraFact = "the reviewer added a field";
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.ROW_SCHEMA));
});

test("B6 authority 9: ZERO closure totals are a refusal", () => {
  const authority = authorityFixture({ closureCounts: { evidence: 0, thumbnails: 0, chapters: 0 } });
  const verdict = evaluate(sixRows(authority), sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.AUTHORITY_INVALID));
});

test("B6 authority 10: a FOREIGN source identity is a refusal", () => {
  const authority = authorityFixture();
  authority.sources[0].sourceIdentity = `portal:attacker:${authority.sources[0].bvid}:unit:p1`;
  const rows = sixRows(authority);
  const verdict = evaluate(rows, sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.AUTHORITY_INVALID));
});

test("B6 authority 11: a capture artifact that differs from the machine derivative is a refusal", () => {
  const authority = authorityFixture();
  authority.sources[0].captureArtifactSha256 = "f".repeat(64);
  const verdict = evaluate(sixRows(authority), sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.AUTHORITY_INVALID));
});

test("B6 authority 12: a source with an OPEN capture closure is a refusal", () => {
  const authority = authorityFixture();
  authority.sources[0].captureClosure.seekClosed = false;
  const verdict = evaluate(sixRows(authority), sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.AUTHORITY_INVALID));
});

test("B6 authority 13: a FOREIGN registry digest is refused without caller hints", () => {
  const authority = authorityFixture();
  authority.registrySha256 = "f".repeat(64);
  const verdict = evaluate(sixRows(authority), sentinel(authority), {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.AUTHORITY_INVALID));
});

test("B6 sentinel: both reviews must use the source frozen before B6B", () => {
  const authority = authorityFixture();
  const changed = sentinel(authority);
  changed.reviews[0].order = "2";
  changed.reviews[0].reviewBindingSha256 = sourceOf(authority, "2").reviewBindingSha256;
  const verdict = evaluate(sixRows(authority), changed, {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.SENTINEL_SCHEMA));
});

test("B6 sentinel: two consistently substituted reviews are still refused", () => {
  const authority = authorityFixture();
  const changed = sentinel(authority);
  for (const review of changed.reviews) {
    review.order = "2";
    review.reviewBindingSha256 = sourceOf(authority, "2").reviewBindingSha256;
  }
  const verdict = evaluate(sixRows(authority), changed, {}, authority);
  assert.equal(verdict.positive, false);
  assert.ok(codesOf(verdict).includes(B6_AGGREGATE_FAILURE.SENTINEL_SCHEMA));
});
