# GC-B6F — Candidate Invariant Recovery — Status And Scope

Batch: `GC-B6F CANDIDATE INVARIANT RECOVERY (OFFLINE IMPLEMENTATION)`
Date: 2026-10-25
Coordinate: V3 Chat + Know / V3-5.10 Stage B / B-5 machine gate CLOSED /
**GC-B6 SEMANTIC REVIEW NO-GO** / the GC-B6E fresh order-2 confirmation
authorization CONSUMED / GC-B6F offline implementation AUTHORIZED.

## Exit state

```text
GC-B6F OFFLINE IMPLEMENTED AWAITING CODEX CHECKPOINT
```

No visible run was requested or performed. The consumed order-2
confirmation is not repeated; B6B is not reopened; B7, Stage C, Stage B
PASS and V3 PASS stay unauthorized.

## The defect that was closed

The consumed GC-B6E visible run exhausted the global eight-request bound
while the candidate REGRESSED among the dimensions:

```text
attempt 3  brief_shape
attempt 4  brief_value_domain
attempt 5  temporal (boundary / ordering)
attempt 6  brief_value_domain
attempt 7  temporal + chapter concentration
attempt 8  brief_value_domain   -> fail closed, V3510B_PROVIDER_RESPONSE_INVALID
```

The cause: every request payload repeated only a SUBSET of the frozen
candidate contract. The shape regeneration stated the shape, the temporal
repair stated the anchors, the balance regeneration stated the balance — so
a repair for one dimension silently dropped the others and the Provider
regressed into the next dimension. The run never told the Provider the
complete invariant set, and the diagnostic could not tell WHICH part of the
value domain failed.

## What this batch changed

1. **One pure owner of the complete V2.1 candidate requirements**
   (`diagnostics.py :: candidate_contract_requirements`): the exact top and
   nested key sets, every text length range, the evidence-id array shape
   and membership, the claim and chapter counts, the relation enum, the
   real boolean conflict flag, the first and the last boundary evidence,
   the strictly increasing chapter anchors and the APPLICABLE
   chapter-balance constraints.
2. **Every candidate-producing request composes that owner**: the initial
   synthesis, the shape regeneration, the temporal repair, the balance
   regeneration and `repair_v2`. A targeted request may APPEND its own
   context, but it may never replace or weaken the common block.
3. **The value-domain diagnostic is now diagnosable without content**: the
   text type, the normalized length bucket, the evidence-id container
   class, the empty and non-string item counts and the unknown-reference
   count, for the brief, the claims and the chapters.
4. **The trusted repair context**: when the rejected candidate carries the
   EXACT frozen key vocabulary and safe container types, that same
   Provider-generated authorized derivative goes back to the same selected
   Provider as repair context; when the structural trust is absent, the
   trusted partial context is kept. Nothing is normalized, reordered,
   split, merged or rewritten locally.
5. **The frozen invariants are preserved**: `_STAGE_B_MAX_REQUESTS == 8`
   at the lowest outbound boundary, one adapter instance, one
   task-locked Provider, the independent validator as the final authority.
   A persistent invalidity publishes nothing and keeps the frozen failure
   code.

## The contract statement

**Contract changes: none.**

No public API, event, data model, adapter contract, frozen schema,
FailureCode inventory, registry, rubric, prompt, threshold, denominator,
request cap or relay scope was changed. The new names are INTERNAL:
`candidate_contract_requirements`, `candidate_contract_trustworthy`,
`candidate_shape_diagnostic`'s `valueDomain` block and the
`candidateContract` key of a Provider request.

The frozen thresholds are UNCHANGED: the brief text stays 20..100
characters, a claim 8..240, a chapter name 4..80, a chapter statement
8..500, the claims 2..8, the chapters 2..12, the relation enum is the
frozen six, the conflict flag stays a real boolean, the balance rules keep
their six-chapter and four-chapter applicability and their 0.60 span
ratio, and the failure code stays `V3510B_PROVIDER_RESPONSE_INVALID` (the
service route) and `V3510B_CHAPTER_IMBALANCE` (the balance rule).

## The boundaries that were preserved

- No Chrome, no visible window, no Cookie read or injection, no real
  Runtime media task, no Provider request, no download or import, no
  audio, no tabCapture, no real BVID, no B6 bundle, no blind review, no
  sentinel, no B7 and no Stage C.
- No historical evidence was edited and no authorization was consumed.
- No contract refreeze, no threshold relaxation, no request-budget
  increase, no Provider fallback.
- The repository was not committed, pushed, reset, cleaned, checked out or
  reverted.
