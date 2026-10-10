import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runRoot = path.resolve(repoRoot, process.env.NAVIA_V3_ASR_QUALIFICATION_RUN_ROOT || "");
const pagePath = path.join(runRoot, "asr-provider-qualification-review.html");
const qaRoot = path.join(runRoot, "ui-qa");
const screenshotsRoot = path.join(qaRoot, "screenshots");
const profileRoot = path.join(repoRoot, ".tmp", `${path.basename(runRoot)}-qa-profile`);
const browserExecutable = process.env.NAVIA_BROWSER_EXECUTABLE || "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe";
const viewports = [[360, 900], [420, 900], [768, 900], [1280, 900]];
const identityNeedles = ["funasr", "paraformer", "faster-whisper", "production_small", "funasr_edge_local", "labelmap", "candidateside"];

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
  const port = 12200 + Math.floor(Math.random() * 400);
  const child = spawn(browserExecutable, [
    "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-sync",
    "--disable-extensions", "--disable-popup-blocking", "--mute-audio", "--window-size=1280,900",
    `--remote-debugging-port=${port}`, `--user-data-dir=${await toWindowsPath(profileRoot)}`, "about:blank",
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
      await run("powershell.exe", ["-NoProfile", "-Command", `$p=Get-CimInstance Win32_Process|Where-Object{$_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*${marker}*' -and $_.CommandLine -notlike '*--type=*'}|Select-Object -First 1;if($p){taskkill.exe /PID $p.ProcessId /T /F|Out-Null}`]);
      await wait(1200);
      fs.rmSync(profileRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
    },
  };
}

async function fillReview(page, reviewerId, choice = "equivalent") {
  await page.locator("#reviewer-id").fill(reviewerId);
  const bins = page.locator("#review-root .bin");
  ensure(await bins.count() === 24, "Review page must render exactly 24 bins");
  for (let index = 0; index < 24; index += 1) {
    const bin = bins.nth(index);
    await bin.locator(`input[name$="Choice"][value="${choice}"]`).check({ force: true });
    await bin.locator('input[name$="AMeaning"][value="true"]').check({ force: true });
    await bin.locator('input[name$="BMeaning"][value="true"]').check({ force: true });
  }
  await page.locator("#export-review").click();
  await page.locator("#export-dialog").waitFor({ state: "visible" });
  const serialized = await page.locator("#export-json").textContent();
  const outputPath = path.join(qaRoot, `${reviewerId}.json`);
  fs.writeFileSync(outputPath, serialized);
  const payload = JSON.parse(serialized);
  ensure(payload.schemaVersion === "v3-asr-blind-side-review/v1", "Review schema drifted");
  ensure(payload.judgments.length === 24, "Review denominator drifted");
  ensure(!JSON.stringify(payload).includes("machine-text"), "Review export leaked transcript text");
  return { payload, path: outputPath, sha256: sha256File(outputPath) };
}

async function main() {
  ensure(fs.existsSync(pagePath), "Generated review page is missing");
  fs.mkdirSync(screenshotsRoot, { recursive: true });
  const chrome = await launchChrome();
  const observations = [];
  let axeSummary;
  let keyboard;
  let reviewA;
  let reviewB;
  let adjudication;
  try {
    const page = await chrome.context.newPage();
    const pageUrl = `file:///${await toWindowsPath(pagePath)}`;
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto(pageUrl, { waitUntil: "load" });
      const layout = await page.evaluate((needles) => {
        const source = document.documentElement.innerHTML.toLowerCase();
        return {
          documentScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          binCount: document.querySelectorAll("#review-root .bin").length,
          textareaCount: document.querySelectorAll("textarea").length,
          identityHits: needles.filter((needle) => source.includes(needle)),
        };
      }, identityNeedles);
      const screenshotPath = path.join(screenshotsRoot, `review-${width}x${height}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      observations.push({
        width, height, ...layout,
        screenshotPath: path.relative(runRoot, screenshotPath).replaceAll("\\", "/"),
        screenshotSha256: sha256File(screenshotPath),
        passed: layout.documentScrollWidth <= width && layout.bodyScrollWidth <= width && layout.binCount === 24 && layout.textareaCount === 0 && layout.identityHits.length === 0,
      });
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(pageUrl, { waitUntil: "load" });
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    const blocking = axe.violations.filter((item) => ["serious", "critical"].includes(item.impact));
    axeSummary = {
      serious: blocking.filter((item) => item.impact === "serious").length,
      critical: blocking.filter((item) => item.impact === "critical").length,
      violations: blocking.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
    };

    await page.locator("#reviewer-id").focus();
    await page.keyboard.press("Tab");
    const tabMoved = await page.evaluate(() => document.activeElement?.id !== "reviewer-id");
    const firstChoice = page.locator('#review-root .bin').first().locator('input[name$="Choice"]').first();
    await firstChoice.focus();
    await page.keyboard.press("Space");
    const radioChecked = await firstChoice.isChecked();
    await page.locator("#tab-adjudicate").focus();
    await page.keyboard.press("Enter");
    const tabActivated = await page.locator("#panel-adjudicate").isVisible();
    keyboard = { assertionsTotal: 3, assertionsPassed: [tabMoved, radioChecked, tabActivated].filter(Boolean).length, tabMoved, radioChecked, tabActivated };

    await page.locator("#tab-review").click();
    reviewA = await fillReview(page, "qa_reviewer_a");
    await page.locator("#close-export").click();
    await page.reload({ waitUntil: "load" });
    reviewB = await fillReview(page, "qa_reviewer_b");
    reviewB.payload.judgments[0].choice = "side_a_better";
    reviewB.payload.judgments[0].sideBMeaningPreserved = false;
    fs.writeFileSync(reviewB.path, `${JSON.stringify(reviewB.payload, null, 2)}\n`);
    reviewB.sha256 = sha256File(reviewB.path);
    await page.locator("#close-export").click();
    await page.locator("#tab-adjudicate").click();
    await page.locator("#adjudicator-id").fill("qa_adjudicator");
    await page.locator("#review-file-a").setInputFiles(reviewA.path);
    await page.locator("#review-file-b").setInputFiles(reviewB.path);
    await page.waitForFunction(() => document.querySelector("#resolution-root .bin"));
    ensure(await page.locator("#resolution-root .bin").count() === 1, "Synthetic reviews must create one disagreement");
    const resolution = page.locator("#resolution-root .bin").first();
    await resolution.locator('input[name$="Resolution"][value="equivalent"]').check({ force: true });
    await resolution.locator('[data-field="note"]').fill("QA synthetic resolution");
    await page.locator("#export-adjudication").click();
    await page.locator("#export-dialog").waitFor({ state: "visible" });
    const adjudicationText = await page.locator("#export-json").textContent();
    const adjudicationPath = path.join(qaRoot, "qa-adjudication.json");
    fs.writeFileSync(adjudicationPath, adjudicationText);
    const adjudicationPayload = JSON.parse(adjudicationText);
    ensure(adjudicationPayload.schemaVersion === "v3-asr-blind-side-adjudication/v1", "Adjudication schema drifted");
    ensure(adjudicationPayload.disagreementResolutions.length === 1, "Adjudication denominator drifted");
    adjudication = { path: adjudicationPath, sha256: sha256File(adjudicationPath), resolutionCount: 1 };
  } finally {
    await chrome.close();
  }

  const result = {
    schemaVersion: "v3-asr-provider-qualification-page-qa/v1",
    viewports: observations,
    axe: axeSummary,
    keyboard,
    reviewExports: [reviewA, reviewB].map((row) => ({ path: path.relative(runRoot, row.path).replaceAll("\\", "/"), sha256: row.sha256, judgmentCount: row.payload.judgments.length })),
    adjudication: { path: path.relative(runRoot, adjudication.path).replaceAll("\\", "/"), sha256: adjudication.sha256, resolutionCount: adjudication.resolutionCount },
    cleanup: { profileDeleted: !fs.existsSync(profileRoot) },
  };
  result.passed = result.viewports.every((row) => row.passed) && result.axe.serious === 0 && result.axe.critical === 0 && result.keyboard.assertionsPassed === 3 && result.cleanup.profileDeleted;
  fs.writeFileSync(path.join(qaRoot, "page-qa-result.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}

await main();
