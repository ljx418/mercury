/**
 * R5 canary — stage L.
 *
 * Drive the real Side Panel with TRUSTED input events
 * (`Input.dispatchMouseEvent`, the same path DevTools uses, so the resulting
 * DOM event has isTrusted === true) and report the state after each step.
 *
 * No capture is started here.
 */
import { RawCdp } from "./lib/rawCdp.mjs";
import { writeFile, mkdir } from "node:fs/promises";

const CDP = "http://127.0.0.1:9222";
const PANEL_TARGET = process.env.R5_PANEL_TARGET;
const OUT = "/mnt/c/workSpace/.r5-canary";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const client = await RawCdp.connect(CDP);
const out = { steps: [] };
try {
  const session = await client.attach(PANEL_TARGET);
  await session.send("Runtime.enable", {});
  await session.send("Page.enable", {});

  const snapshot = async (label) => {
    const text = (await session.evaluate("document.body.innerText"))?.slice(0, 1200);
    const testids = await session.evaluate("Array.from(document.querySelectorAll('[data-testid]')).map(e=>e.getAttribute('data-testid'))");
    const buttons = await session.evaluate(`Array.from(document.querySelectorAll('button')).map(b=>({t:(b.textContent||'').trim().slice(0,26),d:b.disabled,tid:b.getAttribute('data-testid')||''})).filter(b=>b.t.length>0)`);
    out.steps.push({ label, testids, buttons, text });
    return { testids, buttons, text };
  };

  out.initial = await snapshot("before-enable");

  // Trusted click on the media authorisation entry.
  await session.trustedClick("[data-testid='media-companion-enable']");
  await wait(6000);
  out.afterEnable = await snapshot("after-enable");

  out.activeTabUrl = await session.evaluate("(async()=>{const [t]=await chrome.tabs.query({active:true,currentWindow:true});return t?.url;})()");
  out.panelTargetId = PANEL_TARGET;
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageL.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 6000));
  client.socket.close();
}
