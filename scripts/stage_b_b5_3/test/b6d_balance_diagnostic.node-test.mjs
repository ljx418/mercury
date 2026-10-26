// GC-B6D — the runner boundary of the chapter-balance diagnostic.
//
// The stable failure code `V3510B_CHAPTER_IMBALANCE` crosses the runner
// boundary: the PRODUCT writes the INTERNAL redacted diagnostic and the
// RUNNER must be able to retrieve it, without any content, without a public
// endpoint and without a second owner path.
//
// The REAL runner is driven with the fault seam: the offline case never
// launches Chrome, starts a Runtime, reads a Cookie, calls a Provider or
// downloads media.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { consumeAuthorization } from "../lib/authorization.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "../lib/registry.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runnerPath = path.join(repoRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs");

/**
 * Drive the REAL runner with the fault seam and an INTERNAL diagnostic.
 *
 * The diagnostic is the product's redacted record: it carries the balance
 * FACTS and it never carries a title, a thesis, a claim text, an evidence
 * id, a Provider identity, a path, a prompt, a response, a secret or raw
 * media.
 */
function driveRunnerWithDiagnostic(diagnostic) {
  const evidenceRoot = makeTempRoot("navia-b6d-diagnostic-");
  const stageRoot = makeTempRoot("navia-b6d-stage-");
  const diagnosticFile = path.join(evidenceRoot, "stage-b-diagnostic.json");
  fs.writeFileSync(diagnosticFile, `${JSON.stringify(diagnostic, null, 2)}\n`, { mode: 0o600 });
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "b6d-offline-diagnostic",
    runId: "gc-b6d-offline",
    registrySha256: ACTIVE_REGISTRY_SHA256,
    identities: FROZEN_SIX,
  });
  const grant = consumed.grants.find((item) => item.order === "1") ?? null;
  const completed = spawnSync(
    process.execPath,
    [
      runnerPath,
      "--order=1",
      "--bvid=BV11t8w6oEtP",
      "--run-id=gc-b6d-offline",
      `--evidence-root=${evidenceRoot}`,
      `--grant-id=${grant.grantId}`,
      `--authorization-digest=${consumed.digest}`,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NAVIA_B5_FAULT_POINT: "provider_rejection",
        NAVIA_B5_STAGE_ROOT: stageRoot,
        NAVIA_B5_DIAGNOSTIC_FILE: diagnosticFile,
        // The cookie is never read: the fault seam skips every external action.
        NAVIA_BILIBILI_COOKIE_FILE: path.join(evidenceRoot, "no-cookie-file.txt"),
      },
      timeout: 120_000,
    },
  );
  const bvidDir = path.join(evidenceRoot, "bvid-1-BV11t8w6oEtP");
  const receipt = JSON.parse(fs.readFileSync(path.join(bvidDir, "b5-source-receipt.json"), "utf8"));
  return { completed, receipt, evidenceRoot, stageRoot };
}

/** The product's redacted diagnostic of a persistent chapter imbalance. */
function balanceDiagnostic() {
  return {
    schemaVersion: "v3-media-grounded-chapter-diagnostic-set/v1",
    taskId: "media_task_" + "2".repeat(32),
    stages: [
      {
        schemaVersion: "v3-media-grounded-chapter-diagnostic/v1",
        stage: "provider_bounded_repair",
        failureCode: "V3510B_CHAPTER_IMBALANCE",
        candidateShape: {
          candidateType: "object",
          topLevel: { present: ["brief", "claims", "chapters", "unresolvedEvidenceConflict"], presentCount: 4, missingCount: 0, unknownCount: 0 },
          brief: { present: ["evidenceIds", "text"], presentCount: 2, missingCount: 0, unknownCount: 0 },
          claims: { count: 5, itemShapeClasses: ["exact", "exact", "exact", "exact", "exact"] },
          chapters: { containerType: "list", count: 6, fieldSetClasses: ["exact", "exact", "exact", "exact", "exact", "exact"], invalidChapterIndexes: [], invalidRelationCount: 0 },
          conflictFlagType: "boolean",
          shapeViolation: "none",
        },
        evidenceCapacity: {
          evidenceCount: 96,
          distinctStartCount: 84,
          duplicateStartGroupCount: 12,
          maximumDuplicateStartMultiplicity: 3,
          firstStartMs: 0,
          lastStartMs: 3_600_000,
          hasTwoStrictlyIncreasingAnchors: true,
        },
        anchors: {
          chapterAnchorCount: 6,
          duplicateAnchorCount: 0,
          nonIncreasingAnchorCount: 0,
          unknownEvidenceReference: false,
          firstChapterIncludesBoundaryEvidence: true,
          lastChapterIncludesBoundaryEvidence: true,
        },
        chapterBalance: {
          chapterCount: 6,
          startConcentration: 0.833333,
          maximumChapterSpanRatio: 0.998914,
          substantiveRegionCount: 3,
          violationClass: "chapter_start_concentration",
          violationCode: "V3510B_CHAPTER_IMBALANCE",
        },
        repair: { repairAttemptCount: 6, finalOutcome: "fail_closed" },
        providerOutboundHttpAttempts: 8,
        // FORBIDDEN values: the sanitizer must drop them.
        leaked: "这是绝不能进入证据的章节原文 /home/administrator/secret",
        token: "secret",
        title: "private_title",
        providerIdentity: "minimax-cn-openai-vision",
        evidenceIds: ["mtr_" + "a".repeat(32)],
      },
    ],
  };
}

test("B6D runner: the balance diagnostic survives into the machine receipt", () => {
  const { completed, receipt } = driveRunnerWithDiagnostic(balanceDiagnostic());
  assert.notEqual(completed.status, 0, "the injected failure must exit nonzero");
  const diagnostic = receipt.chapterDiagnostic;
  assert.ok(diagnostic, "the diagnostic must survive the failed finalization");
  // The product writes a diagnostic SET; the runner retrieves the whole
  // (sanitized) set.
  const stage = diagnostic.stages?.[0] ?? diagnostic;
  assert.equal(stage.stage, "provider_bounded_repair");
  assert.equal(stage.failureCode, "V3510B_CHAPTER_IMBALANCE");
  assert.equal(stage.providerOutboundHttpAttempts, 8);
  // The BALANCE FACTS cross the boundary.
  const balance = stage.chapterBalance;
  assert.ok(balance, "the balance facts must be retrievable");
  assert.equal(balance.chapterCount, 6);
  assert.equal(balance.startConcentration, 0.833333);
  assert.equal(balance.maximumChapterSpanRatio, 0.998914);
  assert.equal(balance.substantiveRegionCount, 3);
  assert.equal(balance.violationClass, "chapter_start_concentration");
  assert.equal(balance.violationCode, "V3510B_CHAPTER_IMBALANCE");
});

test("B6D runner: the balance diagnostic carries NO content, NO id and NO Provider identity", () => {
  const { completed, receipt } = driveRunnerWithDiagnostic(balanceDiagnostic());
  assert.notEqual(completed.status, 0);
  const serialized = JSON.stringify(receipt);
  for (const forbidden of [
    "绝不能进入证据",
    "/home/administrator",
    "leaked",
    '"token":"secret"',
    "private_title",
    "providerIdentity",
    "mtr_",
  ]) {
    assert.ok(!serialized.includes(forbidden), `the receipt must not carry ${forbidden}`);
  }
  // The PUBLIC receipt of the source still carries only the frozen keys.
  assert.equal(receipt.provider.published, null);
  assert.equal(receipt.disposition, "failed");
});
