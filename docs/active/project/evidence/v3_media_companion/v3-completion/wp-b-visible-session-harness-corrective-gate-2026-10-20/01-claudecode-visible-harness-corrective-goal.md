# ClaudeCode CLI Goal: WP-B visible-session harness corrective implementation

Work in `/mnt/c/workspace/navia`. Preserve the dirty worktree and historical evidence. This is one
bounded correction of the WP-B visible-session harness after Codex dry review. Do not launch Chrome,
generate the 100 MB/1 GB assets, repeat the full WP-B regression, refreeze relay v11 or enter WP-C.

## Read first

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`, section 5.1 C/F
3. `docs/active/project/fixtures/v3-media-local-import-acceptance-assets-v1.json`
4. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-preimplementation-2026-10-19/05-acceptance-plan.md`
5. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-visible-session-harness-corrective-gate-2026-10-20/00-codex-dry-review.md`
6. The submitted harness implementation evidence and source.

Gate: `WP-B VISIBLE HARNESS CORRECTIVE IMPLEMENTATION MAY START`.

## C1 - Make the production runner executable as one composition

- Remove the `registry` temporal-dead-zone use and add a test that executes the exported visible
  composition far enough to prove preflight, dependency resolution, asset planning, owned Runtime,
  Chrome loading, session establishment, case-adapter construction and all three case dispatches are
  connected in the real order.
- Do not test only isolated helpers. Export a composition function whose adapters can be injected, and
  have the CLI invoke that exact function.
- Resolve the extension id from the loaded unpacked extension, configure/start the companion with that
  exact id, establish the real production bearer, then build the Side Panel case adapter with the exact
  origin and bearer. If the architecture requires Runtime before Chrome, derive and prove the stable
  extension id from the built manifest/key; do not use an all-`a` fallback.
- Wire `launchOwnedChrome()` and `loadAndVerifyExtension()` or remove the dead abstraction and implement
  their behavior in one real owner. Align the process adapter contracts so Chrome launches the supplied
  executable and Runtime launches Python. Do not accidentally pass Chrome arguments to `python3`.
- Wire `resolveProductDependencies()` after owned Runtime health/session. Query the real authenticated
  dependency status route and verify ffmpeg/ffprobe hashes before validating the seed or generating an
  asset.
- Build `createCaseBrowserAdapter()` from the verified real context and pass it as `adapters.browser`.
- Map registry asset ids explicitly to B29/B30 and provide an explicit approved probe asset for B27.
- Assert the production composition has no unused critical owner functions. A helper's isolated unit
  test is not proof that the CLI calls it.

## C2 - Make cleanup unconditional and observable

- Put the entire visible path, starting immediately after owned-root creation, under one outer
  `try/finally`. Cleanup must run for failures in preflight, dependency resolution, seed validation,
  either asset encode, Runtime start, Chrome start, extension verification and each case.
- Register generated assets/directories automatically when `pathFor()` allocates them, or explicitly at
  every creation. Remove the whole owned root as the final owned cleanup step on both success and error.
- Kill and await the complete Runtime and Windows Chrome process trees. Use OS-appropriate ownership and
  PID/profile checks; never issue `taskkill` against a WSL PID or touch an unowned process.
- Assert post-cleanup ports are free and profile/assets/temp/runtime roots no longer exist. A cleanup
  exception must be recorded and must fail the session; do not convert failed cleanup to `true` residue.
- Reject a stable evidence destination equal to or below the owned root. Write exactly one redacted
  success or failure receipt after cleanup. Failures before `runVisibleSession()` must also produce it.
- Add injected failures at every pre-Chrome and post-Chrome stage and prove zero residue plus one stable
  diagnostic.

## C3 - Repair B27's production observation

- Fix the normal-tab guard in the Side Panel opener.
- Split upload observation into a live observation handle: wait until the real Extension XHR PUT starts,
  trigger the real frozen identity/session-generation change through the production UI lifecycle, then
  await that specific request's `Network.loadingFailed`/abort event. Do not snapshot `aborted` before the
  interruption.
- Do not mutate only `location.hash`, inspect a test-only global, or fabricate `before + 1`. Drive the
  actual source identity/generation transition and observe old/new production identities.
- Poll public status with strictly increasing sequence until the exact allowed cancellation terminal or
  bounded timeout. Record browser requests into the same owned-Runtime observation ledger and prove the
  DELETE/status calls reached the owned base URL with the production envelope.
- Check only forbidden local-import residue, not every unrelated extension storage key. Prove no stale
  import id, File metadata/name, token, terminal or product attaches to the new identity.

## C4 - Replace B29 false-green oracles

- Collect upload progress from the actual XHR progress events exposed by a passive E2E observation
  channel, not Resource Timing final entries. Require at least two samples, first < final, monotonicity,
  and final uploaded bytes equal asset length.
- Obtain writer-slice maximum, downloader dispatch, credential dispatch, cleanup count and source/
  sandbox residue from public diagnostic/receipt facts already authorized by the acceptance plan. Never
  hard-code `0` or `1`. If no public observable exists, stop and report the precise missing test seam;
  do not call an internal owner directly.
- Poll the public import record to the exact successful ready/product state. Resolve real task id,
  product/outline id and evidence id from public responses. Call the production task/evidence thumbnail
  route with those ids and require HTTP 200, `image/png` and non-empty bytes.
- Require a real PUT observed at the owned Runtime, exact byte completion, durable transcript and visual
  terminal receipts, product projections, cleanup exactly once, downloader/credential dispatch 0/0 and
  zero residue. `failed` or `cancelled` is not B29 success.

## C5 - Replace B30 resource and UX false-green oracles

- Measure Runtime process RSS from the owned Runtime PID/process tree and Extension JS heap from the
  verified Side Panel/CDP target. Sample throughout upload/preparation/materialization and calculate the
  peak delta from a valid pre-case baseline. Missing, zero-by-substitution, negative or process-reset
  measurements fail.
- Apply exact/one-over tests to Runtime RSS <= 268435456 and Extension heap <= 134217728 using the same
  production reducer.
- Prove streaming and progress as in C4, exact successful product terminal, cleanup and zero owned
  artifacts after session cleanup.
- Drive actual keyboard traversal/activation, focus order, disabled/busy transitions, ARIA live-region
  changes, scrolling and viewport/layout stability. For actionable controls require visible, enabled,
  center-point hit testing to the same element and no incoherent overlap. Node counts and document-height
  heuristics are insufficient.
- `failed` or `cancelled` is not B30 success.

## C6 - Validate each generated asset itself

- After generation, run ffprobe, SenseVoice and distinct-frame extraction on each generated 100 MB/1 GB
  asset. Do not copy transcript/frame counts from the seed.
- Record the output file SHA-256 separately from a canonical SHA-256 of the final ffprobe JSON/facts.
- Enforce each asset's byte window, allocated ratio, duration, video/audio streams, transcript segment
  minimum and distinct-frame minimum before Chrome starts.
- Keep all derived probes below the owned root and guarantee cleanup on every failure.

## C7 - Strengthen tests around the real graph

Retain useful helper tests, then add tests that would fail on every defect listed in the Codex review:

1. CLI composition has no TDZ and invokes each owner in real order;
2. Chrome and Python spawn contracts use the correct executables;
3. extension id, exact origin and bearer flow from load/config/session into browser requests;
4. dependency status is fetched and tool hashes are checked before seed/asset work;
5. registry asset ids reach B29/B30 and B27 receives its probe asset;
6. outer cleanup and one diagnostic work for failures at every stage;
7. B27 abort is observed after the real identity transition and status is polled;
8. empty/final-only progress, hard-coded diagnostics, wrong task/evidence ids and failed/cancelled
   terminals are rejected;
9. Runtime RSS is not Extension heap, peak sampling is required, and negative/unavailable deltas fail;
10. accessibility requires actions and hit testing, not node existence;
11. generated-asset transcript/frame/ffprobe facts come from that asset, not the seed.

Run one silent real owned-Runtime smoke test with a deterministic 32-character `[a-p]` extension id:
configure the private companion, start it, wait for health, issue a real companion session, call the
authenticated dependency status route, terminate it, and prove process/port/private-root residue zero.
This test must not launch Chrome or play audio.

## Validation budget

- During edits: targeted node tests only.
- Final corrective checkpoint: corrected harness suite, real owned-Runtime smoke, affected Extension
  tests, typecheck and one build/static check.
- Do not rerun the completed full Runtime/Extension WP-B regression unless product modules change.

## Constraints

- Chrome launches 0; visible/headless windows 0; audio playback 0; 100 MB/1 GB generation 0.
- Do not inspect Desktop, other repositories or arbitrary drives for media.
- Do not alter public API/schema, 18-code set, thresholds, B01-B30 denominator, T1-T4, Origin/auth order,
  asset registry, WP-A hashes or historical evidence.
- Do not refreeze, commit, push, reset, clean, checkout, revert or overwrite unrelated changes.
- Do not report B27/B29/B30, WP-B or V3 as passed and do not enter WP-C.

## Stop state

Create a new immutable corrective evidence directory with changed hashes, commands/exits, production
composition map, injected-failure cleanup matrix, real owned-Runtime smoke receipt, oracle map, redaction
scan, cleanup report, handoff and verified manifest.

Stop at `WP-B VISIBLE HARNESS CORRECTED AWAITING CODEX DRY REVIEW` only when C1-C7 pass and the visible
runner remains unexecuted. Otherwise stop at `WP-B VISIBLE HARNESS CORRECTIVE NO-GO` with the smallest
failing production-composition test and exact boundary.
