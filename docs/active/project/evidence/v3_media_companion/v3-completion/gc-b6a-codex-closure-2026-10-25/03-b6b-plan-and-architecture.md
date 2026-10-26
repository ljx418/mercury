# GC-B6B Plan And Architecture

## Goal

Produce one fresh six-source Stage B candidate with same-run private review
bundles, then perform a Provider-blind semantic review. The only positive exit
is `STAGE B IMPLEMENTATION CANDIDATE AWAITING INDEPENDENT B7`.

## Architecture

```text
explicit authorization + frozen registry + explicit environment
  -> zero-action preflight
  -> append-only stage action ledger
  -> six isolated owned source sessions, in frozen order
       -> product acquisition / transcript / comprehension
       -> durable V2.1 derivative and machine receipt
       -> read-only same-task review capture before owner cleanup
       -> private atomic bundle outside the repository (0700)
       -> public capture receipt: hashes/counts/closure only
       -> owner cleanup and owned-process audit
  -> candidate authority from the same six machine/capture receipts
  -> six blind projections, randomized review order
  -> four-axis independent review rows
  -> frozen order-3 sentinel in a second session and different position
  -> fail-closed aggregate
  -> redacted public evidence + private bundle retention/cleanup decision
  -> independent B7 checkpoint
```

The machine gate owns identity, provenance, artifact integrity, request
accounting, cleanup, and process ownership. The host evaluator owns semantic
accuracy and usefulness. Neither may substitute for the other.

## Execution plan

### B0 Stable-candidate lock

- Recheck the B6A closure manifest and current hashes.
- Refuse any product/harness change after the lock.
- Freeze registry order, sentinel order 3, rubric hash, prompt hash, and the
  randomized review order before the first external action.

### B1 Zero-action preflight

- Validate the one-use authorization id and fresh owned stage root.
- Validate explicit Cookie input without recording its value, length, or path.
- Validate owned Chrome, `--mute-audio`, ports, Runtime bootstrap, dependencies,
  Provider lock, disk/memory/time budget, and a fresh outside-repository 0700
  private review root.
- Confirm every external action counter remains zero. A failure stops here.

### B2 One fresh six-source batch

- Run exactly the six frozen primary sources in order; reserves are forbidden.
- Use separate owned Runtime/DB/profile/namespace/task/lease per source.
- Require one durable V2.1 publication and one closed private capture per
  complete source before cleanup.
- Stop on first owned leak, capture failure, privacy failure, limited/failed
  source, second blocked source, registry drift, or cross-run reuse.

### B3 Blind semantic review

- Feed only `blind_projection` output to the evaluator.
- Review all six sources in the precommitted randomized order.
- Score factual accuracy, whole-video coverage, content value/fit, and chapter
  boundary quality from 1 to 5; each axis must be at least 4.
- Record only stable critical-error codes and object indexes, never content.
- Review frozen source order 3 again in another evaluator session and another
  position. Thesis/material-claim reversal or axis drift greater than 1 fails.

### B4 Aggregate and evidence

- Derive authority only from same-run machine and capture receipts.
- Require six complete rows, critical error count zero, exact hashes and
  identity binding, positive closure counts, stable sentinel, and positive
  B-5 machine gate.
- Public evidence contains hashes, scores, codes, indexes, counts, action
  totals, and cleanup facts only. Private bundles never enter the repository.
- Generate the public manifest last and verify it after all files stabilize.

### B5 Stop state

- Positive: `STAGE B IMPLEMENTATION CANDIDATE AWAITING INDEPENDENT B7`.
- Otherwise: `GC-B6 SEMANTIC REVIEW NO-GO` with the exact failed gate.
- Never declare Stage B or V3 complete and never enter Stage C.

## Stop conditions

Stop without patching if any code or contract change is required, a private
bundle leaks into public evidence, a real source is unavailable, Provider
identity reaches the evaluator, review evidence is incomplete, cleanup is not
closed, action accounting is unknown, or the one-use authorization was already
consumed. A rerun requires a new Codex decision and a new authorization id.

