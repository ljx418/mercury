/**
 * R5 canary — stage D.
 *
 * Attaches to the REAL Side Panel over raw CDP and reports the media surface
 * it exposes. No capture is started here.
 */
import { RawCdp } from "./lib/rawCdp.mjs";
import { writeFile, mkdir } from "node:fs/promises";

const CDP = "http://127.0.0.1:9222";
const EXT_ID = "kofbbhippghichobdpimmgdddgchpnak";
const OUT = "/mnt/c/workSpace/.r5-canary";

const client = await RawCdp.connect(CDP);
const out = {};
try {
  const infos = await client.targets();
  out.targets = infos.map((i) => `${i.type}:${i.url}`.slice(0, 110));
  const { session, info } = await client.attachToFirstMatching(
    (i) => i.type === "page" && i.url.startsWith(`chrome-extension://${EXT_ID}/sidepanel.html`)
  );
  out.attachedTo = info.url;
  await session.send("Runtime.enable", {});
  await new Promise((r) => setTimeout(r, 4000));

  out.bodyText = (await session.evaluate("document.body.innerText"))?.slice(0, 2500);
  out.testids = await session.evaluate(
    "Array.from(document.querySelectorAll('[data-testid]')).map(e=>e.getAttribute('data-testid'))"
  );
  out.buttons = await session.evaluate(`Array.from(document.querySelectorAll('button'))
      .map(b=>({t:(b.textContent||'').trim().slice(0,28), d:b.disabled, tid:b.getAttribute('data-testid')||''}))
      .filter(b=>b.t.length>0)`);
  out.mediaTestIds = (out.testids || []).filter((t) => /media|capture|transcript|acquisition|companion|portal|credential|asr|video/i.test(t || ""));
  out.url = await session.evaluate("location.href");
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/stageD.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 5000));
  client.socket.close();
}
