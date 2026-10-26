import { describe, expect, it } from "vitest";
import {
  RelayRestartReconciler,
  RELAY_MARKER_KEY,
  validateStoredMarker,
  ACQUISITION_TERMINAL_STATES,
  type RelaySessionStore
} from "../capture/RelayRestartReconciler";
import {
  RuntimeRelayRecoveryAdapter,
  readAcquisitionState,
  classifyRuntimeError,
  RelayRuntimeError,
  type RelayRuntimeClient
} from "../capture/RuntimeRelayRecoveryAdapter";
import {
  RELAY_V10,
  RESTART_MARKER_PHASES,
  RESTART_MARKER_SCHEMA_VERSION,
  type RelayRestartMarker
} from "../capture/relayContracts";

/**
 * WP0 R1-C2-3 / m-R1-C2-01 — RESTART RECONCILIATION HARNESS.
 *
 * M-R1-C2-03 was that the restart marker was written and deleted but never
 * RECONCILED: there was no `setAccessLevel(TRUSTED_CONTEXTS)`, no worker
 * startup read, and no phase dispatch. The previous restart harness only
 * drove the transport writing into a fake store.
 *
 * This harness creates a REAL new reconciler instance that reads a store
 * populated by a PREVIOUS session — i.e. "a new worker instance reads the
 * old store" — and proves:
 *   - the frozen access level is set before any read;
 *   - the five phases dispatch to the existing authenticated
 *     DELETE / GET paths (never restoring PCM, ticket or sequence);
 *   - an expired marker is a fail-closed cleanup;
 *   - an illegal marker is fail-closed and cleared;
 *   - Runtime unavailability keeps the marker for the next worker;
 *   - clearing is session-scoped, so another session's marker survives;
 *   - a repeated worker start is idempotent.
 */

const T0 = 1_700_000_000_000;
const TASK = "media_task_" + "1".repeat(32);
const SESSION_A = "cap_" + "a".repeat(32);
const SESSION_B = "cap_" + "b".repeat(32);

type RuntimeCall = { op: "bootstrap" | "cancel" | "get"; taskId?: string };

function makeStore(initial?: RelayRestartMarker): RelaySessionStore & { data: Record<string, unknown>; accessLevels: string[] } {
  const data: Record<string, unknown> = initial ? { [RELAY_MARKER_KEY]: initial } : {};
  const accessLevels: string[] = [];
  return {
    data,
    accessLevels,
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (items: Record<string, unknown>) => { Object.assign(data, items); },
    remove: async (key: string) => { delete data[key]; },
    setAccessLevel: async (options: { accessLevel: "TRUSTED_CONTEXTS" }) => {
      accessLevels.push(options.accessLevel);
    }
  };
}

function marker(overrides: Partial<RelayRestartMarker> = {}): RelayRestartMarker {
  return {
    schemaVersion: RESTART_MARKER_SCHEMA_VERSION,
    captureSessionId: SESSION_A,
    taskId: TASK,
    startedAt: new Date(T0).toISOString(),
    phase: "capturing",
    expiresAt: new Date(T0 + RELAY_V10.markerTtlMs).toISOString(),
    ...overrides
  };
}

/**
 * The PRODUCTION adapter class is used everywhere below; only the
 * Runtime CLIENT FUNCTIONS are injected. The previous version injected a
 * hand-written in-memory adapter, which is exactly the gap Codex flagged
 * (fake adapter tests passing while production recovery did nothing).
 */
function makeRuntime(options: {
  state?: string | null;
  throwOn?: "bootstrap" | "cancel" | "get";
  failKind?: "authentication" | "transport" | "api";
  okFalse?: boolean;
} = {}) {
  const calls: RuntimeCall[] = [];
  const mkError = () => {
    const kind = options.failKind ?? "transport";
    if (kind === "authentication") return new RelayRuntimeError("authentication", "runtime_auth_rejected", 401);
    if (kind === "api") return new RelayRuntimeError("api", "runtime_api_error", 500);
    return new RelayRuntimeError("transport", "runtime_transport_failed");
  };
  const client: RelayRuntimeClient = {
    bootstrapSession: async () => {
      calls.push({ op: "bootstrap" });
      if (options.throwOn === "bootstrap") throw mkError();
      return { token: "in-memory-only" };
    },
    cancelAcquisition: async (taskId: string) => {
      calls.push({ op: "cancel", taskId });
      if (options.throwOn === "cancel") throw mkError();
      return { ok: true, task: { state: options.state ?? "cancelled" } };
    },
    getAcquisition: async (taskId: string) => {
      calls.push({ op: "get", taskId });
      if (options.throwOn === "get") throw mkError();
      if (options.okFalse) return { ok: false, error: { code: "V3_MEDIA_TASK_INVALID" } };
      if (options.state === null) return { ok: true, task: {} };
      return { ok: true, task: { taskId, state: options.state ?? "failed" } };
    }
  };
  const runtime = new RuntimeRelayRecoveryAdapter(client);
  return { runtime, calls, client };
}

describe("restart marker validation (frozen shape)", () => {
  it("accepts a canonical marker", () => {
    const result = validateStoredMarker(marker());
    expect(result.ok).toBe(true);
  });

  it("rejects a marker carrying a forbidden field", () => {
    for (const field of ["ticket", "grantId", "streamId", "pcm", "sourceIdentity", "absolutePath", "cookie", "apiKey"]) {
      const polluted = { ...marker(), [field]: "leak" } as unknown;
      const result = validateStoredMarker(polluted);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects a wrong schemaVersion, session id, task id or phase", () => {
    expect(validateStoredMarker(marker({ schemaVersion: "other/v1" as never })).ok).toBe(false);
    expect(validateStoredMarker(marker({ captureSessionId: "not-a-session" })).ok).toBe(false);
    expect(validateStoredMarker(marker({ taskId: "not-a-task" })).ok).toBe(false);
    expect(validateStoredMarker(marker({ phase: "resumed" as never })).ok).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateStoredMarker(undefined).ok).toBe(false);
    expect(validateStoredMarker("nope").ok).toBe(false);
    expect(validateStoredMarker([]).ok).toBe(false);
  });
});

describe("restart reconciliation: a new worker instance reads the old store", () => {
  it("sets the frozen access level before reading", async () => {
    const store = makeStore(marker());
    const { runtime } = makeRuntime();
    const reconciler = new RelayRestartReconciler({ store, runtime, now: () => T0 });
    await reconciler.reconcile();
    expect(store.accessLevels).toEqual(["TRUSTED_CONTEXTS"]);
  });

  it("R1-C3-01: `connecting` runs bootstrap -> DELETE -> GET in that exact order", async () => {
    const store = makeStore(marker({ phase: "connecting" }));
    const { runtime, calls } = makeRuntime({ state: "cancelled" });
    const reconciler = new RelayRestartReconciler({ store, runtime, now: () => T0 });
    const outcome = await reconciler.reconcile();
    expect(outcome.action).toBe("dispatched");
    expect(calls.map((c) => c.op)).toEqual(["bootstrap", "cancel", "get"]);
    // The DELETE and GET must address the marker's task.
    expect(calls.find((c) => c.op === "cancel")?.taskId).toBe(TASK);
    expect(calls.find((c) => c.op === "get")?.taskId).toBe(TASK);
    // A NEW in-process session is established on every worker start.
    expect(runtime.bootstrapCount).toBe(1);
  });

  it("R1-C3-01: the four Runtime-owned phases run bootstrap -> GET only", async () => {
    for (const phase of ["runtime_started", "capturing", "draining", "cleanup_pending"] as const) {
      const store = makeStore(marker({ phase }));
      const { runtime, calls } = makeRuntime({ state: "cancelled" });
      const reconciler = new RelayRestartReconciler({ store, runtime, now: () => T0 });
      const outcome = await reconciler.reconcile();
      expect(outcome.action).toBe("dispatched");
      // No DELETE for a Runtime-owned phase, and no PCM/ticket/sequence
      // restore anywhere.
      expect(calls.map((c) => c.op)).toEqual(["bootstrap", "get"]);
      expect(calls.some((c) => c.op === "cancel")).toBe(false);
      expect(runtime.bootstrapCount).toBe(1);
    }
  });

  it("R1-C3-01: every frozen phase is dispatched through the production adapter", async () => {
    for (const phase of RESTART_MARKER_PHASES) {
      const store = makeStore(marker({ phase }));
      const { runtime, calls } = makeRuntime({ state: "cancelled" });
      const reconciler = new RelayRestartReconciler({ store, runtime, now: () => T0 });
      const outcome = await reconciler.reconcile();
      expect(outcome.action).toBe("dispatched");
      expect(calls[0].op).toBe("bootstrap");
      // There is no `recover` operation at all: the strict six-field
      // marker carries no sourceIdentity, so that member was removed.
      expect(calls.some((c) => (c as { op: string }).op === "recover")).toBe(false);
    }
  });

  it("treats an expired marker as a fail-closed cleanup and clears it", async () => {
    const expired = marker({
      startedAt: new Date(T0 - 2 * RELAY_V10.markerTtlMs).toISOString(),
      expiresAt: new Date(T0 - 1).toISOString()
    });
    const store = makeStore(expired);
    const { runtime, calls } = makeRuntime();
    const reconciler = new RelayRestartReconciler({ store, runtime, now: () => T0 });
    const outcome = await reconciler.reconcile();
    expect(outcome.action).toBe("expired");
    expect(store.data[RELAY_MARKER_KEY]).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("fails closed and clears an illegal marker", async () => {
    const store = makeStore(marker({ phase: "resumed" as never }));
    const { runtime, calls } = makeRuntime();
    const failures: string[] = [];
    const reconciler = new RelayRestartReconciler({
      store, runtime, now: () => T0, onFailure: (c) => failures.push(c)
    });
    const outcome = await reconciler.reconcile();
    expect(outcome.action).toBe("invalid");
    expect(store.data[RELAY_MARKER_KEY]).toBeUndefined();
    expect(failures).toContain("V3_MEDIA_CAPTURE_WORKER_RESTARTED");
    expect(calls).toEqual([]);
  });

  it("keeps the marker when the Runtime is temporarily unavailable", async () => {
    const store = makeStore(marker());
    const { runtime } = makeRuntime({ throwOn: "get" });
    const failures: string[] = [];
    const reconciler = new RelayRestartReconciler({
      store, runtime, now: () => T0, onFailure: (c) => failures.push(c)
    });
    const outcome = await reconciler.reconcile();
    expect(outcome.action).toBe("runtime-unavailable");
    expect(failures).toContain("V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED");
    // The marker survives so the NEXT worker can retry.
    expect(store.data[RELAY_MARKER_KEY]).toBeDefined();
  });

  it("R1-C3-01: clears for every acquisition terminal after the grace", async () => {
    for (const terminal of ACQUISITION_TERMINAL_STATES) {
      const store = makeStore(marker());
      const { runtime } = makeRuntime({ state: terminal });
      const reconciler = new RelayRestartReconciler({
        store, runtime, now: () => T0 + RELAY_V10.cleanupTimeoutMs + 1
      });
      const outcome = await reconciler.reconcile();
      expect(outcome.action).toBe("dispatched");
      if (outcome.action === "dispatched") {
        expect(outcome.terminal).toBe(terminal);
        expect(outcome.cleared).toBe(true);
      }
      expect(store.data[RELAY_MARKER_KEY]).toBeUndefined();
    }
  });

  it("R1-C3-01: keeps the marker for every non-terminal acquisition state", async () => {
    for (const state of ["created", "acquiring", "capturing", "transcribing", "cleaning"]) {
      const store = makeStore(marker());
      const { runtime } = makeRuntime({ state });
      const reconciler = new RelayRestartReconciler({
        store, runtime, now: () => T0 + RELAY_V10.cleanupTimeoutMs + 1
      });
      const outcome = await reconciler.reconcile();
      expect(outcome.action).toBe("dispatched");
      if (outcome.action === "dispatched") expect(outcome.cleared).toBe(false);
      expect(store.data[RELAY_MARKER_KEY]).toBeDefined();
    }
  });

  it("R1-C3-01: keeps the marker and reports a fixed code on 401/403, offline, transport and api errors", async () => {
    for (const failKind of ["authentication", "transport", "api"] as const) {
      const store = makeStore(marker());
      // Failing the bootstrap is how a worker start hits 401/403/offline.
      const { runtime } = makeRuntime({ failKind, throwOn: "bootstrap" });
      const failures: string[] = [];
      const reconciler = new RelayRestartReconciler({
        store, runtime, now: () => T0 + RELAY_V10.cleanupTimeoutMs + 1,
        onFailure: (c) => failures.push(c)
      });
      const outcome = await reconciler.reconcile();
      expect(outcome.action).toBe("runtime-unavailable");
      expect(failures).toEqual(["V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED"]);
      expect(store.data[RELAY_MARKER_KEY]).toBeDefined();
    }
  });

  it("R1-C3-01: a DELETE failure keeps the marker and reports the fixed code", async () => {
    const store = makeStore(marker({ phase: "connecting" }));
    const { runtime, calls } = makeRuntime({ throwOn: "cancel" });
    const failures: string[] = [];
    const reconciler = new RelayRestartReconciler({
      store, runtime, now: () => T0, onFailure: (c) => failures.push(c)
    });
    const outcome = await reconciler.reconcile();
    expect(outcome.action).toBe("runtime-unavailable");
    // bootstrap ran, DELETE failed, and GET must NOT have run.
    expect(calls.map((c) => c.op)).toEqual(["bootstrap", "cancel"]);
    expect(failures).toEqual(["V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED"]);
    expect(store.data[RELAY_MARKER_KEY]).toBeDefined();
  });

  it("R1-C3-01: `{ok:false}` and a missing state are never read as success", async () => {
    for (const variant of [{ okFalse: true }, { state: null }] as const) {
      const store = makeStore(marker());
      const { runtime } = makeRuntime(variant);
      const failures: string[] = [];
      const reconciler = new RelayRestartReconciler({
        store, runtime, now: () => T0 + RELAY_V10.cleanupTimeoutMs + 1,
        onFailure: (c) => failures.push(c)
      });
      const outcome = await reconciler.reconcile();
      expect(outcome.action).toBe("runtime-unavailable");
      expect(failures).toEqual(["V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED"]);
      expect(store.data[RELAY_MARKER_KEY]).toBeDefined();
    }
  });

  it("R1-C3-01: bootstraps at most once per reconcile pass", async () => {
    const store = makeStore(marker({ phase: "connecting" }));
    const { runtime } = makeRuntime({ state: "cancelled" });
    const reconciler = new RelayRestartReconciler({ store, runtime, now: () => T0 });
    await reconciler.reconcile();
    expect(runtime.bootstrapCount).toBe(1);
    // A second pass on a new adapter is a NEW worker: it bootstraps again.
    const { runtime: second } = makeRuntime({ state: "cancelled" });
    const store2 = makeStore(marker({ phase: "capturing" }));
    await new RelayRestartReconciler({ store: store2, runtime: second, now: () => T0 }).reconcile();
    expect(second.bootstrapCount).toBe(1);
  });

  it("clears only after a terminal AND the cleanup grace", async () => {
    const store = makeStore(marker());
    const { runtime } = makeRuntime({ state: "cancelled" });

    // Before the grace elapses the marker is retained.
    const early = new RelayRestartReconciler({ store, runtime, now: () => T0 });
    const first = await early.reconcile();
    expect(first.action).toBe("dispatched");
    if (first.action === "dispatched") expect(first.cleared).toBe(false);
    expect(store.data[RELAY_MARKER_KEY]).toBeDefined();

    // After the grace elapses a NEW worker instance clears it.
    const later = new RelayRestartReconciler({
      store, runtime, now: () => T0 + RELAY_V10.cleanupTimeoutMs + 1
    });
    const second = await later.reconcile();
    expect(second.action).toBe("dispatched");
    if (second.action === "dispatched") expect(second.cleared).toBe(true);
    expect(store.data[RELAY_MARKER_KEY]).toBeUndefined();
  });

  it("never clears another session's marker", async () => {
    // Session A's worker reconciles while session B owns the store.
    const store = makeStore(marker({ captureSessionId: SESSION_B, phase: "capturing" }));
    const { runtime } = makeRuntime({ state: "capturing" });
    const reconcilerA = new RelayRestartReconciler({ store, runtime, now: () => T0 });
    const outcome = await reconcilerA.reconcile();
    expect(outcome.action).toBe("dispatched");
    if (outcome.action === "dispatched") expect(outcome.cleared).toBe(false);
    const survivor = store.data[RELAY_MARKER_KEY] as RelayRestartMarker;
    expect(survivor.captureSessionId).toBe(SESSION_B);
  });

  it("is idempotent across repeated worker starts", async () => {
    const store = makeStore(marker());
    const { runtime } = makeRuntime({ state: "cancelled" });
    // First start: terminal observed, grace not yet elapsed -> retained.
    await new RelayRestartReconciler({ store, runtime, now: () => T0 }).reconcile();
    // Second start (same worker lifecycle) must not double-dispatch once the
    // marker is gone, and must not throw.
    const later = new RelayRestartReconciler({
      store, runtime, now: () => T0 + RELAY_V10.cleanupTimeoutMs + 1
    });
    const first = await later.reconcile();
    expect(first.action).toBe("dispatched");
    const second = await new RelayRestartReconciler({
      store, runtime, now: () => T0 + RELAY_V10.cleanupTimeoutMs + 2
    }).reconcile();
    // With the marker cleared there is nothing left to reconcile.
    expect(second.action).toBe("none");
  });

  it("does nothing when the store holds no marker", async () => {
    const store = makeStore();
    const { runtime, calls } = makeRuntime();
    const reconciler = new RelayRestartReconciler({ store, runtime, now: () => T0 });
    expect(await reconciler.reconcile()).toEqual({ action: "none" });
    expect(calls).toEqual([]);
  });

  it("records the dispatch for observability", async () => {
    const store = makeStore(marker({ phase: "connecting" }));
    const { runtime } = makeRuntime({ state: "cancelled" });
    const seen: string[] = [];
    const reconciler = new RelayRestartReconciler({
      store, runtime, now: () => T0, onDispatch: (phase, action) => seen.push(`${phase}:${action}`)
    });
    await reconciler.reconcile();
    expect(seen).toEqual(["connecting:cancelThenObserve"]);
  });
});
