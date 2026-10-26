// The PRE-GRANTED extension fixture.
//
// The product extension declares its host permissions and the `cookies`
// permission as OPTIONAL, so the product asks for them through a NATIVE
// Chrome prompt that no automation can answer. The visible canary has always
// solved this with a test fixture: a copy of the built bundle whose manifest
// carries the same permissions as REQUIRED ones.
//
// This module is that fixture builder. It is the CANARY's own logic, moved
// here so the B-5 runner and the canary share ONE implementation.
//
// The promotion is FROZEN and narrow:
//   * every `optional_host_permissions` entry becomes a `host_permissions`
//     entry — the same origins, nothing new;
//   * only `cookies` is promoted out of `optional_permissions`;
//   * no bogus permission name is ever added.
//
// The product bundle on disk is NEVER modified: the fixture is an owned copy.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** The ONE permission that is promoted out of `optional_permissions`. */
export const PROMOTED_PERMISSION = "cookies";

function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/**
 * Build the pre-granted fixture of the built extension bundle.
 *
 * @param {string} srcDir the built bundle (read-only)
 * @param {string} parentDir the owned parent directory
 * @returns {{fixturePath: string, originalSha: string, modifiedSha: string, merged: string[]}}
 */
export function buildPregrantedFixture(srcDir, parentDir = os.tmpdir()) {
  fs.mkdirSync(parentDir, { recursive: true, mode: 0o700 });
  const dst = fs.mkdtempSync(path.join(parentDir, "navia-b5-3-ext-"));
  execFileSync("cp", ["-r", `${srcDir}/.`, dst]);
  const manifestPath = path.join(dst, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    fs.rmSync(dst, { recursive: true, force: true });
    throw new Error(`fixture source missing manifest: ${srcDir}`);
  }
  const originalSha = sha256File(manifestPath);
  const original = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  // The host permissions become required, so the fixture never asks for a
  // native host prompt.
  const optionalHostPerms = original.optional_host_permissions || [];
  const requiredHostPerms = original.host_permissions || [];
  const merged = Array.from(new Set([...requiredHostPerms, ...optionalHostPerms]));
  delete original.optional_host_permissions;
  original.host_permissions = merged;

  // ONLY `cookies` is promoted out of `optional_permissions`. A future
  // optional permission is NOT silently granted.
  const filteredOptional = (original.optional_permissions || []).filter(
    (permission) => permission !== PROMOTED_PERMISSION,
  );
  if (filteredOptional.length === 0) {
    delete original.optional_permissions;
  } else {
    original.optional_permissions = filteredOptional;
  }
  original.permissions = Array.from(new Set([
    ...(original.permissions || []),
    PROMOTED_PERMISSION,
  ]));

  fs.writeFileSync(manifestPath, JSON.stringify(original, null, 2));
  const modifiedSha = sha256File(manifestPath);
  return { fixturePath: dst, originalSha, modifiedSha, merged };
}

/**
 * Prove that a fixture manifest carries the promoted permissions.
 *
 * It is the OFFLINE proof that the visible run needs no native prompt.
 */
export function inspectPregrantedManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return { present: false, cookiesRequired: false, optionalHostPermissions: 0 };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return {
    present: true,
    cookiesRequired: (manifest.permissions || []).includes(PROMOTED_PERMISSION),
    cookiesOptional: (manifest.optional_permissions || []).includes(PROMOTED_PERMISSION),
    optionalHostPermissions: (manifest.optional_host_permissions || []).length,
    hostPermissions: (manifest.host_permissions || []).length,
  };
}
