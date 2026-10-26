import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AsrModelSettingsPanel,
  asrAutoSelectEnabled,
  asrCatalogStateLabel,
  asrEffectiveModelLabel,
  asrFailureRecovery,
  asrInstalledAndEnabledLabel,
  asrManualAssetGuidance,
  asrQualityLabel,
  asrRuntimeOfflineAction,
  asrStateLabel,
  asrWindowsStorageLines,
  asrWindowsStorageNote,
  formatAsrBytes
} from "./AsrModelSettingsPanel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const catalog = {
  schemaVersion: "v3-asr-model-catalog/v1",
  providers: [
    { providerId: "faster_whisper_local", name: "Faster Whisper Local", engine: "faster-whisper", engineVersion: "1.2.1", locality: "local_only", status: "ready", description: "local" },
    { providerId: "funasr_edge_local", name: "FunASR Edge Local", engine: "funasr-llamacpp", engineVersion: "runtime-llamacpp-v0.2.6", locality: "local_only", status: "qualification_pending", description: "pending", runtimeKind: "native_process", capabilities: ["asr", "fsmn_vad"] }
  ],
  lowResourceBaseline: { cpuCores: 8, ramBytes: 8 * 1024 ** 3, gpuRequired: false },
  models: [
    {
      modelId: "faster-whisper-tiny", providerId: "faster_whisper_local", name: "Tiny (bundled fallback)", repository: "test/tiny", revision: "a", license: "MIT", installKind: "bundled", installable: false, selectable: true, bundled: true, fallbackOnly: true,
      quality: { status: "fallback_only", note: "最低可用，不计 production quality。" },
      resources: { downloadBytes: 76 * 1024 ** 2, diskBytes: 76 * 1024 ** 2, estimatedPeakRamBytes: 2 * 1024 ** 3, requiresGpu: false, recommendedCpuCores: 4, vramBytes: 0 },
      installation: { state: "ready", verifiedAt: "2026-09-21T00:00:00Z" }
    },
    {
      modelId: "faster-whisper-small", providerId: "faster_whisper_local", name: "Small", repository: "test/small", revision: "b", license: "MIT", installKind: "remote_verified", installable: true, selectable: true, bundled: false, fallbackOnly: false,
      quality: { status: "failed_current_gate", note: "当前真实盲评未通过。" },
      resources: { downloadBytes: 462 * 1024 ** 2, diskBytes: 462 * 1024 ** 2, estimatedPeakRamBytes: 8 * 1024 ** 3, requiresGpu: false, recommendedCpuCores: 8, vramBytes: 0 },
      installation: { state: "not_installed", verifiedAt: null }
    },
    {
      modelId: "funasr-paraformer-q8", providerId: "funasr_edge_local", name: "Paraformer Q8", repository: "test/paraformer", revision: "c", license: "Apache-2.0 + MIT runtime", installKind: "remote_verified", installable: true, selectable: false, bundled: false, fallbackOnly: false,
      quality: { status: "failed_current_gate", note: "real preflight failed", gateVersion: "v3-2-a06/v1" }, runtimeKind: "native_process", capabilities: ["asr", "fsmn_vad", "srt_timestamps"],
      resources: { downloadBytes: 246664010, diskBytes: 241074376, estimatedPeakRamBytes: 8 * 1024 ** 3, requiresGpu: false, recommendedCpuCores: 8, vramBytes: 0, installationFreeSpaceRequiredBytes: 1024 ** 3, platformDownloadBytes: { linuxX64: 246664010, windowsX64: 243616993 } },
      installation: { state: "not_installed", verifiedAt: null }
    },
    {
      modelId: "funasr-sensevoice-small-q8", providerId: "funasr_edge_local", name: "SenseVoiceSmall Q8 (V3 baseline)", repository: "FunAudioLLM/SenseVoiceSmall-GGUF", revision: "d", license: "Apache-2.0 + MIT runtime", installKind: "remote_verified", installable: true, selectable: true, bundled: false, fallbackOnly: false,
      quality: { status: "development_baseline", note: "V3 baseline", gateVersion: "v3-2-0c-baseline/v1" }, runtimeKind: "native_process", capabilities: ["asr", "fsmn_vad", "srt_timestamps", "cpu_only"],
      resources: { downloadBytes: 263943306, diskBytes: 258371224, estimatedPeakRamBytes: 2 * 1024 ** 3, requiresGpu: false, recommendedCpuCores: 8, vramBytes: 0, installationFreeSpaceRequiredBytes: 1024 ** 3, platformDownloadBytes: { linuxX64: 263943306, windowsX64: 260896289 } },
      installation: { state: "not_installed", verifiedAt: null }
    }
  ]
};

const selection = { schemaVersion: "v3-asr-selection/v1", requestedModelId: "faster-whisper-small", effectiveModelId: "faster-whisper-tiny", fallbackActive: true, fallbackReason: "requested_model_not_installed", updatedAt: "2026-09-21T00:00:00Z" };

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: status < 400, data, error: null, request_id: "req_test" }), { status, headers: { "Content-Type": "application/json" } });
}

async function renderPanel(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(fetchImpl));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<AsrModelSettingsPanel runtimeStatus="online" />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("R5-64 installation UX correction", () => {
  it("discloses the frozen Windows persistent directories so WSL recycling is visible", () => {
    const lines = asrWindowsStorageLines();
    expect(lines.join("|")).toContain("C:\\workspace\\navia\\.navia\\downloads");
    expect(lines.join("|")).toContain("C:\\workspace\\navia\\.navia\\asr");
    expect(lines.join("|")).toContain("C:\\workspace\\navia\\.navia\\asr\\models");
    expect(asrWindowsStorageNote()).toContain("不在 WSL 虚拟磁盘");
  });

  it("auto-selects only after a self-tested ready state, and confirms via effectiveModelId", () => {
    expect(asrAutoSelectEnabled("ready")).toBe(true);
    for (const state of ["not_installed", "checking", "downloading", "verifying", "installing", "self_testing", "failed", "corrupt", "cancelled"]) {
      expect(asrAutoSelectEnabled(state)).toBe(false);
    }
    expect(asrInstalledAndEnabledLabel("funasr-sensevoice-small-q8", "funasr-sensevoice-small-q8")).toContain("已安装并启用");
    expect(asrInstalledAndEnabledLabel("funasr-sensevoice-small-q8", "faster-whisper-tiny")).toContain("尚未生效");
  });

  it("categorises install failures into distinct, actionable next steps", () => {
    expect(asrFailureRecovery("failed", "V3_ASR_HASH_MISMATCH").category).toBe("hash");
    expect(asrFailureRecovery("corrupt", "V3_ASR_SIZE_MISMATCH").category).toBe("hash");
    expect(asrFailureRecovery("corrupt", "V3_ASR_FILE_SET_MISMATCH").category).toBe("hash");
    expect(asrFailureRecovery("failed", "V3_ASR_SELF_TEST_FAILED").category).toBe("self_test");
    expect(asrFailureRecovery("failed", "V3_ASR_PACKAGE_TOO_LARGE").category).toBe("space");
    expect(asrFailureRecovery("failed", "V3_ASR_SOURCE_NOT_ALLOWED").category).toBe("network");
    expect(asrFailureRecovery("failed", "V3_ASR_RUNTIME_RESTARTED").category).toBe("network");
    expect(asrFailureRecovery("failed", "V3_ASR_FILE_MODE_INVALID").category).toBe("permission");
    expect(asrFailureRecovery("failed", "V3_ASR_MODEL_NOT_QUALIFIED").category).toBe("qualification");
    // Every category must offer BOTH recovery actions, per 64 §3.
    for (const category of ["hash", "self_test", "space", "network", "permission", "qualification", "unknown"] as const) {
      const recovery = asrFailureRecovery("failed", category === "unknown" ? "V3_ASR_INSTALL_FAILED" : undefined);
      expect(recovery.actions.length).toBeGreaterThan(0);
    }
  });

  it("never claims a Navia release page package exists", () => {
    expect(asrManualAssetGuidance()).not.toContain("发布页");
    expect(asrManualAssetGuidance()).toContain("funasr-llamacpp-linux-x64.tar.gz");
    expect(asrManualAssetGuidance()).toContain("sensevoice-small-q8.gguf");
    expect(asrManualAssetGuidance()).toContain("fsmn-vad.gguf");
    expect(asrManualAssetGuidance()).toContain(".navia-asrpack");
  });

  it("offers a companion start action instead of a failing install button when the Runtime is offline", () => {
    expect(asrRuntimeOfflineAction()).toContain("启动 Navia 本机伴侣");
  });

  it("shows unavailable instead of a silent fallback when nothing is installed", () => {
    expect(asrEffectiveModelLabel(null, null)).toContain("无可用模型");
    expect(asrEffectiveModelLabel("funasr-sensevoice-small-q8", null)).toContain("funasr-sensevoice-small-q8");
  });
});

describe("AsrModelSettingsPanel", () => {
  it("formats resources and states without hiding low-resource impact", () => {
    expect(formatAsrBytes(8 * 1024 ** 3)).toBe("8.0 GiB");
    expect(formatAsrBytes(76 * 1024 ** 2)).toBe("76 MiB");
    expect(asrStateLabel("qualification_required")).toBe("待资格确认");
    expect(asrQualityLabel(catalog.models[0] as never)).toContain("不计入 V3-2-A06");
    expect(asrCatalogStateLabel({ ...catalog.models[2], installation: { state: "ready" } } as never)).toBe("已安装 · 质量未通过");
    expect(asrCatalogStateLabel({ ...catalog.models[3], installation: { state: "ready" } } as never)).toBe("已安装 · V3 基线");
  });

  it("shows requested/effective models, fallback and quality boundary", async () => {
    const mounted = await renderPanel(async (url) => response(url.endsWith("/catalog") ? catalog : selection));
    expect(mounted.container.textContent).toContain("8 核 CPU · 8.0 GiB 内存 · 无需 GPU");
    expect(mounted.container.textContent).toContain("faster-whisper-small");
    expect(mounted.container.textContent).toContain("faster-whisper-tiny");
    expect(mounted.container.textContent).toContain("当前真实质量门禁未通过");
    expect(mounted.container.textContent).toContain("最低资源兜底");
    expect(mounted.container.textContent).toContain("Linux 236 MiB · Windows 233 MiB");
    expect(mounted.container.textContent).toContain("至少 1.0 GiB 可用");
    const pendingCard = mounted.container.querySelector("[data-testid='asr-model-funasr-paraformer-q8']") as HTMLElement;
    expect(pendingCard.querySelector(".asr-state")?.classList.contains("asr-state-quality-failed")).toBe(true);
    expect((Array.from(pendingCard.querySelectorAll("button")).find((item) => item.textContent === "资格通过后可选") as HTMLButtonElement).disabled).toBe(true);
    expect(Array.from(pendingCard.querySelectorAll("button")).some((item) => item.textContent === "下载、安装并使用")).toBe(true);
    const baselineCard = mounted.container.querySelector("[data-testid='asr-model-funasr-sensevoice-small-q8']") as HTMLElement;
    expect(baselineCard.textContent).toContain("V3 本地转写基线");
    expect(baselineCard.textContent).toContain("Linux 252 MiB · Windows 249 MiB");
    expect((Array.from(baselineCard.querySelectorAll("button")).find((item) => item.textContent === "安装后可选") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => mounted.root.unmount());
  });

  it("opens a real failure recovery dialog after one-click install fails", async () => {
    const failedJob = { schemaVersion: "v3-asr-installation-job/v1", jobId: "asrjob_1", modelId: "faster-whisper-small", source: "remote", state: "failed", bytesCompleted: 1024, bytesTotal: 2048, percent: 50, bytesPerSecond: 512, etaSeconds: null, message: "hash mismatch", failureCode: "V3_ASR_HASH_MISMATCH", sequence: 3, createdAt: "x", updatedAt: "x", finishedAt: "x" };
    const mounted = await renderPanel(async (url, init) => {
      if (url.endsWith("/catalog")) return response(catalog);
      if (url.endsWith("/settings")) return response(selection);
      if (url.endsWith("/installations") && init?.method === "POST") return response({ job: failedJob }, 202);
      throw new Error(`unexpected request: ${url}`);
    });
    const button = Array.from(mounted.container.querySelectorAll("button")).find((item) => item.textContent === "下载、安装并使用") as HTMLButtonElement;
    button.focus();
    await act(async () => { button.click(); await Promise.resolve(); await Promise.resolve(); });
    const dialog = mounted.container.querySelector<HTMLElement>("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(document.activeElement).toBe(dialog);
    // V3_ASR_HASH_MISMATCH must be categorised as a verification failure, not a network one.
    expect(mounted.container.textContent).toContain("校验未通过");
    expect(mounted.container.querySelector<HTMLElement>("[data-testid='asr-failure-recovery']")?.dataset.category).toBe("hash");
    expect(mounted.container.textContent).toContain(".navia-asrpack");
    expect(mounted.container.textContent).toContain("python -m navia_runtime.asr_import");
    await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(mounted.container.querySelector("[role='dialog']")).toBeNull();
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 0)); });
    expect(document.activeElement).toBe(button);
    await act(async () => mounted.root.unmount());
  });
});
