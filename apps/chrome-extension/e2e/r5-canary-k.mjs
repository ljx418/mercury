/**
 * R5 canary — stage K.
 *
 * The real side panel opens for a specific tab, so we open it while the video
 * tab is active, then drop the helper tab we needed for the chrome.* call and
 * re-activate the video tab so the panel resolves the B站 page.
 *
 * No capture is started here.
 */
import { RawCdp } from "./lib/rawCdp.mjs";
import { writeFile, mkdir } from "node:fs/promises";

const CDP = "http://127.0.0.1:9222";
const EXT_ID = "gcifeacdafknfikkfccniigjdcofpcha";
const VIDEO_PREFIX = "https://www.bilibili.com/video/BV1pohR6rEEh";
const OUT = "/mnt/c/workSpace/.r5-canary";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const client = await RawCdp.connect(CDP);
const out = {};
const evalIn = async (sessionId, expression) => {
  const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result?.value;
};
try {
  for (const t of (await client.targets()).filter((i) => i.type === "page" && i.url.includes(EXT_ID))) {
    await client.send("Target.closeTarget", { targetId: t.targetId }).catch(() => undefined);
  }
  await wait(1500);

  const video = (await client.targets()).find((i) => i.url.startsWith(VIDEO_PREFIX));
  const { sessionId: videoSid } = await client.send("Target.attachToTarget", { targetId: video.targetId, flatten: true });
  await client.send("Runtime.enable", {}, videoSid);
  await client.send("Page.enable", {}, videoSid);
  await client.send("Page.bringToFront", {}, videoSid);
  await wait(1500);

  const beforeIds = new Set((await client.targets()).map((i) => i.targetId));

  // Helper page -> open the real side panel for the video tab.
  const { targetId: helperId } = await client.send("Target.createTarget", { url: "chrome-extension://about:blank" });
  const { sessionId: helperSid } = await client.send("Target.attachToTarget", { targetId: helperId, flatten: true });
  await client.send("Runtime.enable", {}, helperSid);
  await client.send("Page.enable", {}, helperSid);
  await client.send("Page.navigate", { url: `chrome-extension://${EXT_ID}/sidepanel.html` }, helperSid);
  await wait(3500);
  out.open = await evalIn(helperSid, `(async () => {
    try {
      const tabs = await chrome.tabs.query({});
      const v = tabs.find(t => (t.url||'').startsWith(${JSON.stringify(VIDEO_PREFIX)}));
      await chrome.sidePanel.open({ tabId: v.id });
      return { ok: true, videoTabId: v.id };
    } catch (e) { return { ok:false, error: e instanceof Error ? e.message : String(e) }; }
  })()`);
  await wait(6000);

  const panelInfo = (await client.targets()).find((i) => !beforeIds.has(i.targetId) && i.url.includes("sidepanel.html"));
  if (!panelInfo) throw new Error("side panel target not created");
  out.panelTargetId = panelInfo.targetId;

  // Drop the helper tab, put the VIDEO tab back in front.
  await client.send("Target.closeTarget", { targetId: helperId }).catch(() => undefined);
  await client.send("Page.bringToFront", {}, videoSid);
  await wait(9000);

  const { sessionId: panelSid } = await client.send("Target.attachToTarget", { targetId: panelInfo.targetId, flatten: true });
  await client.send("Runtime.enable", {}, panelSid);
  await wait(2000);

  out.panelActiveTabUrl = await evalIn(panelSid, "(async()=>{const [t]=await chrome.tabs.query({active:true,currentWindow:true});return t?{url:t.url,id:t.id}:null;})()");
  out.status = await evalIn(panelSid, "(document.querySelector('[data-testid=\\'runtime-status\\']')||{}).textContent");
  out.bodyText = (await evalIn(panelSid, "document.body.innerText"))?.slice(0, 3500);
  out.testids = await evalIn(panelSid, "Array.from(document.querySelectorAll('[data-testid]')).map(e=>e.getAttribute('data-testid'))");
  out.mediaTestIds = (out.testids || []).filter((t) => /media|capture|transcript|acquisition|companion|portal|credential|consent/i.test(t || ""));
  out.buttons = await evalIn(panelSid, `Array.from(document.querySelectorAll('button')).map(b=>({t:(b.textContent||'').trim().slice(0,30),tid:b.getAttribute('data-testid')||''})).filter(b=>b.t.length>0)`);
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageK.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 5000));
  client.socket.close();
}
