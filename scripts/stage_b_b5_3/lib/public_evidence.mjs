// The DETERMINISTIC PUBLIC EVIDENCE BUILDER.
//
// The public package of a candidate is GENERATED from the RAW production
// authorities: the aggregate rows, the candidate authority, the private
// review bundles, the action ledger, the scan and the retention records.
//
// NO CALLER BOOLEAN DECIDES A GATE. The machine gate is RECOMPUTED from the
// aggregate rows with the production aggregate, the review authority is
// recomputed with the production semantic aggregate, the bundles are re-read
// and re-validated with the production bundle reader, the ledger is
// reconciled against the receipts and the scan is re-read.
//
// The generated package is validated against strict schemas BEFORE the
// payload manifest is signed.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

import { AGGREGATE_POSITIVE, evaluateAggregate } from "./aggregate.mjs";
import { buildCandidateAuthority, candidateAuthorityDefects } from "./b6_authority.mjs";
import { evaluateB6Aggregate } from "./b6_aggregate.mjs";
import { readReviewBundle } from "./review_capture.mjs";
import { validateReviewBundle } from "./review_bundle.mjs";
import { reviewPrecommitDefects } from "./review_protocol.mjs";
import { publicRetentionDefects, publicRetentionProjection } from "./retention_ledger.mjs";
import {
  CANDIDATE_DEPENDENCY_IDENTITY_KEYS,
  CANDIDATE_DEPENDENCY_SCHEMA,
} from "./candidate_dependencies.mjs";
import { publicFailureCodeDefect } from "./stable_failure_codes.mjs";
import {
  EXECUTION_CLOSURE_SCHEMA,
  EXECUTION_CLOSURE_TOOL_IDENTITY_KEYS,
} from "./execution_closure.mjs";
import { FROZEN_SIX, RESERVE_SOURCES } from "./registry.mjs";

/** The public evidence schema version. */
export const PUBLIC_EVIDENCE_SCHEMA = "v3-5.10-b6-public-evidence/v2";

/** The stable public-evidence defect codes. */
export const PUBLIC_EVIDENCE_FAILURE = Object.freeze({
  SCHEMA: "PUBLIC_EVIDENCE_SCHEMA_INVALID",
  RUN_BINDING: "PUBLIC_EVIDENCE_RUN_ID_MISMATCH",
  SOURCE_BINDING: "PUBLIC_EVIDENCE_SOURCE_BINDING_MISMATCH",
  COUNT: "PUBLIC_EVIDENCE_COUNT_MISMATCH",
  DISPOSITION: "PUBLIC_EVIDENCE_DISPOSITION_INVALID",
  ORDER: "PUBLIC_EVIDENCE_ORDER_INVALID",
  NARRATIVE: "PUBLIC_EVIDENCE_NARRATIVE_SUPPLIES_A_MACHINE_FACT",
  MACHINE_GATE: "PUBLIC_EVIDENCE_MACHINE_GATE_MISMATCH",
  AUTHORITY: "PUBLIC_EVIDENCE_CANDIDATE_AUTHORITY_INVALID",
  BUNDLE_MISSING: "PUBLIC_EVIDENCE_BUNDLE_MISSING",
  BUNDLE_INVALID: "PUBLIC_EVIDENCE_BUNDLE_INVALID",
  LEDGER: "PUBLIC_EVIDENCE_LEDGER_INVALID",
  SCAN: "PUBLIC_EVIDENCE_SCAN_NOT_CLEAN",
  PRECOMMIT: "PUBLIC_EVIDENCE_PRECOMMIT_INVALID",
  LOCK: "PUBLIC_EVIDENCE_CANDIDATE_LOCK_INVALID",
  REVIEW: "PUBLIC_EVIDENCE_REVIEW_INVALID",
  RETENTION: "PUBLIC_EVIDENCE_RETENTION_INVALID",
  FAILURE_CODE: "PUBLIC_EVIDENCE_FAILURE_CODE_NOT_ALLOWLISTED",
});

const MACHINE_ROW_KEYS = Object.freeze([
  "order", "bvid", "disposition", "failureCode", "providerOutboundHttpAttempts",
  "publishedRequestCount", "derivativeSha256", "reviewCaptureStatus",
  "reviewCaptureFailureCodes", "uploadCounters", "cleanup", "muteAudioVerified",
  "quality", "stageADiagnostic", "executionClosure",
]);

const QUALITY_KEYS = Object.freeze([
  "qualityStatus", "qualityFailureCodes", "maxChapterStartConcentration",
  "maxChapterSpanRatio", "sourceCoverageRatio", "claimCount", "chapterCount",
  "regionCount",
]);

const UPLOAD_COUNTER_KEYS = Object.freeze([
  "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
  "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount",
]);

const STAGE_A_KEYS = Object.freeze([
  "code", "phase", "authorityPollCount", "authorityRowCount",
  "exactIdentityMatchCount", "authorityStateClass", "mediaTaskPollCount",
  "mediaTaskRowCount", "mediaTaskStateClass", "elapsedBucket", "enableState",
  "permissionState", "resolveStatusClass",
]);

const CLOSURE_KEYS = Object.freeze([
  "stage", "present", "ok", "codes", "fileCount", "driftedCount", "missingCount",
  "extraCount",
]);

const BUNDLE_KEYS = Object.freeze([
  "order", "bvid", "present", "validationOk", "manifestOk", "captureStatus",
  "captureCounts", "captureClosure", "bundleSha256", "reviewBindingSha256",
  "artifactSha256", "evidenceCount", "thumbnailCount", "chapterCount", "code",
]);

const RETENTION_RECORD_KEYS = Object.freeze([
  "schemaVersion", "runId", "artifactKind", "diagnosisOnly",
  "eligibleAsCandidateRow", "eligibleAsBlindReviewInput", "eligibleAsSentinel",
  "eligibleAsFutureMachineGateEvidence", "impliesB7Authorization",
  "owner", "deadlineUtc", "deletionReceiptRequired", "deletionReceiptState",
  "rootReference", "digestCount", "digests",
]);

const SCAN_KEYS = Object.freeze([
  "secretHits", "absolutePathHits", "rawMediaPayloadHits",
]);

const SCAN_PAYLOAD_KEYS = Object.freeze([
  "schemaVersion", "kind", "runId", ...SCAN_KEYS,
]);

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

/**
 * The machine gate of a set of public machine rows.
 *
 * It is the FROZEN threshold of the production aggregate, applied to the
 * dispositions. It is a NECESSARY condition: a package may never claim a
 * positive gate that its own rows do not support.
 */
export function machineGateFromRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const counts = {
    complete: list.filter((row) => row.disposition === "complete").length,
    limited: list.filter((row) => row.disposition === "limited").length,
    blocked: list.filter((row) => row.disposition === "blocked").length,
    failed: list.filter((row) => row.disposition === "failed").length,
    total: list.length,
  };
  const positive = counts.total === AGGREGATE_POSITIVE.requiredSources
    && counts.complete >= AGGREGATE_POSITIVE.completeMinimum
    && counts.blocked <= AGGREGATE_POSITIVE.blockedMaximum
    && counts.limited <= AGGREGATE_POSITIVE.limitedMaximum
    && counts.failed <= AGGREGATE_POSITIVE.failedMaximum;
  return { positive, counts };
}

/**
 * The public quality block of a source.
 *
 * It is derived from the PUBLISHED artifact bytes, never from a caller.
 */
function publicQuality(artifactBytes) {
  if (!artifactBytes) return null;
  let derivative = null;
  try {
    derivative = JSON.parse(Buffer.from(artifactBytes).toString("utf8"));
  } catch {
    return null;
  }
  const quality = derivative?.quality ?? null;
  if (!isPlainObject(quality)) return null;
  return {
    qualityStatus: quality.status ?? null,
    qualityFailureCodes: Array.isArray(quality.failureCodes) ? quality.failureCodes : [],
    maxChapterStartConcentration: quality.maxChapterStartConcentration ?? null,
    maxChapterSpanRatio: quality.maxChapterSpanRatio ?? null,
    sourceCoverageRatio: quality.sourceCoverageRatio ?? null,
    claimCount: Array.isArray(derivative.claims) ? derivative.claims.length : null,
    chapterCount: Array.isArray(derivative.chapters) ? derivative.chapters.length : null,
    regionCount: Array.isArray(derivative.regions) ? derivative.regions.length : null,
  };
}

/**
 * The public machine row of ONE raw aggregate row.
 */
function publicMachineRow(row) {
  const receipt = row.receipt ?? {};
  const published = receipt.provider?.published ?? null;
  const attempted = receipt.provider?.attempted ?? null;
  return {
    order: String(row.order ?? ""),
    bvid: String(row.bvid ?? ""),
    disposition: String(row.disposition ?? "unknown"),
    failureCode: receipt.failureCode ?? null,
    providerOutboundHttpAttempts: attempted?.requestCount ?? null,
    publishedRequestCount: published?.requestCount ?? null,
    derivativeSha256: receipt.derivativeSha256 ?? null,
    reviewCaptureStatus: receipt.reviewCapture?.status ?? null,
    reviewCaptureFailureCodes: Array.isArray(receipt.reviewCaptureFailureCodes)
      ? receipt.reviewCaptureFailureCodes
      : [],
    uploadCounters: receipt.uploadCounters ?? {},
    cleanup: receipt.cleanup ?? null,
    muteAudioVerified: receipt.muteAudioVerified ?? null,
    quality: publicQuality(row.artifact?.bytes ?? null),
    // The GC-B6H-R durable diagnostics: the Stage A observation and the
    // execution-closure verdict of THIS source.
    stageADiagnostic: receipt.stageADiagnostic ?? null,
    executionClosure: receipt.executionClosure ?? null,
  };
}

/**
 * Re-read and re-validate ONE private review bundle.
 *
 * The production reader and the production validator decide: a missing or a
 * malformed bundle is a defect of the candidate, never a row that claims to
 * be present.
 */
function verifyBundle({ directory, order, bvid }) {
  const base = {
    order: String(order ?? ""),
    bvid: String(bvid ?? ""),
    present: false,
    validationOk: false,
    manifestOk: false,
    captureStatus: null,
    captureCounts: null,
    captureClosure: null,
    bundleSha256: null,
    reviewBindingSha256: null,
    artifactSha256: null,
    evidenceCount: null,
    thumbnailCount: null,
    chapterCount: null,
    code: null,
    authorityFacts: null,
  };
  if (!directory) {
    return { ...base, code: PUBLIC_EVIDENCE_FAILURE.BUNDLE_MISSING };
  }
  if (!existsSync(directory)) {
    return { ...base, code: PUBLIC_EVIDENCE_FAILURE.BUNDLE_MISSING };
  }
  let bundle = null;
  try {
    bundle = readReviewBundle(directory);
  } catch (error) {
    // The bundle IS there and it does NOT read: it is MALFORMED, never
    // absent.
    return { ...base, present: true, code: PUBLIC_EVIDENCE_FAILURE.BUNDLE_INVALID };
  }
  const verdict = validateReviewBundle(bundle);
  const receipt = bundle?.captureReceipt ?? null;
  const source = bundle?.source ?? null;
  const identityMatches = String(source?.order ?? "") === String(order)
    && source?.bvid === bvid;
  return {
    ...base,
    present: true,
    validationOk: verdict.ok === true && identityMatches,
    manifestOk: verdict.ok === true,
    captureStatus: receipt?.status ?? null,
    captureCounts: receipt?.counts ?? null,
    captureClosure: receipt?.closure ?? null,
    bundleSha256: receipt?.digests?.bundleSha256 ?? null,
    reviewBindingSha256: receipt?.digests?.reviewBindingSha256 ?? null,
    artifactSha256: receipt?.digests?.artifactSha256 ?? null,
    evidenceCount: receipt?.counts?.evidence ?? null,
    thumbnailCount: receipt?.counts?.thumbnails ?? null,
    chapterCount: receipt?.counts?.chapters ?? null,
    code: verdict.ok === true && identityMatches ? null : PUBLIC_EVIDENCE_FAILURE.BUNDLE_INVALID,
    authorityFacts: verdict.ok === true && identityMatches ? {
      taskId: source.taskId,
      taskRevision: source.taskRevision,
      sourceIdentity: source.sourceIdentity,
      dependencyGeneration: source.dependencyGeneration,
      captureArtifactSha256: receipt?.digests?.artifactSha256 ?? null,
      bundleSha256: receipt?.digests?.bundleSha256 ?? null,
      reviewBindingSha256: receipt?.digests?.reviewBindingSha256 ?? null,
      captureStatus: receipt?.status ?? null,
      captureCounts: receipt?.counts ?? null,
      captureClosure: receipt?.closure ?? null,
    } : null,
  };
}

/**
 * Build the public evidence package from the RAW production authorities.
 *
 * Every payload is derived. The narrative is GENERATED from the machine
 * facts, so it can never contradict them.
 */
export function buildPublicEvidence({
  runId,
  registrySha256 = null,
  registryOrder = [],
  aggregateRows = [],
  ledgerTotals = {},
  authority = null,
  bundleDirectories = {},
  reviewRows = null,
  sentinelReviews = null,
  precommit = null,
  lock = null,
  retentionRecords = [],
  scan = null,
  repoRoot = null,
} = {}) {
  const codes = [];

  // 1. The MACHINE GATE is recomputed by the production aggregate.
  const aggregateVerdict = evaluateAggregate({
    rows: aggregateRows,
    runId,
    registrySha256,
    ledgerIntegrityOk: ledgerTotals.integrityOk === true,
    candidateLedgerTotals: {
      runtimeSynthesize: Number(ledgerTotals.candidate?.runtimeSynthesize ?? 0),
      providerCall: Number(ledgerTotals.candidate?.providerCall ?? 0),
    },
  });
  const machineGatePositive = aggregateVerdict.positive === true;

  // 2. The private bundles are re-read and re-validated.
  const bundles = [];
  const bundleAuthority = new Map();
  for (const order of registryOrder) {
    const bvid = (aggregateRows.find((row) => String(row.order) === String(order))?.bvid)
      ?? (registryOrder.find?.((entry) => String(entry.order) === String(order))?.bvid)
      ?? "";
    const verified = verifyBundle({
      directory: bundleDirectories?.[String(order)] ?? null,
      order,
      bvid,
    });
    if (verified.authorityFacts) bundleAuthority.set(String(order), verified.authorityFacts);
    const { authorityFacts: _authorityFacts, ...publicBundle } = verified;
    bundles.push(publicBundle);
  }
  for (const bundle of bundles) {
    if (!bundle.present && machineGatePositive) codes.push(PUBLIC_EVIDENCE_FAILURE.BUNDLE_MISSING);
    else if (bundle.present && !bundle.validationOk) codes.push(PUBLIC_EVIDENCE_FAILURE.BUNDLE_INVALID);
  }

  // 3. Candidate authority is rebuilt from the raw machine receipts and the
  //    bundles that were just re-read. The summary copy is only a mirror and
  //    must equal this derived authority exactly.
  const derivedSources = aggregateRows.map((row) => {
    const receipt = row.receipt ?? {};
    const captured = bundleAuthority.get(String(row.order)) ?? {};
    return {
      order: String(row.order),
      bvid: String(row.bvid),
      taskId: receipt.taskId ?? null,
      taskRevision: receipt.taskRevision ?? null,
      sourceIdentity: receipt.sourceIdentity ?? null,
      dependencyGeneration: receipt.dependencyGeneration ?? null,
      derivativeSha256: receipt.derivativeSha256 ?? null,
      captureArtifactSha256: captured.captureArtifactSha256 ?? null,
      bundleSha256: captured.bundleSha256 ?? null,
      reviewBindingSha256: captured.reviewBindingSha256 ?? null,
      captureStatus: captured.captureStatus ?? null,
      captureCounts: captured.captureCounts ?? null,
      captureClosure: captured.captureClosure ?? null,
    };
  });
  const derivedAuthority = buildCandidateAuthority({
    runId,
    registrySha256,
    machineGatePositive,
    sources: derivedSources,
    captureStatus: derivedSources.length === 6
      && derivedSources.every((source) => source.captureStatus === "captured")
      ? "captured"
      : "failed",
    closureCounts: {
      evidence: derivedSources.reduce((sum, source) => sum + Number(source.captureCounts?.evidence ?? 0), 0),
      thumbnails: derivedSources.reduce((sum, source) => sum + Number(source.captureCounts?.thumbnails ?? 0), 0),
      chapters: derivedSources.reduce((sum, source) => sum + Number(source.captureCounts?.chapters ?? 0), 0),
    },
  });
  const authorityDefects = candidateAuthorityDefects(derivedAuthority, { registrySha256 });
  const authorityMirrorMatches = JSON.stringify(authority) === JSON.stringify(derivedAuthority);
  if (machineGatePositive && (authorityDefects.length > 0 || !authorityMirrorMatches)) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.AUTHORITY);
  }

  // 4. The machine rows are derived from the raw receipts.
  const rows = aggregateRows.map((row) => publicMachineRow(row));
  const counts = machineGateFromRows(rows).counts;

  // 5. The LEDGER is reconciled against the receipts.
  const providerCallsInReceipts = rows.reduce(
    (sum, row) => sum + (Number.isInteger(row.providerOutboundHttpAttempts)
      ? row.providerOutboundHttpAttempts
      : 0),
    0,
  );
  const providerCallsInLedger = Number(ledgerTotals.candidate?.providerCall ?? 0);
  const ledgerIntegrityOk = ledgerTotals.integrityOk === true;
  if (!ledgerIntegrityOk) codes.push(PUBLIC_EVIDENCE_FAILURE.LEDGER);
  if (providerCallsInLedger !== providerCallsInReceipts) codes.push(PUBLIC_EVIDENCE_FAILURE.LEDGER);

  // 6. The SCAN must be clean.
  const scanFacts = {
    secretHits: Number(scan?.secretHits ?? 0),
    absolutePathHits: Number(scan?.absolutePathHits ?? 0),
    rawMediaPayloadHits: Number(scan?.rawMediaPayloadHits ?? 0),
  };
  if (scanFacts.secretHits > 0 || scanFacts.absolutePathHits > 0 || scanFacts.rawMediaPayloadHits > 0) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.SCAN);
  }

  // 7. The PRECOMMIT is validated against the canonical protocol.
  const precommitVerdict = reviewPrecommitDefects(precommit, {
    repoRoot,
    expectedRegistryOrder: registryOrder,
  });
  if (!precommitVerdict.ok) codes.push(PUBLIC_EVIDENCE_FAILURE.PRECOMMIT);

  // 8. The LOCK must bind the run and the registry.
  const lockVerdict = validateCandidateLock(lock, { runId, registrySha256 });
  if (!lockVerdict.ok) codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);

  // 9. The REVIEW is authorized by the machine gate and recomputed by the
  //    production semantic aggregate.
  const reviewAuthorized = machineGatePositive;
  let reviewVerdict = null;
  // The blind review was PERFORMED only when it was authorized AND it
  // happened: the rows are the evidence, never the intent.
  let blindReviewPerformed = false;
  if (reviewAuthorized) {
    const rubricSha256 = precommit?.protocol?.rubric?.sha256 ?? null;
    const promptSha256 = precommit?.protocol?.prompt?.sha256 ?? null;
    reviewVerdict = evaluateB6Aggregate({
      rows: Array.isArray(reviewRows) ? reviewRows : [],
      sentinel: Array.isArray(sentinelReviews)
        ? { reviews: sentinelReviews }
        : null,
      authority: derivedAuthority,
      expected: { rubricSha256, promptSha256 },
    });
    blindReviewPerformed = Array.isArray(reviewRows) && reviewRows.length === 6
      && Array.isArray(sentinelReviews) && sentinelReviews.length === 2;
    if (!blindReviewPerformed || reviewVerdict.failures.length > 0) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.REVIEW);
    }
  } else if ((Array.isArray(reviewRows) && reviewRows.length > 0)
    || (Array.isArray(sentinelReviews) && sentinelReviews.length > 0)) {
    // A review without a positive machine gate is a FORGERY.
    codes.push(PUBLIC_EVIDENCE_FAILURE.REVIEW);
  }

  // 10. The RETENTION records are projected into their public form.
  const retention = [];
  for (const record of retentionRecords) {
    const projection = publicRetentionProjection(record);
    const verdict = publicRetentionDefects(projection);
    if (!verdict.ok) codes.push(PUBLIC_EVIDENCE_FAILURE.RETENTION);
    retention.push(projection);
  }

  const payloads = [
    {
      name: "00-review-precommit.json",
      content: `${JSON.stringify(precommit ?? null, null, 2)}\n`,
    },
    {
      name: "01-candidate-lock.json",
      content: `${JSON.stringify(lock ?? null, null, 2)}\n`,
    },
    {
      name: "02-six-source-machine-results.json",
      content: `${JSON.stringify({
        schemaVersion: PUBLIC_EVIDENCE_SCHEMA,
        kind: "machine-results",
        runId: runId ?? null,
        registrySha256: registrySha256 ?? null,
        machineGate: { positive: machineGatePositive, counts },
        sources: rows,
      }, null, 2)}\n`,
    },
    {
      name: "03-bundle-verification.json",
      content: `${JSON.stringify({
        schemaVersion: PUBLIC_EVIDENCE_SCHEMA,
        kind: "bundle-verification",
        runId: runId ?? null,
        bundles,
        summary: {
          present: bundles.filter((bundle) => bundle.present).length,
          validated: bundles.filter((bundle) => bundle.validationOk).length,
          manifestVerified: bundles.filter((bundle) => bundle.manifestOk).length,
          captureClosed: bundles.filter((bundle) => bundle.captureStatus === "captured").length,
        },
      }, null, 2)}\n`,
    },
    {
      name: "04-action-ledger-reconciliation.json",
      content: `${JSON.stringify({
        schemaVersion: PUBLIC_EVIDENCE_SCHEMA,
        kind: "action-ledger-reconciliation",
        runId: runId ?? null,
        integrityOk: ledgerIntegrityOk,
        malformedLines: Number(ledgerTotals.malformedLines ?? 0),
        eventCount: Number(ledgerTotals.eventCount ?? 0),
        candidateTotals: ledgerTotals.candidate ?? {},
        eventTally: ledgerTotals.eventTally ?? ledgerTotals.stage ?? {},
        providerCallsInLedger,
        providerCallsInReceipts,
      }, null, 2)}\n`,
    },
    {
      name: "05-review-decision.json",
      content: `${JSON.stringify({
        schemaVersion: PUBLIC_EVIDENCE_SCHEMA,
        kind: "review-decision",
        runId: runId ?? null,
        machineGatePositive,
        counts,
        reviewAuthorized,
        blindReviewPerformed,
        reviewRows: Array.isArray(reviewRows) ? reviewRows.length : 0,
        sentinelReceipts: Array.isArray(sentinelReviews) ? sentinelReviews.length : 0,
        aggregateFailures: aggregateVerdict.failures.map((failure) => failure.code),
        reviewFailures: reviewVerdict ? reviewVerdict.failures.map((failure) => failure.code) : [],
        // The narrative is GENERATED from the machine facts.
        summary: machineGatePositive
          ? "The machine gate is positive; the blind review is authorized by the precommitment."
          : `The machine gate is negative (${counts.complete} complete, ${counts.limited} limited, ${counts.blocked} blocked, ${counts.failed} failed of ${counts.total}); no blind review is performed.`,
      }, null, 2)}\n`,
    },
    {
      name: "06-retention-ledger.json",
      content: `${JSON.stringify({
        schemaVersion: PUBLIC_EVIDENCE_SCHEMA,
        kind: "retention-ledger",
        runId: runId ?? null,
        records: retention,
      }, null, 2)}\n`,
    },
    {
      name: "07-scan.json",
      content: `${JSON.stringify({
        schemaVersion: PUBLIC_EVIDENCE_SCHEMA,
        kind: "scan",
        runId: runId ?? null,
        ...scanFacts,
      }, null, 2)}\n`,
    },
  ];
  return {
    payloads,
    counts,
    machineGatePositive,
    bundles,
    rows,
    codes: [...new Set(codes)].sort(),
    ok: codes.length === 0,
    aggregateVerdict,
    reviewVerdict,
  };
}

/**
 * The defects of a candidate lock.
 *
 * The lock binds the run and the registry: an arbitrary lock is a refusal.
 */
export function validateCandidateLock(lock, {
  runId = null,
  registrySha256 = null,
  expectedRegistryOrder = FROZEN_SIX,
  expectedReserves = RESERVE_SOURCES.map((entry) => entry.bvid),
} = {}) {
  const codes = [];
  if (!isPlainObject(lock)) {
    return { ok: false, codes: [PUBLIC_EVIDENCE_FAILURE.LOCK] };
  }
  if (!hasExactKeys(lock, [
    "schemaVersion", "batch", "lockedBeforeAnyExternalAction", "lockedAtUtc",
    "runId", "registry", "harness", "executionClosure", "dependencies",
  ]) || lock.schemaVersion !== "v3-5.10-b6-candidate-lock/v2") {
    codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
  }
  if (typeof lock.runId !== "string" || !lock.runId.trim()) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
  } else if (runId && lock.runId !== runId) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.RUN_BINDING);
  }
  const digest = lock.registry?.activeRegistrySha256 ?? null;
  if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
  } else if (registrySha256 && digest !== registrySha256) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
  }
  if (lock.lockedBeforeAnyExternalAction !== true) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
  }
  // The DEPENDENCY IDENTITIES of the lock: the safe identities only. A path,
  // a database name, a credential and a Provider identity are never a lock
  // detail.
  const lockDependencies = lock.dependencies ?? null;
  if (!isPlainObject(lockDependencies)
    || !hasExactKeys(lockDependencies, ["schemaVersion", "identities"])
    || lockDependencies.schemaVersion !== CANDIDATE_DEPENDENCY_SCHEMA
    || !isPlainObject(lockDependencies.identities)) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
  } else {
    for (const kind of Object.keys(CANDIDATE_DEPENDENCY_IDENTITY_KEYS)) {
      const identity = lockDependencies.identities[kind] ?? null;
      if (!hasExactKeys(identity, CANDIDATE_DEPENDENCY_IDENTITY_KEYS[kind])) {
        codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
        break;
      }
      for (const [key, value] of Object.entries(identity)) {
        if (typeof value === "string" && (path.isAbsolute(value) || value.includes("/"))) {
          codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
          break;
        }
      }
    }
  }
  const lockedAt = lock.lockedAtUtc;
  if (typeof lockedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(lockedAt)
    || !Number.isFinite(Date.parse(lockedAt))) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
  }
  const registry = lock.registry;
  if (!hasExactKeys(registry, [
    "activeRegistryPath", "activeRegistrySha256", "expectedRegistrySha256",
    "digestMatches", "order", "reserves", "substitutionAllowed",
  ])) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
  } else {
    const expectedOrder = expectedRegistryOrder.map((entry) => ({
      order: String(typeof entry === "object" ? entry.order : entry),
      bvid: typeof entry === "object"
        ? entry.bvid
        : FROZEN_SIX.find((source) => source.order === String(entry))?.bvid ?? null,
    }));
    if (!Array.isArray(registry.order)
      || JSON.stringify(registry.order) !== JSON.stringify(expectedOrder)
      || !Array.isArray(registry.reserves)
      || JSON.stringify(registry.reserves) !== JSON.stringify(expectedReserves)
      || registry.digestMatches !== true
      || registry.substitutionAllowed !== false
      || typeof registry.activeRegistryPath !== "string"
      || !registry.activeRegistryPath
      || path.isAbsolute(registry.activeRegistryPath)
      || registry.expectedRegistrySha256 !== registrySha256) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
    }
  }
  const harness = lock.harness;
  if (!Array.isArray(harness) || harness.length === 0) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
  } else {
    const seen = new Set();
    for (const entry of harness) {
      if (!hasExactKeys(entry, ["file", "sha256"])
        || typeof entry.file !== "string"
        || !entry.file.startsWith("scripts/stage_b_b5_3/")
        || path.isAbsolute(entry.file)
        || !/^[0-9a-f]{64}$/.test(entry.sha256)
        || seen.has(entry.file)) {
        codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
        break;
      }
      seen.add(entry.file);
    }
  }
  const closure = lock.executionClosure;
  if (!hasExactKeys(closure, ["schemaVersion", "fileCount", "toolIdentities"])
    || closure.schemaVersion !== EXECUTION_CLOSURE_SCHEMA
    || !Number.isInteger(closure.fileCount)
    || closure.fileCount <= 0
    || !hasExactKeys(closure.toolIdentities, EXECUTION_CLOSURE_TOOL_IDENTITY_KEYS)
    || EXECUTION_CLOSURE_TOOL_IDENTITY_KEYS.some((key) => closure.toolIdentities?.[key] === null
      || closure.toolIdentities?.[key] === undefined
      || closure.toolIdentities?.[key] === "")) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
  }
  return { ok: codes.length === 0, codes: [...new Set(codes)].sort() };
}

/**
 * Validate a generated public evidence package.
 *
 * The validation binds the run and the sources, recomputes the counts from
 * the rows, refuses a machine gate that the rows do not support, refuses a
 * blind review without a positive gate, refuses an invalid ledger, a dirty
 * scan, an arbitrary lock or precommit and a public retention record that
 * carries a path.
 */
export function validatePublicEvidence(payloads, {
  runId = null,
  expectedRegistryOrder = null,
  registrySha256 = null,
  repoRoot = null,
} = {}) {
  const codes = [];
  const byName = new Map((payloads ?? []).map((payload) => [payload.name, payload]));
  const parse = (name) => {
    const payload = byName.get(name);
    if (!payload) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.SCHEMA);
      return null;
    }
    try {
      return JSON.parse(payload.content);
    } catch {
      codes.push(PUBLIC_EVIDENCE_FAILURE.SCHEMA);
      return null;
    }
  };
  const precommit = parse("00-review-precommit.json");
  const lock = parse("01-candidate-lock.json");
  const machine = parse("02-six-source-machine-results.json");
  const bundles = parse("03-bundle-verification.json");
  const ledger = parse("04-action-ledger-reconciliation.json");
  const decision = parse("05-review-decision.json");
  const retention = parse("06-retention-ledger.json");
  const scan = parse("07-scan.json");
  if (!precommit || !lock || !machine || !bundles || !ledger || !decision || !retention || !scan) {
    return { ok: false, codes: [...new Set(codes)].sort() };
  }
  for (const payload of [machine, bundles, ledger, decision, retention, scan]) {
    if (payload.schemaVersion !== PUBLIC_EVIDENCE_SCHEMA) codes.push(PUBLIC_EVIDENCE_FAILURE.SCHEMA);
    // The RUN BINDING is mandatory: an absent run id is a defect, never a
    // reason to skip the check.
    if (typeof payload.runId !== "string" || !payload.runId.trim()) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.RUN_BINDING);
      continue;
    }
    if (runId && payload.runId !== runId) codes.push(PUBLIC_EVIDENCE_FAILURE.RUN_BINDING);
  }
  if (typeof precommit.runId !== "string" || !precommit.runId.trim()
    || (runId && precommit.runId !== runId)) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.RUN_BINDING);
  }
  if (typeof lock.runId !== "string" || !lock.runId.trim()
    || (runId && lock.runId !== runId)) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.RUN_BINDING);
  }

  const rows = machine.sources ?? [];
  for (const row of rows) {
    if (!hasExactKeys(row, MACHINE_ROW_KEYS)) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.SCHEMA);
      continue;
    }
    if (!["complete", "limited", "blocked", "failed", "unknown"].includes(row.disposition)) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.DISPOSITION);
    }
    // The terminal code is a STABLE, allowlisted code. A generic `Error`, an
    // exception name, an exception message, a path, a database name, a
    // credential and a Provider identity are never published.
    if (!publicFailureCodeDefect(row.failureCode).ok) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.FAILURE_CODE);
    }
    if (!hasExactKeys(row.uploadCounters ?? {}, UPLOAD_COUNTER_KEYS)) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.SCHEMA);
    }
    if (row.quality !== null && !hasExactKeys(row.quality, QUALITY_KEYS)) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.SCHEMA);
    }
    if (row.stageADiagnostic !== null && !hasExactKeys(row.stageADiagnostic, STAGE_A_KEYS)) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.SCHEMA);
    }
    if (row.executionClosure !== null && !hasExactKeys(row.executionClosure, CLOSURE_KEYS)) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.SCHEMA);
    }
  }
  if (expectedRegistryOrder) {
    const observed = rows.map((row) => row.order);
    if (JSON.stringify(observed) !== JSON.stringify(expectedRegistryOrder.map(String))) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.ORDER);
    }
  }
  const counts = decision.counts ?? {};
  const recomputed = machineGateFromRows(rows).counts;
  for (const key of Object.keys(recomputed)) {
    if (Number(counts[key]) !== recomputed[key]) codes.push(PUBLIC_EVIDENCE_FAILURE.COUNT);
  }
  // The MACHINE GATE is an exact derived fact, in both directions.
  const declaredGate = machine.machineGate?.positive === true;
  const rowGate = machineGateFromRows(rows);
  if (declaredGate !== rowGate.positive) codes.push(PUBLIC_EVIDENCE_FAILURE.MACHINE_GATE);
  if (declaredGate !== (decision.machineGatePositive === true)) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.MACHINE_GATE);
  }
  // A BLIND REVIEW without a positive machine gate is a forgery.
  if (decision.reviewAuthorized !== declaredGate) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.REVIEW);
  }
  if (declaredGate) {
    if (decision.blindReviewPerformed !== true
      || Number(decision.reviewRows ?? 0) !== 6
      || Number(decision.sentinelReceipts ?? 0) !== 2
      || !Array.isArray(decision.reviewFailures)
      || decision.reviewFailures.length !== 0
      || !Array.isArray(decision.aggregateFailures)
      || decision.aggregateFailures.length !== 0) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.REVIEW);
    }
  } else if (decision.blindReviewPerformed !== false
    || Number(decision.reviewRows ?? 0) !== 0
    || Number(decision.sentinelReceipts ?? 0) !== 0) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.REVIEW);
  }
  // The LEDGER must be intact and reconciled.
  if (ledger.integrityOk !== true) codes.push(PUBLIC_EVIDENCE_FAILURE.LEDGER);
  const providerCallsLedger = Number(ledger.providerCallsInLedger ?? 0);
  const providerCallsReceipts = Number(ledger.providerCallsInReceipts ?? 0);
  if (providerCallsLedger !== providerCallsReceipts) codes.push(PUBLIC_EVIDENCE_FAILURE.LEDGER);
  // The SCAN must be clean.
  if (!hasExactKeys(scan, SCAN_PAYLOAD_KEYS)) {
    codes.push(PUBLIC_EVIDENCE_FAILURE.SCHEMA);
  } else {
    for (const key of SCAN_KEYS) {
      if (Number(scan[key] ?? 0) !== 0) codes.push(PUBLIC_EVIDENCE_FAILURE.SCAN);
    }
  }
  // The BUNDLES must be well formed and bound to a source.
  for (const bundle of bundles.bundles ?? []) {
    if (!hasExactKeys(bundle, BUNDLE_KEYS)) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.SCHEMA);
      continue;
    }
    const row = rows.find((candidate) => candidate.order === bundle.order);
    if (!row) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.SOURCE_BINDING);
      continue;
    }
    if (row.bvid !== bundle.bvid) codes.push(PUBLIC_EVIDENCE_FAILURE.SOURCE_BINDING);
    if (bundle.present === true && bundle.validationOk !== true) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.BUNDLE_INVALID);
    }
  }
  // A POSITIVE machine gate requires a CLOSED bundle for EVERY source: a
  // package that claims a positive gate without the bundles is refused.
  if (declaredGate) {
    const bundleRows = bundles.bundles ?? [];
    if (bundleRows.length !== rows.length) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.BUNDLE_MISSING);
    }
    for (const bundle of bundleRows) {
      if (bundle.present !== true || bundle.validationOk !== true) {
        codes.push(PUBLIC_EVIDENCE_FAILURE.BUNDLE_MISSING);
      }
    }
  }
  // The LOCK must bind the run and the registry.
  const lockVerdict = validateCandidateLock(lock, { runId, registrySha256 });
  if (!lockVerdict.ok) codes.push(PUBLIC_EVIDENCE_FAILURE.LOCK);
  // The PRECOMMIT must be the canonical one.
  const precommitVerdict = reviewPrecommitDefects(precommit, {
    repoRoot,
    expectedRegistryOrder,
  });
  if (!precommitVerdict.ok) codes.push(PUBLIC_EVIDENCE_FAILURE.PRECOMMIT);
  // The PUBLIC RETENTION records may never carry a path.
  for (const record of retention.records ?? []) {
    if (!hasExactKeys(record, RETENTION_RECORD_KEYS)) {
      codes.push(PUBLIC_EVIDENCE_FAILURE.RETENTION);
      continue;
    }
    if (!publicRetentionDefects(record).ok) codes.push(PUBLIC_EVIDENCE_FAILURE.RETENTION);
  }
  return { ok: codes.length === 0, codes: [...new Set(codes)].sort() };
}

/**
 * The manifest text of a generated package.
 */
export function publicEvidenceManifest(payloads) {
  return `${payloads
    .map((payload) => `${sha256(payload.content)}  ${payload.name}`)
    .join("\n")}\n`;
}
