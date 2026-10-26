// The temporary roots of the OFFLINE tests.
//
// Every root is OWNED by the test that created it, it lives under the
// platform's temporary directory, and it is REMOVED when the test process
// exits: an offline test never leaves a residue behind.
//
// The roots are SYNTHETIC. They never hold a real Cookie, a real media file
// or a real credential.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** The roots this process owns. */
const owned = new Set();

/** Create ONE owned temporary root. */
export function makeTempRoot(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    fs.chmodSync(root, 0o700);
  } catch {
    // A permission that cannot be tightened is not a test failure: the root
    // is still removed at exit.
  }
  owned.add(root);
  return root;
}

/** Remove ONE owned temporary root now. */
export function removeTempRoot(root) {
  if (!root) return false;
  owned.delete(root);
  try {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    return true;
  } catch {
    return false;
  }
}

/** The owned roots of this process. */
export function ownedTempRoots() {
  return [...owned].sort();
}

process.on("exit", () => {
  for (const root of owned) {
    try {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // The exit path never throws: a leftover root is reported by the
      // cleanup audit, not by a crash.
    }
  }
});
