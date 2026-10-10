import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const appRoot = path.join(repoRoot, "apps/chrome-extension");
const extensionRoot = fs.realpathSync(process.env.NAVIA_V3_EXTENSION_ROOT || path.join(appRoot, "chrome-mv3-unpacked"));
const evidenceRoot = path.join(
  repoRoot,
  "docs/active/project/evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.3-origin-probe"
);
const runId = process.env.NAVIA_V3_ORIGIN_PROBE_RUN_ID
  || `v3-1.3-origin-probe-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
const runRoot = path.join(evidenceRoot, "runs", runId);
const profileSuffix = crypto.createHash("sha256").update(runId).digest("hex").slice(0, 12);
const profilePath = path.join(repoRoot, ".tmp", `navia-t01-profile-${profileSuffix}`);

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function listen() {
  const observations = [];
  const server = http.createServer((request, response) => {
    const origin = request.headers.origin ?? null;
    observations.push({
      path: request.url,
      method: request.method,
      origin,
      secFetchMode: request.headers["sec-fetch-mode"] ?? null,
      secFetchSite: request.headers["sec-fetch-site"] ?? null
    });
    request.resume();
    const headers = {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {})
    };
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        ...headers,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
      });
      response.end();
      return;
    }
    response.writeHead(200, headers);
    response.end(JSON.stringify({ ok: true }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  ensure(address && typeof address !== "string", "origin probe server address unavailable");
  return { server, observations, url: `http://127.0.0.1:${address.port}` };
}

async function main() {
  fs.mkdirSync(runRoot, { recursive: true, mode: 0o700 });
  fs.rmSync(profilePath, { recursive: true, force: true });
  process.env.NAVIA_T01_EVIDENCE_ROOT = runRoot;
  process.env.NAVIA_T01_RUN_ID = runId;
  process.env.NAVIA_T01_EXTENSION_ROOT = extensionRoot;
  process.env.NAVIA_T01_HEADLESS = "1";
  const helpers = await import(`./chrome-v2-t01-r1-frontend.mjs?v3origin=${Date.now()}`);
  const probe = await listen();
  let launched = null;
  const result = {
    schemaVersion: "v3-credential-origin-probe/v1",
    runId,
    generatedAt: new Date().toISOString(),
    extensionId: null,
    expectedOrigin: null,
    contexts: [],
    passed: false
  };
  try {
    launched = await helpers.launchExtension(profilePath);
    const worker = await helpers.extensionWorker(launched.context);
    const extensionId = await worker.evaluate(() => chrome.runtime.id);
    const expectedOrigin = `chrome-extension://${extensionId}`;
    result.extensionId = extensionId;
    result.expectedOrigin = expectedOrigin;

    const page = await launched.context.newPage();
    await page.goto(`${expectedOrigin}/sidepanel.html`, { waitUntil: "domcontentloaded" });
    const pageStatus = await page.evaluate(async (url) => {
      const response = await fetch(`${url}/extension-page`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "origin-probe",
        cache: "no-store",
        redirect: "error"
      });
      return response.status;
    }, probe.url);
    const workerStatus = await worker.evaluate(async (url) => {
      const response = await fetch(`${url}/service-worker`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "origin-probe",
        cache: "no-store",
        redirect: "error"
      });
      return response.status;
    }, probe.url);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const pageObservation = probe.observations.find((item) => item.path === "/extension-page" && item.method === "POST");
    const workerObservation = probe.observations.find((item) => item.path === "/service-worker" && item.method === "POST");
    result.contexts = [
      { context: "extension_page", status: pageStatus, ...pageObservation },
      { context: "background_service_worker", status: workerStatus, ...workerObservation }
    ];
    result.passed = pageStatus === 200
      && workerStatus === 200
      && pageObservation?.origin === expectedOrigin
      && workerObservation?.origin === expectedOrigin;
    ensure(result.passed, "exact extension Origin was not stable across extension page and service worker");
  } finally {
    writeJson(path.join(runRoot, "origin-probe.json"), result);
    await launched?.close().catch(() => undefined);
    await new Promise((resolve) => probe.server.close(resolve));
    fs.rmSync(profilePath, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
