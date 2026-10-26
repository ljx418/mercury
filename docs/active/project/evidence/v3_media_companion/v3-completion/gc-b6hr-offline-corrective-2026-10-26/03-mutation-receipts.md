# GC-B6H-R Mutation Receipts

Batch: `GC-B6H-R OFFLINE CORRECTIVE`
Date: 2026-10-26

Every receipt below is a REAL mutation of a REAL input, driven against the
PRODUCTION owner. The "refusal" column is the observed behaviour: the exact
stable code the owner produced. No case asserts a constant in place of a
behaviour.

## A. A run without a closure/snapshot stops before grant/Cookie/Chrome

| Item | Value |
|---|---|
| Owner | `lib/execution_closure.mjs` + `lib/candidate_prepare.mjs` + `run_one_bvid.mjs` |
| Mutation | the candidate switch `NAVIA_B6_REQUIRE_SNAPSHOT=1` is on and NO manifest and NO snapshot root are supplied |
| Process | the REAL runner, spawned as a child process, with a stage root, an evidence root and a Cookie path that does not exist |
| Observed | the durable receipt is `failed` with `B6_EXECUTION_CLOSURE_INVALID`; the closure observation is `{present:false, ok:false, codes:["B6_EXECUTION_SNAPSHOT_REQUIRED"]}`; the stage action ledger records NO `chromeLaunch`, NO `visibleWindow`, NO `runtimeStart`, NO `cookieInjection`, NO `mediaTask`, NO `providerCall` and NO `focusEvent`; the exit code is nonzero |
| Static proof | the index of `verifyCandidateClosure("pre-external-action")` is lower than the index of `verifyChildGrant({` in the runner source: the closure check precedes the grant |
| Test | `R1: a candidate without a snapshot is refused before the grant, the Cookie and Chrome` |

## B. Runtime, extension and child harness demonstrably execute snapshot bytes

| Item | Value |
|---|---|
| Owner | `lib/execution_closure.mjs` (`resolveExecutionRootIdentities`, `executionTreeDigest`) |
| Mutation | the seal owner changes ONE byte of the built extension bundle and ONE byte of the Runtime entrypoint INSIDE the snapshot and records the new digests in the manifest, so the seal still holds while the snapshot differs from the working tree |
| Process | the REAL runner, launched FROM the snapshot, with the candidate environment |
| Observed | the receipt's `executionRoots.productRootSource` is `snapshot`; the `extensionTreeSha256` and the `runtimeTreeSha256` equal the digests of the MUTATED snapshot trees and DIFFER from the working tree's digests; the `runnerFileSha256` equals the digest of the snapshot's own runner; the closure observation is `present:true, ok:true` |
| Test | `R1: the Runtime, the extension and the child harness execute the SNAPSHOT bytes` |

## C. A drift detected after a source remains fatal after restoration

| Item | Value |
|---|---|
| Owner | `run_one_bvid.mjs` (`latchClosureFailure`) + `lib/audit_finalizer.mjs` (the merge) + `lib/aggregate.mjs` (the verdict) |
| Mutation | the offline seam changes ONE byte of the sealed snapshot immediately before the post-source verification |
| Process | the REAL runner, launched FROM the snapshot |
| Observed | the post-source verification reports `EXECUTION_CLOSURE_FILE_DRIFT`; the durable receipt is `failed` with `B6_EXECUTION_CLOSURE_INVALID`; the bytes are then RESTORED and the snapshot verifies again, but the durable receipt is STILL `failed` with the same code: the failure is LATCHED |
| Aggregate | a source row whose receipt carries an invalid closure makes `evaluateAggregate()` non-positive with `AGG_EXECUTION_CLOSURE_INVALID` |
| Merge | a LATER healthy observation never clears the latched pair: the merged receipt stays `failed` with `B6_EXECUTION_CLOSURE_INVALID` |
| Test | `R1: a drift detected after a source remains fatal after the restoration`, `R4: a closure failure makes the aggregate non-positive`, `R4: the receipt merge never clears a latched closure failure` |

## D. Null/missing run id, altered pass position, private protocol path, protocol byte drift

| Mutation | Owner | Observed refusal |
|---|---|---|
| the run id is set to null | `lib/review_protocol.mjs` | `REVIEW_PROTOCOL_RUN_ID_MISSING` |
| the run id is deleted | `lib/review_protocol.mjs` | `REVIEW_PROTOCOL_RUN_ID_MISSING` |
| both pass positions become 99 | `lib/review_protocol.mjs` | `REVIEW_PROTOCOL_PASS_POSITION_MISMATCH` |
| the two sentinel positions collide | `lib/review_protocol.mjs` | `REVIEW_PROTOCOL_SENTINEL_POSITION_INVALID` |
| a sentinel position leaves the order | `lib/review_protocol.mjs` | `REVIEW_PROTOCOL_SENTINEL_POSITION_INVALID` |
| the rubric points at a private path | `lib/review_protocol.mjs` | `REVIEW_PROTOCOL_CALLER_SUPPLIED_REPLACEMENT` |
| the recorded prompt hash changes | `lib/review_protocol.mjs` | `REVIEW_PROTOCOL_PROMPT_DRIFT` |
| the recorded rubric byte count changes | `lib/review_protocol.mjs` | `REVIEW_PROTOCOL_BYTE_COUNT_MISMATCH` |
| the registry order is replaced by the review order | `lib/review_protocol.mjs` | `REVIEW_PROTOCOL_REGISTRY_ORDER_INVALID` |
| both sessions carry the same id | `lib/review_protocol.mjs` | `REVIEW_PROTOCOL_SESSION_REUSED` |

Tests: `R2: a NULL or MISSING run id is refused`, `R2: an ALTERED pass
position is refused`, `R2: a PRIVATE protocol path is refused`, `R2: a
PROTOCOL byte drift is refused`, `R2: the BUILT precommit is the only one the
review path accepts`.

## E. Six limited rows cannot be declared machine-positive or reviewed

| Item | Value |
|---|---|
| Owner | `lib/public_evidence.mjs` |
| Mutation | six rows with the `limited` disposition, and the public payloads are hand-edited to claim a positive machine gate, a performed blind review, six review rows and two sentinel receipts |
| Observed | the BUILDER recomputes the gate with the production aggregate and writes `positive:false`; the VALIDATOR refuses the hand-edited package with `PUBLIC_EVIDENCE_MACHINE_GATE_MISMATCH` and `PUBLIC_EVIDENCE_REVIEW_INVALID` |
| Tests | `R3: SIX LIMITED rows cannot be declared machine-positive or reviewed`, `R3: the MACHINE RESULTS payload may not claim a positive gate either` |

## F. No/malformed bundles, invalid ledger, nonzero scan, arbitrary lock/precommit, missing source binding

| Mutation | Owner | Observed refusal |
|---|---|---|
| the bundle directories are absent and the gate is forged positive | `lib/public_evidence.mjs` | `PUBLIC_EVIDENCE_BUNDLE_MISSING` |
| the private manifest of a bundle is destroyed | `lib/public_evidence.mjs` | `PUBLIC_EVIDENCE_BUNDLE_INVALID` |
| the ledger integrity is false | `lib/public_evidence.mjs` | `PUBLIC_EVIDENCE_LEDGER_INVALID` |
| the scan reports an absolute path | `lib/public_evidence.mjs` | `PUBLIC_EVIDENCE_SCAN_NOT_CLEAN` |
| the lock names another run | `lib/public_evidence.mjs` | `PUBLIC_EVIDENCE_RUN_ID_MISMATCH` |
| the lock was not taken before the first external action | `lib/public_evidence.mjs` | `PUBLIC_EVIDENCE_CANDIDATE_LOCK_INVALID` |
| the precommit carries another prompt hash | `lib/public_evidence.mjs` | `PUBLIC_EVIDENCE_PRECOMMIT_INVALID` |
| a bundle carries another bvid | `lib/public_evidence.mjs` | `PUBLIC_EVIDENCE_SOURCE_BINDING_MISMATCH` |
| a public row's disposition is changed | `lib/public_evidence.mjs` | `PUBLIC_EVIDENCE_COUNT_MISMATCH` |
| a public row carries an extra field | `lib/public_evidence.mjs` | `PUBLIC_EVIDENCE_SCHEMA_INVALID` |
| a payload loses its run id | `lib/public_evidence.mjs` | `PUBLIC_EVIDENCE_RUN_ID_MISMATCH` |

Tests: `R3: NO bundle and a MALFORMED bundle are refused`, `R3: an INVALID
ledger is refused`, `R3: a NONZERO scan is refused`, `R3: an ARBITRARY lock
and an ARBITRARY precommit are refused`, `R3: a MISSING source binding is
refused`, `R3: a MANUALLY ALTERED public row is refused`, `R3: a MALFORMED
raw receipt row is refused`, `R3: a MISSING run id in a payload is refused`.

## G. An absolute private root never enters public evidence

| Item | Value |
|---|---|
| Owner | `lib/retention_ledger.mjs` + `lib/public_evidence.mjs` |
| Mutation | the PRIVATE retention record holds an owned absolute root |
| Observed | the public projection carries a non-reversible `rootReference` (a SHA-256) and no path; the generated package contains no path; the package still validates; a projection whose owner field carries a path is refused with `RETENTION_PUBLIC_PROJECTION_PATH_LEAK` |
| Tests | `R5: an ABSOLUTE private root never enters the public evidence`, `R5: a public projection that carries a PATH is refused`, `R5: a malformed deadline, an invalid digest and a duplicate digest are refused` |

## H. Durable receipts contain exact Stage A and closure diagnostics

| Item | Value |
|---|---|
| Owner | `run_one_bvid.mjs` + `lib/audit_finalizer.mjs` |
| Observed | the durable machine receipt carries `stageADiagnostic` with exactly the thirteen stable keys, `executionClosure` with exactly the eight stable keys, and the execution-root identities; the values are counts, enums, booleans and digests only |
| Test | `R4: the durable receipt carries the EXACT Stage A and closure diagnostics` |

## I. Partial brief coverage reports a nonzero maximum coverage

| Item | Value |
|---|---|
| Owner | `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py` |
| Mutation | a brief that cites ONE region while the required regions are three |
| Observed | `maxCoveredRegionCount` is at least one, `coveredRegionCount` stays zero, `fullRegionSubsetCount` and `fullRegionSubsetCountAfterLengthFilter` are zero and the stable rejection class is `no_full_region_subset`; the frozen limits, the disposition and the candidate are unchanged |
| Test | `test_b6hr6_partial_brief_coverage_reports_the_maximum_coverage` (Python) |

## J. The preparation fails closed when the source changes under the lock

| Item | Value |
|---|---|
| Owner | `lib/execution_closure.mjs` + `lib/candidate_prepare.mjs` |
| Mutation | the harness source is edited while the preparation copies it |
| Observed | the materialized snapshot does not match the manifest and the preparation is REFUSED with `EXECUTION_CLOSURE_FILE_DRIFT`: the seal is never taken over bytes that changed under it. This was observed live during this batch: an edit to the harness during a preparation run produced exactly this refusal, and the preparation passed again once the source was stable. |
| Tests | the property is exercised by the preparation itself; the refusals are the `R1` cases above |
