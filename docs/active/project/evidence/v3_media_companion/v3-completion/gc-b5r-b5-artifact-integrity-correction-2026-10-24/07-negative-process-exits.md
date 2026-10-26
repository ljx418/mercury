# The negative process exits

Every negative case of this batch, the mutation it injects and the receipt it
produces. All of them are PROCESS exits: the real sequencer runs, the real
aggregate evaluates and the process exit code is asserted.

## AI1 — the artifact-byte oracle

| the case | the injection | the failure code |
|---|---|---|
| `AI1: a missing derivative artifact exits nonzero` | the artifact file is absent | `AGG_ARTIFACT_MISSING` |
| `AI1: a malformed derivative artifact exits nonzero` | the bytes are not JSON | `AGG_ARTIFACT_MALFORMED` |
| `AI1: a derivative with the wrong schema exits nonzero` | the schema version is not the frozen V2.1 one | `AGG_ARTIFACT_INVALID` |
| `AI1: a derivative tampered after the receipt was created exits nonzero` | the bytes are rewritten after the hashes were declared | `AGG_ARTIFACT_HASH_MISMATCH` |
| `AI1: a derivative hash mismatch exits nonzero` | the machine receipt declares another derivative digest | `AGG_ARTIFACT_HASH_MISMATCH` |
| `AI1: a receipt hash mismatch exits nonzero` | the machine receipt declares another receipt digest | `AGG_RECEIPT_HASH_MISMATCH` |
| `AI1: an embedded receipt mismatch exits nonzero` | the receipt inside the artifact is not the receipt of the mirror | `AGG_RECEIPT_MISMATCH` |
| `AI1: a foreign task identity exits nonzero` | the machine receipt and the mirror carry another task id | `AGG_ARTIFACT_IDENTITY_MISMATCH` |
| `AI1: a stale artifact reuse exits nonzero` | the artifact bytes belong to another source | `AGG_ARTIFACT_IDENTITY_MISMATCH` |

## AI2 — the request count and the mirror

| the case | the injection | the failure code |
|---|---|---|
| `AI2: receipts and ledger that consistently claim zero requests exits nonzero` | the receipt, the mirror, the artifact and the ledger all claim zero | `AGG_REQUEST_COUNT_INVALID` |
| `AI2: a mirror with the wrong schema version exits nonzero` | `schemaVersion: "wrong-schema-still-accepted"` | `AGG_MIRROR_INVALID` |
| `AI2: a mirror that lacks a required wrapper field exits nonzero` | one wrapper field is removed | `AGG_MIRROR_INVALID` |
| `AI2: a mirror that carries an extra wrapper field exits nonzero` | one unknown field is added | `AGG_MIRROR_INVALID` |
| `AI2: every required mirror wrapper field is required` | the case runs ONCE PER REQUIRED FIELD | `AGG_MIRROR_INVALID` for each of the ten fields |

## CI1 — the preserved leak regression

| the case | the injection | the receipt |
|---|---|---|
| `an OWNED descendant that exits before the closeout is still a leak` | a descendant that outlives its source runner | the exit is non-zero, the latched sighting survives, only the first source ran, the owned descendant was cleaned and the unrelated process is still alive |
| `an UNRELATED live runner is neither counted nor killed` | a live process whose argv names the runner, owned by another run | `leakedAfter === 0`, the exit is 0, the process is still alive |
| `PH0-AR-10: an UNRELATED live runner is neither counted nor killed` | the same, through the real sequencer | the same receipt |

## The pre-existing negatives that must stay negative

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
| `CI2: a complete source without a publication exits nonzero` | the publication is null |
| `CI2: a partial publication exits nonzero` | the publication misses two fields |
| `CI2: a malformed receipt mirror exits nonzero` | `receipt.json` is not JSON |
| `CI2: a mismatched receipt mirror exits nonzero` | the mirror's receipt carries another attempt id |
| `CI2: missing ledger events exits nonzero` | the source writes NO ledger event |
| `CI2: a zero ledger event exits nonzero` | the source writes a `providerCall` event with the count 0 |
| `CI2: duplicated ledger events exits nonzero` | the source writes its `providerCall` event twice |
| `CI2: an unknown Provider HTTP count exits nonzero` | the source attempted a synthesis but its `requestCount` is null |

## The positive control

`the positive candidate carries the publication and the exact ledger
accounting` and `six fresh complete attempts are a positive candidate and
exit 0` — the same six-source batch with NO mutation exits 0, the verdict is
positive, the artifact bytes hash to the declared digests and the candidate
ledger totals equal the sums of the per-source attempted facts.

The negative cases are therefore meaningful: the SAME batch with ONE mutated
fact fails.
