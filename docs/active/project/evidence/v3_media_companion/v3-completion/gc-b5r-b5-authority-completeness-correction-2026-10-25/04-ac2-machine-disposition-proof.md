# AC2 — the machine disposition is mandatory

Oracles: the AC2 cases of
`scripts/stage_b_b5_3/test/aggregate_identity.node-test.mjs` and the AC2
process-level cases of `scripts/stage_b_b5_3/test/sequencer.node-test.mjs`.

## The defect that was closed

The aggregate compared the machine disposition only inside a conditional:

```js
if (receipt?.disposition !== undefined && receipt?.disposition !== null) {
  // compare
}
```

Deleting `disposition` from all six otherwise valid receipts therefore
DISABLED the comparison. The Codex reproduced it:
`{"missingDispositionPositive":true,"failures":[]}`.

## The closure

`disposition` is now part of the explicit machine TERMINAL shape:

```js
export const MACHINE_TERMINAL_FIELDS = Object.freeze(["disposition"]);
export const MACHINE_DISPOSITIONS = Object.freeze(["complete", "limited", "blocked", "failed"]);
```

The shape and the comparison are two explicit functions:

```js
// the SHAPE: missing, null, a wrong type, an unknown value
export function machineTerminalDefects(receipt) { … }

// the COMPARISON: the machine disposition against the parsed final disposition
export function machineDispositionMismatch(receipt, parsedDisposition) { … }
```

and the aggregate applies BOTH to every row that carries a machine receipt:

```js
for (const defect of machineTerminalDefects(receipt)) {
  failures.push(fail(AGGREGATE_FAILURE.MACHINE_TERMINAL_INVALID, `${label} ${defect}`));
}
const dispositionMismatch = machineDispositionMismatch(receipt, disposition);
if (dispositionMismatch) {
  failures.push(fail(AGGREGATE_FAILURE.QUALITY_DISPOSITION_MISMATCH, `${label} ${dispositionMismatch}`));
}
```

A missing disposition never disables the comparison: the shape defect is
reported instead, and the candidate is refused.

## The preserved rules

* The shared PRODUCTION quality mapping is untouched
  (`QUALITY_STATUS_TO_DISPOSITION` in `lib/contracts.mjs`):
  `complete → complete`, `limited → limited`, `rejected → failed`.
* The artifact quality must still map to the parsed disposition.
* A complete artifact must still carry an EMPTY `quality.failureCodes`.
* The publication presence rules are untouched.

## The negatives

### The pure aggregate cases

| the case | the failure |
|---|---|
| `AC2: a MISSING disposition is not a positive candidate` | `AGG_MACHINE_TERMINAL_INVALID` |
| `AC2: a NULL disposition is not a positive candidate` | `AGG_MACHINE_TERMINAL_INVALID` |
| `AC2: a WRONG-TYPE disposition is not a positive candidate` | `AGG_MACHINE_TERMINAL_INVALID` |
| `AC2: an UNKNOWN disposition is not a positive candidate` | `AGG_MACHINE_TERMINAL_INVALID` |
| `AC2: a MISMATCHED machine disposition is not a positive candidate` | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `AC2: the disposition of EVERY source is required, not only of one` | six `AGG_MACHINE_TERMINAL_INVALID` failures |

### The process-level cases (the REAL sequencer)

| the case | the failure |
|---|---|
| `AC2: a missing machine disposition exits nonzero` | `AGG_MACHINE_TERMINAL_INVALID` |
| `AC2: a null machine disposition exits nonzero` | `AGG_MACHINE_TERMINAL_INVALID` |
| `AC2: a wrong-type machine disposition exits nonzero` | `AGG_MACHINE_TERMINAL_INVALID` |
| `AC2: an unknown machine disposition exits nonzero` | `AGG_MACHINE_TERMINAL_INVALID` |
| `AC2: a mismatched machine disposition exits nonzero` | `AGG_QUALITY_DISPOSITION_MISMATCH` |

The semantic tests RECOMPUTE the artifact hashes, so the refusal proves the
semantic binding and not an incidental hash mismatch.

## The direct validator cases

`AC2: the disposition is a REQUIRED, typed terminal field` and
`AC2: the machine disposition is compared with the parsed final disposition`
in `machine_identity.node-test.mjs` prove the two functions themselves.

## The honest limits

* The machine disposition is compared with the PARSED
  `final_disposition.txt`. The sequencer may still correct a row's
  disposition to `failed` when the disposition file is missing — in that case
  the machine receipt and the corrected row disagree, which is reported as a
  mismatch on an already failing batch.
* The disposition vocabulary is the four frozen dispositions. A value outside
  it is an unknown disposition and a defect.
