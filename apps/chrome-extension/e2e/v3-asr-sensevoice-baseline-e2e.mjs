import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runId = process.env.NAVIA_V3_SENSEVOICE_UI_RUN_ID || `v3-2-0c-1-ui-${new Date().toISOString().replace(/[-:.]/g, "")}`;
const asrRoot = path.resolve(process.env.NAVIA_V3_SENSEVOICE_ASR_ROOT || "");
const runRoot = path.resolve(process.env.NAVIA_V3_SENSEVOICE_UI_EVIDENCE_ROOT || path.join(
  repoRoot,
  "docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0c-sensevoice-spike/v3-2-0c-1-production-baseline/runs",
  runId
));
const privateRoot = path.join(repoRoot, ".navia", "v3-sensevoice-ui", runId);
const profileRoot = path.join(repoRoot, ".tmp", `navia-${runId.replace(/[^a-zA-Z0-9]/g, "")}-profile`);
const screenshotsRoot = path.join(runRoot, "screenshots");
const runtimeUrl = "http://127.0.0.1:17861";
const modelId = "funasr-sensevoice-small-q8";

for (const directory of [runRoot, screenshotsRoot, privateRoot]) fs.mkdirSync(directory, { recursive: true });
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function check(checks, id, passed, detail) {
  checks.push({ id, passed: Boolean(passed), detail });
}

async function waitForRuntime() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await fetch(`${runtimeUrl}/v1/health`).then((response) => response.ok).catch(() => false)) return;
    await wait(200);
  }
  throw new Error("V3_ASR_RUNTIME_NOT_READY");
}

async function waitForWorker(context) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    for (const worker of context.serviceWorkers()) {
      try {
        if (await worker.evaluate(() => chrome.runtime.getManifest()?.name === "Navia")) return worker;
      } catch {}
    }
    await wait(200);
  }
  throw new Error("V3_ASR_EXTENSION_WORKER_NOT_READY");
}

function stopWindowsChromeProfile(profilePath) {
  if (process.platform !== "linux") return;
  const profileName = path.basename(profilePath).replaceAll("'", "''");
  spawnSync("powershell.exe", ["-NoProfile", "-Command", `$p='${profileName}'; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like ('*'+$p+'*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { encoding: "utf8" });
}

async function main() {
  if (!asrRoot || !fs.existsSync(path.join(asrRoot, "models", modelId))) throw new Error("V3_ASR_SENSEVOICE_INSTALL_MISSING");
  if (await fetch(`${runtimeUrl}/v1/health`).then((response) => response.ok).catch(() => false)) throw new Error("V3_ASR_PORT_ALREADY_IN_USE");
  const runtime = spawn("python3", ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", "17861", "--app-dir", "services/local-runtime"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NAVIA_DB_PATH: path.join(privateRoot, "runtime.sqlite3"),
      NAVIA_ASR_ROOT: asrRoot,
      NAVIA_BUNDLED_ASR_ROOT: path.join(repoRoot, ".navia", "bundled-asr"),
      NO_PROXY: "127.0.0.1,localhost",
      no_proxy: "127.0.0.1,localhost"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let runtimeLog = "";
  runtime.stdout.on("data", (chunk) => { runtimeLog += chunk; });
  runtime.stderr.on("data", (chunk) => { runtimeLog += chunk; });
  let launched;
  const checks = [];
  const screenshots = [];
  try {
    await waitForRuntime();
    process.env.NAVIA_T01_EXTENSION_ROOT = path.join(repoRoot, "apps/chrome-extension/chrome-mv3-unpacked");
    process.env.NAVIA_T01_EVIDENCE_ROOT = privateRoot;
    process.env.NAVIA_T01_RUN_ID = runId;
    process.env.NAVIA_T01_HEADLESS = "1";
    const helper = await import(`./chrome-v2-t01-r1-frontend.mjs?sensevoice=${Date.now()}`);
    fs.rmSync(profileRoot, { recursive: true, force: true });
    launched = await helper.launchExtension(profileRoot);
    const worker = await waitForWorker(launched.context);
    const extensionId = new URL(worker.url()).host;
    const page = await launched.context.newPage();
    for (const width of [360, 420]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-testid='nav-settings-tab']").click();
      await page.getByRole("tab", { name: "媒体与语音" }).click();
      const panel = page.locator("[data-testid='asr-settings-panel']");
      await panel.waitFor({ timeout: 30_000 });
      const card = panel.locator(`[data-testid='asr-model-${modelId}']`);
      await card.getByText("已安装 · V3 基线", { exact: true }).waitFor();
      const panelText = await panel.innerText();
      const cardText = await card.innerText();
      const selectButton = card.getByRole("button", { name: "已选择" });
      check(checks, `UI-${width}-selection`, panelText.includes(modelId) && await selectButton.isDisabled(), { selected: true });
      check(checks, `UI-${width}-resources`, ["Linux 252 MiB", "Windows 249 MiB", "硬盘", "247 MiB", "政策上限 2.0 GiB", "建议 8 核", "不需要"].every((text) => cardText.includes(text)), { disclosed: true });
      check(checks, `UI-${width}-v4-boundary`, cardText.includes("自动退化检测与质量回退将在 V4 优化"), { disclosed: true });
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
      const blocking = axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
      check(checks, `UI-${width}-axe`, blocking.length === 0, blocking.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })));
      check(checks, `UI-${width}-overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), {});
      const uninstallButton = card.getByRole("button", { name: "卸载" });
      await uninstallButton.focus();
      check(checks, `UI-${width}-keyboard-focus`, await uninstallButton.evaluate((node) => node === document.activeElement), { control: "uninstall" });
      const screenshotPath = path.join(screenshotsRoot, `sensevoice-settings-${width}x900.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const bytes = fs.readFileSync(screenshotPath);
      screenshots.push({ path: `screenshots/${path.basename(screenshotPath)}`, byteLength: bytes.length, sha256: sha256(bytes), viewport: { width, height: 900 } });
    }
    const result = {
      schemaVersion: "v3-asr-sensevoice-baseline-ui/v1",
      runId,
      modelId,
      summary: { total: checks.length, passed: checks.filter((item) => item.passed).length, failed: checks.filter((item) => !item.passed).length },
      checks,
      screenshots,
      privatePathIncluded: false,
      passed: checks.every((item) => item.passed)
    };
    fs.writeFileSync(path.join(runRoot, "ui-result.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ runId, summary: result.summary, screenshots: screenshots.length, passed: result.passed }));
    if (!result.passed) process.exitCode = 2;
  } finally {
    await launched?.close().catch(() => undefined);
    stopWindowsChromeProfile(profileRoot);
    if (runtime.exitCode === null) runtime.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => runtime.once("exit", resolve)), wait(5000)]);
    fs.writeFileSync(path.join(privateRoot, "runtime.log"), runtimeLog);
    fs.rmSync(profileRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
