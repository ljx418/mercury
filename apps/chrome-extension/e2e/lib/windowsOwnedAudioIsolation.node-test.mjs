import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { __test } from "./windowsOwnedAudioIsolation.mjs";

test("accepts only the owned R5 Chrome profile namespace", () => {
  assert.equal(__test.assertOwnedProfile("/tmp/navia-t01-profile-R5B123"), "navia-t01-profile-R5B123");
  assert.throws(() => __test.assertOwnedProfile("/tmp/Default"), /unexpected profile/);
});

test("reads only the fixed isolation status schema", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-audio-isolation-"));
  const target = path.join(root, "status.json");
  try {
    fs.writeFileSync(target, JSON.stringify({ schemaVersion: "wrong", watcherReady: true }));
    assert.equal(__test.readStatus(target), null);
    fs.writeFileSync(target, JSON.stringify({ schemaVersion: "navia-owned-chrome-audio-isolation/v1", watcherReady: true }));
    assert.equal(__test.readStatus(target).watcherReady, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("converts only WSL Windows mounts for PowerShell", () => {
  assert.equal(__test.windowsPath("/mnt/c/workspace/navia"), "C:\\workspace\\navia");
  assert.throws(() => __test.windowsPath("/tmp/navia"), /Windows-mounted path/);
});

test("PowerShell watcher remains PID/profile scoped and never changes endpoint master volume", () => {
  const source = fs.readFileSync(new URL("./windows-owned-audio-session-mute.ps1", import.meta.url), "utf8");
  assert.match(source, /GetProcessId/);
  assert.match(source, /owned\.Contains\(processId\)/);
  assert.match(source, /SetMute\(true/);
  assert.doesNotMatch(source, /IAudioEndpointVolume/);
  assert.doesNotMatch(source, /SetMasterVolumeLevel/);
  assert.doesNotMatch(source, /volume\.SetMasterVolume\(/);
});
