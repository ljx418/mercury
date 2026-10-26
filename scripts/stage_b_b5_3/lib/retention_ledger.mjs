// The PRIVATE ARTIFACT RETENTION LEDGER.
//
// One owner for the disposition of the private artifacts of a candidate. A
// retained artifact is DIAGNOSIS-ONLY: it is never eligible as a candidate
// row, as a blind-review input, as a sentinel or as the evidence of a future
// positive machine gate.
//
// The ledger has TWO forms and the split is exact:
//
//   * the PRIVATE record owns the owned ROOT path and stays OUTSIDE the
//     public package;
//   * the PUBLIC projection carries a NON-REVERSIBLE root reference, the
//     policy enums, the owner reference, the deadline, the digests and the
//     deletion-receipt state. It never carries a path.
//
// A retention record NEVER implies a B7 authorization. It names the owner,
// the deadline and the deletion-receipt requirement, and it records the
// digests that a future execution must REFUSE.

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { detectAbsolutePaths } from "./privacy.mjs";

/** The retention ledger schema version. */
export const RETENTION_LEDGER_SCHEMA = "v3-5.10-b6-retention-ledger/v1";

/** The public retention projection schema version. */
export const RETENTION_PUBLIC_SCHEMA = "v3-5.10-b6-retention-public/v1";

/** The stable retention defect codes. */
export const RETENTION_FAILURE = Object.freeze({
  SCHEMA: "RETENTION_LEDGER_SCHEMA_INVALID",
  NOT_DIAGNOSIS_ONLY: "RETENTION_ARTIFACT_NOT_DIAGNOSIS_ONLY",
  OWNER_MISSING: "RETENTION_ARTIFACT_OWNER_MISSING",
  DEADLINE_MISSING: "RETENTION_ARTIFACT_DEADLINE_MISSING",
  DEADLINE_INVALID: "RETENTION_ARTIFACT_DEADLINE_INVALID",
  DELETION_RECEIPT: "RETENTION_ARTIFACT_DELETION_RECEIPT_MISSING",
  SPENT_ARTIFACT: "RETENTION_SPENT_ARTIFACT_REUSED",
  DIGEST_INVALID: "RETENTION_ARTIFACT_DIGEST_INVALID",
  DIGEST_DUPLICATE: "RETENTION_ARTIFACT_DIGEST_DUPLICATE",
  PUBLIC_PATH: "RETENTION_PUBLIC_PROJECTION_PATH_LEAK",
  PUBLIC_SCHEMA: "RETENTION_PUBLIC_PROJECTION_SCHEMA_INVALID",
  OWNER_INVALID: "RETENTION_ARTIFACT_OWNER_INVALID",
});

/** The deletion-receipt states of a public retention projection. */
export const RETENTION_DELETION_STATES = Object.freeze([
  "required-not-received",
  "received",
]);

/** The EXACT key set of a public retention projection. */
export const RETENTION_PUBLIC_KEYS = Object.freeze([
  "schemaVersion", "runId", "artifactKind", "diagnosisOnly",
  "eligibleAsCandidateRow", "eligibleAsBlindReviewInput", "eligibleAsSentinel",
  "eligibleAsFutureMachineGateEvidence", "impliesB7Authorization",
  "owner", "deadlineUtc", "deletionReceiptRequired", "deletionReceiptState",
  "rootReference", "digestCount", "digests",
]);

const SHA256_HEX = /^[0-9a-f]{64}$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Build the PRIVATE retention record of ONE private root.
 *
 * The record is machine-readable: it is the only thing that decides whether
 * a private artifact may ever be used again.
 */
export function buildRetentionRecord({
  runId,
  artifactKind,
  root,
  owner,
  deadlineUtc,
  digests = [],
  diagnosisOnly = true,
  deletionReceiptRequired = true,
  deletionReceiptState = "required-not-received",
  note = null,
} = {}) {
  return {
    schemaVersion: RETENTION_LEDGER_SCHEMA,
    batch: "GC-B6 PRIVATE ARTIFACT RETENTION",
    runId: runId ?? null,
    artifactKind: artifactKind ?? null,
    // The DISPOSITION: the artifacts are kept for diagnosis only.
    diagnosisOnly: diagnosisOnly === true,
    eligibleAsCandidateRow: false,
    eligibleAsBlindReviewInput: false,
    eligibleAsSentinel: false,
    eligibleAsFutureMachineGateEvidence: false,
    impliesB7Authorization: false,
    owner: owner ?? null,
    deadlineUtc: deadlineUtc ?? null,
    deletionReceiptRequired: deletionReceiptRequired === true,
    deletionReceiptState: RETENTION_DELETION_STATES.includes(deletionReceiptState)
      ? deletionReceiptState
      : "required-not-received",
    // The OWNED ROOT: it stays in the PRIVATE record only.
    root: root ?? null,
    digests: [...digests].sort(),
    note: note ?? null,
    createdAtUtc: new Date().toISOString(),
  };
}

/**
 * The defects of a PRIVATE retention record.
 */
export function retentionRecordDefects(record) {
  const codes = [];
  if (!record || typeof record !== "object" || record.schemaVersion !== RETENTION_LEDGER_SCHEMA) {
    return { ok: false, codes: [RETENTION_FAILURE.SCHEMA] };
  }
  if (record.diagnosisOnly !== true) codes.push(RETENTION_FAILURE.NOT_DIAGNOSIS_ONLY);
  for (const key of [
    "eligibleAsCandidateRow",
    "eligibleAsBlindReviewInput",
    "eligibleAsSentinel",
    "eligibleAsFutureMachineGateEvidence",
    "impliesB7Authorization",
  ]) {
    if (record[key] !== false) codes.push(RETENTION_FAILURE.NOT_DIAGNOSIS_ONLY);
  }
  if (!record.owner) codes.push(RETENTION_FAILURE.OWNER_MISSING);
  if (!record.deadlineUtc) codes.push(RETENTION_FAILURE.DEADLINE_MISSING);
  if (record.deletionReceiptRequired !== true) codes.push(RETENTION_FAILURE.DELETION_RECEIPT);
  return { ok: codes.length === 0, codes: [...new Set(codes)].sort() };
}

/**
 * The PUBLIC projection of a private retention record.
 *
 * The projection NEVER carries the owned root: it carries a NON-REVERSIBLE
 * reference (the digest of the root path) instead. The projection is the
 * only form that may enter a public evidence package.
 */
export function publicRetentionProjection(record) {
  if (!record || typeof record !== "object") return null;
  const root = typeof record.root === "string" ? record.root : null;
  return {
    schemaVersion: RETENTION_PUBLIC_SCHEMA,
    runId: record.runId ?? null,
    artifactKind: record.artifactKind ?? null,
    diagnosisOnly: record.diagnosisOnly === true,
    eligibleAsCandidateRow: false,
    eligibleAsBlindReviewInput: false,
    eligibleAsSentinel: false,
    eligibleAsFutureMachineGateEvidence: false,
    impliesB7Authorization: false,
    owner: record.owner ?? null,
    deadlineUtc: record.deadlineUtc ?? null,
    deletionReceiptRequired: record.deletionReceiptRequired === true,
    deletionReceiptState: RETENTION_DELETION_STATES.includes(record.deletionReceiptState)
      ? record.deletionReceiptState
      : "required-not-received",
    // The root reference: a digest, never a path.
    rootReference: root === null ? null : sha256(root),
    digestCount: Array.isArray(record.digests) ? record.digests.length : 0,
    digests: [...(record.digests ?? [])].sort(),
  };
}

/**
 * The defects of a PUBLIC retention projection.
 *
 * A projection that carries a path, a malformed deadline, a malformed owner
 * or a malformed digest is refused: the public package is generated, never
 * transcribed.
 */
export function publicRetentionDefects(projection) {
  const codes = [];
  if (!projection || typeof projection !== "object" || projection.schemaVersion !== RETENTION_PUBLIC_SCHEMA) {
    return { ok: false, codes: [RETENTION_FAILURE.PUBLIC_SCHEMA] };
  }
  const actual = Object.keys(projection).sort();
  const expected = [...RETENTION_PUBLIC_KEYS].sort();
  if (actual.length !== expected.length || !actual.every((key, index) => key === expected[index])) {
    codes.push(RETENTION_FAILURE.PUBLIC_SCHEMA);
  }
  if (projection.diagnosisOnly !== true) codes.push(RETENTION_FAILURE.NOT_DIAGNOSIS_ONLY);
  for (const key of [
    "eligibleAsCandidateRow",
    "eligibleAsBlindReviewInput",
    "eligibleAsSentinel",
    "eligibleAsFutureMachineGateEvidence",
    "impliesB7Authorization",
  ]) {
    if (projection[key] !== false) codes.push(RETENTION_FAILURE.NOT_DIAGNOSIS_ONLY);
  }
  if (typeof projection.owner !== "string" || !projection.owner.trim()
    || projection.owner.length > 200 || detectAbsolutePaths(projection.owner).length > 0) {
    codes.push(RETENTION_FAILURE.OWNER_INVALID);
  }
  if (typeof projection.deadlineUtc !== "string" || !projection.deadlineUtc) {
    codes.push(RETENTION_FAILURE.DEADLINE_MISSING);
  } else if (!UTC_TIMESTAMP.test(projection.deadlineUtc)
    || Number.isNaN(Date.parse(projection.deadlineUtc))) {
    codes.push(RETENTION_FAILURE.DEADLINE_INVALID);
  }
  if (projection.deletionReceiptRequired !== true) codes.push(RETENTION_FAILURE.DELETION_RECEIPT);
  if (!RETENTION_DELETION_STATES.includes(projection.deletionReceiptState)) {
    codes.push(RETENTION_FAILURE.DELETION_RECEIPT);
  }
  if (typeof projection.rootReference !== "string" || !SHA256_HEX.test(projection.rootReference)) {
    codes.push(RETENTION_FAILURE.PUBLIC_SCHEMA);
  }
  if (!Array.isArray(projection.digests)) {
    codes.push(RETENTION_FAILURE.DIGEST_INVALID);
  } else {
    const seen = new Set();
    for (const digest of projection.digests) {
      if (typeof digest !== "string" || !SHA256_HEX.test(digest)) {
        codes.push(RETENTION_FAILURE.DIGEST_INVALID);
        continue;
      }
      if (seen.has(digest)) codes.push(RETENTION_FAILURE.DIGEST_DUPLICATE);
      seen.add(digest);
    }
    if (Number(projection.digestCount) !== projection.digests.length) {
      codes.push(RETENTION_FAILURE.DIGEST_INVALID);
    }
  }
  // The projection may never carry a path: the whole serialized form is
  // scanned, not only the root field.
  if (detectAbsolutePaths(JSON.stringify(projection)).length > 0) {
    codes.push(RETENTION_FAILURE.PUBLIC_PATH);
  }
  return { ok: codes.length === 0, codes: [...new Set(codes)].sort() };
}

/**
 * The digests of the private artifacts of a root.
 *
 * The digests are the REJECTION KEYS: a future execution that finds one of
 * them must refuse the artifact.
 */
export function collectArtifactDigests(root, { limit = 4096 } = {}) {
  // The digests are a SET: two byte-identical artifacts are ONE digest. The
  // public retention validator is strict and refuses a duplicate, so the
  // owner may never produce one.
  const digests = new Set();
  if (!root || !fs.existsSync(root)) return [];
  const stack = [root];
  while (stack.length > 0 && digests.size < limit) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(child);
        continue;
      }
      if (!entry.isFile()) continue;
      digests.add(sha256(fs.readFileSync(child)));
    }
  }
  return [...digests].sort();
}

/**
 * TRUE when a digest belongs to a SPENT or DIAGNOSIS-ONLY artifact.
 *
 * A future execution MUST refuse such an artifact: the negative run is
 * retained as an honest failed candidate and it may never be merged into a
 * new one.
 */
export function isRetainedArtifactDigest(digest, { retentionRecords = [] } = {}) {
  for (const record of retentionRecords) {
    if (!Array.isArray(record?.digests)) continue;
    if (record.digests.includes(digest)) return true;
  }
  return false;
}

/**
 * Refuse the retained artifacts of a candidate input.
 *
 * @returns {{ok: boolean, refused: string[]}}
 */
export function rejectRetainedArtifacts({ digests = [], retentionRecords = [] } = {}) {
  const refused = digests.filter((digest) => isRetainedArtifactDigest(digest, { retentionRecords }));
  return { ok: refused.length === 0, refused: refused.sort() };
}
