# FC5 — the real global Provider request cap

Oracle:
`services/local-runtime/tests/test_v3_gc_b5r_final_offline_correction.py`
(6 FC5 cases) and the pre-existing
`test_c4_the_request_bound_is_hard_and_exposed`.

## The cap

```python
_STAGE_B_MAX_REQUESTS = 8
```

It is a property of ONE ADAPTER INSTANCE, and it is exposed:
`provider.request_bound == 8`.

## Where the cap is enforced

The cap is checked in the LOWEST COMMON send path, IMMEDIATELY before every
outbound HTTP attempt:

```python
# MiniMaxGroundedSynthesisProvider._complete_once
self._guard_request_budget()      # <-- immediately before the append + POST
user_bytes = _canonical(user_payload)
self._requests.append(user_bytes)
...
response = client.post(...)

# DeepSeekStrictGroundedSynthesisProvider._complete_once
self._guard_request_budget()
user_bytes = _canonical(user_payload)
self._requests.append(user_bytes)
...
response = client.post(...)
```

`_complete` — the shared send path of both adapters — checks the budget
again before each retry, so a RETRY after a timeout, a malformed JSON or an
invalid response counts against the SAME cap.

`_guard_request_budget` raises the frozen failure code
`V352_SYNTHESIS_RESPONSE_INVALID` with HTTP status 502 when the budget is
exhausted.

## ONE cap for the whole route

Every outbound attempt of the adapter instance appends one entry to
`self._requests`, so the following all share ONE budget:

1. the initial chunk extraction,
2. the candidate generation,
3. the shape regeneration,
4. the temporal repair,
5. the service-level `repair_v2` (the same adapter instance),
6. every transport retry of any of the above.

The receipt reports the same number: `receipt.request_count == len(self._requests)`.

## The cap-boundary cases

The tests start at **cap - 1** (seven recorded attempts) and then inject a
failure:

| case | injected fault | the client is called | the recorded attempts |
|---|---|---|---|
| `test_fc5_a_timeout_at_the_cap_boundary_calls_the_client_once_more` | `httpx.TimeoutException` | at most ONCE more (`len(calls) == 1`) | `≤ 8` |
| `test_fc5_a_malformed_response_at_the_cap_boundary_calls_the_client_once_more` | a non-JSON content | at most ONCE more (`len(calls) == 1`) | `≤ 8` |
| `test_fc5_the_retries_of_one_request_count_against_the_same_cap` | a timeout | `≤ 1` | `≤ 8` |

The transport retry of a single request can therefore never push the adapter
past the cap: the retry is refused by the budget check BEFORE the second
HTTP attempt.

## The composition case

`test_fc5_the_initial_route_and_the_service_repair_share_one_cap`:

```text
synthesize_v2  → extraction (1) + candidate (2) + shape regeneration (3)
repair_v2      → 4, 5, 6, 7, 8  → the cap is exhausted
```

The final state is `len(provider._requests) == 8` exactly, and the raised
error is the frozen `V352_SYNTHESIS_RESPONSE_INVALID`. The initial route and
the service-level repair demonstrably share ONE budget: the repair could not
start a ninth attempt.

## The exhaustion preserves the frozen code and publishes nothing

`test_fc5_exceeding_the_cap_publishes_nothing`:

* the raised code is `V352_SYNTHESIS_RESPONSE_INVALID` (the frozen code),
* the status is 502,
* the recorded attempts are exactly 8,
* the diagnostic's final outcome is `fail_closed`,
* NO candidate is returned: the exception propagates, so nothing can be
  published and the Runtime never receives a derivative.

## The honest limits

* The cap is per ADAPTER INSTANCE, not per task store or per process. Two
  adapters in one process would each have their own budget; in the product
  the adapter is created per synthesis, so the bound holds per synthesis.
* The budget counts ATTEMPTS, not successes. A request that times out
  consumes one unit, which is the intended behaviour: the point of the cap
  is to bound the number of outbound HTTP attempts, not the number of
  answers.
* The chunk extraction shares the cap. With a large evidence catalog the
  extraction can consume several units before the candidate generation
  starts; when the budget is exhausted the synthesis fails closed with the
  frozen code. That is the designed trade-off of a GLOBAL cap.
