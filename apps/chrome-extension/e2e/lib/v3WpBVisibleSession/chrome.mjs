/**
 * WP-B VH3 — the deterministic owned Chrome and extension startup.
 *
 * The established production pattern is used, not an invention:
 *
 *   * the CDP endpoint is POLLED before `connectOverCDP`, so there is no
 *     post-spawn connection race;
 *   * the extension is loaded with the browser-level `Extensions.loadUnpacked`
 *     command, because the installed Chrome 137+ ignores the command-line
 *     extension load path;
 *   * the extension id, the service worker and the Side Panel target are
 *     VERIFIED before any case starts;
 *   * a verification failure saves ONE redacted diagnostic and exits. It never
 *     relaunches Chrome, because the visible run is a single opportunity.
 *
 * `--mute-audio` is always passed. The window is owned and the harness does not
 * change focus until an actual trusted user action is unavoidable.
 */

import fs from "node:fs";
import path from "node:path";
import { HarnessError } from "./plan.mjs";

/** The Chrome flags. `--mute-audio` is not optional. */
export function buildOwnedChromeArgs({ cdpPort, profileDir, extensionRoot, headless }) {
  return [
    ...(headless
      ? ["--headless=new", "--hide-scrollbars"]
      : ["--start-minimized", "--disable-backgrounding-occluded-windows"]),
    // The session is ALWAYS muted. No test may open an audio output device.
    "--mute-audio",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--no-proxy-server",
    "--disable-popup-blocking",
    "--disable-sync",
    "--enable-features=ExtensionsSidePanel,SidePanelPinning",
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    "--enable-unsafe-extension-debugging",
    "--force-renderer-accessibility",
    "--window-size=1280,900",
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profileDir}`,
    // The extension is NOT loaded from the command line: Chrome 137+ ignores it.
    ...(extensionRoot ? [] : []),
    "about:blank"
  ];
}

/**
 * Wait for Chrome's own DevToolsActivePort receipt. ChromeDriver uses the same
 * mechanism with `--remote-debugging-port=0`, avoiding headed-mode rejection
 * of a caller-selected port while retaining an isolated user-data directory.
 */
export async function waitForDevToolsActivePort({
  profileDir,
  fetchAdapter,
  readReceipt = (file) => fs.readFileSync(file, "utf8"),
  clock,
  child = null,
  timeoutMs = 30_000
}) {
  const started = clock?.now ? clock.now() : Date.now();
  const receipt = path.join(profileDir, "DevToolsActivePort");
  for (;;) {
    if (child && (child.exitCode != null || child.signalCode != null)) {
      throw new HarnessError(
        `Chrome exited before writing DevToolsActivePort (exit=${child.exitCode ?? "signal"}).`
      );
    }
    try {
      const [portLine] = readReceipt(receipt).trim().split(/\r?\n/);
      const port = Number(portLine);
      if (Number.isInteger(port) && port > 0 && port <= 65_535) {
        const response = await fetchAdapter(`http://127.0.0.1:${port}/json/version`);
        if (response?.ok) {
          const version = await response.json();
          if (typeof version?.webSocketDebuggerUrl === "string") {
            return { port, webSocketDebuggerUrl: version.webSocketDebuggerUrl };
          }
        }
      }
    } catch {
      // Chrome has not written a complete receipt or exposed its endpoint yet.
    }
    if ((clock?.now ? clock.now() : Date.now()) - started >= timeoutMs) {
      throw new HarnessError(
        `EXTERNAL-INPUT BLOCK: Chrome did not publish DevToolsActivePort within ${timeoutMs} ms.`
      );
    }
    await (clock?.sleep ? clock.sleep(250) : new Promise((resolve) => setTimeout(resolve, 250)));
  }
}

/** Poll the CDP endpoint. The connect happens only after it answers. */
export async function waitForCdp({ port, fetchAdapter, clock, child = null, timeoutMs = 30_000 }) {
  const started = clock?.now ? clock.now() : Date.now();
  for (;;) {
    if (child && (child.exitCode != null || child.signalCode != null)) {
      throw new HarnessError(
        `Chrome exited before exposing CDP (exit=${child.exitCode ?? "signal"}).`,
      );
    }
    try {
      const response = await fetchAdapter(`http://127.0.0.1:${port}/json/version`);
      if (response && response.ok) {
        const version = await response.json();
        if (typeof version?.webSocketDebuggerUrl === "string") return version.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome has not exposed CDP yet.
    }
    if ((clock?.now ? clock.now() : Date.now()) - started >= timeoutMs) {
      throw new HarnessError(
        `EXTERNAL-INPUT BLOCK: Chrome did not expose CDP on port ${port} within ${timeoutMs} ms.`,
      );
    }
    await (clock?.sleep ? clock.sleep(250) : new Promise((resolve) => setTimeout(resolve, 250)));
  }
}

/**
 * Load the unpacked extension with the BROWSER-level CDP command and verify
 * the id, the service worker and the Side Panel target.
 */
export async function loadAndVerifyExtension({
  browserSession,
  extensionRoot,
  context,
  clock,
  requireSidePanel = true
}) {
  const loaded = await browserSession.send("Extensions.loadUnpacked", { path: extensionRoot });
  await browserSession.detach();

  const extensionId = loaded?.id;
  if (typeof extensionId !== "string" || !/^[a-p]{32}$/.test(extensionId)) {
    throw new HarnessError(
      "Extensions.loadUnpacked did not return the exact id of the owned Navia extension."
    );
  }
  const worker = await waitForServiceWorker({ context, extensionId, clock });
  const sidePanel = requireSidePanel
    ? await waitForSidePanelTarget({ context, extensionId, clock })
    : null;

  return { extensionId, workerUrl: worker, sidePanelTargetId: sidePanel };
}

async function waitForServiceWorker({ context, extensionId, clock }) {
  const started = clock?.now ? clock.now() : Date.now();
  for (;;) {
    const worker = await context.findServiceWorker(extensionId);
    if (worker) return worker;
    if ((clock?.now ? clock.now() : Date.now()) - started >= 30_000) {
      throw new HarnessError("The Navia service worker was never exposed.");
    }
    await (clock?.sleep ? clock.sleep(250) : new Promise((resolve) => setTimeout(resolve, 250)));
  }
}

async function waitForSidePanelTarget({ context, extensionId, clock }) {
  const started = clock?.now ? clock.now() : Date.now();
  for (;;) {
    const target = await context.findSidePanelTarget(extensionId);
    if (target) return target;
    if ((clock?.now ? clock.now() : Date.now()) - started >= 30_000) {
      throw new HarnessError("The real Side Panel target was never exposed.");
    }
    await (clock?.sleep ? clock.sleep(250) : new Promise((resolve) => setTimeout(resolve, 250)));
  }
}

/**
 * The owned Chrome lifecycle.
 *
 * `adapters.process` is `{ spawn, terminateTree }`, `adapters.browser` is
 * `{ connectOverCDP }` and `adapters.context` is the browser-context adapter.
 */
export async function launchOwnedChrome({ plan, adapters, clock }) {
  const { process: processAdapter, browser: browserAdapter, context: contextAdapter } = adapters;
  fs.mkdirSync(plan.profileDir, { recursive: true, mode: 0o700 });

  const child = processAdapter.spawnBrowser(
    plan.browserExecutable,
    buildOwnedChromeArgs({
      cdpPort: plan.dynamicCdp ? 0 : plan.cdpPort,
      profileDir: plan.browserProfileDir ?? plan.profileDir,
      extensionRoot: plan.extensionRoot,
      headless: plan.headless
    }),
    { env: plan.environment }
  );

  const chrome = {
    pid: child.pid,
    cdpPort: plan.cdpPort,
    child,
    async close() {
      await browserAdapter.close?.();
      await processAdapter.terminateBrowserTree(child);
      return true;
    }
  };

  try {
    // The CDP endpoint is polled BEFORE the connection. There is no race.
    const endpoint = plan.dynamicCdp
      ? await waitForDevToolsActivePort({
          profileDir: plan.profileDir,
          fetchAdapter: adapters.fetch,
          readReceipt: adapters.readDevToolsActivePort,
          clock,
          child
        })
      : {
          port: plan.cdpPort,
          webSocketDebuggerUrl: await waitForCdp({
            port: plan.cdpPort,
            fetchAdapter: adapters.fetch,
            clock,
            child
          })
        };
    chrome.cdpPort = endpoint.port;
    const webSocketDebuggerUrl = endpoint.webSocketDebuggerUrl;
    const browser = await browserAdapter.connectOverCDP(webSocketDebuggerUrl);
    const browserSession = await browser.newBrowserCDPSession();
    const context = await contextAdapter.create(browser, browserSession);
    chrome.browser = browser;
    chrome.context = context;
    chrome.browserSession = browserSession;
    return chrome;
  } catch (error) {
    const startupDiagnostic = processAdapter.inspectBrowserStartup?.(child, plan.cdpPort) ?? null;
    await processAdapter.terminateBrowserTree(child);
    if (startupDiagnostic && error instanceof HarnessError) {
      throw new HarnessError(
        `${error.message} startupDiagnostic=${JSON.stringify(startupDiagnostic)}`
      );
    }
    throw error;
  }
}

/**
 * The build flavour the frozen acceptance path needs.
 *
 * `build:e2e` is required when the Side Panel target must be discovered
 * through the e2e bridge. The decision is RECORDED, and the same production
 * local-import modules are exercised either way: the bridge only carries
 * events, it never calls a local-import owner.
 */
export function resolveBuildFlavor({ requested }) {
  const flavor = requested === "e2e" ? "e2e" : "production";
  return {
    flavor,
    reason:
      flavor === "e2e"
        ? "the Side Panel target is discovered through the e2e bridge; the bridge only carries events and never calls a local-import owner"
        : "the production build is used and the Side Panel target is discovered directly",
    bridgeCallsLocalImportOwner: false
  };
}
