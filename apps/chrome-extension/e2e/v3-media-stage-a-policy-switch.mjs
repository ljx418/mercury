import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) throw new Error("Invalid BVID");
const scratch = mkdtempSync(join(tmpdir(), "navia-policy-switch-"));
const testExtensionRoot = join(scratch, "extension");
const profileRoot = join(scratch, "chrome");
const db = join(scratch, "navia.sqlite3");
let context;
let runtime;

function sql(statement) {
  return JSON.parse(execFileSync("sqlite3", ["-json", db, statement], { encoding: "utf8" }) || "[]");
}

async function freePort() {
  const server = createServer();
  await new Promise((ok, fail) => server.listen(0, "127.0.0.1", ok).once("error", fail));
  const port = server.address().port;
  await new Promise((ok) => server.close(ok));
  return port;
}

async function startRuntime(port, extensionId, revision) {
  const command = revision === 1
    ? ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", String(port)]
    : ["-c", "import sys,uvicorn; from navia_runtime.app import app,media_acquisition_coordinator; media_acquisition_coordinator._adapter_policies['bilibili']=('bilibili-media-consent/v2',2); uvicorn.run(app,host='127.0.0.1',port=int(sys.argv[1]))", String(port)];
  runtime = spawn(join(runtimeRoot, ".venv/bin/python"), command, {
    cwd: runtimeRoot,
    env: { ...process.env, NAVIA_DB_PATH: db,
      NAVIA_MEDIA_TASK_ROOT: join(scratch, "media-tasks"),
      NAVIA_MEDIA_ASR_TASK_ROOT: join(scratch, "media-asr-tasks"),
      NAVIA_MEDIA_DOWNLOAD_CACHE_ROOT: join(scratch, "media-download-cache"),
      NAVIA_LOCAL_FILES_EXTENSION_ID: extensionId, PYTHONPATH: "." },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  runtime.stderr.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-2000); });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (runtime.exitCode !== null || runtime.signalCode !== null) throw new Error(`Runtime v${revision} exited: ${stderr.slice(-500)}`);
    try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) return; } catch { /* startup */ }
    await delay(250);
  }
  throw new Error(`Runtime v${revision} did not start: ${stderr.slice(-500)}`);
}

async function stopRuntime() {
  if (!runtime || runtime.exitCode !== null || runtime.signalCode !== null) return;
  runtime.kill("SIGINT");
  await Promise.race([new Promise((ok) => runtime.once("exit", ok)), delay(5_000)]);
  if (runtime.exitCode === null && runtime.signalCode === null) {
    runtime.kill("SIGKILL");
    await new Promise((ok) => runtime.once("exit", ok));
  }
}

async function openChrome() {
  context = await chromium.launchPersistentContext(profileRoot, {
    headless: false, viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--mute-audio", "--disable-features=DisableLoadExtensionCommandLineSwitch",
      "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${testExtensionRoot}`,
      `--load-extension=${testExtensionRoot}`],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 20_000 });
  return new URL(worker.url()).host;
}

function upgradeTemporaryExtension() {
  for (const path of ["background.js", "content-scripts/content.js"]) {
    const file = join(testExtensionRoot, path);
    const value = readFileSync(file, "utf8");
    const from = "policyId:`bilibili-media-consent/v1`,policyRevision:1";
    if (value.split(from).length !== 2) throw new Error(`Policy fixture is not unique in ${path}`);
    writeFileSync(file, value.replace(from, "policyId:`bilibili-media-consent/v2`,policyRevision:2"));
  }
  const chunk = readdirSync(join(testExtensionRoot, "chunks")).find((name) => name.startsWith("session-") && name.endsWith(".js"));
  if (!chunk) throw new Error("Session chunk missing in temporary extension");
  const file = join(testExtensionRoot, "chunks", chunk);
  const value = readFileSync(file, "utf8");
  const from = "policyId:`bilibili-media-consent/v1`,policyRevision:1";
  if (value.split(from).length !== 2) throw new Error("Policy fixture is not unique in session chunk");
  writeFileSync(file, value.replace(from, "policyId:`bilibili-media-consent/v2`,policyRevision:2"));
}

async function openVideoAndSidebar(extensionId, port) {
  await context.route("http://127.0.0.1:17861/**", (route) => route.continue({ url: route.request().url().replace(":17861/", `:${port}/`) }));
  const video = await context.newPage();
  await video.goto(`https://www.bilibili.com/video/${bvid}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await video.locator('[data-testid="navia-floating-launcher"]').click({ timeout: 20_000 });
  const embedded = video.frameLocator('[data-testid="navia-inpage-sidebar-frame"]');
  await embedded.locator("[data-testid='chat-context-dock'] > summary").click();
  const sidepanel = await context.newPage();
  await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });
  await video.bringToFront();
  await sidepanel.locator("[data-testid='chat-context-dock'] > summary").click();
  return { video, embedded, sidepanel };
}

try {
  cpSync(extensionRoot, testExtensionRoot, { recursive: true });
  const manifestPath = join(testExtensionRoot, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.permissions = [...new Set([...manifest.permissions, "cookies"])];
  manifest.host_permissions = [...new Set([...manifest.host_permissions, "https://*.bilibili.com/*"])];
  manifest.optional_permissions = [];
  manifest.optional_host_permissions = [];
  writeFileSync(manifestPath, JSON.stringify(manifest));
  execFileSync("sqlite3", [join(repo, ".navia/navia.sqlite3"), `.backup '${db}'`]);
  const extensionId = await openChrome();
  const port = await freePort();
  await startRuntime(port, extensionId, 1);
  let { video, embedded, sidepanel } = await openVideoAndSidebar(extensionId, port);
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const enable = embedded.locator("[data-testid='media-companion-enable']");
    if (await enable.isVisible().catch(() => false) && await enable.isEnabled()) await enable.click();
    if (await sidepanel.locator("[data-testid='media-quick-outline'], [data-testid='media-restored-outline-card']").count()) break;
    await delay(1_000);
  }
  const oldAuthority = sql(`SELECT task_id,state,consent_policy_revision FROM media_source_authority WHERE source_identity LIKE '%${bvid}%'`);
  if (oldAuthority.length !== 1 || oldAuthority[0].state !== "published" || oldAuthority[0].consent_policy_revision !== 1) {
    throw new Error(`Real v1 source did not publish: ${JSON.stringify(oldAuthority)}`);
  }
  const oldTaskId = oldAuthority[0].task_id;
  const oldProduct = sql(`SELECT state,revision,current_outline_id FROM media_tasks WHERE task_id='${oldTaskId}'`)[0];
  const oldOutline = sql(`SELECT content_sha256 FROM media_outlines WHERE task_id='${oldTaskId}' ORDER BY task_revision DESC LIMIT 1`)[0];
  if (!oldOutline?.content_sha256 || !["ready", "degraded"].includes(oldProduct.state)) throw new Error("Old real product is incomplete");
  await context.close();
  context = null;
  await stopRuntime();
  upgradeTemporaryExtension();
  const secondExtensionId = await openChrome();
  if (secondExtensionId !== extensionId) throw new Error("Temporary extension ID changed during policy upgrade");
  await startRuntime(port, extensionId, 2);
  ({ video, embedded, sidepanel } = await openVideoAndSidebar(extensionId, port));
  let switchResponseDropped = false;
  if (process.env.NAVIA_STAGE_A_DROP_SWITCH_RESPONSE === "1") {
    await context.route("http://127.0.0.1:17861/v1/media/acquisitions/replace-policy", async (route) => {
      const response = await route.fetch({ url: route.request().url().replace(":17861/", `:${port}/`) });
      if (response.status() !== 201) throw new Error(`Switch transaction failed before response drop: ${response.status()}`);
      switchResponseDropped = true;
      await route.abort("failed");
    });
  }
  let conflictVisibleBeforeClick = false;
  let newTaskId = null;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const enable = embedded.locator("[data-testid='media-companion-enable']");
    if (await enable.isVisible().catch(() => false) && await enable.isEnabled()) await enable.click();
    conflictVisibleBeforeClick = await embedded.locator("[data-testid='media-policy-switch']").isVisible().catch(() => false)
      && await sidepanel.locator("[data-testid='media-policy-switch']").isVisible().catch(() => false);
    if (conflictVisibleBeforeClick) break;
    await delay(500);
  }
  if (!conflictVisibleBeforeClick) throw new Error("Policy conflict did not appear in visible side panel");
  const beforeClick = sql(`SELECT task_id,state,consent_policy_revision FROM media_source_authority WHERE source_identity LIKE '%${bvid}%'`)[0];
  if (beforeClick.task_id !== oldTaskId || beforeClick.consent_policy_revision !== 1) throw new Error("Source changed before explicit confirmation");
  await video.bringToFront();
  video.once("dialog", (dialog) => dialog.accept());
  await embedded.locator("[data-testid='media-policy-switch-confirm']").focus();
  await video.keyboard.press("Enter");
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const row = sql(`SELECT task_id,state,consent_policy_revision FROM media_source_authority WHERE source_identity LIKE '%${bvid}%'`)[0];
    if (row?.state === "published" && row.consent_policy_revision === 2 && row.task_id !== oldTaskId) { newTaskId = row.task_id; break; }
    await delay(1_000);
  }
  if (!newTaskId) {
    const authority = sql(`SELECT task_id,state,consent_policy_revision FROM media_source_authority WHERE source_identity LIKE '%${bvid}%'`);
    const tasks = sql(`SELECT task_id,state,revision,terminal_failure_code FROM media_tasks WHERE source_identity LIKE '%${bvid}%' ORDER BY created_at DESC LIMIT 3`);
    const panelState = await embedded.locator("[role='alert'], .media-acquisition-status").allTextContents();
    const diagnostic = { schemaVersion: "v3-stage-a-policy-switch-failure/v1", bvid,
      switchResponseDropped, authority, tasks,
      panelState: panelState.map((value) => value.slice(0, 160)) };
    const evidenceRoot = process.env.NAVIA_STAGE_A_EVIDENCE_ROOT;
    if (evidenceRoot) {
      mkdirSync(evidenceRoot, { recursive: true });
      writeFileSync(join(evidenceRoot, `${new Date().toISOString().replace(/[^0-9TZ]/g, "")}-policy-switch-failure.json`), JSON.stringify(diagnostic, null, 2));
    }
    throw new Error(`New real task did not publish: ${JSON.stringify(diagnostic)}`);
  }
  const switchRows = sql(`SELECT old_task_id,new_task_id,old_policy_revision,new_policy_revision FROM media_source_policy_switches WHERE new_task_id='${newTaskId}'`);
  const oldProductAfter = sql(`SELECT state,revision,current_outline_id FROM media_tasks WHERE task_id='${oldTaskId}'`)[0];
  const oldOutlineAfter = sql(`SELECT content_sha256 FROM media_outlines WHERE task_id='${oldTaskId}' ORDER BY task_revision DESC LIMIT 1`)[0];
  const newProduct = sql(`SELECT state,revision FROM media_tasks WHERE task_id='${newTaskId}'`)[0];
  const sidepanelTaskId = await sidepanel.locator("[data-testid='media-transcript-quick-card'], [data-testid='media-restored-outline-card']").first().getAttribute("data-task-id", { timeout: 20_000 });
  const secondVideo = await context.newPage();
  await secondVideo.goto(`https://www.bilibili.com/video/${bvid}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await secondVideo.locator('[data-testid="navia-floating-launcher"]').click({ timeout: 20_000 });
  const secondEmbedded = secondVideo.frameLocator('[data-testid="navia-inpage-sidebar-frame"]');
  const secondTaskId = await secondEmbedded.locator("[data-testid='media-transcript-quick-card'], [data-testid='media-restored-outline-card']").first().getAttribute("data-task-id", { timeout: 30_000 });
  const workspace = await context.newPage();
  await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${newTaskId}`, { waitUntil: "domcontentloaded" });
  await workspace.locator(".media-overview-structure a").first().waitFor({ timeout: 30_000 });
  await workspace.locator(".media-overview-structure a").first().click();
  await workspace.locator(".media-chapter-list details").first().waitFor({ timeout: 30_000 });
  const viewportChecks = [];
  for (const width of [360, 420, 768, 1280]) {
    await workspace.setViewportSize({ width, height: 900 });
    const chapterCount = await workspace.locator(".media-chapter-list details").count();
    const contentChars = (await workspace.locator(".media-chapter-list").innerText()).trim().length;
    const overflowPx = await workspace.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    const violations = (await new AxeBuilder({ page: workspace }).analyze()).violations
      .filter((item) => item.impact === "serious" || item.impact === "critical")
      .map((item) => ({ id: item.id, impact: item.impact }));
    viewportChecks.push({ width, chapterCount, contentChars, overflowPx, violations, screenshotBytes: (await workspace.screenshot()).length });
  }
  const keyboardRouteHref = await workspace.locator(".media-chapter-index a").last().getAttribute("href");
  await workspace.locator(".media-chapter-index a").last().focus();
  await workspace.keyboard.press("Enter");
  await workspace.locator(".media-chapter-list details[open]").last().waitFor({ timeout: 10_000 });
  const keyboardRouteOutcome = keyboardRouteHref !== null
    && await workspace.evaluate((expected) => window.location.hash === expected, keyboardRouteHref);
  const historical = await context.newPage();
  await historical.goto(`chrome-extension://${extensionId}/workspace.html#/media/tasks/${oldTaskId}`, { waitUntil: "domcontentloaded" });
  await historical.getByText("历史授权结果：仅供查看", { exact: false }).waitFor({ timeout: 20_000 });
  const passed = beforeClick.task_id === oldTaskId && conflictVisibleBeforeClick
    && (process.env.NAVIA_STAGE_A_DROP_SWITCH_RESPONSE !== "1" || switchResponseDropped)
    && switchRows.length === 1 && switchRows[0].old_task_id === oldTaskId && switchRows[0].new_task_id === newTaskId
    && switchRows[0].old_policy_revision === 1 && switchRows[0].new_policy_revision === 2
    && JSON.stringify(oldProductAfter) === JSON.stringify(oldProduct) && oldOutlineAfter.content_sha256 === oldOutline.content_sha256
    && ["ready", "degraded"].includes(newProduct.state) && sidepanelTaskId === newTaskId && secondTaskId === newTaskId
    && keyboardRouteOutcome
    && viewportChecks.every((item) => item.chapterCount > 0 && item.contentChars > 200
      && item.overflowPx === 0 && item.violations.length === 0 && item.screenshotBytes >= 20_000);
  const result = { schemaVersion: "v3-stage-a-policy-switch-evidence/v1", bvid, passed,
    fixture: "real_bilibili_v1_then_test_only_v2_policy_revision", oldTaskId, newTaskId,
    conflictVisibleBeforeClick, switchResponseDropped, beforeClick, switchRows, oldProductUnchanged: JSON.stringify(oldProductAfter) === JSON.stringify(oldProduct),
    oldOutlineHashUnchanged: oldOutlineAfter.content_sha256 === oldOutline.content_sha256,
    newProductState: newProduct.state, sidepanelTaskId, secondTaskId, keyboardRouteHref, keyboardRouteOutcome, viewportChecks };
  const evidenceRoot = process.env.NAVIA_STAGE_A_EVIDENCE_ROOT;
  if (evidenceRoot) {
    mkdirSync(evidenceRoot, { recursive: true });
    writeFileSync(join(evidenceRoot, `${new Date().toISOString().replace(/[^0-9TZ]/g, "")}-policy-switch-result.json`), JSON.stringify(result, null, 2));
  }
  console.log(JSON.stringify(result));
  if (!passed) process.exitCode = 2;
} finally {
  if (context) await context.close().catch(() => undefined);
  await stopRuntime();
  rmSync(scratch, { recursive: true, force: true });
}
