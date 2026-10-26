import { RawCdp } from "./lib/rawCdp.mjs";
import { writeFile } from "node:fs/promises";
const CDP="http://127.0.0.1:9222"; const T=process.env.R5_PANEL_TARGET;
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const client=await RawCdp.connect(CDP); const out={};
try{
  const s=await client.attach(T);
  await s.send("Runtime.enable",{}); await s.send("Emulation.setFocusEmulationEnabled",{enabled:true});
  await s.trustedClick("[data-testid='nav-chat-tab']"); await wait(2500);
  out.beforeText=(await s.evaluate("document.body.innerText"))?.slice(0,700);
  await s.trustedClick("[data-testid='media-companion-enable']");
  out.clicked=true;
  for(let i=0;i<6;i++){
    await wait(5000);
    const txt=(await s.evaluate("document.body.innerText"))||"";
    out[`p${i}`]=txt.slice(0,700);
    if(txt!==out.beforeText) { out.changedAt=i; }
  }
  out.mediaTestIds=await s.evaluate(`Array.from(document.querySelectorAll('[data-testid]')).map(e=>e.getAttribute('data-testid')).filter(t=>t&&/media|capture|consent|portal|credential|acquisition|permission/.test(t))`);
  out.dialogs=await s.evaluate(`Array.from(document.querySelectorAll('[role=dialog]')).map(d=>(d.textContent||'').slice(0,300))`);
}catch(e){out.error=e.message;}finally{
  await writeFile("/mnt/c/workSpace/.r5-canary/stageQ.json",JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2).slice(0,4000)); client.socket.close();}
