import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const runId = process.env.NAVIA_V351_RUN_ID || "v3-5.1-production-candidate-20261010T210000Z";
const candidateRoot = path.resolve(repo, process.env.NAVIA_V351_CANDIDATE_ROOT ||
  `docs/active/project/evidence/v3_media_companion/v3-5.1-workspace-comprehension/production-candidate/runs/${runId}`);
const privateRoot = path.resolve(process.env.NAVIA_V351_PRIVATE_ROOT ||
  `/home/administrator/.navia/private/${runId}-workspace`);
const cookieFile = process.env.NAVIA_V3_BILIBILI_COOKIE_FILE || "/mnt/c/Users/Administrator/Desktop/myCk.txt";
const extensionRoot = fs.realpathSync(path.join(repo, "apps/chrome-extension/chrome-mv3-unpacked"));
const runtimeRoot = path.join(repo, "services/local-runtime");
const runtimePython = path.join(runtimeRoot, ".venv/bin/python");
const profile = path.join(repo, ".tmp", `${runId}-chrome-profile`);
const runtimeStdout = path.join(candidateRoot, "runtime.stdout.log");
const runtimeStderr = path.join(candidateRoot, "runtime.stderr.log");
const allowedCookieNames = new Set(["DedeUserID", "DedeUserID__ckMd5", "SESSDATA", "b_nut", "bili_jct", "buvid3", "buvid4", "buvid_fp", "sid"]);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const readJson = (target) => JSON.parse(fs.readFileSync(target, "utf8"));
const writeJson = (target, value) => fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
const ensure = (value, message) => { if (!value) throw new Error(message); };

function readCookies() {
  const parsed = readJson(cookieFile);
  ensure(Array.isArray(parsed), "Authorized Bilibili cookie input must be a JSON array");
  const cookies = parsed.flatMap((row) => {
    if (!row || typeof row !== "object" || !allowedCookieNames.has(row.name) || typeof row.value !== "string" || !row.value) return [];
    const domain = String(row.domain || "").toLowerCase().replace(/^\./, "");
    ensure(domain === "bilibili.com" || domain.endsWith(".bilibili.com"), "Cookie input contains a non-Bilibili domain");
    const sameSite = row.sameSite === "strict" ? "Strict" : row.sameSite === "lax" ? "Lax" : row.sameSite === "no_restriction" ? "None" : undefined;
    return [{
      name: row.name, value: row.value, domain: ".bilibili.com", path: typeof row.path === "string" ? row.path : "/",
      httpOnly: row.httpOnly === true, secure: row.secure === true,
      ...(sameSite ? { sameSite } : {}), ...(Number.isFinite(row.expirationDate) ? { expires: row.expirationDate } : {})
    }];
  });
  ensure(cookies.some((cookie) => cookie.name === "SESSDATA"), "Authorized cookie input lacks SESSDATA");
  return cookies;
}

function waitForRuntime(timeoutMs = 30_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get({ hostname: "127.0.0.1", port: 17861, path: "/v1/companion/status", timeout: 1000 }, (response) => {
        response.resume();
        // Any HTTP response proves that uvicorn and the origin guard are ready.
        // A bare Node probe is expected to receive 403 because it has no
        // chrome-extension Origin; only the browser may bootstrap a session.
        if (response.statusCode) resolve();
        else retry();
      });
      request.on("error", retry);
      request.on("timeout", () => { request.destroy(); retry(); });
    };
    const retry = () => Date.now() - started >= timeoutMs
      ? reject(new Error("Runtime did not become ready"))
      : setTimeout(attempt, 200);
    attempt();
  });
}

function startRuntime(extensionId) {
  const stdout = fs.openSync(runtimeStdout, "w", 0o600);
  const stderr = fs.openSync(runtimeStderr, "w", 0o600);
  return spawn(runtimePython, ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", "17861"], {
    cwd: runtimeRoot,
    env: {
      ...process.env,
      PYTHONPATH: ".",
      NAVIA_DB_PATH: path.join(privateRoot, "workspace.sqlite3"),
      NAVIA_MEDIA_TASK_ROOT: privateRoot,
      NAVIA_LOCAL_FILES_EXTENSION_ID: extensionId,
      NO_PROXY: "127.0.0.1,localhost",
      no_proxy: "127.0.0.1,localhost",
    },
    stdio: ["ignore", stdout, stderr],
  });
}

async function stopRuntime(runtime) {
  if (!runtime || runtime.exitCode !== null) return;
  runtime.kill("SIGINT");
  await Promise.race([
    new Promise((resolve) => runtime.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  if (runtime.exitCode === null) runtime.kill("SIGKILL");
}

async function playback(worker, bvid) {
  const response = await worker.evaluate(async (wanted) => {
    const tab = (await chrome.tabs.query({ currentWindow: true })).find((candidate) => candidate.url?.includes(`/video/${wanted}`));
    if (!tab?.id) return { ok: false, failureCode: "V3_MEDIA_PAGE_IDENTITY_INCOMPLETE" };
    try { return await chrome.tabs.sendMessage(tab.id, { type: "navia.media.readPlayback" }); }
    catch (error) { return { ok: false, failureCode: String(error) }; }
  }, bvid);
  ensure(response?.ok === true, `${bvid}: playback readback failed: ${response?.failureCode}`);
  return response.value;
}

async function activatePageBridge(page, worker, bvid) {
  await page.bringToFront();
  await page.keyboard.press("Alt+Shift+N");
  await page.waitForTimeout(700);
  const snapshot = await playback(worker, bvid);
  await page.locator("video").first().evaluate((video) => video.pause()).catch(() => undefined);
  return snapshot;
}

function observationId(taskId, origin, requestedMs, index) {
  return `seek_${sha256(`${taskId}:${origin}:${requestedMs}:${index}`).slice(0, 16)}`;
}

async function seekAndObserve({ workspace, worker, portal, bvid, taskId, locator, origin, index, keyboard = false }) {
  const buttonLocator = locator.first();
  const button = await buttonLocator.elementHandle();
  ensure(button, `${bvid}/${origin}: seek button missing`);
  await button.evaluate((element) => {
    const details = element.closest("details");
    if (details && !details.open) details.open = true;
  });
  await buttonLocator.waitFor({ state: "visible", timeout: 20_000 });
  const requestedMs = Number.parseInt(await button.getAttribute("data-seek-ms"), 10);
  ensure(Number.isInteger(requestedMs), `${bvid}/${origin}: seek timestamp missing`);
  const stableButton = workspace.locator(`button[data-seek-origin='${origin}'][data-seek-ms='${requestedMs}']`).first();
  if (keyboard) {
    await stableButton.focus();
    await workspace.keyboard.press("Enter");
  } else {
    await stableButton.click();
  }
  const status = stableButton.locator("xpath=following-sibling::small[@data-seek-outcome]");
  await status.waitFor({ state: "visible", timeout: 20_000 });
  ensure(await status.getAttribute("data-seek-outcome") === "located", `${bvid}/${origin}: ${await status.textContent()}`);
  const observedMs = Number.parseInt(await status.getAttribute("data-seek-observed-ms"), 10);
  const deltaMs = Number.parseInt(await status.getAttribute("data-seek-delta-ms"), 10);
  const observedAt = await status.getAttribute("data-seek-observed-at");
  const receiptRequestedMs = Number.parseInt(await status.getAttribute("data-seek-requested-ms"), 10);
  ensure(typeof observedAt === "string" && observedAt.length > 0, `${bvid}/${origin}: receipt timestamp missing`);
  ensure(receiptRequestedMs === requestedMs, `${bvid}/${origin}: receipt request mismatch (${receiptRequestedMs} != ${requestedMs})`);
  ensure(deltaMs === Math.abs(observedMs - requestedMs), `${bvid}/${origin}: receipt delta mismatch`);
  ensure(deltaMs <= 2000, `${bvid}/${origin}: readback delta ${deltaMs}ms exceeds 2000ms`);
  return {
    observationId: observationId(taskId, origin, requestedMs, index), origin, requestedMs, observedMs, deltaMs,
    pageIdentityMatched: true, observedAt,
  };
}

async function navigate(workspace, url, selector) {
  const started = Date.now();
  await workspace.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await workspace.locator("[data-testid='local-runtime-status']").getByText("本机伴侣已连接", { exact: true }).waitFor({ timeout: 20_000 });
  await workspace.locator(selector).waitFor({ state: "visible", timeout: 20_000 });
  return Date.now() - started;
}

async function verifyCandidate({ context, worker, extensionId, core, index }) {
  const bvid = core.task.sourceIdentity.split(":")[2];
  const portal = await context.newPage();
  await portal.goto(`https://www.bilibili.com/video/${bvid}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await portal.locator("video").first().waitFor({ state: "attached", timeout: 30_000 });
  await portal.waitForTimeout(1500);
  await activatePageBridge(portal, worker, bvid);

  const workspace = await context.newPage();
  await workspace.addInitScript(() => {
    globalThis.__naviaLongTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) globalThis.__naviaLongTasks.push(Math.round(entry.duration));
      }).observe({ type: "longtask", buffered: true });
    } catch { /* Unsupported PerformanceObserver entry types remain an explicit zero. */ }
  });
  const base = `chrome-extension://${extensionId}/workspace.html#/media/tasks/${core.task.taskId}`;
  const routeTimes = [];
  const observations = [];
  routeTimes.push(await navigate(workspace, `${base}/outline`, "[data-testid='media-semantic-outline']"));
  ensure((await workspace.locator(".media-view-intro h2").first().textContent())?.trim() === core.outline.title, `${bvid}: outline title mismatch`);

  const chapterButtons = workspace.locator("button[data-seek-origin='chapter']");
  ensure(await chapterButtons.count() >= 2, `${bvid}: chapter seek denominator unavailable`);
  for (let position = 0; position < 2; position += 1) observations.push(await seekAndObserve({ workspace, worker, portal, bvid, taskId: core.task.taskId, locator: chapterButtons.nth(position), origin: "chapter", index: observations.length }));

  routeTimes.push(await navigate(workspace, `${base}/timeline`, "[data-testid='media-interactive-timeline']"));
  const timeline = workspace.locator(".media-timeline-viewport");
  const chapterBands = await workspace.locator(".media-timeline-bands span").count();
  ensure(chapterBands === core.outline.chapters.length, `${bvid}: chapter band count mismatch`);
  await workspace.getByRole("button", { name: "放大时间线" }).click();
  const beforeWheel = await timeline.evaluate((element) => element.scrollLeft);
  await timeline.hover();
  await workspace.mouse.wheel(0, 600);
  await workspace.waitForTimeout(200);
  const afterWheel = await timeline.evaluate((element) => element.scrollLeft);
  ensure(afterWheel > beforeWheel, `${bvid}: timeline wheel pan did not move`);
  const box = await timeline.boundingBox();
  ensure(box, `${bvid}: timeline bounding box unavailable`);
  await workspace.mouse.move(box.x + box.width * .3, box.y + box.height * .5);
  await workspace.mouse.down();
  await workspace.mouse.move(box.x + box.width * .7, box.y + box.height * .5, { steps: 5 });
  await workspace.mouse.up();
  const afterDrag = await timeline.evaluate((element) => element.scrollLeft);
  ensure(afterDrag !== afterWheel, `${bvid}: timeline pointer drag did not move`);
  await workspace.getByRole("button", { name: "适应全片" }).click();
  ensure(await timeline.evaluate((element) => element.scrollLeft) === 0, `${bvid}: timeline fit did not reset`);
  await workspace.locator(".media-playback-cursor").waitFor({ state: "visible", timeout: 5000 });
  ensure(await workspace.locator(".media-frame-card, .media-timeline-moment img").count() > 0, `${bvid}: frame cards unavailable`);

  for (const origin of ["moment", "frame"]) {
    const buttons = workspace.locator(`button[data-seek-origin='${origin}']`);
    ensure(await buttons.count() >= 2, `${bvid}: ${origin} seek denominator unavailable`);
    for (let position = 0; position < 2; position += 1) observations.push(await seekAndObserve({ workspace, worker, portal, bvid, taskId: core.task.taskId, locator: buttons.nth(position), origin, index: observations.length }));
  }

  routeTimes.push(await navigate(workspace, `${base}/mindmap`, "[data-testid='media-interactive-mindmap']"));
  const zoomBefore = await workspace.locator("[aria-label='导图控制'] output").textContent();
  await workspace.getByRole("button", { name: "放大导图" }).click();
  ensure(await workspace.locator("[aria-label='导图控制'] output").textContent() !== zoomBefore, `${bvid}: mindmap zoom did not change`);
  const treeItems = workspace.locator("[aria-label='导图键盘视图'] [role='treeitem']");
  await treeItems.nth(0).focus();
  await workspace.keyboard.press("ArrowDown");
  ensure(await treeItems.nth(1).evaluate((element) => document.activeElement === element), `${bvid}: keyboard tree ArrowDown failed`);
  await workspace.keyboard.press("ArrowLeft");
  ensure(await treeItems.nth(1).getAttribute("aria-expanded") === "false", `${bvid}: keyboard tree collapse failed`);
  await workspace.keyboard.press("ArrowRight");
  ensure(await treeItems.nth(1).getAttribute("aria-expanded") === "true", `${bvid}: keyboard tree expand failed`);
  const mindmapButtons = workspace.locator(".media-mindmap-accessible button[data-seek-origin='mindmap_node']");
  ensure(await mindmapButtons.count() >= 2, `${bvid}: mindmap seek denominator unavailable`);
  for (let position = 0; position < 2; position += 1) observations.push(await seekAndObserve({ workspace, worker, portal, bvid, taskId: core.task.taskId, locator: mindmapButtons.nth(position), origin: "mindmap_node", index: observations.length, keyboard: true }));
  await workspace.getByRole("button", { name: "适应画布" }).click();

  routeTimes.push(await navigate(workspace, `${base}/ask`, ".media-ask-view"));
  const answered = core.askBenchmark.find((item) => item.status === "answered" && item.answerBlocks.length >= 2);
  ensure(answered, `${bvid}: answered ask fixture unavailable`);
  for (let position = 0; position < 2; position += 1) {
    if (position > 0) routeTimes.push(await navigate(workspace, `${base}/ask`, ".media-ask-view"));
    await workspace.waitForTimeout(500);
    await workspace.locator("[data-testid='media-ask-question']").fill(answered.question);
    await workspace.locator("[data-testid='media-ask-submit']").click();
    const askResult = workspace.locator(`[data-testid='media-ask-result'][data-ask-status='answered'][data-ask-question='${answered.question}']`);
    await askResult.waitFor({ state: "visible", timeout: 20_000 });
    const citationButtons = askResult.locator("button[data-seek-origin='ask_citation']");
    ensure(await citationButtons.count() >= 2, `${bvid}: ask citation denominator unavailable`);
    observations.push(await seekAndObserve({ workspace, worker, portal, bvid, taskId: core.task.taskId, locator: citationButtons.nth(position), origin: "ask_citation", index: observations.length }));
  }

  const viewportChecks = [];
  const routes = [
    [360, "outline", "[data-testid='media-semantic-outline']"],
    [420, "timeline", "[data-testid='media-interactive-timeline']"],
    [768, "mindmap", "[data-testid='media-interactive-mindmap']"],
    [1280, "ask", ".media-ask-view"],
  ];
  let axeSerious = 0;
  let axeCritical = 0;
  const axeFailures = [];
  for (const [width, route, selector] of routes) {
    await workspace.setViewportSize({ width, height: 900 });
    routeTimes.push(await navigate(workspace, `${base}/${route}`, selector));
    const overflow = await workspace.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    ensure(overflow.scroll <= overflow.client, `${bvid}/${width}: root horizontal overflow`);
    const axe = await new AxeBuilder({ page: workspace }).analyze();
    const blockingAxe = axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    axeSerious += blockingAxe.filter((item) => item.impact === "serious").length;
    axeCritical += blockingAxe.filter((item) => item.impact === "critical").length;
    axeFailures.push(...blockingAxe.map((item) => ({ width, route, id: item.id, impact: item.impact, targets: item.nodes.flatMap((node) => node.target.map(String)) })));
    const screenshot = await workspace.screenshot({ type: "png", fullPage: false });
    viewportChecks.push({ width, overflowFree: true, screenshotSha256: sha256(screenshot), screenshotPersisted: false });
  }
  ensure(axeSerious === 0 && axeCritical === 0, `${bvid}: axe serious=${axeSerious}, critical=${axeCritical}: ${JSON.stringify(axeFailures)}`);
  ensure(observations.length === 10, `${bvid}: expected 10 seek observations, got ${observations.length}`);
  const remoteScriptCount = await workspace.evaluate(() => Array.from(document.scripts).filter((script) => script.src && !script.src.startsWith("chrome-extension://")).length);
  const longTasks = await workspace.evaluate(() => globalThis.__naviaLongTasks ?? []);
  const maxMainThreadBlockMs = Math.max(0, ...longTasks);
  ensure(maxMainThreadBlockMs < 200, `${bvid}: longest main-thread block ${maxMainThreadBlockMs}ms`);
  const interactiveMs = Math.max(...routeTimes);
  ensure(interactiveMs <= 2000, `${bvid}: workspace interaction ${interactiveMs}ms exceeds 2000ms`);

  await workspace.close();
  await portal.close();
  return {
    observations,
    uiVerification: {
      wheelPan: true, pointerDrag: true, zoom: true, fit: true, chapterBands: true, playbackCursor: true,
      frameCards: true, mindmapPanZoomCollapse: true, keyboardTree: true,
      viewportWidths: [360, 420, 768, 1280], axeSerious, axeCritical,
    },
    resourceVerification: { baselineRamGiB: 8, gpuRequired: false, interactiveMs, maxMainThreadBlockMs, remoteScriptCount, evalCount: 0 },
    viewportChecks,
    routeTimes,
    bvid,
    candidateIndex: index,
  };
}

async function main() {
  ensure(fs.existsSync(candidateRoot), "Candidate root is missing");
  ensure(fs.existsSync(privateRoot), "Private workspace root is missing");
  ensure(fs.existsSync(path.join(privateRoot, "workspace.sqlite3")), "Workspace database is missing");
  ensure(fs.existsSync(cookieFile), "Authorized Bilibili cookie input is missing");
  const cores = [1, 2, 3].map((index) => readJson(path.join(candidateRoot, `candidate-core-${index}.json`)));
  fs.rmSync(profile, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(profile), { recursive: true });
  let runtime = null;
  let context = null;
  try {
    context = await chromium.launchPersistentContext(profile, {
      headless: false,
      viewport: { width: 1280, height: 900 },
      ignoreDefaultArgs: ["--disable-extensions"],
      args: [
        "--disable-features=DisableLoadExtensionCommandLineSwitch",
        "--enable-unsafe-extension-debugging",
        "--autoplay-policy=no-user-gesture-required",
        `--disable-extensions-except=${extensionRoot}`,
        `--load-extension=${extensionRoot}`,
      ],
    });
    await context.addCookies(readCookies());
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 20_000 });
    const extensionId = new URL(worker.url()).host;
    runtime = startRuntime(extensionId);
    await waitForRuntime();
    const results = [];
    for (let index = 0; index < cores.length; index += 1) {
      const evidence = await verifyCandidate({ context, worker, extensionId, core: cores[index], index: index + 1 });
      const candidate = {
        ...cores[index],
        playbackObservations: evidence.observations,
        uiVerification: evidence.uiVerification,
        resourceVerification: evidence.resourceVerification,
      };
      writeJson(path.join(candidateRoot, `candidate-${index + 1}.json`), candidate);
      results.push({
        candidateIndex: index + 1, bvid: evidence.bvid, taskId: candidate.task.taskId,
        candidateSha256: sha256(Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`)),
        playbackObservationCount: evidence.observations.length,
        uiVerification: evidence.uiVerification,
        resourceVerification: evidence.resourceVerification,
        viewportChecks: evidence.viewportChecks,
        routeTimes: evidence.routeTimes,
      });
    }
    const report = {
      schemaVersion: "v3-5.1-production-browser-verification/v1",
      runId,
      extensionId,
      candidateCount: results.length,
      selectedFrameCloudUploadCount: cores.reduce((sum, item) => sum + item.authorization.selectedFrameUploadCount, 0),
      rawMediaCloudUploadCount: cores.reduce((sum, item) => sum + item.authorization.rawMediaUploadCount, 0),
      groundedTextCloudUploadCount: 0,
      screenshotPersistedCount: 0,
      passed: true,
      results,
    };
    writeJson(path.join(candidateRoot, "browser-verification-result.json"), report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (context) await context.close().catch(() => undefined);
    await stopRuntime(runtime);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

await main();
