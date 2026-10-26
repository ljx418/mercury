/**
 * R5 canary — stage F.
 *
 * The extension is now genuinely installed (CDP Extensions.loadUnpacked), so
 * its pages load. Attach to the extension service worker, open the Side Panel
 * document, and report the media surface it exposes for the fixed video.
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
  // Open the extension page directly as its own target.
  const { targetId } = await client.send("Target.createTarget", {
    url: `chrome-extension://${EXT_ID}/sidepanel.html`
  });
  const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const ext = { send: (m, p) => client.send(m, p, sessionId), evaluate: null };
  ext.evaluate = async (expression) => {
    const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
  };
  await client.send("Runtime.enable", {}, sessionId);
  await wait(7000);

  out.extUrl = await ext.evaluate("location.href");
  out.extTitle = await ext.evaluate("document.title");
  out.hasChromeApis = await ext.evaluate("typeof chrome !== 'undefined' && typeof chrome.tabs !== 'undefined'");
  out.videoTabId = await ext.evaluate(`(async () => {
    const tabs = await chrome.tabs.query({});
    const t = tabs.find(x => (x.url||'').startsWith(${JSON.stringify(VIDEO_PREFIX)}));
    return t?.id ?? null;
  })()`);

  if (out.extUrl.startsWith("chrome-error")) {
    out.body = (await ext.evaluate("document.body.innerText"))?.slice(0, 300);
  } else {
    out.bodyText = (await ext.evaluate("document.body.innerText"))?.slice(0, 2500);
    out.testids = await ext.evaluate("Array.from(document.querySelectorAll('[data-testid]')).map(e=>e.getAttribute('data-testid'))");
    out.buttons = await ext.evaluate(`Array.from(document.querySelectorAll('button')).map(b=>({t:(b.textContent||'').trim().slice(0,26),d:b.disabled,tid:b.getAttribute('data-testid')||''})).filter(b=>b.t.length>0)`);
    out.mediaTestIds = (out.testids || []).filter((t) => /media|capture|transcript|acquisition|companion|portal|credential|asr|video/i.test(t || ""));
  }
  out.extTargetId = targetId;
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageF.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 4500));
  client.socket.close();
}
