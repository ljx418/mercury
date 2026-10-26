# GC-B6H-R Implementation Map (case → owner)

Every obligation maps to the ONE owner that decides it, to the test that
drives it, and to the negative that proves the refusal. A test never
re-implements a rule: it drives the production owner with a real input.

The checkpoint findings are the source of the obligations:

| Finding | Correction | Owner |
|---|---|---|
| Fatal 1 — the public evidence validator could certify a negative run as positive | the package is GENERATED from the raw authorities, the machine gate is RECOMPUTED by the production aggregate, the bundles are re-read with the production reader, the ledger is reconciled, the scan is re-read, the lock and the precommit are validated, and the run binding is MANDATORY | `lib/public_evidence.mjs` |
| Major 1 — the snapshot was not the execution root and the closure was fail-open | one preparation entrypoint, an exclusive repository-external snapshot, the snapshot IS the execution root, the manifest is verified against the SNAPSHOT before the authorization, after every source and at the closeout, and any failed observation is LATCHED | `lib/execution_closure.mjs`, `lib/candidate_prepare.mjs`, `prepare_candidate.mjs`, `run_one_bvid.mjs`, `sequencer.mjs` |
| Major 2 — the canonical protocol was neither operative nor fully validated | the precommit is built and validated by the sequencer BEFORE the external action, the run id is mandatory, the pass records are bound to the sentinel, and the caller may not supply the protocol | `lib/review_protocol.mjs`, `sequencer.mjs` |
| Major 3 — the Stage A and closure diagnostics were omitted from the durable receipts | both diagnostics and the execution-root identities are durable fields of every machine receipt, and a closure failure makes the aggregate non-positive | `run_one_bvid.mjs`, `lib/audit_finalizer.mjs`, `lib/aggregate.mjs` |
| Major 4 — the retention records could leak private paths into the public evidence | the private record keeps the owned root; the public projection carries a non-reversible root reference and validated policy fields only | `lib/retention_ledger.mjs`, `lib/public_evidence.mjs` |
| Minor 1 — the brief coverage diagnostic understated partial coverage | the maximum regions reached by any tested subset, the number of full-region subsets before and after the length rule and a stable rejection class are recorded separately | `comprehension/quality.py` |

## R1 — the sealed snapshot is the execution root

Owner: `scripts/stage_b_b5_3/lib/execution_closure.mjs` (the closure, the
manifest, the materialization and the snapshot verification) and
`scripts/stage_b_b5_3/lib/candidate_prepare.mjs` (the preparation).

| Case | Negative | Assertion |
|---|---|---|
| the preparation seals the executed bytes | — | the snapshot verifies against its own manifest, the manifest has no unresolved import and no absent tool identity |
| a run WITHOUT a closure/snapshot stops before the grant, the Cookie and Chrome | the required switch is on and no manifest exists | `B6_EXECUTION_SNAPSHOT_REQUIRED`; the stage ledger records no Chrome, no Runtime, no Cookie, no media task and no Provider call; the closure check precedes the grant in the runner source |
| the Runtime, the extension and the child harness execute the SNAPSHOT bytes | the seal owner changes one byte of the snapshot and records the new digest | the receipt's extension tree digest, runtime tree digest and runner file digest are the SNAPSHOT's and differ from the working tree's |
| a drift detected AFTER a source remains fatal after the restoration | the offline seam changes one byte before the post-source verification | the receipt is `failed` with `B6_EXECUTION_CLOSURE_INVALID`; the restored snapshot verifies again and the receipt is STILL fatal |
| an EXTRA byte inside the snapshot | a file appears after the materialization | `EXECUTION_CLOSURE_SNAPSHOT_EXTRA_FILE` |
| a MISSING byte inside the snapshot | a file disappears | `EXECUTION_CLOSURE_FILE_MISSING` |
| the private root may never be inside the repository | the private root is under the repository | `B6_CANDIDATE_PREPARE_ROOT_INVALID` |

## R2 — the canonical protocol is on the only review path

Owner: `scripts/stage_b_b5_3/lib/review_protocol.mjs`.

| Case | Negative | Assertion |
|---|---|---|
| a valid precommit passes | — | it passes |
| a NULL or MISSING run id | the run id is removed | `REVIEW_PROTOCOL_RUN_ID_MISSING` |
| an ALTERED pass position | both pass positions become 99 | `REVIEW_PROTOCOL_PASS_POSITION_MISMATCH` and `REVIEW_PROTOCOL_SENTINEL_POSITION_INVALID` |
| a PRIVATE protocol path | the rubric points at a private path | `REVIEW_PROTOCOL_CALLER_SUPPLIED_REPLACEMENT` |
| a PROTOCOL byte drift | the recorded prompt hash changes | `REVIEW_PROTOCOL_PROMPT_DRIFT` |
| the built precommit is the only accepted one | the builder and the validator | the pass records are bound to the sentinel and the two positions differ |

## R3 — the public evidence is recomputed from the raw authorities

Owner: `scripts/stage_b_b5_3/lib/public_evidence.mjs` (the builder and the
validator), `scripts/stage_b_b5_3/publish_public_evidence.mjs` (the
publisher) and `scripts/stage_b_b5_3/lib/source_rows.mjs` (the shared row
collector).

| Case | Negative | Assertion |
|---|---|---|
| the generated package is valid and its counts match its rows | — | it passes and the counts are recomputed from the rows |
| SIX LIMITED rows cannot be declared machine-positive or reviewed | the decision payload is hand-edited | `PUBLIC_EVIDENCE_MACHINE_GATE_MISMATCH` and `PUBLIC_EVIDENCE_REVIEW_INVALID` |
| the machine-results payload may not claim a positive gate either | the gate flag is hand-edited | `PUBLIC_EVIDENCE_MACHINE_GATE_MISMATCH` |
| NO bundle | the bundle directories are absent and the gate is forged positive | `PUBLIC_EVIDENCE_BUNDLE_MISSING` |
| a MALFORMED bundle | the private manifest is destroyed | `PUBLIC_EVIDENCE_BUNDLE_INVALID` |
| an INVALID ledger | the ledger integrity is false | `PUBLIC_EVIDENCE_LEDGER_INVALID` |
| a NONZERO scan | the scan reports an absolute path | `PUBLIC_EVIDENCE_SCAN_NOT_CLEAN` |
| an ARBITRARY lock | the lock names another run or was not locked before the action | `PUBLIC_EVIDENCE_RUN_ID_MISMATCH` and `PUBLIC_EVIDENCE_CANDIDATE_LOCK_INVALID` |
| an ARBITRARY precommit | the prompt hash is changed | `PUBLIC_EVIDENCE_PRECOMMIT_INVALID` |
| a MISSING source binding | a bundle carries another bvid | `PUBLIC_EVIDENCE_SOURCE_BINDING_MISMATCH` |
| a MANUALLY ALTERED public row | a disposition is changed | `PUBLIC_EVIDENCE_COUNT_MISMATCH` |
| a MALFORMED raw receipt row | a field is added | `PUBLIC_EVIDENCE_SCHEMA_INVALID` |
| a MISSING run id in a payload | the run id is deleted | `PUBLIC_EVIDENCE_RUN_ID_MISMATCH` |

## R4 — the diagnostics are durable and they are latched

Owners: `run_one_bvid.mjs` (the observations), `lib/audit_finalizer.mjs`
(the merge) and `lib/aggregate.mjs` (the verdict).

| Case | Negative | Assertion |
|---|---|---|
| the durable receipt carries the EXACT Stage A and closure diagnostics | — | the exact key sets of `stageADiagnostic` and `executionClosure`, and the execution-root identities |
| a closure failure makes the aggregate non-positive | a source receipt carries an invalid closure | `AGG_EXECUTION_CLOSURE_INVALID` and the aggregate is not positive |
| the receipt merge never clears a latched closure failure | a later healthy observation arrives | the merged receipt stays `failed` with `B6_EXECUTION_CLOSURE_INVALID` |

## R5 — the private retention and its public projection

Owner: `scripts/stage_b_b5_3/lib/retention_ledger.mjs`.

| Case | Negative | Assertion |
|---|---|---|
| an ABSOLUTE private root never enters the public evidence | the private record holds an owned path | the projection carries a non-reversible root reference, the package contains no path and the package still validates |
| a malformed deadline, an invalid digest and a duplicate digest | the projection is altered | `RETENTION_ARTIFACT_DEADLINE_INVALID`, `RETENTION_ARTIFACT_DIGEST_INVALID` and `RETENTION_ARTIFACT_DIGEST_DUPLICATE` |
| a public projection that carries a PATH | the owner field carries a path | `RETENTION_PUBLIC_PROJECTION_PATH_LEAK` |

## R6 — the partial coverage facts

Owner: `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py`.

| Case | Negative | Assertion |
|---|---|---|
| a partial brief coverage reports a NONZERO maximum coverage | no 2/3-claim subset covers every required region | `maxCoveredRegionCount` is at least one, `coveredRegionCount` stays zero, the full-region subset counts are zero and the rejection class is `no_full_region_subset` |
| the facts stay structural | the candidate carries text | no text, no id and no path enter the diagnostic |
| the disposition never changes | — | the independent validator's disposition is unchanged and the candidate is not mutated |
