// GC-B6F — the runner boundary of the candidate value-domain diagnostic.
//
// The stable failure code `V3510B_PROVIDER_RESPONSE_INVALID` crosses the
// runner boundary with the NEW value-domain facts: the failing subdomain of
// a value-domain violation must be retrievable from the machine receipt, and
// ONLY as allowlisted structural facts.
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
 */
function driveRunnerWithDiagnostic(diagnostic) {
  const evidenceRoot = makeTempRoot("navia-b6f-diagnostic-");
  const stageRoot = makeTempRoot("navia-b6f-stage-");
  const diagnosticFile = path.join(evidenceRoot, "stage-b-diagnostic.json");
  fs.writeFileSync(diagnosticFile, `${JSON.stringify(diagnostic, null, 2)}\n`, { mode: 0o600 });
  const consumed = consumeAuthorization({
    stageRoot,
    authorizationId: "b6f-offline-diagnostic",
    runId: "gc-b6f-offline",
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
      "--run-id=gc-b6f-offline",
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

/** The product's redacted diagnostic of a brief value-domain violation. */
function valueDomainDiagnostic() {
  return {
    schemaVersion: "v3-media-grounded-chapter-diagnostic/v1",
    stage: "provider_attempt",
    failureCode: "V3510B_PROVIDER_RESPONSE_INVALID",
    candidateShape: {
      candidateType: "object",
      topLevel: { present: ["brief", "claims", "chapters", "unresolvedEvidenceConflict"], presentCount: 4, missingCount: 0, unknownCount: 0 },
      brief: {
        present: ["evidenceIds", "text"],
        presentCount: 2,
        missingCount: 0,
        unknownCount: 0,
        valueDomain: {
          textType: "string",
          textLengthBucket: "too_short",
          evidenceIdsContainer: "list",
          evidenceIdsItemCount: 1,
          evidenceIdsEmptyItemCount: 0,
          evidenceIdsNonStringItemCount: 0,
          unknownEvidenceReferenceCount: 0,
        },
      },
      claims: {
        count: 5,
        itemShapeClasses: ["exact", "exact", "exact", "exact", "exact"],
        valueDomain: {
          itemCount: 5,
          textInvalidItemCount: 0,
          evidenceIdsInvalidItemCount: 0,
          unknownEvidenceReferenceCount: 0,
          textTypeClasses: ["string"],
          textLengthBucketClasses: ["in_range"],
          evidenceIdsContainerClasses: ["list"],
        },
      },
      chapters: {
        containerType: "list",
        count: 6,
        fieldSetClasses: ["exact", "exact", "exact", "exact", "exact", "exact"],
        invalidChapterIndexes: [],
        invalidRelationCount: 0,
        valueDomain: {
          itemCount: 6,
          chapterNameInvalidItemCount: 0,
          chapterStatementInvalidItemCount: 0,
          evidenceIdsInvalidItemCount: 0,
          unknownEvidenceReferenceCount: 1,
          chapterNameLengthBucketClasses: ["in_range"],
          chapterStatementLengthBucketClasses: ["in_range"],
          evidenceIdsContainerClasses: ["list"],
        },
      },
      conflictFlagType: "boolean",
      shapeViolation: "brief_value_domain",
    },
    evidenceCapacity: {
      evidenceCount: 96,
      distinctStartCount: 84,
      duplicateStartGroupCount: 12,
      maximumDuplicateStartMultiplicity: 3,
      firstStartMs: 0,
      lastStartMs: 3600000,
      hasTwoStrictlyIncreasingAnchors: true,
    },
    anchors: {
      chapterAnchorCount: 6,
      duplicateAnchorCount: 0,
      nonIncreasingAnchorCount: 0,
      unknownEvidenceReference: true,
      firstChapterIncludesBoundaryEvidence: true,
      lastChapterIncludesBoundaryEvidence: false,
    },
    chapterBalance: {
      chapterCount: 6,
      startConcentration: 1.0,
      maximumChapterSpanRatio: 0.998914,
      substantiveRegionCount: 3,
      violationClass: "chapter_start_concentration",
      violationCode: "V3510B_CHAPTER_IMBALANCE",
    },
    repair: { repairAttemptCount: 6, finalOutcome: "fail_closed" },
    providerOutboundHttpAttempts: 8,
    // FORBIDDEN values: the sanitizer must drop them.
    leaked: "这是绝不能进入证据的章节原文 /home/administrator/secret",
    providerIdentity: "minimax-cn-openai-vision",
    evidenceIds: ["mtr_" + "a".repeat(32)],
    requestBody: "{\"prompt\":\"绝不能进入证据的请求\"}",
    responseBody: "{\"choices\":[{\"message\":{\"content\":\"绝不能进入证据的响应\"}}]}",
  };
}

test("B6F runner: the value-domain diagnostic survives the sanitization", () => {
  const { completed, receipt } = driveRunnerWithDiagnostic(valueDomainDiagnostic());
  assert.notEqual(completed.status, 0, "the injected failure must exit nonzero");
  const diagnostic = receipt.chapterDiagnostic;
  assert.ok(diagnostic, "the diagnostic must survive the failed finalization");
  assert.equal(diagnostic.stage, "provider_attempt");
  assert.equal(diagnostic.failureCode, "V3510B_PROVIDER_RESPONSE_INVALID");
  const shape = diagnostic.candidateShape;
  assert.equal(shape.shapeViolation, "brief_value_domain");
  // The BRIEF subdomain facts cross the boundary.
  const brief = shape.brief.valueDomain;
  assert.equal(brief.textType, "string");
  assert.equal(brief.textLengthBucket, "too_short");
  assert.equal(brief.evidenceIdsContainer, "list");
  assert.equal(brief.evidenceIdsItemCount, 1);
  assert.equal(brief.evidenceIdsEmptyItemCount, 0);
  assert.equal(brief.evidenceIdsNonStringItemCount, 0);
  assert.equal(brief.unknownEvidenceReferenceCount, 0);
  // The CLAIM and CHAPTER subdomain facts cross the boundary.
  assert.equal(shape.claims.valueDomain.textInvalidItemCount, 0);
  assert.equal(shape.chapters.valueDomain.chapterNameInvalidItemCount, 0);
  assert.equal(shape.chapters.valueDomain.chapterStatementInvalidItemCount, 0);
  assert.equal(shape.chapters.valueDomain.unknownEvidenceReferenceCount, 1);
  // The balance facts and the attempt count cross the boundary.
  assert.equal(diagnostic.chapterBalance.violationCode, "V3510B_CHAPTER_IMBALANCE");
  assert.equal(diagnostic.providerOutboundHttpAttempts, 8);
});

test("B6F runner: an empty evidence-id list class survives the allowlist", () => {
  const input = valueDomainDiagnostic();
  input.candidateShape.brief.valueDomain.evidenceIdsContainer = "empty_list";
  input.candidateShape.claims.valueDomain.evidenceIdsContainerClasses = ["empty_list", "list"];
  const { completed, receipt } = driveRunnerWithDiagnostic(input);
  assert.notEqual(completed.status, 0);
  const shape = receipt.chapterDiagnostic.candidateShape;
  assert.equal(shape.brief.valueDomain.evidenceIdsContainer, "empty_list");
  assert.deepEqual(shape.claims.valueDomain.evidenceIdsContainerClasses, ["empty_list", "list"]);
});

test("B6F runner: the sanitized diagnostic carries NO content, NO ids and NO Provider identity", () => {
  const { completed, receipt } = driveRunnerWithDiagnostic(valueDomainDiagnostic());
  assert.notEqual(completed.status, 0);
  const serialized = JSON.stringify(receipt);
  for (const forbidden of [
    "绝不能进入证据",
    "/home/administrator",
    "leaked",
    "providerIdentity",
    "requestBody",
    "responseBody",
    "mtr_",
  ]) {
    assert.ok(!serialized.includes(forbidden), `the receipt must not carry ${forbidden}`);
  }
  // The DIAGNOSTIC carries no Provider identity. The machine receipt's own
  // selected-Provider fields are the frozen B-5 contract and stay.
  const diagnostic = JSON.stringify(receipt.chapterDiagnostic);
  assert.ok(!diagnostic.includes("minimax"), "the diagnostic must not carry the Provider identity");
  // The public receipt of the source still carries only the frozen keys.
  assert.equal(receipt.provider.published, null);
  assert.equal(receipt.disposition, "failed");
});
