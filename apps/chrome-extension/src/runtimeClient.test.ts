import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLocalRuntimeSession,
  createKnowledgeStatusPoller,
  forgetKnowledgeSource,
  getLocalRuntimeSessionSnapshot,
  isForgetSourceVerified,
  listKnowledgePermissions,
  saveCurrentPageToKnowledge,
  setLocalRuntimeToken,
  subscribeLocalRuntimeSession,
  type KnowledgeServiceStatus
} from "./runtimeClient";

const onlineStatus: KnowledgeServiceStatus = {
  schemaVersion: "v2",
  observedAt: "2026-09-08T00:00:00Z",
  frontendInferredRuntimeStatus: "online",
  runtimeStatus: "online",
  adapterStatus: "ready",
  dataServiceStatus: "connected",
  sourceBuildStatus: "trace_ready"
};

describe("createKnowledgeStatusPoller", () => {
  it("runs immediately, uses bounded offline backoff, and recovers to the online interval", async () => {
    vi.useFakeTimers();
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(onlineStatus);
    const onStatus = vi.fn();
    const onOffline = vi.fn();
    const poller = createKnowledgeStatusPoller({ load, onStatus, onOffline });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(load).toHaveBeenCalledTimes(3);
    expect(onOffline).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenCalledWith(onlineStatus);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(load).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(4);
    poller.stop();
    vi.useRealTimers();
  });

  it("does not overlap in-flight requests and stops future polls", async () => {
    vi.useFakeTimers();
    let resolveLoad: ((value: KnowledgeServiceStatus) => void) | undefined;
    const load = vi.fn(() => new Promise<KnowledgeServiceStatus>((resolve) => { resolveLoad = resolve; }));
    const poller = createKnowledgeStatusPoller({ load, onStatus: vi.fn(), onOffline: vi.fn() });
    poller.start();
    poller.requestNow();
    expect(load).toHaveBeenCalledTimes(1);
    resolveLoad?.(onlineStatus);
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(2);
    poller.stop();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(load).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("knowledge Runtime session", () => {
  beforeEach(() => {
    clearLocalRuntimeSession();
  });

  afterEach(() => {
    clearLocalRuntimeSession();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends one request ID and preserves the Runtime envelope ID", async () => {
    setLocalRuntimeToken("t".repeat(32));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${"t".repeat(32)}`);
      expect(headers["X-Request-ID"]).toMatch(/^req_[a-f0-9]{32}$/);
      return new Response(JSON.stringify({
        ok: true,
        data: { permissions: [] },
        request_id: headers["X-Request-ID"]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listKnowledgePermissions("ws_default")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sends an integrity-bound page snapshot for real persistence", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.contentSnapshot.encoding).toBe("utf8");
      expect(body.contentSnapshot.text).toBe("真实页面正文");
      expect(body.contentSnapshot.byteLength).toBe(new TextEncoder().encode("真实页面正文").byteLength);
      expect(body.contentSnapshot.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toMatch(/^navia-v2-/);
      return new Response(JSON.stringify({
        ok: true,
        data: {
          source: { sourceId: "src_real_001", workspaceId: "ws_default", sourceType: "web_page", status: "trace_ready", revision: 1, createdAt: "2026-09-15T00:00:00Z" },
          operation: { operationId: "op_real_001", operationType: "save_source", status: "succeeded", createdAt: "2026-09-15T00:00:00Z" },
          idempotentReplay: false
        }
      }), { status: 202, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveCurrentPageToKnowledge({
      url: "https://example.com/real",
      title: "Real page",
      domain: "example.com",
      captured_at: "2026-09-15T00:00:00Z",
      headings: [],
      visible_text: "ignored",
      cleaned_text: "真实页面正文"
    })).resolves.toMatchObject({ source: { status: "trace_ready" } });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([401, 403])("classifies HTTP %s as authentication and clears the session", async (status) => {
    setLocalRuntimeToken("a".repeat(32));
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const requestId = (init?.headers as Record<string, string>)["X-Request-ID"];
      return new Response(JSON.stringify({
        ok: false,
        data: null,
        request_id: requestId,
        error: { code: "LOCAL_AUTH_INVALID", message: "denied", details: { reason: "expired" } }
      }), { status, headers: { "Content-Type": "application/json" } });
    }));

    await expect(listKnowledgePermissions("ws_default")).rejects.toMatchObject({
      kind: "authentication",
      httpStatus: status,
      code: "LOCAL_AUTH_INVALID",
      reason: "expired",
      requestId: expect.stringMatching(/^req_/)
    });
    expect(getLocalRuntimeSessionSnapshot().hasToken).toBe(false);
  });

  it("keeps transport and API failures distinct", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")));
    await expect(listKnowledgePermissions("ws_default")).rejects.toMatchObject({
      kind: "transport",
      reason: "runtime_transport_failed"
    });

    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify({
      ok: false,
      data: null,
      request_id: (init?.headers as Record<string, string>)["X-Request-ID"],
      error: { code: "RUNTIME_CONFLICT", message: "conflict", details: { reason: "busy" } }
    }), { status: 409, headers: { "Content-Type": "application/json" } })));
    await expect(listKnowledgePermissions("ws_default")).rejects.toMatchObject({
      kind: "api",
      httpStatus: 409,
      code: "RUNTIME_CONFLICT",
      reason: "busy"
    });
  });

  it("aborts and rejects an old request as stale when the credential generation changes", async () => {
    setLocalRuntimeToken("b".repeat(32));
    let resolveFetch: ((value: Response) => void) | undefined;
    let requestSignal: AbortSignal | null | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      requestSignal = init?.signal;
      return new Promise<Response>((resolve) => { resolveFetch = resolve; });
    }));

    const request = listKnowledgePermissions("ws_default");
    clearLocalRuntimeSession();
    expect(requestSignal?.aborted).toBe(true);
    resolveFetch?.(new Response(JSON.stringify({ ok: true, data: { permissions: [] } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));
    await expect(request).rejects.toMatchObject({ kind: "stale", code: "STALE_RUNTIME_SESSION" });
  });

  it("publishes generation changes without exposing the token", () => {
    const snapshots: Array<{ hasToken: boolean; generation: number }> = [];
    const unsubscribe = subscribeLocalRuntimeSession((snapshot) => snapshots.push(snapshot));
    const before = getLocalRuntimeSessionSnapshot().generation;
    setLocalRuntimeToken("c".repeat(32));
    setLocalRuntimeToken("c".repeat(32));
    clearLocalRuntimeSession();
    unsubscribe();

    expect(snapshots.map((item) => item.generation)).toEqual([before + 1, before + 2, before + 3]);
    expect(snapshots.map((item) => item.hasToken)).toEqual([true, true, false]);
    expect(Object.keys(snapshots[0])).toEqual(["hasToken", "generation"]);
  });

  it("rejects malformed Forget verification and never treats residual surfaces as success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: { operation: { status: "succeeded" }, verification: { libraryAbsent: true } },
      request_id: "req_bad_shape"
    }), { status: 202, headers: { "Content-Type": "application/json" } })));
    await expect(forgetKnowledgeSource("source_01", "forget")).rejects.toMatchObject({
      kind: "api",
      code: "INVALID_RUNTIME_RESPONSE",
      requestId: "req_bad_shape"
    });

    const residual = {
      forgetRequest: {},
      verification: {
        verificationId: "verify_01",
        forgetRequestId: "forget_01",
        sourceId: "source_01",
        libraryAbsent: true,
        askAbsent: true,
        graphAbsent: false,
        traceAbsent: true,
        verifiedAt: "2026-09-10T00:00:00Z"
      },
      operation: {
        operationId: "operation_01",
        operationType: "forget",
        status: "succeeded" as const,
        createdAt: "2026-09-10T00:00:00Z"
      }
    };
    expect(isForgetSourceVerified(residual)).toBe(false);
  });
});
