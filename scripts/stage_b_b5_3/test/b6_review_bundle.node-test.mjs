// B6A — the private review bundle: identity/hash closure (12) and the
// evidence/text mutations (10).
//
// The oracle is the PRODUCTION bundle validator
// (`lib/review_bundle.mjs`); the bundle is a REAL contract-shaped fixture.
//
// No Chrome, no Runtime, no Provider, no download, no Cookie.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { canonicalJson, sha256Hex } from "../lib/v21_artifact.mjs";
import {
  REVIEW_BUNDLE_FAILURE,
  collectText,
  evidenceCatalogSha256,
  deriveCaptureReceipt,
  encodeBundleFiles,
  encodeManifestText,
  isStrictPng,
  normalizeEvidenceText,
  validateReviewBundle,
} from "../lib/review_bundle.mjs";
import { ACTIVE_REGISTRY_SHA256 } from "../lib/registry.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";
import { buildBundleFixture, PNG_BYTES } from "./_fixtures/b6_bundle_fixture.mjs";

function codesOf(bundle) {
  return validateReviewBundle(bundle).failures.map((failure) => failure.code);
}

function assertRefused(bundle, expectedCode) {
  const verdict = validateReviewBundle(bundle);
  assert.equal(verdict.ok, false, `the bundle must be refused: ${expectedCode}`);
  assert.ok(
    verdict.failures.some((failure) => failure.code === expectedCode),
    `expected ${expectedCode}, got ${JSON.stringify(verdict.failures.map((failure) => failure.code))}`,
  );
}

// ============================================================================
// Group 1 — bundle identity / hash closure (12)
// ============================================================================

test("B6 identity 1/12: a valid bundle passes", () => {
  const verdict = validateReviewBundle(buildBundleFixture({}));
  assert.deepEqual(verdict.failures, []);
  assert.equal(verdict.ok, true);
});

test("B6 identity 2/12: another task id is refused", () => {
  assertRefused(
    buildBundleFixture({ mutate: (bundle) => { bundle.source.taskId = `media_task_${"f".repeat(32)}`; } }),
    REVIEW_BUNDLE_FAILURE.IDENTITY,
  );
});

test("B6 identity 3/12: another task revision is refused", () => {
  assertRefused(
    buildBundleFixture({ mutate: (bundle) => { bundle.source.taskRevision = 9; } }),
    REVIEW_BUNDLE_FAILURE.IDENTITY,
  );
});

test("B6 identity 4/12: another source identity is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        bundle.source.sourceIdentity = `portal:bilibili:${bundle.source.bvid}:41828944992:p9`;
      },
    }),
    REVIEW_BUNDLE_FAILURE.IDENTITY,
  );
});

test("B6 identity 5/12: another registry ORDER is refused", () => {
  assertRefused(
    buildBundleFixture({ mutate: (bundle) => { bundle.source.order = "6"; } }),
    REVIEW_BUNDLE_FAILURE.IDENTITY,
  );
});

test("B6 identity 6/12: another registry BVID is refused", () => {
  assertRefused(
    buildBundleFixture({ mutate: (bundle) => { bundle.source.bvid = "BV1OTHER00001"; } }),
    REVIEW_BUNDLE_FAILURE.IDENTITY,
  );
});

test("B6 identity 7/12: another registry DIGEST is refused", () => {
  assertRefused(
    buildBundleFixture({ mutate: (bundle) => { bundle.source.registrySha256 = "0".repeat(64); } }),
    REVIEW_BUNDLE_FAILURE.IDENTITY,
  );
});

test("B6 identity 8/12: a MALFORMED derivative is refused", () => {
  assertRefused(
    buildBundleFixture({ mutate: (bundle) => { bundle.artifact = Buffer.from("{not json", "utf8"); } }),
    REVIEW_BUNDLE_FAILURE.ARTIFACT,
  );
});

test("B6 identity 9/12: a derivative that breaks the FROZEN contract is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        const derivative = JSON.parse(bundle.artifact.toString("utf8"));
        derivative.claims = [];
        bundle.artifact = Buffer.from(canonicalJson(derivative), "utf8");
      },
    }),
    REVIEW_BUNDLE_FAILURE.ARTIFACT,
  );
});

test("B6 identity 10/12: a CATALOG hash mismatch is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        const derivative = JSON.parse(bundle.artifact.toString("utf8"));
        derivative.binding.evidenceCatalogSha256 = "0".repeat(64);
        bundle.artifact = Buffer.from(canonicalJson(derivative), "utf8");
      },
    }),
    REVIEW_BUNDLE_FAILURE.CATALOG,
  );
});

test("B6 identity 11/12: a MISSING evidence record is refused", () => {
  assertRefused(
    buildBundleFixture({
      // The SECOND record is the one the claims, the chapters and the regions
      // reference: removing it breaks the reference AND the catalog hash.
      mutate: (bundle) => {
        bundle.evidence = bundle.evidence.filter((item) => item.evidenceId !== bundle.evidence[1].evidenceId);
      },
    }),
    REVIEW_BUNDLE_FAILURE.EVIDENCE_MISSING,
  );
});

test("B6 identity 12/12: a MANIFEST drift is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        const entry = bundle.manifest.find((item) => item.path === "artifact.json");
        entry.sha256 = "0".repeat(64);
      },
    }),
    REVIEW_BUNDLE_FAILURE.MANIFEST,
  );
});

// ============================================================================
// Group 2 — the evidence / text mutations (10)
// ============================================================================

test("B6 evidence 1/10: an evidence TEXT that does not hash is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => { bundle.evidence[0].text = `${bundle.evidence[0].text}篡改`; },
    }),
    REVIEW_BUNDLE_FAILURE.EVIDENCE_HASH,
  );
});

test("B6 evidence 2/10: a NULL evidence text is refused", () => {
  assertRefused(
    buildBundleFixture({ mutate: (bundle) => { bundle.evidence[0].text = null; } }),
    REVIEW_BUNDLE_FAILURE.EVIDENCE_HASH,
  );
});

test("B6 evidence 3/10: a DUPLICATE evidence id is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => { bundle.evidence.push({ ...bundle.evidence[0] }); },
    }),
    REVIEW_BUNDLE_FAILURE.DUPLICATE,
  );
});

test("B6 evidence 4/10: an evidence of ANOTHER task is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => { bundle.evidence[0].taskId = `media_task_${"e".repeat(32)}`; },
    }),
    REVIEW_BUNDLE_FAILURE.IDENTITY,
  );
});

test("B6 evidence 5/10: a MALFORMED evidence record is refused", () => {
  assertRefused(
    buildBundleFixture({ mutate: (bundle) => { bundle.evidence[0] = "not-an-object"; } }),
    REVIEW_BUNDLE_FAILURE.SCHEMA,
  );
});

test("B6 evidence 6/10: a FOREIGN evidence id in the derivative is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        const derivative = JSON.parse(bundle.artifact.toString("utf8"));
        derivative.claims[0].evidenceIds = [`mtr_${"9".repeat(32)}`];
        bundle.artifact = Buffer.from(canonicalJson(derivative), "utf8");
      },
    }),
    REVIEW_BUNDLE_FAILURE.EVIDENCE_MISSING,
  );
});

test("B6 evidence 7/10: a thumbnail that was DECLARED but not captured is refused", () => {
  assertRefused(
    buildBundleFixture({ mutate: (bundle) => { bundle.thumbnails = []; } }),
    REVIEW_BUNDLE_FAILURE.THUMBNAIL,
  );
});

test("B6 evidence 8/10: a capture receipt with a FORBIDDEN field is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => { bundle.captureReceipt.providerId = "minimax-cn-openai-vision"; },
    }),
    REVIEW_BUNDLE_FAILURE.PROVIDER_LEAK,
  );
});

test("B6 evidence 9/10: a bundle with a SECRET is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => { bundle.evidence[0].text = `sk-abcdefghijklmnopqrstuvwxyz`; },
    }),
    REVIEW_BUNDLE_FAILURE.SECRET,
  );
});

test("B6 evidence 10/10: a bundle with an ABSOLUTE PATH is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => { bundle.evidence[0].text = "the file is /home/administrator/private.txt"; },
    }),
    REVIEW_BUNDLE_FAILURE.ABSOLUTE_PATH,
  );
});

test("B6 evidence: binary thumbnail and manifest bytes are never decoded as semantic text", () => {
  const bundle = buildBundleFixture({});
  const binaryOnlyMarker = "/binary-thumbnail-private-shape";
  bundle.thumbnails[0].bytes = Buffer.from(binaryOnlyMarker, "utf8");
  bundle.manifest[0].bytes = Buffer.from("/duplicate-manifest-private-shape", "utf8");
  const text = collectText(bundle);
  assert.equal(text.includes(binaryOnlyMarker), false);
  assert.equal(text.includes("/duplicate-manifest-private-shape"), false);
});

test("B6 evidence: the textual artifact remains inside the privacy scan", () => {
  const marker = "/artifact-private-shape";
  const text = collectText({
    artifact: Buffer.from(JSON.stringify({ marker }), "utf8"),
    thumbnails: [{ bytes: Buffer.from("/ignored-binary-shape", "utf8") }],
    manifest: [],
  });
  assert.equal(text.includes(marker), true);
  assert.equal(text.includes("/ignored-binary-shape"), false);
});

test("B6 evidence: PNG textual metadata cannot bypass the semantic privacy scan", () => {
  const crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    crcTable[index] = value >>> 0;
  }
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const type = Buffer.from("tEXt", "ascii");
  const data = Buffer.from("Comment\0/private/path", "utf8");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 8 + data.length);
  const iendOffset = PNG_BYTES.length - 12;
  const withText = Buffer.concat([
    PNG_BYTES.subarray(0, iendOffset),
    chunk,
    PNG_BYTES.subarray(iendOffset),
  ]);
  assert.equal(isStrictPng(PNG_BYTES), true);
  assert.equal(isStrictPng(withText), false);
});

test("B6 evidence: only ffmpeg's fixed-size pHYs ancillary chunk is accepted", () => {
  const crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    crcTable[index] = value >>> 0;
  }
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const insertChunk = (typeName, data) => {
    const type = Buffer.from(typeName, "ascii");
    const chunk = Buffer.alloc(12 + data.length);
    chunk.writeUInt32BE(data.length, 0);
    type.copy(chunk, 4);
    data.copy(chunk, 8);
    chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 8 + data.length);
    const iendOffset = PNG_BYTES.length - 12;
    return Buffer.concat([
      PNG_BYTES.subarray(0, iendOffset),
      chunk,
      PNG_BYTES.subarray(iendOffset),
    ]);
  };
  assert.equal(isStrictPng(insertChunk("pHYs", Buffer.alloc(9))), true);
  assert.equal(isStrictPng(insertChunk("pHYs", Buffer.alloc(10))), false);
  assert.equal(isStrictPng(insertChunk("aaAa", Buffer.from("/private/path", "utf8"))), false);
});

test("B6 evidence: the frozen ffmpeg BT.709 PNG is accepted without opening an ancillary-data privacy channel", () => {
  const root = makeTempRoot("b6-real-bt709-png-");
  const source = path.join(root, "source.mp4");
  const frame = path.join(root, "frame.png");
  try {
    const encode = spawnSync("/usr/bin/ffmpeg", [
      "-v", "error", "-nostdin", "-f", "lavfi",
      "-i", "testsrc2=size=320x240:rate=1", "-frames:v", "1",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
      "-y", source,
    ], { encoding: "utf8" });
    assert.equal(encode.status, 0, encode.stderr);
    const extract = spawnSync("/usr/bin/ffmpeg", [
      "-v", "error", "-nostdin", "-ss", "0", "-i", source,
      "-frames:v", "1", "-f", "image2", "-y", frame,
    ], { encoding: "utf8" });
    assert.equal(extract.status, 0, extract.stderr);
    assert.equal(isStrictPng(fs.readFileSync(frame)), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("B6 evidence: colour chunks must carry the exact frozen ffmpeg BT.709 payloads", () => {
  const crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    crcTable[index] = value >>> 0;
  }
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const insertChunk = (typeName, data) => {
    const type = Buffer.from(typeName, "ascii");
    const chunk = Buffer.alloc(12 + data.length);
    chunk.writeUInt32BE(data.length, 0);
    type.copy(chunk, 4);
    data.copy(chunk, 8);
    chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 8 + data.length);
    const iendOffset = PNG_BYTES.length - 12;
    return Buffer.concat([PNG_BYTES.subarray(0, iendOffset), chunk, PNG_BYTES.subarray(iendOffset)]);
  };
  const allowed = {
    cICP: "01010001",
    cHRM: "00007a26000080840000fa00000080e8000075300000ea6000003a9800001770",
    gAMA: "0000c732",
  };
  for (const [type, payloadHex] of Object.entries(allowed)) {
    const payload = Buffer.from(payloadHex, "hex");
    assert.equal(isStrictPng(insertChunk(type, payload)), true, `${type} real payload`);
    const changed = Buffer.from(payload);
    changed[changed.length - 1] ^= 1;
    assert.equal(isStrictPng(insertChunk(type, changed)), false, `${type} altered payload`);
  }
});

test("B6 evidence: receipt and manifest bytes are canonical for multiple thumbnail input orders", () => {
  const build = (reverse) => {
    const bundle = buildBundleFixture({});
    bundle.evidence[2].kind = "frame";
    bundle.evidence[2].thumbnailAvailable = true;
    bundle.thumbnails.push({
      evidenceId: bundle.evidence[2].evidenceId,
      sha256: sha256Hex(PNG_BYTES),
      bytes: PNG_BYTES,
    });
    if (reverse) bundle.thumbnails.reverse();
    bundle.captureReceipt = deriveCaptureReceipt(bundle);
    const files = encodeBundleFiles(bundle);
    bundle.manifest = [...files.entries()].map(([name, bytes]) => ({
      path: name,
      sha256: sha256Hex(bytes),
      bytes,
    }));
    bundle.manifestBytes = Buffer.from(encodeManifestText(files), "utf8");
    return bundle;
  };
  const forward = build(false);
  const reverse = build(true);
  assert.equal(validateReviewBundle(forward).ok, true);
  assert.equal(validateReviewBundle(reverse).ok, true);
  assert.deepEqual(forward.captureReceipt, reverse.captureReceipt);
  assert.equal(forward.manifestBytes.equals(reverse.manifestBytes), true);
});

test("B6 evidence: a bundle with a RAW MEDIA file is refused", () => {
  assertRefused(
    buildBundleFixture({
      mutate: (bundle) => {
        bundle.manifest.push({
          path: "thumbnails/raw.mp4",
          sha256: sha256Hex(Buffer.from("raw", "utf8")),
          bytes: Buffer.from("raw", "utf8"),
        });
      },
    }),
    REVIEW_BUNDLE_FAILURE.RAW_MEDIA,
  );
});

test("B6 evidence: the catalog hash is the FROZEN algorithm", () => {
  const bundle = buildBundleFixture({});
  assert.equal(evidenceCatalogSha256(bundle.evidence), bundle.captureReceipt.digests.evidenceCatalogSha256);
  const derivative = JSON.parse(bundle.artifact.toString("utf8"));
  assert.equal(derivative.binding.evidenceCatalogSha256, bundle.captureReceipt.digests.evidenceCatalogSha256);
  // The content digest is the digest of the NORMALIZED text.
  assert.equal(
    bundle.evidence[0].contentSha256,
    sha256Hex(Buffer.from(normalizeEvidenceText(bundle.evidence[0].text), "utf8")),
  );
  assert.equal(bundle.source.registrySha256, ACTIVE_REGISTRY_SHA256);
  assert.equal(bundle.thumbnails[0].bytes.equals(PNG_BYTES), true);
});
