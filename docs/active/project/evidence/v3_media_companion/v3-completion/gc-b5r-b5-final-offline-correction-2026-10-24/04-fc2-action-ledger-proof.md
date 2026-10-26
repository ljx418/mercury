# FC2 — the strict production action ledger

Oracles:
`scripts/stage_b_b5_3/test/action_ledger.node-test.mjs` (12 cases, 12 pass)
and `scripts/stage_b_b5_3/test/sequencer.node-test.mjs` (20 cases, 20 pass).

## The exact schema

One ledger line is one JSON object with EXACTLY these keys:

```text
schemaVersion  "v3-5.10-b5-stage-action/v1"
event          one of the 13 frozen events
count          a NON-NEGATIVE INTEGER
candidateRunId a non-empty string
at             an ISO-8601 UTC timestamp
detail         OPTIONAL; an object whose keys and values come from the frozen
               detail enums
```

The 13 events:

```text
chromeLaunch  visibleWindow  runtimeStart  providerCall  download  import
mediaTask     cookieInjection audioOutput   tabCaptureAction focusEvent
sourceAttempt sourceCompletion
```

The frozen detail enums:

```text
stage: authorization_granted, authorization_refused, chrome_launched,
       cookie_injected, owned_window_focused, runtime_started,
       synthesis_attempted, synthesis_published, task_created
```

`validateLedgerRecord` rejects: a record that is not an object, an unknown
key, a wrong schema version, an unknown event, a count that is not a
non-negative integer, a missing or empty candidate run id, an invalid
timestamp, a detail that is not an object, an unknown detail key, and a
detail value outside the frozen enum. An ARBITRARY detail object is
rejected — `appendLedgerEvent` throws instead of writing it.

## The integrity receipt

Reproduced against the real library (not a mock):

```json
{
  "intact":  { "candidate": 1, "stage": 1, "integrityOk": true,  "malformedLines": 0 },
  "damaged": { "integrityOk": false, "malformedLines": 2, "stageChromeLaunch": 1 },
  "verdictPositive": false,
  "verdictFailures": [
    { "code": "AGG_LEDGER_INTEGRITY", "detail": "the stage action ledger is not intact" }
  ]
}
```

The "damaged" ledger is an intact ledger plus ONE truncated line (`{truncated`)
plus ONE line with an unknown event. The intact lines are still counted, but
`integrityOk` becomes `false`, and the aggregate verdict can no longer be
positive: `AGG_LEDGER_INTEGRITY` is a hard failure.

## The attempt is recorded AT THE ACTION BOUNDARY

The Provider attempt is recorded BEFORE the request is sent, not after the
publication:

```text
scripts/stage_b_b5_3/run_one_bvid.mjs
  observed.providerAttemptCount = (observed.providerAttemptCount ?? 0) + 1;
  ledger.record("providerCall", 1, { stage: "synthesis_attempted" });
  const synthesizeRes = await externalMilestone("provider_rejection", () => fetch(...));
```

So a REJECTED Provider attempt is counted. The FC3 oracle proves it end to
end: the structured Runtime failure produces exactly ONE `providerCall` line
in the ledger, and the publication stays `null`.

## The four numbers the summary reports

The real sequencer writes them into `sequencer-summary.json` under
`actionLedger`:

| field | what it is |
|---|---|
| `candidateTotals` | THIS candidate run's counts only |
| `stageTotals` | the DURABLE stage-root LIFETIME counts (every run that ever used that root) |
| `historicalLowerBound` | the retained-log LOWER BOUND of the earlier attempts |
| `combinedLowerBound` | the stage lifetime total PLUS the historical lower bound |

The candidate totals and the stage totals are DIFFERENT numbers by
construction: the ledger records the candidate run id on every line and the
read splits on it (`the stage totals and the candidate totals are different
numbers`).

## The historical lower bound is 34, and it is a LOWER BOUND

The reconciliation reads the retained logs of the earlier attempts, read-only:

| retained record | kind | counted |
|---|---|---|
| `*/sequencer-console.log` (6 attempts) | console | 6+6+2+2+6+6 = 28 |
| `gc-b5r-b5-offline-corrective-2026-10-24/retained-logs/clean-run-console.log` (the final attempt) | console | 6 |
| `run/bvid-*/chrome_launch.log` (3 of the 6 sources of the final attempt) | per-source | **NOT added** |

```text
historicalLowerBound.ownedChromeLaunches = 34
```

The per-source launch records are REPORTED but NOT ADDED, because they
describe launches that the console record of the SAME attempt already
counts. Adding them would count a launch twice. The summary says so
explicitly:

```text
perSourceLaunchRecordsNotAdded: { count: 3, note: "NOT ADDED to the lower bound: ..." }
```

The proving cases are `a per-source launch record is reported but NOT added
to the bound` and `the historical retained logs give a lower bound of at least
34 launches`.

## Nothing is guessed and no path is reported

* Only the EXPLICIT launch records are counted. A log that cannot be parsed
  contributes nothing and is reported as unreadable.
* The report carries SAFE RELATIVE labels only (`gc-b5r-b5-real-run-2026-10-24/aborted-attempt-1/sequencer-console.log`).
  The test asserts that the reconciliation carries neither the completion
  root nor any `/tmp/` path.
* The historical package list is EXPLICIT (`gc-b5r-b5-real-run-`,
  `gc-b5r-b5-offline-corrective-`), so a NEW evidence package — this one
  included — can never enter the historical bound. The case `the historical
  package list is explicit` asserts that every collected entry belongs to a
  historical package.

## The honest limits

* The historical bound covers the B-5 stage packages only. The WP-B visible
  run attempts are a different workpack with their own accounting and are
  NOT counted here.
* The lower bound counts the launches that the retained logs EXPLICITLY
  record. A launch that was never recorded is not counted, which is exactly
  what a lower bound means.
