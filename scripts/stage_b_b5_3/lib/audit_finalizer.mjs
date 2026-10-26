// The EXPLICIT state semantics of the durable audit record.
//
// The finalizer of the runner is called more than once: once when the source
// reached its outcome and once more in the finally path, after the cleanup.
// The durable record must therefore merge two states.
//
// The merge is NOT "never replace a non-null primitive". Every field has an
// EXPLICIT rule:
//
//   * the IDENTITY fields and the CURRENT-RUN observations take the value of
//     the FINAL run; a null never erases a known fact;
//   * the CLEANUP BOOLEANS converge false -> true: a verified deletion is
//     never un-done by a later, weaker observation;
//   * the CLEANUP FAILURE may not be erased: the first non-null failure wins;
//   * a PUBLISHED RECEIPT may replace an earlier null, it is never erased and
//     it is never FABRICATED: a publication that does not carry the whole
//     identity of a real publication is refused;
//   * the TERMINAL PAIR (disposition, failureCode) follows an explicit
//     precedence: the strongest terminal state wins, and within one
//     precedence the FINAL run state wins;
//   * the UPLOAD COUNTERS never lose a violation: a non-zero count stays;
//   * a receipt of a DIFFERENT run or a DIFFERENT source is NEVER combined
//     with the current one.

/** The explicit disposition precedence. A stronger state wins. */
export const DISPOSITION_PRECEDENCE = Object.freeze({
  complete: 1,
  limited: 2,
  blocked: 3,
  failed: 4,
});

/** The fields that carry the CURRENT run state. */
export const CURRENT_RUN_FIELDS = Object.freeze([
  "schemaVersion", "runId", "order", "bvid", "registrySha256",
  "taskId", "taskNamespace", "taskRevision", "sourceIdentity", "dependencyGeneration",
  "route", "startedAtUtc", "finishedAtUtc",
  "audioOutputCount", "tabCaptureCount", "focusEventCount", "focusTargetOwned",
  "cookieInjectionCount", "extensionPermissionMode", "muteAudioVerified",
  "runtimeDatabaseRef", "chromeProfileRef",
  "derivativeSha256", "receiptSha256", "evidenceSha256", "chapterDiagnostic",
  // The B-6 review capture receipt: a current-run observation.
  "reviewCapture", "reviewCaptureFailureCodes", "stageADiagnostic", "executionClosure",
  // The GC-B6H-R execution-root identities: WHAT the candidate really
  // executed. A current-run observation.
  "executionRoots", "extensionManifestOriginalSha256", "extensionManifestFixtureSha256",
]);

/** The precedence of a disposition. An unknown disposition is the weakest. */
export function dispositionPrecedence(disposition) {
  return DISPOSITION_PRECEDENCE[String(disposition ?? "")] ?? 0;
}

/**
 * TRUE when the two receipts belong to the SAME run and the SAME source.
 *
 * Evidence of a different run or a different source is never combined.
 */
export function sameRunAndSource(previous, next) {
  if (!previous || typeof previous !== "object") return false;
  if (!next || typeof next !== "object") return false;
  return (
    String(previous.runId ?? "") === String(next.runId ?? "")
    && String(previous.bvid ?? "") === String(next.bvid ?? "")
    && String(previous.order ?? "") === String(next.order ?? "")
  );
}

/**
 * The cleanup facts.
 *
 * The booleans CONVERGE false -> true: a verified deletion is never undone.
 * The cleanup failure may NOT be erased: the first non-null failure wins.
 */
export function mergeCleanupFacts({ previous, next }) {
  const before = previous ?? {};
  const after = next ?? {};
  const boolean = (key) => {
    const p = before[key];
    const n = after[key];
    if (p === true || n === true) return true;
    if (typeof n === "boolean") return n;
    if (typeof p === "boolean") return p;
    return null;
  };
  const previousFailure = typeof before.cleanupFailure === "string" && before.cleanupFailure
    ? before.cleanupFailure
    : null;
  const nextFailure = typeof after.cleanupFailure === "string" && after.cleanupFailure
    ? after.cleanupFailure
    : null;
  return {
    runtimeScratchDeleted: boolean("runtimeScratchDeleted"),
    profileRootDeleted: boolean("profileRootDeleted"),
    cleanupFailure: previousFailure ?? nextFailure,
  };
}

/**
 * The FULL internal publication shape.
 *
 * It is the shape the RUNNER writes into the machine receipt
 * (`provider.published`). Every field is required and typed: a publication
 * that misses one of them is PARTIAL and it is refused.
 */
export const PUBLICATION_SHAPE = Object.freeze([
  "providerId", "modelId", "endpointClass", "structureMode", "attemptId",
  "requestCount", "latencyMs", "requestSha256", "responseSha256",
  "outboundDerivedTextSha256", "finishReason", "uploadCounters",
]);

/** The upload counters of a publication. Every one of them must be present. */
export const PUBLICATION_UPLOAD_COUNTER_KEYS = Object.freeze([
  "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
  "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount",
]);

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * A publication is only accepted when it carries the WHOLE identity of a
 * real publication.
 *
 * A partial, malformed or empty object is a FABRICATION and it is refused.
 * The check is structural: it never looks at a value beyond its type and
 * its emptiness.
 */
export function isRealPublication(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  for (const key of PUBLICATION_SHAPE) {
    if (!(key in value)) return false;
  }
  for (const key of ["providerId", "modelId", "endpointClass", "structureMode", "attemptId", "finishReason"]) {
    if (typeof value[key] !== "string" || !value[key]) return false;
  }
  if (!Number.isInteger(value.requestCount) || value.requestCount < 0) return false;
  if (typeof value.latencyMs !== "number" || !Number.isFinite(value.latencyMs) || value.latencyMs < 0) return false;
  for (const key of ["requestSha256", "responseSha256", "outboundDerivedTextSha256"]) {
    if (typeof value[key] !== "string" || !SHA256_HEX.test(value[key])) return false;
  }
  const counters = value.uploadCounters;
  if (!counters || typeof counters !== "object" || Array.isArray(counters)) return false;
  for (const key of PUBLICATION_UPLOAD_COUNTER_KEYS) {
    if (!Number.isInteger(counters[key]) || counters[key] < 0) return false;
  }
  return true;
}

/**
 * The Provider facts.
 *
 * The attempted facts follow the FINAL run state. The published receipt may
 * replace an earlier null, it is never erased and it is never fabricated.
 */
export function mergeProviderFacts({ previous, next }) {
  const before = previous ?? {};
  const after = next ?? {};
  const merged = { ...before };
  for (const key of ["selectedProviderId", "selectedEndpointClass"]) {
    const value = after[key];
    if (value === null || value === undefined) continue;
    merged[key] = value;
  }
  const attemptedBefore = before.attempted ?? {};
  const attemptedAfter = after.attempted ?? {};
  const attempted = { ...attemptedBefore };
  for (const key of ["attemptCount", "providerId", "endpointClass", "requestCount"]) {
    const value = attemptedAfter[key];
    if (value === null || value === undefined) continue;
    attempted[key] = value;
  }
  merged.attempted = attempted;
  const nextPublished = after.published ?? null;
  if (isRealPublication(nextPublished)) {
    merged.published = nextPublished;
  } else if (isRealPublication(before.published)) {
    // A later null (or a FABRICATED object) never erases a real publication.
    merged.published = before.published;
  } else {
    // A publication that does not carry the whole identity of a real
    // publication is a FABRICATION: it is refused.
    merged.published = null;
  }
  return merged;
}

/**
 * The upload counters.
 *
 * A non-zero count is a VIOLATION and it is never erased: every counter
 * converges to the larger of the two values.
 */
export function mergeUploadCounters({ previous, next }) {
  const before = previous ?? {};
  const after = next ?? {};
  const merged = { ...before };
  for (const [key, value] of Object.entries(after)) {
    if (typeof value !== "number") continue;
    const current = typeof merged[key] === "number" ? merged[key] : 0;
    merged[key] = Math.max(current, value);
  }
  return merged;
}

/**
 * The strength of a failure code.
 *
 *   2 — a FROZEN Runtime failure code (V3510B_* / V352_*): the strongest
 *       fact, and it survives a later, weaker attempt.
 *   1 — a runner-level safe code (an upper-case code such as
 *       VISIBLE_AUTHORIZATION_REFUSED).
 *   0 — anything else (a generic Error name, or nothing at all).
 */
export function failureCodeStrength(code) {
  if (typeof code !== "string" || !code) return 0;
  if (/^V(?:3510B|352)_[A-Z0-9_]+$/.test(code)) return 2;
  if (/^[A-Z][A-Z0-9_]{3,63}$/.test(code)) return 1;
  return 0;
}

/**
 * The TERMINAL PAIR.
 *
 * The explicit precedence:
 *
 *   1. a STRONGER disposition wins (failed > blocked > limited > complete);
 *   2. within one disposition, a STRONGER failure code wins, so a frozen
 *      Runtime code survives a later, weaker attempt;
 *   3. within one disposition and one code strength, the FINAL run state
 *      wins, so the pair always describes the same attempt.
 */
export function mergeTerminalPair({ previous, next }) {
  const previousDisposition = String(previous?.disposition ?? "");
  const nextDisposition = String(next?.disposition ?? "");
  const previousPrecedence = dispositionPrecedence(previousDisposition);
  const nextPrecedence = dispositionPrecedence(nextDisposition);
  if (nextPrecedence > previousPrecedence) {
    return {
      disposition: nextDisposition || previousDisposition,
      failureCode: next?.failureCode ?? null,
    };
  }
  if (nextPrecedence < previousPrecedence) {
    return {
      disposition: previousDisposition,
      failureCode: previous?.failureCode ?? null,
    };
  }
  const previousStrength = failureCodeStrength(previous?.failureCode);
  const nextStrength = failureCodeStrength(next?.failureCode);
  if (nextStrength < previousStrength) {
    return {
      disposition: previousDisposition || nextDisposition,
      failureCode: previous?.failureCode ?? null,
    };
  }
  return {
    disposition: nextDisposition || previousDisposition,
    failureCode: next?.failureCode ?? null,
  };
}

/**
 * The whole durable receipt merge.
 *
 * @param {object|null} previous the receipt that is already on disk
 * @param {object} next the state of the current finalization
 */
export function mergeMachineReceipt({ previous, next }) {
  if (!previous || typeof previous !== "object") return next;
  if (!next || typeof next !== "object") return next;
  // Evidence of a DIFFERENT run or a DIFFERENT source is never combined.
  if (!sameRunAndSource(previous, next)) return next;

  const merged = { ...previous };
  for (const key of CURRENT_RUN_FIELDS) {
    const value = next[key];
    if (value === null || value === undefined) continue;
    merged[key] = value;
  }
  merged.cleanup = mergeCleanupFacts({ previous: previous.cleanup, next: next.cleanup });
  merged.provider = mergeProviderFacts({ previous: previous.provider, next: next.provider });
  merged.uploadCounters = mergeUploadCounters({
    previous: previous.uploadCounters,
    next: next.uploadCounters,
  });
  const pair = mergeTerminalPair({ previous, next });
  merged.disposition = pair.disposition;
  merged.failureCode = pair.failureCode;
  return merged;
}
