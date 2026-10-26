# CI2 — the publication and the exact action accounting

Oracle: `scripts/stage_b_b5_3/test/sequencer.node-test.mjs`
(31 cases, 31 pass, exit 0) and
`scripts/stage_b_b5_3/test/provider_attempt_accounting.node-test.mjs`
(5 cases, 5 pass).

## The defect that was closed

The aggregate checked only the PRESENCE of `receipt.json`. It never parsed
the mirror, never required a publication for a `complete` source, and the
`runtimeSynthesize` / `providerCall` ledger facts were reported but did not
participate in the positive verdict. A legacy stub with only the top-level
selected-provider fields still produced a positive six-source candidate.

## The mirror is PARSED

```js
// sequencer.mjs, collectSourceRows()
let mirror = null;
let mirrorParseError = null;
try {
  mirror = JSON.parse(fs.readFileSync(path.join(dir, "receipt.json"), "utf8"));
} catch (error) {
  mirrorParseError = String(error?.message ?? error).slice(0, 200);
}
```

A malformed mirror is a failure of its own (`AGG_MIRROR_INVALID`), not a
missing field.

## What a COMPLETE source must now carry

| the fact | the check | the failure |
|---|---|---|
| a nested `provider.published` | it must exist | `AGG_PUBLICATION_MISSING` |
| the FULL internal publication shape | `isRealPublication()` — every field present and typed (the identity strings, an integer `requestCount`, a numeric `latencyMs`, the three 64-hex digests, and the six upload counters) | `AGG_PUBLICATION_INVALID` |
| the mirror is parsable and reports a publication | `mirror.published === true` | `AGG_MIRROR_INVALID` / `AGG_PUBLICATION_MISSING` |
| the mirror's receipt carries the COMPLETE frozen V2.1 receipt identity | all 17 frozen fields, typed (`frozenReceiptDefects`) | `AGG_PUBLICATION_INVALID` |
| the locked Provider and endpoint | both the machine publication and the mirror receipt | `AGG_PUBLICATION_INVALID` / `AGG_MIRROR_INVALID` |
| the hard-zero upload counters | all six counters are zero, in the mirror and in the publication | `AGG_AUDIT_FAILED` |
| the TASK and the NAMESPACE | `mirror.taskId === receipt.taskId`, `mirror.taskIdNamespace === receipt.taskNamespace` | `AGG_MIRROR_INVALID` |
| the ARTIFACT hashes | `mirror.derivativeSha256` is a 64-hex digest and equals `receipt.derivativeSha256`; the machine receipt's own three digests are 64-hex | `AGG_MIRROR_INVALID` / `AGG_PUBLICATION_INVALID` |
| the publication and the mirror are the SAME receipt | every identity field and every upload counter agrees | `AGG_MIRROR_INVALID` |

The runner now writes the COMPLETE publication shape: the machine receipt's
`provider.published` carries `structureMode` and
`outboundDerivedTextSha256` next to the fields it already carried, and the
six upload counters in their frozen names.

## The exact action accounting

Two facts per source, and they must be coherent:

* `attempted.attemptCount` — the Runtime synthesize ENDPOINT invocations;
* `attempted.requestCount` — the ACTUAL outbound Provider HTTP attempts.

```js
if (attemptCount === null) → AGG_LEDGER_ACCOUNTING (no valid attempt count)
else if (attemptCount === 0) {
  // The source never reached synthesis. That is permitted ONLY for a source
  // that published nothing.
  if (disposition === "complete") → AGG_LEDGER_ACCOUNTING
  if (requestCount !== null && requestCount !== 0) → AGG_LEDGER_ACCOUNTING
} else if (requestCount === null) {
  // An ATTEMPTED synthesis with an UNKNOWN Provider HTTP count is never a
  // positive candidate.
  → AGG_LEDGER_ACCOUNTING
}
```

The permitted pre-synthesis `blocked` case is therefore EXPLICIT: zero
attempts are valid only when the source never reached synthesis (its
`attemptCount` is 0, its `requestCount` is null and it wrote no ledger
event).

## The candidate ledger totals

The sequencer feeds the CANDIDATE totals of the durable ledger into the
aggregate:

```js
candidateLedgerTotals: {
  runtimeSynthesize: Number(ledgerTotals.candidate.runtimeSynthesize ?? 0),
  providerCall: Number(ledgerTotals.candidate.providerCall ?? 0),
}
```

and the aggregate requires

```text
candidateTotals.runtimeSynthesize === Σ rows' attempted.attemptCount
candidateTotals.providerCall     === Σ rows' attempted.requestCount
```

A missing totals object is itself a failure (`AGG_LEDGER_ACCOUNTING`): the
reconciliation may never be skipped.

## The positive stubs carry real facts

Every positive stub now writes the COMPLETE, CONTRACT-SHAPED evidence through
one shared module
(`scripts/stage_b_b5_3/test/_fixtures/contract_shaped_stub.mjs`):

* the durable ledger events (`runtimeSynthesize`, `providerCall`) written
  through the PRODUCTION `appendLedgerEvent`;
* the machine receipt with the full internal publication shape and the
  attempted facts;
* the receipt mirror with the frozen V2.1 receipt identity, cross-bound to
  the task, the namespace and the derivative hash.

The oracle was NOT weakened: a stub that does not carry these facts is not a
positive candidate. The `stub_runner.mjs` of the sequencer test, the
`grant_stub_runner.mjs` of the authorization test and the sleeping runner of
the ownership test all use the shared writer.

## The negative process exits

| the mutation | the expected failure | the case |
|---|---|---|
| a complete source without a publication | `AGG_PUBLICATION_MISSING` | `CI2: a complete source without a publication exits nonzero` |
| a partial publication | `AGG_PUBLICATION_INVALID` | `CI2: a partial publication exits nonzero` |
| a malformed receipt mirror | `AGG_MIRROR_INVALID` | `CI2: a malformed receipt mirror exits nonzero` |
| a mismatched receipt mirror | `AGG_MIRROR_INVALID` | `CI2: a mismatched receipt mirror exits nonzero` |
| missing ledger events | `AGG_LEDGER_ACCOUNTING` | `CI2: missing ledger events exits nonzero` |
| a zero ledger event | `AGG_LEDGER_ACCOUNTING` | `CI2: a zero ledger event exits nonzero` |
| duplicated ledger events | `AGG_LEDGER_ACCOUNTING` | `CI2: duplicated ledger events exits nonzero` |
| an unknown Provider HTTP count | `AGG_LEDGER_ACCOUNTING` | `CI2: an unknown Provider HTTP count exits nonzero` |

Every case asserts the PROCESS EXIT (non-zero), the verdict (not positive)
and the exact failure code.

## The two defensive fixes that belong to CI2

* **The typo in `mergeMachineReceipt()`**: the second type check tested
  `previous` instead of `next`. It now tests `next`.
* **`isRealPublication()` is the full internal shape**: it used to accept
  `{ providerId, attemptId, requestCount }`. It now requires the whole
  publication shape the runner writes (the identity strings, the integer
  request count, the numeric latency, the three 64-hex digests, the finish
  reason and the six upload counters).

## The honest limits

* The publication requirements apply to a `complete` source. A `blocked`,
  `limited` or `failed` source publishes nothing and is judged by its
  attempted facts; it can never make the candidate positive anyway.
* The mirror's frozen receipt identity is checked FIELD by FIELD. The
  aggregate does not recompute the digests of the derivative: it checks that
  the digests the runner recorded are well formed and that the mirror and
  the machine receipt agree.
