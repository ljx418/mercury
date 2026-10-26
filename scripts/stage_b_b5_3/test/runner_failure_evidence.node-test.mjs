// The runner's failure-path evidence (C2).
//
// The REAL runner is driven with an injected failure at every milestone. The
// offline suite must never launch Chrome, start a Runtime, read a Cookie,
// call a Provider or download media: the fault seam skips every external
// action and fails at the named milestone.
//
// Every case asserts the COMPLETE mandatory audit set and a NONZERO process
// exit.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { consumeAuthorization } from "../lib/authorization.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "../lib/registry.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runnerPath = path.join(repoRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs");

/** The mandatory audit set of EVERY disposition. */
const MANDATORY_FILES = Object.freeze([
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

const FAULT_POINTS = Object.freeze([
  "before_chrome",
  "after_chrome",
  "after_task_creation",
  "provider_rejection",
  "during_cleanup",
]);

/**
 * Issue the parent grant for a child.
 *
 * The SEQUENCER owns the authorization; the offline cases issue the same
 * grant the sequencer would, so the child can be driven directly.
 */
function issueChildGrant({ stageRoot, authorizationId = "offline-corrective" }) {
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId,
    runId: "gc-b5r-offline-corrective",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: FROZEN_SIX,
  });
  const grant = (consumed.grants ?? []).find((item) => item.order === "1") ?? null;
  return { consumed, grant };
}

function driveRunner({ faultPoint, order = "1", bvid = "BV11t8w6oEtP", authorizationId = "offline-corrective" }) {
  const evidenceRoot = makeTempRoot("navia-b5-failure-");
  const stageRoot = makeTempRoot("navia-b5-stage-");
  const { consumed, grant } = issueChildGrant({ stageRoot, authorizationId });
  const completed = spawnSync(
    process.execPath,
    [
      runnerPath,
      `--order=${order}`,
      `--bvid=${bvid}`,
      "--run-id=gc-b5r-offline-corrective",
      `--evidence-root=${evidenceRoot}`,
      ...(grant ? [`--grant-id=${grant.grantId}`, `--authorization-digest=${consumed.digest}`] : []),
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NAVIA_B5_FAULT_POINT: faultPoint,
        NAVIA_B5_STAGE_ROOT: stageRoot,
        // The cookie is never read: the fault seam skips every external action.
        NAVIA_BILIBILI_COOKIE_FILE: path.join(evidenceRoot, "no-cookie-file.txt"),
      },
      timeout: 120_000,
    },
  );
  return { completed, evidenceRoot, stageRoot, consumed, grant };
}

for (const faultPoint of FAULT_POINTS) {
  test(`C2: a failure at ${faultPoint} writes the complete audit set and exits nonzero`, () => {
    const { completed, evidenceRoot } = driveRunner({ faultPoint });
    assert.notEqual(completed.status, 0, `the exit must be nonzero: ${completed.stdout}`);

    const bvidDir = path.join(evidenceRoot, "bvid-1-BV11t8w6oEtP");
    assert.ok(fs.existsSync(bvidDir), "the per-source evidence directory must exist");
    for (const name of MANDATORY_FILES) {
      const file = path.join(bvidDir, name);
      assert.ok(fs.existsSync(file), `the mandatory file ${name} is missing`);
      assert.ok(fs.statSync(file).size > 0, `the mandatory file ${name} is empty`);
    }
    // The final disposition is written and it is not a success.
    const disposition = fs.readFileSync(path.join(bvidDir, "final_disposition.txt"), "utf8");
    assert.match(disposition, /^(failed|blocked|limited)\b/);
  });
}

test("C2: the failure receipt distinguishes the selected, attempted and published Provider facts", () => {
  const { completed, evidenceRoot } = driveRunner({ faultPoint: "provider_rejection" });
  assert.notEqual(completed.status, 0);
  const bvidDir = path.join(evidenceRoot, "bvid-1-BV11t8w6oEtP");
  const receipt = JSON.parse(fs.readFileSync(path.join(bvidDir, "b5-source-receipt.json"), "utf8"));
  assert.equal(receipt.provider.selectedProviderId, "minimax-cn-openai-vision");
  assert.equal(receipt.provider.selectedEndpointClass, "minimax_chat_completions");
  // Nothing was published: the published facts are ABSENT, never a successful
  // value.
  assert.equal(receipt.provider.published, null);
  // The attempt itself is recorded.
  assert.equal(receipt.disposition, "failed");
  assert.ok(receipt.failureCode);
});

test("C2: the failure receipt keeps the upload counters at hard zero", () => {
  const { completed, evidenceRoot } = driveRunner({ faultPoint: "after_task_creation" });
  assert.notEqual(completed.status, 0);
  const bvidDir = path.join(evidenceRoot, "bvid-1-BV11t8w6oEtP");
  const receipt = JSON.parse(fs.readFileSync(path.join(bvidDir, "b5-source-receipt.json"), "utf8"));
  for (const [key, value] of Object.entries(receipt.uploadCounters)) {
    assert.equal(value, 0, `${key} must stay zero`);
  }
  assert.equal(receipt.audioOutputCount, 0);
  assert.equal(receipt.tabCaptureCount, 0);
});

test("C2: the receipt mirror never fills an absent publication with success", () => {
  const { completed, evidenceRoot } = driveRunner({ faultPoint: "after_chrome" });
  assert.notEqual(completed.status, 0);
  const bvidDir = path.join(evidenceRoot, "bvid-1-BV11t8w6oEtP");
  const mirror = JSON.parse(fs.readFileSync(path.join(bvidDir, "receipt.json"), "utf8"));
  assert.equal(mirror.published, false);
  assert.equal(mirror.receipt, null);
  assert.equal(mirror.selectedProviderId, "minimax-cn-openai-vision");
});

test("C2: a directly invoked child without a valid parent grant is refused", () => {
  const stageRoot = makeTempRoot("navia-b5-stage-");
  const evidenceRoot = makeTempRoot("navia-b5-failure-");
  const completed = spawnSync(
    process.execPath,
    [runnerPath, "--order=1", "--bvid=BV11t8w6oEtP", "--run-id=direct",
      `--evidence-root=${evidenceRoot}`],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NAVIA_B5_STAGE_ROOT: stageRoot,
        NAVIA_BILIBILI_COOKIE_FILE: path.join(evidenceRoot, "no-cookie-file.txt"),
      },
      timeout: 120_000,
    },
  );
  assert.notEqual(completed.status, 0, "a child without a grant must be refused");
  assert.match(completed.stdout + completed.stderr, /child_grant_missing/);
  // The refusal still writes the audit set.
  const bvidDir = path.join(evidenceRoot, "bvid-1-BV11t8w6oEtP");
  for (const name of MANDATORY_FILES) {
    assert.ok(fs.existsSync(path.join(bvidDir, name)), `the mandatory file ${name} is missing`);
  }
});

test("C3: the redacted chapter diagnostic survives the failed finalization", () => {
  const stageRoot = makeTempRoot("navia-b5-stage-");
  const evidenceRoot = makeTempRoot("navia-b5-failure-");
  const diagnosticFile = path.join(evidenceRoot, "chapter-diagnostic.json");
  fs.writeFileSync(
    diagnosticFile,
    JSON.stringify({
      schemaVersion: "v3-media-grounded-chapter-diagnostic/v1",
      stage: "validator_initial",
      failureCode: "V3510B_CHAPTER_TIME_INVALID",
      candidateShape: {
        candidateType: "object",
        chapters: { containerType: "list", count: 3, invalidChapterIndexes: [1] },
        shapeViolation: "chapter_field_set",
      },
      evidenceCapacity: {
        evidenceCount: 12,
        distinctStartCount: 7,
        duplicateStartGroupCount: 2,
        maximumDuplicateStartMultiplicity: 2,
        firstStartMs: 0,
        lastStartMs: 90000,
        hasTwoStrictlyIncreasingAnchors: true,
      },
      // A FORBIDDEN value: the sanitizer must drop it.
      leaked: "这是绝不能进入证据的字幕原文 /home/administrator/secret",
    }),
    { mode: 0o600 },
  );
  const completed = spawnSync(
    process.execPath,
    [
      runnerPath,
      "--order=1",
      "--bvid=BV11t8w6oEtP",
      "--run-id=gc-b5r-offline-corrective",
      `--evidence-root=${evidenceRoot}`,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NAVIA_B5_FAULT_POINT: "provider_rejection",
        NAVIA_B5_STAGE_ROOT: stageRoot,
        NAVIA_B5_AUTHORIZATION_ID: "offline-corrective-diagnostic",
        NAVIA_B5_DIAGNOSTIC_FILE: diagnosticFile,
        NAVIA_BILIBILI_COOKIE_FILE: path.join(evidenceRoot, "no-cookie-file.txt"),
      },
      timeout: 120_000,
    },
  );
  assert.notEqual(completed.status, 0);
  const bvidDir = path.join(evidenceRoot, "bvid-1-BV11t8w6oEtP");
  const receipt = JSON.parse(fs.readFileSync(path.join(bvidDir, "b5-source-receipt.json"), "utf8"));
  assert.ok(receipt.chapterDiagnostic, "the diagnostic must survive the failed finalization");
  assert.equal(receipt.chapterDiagnostic.stage, "validator_initial");
  assert.equal(receipt.chapterDiagnostic.failureCode, "V3510B_CHAPTER_TIME_INVALID");
  assert.equal(receipt.chapterDiagnostic.evidenceCapacity.distinctStartCount, 7);
  // The FORBIDDEN value never enters the evidence.
  const serialized = JSON.stringify(receipt);
  assert.ok(!serialized.includes("绝不能进入证据"));
  assert.ok(!serialized.includes("/home/administrator"));
  assert.ok(!serialized.includes("leaked"));
});

test("C2: the offline failure run performs NO external action", () => {
  const { completed, evidenceRoot, stageRoot } = driveRunner({ faultPoint: "before_chrome" });
  assert.notEqual(completed.status, 0);
  // The ledger recorded the attempt and NOTHING else.
  const ledger = fs.readFileSync(path.join(stageRoot, "stage-actions.jsonl"), "utf8")
    .trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const events = ledger.map((entry) => entry.event);
  assert.ok(events.includes("sourceAttempt"));
  assert.ok(!events.includes("chromeLaunch"), "no Chrome may be launched offline");
  assert.ok(!events.includes("runtimeStart"), "no Runtime may start offline");
  assert.ok(!events.includes("cookieInjection"), "no Cookie may be injected offline");
  assert.ok(!events.includes("providerCall"), "no Provider may be called offline");
  assert.ok(!events.includes("download"), "nothing may be downloaded offline");
  // The audit set still exists.
  assert.ok(fs.existsSync(path.join(evidenceRoot, "bvid-1-BV11t8w6oEtP", "cleanup.json")));
});
