// The durable Stage action ledger.
//
// The ledger is APPEND-ONLY. It is created BEFORE the first external action
// and finalized in a finally path. It records ATTEMPTS and COUNTS only: never
// a Cookie value, never a secret length, never a private path, never a raw
// payload.
//
// It distinguishes the LIFETIME (stage) totals from the totals of ONE
// candidate run. A report may never present a candidate's counts as the
// stage's counts.
//
// The one-shot authorization identifier is consumed HERE, before any external
// action: a consumed identifier can never authorize a second visible run.

import fs from "node:fs";
import path from "node:path";

/** Every countable external action of the Stage B runner. */
export const LEDGER_EVENTS = Object.freeze([
  "chromeLaunch",
  "visibleWindow",
  "runtimeStart",
  // The number of Runtime synthesize ENDPOINT invocations.
  "runtimeSynthesize",
  // The number of ACTUAL outbound Provider HTTP attempts.
  "providerCall",
  "download",
  "import",
  "mediaTask",
  "cookieInjection",
  "audioOutput",
  "tabCaptureAction",
  "focusEvent",
  "sourceAttempt",
  "sourceCompletion",
]);

/** The ledger's schema. */
export const LEDGER_SCHEMA = "v3-5.10-b5-stage-action/v1";

/**
 * The EXACT record shape of one ledger line.
 *
 * A line that does not match it is MALFORMED: it is skipped AND it sets
 * `integrityOk = false`, which prevents a positive aggregate verdict.
 */
export const LEDGER_RECORD_KEYS = Object.freeze([
  "schemaVersion", "event", "count", "candidateRunId", "at", "detail",
]);

/** The allowed detail enums. A detail may only carry these. */
export const LEDGER_DETAIL_ENUMS = Object.freeze({
  stage: Object.freeze([
    "authorization_granted",
    "authorization_refused",
    "chrome_launched",
    "cookie_injected",
    "owned_window_focused",
    "runtime_started",
    "synthesis_invoked",
    "provider_attempted",
    "synthesis_published",
    "task_created",
  ]),
});

/** The allowed detail KEYS. */
export const LEDGER_DETAIL_KEYS = Object.freeze(Object.keys(LEDGER_DETAIL_ENUMS));

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/**
 * Validate one ledger record.
 *
 * @returns {{ok: boolean, reason: string|null}}
 */
export function validateLedgerRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { ok: false, reason: "record_not_an_object" };
  }
  for (const key of Object.keys(record)) {
    if (!LEDGER_RECORD_KEYS.includes(key)) {
      return { ok: false, reason: `unknown_key_${key}` };
    }
  }
  if (record.schemaVersion !== LEDGER_SCHEMA) {
    return { ok: false, reason: "schema_version_mismatch" };
  }
  if (typeof record.event !== "string" || !LEDGER_EVENTS.includes(record.event)) {
    return { ok: false, reason: "unknown_event" };
  }
  if (!Number.isInteger(record.count) || record.count < 0) {
    return { ok: false, reason: "count_not_a_non_negative_integer" };
  }
  if (typeof record.candidateRunId !== "string" || !record.candidateRunId.trim()) {
    return { ok: false, reason: "candidate_run_id_missing" };
  }
  if (typeof record.at !== "string" || !ISO_TIMESTAMP.test(record.at)) {
    return { ok: false, reason: "timestamp_invalid" };
  }
  if (record.detail !== undefined) {
    if (!record.detail || typeof record.detail !== "object" || Array.isArray(record.detail)) {
      return { ok: false, reason: "detail_not_an_object" };
    }
    for (const [key, value] of Object.entries(record.detail)) {
      if (!LEDGER_DETAIL_KEYS.includes(key)) {
        return { ok: false, reason: `detail_key_not_allowed_${key}` };
      }
      const allowed = LEDGER_DETAIL_ENUMS[key] ?? [];
      if (!allowed.includes(value)) {
        return { ok: false, reason: `detail_value_not_allowed_${key}` };
      }
    }
  }
  return { ok: true, reason: null };
}

const DEFAULT_STAGE_ROOT = ".navia/b5-stage";

/**
 * The owned stage root.
 *
 * It is OUTSIDE every historical evidence directory and it is owned by the
 * runner, not by the product.
 */
export function resolveStageRoot({ environment = process.env, repositoryRoot = process.cwd() } = {}) {
  const configured = environment.NAVIA_B5_STAGE_ROOT;
  if (configured) return path.resolve(configured);
  return path.resolve(repositoryRoot, DEFAULT_STAGE_ROOT);
}

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
}

/** Append one event. The file is append-only: nothing is ever rewritten. */
export function appendLedgerEvent({ stageRoot, event, candidateRunId, count = 1, at = new Date().toISOString(), detail = null }) {
  if (!LEDGER_EVENTS.includes(event)) {
    throw new Error(`The stage ledger does not know the event "${event}".`);
  }
  ensureDir(stageRoot);
  const file = path.join(stageRoot, "stage-actions.jsonl");
  const record = {
    schemaVersion: LEDGER_SCHEMA,
    event,
    count: Number(count) || 0,
    candidateRunId: candidateRunId ?? null,
    at,
  };
  if (detail !== null && detail !== undefined) {
    // The detail may only carry a small, nonsecret classification.
    record.detail = detail;
  }
  const verdict = validateLedgerRecord(record);
  if (!verdict.ok) {
    throw new Error(`The stage ledger record is invalid: ${verdict.reason}.`);
  }
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  return record;
}

/** Read every event of the ledger. A malformed line is SKIPPED, not fatal. */
export function readLedgerEvents({ stageRoot }) {
  const file = path.join(stageRoot, "stage-actions.jsonl");
  if (!fs.existsSync(file)) return { events: [], malformed: 0 };
  const events = [];
  let malformed = 0;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      // Only an EXACTLY valid record counts. A malformed, truncated or
      // unknown line is counted AND it breaks the integrity of the ledger.
      if (validateLedgerRecord(parsed).ok) {
        events.push(parsed);
      } else {
        malformed += 1;
      }
    } catch {
      malformed += 1;
    }
  }
  return { events, malformed };
}

/** The totals of the WHOLE stage and of ONE candidate run. */
export function readStageTotals({ stageRoot, candidateRunId = null }) {
  const { events, malformed } = readLedgerEvents({ stageRoot });
  const stage = {};
  const candidate = {};
  const runs = new Set();
  for (const event of events) {
    const count = Number(event.count) || 0;
    stage[event.event] = (stage[event.event] ?? 0) + count;
    if (event.candidateRunId) runs.add(String(event.candidateRunId));
    if (candidateRunId && event.candidateRunId === candidateRunId) {
      candidate[event.event] = (candidate[event.event] ?? 0) + count;
    }
  }
  for (const key of LEDGER_EVENTS) {
    stage[key] = stage[key] ?? 0;
    candidate[key] = candidate[key] ?? 0;
  }
  return {
    stage,
    candidate,
    candidateRunIds: [...runs].sort(),
    eventCount: events.length,
    malformedLines: malformed,
    integrityOk: malformed === 0,
  };
}

/**
 * The ledger handle of ONE candidate run.
 *
 * It is created before the first external action and finalized in a finally
 * path. The handle never writes anything that could carry a secret.
 */
export function openStageLedger({ stageRoot, candidateRunId }) {
  const totals = () => readStageTotals({ stageRoot, candidateRunId });
  return {
    stageRoot,
    candidateRunId,
    record(event, count = 1, detail = null) {
      return appendLedgerEvent({
        stageRoot,
        event,
        candidateRunId,
        count,
        detail,
      });
    },
    totals,
    finalize() {
      return totals();
    },
  };
}

// ---------------------------------------------------------------------------
// The reconciliation of the RETAINED logs of the earlier attempts.
// ---------------------------------------------------------------------------

/**
 * Reconcile the retained console logs of the earlier attempts.
 *
 * The logs are READ ONLY. The result is a LOWER BOUND: a log that cannot be
 * parsed contributes nothing, and the reason is reported. A counter is never
 * guessed.
 */
/**
 * Reconcile the retained logs of the EARLIER attempts into a LOWER BOUND.
 *
 * Two kinds of retained record exist:
 *
 *   * a CONSOLE log: it records EVERY launch of ONE attempt, and
 *   * a per-source `chrome_launch.log`: it records the launch of ONE source.
 *
 * The lower bound counts the CONSOLE records only: every console log is one
 * attempt, and every launch of that attempt appears in it. The per-source
 * records are reported SEPARATELY and are never added, because they describe
 * launches that the console record of the SAME attempt already contains:
 * adding them would count a launch twice.
 *
 * Only the EXPLICIT records are counted, so the result is a LOWER BOUND. The
 * entries carry a SAFE relative label; an absolute path is never reported.
 */
export function reconcileRetainedLogs({ logEntries = [] }) {
  const perLog = [];
  const perSource = [];
  let unreadableOrMissing = 0;
  let chromeLaunch = 0;

  for (const entry of logEntries) {
    // The entry carries a SAFE relative label and a path. Only the label is
    // ever reported: an absolute path never enters the evidence.
    const label = String(entry.label ?? "unlabelled");
    const file = entry.path;
    let text = null;
    if (file) {
      try {
        text = fs.readFileSync(file, "utf8");
      } catch {
        text = null;
      }
    }
    if (text === null) {
      unreadableOrMissing += 1;
      perLog.push({ label, launches: null, reason: "missing_or_unreadable" });
      continue;
    }
    if (entry.kind === "source_launch_log") {
      // A per-source launch log counts ONE launch: the explicit record of
      // the owned Chrome process of that source. It is NOT added to the
      // lower bound (see the note below).
      const launched = /^pid=/m.test(text);
      perSource.push({ label, launches: launched ? 1 : 0, reason: launched ? null : "no_launch_record" });
      continue;
    }
    const launches = (text.match(/Chrome launched via launchPersistentContext/g) ?? []).length;
    perLog.push({ label, launches, reason: null });
    chromeLaunch += launches;
  }

  return {
    method: "explicit_chrome_launch_records_in_the_retained_console_logs",
    perLog,
    lowerBound: {
      chromeLaunch,
    },
    perSourceLaunchRecords: {
      count: perSource.reduce((total, entry) => total + entry.launches, 0),
      perLog: perSource,
      note: "NOT ADDED to the lower bound: a per-source launch record belongs to an attempt whose console record already counts that launch.",
    },
    unreadableOrMissing,
    note: "A lower bound: only the EXPLICIT launch records of the retained console logs are counted, and every console log is ONE attempt. A log that cannot be parsed contributes nothing.",
  };
}
