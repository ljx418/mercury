import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MediaAskResult, MediaOutlineTask } from "../../../runtimeClient";
import { MediaWorkspaceShell } from "./MediaWorkspaceShell";
import { resolveMediaWorkspaceRoute } from "./MediaWorkspaceRouter";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const taskId = `media_task_${"7".repeat(32)}`;
const task: MediaOutlineTask = {
  taskId, sourceIdentity: "portal:bilibili:BV1TEST:1:1", state: "ready", revision: 8,
  createdAt: "2026-10-09T00:00:00Z", updatedAt: "2026-10-09T00:01:00Z",
  knowledgeImportStatus: "deferred_to_v4", terminalFailureCode: null, currentOutlineId: "outline_test",
  projections: {
    schemaVersion: "v3-media-outline-taskstore/v2",
    task: { taskId, sourceIdentity: "portal:bilibili:BV1TEST:1:1", state: "ready", revision: 8, knowledgeImportStatus: "deferred_to_v4" },
    evidenceCatalog: [],
    outline: { outlineId: "outline_test", taskId, taskRevision: 8, title: "测试", summary: "测试", sections: [], contentSha256: "a".repeat(64) },
    timeline: [], mindmap: { projectionId: "mindmap_test", outlineId: "outline_test", taskId, contentSha256: "b".repeat(64), nodes: [] }, terminalFailureCode: null,
  },
};
const stale: MediaAskResult = { answerId: "answer_stale", taskId, taskRevision: 8, question: "旧问题", answer: "旧回答", evidenceIds: ["mev_old"], status: "answered", failureCode: null, createdAt: "2026-10-09T00:01:00Z" };
const fresh: MediaAskResult = { answerId: "answer_fresh", taskId, taskRevision: 8, question: "新问题", answer: "", evidenceIds: [], status: "insufficient_evidence", failureCode: "ASK_EVIDENCE_INSUFFICIENT", createdAt: "2026-10-09T00:02:00Z" };

let resolveHistory: ((value: MediaAskResult[]) => void) | undefined;
const listAsks = vi.fn(() => new Promise<MediaAskResult[]>((resolve) => { resolveHistory = resolve; }));
const ask = vi.fn(async () => fresh);

vi.mock("../../../runtimeClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../runtimeClient")>()),
  getMediaOutlineTask: async () => task,
  listMediaOutlineTaskAsks: () => listAsks(),
  askMediaOutlineTask: () => ask(),
}));
vi.mock("../../knowledge_workspace/LocalRuntimeAccess", () => ({
  LocalRuntimeAccess: ({ onChange }: { onChange: (value: { status: string }) => void }) => {
    queueMicrotask(() => onChange({ status: "connected" }));
    return <div>本机伴侣已连接</div>;
  },
}));

describe("Media Ask async authority", () => {
  afterEach(() => { document.body.replaceChildren(); vi.clearAllMocks(); });

  it("does not let a stale history response overwrite a submitted result", async () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host);
    await act(async () => { root.render(<MediaWorkspaceShell resolution={resolveMediaWorkspaceRoute(`#/media/tasks/${taskId}/ask`)!} />); await Promise.resolve(); await Promise.resolve(); });
    const textarea = host.querySelector<HTMLTextAreaElement>("[data-testid='media-ask-question']")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, "新问题");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { host.querySelector<HTMLButtonElement>("[data-testid='media-ask-submit']")!.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(host.querySelector("[data-testid='media-ask-result']")?.getAttribute("data-ask-status")).toBe("insufficient_evidence");
    expect(host.querySelector("[data-testid='media-ask-result']")?.getAttribute("data-ask-question")).toBe("新问题");
    await act(async () => { resolveHistory?.([stale]); await Promise.resolve(); });
    expect(host.querySelector("[data-testid='media-ask-result']")?.getAttribute("data-ask-status")).toBe("insufficient_evidence");
    await act(async () => root.unmount());
  });
});
