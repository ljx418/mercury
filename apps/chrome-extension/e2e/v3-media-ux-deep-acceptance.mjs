import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const repo = path.resolve(import.meta.dirname, "../../..");
const extensionRoot = fs.realpathSync(path.join(repo, "apps/chrome-extension/chrome-mv3-unpacked"));
const profile = path.join(repo, ".tmp/v3-media-ux-deep-acceptance-profile");
const taskId = process.env.NAVIA_MEDIA_UX_TASK_ID || "media_task_b23fb395429e438f9e2455182a749496";
const screenshotDir = process.env.NAVIA_MEDIA_UX_SCREENSHOT_DIR || "";
const ensure = (value, message) => { if (!value) throw new Error(message); };
const runtimeRoot = path.join(repo, "services/local-runtime");
const runtimePython = path.join(runtimeRoot, ".venv/bin/python");

function startRuntime(extensionId) {
  return spawn(runtimePython, ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", "17861"], {
    cwd: runtimeRoot,
    env: { ...process.env, PYTHONPATH: ".", NAVIA_DB_PATH: path.join(repo, ".navia/navia.sqlite3"), NAVIA_LOCAL_FILES_EXTENSION_ID: extensionId },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function waitForRuntime(timeoutMs = 30_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const retry = () => Date.now() - started > timeoutMs ? reject(new Error("Runtime did not start")) : setTimeout(attempt, 200);
    const attempt = () => {
      const request = http.get("http://127.0.0.1:17861/v1/health", (response) => { response.resume(); resolve(); });
      request.on("error", retry);
    };
    attempt();
  });
}

fs.rmSync(profile, { recursive: true, force: true });
let context;
let runtime;
try {
  context = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      "--disable-features=DisableLoadExtensionCommandLineSwitch",
      "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${extensionRoot}`,
      `--load-extension=${extensionRoot}`,
    ],
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 20_000 });
  const origin = `chrome-extension://${new URL(worker.url()).host}`;
  runtime = startRuntime(new URL(worker.url()).host);
  await waitForRuntime();
  const page = await context.newPage();
  const checks = {};

  await page.goto(`${origin}/sidepanel.html`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-testid='summarize-page']").waitFor({ state: "visible", timeout: 20_000 });
  checks.singleSummaryAction = await page.locator("[data-testid='native-action-strip'] [data-testid='summarize-page']").count() === 1;
  checks.manualContextActionsHidden = await page.locator("[data-testid='native-action-strip'] [data-testid='read-current-page'], [data-testid='native-action-strip'] [data-testid='submit-page-context']").count() === 0;
  checks.contextDiagnosticsRetained = await page.locator(".current-page-advanced-actions [data-testid='read-current-page']").count() === 1;

  const routes = ["", "/outline", "/timeline", "/mindmap"];
  if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
  let axeBlocking = 0;
  const axeFindings = [];
  for (const route of routes) {
    await page.goto(`${origin}/workspace.html#/media/tasks/${taskId}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("[data-testid='local-runtime-status']")?.textContent?.includes("本机伴侣已连接"), undefined, { timeout: 20_000 });
    await page.waitForTimeout(800);
    const axe = await new AxeBuilder({ page }).analyze();
    const blocking = axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    axeBlocking += blocking.length;
    axeFindings.push(...blocking.map((item) => ({ route: route || "/overview", id: item.id, impact: item.impact, targets: item.nodes.flatMap((node) => node.target.map(String)) })));
    const screenshot = await page.screenshot({
      type: "png",
      path: screenshotDir ? path.join(screenshotDir, `${route.slice(1) || "overview"}.png`) : undefined,
    });
    ensure(screenshot.length > 20_000, `${route || "/overview"}: screenshot is unexpectedly blank`);
  }

  await page.goto(`${origin}/workspace.html#/media/tasks/${taskId}`, { waitUntil: "domcontentloaded" });
  await page.locator(".media-overview-report").waitFor({ state: "visible", timeout: 20_000 });
  checks.overviewStructure = await page.locator(".media-overview-structure li").count();
  checks.collapsedTranscript = await page.locator(".media-overview-transcript:not([open])").count() === 1;

  await page.goto(`${origin}/workspace.html#/media/tasks/${taskId}/outline`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-testid='media-semantic-outline']").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator(".media-frame-stack img").first().waitFor({ state: "visible", timeout: 20_000 });
  checks.realFrameImages = await page.locator(".media-frame-stack img").count();
  checks.presentationModes = await page.locator(".media-outline-presentation button").count();
  for (const label of ["视频章节", "知识长文", "图文笔记", "深度专栏"]) await page.getByRole("button", { name: label, exact: true }).click();

  await page.goto(`${origin}/workspace.html#/media/tasks/${taskId}/timeline`, { waitUntil: "domcontentloaded" });
  await page.locator(".media-vis-timeline .vis-item").first().waitFor({ state: "visible", timeout: 20_000 });
  checks.timelineItems = await page.locator(".media-vis-timeline .vis-item").count();
  checks.timelineGroups = await page.locator(".media-vis-timeline .vis-label").count();
  checks.frameStacks = await page.locator(".media-frame-storyboard .media-frame-stack").count();
  await page.locator(".media-vis-timeline .media-vis-thumbnail").first().waitFor({ state: "visible", timeout: 20_000 });
  checks.timelineThumbnails = await page.locator(".media-vis-timeline .media-vis-thumbnail").count();

  await page.goto(`${origin}/workspace.html#/media/tasks/${taskId}/mindmap`, { waitUntil: "domcontentloaded" });
  await page.locator(".media-flow-canvas .react-flow__node").first().waitFor({ state: "visible", timeout: 20_000 });
  checks.flowNodes = await page.locator(".media-flow-canvas .react-flow__node").count();
  checks.flowEdges = await page.locator(".media-flow-canvas .react-flow__edge").count();
  checks.axeBlocking = axeBlocking;
  checks.axeFindings = axeFindings;

  ensure(checks.singleSummaryAction && checks.manualContextActionsHidden && checks.contextDiagnosticsRetained, "Chat one-click summary contract failed");
  ensure(checks.overviewStructure >= 2 && checks.collapsedTranscript, "Overview structure/transcript contract failed");
  ensure(checks.realFrameImages >= 2 && checks.presentationModes === 4, "Editorial outline/frame evidence contract failed");
  ensure(checks.timelineItems >= 4 && checks.timelineGroups >= 2 && checks.frameStacks >= 2 && checks.timelineThumbnails >= 2, "Timeline contract failed");
  ensure(checks.flowNodes >= 3 && checks.flowEdges >= 2, "Mindmap contract failed");
  ensure(checks.axeBlocking === 0, `Accessibility blocking violations: ${JSON.stringify(checks.axeFindings)}`);
  console.log(JSON.stringify({ passed: true, taskId, checks, screenshotsPersisted: screenshotDir ? routes.length : 0 }, null, 2));
} finally {
  if (context) await context.close().catch(() => undefined);
  if (runtime && runtime.exitCode === null) {
    runtime.kill("SIGINT");
    await Promise.race([new Promise((resolve) => runtime.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 5_000))]);
    if (runtime.exitCode === null) runtime.kill("SIGKILL");
  }
  fs.rmSync(profile, { recursive: true, force: true });
}
