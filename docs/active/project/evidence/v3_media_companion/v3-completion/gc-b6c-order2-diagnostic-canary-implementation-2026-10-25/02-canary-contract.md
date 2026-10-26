# GC-B6C The Canary Contract

The canary is a NON-CANDIDATE diagnostic. Its receipt ALWAYS declares:

```json
{ "candidate": false, "semanticReviewPerformed": false, "stagePass": false }
```

A receipt that claims anything else is refused by
`order2DiagnosticReceiptDefects` with `CANARY_CANDIDATE_LANGUAGE_REFUSED`.

## 1. The identity

```text
CANARY_IDENTITY_REFUSED      the order is not 2, or the bvid is not the frozen one
CANARY_RESERVE_REFUSED       the bvid is a frozen reserve source
```

Both refusals happen BEFORE any external action.

## 2. The exit codes

| Code | Meaning |
|---:|---|
| 0 | `ORDER2 DIAGNOSTIC READY FOR CODEX` |
| 1 | `ORDER2 DIAGNOSTIC BLOCKED` |
| 2 | REFUSED: the identity, the authorization or the child grant |
| 3 | CONTRACT VIOLATION: the observation set is not admissible |
| 4 | NOT EXECUTED: the offline entry validated itself and did nothing |

## 3. The authorization

The canary REUSES the authorization owner. It never consumes an
authorization in the offline mode and it never marks a grant as used. Its
`inspectAuthorizationState` is READ ONLY: it uses the owner's own
`authorizationPaths` and it can only REFUSE.

| Code | Meaning |
|---|---|
| `CANARY_AUTHORIZATION_MISSING` | no explicit one-shot authorization id |
| `CANARY_AUTHORIZATION_REPLAYED` | the consumption marker already exists |
| `CANARY_GRANT_MISSING` | the child grant was never issued |
| `CANARY_GRANT_REPLAYED` | the child grant was already consumed |
| `CANARY_GRANT_MISMATCH` | the owner refused the child grant |

The VISIBLE phase consumes EXACTLY ONE child grant: the frozen order-2
grant of ONE new authorization id. The other five grants are issued and
NEVER consumed.

## 4. The passive observations

The canary observes the product's NORMAL calls and records ONLY:

- the method (`POST`);
- the ROUTE CLASS (`materialize-visual` or `materialize`);
- the HTTP status (from the frozen status set);
- an ALLOWLISTED stable product error code.

It NEVER records a response body, a header, a token, a Cookie, a path, the
Provider identity or any text. An error code outside the allowlist is
DROPPED and the canary's own `CANARY_ERROR_CODE_NOT_ALLOWLISTED` is
recorded instead.

The canary reads the AUTHENTICATED public routes of the owned Runtime:

- `GET /v1/media/outline-tasks/{task_id}` — the terminal task state and the
  terminal failure code;
- `GET /v1/media/tasks/{task_id}/comprehension` — the evidence kind counts
  (transcript / frame / ocr_block / vision_caption);
- `GET /v1/media/tasks/{task_id}/evidence/{evidence_id}/thumbnail` — the
  PNG, confirmed by the STRICT PNG validation (`isStrictPng`: the chunk
  stream, every CRC, a valid IHDR, at least one IDAT, a terminal IEND and
  no trailing bytes). A frame ROW is never the proof of a PNG.

## 5. The capture

The canary runs the EXISTING B-6 capture. Its outcome contributes the
capture status, the capture counts and the `reviewCaptureFailureCodes` —
the STABLE codes only. The capture's `detail` (which carries the content
bearing text) is never persisted by the runner and never reaches the
canary.

In the canary mode a capture refusal is a BLOCKED diagnostic outcome, not
a crash: the source did not close, the disposition is `failed` and the
source completion accounting stays zero.

## 6. The READY criteria

`ORDER2 DIAGNOSTIC READY FOR CODEX` requires ALL of:

1. the task state is `ready`;
2. the `materialize-visual` route was ATTEMPTED (a READY claim without an
   attempted route is `CANARY_ROUTE_NOT_ATTEMPTED`);
3. at least one REAL PNG-backed frame is confirmed;
4. the capture closed with no failure code;
5. the action accounting is exact and the source completion count is ZERO;
6. every upload counter is zero;
7. the owner cleanup closed (the scratch and the profile deleted, no
   cleanup failure) and no owned process leaked.

Any violation yields `ORDER2 DIAGNOSTIC BLOCKED` with the stable codes.

## 7. What the canary may never do

- It may never call the B-5 aggregate, the B-6 aggregate, the blind
  evaluator or a sentinel. The structural check is in the acceptance
  matrix.
- It may never emit a review row, an aggregate, a sentinel or a score.
- It may never record a source completion: a diagnostic is never a
  completed candidate source.
- It may never run a child grant other than the frozen order-2 one.
