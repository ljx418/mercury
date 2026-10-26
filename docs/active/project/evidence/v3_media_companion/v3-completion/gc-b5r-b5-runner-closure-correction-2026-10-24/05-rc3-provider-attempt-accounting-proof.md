# RC3 — the ACTUAL outbound Provider HTTP attempts are counted

Oracles:
`scripts/stage_b_b5_3/test/provider_attempt_accounting.node-test.mjs`
(5 cases, 5 pass) and the three RC3 cases of
`services/local-runtime/tests/test_v3_gc_b5r_final_offline_correction.py`
(3 cases, 3 pass).

## The three facts that are now separated

| fact | where it lives | the old (wrong) value |
|---|---|---|
| the Runtime synthesize ENDPOINT invocation | the ledger event `runtimeSynthesize` and `provider.attempted.attemptCount` | — |
| the ACTUAL outbound Provider HTTP attempts | the ledger event `providerCall` and `provider.attempted.requestCount` | the ledger recorded ONE per endpoint invocation |
| the successful publication and its receipt request count | `provider.published` (null when nothing was published) | — |

Before this batch the runner recorded `providerCall = 1` for every synthesize
endpoint invocation, whatever the Provider actually did. The stage total was
therefore the number of endpoint calls, not the number of outbound attempts.

## Who owns the count

The count is owned by the PRODUCTION ADAPTER and it travels through two
channels that already existed:

* on the SUCCESS path: the published V2.1 receipt (`receipt.requestCount`),
  which the Runtime derives from the adapter's own attempt counter;
* on the FAILURE path: the Runtime's INTERNAL diagnostic
  (`<private>/diagnostics/<taskId>/stage-b-diagnostic.json`), which now
  carries `providerOutboundHttpAttempts`.

No public endpoint was added. The diagnostic is a PRIVATE file that the
Runtime already wrote; it now carries one more INTEGER.

The adapter counts every attempt AT THE REQUEST BOUNDARY:

```python
def _complete_once(self, user_payload, *, system_prompt=..., temperature=...):
    self._guard_request_budget()
    user_bytes = _canonical(user_payload)
    self._requests.append(user_bytes)     # ← the boundary
    ...
    response = client.post(...)
```

so a timeout, a malformed response, a regeneration and a terminal rejection
are ALL counted. The adapter exposes the count:

```python
@property
def provider_outbound_http_attempts(self) -> int:
    return len(self._requests)
```

The service writes it into the diagnostic on the adapter's failure path
(`stage="provider_attempt"`), and the runner reads it back.

## What the runner records

```text
ledger.record("runtimeSynthesize", 1, { stage: "synthesis_invoked" })   # the endpoint call
ledger.record("providerCall", N,      { stage: "provider_attempted" })  # the actual attempts
```

`N` comes from the Runtime. It is NEVER derived from the number of endpoint
invocations, and it is never guessed.

## The proving cases

| case | the shape | the assertion |
|---|---|---|
| a successful synthesis with N=3 | the Runtime publishes a derivative whose receipt carries 3 attempts | `runtimeSynthesize = 1`, `providerCall = 3`, `attempted.attemptCount = 1`, `attempted.requestCount = 3`, `published.requestCount = 3` |
| a successful synthesis with N=1 | the same, one attempt | `providerCall = 1`, `attempted.requestCount = 1`, `published.requestCount = 1` |
| a REJECTED synthesis with 3 attempts | the Runtime refuses and its diagnostic carries 3 | `providerCall = 3`, `attempted.requestCount = 3`, `published = null`, `disposition = failed` |
| a REJECTED synthesis with 8 attempts | the same, at the hard cap | `providerCall = 8`, `attempted.requestCount = 8`, `published = null` |
| the candidate and the stage totals are EXACT | one candidate run in a fresh stage root | the candidate total = 3, the stage total = 3, and EXACTLY ONE `providerCall` line |

The Python side proves the count itself:

* `test_rc3_the_adapter_counts_every_outbound_attempt` — the extraction and
  the candidate generation are two outbound attempts, and the adapter's
  counter says 2.
* `test_rc3_a_regeneration_is_counted_as_an_outbound_attempt` — the
  extraction, the candidate and the regeneration are three attempts.
* `test_rc3_the_service_diagnostic_carries_the_outbound_attempt_count` — the
  PRODUCTION service writes the count into the diagnostic, and the
  diagnostic carries a COUNT only (no response text, no prompt, no evidence
  id, no path, no secret).

## The publication stays null on failure

Every rejected case asserts `provider.published === null`: a rejection never
publishes and never fabricates a receipt. The RC2 merge reinforces it: a
publication that does not carry the whole identity of a real publication is
refused.

## The reconciliation without double counting

* The ledger is append-only and every line carries the candidate run id.
  The candidate total and the stage lifetime total are read separately, so
  one candidate run never inflates the other.
* The machine receipt carries the FINAL run's attempt count (the RC2 rule),
  so a retry does not ADD the previous run's count to the current one.
* The runner records exactly ONE `providerCall` line per run, with the count
  as the line's `count` — the count is a count, not a line per attempt.

## The honest limits

* When the Runtime reports NOTHING (no receipt and no diagnostic), the
  runner records NO `providerCall` line and the receipt's
  `attempted.requestCount` stays `null`. The runner never invents a count;
  an unreported attempt set is visible as a missing count, not as a zero
  that claims "no attempt happened".
* The count is the number of OUTBOUND HTTP attempts of the adapter. It does
  not count the Runtime's own internal work (the chunk extraction is an
  outbound attempt and IS counted, because it goes to the Provider).
* The offline Runtime double simulates the production Runtime's internal
  diagnostic. The production side of the chain is proven by the Python
  cases; the runner side by the Node cases.
