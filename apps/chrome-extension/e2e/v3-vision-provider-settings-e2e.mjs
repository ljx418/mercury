import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { extensionWorker, launchExtension } from "./chrome-v2-t01-r1-frontend.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const runId = process.env.NAVIA_V3_VISION_SETTINGS_RUN_ID || `v3-3-0b-${new Date().toISOString().replace(/[:.]/g, "")}`;
const output = path.join(root, "docs/active/project/evidence/v3_media_companion/v3-3-dependency-freeze/v3-3-0b-multi-provider-settings", runId);
const profile = path.join(root, ".tmp", `${runId}-profile`);
const privateRoot = path.join(root, ".navia", "v3-vision-settings-e2e", runId);
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(privateRoot, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  fs.rmSync(profile, { recursive: true, force: true });
  const launched = await launchExtension(profile);
  let runtime;
  const report = { schemaVersion: "v3-vision-provider-settings-e2e/v1", runId, checks: [], screenshots: [], passed: false };
  try {
    const worker = await extensionWorker(launched.context);
    const extensionId = new URL(worker.url()).host;
    runtime = spawn("python3", ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", "17861", "--app-dir", "services/local-runtime"], {
      cwd: root,
      env: { ...process.env, NAVIA_DB_PATH: path.join(privateRoot, "runtime.sqlite3"), NAVIA_LOCAL_FILES_EXTENSION_ID: extensionId, NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { if ((await fetch("http://127.0.0.1:17861/v1/health")).ok) break; } catch {}
      await wait(100);
    }
    const page = await launched.context.newPage();
    for (const width of [360, 420]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-testid='nav-settings-tab']").click();
      await page.getByRole("tab", { name: "媒体与语音" }).click();
      const panel = page.locator("[data-testid='vision-provider-settings']");
      await panel.waitFor({ timeout: 20_000 });
      await panel.getByText("操作系统凭据库", { exact: false }).first().waitFor();
      const secretInput = panel.locator("input[type='password']");
      const button = panel.getByRole("button", { name: "保存、测试并使用" });
      const providerSelect = panel.getByLabel("服务商");
      const modelSelect = panel.getByLabel("模型");
      await providerSelect.locator("option").first().waitFor({ state: "attached", timeout: 20_000 });
      await modelSelect.locator("option").first().waitFor({ state: "attached", timeout: 20_000 });
      await secretInput.fill("temporary-ui-editability-check");
      const inputEditable = await secretInput.inputValue() === "temporary-ui-editability-check" && !(await button.isDisabled());
      await secretInput.fill("");
      const uiDetail = {
        passwordInputCount: await secretInput.count(),
        submitDisabled: await button.isDisabled(),
        inputEditable,
        providerValue: await providerSelect.inputValue(),
        modelValue: await modelSelect.inputValue()
      };
      report.checks.push({
        id: `ui_${width}`,
        passed: uiDetail.passwordInputCount === 1
          && uiDetail.submitDisabled
          && uiDetail.inputEditable
          && uiDetail.providerValue === "minimax-openai-vision"
          && uiDetail.modelValue === "MiniMax-M3",
        detail: uiDetail
      });
      const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
      report.checks.push({ id: `axe_${width}`, passed: violations.length === 0, detail: violations.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })) });
      const screenshot = path.join(output, `vision-provider-settings-${width}x900.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      const bytes = fs.readFileSync(screenshot);
      report.screenshots.push({ path: path.basename(screenshot), sha256: crypto.createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.length, width });
    }
    report.passed = report.checks.every((item) => item.passed);
    fs.writeFileSync(path.join(output, "result.json"), JSON.stringify(report, null, 2) + "\n");
    if (!report.passed) throw new Error("vision settings acceptance failed");
    console.log(JSON.stringify({ runId, passed: report.passed, checks: report.checks.length, screenshots: report.screenshots.length }));
  } finally {
    runtime?.kill("SIGTERM");
    await launched.close().catch(() => undefined);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
