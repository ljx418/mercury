/**
 * R6-G1 — RLY11-N20, N30.
 *
 * Production owner: `RelayRestartReconciler` — the NEW worker's owner for a
 * capture it did not start. Composed with the production store interface and
 * the production recovery adapter contract.
 *
 * The frozen rule under test: a restarted worker never resumes PCM, a ticket,
 * a sequence or a credit. It dispatches strictly by the stored phase, and a
 * marker it cannot trust is cleared rather than inherited.
 */

import { describe, expect, it, vi } from "vitest";
import {
  RelayRestartReconciler,
  RELAY_MARKER_KEY,
  type RelayRecoveryAdapter,
  type RelaySessionStore
} from "../../capture/RelayRestartReconciler";
import { RelayRuntimeError } from "../../capture/RuntimeRelayRecoveryAdapter";
import { RESTART_MARKER_SCHEMA_VERSION } from "../../capture/relayContracts";

const R6_TASK_ID_HEX = "11111111111111111111111111111111";
const NOW = Date.parse("2026-10-19T00:00:00.000Z");

function makeStore(initial?: Record<string, unknown>) {
  let data: Record<string, unknown> = initial ? { ...initial } : {};
  const store: RelaySessionStore & { snapshot: () => Record<string, unknown> } = {
    get: vi.fn(async () => data),
    set: vi.fn(async (items: Record<string, unknown>) => { data = { ...data, ...items }; }),
    remove: vi.fn(async (key: string) => { delete data[key]; }),
    snapshot: () => data
  };
  return store;
}

function marker(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: RESTART_MARKER_SCHEMA_VERSION,
    captureSessionId: `cap_r6fixed${"0".repeat(25)}`,
    taskId: `media_task_${R6_TASK_ID_HEX}`,
    startedAt: new Date(NOW - 5_000).toISOString(),
    phase: "capturing",
    expiresAt: new Date(NOW + 60_000).toISOString(),
    ...overrides
  };
}

function makeRuntime(state: string | { ok: false; failure: RelayRuntimeError }, log: string[] = []): RelayRecoveryAdapter {
  return {
    cancelThenObserve: vi.fn(async (taskId: string) => {
      log.push(`cancelThenObserve:${taskId}`);
      return typeof state === "string" ? { ok: true as const, state } : state;
    }),
    observe: vi.fn(async (taskId: string) => {
      log.push(`observe:${taskId}`);
      return typeof state === "string" ? { ok: true as const, state } : state;
    })
  };
}

const TERMINAL_STATES = ["succeeded", "failed", "cancelled", "blocked", "abandoned"];

describe("R6-G1 RLY11-N20, N30 — new-worker restart reconciliation", () => {
  it("RLY11-N20 dispatches by stored phase and never resumes the capture", async () => {
    const store = makeStore({ [RELAY_MARKER_KEY]: marker({ phase: "capturing" }) });
    const log: string[] = [];
    const failures: string[] = [];
    const dispatches: Array<[string, string]> = [];

    const reconciler = new RelayRestartReconciler({
      store,
      runtime: makeRuntime("succeeded", log),
      now: () => NOW,
      cleanupGraceMs: 1_000,
      onFailure: (code) => failures.push(code),
      onDispatch: (phase, action) => dispatches.push([phase, action])
    });

    const outcome = await reconciler.reconcile();

    // Runtime had already accepted start, so the new worker only OBSERVES.
    // It must never call the cancel/DELETE path for a started capture.
    expect(log).toEqual([`observe:media_task_${R6_TASK_ID_HEX}`]);
    expect(dispatches).toEqual([["capturing", "observe"]]);
    expect(outcome).toEqual({ action: "dispatched", phase: "capturing", terminal: "succeeded", cleared: true });
    expect(failures).toEqual([]);
    // A terminal plus the cleanup grace removes the marker for good.
    expect(store.snapshot()[RELAY_MARKER_KEY]).toBeUndefined();
  });

  it("RLY11-N20 uses the authenticated DELETE only for the connecting phase", async () => {
    const store = makeStore({ [RELAY_MARKER_KEY]: marker({ phase: "connecting" }) });
    const log: string[] = [];
    const dispatches: Array<[string, string]> = [];

    const reconciler = new RelayRestartReconciler({
      store,
      runtime: makeRuntime("cancelled", log),
      now: () => NOW,
      cleanupGraceMs: 1_000,
      onDispatch: (phase, action) => dispatches.push([phase, action])
    });

    const outcome = await reconciler.reconcile();

    expect(log).toEqual([`cancelThenObserve:media_task_${R6_TASK_ID_HEX}`]);
    expect(dispatches).toEqual([["connecting", "cancelThenObserve"]]);
    expect(outcome).toMatchObject({ action: "dispatched", phase: "connecting", terminal: "cancelled" });
  });

  it("RLY11-N20 keeps the marker and reports a fixed code when the Runtime cannot be reached", async () => {
    const store = makeStore({ [RELAY_MARKER_KEY]: marker() });
    const failures: string[] = [];

    const reconciler = new RelayRestartReconciler({
      store,
      runtime: makeRuntime({ ok: false, failure: new RelayRuntimeError("transport", "runtime_call_failed") }),
      now: () => NOW,
      onFailure: (code) => failures.push(code)
    });

    const outcome = await reconciler.reconcile();

    // A failed envelope is NEVER read as success, and the marker survives for
    // the next worker.
    expect(outcome).toEqual({
      action: "runtime-unavailable",
      phase: "capturing",
      failureCode: "V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED"
    });
    expect(failures).toEqual(["V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED"]);
    expect(store.snapshot()[RELAY_MARKER_KEY]).toBeDefined();
  });

  it("RLY11-N20 clears an untrusted marker and reports WORKER_RESTARTED", async () => {
    // A marker with a polluted field set cannot be trusted by a new worker.
    const polluted = marker();
    (polluted as Record<string, unknown>).streamId = "stream-r6-must-not-persist";
    const store = makeStore({ [RELAY_MARKER_KEY]: polluted });
    const failures: string[] = [];

    const reconciler = new RelayRestartReconciler({
      store,
      runtime: makeRuntime("succeeded"),
      now: () => NOW,
      onFailure: (code) => failures.push(code)
    });

    const outcome = await reconciler.reconcile();

    expect(outcome).toEqual({ action: "invalid", reason: "marker_fields_invalid" });
    expect(failures).toEqual(["V3_MEDIA_CAPTURE_WORKER_RESTARTED"]);
    expect(store.snapshot()[RELAY_MARKER_KEY]).toBeUndefined();
  });

  it("RLY11-N30 refuses an invalid phase and an expired marker", async () => {
    // (a) An illegal phase never dispatches.
    const badPhase = makeStore({ [RELAY_MARKER_KEY]: marker({ phase: "resuming_old_capture" }) });
    const badFailures: string[] = [];
    const badLog: string[] = [];
    const badOutcome = await new RelayRestartReconciler({
      store: badPhase,
      runtime: makeRuntime("succeeded", badLog),
      now: () => NOW,
      onFailure: (code) => badFailures.push(code)
    }).reconcile();

    expect(badOutcome).toEqual({ action: "invalid", reason: "marker_phase_invalid" });
    expect(badFailures).toEqual(["V3_MEDIA_CAPTURE_WORKER_RESTARTED"]);
    expect(badLog).toEqual([]);
    expect(badPhase.snapshot()[RELAY_MARKER_KEY]).toBeUndefined();

    // (b) An expired marker is fail-closed cleanup, not a resume.
    const expired = makeStore({
      [RELAY_MARKER_KEY]: marker({ expiresAt: new Date(NOW - 1).toISOString() })
    });
    const expiredFailures: string[] = [];
    const expiredLog: string[] = [];
    const expiredOutcome = await new RelayRestartReconciler({
      store: expired,
      runtime: makeRuntime("succeeded", expiredLog),
      now: () => NOW,
      onFailure: (code) => expiredFailures.push(code)
    }).reconcile();

    expect(expiredOutcome).toEqual({ action: "expired", captureSessionId: `cap_r6fixed${"0".repeat(25)}` });
    expect(expiredFailures).toEqual([]);
    expect(expiredLog).toEqual([]);
    expect(expired.snapshot()[RELAY_MARKER_KEY]).toBeUndefined();
  });

  it("positive control: a terminal marker is cleared only after the cleanup grace", async () => {
    const store = makeStore({ [RELAY_MARKER_KEY]: marker() });
    const reconciler = new RelayRestartReconciler({
      store,
      runtime: makeRuntime("succeeded"),
      now: () => NOW,
      cleanupGraceMs: 60_000
    });

    const outcome = await reconciler.reconcile();

    expect(TERMINAL_STATES).toContain(outcome.action === "dispatched" ? outcome.terminal : null);
    expect(outcome).toMatchObject({ action: "dispatched", terminal: "succeeded", cleared: false });
    // Inside the grace the marker is retained for the next worker.
    expect(store.snapshot()[RELAY_MARKER_KEY]).toBeDefined();
  });
});
