# SB2 — the artifact quality is bound to the disposition

Oracles: the SB2 process-level cases of
`scripts/stage_b_b5_3/test/sequencer.node-test.mjs` (4 cases) and the
semantic cases of
`scripts/stage_b_b5_3/test/aggregate_identity.node-test.mjs` (4 cases).

## The defect that was closed

The byte oracle validated the artifact SHAPE but never compared
`artifact.quality.status` with the row or the machine disposition, and the
aggregate did not require `receipt.disposition === row.disposition`.

The Codex reproduced it: one artifact's `quality.status` changed to
`limited`, its exact hashes recomputed, the row and the machine receipt left
at `complete` — and the aggregate still returned `positive: true`.

## The production mapping is the SINGLE rule

The rule that already existed in `run_one_bvid.mjs` moved into the shared
contracts module and is now used by BOTH the runner and the aggregate:

```js
// scripts/stage_b_b5_3/lib/contracts.mjs
export const QUALITY_STATUS_TO_DISPOSITION = Object.freeze({
  complete: "complete",
  limited: "limited",
  rejected: "failed",
});
export function dispositionForQualityStatus(status) { … }
```

```js
// scripts/stage_b_b5_3/run_one_bvid.mjs
finalDisposition = dispositionForQualityStatus(qualityStatus) ?? "failed";
```

So the frozen mapping is:

| the artifact quality status | the disposition |
|---|---|
| `complete` | `complete` |
| `limited` | `limited` |
| `rejected` | `failed` |
| anything else | no frozen disposition (the runner fails closed, the aggregate refuses) |

A BLOCKED pre-synthesis source publishes NO derivative: it has no artifact,
no publication and no quality object.

## The four facts that must agree

For every row that carries an artifact, the aggregate requires:

| the fact | where it comes from |
|---|---|
| the PARSED final disposition | the row (`final_disposition.txt`) |
| the MACHINE receipt disposition | `receipt.disposition` |
| the ARTIFACT quality status | `artifact.quality.status` |
| the PUBLICATION presence | `provider.published` |

```js
// the machine receipt must say the same thing as the parsed disposition
if (receipt.disposition !== disposition) → AGG_QUALITY_DISPOSITION_MISMATCH

// the artifact quality must MAP to the parsed disposition
const mapped = dispositionForQualityStatus(quality.status);
if (mapped === null) → AGG_QUALITY_DISPOSITION_MISMATCH
if (mapped !== disposition) → AGG_QUALITY_DISPOSITION_MISMATCH

// a COMPLETE result carries no failure code
if (disposition === "complete") {
  if (quality.status !== "complete") → AGG_QUALITY_DISPOSITION_MISMATCH
  if (!Array.isArray(quality.failureCodes) || quality.failureCodes.length > 0)
    → AGG_QUALITY_DISPOSITION_MISMATCH
}
```

A `limited` artifact therefore makes the row `limited`, and the aggregate's
`limitedMaximum = 0` refuses the candidate: a limited product is not a Stage
B positive.

## The negatives

### The pure cases (`aggregate_identity.node-test.mjs`)

| the case | the mutation | the failure |
|---|---|---|
| `SB2: a LIMITED artifact claimed complete is not a positive candidate` | the artifact's `quality.status` becomes `limited` and **the hashes are recomputed** | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `SB2: a REJECTED artifact claimed complete is not a positive candidate` | the status becomes `rejected`, the hashes recomputed | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `SB2: a COMPLETE artifact with quality failure codes is not a positive candidate` | `quality.failureCodes` carries a code, the hashes recomputed | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `SB2: a machine disposition that disagrees with the row is not positive` | the machine receipt says `limited`, the row says `complete` | `AGG_QUALITY_DISPOSITION_MISMATCH` |

**The hashes are recomputed in every case.** The limited case therefore
proves the SEMANTIC binding and not an incidental hash mismatch: the case
also asserts that NO `AGG_ARTIFACT_*` failure is present — the byte oracle
accepted the artifact, and only the semantic binding refused it.

### The process-level cases (`sequencer.node-test.mjs`)

| the case | the mutation | the failure |
|---|---|---|
| `SB2: a limited artifact claimed complete exits nonzero` | the artifact's status is `limited`, the hashes recomputed | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `SB2: a rejected artifact claimed complete exits nonzero` | the status is `rejected` | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `SB2: a complete artifact with quality failure codes exits nonzero` | the quality carries a failure code | `AGG_QUALITY_DISPOSITION_MISMATCH` |
| `SB2: a machine receipt with another disposition exits nonzero` | the machine receipt says `limited` | `AGG_QUALITY_DISPOSITION_MISMATCH` |

## The positive control

`SB1: the six valid rows are a positive candidate (the control)` and
`six fresh complete attempts are a positive candidate and exit 0`: the same
six-source batch with NO mutation exits 0, the verdict is positive, the
artifact's quality status is `complete` with an empty `failureCodes` and the
machine disposition matches the parsed disposition.

## The honest limits

* The aggregate binds the artifact's quality object to the disposition. It
  does not re-evaluate the quality object itself: the production quality
  evaluator (the Runtime) owns that, and its `failureCodes` are the
  evaluator's own output.
* A `limited` artifact makes the row `limited`, which the aggregate refuses
  (the positive threshold allows no limited source). The batch therefore
  fails closed on a limited product.
