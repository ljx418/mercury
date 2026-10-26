// B6A — the thumbnail / seek closure (8) and the REAL production route
// composition.
//
// The composition case boots the REAL local Runtime, seeds one synthetic
// media task through the PRODUCTION store API and the PRODUCTION outline
// generator, and then drives the PUBLIC workspace route and the
// AUTHENTICATED thumbnail route. The capture is then run against those two
// REAL routes.
//
// No Chrome, no Provider, no download, no Cookie: the seeded evidence is
// synthetic text and one synthetic PNG written where the production
// materializer writes it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { canonicalJson, sha256Hex } from "../lib/v21_artifact.mjs";
import { captureReviewBundle, resolvePrivateFile, resolvePrivateRef } from "../lib/review_capture.mjs";
import {
  REVIEW_BUNDLE_FAILURE,
  deriveCaptureReceipt,
  encodeBundleFiles,
  encodeManifestText,
  evidenceCatalogSha256,
  validateReviewBundle,
} from "../lib/review_bundle.mjs";
import { ACTIVE_REGISTRY_SHA256 } from "../lib/registry.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";
import { buildBundleFixture, PNG_BYTES } from "./_fixtures/b6_bundle_fixture.mjs";
import { buildV21Artifact, frozenReceipt } from "./_fixtures/contract_shaped_stub.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runtimeRoot = path.join(repoRoot, "services/local-runtime");
const runtimePython = path.join(runtimeRoot, ".venv/bin/python");
const seeder = path.join(__dirname, "_fixtures/seed_review_task.py");
const TEST_EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";

function codesOf(bundle) {
  return validateReviewBundle(bundle).failures.map((failure) => failure.code);
}

function assertRefused(bundle, expectedCode) {
  const codes = codesOf(bundle);
  assert.ok(codes.includes(expectedCode), `expected ${expectedCode}, got ${JSON.stringify(codes)}`);
}

// ============================================================================
// Group 3 — the thumbnail / seek mutations (8)
// ============================================================================

test("B6 thumbnail 1/8: a thumbnail that is NOT a PNG is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => { bundle.thumbnails[0].bytes = Buffer.from("not a png", "utf8"); },
    }),
    REVIEW_BUNDLE_FAILURE.THUMBNAIL,
  );
});

test("B6 thumbnail 2/8: an EMPTY thumbnail is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => { bundle.thumbnails[0].bytes = Buffer.alloc(0); },
    }),
    REVIEW_BUNDLE_FAILURE.THUMBNAIL,
  );
});

test("B6 thumbnail: PNG signature prefixed to raw media is refused", () => {
  const bundle = buildBundleFixture({});
  bundle.thumbnails[0].bytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("....ftypisom....raw-media-payload", "ascii"),
  ]);
  bundle.thumbnails[0].sha256 = sha256Hex(bundle.thumbnails[0].bytes);
  bundle.captureReceipt = deriveCaptureReceipt(bundle);
  const files = encodeBundleFiles(bundle);
  bundle.manifest = [...files].map(([name, bytes]) => ({
    path: name,
    sha256: sha256Hex(bytes),
    bytes,
  }));
  bundle.manifestBytes = Buffer.from(encodeManifestText(files), "utf8");
  assertRefused(bundle, REVIEW_BUNDLE_FAILURE.THUMBNAIL);
});

test("B6 thumbnail 3/8: a DUPLICATE thumbnail is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        bundle.thumbnails.push({ ...bundle.thumbnails[0], bytes: Buffer.from(bundle.thumbnails[0].bytes) });
      },
    }),
    REVIEW_BUNDLE_FAILURE.DUPLICATE,
  );
});

test("B6 thumbnail 4/8: a thumbnail WITHOUT an evidence record is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        bundle.thumbnails[0].evidenceId = "mtr_ffffffffffffffffffffffffffffffff";
      },
    }),
    REVIEW_BUNDLE_FAILURE.EVIDENCE_MISSING,
  );
});

test("B6 seek 5/8: a seek time OUTSIDE the media is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => { bundle.seekMap.chapters[0].seekTimeMs = 999_999; },
    }),
    REVIEW_BUNDLE_FAILURE.SEEK,
  );
});

test("B6 seek 6/8: a chapter that ENDS BEFORE it starts is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        bundle.seekMap.chapters[0].startMs = 3_000;
        bundle.seekMap.chapters[0].endMs = 1_000;
      },
    }),
    REVIEW_BUNDLE_FAILURE.SEEK,
  );
});

test("B6 seek 7/8: a seek chapter that references a MISSING evidence id is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        bundle.seekMap.chapters[0].evidenceIds = ["mtr_ffffffffffffffffffffffffffffffff"];
      },
    }),
    REVIEW_BUNDLE_FAILURE.EVIDENCE_MISSING,
  );
});

test("B6 seek 8/8: a seek map WITHOUT a media duration is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => { bundle.seekMap.mediaDurationMs = null; },
    }),
    REVIEW_BUNDLE_FAILURE.SEEK,
  );
});

// ============================================================================
// The REAL production route composition
// ============================================================================

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
  throw new Error(`the runtime on port ${port} did not become healthy`);
}

test("B6 composition: the capture runs against the REAL workspace and thumbnail routes", async () => {
  const port = await freePort();
  const scratch = makeTempRoot("navia-b6a-runtime-");
  const dbPath = path.join(scratch, "b6a-runtime.sqlite3");
  fs.writeFileSync(dbPath, "");
  fs.chmodSync(dbPath, 0o600);
  const mediaTaskRoot = path.join(scratch, "media-tasks");
  fs.mkdirSync(mediaTaskRoot, { mode: 0o700, recursive: true });

  const runtime = spawn(runtimePython, [
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
  runtime.stderr.on("data", () => { /* swallow */ });
  try {
    // The Runtime boot is slow under a concurrent suite: the wait is
    // generous and the route calls are retried.
    await waitForRuntime(port, 90_000);
    const seeded = JSON.parse(execFileSync(runtimePython, [seeder], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NAVIA_DB_PATH: dbPath,
        NAVIA_MEDIA_TASK_ROOT: mediaTaskRoot,
      },
    }).trim().split("\n").pop());
    const taskId = seeded.taskId;

    // The companion session: the AUTHENTICATION the product requires.
    const sessionRes = await fetch(`http://127.0.0.1:${port}/v1/companion/sessions`, {
      method: "POST",
      headers: { origin: `chrome-extension://${TEST_EXTENSION_ID}` },
    });
    assert.equal(sessionRes.status, 201);
    const bearer = (await sessionRes.json())?.data?.token;
    assert.ok(bearer, "the companion session must issue a bearer");
    const authHeaders = {
      origin: `chrome-extension://${TEST_EXTENSION_ID}`,
      authorization: `Bearer ${bearer}`,
    };

    // 1. The PUBLIC workspace route.
    const fetchWithRetry = async (url, init) => {
      let last = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        last = await fetch(url, init);
        if (last.status < 500) return last;
        await new Promise((r) => setTimeout(r, 400));
      }
      return last;
    };
    const workspaceRes = await fetchWithRetry(
      `http://127.0.0.1:${port}/v1/media/tasks/${taskId}/comprehension`,
      { headers: authHeaders },
    );
    assert.equal(workspaceRes.status, 200, `the workspace route must answer 200`);
    const workspace = (await workspaceRes.json())?.data?.projection;
    assert.ok(workspace, "the workspace route must return the projection");
    assert.equal(workspace.task.taskId, taskId);
    assert.ok(Array.isArray(workspace.evidenceCatalog), "the projection must carry the evidence catalog");
    assert.ok(workspace.evidenceCatalog.length >= 1, "the catalog must not be empty");

    // 2. The AUTHENTICATED thumbnail route.
    const thumbnailEvidenceId = seeded.thumbnailEvidenceId;
    const thumbnailRes = await fetch(
      `http://127.0.0.1:${port}/v1/media/tasks/${taskId}/evidence/${thumbnailEvidenceId}/thumbnail`,
      { headers: authHeaders },
    );
    assert.equal(thumbnailRes.status, 200, "the thumbnail route must answer 200");
    const thumbnailBytes = Buffer.from(await thumbnailRes.arrayBuffer());
    assert.ok(thumbnailBytes.length > 8, "the thumbnail route must return real bytes");

    // 3. The capture, driven by the REAL routes and the runner-owned private
    //    root. The derived text is read EXACTLY by the relative ref the
    //    workspace declares.
    const privateRoot = path.join(mediaTaskRoot, "product-evidence");
    const readDerivedText = async (relativeRef) => {
      // The STRICT resolution: the realpath containment is proven, not
      // assumed.
      const target = resolvePrivateFile(privateRoot, relativeRef);
      assert.ok(target, "the relative ref must resolve inside the private root");
      return JSON.parse(fs.readFileSync(target, "utf8"));
    };
    const fetchThumbnail = async (evidenceId) => {
      const res = await fetch(
        `http://127.0.0.1:${port}/v1/media/tasks/${taskId}/evidence/${evidenceId}/thumbnail`,
        { headers: authHeaders },
      );
      if (!res.ok) throw new Error(`the thumbnail route answered ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    };

    // The durable derivative bytes: the capture only needs a CONTRACT-SHAPED
    // derivative whose catalog hash is the captured one.
    const capturedCatalog = workspace.evidenceCatalog.map((item) => ({
      evidenceId: item.evidenceId,
      contentSha256: item.contentSha256,
      timestampStartMs: item.timestampStartMs,
      timestampEndMs: item.timestampEndMs,
    }));
    assert.ok(
      capturedCatalog.some((left, leftIndex) => capturedCatalog.some((right, rightIndex) => (
        leftIndex !== rightIndex
        && left.timestampStartMs === right.timestampStartMs
        && left.timestampEndMs !== right.timestampEndMs
      ))),
      "the real-shaped catalog must contain a same-start/different-end tie",
    );
    for (let index = 1; index < capturedCatalog.length; index += 1) {
      const previous = capturedCatalog[index - 1];
      const current = capturedCatalog[index];
      const comparison = previous.timestampStartMs - current.timestampStartMs
        || previous.timestampEndMs - current.timestampEndMs
        || previous.evidenceId.localeCompare(current.evidenceId);
      assert.ok(comparison <= 0, "the real Runtime route must expose the production (start, end, id) order");
    }
    const productionOrderedHash = sha256Hex(canonicalJson(
      [...capturedCatalog]
        .sort((left, right) => (
          left.timestampStartMs - right.timestampStartMs
          || left.timestampEndMs - right.timestampEndMs
          || left.evidenceId.localeCompare(right.evidenceId)
        ))
        .map((item) => ({
          evidenceId: item.evidenceId,
          contentSha256: item.contentSha256,
          timestampStartMs: item.timestampStartMs,
          timestampEndMs: item.timestampEndMs,
        })),
    ));
    assert.equal(evidenceCatalogSha256(capturedCatalog), productionOrderedHash);
    const derivative = buildV21Artifact({
      taskId: workspace.task.taskId,
      taskRevision: workspace.task.taskRevision,
      sourceIdentity: workspace.task.sourceIdentity,
      receipt: frozenReceipt({ requestCount: 3 }),
      evidenceIds: capturedCatalog.map((item) => item.evidenceId),
      claimIds: [`claim_${"1".repeat(16)}`, `claim_${"2".repeat(16)}`],
      chapterIds: [`chapter_${"3".repeat(16)}`, `chapter_${"4".repeat(16)}`],
    });
    derivative.binding.evidenceCatalogSha256 = evidenceCatalogSha256(capturedCatalog);
    // The chapter windows must lie inside the REAL media duration.
    derivative.chapters[0].startMs = capturedCatalog[0].timestampStartMs;
    derivative.chapters[0].endMs = capturedCatalog[1].timestampEndMs;
    derivative.chapters[1].startMs = capturedCatalog[2].timestampStartMs;
    derivative.chapters[1].endMs = capturedCatalog[3].timestampEndMs;
    const artifactBytes = Buffer.from(canonicalJson(derivative), "utf8");

    const privateBundleRoot = path.join(scratch, "private-review-root");
    fs.mkdirSync(privateBundleRoot, { mode: 0o700, recursive: true });
    const captured = await captureReviewBundle({
      source: {
        order: "1",
        bvid: workspace.task.sourceIdentity.split(":")[2],
        taskId: workspace.task.taskId,
        taskRevision: workspace.task.taskRevision,
        sourceIdentity: workspace.task.sourceIdentity,
        dependencyGeneration: `depgen_${sha256Hex(taskId)}`,
        registrySha256: ACTIVE_REGISTRY_SHA256,
      },
      artifactBytes,
      workspace,
      readDerivedText,
      fetchThumbnail,
      privateRootDirectory: privateBundleRoot,
    });
    assert.equal(captured.ok, true, `the capture must close: ${captured.detail ?? ""}`);
    assert.ok(captured.bundle, "the capture must return the bundle");
    assert.ok(captured.bundle.evidence.length >= 1, "the capture must carry the derived text");
    assert.ok(captured.bundle.thumbnails.length >= 1, "the capture must carry the PNG");
    assert.equal(
      captured.bundle.thumbnails[0].bytes.equals(thumbnailBytes),
      true,
      "the captured thumbnail must be the bytes the route served",
    );
    // The PRIVATE root is 0700 and holds the contracted file set.
    const directory = path.join(privateBundleRoot, "1-" + workspace.task.sourceIdentity.split(":")[2]);
    assert.equal(fs.statSync(directory).mode & 0o777, 0o700, "the private bundle must be 0700");
    for (const name of ["artifact.json", "workspace.json", "evidence.jsonl", "seek-map.json", "capture-receipt.json", "source.json", "PRIVATE_MANIFEST.sha256"]) {
      assert.ok(fs.existsSync(path.join(directory, name)), `the bundle must hold ${name}`);
    }
    // The PUBLIC receipt carries hashes, counts and a status ONLY.
    const receipt = captured.receipt;
    assert.deepEqual(Object.keys(receipt).sort(), [
      "closure", "counts", "digests", "schemaVersion", "status",
    ]);
    assert.ok(!JSON.stringify(receipt).includes("providerId"));
    assert.ok(!JSON.stringify(receipt).includes("minimax"));
    assert.ok(!receipt.digests.bundleSha256.includes("/"));
  } finally {
    runtime.kill("SIGINT");
    await new Promise((r) => setTimeout(r, 800));
    if (runtime.exitCode === null) runtime.kill("SIGKILL");
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test("B6 composition: the relative ref resolution never escapes the private root", () => {
  assert.equal(resolvePrivateRef("/tmp/root", "../escape"), null);
  assert.equal(resolvePrivateRef("/tmp/root", "/etc/passwd"), null);
  assert.equal(resolvePrivateRef("/tmp/root", "evidence/task/0001.json"), "/tmp/root/evidence/task/0001.json");
  assert.equal(resolvePrivateRef("/tmp/root", ""), null);
});
