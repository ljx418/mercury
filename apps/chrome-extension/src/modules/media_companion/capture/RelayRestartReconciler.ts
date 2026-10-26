/**
 * WP0 R1-C2-3 — `RelayRestartReconciler`.
 *
 * A service worker can be torn down at any phase of a capture. On the next
 * worker start this reconciler reads the frozen restart marker from
 * `chrome.storage.session` (access level `TRUSTED_CONTEXTS`) and dispatches
 * the phase to the EXISTING authenticated Runtime endpoints.
 *
 * Frozen `restartBehavior`:
 *   phase_dispatch_to_existing_DELETE_or_runtime_finally_or_existing_recover
 *   never_resume_old_pcm_ticket_or_sequence
 *
 * Therefore this module NEVER restores PCM, ticket, sequence or credit. It
 * only drives the pre-existing authenticated DELETE / GET / recover so the
 * old task reaches an explainable terminal, then clears the marker once the
 * owner receipt and the cleanup grace are observed.
 *
 * `restartTermination.newWorkerRole`: the new worker never becomes the
 * owner of the old capture; it is a recovery observer only.
 */

import {
  RELAY_FAILURE_CODES,
  RESTART_MARKER_ACCESS_LEVEL,
  RESTART_MARKER_FIELDS,
  RESTART_MARKER_PHASES,
  RESTART_MARKER_SCHEMA_VERSION,
  RELAY_V10,
  SESSION_ID_PATTERN,
  isRestartMarkerPhase,
  type RelayFailureCode,
  type RelayRestartMarker,
  type RestartMarkerPhase
} from "./relayContracts";
import {
  RelayRuntimeError,
  type RelayRecoveryResult
} from "./RuntimeRelayRecoveryAdapter";

/** The session store surface used by the reconciler. */
export type RelaySessionStore = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
  /** `chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })`. */
  setAccessLevel?(options: { accessLevel: "TRUSTED_CONTEXTS" }): Promise<void>;
};

export const RELAY_MARKER_KEY = "navia.relay.restartMarker.v10";

/**
 * What the reconciler may call. R1-C3-01 replaced the previous
 * self-message adapter with the REAL authenticated Runtime client, so this
 * contract now matches `RuntimeRelayRecoveryAdapter` exactly.
 *
 * There is deliberately NO `recover(sourceIdentity)`: the frozen marker is
 * strictly six fields and carries no `sourceIdentity`, so claiming that
 * member is callable would be a false contract.
 */
export type RelayRecoveryAdapter = {
  /** `connecting`: bootstrap session -> DELETE -> GET. */
  cancelThenObserve(taskId: string): Promise<RelayRecoveryResult>;
  /** Runtime-owned phases: bootstrap session -> GET. */
  observe(taskId: string): Promise<RelayRecoveryResult>;
};

/**
 * The acquisition terminal set, bound to `MediaAcquisitionTask.state`
 * (`runtimeClient.ts`). R1-C3-01 removed `ready` and `published`, which
 * belong to the projection / outline resources and never occur on an
 * acquisition.
 */
export const ACQUISITION_TERMINAL_STATES = Object.freeze([
  "succeeded",
  "degraded",
  "blocked",
  "failed",
  "cancelled"
] as const);

export type RelayRestartReconcilerDependencies = {
  store: RelaySessionStore;
  runtime: RelayRecoveryAdapter;
  now?: () => number;
  /** Cleanup grace observed before a marker may be cleared. */
  cleanupGraceMs?: number;
  onFailure?: (failureCode: RelayFailureCode) => void;
  onDispatch?: (phase: RestartMarkerPhase, action: string) => void;
};

export type ReconcileOutcome =
  | { action: "none" }
  | { action: "expired"; captureSessionId: string }
  | { action: "invalid"; reason: string }
  | { action: "dispatched"; phase: RestartMarkerPhase; terminal: string | null; cleared: boolean }
  | { action: "runtime-unavailable"; phase: RestartMarkerPhase; failureCode: RelayFailureCode };

/** Validate a stored marker against the frozen shape. */
export function validateStoredMarker(value: unknown): {
  ok: true;
  marker: RelayRestartMarker;
} | { ok: false; reason: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "marker_absent" };
  }
  const candidate = value as Record<string, unknown>;
  // Exactly the six frozen fields; any extra is a fail-closed pollution.
  const keys = Object.keys(candidate).sort();
  const expected = [...RESTART_MARKER_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return { ok: false, reason: "marker_fields_invalid" };
  }
  if (candidate.schemaVersion !== RESTART_MARKER_SCHEMA_VERSION) {
    return { ok: false, reason: "marker_schema_mismatch" };
  }
  if (typeof candidate.captureSessionId !== "string" || !SESSION_ID_PATTERN.test(candidate.captureSessionId)) {
    return { ok: false, reason: "marker_session_id_invalid" };
  }
  if (typeof candidate.taskId !== "string" || !/^media_task_[0-9a-f]{32}$/.test(candidate.taskId)) {
    return { ok: false, reason: "marker_task_id_invalid" };
  }
  if (typeof candidate.startedAt !== "string" || Number.isNaN(Date.parse(candidate.startedAt))) {
    return { ok: false, reason: "marker_started_at_invalid" };
  }
  if (typeof candidate.expiresAt !== "string" || Number.isNaN(Date.parse(candidate.expiresAt))) {
    return { ok: false, reason: "marker_expires_at_invalid" };
  }
  if (!isRestartMarkerPhase(candidate.phase)) {
    return { ok: false, reason: "marker_phase_invalid" };
  }
  return {
    ok: true,
    marker: candidate as unknown as RelayRestartMarker
  };
}

export class RelayRestartReconciler {
  readonly #deps: RelayRestartReconcilerDependencies;
  #ran = false;

  constructor(dependencies: RelayRestartReconcilerDependencies) {
    this.#deps = dependencies;
  }

  get ran(): boolean {
    return this.#ran;
  }

  #now(): number {
    return this.#deps.now ? this.#deps.now() : Date.now();
  }

  #grace(): number {
    return this.#deps.cleanupGraceMs ?? RELAY_V10.cleanupTimeoutMs;
  }

  /**
   * Set the frozen access level, read the marker, validate it, and dispatch
   * by phase. Idempotent: a repeated worker start re-reads the store and
   * never restores old PCM/ticket/sequence.
   */
  async reconcile(): Promise<ReconcileOutcome> {
    this.#ran = true;
    // R1-C2-3.2: explicitly pin the access level before any read.
    if (this.#deps.store.setAccessLevel) {
      try {
        await this.#deps.store.setAccessLevel({ accessLevel: RESTART_MARKER_ACCESS_LEVEL });
      } catch (error) {
        this.#deps.onFailure?.(RELAY_FAILURE_CODES.CLEANUP_INCOMPLETE);
        return { action: "invalid", reason: `access_level_failed:${String(error)}` };
      }
    }
    let stored: Record<string, unknown>;
    try {
      stored = await this.#deps.store.get(RELAY_MARKER_KEY);
    } catch {
      this.#deps.onFailure?.(RELAY_FAILURE_CODES.CLEANUP_INCOMPLETE);
      return { action: "invalid", reason: "store_read_failed" };
    }
    const raw = stored?.[RELAY_MARKER_KEY];
    if (raw === undefined) return { action: "none" };

    const validated = validateStoredMarker(raw);
    if (!validated.ok) {
      // An illegal marker fails closed: clear it so the next capture starts
      // clean rather than inheriting an untrusted phase.
      await this.#clearIfMatches(String((raw as { captureSessionId?: unknown })?.captureSessionId ?? ""));
      this.#deps.onFailure?.(RELAY_FAILURE_CODES.WORKER_RESTARTED);
      return { action: "invalid", reason: validated.reason };
    }
    const marker = validated.marker;

    // Expiry is fail-closed cleanup: an expired marker never resumes.
    if (Date.parse(marker.expiresAt) <= this.#now()) {
      await this.#clearIfMatches(marker.captureSessionId);
      return { action: "expired", captureSessionId: marker.captureSessionId };
    }

    // Dispatch strictly by phase. Only the EXISTING authenticated Runtime
    // endpoints are used, through the production adapter; no PCM, ticket,
    // sequence or credit is restored.
    let terminal: string | null = null;
    let result: RelayRecoveryResult;
    try {
      if (marker.phase === "connecting") {
        // Runtime had not accepted start: the only legal action is the
        // existing authenticated DELETE, then observe via GET.
        this.#deps.onDispatch?.(marker.phase, "cancelThenObserve");
        result = await this.#deps.runtime.cancelThenObserve(marker.taskId);
      } else {
        // Runtime had accepted start, so its finally block owns the
        // teardown: the new worker only observes via the existing GET.
        this.#deps.onDispatch?.(marker.phase, "observe");
        result = await this.#deps.runtime.observe(marker.taskId);
      }
    } catch {
      result = {
        ok: false,
        failure: new RelayRuntimeError("transport", "runtime_call_failed")
      };
    }

    if (!result.ok) {
      // 401/403, offline, transport error, malformed body and `{ok:false}`
      // all keep the marker for the next worker and report a fixed code.
      // A failed envelope is NEVER read as success.
      const failureCode = RELAY_FAILURE_CODES.RUNTIME_DISCONNECTED;
      this.#deps.onFailure?.(failureCode);
      return { action: "runtime-unavailable", phase: marker.phase, failureCode };
    }
    terminal = result.state;

    // Clear only once a terminal is observed AND the cleanup grace elapsed.
    const reachedTerminal =
      (ACQUISITION_TERMINAL_STATES as readonly string[]).includes(terminal);
    let cleared = false;
    if (reachedTerminal && this.#now() - Date.parse(marker.startedAt) >= this.#grace()) {
      cleared = await this.#clearIfMatches(marker.captureSessionId);
    }
    return { action: "dispatched", phase: marker.phase, terminal, cleared };
  }

  /** Session-scoped clear: never remove another session's marker. */
  async #clearIfMatches(captureSessionId: string): Promise<boolean> {
    if (!captureSessionId || !SESSION_ID_PATTERN.test(captureSessionId)) return false;
    try {
      const stored = await this.#deps.store.get(RELAY_MARKER_KEY);
      const current = stored?.[RELAY_MARKER_KEY] as RelayRestartMarker | undefined;
      if (current?.captureSessionId !== captureSessionId) return false;
      await this.#deps.store.remove(RELAY_MARKER_KEY);
      return true;
    } catch {
      return false;
    }
  }
}

export { RESTART_MARKER_PHASES, RESTART_MARKER_SCHEMA_VERSION, RESTART_MARKER_FIELDS };
