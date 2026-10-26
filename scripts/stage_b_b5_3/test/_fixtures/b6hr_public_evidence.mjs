// The synthetic authorities of the GC-B6H-R public-evidence tests.
//
// The fixture is CONTRACT-SHAPED: the private review bundles are built with
// the PRODUCTION encoders, the machine rows carry the exact key sets of the
// production receipt and the lock and the precommit are the ones the
// production owners build.
//
// Nothing here touches the network, the Runtime, the product or a Provider.

import fs from "node:fs";
import path from "node:path";

import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX, RESERVE_SOURCES } from "../../lib/registry.mjs";
import { buildPublicEvidence, validatePublicEvidence } from "../../lib/public_evidence.mjs";
import { buildReviewPrecommit } from "../../lib/review_protocol.mjs";
import { makeTempRoot } from "../../lib/temp_roots.mjs";
import { REVIEW_BUNDLE_MANIFEST, encodeBundleFiles, encodeManifestText } from "../../lib/review_bundle.mjs";
import { buildBundleFixture } from "./b6_bundle_fixture.mjs";

export const RUN_ID = "gc-b6hr-offline";
export const REGISTRY_ORDER = FROZEN_SIX.map((entry) => String(entry.order));

const ZERO_UPLOADS = Object.freeze({
  rawVideoUploadCount: 0, rawAudioUploadCount: 0, frameByteUploadCount: 0,
  cookieUploadCount: 0, apiKeyDisclosureCount: 0, localPathUploadCount: 0,
});

/** The synthetic machine rows of a candidate. */
export function syntheticRows({ dispositions = null, failureCode = null } = {}) {
  return REGISTRY_ORDER.map((order, index) => {
    const entry = FROZEN_SIX.find((candidate) => candidate.order === order);
    const disposition = dispositions ? dispositions[index] : "limited";
    return {
      order,
      bvid: entry.bvid,
      disposition,
      exitCode: 0,
      signal: null,
      evidence: {},
      receipt: {
        schemaVersion: "v3-5.10-b5-3-source-receipt/v2",
        runId: RUN_ID,
        order: Number(order),
        bvid: entry.bvid,
        registrySha256: ACTIVE_REGISTRY_SHA256,
        disposition,
        failureCode: failureCode !== null
          ? failureCode
          : (disposition === "complete" ? null : "V3510B_BRIEF_COVERAGE_INSUFFICIENT"),
        startedAtUtc: "2026-10-26T00:00:00.000Z",
        finishedAtUtc: "2026-10-26T00:01:00.000Z",
        provider: {
          selectedProviderId: "minimax-cn-openai-vision",
          selectedEndpointClass: "minimax_chat_completions",
          attempted: {
            attemptCount: 1,
            providerId: "minimax-cn-openai-vision",
            endpointClass: "minimax_chat_completions",
            requestCount: 1,
          },
          published: null,
        },
        uploadCounters: { ...ZERO_UPLOADS },
        muteAudioVerified: true,
        cleanup: { runtimeScratchDeleted: true, profileRootDeleted: true, cleanupFailure: null },
        derivativeSha256: null,
        reviewCapture: null,
        reviewCaptureFailureCodes: [],
        stageADiagnostic: null,
        executionClosure: {
          stage: "post-source",
          present: true,
          ok: true,
          codes: [],
          fileCount: 499,
          driftedCount: 0,
          missingCount: 0,
          extraCount: 0,
        },
      },
      mirror: null,
      namespaceReceipt: null,
      artifact: null,
      audits: {
        secretHitCount: 0,
        audioOutputCount: 0,
        tabCaptureCount: 0,
        focusEventCount: 0,
        ownedProcessLeakCount: 0,
        cleanupComplete: true,
      },
    };
  });
}

/** The synthetic candidate lock. */
export function syntheticLock() {
  return {
    schemaVersion: "v3-5.10-b6-candidate-lock/v2",
    batch: "GC-B6 CANDIDATE LOCK",
    lockedBeforeAnyExternalAction: true,
    lockedAtUtc: "2026-10-26T00:00:00.000Z",
    runId: RUN_ID,
    registry: {
      activeRegistryPath: "docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-source-set-rebaseline-2026-10-24/02-stage-b-six-video-registry-v2.json",
      activeRegistrySha256: ACTIVE_REGISTRY_SHA256,
      expectedRegistrySha256: ACTIVE_REGISTRY_SHA256,
      digestMatches: true,
      order: FROZEN_SIX.map((entry) => ({ order: String(entry.order), bvid: entry.bvid })),
      reserves: RESERVE_SOURCES.map((entry) => entry.bvid),
      substitutionAllowed: false,
    },
    harness: [{ file: "scripts/stage_b_b5_3/sequencer.mjs", sha256: "7".repeat(64) }],
    executionClosure: {
      schemaVersion: "v3-5.10-b6-execution-closure/v2",
      fileCount: 499,
      toolIdentities: {
        node: "v22.0.0",
        python: "Python 3.12.0",
        platform: "linux-x64",
        playwright: "1.56.1",
        extensionDependencyTreeSha256: "8".repeat(64),
        extensionDependencyCount: 63,
        runtimeDependencyTreeSha256: "9".repeat(64),
        runtimeDependencyCount: 8121,
      },
    },
    // The SAFE dependency identities of the candidate. They carry no path, no
    // database name, no credential and no Provider identity.
    dependencies: {
      schemaVersion: "v3-5.10-b6-candidate-dependencies/v1",
      identities: {
        managedTools: {
          kind: "managedTools",
          present: true,
          fileCount: 3,
          treeSha256: "a".repeat(64),
        },
        asrRoot: {
          kind: "asrRoot",
          present: true,
          fileCount: 4,
          treeSha256: "b".repeat(64),
        },
        visionProviderSourceDb: {
          kind: "visionProviderSourceDb",
          present: true,
          providerMetadataSha256: "c".repeat(64),
        },
        extensionRoot: {
          kind: "extensionRoot",
          present: true,
          fileCount: 91,
          treeSha256: "d".repeat(64),
        },
      },
    },
  };
}

/** A valid precommit of the canonical protocol. */
export function syntheticPrecommit({ repoRoot } = {}) {
  return buildReviewPrecommit({
    repoRoot,
    runId: RUN_ID,
    registryOrder: REGISTRY_ORDER,
    reviewOrder: ["6", "5", "2", "4", "3", "1"],
    firstSessionId: "session-one",
    secondSessionId: "session-two",
    secondPassSentinelPosition: 3,
  });
}

/**
 * Write a REAL private review bundle to disk.
 *
 * The bundle is built with the PRODUCTION encoders, so the fixture and the
 * production writer can never drift apart.
 */
export function writeBundle(directory, order) {
  const bundle = buildBundleFixture({ order });
  const files = encodeBundleFiles(bundle);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const [name, bytes] of files) {
    const target = path.join(directory, name);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.writeFileSync(target, bytes, { mode: 0o600 });
  }
  fs.writeFileSync(
    path.join(directory, REVIEW_BUNDLE_MANIFEST),
    encodeManifestText(files),
    { mode: 0o600 },
  );
  return bundle;
}

/** The synthetic private root with the six REAL bundles. */
export function syntheticPrivateRoot() {
  const privateRoot = makeTempRoot("navia-b6hr-private-");
  const directories = {};
  for (const entry of FROZEN_SIX) {
    const directory = path.join(privateRoot, `${entry.order}-${entry.bvid}`);
    writeBundle(directory, Number(entry.order));
    directories[entry.order] = directory;
  }
  return { privateRoot, directories };
}

/**
 * Build a public evidence package from the synthetic authorities.
 */
export function buildPackage({
  repoRoot,
  dispositions = null,
  failureCode = null,
  bundles = null,
  ledger = null,
  scan = null,
  lock = null,
  precommit = null,
  retention = [],
  runId = RUN_ID,
} = {}) {
  const rows = syntheticRows({ dispositions, failureCode });
  const directories = bundles ?? syntheticPrivateRoot().directories;
  return buildPublicEvidence({
    runId,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    registryOrder: REGISTRY_ORDER,
    aggregateRows: rows,
    ledgerTotals: ledger ?? {
      integrityOk: true,
      malformedLines: 0,
      eventCount: rows.length,
      candidate: { providerCall: rows.length, runtimeSynthesize: rows.length },
      stage: { providerCall: rows.length, runtimeSynthesize: rows.length },
    },
    authority: null,
    bundleDirectories: directories,
    reviewRows: null,
    sentinelReviews: null,
    precommit: precommit ?? syntheticPrecommit({ repoRoot }),
    lock: lock ?? syntheticLock(),
    retentionRecords: retention,
    scan: scan ?? { secretHits: 0, absolutePathHits: 0, rawMediaPayloadHits: 0 },
    repoRoot,
  });
}

/** Validate a generated package against the production validator. */
export function validatePackage(built, { repoRoot, runId = RUN_ID, overrides = {} } = {}) {
  return validatePublicEvidence(built.payloads, {
    runId,
    expectedRegistryOrder: REGISTRY_ORDER,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    repoRoot,
    ...overrides,
  });
}
