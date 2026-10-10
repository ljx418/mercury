import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const appRoot = path.join(repoRoot, "apps/chrome-extension");
const extensionRoot = fs.realpathSync(process.env.NAVIA_V3_EXTENSION_ROOT || path.join(appRoot, "chrome-mv3-unpacked"));
const evidenceRoot = path.join(repoRoot, "docs/active/project/evidence/v3_media_companion/v3-1-page-session-baseline");
const sampleRegistryPath = path.join(evidenceRoot, "runs/v3-1p-bilibili-probe-20260917T041114Z/sample-registry.json");
const expectedSampleRegistrySha = "b71588928db4a0cb371152999052ae6b511b076377df427d74e680119491d8c1";
const portalRegistryPath = path.join(repoRoot, "docs/active/project/contracts/v3-media-portal-registry.json");
const browserExecutable = process.env.NAVIA_BROWSER_EXECUTABLE
  || path.join(repoRoot, ".tmp/chrome-for-testing/chrome-win64/chrome.exe");
const runId = process.env.NAVIA_V3_RUN_ID || `v3-1.1-media-page-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
const runRoot = path.join(evidenceRoot, "v3-1.1-media-page-collector/runs", runId);
const screenshotRoot = path.join(runRoot, "screenshots");
const profileRoot = path.join(repoRoot, ".tmp", `${runId}-profile`);
const navigationTimeoutMs = Number(process.env.NAVIA_V3_NAVIGATION_TIMEOUT_MS || 60_000);
const headless = process.env.NAVIA_V3_HEADLESS !== "0";
const authenticatedRegression = process.env.NAVIA_V3_AUTHENTICATED_REGRESSION === "1";
const cookieSeedPath = process.env.NAVIA_V3_BILIBILI_COOKIE_FILE || "";
const anchorUrl = "https://www.bilibili.com/video/BV1ZpYd66ELP";

const allowedCookieNames = new Set([
  "DedeUserID",
  "DedeUserID__ckMd5",
  "SESSDATA",
  "b_nut",
  "bili_jct",
  "buvid3",
  "buvid4",
  "buvid_fp",
  "sid"
]);

const MESSAGE = {
  collect: "navia.media.collectPageContext",
  readPlayback: "navia.media.readPlayback",
  seek: "navia.media.seek"
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function toWindowsPath(filePath) {
  const result = await run("wslpath", ["-w", filePath]);
  ensure(result.code === 0, `wslpath failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim().replaceAll("\\", "/");
}

async function waitForCdp(port, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome has not exposed CDP yet.
    }
    await wait(300);
  }
  throw new Error("Chrome CDP endpoint did not become available.");
}

async function launchFreshChrome() {
  ensure(fs.existsSync(browserExecutable), `Chrome executable missing: ${browserExecutable}`);
  fs.rmSync(profileRoot, { recursive: true, force: true });
  fs.mkdirSync(profileRoot, { recursive: true, mode: 0o700 });
  const port = 12_200 + Math.floor(Math.random() * 500);
  const child = spawn(browserExecutable, [
    ...(headless ? ["--headless=new", "--hide-scrollbars"] : ["--window-position=40,40"]),
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--no-proxy-server",
    "--disable-popup-blocking",
    "--enable-logging=stderr",
    "--vmodule=extensions*=2,extension*=2",
    "--mute-audio",
    "--disable-gpu",
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    "--enable-features=ExtensionsSidePanel,SidePanelPinning",
    "--enable-unsafe-extension-debugging",
    "--window-size=1280,900",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${await toWindowsPath(profileRoot)}`,
    `--disable-extensions-except=${await toWindowsPath(extensionRoot)}`,
    `--load-extension=${await toWindowsPath(extensionRoot)}`,
    "about:blank"
  ], { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  child.stdout.on("data", (chunk) => { chromeLog += String(chunk); });
  child.stderr.on("data", (chunk) => { chromeLog += String(chunk); });
  try {
    await waitForCdp(port);
  } catch (error) {
    if (child.exitCode === null) child.kill("SIGTERM");
    const cleanup = `$root = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*${runId}-profile*' -and $_.CommandLine -notlike '*--type=*' } | Select-Object -First 1; if ($root) { & taskkill.exe /PID $root.ProcessId /T /F | Out-Null }`;
    await run("powershell.exe", ["-NoProfile", "-Command", cleanup]).catch(() => undefined);
    await wait(500);
    fs.mkdirSync(runRoot, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(runRoot, "chrome-startup.log"), chromeLog, { mode: 0o600 });
    fs.rmSync(profileRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    throw error;
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  ensure(context, "Chrome exposed no browser context.");
  return {
    browser,
    context,
    close: async () => {
      await browser.close().catch(() => undefined);
      if (child.exitCode === null) child.kill("SIGTERM");
      const cleanup = `$root = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*${runId}-profile*' -and $_.CommandLine -notlike '*--type=*' } | Select-Object -First 1; if ($root) { & taskkill.exe /PID $root.ProcessId /T /F | Out-Null }`;
      await run("powershell.exe", ["-NoProfile", "-Command", cleanup]).catch(() => undefined);
      await wait(1200);
      fs.rmSync(profileRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
      fs.writeFileSync(path.join(runRoot, "chrome.log"), chromeLog, { mode: 0o600 });
    }
  };
}

const extensionIdentityByContext = new WeakMap();

async function findNaviaExtension(context, timeoutMs = 20_000) {
  const cached = extensionIdentityByContext.get(context);
  if (cached) return cached;
  const startedAt = Date.now();
  let lastInstalled = [];
  let lastProbeErrors = [];
  while (Date.now() - startedAt < timeoutMs) {
    const workerUrls = context.serviceWorkers()
      .map((worker) => worker.url())
      .filter((url) => url.startsWith("chrome-extension://"));
    for (const workerUrl of workerUrls) {
      const id = new URL(workerUrl).host;
      const probe = await context.newPage();
      try {
        await probe.goto(`chrome-extension://${id}/mermaid-renderer.html`, { waitUntil: "domcontentloaded", timeout: 5_000 });
        const manifest = await probe.evaluate(() => chrome.runtime.getManifest());
        if (manifest?.name === "Navia") {
          const identity = { id, name: manifest.name, version: manifest.version, serviceWorkerUrls: workerUrls };
          extensionIdentityByContext.set(context, identity);
          return identity;
        }
      } catch (error) {
        lastProbeErrors = [{ id, error: error instanceof Error ? error.message : String(error) }];
      } finally {
        await probe.close();
      }
    }
    const diagnostics = await context.newPage();
    try {
      await diagnostics.goto("chrome://extensions");
      await diagnostics.waitForTimeout(500);
      const installed = await diagnostics.evaluate(() => {
        const manager = document.querySelector("extensions-manager");
        const list = manager?.shadowRoot?.querySelector("extensions-item-list");
        const items = list?.shadowRoot?.querySelectorAll("extensions-item") ?? [];
        return [...items].map((item) => {
          const data = item.data ?? {};
          return {
            id: data.id ?? item.getAttribute("id"),
            name: data.name ?? item.shadowRoot?.querySelector("#name")?.textContent?.trim(),
            state: data.state ?? null,
            path: data.path ?? null,
            disableReasons: data.disableReasons ?? [],
            manifestErrors: data.manifestErrors ?? [],
            runtimeWarnings: data.runtimeWarnings ?? []
          };
        });
      });
      lastInstalled = installed;
      const navia = installed.find((item) => item.name === "Navia" && item.id);
      if (navia) {
        const identity = { ...navia, serviceWorkerUrls: context.serviceWorkers().map((worker) => worker.url()) };
        extensionIdentityByContext.set(context, identity);
        return identity;
      }
    } finally {
      await diagnostics.close();
    }
    await wait(250);
  }
  throw new Error(`Navia extension unavailable: ${JSON.stringify({ serviceWorkers: context.serviceWorkers().map((worker) => worker.url()), installed: lastInstalled, probeErrors: lastProbeErrors })}`);
}

async function withExtensionApiPage(context, evaluator, argument) {
  const extension = await findNaviaExtension(context);
  const page = await context.newPage();
  try {
    await page.goto(`chrome-extension://${extension.id}/mermaid-renderer.html`, { waitUntil: "domcontentloaded" });
    return await page.evaluate(evaluator, argument);
  } finally {
    await page.close();
  }
}

async function sendToPage(context, pageUrl, message) {
  return withExtensionApiPage(context, async ({ pageUrl, message }) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.id !== undefined && candidate.url === pageUrl)
      ?? tabs.find((candidate) => candidate.id !== undefined && candidate.url?.startsWith(pageUrl.split("?")[0]));
    if (tab?.id === undefined) return { ok: false, error: `tab_not_found:${pageUrl}` };
    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }, { pageUrl, message });
}

async function describeExtensionState(context, page) {
  const workers = context.serviceWorkers().map((worker) => worker.url());
  let tabs = [];
  let targets = [];
  try {
    tabs = await withExtensionApiPage(context, async () => (await chrome.tabs.query({})).map((tab) => ({
      id: tab.id ?? null,
      status: tab.status ?? null,
      title: tab.title ?? null,
      url: tab.url ?? null
    })), undefined);
  } catch {
    // The worker absence is represented by workers and extension targets below.
  }
  try {
    const session = await context.newCDPSession(page);
    const result = await session.send("Target.getTargets");
    targets = result.targetInfos
      .filter((target) => target.url.startsWith("chrome-extension://"))
      .map((target) => ({ type: target.type, title: target.title, url: target.url }));
  } catch {
    // CDP target inspection is diagnostic only.
  }
  return { workers, tabs, targets };
}

async function waitForPortalBridge(context, page, sampleId) {
  try {
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-navia-content-bridge-ready") === "true",
      undefined,
      { timeout: 20_000 }
    );
  } catch (error) {
    const pageState = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      bridgeReady: document.documentElement.getAttribute("data-navia-content-bridge-ready"),
      bodyTextPrefix: document.body?.innerText.slice(0, 500) ?? ""
    })).catch(() => ({ url: page.url(), title: null, readyState: null, bridgeReady: null, bodyTextPrefix: "" }));
    const extensionState = await describeExtensionState(context, page);
    writeJson(path.join(runRoot, `${sampleId}-bridge-diagnostic.json`), {
      schemaVersion: "v3-media-page-bridge-diagnostic/v1",
      sampleId,
      observedAt: new Date().toISOString(),
      pageState,
      extensionState
    });
    throw new Error(`${sampleId}: static portal bridge unavailable: ${JSON.stringify({ pageState, extensionState })}`, { cause: error });
  }
}

async function startOrdinaryFixture() {
  const server = http.createServer((_, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><html><head><title>Ordinary Route A Fixture</title></head><body><main><h1>普通网页</h1><p>未调用扩展前不应静态注入 Navia。</p></main></body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}/ordinary` };
}

function hashBuildTree(root) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) entries.push({
        path: path.relative(root, absolute).replaceAll(path.sep, "/"),
        sha256: sha256(fs.readFileSync(absolute))
      });
    }
  };
  visit(root);
  return sha256(canonicalJson(entries));
}

function readAuthorizedLiveCookieSeed() {
  ensure(cookieSeedPath && fs.existsSync(cookieSeedPath), "authorized live-session seed is missing");
  const parsed = JSON.parse(fs.readFileSync(cookieSeedPath, "utf8"));
  ensure(Array.isArray(parsed), "authorized live-session seed must be a JSON array");
  const cookies = [];
  const rawValues = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const name = typeof row.name === "string" ? row.name : "";
    const value = typeof row.value === "string" ? row.value : "";
    const domain = typeof row.domain === "string" ? row.domain.toLowerCase() : "";
    if (!allowedCookieNames.has(name) || !value) continue;
    const normalizedDomain = domain.replace(/^\./, "");
    ensure(normalizedDomain === "bilibili.com" || normalizedDomain.endsWith(".bilibili.com"), "authorized seed contains a non-Bilibili domain");
    const cookie = {
      name,
      value,
      domain: ".bilibili.com",
      path: typeof row.path === "string" ? row.path : "/",
      httpOnly: row.httpOnly === true,
      secure: row.secure === true
    };
    const sameSite = row.sameSite === "strict"
      ? "Strict"
      : row.sameSite === "lax"
        ? "Lax"
        : row.sameSite === "no_restriction"
          ? "None"
          : null;
    if (sameSite) cookie.sameSite = sameSite;
    if (Number.isFinite(row.expirationDate)) cookie.expires = row.expirationDate;
    cookies.push(cookie);
    rawValues.push(Buffer.from(value));
  }
  ensure(cookies.some((cookie) => cookie.name === "SESSDATA"), "authorized seed has no nonempty required session cookie");
  ensure(new Set(cookies.map((cookie) => cookie.name)).size === allowedCookieNames.size, "authorized seed does not contain the frozen nine-name set");
  return { cookies, rawValues };
}

function scanRootsForSecrets(roots, rawValues) {
  const patterns = [/SESSDATA\s*[=:]/i, /bili_jct\s*[=:]/i, /DedeUserID\s*[=:]/i, /Cookie\s*:/i, /Authorization\s*:\s*Bearer/i];
  const hits = [];
  let scannedFiles = 0;
  let scannedBytes = 0;
  const visit = (root, directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(root, absolute);
      else if (entry.isFile()) {
        scannedFiles += 1;
        const bytes = fs.readFileSync(absolute);
        scannedBytes += bytes.length;
        const relativePath = path.relative(root, absolute).replaceAll(path.sep, "/");
        if (rawValues.some((needle) => needle.length >= 8 && bytes.includes(needle))) {
          hits.push({ root: path.basename(root), path: relativePath, kind: "raw_value" });
        }
        if (!absolute.endsWith(".png")) {
          const text = bytes.toString("utf8");
          for (const pattern of patterns) {
            if (pattern.test(text)) hits.push({ root: path.basename(root), path: relativePath, kind: "credential_pattern" });
          }
        }
      }
    }
  };
  for (const root of roots) visit(root, root);
  return { scannedFiles, scannedBytes, hitCount: hits.length, hits, passed: hits.length === 0 };
}

async function validateServerSession(context) {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(anchorUrl, { waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });
    const result = await page.evaluate(async () => {
      const response = await fetch("https://api.bilibili.com/x/web-interface/nav", {
        credentials: "include",
        headers: { accept: "application/json" }
      });
      const body = await response.json();
      return { httpStatus: response.status, code: body?.code ?? null, isLogin: body?.data?.isLogin === true };
    });
    return { ...result, passed: result.httpStatus === 200 && result.code === 0 && result.isLogin === true };
  } finally {
    await page.close();
  }
}

async function collectExpectedContext(context, page, sample) {
  const attempts = sample.primaryClass === "subtitle" ? 8 : 1;
  let responseValue = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    responseValue = await sendToPage(context, page.url(), { type: MESSAGE.collect });
    const ready = responseValue?.ok === true
      && (sample.primaryClass !== "subtitle" || responseValue.value?.transcriptAvailability === "available");
    if (ready) return { responseValue, attempts: attempt };
    if (attempt < attempts) await page.waitForTimeout(1_000);
  }
  return { responseValue, attempts };
}

async function collectSample(context, sample, index, buildSha256, portalRegistrySha256) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const sourceViewport = authenticatedRegression ? { width: 1280, height: 1000 } : { width: 1280, height: 900 };
  await page.setViewportSize(sourceViewport);
  page.setDefaultNavigationTimeout(navigationTimeoutMs);
  let navigationStatus = null;
  try {
    const response = await page.goto(sample.url, { waitUntil: "domcontentloaded" });
    navigationStatus = response?.status() ?? null;
    await page.waitForTimeout(5_000);
    await waitForPortalBridge(context, page, sample.sampleId);
    const collected = await collectExpectedContext(context, page, sample);
    const responseValue = collected.responseValue;
    if (responseValue?.ok !== true) {
      const productFailureDiagnostic = await page.evaluate(() => {
        const state = globalThis.__INITIAL_STATE__ ?? {};
        const videoData = state.videoData ?? state.videoInfo ?? {};
        const scripts = Array.from(document.scripts)
          .map((script) => script.textContent ?? "")
          .filter((text) => text.includes("__INITIAL_STATE__") || text.includes("__playinfo__"))
          .slice(0, 8)
          .map((text) => ({
            length: text.length,
            initialStateIndex: text.indexOf("__INITIAL_STATE__"),
            playInfoIndex: text.indexOf("__playinfo__"),
            prefix: text.slice(0, 300)
          }));
        const video = document.querySelector("video");
        return {
          url: location.href,
          title: document.title,
          globalState: {
            bvid: videoData.bvid ?? state.bvid ?? null,
            cid: videoData.cid ?? state.cid ?? null,
            title: videoData.title ?? null,
            author: videoData.owner?.name ?? null,
            duration: videoData.duration ?? null,
            pageCount: Array.isArray(videoData.pages) ? videoData.pages.length : null
          },
          dom: {
            h1: document.querySelector("h1")?.textContent?.trim() ?? null,
            author: document.querySelector(".up-name, .up-info-container .name, [class*='up-name']")?.textContent?.trim() ?? null,
            videoDuration: video && Number.isFinite(video.duration) ? video.duration : null
          },
          scripts
        };
      });
      writeJson(path.join(runRoot, `${sample.sampleId}-product-failure-diagnostic.json`), {
        schemaVersion: "v3-media-page-product-failure-diagnostic/v1",
        sampleId: sample.sampleId,
        response: responseValue,
        page: productFailureDiagnostic,
        observedAt: new Date().toISOString()
      });
    }
    ensure(responseValue?.ok === true, `${sample.sampleId}: product collector failed: ${JSON.stringify(responseValue)}`);
    const mediaContext = responseValue.value;
    const domObservation = await page.evaluate(() => {
      const video = document.querySelector("video");
      return {
        url: location.href,
        bridgeReady: document.documentElement.getAttribute("data-navia-content-bridge-ready"),
        bridgeMode: document.documentElement.getAttribute("data-navia-content-bridge-mode"),
        launcherPresent: Boolean(document.querySelector("[data-testid='navia-floating-launcher']")),
        videoDuration: video && Number.isFinite(video.duration) ? video.duration : null,
        videoCurrentTime: video && Number.isFinite(video.currentTime) ? video.currentTime : null
      };
    });
    ensure(mediaContext.adapterId === "bilibili" && mediaContext.platform === "bilibili" && mediaContext.adapterRevision === 1, `${sample.sampleId}: adapter binding mismatch`);
    ensure(mediaContext.mediaId === sample.bvid, `${sample.sampleId}: mediaId mismatch ${mediaContext.mediaId} != ${sample.bvid}`);
    ensure(mediaContext.playbackUnitId === sample.cid, `${sample.sampleId}: playbackUnitId mismatch ${mediaContext.playbackUnitId} != ${sample.cid}`);
    ensure(mediaContext.part.count === sample.partCount, `${sample.sampleId}: part count mismatch ${mediaContext.part.count} != ${sample.partCount}`);
    ensure(mediaContext.title && mediaContext.author && mediaContext.durationSeconds > 0, `${sample.sampleId}: context fields incomplete`);
    ensure(!Object.hasOwn(mediaContext, "bvid") && !Object.hasOwn(mediaContext, "cid"), `${sample.sampleId}: platform fields leaked`);
    ensure(domObservation.bridgeMode === "portal_auto" && domObservation.launcherPresent, `${sample.sampleId}: portal auto entry missing`);
    if (sample.primaryClass === "subtitle") ensure(mediaContext.transcriptAvailability === "available", `${sample.sampleId}: subtitle capability not observed`);
    if (sample.primaryClass === "restricted") ensure(mediaContext.transcriptAvailability === "restricted", `${sample.sampleId}: restricted capability not observed`);
    if (sample.bvid === "BV1ZpYd66ELP") ensure(mediaContext.transcriptAvailability !== "available", "anchor transcript was falsely marked available");
    const screenshotPath = path.join(screenshotRoot, `${sample.sampleId}.png`);
    const privacyCapture = authenticatedRegression
      ? {
          mode: "top_account_region_excluded",
          sourceViewport,
          clip: { x: 0, y: 100, width: 1280, height: 900 },
          output: { width: 1280, height: 900 }
        }
      : {
          mode: "full_viewport",
          sourceViewport,
          clip: { x: 0, y: 0, width: 1280, height: 900 },
          output: { width: 1280, height: 900 }
        };
    await page.screenshot({ path: screenshotPath, clip: privacyCapture.clip });
    return {
      sequence: index + 1,
      sampleId: sample.sampleId,
      url: sample.url,
      navigationStatus,
      buildSha256,
      portalRegistrySha256,
      expected: {
        mediaId: sample.bvid,
        playbackUnitId: sample.cid,
        partCount: sample.partCount,
        primaryClass: sample.primaryClass,
        expectedOutcome: sample.expectedOutcome
      },
      response: responseValue,
      collectionAttempts: collected.attempts,
      domObservation,
      pageErrors,
      privacyCapture,
      screenshotPath: path.relative(runRoot, screenshotPath).replaceAll(path.sep, "/"),
      screenshotSha256: sha256(fs.readFileSync(screenshotPath)),
      observedAt: new Date().toISOString(),
      passed: true
    };
  } finally {
    await page.close();
  }
}

async function verifyMultipartAndPlayback(context, sample) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  page.setDefaultNavigationTimeout(navigationTimeoutMs);
  try {
    const secondPartUrl = `${sample.url}?p=2`;
    await page.goto(secondPartUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5_000);
    await waitForPortalBridge(context, page, `${sample.sampleId}-multipart`);
    const second = await sendToPage(context, page.url(), { type: MESSAGE.collect });
    ensure(second?.ok === true && second.value.part.index === 2 && second.value.part.id === "p2", "multipart p=2 context missing");
    ensure(second.value.playbackUnitId !== sample.cid, "multipart playback unit did not change");
    const playback = await sendToPage(context, page.url(), { type: MESSAGE.readPlayback });
    ensure(playback?.ok === true && playback.value.durationSeconds > 0, "real playback snapshot unavailable");
    const target = Math.min(10, playback.value.durationSeconds / 4);
    const seek = await sendToPage(context, page.url(), { type: MESSAGE.seek, seconds: target });
    ensure(seek?.ok === true && Math.abs(seek.value.currentTimeSeconds - target) <= 2, "real playback seek not observed");
    const invalid = await sendToPage(context, page.url(), { type: MESSAGE.seek, seconds: playback.value.durationSeconds + 100 });
    ensure(invalid?.ok === false && invalid.failureCode === "V3_MEDIA_SEEK_INVALID", "invalid seek did not fail closed");
    return { secondPartContext: second.value, playback: playback.value, seek: seek.value, invalidSeek: invalid };
  } finally {
    await page.close();
  }
}

async function main() {
  ensure(fs.existsSync(path.join(extensionRoot, "manifest.json")), "Built extension manifest is missing.");
  const sampleRegistryBytes = fs.readFileSync(sampleRegistryPath);
  ensure(sha256(sampleRegistryBytes) === expectedSampleRegistrySha, "Frozen sample registry hash mismatch.");
  const sampleRegistry = JSON.parse(sampleRegistryBytes.toString("utf8"));
  ensure(sampleRegistry.samples.length === 12 && new Set(sampleRegistry.samples.map((item) => item.url)).size === 12, "Frozen sample denominator is not 12 unique URLs.");
  fs.rmSync(runRoot, { recursive: true, force: true });
  fs.mkdirSync(screenshotRoot, { recursive: true, mode: 0o700 });
  const buildSha256 = hashBuildTree(extensionRoot);
  const portalRegistrySha256 = sha256(fs.readFileSync(portalRegistryPath));
  const seed = authenticatedRegression ? readAuthorizedLiveCookieSeed() : { cookies: [], rawValues: [] };
  const ordinary = await startOrdinaryFixture();
  const launched = await launchFreshChrome();
  const observations = [];
  let multipartPlayback = null;
  let ordinaryPage = null;
  let browserVersion = null;
  let serverInputValidation = null;
  try {
    browserVersion = await launched.browser.version();
    if (authenticatedRegression) {
      await launched.context.addCookies(seed.cookies);
      serverInputValidation = await validateServerSession(launched.context);
      ensure(serverInputValidation.passed, "authorized live session did not pass server validation");
    }
    const extension = await findNaviaExtension(launched.context);
    const extensionManifest = await withExtensionApiPage(
      launched.context,
      () => chrome.runtime.getManifest(),
      undefined
    );
    ensure(extensionManifest.name === "Navia", "Loaded extension is not Navia.");
    writeJson(path.join(runRoot, "extension-load.json"), {
      schemaVersion: "v3-extension-load/v1",
      observedAt: new Date().toISOString(),
      extension,
      manifest: extensionManifest
    });
    const ordinaryTab = await launched.context.newPage();
    await ordinaryTab.goto(ordinary.url, { waitUntil: "domcontentloaded" });
    await ordinaryTab.waitForTimeout(1_000);
    ordinaryPage = await ordinaryTab.evaluate(() => ({
      url: location.href,
      bridgeReady: document.documentElement.getAttribute("data-navia-content-bridge-ready"),
      launcherPresent: Boolean(document.querySelector("[data-testid='navia-floating-launcher']")),
      sidebarPresent: Boolean(document.querySelector("[data-testid='navia-inpage-sidebar']"))
    }));
    ensure(!ordinaryPage.bridgeReady && !ordinaryPage.launcherPresent && !ordinaryPage.sidebarPresent, "ordinary page received static Navia injection");
    await ordinaryTab.close();

    for (let index = 0; index < sampleRegistry.samples.length; index += 1) {
      const sample = sampleRegistry.samples[index];
      process.stdout.write(`[${index + 1}/12] ${sample.sampleId} ${sample.url}\n`);
      const observation = await collectSample(launched.context, sample, index, buildSha256, portalRegistrySha256);
      observations.push(observation);
      writeJson(path.join(runRoot, "observations.partial.json"), { runId, observations });
    }
    multipartPlayback = await verifyMultipartAndPlayback(
      launched.context,
      sampleRegistry.samples.find((sample) => sample.primaryClass === "multipart")
    );
  } finally {
    await launched.close();
    await new Promise((resolve) => ordinary.server.close(resolve));
  }

  const result = {
    schemaVersion: "v3-media-page-collector-run/v1",
    evidenceClass: "production_candidate",
    sessionEvidenceClass: authenticatedRegression
      ? "user_authorized_live_session_seed_regression"
      : "anonymous_public_regression",
    runId,
    generatedAt: new Date().toISOString(),
    browser: {
      name: "Google Chrome",
      version: browserVersion,
      profileClass: authenticatedRegression ? "fresh_temporary_user_authorized_seed" : "fresh_temporary_public"
    },
    serverInputValidation,
    credentialSeedCookieCount: authenticatedRegression ? seed.cookies.length : 0,
    buildSha256,
    portalRegistrySha256,
    sampleRegistrySha256: expectedSampleRegistrySha,
    ordinaryPage,
    observations,
    multipartPlayback,
    cleanup: { profileDeleted: !fs.existsSync(profileRoot), chromeClosed: true, temporaryMediaResidualCount: 0 },
    summary: { total: observations.length, passed: observations.filter((item) => item.passed).length, failed: observations.filter((item) => !item.passed).length },
    passed: observations.length === 12
      && observations.every((item) => item.passed)
      && (!authenticatedRegression || serverInputValidation?.passed === true)
      && !fs.existsSync(profileRoot)
  };
  writeJson(path.join(runRoot, "result.json"), result);
  fs.rmSync(path.join(runRoot, "observations.partial.json"), { force: true });
  const secretScan = scanRootsForSecrets([runRoot, extensionRoot], seed.rawValues);
  writeJson(path.join(runRoot, "secret-scan.json"), {
    scannedAt: new Date().toISOString(),
    scannedFiles: secretScan.scannedFiles,
    scannedBytes: secretScan.scannedBytes,
    hitCount: secretScan.hitCount,
    hits: secretScan.hits,
    passed: secretScan.passed
  });
  seed.cookies.length = 0;
  seed.rawValues.length = 0;
  ensure(secretScan.passed, `Evidence secret scan failed in ${secretScan.hitCount} file observations.`);
  ensure(result.passed, "V3-1.1 media page collector run failed.");
  process.stdout.write(`${JSON.stringify({ runId, runRoot, buildSha256, portalRegistrySha256, summary: result.summary }, null, 2)}\n`);
}

main().catch((error) => {
  fs.mkdirSync(runRoot, { recursive: true, mode: 0o700 });
  writeJson(path.join(runRoot, "FAILED.json"), {
    schemaVersion: "v3-media-page-collector-failure/v1",
    runId,
    failedAt: new Date().toISOString(),
    error: authenticatedRegression ? "authenticated regression collector failed" : error instanceof Error ? error.message : String(error),
    profileDeleted: !fs.existsSync(profileRoot)
  });
  process.stderr.write(`${authenticatedRegression ? "authenticated regression collector failed; inspect non-secret run diagnostics" : error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 2;
});
