# ClaudeCode CLI Goal: WP-B visible-session harness implementation, offline only

Work in `/mnt/c/workspace/navia`. Preserve the dirty worktree and all historical evidence. This is a
narrow implementation pass over the WP-B owned visible-session harness. Do not restart WP-B planning,
repeat the completed full regression, or run an external document audit.

## Read first

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`, especially section 5.1 C/F
3. `docs/active/project/fixtures/v3-media-local-import-acceptance-assets-v1.json`
4. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-preimplementation-2026-10-19/05-acceptance-plan.md`
5. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-visible-session-harness-implementation-gate-2026-10-20/00-codex-checkpoint.md`
6. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-acceptance-completion-offline-2026-10-20/`
7. The established owned Chrome/Runtime patterns in
   `apps/chrome-extension/e2e/chrome-v2-t01-r1-frontend.mjs`; reuse the pattern, not its unrelated test
   behavior.

Gate: `WP-B VISIBLE HARNESS IMPLEMENTATION MAY START`. This gate authorizes harness code and offline
tests only. WP-B/WP-C remain unpassed. The user's one visible-run budget has not been spent.

## VH1 - Replace the visible-case stub with executable case owners

- Remove the unconditional throw-only `runCase()` implementation.
- Give B27, B29 and B30 explicit callable executors. `buildSessionOraclePlan()` must bind each case to
  an executor or stable executor id, required inputs and required receipt fields.
- Add an offline meta-test that fails if any frozen visible case lacks an executor, contains a
  throw-only placeholder, or omits a required oracle.
- Keep the actual executors unreachable unless both
  `NAVIA_WP_B_SESSION_PHASE=visible-run` and `NAVIA_WP_B_VISIBLE_APPROVED=1` are present.
- No visible or headless Chrome may be launched in this implementation phase.

## VH2 - Own the complete production session

- Start an owned local Runtime with its own PID, private data/config roots, logs and port. Refuse to
  reuse, terminate or mutate an existing Runtime. Poll the production health route with a bounded
  timeout.
- Establish the real companion session/bearer through the production session path and configure the
  extension using the existing supported mechanism. Do not hard-code, persist or print a bearer.
- Prove every local-import upload, `DELETE`, status and product request is addressed to this owned
  Runtime and carries the production Origin/auth envelope.
- Track the Runtime and Chrome process trees, ports, profile, generated assets, upload/preparation
  sandboxes and logs. Cleanup them in `finally`, and assert zero owned residue. Never touch the user's
  Chrome, profile, Runtime, game or other processes.

## VH3 - Make Chrome/extension startup deterministic

- Always pass `--mute-audio`. Keep the future visible run to one owned window and avoid focus changes
  until an actual trusted user action is unavoidable.
- Wait for the CDP endpoint before `connectOverCDP`; no immediate post-spawn connection race.
- Do not rely on `--load-extension`. Use browser-level CDP `Extensions.loadUnpacked` as in the proven
  T01 harness, with the correct Windows path conversion when Chrome is a Windows executable.
- Verify the loaded extension id, service worker, real Side Panel target and expected build before any
  case starts. A failure saves one redacted diagnostic and exits; it must not relaunch Chrome.
- Use the build flavor required by the frozen B27/B29/B30 acceptance path. If `build:e2e` is necessary
  for target discovery, prove that the exercised local-import UI/client and Runtime requests are the
  same production modules and that no bridge directly calls an internal owner. Record the decision.

## VH4 - Implement the three real user-path cases

### B27 - real abort and identity containment

- Reach the mounted local-import card in the real Side Panel and select a real file through the hidden
  file input using Playwright/CDP file chooser facilities.
- Observe a real Extension `XMLHttpRequest` upload. Trigger the frozen interruption/identity-change
  condition through the public UI/session lifecycle, then prove the real XHR aborted.
- Prove the real Runtime `DELETE` occurred, public status converged by increasing sequence to the
  allowed terminal state, old import/product state did not attach to the new page identity, and no
  token, File object, local-import id or stale terminal leaked into extension storage/UI.
- Do not call `LocalMediaImportClient`, controller, store, database, coordinator or materializer
  directly from the runner.

### B29 - registered 100 MB asset

- Generate the `wp-b-real-100mb` asset only in the later approved run, using the frozen registry
  generator and authorized seed. Feed it through the real Side Panel file input.
- Assert real monotonic upload progress, writer slices <= 1 MiB, public import states, transcript and
  visual terminal receipts, real product workspace content and readable thumbnail route.
- Record size, allocated ratio, digest, ffprobe digest, non-empty segment count, distinct frame count,
  import/task/product ids, terminal sequences, cleanup count and zero source/sandbox residue. Do not
  record raw transcript or private paths.

### B30 - registered 1 GB asset and UX/resource gates

- Generate and select the `wp-b-real-1gb` asset only in the approved run.
- Measure Runtime peak RSS delta <= 268435456 bytes and Extension JS heap delta <= 134217728 bytes
  around the frozen baseline/terminal points. A process disappearance or unavailable measurement is a
  failure, not zero.
- Assert the 1 GB asset remains non-sparse and inside 1020054732..1127428915 bytes, upload remains
  streaming, progress is monotonic, product reaches the required terminal, and all owned artifacts are
  zero after cleanup.
- Drive the frozen keyboard, focus, ARIA/live-region, error/recovery and scroll/viewport oracles against
  the actual Side Panel DOM. Node existence or `textContent` alone is insufficient: assert visible,
  enabled, unobscured/hit-testable controls and stable layout.

Use the authoritative acceptance plan for the exact B27/B29/B30 oracle wording. Do not lower, merge or
reinterpret any denominator or threshold.

## VH5 - Fix evidence and transient ownership

- Put seed frame probes and every generated/transcoded temporary under the owned root. Protect each
  creation with cleanup that also runs when ffmpeg/read/hash fails; do not write fixed names to global
  `/tmp`.
- The final redacted receipt must survive deletion of the owned root. Write it only after owned
  processes/resources have been cleaned, either through a parent collector or an explicitly provided
  stable evidence destination under the new run evidence directory.
- The public receipt may contain fixed case ids, product ids, counters, enums and SHA-256 values. It may
  not contain absolute paths, filenames, bearer/cookie/API keys, raw media, frame bytes, transcript text,
  Chrome command lines containing private paths, or unredacted logs.
- A failed visible run must also leave one redacted diagnostic receipt and zero owned residue.

## VH6 - Resolve dependencies through verified product state

- Remove the guessed `<repo>/.navia/asr` default. Resolve the effective verified SenseVoice binary,
  model and VAD from the existing product Runtime/dependency snapshot, or require explicit paths and
  verify them against the frozen hashes before use.
- Validate the WP-A ffmpeg/ffprobe dependency snapshot and required free disk >= 4294967296 bytes before
  asset generation. Verify the selected CDP and Runtime ports are free.
- Missing seed, model, tool, disk, browser or port readiness must stop before Chrome/large-asset work
  with a precise `EXTERNAL-INPUT BLOCK` or environment failure.

## Offline validation for this pass

Add deterministic tests around injected process/CDP/Runtime/browser adapters. They must prove, without
launching Chrome or producing large assets:

1. all three cases have real executors and complete required-oracle schemas;
2. Runtime ownership, occupied-port refusal, readiness timeout and process-tree cleanup;
3. CDP readiness polling, `Extensions.loadUnpacked`, extension/Side Panel verification and no relaunch;
4. B27 action ordering and receipt reduction from recorded adapter events;
5. B29/B30 progress, resource-boundary exact/one-over, product and accessibility receipt reduction;
6. stable redacted evidence survives owned-root cleanup while secrets/private paths/raw content do not;
7. every probe/temp path is below the owned root and cleanup runs on injected failures;
8. offline/default invocation launches zero Runtime/Chrome and generates zero large assets.

Run targeted node tests, the affected Extension tests, `npm run typecheck`, and one build/static check.
Do not rerun the completed Runtime/Extension full WP-B regression unless a product module is changed;
this pass should normally modify only e2e harness/test assets.

## Constraints

- Chrome launches: 0. Visible windows: 0. Headless Chrome: 0. Audio playback: 0. Large assets: 0.
- Do not read Desktop, other repositories or arbitrary drives. The only later media source is explicit
  `NAVIA_WP_B_SEED_MEDIA`.
- Do not modify public APIs, schemas, 18-code set, thresholds, B01-B30 denominator, T1-T4, Origin/auth
  order, asset registry, WP-A hashes or historical evidence.
- Do not refreeze relay v11, commit, push, reset, clean, checkout, revert or overwrite unrelated changes.
- Do not announce B27/B29/B30 or WP-B/V3 PASS and do not enter WP-C.

## Deliverable and stop state

Create a new immutable evidence directory with a receipt, changed-file hashes, commands/exits, executable
case-to-oracle map, offline adapter-test results, dependency preflight specification, redaction scan,
cleanup proof, handoff and verified manifest.

Stop at `WP-B VISIBLE HARNESS IMPLEMENTED AWAITING CODEX DRY REVIEW` only when VH1-VH6 and all offline
tests pass. Report the exact future one-session command, expected duration/storage, seed requirements,
owned Runtime/Chrome topology, stable evidence destination and cleanup order. Keep B27/B29/B30 marked
`PENDING_VISIBLE_RUN`.

If any item cannot be implemented without product-contract change or a real browser launch, stop at
`WP-B VISIBLE HARNESS IMPLEMENTATION NO-GO` with one minimal failing dry test and the exact boundary.
