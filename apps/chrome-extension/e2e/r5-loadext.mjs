import { RawCdp } from "./lib/rawCdp.mjs";
import { writeFile, mkdir } from "node:fs/promises";
const CDP = "http://127.0.0.1:9222";
const EXT = "C:\\workSpace\\navia\\apps\\chrome-extension\\chrome-mv3-unpacked";
const OUT = "/mnt/c/workSpace/.r5-canary";
const client = await RawCdp.connect(CDP);
const out = {};
try {
  out.loadUnpacked = await client.send("Extensions.loadUnpacked", { path: EXT });
} catch (e) {
  out.error = e instanceof Error ? e.message : String(e);
}
await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/loadext.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
client.socket.close();
