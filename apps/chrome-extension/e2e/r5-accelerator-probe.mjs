/**
 * R5 probe — does a SYNTHESISED browser accelerator fire in a headed browser?
 *
 * This is the one link that decides whether the canary can be driven at all.
 * It presses Ctrl+Shift+Y with no capture armed, so the worst case is that
 * the Side Panel opens. No capture starts and no canary quota is consumed.
 *
 * Constraints honoured: --mute-audio on every launch, window positioned
 * fully offscreen, fresh profile, closed and removed at the end.
 */

import { chromium } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const EXTENSION = resolve("chrome-mv3-unpacked");
const EXTENSION_ID = (() => {
  const digest = require("node:crypto").createHash("sha256").update(EXTENSION).digest("hex").slice(0, 32);
  return [...digest].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
})();

const profile = await mkdtemp(join(tmpdir(), "r5-accel-profile-"));
const out = { before: [], after: [], sidePanelAppeared: false, acceleratorFired: false };

const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  // The production flags the repo's own Chrome e2e harness uses. Without
  // them the extension is not automatable at all.
  ignoreDefaultArgs: ["--disable-extensions"],
  args: [
    "--mute-audio",
    "--window-position=-3200,-3200",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    "--enable-unsafe-extension-debugging",
    `--disable-extensions-except=${EXTENSION}`,
    `--load-extension=${EXTENSION}`
  ]
});

try {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("https://www.bilibili.com/video/BV1pohR6rEEh", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  out.before = context.pages().map((p) => p.url());

  await page.bringToFront();
  await page.keyboard.press("Control+Shift+Y");
  await page.waitForTimeout(4000);
  out.after = context.pages().map((p) => p.url());

  // A side panel is a separate WebContents; if the command ran, an extra
  // extension page should now exist.
  out.sidePanelAppeared = out.after.some((u) => u.startsWith(`chrome-extension://${EXTENSION_ID}/sidepanel.html`));

  // Try the action accelerator too.
  await page.keyboard.press("Alt+Shift+N");
  await page.waitForTimeout(3000);
  out.afterAction = context.pages().map((p) => p.url());

  out.acceleratorFired = out.sidePanelAppeared
    || out.afterAction.length > out.after.length
    || out.afterAction.some((u) => u.startsWith(`chrome-extension://${EXTENSION_ID}/sidepanel.html`));
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error);
} finally {
  console.log(JSON.stringify(out, null, 2));
  await context.close().catch(() => undefined);
  await rm(profile, { recursive: true, force: true });
}
