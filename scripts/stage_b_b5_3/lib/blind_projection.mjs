// The BLIND evaluator projection of a private review bundle.
//
// The evaluator may read the semantic content of the derivative, the derived
// evidence text, the timestamps, the evidence ids, the thumbnails and the
// seek map. It may NOT read:
//
//   * the Provider identity (provider id, model id, endpoint class);
//   * the Provider receipt text (the attempt, the digests, the latency);
//   * any runtime path, database reference or profile reference;
//   * raw media, a Cookie, a key or a bearer.
//
// The Provider receipt is replaced by an IRREVERSIBLE review binding hash: the
// artifact stays verifiable without exposing the model that produced it.

import { canonicalJson, sha256Hex } from "./v21_artifact.mjs";
import { detectAbsolutePaths } from "./privacy.mjs";
import { SECRET_PATTERNS } from "./contracts.mjs";
// The review binding has EXACTLY ONE definition: the capture receipt and the
// blind projection must bind the same value.
import { reviewBindingSha256 } from "./review_bundle.mjs";

/** The blind projection's schema version. */
export const BLIND_PROJECTION_SCHEMA = "v3-5.10-b6-blind-projection/v1";

/** The privacy failure codes of the projection. */
export const BLIND_PROJECTION_FAILURE = Object.freeze({
  PROVIDER_LEAK: "B6_BLIND_PROVIDER_LEAK",
  SECRET: "B6_BLIND_SECRET_LEAK",
  ABSOLUTE_PATH: "B6_BLIND_ABSOLUTE_PATH",
  RAW_MEDIA: "B6_BLIND_RAW_MEDIA",
  RECEIPT_TEXT: "B6_BLIND_RECEIPT_TEXT",
});

/** The Provider identity fields that may NEVER appear in the projection. */
export const PROVIDER_IDENTITY_FIELDS = Object.freeze([
  "providerId",
  "modelId",
  "endpointClass",
  "structureMode",
  "attemptId",
  "latencyMs",
  "requestSha256",
  "responseSha256",
  "outboundDerivedTextSha256",
  "finishReason",
  "usage",
]);

/**
 * The blind projection of a bundle.
 *
 * It is PURE: it takes the bundle description and returns plain data.
 */
export function buildBlindProjection(bundle) {
  const artifact = JSON.parse(bundle.artifact.toString("utf8"));
  // The IRREVERSIBLE review binding: the receipt bytes are hashed, never
  // projected. The definition is SHARED with the capture receipt.
  const binding = reviewBindingSha256(artifact);
  return {
    schemaVersion: BLIND_PROJECTION_SCHEMA,
    source: {
      order: bundle.source.order,
      bvid: bundle.source.bvid,
      taskId: bundle.source.taskId,
      taskRevision: bundle.source.taskRevision,
      sourceIdentity: bundle.source.sourceIdentity,
    },
    review: {
      reviewBindingSha256: binding,
      schemaVersion: artifact.schemaVersion,
      quality: {
        status: artifact.quality?.status ?? null,
        failureCodes: artifact.quality?.failureCodes ?? [],
      },
    },
    content: {
      brief: artifact.brief ?? null,
      claims: artifact.claims ?? [],
      chapters: artifact.chapters ?? [],
      regions: artifact.regions ?? [],
    },
    evidence: (bundle.evidence ?? []).map((item) => ({
      evidenceId: item.evidenceId,
      kind: item.kind,
      timestampStartMs: item.timestampStartMs,
      timestampEndMs: item.timestampEndMs,
      contentSha256: item.contentSha256,
      text: item.text,
      thumbnailAvailable: Boolean(item.thumbnailAvailable),
    })),
    thumbnails: (bundle.thumbnails ?? []).map((item) => ({
      evidenceId: item.evidenceId,
      bytes: item.bytes,
    })),
    seekMap: bundle.seekMap ?? null,
  };
}

/**
 * The privacy defects of a projection.
 *
 * The projection must not carry the Provider identity, the receipt text, a
 * secret, an absolute path or raw media.
 */
export function projectionPrivacyDefects(projection) {
  const defects = [];
  const fail = (code, detail) => defects.push({ code, detail });

  const walk = (value, path, depth) => {
    if (depth > 12) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (PROVIDER_IDENTITY_FIELDS.includes(key)) {
          fail(BLIND_PROJECTION_FAILURE.PROVIDER_LEAK, `the projection carries ${path}.${key}`);
        }
        walk(item, `${path}.${key}`, depth + 1);
      }
    }
  };
  walk(projection, "$", 0);

  const receipt = projection?.review?.reviewBindingSha256;
  if (typeof receipt !== "string" || !/^[0-9a-f]{64}$/.test(receipt)) {
    fail(BLIND_PROJECTION_FAILURE.RECEIPT_TEXT, "the projection has no irreversible review binding");
  }

  const serialized = JSON.stringify(projection, (key, value) => (
    Buffer.isBuffer(value) ? `png:${value.length}` : value
  ));
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(serialized)) {
      fail(BLIND_PROJECTION_FAILURE.SECRET, `the projection carries a secret matching ${String(pattern)}`);
      break;
    }
  }
  const paths = detectAbsolutePaths(serialized);
  if (paths.length > 0) {
    fail(BLIND_PROJECTION_FAILURE.ABSOLUTE_PATH, `the projection carries ${paths.length} absolute path(s)`);
  }
  for (const item of projection?.thumbnails ?? []) {
    const bytes = item?.bytes;
    if (!Buffer.isBuffer(bytes)) continue;
    // A PNG is allowed; a raw media container is not.
    if (bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
      fail(BLIND_PROJECTION_FAILURE.RAW_MEDIA, "the projection carries a raw media container");
    }
  }
  return { ok: defects.length === 0, defects };
}
