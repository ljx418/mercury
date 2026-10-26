// The RAW per-source rows of a candidate.
//
// ONE collector: the sequencer and the public evidence publisher read the
// SAME rows from the SAME evidence root, so the public package is computed
// from exactly the facts the machine gate saw.
//
// Nothing is invented here: a missing file stays missing, a malformed
// receipt stays malformed and the artifact is the EXACT durable bytes.

import fs from "node:fs";
import path from "node:path";

import { REQUIRED_SOURCE_EVIDENCE } from "./aggregate.mjs";
import { V21_ARTIFACT_FILENAME } from "./v21_artifact.mjs";

export { REQUIRED_SOURCE_EVIDENCE };

/**
 * Collect one machine row per attempted source.
 *
 * The row carries the evidence presence, the machine receipt, the receipt
 * mirror, the task-namespace receipt, the durable artifact bytes and the
 * audits.
 */
export function collectSourceRows({ evidenceRoot, entries = [] } = {}) {
  const root = path.resolve(evidenceRoot);
  return entries.map((entry) => {
    const dir = path.join(root, `bvid-${entry.order}-${entry.bvid}`);
    const evidence = {};
    for (const name of REQUIRED_SOURCE_EVIDENCE) {
      evidence[name] = fs.existsSync(path.join(dir, name));
    }
    let receipt = null;
    try {
      receipt = JSON.parse(fs.readFileSync(path.join(dir, "b5-source-receipt.json"), "utf8"));
    } catch { /* no receipt */ }
    // The DURABLE ARTIFACT: the EXACT bytes of the contracted file. The
    // name is resolved EXACTLY: there is no directory search and no
    // ambiguity.
    let artifact = null;
    const artifactPath = path.join(dir, V21_ARTIFACT_FILENAME);
    if (fs.existsSync(artifactPath)) {
      try {
        artifact = {
          filename: V21_ARTIFACT_FILENAME,
          bytes: fs.readFileSync(artifactPath),
        };
      } catch { artifact = null; }
    }
    // The task-namespace RECEIPT is PARSED. Its presence is not proof: the
    // aggregate binds its namespace, run id, order and bvid to the machine
    // receipt, the current run and the registry row.
    let namespaceReceipt = null;
    let namespaceParseError = null;
    try {
      namespaceReceipt = JSON.parse(
        fs.readFileSync(path.join(dir, "task_namespace.json"), "utf8"),
      );
    } catch (error) {
      namespaceParseError = String(error?.message ?? error).slice(0, 200);
    }
    let secretHitCount = 0;
    try {
      const csv = fs.readFileSync(path.join(dir, "secret_scan.csv"), "utf8");
      secretHitCount = csv.split("\n").slice(1).filter((line) => line.trim().length > 0).length;
    } catch { /* no scan file: the evidence check reports it */ }
    let cleanupComplete = false;
    try {
      const cleanup = JSON.parse(fs.readFileSync(path.join(dir, "cleanup.json"), "utf8"));
      cleanupComplete = cleanup.runtimeScratchDeleted === true && cleanup.profileRootDeleted === true;
    } catch { /* no cleanup receipt */ }
    // The MIRROR is PARSED. The presence of the file is not evidence: a
    // malformed or missing mirror is a failure of its own.
    let mirror = null;
    let mirrorParseError = null;
    try {
      mirror = JSON.parse(fs.readFileSync(path.join(dir, "receipt.json"), "utf8"));
    } catch (error) {
      mirrorParseError = String(error?.message ?? error).slice(0, 200);
    }
    const audits = {
      secretHitCount,
      audioOutputCount: Number(receipt?.audioOutputCount ?? 0),
      tabCaptureCount: Number(receipt?.tabCaptureCount ?? 0),
      focusEventCount: Number(receipt?.focusEventCount ?? 0),
      ownedProcessLeakCount: Number(entry.ownedLeakSightings?.length ?? 0),
      cleanupComplete,
    };
    return {
      order: entry.order,
      bvid: entry.bvid,
      disposition: entry.disposition,
      exitCode: entry.exitCode ?? null,
      signal: entry.signal ?? null,
      evidence,
      receipt,
      mirror,
      mirrorParseError,
      namespaceReceipt,
      namespaceParseError,
      artifact,
      processAuditBefore: entry.processAuditBefore ?? null,
      processAuditAfter: entry.processAuditAfter ?? null,
      ownedLeakSightings: entry.ownedLeakSightings ?? [],
      audits,
    };
  });
}

/**
 * The attempted sources of a candidate, read from the evidence root.
 *
 * The disposition of a source is read from its OWN final disposition file:
 * a source that wrote none is a failure.
 */
export function readAttemptedSources({ evidenceRoot, sources = [] } = {}) {
  const root = path.resolve(evidenceRoot);
  return sources.map((source) => {
    const dir = path.join(root, `bvid-${source.order}-${source.bvid}`);
    const dispositionPath = path.join(dir, "final_disposition.txt");
    let disposition = "failed";
    if (fs.existsSync(dispositionPath)) {
      const first = fs.readFileSync(dispositionPath, "utf8").trim().split("\n")[0] ?? "failed";
      disposition = first || "failed";
    }
    return { order: source.order, bvid: source.bvid, disposition };
  });
}
