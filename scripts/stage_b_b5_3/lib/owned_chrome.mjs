import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

function readArgv(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const nulSeparated = raw.split("\0").filter(Boolean);
    // Chromium may rewrite its argv memory into one space-delimited title,
    // leaving only the terminal NUL visible through /proc. Owned profiles are
    // generated under /tmp and contain no whitespace, so both kernel-visible
    // representations can be tokenized without weakening the exact match.
    return nulSeparated.length === 1
      ? nulSeparated[0].trim().split(/\s+/).filter(Boolean)
      : nulSeparated;
  } catch {
    return null;
  }
}

/** Find the browser process owned by one exact Playwright profile. */
export function findOwnedChromeProcess({ profilePath, procRoot = "/proc" }) {
  const expectedProfileArg = `--user-data-dir=${profilePath}`;
  const matches = [];
  let entries = [];
  try {
    entries = fs.readdirSync(procRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
    const argv = readArgv(path.join(procRoot, entry.name, "cmdline"));
    if (!argv || !argv.includes(expectedProfileArg)) continue;
    if (argv.some((argument) => argument.startsWith("--type="))) continue;
    matches.push({ pid: Number(entry.name), argv, cmdline: argv.join(" ") });
  }
  if (matches.length > 1) {
    throw new Error(`Multiple browser owners use the same owned profile (${matches.length}).`);
  }
  return matches[0] ?? null;
}

/** Wait for /proc publication after Playwright has returned the context. */
export async function waitForOwnedChromeProcess({
  profilePath,
  procRoot = "/proc",
  timeoutMs = 5_000,
  intervalMs = 50,
}) {
  const deadline = Date.now() + timeoutMs;
  do {
    const process = findOwnedChromeProcess({ profilePath, procRoot });
    if (process) return process;
    await delay(intervalMs);
  } while (Date.now() < deadline);
  return null;
}
