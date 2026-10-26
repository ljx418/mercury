# GC-B6B Owned Process And Cleanup Audit

Batch: `GC-B6B FRESH CANDIDATE + BLIND SEMANTIC REVIEW`
Run id: `gc-b6b-20261025T061036Z`

## 1. The owned process audit

```text
leakedBefore          0
leakedAfter           1
stillAliveAtCloseout  0
killedOwnedPids       1
```

The single latched sighting belongs to the order 3 / BV1v58B6GEan, the
source that the batch stop interrupted with a SIGKILL: its owned descendant
survived the interrupted source runner and was killed by the close-out
audit. A sighting is LATCHED: it is never cleared by a later exit, and it
is reported as a leak of the source that produced it.

The two COMPLETED sources leaked nothing.

## 2. The cleanup facts

| Source | Runtime scratch deleted | Profile root deleted | Cleanup failure |
|---|---|---|---|
| order 1 / BV11t8w6oEtP | true | true | none |
| order 2 / BV1QcYx6VEAj | true | true | none |
| order 3 / BV1v58B6GEan | false (the source was SIGKILLed by the batch stop) | false (the same) | the source produced no cleanup receipt |

The B-5 aggregate therefore reports `AGG_AUDIT_FAILED` for the order 3: it
leaked an owned process and it did not clean its resources. This is the
exact consequence of the hard stop and it is reported, not smoothed.

## 3. The owned resources of this batch after the stop

```text
$ ps -eo pid,etime,cmd | grep -E "sequencer.mjs|run_one_bvid" | grep -v grep
(no output)

$ ps -eo pid,etime,cmd | grep -E "navia_runtime|uvicorn" | grep -v grep
(no output)
```

No owned sequencer, no owned runner, no owned Runtime and no owned Chrome
of this batch survived the stop. The close-out audit reports
`stillAliveAtCloseout: 0` and the one latched owned descendant was killed.

The Chrome processes that are visible on the machine belong to OTHER
concurrent sessions (they are headless shells with a different profile and
a different launch line). They are NOT owned by this batch and they were
not touched.

## 4. The private review root

```text
$ ls -A <the private review root>
review-protocol
```

There is NO private bundle: both captures were refused before they wrote
anything (the production capture validates before it writes). The private
root holds the frozen rubric, the frozen prompt and the review
precommitment, and nothing else.

The private root is outside the repository and its mode is 0700. It is
retained for B7 together with the raw work evidence.

## 5. The owned work evidence root

The raw harness artifacts (the per-source machine receipts, the sequencer
summary, the action ledger, the preflight receipt and the runner console
log) stay in the OWNED WORK ROOT, which is outside the repository and
outside the public evidence tree. They are NOT copied into the public
evidence package: the public package carries the hand-written summaries
(hashes, counts, stable codes, the ledger summary and the cleanup facts)
only, because the raw harness files name the Provider, the Cookie source
and the task namespaces.

The raw artifacts are handed back to the operator with their private
location, so that B7 can verify every number of this report against them.

## 6. The repository and the evidence tree

- This batch wrote NOTHING into the product, the harness, the contracts,
  the thresholds, the registry, the rubric, the prompt or the historical
  evidence.
- This batch did not commit, push, reset, clean, check out or revert.
- The public evidence package is the only repository change of this batch.
