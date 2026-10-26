// Stage B B-5-3 fresh 6-BVID runner (per-BVID isolation)
//
// Purpose: run a single bilibili BVID through the Stage A (acquire + transcribe)
// and Stage B (synthesize_v2 → grounded-comprehension-v2.1) flow WITHOUT any
// manual Chrome navigation. Reuses existing chrome-extension scripts:
//   - apps/chrome-extension/e2e/chrome-v2-t01-r1-frontend.mjs::launchExtension()
//       (Windows Chrome + --mute-audio + --load-extension + --disable-extensions-except)
//   - apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs
//       (BVID → goto → resolve → ready → synthesize)
//
// Each invocation produces 10 evidence files into:
//   <evidenceRoot>/bvid-<order>-<bvid>/
//
// Usage:
//   node scripts/stage_b_b5_3/run_one_bvid.mjs \
//     --order=1 --bvid=BV1pohR6rEEh \
//     --run-id=stage-b-b5-3-<utc> \
//     --evidence-root=docs/active/project/evidence/.../stage-b-b5-3-evidence
//
// Hard-coded: --mute-audio ON; --load-extension + --disable-extensions-except ON;
// uploads only transcript/ocr/vision-caption text.

import { assertFrozenIdentity } from "./lib/preflight.mjs";
import { ACTIVE_REGISTRY_SHA256 } from "./lib/registry.mjs";
import {
  PROVIDER_LOCK,
  SELECTED_PROVIDER_ID,
  dispositionForQualityStatus,
  providerLockOffenders,
} from "./lib/contracts.mjs";
import {
  inspectCookieFile,
  productHarnessError,
  realAdapters,
  resolveCookieFile,
  resolveOwnedProductPaths,
  visionProviderHelper,
} from "./lib/owned_session.mjs";
import { buildPregrantedFixture, inspectPregrantedManifest } from "./lib/extension_fixture.mjs";
import {
  openStageLedger,
  resolveStageRoot,
} from "./lib/action_ledger.mjs";
import { verifyChildGrant } from "./lib/authorization.mjs";
import { mergeMachineReceipt } from "./lib/audit_finalizer.mjs";
import { captureGateDecision } from "./lib/b6_capture_gate.mjs";
import {
  CAPTURE_RECEIPT_SCHEMA,
  captureFromRuntime,
} from "./lib/review_capture.mjs";
import {
  CANARY_CODE,
  ORDER2_OBSERVATIONS_SCHEMA,
  assertOrder2Identity,
  recordVisualObservation,
  sanitizeObservedErrorCode,
} from "./lib/order2_canary.mjs";
import { isStrictPng } from "./lib/review_bundle.mjs";
import {
  V21_ARTIFACT_FILENAME,
  canonicalJson,
} from "./lib/v21_artifact.mjs";
import { FROZEN_SIX, FROZEN_PORTAL_ID } from "./lib/registry.mjs";
import {
  resolveExecutionRootIdentities,
  verifyExecutionSnapshot,
} from "./lib/execution_closure.mjs";
import {
  CANDIDATE_STOP_CODE,
  candidatePathRequired,
  resolveCandidateRoots,
} from "./lib/candidate_prepare.mjs";
import {
  CANDIDATE_DEPENDENCY_CODE,
  CANDIDATE_DEPENDENCY_FILE_ENV,
  primaryDependencyCode,
  verifyCandidateDependencies,
} from "./lib/candidate_dependencies.mjs";
import {
  AUTHORITY_BLOCKED_STATES,
  AUTHORITY_PENDING_STATES,
  MEDIA_TASK_BLOCKED_STATES,
  MEDIA_TASK_TERMINAL_STATES,
  STAGE_A_BUDGETS,
  STAGE_A_CODE,
  elapsedBucket,
  matchesFrozenIdentity,
  newStageADiagnostic,
  stateClass,
  statusClass,
  timeoutText,
} from "./lib/stage_a_diagnostics.mjs";
import { waitForOwnedChromeProcess } from "./lib/owned_chrome.mjs";
import {
  classifyRuntimeFailure,
  detectAbsolutePaths,
  redactAbsolutePaths,
  safeFileReference,
} from "./lib/privacy.mjs";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
// GC-B6H-R: the candidate path runs from a SEALED SNAPSHOT.
//
//   * the PRODUCT root holds the executed bytes: the Runtime package, the
//     built extension and the child harness;
//   * the TOOL root holds the pinned third-party dependency trees (the
//     Playwright install and the Python virtual environment);
//   * the REPO root holds the DURABLE state (the authorization, the ledger
//     and the stage root).
//
// Without the candidate environment the runner falls back to its own
// location: that is the NON-candidate path, and it is not a candidate run.
const candidateRoots = resolveCandidateRoots({
  environment: process.env,
  fallbackRepoRoot: path.resolve(here, "../.."),
});
const repoRoot = candidateRoots.repoRoot ?? path.resolve(here, "../..");
const toolRoot = candidateRoots.toolRoot ?? repoRoot;
const productRoot = candidateRoots.snapshotRoot ?? repoRoot;
// Playwright + chrome-extension e2e deps live in apps/chrome-extension.
// We resolve them via absolute file: URLs so this runner can sit anywhere
// in the repo and still find them. The dependency tree is a TOOL binding:
// it stays at its pinned identity and is not copied into the snapshot.
const playwrightUrl = `file://${path.join(toolRoot, "apps/chrome-extension/node_modules/playwright/index.mjs").replaceAll("\\", "/")}`;
const { chromium } = await import(playwrightUrl);

const extensionRoot = fs.realpathSync(path.join(productRoot, "apps/chrome-extension/chrome-mv3-unpacked"));
const runtimeRoot = path.join(productRoot, "services/local-runtime");
const runtimePython = path.join(toolRoot, "services/local-runtime/.venv/bin/python");
const t01FrontendToolkit = path.join(productRoot, "apps/chrome-extension/e2e/chrome-v2-t01-r1-frontend.mjs");

// CLI parsing
function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) out[arg.slice(2)] = "1";
    else out[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  const required = ["order", "bvid", "run-id", "evidence-root"];
  for (const key of required) if (!out[key]) throw new Error(`Missing --${key}`);
  if (!/^BV[0-9A-Za-z]{10}$/.test(out.bvid)) throw new Error(`Invalid --bvid ${out.bvid}`);
  if (!/^[1-6]$/.test(out.order)) throw new Error(`Invalid --order ${out.order}`);
  return out;
}

const args = parseArgs(process.argv.slice(2));
// GC-B5R G4: the runner may only be asked for the exact frozen identity.
// A substituted BVID is refused before anything is started.
assertFrozenIdentity({ order: args.order, bvid: args.bvid });
// GC-B6C: the ORDER-2 DIAGNOSTIC CANARY mode.
//
// It is a NON-CANDIDATE diagnostic: it reuses THIS runner (the owned
// Chrome/Runtime, the ledger, the capture and the cleanup owner) and it
// adds NO owner path. It may only diagnose the frozen registry order 2:
// every other primary order and every reserve source is refused BEFORE
// anything is started.
const canaryMode = args.canary === "order2-diagnostic" ? "order2-diagnostic" : null;
if (canaryMode) {
  const canaryIdentity = assertOrder2Identity({ order: args.order, bvid: args.bvid });
  if (!canaryIdentity.ok) {
    throw new Error(`The order-2 diagnostic canary refused this identity: ${canaryIdentity.code}.`);
  }
}
/** The PASSIVE visual observations of the canary mode. */
const canaryVisualObservations = [];
/** The canary's own stable observation codes (never a product string). */
const canaryObservationCodes = [];
/** The canary's observations. They are written in the finally path. */
let canaryObservations = null;
const evidenceRoot = path.resolve(args["evidence-root"]);
const bvidEvidenceDir = path.join(evidenceRoot, `bvid-${args.order}-${args.bvid}`);
fs.mkdirSync(bvidEvidenceDir, { recursive: true, mode: 0o700 });
const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), `navia-b5-3-bvid${args.order}-`));
const profilePath = fs.mkdtempSync(path.join(profileRoot, `navia-t01-profile-`));
const runtimeScratch = fs.mkdtempSync(path.join(os.tmpdir(), `navia-b5-3-rtbvid${args.order}-`));
// The TEST-ONLY media task root: the Runtime double of the offline tests
// writes the published derivative and the internal diagnostic into it.
const mediaTaskRootOverride = process.env.NAVIA_B5_TEST_MEDIA_TASK_ROOT || null;
const dbPath = process.env.NAVIA_B5_TEST_DB_PATH
  || path.join(runtimeScratch, `bvid-${args.order}.sqlite3`);
if (!fs.existsSync(dbPath)) {
  // A fresh database. An existing one (the TEST-ONLY double) is never
  // truncated: the runner must not destroy the database it was given.
  fs.writeFileSync(dbPath, "");
  fs.chmodSync(dbPath, 0o600);
}
const mediaTaskRoot = mediaTaskRootOverride ?? path.join(runtimeScratch, "media-tasks");
const mediaAsrTaskRoot = path.join(runtimeScratch, "media-asr-tasks");
const mediaDownloadCacheRoot = path.join(runtimeScratch, "media-download-cache");
fs.mkdirSync(mediaTaskRoot, { mode: 0o700, recursive: true });
fs.mkdirSync(mediaAsrTaskRoot, { mode: 0o700, recursive: true });
fs.mkdirSync(mediaDownloadCacheRoot, { mode: 0o700, recursive: true });

const TASK_NAMESPACE = `media_task_${randomUUID().replaceAll("-", "").slice(0, 32)}`;
// The product's FROZEN Runtime port. The extension is built against it.
const PRODUCT_RUNTIME_PORT = 17861;
const DERIVED_TEXT_SCOPE = ["transcript", "ocr", "vision-caption"];
const UPLOAD_COUNTER_HARD_ZERO = {
  rawVideoUploadCount: 0, rawAudioUploadCount: 0, frameByteUploadCount: 0,
  cookieUploadCount: 0, apiKeyDisclosureCount: 0, localPathUploadCount: 0,
};
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_\-]{16,}/, /sk_live_[A-Za-z0-9]{8,}/,
  /AIza[0-9A-Za-z_\-]{16,}/, /gho_[A-Za-z0-9]{16,}/,
  /deepseek-[A-Za-z0-9]{8,}/, /minimax-[A-Za-z0-9]{8,}/,
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const writeJson = (target, value) => fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
const ensure = (cond, message) => { if (!cond) throw new Error(message); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// --- The fault seam (TEST ONLY, off unless the environment asks) -----------
//
// The offline suite must drive the real runner through every failure
// milestone WITHOUT a Chrome, a Runtime, a Provider or a download. The seam
// therefore fails BEFORE the milestone's real work: the milestone is never
// reached and no external action ever happens. It is off unless
// NAVIA_B5_FAULT_POINT names a milestone.
export const FAULT_POINTS = Object.freeze([
  "before_chrome",
  "after_chrome",
  "after_task_creation",
  "provider_rejection",
  "during_cleanup",
]);

const faultPoint = process.env.NAVIA_B5_FAULT_POINT || null;

/**
 * The TEST-ONLY external doubles.
 *
 * They exist so the offline suite can drive a REAL structured Runtime
 * response through the runner without a real media Runtime and without a
 * browser. The response is a REAL HTTP exchange: the runner's own
 * classification, its own finalization and its own audit set run with it.
 *
 * They are OFF unless the environment asks for them, and they never change
 * the production path.
 */
const testRuntimeUrl = process.env.NAVIA_B5_TEST_RUNTIME_URL || null;
const testDatabasePath = process.env.NAVIA_B5_TEST_DB_PATH || null;
const testNoBrowser = process.env.NAVIA_B5_TEST_NO_BROWSER === "1";
function faultAt(point) {
  if (faultPoint !== point) return;
  throw new Error(`Injected fault at ${point}.`);
}

/**
 * Run one EXTERNAL milestone.
 *
 * When a fault is armed the offline suite must never launch a browser, start
 * a Runtime, read a Cookie or call a Provider: the milestone is SKIPPED (its
 * facts stay absent) and the named milestone fails. A skipped milestone never
 * invents a fact.
 */
function externalMilestone(point, perform) {
  if (faultPoint !== null) {
    faultAt(point);
    return null;
  }
  return perform();
}

// --- Logger -----------------------------------------------------------------
const logLines = [];
const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  logLines.push(stamped);
};

// --- T01 toolkit shim (we import launchExtension + extensionWorker from it) ----
const t01Module = await import(`file://${t01FrontendToolkit.replaceAll("\\", "/")}`);
const { launchExtension, extensionWorker } = t01Module;

/**
 * Write the machine receipt of THIS source.
 *
 * It carries the product-owned route, the task/source/revision/generation
 * identities, the terminal disposition, the artifact digests, the Provider and
 * endpoint identity, the six upload counters, the redacted request counts and
 * the cleanup outcome. It NEVER carries a cookie value, an API key, raw
 * media, a transcript text, a file name or a private absolute path: the
 * database and the profile are referenced by a digest of their path.
 */
/**
 * Write one evidence file ATOMICALLY.
 *
 * A temporary sibling plus a rename: a reader never sees a half-written file.
 */
function writeEvidenceFile(name, content) {
  const target = path.join(bvidEvidenceDir, name);
  const temporary = path.join(bvidEvidenceDir, `${name}.tmp`);
  fs.writeFileSync(temporary, content, { mode: 0o600 });
  fs.renameSync(temporary, target);
}

function writeEvidenceJson(name, value) {
  writeEvidenceFile(name, `${JSON.stringify(value, null, 2)}\n`);
}

/** The durable machine receipt of this source, if one exists. */
function readExistingMachineReceipt() {
  try {
    const target = path.join(bvidEvidenceDir, "b5-source-receipt.json");
    if (!fs.existsSync(target)) return null;
    return JSON.parse(fs.readFileSync(target, "utf8"));
  } catch {
    return null;
  }
}

/**
 * The SINGLE finalizer of the mandatory audit set.
 *
 * It writes the SAME nine files for every disposition (complete, limited,
 * blocked and failed). A failure never loses the evidence of what DID happen:
 * the identity, the upload hard-zero counters, the mute flag, the ownership
 * and the cleanup facts that are known are all preserved.
 *
 * It is IDEMPOTENT: a second finalization merges the facts and never
 * overwrites a stronger durable fact with null.
 */
function finalizeAuditEvidence() {
  const finishedAtUtc = new Date().toISOString();
  // The EXPLICIT merge: the durable evidence is re-read and every field
  // follows its own rule (see lib/audit_finalizer.mjs). The cleanup
  // booleans converge false -> true, the cleanup failure is never erased, a
  // published receipt may replace an earlier null but is never fabricated,
  // the terminal pair follows an explicit precedence and the evidence of a
  // different run or source is never combined.
  const previous = readExistingMachineReceipt();
  const merge = (next) => mergeMachineReceipt({ previous, next });
  const providerFacts = {
    selectedProviderId: SELECTED_PROVIDER_ID,
    selectedEndpointClass: PROVIDER_LOCK,
    // The ATTEMPTED facts: what was asked of the Provider, whether or not
    // anything was published. A REJECTED attempt still has attempted facts.
    attempted: {
      // The number of Runtime synthesize ENDPOINT invocations of this run.
      attemptCount: observed.runtimeSynthesizeCount ?? 0,
      providerId: SELECTED_PROVIDER_ID,
      endpointClass: PROVIDER_LOCK,
      // The ACTUAL number of outbound Provider HTTP attempts. It is owned by
      // the Runtime (the published receipt or its internal diagnostic) and it
      // stays null when the Runtime reported nothing.
      requestCount: observed.providerOutboundHttpAttempts ?? null,
    },
    // The PUBLISHED facts: the receipt of the derivative that was actually
    // written. An absent publication is never filled with successful values.
    // The FULL internal publication shape: the frozen V2.1 receipt identity
    // of the derivative that was actually published. A partial publication
    // is refused by the aggregate.
    published: publishedReceipt
      ? {
        providerId: publishedReceipt.providerId ?? null,
        modelId: publishedReceipt.modelId ?? null,
        endpointClass: publishedReceipt.endpointClass ?? null,
        structureMode: publishedReceipt.structureMode ?? null,
        attemptId: publishedReceipt.attemptId ?? null,
        requestCount: publishedReceipt.requestCount ?? null,
        latencyMs: publishedReceipt.latencyMs ?? null,
        requestSha256: publishedReceipt.requestSha256 ?? null,
        responseSha256: publishedReceipt.responseSha256 ?? null,
        outboundDerivedTextSha256: publishedReceipt.outboundDerivedTextSha256 ?? null,
        finishReason: publishedReceipt.finishReason ?? null,
        uploadCounters: {
          rawVideoUploadCount: publishedReceipt.rawVideoUploadCount ?? null,
          rawAudioUploadCount: publishedReceipt.rawAudioUploadCount ?? null,
          frameByteUploadCount: publishedReceipt.frameByteUploadCount ?? null,
          cookieUploadCount: publishedReceipt.cookieUploadCount ?? null,
          apiKeyDisclosureCount: publishedReceipt.apiKeyDisclosureCount ?? null,
          localPathUploadCount: publishedReceipt.localPathUploadCount ?? null,
        },
      }
      : null,
  };

  const machineReceipt = merge({
    // The GC-B6H-R durable record gained the Stage A observation, the
    // execution-closure verdict and the execution-root identities: the
    // record version follows its shape.
    schemaVersion: "v3-5.10-b5-3-source-receipt/v3",
    runId: args["run-id"] ?? null,
    order: Number(args.order),
    bvid: args.bvid,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    taskId: observed.taskId,
    taskNamespace: TASK_NAMESPACE,
    taskRevision: observed.taskRevision,
    sourceIdentity: observed.sourceIdentity,
    dependencyGeneration: observed.dependencyGeneration,
    route: observed.route,
    disposition: finalDisposition,
    failureCode: failureCode,
    startedAtUtc,
    finishedAtUtc,
    provider: providerFacts,
    uploadCounters: observed.uploadCounters,
    audioOutputCount: observed.audioOutputCount,
    tabCaptureCount: observed.tabCaptureCount,
    focusEventCount: observed.focusEventCount,
    focusTargetOwned: observed.focusTargetOwned,
    cookieInjectionCount: observed.cookieInjectionCount,
    extensionPermissionMode: observed.extensionPermissionMode,
    muteAudioVerified: muteAudioVerified,
    runtimeDatabaseRef: observed.runtimeDatabaseRef,
    chromeProfileRef: observed.chromeProfileRef,
    derivativeSha256: observed.derivativeSha256,
    receiptSha256: observed.receiptSha256,
    evidenceSha256: observed.evidenceSha256,
    cleanup: cleanupFacts,
    // The redacted chapter diagnostic, when the Runtime produced one.
    chapterDiagnostic: observed.chapterDiagnostic ?? null,
    // The B-6 review capture receipt, when the capture ran.
    reviewCapture: observed.reviewCapture ?? null,
    // Stable codes only. Details can contain evidence identifiers or derived
    // content and therefore never enter the durable machine receipt.
    reviewCaptureFailureCodes: observed.reviewCaptureFailureCodes ?? null,
    // The GC-B6H-R DURABLE diagnostics: the Stage A observation, the
    // execution-closure verdict and the execution-root identities. They are
    // counts, enums, booleans and digests only.
    stageADiagnostic: observed.stageADiagnostic ?? null,
    executionClosure: observed.executionClosure ?? null,
    executionRoots: observed.executionRoots ?? null,
    extensionManifestOriginalSha256: extensionFixture.originalSha ?? null,
    extensionManifestFixtureSha256: extensionFixture.modifiedSha ?? null,
  });

  // 1. the machine receipt
  writeEvidenceJson("b5-source-receipt.json", machineReceipt);
  // 2. the final disposition
  writeEvidenceFile("final_disposition.txt",
    `${finalDisposition}\nreason: ${finishReason}\nbvid: ${args.bvid}\norder: ${args.order}\ntaskId: ${observed.taskId ?? "unknown"}\n`);
  // 3. the isolation fingerprint
  writeEvidenceJson("isolation.json", {
    schemaVersion: "v3-5.10-b5-3-isolation/v2",
    runtimePid: runtime?.pid ?? null,
    // The owned roots are recorded as HASHED references: an absolute runtime,
    // database or profile path may never enter the evidence.
    runtimeDirRef: sha256(runtimeScratch),
    runtimePort,
    databaseRef: sha256(dbPath),
    databaseMode: fs.existsSync(dbPath) ? (fs.statSync(dbPath).mode & 0o777).toString(8) : null,
    chromeProfileDirRef: sha256(profileRoot),
    chromePidList: [chromePid].filter(Boolean),
    chromeCdpPort: null,
    chromeLaunchLineSha256,
    taskIdNamespace: TASK_NAMESPACE,
    providerLock: PROVIDER_LOCK,
    selectedProviderId: SELECTED_PROVIDER_ID,
    derivedTextScope: DERIVED_TEXT_SCOPE,
    muteAudioVerified,
    startedAtUtc,
    finishedAtUtc,
    finalDisposition,
    finishReason,
  });
  // 4. the receipt mirror. The PUBLISHED receipt is present only when a
  //    derivative was actually written.
  writeEvidenceJson("receipt.json", {
    schemaVersion: "v3-5.10-b5-3-receipt-mirror/v2",
    taskId: observed.taskId,
    receipt: publishedReceipt,
    published: Boolean(publishedReceipt),
    derivativeSha256: observed.derivativeSha256,
    taskIdNamespace: TASK_NAMESPACE,
    providerLock: PROVIDER_LOCK,
    selectedProviderId: SELECTED_PROVIDER_ID,
    selectedEndpointClass: PROVIDER_LOCK,
    derivedTextScope: DERIVED_TEXT_SCOPE,
  });
  // 5. the provider lock
  writeEvidenceFile("provider_lock.txt",
    `providerLock=${PROVIDER_LOCK}\nselectedProviderId=${SELECTED_PROVIDER_ID}\nselectedEndpointClass=${PROVIDER_LOCK}\n`
    + `providerIdObserved=${publishedReceipt?.providerId ?? "none"}\n`
    + `endpointClassObserved=${publishedReceipt?.endpointClass ?? "none"}\n`
    + `providerPublished=${Boolean(publishedReceipt)}\ndeepseek.selected=false\n`
    + `derivedTextScope=${DERIVED_TEXT_SCOPE.join(",")}\n`
    + `uploadCounters=${JSON.stringify(observed.uploadCounters)}\n`
    + `startedAtUtc=${startedAtUtc}\nfinishedAtUtc=${finishedAtUtc}\n`);
  // 6. the Chrome launch record
  writeEvidenceFile("chrome_launch.log",
    `pid=${chromePid ?? "none"} cdpPort=null profileRef=${sha256(profileRoot)}\n`
    + `--mute-audio present: ${muteAudioVerified}\n`
    + `chromeLaunchLineSha256=${chromeLaunchLineSha256 ?? "none"}\n`
    + `chromeLaunched=${Boolean(chromeCmdline)}\n`);
  // 7. the task namespace
  writeEvidenceJson("task_namespace.json", {
    taskIdNamespace: TASK_NAMESPACE,
    bvid: args.bvid,
    order: Number(args.order),
    runId: args["run-id"] ?? null,
  });
  // 8. the published derivative (only when it exists). The EXACT durable
  //    bytes are preserved under the CONTRACTED artifact name, so the
  //    aggregate can hash them and validate them.
  if (publishedDerivativeBytes) {
    writeEvidenceFile(V21_ARTIFACT_FILENAME, publishedDerivativeBytes);
  }
  // 9. the cleanup receipt
  writeEvidenceJson("cleanup.json", {
    schemaVersion: "v3-5.10-b5-3-cleanup/v1",
    bvid: args.bvid,
    order: Number(args.order),
    runtimeScratchDeleted: cleanupFacts.runtimeScratchDeleted,
    profileRootDeleted: cleanupFacts.profileRootDeleted,
    finishedAtUtc,
  });
  // 10. the secret scan of everything that was just written
  const secretScan = [];
  const scanFile = (file) => {
    if (!fs.existsSync(file)) return;
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(file)) scanFile(path.join(file, entry));
      return;
    }
    const text = fs.readFileSync(file).toString("utf8");
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(text)) {
        // The CLASSIFICATION and the COUNT only. A matched secret character
        // may never enter the evidence.
        secretScan.push({
          fileRef: safeFileReference(path.relative(bvidEvidenceDir, file)),
          classification: `secret-pattern-${SECRET_PATTERNS.indexOf(pattern)}`,
          occurrences: (text.match(new RegExp(pattern.source, "g")) ?? []).length,
        });
      }
    }
  };
  scanFile(bvidEvidenceDir);
  writeEvidenceFile("secret_scan.csv",
    ["file_ref,classification,occurrences"]
      .concat(secretScan.map((row) => `${row.fileRef},${row.classification},${row.occurrences}`))
      .join("\n") + "\n");

  // 11. the privacy gate: the written evidence may carry NO absolute path.
  // A surviving path is REDACTED in place and counted: the evidence is
  // always path-free, and the count is durable.
  let absolutePathCount = 0;
  const privacyFiles = [];
  const auditFile = (file) => {
    if (!fs.existsSync(file)) return;
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(file)) auditFile(path.join(file, entry));
      return;
    }
    if (file.endsWith(".tmp")) return;
    const text = fs.readFileSync(file, "utf8");
    const paths = detectAbsolutePaths(text);
    if (!paths.length) return;
    absolutePathCount += paths.length;
    if (path.basename(file) === V21_ARTIFACT_FILENAME) {
      // The published artifact is NEVER rewritten: its BYTES are the
      // evidence. A path inside it is a FAIL-CLOSED condition instead.
      artifactPrivacyViolation = true;
      privacyFiles.push({
        fileRef: safeFileReference(path.relative(bvidEvidenceDir, file)),
        paths: paths.length,
        note: "the published artifact is never rewritten; a path inside it fails the source closed",
      });
      return;
    }
    fs.writeFileSync(file, redactAbsolutePaths(text), { mode: 0o600 });
    privacyFiles.push({ fileRef: safeFileReference(path.relative(bvidEvidenceDir, file)), paths: paths.length });
  };
  auditFile(bvidEvidenceDir);
  writeEvidenceJson("privacy-audit.json", {
    schemaVersion: "v3-5.10-b5-3-privacy-audit/v1",
    absolutePathCount,
    redactedFiles: privacyFiles,
    secretHitCount: secretScan.length,
    note: "The evidence carries no absolute runtime, database, profile or repository path, and no matched secret character.",
  });
  finalizerRan = true;
  return machineReceipt;
}

/**
 * Read the PRIVATE redacted chapter diagnostic the Runtime produced.
 *
 * It is a fact record: shapes, counts, enums and booleans. It never carries
 * a Provider response, a transcript, an evidence text, a title, a Cookie, a
 * key, a private path, raw media or an evidence id.
 */
function readChapterDiagnostic() {
  const candidates = [
    path.join(mediaTaskRoot, "product-evidence", "diagnostics", observed.taskId ?? "", "stage-b-diagnostic.json"),
    path.join(mediaTaskRoot, "diagnostics", observed.taskId ?? "", "stage-b-diagnostic.json"),
    path.join(mediaTaskRoot, observed.taskId ?? "", "diagnostics", "stage-b-diagnostic.json"),
  ];
  if (process.env.NAVIA_B5_DIAGNOSTIC_FILE) {
    candidates.unshift(path.resolve(process.env.NAVIA_B5_DIAGNOSTIC_FILE));
  }
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return sanitizeDiagnostic(JSON.parse(fs.readFileSync(candidate, "utf8")));
      }
    } catch { /* the diagnostic is a record, never a gate */ }
  }
  return null;
}

const DIAGNOSTIC_KEYS = new Set([
  "schemaVersion", "stages", "stage", "failureCode", "candidateShape",
  "candidateType", "topLevel", "brief", "present", "presentCount",
  "missingCount", "unknownCount", "claims", "count", "itemShapeClasses",
  "chapters", "containerType", "fieldSetClasses", "invalidChapterIndexes",
  "invalidRelationCount", "conflictFlagType", "shapeViolation",
  "evidenceCapacity", "evidenceCount", "distinctStartCount",
  "duplicateStartGroupCount", "maximumDuplicateStartMultiplicity",
  "firstStartMs", "lastStartMs", "hasTwoStrictlyIncreasingAnchors",
  "anchors", "chapterAnchorCount", "duplicateAnchorCount",
  "nonIncreasingAnchorCount", "unknownEvidenceReference",
  "firstChapterIncludesBoundaryEvidence", "lastChapterIncludesBoundaryEvidence",
  "chapterBalance", "chapterCount", "startConcentration",
  "maximumChapterSpanRatio", "substantiveRegionCount", "violationClass",
  "violationCode", "repair", "repairAttemptCount", "finalOutcome",
  "providerOutboundHttpAttempts",
  // The GC-B6F VALUE-DOMAIN facts: the failing subdomain of a value-domain
  // violation, as enums and counts only.
  "valueDomain", "textType", "textLengthBucket", "evidenceIdsContainer",
  "evidenceIdsItemCount", "evidenceIdsEmptyItemCount",
  "evidenceIdsNonStringItemCount", "unknownEvidenceReferenceCount",
  "itemCount", "textInvalidItemCount", "evidenceIdsInvalidItemCount",
  "chapterNameInvalidItemCount", "chapterStatementInvalidItemCount",
  "textTypeClasses", "textLengthBucketClasses", "evidenceIdsContainerClasses",
  "chapterNameLengthBucketClasses", "chapterStatementLengthBucketClasses",
]);

const DIAGNOSTIC_ARRAY_KEYS = new Set([
  "stages", "present", "itemShapeClasses", "fieldSetClasses", "invalidChapterIndexes",
  "textTypeClasses", "textLengthBucketClasses", "evidenceIdsContainerClasses",
  "chapterNameLengthBucketClasses", "chapterStatementLengthBucketClasses",
]);

const DIAGNOSTIC_NUMBER_KEYS = new Set([
  "presentCount", "missingCount", "unknownCount", "count",
  "invalidChapterIndexes", "invalidRelationCount", "evidenceCount",
  "distinctStartCount", "duplicateStartGroupCount", "maximumDuplicateStartMultiplicity",
  "firstStartMs", "lastStartMs", "chapterAnchorCount", "duplicateAnchorCount",
  "nonIncreasingAnchorCount", "chapterCount", "startConcentration",
  "maximumChapterSpanRatio", "substantiveRegionCount", "repairAttemptCount",
  "providerOutboundHttpAttempts", "evidenceIdsItemCount",
  "evidenceIdsEmptyItemCount", "evidenceIdsNonStringItemCount",
  "unknownEvidenceReferenceCount", "itemCount", "textInvalidItemCount",
  "evidenceIdsInvalidItemCount", "chapterNameInvalidItemCount",
  "chapterStatementInvalidItemCount",
]);

const DIAGNOSTIC_BOOLEAN_KEYS = new Set([
  "present", "hasTwoStrictlyIncreasingAnchors", "unknownEvidenceReference",
  "firstChapterIncludesBoundaryEvidence", "lastChapterIncludesBoundaryEvidence",
]);

const DIAGNOSTIC_ENUMS = Object.freeze({
  stage: new Set([
    "initial_candidate", "bounded_repair", "shape_regeneration", "temporal_repair",
    "chapter_balance_repair", "candidate_enforcement", "provider_attempt",
    "validator_initial", "provider_bounded_repair", "validator_bounded_repair",
  ]),
  candidateType: new Set(["object", "dict", "list", "str", "int", "float", "bool", "NoneType"]),
  present: new Set([
    "brief", "claims", "chapters", "unresolvedEvidenceConflict", "text", "evidenceIds",
  ]),
  itemShapeClasses: new Set(["exact", "has_unknown_fields", "missing_fields", "not_an_object"]),
  fieldSetClasses: new Set(["exact", "has_unknown_fields", "missing_fields", "not_an_object"]),
  containerType: new Set(["list", "absent", "not_a_list"]),
  conflictFlagType: new Set(["boolean", "absent", "not_a_boolean"]),
  shapeViolation: new Set([
    "none", "not_an_object", "top_level_key_set", "brief_shape", "brief_value_domain",
    "claims_shape", "claim_field_set", "claim_value_domain", "chapters_shape",
    "chapter_count", "chapter_field_set", "chapter_value_domain", "relation_enum",
    "conflict_flag",
  ]),
  violationClass: new Set(["chapter_start_concentration", "chapter_span_ratio"]),
  finalOutcome: new Set(["recovering", "recovered", "fail_closed"]),
  textType: new Set(["absent", "null", "string", "not_a_string"]),
  textLengthBucket: new Set(["unknown", "empty", "too_short", "in_range", "too_long"]),
  evidenceIdsContainer: new Set(["absent", "null", "empty_list", "list", "not_a_list"]),
  textTypeClasses: new Set(["absent", "null", "string", "not_a_string"]),
  textLengthBucketClasses: new Set(["unknown", "empty", "too_short", "in_range", "too_long"]),
  evidenceIdsContainerClasses: new Set(["absent", "null", "empty_list", "list", "not_a_list"]),
  chapterNameLengthBucketClasses: new Set(["unknown", "empty", "too_short", "in_range", "too_long"]),
  chapterStatementLengthBucketClasses: new Set(["unknown", "empty", "too_short", "in_range", "too_long"]),
});

/**
 * Project the private diagnostic through its exact public evidence vocabulary.
 *
 * Shape-based string filtering is insufficient: a secret such as `secret`
 * also looks like a short enum. Every retained key and every retained string
 * therefore belongs to an explicit structural vocabulary. Unknown keys and
 * values are dropped instead of being copied into the machine receipt.
 */
function sanitizeDiagnostic(value, key = null) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return DIAGNOSTIC_BOOLEAN_KEYS.has(key) ? value : null;
  if (typeof value === "number") {
    return DIAGNOSTIC_NUMBER_KEYS.has(key) && Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string") {
    if (key === "schemaVersion" && /^v3-media-grounded-chapter-diagnostic(?:-set)?\/v1$/.test(value)) return value;
    if ((key === "failureCode" || key === "violationCode") && /^V(?:3510B|352)_[A-Z0-9_]{1,64}$/.test(value)) return value;
    return DIAGNOSTIC_ENUMS[key]?.has(value) ? value : null;
  }
  if (Array.isArray(value)) {
    if (!DIAGNOSTIC_ARRAY_KEYS.has(key)) return null;
    return value.map((item) => sanitizeDiagnostic(item, key)).filter((item) => item !== null);
  }
  if (typeof value === "object") {
    const sanitized = {};
    for (const [childKey, item] of Object.entries(value)) {
      if (!DIAGNOSTIC_KEYS.has(childKey)) continue;
      const clean = sanitizeDiagnostic(item, childKey);
      if (clean !== null) sanitized[childKey] = clean;
    }
    return sanitized;
  }
  return null;
}

function writeMachineReceipt() {
  const receipt = {
    schemaVersion: "v3-5.10-b5-3-source-receipt/v1",
    runId: args["run-id"],
    order: Number(args.order),
    bvid: args.bvid,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    taskId: observed.taskId,
    taskNamespace: TASK_NAMESPACE,
    taskRevision: observed.taskRevision,
    sourceIdentity: observed.sourceIdentity,
    dependencyGeneration: observed.dependencyGeneration,
    route: observed.route,
    disposition: finalDisposition,
    startedAtUtc,
    finishedAtUtc: new Date().toISOString(),
    providerId: observed.providerId,
    selectedProviderId: SELECTED_PROVIDER_ID,
    endpointClass: observed.endpointClass,
    selectedEndpointClass: PROVIDER_LOCK,
    uploadCounters: observed.uploadCounters,
    audioOutputCount: 0,
    tabCaptureCount: observed.tabCaptureCount,
    focusEventCount: observed.focusEventCount,
    focusTargetOwned: observed.focusTargetOwned,
    cookieInjectionCount: injectedCookieCount.value,
    cookie: {
      requiredNamesPresent: cookieInspection.requiredNamesPresent,
      allowedNameSetSha256: cookieInspection.allowedNameSetSha256,
      usableCookieCount: cookieInspection.usableCookieCount,
    },
    visionProviderId: visionProvider.providerId,
    extensionPermissionMode: "pregranted_test_fixture",
    extensionManifestOriginalSha256: extensionFixture?.originalSha ?? null,
    extensionManifestFixtureSha256: extensionFixture?.modifiedSha ?? null,
    runtimeDatabaseRef: sha256(dbPath),
    chromeProfileRef: sha256(profilePath),
    derivativeSha256: observed.derivativeSha256,
    receiptSha256: observed.receiptSha256,
    evidenceSha256: observed.evidenceSha256,
  };
  writeJson(path.join(bvidEvidenceDir, "b5-source-receipt.json"), receipt);
  return receipt;
}

// --- Helper: free port for runtime --------------------------------------------
async function freePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    }).once("error", reject);
  });
}

/** Is the port free? An occupied port is refused, never reused. */
async function isPortFree(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

// --- Per-BVID runtime companion (avoid T01's hardcoded port 17861) -----------
function startIsolatedRuntime(port, extensionId) {
  return spawn(runtimePython, [
    "-m", "uvicorn", "navia_runtime.app:app",
    "--host", "127.0.0.1", "--port", String(port),
  ], {
    cwd: runtimeRoot,
    env: {
      ...process.env,
      NAVIA_DB_PATH: dbPath,
      NAVIA_MEDIA_TASK_ROOT: mediaTaskRoot,
      NAVIA_MEDIA_ASR_TASK_ROOT: mediaAsrTaskRoot,
      NAVIA_MEDIA_DOWNLOAD_CACHE_ROOT: mediaDownloadCacheRoot,
      NAVIA_LOCAL_FILES_EXTENSION_ID: extensionId,
      NAVIA_CHAT_PROVIDER: PROVIDER_LOCK,
      // WP-A: the verified managed tools and the ASR installation are the
      // PRODUCT's own roots. The isolated Runtime verifies them itself.
      NAVIA_MEDIA_TOOL_ROOT: ownedProductPaths.managedTools,
      NAVIA_ASR_ROOT: ownedProductPaths.asrRoot,
      // The isolated Runtime reads the Provider METADATA from the owned copy.
      // The secret itself stays in the OS credential store.
      NAVIA_VISION_PROVIDER_DB_PATH: visionProviderDbPath,
      PYTHONPATH: ".",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForIsolatedRuntime(port, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/v1/health`);
      if (res.ok) return;
    } catch { /* still starting */ }
    await wait(500);
  }
  throw new Error(`isolated runtime on port ${port} did not become healthy`);
}

let browser = null;
let chromeCleanup = null;
let runtime = null;
let finalDisposition = "failed";
let finishReason = "unknown";
const startedAtUtc = new Date().toISOString();
// The facts the single finalizer writes. They are module level so that the
// success path, the failure path and the finally path all publish the SAME
// durable state.
let chromeCmdline = "";
let chromePid = null;
let chromeLaunchLineSha256 = null;
let runtimePort = null;  // the test-only Runtime double may set it
let publishedReceipt = null;
let publishedDerivative = null;
let publishedDerivativeBytes = null;
let failureCode = null;
let failureMessage = null;
let muteAudioVerified = false;
let cleanupFacts = { runtimeScratchDeleted: null, profileRootDeleted: null };
let finalizerRan = false;
let cleanupFailure = null;
// GC-B6H-R: the LATCHED execution-closure failure. Once a closure check
// failed, the source fails closed: a later healthy observation never clears
// it.
let closureFailureLatched = false;
// TRUE when the PUBLISHED ARTIFACT carries an absolute path. The artifact is
// never rewritten, so the condition fails the source closed.
let artifactPrivacyViolation = false;
let runtimeFailureCode = null;
let runtimeFailureStatus = null;
// The durable stage action ledger. It is opened BEFORE the first external
// action and finalized in the finally path.
const candidateRunId = args["run-id"] ?? "unknown-run";
const stageRoot = resolveStageRoot({ environment: process.env, repositoryRoot: repoRoot });
const ledger = openStageLedger({ stageRoot, candidateRunId });

// The owned session inputs. The cookie file is the EXPLICITLY authorized one;
// nothing is searched for and no value is ever printed.
// The product dependency inputs are resolved from the TOOL root: the
// snapshot never holds the private product state.
const ownedProductPaths = resolveOwnedProductPaths({
  environment: process.env,
  repositoryRoot: toolRoot,
});
const cookieResolution = resolveCookieFile({ environment: process.env });
// The cookie file is READ only inside the flow, never at import time.
let cookieInspection = null;
const injectedCookieCount = { value: 0 };
const visionProvider = { providerId: null, dbPath: null };
// MODULE level: `startIsolatedRuntime` is a module-level function and may not
// read a block-scoped declaration.
let visionProviderDbPath = null;
const extensionFixture = { fixturePath: null, originalSha: null, modifiedSha: null, merged: [] };
// The redacted observation lists. They are MODULE level because the failure
// path (outside the try block) reports them.
const resolveResponses = [];
const acquisitionPosts = [];
const runtimeCalls = [];
/**
 * Verify the SEALED SNAPSHOT of THIS candidate.
 *
 * GC-B6H-R: the verification runs against the SNAPSHOT bytes, because the
 * snapshot IS the execution root. It runs BEFORE any external action and
 * again after the owner cleanup, so a byte that changed DURING the source
 * is a defect of the candidate.
 *
 * A candidate path (the required switch is on) without a manifest and a
 * snapshot root is INVALID: the run stops before the grant, before the
 * Cookie read and before Chrome.
 */
function verifyCandidateClosure(stage) {
  const manifestPath = candidateRoots.manifestPath;
  const snapshotRoot = candidateRoots.snapshotRoot;
  // A normal B6 capture is always a candidate path. The order-2 diagnostic
  // canary remains a non-candidate observation and keeps its separate gate.
  const offlineCaptureHarness = process.env.NAVIA_B5_TEST_NO_BROWSER === "1"
    && Boolean(process.env.NAVIA_B5_TEST_RUNTIME_URL)
    && Boolean(process.env.NAVIA_B5_TEST_DB_PATH)
    && Boolean(process.env.NAVIA_B5_TEST_MEDIA_TASK_ROOT);
  const required = candidatePathRequired({
    environment: process.env,
    canary: canaryMode,
    offlineHarness: offlineCaptureHarness,
  });
  const record = (verdict) => {
    observed.executionClosure = {
      stage,
      present: verdict.present,
      ok: verdict.ok,
      codes: verdict.codes,
      fileCount: verdict.fileCount ?? 0,
      driftedCount: verdict.driftedCount ?? 0,
      missingCount: verdict.missingCount ?? 0,
      extraCount: verdict.extraCount ?? 0,
    };
    return verdict;
  };
  if (!manifestPath || !snapshotRoot) {
    if (!required) {
      return record({ present: false, ok: null, codes: [] });
    }
    return record({
      present: false,
      ok: false,
      codes: [CANDIDATE_STOP_CODE.SNAPSHOT_ABSENT],
    });
  }
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return record({
      present: true,
      ok: false,
      codes: ["EXECUTION_CLOSURE_SCHEMA_INVALID"],
    });
  }
  const verdict = verifyExecutionSnapshot({ manifest, snapshotRoot, toolRoot });
  return record({
    present: true,
    ok: verdict.ok,
    codes: verdict.codes,
    fileCount: Number(manifest.fileCount ?? 0),
    driftedCount: verdict.drifted.length,
    missingCount: verdict.missing.length,
    extraCount: verdict.extra.length,
  });
}

/**
 * The TEST-ONLY snapshot mutation seam.
 *
 * It exists so the offline suite can drive the REAL post-source closure
 * check: the seam changes ONE byte of the sealed snapshot right before the
 * verification, so the verification fails for a REAL reason. It is OFF
 * unless the environment names a file, and it can only CREATE a failure: it
 * never hides one.
 */
function mutateSnapshotForTest() {
  const relative = process.env.NAVIA_B5_TEST_SNAPSHOT_MUTATION || null;
  if (!relative || !candidateRoots.snapshotRoot) return null;
  if (relative.startsWith("/") || relative.includes("..")) return null;
  const target = path.join(candidateRoots.snapshotRoot, relative);
  if (!fs.existsSync(target)) return null;
  fs.appendFileSync(target, "\n// the offline suite changed this byte\n");
  return relative;
}

/**
 * LATCH a closure failure.
 *
 * A failure observed at ANY checkpoint is final: it is never cleared by a
 * later, healthier observation, and it makes the source fail closed even
 * when the bytes were restored before the closeout.
 */
function latchClosureFailure(stage, codes) {
  closureFailureLatched = true;
  finalDisposition = "failed";
  failureCode = "B6_EXECUTION_CLOSURE_INVALID";
  finishReason = `execution_closure_invalid_${stage}: ${codes.join(",")}`;
}

const observed = {
  taskId: null,
  taskRevision: null,
  sourceIdentity: null,
  dependencyGeneration: null,
  route: null,
  providerId: null,
  endpointClass: null,
  uploadCounters: { ...UPLOAD_COUNTER_HARD_ZERO },
  derivativeSha256: null,
  receiptSha256: null,
  evidenceSha256: null,
  audioOutputCount: 0,
  tabCaptureCount: 0,
  focusEventCount: 0,
  focusTargetOwned: true,
  cookieInjectionCount: 0,
  runtimeSynthesizeCount: 0,
  providerOutboundHttpAttempts: null,
  // The B-6 REVIEW CAPTURE receipt: the bundle hash, the counts, the status
  // and the closure ONLY. It never carries a text, an image byte, a file
  // name or a private path.
  reviewCapture: null,
  reviewCaptureFailureCodes: null,
  extensionPermissionMode: null,
  runtimeDatabaseRef: null,
  chromeProfileRef: null,
  chapterDiagnostic: null,
  // The GC-B6H Stage A observation: counts, enums and booleans only.
  stageADiagnostic: null,
  // The GC-B6H execution-closure verification of this source.
  executionClosure: null,
  // The GC-B6H-R execution-root identities: WHAT this source really
  // executed. Digests only, never a path.
  executionRoots: null,
};

function canaryActionCounters() {
  const candidate = ledger.totals().candidate ?? {};
  return {
    chromeLaunchCount: Number(candidate.chromeLaunch ?? 0),
    visibleWindowCount: Number(candidate.visibleWindow ?? 0),
    runtimeStartCount: Number(candidate.runtimeStart ?? 0),
    cookieInjectionCount: Number(candidate.cookieInjection ?? 0),
    focusEventCount: Number(candidate.focusEvent ?? 0),
    mediaTaskCount: Number(candidate.mediaTask ?? 0),
    runtimeSynthesizeCount: Number(candidate.runtimeSynthesize ?? 0),
    providerCallCount: Number(candidate.providerCall ?? 0),
    sourceCompletionCount: Number(candidate.sourceCompletion ?? 0),
    audioOutputCount: Number(candidate.audioOutput ?? 0),
    tabCaptureActionCount: Number(candidate.tabCaptureAction ?? 0),
  };
}

function minimalCanaryObservations() {
  const terminal = sanitizeObservedErrorCode(runtimeFailureCode ?? failureCode);
  if (terminal.refusalCode) canaryObservationCodes.push(terminal.refusalCode);
  return {
    schemaVersion: ORDER2_OBSERVATIONS_SCHEMA,
    registryOrder: String(args.order),
    bvid: args.bvid,
    runId: args["run-id"] ?? null,
    taskId: observed.taskId,
    visualObservations: canaryVisualObservations,
    observationCodes: [...new Set(canaryObservationCodes)].sort(),
    taskState: null,
    terminalFailureCode: terminal.errorCode,
    evidenceKindCounts: { transcript: 0, frame: 0, ocr_block: 0, vision_caption: 0 },
    pngConfirmedFrameCount: 0,
    pngFailureCodes: [],
    capture: {
      status: observed.reviewCapture?.status ?? "failed",
      failureCodes: Array.isArray(observed.reviewCaptureFailureCodes)
        ? observed.reviewCaptureFailureCodes
        : [],
      counts: observed.reviewCapture?.counts ?? { evidence: 0, thumbnails: 0, chapters: 0 },
    },
    cleanup: { runtimeScratchDeleted: false, profileRootDeleted: false, cleanupFailure: null },
    ownedLeakSightings: null,
    actionCounters: canaryActionCounters(),
    uploadCounters: { ...observed.uploadCounters },
  };
}

/**
 * Record the ACTUAL number of outbound Provider HTTP attempts.
 *
 * The count comes from the Runtime: the published receipt on the success
 * path, the Runtime's INTERNAL diagnostic on the failure path. It is never
 * guessed and never derived from the number of endpoint invocations.
 */
function recordProviderAttempts(diagnostic) {
  const value = providerAttemptsFromDiagnostic(diagnostic);
  if (!Number.isInteger(value) || value < 0) return;
  observed.providerOutboundHttpAttempts = value;
  if (value > 0) {
    ledger.record("providerCall", value, { stage: "provider_attempted" });
  }
}

/**
 * The outbound Provider attempt count of a Runtime diagnostic.
 *
 * The Runtime writes a diagnostic SET: the count of the LAST stage is the
 * final count, and the count only ever grows, so the largest value of the
 * set is the count of the run. A single stage diagnostic is accepted too.
 */
function providerAttemptsFromDiagnostic(diagnostic) {
  if (!diagnostic || typeof diagnostic !== "object") return null;
  const stages = Array.isArray(diagnostic.stages) ? diagnostic.stages : [diagnostic];
  let best = null;
  for (const stage of stages) {
    const value = stage?.providerOutboundHttpAttempts;
    if (!Number.isInteger(value) || value < 0) continue;
    best = best === null ? value : Math.max(best, value);
  }
  return best;
}

try {
  // ---- 0. the SEALED SNAPSHOT (GC-B6H-R) --------------------------------
  //
  // The candidate path runs from a sealed snapshot and the snapshot IS the
  // execution root. The check happens BEFORE the grant, BEFORE the Cookie
  // read and BEFORE Chrome: a run without a valid manifest and snapshot
  // root stops here and performs no external action at all.
  const closureBefore = verifyCandidateClosure("pre-external-action");
  if (closureBefore.ok === false) {
    latchClosureFailure("pre-external-action", closureBefore.codes);
    throw new Error(`The execution closure is invalid: ${closureBefore.codes.join(",")}`);
  }
  log("The sealed snapshot verified before the first external action");
  // The execution-root identities: the digests of the trees this source
  // really executed.
  observed.executionRoots = {
    productRootSource: candidateRoots.snapshotRoot ? "snapshot" : "working-tree",
    ...resolveExecutionRootIdentities({
      productRoot,
      runnerFile: fileURLToPath(import.meta.url),
    }),
  };
  // The Stage A observation is DURABLE from the first moment: the receipt
  // always carries the exact structure, even when the run stops before the
  // Stage A phases.
  observed.stageADiagnostic = { ...newStageADiagnostic() };

  // ---- 0z. the DEPENDENCY PARITY (GC-B6J) --------------------------------
  //
  // The snapshot child must consume the SAME product dependencies that the
  // preparation bound. The check happens BEFORE the grant, BEFORE the Cookie
  // read and BEFORE Chrome, and it fails closed with a STABLE code: a
  // missing, changed or mismatched dependency is an external-input block.
  const offlineCaptureHarness = process.env.NAVIA_B5_TEST_NO_BROWSER === "1"
    && Boolean(process.env.NAVIA_B5_TEST_RUNTIME_URL)
    && Boolean(process.env.NAVIA_B5_TEST_DB_PATH)
    && Boolean(process.env.NAVIA_B5_TEST_MEDIA_TASK_ROOT);
  const dependencyVerdict = candidatePathRequired({
    environment: process.env,
    canary: canaryMode,
    offlineHarness: offlineCaptureHarness,
  })
    ? (() => {
      const dependencyProbeRoot = path.join(bvidEvidenceDir, ".dependency-probe");
      try {
        return verifyCandidateDependencies({
          environment: process.env,
          childRoot: path.resolve(here, "../.."),
          dependencyFile: process.env[CANDIDATE_DEPENDENCY_FILE_ENV] || null,
          mode: "identity",
          ownedRoot: dependencyProbeRoot,
        });
      } finally {
        try {
          fs.rmSync(dependencyProbeRoot, { recursive: true, force: true });
        } catch { /* the dependency probe is an owned temporary artifact */ }
      }
    })()
    : { ok: true, codes: [] };
  if (!dependencyVerdict.ok) {
    failureCode = primaryDependencyCode(dependencyVerdict.codes);
    finishReason = `candidate_dependency_invalid: ${dependencyVerdict.codes.join(",")}`;
    throw new Error("The candidate dependency binding is invalid.");
  }

  // ---- 0a. the parent grant ---------------------------------------------
  // The SEQUENCER owns the authorization. This child only VERIFIES the
  // durable grant it was given: a directly invoked run_one_bvid.mjs without
  // a valid parent grant is refused BEFORE the Cookie read and BEFORE
  // Chrome.
  const grant = verifyChildGrant({
    stageRoot,
    grantId: args["grant-id"] || null,
    // The digest the SEQUENCER supplied. It must match the CONSUMPTION
    // MARKER, the grant and the recomputed grant id: a grant is never
    // trusted because of its own, self-computed digest.
    authorizationDigest: args["authorization-digest"] || null,
    runId: args["run-id"] || null,
    registrySha256: ACTIVE_REGISTRY_SHA256,
    order: args.order,
    bvid: args.bvid,
    identities: FROZEN_SIX.map((entry) => ({ order: entry.order, bvid: entry.bvid })),
  });
  if (!grant.ok) {
    finalDisposition = "failed";
    finishReason = `visible_authorization_refused_${grant.reason}`;
    failureCode = "VISIBLE_AUTHORIZATION_REFUSED";
    failureMessage = `The visible run is not authorized: ${grant.reason}.`;
    throw new Error(failureMessage);
  }
  ledger.record("sourceAttempt", 1, { stage: "authorization_granted" });

  // ---- 0b. the owned inputs --------------------------------------------
  // The Cookie file is read here, INSIDE the flow, and only when the visible
  // run is really authorized to read it.
  cookieInspection = externalMilestone("after_chrome", () => inspectCookieFile({
    cookieFile: cookieResolution.path,
  }));
  if (cookieInspection && (!cookieInspection.readable || !cookieInspection.requiredNamesPresent)) {
    finalDisposition = "failed";
    finishReason = `external_input_block_cookie_${cookieInspection.failureCode}`;
    throw new Error(
      `EXTERNAL-INPUT BLOCK: the authorized cookie file is not usable (${cookieInspection.failureCode}). Nothing was launched.`,
    );
  }

  // ---- 1. launch Chrome via launchPersistentContext -------------------
  // T01's connectOverCDP path was unreliable in this WSL environment
  // (Windows chrome.exe + CDP didn't expose the MV3 service worker).
  // We use the same launchPersistentContext pattern as
  // v3-5.1-production-candidate-e2e.mjs (which has been observed running
  // end-to-end here), but inject --mute-audio into the argv.
  //
  // Required argv (verified before any BVID work starts):
  //   --mute-audio, --load-extension=<chrome-mv3-unpacked>,
  //   --disable-extensions-except=<chrome-mv3-unpacked>,
  //   --user-data-dir=<profilePath>,
  //   --disable-features=DisableLoadExtensionCommandLineSwitch,
  //   --enable-unsafe-extension-debugging,
  //   --autoplay-policy=no-user-gesture-required.
  ensure(!process.env.NAVIA_CHROME_MUTE_AUDIO ||
    process.env.NAVIA_CHROME_MUTE_AUDIO !== "0",
    "Runner refusing: NAVIA_CHROME_MUTE_AUDIO=0 would suppress --mute-audio");

  // The pre-granted FIXTURE of the built bundle. The product declares its
  // host permissions and `cookies` as optional, so the product asks for them
  // through a NATIVE prompt that no automation can answer. The canary's
  // frozen promotion is used: the same origins become required and only
  // `cookies` is promoted. The product bundle on disk is never modified.
  const builtFixture = buildPregrantedFixture(extensionRoot, runtimeScratch);
  extensionFixture.fixturePath = builtFixture.fixturePath;
  observed.extensionPermissionMode = "pregranted_test_fixture";
  extensionFixture.originalSha = builtFixture.originalSha;
  extensionFixture.modifiedSha = builtFixture.modifiedSha;
  extensionFixture.merged = builtFixture.merged;
  const extensionManifest = inspectPregrantedManifest(
    path.join(extensionFixture.fixturePath, "manifest.json"),
  );
  ensure(extensionManifest.cookiesRequired === true,
    "The pre-granted fixture must carry the cookies permission as required");
  ensure(extensionManifest.optionalHostPermissions === 0,
    "The pre-granted fixture must not ask for a native host prompt");

  const launchArgs = [
    "--mute-audio",
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    "--enable-unsafe-extension-debugging",
    "--autoplay-policy=no-user-gesture-required",
    `--disable-extensions-except=${extensionFixture.fixturePath}`,
    `--load-extension=${extensionFixture.fixturePath}`,
  ];

  const launchOptions = {
    headless: false,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: launchArgs,
  };
  if (process.env.NAVIA_BROWSER_EXECUTABLE) {
    launchOptions.executablePath = process.env.NAVIA_BROWSER_EXECUTABLE;
  }

  let context = null;
  if (testNoBrowser) {
    // The TEST-ONLY browser double: no browser is launched. The product
    // boundary is the Runtime double below, and the visible controls are
    // stubbed so the runner reaches the synthesis.
    const locator = () => ({
      waitFor: async () => undefined,
      click: async () => undefined,
      isVisible: async () => true,
    });
    const pageDouble = () => ({
      goto: async () => undefined,
      bringToFront: async () => undefined,
      locator,
      frameLocator: () => ({ locator }),
    });
    context = {
      pages: () => [],
      newPage: async () => pageDouble(),
      on: () => undefined,
      close: async () => undefined,
    };
  } else {
    context = await externalMilestone("before_chrome", () => (
      chromium.launchPersistentContext(profilePath, launchOptions)
    ));
  }
  browser = context;
  chromeCleanup = () => (typeof context.close === "function" ? context.close() : undefined);

  if (!testNoBrowser) {
    // The external action happened once Playwright returned a live context.
    // Record it before any subsequent safety assertion can fail.
    ledger.record("chromeLaunch", 1, { stage: "chrome_launched" });
    ledger.record("visibleWindow", 1, { stage: "chrome_launched" });
  }

  // Playwright's persistent-context API does not expose the browser PID on
  // every version. Resolve it by the exact owned profile, with a bounded wait
  // for /proc publication; never select a process by name or path prefix.
  const ownedChrome = testNoBrowser
    ? null
    : await waitForOwnedChromeProcess({ profilePath });
  chromeCmdline = ownedChrome?.cmdline ?? "";
  chromePid = ownedChrome?.pid ?? null;
  if (!testNoBrowser) {
    // The mute flag is verified against the REAL Chrome argv. The test-only
    // browser double launches nothing, so there is no argv to verify.
    ensure(chromeCmdline.includes("--mute-audio"),
      `Chrome process argv lacks --mute-audio: ${chromeCmdline.slice(0, 400)}`);
  }
  if (!testNoBrowser) {
    ensure(chromeCmdline.includes("--load-extension"),
      `Chrome process argv lacks --load-extension: ${chromeCmdline.slice(0, 400)}`);
    ensure(chromeCmdline.includes("--disable-extensions-except"),
      `Chrome process argv lacks --disable-extensions-except: ${chromeCmdline.slice(0, 400)}`);
    ensure(chromeCmdline.includes("--user-data-dir="),
      `Chrome process argv lacks --user-data-dir: ${chromeCmdline.slice(0, 400)}`);
  }

  chromeLaunchLineSha256 = sha256(chromeCmdline);
  muteAudioVerified = testNoBrowser ? false : chromeCmdline.includes("--mute-audio");
  observed.runtimeDatabaseRef = sha256(dbPath);
  observed.chromeProfileRef = sha256(profilePath);
  log(`Chrome launched via launchPersistentContext: pid=${chromePid} profile=${path.basename(profilePath)} mute-audio=verified extension=pregranted-fixture`);

  // ---- 2. extensionWorker ----------------------------------------------
  // The MV3 service worker doesn't activate without an active page event.
  // Open a benign page first (about:blank is enough to trigger registration)
  // then poll for the worker.
  if (!context.pages().length) {
    const bootstrap = await context.newPage();
    await bootstrap.goto("about:blank");
  }
  await wait(1500);
  let extensionId = "0".repeat(32);
  if (!testNoBrowser) {
    const worker = await extensionWorker(context, 30_000);
    extensionId = new URL(worker.url()).host;
  }
  log(`Extension worker: id=${extensionId}`);

  faultAt("after_chrome");

  // ---- 2b. the owned Provider metadata and the cookie -----------------
  // The isolated Provider METADATA comes from the PRODUCT's selected and
  // verified Provider. The secret never leaves the OS credential store: only
  // the metadata row is copied into the owned database.
  let ownedVisionProvider = null;
  try {
    ownedVisionProvider = externalMilestone("after_chrome", () => (
      visionProviderHelper.prepareOwnedVisionProviderMetadata({
        sourceDb: ownedProductPaths.visionProviderSourceDb,
        ownedRoot: runtimeScratch,
      })
    ));
  } catch (providerError) {
    // The PRODUCT refused the input with its own harness error: that is an
    // external-input block and it carries a STABLE code. An injected fault or
    // any other crash is re-thrown unchanged.
    if (!(providerError instanceof productHarnessError)) throw providerError;
    failureCode = CANDIDATE_DEPENDENCY_CODE.MISSING;
    finishReason = "the configured vision Provider dependency is unavailable";
    throw providerError;
  }
  if (ownedVisionProvider) {
    visionProvider.providerId = ownedVisionProvider.providerId;
    visionProvider.dbPath = ownedVisionProvider.dbPath;
    // The isolated Runtime reads the Provider METADATA from the owned copy.
    visionProviderDbPath = ownedVisionProvider.dbPath;
    log(`Owned vision Provider metadata prepared: providerId=${ownedVisionProvider.providerId}`);
  }

  // ---- 3. start isolated runtime companion -----------------------------
  // The extension's Runtime URL is FROZEN at 17861 (src/runtimeClient.ts).
  // The isolated Runtime therefore listens there, and an OCCUPIED port is
  // refused: the runner never reuses, terminates or mutates an existing
  // Runtime.
  if (!testRuntimeUrl) {
    runtimePort = PRODUCT_RUNTIME_PORT;
    ensure(await isPortFree(runtimePort),
      `Port ${runtimePort} already has a Runtime; the runner refuses to reuse or terminate it.`);
  }
  if (testRuntimeUrl) {
    // The TEST-ONLY double: a real HTTP exchange, no media Runtime.
    runtimePort = new URL(testRuntimeUrl).port || "80";
    runtime = { pid: null, testDouble: true };
    await waitForIsolatedRuntime(runtimePort);
    ledger.record("runtimeStart", 1, { stage: "runtime_started" });
  } else {
    runtime = externalMilestone("after_task_creation", () => startIsolatedRuntime(runtimePort, extensionId));
    if (runtime) {
      await waitForIsolatedRuntime(runtimePort);
      ledger.record("runtimeStart", 1, { stage: "runtime_started" });
    }
  }
  log(`Runtime ready on port ${runtimePort} (pid ${runtime.pid})`);

  // The runner's own privileged calls (the outline task and the synthesis)
  // need a COMPANION SESSION, exactly like the extension's calls do. The
  // session is issued by the product for the exact extension origin.
  const sessionRes = await fetch(`http://127.0.0.1:${runtimePort}/v1/companion/sessions`, {
    method: "POST",
    headers: { origin: `chrome-extension://${extensionId}` },
  });
  const sessionJson = await sessionRes.json().catch(() => null);
  const companionToken = sessionJson?.data?.token ?? null;
  ensure(companionToken, "the isolated Runtime issued no companion session");
  const companionHeaders = {
    "content-type": "application/json",
    origin: `chrome-extension://${extensionId}`,
    authorization: `Bearer ${companionToken}`,
  };
  log("Companion session issued for the owned extension origin");

  // ---- 3b. inject the authorized cookie into the OWNED profile ---------
  // The values live in memory only. They are never written to the evidence,
  // a log, a screenshot or a receipt.
  const ownedCookies = externalMilestone("after_chrome", () => (
    realAdapters.readSuppliedCookies(cookieResolution.path)
  ));
  if (ownedCookies && typeof context.addCookies === "function") {
    await context.addCookies(ownedCookies);
    injectedCookieCount.value = ownedCookies.length;
    observed.cookieInjectionCount = ownedCookies.length;
    ledger.record("cookieInjection", ownedCookies.length, { stage: "cookie_injected" });
  }
  log(`Owned profile received ${ownedCookies.length} authorized cookies (values never logged)`);

  // ---- 4. navigate to bilibili and trigger Stage A -------------------
  const page = await context.newPage();
  // The ONE focus event of this source: the runner brings its OWN owned
  // window to the front so the product's visible controls can be driven. It
  // never focuses another window.
  await page.bringToFront();
  observed.focusEventCount = 1;
  observed.focusTargetOwned = true;
  ledger.record("focusEvent", 1, { stage: "owned_window_focused" });
  const targetUrl = `https://www.bilibili.com/video/${args.bvid}`;
  // Capture Runtime HTTP responses so we can detect the auth/resolve/create
  // event chain as the extension posts to /v1/media/acquisitions/*.
  // The redacted Runtime call trace: the PATH and the STATUS only. No header,
  // no body, no value. It explains WHY the product did or did not converge.
  context.on("response", async (response) => {
    const url = response.url();
    const runtimeUrl = /^http:\/\/127\.0\.0\.1:\d+(\/.*)$/.exec(url);
    if (runtimeUrl) {
      runtimeCalls.push({
        at: Date.now(),
        method: response.request().method(),
        path: runtimeUrl[1].split("?")[0],
        status: response.status(),
      });
      if (runtimeCalls.length > 60) runtimeCalls.shift();
    }
    if (url.includes("/v1/media/acquisitions/resolve")) {
      try {
        const body = await response.json();
        resolveResponses.push({ at: Date.now(), status: response.status(), disposition: body?.data?.disposition, authoritativeTaskId: body?.data?.authoritativeTaskId, error: body?.error?.code });
      } catch { /* ignore */ }
    } else if (url.includes("/v1/media/acquisitions/") && response.request().method() === "POST") {
      acquisitionPosts.push({ at: Date.now(), path: new URL(url).pathname });
    } else if (canaryMode && /\/v1\/media\/outline-tasks\/[^/]+\/materialize(-visual)?$/.test(runtimeUrl?.[1] ?? "")) {
      // GC-B6C: the PASSIVE observation of the product's OWN visual
      // materialization calls. Only the route CLASS, the HTTP status and an
      // ALLOWLISTED stable error code are kept. The body is read ONLY to
      // extract that code and it is never stored; no header, no token, no
      // Cookie, no path, no Provider identity and no text is ever kept.
      const routeClass = runtimeUrl[1].endsWith("/materialize-visual") ? "materialize-visual" : "materialize";
      let errorCode = null;
      if (response.status() >= 400) {
        try {
          const body = await response.json();
          errorCode = body?.error?.code ?? null;
        } catch { /* the body is absent: the status alone is recorded */ }
      }
      const recorded = recordVisualObservation({
        method: response.request().method(),
        routeClass,
        status: response.status(),
        errorCode,
      });
      if (recorded.ok) {
        canaryVisualObservations.push(recorded.observation);
      } else {
        canaryObservationCodes.push(recorded.code);
      }
    }
  });
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  log(`Navigated to ${targetUrl}`);

  // The launcher button is the entry point; click it to start acquisition.
  const launcher = page.locator('[data-testid="navia-floating-launcher"]');
  await launcher.waitFor({ timeout: 30_000 });
  await launcher.click();

  // ---- 4a. click media-companion-enable + permission handling ---------
  // After the launcher opens the in-page sidebar (iframe), the user must
  // click "media-companion-enable" to request chrome.permissions for
  // bilibili.com. Without this click + permission grant, no resolve
  // request fires and Stage A never starts. Mirrors the working pattern at
  // `apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs:340-372`.
  let enableClicked = false;
  let permissionDenied = false;
  try {
    const embedded = page.frameLocator('[data-testid="navia-inpage-sidebar-frame"]');
    await embedded.locator("[data-testid='navia-sidepanel-root']").waitFor({ state: "attached", timeout: 30_000 });
    const enable = embedded.locator("[data-testid='media-companion-enable']");
    if (await enable.isVisible().catch(() => false)) {
      await enable.click({ timeout: 5_000 });
      enableClicked = true;
      // chrome.permissions.request fires automatically after the click in
      // the extension; we cannot detect the native prompt directly from
      // the page. If the user denies the prompt, the extension code calls
      // /v1/media/acquisitions/resolve with origin check rejected and the
      // HTTP response will surface here.
      log("media-companion-enable clicked");
    } else {
      log("media-companion-enable not visible; assume permissions pre-granted");
      enableClicked = "implicit";
    }
  } catch (enableError) {
    // The enable-button may be missing if the extension is in a degraded
    // state. Surface this as a runner-state-machine signal, not a fake
    // bilibili block.
    log(`media-companion-enable failed: ${enableError?.message ?? enableError}`);
    permissionDenied = true;
  }

  // ---- 4b. wait for stage A convergence -----------------------------
  // Three-phase signal (closes M-1, M-2, M-3):
  //
  //   phase-1 (authority): poll `media_source_authority` for the resolve
  //     signal. `media_source_authority.state ∈ {active, published}` means
  //     the resolve flow produced a row but is NOT a Stage A terminal
  //     state — `media_tasks` may still be empty.
  //   phase-2 (outline-task): call `POST /v1/media/outline-tasks` to
  //     atomically create a `media_tasks` row. This is required by the
  //     synthesize endpoint's `require_current_authority` check
  //     (`task_store.py:148-159`).
  //   phase-3 (media_tasks): poll `media_tasks` for `state ∈ {ready,
  //     degraded}`. Only this is Stage A complete.
  // The runner's own execution budget. The six v2 sources are real videos of
  // 4.5-31 minutes, so the ASR, the download and the frame extraction need a
  // budget that covers the LONGEST source. It is a runner budget, not a
  // product contract, and it is bounded.
  const STAGE_A_AUTHORITY_DEADLINE_MS = STAGE_A_BUDGETS.authorityDeadlineMs;
  const STAGE_A_DEADLINE_MS = STAGE_A_BUDGETS.mediaTaskDeadlineMs;

  // GC-B6H H4: the Stage A codes, the budgets and the privacy-safe
  // observation come from the ONE owner (lib/stage_a_diagnostics.mjs).
  const stageADiagnostic = newStageADiagnostic({
    enableState: enableClicked ? "clicked" : (permissionDenied ? "failed" : "not-attempted"),
    permissionState: permissionDenied ? "denied" : (enableClicked ? "granted" : "unknown"),
  });
  observed.stageADiagnostic = { ...stageADiagnostic };

  async function pollAuthorityForBvid() {
    const deadline = Date.now() + STAGE_A_AUTHORITY_DEADLINE_MS;
    const startedAt = Date.now();
    let attempt = 0;
    let rowCount = 0;
    let exactMatchCount = 0;
    while (Date.now() < deadline) {
      attempt += 1;
      stageADiagnostic.authorityPollCount = attempt;
      let rows = [];
      try {
        rows = JSON.parse(execFileSync("sqlite3", ["-json", dbPath,
          `SELECT task_id,source_identity,state,consent_policy_id FROM media_source_authority ORDER BY updated_at DESC LIMIT 5`,
        ], { encoding: "utf8" }) || "[]");
      } catch (pollError) {
        log(`sqlite authority poll error (transient): ${pollError?.message ?? pollError}`);
        await wait(3000);
        continue;
      }
      rowCount = Array.isArray(rows) ? rows.length : 0;
      stageADiagnostic.authorityRowCount = rowCount;
      // GC-B6H H4: the identity is matched by its PARSED components.
      const live = rows.find((row) => matchesFrozenIdentity(row.source_identity, { bvid: args.bvid, portalId: FROZEN_PORTAL_ID }));
      if (live) {
        exactMatchCount += 1;
        stageADiagnostic.exactIdentityMatchCount = exactMatchCount;
        stageADiagnostic.authorityStateClass = stateClass(live.state);
        stageADiagnostic.elapsedBucket = elapsedBucket(Date.now() - startedAt);
        observed.stageADiagnostic = { ...stageADiagnostic };
        if (AUTHORITY_PENDING_STATES.includes(live.state)) {
          return { phase: "authority-pending", taskId: live.task_id, sourceIdentity: live.source_identity, state: live.state };
        }
        if (AUTHORITY_BLOCKED_STATES.includes(live.state)) {
          return { phase: "authority-blocked", taskId: live.task_id, sourceIdentity: live.source_identity, state: live.state };
        }
        return { phase: "authority-other", taskId: live.task_id, sourceIdentity: live.source_identity, state: live.state };
      }
      // Resolve-responses collected as backup: if the extension HTTP path
      // fires before the SQLite row is observable, surface the response.
      const blockedResponse = resolveResponses.find((row) =>
        row.disposition === "blocked" || (row.error && row.error.startsWith("V3510B_BVID"))
      );
      if (blockedResponse) {
        stageADiagnostic.resolveStatusClass = statusClass(blockedResponse.status);
        stageADiagnostic.elapsedBucket = elapsedBucket(Date.now() - startedAt);
        observed.stageADiagnostic = { ...stageADiagnostic };
        return { phase: "authority-blocked-response", error: blockedResponse.error };
      }
      if (attempt % 10 === 0) {
        log(`authority poll attempt ${attempt} for bvid=${args.bvid}; no row yet`);
      }
      await wait(3000);
    }
    stageADiagnostic.elapsedBucket = elapsedBucket(Date.now() - startedAt);
    observed.stageADiagnostic = { ...stageADiagnostic };
    return { phase: "timeout" };
  }

  async function postOutlineTasks(sourceIdentity) {
    const url = `http://127.0.0.1:${runtimePort}/v1/media/outline-tasks`;
    const response = await externalMilestone("after_task_creation", () => fetch(url, {
      method: "POST",
      headers: companionHeaders,
      body: JSON.stringify({ sourceIdentity }),
    }));
    if (!response) {
      throw new Error("The task creation milestone was not performed.");
    }
    if (response.status !== 201) {
      const body = await response.text().catch(() => "");
      throw new Error(`outline-task POST failed: HTTP ${response.status} body=${body.slice(0, 500)}`);
    }
    const json = await response.json();
    const taskId = json?.data?.task?.task_id || json?.data?.task?.taskId;
    if (!taskId || !/^media_task_[0-9a-f]{32}$/.test(taskId)) {
      throw new Error(`outline-task POST returned malformed task_id: ${taskId}`);
    }
    return { taskId, revision: json?.data?.task?.revision ?? 1, sourceIdentity };
  }

  async function pollMediaTasksForReady(taskId) {
    const deadline = Date.now() + STAGE_A_DEADLINE_MS;
    const startedAt = Date.now();
    let attempt = 0;
    while (Date.now() < deadline) {
      attempt += 1;
      stageADiagnostic.mediaTaskPollCount = attempt;
      let rows = [];
      try {
        rows = JSON.parse(execFileSync("sqlite3", ["-json", dbPath,
          `SELECT task_id,state,revision FROM media_tasks WHERE task_id='${taskId}'`,
        ], { encoding: "utf8" }) || "[]");
      } catch (pollError) {
        log(`sqlite media_tasks poll error (transient): ${pollError?.message ?? pollError}`);
        await wait(3000);
        continue;
      }
      stageADiagnostic.mediaTaskRowCount = Array.isArray(rows) ? rows.length : 0;
      const row = rows[0];
      if (row) {
        stageADiagnostic.mediaTaskStateClass = stateClass(row.state);
        stageADiagnostic.elapsedBucket = elapsedBucket(Date.now() - startedAt);
        observed.stageADiagnostic = { ...stageADiagnostic };
        if (MEDIA_TASK_TERMINAL_STATES.includes(row.state)) {
          return { phase: "ready", taskId: row.task_id, revision: row.revision, state: row.state };
        }
        if (MEDIA_TASK_BLOCKED_STATES.includes(row.state)) {
          return { phase: "blocked", taskId: row.task_id, state: row.state };
        }
      }
      if (attempt % 10 === 0) {
        log(`media_tasks poll attempt ${attempt} for taskId=${taskId}; no terminal state yet`);
      }
      await wait(3000);
    }
    stageADiagnostic.elapsedBucket = elapsedBucket(Date.now() - startedAt);
    observed.stageADiagnostic = { ...stageADiagnostic };
    return { phase: "timeout", taskId };
  }

  // Phase 1: wait for resolve to produce an authority row.
  const authorityResult = await pollAuthorityForBvid();
  log(`Stage A authority phase: ${JSON.stringify(authorityResult)}`);

  if (typeof authorityResult.sourceIdentity === "string") {
    observed.sourceIdentity = authorityResult.sourceIdentity;
  }

  if (authorityResult.phase === "timeout") {
    finalDisposition = "blocked";
    failureCode = STAGE_A_CODE.AUTHORITY_TIMEOUT;
    stageADiagnostic.code = STAGE_A_CODE.AUTHORITY_TIMEOUT;
    stageADiagnostic.phase = "authority-timeout";
    observed.stageADiagnostic = { ...stageADiagnostic };
    // The prose is DERIVED from the constant: it can never drift from the
    // budget that produced it.
    finishReason = `stage_a_authority_timeout_for_bvid_${args.bvid}: no media_source_authority row after ${timeoutText(STAGE_A_AUTHORITY_DEADLINE_MS)} (enable_state=${stageADiagnostic.enableState}; permission_state=${stageADiagnostic.permissionState})`;
    throw new Error(`Stage A authority did not converge within ${timeoutText(STAGE_A_AUTHORITY_DEADLINE_MS)}`);
  }
  if (authorityResult.phase === "authority-blocked" || authorityResult.phase === "authority-blocked-response") {
    finalDisposition = "blocked";
    failureCode = STAGE_A_CODE.AUTHORITY_BLOCKED;
    stageADiagnostic.code = STAGE_A_CODE.AUTHORITY_BLOCKED;
    stageADiagnostic.phase = "authority-blocked";
    observed.stageADiagnostic = { ...stageADiagnostic };
    finishReason = `stage_a_authority_blocked_for_bvid_${args.bvid}: state_class=${stageADiagnostic.authorityStateClass}`;
    throw new Error(`Stage A blocked at the authority phase (${stageADiagnostic.authorityStateClass})`);
  }
  if (authorityResult.phase !== "authority-pending") {
    finalDisposition = "failed";
    failureCode = STAGE_A_CODE.AUTHORITY_UNEXPECTED;
    stageADiagnostic.code = STAGE_A_CODE.AUTHORITY_UNEXPECTED;
    stageADiagnostic.phase = "authority-unexpected";
    observed.stageADiagnostic = { ...stageADiagnostic };
    finishReason = `stage_a_authority_unexpected_for_bvid_${args.bvid}: phase=${authorityResult.phase} state_class=${stageADiagnostic.authorityStateClass}`;
    throw new Error(`Stage A unexpected authority phase: ${authorityResult.phase}`);
  }

  // Phase 2: atomically create media_tasks row via outline-tasks POST.
  let outlineTask;
  try {
    outlineTask = await postOutlineTasks(authorityResult.sourceIdentity);
    log(`outline-task created: taskId=${outlineTask.taskId} revision=${outlineTask.revision}`);
    observed.taskId = outlineTask.taskId;
    observed.taskRevision = outlineTask.revision;
    observed.sourceIdentity = outlineTask.sourceIdentity;
    ledger.record("mediaTask", 1, { stage: "task_created" });
  } catch (outlineError) {
    finalDisposition = "failed";
    failureCode = STAGE_A_CODE.OUTLINE_CREATE_FAILED;
    stageADiagnostic.code = STAGE_A_CODE.OUTLINE_CREATE_FAILED;
    stageADiagnostic.phase = "outline-create-failed";
    observed.stageADiagnostic = { ...stageADiagnostic };
    finishReason = `stage_a_outline_task_failed_for_bvid_${args.bvid}: ${outlineError?.message ?? outlineError}`;
    throw new Error(`outline-task POST failed: ${outlineError?.message ?? outlineError}`);
  }

  // Phase 3: wait for media_tasks to reach ready/degraded.
  const mediaTaskResult = await pollMediaTasksForReady(outlineTask.taskId);
  log(`Stage A media_tasks phase: ${JSON.stringify(mediaTaskResult)}`);

  if (mediaTaskResult.phase === "timeout") {
    finalDisposition = "blocked";
    failureCode = STAGE_A_CODE.MEDIA_TASK_TIMEOUT;
    stageADiagnostic.code = STAGE_A_CODE.MEDIA_TASK_TIMEOUT;
    stageADiagnostic.phase = "media-task-timeout";
    observed.stageADiagnostic = { ...stageADiagnostic };
    // The prose is DERIVED from the constant.
    finishReason = `stage_a_media_tasks_timeout_for_bvid_${args.bvid}: no ready/degraded media_tasks row within ${timeoutText(STAGE_A_DEADLINE_MS)}`;
    throw new Error(`Stage A media_tasks did not reach ready/degraded within ${timeoutText(STAGE_A_DEADLINE_MS)}`);
  }
  if (mediaTaskResult.phase === "blocked") {
    finalDisposition = "blocked";
    failureCode = STAGE_A_CODE.MEDIA_TASK_BLOCKED;
    stageADiagnostic.code = STAGE_A_CODE.MEDIA_TASK_BLOCKED;
    stageADiagnostic.phase = "media-task-blocked";
    observed.stageADiagnostic = { ...stageADiagnostic };
    finishReason = `stage_a_media_tasks_blocked_for_bvid_${args.bvid}: state_class=${stageADiagnostic.mediaTaskStateClass}`;
    throw new Error(`Stage A blocked at the media_tasks phase (${stageADiagnostic.mediaTaskStateClass})`);
  }

  // Convergence result: real taskId + revision from media_tasks row.
  const convergence = {
    taskId: mediaTaskResult.taskId,
    revision: mediaTaskResult.revision,
    sourceIdentity: authorityResult.sourceIdentity,
  };
  log(`Stage A converged: ${JSON.stringify(convergence)}`);

  observed.taskId = convergence.taskId;
  observed.taskRevision = convergence.revision;
  observed.sourceIdentity = convergence.sourceIdentity;

  faultAt("after_task_creation");

  // ---- 5. trigger Stage B synthesize -----------------------------------
  // Use the runtime API. Auth via x-origin header to satisfy runtime's
  // browser-extension origin guard.
  //
  // The synthesize endpoint (`app.py:1428-1456`) calls
  // `media_outline_task_store.require_current_authority(task_id)`; the
  // outline-task POST above guarantees that `media_tasks` has a row at
  // this point. expectedRevision comes from the live `media_tasks.revision`
  // column (M-3 closed).
  const synthesizeTaskId = convergence.taskId;
  const synthesizeBody = JSON.stringify({
    expectedRevision: convergence.revision,
    consent: true,
    style: "structured",
  });
  // The Provider attempt is recorded AT THE BOUNDARY: a rejected synthesis
  // is an attempt, and it must never be counted only after a publication.
  // The Runtime synthesize ENDPOINT invocation. It is NOT the number of
  // outbound Provider HTTP attempts: the Runtime may retry, regenerate or
  // reject, and the actual number of attempts is reported by the Runtime
  // itself (the published receipt or its internal diagnostic).
  observed.runtimeSynthesizeCount = (observed.runtimeSynthesizeCount ?? 0) + 1;
  ledger.record("runtimeSynthesize", 1, { stage: "synthesis_invoked" });
  const synthesizeRes = await externalMilestone("provider_rejection", () => fetch(
    `http://127.0.0.1:${runtimePort}/v1/media/tasks/${synthesizeTaskId}/comprehension/synthesize`,
    {
      method: "POST",
      headers: companionHeaders,
      body: synthesizeBody,
    },
  ));
  faultAt("provider_rejection");
  if (!synthesizeRes) {
    throw new Error("The synthesis milestone was not performed.");
  }
  if (!synthesizeRes.ok) {
    const errBody = await synthesizeRes.text().catch(() => "");
    // The response BODY is never stored. Only an allowlisted frozen code and
    // the HTTP status may be recorded.
    const classified = classifyRuntimeFailure(synthesizeRes.status, errBody);
    runtimeFailureCode = classified.failureCode;
    runtimeFailureStatus = classified.httpStatus;
    // The Runtime's INTERNAL diagnostic owns the ACTUAL number of outbound
    // Provider HTTP attempts. The runner never guesses one attempt per
    // endpoint invocation.
    recordProviderAttempts(readChapterDiagnostic());
    throw new Error(
      `Stage B synthesize rejected: HTTP ${synthesizeRes.status}`
      + (classified.failureCode ? ` code=${classified.failureCode}` : " code=unclassified"),
    );
  }
  const synthesizeJson = await synthesizeRes.json();
  const projection = synthesizeJson?.data?.projection;
  ensure(projection, "Stage B synthesize returned no projection");
  // The projection does NOT carry the receipt: the authoritative receipt is
  // the one inside the PUBLISHED V2.1 derivative. It is validated below, once
  // the derivative has been read from disk.

  // ---- 7. find V2.1 derivative on disk ---------------------------------
  const derivativePaths = [];
  const v2Root = path.join(mediaTaskRoot, "product-evidence", "grounded-comprehension-v2.1", synthesizeTaskId);
  if (fs.existsSync(v2Root)) {
    for (const entry of fs.readdirSync(v2Root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const revDir = path.join(v2Root, entry.name);
      for (const f of fs.readdirSync(revDir)) {
        if (f.endsWith(".json")) derivativePaths.push(path.join(revDir, f));
      }
    }
  }
  ensure(derivativePaths.length >= 1, `V2.1 derivative not found under ${v2Root}`);
  const derivativePath = derivativePaths[0];
  const derivativeBytes = fs.readFileSync(derivativePath);
  const derivative = JSON.parse(derivativeBytes.toString("utf8"));
  ensure(derivative.schemaVersion === "v3-media-grounded-comprehension/v2.1",
    `V2.1 derivative has wrong schema: ${derivative.schemaVersion}`);

  // ---- 6b. the authoritative V2.1 receipt ------------------------------
  // The receipt lives in the published derivative. Its field names are the
  // frozen V2.1 schema's names.
  const receipt = derivative.receipt ?? null;
  ensure(receipt, "The published V2.1 derivative carries no receipt");
  const requiredReceiptFields = [
    "providerId", "modelId", "outboundDerivedTextSha256", "requestCount",
    "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
    "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount",
    "endpointClass", "structureMode", "attemptId", "latencyMs",
    "requestSha256", "responseSha256", "finishReason",
  ];
  const missingReceipt = requiredReceiptFields.filter((k) => !(k in receipt));
  ensure(missingReceipt.length === 0, `Receipt missing fields: ${missingReceipt.join(",")}`);
  // GC-B5R O05: the task holds exactly ONE Provider. Zero Providers and two
  // Providers are both refusals, and a Provider outside the lock is refused.
  const providerOffenders = providerLockOffenders(receipt);
  ensure(providerOffenders.length === 0,
    `Provider lock violation: ${providerOffenders.join(",")}`);
  for (const [counter, expected] of Object.entries(UPLOAD_COUNTER_HARD_ZERO)) {
    ensure(receipt[counter] === expected, `Upload counter non-zero: ${counter}=${receipt[counter]}`);
  }

  // The disposition is the FROZEN quality status of the published derivative.
  const qualityStatus = derivative.quality?.status ?? null;
  // The PRODUCTION mapping is the single rule: the runner and the aggregate
  // share it.
  finalDisposition = dispositionForQualityStatus(qualityStatus) ?? "failed";
  finishReason = `final=${finalDisposition}; quality=${qualityStatus}; derivativeSha=${sha256(derivativeBytes).slice(0, 16)}`;

  // ---- 6b. the machine observations ------------------------------------
  // The route and the dependency generation are PRODUCT facts. They are read
  // from the product's own status routes, never invented here.
  observed.taskId = synthesizeTaskId;
  observed.taskRevision = convergence.revision;
  observed.sourceIdentity = convergence.sourceIdentity;
  observed.providerId = receipt.providerId;
  observed.endpointClass = receipt.endpointClass;
  // The published receipt owns the ACTUAL number of outbound Provider HTTP
  // attempts of this synthesis (the extraction, the candidate, the
  // regenerations and the retries are all counted).
  recordProviderAttempts({ providerOutboundHttpAttempts: receipt.requestCount });
  observed.uploadCounters = {
    rawVideoUploadCount: receipt.rawVideoUploadCount,
    rawAudioUploadCount: receipt.rawAudioUploadCount,
    frameByteUploadCount: receipt.frameByteUploadCount,
    cookieUploadCount: receipt.cookieUploadCount,
    apiKeyDisclosureCount: receipt.apiKeyDisclosureCount,
    localPathUploadCount: receipt.localPathUploadCount,
  };
  observed.derivativeSha256 = sha256(derivativeBytes);
  // tabCapture is deferred and default-off. The count is derived from the
  // PRODUCT's own route, never assumed.
  observed.tabCaptureCount = observed.route === "trusted_tab_capture_asr" ? 1 : 0;
  try {
    const transcriptRes = await fetch(
      `http://127.0.0.1:${runtimePort}/v1/media/transcripts/${synthesizeTaskId}`,
      { headers: { origin: `chrome-extension://${extensionId}` } },
    );
    if (transcriptRes.ok) {
      const transcriptJson = await transcriptRes.json();
      observed.route = transcriptJson?.data?.task?.route ?? null;
    }
  } catch { /* the route stays null: the receipt records the absence */ }
  try {
    const sessionRes = await fetch(`http://127.0.0.1:${runtimePort}/v1/companion/sessions`, {
      method: "POST",
      headers: { origin: `chrome-extension://${extensionId}` },
    });
    if (sessionRes.ok) {
      const sessionJson = await sessionRes.json();
      const token = sessionJson?.data?.token;
      if (token) {
        const depsRes = await fetch(`http://127.0.0.1:${runtimePort}/v1/media/dependencies`, {
          headers: {
            origin: `chrome-extension://${extensionId}`,
            authorization: `Bearer ${token}`,
          },
        });
        if (depsRes.ok) {
          const depsJson = await depsRes.json();
          observed.dependencyGeneration = depsJson?.data?.generation ?? null;
        }
      }
    }
  } catch { /* the generation stays null: the receipt records the absence */ }

  // ---- 8. publish the facts and the audit set --------------------------
  // The receipt hash uses the PRODUCTION canonical serialization, so the
  // aggregate can recompute it from the artifact bytes.
  observed.receiptSha256 = sha256(canonicalJson(receipt));
  observed.evidenceSha256 = sha256(derivativeBytes);
  publishedReceipt = receipt;
  publishedDerivative = derivative;
  publishedDerivativeBytes = derivativeBytes;
  if (artifactPrivacyViolation) {
    throw new Error("The published artifact carries an absolute path; the source fails closed.");
  }

  // ---- 8b. the B-6 REVIEW CAPTURE (acceptance harness only) -----------
  // The capture happens AFTER the durable V2.1 publication has been
  // validated and BEFORE the runner owner cleanup, so the captured evidence
  // is provably the evidence the machine gate saw.
  //
  // It is OPTIONAL: without an explicit private root no capture happens and
  // the B-5 behaviour is unchanged. A capture FAILURE fails the candidate
  // closed, and the owner cleanup in the finally path still runs.
  const b6PrivateRoot = process.env.NAVIA_B6_PRIVATE_ROOT || null;
  if (b6PrivateRoot) {
    const capture = await captureFromRuntime({
      runtimePort,
      companionHeaders,
      taskId: synthesizeTaskId,
      artifactBytes: derivativeBytes,
      source: {
        order: String(args.order),
        bvid: args.bvid,
        taskId: synthesizeTaskId,
        taskRevision: convergence.revision,
        sourceIdentity: convergence.sourceIdentity,
        dependencyGeneration: observed.dependencyGeneration,
        registrySha256: ACTIVE_REGISTRY_SHA256,
      },
      privateEvidenceRoot: path.join(mediaTaskRoot, "product-evidence"),
      privateRootDirectory: b6PrivateRoot,
    });
    // The PUBLIC marker of the capture: the hashes, the counts, the status
    // and the closure ONLY. It never carries a text, a byte or a path.
    observed.reviewCapture = capture.receipt ?? {
      schemaVersion: CAPTURE_RECEIPT_SCHEMA,
      counts: { evidence: 0, thumbnails: 0, chapters: 0 },
      digests: {
        artifactSha256: null,
        evidenceCatalogSha256: null,
        bundleSha256: null,
        reviewBindingSha256: null,
      },
      closure: {
        identityClosed: false,
        catalogClosed: false,
        thumbnailsClosed: false,
        seekClosed: false,
      },
      status: "failed",
    };
    observed.reviewCaptureFailureCodes = capture.ok
      ? []
      : [...new Set(capture.diagnosticCodes ?? [capture.code].filter(Boolean))].sort();
    if (!capture.ok) {
      const decision = captureGateDecision({ captureRequested: true, capture });
      failureCode = decision.failureCode;
      if (canaryMode) {
        // The canary is a DIAGNOSTIC: a capture refusal is a BLOCKED
        // diagnostic outcome, not a crash of the owner. The source did not
        // close, so the disposition is failed and the completion accounting
        // stays zero. The observations are still collected and the owner
        // cleanup still runs.
        finalDisposition = "failed";
        finishReason = `order2_diagnostic_capture_refused_${decision.failureCode}`;
      } else {
        throw new Error(`The review capture failed: ${capture.code}.`);
      }
    } else {
      log(`BVID ${args.bvid} review capture closed`);
    }
  }

  // ---- 8c. the ORDER-2 DIAGNOSTIC CANARY observations ------------------
  //
  // The canary observes the product's NORMAL calls passively and reads the
  // AUTHENTICATED public routes of the owned Runtime. It records COUNTS, a
  // STATE and STABLE CODES: never a body, a header, a token, a Cookie, a
  // path, the Provider identity or any text.
  //
  // The PNG is confirmed through the AUTHENTICATED thumbnail route and the
  // STRICT PNG validation: a frame ROW is never the proof of a PNG.
  if (canaryMode) {
    const kindCounts = { transcript: 0, frame: 0, ocr_block: 0, vision_caption: 0 };
    const frameEvidenceIds = [];
    let taskState = null;
    let terminalFailureCode = null;
    let pngConfirmedFrameCount = 0;
    const pngFailureCodes = [];
    try {
      const taskRes = await fetch(
        `http://127.0.0.1:${runtimePort}/v1/media/outline-tasks/${synthesizeTaskId}`,
        { headers: companionHeaders },
      );
      const taskJson = taskRes.ok ? await taskRes.json().catch(() => null) : null;
      taskState = taskJson?.data?.task?.state ?? null;
      const terminalCode = sanitizeObservedErrorCode(taskJson?.data?.task?.terminalFailureCode ?? null);
      terminalFailureCode = terminalCode.errorCode;
      if (terminalCode.refusalCode) canaryObservationCodes.push(terminalCode.refusalCode);
    } catch { /* the state stays null: the canary records the absence */ }
    try {
      const workspaceRes = await fetch(
        `http://127.0.0.1:${runtimePort}/v1/media/tasks/${synthesizeTaskId}/comprehension`,
        { headers: companionHeaders },
      );
      const workspaceJson = workspaceRes.ok ? await workspaceRes.json().catch(() => null) : null;
      for (const item of workspaceJson?.data?.projection?.evidenceCatalog ?? []) {
        const kind = String(item?.kind ?? "");
        if (Object.prototype.hasOwnProperty.call(kindCounts, kind)) kindCounts[kind] += 1;
        if (kind === "frame") frameEvidenceIds.push(String(item?.evidenceId ?? ""));
      }
    } catch { /* the counts stay zero: the canary records the absence */ }
    for (const evidenceId of frameEvidenceIds) {
      try {
        const thumbRes = await fetch(
          `http://127.0.0.1:${runtimePort}/v1/media/tasks/${synthesizeTaskId}/evidence/${evidenceId}/thumbnail`,
          { headers: companionHeaders },
        );
        if (!thumbRes.ok) {
          pngFailureCodes.push("CANARY_PNG_ROUTE_ERROR");
          continue;
        }
        const bytes = Buffer.from(await thumbRes.arrayBuffer());
        if (!isStrictPng(bytes)) {
          pngFailureCodes.push("CANARY_PNG_INVALID");
          continue;
        }
        pngConfirmedFrameCount += 1;
      } catch {
        pngFailureCodes.push("CANARY_PNG_ROUTE_ERROR");
      }
    }
    canaryObservations = {
      schemaVersion: ORDER2_OBSERVATIONS_SCHEMA,
      registryOrder: String(args.order),
      bvid: args.bvid,
      runId: args["run-id"] ?? null,
      taskId: synthesizeTaskId,
      visualObservations: canaryVisualObservations,
      observationCodes: [...new Set(canaryObservationCodes)].sort(),
      taskState,
      terminalFailureCode,
      evidenceKindCounts: kindCounts,
      pngConfirmedFrameCount,
      pngFailureCodes: [...new Set(pngFailureCodes)].sort(),
      capture: {
        status: observed.reviewCapture?.status ?? "failed",
        failureCodes: observed.reviewCaptureFailureCodes ?? [],
        counts: observed.reviewCapture?.counts ?? { evidence: 0, thumbnails: 0, chapters: 0 },
      },
      cleanup: { runtimeScratchDeleted: false, profileRootDeleted: false, cleanupFailure: null },
      ownedLeakSightings: null,
      // The AUTHORITATIVE action accounting is the stage action ledger: the
      // same owner the candidate run uses. Nothing here is guessed.
      actionCounters: canaryActionCounters(),
      uploadCounters: observed.uploadCounters ?? {},
    };
  }

  // ---- 8c. the SOURCE COMPLETION accounting ---------------------------
  // The `sourceCompletion` accounting is recorded AFTER the review capture:
  // a capture failure must never leave a completed-source accounting behind.
  // The audit set is written after it as well, so the durable machine
  // receipt may never be interpretable as a COMPLETE source before the
  // capture closed.
  //
  // GC-B6C: the ORDER-2 DIAGNOSTIC CANARY is NOT a candidate. It never
  // records a source completion, so a diagnostic run can never be counted
  // as a completed candidate source.
  if (!canaryMode) {
    ledger.record("sourceCompletion", 1, { stage: "synthesis_published" });
  }
  finalizeAuditEvidence();
  log(`BVID ${args.bvid} completed with disposition=${finalDisposition}`);

} catch (error) {
  const disposition = finalDisposition === "blocked" ? "blocked" : "failed";
  if (finalDisposition !== "blocked") {
    finalDisposition = disposition;
    // An already-assigned finish reason is NEVER erased: the refusal reasons
    // of the runner are set BEFORE the throw and they must survive the catch.
    if (!finishReason) {
      finishReason = error instanceof Error ? error.message.slice(0, 500) : String(error);
    }
  }
  // The failure keeps the allowlisted frozen code of the structured Runtime
  // response and NEVER stores the response body.
  // An already-assigned failure code is NEVER erased: the refusal codes of
  // the runner (for example the authorization refusal) are set BEFORE the
  // throw and they must survive the catch.
  // The terminal code is ALWAYS a stable, allowlisted code. An exception
  // name is never a final code: the detail stays in the private failure
  // diagnostic and the public projection carries the stable code only.
  failureCode = runtimeFailureCode
    ?? failureCode
    ?? (error instanceof Error && /^V(?:3510B|352)_[A-Z0-9_]+$/.test(error.message)
      ? error.message.match(/^V(?:3510B|352)_[A-Z0-9_]+/)[0]
      : "B6_RUNNER_UNEXPECTED_FAILURE");
  // A DEPENDENCY refusal never carries the exception text, the database
  // name, the path or any other product detail: it carries its stable code
  // and a fixed phrase.
  const dependencyRefusal = typeof failureCode === "string"
    && failureCode.startsWith("B6_DEPENDENCY_");
  failureMessage = dependencyRefusal
    ? "the candidate dependency is unavailable"
    : redactAbsolutePaths(
      error instanceof Error ? error.message.slice(0, 2000) : String(error),
    );
  if (canaryMode) {
    // A normal owner failure is itself a diagnostic fact. Latch it before
    // finally builds the minimal observation so an early failure can never
    // disappear as OBSERVATIONS_MISSING or be interpreted as READY.
    canaryObservationCodes.push(CANARY_CODE.OWNER_FAILED);
  }
  // The redacted chapter diagnostic the Runtime produced, when there is one.
  observed.chapterDiagnostic = readChapterDiagnostic();
  writeEvidenceJson("failure-diagnostic.json", {
    schemaVersion: "v3-5.10-b5-3-failure/v2",
    bvid: args.bvid, order: args.order,
    finalDisposition, finishReason,
    failureCode,
    error: error instanceof Error ? {
      name: dependencyRefusal ? "DependencyRefusal" : error.name,
      message: failureMessage,
      stack: dependencyRefusal
        ? "the candidate dependency is unavailable"
        : redactAbsolutePaths(error.stack?.slice(0, 4000) ?? ""),
    } : redactAbsolutePaths(String(error)),
    runtimeFailureStatus,
    // The redacted resolve observations: the status and the failure code
    // only. No URL, no header, no body, no value.
    resolveObservations: resolveResponses.slice(0, 10),
    // The redacted Runtime call trace.
    runtimeCalls: runtimeCalls.slice(-40),
    startedAtUtc, finishedAtUtc: new Date().toISOString(),
  });
  // The SAME audit set as the success path: a failure never loses the
  // evidence of what DID happen.
  try {
    finalizeAuditEvidence();
  } catch (finalizeError) {
    log(`finalizer error (ignored): ${finalizeError?.message ?? finalizeError}`);
  }
  log(`BVID ${args.bvid} FAILED: ${error instanceof Error ? error.message : String(error)}`);
  // M-5: explicit non-zero exit so the sequencer can detect failure.
  // `blocked` is a runner-state-machine disposition that signals "BVID
  // access path did not converge in 7 minutes", NOT a runtime crash.
  if (finalDisposition !== "blocked") {
    process.exitCode = 1;
  }
  // Don't rethrow — the sequencer collects per-BVID dispositions.
} finally {
  // Cleanup regardless of outcome. An injected cleanup fault is CAUGHT: the
  // cleanup continues and the finalizer still writes the audit set.
  try {
    faultAt("during_cleanup");
  } catch (cleanupFault) {
    cleanupFailure = String(cleanupFault?.message ?? cleanupFault);
    log(`injected cleanup fault: ${cleanupFailure}`);
  }
  try {
    if (chromeCleanup) await chromeCleanup();
  } catch (cleanupError) {
    log(`Chrome cleanup error (ignored): ${cleanupError?.message ?? cleanupError}`);
  }
  try {
    if (runtime && runtime.exitCode === null) {
      runtime.kill("SIGINT");
      await Promise.race([new Promise((r) => runtime.once("exit", r)), wait(4000)]);
      if (runtime.exitCode === null) runtime.kill("SIGKILL");
    }
  } catch (cleanupError) {
    log(`Runtime cleanup error (ignored): ${cleanupError?.message ?? cleanupError}`);
  }
  // Wipe per-BVID scratch (sqlite/profile/tmp) on exit.
  for (const dir of [runtimeScratch, profileRoot]) {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
    catch (cleanupError) { log(`scratch rm failed ${dir}: ${cleanupError?.message ?? cleanupError}`); }
  }
  cleanupFacts = {
    runtimeScratchDeleted: !fs.existsSync(runtimeScratch),
    profileRootDeleted: !fs.existsSync(profileRoot),
    cleanupFailure,
  };
  // GC-B6C: the ORDER-2 DIAGNOSTIC CANARY observations are written HERE, in
  // the finally path, so the OWNER cleanup facts are part of them. The file
  // carries counts, a state and stable codes ONLY: never a body, a header, a
  // token, a Cookie, a path, the Provider identity or any text.
  if (canaryMode) {
    try {
      if (!canaryObservations) canaryObservations = minimalCanaryObservations();
      canaryObservations.observationCodes = [...new Set([
        ...(canaryObservations.observationCodes ?? []),
        ...canaryObservationCodes,
      ])].sort();
      canaryObservations.actionCounters = canaryActionCounters();
      canaryObservations.uploadCounters = { ...observed.uploadCounters };
      canaryObservations.cleanup = { ...cleanupFacts };
      writeEvidenceJson("order2-diagnostic-observations.json", canaryObservations);
    } catch (observationError) {
      log(`canary observation write error (ignored): ${observationError?.message ?? observationError}`);
    }
  }
  // GC-B6H-R: the SEALED SNAPSHOT is verified AGAIN after the owner
  // cleanup, so a byte that changed DURING the source is a defect of the
  // candidate. The failure is LATCHED: restoring the bytes afterwards never
  // clears it.
  try {
    const mutated = mutateSnapshotForTest();
    if (mutated) {
      log("the offline suite changed one byte of the sealed snapshot before the post-source verification");
    }
    const closureAfter = verifyCandidateClosure("post-source");
    if (closureAfter.ok === false) {
      latchClosureFailure("post-source", closureAfter.codes);
      log(`the execution closure is invalid after the source: ${closureAfter.codes.join(",")}`);
    }
  } catch (closureError) {
    log(`closure verification error (ignored): ${closureError?.message ?? closureError}`);
  }
  // The finalizer runs ONCE more in the finally path. It is idempotent: it
  // merges the facts and never overwrites a stronger durable fact with null.
  try {
    finalizeAuditEvidence();
  } catch (finalizeError) {
    log(`finalizer error (ignored): ${finalizeError?.message ?? finalizeError}`);
  }
  // The durable stage ledger is finalized here.
  try {
    ledger.finalize();
  } catch { /* the ledger is a record, never a gate */ }
}

function writeText(target, text) {
  fs.writeFileSync(target, text, { mode: 0o600 });
}

process.stdout.write(`${JSON.stringify({ bvid: args.bvid, order: args.order, finalDisposition, finishReason }, null, 2)}\n`);
