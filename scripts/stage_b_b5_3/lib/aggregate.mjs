// The Stage B aggregate evaluation.
//
// It is PURE: it takes plain data and returns a verdict. The sequencer
// collects the data (files, receipts, audits) and hands it over, so every
// branch is testable without Chrome, Runtime, Provider or network.
//
// The ONLY machine-positive candidate aggregate is:
//
//   exactly six fresh attempts, complete >= 5, blocked <= 1, limited = 0,
//   failed = 0, no substitution, no reserve, no cross-run reuse, every
//   required receipt present and every audit clean.
//
// A candidate aggregate is still only a B-5 checkpoint candidate. It never
// announces B-5 or Stage B PASS.

import { FROZEN_SIX, RESERVE_SOURCES } from "./registry.mjs";
import { PROVIDER_LOCK, SELECTED_PROVIDER_ID } from "./contracts.mjs";
import {
  PUBLICATION_UPLOAD_COUNTER_KEYS,
  isRealPublication,
} from "./audit_finalizer.mjs";
import { ARTIFACT_FAILURE, checkArtifactIntegrity } from "./artifact_integrity.mjs";
import { DERIVED_TEXT_SCOPE, dispositionForQualityStatus } from "./contracts.mjs";
import {
  machineAttemptIdentityDefects,
  machineDispositionMismatch,
  machineIdentityDefects,
  machineTerminalDefects,
  taskNamespaceReceiptDefects,
} from "./machine_identity.mjs";

/** The locked Provider identity and endpoint class. */
const LOCKED_PROVIDER_ID = SELECTED_PROVIDER_ID;
const LOCKED_ENDPOINT_CLASS = PROVIDER_LOCK;

/** The frozen positive-candidate threshold. */
export const AGGREGATE_POSITIVE = Object.freeze({
  requiredSources: 6,
  completeMinimum: 5,
  blockedMaximum: 1,
  limitedMaximum: 0,
  failedMaximum: 0,
});

/** The failure codes of the aggregate. */
export const AGGREGATE_FAILURE = Object.freeze({
  FAILED_SOURCE: "AGG_FAILED_SOURCE",
  LIMITED_SOURCE: "AGG_LIMITED_SOURCE",
  TOO_MANY_BLOCKED: "AGG_TOO_MANY_BLOCKED",
  INCOMPLETE_ATTEMPT_SET: "AGG_INCOMPLETE_ATTEMPT_SET",
  MISSING_EVIDENCE: "AGG_MISSING_EVIDENCE",
  IDENTITY_MISMATCH: "AGG_IDENTITY_MISMATCH",
  RESERVE_USED: "AGG_RESERVE_USED",
  STALE_ARTIFACT: "AGG_STALE_ARTIFACT",
  CROSS_RUN_REUSE: "AGG_CROSS_RUN_REUSE",
  AUDIT_FAILED: "AGG_AUDIT_FAILED",
  LEDGER_INTEGRITY: "AGG_LEDGER_INTEGRITY",
  NOT_FRESH: "AGG_NOT_FRESH",
  DISPOSITION_INVALID: "AGG_DISPOSITION_INVALID",
  PUBLICATION_MISSING: "AGG_PUBLICATION_MISSING",
  PUBLICATION_INVALID: "AGG_PUBLICATION_INVALID",
  MIRROR_INVALID: "AGG_MIRROR_INVALID",
  LEDGER_ACCOUNTING: "AGG_LEDGER_ACCOUNTING",
  REQUEST_COUNT_INVALID: "AGG_REQUEST_COUNT_INVALID",
  MACHINE_IDENTITY_INVALID: "AGG_MACHINE_IDENTITY_INVALID",
  MACHINE_TERMINAL_INVALID: "AGG_MACHINE_TERMINAL_INVALID",
  NAMESPACE_RECEIPT_INVALID: "AGG_NAMESPACE_RECEIPT_INVALID",
  EXECUTION_CLOSURE_INVALID: "AGG_EXECUTION_CLOSURE_INVALID",
  QUALITY_DISPOSITION_MISMATCH: "AGG_QUALITY_DISPOSITION_MISMATCH",
  BLOCKED_STATE_INVALID: "AGG_BLOCKED_STATE_INVALID",
  ARTIFACT_MISSING: ARTIFACT_FAILURE.MISSING,
  ARTIFACT_MALFORMED: ARTIFACT_FAILURE.MALFORMED,
  ARTIFACT_INVALID: ARTIFACT_FAILURE.INVALID,
  ARTIFACT_HASH_MISMATCH: ARTIFACT_FAILURE.HASH_MISMATCH,
  RECEIPT_HASH_MISMATCH: ARTIFACT_FAILURE.RECEIPT_HASH_MISMATCH,
  RECEIPT_MISMATCH: ARTIFACT_FAILURE.RECEIPT_MISMATCH,
  ARTIFACT_IDENTITY_MISMATCH: ARTIFACT_FAILURE.IDENTITY_MISMATCH,
});

/** The evidence every source row must carry. */
export const REQUIRED_SOURCE_EVIDENCE = Object.freeze([
  "final_disposition.txt",
  "b5-source-receipt.json",
  "isolation.json",
  "receipt.json",
  "provider_lock.txt",
  "chrome_launch.log",
  "secret_scan.csv",
  "cleanup.json",
  "task_namespace.json",
]);

/** The six upload counters that must be exactly zero. */
export const UPLOAD_COUNTER_KEYS = Object.freeze([
  "rawVideoUploadCount",
  "rawAudioUploadCount",
  "frameByteUploadCount",
  "cookieUploadCount",
  "apiKeyDisclosureCount",
  "localPathUploadCount",
]);

/**
 * The FROZEN V2.1 receipt identity.
 *
 * A published receipt must carry every one of these fields with the right
 * type: a partial receipt is not a receipt.
 */
export const FROZEN_V21_RECEIPT_FIELDS = Object.freeze([
  "providerId", "modelId", "outboundDerivedTextSha256", "requestCount",
  "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
  "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount",
  "endpointClass", "structureMode", "attemptId", "latencyMs",
  "requestSha256", "responseSha256", "finishReason",
]);

/** The EXACT mirror schema version. */
export const MIRROR_SCHEMA_VERSION = "v3-5.10-b5-3-receipt-mirror/v2";

/** The EXACT wrapper key set of the receipt mirror. */
export const MIRROR_REQUIRED_KEYS = Object.freeze([
  "schemaVersion", "taskId", "receipt", "published", "derivativeSha256",
  "taskIdNamespace", "providerLock", "selectedProviderId", "selectedEndpointClass",
  "derivedTextScope",
]);

/** The identity fields that the mirror and the machine receipt must share. */
export const PUBLICATION_IDENTITY_FIELDS = Object.freeze([
  "providerId", "modelId", "endpointClass", "structureMode", "attemptId",
  "requestCount", "latencyMs", "requestSha256", "responseSha256",
  "outboundDerivedTextSha256", "finishReason",
]);

const SHA256_HEX = /^[0-9a-f]{64}$/;
const RESERVE_BVIDS = new Set(RESERVE_SOURCES.map((entry) => entry.bvid));
const VALID_DISPOSITIONS = new Set(["complete", "limited", "blocked", "failed"]);

/**
 * The defects of a frozen V2.1 receipt.
 *
 * An empty array means the receipt carries the COMPLETE identity.
 */
export function frozenReceiptDefects(receipt) {
  const defects = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return ["the receipt is not an object"];
  }
  for (const field of FROZEN_V21_RECEIPT_FIELDS) {
    if (!(field in receipt)) defects.push(`the receipt lacks ${field}`);
  }
  for (const field of ["providerId", "modelId", "endpointClass", "structureMode", "attemptId", "finishReason"]) {
    if (typeof receipt[field] !== "string" || !receipt[field]) {
      defects.push(`the receipt has no ${field}`);
    }
  }
  if (!Number.isInteger(receipt.requestCount) || receipt.requestCount < 1) {
    defects.push("the receipt has no valid requestCount");
  }
  if (typeof receipt.latencyMs !== "number" || !Number.isFinite(receipt.latencyMs) || receipt.latencyMs < 0) {
    defects.push("the receipt has no valid latencyMs");
  }
  for (const field of ["requestSha256", "responseSha256", "outboundDerivedTextSha256"]) {
    if (typeof receipt[field] !== "string" || !SHA256_HEX.test(receipt[field])) {
      defects.push(`the receipt has no valid ${field}`);
    }
  }
  for (const field of PUBLICATION_UPLOAD_COUNTER_KEYS) {
    if (!Number.isInteger(receipt[field]) || receipt[field] < 0) {
      defects.push(`the receipt has no valid ${field}`);
    }
  }
  return defects;
}

function fail(code, detail) {
  return { code, detail };
}

/**
 * Evaluate the aggregate of a Stage B batch.
 *
 * @param {object} input
 * @param {Array} input.rows            the per-source rows, in registry order
 * @param {string} input.runId          the current run id
 * @param {string} input.registrySha256 the active registry digest
 * @param {object|null} input.stopReceipt an explicit fail-closed stop receipt
 */
export function evaluateAggregate({
  rows = [],
  runId,
  registrySha256,
  stopReceipt = null,
  ledgerIntegrityOk = true,
  candidateLedgerTotals = null,
}) {
  const failures = [];
  if (!ledgerIntegrityOk) {
    // A malformed, truncated or unknown ledger line breaks the integrity of
    // the stage accounting: the aggregate may never be positive.
    failures.push(
      fail(AGGREGATE_FAILURE.LEDGER_INTEGRITY, "the stage action ledger is not intact"),
    );
  }
  const counts = { complete: 0, limited: 0, blocked: 0, failed: 0, total: rows.length };
  const attemptedFactsByRow = [];
  const seenTaskIds = new Set();
  const seenNamespaces = new Set();
  const seenDatabases = new Set();
  const seenProfiles = new Set();

  rows.forEach((row, index) => {
    const label = `source ${row.order}/${row.bvid}`;
    const disposition = String(row.disposition ?? "");

    // 1. The identity and the order must be the registry's.
    const expected = FROZEN_SIX.find((entry) => entry.order === String(row.order));
    if (!expected) {
      failures.push(fail(AGGREGATE_FAILURE.IDENTITY_MISMATCH, `${label} has no registry order`));
    } else if (expected.bvid !== String(row.bvid)) {
      failures.push(
        fail(AGGREGATE_FAILURE.IDENTITY_MISMATCH, `${label} is not the registry identity`),
      );
    }
    if (RESERVE_BVIDS.has(String(row.bvid))) {
      failures.push(fail(AGGREGATE_FAILURE.RESERVE_USED, `${label} is a frozen reserve`));
    }

    // 2. The disposition must be one of the frozen four.
    if (!VALID_DISPOSITIONS.has(disposition)) {
      failures.push(
        fail(AGGREGATE_FAILURE.DISPOSITION_INVALID, `${label} has disposition "${disposition}"`),
      );
    } else {
      counts[disposition] += 1;
      if (disposition === "failed") {
        failures.push(fail(AGGREGATE_FAILURE.FAILED_SOURCE, `${label} is failed`));
      }
      if (disposition === "limited") {
        failures.push(fail(AGGREGATE_FAILURE.LIMITED_SOURCE, `${label} is limited`));
      }
    }

    // 3. The required evidence must be present.
    const evidence = row.evidence || {};
    for (const name of REQUIRED_SOURCE_EVIDENCE) {
      if (!evidence[name]) {
        failures.push(fail(AGGREGATE_FAILURE.MISSING_EVIDENCE, `${label} lacks ${name}`));
      }
    }

    // 4. The machine receipt must be present and must belong to THIS run.
    const receipt = row.receipt || null;
    // The Provider facts of the row. They are read here, outside the
    // presence check, so that a row WITHOUT a receipt is still judged by
    // its attempt accounting.
    const provider = receipt && receipt.provider && typeof receipt.provider === "object"
      ? receipt.provider
      : null;
    const published = provider ? (provider.published ?? null) : null;
    const selectedProviderId = provider
      ? provider.selectedProviderId
      : (receipt ? (receipt.selectedProviderId ?? receipt.providerId) : undefined);
    const selectedEndpointClass = provider
      ? provider.selectedEndpointClass
      : (receipt ? (receipt.selectedEndpointClass ?? receipt.endpointClass) : undefined);
    if (!receipt) {
      failures.push(fail(AGGREGATE_FAILURE.MISSING_EVIDENCE, `${label} has no machine receipt`));
    } else {
      // Every attempted row, including a pre-synthesis blocked row, is bound
      // to the current run, registry and source authority. Complete rows add
      // the stricter product-task identity below.
      for (const defect of machineAttemptIdentityDefects(receipt, {
        runId,
        registrySha256,
        order: row.order,
        bvid: row.bvid,
      })) {
        failures.push(
          fail(AGGREGATE_FAILURE.MACHINE_IDENTITY_INVALID, `${label} ${defect}`),
        );
      }
      // The machine receipt must describe THIS source.
      if (receipt.bvid && String(receipt.bvid) !== String(row.bvid)) {
        failures.push(
          fail(AGGREGATE_FAILURE.IDENTITY_MISMATCH, `${label} carries another source identity`),
        );
      }
      if (receipt.bvid && RESERVE_BVIDS.has(String(receipt.bvid))) {
        failures.push(fail(AGGREGATE_FAILURE.RESERVE_USED, `${label} carries a frozen reserve`));
      }
      if (receipt.order !== undefined && String(receipt.order) !== String(row.order)) {
        failures.push(
          fail(AGGREGATE_FAILURE.IDENTITY_MISMATCH, `${label} carries another registry order`),
        );
      }
      if (receipt.runId !== runId) {
        failures.push(
          fail(AGGREGATE_FAILURE.CROSS_RUN_REUSE, `${label} carries run ${receipt.runId}`),
        );
      }
      if (receipt.registrySha256 !== registrySha256) {
        failures.push(
          fail(AGGREGATE_FAILURE.STALE_ARTIFACT, `${label} was produced against another registry`),
        );
      }
      if (!receipt.startedAtUtc || !receipt.finishedAtUtc) {
        failures.push(fail(AGGREGATE_FAILURE.NOT_FRESH, `${label} has no fresh attempt window`));
      }
      if (receipt.taskId && seenTaskIds.has(receipt.taskId)) {
        failures.push(
          fail(AGGREGATE_FAILURE.CROSS_RUN_REUSE, `${label} reuses a task id`),
        );
      }
      if (receipt.taskId) seenTaskIds.add(receipt.taskId);
      if (receipt.taskNamespace && seenNamespaces.has(receipt.taskNamespace)) {
        failures.push(
          fail(AGGREGATE_FAILURE.CROSS_RUN_REUSE, `${label} reuses a task namespace`),
        );
      }
      if (receipt.taskNamespace) seenNamespaces.add(receipt.taskNamespace);
      if (receipt.runtimeDatabaseRef && seenDatabases.has(receipt.runtimeDatabaseRef)) {
        failures.push(
          fail(AGGREGATE_FAILURE.CROSS_RUN_REUSE, `${label} reuses a runtime database`),
        );
      }
      if (receipt.runtimeDatabaseRef) seenDatabases.add(receipt.runtimeDatabaseRef);
      if (receipt.chromeProfileRef && seenProfiles.has(receipt.chromeProfileRef)) {
        failures.push(
          fail(AGGREGATE_FAILURE.CROSS_RUN_REUSE, `${label} reuses a Chrome profile`),
        );
      }
      if (receipt.chromeProfileRef) seenProfiles.add(receipt.chromeProfileRef);
      // The GC-B6H-R EXECUTION CLOSURE verdict of this source. A closure
      // failure observed at ANY checkpoint survives the receipt merging and
      // makes the aggregate non-positive, even when the bytes were restored
      // before the closeout.
      const closure = receipt.executionClosure ?? null;
      if (closure && typeof closure === "object" && closure.ok === false) {
        failures.push(
          fail(AGGREGATE_FAILURE.EXECUTION_CLOSURE_INVALID, `${label} has an invalid execution closure`),
        );
      }
      // The upload counters must be exactly zero.
      const counters = receipt.uploadCounters || {};
      for (const key of UPLOAD_COUNTER_KEYS) {
        if (counters[key] !== 0) {
          failures.push(
            fail(AGGREGATE_FAILURE.AUDIT_FAILED, `${label} has ${key}=${counters[key]}`),
          );
        }
      }
      // The Provider authority: exactly one, exactly the locked one. A
      // FAILED attempt published no receipt, and an absent publication is
      // never a foreign Provider: only a PUBLISHED receipt is judged.
      if (published) {
        if (published.providerId !== LOCKED_PROVIDER_ID) {
          failures.push(
            fail(AGGREGATE_FAILURE.AUDIT_FAILED, `${label} published a foreign provider id`),
          );
        }
        if (published.endpointClass !== LOCKED_ENDPOINT_CLASS) {
          failures.push(
            fail(AGGREGATE_FAILURE.AUDIT_FAILED, `${label} published a foreign endpoint class`),
          );
        }
      } else {
        // No publication: the ATTEMPT is judged by the selected identity. A
        // missing selection is not a foreign Provider, and a failed attempt is
        // never misclassified because nothing was published.
        if (selectedProviderId && selectedProviderId !== LOCKED_PROVIDER_ID) {
          failures.push(
            fail(AGGREGATE_FAILURE.AUDIT_FAILED, `${label} has a foreign provider id`),
          );
        }
        if (selectedEndpointClass && selectedEndpointClass !== LOCKED_ENDPOINT_CLASS) {
          failures.push(
            fail(AGGREGATE_FAILURE.AUDIT_FAILED, `${label} has a foreign endpoint class`),
          );
        }
      }
    }

    // 4b. The ATTEMPT ACCOUNTING (CI2).
    //
    // Two facts per source: the number of Runtime synthesize ENDPOINT
    // invocations and the number of ACTUAL outbound Provider HTTP attempts.
    //
    //   * zero attempts are permitted ONLY when the source never reached
    //     synthesis (the pre-synthesis blocked case);
    //   * an ATTEMPTED synthesis with an UNKNOWN Provider HTTP count is
    //     never a positive candidate.
    const attempted = receipt && receipt.provider && typeof receipt.provider === "object"
      && receipt.provider.attempted && typeof receipt.provider.attempted === "object"
      ? receipt.provider.attempted
      : null;
    const attemptCount = attempted && Number.isInteger(attempted.attemptCount)
      ? attempted.attemptCount
      : null;
    const requestCount = attempted && Number.isInteger(attempted.requestCount)
      ? attempted.requestCount
      : null;
    attemptedFactsByRow.push({ attemptCount, requestCount });
    if (attemptCount === null) {
      failures.push(
        fail(AGGREGATE_FAILURE.LEDGER_ACCOUNTING, `${label} has no valid attempted.attemptCount`),
      );
    } else if (attemptCount === 0) {
      // The source never reached synthesis.
      if (disposition === "complete") {
        failures.push(
          fail(AGGREGATE_FAILURE.LEDGER_ACCOUNTING, `${label} published without reaching synthesis`),
        );
      }
      if (requestCount !== null && requestCount !== 0) {
        failures.push(
          fail(
            AGGREGATE_FAILURE.LEDGER_ACCOUNTING,
            `${label} reports outbound Provider attempts without a synthesis invocation`,
          ),
        );
      }
    } else if (requestCount === null) {
      failures.push(
        fail(
          AGGREGATE_FAILURE.LEDGER_ACCOUNTING,
          `${label} attempted a synthesis without a known Provider HTTP count`,
        ),
      );
    } else if (requestCount < 1) {
      // An ATTEMPTED synthesis with ZERO Provider HTTP requests is not a
      // positive candidate: the attempt and the count must agree.
      failures.push(
        fail(
          AGGREGATE_FAILURE.REQUEST_COUNT_INVALID,
          `${label} attempted a synthesis without a single Provider HTTP request`,
        ),
      );
    }

    // 4c. The PUBLICATION (CI2).
    //
    // A COMPLETE source must carry a real nested publication and a PARSED
    // mirror, and the two must cross-bind. The presence of the file is not
    // evidence.
    if (disposition === "complete" && receipt) {
      if (!published) {
        failures.push(
          fail(AGGREGATE_FAILURE.PUBLICATION_MISSING, `${label} has no publication`),
        );
      } else if (!isRealPublication(published)) {
        failures.push(
          fail(AGGREGATE_FAILURE.PUBLICATION_INVALID, `${label} has a partial publication`),
        );
      } else if (!Number.isInteger(published.requestCount) || published.requestCount < 1) {
        // A COMPLETE publication must have attempted at least one Provider
        // HTTP request.
        failures.push(
          fail(
            AGGREGATE_FAILURE.REQUEST_COUNT_INVALID,
            `${label} published without a single Provider HTTP request`,
          ),
        );
      }
      const mirror = row.mirror ?? null;
      if (!mirror || typeof mirror !== "object" || Array.isArray(mirror)) {
        failures.push(
          fail(AGGREGATE_FAILURE.MIRROR_INVALID, `${label} has no parsable receipt mirror`),
        );
      } else {
        // The mirror has the EXACT wrapper key set: nothing is missing and
        // nothing is extra.
        const mirrorKeys = Object.keys(mirror).sort();
        const requiredKeys = [...MIRROR_REQUIRED_KEYS].sort();
        const missingKeys = requiredKeys.filter((key) => !mirrorKeys.includes(key));
        const extraKeys = mirrorKeys.filter((key) => !requiredKeys.includes(key));
        if (missingKeys.length > 0) {
          failures.push(
            fail(
              AGGREGATE_FAILURE.MIRROR_INVALID,
              `${label} mirror lacks ${missingKeys.join(", ")}`,
            ),
          );
        }
        if (extraKeys.length > 0) {
          failures.push(
            fail(
              AGGREGATE_FAILURE.MIRROR_INVALID,
              `${label} mirror carries the additional field(s) ${extraKeys.join(", ")}`,
            ),
          );
        }
        if (mirror.schemaVersion !== MIRROR_SCHEMA_VERSION) {
          failures.push(
            fail(
              AGGREGATE_FAILURE.MIRROR_INVALID,
              `${label} mirror schema is ${String(mirror.schemaVersion ?? "absent")}`,
            ),
          );
        }
        // The locked selection is REQUIRED and EXACT, never optional.
        if (mirror.selectedProviderId !== LOCKED_PROVIDER_ID) {
          failures.push(
            fail(
              AGGREGATE_FAILURE.MIRROR_INVALID,
              `${label} mirror selects the provider id ${String(mirror.selectedProviderId ?? "absent")}`,
            ),
          );
        }
        if (mirror.selectedEndpointClass !== LOCKED_ENDPOINT_CLASS) {
          failures.push(
            fail(
              AGGREGATE_FAILURE.MIRROR_INVALID,
              `${label} mirror selects the endpoint class ${String(mirror.selectedEndpointClass ?? "absent")}`,
            ),
          );
        }
        if (mirror.providerLock !== LOCKED_ENDPOINT_CLASS) {
          failures.push(
            fail(
              AGGREGATE_FAILURE.MIRROR_INVALID,
              `${label} mirror carries the provider lock ${String(mirror.providerLock ?? "absent")}`,
            ),
          );
        }
        if (JSON.stringify(mirror.derivedTextScope) !== JSON.stringify(DERIVED_TEXT_SCOPE)) {
          failures.push(
            fail(
              AGGREGATE_FAILURE.MIRROR_INVALID,
              `${label} mirror carries the derived text scope ${JSON.stringify(mirror.derivedTextScope ?? null)}`,
            ),
          );
        }
        if (mirror.published !== true) {
          failures.push(
            fail(AGGREGATE_FAILURE.PUBLICATION_MISSING, `${label} mirror reports no publication`),
          );
        }
        const mirrorReceipt = mirror.receipt ?? null;
        const defects = frozenReceiptDefects(mirrorReceipt);
        if (defects.length > 0) {
          failures.push(
            fail(
              AGGREGATE_FAILURE.PUBLICATION_INVALID,
              `${label} mirror receipt is invalid: ${defects.join(", ")}`,
            ),
          );
        } else {
          if (mirrorReceipt.providerId !== LOCKED_PROVIDER_ID) {
            failures.push(
              fail(AGGREGATE_FAILURE.PUBLICATION_INVALID, `${label} mirror carries a foreign provider id`),
            );
          }
          if (mirrorReceipt.endpointClass !== LOCKED_ENDPOINT_CLASS) {
            failures.push(
              fail(AGGREGATE_FAILURE.PUBLICATION_INVALID, `${label} mirror carries a foreign endpoint class`),
            );
          }
          for (const key of UPLOAD_COUNTER_KEYS) {
            if (mirrorReceipt[key] !== 0) {
              failures.push(
                fail(AGGREGATE_FAILURE.AUDIT_FAILED, `${label} mirror has ${key}=${mirrorReceipt[key]}`),
              );
            }
          }
          // The TASK and the NAMESPACE must be the ones of the machine receipt.
          if (!mirror.taskId || mirror.taskId !== receipt?.taskId) {
            failures.push(
              fail(AGGREGATE_FAILURE.MIRROR_INVALID, `${label} mirror carries another task`),
            );
          }
          if (mirror.taskIdNamespace !== receipt?.taskNamespace) {
            failures.push(
              fail(AGGREGATE_FAILURE.MIRROR_INVALID, `${label} mirror carries another task namespace`),
            );
          }
          // The ARTIFACT hashes must be the ones of the machine receipt.
          if (!SHA256_HEX.test(String(mirror.derivativeSha256 ?? ""))) {
            failures.push(
              fail(AGGREGATE_FAILURE.MIRROR_INVALID, `${label} mirror has no valid derivativeSha256`),
            );
          } else if (mirror.derivativeSha256 !== receipt?.derivativeSha256) {
            failures.push(
              fail(AGGREGATE_FAILURE.MIRROR_INVALID, `${label} mirror carries another derivative`),
            );
          }
          if (published) {
            // The publication and the mirror must be the SAME receipt.
            for (const field of PUBLICATION_IDENTITY_FIELDS) {
              if (String(published[field]) !== String(mirrorReceipt[field])) {
                failures.push(
                  fail(
                    AGGREGATE_FAILURE.MIRROR_INVALID,
                    `${label} publication and mirror disagree on ${field}`,
                  ),
                );
              }
            }
            for (const key of PUBLICATION_UPLOAD_COUNTER_KEYS) {
              const publishedCounter = published.uploadCounters
                ? published.uploadCounters[key]
                : undefined;
              if (Number(publishedCounter) !== Number(mirrorReceipt[key])) {
                failures.push(
                  fail(
                    AGGREGATE_FAILURE.MIRROR_INVALID,
                    `${label} publication and mirror disagree on ${key}`,
                  ),
                );
              }
            }
          }
        }
      }
      // The machine receipt's own artifact hashes must be well formed.
      for (const key of ["derivativeSha256", "receiptSha256", "evidenceSha256"]) {
        if (!SHA256_HEX.test(String(receipt?.[key] ?? ""))) {
          failures.push(
            fail(AGGREGATE_FAILURE.PUBLICATION_INVALID, `${label} has no valid ${key}`),
          );
        }
      }
      // The ARTIFACT BYTES: the durable derivative must exist, parse,
      // satisfy the FROZEN V2.1 contract, hash to the declared digests and
      // carry the same identities.
      // The COMPLETE machine identity is MANDATORY. Every field is required,
      // typed and compared: a missing field is a defect, never a permission
      // to skip a comparison.
      for (const defect of machineIdentityDefects(receipt, {
        runId,
        registrySha256,
        order: row.order,
        bvid: row.bvid,
      })) {
        failures.push(
          fail(AGGREGATE_FAILURE.MACHINE_IDENTITY_INVALID, `${label} ${defect}`),
        );
      }

      const artifactVerdict = checkArtifactIntegrity({
        artifact: row.artifact ?? null,
        receipt,
        mirror: row.mirror ?? null,
        expected: {
          runId,
          registrySha256,
          order: row.order,
          bvid: row.bvid,
        },
      });
      for (const failure of artifactVerdict.failures) {
        failures.push(fail(failure.code, `${label} ${failure.detail}`));
      }

      // The ARTIFACT QUALITY must be bound to the DISPOSITION. The production
      // mapping is the single rule.
      const quality = artifactVerdict.parsed?.quality ?? null;
      if (quality) {
        const mapped = dispositionForQualityStatus(quality.status);
        if (mapped === null) {
          failures.push(
            fail(
              AGGREGATE_FAILURE.QUALITY_DISPOSITION_MISMATCH,
              `${label} artifact quality status ${String(quality.status)} has no frozen disposition`,
            ),
          );
        } else if (mapped !== disposition) {
          failures.push(
            fail(
              AGGREGATE_FAILURE.QUALITY_DISPOSITION_MISMATCH,
              `${label} artifact quality status ${String(quality.status)} maps to ${mapped} and the final disposition is ${disposition}`,
            ),
          );
        }
        if (disposition === "complete") {
          // A COMPLETE result carries no failure code: the production quality
          // evaluator builds it that way.
          if (quality.status !== "complete") {
            failures.push(
              fail(
                AGGREGATE_FAILURE.QUALITY_DISPOSITION_MISMATCH,
                `${label} is complete but its artifact quality status is ${String(quality.status)}`,
              ),
            );
          }
          if (!Array.isArray(quality.failureCodes) || quality.failureCodes.length > 0) {
            failures.push(
              fail(
                AGGREGATE_FAILURE.QUALITY_DISPOSITION_MISMATCH,
                `${label} is complete but its artifact carries ${Array.isArray(quality.failureCodes) ? quality.failureCodes.length : "no"} quality failure code(s)`,
              ),
            );
          }
        }
      } else if (disposition === "complete") {
        failures.push(
          fail(
            AGGREGATE_FAILURE.QUALITY_DISPOSITION_MISMATCH,
            `${label} is complete but carries no artifact quality`,
          ),
        );
      }
    }

    // A blocked source is the one positive-candidate exception, but only
    // before synthesis. It must not carry any successful publication fact.
    if (disposition === "blocked" && receipt) {
      if (attemptCount !== 0 || (requestCount !== null && requestCount !== 0)) {
        failures.push(
          fail(AGGREGATE_FAILURE.BLOCKED_STATE_INVALID, `${label} blocked after synthesis activity`),
        );
      }
      if (published !== null) {
        failures.push(
          fail(AGGREGATE_FAILURE.BLOCKED_STATE_INVALID, `${label} blocked with a Provider publication`),
        );
      }
      if (row.artifact !== null && row.artifact !== undefined) {
        failures.push(
          fail(AGGREGATE_FAILURE.BLOCKED_STATE_INVALID, `${label} blocked with derivative bytes`),
        );
      }
      for (const key of ["derivativeSha256", "receiptSha256", "evidenceSha256"]) {
        if (receipt[key] !== null && receipt[key] !== undefined) {
          failures.push(
            fail(AGGREGATE_FAILURE.BLOCKED_STATE_INVALID, `${label} blocked with ${key}`),
          );
        }
      }
      const mirror = row.mirror ?? null;
      if (!mirror || typeof mirror !== "object" || Array.isArray(mirror)) {
        failures.push(
          fail(AGGREGATE_FAILURE.MIRROR_INVALID, `${label} has no parsable blocked receipt mirror`),
        );
      } else {
        const mirrorKeys = Object.keys(mirror).sort();
        const requiredKeys = [...MIRROR_REQUIRED_KEYS].sort();
        if (JSON.stringify(mirrorKeys) !== JSON.stringify(requiredKeys)) {
          failures.push(
            fail(AGGREGATE_FAILURE.MIRROR_INVALID, `${label} blocked mirror has an invalid wrapper`),
          );
        }
        if (
          mirror.schemaVersion !== MIRROR_SCHEMA_VERSION
          || mirror.published !== false
          || mirror.receipt !== null
          || mirror.derivativeSha256 !== null
          || mirror.taskId !== (receipt.taskId ?? null)
          || mirror.taskIdNamespace !== receipt.taskNamespace
          || mirror.providerLock !== LOCKED_ENDPOINT_CLASS
          || mirror.selectedProviderId !== LOCKED_PROVIDER_ID
          || mirror.selectedEndpointClass !== LOCKED_ENDPOINT_CLASS
          || JSON.stringify(mirror.derivedTextScope) !== JSON.stringify(DERIVED_TEXT_SCOPE)
        ) {
          failures.push(
            fail(AGGREGATE_FAILURE.BLOCKED_STATE_INVALID, `${label} blocked mirror claims publication facts`),
          );
        }
      }
    }

    // 4d. The MACHINE TERMINAL shape: the disposition is REQUIRED, typed,
    //      in the frozen vocabulary and compared UNCONDITIONALLY with the
    //      parsed final disposition. A missing disposition never disables the
    //      comparison.
    if (receipt) {
      for (const defect of machineTerminalDefects(receipt)) {
        failures.push(
          fail(AGGREGATE_FAILURE.MACHINE_TERMINAL_INVALID, `${label} ${defect}`),
        );
      }
      // The machine disposition is compared UNCONDITIONALLY with the parsed
      // final disposition.
      const dispositionMismatch = machineDispositionMismatch(receipt, disposition);
      if (dispositionMismatch) {
        failures.push(
          fail(AGGREGATE_FAILURE.QUALITY_DISPOSITION_MISMATCH, `${label} ${dispositionMismatch}`),
        );
      }
      // The task-namespace RECEIPT is PARSED and bound to the machine
      // receipt, the current run and the registry row. The presence of the
      // file is not proof.
      for (const defect of taskNamespaceReceiptDefects(row.namespaceReceipt ?? null, {
        taskNamespace: receipt.taskNamespace,
        runId,
        order: row.order,
        bvid: row.bvid,
      })) {
        failures.push(
          fail(AGGREGATE_FAILURE.NAMESPACE_RECEIPT_INVALID, `${label} ${defect}`),
        );
      }
    }

    // 5. The audits must be clean.
    const audits = row.audits || {};
    if ((audits.secretHitCount ?? 0) !== 0) {
      failures.push(fail(AGGREGATE_FAILURE.AUDIT_FAILED, `${label} has secret hits`));
    }
    if ((audits.audioOutputCount ?? 0) !== 0) {
      failures.push(fail(AGGREGATE_FAILURE.AUDIT_FAILED, `${label} produced audio output`));
    }
    if ((audits.tabCaptureCount ?? 0) !== 0) {
      failures.push(fail(AGGREGATE_FAILURE.AUDIT_FAILED, `${label} used tabCapture`));
    }
    // The visible batch focuses its OWN owned window once per source. A focus
    // OUTSIDE the owned window is the failure.
    if (audits.focusTargetOwned === false) {
      failures.push(fail(AGGREGATE_FAILURE.AUDIT_FAILED, `${label} focused a foreign window`));
    }
    if ((audits.ownedProcessLeakCount ?? 0) !== 0) {
      failures.push(fail(AGGREGATE_FAILURE.AUDIT_FAILED, `${label} leaked an owned process`));
    }
    if (audits.cleanupComplete === false) {
      failures.push(fail(AGGREGATE_FAILURE.AUDIT_FAILED, `${label} did not clean its resources`));
    }
    if (index >= FROZEN_SIX.length) {
      failures.push(fail(AGGREGATE_FAILURE.IDENTITY_MISMATCH, `${label} is beyond the denominator`));
    }
  });

  // 6. The CANDIDATE LEDGER TOTALS must equal the sum of the per-source
  //    attempted facts (CI2).
  //
  // The ledger is the durable record of what the run DID; the per-source
  // receipts are what the sources REPORT. A difference means that one of
  // them is incomplete, duplicated or forged: the candidate may never be
  // positive.
  if (!candidateLedgerTotals || typeof candidateLedgerTotals !== "object") {
    failures.push(
      fail(AGGREGATE_FAILURE.LEDGER_ACCOUNTING, "the candidate ledger totals are missing"),
    );
  } else {
    const sumAttemptCount = attemptedFactsByRow.reduce(
      (total, facts) => total + (Number(facts.attemptCount) || 0),
      0,
    );
    const sumRequestCount = attemptedFactsByRow.reduce(
      (total, facts) => total + (Number(facts.requestCount) || 0),
      0,
    );
    const ledgerSynthesize = Number(candidateLedgerTotals.runtimeSynthesize) || 0;
    const ledgerProviderCalls = Number(candidateLedgerTotals.providerCall) || 0;
    if (ledgerSynthesize !== sumAttemptCount) {
      failures.push(
        fail(
          AGGREGATE_FAILURE.LEDGER_ACCOUNTING,
          `the candidate ledger records ${ledgerSynthesize} synthesis invocation(s) but the sources report ${sumAttemptCount}`,
        ),
      );
    }
    if (ledgerProviderCalls !== sumRequestCount) {
      failures.push(
        fail(
          AGGREGATE_FAILURE.LEDGER_ACCOUNTING,
          `the candidate ledger records ${ledgerProviderCalls} outbound Provider attempt(s) but the sources report ${sumRequestCount}`,
        ),
      );
    }
  }

  // 7. The attempt set must be the whole denominator, unless an explicit
  //    fail-closed stop receipt identifies the condition.
  if (counts.total !== AGGREGATE_POSITIVE.requiredSources) {
    if (!stopReceipt || stopReceipt.failClosed !== true) {
      failures.push(
        fail(
          AGGREGATE_FAILURE.INCOMPLETE_ATTEMPT_SET,
          `the batch carries ${counts.total}/${AGGREGATE_POSITIVE.requiredSources} source rows`,
        ),
      );
    }
  }

  // 8. The positive thresholds.
  if (counts.blocked > AGGREGATE_POSITIVE.blockedMaximum) {
    failures.push(
      fail(AGGREGATE_FAILURE.TOO_MANY_BLOCKED, `${counts.blocked} sources are blocked`),
    );
  }
  if (counts.limited > AGGREGATE_POSITIVE.limitedMaximum) {
    failures.push(fail(AGGREGATE_FAILURE.LIMITED_SOURCE, `${counts.limited} sources are limited`));
  }
  if (counts.failed > AGGREGATE_POSITIVE.failedMaximum) {
    failures.push(fail(AGGREGATE_FAILURE.FAILED_SOURCE, `${counts.failed} sources are failed`));
  }
  if (counts.complete < AGGREGATE_POSITIVE.completeMinimum) {
    failures.push(
      fail(
        AGGREGATE_FAILURE.FAILED_SOURCE,
        `only ${counts.complete} sources are complete (at least ${AGGREGATE_POSITIVE.completeMinimum} are required)`,
      ),
    );
  }

  return {
    positive: failures.length === 0,
    counts,
    failures,
    threshold: AGGREGATE_POSITIVE,
  };
}
