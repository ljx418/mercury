# ClaudeCode Goal: GC-B5R B-5 Final Offline Correction

Implement one strictly offline corrective batch. Preserve the dirty worktree
and all historical evidence. Do not commit, push, reset, clean, checkout, or
revert unrelated work. Do not self-refreeze relay or alter public contracts.

## Mandatory corrections

### FC1 - batch-owned, atomic one-shot authorization

Move authorization ownership to `sequencer.mjs`. Consume one authorization
exactly once for the complete six-source candidate before any external action.
Create a durable child grant bound to the authorization digest, run id,
registry digest, and exact ordered six identities. Children verify that grant;
they must not consume the original identifier independently. A directly
invoked visible `run_one_bvid.mjs` without a valid parent grant must fail before
Cookie read or Chrome.

Consumption must be atomic across processes, for example an `O_EXCL` marker or
equivalent lock keyed by a one-way authorization digest. Never persist the raw
authorization value. Corrupt authorization state must fail closed.

Production-composition tests must prove:

1. one sequencer authorization permits all six expected children;
2. a second sequencer with the same authorization is refused before Chrome;
3. two concurrent sequencers produce exactly one winner;
4. malformed authorization/grant state refuses execution;
5. substituted, reordered, stale, or cross-run child grants are refused;
6. all refusal branches have zero Cookie reads and zero external actions.

### FC2 - strict production action ledger and totals

Give every ledger event and optional detail an exact schema; arbitrary objects
must be rejected. Validate schema version, non-negative integer count, run id,
timestamp, and allowed detail enums. Any malformed/truncated/unknown ledger
line sets `integrityOk=false` and prevents a positive aggregate verdict.

Integrate the ledger into the real sequencer output. The final summary and
audit evidence must separately report:

- this candidate's totals;
- the durable stage-root lifetime totals;
- the retained-log historical lower bound (currently Chrome launches >=34);
- a clearly labelled combined lower bound without double-counting or guessed
  values.

Use only safe relative log labels or hashes, never absolute paths. Record an
attempt at the actual action boundary, including failed Provider HTTP attempts;
do not record Provider calls only after publication.

### FC3 - truthful failure evidence and monotonic finalization

Capture selected, attempted, and published Provider facts independently.
Provider rejection must retain a safe attempted request count/Provider id/
endpoint class while `published` remains null. Preserve an allowlisted frozen
`V3510B_*`/`V352_*` code from the structured Runtime response; never store an
arbitrary response body or replace it with generic `Error`.

Make finalization a true durable monotonic merge: reread existing evidence and
apply explicit precedence so a known non-null fact cannot become null after
retry/restart. Add fresh-process/re-entry tests, not only same-process tests.

Evidence must contain no absolute runtime/database/profile/repository paths.
Store safe owned references or hashes. Secret scans may store classification,
count, and hashed file reference only; they must never store any matched secret
characters. Add a generic POSIX/Windows absolute-path detector with narrowly
documented non-private allowlists.

Drive a structured Runtime failure response through the runner and prove the
nine-file audit set contains the exact safe failure code, attempted Provider
facts, null publication, accurate ledger count, no secret sample, and no path.
The test-only fault seam that skips external work is not sufficient for this
oracle.

### FC4 - exact candidate shape and temporal enforcement

Enforce exact key sets for every nested brief, every claim, every chapter, and
the top-level object. Require the conflict flag to be a real boolean. Add
negative tests for missing brief fields, extra/missing fields on a non-first
claim, non-object claims, and null/missing conflict flag.

Apply the same temporal validation and bounded same-Provider regeneration to
`repair_v2()` as to the initial route. Prefer one shared candidate-enforcement
function so initial and repair behavior cannot drift. A recovered diagnostic
must record a resolved outcome; only terminal refusal may say fail-closed.

### FC5 - a real global Provider request cap

Enforce `_STAGE_B_MAX_REQUESTS` immediately before every outbound HTTP attempt
inside the lowest common send path. Retries after timeout, malformed JSON, or
invalid response count against the same cap. Initial extraction, candidate
generation, shape repair, temporal repair, and service-level `repair_v2()` on
the same adapter instance must share the one cap.

Tests must start at cap-1 and inject timeout/malformed JSON, proving the client
is called at most once more and total recorded attempts never exceed 8. Add an
initial-plus-repair composition test. Exceeding the cap must preserve the
frozen failure code and publish nothing.

## Required verification

Run targeted tests while iterating, then one consolidated offline checkpoint:

1. the updated six-child sequencer composition and race/corruption tests;
2. ledger/finalizer/privacy negative tests;
3. comprehension shape, temporal, request-cap, receipt, and diagnostic tests;
4. `node scripts/stage_b_b5_3/test/run_offline_suite.mjs`;
5. GC-B5R/comprehension targeted Python tests;
6. full Runtime tests once, split deterministically only if OOM;
7. relay v11 baseline and mutations if no relay scope changed;
8. manifest, secret/path/raw-media scan, and owned-resource cleanup audit.

All tests in this batch must use temporary roots and synthetic values. External
action counts must remain zero: Chrome, visible windows, real media Runtime,
Provider, downloads, imports, media tasks, Cookie read/injection, audio,
tabCapture, focus events, and real BVID executions.

## Handoff

Create a new evidence directory; do not edit prior evidence. Include changed
files and hashes, contract statement, case-to-production-oracle map, exact
commands/exits, action-ledger integrity receipt, privacy scan, cleanup report,
risks, and payload manifest generated last.

Report all findings honestly. Do not call a canary pass when it was not run.
Do not announce GC-B5R/WP/V3 pass and do not enter the next workpack.

Exact stop state:

`GC-B5R B-5 FINAL OFFLINE CORRECTION AWAITING CODEX CHECKPOINT`
