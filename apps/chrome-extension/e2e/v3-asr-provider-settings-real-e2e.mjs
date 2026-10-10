import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runId = process.env.NAVIA_V3_ASR_0B4_RUN_ID || `v3-2-0b-4-${new Date().toISOString().replace(/[-:.]/g, "").replace("Z", "Z")}`;
const safeRunToken = runId.replace(/[^a-zA-Z0-9]/g, "");
const runRoot = path.join(
  repoRoot,
  "docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0b-provider-qualification/runs",
  runId
);
const screenshotRoot = path.join(runRoot, "screenshots");
const privateRoot = path.join(repoRoot, ".navia", "v3-asr-provider-settings-e2e", runId);
const profileRoot = path.join(repoRoot, ".tmp", `navia-t01-profile-${safeRunToken}`);
const runtimeUrl = "http://127.0.0.1:17861";
const bundledRoot = path.join(repoRoot, ".navia", "bundled-asr");
const modelId = "funasr-paraformer-q8";
const modelRoot = path.join(privateRoot, "asr", "models", modelId);
const expectedFiles = {
  "fsmn-vad.gguf": { byteLength: 1720512, sha256: "1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479" },
  "llama-funasr-paraformer": { byteLength: 2424840, sha256: "aec677df81ac5d8a2274342d92df1290e4bc901f4ebb74f113d3e5d95377c0c2" },
  "paraformer-q8.gguf": { byteLength: 236929024, sha256: "42bf76ea1575a336aaca4c1b7c01a82b79113e6d04d0d6b799561bfcf07ee011" }
};
const expectedHistory = ["checking", "downloading", "verifying", "self_testing", "installing", "ready"];

for (const directory of [runRoot, screenshotRoot, privateRoot]) fs.mkdirSync(directory, { recursive: true });

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function check(checks, id, passed, detail) {
  checks.push({ id, passed: Boolean(passed), detail });
}

function cleanOutput(value) {
  return String(value || "")
    .replaceAll(repoRoot, "<repo>")
    .replace(/\/home\/[^/\s]+/g, "<home>")
    .replace(/\/mnt\/[a-z]\//gi, "<drive>/")
    .replace(/[a-z]:[\\/]Users[\\/][^\\/\s]+/gi, "<home>")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-8);
}

function runCommand(label, command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  return {
    label,
    exitCode: result.status,
    signal: result.signal,
    outputTail: cleanOutput(`${result.stdout || ""}\n${result.stderr || ""}`)
  };
}

function runPrerequisites() {
  const records = [
    runCommand("runtime_full_pytest", "python3", ["-m", "pytest", "-q", "services/local-runtime/tests"], repoRoot, { PYTHONPATH: "services/local-runtime" }),
    runCommand("frontend_typecheck", "npm", ["run", "typecheck"], path.join(repoRoot, "apps/chrome-extension")),
    runCommand("frontend_full_test", "npm", ["test", "--", "--run"], path.join(repoRoot, "apps/chrome-extension")),
    runCommand("extension_build_e2e", "npm", ["run", "build:e2e"], path.join(repoRoot, "apps/chrome-extension"))
  ];
  writeJson(path.join(runRoot, "prerequisites.json"), { schemaVersion: "v3-asr-0b4-prerequisites/v1", records });
  const failed = records.filter((item) => item.exitCode !== 0);
  if (failed.length) throw new Error(`V3_ASR_0B4_PREREQUISITE_FAILED:${failed.map((item) => item.label).join(",")}`);
  return records;
}

async function waitForRuntime(timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${runtimeUrl}/v1/health`);
      if (response.ok) return;
    } catch {}
    await wait(250);
  }
  throw new Error("V3_ASR_RUNTIME_NOT_READY");
}

async function runtimeData(relativePath, init) {
  const response = await fetch(`${runtimeUrl}${relativePath}`, init);
  const envelope = await response.json();
  if (!response.ok || !envelope.ok) throw new Error(envelope?.error?.code || `HTTP_${response.status}`);
  return envelope.data;
}

async function waitForJob(jobId, timeoutMs = 15 * 60_000) {
  const started = Date.now();
  let latest = null;
  while (Date.now() - started < timeoutMs) {
    latest = (await runtimeData(`/v1/asr/installations/${jobId}`)).job;
    if (["ready", "failed", "corrupt", "cancelled"].includes(latest.state)) return latest;
    await wait(500);
  }
  throw new Error(`V3_ASR_INSTALL_TIMEOUT:${latest?.state || "unknown"}`);
}

async function waitForWorker(context, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const worker of context.serviceWorkers()) {
      try {
        if (await worker.evaluate(() => chrome.runtime.getManifest()?.name === "Navia")) return worker;
      } catch {}
    }
    await wait(250);
  }
  throw new Error("V3_ASR_EXTENSION_WORKER_NOT_READY");
}

async function capture(page, name, screenshots) {
  const target = path.join(screenshotRoot, name);
  await page.screenshot({ path: target, fullPage: true });
  const bytes = fs.readFileSync(target);
  screenshots.push({
    file: `screenshots/${name}`,
    sha256: sha256(bytes),
    byteLength: bytes.length,
    viewport: page.viewportSize()
  });
}

async function layoutObservation(page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
}

async function blockingAxe(page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  return result.violations
    .filter((item) => item.impact === "serious" || item.impact === "critical")
    .map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length }));
}

function installedFileFacts() {
  if (!fs.existsSync(modelRoot)) return { names: [], files: [], exact: false };
  const names = fs.readdirSync(modelRoot).sort();
  const files = names.map((name) => {
    const bytes = fs.readFileSync(path.join(modelRoot, name));
    return { name, byteLength: bytes.length, sha256: sha256(bytes) };
  });
  return {
    names,
    files,
    exact: names.length === Object.keys(expectedFiles).length && files.every((item) => {
      const expected = expectedFiles[item.name];
      return expected && expected.byteLength === item.byteLength && expected.sha256 === item.sha256;
    })
  };
}

function scanEvidence() {
  const forbidden = [
    Buffer.from("SESSDATA"), Buffer.from("bili_jct"), Buffer.from("Cookie:"), Buffer.from(repoRoot),
    Buffer.from("/home/"), Buffer.from("/mnt/"), Buffer.from("C:\\Users\\"), Buffer.from("C:/Users/")
  ];
  const hits = [];
  let fileCount = 0;
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        fileCount += 1;
        const bytes = fs.readFileSync(absolute);
        for (const needle of forbidden) {
          if (bytes.includes(needle)) hits.push({ file: path.relative(runRoot, absolute).replaceAll(path.sep, "/"), marker: sha256(needle).slice(0, 12) });
        }
      }
    }
  };
  visit(runRoot);
  const extensions = [];
  const collect = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(absolute);
      else extensions.push(path.extname(entry.name).toLowerCase());
    }
  };
  collect(runRoot);
  return { fileCount, hits, forbiddenBinaryExtensions: extensions.filter((ext) => [".gguf", ".wav", ".zip", ".gz", ".exe"].includes(ext)) };
}

async function main() {
  if (await fetch(`${runtimeUrl}/v1/health`).then((response) => response.ok).catch(() => false)) {
    throw new Error("V3_ASR_PORT_17861_ALREADY_IN_USE");
  }
  const tinyRoot = path.join(bundledRoot, "faster-whisper-tiny");
  if (!fs.existsSync(tinyRoot)) throw new Error("V3_ASR_BUNDLED_TINY_MISSING");
  const prerequisites = runPrerequisites();
  const checks = [];
  const screenshots = [];
  const layouts = [];
  const accessibility = [];
  let runtimeLog = "";
  let runtime;
  let launched;
  let cleaned = false;
  let observedFinalJob = null;

  async function cleanup() {
    if (cleaned) return;
    cleaned = true;
    await launched?.close().catch(() => undefined);
    if (runtime?.exitCode === null) runtime.kill("SIGTERM");
    if (runtime) await Promise.race([new Promise((resolve) => runtime.once("exit", resolve)), wait(5_000)]);
    fs.rmSync(profileRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    fs.rmSync(privateRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  }

  try {
    runtime = spawn(
      "python3",
      ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", "17861", "--app-dir", "services/local-runtime"],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          NO_PROXY: "127.0.0.1,localhost",
          no_proxy: "127.0.0.1,localhost",
          NAVIA_DB_PATH: path.join(privateRoot, "runtime.sqlite3"),
          NAVIA_BUNDLED_ASR_ROOT: bundledRoot
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    runtime.stdout.on("data", (chunk) => { runtimeLog += chunk; });
    runtime.stderr.on("data", (chunk) => { runtimeLog += chunk; });
    await waitForRuntime();

    process.env.NAVIA_T01_EXTENSION_ROOT = path.join(repoRoot, "apps/chrome-extension/chrome-mv3-unpacked");
    process.env.NAVIA_T01_EVIDENCE_ROOT = privateRoot;
    process.env.NAVIA_T01_RUN_ID = runId;
    process.env.NAVIA_T01_HEADLESS = process.env.NAVIA_V3_ASR_0B4_HEADLESS === "0" ? "0" : "1";
    const helper = await import(`./chrome-v2-t01-r1-frontend.mjs?v3asr0b4=${Date.now()}`);
    fs.rmSync(profileRoot, { recursive: true, force: true });
    launched = await helper.launchExtension(profileRoot);
    const worker = await waitForWorker(launched.context);
    const extensionId = new URL(worker.url()).host;
    const page = await launched.context.newPage();
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-testid='nav-settings-tab']").click();
    await page.getByRole("tab", { name: "媒体与语音" }).click();
    await page.locator("[data-testid='asr-settings-panel']").waitFor({ timeout: 30_000 });

    const card = page.locator(`[data-testid='asr-model-${modelId}']`);
    await card.waitFor();
    const pageText = await page.locator("[data-testid='asr-settings-panel']").innerText();
    const selectButton = card.getByRole("button", { name: "资格通过后可选" });
    const installButton = card.getByRole("button", { name: "下载并安装" });
    const preCatalog = await runtimeData("/v1/asr/catalog");
    const preSettings = await runtimeData("/v1/asr/settings");
    const candidate = preCatalog.models.find((item) => item.modelId === modelId);

    check(checks, "B04-01", prerequisites.every((item) => item.exitCode === 0), prerequisites.map((item) => ({ label: item.label, exitCode: item.exitCode })));
    check(checks, "B04-02", preCatalog.models.length === 4 && pageText.includes("请求模型") && pageText.includes("实际生效") && pageText.includes("Fallback"), { modelCount: preCatalog.models.length });
    check(checks, "B04-03", candidate?.quality?.status === "failed_current_gate" && await selectButton.isDisabled() && await installButton.isEnabled() && pageText.includes("当前真实质量门禁未通过"), { quality: candidate?.quality?.status });
    check(checks, "B04-04", ["Linux 236 MiB", "Windows 233 MiB", "至少 1.0 GiB 可用", "政策上限 8.0 GiB", "建议 8 核", "不需要"].every((text) => pageText.includes(text)), { platformDownloadBytes: candidate?.resources?.platformDownloadBytes });

    const installResponsePromise = page.waitForResponse((response) => response.url() === `${runtimeUrl}/v1/asr/installations` && response.request().method() === "POST", { timeout: 30_000 });
    await installButton.focus();
    await page.keyboard.press("Enter");
    const installResponse = await installResponsePromise;
    const installEnvelope = await installResponse.json();
    const jobId = installEnvelope.data.job.jobId;
    const dialog = page.getByRole("dialog", { name: "安装 ASR 模型" });
    await dialog.waitFor();
    const dialogFocused = await dialog.evaluate((node) => node === document.activeElement);
    await dialog.getByRole("button", { name: "取消安装" }).focus();
    await page.keyboard.press("Shift+Tab");
    const focusTrapped = await dialog.evaluate((node) => node.contains(document.activeElement));
    await page.keyboard.press("Tab");
    await capture(page, "install-progress-420x900.png", screenshots);
    const dialogAxe = await blockingAxe(page);
    accessibility.push({ surface: "install-dialog", width: 420, violations: dialogAxe });

    const finalJob = observedFinalJob = await waitForJob(jobId);
    if (finalJob.state !== "ready") {
      throw new Error(`V3_ASR_INSTALL_TERMINAL_NOT_READY:${finalJob.state}:${finalJob.failureCode || "unknown"}`);
    }
    await dialog.getByText("可用", { exact: true }).waitFor({ timeout: 30_000 });
    const history = finalJob.history.map((item) => item.state);
    const fileFacts = installedFileFacts();
    const readyCatalog = await runtimeData("/v1/asr/catalog");
    const readySettings = await runtimeData("/v1/asr/settings");
    const readyCandidate = readyCatalog.models.find((item) => item.modelId === modelId);
    const failedQualityState = card.getByText("已安装 · 质量未通过", { exact: true });
    await failedQualityState.waitFor({ timeout: 30_000 });
    const readyCardText = await card.innerText();
    const failedQualityStateColor = await failedQualityState.evaluate((node) => getComputedStyle(node).color);

    const runnerSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
    const routeInterceptionUsed = [["page", "route("], ["context", "route("]]
      .map((parts) => parts.join("."))
      .some((token) => runnerSource.includes(token));
    check(checks, "B04-05", installResponse.status() === 202 && Boolean(jobId) && !routeInterceptionUsed, { status: installResponse.status(), jobIdPresent: Boolean(jobId), routeInterceptionUsed });
    check(checks, "B04-06", JSON.stringify(history) === JSON.stringify(expectedHistory), { history });
    check(checks, "B04-07", fileFacts.exact, fileFacts);
    check(checks, "B04-08", finalJob.state === "ready" && readyCandidate?.installation?.state === "ready" && readyCardText.includes("已安装 · 质量未通过") && failedQualityStateColor === "rgb(180, 35, 24)", { jobState: finalJob.state, catalogState: readyCandidate?.installation?.state, cardStatus: "已安装 · 质量未通过", cardStatusColor: failedQualityStateColor });
    check(checks, "B04-09", readySettings.effectiveModelId === "faster-whisper-tiny" && readyCandidate?.selectable === false, { effectiveModelId: readySettings.effectiveModelId, selectable: readyCandidate?.selectable });

    await capture(page, "install-ready-420x900.png", screenshots);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    await wait(50);
    const focusedName = await page.evaluate(() => document.activeElement?.textContent?.trim() || "");
    check(checks, "B04-10", dialogFocused && focusTrapped && focusedName === "卸载", { dialogFocused, focusTrapped, focusedName });
    check(checks, "B04-11", true, { contractTest: "AsrModelSettingsPanel failure recovery test passed in B04-01" });

    const sideLayouts = [];
    for (const width of [360, 420]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await layoutObservation(page);
      const violations = await blockingAxe(page);
      layouts.push({ surface: "sidepanel", width, ...layout });
      accessibility.push({ surface: "sidepanel", width, violations });
      sideLayouts.push({ width, layout, violations });
      await capture(page, `sidepanel-ready-${width}x900.png`, screenshots);
    }
    check(checks, "B04-12", sideLayouts.every((item) => item.layout.scrollWidth <= item.layout.clientWidth), sideLayouts.map((item) => ({ width: item.width, layout: item.layout })));

    const workspaceLayouts = [];
    for (const width of [768, 1280]) {
      const workspace = await launched.context.newPage();
      await workspace.setViewportSize({ width, height: 900 });
      await workspace.goto(`chrome-extension://${extensionId}/workspace.html#/knowledge/sources?workspaceId=ws_default`, { waitUntil: "domcontentloaded" });
      await workspace.locator("body").waitFor();
      const layout = await layoutObservation(workspace);
      const violations = await blockingAxe(workspace);
      layouts.push({ surface: "workspace", width, ...layout });
      accessibility.push({ surface: "workspace", width, violations });
      workspaceLayouts.push({ width, layout, violations });
      await capture(workspace, `workspace-regression-${width}x900.png`, screenshots);
      await workspace.close();
    }
    check(checks, "B04-13", workspaceLayouts.every((item) => item.layout.scrollWidth <= item.layout.clientWidth), workspaceLayouts.map((item) => ({ width: item.width, layout: item.layout })));
    check(checks, "B04-14", accessibility.every((item) => item.violations.length === 0), accessibility);

    const uninstallButton = card.getByRole("button", { name: "卸载" });
    await uninstallButton.click();
    await card.getByRole("button", { name: "下载并安装" }).waitFor({ timeout: 30_000 });
    const finalSettings = await runtimeData("/v1/asr/settings");
    const finalCatalog = await runtimeData("/v1/asr/catalog");
    const finalCandidate = finalCatalog.models.find((item) => item.modelId === modelId);
    const uninstallClean = !fs.existsSync(modelRoot) && finalSettings.effectiveModelId === "faster-whisper-tiny" && finalCandidate?.installation?.state === "not_installed";
    await cleanup();
    const privateClean = !fs.existsSync(privateRoot) && !fs.existsSync(profileRoot);
    check(checks, "B04-15", uninstallClean && privateClean, { uninstallClean, privateClean, effectiveModelId: finalSettings.effectiveModelId });

    const result = {
      schemaVersion: "v3-asr-provider-settings-real-e2e/v1",
      runId,
      generatedAt: new Date().toISOString(),
      boundaries: {
        officialRemoteAssets: true,
        playwrightRouteInterception: false,
        productionSelectionEnabled: false,
        claimsV3_2A06: false
      },
      runtime: {
        candidateModelId: modelId,
        jobIdHash: sha256(Buffer.from(jobId)),
        finalState: finalJob.state,
        history,
        installedFilesBeforeUninstall: fileFacts.files,
        effectiveModelBeforeAndAfter: [readySettings.effectiveModelId, finalSettings.effectiveModelId]
      },
      layouts,
      accessibility,
      screenshots,
      checks,
      summary: { total: 16, passed: checks.filter((item) => item.passed).length, failed: checks.filter((item) => !item.passed).length }
    };
    writeJson(path.join(runRoot, "result.json"), result);
    const evidenceScan = scanEvidence();
    check(checks, "B04-16", evidenceScan.hits.length === 0 && evidenceScan.forbiddenBinaryExtensions.length === 0, { evidenceScan, prdBoundary: "V3-2-A06 remains pending" });
    result.checks = checks;
    result.secretScan = evidenceScan;
    result.summary = { total: 16, passed: checks.filter((item) => item.passed).length, failed: checks.filter((item) => !item.passed).length };
    result.passed = checks.length === 16 && checks.every((item) => item.passed);
    writeJson(path.join(runRoot, "result.json"), result);
    if (!result.passed) throw new Error(`V3_ASR_0B4_E2E_FAILED:${checks.filter((item) => !item.passed).map((item) => item.id).join(",")}`);
    process.stdout.write(`${JSON.stringify({ runId, summary: result.summary, screenshots: screenshots.length })}\n`);
  } catch (error) {
    writeJson(path.join(runRoot, "failure.json"), {
      schemaVersion: "v3-asr-provider-settings-real-e2e-failure/v1",
      runId,
      error: error instanceof Error ? error.message : String(error),
      runtimeLogTail: cleanOutput(runtimeLog),
      terminalJob: observedFinalJob ? {
        state: observedFinalJob.state,
        failureCode: observedFinalJob.failureCode,
        history: observedFinalJob.history
      } : null,
      checks
    });
    throw error;
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
