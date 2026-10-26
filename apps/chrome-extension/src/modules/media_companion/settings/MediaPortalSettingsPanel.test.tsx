import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  bootstrap: vi.fn(), getSettings: vi.fn(), saveSettings: vi.fn(), toggle: vi.fn(), test: vi.fn(),
  remove: vi.fn(), getCache: vi.fn(), configureCache: vi.fn(), clearCache: vi.fn()
}));

vi.mock("../../../runtimeClient", () => ({
  bootstrapLocalRuntimeSession: runtime.bootstrap,
  getMediaPortalSettings: runtime.getSettings,
  saveMediaPortalSettings: runtime.saveSettings,
  toggleMediaPortalSettings: runtime.toggle,
  testMediaPortalSettings: runtime.test,
  deleteMediaPortalSettings: runtime.remove,
  getMediaCacheStatus: runtime.getCache,
  configureMediaCache: runtime.configureCache,
  clearMediaCache: runtime.clearCache
}));

import { MediaPortalSettingsPanel } from "./MediaPortalSettingsPanel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settings = {
  adapterId: "bilibili", enabled: false, configured: false, cookieCount: 0,
  expiresAt: null, testStatus: null, secretStorage: null, updatedAt: null
} as const;
const configured = {
  ...settings, enabled: true, configured: true, cookieCount: 2,
  testStatus: { status: "ok", verifiedAt: "2026-10-11T00:00:00Z", loggedIn: true },
  secretStorage: "windows_credential_vault", updatedAt: "2026-10-11T00:00:00Z"
} as const;
const cache = {
  entryCount: 1, usedBytes: 1024 ** 2, maximumBytes: 5 * 1024 ** 3, retentionHours: 24,
  oldestCreatedAt: "2026-10-11T00:00:00Z", nextExpiryAt: "2026-10-12T00:00:00Z"
};

async function renderPanel() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(<MediaPortalSettingsPanel runtimeStatus="online" />); await Promise.resolve(); await Promise.resolve(); });
  return { container, root };
}

beforeEach(() => {
  runtime.bootstrap.mockResolvedValue({});
  runtime.getSettings.mockResolvedValue(settings);
  runtime.getCache.mockResolvedValue(cache);
  runtime.saveSettings.mockResolvedValue(configured);
  runtime.toggle.mockResolvedValue(configured);
  runtime.test.mockResolvedValue(configured);
  runtime.remove.mockResolvedValue(settings);
  runtime.configureCache.mockResolvedValue(cache);
  runtime.clearCache.mockResolvedValue({ cleared: { removedEntries: 1, removedBytes: 1024 ** 2 }, cache: { ...cache, entryCount: 0, usedBytes: 0 } });
});

afterEach(() => { document.body.innerHTML = ""; vi.clearAllMocks(); });

describe("MediaPortalSettingsPanel", () => {
  it("explains local secret and cache impact", async () => {
    const mounted = await renderPanel();
    expect(mounted.container.textContent).toContain("B站登录态下载");
    expect(mounted.container.textContent).toContain("系统凭据库");
    expect(mounted.container.textContent).toContain("不高于 480p");
    expect(mounted.container.textContent).toContain("立即清空");
    await act(async () => mounted.root.unmount());
  });

  it("saves a transient cookie and removes it from the input", async () => {
    const mounted = await renderPanel();
    const textarea = mounted.container.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(textarea, "SESSDATA=user-secret");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const save = Array.from(mounted.container.querySelectorAll("button")).find((button) => button.textContent === "保存并验证")!;
    await act(async () => { (save as HTMLButtonElement).click(); await Promise.resolve(); await Promise.resolve(); });
    expect(runtime.saveSettings).toHaveBeenCalledWith("SESSDATA=user-secret", true);
    expect(textarea.value).toBe("");
    expect(mounted.container.textContent).not.toContain("user-secret");
    await act(async () => mounted.root.unmount());
  });

  it("requires an in-panel second click before clearing cache", async () => {
    const mounted = await renderPanel();
    const clear = Array.from(mounted.container.querySelectorAll("button")).find((button) => button.textContent === "立即清空") as HTMLButtonElement;
    await act(async () => clear.click());
    expect(runtime.clearCache).not.toHaveBeenCalled();
    expect(mounted.container.textContent).toContain("再次点击确认清空");
    const confirm = Array.from(mounted.container.querySelectorAll("button")).find((button) => button.textContent === "再次点击确认清空") as HTMLButtonElement;
    await act(async () => { confirm.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(runtime.clearCache).toHaveBeenCalledTimes(1);
    await act(async () => mounted.root.unmount());
  });
});
