# Case To Production Oracle Map

Every case of the batch is bound to the PRODUCTION module that decides. A
test never re-implements a rule: it feeds a mutation to the production
oracle and asserts the production verdict.

## Group 1 — the bundle identity and hash closure (12 fixed)

Oracle: `scripts/stage_b_b5_3/lib/review_bundle.mjs :: validateReviewBundle`

| Case | Mutation | Production decision |
|---|---|---|
| identity 1/12 | none | accepted |
| identity 2/12 | another task id | `B6_BUNDLE_IDENTITY_MISMATCH` |
| identity 3/12 | another task revision | `B6_BUNDLE_IDENTITY_MISMATCH` |
| identity 4/12 | another source identity | `B6_BUNDLE_IDENTITY_MISMATCH` |
| identity 5/12 | another registry order | `B6_BUNDLE_IDENTITY_MISMATCH` |
| identity 6/12 | another registry bvid | `B6_BUNDLE_IDENTITY_MISMATCH` |
| identity 7/12 | another registry digest | `B6_BUNDLE_IDENTITY_MISMATCH` |
| identity 8/12 | a malformed derivative | `B6_BUNDLE_ARTIFACT_INVALID` |
| identity 9/12 | a derivative that breaks the frozen contract | `B6_BUNDLE_ARTIFACT_INVALID` |
| identity 10/12 | a catalog hash mismatch | `B6_BUNDLE_CATALOG_HASH_MISMATCH` |
| identity 11/12 | a missing REFERENCED evidence record | `B6_BUNDLE_EVIDENCE_MISSING` |
| identity 12/12 | a manifest drift | `B6_BUNDLE_MANIFEST_DRIFT` |

## Group 2 — the evidence and text mutations (10 fixed)

Oracle: `validateReviewBundle`

| Case | Mutation | Production decision |
|---|---|---|
| evidence 1/10 | a text that does not hash | `B6_BUNDLE_EVIDENCE_HASH_MISMATCH` |
| evidence 2/10 | a null text | `B6_BUNDLE_EVIDENCE_HASH_MISMATCH` |
| evidence 3/10 | a duplicate evidence id | `B6_BUNDLE_DUPLICATE_FILE` |
| evidence 4/10 | an evidence of another task | `B6_BUNDLE_IDENTITY_MISMATCH` |
| evidence 5/10 | a malformed evidence record | `B6_BUNDLE_SCHEMA_INVALID` |
| evidence 6/10 | a foreign evidence id in the derivative | `B6_BUNDLE_EVIDENCE_MISSING` |
| evidence 7/10 | a declared but uncaptured thumbnail | `B6_BUNDLE_THUMBNAIL_INVALID` |
| evidence 8/10 | a forbidden field in the public receipt | `B6_BUNDLE_PROVIDER_LEAK` |
| evidence 9/10 | a secret in the bundle | `B6_BUNDLE_SECRET_LEAK` |
| evidence 10/10 | an absolute path in the bundle | `B6_BUNDLE_ABSOLUTE_PATH` |

## Group 3 — the thumbnail and seek mutations (8 fixed)

Oracle: `validateReviewBundle`

| Case | Mutation | Production decision |
|---|---|---|
| thumbnail 1/8 | a thumbnail that is not a PNG | `B6_BUNDLE_THUMBNAIL_INVALID` |
| thumbnail 2/8 | an empty thumbnail | `B6_BUNDLE_THUMBNAIL_INVALID` |
| thumbnail 3/8 | a duplicate thumbnail | `B6_BUNDLE_DUPLICATE_FILE` |
| thumbnail 4/8 | a thumbnail without an evidence record | `B6_BUNDLE_EVIDENCE_MISSING` |
| seek 5/8 | a seek time outside the media | `B6_BUNDLE_SEEK_OUT_OF_RANGE` |
| seek 6/8 | a chapter that ends before it starts | `B6_BUNDLE_SEEK_OUT_OF_RANGE` |
| seek 7/8 | a missing evidence id in a seek chapter | `B6_BUNDLE_EVIDENCE_MISSING` |
| seek 8/8 | a seek map without a media duration | `B6_BUNDLE_SEEK_OUT_OF_RANGE` |

## Group 4 — the blind projection and the privacy (8 fixed)

Oracle: `scripts/stage_b_b5_3/lib/blind_projection.mjs :: projectionPrivacyDefects`

The eight cases of `b6_blind_projection.node-test.mjs` are unchanged. The
review binding now has EXACTLY ONE definition
(`lib/review_bundle.mjs :: reviewBindingSha256`), which the blind projection
imports, so the projection and the capture receipt can never bind different
values.

## Group 5 — the lifecycle and the cleanup (6 fixed)

Oracle: the REAL runner `scripts/stage_b_b5_3/run_one_bvid.mjs` driven
against a local Runtime double.

| Case | Production decision |
|---|---|
| lifecycle 1/6 | the capture receipt is IN the machine receipt and the private bundle survived the owner cleanup |
| lifecycle 2/6 | a capture failure fails the candidate CLOSED (`disposition: failed`, a specific `B6_CAPTURE_*` code) |
| lifecycle 3/6 | a capture failure still runs the owner cleanup |
| lifecycle 4/6 | the public receipt carries ONLY the schema, the counts, the digests, the closure and the status |
| lifecycle 5/6 | the private root is 0700 and OUTSIDE the repository |
| lifecycle 6/6 | without a private root the runner captures NOTHING and starts NOTHING |

## Group 6 — the candidate-bound aggregate and the sentinel (10 fixed)

Oracle: `scripts/stage_b_b5_3/lib/b6_aggregate.mjs :: evaluateB6Aggregate`
with `scripts/stage_b_b5_3/lib/b6_authority.mjs :: candidateAuthorityDefects`.

| Case | Production decision |
|---|---|
| aggregate 1/10 | the positive control is accepted |
| aggregate 2/10 | the EXACT threshold (every axis = 4) is accepted |
| aggregate 3/10 | one under the threshold: `B6_AXIS_BELOW_MINIMUM` |
| aggregate 4/10 | a missing row: `B6_ROW_MISSING` |
| aggregate 5/10 | a duplicate row: `B6_ROW_DUPLICATE` + `B6_ROW_MISSING` |
| aggregate 6/10 | a critical error: `B6_CRITICAL_ERROR` |
| aggregate 7/10 | a reversed sentinel: `B6_SENTINEL_REVERSED` |
| aggregate 8/10 | the same sentinel session: `B6_SENTINEL_SESSION` |
| aggregate 9/10 | a rubric hash drift: `B6_RUBRIC_HASH_DRIFT` |
| aggregate 10/10 | a visible Provider identity: `B6_PROVIDER_IDENTITY_VISIBLE` |

## Group 7 — the PROCESS-LEVEL mutation matrix (13, new)

Oracle: `validateReviewBundle`, driven in a SEPARATE PROCESS by
`test/_fixtures/b6_mutation_runner.mjs`. The exit code is the verdict.

| Case | Mutation | Production decision |
|---|---|---|
| control | none | ACCEPTED (exit 3) |
| codex 1/4 | a foreign adapter | `B6_BUNDLE_IDENTITY_MISMATCH` |
| codex 2/4 | a stale revision | `B6_BUNDLE_IDENTITY_MISMATCH` |
| codex 3/4 | detached manifest bytes | `B6_BUNDLE_MANIFEST_DRIFT` |
| codex 4/4 | a false closure flag | `B6_BUNDLE_RECEIPT_INVALID` |
| wrong counts | zero counts | `B6_BUNDLE_RECEIPT_INVALID` |
| wrong hashes | zero digests | `B6_BUNDLE_RECEIPT_INVALID` |
| wrong schema | another receipt schema | `B6_BUNDLE_RECEIPT_INVALID` |
| failed status | `status: failed` | `B6_BUNDLE_RECEIPT_INVALID` |
| traversal | `../../etc/passwd` in the manifest | `B6_BUNDLE_MANIFEST_PATH_INVALID` |
| undeclared | an undeclared manifest file | `B6_BUNDLE_MANIFEST_DRIFT` |
| missing | a missing contracted file | `B6_BUNDLE_MANIFEST_DRIFT` |
| provider | a Provider identity in the public receipt | `B6_BUNDLE_PROVIDER_LEAK` |

## Group 8 — the FILESYSTEM transaction (14, new)

Oracle: `scripts/stage_b_b5_3/lib/review_capture.mjs :: resolveCaptureRoot`,
`resolvePrivateFile`, `captureReviewBundle`, `readReviewBundle` on a REAL
filesystem.

| Case | Production decision |
|---|---|
| fs 1 | a root inside the repository: `B6_CAPTURE_ROOT_INVALID` |
| fs 2 | a symlinked root: `B6_CAPTURE_ROOT_INVALID` |
| fs 3 | a root accessible by the others: `B6_CAPTURE_ROOT_INVALID` |
| fs 4 | a root that does not exist: `B6_CAPTURE_ROOT_INVALID` |
| fs 5 | a relative root: `B6_CAPTURE_ROOT_INVALID` |
| fs 6 | the strict resolution stays inside the root |
| fs 7 | a symlinked component is refused |
| fs 8 | a successful capture publishes ATOMICALLY and leaves no staging residue |
| fs 9 | a pre-existing destination: `B6_CAPTURE_DESTINATION_EXISTS`, the existing content survives |
| fs 10 | an interruption at EVERY write and rename boundary: nothing is published and the owned staging directory is removed |
| fs 11 | the reader refuses a traversing manifest path |
| fs 12 | the reader refuses a symlinked payload |
| fs 13 | the reader refuses an undeclared payload |
| fs 14 | the reader refuses a missing contracted payload |

## Group 9 — the REVIEWABLE seek closure (13, new)

Oracle: `lib/review_capture.mjs :: buildSeekMap` and
`validateReviewBundle`.

| Case | Production decision |
|---|---|
| seekcls 1 | a zero-length window: `B6_BUNDLE_SEEK_OUT_OF_RANGE` |
| seekcls 2 | a seek time outside its own chapter: `B6_BUNDLE_SEEK_OUT_OF_RANGE` |
| seekcls 3 | a missing chapter: `B6_BUNDLE_SEEK_OUT_OF_RANGE` |
| seekcls 4 | an extra chapter: `B6_BUNDLE_SEEK_OUT_OF_RANGE` |
| seekcls 5 | a reordered chapter: `B6_BUNDLE_SEEK_OUT_OF_RANGE` |
| seekcls 6 | a non-frame representative: `B6_BUNDLE_SEEK_OUT_OF_RANGE` |
| seekcls 7 | a representative without a captured PNG: `B6_BUNDLE_THUMBNAIL_INVALID` |
| seekcls 8 | a representative of another task: `B6_BUNDLE_IDENTITY_MISMATCH` |
| seekcls 9 | a seek row that cites another evidence set: `B6_BUNDLE_SEEK_OUT_OF_RANGE` |
| seekcls 10 | the builder PREFERS a cited frame inside the window |
| seekcls 11 | the builder FALLS BACK to the nearest captured frame |
| seekcls 12 | the builder FAILS without a PNG-backed frame |
| seekcls 13 | the CAPTURE fails without a frame: `B6_CAPTURE_SEEK_UNCLOSED` |

## Group 10 — the RUNNER integration (5, new)

Oracle: `scripts/stage_b_b5_3/lib/b6_capture_gate.mjs :: captureGateDecision`,
`lib/action_ledger.mjs` and `lib/audit_finalizer.mjs :: mergeMachineReceipt`,
driven in a SEPARATE PROCESS.

| Case | Production decision |
|---|---|
| gate 1 | a capture that was not requested allows the completion |
| gate 2 | a closed capture allows the completion |
| gate 3 | a failed capture refuses the completion and names the code |
| gate 4 | a failed capture leaves NO completion accounting and NO complete receipt |
| gate 5 | the runner records the completion AFTER the review capture (the source-order invariant of `run_one_bvid.mjs`) |
