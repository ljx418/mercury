import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { PNG } from "pngjs";

const repo = resolve(import.meta.dirname, "../../..");
const extensionRoot = resolve(repo, "apps/chrome-extension/chrome-mv3-unpacked");
const runtimeRoot = resolve(repo, "services/local-runtime");
const bvid = process.env.NAVIA_MEDIA_UX_BVID ?? "BV1hMpE6FEXG";
if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) throw new Error("Invalid BVID");
const firstUsePermission = process.env.NAVIA_STAGE_A_FIRST_USE === "1";
const acceptNativePrompt = firstUsePermission && process.env.NAVIA_STAGE_A_ACCEPT_NATIVE_PROMPT === "1";
const cancelDuringMaterialization = process.env.NAVIA_STAGE_A_CANCEL_DURING_MATERIALIZATION === "1";
const reconnectCheck = process.env.NAVIA_STAGE_A_RECONNECT_CHECK === "1";
const routeDriftCheck = process.env.NAVIA_STAGE_A_ROUTE_DRIFT_CHECK === "1";
const chapterRecoveryCheck = process.env.NAVIA_STAGE_A_CHAPTER_RECOVERY_CHECK === "1";
const seekCheck = process.env.NAVIA_STAGE_A_SEEK_CHECK === "1";
const watchdogCheck = process.env.NAVIA_STAGE_A_WATCHDOG_CHECK === "1";
const navigationCheck = process.env.NAVIA_STAGE_A_NAVIGATION_CHECK === "1";
const checkWorkspace = process.env.NAVIA_STAGE_A_CHECK_WORKSPACE === "1";
const stageBSynthesis = process.env.NAVIA_STAGE_B_SYNTHESIZE === "1";
if (stageBSynthesis && !checkWorkspace) throw new Error("Stage B synthesis requires Workspace validation");
if (reconnectCheck && (!checkWorkspace || cancelDuringMaterialization)) throw new Error("Reconnect check requires Workspace and a dedicated run");
if (routeDriftCheck && (!checkWorkspace || cancelDuringMaterialization || reconnectCheck)) throw new Error("Route-drift check requires Workspace and a dedicated run");
if (chapterRecoveryCheck && (!checkWorkspace || cancelDuringMaterialization || reconnectCheck || routeDriftCheck)) throw new Error("Chapter-recovery check requires Workspace and a dedicated run");
if (seekCheck && (!checkWorkspace || cancelDuringMaterialization || reconnectCheck || routeDriftCheck || chapterRecoveryCheck)) throw new Error("Seek check requires Workspace and a dedicated run");
if (watchdogCheck && (checkWorkspace || cancelDuringMaterialization || reconnectCheck || routeDriftCheck || chapterRecoveryCheck || seekCheck)) throw new Error("Watchdog check requires a dedicated run");
if (navigationCheck && (!checkWorkspace || cancelDuringMaterialization || reconnectCheck || routeDriftCheck || chapterRecoveryCheck || seekCheck || watchdogCheck)) throw new Error("Navigation check requires Workspace and a dedicated run");
const scratch = mkdtempSync(join(tmpdir(), "navia-stage-a-fresh-"));
const testExtensionRoot = join(scratch, "extension");
let context;
let runtime;
let stageBResult = null;
let stageBOverviewScreenshot = null;

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForRuntime(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (runtime.exitCode !== null) throw new Error(`Isolated Runtime exited: ${runtime.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/health`);
      if (response.ok) return;
    } catch { /* Startup. */ }
    await delay(250);
  }
  throw new Error("Isolated Runtime did not become healthy");
}

async function inspectWorkspaceViewport(page, width, requiredSelector) {
  await page.setViewportSize({ width, height: 900 });
  await page.locator(requiredSelector).first().waitFor({ timeout: 20_000 });
  const overflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
  const violations = (await new AxeBuilder({ page }).analyze()).violations
    .filter((item) => item.impact === "serious" || item.impact === "critical")
    .map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length }));
  let result;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const screenshot = await page.screenshot();
    const png = PNG.sync.read(screenshot);
    const colors = new Set();
    let nonWhite = 0;
    let sampled = 0;
    for (let pixel = 0; pixel < png.width * png.height; pixel += 97) {
      const offset = pixel * 4;
      const red = png.data[offset];
      const green = png.data[offset + 1];
      const blue = png.data[offset + 2];
      colors.add(`${red},${green},${blue}`);
      if (red < 245 || green < 245 || blue < 245) nonWhite += 1;
      sampled += 1;
    }
    result = { width, overflowPx, violations, screenshotBytes: screenshot.length, distinctSampleColors: colors.size, nonWhiteSampleFraction: Number((nonWhite / sampled).toFixed(3)), captureAttempt: attempt + 1 };
    if (result.screenshotBytes >= 20_000 && colors.size >= 20 && nonWhite / sampled >= 0.03) break;
    await delay(500);
  }
  if (overflowPx || violations.length || result.screenshotBytes < 20_000 || result.distinctSampleColors < 20 || result.nonWhiteSampleFraction < 0.03) {
    throw new Error(`Workspace viewport failed: ${JSON.stringify(result)}`);
  }
  return result;
}

async function inspectTranscriptPreview(surface) {
  const raw = await surface.locator("[data-testid='media-transcript-quick-card']").evaluate((card) => {
    const preview = card.querySelector(".media-transcript-preview");
    return {
      taskId: card.getAttribute("data-task-id"),
      visible: preview instanceof HTMLDetailsElement && preview.open,
      label: preview?.querySelector("summary")?.textContent?.trim() ?? "",
      items: [...(preview?.querySelectorAll("li") ?? [])].map((item) => ({
        time: item.querySelector("time")?.textContent?.trim() ?? "",
        text: item.querySelector("span")?.textContent?.trim() ?? "",
      })),
    };
  });
  return {
    taskId: raw.taskId,
    visible: raw.visible,
    label: raw.label,
    count: raw.items.length,
    timestampedCount: raw.items.filter((item) => /^\d+:\d{2}$/.test(item.time)).length,
    nonemptyCount: raw.items.filter((item) => item.text.length > 0).length,
    textLengths: raw.items.map((item) => item.text.length),
    textSha256: raw.items.map((item) => createHash("sha256").update(item.text).digest("hex")),
  };
}

try {
  cpSync(extensionRoot, testExtensionRoot, { recursive: true });
  const manifestPath = join(testExtensionRoot, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!firstUsePermission) {
    manifest.permissions = [...new Set([...manifest.permissions, "cookies"])];
    manifest.host_permissions = [...new Set([...manifest.host_permissions, "https://*.bilibili.com/*"])];
    manifest.optional_permissions = [];
    manifest.optional_host_permissions = [];
  }
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const db = join(scratch, "navia.sqlite3");
  execFileSync("sqlite3", [join(repo, ".navia/navia.sqlite3"), `.backup '${db}'`]);
  if (stageBSynthesis) {
    execFileSync("sqlite3", [db, `PRAGMA foreign_keys=OFF;
      DELETE FROM media_ask_results;
      DELETE FROM media_evidence_refs;
      DELETE FROM media_outlines;
      DELETE FROM media_task_events;
      DELETE FROM media_task_idempotency;
      DELETE FROM media_task_outbox;
      DELETE FROM media_tasks;
      DELETE FROM media_vision_consent;
      DELETE FROM media_vision_dispatch_budget;
      DELETE FROM media_download_cache;
      PRAGMA foreign_keys=ON;`]);
  }
  context = await chromium.launchPersistentContext(join(scratch, "chrome"), {
    headless: false,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      "--mute-audio",
      "--disable-features=DisableLoadExtensionCommandLineSwitch",
      "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${testExtensionRoot}`,
      `--load-extension=${testExtensionRoot}`,
    ],
  });
  const browserAcquisitionPosts = [];
  const resolveResponses = [];
  const authorityReads = [];
  const workspaceProjectionReads = [];
  const workspaceHttpEvents = [];
  const outstandingRuntimeRequests = new Map();
  const visualResponses = [];
  context.on("request", (request) => {
    const requestUrl = new URL(request.url());
    const requestPath = requestUrl.pathname;
    if (requestUrl.hostname === "127.0.0.1") {
      outstandingRuntimeRequests.set(request, { at: Date.now(), method: request.method(), path: requestPath });
    }
    if (/^\/v1\/(?:media\/(?:outline-tasks|task-projections|tasks)\/|companion\/sessions|knowledge\/permissions)/.test(requestPath)) {
      let initiator = "unknown";
      try { initiator = request.frame().url(); } catch { initiator = request.serviceWorker()?.url() ?? "worker"; }
      if (initiator.includes("/workspace.html")) workspaceHttpEvents.push({ event: "request", at: Date.now(), method: request.method(), path: requestPath });
    }
    if (request.method() === "GET" && new URL(request.url()).pathname === "/v1/media/source-authority") {
      let initiator = "unknown";
      try { initiator = request.frame().url(); } catch { initiator = request.serviceWorker()?.url() ?? "worker"; }
      authorityReads.push({ at: Date.now(), initiator });
    }
    if (request.method() !== "POST" || !request.url().includes("/v1/media/acquisitions")) return;
    let initiator = "unknown";
    try { initiator = request.frame().url(); } catch { initiator = request.serviceWorker()?.url() ?? "worker"; }
    browserAcquisitionPosts.push({ at: Date.now(), path: new URL(request.url()).pathname, initiator });
  });
  context.on("response", (response) => {
    outstandingRuntimeRequests.delete(response.request());
    const responsePath = new URL(response.url()).pathname;
    if (/^\/v1\/(?:media\/(?:outline-tasks|task-projections|tasks)\/|companion\/sessions|knowledge\/permissions)/.test(responsePath)) {
      let initiator = "unknown";
      try { initiator = response.request().frame().url(); } catch { /* Service worker or detached frame. */ }
      if (initiator.includes("/workspace.html")) {
        const event = { event: "response", at: Date.now(), status: response.status(), path: responsePath };
        workspaceHttpEvents.push(event);
        if (/^\/v1\/media\/outline-tasks\/media_task_[a-f0-9]{32}$/.test(responsePath)) void response.json().then((body) => {
          event.taskState = body.data?.task?.state ?? null;
          event.taskRevision = body.data?.task?.revision ?? null;
        }).catch(() => undefined);
      }
    }
    if (/^\/v1\/media\/task-projections\/media_task_[a-f0-9]{32}$/.test(new URL(response.url()).pathname)) {
      let initiator = "unknown";
      try { initiator = response.request().frame().url(); } catch { /* Service worker or detached frame. */ }
      if (initiator.includes("/workspace.html")) void response.json().then((body) => {
        const projection = body.data?.projection;
        workspaceProjectionReads.push({ at: Date.now(), status: response.status(), taskId: projection?.taskId ?? null,
          revision: projection?.revision ?? null, state: projection?.state ?? null });
      }).catch(() => undefined);
    }
    if (/\/v1\/media\/outline-tasks\/media_task_[a-f0-9]{32}\/materialize-visual$/.test(new URL(response.url()).pathname)) {
      void response.finished().then(async () => {
        const body = await response.json().catch(() => null);
        visualResponses.push({ completedAt: Date.now(), status: response.status(), failureCode: body?.error?.code ?? null, taskId: response.url().match(/media_task_[a-f0-9]{32}/)?.[0] ?? null });
      }).catch(() => undefined);
    }
    if (new URL(response.url()).pathname !== "/v1/media/acquisitions/resolve") return;
    void response.json().then((body) => {
      resolveResponses.push({
        at: Date.now(), status: response.status(),
        disposition: body.data?.disposition ?? null,
        authoritativeTaskId: body.data?.authoritativeTaskId ?? null,
        error: body.error?.code ?? null,
      });
    }).catch(() => undefined);
  });
  context.on("requestfailed", (request) => {
    outstandingRuntimeRequests.delete(request);
    const requestPath = new URL(request.url()).pathname;
    if (!/^\/v1\/(?:media\/(?:outline-tasks|task-projections|tasks)\/|companion\/sessions|knowledge\/permissions)/.test(requestPath)) return;
    let initiator = "unknown";
    try { initiator = request.frame().url(); } catch { initiator = request.serviceWorker()?.url() ?? "worker"; }
    if (initiator.includes("/workspace.html")) workspaceHttpEvents.push({ event: "failed", at: Date.now(), method: request.method(), path: requestPath, failure: request.failure()?.errorText ?? null });
  });
  await context.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.__naviaAcquisitionPosts = [];
    window.__naviaWorkspaceLifecycle = [];
    let observedShell = null;
    let shellSequence = 0;
    const recordWorkspaceLifecycle = (event) => {
      if (!location.pathname.endsWith("/workspace.html")) return;
      window.__naviaWorkspaceLifecycle.push({ at: Date.now(), ...event });
      if (window.__naviaWorkspaceLifecycle.length > 100) window.__naviaWorkspaceLifecycle.shift();
    };
    const observeWorkspace = () => {
      if (!location.pathname.endsWith("/workspace.html")) return;
      const inspect = () => {
        const shell = document.querySelector("[data-testid='media-product-shell']");
        if (shell !== observedShell) {
          observedShell = shell;
          shellSequence += 1;
          recordWorkspaceLifecycle({ event: "shell", sequence: shellSequence, present: Boolean(shell), hash: location.hash });
        }
        const beacon = document.querySelector(".media-runtime-beacon");
        const status = beacon?.textContent?.trim() ?? null;
        if (status !== inspect.lastStatus) {
          inspect.lastStatus = status;
          recordWorkspaceLifecycle({ event: "runtime-status", status, hash: location.hash });
        }
      };
      inspect.lastStatus = undefined;
      inspect();
      new MutationObserver(inspect).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observeWorkspace, { once: true });
    else observeWorkspace();
    window.fetch = (...args) => {
      const request = args[0];
      const url = typeof request === "string" ? request : request instanceof Request ? request.url : String(request);
      const method = (args[1]?.method ?? (request instanceof Request ? request.method : "GET")).toUpperCase();
      if (method === "POST" && url.includes("/v1/media/acquisitions")) {
        window.__naviaAcquisitionPosts.push({ at: Date.now(), url: new URL(url).pathname, stack: new Error().stack?.slice(0, 700) });
      }
      const path = (() => { try { return new URL(url).pathname; } catch { return url; } })();
      if (method === "GET" && (/^\/v1\/media\/outline-tasks\/media_task_[a-f0-9]{32}$/.test(path)
        || /^\/v1\/media\/tasks\/media_task_[a-f0-9]{32}\/comprehension$/.test(path))) {
        recordWorkspaceLifecycle({ event: "fetch", method, path, hash: location.hash, stack: new Error().stack?.slice(0, 1200) });
      }
      return originalFetch(...args);
    };
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 20_000 });
  const extensionId = new URL(worker.url()).host;
  const port = await freePort();
  runtime = spawn(join(runtimeRoot, ".venv/bin/python"), ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: runtimeRoot,
    env: {
      ...process.env,
      NAVIA_DB_PATH: db,
      NAVIA_MEDIA_TASK_ROOT: join(scratch, "media-tasks"),
      NAVIA_MEDIA_ASR_TASK_ROOT: join(scratch, "media-asr-tasks"),
      NAVIA_MEDIA_DOWNLOAD_CACHE_ROOT: join(scratch, "media-download-cache"),
      NAVIA_MEDIA_VISUAL_YT_DLP_PATH: join(repo, ".navia/tools/yt-dlp"),
      NAVIA_LOCAL_FILES_EXTENSION_ID: extensionId,
      PYTHONPATH: ".",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let runtimeError = "";
  let runtimeOutput = "";
  runtime.stderr.on("data", (chunk) => { runtimeError = (runtimeError + String(chunk)).slice(-2500); });
  runtime.stdout.on("data", (chunk) => { runtimeOutput = (runtimeOutput + String(chunk)).slice(-5000); });
  const runtimeThreadDump = () => {
    try {
      return execFileSync("py-spy", ["dump", "--pid", String(runtime.pid)], {
        encoding: "utf8", timeout: 5_000, maxBuffer: 2 * 1024 * 1024,
      }).slice(-30_000);
    } catch (error) {
      return `py-spy unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
  };
  await waitForRuntime(port);
  await context.route("http://127.0.0.1:17861/**", (route) => route.continue({ url: route.request().url().replace(":17861/", `:${port}/`) }));
  await context.route("http://127.0.0.1:17861/v1/media/acquisitions/*/execute", async (route) => {
    await delay(watchdogCheck ? 75_000 : 30_000);
    await route.fallback();
  });
  let visualRequestHeld = false;
  let visualRequestCount = 0;
  const visualReleases = [];
  if (cancelDuringMaterialization || reconnectCheck) await context.route("http://127.0.0.1:17861/v1/media/outline-tasks/*/materialize-visual", async (route) => {
    visualRequestHeld = true;
    visualRequestCount += 1;
    await delay(reconnectCheck ? 45_000 : 20_000);
    await route.fallback();
    visualReleases.push({ releasedAt: Date.now(), taskId: route.request().url().match(/media_task_[a-f0-9]{32}/)?.[0] ?? null });
  });
  const video = await context.newPage();
  await video.goto(`https://www.bilibili.com/video/${bvid}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const sidepanel = await context.newPage();
  await video.bringToFront();
  await video.locator('[data-testid="navia-floating-launcher"]').waitFor({ timeout: 20_000 });
  await video.locator('[data-testid="navia-floating-launcher"]').click();
  const embedded = video.frameLocator('[data-testid="navia-inpage-sidebar-frame"]');
  await embedded.locator("[data-testid='navia-sidepanel-root']").waitFor({ state: "attached", timeout: 20_000 });
  await embedded.locator("[data-testid='chat-context-dock'] > summary").click();
  let nativePromptClicked = false;
  let nativePromptCapture = null;
  for (let attempt = 0; attempt < 80 && !resolveResponses.some((item) => item.disposition === "created"); attempt += 1) {
    const enable = embedded.locator("[data-testid='media-companion-enable']");
    if (await enable.isVisible().catch(() => false) && await enable.isEnabled()) {
      await enable.click();
      if (acceptNativePrompt && !nativePromptClicked) {
        await delay(800);
        nativePromptCapture = join(tmpdir(), `navia-stage-a-native-prompt-${process.pid}.png`);
        execFileSync("import", ["-window", "root", nativePromptCapture]);
        execFileSync("python3", ["-c", `
import ctypes
from time import sleep
x11 = ctypes.CDLL("libX11.so.6")
xtst = ctypes.CDLL("libXtst.so.6")
x11.XOpenDisplay.restype = ctypes.c_void_p
display = x11.XOpenDisplay(None)
if not display:
    raise RuntimeError("Xvfb display unavailable")
xtst.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
xtst.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
x11.XFlush.argtypes = [ctypes.c_void_p]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
xtst.XTestFakeMotionEvent(display, -1, 823, 266, 0)
xtst.XTestFakeButtonEvent(display, 1, 1, 0)
x11.XFlush(display)
sleep(0.1)
xtst.XTestFakeButtonEvent(display, 1, 0, 0)
x11.XFlush(display)
x11.XCloseDisplay(display)
`]);
        nativePromptClicked = true;
      }
    }
    await delay(250);
  }
  if (!resolveResponses.some((item) => item.disposition === "created")) {
    const diagnostic = await embedded.locator("[data-testid='navia-sidepanel-root']").evaluate((root) => ({
      status: root.querySelector(".media-launch-status")?.textContent?.trim(),
      detail: root.querySelector(".media-launch-detail")?.textContent?.trim(),
      failure: root.querySelector(".media-launch-diagnostic")?.textContent?.trim(),
      enable: Boolean(root.querySelector("[data-testid='media-companion-enable']")),
      top: root.querySelector(".chat-context-summary-copy strong")?.textContent?.trim(),
    }));
    if (firstUsePermission) {
      diagnostic.permission = await embedded.locator("[data-testid='navia-sidepanel-root']").evaluate(async () => ({
        cookies: await chrome.permissions.contains({ permissions: ["cookies"] }),
        bilibili: await chrome.permissions.contains({ origins: ["https://*.bilibili.com/*"] }),
      }));
      diagnostic.extensionPages = context.pages().map((page) => page.url());
      if (process.env.NAVIA_STAGE_A_CAPTURE_PROMPT === "1") {
        diagnostic.screenCapture = join(tmpdir(), `navia-stage-a-first-use-${process.pid}.png`);
        execFileSync("import", ["-window", "root", diagnostic.screenCapture]);
      }
    }
    throw new Error(`Embedded surface did not create a media task: ${JSON.stringify(diagnostic)}`);
  }
  let workspace = null;
  let workspaceLive = null;
  let routeDriftEvidence = null;
  const workspacePendingChecks = [];
  const workspaceOverviewChecks = [];
  if (checkWorkspace) {
    const createdTaskId = resolveResponses.find((item) => item.disposition === "created")?.authoritativeTaskId;
    if (!createdTaskId) throw new Error("Workspace live check has no created task ID");
    let oldReadHeld = false;
    let oldReadReleased = false;
    if (routeDriftCheck) await context.route(`http://127.0.0.1:17861/v1/media/task-projections/${createdTaskId}`, async (route) => {
      let initiator = "unknown";
      try { initiator = route.request().frame().url(); } catch { /* Not a document request. */ }
      if (!oldReadHeld && initiator.includes("/workspace.html")) {
        oldReadHeld = true;
        await delay(8_000);
        try { await route.fallback(); } finally { oldReadReleased = true; }
      } else await route.fallback();
    });
    workspace = await context.newPage();
    await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${createdTaskId}`, { waitUntil: "domcontentloaded" });
    if (routeDriftCheck) {
      for (let attempt = 0; attempt < 80 && !oldReadHeld; attempt += 1) await delay(100);
      if (!oldReadHeld) throw new Error("NJ-04 old Workspace projection read was not held");
      const unknownTaskId = `media_task_${"f".repeat(32)}`;
      await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${unknownTaskId}`, { waitUntil: "domcontentloaded" });
      await workspace.getByText("无法读取该媒体任务", { exact: true }).waitFor({ timeout: 15_000 });
      for (let attempt = 0; attempt < 100 && !oldReadReleased; attempt += 1) await delay(100);
      await delay(500);
      const wrongRoute = await workspace.locator("[data-testid='media-product-shell']").evaluate((element) => ({
        route: location.hash,
        taskId: element.getAttribute("data-task-id"),
        errorVisible: Boolean([...element.querySelectorAll("h2, h3")].find((item) => item.textContent?.trim() === "无法读取该媒体任务")),
        taskContentCount: element.querySelectorAll(".media-task-overview, .media-overview-structure").length,
      }));
      const oldResponse = workspaceProjectionReads.find((read) => read.taskId === createdTaskId && read.status === 200);
      const unknownResponse = workspaceProjectionReads.find((read) => read.status === 404);
      await workspace.goBack({ waitUntil: "domcontentloaded" });
      await workspace.locator(`[data-testid='media-product-shell'][data-task-id='${createdTaskId}']`).waitFor({ timeout: 20_000 });
      const recovered = await workspace.locator("[data-testid='media-product-shell']").evaluate((element) => ({
        route: location.hash, taskId: element.getAttribute("data-task-id"),
        taskContentCount: element.querySelectorAll(".media-task-overview, .media-overview-structure").length,
      }));
      routeDriftEvidence = { createdTaskId, unknownTaskId, oldReadHeld, oldReadReleased, oldResponse, unknownResponse,
        wrongRoute, recovered };
      if (!oldReadReleased || !oldResponse || !unknownResponse || wrongRoute.taskId !== "" || !wrongRoute.errorVisible
        || wrongRoute.taskContentCount !== 0 || !wrongRoute.route.includes(unknownTaskId)
        || recovered.taskId !== createdTaskId || recovered.taskContentCount < 1 || !recovered.route.includes(createdTaskId)) {
        throw new Error(`NJ-04 delayed read/route recovery failed: ${JSON.stringify(routeDriftEvidence)}`);
      }
    }
    if (!routeDriftCheck) {
    try {
      await workspace.locator(`[data-testid='media-product-shell'][data-task-id='${createdTaskId}']`).waitFor({ timeout: 20_000 });
    } catch (error) {
      const diagnostic = await workspace.evaluate(() => ({
        url: location.href,
        title: document.title,
        text: document.body?.innerText?.slice(0, 1500) ?? "",
        shell: document.querySelector("[data-testid='media-product-shell']")?.outerHTML.slice(0, 1000) ?? null,
      }));
      throw new Error(`Workspace did not read created task: ${JSON.stringify({ createdTaskId, diagnostic, runtimeError: runtimeError.slice(-1000) })}`, { cause: error });
    }
    const initial = await workspace.locator("[data-testid='media-product-shell']").evaluate((element) => ({
      revision: element.getAttribute("data-task-revision"),
      hasOutline: Boolean(element.querySelector(".media-overview-structure")),
      text: element.textContent?.slice(-300) ?? "",
    }));
    if (initial.hasOutline) throw new Error("Workspace was already published before the live transition check");
    for (const width of [360, 420, 768, 1280]) {
      workspacePendingChecks.push(await inspectWorkspaceViewport(workspace, width, ".media-task-overview"));
    }
    workspaceLive = { createdTaskId, initial, final: null, samePage: true };
    }
    await video.bringToFront();
  }
  await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });
  await video.bringToFront();
  await sidepanel.locator("[data-testid='chat-context-dock'] > summary").click();
  await sidepanel.locator(".media-launch-status").waitFor({ timeout: 20_000 });
  const observations = [];
  const started = Date.now();
  let outcome = "timeout";
  let readyAt = null;
  let enableClicked = false;
  let cancelClickedAt = null;
  let previewCheck = null;
  let reconnectEvidence = null;
  let watchdogEvidence = null;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (routeDriftCheck && routeDriftEvidence) { outcome = "route_drift_checked"; break; }
    const enable = sidepanel.locator("[data-testid='media-companion-enable']");
    if (!enableClicked && await enable.isVisible() && await enable.isEnabled()) {
      await enable.click();
      enableClicked = true;
    }
    const state = await sidepanel.evaluate(() => ({
      top: document.querySelector(".chat-context-summary-copy strong")?.textContent?.trim() ?? "",
      detail: document.querySelector(".chat-context-summary-copy small")?.textContent?.trim() ?? "",
      launch: document.querySelector(".media-launch-status")?.textContent?.trim() ?? "",
      launchDetail: document.querySelector(".media-launch-detail")?.textContent?.trim() ?? "",
      transcriptPreview: Boolean(document.querySelector("[data-testid='media-transcript-quick-card']")),
      transcriptTaskId: document.querySelector("[data-testid='media-transcript-quick-card']")?.getAttribute("data-task-id") ?? null,
      restoredTaskId: document.querySelector("[data-testid='media-restored-outline-card']")?.getAttribute("data-task-id") ?? null,
      restoredOutline: Boolean(document.querySelector("[data-testid='media-restored-outline-card']")),
      publishedOutline: Boolean(document.querySelector("[data-testid='media-quick-outline']")),
      materializing: Boolean(document.querySelector("[data-testid='media-outline-materializing']")),
      progressState: document.querySelector(".media-task-progress")?.getAttribute("data-state") ?? null,
      technical: document.querySelector(".media-launch-diagnostic")?.textContent?.trim() ?? "",
    }));
    const last = observations.at(-1);
    if (!last || JSON.stringify(last.state) !== JSON.stringify(state)) observations.push({ seconds: Math.floor((Date.now() - started) / 1000), state });
    if (reconnectCheck && visualRequestHeld && state.materializing && state.detail.startsWith("任务已用时")) {
      const taskId = resolveResponses.find((item) => item.disposition === "created")?.authoritativeTaskId;
      const beforeSeconds = Number(state.detail.match(/任务已用时 (\d+):(\d{2})/)?.[1] ?? NaN) * 60
        + Number(state.detail.match(/任务已用时 \d+:(\d{2})/)?.[1] ?? NaN);
      const beforeProgressAge = Number(state.detail.match(/最近进展 (\d+) 秒前/)?.[1] ?? NaN);
      await sidepanel.reload({ waitUntil: "domcontentloaded" });
      await sidepanel.locator("[data-testid='chat-context-dock'] > summary").click();
      await sidepanel.locator("[data-testid='media-transcript-quick-card']").waitFor({ timeout: 20_000 });
      await sidepanel.waitForFunction(() => document.querySelector(".chat-context-summary-copy small")?.textContent?.includes("任务已用时"), null, { timeout: 20_000 });
      const afterReload = await sidepanel.locator(".chat-context-summary-copy small").textContent();
      const afterSeconds = Number(afterReload?.match(/任务已用时 (\d+):(\d{2})/)?.[1] ?? NaN) * 60
        + Number(afterReload?.match(/任务已用时 \d+:(\d{2})/)?.[1] ?? NaN);
      const progressAgeAtReload = Number(afterReload?.match(/最近进展 (\d+) 秒前/)?.[1] ?? NaN);
      await delay(2_200);
      const afterWait = await sidepanel.locator(".chat-context-summary-copy small").textContent();
      const progressAgeAfterWait = Number(afterWait?.match(/最近进展 (\d+) 秒前/)?.[1] ?? NaN);
      const beforeRevision = await workspace.locator("[data-testid='media-product-shell']").getAttribute("data-task-revision");
      await workspace.locator(".media-runtime-details > summary").click();
      await workspace.locator("[data-testid='local-runtime-disconnect']").click();
      await workspace.locator("[data-testid='media-product-shell'][data-task-id='']").waitFor({ timeout: 10_000 });
      const hidden = await workspace.locator("[data-testid='media-product-shell']").evaluate((element) => ({
        taskId: element.getAttribute("data-task-id"),
        taskContentCount: element.querySelectorAll(".media-task-overview, .media-overview-structure").length,
        notice: element.querySelector(".media-product-loading")?.textContent?.trim() ?? "",
      }));
      const readsBeforeReconnect = workspaceProjectionReads.length;
      await workspace.locator("[data-testid='local-runtime-connect']").click();
      await workspace.locator(`[data-testid='media-product-shell'][data-task-id='${taskId}']`).waitFor({ timeout: 20_000 });
      for (let attempt = 0; attempt < 40 && workspaceProjectionReads.length <= readsBeforeReconnect; attempt += 1) await delay(250);
      const authoritativeRead = workspaceProjectionReads.slice(readsBeforeReconnect).find((read) => read.status === 200 && read.taskId === taskId);
      const afterRevision = await workspace.locator("[data-testid='media-product-shell']").getAttribute("data-task-revision");
      const reconnectStatus = await workspace.locator("[data-testid='local-runtime-status']").textContent();
      reconnectEvidence = { taskId, beforeSeconds, beforeProgressAge, afterSeconds, progressAgeAtReload,
        progressAgeAfterWait, beforeRevision, afterRevision, hidden, reconnectStatus, readsBeforeReconnect, authoritativeRead };
      if (!taskId || !Number.isFinite(beforeSeconds) || beforeSeconds < 20 || !Number.isFinite(beforeProgressAge)
        || !Number.isFinite(afterSeconds) || afterSeconds < beforeSeconds
        || !Number.isFinite(progressAgeAtReload) || !Number.isFinite(progressAgeAfterWait)
        || progressAgeAfterWait < progressAgeAtReload + 1
        || hidden.taskId !== "" || hidden.taskContentCount !== 0 || !hidden.notice.includes("历史任务内容已暂时隐藏")
        || reconnectStatus !== "本机伴侣已连接"
        || !authoritativeRead || !Number.isInteger(authoritativeRead.revision) || authoritativeRead.revision < 1
        || (beforeRevision && afterRevision && Number(afterRevision) < Number(beforeRevision))) {
        throw new Error(`NJ-02 reload/reconnect did not meet its gate: ${JSON.stringify(reconnectEvidence)}`);
      }
      outcome = "reconnect_checked";
      break;
    }
    if (cancelDuringMaterialization) {
      const cancel = sidepanel.locator("[data-testid='media-transcript-cancel']");
      if (cancelClickedAt === null && visualRequestHeld && state.materializing && await cancel.isVisible().catch(() => false) && await cancel.isEnabled()) {
        if (checkWorkspace) {
          const taskId = resolveResponses.find((item) => item.disposition === "created")?.authoritativeTaskId;
          const [standalone, inPage, workspaceState] = await Promise.all([
            inspectTranscriptPreview(sidepanel),
            inspectTranscriptPreview(embedded),
            workspace.locator("[data-testid='media-product-shell']").evaluate((element) => ({
              taskId: element.getAttribute("data-task-id"),
              hasOutline: Boolean(element.querySelector(".media-overview-structure")),
            })),
          ]);
          previewCheck = { taskId, standalone, inPage, workspace: workspaceState, top: state.top };
          const valid = taskId && [standalone, inPage].every((preview) => preview.taskId === taskId
            && preview.visible && preview.label.includes("预览") && preview.label.includes("不是全片概览")
            && preview.count > 0 && preview.timestampedCount === preview.count && preview.nonemptyCount === preview.count)
            && workspaceState.taskId === taskId && !workspaceState.hasOutline && state.top !== "视频内容已就绪";
          if (!valid) throw new Error(`NJ-01 preview did not meet the pre-outline gate: ${JSON.stringify(previewCheck)}`);
        }
        await cancel.click();
        cancelClickedAt = Date.now();
      }
      if (cancelClickedAt !== null && Date.now() - cancelClickedAt >= 22_000) {
        const authorityRows = JSON.parse(execFileSync("sqlite3", ["-json", db, `SELECT state FROM media_source_authority WHERE source_identity LIKE '%${bvid}%'`], { encoding: "utf8" }) || "[]");
        outcome = authorityRows.length === 1 && authorityRows[0].state === "cancelled" && state.progressState === "cancelled" ? "cancelled" : "cancel_not_closed";
        break;
      }
      if (cancelClickedAt !== null) { await delay(1_000); continue; }
    }
    if (state.top === "视频内容已就绪" && (state.publishedOutline || state.restoredOutline)) {
      readyAt ??= Date.now();
      if (Date.now() - readyAt >= 10_000 && (resolveResponses.length >= 2 || authorityReads.some((item) => item.initiator.endsWith("/sidepanel.html")))) { outcome = "ready"; break; }
    }
    if (state.launch === "准备失败" || state.launch === "分析受阻") {
      const rows = JSON.parse(execFileSync("sqlite3", ["-json", db,
        `SELECT task_id,state FROM media_source_authority WHERE source_identity LIKE '%${bvid}%'`], { encoding: "utf8" }) || "[]");
      const awaitingStart = rows.some((row) => row.state === "active" && row.task_id === state.transcriptTaskId && state.progressState === "created");
      if (watchdogCheck && awaitingStart && state.launch === "分析受阻" && state.technical.includes("V3_MEDIA_TASK_AWAITING_START")) {
        watchdogEvidence = { elapsedSeconds: Math.floor((Date.now() - started) / 1000), authorityState: "active",
          taskState: "created", failureCode: "V3_MEDIA_TASK_AWAITING_START",
          retryVisible: await sidepanel.locator("[data-testid='media-companion-retry']").isVisible() };
        if (watchdogEvidence.elapsedSeconds < 40 || !watchdogEvidence.retryVisible) {
          throw new Error(`Created-task watchdog appeared too early or without retry: ${JSON.stringify(watchdogEvidence)}`);
        }
        outcome = "watchdog_checked";
        break;
      }
      if (awaitingStart) {
        throw new Error("Chat showed a terminal failure while the authoritative task was active and awaiting its execute request");
      }
      outcome = "blocked";
      break;
    }
    if (attempt === 60 && resolveResponses.length < 2 && !authorityReads.some((item) => item.initiator.endsWith("/sidepanel.html"))) { outcome = "second_surface_not_started"; break; }
    if (attempt === 90 && !enableClicked && state.launch === "首次启用") { outcome = "permission_not_started"; break; }
    if (attempt === 90 && enableClicked && !state.transcriptPreview && !state.materializing) {
      const taskCount = Number(execFileSync("sqlite3", [db, `SELECT count(*) FROM media_tasks WHERE source_identity LIKE '%${bvid}%'`], { encoding: "utf8" }).trim());
      if (taskCount === 0) { outcome = "no_task_after_permission"; break; }
    }
    await delay(1_000);
  }
  const embeddedTaskIdBeforeWorkspace = outcome === "ready"
    ? await embedded.locator("[data-testid='media-transcript-quick-card']").getAttribute("data-task-id", { timeout: 1_000 }).catch(() => null)
      ?? await embedded.locator("[data-testid='media-restored-outline-card']").getAttribute("data-task-id", { timeout: 1_000 }).catch(() => null)
    : null;
  let secondTabTaskId = null;
  let secondVideo = null;
  if (outcome === "ready") {
    secondVideo = await context.newPage();
    await secondVideo.goto(`https://www.bilibili.com/video/${bvid}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await secondVideo.locator('[data-testid="navia-floating-launcher"]').click({ timeout: 20_000 });
    const secondEmbedded = secondVideo.frameLocator('[data-testid="navia-inpage-sidebar-frame"]');
    for (let attempt = 0; attempt < 60 && !secondTabTaskId; attempt += 1) {
      secondTabTaskId = await secondEmbedded.locator("[data-testid='media-transcript-quick-card']").getAttribute("data-task-id", { timeout: 200 }).catch(() => null)
        ?? await secondEmbedded.locator("[data-testid='media-restored-outline-card']").getAttribute("data-task-id", { timeout: 200 }).catch(() => null);
      if (!secondTabTaskId) await delay(500);
    }
  }
  const workspaceChecks = [];
  let workspaceKeyboardRoute = false;
  const workspaceMindmapChecks = [];
  let workspaceMindmapKeyboard = false;
  let chapterRecoveryEvidence = null;
  let seekEvidence = null;
  let evidenceReturnEvidence = null;
  let dialogEvidence = null;
  const workspaceNegativeChecks = {};
  let workspaceCancelled = null;
  let embeddedCancelled = null;
  let standaloneCancelled = null;
  if (checkWorkspace && cancelDuringMaterialization && outcome === "cancelled") {
    const cancelledTaskId = resolveResponses.find((item) => item.disposition === "created")?.authoritativeTaskId;
    await workspace.locator(`[data-testid='media-product-shell'][data-task-id='${cancelledTaskId}'] .media-task-state span`).waitFor({ timeout: 20_000 });
    try {
      await workspace.getByText("cancelled", { exact: true }).first().waitFor({ timeout: 20_000 });
    } catch (error) {
      const diagnostic = await workspace.locator("[data-testid='media-product-shell']").evaluate((element) => ({
        taskId: element.getAttribute("data-task-id"),
        revision: element.getAttribute("data-task-revision"),
        text: element.textContent?.slice(-700) ?? "",
      }));
      const store = JSON.parse(execFileSync("sqlite3", ["-json", db, `SELECT task_id,state,revision,terminal_failure_code FROM media_tasks WHERE task_id='${cancelledTaskId}'`], { encoding: "utf8" }) || "[]");
      const authority = JSON.parse(execFileSync("sqlite3", ["-json", db, `SELECT task_id,state FROM media_source_authority WHERE task_id='${cancelledTaskId}'`], { encoding: "utf8" }) || "[]");
      throw new Error(`Workspace cancellation state did not converge: ${JSON.stringify({ diagnostic, store, authority, embedded: await embedded.locator(".media-task-progress").getAttribute("data-state").catch(() => null) })}`, { cause: error });
    }
    workspaceCancelled = await workspace.locator("[data-testid='media-product-shell']").evaluate((element) => ({
      taskId: element.getAttribute("data-task-id"),
      state: element.querySelector(".media-task-state span")?.textContent?.trim() ?? null,
      hasOutline: Boolean(element.querySelector(".media-overview-structure")),
    }));
    embeddedCancelled = await embedded.locator(".media-task-progress").getAttribute("data-state").catch(() => null);
    standaloneCancelled = await sidepanel.evaluate(() => ({
      taskId: document.querySelector("[data-testid='media-transcript-quick-card']")?.getAttribute("data-task-id") ?? null,
      state: document.querySelector(".media-task-progress")?.getAttribute("data-state") ?? null,
    }));
    if (workspaceCancelled.taskId !== cancelledTaskId || workspaceCancelled.state !== "cancelled" || workspaceCancelled.hasOutline
      || embeddedCancelled !== "cancelled" || standaloneCancelled.taskId !== cancelledTaskId || standaloneCancelled.state !== "cancelled") {
      throw new Error(`Cross-surface cancellation did not close: ${JSON.stringify({ workspaceCancelled, embeddedCancelled, standaloneCancelled })}`);
    }
  }
  if (checkWorkspace && outcome === "ready") {
    const taskId = resolveResponses.find((item) => item.disposition === "created")?.authoritativeTaskId;
    if (!taskId) throw new Error("Workspace check has no authoritative task ID");
    await workspace.locator(".media-overview-structure a").first().waitFor({ timeout: 30_000 });
    workspaceLive.final = await workspace.locator("[data-testid='media-product-shell']").evaluate((element) => ({
      taskId: element.getAttribute("data-task-id"),
      revision: element.getAttribute("data-task-revision"),
      hasOutline: Boolean(element.querySelector(".media-overview-structure")),
    }));
    if (workspaceLive.final.taskId !== taskId || !workspaceLive.final.hasOutline || Number(workspaceLive.final.revision) <= Number(workspaceLive.initial.revision)) {
      throw new Error(`Workspace did not publish the same task live: ${JSON.stringify(workspaceLive)}`);
    }
    for (const width of [360, 420, 768, 1280]) {
      workspaceOverviewChecks.push(await inspectWorkspaceViewport(workspace, width, ".media-overview-structure a"));
    }
    await workspace.locator(".media-overview-structure a").first().click();
    await workspace.locator(".media-chapter-list details[open]").first().waitFor({ timeout: 10_000 });
    if (!new URL(workspace.url()).hash.includes("?chapter=") || await workspace.getByText("无效媒体路由", { exact: true }).count()) {
      throw new Error("Fresh-task chapter navigation failed");
    }
    for (const width of [360, 420, 768, 1280]) {
      workspaceChecks.push(await inspectWorkspaceViewport(workspace, width, ".media-chapter-list"));
    }
    await workspace.locator(".media-chapter-index a").last().focus();
    await workspace.keyboard.press("Enter");
    await workspace.locator(".media-chapter-list details[open]").last().waitFor({ timeout: 10_000 });
    workspaceKeyboardRoute = await workspace.locator("[data-route-kind]").getAttribute("data-route-kind") === "outline";
    if (!workspaceKeyboardRoute) throw new Error("Fresh-task keyboard chapter navigation failed");
    if (chapterRecoveryCheck) {
      const absentChapterId = "chapter_deadbeefdeadbeef";
      await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${taskId}/outline?chapter=${absentChapterId}`, { waitUntil: "domcontentloaded" });
      const alert = workspace.locator(".media-chapter-unavailable[role='alert']");
      await alert.waitFor({ timeout: 20_000 });
      const alertText = await alert.textContent();
      const returnLink = alert.getByRole("link", { name: "返回本任务大纲" });
      const returnHref = await returnLink.getAttribute("href");
      await returnLink.focus();
      await workspace.keyboard.press("Enter");
      await workspace.waitForFunction(() => !location.hash.includes("?chapter="), null, { timeout: 10_000 });
      await delay(250);
      const after = await workspace.evaluate(() => ({
        hash: location.hash,
        taskId: document.querySelector("[data-testid='media-product-shell']")?.getAttribute("data-task-id") ?? null,
        invalidRoute: document.body.textContent?.includes("无效媒体路由") ?? false,
        focusTag: document.activeElement?.tagName ?? null,
        meaningfulFocus: Boolean(document.activeElement?.closest(".media-chapter-index, .media-semantic-outline .media-view-intro")),
      }));
      chapterRecoveryEvidence = { taskId, absentChapterId, alertText, returnHref, after };
      if (!alertText?.includes("该章节不属于当前视频任务") || returnHref !== `#/media/tasks/${taskId}/outline`
        || after.taskId !== taskId || after.invalidRoute || !after.meaningfulFocus) {
        throw new Error(`NJ-05 chapter recovery did not meet its gate: ${JSON.stringify(chapterRecoveryEvidence)}`);
      }
    }
    if (seekCheck) {
      const targetChapter = workspace.locator(".media-chapter-list details").last();
      const seek = targetChapter.locator(".media-chapter-actions [data-seek-origin='chapter']").first();
      for (let attempt = 0; attempt < 3 && !await seek.isVisible(); attempt += 1) {
        if (await targetChapter.getAttribute("open") === null) await targetChapter.locator("summary").click();
        await seek.waitFor({ state: "visible", timeout: 2_000 }).catch(() => undefined);
      }
      if (!await seek.isVisible()) {
        const diagnostic = await targetChapter.evaluate((element) => ({ open: element.open, route: location.hash,
          presentation: document.querySelector(".media-outline-presentation button.active")?.textContent?.trim() ?? null,
          seekExists: Boolean(element.querySelector("[data-seek-origin='chapter']")) }));
        throw new Error(`NJ-06 later chapter seek control did not remain visible: ${JSON.stringify(diagnostic)}`);
      }
      const requestedMs = Number(await seek.getAttribute("data-seek-ms"));
      await seek.click();
      const receipt = targetChapter.locator(".media-chapter-actions [data-seek-outcome]").first();
      await receipt.waitFor({ timeout: 20_000 });
      const matched = await receipt.evaluate((element) => ({
        outcome: element.getAttribute("data-seek-outcome"),
        requestedMs: Number(element.getAttribute("data-seek-requested-ms")),
        observedMs: Number(element.getAttribute("data-seek-observed-ms")),
        deltaMs: Number(element.getAttribute("data-seek-delta-ms")),
        observedAt: element.getAttribute("data-seek-observed-at"),
        failureCode: element.textContent?.match(/V3_MEDIA_[A-Z_]+/)?.[0] ?? null,
      }));
      await video.close();
      await secondVideo.close();
      const matchingTabsAfterClose = context.pages().filter((page) => page.url().startsWith("https://www.bilibili.com/video/")).length;
      await seek.click();
      await targetChapter.locator(".media-chapter-actions [data-seek-outcome='blocked']").first().waitFor({ timeout: 20_000 });
      const afterClose = await receipt.evaluate((element) => ({
        outcome: element.getAttribute("data-seek-outcome"),
        requestedMs: Number(element.getAttribute("data-seek-requested-ms")),
        observedMs: Number(element.getAttribute("data-seek-observed-ms")),
        deltaMs: Number(element.getAttribute("data-seek-delta-ms")),
        observedAt: element.getAttribute("data-seek-observed-at"),
        failureCode: element.textContent?.match(/V3_MEDIA_[A-Z_]+/)?.[0] ?? null,
      }));
      const matchingTabsAfterBlocked = context.pages().filter((page) => page.url().startsWith("https://www.bilibili.com/video/")).length;
      seekEvidence = { taskId, requestedMs, matched, afterClose, matchingTabsAfterClose, matchingTabsAfterBlocked };
      if (!Number.isInteger(requestedMs) || requestedMs < 10_000 || !["located", "fallback"].includes(matched.outcome)
        || matched.requestedMs !== requestedMs || !Number.isFinite(matched.observedMs)
        || matched.deltaMs !== Math.abs(matched.observedMs - requestedMs) || !Date.parse(matched.observedAt ?? "")
        || (matched.outcome === "located" && matched.deltaMs > 2000)
        || (matched.outcome === "fallback" && matched.deltaMs <= 2000)
        || matchingTabsAfterClose !== 0 || matchingTabsAfterBlocked !== 0
        || afterClose.outcome !== "blocked" || afterClose.requestedMs !== requestedMs || !afterClose.failureCode) {
        throw new Error(`NJ-06 seek receipts did not meet the gate: ${JSON.stringify(seekEvidence)}`);
      }
    }
    if (stageBSynthesis) {
      await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${taskId}/outline`, { waitUntil: "domcontentloaded" });
      const opener = workspace.locator(".media-quality-control > button");
      await opener.waitFor({ state: "visible", timeout: 30_000 });
      await opener.click();
      const dialog = workspace.getByRole("dialog", { name: "允许本次视频进行结构化理解？" });
      await dialog.waitFor({ timeout: 10_000 });
      await dialog.getByRole("button", { name: "允许并生成" }).click();
      try {
        await workspace.waitForFunction(() => {
          const dialog = document.querySelector(".media-synthesis-dialog");
          return dialog === null || dialog.querySelector("[role='alert']") !== null;
        }, null, { timeout: 700_000 });
        if (await dialog.count()) throw new Error("provider result was rejected");
      } catch (error) {
        const diagnostic = await dialog.evaluate((element) => ({
          text: element.textContent?.trim().slice(-1200) ?? "",
          progress: element.querySelector("[role='status']")?.textContent?.trim() ?? null,
          alert: element.querySelector("[role='alert']")?.textContent?.trim() ?? null,
          generateDisabled: element.querySelector("button")?.hasAttribute("disabled") ?? null,
        })).catch(() => ({ text: "dialog detached during diagnostic", progress: null, alert: null, generateDisabled: null }));
        throw new Error(`Stage B synthesis did not publish: ${JSON.stringify({ diagnostic, runtimeTail: runtimeError.slice(-2000), runtimeOutputTail: runtimeOutput.slice(-2000), cause: error instanceof Error ? error.message : String(error) })}`);
      }
      await workspace.locator("[data-quality-mode='grounded_model']").waitFor({ timeout: 30_000 });
      await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${taskId}`, { waitUntil: "domcontentloaded" });
      await workspace.locator(".media-overview-hero").waitFor({ timeout: 30_000 });
      const viewports = [];
      for (const width of [360, 420, 768, 1280]) {
        viewports.push(await inspectWorkspaceViewport(workspace, width, ".media-overview-hero"));
      }
      stageBOverviewScreenshot = await workspace.screenshot({ fullPage: true });
      const versionedRoots = [
        join(scratch, "media-tasks", "product-evidence", "grounded-comprehension-v2.1", taskId),
        join(scratch, "media-tasks", "product-evidence", "grounded-comprehension-v2", taskId),
      ];
      const derivativePaths = versionedRoots.flatMap((derivativeRoot) => existsSync(derivativeRoot)
        ? readdirSync(derivativeRoot, { recursive: true }).filter((name) => String(name).endsWith(".json")).map((name) => join(derivativeRoot, String(name)))
        : []);
      if (derivativePaths.length !== 1) throw new Error(`Stage B expected one versioned derivative, found ${derivativePaths.length}`);
      const derivativeBytes = readFileSync(derivativePaths[0]);
      const derivative = JSON.parse(derivativeBytes.toString("utf8"));
      if (!["v3-media-grounded-comprehension/v2", "v3-media-grounded-comprehension/v2.1"].includes(derivative.schemaVersion)) {
        throw new Error(`Stage B derivative schema is unsupported: ${derivative.schemaVersion}`);
      }
      if (derivative.schemaVersion === "v3-media-grounded-comprehension/v2.1"
        && !["provider", "deterministic_claim_composer"].includes(derivative.brief?.origin)) {
        throw new Error(`Stage B V2.1 derivative has no valid brief origin: ${derivative.brief?.origin}`);
      }
      const ui = await workspace.evaluate(() => ({
        brief: document.querySelector(".media-overview-hero > div")?.textContent?.trim() ?? null,
        briefOrigin: document.querySelector("[data-testid='media-brief-origin']")?.getAttribute("data-brief-origin") ?? null,
        claims: [...document.querySelectorAll(".media-overview-evidence article > strong")].map((item) => item.textContent?.trim() ?? ""),
        limited: document.querySelector(".media-grounded-limited")?.textContent?.trim() ?? null,
      }));
      stageBResult = {
        taskId,
        derivativeSha256: createHash("sha256").update(derivativeBytes).digest("hex"),
        binding: derivative.binding,
        brief: derivative.brief,
        claims: derivative.claims,
        chapters: derivative.chapters,
        regions: derivative.regions,
        quality: derivative.quality,
        receipt: derivative.receipt,
        ui,
        viewports,
        screenshotSha256: createHash("sha256").update(stageBOverviewScreenshot).digest("hex"),
      };
      const expectedOrigin = derivative.schemaVersion === "v3-media-grounded-comprehension/v2.1" ? derivative.brief.origin : null;
      if (ui.brief !== derivative.brief.text || ui.claims.length !== derivative.claims.length || ui.briefOrigin !== expectedOrigin) {
        throw new Error(`Stage B UI projection mismatch: ${JSON.stringify({ ui, brief: derivative.brief.text, claims: derivative.claims.length })}`);
      }
    }
    if (navigationCheck) {
      await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${taskId}/outline`, { waitUntil: "domcontentloaded" });
      const laterChapter = workspace.locator(".media-chapter-list details").last();
      if (await laterChapter.getAttribute("open") === null) await laterChapter.locator("summary").click();
      const origin = laterChapter.locator(".media-chapter-actions [data-evidence-return-id]").first();
      await origin.waitFor({ state: "visible", timeout: 20_000 });
      const evidenceId = await origin.getAttribute("data-evidence-return-id");
      const originKey = await origin.getAttribute("data-evidence-return-key");
      const returnHash = new URL(workspace.url()).hash;
      await origin.click();
      await workspace.locator("[data-testid='media-evidence-view']").waitFor({ timeout: 20_000 });
      const openedHash = new URL(workspace.url()).hash;
      await workspace.keyboard.press("Escape");
      await workspace.waitForFunction((hash) => location.hash === hash, returnHash, { timeout: 20_000 });
      try {
        await workspace.waitForFunction(([id, key]) => document.activeElement?.getAttribute("data-evidence-return-id") === id
          && document.activeElement?.getAttribute("data-evidence-return-key") === key, [evidenceId, originKey], { timeout: 20_000 });
      } catch {
        const diagnostic = await workspace.evaluate(([id, key]) => ({
          hash: location.hash,
          shellTaskId: document.querySelector("[data-testid='media-product-shell']")?.getAttribute("data-task-id") ?? null,
          routeKind: document.querySelector("[data-testid='media-product-shell']")?.getAttribute("data-route-kind") ?? null,
          targetCount: Array.from(document.querySelectorAll("[data-evidence-return-id]"))
            .filter((element) => element.getAttribute("data-evidence-return-id") === id && element.getAttribute("data-evidence-return-key") === key).length,
          activeTag: document.activeElement?.tagName ?? null,
          activeEvidenceId: document.activeElement?.getAttribute("data-evidence-return-id") ?? null,
          bindingPresent: sessionStorage.getItem("navia.mediaEvidenceReturn.v1") !== null,
          binding: (() => { try { const value = JSON.parse(sessionStorage.getItem("navia.mediaEvidenceReturn.v1") ?? "null");
            return value && { taskId: value.taskId, evidenceId: value.evidenceId, triggerKey: value.triggerKey, returnHash: value.returnHash }; }
          catch { return "invalid_json"; } })(),
          loading: Boolean(document.querySelector(".media-product-loading")),
          error: Boolean(document.querySelector(".media-product-empty[role='alert']")),
        }), [evidenceId, originKey]);
        throw new Error(`NJ-07 focus return timeout: ${JSON.stringify(diagnostic)}`);
      }
      await workspace.waitForFunction(() => sessionStorage.getItem("navia.mediaEvidenceReturn.v1") === null, null, { timeout: 5_000 });
      const restored = await workspace.evaluate(() => ({ hash: location.hash,
        focusEvidenceId: document.activeElement?.getAttribute("data-evidence-return-id") ?? null,
        focusKey: document.activeElement?.getAttribute("data-evidence-return-key") ?? null }));
      await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${taskId}/evidence/${evidenceId}`, { waitUntil: "domcontentloaded" });
      await workspace.locator("[data-testid='media-evidence-view']").waitFor({ timeout: 20_000 });
      workspaceNegativeChecks.evidenceDirect = [];
      for (const width of [360, 420, 768, 1280]) {
        workspaceNegativeChecks.evidenceDirect.push(await inspectWorkspaceViewport(workspace, width, "[data-testid='media-evidence-view'] .media-evidence-back"));
      }
      await workspace.keyboard.press("Escape");
      const directHashAfterEscape = new URL(workspace.url()).hash;
      evidenceReturnEvidence = { taskId, evidenceId, returnHash, openedHash, restored, directHashAfterEscape };
      if (!evidenceId || !originKey || !openedHash.endsWith(`/evidence/${evidenceId}`)
        || restored.hash !== returnHash || restored.focusEvidenceId !== evidenceId || restored.focusKey !== originKey
        || directHashAfterEscape !== openedHash) throw new Error(`NJ-07 evidence return failed: ${JSON.stringify(evidenceReturnEvidence)}`);

      await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${taskId}/outline`, { waitUntil: "domcontentloaded" });
      const opener = workspace.locator(".media-quality-control > button");
      try {
        await opener.waitFor({ state: "visible", timeout: 20_000 });
      } catch {
        const diagnostic = await workspace.evaluate(() => ({
          hash: location.hash,
          routeKind: document.querySelector("[data-testid='media-product-shell']")?.getAttribute("data-route-kind") ?? null,
          shellTaskId: document.querySelector("[data-testid='media-product-shell']")?.getAttribute("data-task-id") ?? null,
          shellRevision: document.querySelector("[data-testid='media-product-shell']")?.getAttribute("data-task-revision") ?? null,
          qualityControlCount: document.querySelectorAll(".media-quality-control").length,
          loadingCount: document.querySelectorAll(".media-product-loading").length,
          alertText: Array.from(document.querySelectorAll("[role='alert']")).map((element) => element.textContent?.slice(0, 120) ?? ""),
          runtimeStatus: document.querySelector(".media-runtime-beacon")?.textContent ?? null,
          workspaceLifecycle: window.__naviaWorkspaceLifecycle ?? [],
        }));
        throw new Error(`NJ-08 quality control unavailable after evidence scan: ${JSON.stringify({ ...diagnostic, workspaceHttpEvents: workspaceHttpEvents.slice(-40), outstandingRuntimeRequests: [...outstandingRuntimeRequests.values()], runtimeTail: runtimeError.slice(-1200), runtimeOutputTail: runtimeOutput.slice(-1200), runtimeThreadDump: runtimeThreadDump() })}`);
      }
      await opener.click();
      const dialog = workspace.getByRole("dialog", { name: "允许本次视频进行结构化理解？" });
      await dialog.waitFor({ timeout: 10_000 });
      workspaceNegativeChecks.synthesisDialog = [];
      for (const width of [360, 420, 768, 1280]) {
        workspaceNegativeChecks.synthesisDialog.push(await inspectWorkspaceViewport(workspace, width, "[role='dialog'] #media-synthesis-style"));
      }
      const initialFocus = await workspace.evaluate(() => document.activeElement?.id ?? null);
      const cancel = dialog.getByRole("button", { name: "取消" });
      await cancel.focus();
      await workspace.keyboard.press("Tab");
      const wrappedForward = await workspace.evaluate(() => document.activeElement?.id ?? null);
      await workspace.keyboard.press("Shift+Tab");
      const wrappedBackward = await cancel.evaluate((element) => element === document.activeElement);
      await workspace.keyboard.press("Escape");
      const escapeClosed = await dialog.count() === 0;
      const escapeFocusRestored = await opener.evaluate((element) => element === document.activeElement);
      await opener.click();
      await dialog.waitFor({ timeout: 10_000 });
      await dialog.getByRole("button", { name: "取消" }).click();
      const cancelClosed = await dialog.count() === 0;
      const cancelFocusRestored = await opener.evaluate((element) => element === document.activeElement);
      dialogEvidence = { taskId, initialFocus, wrappedForward, wrappedBackward, escapeClosed, escapeFocusRestored, cancelClosed, cancelFocusRestored };
      if (initialFocus !== "media-synthesis-style" || wrappedForward !== "media-synthesis-style" || !wrappedBackward
        || !escapeClosed || !escapeFocusRestored || !cancelClosed || !cancelFocusRestored) {
        throw new Error(`NJ-08 dialog keyboard path failed: ${JSON.stringify(dialogEvidence)}`);
      }
      await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${taskId}/outline?chapter=chapter_deadbeefdeadbeef`, { waitUntil: "domcontentloaded" });
      workspaceNegativeChecks.invalidChapter = [];
      for (const width of [360, 420, 768, 1280]) {
        workspaceNegativeChecks.invalidChapter.push(await inspectWorkspaceViewport(workspace, width, ".media-chapter-unavailable a"));
      }
      await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/media_task_${"f".repeat(32)}`, { waitUntil: "domcontentloaded" });
      try {
        await workspace.locator(".media-product-empty[role='alert'] a").first().waitFor({ state: "visible", timeout: 20_000 });
      } catch {
        const diagnostic = await workspace.evaluate(() => ({
          hash: location.hash,
          routeKind: document.querySelector("[data-testid='media-product-shell']")?.getAttribute("data-route-kind") ?? null,
          shellTaskId: document.querySelector("[data-testid='media-product-shell']")?.getAttribute("data-task-id") ?? null,
          loadingText: Array.from(document.querySelectorAll(".media-product-loading")).map((element) => element.textContent?.slice(0, 120) ?? ""),
          alertText: Array.from(document.querySelectorAll("[role='alert']")).map((element) => element.textContent?.slice(0, 120) ?? ""),
          runtimeStatus: document.querySelector(".media-runtime-beacon")?.textContent ?? null,
          workspaceLifecycle: window.__naviaWorkspaceLifecycle ?? [],
        }));
        throw new Error(`NJ-09 missing-task recovery unavailable: ${JSON.stringify({ ...diagnostic, workspaceHttpEvents: workspaceHttpEvents.slice(-40), outstandingRuntimeRequests: [...outstandingRuntimeRequests.values()], runtimeTail: runtimeError.slice(-1200), runtimeOutputTail: runtimeOutput.slice(-1200), runtimeThreadDump: runtimeThreadDump() })}`);
      }
      workspaceNegativeChecks.missingTask = [];
      for (const width of [360, 420, 768, 1280]) {
        workspaceNegativeChecks.missingTask.push(await inspectWorkspaceViewport(workspace, width, ".media-product-empty[role='alert'] a"));
      }
    }
    await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${taskId}/mindmap`, { waitUntil: "domcontentloaded" });
    await workspace.locator("[role='treeitem']").first().waitFor({ timeout: 20_000 });
    for (const width of [360, 420, 768, 1280]) {
      workspaceMindmapChecks.push(await inspectWorkspaceViewport(workspace, width, "[role='tree']"));
    }
    const tree = workspace.locator("[role='tree']");
    if (await tree.locator("[role='treeitem'][tabindex='0']").count() !== 1) throw new Error("Mindmap has multiple Tab stops");
    await tree.locator("[role='treeitem']").first().focus();
    await workspace.keyboard.press("ArrowDown");
    const chapter = tree.locator("[role='treeitem'][aria-level='2']").first();
    if (!(await chapter.evaluate((element) => element === document.activeElement && element.tabIndex === 0))) throw new Error("Mindmap ArrowDown did not focus chapter");
    await workspace.keyboard.press("ArrowLeft");
    if (await chapter.getAttribute("aria-expanded") !== "false") throw new Error("Mindmap ArrowLeft did not collapse chapter");
    await workspace.keyboard.press("ArrowRight");
    if (await chapter.getAttribute("aria-expanded") !== "true") throw new Error("Mindmap ArrowRight did not expand chapter");
    const seekButton = chapter.locator("[data-seek-origin='mindmap_node']").first();
    await seekButton.focus();
    await workspace.keyboard.press("Enter");
    await chapter.locator("[data-seek-outcome], [role='alert']").first().waitFor({ timeout: 20_000 });
    workspaceMindmapKeyboard = true;
  }
  const rows = execFileSync("sqlite3", ["-json", db, `SELECT task_id,source_identity,state,revision,updated_at FROM media_tasks WHERE source_identity LIKE '%${bvid}%' ORDER BY updated_at DESC LIMIT 3`], { encoding: "utf8" });
  const tasks = JSON.parse(rows || "[]");
  if (cancelDuringMaterialization) {
    for (let attempt = 0; attempt < 40 && visualReleases.length < visualRequestCount; attempt += 1) await delay(250);
    for (let attempt = 0; attempt < 120 && visualResponses.length < visualRequestCount; attempt += 1) await delay(250);
    if (visualResponses.length === visualRequestCount) await delay(2_500);
  }
  const postReleaseAuthority = cancelDuringMaterialization
    ? JSON.parse(execFileSync("sqlite3", ["-json", db, `SELECT task_id,state FROM media_source_authority WHERE source_identity LIKE '%${bvid}%'`], { encoding: "utf8" }) || "[]") : null;
  const postReleaseTasks = cancelDuringMaterialization
    ? JSON.parse(execFileSync("sqlite3", ["-json", db, `SELECT task_id,state FROM media_tasks WHERE source_identity LIKE '%${bvid}%'`], { encoding: "utf8" }) || "[]") : null;
  const finalPermission = await sidepanel.evaluate(async () => ({
    cookies: await chrome.permissions.contains({ permissions: ["cookies"] }),
    bilibili: await chrome.permissions.contains({ origins: ["https://*.bilibili.com/*"] }),
  }));
  const acquisitionPosts = await sidepanel.evaluate(() => window.__naviaAcquisitionPosts ?? []);
  const embeddedState = await embedded.locator(".media-launch-status").textContent().catch(() => null);
  const embeddedTaskIdAfterWorkspace = await embedded.locator("[data-testid='media-transcript-quick-card']").getAttribute("data-task-id", { timeout: 1_000 }).catch(() => null)
    ?? await embedded.locator("[data-testid='media-restored-outline-card']").getAttribute("data-task-id", { timeout: 1_000 }).catch(() => null);
  const embeddedTaskId = embeddedTaskIdAfterWorkspace ?? embeddedTaskIdBeforeWorkspace;
  const resolutionPosts = browserAcquisitionPosts.filter((item) => item.path === "/v1/media/acquisitions/resolve").length;
  const executedTaskIds = browserAcquisitionPosts.flatMap((item) => item.path.match(/^\/v1\/media\/acquisitions\/(media_task_[a-f0-9]{32})\/execute$/)?.slice(1) ?? []);
  const resolvedTaskIds = resolveResponses.map((item) => item.authoritativeTaskId);
  const identityClosed = tasks.length === 1 && executedTaskIds.length === 1
    && tasks[0].task_id === executedTaskIds[0]
    && (observations.at(-1)?.state.transcriptTaskId ?? observations.at(-1)?.state.restoredTaskId) === executedTaskIds[0]
    && embeddedTaskId === executedTaskIds[0]
    && secondTabTaskId === executedTaskIds[0]
    && resolveResponses.filter((item) => item.disposition === "created").length === 1
    && (resolveResponses.some((item) => item.disposition === "attached") || authorityReads.some((item) => item.initiator.endsWith("/sidepanel.html")))
    && resolvedTaskIds.every((id) => id === executedTaskIds[0]);
  const authorityRows = JSON.parse(execFileSync("sqlite3", ["-json", db, `SELECT task_id,state FROM media_source_authority WHERE source_identity LIKE '%${bvid}%'`], { encoding: "utf8" }) || "[]");
  const privateResiduals = cancelDuringMaterialization ? [join(scratch, "media-tasks"), join(scratch, "media-tasks", "visual-products"), join(scratch, "media-tasks", "product-evidence", "evidence")]
    .flatMap((directory) => existsSync(directory) ? readdirSync(directory).filter((name) => name.startsWith("task_") || name.startsWith("media_task_")).map((name) => join(directory, name)) : []) : [];
  const cancelClosed = cancelDuringMaterialization && outcome === "cancelled" && visualRequestHeld && visualRequestCount >= 1
    && authorityRows.length === 1 && authorityRows[0].state === "cancelled" && tasks.length === 0 && privateResiduals.length === 0
    && visualReleases.length === visualRequestCount && visualReleases.every((item) => item.taskId === authorityRows[0].task_id)
    && visualResponses.length === visualRequestCount && visualResponses.every((item) => item.taskId === authorityRows[0].task_id
      && item.status === 409 && ["TASK_CANCELLED", "TASK_INPUT_NOT_READY"].includes(item.failureCode))
    && postReleaseAuthority?.length === 1 && postReleaseAuthority[0].state === "cancelled" && postReleaseTasks?.length === 0
    && standaloneCancelled?.taskId === authorityRows[0].task_id && standaloneCancelled.state === "cancelled";
  const result = { outcome, bvid, permissionFixture: firstUsePermission ? "optional_permission_first_use" : "pregranted_in_temporary_extension_only", nativePromptClicked, nativePromptCapture, finalPermission, raceDelayMs: watchdogCheck ? 75000 : 30000, enableClicked, cancelClicked: cancelClickedAt !== null, previewCheck, reconnectEvidence, watchdogEvidence, routeDriftEvidence, chapterRecoveryEvidence, seekEvidence, evidenceReturnEvidence, dialogEvidence, stageBResult, workspaceNegativeChecks, visualRequestCount, visualReleases, visualResponses, authorityRows, postReleaseAuthority, postReleaseTasks, privateResiduals, cancelClosed, workspaceCancelled, embeddedCancelled, standaloneCancelled,workspaceLive, workspacePendingChecks, workspaceOverviewChecks, workspaceChecks, workspaceMindmapChecks, workspaceKeyboardRoute, workspaceMindmapKeyboard, elapsedSeconds: Math.floor((Date.now() - started) / 1000), observations, embeddedState, embeddedTaskIdBeforeWorkspace, embeddedTaskIdAfterWorkspace, secondTabTaskId, tasks, resolutionPosts, resolveResponses, authorityReads, acquisitionPosts, browserAcquisitionPosts, pages: context.pages().map((page) => page.url()), identityClosed, runtimeError: outcome === "ready" ? undefined : runtimeError.slice(-800) };
  const evidenceRoot = process.env.NAVIA_STAGE_A_EVIDENCE_ROOT;
  if (evidenceRoot) {
    mkdirSync(evidenceRoot, { recursive: true });
    const runId = new Date().toISOString().replace(/[^0-9TZ]/g, "");
    if (nativePromptCapture) cpSync(nativePromptCapture, join(evidenceRoot, `${runId}-native-permission-prompt.png`));
    if (stageBOverviewScreenshot) writeFileSync(join(evidenceRoot, `${runId}-${bvid}-stage-b-overview.png`), stageBOverviewScreenshot);
    writeFileSync(join(evidenceRoot, `${runId}-${stageBSynthesis ? `stage-b-${bvid}` : cancelDuringMaterialization ? "cancel" : reconnectCheck ? "reconnect" : routeDriftCheck ? "route-drift" : chapterRecoveryCheck ? "chapter-recovery" : seekCheck ? "seek" : watchdogCheck ? "watchdog" : navigationCheck ? "navigation" : "first-use"}-result.json`), JSON.stringify({
      schemaVersion: stageBSynthesis ? "v3-5.10-stage-b-real-video-evidence/v1" : cancelDuringMaterialization ? "v3-stage-a-browser-cancel-evidence/v1" : reconnectCheck ? "v3-stage-a-browser-reconnect-evidence/v1" : routeDriftCheck ? "v3-stage-a-browser-route-drift-evidence/v1" : chapterRecoveryCheck ? "v3-stage-a-browser-chapter-recovery-evidence/v1" : seekCheck ? "v3-stage-a-browser-seek-evidence/v1" : watchdogCheck ? "v3-stage-a-browser-watchdog-evidence/v1" : navigationCheck ? "v3-stage-a-browser-navigation-evidence/v1" : "v3-stage-a-first-use-evidence/v1", runId, bvid, outcome,
      permissionFixture: result.permissionFixture, nativePromptClicked, finalPermission,
      identityClosed, taskIds: tasks.map((task) => task.task_id), productStates: tasks.map((task) => task.state),
      embeddedTaskId, embeddedTaskIdBeforeWorkspace, embeddedTaskIdAfterWorkspace, secondTabTaskId, resolutionPosts, executeCount: executedTaskIds.length,
      authorityReadCount: authorityReads.length, cancelClicked: result.cancelClicked, previewCheck, reconnectEvidence, watchdogEvidence, routeDriftEvidence, chapterRecoveryEvidence, seekEvidence, evidenceReturnEvidence, dialogEvidence, workspaceNegativeChecks,
      visualRequestCount, visualReleases, visualResponses, authorityRows, postReleaseAuthority, postReleaseTasks, privateResiduals, cancelClosed, workspaceCancelled, embeddedCancelled, standaloneCancelled, workspaceLive, workspacePendingChecks, workspaceOverviewChecks, workspaceChecks, workspaceMindmapChecks, workspaceKeyboardRoute, workspaceMindmapKeyboard, stageBResult, observations,
    }, null, 2));
  }
  console.log(JSON.stringify(result));
  if (watchdogCheck ? outcome !== "watchdog_checked" || !watchdogEvidence
    : routeDriftCheck ? outcome !== "route_drift_checked" || !routeDriftEvidence
    : reconnectCheck ? outcome !== "reconnect_checked" || !reconnectEvidence
    : cancelDuringMaterialization ? !cancelClosed || (checkWorkspace && (!workspaceCancelled || embeddedCancelled !== "cancelled"))
    : outcome !== "ready" || !identityClosed || (firstUsePermission && (!finalPermission.cookies || !finalPermission.bilibili)) || (checkWorkspace && (workspacePendingChecks.length !== 4 || workspaceOverviewChecks.length !== 4 || workspaceChecks.length !== 4 || workspaceMindmapChecks.length !== 4 || !workspaceKeyboardRoute || !workspaceMindmapKeyboard)) || (stageBSynthesis && (!stageBResult || stageBResult.quality?.status !== "complete")) || (chapterRecoveryCheck && !chapterRecoveryEvidence) || (seekCheck && !seekEvidence) || (navigationCheck && (!evidenceReturnEvidence || !dialogEvidence || Object.values(workspaceNegativeChecks).length !== 4 || Object.values(workspaceNegativeChecks).some((checks) => checks.length !== 4)))) process.exitCode = 2;
} catch (error) {
  const evidenceRoot = process.env.NAVIA_STAGE_A_EVIDENCE_ROOT;
  if (evidenceRoot) {
    mkdirSync(evidenceRoot, { recursive: true });
    const runId = new Date().toISOString().replace(/[^0-9TZ]/g, "");
    const message = (error instanceof Error ? error.message : String(error))
      .replace(/(SESSDATA|bili_jct|DedeUserID)=[^\s;,]+/gi, "$1=[REDACTED]")
      .replace(/Authorization:\s*Bearer\s+[^\s]+/gi, "Authorization: Bearer [REDACTED]");
    writeFileSync(join(evidenceRoot, `${runId}-stage-a-failure.json`), JSON.stringify({
      schemaVersion: "v3-stage-a-browser-failure/v1", runId, bvid,
      mode: cancelDuringMaterialization ? "cancel" : "fresh",
      workspaceChecked: checkWorkspace, passed: false,
      failure: { name: error instanceof Error ? error.name : "Error", message: message.slice(0, 5000) },
    }, null, 2));
  }
  throw error;
} finally {
  if (context) await context.close().catch(() => undefined);
  if (runtime && runtime.exitCode === null) {
    runtime.kill("SIGINT");
    await Promise.race([new Promise((resolve) => runtime.once("exit", resolve)), delay(5_000)]);
    if (runtime.exitCode === null) runtime.kill("SIGKILL");
  }
  rmSync(scratch, { recursive: true, force: true });
}
