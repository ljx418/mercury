# ClaudeCode Goal: GC-B5R B-5 Runner Closure Correction

Work in `/mnt/c/workspace/navia`. Implement one strictly offline closure
batch. Preserve the dirty worktree and every historical evidence directory.
Do not commit, push, reset, clean, checkout, revert, refreeze relay, change a
public contract, or start any external action.

## RC1 - make child grants authoritative and one-use

`verifyChildGrant()` must prove all of the following before Cookie read or
Chrome:

1. the consumed authorization marker exists, parses exactly, and matches the
   grant authorization digest and run id;
2. the digest supplied by the sequencer matches the grant and marker;
3. `grantId` equals a recomputation from the trusted grant fields;
4. the registry digest and exact ordered six identities match;
5. the per-source grant is atomically consumed once, so replay is refused.

Do not treat a self-computed unkeyed grant digest as authority. Keep the raw
authorization value out of disk and evidence. A crash or corrupt marker/grant
must fail closed before external action.

Add production tests for an entirely forged self-signed grant, arbitrary grant
filename, absent/mismatched marker, mismatched authorization digest, and a
second use of a valid child grant. Each must fail with zero Cookie reads,
Chrome launches, Runtime starts, and ledger external actions. Retain the real
six-child composition and concurrent-sequencer race tests.

Remove the superseded authorization implementation and tests from
`action_ledger.mjs`; there must be one authorization owner/API.

## RC2 - replace generic finalizer merging with field semantics

The durable audit record needs explicit state semantics, not “never replace a
non-null primitive.” At minimum:

- cleanup booleans must converge `false -> true` after verified deletion;
- cleanup failure may not be erased;
- a published receipt may replace an earlier null but may never be fabricated;
- terminal failure code and disposition must follow an explicit precedence;
- timestamps and attempt counts must reflect the final run state;
- retry/restart must not combine evidence from a different run/source.

Prefer an explicit interim/final phase or a typed merge per field. Drive a
runner through pre-cleanup finalization and successful finally cleanup, then
assert the final machine receipt and `cleanup.json` both report true and that
the aggregate accepts the cleanup. Add failure and fresh-process re-entry
cases. The test must fail against the current false-preserving merge.

## RC3 - count actual outbound Provider HTTP actions

Separate these facts:

- one Runtime synthesize endpoint invocation;
- actual Provider outbound HTTP attempts;
- successful publication and receipt request count.

The stage `providerCall` total must equal actual outbound Provider HTTP
attempts, including timeout/retry/regeneration and terminal rejection, not
always one per synthesize endpoint. Use an internal owned-runtime diagnostic or
receipt owned by the production adapter; do not add a public endpoint or expose
response text, prompts, evidence ids, paths, or secrets. Reconcile deltas
without double counting after retry/re-entry.

Tests must prove successful 1/N-request cases and rejected 3/8-request cases,
and assert candidate/stage totals exactly. Publication remains null on failure.

## RC4 - scope process ownership and isolate generated fixtures

Audit only the process tree/PIDs owned by the current sequencer. An unrelated
`run_one_bvid.mjs` from another test/run must neither be killed nor counted as
this run's leak. Add a negative test with an unrelated live runner and prove
the current candidate's audit remains correct.

Generate patched sequencer copies under a unique owned temporary directory,
not `test/_fixtures` in the repository. Delete them in `finally`. Remove the
persisted `sequencer_alt.mjs` and `sequencer_grant_alt.mjs`. Run the relevant
Node files concurrently and require deterministic success; do not hide the
problem by serializing unrelated ownership tests.

## RC5 - close the privacy and inventory boundary

Extend path detection/redaction to cover at least:

- POSIX paths including one-segment paths such as `/tmp`;
- Windows backslash and forward-slash drive paths;
- UNC paths.

Keep URL and public Runtime/Provider routes out of false positives with a
narrow structured allowlist. Scan every changed/new source file and every
evidence file. Build changed-file hashes from the actual final source set; no
generated source-tree artifact may be omitted. Manifest is generated last.

## Required verification

Use temporary roots and synthetic inputs only. Run targeted tests while
iterating, then one consolidated checkpoint:

1. forged/replayed grant and six-child authorization composition;
2. finalizer cleanup convergence and fresh-process re-entry;
3. exact outbound Provider request accounting;
4. concurrent ownership tests, including the previously failing combined
   command from the Codex review;
5. generic POSIX/Windows/UNC privacy negatives;
6. `node scripts/stage_b_b5_3/test/run_offline_suite.mjs`;
7. targeted GC-B5R/comprehension Python tests and full Runtime once;
8. relay v11 baseline/mutations if its scope remains unchanged;
9. changed-file inventory, secret/path/raw-media scan, cleanup audit, and
   payload manifest verification.

The previously failing Codex command is:

```text
node --test \
  scripts/stage_b_b5_3/test/authorization_composition.node-test.mjs \
  scripts/stage_b_b5_3/test/structured_failure_evidence.node-test.mjs \
  scripts/stage_b_b5_3/test/privacy_scan.node-test.mjs
```

External action counts must remain zero: Chrome, visible windows, real media
Runtime, Provider, downloads, imports, media tasks, Cookie read/injection,
audio, tabCapture, focus, and real BVID execution.

## Handoff and stop

Create a new evidence directory; never edit prior evidence. Include exact
changed files/hashes, contract statement, case-to-production-oracle map,
commands/exits, negative receipts, action counts, privacy scan, cleanup, risks,
and a manifest generated last. Report any remaining defect honestly.

Do not announce GC-B5R, B-5, WP, or V3 PASS and do not enter B-6.

Exact stop state:

`GC-B5R B-5 RUNNER CLOSURE CORRECTION AWAITING CODEX CHECKPOINT`
