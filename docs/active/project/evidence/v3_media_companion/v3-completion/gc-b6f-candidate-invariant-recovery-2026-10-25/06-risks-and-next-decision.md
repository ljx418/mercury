# GC-B6F Risks And The Next Decision

Batch: `GC-B6F CANDIDATE INVARIANT RECOVERY (OFFLINE IMPLEMENTATION)`
Date: 2026-10-25

## 1. The final state

```text
GC-B6F OFFLINE IMPLEMENTED AWAITING CODEX CHECKPOINT
```

No visible run was requested or performed. The consumed order-2
confirmation is not repeated; B6B is not reopened; B7, Stage C, Stage B
PASS and V3 PASS stay unauthorized.

## 2. The remaining risks

| Id | Risk | Severity | Note |
|---|---|---|---|
| R1 | The Provider's compliance with the COMPLETE invariant block is NOT provable offline | HIGH | The block now states every frozen invariant in every request, but only a visible run can show that the Provider stops regressing across the dimensions. The GC-B6E trace proves the regression; this batch removes the CAUSE (a partial contract) and cannot prove the EFFECT (the Provider's compliance). |
| R2 | The repair context semantics CHANGED | MEDIUM | The trusted rejected candidate is now the primary repair context and the extracted partial context is the fallback. The two superseded FC4 assertions were updated with their intent preserved. The Codex checkpoint must confirm that the Provider's own derivative is the better repair context than the extraction partials. |
| R3 | The count-unknown balance statement is a CONDITIONAL rule | MEDIUM | A request whose chapter count is unknown (the initial generation) states the balance rules together with their applicability condition; a request with a known count states only the rules that apply (the GC-B6D precision correction is preserved for the balance repair). The initial generation therefore carries a conditional statement the Codex precision fix did not want in a KNOWN-count request. |
| R4 | The value-domain diagnostic is now RICHER and the runner's sanitizer had to grow | MEDIUM | The runner's diagnostic sanitizer (the GC-B6D Major 1 fix) projects only allowlisted keys. The new value-domain keys, number keys, array keys and enums were added explicitly. A new unknown key in the diagnostic is still DROPPED, and the new cases prove it. |
| R5 | The trusted-candidate repair context carries the Provider's own (possibly value-broken) text back to the Provider | LOW | The context is the Provider's own authorized derivative; it is inside the authorized derivation boundary and it is never published. The structural trust is about the KEY VOCABULARY and the CONTAINER TYPES only. |
| R6 | The Stage B tree is largely UNTRACKED in git | MEDIUM | The changed-file inventory of this batch is the digest list of `01-candidate-lock.md`; the git diff would mix this batch with the uncommitted Stage B work of the earlier batches. |
| R7 | A concurrent session is modifying the relay sources and the Runtime modules | MEDIUM | Their modifications are NOT this batch's and were not touched. The relay v11 gate is green inside the offline suite. |
| R8 | The pytest temporary roots of the last three runs are left in place | LOW | They belong to `pytest`'s own retention and they hold only synthetic test data. |

## 3. What this batch proved

- There is now ONE pure owner of the complete frozen V2.1 candidate
  requirements, and every candidate-producing request composes it: the
  initial synthesis, the shape regeneration, the temporal repair, the
  balance regeneration and `repair_v2`. The table test proves the block is
  present EXACTLY once in every one of them and that a targeted
  instruction cannot shadow it.
- A value-domain failure is diagnosable without content: the text type,
  the normalized length bucket, the evidence-id container class, the empty
  and non-string item counts and the unknown-reference count, for the
  brief, the claims and the chapters. The privacy cases prove that no
  text, no evidence id, no Provider identity, no path, no request or
  response body ever enters the diagnostic, and the runner boundary proves
  that the facts survive the sanitizer while the forbidden values do not.
- The observed real trace CONVERGES inside the same budget with NO local
  mutation: the accepted candidate is the Provider's last candidate byte
  for byte.
- The same sequence that never converges fails closed at the bound, keeps
  the frozen code, publishes NOTHING and leaves the previous durable
  product byte-identical.
- The trust decision is structural: a value defect keeps the trust, an
  unknown key, an invalid container type or a missing key break it, and an
  untrusted candidate never goes back to the Provider.
- The hard request bound, the single adapter instance, the single
  task-locked Provider and the independent validator's authority are
  unchanged.

## 4. The decisions Codex must take

1. **The checkpoint of this implementation.** Nothing else is authorized
   until the checkpoint closes.
2. **The two superseded FC4 assertions.** The repair-context contract
   changed; the Codex must confirm the new semantics and the updated
   assertions.
3. **The conditional balance statement of the count-unknown requests**
   (R3): the Codex must confirm that the initial generation may state the
   balance rules with their applicability condition.
4. **A fresh visible order-2 confirmation.** It needs a NEW authorization
   id, a fresh owned stage root outside every historical evidence tree, the
   explicit Cookie input and the explicit private review root. Its result
   is a diagnostic outcome, NOT a B6B authorization: a fresh six-source
   B6B run still needs its own Codex decision.
5. **The B6B rerun.** It stays unauthorized until the diagnostic shows
   that the candidate no longer regresses across the dimensions.

## 5. What was NOT done

- No visible run was requested or performed. No Chrome, no visible window,
  no Cookie read or injection, no real Runtime media task, no Provider
  request, no download or import, no audio, no tabCapture, no real BVID, no
  B6 bundle, no blind review, no sentinel, no B7 and no Stage C.
- No historical evidence was edited and no authorization was consumed.
- No contract refreeze, no threshold relaxation, no request-budget
  increase and no Provider fallback.
- The repository was not committed, pushed, reset, cleaned, checked out or
  reverted.
