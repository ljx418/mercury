import { describe, expect, it } from "vitest";
import {
  RuntimeRelayRecoveryAdapter,
  RelayRuntimeError,
  readAcquisitionState,
  classifyRuntimeError,
  type RelayRuntimeClient
} from "../capture/RuntimeRelayRecoveryAdapter";

/**
 * WP0 R1-C3-01 — PRODUCTION ADAPTER COMPOSITION.
 *
 * M-R1-C3-01 was that the Background recovery adapter was implemented as
 * `chrome.runtime.sendMessage` calls to the service worker ITSELF. Those
 * commands (`delete`, `recover`, and a `status` carrying `taskId`) do not
 * exist in `MediaCaptureMessageRouter`, the service worker is not a
 * trusted surface, and `Boolean(response)` turned `{ok:false}` into a false
 * success.
 *
 * These tests exercise the REAL `RuntimeRelayRecoveryAdapter` class and
 * assert it drives the real Runtime client surface
 * (`bootstrapLocalRuntimeSession` -> `cancelMediaAcquisition` ->
 * `getMediaAcquisition`), never an extension message.
 */

type Call = { op: "bootstrap" | "cancel" | "get"; taskId?: string };

function makeClient(options: {
  state?: string | null;
  failOn?: Call["op"];
  okFalse?: boolean;
  noTask?: boolean;
} = {}) {
  const calls: Call[] = [];
  const client: RelayRuntimeClient = {
    bootstrapSession: async () => {
      calls.push({ op: "bootstrap" });
      if (options.failOn === "bootstrap") {
        throw new RelayRuntimeError("authentication", "runtime_auth_rejected", 401);
      }
      // The token is process-local and never returned to the caller.
      return { token: "ephemeral-in-memory-only" };
    },
    cancelAcquisition: async (taskId: string) => {
      calls.push({ op: "cancel", taskId });
      if (options.failOn === "cancel") throw new RelayRuntimeError("api", "runtime_api_error", 409);
      return { ok: true, task: { taskId, state: options.state ?? "cancelled" } };
    },
    getAcquisition: async (taskId: string) => {
      calls.push({ op: "get", taskId });
      if (options.failOn === "get") throw new RelayRuntimeError("transport", "runtime_transport_failed");
      if (options.okFalse) return { ok: false, error: { code: "V3_MEDIA_TASK_INVALID" } };
      if (options.noTask) return { ok: true };
      if (options.state === null) return { ok: true, task: {} };
      return { ok: true, task: { taskId, state: options.state ?? "failed" } };
    }
  };
  return { client, calls };
}

describe("production adapter drives the real Runtime client (R1-C3-01)", () => {
  it("never uses chrome.runtime.sendMessage — only bootstrap/cancel/get", async () => {
    const { client, calls } = makeClient({ state: "cancelled" });
    const adapter = new RuntimeRelayRecoveryAdapter(client);
    const result = await adapter.cancelThenObserve("media_task_" + "1".repeat(32));
    expect(result.ok).toBe(true);
    // The only calls are the real Runtime client surface.
    expect(calls.map((c) => c.op)).toEqual(["bootstrap", "cancel", "get"]);
    for (const call of calls) {
      expect(call.op).not.toBe("sendMessage");
    }
  });

  it("`connecting` order is bootstrap -> cancel(DELETE) -> get(GET) with the taskId", async () => {
    const { client, calls } = makeClient({ state: "cancelled" });
    const adapter = new RuntimeRelayRecoveryAdapter(client);
    const taskId = "media_task_" + "9".repeat(32);
    const result = await adapter.cancelThenObserve(taskId);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toBe("cancelled");
    expect(calls).toEqual([
      { op: "bootstrap" },
      { op: "cancel", taskId },
      { op: "get", taskId }
    ]);
  });

  it("Runtime-owned phases use bootstrap -> get only, with no cancel", async () => {
    const { client, calls } = makeClient({ state: "failed" });
    const adapter = new RuntimeRelayRecoveryAdapter(client);
    const taskId = "media_task_" + "2".repeat(32);
    const result = await adapter.observe(taskId);
    expect(result.ok).toBe(true);
    expect(calls).toEqual([{ op: "bootstrap" }, { op: "get", taskId }]);
  });

  it("bootstraps at most once per adapter pass and re-uses the session", async () => {
    const { client, calls } = makeClient({ state: "succeeded" });
    const adapter = new RuntimeRelayRecoveryAdapter(client);
    await adapter.observe("media_task_" + "3".repeat(32));
    await adapter.observe("media_task_" + "3".repeat(32));
    await adapter.cancelThenObserve("media_task_" + "3".repeat(32));
    // Exactly one bootstrap across three Runtime-touching calls.
    expect(adapter.bootstrapCount).toBe(1);
    expect(calls.filter((c) => c.op === "bootstrap")).toHaveLength(1);
  });

  it("a NEW worker (new adapter) always establishes a NEW session", async () => {
    const first = makeClient({ state: "succeeded" });
    const second = makeClient({ state: "succeeded" });
    await new RuntimeRelayRecoveryAdapter(first.client).observe("media_task_" + "4".repeat(32));
    await new RuntimeRelayRecoveryAdapter(second.client).observe("media_task_" + "4".repeat(32));
    expect(first.calls.filter((c) => c.op === "bootstrap")).toHaveLength(1);
    expect(second.calls.filter((c) => c.op === "bootstrap")).toHaveLength(1);
  });

  it("propagates 401/403, offline, transport and API errors as failures", async () => {
    for (const failOn of ["bootstrap", "cancel", "get"] as const) {
      const { client } = makeClient({ failOn });
      const adapter = new RuntimeRelayRecoveryAdapter(client);
      const result = await adapter.cancelThenObserve("media_task_" + "5".repeat(32));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure).toBeInstanceOf(RelayRuntimeError);
        expect(["authentication", "api", "transport"]).toContain(result.failure.kind);
      }
    }
  });

  it("a `{ok:false}` Runtime envelope is never a success", async () => {
    const { client } = makeClient({ okFalse: true });
    const adapter = new RuntimeRelayRecoveryAdapter(client);
    const result = await adapter.observe("media_task_" + "6".repeat(32));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.kind).toBe("api");
  });

  it("a response without a task or without a state is never a success", async () => {
    for (const variant of [{ noTask: true }, { state: null }] as const) {
      const { client } = makeClient(variant);
      const adapter = new RuntimeRelayRecoveryAdapter(client);
      const result = await adapter.observe("media_task_" + "7".repeat(32));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.kind).toBe("shape");
    }
  });
});

describe("acquisition state reading (R1-C3-01 terminal vocabulary)", () => {
  it("reads the real MediaAcquisitionTask.state values", () => {
    for (const state of [
      "created", "acquiring", "capturing", "transcribing", "cleaning",
      "succeeded", "degraded", "blocked", "failed", "cancelled"
    ]) {
      const result = readAcquisitionState({ ok: true, task: { taskId: "x", state } });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.state).toBe(state);
    }
  });

  it("rejects non-objects, error envelopes and task-less bodies", () => {
    expect(readAcquisitionState(null).ok).toBe(false);
    expect(readAcquisitionState("nope").ok).toBe(false);
    expect(readAcquisitionState({ ok: false, error: { code: "X" } }).ok).toBe(false);
    expect(readAcquisitionState({ ok: true }).ok).toBe(false);
    expect(readAcquisitionState({ ok: true, task: {} }).ok).toBe(false);
  });
});

describe("Runtime error classification (no text leakage)", () => {
  it("maps the Runtime client error kinds without carrying their text", () => {
    expect(classifyRuntimeError({ kind: "authentication" }).kind).toBe("authentication");
    expect(classifyRuntimeError({ kind: "transport" }).kind).toBe("transport");
    expect(classifyRuntimeError({ kind: "api", httpStatus: 500 }).kind).toBe("api");
    expect(classifyRuntimeError(new Error("boom")).kind).toBe("transport");
  });

  it("keeps the HTTP status for auth failures but never the original message", () => {
    const classified = classifyRuntimeError({ kind: "authentication", httpStatus: 403, message: "/home/user/secret" });
    expect(classified.httpStatus).toBe(403);
    expect(classified.message).not.toContain("/home/user");
  });
});
