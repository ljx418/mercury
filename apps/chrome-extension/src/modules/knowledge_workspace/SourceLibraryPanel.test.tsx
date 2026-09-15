import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeSource, KnowledgeWorkspace } from "../../runtimeClient";
import { SourceLibraryPanel } from "./SourceLibraryPanel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const workspace: KnowledgeWorkspace = {
  workspaceId: "workspace_research",
  name: "Research",
  sourceCount: 2,
  pendingBuildCount: 1,
  traceCoverage: 0.5,
  createdAt: "2026-09-11T00:00:00Z",
};

const sources: KnowledgeSource[] = [
  {
    sourceId: "source_runtime_ready",
    operationId: "operation_runtime_ready",
    workspaceId: workspace.workspaceId,
    sourceType: "web_page",
    title: "Navia architecture",
    originUrl: "https://example.test/architecture",
    status: "trace_ready",
    revision: 1,
    evidenceRefs: [],
    createdAt: "2026-09-11T00:00:00Z",
  },
  {
    sourceId: "source_runtime_building",
    operationId: "operation_runtime_building",
    workspaceId: workspace.workspaceId,
    sourceType: "authorized_local_document",
    title: "Acceptance plan",
    status: "building",
    revision: 1,
    evidenceRefs: [],
    createdAt: "2026-09-11T00:00:01Z",
  },
];

async function mount(onSelectSource = vi.fn()) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(
    <SourceLibraryPanel workspace={workspace} sources={sources} onSelectSource={onSelectSource} />,
  ));
  return { container, onSelectSource, root };
}

async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("SourceLibraryPanel", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("renders the Runtime workspace summary and selects by stable source ID", async () => {
    const mounted = await mount();
    expect(mounted.container.textContent).toContain("Research");
    expect(mounted.container.textContent).toContain("1 pending · trace 50%");
    const row = mounted.container.querySelector("[data-testid='source-row-source_runtime_ready']") as HTMLButtonElement;
    await act(async () => row.click());
    expect(mounted.onSelectSource).toHaveBeenCalledWith("source_runtime_ready");
    await act(async () => mounted.root.unmount());
  });

  it("searches title, origin URL, and source ID without changing source facts", async () => {
    const mounted = await mount();
    const input = mounted.container.querySelector("input[aria-label='搜索来源']") as HTMLInputElement;
    for (const query of ["architecture", "example.test", "source_runtime_ready"]) {
      await change(input, query);
      expect(mounted.container.querySelectorAll("[data-testid^='source-row-']")).toHaveLength(1);
      expect(mounted.container.textContent).toContain("Navia architecture");
    }
    expect(sources).toHaveLength(2);
    await act(async () => mounted.root.unmount());
  });

  it("filters by canonical build status and presents an explicit empty state", async () => {
    const mounted = await mount();
    const select = mounted.container.querySelector("select") as HTMLSelectElement;
    await change(select, "building");
    expect(mounted.container.textContent).toContain("Acceptance plan");
    expect(mounted.container.textContent).not.toContain("Navia architecture");
    await change(select, "failed");
    expect(mounted.container.textContent).toContain("没有符合当前筛选条件的来源。");
    expect(mounted.container.textContent).toContain("0/2 sources");
    await act(async () => mounted.root.unmount());
  });
});
