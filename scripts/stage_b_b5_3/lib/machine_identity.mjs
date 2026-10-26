// The EXPLICIT validators of the machine-receipt IDENTITY and TERMINAL
// shape.
//
// A machine receipt that MISSES a field is not a receipt with fewer facts:
// it is a receipt whose facts can no longer be compared. Every field below
// is therefore REQUIRED, TYPED, PATTERNED and COMPARED. There is no truthy
// conditional comparison anywhere in this module: absence, null, a wrong
// type, a malformed value and a mismatch are all defects.
//
// The frozen shapes and the frozen authority come from the product:
//   * the task id and the task namespace are `media_task_<32 hex>`;
//   * the source identity is `portal:<adapter>:<bvid>:<unit>:<part>` and the
//     FROZEN authority is the literal `portal` / `bilibili`;
//   * the dependency generation is `depgen_<64 hex>`;
//   * the registry digest and the artifact digests are 64 hex;
//   * the order is 1..6 and the bvid is `BV<10 alnum>`;
//   * the timestamps are finite, real UTC instants.

/** The FROZEN source portal and adapter of this stage. */
export const FROZEN_SOURCE_PORTAL = "portal";
export const FROZEN_SOURCE_ADAPTER = "bilibili";

/** The machine identity fields. Every one of them is required. */
export const MACHINE_IDENTITY_FIELDS = Object.freeze([
  "runId",
  "registrySha256",
  "order",
  "bvid",
  "taskId",
  "taskNamespace",
  "taskRevision",
  "sourceIdentity",
  "dependencyGeneration",
  "startedAtUtc",
  "finishedAtUtc",
]);

/** The machine TERMINAL fields. Every one of them is required. */
export const MACHINE_TERMINAL_FIELDS = Object.freeze(["disposition"]);

/** The frozen disposition vocabulary. */
export const MACHINE_DISPOSITIONS = Object.freeze(["complete", "limited", "blocked", "failed"]);

const TASK_ID = /^media_task_[a-f0-9]{32}$/;
const BVID = /^BV[0-9A-Za-z]{10}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const DEPENDENCY_GENERATION = /^depgen_[a-f0-9]{64}$/;
const SOURCE_IDENTITY = /^([a-z][a-z0-9_-]{1,31}):([^:]+):([^:]+):([^:]+):([^:]+)$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const ISO_COMPONENTS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/;

/**
 * TRUE when the value is a FINITE, REAL UTC instant.
 *
 * A regular expression alone is not enough: `2026-99-99T99:99:99Z` matches
 * the format, and `2026-02-30T00:00:00Z` is silently rolled over to March
 * by the JavaScript date parser. The calendar is therefore checked
 * explicitly and the value is never normalized.
 */
export function isFiniteUtcInstant(value) {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const match = ISO_COMPONENTS.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return false;
  return true;
}

/**
 * Parse a source identity into its frozen components.
 *
 * @returns {{portal: string, adapter: string, bvid: string, playbackUnit: string, part: string}|null}
 */
export function parseSourceIdentity(value) {
  if (typeof value !== "string") return null;
  const match = SOURCE_IDENTITY.exec(value);
  if (!match) return null;
  return {
    portal: match[1],
    adapter: match[2],
    bvid: match[3],
    playbackUnit: match[4],
    part: match[5],
  };
}

/**
 * The defects of a machine receipt's identity.
 *
 * @param {object|null} receipt the machine receipt
 * @param {object} expected the EXPECTED identity of the row and the run
 * @returns {string[]} the defects; an empty array means the identity is complete and exact
 */
export function machineIdentityDefects(receipt, expected = {}) {
  const defects = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return ["the machine receipt is missing"];
  }
  const { runId, registrySha256, order, bvid } = expected;

  // 1. The RUN id.
  if (typeof receipt.runId !== "string" || !receipt.runId.trim()) {
    defects.push("the machine receipt has no valid runId");
  } else if (runId !== undefined && runId !== null && receipt.runId !== runId) {
    defects.push(`the machine receipt carries run ${receipt.runId} instead of ${runId}`);
  }

  // 2. The ACTIVE registry digest.
  if (typeof receipt.registrySha256 !== "string" || !SHA256_HEX.test(receipt.registrySha256)) {
    defects.push("the machine receipt has no valid registrySha256");
  } else if (registrySha256 !== undefined && registrySha256 !== null && receipt.registrySha256 !== registrySha256) {
    defects.push("the machine receipt was produced against another registry");
  }

  // 3. The FROZEN order.
  if (!Number.isInteger(receipt.order) || receipt.order < 1 || receipt.order > 6) {
    defects.push("the machine receipt has no valid order");
  } else if (order !== undefined && order !== null && Number(receipt.order) !== Number(order)) {
    defects.push(`the machine receipt carries order ${receipt.order} instead of ${order}`);
  }

  // 4. The FROZEN bvid.
  if (typeof receipt.bvid !== "string" || !BVID.test(receipt.bvid)) {
    defects.push("the machine receipt has no valid bvid");
  } else if (bvid !== undefined && bvid !== null && receipt.bvid !== bvid) {
    defects.push(`the machine receipt carries the source ${receipt.bvid} instead of ${bvid}`);
  }

  // 5. The TASK id and the TASK NAMESPACE.
  if (typeof receipt.taskId !== "string" || !TASK_ID.test(receipt.taskId)) {
    defects.push("the machine receipt has no valid taskId");
  }
  if (typeof receipt.taskNamespace !== "string" || !TASK_ID.test(receipt.taskNamespace)) {
    defects.push("the machine receipt has no valid taskNamespace");
  }

  // 6. The TASK revision.
  if (!Number.isInteger(receipt.taskRevision) || receipt.taskRevision < 1) {
    defects.push("the machine receipt has no valid taskRevision");
  }

  // 7. The SOURCE identity, and its FROZEN authority.
  const source = parseSourceIdentity(receipt.sourceIdentity);
  if (!source) {
    defects.push("the machine receipt has no valid sourceIdentity");
  } else {
    if (source.portal !== FROZEN_SOURCE_PORTAL) {
      defects.push(`the machine receipt source identity names the portal ${source.portal} instead of ${FROZEN_SOURCE_PORTAL}`);
    }
    if (source.adapter !== FROZEN_SOURCE_ADAPTER) {
      defects.push(`the machine receipt source identity names the adapter ${source.adapter} instead of ${FROZEN_SOURCE_ADAPTER}`);
    }
    if (!source.playbackUnit || !source.part) {
      defects.push("the machine receipt source identity has no playback unit or part");
    }
    if (bvid !== undefined && bvid !== null && source.bvid !== String(bvid)) {
      defects.push(`the machine receipt source identity names ${source.bvid} instead of ${bvid}`);
    }
  }

  // 8. The DEPENDENCY generation.
  if (typeof receipt.dependencyGeneration !== "string" || !DEPENDENCY_GENERATION.test(receipt.dependencyGeneration)) {
    defects.push("the machine receipt has no valid dependencyGeneration");
  }

  // 9. The FRESH attempt window: finite, real UTC instants.
  if (!isFiniteUtcInstant(receipt.startedAtUtc)) {
    defects.push("the machine receipt has no valid startedAtUtc");
  }
  if (!isFiniteUtcInstant(receipt.finishedAtUtc)) {
    defects.push("the machine receipt has no valid finishedAtUtc");
  }
  if (
    isFiniteUtcInstant(receipt.startedAtUtc)
    && isFiniteUtcInstant(receipt.finishedAtUtc)
    && Date.parse(receipt.finishedAtUtc) < Date.parse(receipt.startedAtUtc)
  ) {
    defects.push("the machine receipt finishes before it starts");
  }

  return defects;
}

/**
 * Validate the authority of every attempted row, including a source blocked
 * before a product task exists.
 *
 * Run, registry, row, execution namespace and attempt window always exist.
 * Product task fields may be absent for a pre-task block, but any facts that
 * do exist are validated and a task id requires its revision and source.
 */
export function machineAttemptIdentityDefects(receipt, expected = {}) {
  const defects = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return ["the machine receipt is missing"];
  }
  const { runId, registrySha256, order, bvid } = expected;
  if (typeof receipt.runId !== "string" || !receipt.runId.trim()) {
    defects.push("the machine receipt has no valid runId");
  } else if (runId !== undefined && runId !== null && receipt.runId !== runId) {
    defects.push(`the machine receipt carries run ${receipt.runId} instead of ${runId}`);
  }
  if (typeof receipt.registrySha256 !== "string" || !SHA256_HEX.test(receipt.registrySha256)) {
    defects.push("the machine receipt has no valid registrySha256");
  } else if (registrySha256 !== undefined && registrySha256 !== null && receipt.registrySha256 !== registrySha256) {
    defects.push("the machine receipt was produced against another registry");
  }
  if (!Number.isInteger(receipt.order) || receipt.order < 1 || receipt.order > 6) {
    defects.push("the machine receipt has no valid order");
  } else if (order !== undefined && order !== null && receipt.order !== Number(order)) {
    defects.push(`the machine receipt carries order ${receipt.order} instead of ${order}`);
  }
  if (typeof receipt.bvid !== "string" || !BVID.test(receipt.bvid)) {
    defects.push("the machine receipt has no valid bvid");
  } else if (bvid !== undefined && bvid !== null && receipt.bvid !== String(bvid)) {
    defects.push(`the machine receipt carries the source ${receipt.bvid} instead of ${bvid}`);
  }
  if (typeof receipt.taskNamespace !== "string" || !TASK_ID.test(receipt.taskNamespace)) {
    defects.push("the machine receipt has no valid taskNamespace");
  }
  if (!isFiniteUtcInstant(receipt.startedAtUtc)) {
    defects.push("the machine receipt has no valid startedAtUtc");
  }
  if (!isFiniteUtcInstant(receipt.finishedAtUtc)) {
    defects.push("the machine receipt has no valid finishedAtUtc");
  }
  if (
    isFiniteUtcInstant(receipt.startedAtUtc)
    && isFiniteUtcInstant(receipt.finishedAtUtc)
    && Date.parse(receipt.finishedAtUtc) < Date.parse(receipt.startedAtUtc)
  ) {
    defects.push("the machine receipt finishes before it starts");
  }

  const hasTaskId = receipt.taskId !== null && receipt.taskId !== undefined;
  const hasRevision = receipt.taskRevision !== null && receipt.taskRevision !== undefined;
  const hasSource = receipt.sourceIdentity !== null && receipt.sourceIdentity !== undefined;
  const hasGeneration = receipt.dependencyGeneration !== null && receipt.dependencyGeneration !== undefined;
  if (hasTaskId && (typeof receipt.taskId !== "string" || !TASK_ID.test(receipt.taskId))) {
    defects.push("the machine receipt has no valid taskId");
  }
  if (hasRevision && (!Number.isInteger(receipt.taskRevision) || receipt.taskRevision < 1)) {
    defects.push("the machine receipt has no valid taskRevision");
  }
  if (hasGeneration && (typeof receipt.dependencyGeneration !== "string" || !DEPENDENCY_GENERATION.test(receipt.dependencyGeneration))) {
    defects.push("the machine receipt has no valid dependencyGeneration");
  }
  if (hasSource) {
    const source = parseSourceIdentity(receipt.sourceIdentity);
    if (!source) {
      defects.push("the machine receipt has no valid sourceIdentity");
    } else {
      if (source.portal !== FROZEN_SOURCE_PORTAL) {
        defects.push(`the machine receipt source identity names the portal ${source.portal} instead of ${FROZEN_SOURCE_PORTAL}`);
      }
      if (source.adapter !== FROZEN_SOURCE_ADAPTER) {
        defects.push(`the machine receipt source identity names the adapter ${source.adapter} instead of ${FROZEN_SOURCE_ADAPTER}`);
      }
      if (bvid !== undefined && bvid !== null && source.bvid !== String(bvid)) {
        defects.push(`the machine receipt source identity names ${source.bvid} instead of ${bvid}`);
      }
    }
  }
  if (hasTaskId && (!hasRevision || !hasSource)) {
    defects.push("the machine receipt carries a partial product task identity");
  }
  if (!hasTaskId && (hasRevision || hasGeneration)) {
    defects.push("the machine receipt carries task facts without a taskId");
  }
  return defects;
}

/**
 * The defects of the machine receipt's TERMINAL shape.
 *
 * The disposition is a REQUIRED, TYPED field of the frozen vocabulary and it
 * is compared UNCONDITIONALLY with the parsed final disposition.
 *
 * @param {object|null} receipt the machine receipt
 * @param {object} expected the parsed final disposition of the row
 * @returns {string[]} the defects
 */
export function machineTerminalDefects(receipt, expected = {}) {
  const defects = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return ["the machine receipt is missing"];
  }
  const { disposition } = expected;
  if (typeof receipt.disposition !== "string" || !receipt.disposition) {
    defects.push("the machine receipt has no valid disposition");
  } else if (!MACHINE_DISPOSITIONS.includes(receipt.disposition)) {
    defects.push(`the machine receipt carries the unknown disposition ${receipt.disposition}`);
  } else if (disposition !== undefined && disposition !== null && receipt.disposition !== disposition) {
    // The MISMATCH is reported by the caller with its own failure code: it is
    // a disagreement, not a malformed shape.
    defects.push(`the machine receipt says ${receipt.disposition} and the final disposition is ${disposition}`);
  }
  return defects;
}

/**
 * The MACHINE DISPOSITION MISMATCH: the machine disposition compared with the
 * parsed final disposition.
 *
 * It is compared UNCONDITIONALLY: a missing disposition never disables the
 * comparison.
 */
export function machineDispositionMismatch(receipt, parsedDisposition) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return null;
  if (typeof receipt.disposition !== "string" || !receipt.disposition) return null;
  if (parsedDisposition === undefined || parsedDisposition === null) return null;
  if (receipt.disposition === parsedDisposition) return null;
  return `the machine receipt says ${receipt.disposition} and the final disposition is ${parsedDisposition}`;
}

/**
 * The defects of the task-namespace RECEIPT.
 *
 * The file is PARSED: its presence is not proof. The key set is exact, and
 * the namespace, the run id, the order and the bvid are bound to the machine
 * receipt, the current run and the registry row.
 */
export function taskNamespaceReceiptDefects(receipt, expected = {}) {
  const defects = [];
  const REQUIRED_KEYS = ["taskIdNamespace", "bvid", "order", "runId"];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return ["the task namespace receipt is missing"];
  }
  const keys = Object.keys(receipt).sort();
  const missing = REQUIRED_KEYS.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !REQUIRED_KEYS.includes(key));
  if (missing.length > 0) {
    defects.push(`the task namespace receipt lacks ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    defects.push(`the task namespace receipt carries the additional field(s) ${extra.join(", ")}`);
  }
  const { taskNamespace, runId, order, bvid } = expected;
  if (typeof receipt.taskIdNamespace !== "string" || !TASK_ID.test(receipt.taskIdNamespace)) {
    defects.push("the task namespace receipt has no valid taskIdNamespace");
  } else if (taskNamespace !== undefined && taskNamespace !== null && receipt.taskIdNamespace !== taskNamespace) {
    defects.push("the task namespace receipt names another task namespace");
  }
  if (typeof receipt.runId !== "string" || !receipt.runId.trim()) {
    defects.push("the task namespace receipt has no valid runId");
  } else if (runId !== undefined && runId !== null && receipt.runId !== runId) {
    defects.push(`the task namespace receipt carries run ${receipt.runId} instead of ${runId}`);
  }
  if (!Number.isInteger(receipt.order) || receipt.order < 1 || receipt.order > 6) {
    defects.push("the task namespace receipt has no valid order");
  } else if (order !== undefined && order !== null && Number(receipt.order) !== Number(order)) {
    defects.push(`the task namespace receipt carries order ${receipt.order} instead of ${order}`);
  }
  if (typeof receipt.bvid !== "string" || !BVID.test(receipt.bvid)) {
    defects.push("the task namespace receipt has no valid bvid");
  } else if (bvid !== undefined && bvid !== null && receipt.bvid !== bvid) {
    defects.push(`the task namespace receipt carries the source ${receipt.bvid} instead of ${bvid}`);
  }
  return defects;
}
