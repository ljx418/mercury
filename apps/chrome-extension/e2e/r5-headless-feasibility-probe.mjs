/**
 * R5 feasibility probe — NOT the canary.
 *
 * It touches no bilibili page, starts no capture, and makes no product call.
 * Its only question is whether the R5-2 user entry point is reachable in a
 * headless browser at all:
 *
 *   1. does the unpacked extension load in headless?
 *   2. is the Side Panel surface renderable as a normal page?
 *   3. can the capture start be triggered without a toolbar click?
 *
 * Answer 3 decides whether the one-shot canary can run headless at all.
 */

import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const EXTENSION = resolve("chrome-mv3-unpacked");

// Chromium derives an unpacked extension's ID from the SHA-256 of its absolute
// path: the first 128 bits, each nibble mapped onto 'a'..'p'.
const DERIVED_ID = (() => {
  const { createHash } = require("node:crypto");
  const digest = createHash("sha256").update(EXTENSION).digest("hex").slice(0, 32);
  return [...digest].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
})();

const profile = await mkdtemp(join(tmpdir(), "r5-probe-profile-"));
const result = { profile, extensionLoaded: false, extensionId: null, panelRendered: false, notes: [] };

const context = await chromium.launchPersistentContext(profile, {
  // Playwright's `headless: true` uses Chrome's OLD headless, which cannot load
  // extensions at all. Chrome's NEW headless supports them, so the browser is
  // launched "headed" with `--headless=new` passed through: it still renders no
  // window, takes no focus and plays no audio.
  headless: false,
  args: [
    "--headless=new",
    // Silent by construction: headless has no audio device, and --mute-audio
    // guarantees nothing is ever unmuted even if a device appears.
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=Translate,MediaRouter",
    `--disable-extensions-except=${EXTENSION}`,
    `--load-extension=${EXTENSION}`
  ]
});

try {
  // An MV3 service worker is lazy: nothing may start it in a blank headless
  // session. Reach the extension through its page surface instead, using the
  // unpacked ID that Chromium derives deterministically from the path.
  const page = await context.newPage();
  await page.goto(`chrome-extension://${DERIVED_ID}/sidepanel.html`, { waitUntil: "domcontentloaded" });
  result.extensionId = DERIVED_ID;
  result.extensionLoaded = true;
  await page.waitForTimeout(3000);
  result.panelRendered = await page.evaluate(() => Boolean(document.querySelector("[data-testid='asr-settings-panel']")));
  result.notes.push(`sidepanel title: ${await page.title()}`);

  // Does the capture entry exist in the panel DOM at all?
  result.notes.push(`capture card present: ${await page.evaluate(() => Boolean(document.querySelector("[data-testid='media-capture-card']")))}`);

  // Can a browser-level accelerator reach the extension at all in headless?
  let commandFired = false;
  await context.exposeFunction("__r5ReportCommand", () => { commandFired = true; });
  await page.evaluate(() => {
    globalThis.addEventListener?.("__r5", () => undefined);
    window.__r5CommandSeen = false;
    chrome?.commands?.onCommand?.addListener?.(() => { window.__r5CommandSeen = true; });
  });
  await page.bringToFront();
  await page.keyboard.press("Control+Shift+Y");
  await page.waitForTimeout(1500);
  result.notes.push(`keyboard accelerator delivered (page-level): ${!commandFired ? "no browser-level dispatch observed" : "yes"}`);
  result.commandReachable = commandFired;
} catch (error) {
  result.notes.push(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await context.close().catch(() => undefined);
  await rm(profile, { recursive: true, force: true });
  console.log(JSON.stringify(result, null, 2));
}
