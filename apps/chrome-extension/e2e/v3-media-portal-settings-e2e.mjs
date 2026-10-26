import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { extensionWorker, launchExtension } from "./chrome-v2-t01-r1-frontend.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const output = path.join(root, "docs/active/project/evidence/v3_media_companion/v3-5.9-persistent-media-session-cache/browser-evidence");
const profile = path.join(root, ".tmp/v3-5.9-media-portal-settings-profile");
fs.rmSync(profile, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

const report = { schemaVersion: "v3-media-portal-settings-e2e/v1", checks: [], screenshots: [], passed: false };

async function main() {
  const launched = await launchExtension(profile);
  try {
    const worker = await extensionWorker(launched.context);
    const extensionId = new URL(worker.url()).host;
    const page = await launched.context.newPage();
    for (const width of [360, 420]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-testid='nav-settings-tab']").click();
      await page.getByRole("tab", { name: "媒体与语音" }).click();
      const panel = page.locator("[data-testid='media-portal-settings']");
      await panel.waitFor({ timeout: 30_000 });
      const details = {
        title: await panel.getByRole("heading", { name: "B站登录态下载" }).count(),
        fileInput: await panel.locator("input[type='file']").count(),
        secretTextarea: await panel.locator("textarea").count(),
        cacheQuota: await panel.getByText("空间上限", { exact: true }).count(),
        cacheRetention: await panel.getByText("自动清理", { exact: true }).count(),
        statusText: await panel.getByRole("status").innerText(),
      };
      report.checks.push({
        id: `surface_${width}`,
        passed: details.title === 1 && details.fileInput === 1 && details.secretTextarea === 1
          && details.cacheQuota === 1 && details.cacheRetention >= 1 && details.statusText.length > 0,
        detail: details,
      });
      const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze())
        .violations.filter((item) => item.impact === "serious" || item.impact === "critical");
      report.checks.push({ id: `axe_${width}`, passed: violations.length === 0, detail: violations.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })) });
      const screenshot = path.join(output, `media-portal-settings-${width}x900.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      const bytes = fs.readFileSync(screenshot);
      report.screenshots.push({ path: path.basename(screenshot), byteLength: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
    }
    report.passed = report.checks.every((item) => item.passed);
    fs.writeFileSync(path.join(output, "result.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (!report.passed) throw new Error("media portal settings browser acceptance failed");
    console.log(JSON.stringify({ extensionId, passed: true, checks: report.checks.length, screenshots: report.screenshots.length }));
  } finally {
    await launched.close().catch(() => undefined);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
