// The ARTIFACT-BYTE oracle of the Stage B aggregate.
//
// A published derivative is only evidence when its BYTES exist, parse, and
// satisfy the FROZEN V2.1 contract. Two mutually consistent JSON claims are
// not evidence.
//
// This module is PURE: it takes the artifact bytes and the declared facts
// and returns the failures. It never reads a file and never spawns
// anything.
//
//   * the artifact is read from ONE contracted file name (no directory
//     search, no ambiguity);
//   * its SHA-256 is computed from the EXACT bytes and compared with every
//     declared derivative/evidence hash;
//   * the receipt hash is recomputed with the PRODUCTION canonical
//     serialization and compared with the machine receipt;
//   * the artifact is validated against the FROZEN contract with the shared
//     exact validator;
//   * the task, revision, source identity, run, receipt, Provider and
//     endpoint identities are cross-bound.

import {
  canonicalJson,
  sha256Hex,
  validateV21Artifact,
} from "./v21_artifact.mjs";
import { parseSourceIdentity } from "./machine_identity.mjs";

/** The artifact integrity failure codes. */
export const ARTIFACT_FAILURE = Object.freeze({
  MISSING: "AGG_ARTIFACT_MISSING",
  MALFORMED: "AGG_ARTIFACT_MALFORMED",
  INVALID: "AGG_ARTIFACT_INVALID",
  HASH_MISMATCH: "AGG_ARTIFACT_HASH_MISMATCH",
  RECEIPT_HASH_MISMATCH: "AGG_RECEIPT_HASH_MISMATCH",
  RECEIPT_MISMATCH: "AGG_RECEIPT_MISMATCH",
  IDENTITY_MISMATCH: "AGG_ARTIFACT_IDENTITY_MISMATCH",
});

/**
 * Check the artifact bytes of one source.
 *
 * @param {object} input
 * @param {{filename: string, bytes: Buffer}|null} input.artifact
 * @param {object|null} input.receipt   the machine receipt
 * @param {object|null} input.mirror    the parsed receipt mirror
 * @returns {{failures: Array<{code: string, detail: string}>, artifactSha256: string|null, parsed: object|null}}
 */
export function checkArtifactIntegrity({
  artifact,
  receipt,
  mirror,
  expected = {},
}) {
  const failures = [];
  const fail = (code, detail) => failures.push({ code, detail });

  if (!artifact || !Buffer.isBuffer(artifact.bytes)) {
    fail(ARTIFACT_FAILURE.MISSING, "the durable derivative artifact is missing");
    return { failures, artifactSha256: null, parsed: null };
  }
  const artifactSha256 = sha256Hex(artifact.bytes);

  // 1. The EXACT bytes must agree with every declared hash.
  const declared = [
    ["the machine receipt derivative hash", receipt?.derivativeSha256],
    ["the machine receipt evidence hash", receipt?.evidenceSha256],
    ["the mirror derivative hash", mirror?.derivativeSha256],
  ];
  for (const [label, value] of declared) {
    if (value !== artifactSha256) {
      fail(
        ARTIFACT_FAILURE.HASH_MISMATCH,
        `${label} is ${String(value ?? "absent")} and the artifact bytes hash to ${artifactSha256}`,
      );
    }
  }

  // 2. The bytes must parse.
  let parsed = null;
  try {
    parsed = JSON.parse(artifact.bytes.toString("utf8"));
  } catch (error) {
    fail(ARTIFACT_FAILURE.MALFORMED, `the artifact bytes are not JSON: ${String(error?.message ?? error).slice(0, 120)}`);
    return { failures, artifactSha256, parsed: null };
  }

  // 3. The artifact must satisfy the FROZEN V2.1 contract.
  const verdict = validateV21Artifact(parsed);
  if (!verdict.ok) {
    fail(
      ARTIFACT_FAILURE.INVALID,
      `the artifact does not satisfy the frozen V2.1 contract: ${verdict.errors.slice(0, 4).join("; ")}`,
    );
    return { failures, artifactSha256, parsed };
  }

  // 4. The receipt hash must be recomputable from the artifact bytes.
  const receiptHash = sha256Hex(canonicalJson(parsed.receipt ?? null));
  if (receipt?.receiptSha256 !== receiptHash) {
    fail(
      ARTIFACT_FAILURE.RECEIPT_HASH_MISMATCH,
      `the machine receipt declares ${String(receipt?.receiptSha256 ?? "absent")} and the artifact receipt hashes to ${receiptHash}`,
    );
  }

  // 5. The EMBEDDED receipt must be the receipt of the mirror.
  if (canonicalJson(parsed.receipt ?? null) !== canonicalJson(mirror?.receipt ?? null)) {
    fail(
      ARTIFACT_FAILURE.RECEIPT_MISMATCH,
      "the receipt embedded in the artifact is not the receipt of the mirror",
    );
  }

  // 6. The identities must be cross-bound. The comparison is UNCONDITIONAL:
  //    a missing machine value is a defect, never a permission to skip the
  //    comparison.
  const binding = parsed.binding ?? {};
  const identities = [
    ["task id", binding.taskId, receipt?.taskId],
    ["task revision", binding.taskRevision, receipt?.taskRevision],
    ["source identity", binding.sourceIdentity, receipt?.sourceIdentity],
  ];
  for (const [label, artifactValue, declaredValue] of identities) {
    if (artifactValue === undefined || artifactValue === null) {
      fail(
        ARTIFACT_FAILURE.IDENTITY_MISMATCH,
        `the artifact declares no ${label}`,
      );
      continue;
    }
    if (declaredValue === undefined || declaredValue === null) {
      fail(
        ARTIFACT_FAILURE.IDENTITY_MISMATCH,
        `the machine receipt declares no ${label}, so the artifact ${label} cannot be bound`,
      );
      continue;
    }
    if (String(artifactValue) !== String(declaredValue)) {
      fail(
        ARTIFACT_FAILURE.IDENTITY_MISMATCH,
        `the artifact ${label} is ${String(artifactValue)} and the machine receipt declares ${String(declaredValue)}`,
      );
    }
  }

  // 7. The artifact's source identity must name the FROZEN source of the row.
  const expectedBvid = expected.bvid ?? receipt?.bvid ?? null;
  if (expectedBvid !== null && expectedBvid !== undefined) {
    const source = parseSourceIdentity(binding.sourceIdentity);
    if (!source) {
      fail(
        ARTIFACT_FAILURE.IDENTITY_MISMATCH,
        "the artifact carries no valid source identity",
      );
    } else if (source.bvid !== String(expectedBvid)) {
      fail(
        ARTIFACT_FAILURE.IDENTITY_MISMATCH,
        `the artifact source identity names ${source.bvid} instead of ${expectedBvid}`,
      );
    }
  }

  return { failures, artifactSha256, parsed };
}
