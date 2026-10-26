/**
 * R5 canary — stage C.
 *
 * The real Side Panel is already open as its own WebContents and is exposed
 * over CDP as an automatable page (this is exactly what the product's own
 * `waitForSidePanelPage` relies on). We attach to that page instead of opening
 * a second tab, so the panel keeps its real browser-side context and its
 * `active tab` resolves to the video.
 *
 * Still NO capture: this stage only reports what the surface offers.
 */

import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";

const CDP = "http://127.0.0.1:9222";
const EXT_ID = "kofbbhippghichobdpimmgdddgchpnak";
const VIDEO_PREFIX = "https://www.bilibili.com/video/BV1pohR6rEEh";
const OUT = "/mnt/c/workSpace/.r5-canary";

const browser = await chromium.connectOverCDP(CDP);
const out = {};

try {
  const context = browser.contexts()[0];
  out.pages = context.pages().map((p) => p.url());

  const panel = context.pages().find((p) => p.url().startsWith(`chrome-extension://${EXT_ID}/sidepanel.html`));
  if (!panel) throw new Error(`side panel page not exposed; pages=${JSON.stringify(out.pages)}`);
  out.attachedToSidePanel = true;
  await panel.waitForTimeout(4000);

  // What tab does the panel consider current?
  out.activeTab = await panel.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ? { id: tab.id, url: tab.url, title: tab.title } : null;
  });
  out.videoTab = await panel.evaluate(async (prefix) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => (t.url || "").startsWith(prefix));
    return tab ? { id: tab.id, url: tab.url } : null;
  }, VIDEO_PREFIX);

  out.panelText = (await panel.evaluate(() => document.body.innerText)).slice(0, 3000);
  out.testids = await panel.evaluate(() =>
    Array.from(document.querySelectorAll("[data-testid]")).map((e) => e.getAttribute("data-testid"))
  );
  out.buttons = await panel.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .map((b) => ({ t: (b.textContent || "").trim().slice(0, 30), d: b.disabled }))
      .filter((b) => b.t.length > 0)
  );
  out.mediaButtons = out.buttons.filter((b) => /媒体|视频|分析|转写|捕获|授权|登录|开始|站点|安装/.test(b.t));
  out.mediaTestIds = out.testids.filter((t) => /media|capture|transcript|acquisition|companion|portal|credential|asr/i.test(t || ""));
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageC.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 5000));
}
