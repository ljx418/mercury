import { extractPageContext, type ExtractedPageContext } from "./pageContext";
import {
  collectMediaPageContext,
  readMediaPlayback,
  resolveMediaPortalAdapter,
  seekMediaPlayback,
  type MediaBridgeResponse,
  type MediaCollectionFailureCode,
  type MediaPageContext,
  type MediaPlaybackSnapshot
} from "./modules/media_companion";

export const PAGE_CONTEXT_MESSAGE_TYPE = "navia.extractPageContext";
export const JUMPBACK_MESSAGE_TYPE = "navia.jumpToSource";
export const MEDIA_COLLECT_CONTEXT_MESSAGE_TYPE = "navia.media.collectPageContext";
export const MEDIA_READ_PLAYBACK_MESSAGE_TYPE = "navia.media.readPlayback";
export const MEDIA_SEEK_MESSAGE_TYPE = "navia.media.seek";
export const LEGACY_INJECTED_HOST_ID = ["navia", "injected", "host"].join("-");
export const IN_PAGE_SIDEBAR_HOST_ID = ["navia", "inpage", "sidebar"].join("-");
export const IN_PAGE_LAUNCHER_ID = ["navia", "floating", "launcher"].join("-");
const IN_PAGE_INTERACTION_STYLE_ID = ["navia", "inpage", "interaction", "style"].join("-");
const JUMPBACK_STYLE_ID = ["navia", "jumpback", "style"].join("-");
const JUMPBACK_MARKER_ID = ["navia", "jumpback", "marker"].join("-");
const IN_PAGE_SIDEBAR_DEFAULT_WIDTH = 440;
const IN_PAGE_SIDEBAR_MIN_WIDTH = 360;
const IN_PAGE_SIDEBAR_MAX_VIEWPORT_RATIO = 0.8;
const IN_PAGE_SIDEBAR_OVERLAY_RATIO = 0.52;
const IN_PAGE_NARROW_OVERLAY_WIDTH = 900;
const IN_PAGE_SIDEBAR_INSET = 12;
const LAUNCHER_DEFAULT_TOP = 0.9;
const LAUNCHER_VISIBLE_SIZE = 54;
const LAUNCHER_COLLAPSED_PEEK = 18;
const SIDEBAR_STATE_STORAGE_KEY = "navia.inpageSidebarState";
const SIDEBAR_DEFAULT_MODE: SidebarMode = "collapsed";
const CONTENT_BRIDGE_READY_ATTRIBUTE = "data-navia-content-bridge-ready";
const CONTENT_BRIDGE_MODE_ATTRIBUTE = "data-navia-content-bridge-mode";
const pendingSidebarReadyDocuments = new WeakSet<Document>();

type SidebarMode = "expanded" | "collapsed";
type SidebarLayoutMode = "push" | "overlay";
type LauncherSide = "left" | "right";
export type ContentBridgeMode = "portal_auto" | "bridge_only";

type SidebarInteractionState = {
  mode: SidebarMode;
  layoutMode: SidebarLayoutMode;
  width: number;
  launcherTopRatio: number;
  launcherSide: LauncherSide;
};

type PageContextBridgeResponse =
  | { ok: true; context: ExtractedPageContext }
  | { ok: false; error: string };

type JumpbackStrategy = "selector" | "domPath" | "href" | "textQuote";

type JumpbackRequest = {
  nodeId?: string;
  nodeSourceMapKey?: string;
  selector?: string;
  domPath?: string;
  href?: string;
  textQuote?: string;
  fallbackText?: string;
};

type JumpbackResult = {
  status: "highlighted" | "fallback_shown" | "blocked";
  attemptedStrategies: JumpbackStrategy[];
  matchedStrategy?: JumpbackStrategy;
  highlightedText?: string;
  markerVisible?: boolean;
  fallbackText?: string;
  failureReason?: string;
};

type ContentBridgeResponse =
  | PageContextBridgeResponse
  | { ok: true; result: JumpbackResult }
  | MediaBridgeResponse<MediaPageContext>
  | MediaBridgeResponse<MediaPlaybackSnapshot>
  | { ok: false; error: string };

type SendResponse = (response: ContentBridgeResponse) => void;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "页面上下文读取失败。";
}

export function initializeContentBridge(
  documentRef: Document,
  href: string,
  options: { mode?: ContentBridgeMode } = {}
): void {
  const mode = options.mode ?? "portal_auto";
  if (documentRef.documentElement?.getAttribute(CONTENT_BRIDGE_READY_ATTRIBUTE) === "true") {
    if (mode === "portal_auto") {
      documentRef.documentElement?.setAttribute(CONTENT_BRIDGE_MODE_ATTRIBUTE, mode);
      ensureInPageSidebarWhenReady(documentRef);
    }
    return;
  }
  documentRef.documentElement?.setAttribute(CONTENT_BRIDGE_READY_ATTRIBUTE, "true");
  documentRef.documentElement?.setAttribute(CONTENT_BRIDGE_MODE_ATTRIBUTE, mode);
  cleanupLegacyInjectedPanel(documentRef);
  if (mode === "portal_auto") ensureInPageSidebarWhenReady(documentRef);
  chrome.runtime.onMessage.addListener(createPageContextMessageHandler(documentRef, href));
}

function ensureInPageSidebarWhenReady(documentRef: Document): void {
  if (ensureInPageSidebar(documentRef)) return;
  if (pendingSidebarReadyDocuments.has(documentRef)) return;
  pendingSidebarReadyDocuments.add(documentRef);

  let observer: MutationObserver | null = null;
  let timeoutId: number | null = null;
  const cleanup = () => {
    pendingSidebarReadyDocuments.delete(documentRef);
    documentRef.removeEventListener("DOMContentLoaded", retry);
    observer?.disconnect();
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  };
  const retry = () => {
    if (ensureInPageSidebar(documentRef)) cleanup();
  };

  documentRef.addEventListener("DOMContentLoaded", retry, { once: true });
  if (documentRef.documentElement) {
    observer = new MutationObserver(retry);
    observer.observe(documentRef.documentElement, { childList: true, subtree: true });
  }
  window.setTimeout(retry, 0);
  timeoutId = window.setTimeout(cleanup, 30_000);
}

export function cleanupLegacyInjectedPanel(documentRef: Document = document): void {
  documentRef.getElementById(LEGACY_INJECTED_HOST_ID)?.remove();
}

export function ensureInPageSidebar(documentRef: Document = document): HTMLElement | null {
  if (!documentRef.body || !documentRef.documentElement) return null;
  ensureInPageInteractionStyles(documentRef);
  const existing = documentRef.getElementById(IN_PAGE_SIDEBAR_HOST_ID);
  if (existing instanceof HTMLElement) {
    ensureFloatingLauncher(documentRef, existing);
    applyInPageSidebarLayout(documentRef, existing, readSidebarState(documentRef));
    return existing;
  }

  const host = documentRef.createElement("aside");
  host.id = IN_PAGE_SIDEBAR_HOST_ID;
  host.setAttribute("data-testid", "navia-inpage-sidebar");
  host.setAttribute("aria-label", "Navia in-page sidebar");
  host.dataset.naviaMode = SIDEBAR_DEFAULT_MODE;
  Object.assign(host.style, {
    position: "fixed",
    top: `${IN_PAGE_SIDEBAR_INSET}px`,
    right: `${IN_PAGE_SIDEBAR_INSET}px`,
    bottom: `${IN_PAGE_SIDEBAR_INSET}px`,
    width: `${IN_PAGE_SIDEBAR_DEFAULT_WIDTH}px`,
    maxWidth: `${Math.round(IN_PAGE_SIDEBAR_MAX_VIEWPORT_RATIO * 100)}vw`,
    minWidth: `${IN_PAGE_SIDEBAR_MIN_WIDTH}px`,
    zIndex: "2147483647",
    border: "1px solid rgba(209, 232, 228, 0.82)",
    borderRadius: "26px",
    boxShadow: "-22px 0 62px rgba(5, 84, 75, 0.16), -6px 0 18px rgba(4, 24, 21, 0.07), inset 1px 0 0 rgba(255,255,255,0.66)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(245,251,249,0.7))",
    backdropFilter: "blur(28px) saturate(160%)",
    WebkitBackdropFilter: "blur(28px) saturate(160%)",
    overflow: "visible",
    transition: "transform 360ms cubic-bezier(0.16, 1, 0.3, 1), width 260ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms ease, opacity 220ms ease",
    willChange: "transform,width"
  });

  const resizeHandle = documentRef.createElement("div");
  resizeHandle.setAttribute("data-testid", "navia-inpage-sidebar-resize-handle");
  resizeHandle.setAttribute("aria-hidden", "true");
  Object.assign(resizeHandle.style, {
    position: "absolute",
    top: "0",
    left: "-9px",
    width: "18px",
    height: "100%",
    cursor: "ew-resize",
    zIndex: "5",
    borderRadius: "12px",
    background: "transparent",
    opacity: "0"
  });
  host.append(resizeHandle);

  const frame = documentRef.createElement("iframe");
  frame.title = "Navia";
  frame.setAttribute("data-testid", "navia-inpage-sidebar-frame");
  frame.src = chrome.runtime.getURL("sidepanel.html?naviaInPage=1");
  Object.assign(frame.style, {
    width: "100%",
    height: "100%",
    border: "0",
    display: "block",
    background: "#fff",
    borderRadius: "25px",
    overflow: "hidden"
  });
  host.append(frame);
  documentRef.body.append(host);
  const state = { ...readSidebarState(documentRef), mode: SIDEBAR_DEFAULT_MODE };
  ensureFloatingLauncher(documentRef, host);
  bindSidebarInteractions(documentRef, host, resizeHandle);
  applyInPageSidebarLayout(documentRef, host, state);
  return host;
}

function ensureInPageInteractionStyles(documentRef: Document): void {
  if (documentRef.getElementById(IN_PAGE_INTERACTION_STYLE_ID)) return;
  const style = documentRef.createElement("style");
  style.id = IN_PAGE_INTERACTION_STYLE_ID;
  style.textContent = `
    #${IN_PAGE_LAUNCHER_ID} {
      transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      transform: var(--navia-launcher-transform, scale(1));
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    #${IN_PAGE_LAUNCHER_ID}:hover {
      transform: var(--navia-launcher-peek-transform, var(--navia-launcher-transform, scale(1))) scale(1.06) translateY(-2px);
      border-color: #05544b !important;
      background: rgba(255, 255, 255, 0.93) !important;
      opacity: 1 !important;
      box-shadow: 0 22px 48px rgba(5, 84, 75, 0.18), 0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9) !important;
    }
    #${IN_PAGE_LAUNCHER_ID}:active {
      transform: var(--navia-launcher-transform, scale(1)) scale(0.95);
      cursor: grabbing;
    }
    #${IN_PAGE_LAUNCHER_ID}:focus {
      outline: none;
    }
    #${IN_PAGE_LAUNCHER_ID}:focus-visible {
      border-color: #05544b !important;
      background: rgba(255, 255, 255, 0.96) !important;
      opacity: 1 !important;
      transform: var(--navia-launcher-peek-transform, var(--navia-launcher-transform, scale(1))) scale(1.05);
      box-shadow: 0 0 0 4px rgba(5, 84, 75, 0.13), 0 22px 48px rgba(5, 84, 75, 0.18), 0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.92) !important;
    }
    #${IN_PAGE_LAUNCHER_ID}:hover [data-navia-launcher-svg="true"] {
      transform: rotate(15deg) scale(1.05);
    }
    #${IN_PAGE_LAUNCHER_ID}[data-navia-mode="collapsed"] {
      filter: saturate(0.96);
    }
    #${IN_PAGE_LAUNCHER_ID}[data-navia-mode="collapsed"]:hover,
    #${IN_PAGE_LAUNCHER_ID}[data-navia-mode="collapsed"]:focus-visible {
      transform: var(--navia-launcher-peek-transform, translateX(0)) scale(1.04) translateY(-2px);
      opacity: 1 !important;
    }
    #${IN_PAGE_SIDEBAR_HOST_ID} [data-testid="navia-inpage-sidebar-resize-handle"] {
      transition: opacity 0.18s ease, background 0.18s ease;
    }
    #${IN_PAGE_SIDEBAR_HOST_ID} [data-testid="navia-inpage-sidebar-resize-handle"]:hover {
      opacity: 1 !important;
      background: linear-gradient(90deg, transparent 0 7px, rgba(5, 84, 75, 0.38) 7px 10px, transparent 10px 18px) !important;
      filter: drop-shadow(0 0 10px rgba(5, 84, 75, 0.2));
    }
    #${IN_PAGE_SIDEBAR_HOST_ID}::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 26px;
      pointer-events: none;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.82), inset 1px 0 0 rgba(255,255,255,0.52);
      z-index: 1;
    }
  `;
  documentRef.head?.append(style);
}

function ensureFloatingLauncher(documentRef: Document, host: HTMLElement): HTMLButtonElement | null {
  if (!documentRef.body || !documentRef.documentElement) return null;
  const existing = documentRef.getElementById(IN_PAGE_LAUNCHER_ID);
  if (existing instanceof HTMLButtonElement) return existing;
  const launcher = documentRef.createElement("button");
  launcher.id = IN_PAGE_LAUNCHER_ID;
  launcher.type = "button";
  launcher.setAttribute("data-testid", "navia-floating-launcher");
  launcher.setAttribute("aria-label", "打开 Navia 阅读助手");
  launcher.innerHTML = `
    <svg data-navia-launcher-svg="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
      <path d="M5 12a7 7 0 1 1 14 0c0 1.25-.33 2.42-.9 3.44M12 3v2.5M12 18v3" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M12 7.5l1.2 3.3 3.3 1.2-3.3 1.2-1.2 3.3-1.2-3.3-3.3-1.2 3.3-1.2 1.2-3.3z" fill="currentColor" stroke="none"></path>
    </svg>
    <span data-navia-launcher-dot="true"></span>
  `;
  Object.assign(launcher.style, {
    position: "fixed",
    width: `${LAUNCHER_VISIBLE_SIZE}px`,
    height: `${LAUNCHER_VISIBLE_SIZE}px`,
    border: "1.5px solid rgba(137, 184, 176, 0.78)",
    borderRadius: "17px",
    background: "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(241,248,246,0.92))",
    color: "#013a33",
    boxShadow: "0 18px 38px rgba(5, 84, 75, 0.13), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.92)",
    backdropFilter: "blur(18px) saturate(150%)",
    WebkitBackdropFilter: "blur(18px) saturate(150%)",
    cursor: "grab",
    zIndex: "2147483646",
    padding: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  });
  const svg = launcher.querySelector<SVGElement>("[data-navia-launcher-svg='true']");
  if (svg) Object.assign(svg.style, { width: "25px", height: "25px", transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)" });
  const dot = launcher.querySelector<HTMLElement>("[data-navia-launcher-dot='true']");
  if (dot) {
    Object.assign(dot.style, {
      position: "absolute",
      right: "-3px",
      top: "-3px",
      width: "13px",
      height: "13px",
      borderRadius: "999px",
      background: "#2f7b58",
      border: "4px solid #fff",
      boxShadow: "0 4px 12px rgba(28, 94, 55, 0.3)"
    });
  }
  launcher.addEventListener("click", () => {
    if (launcher.dataset.naviaDragging === "true") return;
    const next = readSidebarState(documentRef);
    next.mode = next.mode === "expanded" ? "collapsed" : "expanded";
    writeSidebarState(documentRef, next);
    applyInPageSidebarLayout(documentRef, host, next);
  });
  bindLauncherDrag(documentRef, host, launcher);
  documentRef.body.append(launcher);
  return launcher;
}

function bindSidebarInteractions(documentRef: Document, host: HTMLElement, resizeHandle: HTMLElement): void {
  if (host.dataset.naviaInteractionsBound === "true") return;
  host.dataset.naviaInteractionsBound = "true";

  resizeHandle.addEventListener("pointerdown", (event) => {
    const view = documentRef.defaultView;
    if (!view) return;
    event.preventDefault();
    resizeHandle.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const start = readSidebarState(documentRef);
    const startWidth = start.width;
    const onMove = (moveEvent: PointerEvent) => {
      const next = { ...readSidebarState(documentRef), mode: "expanded" as SidebarMode };
      next.width = clampSidebarWidth(documentRef, startWidth + (startX - moveEvent.clientX));
      next.layoutMode = resolveLayoutMode(documentRef, next.width);
      writeSidebarState(documentRef, next);
      applyInPageSidebarLayout(documentRef, host, next);
    };
    const onUp = () => {
      view.removeEventListener("pointermove", onMove);
      view.removeEventListener("pointerup", onUp);
    };
    view.addEventListener("pointermove", onMove);
    view.addEventListener("pointerup", onUp, { once: true });
  });

  documentRef.defaultView?.addEventListener("resize", () => {
    const next = readSidebarState(documentRef);
    next.width = clampSidebarWidth(documentRef, next.width);
    next.layoutMode = resolveLayoutMode(documentRef, next.width);
    writeSidebarState(documentRef, next);
    applyInPageSidebarLayout(documentRef, host, next);
  });
}

function bindLauncherDrag(documentRef: Document, host: HTMLElement, launcher: HTMLButtonElement): void {
  launcher.addEventListener("pointerdown", (event) => {
    const view = documentRef.defaultView;
    if (!view) return;
    launcher.setPointerCapture?.(event.pointerId);
    launcher.style.cursor = "grabbing";
    const startX = event.clientX;
    const startY = event.clientY;
    const state = readSidebarState(documentRef);
    const startTop = launcherTopPx(documentRef, state);
    let dragged = false;
    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 5) dragged = true;
      const next = readSidebarState(documentRef);
      next.launcherTopRatio = clampLauncherTopRatio(documentRef, startTop + dy);
      next.launcherSide = moveEvent.clientX < view.innerWidth / 2 ? "left" : "right";
      writeSidebarState(documentRef, next);
      applyInPageSidebarLayout(documentRef, host, next);
    };
    const onUp = () => {
      launcher.dataset.naviaDragging = dragged ? "true" : "false";
      launcher.style.cursor = "grab";
      launcher.releasePointerCapture?.(event.pointerId);
      launcher.removeEventListener("pointermove", onMove);
      launcher.removeEventListener("pointerup", onUp);
      view.removeEventListener("pointermove", onMove);
      view.removeEventListener("pointerup", onUp);
      view.setTimeout(() => {
        launcher.dataset.naviaDragging = "false";
      }, 0);
    };
    launcher.addEventListener("pointermove", onMove);
    launcher.addEventListener("pointerup", onUp, { once: true });
    view.addEventListener("pointermove", onMove);
    view.addEventListener("pointerup", onUp, { once: true });
  });
}

function applyInPageSidebarLayout(documentRef: Document, host: HTMLElement, state: SidebarInteractionState): void {
  const width = clampSidebarWidth(documentRef, state.width);
  const layoutMode = resolveLayoutMode(documentRef, width);
  const mode = state.mode;
  const nextState = { ...state, width, layoutMode };
  writeSidebarState(documentRef, nextState);
  documentRef.documentElement.style.setProperty("--navia-inpage-sidebar-width", `${width}px`);
  host.dataset.naviaMode = mode;
  host.dataset.naviaLayout = layoutMode;
  host.style.width = `${width}px`;
  host.style.transform = mode === "collapsed" ? `translateX(${width + IN_PAGE_SIDEBAR_INSET * 2}px)` : "translateX(0)";
  host.style.opacity = mode === "collapsed" ? "0" : "1";
  host.style.boxShadow = mode === "collapsed" ? "none" : "-22px 0 62px rgba(5, 84, 75, 0.16), -6px 0 18px rgba(4, 24, 21, 0.07), inset 1px 0 0 rgba(255,255,255,0.66)";
  host.style.pointerEvents = mode === "collapsed" ? "none" : "auto";
  const frame = host.querySelector<HTMLIFrameElement>("[data-testid='navia-inpage-sidebar-frame']");
  if (frame) frame.tabIndex = mode === "collapsed" ? -1 : 0;
  const launcher = documentRef.getElementById(IN_PAGE_LAUNCHER_ID);
  if (launcher instanceof HTMLElement) {
    const top = launcherTopPx(documentRef, nextState);
    launcher.style.top = `${top}px`;
    launcher.dataset.naviaMode = mode;
    launcher.dataset.naviaSide = nextState.launcherSide;
    if (nextState.launcherSide === "left") {
      launcher.style.left = mode === "collapsed" ? `-${LAUNCHER_VISIBLE_SIZE - LAUNCHER_COLLAPSED_PEEK}px` : `${IN_PAGE_SIDEBAR_INSET + 12}px`;
      launcher.style.right = "";
      launcher.style.setProperty("--navia-launcher-transform", "scale(1)");
      launcher.style.setProperty(
        "--navia-launcher-peek-transform",
        mode === "collapsed" ? `translateX(${LAUNCHER_VISIBLE_SIZE - LAUNCHER_COLLAPSED_PEEK}px)` : "translateX(0px)"
      );
    } else {
      launcher.style.left = "";
      const rightWhenExpanded = mode === "expanded" ? width + IN_PAGE_SIDEBAR_INSET + 34 : -(LAUNCHER_VISIBLE_SIZE - LAUNCHER_COLLAPSED_PEEK);
      launcher.style.right = `${rightWhenExpanded}px`;
      launcher.style.setProperty("--navia-launcher-transform", "scale(1)");
      launcher.style.setProperty(
        "--navia-launcher-peek-transform",
        mode === "collapsed" ? `translateX(-${LAUNCHER_VISIBLE_SIZE - LAUNCHER_COLLAPSED_PEEK}px)` : "translateX(0px)"
      );
    }
    launcher.style.opacity = mode === "expanded" ? "0.96" : "0.92";
    launcher.setAttribute("aria-label", mode === "expanded" ? "折叠 Navia 阅读助手" : "打开 Navia 阅读助手");
  }
  if (!documentRef.body.hasAttribute("data-navia-original-margin-right")) {
    documentRef.body.dataset.naviaOriginalMarginRight = documentRef.body.style.marginRight || "";
  }
  const shouldPush = mode === "expanded" && layoutMode === "push";
  documentRef.body.style.marginRight = shouldPush
    ? `calc(${documentRef.body.dataset.naviaOriginalMarginRight || "0px"} + var(--navia-inpage-sidebar-width) + ${IN_PAGE_SIDEBAR_INSET * 2}px)`
    : documentRef.body.dataset.naviaOriginalMarginRight || "";
}

function readSidebarState(documentRef: Document): SidebarInteractionState {
  const parsed = safeParse(readStoredSidebarState(documentRef));
  const width = typeof parsed.width === "number" ? parsed.width : IN_PAGE_SIDEBAR_DEFAULT_WIDTH;
  const mode = parsed.mode === "expanded" ? "expanded" : SIDEBAR_DEFAULT_MODE;
  const launcherSide = parsed.launcherSide === "left" ? "left" : "right";
  const launcherTopRatio = typeof parsed.launcherTopRatio === "number" ? parsed.launcherTopRatio : LAUNCHER_DEFAULT_TOP;
  const clampedWidth = clampSidebarWidth(documentRef, width);
  return {
    mode,
    width: clampedWidth,
    layoutMode: resolveLayoutMode(documentRef, clampedWidth),
    launcherTopRatio: Math.min(0.9, Math.max(0.12, launcherTopRatio)),
    launcherSide
  };
}

function writeSidebarState(documentRef: Document, state: SidebarInteractionState): void {
  try {
    documentRef.defaultView?.localStorage?.setItem(SIDEBAR_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Some embedded or restricted page contexts deny localStorage. UI state can safely fall back to defaults.
  }
}

function readStoredSidebarState(documentRef: Document): string | null {
  try {
    return documentRef.defaultView?.localStorage?.getItem(SIDEBAR_STATE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function safeParse(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function clampSidebarWidth(documentRef: Document, width: number): number {
  const viewportWidth = documentRef.defaultView?.innerWidth ?? 1200;
  const max = Math.max(IN_PAGE_SIDEBAR_MIN_WIDTH, Math.floor(viewportWidth * IN_PAGE_SIDEBAR_MAX_VIEWPORT_RATIO));
  return Math.min(max, Math.max(IN_PAGE_SIDEBAR_MIN_WIDTH, Math.floor(width)));
}

function resolveLayoutMode(documentRef: Document, width: number): SidebarLayoutMode {
  const viewportWidth = documentRef.defaultView?.innerWidth ?? 1200;
  if (viewportWidth < IN_PAGE_NARROW_OVERLAY_WIDTH) return "overlay";
  return width / viewportWidth > IN_PAGE_SIDEBAR_OVERLAY_RATIO ? "overlay" : "push";
}

function launcherTopPx(documentRef: Document, state: Pick<SidebarInteractionState, "launcherTopRatio">): number {
  const viewportHeight = documentRef.defaultView?.innerHeight ?? 800;
  return Math.round(Math.min(viewportHeight - 72, Math.max(24, viewportHeight * state.launcherTopRatio)));
}

function clampLauncherTopRatio(documentRef: Document, topPx: number): number {
  const viewportHeight = documentRef.defaultView?.innerHeight ?? 800;
  const clamped = Math.min(viewportHeight - 72, Math.max(24, topPx));
  return clamped / viewportHeight;
}

export function createPageContextMessageHandler(documentRef: Document, href: string) {
  return (message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: SendResponse): boolean => {
    if (!message || typeof message !== "object") {
      return false;
    }
    const type = (message as { type?: unknown }).type;

    if (type === PAGE_CONTEXT_MESSAGE_TYPE) {
      try {
        const context = extractPageContext(documentRef, href);
        sendResponse({ ok: true, context });
      } catch (error) {
        sendResponse({ ok: false, error: getErrorMessage(error) });
      }
      return true;
    }

    if (type === JUMPBACK_MESSAGE_TYPE) {
      try {
        const request = (message as { request?: unknown }).request;
        if (!isJumpbackRequest(request)) throw new Error("Jumpback request is invalid.");
        sendResponse({ ok: true, result: performJumpback(documentRef, request) });
      } catch (error) {
        sendResponse({ ok: false, error: getErrorMessage(error) });
      }
      return true;
    }

    if (type === MEDIA_COLLECT_CONTEXT_MESSAGE_TYPE) {
      const currentHref = currentDocumentHref(documentRef, href);
      void collectMediaPageContext({ document: documentRef, href: currentHref })
        .then((context) => sendResponse({ ok: true, adapterId: context.adapterId, value: context }))
        .catch((error) => sendResponse(mediaFailure(error)));
      return true;
    }

    if (type === MEDIA_READ_PLAYBACK_MESSAGE_TYPE) {
      try {
        const currentHref = currentDocumentHref(documentRef, href);
        const adapter = resolveMediaPortalAdapter(currentHref);
        if (!adapter) throw new Error("V3_MEDIA_PORTAL_UNSUPPORTED: No registered media portal adapter matched the page.");
        sendResponse({
          ok: true,
          adapterId: adapter.adapterId,
          value: readMediaPlayback({ document: documentRef, href: currentHref })
        });
      } catch (error) {
        sendResponse(mediaFailure(error));
      }
      return true;
    }

    if (type === MEDIA_SEEK_MESSAGE_TYPE) {
      try {
        const seconds = (message as { seconds?: unknown }).seconds;
        if (typeof seconds !== "number") throw new Error("V3_MEDIA_SEEK_INVALID: Seek target must be a number.");
        const currentHref = currentDocumentHref(documentRef, href);
        const adapter = resolveMediaPortalAdapter(currentHref);
        if (!adapter) throw new Error("V3_MEDIA_PORTAL_UNSUPPORTED: No registered media portal adapter matched the page.");
        sendResponse({
          ok: true,
          adapterId: adapter.adapterId,
          value: seekMediaPlayback({ document: documentRef, href: currentHref }, seconds)
        });
      } catch (error) {
        sendResponse(mediaFailure(error));
      }
      return true;
    }

    return false;
  };
}

function currentDocumentHref(documentRef: Document, fallback: string): string {
  const current = documentRef.location?.href;
  if (!current || !/^https?:/i.test(current)) return fallback;
  const currentAdapter = resolveMediaPortalAdapter(current);
  const fallbackAdapter = resolveMediaPortalAdapter(fallback);
  return fallbackAdapter && !currentAdapter ? fallback : current;
}

function mediaFailure(error: unknown): MediaBridgeResponse<never> {
  const message = error instanceof Error ? error.message : String(error);
  const candidate = message.split(":", 1)[0] as MediaCollectionFailureCode;
  const allowed = new Set<MediaCollectionFailureCode>([
    "V3_MEDIA_PORTAL_UNSUPPORTED",
    "V3_MEDIA_PORTAL_AMBIGUOUS",
    "V3_MEDIA_PAGE_IDENTITY_INCOMPLETE",
    "V3_MEDIA_PLAYBACK_UNAVAILABLE",
    "V3_MEDIA_SEEK_INVALID"
  ]);
  return {
    ok: false,
    failureCode: allowed.has(candidate) ? candidate : "V3_MEDIA_PAGE_IDENTITY_INCOMPLETE",
    error: message
  };
}

export function performJumpback(documentRef: Document, request: JumpbackRequest): JumpbackResult {
  const attemptedStrategies: JumpbackStrategy[] = [];
  const selector = cleanString(request.selector);
  const domPath = cleanString(request.domPath);
  const href = cleanString(request.href);
  const textQuote = cleanString(request.textQuote);
  const fallbackText = cleanString(request.fallbackText) || textQuote;
  clearJumpbackHighlights(documentRef);
  if (!documentRef.body) {
    return {
      status: "blocked",
      attemptedStrategies,
      fallbackText,
      failureReason: "document_body_unavailable"
    };
  }

  if (selector) {
    attemptedStrategies.push("selector");
    const element = findBySelector(documentRef, selector, textQuote);
    if (element) return highlightElement(element, { attemptedStrategies, matchedStrategy: "selector" });
  }

  if (domPath) {
    attemptedStrategies.push("domPath");
    const element = findBySelector(documentRef, domPath, textQuote);
    if (element) return highlightElement(element, { attemptedStrategies, matchedStrategy: "domPath" });
  }

  if (href) {
    attemptedStrategies.push("href");
    const element = findByHref(documentRef, href, textQuote);
    if (element) return highlightElement(element, { attemptedStrategies, matchedStrategy: "href" });
  }

  if (textQuote) {
    attemptedStrategies.push("textQuote");
    const element = findByTextQuote(documentRef, textQuote);
    if (element) return highlightElement(element, { attemptedStrategies, matchedStrategy: "textQuote" });
  }

  return {
    status: fallbackText ? "fallback_shown" : "blocked",
    attemptedStrategies,
    fallbackText,
    failureReason: attemptedStrategies.length ? "source_not_found_in_dom" : "no_traceable_source_evidence"
  };
}

function ensureJumpbackStyles(documentRef: Document): void {
  if (documentRef.getElementById(JUMPBACK_STYLE_ID)) return;
  const style = documentRef.createElement("style");
  style.id = JUMPBACK_STYLE_ID;
  style.textContent = `
    [data-navia-jumpback-highlight="true"] {
      position: relative !important;
      outline: 3px solid rgba(5, 84, 75, 0.9) !important;
      outline-offset: 5px !important;
      background:
        linear-gradient(90deg, rgba(5, 84, 75, 0.18), rgba(5, 84, 75, 0.055)) !important;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.92),
        0 18px 42px rgba(5, 84, 75, 0.22) !important;
      border-radius: 10px !important;
      transition: outline-color 180ms ease, background 180ms ease, box-shadow 180ms ease !important;
    }
    #${JUMPBACK_MARKER_ID} {
      position: fixed;
      z-index: 2147483647;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: min(320px, calc(100vw - 24px));
      padding: 7px 10px;
      border: 1px solid rgba(5, 84, 75, 0.24);
      border-radius: 999px;
      background: rgba(245, 252, 249, 0.94);
      color: #013a33;
      box-shadow: 0 16px 36px rgba(5, 84, 75, 0.2), inset 0 1px 0 rgba(255,255,255,0.88);
      font: 700 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      pointer-events: none;
      backdrop-filter: blur(12px) saturate(140%);
      -webkit-backdrop-filter: blur(12px) saturate(140%);
    }
    #${JUMPBACK_MARKER_ID}::before {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #1c7c54;
      box-shadow: 0 0 0 4px rgba(28, 124, 84, 0.13);
      content: "";
    }
  `;
  documentRef.head?.append(style);
}

function clearJumpbackHighlights(documentRef: Document): void {
  documentRef.querySelectorAll<HTMLElement>("[data-navia-jumpback-highlight='true']").forEach((element) => {
    element.removeAttribute("data-navia-jumpback-highlight");
    element.removeAttribute("data-navia-jumpback-strategy");
    element.style.removeProperty("outline");
    element.style.removeProperty("outline-offset");
    element.style.removeProperty("background-color");
  });
  documentRef.getElementById(JUMPBACK_MARKER_ID)?.remove();
}

function isJumpbackRequest(value: unknown): value is JumpbackRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return [record.selector, record.domPath, record.href, record.textQuote, record.fallbackText].some((item) => typeof item === "string" && item.trim().length > 0);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function findBySelector(documentRef: Document, selector: string, textQuote = ""): HTMLElement | null {
  try {
    const element = documentRef.querySelector(selector);
    if (!(element instanceof HTMLElement)) return null;
    if (isTraceableElement(element, textQuote)) return element;
    return textQuote ? findBestDescendantMatch(element, textQuote) : null;
  } catch {
    return null;
  }
}

function findByTextQuote(documentRef: Document, textQuote: string): HTMLElement | null {
  const target = normalizeText(textQuote);
  if (!target) return null;
  const candidates = textQuoteCandidates(target);
  const body = documentRef.body;
  if (!body) return null;
  const walker = documentRef.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const scored = new Map<HTMLElement, number>();
  let node = walker.nextNode();
  while (node) {
    const normalizedNodeText = normalizeText(node.textContent || "");
    const score = textMatchScore(normalizedNodeText, candidates);
    if (score > 0) {
      const parent = nearestTraceableParent(node.parentElement, target);
      if (parent) scored.set(parent, Math.max(scored.get(parent) ?? 0, score + elementQualityScore(parent, target)));
    }
    node = walker.nextNode();
  }
  const elements = Array.from(body.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6, p, li, td, th, pre, blockquote, article, section, main, [role='article'], [class*='title'], [class*='desc'], [class*='content'], [class*='note'], [class*='video'], div"));
  for (const element of elements) {
    if (isIgnoredJumpbackElement(element)) continue;
    const elementText = normalizeText(element.textContent || "");
    if (!elementText) continue;
    const score = textMatchScore(elementText, candidates);
    if (score <= 0) continue;
    if (!isTraceableElement(element, target)) continue;
    scored.set(element, Math.max(scored.get(element) ?? 0, score + elementQualityScore(element, target)));
  }
  return Array.from(scored.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function findByHref(documentRef: Document, href: string, textQuote = ""): HTMLElement | null {
  const target = normalizeHref(href, documentRef.baseURI);
  if (!target) return null;
  const anchors = Array.from(documentRef.querySelectorAll<HTMLAnchorElement>("a[href]"));
  const scored = anchors
    .map((anchor) => {
      const anchorHref = normalizeHref(anchor.href || anchor.getAttribute("href") || "", documentRef.baseURI);
      if (!anchorHref || !hrefsMatch(anchorHref, target)) return null;
      const card = nearestTraceableCard(anchor, textQuote) ?? anchor;
      const score =
        (anchorHref === target ? 40 : 24) +
        elementQualityScore(card, textQuote || normalizeText(anchor.textContent || "")) +
        textMatchScore(normalizeText(card.textContent || anchor.textContent || ""), textQuoteCandidates(textQuote || anchor.textContent || ""));
      return [card, score] as const;
    })
    .filter((item): item is readonly [HTMLElement, number] => Boolean(item))
    .filter(([element]) => isTraceableElement(element, textQuote || normalizeText(element.textContent || "")))
    .sort((left, right) => right[1] - left[1]);
  return scored[0]?.[0] ?? null;
}

function findBestDescendantMatch(root: HTMLElement, textQuote: string): HTMLElement | null {
  const candidates = textQuoteCandidates(textQuote);
  const descendants = Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3, p, li, blockquote, pre, [class*='title'], [class*='desc'], [class*='content'], [class*='note'], [class*='video'], div"));
  const scored = descendants
    .filter((element) => isTraceableElement(element, textQuote))
    .map((element) => [element, textMatchScore(normalizeText(element.textContent || ""), candidates) + elementQualityScore(element, textQuote)] as const)
    .filter(([, score]) => score > 0)
    .sort((left, right) => right[1] - left[1]);
  return scored[0]?.[0] ?? null;
}

function nearestTraceableCard(anchor: HTMLElement, textQuote: string): HTMLElement | null {
  const selectors = [
    "article",
    "section",
    "li",
    "[role='article']",
    "[class*='card']",
    "[class*='note']",
    "[class*='feed']",
    "[class*='video']",
    "[class*='item']"
  ].join(",");
  const card = anchor.closest<HTMLElement>(selectors);
  if (card && !isIgnoredJumpbackElement(card) && normalizeText(card.textContent || "").length <= 900) return card;
  return nearestTraceableParent(anchor, textQuote || normalizeText(anchor.textContent || ""));
}

function nearestTraceableParent(parent: HTMLElement | null, textQuote: string): HTMLElement | null {
  let current = parent;
  let best: HTMLElement | null = null;
  while (current && current !== current.ownerDocument.body) {
    if (isTraceableElement(current, textQuote)) best = current;
    const textLength = normalizeText(current.textContent || "").length;
    if (textLength > Math.max(700, textQuote.length * 5)) break;
    current = current.parentElement;
  }
  return best;
}

function isTraceableElement(element: HTMLElement, textQuote: string): boolean {
  if (isIgnoredJumpbackElement(element)) return false;
  const text = normalizeText(element.textContent || "");
  if (!text) return false;
  const quote = normalizeText(textQuote);
  if (!quote) return text.length <= 1200;
  if (/^(MAIN|BODY|DIV)$/.test(element.tagName) && element.children.length >= 3) return false;
  if (text.length > Math.max(900, quote.length * 5) && !hasPreciseTextOverlap(text, quote)) return false;
  if (element.children.length >= 3 && text.length > Math.max(180, quote.length * 2.5) && !/^(ARTICLE|SECTION)$/.test(element.tagName)) return false;
  if (element.children.length > 12 && text.length > Math.max(520, quote.length * 4)) return false;
  return textMatchScore(text, textQuoteCandidates(quote)) > 0 || hasPreciseTextOverlap(text, quote);
}

function hasPreciseTextOverlap(text: string, quote: string): boolean {
  const normalizedText = normalizeForMatch(text);
  const normalizedQuote = normalizeForMatch(quote);
  if (!normalizedText || !normalizedQuote) return false;
  if (normalizedText.includes(normalizedQuote)) return true;
  const probe = normalizedQuote.slice(0, Math.min(64, normalizedQuote.length));
  return probe.length >= 18 && normalizedText.includes(probe);
}

function isIgnoredJumpbackElement(element: HTMLElement): boolean {
  if (["SCRIPT", "STYLE", "NOSCRIPT", "NAV", "FOOTER", "HEADER", "ASIDE"].includes(element.tagName)) return true;
  const marker = `${element.tagName} ${element.id || ""} ${element.className || ""} ${element.getAttribute("role") || ""}`.toLowerCase();
  if (/(bili-video-card|video-card|feed-card|carousel-item)/.test(marker) && hasAllowedMediaHref(element)) return false;
  if (/nav|footer|header|sidebar|side-bar|comment|reply|recommend|related|rec-list|danmaku|弹幕|广告|ad-|banner|activity|promo|login|passport|toolbar|control|player|playlist/.test(marker)) return true;
  if (hasAllowedMediaHref(element) && element.closest("[class*='feed'], [class*='video'], [class*='carousel']")) return false;
  return Boolean(element.closest("nav, footer, header, aside, [class*='comment'], [class*='reply'], [class*='recommend'], [class*='related'], [class*='danmaku'], [class*='toolbar'], [class*='login']"));
}

function hasAllowedMediaHref(element: HTMLElement): boolean {
  const hrefs = [
    element instanceof HTMLAnchorElement ? element.href || element.getAttribute("href") || "" : "",
    ...Array.from(element.querySelectorAll<HTMLAnchorElement>("a[href]")).map((anchor) => anchor.href || anchor.getAttribute("href") || "")
  ];
  return hrefs.some((href) => /bilibili\.com\/video\/|\/video\/BV/i.test(href));
}

function textMatchScore(text: string, candidates: string[]): number {
  const normalizedText = normalizeForMatch(text);
  if (!normalizedText) return 0;
  let best = 0;
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeForMatch(candidate);
    if (normalizedCandidate.length < 4) continue;
    if (normalizedText.includes(normalizedCandidate)) {
      best = Math.max(best, Math.min(80, 30 + normalizedCandidate.length / Math.max(1, normalizedText.length) * 120));
    } else if (normalizedCandidate.includes(normalizedText) && normalizedText.length >= 6) {
      best = Math.max(best, Math.min(55, 18 + normalizedText.length / Math.max(1, normalizedCandidate.length) * 80));
    }
  }
  return best;
}

function elementQualityScore(element: HTMLElement, textQuote: string): number {
  const tag = element.tagName.toLowerCase();
  const marker = `${tag} ${element.id || ""} ${element.className || ""}`.toLowerCase();
  const textLength = normalizeText(element.textContent || "").length;
  let score = 0;
  if (/^(h1|h2|h3|p|blockquote|li)$/.test(tag)) score += 18;
  if (/article|main|note|desc|content|title|video/.test(marker)) score += 12;
  if (textLength > Math.max(900, textQuote.length * 5)) score -= 45;
  if (element.children.length > 12) score -= 25;
  return score;
}

function normalizeForMatch(value: string): string {
  return normalizeText(value).replace(/[^\p{L}\p{N}#]+/gu, "").toLowerCase();
}

function highlightElement(
  element: HTMLElement,
  input: { attemptedStrategies: JumpbackStrategy[]; matchedStrategy: JumpbackStrategy }
): JumpbackResult {
  ensureJumpbackStyles(element.ownerDocument);
  element.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
  element.setAttribute("data-navia-jumpback-highlight", "true");
  element.setAttribute("data-navia-jumpback-strategy", input.matchedStrategy);
  placeJumpbackMarker(element, input.matchedStrategy);
  return {
    status: "highlighted",
    attemptedStrategies: input.attemptedStrategies,
    matchedStrategy: input.matchedStrategy,
    markerVisible: isJumpbackMarkerVisible(element.ownerDocument),
    highlightedText: normalizeText(element.textContent || "").slice(0, 240)
  };
}

function isJumpbackMarkerVisible(documentRef: Document): boolean {
  const marker = documentRef.getElementById(JUMPBACK_MARKER_ID);
  if (!(marker instanceof HTMLElement)) return false;
  const rect = marker.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0;
}

function placeJumpbackMarker(element: HTMLElement, strategy: JumpbackStrategy): void {
  const documentRef = element.ownerDocument;
  const view = documentRef.defaultView;
  if (!documentRef.body || !view) return;
  documentRef.getElementById(JUMPBACK_MARKER_ID)?.remove();
  const marker = documentRef.createElement("div");
  marker.id = JUMPBACK_MARKER_ID;
  marker.setAttribute("data-testid", "navia-jumpback-marker");
  marker.textContent = `Navia 已定位来源 · ${strategyLabel(strategy)}`;
  const rect = element.getBoundingClientRect();
  const top = Math.max(12, Math.min(rect.top - 38, view.innerHeight - 44));
  const left = Math.max(12, Math.min(rect.left, view.innerWidth - 332));
  Object.assign(marker.style, {
    top: `${top}px`,
    left: `${left}px`
  });
  documentRef.body.append(marker);
}

function strategyLabel(strategy: JumpbackStrategy): string {
  if (strategy === "selector") return "页面选择器";
  if (strategy === "domPath") return "DOM 路径";
  if (strategy === "href") return "来源链接";
  return "文本证据";
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function textQuoteCandidates(value: string): string[] {
  const normalized = normalizeText(value);
  const withoutUrls = normalizeText(
    normalized
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/\([^)]{0,16}\s*\)/g, " ")
      .replace(/（[^）]{0,16}\s*）/g, " ")
  );
  const candidates = [
    normalized,
    withoutUrls,
    withoutUrls.slice(0, 160),
    withoutUrls.slice(0, 120),
    withoutUrls.slice(0, 80),
    withoutUrls.slice(0, 48),
    normalized.slice(0, 160),
    normalized.slice(0, 120),
    normalized.slice(0, 80),
    normalized.slice(0, 48)
  ]
    .map((item) => item.trim())
    .filter((item) => item.length >= 4);
  const sentences = withoutUrls.split(/[。.!?；;]\s*/).map((item) => item.trim()).filter((item) => item.length >= 4);
  return Array.from(new Set([...candidates, ...sentences]));
}

function normalizeHref(value: string, baseURI?: string): string {
  try {
    const parsed = new URL(value, baseURI || undefined);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(spm_id_from|trackid|vd_source|xsec_token|xsec_source|from|share_from_user_hidden)$/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/#.*$/, "").replace(/[?&](?:spm_id_from|trackid|vd_source|xsec_token|xsec_source)=[^&#\s]+/gi, "").replace(/\/$/, "");
  }
}

function hrefsMatch(left: string, right: string): boolean {
  if (left === right) return true;
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "") && a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, "");
  } catch {
    return left.includes(right) || right.includes(left);
  }
}
