import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const pageUrl = process.env.NAVIA_V3_5_HUMAN_REVIEW_URL;
if (!pageUrl) throw new Error("NAVIA_V3_5_HUMAN_REVIEW_URL is required");

const browser = await chromium.launch({ headless: true });
const observations = [];
try {
  for (const viewport of [{ width: 360, height: 900 }, { width: 420, height: 900 }, { width: 768, height: 900 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(pageUrl, { waitUntil: "networkidle" });
    const images = await page.locator("img").evaluateAll((nodes) => nodes.map((node) => ({ complete: node.complete, width: node.naturalWidth, height: node.naturalHeight })));
    const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations.filter((item) => item.impact === "serious").length;
    const critical = axe.violations.filter((item) => item.impact === "critical").length;
    if (dimensions.scrollWidth !== dimensions.clientWidth) throw new Error(`root overflow at ${viewport.width}`);
    if (!images.every((item) => item.complete && item.width > 0 && item.height > 0)) throw new Error(`image load failure at ${viewport.width}`);
    if (serious || critical) throw new Error(`axe failure at ${viewport.width}: ${serious}/${critical}`);
    observations.push({ viewport, imageCount: images.length, rootOverflow: false, axeSerious: serious, axeCritical: critical });
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  await page.goto(pageUrl, { waitUntil: "networkidle" });
  if (await page.locator("section.step").count() !== 10) throw new Error("H01..H10 count mismatch");
  if (await page.locator("input[type=radio]:checked").count() !== 0) throw new Error("human decisions were preselected");
  if (!(await page.locator("#export").isDisabled())) throw new Error("incomplete review can be exported");
  await page.keyboard.press("Tab");
  if (!(await page.evaluate(() => document.activeElement?.tagName === "A"))) throw new Error("keyboard entry focus is not visible navigation");
  await page.locator("#reviewer-id").fill("qa-automation-not-a-human-review");
  for (let index = 1; index <= 10; index += 1) await page.locator(`input[name=H${String(index).padStart(2, "0")}][value=FAIL]`).locator("..").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "navia-v3-5-human-page-qa-"));
  const submissionPath = path.join(tempDir, "submission.json");
  await download.saveAs(submissionPath);
  const submission = JSON.parse(fs.readFileSync(submissionPath, "utf8"));
  if (submission.overallDecision !== "FAIL" || submission.judgments.length !== 10) throw new Error("exported QA submission has invalid decision aggregation");
  const schemaPath = path.resolve("../../docs/active/project/contracts/v3_media_human_review_v1.schema.json");
  const validation = spawnSync("python3", ["-c", "import json,sys,jsonschema; s=json.load(open(sys.argv[1],encoding='utf-8')); d=json.load(open(sys.argv[2],encoding='utf-8')); jsonschema.Draft202012Validator.check_schema(s); jsonschema.Draft202012Validator(s).validate(d)", schemaPath, submissionPath], { encoding: "utf8" });
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (validation.status !== 0) throw new Error(`submission schema validation failed: ${validation.stderr}`);
  await context.close();
  console.log(JSON.stringify({ passed: true, surfaces: observations, steps: 10, preselectedDecisions: 0, incompleteExportBlocked: true, keyboardEntry: true, temporaryFailSubmissionSchemaValid: true, retainedSubmission: false }, null, 2));
} finally {
  await browser.close();
}
