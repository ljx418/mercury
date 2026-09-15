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

async function enterTokenAndConnect(container: HTMLElement, token = "t".repeat(32)) {
  const input = container.querySelector("[data-testid='local-runtime-token-input']") as HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, token);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const button = container.querySelector("[data-testid='local-runtime-connect']") as HTMLButtonElement;
  await act(async () => {
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("LocalRuntimeAccess", () => {
  beforeEach(() => clearLocalRuntimeSession());

  afterEach(() => {
    document.body.innerHTML = "";
    clearLocalRuntimeSession();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses stable locators, clears the password input, and disconnects the current document", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify({
      ok: true,
      data: { permissions: [] },
      request_id: (init?.headers as Record<string, string>)["X-Request-ID"]
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const mounted = await mount();
    expect(mounted.container.querySelector("[data-testid='local-runtime-access']")).not.toBeNull();
    expect(mounted.container.querySelector("[data-testid='local-runtime-status']")?.textContent).toBe("需要 Runtime 会话令牌");

    await enterTokenAndConnect(mounted.container);
    expect(mounted.container.querySelector("[data-testid='local-runtime-status']")?.textContent).toBe("本页面会话已认证");
    expect(mounted.container.querySelector("[data-testid='local-runtime-token-input']")).toBeNull();
    expect(mounted.onChange.mock.calls.some(([change]) => change.status === "connected")).toBe(true);

    await act(async () => (mounted.container.querySelector("[data-testid='local-runtime-disconnect']") as HTMLButtonElement).click());
    expect(mounted.container.querySelector("[data-testid='local-runtime-status']")?.textContent).toBe("需要 Runtime 会话令牌");
    await act(async () => mounted.root.unmount());
  });

  it.each([
    ["authentication", async () => new Response(JSON.stringify({ ok: false, data: null, error: { code: "LOCAL_AUTH_INVALID", message: "denied" } }), { status: 403, headers: { "Content-Type": "application/json" } }), "会话认证失效，请重新输入 Runtime 令牌"],
    ["transport", async () => { throw new TypeError("fetch failed"); }, "Runtime 当前不可达"]
  ])("keeps %s failures distinct", async (_kind, responseFactory, expectedMessage) => {
    vi.stubGlobal("fetch", vi.fn(responseFactory));
    const mounted = await mount();
    await enterTokenAndConnect(mounted.container);
    expect(mounted.container.querySelector("[data-testid='local-runtime-error']")?.textContent).toBe(expectedMessage);
    expect(mounted.container.querySelector("[data-testid='local-runtime-token-input']")).not.toBeNull();
    expect(getLocalRuntimeSessionSnapshot().hasToken).toBe(_kind === "transport");
    await act(async () => mounted.root.unmount());
  });
});
