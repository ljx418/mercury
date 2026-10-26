// The B-6 semantic aggregate (acceptance harness only).
//
// It is PURE: it takes the six per-source review rows, the repeated
// sentinel review and the CANDIDATE AUTHORITY, and it returns a verdict.
//
// There are NO DEFAULTS. A missing authority, a missing rubric or prompt
// hash, a missing machine gate, a non-complete row, a changed sentinel claim
// set or a Provider identity at ANY depth is a refusal.
//
// The positive verdict requires:
//   * one exact candidate authority (run id, registry digest, a POSITIVE
//     machine gate, the exact six ordered source identities with their task,
//     revision, dependency generation, derivative, bundle and blind
//     review-binding hashes, the capture status and the closure counts);
//   * exactly six rows, one per authority source, all `complete`;
//   * every row bound to its authority source and to the frozen rubric and
//     prompt hashes;
//   * the four frozen axes, each an integer 1..5 and each at least 4 (no
//     averaging may compensate a weak axis);
//   * zero critical errors on every row;
//   * a sentinel reviewed TWICE, in DIFFERENT sessions and in DIFFERENT
//     positions, with the SAME material-claim id set, no reversed thesis or
//     claim verdict and a score difference of at most one;
//   * no Provider identity anywhere, at any depth.

import { FROZEN_SIX } from "./registry.mjs";
import { authoritySource, candidateAuthorityDefects } from "./b6_authority.mjs";

/** The aggregate's schema version. */
export const B6_AGGREGATE_SCHEMA = "v3-5.10-b6-semantic-aggregate/v1";

/** The four frozen rubric axes. */
export const B6_RUBRIC_AXES = Object.freeze([
  "factualAccuracy",
  "wholeVideoCoverage",
  "contentValueFit",
  "chapterBoundaryQuality",
]);

/** The frozen score range and the frozen minimum of every axis. */
export const B6_SCORE_MINIMUM = 1;
export const B6_SCORE_MAXIMUM = 5;
export const B6_AXIS_MINIMUM = 4;
/** Frozen before B6B: the sentinel is registry row 3, never selected after review. */
export const B6_SENTINEL_SOURCE_ORDER = "3";

/** The frozen critical error codes. */
export const B6_CRITICAL_ERRORS = Object.freeze([
  "materialFactContradiction",
  "claimEvidenceUnsupported",
  "screenshotSeekWrongContent",
  "onlyOpeningCovered",
  "unlabelledEvidenceConflict",
  "crossTaskSourceRunSplice",
  "rawMediaSecretPathLeak",
]);

/** The frozen verdict vocabulary of a thesis or a material claim. */
export const B6_VERDICTS = Object.freeze([
  "supported",
  "partially_supported",
  "unsupported",
]);

/** The EXACT key set of one review row. */
export const B6_REVIEW_ROW_KEYS = Object.freeze([
  "order", "bvid", "taskId", "taskRevision", "sourceIdentity", "bundleSha256", "reviewBindingSha256",
  "reviewSessionId", "rubricSha256", "promptSha256", "axes", "criticalErrors",
  "thesisVerdict", "materialClaimVerdicts", "disposition",
]);

/** The EXACT key set of one sentinel review. */
export const B6_SENTINEL_REVIEW_KEYS = Object.freeze([
  "order", "reviewSessionId", "position", "rubricSha256", "promptSha256", "axes",
  "criticalErrors", "thesisVerdict", "materialClaimVerdicts", "reviewBindingSha256",
]);

/** The EXACT key set of one material-claim verdict. */
export const B6_MATERIAL_CLAIM_KEYS = Object.freeze(["claimId", "verdict"]);

/** The Provider identity keys that may NEVER appear, at any depth. */
export const B6_PROVIDER_IDENTITY_FIELDS = Object.freeze([
  "providerId", "modelId", "endpointClass", "structureMode", "attemptId",
  "requestSha256", "responseSha256", "outboundDerivedTextSha256",
  "finishReason", "usage", "receipt", "authorization",
]);

/** The stable failure codes of the aggregate. */
export const B6_AGGREGATE_FAILURE = Object.freeze({
  AUTHORITY_MISSING: "B6_AUTHORITY_MISSING",
  AUTHORITY_INVALID: "B6_AUTHORITY_INVALID",
  ROW_MISSING: "B6_ROW_MISSING",
  ROW_DUPLICATE: "B6_ROW_DUPLICATE",
  ROW_ORDER: "B6_ROW_ORDER",
  ROW_SCHEMA: "B6_ROW_SCHEMA_INVALID",
  ROW_NOT_COMPLETE: "B6_ROW_NOT_COMPLETE",
  AXIS_MISSING: "B6_AXIS_MISSING",
  AXIS_RANGE: "B6_AXIS_RANGE",
  AXIS_BELOW_MINIMUM: "B6_AXIS_BELOW_MINIMUM",
  CRITICAL_ERROR: "B6_CRITICAL_ERROR",
  BINDING: "B6_ROW_BINDING_MISMATCH",
  HASH_MISSING: "B6_HASH_MISSING",
  SENTINEL_MISSING: "B6_SENTINEL_MISSING",
  SENTINEL_SCHEMA: "B6_SENTINEL_SCHEMA_INVALID",
  SENTINEL_SESSION: "B6_SENTINEL_SESSION",
  SENTINEL_POSITION: "B6_SENTINEL_POSITION",
  SENTINEL_CLAIM_SET: "B6_SENTINEL_CLAIM_SET_CHANGED",
  SENTINEL_VERDICT: "B6_SENTINEL_VERDICT_INVALID",
  SENTINEL_REVERSED: "B6_SENTINEL_REVERSED",
  SENTINEL_SCORE_DRIFT: "B6_SENTINEL_SCORE_DRIFT",
  RUBRIC_DRIFT: "B6_RUBRIC_HASH_DRIFT",
  PROMPT_DRIFT: "B6_PROMPT_HASH_DRIFT",
  PROVIDER_LEAK: "B6_PROVIDER_IDENTITY_VISIBLE",
  MACHINE_GATE: "B6_MACHINE_GATE_NOT_POSITIVE",
});

const SHA256_HEX = /^[0-9a-f]{64}$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

/** The Provider identity keys found anywhere in a value. */
export function findProviderIdentityKeys(value, path = "$", depth = 0, found = []) {
  if (depth > 12 || !value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findProviderIdentityKeys(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  for (const [key, item] of Object.entries(value)) {
    if (B6_PROVIDER_IDENTITY_FIELDS.includes(key)) found.push(`${path}.${key}`);
    findProviderIdentityKeys(item, `${path}.${key}`, depth + 1, found);
  }
  return found;
}

function checkAxes(axes, label, failures) {
  const fail = (code, detail) => failures.push({ code, detail });
  if (!isPlainObject(axes)) {
    fail(B6_AGGREGATE_FAILURE.AXIS_MISSING, `${label} has no axes`);
    return;
  }
  const keys = Object.keys(axes).sort();
  const expected = [...B6_RUBRIC_AXES].sort();
  if (keys.length !== expected.length || !expected.every((key, index) => keys[index] === expected[index])) {
    fail(B6_AGGREGATE_FAILURE.AXIS_MISSING, `${label} does not carry exactly the four frozen axes`);
    return;
  }
  for (const axis of B6_RUBRIC_AXES) {
    const value = axes[axis];
    if (!Number.isInteger(value)) {
      fail(B6_AGGREGATE_FAILURE.AXIS_RANGE, `${label} scored ${axis}=${String(value)}`);
      continue;
    }
    if (value < B6_SCORE_MINIMUM || value > B6_SCORE_MAXIMUM) {
      fail(B6_AGGREGATE_FAILURE.AXIS_RANGE, `${label} scored ${axis}=${value}`);
      continue;
    }
    if (value < B6_AXIS_MINIMUM) {
      fail(B6_AGGREGATE_FAILURE.AXIS_BELOW_MINIMUM, `${label} scored ${axis}=${value}`);
    }
  }
}

function checkCriticalErrors(errors, label, failures) {
  const fail = (code, detail) => failures.push({ code, detail });
  if (!Array.isArray(errors)) {
    fail(B6_AGGREGATE_FAILURE.CRITICAL_ERROR, `${label} has no critical error list`);
    return;
  }
  for (const code of errors) {
    fail(B6_AGGREGATE_FAILURE.CRITICAL_ERROR, `${label} reports ${String(code)}`);
    if (!B6_CRITICAL_ERRORS.includes(String(code))) {
      fail(B6_AGGREGATE_FAILURE.CRITICAL_ERROR, `${label} reports the unknown critical error ${String(code)}`);
    }
  }
}

function checkMaterialClaims(claims, label, failures) {
  const fail = (code, detail) => failures.push({ code, detail });
  if (!Array.isArray(claims) || claims.length === 0) {
    fail(B6_AGGREGATE_FAILURE.SENTINEL_CLAIM_SET, `${label} has no material claim verdict`);
    return new Map();
  }
  const verdicts = new Map();
  for (const claim of claims) {
    if (!hasExactKeys(claim, B6_MATERIAL_CLAIM_KEYS)) {
      fail(B6_AGGREGATE_FAILURE.SENTINEL_SCHEMA, `${label} has a material claim with an unexpected key set`);
      continue;
    }
    if (typeof claim.claimId !== "string" || !claim.claimId.trim()) {
      fail(B6_AGGREGATE_FAILURE.SENTINEL_SCHEMA, `${label} has a material claim without an id`);
      continue;
    }
    if (!B6_VERDICTS.includes(claim.verdict)) {
      fail(B6_AGGREGATE_FAILURE.SENTINEL_VERDICT, `${label} has the invalid material claim verdict ${String(claim.verdict)}`);
      continue;
    }
    if (verdicts.has(claim.claimId)) {
      fail(B6_AGGREGATE_FAILURE.SENTINEL_CLAIM_SET, `${label} judges the material claim ${claim.claimId} twice`);
      continue;
    }
    verdicts.set(claim.claimId, claim.verdict);
  }
  return verdicts;
}

/**
 * Evaluate the B-6 semantic aggregate.
 *
 * @param {object} input
 * @param {Array} input.rows the six per-source review rows
 * @param {object|null} input.sentinel the repeated sentinel review
 * @param {object|null} input.authority the CANDIDATE AUTHORITY (REQUIRED)
 * @param {object} input.expected the frozen rubric and prompt hashes (REQUIRED)
 */
export function evaluateB6Aggregate({
  rows = [],
  sentinel = null,
  authority = null,
  expected = {},
} = {}) {
  const failures = [];
  const fail = (code, detail) => failures.push({ code, detail });
  const { rubricSha256 = null, promptSha256 = null } = expected;

  // 1. The CANDIDATE AUTHORITY is REQUIRED and it must be exact.
  if (!authority) {
    fail(B6_AGGREGATE_FAILURE.AUTHORITY_MISSING, "the candidate authority is missing");
  } else {
    for (const defect of candidateAuthorityDefects(authority, expected)) {
      fail(B6_AGGREGATE_FAILURE.AUTHORITY_INVALID, defect);
    }
    if (authority.machineGatePositive !== true) {
      fail(B6_AGGREGATE_FAILURE.MACHINE_GATE, "the candidate authority does not carry a positive machine gate");
    }
  }

  // 2. The frozen rubric and prompt hashes are REQUIRED.
  if (typeof rubricSha256 !== "string" || !SHA256_HEX.test(rubricSha256)) {
    fail(B6_AGGREGATE_FAILURE.HASH_MISSING, "the expected rubric hash is missing");
  }
  if (typeof promptSha256 !== "string" || !SHA256_HEX.test(promptSha256)) {
    fail(B6_AGGREGATE_FAILURE.HASH_MISSING, "the expected prompt hash is missing");
  }

  // 3. The six rows, one per authority source, all COMPLETE and bound.
  const seen = new Set();
  for (const row of rows) {
    if (!isPlainObject(row)) {
      fail(B6_AGGREGATE_FAILURE.ROW_MISSING, "a review row is not an object");
      continue;
    }
    if (!hasExactKeys(row, B6_REVIEW_ROW_KEYS)) {
      fail(B6_AGGREGATE_FAILURE.ROW_SCHEMA, `the row ${String(row.order)} has an unexpected key set`);
    }
    const order = String(row.order);
    if (seen.has(order)) {
      fail(B6_AGGREGATE_FAILURE.ROW_DUPLICATE, `the source order ${order} appears twice`);
    }
    seen.add(order);
    const expectedRow = FROZEN_SIX.find((entry) => entry.order === order);
    if (!expectedRow) {
      fail(B6_AGGREGATE_FAILURE.ROW_ORDER, `the source order ${order} is not a registry order`);
    } else if (row.bvid !== expectedRow.bvid) {
      fail(B6_AGGREGATE_FAILURE.ROW_ORDER, `the order ${order} carries ${String(row.bvid)} instead of ${expectedRow.bvid}`);
    }
    if (row.disposition !== "complete") {
      fail(B6_AGGREGATE_FAILURE.ROW_NOT_COMPLETE, `the row ${order} is ${String(row.disposition ?? "absent")}`);
    }
    if (typeof row.reviewSessionId !== "string" || !row.reviewSessionId.trim()) {
      fail(B6_AGGREGATE_FAILURE.ROW_SCHEMA, `the row ${order} has no review session`);
    }
    // The Provider identity is rejected at ANY depth.
    for (const key of findProviderIdentityKeys(row)) {
      fail(B6_AGGREGATE_FAILURE.PROVIDER_LEAK, `the row ${order} carries the Provider identity field ${key}`);
    }
    if (rubricSha256 && row.rubricSha256 !== rubricSha256) {
      fail(B6_AGGREGATE_FAILURE.RUBRIC_DRIFT, `the row ${order} used another rubric`);
    }
    if (promptSha256 && row.promptSha256 !== promptSha256) {
      fail(B6_AGGREGATE_FAILURE.PROMPT_DRIFT, `the row ${order} used another prompt`);
    }
    // The row must be bound to its authority source.
    const source = authoritySource(authority, order);
    if (!source) {
      fail(B6_AGGREGATE_FAILURE.BINDING, `the row ${order} has no authority source`);
    } else {
      for (const key of ["bvid", "taskId", "sourceIdentity", "bundleSha256", "reviewBindingSha256"]) {
        if (String(row[key]) !== String(source[key])) {
          fail(B6_AGGREGATE_FAILURE.BINDING, `the row ${order} ${key} is ${String(row[key])} and the authority declares ${String(source[key])}`);
        }
      }
      if (String(row.taskRevision) !== String(source.taskRevision)) {
        fail(B6_AGGREGATE_FAILURE.BINDING, `the row ${order} task revision is ${String(row.taskRevision)} and the authority declares ${String(source.taskRevision)}`);
      }
    }
    checkAxes(row.axes, `the row ${order}`, failures);
    checkCriticalErrors(row.criticalErrors, `the row ${order}`, failures);
    if (!B6_VERDICTS.includes(row.thesisVerdict)) {
      fail(B6_AGGREGATE_FAILURE.SENTINEL_VERDICT, `the row ${order} has the invalid thesis verdict ${String(row.thesisVerdict)}`);
    }
    checkMaterialClaims(row.materialClaimVerdicts, `the row ${order}`, failures);
  }
  for (const entry of FROZEN_SIX) {
    if (!seen.has(entry.order)) {
      fail(B6_AGGREGATE_FAILURE.ROW_MISSING, `the review lacks the source ${entry.order}/${entry.bvid}`);
    }
  }
  if (rows.length !== FROZEN_SIX.length) {
    fail(B6_AGGREGATE_FAILURE.ROW_MISSING, `the review carries ${rows.length} row(s), exactly ${FROZEN_SIX.length} are required`);
  }

  // 4. The sentinel: two exact reviews, independently and stably.
  if (!isPlainObject(sentinel) || !Array.isArray(sentinel.reviews) || sentinel.reviews.length !== 2) {
    fail(B6_AGGREGATE_FAILURE.SENTINEL_MISSING, "the sentinel was not reviewed exactly twice");
  } else {
    const [first, second] = sentinel.reviews;
    if (!isPlainObject(first) || !isPlainObject(second)) {
      fail(B6_AGGREGATE_FAILURE.SENTINEL_MISSING, "a sentinel review is not an object");
    } else {
      for (const [review, label] of [[first, "the first sentinel review"], [second, "the second sentinel review"]]) {
        if (!hasExactKeys(review, B6_SENTINEL_REVIEW_KEYS)) {
          fail(B6_AGGREGATE_FAILURE.SENTINEL_SCHEMA, `${label} has an unexpected key set`);
        }
        for (const key of findProviderIdentityKeys(review)) {
          fail(B6_AGGREGATE_FAILURE.PROVIDER_LEAK, `${label} carries the Provider identity field ${key}`);
        }
        if (typeof review.reviewSessionId !== "string" || !review.reviewSessionId.trim()) {
          fail(B6_AGGREGATE_FAILURE.SENTINEL_SESSION, `${label} has no review session`);
        }
        if (!Number.isInteger(review.position) || review.position < 1 || review.position > FROZEN_SIX.length) {
          fail(B6_AGGREGATE_FAILURE.SENTINEL_POSITION, `${label} has the invalid position ${String(review.position)}`);
        }
        if (String(review.order) !== B6_SENTINEL_SOURCE_ORDER) {
          fail(B6_AGGREGATE_FAILURE.SENTINEL_SCHEMA, `${label} does not review the frozen sentinel source`);
        }
        if (rubricSha256 && review.rubricSha256 !== rubricSha256) {
          fail(B6_AGGREGATE_FAILURE.RUBRIC_DRIFT, `${label} used another rubric`);
        }
        if (promptSha256 && review.promptSha256 !== promptSha256) {
          fail(B6_AGGREGATE_FAILURE.PROMPT_DRIFT, `${label} used another prompt`);
        }
        if (!B6_VERDICTS.includes(review.thesisVerdict)) {
          fail(B6_AGGREGATE_FAILURE.SENTINEL_VERDICT, `${label} has the invalid thesis verdict ${String(review.thesisVerdict)}`);
        }
        checkAxes(review.axes, label, failures);
        checkCriticalErrors(review.criticalErrors, label, failures);
        const source = authoritySource(authority, review.order);
        if (!source) {
          fail(B6_AGGREGATE_FAILURE.BINDING, `${label} has no authority source`);
        } else if (String(review.reviewBindingSha256) !== String(source.reviewBindingSha256)) {
          fail(B6_AGGREGATE_FAILURE.BINDING, `${label} is not bound to the authority review binding`);
        }
      }
      if (first.reviewSessionId && first.reviewSessionId === second.reviewSessionId) {
        fail(B6_AGGREGATE_FAILURE.SENTINEL_SESSION, "the two sentinel reviews share a session");
      }
      if (first.position === second.position) {
        fail(B6_AGGREGATE_FAILURE.SENTINEL_POSITION, "the two sentinel reviews share a position");
      }
      if (first.thesisVerdict !== second.thesisVerdict) {
        fail(B6_AGGREGATE_FAILURE.SENTINEL_REVERSED, "the sentinel thesis verdict reversed");
      }
      const firstClaims = checkMaterialClaims(first.materialClaimVerdicts, "the first sentinel review", failures);
      const secondClaims = checkMaterialClaims(second.materialClaimVerdicts, "the second sentinel review", failures);
      const firstIds = [...firstClaims.keys()].sort();
      const secondIds = [...secondClaims.keys()].sort();
      if (firstIds.length === 0 || secondIds.length === 0) {
        fail(B6_AGGREGATE_FAILURE.SENTINEL_CLAIM_SET, "a sentinel review has no material claim set");
      } else if (JSON.stringify(firstIds) !== JSON.stringify(secondIds)) {
        fail(B6_AGGREGATE_FAILURE.SENTINEL_CLAIM_SET, "the two sentinel reviews judge a different material claim set");
      } else {
        for (const claimId of firstIds) {
          if (firstClaims.get(claimId) !== secondClaims.get(claimId)) {
            fail(B6_AGGREGATE_FAILURE.SENTINEL_REVERSED, `the sentinel material claim ${claimId} reversed`);
          }
        }
      }
      for (const axis of B6_RUBRIC_AXES) {
        const left = first.axes?.[axis];
        const right = second.axes?.[axis];
        if (!Number.isInteger(left) || !Number.isInteger(right)) {
          fail(B6_AGGREGATE_FAILURE.AXIS_MISSING, `the sentinel has no ${axis} score`);
          continue;
        }
        if (Math.abs(left - right) > 1) {
          fail(B6_AGGREGATE_FAILURE.SENTINEL_SCORE_DRIFT, `the sentinel ${axis} drifted from ${left} to ${right}`);
        }
      }
    }
  }

  const counts = { complete: 0, limited: 0, blocked: 0, failed: 0, total: rows.length };
  for (const row of rows) {
    const disposition = String(row?.disposition ?? "complete");
    if (disposition in counts) counts[disposition] += 1;
  }

  return {
    schemaVersion: B6_AGGREGATE_SCHEMA,
    positive: failures.length === 0,
    failures,
    counts,
    rubricAxes: B6_RUBRIC_AXES,
    axisMinimum: B6_AXIS_MINIMUM,
  };
}
