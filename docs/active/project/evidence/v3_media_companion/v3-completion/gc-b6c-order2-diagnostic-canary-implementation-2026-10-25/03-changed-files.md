# GC-B6C Changed Files

Batch: `GC-B6C ORDER-2 DIAGNOSTIC CANARY IMPLEMENTATION`

Six files. All of them are inside the acceptance harness
(`scripts/stage_b_b5_3/`). No product code, no contract, no threshold, no
registry, no rubric, no prompt and no historical evidence was touched.

## 1. The new files

| File | Lines | Role |
|---|---:|---|
| `lib/order2_canary.mjs` | 553 | the PURE contract: the identity guard, the observation recorder, the error-code allowlist, the admissibility check, the verdict, the non-candidate receipt, the anti-candidate guard, the read-only authorization inspection |
| `order2_diagnostic_canary.mjs` | 363 | the entry point: the offline mode (zero external actions) and the visible mode (one order-2 child grant, the existing runner in its canary mode, the owned process audit) |
| `test/b6c_order2_canary.node-test.mjs` | 506 | the anti-false-green matrix: 21 process-level cases that drive the REAL entry point |
| `test/_fixtures/order2_observations_fixture.mjs` | 69 | the observation fixtures: counts, a state and stable codes only |

## 2. The changed files

### `run_one_bvid.mjs` — the canary MODE of the existing owner

The default behaviour is untouched. The mode is enabled ONLY by
`--canary=order2-diagnostic`:

| Addition | Line | Why |
|---|---|---|
| the identity guard | 119 | the canary may only diagnose the frozen order 2, and it refuses before anything starts |
| the passive observation | 1097 | the product's own `materialize-visual` / `materialize` calls are observed passively: the route class, the status and an allowlisted stable code. The body is read ONLY to extract that code and it is never stored |
| the capture refusal | 1580 | in the canary mode a capture refusal is a BLOCKED diagnostic outcome (the disposition is `failed`), not a crash of the owner |
| the authenticated route reads | 1605 | the terminal task state, the evidence kind counts and the strict PNG confirmation, all through the AUTHENTICATED public routes of the OWNED Runtime |
| the completion suppression | 1705 | a diagnostic NEVER records a `sourceCompletion`: it is never a completed candidate source |
| the observations file | 1806 | written in the `finally` path, so the OWNER cleanup facts are part of it |

### `test/b6_lifecycle.node-test.mjs` — the canary COMPOSITION cases

The seven existing obligations are UNCHANGED. The additions:

- the Runtime double accepts the bvid and the source identity (the canary
  drives the order-2 identity) and serves the AUTHENTICATED task state
  route;
- `driveRunner` accepts the registry order and the canary flag;
- two new cases: the canary mode writes its observations and never counts a
  completed source; the canary mode refuses another registry order before
  anything starts.

## 3. The files this batch did NOT touch

The capture contract, the capture transaction, the catalog closure, the
diagnostic codes, the audit finalizer, the Runtime composition fixture, the
aggregates, the blind projection, the registry, the preflight and the
sequencer are all UNCHANGED (their digests are in `01-candidate-lock.md`).
