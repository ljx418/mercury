import { RawCdp } from "./lib/rawCdp.mjs";
import { writeFile } from "node:fs/promises";
const CDP="http://127.0.0.1:9222";
const PANEL_TARGET=process.env.R5_PANEL_TARGET;
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const client=await RawCdp.connect(CDP);
const out={};
try{
  const s=await client.attach(PANEL_TARGET);
  await s.send("Runtime.enable",{});
  await s.send("Page.enable",{});
  out.emulation = await s.send("Emulation.setFocusEmulationEnabled",{enabled:true}).then(()=>"ok").catch(e=>"failed: "+e.message);
  out.pageState = await s.send("Page.getLayoutMetrics").then(m=>({vis:m.cssLayoutViewport?.pageVisibility||m.visualViewport?.visibility||"?"})).catch(e=>"n/a");
  out.hasFocusBefore = await s.evaluate("document.hasFocus()");
  await wait(1500);
  out.hasFocusAfter = await s.evaluate("document.hasFocus()");
  out.activeTabUrl = await s.evaluate("(async()=>{const [t]=await chrome.tabs.query({active:true,currentWindow:true});return t?.url;})()");
  try{ await s.trustedClick("[data-testid='media-companion-enable']"); out.click="ok"; }
  catch(e){ out.click="failed: "+e.message; }
  await wait(7000);
  out.body=(await s.evaluate("document.body.innerText"))?.slice(0,900);
  out.media=await s.evaluate(`Array.from(document.querySelectorAll('[data-testid]')).map(e=>e.getAttribute('data-testid')).filter(t=>t&&/media|capture|consent|portal|credential|acquisition/.test(t))`);
  out.buttons=await s.evaluate(`Array.from(document.querySelectorAll('button')).map(b=>({t:(b.textContent||'').trim().slice(0,26),tid:b.getAttribute('data-testid')||'',d:b.disabled})).filter(b=>b.t.length>0).slice(0,14)`);
}catch(e){out.error=e.message;}finally{
  await writeFile("/mnt/c/workSpace/.r5-canary/stageN.json",JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2).slice(0,3000));
  client.socket.close();}
