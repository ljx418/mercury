/**
 * R5 canary — stage G.
 *
 * Reopens the Side Panel document targeting the real video tab via
 * `?naviaE2ETabId=` so the panel resolves the B站 portal and the media flow
 * becomes reachable. Still NO capture.
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
  const { targetId } = await client.send("Target.createTarget", { url: "chrome-extension://about:blank" });
  const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (m, p) => client.send(m, p, sessionId);
  const evaluate = async (expression) => {
    const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
  };
  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Page.enable", {}, sessionId);

  // Discover the video tab id from this extension page.
  await send("Page.navigate", { url: `chrome-extension://${EXT_ID}/sidepanel.html` });
  await wait(4000);
  const videoTabId = await evaluate(`(async () => {
    const tabs = await chrome.tabs.query({});
    const t = tabs.find(x => (x.url||'').startsWith(${JSON.stringify(VIDEO_PREFIX)}));
    return t?.id ?? null;
  })()`);
  out.videoTabId = videoTabId;

  await send("Page.navigate", { url: `chrome-extension://${EXT_ID}/sidepanel.html?naviaE2ETabId=${videoTabId}` });
  await wait(10000);

  out.url = await evaluate("location.href");
  out.status = await evaluate("(document.querySelector('[data-testid=\\'runtime-status\\']')||{}).textContent");
  out.bodyText = (await evaluate("document.body.innerText"))?.slice(0, 3000);
  out.testids = await evaluate("Array.from(document.querySelectorAll('[data-testid]')).map(e=>e.getAttribute('data-testid'))");
  out.buttons = await evaluate(`Array.from(document.querySelectorAll('button')).map(b=>({t:(b.textContent||'').trim().slice(0,30),d:b.disabled,tid:b.getAttribute('data-testid')||''})).filter(b=>b.t.length>0)`);
  out.mediaTestIds = (out.testids || []).filter((t) => /media|capture|transcript|acquisition|companion|portal|credential|consent/i.test(t || ""));
  out.targetId = targetId;
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageG.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 5000));
  client.socket.close();
}
