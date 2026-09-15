import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { listGitPaths, normalizeArtifactPath, readArtifact, readGitBlob, sha256 } from "./v2PxArtifactReader.mjs";

test("ArtifactReader verifies bytes and is independent of process cwd", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-r3-reader-"));
  fs.mkdirSync(path.join(root, "raw"));
  const bytes = Buffer.from("evidence\n");
  fs.writeFileSync(path.join(root, "raw", "item.txt"), bytes);
  const ref = { path: "raw/item.txt", sha256: sha256(bytes), byteLength: bytes.length, mediaType: "text/plain" };
  for (const cwd of [root, os.tmpdir(), path.dirname(root)]) {
    const previous = process.cwd();
    try { process.chdir(cwd); assert.deepEqual(readArtifact(root, ref).bytes, bytes); } finally { process.chdir(previous); }
  }
});

test("ArtifactReader rejects production path escape, virtual, symlink, hash and length mismatch", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-r3-reader-negative-"));
  fs.writeFileSync(path.join(root, "item"), "ok");
  fs.symlinkSync(path.join(root, "item"), path.join(root, "link"));
  for (const item of ["/tmp/x", "C:/tmp/x", "../x", "virtual/x", "a\0b"]) assert.throws(() => normalizeArtifactPath(item));
  assert.throws(() => readArtifact(root, { path: "link", sha256: sha256(Buffer.from("ok")) }));
  assert.throws(() => readArtifact(root, { path: "item", sha256: "0".repeat(64) }));
  assert.throws(() => readArtifact(root, { path: "item", sha256: sha256(Buffer.from("ok")), byteLength: 3 }));
});

test("Git reader reads the requested commit rather than the working tree", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-r3-git-"));
  const run = (...args) => spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  assert.equal(run("init", "-q").status, 0);
  run("config", "user.email", "r3@example.invalid"); run("config", "user.name", "R3 Test");
  fs.mkdirSync(path.join(root, "src")); fs.writeFileSync(path.join(root, "src", "value.ts"), "export const value = 1;\n");
  run("add", "."); assert.equal(run("commit", "-qm", "snapshot").status, 0);
  const commit = run("rev-parse", "HEAD").stdout.trim();
  fs.writeFileSync(path.join(root, "src", "value.ts"), "export const value = 2;\n");
  assert.equal(readGitBlob(root, commit, "src/value.ts").toString(), "export const value = 1;\n");
  assert.deepEqual(listGitPaths(root, commit, ["src"]), ["src/value.ts"]);
});

