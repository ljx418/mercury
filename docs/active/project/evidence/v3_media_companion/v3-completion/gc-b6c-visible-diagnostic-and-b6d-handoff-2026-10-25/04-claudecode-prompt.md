# ClaudeCode prompt: GC-B6D chapter-imbalance recovery

Implement the next authorized package in `/mnt/c/workspace/navia`.

## Status and authority

The one GC-B6C order-2 visible diagnostic has been consumed. It reached the
real product synthesis route and exhausted the global eight-request budget,
then failed closed with `V3510B_CHAPTER_IMBALANCE` before B6 capture. Do not
rerun it. This package is offline implementation only.

Read first:

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`
3. `docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
4. `docs/active/project/stage-gates/v3-media-companion.md` sections 28-29
5. This evidence package, especially `01-visible-run-receipt.json`
6. `comprehension/quality.py`, `synthesis.py`, `diagnostics.py`, and
   `service.py`

## Objective

Close the semantic gap between the adapter pre-validator and the independent
V2.1 validator. Today `_stage_b_temporal_candidate_valid()` checks only first
and last anchors plus strict ordering. The independent validator additionally
rejects clustered chapter starts and an oversized chapter span. The Provider
can therefore consume the full budget producing candidates the adapter regards
as valid but the validator rejects as `V3510B_CHAPTER_IMBALANCE`.

## Architecture

1. Keep `quality.py` as the sole owner of chapter-balance semantics. Extract a
   pure, deterministic balance assessment from the existing
   `EvidenceSpanAnalyzer.max_start_concentration()` and
   `max_chapter_span_ratio()` logic. The independent validator and adapter must
   call the same owner; do not duplicate constants or formulas.
2. The assessment may expose only structural facts needed for enforcement and
   diagnostics: chapter count, concentration, max span ratio, substantive
   region availability, and stable violation class/code. It must not expose
   titles, thesis/claim text, evidence ids, Provider identity, paths, prompts,
   responses, secrets, or raw media.
3. Extend the adapter's one `_enforce_candidate()` loop so shape, anchor/time,
   and chapter-balance violations are checked before returning a candidate.
   Both `synthesize_v2()` and `repair_v2()` must use this same loop.
4. For imbalance, regenerate the entire Provider candidate with the same
   selected Provider. Supply the existing authorized evidence index plus
   privacy-safe balance metrics and explicit frozen constraints. Do not locally
   reorder, split, merge, normalize, or rewrite Provider chapters.
5. Preserve `_STAGE_B_MAX_REQUESTS == 8` at the lowest outbound boundary.
   Extraction, candidate generation, shape repair, temporal/balance repair,
   and service repair continue sharing one adapter-instance budget. Do not add
   another Provider instance or fallback.
6. Preserve the independent validator as final authority. Persistent imbalance
   must retain `V3510B_CHAPTER_IMBALANCE`, publish nothing, and write an
   internal redacted diagnostic with actual request count.
7. Ensure the runner can retrieve the final privacy-safe diagnostic for this
   failure. Do not add a public endpoint or put content in public evidence.

## Required tests

- Exact threshold and one-over tests for both balance rules, calling the shared
  owner used by production validation.
- Initial-route and `repair_v2` parity: imbalance then valid candidate recovers
  through the same loop.
- Persistent imbalance consumes at most eight actual outbound attempts,
  returns the frozen code, and publishes no derivative.
- Mixed sequence: malformed shape, bad anchors, imbalance, then valid; all
  share one budget and preserve diagnostics.
- Privacy scan proving diagnostics contain no content, ids, Provider identity,
  path, Cookie, key, request/response body, or raw-media metadata.
- Service-level process/route test proving a recovered candidate passes the
  unchanged V2.1 validator and a terminal one leaves the previous durable
  product unchanged.
- Regression for the visible-run shape using a synthetic catalog with many
  evidence rows and clustered Provider chapter anchors. Do not use the real
  Cookie, BVID, Provider, or historical private artifact.

## Validation sequence

1. New focused Python tests.
2. Existing GC-B5R/comprehension focused tests.
3. Full Runtime `pytest tests/` once.
4. B6C focused Node tests and B6 lifecycle tests because the stable failure
   code crosses the runner boundary.
5. Full offline Stage B suite once.
6. Relay v11 baseline/mutations only if a frozen relay-scope file changed;
   otherwise prove the frozen scope hashes unchanged.
7. Secret/path/raw-media scan and owned-root/process/port cleanup audit.

## Forbidden

- No Chrome, visible window, Cookie read/injection, real Runtime media task,
  Provider request, download/import, audio, tabCapture, real BVID, B6 bundle,
  blind review, sentinel, B7, Stage C, refreeze, threshold reduction, request
  budget increase, reserve substitution, or local semantic rewrite.
- Do not edit historical evidence or consume another authorization.
- Do not commit, push, reset, clean, checkout, or revert unrelated changes.

## Stop condition and handoff

Stop at `GC-B6D OFFLINE IMPLEMENTED AWAITING CODEX CHECKPOINT`. Report changed
files, explicit contract change `none` unless unavoidable, case-to-production
oracle mapping, exact commands/exits, zero-action receipt, privacy/cleanup
results, remaining risks, and a final manifest generated after all payloads are
stable. Do not request or perform another visible run.
