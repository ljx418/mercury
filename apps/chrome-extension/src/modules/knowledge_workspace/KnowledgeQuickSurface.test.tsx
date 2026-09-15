import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeSource } from "../../runtimeClient";
import { KnowledgeQuickSurface, type QuickWorkspaceRequest } from "./KnowledgeQuickSurface";

const traceReadySource: KnowledgeSource = {
  sourceId: "source_runtime_01",
  workspaceId: "workspace_research",
  sourceType: "web_page",
  title: "Navia PRD",
  status: "trace_ready",
  revision: 1,
  evidenceRefs: [{ locatorType: "text_quote", textQuote: "Stable IDs cross both containers." }],
  createdAt: "2026-09-08T00:00:00.000Z"
};

function props(overrides: Record<string, unknown> = {}) {
  return {
    runtimeStatus: "online" as const,
    pageContext: null,
    serviceStatus: null,
    currentPageSource: traceReadySource,
    selectedSource: traceReadySource,
    operation: null,
    workspaces: [{ workspaceId: "workspace_research", name: "Research", sourceCount: 1, pendingBuildCount: 0, traceCoverage: 1, createdAt: "2026-09-08T00:00:00.000Z" }],
    selectedWorkspaceId: "workspace_research",
    onRefreshStatus: vi.fn(),
    onRefreshSources: vi.fn(),
    onSave: vi.fn(),
    onSelectWorkspace: vi.fn(),
    onOpenWorkspace: vi.fn(),
    ...overrides
  };
}

async function renderSurface(overrides: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const nextProps = props(overrides);
  await act(async () => root.render(<KnowledgeQuickSurface {...nextProps} />));
  return { container, root, nextProps };
}

function click(container: HTMLElement, testId: string) {
  return act(async () => {
    container.querySelector<HTMLButtonElement>(`[data-testid='${testId}']`)?.click();
  });
}

describe("KnowledgeQuickSurface", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("emits the three frozen production entry contracts and Ask route", async () => {
    const { container, root, nextProps } = await renderSurface();
    try {
      for (const testId of ["view-source", "open-workspace", "open-in-workspace", "ask-current-workspace"]) await click(container, testId);
      expect(nextProps.onOpenWorkspace.mock.calls.map(([request]) => request as QuickWorkspaceRequest)).toEqual([
        { origin: "view_source", routeIntent: "source_detail", workspaceId: "workspace_research", sourceId: "source_runtime_01" },
        { origin: "open_workspace", routeIntent: "source_library", workspaceId: "workspace_research" },
        { origin: "open_in_workspace", routeIntent: "source_detail", workspaceId: "workspace_research", sourceId: "source_runtime_01" },
        { origin: "open_in_workspace", routeIntent: "ask", workspaceId: "workspace_research" }
      ]);
    } finally { root.unmount(); }
  });

  it("hides source entry and disables Trace until a source is trace_ready", async () => {
    const building = { ...traceReadySource, status: "building" as const };
    const { container, root } = await renderSurface({ currentPageSource: building, selectedSource: building });
    try {
      expect(container.querySelector("[data-testid='view-source']")).toBeNull();
      expect(container.querySelector<HTMLButtonElement>("[data-testid='toggle-trace']")?.disabled).toBe(true);
    } finally { root.unmount(); }
  });

  it("falls back open-in-workspace to Source Library without a valid source", async () => {
    const { container, root, nextProps } = await renderSurface({ currentPageSource: null, selectedSource: null });
    try {
      await click(container, "open-in-workspace");
      expect(nextProps.onOpenWorkspace).toHaveBeenCalledWith({
        origin: "open_in_workspace",
        routeIntent: "source_library",
        workspaceId: "workspace_research"
      });
    } finally { root.unmount(); }
  });

  it("shows only Runtime-returned EvidenceRef content in the trace disclosure", async () => {
    const { container, root } = await renderSurface();
    try {
      await click(container, "toggle-trace");
      expect(container.querySelector("[data-testid='quick-trace-preview']")?.textContent).toContain("Stable IDs cross both containers.");
      expect(container.querySelector("[data-testid='toggle-trace']")?.getAttribute("aria-expanded")).toBe("true");
    } finally { root.unmount(); }
  });
});
