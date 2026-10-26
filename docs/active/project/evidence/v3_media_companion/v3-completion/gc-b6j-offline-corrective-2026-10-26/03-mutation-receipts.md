# GC-B6J Mutation Receipts

Batch: `GC-B6J OFFLINE CORRECTIVE`
Date: 2026-10-26

Every receipt below is a REAL mutation of a REAL input, driven against the
PRODUCTION owner. The "refusal" column is the observed behaviour: the exact
stable code the owner produced. No case asserts a constant in place of a
behaviour.

## A. A worktree dependency exists but the snapshot child receives no explicit binding

| Item | Value |
|---|---|
| Owner | `lib/candidate_dependencies.mjs :: verifyCandidateDependencies` |
| Mutation | the child environment carries the prepared dependency object but NOT the four dependency variables, so the child falls back to its own module-local root, which is the snapshot |
| Observed | the parity check refuses with `B6_DEPENDENCY_INPUT_MISMATCH` |
| Test | `J2: a child WITHOUT the explicit binding resolves ANOTHER dependency and is refused` |

## B. The dependency disappears after the preflight

| Item | Value |
|---|---|
| Owner | `lib/candidate_dependencies.mjs` |
| Mutation | the ASR root is deleted after the candidate preparation |
| Observed | `B6_DEPENDENCY_INPUT_MISSING` |
| Test | `J2: a dependency that DISAPPEARS after the preflight is refused` |

## C. The preflight receipt and the child dependency identities differ

| Item | Value |
|---|---|
| Owner | `lib/candidate_dependencies.mjs :: preflightDependencyCheck` and `verifyCandidateDependencies` |
| Mutation | the prepared dependency object carries another managed-tools identity, and separately another extension-build identity |
| Observed | `B6_DEPENDENCY_INPUT_DRIFTED` in both the preflight check and the child check |
| Tests | `J2: the preflight and the child identities that DIFFER are refused`, `J2: the PREFLIGHT validates the exact object that the child consumes` |

## D. A DRIFTED dependency

| Item | Value |
|---|---|
| Owner | `lib/candidate_dependencies.mjs :: candidateDependencyDefects` |
| Mutation | the managed tools change after the preflight |
| Observed | `B6_DEPENDENCY_INPUT_DRIFTED` |
| Test | `J2: a DRIFTED dependency is refused by the identity comparison` |

## E. The explicit correct dependency object

| Item | Value |
|---|---|
| Owner | `lib/candidate_dependencies.mjs` |
| Mutation | none: the child receives the four explicit values |
| Observed | the parity check passes and the child resolves the SAME four dependencies as the preparation |
| Test | `J2: the child WITH the explicit binding resolves the SAME dependency and passes` |

## F. Zero actions before the refusal

| Item | Value |
|---|---|
| Owner | `run_one_bvid.mjs` (the dependency check) and `sequencer.mjs` (the pre-authorization check) |
| Process | the REAL runner and the REAL sequencer, spawned as child processes |
| Observed | the runner's durable receipt carries a `B6_DEPENDENCY_*` code and the stage action ledger records NO `chromeLaunch`, NO `visibleWindow`, NO `runtimeStart`, NO `cookieInjection`, NO `mediaTask`, NO `providerCall`, NO `focusEvent` and NO `sourceAttempt`; the sequencer exits nonzero and the stage root holds NO authorization marker |
| Tests | `J3: the runner refuses a mismatched dependency BEFORE any external action`, `J5: the sequencer refuses an invalid dependency binding BEFORE the authorization` |

## G. The stable code survives the finalization and the public projection

| Item | Value |
|---|---|
| Owner | `lib/audit_finalizer.mjs` (the merge) and `lib/public_evidence.mjs` (the projection) |
| Mutation | a later healthy observation arrives after the dependency refusal |
| Observed | the merged receipt stays `failed` with `B6_DEPENDENCY_INPUT_MISMATCH`; the public machine row carries the stable code |
| Test | `J3: the stable code survives the runner finalization`, `J3: the stable code survives the public projection and a generic Error is refused` |

## H. A generic `Error` is refused by the public projection

| Item | Value |
|---|---|
| Owner | `lib/stable_failure_codes.mjs` and `lib/public_evidence.mjs` |
| Mutation | the public machine row's terminal code is hand-edited to `Error` |
| Observed | `PUBLIC_EVIDENCE_FAILURE_CODE_NOT_ALLOWLISTED` |
| Test | `J3: the stable code survives the public projection and a generic Error is refused` |

## I. No secret or path reaches the public lock, the receipt or the evidence

| Item | Value |
|---|---|
| Owner | `lib/candidate_dependencies.mjs :: publicDependencyIdentities`, `lib/candidate_prepare.mjs :: buildCandidateLock`, `lib/public_evidence.mjs` |
| Mutation | none: the identities are the production projections |
| Observed | the serialized identities and the lock carry NO absolute path, no private root, no database name, no credential and no Provider identity; the refused runner receipt carries no path and never names the database |
| Tests | `J1: the safe identities carry no path, no database name, no credential and no Provider identity`, `J3: the runner refuses a mismatched dependency BEFORE any external action` |

## J. Duplicate private file bytes produce one retention digest

| Item | Value |
|---|---|
| Owner | `lib/retention_ledger.mjs :: collectArtifactDigests` |
| Mutation | two private artifacts carry byte-identical content |
| Observed | the owner returns a SORTED UNIQUE digest set of two entries for three files, and the public retention validator still refuses a caller-supplied duplicate with `RETENTION_ARTIFACT_DIGEST_DUPLICATE` |
| Tests | `J4: two byte-identical private artifacts produce ONE retention digest`, `J4: the public retention validator still refuses a caller-supplied duplicate` |

## K. The direct entry may not bypass the sealed preparation

| Item | Value |
|---|---|
| Owner | `run_one_bvid.mjs` and `sequencer.mjs` |
| Mutation | the runner is invoked directly with a B6 capture request and NO sealed snapshot |
| Observed | the receipt carries `B6_EXECUTION_CLOSURE_INVALID` and the stage ledger records no external action |
| Test | `J5: a direct runner entry with a B6 capture request refuses the unsealed path` |
