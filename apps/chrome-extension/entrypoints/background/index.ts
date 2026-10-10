import { isOpenWorkspaceAction, openOrFocusWorkspace } from "./workspaceOpen";
import {
  BilibiliCredentialEnvelopeBroker,
  MediaConsentPolicyStore,
  PORTAL_CREDENTIAL_MESSAGE_TYPE,
  PORTAL_SESSION_MESSAGE_TYPE,
  PortalPermissionClient,
  PortalCredentialMessageRouter,
  PortalSessionBroker,
  PortalSessionMessageRouter,
  isCredentialTransportPath,
  createBrowserSessionBinding,
  createBilibiliBrowserSessionRegistry
} from "../../src/modules/media_companion/session";
import {
  MEDIA_CAPTURE_OFFSCREEN_MESSAGE_TYPE,
  MEDIA_CAPTURE_MESSAGE_TYPE,
  MediaCaptureController,
  MediaCaptureMessageRouter
} from "../../src/modules/media_companion/capture";
import { resolveMediaPortalAdapter } from "../../src/modules/media_companion/MediaPortalRegistry";

const RUNTIME_URL = "http://127.0.0.1:17861";
const CONTENT_SCRIPT_FILE = "content-scripts/content.js";
const INJECTABLE_PROTOCOLS = new Set(["http:", "https:"]);

declare const __NAVIA_E2E_BRIDGE__: boolean;

let e2eSidePanelPort: chrome.runtime.Port | null = null;
let e2eNativeSidePanelPort: chrome.runtime.Port | null = null;
const e2eR2ObservationQueue: Array<Record<string, unknown>> = [];
const e2eR2RuntimeObservationKeys = new Set<string>();
let e2eR2PendingWorkspaceAction: Record<string, unknown> | null = null;
let e2eMediaSessionCookieReadCount = 0;
let e2eMediaCredentialCookieReadCount = 0;
let e2eRuntimeMessageReceivedCount = 0;
let mediaCookieChangeListenerRegistered = false;
let e2eMediaCredentialLastFailure: { stage: string; errorName: string; elapsedMs?: number; channelRemainingMs?: number } | null = null;

const mediaSessionRegistry = createBilibiliBrowserSessionRegistry(
  __NAVIA_E2E_BRIDGE__ ? () => { e2eMediaSessionCookieReadCount += 1; } : undefined
);
const mediaPermissionClient = new PortalPermissionClient({
  registry: mediaSessionRegistry,
  permissionsApi: chrome.permissions
});
const mediaConsentPolicyStore = new MediaConsentPolicyStore({
  registry: mediaSessionRegistry,
  storage: {
    get: (key) => chrome.storage.local.get(key),
    set: (items) => chrome.storage.local.set(items)
  }
});
const mediaSessionBroker = new PortalSessionBroker({
  registry: mediaSessionRegistry,
  policyReader: mediaConsentPolicyStore,
  permissionReader: mediaPermissionClient
});
const mediaSessionMessageRouter = new PortalSessionMessageRouter({
  runtimeId: chrome.runtime.id,
  extensionBaseUrl: chrome.runtime.getURL(""),
  policyStore: mediaConsentPolicyStore,
  permissionClient: mediaPermissionClient,
  broker: mediaSessionBroker
});
const getMediaBrowserSessionBindingSha256 = createBrowserSessionBinding();
const bilibiliCredentialEnvelopeBroker = new BilibiliCredentialEnvelopeBroker({
  policyReader: mediaConsentPolicyStore,
  permissionReader: mediaPermissionClient,
  cookieApi: {
    getAll: (details) => {
      if (__NAVIA_E2E_BRIDGE__) e2eMediaCredentialCookieReadCount += 1;
      return chrome.cookies.getAll(details);
    }
  },
  onUnexpectedFailure: __NAVIA_E2E_BRIDGE__
    ? (diagnostic) => { e2eMediaCredentialLastFailure = diagnostic; }
    : undefined
});
const mediaCredentialMessageRouter = new PortalCredentialMessageRouter({
  runtimeId: chrome.runtime.id,
  extensionBaseUrl: chrome.runtime.getURL(""),
  isTrustedEmbeddedTabUrl: (url) => resolveMediaPortalAdapter(url) !== null,
  getBrowserSessionBindingSha256: getMediaBrowserSessionBindingSha256,
  exchange: (message) => bilibiliCredentialEnvelopeBroker.exchange(message),
  revokeLease: (leaseId) => bilibiliCredentialEnvelopeBroker.revokeLease(leaseId)
});
const mediaCaptureController = new MediaCaptureController({
  queryTargetTab: async (surface) => {
    if (surface === "side_panel") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab ?? null;
    }
    const candidates = (await chrome.tabs.query({ currentWindow: true }))
      .filter((tab) => tab.url?.startsWith("https://www.bilibili.com/video/"));
    return candidates.length === 1 ? candidates[0] : null;
  },
  hasPermission: () => chrome.permissions.contains({ permissions: ["tabCapture", "offscreen"] }),
  getMediaStreamId: (targetTabId) => chrome.tabCapture.getMediaStreamId({ targetTabId }),
  ensureOffscreenDocument: async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (!await chrome.offscreen.hasDocument()) {
        await chrome.offscreen.createDocument({
          url: "media-capture-offscreen.html",
          reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.AUDIO_PLAYBACK],
          justification: "Capture the user-selected current tab audio for local-only transcription while preserving playback."
        }).catch(() => undefined);
      }
      try {
        const response = await chrome.runtime.sendMessage({
          type: MEDIA_CAPTURE_OFFSCREEN_MESSAGE_TYPE,
          command: "ping"
        });
        if (response?.ok === true && response?.state === "ready") return;
      } catch {
        // The prior document can still report as present while Chrome closes it.
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("offscreen document did not become ready");
  },
  sendOffscreenMessage: (message) => chrome.runtime.sendMessage(message),
  closeOffscreenDocument: async () => {
    if (await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument();
  },
  digest: async (value) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
    .map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  reportDiagnostic: (diagnostic) => { globalThis.__naviaMediaCaptureLastDiagnostic = diagnostic; }
});
const mediaCaptureMessageRouter = new MediaCaptureMessageRouter(
  chrome.runtime.id,
  chrome.runtime.getURL(""),
  mediaCaptureController,
  (url) => resolveMediaPortalAdapter(url) !== null
);

declare global {
  var __naviaMediaCaptureLastDiagnostic: { stage: string; errorName: string; message: string } | undefined;
  var __naviaActionInvocationCount: number | undefined;
  var __naviaE2EExecuteSidePanelCommand:
    | ((command: unknown) => Promise<unknown>)
    | undefined;
  var __naviaE2ENativeSidePanelOpen:
    | { ok: boolean; tabId: number; windowId: number; observedAt: string; error?: string }
    | undefined;
  var __naviaE2EDrainR2Observations:
    | (() => Array<Record<string, unknown>>)
    | undefined;
  var __naviaE2EMediaSessionDiagnostics:
    | (() => {
      cookieReadCount: number;
      credentialCookieReadCount: number;
      credentialRevocationHandleCount: number;
      credentialRevocationAttemptCount: number;
      credentialRevocationSucceededCount: number;
      credentialRevocationFailedCount: number;
      runtimeMessageReceivedCount: number;
      credentialLastFailure: { stage: string; errorName: string; elapsedMs?: number; channelRemainingMs?: number } | null;
    })
    | undefined;
}

export default defineBackground(() => {
  void configureSidePanel();
  ensureMediaCookieChangeListener();
  if (__NAVIA_E2E_BRIDGE__) {
    globalThis.__naviaE2EExecuteSidePanelCommand = executeSidePanelE2ECommand;
    globalThis.__naviaE2EDrainR2Observations = () => e2eR2ObservationQueue.splice(0);
    globalThis.__naviaE2EMediaSessionDiagnostics = () => {
      const revocation = bilibiliCredentialEnvelopeBroker.revocationDiagnostics();
      return {
        cookieReadCount: e2eMediaSessionCookieReadCount,
        credentialCookieReadCount: e2eMediaCredentialCookieReadCount,
        credentialRevocationHandleCount: revocation.handleCount,
        credentialRevocationAttemptCount: revocation.attemptCount,
        credentialRevocationSucceededCount: revocation.succeededCount,
        credentialRevocationFailedCount: revocation.failedCount,
        runtimeMessageReceivedCount: e2eRuntimeMessageReceivedCount,
        credentialLastFailure: e2eMediaCredentialLastFailure
      };
    };
  }

  chrome.runtime.onInstalled.addListener(() => {
    void configureSidePanel();
  });

  chrome.runtime.onStartup?.addListener(() => {
    void configureSidePanel();
  });

  chrome.permissions.onRemoved.addListener((permissions) => {
    if (bilibiliCredentialEnvelopeBroker.isRelevantPermissionRemoval(permissions)) {
      void bilibiliCredentialEnvelopeBroker.revokeAll();
    }
  });

  chrome.permissions.onAdded.addListener(() => ensureMediaCookieChangeListener());

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    ensureMediaCookieChangeListener();
    if (__NAVIA_E2E_BRIDGE__) e2eRuntimeMessageReceivedCount += 1;
    if (__NAVIA_E2E_BRIDGE__ && message?.type === "navia.e2e.ping") {
      sendResponse({ ok: true, received: true });
      return false;
    }
    if (message?.type === MEDIA_CAPTURE_MESSAGE_TYPE) {
      void mediaCaptureMessageRouter.handle(message, {
        id: sender.id,
        url: sender.url,
        hasTab: sender.tab !== undefined,
        tabUrl: sender.tab?.url
      }).then(sendResponse);
      return true;
    }
    if (message?.type === PORTAL_CREDENTIAL_MESSAGE_TYPE) {
      void mediaCredentialMessageRouter.handle(message, {
        id: sender.id,
        url: sender.url,
        hasTab: sender.tab !== undefined,
        tabUrl: sender.tab?.url
      }).then(sendResponse);
      return true;
    }
    if (message?.type === PORTAL_SESSION_MESSAGE_TYPE) {
      void mediaSessionMessageRouter.handle(message, {
        id: sender.id,
        url: sender.url,
        hasTab: sender.tab !== undefined
      }).then(async (response) => {
        if (message.command === "revoke_policy" && response.ok) {
          await bilibiliCredentialEnvelopeBroker.revokeAll();
        }
        sendResponse(response);
      });
      return true;
    }
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
    globalThis.__naviaActionInvocationCount = (globalThis.__naviaActionInvocationCount ?? 0) + 1;
    if (mediaCaptureController.hasArmedCapture()) await mediaCaptureController.startArmed(tab);
    await openSidePanelForTab(tab);
  });

  chrome.tabs.onRemoved.addListener(() => {
    if (mediaCaptureController.activeGrantId()) {
      void mediaCaptureController.stop({ type: MEDIA_CAPTURE_MESSAGE_TYPE, command: "stop", reason: "tab_closed" });
    }
  });

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (mediaCaptureController.activeGrantId() && (changeInfo.status === "loading" || typeof changeInfo.url === "string")) {
      void mediaCaptureController.stop({ type: MEDIA_CAPTURE_MESSAGE_TYPE, command: "stop", reason: "navigation" });
    }
  });

  chrome.commands?.onCommand.addListener((command) => {
    if (command !== "open-navia-sidepanel") return;
    globalThis.__naviaActionInvocationCount = (globalThis.__naviaActionInvocationCount ?? 0) + 1;
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
      const tab = tabs[0];
      if (!tab) return;
      if (mediaCaptureController.hasArmedCapture()) await mediaCaptureController.startArmed(tab);
      await openSidePanelForTab(tab);
    });
  });
});

function ensureMediaCookieChangeListener() {
  if (mediaCookieChangeListenerRegistered || !chrome.cookies?.onChanged) return;
  chrome.cookies.onChanged.addListener((change) => {
    if (bilibiliCredentialEnvelopeBroker.isRelevantCookieChange(change.cookie)) {
      void bilibiliCredentialEnvelopeBroker.revokeAll();
    }
  });
  mediaCookieChangeListenerRegistered = true;
}

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
  // Keep action clicks observable so an armed tab-capture request can consume
  // Chrome's user activation before the side panel is opened.
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
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
    // Route A only injects ordinary pages after an action/command user gesture.
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
  if (isCredentialTransportPath(request.path) || request.path.startsWith("/v1/media/capture-")) {
    throw new Error("V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED");
  }
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
    if (isCredentialTransportPath(request.path) || request.path.startsWith("/v1/media/capture-")) {
      throw new Error("V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED");
    }
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
