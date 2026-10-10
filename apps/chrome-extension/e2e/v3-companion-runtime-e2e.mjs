import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const evidenceRoot = path.join(repoRoot, "docs/active/project/evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.4-manual-companion-runtime");
const runId = process.env.NAVIA_V3_COMPANION_RUN_ID || `v3-1.4-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
const runRoot = path.join(evidenceRoot, "runs", runId);
const privateRoot = path.join(runRoot, "private");
const publicRoot = path.join(runRoot, "public");
const configPath = path.join(privateRoot, "companion.json");
const profilePath = path.join(repoRoot, ".tmp", `navia-t01-profile-${crypto.createHash("sha256").update(runId).digest("hex").slice(0, 12)}`);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ensure = (value, message) => { if (!value) throw new Error(message); };

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function waitRuntime() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch("http://127.0.0.1:17861/v1/health")).ok) return; } catch {}
    await wait(100);
  }
  throw new Error("companion Runtime did not become healthy");
}

function startCompanion(extensionId, suffix) {
  const configured = spawnSync("python3", ["-m", "navia_runtime.companion", "--config", configPath, "--install-extension-id", extensionId], {
    cwd: repoRoot,
    env: { ...process.env, PYTHONPATH: "services/local-runtime" },
    encoding: "utf8"
  });
  ensure(configured.status === 0, `companion configuration failed: ${configured.stderr}`);
  const child = spawn("python3", ["-m", "navia_runtime.companion", "--config", configPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PYTHONPATH: "services/local-runtime",
      NAVIA_DB_PATH: path.join(privateRoot, `navia-${suffix}.sqlite3`),
      NAVIA_MEDIA_TASK_ROOT: path.join(privateRoot, `media-${suffix}`),
      NAVIA_MEDIA_ASR_TASK_ROOT: path.join(privateRoot, `asr-${suffix}`)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let log = "";
  child.stdout.on("data", (chunk) => { log += chunk; });
  child.stderr.on("data", (chunk) => { log += chunk; });
  const runtime = {
    child,
    flush() { fs.writeFileSync(path.join(privateRoot, `runtime-${suffix}.log`), log, { mode: 0o600 }); },
    async waitForExit() {
      if (child.exitCode === null && child.signalCode === null) {
        await Promise.race([new Promise((resolve) => child.once("exit", resolve)), wait(8_000)]);
      }
      ensure(child.exitCode !== null || child.signalCode !== null, "companion Runtime did not stop");
      this.flush();
    },
    async forceStop() {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
      await this.waitForExit();
    }
  };
  child.on("exit", () => runtime.flush());
  return runtime;
}

async function companionStatus(origin) {
  const response = await fetch("http://127.0.0.1:17861/v1/companion/status", { headers: { Origin: origin } });
  ensure(response.ok, `companion status failed: ${response.status}`);
  return (await response.json()).data;
}

async function loadedExtensionId(context) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const worker = context.serviceWorkers().find((candidate) => candidate.url().startsWith("chrome-extension://"));
    if (worker) return new URL(worker.url()).host;
    await wait(100);
  }
  throw new Error("Navia extension service worker was not exposed");
}

async function openKnow(page, extensionId, diagnosticName) {
  const sessionTraffic = [];
  page.on("request", (request) => {
    if (!request.url().includes("/v1/companion/sessions") && !request.url().includes("/v1/knowledge/permissions")) return;
    const origin = request.headers()["origin"] || "";
    const authorization = request.headers()["authorization"] || "";
    sessionTraffic.push({
      phase: "request",
      path: new URL(request.url()).pathname,
      method: request.method(),
      resourceType: request.resourceType(),
      originSha256: crypto.createHash("sha256").update(origin).digest("hex"),
      authorizationPresent: Boolean(authorization),
      authorizationSha256: authorization ? crypto.createHash("sha256").update(authorization).digest("hex") : null
    });
  });
  page.on("response", async (response) => {
    if (!response.url().includes("/v1/companion/sessions") && !response.url().includes("/v1/knowledge/permissions")) return;
    const body = await response.json().catch(() => null);
    sessionTraffic.push({
      phase: "response",
      path: new URL(response.url()).pathname,
      status: response.status(),
      errorCode: body?.error?.code ?? null,
      errorDetails: body?.error?.details ?? null
    });
  });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-testid='nav-knowledge-tab']").click();
  try {
    await page.getByText("本机伴侣已连接", { exact: true }).waitFor({ timeout: 20_000 });
  } catch (error) {
    writeJson(path.join(privateRoot, `${diagnosticName}.json`), {
      url: page.url(),
      pageOrigin: await page.evaluate(() => location.origin),
      bodyText: (await page.locator("body").innerText()).slice(0, 8_000),
      statusText: await page.locator("[data-testid='local-runtime-status']").allTextContents(),
      errorText: await page.locator("[data-testid='local-runtime-error']").allTextContents(),
      sessionTraffic,
      directBootstrap: await page.evaluate(async () => {
        const response = await fetch("http://127.0.0.1:17861/v1/companion/sessions", { method: "POST", cache: "no-store" });
        return { status: response.status, body: await response.json() };
      }).catch((failure) => ({ failure: String(failure) }))
    });
    await page.screenshot({ path: path.join(privateRoot, `${diagnosticName}.png`), fullPage: true });
    throw error;
  }
}

async function main() {
  fs.mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(publicRoot, { recursive: true, mode: 0o700 });
  process.env.NAVIA_T01_EVIDENCE_ROOT = runRoot;
  process.env.NAVIA_T01_RUN_ID = runId;
  process.env.NAVIA_T01_EXTENSION_ROOT = path.join(repoRoot, "apps/chrome-extension/chrome-mv3-unpacked");
  process.env.NAVIA_T01_HEADLESS = "1";
  const helpers = await import(`./chrome-v2-t01-r1-frontend.mjs?v3-companion=${Date.now()}`);
  let browser;
  let runtime;
  const result = { schemaVersion: "v3-companion-runtime-e2e/v1", runId, checks: {}, instances: [], passed: false };
  try {
    browser = await helpers.launchExtension(profilePath);
    const worker = await helpers.extensionWorker(browser.context);
    const extensionId = new URL(worker.url()).host;
    const origin = `chrome-extension://${extensionId}`;
    runtime = startCompanion(extensionId, "first");
    await waitRuntime();
    const wrongOrigin = await fetch("http://127.0.0.1:17861/v1/companion/sessions", { method: "POST", headers: { Origin: `chrome-extension://${"b".repeat(32)}` } });
    const wrongBody = await wrongOrigin.json();
    result.checks.wrongOriginRejected = wrongOrigin.status === 403 && wrongBody.error?.code === "V3_COMPANION_ORIGIN_MISMATCH";
    const page = await browser.context.newPage();
    await page.setViewportSize({ width: 720, height: 900 });
    await openKnow(page, extensionId, "first-connect-diagnostic");
    result.checks.autoBootstrap = true;
    const firstStatus = await companionStatus(origin);
    result.instances.push(firstStatus.runtimeInstanceId);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-testid='nav-knowledge-tab']").click();
    await page.getByText("本机伴侣已连接", { exact: true }).waitFor({ timeout: 20_000 });
    result.checks.reloadReconnect = true;
    await page.locator("[data-testid='local-runtime-stop']").click();
    await page.getByText("本机伴侣未启动", { exact: true }).waitFor({ timeout: 10_000 });
    await runtime.waitForExit();
    result.checks.explicitStop = true;
    runtime = startCompanion(extensionId, "second");
    await waitRuntime();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-testid='nav-knowledge-tab']").click();
    await page.getByText("本机伴侣已连接", { exact: true }).waitFor({ timeout: 20_000 });
    const secondStatus = await companionStatus(origin);
    result.instances.push(secondStatus.runtimeInstanceId);
    result.checks.restartChangesInstance = firstStatus.runtimeInstanceId !== secondStatus.runtimeInstanceId;
    await page.screenshot({ path: path.join(publicRoot, "companion-connected.png"), fullPage: true });
    await page.locator("[data-testid='local-runtime-stop']").click();
    await runtime.waitForExit();
    result.checks.finalCleanup = true;
    const configText = fs.readFileSync(configPath, "utf8");
    result.checks.configContainsNoSecret = !/(token|bearer|authorization|cookie)/i.test(configText);
    result.passed = Object.values(result.checks).every(Boolean);
    writeJson(path.join(publicRoot, "result.json"), result);
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 1;
  } finally {
    if (runtime?.child.exitCode === null && runtime?.child.signalCode === null) await runtime.forceStop().catch(() => undefined);
    await browser?.close();
    await wait(1_000);
    fs.rmSync(profilePath, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
