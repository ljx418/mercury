// SB1 / SB2 — the PURE aggregate negatives.
//
// The Codex review reproduced two false greens by calling the PRODUCTION
// `evaluateAggregate()` with hand-built rows. These cases do the same thing:
// six otherwise valid complete rows with ONE mutated fact must never be a
// positive candidate.
//
// No Chrome, no Runtime, no Provider, no Cookie, no media: the rows are
// plain data and the evaluator is pure.

import test from "node:test";
import assert from "node:assert/strict";

import { evaluateAggregate } from "../lib/aggregate.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "../lib/registry.mjs";
import {
  V21_ARTIFACT_FILENAME,
  canonicalJson,
  sha256Hex,
} from "../lib/v21_artifact.mjs";
import {
  buildV21Artifact,
  frozenReceipt,
  internalPublication,
} from "./_fixtures/contract_shaped_stub.mjs";

const RUN_ID = "pure-aggregate-run";

/** ONE valid complete row. */
function buildRow({
  order,
  bvid,
  artifactValue = null,
  receiptOverrides = {},
  mirrorOverrides = {},
  artifactBytes = null,
} = {}) {
  const taskId = `media_task_${String(order).padStart(32, "0")}`;
  const sourceIdentity = `portal:bilibili:${bvid}:41828944992:p1`;
  const receipt = frozenReceipt({
    requestCount: 3,
    attemptId: `attempt-${String(order).repeat(8).slice(0, 16)}`,
  });
  const artifact = artifactValue ?? buildV21Artifact({
    taskId,
    taskRevision: 1,
    sourceIdentity,
    receipt,
    evidenceIds: ["mtr_" + String(order).padStart(32, "0"), "mtr_" + String(Number(order) + 1).padStart(32, "0")],
    claimIds: ["claim_" + String(order).padStart(16, "0"), "claim_" + String(Number(order) + 1).padStart(16, "0")],
    chapterIds: ["chapter_" + String(order).padStart(16, "0"), "chapter_" + String(Number(order) + 1).padStart(16, "0")],
  });
  const bytes = artifactBytes ?? Buffer.from(canonicalJson(artifact), "utf8");
  const derivativeSha256 = sha256Hex(bytes);
  const machineReceipt = {
    schemaVersion: "v3-5.10-b5-3-source-receipt/v2",
    runId: RUN_ID,
    order,
    bvid,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    taskId,
    taskNamespace: taskId,
    taskRevision: 1,
    sourceIdentity,
    dependencyGeneration: `depgen_${sha256Hex(`${order}:${bvid}`)}`,
    route: "credentialed_media_asr",
    disposition: "complete",
    failureCode: null,
    startedAtUtc: "2026-10-24T00:00:00.000Z",
    finishedAtUtc: "2026-10-24T00:00:09.000Z",
    provider: {
      selectedProviderId: "minimax-cn-openai-vision",
      selectedEndpointClass: "minimax_chat_completions",
      attempted: {
        attemptCount: 1,
        providerId: "minimax-cn-openai-vision",
        endpointClass: "minimax_chat_completions",
        requestCount: 3,
      },
      published: internalPublication(artifact.receipt),
    },
    uploadCounters: {
      rawVideoUploadCount: 0, rawAudioUploadCount: 0, frameByteUploadCount: 0,
      cookieUploadCount: 0, apiKeyDisclosureCount: 0, localPathUploadCount: 0,
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
    derivativeSha256,
    receiptSha256: sha256Hex(canonicalJson(artifact.receipt)),
    evidenceSha256: derivativeSha256,
    cleanup: { runtimeScratchDeleted: true, profileRootDeleted: true, cleanupFailure: null },
    chapterDiagnostic: null,
    ...receiptOverrides,
  };
  const mirror = {
    schemaVersion: "v3-5.10-b5-3-receipt-mirror/v2",
    taskId,
    receipt: artifact.receipt,
    published: true,
    derivativeSha256,
    taskIdNamespace: taskId,
    providerLock: "minimax_chat_completions",
    selectedProviderId: "minimax-cn-openai-vision",
    selectedEndpointClass: "minimax_chat_completions",
    derivedTextScope: ["transcript", "ocr", "vision-caption"],
    ...mirrorOverrides,
  };
  return {
    order,
    bvid,
    disposition: "complete",
    exitCode: 0,
    signal: null,
    evidence: {
      "final_disposition.txt": true,
      "b5-source-receipt.json": true,
      "isolation.json": true,
      "receipt.json": true,
      "provider_lock.txt": true,
      "chrome_launch.log": true,
      "secret_scan.csv": true,
      "cleanup.json": true,
      "task_namespace.json": true,
    },
    receipt: machineReceipt,
    mirror,
    mirrorParseError: null,
    namespaceReceipt: {
      taskIdNamespace: taskId,
      bvid,
      order: Number(order),
      runId: RUN_ID,
    },
    namespaceParseError: null,
    artifact: { filename: V21_ARTIFACT_FILENAME, bytes },
    audits: {
      secretHitCount: 0,
      audioOutputCount: 0,
      tabCaptureCount: 0,
      focusEventCount: 0,
      ownedProcessLeakCount: 0,
      cleanupComplete: true,
    },
  };
}

/** The six valid rows of a positive candidate. */
function buildRows(mutate = () => {}) {
  const rows = FROZEN_SIX.map((entry) => buildRow({
    order: Number(entry.order),
    bvid: entry.bvid,
  }));
  mutate(rows);
  return rows;
}

function evaluate(rows) {
  const runtimeSynthesize = rows.reduce(
    (total, row) => total + (Number(row.receipt?.provider?.attempted?.attemptCount) || 0),
    0,
  );
  const providerCall = rows.reduce(
    (total, row) => total + (Number(row.receipt?.provider?.attempted?.requestCount) || 0),
    0,
  );
  return evaluateAggregate({
    rows,
    runId: RUN_ID,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    stopReceipt: null,
    ledgerIntegrityOk: true,
    candidateLedgerTotals: { runtimeSynthesize, providerCall },
  });
}

function makeBlocked(row) {
  row.disposition = "blocked";
  row.receipt.disposition = "blocked";
  row.receipt.provider.attempted = {
    attemptCount: 0,
    providerId: "minimax-cn-openai-vision",
    endpointClass: "minimax_chat_completions",
    requestCount: null,
  };
  row.receipt.provider.published = null;
  row.receipt.derivativeSha256 = null;
  row.receipt.receiptSha256 = null;
  row.receipt.evidenceSha256 = null;
  row.artifact = null;
  row.mirror = {
    ...row.mirror,
    receipt: null,
    published: false,
    derivativeSha256: null,
  };
  return row;
}

test("SB1: the six valid rows are a positive candidate (the control)", () => {
  const verdict = evaluate(buildRows());
  assert.equal(verdict.positive, true, JSON.stringify(verdict.failures));
  assert.equal(verdict.counts.complete, 6);
});

const IDENTITY_FIELDS = [
  "runId",
  "registrySha256",
  "order",
  "bvid",
  "taskId",
  "taskNamespace",
  "taskRevision",
  "sourceIdentity",
  "dependencyGeneration",
  "startedAtUtc",
  "finishedAtUtc",
];

for (const field of IDENTITY_FIELDS) {
  test(`SB1: a machine receipt without ${field} is not a positive candidate`, () => {
    const rows = buildRows((items) => {
      delete items[0].receipt[field];
    });
    const verdict = evaluate(rows);
    assert.equal(verdict.positive, false, `a receipt without ${field} must not be positive`);
    assert.ok(
      verdict.failures.some((failure) => failure.code === "AGG_MACHINE_IDENTITY_INVALID"),
      JSON.stringify(verdict.failures),
    );
  });
}

test("SB1: a foreign artifact with a removed machine source and revision is not positive", () => {
  const rows = buildRows((items) => {
    const foreign = buildV21Artifact({
      taskId: `media_task_${"9".repeat(32)}`,
      taskRevision: 1,
      sourceIdentity: `portal:bilibili:${items[0].bvid}:41828944992:9`,
      receipt: items[0].receipt.provider.published
        ? frozenReceipt({ requestCount: 3 })
        : frozenReceipt(),
      evidenceIds: ["mtr_" + "1".repeat(32), "mtr_" + "2".repeat(32)],
      claimIds: ["claim_" + "3".repeat(16), "claim_" + "4".repeat(16)],
      chapterIds: ["chapter_" + "5".repeat(16), "chapter_" + "6".repeat(16)],
    });
    const bytes = Buffer.from(canonicalJson(foreign), "utf8");
    items[0].artifact = { filename: V21_ARTIFACT_FILENAME, bytes };
    items[0].receipt.derivativeSha256 = sha256Hex(bytes);
    items[0].receipt.evidenceSha256 = sha256Hex(bytes);
    items[0].mirror.derivativeSha256 = sha256Hex(bytes);
    delete items[0].receipt.sourceIdentity;
    delete items[0].receipt.taskRevision;
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_ARTIFACT_IDENTITY_MISMATCH"),
    JSON.stringify(verdict.failures),
  );
});

test("SB2: a LIMITED artifact claimed complete is not a positive candidate", () => {
  const rows = buildRows((items) => {
    const original = items[0].artifact.bytes.toString("utf8");
    const artifact = JSON.parse(original);
    artifact.quality.status = "limited";
    const bytes = Buffer.from(canonicalJson(artifact), "utf8");
    items[0].artifact = { filename: V21_ARTIFACT_FILENAME, bytes };
    // The hashes are RECOMPUTED: the failure proves the semantic binding and
    // not an incidental hash mismatch.
    items[0].receipt.derivativeSha256 = sha256Hex(bytes);
    items[0].receipt.evidenceSha256 = sha256Hex(bytes);
    items[0].mirror.derivativeSha256 = sha256Hex(bytes);
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_QUALITY_DISPOSITION_MISMATCH"),
    JSON.stringify(verdict.failures),
  );
  // The byte oracle accepted the artifact: only the SEMANTIC binding failed.
  assert.ok(
    !verdict.failures.some((failure) => failure.code.startsWith("AGG_ARTIFACT_")),
    JSON.stringify(verdict.failures),
  );
});

test("SB2: a REJECTED artifact claimed complete is not a positive candidate", () => {
  const rows = buildRows((items) => {
    const artifact = JSON.parse(items[0].artifact.bytes.toString("utf8"));
    artifact.quality.status = "rejected";
    const bytes = Buffer.from(canonicalJson(artifact), "utf8");
    items[0].artifact = { filename: V21_ARTIFACT_FILENAME, bytes };
    items[0].receipt.derivativeSha256 = sha256Hex(bytes);
    items[0].receipt.evidenceSha256 = sha256Hex(bytes);
    items[0].mirror.derivativeSha256 = sha256Hex(bytes);
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_QUALITY_DISPOSITION_MISMATCH"),
    JSON.stringify(verdict.failures),
  );
});

test("SB2: a COMPLETE artifact with quality failure codes is not a positive candidate", () => {
  const rows = buildRows((items) => {
    const artifact = JSON.parse(items[0].artifact.bytes.toString("utf8"));
    artifact.quality.failureCodes = ["V3510B_BRIEF_COVERAGE_INSUFFICIENT"];
    const bytes = Buffer.from(canonicalJson(artifact), "utf8");
    items[0].artifact = { filename: V21_ARTIFACT_FILENAME, bytes };
    items[0].receipt.derivativeSha256 = sha256Hex(bytes);
    items[0].receipt.evidenceSha256 = sha256Hex(bytes);
    items[0].mirror.derivativeSha256 = sha256Hex(bytes);
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_QUALITY_DISPOSITION_MISMATCH"),
    JSON.stringify(verdict.failures),
  );
});

test("SB2: a machine disposition that disagrees with the row is not positive", () => {
  const rows = buildRows((items) => {
    items[0].receipt.disposition = "limited";
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_QUALITY_DISPOSITION_MISMATCH"),
    JSON.stringify(verdict.failures),
  );
});


// ---------------------------------------------------------------------------
// AC1 — the identity fields are bound to the FROZEN authority.
// ---------------------------------------------------------------------------

test("AC1: a FOREIGN ADAPTER is not a positive candidate", () => {
  const rows = buildRows((items) => {
    items[0].receipt.sourceIdentity = `portal:attacker:${items[0].bvid}:41828944992:p1`;
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_MACHINE_IDENTITY_INVALID"),
    JSON.stringify(verdict.failures),
  );
});

test("AC1: a MALFORMED namespace is not a positive candidate", () => {
  const rows = buildRows((items) => {
    items[0].receipt.taskNamespace = "arbitrary-nonempty";
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_MACHINE_IDENTITY_INVALID"),
    JSON.stringify(verdict.failures),
  );
});

test("AC1: a NAMESPACE FILE MISMATCH is not a positive candidate", () => {
  const rows = buildRows((items) => {
    items[0].namespaceReceipt.taskIdNamespace = `media_task_${"7".repeat(32)}`;
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_NAMESPACE_RECEIPT_INVALID"),
    JSON.stringify(verdict.failures),
  );
});

test("AC1: a MALFORMED namespace receipt is not a positive candidate", () => {
  const rows = buildRows((items) => {
    items[0].namespaceReceipt.extraField = "not allowed";
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_NAMESPACE_RECEIPT_INVALID"),
    JSON.stringify(verdict.failures),
  );
});

test("AC1: an ABSENT namespace receipt is not a positive candidate", () => {
  const rows = buildRows((items) => {
    items[0].namespaceReceipt = null;
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_NAMESPACE_RECEIPT_INVALID"),
    JSON.stringify(verdict.failures),
  );
});

test("AC1: an INVALID date/time is not a positive candidate", () => {
  const rows = buildRows((items) => {
    items[0].receipt.startedAtUtc = "2026-99-99T99:99:99Z";
    items[0].receipt.finishedAtUtc = "2026-99-99T99:99:99Z";
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_MACHINE_IDENTITY_INVALID"),
    JSON.stringify(verdict.failures),
  );
});

test("AC1: a REVERSED window is not a positive candidate", () => {
  const rows = buildRows((items) => {
    items[0].receipt.startedAtUtc = "2026-10-24T00:00:09.000Z";
    items[0].receipt.finishedAtUtc = "2026-10-24T00:00:00.000Z";
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_MACHINE_IDENTITY_INVALID"),
    JSON.stringify(verdict.failures),
  );
});

// ---------------------------------------------------------------------------
// AC2 — the machine disposition is mandatory.
// ---------------------------------------------------------------------------

const INVALID_DISPOSITIONS = [
  ["a MISSING disposition", (receipt) => { delete receipt.disposition; }],
  ["a NULL disposition", (receipt) => { receipt.disposition = null; }],
  ["a WRONG-TYPE disposition", (receipt) => { receipt.disposition = 7; }],
  ["an UNKNOWN disposition", (receipt) => { receipt.disposition = "not-a-frozen-disposition"; }],
];

for (const [description, mutate] of INVALID_DISPOSITIONS) {
  test(`AC2: ${description} is not a positive candidate`, () => {
    const rows = buildRows((items) => mutate(items[0].receipt));
    const verdict = evaluate(rows);
    assert.equal(verdict.positive, false);
    assert.ok(
      verdict.failures.some((failure) => failure.code === "AGG_MACHINE_TERMINAL_INVALID"),
      JSON.stringify(verdict.failures),
    );
  });
}

test("AC2: a MISMATCHED machine disposition is not a positive candidate", () => {
  const rows = buildRows((items) => {
    items[0].receipt.disposition = "limited";
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.some((failure) => failure.code === "AGG_QUALITY_DISPOSITION_MISMATCH"),
    JSON.stringify(verdict.failures),
  );
});

test("AC2: the disposition of EVERY source is required, not only of one", () => {
  const rows = buildRows((items) => {
    for (const item of items) delete item.receipt.disposition;
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(
    verdict.failures.filter((failure) => failure.code === "AGG_MACHINE_TERMINAL_INVALID").length === 6,
    JSON.stringify(verdict.failures),
  );
});

// ---------------------------------------------------------------------------
// BP1 — the one allowed blocked row is pre-synthesis and non-publishing.
// ---------------------------------------------------------------------------

test("BP1: one truthful pre-synthesis blocked row remains positive", () => {
  const rows = buildRows((items) => makeBlocked(items[0]));
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, true, JSON.stringify(verdict.failures));
  assert.equal(verdict.counts.blocked, 1);
  assert.equal(verdict.counts.complete, 5);
});

test("BP1: a blocked row with a FOREIGN ADAPTER is not positive", () => {
  const rows = buildRows((items) => {
    makeBlocked(items[0]);
    items[0].receipt.sourceIdentity = `portal:attacker:${items[0].bvid}:41828944992:p1`;
  });
  const verdict = evaluate(rows);
  assert.equal(verdict.positive, false);
  assert.ok(verdict.failures.some((failure) => failure.code === "AGG_MACHINE_IDENTITY_INVALID"));
});

for (const [description, mutate] of [
  ["derivative bytes", (row, original) => { row.artifact = original.artifact; }],
  ["a Provider publication", (row, original) => { row.receipt.provider.published = original.receipt.provider.published; }],
  ["a published mirror", (row, original) => { row.mirror = original.mirror; }],
  ["synthesis activity", (row) => {
    row.receipt.provider.attempted.attemptCount = 1;
    row.receipt.provider.attempted.requestCount = 3;
  }],
]) {
  test(`BP1: a blocked row with ${description} is not positive`, () => {
    const rows = buildRows((items) => {
      const original = structuredClone(items[0]);
      // Buffers are not preserved by structuredClone as Buffers, and only
      // the artifact-presence case needs the original byte wrapper.
      original.artifact = items[0].artifact;
      makeBlocked(items[0]);
      mutate(items[0], original);
    });
    const verdict = evaluate(rows);
    assert.equal(verdict.positive, false);
    assert.ok(
      verdict.failures.some((failure) => failure.code === "AGG_BLOCKED_STATE_INVALID"),
      JSON.stringify(verdict.failures),
    );
  });
}
