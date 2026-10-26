# The negative process exits

Every negative case of this batch, the mutation it injects and the receipt it
produces. All of them are PROCESS exits: the real sequencer runs, the real
aggregate evaluates and the process exit code is asserted.

## CI1 — the owned-process leaks

| the case | the injection | the receipt |
|---|---|---|
| `an OWNED leaked process exits nonzero` | the stub runner spawns a descendant that OUTLIVES it | `processAudit.ok === false`, `leakedAfter > 0`, the exit is non-zero |
| `an OWNED descendant that exits before the closeout is still a leak` | the stub runner spawns a descendant that survives the source boundary; the sequencer cleans it, so it is DEAD at the closeout | `stillAliveAtCloseout === 0`, `killedOwnedPids.length > 0`, and the LATCHED sighting still fails the batch: `leakedAfter > 0`, `sightings[0].source === "1/BV11t8w6oEtP"`, `verdict.positive === false`, `AGG_AUDIT_FAILED … leaked an owned process`, `bvids.length === 1`; the unrelated live process is still alive and was never killed |
| `an UNRELATED live runner is neither counted nor killed` | a live process whose argv names `run_one_bvid.mjs`, owned by another run | `leakedAfter === 0`, `ok === true`, the exit is 0, the unrelated process is still alive |
| `PH0-AR-10: an UNRELATED live runner is neither counted nor killed` | the same, through the real sequencer with the six stub children | the same receipt |
| `PH0-AR-10: SIGTERM to running sequencer → child killed + no leaked subprocesses` | the signal is forwarded to the child | `leakedAfter === 0` after the forwarded signal |

## CI2 — the publication and the accounting

Every case mutates ONE source (source 1) of a six-source batch and asserts
the PROCESS exit, the verdict and the exact aggregate failure code.

| the case | the mutation | the failure code |
|---|---|---|
| `CI2: a complete source without a publication exits nonzero` | the machine receipt's `provider.published` is null while the disposition is `complete` | `AGG_PUBLICATION_MISSING` |
| `CI2: a partial publication exits nonzero` | the publication misses `attemptId` and `requestSha256` | `AGG_PUBLICATION_INVALID` |
| `CI2: a malformed receipt mirror exits nonzero` | `receipt.json` is not JSON | `AGG_MIRROR_INVALID` |
| `CI2: a mismatched receipt mirror exits nonzero` | the mirror's receipt carries another `attemptId` | `AGG_MIRROR_INVALID` |
| `CI2: missing ledger events exits nonzero` | the source writes NO ledger event | `AGG_LEDGER_ACCOUNTING` |
| `CI2: a zero ledger event exits nonzero` | the source writes a `providerCall` event with the count 0 | `AGG_LEDGER_ACCOUNTING` |
| `CI2: duplicated ledger events exits nonzero` | the source writes its `providerCall` event twice | `AGG_LEDGER_ACCOUNTING` |
| `CI2: an unknown Provider HTTP count exits nonzero` | the source attempted a synthesis but its `attempted.requestCount` is null | `AGG_LEDGER_ACCOUNTING` |

## The pre-existing negative cases that must stay negative

| the case | the mutation |
|---|---|
| `one failed source exits nonzero` | one source is `failed` |
| `one limited source exits nonzero` | one source is `limited` |
| `two blocked sources exit nonzero` | two sources are `blocked` |
| `a wrong source identity exits nonzero` | the receipt carries another bvid |
| `a reserve substitution exits nonzero` | the receipt carries a frozen reserve |
| `a stale artifact exits nonzero` | the receipt was produced against another registry |
| `a cross-run artifact exits nonzero` | the receipt carries another run id |
| `a missing final receipt exits nonzero` | the machine receipt is absent |
| `a missing required evidence file exits nonzero` | the mirror is absent |
| `an upload-policy violation exits nonzero` | an upload counter is non-zero |
| `sequencer hard-stops when chrome_launch.log lacks --mute-audio` | the launch record does not assert the mute flag |
| `sequencer hard-stops when secret_scan.csv has any hits` | the secret scan carries a hit |

## The positive control

`the positive candidate carries the publication and the exact ledger
accounting` — the same six-source batch with NO mutation exits 0, the
verdict is positive, and the candidate ledger totals equal the sums of the
per-source attempted facts:

```text
actionLedger.candidateTotals.runtimeSynthesize === Σ rows' attempted.attemptCount
actionLedger.candidateTotals.providerCall     === Σ rows' attempted.requestCount
```

The negative cases are therefore meaningful: the SAME batch with ONE
mutated fact fails.
