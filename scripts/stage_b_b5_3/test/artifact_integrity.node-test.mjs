// AI1 — the artifact-byte oracle (focused unit cases).
//
// The shared validator reads the FROZEN contract file and the artifact
// integrity module hashes the EXACT durable bytes. These cases prove the two
// halves in isolation; the PROCESS-level negatives live in the sequencer
// test.
//
// No Chrome, no Runtime, no Provider, no Cookie, no media.

import test from "node:test";
import assert from "node:assert/strict";

import {
  V21_ARTIFACT_FILENAME,
  V21_SCHEMA_VERSION,
  canonicalJson,
  sha256Hex,
  validateV21Artifact,
} from "../lib/v21_artifact.mjs";
import { dispositionForQualityStatus } from "../lib/contracts.mjs";
import { ARTIFACT_FAILURE, checkArtifactIntegrity } from "../lib/artifact_integrity.mjs";
import {
  buildV21Artifact,
  frozenReceipt,
  internalPublication,
} from "./_fixtures/contract_shaped_stub.mjs";

const TASK_ID = `media_task_${"a".repeat(32)}`;
const SOURCE_IDENTITY = "portal:bilibili:BV11t8w6oEtP:41828944992:p1";

function artifactFixture() {
  const receipt = frozenReceipt({ requestCount: 3 });
  return buildV21Artifact({
    taskId: TASK_ID,
    taskRevision: 1,
    sourceIdentity: SOURCE_IDENTITY,
    receipt,
    evidenceIds: ["mtr_" + "1".repeat(32), "mtr_" + "2".repeat(32)],
    claimIds: ["claim_" + "3".repeat(16), "claim_" + "4".repeat(16)],
    chapterIds: ["chapter_" + "5".repeat(16), "chapter_" + "6".repeat(16)],
  });
}

/** The declared facts of a source that published the artifact. */
function declaredFacts(artifact) {
  const bytes = Buffer.from(canonicalJson(artifact), "utf8");
  return {
    artifact: { filename: V21_ARTIFACT_FILENAME, bytes },
    receipt: {
      taskId: artifact.binding.taskId,
      taskRevision: artifact.binding.taskRevision,
      sourceIdentity: artifact.binding.sourceIdentity,
      derivativeSha256: sha256Hex(bytes),
      evidenceSha256: sha256Hex(bytes),
      receiptSha256: sha256Hex(canonicalJson(artifact.receipt)),
    },
    mirror: {
      schemaVersion: "v3-5.10-b5-3-receipt-mirror/v2",
      taskId: artifact.binding.taskId,
      receipt: artifact.receipt,
      published: true,
      derivativeSha256: sha256Hex(bytes),
      taskIdNamespace: artifact.binding.taskId,
      providerLock: "minimax_chat_completions",
      selectedProviderId: "minimax-cn-openai-vision",
      selectedEndpointClass: "minimax_chat_completions",
      derivedTextScope: ["transcript", "ocr", "vision-caption"],
    },
  };
}

test("AI1: the shared validator accepts a REAL V2.1 artifact", () => {
  const verdict = validateV21Artifact(artifactFixture());
  assert.equal(verdict.ok, true, JSON.stringify(verdict.errors));
});

test("AI1: the shared validator rejects the contract violations", () => {
  const artifact = artifactFixture();
  const mutations = {
    "wrong-schema": { ...artifact, schemaVersion: "v2.0-not-the-frozen-one" },
    "additional-property": { ...artifact, extra: 1 },
    "bad-task-id": { ...artifact, binding: { ...artifact.binding, taskId: "nope" } },
    "request-count-zero": { ...artifact, receipt: { ...artifact.receipt, requestCount: 0 } },
    "non-zero-upload": { ...artifact, receipt: { ...artifact.receipt, rawVideoUploadCount: 1 } },
    "bad-relation": {
      ...artifact,
      chapters: [{ ...artifact.chapters[0], relationToPrevious: "nonsense" }, artifact.chapters[1]],
    },
    "human-review-false": {
      ...artifact,
      quality: { ...artifact.quality, humanReviewRequired: false },
    },
    "short-brief": { ...artifact, brief: { ...artifact.brief, text: "短" } },
  };
  for (const [name, value] of Object.entries(mutations)) {
    const verdict = validateV21Artifact(value);
    assert.equal(verdict.ok, false, `${name} must be refused`);
    assert.ok(verdict.errors.length > 0, `${name} must name its defect`);
  }
});

test("AI1: the canonical serialization is the production byte layout", () => {
  const artifact = artifactFixture();
  const canonical = canonicalJson(artifact);
  // The keys are sorted, there is no whitespace and the non-ASCII characters
  // are NOT escaped: the production `json.dumps(..., ensure_ascii=False,
  // sort_keys=True, separators=(",", ":"))` layout.
  assert.ok(!canonical.includes(", "), "there is no whitespace");
  assert.ok(!canonical.includes(": "), "there is no whitespace after a colon");
  assert.ok(canonical.includes("覆盖视频开头中段"), "the non-ASCII text is not escaped");
  const keys = Object.keys(JSON.parse(canonical));
  assert.deepEqual(keys, [...keys].sort(), "the top level keys are sorted");
  assert.equal(canonicalJson(artifact), canonicalJson(JSON.parse(canonical)), "it is idempotent");
});

test("AI1: the artifact bytes hash to the declared digests", () => {
  const artifact = artifactFixture();
  const facts = declaredFacts(artifact);
  const verdict = checkArtifactIntegrity(facts);
  assert.deepEqual(verdict.failures, [], JSON.stringify(verdict.failures));
  assert.equal(verdict.artifactSha256, facts.receipt.derivativeSha256);
});

test("AI1: a MISSING artifact is refused", () => {
  const facts = declaredFacts(artifactFixture());
  const verdict = checkArtifactIntegrity({ ...facts, artifact: null });
  assert.equal(verdict.failures.length, 1);
  assert.equal(verdict.failures[0].code, ARTIFACT_FAILURE.MISSING);
});

test("AI1: a MALFORMED artifact is refused", () => {
  const facts = declaredFacts(artifactFixture());
  const verdict = checkArtifactIntegrity({
    ...facts,
    artifact: { filename: V21_ARTIFACT_FILENAME, bytes: Buffer.from("{not json", "utf8") },
  });
  assert.ok(verdict.failures.some((failure) => failure.code === ARTIFACT_FAILURE.MALFORMED));
});

test("AI1: TAMPERED bytes are refused", () => {
  const artifact = artifactFixture();
  const facts = declaredFacts(artifact);
  const tampered = Buffer.from(
    canonicalJson({ ...artifact, brief: { ...artifact.brief, text: `${artifact.brief.text}篡改` } }),
    "utf8",
  );
  const verdict = checkArtifactIntegrity({
    ...facts,
    artifact: { filename: V21_ARTIFACT_FILENAME, bytes: tampered },
  });
  assert.ok(verdict.failures.some((failure) => failure.code === ARTIFACT_FAILURE.HASH_MISMATCH));
});

test("AI1: a DERIVATIVE hash mismatch is refused", () => {
  const facts = declaredFacts(artifactFixture());
  const verdict = checkArtifactIntegrity({
    ...facts,
    receipt: { ...facts.receipt, derivativeSha256: sha256Hex("another") },
  });
  assert.ok(verdict.failures.some((failure) => failure.code === ARTIFACT_FAILURE.HASH_MISMATCH));
});

test("AI1: a RECEIPT hash mismatch is refused", () => {
  const facts = declaredFacts(artifactFixture());
  const verdict = checkArtifactIntegrity({
    ...facts,
    receipt: { ...facts.receipt, receiptSha256: sha256Hex("another") },
  });
  assert.ok(verdict.failures.some((failure) => failure.code === ARTIFACT_FAILURE.RECEIPT_HASH_MISMATCH));
});

test("AI1: an EMBEDDED receipt mismatch is refused", () => {
  const artifact = artifactFixture();
  const facts = declaredFacts(artifact);
  const verdict = checkArtifactIntegrity({
    ...facts,
    mirror: { ...facts.mirror, receipt: { ...facts.mirror.receipt, attemptId: `attempt-${"e".repeat(16)}` } },
  });
  assert.ok(verdict.failures.some((failure) => failure.code === ARTIFACT_FAILURE.RECEIPT_MISMATCH));
});

test("AI1: a FOREIGN task identity is refused", () => {
  const facts = declaredFacts(artifactFixture());
  const verdict = checkArtifactIntegrity({
    ...facts,
    receipt: { ...facts.receipt, taskId: `media_task_${"f".repeat(32)}` },
  });
  assert.ok(verdict.failures.some((failure) => failure.code === ARTIFACT_FAILURE.IDENTITY_MISMATCH));
});

// ---------------------------------------------------------------------------
// SB1 — the identity comparison is unconditional.
// ---------------------------------------------------------------------------

test("SB1: a missing machine task id is a defect, never a skipped comparison", () => {
  const artifact = artifactFixture();
  const facts = declaredFacts(artifact);
  const receipt = { ...facts.receipt };
  delete receipt.taskId;
  const verdict = checkArtifactIntegrity({ ...facts, receipt });
  assert.ok(
    verdict.failures.some((failure) => failure.code === ARTIFACT_FAILURE.IDENTITY_MISMATCH),
    JSON.stringify(verdict.failures),
  );
});

test("SB1: a missing machine task revision is a defect", () => {
  const artifact = artifactFixture();
  const facts = declaredFacts(artifact);
  const receipt = { ...facts.receipt };
  delete receipt.taskRevision;
  const verdict = checkArtifactIntegrity({ ...facts, receipt });
  assert.ok(
    verdict.failures.some((failure) => failure.code === ARTIFACT_FAILURE.IDENTITY_MISMATCH),
    JSON.stringify(verdict.failures),
  );
});

test("SB1: a missing machine source identity is a defect", () => {
  const artifact = artifactFixture();
  const facts = declaredFacts(artifact);
  const receipt = { ...facts.receipt };
  delete receipt.sourceIdentity;
  const verdict = checkArtifactIntegrity({ ...facts, receipt });
  assert.ok(
    verdict.failures.some((failure) => failure.code === ARTIFACT_FAILURE.IDENTITY_MISMATCH),
    JSON.stringify(verdict.failures),
  );
});

test("SB1: a foreign artifact whose machine source declaration is removed is refused", () => {
  const artifact = artifactFixture();
  const facts = declaredFacts(artifact);
  const receipt = { ...facts.receipt };
  delete receipt.sourceIdentity;
  delete receipt.taskRevision;
  const verdict = checkArtifactIntegrity({
    ...facts,
    receipt,
    expected: { bvid: "BV1OTHER00001" },
  });
  assert.ok(
    verdict.failures.some((failure) => failure.code === ARTIFACT_FAILURE.IDENTITY_MISMATCH),
    JSON.stringify(verdict.failures),
  );
});

test("SB1: the artifact source identity must name the FROZEN row", () => {
  const artifact = artifactFixture();
  const facts = declaredFacts(artifact);
  const verdict = checkArtifactIntegrity({
    ...facts,
    expected: { bvid: "BV1OTHER00001" },
  });
  assert.ok(
    verdict.failures.some((failure) => failure.code === ARTIFACT_FAILURE.IDENTITY_MISMATCH),
    JSON.stringify(verdict.failures),
  );
});

// ---------------------------------------------------------------------------
// SB2 — the quality status binds to the disposition.
// ---------------------------------------------------------------------------

test("SB2: the production mapping is the single rule", () => {
  assert.equal(dispositionForQualityStatus("complete"), "complete");
  assert.equal(dispositionForQualityStatus("limited"), "limited");
  assert.equal(dispositionForQualityStatus("rejected"), "failed");
  assert.equal(dispositionForQualityStatus("unknown"), null);
  assert.equal(dispositionForQualityStatus(null), null);
});

test("SB2: a limited artifact is not a complete result", () => {
  const artifact = artifactFixture();
  const limited = { ...artifact, quality: { ...artifact.quality, status: "limited" } };
  const bytes = Buffer.from(canonicalJson(limited), "utf8");
  const facts = declaredFacts(limited);
  // The hashes are RECOMPUTED: the failure proves the semantic binding and
  // not an incidental hash mismatch.
  const verdict = checkArtifactIntegrity({
    ...facts,
    artifact: { filename: V21_ARTIFACT_FILENAME, bytes },
    receipt: {
      ...facts.receipt,
      derivativeSha256: sha256Hex(bytes),
      evidenceSha256: sha256Hex(bytes),
    },
  });
  assert.deepEqual(verdict.failures, [], "the byte oracle accepts the limited artifact");
  assert.equal(verdict.parsed.quality.status, "limited");
  assert.equal(dispositionForQualityStatus(verdict.parsed.quality.status), "limited");
});

test("SB2: a complete artifact carries no quality failure code", () => {
  const artifact = artifactFixture();
  assert.deepEqual(artifact.quality.failureCodes, []);
  const withFailures = {
    ...artifact,
    quality: { ...artifact.quality, failureCodes: ["V3510B_BRIEF_COVERAGE_INSUFFICIENT"] },
  };
  assert.ok(withFailures.quality.failureCodes.length > 0);
});

test("AI1: the publication projection is the artifact receipt", () => {
  const artifact = artifactFixture();
  const publication = internalPublication(artifact.receipt);
  assert.equal(publication.providerId, artifact.receipt.providerId);
  assert.equal(publication.endpointClass, artifact.receipt.endpointClass);
  assert.equal(publication.requestCount, artifact.receipt.requestCount);
  assert.equal(publication.uploadCounters.rawVideoUploadCount, artifact.receipt.rawVideoUploadCount);
  assert.equal(V21_SCHEMA_VERSION, artifact.schemaVersion);
});
