import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupLegacyInjectedPanel,
  createPageContextMessageHandler,
  ensureInPageSidebar,
  initializeContentBridge,
  IN_PAGE_LAUNCHER_ID,
  IN_PAGE_SIDEBAR_HOST_ID,
  JUMPBACK_MESSAGE_TYPE,
  LEGACY_INJECTED_HOST_ID,
  MEDIA_COLLECT_CONTEXT_MESSAGE_TYPE,
  PAGE_CONTEXT_MESSAGE_TYPE,
  performJumpback
} from "./contentBridge";

describe("content page context bridge", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-navia-content-bridge-ready");
    document.documentElement.removeAttribute("data-navia-content-bridge-mode");
    document.body.removeAttribute("style");
    document.body.removeAttribute("data-navia-original-margin-right");
    window.localStorage.removeItem("navia.inpageSidebarState");
  });

  it("removes a legacy injected panel host during initialization", () => {
    const legacyHost = document.createElement("div");
    legacyHost.id = LEGACY_INJECTED_HOST_ID;
    document.documentElement.append(legacyHost);

    const listeners: Array<Parameters<typeof chrome.runtime.onMessage.addListener>[0]> = [];
    const originalChrome = globalThis.chrome;
    globalThis.chrome = {
      runtime: {
        getURL(path: string) {
          return `chrome-extension://navia/${path}`;
        },
        onMessage: {
          addListener(listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0]) {
            listeners.push(listener);
          }
        }
      }
    } as typeof chrome;

    try {
      initializeContentBridge(document, "https://example.com");
    } finally {
      globalThis.chrome = originalChrome;
    }

    expect(document.getElementById(LEGACY_INJECTED_HOST_ID)).toBeNull();
    expect(document.getElementById(IN_PAGE_SIDEBAR_HOST_ID)).not.toBeNull();
    expect(listeners).toHaveLength(1);
  });

  it("injects the current V1 in-page right sidebar iframe", () => {
    const originalChrome = globalThis.chrome;
    globalThis.chrome = {
      runtime: {
        getURL(path: string) {
          return `chrome-extension://navia/${path}`;
        }
      }
    } as typeof chrome;

    try {
      const host = ensureInPageSidebar(document);
      const launcher = document.getElementById(IN_PAGE_LAUNCHER_ID);
      expect(host?.id).toBe(IN_PAGE_SIDEBAR_HOST_ID);
      expect(host?.querySelector("iframe")?.getAttribute("src")).toBe("chrome-extension://navia/sidepanel.html?naviaInPage=1");
      expect(host?.dataset.naviaMode).toBe("collapsed");
      expect(document.body.style.marginRight).toBe("");
      expect(launcher).not.toBeNull();
      expect(launcher?.dataset.naviaMode).toBe("collapsed");
      expect(launcher?.dataset.naviaSide).toBe("right");
      expect(Number.parseFloat(launcher?.style.right || "0")).toBeLessThan(0);
      expect(launcher?.style.getPropertyValue("--navia-launcher-transform")).toBe("scale(1)");
      expect(launcher?.style.getPropertyValue("--navia-launcher-peek-transform")).toBe("translateX(-36px)");
      expect(document.querySelector("[data-testid='navia-inpage-sidebar-edge-toggle']")).toBeNull();
      expect(ensureInPageSidebar(document)).toBe(host);
    } finally {
      globalThis.chrome = originalChrome;
    }
  });

  it("registers a bridge without in-page UI for ordinary-page action injection", () => {
    const listeners: Array<Parameters<typeof chrome.runtime.onMessage.addListener>[0]> = [];
    const originalChrome = globalThis.chrome;
    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener(listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0]) {
            listeners.push(listener);
          }
        }
      }
    } as typeof chrome;

    try {
      initializeContentBridge(document, "https://example.com/article", { mode: "bridge_only" });
      expect(listeners).toHaveLength(1);
      expect(document.documentElement.getAttribute("data-navia-content-bridge-mode")).toBe("bridge_only");
      expect(document.getElementById(IN_PAGE_SIDEBAR_HOST_ID)).toBeNull();
      expect(document.getElementById(IN_PAGE_LAUNCHER_ID)).toBeNull();
    } finally {
      globalThis.chrome = originalChrome;
    }
  });

  it("collects a generic media context through the product message handler", async () => {
    document.head.innerHTML = `
      <script>window.__INITIAL_STATE__={"videoData":{"bvid":"BV1ZpYd66ELP","cid":41828944992,"title":"真实标题","duration":792,"owner":{"name":"真实作者"},"pages":[{"page":1,"cid":41828944992,"part":"P1","duration":792}]}};</script>
      <script>window.__playinfo__={"data":{"subtitle":{"subtitles":[]}}};</script>
    `;
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video") as HTMLVideoElement;
    Object.defineProperties(video, {
      duration: { configurable: true, value: 792 },
      currentTime: { configurable: true, writable: true, value: 8 },
      paused: { configurable: true, value: true }
    });
    const handler = createPageContextMessageHandler(document, "https://www.bilibili.com/video/BV1ZpYd66ELP");
    const response = await new Promise<unknown>((resolve) => {
      expect(handler(
        { type: MEDIA_COLLECT_CONTEXT_MESSAGE_TYPE },
        {} as chrome.runtime.MessageSender,
        resolve as (response?: unknown) => void
      )).toBe(true);
    });
    expect(response).toMatchObject({
      ok: true,
      adapterId: "bilibili",
      value: {
        platform: "bilibili",
        mediaId: "BV1ZpYd66ELP",
        playbackUnitId: "41828944992",
        transcriptAvailability: "unavailable"
      }
    });
    expect(JSON.stringify(response)).not.toMatch(/"bvid"|"cid"/);
  });

  it("retries in-page sidebar injection when the content script runs before body exists", async () => {
    const earlyDocument = document.implementation.createHTMLDocument("early");
    earlyDocument.documentElement.removeChild(earlyDocument.body);
    const listeners: Array<Parameters<typeof chrome.runtime.onMessage.addListener>[0]> = [];
    const originalChrome = globalThis.chrome;
    globalThis.chrome = {
      runtime: {
        getURL(path: string) {
          return `chrome-extension://navia/${path}`;
        },
        onMessage: {
          addListener(listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0]) {
            listeners.push(listener);
          }
        }
      }
    } as typeof chrome;

    try {
      initializeContentBridge(earlyDocument, "https://example.com");
      expect(earlyDocument.getElementById(IN_PAGE_SIDEBAR_HOST_ID)).toBeNull();

      const body = earlyDocument.createElement("body");
      earlyDocument.documentElement.append(body);
      earlyDocument.dispatchEvent(new Event("DOMContentLoaded"));
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      expect(earlyDocument.getElementById(IN_PAGE_SIDEBAR_HOST_ID)).not.toBeNull();
      expect(earlyDocument.getElementById(IN_PAGE_LAUNCHER_ID)).not.toBeNull();
      expect(listeners).toHaveLength(1);
    } finally {
      globalThis.chrome = originalChrome;
    }
  });

  it("does not bind duplicate runtime message listeners when injected more than once", () => {
    const listeners: Array<Parameters<typeof chrome.runtime.onMessage.addListener>[0]> = [];
    const originalChrome = globalThis.chrome;
    globalThis.chrome = {
      runtime: {
        getURL(path: string) {
          return `chrome-extension://navia/${path}`;
        },
        onMessage: {
          addListener(listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0]) {
            listeners.push(listener);
          }
        }
      }
    } as typeof chrome;

    try {
      initializeContentBridge(document, "https://example.com");
      initializeContentBridge(document, "https://example.com");

      expect(listeners).toHaveLength(1);
      expect(document.querySelectorAll("[data-testid='navia-inpage-sidebar']")).toHaveLength(1);
      expect(document.querySelectorAll("[data-testid='navia-floating-launcher']")).toHaveLength(1);
    } finally {
      globalThis.chrome = originalChrome;
    }
  });

  it("defaults to a docked launcher and expands the in-page sidebar through the launcher", () => {
    const originalChrome = globalThis.chrome;
    globalThis.chrome = {
      runtime: {
        getURL(path: string) {
          return `chrome-extension://navia/${path}`;
        }
      }
    } as typeof chrome;

    try {
      const host = ensureInPageSidebar(document);
      const launcher = document.getElementById(IN_PAGE_LAUNCHER_ID);
      expect(host?.dataset.naviaMode).toBe("collapsed");
      expect(launcher?.dataset.naviaMode).toBe("collapsed");
      expect(document.body.style.marginRight).toBe("");

      launcher?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(host?.dataset.naviaMode).toBe("expanded");
      expect(launcher?.dataset.naviaMode).toBe("expanded");
      expect(document.body.style.marginRight).toContain("var(--navia-inpage-sidebar-width)");

      launcher?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(host?.dataset.naviaMode).toBe("collapsed");
      expect(launcher?.dataset.naviaMode).toBe("collapsed");
      expect(document.body.style.marginRight).toBe("");
    } finally {
      globalThis.chrome = originalChrome;
    }
  });

  it("persists launcher side and top position when the launcher is dragged", () => {
    const originalChrome = globalThis.chrome;
    globalThis.chrome = {
      runtime: {
        getURL(path: string) {
          return `chrome-extension://navia/${path}`;
        }
      }
    } as typeof chrome;

    try {
      const host = ensureInPageSidebar(document);
      const launcher = document.getElementById(IN_PAGE_LAUNCHER_ID);
      expect(host).not.toBeNull();
      expect(launcher).not.toBeNull();

      launcher?.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: window.innerWidth - 20, clientY: 500 })
      );
      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: 80, clientY: 430 }));
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: 80, clientY: 430 }));

      const state = JSON.parse(window.localStorage.getItem("navia.inpageSidebarState") || "{}");
      expect(state.launcherSide).toBe("left");
      expect(state.launcherTopRatio).toBeGreaterThan(0.12);
      expect(state.launcherTopRatio).toBeLessThan(0.9);
      expect(launcher?.dataset.naviaSide).toBe("left");
    } finally {
      window.localStorage.removeItem("navia.inpageSidebarState");
      globalThis.chrome = originalChrome;
    }
  });

  it("switches to overlay layout for wide resized sidebars without pushing the page", () => {
    const originalChrome = globalThis.chrome;
    globalThis.chrome = {
      runtime: {
        getURL(path: string) {
          return `chrome-extension://navia/${path}`;
        }
      }
    } as typeof chrome;

    try {
      window.localStorage.setItem(
        "navia.inpageSidebarState",
        JSON.stringify({ mode: "expanded", width: 760, launcherTopRatio: 0.5, launcherSide: "right" })
      );
      const host = ensureInPageSidebar(document);
      expect(host?.dataset.naviaLayout).toBe("overlay");
      expect(host?.dataset.naviaMode).toBe("collapsed");
      expect(document.body.style.marginRight).toBe("");
    } finally {
      window.localStorage.removeItem("navia.inpageSidebarState");
      globalThis.chrome = originalChrome;
    }
  });

  it("keeps the launcher visible when page storage is denied", () => {
    const originalChrome = globalThis.chrome;
    globalThis.chrome = {
      runtime: {
        getURL(path: string) {
          return `chrome-extension://navia/${path}`;
        }
      }
    } as typeof chrome;
    const storageSpy = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Access is denied for this document.", "SecurityError");
    });

    try {
      const host = ensureInPageSidebar(document);
      expect(host).not.toBeNull();
      expect(document.getElementById(IN_PAGE_LAUNCHER_ID)).not.toBeNull();
      expect(host?.dataset.naviaMode).toBe("collapsed");
    } finally {
      storageSpy.mockRestore();
      globalThis.chrome = originalChrome;
    }
  });

  it("cleans up a legacy injected panel host directly", () => {
    const legacyHost = document.createElement("div");
    legacyHost.id = LEGACY_INJECTED_HOST_ID;
    document.documentElement.append(legacyHost);

    cleanupLegacyInjectedPanel(document);

    expect(document.getElementById(LEGACY_INJECTED_HOST_ID)).toBeNull();
  });

  it("returns extracted page context for navia.extractPageContext messages", () => {
    document.body.innerHTML = `
      <article>
        <h1>Readable article</h1>
        <h2>Section one</h2>
        <p>This page has enough visible text for the sidepanel bridge.</p>
      </article>
    `;
    document.title = "Bridge Fixture";

    let response: unknown;
    const handled = createPageContextMessageHandler(document, "https://example.com/posts/1")(
      { type: PAGE_CONTEXT_MESSAGE_TYPE },
      {} as chrome.runtime.MessageSender,
      (value) => {
        response = value;
      }
    );

    expect(handled).toBe(true);
    expect(response).toMatchObject({
      ok: true,
      context: {
        url: "https://example.com/posts/1",
        title: "Bridge Fixture",
        domain: "example.com"
      }
    });
    const context = (response as { ok: true; context: Record<string, unknown> }).context;
    expect(context.headings).toContainEqual({ level: 1, text: "Readable article" });
    expect(context.headings).toContainEqual({ level: 2, text: "Section one" });
    expect(String(context.visible_text)).toContain("sidepanel bridge");
    expect(String(context.cleaned_text)).toContain("sidepanel bridge");
  });

  it("ignores unrelated runtime messages", () => {
    let responseCalled = false;
    const handled = createPageContextMessageHandler(document, "https://example.com")(
      { type: "other.message" },
      {} as chrome.runtime.MessageSender,
      () => {
        responseCalled = true;
      }
    );

    expect(handled).toBe(false);
    expect(responseCalled).toBe(false);
  });

  it("returns a recoverable error response when page extraction fails", () => {
    let response: unknown;
    const handled = createPageContextMessageHandler(document, "not a valid url")(
      { type: PAGE_CONTEXT_MESSAGE_TYPE },
      {} as chrome.runtime.MessageSender,
      (value) => {
        response = value;
      }
    );

    expect(handled).toBe(true);
    expect(response).toMatchObject({
      ok: false
    });
    expect(String((response as { error: string }).error).length).toBeGreaterThan(0);
  });

  it("highlights source by selector for navia.jumpToSource messages", () => {
    document.body.innerHTML = `<article><p id="source-one">Navia extracts source mapped facts.</p></article>`;

    let response: unknown;
    const handled = createPageContextMessageHandler(document, "https://example.com")(
      { type: JUMPBACK_MESSAGE_TYPE, request: { selector: "#source-one", textQuote: "source mapped facts", fallbackText: "source mapped facts" } },
      {} as chrome.runtime.MessageSender,
      (value) => {
        response = value;
      }
    );

    expect(handled).toBe(true);
    expect(response).toMatchObject({ ok: true, result: { status: "highlighted", matchedStrategy: "selector" } });
    expect(document.querySelector("#source-one")?.getAttribute("data-navia-jumpback-highlight")).toBe("true");
    expect(document.querySelector("[data-testid='navia-jumpback-marker']")?.textContent).toContain("Navia 已定位来源");
  });

  it("matches selector source text when the evidence quote includes a URL suffix", () => {
    document.body.innerHTML = `
      <main>
        <a id="video-title" href="https://www.bilibili.com/video/BV1Fixture">【现场直拍】《亲爱的，那不是爱情》唯美雨中现场！百变精灵</a>
      </main>
    `;

    const result = performJumpback(document, {
      selector: "#video-title",
      textQuote:
        "【现场直拍】《亲爱的，那不是爱情》唯美雨中现场！百变精灵 (https://www.bilibili.com/video/BV1Fixture)",
      fallbackText: "【现场直拍】《亲爱的，那不是爱情》唯美雨中现场！百变精灵"
    });

    expect(result).toMatchObject({
      status: "highlighted",
      matchedStrategy: "selector"
    });
    expect(document.querySelector("#video-title")?.getAttribute("data-navia-jumpback-highlight")).toBe("true");
  });

  it("clears the previous source marker before applying a new jumpback highlight", () => {
    document.body.innerHTML = `
      <article>
        <p id="source-one">First traceable source.</p>
        <p id="source-two">Second traceable source.</p>
      </article>
    `;

    const first = performJumpback(document, { selector: "#source-one", fallbackText: "First traceable source." });
    const second = performJumpback(document, { selector: "#source-two", fallbackText: "Second traceable source." });

    expect(first.status).toBe("highlighted");
    expect(second.status).toBe("highlighted");
    expect(document.querySelector("#source-one")?.getAttribute("data-navia-jumpback-highlight")).toBeNull();
    expect(document.querySelector("#source-two")?.getAttribute("data-navia-jumpback-highlight")).toBe("true");
    expect(document.querySelectorAll("[data-testid='navia-jumpback-marker']")).toHaveLength(1);
  });

  it("falls back to textQuote when selector is unavailable", () => {
    document.body.innerHTML = `<article><p>这是一段可以通过文本证据定位的中文内容。</p></article>`;

    const result = performJumpback(document, {
      selector: "#missing-source",
      textQuote: "文本证据定位",
      fallbackText: "这是一段可以通过文本证据定位的中文内容。"
    });

    expect(result).toMatchObject({
      status: "highlighted",
      attemptedStrategies: ["selector", "textQuote"],
      matchedStrategy: "textQuote"
    });
    expect(document.querySelector("[data-navia-jumpback-highlight='true']")).not.toBeNull();
  });

  it("highlights the nearest content card by href when dynamic selectors are unstable", () => {
    document.body.innerHTML = `
      <main>
        <section class="note-card">
          <a href="https://www.xiaohongshu.com/explore/feed001?xsec_token=secret&xsec_source=pc_feed">AI 编程工作流：从需求拆解到代码审查</a>
          <span>开发者小周 1.2万点赞</span>
        </section>
      </main>
    `;

    const result = performJumpback(document, {
      selector: ".old-card-selector",
      href: "https://www.xiaohongshu.com/explore/feed001?xsec_token=redacted",
      textQuote: "AI 编程工作流：从需求拆解到代码审查",
      fallbackText: "AI 编程工作流：从需求拆解到代码审查"
    });

    expect(result).toMatchObject({
      status: "highlighted",
      attemptedStrategies: ["selector", "href"],
      matchedStrategy: "href"
    });
    expect(document.querySelector(".note-card")?.getAttribute("data-navia-jumpback-highlight")).toBe("true");
  });

  it("rejects oversized selector containers and highlights the precise source text", () => {
    document.body.innerHTML = `
      <main id="page-shell">
        <nav>首页 动态 热门 投稿</nav>
        <section class="recommend-list">相关推荐 自动连播 订阅合集</section>
        <article>
          <h1>真正有价值的视频主题</h1>
          <p id="precise-source">视频简介：真正有价值的主题说明，包含背景、过程和结论。</p>
        </article>
      </main>
    `;

    const result = performJumpback(document, {
      selector: "#page-shell",
      textQuote: "视频简介：真正有价值的主题说明，包含背景、过程和结论。",
      fallbackText: "视频简介：真正有价值的主题说明，包含背景、过程和结论。"
    });

    expect(result).toMatchObject({
      status: "highlighted",
      matchedStrategy: "selector"
    });
    expect(document.querySelector("#page-shell")?.getAttribute("data-navia-jumpback-highlight")).toBeNull();
    expect(document.querySelector("#precise-source")?.getAttribute("data-navia-jumpback-highlight")).toBe("true");
  });

  it("does not treat comment or recommendation text as a valid jumpback match", () => {
    document.body.innerHTML = `
      <main>
        <article><p>正文说明产品能力和结论。</p></article>
        <section class="comment-list">
          <p>正文说明产品能力和结论。</p>
        </section>
      </main>
    `;

    const result = performJumpback(document, {
      selector: ".comment-list p",
      textQuote: "正文说明产品能力和结论。",
      fallbackText: "正文说明产品能力和结论。"
    });

    expect(result).toMatchObject({
      status: "highlighted",
      matchedStrategy: "textQuote"
    });
    expect(document.querySelector(".comment-list p")?.getAttribute("data-navia-jumpback-highlight")).toBeNull();
    expect(document.querySelector("article p")?.getAttribute("data-navia-jumpback-highlight")).toBe("true");
  });

  it("allows Bilibili homepage video cards inside recommendation containers to be highlighted", () => {
    document.body.innerHTML = `
      <main>
        <section class="recommended-container">
          <div class="feed-card">
            <a class="bili-video-card__info--tit" href="https://www.bilibili.com/video/BV1Fixture">真正有价值的视频标题</a>
          </div>
        </section>
      </main>
    `;

    const result = performJumpback(document, {
      href: "https://www.bilibili.com/video/BV1Fixture",
      textQuote: "真正有价值的视频标题",
      fallbackText: "真正有价值的视频标题"
    });

    expect(result).toMatchObject({
      status: "highlighted",
      matchedStrategy: "href"
    });
    expect(document.querySelector("[data-navia-jumpback-highlight='true']")?.textContent).toContain("真正有价值的视频标题");
  });

  it("matches textQuote against enclosing element text when the quote spans nested text nodes", () => {
    document.body.innerHTML = `<article><section><p>Navia <strong>keeps source evidence</strong> traceable across rendering layers.</p></section></article>`;

    const result = performJumpback(document, {
      textQuote: "Navia keeps source evidence traceable across rendering layers.",
      fallbackText: "Navia keeps source evidence traceable across rendering layers."
    });

    expect(result).toMatchObject({
      status: "highlighted",
      matchedStrategy: "textQuote"
    });
    expect(document.querySelector("[data-navia-jumpback-highlight='true']")).not.toBeNull();
  });

  it("returns fallback_shown instead of fake success when no DOM match exists", () => {
    document.body.innerHTML = `<article><p>Visible page content.</p></article>`;

    const result = performJumpback(document, {
      selector: "#missing-source",
      textQuote: "unavailable quote",
      fallbackText: "Fallback evidence from SourceRef."
    });

    expect(result).toMatchObject({
      status: "fallback_shown",
      fallbackText: "Fallback evidence from SourceRef.",
      failureReason: "source_not_found_in_dom"
    });
    expect(document.querySelector("[data-navia-jumpback-highlight='true']")).toBeNull();
  });

  it("returns blocked when the request has no traceable strategy or fallback evidence", () => {
    document.body.innerHTML = `<article><p>Visible page content.</p></article>`;

    const result = performJumpback(document, {});

    expect(result).toMatchObject({
      status: "blocked",
      attemptedStrategies: [],
      failureReason: "no_traceable_source_evidence"
    });
    expect(document.querySelector("[data-navia-jumpback-highlight='true']")).toBeNull();
  });
});
