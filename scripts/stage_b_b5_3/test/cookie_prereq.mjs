// Pure parser/validator for the P0 muted canary's cookie prerequisite.
// Extracted into its own file so it can be unit-tested without launching
// Chrome, Runtime, or reading real files. Raw cookie values are returned
// ONLY to the LOCAL caller (the canary) so it can inject them into the
// fresh test-only persistent profile. That profile is mode 0700 and is
// removed by the canary's finally block. Raw values MUST NEVER enter
// public evidence (trace / failure / log). Use Node's fs.readFileSync
// + the returned `filtered` array as an in-memory handoff.
//
// Fixed failure codes (safe to log without leaking name/path/value):
//   COOKIE_PREREQ_NO_ENV
//   COOKIE_PREREQ_FILE_MISSING
//   COOKIE_PREREQ_FILE_UNREADABLE
//   COOKIE_PREREQ_BAD_FORMAT
//   COOKIE_PREREQ_NAME_NOT_ALLOWED
//   COOKIE_PREREQ_DOMAIN_NOT_ALLOWED
//   COOKIE_PREREQ_PATH_INVALID
//   COOKIE_PREREQ_SECURE_REQUIRED
//   COOKIE_PREREQ_SAMESITE_INVALID
//   COOKIE_PREREQ_VALUE_EMPTY
//   COOKIE_PREREQ_REQUIRED_MISSING
//   COOKIE_PREREQ_UNKNOWN_NAME
//
// SameSite normalization (Playwright context.addCookies() requires
// "Lax" / "Strict" / "None" — capitalized). This module outputs
// lowercase for storage; the canary caller normalizes before injecting.

const ALLOWED_DOMAINS = new Set(["bilibili.com", ".bilibili.com"]);
const ALLOWED_PATHS_VALIDATE = (p) => typeof p === "string" && p.length > 0 && p.startsWith("/");
// Chromium cookie exports commonly use `unspecified`. Preserve that state by
// omitting SameSite from the Playwright injection object instead of coercing
// it to a different policy.
const ALLOWED_SAMESITES = new Set(["lax", "strict", "none", "no_restriction", "unspecified"]);
const ALLOWED_SECURE = true;
// Required cookie names — at minimum SESSDATA. The canary will refuse to
// proceed if SESSDATA is missing from the parsed source.
const REQUIRED_COOKIE_NAMES = Object.freeze(["SESSDATA"]);

export const COOKIE_PREREQ_PUBLIC_FIELDS = Object.freeze([
  "envSet",
  "fileReadable",
  "allowedNameSetSha256",
  "requiredPresent",
  "injectedCount",
  "secretHitCount",
]);

// Failure codes. NOT a whitelist — these are the ONLY allowed strings.
// Validation rules return objects with these codes + a `reason` that is
// redacted of name/domain/path so callers cannot accidentally leak
// identifying details.
export const COOKIE_FAIL = Object.freeze({
  NO_ENV: "COOKIE_PREREQ_NO_ENV",
  FILE_MISSING: "COOKIE_PREREQ_FILE_MISSING",
  FILE_UNREADABLE: "COOKIE_PREREQ_FILE_UNREADABLE",
  BAD_FORMAT: "COOKIE_PREREQ_BAD_FORMAT",
  NAME_NOT_ALLOWED: "COOKIE_PREREQ_NAME_NOT_ALLOWED",
  DOMAIN_NOT_ALLOWED: "COOKIE_PREREQ_DOMAIN_NOT_ALLOWED",
  PATH_INVALID: "COOKIE_PREREQ_PATH_INVALID",
  SECURE_REQUIRED: "COOKIE_PREREQ_SECURE_REQUIRED",
  SAMESITE_INVALID: "COOKIE_PREREQ_SAMESITE_INVALID",
  VALUE_EMPTY: "COOKIE_PREREQ_VALUE_EMPTY",
  REQUIRED_MISSING: "COOKIE_PREREQ_REQUIRED_MISSING",
  UNKNOWN_NAME: "COOKIE_PREREQ_UNKNOWN_NAME",
  INJECTION_FAILED: "COOKIE_PREREQ_INJECTION_FAILED",
});

function fixedFailure(code) {
  return { ok: false, code };
}

// Parse a single Netscape cookie line. httpOnly_ is a line-level marker
// (NOT cross-line state): strip prefix and parse the same line.
export function parseNetscapeLine(rawLine) {
  const line = rawLine.trimEnd();
  if (!line) return null;
  let httpOnly = false;
  let body = line;
  if (line.startsWith("#HttpOnly_")) {
    httpOnly = true;
    body = line.slice("#HttpOnly_".length);
  } else if (line.startsWith("#")) {
    return null; // comment
  }
  const parts = body.split("\t");
  // Netscape: domain TAB flag TAB path TAB secure TAB expiry TAB name TAB value (7 cols).
  if (parts.length < 7) return null;
  return {
    name: parts[5],
    value: parts[6],
    domain: parts[0],
    path: parts[2],
    secure: parts[3] === "TRUE",
    httpOnly,
    sameSite: "lax",
  };
}

export function parseNetscape(text) {
  const cookies = [];
  for (const line of text.split(/\r?\n/)) {
    const c = parseNetscapeLine(line);
    if (c && c.name) cookies.push(c);
  }
  return cookies;
}

export function parseJson(text) {
  let arr;
  try {
    arr = JSON.parse(text);
  } catch (e) {
    throw new Error(`${COOKIE_FAIL.BAD_FORMAT}: json parse failed`);
  }
  if (!Array.isArray(arr)) {
    throw new Error(`${COOKIE_FAIL.BAD_FORMAT}: must be array`);
  }
  return arr.map((c) => ({
    name: String(c?.name || ""),
    value: String(c?.value || ""),
    domain: String(c?.domain || ""),
    path: String(c?.path || "/"),
    secure: Boolean(c?.secure),
    httpOnly: Boolean(c?.httpOnly),
    sameSite: typeof c?.sameSite === "string" ? c.sameSite.toLowerCase() : "lax",
  })).filter((c) => c.name);
}

// Normalize sameSite for Playwright context.addCookies (Lax/Strict/None).
export function normalizeSameSite(s) {
  const v = (s || "").toLowerCase();
  if (v === "lax") return "Lax";
  if (v === "strict") return "Strict";
  if (v === "none" || v === "no_restriction") return "None";
  return null;
}

// Build a Playwright-compatible cookie object for context.addCookies.
// Caller passes raw cookie fields + a secure=true invariant. We
// normalize sameSite + produce expires far in the future. httpOnly
// must be true (Bilibili SESSDATA is HttpOnly).
export function buildInjectionObject(c) {
  const expires = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // +7d
  const sameSite = normalizeSameSite(c.sameSite);
  const obj = {
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || "/",
    secure: Boolean(c.secure),
    httpOnly: Boolean(c.httpOnly),
    expires,
  };
  if (sameSite) obj.sameSite = sameSite;
  return obj;
}

export function validateCookie(c, allowedNamesSet) {
  if (!c || typeof c.name !== "string" || c.name.length === 0) {
    return fixedFailure(COOKIE_FAIL.NAME_NOT_ALLOWED);
  }
  if (!allowedNamesSet.has(c.name)) {
    return fixedFailure(COOKIE_FAIL.NAME_NOT_ALLOWED);
  }
  const dom = (c.domain || "").toLowerCase();
  if (!ALLOWED_DOMAINS.has(dom)) {
    return fixedFailure(COOKIE_FAIL.DOMAIN_NOT_ALLOWED);
  }
  if (!ALLOWED_PATHS_VALIDATE(c.path)) {
    return fixedFailure(COOKIE_FAIL.PATH_INVALID);
  }
  if (c.secure !== ALLOWED_SECURE) {
    return fixedFailure(COOKIE_FAIL.SECURE_REQUIRED);
  }
  const sameSite = (c.sameSite || "").toLowerCase();
  if (!ALLOWED_SAMESITES.has(sameSite)) {
    return fixedFailure(COOKIE_FAIL.SAMESITE_INVALID);
  }
  if (!c.value || c.value.length === 0) {
    return fixedFailure(COOKIE_FAIL.VALUE_EMPTY);
  }
  return { ok: true };
}

export function buildPublicTrace({ envSet, fileReadable, allowedNameSetSha256, requiredPresent, injectedCount, secretHitCount }) {
  return {
    envSet: Boolean(envSet),
    fileReadable: Boolean(fileReadable),
    allowedNameSetSha256: allowedNameSetSha256 || null,
    requiredPresent: Boolean(requiredPresent),
    injectedCount: Number(injectedCount) || 0,
    secretHitCount: Number(secretHitCount) || 0,
  };
}

export function selectAllowedCookies(parsedCookies, allowedNamesList, requiredList) {
  const allowedNamesSet = new Set(allowedNamesList);
  const filtered = parsedCookies.filter((c) => allowedNamesSet.has(c.name));
  const requiredPresent = requiredList.length > 0 && requiredList.every((n) => filtered.some((c) => c.name === n));
  return {
    filtered,
    requiredPresent,
    allowedNamesSet,
  };
}

// Filter to allowlist + reject anything not in allowlist. Returns
// { filtered, ok, rejectionCodes }. Unknown-name rejection codes are
// aggregated; the caller uses these to fail-fast.
export function enforceAllowlist(parsedCookies, allowedNamesList) {
  const allowedNamesSet = new Set(allowedNamesList);
  const filtered = [];
  const rejectionCodes = [];
  for (const c of parsedCookies) {
    if (allowedNamesSet.has(c.name)) {
      filtered.push(c);
    } else {
      rejectionCodes.push(COOKIE_FAIL.UNKNOWN_NAME);
    }
  }
  return {
    filtered,
    rejectionCodes,
    ok: rejectionCodes.length === 0,
  };
}
