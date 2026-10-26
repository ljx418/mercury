// SB1 — the EXPLICIT machine-receipt identity validator.
//
// Every field of the identity is REQUIRED, TYPED and COMPARED. There is no
// truthy conditional comparison: absence, null, a wrong type, a malformed
// value and a mismatch are all defects.
//
// No Chrome, no Runtime, no Provider, no Cookie, no media.

import test from "node:test";
import assert from "node:assert/strict";

import {
  FROZEN_SOURCE_ADAPTER,
  FROZEN_SOURCE_PORTAL,
  MACHINE_IDENTITY_FIELDS,
  MACHINE_TERMINAL_FIELDS,
  isFiniteUtcInstant,
  machineAttemptIdentityDefects,
  machineDispositionMismatch,
  machineIdentityDefects,
  machineTerminalDefects,
  parseSourceIdentity,
  taskNamespaceReceiptDefects,
} from "../lib/machine_identity.mjs";

const RUN_ID = "sb1-run";
const REGISTRY_SHA256 = "9c2da2f4c4c16fc94e1e0d7dfc9362ab1177d2db53f63d4af5a81a44795c9454";
const BVID = "BV11t8w6oEtP";
const EXPECTED = { runId: RUN_ID, registrySha256: REGISTRY_SHA256, order: 1, bvid: BVID };

function identityReceipt(overrides = {}) {
  return {
    runId: RUN_ID,
    registrySha256: REGISTRY_SHA256,
    order: 1,
    bvid: BVID,
    taskId: `media_task_${"a".repeat(32)}`,
    taskNamespace: `media_task_${"a".repeat(32)}`,
    taskRevision: 7,
    sourceIdentity: `portal:bilibili:${BVID}:41828944992:p1`,
    dependencyGeneration: `depgen_${"b".repeat(64)}`,
    startedAtUtc: "2026-10-24T00:00:00.000Z",
    finishedAtUtc: "2026-10-24T00:00:09.000Z",
    ...overrides,
  };
}

test("SB1: a complete identity has no defect", () => {
  assert.deepEqual(machineIdentityDefects(identityReceipt(), EXPECTED), []);
});

test("SB1: every identity field is required", () => {
  assert.deepEqual([...MACHINE_IDENTITY_FIELDS].sort(), [
    "bvid", "dependencyGeneration", "finishedAtUtc", "order", "registrySha256",
    "runId", "sourceIdentity", "startedAtUtc", "taskId", "taskNamespace",
    "taskRevision",
  ]);
  for (const field of MACHINE_IDENTITY_FIELDS) {
    const receipt = identityReceipt();
    delete receipt[field];
    const defects = machineIdentityDefects(receipt, EXPECTED);
    assert.ok(defects.length > 0, `a receipt without ${field} must be a defect`);
    // A missing field is never silently accepted.
    assert.ok(
      defects.some((defect) => defect.includes(field === "order" ? "order" : field)),
      `the defect of a missing ${field} must name it: ${JSON.stringify(defects)}`,
    );
  }
});

test("SB1: a null identity field is a defect", () => {
  for (const field of MACHINE_IDENTITY_FIELDS) {
    const receipt = identityReceipt({ [field]: null });
    assert.ok(
      machineIdentityDefects(receipt, EXPECTED).length > 0,
      `a receipt with a null ${field} must be a defect`,
    );
  }
});

test("SB1: a wrong type is a defect", () => {
  const cases = {
    runId: 42,
    registrySha256: "not-a-digest",
    order: "1",
    bvid: "not-a-bvid",
    taskId: "media_task_short",
    taskNamespace: "",
    taskRevision: "7",
    sourceIdentity: "portal:bilibili",
    dependencyGeneration: "depgen_short",
    startedAtUtc: "yesterday",
    finishedAtUtc: 7,
  };
  for (const [field, value] of Object.entries(cases)) {
    const defects = machineIdentityDefects(identityReceipt({ [field]: value }), EXPECTED);
    assert.ok(defects.length > 0, `a receipt with a malformed ${field} must be a defect`);
  }
});

test("SB1: a mismatch with the expected identity is a defect", () => {
  const cases = [
    identityReceipt({ runId: "another-run" }),
    identityReceipt({ registrySha256: "0".repeat(64) }),
    identityReceipt({ order: 2 }),
    identityReceipt({ bvid: "BV1OTHER00001" }),
    identityReceipt({ sourceIdentity: "portal:bilibili:BV1OTHER00001:41828944992:p1" }),
  ];
  for (const receipt of cases) {
    assert.ok(
      machineIdentityDefects(receipt, EXPECTED).length > 0,
      `a mismatched identity must be a defect: ${JSON.stringify(receipt)}`,
    );
  }
});

test("SB1: the source identity is parsed into its frozen components", () => {
  const parsed = parseSourceIdentity(`portal:bilibili:${BVID}:41828944992:p1`);
  assert.deepEqual(parsed, {
    portal: "portal",
    adapter: "bilibili",
    bvid: BVID,
    playbackUnit: "41828944992",
    part: "p1",
  });
  assert.equal(parseSourceIdentity("portal:bilibili"), null);
  assert.equal(parseSourceIdentity(null), null);
  assert.equal(parseSourceIdentity(7), null);
});

test("SB1: the source identity must name the frozen row", () => {
  const foreign = identityReceipt({ sourceIdentity: "portal:bilibili:BV1OTHER00001:41828944992:p1" });
  const defects = machineIdentityDefects(foreign, EXPECTED);
  assert.ok(defects.some((defect) => defect.includes("BV1OTHER00001")), JSON.stringify(defects));
});

test("SB1: a receipt that finishes before it starts is a defect", () => {
  const receipt = identityReceipt({
    startedAtUtc: "2026-10-24T00:00:09.000Z",
    finishedAtUtc: "2026-10-24T00:00:00.000Z",
  });
  assert.ok(machineIdentityDefects(receipt, EXPECTED).length > 0);
});

test("SB1: a missing receipt is a defect", () => {
  assert.ok(machineIdentityDefects(null, EXPECTED).length > 0);
  assert.ok(machineIdentityDefects("not-a-receipt", EXPECTED).length > 0);
});


// ---------------------------------------------------------------------------
// AC1 — the identity fields are bound to the FROZEN authority.
// ---------------------------------------------------------------------------

test("AC1: the source portal and adapter are the FROZEN authority", () => {
  assert.equal(FROZEN_SOURCE_PORTAL, "portal");
  assert.equal(FROZEN_SOURCE_ADAPTER, "bilibili");
  const foreign = identityReceipt({ sourceIdentity: `portal:attacker:${BVID}:41828944992:p1` });
  const defects = machineIdentityDefects(foreign, EXPECTED);
  assert.ok(
    defects.some((defect) => defect.includes("adapter attacker")),
    JSON.stringify(defects),
  );
  const foreignPortal = identityReceipt({ sourceIdentity: `other:bilibili:${BVID}:41828944992:p1` });
  assert.ok(
    machineIdentityDefects(foreignPortal, EXPECTED).some((defect) => defect.includes("portal")),
  );
});

test("AC1: the playback unit and the part must be present", () => {
  const empty = identityReceipt({ sourceIdentity: `portal:bilibili:${BVID}::p1` });
  assert.ok(machineIdentityDefects(empty, EXPECTED).length > 0);
  assert.equal(parseSourceIdentity(`portal:bilibili:${BVID}::p1`), null);
});

test("AC1: the task namespace must satisfy the FROZEN shape", () => {
  const malformed = identityReceipt({ taskNamespace: "arbitrary-nonempty" });
  const defects = machineIdentityDefects(malformed, EXPECTED);
  assert.ok(
    defects.some((defect) => defect.includes("taskNamespace")),
    JSON.stringify(defects),
  );
});

test("AC1: the timestamps must be FINITE, REAL UTC instants", () => {
  assert.equal(isFiniteUtcInstant("2026-10-24T00:00:00.000Z"), true);
  assert.equal(isFiniteUtcInstant("2026-10-24T00:00:00Z"), true);
  // The format matches, but the calendar does not exist.
  assert.equal(isFiniteUtcInstant("2026-99-99T99:99:99Z"), false);
  assert.equal(isFiniteUtcInstant("2026-13-01T00:00:00Z"), false);
  // An impossible day is silently rolled over by the date parser.
  assert.equal(isFiniteUtcInstant("2026-02-30T00:00:00Z"), false);
  // An impossible time of day.
  assert.equal(isFiniteUtcInstant("2026-10-24T24:00:00Z"), false);
  assert.equal(isFiniteUtcInstant("2026-10-24T00:60:00Z"), false);
  const defects = machineIdentityDefects(
    identityReceipt({ startedAtUtc: "2026-99-99T99:99:99Z", finishedAtUtc: "2026-99-99T99:99:99Z" }),
    EXPECTED,
  );
  assert.ok(defects.some((defect) => defect.includes("startedAtUtc")), JSON.stringify(defects));
});

test("AC1: a reversed window is a defect", () => {
  const receipt = identityReceipt({
    startedAtUtc: "2026-10-24T00:00:09.000Z",
    finishedAtUtc: "2026-10-24T00:00:00.000Z",
  });
  assert.ok(
    machineIdentityDefects(receipt, EXPECTED).some((defect) => defect.includes("finishes before")),
  );
});

test("AC1: the task namespace RECEIPT is parsed and bound", () => {
  const namespace = `media_task_${"a".repeat(32)}`;
  const valid = {
    taskIdNamespace: namespace,
    bvid: BVID,
    order: 1,
    runId: RUN_ID,
  };
  assert.deepEqual(
    taskNamespaceReceiptDefects(valid, { taskNamespace: namespace, runId: RUN_ID, order: 1, bvid: BVID }),
    [],
  );
  // A missing field.
  const missing = { ...valid };
  delete missing.runId;
  assert.ok(taskNamespaceReceiptDefects(missing, {}).length > 0);
  // An extra field.
  const extra = { ...valid, extraField: 1 };
  assert.ok(taskNamespaceReceiptDefects(extra, {}).some((defect) => defect.includes("additional field")));
  // A cross-row namespace.
  assert.ok(
    taskNamespaceReceiptDefects(valid, { taskNamespace: `media_task_${"7".repeat(32)}` })
      .some((defect) => defect.includes("another task namespace")),
  );
  // A cross-row run id.
  assert.ok(
    taskNamespaceReceiptDefects(valid, { runId: "another-run" })
      .some((defect) => defect.includes("another-run")),
  );
  // A malformed namespace.
  assert.ok(
    taskNamespaceReceiptDefects({ ...valid, taskIdNamespace: "arbitrary" }, {})
      .some((defect) => defect.includes("taskIdNamespace")),
  );
  // A missing receipt.
  assert.ok(taskNamespaceReceiptDefects(null, {}).length > 0);
});

// ---------------------------------------------------------------------------
// AC2 — the machine terminal shape.
// ---------------------------------------------------------------------------

test("AC2: the disposition is a REQUIRED, typed terminal field", () => {
  assert.deepEqual([...MACHINE_TERMINAL_FIELDS], ["disposition"]);
  const valid = identityReceipt({ disposition: "complete" });
  assert.deepEqual(machineTerminalDefects(valid), []);
  // Missing.
  const missing = identityReceipt();
  delete missing.disposition;
  assert.ok(machineTerminalDefects(missing).length > 0);
  // Null.
  assert.ok(machineTerminalDefects(identityReceipt({ disposition: null })).length > 0);
  // A wrong type.
  assert.ok(machineTerminalDefects(identityReceipt({ disposition: 7 })).length > 0);
  // An unknown value.
  assert.ok(
    machineTerminalDefects(identityReceipt({ disposition: "not-a-frozen-disposition" })).length > 0,
  );
});

test("AC2: the machine disposition is compared with the parsed final disposition", () => {
  const receipt = identityReceipt({ disposition: "complete" });
  assert.equal(machineDispositionMismatch(receipt, "complete"), null);
  assert.ok(machineDispositionMismatch(receipt, "limited"));
  // A MISSING disposition never disables the comparison: the shape defect is
  // reported instead.
  const missing = identityReceipt();
  delete missing.disposition;
  assert.equal(machineDispositionMismatch(missing, "complete"), null);
  assert.ok(machineTerminalDefects(missing).length > 0);
});

test("BP1: blocked attempts retain common authority without fabricating a task", () => {
  const preTask = identityReceipt({
    taskId: null,
    taskRevision: null,
    sourceIdentity: null,
    dependencyGeneration: null,
  });
  assert.deepEqual(machineAttemptIdentityDefects(preTask, EXPECTED), []);

  const foreign = { ...preTask, sourceIdentity: `portal:attacker:${BVID}:unit:part` };
  assert.ok(
    machineAttemptIdentityDefects(foreign, EXPECTED)
      .some((defect) => defect.includes("adapter attacker")),
  );

  const partial = { ...preTask, taskId: `media_task_${"c".repeat(32)}` };
  assert.ok(
    machineAttemptIdentityDefects(partial, EXPECTED)
      .some((defect) => defect.includes("partial product task identity")),
  );
});
