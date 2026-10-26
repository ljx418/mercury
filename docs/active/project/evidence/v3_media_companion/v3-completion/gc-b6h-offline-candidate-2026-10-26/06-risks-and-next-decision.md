# GC-B6H Risks And The Next Decision

Batch: `GC-B6H OFFLINE CORRECTION`
Date: 2026-10-26

## 1. The final state

```text
GC-B6H OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT
```

It does not authorize or schedule a visible run. B7, Stage C, Stage B PASS
and V3 PASS stay blocked.

## 2. The remaining risks

| Id | Risk | Severity | Note |
|---|---|---|---|
| R1 | The canonical rubric and prompt bytes are a PROPOSAL, not a freeze | HIGH | The Codex freezes the first exact bytes. The previous private bytes cannot be inferred from a hash and are not claimed to be restored. Until the freeze, a candidate must not run a blind review. |
| R2 | The execution closure covers the SOURCE, BUILD, CONFIG and CONTRACT bytes and the TOOL identities; the third-party dependency TREES are declared by their lockfile and their resolved versions, not copied into the snapshot | MEDIUM | The snapshot copies the candidate's own bytes; the `node_modules` and the Python virtual environment stay at their pinned identity. A dependency tree that changed without its lockfile would not be visible in the manifest. |
| R3 | The closure is verified before the first external action, after every source and at the closeout, but the runner still executes the WORKING TREE unless a snapshot is supplied | MEDIUM | The runner takes the snapshot root through `NAVIA_B6_EXECUTION_CLOSURE` for the VERIFICATION; the execution root of a future candidate must be the materialized snapshot itself. That wiring is the next candidate's responsibility. |
| R4 | The Stage A observation is a count/enum record, not a diagnosis | MEDIUM | It says that the authority did not converge, how many polls ran, how many rows were seen and which state class was observed. It does not say WHY the platform did not answer. The order-2 diagnosis still needs the product-side work. |
| R5 | The quality diagnostics record the STRUCTURE of a brief coverage failure and of a conflict, not the content | MEDIUM | The eligible claim count, the tested combinations, the region coverage, the length buckets and the stable reason are recorded. The texts, the ids and the paths are not, by design. |
| R6 | The public evidence builder is proven against synthetic receipts | MEDIUM | The negative run's receipts are the first REAL inputs. The builder must be run against them before a visible candidate, and its generated package must be compared with the negative run's public package. |
| R7 | The retention record covers the negative run's artifacts by digest | LOW | 127 digests are recorded with an owner, a deadline and a deletion-receipt requirement. The previous private review precommit is NOT preserved for reuse. A future execution must refuse the recorded digests. |
| R8 | The Stage B tree is largely UNTRACKED in git | MEDIUM | The changed-file inventory of this batch is the digest list; the git diff mixes it with the uncommitted Stage B work of the earlier batches. |
| R9 | A concurrent session is modifying the Runtime modules and the relay sources | MEDIUM | Their modifications are NOT this batch's and were not touched. The relay v11 scope digests are byte-identical to the GC-B6B proof, and the relay v11 gate is green inside the offline suite. |

## 3. What this batch established

- ONE owner per authority: the execution closure, the canonical review
  protocol, the public evidence builder, the Stage A code and diagnostic
  mapping, the quality diagnostics and the retention ledger.
- Every candidate-producing request now carries the SAME complete frozen
  invariant block, so a targeted repair can no longer regress an invariant it
  does not address. This is the correction of the GC-B6E cross-dimension
  regression.
- The Stage A failures carry stable internal codes that survive the catch and
  the finalization, and the timeout prose is derived from the constants, so
  the public account can no longer contradict the budget that produced it.
- The source identity is matched by its parsed components, so a foreign
  identity that merely contains the bvid can never be mistaken for the
  requested source.
- The public package is generated from the validated raw receipts and is
  validated against strict schemas before the manifest is signed.
- The negative run is preserved exactly as it was: an honest failed
  candidate, now with an explicit diagnosis-only retention policy.

## 4. The decisions Codex must take

1. **The checkpoint of this implementation.** Nothing else is authorized
   until the checkpoint closes.
2. **The canonical protocol byte freeze.** The rubric and the prompt bytes
   in this package are the proposal; the Codex freezes them (or replaces
   them) before any visible candidate.
3. **The snapshot execution wiring.** Whether a future candidate must
   execute the materialized snapshot itself, and how the dependency trees
   are pinned.
4. **The order-2 diagnosis.** The visible diagnostic is BLOCKED and its
   authorization is consumed. The Stage A observations now make the failure
   ATTRIBUTABLE (the poll count, the row count, the exact-match count, the
   state class and the stable code), but the product-side cause is still
   open.
5. **A visible candidate.** It requires a new Codex checkpoint and a new
   explicit authorization. This batch neither requests nor performs one.

## 5. What was NOT done

- No Chrome, no Cookie read or injection, no Provider request, no download,
  no import, no real BVID, no visible window, no media task, no blind
  review, no sentinel, no B7 and no Stage C.
- No contract, schema, threshold, registry, denominator or request-budget
  change; the eight-request bound is untouched.
- No reserve substitution, no historical-row merge, no local content
  repair and no reinterpretation of the negative run.
- No historical evidence package was edited.
- The repository was not committed, pushed, reset, cleaned, checked out or
  reverted.
