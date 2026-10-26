# WP-B visible-session harness checkpoint

**Decision: `WP-B ACCEPTANCE COMPLETION OFFLINE NO-GO / VISIBLE HARNESS IMPLEMENTATION MAY START`**

The acceptance-completion candidate is byte-stable: all 48 entries in
`01-changed-file-hashes.json` match the current worktree, and its evidence manifest verifies. AC1 and
the offline fixed-denominator work are accepted as useful implementation evidence. The candidate is
not ready to spend the user's single visible-run budget because the submitted browser runner does not
execute B27, B29 or B30.

## Blocking findings

### VH1 - All three visible cases are an unconditional stub (Major)

`apps/chrome-extension/e2e/v3-wp-b-local-import-owned-session.mjs:261` defines `runCase()`, but the
function only throws `OwnedSessionError`. The existing offline test proves that three oracle labels
exist; it does not prove that any oracle has an executable implementation. An approved invocation
would generate both large assets, launch Chrome, and then fail immediately on B27.

The runner must implement the actual public user paths and explicit oracles for B27, B29 and B30.
No direct manager, controller, store, database, coordinator or materializer call may replace the Side
Panel file input and public Runtime routes.

### VH2 - The owned production environment is not established (Major)

The runner launches only Chrome. It does not start or own a local Runtime, wait for its health, create
the real companion session/bearer, configure the extension session, or prove that every local-import
request reaches that owned Runtime. Consequently its promised real `DELETE`, status, upload and
product paths cannot run deterministically.

The visible harness must own the Runtime PID, private data root, port and logs; refuse an occupied port;
wait for readiness; establish authentication through the production session path; and clean the full
process tree in `finally` without touching an existing Runtime.

### VH3 - Extension loading and CDP readiness are not reliable (Major)

The runner relies on `--load-extension` and connects to CDP immediately after `spawn()`. This repository
has already established that the installed Chrome 137+ environment ignores the command-line extension
load path. The proven local pattern waits for the CDP endpoint and invokes browser-level
`Extensions.loadUnpacked`, then verifies the extension and Side Panel target.

Use that established production harness pattern. A timeout must report a redacted diagnostic and exit
without retrying the visible run.

### VH4 - The stated acceptance oracles are not collected (Major)

There is no code for a real XHR abort, `DELETE`/status convergence, Side Panel file selection, progress,
product and thumbnail checks, RSS/heap measurement, keyboard/ARIA/scroll checks, identity containment,
or post-run residue. `buildSessionOraclePlan()` contains descriptive strings only.

Each case needs a callable executor and a structured receipt containing the exact frozen measurements.
Add an offline completeness test that fails when an oracle lacks an executor or an executor is still a
throw-only placeholder.

### VH5 - Evidence and temporary-frame cleanup are incomplete (Major)

The runner writes `owned-session.json` under `plan.evidenceDir` and then deletes that directory in the
same `finally`, so successful evidence cannot survive the run. Seed frame probes are written to global
`/tmp` names outside the owned root and are not protected by per-file `finally` cleanup.

Keep all transient media under the owned root. Export only a redacted receipt to a stable, explicitly
declared evidence destination after process/resource cleanup, or emit it to a parent collector that
performs the stable write. No absolute private path, filename, token, raw media or transcript text may
enter public evidence.

### VH6 - Model/dependency resolution is guessed instead of proven (Major)

The runner defaults SenseVoice to `<repo>/.navia/asr`, although the verified model is managed by the
product and may live on the Windows persistent volume. Resolve readiness/effective model and verified
tool paths through the product's existing Runtime/dependency mechanism or through explicit validated
environment input. Do not silently fall back to a guessed repository path.

## Gate sequence

1. Implement VH1-VH6 and offline tests without launching Chrome or generating large assets.
2. Run only targeted harness tests, typecheck and the necessary build/static checks; do not repeat the
   completed WP-B full regression.
3. Stop at `WP-B VISIBLE HARNESS IMPLEMENTED AWAITING CODEX DRY REVIEW` with B27/B29/B30 still pending.
4. Codex performs one source/dry-test review. If green, Codex asks the user once for the visible session.
5. Only that approved session may generate the registered assets and run B27/B29/B30.
6. After 30/30 and stable source, Codex performs the one relay v11 refreeze/checkpoint.

WP-B remains unpassed and WP-C remains locked. No visible/headless Chrome, large-asset generation,
external document audit, self-refreeze or contract change is authorized by this checkpoint.
