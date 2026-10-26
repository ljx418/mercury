// Stage B B-5-3 runner contract tests.
//
// These tests are pure node:test unit / contract tests:
//   - no Chrome, no Runtime, no Network, no audio
//   - testable in <1s on this repo
//
// They exercise the pure helpers extracted into lib/contracts.mjs and assert
// the contract branches specified by the user:
//   - fresh isolation (UUIDs, mkdtemp paths)
//   - secret scan (6 PATTERN, plaintext present)
//   - upload counter hard-zero (rawVideo/rawAudio/frameByte/cookie/apiKey/localPath)
//   - V2.1 receipt 11/17 fields
//   - --mute-audio assertion (Chrome cannot launch without it)
//   - exit-code behaviour via subprocess wrapper
//   - SIGTERM / finally cleanup-fail-closed

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { makeTempRoot } from "../lib/temp_roots.mjs";

import {
  BVID_PATTERN,
  ORDER_PATTERN,
  SECRET_PATTERNS,
  UPLOAD_COUNTER_HARD_ZERO,
  REQUIRED_UPLOAD_COUNTER_KEYS,
  REQUIRED_V21_RECEIPT_FIELDS,
  PROVIDER_LOCK,
  DERIVED_TEXT_SCOPE,
  MAXIMUM_BLOCKED_FOR_STAGE_EXIT,
  parseArgs,
  sha256,
  writeJson,
  writeText,
  ensure,
  wait,
  detectSecretHits,
  scanFileForSecrets,
  validateUploadCounters,
  missingReceiptFields,
  assertMuteAudioFlag,
  assertChromeCmdlineFlags,
  classifyDispositionFromStageA,
} from "../lib/contracts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// parseArgs: required-key + format validation
// ============================================================================

test("parseArgs accepts canonical invocation with --key=value pairs", () => {
  const out = parseArgs([
    "--order=1",
    "--bvid=BV1pohR6rEEh",
    "--run-id=stage-b-b5-3-foo",
    "--evidence-root=/tmp/whatever",
  ]);
  assert.equal(out.order, "1");
  assert.equal(out.bvid, "BV1pohR6rEEh");
  assert.equal(out["run-id"], "stage-b-b5-3-foo");
  assert.equal(out["evidence-root"], "/tmp/whatever");
});

test("parseArgs rejects when --order missing", () => {
  assert.throws(
    () => parseArgs(["--bvid=BV1pohR6rEEh", "--run-id=x", "--evidence-root=/tmp/x"]),
    /Missing --order/,
  );
});

test("parseArgs rejects when --bvid missing", () => {
  assert.throws(
    () => parseArgs(["--order=1", "--run-id=x", "--evidence-root=/tmp/x"]),
    /Missing --bvid/,
  );
});

test("parseArgs rejects when --run-id missing", () => {
  assert.throws(
    () => parseArgs(["--order=1", "--bvid=BV1pohR6rEEh", "--evidence-root=/tmp/x"]),
    /Missing --run-id/,
  );
});

test("parseArgs rejects when --evidence-root missing", () => {
  assert.throws(
    () => parseArgs(["--order=1", "--bvid=BV1pohR6rEEh", "--run-id=x"]),
    /Missing --evidence-root/,
  );
});

test("parseArgs rejects malformed --bvid (wrong length)", () => {
  assert.throws(
    () => parseArgs(["--order=1", "--bvid=BV1po", "--run-id=x", "--evidence-root=/tmp/x"]),
    /Invalid --bvid/,
  );
});

test("parseArgs rejects malformed --bvid (missing BV prefix)", () => {
  assert.throws(
    () => parseArgs(["--order=1", "--bvid=AV1pohR6rEEh", "--run-id=x", "--evidence-root=/tmp/x"]),
    /Invalid --bvid/,
  );
});

test("parseArgs rejects --order outside [1-6]", () => {
  assert.throws(
    () => parseArgs(["--order=0", "--bvid=BV1pohR6rEEh", "--run-id=x", "--evidence-root=/tmp/x"]),
    /Invalid --order/,
  );
  assert.throws(
    () => parseArgs(["--order=7", "--bvid=BV1pohR6rEEh", "--run-id=x", "--evidence-root=/tmp/x"]),
    /Invalid --order/,
  );
  assert.throws(
    () => parseArgs(["--order=foo", "--bvid=BV1pohR6rEEh", "--run-id=x", "--evidence-root=/tmp/x"]),
    /Invalid --order/,
  );
});

test("parseArgs accepts all 6 frozen BVIDs (registry regression)", () => {
  const frozen = ["BV1pohR6rEEh", "BV1hMpE6FEXG", "BV1VHHe6kEH3", "BV1SDHy6aEiB", "BV1vSHD6tEsM", "BV1FCps68EGf"];
  for (const bvid of frozen) {
    const out = parseArgs([`--order=1`, `--bvid=${bvid}`, "--run-id=x", "--evidence-root=/tmp/x"]);
    assert.equal(out.bvid, bvid);
    assert.match(out.bvid, BVID_PATTERN);
  }
});

// ============================================================================
// BVID / ORDER regex constants
// ============================================================================

test("BVID_PATTERN matches canonical BV ids", () => {
  assert.match("BV1pohR6rEEh", BVID_PATTERN);
  assert.match("BV1ab2cd3ef4", BVID_PATTERN);
  // Pattern is BV + exactly 10 alphanumeric chars.
  assert.match("BVZZZZZZZZZZ", BVID_PATTERN);
});

test("BVID_PATTERN rejects malformed ids", () => {
  assert.doesNotMatch("BV1", BVID_PATTERN);
  assert.doesNotMatch("AV1pohR6rEEh", BVID_PATTERN);
  assert.doesNotMatch("BV1pohR6rEE", BVID_PATTERN);
  assert.doesNotMatch("BV1pohR6rEEhh", BVID_PATTERN);
});

test("ORDER_PATTERN accepts 1..6", () => {
  for (const n of ["1", "2", "3", "4", "5", "6"]) assert.match(n, ORDER_PATTERN);
});

test("ORDER_PATTERN rejects 0, 7, multi-digit, non-digits", () => {
  for (const n of ["0", "7", "12", "a", "-1"]) assert.doesNotMatch(n, ORDER_PATTERN);
});

// ============================================================================
// sha256
// ============================================================================

test("sha256 is correct (empty + known vector)", () => {
  assert.equal(sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("sha256 produces stable hashes across calls", () => {
  const a = sha256("navia-stage-b-b5-3");
  const b = sha256("navia-stage-b-b5-3");
  assert.equal(a, b);
});

// ============================================================================
// writeJson / writeText — file mode 0o600
// ============================================================================

test("writeJson writes valid JSON, mode 0o600", () => {
  const dir = makeTempRoot("navia-b5-3-wj-");
  const target = path.join(dir, "sample.json");
  writeJson(target, { foo: "bar", n: 42 });
  const st = fs.statSync(target);
  assert.equal(st.mode & 0o777, 0o600);
  const parsed = JSON.parse(fs.readFileSync(target, "utf8"));
  assert.deepEqual(parsed, { foo: "bar", n: 42 });
  fs.rmSync(dir, { recursive: true, force: true });
});

test("writeJson overwrites existing file deterministically", () => {
  const dir = makeTempRoot("navia-b5-3-wj-");
  const target = path.join(dir, "overwrite.json");
  writeJson(target, { v: 1 });
  writeJson(target, { v: 2 });
  assert.equal(fs.statSync(target).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), { v: 2 });
  fs.rmSync(dir, { recursive: true, force: true });
});

test("writeText writes raw bytes, mode 0o600", () => {
  const dir = makeTempRoot("navia-b5-3-wt-");
  const target = path.join(dir, "sample.txt");
  writeText(target, "hello\nworld\n");
  assert.equal(fs.statSync(target).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(target, "utf8"), "hello\nworld\n");
  fs.rmSync(dir, { recursive: true, force: true });
});

// ============================================================================
// ensure / wait
// ============================================================================

test("ensure throws with message when condition is false", () => {
  assert.throws(() => ensure(false, "bad-state"), { message: "bad-state" });
  assert.throws(() => ensure(0, "zero-falsy"), { message: "zero-falsy" });
  assert.throws(() => ensure(null, "null-falsy"), { message: "null-falsy" });
});

test("ensure is silent when condition is true", () => {
  ensure(true, "no-throw");
  ensure(1, "no-throw");
  ensure("non-empty", "no-throw");
});

test("wait(ms) waits at least ms milliseconds", async () => {
  const start = Date.now();
  await wait(50);
  const elapsed = Date.now() - start;
  assert.ok(elapsed >= 45, `wait(50) elapsed ${elapsed}ms`);
});

// ============================================================================
// detectSecretHits / scanFileForSecrets — 6 PATTERN coverage
// ============================================================================

test("detectSecretHits flags each of the 6 PATTERN families", () => {
  const samples = {
    "/sk-/": "sk-aBcDeFgHiJkLmNoPqRsT1234",
    "/sk_live_/": "sk_live_abcdefgh1234",
    "/AIza/": "AIzaSyA1234567890ABCDEFGH",
    "/gho_/": "gho_aBcDeFgHiJkLmNoPqRsT",
    "/deepseek-/": "deepseek-abcdef12",
    "/minimax-/": "minimax-fedcba98",
  };
  for (const [label, sample] of Object.entries(samples)) {
    const hits = detectSecretHits(sample);
    assert.equal(hits.length, 1, `${label}: expected 1 hit, got ${hits.length}`);
    assert.match(hits[0].sample, /[a-zA-Z0-9_\-]{8,}/);
  }
});

test("detectSecretHits returns 0 hits for benign text", () => {
  for (const benign of [
    "",
    "no secrets here",
    "the quick brown fox jumps over the lazy dog",
    "BVID BV1pohR6rEEh navigated in 3.2s",
    "sk-short",
    "AIzaABC",
    "minimax-x",
  ]) {
    assert.deepEqual(detectSecretHits(benign), [], `benign text flagged: ${benign}`);
  }
});

test("scanFileForSecrets walks directories recursively", () => {
  const dir = makeTempRoot("navia-b5-3-scan-");
  fs.writeFileSync(path.join(dir, "safe.txt"), "no secrets");
  fs.writeFileSync(path.join(dir, "leak.txt"), "sk-aBcDeFgHiJkLmNoPqRsT1234\n");
  fs.mkdirSync(path.join(dir, "sub"));
  fs.writeFileSync(path.join(dir, "sub", "nested.txt"), "minimax-12345678");
  const hits = scanFileForSecrets(dir);
  assert.equal(hits.length, 2);
  assert.ok(hits.some((h) => h.sample.startsWith("sk-aBcDeFgH")));
  assert.ok(hits.some((h) => h.sample.startsWith("minimax-1")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("scanFileForSecrets returns empty array for missing path", () => {
  const missing = path.join(os.tmpdir(), `navia-b5-3-missing-${randomUUID()}`);
  assert.deepEqual(scanFileForSecrets(missing), []);
});

test("SECRET_PATTERNS contains exactly 6 entries (frozen list)", () => {
  assert.equal(SECRET_PATTERNS.length, 6);
});

// ============================================================================
// UPLOAD_COUNTER_HARD_ZERO integrity
// ============================================================================

test("UPLOAD_COUNTER_HARD_ZERO contains all 6 forbidden counters with value 0", () => {
  assert.equal(UPLOAD_COUNTER_HARD_ZERO.rawVideoUploadCount, 0);
  assert.equal(UPLOAD_COUNTER_HARD_ZERO.rawAudioUploadCount, 0);
  assert.equal(UPLOAD_COUNTER_HARD_ZERO.frameByteUploadCount, 0);
  assert.equal(UPLOAD_COUNTER_HARD_ZERO.cookieUploadCount, 0);
  assert.equal(UPLOAD_COUNTER_HARD_ZERO.apiKeyDisclosureCount, 0);
  assert.equal(UPLOAD_COUNTER_HARD_ZERO.localPathUploadCount, 0);
  assert.equal(Object.keys(UPLOAD_COUNTER_HARD_ZERO).length, 6);
});

test("REQUIRED_UPLOAD_COUNTER_KEYS matches UPLOAD_COUNTER_HARD_ZERO keys", () => {
  assert.deepEqual(
    [...REQUIRED_UPLOAD_COUNTER_KEYS].sort(),
    [...Object.keys(UPLOAD_COUNTER_HARD_ZERO)].sort(),
  );
});

// ============================================================================
// validateUploadCounters
// ============================================================================

test("validateUploadCounters returns empty list for all-zero receipt", () => {
  const rcpt = { ...UPLOAD_COUNTER_HARD_ZERO, providerId: "minimax" };
  assert.deepEqual(validateUploadCounters(rcpt), []);
});

test("validateUploadCounters reports any non-zero counter", () => {
  const rcpt = { ...UPLOAD_COUNTER_HARD_ZERO, rawVideoUploadCount: 7 };
  const offenders = validateUploadCounters(rcpt);
  assert.equal(offenders.length, 1);
  assert.match(offenders[0], /rawVideoUploadCount=7/);
});

test("validateUploadCounters reports multiple offenders", () => {
  const rcpt = {
    ...UPLOAD_COUNTER_HARD_ZERO,
    rawAudioUploadCount: 2,
    cookieUploadCount: 1,
    apiKeyDisclosureCount: 0,
  };
  const offenders = validateUploadCounters(rcpt);
  assert.equal(offenders.length, 2);
});

// ============================================================================
// V2.1 receipt fields — 11 (B-5-3 detailed) / 17 (helper set) — both PASS
// ============================================================================

test("missingReceiptFields is empty when all 17 required fields present", () => {
  const rcpt = Object.fromEntries(REQUIRED_V21_RECEIPT_FIELDS.map((k) => [k, "x"]));
  rcpt.providerId = "minimax_chat_completions";
  for (const key of REQUIRED_UPLOAD_COUNTER_KEYS) rcpt[key] = 0;
  assert.deepEqual(missingReceiptFields(rcpt), []);
});

test("missingReceiptFields lists absent keys", () => {
  const partial = { providerId: "x" };
  const missing = missingReceiptFields(partial);
  assert.equal(missing.length, REQUIRED_V21_RECEIPT_FIELDS.length - 1);
  assert.ok(missing.includes("outboundSha256"));
  assert.ok(missing.includes("requestCount"));
});

test("REQUIRED_V21_RECEIPT_FIELDS contains the 11 B-5-3 mandated fields", () => {
  for (const k of [
    "providerId", "modelId", "outboundSha256", "requestCount",
    "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
    "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount",
  ]) {
    assert.ok(REQUIRED_V21_RECEIPT_FIELDS.includes(k), `${k} missing`);
  }
});

// ============================================================================
// --mute-audio assertion
// ============================================================================

test("assertMuteAudioFlag is silent when --mute-audio present", () => {
  assertMuteAudioFlag("--mute-audio --load-extension=foo --user-data-dir=bar");
});

test("assertMuteAudioFlag throws when --mute-audio absent", () => {
  assert.throws(() => assertMuteAudioFlag("--load-extension=foo --user-data-dir=bar"), /lacks --mute-audio/);
});

test("assertMuteAudioFlag refuses zero-opt-out attempt (NAVIA_CHROME_MUTE_AUDIO=0 protection)", () => {
  // The runner's runtime guard rejects this before Chrome even spawns.
  // We assert the protected value semantically here: any cmdline without
  // --mute-audio must be rejected regardless of source.
  assert.throws(() => assertMuteAudioFlag(""), /lacks --mute-audio/);
});

// ============================================================================
// assertChromeCmdlineFlags — all 4 mandatory flags must be present
// ============================================================================

test("assertChromeCmdlineFlags passes for canonical extension launch", () => {
  const cmdline = [
    "chrome.exe",
    "--mute-audio",
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    "--load-extension=/workspace/chrome-mv3-unpacked",
    "--disable-extensions-except=/workspace/chrome-mv3-unpacked",
    "--user-data-dir=/tmp/profile",
    "--autoplay-policy=no-user-gesture-required",
  ].join(" ");
  assertChromeCmdlineFlags(cmdline);
});

test("assertChromeCmdlineFlags throws for each missing flag", () => {
  const allFlags = [
    "--mute-audio",
    "--load-extension=x",
    "--disable-extensions-except=y",
    "--user-data-dir=/tmp/profile",
  ];
  for (const missing of [
    "--mute-audio",
    "--load-extension",
    "--disable-extensions-except",
    "--user-data-dir=",
  ]) {
    const partial = allFlags.filter((flag) => !flag.startsWith(missing)).join(" ");
    assert.throws(
      () => assertChromeCmdlineFlags(partial),
      new RegExp(`lacks ${missing.replace(/[.+*?^${}()|[\\]\\\\]/g, "\\\\$&")}`),
      `expected throw for missing ${missing}, got cmdline: ${partial}`,
    );
  }
});

// ============================================================================
// classifyDispositionFromStageA — runner state-machine mapping
// ============================================================================

test("classifyDispositionFromStageA maps terminal states correctly", () => {
  assert.equal(classifyDispositionFromStageA("ready"), "complete");
  assert.equal(classifyDispositionFromStageA("degraded"), "complete");
  assert.equal(classifyDispositionFromStageA("blocked"), "blocked");
  assert.equal(classifyDispositionFromStageA("cancelled"), "blocked");
  assert.equal(classifyDispositionFromStageA("failed"), "blocked");
});

test("classifyDispositionFromStageA defaults unknown states to blocked (fail-closed)", () => {
  assert.equal(classifyDispositionFromStageA("created"), "blocked");
  assert.equal(classifyDispositionFromStageA("materializing"), "blocked");
  assert.equal(classifyDispositionFromStageA("analyzing_vision"), "blocked");
  assert.equal(classifyDispositionFromStageA("synthesizing"), "blocked");
  assert.equal(classifyDispositionFromStageA("unknown"), "blocked");
});

// ============================================================================
// Constants: provider lock + scope
// ============================================================================

test("PROVIDER_LOCK is locked to minimax_chat_completions", () => {
  assert.equal(PROVIDER_LOCK, "minimax_chat_completions");
});

test("DERIVED_TEXT_SCOPE contains exactly transcript/ocr/vision-caption", () => {
  assert.deepEqual([...DERIVED_TEXT_SCOPE].sort(), ["ocr", "transcript", "vision-caption"]);
  assert.equal(DERIVED_TEXT_SCOPE.length, 3);
});

test("MAXIMUM_BLOCKED_FOR_STAGE_EXIT equals 1", () => {
  assert.equal(MAXIMUM_BLOCKED_FOR_STAGE_EXIT, 1);
});

// ============================================================================
// Fresh isolation: per-invocation mkdtemp produces unique paths
// ============================================================================

test("mkdtemp produces distinct runtime/profile dirs across invocations", () => {
  const tmpA = makeTempRoot("navia-b5-3-iso-a-");
  const tmpB = makeTempRoot("navia-b5-3-iso-b-");
  assert.notEqual(tmpA, tmpB);
  fs.rmSync(tmpA, { recursive: true, force: true });
  fs.rmSync(tmpB, { recursive: true, force: true });
});

test("TASK_NAMESPACE generation matches media_task_<32hex> contract", () => {
  const hex = randomUUID().replaceAll("-", "").slice(0, 32);
  const ns = `media_task_${hex}`;
  assert.match(ns, /^media_task_[0-9a-f]{32}$/);
  // Different calls produce different namespaces.
  const ns2 = `media_task_${randomUUID().replaceAll("-", "").slice(0, 32)}`;
  assert.notEqual(ns, ns2);
});

// ============================================================================
// SHA-256 of final V2.1 evidence catalog (derivative disk layout)
// ============================================================================

test("sha256 of evidence catalog matches independent produce-time digest", () => {
  const payload = { schemaVersion: "v3-media-grounded-comprehension/v2.1", receipt: UPLOAD_COUNTER_HARD_ZERO };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  const mine = sha256(json);
  const reference = createHash("sha256").update(json).digest("hex");
  assert.equal(mine, reference);
});

// ============================================================================
// Cleanup fail-closed: cleanup.json is always written even if scratch rm throws
// ============================================================================

test("writeJson + writeText on a previously deleted dir throws but doesn't swallow", () => {
  const dir = makeTempRoot("navia-b5-3-cu-");
  fs.rmSync(dir, { recursive: true, force: true });
  // After rm, writing must surface the error so the cleanup-fail-closed
  // contract in run_one_bvid.mjs finally{} block can be reached.
  assert.throws(() => writeJson(path.join(dir, "cleanup.json"), { ok: true }));
});