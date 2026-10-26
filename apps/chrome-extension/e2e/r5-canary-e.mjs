/**
 * R5 canary — stage E.
 *
 * Recovers the side-panel target: navigate it back to sidepanel.html, then ask
 * the extension itself (with a user gesture) to open the REAL side panel for
 * the browser window, and report the resulting targets.
 *
 * No capture is started here.
 */
import { RawCdp } from "./lib/rawCdp.mjs";
import { writeFile, mkdir } from "node:fs/promises";

const CDP = "http://127.0.0.1:9222";
const EXT_ID = "kofbbhippghichobdpimmgdddgchpnak";
const VIDEO_PREFIX = "https://www.bilibili.com/video/BV1pohR6rEEh";
const OUT = "/mnt/c/workSpace/.r5-canary";

const client = await RawCdp.connect(CDP);
const out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  // 1. Find any extension page target (possibly sitting on an error page).
  const { session } = await client.attachToFirstMatching(
    (i) => i.type === "page" && i.url.includes(EXT_ID)
  );
  await session.send("Runtime.enable", {});
  await session.send("Page.enable", {});

  // 2. Put it back on the real side panel document.
  await session.send("Page.navigate", { url: `chrome-extension://${EXT_ID}/sidepanel.html` });
  await wait(5000);
  out.afterNavigate = await session.evaluate("location.href");
  out.bodyAfterNavigate = (await session.evaluate("document.body.innerText"))?.slice(0, 300);

  // 3. From this genuine extension page, open the REAL side panel with a gesture.
  out.openResult = await session.evaluate(`(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabs = await chrome.tabs.query({});
      const video = tabs.find(t => (t.url||'').startsWith(${JSON.stringify(VIDEO_PREFIX)}));
      await chrome.sidePanel.open({ tabId: video?.id });
      return { ok: true, videoTabId: video?.id ?? null, activeTabId: tab?.id ?? null };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  })()`);
  await wait(5000);

  const infos = await client.targets();
  out.targets = infos.map((i) => `${i.type}:${i.url}`.slice(0, 110));
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageE.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 3500));
  client.socket.close();
}
