#!/usr/bin/env node
// The GC-B6H-R PUBLIC EVIDENCE PUBLISHER.
//
// It publishes the public package of a candidate from the RAW production
// authorities:
//
//   1. the machine rows are collected from the evidence root by the SHARED
//      collector (the same one the sequencer used);
//   2. the machine gate is RECOMPUTED by the production aggregate;
//   3. the private bundles are re-read and re-validated with the production
//      bundle reader;
//   4. the action ledger is reconciled against the receipts;
//   5. the generated package is SCANNED for secrets, absolute paths and raw
//      media BEFORE it is written;
//   6. the package is written ATOMICALLY, re-read, validated again, and only
//      then is the payload manifest generated and verified.
//
// Usage:
//   node scripts/stage_b_b5_3/publish_public_evidence.mjs \
//     --run-id=<id> --evidence-root=<dir> --private-root=<dir> \
//     --output-root=<dir> [--stage-root=<dir>] [--retention-ledger=<file>] \
//     [--review-rows=<file>] [--sentinel-reviews=<file>]
//
// Exit 0 when the package is published and verified, 1 otherwise.

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { ACTIVE_REGISTRY_SHA256, FROZEN_SIX } from "./lib/registry.mjs";
import { readStageTotals } from "./lib/action_ledger.mjs";
import { collectSourceRows, readAttemptedSources } from "./lib/source_rows.mjs";
import {
  buildPublicEvidence,
  publicEvidenceManifest,
  validatePublicEvidence,
} from "./lib/public_evidence.mjs";
import { SECRET_PATTERNS } from "./lib/contracts.mjs";
import { detectAbsolutePaths } from "./lib/privacy.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) out[arg.slice(2)] = "1";
    else out[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] || null;
const evidenceRoot = path.resolve(args["evidence-root"] || "");
const privateRoot = path.resolve(args["private-root"] || "");
const outputRoot = path.resolve(args["output-root"] || "");
const stageRoot = path.resolve(args["stage-root"] || path.join(repoRoot, ".navia/b5-stage"));

if (!runId || !evidenceRoot || !privateRoot || !outputRoot) {
  console.error("Usage: publish_public_evidence.mjs --run-id=<id> --evidence-root=<dir> --private-root=<dir> --output-root=<dir>");
  process.exit(1);
}

const registryOrder = FROZEN_SIX.map((entry) => String(entry.order));
const sources = FROZEN_SIX.map((entry) => ({ order: String(entry.order), bvid: entry.bvid }));
const attempted = readAttemptedSources({ evidenceRoot, sources });
const rows = collectSourceRows({ evidenceRoot, entries: attempted });
const ledgerTotals = readStageTotals({ stageRoot, candidateRunId: runId });

const readJson = (file, fallback) => {
  if (!file || !fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};

const precommit = readJson(path.join(evidenceRoot, "00-review-precommit.json"), null);
const lock = readJson(path.join(evidenceRoot, "00-candidate-lock.json"), null);
const summary = readJson(path.join(evidenceRoot, "sequencer-summary.json"), null);
const authority = summary?.candidateAuthority ?? null;
const retentionRecords = readJson(args["retention-ledger"] ? path.resolve(args["retention-ledger"]) : null, []);
const reviewRows = readJson(args["review-rows"] ? path.resolve(args["review-rows"]) : null, null);
const sentinelReviews = readJson(args["sentinel-reviews"] ? path.resolve(args["sentinel-reviews"]) : null, null);

const bundleDirectories = {};
for (const source of sources) {
  bundleDirectories[source.order] = path.join(privateRoot, `${source.order}-${source.bvid}`);
}

/**
 * The scan of the GENERATED package.
 *
 * The scan runs over the payload bytes BEFORE they are written: a secret, an
 * absolute path or a raw media payload refuses the publication.
 */
function scanPayloads(payloads) {
  const secretPatterns = SECRET_PATTERNS;
  let secretHits = 0;
  let absolutePathHits = 0;
  let rawMediaPayloadHits = 0;
  for (const payload of payloads) {
    if (payload.name === "07-scan.json") continue;
    const text = payload.content;
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) secretHits += 1;
    }
    absolutePathHits += detectAbsolutePaths(text).length;
    if (/[A-Za-z0-9+/]{512,}={0,2}/.test(text) || text.includes("PK\u0003\u0004")) {
      rawMediaPayloadHits += 1;
    }
  }
  return { secretHits, absolutePathHits, rawMediaPayloadHits };
}

const build = (scan) => buildPublicEvidence({
  runId,
  registrySha256: ACTIVE_REGISTRY_SHA256,
  registryOrder,
  aggregateRows: rows,
  ledgerTotals,
  authority,
  bundleDirectories,
  reviewRows,
  sentinelReviews,
  precommit,
  lock,
  retentionRecords,
  scan,
  repoRoot,
});

// The FIRST pass computes the scan facts; the SECOND pass publishes them.
const provisional = build(null);
const scan = scanPayloads(provisional.payloads);
const built = build(scan);
if (built.payloads.length !== provisional.payloads.length) {
  console.error("The generated package is not stable.");
  process.exit(1);
}
if (!built.ok) {
  console.error(`The generated public package is not authoritative: ${built.codes.join(", ")}`);
  process.exit(1);
}
const verdict = validatePublicEvidence(built.payloads, {
  runId,
  expectedRegistryOrder: registryOrder,
  registrySha256: ACTIVE_REGISTRY_SHA256,
  repoRoot,
});
if (!verdict.ok) {
  console.error(`The generated public package is invalid: ${verdict.codes.join(", ")}`);
  process.exit(1);
}
if (scan.secretHits > 0 || scan.absolutePathHits > 0 || scan.rawMediaPayloadHits > 0) {
  console.error(`The generated public package is not clean: ${JSON.stringify(scan)}`);
  process.exit(1);
}

// The ATOMIC write: a temporary sibling plus a rename.
fs.mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
for (const payload of built.payloads) {
  const target = path.join(outputRoot, payload.name);
  const temporary = path.join(outputRoot, `${payload.name}.tmp`);
  fs.writeFileSync(temporary, payload.content, { mode: 0o600 });
  fs.renameSync(temporary, target);
}

// The RE-READ and the SECOND validation: the written bytes are the truth.
const written = built.payloads.map((payload) => ({
  name: payload.name,
  content: fs.readFileSync(path.join(outputRoot, payload.name), "utf8"),
}));
const revalidated = validatePublicEvidence(written, {
  runId,
  expectedRegistryOrder: registryOrder,
  registrySha256: ACTIVE_REGISTRY_SHA256,
  repoRoot,
});
if (!revalidated.ok) {
  console.error(`The written public package is invalid: ${revalidated.codes.join(", ")}`);
  process.exit(1);
}

// The MANIFEST is generated LAST and it is verified.
const manifestText = publicEvidenceManifest(written);
const manifestPath = path.join(outputRoot, "PAYLOAD_MANIFEST.sha256");
fs.writeFileSync(manifestPath, manifestText, { mode: 0o600 });
let verified = true;
for (const line of manifestText.split("\n")) {
  if (!line.trim()) continue;
  const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
  if (!match) {
    verified = false;
    break;
  }
  const bytes = fs.readFileSync(path.join(outputRoot, match[2]));
  if (createHash("sha256").update(bytes).digest("hex") !== match[1]) {
    verified = false;
    break;
  }
}
if (!verified) {
  console.error("The payload manifest does not verify.");
  process.exit(1);
}

console.log(JSON.stringify({
  published: true,
  runId,
  payloadCount: written.length,
  machineGatePositive: built.machineGatePositive,
  counts: built.counts,
  scan,
  builderCodes: built.codes,
  validatorCodes: revalidated.codes,
  manifestVerified: verified,
}, null, 2));
