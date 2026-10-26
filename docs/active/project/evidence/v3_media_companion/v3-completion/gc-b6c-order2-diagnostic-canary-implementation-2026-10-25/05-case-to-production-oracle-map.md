# GC-B6C Case To Production Oracle Map

Every obligation maps to the PRODUCTION oracle that decides it, to the test
that drives it, to the negative case that proves the refusal, and to the
cleanup / terminal state. A test never re-implements a rule: the entry
point and the production contract decide, and the test asserts the process
exit code and the durable receipt.

## The obligations of the anti-false-green matrix

| # | Obligation | Production oracle | Driven by | Negative asserted | Terminal state |
|---|---|---|---|---|---|
| 1 | a READY observation set is accepted and the receipt is a NON-CANDIDATE | `lib/order2_canary.mjs :: validateObservations` + `order2DiagnosticVerdict` + `order2DiagnosticReceiptDefects` | the entry point, the offline mode with the fixture observations | — | the receipt declares `candidate:false`, `semanticReviewPerformed:false`, `stagePass:false`; exit 0 |
| 2 | the WRONG registry order is refused | `assertOrder2Identity` | the entry point, orders 1/3/6 | the wrong order | exit 2, `CANARY_IDENTITY_REFUSED`, no source evidence written |
| 3 | a RESERVE source is refused | `assertOrder2Identity` | the entry point with a frozen reserve bvid | the reserve | exit 2, `CANARY_RESERVE_REFUSED` |
| 4 | a SUBSTITUTED bvid is refused | `assertOrder2Identity` | the entry point with the order-1 bvid | the substitution | exit 2, `CANARY_IDENTITY_REFUSED` |
| 5 | an AUTHORIZATION REPLAY is refused | `inspectAuthorizationState` (READ ONLY, the owner's own paths) | the entry point with a synthetic consumption marker | the replay | exit 2, `CANARY_AUTHORIZATION_REPLAYED`, nothing started |
| 6 | a MISSING child grant is refused | `inspectAuthorizationState` | the entry point with an unissued grant id | the missing grant | exit 2, `CANARY_GRANT_MISSING`, nothing started |
| 6b | a REPLAYED child grant is refused | `inspectAuthorizationState` | the entry point with a used grant marker | the replay | exit 2, `CANARY_GRANT_REPLAYED` |
| 7 | a READY claim without an ATTEMPTED visual route is BLOCKED | `order2DiagnosticVerdict` | the entry point with empty visual observations | the missing route | exit 1, `CANARY_ROUTE_NOT_ATTEMPTED` |
| 8 | an UNKNOWN HTTP status is refused | `recordVisualObservation` | the entry point with status 599 | the unknown status | exit 3, `CANARY_STATUS_UNKNOWN` |
| 9 | an UN-ALLOWLISTED product code is refused | `recordVisualObservation` + `sanitizeObservedErrorCode` | the entry point with a foreign code | the unknown code | exit 3, `CANARY_ERROR_CODE_NOT_ALLOWLISTED`, and the foreign string is NEVER persisted |
| 10 | a DEGRADED task may never claim READY | `order2DiagnosticVerdict` | the entry point with the degraded state | the degraded claim | exit 1, `CANARY_TASK_NOT_READY` |
| 11 | a FABRICATED frame count is refused | `validateObservations` | the entry point with more confirmed PNGs than frame rows | the fabrication | exit 3, `CANARY_COUNT_FABRICATED` |
| 12 | a PNG route 404 leaves NO PNG-backed frame | `order2DiagnosticVerdict` | the entry point with zero confirmed PNGs | the 404 | exit 1, `CANARY_NO_PNG_BACKED_FRAME` + `CANARY_PNG_ROUTE_ERROR` |
| 13 | an INVALID PNG leaves NO PNG-backed frame | `order2DiagnosticVerdict` | the entry point with the invalid-PNG code | the bad PNG | exit 1, `CANARY_PNG_INVALID` |
| 14 | a CAPTURE that did not close is BLOCKED | `order2DiagnosticVerdict` | the entry point with a failed capture | the open capture | exit 1, `CANARY_CAPTURE_NOT_CLOSED` |
| 15 | an UNCLEANED owner is BLOCKED | `order2DiagnosticVerdict` | the entry point with an undeleted scratch | the cleanup | exit 1, `CANARY_CLEANUP_NOT_CLOSED` |
| 16 | an OWNED LEAK SIGHTING is BLOCKED | `order2DiagnosticVerdict` | the entry point with one latched sighting | the leak | exit 1, `CANARY_OWNED_LEAK` |
| 17 | a NON-ZERO upload counter is BLOCKED | `order2DiagnosticVerdict` | the entry point with a non-zero upload counter | the boundary | exit 1, `CANARY_UPLOAD_COUNTER_NOT_ZERO` |
| 18 | a COMPLETED source accounting is BLOCKED | `order2DiagnosticVerdict` | the entry point with `sourceCompletionCount = 1` | the candidate leak | exit 1, `CANARY_ACTION_ACCOUNTING_MISMATCH` |
| 19 | CANDIDATE language in the observations is refused | `validateObservations` (the forbidden-key walk) | the entry point with a `stagePass` field | the candidate language | exit 3, `CANARY_CANDIDATE_LANGUAGE_REFUSED` |
| 20 | the DEFAULT entry performs ZERO external actions | the entry point's offline branch + the ledger accounting | the entry point with no observations | the default entry | exit 4, `executed:false`, every counter zero, no source evidence, no Chrome |
| 21 | the canary never calls an aggregate, a blind evaluator or a sentinel | the source of the canary | the static structural check (a SUPPLEMENT) | the forbidden call | no `evaluateAggregate`, no `evaluateB6Aggregate`, no `buildBlindProjection`, no sentinel call |

## The composition obligations of the runner's canary mode

| # | Obligation | Production oracle | Driven by | Assertion |
|---|---|---|---|---|
| C1 | the canary mode collects the terminal state, the evidence kind counts and the strict PNG confirmation through the AUTHENTICATED routes | `run_one_bvid.mjs` (the canary block) + `lib/review_bundle.mjs :: isStrictPng` | the lifecycle composition case against the Runtime double | the observations carry the state `ready`, the kind counts and exactly one confirmed PNG |
| C2 | a diagnostic NEVER records a source completion | `run_one_bvid.mjs` (the completion suppression) | the same case | the ledger holds ZERO `sourceCompletion` records and the observation's counter is zero |
| C3 | the canary mode refuses another registry order BEFORE anything starts | `run_one_bvid.mjs` (the canary identity guard) | the lifecycle case | a non-zero exit, `CANARY_IDENTITY_REFUSED`, no evidence directory |
| C4 | the observations carry NO content, NO path and NO Provider identity | the observation schema | the same case | the serialized observations carry no `providerId`, no `modelId`, no text and no route path |

## The limitations of the matrix (declared, not hidden)

- The passive BROWSER observation (the route class / status / error code of
  the product's own materialize calls) cannot be produced offline: the
  runner observes it through the browser's response listener, and the
  offline double has no browser. The observation RECORDER is proven by the
  matrix (cases 8, 9 and 10) and the wiring is a SUPPLEMENT, not a
  composition proof.
- The VISIBLE spawn path (the canary entry starting the runner in its
  canary mode) is NOT exercised offline: the batch boundary forbids it. The
  runner's canary mode IS exercised (C1 to C4) and the entry's visible
  branch is a thin wrapper around it.
