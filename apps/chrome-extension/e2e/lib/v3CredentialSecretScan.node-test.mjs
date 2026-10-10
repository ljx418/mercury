import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { extractCredentialNeedles, scanRootsForCredentialNeedles } from "./v3CredentialSecretScan.mjs";

test("credential scanner passes a clean tree and detects an isolated marker without disclosing it", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-v3-secret-scan-"));
  const marker = "test-only-secret-marker-credential";
  try {
    fs.writeFileSync(path.join(root, "clean.json"), "{}\n");
    const needles = extractCredentialNeedles(`SESSDATA=${marker}; bili_jct=another-test-only-secret`);
    const clean = scanRootsForCredentialNeedles([{ label: "isolated", path: root }], needles);
    assert.equal(clean.hitCount, 0);
    assert.equal(clean.passed, true);

    fs.writeFileSync(path.join(root, "leak.bin"), Buffer.from(`prefix:${marker}:suffix`));
    const leaked = scanRootsForCredentialNeedles([{ label: "isolated", path: root }], needles);
    assert.equal(leaked.hitCount, 1);
    assert.equal(leaked.passed, false);
    const serialized = JSON.stringify(leaked);
    assert.equal(serialized.includes(marker), false);
    assert.equal(serialized.includes("SESSDATA"), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("credential scanner extracts JSON cookie values without exposing them in results", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-v3-secret-json-scan-"));
  const marker = "test-only-json-cookie-value";
  try {
    const needles = extractCredentialNeedles(JSON.stringify([
      { name: "example", value: marker },
      { name: "short", value: "tiny" }
    ]));
    assert.equal(needles.length, 1);
    fs.writeFileSync(path.join(root, "leak.bin"), Buffer.from(`prefix:${marker}:suffix`));
    const leaked = scanRootsForCredentialNeedles([{ label: "isolated", path: root }], needles);
    assert.equal(leaked.hitCount, 1);
    assert.equal(JSON.stringify(leaked).includes(marker), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
