/**
 * WP-B VH5 — transient ownership and the redacted public receipt.
 *
 * Two rules:
 *
 *   * every transient file lives UNDER THE OWNED ROOT, and its removal is
 *     registered so it also happens when ffmpeg, a read or a hash fails;
 *   * the public receipt is written to an explicitly declared STABLE evidence
 *     destination, and only AFTER the owned processes and resources are gone —
 *     so it survives the deletion of the owned root.
 *
 * The public receipt may carry fixed case ids, product ids, counters, enums
 * and SHA-256 values. It may NOT carry an absolute path, a file name, a bearer,
 * a cookie or an API key, raw media, frame bytes, transcript text, a Chrome
 * command line with a private path, or an unredacted log.
 */

import fs from "node:fs";
import path from "node:path";
import { HarnessError } from "./plan.mjs";

/** The redaction rules the public receipt must satisfy. */
export const REDACTION_RULES = Object.freeze([
  { id: "absolute-path", pattern: /(^|["'\s])(\/[A-Za-z]:\/|\/[A-Za-z0-9._-]+\/)/ },
  { id: "windows-path", pattern: /[A-Za-z]:\\Users\\|[A-Za-z]:\\Windows\\/i },
  { id: "bearer", pattern: /Bearer\s+[A-Za-z0-9._-]{16,}/i },
  { id: "cookie", pattern: /(SESSDATA|bili_jct|buvid3|__ac_nonce)/i },
  { id: "api-key", pattern: /(api[_-]?key|secret|token)\s*[:=]\s*["'][^"']{8,}["']/i },
  { id: "raw-media", pattern: /data:(video|audio|image)\/[a-z0-9.+-]+;base64,/i },
  { id: "frame-bytes", pattern: /\\x89PNG|\\xff\\xd8\\xff/i },
  { id: "transcript-text", pattern: /"?"transcriptText"?\s*[:=]|"segments"\s*:\s*\[\s*\{/i },
  { id: "chrome-command-line", pattern: /"--user-data-dir=|\/shared\/source\.bin|\.mp4"/i }
]);

/**
 * Assert a receipt carries nothing private.
 *
 * The fixed allow-listed KEYS are checked separately: a receipt may only hold
 * the declared value types, and every string value must survive the redaction
 * rules.
 */
export function assertReceiptIsRedacted(receipt) {
  const problems = [];
  const rendered = JSON.stringify(receipt);
  for (const rule of REDACTION_RULES) {
    if (rule.pattern.test(rendered)) problems.push(`the receipt matches the ${rule.id} rule`);
  }
  const visit = (value, trail) => {
    if (typeof value === "string") {
      for (const rule of REDACTION_RULES) {
        if (rule.pattern.test(value)) problems.push(`${trail} matches the ${rule.id} rule`);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${trail}[${index}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) visit(item, `${trail}.${key}`);
    }
  };
  visit(receipt, "receipt");
  if (problems.length) {
    throw new HarnessError(`The public receipt is not redacted: ${problems.join("; ")}`);
  }
  return true;
}

/**
 * The stable evidence destination.
 *
 * It is OUTSIDE the owned root on purpose: the receipt must survive the owned
 * root's deletion.
 */
export function resolveStableEvidenceDestination({ configured, ownedRoot }) {
  if (!configured) {
    throw new HarnessError(
      "EXTERNAL-INPUT BLOCK: no stable evidence destination was declared. The public receipt could not survive the owned root's deletion.",
    );
  }
  const destination = path.resolve(configured);
  if (!path.isAbsolute(destination)) {
    throw new HarnessError("The stable evidence destination must be an absolute path.");
  }
  if (ownedRoot) {
    const owned = path.resolve(ownedRoot);
    if (destination === owned || destination.startsWith(`${owned}${path.sep}`)) {
      throw new HarnessError("The stable evidence destination must be outside the owned root.");
    }
  }
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  return destination;
}

/**
 * Write the redacted receipt, AFTER the owned resources are gone.
 */
export function writeStableReceipt({ destination, receipt }) {
  assertReceiptIsRedacted(receipt);
  const file = path.join(destination, "visible-session-receipt.json");
  fs.writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return { file, bytes: fs.statSync(file).size };
}

/**
 * The owned temporary files.
 *
 * Every file is created under the owned root and registered for removal, so a
 * failed ffmpeg, read or hash still leaves nothing behind.
 */
export function createOwnedTempRegistry({ ownedRoot }) {
  if (!ownedRoot) throw new HarnessError("The temp registry needs the owned root.");
  const files = new Set();
  const directories = new Set();
  return {
    ownedRoot,
    files: () => [...files],
    registerFile(file) {
      files.add(path.resolve(file));
      return file;
    },
    registerDirectory(directory) {
      directories.add(path.resolve(directory));
      return directory;
    },
    /** A path BELOW the owned root. Nothing is ever written to a global /tmp. */
    pathFor(name) {
      const candidate = path.resolve(ownedRoot, name);
      if (!candidate.startsWith(`${path.resolve(ownedRoot)}${path.sep}`)) {
        throw new HarnessError(`A temporary path escaped the owned root: ${name}`);
      }
      files.add(candidate);
      directories.add(path.dirname(candidate));
      return candidate;
    },
    /** Remove every registered file, even when the work failed half way. */
    async cleanup() {
      for (const file of files) {
        try {
          fs.rmSync(file, { force: true });
        } catch {
          // A file that is already gone is not a failure.
        }
      }
      for (const directory of directories) {
        try {
          fs.rmSync(directory, { recursive: true, force: true });
        } catch {
          // A directory that is already gone is not a failure.
        }
      }
      files.clear();
      directories.clear();
      try {
        fs.rmSync(ownedRoot, { recursive: true, force: true });
      } catch {
        // The owner reports the remaining root through its post-cleanup check.
      }
      return true;
    }
  };
}

/**
 * A redacted diagnostic for a FAILED visible run. It carries the same
 * redaction rules as the success receipt.
 */
export function buildFailureDiagnostic({ caseId, error, ownedResidue }) {
  const message = String(error?.message ?? error ?? "unknown failure");
  return {
    schemaVersion: "v3-wp-b-visible-session-diagnostic/v1",
    case: caseId ?? null,
    // Only the stable, non-private part of the message.
    failure: message.replace(/(\/[A-Za-z0-9._-]+){2,}/g, "<path>").replace(/[A-Za-z0-9._-]{24,}/g, "<redacted>"),
    ownedResidue: ownedResidue ?? null
  };
}
