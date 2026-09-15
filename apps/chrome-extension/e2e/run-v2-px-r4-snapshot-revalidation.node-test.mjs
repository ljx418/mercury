import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildT04DependencyClosure, buildT04Governance, flattenPnpmPackages, parsePnpmIntegrityIndex, runT040, T04_ENTRYPOINTS } from "./run-v2-px-r4-snapshot-revalidation.mjs";
import { T04_APPROVED_SCOPE } from "./lib/v2PxSnapshotReplay.mjs";

test("uses the frozen T04.1 scope when building Snapshot Input governance", () => {
  const authorization = {
    auditRef: { path: "audit.md" },
    authorizationRef: { path: "authorization.json" },
    record: { stage: "T04.1" }
  };
  assert.deepEqual(buildT04Governance(authorization), {
    externalDocumentAudit: authorization.auditRef,
    externalDocumentAuditFatal: 0,
    externalDocumentAuditMajor: 0,
    implementationAuthorization: authorization.authorizationRef,
    authorizationRecord: authorization.record,
    approvedScope: T04_APPROVED_SCOPE
  });
});

test("computes the real mixed-source T04 dependency closure", () => {
  const closure = buildT04DependencyClosure();
  assert.deepEqual(closure.missingEdges, []);
  assert.deepEqual(closure.undeclaredReads, []);
  assert.deepEqual(closure.unexpectedFiles, []);
  assert.deepEqual(closure.entrypoints, [...T04_ENTRYPOINTS].sort());
  assert.ok(closure.files.length > 100);
  assert.ok(closure.importEdges.length > 10);
  assert.ok(closure.files.some((item) => item.sourceDisposition === "product_base_commit"));
  assert.ok(closure.files.some((item) => item.sourceDisposition === "t03_independent_audit"));
  assert.equal(closure.files.filter((item) => item.sourceDisposition === "t04_authorized_implementation").length, 6);
  assert.ok(closure.files.some((item) => item.sourceDisposition === "frozen_contract"));
});

test("writes a complete T04-0 result only into a fresh output root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-t04-0-"));
  const output = path.join(root, "run");
  const result = runT040({ outputRoot: output, t04RunId: "t04-r4-node-test" });
  assert.equal(result.verification.acceptanceIds.length, 14);
  assert.equal(result.verification.requirements.length, 25);
  assert.equal(JSON.parse(fs.readFileSync(path.join(output, "t04-0-result.json"))).passed, true);
  assert.throws(() => runT040({ outputRoot: output, t04RunId: "t04-r4-node-test" }), /T04_OUTPUT_IMMUTABILITY_FAILED/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("binds installed pnpm packages to lockfile integrity", () => {
  const lock = [
    "lockfileVersion: '9.0'",
    "packages:",
    "",
    "  '@scope/pkg@1.2.3':",
    "    resolution: {integrity: sha512-scopehash==}",
    "",
    "  plain@4.5.6:",
    "    resolution: {integrity: sha512-plainhash==}",
    "",
    "snapshots:"
  ].join("\n");
  const index = parsePnpmIntegrityIndex(lock);
  const packages = flattenPnpmPackages([
    {
      dependencies: {
        "@scope/pkg": {
          version: "1.2.3",
          resolved: "scope.tgz",
          dependencies: { plain: { version: "4.5.6", resolved: "plain.tgz" } }
        }
      }
    }
  ], index);
  assert.deepEqual(packages, [
    { name: "@scope/pkg", version: "1.2.3", integrity: "sha512-scopehash==", resolved: "scope.tgz" },
    { name: "plain", version: "4.5.6", integrity: "sha512-plainhash==", resolved: "plain.tgz" }
  ]);
  assert.throws(() => flattenPnpmPackages([{ dependencies: { missing: { version: "1.0.0" } } }], index), /lock integrity missing/);
});
