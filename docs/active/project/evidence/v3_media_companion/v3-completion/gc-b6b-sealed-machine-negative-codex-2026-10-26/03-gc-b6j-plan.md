# GC-B6J Offline Corrective Plan

## J1. One dependency-resolution authority

Add an internal candidate dependency object built before snapshot launch. Resolve product managed tools, ASR, vision Provider source database and extension build once. Bind their safe identities into the lock and pass explicit paths to the child environment. Do not copy secrets or mutable product databases into the snapshot.

## J2. Preflight and child parity

Make production preflight validate the exact dependency object that `candidateEnvironment()` gives the sequencer and source runners. Add a pre-launch child-environment check after snapshot materialization but before authorization. A missing, changed, inaccessible or mismatched dependency is an external-input block with all external counters zero.

## J3. Stable failure evidence

Preserve an allowlisted stable code for dependency/preflight failures in machine receipts and public evidence. Generic `Error`, exception messages, private paths and database names cannot be the final code or public detail.

## J4. Retention owner correctness

Make `collectArtifactDigests()` return a sorted unique digest set. Add exact and duplicate-content tests. The public retention validator remains strict and continues to reject caller-supplied duplicate digests.

## J5. Anti-false-green matrix

Required process-level cases:

- worktree dependency exists but snapshot child receives no explicit binding: reject before authorization;
- dependency disappears after preflight: reject before authorization;
- preflight receipt and child dependency identities differ: reject;
- explicit correct dependency object: child reaches the existing post-dependency boundary without Chrome in the offline fixture;
- secret/path values never enter public lock, receipt or evidence;
- stable code survives runner finalization and public projection;
- duplicate private file bytes produce one retention digest;
- direct sequencer/runner remains unable to bypass sealed preparation.

## Verification

Run focused Node tests, the complete Stage B offline suite once, `git diff --check`, candidate `--prepare-only`, privacy scan and cleanup audit. Production Python tests are required only if production Python changes. External action counters must remain zero.

