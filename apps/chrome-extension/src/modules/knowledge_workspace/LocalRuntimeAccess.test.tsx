import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalRuntimeSession, getLocalRuntimeSessionSnapshot } from "../../runtimeClient";
import { LocalRuntimeAccess } from "./LocalRuntimeAccess";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(onChange = vi.fn()) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<LocalRuntimeAccess workspaceId="ws_default" onChange={onChange} />));
  return { container, onChange, root };
}

async function mountAutomatic(onChange = vi.fn()) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<LocalRuntimeAccess workspaceId="ws_default" mode="automatic" onChange={onChange} />));
  return { container, onChange, root };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("LocalRuntimeAccess", () => {
  beforeEach(() => {
    clearLocalRuntimeSession();
    vi.stubGlobal("location", { protocol: "chrome-extension:" });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    clearLocalRuntimeSession();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("auto-bootstraps, uses stable locators, and disconnects the current document", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/v1/companion/sessions")) return new Response(JSON.stringify({ ok: true, data: {
        schemaVersion: "navia-companion-session/v1", sessionId: `comp_session_${"1".repeat(32)}`,
        runtimeInstanceId: `runtime_${"2".repeat(32)}`, extensionOriginSha256: "3".repeat(64),
        issuedAt: "2026-10-07T00:00:00Z", expiresAt: "2026-10-07T00:15:00Z", token: "A".repeat(43), persisted: false
      }, error: null }), { status: 201, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/v1/companion/sessions/current")) return new Response(JSON.stringify({ ok: true, data: {}, error: null }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, data: { permissions: [] }, request_id: (init?.headers as Record<string, string>)["X-Request-ID"] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const mounted = await mount();
    await flush();
    expect(mounted.container.querySelector("[data-testid='local-runtime-access']")).not.toBeNull();
    expect(mounted.container.querySelector("[data-testid='local-runtime-status']")?.textContent).toBe("本机伴侣已连接");
    expect(mounted.container.querySelector("[data-testid='local-runtime-instance']")?.textContent).toBe("实例 22222222");
    expect(mounted.container.querySelector("[data-testid='local-runtime-token-input']")).toBeNull();
    expect(mounted.onChange.mock.calls.some(([change]) => change.status === "connected")).toBe(true);

    await act(async () => { (mounted.container.querySelector("[data-testid='local-runtime-disconnect']") as HTMLButtonElement).click(); await Promise.resolve(); });
    await flush();
    expect(mounted.container.querySelector("[data-testid='local-runtime-status']")?.textContent).toBe("本机伴侣需要重新配置");
    expect(mounted.container.querySelector("[data-testid='local-runtime-instance']")).toBeNull();
    await act(async () => mounted.root.unmount());
  });

  it("keeps automatic bootstrap but hides manual runtime controls", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/v1/companion/sessions")) return new Response(JSON.stringify({ ok: true, data: {
        schemaVersion: "navia-companion-session/v1", sessionId: `comp_session_${"1".repeat(32)}`,
        runtimeInstanceId: `runtime_${"2".repeat(32)}`, extensionOriginSha256: "3".repeat(64),
        issuedAt: "2026-10-07T00:00:00Z", expiresAt: "2026-10-07T00:15:00Z", token: "A".repeat(43), persisted: false
      }, error: null }), { status: 201, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ ok: true, data: { permissions: [] } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const mounted = await mountAutomatic();
    await flush();
    expect(mounted.container.querySelector("button")).toBeNull();
    expect(mounted.onChange.mock.calls.some(([change]) => change.status === "connected")).toBe(true);
    await act(async () => mounted.root.unmount());
  });

  it.each([
    ["authentication", async () => new Response(JSON.stringify({ ok: false, data: null, error: { code: "V3_COMPANION_ORIGIN_MISMATCH", message: "denied" } }), { status: 403, headers: { "Content-Type": "application/json" } }), "本机伴侣配置与当前扩展不匹配。"],
    ["not configured", async () => new Response(JSON.stringify({ ok: false, data: null, error: { code: "V3_COMPANION_NOT_CONFIGURED", message: "denied" } }), { status: 503, headers: { "Content-Type": "application/json" } }), "本机伴侣尚未绑定 Navia 扩展，请重新运行桌面图标并完成一次性配置。"],
    ["transport", async () => { throw new TypeError("fetch failed"); }, "Navia 本机伴侣未启动，请先点击桌面图标启动。"]
  ])("keeps %s failures distinct", async (_kind, responseFactory, expectedMessage) => {
    vi.stubGlobal("fetch", vi.fn(responseFactory));
    const mounted = await mount();
    await flush();
    expect(mounted.container.querySelector("[data-testid='local-runtime-error']")?.textContent).toBe(expectedMessage);
    expect(mounted.container.querySelector("[data-testid='local-runtime-token-input']")).toBeNull();
    expect(getLocalRuntimeSessionSnapshot().hasToken).toBe(false);
    await act(async () => mounted.root.unmount());
  });
});
