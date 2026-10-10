import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  test: vi.fn(),
  select: vi.fn(),
  remove: vi.fn()
}));

vi.mock("../../../runtimeClient", () => ({
  bootstrapLocalRuntimeSession: runtime.bootstrap,
  listVisionProviders: runtime.list,
  saveVisionProvider: runtime.save,
  testVisionProvider: runtime.test,
  selectVisionProvider: runtime.select,
  deleteVisionProvider: runtime.remove
}));

import { VisionProviderSettingsPanel } from "./VisionProviderSettingsPanel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const provider = {
  id: "openai-responses-vision",
  adapterKind: "openai_responses",
  name: "OpenAI Vision",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4.1-mini-2025-04-14",
  secretRef: "vision-provider:openai-responses-vision:api-key",
  secretStorage: "os_keyring",
  credentialConfigured: true,
  apiKeyMasked: "sk-************abcd",
  testStatus: { status: "untested", message: "尚未执行能力测试。" },
  createdAt: "2026-10-08T00:00:00Z",
  updatedAt: "2026-10-08T00:00:00Z"
  ,selected: false
} as const;

const minimaxDescriptor = {
  id: "minimax-cn-openai-vision",
  adapterKind: "minimax_chat_completions",
  name: "MiniMax Vision（中国区）",
  baseUrl: "https://api.minimaxi.com/v1",
  models: ["MiniMax-M3"],
  defaultModel: "MiniMax-M3"
} as const;

const openaiDescriptor = {
  id: provider.id,
  adapterKind: provider.adapterKind,
  name: provider.name,
  baseUrl: provider.baseUrl,
  models: [provider.model],
  defaultModel: provider.model
} as const;

async function renderPanel(runtimeStatus: "checking" | "online" | "offline" = "online") {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<VisionProviderSettingsPanel runtimeStatus={runtimeStatus} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

beforeEach(() => {
  runtime.bootstrap.mockResolvedValue({});
  runtime.list.mockResolvedValue({ providers: [], catalog: [minimaxDescriptor, openaiDescriptor], selectedProviderId: null });
  runtime.save.mockResolvedValue(provider);
  runtime.test.mockResolvedValue({
    provider: { ...provider, id: minimaxDescriptor.id, name: minimaxDescriptor.name, adapterKind: minimaxDescriptor.adapterKind, baseUrl: minimaxDescriptor.baseUrl, model: minimaxDescriptor.defaultModel, testStatus: { status: "ok", model: minimaxDescriptor.defaultModel } },
    result: { status: "ok", model: minimaxDescriptor.defaultModel, latencyMs: 42, usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }, observation: { summary: "checkerboard", containsText: false, dominantColors: ["green"] }, containsUserContent: false, store: false }
  });
  runtime.select.mockResolvedValue(provider);
  runtime.remove.mockResolvedValue(undefined);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("VisionProviderSettingsPanel", () => {
  it("shows the storage and upload impact before accepting a secret", async () => {
    const mounted = await renderPanel();
    expect(mounted.container.textContent).toContain("操作系统凭据库");
    expect(mounted.container.textContent).toContain("MiniMax Vision");
    expect(mounted.container.textContent).toContain("中国区");
    expect(mounted.container.textContent).toContain("API Key 不互通");
    expect(mounted.container.textContent).toContain("无用户内容色块图");
    expect(mounted.container.textContent).toContain("真实视频帧仅在后续任务明确授权后上传");
    expect((mounted.container.querySelector("input") as HTMLInputElement).type).toBe("password");
    expect((mounted.container.querySelector("input") as HTMLInputElement).disabled).toBe(false);
    await act(async () => mounted.root.unmount());
  });

  it("allows transient entry offline and preserves it when Runtime becomes online", async () => {
    const mounted = await renderPanel("offline");
    const input = mounted.container.querySelector("input") as HTMLInputElement;
    const providerSelect = mounted.container.querySelector("select") as HTMLSelectElement;
    expect(input.disabled).toBe(false);
    expect(providerSelect.disabled).toBe(false);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "minimax-transient-key-value-1234567890");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      mounted.root.render(<VisionProviderSettingsPanel runtimeStatus="online" />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((mounted.container.querySelector("input") as HTMLInputElement).value).toBe("minimax-transient-key-value-1234567890");
    await act(async () => mounted.root.unmount());
  });

  it("clears the secret after save and reports typed capability result", async () => {
    const mounted = await renderPanel();
    const input = mounted.container.querySelector("input") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "sk-user-secret-value-1234567890");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const button = Array.from(mounted.container.querySelectorAll("button")).find((item) => item.textContent === "保存、测试并使用") as HTMLButtonElement;
    await act(async () => { button.click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(runtime.save).toHaveBeenCalledWith(minimaxDescriptor, minimaxDescriptor.defaultModel, "sk-user-secret-value-1234567890");
    expect(runtime.test).toHaveBeenCalledWith(minimaxDescriptor.id);
    expect(runtime.select).toHaveBeenCalledWith(minimaxDescriptor.id);
    expect(input.value).toBe("");
    expect(mounted.container.textContent).toContain("15 tokens");
    expect(mounted.container.textContent).not.toContain("sk-user-secret-value-1234567890");
    await act(async () => mounted.root.unmount());
  });
});
