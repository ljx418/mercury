import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = fs.realpathSync(path.resolve(here, "../chrome-mv3-unpacked"));
const profileRoot = path.resolve(here, "../../../.tmp");
fs.mkdirSync(profileRoot, { recursive: true });
const profile = fs.mkdtempSync(path.join(profileRoot, "navia-scroll-e2e-"));
const viewport = {
  width: Number.parseInt(process.env.NAVIA_SCROLL_VIEWPORT_WIDTH || "420", 10),
  height: Number.parseInt(process.env.NAVIA_SCROLL_VIEWPORT_HEIGHT || "500", 10)
};
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport,
  ignoreDefaultArgs: ["--disable-extensions"],
  args: [
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    "--enable-unsafe-extension-debugging",
    `--disable-extensions-except=${extensionRoot}`,
    `--load-extension=${extensionRoot}`,
  ],
});

async function scrollByWheel(page, selector, hoverSelector) {
  const panel = page.locator(selector);
  await panel.waitFor();
  const before = await panel.evaluate((element) => ({ top: element.scrollTop, height: element.clientHeight, scrollHeight: element.scrollHeight }));
  if (before.scrollHeight <= before.height) throw new Error(`${selector} does not have overflow content`);
  await page.locator(hoverSelector).first().hover();
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(250);
  const afterWheel = await panel.evaluate((element) => element.scrollTop);
  if (afterWheel <= before.top) throw new Error(`${selector} did not respond to wheel`);
  await panel.evaluate((element) => { element.scrollTop = 0; });
  await panel.focus();
  await page.keyboard.press("PageDown");
  await page.waitForTimeout(250);
  const afterKeyboard = await panel.evaluate((element) => element.scrollTop);
  if (afterKeyboard <= 0) throw new Error(`${selector} did not respond to PageDown`);
  return { clientHeight: before.height, scrollHeight: before.scrollHeight, afterWheel, afterKeyboard };
}

try {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-testid='navia-sidepanel-root']").waitFor();
  const chat = await scrollByWheel(page, "[data-testid='chat-scroll-panel']", "[data-testid='current-page-context-card']");
  await page.locator("[data-testid='nav-knowledge-tab']").click();
  const knowledge = await scrollByWheel(page, "[data-testid='knowledge-view-panel']", ".local-runtime-access");
  const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  if (widths.client !== widths.scroll) throw new Error(`root horizontal overflow: ${JSON.stringify(widths)}`);
  console.log(JSON.stringify({ passed: true, extensionId, viewport: `${viewport.width}x${viewport.height}`, rootOverflow: false, chat, knowledge }, null, 2));
} finally {
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
