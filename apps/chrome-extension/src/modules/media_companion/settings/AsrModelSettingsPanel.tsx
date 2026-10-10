import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  cancelAsrModelInstallation,
  getAsrCatalog,
  getAsrModelInstallation,
  getAsrSettings,
  importAsrModelPackage,
  patchAsrSettings,
  startAsrModelInstallation,
  uninstallAsrModel,
  type AsrCatalog,
  type AsrInstallationJob,
  type AsrModelDescriptor,
  type AsrSelection,
  type RuntimeStatus
} from "../../../runtimeClient";

const TERMINAL_STATES = new Set(["ready", "failed", "corrupt", "cancelled"]);

export function formatAsrBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 MiB";
  const gib = value / 1024 ** 3;
  return gib >= 1 ? `${gib.toFixed(gib >= 10 ? 0 : 1)} GiB` : `${Math.ceil(value / 1024 ** 2)} MiB`;
}

export function asrStateLabel(state: string): string {
  return ({
    not_installed: "未安装",
    qualification_required: "待资格确认",
    checking: "正在检查",
    downloading: "正在下载",
    verifying: "正在校验",
    installing: "正在安装",
    self_testing: "正在自检",
    ready: "可用",
    cancelling: "正在取消",
    cancelled: "已取消",
    failed: "安装失败",
    corrupt: "校验失败"
  } as Record<string, string>)[state] ?? state;
}

export function asrQualityLabel(model: AsrModelDescriptor): string {
  if (model.quality.status === "fallback_only") return "最低资源兜底：可离线转写，但不计入 V3-2-A06 生产质量通过。";
  if (model.quality.status === "failed_current_gate") return "当前真实质量门禁未通过：仅用于对比、诊断或后续复验。";
  if (model.quality.status === "development_baseline") return "V3 本地转写基线：已通过真实低资源可行性验证；自动退化检测与质量回退将在 V4 优化。";
  if (model.quality.status === "qualification_pending") return "资产已冻结，可安装验证；真实低资源双人盲评通过前不能作为生产模型。";
  if (model.quality.status === "production_qualified") return "已通过当前真实低资源质量门禁，可作为生产转写模型。";
  return "尚未完成版本、许可、资产哈希和真实音频质量确认。";
}

export function asrCatalogStateLabel(model: AsrModelDescriptor): string {
  if (model.installation.state === "ready" && model.quality.status === "failed_current_gate") {
    return "已安装 · 质量未通过";
  }
  if (model.installation.state === "ready" && model.quality.status === "development_baseline") {
    return "已安装 · V3 基线";
  }
  return asrStateLabel(model.installation.state);
}

type Props = { runtimeStatus: RuntimeStatus };

export function AsrModelSettingsPanel({ runtimeStatus }: Props) {
  const [catalog, setCatalog] = useState<AsrCatalog | null>(null);
  const [selection, setSelection] = useState<AsrSelection | null>(null);
  const [job, setJob] = useState<AsrInstallationJob | null>(null);
  const [message, setMessage] = useState("正在读取本地 ASR 配置...");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importModelRef = useRef<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const providers = useMemo(() => new Map((catalog?.providers ?? []).map((provider) => [provider.providerId, provider])), [catalog]);

  async function refresh() {
    if (runtimeStatus !== "online") {
      setMessage("本地 Runtime 离线，无法读取或安装 ASR 模型。");
      return;
    }
    setLoading(true);
    try {
      const [nextCatalog, nextSelection] = await Promise.all([getAsrCatalog(), getAsrSettings()]);
      setCatalog(nextCatalog);
      setSelection(nextSelection);
      setMessage("ASR 配置已从本地 Runtime 读取。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ASR 配置读取失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [runtimeStatus]);

  useEffect(() => {
    if (!job || TERMINAL_STATES.has(job.state)) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await getAsrModelInstallation(job.jobId);
        setJob(next);
        if (TERMINAL_STATES.has(next.state)) await refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "安装状态读取失败。");
        window.clearInterval(timer);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [job?.jobId, job?.state]);

  useEffect(() => {
    if (!job) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && TERMINAL_STATES.has(job.state)) {
        event.preventDefault();
        const modelId = job.modelId;
        setJob(null);
        restoreDialogFocus(modelId);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [job?.jobId, job?.state]);

  async function chooseModel(model: AsrModelDescriptor) {
    setLoading(true);
    try {
      const next = await patchAsrSettings(model.modelId);
      setSelection(next);
      setMessage(next.fallbackActive ? "已保存选择；模型可用前将明确使用 Tiny 兜底。" : "ASR 模型选择已生效。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "模型选择失败。");
    } finally {
      setLoading(false);
    }
  }

  async function installModel(model: AsrModelDescriptor) {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLoading(true);
    try {
      const next = await startAsrModelInstallation(model.modelId);
      setJob(next);
      setMessage("安装任务已由本地 Runtime 创建。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "模型安装无法启动。");
    } finally {
      setLoading(false);
    }
  }

  async function removeModel(model: AsrModelDescriptor) {
    setLoading(true);
    try {
      setSelection(await uninstallAsrModel(model.modelId));
      await refresh();
      setMessage("模型已从 Navia 受控目录移除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "模型移除失败。");
    } finally {
      setLoading(false);
    }
  }

  function openImport(modelId: string) {
    importModelRef.current = modelId;
    fileInputRef.current?.click();
  }

  function restoreDialogFocus(modelId: string) {
    window.setTimeout(() => {
      const previous = returnFocusRef.current;
      if (previous?.isConnected) {
        previous.focus();
        return;
      }
      const safeModelId = /^[a-zA-Z0-9_-]+$/.test(modelId) ? modelId : "";
      document.querySelector<HTMLElement>(`[data-testid='asr-model-${safeModelId}'] button:not([disabled])`)?.focus();
    }, 0);
  }

  function closeJobDialog() {
    const modelId = job?.modelId ?? "";
    setJob(null);
    restoreDialogFocus(modelId);
  }

  async function importPackage(file: File | undefined) {
    const modelId = importModelRef.current;
    if (!file || !modelId) return;
    setLoading(true);
    try {
      const next = await importAsrModelPackage(modelId, file);
      setJob(next);
      setMessage("离线包已交给 Runtime 校验；未通过 hash 前不会生效。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "离线包导入失败。");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const lowResource = catalog?.lowResourceBaseline;
  return (
    <div className="asr-settings" data-testid="asr-settings-panel">
      <div className="asr-baseline" role="note">
        <strong>低资源基线</strong>
        <span>{lowResource ? `${lowResource.cpuCores} 核 CPU · ${formatAsrBytes(lowResource.ramBytes)} 内存 · 无需 GPU` : "8 核 CPU · 8 GiB 内存 · 无需 GPU"}</span>
      </div>
      <dl className="asr-selection-summary">
        <div><dt>请求模型</dt><dd>{selection?.requestedModelId ?? "未读取"}</dd></div>
        <div><dt>实际生效</dt><dd>{selection?.effectiveModelId ?? "无可用模型"}</dd></div>
        <div><dt>Fallback</dt><dd>{selection?.fallbackActive ? `已启用：${selection.fallbackReason}` : "未启用"}</dd></div>
      </dl>

      <div className="asr-model-list" aria-busy={loading}>
        {(catalog?.models ?? []).map((model) => {
          const provider = providers.get(model.providerId);
          const isRequested = selection?.requestedModelId === model.modelId;
          const isEffective = selection?.effectiveModelId === model.modelId;
          const ready = model.installation.state === "ready";
          return (
            <article className={`asr-model ${isEffective ? "effective" : ""}`} key={model.modelId} data-testid={`asr-model-${model.modelId}`} data-quality-status={model.quality.status}>
              <header>
                <div>
                  <h3>{model.name}</h3>
                  <p>{provider?.name ?? model.providerId}</p>
                </div>
                <span className={`asr-state asr-state-${model.installation.state}${model.quality.status === "failed_current_gate" ? " asr-state-quality-failed" : ""}`}>{asrCatalogStateLabel(model)}</span>
              </header>
              <p className="asr-quality">{asrQualityLabel(model)}</p>
              <dl className="asr-resources">
                <div><dt>下载</dt><dd>{model.bundled ? "随 Runtime 提供" : formatAsrBytes(model.resources.downloadBytes)}</dd></div>
                {model.resources.platformDownloadBytes ? <div><dt>平台包</dt><dd>Linux {formatAsrBytes(model.resources.platformDownloadBytes.linuxX64)} · Windows {formatAsrBytes(model.resources.platformDownloadBytes.windowsX64)}</dd></div> : null}
                <div><dt>硬盘</dt><dd>{formatAsrBytes(model.resources.diskBytes)}</dd></div>
                <div><dt>内存</dt><dd>政策上限 {formatAsrBytes(model.resources.estimatedPeakRamBytes)}</dd></div>
                <div><dt>CPU</dt><dd>建议 {model.resources.recommendedCpuCores} 核</dd></div>
                <div><dt>显存</dt><dd>{model.resources.requiresGpu ? `约 ${formatAsrBytes(model.resources.vramBytes)}` : "不需要"}</dd></div>
                {model.resources.installationFreeSpaceRequiredBytes ? <div><dt>安装空间</dt><dd>至少 {formatAsrBytes(model.resources.installationFreeSpaceRequiredBytes)} 可用</dd></div> : null}
              </dl>
              <div className="asr-model-actions">
                <button type="button" disabled={!model.selectable || !ready || isRequested || loading} onClick={() => void chooseModel(model)}>
                  {isRequested ? "已选择" : !model.selectable ? "资格通过后可选" : ready ? "选择" : "安装后可选"}
                </button>
                {!ready && model.installable ? <button type="button" disabled={loading} onClick={() => void installModel(model)}>下载并安装</button> : null}
                {!ready && model.installable ? <button type="button" className="secondary" disabled={loading} onClick={() => openImport(model.modelId)}>导入离线包</button> : null}
                {ready && !model.bundled ? <button type="button" className="danger" disabled={loading} onClick={() => void removeModel(model)}>卸载</button> : null}
              </div>
              {isEffective ? <p className="asr-effective-note">当前转写实际使用此模型。</p> : null}
            </article>
          );
        })}
      </div>

      <input ref={fileInputRef} hidden type="file" accept=".navia-asrpack,application/octet-stream" onChange={(event) => void importPackage(event.target.files?.[0])} />
      <div className="settings-feedback" role="status" aria-live="polite"><p className="muted">{message}</p></div>

      {job ? (
        <div className="asr-install-overlay" role="presentation">
          <section ref={dialogRef} className="asr-install-dialog" role="dialog" aria-modal="true" aria-labelledby="asr-install-title" tabIndex={-1}>
            <header>
              <div><h3 id="asr-install-title">安装 ASR 模型</h3><p>{job.modelId}</p></div>
              {TERMINAL_STATES.has(job.state) ? <button type="button" className="close-button" aria-label="关闭安装进度" onClick={closeJobDialog}>关闭</button> : null}
            </header>
            <strong>{asrStateLabel(job.state)}</strong>
            <div className="asr-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.percent)} aria-label="模型安装进度">
              <span style={{ width: `${Math.max(0, Math.min(job.percent, 100))}%` }} />
            </div>
            <p>{formatAsrBytes(job.bytesCompleted)} / {formatAsrBytes(job.bytesTotal)} · {job.percent.toFixed(1)}%</p>
            <p>{formatAsrBytes(job.bytesPerSecond)}/s{job.etaSeconds !== null ? ` · 预计 ${job.etaSeconds}s` : ""}</p>
            <p className="muted">{job.message}</p>
            {!TERMINAL_STATES.has(job.state) ? <button type="button" className="danger" onClick={() => void cancelAsrModelInstallation(job.jobId).then(setJob)}>取消安装</button> : null}
            {job.state === "failed" || job.state === "corrupt" ? (
              <div className="asr-manual-recovery">
                <strong>自动安装未完成</strong>
                <ol>
                  <li>先检查网络和剩余磁盘空间，再点击关闭后重试。</li>
                  <li>从 Navia 发布页获取与模型 ID、revision 匹配的 `.navia-asrpack`。</li>
                  <li>点击模型旁“导入离线包”；Runtime 会再次校验全部 SHA-256。</li>
                </ol>
                <code>python -m navia_runtime.asr_import --model {job.modelId} --package &lt;file.navia-asrpack&gt;</code>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
