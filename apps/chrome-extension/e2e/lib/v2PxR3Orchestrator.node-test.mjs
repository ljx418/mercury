import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ensureFreshOutputRoot, portableArgv } from "../run-v2-px-r3-validation.mjs";

test("requires an empty output root and emits only portable argv", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-t03-orchestrator-"));
  const output = path.join(root, "output");
  ensureFreshOutputRoot(output);
  fs.writeFileSync(path.join(output, "occupied"), "x");
  assert.throws(() => ensureFreshOutputRoot(output), /must be empty/);
  const runRoot = "/private/source/run";
  const args = portableArgv(["node", "/mnt/c/workspace/navia/apps/chrome-extension/e2e/tool.mjs", "--run-root", runRoot, "--output-root", output], runRoot, output);
  assert.equal(args.join(" ").includes(runRoot), false);
  assert.equal(args.join(" ").includes(output), false);
  assert.equal(args.join(" ").includes("/mnt/c/workspace/navia"), false);
  assert.ok(args.includes("$SOURCE_RUN"));
  assert.ok(args.includes("$OUTPUT_ROOT"));
  fs.rmSync(root, { recursive: true, force: true });
});
