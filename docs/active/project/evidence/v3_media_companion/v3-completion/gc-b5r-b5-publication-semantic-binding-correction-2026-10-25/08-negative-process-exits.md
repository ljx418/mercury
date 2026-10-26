# The negative process exits

Every negative case of this batch, the mutation it injects and the receipt it
produces. All of them are PROCESS exits: the real sequencer runs, the real
aggregate evaluates and the process exit code is asserted.

## SB1 — the machine identity (process level, the REAL sequencer)

One case per required identity field — eleven cases — each removing exactly
one field from the machine receipt of ONE source of a six-source batch:

| the case | the failure code |
|---|---|
| `SB1: a machine receipt without runId exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a machine receipt without registrySha256 exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a machine receipt without order exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a machine receipt without bvid exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a machine receipt without taskId exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a machine receipt without taskNamespace exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a machine receipt without taskRevision exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a machine receipt without sourceIdentity exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a machine receipt without dependencyGeneration exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a machine receipt without startedAtUtc exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a machine receipt without finishedAtUtc exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a foreign artifact with a removed machine source and revision exits nonzero` | `AGG_ARTIFACT_IDENTITY_MISMATCH` |

Every case asserts: a NON-ZERO process exit, a not-positive verdict and the
exact failure code.

## SB2 — the artifact quality (process level, the REAL sequencer)

| the case | the mutation | the failure code |
|---|---|---|
| `SB2: a limited artifact claimed complete exits nonzero` | the artifact's `quality.status` becomes `limited`; the hashes are RECOMPUTED | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `SB2: a rejected artifact claimed complete exits nonzero` | the status becomes `rejected`; the hashes are recomputed | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `SB2: a complete artifact with quality failure codes exits nonzero` | the quality carries a failure code; the hashes are recomputed | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `SB2: a machine receipt with another disposition exits nonzero` | the machine receipt says `limited` while the row says `complete` | `AGG_QUALITY_DISPOSITION_MISMATCH` |

## The PURE negatives (the production evaluator, hand-built rows)

`scripts/stage_b_b5_3/test/aggregate_identity.node-test.mjs` builds the six
rows the way the Codex review did and calls the PRODUCTION
`evaluateAggregate()`:

| the case | the mutation | the failure code |
|---|---|---|
| `SB1: a machine receipt without <field> is not a positive candidate` (eleven fields) | the field is deleted from ONE machine receipt | `AGG_MACHINE_IDENTITY_INVALID` |
| `SB1: a foreign artifact with a removed machine source and revision is not positive` | the artifact bytes are another source's and the machine declarations are removed | `AGG_ARTIFACT_IDENTITY_MISMATCH` |
| `SB2: a LIMITED artifact claimed complete is not a positive candidate` | the status becomes `limited`; the hashes are recomputed | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `SB2: a REJECTED artifact claimed complete is not a positive candidate` | the status becomes `rejected`; the hashes are recomputed | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `SB2: a COMPLETE artifact with quality failure codes is not a positive candidate` | the quality carries a failure code; the hashes are recomputed | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `SB2: a machine disposition that disagrees with the row is not positive` | the machine receipt says `limited` | `AGG_QUALITY_DISPOSITION_MISMATCH` |

The limited case ALSO asserts that NO `AGG_ARTIFACT_*` failure fired: the
byte oracle accepted the artifact and only the SEMANTIC binding refused it.

## SB3 — the schema keyword negatives (the shared validator)

| the case | the placement | the result |
|---|---|---|
| `SB3: an unsupported keyword at the ROOT throws` | `not` | throws |
| `SB3: an unsupported keyword in a $defs schema throws` | `minProperties` | throws |
| `SB3: an unsupported keyword in an items schema throws` | `exclusiveMinimum` | throws |
| `SB3: an unsupported keyword in a property schema throws` | `multipleOf` | throws |
| `SB3: an unsupported keyword in an if, then or else schema throws` | `contains`, `propertyNames`, `dependentRequired` | throws |
| `SB3: the unsupported keywords are never silently ignored` | the three keywords of the Codex reproduction | throws |

## The positive controls

| the case | what it proves |
|---|---|
| `SB1: the six valid rows are a positive candidate (the control)` | the pure evaluator still accepts a valid six-source candidate |
| `SB1: a complete identity has no defect` | the identity validator accepts a complete identity |
| `SB2: the production mapping is the single rule` | the frozen mapping is `complete→complete`, `limited→limited`, `rejected→failed` |
| `six fresh complete attempts are a positive candidate and exit 0` | the real sequencer still accepts a valid batch |
| `SB3: the supported keyword subset still validates values` | the validator still enforces the constraints it supports |

The negative cases are therefore meaningful: the SAME batch with ONE mutated
fact fails.

## The preserved negatives

Every negative of the previous batches still holds, among them:

```text
CI2: a complete source without a publication exits nonzero
CI2: a partial publication exits nonzero
CI2: a malformed receipt mirror exits nonzero
CI2: a mismatched receipt mirror exits nonzero
CI2: missing ledger events exits nonzero
CI2: a zero ledger event exits nonzero
CI2: duplicated ledger events exits nonzero
CI2: an unknown Provider HTTP count exits nonzero
AI1: the nine artifact-byte negatives
an OWNED descendant that exits before the closeout is still a leak
an UNRELATED live runner is neither counted nor killed
```
