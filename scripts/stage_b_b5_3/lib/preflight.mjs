// The GC-B5R PREFLIGHT-ONLY inspection.
//
// It inspects the SIX frozen source identities and the EXPLICITLY configured
// matching local-asset availability. It starts NO Chrome, NO Runtime, calls NO
// Provider, downloads NOTHING, imports NOTHING and generates NO artifact.
//
// Its receipt reports every one of those action counts as ZERO, and it never
// claims that a BVID passed: a preflight disposition is "preflight_only", not
// "complete".
//
// A declared local asset is eligible ONLY when EVERY frozen fact matches:
//   - the declaration key is the frozen BVID;
//   - the declared source identity is exactly
//     `portal:bilibili:<frozen BVID>:<nonempty playbackUnitId>:<nonempty partId>`;
//   - the declared media id equals the frozen BVID;
//   - the path is explicitly declared, exists, is a regular file and is not a
//     symlink;
//   - the path is not declared for another frozen source as well.
// A missing, malformed, foreign, duplicated or unsafe declaration stays
// VISIBLE in the receipt as ineligible with a stable, nonsecret reason. It is
// never counted as matching or available.
//
// The preflight never reads a file's CONTENT, never computes a digest, never
// touches a cookie and never searches a directory.

import { createHash } from "node:crypto";
import fs from "node:fs";

import {
  ACTIVE_REGISTRY_PATH,
  ACTIVE_REGISTRY_SHA256,
  FROZEN_PORTAL_ID,
  FROZEN_SIX,
  RESERVE_SOURCES,
  assertFrozenIdentity,
  assertNotReserve,
  assertRegistryOrder,
  readFrozenRegistry,
} from "./registry.mjs";

// The ACTIVE registry (v2) is owned by `lib/registry.mjs` and re-exported
// here so every existing importer keeps one source of truth.
export {
  ACTIVE_REGISTRY_PATH,
  ACTIVE_REGISTRY_SHA256,
  FROZEN_PORTAL_ID,
  FROZEN_SIX,
  RESERVE_SOURCES,
  assertFrozenIdentity,
  assertNotReserve,
  assertRegistryOrder,
  readFrozenRegistry,
};

/** The frozen registry digest. It may not be edited or replaced. */
export const FROZEN_REGISTRY_SHA256 = ACTIVE_REGISTRY_SHA256;

/** The frozen adapter of the six sources. */
export const FROZEN_ADAPTER_ID = "bilibili";

/** Every action the preflight must NOT take. Every count is zero. */
export const PREFLIGHT_ZERO_ACTIONS = Object.freeze([
  "chromeLaunchCount",
  "visibleWindowCount",
  "runtimeStartCount",
  "providerCallCount",
  "downloadCount",
  "importCount",
  "artifactGenerationCount",
  "cookieInjectionCount",
  "audioOutputCount",
  "tabCaptureCount",
  "focusEventCount",
]);

/** The disposition a preflight may report. It is never "complete". */
export const PREFLIGHT_DISPOSITION = "preflight_only";

/** The stable, nonsecret reasons an asset is not eligible. */
export const INELIGIBLE_REASONS = Object.freeze({
  NOT_DECLARED: "not_declared",
  IDENTITY_MISSING: "identity_missing",
  IDENTITY_MALFORMED: "identity_malformed",
  IDENTITY_FOREIGN_PORTAL: "identity_foreign_portal",
  IDENTITY_FOREIGN_BVID: "identity_foreign_bvid",
  IDENTITY_EMPTY_UNIT: "identity_empty_unit",
  IDENTITY_EMPTY_PART: "identity_empty_part",
  MEDIA_ID_MISMATCH: "media_id_mismatch",
  PATH_MISSING: "path_missing",
  PATH_NOT_A_FILE: "path_not_a_regular_file",
  PATH_IS_SYMLINK: "path_is_a_symlink",
  PATH_DUPLICATE: "path_declared_for_another_source",
});

/**
 * The EXPLICITLY configured local assets.
 *
 * The manifest is a JSON file: `{ "<bvid>": { "path": "...",
 * "sourceIdentity": "portal:bilibili:<bvid>:<unit>:<part>" } }`.
 *
 * Nothing is searched for. An asset that is not declared is simply absent.
 */
export function readLocalAssetManifest({ manifestPath }) {
  if (!manifestPath) return { declared: {}, digest: null, unknownKeys: [], duplicatePaths: [] };
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`The configured local-asset manifest is missing: ${manifestPath}`);
  }
  const bytes = fs.readFileSync(manifestPath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const parsed = JSON.parse(bytes.toString("utf8"));
  const declared = parsed && typeof parsed === "object" ? parsed : {};
  const frozenKeys = new Set(FROZEN_SIX.map((entry) => entry.bvid));
  const unknownKeys = Object.keys(declared).filter((key) => !frozenKeys.has(key)).sort();
  // The same path may not serve two frozen sources.
  const seen = new Map();
  const duplicatePaths = [];
  for (const key of Object.keys(declared).sort()) {
    const value = declared[key];
    const filePath = value && typeof value === "object" ? value.path : null;
    if (typeof filePath !== "string" || !filePath) continue;
    const owner = seen.get(filePath);
    if (owner === undefined) {
      seen.set(filePath, key);
    } else {
      duplicatePaths.push({ path: filePath, first: owner, second: key });
    }
  }
  return { declared, digest, unknownKeys, duplicatePaths };
}

/**
 * Validate ONE declared source identity against the frozen facts.
 *
 * The identity is the ONE exact key: `portal:<adapter>:<mediaId>:<unit>:<part>`.
 */
export function validateDeclaredIdentity({ declared, bvid, mediaId }) {
  if (!declared || typeof declared !== "object") {
    return { eligible: false, reason: INELIGIBLE_REASONS.IDENTITY_MISSING, identity: null };
  }
  const identity = typeof declared.sourceIdentity === "string" ? declared.sourceIdentity : "";
  if (!identity) {
    return { eligible: false, reason: INELIGIBLE_REASONS.IDENTITY_MISSING, identity: null };
  }
  const parts = identity.split(":");
  if (parts.length !== 5 || parts[0] !== "portal") {
    return { eligible: false, reason: INELIGIBLE_REASONS.IDENTITY_MALFORMED, identity };
  }
  const [, adapter, media, unit, part] = parts;
  if (adapter !== FROZEN_ADAPTER_ID) {
    return { eligible: false, reason: INELIGIBLE_REASONS.IDENTITY_FOREIGN_PORTAL, identity };
  }
  if (media !== bvid) {
    return { eligible: false, reason: INELIGIBLE_REASONS.IDENTITY_FOREIGN_BVID, identity };
  }
  if (!unit) {
    return { eligible: false, reason: INELIGIBLE_REASONS.IDENTITY_EMPTY_UNIT, identity };
  }
  if (!part) {
    return { eligible: false, reason: INELIGIBLE_REASONS.IDENTITY_EMPTY_PART, identity };
  }
  if (typeof declared.mediaId === "string" && declared.mediaId && declared.mediaId !== bvid) {
    return { eligible: false, reason: INELIGIBLE_REASONS.MEDIA_ID_MISMATCH, identity };
  }
  if (typeof mediaId === "string" && mediaId && mediaId !== bvid) {
    return { eligible: false, reason: INELIGIBLE_REASONS.MEDIA_ID_MISMATCH, identity };
  }
  return { eligible: true, reason: null, identity };
}

/**
 * Inspect the DECLARED path of ONE source identity.
 *
 * The inspection is limited to the declared configuration and the public
 * availability of the declared file. The file's CONTENT is never read, no
 * digest is computed and no directory is searched.
 */
export function inspectDeclaredPath({ declared }) {
  if (!declared || typeof declared !== "object") {
    return { eligible: false, reason: INELIGIBLE_REASONS.PATH_MISSING, byteLength: null };
  }
  const filePath = typeof declared.path === "string" ? declared.path : "";
  if (!filePath) {
    return { eligible: false, reason: INELIGIBLE_REASONS.PATH_MISSING, byteLength: null };
  }
  let link;
  try {
    link = fs.lstatSync(filePath);
  } catch {
    return { eligible: false, reason: INELIGIBLE_REASONS.PATH_MISSING, byteLength: null };
  }
  if (link.isSymbolicLink()) {
    return { eligible: false, reason: INELIGIBLE_REASONS.PATH_IS_SYMLINK, byteLength: null };
  }
  if (!link.isFile()) {
    return { eligible: false, reason: INELIGIBLE_REASONS.PATH_NOT_A_FILE, byteLength: null };
  }
  return { eligible: true, reason: null, byteLength: link.size };
}

/**
 * Inspect ONE source identity.
 *
 * A preflight NEVER attempts a source and NEVER claims a pass.
 */
export function inspectSource({ source, localAssets }) {
  const bvid = String(source.bvid);
  const declared = localAssets?.declared?.[bvid] ?? null;
  const identity = validateDeclaredIdentity({ declared, bvid });
  const file = inspectDeclaredPath({ declared });
  const duplicate = (localAssets?.duplicatePaths ?? []).some(
    (item) => item.second === bvid || item.first === bvid,
  );

  let reason = null;
  if (!declared) {
    reason = INELIGIBLE_REASONS.NOT_DECLARED;
  } else if (duplicate) {
    reason = INELIGIBLE_REASONS.PATH_DUPLICATE;
  } else if (!identity.eligible) {
    reason = identity.reason;
  } else if (!file.eligible) {
    reason = file.reason;
  }

  return {
    order: String(source.order),
    bvid,
    portalId: String(source.portalId),
    requiredDisposition: String(source.requiredDisposition),
    // The declared identity, when the operator supplied one.
    declaredSourceIdentity: identity.identity,
    localAssetConfigured: Boolean(declared),
    // A declared asset is AVAILABLE only when EVERY frozen fact matches.
    localAssetAvailable: reason === null,
    localAssetByteLength: reason === null ? file.byteLength : null,
    // The stable, nonsecret reason an asset is not eligible.
    localAssetIneligibleReason: reason,
    // A preflight NEVER attempts a source and NEVER claims a pass.
    disposition: PREFLIGHT_DISPOSITION,
    passed: false,
  };
}

/**
 * The whole preflight plan: the six sources, their inspection and the action
 * counters, every one of which is zero.
 */
export function buildPreflightPlan({ registry, localAssets, environment }) {
  const actions = {};
  for (const key of PREFLIGHT_ZERO_ACTIONS) actions[key] = 0;
  const sources = registry.sources.map((source) => inspectSource({ source, localAssets }));
  return {
    schemaVersion: "v3-5.10-gc-b5r-preflight/v1",
    registrySha256: environment?.registrySha256 ?? null,
    localAssetManifestSha256: localAssets?.digest ?? null,
    // Declarations that name no frozen source stay visible.
    localAssetManifestUnknownKeys: localAssets?.unknownKeys ?? [],
    localAssetManifestDuplicatePaths: (localAssets?.duplicatePaths ?? []).map((item) => ({
      first: item.first,
      second: item.second,
    })),
    actions,
    sources,
    // The preflight is not a run. Nothing here is a Stage B result.
    attempted: false,
    providerCalls: 0,
    chromeLaunches: 0,
    downloads: 0,
    imports: 0,
    artifactsGenerated: 0,
    anySourcePassed: false,
  };
}

/** The receipt written by the preflight-only mode. */
export function buildPreflightReceipt({ plan, startedAtUtc, finishedAtUtc }) {
  return {
    schemaVersion: "v3-5.10-gc-b5r-preflight-receipt/v1",
    mode: "preflight-only",
    startedAtUtc,
    finishedAtUtc,
    registrySha256: plan.registrySha256,
    localAssetManifestSha256: plan.localAssetManifestSha256,
    localAssetManifestUnknownKeys: plan.localAssetManifestUnknownKeys,
    localAssetManifestDuplicatePaths: plan.localAssetManifestDuplicatePaths,
    actions: plan.actions,
    sources: plan.sources,
    attempted: plan.attempted,
    providerCalls: plan.providerCalls,
    chromeLaunches: plan.chromeLaunches,
    downloads: plan.downloads,
    imports: plan.imports,
    artifactsGenerated: plan.artifactsGenerated,
    anySourcePassed: plan.anySourcePassed,
    note: "A preflight inspects declared configuration and public availability only. It attempts no source, calls no Provider, downloads nothing, imports nothing and generates no artifact. No BVID passed here.",
  };
}
