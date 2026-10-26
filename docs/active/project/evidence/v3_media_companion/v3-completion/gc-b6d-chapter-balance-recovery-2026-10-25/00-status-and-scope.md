# GC-B6D — Chapter-Balance Recovery — Status And Scope

Batch: `GC-B6D CHAPTER-BALANCE RECOVERY (OFFLINE IMPLEMENTATION)`
Date: 2026-10-25
Coordinate: V3 Chat + Know / V3-5.10 Stage B / B-5 machine gate CLOSED /
**GC-B6 SEMANTIC REVIEW NO-GO** / GC-B6C visible diagnostic CONSUMED /
GC-B6D offline implementation AUTHORIZED.

## Exit state

```text
GC-B6D OFFLINE IMPLEMENTED AWAITING CODEX CHECKPOINT
```

No visible run was requested or performed. The one GC-B6C order-2 visible
diagnostic stays consumed; B6B is not reopened; B7, Stage C, Stage B PASS
and V3 PASS stay unauthorized.

## The defect that was closed

The adapter's pre-validator (`_stage_b_temporal_candidate_valid`) checked
only the first and the last anchor plus the strict ordering. The INDEPENDENT
V2.1 validator additionally rejects a CLUSTERED chapter-start concentration
and an OVERSIZED chapter span. A candidate could therefore consume the whole
eight-request budget inside the adapter and be handed to the validator,
which refused it as `V3510B_CHAPTER_IMBALANCE` — the exact failure the
consumed GC-B6C visible diagnostic hit (8 outbound attempts, then
`V3510B_CHAPTER_IMBALANCE`, `sourceCompletion=0`, no bundle).

The regeneration the adapter asked for in that run was the TEMPORAL repair:
it never told the Provider what the balance rules were.

## What this batch changed

1. `comprehension/quality.py` is the SOLE owner of the chapter-balance
   semantics. A pure, deterministic assessment
   (`assess_chapter_balance`) and the frozen constraints
   (`chapter_balance_constraints`) were extracted from the existing
   `EvidenceSpanAnalyzer.max_start_concentration()` and
   `max_chapter_span_ratio()` logic. The independent validator now calls
   that owner; no constant and no formula is duplicated.
2. The adapter's ONE `_enforce_candidate()` loop checks the shape, the
   anchor/time contract and the chapter balance before it returns a
   candidate. `synthesize_v2()` and `repair_v2()` use that same loop.
3. A balance violation regenerates the WHOLE candidate with the SAME
   selected Provider, with the EXISTING authorized evidence index, the
   privacy-safe balance metrics and the EXPLICIT frozen constraints. The
   adapter never reorders, splits, merges, normalizes or rewrites the
   Provider's chapters.
4. The hard request bound stays `_STAGE_B_MAX_REQUESTS == 8` at the
   lowest outbound boundary: the extraction, the candidate generation, the
   shape repair, the temporal repair, the balance repair and the
   service-level repair keep sharing ONE adapter-instance budget. There is
   no second Provider instance and no fallback.
5. The independent validator stays the FINAL authority: a persistent
   imbalance keeps `V3510B_CHAPTER_IMBALANCE`, publishes nothing and writes
   an INTERNAL redacted diagnostic with the ACTUAL request count.
6. The service writes the diagnostic of the FINAL refusal, so the runner
   can retrieve the privacy-safe balance facts of that failure. No public
   endpoint was added and no content enters the public evidence.

## The contract statement

**Contract changes: none.**

No public API, event, data model, adapter contract, frozen schema,
FailureCode inventory, registry, rubric, prompt, threshold or relay scope
was changed. The new names are INTERNAL to the acceptance and the product's
private diagnostic: `assess_chapter_balance`, `chapter_balance_constraints`,
`chapter_anchors`, `substantive_region_count`, `ChapterBalanceAssessment`
and the `chapterBalance` block of the INTERNAL redacted diagnostic.

The thresholds are UNCHANGED: the concentration rule still needs six
chapters and still allows `ceil(n / 2) / n`, the span rule still needs four
chapters and still allows `0.60`, and the violation code is still
`V3510B_CHAPTER_IMBALANCE`.

## The boundaries that were preserved

- No Chrome, no visible window, no Cookie read or injection, no real Runtime
  media task, no Provider request, no download or import, no audio, no
  tabCapture, no real BVID, no B6 bundle, no blind review, no sentinel, no
  B7 and no Stage C.
- No historical evidence was edited and no authorization was consumed.
- No refreeze, no threshold reduction, no request-budget increase, no
  reserve substitution and no local semantic rewrite.
- The repository was not committed, pushed, reset, cleaned, checked out or
  reverted.
