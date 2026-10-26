/**
 * R5 canary — stage J.
 *
 * Open the REAL side panel the way a user does: with the video tab active,
 * fire the extension action via the repo's owned-PID native shortcut. Nothing
 * is armed, so `startArmed()` cannot run — this only opens the panel and
 * makes the video the panel's active tab.
 *
 * No capture is started here.
 */
import { RawCdp } from "./lib/rawCdp.mjs";
import { invokeOwnedPidExtensionShortcut, inspectOwnedWindowsChromeProfile } from "./lib/windowsExtensionInvocation.mjs";
import { writeFile, mkdir } from "node:fs/promises";

const CDP = "http://127.0.0.1:9222";
const EXT_ID = "gcifeacdafknfikkfccniigjdcofpcha";
const VIDEO_PREFIX = "https://www.bilibili.com/video/BV1pohR6rEEh";
const PROFILE = "/mnt/c/workspace/navia/.navia/navia-b5-3-profile-r5canary";
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
  // Close every helper tab so the video tab is active.
  for (const t of (await client.targets()).filter((i) => i.type === "page" && i.url.includes(EXT_ID))) {
    await client.send("Target.closeTarget", { targetId: t.targetId }).catch(() => undefined);
  }
  await wait(2000);

  const videoInfo = (await client.targets()).find((i) => i.url.startsWith(VIDEO_PREFIX));
  const { sessionId: videoSid } = await client.send("Target.attachToTarget", { targetId: videoInfo.targetId, flatten: true });
  await client.send("Runtime.enable", {}, videoSid);
  await client.send("Page.enable", {}, videoSid);
  await client.send("Page.bringToFront", {}, videoSid);
  await wait(2000);

  const beforeIds = new Set((await client.targets()).map((i) => i.targetId));
  const owned = inspectOwnedWindowsChromeProfile(PROFILE);
  out.ownedBrowser = owned.map((o) => o.processId);
  const browserPid = owned[0]?.processId;
  if (!browserPid) throw new Error("owned Chrome browser PID not found");

  out.shortcut = invokeOwnedPidExtensionShortcut(PROFILE, browserPid, "execute-action");
  await wait(8000);

  const after = await client.targets();
  const fresh = after.filter((i) => !beforeIds.has(i.targetId));
  out.freshTargets = fresh.map((i) => `${i.type}:${i.url.slice(0, 80)}`);
  const panel = fresh.find((i) => i.url.includes("sidepanel.html"));
  if (!panel) throw new Error(`no fresh side panel; fresh=${JSON.stringify(out.freshTargets)}`);

  const { sessionId: panelSid } = await client.send("Target.attachToTarget", { targetId: panel.targetId, flatten: true });
  await client.send("Runtime.enable", {}, panelSid);
  await wait(9000);

  out.panelTargetId = panel.targetId;
  out.panelActiveTabUrl = await evalIn(panelSid, "(async()=>{const [t]=await chrome.tabs.query({active:true,currentWindow:true});return t?.url;})()");
  out.status = await evalIn(panelSid, "(document.querySelector('[data-testid=\\'runtime-status\\']')||{}).textContent");
  out.bodyText = (await evalIn(panelSid, "document.body.innerText"))?.slice(0, 3000);
  out.testids = await evalIn(panelSid, "Array.from(document.querySelectorAll('[data-testid]')).map(e=>e.getAttribute('data-testid'))");
  out.mediaTestIds = (out.testids || []).filter((t) => /media|capture|transcript|acquisition|companion|portal|credential|consent/i.test(t || ""));
  out.buttons = await evalIn(panelSid, `Array.from(document.querySelectorAll('button')).map(b=>({t:(b.textContent||'').trim().slice(0,30),tid:b.getAttribute('data-testid')||''})).filter(b=>b.t.length>0)`);
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageJ.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 4500));
  client.socket.close();
}
