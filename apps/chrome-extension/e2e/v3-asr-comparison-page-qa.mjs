import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runRoot = path.resolve(repoRoot, process.env.NAVIA_V3_ASR_COMPARISON_RUN_ROOT || "");
const pagePath = path.join(runRoot, "asr-comparison-review.html");
const qaRoot = path.join(runRoot, "ui-qa");
const screenshotsRoot = path.join(qaRoot, "screenshots");
const profileRoot = path.join(repoRoot, ".tmp", `${path.basename(runRoot)}-review-qa-profile`);
const browserExecutable = process.env.NAVIA_BROWSER_EXECUTABLE || "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe";
const viewports = [[360, 900], [420, 900], [768, 900], [1280, 900]];

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function toWindowsPath(input) {
  const result = await run("wslpath", ["-w", input]);
  ensure(result.code === 0, "wslpath failed");
  return result.stdout.trim().replaceAll("\\", "/");
}

async function waitForCdp(port) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await wait(250);
  }
  throw new Error("Chrome CDP did not start");
}

async function launchChrome() {
  fs.rmSync(profileRoot, { recursive: true, force: true });
  fs.mkdirSync(profileRoot, { recursive: true });
  const port = 11800 + Math.floor(Math.random() * 400);
  const child = spawn(browserExecutable, [
    "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-sync",
    "--disable-extensions", "--disable-popup-blocking", "--mute-audio", "--window-size=1280,900",
    `--remote-debugging-port=${port}`, `--user-data-dir=${await toWindowsPath(profileRoot)}`, "about:blank"
  ], { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  await waitForCdp(port);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  return {
    browser,
    context: browser.contexts()[0],
    close: async () => {
      await browser.close().catch(() => undefined);
      child.kill("SIGTERM");
      const marker = path.basename(profileRoot);
      await run("powershell.exe", ["-NoProfile", "-Command", `$p=Get-CimInstance Win32_Process|Where-Object{$_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*${marker}*' -and $_.CommandLine -notlike '*--type=*'}|Select-Object -First 1;if($p){taskkill.exe /PID $p.ProcessId /T /F|Out-Null}`]).catch(() => undefined);
      await wait(1200);
      fs.rmSync(profileRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
    }
  };
}

async function fillReview(page) {
  await page.locator("#reviewer-id").fill("qa-reviewer");
  const bins = page.locator("#review-samples .bin");
  ensure(await bins.count() === 24, "Review page must render 24 bins");
  for (let index = 0; index < 24; index += 1) {
    const bin = bins.nth(index);
    await bin.locator('input[name$="Choice"][value="equivalent"]').check({ force: true });
    await bin.locator('input[name$="AMeaning"][value="true"]').check({ force: true });
    await bin.locator('input[name$="BMeaning"][value="true"]').check({ force: true });
  }
  await page.locator("#export-review").click();
  await page.locator("#export-dialog").waitFor({ state: "visible" });
  const serialized = await page.locator("#export-json").textContent();
  const outputPath = path.join(qaRoot, "qa-review-export.json");
  fs.writeFileSync(outputPath, serialized);
  const payload = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  ensure(payload.judgments.length === 24, "Review export must contain 24 judgments");
  ensure(!JSON.stringify(payload).includes("candidateA\":{\"text"), "Review export leaked transcript text");
  return { payload, path: "ui-qa/qa-review-export.json", sha256: sha256File(outputPath), judgmentCount: payload.judgments.length };
}

async function testAdjudication(page, firstReview) {
  const second = structuredClone(firstReview.payload);
  second.reviewerId = "qa-reviewer-b";
  second.submittedAt = new Date().toISOString();
  second.judgments[0].choice = "candidate_a_better";
  second.judgments[0].candidateBMeaningPreserved = false;
  second.judgments[0].candidateBErrors = ["omission"];
  const secondPath = path.join(qaRoot, "qa-review-export-b.json");
  fs.writeFileSync(secondPath, `${JSON.stringify(second, null, 2)}\n`);
  await page.locator("#close-export").click();
  await page.locator("#tab-adjudicate").click();
  await page.locator("#adjudicator-id").fill("qa-adjudicator");
  await page.locator("#review-file-a").setInputFiles(path.join(qaRoot, "qa-review-export.json"));
  await page.locator("#review-file-b").setInputFiles(secondPath);
  await page.waitForFunction(() => document.querySelector("#import-status")?.textContent?.includes("实质分歧"));
  const resolutionBins = page.locator("#resolution-root .bin");
  ensure(await resolutionBins.count() === 1, "Synthetic reviews must produce one substantive disagreement");
  const bin = resolutionBins.first();
  await bin.locator('input[name$="Choice"][value="equivalent"]').check({ force: true });
  await bin.locator('input[name$="AMeaning"][value="true"]').check({ force: true });
  await bin.locator('input[name$="BMeaning"][value="true"]').check({ force: true });
  await page.locator("#export-adjudication").click();
  await page.locator("#export-dialog").waitFor({ state: "visible" });
  const serialized = await page.locator("#export-json").textContent();
  const outputPath = path.join(qaRoot, "qa-adjudication-export.json");
  fs.writeFileSync(outputPath, serialized);
  const payload = JSON.parse(serialized);
  ensure(payload.resolvedJudgments.length === 24, "Adjudication export must contain 24 resolved judgments");
  ensure(payload.reviewerIds.length === 2 && payload.reviewerIds[0] !== payload.reviewerIds[1], "Adjudication reviewers must be distinct");
  return { path: "ui-qa/qa-adjudication-export.json", sha256: sha256File(outputPath), disagreementCount: 1, resolvedJudgmentCount: payload.resolvedJudgments.length };
}

async function main() {
  ensure(fs.existsSync(pagePath), "Generated review page is missing");
  fs.mkdirSync(screenshotsRoot, { recursive: true });
  const chrome = await launchChrome();
  const observations = [];
  let axeSummary = null;
  let keyboard = null;
  let reviewExport = null;
  let adjudicationExport = null;
  try {
    const page = await chrome.context.newPage();
    const windowsPath = await toWindowsPath(pagePath);
    const pageUrl = `file:///${windowsPath}`;
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto(pageUrl, { waitUntil: "load" });
      const layout = await page.evaluate(() => ({
        viewportWidth: innerWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        binCount: document.querySelectorAll("#review-samples .bin").length,
        transcriptTextareas: document.querySelectorAll("textarea").length,
        visibleModelIdentity: document.body.innerText.includes("production_small") || document.body.innerText.includes("independent_base")
      }));
      const screenshotPath = path.join(screenshotsRoot, `review-${width}x${height}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      observations.push({ width, height, ...layout, screenshotPath: `ui-qa/screenshots/${path.basename(screenshotPath)}`, screenshotSha256: sha256File(screenshotPath), passed: layout.documentScrollWidth <= width && layout.bodyScrollWidth <= width && layout.binCount === 24 && layout.transcriptTextareas === 0 && !layout.visibleModelIdentity });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(pageUrl, { waitUntil: "load" });
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    const blocking = axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    axeSummary = { serious: blocking.filter((item) => item.impact === "serious").length, critical: blocking.filter((item) => item.impact === "critical").length, violations: blocking.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })) };

    await page.locator("#reviewer-id").focus();
    await page.keyboard.press("Tab");
    const tabReachedInteractive = await page.evaluate(() => ["A", "INPUT", "BUTTON"].includes(document.activeElement?.tagName));
    const firstChoice = page.locator('#review-samples .bin').first().locator('input[name$="Choice"]').first();
    await firstChoice.focus();
    await page.keyboard.press("Space");
    const radioKeyboardPassed = await firstChoice.isChecked();
    await page.locator("#tab-adjudicate").focus();
    await page.keyboard.press("Enter");
    const tabKeyboardPassed = await page.locator("#panel-adjudicate").isVisible();
    keyboard = { assertionsTotal: 3, assertionsPassed: [tabReachedInteractive, radioKeyboardPassed, tabKeyboardPassed].filter(Boolean).length, tabReachedInteractive, radioKeyboardPassed, tabKeyboardPassed };
    await page.locator("#tab-review").click();
    reviewExport = await fillReview(page);
    adjudicationExport = await testAdjudication(page, reviewExport);
  } finally {
    await chrome.close();
  }
  const cleanup = { profileDeleted: !fs.existsSync(profileRoot) };
  const result = {
    schemaVersion: "v3-asr-comparison-page-qa/v1",
    viewports: observations,
    axe: axeSummary,
    keyboard,
    reviewExport: { path: reviewExport.path, sha256: reviewExport.sha256, judgmentCount: reviewExport.judgmentCount },
    adjudicationExport,
    cleanup,
    passed: observations.every((item) => item.passed) && axeSummary.serious === 0 && axeSummary.critical === 0 && keyboard.assertionsPassed === keyboard.assertionsTotal && adjudicationExport.resolvedJudgmentCount === 24 && cleanup.profileDeleted
  };
  fs.writeFileSync(path.join(qaRoot, "page-qa-result.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}

await main();
