// Stage B B-5-3 P0 real Runtime API integration test.
//
// Closes PH0-AR-7 (M-3 outline-task creation) and PH0-AR-11 (real Runtime
// API integration).
//
// Boots a real local navia_runtime on a free port, then exercises:
//   GET  /v1/health
//   POST /v1/companion/sessions            (issue bearer for auth)
//   POST /v1/media/outline-tasks            (creates media_tasks row)
//   GET  /v1/media/outline-tasks/<id>       (verifies row is observable)
//   POST /v1/media/tasks/<id>/comprehension/synthesize
//                                          (provider-bound; expected to
//                                           error in Mock mode but exercises
//                                           the require_current_authority
//                                           gate which is what M-3 closes)
//
// No Chrome, no Provider network call, no audio.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeTempRoot } from "../lib/temp_roots.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runtimeRoot = path.join(repoRoot, "services/local-runtime");
const runtimePython = path.join(runtimeRoot, ".venv/bin/python");
const TEST_EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop"; // 32-char a-p (matches _EXTENSION_ID regex)

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    }).once("error", reject);
  });
}

async function waitForRuntime(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/v1/health`);
      if (res.ok) return;
    } catch { /* still starting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`runtime on port ${port} did not become healthy within ${timeoutMs}ms`);
}

const runtimePortHolder = { value: null };
const procHolder = { value: null };
const bearerTokenHolder = { value: null };
const extensionOrigin = `chrome-extension://${TEST_EXTENSION_ID}`;
const scratchDir = makeTempRoot("navia-b5-3-runtime-");
const dbPath = path.join(scratchDir, "b5-3-runtime.sqlite3");
fs.writeFileSync(dbPath, "");
fs.chmodSync(dbPath, 0o600);
const mediaTaskRoot = path.join(scratchDir, "media-tasks");
fs.mkdirSync(mediaTaskRoot, { mode: 0o700, recursive: true });

function authHeaders() {
  return {
    "content-type": "application/json",
    origin: extensionOrigin,
    authorization: `Bearer ${bearerTokenHolder.value}`,
  };
}

test.before(async () => {
  const port = await freePort();
  runtimePortHolder.value = port;
  procHolder.value = spawn(runtimePython, [
    "-m", "uvicorn", "navia_runtime.app:app",
    "--host", "127.0.0.1", "--port", String(port),
    "--log-level", "warning",
  ], {
    cwd: runtimeRoot,
    env: {
      ...process.env,
      PYTHONPATH: ".",
      NAVIA_DB_PATH: dbPath,
      NAVIA_MEDIA_TASK_ROOT: mediaTaskRoot,
      NAVIA_LOCAL_FILES_EXTENSION_ID: TEST_EXTENSION_ID,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  procHolder.value.stderr.on("data", () => { /* swallow */ });
  await waitForRuntime(port, 30_000);
  const sessionRes = await fetch(`http://127.0.0.1:${port}/v1/companion/sessions`, {
    method: "POST",
    headers: { origin: extensionOrigin },
  });
  assert.equal(sessionRes.status, 201, `session bootstrap expected 201, got ${sessionRes.status}`);
  const sessionJson = await sessionRes.json();
  bearerTokenHolder.value = sessionJson?.data?.token;
  assert.ok(bearerTokenHolder.value, `session token missing: ${JSON.stringify(sessionJson).slice(0, 500)}`);
});

test.after(async () => {
  if (procHolder.value && procHolder.value.exitCode === null) {
    procHolder.value.kill("SIGINT");
    await new Promise((r) => setTimeout(r, 1500));
    if (procHolder.value.exitCode === null) procHolder.value.kill("SIGKILL");
  }
  try {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  } catch { /* best effort */ }
});

// ============================================================================
// PH0-AR-7 (M-3): outline-tasks POST creates a media_tasks row
// ============================================================================

test("PH0-AR-7: POST /v1/media/outline-tasks creates a media_tasks row (M-3 atomic)", async () => {
  const sourceIdentity = "portal:bilibili:BV1P0H7ACED12345678901:1:1";
  const res = await fetch(`http://127.0.0.1:${runtimePortHolder.value}/v1/media/outline-tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ sourceIdentity }),
  });
  assert.equal(res.status, 201, `expected 201, got ${res.status}`);
  const json = await res.json();
  const taskId = json?.data?.task?.task_id || json?.data?.task?.taskId;
  assert.ok(taskId, `task_id missing in response: ${JSON.stringify(json).slice(0, 500)}`);
  assert.match(taskId, /^media_task_[0-9a-f]{32}$/);

  const rows = JSON.parse(execFileSync("sqlite3", ["-json", dbPath,
    `SELECT task_id, source_identity, state, revision FROM media_tasks WHERE task_id='${taskId}'`,
  ], { encoding: "utf8" }) || "[]");
  assert.equal(rows.length, 1, `expected 1 row, got ${rows.length}`);
  assert.equal(rows[0].source_identity, sourceIdentity);
  assert.equal(rows[0].state, "created");
  assert.equal(rows[0].revision, 1);

  const st = fs.statSync(dbPath);
  assert.equal(st.mode & 0o777, 0o600);
});

test("PH0-AR-7: outline creation reuses acquisition source authority task id", async () => {
  const sourceIdentity = "portal:bilibili:BV1R0UTEACED1234567890:1:1";
  const authoritativeTaskId = "media_task_1234567890abcdef1234567890abcdef";
  execFileSync("sqlite3", [dbPath,
    `INSERT INTO media_source_authority(source_identity,task_id,adapter_id,consent_policy_id,consent_policy_revision,state,updated_at,owner_pid,owner_start) VALUES ('${sourceIdentity}','${authoritativeTaskId}','bilibili','bilibili-media-consent/v1',1,'active','2026-10-15T00:00:00Z',NULL,NULL)`,
  ]);
  const res = await fetch(`http://127.0.0.1:${runtimePortHolder.value}/v1/media/outline-tasks`, {
    method: "POST", headers: authHeaders(), body: JSON.stringify({ sourceIdentity }),
  });
  const responseText = await res.text();
  assert.equal(res.status, 201, `expected 201, got ${res.status}: ${responseText}`);
  const json = JSON.parse(responseText);
  const taskId = json?.data?.task?.task_id || json?.data?.task?.taskId;
  assert.equal(taskId, authoritativeTaskId);
  const rows = JSON.parse(execFileSync("sqlite3", ["-json", dbPath,
    `SELECT task_id,source_identity FROM media_tasks WHERE source_identity='${sourceIdentity}'`,
  ], { encoding: "utf8" }) || "[]");
  assert.deepEqual(rows, [{ task_id: authoritativeTaskId, source_identity: sourceIdentity }]);
});

test("PH0-AR-7: POST /v1/media/outline-tasks rejects malformed body", async () => {
  const res = await fetch(`http://127.0.0.1:${runtimePortHolder.value}/v1/media/outline-tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ wrong: "fields" }),
  });
  assert.notEqual(res.status, 201, "malformed body should not return 201");
});

test("PH0-AR-7: GET /v1/media/outline-tasks/<id> returns the row", async () => {
  const sourceIdentity = "portal:bilibili:BV1G3T7ACED98765432101:1:1";
  const createRes = await fetch(`http://127.0.0.1:${runtimePortHolder.value}/v1/media/outline-tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ sourceIdentity }),
  });
  const created = await createRes.json();
  const taskId = created?.data?.task?.task_id || created?.data?.task?.taskId;
  assert.ok(taskId, `taskId missing: ${JSON.stringify(created).slice(0, 500)}`);
  const getRes = await fetch(`http://127.0.0.1:${runtimePortHolder.value}/v1/media/outline-tasks/${taskId}`, {
    headers: authHeaders(),
  });
  assert.equal(getRes.status, 200);
  const got = await getRes.json();
  const returnedId = got?.data?.task?.task_id || got?.data?.task?.taskId;
  assert.equal(returnedId, taskId);
});

// ============================================================================
// PH0-AR-11: synthesize endpoint requires media_tasks row (M-3 contract)
// ============================================================================

test("PH0-AR-11: synthesize with valid media_tasks row reaches the provider gate (M-3 closed)", async () => {
  const sourceIdentity = "portal:bilibili:BV1S5Y7ACED11122233344:1:1";
  const createRes = await fetch(`http://127.0.0.1:${runtimePortHolder.value}/v1/media/outline-tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ sourceIdentity }),
  });
  const created = await createRes.json();
  const taskId = created?.data?.task?.task_id || created?.data?.task?.taskId;
  assert.ok(taskId, `taskId missing: ${JSON.stringify(created).slice(0, 500)}`);

  const synthRes = await fetch(`http://127.0.0.1:${runtimePortHolder.value}/v1/media/tasks/${taskId}/comprehension/synthesize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ expectedRevision: 1, consent: true, style: "structured" }),
  });
  // M-3 contract: status is NOT 404 (which would mean
  // `require_current_authority` failed) — it may be 200/401/403/409/422/500.
  assert.notEqual(synthRes.status, 404, "M-3 still open: synthesizer returned 404 for valid task_id");
});

test("PH0-AR-11: synthesize with unknown task_id returns 404 (sanity)", async () => {
  const fakeTaskId = "media_task_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const synthRes = await fetch(`http://127.0.0.1:${runtimePortHolder.value}/v1/media/tasks/${fakeTaskId}/comprehension/synthesize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ expectedRevision: 1, consent: true, style: "structured" }),
  });
  assert.equal(synthRes.status, 404, `expected 404 for unknown task_id, got ${synthRes.status}`);
});
