# SB1 — the machine identity is mandatory

Oracles:
`scripts/stage_b_b5_3/test/machine_identity.node-test.mjs` (9 cases),
`scripts/stage_b_b5_3/test/aggregate_identity.node-test.mjs` (17 cases) and
the SB1 process-level cases of
`scripts/stage_b_b5_3/test/sequencer.node-test.mjs` (12 cases).

## The defect that was closed

`checkArtifactIntegrity()` compared the task id, the task revision and the
source identity ONLY when both values existed:

```js
if (artifactValue === undefined || artifactValue === null) continue;   // ← absence skipped the binding
if (declaredValue === undefined || declaredValue === null) continue;   // ← absence skipped the binding
```

The aggregate also treated several machine identity fields as optional: it
did not require `taskRevision` or `sourceIdentity`, and `bvid`, `order`,
`taskId` and `taskNamespace` were guarded only when present.

The Codex reproduced it: six valid complete rows with `taskRevision` and
`sourceIdentity` deleted from every machine receipt returned
`positive: true, failures: []`.

## The explicit validator

`scripts/stage_b_b5_3/lib/machine_identity.mjs` is the ONE validator of the
complete machine-receipt identity. Every field is REQUIRED, TYPED and
COMPARED — there is no truthy conditional comparison anywhere in it.

| field | the required shape | the comparison |
|---|---|---|
| `runId` | a non-empty string | `===` the candidate run id |
| `registrySha256` | a 64-hex digest | `===` the ACTIVE registry digest |
| `order` | an integer 1..6 | `===` the row order |
| `bvid` | `BV<10 alnum>` | `===` the row bvid |
| `taskId` | `media_task_<32 hex>` | — |
| `taskNamespace` | a non-empty string | — |
| `taskRevision` | an integer ≥ 1 | — |
| `sourceIdentity` | `portal:<adapter>:<bvid>:<cid>:<page>` | the BVID component `===` the row bvid |
| `dependencyGeneration` | `depgen_<64 hex>` | — |
| `startedAtUtc` | an ISO-8601 UTC timestamp | — |
| `finishedAtUtc` | an ISO-8601 UTC timestamp | `≥` the start timestamp |

The source identity is PARSED into its frozen components
(`parseSourceIdentity`): the portal is the literal `portal`, the adapter is
the frozen adapter token and the BVID component must belong to the frozen
row.

## The comparison is unconditional

The artifact oracle now receives the EXPECTED row identity and the run
identity, and it compares the artifact binding to the machine receipt
UNCONDITIONALLY:

```js
for (const [label, artifactValue, declaredValue] of identities) {
  if (artifactValue === undefined || artifactValue === null) {
    fail(IDENTITY_MISMATCH, `the artifact declares no ${label}`); continue;
  }
  if (declaredValue === undefined || declaredValue === null) {
    fail(IDENTITY_MISMATCH, `the machine receipt declares no ${label}, so the artifact ${label} cannot be bound`);
    continue;
  }
  if (String(artifactValue) !== String(declaredValue)) {
    fail(IDENTITY_MISMATCH, `the artifact ${label} is … and the machine receipt declares …`);
  }
}
```

A missing machine value is a DEFECT, never a permission to skip the
comparison.

The aggregate calls it with the expected identity:

```js
for (const defect of machineIdentityDefects(receipt, {
  runId, registrySha256, order: row.order, bvid: row.bvid,
})) {
  failures.push(fail(AGGREGATE_FAILURE.MACHINE_IDENTITY_INVALID, `${label} ${defect}`));
}
```

and the artifact oracle with the same identity, so the artifact's source
identity is bound to the FROZEN ROW bvid as well.

## The reproduction is closed

The Codex reproduction, re-run against the production `evaluateAggregate()`:

```text
SB1: a machine receipt without taskRevision is not a positive candidate     → AGG_MACHINE_IDENTITY_INVALID
SB1: a machine receipt without sourceIdentity is not a positive candidate   → AGG_MACHINE_IDENTITY_INVALID
SB1: a foreign artifact with a removed machine source and revision is not positive
                                                                            → AGG_ARTIFACT_IDENTITY_MISMATCH
```

The pure test file builds the six rows the way the review did (hand-built
rows, one mutated fact, the production evaluator) and asserts that the
verdict is not positive and that the failure carries a stable internal code.

## The negatives

### The pure cases (`aggregate_identity.node-test.mjs`)

One case per required identity field — eleven cases — plus the foreign
artifact:

| the case | the failure |
|---|---|
| `SB1: a machine receipt without <field> is not a positive candidate` (eleven fields) | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a foreign artifact with a removed machine source and revision is not positive` | `AGG_ARTIFACT_IDENTITY_MISMATCH` |
| `SB1: the six valid rows are a positive candidate (the control)` | — (the positive control) |

### The validator cases (`machine_identity.node-test.mjs`)

| the case | what it proves |
|---|---|
| a complete identity has no defect | the positive control |
| every identity field is required | eleven fields, each named in its defect |
| a null identity field is a defect | eleven fields |
| a wrong type is a defect | eleven malformed values |
| a mismatch with the expected identity is a defect | run, registry, order, bvid, source |
| the source identity is parsed into its frozen components | the parser |
| the source identity must name the frozen row | the BVID component |
| a receipt that finishes before it starts is a defect | the fresh attempt window |
| a missing receipt is a defect | the absent receipt |

### The process-level cases (`sequencer.node-test.mjs`)

One case per required identity field — eleven cases — each driving the REAL
sequencer with one field removed from the machine receipt. Every case asserts
a NON-ZERO process exit, a not-positive verdict and the
`AGG_MACHINE_IDENTITY_INVALID` code.

## The honest limits

* The identity is required for a COMPLETE row. A source that failed before
  its task existed legitimately has no task id, and it can never make the
  candidate positive anyway.
* The validator compares the identity fields against the EXPECTED row and run
  identity that the aggregate receives. It does not re-derive the task id
  from the task store: the Runtime owns that.
