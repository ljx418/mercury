// The INTERNAL candidate authority of the B-6 semantic review.
//
// ONE object assembles the authority of a candidate: the run, the registry,
// the machine gate, the exact six ordered source identities and their task,
// revision, dependency generation, derivative hash, bundle hash and blind
// review-binding hash, plus the capture status and the closure counts.
//
// There are NO DEFAULTS: a missing field is a defect, never a permission to
// skip a comparison. The B-6 aggregate REQUIRES this object.

import { ACTIVE_REGISTRY_SHA256, FROZEN_PORTAL_ID, FROZEN_SIX } from "./registry.mjs";

/** The authority's schema version. */
export const B6_AUTHORITY_SCHEMA = "v3-5.10-b6-candidate-authority/v1";

/** The EXACT key set of one authority source. */
export const B6_AUTHORITY_SOURCE_KEYS = Object.freeze([
  "order", "bvid", "taskId", "taskRevision", "sourceIdentity",
  "dependencyGeneration", "derivativeSha256", "captureArtifactSha256",
  "bundleSha256", "reviewBindingSha256", "captureStatus", "captureCounts",
  "captureClosure",
]);

export const B6_CAPTURE_COUNT_KEYS = Object.freeze(["evidence", "thumbnails", "chapters"]);
export const B6_CAPTURE_CLOSURE_KEYS = Object.freeze([
  "identityClosed", "catalogClosed", "thumbnailsClosed", "seekClosed",
]);

/** The EXACT key set of the authority. */
export const B6_AUTHORITY_KEYS = Object.freeze([
  "schemaVersion", "runId", "registrySha256", "machineGatePositive",
  "captureStatus", "closureCounts", "sources",
]);

const SHA256_HEX = /^[0-9a-f]{64}$/;
const TASK_ID = /^media_task_[a-f0-9]{32}$/;
const DEPENDENCY_GENERATION = /^depgen_[a-f0-9]{64}$/;
const BVID = /^BV[0-9A-Za-z]{10}$/;
const IDENTITY_TOKEN = /^[A-Za-z0-9_-]{1,32}$/;

function hasExactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

/**
 * Assemble the candidate authority.
 *
 * The builder does NOT invent a fact: it copies what the machine receipts
 * and the capture receipts carry.
 */
export function buildCandidateAuthority({
  runId,
  registrySha256,
  machineGatePositive,
  sources,
  captureStatus,
  closureCounts,
} = {}) {
  return {
    schemaVersion: B6_AUTHORITY_SCHEMA,
    runId: runId ?? null,
    registrySha256: registrySha256 ?? null,
    machineGatePositive: machineGatePositive === true,
    captureStatus: captureStatus ?? null,
    closureCounts: {
      evidence: Number(closureCounts?.evidence ?? 0),
      thumbnails: Number(closureCounts?.thumbnails ?? 0),
      chapters: Number(closureCounts?.chapters ?? 0),
    },
    sources: (sources ?? []).map((source) => ({
      order: String(source?.order ?? ""),
      bvid: source?.bvid ?? null,
      taskId: source?.taskId ?? null,
      taskRevision: source?.taskRevision ?? null,
      sourceIdentity: source?.sourceIdentity ?? null,
      dependencyGeneration: source?.dependencyGeneration ?? null,
      derivativeSha256: source?.derivativeSha256 ?? null,
      captureArtifactSha256: source?.captureArtifactSha256 ?? null,
      bundleSha256: source?.bundleSha256 ?? null,
      reviewBindingSha256: source?.reviewBindingSha256 ?? null,
      captureStatus: source?.captureStatus ?? null,
      captureCounts: {
        evidence: source?.captureCounts?.evidence ?? null,
        thumbnails: source?.captureCounts?.thumbnails ?? null,
        chapters: source?.captureCounts?.chapters ?? null,
      },
      captureClosure: {
        identityClosed: source?.captureClosure?.identityClosed ?? null,
        catalogClosed: source?.captureClosure?.catalogClosed ?? null,
        thumbnailsClosed: source?.captureClosure?.thumbnailsClosed ?? null,
        seekClosed: source?.captureClosure?.seekClosed ?? null,
      },
    })),
  };
}

/**
 * The defects of a candidate authority.
 *
 * @param {object|null} authority
 * @param {object} expected the expected registry identities
 * @returns {string[]} the defects; an empty array means the authority is complete and exact
 */
export function candidateAuthorityDefects(authority, expected = {}) {
  const defects = [];
  if (!authority || typeof authority !== "object" || Array.isArray(authority)) {
    return ["the candidate authority is missing"];
  }
  if (!hasExactKeys(authority, B6_AUTHORITY_KEYS)) {
    defects.push("the candidate authority has an unexpected key set");
  }
  if (authority.schemaVersion !== B6_AUTHORITY_SCHEMA) {
    defects.push(`the candidate authority schema is ${String(authority.schemaVersion ?? "absent")}`);
  }
  if (typeof authority.runId !== "string" || !authority.runId.trim()) {
    defects.push("the candidate authority has no run id");
  }
  if (typeof authority.registrySha256 !== "string" || !SHA256_HEX.test(authority.registrySha256)) {
    defects.push("the candidate authority has no valid registry digest");
  } else if (authority.registrySha256 !== ACTIVE_REGISTRY_SHA256) {
    defects.push("the candidate authority was produced against another registry");
  } else if (expected.registrySha256 && authority.registrySha256 !== expected.registrySha256) {
    defects.push("the candidate authority does not match the requested registry");
  }
  // The machine gate is REQUIRED and it must be POSITIVE. There is no
  // default: a missing or false gate is a defect.
  if (authority.machineGatePositive !== true) {
    defects.push("the candidate authority does not carry a positive machine gate");
  }
  if (authority.captureStatus !== "captured") {
    defects.push(`the candidate authority capture status is ${String(authority.captureStatus ?? "absent")}`);
  }
  const counts = authority.closureCounts;
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
    defects.push("the candidate authority has no closure counts");
  } else {
    if (!hasExactKeys(counts, B6_CAPTURE_COUNT_KEYS)) {
      defects.push("the candidate authority closure counts have an unexpected key set");
    }
    for (const key of B6_CAPTURE_COUNT_KEYS) {
      if (!Number.isInteger(counts[key]) || counts[key] <= 0) {
        defects.push(`the candidate authority has no valid ${key} count`);
      }
    }
  }
  const sources = authority.sources;
  if (!Array.isArray(sources) || sources.length !== FROZEN_SIX.length) {
    defects.push(`the candidate authority carries ${Array.isArray(sources) ? sources.length : "no"} source(s), exactly ${FROZEN_SIX.length} are required`);
    return defects;
  }
  FROZEN_SIX.forEach((row, index) => {
    const source = sources[index];
    if (!hasExactKeys(source, B6_AUTHORITY_SOURCE_KEYS)) {
      defects.push(`the authority source ${index + 1} has an unexpected key set`);
      return;
    }
    if (String(source.order) !== row.order) {
      defects.push(`the authority source ${index + 1} carries order ${String(source.order)} instead of ${row.order}`);
    }
    if (source.bvid !== row.bvid) {
      defects.push(`the authority source ${index + 1} carries ${String(source.bvid)} instead of ${row.bvid}`);
    }
    if (typeof source.taskId !== "string" || !TASK_ID.test(source.taskId)) {
      defects.push(`the authority source ${index + 1} has no valid task id`);
    }
    if (!Number.isInteger(source.taskRevision) || source.taskRevision < 1) {
      defects.push(`the authority source ${index + 1} has no valid task revision`);
    }
    const identity = typeof source.sourceIdentity === "string"
      ? source.sourceIdentity.split(":")
      : [];
    if (identity.length !== 5 || identity[0] !== "portal" || identity[1] !== FROZEN_PORTAL_ID
      || identity[2] !== row.bvid || !IDENTITY_TOKEN.test(identity[3] ?? "")
      || !IDENTITY_TOKEN.test(identity[4] ?? "")) {
      defects.push(`the authority source ${index + 1} has no valid source identity`);
    }
    if (typeof source.dependencyGeneration !== "string" || !DEPENDENCY_GENERATION.test(source.dependencyGeneration)) {
      defects.push(`the authority source ${index + 1} has no valid dependency generation`);
    }
    for (const key of ["derivativeSha256", "captureArtifactSha256", "bundleSha256", "reviewBindingSha256"]) {
      if (typeof source[key] !== "string" || !SHA256_HEX.test(source[key])) {
        defects.push(`the authority source ${index + 1} has no valid ${key}`);
      }
    }
    if (source.captureArtifactSha256 !== source.derivativeSha256) {
      defects.push(`the authority source ${index + 1} capture artifact does not match the machine derivative`);
    }
    if (source.captureStatus !== "captured") {
      defects.push(`the authority source ${index + 1} was not captured`);
    }
    if (!hasExactKeys(source.captureCounts, B6_CAPTURE_COUNT_KEYS)) {
      defects.push(`the authority source ${index + 1} capture counts have an unexpected key set`);
    } else {
      for (const key of B6_CAPTURE_COUNT_KEYS) {
        if (!Number.isInteger(source.captureCounts[key]) || source.captureCounts[key] <= 0) {
          defects.push(`the authority source ${index + 1} has no positive ${key} count`);
        }
      }
    }
    if (!hasExactKeys(source.captureClosure, B6_CAPTURE_CLOSURE_KEYS)) {
      defects.push(`the authority source ${index + 1} capture closure has an unexpected key set`);
    } else {
      for (const key of B6_CAPTURE_CLOSURE_KEYS) {
        if (source.captureClosure[key] !== true) {
          defects.push(`the authority source ${index + 1} has not closed ${key}`);
        }
      }
    }
  });
  if (sources.length === FROZEN_SIX.length && counts && typeof counts === "object") {
    for (const key of B6_CAPTURE_COUNT_KEYS) {
      const total = sources.reduce((sum, source) => sum + Number(source?.captureCounts?.[key] ?? 0), 0);
      if (counts[key] !== total) {
        defects.push(`the candidate authority ${key} total does not equal its source receipts`);
      }
    }
  }
  return defects;
}

/** The authority source of one order, or null. */
export function authoritySource(authority, order) {
  const sources = Array.isArray(authority?.sources) ? authority.sources : [];
  return sources.find((source) => String(source?.order) === String(order)) ?? null;
}
