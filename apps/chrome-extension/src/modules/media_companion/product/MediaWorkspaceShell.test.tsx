import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeRequestError, type MediaComprehensionProjection, type MediaOutlineTask, type MediaTranscriptProjection } from "../../../runtimeClient";
import { MediaWorkspaceShell } from "./MediaWorkspaceShell";
import { resolveMediaWorkspaceRoute } from "./MediaWorkspaceRouter";
import { layoutTimelineMoments } from "./ComprehensionViews";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver }).ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

const taskId = `media_task_${"1".repeat(32)}`;
const task: MediaOutlineTask = {
  taskId,
  sourceIdentity: "portal:bilibili:BV1TEST:1:1",
  state: "degraded",
  revision: 6,
  createdAt: "2026-10-08T00:00:00Z",
  updatedAt: "2026-10-08T00:01:00Z",
  knowledgeImportStatus: "deferred_to_v4",
  terminalFailureCode: "VISUAL_EVIDENCE_UNAVAILABLE",
  currentOutlineId: "outline_test",
  projections: null,
};

let currentTask = task;
const getTask = vi.fn(async (_id: string) => currentTask);
const listTasks = vi.fn(async () => [currentTask]);
const getTranscriptProjection = vi.fn<(_id: string) => Promise<MediaTranscriptProjection>>();
const getComprehension = vi.fn<() => Promise<MediaComprehensionProjection>>();
const synthesizeComprehension = vi.fn<() => Promise<MediaComprehensionProjection>>();
let autoConnect = true;
let runtimeChange: ((change: { status: string }) => void) | null = null;

vi.mock("../../../runtimeClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../runtimeClient")>()),
  getMediaOutlineTask: (id: string) => getTask(id),
  getMediaTranscriptProjection: (id: string) => getTranscriptProjection(id),
  listMediaOutlineTasks: () => listTasks(),
  getMediaWorkspaceComprehension: () => getComprehension(),
  synthesizeMediaWorkspaceComprehension: () => synthesizeComprehension(),
}));

vi.mock("../../knowledge_workspace/LocalRuntimeAccess", () => ({
  LocalRuntimeAccess: ({ onChange }: { onChange: (change: { status: string }) => void }) => {
    runtimeChange = onChange;
    if (autoConnect) queueMicrotask(() => onChange({ status: "connected" }));
    return <div data-testid="runtime-connected">本机伴侣已连接</div>;
  },
}));

describe("MediaWorkspaceShell", () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    getTask.mockReset();
    getTask.mockImplementation(async () => currentTask);
    listTasks.mockClear();
    getTranscriptProjection.mockReset();
    getComprehension.mockReset();
    synthesizeComprehension.mockReset();
    getComprehension.mockRejectedValue(new RuntimeRequestError({ kind: "api", httpStatus: 404, message: "Legacy task has no comprehension projection." }));
    currentTask = task;
    autoConnect = true;
    runtimeChange = null;
    sessionStorage.clear();
    window.location.hash = "";
  });
  afterEach(() => host.remove());

  it("reads a direct task route from Runtime and exposes stable route identity", async () => {
    const resolution = resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}/outline`);
    expect(resolution).not.toBeNull();
    const root = createRoot(host);
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolution!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const shell = host.querySelector("[data-testid='media-product-shell']");
    expect(getTask).toHaveBeenCalledWith(taskId);
    expect(shell?.getAttribute("data-route-kind")).toBe("outline");
    expect(shell?.getAttribute("data-task-id")).toBe(taskId);
    expect(shell?.getAttribute("data-task-revision")).toBe("6");
    expect(host.querySelector("[data-testid='media-route-outline']")?.className).toContain("active");
    await act(async () => root.unmount());
  });

  it("refreshes an unpublished task into a published result without navigation", async () => {
    currentTask = { ...task, state: "created", revision: 1, currentOutlineId: null, terminalFailureCode: null };
    const root = createRoot(host);
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}`)!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.textContent).toContain("该任务尚未发布大纲");
    expect(host.querySelector("[data-task-revision]")?.getAttribute("data-task-revision")).toBe("1");
    currentTask = {
      ...task, state: "ready", revision: 2, terminalFailureCode: null,
      projections: {
        schemaVersion: "v3-media-outline-taskstore/v2",
        task: { taskId, sourceIdentity: task.sourceIdentity, state: "ready", revision: 2, knowledgeImportStatus: "deferred_to_v4" },
        evidenceCatalog: [],
        outline: { outlineId: "outline_live", taskId, taskRevision: 2, title: "已发布的视频大纲", summary: "完整视频摘要", sections: [], contentSha256: "a".repeat(64) },
        timeline: [], mindmap: { projectionId: "mindmap_live", outlineId: "outline_live", taskId, contentSha256: "b".repeat(64), nodes: [] }, terminalFailureCode: null,
      },
    };
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1650)); });
    expect(host.querySelector("[data-task-revision]")?.getAttribute("data-task-revision")).toBe("2");
    expect(host.textContent).toContain("已发布的视频大纲");
    const reads = getTask.mock.calls.length;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1650)); });
    expect(getTask).toHaveBeenCalledTimes(reads);
    await act(async () => root.unmount());
  });

  it("renders Stage B brief and claims with a visible limited state", async () => {
    const evidenceId = `mtr_${"9".repeat(32)}`;
    const chapterId = `chapter_${"8".repeat(16)}`;
    currentTask = {
      ...task, state: "ready", terminalFailureCode: null,
      projections: {
        schemaVersion: "v3-media-outline-taskstore/v2",
        task: { taskId, sourceIdentity: task.sourceIdentity, state: "ready", revision: 6, knowledgeImportStatus: "deferred_to_v4" },
        evidenceCatalog: [{ evidenceId, taskId, kind: "transcript", timestampStartMs: 0, timestampEndMs: 90_000, contentSha256: "a".repeat(64), relativeArtifactRef: "evidence/stage-b.json" }],
        outline: { outlineId: "outline_stage_b", taskId, taskRevision: 6, title: "Stage B 视频", summary: "旧摘要", sections: [], contentSha256: "b".repeat(64) },
        timeline: [], mindmap: { projectionId: "mindmap_stage_b", outlineId: "outline_stage_b", taskId, contentSha256: "c".repeat(64), nodes: [] }, terminalFailureCode: null,
      },
    };
    getComprehension.mockResolvedValue({
      schemaVersion: "v3-media-workspace-comprehension-projection/v2",
      task: { taskId, taskRevision: 6, sourceIdentity: task.sourceIdentity, mediaDurationMs: 90_000, outlineId: "outline_stage_b" },
      authorization: { groundedTextCloudStatus: "granted", providerId: "minimax", modelId: "MiniMax-M2.1", outboundDerivedTextSha256: "d".repeat(64), rawMediaUploadCount: 0 },
      quality: { mode: "grounded_model", humanQualityReviewRequired: true, warning: "当前结果证据覆盖受限，不能标记为完整视频理解。", style: null, styleRisk: null, status: "limited", failureCodes: ["V3510B_ENDING_EVIDENCE_MISSING"] },
      grounded: {
        brief: {
          text: "这是经过全局归纳而不是字幕复制的视频概览。",
          evidenceIds: [evidenceId],
          regions: ["opening"],
          origin: "deterministic_claim_composer",
          sourceClaimIds: [`claim_${"7".repeat(16)}`, `claim_${"6".repeat(16)}`],
        },
        claims: [
          { claimId: `claim_${"7".repeat(16)}`, text: "该视频先提出问题，再说明分析方法。", evidenceIds: [evidenceId], regions: ["opening"] },
          { claimId: `claim_${"6".repeat(16)}`, text: "该视频最后归纳了适用范围。", evidenceIds: [evidenceId], regions: ["opening"] },
        ],
        regions: [{ name: "opening", startMs: 0, endMs: 30_000, availability: "substantive", evidenceIds: [evidenceId] }],
      },
      evidenceCatalog: [{ evidenceId, taskId, kind: "transcript", timestampStartMs: 0, timestampEndMs: 90_000, contentSha256: "a".repeat(64), relativeArtifactRef: "evidence/stage-b.json", thumbnailAvailable: false, excerpt: "真实字幕仅用于折叠检查" }],
      outline: { outlineId: "outline_stage_b", taskId, taskRevision: 6, title: "Stage B 视频", summary: "这是经过全局归纳而不是字幕复制的视频概览。", contentSha256: "e".repeat(64), chapters: [{ chapterId, parentChapterId: null, depth: 1, order: 0, startMs: 0, endMs: 90_000, title: "问题与方法", thesis: "这一章用于验证旧章节文本不会冒充核心表达。", keyPoints: ["旧章节关键点"], evidenceIds: [evidenceId], representativeFrameEvidenceId: null }] },
      timeline: { projectionId: "timeline_stage_b", outlineId: "outline_stage_b", contentSha256: "f".repeat(64), chapterIds: [chapterId], moments: [] },
      mindmap: { projectionId: "mindmap_stage_b", outlineId: "outline_stage_b", contentSha256: "1".repeat(64), nodes: [] },
    });
    window.location.hash = `#/media/tasks/${taskId}`;
    const root = createRoot(host);
    await act(async () => { root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(window.location.hash)!} />); await Promise.resolve(); await Promise.resolve(); });
    expect(host.querySelector(".media-overview-hero")?.textContent).toContain("这是经过全局归纳");
    expect(host.querySelector("[data-testid='media-brief-origin']")?.textContent).toContain("2 条已核验证据表达组合");
    expect(host.querySelector("[data-testid='media-brief-origin']")?.getAttribute("data-brief-origin")).toBe("deterministic_claim_composer");
    expect(host.querySelector(".media-overview-evidence")?.textContent).toContain("该视频先提出问题");
    expect(host.querySelector(".media-overview-evidence")?.textContent).not.toContain("旧章节关键点");
    expect(host.querySelector(".media-grounded-limited")?.textContent).toContain("证据覆盖受限");
    const link = host.querySelector<HTMLAnchorElement>(`.media-overview-evidence [data-evidence-return-id='${evidenceId}']`)!;
    await act(async () => link.click());
    expect(sessionStorage.getItem("navia.mediaEvidenceReturn.v1")).toContain(evidenceId);
    await act(async () => root.unmount());
  });

  it("reads the authoritative transcript projection during the outline-store handoff", async () => {
    const outlineNotFound = new RuntimeRequestError({ kind: "api", httpStatus: 404, code: "TASK_NOT_FOUND", message: "Media outline task was not found." });
    getTask.mockRejectedValueOnce(outlineNotFound);
    getTranscriptProjection.mockResolvedValue({ taskId, sourceIdentity: task.sourceIdentity, state: "created", failureCode: null } as MediaTranscriptProjection);
    const root = createRoot(host);
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}`)!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(getTranscriptProjection).toHaveBeenCalledWith(taskId);
    expect(host.textContent).toContain("大纲尚未发布");
    expect(host.textContent).not.toContain("无法读取该媒体任务");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1650)); });
    expect(host.querySelector("[data-task-revision]")?.getAttribute("data-task-revision")).toBe("6");
    await act(async () => root.unmount());
  });

  it("shows cancellation from source authority when no outline row exists", async () => {
    getTask.mockRejectedValue(new RuntimeRequestError({ kind: "api", httpStatus: 404, code: "TASK_NOT_FOUND", message: "Media outline task was not found." }));
    let state: MediaTranscriptProjection["state"] = "succeeded";
    getTranscriptProjection.mockImplementation(async () => ({
      taskId, sourceIdentity: task.sourceIdentity, state,
      failureCode: state === "cancelled" ? "V3_MEDIA_CANCELLED" : null,
    }) as MediaTranscriptProjection);
    const root = createRoot(host);
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}`)!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.querySelector("[data-testid='media-product-shell']")?.getAttribute("data-task-id")).toBe(taskId);
    expect(host.textContent).toContain("succeeded");
    state = "cancelled";
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1650)); });
    expect(host.textContent).toContain("V3_MEDIA_CANCELLED");
    expect(host.textContent).not.toContain("已发布的视频大纲");
    const reads = getTranscriptProjection.mock.calls.length;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1650)); });
    expect(getTranscriptProjection).toHaveBeenCalledTimes(reads);
    await act(async () => root.unmount());
  });

  it("shows a cancelled task without a stale published outline", async () => {
    currentTask = { ...task, state: "created", revision: 1, currentOutlineId: null, terminalFailureCode: null };
    const root = createRoot(host);
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}`)!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    currentTask = { ...currentTask, state: "cancelled", revision: 2, terminalFailureCode: "V3_MEDIA_CANCELLED" };
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1650)); });
    expect(host.textContent).toContain("cancelled");
    expect(host.textContent).toContain("V3_MEDIA_CANCELLED");
    expect(host.textContent).not.toContain("已发布的视频大纲");
    await act(async () => root.unmount());
  });

  it("discards a late response from the previous task after navigation", async () => {
    const otherTaskId = `media_task_${"2".repeat(32)}`;
    const otherTask = { ...task, taskId: otherTaskId, revision: 9, sourceIdentity: "portal:bilibili:BV2TEST:1:1" };
    let finishOldRead!: (value: MediaOutlineTask) => void;
    getTask.mockImplementation((id: string) => id === taskId
      ? new Promise<MediaOutlineTask>((resolve) => { finishOldRead = resolve; })
      : Promise.resolve(otherTask));
    const root = createRoot(host);
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}`)!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(getTask).toHaveBeenCalledWith(taskId);
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${otherTaskId}`)!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.querySelector("[data-task-id]")?.getAttribute("data-task-id")).toBe(otherTaskId);
    await act(async () => { finishOldRead(task); await Promise.resolve(); });
    expect(host.querySelector("[data-task-id]")?.getAttribute("data-task-id")).toBe(otherTaskId);
    expect(host.querySelector("[data-task-revision]")?.getAttribute("data-task-revision")).toBe("9");
    await act(async () => root.unmount());
  });

  it("hides task content on disconnect and rereads authority on reconnect", async () => {
    const root = createRoot(host);
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}`)!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.querySelector("[data-task-id]")?.getAttribute("data-task-id")).toBe(taskId);
    const reads = getTask.mock.calls.length;
    autoConnect = false;
    await act(async () => { runtimeChange?.({ status: "disconnected" }); });
    expect(host.textContent).toContain("历史任务内容已暂时隐藏");
    expect(host.querySelector(".media-task-overview")).toBeNull();
    expect(host.querySelector("[data-task-id]")?.getAttribute("data-task-id")).toBe("");
    expect(host.querySelector("[data-testid='media-route-outline']")).toBeNull();
    await act(async () => {
      runtimeChange?.({ status: "connected" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(getTask.mock.calls.length).toBeGreaterThan(reads);
    expect(host.querySelector("[data-task-id]")?.getAttribute("data-task-id")).toBe(taskId);
    await act(async () => root.unmount());
  });

  it("does not present a transient comprehension error as a historical result", async () => {
    currentTask = {
      ...task, state: "ready", terminalFailureCode: null,
      projections: {
        schemaVersion: "v3-media-outline-taskstore/v2",
        task: { taskId, sourceIdentity: task.sourceIdentity, state: "ready", revision: 6, knowledgeImportStatus: "deferred_to_v4" },
        evidenceCatalog: [],
        outline: { outlineId: "outline_retry", taskId, taskRevision: 6, title: "待重试", summary: "摘要", sections: [], contentSha256: "a".repeat(64) },
        timeline: [], mindmap: { projectionId: "mindmap_retry", outlineId: "outline_retry", taskId, contentSha256: "b".repeat(64), nodes: [] }, terminalFailureCode: null,
      },
    };
    getComprehension.mockRejectedValueOnce(new Error("temporary projection failure"));
    const root = createRoot(host);
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}`)!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.textContent).toContain("temporary projection failure");
    expect(host.textContent).not.toContain("该历史任务尚无新版理解投影");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 3150)); });
    expect(getComprehension).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("该历史任务尚无新版理解投影");
    await act(async () => root.unmount());
  });

  it("reads the task library independently of task detail state", async () => {
    const resolution = resolveMediaWorkspaceRoute("#/media/tasks");
    const root = createRoot(host);
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolution!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(listTasks).toHaveBeenCalledOnce();
    expect(host.querySelector(`[data-testid='media-task-row-${taskId}']`)).not.toBeNull();
    expect(host.querySelector("[data-testid='media-product-shell']")?.getAttribute("data-route-kind")).toBe("task_library");
    await act(async () => root.unmount());
  });

  it("labels a retained old-policy task as historical in list and direct detail", async () => {
    currentTask = { ...task, policyContext: { status: "historical", consentPolicyId: "bilibili-media-consent/v1", consentPolicyRevision: 1 } };
    const root = createRoot(host);
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute("#/media/tasks")!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.querySelector(`[data-testid='media-task-row-${taskId}']`)?.textContent).toContain("历史授权结果");
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}`)!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.querySelector("[role='status']")?.textContent).toContain("历史授权结果");
    expect(host.querySelector("[data-testid='media-route-ask']")).toBeNull();
    expect(host.querySelector("[data-testid='media-route-export']")).toBeNull();
    await act(async () => {
      root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}/ask`)!} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.textContent).toContain("历史结果仅供查看");
    expect(host.querySelector("[data-testid='media-ask-submit']")).toBeNull();
    await act(async () => root.unmount());
  });

  it("returns from evidence with Escape and restores the originating link focus", async () => {
    const evidenceId = `mev_${"2".repeat(32)}`;
    currentTask = {
      ...task, state: "ready", terminalFailureCode: null,
      projections: {
        schemaVersion: "v3-media-outline-taskstore/v2",
        task: { taskId, sourceIdentity: task.sourceIdentity, state: "ready", revision: 6, knowledgeImportStatus: "deferred_to_v4" },
        evidenceCatalog: [{ evidenceId, taskId, kind: "transcript", timestampStartMs: 0, timestampEndMs: 1000, contentSha256: "a".repeat(64), relativeArtifactRef: "evidence/0001.json" }],
        outline: { outlineId: "outline_test", taskId, taskRevision: 6, title: "测试", summary: "测试", sections: [{ sectionId: "section_1", title: "开头", summary: "摘要", startMs: 0, endMs: 1000, evidenceIds: [evidenceId] }], contentSha256: "b".repeat(64) },
        timeline: [], mindmap: { projectionId: "mindmap_test", outlineId: "outline_test", taskId, contentSha256: "c".repeat(64), nodes: [] }, terminalFailureCode: null,
      },
    };
    const root = createRoot(host);
    window.location.hash = `#/media/tasks/${taskId}/outline`;
    await act(async () => { root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(window.location.hash)!} />); await Promise.resolve(); await Promise.resolve(); });
    const trigger = host.querySelector<HTMLAnchorElement>(`[data-evidence-return-id='${evidenceId}']`)!;
    await act(async () => { trigger.click(); await Promise.resolve(); });
    expect(sessionStorage.getItem("navia.mediaEvidenceReturn.v1")).toContain(`#/media/tasks/${taskId}/outline`);
    window.location.hash = trigger.hash;
    expect(window.location.hash).toContain(`/evidence/${evidenceId}`);
    await act(async () => { root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(window.location.hash)!} />); await Promise.resolve(); await Promise.resolve(); });
    getTask.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1300));
      return currentTask;
    });
    await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await Promise.resolve(); });
    expect(window.location.hash).toBe(`#/media/tasks/${taskId}/outline`);
    await act(async () => { root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(window.location.hash)!} />); await Promise.resolve(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1450)); });
    expect(host.querySelector(`[data-evidence-return-id='${evidenceId}']`)).not.toBeNull();
    expect(sessionStorage.getItem("navia.mediaEvidenceReturn.v1")).toBeNull();
    expect(document.activeElement?.getAttribute("data-evidence-return-id")).toBe(evidenceId);
    await act(async () => root.unmount());
  });

  it("does not invent an Escape destination for a direct-open evidence route", async () => {
    const evidenceId = `mev_${"3".repeat(32)}`;
    currentTask = {
      ...task, state: "ready", terminalFailureCode: null,
      projections: {
        schemaVersion: "v3-media-outline-taskstore/v2",
        task: { taskId, sourceIdentity: task.sourceIdentity, state: "ready", revision: 6, knowledgeImportStatus: "deferred_to_v4" },
        evidenceCatalog: [{ evidenceId, taskId, kind: "frame", timestampStartMs: 0, timestampEndMs: 1000, contentSha256: "d".repeat(64), relativeArtifactRef: "evidence/0002.json" }],
        outline: { outlineId: "outline_test", taskId, taskRevision: 6, title: "测试", summary: "测试", sections: [], contentSha256: "e".repeat(64) },
        timeline: [], mindmap: { projectionId: "mindmap_test", outlineId: "outline_test", taskId, contentSha256: "f".repeat(64), nodes: [] }, terminalFailureCode: null,
      },
    };
    window.location.hash = `#/media/tasks/${taskId}/evidence/${evidenceId}`;
    const root = createRoot(host);
    await act(async () => { root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(window.location.hash)!} />); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await Promise.resolve(); });
    expect(window.location.hash).toBe(`#/media/tasks/${taskId}/evidence/${evidenceId}`);
    await act(async () => root.unmount());
  });

  it("renders the semantic outline, interactive timeline, and mindmap from one comprehension projection", async () => {
    const evidenceId = `mev_${"4".repeat(32)}`;
    currentTask = {
      ...task, state: "ready", terminalFailureCode: null,
      projections: {
        schemaVersion: "v3-media-outline-taskstore/v2",
        task: { taskId, sourceIdentity: task.sourceIdentity, state: "ready", revision: 6, knowledgeImportStatus: "deferred_to_v4" },
        evidenceCatalog: [{ evidenceId, taskId, kind: "transcript", timestampStartMs: 0, timestampEndMs: 90_000, contentSha256: "a".repeat(64), relativeArtifactRef: "evidence/semantic.json" }],
        outline: { outlineId: "outline_legacy", taskId, taskRevision: 6, title: "旧投影", summary: "旧投影", sections: [], contentSha256: "b".repeat(64) },
        timeline: [], mindmap: { projectionId: "mindmap_legacy", outlineId: "outline_legacy", taskId, contentSha256: "c".repeat(64), nodes: [] }, terminalFailureCode: null,
      },
    };
    const chapterId = "chapter_test0001";
    const projection: MediaComprehensionProjection = {
      schemaVersion: "v3-media-workspace-comprehension-projection/v1",
      task: { taskId, taskRevision: 6, sourceIdentity: task.sourceIdentity, mediaDurationMs: 90_000, outlineId: "outline_semantic" },
      authorization: { groundedTextCloudStatus: "disabled", providerId: null, modelId: null, outboundDerivedTextSha256: null, rawMediaUploadCount: 0 },
      evidenceCatalog: [{ evidenceId, taskId, kind: "transcript", timestampStartMs: 0, timestampEndMs: 90_000, contentSha256: "a".repeat(64), relativeArtifactRef: "evidence/semantic.json", thumbnailAvailable: false, excerpt: "真实语义证据" }],
      outline: { outlineId: "outline_semantic", taskId, taskRevision: 6, title: "真实章节大纲", summary: "从证据派生的结构摘要。", contentSha256: "d".repeat(64), chapters: [{ chapterId, parentChapterId: null, depth: 1, order: 0, startMs: 0, endMs: 90_000, title: "第一章", thesis: "章节论点", keyPoints: ["关键点一"], evidenceIds: [evidenceId], representativeFrameEvidenceId: null }] },
      timeline: { projectionId: "timeline_semantic", outlineId: "outline_semantic", contentSha256: "e".repeat(64), chapterIds: [chapterId], moments: [{ momentId: "moment_test00001", chapterId, timestampMs: 0, kind: "chapter", title: "第一章", evidenceIds: [evidenceId], frameEvidenceId: null }] },
      mindmap: { projectionId: "mindmap_semantic", outlineId: "outline_semantic", contentSha256: "f".repeat(64), nodes: [{ nodeId: "node_root0000001", parentNodeId: null, depth: 0, kind: "root", label: "真实章节大纲", chapterId: null, timestampMs: null, evidenceIds: [] }, { nodeId: "node_chapter0001", parentNodeId: "node_root0000001", depth: 1, kind: "chapter", label: "第一章", chapterId, timestampMs: 0, evidenceIds: [evidenceId] }, { nodeId: "node_point000001", parentNodeId: "node_chapter0001", depth: 2, kind: "key_point", label: "关键点一", chapterId, timestampMs: 0, evidenceIds: [evidenceId] }] },
    };
    getComprehension.mockResolvedValue(projection);
    const root = createRoot(host);
    window.location.hash = `#/media/tasks/${taskId}/outline?chapter=chapter_deadbeefdeadbeef`;

    for (const [route, testId] of [["outline", "media-semantic-outline"], ["timeline", "media-interactive-timeline"], ["mindmap", "media-interactive-mindmap"]] as const) {
      await act(async () => {
        root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}/${route}`)!} />);
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(host.querySelector(`[data-testid='${testId}']`)).not.toBeNull();
      if (route === "outline") {
        expect(host.querySelector(".media-chapter-unavailable")?.textContent).toContain("该章节不属于当前视频任务");
        const recovery = host.querySelector<HTMLAnchorElement>(".media-chapter-unavailable a")!;
        await act(async () => {
          recovery.focus();
          recovery.click();
          window.location.hash = `#/media/tasks/${taskId}/outline`;
          root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(window.location.hash)!} />);
          await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(document.activeElement?.closest(".media-chapter-index")).not.toBeNull();
        expect(host.textContent).toContain("本轮只完成了文字分析");
        for (const [label, layout] of [["知识长文", "article"], ["图文笔记", "note"], ["深度专栏", "column"], ["视频章节", "video"]] as const) {
          const mode = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === label)!;
          await act(async () => mode.click());
          expect(host.querySelector(`[data-outline-layout='${layout}']`)).not.toBeNull();
        }
      }
      if (route === "timeline") expect(host.textContent).toContain("本轮只完成了文字分析");
    }
    expect(host.textContent).toContain("关键点一");
    expect(getComprehension).toHaveBeenCalled();

    expect(host.querySelector("[data-quality-mode='local_extract_only']")?.textContent).toContain("本地提取预览");
    const qualityButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "生成高质量图文大纲")!;
    await act(async () => qualityButton.click());
    expect(host.querySelector("[role='dialog']")?.textContent).toContain("不会发送 Cookie、原始音视频、截图二进制或本地路径");
    const styleSelect = host.querySelector<HTMLSelectElement>("#media-synthesis-style")!;
    expect(styleSelect.value).toBe("structured");
    expect(document.activeElement).toBe(styleSelect);
    const cancel = Array.from(host.querySelectorAll<HTMLButtonElement>("[role='dialog'] button")).find((button) => button.textContent === "取消")!;
    cancel.focus();
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })));
    expect(document.activeElement).toBe(styleSelect);
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })));
    expect(document.activeElement).toBe(cancel);
    await act(async () => cancel.click());
    expect(host.querySelector("[role='dialog']")).toBeNull();
    expect(document.activeElement).toBe(qualityButton);
    await act(async () => qualityButton.click());
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(host.querySelector("[role='dialog']")).toBeNull();
    expect(document.activeElement).toBe(qualityButton);

    const treeItems = Array.from(host.querySelectorAll<HTMLElement>("[role='treeitem']"));
    expect(treeItems.filter((item) => item.tabIndex === 0)).toHaveLength(1);
    await act(async () => treeItems[0].focus());
    await act(async () => treeItems[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(document.activeElement).toBe(treeItems[1]);
    expect(treeItems.filter((item) => item.tabIndex === 0)).toEqual([treeItems[1]]);
    await act(async () => treeItems[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(treeItems[1].getAttribute("aria-expanded")).toBe("false");
    await act(async () => treeItems[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(treeItems[1].getAttribute("aria-expanded")).toBe("true");
    expect(treeItems[1].querySelector("[data-seek-origin='mindmap_node']")).not.toBeNull();
    const chapterToggle = treeItems[1].querySelector<HTMLButtonElement>("button")!;
    await act(async () => chapterToggle.focus());
    await act(async () => chapterToggle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(document.activeElement).toBe(chapterToggle);
    const point = host.querySelector<HTMLElement>("[role='treeitem'][aria-level='3']")!;
    await act(async () => point.focus());
    await act(async () => chapterToggle.click());
    expect(treeItems[1].getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(treeItems[1]);
    expect(host.querySelectorAll("[role='treeitem'][tabindex='0']")).toHaveLength(1);
    await act(async () => treeItems[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    const reopenedPoint = host.querySelector<HTMLElement>("[role='treeitem'][aria-level='3']")!;
    await act(async () => reopenedPoint.focus());
    await act(async () => chapterToggle.focus());
    await act(async () => chapterToggle.click());
    expect(treeItems[1].getAttribute("aria-expanded")).toBe("false");
    expect(treeItems[1].tabIndex).toBe(0);
    expect(document.activeElement).toBe(chapterToggle);
    expect(host.querySelectorAll("[role='treeitem'][tabindex='0']")).toHaveLength(1);
    await act(async () => root.unmount());
  });

  it("places dense timeline moments into non-overlapping deterministic lanes", () => {
    const layout = layoutTimelineMoments([170, 94_782, 189_394, 284_006, 425_361, 566_715, 665_068], 5_985_610);
    expect(layout.widthPx).toBeGreaterThanOrEqual(900);
    expect(layout.positions).toHaveLength(7);
    for (let left = 0; left < layout.positions.length; left += 1) {
      for (let right = left + 1; right < layout.positions.length; right += 1) {
        if (layout.positions[left].lane !== layout.positions[right].lane) continue;
        expect(Math.abs(layout.positions[left].leftPx - layout.positions[right].leftPx)).toBeGreaterThanOrEqual(172);
      }
    }
    expect(layoutTimelineMoments([0, 0, 0, 0], 1_000).positions.map((item) => item.lane)).toEqual([0, 1, 2, 3]);
  });
});
