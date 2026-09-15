import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildDependencyClosure,
  createAcceptanceSnapshot,
  canonicalJson,
  collectEsmImportGraph,
  dependencyClosureSha256,
  ensureEmptyDirectory,
  resolveReplayInvocationRecord,
  sha256,
  T04_EXTERNAL_AUDIT_SHA256,
  T04_USER_INSTRUCTION_SHA256,
  validateImplementationAuthorization,
  validateResolvedReplayInvocation
} from "./v2PxSnapshotReplay.mjs";

test("validates the post-audit implementation authorization from raw bytes", () => {
  const result = validateImplementationAuthorization();
  assert.equal(result.auditRef.sha256, T04_EXTERNAL_AUDIT_SHA256);
  assert.equal(result.record.userInstructionSha256, T04_USER_INSTRUCTION_SHA256);
  assert.equal(result.authorizationRef.sha256, "47863e4197dcf66700b81d15d7136d5595a3153c1940d2a206227aee2ae92a97");
});

test("derives replay-only invocation refs without modifying the T03 source record", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-t04-resolved-invocation-"));
  const write = (relativePath, content) => {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const bytes = Buffer.from(content);
    fs.writeFileSync(target, bytes);
    return { artifactRoot: "validation_run", path: relativePath, sha256: sha256(bytes), byteLength: bytes.length, mediaType: relativePath.endsWith(".mjs") ? "text/javascript" : relativePath.endsWith(".json") ? "application/json" : "text/plain" };
  };
  const steps = ["derive", "validate", "report", "package"].map((stepId) => ({
    stepId,
    implementation: write(`input/invocation/${stepId}.mjs`, `export const step = "${stepId}";\n`),
    cwdRole: "extension_root",
    argv: ["node", `${stepId}.mjs`],
    exitCode: 0,
    signal: null,
    stdout: write(`logs/invocation/${stepId}.stdout.log`, "ok\n"),
    stderr: write(`logs/invocation/${stepId}.stderr.log`, "")
  }));
  const invocation = {
    schemaVersion: "v2-px-invocation-record/v1",
    evidenceClass: "production_acceptance",
    profile: "production_candidate",
    validationRunId: "validation-test",
    sourceRunId: "source-test",
    recordedAt: "2026-09-14T00:00:00.000Z",
    steps,
    productionPackage: write("production-package.json", "{}\n"),
    exitCode: 0,
    passed: true,
    claimBoundary: "Human Review pending."
  };
  fs.writeFileSync(path.join(root, "invocation-record.json"), `${JSON.stringify(invocation)}\n`);
  const before = sha256(fs.readFileSync(path.join(root, "invocation-record.json")));
  const resolved = resolveReplayInvocationRecord(invocation, root);
  assert.equal(resolved.sourceInvocation.artifactRoot, "replay_validation");
  assert.ok(resolved.steps.every((step) => [step.implementation, step.stdout, step.stderr].every((ref) => ref.artifactRoot === "replay_validation")));
  assert.equal(resolved.productionPackage.artifactRoot, "replay_validation");
  assert.equal(validateResolvedReplayInvocation(resolved, root).originalSha256, before);
  assert.equal(sha256(fs.readFileSync(path.join(root, "invocation-record.json"))), before);
  const mixed = structuredClone(invocation);
  mixed.steps[0].stdout.artifactRoot = "replay_validation";
  assert.throws(() => resolveReplayInvocationRecord(mixed, root), /T04_INVOCATION_EVIDENCE_INVALID/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("canonical JSON sorts nested object keys without changing array order", () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, b: 3 }, q: [2, 1] }), '{"a":{"b":3,"y":2},"q":[2,1],"z":1}');
  assert.equal(sha256(Buffer.from("x")), "2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881");
});

test("builds a transitive ESM graph and a reproducible closure", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-t04-closure-"));
  fs.mkdirSync(path.join(root, "lib"));
  fs.writeFileSync(path.join(root, "entry.mjs"), 'import "./lib/a.mjs"; export { b } from "./lib/b.mjs";');
  fs.writeFileSync(path.join(root, "lib/a.mjs"), 'export const a = import("./b.mjs");');
  fs.writeFileSync(path.join(root, "lib/b.mjs"), "export const b = 1;");
  fs.writeFileSync(path.join(root, "contract.json"), "{}\n");
  fs.writeFileSync(path.join(root, "lock.yaml"), "lockfileVersion: 1\n");
  const graph = collectEsmImportGraph(root, ["entry.mjs"]);
  assert.deepEqual(graph.files, ["entry.mjs", "lib/a.mjs", "lib/b.mjs"]);
  assert.equal(graph.importEdges.length, 3);
  assert.deepEqual(graph.missingEdges, []);
  const closure = buildDependencyClosure({
    repositoryRoot: root,
    entrypoints: ["entry.mjs"],
    declaredArtifacts: ["contract.json"],
    lockfiles: ["lock.yaml"],
    describeFile(relativePath) {
      return { role: relativePath.endsWith(".json") ? "schema" : relativePath.endsWith(".yaml") ? "lockfile" : "module", sourceDisposition: "t04_authorized_implementation", sourceReferenceSha256: "a".repeat(64) };
    }
  });
  assert.equal(closure.files.length, 5);
  assert.equal(closure.closureSha256, dependencyClosureSha256(closure.files));
  fs.rmSync(root, { recursive: true, force: true });
});

test("fails closed for unresolved imports and nonempty output roots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-t04-failure-"));
  fs.writeFileSync(path.join(root, "entry.mjs"), 'import "./missing.mjs";');
  assert.equal(collectEsmImportGraph(root, ["entry.mjs"]).missingEdges.length, 1);
  const output = path.join(root, "output");
  ensureEmptyDirectory(output);
  fs.writeFileSync(path.join(output, "occupied"), "x");
  assert.throws(() => ensureEmptyDirectory(output), /T04_OUTPUT_IMMUTABILITY_FAILED/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("creates an importable detached acceptance snapshot without moving the source HEAD", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-t04-snapshot-source-"));
  const snapshotRoot = path.join(os.tmpdir(), `navia-t04-snapshot-checkout-${process.pid}-${Date.now()}`);
  const bundlePath = path.join(root, "out", "snapshot.bundle");
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init");
  fs.writeFileSync(path.join(root, "base.txt"), "base\n");
  git("add", "base.txt");
  git("-c", "user.name=Test", "-c", "user.email=test@navia.local", "commit", "-m", "base");
  const baseCommit = git("rev-parse", "HEAD");
  fs.writeFileSync(path.join(root, "overlay.txt"), "overlay\n");
  const overlayBytes = fs.readFileSync(path.join(root, "overlay.txt"));
  const closure = {
    files: [
      { path: "base.txt", mode: "100644", sha256: sha256(Buffer.from("base\n")), byteLength: 5, sourceDisposition: "product_base_commit" },
      { path: "overlay.txt", mode: "100644", sha256: sha256(overlayBytes), byteLength: overlayBytes.length, sourceDisposition: "t04_authorized_implementation" }
    ]
  };
  const result = createAcceptanceSnapshot({ repositoryRoot: root, baseCommit, closure, snapshotRoot, bundlePath });
  assert.equal(git("rev-parse", "HEAD"), baseCommit);
  assert.match(result.acceptanceCommit, /^[0-9a-f]{40}$/);
  assert.equal(fs.readFileSync(path.join(snapshotRoot, "overlay.txt"), "utf8"), "overlay\n");
  assert.ok(fs.statSync(bundlePath).size > 0);
  spawnSync("git", ["worktree", "remove", "--force", snapshotRoot], { cwd: root });
  fs.rmSync(root, { recursive: true, force: true });
});
