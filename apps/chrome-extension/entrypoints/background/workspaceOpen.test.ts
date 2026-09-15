import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceTabCoordinator, isOpenWorkspaceAction, openOrFocusWorkspace, selectWorkspaceTab, type OpenWorkspaceAction } from "./workspaceOpen";

const action: OpenWorkspaceAction = {
  type: "OPEN_NAVIA_KNOWLEDGE_WORKSPACE",
  requestId: "request_1",
  hostStrategy: "extension_workspace_page",
  origin: "open_workspace",
  routeIntent: "source_library",
  workspaceId: "workspace_research",
  reusePolicy: "focus_existing_or_create"
};

describe("openOrFocusWorkspace", () => {
  const originalChrome = globalThis.chrome;

  afterEach(() => {
    globalThis.chrome = originalChrome;
    vi.restoreAllMocks();
  });

  it("creates an extension-origin workspace tab when none exists", async () => {
    const create = vi.fn(async () => ({ id: 42 }));
    globalThis.chrome = {
      runtime: { getURL: (path: string) => `chrome-extension://navia/${path}` },
      tabs: { query: vi.fn(async () => []), create }
    } as unknown as typeof chrome;

    await expect(openOrFocusWorkspace(action)).resolves.toEqual({
      requestId: "request_1",
      hostStrategy: "extension_workspace_page",
      outcome: "created_new",
      tabId: 42,
      workspaceUrl: "chrome-extension://navia/workspace.html#/knowledge/sources?workspaceId=workspace_research"
    });
    expect(create).toHaveBeenCalledWith({
      active: true,
      url: "chrome-extension://navia/workspace.html#/knowledge/sources?workspaceId=workspace_research"
    });
  });

  it("focuses and reuses the existing workspace tab", async () => {
    const update = vi.fn(async () => ({ id: 42 }));
    const windowUpdate = vi.fn(async () => ({}));
    globalThis.chrome = {
      runtime: { getURL: (path: string) => `chrome-extension://navia/${path}` },
      tabs: { query: vi.fn(async () => [{ id: 42, windowId: 7 }]), update, create: vi.fn() },
      windows: { update: windowUpdate }
    } as unknown as typeof chrome;

    const result = await openOrFocusWorkspace(action);
    expect(result.outcome).toBe("focused_existing");
    expect(result.tabId).toBe(42);
    expect(update).toHaveBeenCalledWith(42, expect.objectContaining({ active: true }));
    expect(windowUpdate).toHaveBeenCalledWith(7, { focused: true });
  });

  it("rejects action and route combinations outside the frozen contract", async () => {
    const invalid = { ...action, routeIntent: "graph" as const };
    expect(isOpenWorkspaceAction(invalid)).toBe(false);
    await expect(openOrFocusWorkspace(invalid)).resolves.toEqual({
      requestId: "request_1",
      hostStrategy: "extension_workspace_page",
      outcome: "recoverable_error",
      errorCode: "INVALID_ROUTE"
    });
  });

  it("serializes concurrent requests and creates one workspace tab", async () => {
    const tabs: chrome.tabs.Tab[] = [];
    const create = vi.fn(async ({ url }: chrome.tabs.CreateProperties) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const tab = { id: 42, windowId: 7, url } as chrome.tabs.Tab;
      tabs.push(tab);
      return tab;
    });
    const query = vi.fn(async () => [...tabs]);
    const update = vi.fn(async (tabId: number, properties: chrome.tabs.UpdateProperties) => ({
      ...tabs.find((tab) => tab.id === tabId),
      ...properties,
      id: tabId
    }) as chrome.tabs.Tab);
    const coordinator = createWorkspaceTabCoordinator(() => ({
      runtime: { getURL: (path: string) => `chrome-extension://navia/${path}` } as typeof chrome.runtime,
      tabs: { query, create, update } as unknown as typeof chrome.tabs,
      windows: { update: vi.fn(async () => ({})) } as unknown as typeof chrome.windows
    }));

    const results = await Promise.all(Array.from({ length: 8 }, (_, index) => coordinator.open({
      ...action,
      requestId: `request_${index}`
    })));

    expect(create).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(8);
    expect(results.filter((result) => result.outcome === "created_new")).toHaveLength(1);
    expect(results.filter((result) => result.outcome === "focused_existing")).toHaveLength(7);
    expect(new Set(results.map((result) => result.tabId))).toEqual(new Set([42]));
  });

  it("continues processing after a queued Chrome operation fails", async () => {
    let queryCalls = 0;
    const coordinator = createWorkspaceTabCoordinator(() => ({
      runtime: { getURL: (path: string) => `chrome-extension://navia/${path}` } as typeof chrome.runtime,
      tabs: {
        query: vi.fn(async () => {
          queryCalls += 1;
          if (queryCalls === 1) throw new Error("transient query failure");
          return [];
        }),
        create: vi.fn(async () => ({ id: 77 })),
        update: vi.fn()
      } as unknown as typeof chrome.tabs,
      windows: { update: vi.fn() } as unknown as typeof chrome.windows
    }));

    const first = coordinator.open({ ...action, requestId: "request_failed" });
    const second = coordinator.open({ ...action, requestId: "request_recovered" });
    await expect(first).resolves.toMatchObject({ outcome: "recoverable_error", errorCode: "OPEN_WORKSPACE_FAILED" });
    await expect(second).resolves.toMatchObject({ outcome: "created_new", tabId: 77 });
  });

  it("prefers sender window, then focused window, then the lowest tab ID", () => {
    const tabs = [
      { id: 30, windowId: 3 },
      { id: 20, windowId: 2 },
      { id: 10, windowId: 1 }
    ] as chrome.tabs.Tab[];
    expect(selectWorkspaceTab(tabs, 3, 2)?.id).toBe(30);
    expect(selectWorkspaceTab(tabs, 9, 2)?.id).toBe(20);
    expect(selectWorkspaceTab(tabs, 9, 8)?.id).toBe(10);
  });

  it("reuses a tab after coordinator recreation and creates after the tab is closed", async () => {
    const tabs: chrome.tabs.Tab[] = [{ id: 42, windowId: 7, url: "chrome-extension://navia/workspace.html" } as chrome.tabs.Tab];
    const api = {
      runtime: { getURL: (path: string) => `chrome-extension://navia/${path}` } as typeof chrome.runtime,
      tabs: {
        query: vi.fn(async () => [...tabs]),
        update: vi.fn(async (tabId: number) => tabs.find((tab) => tab.id === tabId) as chrome.tabs.Tab),
        create: vi.fn(async ({ url }: chrome.tabs.CreateProperties) => {
          const tab = { id: 77, windowId: 7, url } as chrome.tabs.Tab;
          tabs.push(tab);
          return tab;
        })
      } as unknown as typeof chrome.tabs,
      windows: {
        getLastFocused: vi.fn(async () => ({ id: 7 } as chrome.windows.Window)),
        update: vi.fn(async () => ({}))
      } as unknown as typeof chrome.windows
    };
    const restartedCoordinator = createWorkspaceTabCoordinator(() => api);
    await expect(restartedCoordinator.open(action, { senderWindowId: 7 })).resolves.toMatchObject({ outcome: "focused_existing", tabId: 42 });
    tabs.splice(0, tabs.length);
    await expect(restartedCoordinator.open({ ...action, requestId: "after_close" }, { senderWindowId: 7 })).resolves.toMatchObject({ outcome: "created_new", tabId: 77 });
  });
});
