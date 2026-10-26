/**
 * R5 canary — stage B.
 *
 * Reads the real video tab id from the extension's own service worker, then
 * opens the Side Panel as an automatable extension page targeting exactly that
 * tab (`?naviaE2ETabId=`), which is the entry point the product's own e2e
 * harness uses so the panel resolves the right active tab.
 *
 * Still NO capture: this stage reports what the user-reachable surface offers.
 */

import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";

const CDP = "http://127.0.0.1:9222";
const VIDEO_PREFIX = "https://www.bilibili.com/video/BV1pohR6rEEh";
const EXT_ID = "kofbbhippghichobdpimmgdddgchpnak";
const OUT = "/mnt/c/workSpace/.r5-canary";

const browser = await chromium.connectOverCDP(CDP);
const out = {};

try {
  const context = browser.contexts()[0];

  // The MV3 service worker may need waking; the extension page below will do it.
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker", { timeout: 20000 }));
  out.serviceWorkerUrl = worker.url();

  const tabId = await worker.evaluate(async (prefix) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => (t.url || "").startsWith(prefix));
    return tab?.id ?? null;
  }, VIDEO_PREFIX);
  out.videoTabId = tabId;
  if (!tabId) throw new Error("video tab id not found");

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${EXT_ID}/sidepanel.html?naviaE2ETabId=${tabId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await panel.waitForTimeout(6000);
  out.panelUrl = panel.url();

  out.panelText = (await panel.evaluate(() => document.body.innerText)).slice(0, 2500);
  out.testids = await panel.evaluate(() =>
    Array.from(document.querySelectorAll("[data-testid]")).map((e) => e.getAttribute("data-testid"))
  );
  out.buttons = await panel.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .map((b) => ({ t: (b.textContent || "").trim().slice(0, 30), d: b.disabled }))
      .filter((b) => b.t.length > 0)
  );

  // Which media surface is reachable from here?
  out.mediaButtons = out.buttons.filter((b) => /媒体|视频|分析|转写|捕获|B站|授权|登录|开始/.test(b.t));
  out.mediaTestIds = out.testids.filter((t) => /media|capture|transcript|acquisition|companion|portal/i.test(t || ""));
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageB.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 4000));
}
