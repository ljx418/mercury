/**
 * R5 canary — stage B (take 2).
 *
 * An extension page has full chrome.* API access even when opened as an
 * ordinary tab, so the video tab id is read from inside the panel page itself
 * rather than from the MV3 service worker (which CDP does not expose until it
 * wakes). The panel is then reloaded targeting exactly that tab.
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
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${EXT_ID}/sidepanel.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await panel.waitForTimeout(3000);

  out.videoTabId = await panel.evaluate(async (prefix) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => (t.url || "").startsWith(prefix));
    return tab?.id ?? null;
  }, VIDEO_PREFIX);
  if (!out.videoTabId) throw new Error("video tab id not found from the extension page");

  await panel.goto(`chrome-extension://${EXT_ID}/sidepanel.html?naviaE2ETabId=${out.videoTabId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await panel.waitForTimeout(8000);
  out.panelUrl = panel.url();

  out.panelText = (await panel.evaluate(() => document.body.innerText)).slice(0, 3000);
  out.testids = await panel.evaluate(() =>
    Array.from(document.querySelectorAll("[data-testid]")).map((e) => e.getAttribute("data-testid"))
  );
  out.buttons = await panel.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .map((b) => ({ t: (b.textContent || "").trim().slice(0, 30), d: b.disabled }))
      .filter((b) => b.t.length > 0)
  );
  out.mediaButtons = out.buttons.filter((b) => /媒体|视频|分析|转写|捕获|授权|登录|开始|B站|站点/.test(b.t));
  out.mediaTestIds = out.testids.filter((t) => /media|capture|transcript|acquisition|companion|portal|credential/i.test(t || ""));
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageB.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 4500));
}
