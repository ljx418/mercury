import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runId = process.env.NAVIA_V3_ASR_SETTINGS_RUN_ID || `v3-2-0a-${new Date().toISOString().replace(/[:.]/g, "")}`;
const runRoot = path.resolve(process.env.NAVIA_V3_ASR_SETTINGS_EVIDENCE_ROOT || path.join(
  repoRoot,
  "docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0a-asr-model-management",
  runId
));
const screenshotRoot = path.join(runRoot, "screenshots");
const privateRoot = path.join(repoRoot, ".navia", "v3-asr-settings-e2e", runId);
const profileRoot = path.join(repoRoot, ".tmp", `navia-${runId}-profile`);
const runtimeUrl = "http://127.0.0.1:17861";
const bundledRoot = path.join(repoRoot, ".navia", "bundled-asr");

for (const directory of [runRoot, screenshotRoot, privateRoot]) fs.mkdirSync(directory, { recursive: true });

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function check(checks, id, passed, detail) {
  checks.push({ id, passed: Boolean(passed), detail });
}

async function waitForRuntime(timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${runtimeUrl}/v1/health`);
      if (response.ok) return;
    } catch {}
    await wait(200);
  }
  throw new Error("V3_ASR_RUNTIME_NOT_READY");
}

async function waitForWorker(context, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const worker of context.serviceWorkers()) {
      try {
        if (await worker.evaluate(() => chrome.runtime.getManifest()?.name === "Navia")) return worker;
      } catch {}
    }
    await wait(200);
  }
  throw new Error("V3_ASR_EXTENSION_WORKER_NOT_READY");
}

async function capture(page, name, records) {
  const target = path.join(screenshotRoot, name);
  await page.screenshot({ path: target, fullPage: true });
  const bytes = fs.readFileSync(target);
  records.push({
    path: path.relative(runRoot, target).replaceAll(path.sep, "/"),
    sha256: sha256(bytes),
    byteLength: bytes.length,
    viewport: page.viewportSize(),
    url: page.url()
  });
}

async function layoutObservation(page) {
  return page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    rootScrollWidth: document.querySelector("[data-testid='navia-sidepanel-root']")?.scrollWidth ?? null
  }));
}

async function blockingAxe(page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  return result.violations
    .filter((item) => item.impact === "serious" || item.impact === "critical")
    .map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length }));
}

function stopWindowsChromeProfile(profilePath) {
  if (process.platform !== "linux") return;
  const profileName = path.basename(profilePath).replaceAll("'", "''");
  const script = `$p='${profileName}'; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like ('*'+$p+'*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 800`;
  spawnSync("powershell.exe", ["-NoProfile", "-Command", script], { encoding: "utf8" });
}

function fakeJob(state) {
  const terminal = ["cancelled", "failed", "corrupt", "ready"].includes(state);
  return {
    schemaVersion: "v3-asr-installation-job/v1",
    jobId: "asrjob_ui_e2e",
    modelId: "faster-whisper-small",
    source: "remote",
    state,
    bytesCompleted: state === "downloading" ? 1048576 : 2097152,
    bytesTotal: 483546902,
    percent: state === "downloading" ? 0.2 : 0.4,
    bytesPerSecond: 524288,
    etaSeconds: terminal ? null : 920,
    message: state === "cancelled" ? "Installation cancelled and temporary files removed." : "Downloading verified model assets.",
    failureCode: null,
    sequence: state === "cancelled" ? 4 : 2,
    createdAt: "2026-09-21T00:00:00Z",
    updatedAt: "2026-09-21T00:00:01Z",
    finishedAt: terminal ? "2026-09-21T00:00:02Z" : null
  };
}

async function main() {
  const bundledModelRoot = path.join(bundledRoot, "faster-whisper-tiny");
  if (!fs.existsSync(bundledModelRoot) || !fs.statSync(bundledModelRoot).isDirectory()) {
    throw new Error("V3_ASR_BUNDLED_TINY_MISSING");
  }

  const runtime = spawn(
    "python3",
    ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", "17861", "--app-dir", "services/local-runtime"],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        NO_PROXY: "127.0.0.1,localhost",
        no_proxy: "127.0.0.1,localhost",
        NAVIA_DB_PATH: path.join(privateRoot, "runtime.sqlite3"),
        NAVIA_BUNDLED_ASR_ROOT: bundledRoot
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  let runtimeLog = "";
  runtime.stdout.on("data", (chunk) => { runtimeLog += chunk; });
  runtime.stderr.on("data", (chunk) => { runtimeLog += chunk; });

  let launched;
  const checks = [];
  const screenshots = [];
  const accessibility = [];
  const layouts = [];
  try {
    await waitForRuntime();
    process.env.NAVIA_T01_EXTENSION_ROOT = path.join(repoRoot, "apps/chrome-extension/chrome-mv3-unpacked");
    process.env.NAVIA_T01_EVIDENCE_ROOT = privateRoot;
    process.env.NAVIA_T01_RUN_ID = runId;
    process.env.NAVIA_T01_HEADLESS = process.env.NAVIA_V3_ASR_SETTINGS_HEADLESS === "0" ? "0" : "1";
    const helpers = await import(`./chrome-v2-t01-r1-frontend.mjs?v3asr=${Date.now()}`);
    fs.rmSync(profileRoot, { recursive: true, force: true });
    launched = await helpers.launchExtension(profileRoot);
    const worker = await waitForWorker(launched.context);
    const extensionId = new URL(worker.url()).host;
    const page = await launched.context.newPage();
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-testid='nav-settings-tab']").click();
    await page.getByRole("tab", { name: "媒体与语音" }).click();
    await page.locator("[data-testid='asr-settings-panel']").waitFor({ timeout: 20_000 });
    await page.getByText("faster-whisper-tiny", { exact: true }).first().waitFor();

    const requested = await page.locator(".asr-selection-summary dd").nth(0).textContent();
    const effective = await page.locator(".asr-selection-summary dd").nth(1).textContent();
    check(checks, "catalog_requested_effective_visible", requested === "faster-whisper-tiny" && effective === "faster-whisper-tiny", { requested, effective });
    check(checks, "tiny_quality_boundary_visible", await page.locator("[data-testid='asr-model-faster-whisper-tiny'][data-quality-status='fallback_only']").getByText(/不计入 V3-2-A06/).count() === 1, "fallback-only boundary");
    check(checks, "small_failed_gate_visible", await page.locator("[data-testid='asr-model-faster-whisper-small'][data-quality-status='failed_current_gate']").getByText(/当前真实质量门禁未通过/).count() === 1, "small remains failed_current_gate");
    check(checks, "qualification_models_not_installable", await page.locator("[data-testid='asr-model-funasr-paraformer-zh'] button").count() === 1, "only disabled select button rendered");

    for (const width of [360, 420]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await layoutObservation(page);
      layouts.push({ surface: "sidepanel", width, ...layout });
      check(checks, `sidepanel_${width}_no_root_overflow`, layout.documentScrollWidth <= layout.documentClientWidth, layout);
      const violations = await blockingAxe(page);
      accessibility.push({ surface: "sidepanel", width, violations });
      check(checks, `sidepanel_${width}_axe_blocking_zero`, violations.length === 0, violations);
      await capture(page, `sidepanel-asr-settings-${width}x900.png`, screenshots);
    }

    let interceptedState = "downloading";
    await page.route(`${runtimeUrl}/v1/asr/installations`, async (route) => {
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true, data: { job: fakeJob(interceptedState) }, error: null, request_id: "req_ui_e2e" }) });
    });
    await page.route(`${runtimeUrl}/v1/asr/installations/asrjob_ui_e2e`, async (route) => {
      if (route.request().method() === "DELETE") interceptedState = "cancelled";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { job: fakeJob(interceptedState) }, error: null, request_id: "req_ui_e2e" }) });
    });
    const smallCard = page.locator("[data-testid='asr-model-faster-whisper-small']");
    const installButton = smallCard.getByRole("button", { name: "下载并安装" });
    await installButton.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "安装 ASR 模型" });
    await dialog.waitFor();
    check(checks, "install_dialog_receives_focus", await dialog.evaluate((node) => node === document.activeElement), "dialog is active element");
    check(checks, "install_progress_exposes_real_fields", await dialog.getByText(/MiB\/s/).count() === 1 && await dialog.getByText(/预计 920s/).count() === 1, "bytes, speed and ETA visible");
    const modalViolations = await blockingAxe(page);
    accessibility.push({ surface: "install_dialog", width: 420, violations: modalViolations });
    check(checks, "install_dialog_axe_blocking_zero", modalViolations.length === 0, modalViolations);
    await capture(page, "sidepanel-asr-install-progress-420x900.png", screenshots);
    await dialog.getByRole("button", { name: "取消安装" }).focus();
    await page.keyboard.press("Enter");
    await dialog.getByText("已取消", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    check(checks, "cancel_and_escape_focus_return", await installButton.evaluate((node) => node === document.activeElement), "focus returned to invoking install button");

    const importButton = smallCard.getByRole("button", { name: "导入离线包" });
    const chooserPromise = page.waitForEvent("filechooser");
    await importButton.focus();
    await page.keyboard.press("Enter");
    const chooser = await chooserPromise;
    await chooser.setFiles([]);
    check(checks, "offline_import_keyboard_opens_picker", true, "trusted Enter produced file chooser");

    for (const width of [768, 1280]) {
      const workspace = await launched.context.newPage();
      await workspace.setViewportSize({ width, height: 900 });
      await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/knowledge/sources?workspaceId=ws_default`, { waitUntil: "domcontentloaded" });
      await workspace.locator("[data-testid='workspace-root']").waitFor({ timeout: 20_000 }).catch(() => workspace.locator("body").waitFor());
      const layout = await layoutObservation(workspace);
      layouts.push({ surface: "workspace-regression", width, ...layout });
      check(checks, `workspace_${width}_no_root_overflow`, layout.documentScrollWidth <= layout.documentClientWidth, layout);
      const violations = await blockingAxe(workspace);
      accessibility.push({ surface: "workspace-regression", width, violations });
      check(checks, `workspace_${width}_axe_blocking_zero`, violations.length === 0, violations);
      await capture(workspace, `workspace-regression-${width}x900.png`, screenshots);
      await workspace.close();
    }

    const result = {
      schemaVersion: "v3-asr-settings-real-chrome/v1",
      runId,
      generatedAt: new Date().toISOString(),
      implementationBoundary: {
        realRuntimeCatalogAndBundledTiny: true,
        realChromeExtensionBuild: true,
        installDialogTransport: "playwright-route-intercepted-ui-contract; backend real-byte lifecycle is covered by pytest",
        claimsV3_2A06: false
      },
      summary: { total: checks.length, passed: checks.filter((item) => item.passed).length, failed: checks.filter((item) => !item.passed).length },
      checks,
      layouts,
      accessibility,
      screenshots,
      passed: checks.every((item) => item.passed)
    };
    fs.writeFileSync(path.join(runRoot, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
    if (!result.passed) throw new Error(`V3_ASR_SETTINGS_E2E_FAILED: ${JSON.stringify(checks.filter((item) => !item.passed))}`);
    process.stdout.write(`${JSON.stringify({ runId, runRoot, summary: result.summary, screenshots: screenshots.length })}\n`);
  } finally {
    await launched?.close().catch(() => undefined);
    stopWindowsChromeProfile(profileRoot);
    if (runtime.exitCode === null) runtime.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => runtime.once("exit", resolve)), wait(5_000)]);
    fs.writeFileSync(path.join(privateRoot, "runtime.log"), runtimeLog);
    fs.rmSync(profileRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
