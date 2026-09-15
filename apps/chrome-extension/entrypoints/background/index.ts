import { isOpenWorkspaceAction, openOrFocusWorkspace } from "./workspaceOpen";

const RUNTIME_URL = "http://127.0.0.1:17861";
const CONTENT_SCRIPT_FILE = "content-scripts/content.js";
const INJECTABLE_PROTOCOLS = new Set(["http:", "https:"]);

declare const __NAVIA_E2E_BRIDGE__: boolean;

let e2eSidePanelPort: chrome.runtime.Port | null = null;
let e2eNativeSidePanelPort: chrome.runtime.Port | null = null;
const e2eR2ObservationQueue: Array<Record<string, unknown>> = [];
const e2eR2RuntimeObservationKeys = new Set<string>();
let e2eR2PendingWorkspaceAction: Record<string, unknown> | null = null;

declare global {
  var __naviaE2EExecuteSidePanelCommand:
    | ((command: unknown) => Promise<unknown>)
    | undefined;
  var __naviaE2ENativeSidePanelOpen:
    | { ok: boolean; tabId: number; windowId: number; observedAt: string; error?: string }
    | undefined;
  var __naviaE2EDrainR2Observations:
    | (() => Array<Record<string, unknown>>)
    | undefined;
}

export default defineBackground(() => {
  void configureSidePanel();
  if (__NAVIA_E2E_BRIDGE__) {
    globalThis.__naviaE2EExecuteSidePanelCommand = executeSidePanelE2ECommand;
    globalThis.__naviaE2EDrainR2Observations = () => e2eR2ObservationQueue.splice(0);
  }

  chrome.runtime.onInstalled.addListener(() => {
    void configureSidePanel();
  });

  chrome.runtime.onStartup?.addListener(() => {
    void configureSidePanel();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;
    void ensureContentBridgeForTab(tabId, tab.url);
  });

  chrome.tabs.onActivated.addListener((activeInfo) => {
    void chrome.tabs.get(activeInfo.tabId).then((tab) => ensureContentBridgeForTab(activeInfo.tabId, tab.url));
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (__NAVIA_E2E_BRIDGE__ && message?.type === "navia.e2e.sidepanel.exec") {
      void executeSidePanelE2ECommand(message.command)
        .then((response) => sendResponse(response))
        .catch((error) =>
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "E2E side panel bridge failed"
          })
        );
      return true;
    }
    if (__NAVIA_E2E_BRIDGE__ && message?.type === "navia.e2e.r2.runtime_observation") {
      const observation = message.observation as Record<string, unknown> | undefined;
      const observationKey = `${String(observation?.phase ?? "unknown")}:${String(observation?.requestId ?? "missing")}`;
      if (!e2eR2RuntimeObservationKeys.has(observationKey)) {
        e2eR2RuntimeObservationKeys.add(observationKey);
        recordR2Observation({
          kind: "runtime_transport",
          senderUrl: sender.url ?? sender.tab?.url ?? null,
          observation
        });
      }
      sendResponse({ ok: true, observationKey });
      return false;
    }
    if (isOpenWorkspaceAction(message)) {
      const actionObservation = consumeR2WorkspaceAction(message.origin);
      recordR2Observation({
        kind: "background_request",
        actionId: actionObservation?.actionId ?? null,
        requestId: message.requestId,
        senderUrl: sender.url ?? sender.tab?.url ?? null,
        message
      });
      void openOrFocusWorkspace(message, { senderWindowId: sender.tab?.windowId })
        .then((response) => {
          recordR2Observation({
            kind: "background_response",
            actionId: actionObservation?.actionId ?? null,
            requestId: message.requestId,
            response
          });
          sendResponse(response);
        })
        .catch(() => {
          const response = {
            requestId: message.requestId,
            hostStrategy: "extension_workspace_page",
            outcome: "recoverable_error",
            errorCode: "OPEN_WORKSPACE_FAILED"
          };
          recordR2Observation({
            kind: "background_response",
            actionId: actionObservation?.actionId ?? null,
            requestId: message.requestId,
            response
          });
          sendResponse(response);
        });
      return true;
    }
    if (message?.type !== "navia.runtimeFetch") return false;
    void proxyRuntimeFetch(message.request)
      .then((response) => sendResponse({ ok: true, response }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Runtime proxy failed"
        })
      );
    return true;
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (__NAVIA_E2E_BRIDGE__ && port.name === "navia.e2e.sidepanel") {
      e2eSidePanelPort = port;
      if (!port.sender?.url?.includes("naviaInPage=1")) e2eNativeSidePanelPort = port;
      port.onDisconnect.addListener(() => {
        if (e2eSidePanelPort === port) e2eSidePanelPort = null;
        if (e2eNativeSidePanelPort === port) e2eNativeSidePanelPort = null;
      });
      port.onMessage.addListener((message) => {
        if (!isR2DomActionObservation(message)) return;
        e2eR2PendingWorkspaceAction = message;
        recordR2Observation({ kind: "dom_action", ...message });
      });
      return;
    }
    if (port.name !== "navia.runtimeStream") return;
    port.onMessage.addListener((message) => {
      if (message?.type !== "navia.runtimeStream") return;
      void proxyRuntimeStream(message.request, port);
    });
  });

  chrome.action.onClicked.addListener(async (tab) => {
    await openSidePanelForTab(tab);
  });

  chrome.commands?.onCommand.addListener((command) => {
    if (command !== "open-navia-sidepanel") return;
    void chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) return openSidePanelForTab(tabs[0]);
    });
  });
});

function recordR2Observation(observation: Record<string, unknown>) {
  if (!__NAVIA_E2E_BRIDGE__) return;
  e2eR2ObservationQueue.push({
    ...observation,
    backgroundObservedAt: new Date().toISOString(),
    backgroundMonotonicMs: performance.now()
  });
}

function isR2DomActionObservation(value: unknown): value is Record<string, unknown> & { actionId: string; origin: string } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.type === "navia.e2e.r2.dom_action"
    && record.isTrusted === true
    && typeof record.actionId === "string"
    && typeof record.origin === "string";
}

function consumeR2WorkspaceAction(origin: string): (Record<string, unknown> & { actionId: string }) | null {
  const pending = e2eR2PendingWorkspaceAction;
  e2eR2PendingWorkspaceAction = null;
  if (!pending || pending.origin !== origin || typeof pending.actionId !== "string") return null;
  return pending as Record<string, unknown> & { actionId: string };
}

async function configureSidePanel(tabId?: number) {
  if (!chrome.sidePanel) return;
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  if (tabId !== undefined) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: __NAVIA_E2E_BRIDGE__ ? `sidepanel.html?naviaE2ETabId=${tabId}` : "sidepanel.html",
      enabled: true
    });
  }
}

async function openSidePanelForTab(tab: chrome.tabs.Tab) {
  if (tab.windowId === undefined || tab.id === undefined || !chrome.sidePanel?.open) return;
  await ensureContentBridgeForTab(tab.id, tab.url);
  await configureSidePanel(tab.id);
  try {
    await chrome.sidePanel.open({ tabId: tab.id, windowId: tab.windowId });
    if (__NAVIA_E2E_BRIDGE__) {
      globalThis.__naviaE2ENativeSidePanelOpen = {
        ok: true,
        tabId: tab.id,
        windowId: tab.windowId,
        observedAt: new Date().toISOString()
      };
    }
  } catch (error) {
    if (__NAVIA_E2E_BRIDGE__) {
      globalThis.__naviaE2ENativeSidePanelOpen = {
        ok: false,
        tabId: tab.id,
        windowId: tab.windowId,
        observedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
    throw error;
  }
}

async function ensureContentBridgeForTab(tabId: number, url?: string) {
  if (!chrome.scripting?.executeScript || !isInjectableUrl(url)) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_FILE]
    });
  } catch {
    // Some browser-owned, restricted, discarded, or transient tabs reject script injection.
    // Static content scripts still cover normal pages when Chrome registers them correctly.
  }
}

function isInjectableUrl(url?: string) {
  if (!url) return false;
  try {
    return INJECTABLE_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

function executeSidePanelE2ECommand(command: unknown): Promise<unknown> {
  const port = e2eNativeSidePanelPort ?? e2eSidePanelPort;
  if (!port) {
    return Promise.resolve({ ok: false, error: "E2E Side Panel bridge is not connected." });
  }
  const commandId = crypto.randomUUID();
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ ok: false, commandId, error: "E2E Side Panel bridge timed out." });
    }, 60_000);
    const cleanup = () => {
      clearTimeout(timeout);
      port.onMessage.removeListener(onMessage);
    };
    const onMessage = (message: unknown) => {
      if (!isE2EResponse(message) || message.commandId !== commandId) return;
      cleanup();
      resolve(message);
    };
    port.onMessage.addListener(onMessage);
    port.postMessage({
      type: "navia.e2e.command",
      commandId,
      command
    });
  });
}

function isE2EResponse(value: unknown): value is { type: string; commandId: string } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.type === "navia.e2e.response" && typeof record.commandId === "string";
}

type RuntimeProxyRequest = {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

async function proxyRuntimeFetch(request: RuntimeProxyRequest) {
  const response = await fetch(`${RUNTIME_URL}${request.path}`, {
    method: request.method ?? "GET",
    headers: request.headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body)
  });
  return {
    status: response.status,
    ok: response.ok,
    body: await response.json()
  };
}

async function proxyRuntimeStream(request: RuntimeProxyRequest, port: chrome.runtime.Port) {
  try {
    const response = await fetch(`${RUNTIME_URL}${request.path}`, {
      method: request.method ?? "POST",
      headers: request.headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body)
    });
    if (!response.body) throw new Error("SSE response body is empty.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      port.postMessage({ type: "chunk", text: decoder.decode(value, { stream: true }) });
    }
    port.postMessage({ type: "done" });
  } catch (error) {
    port.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Runtime stream proxy failed"
    });
  }
}
