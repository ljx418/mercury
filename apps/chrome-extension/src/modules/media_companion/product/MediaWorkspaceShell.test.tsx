import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaComprehensionProjection, MediaOutlineTask } from "../../../runtimeClient";
import { MediaWorkspaceShell } from "./MediaWorkspaceShell";
import { resolveMediaWorkspaceRoute } from "./MediaWorkspaceRouter";
import { layoutTimelineMoments } from "./ComprehensionViews";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
const getComprehension = vi.fn<() => Promise<MediaComprehensionProjection>>();

vi.mock("../../../runtimeClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../runtimeClient")>()),
  getMediaOutlineTask: (id: string) => getTask(id),
  listMediaOutlineTasks: () => listTasks(),
  getMediaWorkspaceComprehension: () => getComprehension(),
}));

vi.mock("../../knowledge_workspace/LocalRuntimeAccess", () => ({
  LocalRuntimeAccess: ({ onChange }: { onChange: (change: { status: string }) => void }) => {
    queueMicrotask(() => onChange({ status: "connected" }));
    return <div data-testid="runtime-connected">本机伴侣已连接</div>;
  },
}));

describe("MediaWorkspaceShell", () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    getTask.mockClear();
    listTasks.mockClear();
    getComprehension.mockReset();
    getComprehension.mockRejectedValue(new Error("legacy task"));
    currentTask = task;
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
    await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await Promise.resolve(); });
    expect(window.location.hash).toBe(`#/media/tasks/${taskId}/outline`);
    await act(async () => { root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(window.location.hash)!} />); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 220)); });
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

    for (const [route, testId] of [["outline", "media-semantic-outline"], ["timeline", "media-interactive-timeline"], ["mindmap", "media-interactive-mindmap"]] as const) {
      await act(async () => {
        root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}/${route}`)!} />);
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(host.querySelector(`[data-testid='${testId}']`)).not.toBeNull();
    }
    expect(host.textContent).toContain("关键点一");
    expect(getComprehension).toHaveBeenCalled();

    const treeItems = Array.from(host.querySelectorAll<HTMLElement>("[role='treeitem']"));
    treeItems[0].focus();
    await act(async () => treeItems[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(document.activeElement).toBe(treeItems[1]);
    await act(async () => treeItems[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(treeItems[1].getAttribute("aria-expanded")).toBe("false");
    await act(async () => treeItems[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(treeItems[1].getAttribute("aria-expanded")).toBe("true");
    expect(treeItems[1].querySelector("[data-seek-origin='mindmap_node']")).not.toBeNull();
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
