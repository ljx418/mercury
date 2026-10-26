import type { ChatIntent, ChatProviderConfig, LLMProviderConfig, MercurySettings } from "./runtimeClient";

export function chatStreamOptions(
  intent: ChatIntent,
  autoContext: boolean,
  provider: ChatProviderConfig
): Partial<ChatProviderConfig> & { intentHint: ChatIntent; autoContext: boolean; profile: "chat" } {
  return { ...provider, intentHint: intent, autoContext, profile: "chat" };
}

export function resolveChatProviderDraft(settings: MercurySettings): ChatProviderConfig {
  const defaultProvider = getDefaultProvider(settings);
  const configured = settings.profiles?.chat ?? settings.chatProvider;
  const configuredProvider = getProviderById(settings, configured?.llmProviderId);
  const provider = configuredProvider ?? defaultProvider;
  return {
    coreProvider: configured?.coreProvider ?? settings.coreProvider ?? "piagent",
    llmProviderId: provider?.id,
    model: configured?.model ?? provider?.defaultModel ?? settings.defaultModel ?? undefined
  };
}

function getDefaultProvider(settings: MercurySettings | null): LLMProviderConfig | null {
  const providers = settings?.providers ?? [];
  return providers.find((provider) => provider.id === settings?.defaultProviderId) ?? null;
}

function getProviderById(settings: MercurySettings | null, providerId: string | undefined): LLMProviderConfig | null {
  if (!providerId) return null;
  return (settings?.providers ?? []).find((provider) => provider.id === providerId) ?? null;
}
