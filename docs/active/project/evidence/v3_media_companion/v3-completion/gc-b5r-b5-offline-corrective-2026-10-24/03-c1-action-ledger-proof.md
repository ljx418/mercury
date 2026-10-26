# C1 — the durable stage action ledger

## 1. What it is

`scripts/stage_b_b5_3/lib/action_ledger.mjs` owns an append-only ledger in
the runner's OWNED stage root (`NAVIA_B5_STAGE_ROOT`, or `<repo>/.navia/b5-stage`):

```
<stage root>/stage-actions.jsonl            one JSON record per line, never rewritten
<stage root>/consumed-authorizations.jsonl   the consumed one-shot identifiers
```

The runner opens the ledger **before the first external action** and finalizes
it in the `finally` path. Every record carries the event, the count, the
candidate run id and the timestamp — never a value, a secret length, a private
path or a raw payload.

## 2. The events

`chromeLaunch`, `visibleWindow`, `runtimeStart`, `providerCall`, `download`,
`import`, `mediaTask`, `cookieInjection`, `audioOutput`, `tabCaptureAction`,
`focusEvent`, `sourceAttempt`, `sourceCompletion`.

An event name outside this list is malformed: it is skipped and never
contributes to a total.

## 3. The stage totals and the candidate totals are different numbers

```js
const { stage, candidate, candidateRunIds } = readStageTotals({ stageRoot, candidateRunId });
```

* `stage` is the LIFETIME total of the whole stage.
* `candidate` is the total of ONE candidate run.
* A report may never present the candidate's counts as the stage's counts.

The case `the stage totals and the candidate totals are different numbers`
proves it: two candidate runs in one stage root produce `stage.chromeLaunch = 2`
and `candidate.chromeLaunch = 1`.

## 4. The interruption, the malformed prior ledger and the duplicate identifier

| Case | What it proves |
|---|---|
| `an interrupted process still leaves a countable ledger` | a process that dies without finalizing still leaves the counters it reached |
| `a malformed prior ledger line is skipped, not fatal` | a corrupt line and an unknown event name are counted as malformed and contribute nothing; the valid records still count |
| `a one-shot authorization identifier is consumed once` | the second consumption is refused with `authorization_already_consumed` |
| `a missing authorization identifier is refused` | no identifier, no visible run |

The runner consumes the identifier **inside** its first block, before the
Cookie inspection, before the Provider bootstrap and before the Chrome launch.
A consumed identifier therefore refuses the visible run **before Chrome**. The
case `a consumed authorization identifier refuses the visible run before
Chrome` proves the refusal end to end.

**No real authorization was created or consumed by this batch**: every offline
case uses a TEMPORARY stage root and its own identifier. The product's real
stage root is untouched.

## 5. The reconciliation of the retained logs

`reconcileRetainedLogs({ logPaths })` reads the retained console logs **read
only** and counts the EXPLICIT launch records. The result is a **lower bound**:
a log that cannot be parsed contributes nothing and the reason is reported. No
counter is ever guessed.

The result of this batch is in `01-stage-action-reconciliation.json`:

| Attempt | Explicit Chrome launches |
|---|---:|
| aborted-attempt-1 | 6 |
| aborted-attempt-2 | 6 |
| aborted-attempt-3 | 2 |
| aborted-attempt-4 | 2 |
| aborted-attempt-5 | 6 |
| diagnostic-attempt-6 | 6 |
| the clean run | 6 |
| **the stage lower bound** | **34** |

The 34 is a lower bound on the OWNED Chrome launches of the stage. The
candidate's own six are a subset of it and are never presented as the stage
total.

## 6. The zero-action proof of the offline run

The case `the offline failure run performs NO external action` asserts that
the ledger of an offline run contains the attempt and **nothing else**: no
`chromeLaunch`, no `runtimeStart`, no `cookieInjection`, no `providerCall` and
no `download`.
