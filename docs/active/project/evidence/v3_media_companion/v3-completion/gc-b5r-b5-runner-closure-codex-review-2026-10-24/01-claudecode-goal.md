# ClaudeCode goal - GC-B5R B-5 aggregate integrity correction

Continue from the current dirty worktree. Preserve all unrelated work and all
historical evidence. Do not commit, push, reset, clean, checkout, revert, or
self-refreeze any contract or verifier.

## Authority and scope

Read first:

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`
3. `docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
4. `docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-runner-closure-codex-review-2026-10-24/00-codex-review.md`
5. the latest runner-closure evidence and handoff

This is one offline corrective batch. Fix only the two Codex findings below.
No Chrome, Runtime media task, Provider call, Cookie read/injection, download,
import, audio output, tabCapture, focus action, or real BVID run is authorized.

## CI1 - preserve every owned-process leak sighting

- Correct the `processAuditBefore` / `processAuditAfter` to source-row mapping.
- A descendant observed alive after its source runner exits is a leak even if
  it exits before the six-source batch finishes. Preserve that sighting in the
  candidate summary and make the aggregate/process exit nonzero.
- Stop the batch after the first owned leak and clean only owned descendants.
  Never count, signal, or terminate an unrelated process.
- Add a process-level negative case with a descendant that survives the source
  boundary but exits before final closeout. Assert the real sequencer exits
  nonzero and records the source that leaked.

## CI2 - require publication and exact action accounting

- Parse `receipt.json`; presence alone is not evidence.
- A `complete` source must have a nested `provider.published` record with the
  complete frozen V2.1 receipt identity and must cross-bind to the mirror,
  task, run, source, artifact hashes, locked Provider/endpoint, and hard-zero
  upload counters. Missing, partial, malformed, stale, or mismatched facts must
  make the real sequencer exit nonzero.
- Feed candidate ledger totals into the aggregate. They must equal the sum of
  the per-source `attempted.attemptCount` and
  `attempted.requestCount`. Define the permitted pre-synthesis `blocked` case
  explicitly: zero attempts may be valid only when that source never reached
  synthesis; an attempted synthesis with an unknown Provider HTTP count is not
  a positive candidate.
- Update all positive stubs to carry real contract-shaped publication facts.
  Do not weaken the oracle to preserve old stubs.
- Add process-exit negatives for: complete without publication, partial
  publication, malformed mirror, mirror mismatch, missing/zero ledger events,
  and duplicate ledger events.

Also fix the defensive typo in `mergeMachineReceipt()` so the second type
check tests `next`, and strengthen `isRealPublication()` to the full internal
publication shape used by the runner. This is part of CI2, not a new scope.

## Verification

Run in this order:

1. focused new Node tests;
2. the prior Codex three-file command;
3. `node scripts/stage_b_b5_3/test/run_offline_suite.mjs` once, fully concurrent;
4. targeted GC-B5R/comprehension Python tests only if production Python was
   touched;
5. relay v11 baseline and mutations only if a relay-scoped file was touched.

All tests must remain offline. Verify source hashes after the final edit and
generate the evidence manifest last.

## Handoff and stop

Create one corrective evidence package with changed files/hashes, exact
commands and exits, case-to-production-oracle mapping, negative process exits,
privacy scan, cleanup audit, PRD coverage, risks, and handoff. Report external
action counters explicitly as zero.

Stop at:

`GC-B5R B-5 AGGREGATE INTEGRITY CORRECTION AWAITING CODEX CHECKPOINT`

Do not run the visible six-video batch, do not announce B-5/Stage B/V3 PASS,
and do not enter B-6.
