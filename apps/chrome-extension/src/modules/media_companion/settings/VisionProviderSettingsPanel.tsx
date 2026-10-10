import React, { useEffect, useMemo, useState } from "react";
import {
  bootstrapLocalRuntimeSession,
  deleteVisionProvider,
  listVisionProviders,
  saveVisionProvider,
  selectVisionProvider,
  testVisionProvider,
  type RuntimeStatus,
  type VisionProviderConfig,
  type VisionProviderDescriptor,
  type VisionProviderSettings
} from "../../../runtimeClient";

type Props = { runtimeStatus: RuntimeStatus };

const fallbackCatalog: VisionProviderDescriptor[] = [
  {
    id: "minimax-cn-openai-vision",
    adapterKind: "minimax_chat_completions",
    name: "MiniMax Vision（中国区）",
    baseUrl: "https://api.minimaxi.com/v1",
    models: ["MiniMax-M3"],
    defaultModel: "MiniMax-M3"
  },
  {
    id: "minimax-openai-vision",
    adapterKind: "minimax_chat_completions",
    name: "MiniMax Vision（国际区）",
    baseUrl: "https://api.minimax.io/v1",
    models: ["MiniMax-M3", "MiniMax-M3.1-Flash-Preview"],
    defaultModel: "MiniMax-M3"
  },
  {
    id: "openai-responses-vision",
    adapterKind: "openai_responses",
    name: "OpenAI Vision",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4.1-mini-2025-04-14"],
    defaultModel: "gpt-4.1-mini-2025-04-14"
  }
];

const emptySettings: VisionProviderSettings = { providers: [], catalog: fallbackCatalog, selectedProviderId: null };

export function VisionProviderSettingsPanel({ runtimeStatus }: Props) {
  const [settings, setSettings] = useState<VisionProviderSettings>(emptySettings);
  const [providerId, setProviderId] = useState("minimax-cn-openai-vision");
  const [model, setModel] = useState("MiniMax-M3");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("尚未读取视觉 Provider 配置。");

  const descriptor = useMemo(() => settings.catalog.find((item) => item.id === providerId) ?? null, [providerId, settings.catalog]);
  const provider = useMemo(() => settings.providers.find((item) => item.id === providerId) ?? null, [providerId, settings.providers]);

  async function withSession<T>(operation: () => Promise<T>): Promise<T> {
    await bootstrapLocalRuntimeSession();
    return operation();
  }

  function applySettings(next: VisionProviderSettings) {
    setSettings(next);
    const preferredId = next.selectedProviderId
      ?? (next.catalog.some((item) => item.id === providerId) ? providerId : null)
      ?? next.catalog.find((item) => item.id === "minimax-cn-openai-vision")?.id
      ?? next.catalog.find((item) => item.id === "minimax-openai-vision")?.id
      ?? next.catalog[0]?.id
      ?? "";
    setProviderId(preferredId);
    const configured = next.providers.find((item) => item.id === preferredId);
    const catalogItem = next.catalog.find((item) => item.id === preferredId);
    setModel(configured?.model ?? catalogItem?.defaultModel ?? "");
  }

  async function refresh() {
    if (runtimeStatus !== "online") {
      setSettings((current) => ({ ...current, catalog: current.catalog.length ? current.catalog : fallbackCatalog }));
      setModel((current) => current || fallbackCatalog[0].defaultModel);
      setMessage("可先选择模型并输入 API Key；启动本地 Runtime 后再保存和测试。");
      return;
    }
    setBusy(true);
    try {
      const next = await withSession(listVisionProviders);
      applySettings(next);
      setMessage(next.providers.length ? "视觉 Provider 配置已从本机 Runtime 读取。" : "尚未配置视觉 Provider。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "视觉 Provider 读取失败。");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [runtimeStatus]);

  useEffect(() => () => setApiKey(""), []);

  function chooseProvider(nextId: string) {
    setProviderId(nextId);
    const configured = settings.providers.find((item) => item.id === nextId);
    const catalogItem = settings.catalog.find((item) => item.id === nextId);
    setModel(configured?.model ?? catalogItem?.defaultModel ?? "");
    setApiKey("");
    setMessage(configured ? "已载入该 Provider 的脱敏配置。" : "请输入该 Provider 的 API Key。");
  }

  async function saveAndTest() {
    if (!descriptor || !apiKey.trim() || !model) {
      setMessage("请选择 Provider、模型并输入 API Key。");
      return;
    }
    setBusy(true);
    setMessage("正在写入系统凭据库并执行中性图片能力测试...");
    try {
      await withSession(() => saveVisionProvider(descriptor, model, apiKey.trim()));
      setApiKey("");
      const tested = await testVisionProvider(descriptor.id);
      await selectVisionProvider(descriptor.id);
      applySettings(await listVisionProviders());
      setMessage(`测试通过并已设为当前模型：${tested.result.model} · ${tested.result.usage.total_tokens} tokens · ${tested.result.latencyMs} ms`);
    } catch (error) {
      setApiKey("");
      setMessage(error instanceof Error ? error.message : "视觉 Provider 保存或测试失败。");
      try { applySettings(await listVisionProviders()); } catch { /* Preserve the primary actionable error. */ }
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!provider) return;
    setBusy(true);
    try {
      await withSession(() => selectVisionProvider(provider.id));
      applySettings(await listVisionProviders());
      setMessage(`已切换到 ${provider.name} · ${provider.model}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "视觉 Provider 切换失败。");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!provider) return;
    setBusy(true);
    try {
      await withSession(() => deleteVisionProvider(provider.id));
      setApiKey("");
      applySettings(await listVisionProviders());
      setMessage("该视觉 Provider 及其系统凭据已删除。其他 Provider 不受影响。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "视觉 Provider 删除失败。");
    } finally {
      setBusy(false);
    }
  }

  const verified = provider?.testStatus?.status === "ok";
  const isSelected = settings.selectedProviderId === providerId;
  const storageLabel = provider?.secretStorage === "windows_credential_vault"
    ? "Windows 凭据库"
    : provider?.secretStorage === "os_keyring" ? "操作系统凭据库" : "待配置";

  return (
    <section className="vision-provider-settings" aria-labelledby="vision-provider-title" data-testid="vision-provider-settings">
      <header>
        <div>
          <h3 id="vision-provider-title">画面理解模型</h3>
          <p>可分别配置 MiniMax 中国区、国际区与 OpenAI。API Key 只保存在操作系统凭据库，不进入扩展或 Navia 数据库。</p>
        </div>
        <span className={verified ? "vision-state ready" : "vision-state"}>
          {isSelected && verified ? "当前使用" : verified ? "已验证" : provider?.credentialConfigured ? "已保存" : "未配置"}
        </span>
      </header>

      <div className="vision-provider-selectors">
        <label>
          <span>服务商</span>
          <select value={providerId} disabled={busy} onChange={(event) => chooseProvider(event.target.value)}>
            {settings.catalog.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          <span>模型</span>
          <select value={model} disabled={busy || !descriptor} onChange={(event) => setModel(event.target.value)}>
            {(descriptor?.models ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <dl className="vision-provider-summary">
        <div><dt>当前路由</dt><dd>{isSelected ? "已选择" : "未选择"}</dd></div>
        <div><dt>已配置服务</dt><dd>{settings.providers.length} / {settings.catalog.length}</dd></div>
        <div><dt>密钥</dt><dd>{provider?.apiKeyMasked || "未配置"}</dd></div>
        <div><dt>保存位置</dt><dd>{storageLabel}</dd></div>
      </dl>

      <label className="vision-key-field">
        <span>{provider ? `更换 ${descriptor?.name ?? "Provider"} API Key` : `${descriptor?.name ?? "Provider"} API Key`}</span>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={providerId.startsWith("minimax") ? "输入 MiniMax API Key" : "sk-..."}
          disabled={busy}
        />
      </label>

      <p className="vision-provider-impact">
        中国区与国际区 API Key 不互通。测试会向所选服务商上传一张 Navia 生成的无用户内容色块图，并产生少量 API 用量。切换服务商会改变费用、延迟及输出质量；真实视频帧仅在后续任务明确授权后上传。
      </p>
      <div className="vision-provider-actions">
        <button type="button" disabled={busy || runtimeStatus !== "online" || !descriptor || !model || !apiKey.trim()} onClick={() => void saveAndTest()}>保存、测试并使用</button>
        {provider && verified && !isSelected ? <button type="button" className="secondary" disabled={busy} onClick={() => void activate()}>设为当前</button> : null}
        {provider ? <button type="button" className="danger" disabled={busy} onClick={() => void remove()}>删除此配置</button> : null}
      </div>
      <p className="muted" role="status" aria-live="polite">{message}</p>
    </section>
  );
}
