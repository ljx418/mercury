# GC-B6H-R Changed Files And Contract Statement

Batch: `GC-B6H-R OFFLINE CORRECTIVE`
Date: 2026-10-26

## 1. The contract statement

**none.**

No public contract, V2.1 schema, quality threshold, request bound,
registry, denominator or historical evidence was changed. The eight-request
bound is untouched. The frozen thresholds, the failure codes, the machine
gate rule, the rubric axes and the sentinel placement are the frozen ones.

The only PRODUCT change is the DIAGNOSTIC surface of the offline harness:
`comprehension/quality.py` now records, in addition to the valid full-subset
count, the maximum number of regions that any tested 2/3-claim subset
reached, the number of full-region subsets before and after the frozen
length rule, and a stable rejection class. It records structural facts
only, it never changes a disposition and it never relaxes a limit.

### The one INTERNAL record version

The durable machine receipt of the B6 harness gained three fields
(`stageADiagnostic`, `executionClosure`, `executionRoots` and the two
extension manifest digests), so its internal record version moved from
`v3-5.10-b5-3-source-receipt/v2` to `v3-5.10-b5-3-source-receipt/v3`. That
record is the ACCEPTANCE HARNESS's own evidence record: it is not a public
product contract, it is not the V2.1 artifact schema, and no reader of it
validates the version. The checkpoint explicitly authorizes the modification
of "the B6 harness, its internal diagnostics/evidence tooling".

## 2. The changed files

The Stage B tree is largely UNTRACKED in git, so the git diff mixes this
batch with the uncommitted Stage B work of the earlier batches. The list
below is this batch's own inventory.

### New (7)

| File | Role |
|---|---|
| `scripts/stage_b_b5_3/lib/candidate_prepare.mjs` | R1: the candidate preparation, the candidate environment, the candidate lock, the stop codes |
| `scripts/stage_b_b5_3/lib/source_rows.mjs` | the SHARED per-source row collector (the sequencer and the publisher read the same rows) |
| `scripts/stage_b_b5_3/prepare_candidate.mjs` | R1: the CLI entrypoint that seals the candidate and launches the sequencer FROM the snapshot |
| `scripts/stage_b_b5_3/publish_public_evidence.mjs` | R3: the publisher that generates, scans, writes atomically, re-reads, validates and signs the public package |
| `scripts/stage_b_b5_3/test/b6hr_offline_corrective.node-test.mjs` | the anti-false-green matrix of this corrective (30 cases) |
| `scripts/stage_b_b5_3/test/_fixtures/b6hr_public_evidence.mjs` | the contract-shaped synthetic authorities of the public-evidence cases |
| `docs/.../gc-b6hr-offline-corrective-2026-10-26/` | this evidence package |

### Modified (13)

| File | Change |
|---|---|
| `scripts/stage_b_b5_3/lib/execution_closure.mjs` | the mechanical import resolution (the package form, the absolute package imports, the extension probing), the declared roots and contract files, the tool bindings and the dependency-tree identities, the snapshot EXTRA/MISSING verification, the execution-root identities, the manifest defects |
| `scripts/stage_b_b5_3/lib/review_protocol.mjs` | the mandatory run id, the pass-record bindings, the sentinel derivation, the random order and session draws, the validated builder |
| `scripts/stage_b_b5_3/lib/public_evidence.mjs` | the recomputation from the raw authorities, the mandatory run binding, the machine-gate cross-check, the bundle re-read, the ledger reconciliation, the scan, the lock and the precommit validation, the retention projection |
| `scripts/stage_b_b5_3/lib/retention_ledger.mjs` | the private record and the public projection, the projection validation |
| `scripts/stage_b_b5_3/lib/aggregate.mjs` | the closure verdict of a source row is an aggregate failure |
| `scripts/stage_b_b5_3/lib/audit_finalizer.mjs` | the new durable receipt fields |
| `scripts/stage_b_b5_3/lib/action_ledger.mjs` | the ledger event count in the totals |
| `scripts/stage_b_b5_3/run_one_bvid.mjs` | the candidate roots, the mandatory pre-grant snapshot check, the snapshot verification and the latch, the execution-root identities, the durable diagnostics, the offline snapshot-mutation seam |
| `scripts/stage_b_b5_3/sequencer.mjs` | the state root, the pre-authorization snapshot check, the canonical precommit, the candidate lock, the closeout snapshot verification, the shared row collector |
| `scripts/stage_b_b5_3/test/b6h_offline_correction.node-test.mjs` | the H3 cases drive the recomputed public evidence |
| `services/local-runtime/.../comprehension/quality.py` | the partial coverage facts of the brief-coverage diagnostic |
| `services/local-runtime/.../comprehension/diagnostics.py` | the quality block carries the new facts |
| `services/local-runtime/tests/test_v3_gc_b6h_quality_diagnostics.py` | the new key set and the partial-coverage case |

## 3. The other repository state

The working tree was dirty before this batch and it is dirty now. The
modifications of the concurrent sessions (the Runtime modules, the extension
sources, the built bundle and the historical evidence) were NOT touched by
this batch. The repository was not committed, pushed, reset, cleaned, checked
out or reverted.
