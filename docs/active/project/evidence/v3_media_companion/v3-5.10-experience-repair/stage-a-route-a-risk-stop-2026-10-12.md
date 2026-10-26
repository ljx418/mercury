# Stage A Route A risk stop

Date: 2026-10-12. Scope: V3-5.10 exact-source Runtime task arbitration.
Decision: **Stage A NO-GO; Stages B-D not started.** This is a current-state
handoff, not a final acceptance report. The independent read-only Agent review
was separate from the implementation session; it did not rerun Chrome.

## 2026-10-12 repair follow-up

The user approved Route A cancellation and restart cleanup hardening. This
document preserves the original stop finding; the two High findings below are
now closed for the reviewed Runtime paths, not for full Stage A acceptance.
The independent read-only reviewer found two intermediate Majors and one
follow-up Major, all repaired and re-reviewed. Its final judgment was a
**narrow PASS for cancellation/restart cleanup, no remaining High/Major in the
reviewed paths**. It did not independently execute the tests or Chrome.

- Cancellation now sets source authority to `cancelling` before waiting for
  in-flight visual work. Replacement is blocked until the per-task work lock,
  visual sandbox, and unpublished evidence are cleaned. Cleanup failure stays
  `cleanup_incomplete`, never retryable by ordinary resolution.
- Transcript projection reports cleanup failure as `failed`,
  `V3_MEDIA_CLEANUP_INCOMPLETE`, cleanup `pending`, and `canRetry=false` even
  when transcription previously succeeded. Explicit recovery checks that the
  old process is gone, verifies and removes artifacts/evidence, then releases
  authority. A live owner remains blocked.
- Restart cleanup scans durable owner manifests and checks the production
  sibling layout (`visual-products`, `product-evidence`, `product-exports`).
  Unverifiable directories/manifests fail closed. Cross-process liveness and
  legacy-policy provenance are surfaced distinctly; tab-bound async results
  are ignored after switching tabs.
- Runtime: 661 tests passed (one dependency deprecation warning); focused
  cleanup/concurrency tests: 66 passed. Frontend typecheck, production build,
  and 14 targeted Vitest tests passed. A real Chrome final-build run on
  `BV1hMpE6FEXG` used one resolution, seven authority reads, one execute,
  and one task ID across the embedded side panel, standalone panel, and
  second tab: `media_task_ea375366227f4078856ccfe72d77fc73`. The product
  was `degraded`, so this is identity/flow evidence, not a visual-quality pass.

**Remaining stop boundary:** full Stage A is still NO-GO. The browser run
pregranted site/Cookie permissions in an isolated extension, and did not
exercise first-use Chrome consent or browser-level cancellation/restart fault
injection. The failed-cleanup recovery test simulates owner death by changing
the stored PID; a separate two-process test proves live-owner rejection and
dead-owner recovery, but not a real process crash during cleanup. Six-video
quality review and human acceptance remain pending. Stages B-D have not begun.

## Verified progress

- Runtime reserves one exact `sourceIdentity` authority row transactionally.
  In-page Navia, standalone side panel and a second Bilibili tab restored the
  same task in one fresh headed Chrome run on `BV1hMpE6FEXG`.
- The latest run had one `/resolve` creation, the second surface read Runtime
  authority, one `/execute`, one product row, matching task IDs across all
  three surfaces and top status `视频内容已就绪`. The product was `degraded`, so this
  is task-identity evidence, not visual-quality acceptance. Test permissions
  were pregranted in a temporary extension; first-use Chrome consent remains
  unverified.
- Targeted Runtime suites: 76 passed. Frontend typecheck and build passed;
  three targeted Vitest files: 14 tests passed. A concurrent two-connection
  create/cancel test was added, and `MediaTaskStore.create()` now checks
  cancellation inside `BEGIN IMMEDIATE`.

## Blocking findings from independent read-only review

1. **High, cancellation barrier.** After transcript success, cancellation
   marks the SQLite source authority cancelled, but an in-flight visual
   materializer can continue frame/model work and write private evidence
   before the final commit rejects it. The unpublished product evidence has
   no demonstrated cleanup barrier. Required closure: cancel at every
   materialization boundary, prove no further dispatch, and prove private
   evidence cleanup or a fail-closed retained-artifact state.
2. **High, restart cleanup.** A new `TaskArtifactSandbox` has no mapping for
   the prior task. If startup skips an invalid/truncated owner manifest,
   `cleanup(task_id)` reports zero residuals for an unknown task. Recovery
   could then mark the source failed and admit a replacement while private
   artifacts remain. Required closure: durable ownership lookup and a
   positive zero-residual proof; unknown/invalid ownership must stay blocked.
3. **Medium, cross-process status.** A second live Runtime sharing SQLite
   displays another process's active task as `interrupted`; `/recover` itself
   checks PID liveness and rejects it, but the UI status is misleading.
4. **Medium, historical policy provenance.** Legacy published products have
   `unverified_legacy` consent provenance. The restore path displays them
   under a current grant without proving the historical consent revision.
5. **Medium, tab switch.** An asynchronous credential/acquisition result can
   update shared side-panel state after the active tab changes, briefly
   showing task A while tab B is selected.

The first two findings create false-green/privacy risk and trigger the user's
stop-and-confirm rule. No first-use permission proof, cross-process E2E,
visual-quality gate, six-video content review, or human acceptance is claimed.

## Recommended repair sequence, subject to user confirmation

1. Keep Route A and its exact-source key. Add cancellation checks before each
   external materialization dispatch and an atomic terminal barrier against
   publication. Track/clean per-task unpublished evidence; cleanup failure
   must not release the source for retry.
2. Persist a task-to-sandbox ownership reference that survives restart.
   Recovery must inspect that exact directory and reject unknown, damaged or
   unverifiable ownership. Test a truncated manifest and live/dead owner
   processes separately.
3. Make source authority reporting process-aware, bind side-panel asynchronous
   results to the current tab/source generation, and require an explicit
   legacy-policy UI disposition rather than silently treating provenance as
   verified.
4. Rerun unit concurrency/negative matrix, fresh headed Chrome race,
   cancellation/restart fault injection, first-use permission, then an
   independent exit review. Do not advance to Stage B before all Fatal/Major
   findings close.

## Files changed in this continuation

- `services/local-runtime/navia_runtime/modules/media_companion/task_store.py`
- `services/local-runtime/navia_runtime/modules/media_companion/acquisition/coordinator.py`
- `services/local-runtime/tests/test_v3_media_outline_task_store.py`
- `services/local-runtime/tests/test_v3_media_acquisition_core.py`
- `apps/chrome-extension/src/runtimeClient.ts`
- `apps/chrome-extension/entrypoints/sidepanel/main.tsx`
- `apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs`
- This risk stop and the updated implementation audit.

Contract change: Runtime source-authority response now reports adapter and
consent policy ID/revision for restore checks. It remains non-secret and
requires the existing bootstrap session. No earlier sealed audit artifact was
edited. Integration handoff: Stage A remains NO-GO; do not infer V3 completion,
PX-5/PX-6 closure, or RKM readiness from this run.
