import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import fs from 'fs';

const ROOT = '/mnt/c/workSpace/navia';
const SCREENSHOT_DIR = '/tmp/navia-review-screenshots';
const EXT_PATH = `${ROOT}/apps/chrome-extension/chrome-mv3-unpacked`;
const CHROME_BIN = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await chromium.launchPersistentContext('/tmp/navia-review-chrome-profile', {
  executablePath: CHROME_BIN,
  headless: false,
  chromiumSandbox: false,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
    `--disable-extensions-except=${EXT_PATH}`,
    `--load-extension=${EXT_PATH}`,
    '--window-size=1280,900',
    '--auto-open-devtools-for-tabs',
  ],
});

console.log('Chrome launched');
const context = browser.contexts()[0];

// Wait for extension to load
await new Promise(r => setTimeout(r, 5000));

const workers = context.serviceWorkers();
console.log(`Service workers: ${workers.length}`);
for (const w of workers) {
  console.log(`  ${w.url()}`);
}

// Get extension ID
let extId = 'unknown';
for (const w of workers) {
  const m = w.url().match(/chrome-extension:\/\/([a-z]+)/);
  if (m) { extId = m[1]; break; }
}
console.log(`Extension ID: ${extId}`);

const results = [];
const errors = [];

async function visit(name, urlPath, extraWait = 2000) {
  errors.length = 0;
  const page = await context.newPage();
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));
  try {
    const url = urlPath.startsWith('chrome-extension://') ? urlPath : `chrome-extension://${extId}/${urlPath}`;
    await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(extraWait);
    const screenshotPath = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const title = await page.title();
    results.push({ name, title, url: page.url(), errors: [...errors] });
    console.log(`  [${name}] OK → ${title}`);
  } catch (e) {
    results.push({ name, error: e.message, url: urlPath, errors: [...errors] });
    console.log(`  [${name}] FAIL: ${e.message}`);
  }
  await page.close();
  return results[results.length - 1];
}

await visit('01-sidepanel', 'sidepanel.html');
await visit('02-workspace', 'workspace.html');
await visit('03-workspace-knowledge-sources', 'workspace.html#/knowledge/sources?workspaceId=ws_default');
await visit('04-workspace-ask', 'workspace.html#/knowledge/ask?workspaceId=ws_default');
await visit('05-workspace-graph', 'workspace.html#/knowledge/graph?workspaceId=ws_default');
await visit('06-workspace-permissions', 'workspace.html#/knowledge/settings/permissions?workspaceId=ws_default');

// Runtime health
try {
  const page = await context.newPage();
  await page.goto('about:blank');
  const healthResp = await page.evaluate(async () => {
    const r = await fetch('http://127.0.0.1:17861/v1/health');
    return { status: r.status, body: await r.json() };
  });
  results.push({ name: 'runtime-health', response: healthResp });
  console.log(`  [runtime-health] OK → ${healthResp.status}`);
  await page.close();
} catch (e) {
  results.push({ name: 'runtime-health', error: e.message });
}

await browser.close();

fs.writeFileSync(`${SCREENSHOT_DIR}/_results.json`, JSON.stringify(results, null, 2));
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(results, null, 2));
