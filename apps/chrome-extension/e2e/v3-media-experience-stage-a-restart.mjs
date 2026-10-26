import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, watch, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const repo = resolve(import.meta.dirname, "../../..");
const extensionRoot = resolve(repo, "apps/chrome-extension/chrome-mv3-unpacked");
const runtimeRoot = resolve(repo, "services/local-runtime");
const bvid = process.env.NAVIA_MEDIA_UX_BVID ?? "BV1hMpE6FEXG";
const crashAfterArtifact = process.env.NAVIA_STAGE_A_CRASH_AFTER_ARTIFACT === "1";
const firstUsePermission = process.env.NAVIA_STAGE_A_FIRST_USE === "1";
const acceptNativePrompt = firstUsePermission && process.env.NAVIA_STAGE_A_ACCEPT_NATIVE_PROMPT === "1";
if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) throw new Error("Invalid BVID");
const scratch = mkdtempSync(join(tmpdir(), "navia-stage-a-restart-"));
let context;
let runtime;

async function freePort() {
  const server = createServer();
  await new Promise((ok, reject) => server.listen(0, "127.0.0.1", ok).once("error", reject));
  const port = server.address().port;
  await new Promise((ok) => server.close(ok));
  return port;
}

async function waitForRuntime(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (runtime.exitCode !== null || runtime.signalCode !== null) throw new Error("Isolated Runtime exited");
    try {
      if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) return;
    } catch { /* Starting. */ }
    await delay(250);
  }
  throw new Error("Isolated Runtime did not become healthy");
}

try {
  const testExtensionRoot = join(scratch, "extension");
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
  context = await chromium.launchPersistentContext(join(scratch, "chrome"), {
    headless: false,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--mute-audio", "--disable-features=DisableLoadExtensionCommandLineSwitch", "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${testExtensionRoot}`, `--load-extension=${testExtensionRoot}`],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 20_000 });
  const extensionId = new URL(worker.url()).host;
  const port = await freePort();
  const startRuntime = () => spawn(join(runtimeRoot, ".venv/bin/python"),
    ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", String(port)], {
      cwd: runtimeRoot,
      env: { ...process.env, NAVIA_DB_PATH: db, NAVIA_MEDIA_TASK_ROOT: join(scratch, "media-tasks"),
        NAVIA_MEDIA_ASR_TASK_ROOT: join(scratch, "media-asr-tasks"),
        NAVIA_MEDIA_DOWNLOAD_CACHE_ROOT: join(scratch, "media-download-cache"),
        NAVIA_LOCAL_FILES_EXTENSION_ID: extensionId, PYTHONPATH: "." },
      stdio: ["ignore", "pipe", "pipe"],
    });
  runtime = startRuntime();
  await waitForRuntime(port);
  await context.route("http://127.0.0.1:17861/**", (route) => route.continue({ url: route.request().url().replace(":17861/", `:${port}/`) }));
  let releaseOldExecute;
  const executeGate = new Promise((ok) => { releaseOldExecute = ok; });
  let oldExecuteIntercepted = false;
  let interceptedOldTaskId = null;
  await context.route("http://127.0.0.1:17861/v1/media/acquisitions/*/execute", async (route) => {
    if (!oldExecuteIntercepted) {
      oldExecuteIntercepted = true;
      interceptedOldTaskId = new URL(route.request().url()).pathname.match(/\/acquisitions\/(media_task_[a-f0-9]{32})\/execute$/)?.[1] ?? null;
      await executeGate;
    }
    await route.fallback();
  });
  const resolutions = [];
  context.on("response", (response) => {
    if (new URL(response.url()).pathname !== "/v1/media/acquisitions/resolve") return;
    void response.json().then((body) => resolutions.push({ status: response.status(),
      disposition: body.data?.disposition ?? null,
      taskId: body.data?.authoritativeTaskId ?? null,
      failureCode: body.error?.code ?? null })).catch(() => undefined);
  });
  const video = await context.newPage();
  await video.goto(`https://www.bilibili.com/video/${bvid}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await video.locator('[data-testid="navia-floating-launcher"]').click({ timeout: 20_000 });
  const embedded = video.frameLocator('[data-testid="navia-inpage-sidebar-frame"]');
  await embedded.locator("[data-testid='chat-context-dock'] > summary").click();
  let nativePromptClicked = false;
  for (let attempt = 0; attempt < 80 && !oldExecuteIntercepted; attempt += 1) {
    const enable = embedded.locator("[data-testid='media-companion-enable']");
    if (await enable.isVisible().catch(() => false) && await enable.isEnabled()) {
      await enable.click();
      if (acceptNativePrompt && !nativePromptClicked) {
        await delay(800);
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
  const oldTaskId = resolutions.find((item) => item.disposition === "created")?.taskId;
  if (!oldExecuteIntercepted || !oldTaskId || interceptedOldTaskId !== oldTaskId) throw new Error("Old task did not reach the held execute request");
  const taskRoot = join(scratch, "media-tasks");
  const oldOwnedDirectories = readdirSync(taskRoot).filter((name) => {
    if (!name.startsWith("task_")) return false;
    const ownerFile = join(taskRoot, name, ".navia-owner.json");
    return existsSync(ownerFile) && JSON.parse(readFileSync(ownerFile, "utf8")).taskId === oldTaskId;
  });
  if (oldOwnedDirectories.length !== 1) throw new Error(`Old task ownership is not unique: ${oldOwnedDirectories.length}`);
  const oldPrivateRoot = join(taskRoot, oldOwnedDirectories[0]);
  const oldOwnerManifestBeforeCrash = JSON.parse(readFileSync(join(oldPrivateRoot, ".navia-owner.json"), "utf8"));
  const ownerManifestMatchedBeforeCrash = oldOwnerManifestBeforeCrash.taskId === oldTaskId;
  if (!ownerManifestMatchedBeforeCrash) throw new Error("Old task owner manifest mismatch");
  let oldPrivateArtifactBeforeCrash = null;
  if (crashAfterArtifact) {
    const artifactAppeared = new Promise((ok, reject) => {
      const watcher = watch(oldPrivateRoot, (_, filename) => {
        if (!filename?.startsWith("artifact_")) return;
        const artifactPath = join(oldPrivateRoot, filename);
        let byteLength;
        try { byteLength = statSync(artifactPath).size; } catch { return; }
        if (byteLength <= 0) return;
        watcher.close();
        try {
          const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
          if (!Array.isArray(artifact.segments) || artifact.segments.length === 0 || typeof artifact.language !== "string") {
            throw new Error("Published subtitle artifact has no valid segments");
          }
          ok({ name: filename, byteLength, segmentCount: artifact.segments.length, jsonParsed: true });
        } catch (error) { reject(error); }
      });
    });
    releaseOldExecute();
    oldPrivateArtifactBeforeCrash = await Promise.race([artifactAppeared, delay(30_000).then(() => null)]);
    if (!oldPrivateArtifactBeforeCrash) throw new Error("No real task artifact appeared before the crash deadline");
  }
  runtime.kill("SIGKILL");
  await new Promise((ok) => runtime.once("exit", ok));
  const oldPrivateAfterCrash = existsSync(oldPrivateRoot);
  runtime = startRuntime();
  await waitForRuntime(port);
  const oldPrivateAfterRestartBeforeRetry = existsSync(oldPrivateRoot);
  if (!crashAfterArtifact) releaseOldExecute();

  const sidepanel = await context.newPage();
  await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });
  await video.bringToFront();
  await sidepanel.locator("[data-testid='chat-context-dock'] > summary").click();
  await sidepanel.locator("[data-testid='media-companion-retry']").waitFor({ timeout: 45_000 });
  const interruptedFailure = await sidepanel.locator(".media-launch-diagnostic").textContent().catch(() => null);
  const oldPrivateBeforeRetry = existsSync(oldPrivateRoot);
  await sidepanel.locator("[data-testid='media-companion-retry']").click();
  await sidepanel.locator("[data-testid='media-transcript-quick-card'] [data-testid='media-quick-outline'], [data-testid='media-restored-outline-card']").first().waitFor({ timeout: 90_000 });
  const newTaskId = await sidepanel.locator("[data-testid='media-transcript-quick-card']").getAttribute("data-task-id");
  const visibleOutlineForNewTask = newTaskId !== oldTaskId && await sidepanel.locator(
    `[data-testid='media-transcript-quick-card'][data-task-id='${newTaskId}'] [data-testid='media-quick-outline'], [data-testid='media-restored-outline-card'][data-task-id='${newTaskId}']`
  ).count() === 1;
  const visibleOutlineTitle = await sidepanel.locator("[data-testid='media-quick-outline'] strong").textContent().catch(() => null);
  const visibleOutlineSummary = await sidepanel.locator("[data-testid='media-quick-outline'] p").textContent().catch(() => null);
  const authority = JSON.parse(execFileSync("sqlite3", ["-json", db,
    `SELECT task_id,state FROM media_source_authority WHERE source_identity LIKE '%${bvid}%'`], { encoding: "utf8" }) || "[]");
  const products = JSON.parse(execFileSync("sqlite3", ["-json", db,
    `SELECT task_id,state FROM media_tasks WHERE source_identity LIKE '%${bvid}%'`], { encoding: "utf8" }) || "[]");
  const storedOutlines = JSON.parse(execFileSync("sqlite3", ["-json", db,
    `SELECT canonical_json FROM media_outlines WHERE task_id='${newTaskId}' AND published=1 ORDER BY task_revision DESC LIMIT 1`], { encoding: "utf8" }) || "[]");
  const storedOutline = storedOutlines.length === 1 ? JSON.parse(storedOutlines[0].canonical_json).outline : null;
  const visibleOutlineMatchesStored = Boolean(storedOutline && visibleOutlineTitle?.trim() === storedOutline.title
    && visibleOutlineSummary?.trim() === storedOutline.summary && visibleOutlineSummary.trim().length > 20);
  const secondVideo = await context.newPage();
  await secondVideo.goto(`https://www.bilibili.com/video/${bvid}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await secondVideo.locator('[data-testid="navia-floating-launcher"]').click({ timeout: 20_000 });
  const secondEmbedded = secondVideo.frameLocator('[data-testid="navia-inpage-sidebar-frame"]');
  let secondEmbeddedTaskId = null;
  for (let attempt = 0; attempt < 60 && !secondEmbeddedTaskId; attempt += 1) {
    secondEmbeddedTaskId = await secondEmbedded.locator("[data-testid='media-transcript-quick-card']").getAttribute("data-task-id", { timeout: 200 }).catch(() => null)
      ?? await secondEmbedded.locator("[data-testid='media-restored-outline-card']").getAttribute("data-task-id", { timeout: 200 }).catch(() => null);
    if (!secondEmbeddedTaskId) await delay(500);
  }
  await video.bringToFront();
  if (!await video.locator('[data-testid="navia-inpage-sidebar-frame"]').isVisible().catch(() => false)) {
    await video.locator('[data-testid="navia-floating-launcher"]').click();
  }
  let originalEmbeddedTaskId = null;
  for (let attempt = 0; attempt < 60 && !originalEmbeddedTaskId; attempt += 1) {
    originalEmbeddedTaskId = await embedded.locator("[data-testid='media-transcript-quick-card']").getAttribute("data-task-id", { timeout: 200 }).catch(() => null)
      ?? await embedded.locator("[data-testid='media-restored-outline-card']").getAttribute("data-task-id", { timeout: 200 }).catch(() => null);
    if (!originalEmbeddedTaskId) await delay(500);
  }
  const crossSurfaceRestored = originalEmbeddedTaskId === newTaskId && secondEmbeddedTaskId === newTaskId;
  const workspace = await context.newPage();
  await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${newTaskId}`, { waitUntil: "domcontentloaded" });
  await workspace.locator(".media-overview-structure a").first().waitFor({ timeout: 30_000 });
  await workspace.locator(".media-overview-structure a").first().click();
  await workspace.locator(".media-chapter-list details[open]").first().waitFor({ timeout: 10_000 });
  const workspaceChecks = [];
  for (const width of [360, 420, 768, 1280]) {
    await workspace.setViewportSize({ width, height: 900 });
    const overflowPx = await workspace.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    const violations = (await new AxeBuilder({ page: workspace }).analyze()).violations
      .filter((item) => item.impact === "serious" || item.impact === "critical")
      .map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length }));
    const screenshotBytes = (await workspace.screenshot()).length;
    workspaceChecks.push({ width, overflowPx, violations, screenshotBytes });
  }
  await workspace.locator(".media-chapter-index a").last().focus();
  await workspace.keyboard.press("Enter");
  await workspace.locator(".media-chapter-list details[open]").last().waitFor({ timeout: 10_000 });
  const workspaceKeyboardRoute = await workspace.locator("[data-route-kind]").getAttribute("data-route-kind") === "outline"
    && new URL(workspace.url()).hash.includes("?chapter=")
    && await workspace.getByText("无效媒体路由", { exact: true }).count() === 0;
  await delay(1_000);
  const authorityAfterSettle = JSON.parse(execFileSync("sqlite3", ["-json", db,
    `SELECT task_id,state FROM media_source_authority WHERE source_identity LIKE '%${bvid}%'`], { encoding: "utf8" }) || "[]");
  const productsAfterSettle = JSON.parse(execFileSync("sqlite3", ["-json", db,
    `SELECT task_id,state FROM media_tasks WHERE source_identity LIKE '%${bvid}%'`], { encoding: "utf8" }) || "[]");
  const stablePublishedSnapshot = JSON.stringify(authority) === JSON.stringify(authorityAfterSettle)
    && JSON.stringify(products) === JSON.stringify(productsAfterSettle);
  const finalPermission = await sidepanel.evaluate(async () => ({
    cookies: await chrome.permissions.contains({ permissions: ["cookies"] }),
    bilibili: await chrome.permissions.contains({ origins: ["https://*.bilibili.com/*"] }),
  }));
  const oldEvidenceRoot = join(scratch, "media-tasks", "product-evidence", "evidence", oldTaskId);
  const createdResolutions = resolutions.filter((item) => item.disposition === "created");
  const passed = interruptedFailure?.trim() === "诊断：V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN"
    && newTaskId && newTaskId !== oldTaskId
    && visibleOutlineForNewTask && visibleOutlineMatchesStored && oldPrivateAfterCrash && stablePublishedSnapshot && crossSurfaceRestored
    && workspaceChecks.length === 4 && workspaceChecks.every((item) => item.overflowPx === 0 && item.violations.length === 0 && item.screenshotBytes >= 20_000)
    && workspaceKeyboardRoute
    && (!firstUsePermission || (nativePromptClicked && finalPermission.cookies && finalPermission.bilibili))
    && authority.length === 1 && authority[0].task_id === newTaskId && authority[0].state === "published"
    && products.length === 1 && products[0].task_id === newTaskId && ["ready", "degraded"].includes(products[0].state)
    && !existsSync(oldPrivateRoot) && !existsSync(oldEvidenceRoot)
    && createdResolutions.length === 2 && createdResolutions[0].taskId === oldTaskId && createdResolutions[1].taskId === newTaskId;
  const result = { schemaVersion: "v3-stage-a-runtime-restart-evidence/v5", bvid, passed,
    interruptedFailure, oldTaskId, newTaskId, authority, products,
    permissionFixture: firstUsePermission ? "optional_permission_first_use" : "pregranted_in_temporary_extension_only",
    nativePromptClicked, finalPermission,
    oldOwnedDirectoryToken: oldOwnedDirectories[0], ownerManifestMatchedBeforeCrash,
    oldPrivateArtifactBeforeCrash, oldPrivateAfterCrash, oldPrivateAfterRestartBeforeRetry,
    oldPrivateBeforeRetry, visibleOutlineForNewTask, visibleOutlineMatchesStored,
    originalEmbeddedTaskId, secondEmbeddedTaskId, crossSurfaceRestored,
    workspaceChecks, workspaceKeyboardRoute,
    visibleOutlineTitleLength: visibleOutlineTitle?.trim().length ?? 0,
    visibleOutlineSummaryLength: visibleOutlineSummary?.trim().length ?? 0, stablePublishedSnapshot,
    oldPrivateResidual: existsSync(oldPrivateRoot), oldEvidenceResidual: existsSync(oldEvidenceRoot),
    resolutions, fixture: `${firstUsePermission ? "optional_permission_first_use" : "pregranted_in_temporary_extension_only"};${crashAfterArtifact ? "real_artifact_then_SIGKILL" : "held_execute_then_SIGKILL"}` };
  const evidenceRoot = process.env.NAVIA_STAGE_A_EVIDENCE_ROOT;
  if (evidenceRoot) {
    mkdirSync(evidenceRoot, { recursive: true });
    writeFileSync(join(evidenceRoot, `${new Date().toISOString().replace(/[^0-9TZ]/g, "")}-restart-result.json`), JSON.stringify(result, null, 2));
  }
  console.log(JSON.stringify(result));
  if (!passed) process.exitCode = 2;
} finally {
  if (context) await context.close().catch(() => undefined);
  if (runtime && runtime.exitCode === null && runtime.signalCode === null) {
    runtime.kill("SIGINT");
    await Promise.race([new Promise((ok) => runtime.once("exit", ok)), delay(5_000)]);
    if (runtime.exitCode === null && runtime.signalCode === null) runtime.kill("SIGKILL");
  }
  rmSync(scratch, { recursive: true, force: true });
}
