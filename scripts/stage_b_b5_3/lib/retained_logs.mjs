// The retained logs of the EARLIER attempts of this stage.
//
// The historical lower bound is computed over the logs that the HISTORICAL
// evidence packages retained. The package list is EXPLICIT: a NEW evidence
// package never enters the historical lower bound, and a package that does
// not belong to this stage is never read.
//
// The entries carry a SAFE relative label only. An absolute path never
// enters the evidence.

import fs from "node:fs";
import path from "node:path";

/** The historical evidence packages of the B-5 stage. */
export const HISTORICAL_PACKAGE_PREFIXES = Object.freeze([
  "gc-b5r-b5-real-run-",
  "gc-b5r-b5-offline-corrective-",
]);

/**
 * The retained log entries of the historical packages.
 *
 * Two kinds are collected:
 *
 *   * a CONSOLE log (`*console.log`): it records EVERY launch of ONE attempt.
 *   * a per-source `chrome_launch.log`: it records the launch of ONE source.
 */
export function collectRetainedLogEntries({
  completionRoot,
  historicalPrefixes = HISTORICAL_PACKAGE_PREFIXES,
} = {}) {
  const entries = [];
  if (!completionRoot) return entries;
  let packages = [];
  try {
    packages = fs.readdirSync(completionRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => historicalPrefixes.some((prefix) => entry.name.startsWith(prefix)))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return entries;
  }
  const walk = (directory, relative) => {
    let children = [];
    try {
      children = fs.readdirSync(directory, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return;
    }
    for (const child of children) {
      const childRoot = path.join(directory, child.name);
      const childRelative = `${relative}/${child.name}`;
      if (child.isDirectory()) {
        walk(childRoot, childRelative);
        continue;
      }
      if (child.name.endsWith("console.log")) {
        entries.push({ label: childRelative, kind: "console", path: childRoot });
        continue;
      }
      if (child.name === "chrome_launch.log") {
        entries.push({ label: childRelative, kind: "source_launch_log", path: childRoot });
      }
    }
  };
  for (const name of packages) {
    walk(path.join(completionRoot, name), name);
  }
  return entries;
}
