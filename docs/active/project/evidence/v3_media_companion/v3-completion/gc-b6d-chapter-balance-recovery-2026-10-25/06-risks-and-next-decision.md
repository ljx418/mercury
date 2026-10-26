# GC-B6D Risks And The Next Decision

Batch: `GC-B6D CHAPTER-BALANCE RECOVERY (OFFLINE IMPLEMENTATION)`
Date: 2026-10-25

## 1. The final state

```text
GC-B6D OFFLINE IMPLEMENTED AWAITING CODEX CHECKPOINT
```

No visible run was requested or performed. The GC-B6C visible diagnostic
stays consumed; B6B is not reopened; B7, Stage C, Stage B PASS and V3 PASS
stay unauthorized.

## 2. The remaining risks

| Id | Risk | Severity | Note |
|---|---|---|---|
| R1 | The adapter can now refuse a candidate the independent validator would ACCEPT | LOW (structurally closed) | The adapter and the validator call the SAME assessment (`assess_chapter_balance`) with the SAME inputs: the anchor rule is the shared `chapter_anchors`, the span is the shared evidence span, the region availability is the shared `substantive_region_count`, and the thresholds live only in `quality.py`. The adapter applies the balance only after the shape and the anchor contracts passed, so the anchors it measures are the ones the validator will measure. |
| R2 | A Provider that never rebalances still exhausts the hard bound | MEDIUM | The visible run's shape consumed all eight attempts and failed closed. The bound is UNCHANGED (8) and the failure code is UNCHANGED (`V3510B_CHAPTER_IMBALANCE`); what changed is that the Provider now RECEIVES the balance metrics and the frozen constraints instead of a temporal repair instruction. A visible run is needed to know whether the Provider complies. |
| R3 | The balance repair asks the Provider to regenerate the WHOLE candidate | MEDIUM | It carries the existing authorized evidence index, the privacy-safe balance metrics and the explicit frozen constraints. It never carries the rejected candidate and it never asks for a local rewrite. The Provider's compliance is not provable offline. |
| R4 | The service writes a NEW diagnostic stage for the final refusal of the bounded repair | LOW | The stage label `provider_bounded_repair` is a lowercase token: the runner's sanitizer keeps it. No public endpoint and no public schema changed. |
| R5 | The adapter now records ONE diagnostic per refusal | LOW | The existing GC-B5R assertions still hold (the first stage is still `initial_candidate` and the last is still `recovered`); the trail is more complete. |
| R6 | The real order-2 path is STILL unproven | HIGH | This batch is offline by authorization. The visible diagnostic that consumed the authorization is not repeated, so the real order-2 materialization failure is now ATTRIBUTABLE (the route class, the status and the allowlisted stable code are recorded) but NOT yet OBSERVED. |
| R7 | The pytest temporary roots of the last three runs are left in place | LOW | They belong to `pytest`'s own retention, they hold only synthetic test data and another session's run may share the window. |
| R8 | The Stage B tree is largely UNTRACKED in git | MEDIUM | The changed-file inventory of this batch is the digest list of `01-candidate-lock.md`; the git diff would mix this batch with the uncommitted Stage B work of the earlier batches. |
| R9 | A concurrent session is modifying the relay sources and the Runtime modules | MEDIUM | Their modifications are NOT this batch's and were not touched. The relay v11 gate is green inside the offline suite. |

## 3. What this batch proved

- The adapter and the independent validator now share ONE owner of the
  chapter-balance semantics: no threshold and no formula is duplicated, and
  the exact thresholds and their one-over are covered by the focused cases.
- The ONE enforcement loop covers the shape, the anchor/time contract and
  the balance, and BOTH routes (`synthesize_v2` and `repair_v2`) use it.
- A balance violation regenerates the WHOLE candidate with the SAME
  selected Provider, with the authorized evidence index, the privacy-safe
  metrics and the explicit frozen constraints; the adapter never rewrites the
  Provider's chapters.
- The hard bound stays at eight outbound attempts at the lowest boundary and
  every stage shares it.
- A persistent imbalance keeps `V3510B_CHAPTER_IMBALANCE`, publishes nothing
  and writes an internal redacted diagnostic with the ACTUAL request count.
- The runner retrieves the privacy-safe balance facts of that failure, and
  no content, no evidence id and no Provider identity enters the evidence.
- The full Runtime suite (1279 passed, 3 skipped), the full offline Stage B
  suite (619 passed, including the relay v11 gate), the focused GC-B5R /
  comprehension suite (173 passed) and the Node matrices (43 passed) are
  green, and the external action counters are zero.

## 4. The decisions Codex must take

1. **The checkpoint of this implementation.** Nothing else is authorized
   until the checkpoint closes.
2. **Whether a fresh visible order-2 canary is granted.** The real path is
   now attributable but not yet observed. A grant needs a NEW authorization
   id, a fresh owned stage root outside every historical evidence tree, the
   explicit Cookie input and the explicit private review root.
3. **The order-2 policy.** If the visible canary is still BLOCKED with
   `V3510B_CHAPTER_IMBALANCE`, the policy decision belongs to Codex: the
   source stays unreviewable (the current policy), or Codex decides on a
   different route. The four-axis and six-source denominators are NOT
   changed by this batch, and no text-only, five-of-six, limited, reserve
   substitution or relaxed-seek result is accepted.
4. **The B6B rerun.** It stays unauthorized until the diagnostic explains
   the order-2 path and Codex decides.

## 5. What was NOT done

- No visible run was requested or performed. No Chrome, no visible window,
  no Cookie read or injection, no real Runtime media task, no Provider
  request, no download or import, no audio, no tabCapture, no real BVID, no
  B6 bundle, no blind review, no sentinel, no B7 and no Stage C.
- No historical evidence was edited and no authorization was consumed.
- No refreeze, no threshold reduction, no request-budget increase, no
  reserve substitution and no local semantic rewrite.
- The repository was not committed, pushed, reset, cleaned, checked out or
  reverted.
