// The CANONICAL review protocol of the GC-B6 blind semantic review.
//
// The rubric and the prompt are REPOSITORY-TRACKED, VERSIONED files. The
// harness loads THOSE files and never a caller-supplied replacement: a
// caller that hashes its own alternative bytes produces a formally
// self-consistent but semantically incomparable review, and that is exactly
// what this owner refuses.
//
// The precommit keeps the IMMUTABLE registry order and the RANDOM review
// order in SEPARATE fields: they are different facts and conflating them is
// how a review loses its meaning.
//
// The precommit is BINDING: the run id, the two session ids, the two pass
// records, the sentinel source and the two distinct sentinel positions are
// all bound to the recorded order. A precommit whose pass record claims a
// position that the sentinel does not carry is a REFUSAL, not a warning.

import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomInt as randomIntImpl } from "node:crypto";

/** The precommit schema version. */
export const REVIEW_PROTOCOL_SCHEMA = "v3-5.10-b6-review-precommit/v2";

/** The canonical protocol files, relative to the repository root. */
export const REVIEW_PROTOCOL_FILES = Object.freeze({
  rubric: "scripts/stage_b_b5_3/protocol/review-rubric.v1.md",
  prompt: "scripts/stage_b_b5_3/protocol/review-prompt.v1.md",
});

/** The first Codex-frozen canonical protocol bytes (2026-10-26). */
export const REVIEW_PROTOCOL_FROZEN = Object.freeze({
  rubric: Object.freeze({
    path: REVIEW_PROTOCOL_FILES.rubric,
    byteCount: 3838,
    sha256: "60a32cd9a9334a702a6b588ae864194426c82c7130d43cd2f979748e1255f5de",
  }),
  prompt: Object.freeze({
    path: REVIEW_PROTOCOL_FILES.prompt,
    byteCount: 5353,
    sha256: "6c1f53f2aab1981937aa0f97f8c95a9102ed0ff763e30212bc65ae89826e87d2",
  }),
});

/** The frozen sentinel of the blind review. */
export const REVIEW_SENTINEL_REGISTRY_ORDER = "3";

/** The stable protocol defect codes. */
export const REVIEW_PROTOCOL_FAILURE = Object.freeze({
  SCHEMA: "REVIEW_PROTOCOL_SCHEMA_INVALID",
  RUBRIC_MISSING: "REVIEW_PROTOCOL_RUBRIC_MISSING",
  PROMPT_MISSING: "REVIEW_PROTOCOL_PROMPT_MISSING",
  RUBRIC_DRIFT: "REVIEW_PROTOCOL_RUBRIC_DRIFT",
  PROMPT_DRIFT: "REVIEW_PROTOCOL_PROMPT_DRIFT",
  BYTE_COUNT: "REVIEW_PROTOCOL_BYTE_COUNT_MISMATCH",
  REGISTRY_ORDER: "REVIEW_PROTOCOL_REGISTRY_ORDER_INVALID",
  REVIEW_ORDER: "REVIEW_PROTOCOL_REVIEW_ORDER_INVALID",
  SESSION_REUSED: "REVIEW_PROTOCOL_SESSION_REUSED",
  SENTINEL_SOURCE: "REVIEW_PROTOCOL_SENTINEL_SOURCE_INVALID",
  SENTINEL_POSITION: "REVIEW_PROTOCOL_SENTINEL_POSITION_INVALID",
  CALLER_SUPPLIED: "REVIEW_PROTOCOL_CALLER_SUPPLIED_REPLACEMENT",
  RUN_ID_MISSING: "REVIEW_PROTOCOL_RUN_ID_MISSING",
  PASS_POSITION: "REVIEW_PROTOCOL_PASS_POSITION_MISMATCH",
  PASS_ORDER: "REVIEW_PROTOCOL_PASS_ORDER_INVALID",
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Load the CANONICAL protocol bytes.
 *
 * The loader reads ONLY the repository-tracked files. It never accepts a
 * caller-supplied path, a caller-supplied byte string or a caller-supplied
 * hash.
 *
 * @returns {{rubric: object, prompt: object}}
 */
export function loadCanonicalReviewProtocol({ repoRoot } = {}) {
  const root = path.resolve(repoRoot ?? process.cwd());
  const load = (relative) => {
    const target = path.join(root, relative);
    if (!fs.existsSync(target)) return { path: relative, present: false, byteCount: 0, sha256: null };
    const bytes = fs.readFileSync(target);
    return {
      path: relative,
      present: true,
      byteCount: bytes.length,
      sha256: sha256(bytes),
    };
  };
  return { rubric: load(REVIEW_PROTOCOL_FILES.rubric), prompt: load(REVIEW_PROTOCOL_FILES.prompt) };
}

/**
 * Build the review precommit.
 *
 * The builder takes NO rubric, NO prompt, NO hash and NO byte string from
 * the caller: the protocol is loaded from the canonical files. The review
 * order is drawn by the caller (it is a random presentation order) and the
 * registry order is an immutable fact of the run.
 */
export function buildReviewPrecommit({
  repoRoot,
  runId = null,
  registryOrder,
  reviewOrder,
  firstSessionId,
  secondSessionId,
  sentinelRegistryOrder = REVIEW_SENTINEL_REGISTRY_ORDER,
  secondPassSentinelPosition = null,
} = {}) {
  const canonical = loadCanonicalReviewProtocol({ repoRoot });
  // The FIRST pass position is derived from the random review order. The
  // SECOND pass position is a separate, DISTINCT placement: the sentinel is
  // never reviewed twice at the same position.
  const firstPassPosition = reviewOrder.indexOf(sentinelRegistryOrder) + 1;
  const secondPassPosition = Number(secondPassSentinelPosition ?? firstPassPosition);
  const order = [...(reviewOrder ?? [])];
  return {
    schemaVersion: REVIEW_PROTOCOL_SCHEMA,
    batch: "GC-B6 BLIND SEMANTIC REVIEW",
    runId: runId ?? null,
    // The IMMUTABLE source order and the RANDOM presentation order are two
    // different facts.
    registryOrder: [...(registryOrder ?? [])],
    reviewOrder: order,
    protocol: {
      rubric: canonical.rubric,
      prompt: canonical.prompt,
    },
    firstPass: {
      sessionId: firstSessionId ?? null,
      order,
      sentinelPosition: firstPassPosition,
    },
    secondPass: {
      sessionId: secondSessionId ?? null,
      order,
      sentinelPosition: secondPassPosition,
    },
    sentinel: {
      registryOrder: sentinelRegistryOrder,
      firstPassPosition,
      secondPassPosition,
    },
  };
}

/**
 * The defects of a review precommit.
 *
 * The check re-loads the canonical protocol and compares the RECORDED byte
 * count and hash with it: a caller-supplied alternative (even a
 * self-consistent one) is a drift.
 *
 * @returns {{ok: boolean, codes: string[]}}
 */
export function reviewPrecommitDefects(precommit, { repoRoot, expectedRegistryOrder = null } = {}) {
  const codes = [];
  if (!precommit || typeof precommit !== "object" || Array.isArray(precommit)) {
    return { ok: false, codes: [REVIEW_PROTOCOL_FAILURE.SCHEMA] };
  }
  if (precommit.schemaVersion !== REVIEW_PROTOCOL_SCHEMA) {
    codes.push(REVIEW_PROTOCOL_FAILURE.SCHEMA);
  }
  // The RUN ID is mandatory: a precommit that does not belong to a run may
  // never authorize a review.
  if (typeof precommit.runId !== "string" || !precommit.runId.trim()) {
    codes.push(REVIEW_PROTOCOL_FAILURE.RUN_ID_MISSING);
  }
  const canonical = loadCanonicalReviewProtocol({ repoRoot });
  for (const [key, label] of [["rubric", "RUBRIC"], ["prompt", "PROMPT"]]) {
    const recorded = precommit.protocol?.[key] ?? null;
    const expected = canonical[key];
    const frozen = REVIEW_PROTOCOL_FROZEN[key];
    if (!recorded || recorded.present !== true) {
      codes.push(REVIEW_PROTOCOL_FAILURE[`${label}_MISSING`]);
      continue;
    }
    if (!expected.present) {
      codes.push(REVIEW_PROTOCOL_FAILURE[`${label}_MISSING`]);
      continue;
    }
    if (expected.sha256 !== frozen.sha256) {
      codes.push(REVIEW_PROTOCOL_FAILURE[`${label}_DRIFT`]);
    }
    if (Number(expected.byteCount) !== frozen.byteCount) {
      codes.push(REVIEW_PROTOCOL_FAILURE.BYTE_COUNT);
    }
    if (expected.path !== frozen.path) {
      codes.push(REVIEW_PROTOCOL_FAILURE.CALLER_SUPPLIED);
    }
    if (recorded.sha256 !== expected.sha256) {
      codes.push(REVIEW_PROTOCOL_FAILURE[`${label}_DRIFT`]);
    }
    if (Number(recorded.byteCount) !== Number(expected.byteCount)) {
      codes.push(REVIEW_PROTOCOL_FAILURE.BYTE_COUNT);
    }
    if (recorded.path !== expected.path) {
      codes.push(REVIEW_PROTOCOL_FAILURE.CALLER_SUPPLIED);
    }
  }
  const registryOrder = Array.isArray(precommit.registryOrder) ? precommit.registryOrder.map(String) : [];
  const reviewOrder = Array.isArray(precommit.reviewOrder) ? precommit.reviewOrder.map(String) : [];
  if (expectedRegistryOrder) {
    const expected = expectedRegistryOrder.map(String);
    if (JSON.stringify(registryOrder) !== JSON.stringify(expected)) {
      codes.push(REVIEW_PROTOCOL_FAILURE.REGISTRY_ORDER);
    }
  } else if (registryOrder.length === 0) {
    codes.push(REVIEW_PROTOCOL_FAILURE.REGISTRY_ORDER);
  }
  if (reviewOrder.length !== registryOrder.length
    || JSON.stringify([...reviewOrder].sort()) !== JSON.stringify([...registryOrder].sort())) {
    codes.push(REVIEW_PROTOCOL_FAILURE.REVIEW_ORDER);
  }
  const firstSession = precommit.firstPass?.sessionId ?? null;
  const secondSession = precommit.secondPass?.sessionId ?? null;
  if (!firstSession || !secondSession) {
    codes.push(REVIEW_PROTOCOL_FAILURE.SESSION_REUSED);
  } else if (firstSession === secondSession) {
    codes.push(REVIEW_PROTOCOL_FAILURE.SESSION_REUSED);
  }
  const sentinelOrder = String(precommit.sentinel?.registryOrder ?? "");
  if (sentinelOrder !== REVIEW_SENTINEL_REGISTRY_ORDER) {
    codes.push(REVIEW_PROTOCOL_FAILURE.SENTINEL_SOURCE);
  }
  const firstPosition = Number(precommit.sentinel?.firstPassPosition ?? 0);
  const secondPosition = Number(precommit.sentinel?.secondPassPosition ?? 0);
  const total = registryOrder.length || reviewOrder.length || 6;
  if (!Number.isInteger(firstPosition) || firstPosition < 1 || firstPosition > total) {
    codes.push(REVIEW_PROTOCOL_FAILURE.SENTINEL_POSITION);
  }
  if (!Number.isInteger(secondPosition) || secondPosition < 1 || secondPosition > total) {
    codes.push(REVIEW_PROTOCOL_FAILURE.SENTINEL_POSITION);
  }
  if (firstPosition === secondPosition) {
    codes.push(REVIEW_PROTOCOL_FAILURE.SENTINEL_POSITION);
  }
  // The PASS RECORDS are bound to the sentinel: the position a pass claims
  // is the position the sentinel carries, and the pass order is the review
  // order.
  const firstPassPosition = Number(precommit.firstPass?.sentinelPosition ?? 0);
  const secondPassPosition = Number(precommit.secondPass?.sentinelPosition ?? 0);
  if (firstPassPosition !== firstPosition || secondPassPosition !== secondPosition) {
    codes.push(REVIEW_PROTOCOL_FAILURE.PASS_POSITION);
  }
  if (reviewOrder.length > 0) {
    const firstOrder = Array.isArray(precommit.firstPass?.order) ? precommit.firstPass.order.map(String) : null;
    const secondOrder = Array.isArray(precommit.secondPass?.order) ? precommit.secondPass.order.map(String) : null;
    if (!firstOrder || JSON.stringify(firstOrder) !== JSON.stringify(reviewOrder)) {
      codes.push(REVIEW_PROTOCOL_FAILURE.PASS_ORDER);
    }
    if (!secondOrder || JSON.stringify(secondOrder) !== JSON.stringify(reviewOrder)) {
      codes.push(REVIEW_PROTOCOL_FAILURE.PASS_ORDER);
    }
  }
  // The FIRST pass position is the position of the sentinel in the review
  // order: it is derived, never declared.
  if (reviewOrder.length > 0) {
    const derived = reviewOrder.indexOf(sentinelOrder) + 1;
    if (derived > 0 && firstPosition !== derived) {
      codes.push(REVIEW_PROTOCOL_FAILURE.PASS_POSITION);
    }
  }
  return { ok: codes.length === 0, codes: [...new Set(codes)].sort() };
}

/**
 * Build AND validate the precommit of a candidate.
 *
 * The single entrypoint of the review path: it loads the canonical bytes,
 * builds the precommit and validates it. A caller that wants a precommit
 * gets a VALIDATED one or a refusal.
 */
export function buildValidatedReviewPrecommit({
  repoRoot,
  runId,
  registryOrder,
  reviewOrder,
  firstSessionId,
  secondSessionId,
  sentinelRegistryOrder = REVIEW_SENTINEL_REGISTRY_ORDER,
  secondPassSentinelPosition = null,
} = {}) {
  const precommit = buildReviewPrecommit({
    repoRoot,
    runId,
    registryOrder,
    reviewOrder,
    firstSessionId,
    secondSessionId,
    sentinelRegistryOrder,
    secondPassSentinelPosition,
  });
  const verdict = reviewPrecommitDefects(precommit, { repoRoot, expectedRegistryOrder: registryOrder });
  return { ok: verdict.ok, codes: verdict.codes, precommit };
}

/**
 * The RANDOM presentation order of a review.
 *
 * The order is a permutation of the registry order and it is drawn with a
 * cryptographically strong source. It is drawn BEFORE the first external
 * action and it never changes afterwards.
 */
export function drawReviewOrder({ registryOrder = [], randomInt = null } = {}) {
  const order = [...registryOrder].map(String);
  const source = randomInt ?? ((max) => randomIntImpl(max));
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = source(index + 1);
    const held = order[index];
    order[index] = order[swap];
    order[swap] = held;
  }
  return order;
}

/**
 * The sentinel position of the SECOND pass.
 *
 * It is DIFFERENT from the first pass position: the sentinel is never
 * reviewed twice at the same position.
 */
export function drawSecondPassSentinelPosition({ total = 6, firstPassPosition = 1, randomInt = null } = {}) {
  const source = randomInt ?? ((max) => randomIntImpl(max));
  const positions = [];
  for (let position = 1; position <= total; position += 1) {
    if (position !== Number(firstPassPosition)) positions.push(position);
  }
  if (positions.length === 0) return Number(firstPassPosition);
  return positions[source(positions.length)];
}

/**
 * The two review session ids of a candidate.
 *
 * They are DISTINCT by construction: the sentinel is never reviewed twice in
 * the same session.
 */
export function drawReviewSessions({ runId = "b6" } = {}) {
  const first = `b6-pass1-${randomBytes(12).toString("hex")}`;
  const second = `b6-pass2-${randomBytes(12).toString("hex")}`;
  return { firstSessionId: first, secondSessionId: second };
}
