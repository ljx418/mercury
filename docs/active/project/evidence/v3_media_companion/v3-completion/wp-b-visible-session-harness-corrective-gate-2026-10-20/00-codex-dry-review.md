# WP-B visible-session harness dry review

**Decision: `WP-B VISIBLE HARNESS DRY REVIEW NO-GO / CORRECTIVE IMPLEMENTATION MAY START`**

The evidence manifest verifies, all 16 changed-file hashes match the current worktree, and the submitted
offline suite passes `32/32`. Those tests validate isolated helpers and recording doubles. They do not
drive the production runner with the real adapter graph. Source review found two Fatal and five Major
groups, so the user's one visible-run budget must not be spent on this candidate.

## Fatal findings

### F-VH-01 - The production runner cannot reach the first case

The visible branch in `e2e/v3-wp-b-local-import-owned-session.mjs` is structurally non-executable:

- `registry` is passed to `runPreflight()` before its `const registry` declaration, causing a temporal
  dead-zone `ReferenceError`.
- `resolveProductDependencies()` is imported but never called. `preflight.senseVoice` is therefore
  undefined when seed validation starts, and Runtime-reported ffmpeg/ffprobe digests are never checked.
- `runVisibleSession()` calls `adapters.chrome.launch()`, but `createChromeAdapter()` exposes only
  `connectOverCDP()` and `close()`.
- `adapters.browser` is never constructed, although every case requires it. `createCaseBrowserAdapter()`
  is imported but never called.
- `launchOwnedChrome()`, `loadAndVerifyExtension()` and `establishCompanionSession()` exist as isolated
  helpers but are not connected to the production runner.
- the Runtime is planned with no extension id and therefore receives no companion configuration. The
  fallback all-`a` origin does not repair that configuration or establish a bearer.
- generated assets are keyed by registry ids (`wp-b-real-100mb`, `wp-b-real-1gb`), while
  `runVisibleSession()` looks them up by `B29`/`B30`. B27's `probeMediaPath` is also never populated.
- the Chrome helper and process adapter have incompatible spawn contracts: `launchOwnedChrome()` calls
  `process.spawn(executable, args, options)`, while the real process adapter's `spawn(args, options)`
  always launches `python3`; its separate `spawnBrowser()` method is unused.

No offline test invokes this composition. Passing helper tests cannot authorize the visible session.

### F-VH-02 - Failure cleanup can retain generated assets and processes

`runVisible()` creates its owned root and may validate/generate both assets before entering
`runVisibleSession()`, but it has no outer `try/finally`. Its `fs.rmSync(ownedRoot)` runs only after a
successful return. A preflight, encode, Runtime, Chrome or case failure can therefore retain the owned
root and large assets.

`pathFor()` does not register paths automatically, and generated assets/directories are not registered.
The inner temp cleanup therefore does not prove their deletion. Failures before `runVisibleSession()`
also produce no stable redacted diagnostic. The stable evidence resolver claims the destination is
outside the owned root but never checks that condition.

## Major findings

### M-VH-01 - B27 cannot prove a real abort or identity change

- `observeUploadStart()` snapshots `aborted` before `triggerIdentityChange()` executes; the returned
  boolean cannot observe the later abort.
- the Side Panel opener rejects every normal tab with a truthy `windowId` because its guard is inverted.
- changing `location.hash` is not proof of the frozen source/session generation transition. When the
  production generation is absent, the adapter fabricates `after = before + 1`.
- status is read once rather than polled by strictly increasing sequence to a terminal state.
- the DELETE count is read from `runtime.requests`, but browser-side requests are never recorded there.
- requiring all extension local-storage keys to be zero confuses unrelated product state with forbidden
  local-import residue.

### M-VH-02 - B29 uses false-green upload, cleanup and residue oracles

The real adapter derives progress from final Resource Timing entries, hard-codes
`writerSliceMaxBytes: 0`, hard-codes `cleanupCount: 1`, and hard-codes source/sandbox residue to zero.
An empty progress sample array passes `every()`. The executor does not require a PUT count greater than
zero, exact byte completion, a successful import state, one cleanup, zero downloader/credential
dispatch, or the required transcript/frame/product facts.

The product and thumbnail routes also use `importId` where production routes require task/evidence ids;
`readThumbnailRoute()` is called without an evidence id. A non-empty arbitrary response can be counted
as a readable thumbnail without checking HTTP success or `image/png`.

### M-VH-03 - B30 resource and UX measurements are not the frozen measurements

`readMetrics()` returns Extension heap usage as both Runtime RSS and Extension heap. Two before/after
snapshots do not measure peak delta, and a negative delta passes because only equality to zero and the
upper bound are checked. The accessibility adapter does not perform keyboard actions, focus-order
checks, center-point hit testing, live-region transitions, scrolling or layout-stability measurement;
it only counts nodes and compares total document height to four viewports.

B30 inherits the same hard-coded progress/cleanup/residue problems as B29 and does not prove owned
artifacts are zero after session cleanup.

### M-VH-04 - Failed/cancelled imports can be reported as successful B29/B30 products

B29 and B30 accept `ready`, `cancelled` and `failed` as equivalent terminals. Their acceptance purpose is
the real successful product path. They must require the exact success terminal and durable transcript,
visual/product and cleanup receipts. A failed/cancelled import cannot satisfy B29/B30 merely because a
stale or unrelated projection exists.

### M-VH-05 - Generated-asset facts are copied from the seed

After generation, the harness measures file size and a file digest but copies `nonEmptySegments` and
`distinctFrameCount` from the short seed onto both generated assets. It never transcribes or samples the
actual 100 MB/1 GB outputs. `ffprobeSha256` is also set to the media file SHA rather than a canonical
digest of the final ffprobe facts. This does not satisfy the registry requirement to validate each
generated asset.

## Accepted portions

- Approval flags and offline default prevent accidental Chrome launch.
- The frozen boundaries, asset argv, helper-level CDP polling and `Extensions.loadUnpacked` intent are
  represented.
- Evidence manifests and changed-file hashes are internally consistent.
- No Chrome, Runtime, audio or large asset was used during this Codex review.

## Corrective gate

1. Repair the production composition and add one offline composition test that invokes the same exported
   visible runner with real adapter constructors plus injected process/CDP/HTTP primitives. It must fail
   if any production helper is merely imported but not wired.
2. Repair failure cleanup before any real asset generation or Chrome run.
3. Replace every hard-coded/derived oracle with a production-observed value and add negative tests that
   would catch the current false greens.
4. Run a real owned-Runtime-only smoke test using a deterministic test extension id: configure the
   companion, wait for health, create a production session, query dependency status, then terminate and
   prove zero residue. This is silent and does not consume the visible Chrome budget.
5. Stop at `WP-B VISIBLE HARNESS CORRECTED AWAITING CODEX DRY REVIEW`. B27/B29/B30 remain pending.

No Chrome launch, large-asset generation, relay refreeze, contract change, WP-B PASS or WP-C work is
authorized by this gate.
