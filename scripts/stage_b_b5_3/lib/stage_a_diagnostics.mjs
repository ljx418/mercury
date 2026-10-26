// The STAGE A stable-code and diagnostic mapping.
//
// ONE owner for the harness codes of the Stage A phases and for the
// privacy-safe observations of a Stage A attempt.
//
// A code is a stable enum, never a prose sentence. The prose is DERIVED from
// the constants, so it can never drift from the budget that produced it. The
// observations carry COUNTS, ENUMS and BOOLEANS only: never a response
// body, a text, a Cookie, a path, a token or a Provider identity.

/** The stable internal codes of the Stage A failures. */
export const STAGE_A_CODE = Object.freeze({
  AUTHORITY_TIMEOUT: "B6_STAGE_A_AUTHORITY_TIMEOUT",
  AUTHORITY_BLOCKED: "B6_STAGE_A_AUTHORITY_BLOCKED",
  AUTHORITY_UNEXPECTED: "B6_STAGE_A_AUTHORITY_UNEXPECTED",
  OUTLINE_CREATE_FAILED: "B6_STAGE_A_OUTLINE_CREATE_FAILED",
  MEDIA_TASK_TIMEOUT: "B6_STAGE_A_MEDIA_TASK_TIMEOUT",
  MEDIA_TASK_BLOCKED: "B6_STAGE_A_MEDIA_TASK_BLOCKED",
});

/** The Stage A budgets of the harness. They are a RUNNER budget. */
export const STAGE_A_BUDGETS = Object.freeze({
  authorityDeadlineMs: 5 * 60_000,
  mediaTaskDeadlineMs: 20 * 60_000,
});

/** The frozen authority states of the product. */
export const AUTHORITY_PENDING_STATES = Object.freeze(["active", "published"]);

/** The frozen blocked authority states of the product. */
export const AUTHORITY_BLOCKED_STATES = Object.freeze(["cancelled", "failed"]);

/** The frozen terminal media-task states. */
export const MEDIA_TASK_TERMINAL_STATES = Object.freeze(["ready", "degraded"]);

/** The frozen blocked media-task states. */
export const MEDIA_TASK_BLOCKED_STATES = Object.freeze(["cancelled", "failed"]);

/** The elapsed-time bucket of a Stage A attempt. */
export function elapsedBucket(milliseconds) {
  const elapsed = Math.max(0, Number(milliseconds ?? 0));
  if (elapsed < 60_000) return "under-1m";
  if (elapsed <= 5 * 60_000) return "1m-5m";
  if (elapsed <= 20 * 60_000) return "5m-20m";
  return "over-20m";
}

/** The HTTP status class of a response. The status itself is not recorded. */
export function statusClass(status) {
  if (typeof status !== "number" || !Number.isFinite(status)) return "absent";
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  if (status >= 200) return "2xx";
  return "other";
}

/** The state class of an authority or a media-task row. */
export function stateClass(state, { pending = AUTHORITY_PENDING_STATES, blocked = AUTHORITY_BLOCKED_STATES } = {}) {
  const value = String(state ?? "");
  if (!value) return "absent";
  if (pending.includes(value)) return "pending";
  if (blocked.includes(value)) return "blocked";
  return "other";
}

/**
 * The exact source-identity match.
 *
 * The identity is compared by its PARSED components: the namespace, the
 * adapter and the bvid. A foreign identity that merely CONTAINS the bvid
 * (as a substring of another id, or with another adapter) is NEVER a match.
 */
export function matchesFrozenIdentity(identity, { bvid, portalId = "bilibili" } = {}) {
  const parts = String(identity ?? "").split(":");
  if (parts.length < 4) return false;
  if (parts[0] !== "portal") return false;
  if (parts[1] !== portalId) return false;
  return parts[2] === String(bvid ?? "");
}

/** The DERIVED timeout text. It can never disagree with the constant. */
export function timeoutText(deadlineMs) {
  const minutes = Number(deadlineMs ?? 0) / 60000;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} minutes`;
}

/**
 * A fresh, privacy-safe Stage A observation.
 */
export function newStageADiagnostic({ enableState = "not-attempted", permissionState = "unknown" } = {}) {
  return {
    code: null,
    phase: null,
    authorityPollCount: 0,
    authorityRowCount: 0,
    exactIdentityMatchCount: 0,
    authorityStateClass: "absent",
    mediaTaskPollCount: 0,
    mediaTaskRowCount: 0,
    mediaTaskStateClass: "absent",
    elapsedBucket: "under-1m",
    enableState,
    permissionState,
    resolveStatusClass: "absent",
  };
}
