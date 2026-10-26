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

// ---------------------------------------------------------------------------
// R5 / 64 — installation experience correction (UI + orchestration only)
// ---------------------------------------------------------------------------

/** 64 §1: the frozen Windows persistent locations, outside the WSL virtual disk. */
export const ASR_WINDOWS_STORAGE = Object.freeze({
  downloadStaging: "C:\\workspace\\navia\\.navia\\downloads",
  productRoot: "C:\\workspace\\navia\\.navia\\asr",
  modelRoot: "C:\\workspace\\navia\\.navia\\asr\\models"
});

export function asrWindowsStorageLines(): string[] {
  return [
    `下载暂存：${ASR_WINDOWS_STORAGE.downloadStaging}`,
    `产品根：${ASR_WINDOWS_STORAGE.productRoot}`,
    `最终模型：${ASR_WINDOWS_STORAGE.modelRoot}`
  ];
}

export function asrWindowsStorageNote(): string {
  return "以上为 Windows 持久目录，不在 WSL 虚拟磁盘；WSL 发行版回收、重启或重装都不会丢失已安装的模型。";
}

/**
 * 64 §3 step 5 / §5.1 — one operation ends at "installed and enabled".
 * The auto-select fires only once the Runtime reports a self-tested `ready`.
 */
export function asrAutoSelectEnabled(state: string): boolean {
  return state === "ready";
}

/**
 * The label is claimed only when the Runtime confirms the model is the
 * EFFECTIVE one. A `ready` install that did not take effect must not read as
 * success.
 */
export function asrInstalledAndEnabledLabel(modelId: string, effectiveModelId: string | null): string {
  return effectiveModelId === modelId
    ? `已安装并启用：当前转写实际使用 ${modelId}。`
    : `已安装但尚未生效：实际生效模型为 ${effectiveModelId ?? "无可用模型"}，请重新选择后再转写。`;
}

export function asrEffectiveModelLabel(effectiveModelId: string | null, _requestedModelId: string | null): string {
  return effectiveModelId ?? "无可用模型";
}

export function asrRuntimeOfflineAction(): string {
  return "请先启动 Navia 本机伴侣（本地 Runtime）。Runtime 离线时无法校验、安装或自检模型。";
}

type AsrFailureCategory = "network" | "space" | "hash" | "self_test" | "permission" | "qualification" | "unknown";

/** 64 §3: each failure class needs its own next action, not one generic message. */
const ASR_FAILURE_CATEGORY: Readonly<Record<string, AsrFailureCategory>> = Object.freeze({
  V3_ASR_SOURCE_NOT_ALLOWED: "network",
  V3_ASR_SOURCE_NOT_FROZEN: "network",
  V3_ASR_IMPORT_FAILED: "network",
  V3_ASR_RUNTIME_RESTARTED: "network",
  V3_ASR_INSTALL_FAILED: "network",
  V3_ASR_PACKAGE_TOO_LARGE: "space",
  V3_ASR_HASH_MISMATCH: "hash",
  V3_ASR_SIZE_MISMATCH: "hash",
  V3_ASR_FILE_SET_MISMATCH: "hash",
  V3_ASR_FILE_TYPE_INVALID: "hash",
  V3_ASR_FILE_MODE_INVALID: "permission",
  V3_ASR_PACKAGE_INVALID: "hash",
  V3_ASR_PACKAGE_MODEL_MISMATCH: "hash",
  V3_ASR_IMPORT_PATH_INVALID: "hash",
  V3_ASR_ARCHIVE_FORMAT_UNSUPPORTED: "hash",
  V3_ASR_ARCHIVE_MEMBER_MISSING: "hash",
  V3_ASR_ARCHIVE_MEMBER_UNSAFE: "hash",
  V3_ASR_SELF_TEST_FAILED: "self_test",
  V3_ASR_MODEL_NOT_READY: "self_test",
  V3_ASR_AUDIO_FORMAT_UNSUPPORTED: "self_test",
  V3_ASR_AUDIO_REF_INVALID: "self_test",
  V3_ASR_MODEL_NOT_QUALIFIED: "qualification",
  V3_ASR_MODEL_NOT_INSTALLABLE: "qualification",
  V3_ASR_MODEL_UNKNOWN: "qualification"
});

const ASR_FAILURE_RECOVERY: Readonly<Record<AsrFailureCategory, { title: string; actions: string[] }>> = Object.freeze({
  network: {
    title: "下载未完成",
    actions: [
      "确认 Navia 本机伴侣正在运行、网络可达，然后点击“重试自动安装”。",
      "网络不可用时，请改用离线文件导入（见下方资产说明）。",
      "重试或取消都会清理暂存目录，已验证的既有模型不会被破坏。"
    ]
  },
  space: {
    title: "磁盘空间不足",
    actions: [
      "安装需要预留至少 1.0 GiB 空闲空间；安装前已阻止下载，不会先下载再失败。",
      "清理下载暂存目录或其他大文件后重新安装。"
    ]
  },
  hash: {
    title: "校验未通过",
    actions: [
      "模型文件与 catalog 冻结的 revision、字节数或 SHA-256 不一致，已保留旧的可用模型。",
      "请重新下载清单中的三个冻结文件，并确认文件名未被修改。",
      "若重新下载后仍失败，说明来源文件已变更，请改用自动安装。"
    ]
  },
  self_test: {
    title: "自检未通过",
    actions: [
      "文件校验通过，但模型自检失败，因此不会成为实际生效模型。",
      "请重新下载后重试；持续失败说明本机缺少运行时依赖，请改用自动安装。"
    ]
  },
  permission: {
    title: "文件权限不符合要求",
    actions: [
      "受控目录中的模型文件必须为私有权限；请删除该模型目录后重新安装。"
    ]
  },
  qualification: {
    title: "模型未通过资格确认",
    actions: [
      "该模型当前不可选，也不允许安装。请选择 catalog 中已通过资格的模型。"
    ]
  },
  unknown: {
    title: "安装未完成",
    actions: [
      "先检查网络、剩余磁盘空间与文件完整性，然后点击“重试自动安装”。",
      "若仍失败，请改用离线文件导入，或使用 catalog 中已可用的模型。"
    ]
  }
});

export function asrFailureRecovery(state: string, failureCode?: string | null): {
  category: AsrFailureCategory;
  title: string;
  actions: string[];
} {
  const category = (failureCode ? ASR_FAILURE_CATEGORY[failureCode] : undefined) ?? "unknown";
  const recovery = ASR_FAILURE_RECOVERY[category];
  return { category, title: state === "corrupt" ? `${recovery.title}（资产损坏）` : recovery.title, actions: [...recovery.actions] };
}

/**
 * 64 §3 step 4 and §5.5 — the manual route must be honest.
 *
 * Navia does not publish a downloadable offline bundle, so the panel must not
 * point at a release page that does not exist. The only truth we can state is
 * the catalog-frozen file set, the staging directory, and the one import entry
 * the Runtime actually exposes today.
 */
export function asrManualAssetGuidance(): string {
  return [
    "手动导入需要 catalog 冻结的三个文件：funasr-llamacpp-linux-x64.tar.gz、sensevoice-small-q8.gguf、fsmn-vad.gguf。",
    `请放入下载暂存目录：${ASR_WINDOWS_STORAGE.downloadStaging}，文件名不得更改。`,
    "Runtime 的导入入口目前只接受 .navia-asrpack；请由 Navia 本机伴侣在本机校验并组包后导入，Navia 不提供可下载的发布包。",
    "导入时 Runtime 会再次按 catalog 校验 revision、字节数与 SHA-256，并执行自检；任一不符都会 fail-closed 并保留旧模型。"
  ].join("\n");
}

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
      setMessage(asrRuntimeOfflineAction());
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

  // R5/64 §3 step 5: the ONE explicit action ends at "installed and enabled".
  // Auto-select fires only on a self-tested `ready`, and the confirmation is
  // the Runtime's own `effectiveModelId` — never the local optimistic state.
  const autoSelectedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!job || !asrAutoSelectEnabled(job.state)) return;
    const modelId = job.modelId;
    if (autoSelectedFor.current === modelId) return;
    autoSelectedFor.current = modelId;
    void (async () => {
      try {
        const next = await patchAsrSettings(modelId);
        setSelection(next);
        setMessage(asrInstalledAndEnabledLabel(modelId, next.effectiveModelId));
      } catch (error) {
        autoSelectedFor.current = null;
        setMessage(error instanceof Error ? error.message : "模型已安装，但自动启用失败，请手动选择。");
      }
    })();
  }, [job?.modelId, job?.state]);

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
      <div className="asr-storage" role="note" data-testid="asr-windows-storage">
        <strong>保存位置</strong>
        {asrWindowsStorageLines().map((line) => <span key={line}>{line}</span>)}
        <span className="muted">{asrWindowsStorageNote()}</span>
      </div>
      <dl className="asr-selection-summary">
        <div><dt>请求模型</dt><dd>{selection?.requestedModelId ?? "未读取"}</dd></div>
        <div><dt>实际生效</dt><dd data-testid="asr-effective-model">{asrEffectiveModelLabel(selection?.effectiveModelId ?? null, selection?.requestedModelId ?? null)}</dd></div>
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
                {!ready && model.installable && runtimeStatus === "online" ? <button type="button" disabled={loading} onClick={() => void installModel(model)}>下载、安装并使用</button> : null}
                {!ready && model.installable && runtimeStatus !== "online" ? <p className="asr-offline-note" role="note">{asrRuntimeOfflineAction()}</p> : null}
                {!ready && model.installable && runtimeStatus === "online" ? <button type="button" className="secondary" disabled={loading} onClick={() => openImport(model.modelId)}>使用离线文件</button> : null}
                {ready && !model.bundled ? <button type="button" className="danger" disabled={loading} onClick={() => void removeModel(model)}>卸载</button> : null}
              </div>
              {isEffective ? <p className="asr-effective-note" data-testid={`asr-effective-${model.modelId}`}>当前转写实际使用此模型。</p> : null}
              {ready && !isEffective && isRequested ? <p className="asr-effective-note" data-testid={`asr-installed-not-effective-${model.modelId}`}>{asrInstalledAndEnabledLabel(model.modelId, selection?.effectiveModelId ?? null)}</p> : null}
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
            {job.state === "failed" || job.state === "corrupt" ? (() => {
              const recovery = asrFailureRecovery(job.state, job.failureCode);
              return (
                <div className="asr-manual-recovery" data-testid="asr-failure-recovery" data-category={recovery.category}>
                  <strong>{recovery.title}</strong>
                  {job.failureCode ? <p className="muted">失败阶段：{asrStateLabel(job.state)} · 固定错误码 {job.failureCode}</p> : null}
                  <ol>{recovery.actions.map((action) => <li key={action}>{action}</li>)}</ol>
                  <strong>使用离线文件</strong>
                  <p className="muted" style={{ whiteSpace: "pre-line" }}>{asrManualAssetGuidance()}</p>
                  <code>python -m navia_runtime.asr_import --model {job.modelId} --package &lt;file.navia-asrpack&gt;</code>
                </div>
              );
            })() : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
