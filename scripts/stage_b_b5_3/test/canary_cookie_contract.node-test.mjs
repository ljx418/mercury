// Integration tests for the canary cookie contract. These do NOT launch
// Chrome, Runtime, or read real files. They directly import the helper
// module and verify:
//   - Manifest does not enlarge other optional permissions
//   - Trace fields are EXACTLY the 6 frozen fields (no path / sizeBytes /
//     cookieNames leak)
//   - Prerequisite failure (missing env, malformed JSON, missing SESSDATA,
//     illegal domain) returns the FIXED failure code
//   - Leak detection: when actual cookie values are scanned across
//     evidence files, hitCount is correctly reported

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeTempRoot } from "../lib/temp_roots.mjs";

import {
  parseNetscape,
  parseJson,
  validateCookie,
  buildInjectionObject,
  enforceAllowlist,
  buildPublicTrace,
  COOKIE_FAIL,
} from "./cookie_prereq.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED = ["SESSDATA"];
const REQUIRED = ["SESSDATA"];

// Fixture manifest scanner (inline copy of the canary's contract logic).
function scanFixtureManifestForEnlargement(originalManifest, modifiedManifest) {
  const origOptional = new Set(originalManifest.optional_permissions || []);
  const modPermissions = new Set(modifiedManifest.permissions || []);
  // Cookies must be promoted (in permissions but not in optional).
  if (!modPermissions.has("cookies")) return { ok: false, reason: "cookies not in permissions" };
  if (origOptional.has("cookies") && (modifiedManifest.optional_permissions || []).includes("cookies")) {
    return { ok: false, reason: "cookies still in optional_permissions (duplicate)" };
  }
  // Other optional permissions must NOT be silently enlarged.
  for (const p of origOptional) {
    if (p === "cookies") continue;
    if (modPermissions.has(p)) {
      return { ok: false, reason: `optional permission "${p}" was silently promoted to permissions` };
    }
  }
  return { ok: true };
}

// Canonical cookie source content used by positive integration tests.
function netscapeContent(cookies) {
  const lines = ["# Netscape HTTP Cookie File"];
  for (const c of cookies) {
    lines.push([c.domain, "TRUE", c.path, c.secure ? "TRUE" : "FALSE", "9999999999", c.name, c.value].join("\t"));
  }
  return lines.join("\n");
}

function tmpFile(content) {
  const fp = path.join(os.tmpdir(), `navia-b5-3-canary-cookie-${process.pid}-${Math.random().toString(36).slice(2, 10)}`);
  fs.writeFileSync(fp, content, { mode: 0o600 });
  return fp;
}

// ============================================================================
// Manifest contract — does NOT silently enlarge
// ============================================================================

test("manifest contract: cookies promotion keeps other optional permissions untouched", () => {
  const original = {
    permissions: ["activeTab"],
    optional_permissions: ["cookies", "history", "tabs", "bookmarks"],
    optional_host_permissions: ["https://*.example.com/*"],
  };
  // Mirror canary's buildPregrantedFixture rules:
  // - remove cookies from optional
  // - add cookies to permissions
  // - delete optional_permissions if empty
  const modified = {
    permissions: Array.from(new Set([...(original.permissions || []), "cookies"])),
    optional_host_permissions: original.optional_host_permissions,
  };
  const filtered = (original.optional_permissions || []).filter((p) => p !== "cookies");
  if (filtered.length > 0) modified.optional_permissions = filtered;

  const scan = scanFixtureManifestForEnlargement(original, modified);
  assert.equal(scan.ok, true, `unexpected enlargement: ${scan.reason}`);
  // history/tabs/bookmarks must remain in optional_permissions.
  for (const p of ["history", "tabs", "bookmarks"]) {
    assert.ok(modified.optional_permissions.includes(p), `${p} was lost`);
  }
  // cookies must be in permissions, NOT in optional_permissions.
  assert.ok(modified.permissions.includes("cookies"));
  assert.ok(!modified.optional_permissions.includes("cookies"));
});

test("manifest contract: when cookies is the only optional, optional_permissions key is deleted", () => {
  const original = { optional_permissions: ["cookies"] };
  const filtered = (original.optional_permissions || []).filter((p) => p !== "cookies");
  const modified = {};
  if (filtered.length > 0) modified.optional_permissions = filtered;
  modified.permissions = ["cookies"];
  assert.ok(!("optional_permissions" in modified));
});

// ============================================================================
// Trace contract — exactly 6 fields, no leakable data
// ============================================================================

test("trace contract: buildPublicTrace returns exactly 6 frozen fields", () => {
  const t = buildPublicTrace({
    envSet: true, fileReadable: true, allowedNameSetSha256: "abc",
    requiredPresent: true, injectedCount: 2, secretHitCount: 0,
  });
  assert.deepEqual(Object.keys(t).sort(), [
    "allowedNameSetSha256", "envSet", "fileReadable", "injectedCount", "requiredPresent", "secretHitCount",
  ]);
});

test("trace contract: trace NEVER contains path / sizeBytes / cookieNames / sourcePath even when provided", () => {
  const t = buildPublicTrace({
    envSet: true,
    fileReadable: true,
    allowedNameSetSha256: "abc",
    requiredPresent: true,
    injectedCount: 1,
    secretHitCount: 0,
    // Adversarial extra keys — must be ignored.
    cookieNames: ["SESSDATA"],
    sizeBytes: 999,
    sourcePath: "/tmp/leak",
    path: "/tmp/leak",
    rawValue: "leak",
  });
  // None of the leakable extras appear in the trace.
  assert.ok(!("cookieNames" in t));
  assert.ok(!("sizeBytes" in t));
  assert.ok(!("sourcePath" in t));
  assert.ok(!("path" in t));
  assert.ok(!("rawValue" in t));
});

// ============================================================================
// Prerequisite fail → fixed failure code
// ============================================================================

test("prereq fail: missing env → NO_ENV fixed code", () => {
  assert.equal(COOKIE_FAIL.NO_ENV, "COOKIE_PREREQ_NO_ENV");
});

test("prereq fail: missing file → FILE_MISSING fixed code", () => {
  assert.equal(COOKIE_FAIL.FILE_MISSING, "COOKIE_PREREQ_FILE_MISSING");
});

test("prereq fail: malformed JSON → BAD_FORMAT fixed code", () => {
  assert.throws(() => parseJson("{not valid"), /COOKIE_PREREQ_BAD_FORMAT/);
});

test("prereq fail: missing SESSDATA → REQUIRED_MISSING fixed code", () => {
  const text = netscapeContent([
    { domain: ".bilibili.com", path: "/", secure: true, name: "DedeUserID", value: "987654321" },
  ]);
  const parsed = parseNetscape(text);
  const allowResult = enforceAllowlist(parsed, ALLOWED);
  const filtered = allowResult.filtered;
  const requiredPresent = REQUIRED.every((n) => filtered.some((c) => c.name === n));
  assert.equal(requiredPresent, false);
  // The canary maps this to REQUIRED_MISSING.
  assert.equal(COOKIE_FAIL.REQUIRED_MISSING, "COOKIE_PREREQ_REQUIRED_MISSING");
});

test("prereq fail: illegal domain → DOMAIN_NOT_ALLOWED fixed code (not raw domain in diagnostic)", () => {
  const c = {
    name: "SESSDATA", value: "x",
    domain: ".evil.com", path: "/", secure: true, sameSite: "lax",
  };
  const r = validateCookie(c, new Set(ALLOWED));
  assert.equal(r.ok, false);
  assert.equal(r.code, "COOKIE_PREREQ_DOMAIN_NOT_ALLOWED");
  // No raw domain in the failure reason field.
  if (r.reason) assert.ok(!r.reason.includes("evil.com"));
});

test("prereq fail: unknown cookie name → UNKNOWN_NAME fixed code", () => {
  const allowResult = enforceAllowlist([
    { name: "secret_tracker", value: "x", domain: ".bilibili.com", path: "/", secure: true, sameSite: "lax" },
  ], ALLOWED);
  assert.equal(allowResult.ok, false);
  assert.equal(allowResult.rejectionCodes[0], "COOKIE_PREREQ_UNKNOWN_NAME");
});

test("prereq fail: invalid SameSite returns the frozen code", () => {
  const result = validateCookie({
    name: "SESSDATA", value: "x", domain: ".bilibili.com",
    path: "/", secure: true, sameSite: "invalid",
  }, new Set(ALLOWED));
  assert.equal(result.ok, false);
  assert.equal(result.code, COOKIE_FAIL.SAMESITE_INVALID);
  assert.equal(result.code, "COOKIE_PREREQ_SAMESITE_INVALID");
});

test("browser export: unrelated cookie names are excluded without broadening injection", () => {
  const parsed = [
    { name: "SESSDATA", value: "x", domain: ".bilibili.com", path: "/", secure: true, sameSite: "unspecified" },
    { name: "unrelated", value: "y", domain: ".bilibili.com", path: "/", secure: true, sameSite: "lax" },
  ];
  const selected = parsed.filter((cookie) => ALLOWED.includes(cookie.name));
  assert.deepEqual(selected.map((cookie) => cookie.name), ["SESSDATA"]);
  assert.deepEqual(validateCookie(selected[0], new Set(ALLOWED)), { ok: true });
  assert.equal("sameSite" in buildInjectionObject(selected[0]), false);
});

// ============================================================================
// Leak fail: post-run scan finds values in evidence
// ============================================================================

test("leak fail: scanFilesForCookieValues-style scan with actual values finds hits", () => {
  // Simulate writing a value into a fake "trace" file, then scanning
  // it with the in-memory cookie value. The scan must count them.
  const SENSITIVE = "leak-test-sessdata-" + Math.random().toString(36).slice(2);
  const evidenceDir = makeTempRoot("navia-b5-3-leak-int-");
  try {
    fs.writeFileSync(path.join(evidenceDir, "canary-trace.json"), JSON.stringify({ leaked: SENSITIVE }), { mode: 0o600 });
    const files = ["canary-trace.json", "canary-failure.json"].map((f) => path.join(evidenceDir, f)).filter((fp) => fs.existsSync(fp));
    let hits = 0;
    const cookie = { name: "SESSDATA", value: SENSITIVE, domain: ".bilibili.com", path: "/", secure: true, sameSite: "lax" };
    const escaped = cookie.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 4096);
    const re = new RegExp(escaped, "g");
    for (const fp of files) {
      const text = fs.readFileSync(fp, "utf8");
      re.lastIndex = 0;
      while (re.exec(text) !== null) hits += 1;
    }
    assert.equal(hits, 1);
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
});

test("leak fail: scan misses built-into YES when only the hash appears (no raw value)", () => {
  const SENSITIVE = "leak-sessdata-" + Math.random().toString(36).slice(2);
  const evidenceDir = makeTempRoot("navia-b5-3-leak-int-");
  try {
    // Write only the SHA-256 hash; the raw value is NOT in the file.
    const hash = createHash("sha256").update(SENSITIVE).digest("hex");
    fs.writeFileSync(path.join(evidenceDir, "canary-trace.json"), JSON.stringify({ nameHash: hash }), { mode: 0o600 });
    const files = ["canary-trace.json"].map((f) => path.join(evidenceDir, f));
    let hits = 0;
    const cookie = { name: "SESSDATA", value: SENSITIVE, domain: ".bilibili.com", path: "/", secure: true, sameSite: "lax" };
    const escaped = cookie.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 4096);
    const re = new RegExp(escaped, "g");
    for (const fp of files) {
      const text = fs.readFileSync(fp, "utf8");
      re.lastIndex = 0;
      while (re.exec(text) !== null) hits += 1;
    }
    assert.equal(hits, 0);
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Integration: full prereq → validation → addCookies contract
// ============================================================================

test("integration: positive case — env cookie source → cookies parsed → injection objects built", () => {
  const SENSITIVE = "canary-sessdata-" + Math.random().toString(36).slice(2);
  // Use the #HttpOnly_ prefix line so the cookie carries httpOnly=true.
  const netscapeWithHttpOnly = "#HttpOnly_.bilibili.com\tTRUE\t/\tTRUE\t9999999999\tSESSDATA\t" + SENSITIVE;
  const fp = tmpFile(netscapeWithHttpOnly);
  try {
    // Step 1: parse
    const raw = fs.readFileSync(fp, "utf8");
    const parsed = parseNetscape(raw);
    assert.equal(parsed.length, 1);
    // Step 3: per-cookie validate (uses parsed httpOnly=true from #HttpOnly_)
    const validated = parsed.map((c) => ({ c, r: validateCookie(c, new Set(ALLOWED)) }));
    const invalid = validated.filter((v) => !v.r.ok);
    assert.equal(invalid.length, 0);
    // Step 4: build injection object (Playwright-shaped)
    const inj = buildInjectionObject(validated[0].c);
    assert.equal(inj.name, "SESSDATA");
    assert.equal(inj.domain, ".bilibili.com");
    assert.equal(inj.secure, true);
    assert.equal(inj.httpOnly, true);
    assert.equal(inj.sameSite, "Lax");
    // Step 5: build public trace (must NOT contain raw values)
    const trace = buildPublicTrace({
      envSet: true, fileReadable: true,
      allowedNameSetSha256: "abc",
      requiredPresent: true, injectedCount: 1, secretHitCount: 0,
    });
    const traceJson = JSON.stringify(trace);
    assert.ok(!traceJson.includes(SENSITIVE), `LEAK: sensitive value in trace!`);
  } finally {
    fs.rmSync(fp, { force: true });
  }
});

test("integration: leak scenario — trace contains raw value → fail-closed", () => {
  // Simulate a leak: write the raw value into a fake trace file.
  const SENSITIVE = "leak-canary-" + Math.random().toString(36).slice(2);
  const evidenceDir = makeTempRoot("navia-b5-3-leak-int-");
  try {
    fs.writeFileSync(path.join(evidenceDir, "canary-trace.json"), JSON.stringify({ leakedValue: SENSITIVE }), { mode: 0o600 });
    fs.writeFileSync(path.join(evidenceDir, "canary-failure.json"), JSON.stringify({ error: "x" }), { mode: 0o600 });

    // The post-run scan must find ≥1 hit. The canary's fail-closed logic
    // deletes canary-final.json and throws when hits > 0.
    const cookie = { name: "SESSDATA", value: SENSITIVE, domain: ".bilibili.com", path: "/", secure: true, sameSite: "lax" };
    const escaped = cookie.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "g");
    const files = ["canary-trace.json", "canary-failure.json", "canary-final.json"].map((f) => path.join(evidenceDir, f)).filter((fp) => fs.existsSync(fp));
    let hits = 0;
    for (const fp of files) {
      const text = fs.readFileSync(fp, "utf8");
      re.lastIndex = 0;
      while (re.exec(text) !== null) hits += 1;
    }
    assert.equal(hits > 0, true, "scan must detect leak");
    // The fail-closed path would delete canary-final.json if it existed
    // and the leak was detected. Simulate:
    const finalPath = path.join(evidenceDir, "canary-final.json");
    if (hits > 0 && fs.existsSync(finalPath)) fs.rmSync(finalPath, { force: true });
    assert.ok(!fs.existsSync(finalPath));
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
});

function tempEntries(prefix) {
  return new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith(prefix)));
}

function removeNewCanaryEvidence(before) {
  for (const name of tempEntries("navia-b5-3-canary-")) {
    if (!before.has(name) && !name.startsWith("navia-b5-3-canary-scratch-") && !name.startsWith("navia-b5-3-canary-ext-")) {
      fs.rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true });
    }
  }
}

test("canary trace contract initializes every collection used by Stage A polling", () => {
  const canaryPath = path.join(__dirname, "canary_bvid1.node-test.mjs");
  const source = fs.readFileSync(canaryPath, "utf8");
  assert.match(source, /mediaTasksPolls:\s*\[\]/);
  assert.match(source, /trace\.mediaTasksPolls\.push\(/);
});

function runPrerequisiteFailure(envPatch) {
  const canaryPath = path.join(__dirname, "canary_bvid1.node-test.mjs");
  const scratchBefore = tempEntries("navia-b5-3-canary-scratch-");
  const fixtureBefore = tempEntries("navia-b5-3-canary-ext-");
  const evidenceBefore = tempEntries("navia-b5-3-canary-");
  const env = { ...process.env, ...envPatch };
  // A nested `node --test` inherits this marker from the parent runner and
  // may otherwise report zero tests with exit 0 instead of executing the
  // canary module as an independent child process.
  delete env.NODE_TEST_CONTEXT;
  delete env.NAVIA_BILIBILI_COOKIE_FILE;
  if (envPatch.NAVIA_BILIBILI_COOKIE_FILE) {
    env.NAVIA_BILIBILI_COOKIE_FILE = envPatch.NAVIA_BILIBILI_COOKIE_FILE;
  }
  const result = spawnSync(process.execPath, ["--test", canaryPath], {
    cwd: path.resolve(__dirname, "../../.."), env, encoding: "utf8", timeout: 20_000,
  });
  const scratchAfter = tempEntries("navia-b5-3-canary-scratch-");
  const fixtureAfter = tempEntries("navia-b5-3-canary-ext-");
  const evidenceAfter = [...tempEntries("navia-b5-3-canary-")]
    .filter((name) => !evidenceBefore.has(name)
      && !name.startsWith("navia-b5-3-canary-scratch-")
      && !name.startsWith("navia-b5-3-canary-ext-"));
  let failure = null;
  if (evidenceAfter.length === 1) {
    const failurePath = path.join(os.tmpdir(), evidenceAfter[0], "canary-failure.json");
    if (fs.existsSync(failurePath)) failure = JSON.parse(fs.readFileSync(failurePath, "utf8"));
  }
  removeNewCanaryEvidence(evidenceBefore);
  assert.notEqual(result.status, 0, "prerequisite failure must be non-zero");
  assert.deepEqual(scratchAfter, scratchBefore, "scratch set changed after prerequisite failure");
  assert.deepEqual(fixtureAfter, fixtureBefore, "fixture set changed after prerequisite failure");
  return { output: `${result.stdout}\n${result.stderr}`, failure };
}

test("integration: missing env fails before owned temp resources and leaves no scratch/fixture", () => {
  const result = runPrerequisiteFailure({});
  assert.match(result.output, /cookie-prerequisite-failed/);
  assert.equal(result.failure?.failureCode, COOKIE_FAIL.NO_ENV);
});

test("integration: malformed source fails before owned temp resources and leaves no scratch/fixture", () => {
  const fp = tmpFile("[not valid json");
  try {
    const result = runPrerequisiteFailure({ NAVIA_BILIBILI_COOKIE_FILE: fp });
    assert.match(result.output, /cookie-prerequisite-failed/);
    assert.equal(result.failure?.failureCode, COOKIE_FAIL.BAD_FORMAT);
  } finally {
    fs.rmSync(fp, { force: true });
  }
});
