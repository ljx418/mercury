/**
 * WP-B VH2/VH3/VH4 — the REAL adapters.
 *
 * These are the implementations the later, approved visible session uses. They
 * are written against the established production patterns:
 *
 *   * the Runtime is the product's own `navia_runtime.companion`, started with
 *     private roots, on a port that is proven free;
 *   * the Chrome is the owned Windows build, muted, with the extension loaded
 *     through the browser-level `Extensions.loadUnpacked` command;
 *   * the Side Panel is opened through the product's own
 *     `chrome.sidePanel.open` path;
 *   * the file is selected through a REAL file chooser on the REAL hidden
 *     input, after a REAL click on the primary button.
 *
 * NOTHING in this module may be executed during the offline phase. The offline
 * tests never import it; they drive the recording doubles in the sibling test
 * file instead.
 */

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { HarnessError } from "./plan.mjs";
import { RawCdp } from "../rawCdp.mjs";

export const PORTAL_FACT_STABILITY_MS = 5_000;

/** Wait for Bilibili's client-rendered entitlement facts after DOMContentLoaded. */
export async function waitForPortalFacts(page, waitMs = PORTAL_FACT_STABILITY_MS) {
  await page.waitForTimeout(waitMs);
  const facts = await page.evaluate(() => {
    const state = globalThis.__INITIAL_STATE__ ?? {};
    const video = state.videoData ?? state.videoInfo ?? {};
    const body = document.body?.innerText ?? document.body?.textContent ?? "";
    return {
      mediaId: typeof video.bvid === "string" ? video.bvid : null,
      playbackUnitId: Number.isFinite(Number(video.cid)) && Number(video.cid) > 0
        ? String(video.cid)
        : null,
      restricted: /充电专属|会员专享|登录后观看|地区限制|视频不见了|试看中/.test(body)
    };
  });
  if (!facts?.mediaId || !facts.playbackUnitId) {
    throw new HarnessError("The owned Bilibili page did not expose a stable media identity.");
  }
  return facts;
}

export function isRetriableSidePanelSessionError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Session with given id not found|Target closed|target.*(?:closed|detached)|session.*closed/i.test(message);
}

/** Sum RSS for the owned Runtime process and every descendant in a `ps` snapshot. */
export function processTreeRssBytes(psOutput, rootPid) {
  if (!Number.isInteger(rootPid) || rootPid <= 0) return null;
  const rows = String(psOutput ?? "").split(/\r?\n/).map((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s*$/.exec(line);
    return match ? { pid: Number(match[1]), ppid: Number(match[2]), rssKiB: Number(match[3]) } : null;
  }).filter(Boolean);
  const byParent = new Map();
  for (const row of rows) {
    const children = byParent.get(row.ppid) ?? [];
    children.push(row.pid);
    byParent.set(row.ppid, children);
  }
  const owned = new Set([rootPid]);
  const pending = [rootPid];
  while (pending.length) {
    for (const child of byParent.get(pending.pop()) ?? []) {
      if (owned.has(child)) continue;
      owned.add(child);
      pending.push(child);
    }
  }
  const selected = rows.filter((row) => owned.has(row.pid));
  if (!selected.some((row) => row.pid === rootPid)) return null;
  return selected.reduce((total, row) => total + row.rssKiB * 1024, 0);
}

/** Read only the Runtime service process RSS for the WP-B import delta. */
export function processRssBytes(psOutput, processPid) {
  if (!Number.isInteger(processPid) || processPid <= 0) return null;
  for (const line of String(psOutput ?? "").split(/\r?\n/)) {
    const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(line);
    if (match && Number(match[1]) === processPid) return Number(match[2]) * 1024;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * The process, network and fetch adapters.
 * ------------------------------------------------------------------ */

export function createProcessAdapter({ repositoryRoot }) {
  return {
    run(args) {
      return spawnSync("python3", args, {
        cwd: repositoryRoot,
        env: { ...process.env, PYTHONPATH: path.join(repositoryRoot, "services/local-runtime") },
        encoding: "utf8"
      });
    },
    spawnRuntime(args, options) {
      const child = spawn("python3", args, {
        cwd: repositoryRoot,
        env: { ...process.env, PYTHONPATH: path.join(repositoryRoot, "services/local-runtime"), ...(options?.env ?? {}) },
        stdio: ["ignore", "pipe", "pipe"]
      });
      child.stdout?.on("data", () => undefined);
      child.stderr?.on("data", () => undefined);
      return child;
    },
    spawnBrowser(executable, args, options) {
      const child = spawn(executable, args, {
        cwd: repositoryRoot,
        env: { ...process.env, ...(options?.env ?? {}) },
        stdio: ["ignore", "pipe", "pipe"]
      });
      child.stdout?.on("data", () => undefined);
      child.stderr?.on("data", () => undefined);
      const profileArg = args.find((value) => value.startsWith("--user-data-dir="));
      child.ownedProfileMarker = profileArg
        ? path.basename(profileArg.slice("--user-data-dir=".length))
        : null;
      return child;
    },
    readRuntimeRss(child) {
      if (!child?.pid) return null;
      try {
        // WP-B's 256 MiB delta bounds the file-import Runtime, while native
        // ASR has its own resource contract and reports peakRssBytes itself.
        // Counting both here would double-apply incompatible policies.
        const snapshot = spawnSync("ps", ["-e", "-o", "pid=,rss="], { encoding: "utf8" });
        if (snapshot.status !== 0) return null;
        return processRssBytes(snapshot.stdout, child.pid);
      } catch {
        return null;
      }
    },
    /** Return bounded, non-secret startup facts without exposing a command line. */
    inspectBrowserStartup(child, cdpPort) {
      const marker = child?.ownedProfileMarker;
      if (!marker || !/^[A-Za-z0-9._-]+$/.test(marker)) return null;
      const script = [
        `$marker='${marker}'`,
        "$owned=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($marker) })",
        "$reachable=$false",
        `try { $response=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:${cdpPort}/json/version'; $reachable=($response.StatusCode -eq 200) } catch { $reachable=$false }`,
        "@{ownedProcessCount=$owned.Count;windowsCdpReachable=$reachable} | ConvertTo-Json -Compress"
      ].join("; ");
      const result = spawnSync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { encoding: "utf8", timeout: 5_000 }
      );
      if (result.status !== 0) return { ownedProcessCount: null, windowsCdpReachable: null };
      try {
        const parsed = JSON.parse(result.stdout.trim());
        return {
          ownedProcessCount: Number.isInteger(parsed.ownedProcessCount)
            ? parsed.ownedProcessCount
            : null,
          windowsCdpReachable: parsed.windowsCdpReachable === true
        };
      } catch {
        return { ownedProcessCount: null, windowsCdpReachable: null };
      }
    },
    /** Terminate the owned WSL Runtime process group. */
    async terminateRuntimeTree(child) {
      if (!child) return;
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 8_000);
          child.once("exit", () => {
            clearTimeout(timer);
            resolve();
          });
        });
      }
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    },
    /** Terminate only the Windows Chrome tree identified by the owned PID. */
    async terminateBrowserTree(child) {
      const marker = child?.ownedProfileMarker;
      if (!marker || !/^[A-Za-z0-9._-]+$/.test(marker)) {
        throw new HarnessError("The owned Chrome profile marker is unavailable; refusing broad cleanup.");
      }
      const script = [
        `$marker='${marker}'`,
        "$owned=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($marker) })",
        "$owned | ForEach-Object { & taskkill.exe /PID $_.ProcessId /T /F | Out-Null }",
        "Start-Sleep -Milliseconds 500",
        "$remaining=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($marker) })",
        "if($remaining.Count -ne 0){exit 9}"
      ].join("; ");
      const result = spawnSync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { encoding: "utf8" }
      );
      if (result.status !== 0) {
        throw new HarnessError("The owned Chrome process tree could not be proven absent.");
      }
    }
  };
}

/**
 * Read the EXPLICITLY supplied cookie file.
 *
 * The file is a Netscape cookie file. It is read ONLY when the user supplied
 * it through `NAVIA_WP_B_COOKIE_FILE`; nothing is searched for on the
 * Desktop, in another repository or on a drive, and the values are never
 * printed, logged or written to the evidence.
 */
export function readSuppliedCookies(cookieFile) {
  if (!cookieFile) {
    throw new HarnessError(
      "EXTERNAL-INPUT BLOCK: no cookie file was supplied for the owned browser context."
    );
  }
  const text = fs.readFileSync(cookieFile, "utf8");
  let rows = null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    // Netscape cookies.txt is handled below.
  }
  if (!rows) {
    rows = [];
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (!line) continue;
      const httpOnly = line.startsWith("#HttpOnly_");
      if (line.startsWith("#") && !httpOnly) continue;
      const parts = (httpOnly ? line.slice("#HttpOnly_".length) : line).split("\t");
      if (parts.length < 7) continue;
      rows.push({
        domain: parts[0],
        path: parts[2],
        secure: parts[3].toUpperCase() === "TRUE",
        expirationDate: Number(parts[4]),
        name: parts[5],
        value: parts[6],
        httpOnly,
        sameSite: "lax"
      });
    }
  }
  const cookies = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const name = typeof row.name === "string" ? row.name : "";
    const value = typeof row.value === "string" ? row.value : "";
    const rawDomain = typeof row.domain === "string" ? row.domain.toLowerCase() : "";
    const domain = rawDomain.replace(/^\./, "");
    if (!name || !value || (domain !== "bilibili.com" && !domain.endsWith(".bilibili.com"))) continue;
    const cookie = {
      name,
      value,
      domain: ".bilibili.com",
      path: typeof row.path === "string" && row.path.startsWith("/") ? row.path : "/",
      secure: row.secure === true,
      httpOnly: row.httpOnly === true
    };
    const sameSite = String(row.sameSite ?? "").toLowerCase();
    if (sameSite === "lax") cookie.sameSite = "Lax";
    else if (sameSite === "strict") cookie.sameSite = "Strict";
    else if (sameSite === "none" || sameSite === "no_restriction") cookie.sameSite = "None";
    const expiry = Number(row.expirationDate ?? row.expires);
    if (Number.isFinite(expiry) && expiry > 0) cookie.expires = expiry;
    cookies.push(cookie);
  }
  if (!cookies.some((cookie) => cookie.name === "SESSDATA" && cookie.value)) {
    throw new HarnessError(
      "EXTERNAL-INPUT BLOCK: the supplied cookie file carries no usable Bilibili SESSDATA cookie."
    );
  }
  return cookies;
}

/** Reduce the production outline-task envelope without inventing evidence. */
export function projectPublishedProduct(payload) {
  const task = payload?.data?.task;
  const evidence = task?.projections?.evidenceCatalog;
  const frame = Array.isArray(evidence)
    ? evidence.find((item) => item?.kind === "frame")
    : null;
  return {
    productId: task?.projections?.outline?.outlineId ?? null,
    taskId: task?.taskId ?? null,
    evidenceId: frame?.evidenceId ?? null
  };
}

export function createNetAdapter() {
  return {
    async isPortFree(port) {
      return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => server.close(() => resolve(true)));
        server.listen(port, "127.0.0.1");
      });
    }
  };
}

export function createFetchAdapter() {
  return async (url, options) => {
    const response = await fetch(url, options);
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.json(),
      text: async () => response.text(),
      arrayBuffer: async () => response.arrayBuffer(),
      headers: response.headers
    };
  };
}

/** Confirm Chrome's native optional-permission bubble for this owned profile only. */
export function confirmOwnedChromePermissionPrompt(profileDir) {
  const profileName = path.basename(profileDir ?? "");
  if (!/^chrome-profile-[A-Za-z0-9]+$/.test(profileName)) {
    throw new HarnessError("Refusing native permission confirmation for an unexpected profile.");
  }
  const script = [
    "$OutputEncoding=[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new()",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaWpBPermission { [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr h,int n); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int x,int y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e); }'",
    `$profile='${profileName}'`,
    "$deadline=[DateTime]::UtcNow.AddSeconds(15)",
    "$done=$false",
    "while([DateTime]::UtcNow -lt $deadline -and -not $done){",
    " $pi=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profile) -and -not $_.CommandLine.Contains('--type=') } | Select-Object -First 1",
    " if($pi){$p=Get-Process -Id $pi.ProcessId -ErrorAction SilentlyContinue; if($p -and $p.MainWindowHandle -ne 0){",
    "  $null=[NaviaWpBPermission]::ShowWindowAsync($p.MainWindowHandle,9); $null=[NaviaWpBPermission]::SetForegroundWindow($p.MainWindowHandle); Start-Sleep -Milliseconds 150",
    "  $root=[System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)",
    "  $all=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)",
    "  foreach($e in $all){if($e.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and ($e.Current.Name -match '^(允许|允许访问|Allow|Allow access)$')){",
    "   $pattern=$null; if($e.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){([System.Windows.Automation.InvokePattern]$pattern).Invoke()}else{$r=$e.Current.BoundingRectangle; $null=[NaviaWpBPermission]::SetCursorPos([int]($r.Left+$r.Width/2),[int]($r.Top+$r.Height/2)); [NaviaWpBPermission]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 80; [NaviaWpBPermission]::mouse_event(4,0,0,0,[UIntPtr]::Zero)}; $done=$true; break",
    "  }}}}",
    " if(-not $done){Start-Sleep -Milliseconds 200}",
    "}",
    "if(-not $done){exit 2}",
    "Write-Output 'owned_permission_confirmed=true'"
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    timeout: 20_000
  });
  if (result.status !== 0 || !String(result.stdout).includes("owned_permission_confirmed=true")) {
    throw new HarnessError("The owned Chrome optional-permission prompt was not confirmed.");
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * The owned Chrome.
 * ------------------------------------------------------------------ */

/** Convert a WSL path to the Windows path a Windows Chrome understands. */
export function toWindowsPath(filePath) {
  const result = spawnSync("wslpath", ["-w", filePath], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new HarnessError(`wslpath failed for the owned path: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim().replaceAll("\\", "/");
}

export function createChromeAdapter({ chromium }) {
  return {
    async connectOverCDP(webSocketDebuggerUrl) {
      return chromium.connectOverCDP(webSocketDebuggerUrl);
    },
    async close() {
      // The browser is closed by the owner of the connection.
    }
  };
}

export function createBrowserContextAdapter() {
  return {
    async create(browser, browserSession) {
      const context = browser.contexts()[0];
      if (!context) throw new HarnessError("Chrome CDP has no browser context.");
      return {
        browser,
        browserSession,
        context,
        async readExtensionId() {
          for (const worker of context.serviceWorkers()) {
            const match = /^chrome-extension:\/\/([a-p]{32})\//.exec(worker.url());
            if (match) return match[1];
          }
          return null;
        },
        async findServiceWorker(extensionId) {
          const worker = context
            .serviceWorkers()
            .find((candidate) => candidate.url().startsWith(`chrome-extension://${extensionId}/`));
          return worker ? worker.url() : null;
        },
        async findSidePanelTarget(extensionId) {
          const page = context
            .pages()
            .find((candidate) => candidate.url().includes(`${extensionId}/sidepanel.html`));
          return page ? page.url() : null;
        }
      };
    }
  };
}

/* ------------------------------------------------------------------ *
 * The Side Panel browser adapter used by the three cases.
 * ------------------------------------------------------------------ */

class NativeSidePanelLocator {
  constructor(page, selector) {
    this.page = page;
    this.selector = selector;
  }

  first() {
    return this;
  }

  async waitFor({ state = "visible", timeout = 30_000 } = {}) {
    return this.page.waitForSelector(this.selector, { state, timeout });
  }

  async isVisible() {
    return this.page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }, this.selector);
  }

  async click(options) {
    return this.page.click(this.selector, options);
  }

  async focus() {
    return this.page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return false;
      element.focus();
      return document.activeElement === element;
    }, this.selector);
  }
}

class NativeSidePanelPage {
  constructor({ client, session, target }) {
    this.client = client;
    this.session = session;
    this.target = target;
    this.closed = false;
    this.keyboard = { press: (key) => this.pressKey(key) };
  }

  async initialize() {
    await this.session.send("Runtime.enable");
    await this.session.send("DOM.enable");
    await this.session.send("Page.enable");
    await this.session.send("Network.enable");
    await this.session.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await this.session.send("Page.setInterceptFileChooserDialog", { enabled: true });
    return this;
  }

  on(method, listener) {
    return this.session.on(method, listener);
  }

  async evaluate(pageFunction, argument) {
    const source = typeof pageFunction === "function" ? pageFunction.toString() : String(pageFunction);
    const call = typeof pageFunction === "function"
      ? `(${source})(${argument === undefined ? "" : JSON.stringify(argument)})`
      : source;
    return this.session.evaluate(call);
  }

  locator(selector) {
    return new NativeSidePanelLocator(this, selector);
  }

  async waitForSelector(selector, { state = "visible", timeout = 30_000 } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const match = await this.evaluate(({ selector: query, state: expected }) => {
        const element = document.querySelector(query);
        if (!element) return expected === "detached";
        if (expected === "attached") return true;
        const rect = element.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        return expected === "hidden" ? !visible : visible;
      }, { selector, state });
      if (match) return true;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new HarnessError(`Timed out waiting for ${state} Side Panel selector: ${selector}`);
  }

  async click(selector) {
    return this.session.trustedClick(selector);
  }

  async pressKey(key) {
    const shift = key.startsWith("Shift+");
    const name = shift ? key.slice("Shift+".length) : key;
    const codes = {
      Tab: { code: "Tab", keyCode: 9 },
      Enter: { code: "Enter", keyCode: 13 }
    };
    const mapped = codes[name];
    if (!mapped) throw new HarnessError(`Unsupported native Side Panel key: ${key}`);
    const params = {
      key: name,
      code: mapped.code,
      windowsVirtualKeyCode: mapped.keyCode,
      nativeVirtualKeyCode: mapped.keyCode,
      modifiers: shift ? 8 : 0
    };
    const down = name === "Enter"
      ? { type: "keyDown", text: "\r", unmodifiedText: "\r", ...params }
      : { type: "rawKeyDown", ...params };
    await this.session.send("Input.dispatchKeyEvent", down);
    await this.session.send("Input.dispatchKeyEvent", { type: "keyUp", ...params });
  }

  async waitForEvent(name, { timeout = 30_000 } = {}) {
    if (name !== "filechooser") throw new HarnessError(`Unsupported native Side Panel event: ${name}`);
    return new Promise((resolve, reject) => {
      let remove = () => undefined;
      const timer = setTimeout(() => {
        remove();
        reject(new HarnessError("Timed out waiting for the native Side Panel file chooser."));
      }, timeout);
      remove = this.session.on("Page.fileChooserOpened", (event) => {
        clearTimeout(timer);
        remove();
        resolve({
          setFiles: async (filePath) => {
            await this.session.send("DOM.setFileInputFiles", {
              files: [toWindowsPath(filePath)],
              backendNodeId: event.backendNodeId
            });
          }
        });
      });
    });
  }

  async heapUsage() {
    const heap = await this.session.send("Runtime.getHeapUsage");
    return heap?.usedSize ?? null;
  }

  url() {
    return this.target.url;
  }

  isClosed() {
    return this.closed;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.client.send("Target.closeTarget", { targetId: this.target.targetId }).catch(() => undefined);
    await this.session.detach().catch(() => undefined);
    this.client.close();
  }
}

export function createCaseBrowserAdapter({
  context,
  extensionId,
  cdpHttpUrl,
  ownedChromeProfileDir,
  runtime,
  runtimeBaseUrl,
  origin,
  bearer,
  targets = {},
  cookieFile = null
}) {
  let panel = null;
  let ownedTab = null;
  const network = { requests: [], failures: [] };
  const resourceSamples = [];
  let sampler = null;
  let resourceSampleInFlight = null;
  let accessibilityRun = null;

  /**
   * The PASSIVE diagnostics of the real Side Panel, merged with the Runtime's
   * E2E-only observation channel. Nothing here creates, uploads, cancels,
   * polls, binds, materializes or cleans anything.
   */
  async function passiveDiagnostics(importId = null) {
    const page = await sidePanel();
    let snapshot = null;
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        snapshot = await page.evaluate(() => {
          const diagnostics = globalThis.__naviaE2ELocalImportDiagnostics;
          return typeof diagnostics?.snapshot === "function" ? diagnostics.snapshot() : null;
        });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (!String(error?.message ?? error).includes("CDP timeout: Runtime.evaluate") || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
    if (lastError) throw lastError;
    if (!snapshot) {
      throw new HarnessError(
        "PRODUCT-SEAM BLOCK: the E2E build exposes no passive local-import diagnostics snapshot.",
      );
    }
    if (!importId) return snapshot;
    // The server-observed facts come from the Runtime's E2E-only channel.
    const response = await runtime.request(
      `/v1/media/local-import-observations/${importId}`,
      { headers: { Authorization: `Bearer ${bearer}`, Origin: origin } }
    );
    if (!response?.ok) return snapshot;
    const envelope = await response.json();
    const observed = envelope?.data;
    if (!observed) return snapshot;
    return {
      ...snapshot,
      writerSliceMaxBytes: observed.writerSliceMaxBytes ?? snapshot.writerSliceMaxBytes,
      cleanupCount: observed.cleanupCount ?? snapshot.cleanupCount,
      cancelRequestCount: observed.cancelRequestCount ?? snapshot.cancelRequestCount ?? null,
      residue: observed.residue ?? snapshot.residue,
      uploadProgress: {
        ...snapshot.uploadProgress,
        writerSliceMaxBytes: observed.writerSliceMaxBytes ?? snapshot.uploadProgress?.writerSliceMaxBytes ?? null
      }
    };
  }

  /** Record one resource sample. The PEAK is the maximum over all of them. */
  async function collectResourceSample(label) {
    // Do not probe renderer liveness with Runtime.evaluate while a 1 GB XHR
    // is starting. Runtime.getHeapUsage is a target-level metric and the case
    // owns this panel for its full lifetime; a genuinely dead session still
    // fails the metric command instead of being reported as zero.
    const page = panel ?? (await sidePanel());
    const heapBytes = await page.heapUsage();
    const sample = {
      label,
      rssBytes: runtime.measureRss(),
      heapBytes
    };
    resourceSamples.push(sample);
    return sample;
  }

  async function sampleResources(label) {
    // A busy renderer can legitimately delay Runtime.getHeapUsage. Never let
    // the 500 ms timer build an unbounded CDP queue in front of the product
    // oracles; explicit samples wait for the prior real sample to settle.
    while (resourceSampleInFlight) {
      await resourceSampleInFlight.catch(() => undefined);
    }
    const pending = collectResourceSample(label);
    resourceSampleInFlight = pending;
    try {
      return await pending;
    } finally {
      if (resourceSampleInFlight === pending) resourceSampleInFlight = null;
    }
  }

  /**
   * Sample the owned Runtime RSS and the Side Panel heap THROUGHOUT the
   * upload and the processing. The peak is the maximum over every sample.
   */
  function startSampling(intervalMs = 500) {
    if (sampler) return sampler;
    sampler = setInterval(() => {
      if (resourceSampleInFlight) return;
      void sampleResources("sample").catch(() => undefined);
    }, intervalMs);
    sampler.unref?.();
    return sampler;
  }

  function stopSampling() {
    if (!sampler) return;
    clearInterval(sampler);
    sampler = null;
  }

  async function openOwnedBilibiliTab(url) {
    if (!url) {
      throw new HarnessError(
        "EXTERNAL-INPUT BLOCK: no Bilibili target URL was supplied for this case."
      );
    }
    ownedTab = ownedTab ?? (await context.newPage());
    await ownedTab.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const facts = await waitForPortalFacts(ownedTab);
    return { url, facts };
  }

  async function sidePanel() {
    if (panel) {
      try {
        await panel.evaluate(() => true);
        return panel;
      } catch (error) {
        if (!isRetriableSidePanelSessionError(error)) throw error;
        await panel.session.detach().catch(() => undefined);
        panel.client.close();
        panel.closed = true;
        panel = null;
      }
    }
    const worker = context
      .serviceWorkers()
      .find((candidate) => candidate.url().startsWith(`chrome-extension://${extensionId}/`));
    if (!worker) throw new HarnessError("The Navia service worker is not available.");
    const prepared = await worker.evaluate(async () => {
      if (
        typeof chrome.sidePanel?.setOptions !== "function"
        || typeof chrome.sidePanel?.open !== "function"
      ) {
        return { ok: false, reason: "side-panel-api-unavailable" };
      }
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id || typeof tabs[0]?.windowId !== "number") {
        return { ok: false, reason: "active-tab-unavailable" };
      }
      await chrome.sidePanel.setOptions({ tabId: tabs[0].id, path: "sidepanel.html", enabled: true });
      return { ok: true, tabId: tabs[0].id, windowId: tabs[0].windowId };
    });
    if (!prepared.ok) {
      throw new HarnessError(
        prepared.reason === "side-panel-api-unavailable"
          ? "PRODUCT-SEAM BLOCK: chrome.sidePanel is unavailable in this browser mode."
          : "The Side Panel could not be opened because the owned active tab is unavailable."
      );
    }

    // Chrome requires sidePanel.open() to run inside a trusted user gesture.
    // A click on an owned extension helper page supplies that gesture without
    // invoking any local-import owner or altering product state.
    const helper = await context.newPage();
    try {
      await helper.goto(`chrome-extension://${extensionId}/mermaid-renderer.html`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });
      await helper.evaluate(({ tabId, windowId }) => {
        const button = document.createElement("button");
        button.id = "navia-wp-b-open-side-panel";
        button.textContent = "Open Navia Side Panel";
        button.addEventListener("click", () => {
          void (async () => {
            try {
              await chrome.sidePanel.open({ tabId, windowId });
              globalThis.__naviaWpBSidePanelOpen = { status: "opened" };
            } catch (error) {
              globalThis.__naviaWpBSidePanelOpen = {
                status: "failed",
                message: error instanceof Error ? error.message : String(error)
              };
            }
          })();
        });
        document.body.append(button);
      }, { tabId: prepared.tabId, windowId: prepared.windowId });
      await helper.locator("#navia-wp-b-open-side-panel").click({ timeout: 10_000 });
      await helper.waitForFunction(
        () => ["opened", "failed"].includes(globalThis.__naviaWpBSidePanelOpen?.status),
        null,
        { timeout: 10_000 }
      );
      const openResult = await helper.evaluate(() => globalThis.__naviaWpBSidePanelOpen ?? null);
      if (openResult?.status !== "opened") {
        throw new HarnessError(
          `PRODUCT-SEAM BLOCK: trusted Side Panel open failed: ${openResult?.message ?? "unknown error"}`
        );
      }
    } finally {
      await helper.close().catch(() => undefined);
    }
    if (!cdpHttpUrl) {
      throw new HarnessError("The native Side Panel CDP endpoint was not supplied.");
    }
    const nativeClient = await RawCdp.connect(cdpHttpUrl);
    const started = Date.now();
    while (Date.now() - started < 20_000) {
      const found = (await nativeClient.targets())
        .find((candidate) => candidate.url.includes(`${extensionId}/sidepanel.html`));
      if (found) {
        const session = await nativeClient.attach(found.targetId);
        panel = await new NativeSidePanelPage({ client: nativeClient, session, target: found }).initialize();
        panel.on("Network.requestWillBeSent", (event) => {
          network.requests.push({
            requestId: event.requestId,
            url: event.request.url,
            method: event.request.method
          });
          try {
            const url = new URL(event.request.url);
            if (url.origin === runtimeBaseUrl && url.pathname.startsWith("/v1/media/local-imports")) {
              runtime?.requests?.push({ method: event.request.method, path: url.pathname, status: 0 });
            }
          } catch {
            // Non-HTTP requests are irrelevant to the owned Runtime proof.
          }
        });
        panel.on("Network.loadingFailed", (event) => {
          network.failures.push({
            requestId: event.requestId,
            errorText: event.errorText,
            canceled: event.canceled === true
          });
        });
        return panel;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    nativeClient.close();
    throw new HarnessError("The real Side Panel target never appeared.");
  }

  async function verifyProductAcceptedFile(page) {
    const started = Date.now();
    let last = null;
    while (Date.now() - started < 120_000) {
      const upload = network.requests.find((entry) =>
        entry.method === "PUT" && /\/v1\/media\/local-imports\/media_import_[a-f0-9]{32}\/content$/.test(new URL(entry.url).pathname),
      );
      if (upload) {
        const importId = /\/v1\/media\/local-imports\/(media_import_[a-f0-9]{32})\/content$/.exec(
          new URL(upload.url).pathname,
        )?.[1];
        return { fileCount: 1, importId, uploadStarted: true };
      }
      // A 1 GB File can keep the renderer busy while XHR begins. Avoid
      // competing Runtime.evaluate calls on the success path; use DOM only as
      // a bounded failure diagnostic after the product had time to emit PUT.
      if (Date.now() - started > 15_000 && last === null) {
        try {
          last = await page.evaluate(() => {
            const input = document.querySelector("[data-testid='local-import-input']");
            return {
              fileCount: input instanceof HTMLInputElement ? input.files?.length ?? 0 : -1,
              byteLength: input instanceof HTMLInputElement ? input.files?.[0]?.size ?? 0 : 0,
              phase: document.querySelector("[data-testid='local-import-phase']")?.getAttribute("data-phase") ?? null,
              error: document.querySelector("[data-testid='local-import-error']")?.textContent?.trim() ?? null,
            };
          });
        } catch {
          last = { rendererBusy: true };
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new HarnessError(
      `The product did not accept the selected local file. state=${JSON.stringify(last)}`
    );
  }

  return {
    network,
    resourceSamples,

    /** Open the owned Bilibili tab for this case. */
    async openOwnedBilibiliTab(url) {
      return openOwnedBilibiliTab(url ?? targets.primary);
    },

    /** Inject the explicitly supplied cookies into the OWNED context only. */
    async injectSuppliedCookies(cookies) {
      if (!Array.isArray(cookies) || !cookies.length) {
        throw new HarnessError(
          "EXTERNAL-INPUT BLOCK: no cookies were supplied for the owned browser context."
        );
      }
      await context.addCookies(cookies);
      return { injected: cookies.length };
    },

    /**
     * Drive the REAL user flow to the last-resort local-import card.
     *
     * Every step is a VISIBLE product control. The eligibility is reached
     * honestly: the automatic routes fail on their own and the card appears.
     */
    async driveToLastResortCard() {
      const page = await sidePanel();
      await page.locator("[data-testid='media-companion-launch']").first()
        .waitFor({ state: "visible", timeout: 60_000 });
      const enableAttached = await page.evaluate(
        () => document.querySelector("[data-testid='media-companion-enable']") !== null
      );
      if (enableAttached) {
        await page.click("[data-testid='media-companion-enable']");
        confirmOwnedChromePermissionPrompt(ownedChromeProfileDir);
        const started = Date.now();
        let changed = false;
        while (Date.now() - started < 15_000) {
          changed = await page.evaluate(() => {
            const button = document.querySelector("[data-testid='media-companion-enable']");
            const status = document.querySelector(".media-launch-status")?.textContent?.trim();
            return button === null || status !== "首次启用";
          });
          if (changed) break;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (!changed) {
          throw new HarnessError(
            "The trusted media-companion enable click produced no product state transition."
          );
        }
      }
      try {
        await page
          .locator("[data-testid='local-media-import-card']")
          .first()
          .waitFor({ state: "visible", timeout: 120_000 });
      } catch (error) {
        const state = await page.evaluate(() => ({
          launchStatus: document.querySelector(".media-launch-status")?.textContent?.trim() ?? null,
          launchDetail: document.querySelector(".media-launch-detail")?.textContent?.trim() ?? null,
          diagnostic: document.querySelector(".media-launch-diagnostic")?.textContent?.trim() ?? null,
          controls: [...document.querySelectorAll("[data-testid]")]
            .map((element) => element.getAttribute("data-testid"))
            .filter((testId) => /^(?:media|local-runtime|local-import)/.test(testId ?? ""))
        }));
        throw new HarnessError(
          `The local-import card did not become eligible. state=${JSON.stringify(state)}`
        );
      }
      return { reached: "local-media-import-card" };
    },

    async openLocalImportCard() {
      const page = await sidePanel();
      await page.waitForSelector("[data-testid='local-media-import-card']", { timeout: 60_000 });
      return { targetId: page.url() };
    },

    async beginUploadInterruptionWindow() {
      const page = await sidePanel();
      await page.session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: 8 * 1024 * 1024,
        connectionType: "wifi"
      });
    },

    async endUploadInterruptionWindow() {
      const page = await sidePanel();
      await page.session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
        connectionType: "none"
      });
    },

    async selectLocalFile(filePath, options = {}) {
      const page = await sidePanel();
      const pick = page.locator("[data-testid='local-import-pick']").first();
      if (options.keyboard === true) {
        const baseline = await page.evaluate(() => {
          const element = document.querySelector("[data-testid='local-import-pick']");
          if (!(element instanceof HTMLElement)) return null;
          const box = element.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return {
            testId: element.dataset.testid ?? null,
            enabled: !element.hasAttribute("disabled") && element.getAttribute("aria-disabled") !== "true",
            visible: box.width > 0 && box.height > 0 && Boolean(hit && (hit === element || element.contains(hit))),
            liveText: [...document.querySelectorAll("[aria-live], [role='status'], [role='alert']")]
              .map((node) => node.textContent ?? ""),
            viewport: { width: window.innerWidth, height: window.innerHeight },
            scrollWidth: document.documentElement.scrollWidth
          };
        });
        if (!baseline?.visible || !baseline.enabled) {
          throw new HarnessError("B30: the local-import picker is not visible, enabled and hit-testable.");
        }
        await pick.focus();
        const first = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? null);
        await page.keyboard.press("Tab");
        const second = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? null);
        await page.keyboard.press("Shift+Tab");
        const third = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? null);
        accessibilityRun = { baseline, focusOrder: [first, second, third], keyboardActivated: false };
        if (third !== "local-import-pick") {
          throw new HarnessError(
            `B30: keyboard traversal did not return focus to the picker (${JSON.stringify(accessibilityRun.focusOrder)}).`,
          );
        }
        const chooserPromise = page.waitForEvent("filechooser", { timeout: 60_000 });
        await page.keyboard.press("Enter");
        const chooser = await chooserPromise;
        accessibilityRun.keyboardActivated = true;
        await chooser.setFiles(filePath);
        const accepted = await verifyProductAcceptedFile(page);
        return { selected: true, keyboard: true, accepted: Boolean(accepted.importId) };
      }
      // The REAL user path: a trusted click on the primary button opens the
      // REAL hidden file input, and the chooser supplies the file.
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 60_000 }),
        page.click("[data-testid='local-import-pick']")
      ]);
      await chooser.setFiles(filePath);
      const accepted = await verifyProductAcceptedFile(page);
      return { selected: true, accepted: Boolean(accepted.importId) };
    },

    async observeUploadStart(options = {}) {
      const started = Date.now();
      while (Date.now() - started < 120_000) {
        const upload = network.requests.find((entry) =>
          entry.method === "PUT" && entry.url.includes("/v1/media/local-imports/"),
        );
        if (upload) {
          const importId = /\/v1\/media\/local-imports\/([^/]+)\/content/.exec(upload.url)?.[1] ?? null;
          if (options.requireInFlight === true) {
            const snapshot = await passiveDiagnostics(importId);
            const progress = snapshot.uploadProgress;
            const hasPartialSample = progress?.streaming === true && progress.samples?.some(
              (sample) => sample.uploadedBytes > 0 &&
                typeof sample.totalBytes === "number" &&
                sample.uploadedBytes < sample.totalBytes,
            );
            if (!hasPartialSample) {
              if (progress?.streaming === false && progress?.finalByteCount !== null) {
                throw new HarnessError(
                  "B27: the upload completed before an in-flight interruption window was observed.",
                );
              }
              await new Promise((resolve) => setTimeout(resolve, 50));
              continue;
            }
          }
          // The sampling runs from the first observed upload byte until the
          // peak is read.
          startSampling();
          return { importId, requestId: upload.requestId, sequence: 0 };
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      throw new HarnessError("No real Extension upload was observed.");
    },

    async waitForUploadAbort(importId) {
      const upload = network.requests.find((entry) =>
        entry.method === "PUT" && entry.url.includes(`/v1/media/local-imports/${importId}/content`),
      );
      if (!upload) throw new HarnessError("The upload request was not observed before abort polling.");
      const started = Date.now();
      while (Date.now() - started < 30_000) {
        const failed = network.failures.find((entry) => entry.requestId === upload.requestId);
        if (failed) {
          return {
            aborted: failed.canceled || /ABORTED/i.test(failed.errorText ?? ""),
            proof: "cdp-loading-failed"
          };
        }
        const snapshot = await passiveDiagnostics(importId);
        if (snapshot.upload?.aborted === true) {
          return { aborted: true, proof: "xhr-onabort" };
        }
        if (snapshot.upload?.loaded === true) {
          return { aborted: false, proof: "xhr-onload" };
        }
        const statusResponse = await runtime.request(`/v1/media/local-imports/${importId}`, {
          headers: { Authorization: `Bearer ${bearer}`, Origin: origin }
        });
        if (statusResponse?.ok) {
          const payload = await statusResponse.json();
          const record = payload?.data?.import;
          if (
            ["cancelled", "failed"].includes(record?.state) &&
            Number.isFinite(record?.byteLength) &&
            Number.isFinite(record?.uploadedBytes) &&
            record.byteLength > 0 &&
            record.uploadedBytes < record.byteLength
          ) {
            return {
              aborted: true,
              proof: "runtime-partial-terminal",
              uploadedBytes: record.uploadedBytes,
              byteLength: record.byteLength
            };
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return { aborted: false, proof: "timeout" };
    },

    /**
     * A REAL identity switch.
     *
     * The owned TAB is navigated to a SECOND Bilibili identity, so the product
     * resolves a different media identity. The owned portal's rendered BVID
     * and CID are the identity oracle; a Side Panel-local counter can reset
     * when Chrome rebuilds the target and therefore cannot prove a switch.
     */
    async triggerIdentityChange(secondUrl) {
      const beforeSnapshot = await passiveDiagnostics();
      const before = beforeSnapshot.sourceIdentity;
      if (typeof before !== "string" || !before) {
        throw new HarnessError("The active import exposed no source identity before the switch.");
      }
      if (!secondUrl) {
        throw new HarnessError(
          "EXTERNAL-INPUT BLOCK: no second Bilibili identity was supplied for the identity switch."
        );
      }
      if (!ownedTab) throw new HarnessError("The owned Bilibili tab was never opened.");
      await ownedTab.goto(secondUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
      const facts = await waitForPortalFacts(ownedTab);
      const part = new URL(secondUrl).searchParams.get("p") ?? "1";
      const after = `portal:bilibili:${facts.mediaId}:${facts.playbackUnitId}:${part}`;
      if (after === before) {
        throw new HarnessError("The second Bilibili page resolved to the original media identity.");
      }
      return {
        before,
        after,
        beforeGeneration: beforeSnapshot.identityGeneration,
        portalMediaId: facts.mediaId,
        portalPlaybackUnitId: facts.playbackUnitId
      };
    },

    async readPublicStatus(importId) {
      const started = Date.now();
      let last = { state: null, sequence: 0 };
      while (Date.now() - started < 180_000) {
        const response = await runtime.request(`/v1/media/local-imports/${importId}`, {
          headers: { Authorization: `Bearer ${bearer}`, Origin: origin }
        });
        const payload = await response.json();
        last = {
          state: payload?.data?.import?.state ?? null,
          sequence: payload?.data?.import?.sequence ?? 0,
          uploadedBytes: payload?.data?.import?.uploadedBytes ?? null,
          byteLength: payload?.data?.import?.byteLength ?? null
        };
        if (["ready", "cancelled", "failed"].includes(last.state)) return last;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return last;
    },

    async readCancelObservation(importId) {
      const snapshot = await passiveDiagnostics(importId);
      return { cancelRequestCount: snapshot.cancelRequestCount ?? 0 };
    },

    async readExtensionStorage() {
      const page = await sidePanel();
      const residue = await page.evaluate(async () => {
        const values = await chrome.storage.local.get(null);
        const serialized = JSON.stringify(values ?? {});
        return {
          importId: (serialized.match(/media_import_[a-f0-9]{32}/g) ?? []).length,
          bearer: (serialized.match(/Bearer\s+[A-Za-z0-9._-]{16,}/g) ?? []).length,
          uploadToken: (serialized.match(/(?:uploadToken|X-Navia-Import-Token)/g) ?? []).length
        };
      });
      return { residue };
    },

    async readUiResidue() {
      const page = await sidePanel();
      const counts = await page.evaluate(() => {
        const text = document.body?.innerText ?? "";
        return {
          fileName: (text.match(/\.[a-z0-9]{2,5}$/gim) ?? []).length,
          importId: (text.match(/media_import_[a-f0-9]{32}/g) ?? []).length,
          token: (text.match(/Bearer\s+[A-Za-z0-9._-]{16,}/g) ?? []).length
        };
      });
      return { counts };
    },

    async readUploadProgress(importId) {
      const snapshot = await passiveDiagnostics(importId);
      const progress = snapshot.uploadProgress;
      if (!progress || !Array.isArray(progress.samples)) {
        throw new HarnessError("PRODUCT-SEAM BLOCK: upload progress diagnostics are unavailable.");
      }
      return progress;
    },

    async readProductProjection(importId) {
      const importResponse = await runtime.request(`/v1/media/local-imports/${importId}`, {
        headers: { Authorization: `Bearer ${bearer}`, Origin: origin }
      });
      const importPayload = await importResponse.json();
      const taskId = importPayload?.data?.import?.taskId ?? null;
      if (!/^media_task_[a-f0-9]{32}$/.test(taskId ?? "")) {
        throw new HarnessError("The public local-import status exposed no task id.");
      }
      const started = Date.now();
      let lastStatus = null;
      while (Date.now() - started < 180_000) {
        const response = await runtime.request(`/v1/media/outline-tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${bearer}`, Origin: origin }
        });
        lastStatus = response?.status ?? null;
        if (response?.ok) {
          const payload = await response.json();
          try {
            const product = projectPublishedProduct(payload);
            if (product.taskId !== taskId) {
              throw new HarnessError("The public outline task id did not match the imported task.");
            }
            if (/^outline_[a-f0-9]{32}$/.test(product.productId ?? "") && product.evidenceId) {
              return product;
            }
          } catch (error) {
            if (error instanceof HarnessError && error.message.includes("did not match")) throw error;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new HarnessError(
        `The public outline task did not become readable before the deadline (status=${lastStatus ?? "unknown"}).`
      );
    },

    async readThumbnailRoute(importId, evidenceId) {
      if (!evidenceId) throw new HarnessError("The product exposed no evidence id for its thumbnail.");
      const response = await runtime.request(
        `/v1/media/tasks/${importId}/evidence/${evidenceId}/thumbnail`,
        { headers: { Authorization: `Bearer ${bearer}`, Origin: origin } }
      );
      if (!response?.ok) throw new HarnessError("The product thumbnail route failed.");
      const payload = await response.arrayBuffer();
      return { contentType: response.headers.get("content-type"), byteLength: payload.byteLength };
    },

    async readCleanupState(importId) {
      const started = Date.now();
      let cleanupCount = null;
      while (Date.now() - started < 180_000) {
        const snapshot = await passiveDiagnostics(importId);
        cleanupCount = snapshot.cleanupCount;
        if (!Number.isInteger(cleanupCount)) {
          throw new HarnessError("PRODUCT-SEAM BLOCK: cleanup ownership diagnostics are unavailable.");
        }
        if (cleanupCount >= 1) return { cleanupCount };
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return { cleanupCount };
    },

    async readResidue(importId) {
      const started = Date.now();
      let residue = null;
      while (Date.now() - started < 180_000) {
        const snapshot = await passiveDiagnostics(importId);
        residue = snapshot.residue;
        if (!residue || !Number.isInteger(residue.source) || !Number.isInteger(residue.sandbox)) {
          throw new HarnessError("PRODUCT-SEAM BLOCK: owned-residue diagnostics are unavailable.");
        }
        if (residue.source === 0 && residue.sandbox === 0) return residue;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return residue;
    },

    /** ONE resource sample. The PEAK is taken over every sample. */
    async readMetrics(label = "sample") {
      return sampleResources(label);
    },

    async beginResourceSampling() {
      startSampling();
      return true;
    },

    /** The PEAK owned Runtime RSS and Side Panel heap over every sample. */
    async peakResources() {
      stopSampling();
      if (resourceSampleInFlight) await resourceSampleInFlight.catch(() => undefined);
      if (!resourceSamples.length) {
        throw new HarnessError(
          "B30: no resource sample was taken. A point-in-time pair is not a peak."
        );
      }
      const rss = resourceSamples.map((sample) => sample.rssBytes).filter((value) => Number.isFinite(value));
      const heap = resourceSamples.map((sample) => sample.heapBytes).filter((value) => Number.isFinite(value));
      if (!rss.length || !heap.length) {
        throw new HarnessError("B30: a resource measurement was unavailable.");
      }
      return {
        samples: resourceSamples.length,
        peakRssBytes: Math.max(...rss),
        peakHeapBytes: Math.max(...heap)
      };
    },

    /**
     * The REAL accessibility oracles.
     *
     * A REAL keyboard traversal and activation, the focus order, the
     * visible/enabled/hit-testable state of the controls, the live region and
     * the layout stability. A node that merely exists is not enough.
     */
    async readAccessibility() {
      const page = await sidePanel();
      if (!accessibilityRun?.keyboardActivated) {
        throw new HarnessError("B30: keyboard activation was not performed through the real file picker.");
      }
      const readLayout = () => page.evaluate(() => {
        const liveText = [...document.querySelectorAll("[aria-live], [role='status'], [role='alert']")]
          .map((element) => element.textContent ?? "");
        return {
          liveText,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          scrollHeight: document.documentElement.scrollHeight,
          scrollWidth: document.documentElement.scrollWidth
        };
      });
      // requestAnimationFrame is intentionally NOT used here: Chrome suspends
      // rAF for a minimized Side Panel. Two independent synchronous reads,
      // separated by harness wall time, prove real layout stability without
      // requiring the user to foreground the owned browser.
      const before = await readLayout();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const after = await readLayout();
      const focusOrder = accessibilityRun.focusOrder;
      const liveChanged = JSON.stringify(accessibilityRun.baseline.liveText) !== JSON.stringify(after.liveText);
      return {
        keyboard: {
          passed: focusOrder[0] === "local-import-pick" && focusOrder[1] !== focusOrder[0] &&
            focusOrder[2] === "local-import-pick" && accessibilityRun.keyboardActivated,
          focusOrder,
          activated: accessibilityRun.keyboardActivated
        },
        aria: {
          passed: liveChanged,
          liveRegions: after.liveText.length,
          changed: liveChanged
        },
        viewport: {
          passed: before.scrollHeight === after.scrollHeight &&
            before.scrollWidth === after.scrollWidth &&
            after.scrollWidth <= after.viewport.width,
          viewport: after.viewport,
          before: { scrollHeight: before.scrollHeight, scrollWidth: before.scrollWidth },
          after: { scrollHeight: after.scrollHeight, scrollWidth: after.scrollWidth }
        }
      };
    },

    async closeCase() {
      stopSampling();
      if (resourceSampleInFlight) await resourceSampleInFlight.catch(() => undefined);
      const pages = [panel, ownedTab].filter(Boolean);
      panel = null;
      ownedTab = null;
      for (const page of pages) {
        if (!page.isClosed()) await page.close().catch(() => undefined);
      }
    }
  };
}

