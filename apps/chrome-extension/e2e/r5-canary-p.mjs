import { RawCdp } from "./lib/rawCdp.mjs";
const CDP="http://127.0.0.1:9222"; const T=process.env.R5_PANEL_TARGET;
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const client=await RawCdp.connect(CDP); const out={};
try{
  const s=await client.attach(T);
  await s.send("Runtime.enable",{}); await s.send("Emulation.setFocusEmulationEnabled",{enabled:true});
  out.before = await s.evaluate(`Array.from(document.querySelectorAll('[data-testid^=nav-]')).map(e=>e.getAttribute('data-testid')+':'+(e.getAttribute('aria-selected')||e.className))`);
  out.knowBodyBefore = (await s.evaluate("document.body.innerText"))?.slice(0,120);
  await s.trustedClick("[data-testid='nav-knowledge-tab']");
  await wait(3000);
  out.after = await s.evaluate(`Array.from(document.querySelectorAll('[data-testid^=nav-]')).map(e=>e.getAttribute('data-testid')+':'+(e.getAttribute('aria-selected')||e.className))`);
  out.knowBodyAfter = (await s.evaluate("document.body.innerText"))?.slice(0,160);
  // Also try dispatching a DOM click to see whether React responds at all
  out.reactRespondsToDomClick = await s.evaluate(`(()=>{const b=document.querySelector("[data-testid='nav-knowledge-tab']");if(!b)return null;const before=document.body.innerText.slice(0,80);b.click();return {changed: document.body.innerText.slice(0,80)!==before};})()`);
  await wait(2000);
  out.finalBody=(await s.evaluate("document.body.innerText"))?.slice(0,200);
}catch(e){out.error=e.message;}finally{console.log(JSON.stringify(out,null,2).slice(0,2200));client.socket.close();}
