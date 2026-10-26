# GC-B5R B-5 Offline Corrective: Codex Review Findings

Date: 2026-10-24

Decision: **REJECTED - FINAL OFFLINE CORRECTION MAY START**

The reported offline suites pass, but they do not exercise the real six-source
composition. The candidate must not consume another visible authorization.

## Major findings

### M1 - authorization is consumed by every source child

`run_one_bvid.mjs:622-638` consumes `NAVIA_B5_AUTHORIZATION_ID`. The sequencer
spawns six children with the same environment (`sequencer.mjs:108-122`). The
first child consumes the identifier and the second child must fail before
Chrome. The tests cover one runner, not one sequencer plus six children.

The consume operation is also a read-then-append race
(`action_ledger.mjs:167-196`). Two concurrent sequencers can both pass, and a
malformed authorization line is ignored rather than failing closed.

### M2 - the claimed hard Provider request bound is not hard

The budget is checked before `_complete()`, while `_complete()` may call
`_complete_once()` three times (`synthesis.py:858-879`). `_complete_once()`
appends and sends without checking the cap (`synthesis.py:881-915`). A call
starting with seven recorded requests can issue requests 8, 9, and 10.

The repaired-candidate route validates shape but not the temporal contract
(`synthesis.py:371-439`), so a temporally invalid repair is returned to the
independent validator without the bounded temporal regeneration claimed by C4.

### M3 - adapter exact-shape enforcement is incomplete

`diagnostics.py:132-170` does not reject a missing brief field, validates only
the first claim's key set, does not reject malformed later claims, and accepts
`unresolvedEvidenceConflict: null`. This contradicts the claim that the
adapter enforces the exact frozen nested shape before the independent
validator.

### M4 - attempted Provider facts and failure codes are not preserved

The finalizer derives both `attempted` and `published` from the successful
publication receipt (`run_one_bvid.mjs:210-243`). A rejected Provider request
therefore records `attempted: null`. `providerCall` is recorded only after
success (`run_one_bvid.mjs:1224-1231`), so failed calls are missing from the
stage ledger. The catch path replaces the structured frozen failure code with
JavaScript's generic error name (`run_one_bvid.mjs:1235-1250`).

### M5 - stage totals and historical reconciliation are not production gates

`readStageTotals()` and `reconcileRetainedLogs()` are used only by tests. The
sequencer does not publish or enforce candidate totals, stage-lifetime totals,
or the retained-log lower bound. Malformed ledger lines are deliberately
skipped (`action_ledger.mjs:78-125`), allowing an incomplete count to support a
positive verdict.

### M6 - evidence contains private paths and can copy secret bytes

The finalizer writes absolute runtime/database/profile paths
(`run_one_bvid.mjs:290-333`) and stores the first 12 matched secret characters
(`run_one_bvid.mjs:373`). The submitted
`11-stage-action-reconciliation.json` contains absolute repository paths. The
scan did not detect them because it only checks selected user-directory
patterns. This invalidates the privacy-scan result.

## Additional correctness gaps

- Ledger `detail` accepts an arbitrary object without a field schema or
  sanitizer (`action_ledger.mjs:56-74`).
- The finalizer claims monotonic idempotent merge but does not read and merge
  existing durable facts before rewriting files.
- Stage diagnostics are recorded immediately with `finalOutcome=fail_closed`
  even when a later regeneration succeeds (`synthesis.py:480-487`).

## Review boundary

No Chrome, Runtime media task, Provider call, download, Cookie read/injection,
audio output, or real BVID run was performed by this review.
