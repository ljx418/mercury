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
  out.viewport=await s.evaluate("({w:window.innerWidth,h:window.innerHeight,scrollY:window.scrollY,docH:document.body.scrollHeight})");
  out.btn=await s.evaluate(`(()=>{const el=document.querySelector("[data-testid='media-companion-enable']");if(!el)return null;const r=el.getBoundingClientRect();return {t:(el.textContent||'').trim(),l:r.left,tp:r.top,w:r.width,h:r.height};})()`);
  try { await s.trustedClick("[data-testid='media-companion-enable']"); out.click="ok"; }
  catch(e){ out.click="failed: "+e.message; }
  await wait(6000);
  out.body=(await s.evaluate("document.body.innerText"))?.slice(0,900);
  out.buttons=await s.evaluate(`Array.from(document.querySelectorAll('button')).map(b=>({t:(b.textContent||'').trim().slice(0,26),tid:b.getAttribute('data-testid')||'',d:b.disabled})).filter(b=>b.t.length>0)`);
}catch(e){out.error=e.message;}finally{
  await writeFile("/mnt/c/workSpace/.r5-canary/stageM.json",JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2).slice(0,3500));
  client.socket.close();}
