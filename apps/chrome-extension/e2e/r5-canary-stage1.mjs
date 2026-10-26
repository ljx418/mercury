/**
 * R5 canary — stage 1: bring up the owned browser and the real page, and
 * report what the user-reachable surfaces actually offer.
 *
 * It deliberately performs NO capture step here. Its purpose is to learn
 * whether the fixed video and the Side Panel expose a real, clickable entry
 * point, before the single permitted canary is spent.
 *
 * Owned resources: a fresh profile directory and the extension build. Both are
 * recorded and torn down by the caller.
 */

import { chromium } from "playwright";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const EXTENSION = resolve("chrome-mv3-unpacked");
const EXTENSION_ID = (() => {
  const digest = require("node:crypto").createHash("sha256").update(EXTENSION).digest("hex").slice(0, 32);
  return [...digest].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
})();
const VIDEO_URL = "https://www.bilibili.com/video/BV1pohR6rEEh";
const OUT = "/mnt/c/workSpace/.r5-canary";

const profile = await mkdtemp(join(tmpdir(), "r5-canary-profile-"));
await writeFile(join(OUT, "profile.txt"), profile);

const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  args: [
    // Silent for the whole session: capture is tab audio that is never played.
    "--mute-audio",
    // Offscreen so the window is not visible on the user's desktop.
    "--window-position=-3200,-3200",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=Translate,MediaRouter",
    `--disable-extensions-except=${EXTENSION}`,
    `--load-extension=${EXTENSION}`
  ]
});

const report = { profile, extensionId: EXTENSION_ID, videoUrl: VIDEO_URL, steps: [] };
const note = (name, detail) => report.steps.push({ name, detail });

try {
  const page = context.pages()[0] ?? (await context.newPage());
  note("open-video", `navigating`);
  await page.goto(VIDEO_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);
  report.videoUrlFinal = page.url();
  report.videoTitle = await page.title();

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${EXTENSION_ID}/sidepanel.html`, { waitUntil: "domcontentloaded" });
  await panel.waitForTimeout(5000);
  report.panelUrl = panel.url();

  // What does the Side Panel actually expose to a user right now?
  report.panelProbe = await panel.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"))
      .map((b) => ({ text: (b.textContent || "").trim().slice(0, 40), disabled: b.disabled }))
      .filter((b) => b.text.length > 0);
    const links = Array.from(document.querySelectorAll("a"))
      .map((a) => ({ text: (a.textContent || "").trim().slice(0, 40), href: a.getAttribute("href") }))
      .filter((a) => a.text.length > 0);
    const testids = Array.from(document.querySelectorAll("[data-testid]")).map((e) => e.getAttribute("data-testid"));
    return { buttons: buttons.slice(0, 40), links: links.slice(0, 20), testids: testids.slice(0, 40) };
  });
  report.panelText = (await panel.evaluate(() => document.body.innerText)).slice(0, 1500);
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, "stage1.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  // Leave the browser open for the caller only if it asked to keep it; by
  // default we close so nothing is left running between stages.
  await context.close().catch(() => undefined);
  await rm(profile, { recursive: true, force: true });
}
