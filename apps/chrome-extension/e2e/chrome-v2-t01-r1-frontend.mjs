import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const extensionRoot = fs.realpathSync(process.env.NAVIA_T01_EXTENSION_ROOT || path.join(__dirname, "../chrome-mv3-unpacked"));
const runId = process.env.NAVIA_T01_RUN_ID || `t01-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const evidenceRoot = path.resolve(process.env.NAVIA_T01_EVIDENCE_ROOT || path.join(repoRoot, "docs/active/project/evidence/v2_external_brain_productization/px-5/t01-r1-frontend-chrome/runs", runId));
const logsRoot = path.join(evidenceRoot, "logs");
const rawRoot = path.join(evidenceRoot, "raw");
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const metadataRoot = path.join(evidenceRoot, "screenshot-metadata");
const inputRoot = path.join(evidenceRoot, "input", "authorized-documents");
const privateRoot = path.join(evidenceRoot, "private");
const headless = process.env.NAVIA_T01_HEADLESS !== "0";
for (const directory of [logsRoot, rawRoot, screenshotRoot, metadataRoot, inputRoot, privateRoot]) fs.mkdirSync(directory, { recursive: true });

const report = {
  schemaVersion: "v2-t01-r1-frontend-real-chrome/v1",
  runId,
  generatedAt: new Date().toISOString(),
  extensionRoot,
  runtimeUrl: "http://127.0.0.1:17861",
  headless,
  sidePanelMode: null,
  sidePanelIdentity: null,
  extensionId: null,
  sourceIdentity: null,
  permissionRoots: [],
  forgetVerification: null,
  tokenLeakChecks: [],
  checks: [],
  screenshots: [],
  passed: false
};

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function scanPublicArtifactsForSecret(root, secret) {
  const needle = Buffer.from(secret);
  const hits = [];
  let scannedFiles = 0;
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
      if (relative === "private" || relative.startsWith("private/")) continue;
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        scannedFiles += 1;
        if (fs.readFileSync(absolute).includes(needle)) hits.push(relative);
      }
    }
  };
  visit(root);
  return { scannedFiles, hits };
}

function check(id, passed, detail) {
  report.checks.push({ id, passed: Boolean(passed), detail });
  if (!passed) throw new Error(`${id}: ${detail}`);
}

async function capture(page, name, surface) {
  const filePath = path.join(screenshotRoot, name);
  await page.bringToFront();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: filePath, fullPage: true, timeout: 60_000 });
  const viewport = page.viewportSize();
  const record = {
    path: path.relative(evidenceRoot, filePath).replaceAll(path.sep, "/"),
    sha256: sha256(fs.readFileSync(filePath)),
    url: page.url(),
    surface,
    viewport,
    capturedAt: new Date().toISOString()
  };
  report.screenshots.push(record);
  writeJson(path.join(metadataRoot, `${name}.json`), record);
}

function captureNativeChrome(name, profilePath) {
  const filePath = path.join(screenshotRoot, name);
  const target = windowsPath(filePath).replaceAll("'", "''").replaceAll("/", "\\");
  const profileName = path.basename(profilePath).replaceAll("'", "''");
  const script = [
    "Add-Type -AssemblyName System.Drawing",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaWindowCapture { [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left; public int Top; public int Right; public int Bottom; } [DllImport(\"user32.dll\")] public static extern bool SetProcessDPIAware(); [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr hWnd, out Rect rect); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd); }'",
    "$null = [NaviaWindowCapture]::SetProcessDPIAware()",
    `$profileName = '${profileName}'`,
    "$processInfo = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profileName) -and -not $_.CommandLine.Contains('--type=') } | Select-Object -First 1",
    "if (-not $processInfo) { throw 'Navia test Chrome main process was not found' }",
    "$process = Get-Process -Id $processInfo.ProcessId",
    "$handle = $process.MainWindowHandle",
    "if ($handle -eq 0) { throw 'Navia test Chrome has no main window handle' }",
    "$rect = New-Object NaviaWindowCapture+Rect",
    "if (-not [NaviaWindowCapture]::GetWindowRect($handle, [ref]$rect)) { throw 'GetWindowRect failed' }",
    "$null = [NaviaWindowCapture]::SetForegroundWindow($handle)",
    "Start-Sleep -Milliseconds 300",
    "$width = $rect.Right - $rect.Left",
    "$height = $rect.Bottom - $rect.Top",
    "if ($width -lt 1000 -or $height -lt 700) { throw \"Unexpected Chrome window bounds: $width x $height\" }",
    "$bitmap = New-Object System.Drawing.Bitmap $width,$height",
    "$graphics = [System.Drawing.Graphics]::FromImage($bitmap)",
    "$graphics.CopyFromScreen($rect.Left,$rect.Top,0,0,$bitmap.Size)",
    `$bitmap.Save('${target}', [System.Drawing.Imaging.ImageFormat]::Png)`,
    "$graphics.Dispose()",
    "$bitmap.Dispose()",
    "Write-Output \"$($rect.Left),$($rect.Top),$width,$height\""
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" });
  if (result.status !== 0 || !fs.existsSync(filePath)) throw new Error(`Native Chrome screenshot failed: ${result.stderr || result.stdout}`);
  const bounds = result.stdout.trim().split(",").map((value) => Number.parseInt(value, 10));
  if (bounds.length !== 4 || bounds.some((value) => !Number.isFinite(value))) {
    throw new Error(`Native Chrome screenshot returned invalid bounds: ${result.stdout}`);
  }
  const [left, top, width, height] = bounds;
  const record = {
    path: path.relative(evidenceRoot, filePath).replaceAll(path.sep, "/"),
    sha256: sha256(fs.readFileSync(filePath)),
    surface: "native_side_panel_with_host",
    viewport: { width, height },
    captureRegion: { left, top, width, height },
    capturedAt: new Date().toISOString()
  };
  report.screenshots.push(record);
  writeJson(path.join(metadataRoot, `${name}.json`), record);
}

function windowsPath(filePath) {
  const result = spawnSync("wslpath", ["-w", filePath], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`wslpath failed for ${filePath}: ${result.stderr || result.stdout}`);
  return result.stdout.trim().replaceAll("\\", "/");
}

function stopWindowsChromeProfile(profilePath) {
  const profileName = path.basename(profilePath);
  if (!/^navia-t01-profile-[A-Za-z0-9]+$/.test(profileName)) {
    throw new Error(`Refusing to stop Chrome for unexpected profile name: ${profileName}`);
  }
  const script = [
    `$target = '${profileName}';`,
    "Get-CimInstance Win32_Process",
    "| Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($target) -and -not $_.CommandLine.Contains('--type=') }",
    "| ForEach-Object { & taskkill.exe /PID $_.ProcessId /T /F }"
  ].join(" ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" });
  return { status: result.status, output: `${result.stdout || ""}${result.stderr || ""}` };
}

async function waitForCdp(port, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        const version = await response.json();
        if (typeof version.webSocketDebuggerUrl === "string") return version.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome has not exposed CDP yet.
    }
    await wait(250);
  }
  throw new Error("Chrome did not expose CDP.");
}

export async function launchExtension(profilePath) {
  const windowsChrome = process.env.NAVIA_BROWSER_EXECUTABLE || path.join(repoRoot, ".tmp/chrome-for-testing/chrome-win64/chrome.exe");
  if (fs.existsSync(windowsChrome) && windowsChrome.toLowerCase().endsWith(".exe")) {
    const port = 11_300 + Math.floor(Math.random() * 500);
    const child = spawn(windowsChrome, [
      ...(headless ? ["--headless=new", "--hide-scrollbars"] : ["--window-position=40,40"]),
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
      "--window-size=1280,900",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${windowsPath(profilePath)}`,
      `--disable-extensions-except=${windowsPath(extensionRoot)}`,
      `--load-extension=${windowsPath(extensionRoot)}`,
      "about:blank"
    ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    child.stdout.on("data", (chunk) => { log += chunk; });
    child.stderr.on("data", (chunk) => { log += chunk; });
    try {
      const webSocketDebuggerUrl = await waitForCdp(port);
      const browser = await chromium.connectOverCDP(webSocketDebuggerUrl);
      const context = browser.contexts()[0];
      if (!context) throw new Error("Chrome CDP has no browser context.");
      return {
        context,
        flush: () => fs.writeFileSync(path.join(logsRoot, "chrome.log"), log),
        close: async () => {
          await browser.close().catch(() => undefined);
          if (child.exitCode === null) {
            child.kill("SIGTERM");
            await Promise.race([
              new Promise((resolve) => child.once("exit", resolve)),
              wait(5_000)
            ]);
          }
          const stopResult = stopWindowsChromeProfile(profilePath);
          log += `\n[t01-profile-stop status=${stopResult.status}]\n${stopResult.output}`;
          await wait(1_000);
          fs.writeFileSync(path.join(logsRoot, "chrome.log"), log);
        },
        pid: child.pid,
        cdpPort: port
      };
    } catch (error) {
      const stopResult = stopWindowsChromeProfile(profilePath);
      log += `\n[t01-startup-stop status=${stopResult.status}]\n${stopResult.output}`;
      if (child.exitCode === null) child.kill("SIGTERM");
      fs.writeFileSync(path.join(logsRoot, "chrome.log"), log);
      throw error;
    }
  }

  const context = await chromium.launchPersistentContext(profilePath, {
    headless,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--no-proxy-server",
      "--disable-features=DisableLoadExtensionCommandLineSwitch",
      "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${extensionRoot}`,
      `--load-extension=${extensionRoot}`
    ]
  });
  return { context, close: () => context.close(), flush: () => undefined, pid: null, cdpPort: null };
}

async function isNaviaServiceWorker(worker) {
  if (!worker.url().startsWith("chrome-extension://")) return false;
  try {
    return await worker.evaluate(() => chrome.runtime.getManifest()?.name === "Navia");
  } catch {
    return false;
  }
}

export async function extensionWorker(context, timeoutMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const worker of context.serviceWorkers()) {
      if (await isNaviaServiceWorker(worker)) return worker;
    }
    await wait(250);
  }
  throw new Error(`Navia service worker was not exposed. Observed=${JSON.stringify(context.serviceWorkers().map((worker) => worker.url()))}`);
}

export function startFixtureServer() {
  const fixturePath = path.join(repoRoot, "docs/active/project/fixtures/real_pages/article.html");
  const bytes = fs.readFileSync(fixturePath);
  const server = http.createServer((request, response) => {
    if (request.url === "/article.html" || request.url === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(bytes);
      return;
    }
    response.writeHead(404);
    response.end("Not found");
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    resolve({ server, url: `http://127.0.0.1:${address.port}/article.html`, fixturePath, sha256: sha256(bytes) });
  }));
}

export async function ensurePortFree() {
  try {
    const response = await fetch("http://127.0.0.1:17861/v1/health");
    if (response.ok) throw new Error("Port 17861 already has a Runtime; T01 refuses to reuse or terminate it.");
  } catch (error) {
    if (error instanceof Error && error.message.includes("already has a Runtime")) throw error;
  }
}

export function startRuntime(extensionId, token) {
  const dbPath = path.join(privateRoot, "runtime.sqlite3");
  const child = spawn("python3", ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", "17861", "--app-dir", "services/local-runtime"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NAVIA_DB_PATH: dbPath,
      NAVIA_LOCAL_FILES_TOKEN: token,
      NAVIA_LOCAL_FILES_EXTENSION_ID: extensionId
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let log = "";
  child.stdout.on("data", (chunk) => { log += chunk; });
  child.stderr.on("data", (chunk) => { log += chunk; });
  return { child, dbPath, flush: () => fs.writeFileSync(path.join(logsRoot, "runtime.log"), log) };
}

export async function waitForRuntime(timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch("http://127.0.0.1:17861/v1/health");
      if (response.ok) return;
    } catch {
      // Runtime is still starting.
    }
    await wait(200);
  }
  throw new Error("Runtime did not become healthy.");
}

export async function executeSidePanelBridge(worker, command) {
  const response = await worker.evaluate(async (payload) => {
    const executor = globalThis.__naviaE2EExecuteSidePanelCommand;
    if (typeof executor !== "function") return { ok: false, error: "E2E Side Panel bridge is unavailable." };
    return await executor(payload);
  }, command);
  if (!response?.ok) throw new Error(response?.error || `Side Panel bridge command failed: ${command.action}`);
  return response.result ?? response;
}

export async function waitForSidePanelBridge(worker, timeoutMs = 15_000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const identity = await executeSidePanelBridge(worker, { action: "panel_identity" });
      const href = String(identity.locationHref ?? "");
      if (href.includes("/sidepanel.html") && !href.includes("naviaInPage=1")) return identity;
      lastError = new Error(`Connected bridge is not native: ${JSON.stringify(identity)}`);
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }
  throw new Error(`Native Side Panel bridge did not connect: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function openSidePanelViaExtensionUserGesture(context, worker, hostPage) {
  const extensionId = new URL(worker.url()).host;
  const helperPage = await context.newPage();
  try {
    await helperPage.goto(`chrome-extension://${extensionId}/mermaid-renderer.html`);
    const result = await helperPage.evaluate((targetUrl) => {
      const button = document.createElement("button");
      button.dataset.testid = "t01-open-native-sidepanel";
      button.textContent = "Open native Side Panel";
      button.addEventListener("click", () => {
        void (async () => {
          try {
            const tabs = await chrome.tabs.query({});
            const target = tabs.find((tab) => tab.url === targetUrl) ?? tabs.find((tab) => tab.active);
            if (typeof chrome.sidePanel?.setOptions !== "function" || typeof chrome.sidePanel?.open !== "function") {
              throw new Error(`chrome.sidePanel unavailable: ${typeof chrome.sidePanel}`);
            }
            if (target?.id === undefined || target.windowId === undefined) throw new Error("Target tab is unavailable.");
            await chrome.sidePanel.setOptions({
              tabId: target.id,
              path: `sidepanel.html?naviaE2ETabId=${target.id}`,
              enabled: true,
            });
            await chrome.sidePanel.open({ tabId: target.id, windowId: target.windowId });
            globalThis.__naviaT01SidePanelOpenResult = { ok: true, tabId: target.id, windowId: target.windowId };
          } catch (error) {
            globalThis.__naviaT01SidePanelOpenResult = {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })();
      });
      document.body.append(button);
      return { sidePanelType: typeof chrome.sidePanel };
    }, hostPage.url());
    await helperPage.locator("[data-testid='t01-open-native-sidepanel']").click();
    await helperPage.waitForFunction(
      () => globalThis.__naviaT01SidePanelOpenResult?.ok === true || globalThis.__naviaT01SidePanelOpenResult?.ok === false,
      null,
      { timeout: 5_000 },
    );
    const openResult = await helperPage.evaluate(() => globalThis.__naviaT01SidePanelOpenResult);
    return { ...result, ...openResult };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await helperPage.close().catch(() => undefined);
    await hostPage.bringToFront().catch(() => undefined);
  }
}

export async function openNativeSidePanel(context, worker, hostPage) {
  const direct = await worker.evaluate(async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id || !tabs[0]?.windowId) return { ok: false, message: "No active host tab." };
      await chrome.sidePanel.setOptions({ tabId: tabs[0].id, path: "sidepanel.html", enabled: true });
      await chrome.sidePanel.open({ tabId: tabs[0].id, windowId: tabs[0].windowId });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  });
  if (!direct.ok) {
    await hostPage.bringToFront();
    await hostPage.keyboard.press("Alt+Shift+N");
  }
  const started = Date.now();
  let sentExplicitCommand = false;
  let helperAttempt = null;
  while (Date.now() - started < 15_000) {
    const page = context.pages().find((candidate) => candidate.url().includes("/sidepanel.html"));
    if (page) return { page, method: direct.ok ? "chrome.sidePanel.open" : "keyboard_extension_action" };
    if (direct.ok) {
      try {
        await waitForSidePanelBridge(worker, 500);
        return { page: null, method: "chrome.sidePanel.open+e2e_bridge" };
      } catch {
        // The native panel document may still be mounting.
      }
    } else {
      const nativeObservation = await worker.evaluate(() => globalThis.__naviaE2ENativeSidePanelOpen ?? null);
      if (nativeObservation?.ok) {
        await waitForSidePanelBridge(worker);
        return { page: null, method: "chrome.command.native_side_panel+e2e_bridge", nativeObservation };
      }
      if (!sentExplicitCommand && Date.now() - started > 3_000) {
        sentExplicitCommand = true;
        await hostPage.bringToFront();
        await hostPage.keyboard.press("Control+Shift+Y");
      }
      if (!helperAttempt && Date.now() - started > 6_000) {
        helperAttempt = await openSidePanelViaExtensionUserGesture(context, worker, hostPage);
        if (helperAttempt.ok) {
          await waitForSidePanelBridge(worker);
          return { page: null, method: "extension_page_user_gesture+e2e_bridge", helperAttempt };
        }
      }
    }
    await wait(250);
  }
  throw new Error(`Native Side Panel did not expose an automatable sidepanel.html target: ${JSON.stringify({ direct, helperAttempt })}`);
}

export function createSidePanelDriver(page, worker) {
  const bridge = (command) => executeSidePanelBridge(worker, command);
  return {
    page,
    async click(testId) {
      if (page) return await page.locator(`[data-testid='${testId}']`).click();
      await bridge({ action: "t01_dom", operation: "click", testId });
    },
    async fill(testId, value) {
      if (page) return await page.locator(`[data-testid='${testId}']`).fill(value);
      await bridge({ action: "t01_dom", operation: "fill", testId, value });
    },
    async count(testId) {
      if (page) return await page.locator(`[data-testid='${testId}']`).count();
      const result = await bridge({ action: "t01_dom", operation: "count", testId });
      return Number(result.count || 0);
    },
    async text(testId) {
      if (page) return await page.locator(`[data-testid='${testId}']`).textContent() ?? "";
      const result = await bridge({ action: "t01_dom", operation: "text", testId });
      return String(result.text ?? "");
    },
    async waitForText(testId, expected, timeoutMs = 15_000) {
      const started = Date.now();
      let observed = "";
      while (Date.now() - started < timeoutMs) {
        try {
          observed = await this.text(testId);
          if (observed.includes(expected)) return observed;
        } catch {
          observed = "";
        }
        await wait(200);
      }
      throw new Error(`Side Panel ${testId} did not contain ${JSON.stringify(expected)}. Last=${JSON.stringify(observed)}`);
    },
    async waitForCount(testId, expected, timeoutMs = 15_000) {
      const started = Date.now();
      let observed = 0;
      while (Date.now() - started < timeoutMs) {
        try {
          observed = await this.count(testId);
          if (observed === expected) return observed;
        } catch {
          observed = 0;
        }
        await wait(200);
      }
      throw new Error(`Side Panel ${testId} count did not become ${expected}. Last=${observed}`);
    },
    inspectSecret(secret) {
      if (page) return inspectTokenLeakObservation(page, secret);
      return bridge({ action: "t01_secret_scan", secret });
    }
  };
}

export async function connectRuntime(page, token) {
  await page.locator("[data-testid='local-runtime-token-input']").fill(token);
  await page.locator("[data-testid='local-runtime-connect']").click();
  await page.locator("[data-testid='local-runtime-status']").getByText("本页面会话已认证", { exact: true }).waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const input = document.querySelector("[data-testid='local-runtime-token-input']");
    return !input || input.value === "";
  });
}

async function inspectTokenLeakObservation(page, token) {
  return await page.evaluate(async (secret) => {
    const storage = {};
    for (const area of ["local", "session", "sync"]) {
      try { storage[area] = await chrome.storage[area].get(null); } catch { storage[area] = null; }
    }
    let databases = [];
    try { databases = (await indexedDB.databases()).map((item) => item.name); } catch { databases = []; }
    const input = document.querySelector("[data-testid='local-runtime-token-input']");
    return {
      urlContains: location.href.includes(secret),
      referrerContains: document.referrer.includes(secret),
      localStorageContains: JSON.stringify({ ...localStorage }).includes(secret),
      sessionStorageContains: JSON.stringify({ ...sessionStorage }).includes(secret),
      chromeStorageContains: JSON.stringify(storage).includes(secret),
      indexedDbContains: JSON.stringify(databases).includes(secret),
      bodyTextContains: (document.body.innerText || "").includes(secret),
      inputValueEmpty: !input || input.value === ""
    };
  }, token);
}

async function inspectTokenLeak(page, token, surface) {
  const observation = await inspectTokenLeakObservation(page, token);
  const passed = Object.entries(observation).every(([key, value]) => key === "inputValueEmpty" ? value === true : value === false);
  report.tokenLeakChecks.push({ surface, passed, observation });
  check(`token_not_exposed_${surface}`, passed, JSON.stringify(observation));
}

async function connectSidePanelRuntime(driver, token, assertionId) {
  await driver.fill("local-runtime-token-input", token);
  await driver.click("local-runtime-connect");
  await driver.waitForText("local-runtime-status", "本页面会话已认证");
  const secretCheck = await driver.inspectSecret(token);
  check(assertionId, secretCheck.inputValueEmpty === true, JSON.stringify(secretCheck));
}

async function inspectSidePanelTokenLeak(driver, token) {
  const observation = await driver.inspectSecret(token);
  const passed = Object.entries(observation).every(([key, value]) => {
    if (key === "action") return true;
    return key === "inputValueEmpty" ? value === true : value === false;
  });
  report.tokenLeakChecks.push({ surface: "side_panel", passed, observation });
  check("token_not_exposed_side_panel", passed, JSON.stringify(observation));
}

async function runtimeRequest(extensionId, token, requestPath, options = {}) {
  const response = await fetch(`http://127.0.0.1:17861${requestPath}`, {
    ...options,
    headers: {
      Origin: `chrome-extension://${extensionId}`,
      Authorization: `Bearer ${token}`,
      "X-Request-ID": `req_${crypto.randomUUID().replace(/-/g, "")}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const body = await response.json();
  return { status: response.status, body };
}

export async function waitForWorkspacePage(context, extensionId) {
  const prefix = `chrome-extension://${extensionId}/workspace.html`;
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    const page = context.pages().find((candidate) => candidate.url().startsWith(prefix));
    if (page) return page;
    await wait(250);
  }
  throw new Error("Workspace page was not opened from Side Panel.");
}

async function grantScanImportRevoke(page, documentInput) {
  await page.getByLabel("授权名称").fill(documentInput.name);
  await page.getByLabel("Runtime 绝对路径").fill(documentInput.path);
  await page.getByRole("button", { name: "授权", exact: true }).click();
  const article = page.locator(".permission-list article").filter({ hasText: documentInput.name });
  await article.waitFor({ timeout: 15_000 });
  await article.getByRole("button", { name: "扫描", exact: true }).click();
  const fieldset = page.locator("fieldset");
  await fieldset.getByText(documentInput.basename, { exact: false }).waitFor({ timeout: 15_000 });
  await fieldset.locator("input[type='checkbox']").check();
  await fieldset.getByRole("button", { name: "导入所选文件", exact: true }).click();
  await page.getByText("已导入 1 个来源", { exact: false }).waitFor({ timeout: 15_000 });
  await article.getByRole("button", { name: "撤销", exact: true }).click();
  await article.getByText("revoked", { exact: false }).waitFor({ timeout: 15_000 });
  return article;
}

async function main() {
  check("fresh_extension_build", fs.existsSync(path.join(extensionRoot, "manifest.json")) && fs.existsSync(path.join(extensionRoot, "workspace.html")), extensionRoot);
  await ensurePortFree();
  const fixture = await startFixtureServer();
  const profileRoot = path.resolve(process.env.NAVIA_T01_PROFILE_ROOT || os.tmpdir());
  fs.mkdirSync(profileRoot, { recursive: true });
  const profilePath = fs.mkdtempSync(path.join(profileRoot, "navia-t01-profile-"));
  let browser;
  try {
    browser = await launchExtension(profilePath);
  } catch (error) {
    await new Promise((resolve) => fixture.server.close(resolve));
    fs.rmSync(profilePath, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    throw error;
  }
  let runtime = null;
  let workspace = null;
  const cleanup = { browserPid: browser.pid, runtimePid: null, fixtureServer: true, profilePath, extensionRoot, tokenSha256: null, cleaned: false };

  try {
    const context = browser.context;
    const hostPage = context.pages()[0] || await context.newPage();
    await hostPage.goto(fixture.url);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    check("extension_id_shape", /^[a-p]{32}$/.test(extensionId), extensionId);
    report.extensionId = extensionId;

    const token = crypto.randomBytes(32).toString("base64url");
    cleanup.tokenSha256 = sha256(Buffer.from(token));
    runtime = startRuntime(extensionId, token);
    cleanup.runtimePid = runtime.child.pid;
    await waitForRuntime();

    const sidePanelResult = await openNativeSidePanel(context, worker, hostPage);
    const sidePanel = sidePanelResult.page;
    const sidePanelDriver = createSidePanelDriver(sidePanel, worker);
    report.sidePanelMode = sidePanelResult.method;
    check(
      "native_side_panel_opened",
      [
        "chrome.sidePanel.open",
        "chrome.sidePanel.open+e2e_bridge",
        "chrome.command.native_side_panel+e2e_bridge",
        "extension_page_user_gesture+e2e_bridge",
      ].includes(sidePanelResult.method),
      sidePanelResult.method,
    );
    report.sidePanelIdentity = await executeSidePanelBridge(worker, { action: "panel_identity" });
    check(
      "sidepanel_bound_to_host_tab",
      String(report.sidePanelIdentity.locationHref ?? "").includes("naviaE2ETabId="),
      JSON.stringify(report.sidePanelIdentity),
    );
    if (sidePanel) await sidePanel.setViewportSize({ width: 420, height: 900 });
    check("sidepanel_root_present", await sidePanelDriver.count("navia-sidepanel-root") === 1, sidePanelResult.method);
    await sidePanelDriver.click("read-current-page");
    await sidePanelDriver.waitForText("current-page-context-card", "Browser extension");
    await sidePanelDriver.click("nav-knowledge-tab");
    await sidePanelDriver.waitForCount("local-runtime-token-input", 1);
    await sidePanelDriver.fill("local-runtime-token-input", "x".repeat(32));
    await sidePanelDriver.click("local-runtime-connect");
    await sidePanelDriver.waitForText("local-runtime-error", "会话认证失效，请重新输入 Runtime 令牌");
    check("sidepanel_403_is_authentication", true, "Wrong token produced authentication_required.");
    await connectSidePanelRuntime(sidePanelDriver, token, "sidepanel_token_input_cleared_initial");
    await inspectSidePanelTokenLeak(sidePanelDriver, token);
    if (sidePanel) await capture(sidePanel, "01-sidepanel-connected.png", "side_panel");
    else captureNativeChrome("01-native-sidepanel-connected.png", profilePath);

    await sidePanelDriver.waitForCount("save-current-source", 1);
    await sidePanelDriver.click("save-current-source");
    const sideIdentity = await sidePanelDriver.waitForText("quick-source-identity", "trace_ready");
    const sourceId = sideIdentity?.match(/src_[a-zA-Z0-9]+/)?.[0];
    const operationId = sideIdentity?.match(/op_[a-zA-Z0-9]+/)?.[0];
    check("sidepanel_source_identity", Boolean(sourceId && operationId), String(sideIdentity));

    await sidePanelDriver.click("open-workspace");
    workspace = await waitForWorkspacePage(context, extensionId);
    await workspace.setViewportSize({ width: 1280, height: 900 });
    await workspace.locator("[data-testid='local-runtime-token-input']").waitFor({ timeout: 15_000 });
    check(
      "workspace_requires_second_token",
      await workspace.locator("[data-testid='local-runtime-token-input']").count() === 1,
      "Workspace exposed its own unauthenticated Runtime session.",
    );
    await hostPage.bringToFront();
    await waitForSidePanelBridge(worker);
    await sidePanelDriver.click("nav-knowledge-tab");
    await sidePanelDriver.waitForCount("local-runtime-token-input", 1);
    check(
      "sidepanel_reload_clears_page_session",
      await sidePanelDriver.count("local-runtime-token-input") === 1,
      "Chrome rebuilt the tab-specific Side Panel without persisting its Runtime token.",
    );
    await connectRuntime(workspace, token);
    await workspace.locator("[data-testid='route-source-library']").waitFor({ timeout: 15_000 });
    await connectSidePanelRuntime(sidePanelDriver, token, "sidepanel_token_input_cleared_after_workspace_connect");
    await sidePanelDriver.click("local-runtime-disconnect");
    await sidePanelDriver.waitForCount("local-runtime-token-input", 1);
    check(
      "sidepanel_disconnect_isolated",
      await workspace.locator("[data-testid='local-runtime-disconnect']").count() === 1,
      "Side Panel disconnect did not clear the Workspace document session.",
    );
    await connectSidePanelRuntime(sidePanelDriver, token, "sidepanel_token_input_cleared_after_sidepanel_disconnect");
    await workspace.locator("[data-testid='local-runtime-disconnect']").click();
    await workspace.locator("[data-testid='local-runtime-token-input']").waitFor({ timeout: 15_000 });
    check(
      "workspace_disconnect_isolated",
      await sidePanelDriver.count("local-runtime-disconnect") === 1,
      "Workspace disconnect did not clear the native Side Panel document session.",
    );
    await connectRuntime(workspace, token);
    await workspace.locator("[data-testid='route-source-library']").waitFor({ timeout: 15_000 });
    await workspace.locator(`[data-testid='source-row-${sourceId}']`).click();
    await workspace.waitForURL(new RegExp(`/workspace\\.html#/knowledge/sources/${sourceId}\\?workspaceId=ws_default$`), { timeout: 15_000 });
    await workspace.locator("[data-testid='route-source-detail']").waitFor({ timeout: 15_000 });
    const workspaceOperationId = await workspace.locator("[data-testid='workspace-operation-id']").textContent();
    check("dual_container_identity", workspaceOperationId === operationId, JSON.stringify({ sourceId, operationId, workspaceOperationId }));
    report.sourceIdentity = { workspaceId: "ws_default", sourceId, operationId, workspaceOperationId };
    await inspectTokenLeak(workspace, token, "workspace");
    await capture(workspace, "02-workspace-source-detail.png", "workspace_page");

    let releaseGraph;
    let graphResponseReady;
    const graphReady = new Promise((resolve) => { graphResponseReady = resolve; });
    const graphRelease = new Promise((resolve) => { releaseGraph = resolve; });
    await workspace.route("**/v1/knowledge/graph?**", async (route) => {
      const response = await route.fetch();
      graphResponseReady();
      await graphRelease;
      await route.fulfill({ response }).catch(() => undefined);
    });
    await workspace.getByRole("button", { name: "知识图谱", exact: true }).click();
    await graphReady;
    await workspace.locator("[data-testid='local-runtime-disconnect']").click();
    releaseGraph();
    await workspace.locator("[data-testid='local-runtime-status']").getByText("需要 Runtime 会话令牌", { exact: true }).waitFor();
    await wait(500);
    check("stale_graph_not_restored", await workspace.locator(".graph-node").count() === 0, "Delayed real Runtime graph response stayed cleared after disconnect.");
    check("sidepanel_session_isolated", await sidePanelDriver.count("local-runtime-disconnect") === 1, "Workspace disconnect did not disconnect Side Panel.");
    await connectRuntime(workspace, token);
    await workspace.unroute("**/v1/knowledge/graph?**");

    await workspace.getByRole("button", { name: "权限", exact: true }).click();
    await workspace.locator("[data-testid='route-permissions']").waitFor({ timeout: 15_000 });
    await workspace.getByLabel("授权名称").fill("invalid-windows-path");
    await workspace.getByLabel("Runtime 绝对路径").fill("C:\\private\\file.md");
    await workspace.getByRole("button", { name: "授权", exact: true }).click();
    await workspace.getByText("请输入 Runtime POSIX 绝对路径", { exact: true }).waitFor();
    check("windows_path_rejected_before_runtime", true, "Permission form rejected an untranslated Windows path.");

    const sourceDocuments = ["01-prd.md", "02-architecture.md", "04-acceptance-plan.md"];
    const documentInputs = sourceDocuments.map((fileName, index) => {
      const sourcePath = path.join(repoRoot, "docs/active/project", fileName);
      const targetPath = path.join(inputRoot, fileName);
      fs.copyFileSync(sourcePath, targetPath);
      const bytes = fs.readFileSync(targetPath);
      return { name: `T01 document ${index + 1}`, path: targetPath, basename: fileName, sha256: sha256(bytes), bytes: bytes.length };
    });
    writeJson(path.join(evidenceRoot, "input", "authorized-document-manifest.json"), documentInputs);
    for (const documentInput of documentInputs) {
      await grantScanImportRevoke(workspace, documentInput);
      const permissionsResponse = await runtimeRequest(extensionId, token, "/v1/knowledge/permissions?workspaceId=ws_default");
      const permission = permissionsResponse.body.data.permissions.find((item) => item.displayName === documentInput.name);
      check(`permission_revoked_${documentInput.name}`, permission?.state === "revoked", JSON.stringify(permission));
      const deniedScan = await runtimeRequest(extensionId, token, `/v1/knowledge/permissions/${permission.permissionRootId}/scan`, { method: "POST", body: JSON.stringify({ workspaceId: "ws_default" }) });
      check(`revoked_scan_denied_${documentInput.name}`, deniedScan.status === 403, JSON.stringify({ status: deniedScan.status, code: deniedScan.body.error?.code }));
      const retainedList = await runtimeRequest(extensionId, token, "/v1/knowledge/sources?workspaceId=ws_default");
      const retainedSource = retainedList.body.data.sources.find((item) => item.title === documentInput.basename);
      const retainedDetail = retainedSource
        ? await runtimeRequest(extensionId, token, `/v1/knowledge/sources/${retainedSource.sourceId}`)
        : { status: 404, body: null };
      check(
        `revoked_source_retained_${documentInput.name}`,
        retainedDetail.status === 200 && retainedDetail.body.data.source.contentSnapshot?.sha256 === documentInput.sha256,
        JSON.stringify({ status: retainedDetail.status, sourceId: retainedSource?.sourceId, sha256: retainedDetail.body?.data?.source?.contentSnapshot?.sha256 }),
      );
      const deniedImport = await runtimeRequest(extensionId, token, `/v1/knowledge/permissions/${permission.permissionRootId}/imports`, {
        method: "POST",
        headers: { "Idempotency-Key": `revoked-probe-${crypto.randomUUID()}` },
        body: JSON.stringify({ workspaceId: "ws_default", scanId: "scan_revoked_probe", fileIds: ["file_revoked_probe"] }),
      });
      check(`revoked_import_denied_${documentInput.name}`, deniedImport.status === 403, JSON.stringify({ status: deniedImport.status, code: deniedImport.body.error?.code }));
      report.permissionRoots.push({
        ...documentInput,
        permissionRootId: permission.permissionRootId,
        importedSourceId: retainedSource.sourceId,
        retainedSourceSha256: retainedDetail.body.data.source.contentSnapshot.sha256,
        revokedScanStatus: deniedScan.status,
        revokedImportStatus: deniedImport.status,
      });
    }
    await workspace.bringToFront();
    await capture(workspace, "03-permissions-revoked.png", "workspace_page");

    await workspace.getByRole("button", { name: "来源库", exact: true }).click();
    await workspace.locator("[data-testid='route-source-library']").waitFor({ timeout: 15_000 });
    await workspace.locator(`[data-testid='source-row-${sourceId}']`).click();
    await workspace.locator("[data-testid='route-source-detail']").waitFor({ timeout: 15_000 });
    await workspace.getByRole("button", { name: "遗忘来源", exact: true }).click();
    const dialog = workspace.locator("[data-testid='forget-source-dialog']");
    const confirm = dialog.getByRole("button", { name: "确认遗忘", exact: true });
    check("forget_exact_confirmation", await confirm.isDisabled(), "Confirmation is disabled before exact text.");
    await dialog.getByLabel("确认文本").fill("forget");
    await confirm.click();
    await workspace.locator("[data-testid='route-source-library']").waitFor({ timeout: 15_000 });
    const listAfter = await runtimeRequest(extensionId, token, "/v1/knowledge/sources?workspaceId=ws_default");
    const askAfter = await runtimeRequest(extensionId, token, "/v1/knowledge/query", { method: "POST", body: JSON.stringify({ workspaceId: "ws_default", question: "What did the forgotten page say?", sourceIds: [sourceId] }) });
    const graphAfter = await runtimeRequest(extensionId, token, "/v1/knowledge/graph?workspaceId=ws_default");
    const traceAfter = await runtimeRequest(extensionId, token, `/v1/knowledge/source/${sourceId}/trace`);
    const libraryData = listAfter.body.data;
    const askData = askAfter.body.data;
    const graphData = graphAfter.body.data;
    const traceData = traceAfter.body.data;
    const forgetVerification = {
      libraryAbsent:
        listAfter.status === 200 &&
        libraryData.workspaceId === "ws_default" &&
        libraryData.cursor === null &&
        Array.isArray(libraryData.sources) &&
        !libraryData.sources.some((item) => item.sourceId === sourceId),
      askAbsent:
        askAfter.status === 200 &&
        askData.workspaceId === "ws_default" &&
        askData.lookupOutcome === "empty" &&
        askData.status === "degraded" &&
        askData.answer === "" &&
        Array.isArray(askData.evidenceRefs) &&
        askData.evidenceRefs.length === 0,
      graphAbsent:
        graphAfter.status === 200 &&
        graphData.workspaceId === "ws_default" &&
        graphData.status === "ready" &&
        Array.isArray(graphData.nodes) &&
        Array.isArray(graphData.edges) &&
        !graphData.nodes.some((item) => item.id === sourceId) &&
        !graphData.edges.some((item) => item.from === sourceId || item.to === sourceId),
      traceAbsent:
        traceAfter.status === 200 &&
        traceData.sourceId === sourceId &&
        traceData.lookupOutcome === "forgotten" &&
        traceData.status === "blocked" &&
        Array.isArray(traceData.entries) &&
        traceData.entries.length === 0
    };
    check("forget_four_surfaces", Object.values(forgetVerification).every(Boolean), JSON.stringify(forgetVerification));
    report.forgetVerification = forgetVerification;
    await capture(workspace, "04-forget-library.png", "workspace_page");

    runtime.child.kill("SIGTERM");
    await new Promise((resolve) => runtime.child.once("exit", resolve));
    await workspace.locator("[data-testid='local-runtime-disconnect']").click();
    await workspace.locator("[data-testid='local-runtime-token-input']").fill(token);
    await workspace.locator("[data-testid='local-runtime-connect']").click();
    await workspace.locator("[data-testid='local-runtime-error']").getByText("Runtime 当前不可达", { exact: true }).waitFor({ timeout: 15_000 });
    await workspace.locator("[data-testid='workspace-runtime-offline']").waitFor({ timeout: 15_000 });
    const offlineValues = await workspace.locator("[data-testid='workspace-service-status'] strong").allTextContents();
    check(
      "transport_is_offline",
      JSON.stringify(offlineValues) === JSON.stringify(["offline", "unchecked", "unchecked", "unknown"]),
      JSON.stringify({ observation: "Real Runtime stop produced stable offline authority, not authentication_required.", offlineValues }),
    );
    await capture(workspace, "05-runtime-offline.png", "workspace_page");

    runtime.flush();
    browser.flush();
    const publicArtifactScan = scanPublicArtifactsForSecret(evidenceRoot, token);
    const publicArtifactsPassed = publicArtifactScan.hits.length === 0;
    report.tokenLeakChecks.push({ surface: "public_artifact_raw_bytes", passed: publicArtifactsPassed, observation: publicArtifactScan });
    check("token_not_exposed_public_artifacts", publicArtifactsPassed, JSON.stringify(publicArtifactScan));

    report.passed = report.checks.every((item) => item.passed);
    writeJson(path.join(rawRoot, "t01-real-chrome-run.json"), report);
  } finally {
    if (runtime?.child && runtime.child.exitCode === null) runtime.child.kill("SIGTERM");
    runtime?.flush();
    await browser.close().catch(() => undefined);
    await new Promise((resolve) => fixture.server.close(resolve));
    const acceptancePassed = report.passed;
    let cleanupFailure = null;
    try {
      fs.rmSync(profilePath, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
      cleanup.cleaned = true;
    } catch (error) {
      cleanupFailure = error;
      cleanup.cleaned = false;
      cleanup.error = error instanceof Error ? error.message : String(error);
      report.passed = false;
      report.checks.push({ id: "cleanup_complete", passed: false, detail: cleanup.error });
    }
    cleanup.completedAt = new Date().toISOString();
    writeJson(path.join(rawRoot, "cleanup-manifest.json"), cleanup);
    if (acceptancePassed && cleanupFailure) throw cleanupFailure;
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    report.passed = false;
    report.error = error instanceof Error ? error.stack || error.message : String(error);
    writeJson(path.join(rawRoot, "t01-real-chrome-run.json"), report);
    console.error(report.error);
    process.exitCode = 1;
  });
}
