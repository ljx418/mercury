import { buildWorkspaceHash, type WorkspaceRouteIntent } from "../../src/modules/knowledge_workspace/workspaceRoutes";

export type OpenWorkspaceAction = {
  type: "OPEN_NAVIA_KNOWLEDGE_WORKSPACE";
  requestId: string;
  hostStrategy: "extension_workspace_page";
  origin: "view_source" | "open_workspace" | "open_in_workspace";
  routeIntent: WorkspaceRouteIntent;
  workspaceId: string;
  sourceId?: string;
  operationId?: string;
  reusePolicy: "focus_existing_or_create";
};

export type WorkspaceOpenResult = {
  requestId: string;
  hostStrategy: "extension_workspace_page";
  outcome: "focused_existing" | "created_new" | "recoverable_error" | "blocked";
  tabId?: number;
  workspaceUrl?: string;
  errorCode?: "INVALID_ROUTE" | "OPEN_WORKSPACE_FAILED" | "UNSUPPORTED_HOST_STRATEGY";
};

export function isOpenWorkspaceAction(value: unknown): value is OpenWorkspaceAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<OpenWorkspaceAction>;
  if (
    action.type !== "OPEN_NAVIA_KNOWLEDGE_WORKSPACE" ||
    action.hostStrategy !== "extension_workspace_page" ||
    action.reusePolicy !== "focus_existing_or_create" ||
    typeof action.requestId !== "string" || !action.requestId ||
    typeof action.workspaceId !== "string" || !action.workspaceId ||
    !["view_source", "open_workspace", "open_in_workspace"].includes(String(action.origin)) ||
    !["source_library", "source_detail", "ask", "graph", "permissions"].includes(String(action.routeIntent))
  ) return false;
  if (action.origin === "open_workspace" && (action.routeIntent !== "source_library" || action.sourceId !== undefined)) return false;
  if ((action.origin === "view_source" || action.routeIntent === "source_detail") && !action.sourceId) return false;
  if (action.routeIntent === "source_library" && action.sourceId !== undefined) return false;
  return true;
}

type WorkspaceChromeApi = Pick<typeof chrome, "runtime" | "tabs" | "windows">;

export type WorkspaceOpenContext = {
  senderWindowId?: number;
};

export function createWorkspaceTabCoordinator(getChrome: () => WorkspaceChromeApi = () => chrome) {
  let queue: Promise<void> = Promise.resolve();

  const open = (action: unknown, context: WorkspaceOpenContext = {}): Promise<WorkspaceOpenResult> => {
    if (!isOpenWorkspaceAction(action)) return Promise.resolve(invalidActionResult(action));
    const task = queue.then(() => performOpenOrFocus(action, context, getChrome()));
    queue = task.then(() => undefined, () => undefined);
    return task;
  };

  return { open };
}

function invalidActionResult(action: unknown): WorkspaceOpenResult {
  const requestId = action && typeof action === "object" && typeof (action as { requestId?: unknown }).requestId === "string"
    ? String((action as { requestId: string }).requestId)
    : "invalid_request";
  return {
    requestId,
    hostStrategy: "extension_workspace_page",
    outcome: "recoverable_error",
    errorCode: "INVALID_ROUTE"
  };
}

async function performOpenOrFocus(
  action: OpenWorkspaceAction,
  context: WorkspaceOpenContext,
  chromeApi: WorkspaceChromeApi
): Promise<WorkspaceOpenResult> {
  try {
    const entrypointUrl = chromeApi.runtime.getURL("workspace.html");
    const workspaceUrl = `${entrypointUrl}${buildWorkspaceHash(action)}`;
    const existingTabs = (await chromeApi.tabs.query({ url: `${entrypointUrl}*` }))
      .filter((tab) => tab.id !== undefined);
    const focusedWindowId = await getFocusedWindowId(chromeApi);
    const existing = selectWorkspaceTab(existingTabs, context.senderWindowId, focusedWindowId);
    if (existing?.id !== undefined) {
      await chromeApi.tabs.update(existing.id, { active: true, url: workspaceUrl });
      if (existing.windowId !== undefined && chromeApi.windows?.update) {
        await chromeApi.windows.update(existing.windowId, { focused: true });
      }
      return {
        requestId: action.requestId,
        hostStrategy: "extension_workspace_page",
        outcome: "focused_existing",
        tabId: existing.id,
        workspaceUrl
      };
    }
    const created = await chromeApi.tabs.create({
      active: true,
      url: workspaceUrl,
      ...(context.senderWindowId !== undefined ? { windowId: context.senderWindowId } : {})
    });
    if (created.id === undefined) throw new Error("Chrome did not return the created Workspace tab ID.");
    return {
      requestId: action.requestId,
      hostStrategy: "extension_workspace_page",
      outcome: "created_new",
      tabId: created.id,
      workspaceUrl
    };
  } catch {
    return {
      requestId: action.requestId,
      hostStrategy: "extension_workspace_page",
      outcome: "recoverable_error",
      errorCode: "OPEN_WORKSPACE_FAILED"
    };
  }
}

export function selectWorkspaceTab(
  tabs: chrome.tabs.Tab[],
  senderWindowId?: number,
  focusedWindowId?: number
): chrome.tabs.Tab | undefined {
  return [...tabs].sort((left, right) => {
    const leftRank = windowRank(left.windowId, senderWindowId, focusedWindowId);
    const rightRank = windowRank(right.windowId, senderWindowId, focusedWindowId);
    return leftRank - rightRank || (left.id ?? Number.MAX_SAFE_INTEGER) - (right.id ?? Number.MAX_SAFE_INTEGER);
  })[0];
}

function windowRank(windowId: number | undefined, senderWindowId?: number, focusedWindowId?: number) {
  if (senderWindowId !== undefined && windowId === senderWindowId) return 0;
  if (focusedWindowId !== undefined && windowId === focusedWindowId) return 1;
  return 2;
}

async function getFocusedWindowId(chromeApi: WorkspaceChromeApi): Promise<number | undefined> {
  if (!chromeApi.windows?.getLastFocused) return undefined;
  try {
    return (await chromeApi.windows.getLastFocused()).id;
  } catch {
    return undefined;
  }
}

const workspaceTabCoordinator = createWorkspaceTabCoordinator();

export function openOrFocusWorkspace(action: unknown, context: WorkspaceOpenContext = {}): Promise<WorkspaceOpenResult> {
  return workspaceTabCoordinator.open(action, context);
}
