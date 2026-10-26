# GC-B6J Implementation Map (case → owner)

Every obligation maps to the ONE owner that decides it, to the test that
drives it, and to the negative that proves the refusal. A test never
re-implements a rule: it drives the production owner with a real input.

## J1 — one dependency-resolution authority

Owner: `scripts/stage_b_b5_3/lib/candidate_dependencies.mjs`.

| Case | Negative | Assertion |
|---|---|---|
| the authority resolves the four product dependencies | — | the managed tools, the ASR root, the vision Provider source database and the extension build root are resolved and the EXPLICIT child environment values are their paths |
| the safe identities carry no path, no database name, no credential and no Provider identity | — | the serialized identities and the candidate lock carry no absolute path and none of the private roots, the database name or a Provider identity |

The authority resolves the paths with the PRODUCT's own path owner
(`resolveOwnedProductPaths`) and an EXPLICIT repository root: the tool root
of the candidate. It never copies a secret or a mutable product database
into the snapshot.

## J2 — the preflight and the child parity

Owners: `lib/candidate_dependencies.mjs :: preflightDependencyCheck` and
`verifyCandidateDependencies`, `production_preflight.mjs`,
`sequencer.mjs`, `run_one_bvid.mjs`.

| Case | Negative | Assertion |
|---|---|---|
| a child WITHOUT the explicit binding resolves ANOTHER dependency | the four dependency variables are absent from the child environment | `B6_DEPENDENCY_INPUT_MISMATCH` |
| the child WITH the explicit binding resolves the SAME dependency | — | the parity passes |
| a dependency that DISAPPEARS after the preflight | the ASR root is deleted | `B6_DEPENDENCY_INPUT_MISSING` |
| a DRIFTED dependency | the managed tools change after the preflight | `B6_DEPENDENCY_INPUT_DRIFTED` |
| the preflight and the child identities that DIFFER | the prepared object carries another identity | `B6_DEPENDENCY_INPUT_DRIFTED` |
| the preflight validates the EXACT object the child consumes | — | the preflight check passes and a differing object is refused |

The check happens BEFORE the authorization consumption, the Cookie read, the
Chrome launch and the Runtime startup: the sequencer refuses before it
consumes the authorization and every source runner refuses before its
grant.

## J3 — the stable failure code

Owners: `lib/stable_failure_codes.mjs` (the vocabulary), `run_one_bvid.mjs`
(the assignment), `lib/audit_finalizer.mjs` (the merge), `lib/public_evidence.mjs`
(the projection).

| Case | Negative | Assertion |
|---|---|---|
| the runner refuses a mismatched dependency BEFORE any external action | the child receives no explicit binding | the receipt carries a `B6_DEPENDENCY_*` code; the stage ledger records NO Chrome, window, Runtime, Cookie, media task, Provider call, focus event or source attempt |
| the stable code survives the runner finalization | a later healthy observation arrives | the merged receipt stays `failed` with the stable code |
| the stable code survives the public projection | — | the public machine row carries the stable code |
| a generic `Error` is refused | the public row is hand-edited | `PUBLIC_EVIDENCE_FAILURE_CODE_NOT_ALLOWLISTED` |

The terminal code of a machine receipt is ALWAYS a stable, allowlisted code.
The allowlist is assembled from the OWNERS of the codes, so a new stable
code is published by its owner and never by a hand list. A path, a database
name, a credential, a key, an exception name and an exception message are
never a final code and never a public detail.

## J4 — the retention digests are a set

Owner: `scripts/stage_b_b5_3/lib/retention_ledger.mjs`.

| Case | Negative | Assertion |
|---|---|---|
| two byte-identical private artifacts produce ONE retention digest | — | the digest set is unique and sorted |
| the public retention validator still refuses a caller-supplied duplicate | the projection carries the same digest twice | `RETENTION_ARTIFACT_DIGEST_DUPLICATE` |

## J5 — the direct entry may not bypass the sealed preparation

| Case | Negative | Assertion |
|---|---|---|
| a direct runner entry with a B6 capture request refuses the unsealed path | the runner is invoked without a sealed snapshot | the receipt carries `B6_EXECUTION_CLOSURE_INVALID` and no external action happened |
| the sequencer refuses an invalid dependency binding BEFORE the authorization | the prepared object carries another identity | the sequencer exits nonzero and the stage root holds NO authorization marker |
