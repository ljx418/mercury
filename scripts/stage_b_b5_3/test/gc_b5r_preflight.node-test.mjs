// GC-B5R — the frozen registry, the exact preflight matching, the exact
// Provider lock and the preflight-only path (O02, O05, O06, O10).
//
// These tests are pure node:test contract tests:
//   - no Chrome, no Runtime, no Provider, no download, no import
//   - no audio, no visible window, no network
//   - the preflight path only READS the declared configuration and the
//     public availability of an explicitly configured local asset
//
// The preflight never claims that a BVID passed: its disposition is
// "preflight_only" and every action counter is zero.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { makeTempRoot } from "../lib/temp_roots.mjs";

import {
  FROZEN_ADAPTER_ID,
  FROZEN_PORTAL_ID,
  FROZEN_REGISTRY_SHA256,
  FROZEN_SIX,
  RESERVE_SOURCES,
  INELIGIBLE_REASONS,
  PREFLIGHT_DISPOSITION,
  PREFLIGHT_ZERO_ACTIONS,
  assertFrozenIdentity,
  assertRegistryOrder,
  buildPreflightPlan,
  buildPreflightReceipt,
  inspectSource,
  readFrozenRegistry,
  readLocalAssetManifest,
  validateDeclaredIdentity,
} from "../lib/preflight.mjs";
import {
  PROVIDER_LOCK,
  SELECTED_PROVIDER_ID,
  providerLockOffenders,
} from "../lib/contracts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const registryPath = path.join(
  repoRoot,
  "docs/active/project/evidence/v3_media_companion/v3-completion",
  "gc-b5r-source-set-rebaseline-2026-10-24",
  "02-stage-b-six-video-registry-v2.json",
);
const sequencerPath = path.join(repoRoot, "scripts/stage_b_b5_3/sequencer.mjs");

function makeDir(prefix) {
  return makeTempRoot(prefix);
}

/** The exact identity of ONE frozen source. */
function identityOf(bvid, unit = "41828944992", part = "1") {
  return `portal:${FROZEN_ADAPTER_ID}:${bvid}:${unit}:${part}`;
}

// ============================================================================
// O02 — registry immutability
// ============================================================================

test("O02: the frozen registry file digest is the frozen one", () => {
  const bytes = fs.readFileSync(registryPath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(digest, FROZEN_REGISTRY_SHA256);
});

test("O02: readFrozenRegistry returns the six frozen identities in order", () => {
  const { sha256, registry } = readFrozenRegistry({ registryPath });
  assert.equal(sha256, FROZEN_REGISTRY_SHA256);
  assert.equal(registry.sources.length, 6);
  assert.deepEqual(
    registry.sources.map((source) => [String(source.order), source.bvid]),
    FROZEN_SIX.map((entry) => [entry.order, entry.bvid]),
  );
});

test("O02: the registry forbids substitution and cross-run reuse", () => {
  const { registry } = readFrozenRegistry({ registryPath });
  assert.equal(registry.substitutionAllowed, false);
  assert.equal(registry.crossRunArtifactReuseAllowed, false);
});

test("O02: a substituted registry is refused, not adopted", () => {
  const dir = makeDir("navia-b5-3-registry-");
  const original = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const tampered = JSON.parse(JSON.stringify(original));
  tampered.sources[2].bvid = "BV1SUBSTITUTE";
  const target = path.join(dir, "tampered.json");
  fs.writeFileSync(target, JSON.stringify(tampered, null, 2));
  assert.throws(
    () => readFrozenRegistry({ registryPath: target }),
    /active six-video registry digest changed/,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("O02: a re-ordered registry is refused", () => {
  const dir = makeDir("navia-b5-3-registry-");
  const original = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const tampered = JSON.parse(JSON.stringify(original));
  const [first] = tampered.sources.splice(0, 1);
  tampered.sources.push(first);
  const target = path.join(dir, "reordered.json");
  fs.writeFileSync(target, JSON.stringify(tampered, null, 2));
  assert.throws(
    () => readFrozenRegistry({ registryPath: target }),
    /active six-video registry digest changed/,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("O02: assertRegistryOrder refuses a swapped order", () => {
  const { registry } = readFrozenRegistry({ registryPath });
  const tampered = JSON.parse(JSON.stringify(registry));
  const [first] = tampered.sources.splice(0, 1);
  tampered.sources.push(first);
  assert.throws(() => assertRegistryOrder(tampered), /order or identity changed/);
});

test("O02: a RESERVE source is refused by the identity guard", () => {
  // The four reserves are frozen for a future Codex rebaseline only. A
  // running sequencer may never substitute one for a fixed source.
  for (const reserve of RESERVE_SOURCES) {
    for (const order of ["1", "2", "3", "4", "5", "6"]) {
      assert.throws(
        () => assertFrozenIdentity({ order, bvid: reserve.bvid }),
        /frozen reserve|does not match the frozen identity/,
        `${reserve.bvid} at order ${order} must be refused`,
      );
    }
  }
});

test("O02: a reserve is never one of the six", () => {
  for (const reserve of RESERVE_SOURCES) {
    assert.ok(
      !FROZEN_SIX.some((entry) => entry.bvid === reserve.bvid),
      `${reserve.bvid} may not be part of the denominator`,
    );
  }
});

test("O02: the runner refuses a substituted (order, bvid) pair", () => {
  for (const entry of FROZEN_SIX) {
    assert.equal(assertFrozenIdentity({ order: entry.order, bvid: entry.bvid }), true);
  }
  assert.throws(
    () => assertFrozenIdentity({ order: "1", bvid: "BV1OTHER000" }),
    /does not match the frozen identity/,
  );
  assert.throws(
    () => assertFrozenIdentity({ order: "7", bvid: FROZEN_SIX[0].bvid }),
    /not part of the frozen six/,
  );
  assert.throws(
    () => assertFrozenIdentity({ order: "2", bvid: FROZEN_SIX[0].bvid }),
    /does not match the frozen identity/,
  );
});

// ============================================================================
// C2 — the exact preflight matching
// ============================================================================

test("C2: the exact frozen identity is eligible", () => {
  const bvid = FROZEN_SIX[0].bvid;
  const verdict = validateDeclaredIdentity({
    declared: { sourceIdentity: identityOf(bvid) },
    bvid,
  });
  assert.equal(verdict.eligible, true);
  assert.equal(verdict.reason, null);
});

test("C2: a FOREIGN BVID identity is refused", () => {
  const bvid = FROZEN_SIX[0].bvid;
  const verdict = validateDeclaredIdentity({
    declared: { sourceIdentity: identityOf(FROZEN_SIX[1].bvid) },
    bvid,
  });
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.reason, INELIGIBLE_REASONS.IDENTITY_FOREIGN_BVID);
});

test("C2: a wrong portal or adapter is refused", () => {
  const bvid = FROZEN_SIX[0].bvid;
  const wrongAdapter = validateDeclaredIdentity({
    declared: { sourceIdentity: `portal:other:${bvid}:41828944992:1` },
    bvid,
  });
  assert.equal(wrongAdapter.eligible, false);
  assert.equal(wrongAdapter.reason, INELIGIBLE_REASONS.IDENTITY_FOREIGN_PORTAL);
  const wrongPortal = validateDeclaredIdentity({
    declared: { sourceIdentity: `notportal:${FROZEN_ADAPTER_ID}:${bvid}:41828944992:1` },
    bvid,
  });
  assert.equal(wrongPortal.eligible, false);
  assert.equal(wrongPortal.reason, INELIGIBLE_REASONS.IDENTITY_MALFORMED);
});

test("C2: an empty playback unit or part is refused", () => {
  const bvid = FROZEN_SIX[0].bvid;
  const emptyUnit = validateDeclaredIdentity({
    declared: { sourceIdentity: identityOf(bvid, "", "1") },
    bvid,
  });
  assert.equal(emptyUnit.eligible, false);
  assert.equal(emptyUnit.reason, INELIGIBLE_REASONS.IDENTITY_EMPTY_UNIT);
  const emptyPart = validateDeclaredIdentity({
    declared: { sourceIdentity: identityOf(bvid, "41828944992", "") },
    bvid,
  });
  assert.equal(emptyPart.eligible, false);
  assert.equal(emptyPart.reason, INELIGIBLE_REASONS.IDENTITY_EMPTY_PART);
});

test("C2: a missing or malformed identity is refused", () => {
  const bvid = FROZEN_SIX[0].bvid;
  const missing = validateDeclaredIdentity({ declared: { path: "/tmp/x" }, bvid });
  assert.equal(missing.eligible, false);
  assert.equal(missing.reason, INELIGIBLE_REASONS.IDENTITY_MISSING);
  const malformed = validateDeclaredIdentity({
    declared: { sourceIdentity: "portal:bilibili:too:few" },
    bvid,
  });
  assert.equal(malformed.eligible, false);
  assert.equal(malformed.reason, INELIGIBLE_REASONS.IDENTITY_MALFORMED);
});

test("C2: a declared media id that is not the frozen BVID is refused", () => {
  const bvid = FROZEN_SIX[0].bvid;
  const verdict = validateDeclaredIdentity({
    declared: { sourceIdentity: identityOf(bvid), mediaId: FROZEN_SIX[1].bvid },
    bvid,
  });
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.reason, INELIGIBLE_REASONS.MEDIA_ID_MISMATCH);
});

test("C2: a symlinked, missing or non-regular path is refused", (t) => {
  const dir = makeDir("navia-b5-3-path-");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const real = path.join(dir, "real.mp4");
  fs.writeFileSync(real, "bytes");
  const link = path.join(dir, "link.mp4");
  fs.symlinkSync(real, link);
  const subdir = path.join(dir, "dir.mp4");
  fs.mkdirSync(subdir);

  const source = {
    order: "1",
    bvid: FROZEN_SIX[0].bvid,
    portalId: FROZEN_PORTAL_ID,
    requiredDisposition: "attempt_fresh",
  };
  const symlinked = inspectSource({
    source,
    localAssets: { declared: { [FROZEN_SIX[0].bvid]: { path: link, sourceIdentity: identityOf(FROZEN_SIX[0].bvid) } } },
  });
  assert.equal(symlinked.localAssetAvailable, false);
  assert.equal(symlinked.localAssetIneligibleReason, INELIGIBLE_REASONS.PATH_IS_SYMLINK);

  const missing = inspectSource({
    source,
    localAssets: { declared: { [FROZEN_SIX[0].bvid]: { path: path.join(dir, "absent.mp4"), sourceIdentity: identityOf(FROZEN_SIX[0].bvid) } } },
  });
  assert.equal(missing.localAssetAvailable, false);
  assert.equal(missing.localAssetIneligibleReason, INELIGIBLE_REASONS.PATH_MISSING);

  const directory = inspectSource({
    source,
    localAssets: { declared: { [FROZEN_SIX[0].bvid]: { path: subdir, sourceIdentity: identityOf(FROZEN_SIX[0].bvid) } } },
  });
  assert.equal(directory.localAssetAvailable, false);
  assert.equal(directory.localAssetIneligibleReason, INELIGIBLE_REASONS.PATH_NOT_A_FILE);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("C2: a WRONG identity never yields an available asset", (t) => {
  const dir = makeDir("navia-b5-3-wrong-");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const asset = path.join(dir, "declared-asset.mp4");
  fs.writeFileSync(asset, "bytes");
  const source = {
    order: "1",
    bvid: FROZEN_SIX[0].bvid,
    portalId: FROZEN_PORTAL_ID,
    requiredDisposition: "attempt_fresh",
  };
  const observed = inspectSource({
    source,
    localAssets: {
      declared: {
        [FROZEN_SIX[0].bvid]: {
          path: asset,
          sourceIdentity: identityOf(FROZEN_SIX[3].bvid),
        },
      },
    },
  });
  assert.equal(observed.localAssetConfigured, true);
  assert.equal(observed.localAssetAvailable, false);
  assert.equal(observed.localAssetIneligibleReason, INELIGIBLE_REASONS.IDENTITY_FOREIGN_BVID);
  assert.equal(observed.localAssetByteLength, null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("C2: an unknown manifest key and a duplicated path stay visible", (t) => {
  const dir = makeDir("navia-b5-3-manifest-");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const asset = path.join(dir, "shared.mp4");
  fs.writeFileSync(asset, "bytes");
  const manifest = path.join(dir, "manifest.json");
  fs.writeFileSync(
    manifest,
    JSON.stringify({
      [FROZEN_SIX[0].bvid]: { path: asset, sourceIdentity: identityOf(FROZEN_SIX[0].bvid) },
      [FROZEN_SIX[1].bvid]: { path: asset, sourceIdentity: identityOf(FROZEN_SIX[1].bvid) },
      BV1NOTFROZEN: { path: asset, sourceIdentity: identityOf("BV1NOTFROZEN") },
    }),
  );
  const localAssets = readLocalAssetManifest({ manifestPath: manifest });
  assert.deepEqual(localAssets.unknownKeys, ["BV1NOTFROZEN"]);
  // One path, three declarations: the two later ones are the extra owners.
  assert.equal(localAssets.duplicatePaths.length, 2);
  const declaredKeys = Object.keys({
    [FROZEN_SIX[0].bvid]: 1,
    [FROZEN_SIX[1].bvid]: 1,
    BV1NOTFROZEN: 1,
  }).sort();
  const duplicateSeconds = localAssets.duplicatePaths.map((item) => item.second).sort();
  assert.deepEqual(duplicateSeconds, declaredKeys.slice(1).sort());
  for (const item of localAssets.duplicatePaths) {
    assert.notEqual(item.first, item.second);
  }

  const { registry } = readFrozenRegistry({ registryPath });
  const plan = buildPreflightPlan({
    registry,
    localAssets,
    environment: { registrySha256: FROZEN_REGISTRY_SHA256 },
  });
  assert.deepEqual(plan.localAssetManifestUnknownKeys, ["BV1NOTFROZEN"]);
  assert.equal(plan.localAssetManifestDuplicatePaths.length, 2);
  for (const source of plan.sources.slice(0, 2)) {
    assert.equal(source.localAssetAvailable, false);
    assert.equal(source.localAssetIneligibleReason, INELIGIBLE_REASONS.PATH_DUPLICATE);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test("C2: an undeclared asset is absent, never searched for", () => {
  const source = {
    order: "1",
    bvid: FROZEN_SIX[0].bvid,
    portalId: FROZEN_PORTAL_ID,
    requiredDisposition: "attempt_fresh",
  };
  const observed = inspectSource({ source, localAssets: { declared: {} } });
  assert.equal(observed.localAssetConfigured, false);
  assert.equal(observed.localAssetAvailable, false);
  assert.equal(observed.localAssetIneligibleReason, INELIGIBLE_REASONS.NOT_DECLARED);
  assert.equal(observed.passed, false);
  assert.equal(observed.disposition, PREFLIGHT_DISPOSITION);
});

test("C2: a missing declared manifest is a refusal, not a silent empty plan", () => {
  assert.throws(
    () => readLocalAssetManifest({ manifestPath: path.join(os.tmpdir(), "navia-b5-3-absent-manifest.json") }),
    /local-asset manifest is missing/,
  );
  const empty = readLocalAssetManifest({ manifestPath: null });
  assert.deepEqual(empty.declared, {});
  assert.equal(empty.digest, null);
});

// ============================================================================
// O10 — preflight purity
// ============================================================================

test("O10: the preflight plan reports every action count as zero", () => {
  const { registry } = readFrozenRegistry({ registryPath });
  const plan = buildPreflightPlan({
    registry,
    localAssets: { declared: {}, digest: null },
    environment: { registrySha256: FROZEN_REGISTRY_SHA256 },
  });
  for (const key of PREFLIGHT_ZERO_ACTIONS) {
    assert.equal(plan.actions[key], 0, `${key} must be zero`);
  }
  assert.equal(plan.attempted, false);
  assert.equal(plan.anySourcePassed, false);
  assert.equal(plan.providerCalls, 0);
  assert.equal(plan.chromeLaunches, 0);
  assert.equal(plan.downloads, 0);
  assert.equal(plan.imports, 0);
  assert.equal(plan.artifactsGenerated, 0);
  assert.equal(plan.sources.length, 6);
});

test("O10: no source is ever reported as passed", () => {
  const { registry } = readFrozenRegistry({ registryPath });
  const plan = buildPreflightPlan({
    registry,
    localAssets: { declared: {}, digest: null },
    environment: { registrySha256: FROZEN_REGISTRY_SHA256 },
  });
  for (const source of plan.sources) {
    assert.equal(source.disposition, PREFLIGHT_DISPOSITION);
    assert.equal(source.passed, false);
  }
  const receipt = buildPreflightReceipt({
    plan,
    startedAtUtc: "2026-10-23T00:00:00.000Z",
    finishedAtUtc: "2026-10-23T00:00:01.000Z",
  });
  assert.equal(receipt.mode, "preflight-only");
  assert.equal(receipt.anySourcePassed, false);
  assert.equal(receipt.attempted, false);
  for (const key of PREFLIGHT_ZERO_ACTIONS) {
    assert.equal(receipt.actions[key], 0, `${key} must be zero`);
  }
});

test("O10: the preflight inspects only DECLARED local assets", (t) => {
  const dir = makeDir("navia-b5-3-assets-");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const asset = path.join(dir, "declared-asset.mp4");
  fs.writeFileSync(asset, "not-read-by-the-preflight");
  const bvid = FROZEN_SIX[0].bvid;
  const { registry } = readFrozenRegistry({ registryPath });
  const plan = buildPreflightPlan({
    registry,
    localAssets: {
      declared: { [bvid]: { path: asset, sourceIdentity: identityOf(bvid) } },
      digest: "0".repeat(64),
    },
    environment: { registrySha256: FROZEN_REGISTRY_SHA256 },
  });
  const first = plan.sources.find((source) => source.bvid === bvid);
  assert.equal(first.localAssetConfigured, true);
  assert.equal(first.localAssetAvailable, true);
  assert.equal(first.localAssetByteLength, fs.statSync(asset).size);
  assert.equal(first.localAssetIneligibleReason, null);
  // The CONTENT of the asset is never read into the plan.
  assert.equal(JSON.stringify(plan).includes("not-read-by-the-preflight"), false);
  for (const source of plan.sources.filter((item) => item.bvid !== bvid)) {
    assert.equal(source.localAssetConfigured, false);
    assert.equal(source.localAssetAvailable, false);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test("O10: the preflight-only run writes a receipt and starts nothing", (t) => {
  const evidenceRoot = makeDir("navia-b5-3-preflight-");
  t.after(() => fs.rmSync(evidenceRoot, { recursive: true, force: true }));
  const completed = spawnSync(
    process.execPath,
    [
      sequencerPath,
      "--preflight-only=1",
      "--run-id=gc-b5r-preflight-test",
      `--evidence-root=${evidenceRoot}`,
    ],
    { cwd: repoRoot, encoding: "utf8", timeout: 60_000 },
  );
  assert.equal(completed.status, 0, completed.stderr);

  const receiptPath = path.join(evidenceRoot, "preflight-receipt.json");
  assert.ok(fs.existsSync(receiptPath), "the preflight receipt must exist");
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  assert.equal(receipt.mode, "preflight-only");
  assert.equal(receipt.registrySha256, FROZEN_REGISTRY_SHA256);
  assert.equal(receipt.attempted, false);
  assert.equal(receipt.anySourcePassed, false);
  for (const key of PREFLIGHT_ZERO_ACTIONS) {
    assert.equal(receipt.actions[key], 0, `${key} must be zero`);
  }
  assert.equal(receipt.sources.length, 6);
  for (const source of receipt.sources) {
    assert.equal(source.passed, false);
    assert.equal(source.disposition, PREFLIGHT_DISPOSITION);
  }

  // A real run creates one directory per BVID. A preflight creates none.
  const entries = fs.readdirSync(evidenceRoot);
  assert.equal(entries.filter((entry) => entry.startsWith("bvid-")).length, 0);
  assert.ok(entries.includes("preflight-receipt.json"));
  assert.ok(entries.includes("sequencer-summary.json"));

  const summary = JSON.parse(fs.readFileSync(path.join(evidenceRoot, "sequencer-summary.json"), "utf8"));
  assert.equal(summary.mode, "preflight-only");
  assert.deepEqual(summary.bvids, []);

  fs.rmSync(evidenceRoot, { recursive: true, force: true });
});

// ============================================================================
// C3/O05 — the exact Provider lock
// ============================================================================

test("C3: the selected product Provider id and the endpoint class are two facts", () => {
  assert.equal(SELECTED_PROVIDER_ID, "minimax-cn-openai-vision");
  assert.equal(PROVIDER_LOCK, "minimax_chat_completions");
  assert.notEqual(SELECTED_PROVIDER_ID, PROVIDER_LOCK);
});

test("C3/O05: the exact locked receipt is accepted", () => {
  assert.deepEqual(
    providerLockOffenders({
      providerId: SELECTED_PROVIDER_ID,
      endpointClass: PROVIDER_LOCK,
    }),
    [],
  );
});

test("C3/O05: a MISSING Provider id is a refusal", () => {
  const offenders = providerLockOffenders({ endpointClass: PROVIDER_LOCK });
  assert.ok(offenders.includes("providerId=missing"));
  assert.deepEqual(providerLockOffenders(null), ["receipt=missing"]);
});

test("C3/O05: a LOOKALIKE Provider id is a refusal", () => {
  for (const lookalike of [
    "attacker-minimax-shadow",
    "minimax",
    "minimax-cn-openai",
    "minimax-cn-openai-vision-2",
    "MINIMAX-CN-OPENAI-VISION",
    "minimax_chat_completions",
  ]) {
    const offenders = providerLockOffenders({
      providerId: lookalike,
      endpointClass: PROVIDER_LOCK,
    });
    assert.ok(
      offenders.some((item) => item.startsWith("providerId=")),
      `${lookalike} must be refused`,
    );
  }
});

test("C3/O05: a WRONG endpoint class is a refusal", () => {
  const offenders = providerLockOffenders({
    providerId: SELECTED_PROVIDER_ID,
    endpointClass: "deepseek_beta_strict_tool_v1",
  });
  assert.ok(offenders.some((item) => item.startsWith("endpointClass=")));
  const missing = providerLockOffenders({ providerId: SELECTED_PROVIDER_ID });
  assert.ok(missing.includes("endpointClass=missing"));
});

test("C3/O05: DeepSeek is a refusal", () => {
  const offenders = providerLockOffenders({
    providerId: "deepseek-chat",
    endpointClass: "deepseek_beta_strict_tool_v1",
  });
  assert.equal(offenders.length, 2);
});

test("C3/O05: TWO declared provider authorities are a refusal", () => {
  const offenders = providerLockOffenders({
    providerId: SELECTED_PROVIDER_ID,
    endpointClass: PROVIDER_LOCK,
    providers: [SELECTED_PROVIDER_ID, "deepseek-chat"],
  });
  assert.ok(offenders.includes("providers=2"));
});

test("C3/O05: a bounded retry by the SAME Provider is not a second Provider", () => {
  const offenders = providerLockOffenders({
    providerId: SELECTED_PROVIDER_ID,
    endpointClass: PROVIDER_LOCK,
    requestCount: 2,
  });
  assert.deepEqual(offenders, []);
});

// ============================================================================
// O06 — the upload counters
// ============================================================================

test("O06: the upload counters of a clean receipt are all zero", () => {
  const receipt = {
    rawVideoUploadCount: 0,
    rawAudioUploadCount: 0,
    frameByteUploadCount: 0,
    cookieUploadCount: 0,
    apiKeyDisclosureCount: 0,
    localPathUploadCount: 0,
  };
  const offenders = Object.entries(receipt).filter(([, value]) => value !== 0);
  assert.deepEqual(offenders, []);
});
