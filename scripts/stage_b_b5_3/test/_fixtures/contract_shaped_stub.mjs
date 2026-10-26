// The CONTRACT-SHAPED stub evidence.
//
// A positive stub must carry the SAME facts a real runner writes:
//
//   * the durable ledger events (the synthesis invocation and the ACTUAL
//     outbound Provider attempts),
//   * the machine receipt with the full internal publication shape,
//   * the receipt MIRROR with the frozen V2.1 receipt identity, cross-bound
//     to the task, the namespace, the derivative hash and the locked
//     Provider selection.
//
// The oracle is NOT weakened for the stubs: a stub that does not carry these
// facts is not a positive candidate.

import fs from "node:fs";
import path from "node:path";

import { appendLedgerEvent } from "../../lib/action_ledger.mjs";
import {
  V21_ARTIFACT_FILENAME,
  canonicalJson,
  sha256Hex,
} from "../../lib/v21_artifact.mjs";

/**
 * A REAL V2.1 derivative.
 *
 * It satisfies the FROZEN contract
 * (`docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json`)
 * and its bytes are the PRODUCTION canonical serialization, so every hash of
 * the stub is derived from the real artifact bytes.
 */
export function buildV21Artifact({
  taskId,
  taskRevision = 1,
  sourceIdentity,
  receipt,
  evidenceIds,
  claimIds,
  chapterIds,
}) {
  const regionNames = ["opening", "middle", "ending"];
  return {
    schemaVersion: "v3-media-grounded-comprehension/v2.1",
    binding: {
      taskId,
      taskRevision,
      sourceIdentity,
      evidenceCatalogSha256: "6".repeat(64),
      mediaDurationMs: 24000,
      spanStartMs: 0,
      spanEndMs: 24000,
    },
    brief: {
      text: "这段离线测试概括覆盖视频开头中段与结尾的全部核心表达与限制条件。",
      evidenceIds: [evidenceIds[0]],
      regions: ["opening"],
      origin: "provider",
      sourceClaimIds: [],
    },
    claims: [
      {
        claimId: claimIds[0],
        text: "第一条可核验的核心表达，概括视频的一个要点与它的直接证据。",
        evidenceIds: [evidenceIds[0]],
        regions: ["opening"],
      },
      {
        claimId: claimIds[1],
        text: "第二条可核验的核心表达，概括视频的另一个要点与它的直接证据。",
        evidenceIds: [evidenceIds[1]],
        regions: ["middle"],
      },
    ],
    chapters: [
      {
        chapterId: chapterIds[0],
        order: 0,
        title: "视频的开场与背景",
        thesis: "这一章说明视频的背景与它要处理的问题。",
        startMs: 0,
        endMs: 8000,
        evidenceIds: [evidenceIds[0]],
        relationToPrevious: "opening",
      },
      {
        chapterId: chapterIds[1],
        order: 1,
        title: "视频的方法与结论",
        thesis: "这一章给出视频的方法、它的结论与它的限制。",
        startMs: 8000,
        endMs: 24000,
        evidenceIds: [evidenceIds[1]],
        relationToPrevious: "continuation",
      },
    ],
    regions: [
      { name: "opening", startMs: 0, endMs: 8000, availability: "substantive", evidenceIds: [evidenceIds[0]] },
      { name: "middle", startMs: 8000, endMs: 16000, availability: "substantive", evidenceIds: [evidenceIds[1]] },
      { name: "ending", startMs: 16000, endMs: 24000, availability: "substantive", evidenceIds: [evidenceIds[1]] },
    ],
    quality: {
      status: "complete",
      failureCodes: [],
      sourceCoverageRatio: 1,
      maxChapterStartConcentration: 0.5,
      maxChapterSpanRatio: 0.5,
      humanReviewRequired: true,
    },
    receipt,
  };
}

/** The frozen V2.1 receipt identity of a published derivative. */
export function frozenReceipt(overrides = {}) {
  return {
    providerId: "minimax-cn-openai-vision",
    modelId: "MiniMax-M3",
    outboundDerivedTextSha256: "1".repeat(64),
    requestCount: 3,
    rawVideoUploadCount: 0,
    rawAudioUploadCount: 0,
    frameByteUploadCount: 0,
    cookieUploadCount: 0,
    apiKeyDisclosureCount: 0,
    localPathUploadCount: 0,
    endpointClass: "minimax_chat_completions",
    structureMode: "strict_tool",
    attemptId: `attempt-${"a".repeat(16)}`,
    latencyMs: 12,
    requestSha256: "2".repeat(64),
    responseSha256: "3".repeat(64),
    finishReason: "stop",
    ...overrides,
  };
}

/** The full internal publication shape of the machine receipt. */
export function internalPublication(receipt) {
  return {
    providerId: receipt.providerId,
    modelId: receipt.modelId,
    endpointClass: receipt.endpointClass,
    structureMode: receipt.structureMode,
    attemptId: receipt.attemptId,
    requestCount: receipt.requestCount,
    latencyMs: receipt.latencyMs,
    requestSha256: receipt.requestSha256,
    responseSha256: receipt.responseSha256,
    outboundDerivedTextSha256: receipt.outboundDerivedTextSha256,
    finishReason: receipt.finishReason,
    uploadCounters: {
      rawVideoUploadCount: receipt.rawVideoUploadCount,
      rawAudioUploadCount: receipt.rawAudioUploadCount,
      frameByteUploadCount: receipt.frameByteUploadCount,
      cookieUploadCount: receipt.cookieUploadCount,
      apiKeyDisclosureCount: receipt.apiKeyDisclosureCount,
      localPathUploadCount: receipt.localPathUploadCount,
    },
  };
}

/**
 * The mutations the CI2 negative cases inject.
 *
 * They are applied to the WRITTEN evidence, never to the oracle.
 */
export const STUB_MUTATIONS = Object.freeze([
  "none",
  "no-publication",
  "partial-publication",
  "malformed-mirror",
  "mismatched-mirror",
  "no-ledger",
  "duplicate-ledger",
  "foreign-provider",
  "non-zero-upload-counter",
  "unknown-request-count",
  "zero-ledger",
  // The artifact-byte mutations (AI1).
  "missing-artifact",
  "malformed-artifact",
  "wrong-schema-artifact",
  "tampered-artifact",
  "artifact-hash-mismatch",
  "receipt-hash-mismatch",
  "embedded-receipt-mismatch",
  "foreign-identity",
  "stale-artifact",
  // The request and mirror mutations (AI2).
  "zero-requests",
  "wrong-mirror-schema",
  "missing-mirror-field",
  "extra-mirror-field",
  // The identity and semantic-binding mutations (SB1 / SB2).
  "missing-machine-field",
  "foreign-artifact",
  "limited-artifact",
  "rejected-artifact",
  "complete-with-failure-codes",
  "machine-disposition-mismatch",
  // The authority-completeness mutations (AC1 / AC2).
  "foreign-adapter",
  "malformed-namespace",
  "malformed-machine-namespace",
  "namespace-file-mismatch",
  "malformed-namespace-receipt",
  "invalid-timestamps",
  "reversed-window",
  "missing-disposition",
  "null-disposition",
  "wrong-type-disposition",
  "unknown-disposition",
  "blocked-foreign-adapter",
  "blocked-artifact",
  "blocked-publication",
  "blocked-mirror-publication",
  "blocked-synthesis",
]);

/**
 * Write the COMPLETE contract-shaped evidence of one source.
 *
 * @param {object} input
 * @param {string} input.dir             the per-source evidence directory
 * @param {string} input.order           the registry order ("1".."6")
 * @param {string} input.bvid            the frozen source identity
 * @param {string} input.runId           the candidate run id
 * @param {string} input.stageRoot       the owned stage root of the ledger
 * @param {string} input.mutation        one of STUB_MUTATIONS
 * @param {number} input.requestCount    the ACTUAL outbound Provider attempts
 */
export function writeContractShapedEvidence({
  dir,
  order,
  bvid,
  runId,
  stageRoot,
  mutation = "none",
  requestCount = 3,
  disposition = "complete",
  reachedSynthesis = true,
}) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // The task id and the namespace follow the FROZEN pattern and are unique
  // per source.
  const taskId = `media_task_${String(order).padStart(32, "0")}`;
  const taskNamespace = taskId;
  const sourceIdentity = `portal:bilibili:${bvid}:41828944992:1`;
  const evidenceIds = [
    `mtr_${String(order).padStart(32, "0")}`.slice(0, 36),
    `mtr_${String(Number(order) + 1).padStart(32, "0")}`.slice(0, 36),
  ];
  const claimIds = [
    `claim_${String(order).padStart(16, "0")}`,
    `claim_${String(Number(order) + 1).padStart(16, "0")}`,
  ];
  const chapterIds = [
    `chapter_${String(order).padStart(16, "0")}`,
    `chapter_${String(Number(order) + 1).padStart(16, "0")}`,
  ];

  const receipt = frozenReceipt({
    requestCount: mutation === "zero-requests" ? 0 : requestCount,
    attemptId: `attempt-${String(order).repeat(8).slice(0, 16)}`,
  });

  // The REAL V2.1 artifact. Its bytes are the PRODUCTION canonical
  // serialization, and EVERY hash of the stub is derived from those bytes.
  const artifact = buildV21Artifact({
    taskId,
    taskRevision: 1,
    sourceIdentity,
    receipt,
    evidenceIds,
    claimIds,
    chapterIds,
  });
  // The artifact that is ACTUALLY written. Every declared hash is derived
  // from these bytes.
  let artifactValue = artifact;
  if (mutation === "wrong-schema-artifact") {
    artifactValue = { ...artifact, schemaVersion: "v2.0-not-the-frozen-one" };
  }
  if (mutation === "embedded-receipt-mismatch") {
    artifactValue = {
      ...artifact,
      // A VALID attempt id: the artifact stays contract-shaped, so the
      // mismatch is caught by the receipt cross-binding and not by the
      // schema.
      receipt: { ...artifact.receipt, attemptId: `attempt-${"e".repeat(16)}` },
    };
  }
  if (mutation === "limited-artifact") {
    artifactValue = { ...artifact, quality: { ...artifact.quality, status: "limited" } };
  }
  if (mutation === "rejected-artifact") {
    artifactValue = { ...artifact, quality: { ...artifact.quality, status: "rejected" } };
  }
  if (mutation === "complete-with-failure-codes") {
    artifactValue = {
      ...artifact,
      quality: {
        ...artifact.quality,
        failureCodes: ["V3510B_BRIEF_COVERAGE_INSUFFICIENT"],
      },
    };
  }
  if (mutation === "stale-artifact" || mutation === "foreign-artifact") {
    // The bytes of ANOTHER source: a reused artifact.
    artifactValue = buildV21Artifact({
      taskId: `media_task_${"9".repeat(32)}`,
      taskRevision: 1,
      sourceIdentity: `portal:bilibili:${bvid}:41828944992:9`,
      receipt,
      evidenceIds,
      claimIds,
      chapterIds,
    });
  }
  const artifactBytes = Buffer.from(canonicalJson(artifactValue), "utf8");
  const derivativeSha256 = sha256Hex(artifactBytes);
  const receiptSha256 = sha256Hex(canonicalJson(artifactValue.receipt));
  const publication = internalPublication(artifactValue.receipt);

  // 1. The durable ledger events: the synthesis invocation and the ACTUAL
  //    outbound Provider attempts. A source that never reached synthesis
  //    writes NO event.
  if (stageRoot && reachedSynthesis && mutation !== "no-ledger") {
    appendLedgerEvent({
      stageRoot,
      event: "runtimeSynthesize",
      candidateRunId: runId,
      count: 1,
      detail: { stage: "synthesis_invoked" },
    });
    appendLedgerEvent({
      stageRoot,
      event: "providerCall",
      candidateRunId: runId,
      count: (mutation === "zero-ledger" || mutation === "zero-requests") ? 0 : requestCount,
      detail: { stage: "provider_attempted" },
    });
    if (mutation === "duplicate-ledger") {
      appendLedgerEvent({
        stageRoot,
        event: "providerCall",
        candidateRunId: runId,
        count: requestCount,
        detail: { stage: "provider_attempted" },
      });
    }
  }

  // 2. The machine receipt.
  let machinePublication = publication;
  if (mutation === "no-publication") machinePublication = null;
  if (mutation === "partial-publication") {
    machinePublication = { ...publication };
    delete machinePublication.attemptId;
    delete machinePublication.requestSha256;
  }
  if (mutation === "foreign-provider") {
    machinePublication = { ...publication, providerId: "another-provider" };
  }
  const machineReceipt = {
    schemaVersion: "v3-5.10-b5-3-source-receipt/v2",
    runId: mutation === "cross-run" ? "another-run-id" : runId,
    order: Number(order),
    bvid,
    registrySha256: "9c2da2f4c4c16fc94e1e0d7dfc9362ab1177d2db53f63d4af5a81a44795c9454",
    taskId,
    taskNamespace,
    taskRevision: 1,
    sourceIdentity,
    dependencyGeneration: `depgen_${sha256Hex(`${order}:${bvid}`)}`,
    route: "credentialed_media_asr",
    disposition,
    failureCode: null,
    startedAtUtc: new Date().toISOString(),
    finishedAtUtc: new Date().toISOString(),
    provider: {
      selectedProviderId: "minimax-cn-openai-vision",
      selectedEndpointClass: "minimax_chat_completions",
      attempted: {
        attemptCount: reachedSynthesis ? 1 : 0,
        providerId: "minimax-cn-openai-vision",
        endpointClass: "minimax_chat_completions",
        requestCount: reachedSynthesis
          ? (mutation === "zero-requests" ? 0 : requestCount)
          : null,
      },
      published: reachedSynthesis ? machinePublication : null,
    },
    uploadCounters: {
      rawVideoUploadCount: 0,
      rawAudioUploadCount: 0,
      frameByteUploadCount: 0,
      cookieUploadCount: 0,
      apiKeyDisclosureCount: 0,
      localPathUploadCount: 0,
    },
    audioOutputCount: 0,
    tabCaptureCount: 0,
    focusEventCount: 0,
    focusTargetOwned: true,
    cookieInjectionCount: 0,
    extensionPermissionMode: "pregranted_test_fixture",
    muteAudioVerified: true,
    runtimeDatabaseRef: sha256Hex(`db:${order}`),
    chromeProfileRef: sha256Hex(`profile:${order}`),
    derivativeSha256: reachedSynthesis ? derivativeSha256 : null,
    receiptSha256: reachedSynthesis ? receiptSha256 : null,
    evidenceSha256: reachedSynthesis ? derivativeSha256 : null,
    cleanup: { runtimeScratchDeleted: true, profileRootDeleted: true, cleanupFailure: null },
    chapterDiagnostic: null,
  };
  if (mutation === "non-zero-upload-counter") {
    machineReceipt.uploadCounters.rawVideoUploadCount = 1;
  }
  if (mutation === "unknown-request-count") {
    machineReceipt.provider.attempted.requestCount = null;
  }
  if (mutation === "artifact-hash-mismatch") {
    machineReceipt.derivativeSha256 = sha256Hex("another-derivative");
    machineReceipt.evidenceSha256 = machineReceipt.derivativeSha256;
  }
  if (mutation === "receipt-hash-mismatch") {
    machineReceipt.receiptSha256 = sha256Hex("another-receipt");
  }
  if (mutation === "foreign-identity") {
    machineReceipt.taskId = `media_task_${"f".repeat(32)}`;
    machineReceipt.taskNamespace = machineReceipt.taskId;
  }
  if (mutation === "missing-machine-field") {
    // The field named by STUB_MISSING_MACHINE_FIELD is REMOVED: a missing
    // machine fact must never disable a comparison.
    const field = process.env.STUB_MISSING_MACHINE_FIELD || "taskRevision";
    delete machineReceipt[field];
  }
  if (mutation === "machine-disposition-mismatch") {
    machineReceipt.disposition = "limited";
  }
  if (mutation === "foreign-artifact") {
    // The machine declarations of the source and the revision are REMOVED:
    // the absence must not disable the comparison.
    delete machineReceipt.sourceIdentity;
    delete machineReceipt.taskRevision;
  }
  if (mutation === "malformed-machine-namespace") {
    machineReceipt.taskNamespace = "arbitrary-nonempty";
  }
  if (mutation === "foreign-adapter" || mutation === "blocked-foreign-adapter") {
    machineReceipt.sourceIdentity = `portal:attacker:${bvid}:41828944992:p1`;
  }
  if (mutation === "invalid-timestamps") {
    machineReceipt.startedAtUtc = "2026-99-99T99:99:99Z";
    machineReceipt.finishedAtUtc = "2026-99-99T99:99:99Z";
  }
  if (mutation === "reversed-window") {
    machineReceipt.startedAtUtc = "2026-10-24T00:00:09.000Z";
    machineReceipt.finishedAtUtc = "2026-10-24T00:00:00.000Z";
  }
  if (mutation === "missing-disposition") {
    delete machineReceipt.disposition;
  }
  if (mutation === "null-disposition") {
    machineReceipt.disposition = null;
  }
  if (mutation === "wrong-type-disposition") {
    machineReceipt.disposition = 7;
  }
  if (mutation === "unknown-disposition") {
    machineReceipt.disposition = "not-a-frozen-disposition";
  }
  if (mutation === "blocked-publication") {
    machineReceipt.provider.published = publication;
  }
  if (mutation === "blocked-synthesis") {
    machineReceipt.provider.attempted.attemptCount = 1;
    machineReceipt.provider.attempted.requestCount = requestCount;
    appendLedgerEvent({
      stageRoot,
      event: "runtimeSynthesize",
      candidateRunId: runId,
      count: 1,
      detail: { stage: "synthesis_invoked" },
    });
    appendLedgerEvent({
      stageRoot,
      event: "providerCall",
      candidateRunId: runId,
      count: requestCount,
      detail: { stage: "provider_attempted" },
    });
  }
  fs.writeFileSync(
    path.join(dir, "b5-source-receipt.json"),
    `${JSON.stringify(machineReceipt, null, 2)}\n`,
    { mode: 0o600 },
  );

  // 3. The DURABLE ARTIFACT: the exact bytes under the contracted name.
  if ((reachedSynthesis && mutation !== "missing-artifact") || mutation === "blocked-artifact") {
    let bytes = artifactBytes;
    if (mutation === "malformed-artifact") bytes = Buffer.from("{not json", "utf8");
    fs.writeFileSync(path.join(dir, V21_ARTIFACT_FILENAME), bytes, { mode: 0o600 });
    if (mutation === "tampered-artifact") {
      // The bytes are TAMPERED after the receipt was created: the declared
      // hashes no longer describe the file.
      const tampered = Buffer.from(
        canonicalJson({ ...artifact, brief: { ...artifact.brief, text: `${artifact.brief.text}篡改` } }),
        "utf8",
      );
      fs.writeFileSync(path.join(dir, V21_ARTIFACT_FILENAME), tampered, { mode: 0o600 });
    }
  }

  // 4. The receipt MIRROR: the frozen V2.1 receipt identity, cross-bound to
  //    the machine receipt, with the EXACT wrapper key set.
  const mirrorReceipt = mutation === "mismatched-mirror"
    ? { ...artifactValue.receipt, attemptId: `attempt-mismatch-${order}` }
    : (mutation === "embedded-receipt-mismatch"
      ? artifact.receipt
      : (mutation === "foreign-provider"
        ? { ...artifactValue.receipt, providerId: "another-provider" }
        : (mutation === "non-zero-upload-counter"
          ? { ...artifactValue.receipt, rawVideoUploadCount: 1 }
          : artifactValue.receipt)));
  const mirrorPublished = reachedSynthesis || mutation === "blocked-mirror-publication";
  const mirror = {
    schemaVersion: "v3-5.10-b5-3-receipt-mirror/v2",
    taskId: mutation === "foreign-identity" ? machineReceipt.taskId : taskId,
    receipt: mirrorPublished ? mirrorReceipt : null,
    published: mirrorPublished,
    derivativeSha256: mirrorPublished ? derivativeSha256 : null,
    taskIdNamespace: mutation === "foreign-identity" ? machineReceipt.taskNamespace : taskNamespace,
    providerLock: "minimax_chat_completions",
    selectedProviderId: "minimax-cn-openai-vision",
    selectedEndpointClass: "minimax_chat_completions",
    derivedTextScope: ["transcript", "ocr", "vision-caption"],
  };
  if (mutation === "wrong-mirror-schema") {
    mirror.schemaVersion = "wrong-schema-still-accepted";
  }
  if (mutation === "missing-mirror-field") {
    // The field named by the mutation is removed: the mirror must have the
    // EXACT wrapper key set.
    delete mirror[process.env.STUB_MISSING_MIRROR_FIELD || "providerLock"];
  }
  if (mutation === "extra-mirror-field") {
    mirror.extraField = "not allowed";
  }
  if (mutation === "malformed-mirror") {
    fs.writeFileSync(path.join(dir, "receipt.json"), "{not json", { mode: 0o600 });
  } else {
    fs.writeFileSync(
      path.join(dir, "receipt.json"),
      `${JSON.stringify(mirror, null, 2)}\n`,
      { mode: 0o600 },
    );
  }

  // 5. The rest of the mandatory audit set.
  fs.writeFileSync(
    path.join(dir, "final_disposition.txt"),
    `${disposition}\nreason: stub\nbvid: ${bvid}\norder: ${order}\n`,
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(dir, "isolation.json"),
    `${JSON.stringify({ schemaVersion: "v3-5.10-b5-3-isolation/v2", muteAudioVerified: true }, null, 2)}\n`,
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(dir, "provider_lock.txt"),
    "providerLock=minimax_chat_completions\nselectedProviderId=minimax-cn-openai-vision\nselectedEndpointClass=minimax_chat_completions\n",
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(dir, "chrome_launch.log"),
    "pid=12345 cdpPort=null profileRef=stub\n--mute-audio present: true\n",
    { mode: 0o600 },
  );
  fs.writeFileSync(path.join(dir, "secret_scan.csv"), "file_ref,classification,occurrences\n", { mode: 0o600 });
  fs.writeFileSync(
    path.join(dir, "cleanup.json"),
    `${JSON.stringify({
      schemaVersion: "v3-5.10-b5-3-cleanup/v1",
      bvid,
      order: Number(order),
      runtimeScratchDeleted: true,
      profileRootDeleted: true,
      finishedAtUtc: new Date().toISOString(),
    }, null, 2)}\n`,
    { mode: 0o600 },
  );
  const namespaceReceiptValue = {
    taskIdNamespace: taskNamespace,
    bvid,
    order: Number(order),
    runId,
  };
  if (mutation === "malformed-namespace") {
    namespaceReceiptValue.taskIdNamespace = "arbitrary-nonempty";
  }
  if (mutation === "namespace-file-mismatch") {
    namespaceReceiptValue.taskIdNamespace = `media_task_${"7".repeat(32)}`;
  }
  if (mutation === "malformed-namespace-receipt") {
    namespaceReceiptValue.extraField = "not allowed";
  }
  fs.writeFileSync(
    path.join(dir, "task_namespace.json"),
    `${JSON.stringify(namespaceReceiptValue, null, 2)}\n`,
    { mode: 0o600 },
  );
  return { taskId, taskNamespace, derivativeSha256, receipt, artifact };
}
