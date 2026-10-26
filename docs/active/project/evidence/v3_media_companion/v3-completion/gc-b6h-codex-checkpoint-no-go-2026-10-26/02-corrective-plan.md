# GC-B6H-R Corrective Plan

## R1 - Make the sealed snapshot mandatory and executable

- Add one candidate preparation entrypoint that builds the closure, rejects all
  unresolved inputs, materializes an exclusive repository-external snapshot,
  verifies it, and then launches sequencer from that snapshot.
- Runtime cwd/PYTHONPATH, extension fixture/build, harness child script, registry,
  protocol, contracts, and configuration must all resolve from the snapshot.
- A B6 capture/candidate run without a valid snapshot manifest and snapshot root
  must stop before authorization consumption or Cookie access.
- Verify snapshot bytes, not working-tree bytes, before authorization, after each
  source, and at closeout. Any failed observation is latched and makes the batch
  non-positive even if bytes are later restored.
- Include extension entrypoints/config/public assets and exact dependency-tree
  identities. Missing root, unresolved import, null tool identity, symlink, extra
  executable byte, or digest drift fails closed.

## R2 - Put the canonical protocol on the only review path

- Preflight/sequencer must build the v2 precommit from repository canonical bytes
  before external action and validate it again before projection/review.
- Bind exact run id, fixed registry order, random review order, both session ids,
  both pass records, sentinel source, and both distinct positions.
- Remove or reject the old private/caller-supplied protocol path.
- Only after all corrective tests pass may Codex decide whether to freeze exact
  rubric/prompt bytes.

## R3 - Replace the evidence validator with authority recomputation

- Accept raw receipt locations/bytes, not caller-normalized rows.
- Reuse production aggregate, candidate-authority, artifact-integrity,
  review-bundle, review-protocol, retention, ledger, scan, and cleanup validators.
- Require exact six-row registry order and complete source/bundle cross-binding.
- Recompute machine gate, review authorization, review/sentinel counts, ledger
  totals, scans, and decision. No caller boolean may decide a gate.
- Validate every payload with exact key sets and mandatory run/source bindings.
- Write atomically, re-read, validate, generate manifest last, and verify manifest.

## R4 - Persist diagnostics and latch closure failures

- Include `stageADiagnostic` and `executionClosure` in every final machine receipt.
- Extend exact machine-receipt/aggregate schemas and tests without weakening prior
  identity/publication checks.
- Closure failure observed at any checkpoint must survive receipt merging and make
  aggregate non-positive.

## R5 - Split private and public retention records

- Private record may hold the owned root; public projection may hold only a
  SHA-256 root reference, policy enums, owner reference, deadline, digest count,
  and deletion status.
- Validate exact UTC deadline, digest syntax/uniqueness, owner format, and deletion
  receipt state. Scan the generated public package before signing it.

## R6 - Correct partial coverage facts

- Record maximum regions covered by any tested 2/3-claim subset, number of
  full-region subsets before/after length filtering, and stable rejection class.
- Preserve all frozen limits and never persist text or evidence ids.

## R7 - Verification

Add process-level mutations for missing closure inputs, worktree/snapshot split,
drift-and-restore, absent closure env, pre-Cookie stop, private protocol fallback,
pass-position mismatch, null run ids, fabricated positive evidence, missing
bundles, invalid ledger/scan, and public retention path leakage.

Run focused suites, full Runtime tests for Python changes, the complete Stage B
offline suite once, relay verification only if scope changes, scans, cleanup, and
a zero-action receipt. Exit only as
`GC-B6H-R OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT`.
