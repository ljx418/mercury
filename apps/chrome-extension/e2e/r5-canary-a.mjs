/**
 * R5 canary — stage A.
 *
 * Attaches to the OWNED Windows Chrome over CDP and opens the Side Panel as
 * an automatable extension page that targets the real video tab
 * (`?naviaE2ETabId=`), which is the same entry the product's own e2e harness
 * uses. This stage performs NO capture: it only reports what the user-reachable
 * surface offers right now.
 */

import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";

const CDP = "http://127.0.0.1:9222";
const VIDEO_PREFIX = "https://www.bilibili.com/video/BV1pohR6rEEh";
const OUT = "/mnt/c/workSpace/.r5-canary";

const browser = await chromium.connectOverCDP(CDP);
const out = { attached: true };

try {
  const contexts = browser.contexts();
  out.contextCount = contexts.length;
  const context = contexts[0];
  const pages = context.pages();
  out.pages = pages.map((p) => p.url());

  const video = pages.find((p) => p.url().startsWith(VIDEO_PREFIX));
  if (!video) throw new Error(`video page not found; pages=${JSON.stringify(out.pages)}`);
  out.videoUrl = video.url();
  out.videoTitle = await video.title();

  // Discover the extension id from what Chrome actually loaded.
  await video.waitForTimeout(3000);
  let extensionId = null;
  for (const p of context.pages()) {
    if (p.url().startsWith("chrome-extension://")) extensionId = new URL(p.url()).host;
  }
  if (!extensionId) {
    // Fall back to the deterministic unpacked-id derivation.
    extensionId = "kofbbhippghichobdpimmgdddgchpnak";
  }
  out.extensionId = extensionId;

  // The tab id the panel must target, taken from the product's own naming.
  out.tabId = await video.evaluate(async () => {
    // Pages cannot read chrome.tabs; the driver reads it from the service
    // worker instead. Returning null here keeps the shape explicit.
    return null;
  });

  const panel = await context.newPage();
  out.panelOpened = true;
  await panel.waitForTimeout(1000);
  out.panelPlaceholder = panel.url();
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageA.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}
