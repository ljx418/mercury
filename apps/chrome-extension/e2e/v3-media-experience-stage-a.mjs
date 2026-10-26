import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const repo = resolve(import.meta.dirname, "../../..");
const extensionRoot = resolve(repo, "apps/chrome-extension/chrome-mv3-unpacked");
const runtimeRoot = resolve(repo, "services/local-runtime");
const taskId = process.env.NAVIA_MEDIA_UX_TASK_ID;
if (!/^media_task_[a-f0-9]{32}$/.test(taskId ?? "")) throw new Error("Set NAVIA_MEDIA_UX_TASK_ID to a real published task.");
const scratch = mkdtempSync(join(tmpdir(), "navia-stage-a-"));
let context;
let runtime;

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
    } catch { /* Not listening yet. */ }
    await delay(250);
  }
  throw new Error("Isolated Runtime did not become healthy.");
}

try {
  const db = join(scratch, "navia.sqlite3");
  execFileSync("sqlite3", [join(repo, ".navia/navia.sqlite3"), `.backup '${db}'`]);
  context = await chromium.launchPersistentContext(join(scratch, "chrome"), {
    headless: false,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      "--mute-audio",
      "--disable-features=DisableLoadExtensionCommandLineSwitch",
      "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${extensionRoot}`,
      `--load-extension=${extensionRoot}`,
    ],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 20_000 });
  const extensionId = new URL(worker.url()).host;
  const origin = `chrome-extension://${extensionId}`;
  const port = await freePort();
  runtime = spawn(join(runtimeRoot, ".venv/bin/python"), ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: runtimeRoot,
    env: { ...process.env, NAVIA_DB_PATH: db, NAVIA_LOCAL_FILES_EXTENSION_ID: extensionId, PYTHONPATH: "." },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let runtimeError = "";
  runtime.stderr.on("data", (chunk) => { runtimeError += String(chunk).slice(-2000); });
  await waitForRuntime(port).catch((error) => { throw new Error(`${error.message}\n${runtimeError.slice(-2000)}`); });
  await context.route("http://127.0.0.1:17861/**", (route) => route.continue({ url: route.request().url().replace(":17861/", `:${port}/`) }));

  const page = await context.newPage();
  await page.goto(`${origin}/workspace.html#/media/tasks/${taskId}`, { waitUntil: "domcontentloaded" });
  await page.locator(".media-overview-structure a").first().waitFor({ timeout: 30_000 });
  const overview = await page.locator(".media-overview-structure a").count();
  const screenshotBytes = (await page.screenshot()).length;
  await page.locator(".media-overview-structure a").first().click();
  await page.locator(".media-chapter-list details[open]").first().waitFor({ timeout: 10_000 });
  const hash = new URL(page.url()).hash;
  const route = await page.locator(".media-product-shell").getAttribute("data-route-kind");
  const invalid = await page.getByText("无效媒体路由", { exact: true }).count();
  if (route !== "outline" || !hash.includes("?chapter=") || invalid || screenshotBytes < 20_000) {
    throw new Error(`Real-task chapter navigation failed: ${JSON.stringify({ route, hash, invalid, screenshotBytes })}`);
  }
  const viewports = [];
  for (const width of [360, 420, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    const blocking = (await new AxeBuilder({ page }).analyze()).violations
      .filter((item) => item.impact === "serious" || item.impact === "critical")
      .map((item) => item.id);
    const imageBytes = (await page.screenshot()).length;
    viewports.push({ width, overflowPx, blocking, imageBytes });
    if (overflowPx || blocking.length || imageBytes < 20_000) throw new Error(`Viewport failed: ${JSON.stringify(viewports.at(-1))}`);
  }
  await page.locator(".media-chapter-index a").last().focus();
  await page.keyboard.press("Enter");
  await page.locator(".media-chapter-list details[open]").last().waitFor({ timeout: 10_000 });
  if (await page.locator("[data-route-kind]").getAttribute("data-route-kind") !== "outline") throw new Error("Keyboard chapter navigation left the Media route.");
  const video = await context.newPage();
  await video.goto("https://www.bilibili.com/video/BV1pohR6rEEh", { waitUntil: "domcontentloaded", timeout: 45_000 });
  const sidepanel = await context.newPage();
  await sidepanel.goto(`${origin}/sidepanel.html`, { waitUntil: "domcontentloaded" });
  await video.bringToFront();
  await sidepanel.locator("[data-testid='chat-context-dock'] > summary").click();
  await sidepanel.locator("[data-testid='media-transcript-quick-card'], [data-testid='media-restored-outline-card']").first().waitFor({ timeout: 12_000 }).catch(async (error) => {
    const state = {
      activity: await sidepanel.locator(".chat-context-summary-copy").allInnerTexts(),
      media: await sidepanel.locator("[data-testid='media-acquisition-status-card'], [data-testid='media-transcript-quick-card']").allInnerTexts(),
      alerts: await sidepanel.getByRole("alert").allInnerTexts(),
      details: (await sidepanel.locator(".chat-context-dock-body").textContent()).slice(0, 1600),
      runtime: await sidepanel.locator("[data-testid='runtime-status']").allInnerTexts(),
      videoTitle: await video.title(),
      observedSource: await sidepanel.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tab = tabs.find((item) => item.url?.includes("BV1pohR6rEEh"));
        if (!tab?.id) return { tabs: tabs.map((item) => item.url) };
        try { return await chrome.tabs.sendMessage(tab.id, { type: "navia.media.collectPageContext" }); }
        catch (error) { return String(error); }
      }),
    };
    throw new Error(`${error.message}\n${JSON.stringify(state)}`);
  });
  const sidepanelActivity = await sidepanel.locator(".chat-context-summary-copy strong").first().innerText();
  const restoredOutline = await sidepanel.locator("[data-testid='media-restored-outline-card']").count() === 1;
  const transcriptPreview = await sidepanel.locator(".media-transcript-preview summary").allInnerTexts();
  if (sidepanelActivity !== "视频内容已就绪" || (!restoredOutline && !transcriptPreview.some((text) => text.includes("转写预览")))) {
    throw new Error(`Real-task sidepanel state did not settle: ${JSON.stringify({ sidepanelActivity, restoredOutline, transcriptPreview })}`);
  }
  console.log(JSON.stringify({ passed: true, taskId, overviewChapters: overview, route, chapterRoute: hash, screenshotBytes, viewports, keyboardChapter: true, sidepanelActivity, restoredOutline, transcriptPreview, runtime: "isolated-real-db-backup" }));
} finally {
  if (context) await context.close().catch(() => undefined);
  if (runtime && runtime.exitCode === null) {
    runtime.kill("SIGINT");
    await Promise.race([new Promise((resolve) => runtime.once("exit", resolve)), delay(5_000)]);
    if (runtime.exitCode === null) runtime.kill("SIGKILL");
  }
  rmSync(scratch, { recursive: true, force: true });
}
