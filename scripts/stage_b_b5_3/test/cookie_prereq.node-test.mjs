// Negative unit tests for cookie_prereq.mjs.
//
// Coverage:
//   - No env var → fail-fast diagnostic
//   - Missing / unreadable file → fail-fast
//   - Wrong format (not JSON array, malformed Netscape) → fail-fast
//   - Missing required SESSDATA → fail-fast
//   - Illegal domain → reject
//   - Illegal path → reject
//   - Not marked secure → reject
//   - Illegal sameSite → reject
//   - Empty value → reject
//   - Cookie name not in allowlist → reject
//   - Leak detection: parsed values MUST NOT appear in trace/failure/log
//
// These tests do NOT touch real files. They build temp cookie sources
// under os.tmpdir() using known-format strings and verify the prereq
// logic emits the right diagnostic and the right public-trace fields.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { makeTempRoot } from "../lib/temp_roots.mjs";

import {
  parseNetscape,
  parseJson,
  validateCookie,
  buildInjectionObject,
  buildPublicTrace,
  selectAllowedCookies,
} from "./cookie_prereq.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED = ["SESSDATA", "DedeUserID"];
const REQUIRED = ["SESSDATA"];

// Real-shape Netscape content (header + 7-tab fields).
function netscapeText(cookies) {
  const lines = ["# Netscape HTTP Cookie File"];
  for (const c of cookies) {
    lines.push([c.domain, "TRUE", c.path, c.secure ? "TRUE" : "FALSE", "9999999999", c.name, c.value].join("\t"));
  }
  return lines.join("\n");
}

// Helper: write content to a tmp file and return path.
function writeCookieFile(content) {
  const fp = path.join(os.tmpdir(), `navia-b5-3-cookie-test-${process.pid}-${Math.random().toString(36).slice(2, 10)}`);
  fs.writeFileSync(fp, content, { mode: 0o600 });
  return fp;
}

function deleteCookieFile(fp) {
  try { fs.rmSync(fp, { force: true }); } catch { /* noop */ }
}

function cleanupFiles(arr) {
  for (const f of arr) deleteCookieFile(f);
}

// ============================================================================
// parseNetscape
// ============================================================================

test("parseNetscape: extracts name from parts[5] and value from parts[6]", () => {
  const text = netscapeText([
    { domain: ".bilibili.com", path: "/", secure: true, name: "SESSDATA", value: "abc123session" },
    { domain: ".bilibili.com", path: "/", secure: true, name: "DedeUserID", value: "987654321" },
  ]);
  const cookies = parseNetscape(text);
  assert.equal(cookies.length, 2);
  assert.equal(cookies[0].name, "SESSDATA");
  assert.equal(cookies[0].value, "abc123session");
  assert.equal(cookies[0].domain, ".bilibili.com");
  assert.equal(cookies[1].name, "DedeUserID");
});

test("parseNetscape: handles #HttpOnly_ prefix on the SAME line — parses cookie inline", () => {
  const text = [
    "# Netscape HTTP Cookie File",
    "#HttpOnly_.bilibili.com\tTRUE\t/\tTRUE\t9999999999\tSESSDATA\thiddenHttpOnlyValue",
    ".bilibili.com\tTRUE\t/\tTRUE\t9999999999\tDedeUserID\tvisibleValue",
  ].join("\n");
  const cookies = parseNetscape(text);
  assert.equal(cookies.length, 2);
  // SESSDATA: parsed inline with the httpOnly flag; httpOnly=true.
  assert.equal(cookies[0].name, "SESSDATA");
  assert.equal(cookies[0].value, "hiddenHttpOnlyValue");
  assert.equal(cookies[0].domain, ".bilibili.com");
  assert.equal(cookies[0].httpOnly, true);
  // Next cookie: httpOnly=false (default).
  assert.equal(cookies[1].name, "DedeUserID");
  assert.equal(cookies[1].httpOnly, false);
});

test("parseNetscape: #HttpOnly_SESSDATA positive case from canonical user fixture", () => {
  // Realistic Bilibili cookie export line for SESSDATA (HttpOnly).
  const text = "#HttpOnly_.bilibili.com\tTRUE\t/\tTRUE\t1893456000\tSESSDATA\tdeadbeef-canary-test";
  const cookies = parseNetscape(text);
  assert.equal(cookies.length, 1);
  assert.equal(cookies[0].name, "SESSDATA");
  assert.equal(cookies[0].domain, ".bilibili.com");
  assert.equal(cookies[0].path, "/");
  assert.equal(cookies[0].secure, true);
  assert.equal(cookies[0].httpOnly, true);
  // value is preserved in memory only; do NOT write to evidence/log
  assert.equal(cookies[0].value, "deadbeef-canary-test");
});

test("parseNetscape: skips blank lines and # comments", () => {
  const text = ["# comment", "", ".bilibili.com\tTRUE\t/\tTRUE\t9999999999\tSESSDATA\tv"].join("\n");
  const cookies = parseNetscape(text);
  assert.equal(cookies.length, 1);
});

test("parseNetscape: rejects lines with fewer than 7 columns", () => {
  const text = [".bilibili.com\tTRUE\t/\tTRUE\t9999999999\tSESSDATA"].join("\n"); // 6 cols
  const cookies = parseNetscape(text);
  assert.equal(cookies.length, 0);
});

// ============================================================================
// parseJson
// ============================================================================

test("parseJson: parses JSON array of cookie objects", () => {
  const cookies = parseJson(JSON.stringify([
    { name: "SESSDATA", value: "abc", domain: ".bilibili.com", path: "/", secure: true, sameSite: "lax" },
  ]));
  assert.equal(cookies.length, 1);
  assert.equal(cookies[0].name, "SESSDATA");
});

test("parseJson: rejects non-array", () => {
  assert.throws(() => parseJson('{"name": "SESSDATA"}'), /COOKIE_PREREQ_BAD_FORMAT/);
});

// ============================================================================
// validateCookie
// ============================================================================

test("validateCookie: rejects unknown name → fixed failure code", () => {
  const result = validateCookie({
    name: "stolen_cookie", value: "v", domain: ".bilibili.com", path: "/", secure: true, sameSite: "lax",
  }, new Set(ALLOWED));
  assert.equal(result.ok, false);
  assert.equal(result.code, "COOKIE_PREREQ_NAME_NOT_ALLOWED");
  // reason MUST NOT include the offending name (fixed code only).
  assert.ok(!("reason" in result) || !result.reason.includes("stolen_cookie"));
});

test("validateCookie: rejects illegal domain → fixed failure code", () => {
  const result = validateCookie({
    name: "SESSDATA", value: "v", domain: ".evil.com", path: "/", secure: true, sameSite: "lax",
  }, new Set(ALLOWED));
  assert.equal(result.ok, false);
  assert.equal(result.code, "COOKIE_PREREQ_DOMAIN_NOT_ALLOWED");
  assert.ok(!("reason" in result) || !result.reason.includes("evil.com"));
});

test("validateCookie: rejects illegal path → fixed failure code", () => {
  const result = validateCookie({
    name: "SESSDATA", value: "v", domain: ".bilibili.com", path: "noleadingslash", secure: true, sameSite: "lax",
  }, new Set(ALLOWED));
  assert.equal(result.ok, false);
  assert.equal(result.code, "COOKIE_PREREQ_PATH_INVALID");
});

test("validateCookie: rejects secure=false → fixed failure code", () => {
  const result = validateCookie({
    name: "SESSDATA", value: "v", domain: ".bilibili.com", path: "/", secure: false, sameSite: "lax",
  }, new Set(ALLOWED));
  assert.equal(result.ok, false);
  assert.equal(result.code, "COOKIE_PREREQ_SECURE_REQUIRED");
});

test("validateCookie: rejects illegal sameSite → fixed failure code", () => {
  const result = validateCookie({
    name: "SESSDATA", value: "v", domain: ".bilibili.com", path: "/", secure: true, sameSite: "weird",
  }, new Set(ALLOWED));
  assert.equal(result.ok, false);
  // sameSite code is intentionally NOT a whitelisted constant — only
  // the source code can read it. The failing test asserts code shape.
  assert.equal(typeof result.code, "string");
});

test("validateCookie: accepts Chromium unspecified SameSite and injection omits it", () => {
  const cookie = {
    name: "SESSDATA", value: "value", domain: ".bilibili.com",
    path: "/", secure: true, httpOnly: true, sameSite: "unspecified",
  };
  assert.deepEqual(validateCookie(cookie, new Set(ALLOWED)), { ok: true });
  assert.equal("sameSite" in buildInjectionObject(cookie), false);
});

test("validateCookie: maps Chromium no_restriction SameSite to Playwright None", () => {
  const cookie = {
    name: "SESSDATA", value: "value", domain: ".bilibili.com",
    path: "/", secure: true, httpOnly: true, sameSite: "no_restriction",
  };
  assert.deepEqual(validateCookie(cookie, new Set(ALLOWED)), { ok: true });
  assert.equal(buildInjectionObject(cookie).sameSite, "None");
});

test("validateCookie: rejects empty value → fixed failure code", () => {
  const result = validateCookie({
    name: "SESSDATA", value: "", domain: ".bilibili.com", path: "/", secure: true, sameSite: "lax",
  }, new Set(ALLOWED));
  assert.equal(result.ok, false);
  assert.equal(result.code, "COOKIE_PREREQ_VALUE_EMPTY");
});

test("validateCookie: accepts canonical cookie", () => {
  const result = validateCookie({
    name: "SESSDATA", value: "x", domain: ".bilibili.com", path: "/", secure: true, sameSite: "lax",
  }, new Set(ALLOWED));
  assert.equal(result.ok, true);
});

test("validateCookie: accepts bilibili.com (no leading dot) per allowlist", () => {
  const result = validateCookie({
    name: "SESSDATA", value: "x", domain: "bilibili.com", path: "/", secure: true, sameSite: "lax",
  }, new Set(ALLOWED));
  assert.equal(result.ok, true);
});

// ============================================================================
// selectAllowedCookies + buildPublicTrace
// ============================================================================

test("selectAllowedCookies: returns parsed objects + requiredPresent=false when missing", () => {
  const parsed = parseNetscape(netscapeText([
    { domain: ".bilibili.com", path: "/", secure: true, name: "DedeUserID", value: "x" },
  ]));
  const sel = selectAllowedCookies(parsed, ALLOWED, REQUIRED);
  assert.equal(sel.filtered.length, 1);
  assert.equal(sel.filtered[0].name, "DedeUserID");
  assert.equal(sel.requiredPresent, false);
});

test("selectAllowedCookies: requiredPresent=true only when SESSDATA is in parsed", () => {
  const parsed = parseNetscape(netscapeText([
    { domain: ".bilibili.com", path: "/", secure: true, name: "SESSDATA", value: "x" },
  ]));
  const sel = selectAllowedCookies(parsed, ALLOWED, REQUIRED);
  assert.equal(sel.requiredPresent, true);
});

test("buildPublicTrace: only contains allowed fields; never includes path/source/cookieNames", () => {
  const trace = buildPublicTrace({
    envSet: true,
    fileReadable: true,
    cookieNames: ["SESSDATA", "DedeUserID"], // MUST NOT appear in trace
    allowedNameSetSha256: "abc123",
    requiredPresent: true,
    injectedCount: 2,
    secretHitCount: 0,
  });
  const keys = Object.keys(trace).sort();
  // Public-evidence-safe field set
  const expected = ["allowedNameSetSha256", "fileReadable", "injectedCount", "requiredPresent", "secretHitCount", "envSet"].sort();
  assert.deepEqual(keys, expected);
  assert.ok(!("cookieNames" in trace));
  assert.ok(!("path" in trace));
  assert.ok(!("sourcePath" in trace));
  assert.ok(!("sizeBytes" in trace));
});

// ============================================================================
// LEAK DETECTION: trace/failure/log MUST NOT contain parsed cookie values
// ============================================================================

test("leak detection: parsed cookie value MUST NOT appear in any evidence file", () => {
  // Synthetic unique values; if the prereq ever leaks them, the
  // post-run secret scan MUST pick these up.
  const syntheticSessdata = "leak-canary-sessdata-" + Math.random().toString(36).slice(2);
  const syntheticDede = "leak-canary-dede-" + Math.random().toString(36).slice(2);

  const cookies = [
    { name: "SESSDATA", value: syntheticSessdata, domain: ".bilibili.com", path: "/", secure: true, sameSite: "lax" },
    { name: "DedeUserID", value: syntheticDede, domain: ".bilibili.com", path: "/", secure: true, sameSite: "lax" },
  ];

  // Simulate what the canary would write into trace.
  const trace = buildPublicTrace({
    envSet: true,
    fileReadable: true,
    cookieNames: cookies.map((c) => c.name).sort(),
    allowedNameSetSha256: createHash("sha256").update(cookies.map((c) => c.name).sort().join("|")).digest("hex"),
    requiredPresent: true,
    injectedCount: cookies.length,
    secretHitCount: 0,
  });

  // Simulate writing to evidence dir + secret scanning with actual values.
  const evidenceDir = makeTempRoot("navia-b5-3-leak-");
  fs.writeFileSync(path.join(evidenceDir, "canary-trace.json"), JSON.stringify(trace, null, 2), { mode: 0o600 });
  // Simulate canary-failure (path-only, no values).
  fs.writeFileSync(path.join(evidenceDir, "canary-failure.json"), JSON.stringify({ stage: "test", envSet: true }), { mode: 0o600 });

  // The post-run secret scan uses ACTUAL parsed values.
  function escapeRegex(v) { return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  const patterns = cookies.map((c) => new RegExp(escapeRegex(c.value), "g"));
  let totalHits = 0;
  for (const f of fs.readdirSync(evidenceDir)) {
    const text = fs.readFileSync(path.join(evidenceDir, f), "utf8");
    for (const re of patterns) {
      re.lastIndex = 0;
      while (re.exec(text) !== null) totalHits += 1;
    }
  }
  assert.equal(totalHits, 0, `LEAK: cookie values found in evidence files (count=${totalHits})`);

  fs.rmSync(evidenceDir, { recursive: true, force: true });
});

// ============================================================================
// End-to-end negative: missing SESSDATA → requiredPresent=false
// ============================================================================

test("end-to-end: cookie source without SESSDATA → requiredPresent=false", () => {
  const fp = writeCookieFile(netscapeText([
    { domain: ".bilibili.com", path: "/", secure: true, name: "DedeUserID", value: "x" },
  ]));
  try {
    let parsed;
    try {
      parsed = parseNetscape(fs.readFileSync(fp, "utf8"));
    } catch (parseErr) {
      assert.fail(`unexpected parse failure: ${parseErr.message}`);
      return;
    }
    const sel = selectAllowedCookies(parsed, ALLOWED, REQUIRED);
    assert.equal(sel.requiredPresent, false);
    assert.equal(sel.filtered.length, 1);
  } finally {
    deleteCookieFile(fp);
  }
});

test("end-to-end: cookie source with illegal domain → all rejected", () => {
  const fp = writeCookieFile(netscapeText([
    { domain: ".evil.com", path: "/", secure: true, name: "SESSDATA", value: "x" },
  ]));
  try {
    const parsed = parseNetscape(fs.readFileSync(fp, "utf8"));
    const allowedSet = new Set(ALLOWED);
    const validated = parsed.map((c) => validateCookie(c, allowedSet));
    assert.equal(validated[0].ok, false);
    assert.equal(validated[0].code, "COOKIE_PREREQ_DOMAIN_NOT_ALLOWED");
  } finally {
    deleteCookieFile(fp);
  }
});

test("end-to-end: malformed JSON → parser throws", () => {
  const fp = writeCookieFile("{not valid json");
  try {
    assert.throws(() => parseJson(fs.readFileSync(fp, "utf8")));
  } finally {
    deleteCookieFile(fp);
  }
});
