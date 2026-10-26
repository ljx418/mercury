// The patched sequencer copies of the offline tests.
//
// A test that needs a different runner (a stub, a sleeping runner) needs a
// COPY of the sequencer with two substitutions:
//
//   * the runner path,
//   * the repository root (the copy lives outside the source tree).
//
// The copy is generated in a UNIQUE, OWNED temporary directory and it is
// DELETED when the test finishes. A generated artefact never lands in the
// repository: `test/_fixtures/` holds no generated file.
//
// The copy's relative `./lib/*.mjs` imports are rewritten to the REAL library
// files, so a new library never breaks a copy silently.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Create ONE patched sequencer copy.
 *
 * @returns {{path: string, directory: string, dispose: () => void}}
 */
export function createSequencerCopy({
  repoRoot,
  sequencerPath,
  runnerAbsPath,
  prefix = "navia-b5-seqcopy-",
}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    fs.chmodSync(directory, 0o700);
  } catch {
    // A permission that cannot be tightened is not a test failure.
  }
  const target = path.join(directory, "sequencer_copy.mjs");
  const original = fs.readFileSync(sequencerPath, "utf8");
  const patched = original
    .replace('path.join(here, "run_one_bvid.mjs")', JSON.stringify(runnerAbsPath))
    .replace('path.resolve(here, "../..")', JSON.stringify(repoRoot))
    // EVERY "./lib/*.mjs" import is rewritten, so a NEW library never breaks
    // this copy silently.
    .replace(/from "\.\/lib\/([A-Za-z0-9_.-]+\.mjs)"/g, (_whole, name) => (
      `from ${JSON.stringify(new URL(`./${name}`, import.meta.url).href)}`
    ));
  fs.writeFileSync(target, patched, { mode: 0o600 });
  return {
    path: target,
    directory,
    dispose() {
      try {
        fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        // The cleanup audit reports a leftover copy; it never fails a test.
      }
    },
  };
}
