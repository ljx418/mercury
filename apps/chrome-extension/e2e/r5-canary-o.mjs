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
  await s.send("Emulation.setFocusEmulationEnabled",{enabled:true});
  out.clickedAt = new Date().toISOString();
  await s.trustedClick("[data-testid='media-companion-enable']");
  out.clickDispatched = true;
  for (let i=0;i<10;i++){
    await wait(5000);
    const body=(await s.evaluate("document.body.innerText"))||"";
    out[`poll${i}`]=body.slice(0,260);
    if(/已连接|已授权|站点|Cookie|凭据|分析中|任务/.test(body) && !/启用并分析当前视频/.test(body.slice(0,400))) break;
  }
}catch(e){out.error=e.message;}finally{
  await writeFile("/mnt/c/workSpace/.r5-canary/stageO.json",JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2).slice(0,2600));
  client.socket.close();}
