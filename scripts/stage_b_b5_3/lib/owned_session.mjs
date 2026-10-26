// The OWNED session primitives of the B-5 runner.
//
// Everything here is a composition of EXISTING product/canary helpers:
//
//   * the cookie reader is the WP-B owned-session reader
//     (`e2e/lib/v3WpBVisibleSession/realAdapters.mjs`);
//   * the isolated vision-Provider metadata copy is the WP-B owned-session
//     helper (`e2e/lib/v3WpBVisibleSession/visionProvider.mjs`), which copies
//     the METADATA of the selected, verified Provider and never the secret:
//     the secret stays in the OS credential store under its frozen reference;
//   * the dependency preflight is the WP-B owned-session preflight
//     (`e2e/lib/v3WpBVisibleSession/preflight.mjs`).
//
// No secret is printed, no path is searched, and no second owner is created.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const productLib = path.join(repoRoot, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession");

/** The WP-B owned-session adapters (the cookie reader, the port/net helpers). */
export const realAdapters = await import(
  `file://${path.join(productLib, "realAdapters.mjs").replaceAll("\\", "/")}`
);
/** The WP-B owned-session vision-Provider metadata helper. */
export const visionProviderHelper = await import(
  `file://${path.join(productLib, "visionProvider.mjs").replaceAll("\\", "/")}`
);
/** The WP-B owned-session dependency preflight. */
export const productPreflight = await import(
  `file://${path.join(productLib, "preflight.mjs").replaceAll("\\", "/")}`
);
/**
 * The PRODUCT harness error class.
 *
 * It is the STABLE marker of an external-input block: the product refuses an
 * input with this class, and the harness maps it to a stable dependency code
 * instead of the generic `Error` name.
 */
export const productHarnessError = (await import(
  `file://${path.join(productLib, "plan.mjs").replaceAll("\\", "/")}`
)).HarnessError;

/**
 * The environment variables that may carry the EXPLICITLY authorized cookie
 * file. The first one that is set wins; nothing is searched for.
 */
export const COOKIE_FILE_ENV = "NAVIA_BILIBILI_COOKIE_FILE";
export const COOKIE_FILE_ENV_PRODUCT = "NAVIA_V3_BILIBILI_COOKIE_FILE";

/**
 * The ONE authorized fallback: the Windows Desktop known folder and the exact
 * file name the user authorized. It is a SINGLE exact path — the same one the
 * product's own e2e harnesses use for the WSL view of that known folder. The
 * Desktop, the home directory, the drives and other repositories are never
 * searched, and no directory is ever listed.
 */
export const AUTHORIZED_DESKTOP_COOKIE_PATH =
  "/mnt/c/Users/Administrator/Desktop/myCk.txt";

/** The frozen cookie names the product requires. */
export const REQUIRED_COOKIE_NAMES = Object.freeze(["SESSDATA"]);

/**
 * Resolve the authorized cookie file.
 *
 * @returns {{path: string|null, source: string}}
 */
export function resolveCookieFile({ environment = process.env } = {}) {
  const explicit = environment[COOKIE_FILE_ENV] || environment[COOKIE_FILE_ENV_PRODUCT] || "";
  if (explicit) {
    return { path: path.resolve(explicit), source: "explicit-environment" };
  }
  return { path: AUTHORIZED_DESKTOP_COOKIE_PATH, source: "windows-desktop-known-folder" };
}

/**
 * Inspect the authorized cookie file WITHOUT exposing anything.
 *
 * The receipt carries the file's existence, the REQUIRED NAME presence, the
 * number of usable cookies and a digest of the NAMES. It never carries a
 * value, a value length, the private path or the file's content.
 */
export function inspectCookieFile({ cookieFile }) {
  const base = {
    resolved: Boolean(cookieFile),
    readable: false,
    requiredNamesPresent: false,
    missingRequiredNames: [...REQUIRED_COOKIE_NAMES],
    usableCookieCount: 0,
    allowedNameSetSha256: null,
    failureCode: null,
  };
  if (!cookieFile) {
    return { ...base, failureCode: "COOKIE_PREREQ_NO_ENV" };
  }
  let cookies;
  try {
    cookies = realAdapters.readSuppliedCookies(cookieFile);
  } catch (error) {
    // The product reader refuses a file that carries no usable SESSDATA.
    // That is a READABLE file with a missing required NAME, not an unreadable
    // one, and the two failures stay distinguishable.
    const message = String(error?.message ?? error);
    if (message.includes("SESSDATA")) {
      return { ...base, readable: true, failureCode: "COOKIE_PREREQ_REQUIRED_MISSING" };
    }
    return { ...base, failureCode: "COOKIE_PREREQ_FILE_UNREADABLE" };
  }
  const names = [...new Set(cookies.map((cookie) => cookie.name))].sort();
  const present = new Set(names);
  const missing = REQUIRED_COOKIE_NAMES.filter((name) => !present.has(name));
  return {
    resolved: true,
    readable: true,
    requiredNamesPresent: missing.length === 0,
    missingRequiredNames: missing,
    usableCookieCount: cookies.length,
    // A digest of the NAMES only: a name is not a secret and no value is
    // derivable from it.
    allowedNameSetSha256: createHash("sha256").update(names.join(",")).digest("hex"),
    failureCode: missing.length === 0 ? null : "COOKIE_PREREQ_REQUIRED_MISSING",
  };
}

/**
 * The product paths an owned session needs.
 *
 * They are the PRODUCT's own roots, resolved explicitly. Nothing is guessed
 * and nothing is created inside the historical evidence tree.
 */
export function resolveOwnedProductPaths({ environment = process.env, repositoryRoot = repoRoot } = {}) {
  const managedTools = environment.NAVIA_MEDIA_TOOL_ROOT
    ? path.resolve(environment.NAVIA_MEDIA_TOOL_ROOT)
    : path.join(repositoryRoot, ".navia/managed-tools");
  const asrRoot = environment.NAVIA_ASR_ROOT
    ? path.resolve(environment.NAVIA_ASR_ROOT)
    : path.join(repositoryRoot, ".navia/asr");
  const extensionRoot = environment.NAVIA_WP_B_EXTENSION_ROOT
    ? path.resolve(environment.NAVIA_WP_B_EXTENSION_ROOT)
    : path.join(repositoryRoot, "apps/chrome-extension/chrome-mv3-unpacked");
  const visionProviderSourceDb = environment.NAVIA_WP_B_VISION_PROVIDER_DB
    ? path.resolve(environment.NAVIA_WP_B_VISION_PROVIDER_DB)
    : path.join(repositoryRoot, ".navia/navia.sqlite3");
  return { managedTools, asrRoot, extensionRoot, visionProviderSourceDb };
}
