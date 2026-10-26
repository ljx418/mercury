// B6A — the REVIEWABLE seek closure.
//
// The oracle is the PRODUCTION seek builder and the PRODUCTION bundle
// validator. Every derivative chapter maps ONE-TO-ONE to a seek row, the row
// repeats the exact chapter id, order, window and evidence set, the seek
// time lies inside [startMs, endMs) and the representative is a REAL
// PNG-backed frame of the same task.
//
// The covered defect classes are the ones of the Codex finding: a
// zero-length window, a seek time outside its own chapter, a missing, an
// extra and a reordered chapter, a non-frame representative and a chapter
// without any frame.
//
// No Chrome, no Runtime, no Provider, no download, no Cookie.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { CAPTURE_FAILURE, buildSeekMap, captureReviewBundle } from "../lib/review_capture.mjs";
import { REVIEW_BUNDLE_FAILURE, validateReviewBundle } from "../lib/review_bundle.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";
import { buildBundleFixture } from "./_fixtures/b6_bundle_fixture.mjs";

function codesOf(bundle) {
  return validateReviewBundle(bundle).failures.map((failure) => failure.code);
}

function assertRefused(bundle, expectedCode) {
  const codes = codesOf(bundle);
  assert.ok(codes.includes(expectedCode), `expected ${expectedCode}, got ${JSON.stringify(codes)}`);
}

/** The derivative of a fixture bundle. */
function derivativeOf(bundle) {
  return JSON.parse(bundle.artifact.toString("utf8"));
}

// ============================================================================
// Group 10 — the seek row mutations
// ============================================================================

test("B6 seekcls 1: a ZERO-LENGTH window is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        bundle.seekMap.chapters[0].endMs = bundle.seekMap.chapters[0].startMs;
        bundle.seekMap.chapters[0].seekTimeMs = bundle.seekMap.chapters[0].startMs;
      },
    }),
    REVIEW_BUNDLE_FAILURE.SEEK,
  );
});

test("B6 seekcls 2: a seek time OUTSIDE its own chapter is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        // The time is inside the media but outside the chapter window.
        bundle.seekMap.chapters[1].seekTimeMs = bundle.seekMap.chapters[0].startMs;
      },
    }),
    REVIEW_BUNDLE_FAILURE.SEEK,
  );
});

test("B6 seekcls 3: a MISSING chapter is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => { bundle.seekMap.chapters.pop(); },
    }),
    REVIEW_BUNDLE_FAILURE.SEEK,
  );
});

test("B6 seekcls 4: an EXTRA chapter is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        bundle.seekMap.chapters.push({ ...bundle.seekMap.chapters[0], chapterId: "chapter_ffffffffffffffff" });
      },
    }),
    REVIEW_BUNDLE_FAILURE.SEEK,
  );
});

test("B6 seekcls 5: a REORDERED chapter is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        const chapters = bundle.seekMap.chapters;
        [chapters[0], chapters[1]] = [chapters[1], chapters[0]];
      },
    }),
    REVIEW_BUNDLE_FAILURE.SEEK,
  );
});

test("B6 seekcls 6: a NON-FRAME representative is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        // The first evidence is a transcript, not a frame.
        bundle.seekMap.chapters[0].representativeFrameEvidenceId = bundle.evidence[0].evidenceId;
      },
    }),
    REVIEW_BUNDLE_FAILURE.SEEK,
  );
});

test("B6 seekcls 7: a representative with NO captured PNG is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => { bundle.thumbnails = []; },
    }),
    REVIEW_BUNDLE_FAILURE.THUMBNAIL,
  );
});

test("B6 seekcls 8: a representative of ANOTHER task is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        bundle.evidence[1].taskId = `media_task_${"e".repeat(32)}`;
      },
    }),
    REVIEW_BUNDLE_FAILURE.IDENTITY,
  );
});

test("B6 seekcls 9: a seek row that cites ANOTHER evidence set is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        bundle.seekMap.chapters[0].evidenceIds = [bundle.evidence[2].evidenceId];
      },
    }),
    REVIEW_BUNDLE_FAILURE.SEEK,
  );
});

// ============================================================================
// Group 11 — the seek builder
// ============================================================================

test("B6 seekcls 10: the builder PREFERS a cited frame inside the window", () => {
  const bundle = buildBundleFixture({});
  const derivative = derivativeOf(bundle);
  // The first chapter cites the frame itself and the frame lies inside it.
  derivative.chapters[0].evidenceIds = [bundle.evidence[1].evidenceId];
  const seek = buildSeekMap({
    derivative,
    evidence: bundle.evidence,
    thumbnails: bundle.thumbnails,
    mediaDurationMs: 24_000,
  });
  assert.equal(seek.ok, true, seek.detail ?? "");
  assert.equal(seek.seekMap.chapters[0].representativeFrameEvidenceId, bundle.evidence[1].evidenceId);
  assert.equal(seek.seekMap.chapters.length, derivative.chapters.length);
});

test("B6 seekcls 11: the builder FALLS BACK to the nearest captured frame", () => {
  const bundle = buildBundleFixture({});
  const derivative = derivativeOf(bundle);
  // The chapter cites a transcript only: the nearest captured frame wins.
  derivative.chapters[0].evidenceIds = [bundle.evidence[0].evidenceId];
  const seek = buildSeekMap({
    derivative,
    evidence: bundle.evidence,
    thumbnails: bundle.thumbnails,
    mediaDurationMs: 24_000,
  });
  assert.equal(seek.ok, true, seek.detail ?? "");
  assert.equal(seek.seekMap.chapters[0].representativeFrameEvidenceId, bundle.evidence[1].evidenceId);
});

test("B6 seekcls 12: the builder FAILS when no PNG-backed frame exists", () => {
  const bundle = buildBundleFixture({});
  const derivative = derivativeOf(bundle);
  const seek = buildSeekMap({
    derivative,
    evidence: bundle.evidence,
    thumbnails: [],
    mediaDurationMs: 24_000,
  });
  assert.equal(seek.ok, false);
  assert.equal(seek.code, CAPTURE_FAILURE.SEEK);
});

test("B6 seekcls 13: the CAPTURE fails when a chapter has no frame", async () => {
  const scratch = makeTempRoot("navia-b6a-seek-");
  const root = path.join(scratch, "private-root");
  fs.mkdirSync(root, { mode: 0o700 });
  const bundle = buildBundleFixture({});
  const captured = await captureReviewBundle({
    source: bundle.source,
    artifactBytes: bundle.artifact,
    workspace: bundle.workspace,
    readDerivedText: async (relativeRef) => {
      const evidenceId = path.basename(relativeRef, ".json");
      const record = bundle.evidence.find((item) => item.evidenceId === evidenceId);
      return record ? { text: record.text, thumbnailRelativeRef: null } : null;
    },
    fetchThumbnail: async () => null,
    privateRootDirectory: root,
  });
  assert.equal(captured.ok, false);
  assert.equal(captured.code, CAPTURE_FAILURE.SEEK);
  // Nothing is published when the seek map cannot be closed.
  assert.deepEqual(fs.readdirSync(root), []);
});
