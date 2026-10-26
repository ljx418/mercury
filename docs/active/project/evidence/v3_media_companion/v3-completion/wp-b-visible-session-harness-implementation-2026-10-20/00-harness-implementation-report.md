# WP-B visible-session harness — implementation report

**State: `WP-B VISIBLE HARNESS IMPLEMENTED AWAITING CODEX DRY REVIEW`**

This is the narrow implementation pass over the WP-B owned visible-session
harness. It closes **VH1–VH6** and adds the eight offline adapter-test groups.
**No Chrome was launched, no headless Chrome was launched, no visible window
was opened, no audio was played and no large asset was generated.**

B27, B29 and B30 remain `PENDING_VISIBLE_RUN`. WP-B and WP-C remain unpassed.

---

## 1. VH1 — the throw-only stub is gone

The old `runCase()` that only threw is **deleted**, and with it the whole
`v3WpBLocalImportOwnedSession.mjs` stub library, which existed only to hold
it. The three frozen cases now have real, callable executors:

| case | executor id | required inputs | required receipt fields |
|---|---|---|---|
| B27 | `b27-identity-containment` | 5 | 6 |
| B29 | `b29-real-100mb-asset` | 6 | 14 |
| B30 | `b30-real-1gb-asset-ux-and-resources` | 6 | 15 |

`buildSessionPlan()` binds every frozen case to its executor, and
`assertSessionPlanIsComplete()` **fails** when a case has no executor, when the
executor is still a throw-only placeholder, when it never returns a receipt, or
when a required oracle field is missing. The offline meta-test proves each of
those three failure modes.

The executors are unreachable unless BOTH `NAVIA_WP_B_SESSION_PHASE=visible-run`
AND `NAVIA_WP_B_VISIBLE_APPROVED=1` are present. The runner refuses before it
touches anything:

```
$ NAVIA_WP_B_SESSION_PHASE=visible-run node e2e/v3-wp-b-local-import-owned-session.mjs
… A visible session needs NAVIA_WP_B_VISIBLE_APPROVED=1. Nothing was launched.
```

## 2. VH2 — the owned production environment

`runtime.mjs` owns the Runtime completely: its own PID, its own private data,
config, log and media roots, and its own port. It **refuses** an occupied port
rather than reusing, terminating or mutating an existing Runtime, waits for the
production health route with a bounded timeout, establishes the real companion
session through `POST /v1/companion/sessions`, and terminates the whole process
tree in the cleanup.

`assertRequestsReachedOwnedRuntime()` proves that every local-import request was
addressed to the owned Runtime, and the receipt carries the observed request
count.

## 3. VH3 — deterministic Chrome and extension startup

`chrome.mjs` follows the established production pattern:

* the CDP endpoint is **polled** before `connectOverCDP`, so there is no
  post-spawn connection race;
* the extension is loaded with the **browser-level** `Extensions.loadUnpacked`
  command, because Chrome 137+ ignores `--load-extension`;
* the extension id, the service worker and the real Side Panel target are
  **verified** before any case starts;
* a verification failure saves one redacted diagnostic and exits. It **never
  relaunches Chrome** — the visible run is a single opportunity;
* `--mute-audio` is always passed and the owned window is never focused until a
  trusted user action is unavoidable.

`resolveBuildFlavor()` **records** the build flavour decision and asserts that
the e2e bridge never calls a local-import owner.

## 4. VH4 — the three real user-path cases

None of the executors may call the client, the controller, the store, the
database, the coordinator or the materializer directly. They drive the Side
Panel and the public Runtime routes through the injected browser adapter, and
they reduce a receipt from what was observed.

* **B27** opens the real Side Panel card, selects a real file through the real
  hidden input, observes a real Extension `XMLHttpRequest`, triggers the frozen
  identity change through the public session lifecycle, and proves the real
  Runtime `DELETE` happened, the public status converged by an increasing
  sequence to an allowed terminal state, the old import did not attach to the
  new page identity, and no token, File, import id or stale terminal leaked
  into the storage or the UI.
* **B29** asserts the real monotonic progress, the writer slice bound, the
  public import states, the product projection and the readable thumbnail
  route, and records the size, the allocated ratio, the digests, the segment
  and frame counts, the ids, the terminal sequence, the cleanup count and the
  zero residue — never the raw transcript, a file name or a private path.
* **B30** adds the frozen resource bounds (Runtime RSS delta
  <= 268435456, Extension heap delta <= 134217728 — an **unavailable**
  measurement is a failure, not zero), the non-sparse and byte-window checks,
  the streaming and monotonic progress, and the keyboard, ARIA/live-region and
  scroll/viewport oracles against the **actual Side Panel DOM**: a control must
  be visible, enabled and hit-testable, and the layout must be stable.

## 5. VH5 — evidence and transient ownership

* Every probe, frame and temporary lives **under the owned root**; `pathFor()`
  refuses anything outside it, and a fixed name is never written to a global
  `/tmp`.
* Each creation is registered, and `cleanup()` runs even when the encode, the
  read or the hash fails.
* The public receipt is written to an explicitly declared **stable**
  destination **after** the owned processes and resources are gone, so it
  survives the owned root's deletion. The redaction rules refuse an absolute
  path, a Windows user path, a bearer, a cookie, an API key, raw media, frame
  bytes, transcript text and a Chrome command line with a private path.
* A failed visible run also leaves **one** redacted diagnostic.

## 6. VH6 — the dependencies are resolved, not guessed

* The SenseVoice binary, model and VAD come from the **product's** ASR root
  (`NAVIA_ASR_ROOT`) or from an explicit validated path. `<repo>/.navia/asr` is
  **not** a default, and the resolution fails with an `EXTERNAL-INPUT BLOCK`.
* ffmpeg and ffprobe come from the **product's own** environment configuration
  and are verified against the digests the **owned Runtime** reports through
  the product dependency status route.
* The free disk is checked against the frozen 4 GiB before any asset work.
* The CDP and Runtime ports are proven free.
* A missing seed, model, tool, disk, browser or port readiness stops the run
  **before** Chrome or any large-asset work.

## 7. The offline adapter tests

`e2e/lib/v3WpBVisibleSession.node-test.mjs` — **32 tests, all passing**. They
cover the eight required groups:

1. all three cases have real executors and complete required-oracle schemas;
2. Runtime ownership, occupied-port refusal, readiness timeout and process-tree
   cleanup;
3. CDP readiness polling, `Extensions.loadUnpacked`, extension/Side Panel
   verification and no relaunch;
4. B27 action ordering and receipt reduction from the recorded adapter events;
5. B29/B30 progress, the resource-boundary exact/one-over, the product and the
   accessibility receipt reduction;
6. the stable redacted evidence survives the owned-root cleanup, while secrets,
   private paths and raw content do not;
7. every probe and temporary path is below the owned root, and the cleanup runs
   on injected failures;
8. the default and the offline invocation launch zero Runtime and zero Chrome
   and generate zero large assets.

## 8. What was NOT done, on purpose

* No Chrome was launched, visible or headless.
* No 100 MB or 1 GB asset was generated.
* The real adapters in `realAdapters.mjs` are **written but unexecuted**. The
  offline tests drive recording doubles, never these.
* The Runtime was not started. The owned-Runtime lifecycle is proven with
  injected process, network and fetch adapters.
* The relay v11 inventory was not touched, and nothing was refrozen, committed,
  pushed, reset, cleaned, checked out or reverted.
