// The PROCESS-LEVEL mutation runner of the B-6A bundle closure.
//
// It is a SEPARATE process: the mutation is applied to a REAL bundle and the
// PRODUCTION validator decides. The parent test reads the exit code and the
// stable failure codes.
//
//   usage: node b6_mutation_runner.mjs <mutation>
//
// The exit code is the VERDICT:
//   0 — the mutation was REFUSED (the validator returned not-ok)
//   3 — the mutation was ACCEPTED (the defect class is OPEN)
//   4 — the mutation itself failed
//
// No Chrome, no Runtime, no Provider, no download, no Cookie.

import { validateReviewBundle } from "../../lib/review_bundle.mjs";
import { buildBundleFixture } from "./b6_bundle_fixture.mjs";
import { sha256Hex } from "../../lib/v21_artifact.mjs";

/** The mutation classes of the bundle closure. */
export const MUTATIONS = Object.freeze({
  none: "the positive control: the bundle must be accepted",
  "foreign-adapter": "the source identity names a foreign adapter",
  "stale-revision": "the bundle declares another task revision",
  "detached-manifest-bytes": "a manifest entry carries detached bytes with a self-consistent digest",
  "false-closure": "the capture receipt declares a false closure flag",
  "wrong-counts": "the capture receipt declares zero counts",
  "wrong-hashes": "the capture receipt declares zero digests",
  "wrong-receipt-schema": "the capture receipt declares another schema",
  "failed-status": "the capture receipt declares the failed status",
  "manifest-traversal": "the manifest names a traversing path",
  "manifest-undeclared": "the manifest names an undeclared file",
  "manifest-missing": "the manifest lacks a contracted file",
  "provider-in-receipt": "the public capture receipt carries the Provider identity",
});

function rewriteArtifact(bundle, mutate) {
  const derivative = JSON.parse(bundle.artifact.toString("utf8"));
  mutate(derivative);
  bundle.artifact = Buffer.from(JSON.stringify(derivative), "utf8");
}

export function applyMutation(name, bundle) {
  switch (name) {
    case "none":
      return bundle;
    case "foreign-adapter": {
      // The identity, the derivative binding and the workspace all name the
      // foreign adapter: ONLY the strict grammar can refuse it.
      const foreign = `portal:attacker:${bundle.source.bvid}:41828944992:p1`;
      bundle.source.sourceIdentity = foreign;
      bundle.workspace.task.sourceIdentity = foreign;
      rewriteArtifact(bundle, (derivative) => { derivative.binding.sourceIdentity = foreign; });
      return bundle;
    }
    case "stale-revision": {
      // The bundle declares a revision that is not the one of the captured
      // derivative: the bundle is stale.
      bundle.source.taskRevision = 6;
      return bundle;
    }
    case "detached-manifest-bytes": {
      // The manifest entry carries bytes that are NOT the bytes of the bundle
      // component, and its own digest agrees with the detached payload.
      const entry = bundle.manifest.find((item) => item.path === "source.json");
      const detached = Buffer.from("{}", "utf8");
      entry.bytes = detached;
      entry.sha256 = sha256Hex(detached);
      return bundle;
    }
    case "false-closure": {
      bundle.captureReceipt.closure = { ...bundle.captureReceipt.closure, identityClosed: false };
      return bundle;
    }
    case "wrong-counts": {
      bundle.captureReceipt.counts = { evidence: 0, thumbnails: 0, chapters: 0 };
      return bundle;
    }
    case "wrong-hashes": {
      bundle.captureReceipt.digests = {
        artifactSha256: "0".repeat(64),
        evidenceCatalogSha256: "0".repeat(64),
        bundleSha256: "0".repeat(64),
        reviewBindingSha256: "0".repeat(64),
      };
      return bundle;
    }
    case "wrong-receipt-schema": {
      bundle.captureReceipt.schemaVersion = "v3-5.10-b6-capture-receipt/v0";
      return bundle;
    }
    case "failed-status": {
      bundle.captureReceipt.status = "failed";
      return bundle;
    }
    case "manifest-traversal": {
      bundle.manifest.push({
        path: "../../etc/passwd",
        sha256: "0".repeat(64),
        bytes: Buffer.from("", "utf8"),
      });
      return bundle;
    }
    case "manifest-undeclared": {
      bundle.manifest.push({
        path: "extra.json",
        sha256: "0".repeat(64),
        bytes: Buffer.from("{}", "utf8"),
      });
      return bundle;
    }
    case "manifest-missing": {
      bundle.manifest = bundle.manifest.filter((item) => item.path !== "seek-map.json");
      return bundle;
    }
    case "provider-in-receipt": {
      bundle.captureReceipt.providerId = "minimax-cn-openai-vision";
      return bundle;
    }
    default:
      throw new Error(`the mutation ${name} is unknown`);
  }
}

function main() {
  const name = process.argv[2] ?? "none";
  let bundle;
  try {
    bundle = buildBundleFixture({});
    applyMutation(name, bundle);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ error: String(error?.message ?? error) })}\n`);
    process.exit(4);
  }
  const verdict = validateReviewBundle(bundle);
  process.stdout.write(`${JSON.stringify({
    mutation: name,
    ok: verdict.ok,
    codes: verdict.failures.map((failure) => failure.code),
  })}\n`);
  process.exit(verdict.ok ? 3 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
