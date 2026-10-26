/**
 * R5 canary — stage I.
 *
 * Close leftover extension tabs so the VIDEO tab is the active one, ask the
 * extension to open its REAL side panel for that tab, then locate that panel
 * by targetId diff (it is a browser WebContents Playwright never sees).
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
  const t0 = await client.targets();
  const leftovers = t0.filter((i) => i.type === "page" && i.url.includes(EXT_ID)).map((i) => i.targetId);
  for (const id of leftovers) await client.send("Target.closeTarget", { targetId: id }).catch(() => undefined);
  await wait(2500);
  out.closedLeftovers = leftovers.length;

  // Make the video tab active in its window.
  const { targetId: videoId } = { targetId: (await client.targets()).find((i) => i.url.startsWith(VIDEO_PREFIX)).targetId };
  const { sessionId: videoSid } = await client.send("Target.attachToTarget", { targetId: videoId, flatten: true });
  await client.send("Runtime.enable", {}, videoSid);
  await client.send("Page.enable", {}, videoSid);
  await client.send("Page.bringToFront", {}, videoSid);
  await wait(1500);

  const beforeIds = new Set((await client.targets()).map((i) => i.targetId));

  // Open the real side panel for the video tab.
  const { targetId: helperId } = await client.send("Target.createTarget", { url: "chrome-extension://about:blank" });
  const { sessionId: helperSid } = await client.send("Target.attachToTarget", { targetId: helperId, flatten: true });
  await client.send("Runtime.enable", {}, helperSid);
  await client.send("Page.enable", {}, helperSid);
  await client.send("Page.navigate", { url: `chrome-extension://${EXT_ID}/sidepanel.html` }, helperSid);
  await wait(4000);
  out.openResult = await evalIn(helperSid, `(async () => {
    try {
      const tabs = await chrome.tabs.query({});
      const v = tabs.find(t => (t.url||'').startsWith(${JSON.stringify(VIDEO_PREFIX)}));
      await chrome.sidePanel.open({ tabId: v.id });
      return { ok: true, videoTabId: v.id, activeTabUrl: (await chrome.tabs.query({active:true,currentWindow:true}))[0]?.url };
    } catch (e) { return { ok:false, error: e instanceof Error ? e.message : String(e) }; }
  })()`);
  await wait(7000);

  const after = await client.targets();
  const fresh = after.filter((i) => !beforeIds.has(i.targetId) && i.url.includes("sidepanel.html"));
  out.freshPanelTargets = fresh.map((i) => `${i.targetId}:${i.url.slice(0, 70)}`);
  if (!fresh.length) throw new Error(`no fresh side panel target; all=${JSON.stringify(after.map(i=>i.targetId+':'+i.url.slice(0,60)))}`);

  const panelTarget = fresh[0];
  const { sessionId: panelSid } = await client.send("Target.attachToTarget", { targetId: panelTarget.targetId, flatten: true });
  await client.send("Runtime.enable", {}, panelSid);
  await wait(9000);

  out.realPanelTargetId = panelTarget.targetId;
  out.status = await evalIn(panelSid, "(document.querySelector('[data-testid=\\'runtime-status\\']')||{}).textContent");
  out.bodyText = (await evalIn(panelSid, "document.body.innerText"))?.slice(0, 3000);
  out.testids = await evalIn(panelSid, "Array.from(document.querySelectorAll('[data-testid]')).map(e=>e.getAttribute('data-testid'))");
  out.buttons = await evalIn(panelSid, `Array.from(document.querySelectorAll('button')).map(b=>({t:(b.textContent||'').trim().slice(0,30),d:b.disabled,tid:b.getAttribute('data-testid')||''})).filter(b=>b.t.length>0)`);
  out.mediaTestIds = (out.testids || []).filter((t) => /media|capture|transcript|acquisition|companion|portal|credential|consent/i.test(t || ""));
  out.helperId = helperId;
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageI.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 4500));
  client.socket.close();
}
