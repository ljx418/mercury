// The shared OFFLINE harness of the runner-level tests.
//
// It drives the REAL runner against a local Runtime double. The double
// publishes a derivative (success path) or refuses with a structured Runtime
// failure (failure path), and it writes the INTERNAL diagnostic that the
// production Runtime writes when the Provider attempt fails.
//
// No Chrome, no real Runtime, no Provider call, no download, no import, no
// media task and no Cookie read happen here: the Cookie file is synthetic
// and the Runtime is a loopback double.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { consumeAuthorization } from "../../lib/authorization.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "../../lib/registry.mjs";
import { makeTempRoot } from "../../lib/temp_roots.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const runnerPath = path.join(repoRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs");

export const TASK_ID = `media_task_${"c".repeat(32)}`;
export const BVID = FROZEN_SIX[0].bvid;
export const SOURCE_IDENTITY = `portal:bilibili:${BVID}:41828944992:p1`;

export const UPLOAD_COUNTERS = {
  rawVideoUploadCount: 0,
  rawAudioUploadCount: 0,
  frameByteUploadCount: 0,
  cookieUploadCount: 0,
  apiKeyDisclosureCount: 0,
  localPathUploadCount: 0,
};

/** The frozen V2.1 receipt of a published derivative. */
export function publishedReceipt({ requestCount }) {
  return {
    providerId: "minimax-cn-openai-vision",
    modelId: "MiniMax-M3",
    outboundDerivedTextSha256: "1".repeat(64),
    requestCount,
    ...UPLOAD_COUNTERS,
    endpointClass: "minimax_chat_completions",
    structureMode: "strict_tool",
    attemptId: `attempt-${"a".repeat(16)}`,
    latencyMs: 12,
    requestSha256: "2".repeat(64),
    responseSha256: "3".repeat(64),
    finishReason: "stop",
  };
}

export function createRuntimeDatabase(dbPath) {
  const sql = [
    "CREATE TABLE media_source_authority(task_id TEXT, source_identity TEXT, state TEXT, consent_policy_id TEXT, updated_at TEXT);",
    `INSERT INTO media_source_authority VALUES('${TASK_ID}', '${SOURCE_IDENTITY}', 'active', 'bilibili-media-consent/v1', '2026-10-24T00:00:00Z');`,
    "CREATE TABLE media_tasks(task_id TEXT, state TEXT, revision INTEGER);",
    `INSERT INTO media_tasks VALUES('${TASK_ID}', 'ready', 7);`,
  ].join(" ");
  const completed = spawnSync("sqlite3", [dbPath, sql], { encoding: "utf8" });
  if (completed.status !== 0) throw new Error(`sqlite3 failed: ${completed.stderr}`);
}

/**
 * The Runtime double.
 *
 * `mode` is either "published" (the Runtime publishes a derivative whose
 * receipt carries `requestCount` outbound attempts) or "rejected" (the
 * Runtime refuses and its INTERNAL diagnostic carries the number of the
 * outbound attempts it made).
 */
export function startRuntimeDouble({ mode, requestCount, mediaTaskRoot, diagnosticPath }) {
  const server = http.createServer((request, response) => {
    const send = (status, value) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(value));
    };
    const url = request.url ?? "";
    if (url.startsWith("/v1/health")) {
      send(200, { ok: true, data: { status: "ok" }, error: null });
      return;
    }
    if (url.startsWith("/v1/companion/sessions")) {
      send(201, { ok: true, data: { token: "offline-test-token" }, error: null });
      return;
    }
    if (url.startsWith("/v1/media/dependencies")) {
      send(200, {
        ok: true,
        data: { overallState: "ready", generation: `depgen_${"a".repeat(64)}`, dependencies: [] },
        error: null,
      });
      return;
    }
    if (url.startsWith("/v1/media/transcripts/")) {
      send(200, { ok: true, data: { task: { route: "credentialed_media_asr" } }, error: null });
      return;
    }
    if (url.startsWith("/v1/media/outline-tasks")) {
      send(201, { ok: true, data: { task: { task_id: TASK_ID, revision: 7 } }, error: null });
      return;
    }
    if (url.includes("/comprehension/synthesize")) {
      if (mode === "published") {
        // The Runtime publishes the derivative and reports the ACTUAL number
        // of outbound Provider HTTP attempts in its receipt.
        const revisionRoot = path.join(
          mediaTaskRoot,
          "product-evidence",
          "grounded-comprehension-v2.1",
          TASK_ID,
          "revision-7",
        );
        fs.mkdirSync(revisionRoot, { recursive: true, mode: 0o700 });
        fs.writeFileSync(path.join(revisionRoot, "comprehension.json"), JSON.stringify({
          schemaVersion: "v3-media-grounded-comprehension/v2.1",
          binding: { taskId: TASK_ID, taskRevision: 7, sourceIdentity: SOURCE_IDENTITY },
          brief: { text: "离线测试用的概括文本，覆盖开头中段和结尾。", evidenceIds: [] },
          claims: [],
          chapters: [],
          regions: [],
          quality: { status: "complete", failureCodes: [] },
          receipt: publishedReceipt({ requestCount }),
        }, null, 2));
        send(200, { ok: true, data: { projection: { schemaVersion: "v3-media-grounded-comprehension/v2.1" } }, error: null });
        return;
      }
      // The Runtime refuses. Its INTERNAL diagnostic carries the ACTUAL
      // number of outbound Provider HTTP attempts it made.
      fs.mkdirSync(path.dirname(diagnosticPath), { recursive: true, mode: 0o700 });
      fs.writeFileSync(diagnosticPath, JSON.stringify({
        schemaVersion: "v3-media-grounded-chapter-diagnostic-set/v1",
        taskId: TASK_ID,
        stages: [{
          schemaVersion: "v3-media-grounded-chapter-diagnostic/v1",
          stage: "provider_attempt",
          failureCode: "V3510B_PROVIDER_RESPONSE_INVALID",
          providerOutboundHttpAttempts: requestCount,
        }],
      }));
      send(502, {
        ok: false,
        data: null,
        error: { code: "V3510B_PROVIDER_RESPONSE_INVALID", message: "", recoverable: false },
        request_id: null,
      });
      return;
    }
    send(404, { ok: false, data: null, error: { code: "NOT_FOUND", message: "" } });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

export function runRunner(args, env) {
  return new Promise((resolve) => {
    const child = spawn("node", [runnerPath, ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 120_000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ status: code, stdout, stderr });
    });
  });
}

export function ledgerTotals(stageRoot) {
  const file = path.join(stageRoot, "stage-actions.jsonl");
  if (!fs.existsSync(file)) return { events: [], byEvent: {} };
  const events = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean)
    .map((line) => JSON.parse(line));
  const byEvent = {};
  for (const event of events) {
    byEvent[event.event] = (byEvent[event.event] ?? 0) + event.count;
  }
  return { events, byEvent };
}

/** Run the runner once and return its receipt, its ledger and its exit. */
export async function driveRunner({ mode, requestCount }) {
  const evidenceRoot = makeTempRoot("navia-b5-rc3-");
  const stageRoot = makeTempRoot("navia-b5-rc3-stage-");
  const mediaTaskRoot = makeTempRoot("navia-b5-rc3-media-");
  const dbPath = path.join(evidenceRoot, "runtime.sqlite3");
  fs.writeFileSync(dbPath, "");
  createRuntimeDatabase(dbPath);
  const cookieFile = path.join(evidenceRoot, "synthetic-cookies.txt");
  fs.writeFileSync(
    cookieFile,
    ".bilibili.com\tTRUE\t/\tTRUE\t0\tSESSDATA\tsynthetic-offline-value\n",
    { mode: 0o600 },
  );
  const diagnosticPath = path.join(evidenceRoot, "stage-b-diagnostic.json");

  const { server, url } = await startRuntimeDouble({
    mode,
    requestCount,
    mediaTaskRoot,
    diagnosticPath,
  });
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: `rc3-${mode}-${requestCount}`,
    runId: "rc3-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: FROZEN_SIX,
  });
  const grant = consumed.grants.find((item) => item.order === "1");

  let completed;
  try {
    completed = await runRunner([
      "--order=1",
      `--bvid=${BVID}`,
      "--run-id=rc3-run",
      `--evidence-root=${evidenceRoot}`,
      `--grant-id=${grant.grantId}`,
      `--authorization-digest=${consumed.digest}`,
    ], {
      NAVIA_B5_STAGE_ROOT: stageRoot,
      NAVIA_B5_TEST_RUNTIME_URL: url,
      NAVIA_B5_TEST_DB_PATH: dbPath,
      NAVIA_B5_TEST_MEDIA_TASK_ROOT: mediaTaskRoot,
      NAVIA_B5_TEST_NO_BROWSER: "1",
      NAVIA_B5_DIAGNOSTIC_FILE: diagnosticPath,
      NAVIA_BILIBILI_COOKIE_FILE: cookieFile,
    });
  } finally {
    server.close();
  }
  const receiptPath = path.join(evidenceRoot, `bvid-1-${BVID}`, "b5-source-receipt.json");
  if (!fs.existsSync(receiptPath)) {
    throw new Error(
      `the runner wrote no receipt (status=${completed.status})\nstdout=${completed.stdout}\nstderr=${completed.stderr}`,
    );
  }
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  return { completed, receipt, ledger: ledgerTotals(stageRoot), evidenceRoot, stageRoot };
}

