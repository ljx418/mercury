# AI2 — the request count and the mirror are closed

Oracle: the AI2 process-level cases of
`scripts/stage_b_b5_3/test/sequencer.node-test.mjs` (5 cases, 5 pass).

## The defect that was closed

`frozenReceiptDefects()` accepted `requestCount === 0`, and the per-row
accounting rejected an UNKNOWN request count but not a ZERO one. A machine
receipt, a mirror and a ledger that all claimed zero therefore produced a
positive candidate.

The mirror parser also did not require
`schemaVersion === "v3-5.10-b5-3-receipt-mirror/v2"`, its wrapper key set
was not checked, and its locked selection fields were OPTIONAL conditional
checks instead of requirements.

## The request count

| the rule | the implementation |
|---|---|
| a COMPLETE publication has an integer `requestCount >= 1` | the aggregate checks the publication projection (`AGG_REQUEST_COUNT_INVALID`) and the frozen receipt identity (`frozenReceiptDefects`) |
| any `attemptCount > 0` has an integer `requestCount >= 1` | the per-row accounting: `requestCount === null` → `AGG_LEDGER_ACCOUNTING`, `requestCount < 1` → `AGG_REQUEST_COUNT_INVALID` |
| the candidate ledger totals exactly match the sums of the source facts | `evaluateAggregate({ candidateLedgerTotals })`: `runtimeSynthesize === Σ attempted.attemptCount` and `providerCall === Σ attempted.requestCount`; a MISSING totals object is itself a failure |

The permitted pre-synthesis `blocked` case stays explicit: zero attempts are
valid only when the source never reached synthesis (its `attemptCount` is 0,
its `requestCount` is null and it wrote no ledger event).

## The mirror

| the rule | the implementation |
|---|---|
| the schema version is exactly `v3-5.10-b5-3-receipt-mirror/v2` | `MIRROR_SCHEMA_VERSION` — any other value is `AGG_MIRROR_INVALID` |
| the EXACT required wrapper key set | `MIRROR_REQUIRED_KEYS` — a missing key AND an extra key are both `AGG_MIRROR_INVALID` |
| the locked Provider id is REQUIRED and exact | `mirror.selectedProviderId === "minimax-cn-openai-vision"` |
| the locked endpoint class is REQUIRED and exact | `mirror.selectedEndpointClass === "minimax_chat_completions"` |
| the provider lock is REQUIRED and exact | `mirror.providerLock === "minimax_chat_completions"` |
| the derived-text scope is REQUIRED and exact | `mirror.derivedTextScope` deep-equals `DERIVED_TEXT_SCOPE` (`transcript`, `ocr`, `vision-caption`) |

The wrapper key set is exactly these ten keys:

```text
schemaVersion  taskId  receipt  published  derivativeSha256
taskIdNamespace  providerLock  selectedProviderId  selectedEndpointClass
derivedTextScope
```

None of them is optional any more: the previous conditional checks
(`if (mirror.selectedProviderId && …)`) are gone.

## The process-level negatives

| the case | the mutation | the failure |
|---|---|---|
| `AI2: receipts and ledger that consistently claim zero requests exits nonzero` | the receipt, the mirror, the artifact and the ledger all claim zero | `AGG_REQUEST_COUNT_INVALID` (plus `AGG_ARTIFACT_INVALID` and `AGG_LEDGER_ACCOUNTING`) |
| `AI2: a mirror with the wrong schema version exits nonzero` | `schemaVersion: "wrong-schema-still-accepted"` | `AGG_MIRROR_INVALID` |
| `AI2: a mirror that lacks a required wrapper field exits nonzero` | one wrapper field is removed | `AGG_MIRROR_INVALID` |
| `AI2: a mirror that carries an extra wrapper field exits nonzero` | one unknown field is added | `AGG_MIRROR_INVALID` |
| `AI2: every required mirror wrapper field is required` | the case is run ONCE PER REQUIRED FIELD (ten cases in one test) | `AGG_MIRROR_INVALID` for every field |

## The positive control

`the positive candidate carries the publication and the exact ledger
accounting` — the same six-source batch with NO mutation exits 0, the
verdict is positive, and:

```text
actionLedger.candidateTotals.runtimeSynthesize === Σ rows' attempted.attemptCount
actionLedger.candidateTotals.providerCall     === Σ rows' attempted.requestCount
```

The negative cases are therefore meaningful: the SAME batch with ONE mutated
fact fails.

## The honest limits

* The request count is the count the Provider adapter and the Runtime
  report. The aggregate checks that the count is present, positive and
  consistent with the ledger; it cannot observe the outbound HTTP attempts
  itself (the Runtime owns them, and its internal diagnostic and receipt
  carry them).
* The mirror checks are structural: the wrapper key set, the schema
  version, the locked selection and the derived-text scope. The receipt
  INSIDE the mirror is validated against the frozen V2.1 receipt identity
  and cross-bound with the artifact.
