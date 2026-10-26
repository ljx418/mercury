// The synthetic private review bundle used by the B-6A offline tests.
//
// It is a REAL contract-shaped bundle: the V2.1 derivative satisfies the
// FROZEN schema, the evidence texts hash to their content digests, the
// catalog hash is the FROZEN one and the thumbnails are real PNG bytes.
//
// The bundle is built with the PRODUCTION encoders, so the fixture and the
// production writer can never drift apart.
//
// Nothing here touches the network, the Runtime or the product.

import { canonicalJson, sha256Hex } from "../../lib/v21_artifact.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "../../lib/registry.mjs";
import {
  REVIEW_BUNDLE_SCHEMA,
  deriveCaptureReceipt,
  encodeBundleFiles,
  encodeManifestText,
  evidenceCatalogSha256,
  normalizeEvidenceText,
} from "../../lib/review_bundle.mjs";
import { buildV21Artifact, frozenReceipt } from "./contract_shaped_stub.mjs";

/** A minimal, real PNG (1x1, opaque black). */
export const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** The normalized text of an evidence record. */
export function evidenceText(index) {
  return `第 ${index + 1} 段派生字幕文本，包含可核验的事实陈述与时间范围说明。`;
}

/**
 * Build a valid private review bundle.
 *
 * @param {object} options
 * @param {number} options.order the registry order (1..6)
 * @param {Function} options.mutate an optional mutation of the bundle
 */
export function buildBundleFixture({ order = 1, mutate = null } = {}) {
  const row = FROZEN_SIX.find((entry) => entry.order === String(order));
  const taskId = `media_task_${String(order).padStart(32, "0")}`;
  const sourceIdentity = `portal:bilibili:${row.bvid}:41828944992:p1`;
  const mediaDurationMs = 24_000;

  const evidence = [];
  for (let index = 0; index < 4; index += 1) {
    const text = evidenceText(index);
    evidence.push({
      evidenceId: `mtr_${String(index + 1).padStart(32, "0")}`,
      taskId,
      kind: index === 0 ? "transcript" : (index === 1 ? "frame" : (index === 2 ? "ocr_block" : "vision_caption")),
      timestampStartMs: index * 1_000,
      timestampEndMs: index * 1_000 + 900,
      contentSha256: sha256Hex(Buffer.from(normalizeEvidenceText(text), "utf8")),
      text,
      thumbnailAvailable: index === 1,
    });
  }

  const catalogSha256 = evidenceCatalogSha256(evidence);
  const receipt = frozenReceipt({ requestCount: 3 });
  const derivative = buildV21Artifact({
    taskId,
    taskRevision: 7,
    sourceIdentity,
    receipt,
    evidenceIds: evidence.map((item) => item.evidenceId),
    claimIds: ["claim_".padEnd(21, "0") + "1", "claim_".padEnd(21, "0") + "2"],
    chapterIds: ["chapter_".padEnd(23, "0") + "1", "chapter_".padEnd(23, "0") + "2"],
  });
  derivative.binding.evidenceCatalogSha256 = catalogSha256;
  const artifactBytes = Buffer.from(canonicalJson(derivative), "utf8");

  const workspace = {
    schemaVersion: "v3-media-workspace-comprehension-projection/v2",
    task: {
      taskId,
      taskRevision: 7,
      sourceIdentity,
      mediaDurationMs,
      outlineId: `outline_${"c".repeat(26)}`,
    },
    evidenceCatalog: evidence.map((item) => ({
      evidenceId: item.evidenceId,
      taskId: item.taskId,
      kind: item.kind,
      timestampStartMs: item.timestampStartMs,
      timestampEndMs: item.timestampEndMs,
      contentSha256: item.contentSha256,
      relativeArtifactRef: `evidence/${taskId}/${item.evidenceId}.json`,
      thumbnailAvailable: item.thumbnailAvailable,
      excerpt: item.text.slice(0, 40),
    })),
  };

  // ONE seek row per derivative chapter: the exact chapter id, order,
  // window and evidence set, an in-chapter seek time and the real
  // PNG-backed frame of the task.
  const seekMap = {
    schemaVersion: "v3-5.10-b6-seek-map/v1",
    mediaDurationMs,
    chapters: derivative.chapters.map((chapter) => ({
      chapterId: chapter.chapterId,
      order: chapter.order,
      startMs: chapter.startMs,
      endMs: chapter.endMs,
      evidenceIds: [...chapter.evidenceIds],
      representativeFrameEvidenceId: evidence[1].evidenceId,
      seekTimeMs: chapter.startMs,
    })),
  };

  const thumbnails = [{
    evidenceId: evidence[1].evidenceId,
    sha256: sha256Hex(PNG_BYTES),
    bytes: PNG_BYTES,
  }];

  const source = {
    order: String(order),
    bvid: row.bvid,
    taskId,
    taskRevision: 7,
    sourceIdentity,
    dependencyGeneration: `depgen_${sha256Hex(`${order}:${row.bvid}`)}`,
    registrySha256: ACTIVE_REGISTRY_SHA256,
  };

  const bundle = {
    schemaVersion: REVIEW_BUNDLE_SCHEMA,
    source,
    artifact: artifactBytes,
    workspace,
    evidence,
    thumbnails,
    seekMap,
    captureReceipt: null,
    manifest: [],
  };
  // The receipt is DERIVED and the manifest is the CANONICAL encoding: the
  // fixture and the production writer share one definition.
  bundle.captureReceipt = deriveCaptureReceipt(bundle);
  const files = encodeBundleFiles(bundle);
  bundle.manifest = [...files.entries()].map(([name, bytes]) => ({
    path: name,
    sha256: sha256Hex(bytes),
    bytes,
  }));
  bundle.manifestBytes = Buffer.from(encodeManifestText(files), "utf8");

  if (mutate) mutate(bundle);
  return bundle;
}
