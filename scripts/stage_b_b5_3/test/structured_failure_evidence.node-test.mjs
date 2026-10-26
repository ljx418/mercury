// The FC3 oracle: a REAL structured Runtime failure response driven through
// the runner.
//
// The runner talks to a local HTTP double that answers with the PRODUCT's
// structured error envelope. The runner's own classification, its own
// finalization and its own audit set run with that response: the test-only
// fault seam (which throws a generic Error) is NOT what is exercised here.
//
// The proof: the nine-file audit set carries the exact safe failure code, the
// attempted Provider facts, a null publication, an accurate ledger count, no
// secret sample and no absolute path.
//
// No Chrome, no real media Runtime, no Provider call, no download, no import,
// no media task, no Cookie read and no audio output happen here.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { detectAbsolutePaths } from "../lib/privacy.mjs";
import { consumeAuthorization } from "../lib/authorization.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "../lib/registry.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runnerPath = path.join(repoRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs");

const MANDATORY_FILES = Object.freeze([
  "final_disposition.txt",
  "b5-source-receipt.json",
  "isolation.json",
  "receipt.json",
  "provider_lock.txt",
  "chrome_launch.log",
  "secret_scan.csv",
  "cleanup.json",
  "task_namespace.json",
]);

const TASK_ID = `media_task_${"a".repeat(32)}`;
const BVID = FROZEN_SIX[0].bvid;
const SOURCE_IDENTITY = `portal:bilibili:${BVID}:41828944992:p1`;

/** Create the Runtime database the runner polls. */
/**
 * Run the runner ASYNCHRONOUSLY: the HTTP double lives in this process and
 * needs a free event loop to answer the runner's requests.
 */
function runRunner(args, env) {
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

function createRuntimeDatabase(dbPath) {
  const sql = [
    // The columns the runner's read-only polls select.
    "CREATE TABLE media_source_authority(task_id TEXT, source_identity TEXT, state TEXT, consent_policy_id TEXT, updated_at TEXT);",
    `INSERT INTO media_source_authority VALUES('${TASK_ID}', '${SOURCE_IDENTITY}', 'active', 'bilibili-media-consent/v1', '2026-10-24T00:00:00Z');`,
    "CREATE TABLE media_tasks(task_id TEXT, state TEXT, revision INTEGER);",
    `INSERT INTO media_tasks VALUES('${TASK_ID}', 'ready', 7);`,
  ].join(" ");
  const completed = spawnSync("sqlite3", [dbPath, sql], { encoding: "utf8" });
  assert.equal(completed.status, 0, `sqlite3 failed: ${completed.stderr}`);
}

/**
 * The Runtime double: the PRODUCT's structured error envelope.
 *
 * It also writes the INTERNAL diagnostic that the production Runtime writes
 * when the Provider attempt fails: it carries the ACTUAL number of outbound
 * Provider HTTP attempts.
 */
function startRuntimeDouble({ failureCode, httpStatus, diagnosticPath = null, outboundHttpAttempts = 1 }) {
  const server = http.createServer((request, response) => {
    const send = (status, value) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(value));
    };
    const url = request.url ?? "";
    if (url.startsWith("/v1/health")) {
      send(200, { ok: true, data: { status: "ok" } });
      return;
    }
    if (url.startsWith("/v1/companion/sessions")) {
      send(201, { ok: true, data: { token: "offline-test-token" }, error: null });
      return;
    }
    if (url.startsWith("/v1/media/dependencies")) {
      send(200, {
        ok: true,
        data: {
          overallState: "ready",
          generation: `depgen_${"a".repeat(64)}`,
          dependencies: [],
        },
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
      // The structured Runtime failure: an allowlisted frozen code.
      if (diagnosticPath) {
        fs.mkdirSync(path.dirname(diagnosticPath), { recursive: true, mode: 0o700 });
        fs.writeFileSync(diagnosticPath, JSON.stringify({
          schemaVersion: "v3-media-grounded-chapter-diagnostic-set/v1",
          taskId: TASK_ID,
          stages: [{
            schemaVersion: "v3-media-grounded-chapter-diagnostic/v1",
            stage: "provider_attempt",
            failureCode,
            providerOutboundHttpAttempts: outboundHttpAttempts,
          }],
        }));
      }
      send(httpStatus, {
        ok: false,
        data: null,
        error: {
          code: failureCode,
          message: "章节起点必须严格递增。",
          recoverable: false,
        },
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

test("FC3: a structured Runtime failure produces the exact safe failure code and no path", async () => {
  const evidenceRoot = makeTempRoot("navia-b5-fc3-");
  const stageRoot = makeTempRoot("navia-b5-fc3-stage-");
  const dbPath = path.join(evidenceRoot, "runtime.sqlite3");
  fs.writeFileSync(dbPath, "");
  createRuntimeDatabase(dbPath);
  // The SYNTHETIC cookie file. No real Cookie material is read: the value
  // below is a fabricated placeholder.
  const cookieFile = path.join(evidenceRoot, "synthetic-cookies.txt");
  fs.writeFileSync(
    cookieFile,
    ".bilibili.com\tTRUE\t/\tTRUE\t0\tSESSDATA\tsynthetic-offline-value\n",
    { mode: 0o600 },
  );

  const diagnosticPath = path.join(evidenceRoot, "stage-b-diagnostic.json");
  const { server, url } = await startRuntimeDouble({
    failureCode: "V3510B_CHAPTER_TIME_INVALID",
    httpStatus: 502,
    diagnosticPath,
  });

  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "fc3-structured-failure",
    runId: "fc3-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: FROZEN_SIX,
  });
  assert.equal(consumed.ok, true);
  const grant = consumed.grants.find((item) => item.order === "1");

  let completed;
  try {
    completed = await runRunner([
      "--order=1",
      `--bvid=${BVID}`,
      "--run-id=fc3-run",
      `--evidence-root=${evidenceRoot}`,
      `--grant-id=${grant.grantId}`,
      `--authorization-digest=${consumed.digest}`,
    ], {
      NAVIA_B5_STAGE_ROOT: stageRoot,
      NAVIA_B5_TEST_RUNTIME_URL: url,
      NAVIA_B5_TEST_DB_PATH: dbPath,
      NAVIA_B5_TEST_NO_BROWSER: "1",
      NAVIA_B5_DIAGNOSTIC_FILE: diagnosticPath,
      NAVIA_BILIBILI_COOKIE_FILE: cookieFile,
    });
  } finally {
    server.close();
  }

  assert.notEqual(completed.status, 0, `the runner must fail: ${completed.stdout}`);

  const bvidDir = path.join(evidenceRoot, `bvid-1-${BVID}`);
  for (const name of MANDATORY_FILES) {
    assert.ok(fs.existsSync(path.join(bvidDir, name)), `the mandatory file ${name} is missing`);
  }

  // 1. The exact safe failure code.
  const receipt = JSON.parse(fs.readFileSync(path.join(bvidDir, "b5-source-receipt.json"), "utf8"));
  assert.equal(receipt.failureCode, "V3510B_CHAPTER_TIME_INVALID");
  const diagnostic = JSON.parse(fs.readFileSync(path.join(bvidDir, "failure-diagnostic.json"), "utf8"));
  assert.equal(diagnostic.failureCode, "V3510B_CHAPTER_TIME_INVALID");
  // The response BODY is never stored.
  assert.ok(!JSON.stringify(diagnostic).includes("章节起点必须严格递增"));

  // 2. The attempted Provider facts, and a NULL publication.
  assert.equal(receipt.provider.selectedProviderId, "minimax-cn-openai-vision");
  assert.equal(receipt.provider.selectedEndpointClass, "minimax_chat_completions");
  assert.ok(receipt.provider.attempted, "the attempted facts must be retained");
  assert.equal(receipt.provider.attempted.providerId, "minimax-cn-openai-vision");
  assert.equal(receipt.provider.attempted.endpointClass, "minimax_chat_completions");
  assert.ok(receipt.provider.attempted.attemptCount >= 1);
  assert.equal(receipt.provider.published, null, "an absent publication stays null");
  const mirror = JSON.parse(fs.readFileSync(path.join(bvidDir, "receipt.json"), "utf8"));
  assert.equal(mirror.published, false);
  assert.equal(mirror.receipt, null);

  // 3. The accurate ledger count: the attempt was recorded at the boundary.
  const ledger = fs.readFileSync(path.join(stageRoot, "stage-actions.jsonl"), "utf8")
    .trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const providerAttempts = ledger
    .filter((entry) => entry.event === "providerCall")
    .reduce((total, entry) => total + entry.count, 0);
  assert.equal(providerAttempts, 1, "the rejected Provider attempt must be counted");

  // 4. No secret sample.
  const secretScan = fs.readFileSync(path.join(bvidDir, "secret_scan.csv"), "utf8");
  assert.ok(!/sk-[A-Za-z0-9_-]{8,}/.test(secretScan));
  assert.ok(!secretScan.includes("sample"));

  // 5. No absolute path anywhere in the audit set.
  for (const name of fs.readdirSync(bvidDir)) {
    const file = path.join(bvidDir, name);
    if (!fs.statSync(file).isFile()) continue;
    const text = fs.readFileSync(file, "utf8");
    const paths = detectAbsolutePaths(text);
    assert.deepEqual(paths, [], `${name} carries an absolute path`);
  }
  const privacy = JSON.parse(fs.readFileSync(path.join(bvidDir, "privacy-audit.json"), "utf8"));
  assert.equal(privacy.absolutePathCount, 0);
});

test("FC3: a fresh-process re-entry never degrades a known fact", async () => {
  const evidenceRoot = makeTempRoot("navia-b5-fc3-");
  const stageRoot = makeTempRoot("navia-b5-fc3-stage-");
  const dbPath = path.join(evidenceRoot, "runtime.sqlite3");
  fs.writeFileSync(dbPath, "");
  createRuntimeDatabase(dbPath);
  const cookieFile = path.join(evidenceRoot, "synthetic-cookies.txt");
  fs.writeFileSync(
    cookieFile,
    ".bilibili.com\tTRUE\t/\tTRUE\t0\tSESSDATA\tsynthetic-offline-value\n",
    { mode: 0o600 },
  );

  // The FIRST run fails with an allowlisted frozen code.
  const first = await startRuntimeDouble({
    failureCode: "V3510B_CHAPTER_TIME_INVALID",
    httpStatus: 502,
  });
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "fc3-reentry",
    runId: "fc3-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: FROZEN_SIX,
  });
  const grant = consumed.grants.find((item) => item.order === "1");
  const run = () => runRunner([
    "--order=1",
    `--bvid=${BVID}`,
    "--run-id=fc3-run",
    `--evidence-root=${evidenceRoot}`,
    `--grant-id=${grant.grantId}`,
    `--authorization-digest=${consumed.digest}`,
  ], {
    NAVIA_B5_STAGE_ROOT: stageRoot,
    NAVIA_B5_TEST_RUNTIME_URL: first.url,
    NAVIA_B5_TEST_DB_PATH: dbPath,
    NAVIA_B5_TEST_NO_BROWSER: "1",
    NAVIA_BILIBILI_COOKIE_FILE: cookieFile,
  });
  await run();
  first.server.close();

  const bvidDir = path.join(evidenceRoot, `bvid-1-${BVID}`);
  const afterFirst = JSON.parse(fs.readFileSync(path.join(bvidDir, "b5-source-receipt.json"), "utf8"));
  assert.equal(afterFirst.failureCode, "V3510B_CHAPTER_TIME_INVALID");

  // A SECOND, FRESH process re-enters the same evidence root and fails with a
  // generic error. The known fact may never degrade.
  //
  // The re-entry carries its OWN authorization: a child grant is ONE-USE, so
  // a retry of the same source needs a fresh grant. The evidence root, the
  // run id and the source stay the same, so the durable record is merged.
  const second = await startRuntimeDouble({
    failureCode: "ATTACKER_CONTROLLED_CODE",
    httpStatus: 500,
  });
  const reconsumed = consumeAuthorization({
    stageRoot,
    authorizationId: "fc3-reentry-second",
    runId: "fc3-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: FROZEN_SIX,
  });
  assert.equal(reconsumed.ok, true);
  const regrant = reconsumed.grants.find((item) => item.order === "1");
  await runWith(second.url, regrant, reconsumed.digest);
  second.server.close();

  const afterSecond = JSON.parse(fs.readFileSync(path.join(bvidDir, "b5-source-receipt.json"), "utf8"));
  assert.equal(afterSecond.failureCode, "V3510B_CHAPTER_TIME_INVALID",
    "the known safe failure code must survive the re-entry");
  assert.equal(afterSecond.provider.attempted.attemptCount >= 1, true);
  assert.equal(afterSecond.provider.published, null);

  async function runWith(runtimeUrl, childGrant = grant, digest = consumed.digest) {
    return runRunner([
      "--order=1",
      `--bvid=${BVID}`,
      "--run-id=fc3-run",
      `--evidence-root=${evidenceRoot}`,
      `--grant-id=${childGrant.grantId}`,
      `--authorization-digest=${digest}`,
    ], {
      NAVIA_B5_STAGE_ROOT: stageRoot,
      NAVIA_B5_TEST_RUNTIME_URL: runtimeUrl,
      NAVIA_B5_TEST_DB_PATH: dbPath,
      NAVIA_B5_TEST_NO_BROWSER: "1",
      NAVIA_BILIBILI_COOKIE_FILE: cookieFile,
    });
  }
});

test("FC3: an unallowlisted Runtime code is never stored", async () => {
  const evidenceRoot = makeTempRoot("navia-b5-fc3-");
  const stageRoot = makeTempRoot("navia-b5-fc3-stage-");
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
    failureCode: "ATTACKER_CONTROLLED_CODE",
    httpStatus: 500,
    diagnosticPath,
  });
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "fc3-unallowlisted",
    runId: "fc3-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: FROZEN_SIX,
  });
  const grant = consumed.grants.find((item) => item.order === "1");
  let completed;
  try {
    completed = await runRunner([
      "--order=1",
      `--bvid=${BVID}`,
      "--run-id=fc3-run",
      `--evidence-root=${evidenceRoot}`,
      `--grant-id=${grant.grantId}`,
      `--authorization-digest=${consumed.digest}`,
    ], {
      NAVIA_B5_STAGE_ROOT: stageRoot,
      NAVIA_B5_TEST_RUNTIME_URL: url,
      NAVIA_B5_TEST_DB_PATH: dbPath,
      NAVIA_B5_TEST_NO_BROWSER: "1",
      NAVIA_B5_DIAGNOSTIC_FILE: diagnosticPath,
      NAVIA_BILIBILI_COOKIE_FILE: cookieFile,
    });
  } finally {
    server.close();
  }
  assert.notEqual(completed.status, 0);
  const bvidDir = path.join(evidenceRoot, `bvid-1-${BVID}`);
  const receipt = JSON.parse(fs.readFileSync(path.join(bvidDir, "b5-source-receipt.json"), "utf8"));
  assert.notEqual(receipt.failureCode, "ATTACKER_CONTROLLED_CODE");
  const serialized = JSON.stringify(receipt);
  assert.ok(!serialized.includes("ATTACKER_CONTROLLED_CODE"));
});
