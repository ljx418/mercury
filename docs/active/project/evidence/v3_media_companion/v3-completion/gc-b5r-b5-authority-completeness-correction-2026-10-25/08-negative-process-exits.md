# The negative process exits

Every negative case of this batch, the mutation it injects and the receipt it
produces. All of them are PROCESS exits: the real sequencer runs, the real
aggregate evaluates and the process exit code is asserted.

## AC1 — the identity fields bound to the authority

| the case | the injection | the failure code |
|---|---|---|
| `AC1: a foreign source adapter exits nonzero` | `portal:attacker:<bvid>:…` | `AGG_MACHINE_IDENTITY_INVALID` |
| `AC1: a malformed machine task namespace exits nonzero` | the namespace is not `media_task_<32 hex>` | `AGG_MACHINE_IDENTITY_INVALID` |
| `AC1: a malformed task namespace receipt exits nonzero` | the namespace file carries an extra field | `AGG_NAMESPACE_RECEIPT_INVALID` |
| `AC1: a task namespace file mismatch exits nonzero` | the namespace file names another namespace | `AGG_NAMESPACE_RECEIPT_INVALID` |
| `AC1: an invalid date and time exits nonzero` | `2026-99-99T99:99:99Z` | `AGG_MACHINE_IDENTITY_INVALID` |
| `AC1: a reversed attempt window exits nonzero` | `finish < start` | `AGG_MACHINE_IDENTITY_INVALID` |

Every case asserts: a NON-ZERO process exit, a not-positive verdict and the
exact failure code.

## AC2 — the machine disposition

| the case | the injection | the failure code |
|---|---|---|
| `AC2: a missing machine disposition exits nonzero` | the field is deleted | `AGG_MACHINE_TERMINAL_INVALID` |
| `AC2: a null machine disposition exits nonzero` | the field is null | `AGG_MACHINE_TERMINAL_INVALID` |
| `AC2: a wrong-type machine disposition exits nonzero` | the field is `7` | `AGG_MACHINE_TERMINAL_INVALID` |
| `AC2: an unknown machine disposition exits nonzero` | the field is `not-a-frozen-disposition` | `AGG_MACHINE_TERMINAL_INVALID` |
| `AC2: a mismatched machine disposition exits nonzero` | the field is `limited` while the row is `complete` | `AGG_QUALITY_DISPOSITION_MISMATCH` |

## AC3 — the public schema entry point

| the case | the injection | the result |
|---|---|---|
| `AC3: the PUBLIC validation entry point is fail-closed on its own` | `not` at the root and `minProperties` NESTED | the public API throws |
| `SB3: an unsupported keyword at the ROOT throws` | `not` | the public API throws |
| `SB3: an unsupported keyword in a $defs schema throws` | `minProperties` | the public API throws |
| `SB3: an unsupported keyword in an items schema throws` | `exclusiveMinimum` | the public API throws |
| `SB3: an unsupported keyword in a property schema throws` | `multipleOf` | the public API throws |
| `SB3: an unsupported keyword in an if, then or else schema throws` | `contains`, `propertyNames`, `dependentRequired` | the public API throws |

## The PURE negatives (the production evaluator, hand-built rows)

`scripts/stage_b_b5_3/test/aggregate_identity.node-test.mjs` builds the six
rows the way the Codex review did and calls the PRODUCTION
`evaluateAggregate()`:

```text
AC1: a FOREIGN ADAPTER is not a positive candidate
AC1: a MALFORMED namespace is not a positive candidate
AC1: a NAMESPACE FILE MISMATCH is not a positive candidate
AC1: a MALFORMED namespace receipt is not a positive candidate
AC1: an ABSENT namespace receipt is not a positive candidate
AC1: an INVALID date/time is not a positive candidate
AC1: a REVERSED window is not a positive candidate
AC2: a MISSING disposition is not a positive candidate
AC2: a NULL disposition is not a positive candidate
AC2: a WRONG-TYPE disposition is not a positive candidate
AC2: an UNKNOWN disposition is not a positive candidate
AC2: a MISMATCHED machine disposition is not a positive candidate
AC2: the disposition of EVERY source is required, not only of one
```

## The direct validator negatives

`services`/`scripts/stage_b_b5_3/test/machine_identity.node-test.mjs`:

```text
AC1: the source portal and adapter are the FROZEN authority
AC1: the playback unit and the part must be present
AC1: the task namespace must satisfy the FROZEN shape
AC1: the timestamps must be FINITE, REAL UTC instants
AC1: a reversed window is a defect
AC1: the task namespace RECEIPT is parsed and bound
AC2: the disposition is a REQUIRED, typed terminal field
AC2: the machine disposition is compared with the parsed final disposition
```

## The positive controls

| the case | what it proves |
|---|---|
| `SB1: a complete identity has no defect` | the identity validator accepts a complete identity |
| `SB1: the six valid rows are a positive candidate (the control)` | the pure evaluator still accepts a valid six-source candidate |
| `six fresh complete attempts are a positive candidate and exit 0` | the real sequencer still accepts a valid batch |
| `SB3: the supported keyword subset still validates values` | the public API still enforces the constraints it supports |

The negative cases are therefore meaningful: the SAME batch with ONE mutated
fact fails.

## The preserved negatives

Every negative of the previous batches still holds, among them:

```text
SB1: the eleven machine identity field cases
SB2: the limited / rejected / failure-codes / disposition-mismatch cases
AI1: the nine artifact-byte negatives
AI2: the seven request and mirror negatives
CI2: the eight request and mirror negatives
an OWNED descendant that exits before the closeout is still a leak
an UNRELATED live runner is neither counted nor killed
```
