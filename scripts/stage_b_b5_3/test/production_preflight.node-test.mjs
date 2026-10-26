// The B-5 production preflight — the OFFLINE-testable parts.
//
// The preflight itself starts no Chrome, calls no Provider and downloads
// nothing. These cases cover its pure surface: the cookie resolution and
// inspection, the owned product paths and the action counters.
//
// The cookie fixtures are SYNTHETIC. No real cookie value is read, printed
// or recorded by any case.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AUTHORIZED_DESKTOP_COOKIE_PATH,
  COOKIE_FILE_ENV,
  REQUIRED_COOKIE_NAMES,
  inspectCookieFile,
  resolveCookieFile,
  resolveOwnedProductPaths,
} from "../lib/owned_session.mjs";
import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX, RESERVE_SOURCES } from "../lib/registry.mjs";
import { makeTempRoot } from "../lib/temp_roots.mjs";

function makeDir(prefix) {
  return makeTempRoot(prefix);
}

test("the cookie file comes from the explicit environment when it is set", () => {
  const resolved = resolveCookieFile({
    environment: { [COOKIE_FILE_ENV]: "/tmp/explicit-myCk.txt" },
  });
  assert.equal(resolved.source, "explicit-environment");
  assert.equal(resolved.path, path.resolve("/tmp/explicit-myCk.txt"));
});

test("without the environment the ONE authorized Desktop path is used", () => {
  const resolved = resolveCookieFile({ environment: {} });
  assert.equal(resolved.source, "windows-desktop-known-folder");
  assert.equal(resolved.path, AUTHORIZED_DESKTOP_COOKIE_PATH);
  // It is a single exact path, never a directory.
  assert.ok(path.isAbsolute(resolved.path));
  assert.ok(resolved.path.endsWith(path.join("Desktop", "myCk.txt")));
});

test("a missing cookie file is a refusal, not an empty success", () => {
  const inspected = inspectCookieFile({ cookieFile: null });
  assert.equal(inspected.resolved, false);
  assert.equal(inspected.readable, false);
  assert.equal(inspected.failureCode, "COOKIE_PREREQ_NO_ENV");
  assert.deepEqual(inspected.missingRequiredNames, [...REQUIRED_COOKIE_NAMES]);
});

test("an unreadable cookie file is a refusal", () => {
  const dir = makeDir("navia-b5-cookie-");
  const inspected = inspectCookieFile({ cookieFile: path.join(dir, "absent.txt") });
  assert.equal(inspected.readable, false);
  assert.equal(inspected.failureCode, "COOKIE_PREREQ_FILE_UNREADABLE");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a cookie file without the required NAME is a refusal", () => {
  const dir = makeDir("navia-b5-cookie-");
  const file = path.join(dir, "cookies.json");
  fs.writeFileSync(file, JSON.stringify([
    { name: "bili_jct", value: "synthetic", domain: ".bilibili.com", path: "/", secure: true },
  ]));
  const inspected = inspectCookieFile({ cookieFile: file });
  assert.equal(inspected.readable, true);
  assert.equal(inspected.requiredNamesPresent, false);
  assert.deepEqual(inspected.missingRequiredNames, ["SESSDATA"]);
  assert.equal(inspected.failureCode, "COOKIE_PREREQ_REQUIRED_MISSING");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the cookie inspection never carries a value or a value length", () => {
  const dir = makeDir("navia-b5-cookie-");
  const file = path.join(dir, "cookies.json");
  const secret = "synthetic-value-that-must-never-appear";
  fs.writeFileSync(file, JSON.stringify([
    { name: "SESSDATA", value: secret, domain: ".bilibili.com", path: "/", secure: true },
  ]));
  const inspected = inspectCookieFile({ cookieFile: file });
  const serialized = JSON.stringify(inspected);
  assert.equal(inspected.requiredNamesPresent, true);
  assert.equal(inspected.usableCookieCount, 1);
  assert.ok(!serialized.includes(secret), "the inspection must not carry a value");
  assert.ok(!serialized.includes(String(secret.length)), "the inspection must not carry a value length");
  assert.ok(!serialized.includes(dir), "the inspection must not carry the private path");
  // The NAMES digest is not the value.
  assert.match(inspected.allowedNameSetSha256, /^[0-9a-f]{64}$/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the owned product paths resolve to the PRODUCT roots", () => {
  const paths = resolveOwnedProductPaths({ environment: {}, repositoryRoot: "/repo" });
  assert.equal(paths.managedTools, path.join("/repo", ".navia/managed-tools"));
  assert.equal(paths.asrRoot, path.join("/repo", ".navia/asr"));
  assert.equal(paths.extensionRoot, path.join("/repo", "apps/chrome-extension/chrome-mv3-unpacked"));
  assert.equal(paths.visionProviderSourceDb, path.join("/repo", ".navia/navia.sqlite3"));
});

test("the active registry and its reserves are the frozen ones", () => {
  assert.equal(ACTIVE_REGISTRY_SHA256, "9c2da2f4c4c16fc94e1e0d7dfc9362ab1177d2db53f63d4af5a81a44795c9454");
  assert.equal(FROZEN_SIX.length, 6);
  assert.equal(RESERVE_SOURCES.length, 4);
});
