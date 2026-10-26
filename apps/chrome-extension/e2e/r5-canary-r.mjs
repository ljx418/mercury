import { RawCdp } from "./lib/rawCdp.mjs";
const CDP="http://127.0.0.1:9222"; const T=process.env.R5_PANEL_TARGET;
const client=await RawCdp.connect(CDP); const out={};
try{
  const s=await client.attach(T);
  await s.send("Runtime.enable",{});
  out.card=await s.evaluate(`(()=>{const c=document.querySelector("[data-testid='media-companion-launch']");return c?(c.innerText||'').slice(0,600):null;})()`);
  out.enableBtn=await s.evaluate(`(()=>{const b=document.querySelector("[data-testid='media-companion-enable']");return b?{disabled:b.disabled,text:(b.textContent||'').trim(),cls:b.className}:null;})()`);
  out.settingsCard=await s.evaluate(`(()=>{const c=document.querySelector("[data-testid='media-connection-settings']");return c?(c.innerText||'').slice(0,400):null;})()`);
  // Is the panel even able to see the portal adapter?
  out.adapterProbe=await s.evaluate(`(async()=>{try{const r=await chrome.runtime.sendMessage({type:'navia.mediaCompanion'});return typeof r;}catch(e){return 'sendMessage-error: '+(e.message||'').slice(0,80);}})()`);
}catch(e){out.error=e.message;}finally{console.log(JSON.stringify(out,null,2).slice(0,2500));client.socket.close();}
