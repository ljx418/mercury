import { describe, expect, it } from "vitest";
import { chatStreamOptions, resolveChatProviderDraft } from "./chatProviderSelection";
import type { MercurySettings } from "./runtimeClient";

const settings: MercurySettings = {
  defaultProviderId: "prov_1",
  defaultModel: "deepseek-v4-flash",
  coreProvider: "piagent",
  chatProvider: { coreProvider: "piagent", llmProviderId: "prov_1", model: "deepseek-v4-flash" },
  defaultProfile: "chat",
  profiles: {
    chat: {
      profile: "chat",
      coreProvider: "piagent",
      llmProviderId: "prov_1",
      model: "deepseek-v4-flash",
      toolPolicy: { mode: "disabled", allowedTools: [] },
      enabled: true
    },
    agent: {
      profile: "agent",
      coreProvider: "piagent",
      llmProviderId: "prov_1",
      model: "deepseek-v4-flash",
      toolPolicy: { mode: "disabled", allowedTools: [] },
      enabled: false
    }
  },
  settingsMigration: { v1_10_piagent_default_applied: true },
  updatedAt: "2026-06-22T00:00:00Z",
  providers: [
    {
      id: "prov_1",
      type: "deepseek",
      name: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      models: ["deepseek-v4-flash", "deepseek-v4-pro"],
      defaultModel: "deepseek-v4-flash",
      isDefault: true,
      apiKeyMasked: "sk****test",
      testStatus: null,
      createdAt: "2026-06-22T00:00:00Z",
      updatedAt: "2026-06-22T00:00:00Z"
    }
  ]
};

describe("chat provider selection", () => {
  it("uses profiles.chat as the authoritative chat provider draft", () => {
    const draft = resolveChatProviderDraft({
      ...settings,
      chatProvider: { coreProvider: "llm_direct", llmProviderId: "prov_1", model: "deepseek-v4-pro" }
    });

    expect(draft).toEqual({ coreProvider: "piagent", llmProviderId: "prov_1", model: "deepseek-v4-flash" });
  });

  it("falls back to PiAgent when settings omit an explicit chat provider", () => {
    const draft = resolveChatProviderDraft({ ...settings, coreProvider: null, chatProvider: null, profiles: null });

    expect(draft.coreProvider).toBe("piagent");
    expect(draft.llmProviderId).toBe("prov_1");
  });

  it("does not activate the first saved provider when no default was explicitly selected", () => {
    const draft = resolveChatProviderDraft({
      ...settings,
      defaultProviderId: null,
      defaultModel: null,
      coreProvider: null,
      chatProvider: null,
      profiles: null
    });

    expect(draft).toEqual({ coreProvider: "piagent", llmProviderId: undefined, model: undefined });
  });

  it("sends the current chat provider for page generation intents", () => {
    const options = chatStreamOptions("summarize_page", true, { coreProvider: "piagent", llmProviderId: "prov_1", model: "deepseek-v4-flash" });

    expect(options).toMatchObject({
      coreProvider: "piagent",
      llmProviderId: "prov_1",
      model: "deepseek-v4-flash",
      intentHint: "summarize_page",
      autoContext: true,
      profile: "chat"
    });
  });

  it("keeps LLM Direct available as a manual chat provider option", () => {
    const options = chatStreamOptions("general_chat", false, { coreProvider: "llm_direct", llmProviderId: "prov_1", model: "deepseek-v4-flash" });

    expect(options.coreProvider).toBe("llm_direct");
  });
});
