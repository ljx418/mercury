// B6A — the capture lifecycle and the cleanup boundary (6).
//
// The oracle is the REAL runner (`run_one_bvid.mjs`) driven against a local
// Runtime double. The cases prove that the capture happens AFTER the durable
// V2.1 publication and BEFORE the runner owner cleanup, and that a capture
// failure fails the candidate CLOSED while the owner cleanup still runs.
//
// No Chrome, no Provider, no download, no real Runtime media task: the
// double serves the routes and the derived evidence is synthetic.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { canonicalJson, sha256Hex } from "../lib/v21_artifact.mjs";
import { consumeAuthorization } from "../lib/authorization.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "../lib/registry.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";
import { buildV21Artifact, frozenReceipt } from "./_fixtures/contract_shaped_stub.mjs";
import { PNG_BYTES } from "./_fixtures/b6_bundle_fixture.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runnerPath = path.join(repoRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs");

const TASK_ID = `media_task_${"e".repeat(32)}`;
const BVID = FROZEN_SIX[0].bvid;
const SOURCE_IDENTITY = `portal:bilibili:${BVID}:41828944992:p1`;
const EVIDENCE = [
  { kind: "transcript", text: "第一段派生字幕文本，说明视频背景与要处理的问题。" },
  { kind: "frame", text: "选中画面 1280x720，内容哈希 b6a0frame00a1b2c3d4" },
];

function normalized(text) {
  return text.split(/\s+/).filter(Boolean).join(" ");
}

/**
 * The Runtime double.
 *
 * It publishes a CONTRACT-SHAPED derivative, serves the PUBLIC workspace
 * route and the AUTHENTICATED thumbnail route, and writes the derived
 * evidence into the runner-owned private root exactly where the production
 * materializer writes it.
 */
function startDouble({
  mediaTaskRoot,
  workspaceAvailable = true,
  thumbnailAvailable = true,
  catalogHashMismatch = false,
  synthesizeFailureCode = null,
  bvid = BVID,
  sourceIdentity = SOURCE_IDENTITY,
}) {
  const privateRoot = path.join(mediaTaskRoot, "product-evidence");
  const catalog = [];
  for (const [index, item] of EVIDENCE.entries()) {
    const evidenceId = `mtr_${String(index + 1).padStart(32, "0")}`;
    const digest = sha256Hex(Buffer.from(normalized(item.text), "utf8"));
    const relative = `evidence/${TASK_ID}/${String(index).padStart(4, "0")}.json`;
    const payload = { text: normalized(item.text), contentSha256: digest };
    if (item.kind === "frame") {
      const thumbnailRelative = `evidence/${TASK_ID}/frames/${evidenceId}.png`;
      fs.mkdirSync(path.dirname(path.join(privateRoot, thumbnailRelative)), { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(privateRoot, thumbnailRelative), PNG_BYTES);
      payload.thumbnailRelativeRef = thumbnailRelative;
    }
    fs.mkdirSync(path.dirname(path.join(privateRoot, relative)), { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      path.join(privateRoot, relative),
      JSON.stringify(payload, { ensureAscii: false, sortKeys: true, separators: (",", ":") }),
    );
    catalog.push({
      evidenceId,
      taskId: TASK_ID,
      kind: item.kind,
      timestampStartMs: index * 1000,
      timestampEndMs: index * 1000 + 900,
      contentSha256: digest,
      relativeArtifactRef: relative,
      thumbnailAvailable: item.kind === "frame",
    });
  }
  const ordered = [...catalog].sort((left, right) => (
    left.timestampStartMs - right.timestampStartMs
    || (left.evidenceId < right.evidenceId ? -1 : 1)
  ));
  const catalogSha256 = sha256Hex(canonicalJson(ordered.map((item) => ({
    evidenceId: item.evidenceId,
    contentSha256: item.contentSha256,
    timestampStartMs: item.timestampStartMs,
    timestampEndMs: item.timestampEndMs,
  }))));
  const derivative = buildV21Artifact({
    taskId: TASK_ID,
    taskRevision: 7,
    sourceIdentity,
    receipt: frozenReceipt({ requestCount: 3 }),
    evidenceIds: ordered.map((item) => item.evidenceId),
    claimIds: [`claim_${"1".repeat(16)}`, `claim_${"2".repeat(16)}`],
    chapterIds: [`chapter_${"3".repeat(16)}`, `chapter_${"4".repeat(16)}`],
  });
  derivative.binding.evidenceCatalogSha256 = catalogHashMismatch ? "0".repeat(64) : catalogSha256;
  derivative.chapters[0].startMs = 0;
  derivative.chapters[0].endMs = 900;
  derivative.chapters[1].startMs = 1000;
  derivative.chapters[1].endMs = 1900;
  const derivativeBytes = Buffer.from(canonicalJson(derivative), "utf8");
  const revisionRoot = path.join(privateRoot, "grounded-comprehension-v2.1", TASK_ID, "revision-7");
  fs.mkdirSync(revisionRoot, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(revisionRoot, "comprehension.json"), derivativeBytes);

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
    if (url.startsWith("/v1/media/outline-tasks/") && request.method === "GET") {
      // The AUTHENTICATED task state route: the ORDER-2 diagnostic canary
      // reads the terminal state and the terminal failure code here.
      send(200, {
        ok: true,
        data: {
          task: {
            taskId: TASK_ID,
            state: "ready",
            revision: 7,
            terminalFailureCode: null,
          },
        },
        error: null,
      });
      return;
    }
    if (url.startsWith("/v1/media/outline-tasks")) {
      send(201, { ok: true, data: { task: { task_id: TASK_ID, revision: 7 } }, error: null });
      return;
    }
    if (url.includes("/evidence/") && url.endsWith("/thumbnail")) {
      if (!thumbnailAvailable) {
        send(404, { ok: false, data: null, error: { code: "V351_THUMBNAIL_NOT_FOUND", message: "" } });
        return;
      }
      response.writeHead(200, { "content-type": "image/png" });
      response.end(PNG_BYTES);
      return;
    }
    if (url.includes("/comprehension") && !url.includes("synthesize")) {
      if (!workspaceAvailable) {
        send(404, { ok: false, data: null, error: { code: "NOT_FOUND", message: "" } });
        return;
      }
      send(200, {
        ok: true,
        data: {
          projection: {
            schemaVersion: "v3-media-workspace-comprehension-projection/v2",
            task: {
              taskId: TASK_ID,
              taskRevision: 7,
              sourceIdentity,
              mediaDurationMs: 1900,
              outlineId: `outline_${"c".repeat(26)}`,
            },
            evidenceCatalog: ordered.map((item) => ({
              ...item,
              excerpt: item.evidenceId,
            })),
          },
        },
        error: null,
      });
      return;
    }
    if (url.includes("/comprehension/synthesize")) {
      if (synthesizeFailureCode) {
        send(422, { ok: false, data: null, error: { code: synthesizeFailureCode, message: "" } });
        return;
      }
      send(200, {
        ok: true,
        data: { projection: { schemaVersion: "v3-media-grounded-comprehension/v2.1" } },
        error: null,
      });
      return;
    }
    send(404, { ok: false, data: null, error: { code: "NOT_FOUND", message: "" } });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

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

async function driveRunner({
  workspaceAvailable = true,
  thumbnailAvailable = true,
  privateRoot = true,
  catalogHashMismatch = false,
  order = "1",
  canary = false,
  synthesizeFailureCode = null,
} = {}) {
  const evidenceRoot = makeTempRoot("navia-b6a-evidence-");
  const stageRoot = makeTempRoot("navia-b6a-stage-");
  const mediaTaskRoot = makeTempRoot("navia-b6a-media-");
  const privateRootDirectory = privateRoot ? makeTempRoot("navia-b6a-private-") : null;
  // The GC-B6C canary mode may only drive the FROZEN order 2.
  const bvid = order === "2" ? FROZEN_SIX[1].bvid : BVID;
  const sourceIdentity = `portal:bilibili:${bvid}:41828944992:p1`;
  const dbPath = path.join(mediaTaskRoot, "runtime.sqlite3");
  fs.writeFileSync(dbPath, "");
  // The task row the runner polls for. It is written with the SAME schema the
  // production store creates.
  const sql = [
    "CREATE TABLE media_source_authority(task_id TEXT, source_identity TEXT, state TEXT, consent_policy_id TEXT, updated_at TEXT);",
    `INSERT INTO media_source_authority VALUES('${TASK_ID}', '${sourceIdentity}', 'active', 'bilibili-media-consent/v1', '2026-10-25T00:00:00Z');`,
    "CREATE TABLE media_tasks(task_id TEXT, state TEXT, revision INTEGER);",
    `INSERT INTO media_tasks VALUES('${TASK_ID}', 'ready', 7);`,
  ].join(" ");
  const seeded = spawnSync("sqlite3", [dbPath, sql], { encoding: "utf8" });
  if (seeded.status !== 0) throw new Error(`sqlite3 failed: ${seeded.stderr}`);
  // The SYNTHETIC cookie file. No real Cookie material is read: the value
  // below is a fabricated placeholder.
  const cookieFile = path.join(mediaTaskRoot, "synthetic-cookies.txt");
  fs.writeFileSync(
    cookieFile,
    ".bilibili.com\tTRUE\t/\tTRUE\t0\tSESSDATA\tsynthetic-offline-value\n",
    { mode: 0o600 },
  );
  const { server, url } = await startDouble({
    mediaTaskRoot,
    workspaceAvailable,
    thumbnailAvailable,
    catalogHashMismatch,
    synthesizeFailureCode,
    bvid,
    sourceIdentity,
  });
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: `b6a-lifecycle-${Math.random().toString(36).slice(2)}`,
    runId: "b6a-run",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: FROZEN_SIX,
  });
  const grant = consumed.grants.find((item) => item.order === order);
  try {
    const runnerArgs = [
      `--order=${order}`,
      `--bvid=${bvid}`,
      "--run-id=b6a-run",
      `--evidence-root=${evidenceRoot}`,
      `--grant-id=${grant.grantId}`,
      `--authorization-digest=${consumed.digest}`,
    ];
    if (canary) runnerArgs.push("--canary=order2-diagnostic");
    const completed = await runRunner(runnerArgs, {
      NAVIA_B5_STAGE_ROOT: stageRoot,
      NAVIA_B5_TEST_RUNTIME_URL: url,
      NAVIA_B5_TEST_DB_PATH: dbPath,
      NAVIA_B5_TEST_MEDIA_TASK_ROOT: mediaTaskRoot,
      NAVIA_B5_TEST_NO_BROWSER: "1",
      NAVIA_B6_PRIVATE_ROOT: privateRootDirectory ?? "",
      NAVIA_BILIBILI_COOKIE_FILE: cookieFile,
    });
    const bvidDir = path.join(evidenceRoot, `bvid-${order}-${bvid}`);
    const receipt = fs.existsSync(path.join(bvidDir, "b5-source-receipt.json"))
      ? JSON.parse(fs.readFileSync(path.join(bvidDir, "b5-source-receipt.json"), "utf8"))
      : null;
    return {
      completed,
      receipt,
      evidenceRoot,
      bvidDir,
      mediaTaskRoot,
      privateRootDirectory,
      stageRoot,
    };
  } finally {
    server.close();
  }
}

test("B6 lifecycle 1/6: the capture closes AFTER the publication and BEFORE the cleanup", async () => {
  const run = await driveRunner({});
  assert.equal(run.completed.status, 0, `the runner must succeed: ${run.completed.stderr} ${run.completed.stdout}`);
  assert.ok(run.receipt, "the machine receipt must exist");
  // The capture receipt is IN the machine receipt: the publication was
  // validated before the capture ran.
  assert.ok(run.receipt.reviewCapture, `the machine receipt must carry the capture receipt: ${run.completed.stdout} ${run.completed.stderr}`);
  assert.equal(run.receipt.reviewCapture.status, "captured");
  assert.deepEqual(run.receipt.reviewCaptureFailureCodes, []);
  // The private bundle is OUTSIDE the runner's scratch and it still exists:
  // the capture ran BEFORE the cleanup and its output survived it.
  assert.ok(run.privateRootDirectory, "the private root must exist");
  const directory = path.join(run.privateRootDirectory, `1-${BVID}`);
  assert.ok(fs.existsSync(path.join(directory, "PRIVATE_MANIFEST.sha256")), "the bundle must exist");
  // The capture READ the derived evidence and the owner cleanup still ran.
  assert.ok(run.receipt.reviewCapture.counts.evidence > 0, "the capture must read the derived evidence");
  const cleanup = JSON.parse(fs.readFileSync(path.join(run.bvidDir, "cleanup.json"), "utf8"));
  assert.equal(cleanup.runtimeScratchDeleted, true, "the owner cleanup must have run");
  assert.equal(cleanup.profileRootDeleted, true, "the owner cleanup must have removed the profile");
});

test("B6 lifecycle 2/6: a capture failure fails the candidate CLOSED", async () => {
  const run = await driveRunner({ workspaceAvailable: false });
  assert.notEqual(run.completed.status, 0, "a capture failure must exit non-zero");
  assert.ok(run.receipt, "the machine receipt must exist");
  assert.equal(run.receipt.disposition, "failed");
  // The failure code is the SPECIFIC capture refusal, never a generic one.
  assert.match(run.receipt.failureCode, /^B6_CAPTURE_[A-Z_]+$/);
  assert.equal(run.receipt.failureCode, "B6_CAPTURE_WORKSPACE_UNAVAILABLE");
  assert.equal(run.receipt.reviewCapture.status, "failed");
  assert.deepEqual(run.receipt.reviewCaptureFailureCodes, ["B6_CAPTURE_WORKSPACE_UNAVAILABLE"]);
});

test("B6 lifecycle: a validation refusal persists stable closure codes only", async () => {
  const run = await driveRunner({ catalogHashMismatch: true });
  assert.notEqual(run.completed.status, 0);
  assert.equal(run.receipt.failureCode, "B6_CAPTURE_BUNDLE_INVALID");
  assert.deepEqual(run.receipt.reviewCaptureFailureCodes, [
    "B6_BUNDLE_CATALOG_HASH_MISMATCH",
    "B6_BUNDLE_RECEIPT_INVALID",
  ]);
  assert.ok(run.receipt.reviewCaptureFailureCodes.every((code) => /^B6_[A-Z_]+$/.test(code)));
});

test("B6 lifecycle 3/6: a capture failure still runs the owner cleanup", async () => {
  const run = await driveRunner({ thumbnailAvailable: false });
  assert.notEqual(run.completed.status, 0, "a capture failure must exit non-zero");
  const cleanup = JSON.parse(fs.readFileSync(path.join(run.bvidDir, "cleanup.json"), "utf8"));
  assert.equal(cleanup.runtimeScratchDeleted, true);
  assert.equal(cleanup.profileRootDeleted, true);
});

test("B6 lifecycle 4/6: the public receipt carries ONLY the bundle hash, the counts and the status", async () => {
  const run = await driveRunner({});
  const capture = run.receipt.reviewCapture;
  assert.deepEqual(Object.keys(capture).sort(), [
    "closure", "counts", "digests", "schemaVersion", "status",
  ]);
  const serialized = JSON.stringify(capture);
  assert.ok(!serialized.includes("minimax"), "the capture receipt must not carry the Provider identity");
  assert.ok(!serialized.includes("第 1 段"), "the capture receipt must not carry a text");
  assert.ok(!serialized.includes(".png"), "the capture receipt must not carry a file name");
  assert.ok(!serialized.includes("/tmp"), "the capture receipt must not carry a private path");
  assert.equal(capture.digests.bundleSha256.length, 64);
});

test("B6 lifecycle 5/6: the private root is 0700 and OUTSIDE the repository", async () => {
  const run = await driveRunner({});
  const directory = path.join(run.privateRootDirectory, `1-${BVID}`);
  assert.equal(fs.statSync(run.privateRootDirectory).mode & 0o777, 0o700, "the private root must be 0700");
  assert.equal(fs.statSync(directory).mode & 0o777, 0o700, "the private bundle must be 0700");
  assert.ok(!run.privateRootDirectory.startsWith(repoRoot), "the private root must be outside the repository");
  assert.ok(!fs.existsSync(path.join(repoRoot, "docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6a-private-root")), "no private bundle may live in the evidence tree");
});

test("B6 lifecycle: the capture call site is AFTER the publication and BEFORE the owner cleanup", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  // The DURABLE publication is the published derivative bytes. The
  // `sourceCompletion` accounting comes AFTER the capture: a capture failure
  // must never leave a completed-source accounting behind.
  const publication = source.indexOf("publishedDerivativeBytes = derivativeBytes;");
  const capture = source.indexOf("captureFromRuntime({");
  const completion = source.indexOf('ledger.record("sourceCompletion"');
  const cleanup = source.indexOf("scratch rm failed");
  assert.ok(publication >= 0, "the durable publication must exist");
  assert.ok(capture > publication, "the capture must run AFTER the durable publication");
  assert.ok(cleanup > capture, "the owner cleanup must run AFTER the capture");
  assert.ok(completion > capture, "the completion accounting must run AFTER the capture");
});

test("B6 lifecycle 6/6: WITHOUT a private root the runner captures NOTHING and starts nothing", async () => {
  const run = await driveRunner({ privateRoot: false });
  assert.equal(run.completed.status, 0, `the runner must succeed: ${run.completed.stderr} ${run.completed.stdout}`);
  assert.equal(run.receipt.reviewCapture, null, "no capture may run without a private root");
  // The external action counters stay at zero.
  assert.equal(run.receipt.audioOutputCount, 0);
  assert.equal(run.receipt.tabCaptureCount, 0);
  assert.equal(run.receipt.cookieInjectionCount, 0);
  for (const [key, value] of Object.entries(run.receipt.uploadCounters)) {
    assert.equal(value, 0, `${key} must be zero`);
  }
  assert.equal(run.receipt.provider.attempted.requestCount, 3, "the double reported three attempts");
});

// ============================================================================
// GC-B6C — the ORDER-2 DIAGNOSTIC CANARY mode of the SAME owner
// ============================================================================

test("B6 lifecycle: the ORDER-2 canary mode writes its observations and NEVER counts a completed source", async () => {
  const run = await driveRunner({ order: "2", canary: true });
  assert.equal(run.completed.status, 0, `the canary mode must succeed: ${run.completed.stderr} ${run.completed.stdout}`);
  const observations = JSON.parse(
    fs.readFileSync(path.join(run.bvidDir, "order2-diagnostic-observations.json"), "utf8"),
  );
  assert.equal(observations.schemaVersion, "v3-5.10-b6c-order2-observations/v1");
  assert.equal(observations.registryOrder, "2");
  assert.equal(observations.bvid, FROZEN_SIX[1].bvid);
  // The terminal state and the evidence kind counts come from the
  // AUTHENTICATED public routes.
  assert.equal(observations.taskState, "ready");
  assert.equal(observations.evidenceKindCounts.transcript, 1);
  assert.equal(observations.evidenceKindCounts.frame, 1);
  assert.equal(observations.evidenceKindCounts.ocr_block, 0);
  assert.equal(observations.evidenceKindCounts.vision_caption, 0);
  // The PNG is confirmed through the AUTHENTICATED thumbnail route and the
  // STRICT PNG validation: a frame ROW is never the proof of a PNG.
  assert.equal(observations.pngConfirmedFrameCount, 1);
  assert.deepEqual(observations.pngFailureCodes, []);
  // The capture still closed and the cleanup still ran.
  assert.equal(observations.capture.status, "captured");
  assert.equal(observations.cleanup.runtimeScratchDeleted, true);
  assert.equal(observations.cleanup.profileRootDeleted, true);
  // A diagnostic is NEVER a completed candidate source: the source
  // completion accounting stays ZERO.
  const ledger = fs.readFileSync(path.join(run.stageRoot, "stage-actions.jsonl"), "utf8");
  const completions = ledger.split("\n").filter((line) => line.includes("\"sourceCompletion\""));
  assert.equal(completions.length, 0, "the canary must never record a source completion");
  assert.equal(observations.actionCounters.sourceCompletionCount, 0);
  // The observations carry NO content, NO path and NO Provider identity.
  const serialized = JSON.stringify(observations);
  for (const forbidden of ["providerId", "modelId", "text", "relativeArtifactRef", "/v1/"]) {
    assert.ok(!serialized.includes(forbidden), `the observations must not carry ${forbidden}`);
  }
});

test("B6 lifecycle: an early frozen synthesis failure still writes a strict non-candidate observation", async () => {
  const run = await driveRunner({
    order: "2",
    canary: true,
    synthesizeFailureCode: "V3510B_CHAPTER_IMBALANCE",
  });
  assert.notEqual(run.completed.status, 0, "the owner failure must remain non-zero");
  const observations = JSON.parse(
    fs.readFileSync(path.join(run.bvidDir, "order2-diagnostic-observations.json"), "utf8"),
  );
  assert.equal(observations.terminalFailureCode, "V3510B_CHAPTER_IMBALANCE");
  assert.ok(observations.observationCodes.includes("CANARY_OWNER_FAILED"));
  assert.equal(observations.taskId, TASK_ID);
  assert.equal(observations.taskState, null);
  assert.equal(observations.capture.status, "failed");
  assert.equal(observations.actionCounters.sourceCompletionCount, 0);
  assert.equal(observations.cleanup.runtimeScratchDeleted, true);
  assert.equal(observations.cleanup.profileRootDeleted, true);
  const ledger = fs.readFileSync(path.join(run.stageRoot, "stage-actions.jsonl"), "utf8");
  assert.equal(ledger.includes('"sourceCompletion"'), false);
});

test("B6 lifecycle: the ORDER-2 canary mode REFUSES another registry order before anything starts", async () => {
  const evidenceRoot = makeTempRoot("navia-b6c-refusal-");
  const result = spawnSync(
    "node",
    [runnerPath, "--order=1", `--bvid=${BVID}`, "--run-id=b6a-canary-refusal", `--evidence-root=${evidenceRoot}`, "--canary=order2-diagnostic"],
    { cwd: repoRoot, encoding: "utf8", timeout: 60_000 },
  );
  assert.notEqual(result.status, 0, "the canary mode must refuse another order");
  assert.ok(result.stderr.includes("CANARY_IDENTITY_REFUSED"), result.stderr);
  assert.ok(
    !fs.existsSync(path.join(evidenceRoot, `bvid-1-${BVID}`)),
    "the refusal must start nothing",
  );
});
