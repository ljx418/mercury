/**
 * R5 canary — stage H.
 *
 * The PRODUCTION build ignores ?naviaE2ETabId (it is gated behind the e2e
 * bridge), so the panel must be the browser's REAL side panel for the video
 * tab. We ask the extension to open it with a user gesture, then attach to
 * that WebContents over raw CDP.
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
try {
  const before = await client.targets();
  out.beforePanelTargets = before.filter((i) => i.url.includes(EXT_ID)).map((i) => `${i.type}:${i.url.slice(0, 90)}`);

  // A helper extension page we can evaluate chrome.* in.
  const { targetId: helperId } = await client.send("Target.createTarget", { url: "chrome-extension://about:blank" });
  const { sessionId: helperSid } = await client.send("Target.attachToTarget", { targetId: helperId, flatten: true });
  const helperEval = async (expression) => {
    const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }, helperSid);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
  };
  await client.send("Runtime.enable", {}, helperSid);
  await client.send("Page.enable", {}, helperSid);
  await client.send("Page.navigate", { url: `chrome-extension://${EXT_ID}/sidepanel.html` }, helperSid);
  await wait(4000);

  out.open = await helperEval(`(async () => {
    try {
      const tabs = await chrome.tabs.query({});
      const v = tabs.find(t => (t.url||'').startsWith(${JSON.stringify(VIDEO_PREFIX)}));
      if (!v) return { ok:false, error:'video tab not found' };
      await chrome.sidePanel.open({ tabId: v.id });
      return { ok:true, videoTabId: v.id };
    } catch (e) { return { ok:false, error: e instanceof Error ? e.message : String(e) }; }
  })()`);
  await wait(6000);

  // The real side panel is its own WebContents; find the one that is not our helper tab.
  const after = await client.targets();
  out.afterPanelTargets = after.filter((i) => i.url.includes("sidepanel.html")).map((i) => `${i.type}:${i.url.slice(0, 90)}`);

  const realPanel = after.find((i) => i.url.includes("sidepanel.html") && i.targetId !== helperId);
  if (!realPanel) throw new Error(`real side panel target not found; after=${JSON.stringify(out.afterPanelTargets)}`);

  const { sessionId: panelSid } = await client.send("Target.attachToTarget", { targetId: realPanel.targetId, flatten: true });
  const panelEval = async (expression) => {
    const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }, panelSid);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
  };
  await client.send("Runtime.enable", {}, panelSid);
  await wait(9000);

  out.realPanelTargetId = realPanel.targetId;
  out.panelUrl = await panelEval("location.href");
  out.status = await panelEval("(document.querySelector('[data-testid=\\'runtime-status\\']')||{}).textContent");
  out.bodyText = (await panelEval("document.body.innerText"))?.slice(0, 3000);
  out.testids = await panelEval("Array.from(document.querySelectorAll('[data-testid]')).map(e=>e.getAttribute('data-testid'))");
  out.buttons = await panelEval(`Array.from(document.querySelectorAll('button')).map(b=>({t:(b.textContent||'').trim().slice(0,30),d:b.disabled,tid:b.getAttribute('data-testid')||''})).filter(b=>b.t.length>0)`);
  out.mediaTestIds = (out.testids || []).filter((t) => /media|capture|transcript|acquisition|companion|portal|credential|consent/i.test(t || ""));
  out.helperId = helperId;
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageH.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 5000));
  client.socket.close();
}
