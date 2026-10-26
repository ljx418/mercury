// The privacy scanner of the B-5 evidence (RC5).
//
// The evidence may carry no absolute runtime, database, profile or repository
// path, and no matched secret character. These cases prove the detector and
// the redactor behave.
//
// The detector covers POSIX (including a ONE-SEGMENT path such as /tmp),
// Windows (the backslash AND the forward-slash drive form) and UNC paths.
// A URL and the public Runtime/Provider routes are never false positives.

import test from "node:test";
import assert from "node:assert/strict";

import {
  NON_PRIVATE_PATH_ALLOWLIST,
  classifyRuntimeFailure,
  detectAbsolutePaths,
  pathReference,
  redactAbsolutePaths,
  safeFileReference,
} from "../lib/privacy.mjs";

test("the detector finds a POSIX absolute path", () => {
  const found = detectAbsolutePaths('the runtime root is /home/administrator/.navia/media-tasks here');
  assert.equal(found.length, 1);
  assert.ok(found[0].startsWith("/home/"));
});

test("the detector finds a ONE-SEGMENT POSIX path", () => {
  const found = detectAbsolutePaths('the scratch lives in /tmp');
  assert.deepEqual(found, ["/tmp"]);
  assert.deepEqual(detectAbsolutePaths("the root is /var"), ["/var"]);
});

test("the detector finds a Windows absolute path", () => {
  const found = detectAbsolutePaths('the profile is C:\\Users\\Administrator\\AppData\\Local\\Temp\\profile');
  assert.equal(found.length, 1);
  assert.ok(found[0].startsWith("C:\\"));
});

test("the detector finds a Windows FORWARD-SLASH drive path", () => {
  const found = detectAbsolutePaths('the profile is C:/Users/Administrator/AppData/Local/Temp/profile');
  assert.equal(found.length, 1);
  assert.ok(found[0].startsWith("C:/"));
});

test("the detector finds a UNC path", () => {
  const backslash = detectAbsolutePaths('the share is \\\\server\\share\\profile');
  assert.equal(backslash.length, 1);
  assert.ok(backslash[0].startsWith("\\\\server\\"));
  const forward = detectAbsolutePaths('the share is //server/share/profile');
  assert.equal(forward.length, 1);
  assert.ok(forward[0].startsWith("//server/"));
});

test("the detector ignores a URL, a relative path and a frozen route", () => {
  assert.deepEqual(detectAbsolutePaths("https://provider.invalid/v1/chat"), []);
  assert.deepEqual(detectAbsolutePaths("http://127.0.0.1:17861/v1/media/tasks"), []);
  assert.deepEqual(detectAbsolutePaths("docs/active/project/contracts/v3.schema.json"), []);
  assert.deepEqual(detectAbsolutePaths("POST /v1/media/acquisitions/resolve returned 201"), []);
  assert.deepEqual(detectAbsolutePaths("POST /chat/completions returned 200"), []);
  assert.deepEqual(detectAbsolutePaths("POST /beta/chat/completions returned 200"), []);
  assert.deepEqual(detectAbsolutePaths("GET /health returned 200"), []);
});

test("the allowlist is narrow, structured and documented", () => {
  assert.deepEqual(
    NON_PRIVATE_PATH_ALLOWLIST.map((entry) => entry.prefix).sort(),
    ["/beta/chat/completions", "/chat/completions", "/health", "/v1/", "/v3/"],
  );
  for (const entry of NON_PRIVATE_PATH_ALLOWLIST) {
    assert.ok(["runtime-route", "provider-route"].includes(entry.kind));
    assert.ok(typeof entry.note === "string" && entry.note.length > 0);
  }
  // A FILE under an allowlisted prefix is NOT allowlisted.
  assert.deepEqual(detectAbsolutePaths("/v1/media/secret.sqlite3"), ["/v1/media/secret.sqlite3"]);
  assert.deepEqual(detectAbsolutePaths("/v3/cache.db"), ["/v3/cache.db"]);
  // A public ROUTE IS allowlisted.
  assert.deepEqual(detectAbsolutePaths("POST /v1/media/acquisitions/resolve"), []);
});

test("the redactor replaces a path with a stable reference", () => {
  const redacted = redactAbsolutePaths("the runtime root is /home/administrator/.navia/media-tasks");
  assert.ok(!redacted.includes("/home/administrator"));
  assert.ok(redacted.includes("path-ref:"));
  // The reference is stable.
  assert.equal(
    redactAbsolutePaths("x /home/administrator/.navia"),
    redactAbsolutePaths("x /home/administrator/.navia"),
  );
});

test("the redactor replaces a UNC path and keeps a public route", () => {
  const redacted = redactAbsolutePaths("the share is \\\\server\\share\\profile and the route is /v1/media/x");
  assert.ok(!redacted.includes("\\\\server\\share"));
  assert.ok(redacted.includes("/v1/media/x"), "a public route stays readable");
});

test("a file reference is a hash, never a path", () => {
  const reference = safeFileReference("b5-source-receipt.json");
  assert.match(reference, /^file-ref:[0-9a-f]{32}$/);
  assert.ok(!reference.includes("b5-source-receipt"));
});

test("only an allowlisted frozen Runtime code is classified", () => {
  const frozen = classifyRuntimeFailure(
    502,
    JSON.stringify({ ok: false, error: { code: "V3510B_CHAPTER_TIME_INVALID", message: "x" } }),
  );
  assert.equal(frozen.failureCode, "V3510B_CHAPTER_TIME_INVALID");
  assert.equal(frozen.httpStatus, 502);

  const stageB = classifyRuntimeFailure(
    503,
    JSON.stringify({ ok: false, error: { code: "V352_SYNTHESIS_PROVIDER_UNAVAILABLE" } }),
  );
  assert.equal(stageB.failureCode, "V352_SYNTHESIS_PROVIDER_UNAVAILABLE");

  const foreign = classifyRuntimeFailure(
    500,
    JSON.stringify({ ok: false, error: { code: "ATTACKER_CONTROLLED_CODE" } }),
  );
  assert.equal(foreign.failureCode, null);

  const unparsable = classifyRuntimeFailure(500, "<html>not json</html>");
  assert.equal(unparsable.failureCode, null);
  assert.equal(unparsable.httpStatus, 500);
});

test("a path reference is stable and opaque", () => {
  const reference = pathReference("/home/administrator/.navia");
  assert.match(reference, /^path-ref:[0-9a-f]{32}$/);
  assert.ok(!reference.includes("administrator"));
});
