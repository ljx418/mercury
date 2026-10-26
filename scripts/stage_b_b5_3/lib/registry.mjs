// The ACTIVE Stage B source registry (v2).
//
// The canonical file is read DIRECTLY from the rebaseline package, so there is
// no second copy that could drift. The digest below is the authorization-time
// digest of that file: a change is a refusal, never an adoption.
//
// The historical v1 registry and every historical evidence file are immutable
// and are NOT read by the active runner.
//
// The four RESERVE sources are frozen for a future Codex rebaseline only. A
// running sequencer may never substitute a reserve for a fixed source.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

/** The canonical v2 registry file, read in place. */
export const ACTIVE_REGISTRY_PATH = path.join(
  repoRoot,
  "docs/active/project/evidence/v3_media_companion/v3-completion",
  "gc-b5r-source-set-rebaseline-2026-10-24",
  "02-stage-b-six-video-registry-v2.json",
);

/** The authorization-time SHA-256 of the canonical v2 registry. */
export const ACTIVE_REGISTRY_SHA256 =
  "9c2da2f4c4c16fc94e1e0d7dfc9362ab1177d2db53f63d4af5a81a44795c9454";

/** The frozen portal of the six sources. */
export const FROZEN_PORTAL_ID = "bilibili";

/** The frozen primary six, in the registry's exact order. */
export const FROZEN_SIX = Object.freeze([
  { order: "1", bvid: "BV11t8w6oEtP" },
  { order: "2", bvid: "BV1QcYx6VEAj" },
  { order: "3", bvid: "BV1v58B6GEan" },
  { order: "4", bvid: "BV1M5tJ6kEvw" },
  { order: "5", bvid: "BV1HTbi6LERi" },
  { order: "6", bvid: "BV1qM9fB8Eb2" },
]);

/** The frozen reserves. They are forbidden at runtime. */
export const RESERVE_SOURCES = Object.freeze([
  { reserveOrder: "1", bvid: "BV16woRBfEsH" },
  { reserveOrder: "2", bvid: "BV1w7XQB7EsS" },
  { reserveOrder: "3", bvid: "BV1829jBeErD" },
  { reserveOrder: "4", bvid: "BV1aJAjzsE4j" },
]);

const RESERVE_BVIDS = new Set(RESERVE_SOURCES.map((entry) => entry.bvid));

/** The historical v1 registry. It is immutable and never active. */
export const HISTORICAL_V1_REGISTRY_PATH = path.join(
  repoRoot,
  "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair",
  "stage-b-six-video-registry.json",
);

/**
 * Read the ACTIVE registry and prove it is the frozen one.
 *
 * A digest that does not match is a refusal, never an adoption.
 */
export function readFrozenRegistry({ registryPath = ACTIVE_REGISTRY_PATH } = {}) {
  const bytes = fs.readFileSync(registryPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== ACTIVE_REGISTRY_SHA256) {
    throw new Error(
      `The active six-video registry digest changed: expected ${ACTIVE_REGISTRY_SHA256}, observed ${sha256}. No substitution is permitted.`,
    );
  }
  const registry = JSON.parse(bytes.toString("utf8"));
  assertRegistryOrder(registry);
  return { sha256, registry };
}

/** The registry must declare the six identities in the frozen order. */
export function assertRegistryOrder(registry) {
  const sources = registry?.sources;
  if (!Array.isArray(sources) || sources.length !== FROZEN_SIX.length) {
    throw new Error("The active registry does not declare exactly six sources.");
  }
  for (let index = 0; index < FROZEN_SIX.length; index += 1) {
    const expected = FROZEN_SIX[index];
    const observed = sources[index];
    if (
      String(observed?.order) !== expected.order ||
      String(observed?.bvid) !== expected.bvid ||
      String(observed?.portalId) !== FROZEN_PORTAL_ID
    ) {
      throw new Error(
        `The active registry order or identity changed at position ${index + 1}.`,
      );
    }
  }
  if (registry.substitutionAllowed !== false) {
    throw new Error("The active registry must not allow substitution.");
  }
  if (registry.crossRunArtifactReuseAllowed !== false) {
    throw new Error("The active registry must not allow cross-run artifact reuse.");
  }
  if (registry.selectionPolicy?.runtimeReserveSubstitutionAllowed !== false) {
    throw new Error("The active registry must not allow a runtime reserve substitution.");
  }
  // The reserves are frozen, and they are NOT part of the denominator.
  const reserves = registry?.reserveSources;
  if (!Array.isArray(reserves) || reserves.length !== RESERVE_SOURCES.length) {
    throw new Error("The active registry does not declare exactly four reserves.");
  }
  for (let index = 0; index < RESERVE_SOURCES.length; index += 1) {
    const expected = RESERVE_SOURCES[index];
    const observed = reserves[index];
    if (
      String(observed?.reserveOrder) !== expected.reserveOrder ||
      String(observed?.bvid) !== expected.bvid
    ) {
      throw new Error(`The active registry reserve set changed at position ${index + 1}.`);
    }
  }
  for (const entry of FROZEN_SIX) {
    if (RESERVE_BVIDS.has(entry.bvid)) {
      throw new Error("A reserve source may not be part of the denominator.");
    }
  }
  return true;
}

/** A reserve source may never be used at runtime. */
export function assertNotReserve(bvid) {
  if (RESERVE_BVIDS.has(String(bvid))) {
    throw new Error(
      `BVID ${bvid} is a frozen reserve. A reserve may only be used after a new Codex rebaseline.`,
    );
  }
  return true;
}

/**
 * Refuse a substituted (order, bvid) pair.
 *
 * The runner may only ever be asked for the exact frozen identity, and never
 * for a reserve.
 */
export function assertFrozenIdentity({ order, bvid }) {
  assertNotReserve(bvid);
  const expected = FROZEN_SIX.find((entry) => entry.order === String(order));
  if (!expected) {
    throw new Error(`Order ${order} is not part of the frozen six.`);
  }
  if (expected.bvid !== String(bvid)) {
    throw new Error(
      `BVID ${bvid} does not match the frozen identity for order ${order} (${expected.bvid}). Substitution is not permitted.`,
    );
  }
  return true;
}
