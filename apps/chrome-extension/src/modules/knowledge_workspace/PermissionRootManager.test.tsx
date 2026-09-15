import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionRoot } from "../../runtimeClient";

const { scanKnowledgePermission, importKnowledgeFiles } = vi.hoisted(() => ({
  scanKnowledgePermission: vi.fn(),
  importKnowledgeFiles: vi.fn()
}));

vi.mock("../../runtimeClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../runtimeClient")>()),
  scanKnowledgePermission,
  importKnowledgeFiles
}));

import { PermissionRootManager } from "./PermissionRootManager";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const permissions: PermissionRoot[] = ["root_a", "root_b"].map((permissionRootId) => ({
  workspaceId: "ws_default",
  permissionRootId,
  displayName: permissionRootId,
  redactedPath: `/safe/${permissionRootId}`,
  state: "granted",
  scope: "directory",
  createdAt: "2026-09-10T00:00:00Z"
}));

async function mount(props: Partial<React.ComponentProps<typeof PermissionRootManager>> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const baseProps: React.ComponentProps<typeof PermissionRootManager> = {
    workspaceId: "ws_default",
    permissions,
    loading: false,
    error: null,
    sessionGeneration: 1,
    onGrant: vi.fn(async () => undefined),
    onRevoke: vi.fn(async () => undefined),
    onImported: vi.fn()
  };
  const render = async (next: Partial<typeof baseProps> = {}) => act(async () => root.render(<PermissionRootManager {...baseProps} {...props} {...next} />));
  await render();
  return { container, root, render, props: { ...baseProps, ...props } };
}

describe("PermissionRootManager", () => {
  beforeEach(() => {
    scanKnowledgePermission.mockImplementation(async (permissionRootId: string) => ({
      scanId: `scan_${permissionRootId}`,
      workspaceId: "ws_default",
      permissionRootId,
      files: [{ fileId: `file_${permissionRootId}`, displayName: `${permissionRootId}.md`, sizeBytes: 10, sha256: "a".repeat(64) }]
    }));
    importKnowledgeFiles.mockResolvedValue({
      sources: [{ sourceId: "source_imported" }],
      operations: [],
      idempotentReplay: false
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("rejects relative and Windows paths before calling Runtime", async () => {
    const onGrant = vi.fn(async () => undefined);
    const mounted = await mount({ onGrant });
    const inputs = mounted.container.querySelectorAll("input");
    const pathInput = inputs[1] as HTMLInputElement;
    for (const invalidPath of ["relative/file.md", "C:\\private\\file.md"]) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(pathInput, invalidPath);
        pathInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => (mounted.container.querySelector(".permission-form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
      expect(mounted.container.textContent).toContain("请输入 Runtime POSIX 绝对路径");
    }
    expect(onGrant).not.toHaveBeenCalled();
    await act(async () => mounted.root.unmount());
  });

  it("keeps one active root and clears transient state on switch, revoke, and session change", async () => {
    const onRevoke = vi.fn(async () => undefined);
    const mounted = await mount({ onRevoke });
    const scanButtons = () => [...mounted.container.querySelectorAll("button")].filter((button) => button.textContent === "扫描") as HTMLButtonElement[];

    await act(async () => { scanButtons()[0].click(); await Promise.resolve(); });
    expect(mounted.container.textContent).toContain("root_a.md");
    await act(async () => { scanButtons()[1].click(); await Promise.resolve(); });
    expect(mounted.container.textContent).not.toContain("root_a.md");
    expect(mounted.container.textContent).toContain("root_b.md");

    const revokeButtons = [...mounted.container.querySelectorAll("button")].filter((button) => button.textContent === "撤销") as HTMLButtonElement[];
    await act(async () => { revokeButtons[1].click(); await Promise.resolve(); });
    expect(onRevoke).toHaveBeenCalledWith("root_b");
    expect(mounted.container.querySelector("fieldset")).toBeNull();

    await act(async () => { scanButtons()[0].click(); await Promise.resolve(); });
    expect(mounted.container.querySelector("fieldset")).not.toBeNull();
    await mounted.render({ sessionGeneration: 2 });
    expect(mounted.container.querySelector("fieldset")).toBeNull();
    await act(async () => mounted.root.unmount());
  });
});
