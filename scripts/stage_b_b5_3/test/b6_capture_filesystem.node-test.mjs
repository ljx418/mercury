// B6A — the FILESYSTEM transaction of the private bundle capture.
//
// The oracle is the PRODUCTION capture adapter
// (`lib/review_capture.mjs`) on a REAL filesystem: a real temporary root
// outside the repository, real files, real symlinks and a real rename.
//
// The covered defect classes are the ones of the Codex finding: an
// inside-repository root, a symlinked root, a symlinked component, a
// pre-existing destination, a traversing manifest name, a non-regular
// payload, an undeclared payload and an interruption at EVERY write and
// rename boundary.
//
// No Chrome, no Runtime, no Provider, no download, no Cookie.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CAPTURE_FAILURE,
  CAPTURE_INTERRUPT_POINTS,
  REPO_ROOT,
  captureReviewBundle,
  readReviewBundle,
  resolveCaptureRoot,
  resolvePrivateFile,
  resolvePrivateRef,
} from "../lib/review_capture.mjs";
import { REVIEW_BUNDLE_MANIFEST, REVIEW_BUNDLE_THUMBNAIL_DIR } from "../lib/review_bundle.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";
import { buildBundleFixture } from "./_fixtures/b6_bundle_fixture.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The capture inputs of the fixture bundle, with NO product route. */
function captureInputs(bundle, privateRootDirectory) {
  return {
    source: bundle.source,
    artifactBytes: bundle.artifact,
    workspace: bundle.workspace,
    readDerivedText: async (relativeRef) => {
      const evidenceId = path.basename(relativeRef, ".json");
      const record = bundle.evidence.find((item) => item.evidenceId === evidenceId);
      if (!record) return null;
      return {
        text: record.text,
        thumbnailRelativeRef: record.thumbnailAvailable
          ? `${REVIEW_BUNDLE_THUMBNAIL_DIR}/${record.evidenceId}.png`
          : null,
      };
    },
    fetchThumbnail: async (evidenceId) => {
      const item = bundle.thumbnails.find((entry) => entry.evidenceId === evidenceId);
      return item ? item.bytes : null;
    },
    privateRootDirectory,
  };
}

/** A real capture root outside the repository. */
function captureRoot() {
  const root = path.join(makeTempRoot("navia-b6a-fs-"), "private-root");
  fs.mkdirSync(root, { mode: 0o700 });
  fs.chmodSync(root, 0o700);
  return root;
}

// ============================================================================
// Group 7 — the root containment
// ============================================================================

test("B6 fs 1: a root INSIDE the repository is refused", () => {
  const verdict = resolveCaptureRoot(REPO_ROOT);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, CAPTURE_FAILURE.ROOT);
  assert.match(verdict.detail, /inside the repository/);
});

test("B6 fs 2: a root that is a SYMLINK is refused", () => {
  const scratch = makeTempRoot("navia-b6a-fs-");
  const real = path.join(scratch, "real-root");
  fs.mkdirSync(real, { mode: 0o700 });
  const link = path.join(scratch, "link-root");
  fs.symlinkSync(real, link);
  const verdict = resolveCaptureRoot(link);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, CAPTURE_FAILURE.ROOT);
  assert.match(verdict.detail, /symbolic(?:-| )link/);
});

test("B6 fs: a root reached through a SYMLINKED parent is refused", () => {
  const scratch = makeTempRoot("navia-b6a-fs-");
  const realParent = path.join(scratch, "real-parent");
  const realRoot = path.join(realParent, "private-root");
  fs.mkdirSync(realRoot, { recursive: true, mode: 0o700 });
  fs.chmodSync(realRoot, 0o700);
  const parentLink = path.join(scratch, "parent-link");
  fs.symlinkSync(realParent, parentLink);
  const verdict = resolveCaptureRoot(path.join(parentLink, "private-root"));
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, CAPTURE_FAILURE.ROOT);
  assert.match(verdict.detail, /symbolic-link component/);
});

test("B6 fs 3: a root that is ACCESSIBLE BY OTHERS is refused", () => {
  const scratch = makeTempRoot("navia-b6a-fs-");
  const root = path.join(scratch, "open-root");
  fs.mkdirSync(root, { mode: 0o755 });
  const verdict = resolveCaptureRoot(root);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, CAPTURE_FAILURE.ROOT);
  assert.match(verdict.detail, /group or by others/);
});

test("B6 fs 4: a root that does not exist is refused", () => {
  const scratch = makeTempRoot("navia-b6a-fs-");
  const verdict = resolveCaptureRoot(path.join(scratch, "absent"));
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, CAPTURE_FAILURE.ROOT);
});

test("B6 fs 5: a RELATIVE root is refused", () => {
  const verdict = resolveCaptureRoot("relative/root");
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, CAPTURE_FAILURE.ROOT);
});

// ============================================================================
// Group 8 — the private ref containment
// ============================================================================

test("B6 fs 6: the strict resolution stays INSIDE the root", () => {
  const scratch = makeTempRoot("navia-b6a-fs-");
  const root = path.join(scratch, "evidence-root");
  fs.mkdirSync(path.join(root, "evidence", "task"), { recursive: true, mode: 0o700 });
  const target = path.join(root, "evidence", "task", "0001.json");
  fs.writeFileSync(target, "{}", { mode: 0o600 });
  assert.equal(resolvePrivateFile(root, "evidence/task/0001.json"), target);
  // The LEXICAL resolution may never leave the root either.
  assert.equal(resolvePrivateRef(root, "../escape"), null);
  assert.equal(resolvePrivateRef(root, "/etc/passwd"), null);
  assert.equal(resolvePrivateRef(root, "evidence/task/../../escape"), null);
  assert.equal(resolvePrivateFile(root, "evidence/task/missing.json"), null);
});

test("B6 fs 7: a SYMLINKED component is refused", () => {
  const scratch = makeTempRoot("navia-b6a-fs-");
  const root = path.join(scratch, "evidence-root");
  const outside = path.join(scratch, "outside");
  fs.mkdirSync(root, { mode: 0o700 });
  fs.mkdirSync(outside, { mode: 0o700 });
  fs.writeFileSync(path.join(outside, "secret.json"), "{}", { mode: 0o600 });
  fs.symlinkSync(outside, path.join(root, "evidence"));
  // The symlinked component is refused: the resolution may never leave the
  // root through a link.
  assert.equal(resolvePrivateRef(root, "evidence/secret.json"), null);
  assert.equal(resolvePrivateFile(root, "evidence/secret.json"), null);
});

// ============================================================================
// Group 9 — the transaction
// ============================================================================

test("B6 fs 8: a successful capture publishes ATOMICALLY and leaves no staging", async () => {
  const root = captureRoot();
  const bundle = buildBundleFixture({});
  const captured = await captureReviewBundle(captureInputs(bundle, root));
  assert.equal(captured.ok, true, captured.detail ?? "");
  const directory = path.join(root, `${bundle.source.order}-${bundle.source.bvid}`);
  assert.equal(fs.existsSync(directory), true, "the bundle must be published");
  assert.equal(fs.statSync(directory).mode & 0o777, 0o700, "the published bundle must be 0700");
  for (const name of ["artifact.json", "workspace.json", "evidence.jsonl", "seek-map.json", "capture-receipt.json", "source.json", REVIEW_BUNDLE_MANIFEST]) {
    assert.equal(fs.existsSync(path.join(directory, name)), true, `the bundle must hold ${name}`);
  }
  // No staging residue is left behind.
  const residue = fs.readdirSync(root).filter((name) => name.startsWith(".staging-"));
  assert.deepEqual(residue, [], "the transaction must leave no staging residue");
  // The published bundle re-reads and validates.
  const reread = readReviewBundle(directory);
  assert.equal(reread.source.bvid, bundle.source.bvid);
});

test("B6 fs 9: a PRE-EXISTING destination is refused and never overwritten", async () => {
  const root = captureRoot();
  const bundle = buildBundleFixture({});
  const directory = path.join(root, `${bundle.source.order}-${bundle.source.bvid}`);
  fs.mkdirSync(directory, { mode: 0o700 });
  const marker = path.join(directory, "OWNED-BY-SOMEONE-ELSE.txt");
  fs.writeFileSync(marker, "keep me", { mode: 0o600 });
  const captured = await captureReviewBundle(captureInputs(bundle, root));
  assert.equal(captured.ok, false);
  assert.equal(captured.code, CAPTURE_FAILURE.DESTINATION);
  assert.equal(fs.readFileSync(marker, "utf8"), "keep me", "the existing content must survive");
  assert.equal(fs.readdirSync(directory).length, 1, "the existing directory must not be written into");
});

test("B6 fs 10: an INTERRUPTION at every boundary leaves NO published bundle", async () => {
  for (const point of CAPTURE_INTERRUPT_POINTS) {
    const root = captureRoot();
    const bundle = buildBundleFixture({});
    const captured = await captureReviewBundle({
      ...captureInputs(bundle, root),
      interruptAt: point,
    });
    assert.equal(captured.ok, false, `the interruption at ${point} must fail the capture`);
    assert.equal(captured.code, CAPTURE_FAILURE.WRITE);
    const directory = path.join(root, `${bundle.source.order}-${bundle.source.bvid}`);
    assert.equal(fs.existsSync(directory), false, `the interruption at ${point} must publish nothing`);
    const residue = fs.readdirSync(root);
    assert.deepEqual(residue, [], `the interruption at ${point} must remove the owned staging directory`);
  }
});

test("B6 fs 11: the READER refuses a TRAVERSING manifest path", () => {
  const scratch = makeTempRoot("navia-b6a-fs-");
  const directory = path.join(scratch, "bundle");
  fs.mkdirSync(directory, { mode: 0o700 });
  fs.writeFileSync(
    path.join(directory, REVIEW_BUNDLE_MANIFEST),
    `${"0".repeat(64)}  ../../etc/passwd\n`,
    { mode: 0o600 },
  );
  assert.throws(() => readReviewBundle(directory), /invalid path/);
});

test("B6 fs 12: the READER refuses a SYMLINKED payload", () => {
  const scratch = makeTempRoot("navia-b6a-fs-");
  const directory = path.join(scratch, "bundle");
  fs.mkdirSync(directory, { mode: 0o700 });
  const outside = path.join(scratch, "outside.json");
  fs.writeFileSync(outside, "{}", { mode: 0o600 });
  fs.symlinkSync(outside, path.join(directory, "source.json"));
  fs.writeFileSync(
    path.join(directory, REVIEW_BUNDLE_MANIFEST),
    `${"0".repeat(64)}  source.json\n`,
    { mode: 0o600 },
  );
  assert.throws(() => readReviewBundle(directory), /unreadable payload/);
});

test("B6 fs 13: the READER refuses an UNDECLARED payload", async () => {
  const root = captureRoot();
  const bundle = buildBundleFixture({});
  const captured = await captureReviewBundle(captureInputs(bundle, root));
  assert.equal(captured.ok, true, captured.detail ?? "");
  const directory = path.join(root, `${bundle.source.order}-${bundle.source.bvid}`);
  fs.writeFileSync(path.join(directory, "stray.txt"), "x", { mode: 0o600 });
  assert.throws(() => readReviewBundle(directory), /undeclared file/);
});

test("B6 fs 14: the READER refuses a MISSING contracted payload", async () => {
  const root = captureRoot();
  const bundle = buildBundleFixture({});
  const captured = await captureReviewBundle(captureInputs(bundle, root));
  assert.equal(captured.ok, true, captured.detail ?? "");
  const directory = path.join(root, `${bundle.source.order}-${bundle.source.bvid}`);
  fs.unlinkSync(path.join(directory, "seek-map.json"));
  assert.throws(() => readReviewBundle(directory), /unreadable payload: seek-map\.json/);
});
