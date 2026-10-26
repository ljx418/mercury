// The BATCH-OWNED, ATOMIC, ONE-SHOT visible authorization.
//
// The SEQUENCER owns the authorization. It consumes ONE authorization exactly
// once for the complete six-source candidate BEFORE any external action, and
// it creates a durable CHILD GRANT per source. A child VERIFIES its grant; it
// never consumes the original identifier and never sees it.
//
// THE AUTHORITY IS THE CONSUMPTION MARKER. The marker is created once,
// atomically (O_EXCL), and it records the digest of the authorization, the run
// id, the registry digest and the id AND the digest of every child grant it
// issued.
//
// A grant is NEVER trusted because of its own digest: a grant's `grantDigest`
// is a SELF-COMPUTED, UNKEYED digest, and anybody who can write a file can
// compute a matching one. It is accepted only when it MATCHES the copy the
// marker holds. An entirely forged, self-signed grant is therefore refused.
//
// The per-source grant is consumed ATOMICALLY ONCE: the first child that
// proves its grant consumes it, and a replay is refused.
//
// The raw authorization value is never persisted and never appears in the
// evidence. A crash or a corrupt marker or grant fails CLOSED, before any
// external action.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** The authorization marker's schema. */
export const AUTHORIZATION_SCHEMA = "v3-5.10-b5-authorization/v2";
/** The child grant's schema. */
export const GRANT_SCHEMA = "v3-5.10-b5-child-grant/v2";
/** The per-source grant consumption receipt's schema. */
export const GRANT_USE_SCHEMA = "v3-5.10-b5-child-grant-use/v1";

/** The EXACT key sets. A record with another key set is CORRUPT. */
export const AUTHORIZATION_MARKER_KEYS = Object.freeze([
  "schemaVersion", "authorizationDigest", "runId", "registrySha256", "consumedAt", "grants",
]);
export const AUTHORIZATION_GRANT_KEYS = Object.freeze([
  "schemaVersion", "authorizationDigest", "runId", "registrySha256",
  "order", "bvid", "identities", "createdAt", "grantDigest",
]);
export const AUTHORIZATION_GRANT_ENTRY_KEYS = Object.freeze(["order", "bvid", "grantId", "grantDigest"]);
export const AUTHORIZATION_IDENTITY_KEYS = Object.freeze(["order", "bvid"]);

/** The authorization refusal reasons. */
export const AUTHORIZATION_REFUSAL = Object.freeze({
  MISSING: "authorization_missing",
  ALREADY_CONSUMED: "authorization_already_consumed",
  STATE_CORRUPT: "authorization_state_corrupt",
  DIGEST_MISSING: "authorization_digest_missing",
  MARKER_MISSING: "authorization_marker_missing",
  MARKER_CORRUPT: "authorization_marker_corrupt",
  MARKER_DIGEST_MISMATCH: "authorization_marker_digest_mismatch",
  MARKER_RUN_MISMATCH: "authorization_marker_run_mismatch",
  MARKER_REGISTRY_MISMATCH: "authorization_marker_registry_mismatch",
  GRANT_MISSING: "child_grant_missing",
  GRANT_CORRUPT: "child_grant_corrupt",
  GRANT_NOT_ISSUED: "child_grant_not_issued",
  GRANT_FILENAME_MISMATCH: "child_grant_filename_mismatch",
  GRANT_DIGEST_MISMATCH: "child_grant_digest_mismatch",
  GRANT_RUN_MISMATCH: "child_grant_run_mismatch",
  GRANT_REGISTRY_MISMATCH: "child_grant_registry_mismatch",
  GRANT_IDENTITY_MISMATCH: "child_grant_identity_mismatch",
  GRANT_ORDER_MISMATCH: "child_grant_order_mismatch",
  GRANT_ALREADY_USED: "child_grant_already_used",
});

const HEX64 = /^[0-9a-f]{64}$/;

/** The one-way digest of an authorization. The raw value is never persisted. */
export function authorizationDigest(authorizationId) {
  return createHash("sha256").update(String(authorizationId)).digest("hex");
}

/**
 * The digest of a child grant's TRUSTED fields.
 *
 * This digest is NOT an authority on its own: it is unkeyed, so anybody can
 * compute a matching one. It is only ever compared against the copy the
 * CONSUMPTION MARKER holds.
 */
export function grantDigest(grant) {
  return createHash("sha256")
    .update(JSON.stringify([
      grant.schemaVersion,
      grant.authorizationDigest,
      grant.runId,
      grant.registrySha256,
      grant.order,
      grant.bvid,
      grant.identities,
      grant.createdAt,
    ]))
    .digest("hex");
}

/** The stable identifier of a child grant. */
export function childGrantId({ authorizationDigest: digest, runId, order, bvid }) {
  return createHash("sha256")
    .update([digest, runId, String(order), bvid].join("\x1f"))
    .digest("hex")
    .slice(0, 32);
}

/** TRUE when the value is an object with EXACTLY these keys. */
function hasExactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
}

/** The stage-root paths of the authorization state. */
export function authorizationPaths({ stageRoot }) {
  return {
    consumedDirectory: path.join(stageRoot, "authorizations"),
    grantDirectory: path.join(stageRoot, "grants"),
  };
}

function normalizeIdentities(identities) {
  return (identities ?? []).map((item) => ({
    order: String(item.order),
    bvid: String(item.bvid),
  }));
}

/**
 * Consume the one-shot authorization for the WHOLE candidate.
 *
 * It is atomic across processes: the O_EXCL marker is created once. A second
 * sequencer with the same authorization loses the race and is refused BEFORE
 * any external action.
 *
 * The marker is written FIRST and it holds the authoritative copy of every
 * child grant's id and digest.
 */
export function consumeAuthorization({
  stageRoot,
  authorizationId,
  runId,
  registrySha256,
  identities,
}) {
  if (!authorizationId || typeof authorizationId !== "string" || !authorizationId.trim()) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.MISSING };
  }
  const digest = authorizationDigest(authorizationId);
  const { consumedDirectory, grantDirectory } = authorizationPaths({ stageRoot });
  ensureDir(consumedDirectory);
  ensureDir(grantDirectory);

  // The grants are computed BEFORE the marker is written, so the marker can
  // hold their authoritative ids and digests.
  const orderedIdentities = normalizeIdentities(identities);
  const createdAt = new Date().toISOString();
  const drafts = orderedIdentities.map((identity) => {
    const grant = {
      schemaVersion: GRANT_SCHEMA,
      authorizationDigest: digest,
      runId: runId ?? null,
      registrySha256: registrySha256 ?? null,
      order: identity.order,
      bvid: identity.bvid,
      identities: orderedIdentities,
      createdAt,
    };
    grant.grantDigest = grantDigest(grant);
    return {
      grant,
      grantId: childGrantId({
        authorizationDigest: digest,
        runId: grant.runId,
        order: grant.order,
        bvid: grant.bvid,
      }),
    };
  });

  const marker = path.join(consumedDirectory, `${digest}.consumed`);
  let handle;
  try {
    // O_EXCL: the FIRST writer wins, atomically, across processes.
    handle = fs.openSync(marker, "wx", 0o600);
  } catch (error) {
    if (error && error.code === "EEXIST") {
      return { ok: false, reason: AUTHORIZATION_REFUSAL.ALREADY_CONSUMED, digest };
    }
    return { ok: false, reason: AUTHORIZATION_REFUSAL.STATE_CORRUPT, digest };
  }
  try {
    // The marker records the digest and the run, never the raw value.
    fs.writeSync(handle, JSON.stringify({
      schemaVersion: AUTHORIZATION_SCHEMA,
      authorizationDigest: digest,
      runId: runId ?? null,
      registrySha256: registrySha256 ?? null,
      consumedAt: createdAt,
      grants: drafts.map((draft) => ({
        order: draft.grant.order,
        bvid: draft.grant.bvid,
        grantId: draft.grantId,
        grantDigest: draft.grant.grantDigest,
      })),
    }));
  } finally {
    fs.closeSync(handle);
  }

  // The durable child grants: one per ordered identity.
  const grants = [];
  for (const draft of drafts) {
    const target = path.join(grantDirectory, `${draft.grantId}.grant.json`);
    const temporary = `${target}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(draft.grant, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, target);
    grants.push({
      grantId: draft.grantId,
      order: draft.grant.order,
      bvid: draft.grant.bvid,
      authorizationDigest: digest,
    });
  }
  return { ok: true, reason: null, digest, grants };
}

/**
 * Verify AND CONSUME a child grant.
 *
 * The child never consumes the authorization: it only proves that its grant
 * belongs to THIS run, THIS registry and THIS ordered identity set, that the
 * CONSUMPTION MARKER issued it, and that the grant was not tampered with.
 *
 * Every check happens BEFORE the Cookie read and BEFORE Chrome. A refusal
 * performs no external action at all.
 */
export function verifyChildGrant({
  stageRoot,
  grantId,
  authorizationDigest: suppliedDigest,
  runId,
  registrySha256,
  order,
  bvid,
  identities,
}) {
  if (!grantId || typeof grantId !== "string" || !grantId.trim()) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_MISSING };
  }
  if (!suppliedDigest || typeof suppliedDigest !== "string" || !HEX64.test(suppliedDigest)) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.DIGEST_MISSING };
  }
  const { consumedDirectory, grantDirectory } = authorizationPaths({ stageRoot });

  // 1. The CONSUMPTION MARKER: it must exist, parse EXACTLY, and it is the
  //    authority for everything below.
  const markerPath = path.join(consumedDirectory, `${suppliedDigest}.consumed`);
  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ok: false, reason: AUTHORIZATION_REFUSAL.MARKER_MISSING };
    }
    return { ok: false, reason: AUTHORIZATION_REFUSAL.MARKER_CORRUPT };
  }
  if (!hasExactKeys(marker, AUTHORIZATION_MARKER_KEYS)) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.MARKER_CORRUPT };
  }
  if (marker.schemaVersion !== AUTHORIZATION_SCHEMA) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.MARKER_CORRUPT };
  }
  if (!Array.isArray(marker.grants)) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.MARKER_CORRUPT };
  }
  for (const entry of marker.grants) {
    if (!hasExactKeys(entry, AUTHORIZATION_GRANT_ENTRY_KEYS)) {
      return { ok: false, reason: AUTHORIZATION_REFUSAL.MARKER_CORRUPT };
    }
  }

  // 2. The marker must match the digest the sequencer supplied and the run.
  if (marker.authorizationDigest !== suppliedDigest) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.MARKER_DIGEST_MISMATCH };
  }
  if (runId && marker.runId !== runId) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.MARKER_RUN_MISMATCH };
  }
  if (registrySha256 && marker.registrySha256 !== registrySha256) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.MARKER_REGISTRY_MISMATCH };
  }

  // 3. The marker must have issued THIS grant id for THIS source.
  const entry = marker.grants.find((item) => String(item.order) === String(order));
  if (!entry) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_NOT_ISSUED };
  }
  if (String(entry.bvid) !== String(bvid)) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_ORDER_MISMATCH };
  }
  if (String(entry.grantId) !== String(grantId)) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_FILENAME_MISMATCH };
  }

  // 4. The grant file itself.
  const grantPath = path.join(grantDirectory, `${grantId}.grant.json`);
  let grant;
  try {
    grant = JSON.parse(fs.readFileSync(grantPath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_MISSING };
    }
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_CORRUPT };
  }
  if (!hasExactKeys(grant, AUTHORIZATION_GRANT_KEYS)) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_CORRUPT };
  }
  if (grant.schemaVersion !== GRANT_SCHEMA) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_CORRUPT };
  }

  // 5. The grant must agree with the TRUSTED marker on every bound field.
  if (grant.authorizationDigest !== marker.authorizationDigest) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_DIGEST_MISMATCH };
  }
  if (grant.runId !== marker.runId) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_RUN_MISMATCH };
  }
  if (grant.registrySha256 !== marker.registrySha256) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_REGISTRY_MISMATCH };
  }
  if (String(grant.order) !== String(order) || String(grant.bvid) !== String(bvid)) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_ORDER_MISMATCH };
  }
  const expectedIdentities = normalizeIdentities(identities);
  const grantedIdentities = Array.isArray(grant.identities) ? grant.identities : [];
  if (!grantedIdentities.every((item) => hasExactKeys(item, AUTHORIZATION_IDENTITY_KEYS))) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_CORRUPT };
  }
  if (JSON.stringify(grantedIdentities) !== JSON.stringify(expectedIdentities)) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_IDENTITY_MISMATCH };
  }

  // 6. The grant's OWN digest is not an authority: it must match the copy the
  //    marker holds. A forged, self-signed grant is refused here.
  if (grantDigest(grant) !== grant.grantDigest || grant.grantDigest !== entry.grantDigest) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_DIGEST_MISMATCH };
  }

  // 7. The grant id must equal a RECOMPUTATION from the trusted fields.
  const recomputedId = childGrantId({
    authorizationDigest: marker.authorizationDigest,
    runId: marker.runId,
    order,
    bvid,
  });
  if (recomputedId !== grantId || recomputedId !== entry.grantId) {
    return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_FILENAME_MISMATCH };
  }

  // 8. The per-source grant is consumed ATOMICALLY ONCE: a replay is refused.
  const usePath = path.join(grantDirectory, `${grantId}.used`);
  let useHandle;
  try {
    useHandle = fs.openSync(usePath, "wx", 0o600);
  } catch (error) {
    if (error && error.code === "EEXIST") {
      return { ok: false, reason: AUTHORIZATION_REFUSAL.GRANT_ALREADY_USED };
    }
    return { ok: false, reason: AUTHORIZATION_REFUSAL.STATE_CORRUPT };
  }
  try {
    fs.writeSync(useHandle, JSON.stringify({
      schemaVersion: GRANT_USE_SCHEMA,
      grantId,
      authorizationDigest: marker.authorizationDigest,
      runId: marker.runId,
      order: String(order),
      bvid: String(bvid),
      usedAt: new Date().toISOString(),
    }));
  } finally {
    fs.closeSync(useHandle);
  }

  return { ok: true, reason: null, grant: { ...grant, grantId } };
}
