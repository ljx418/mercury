// The PRIVATE review bundle of the B-6 semantic review (acceptance harness
// only).
//
// The bundle is the ONLY way a reviewer may look at the DERIVED evidence of a
// source. It is captured from ONE fresh candidate, AFTER the durable V2.1
// publication has been validated and BEFORE the runner owner cleanup, so it
// is provably the same evidence the machine gate saw.
//
// The bundle is PRIVATE (0700, outside the repository). It may contain:
//
//   * the exact durable V2.1 derivative bytes;
//   * the public workspace metadata;
//   * the derived transcript / OCR / vision-caption text;
//   * the PNG thumbnails;
//   * the seek map;
//   * the capture receipt;
//   * the manifest.
//
// It may NEVER contain raw video or audio, a Cookie, a key, a bearer, a
// Provider response or an absolute path.
//
// THE VALIDATION IS BYTE-CLOSED: there is ONE canonical encoder per
// contracted file, the encoder rebuilds every file from the PARSED bundle,
// and the rebuilt bytes are compared byte-for-byte with the manifest entry.
// A manifest entry that carries detached bytes is a refusal, even when its
// own digest is self-consistent.
//
// The capture receipt is DERIVED, never trusted: the counts, every digest,
// the closure flags, the schema and the status are RECOMPUTED from the
// bundle content.
//
// This module is PURE: it never touches the filesystem and it never starts
// anything.

import { canonicalJson, sha256Hex, validateV21Artifact } from "./v21_artifact.mjs";
import { detectAbsolutePaths } from "./privacy.mjs";
import { SECRET_PATTERNS } from "./contracts.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_PORTAL_ID, FROZEN_SIX } from "./registry.mjs";

/** The private bundle's schema version. */
export const REVIEW_BUNDLE_SCHEMA = "v3-5.10-b6-review-bundle/v1";

/** The capture receipt's schema version. */
export const CAPTURE_RECEIPT_SCHEMA = "v3-5.10-b6-capture-receipt/v1";

/** The seek map's schema version. */
export const SEEK_MAP_SCHEMA = "v3-5.10-b6-seek-map/v1";

/**
 * The EXACT file set of a private source bundle.
 *
 * The thumbnails live in `thumbnails/<evidenceId>.png` and are listed in the
 * manifest individually.
 */
export const REVIEW_BUNDLE_FILES = Object.freeze([
  "artifact.json",
  "capture-receipt.json",
  "evidence.jsonl",
  "seek-map.json",
  "source.json",
  "workspace.json",
]);

/** The manifest file name. */
export const REVIEW_BUNDLE_MANIFEST = "PRIVATE_MANIFEST.sha256";

/** The contracted directory of the PNG thumbnails. */
export const REVIEW_BUNDLE_THUMBNAIL_DIR = "thumbnails";

/** The EXACT key set of the source identity. */
export const REVIEW_BUNDLE_SOURCE_KEYS = Object.freeze([
  "order", "bvid", "taskId", "taskRevision", "sourceIdentity",
  "dependencyGeneration", "registrySha256",
]);

/** The EXACT key set of one evidence record. */
export const REVIEW_BUNDLE_EVIDENCE_KEYS = Object.freeze([
  "evidenceId", "taskId", "kind", "timestampStartMs", "timestampEndMs",
  "contentSha256", "text", "thumbnailAvailable",
]);

/** The EXACT key set of one seek chapter. */
export const REVIEW_BUNDLE_SEEK_KEYS = Object.freeze([
  "chapterId", "order", "startMs", "endMs", "evidenceIds",
  "representativeFrameEvidenceId", "seekTimeMs",
]);

/** The EXACT key set of the capture receipt. */
export const REVIEW_BUNDLE_RECEIPT_KEYS = Object.freeze([
  "schemaVersion", "counts", "digests", "closure", "status",
]);

/** The EXACT key set of the receipt counts. */
export const REVIEW_BUNDLE_RECEIPT_COUNT_KEYS = Object.freeze([
  "evidence", "thumbnails", "chapters",
]);

/** The EXACT key set of the receipt digests. */
export const REVIEW_BUNDLE_RECEIPT_DIGEST_KEYS = Object.freeze([
  "artifactSha256", "evidenceCatalogSha256", "bundleSha256", "reviewBindingSha256",
]);

/** The EXACT key set of the receipt closure. */
export const REVIEW_BUNDLE_RECEIPT_CLOSURE_KEYS = Object.freeze([
  "identityClosed", "catalogClosed", "thumbnailsClosed", "seekClosed",
]);

/** The EXACT key set of one manifest entry. */
export const REVIEW_BUNDLE_MANIFEST_ENTRY_KEYS = Object.freeze(["path", "sha256", "bytes"]);

/** The forbidden raw media extensions. */
export const RAW_MEDIA_EXTENSIONS = Object.freeze([
  ".mp4", ".m4v", ".webm", ".mkv", ".mov", ".avi", ".flv", ".ts",
  ".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg", ".opus",
]);

/** The evidence kinds a bundle may carry. */
export const REVIEW_BUNDLE_EVIDENCE_KINDS = Object.freeze([
  "transcript", "ocr_block", "vision_caption", "frame",
]);

/** The strict relative path grammar of a manifest entry. */
export const REVIEW_BUNDLE_PATH_GRAMMAR = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/;

/** The stable failure codes of the bundle validator. */
export const REVIEW_BUNDLE_FAILURE = Object.freeze({
  SCHEMA: "B6_BUNDLE_SCHEMA_INVALID",
  ARTIFACT: "B6_BUNDLE_ARTIFACT_INVALID",
  IDENTITY: "B6_BUNDLE_IDENTITY_MISMATCH",
  CATALOG: "B6_BUNDLE_CATALOG_HASH_MISMATCH",
  EVIDENCE_MISSING: "B6_BUNDLE_EVIDENCE_MISSING",
  EVIDENCE_HASH: "B6_BUNDLE_EVIDENCE_HASH_MISMATCH",
  THUMBNAIL: "B6_BUNDLE_THUMBNAIL_INVALID",
  SEEK: "B6_BUNDLE_SEEK_OUT_OF_RANGE",
  RECEIPT: "B6_BUNDLE_RECEIPT_INVALID",
  PROVIDER_LEAK: "B6_BUNDLE_PROVIDER_LEAK",
  SECRET: "B6_BUNDLE_SECRET_LEAK",
  ABSOLUTE_PATH: "B6_BUNDLE_ABSOLUTE_PATH",
  RAW_MEDIA: "B6_BUNDLE_RAW_MEDIA",
  MANIFEST: "B6_BUNDLE_MANIFEST_DRIFT",
  MANIFEST_PATH: "B6_BUNDLE_MANIFEST_PATH_INVALID",
  DUPLICATE: "B6_BUNDLE_DUPLICATE_FILE",
  FORBIDDEN_FIELD: "B6_BUNDLE_FORBIDDEN_FIELD",
});

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_ALLOWED_ANCILLARY_CHUNKS = new Map([
  ["pHYs", 9],
  ["cICP", 4],
  ["cHRM", 32],
  ["gAMA", 4],
]);

// The frozen ffmpeg emits these three numeric colour-calibration payloads
// when the source carries BT.709 metadata. Accept the exact encoder output,
// not arbitrary fixed-size ancillary bytes: cHRM alone is large enough to be
// abused as a covert text/path container if length were the only check.
const PNG_BT709_ANCILLARY_PAYLOADS = new Map([
  ["cICP", "01010001"],
  ["cHRM", "00007a26000080840000fa00000080e8000075300000ea6000003a9800001770"],
  ["gAMA", "0000c732"],
]);

function isAllowedPngAncillary(type, data) {
  const expectedLength = PNG_ALLOWED_ANCILLARY_CHUNKS.get(type);
  if (expectedLength !== data.length) return false;
  if (type === "pHYs") {
    // The final byte is the PNG unit specifier (unknown or metres).
    return data[8] === 0 || data[8] === 1;
  }
  return data.toString("hex") === PNG_BT709_ANCILLARY_PAYLOADS.get(type);
}
const SHA256_HEX = /^[0-9a-f]{64}$/;
const TASK_ID = /^media_task_[a-f0-9]{32}$/;
const BVID = /^BV[0-9A-Za-z]{10}$/;
const DEPENDENCY_GENERATION = /^depgen_[a-f0-9]{64}$/;
const EVIDENCE_ID = /^(?:mev|mtr)_[a-f0-9]{32}$/;
const IDENTITY_UNIT = /^[A-Za-z0-9_-]{1,32}$/;

/** The forbidden fields of the PUBLIC capture receipt. */
const FORBIDDEN_RECEIPT_FIELDS = Object.freeze([
  "providerId", "modelId", "endpointClass", "structureMode", "attemptId",
  "requestSha256", "responseSha256", "authorization", "cookie", "bearer",
  "token", "apiKey", "providerResponse",
]);

function hasExactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function pngCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Validate the complete PNG container, not only its eight-byte signature.
 *
 * The parser checks chunk bounds, CRCs, the mandatory IHDR/IDAT/IEND
 * structure, known critical chunks and the absence of trailing bytes. This
 * prevents raw media prefixed with the PNG signature from entering a review
 * bundle.
 */
export function isStrictPng(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < PNG_MAGIC.length + 12
    || !bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) return false;
  let offset = PNG_MAGIC.length;
  let chunkIndex = 0;
  let seenIhdr = false;
  let seenIdat = false;
  let seenIend = false;
  const knownCritical = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);
  while (offset < bytes.length) {
    if (seenIend || offset + 12 > bytes.length) return false;
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    if (dataEnd < dataStart || crcEnd > bytes.length) return false;
    const typeBytes = bytes.subarray(typeStart, dataStart);
    const type = typeBytes.toString("ascii");
    if (!/^[A-Za-z]{4}$/.test(type)) return false;
    if ((typeBytes[0] & 0x20) === 0 && !knownCritical.has(type)) return false;
    // Review thumbnails carry pixels plus ffmpeg's fixed-size pHYs chunk.
    // Every other ancillary chunk is refused: custom chunks and ordinary
    // metadata containers can carry paths, host details or secrets.
    if ((typeBytes[0] & 0x20) !== 0
      && (!PNG_ALLOWED_ANCILLARY_CHUNKS.has(type)
        || !isAllowedPngAncillary(type, bytes.subarray(dataStart, dataEnd)))) return false;
    const expectedCrc = bytes.readUInt32BE(dataEnd);
    if (pngCrc32(bytes.subarray(typeStart, dataEnd)) !== expectedCrc) return false;
    if (chunkIndex === 0) {
      if (type !== "IHDR" || length !== 13) return false;
      if (bytes.readUInt32BE(dataStart) === 0 || bytes.readUInt32BE(dataStart + 4) === 0) return false;
      seenIhdr = true;
    } else if (type === "IHDR") {
      return false;
    }
    if (type === "IDAT") seenIdat = true;
    if (type === "IEND") {
      if (length !== 0) return false;
      seenIend = true;
    }
    offset = crcEnd;
    chunkIndex += 1;
  }
  return seenIhdr && seenIdat && seenIend && offset === bytes.length;
}

/** The normalized text of an evidence record: the FROZEN normalization. */
export function normalizeEvidenceText(value) {
  return String(value ?? "").split(/\s+/).filter(Boolean).join(" ");
}

/**
 * The FROZEN evidence catalog hash.
 *
 * It is the production algorithm: the ordered
 * (evidenceId, contentSha256, timestampStartMs, timestampEndMs) tuples, in
 * the canonical byte layout.
 */
export function evidenceCatalogSha256(evidence) {
  const ordered = [...(evidence ?? [])].sort((left, right) => (
    left.timestampStartMs - right.timestampStartMs
    || left.timestampEndMs - right.timestampEndMs
    || (left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0)
  ));
  return sha256Hex(canonicalJson(ordered.map((item) => ({
    evidenceId: item.evidenceId,
    contentSha256: item.contentSha256,
    timestampStartMs: item.timestampStartMs,
    timestampEndMs: item.timestampEndMs,
  }))));
}

/** The evidence ids a V2.1 derivative references. */
export function referencedEvidenceIds(derivative) {
  const ids = new Set();
  for (const id of derivative?.brief?.evidenceIds ?? []) ids.add(String(id));
  for (const claim of derivative?.claims ?? []) {
    for (const id of claim?.evidenceIds ?? []) ids.add(String(id));
  }
  for (const chapter of derivative?.chapters ?? []) {
    for (const id of chapter?.evidenceIds ?? []) ids.add(String(id));
  }
  for (const region of derivative?.regions ?? []) {
    for (const id of region?.evidenceIds ?? []) ids.add(String(id));
  }
  return [...ids].sort();
}

/**
 * Parse a source identity against the STRICT grammar of this stage.
 *
 * The grammar is `portal:<adapter>:<bvid>:<unit>:<part>`: the portal
 * namespace is literal, the adapter is the FROZEN portal, the bvid is a
 * bilibili identity and the playback unit and part are non-empty tokens. A
 * foreign adapter (`portal:attacker:<bvid>`) never satisfies it.
 *
 * @returns {{portal: string, adapter: string, bvid: string, unit: string, part: string}|null}
 */
export function parseStrictSourceIdentity(value) {
  if (typeof value !== "string") return null;
  const parts = value.split(":");
  if (parts.length !== 5) return null;
  const [portal, adapter, bvid, unit, part] = parts;
  if (portal !== "portal") return null;
  if (adapter !== FROZEN_PORTAL_ID) return null;
  if (!BVID.test(bvid)) return null;
  if (!IDENTITY_UNIT.test(unit) || !IDENTITY_UNIT.test(part)) return null;
  return { portal, adapter, bvid, unit, part };
}

/**
 * The bundle hash: an IRREVERSIBLE binding of the captured CONTENT.
 *
 * It does NOT depend on the receipt (which carries it), so the receipt can
 * be derived after it.
 */
export function bundleDigest({ source, artifactSha256, evidenceCatalogSha256: catalog, evidence, thumbnails, seekMap }) {
  const orderedThumbnails = [...(thumbnails ?? [])].sort((left, right) => (
    String(left?.evidenceId ?? "").localeCompare(String(right?.evidenceId ?? ""))
  ));
  return sha256Hex(canonicalJson({
    source: {
      order: source?.order ?? null,
      bvid: source?.bvid ?? null,
      taskId: source?.taskId ?? null,
      taskRevision: source?.taskRevision ?? null,
      sourceIdentity: source?.sourceIdentity ?? null,
      dependencyGeneration: source?.dependencyGeneration ?? null,
      registrySha256: source?.registrySha256 ?? null,
    },
    artifactSha256: artifactSha256 ?? null,
    evidenceCatalogSha256: catalog ?? null,
    evidence: (evidence ?? []).map((item) => ({
      evidenceId: item.evidenceId,
      contentSha256: item.contentSha256,
      kind: item.kind,
      timestampStartMs: item.timestampStartMs,
      timestampEndMs: item.timestampEndMs,
    })),
    thumbnails: orderedThumbnails.map((item) => ({
      evidenceId: item.evidenceId,
      sha256: sha256Hex(item.bytes),
    })),
    seekMap: seekMap ?? null,
  }));
}

/**
 * The blind review binding: an IRREVERSIBLE binding of the PROVIDER
 * RECEIPT of the captured derivative.
 *
 * The reviewer may verify that the reviewed artifact is the published one
 * without ever seeing which Provider produced it. The blind projection and
 * the capture receipt share THIS definition: there is exactly one.
 */
export function reviewBindingSha256(artifactOrBytes) {
  let derivative = artifactOrBytes;
  try {
    if (Buffer.isBuffer(artifactOrBytes)) {
      derivative = JSON.parse(artifactOrBytes.toString("utf8"));
    }
  } catch {
    // A MALFORMED artifact has no review binding: the refusal is reported
    // by the artifact check, never by a crash.
    return null;
  }
  return sha256Hex(canonicalJson(derivative?.receipt ?? {}));
}

/**
 * The CANONICAL encoder of every contracted file.
 *
 * One encoder per file: the writer uses it and the validator rebuilds the
 * bytes with it, so the manifest comparison is byte-for-byte.
 *
 * @param {object} bundle the parsed bundle
 * @returns {Map<string, Buffer>} the contracted path -> the canonical bytes
 */
export function encodeBundleFiles(bundle) {
  const files = new Map();
  files.set("artifact.json", Buffer.isBuffer(bundle?.artifact) ? bundle.artifact : Buffer.alloc(0));
  files.set("source.json", Buffer.from(`${JSON.stringify(bundle?.source ?? null, null, 2)}\n`, "utf8"));
  files.set("workspace.json", Buffer.from(`${JSON.stringify(bundle?.workspace ?? null, null, 2)}\n`, "utf8"));
  files.set("evidence.jsonl", Buffer.from(
    `${(bundle?.evidence ?? []).map((item) => JSON.stringify(item)).join("\n")}\n`,
    "utf8",
  ));
  files.set("seek-map.json", Buffer.from(`${JSON.stringify(bundle?.seekMap ?? null, null, 2)}\n`, "utf8"));
  // The capture receipt is DERIVED: the encoder writes the RECOMPUTED
  // receipt, never the stored one.
  files.set("capture-receipt.json", Buffer.from(
    `${JSON.stringify(deriveCaptureReceipt(bundle), null, 2)}\n`,
    "utf8",
  ));
  const orderedThumbnails = [...(bundle?.thumbnails ?? [])].sort((left, right) => (
    String(left?.evidenceId ?? "").localeCompare(String(right?.evidenceId ?? ""))
  ));
  for (const item of orderedThumbnails) {
    files.set(
      `${REVIEW_BUNDLE_THUMBNAIL_DIR}/${String(item?.evidenceId ?? "")}.png`,
      Buffer.isBuffer(item?.bytes) ? item.bytes : Buffer.alloc(0),
    );
  }
  return files;
}

/** The canonical manifest text of the contracted files. */
export function encodeManifestText(files) {
  return `${[...files.entries()].map(([name, bytes]) => `${sha256Hex(bytes)}  ${name}`).join("\n")}\n`;
}

/**
 * The DERIVED capture receipt of a bundle.
 *
 * Nothing is trusted: the counts, every digest, the closure flags, the
 * schema and the status are recomputed from the bundle content.
 */
export function deriveCaptureReceipt(bundle) {
  const artifact = Buffer.isBuffer(bundle?.artifact) ? bundle.artifact : null;
  const artifactSha256 = artifact ? sha256Hex(artifact) : null;
  const catalog = evidenceCatalogSha256(bundle?.evidence ?? []);
  const closure = bundleClosure(bundle);
  return {
    schemaVersion: CAPTURE_RECEIPT_SCHEMA,
    counts: {
      evidence: (bundle?.evidence ?? []).length,
      thumbnails: (bundle?.thumbnails ?? []).length,
      chapters: (bundle?.seekMap?.chapters ?? []).length,
    },
    digests: {
      artifactSha256,
      evidenceCatalogSha256: catalog,
      bundleSha256: bundleDigest({
        source: bundle?.source,
        artifactSha256,
        evidenceCatalogSha256: catalog,
        evidence: bundle?.evidence ?? [],
        thumbnails: bundle?.thumbnails ?? [],
        seekMap: bundle?.seekMap ?? null,
      }),
      reviewBindingSha256: artifact ? reviewBindingSha256(artifact) : null,
    },
    closure,
    status: Object.values(closure).every((value) => value === true) ? "captured" : "failed",
  };
}

/** The parsed derivative of a bundle, or null. */
function parseDerivative(bundle) {
  if (!Buffer.isBuffer(bundle?.artifact)) return null;
  try {
    return JSON.parse(bundle.artifact.toString("utf8"));
  } catch {
    return null;
  }
}

/** The evidence records of a bundle, by id. */
function evidenceById(bundle) {
  const byId = new Map();
  for (const item of bundle?.evidence ?? []) {
    if (item && typeof item === "object") byId.set(String(item.evidenceId), item);
  }
  return byId;
}

/** TRUE when the source identity and the artifact agree with the registry. */
function identityClosureHolds(bundle) {
  const source = bundle?.source ?? null;
  if (!hasExactKeys(source, REVIEW_BUNDLE_SOURCE_KEYS)) return false;
  const row = FROZEN_SIX.find((entry) => entry.order === String(source.order));
  if (!row || source.bvid !== row.bvid) return false;
  if (source.registrySha256 !== ACTIVE_REGISTRY_SHA256) return false;
  if (typeof source.taskId !== "string" || !TASK_ID.test(source.taskId)) return false;
  if (!Number.isInteger(source.taskRevision) || source.taskRevision < 1) return false;
  if (typeof source.dependencyGeneration !== "string" || !DEPENDENCY_GENERATION.test(source.dependencyGeneration)) return false;
  const identity = parseStrictSourceIdentity(source.sourceIdentity);
  if (!identity || identity.bvid !== source.bvid) return false;
  const derivative = parseDerivative(bundle);
  if (!derivative) return false;
  const binding = derivative.binding ?? {};
  if (String(binding.taskId) !== String(source.taskId)) return false;
  if (String(binding.taskRevision) !== String(source.taskRevision)) return false;
  if (String(binding.sourceIdentity) !== String(source.sourceIdentity)) return false;
  const task = bundle?.workspace?.task ?? null;
  if (!task) return false;
  if (String(task.taskId) !== String(source.taskId)) return false;
  if (String(task.taskRevision) !== String(source.taskRevision)) return false;
  if (String(task.sourceIdentity) !== String(source.sourceIdentity)) return false;
  return true;
}

/** TRUE when the captured evidence closes the derivative's catalog. */
function catalogClosureHolds(bundle) {
  const derivative = parseDerivative(bundle);
  if (!derivative) return false;
  const evidence = bundle?.evidence ?? [];
  const byId = evidenceById(bundle);
  const seen = new Set();
  for (const item of evidence) {
    if (!hasExactKeys(item, REVIEW_BUNDLE_EVIDENCE_KEYS)) return false;
    if (seen.has(String(item.evidenceId))) return false;
    seen.add(String(item.evidenceId));
    if (!EVIDENCE_ID.test(String(item.evidenceId))) return false;
    if (item.taskId !== bundle?.source?.taskId) return false;
    if (!REVIEW_BUNDLE_EVIDENCE_KINDS.includes(String(item.kind))) return false;
    if (!Number.isInteger(item.timestampStartMs) || !Number.isInteger(item.timestampEndMs)) return false;
    if (item.timestampStartMs < 0 || item.timestampEndMs < item.timestampStartMs) return false;
    if (typeof item.contentSha256 !== "string" || !SHA256_HEX.test(item.contentSha256)) return false;
    if (sha256Hex(Buffer.from(normalizeEvidenceText(item.text), "utf8")) !== item.contentSha256) return false;
  }
  for (const evidenceId of referencedEvidenceIds(derivative)) {
    if (!byId.has(evidenceId)) return false;
  }
  return evidenceCatalogSha256(evidence) === derivative.binding?.evidenceCatalogSha256;
}

/** TRUE when the thumbnail set is closed over the evidence. */
function thumbnailsClosureHolds(bundle) {
  const byId = evidenceById(bundle);
  const thumbnails = bundle?.thumbnails ?? [];
  const seen = new Set();
  for (const item of thumbnails) {
    if (!hasExactKeys(item, ["evidenceId", "sha256", "bytes"])) return false;
    if (seen.has(item.evidenceId)) return false;
    seen.add(item.evidenceId);
    if (!isStrictPng(item.bytes)) return false;
    if (sha256Hex(item.bytes) !== item.sha256) return false;
    const record = byId.get(String(item.evidenceId));
    if (!record || record.kind !== "frame") return false;
    if (record.taskId !== bundle?.source?.taskId) return false;
  }
  for (const item of bundle?.evidence ?? []) {
    if (item?.thumbnailAvailable && !seen.has(item.evidenceId)) return false;
  }
  return true;
}

/** TRUE when the seek map closes the derivative's chapters one to one. */
function seekClosureHolds(bundle) {
  const derivative = parseDerivative(bundle);
  if (!derivative) return false;
  const seekMap = bundle?.seekMap ?? null;
  if (!seekMap || seekMap.schemaVersion !== SEEK_MAP_SCHEMA) return false;
  const duration = Number(seekMap.mediaDurationMs);
  if (!Number.isFinite(duration) || duration <= 0) return false;
  const chapters = Array.isArray(seekMap.chapters) ? seekMap.chapters : [];
  const derivativeChapters = Array.isArray(derivative.chapters) ? derivative.chapters : [];
  if (chapters.length !== derivativeChapters.length) return false;
  const byId = evidenceById(bundle);
  const thumbnailIds = new Set((bundle?.thumbnails ?? []).map((item) => String(item?.evidenceId)));
  for (let index = 0; index < chapters.length; index += 1) {
    const row = chapters[index];
    const chapter = derivativeChapters[index];
    if (!hasExactKeys(row, REVIEW_BUNDLE_SEEK_KEYS)) return false;
    if (String(row.chapterId) !== String(chapter?.chapterId)) return false;
    if (String(row.order) !== String(chapter?.order)) return false;
    if (Number(row.startMs) !== Number(chapter?.startMs)) return false;
    if (Number(row.endMs) !== Number(chapter?.endMs)) return false;
    if (!(Number(row.startMs) < Number(row.endMs))) return false;
    if (Number(row.endMs) > duration) return false;
    if (!Number.isInteger(row.seekTimeMs)) return false;
    if (row.seekTimeMs < row.startMs || row.seekTimeMs >= row.endMs) return false;
    if (row.seekTimeMs > duration) return false;
    const cited = (chapter?.evidenceIds ?? []).map(String);
    if (JSON.stringify((row.evidenceIds ?? []).map(String)) !== JSON.stringify(cited)) return false;
    for (const evidenceId of row.evidenceIds ?? []) {
      if (!byId.has(String(evidenceId))) return false;
    }
    const representative = byId.get(String(row.representativeFrameEvidenceId));
    if (!representative) return false;
    if (representative.kind !== "frame") return false;
    if (representative.taskId !== bundle?.source?.taskId) return false;
    if (!thumbnailIds.has(String(representative.evidenceId))) return false;
  }
  return true;
}

/**
 * The CLOSURE of a bundle: the four flags that say what is closed.
 *
 * They are RECOMPUTED from the content, never read from the receipt.
 */
export function bundleClosure(bundle) {
  return {
    identityClosed: identityClosureHolds(bundle),
    catalogClosed: catalogClosureHolds(bundle),
    thumbnailsClosed: thumbnailsClosureHolds(bundle),
    seekClosed: seekClosureHolds(bundle),
  };
}

/**
 * Validate a private review bundle.
 *
 * @param {object} bundle the bundle description (plain data)
 * @returns {{ok: boolean, failures: Array<{code: string, detail: string}>}}
 */
export function validateReviewBundle(bundle) {
  const failures = [];
  const fail = (code, detail) => failures.push({ code, detail });

  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    fail(REVIEW_BUNDLE_FAILURE.SCHEMA, "the bundle is missing");
    return { ok: false, failures };
  }
  if (bundle.schemaVersion !== REVIEW_BUNDLE_SCHEMA) {
    fail(REVIEW_BUNDLE_FAILURE.SCHEMA, `the bundle schema is ${String(bundle.schemaVersion ?? "absent")}`);
  }

  // 1. The source identity: the EXACT key set and the strict grammar.
  const source = bundle.source ?? null;
  if (!hasExactKeys(source, REVIEW_BUNDLE_SOURCE_KEYS)) {
    fail(REVIEW_BUNDLE_FAILURE.SCHEMA, "the source identity has an unexpected key set");
  } else {
    const row = FROZEN_SIX.find((entry) => entry.order === String(source.order));
    if (!row) {
      fail(REVIEW_BUNDLE_FAILURE.IDENTITY, `the order ${String(source.order)} is not a registry order`);
    } else if (source.bvid !== row.bvid) {
      fail(REVIEW_BUNDLE_FAILURE.IDENTITY, `the source is ${String(source.bvid)} instead of ${row.bvid}`);
    }
    if (source.registrySha256 !== ACTIVE_REGISTRY_SHA256) {
      fail(REVIEW_BUNDLE_FAILURE.IDENTITY, "the bundle was produced against another registry");
    }
    if (typeof source.taskId !== "string" || !TASK_ID.test(source.taskId)) {
      fail(REVIEW_BUNDLE_FAILURE.IDENTITY, "the source identity has no valid task id");
    }
    if (!Number.isInteger(source.taskRevision) || source.taskRevision < 1) {
      fail(REVIEW_BUNDLE_FAILURE.IDENTITY, "the source identity has no valid task revision");
    }
    if (typeof source.dependencyGeneration !== "string" || !DEPENDENCY_GENERATION.test(source.dependencyGeneration)) {
      fail(REVIEW_BUNDLE_FAILURE.IDENTITY, "the source identity has no valid dependency generation");
    }
    // The STRICT identity grammar: the portal namespace and the FROZEN
    // adapter are literal. A foreign adapter never satisfies it.
    const identity = parseStrictSourceIdentity(source.sourceIdentity);
    if (!identity) {
      fail(REVIEW_BUNDLE_FAILURE.IDENTITY, "the source identity does not satisfy the frozen grammar");
    } else if (identity.bvid !== source.bvid) {
      fail(REVIEW_BUNDLE_FAILURE.IDENTITY, `the source identity names ${identity.bvid} instead of ${String(source.bvid)}`);
    }
  }

  // 2. The artifact: the exact durable bytes and the frozen contract.
  let derivative = null;
  if (!Buffer.isBuffer(bundle.artifact)) {
    fail(REVIEW_BUNDLE_FAILURE.ARTIFACT, "the durable derivative bytes are missing");
  } else {
    try {
      derivative = JSON.parse(bundle.artifact.toString("utf8"));
    } catch (error) {
      fail(REVIEW_BUNDLE_FAILURE.ARTIFACT, `the durable derivative is not JSON: ${String(error?.message ?? error).slice(0, 120)}`);
    }
  }
  if (derivative) {
    const verdict = validateV21Artifact(derivative);
    if (!verdict.ok) {
      fail(REVIEW_BUNDLE_FAILURE.ARTIFACT, `the derivative does not satisfy the frozen contract: ${verdict.errors.slice(0, 3).join("; ")}`);
    }
    const binding = derivative.binding ?? {};
    for (const [label, artifactValue, declaredValue] of [
      ["task id", binding.taskId, source?.taskId],
      ["task revision", binding.taskRevision, source?.taskRevision],
      ["source identity", binding.sourceIdentity, source?.sourceIdentity],
    ]) {
      if (String(artifactValue) !== String(declaredValue)) {
        fail(REVIEW_BUNDLE_FAILURE.IDENTITY, `the derivative ${label} is ${String(artifactValue)} and the bundle declares ${String(declaredValue)}`);
      }
    }
  }

  // 3. The workspace metadata: the public task facts.
  const workspaceTask = bundle.workspace?.task ?? null;
  if (!workspaceTask || String(workspaceTask.taskId) !== String(source?.taskId)
    || String(workspaceTask.taskRevision) !== String(source?.taskRevision)
    || String(workspaceTask.sourceIdentity) !== String(source?.sourceIdentity)) {
    fail(REVIEW_BUNDLE_FAILURE.IDENTITY, "the workspace metadata does not describe the captured task");
  }

  // 4. The evidence: the EXACT key set, the ids and the text digests.
  const evidence = Array.isArray(bundle.evidence) ? bundle.evidence : [];
  const byId = evidenceById(bundle);
  const seenEvidence = new Set();
  for (const item of evidence) {
    if (!hasExactKeys(item, REVIEW_BUNDLE_EVIDENCE_KEYS)) {
      fail(REVIEW_BUNDLE_FAILURE.SCHEMA, "an evidence record has an unexpected key set");
      continue;
    }
    if (seenEvidence.has(String(item.evidenceId))) {
      fail(REVIEW_BUNDLE_FAILURE.DUPLICATE, `the evidence id ${String(item.evidenceId)} appears twice`);
    }
    seenEvidence.add(String(item.evidenceId));
    if (!EVIDENCE_ID.test(String(item.evidenceId))) {
      fail(REVIEW_BUNDLE_FAILURE.SCHEMA, `the evidence id ${String(item.evidenceId)} is malformed`);
    }
    if (item.taskId !== source?.taskId) {
      fail(REVIEW_BUNDLE_FAILURE.IDENTITY, `the evidence ${String(item.evidenceId)} belongs to another task`);
    }
    if (!REVIEW_BUNDLE_EVIDENCE_KINDS.includes(String(item.kind))) {
      fail(REVIEW_BUNDLE_FAILURE.SCHEMA, `the evidence ${String(item.evidenceId)} has the unknown kind ${String(item.kind)}`);
    }
    if (!Number.isInteger(item.timestampStartMs) || !Number.isInteger(item.timestampEndMs)
      || item.timestampStartMs < 0 || item.timestampEndMs < item.timestampStartMs) {
      fail(REVIEW_BUNDLE_FAILURE.SCHEMA, `the evidence ${String(item.evidenceId)} has an invalid time window`);
    }
    if (typeof item.contentSha256 !== "string" || !SHA256_HEX.test(item.contentSha256)) {
      fail(REVIEW_BUNDLE_FAILURE.SCHEMA, `the evidence ${String(item.evidenceId)} has no valid content digest`);
      continue;
    }
    const textHash = sha256Hex(Buffer.from(normalizeEvidenceText(item.text), "utf8"));
    if (textHash !== item.contentSha256) {
      fail(REVIEW_BUNDLE_FAILURE.EVIDENCE_HASH, `the evidence text of ${String(item.evidenceId)} does not hash to its content digest`);
    }
  }
  if (derivative) {
    for (const evidenceId of referencedEvidenceIds(derivative)) {
      if (!byId.has(evidenceId)) {
        fail(REVIEW_BUNDLE_FAILURE.EVIDENCE_MISSING, `the derivative references the missing evidence ${evidenceId}`);
      }
    }
    const catalogHash = evidenceCatalogSha256(evidence);
    if (catalogHash !== derivative.binding?.evidenceCatalogSha256) {
      fail(REVIEW_BUNDLE_FAILURE.CATALOG, "the captured evidence does not hash to the derivative catalog");
    }
  }

  // 5. The thumbnails: real PNG bytes for every available frame.
  const thumbnails = Array.isArray(bundle.thumbnails) ? bundle.thumbnails : [];
  const thumbnailIds = new Set();
  for (const item of thumbnails) {
    if (!hasExactKeys(item, ["evidenceId", "sha256", "bytes"])) {
      fail(REVIEW_BUNDLE_FAILURE.SCHEMA, "a thumbnail has an unexpected key set");
      continue;
    }
    if (thumbnailIds.has(item.evidenceId)) {
      fail(REVIEW_BUNDLE_FAILURE.DUPLICATE, `the thumbnail ${String(item.evidenceId)} appears twice`);
    }
    thumbnailIds.add(item.evidenceId);
    if (!isStrictPng(item.bytes)) {
      fail(REVIEW_BUNDLE_FAILURE.THUMBNAIL, `the thumbnail of ${String(item.evidenceId)} is not a PNG`);
    }
    if (sha256Hex(item.bytes) !== item.sha256) {
      fail(REVIEW_BUNDLE_FAILURE.THUMBNAIL, `the thumbnail of ${String(item.evidenceId)} does not match its digest`);
    }
    const record = byId.get(String(item.evidenceId));
    if (!record) {
      fail(REVIEW_BUNDLE_FAILURE.EVIDENCE_MISSING, `the thumbnail ${String(item.evidenceId)} has no evidence record`);
    } else if (record.kind !== "frame") {
      fail(REVIEW_BUNDLE_FAILURE.THUMBNAIL, `the thumbnail ${String(item.evidenceId)} is not a frame`);
    }
  }
  for (const item of evidence) {
    if (item?.thumbnailAvailable && !thumbnailIds.has(item.evidenceId)) {
      fail(REVIEW_BUNDLE_FAILURE.THUMBNAIL, `the evidence ${String(item.evidenceId)} declares a thumbnail that was not captured`);
    }
  }

  // 6. The seek map: ONE row per derivative chapter, in-chapter seek and a
  //    real PNG-backed same-task frame.
  const seekMap = bundle.seekMap ?? null;
  if (!seekMap || seekMap.schemaVersion !== SEEK_MAP_SCHEMA) {
    fail(REVIEW_BUNDLE_FAILURE.SEEK, "the seek map has no valid schema");
  } else {
    const duration = Number(seekMap.mediaDurationMs);
    if (!Number.isFinite(duration) || duration <= 0) {
      fail(REVIEW_BUNDLE_FAILURE.SEEK, "the seek map has no media duration");
    }
    const chapters = Array.isArray(seekMap.chapters) ? seekMap.chapters : [];
    const derivativeChapters = Array.isArray(derivative?.chapters) ? derivative.chapters : [];
    if (chapters.length !== derivativeChapters.length) {
      fail(REVIEW_BUNDLE_FAILURE.SEEK, `the seek map carries ${chapters.length} chapter(s) and the derivative carries ${derivativeChapters.length}`);
    }
    derivativeChapters.forEach((chapter, index) => {
      const row = chapters[index];
      if (!hasExactKeys(row, REVIEW_BUNDLE_SEEK_KEYS)) {
        fail(REVIEW_BUNDLE_FAILURE.SEEK, `the seek chapter ${index + 1} has an unexpected key set`);
        return;
      }
      if (String(row.chapterId) !== String(chapter.chapterId)) {
        fail(REVIEW_BUNDLE_FAILURE.SEEK, `the seek chapter ${index + 1} names another chapter`);
      }
      if (String(row.order) !== String(chapter.order)) {
        fail(REVIEW_BUNDLE_FAILURE.SEEK, `the seek chapter ${index + 1} carries another order`);
      }
      if (Number(row.startMs) !== Number(chapter.startMs) || Number(row.endMs) !== Number(chapter.endMs)) {
        fail(REVIEW_BUNDLE_FAILURE.SEEK, `the seek chapter ${index + 1} carries another window`);
      }
      if (!(Number(row.startMs) < Number(row.endMs))) {
        fail(REVIEW_BUNDLE_FAILURE.SEEK, `the seek chapter ${index + 1} has an empty window`);
      }
      if (!Number.isInteger(row.seekTimeMs) || row.seekTimeMs < row.startMs || row.seekTimeMs >= row.endMs) {
        fail(REVIEW_BUNDLE_FAILURE.SEEK, `the seek chapter ${index + 1} has a seek time outside its window`);
      }
      if (Number.isFinite(duration) && (row.seekTimeMs > duration || row.endMs > duration)) {
        fail(REVIEW_BUNDLE_FAILURE.SEEK, `the seek chapter ${index + 1} leaves the media`);
      }
      const cited = (chapter.evidenceIds ?? []).map(String);
      if (JSON.stringify((row.evidenceIds ?? []).map(String)) !== JSON.stringify(cited)) {
        fail(REVIEW_BUNDLE_FAILURE.SEEK, `the seek chapter ${index + 1} cites another evidence set`);
      }
      for (const evidenceId of row.evidenceIds ?? []) {
        if (!byId.has(evidenceId)) {
          fail(REVIEW_BUNDLE_FAILURE.EVIDENCE_MISSING, `the seek chapter ${index + 1} references the missing evidence ${String(evidenceId)}`);
        }
      }
      const representative = byId.get(String(row.representativeFrameEvidenceId));
      if (!representative) {
        fail(REVIEW_BUNDLE_FAILURE.SEEK, `the seek chapter ${index + 1} has no representative frame`);
      } else {
        if (representative.kind !== "frame") {
          fail(REVIEW_BUNDLE_FAILURE.SEEK, `the seek chapter ${index + 1} representative is not a frame`);
        }
        if (representative.taskId !== source?.taskId) {
          fail(REVIEW_BUNDLE_FAILURE.IDENTITY, `the seek chapter ${index + 1} representative belongs to another task`);
        }
        if (!thumbnailIds.has(representative.evidenceId)) {
          fail(REVIEW_BUNDLE_FAILURE.THUMBNAIL, `the seek chapter ${index + 1} representative has no captured PNG`);
        }
      }
    });
  }

  // 7. The PUBLIC capture receipt: DERIVED, never trusted.
  const receipt = bundle.captureReceipt ?? null;
  const derivedReceipt = deriveCaptureReceipt(bundle);
  // The Provider identity is refused FIRST: an extra field is a leak even
  // when the key set is wrong.
  for (const field of FORBIDDEN_RECEIPT_FIELDS) {
    if (receipt && typeof receipt === "object" && field in receipt) {
      fail(REVIEW_BUNDLE_FAILURE.PROVIDER_LEAK, `the public capture receipt carries ${field}`);
    }
  }
  if (!hasExactKeys(receipt, REVIEW_BUNDLE_RECEIPT_KEYS)) {
    fail(REVIEW_BUNDLE_FAILURE.RECEIPT, "the capture receipt has an unexpected key set");
  } else {
    if (receipt.schemaVersion !== CAPTURE_RECEIPT_SCHEMA) {
      fail(REVIEW_BUNDLE_FAILURE.RECEIPT, `the capture receipt schema is ${String(receipt.schemaVersion)}`);
    }
    if (!hasExactKeys(receipt.counts ?? null, REVIEW_BUNDLE_RECEIPT_COUNT_KEYS)) {
      fail(REVIEW_BUNDLE_FAILURE.RECEIPT, "the capture receipt has an unexpected count set");
    } else if (receipt.counts.evidence !== derivedReceipt.counts.evidence
      || receipt.counts.thumbnails !== derivedReceipt.counts.thumbnails
      || receipt.counts.chapters !== derivedReceipt.counts.chapters) {
      fail(REVIEW_BUNDLE_FAILURE.RECEIPT, "the capture receipt counts do not match the bundle");
    }
    if (!hasExactKeys(receipt.digests ?? null, REVIEW_BUNDLE_RECEIPT_DIGEST_KEYS)) {
      fail(REVIEW_BUNDLE_FAILURE.RECEIPT, "the capture receipt has an unexpected digest set");
    } else {
      for (const key of REVIEW_BUNDLE_RECEIPT_DIGEST_KEYS) {
        if (typeof receipt.digests[key] !== "string" || !SHA256_HEX.test(receipt.digests[key])) {
          fail(REVIEW_BUNDLE_FAILURE.RECEIPT, `the capture receipt has no valid ${key}`);
        }
      }
      if (receipt.digests.artifactSha256 !== derivedReceipt.digests.artifactSha256) {
        fail(REVIEW_BUNDLE_FAILURE.RECEIPT, "the capture receipt artifact digest does not match the bytes");
      }
      if (receipt.digests.evidenceCatalogSha256 !== derivedReceipt.digests.evidenceCatalogSha256) {
        fail(REVIEW_BUNDLE_FAILURE.RECEIPT, "the capture receipt catalog digest does not match the evidence");
      }
      if (receipt.digests.bundleSha256 !== derivedReceipt.digests.bundleSha256) {
        fail(REVIEW_BUNDLE_FAILURE.RECEIPT, "the capture receipt bundle digest does not match the content");
      }
      if (receipt.digests.reviewBindingSha256 !== derivedReceipt.digests.reviewBindingSha256) {
        fail(REVIEW_BUNDLE_FAILURE.RECEIPT, "the capture receipt review binding does not match the artifact");
      }
    }
    if (!hasExactKeys(receipt.closure ?? null, REVIEW_BUNDLE_RECEIPT_CLOSURE_KEYS)) {
      fail(REVIEW_BUNDLE_FAILURE.RECEIPT, "the capture receipt has an unexpected closure set");
    } else {
      for (const [key, value] of Object.entries(receipt.closure)) {
        if (value !== true) {
          fail(REVIEW_BUNDLE_FAILURE.RECEIPT, `the capture receipt closure flag ${key} is false`);
        }
      }
    }
    if (receipt.status !== "captured") {
      fail(REVIEW_BUNDLE_FAILURE.RECEIPT, `the capture receipt status is ${String(receipt.status)}`);
    }
  }

  // 8. No secret, no absolute path, no raw media anywhere in the bundle.
  const serialized = collectText(bundle);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(serialized)) {
      fail(REVIEW_BUNDLE_FAILURE.SECRET, `the bundle carries a secret matching ${String(pattern)}`);
      break;
    }
  }
  const paths = detectAbsolutePaths(serialized);
  if (paths.length > 0) {
    fail(REVIEW_BUNDLE_FAILURE.ABSOLUTE_PATH, `the bundle carries ${paths.length} absolute path(s)`);
  }
  for (const entry of bundle.manifest ?? []) {
    const name = String(entry?.path ?? "");
    if (RAW_MEDIA_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension))) {
      fail(REVIEW_BUNDLE_FAILURE.RAW_MEDIA, `the bundle carries the raw media file ${name}`);
    }
  }

  // 9. The MANIFEST: the path grammar, then the bytes.
  const manifest = Array.isArray(bundle.manifest) ? bundle.manifest : [];
  const manifestPaths = new Set();
  for (const entry of manifest) {
    const name = String(entry?.path ?? "");
    if (!hasExactKeys(entry, REVIEW_BUNDLE_MANIFEST_ENTRY_KEYS)) {
      fail(REVIEW_BUNDLE_FAILURE.SCHEMA, "a manifest entry has an unexpected key set");
      continue;
    }
    // The strict relative path grammar, checked BEFORE any file is opened.
    if (!REVIEW_BUNDLE_PATH_GRAMMAR.test(name) || name.split("/").some((part) => part === "..")) {
      fail(REVIEW_BUNDLE_FAILURE.MANIFEST_PATH, `the manifest path ${name} is not a contracted relative name`);
      continue;
    }
    if (manifestPaths.has(name)) {
      fail(REVIEW_BUNDLE_FAILURE.DUPLICATE, `the manifest lists ${name} twice`);
    }
    manifestPaths.add(name);
    if (!Buffer.isBuffer(entry.bytes)) {
      fail(REVIEW_BUNDLE_FAILURE.MANIFEST, `the manifest entry ${name} has no bytes`);
      continue;
    }
    if (sha256Hex(entry.bytes) !== entry.sha256) {
      fail(REVIEW_BUNDLE_FAILURE.MANIFEST, `the manifest entry ${name} does not match its digest`);
    }
  }
  for (const name of REVIEW_BUNDLE_FILES) {
    if (!manifestPaths.has(name)) {
      fail(REVIEW_BUNDLE_FAILURE.MANIFEST, `the manifest lacks ${name}`);
    }
  }
  const thumbnailNames = new Set(thumbnails.map((item) => `${REVIEW_BUNDLE_THUMBNAIL_DIR}/${String(item?.evidenceId)}.png`));
  for (const name of thumbnailNames) {
    if (!manifestPaths.has(name)) {
      fail(REVIEW_BUNDLE_FAILURE.MANIFEST, `the manifest lacks the thumbnail ${name}`);
    }
  }
  for (const name of manifestPaths) {
    if (!REVIEW_BUNDLE_FILES.includes(name) && !thumbnailNames.has(name)) {
      fail(REVIEW_BUNDLE_FAILURE.MANIFEST, `the manifest carries the unexpected file ${name}`);
    }
  }

  // 10. THE BYTE CLOSURE: every contracted file is REBUILT from the parsed
  //     bundle and compared byte-for-byte with the manifest entry. A detached
  //     manifest payload is a refusal even when its own digest agrees.
  const rebuilt = encodeBundleFiles(bundle);
  for (const [name, canonical] of rebuilt.entries()) {
    const entry = manifest.find((item) => String(item?.path) === name);
    if (!entry || !Buffer.isBuffer(entry.bytes)) continue;
    if (!canonical.equals(entry.bytes)) {
      fail(REVIEW_BUNDLE_FAILURE.MANIFEST, `the manifest bytes of ${name} are not the canonical bytes of the bundle`);
    }
  }
  if (Buffer.isBuffer(bundle.manifestBytes)) {
    const manifestText = Buffer.from(encodeManifestText(rebuilt), "utf8");
    if (!bundle.manifestBytes.equals(manifestText)) {
      fail(REVIEW_BUNDLE_FAILURE.MANIFEST, "the manifest text is not the canonical manifest of the bundle");
    }
  }

  return { ok: failures.length === 0, failures };
}

/**
 * The semantic TEXT of the bundle.
 *
 * Thumbnail bytes and the manifest's duplicate payload bytes are binary
 * evidence, not text. Decoding arbitrary PNG/deflate bytes as UTF-8 can
 * manufacture path-looking substrings and reject a clean real capture. The
 * artifact is the one textual byte payload, so it is scanned explicitly;
 * every structured string is scanned through the object walk.
 */
export function collectText(bundle) {
  const parts = [];
  const walk = (value, depth) => {
    if (depth > 12) return;
    if (typeof value === "string") {
      parts.push(value);
      return;
    }
    if (Buffer.isBuffer(value)) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    if (value && typeof value === "object") {
      for (const item of Object.values(value)) walk(item, depth + 1);
    }
  };
  walk({
    schemaVersion: bundle?.schemaVersion,
    source: bundle?.source,
    workspace: bundle?.workspace,
    evidence: bundle?.evidence,
    seekMap: bundle?.seekMap,
    captureReceipt: bundle?.captureReceipt,
    manifest: (bundle?.manifest ?? []).map((entry) => ({
      path: entry?.path,
      sha256: entry?.sha256,
    })),
  }, 0);
  if (Buffer.isBuffer(bundle?.artifact)) {
    parts.push(bundle.artifact.toString("utf8"));
  }
  return parts.join("\n");
}
