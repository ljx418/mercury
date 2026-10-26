import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  findOwnedChromeProcess,
  waitForOwnedChromeProcess,
} from "../lib/owned_chrome.mjs";

function procFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-owned-chrome-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeProcess(root, pid, argv) {
  const directory = path.join(root, String(pid));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "cmdline"), `${argv.join("\0")}\0`);
}

function writeRewrittenProcess(root, pid, argv) {
  const directory = path.join(root, String(pid));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "cmdline"), `${argv.join(" ")}\0`);
}

test("the owned browser is selected by the exact profile argument", (t) => {
  const root = procFixture(t);
  const profile = "/tmp/navia-owned-profile";
  writeProcess(root, 101, ["chrome", `--user-data-dir=${profile}-foreign`, "--mute-audio"]);
  writeProcess(root, 102, ["chrome", `--user-data-dir=${profile}`, "--type=renderer", "--mute-audio"]);
  writeProcess(root, 103, ["chrome", `--user-data-dir=${profile}`, "--mute-audio", "--load-extension=/tmp/ext"]);

  const process = findOwnedChromeProcess({ profilePath: profile, procRoot: root });
  assert.equal(process.pid, 103);
  assert.match(process.cmdline, /--mute-audio/);
});

test("discovery waits for the owned browser process to appear", async (t) => {
  const root = procFixture(t);
  const profile = "/tmp/navia-delayed-profile";
  const timer = setTimeout(() => {
    writeProcess(root, 201, ["chrome", `--user-data-dir=${profile}`, "--mute-audio"]);
  }, 30);
  t.after(() => clearTimeout(timer));

  const process = await waitForOwnedChromeProcess({
    profilePath: profile,
    procRoot: root,
    timeoutMs: 500,
    intervalMs: 10,
  });
  assert.equal(process.pid, 201);
});

test("Chrome's space-delimited rewritten process title is supported", (t) => {
  const root = procFixture(t);
  const profile = "/tmp/navia-rewritten-profile";
  writeRewrittenProcess(root, 251, [
    "chrome",
    "--mute-audio",
    "--load-extension=/tmp/ext",
    `--user-data-dir=${profile}`,
  ]);

  const process = findOwnedChromeProcess({ profilePath: profile, procRoot: root });
  assert.equal(process.pid, 251);
  assert.ok(process.argv.includes("--mute-audio"));
});

test("multiple main processes for one owned profile fail closed", (t) => {
  const root = procFixture(t);
  const profile = "/tmp/navia-duplicate-profile";
  writeProcess(root, 301, ["chrome", `--user-data-dir=${profile}`]);
  writeProcess(root, 302, ["chrome", `--user-data-dir=${profile}`]);

  assert.throws(
    () => findOwnedChromeProcess({ profilePath: profile, procRoot: root }),
    /Multiple browser owners/,
  );
});
