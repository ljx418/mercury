// The GC-B6C ORDER-2 DIAGNOSTIC CANARY contract (acceptance harness only).
//
// The canary is NEVER a candidate. It may only diagnose the FROZEN active
// registry order 2, it never scores anything, it never runs a semantic
// review and it can never emit a stage PASS.
//
// It REUSES the existing owners: the authorization owner, the child-grant
// verification, the stage action ledger, the owned Chrome/Runtime
// isolation, the B-6 capture and the cleanup owner. This module adds NO
// owner path and it duplicates NO product flow.
//
// It is PURE: it never starts a process, never opens a socket and never
// touches the filesystem. The only thing it produces is a NON-CANDIDATE
// diagnostic receipt and a stable verdict.

import { FROZEN_SIX, RESERVE_SOURCES } from "./registry.mjs";
import { authorizationPaths } from "./authorization.mjs";
import fs from "node:fs";
import path from "node:path";

/** The canary receipt's schema version. */
export const ORDER2_CANARY_SCHEMA = "v3-5.10-b6c-order2-diagnostic-canary/v1";

/** The observations schema version. */
export const ORDER2_OBSERVATIONS_SCHEMA = "v3-5.10-b6c-order2-observations/v1";

/** The ONE registry order this canary may diagnose. */
export const ORDER2_REGISTRY_ORDER = "2";

/** The frozen order-2 identity. */
export const ORDER2_FROZEN = Object.freeze(
  FROZEN_SIX.find((row) => row.order === ORDER2_REGISTRY_ORDER),
);

/** The canary's exit codes. They are disjoint and stable. */
export const CANARY_EXIT = Object.freeze({
  READY: 0,
  BLOCKED: 1,
  REFUSED: 2,
  CONTRACT_VIOLATION: 3,
  NOT_EXECUTED: 4,
});

/** The stable canary codes. */
export const CANARY_CODE = Object.freeze({
  IDENTITY_REFUSED: "CANARY_IDENTITY_REFUSED",
  RESERVE_REFUSED: "CANARY_RESERVE_REFUSED",
  AUTHORIZATION_MISSING: "CANARY_AUTHORIZATION_MISSING",
  AUTHORIZATION_REPLAYED: "CANARY_AUTHORIZATION_REPLAYED",
  GRANT_MISSING: "CANARY_GRANT_MISSING",
  GRANT_REPLAYED: "CANARY_GRANT_REPLAYED",
  GRANT_MISMATCH: "CANARY_GRANT_MISMATCH",
  OBSERVATIONS_MISSING: "CANARY_OBSERVATIONS_MISSING",
  OBSERVATIONS_INVALID: "CANARY_OBSERVATIONS_INVALID",
  STATUS_UNKNOWN: "CANARY_STATUS_UNKNOWN",
  CODE_NOT_ALLOWLISTED: "CANARY_ERROR_CODE_NOT_ALLOWLISTED",
  COUNT_FABRICATED: "CANARY_COUNT_FABRICATED",
  CANDIDATE_LANGUAGE: "CANARY_CANDIDATE_LANGUAGE_REFUSED",
  NOT_EXECUTED: "CANARY_NOT_EXECUTED",
  ROUTE_NOT_ATTEMPTED: "CANARY_ROUTE_NOT_ATTEMPTED",
  TASK_NOT_READY: "CANARY_TASK_NOT_READY",
  NO_PNG_BACKED_FRAME: "CANARY_NO_PNG_BACKED_FRAME",
  PNG_ROUTE_ERROR: "CANARY_PNG_ROUTE_ERROR",
  PNG_INVALID: "CANARY_PNG_INVALID",
  CAPTURE_NOT_CLOSED: "CANARY_CAPTURE_NOT_CLOSED",
  CLEANUP_NOT_CLOSED: "CANARY_CLEANUP_NOT_CLOSED",
  OWNED_LEAK: "CANARY_OWNED_LEAK",
  ACTION_ACCOUNTING_UNKNOWN: "CANARY_ACTION_ACCOUNTING_UNKNOWN",
  UPLOAD_COUNTER_NOT_ZERO: "CANARY_UPLOAD_COUNTER_NOT_ZERO",
  ACTION_ACCOUNTING_MISMATCH: "CANARY_ACTION_ACCOUNTING_MISMATCH",
  OWNER_FAILED: "CANARY_OWNER_FAILED",
  EVIDENCE_NOT_FRESH: "CANARY_EVIDENCE_NOT_FRESH",
  VISUAL_ROUTE_FAILED: "CANARY_VISUAL_ROUTE_FAILED",
  RECEIPT_WRITE_FAILED: "CANARY_RECEIPT_WRITE_FAILED",
});

/** The ONLY route classes the canary may observe. */
export const CANARY_ROUTE_CLASSES = Object.freeze(["materialize-visual", "materialize"]);

/** The HTTP statuses the canary may record. */
export const CANARY_HTTP_STATUSES = Object.freeze([
  200, 201, 202, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503,
]);

/**
 * The ALLOWLIST of the stable product error codes the canary may record.
 *
 * It is the frozen media-companion failure vocabulary of the Runtime. A
 * code outside the allowlist is NEVER persisted: the canary records
 * `CANARY_ERROR_CODE_NOT_ALLOWLISTED` instead, so an unknown or new code
 * can never leak an unexpected string into the durable evidence.
 */
export const CANARY_ERROR_CODE_ALLOWLIST = Object.freeze([
  "OUTLINE_EVIDENCE_REQUIRED",
  "TASK_CANCELLED",
  "TASK_IDENTITY_MISMATCH",
  "TASK_INPUT_NOT_READY",
  "TASK_TRANSITION_INVALID",
  "V351_EVIDENCE_HASH_MISMATCH",
  "V351_EVIDENCE_ORPHAN",
  "V351_EVIDENCE_REQUIRED",
  "V351_EVIDENCE_UNAVAILABLE",
  "V351_TASK_NOT_READY",
  "V351_THUMBNAIL_NOT_FOUND",
  "V3510B_EVIDENCE_CATALOG_CHANGED",
  "V3510B_CHAPTER_COVERAGE_INSUFFICIENT",
  "V3510B_CHAPTER_IMBALANCE",
  "V3510B_CHAPTER_TIME_INVALID",
  "V3510B_PROVIDER_AUTHORIZATION_DENIED",
  "V3510B_PROVIDER_RESPONSE_INVALID",
  "V3510B_PROVIDER_TIMEOUT",
  "V3510B_PROVIDER_UNAVAILABLE",
  "V3510B_TASK_REVISION_CONFLICT",
  "V352_SYNTHESIS_EVIDENCE_UNCLOSED",
  "V352_SYNTHESIS_PROVIDER_MISSING",
  "V352_SYNTHESIS_PROVIDER_NOT_VERIFIED",
  "V352_SYNTHESIS_PROVIDER_UNAVAILABLE",
  "V352_SYNTHESIS_PROVIDER_UNSUPPORTED",
  "V352_SYNTHESIS_RESPONSE_INVALID",
  "V352_SYNTHESIS_STYLE_INVALID",
  "V352_SYNTHESIS_TIMEOUT",
  "V352_SYNTHESIS_TIME_INVALID",
  "V3_MEDIA_ACQUISITION_IN_PROGRESS",
  "V3_MEDIA_CAPTURE_ALREADY_ACTIVE",
  "V3_MEDIA_CAPTURE_NOT_ELIGIBLE",
  "V3_MEDIA_CHANNEL_EXPIRED",
  "V3_MEDIA_CHANNEL_INVALID",
  "V3_MEDIA_CLEANUP_INCOMPLETE",
  "V3_MEDIA_CREDENTIAL_SET_INVALID",
  "V3_MEDIA_ENVELOPE_EXPIRED",
  "V3_MEDIA_ENVELOPE_INVALID",
  "V3_MEDIA_ENVELOPE_REPLAYED",
  "V3_MEDIA_ENVELOPE_TOO_LARGE",
  "V3_MEDIA_LEASE_EXPIRED",
  "V3_MEDIA_LEASE_REQUIRED",
  "V3_MEDIA_LEASE_REVOKED",
  "V3_MEDIA_LEASE_TASK_MISMATCH",
  "V3_MEDIA_PERSISTENT_SESSION_INVALID",
  "V3_MEDIA_PERSISTENT_SESSION_UNAVAILABLE",
  "V3_MEDIA_PLATFORM_REJECTED",
  "V3_MEDIA_POLICY_NOT_GRANTED",
  "V3_MEDIA_POLICY_REVISION_MISMATCH",
  "V3_MEDIA_POLICY_SWITCH_FAILED",
  "V3_MEDIA_POLICY_SWITCH_INVALID",
  "V3_MEDIA_ROUTE_ORDER_INVALID",
  "V3_MEDIA_RUNTIME_AUTH_REQUIRED",
  "V3_MEDIA_RUNTIME_OFFLINE",
  "V3_MEDIA_RUNTIME_ORIGIN_MISMATCH",
  "V3_MEDIA_SOURCE_POLICY_CONFLICT",
  "V3_MEDIA_SOURCE_TASK_ACTIVE",
  "V3_MEDIA_SUBTITLE_UNAVAILABLE",
  "V3_MEDIA_TASK_INVALID",
  "V3_MEDIA_TASK_TERMINAL",
  "V3_MEDIA_TRANSCRIPT_AUDIO_UNAVAILABLE",
  "V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID",
  "VISUAL_EVIDENCE_UNAVAILABLE",
  "VISUAL_PIPELINE_UNAVAILABLE",
]);

/** The task states the canary may observe. */
export const CANARY_TASK_STATES = Object.freeze(["ready", "degraded", "blocked", "failed"]);

/** The evidence kinds the canary counts. */
export const CANARY_EVIDENCE_KINDS = Object.freeze([
  "transcript", "frame", "ocr_block", "vision_caption",
]);

const OBSERVATION_KEYS = Object.freeze([
  "schemaVersion", "registryOrder", "bvid", "runId", "taskId",
  "visualObservations", "observationCodes", "taskState",
  "terminalFailureCode", "evidenceKindCounts", "pngConfirmedFrameCount",
  "pngFailureCodes", "capture", "cleanup", "ownedLeakSightings",
  "actionCounters", "uploadCounters",
]);
const VISUAL_OBSERVATION_KEYS = Object.freeze(["method", "routeClass", "status", "errorCode"]);
const CAPTURE_KEYS = Object.freeze(["status", "failureCodes", "counts"]);
const CAPTURE_COUNT_KEYS = Object.freeze(["evidence", "thumbnails", "chapters"]);
const CLEANUP_KEYS = Object.freeze(["runtimeScratchDeleted", "profileRootDeleted", "cleanupFailure"]);
const ACTION_COUNTER_KEYS = Object.freeze([
  "chromeLaunchCount", "visibleWindowCount", "runtimeStartCount",
  "cookieInjectionCount", "focusEventCount", "mediaTaskCount",
  "runtimeSynthesizeCount", "providerCallCount", "sourceCompletionCount",
  "audioOutputCount", "tabCaptureActionCount",
]);
const UPLOAD_COUNTER_KEYS = Object.freeze([
  "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
  "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount",
]);
const PNG_FAILURE_CODES = Object.freeze([CANARY_CODE.PNG_ROUTE_ERROR, CANARY_CODE.PNG_INVALID]);

function hasExactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return JSON.stringify(actual) === JSON.stringify([...expected].sort());
}

/** The diagnostic verdicts. Neither of them is a stage PASS. */
export const CANARY_VERDICT = Object.freeze({
  READY: "ORDER2 DIAGNOSTIC READY FOR CODEX",
  BLOCKED: "ORDER2 DIAGNOSTIC BLOCKED",
});

/**
 * The keys a canary receipt may NEVER carry.
 *
 * The canary is a diagnostic, not a candidate: it may not carry an
 * aggregate, a review row, a sentinel, a blind projection or a score.
 */
export const CANARY_FORBIDDEN_KEYS = Object.freeze([
  "aggregate", "aggregateVerdict", "blindProjection", "blindReview",
  "candidate", "candidates", "reviewRows", "reviewRow", "reviews",
  "sentinel", "sentinelReceipt", "semanticReview", "semanticReviewPerformed",
  "scores", "rubricScores", "stagePass", "stagePassDeclared", "pass",
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Refuse every identity except the frozen order 2.
 *
 * A wrong primary order, a reserve source and a substituted bvid are all
 * refused BEFORE any external action.
 *
 * @returns {{ok: boolean, code: string|null, detail: string|null}}
 */
export function assertOrder2Identity({ order, bvid } = {}) {
  const normalizedOrder = String(order ?? "");
  if (RESERVE_SOURCES.some((entry) => entry.bvid === String(bvid ?? ""))) {
    return { ok: false, code: CANARY_CODE.RESERVE_REFUSED, detail: "a reserve source is never diagnosable by this canary" };
  }
  if (normalizedOrder !== ORDER2_REGISTRY_ORDER) {
    return { ok: false, code: CANARY_CODE.IDENTITY_REFUSED, detail: `this canary diagnoses the registry order ${ORDER2_REGISTRY_ORDER} only` };
  }
  if (String(bvid ?? "") !== ORDER2_FROZEN.bvid) {
    return { ok: false, code: CANARY_CODE.IDENTITY_REFUSED, detail: "the bvid is not the frozen order-2 identity" };
  }
  return { ok: true, code: null, detail: null };
}

/**
 * Record ONE passive visual observation.
 *
 * The observation carries the method, the ROUTE CLASS (never a path), the
 * HTTP status and an ALLOWLISTED stable error code. It never carries a
 * body, a header, a token, a Cookie, a path, the Provider identity or any
 * text.
 *
 * @returns {{ok: boolean, code: string|null, observation: object|null, detail: string|null}}
 */
export function recordVisualObservation(observation) {
  const method = String(observation?.method ?? "").toUpperCase();
  const routeClass = String(observation?.routeClass ?? "");
  const status = Number(observation?.status ?? 0);
  const rawCode = observation?.errorCode ?? null;
  if (method !== "POST") {
    return { ok: false, code: CANARY_CODE.OBSERVATIONS_INVALID, observation: null, detail: "only a POST may be observed" };
  }
  if (!CANARY_ROUTE_CLASSES.includes(routeClass)) {
    return { ok: false, code: CANARY_CODE.OBSERVATIONS_INVALID, observation: null, detail: "the route class is not observable" };
  }
  if (!CANARY_HTTP_STATUSES.includes(status)) {
    return { ok: false, code: CANARY_CODE.STATUS_UNKNOWN, observation: null, detail: "the HTTP status is not in the frozen set" };
  }
  let errorCode = null;
  if (rawCode !== null && rawCode !== undefined && rawCode !== "") {
    if (typeof rawCode !== "string" || !CANARY_ERROR_CODE_ALLOWLIST.includes(rawCode)) {
      // The code is NOT persisted: only the canary's own stable code is.
      return { ok: false, code: CANARY_CODE.CODE_NOT_ALLOWLISTED, observation: null, detail: "the product error code is not allowlisted" };
    }
    errorCode = rawCode;
  }
  return {
    ok: true,
    code: null,
    detail: null,
    observation: { method, routeClass, status, errorCode },
  };
}

/**
 * Sanitize ONE observed product error code.
 *
 * An allowlisted code is kept. Any other code is DROPPED and the canary's own
 * stable code is returned instead: an unknown or new product string can never
 * reach the durable evidence.
 *
 * @returns {{errorCode: string|null, refusalCode: string|null}}
 */
export function sanitizeObservedErrorCode(code) {
  if (code === null || code === undefined || code === "") {
    return { errorCode: null, refusalCode: null };
  }
  if (typeof code === "string" && CANARY_ERROR_CODE_ALLOWLIST.includes(code)) {
    return { errorCode: code, refusalCode: null };
  }
  return { errorCode: null, refusalCode: CANARY_CODE.CODE_NOT_ALLOWLISTED };
}

/**
 * Inspect the authorization state of the canary. It is READ ONLY.
 *
 * It can only REFUSE: it never consumes an authorization, it never issues a
 * grant and it never marks a grant as used. The one-shot consumption and the
 * child-grant verification stay with the authorization owner
 * (`lib/authorization.mjs`); this inspection only READS the owner's own
 * paths, computed with the owner's own `authorizationPaths`.
 *
 * @param {object} input
 * @param {string} input.stageRoot the owned stage root
 * @param {string|null} input.authorizationDigest the digest of the authorization
 * @param {string|null} input.grantId the child grant id
 * @returns {{ok: boolean, code: string|null, detail: string|null}}
 */
export function inspectAuthorizationState({ stageRoot, authorizationDigest = null, grantId = null } = {}) {
  if (!stageRoot) {
    return { ok: false, code: CANARY_CODE.AUTHORIZATION_MISSING, detail: "the canary needs an explicit owned stage root" };
  }
  const { consumedDirectory, grantDirectory } = authorizationPaths({ stageRoot: String(stageRoot) });
  if (authorizationDigest) {
    const marker = path.join(consumedDirectory, `${authorizationDigest}.consumed`);
    if (fs.existsSync(marker)) {
      // The one-shot authorization was ALREADY consumed: a replay is refused.
      return { ok: false, code: CANARY_CODE.AUTHORIZATION_REPLAYED, detail: "the one-shot authorization was already consumed" };
    }
  }
  if (grantId) {
    const grant = path.join(grantDirectory, `${grantId}.grant.json`);
    if (!fs.existsSync(grant)) {
      return { ok: false, code: CANARY_CODE.GRANT_MISSING, detail: "the child grant was never issued" };
    }
    const used = path.join(grantDirectory, `${grantId}.used`);
    if (fs.existsSync(used)) {
      return { ok: false, code: CANARY_CODE.GRANT_REPLAYED, detail: "the child grant was already consumed" };
    }
  }
  return { ok: true, code: null, detail: null };
}

/**
 * The admissibility of an observation set.
 *
 * It refuses an inconsistent or fabricated observation set BEFORE any
 * verdict is derived from it.
 *
 * @returns {{ok: boolean, codes: string[]}}
 */
export function validateObservations(observations, { expectedRunId = null } = {}) {
  const codes = [];
  if (!isPlainObject(observations)) {
    return { ok: false, codes: [CANARY_CODE.OBSERVATIONS_INVALID] };
  }
  if (!hasExactKeys(observations, OBSERVATION_KEYS)) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  }
  if (observations.schemaVersion !== ORDER2_OBSERVATIONS_SCHEMA) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  }
  if (String(observations.registryOrder ?? "") !== ORDER2_REGISTRY_ORDER) {
    codes.push(CANARY_CODE.IDENTITY_REFUSED);
  }
  if (String(observations.bvid ?? "") !== ORDER2_FROZEN.bvid) {
    codes.push(CANARY_CODE.IDENTITY_REFUSED);
  }
  if (typeof observations.runId !== "string" || !observations.runId
    || (expectedRunId !== null && observations.runId !== expectedRunId)) {
    codes.push(CANARY_CODE.IDENTITY_REFUSED);
  }
  const ownerFailed = Array.isArray(observations.observationCodes)
    && observations.observationCodes.includes(CANARY_CODE.OWNER_FAILED);
  const taskIdentityValid = typeof observations.taskId === "string"
    && /^media_task_[0-9a-f]{32}$/.test(observations.taskId);
  // A normal owner failure can happen before task creation. Null is admitted
  // only with the explicit OWNER_FAILED latch, which permanently prevents a
  // READY verdict. Every non-failure observation still requires a real task.
  if (!taskIdentityValid && !(observations.taskId === null && ownerFailed)) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  }
  const visual = observations.visualObservations;
  if (!Array.isArray(visual)) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  } else {
    for (const item of visual) {
      if (!hasExactKeys(item, VISUAL_OBSERVATION_KEYS)) {
        codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
        continue;
      }
      const recorded = recordVisualObservation(item);
      if (!recorded.ok) codes.push(recorded.code);
    }
  }
  if (!Array.isArray(observations.observationCodes)
    || observations.observationCodes.some((code) => !Object.values(CANARY_CODE).includes(code))) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  }
  const state = observations.taskState ?? null;
  if (state !== null && !CANARY_TASK_STATES.includes(String(state))) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  }
  if (observations.terminalFailureCode !== null
    && !CANARY_ERROR_CODE_ALLOWLIST.includes(observations.terminalFailureCode)) {
    codes.push(CANARY_CODE.CODE_NOT_ALLOWLISTED);
  }
  const counts = observations.evidenceKindCounts;
  if (!isPlainObject(counts)) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  } else {
    for (const kind of CANARY_EVIDENCE_KINDS) {
      const value = counts[kind];
      if (!Number.isInteger(value) || value < 0) codes.push(CANARY_CODE.COUNT_FABRICATED);
    }
    for (const key of Object.keys(counts)) {
      if (!CANARY_EVIDENCE_KINDS.includes(key)) codes.push(CANARY_CODE.COUNT_FABRICATED);
    }
  }
  const pngConfirmed = observations.pngConfirmedFrameCount;
  if (!Number.isInteger(pngConfirmed) || pngConfirmed < 0) {
    codes.push(CANARY_CODE.COUNT_FABRICATED);
  } else if (isPlainObject(counts) && Number.isInteger(counts.frame) && pngConfirmed > counts.frame) {
    // More confirmed PNGs than frame ROWS: the count is fabricated.
    codes.push(CANARY_CODE.COUNT_FABRICATED);
  }
  const capture = observations.capture;
  if (!hasExactKeys(capture, CAPTURE_KEYS)) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  } else {
    if (!Array.isArray(capture.failureCodes)
      || capture.failureCodes.some((code) => typeof code !== "string" || !/^B6_(?:CAPTURE|BUNDLE)_[A-Z0-9_]+$/.test(code))) {
      codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
    }
    if (capture.status !== "captured" && capture.status !== "failed") codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
    if (!hasExactKeys(capture.counts, CAPTURE_COUNT_KEYS)
      || CAPTURE_COUNT_KEYS.some((key) => !Number.isInteger(capture.counts?.[key]) || capture.counts[key] < 0)) {
      codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
    }
  }
  if (!hasExactKeys(observations.cleanup, CLEANUP_KEYS)
    || typeof observations.cleanup.runtimeScratchDeleted !== "boolean"
    || typeof observations.cleanup.profileRootDeleted !== "boolean"
    || (observations.cleanup.cleanupFailure !== null && typeof observations.cleanup.cleanupFailure !== "string")) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  }
  if (!Number.isInteger(observations.ownedLeakSightings) || observations.ownedLeakSightings < 0) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  }
  const counters = observations.actionCounters;
  if (!hasExactKeys(counters, ACTION_COUNTER_KEYS)) {
    codes.push(CANARY_CODE.ACTION_ACCOUNTING_UNKNOWN);
  } else {
    for (const key of ACTION_COUNTER_KEYS) {
      if (!Number.isInteger(counters[key]) || counters[key] < 0) {
        codes.push(CANARY_CODE.ACTION_ACCOUNTING_UNKNOWN);
      }
    }
  }
  if (!hasExactKeys(observations.uploadCounters, UPLOAD_COUNTER_KEYS)
    || UPLOAD_COUNTER_KEYS.some((key) => !Number.isInteger(observations.uploadCounters?.[key])
      || observations.uploadCounters[key] < 0)) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  }
  if (!Array.isArray(observations.pngFailureCodes)
    || observations.pngFailureCodes.some((code) => !PNG_FAILURE_CODES.includes(code))) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  }
  // The canary refuses an observation set that carries CANDIDATE language.
  const walk = (value, depth) => {
    if (depth > 6) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    if (!isPlainObject(value)) return;
    for (const [key, item] of Object.entries(value)) {
      if (CANARY_FORBIDDEN_KEYS.includes(key)) codes.push(CANARY_CODE.CANDIDATE_LANGUAGE);
      walk(item, depth + 1);
    }
  };
  walk(observations, 0);
  return { ok: codes.length === 0, codes: [...new Set(codes)].sort() };
}

/**
 * The diagnostic verdict of an ADMISSIBLE observation set.
 *
 * READY requires: the task state `ready`, an ATTEMPTED materialize-visual
 * route, at least one REAL PNG-backed frame, a closed capture, exact action
 * accounting and a clean owned shutdown.
 *
 * @returns {{verdict: string, codes: string[]}}
 */
export function order2DiagnosticVerdict(observations) {
  const codes = [];
  const visual = Array.isArray(observations?.visualObservations) ? observations.visualObservations : [];
  const visualAttempted = visual.some((item) => item?.routeClass === "materialize-visual");
  const fallbackAttempted = visual.some((item) => item?.routeClass === "materialize");
  if (!visualAttempted) codes.push(CANARY_CODE.ROUTE_NOT_ATTEMPTED);
  if (visual.some((item) => item?.routeClass === "materialize-visual"
    && (item.status < 200 || item.status >= 300))) {
    codes.push(CANARY_CODE.VISUAL_ROUTE_FAILED);
  }
  if (observations?.taskState !== "ready") codes.push(CANARY_CODE.TASK_NOT_READY);
  if (!Number.isInteger(observations?.pngConfirmedFrameCount) || observations.pngConfirmedFrameCount < 1) {
    codes.push(CANARY_CODE.NO_PNG_BACKED_FRAME);
  }
  if (observations?.capture?.status !== "captured") codes.push(CANARY_CODE.CAPTURE_NOT_CLOSED);
  if (Array.isArray(observations?.capture?.failureCodes) && observations.capture.failureCodes.length > 0) {
    codes.push(CANARY_CODE.CAPTURE_NOT_CLOSED);
  }
  if (observations?.cleanup?.runtimeScratchDeleted !== true
    || observations?.cleanup?.profileRootDeleted !== true
    || observations?.cleanup?.cleanupFailure) {
    codes.push(CANARY_CODE.CLEANUP_NOT_CLOSED);
  }
  if (Number.isInteger(observations?.ownedLeakSightings) && observations.ownedLeakSightings > 0) {
    codes.push(CANARY_CODE.OWNED_LEAK);
  }
  const counters = observations?.actionCounters;
  if (isPlainObject(counters)) {
    for (const key of [
      "chromeLaunchCount", "visibleWindowCount", "runtimeStartCount",
      "focusEventCount", "mediaTaskCount", "runtimeSynthesizeCount",
    ]) {
      if (counters[key] !== 1) codes.push(CANARY_CODE.ACTION_ACCOUNTING_MISMATCH);
    }
    if (counters.cookieInjectionCount < 1 || counters.providerCallCount < 1) {
      codes.push(CANARY_CODE.ACTION_ACCOUNTING_MISMATCH);
    }
    if (Number.isInteger(counters.sourceCompletionCount) && counters.sourceCompletionCount !== 0) {
      // A diagnostic is never a completed candidate source.
      codes.push(CANARY_CODE.ACTION_ACCOUNTING_MISMATCH);
    }
    if (Number.isInteger(counters.audioOutputCount) && counters.audioOutputCount !== 0) {
      codes.push(CANARY_CODE.ACTION_ACCOUNTING_MISMATCH);
    }
    if (Number.isInteger(counters.tabCaptureActionCount) && counters.tabCaptureActionCount !== 0) {
      codes.push(CANARY_CODE.ACTION_ACCOUNTING_MISMATCH);
    }
  }
  const uploads = observations?.uploadCounters;
  if (isPlainObject(uploads)) {
    for (const value of Object.values(uploads)) {
      if (value !== 0) codes.push(CANARY_CODE.UPLOAD_COUNTER_NOT_ZERO);
    }
  }
  for (const code of observations?.pngFailureCodes ?? []) {
    if (typeof code === "string" && code) codes.push(code);
  }
  for (const code of observations?.observationCodes ?? []) codes.push(code);
  if (observations?.terminalFailureCode) {
    codes.push(`CANARY_PRODUCT_${observations.terminalFailureCode}`);
  }
  for (const item of visual) {
    if (item?.errorCode) {
      codes.push(`CANARY_PRODUCT_${item.errorCode}`);
    }
  }
  if (fallbackAttempted && !visualAttempted) {
    codes.push(CANARY_CODE.ROUTE_NOT_ATTEMPTED);
  }
  const unique = [...new Set(codes)].sort();
  return {
    verdict: unique.length === 0 ? CANARY_VERDICT.READY : CANARY_VERDICT.BLOCKED,
    codes: unique,
  };
}

/**
 * Build the NON-CANDIDATE diagnostic receipt.
 *
 * The receipt NEVER claims a candidate, a semantic review or a stage PASS.
 */
export function buildOrder2DiagnosticReceipt({
  mode = "offline",
  executed = false,
  runId = null,
  verdict = CANARY_VERDICT.BLOCKED,
  codes = [],
  observations = null,
  actionCounters = null,
  generatedAtUtc = null,
} = {}) {
  return {
    schemaVersion: ORDER2_CANARY_SCHEMA,
    batch: "GC-B6C ORDER-2 DIAGNOSTIC CANARY",
    // The three NON-NEGOTIABLE declarations of a non-candidate.
    candidate: false,
    semanticReviewPerformed: false,
    stagePass: false,
    mode: String(mode),
    executed: executed === true,
    runId: runId ?? null,
    registryOrder: ORDER2_REGISTRY_ORDER,
    bvid: ORDER2_FROZEN.bvid,
    verdict: String(verdict),
    codes: [...new Set(codes.filter((code) => typeof code === "string" && code))].sort(),
    observations: observations ?? null,
    actionCounters: actionCounters ?? null,
    generatedAtUtc: generatedAtUtc ?? null,
    note: "A diagnostic receipt: it is never a candidate, it never scores anything and it never declares a stage PASS.",
  };
}

/**
 * The anti-false-green guard of a canary receipt.
 *
 * It refuses a receipt that claims a candidate, a semantic review or a
 * stage PASS, and it refuses a receipt that carries an aggregate, a review
 * row, a sentinel, a blind projection or a score.
 *
 * @returns {{ok: boolean, codes: string[]}}
 */
export function order2DiagnosticReceiptDefects(receipt) {
  const codes = [];
  if (!isPlainObject(receipt)) {
    return { ok: false, codes: [CANARY_CODE.OBSERVATIONS_INVALID] };
  }
  if (receipt.schemaVersion !== ORDER2_CANARY_SCHEMA) {
    codes.push(CANARY_CODE.OBSERVATIONS_INVALID);
  }
  if (receipt.candidate !== false) codes.push(CANARY_CODE.CANDIDATE_LANGUAGE);
  if (receipt.semanticReviewPerformed !== false) codes.push(CANARY_CODE.CANDIDATE_LANGUAGE);
  if (receipt.stagePass !== false) codes.push(CANARY_CODE.CANDIDATE_LANGUAGE);
  if (receipt.mode !== "offline" && receipt.mode !== "visible") {
    codes.push(CANARY_CODE.CANDIDATE_LANGUAGE);
  }
  if (![CANARY_VERDICT.READY, CANARY_VERDICT.BLOCKED].includes(String(receipt.verdict))) {
    codes.push(CANARY_CODE.CANDIDATE_LANGUAGE);
  }
  if (receipt.verdict === CANARY_VERDICT.READY
    && (receipt.mode !== "visible" || receipt.executed !== true)) {
    codes.push(CANARY_CODE.CANDIDATE_LANGUAGE);
  }
  const walk = (value, depth) => {
    if (depth > 8) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    if (!isPlainObject(value)) return;
    for (const [key, item] of Object.entries(value)) {
      // The three declared keys are allowed to EXIST; their VALUE is checked
      // above. Every other candidate language is refused.
      if (!["candidate", "semanticReviewPerformed", "stagePass"].includes(key)
        && CANARY_FORBIDDEN_KEYS.includes(key)) {
        codes.push(CANARY_CODE.CANDIDATE_LANGUAGE);
      }
      walk(item, depth + 1);
    }
  };
  walk(receipt, 0);
  return { ok: codes.length === 0, codes: [...new Set(codes)].sort() };
}
