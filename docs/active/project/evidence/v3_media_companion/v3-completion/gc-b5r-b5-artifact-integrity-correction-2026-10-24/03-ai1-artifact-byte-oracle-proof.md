# AI1 — the published artifact bytes are the oracle

Oracles:
`scripts/stage_b_b5_3/test/artifact_integrity.node-test.mjs` (12 cases, 12
pass) and the AI1 process-level cases of
`scripts/stage_b_b5_3/test/sequencer.node-test.mjs` (9 cases).

## The defect that was closed

The aggregate checked only the PRESENCE of `receipt.json`. It never read the
published derivative, never hashed its bytes, never validated it against the
frozen contract and never recomputed the receipt hash. Two mutually
consistent JSON claims were therefore accepted as publication evidence even
when no published derivative existed.

## The contracted artifact

The literal `<bvid>-evidence.json` name is GONE. The durable artifact has ONE
contracted name:

```text
scripts/stage_b_b5_3/lib/v21_artifact.mjs
  export const V21_ARTIFACT_FILENAME = "derivative-v2.1.json";
```

* the runner writes the EXACT durable bytes of the published derivative under
  that name (`writeEvidenceFile(V21_ARTIFACT_FILENAME, publishedDerivativeBytes)`);
* the sequencer resolves the artifact by that EXACT name — there is no
  directory search and no ambiguity:
  `path.join(dir, V21_ARTIFACT_FILENAME)`;
* the aggregate receives the BYTES (`{ filename, bytes }`) and does the rest.

## The shared EXACT validator

`scripts/stage_b_b5_3/lib/v21_artifact.mjs` reads the FROZEN contract file

```text
docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json
```

and validates the parsed artifact against it. There is **no reduced duplicate
schema** in the runner: the module is a generic validator for the JSON
Schema 2020-12 keyword subset that the frozen file uses (`type`, `const`,
`enum`, `pattern`, `minLength`, `maxLength`, `minimum`, `maximum`,
`minItems`, `maxItems`, `uniqueItems`, `items`, `properties`, `required`,
`additionalProperties`, `$ref`, `allOf`, `if/then`).

Its EXACTNESS is proven against the PRODUCTION library:

```text
services/local-runtime/tests/test_v3_gc_b5r_v21_artifact_validator_equivalence.py
  19 passed, exit 0
```

The test builds 22 fixtures (one valid artifact and 21 contract violations),
runs the production `jsonschema` `Draft202012Validator` against the frozen
schema, runs the shared JavaScript validator against the same fixtures, and
asserts that BOTH return the SAME verdict for every fixture. The two
verdicts agreed on all 22.

## The byte oracle

`scripts/stage_b_b5_3/lib/artifact_integrity.mjs` is PURE: it takes the
artifact bytes and the declared facts and returns the failures.

```js
const artifactSha256 = sha256Hex(artifact.bytes);
// 1. the EXACT bytes must agree with EVERY declared hash:
//      the machine receipt derivative hash, the machine receipt evidence
//      hash and the mirror derivative hash
// 2. the bytes must parse
// 3. the artifact must satisfy the FROZEN V2.1 contract
// 4. the receipt hash must be recomputable from the artifact bytes
// 5. the EMBEDDED receipt must be the receipt of the mirror
// 6. the task id, the task revision and the source identity must be
//    cross-bound
```

## The receipt hash uses the PRODUCTION canonical serialization

The production byte layout of the Runtime is

```python
json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
```

The shared module reproduces it exactly (`canonicalJson`), and the runner now
computes the receipt hash with it:

```js
observed.receiptSha256 = sha256(canonicalJson(receipt));
```

So the aggregate can recompute `sha256(canonicalJson(artifact.receipt))` and
compare it with the machine receipt — the declared hash is no longer a free
claim.

## The cross-bindings

| identity | the binding |
|---|---|
| task id | `artifact.binding.taskId` = `receipt.taskId` = `mirror.taskId` |
| task revision | `artifact.binding.taskRevision` = `receipt.taskRevision` |
| source identity | `artifact.binding.sourceIdentity` = `receipt.sourceIdentity` |
| run | `receipt.runId` = the candidate run id |
| receipt | `artifact.receipt` = `mirror.receipt` = the publication projection |
| Provider | the locked `minimax-cn-openai-vision` |
| endpoint | the locked `minimax_chat_completions` |

## The positive stub writes a REAL artifact

`scripts/stage_b_b5_3/test/_fixtures/contract_shaped_stub.mjs` now builds a
REAL V2.1 derivative that satisfies the frozen contract, serializes it with
the PRODUCTION canonical serialization, and derives EVERY hash from those
bytes:

```text
derivativeSha256 = sha256(artifactBytes)
evidenceSha256   = sha256(artifactBytes)
receiptSha256    = sha256(canonicalJson(artifact.receipt))
```

There is **no repeated-character placeholder hash** left in the stub: the
identifiers, the digests and the attempt id are derived from the source
identity and the order.

## The process-level negatives

Each case mutates ONE source of a six-source batch and asserts the PROCESS
exit, the verdict and the exact aggregate failure code.

| the case | the mutation | the failure |
|---|---|---|
| `AI1: a missing derivative artifact exits nonzero` | the artifact file is absent | `AGG_ARTIFACT_MISSING` |
| `AI1: a malformed derivative artifact exits nonzero` | the bytes are not JSON | `AGG_ARTIFACT_MALFORMED` |
| `AI1: a derivative with the wrong schema exits nonzero` | the schema version is not the frozen one | `AGG_ARTIFACT_INVALID` |
| `AI1: a derivative tampered after the receipt was created exits nonzero` | the bytes are rewritten after the hashes were declared | `AGG_ARTIFACT_HASH_MISMATCH` |
| `AI1: a derivative hash mismatch exits nonzero` | the machine receipt declares another digest | `AGG_ARTIFACT_HASH_MISMATCH` |
| `AI1: a receipt hash mismatch exits nonzero` | the machine receipt declares another receipt digest | `AGG_RECEIPT_HASH_MISMATCH` |
| `AI1: an embedded receipt mismatch exits nonzero` | the receipt inside the artifact is not the receipt of the mirror | `AGG_RECEIPT_MISMATCH` |
| `AI1: a foreign task identity exits nonzero` | the machine receipt and the mirror carry another task id | `AGG_ARTIFACT_IDENTITY_MISMATCH` |
| `AI1: a stale artifact reuse exits nonzero` | the artifact bytes belong to another source | `AGG_ARTIFACT_IDENTITY_MISMATCH` |

The focused unit file `artifact_integrity.node-test.mjs` proves the same
oracle in isolation (12 cases).

## The secret and private-path rules are preserved

* The secret scan still walks the WHOLE evidence directory, the artifact
  included: a secret in the artifact is a hit and the sequencer hard-stops.
* The privacy audit still walks the whole directory, the artifact included.
  The artifact is **never rewritten** — its bytes are the evidence — so a
  path inside it is a FAIL-CLOSED condition instead: the runner refuses the
  source and the aggregate never sees a complete source.

## The honest limits

* The aggregate recomputes the hashes and revalidates the contract; it does
  not re-derive the derivative from the evidence catalog. The artifact is
  proven to be a contract-shaped derivative whose bytes are the ones the
  runner published and whose identities agree with the machine receipt.
* The shared validator implements the keyword subset of the frozen contract.
  The equivalence test proves that subset is exact for the frozen file; a
  future revision of the frozen contract that uses a NEW keyword would need
  the validator extended (and the equivalence test would fail loudly, because
  the two validators would disagree).
