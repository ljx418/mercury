import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaOutlineTask, MediaTranscriptProjection } from "../../../runtimeClient";
import { MediaTranscriptQuickCard, MediaTranscriptViewer } from "../acquisition";

const projection: MediaTranscriptProjection = {
  schemaVersion: "v3-media-transcript-projection/v1",
  taskId: `media_task_${"a".repeat(32)}`,
  sourceIdentity: "portal:bilibili:BV1:1:1",
  adapterId: "bilibili",
  revision: 7,
  updatedAt: "2026-10-07T15:00:00Z",
  state: "succeeded",
  route: "trusted_tab_capture_asr",
  progressPercent: 100,
  failureCode: null,
  terminal: true,
  cleanupStatus: "complete",
  canCancel: false,
  canRetry: false,
  failures: [],
  segments: [{ segmentId: "seg_1", startMs: 0, endMs: 1800, text: "真实转写内容" }],
  resources: { cpuCoreLimit: 8, memoryLimitBytes: 8 * 1024 ** 3, temporaryDiskPeakBytes: 4 * 1024 ** 2, gpuUsed: false }
};

const outlineTask: MediaOutlineTask = {
  taskId: projection.taskId,
  sourceIdentity: projection.sourceIdentity,
  state: "degraded",
  revision: 6,
  createdAt: projection.updatedAt,
  updatedAt: projection.updatedAt,
  knowledgeImportStatus: "deferred_to_v4",
  terminalFailureCode: "VISUAL_EVIDENCE_UNAVAILABLE",
  currentOutlineId: `outline_${"b".repeat(32)}`,
  projections: {
    schemaVersion: "v3-media-outline-taskstore/v2",
    task: { taskId: projection.taskId, sourceIdentity: projection.sourceIdentity, state: "degraded", revision: 6, knowledgeImportStatus: "deferred_to_v4" },
    evidenceCatalog: [],
    outline: { outlineId: `outline_${"b".repeat(32)}`, taskId: projection.taskId, taskRevision: 6, title: "真实视频大纲", summary: "仅基于真实转写生成。", sections: [], contentSha256: "c".repeat(64) },
    timeline: [],
    mindmap: { projectionId: `mindmap_${"d".repeat(32)}`, outlineId: `outline_${"b".repeat(32)}`, taskId: projection.taskId, contentSha256: "e".repeat(64), nodes: [] },
    terminalFailureCode: "VISUAL_EVIDENCE_UNAVAILABLE"
  }
};

describe("V3 transcript product surfaces", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("renders one Runtime projection and opens the detailed workspace", () => {
    const open = vi.fn();
    act(() => root.render(<MediaTranscriptQuickCard projection={projection} outlineTask={outlineTask} outlineState="ready" onOpenWorkspace={open} />));
    expect(host.textContent).toContain("转写已完成");
    expect(host.textContent).toContain("trusted_tab_capture_asr");
    expect(host.textContent).toContain("真实转写内容");
    expect(host.textContent).toContain("真实视频大纲");
    expect(host.textContent).toContain("CPU 上限");
    act(() => (host.querySelector("button") as HTMLButtonElement).click());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("only exposes Runtime-authorized cancellation and retry actions", () => {
    const cancel = vi.fn();
    const retry = vi.fn();
    const cancelled = { ...projection, state: "cancelled" as const, canRetry: true };
    act(() => root.render(<MediaTranscriptQuickCard projection={cancelled} credentialBinding="pcl_old:pce_old" onOpenWorkspace={vi.fn()} onCancel={cancel} onRetry={retry} />));
    expect(host.querySelector("[data-testid='media-transcript-cancel']")).toBeNull();
    const retryButton = host.querySelector("[data-testid='media-transcript-retry']") as HTMLButtonElement;
    expect(retryButton).not.toBeNull();
    expect(host.querySelector("[data-task-id]")?.getAttribute("data-task-id")).toBe(cancelled.taskId);
    expect(host.querySelector("[data-task-id]")?.getAttribute("data-credential-binding")).toBe("pcl_old:pce_old");
    act(() => retryButton.click());
    expect(retry).toHaveBeenCalledTimes(1);

    const acquiring = { ...projection, state: "acquiring" as const, terminal: false, canCancel: true };
    act(() => root.render(<MediaTranscriptQuickCard projection={acquiring} onOpenWorkspace={vi.fn()} onCancel={cancel} onRetry={retry} />));
    const cancelButton = host.querySelector("[data-testid='media-transcript-cancel']") as HTMLButtonElement;
    expect(cancelButton).not.toBeNull();
    expect(host.querySelector("[data-testid='media-transcript-retry']")).toBeNull();
    act(() => cancelButton.click());
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("renders ordered timestamped transcript segments without seek controls", () => {
    act(() => root.render(<MediaTranscriptViewer segments={projection.segments} />));
    expect(host.textContent).toContain("00:00–00:01");
    expect(host.textContent).toContain("真实转写内容");
    expect(host.querySelector("video")).toBeNull();
  });

  it("renders a Runtime-authored fault without inventing recovery or success", () => {
    const failed = {
      ...projection,
      state: "failed" as const,
      route: "credentialed_media_asr" as const,
      progressPercent: 42,
      failureCode: "V3_ASR_PROCESS_FAILED",
      segments: [],
      canRetry: true
    };
    act(() => root.render(<MediaTranscriptQuickCard projection={failed} onOpenWorkspace={vi.fn()} onRetry={vi.fn()} />));
    expect(host.textContent).toContain("任务失败");
    expect(host.textContent).toContain("V3_ASR_PROCESS_FAILED");
    expect(host.textContent).toContain("credentialed_media_asr");
    expect(host.textContent).not.toContain("转写已完成");
    expect(host.querySelector("[data-testid='media-transcript-retry']")).not.toBeNull();
  });
});
