import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeGraph, KnowledgeSource } from "../../runtimeClient";
import { AskWithSourcesPanel } from "./AskWithSourcesPanel";
import { EvidenceTraceDrawer } from "./EvidenceTraceDrawer";
import { ForgetSourceDialog } from "./ForgetSourceDialog";
import { KnowledgeGraphCanvas } from "./KnowledgeGraphCanvas";
import { SourceDetailReader } from "./SourceDetailReader";

const source: KnowledgeSource = {
  sourceId: "source_runtime_01",
  operationId: "operation_runtime_01",
  workspaceId: "workspace_research",
  sourceType: "web_page",
  title: "Navia PRD",
  status: "trace_ready",
  revision: 1,
  evidenceRefs: [{ evidenceRefId: "evidence_01", locatorType: "fallback_text", textQuote: "Runtime evidence", status: "fallback_shown" }],
  createdAt: "2026-09-08T00:00:00Z"
};

async function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { container, root };
}

describe("Workspace product components", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("keeps Trace content bound to Runtime EvidenceRef values", async () => {
    const onClose = vi.fn();
    const { container, root } = await mount(<EvidenceTraceDrawer source={source} open onClose={onClose} />);
    expect(container.textContent).toContain("Runtime evidence");
    expect(container.textContent).toContain("fallback_shown");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(onClose).toHaveBeenCalledOnce();
    root.unmount();
  });

  it("requires the exact confirmation before Forget", async () => {
    const onConfirm = vi.fn();
    const { container, root } = await mount(<ForgetSourceDialog source={source} open loading={false} error={null} result={null} onCancel={vi.fn()} onConfirm={onConfirm} />);
    const button = [...container.querySelectorAll("button")].find((item) => item.textContent === "确认遗忘") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const input = container.querySelector("input") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "forget");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    expect(onConfirm).toHaveBeenCalledOnce();
    root.unmount();
  });

  it("shows an incomplete Forget result as a failure", async () => {
    const result = {
      forgetRequest: {},
      verification: {
        verificationId: "verification_01",
        forgetRequestId: "forget_01",
        sourceId: source.sourceId,
        libraryAbsent: true,
        askAbsent: true,
        graphAbsent: false,
        traceAbsent: true,
        verifiedAt: "2026-09-10T00:00:00Z"
      },
      operation: {
        operationId: "operation_forget_01",
        operationType: "forget",
        status: "succeeded" as const,
        sourceId: source.sourceId,
        workspaceId: source.workspaceId,
        createdAt: "2026-09-10T00:00:00Z"
      }
    };
    const { container, root } = await mount(<ForgetSourceDialog source={source} open loading={false} error={null} result={result} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(container.querySelector("[role='alert']")?.textContent).toBe("遗忘未完成");
    root.unmount();
  });

  it("exposes source commands and stable IDs without synthesizing facts", async () => {
    const onTrace = vi.fn();
    const onForget = vi.fn();
    const { container, root } = await mount(<SourceDetailReader source={source} onBack={vi.fn()} onOpenTrace={onTrace} onForget={onForget} />);
    expect(container.textContent).toContain("source_runtime_01");
    expect(container.textContent).toContain("operation_runtime_01");
    await act(async () => [...container.querySelectorAll("button")].find((item) => item.textContent === "查看 Trace")?.click());
    expect(onTrace).toHaveBeenCalledOnce();
    root.unmount();
  });

  it("selects graph nodes but never mutates the Runtime graph", async () => {
    const graph: KnowledgeGraph = { workspaceId: "workspace_research", nodes: [{ id: "node_runtime_01", label: "Runtime node", type: "source" }], edges: [], status: "ready" };
    const { container, root } = await mount(<KnowledgeGraphCanvas graph={graph} onRefresh={vi.fn()} />);
    const node = container.querySelector(".graph-node") as HTMLButtonElement;
    await act(async () => node.click());
    expect(node.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("node_runtime_01");
    expect(graph.nodes).toHaveLength(1);
    root.unmount();
  });

  it("does not label evidence-free answers as source-backed", async () => {
    const { container, root } = await mount(<AskWithSourcesPanel loading={false} error={null} onAsk={vi.fn()} result={{ workspaceId: "workspace_research", question: "q", answer: "degraded", status: "source_supported", evidenceRefs: [] }} />);
    expect(container.querySelector("[data-testid='knowledge-answer']")?.textContent).toContain("Degraded answer");
    root.unmount();
  });
});
