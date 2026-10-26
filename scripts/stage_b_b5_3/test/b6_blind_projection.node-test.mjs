// B6A — the blind evaluator projection and its privacy boundary (8).
//
// The evaluator may read the semantic content, the derived evidence text,
// the timestamps, the evidence ids, the thumbnails and the seek map. It may
// NOT read the Provider identity, the Provider receipt text, a secret, a
// runtime path or raw media.
//
// The oracle is the PRODUCTION projection builder and its privacy scanner.

import test from "node:test";
import assert from "node:assert/strict";

import { canonicalJson } from "../lib/v21_artifact.mjs";
import {
  BLIND_PROJECTION_FAILURE,
  buildBlindProjection,
  projectionPrivacyDefects,
} from "../lib/blind_projection.mjs";
import { buildBundleFixture } from "./_fixtures/b6_bundle_fixture.mjs";

function projected(mutate = null) {
  return buildBlindProjection(buildBundleFixture({ mutate }));
}

test("B6 blind 1/8: the projection carries NO Provider identity", () => {
  const view = projected();
  const serialized = JSON.stringify(view, (key, value) => (
    Buffer.isBuffer(value) ? `png:${value.length}` : value
  ));
  for (const identity of ["minimax-cn-openai-vision", "minimax_chat_completions", "MiniMax-M3", "attempt-"]) {
    assert.ok(!serialized.includes(identity), `the projection leaks ${identity}`);
  }
  const verdict = projectionPrivacyDefects(view);
  assert.deepEqual(verdict.defects, [], JSON.stringify(verdict.defects));
});

test("B6 blind 2/8: the projection carries NO receipt text", () => {
  const view = projected();
  assert.equal(view.review.reviewBindingSha256.length, 64);
  assert.equal("receipt" in view, false, "the receipt is not projected at all");
  assert.equal("authorization" in view, false, "the authorization block is not projected");
  assert.equal(JSON.stringify(view).includes("outboundDerivedTextSha256"), false);
  // The review binding is IRREVERSIBLE: the same bytes, the same hash.
  const again = projected();
  assert.equal(again.review.reviewBindingSha256, view.review.reviewBindingSha256);
});

test("B6 blind 3/8: a DIFFERENT receipt yields a DIFFERENT review binding", () => {
  const view = projected((bundle) => {
    const derivative = JSON.parse(bundle.artifact.toString("utf8"));
    derivative.receipt.modelId = "another-model";
    bundle.artifact = Buffer.from(canonicalJson(derivative), "utf8");
  });
  const other = projected();
  assert.notEqual(view.review.reviewBindingSha256, other.review.reviewBindingSha256);
});

test("B6 blind 4/8: the projection carries NO secret", () => {
  const view = projected((bundle) => {
    bundle.evidence[0].text = "sk-abcdefghijklmnopqrstuvwxyz";
  });
  const verdict = projectionPrivacyDefects(view);
  assert.ok(
    verdict.defects.some((defect) => defect.code === BLIND_PROJECTION_FAILURE.SECRET),
    JSON.stringify(verdict.defects),
  );
});

test("B6 blind 5/8: the projection carries NO absolute path", () => {
  const view = projected((bundle) => {
    bundle.evidence[0].text = "the file is /home/administrator/private.txt";
  });
  const verdict = projectionPrivacyDefects(view);
  assert.ok(
    verdict.defects.some((defect) => defect.code === BLIND_PROJECTION_FAILURE.ABSOLUTE_PATH),
    JSON.stringify(verdict.defects),
  );
});

test("B6 blind 6/8: the projection carries NO raw media", () => {
  const view = projected((bundle) => {
    bundle.thumbnails[0].bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00]);
  });
  const verdict = projectionPrivacyDefects(view);
  assert.ok(
    verdict.defects.some((defect) => defect.code === BLIND_PROJECTION_FAILURE.RAW_MEDIA),
    JSON.stringify(verdict.defects),
  );
});

test("B6 blind 7/8: the projection KEEPS the semantic content the reviewer needs", () => {
  const view = projected();
  assert.equal(view.content.brief.text.length > 0, true);
  assert.equal(view.content.claims.length, 2);
  assert.equal(view.content.chapters.length, 2);
  assert.equal(view.evidence.length, 4);
  assert.equal(view.evidence[0].text.length > 0, true);
  assert.equal(view.seekMap.chapters.length, 2);
  assert.equal(view.source.bvid.length, 12);
  assert.equal(view.thumbnails.length, 1);
  assert.equal(Buffer.isBuffer(view.thumbnails[0].bytes), true);
});

test("B6 blind 8/8: the projection NEVER carries the Provider identity fields", () => {
  const view = projected();
  const walk = (value, path, depth) => {
    if (depth > 8 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1));
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      for (const forbidden of [
        "providerId", "modelId", "endpointClass", "structureMode", "attemptId",
        "requestSha256", "responseSha256", "outboundDerivedTextSha256",
      ]) {
        assert.notEqual(key, forbidden, `the projection carries ${path}.${key}`);
      }
      walk(item, `${path}.${key}`, depth + 1);
    }
  };
  walk(view, "$", 0);
});
