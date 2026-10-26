# GC-B6B Risks And The Next Decision

Batch: `GC-B6B FRESH CANDIDATE + BLIND SEMANTIC REVIEW`
Date: 2026-10-25

## 1. The final state

```text
GC-B6 SEMANTIC REVIEW NO-GO
```

The candidate is unreviewable and the B-5 machine gate is negative. The
blind semantic review was not performed and no score, no verdict, no
projection and no sentinel receipt exist. B7, Stage C, Stage B PASS and V3
PASS remain unauthorized.

## 2. The exact blocker

1. The order 1 / BV11t8w6oEtP review capture was refused by the production
   bundle validator: `B6_CAPTURE_BUNDLE_INVALID`.
2. The order 2 / BV1QcYx6VEAj review capture could not close the seek map:
   `B6_CAPTURE_SEEK_UNCLOSED`.
3. The order 3 was interrupted by the batch stop; the sources 4, 5 and 6
   were never attempted.

The details, the proven facts and the three statically identified candidate
causes are in `04-capture-failure-analysis.md`.

## 3. The risks

| Id | Risk | Severity | Note |
|---|---|---|---|
| R1 | The capture failure is NOT attributable from the durable evidence | HIGH | The capture adapter computes the failing closure list; the runner persists only the code. The next run would fail in the same unattributable way. The diagnostic path is a HARNESS defect and it must be closed by Codex before a new run. |
| R2 | The B-6A acceptance is not proven for REAL data | HIGH | Every B-6A case feeds a contract-shaped SYNTHETIC fixture. No B-6A case drives the capture against a real Runtime task. The two real captures of this run BOTH refused. A corrective batch must add a real-task capture case to the acceptance matrix. |
| R3 | The catalog hash of the acceptance harness is not the production algorithm | HIGH (unproven for this run) | The production sorts by (startMs, endMs, evidenceId); the harness sorts by (startMs, evidenceId). The two disagree on a same-start/different-end tie, which the real 96-record catalog can contain. |
| R4 | The bundle privacy scan covers the derived text that the B-5 privacy audit never scans | MEDIUM (unproven for this run) | A secret-like token or a path-like string in a real OCR / caption refuses the whole bundle. The B-5 privacy audit cannot see it, so the failure would look like a harness bug. |
| R5 | A `degraded` task can never be reviewed | MEDIUM | The order 2 task reached the product state `degraded` and no PNG-backed frame existed, so the seek closure could not be built. The batch needs an explicit policy: refuse a degraded task, or review it with an explicit coverage limit. |
| R6 | The hard stop leaves the interrupted source unclean | LOW (and reported) | The order 3 leaked one owned descendant and closed no cleanup. It is latched in the process audit and reported by the aggregate. The batch stop is the cause, not a product defect. |
| R7 | The authorization of this candidate is consumed | LOW (and expected) | The one-shot authorization was consumed exactly once and issued the six child grants. A rerun needs a NEW authorization id and a NEW Codex decision. |
| R8 | The raw work evidence lives outside the repository | LOW | The per-source machine receipts, the sequencer summary, the action ledger, the preflight receipt and the console log are in the owned work root, outside the repository. The public package carries the hand-written summaries only. The operator must keep the private root until B7. |
| R9 | The public evidence of this batch does not contain the raw harness output | LOW (and deliberate) | The raw files name the Provider, the Cookie source and the task namespaces. The public package carries hashes, counts, stable codes, the ledger summary and the cleanup facts only, as the batch boundary requires. |

## 4. What this batch proved that is worth keeping

- The candidate lock held: the B-6A Codex hardening digests, the three
  package manifests and the active registry all verified exactly.
- The zero-action preflight is green (34/34) with the owned roots OUTSIDE
  the historical evidence tree — the blocker of the previous B-5 attempt
  (r5) is closed.
- The B-5 machine gate is healthy on REAL data: the Provider request
  accounting is exact and known (4 and 3), the upload counters are hard
  zero, the mute-audio assertion holds, the owner cleanup closed and the
  durable V2.1 derivative was published for both completed sources.
- The `sourceCompletion` accounting of the corrected runner is ZERO when
  the capture does not close: the two completed syntheses were never
  counted as completed sources.

## 5. The decisions Codex must take, in this order

1. **The diagnostic path.** The capture failure must persist its closure
   CODES (never its content) so that a refusal is attributable. This is a
   harness change and it needs an explicit authorization.
2. **The capture against real data.** The acceptance matrix must gain a
   case that drives the capture against a REAL Runtime task, so that a
   synthetic-only acceptance can never again certify a real-data path.
3. **The catalog hash.** The harness must use the PRODUCTION algorithm
   (the same sort key and the same canonical layout) or it must call the
   production one.
4. **The derived-text privacy scan.** Decide whether the bundle refuses a
   real OCR / caption that carries a secret-like token or a path, and
   where that refusal belongs (the B-5 privacy audit, the capture, or a
   dedicated pre-capture filter).
5. **The `degraded` task policy.** Refuse it, or review it with an
   explicit coverage limit.
6. **A new authorization id and a new candidate run.** The one-shot
   authorization of this batch is consumed.

## 6. What was NOT done

- No harness, product, contract, threshold, registry, rubric, prompt or
  historical evidence was modified.
- The batch was not retried, and the remaining sources were not attempted.
- No score was invented, no threshold was lowered and no bundle was
  edited to obtain a positive conclusion.
- The repository was not committed, pushed, reset, cleaned, checked out or
  reverted.
