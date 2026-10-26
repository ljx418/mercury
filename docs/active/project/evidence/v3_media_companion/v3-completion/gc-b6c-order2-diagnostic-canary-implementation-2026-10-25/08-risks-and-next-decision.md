# GC-B6C Risks And The Next Decision

Batch: `GC-B6C ORDER-2 DIAGNOSTIC CANARY IMPLEMENTATION`
Date: 2026-10-25

## 1. The final state

```text
GC-B6C ORDER-2 DIAGNOSTIC CANARY IMPLEMENTED AWAITING CODEX CHECKPOINT
```

The canary was NOT executed. B6B stays NO-GO; B7 / Stage C / Stage B PASS /
V3 PASS stay unauthorized.

## 2. The remaining risks

| Id | Risk | Severity | Note |
|---|---|---|---|
| R1 | The VISIBLE spawn path of the canary is NOT exercised offline | HIGH | The batch boundary forbids it (no Chrome, no Runtime, no new authorization). The runner's canary mode IS exercised against the Runtime double (the composition cases C1 to C4) and the entry's visible branch is a thin wrapper around it, but the wiring between the entry and the runner is a code review, not a test. |
| R2 | The PASSIVE browser observation is not a composition proof | MEDIUM | The product's own `materialize-visual` / `materialize` calls are observed through the browser's response listener. The recorder is proven by the matrix (the unknown status, the un-allowlisted code and the degraded claim), but the LISTENER wiring can only be proven by a visible run. |
| R3 | The `degraded` order-2 task may be a PRODUCT condition and not a harness defect | MEDIUM | The canary is designed to make it ATTRIBUTABLE: the route class, the HTTP status and the allowlisted stable error code of the visual materialization, the terminal task state and the evidence kind counts. Whether the cause is the visual pipeline, the credential lease or the source is exactly what the visible run must determine. |
| R4 | The canary's error-code allowlist is a FROZEN list of the product's media-companion codes | LOW | A code outside the allowlist is dropped and the canary's own `CANARY_ERROR_CODE_NOT_ALLOWLISTED` is recorded instead. If the product adds a code, the canary reports the refusal instead of the code — a safe failure, and a visible run would surface the gap. |
| R5 | The `scripts/stage_b_b5_3/` tree is UNTRACKED in git | MEDIUM | The digests in `01-candidate-lock.md` are the only baseline of this batch. The Codex-hardened files were re-hashed and five of the seven are byte-identical; two changed here (the runner's canary mode and the lifecycle composition cases). |
| R6 | The `run_one_bvid.mjs` change touches the B-5 owner | MEDIUM | The change is additive and mode-gated: without `--canary=order2-diagnostic` the runner is byte-for-byte the same behaviour, and the full offline suite (608/608) proves it. The Codex checkpoint must confirm that reading. |
| R7 | The observations file is written in the runner's `finally` path | LOW | A crash before the observations are collected leaves the file absent, and the canary refuses with `CANARY_OBSERVATIONS_MISSING` rather than inventing an observation. |
| R8 | The canary's receipt carries the task id and the bvid | LOW | Both are object indexes of the frozen registry, not content. The receipt carries no text, no byte, no path, no credential and no Provider identity. |

## 3. What this batch proved

- The candidate lock held: both frozen package manifests verify, five of the
  seven Codex-hardened files are byte-identical and the two that changed are
  the additive canary mode and its composition cases.
- The canary is a NON-CANDIDATE by construction: its receipt declares
  `candidate:false`, `semanticReviewPerformed:false` and `stagePass:false`,
  and a receipt that claims otherwise is refused.
- The canary's refusals happen BEFORE any external action: the wrong
  order, the reserve, the substituted bvid, the authorization replay, the
  missing grant and the replayed grant are all refused with a stable code
  and with nothing started.
- The diagnostic outcomes are fail-closed: a missing route attempt, a
  degraded task, a missing PNG, an open capture, an unclean owner, a
  latched leak, a non-zero upload counter and a completed source accounting
  all yield BLOCKED.
- The fabricated and un-admissible inputs are refused as contract
  violations, never silently blocked.
- The default entry performs ZERO external actions.
- The full offline Stage B suite is 608/608, the relevant Runtime suite is
  50/50, the whitespace gate is clean, the scan is zero and the owned
  residue is zero.

## 4. The decisions Codex must take

1. **The checkpoint of this implementation.** Nothing else is authorized
   until the checkpoint closes.
2. **The visible canary run.** It needs a fresh one-use authorization id,
   a fresh owned stage root OUTSIDE every historical evidence tree, the
   product's own Cookie input and the explicit private review root. Its
   result is `ORDER2 DIAGNOSTIC READY FOR CODEX` or
   `ORDER2 DIAGNOSTIC BLOCKED` with stable codes — and NEITHER authorizes a
   full B6B rerun by itself.
3. **The order-2 policy.** If the visible canary is BLOCKED with a
   `degraded` task and no PNG-backed frame, the policy decision belongs to
   Codex: the source stays unreviewable (the current policy) or a Codex
   decision changes the review plan. The B-6 four-axis and six-source
   denominators are NOT changed by this batch.
4. **The B6B rerun.** It stays unauthorized until the diagnostic explains
   the order-2 path and Codex decides.

## 5. What was NOT done

- The canary was NOT executed. No Chrome, no Runtime, no Provider call, no
  Cookie read, no download, no real BVID, no new authorization and no B-6
  blind review.
- No harness contract, threshold, registry, rubric, prompt or historical
  evidence was modified.
- No score, verdict or aggregate was invented, and no threshold was
  lowered.
- The repository was not committed, pushed, reset, cleaned, checked out or
  reverted.
