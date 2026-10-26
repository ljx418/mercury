# Contract Statement

## No public contract changed

No public API, event, data model or adapter contract was edited by this
batch, so no refreeze is required and no stop for refreeze was needed.

| Contract | Status |
|---|---|
| The FROZEN V2.1 derivative contract `v3-media-grounded-comprehension/v2.1` and its schema file | UNCHANGED (read only) |
| The public product routes (`GET /v1/media/tasks/{taskId}/comprehension`, `GET /v1/media/tasks/{taskId}/evidence/{evidenceId}/thumbnail`) | UNCHANGED (read only) |
| The production task store, the materializer, the acquisition and the Provider adapter | UNCHANGED (no production Python was touched) |
| The relay v11 contract and its fixtures | UNCHANGED (this batch wrote nothing under `apps/chrome-extension/`) |
| The frozen denominator, the active source registry and its digest | UNCHANGED (read only) |
| The historical evidence packages | UNCHANGED (the submitted B6A package still verifies against its own manifest) |

## What did change, and why it is not a public contract

Every changed file is under `scripts/stage_b_b5_3/`, which is the ACCEPTANCE
HARNESS of Stage B. It is not shipped, it is not imported by the product and
it is not a public contract of the Runtime or of the extension.

| Schema | Status | Note |
|---|---|---|
| `v3-5.10-b6-review-bundle/v1` (the private bundle) | UNCHANGED version | The bundle's FILE SET and its schema version are unchanged. The validation became byte-closed: the manifest entry bytes must be the canonical bytes of the parsed bundle, and the receipt is derived. |
| `v3-5.10-b6-capture-receipt/v1` (the PUBLIC capture receipt) | UNCHANGED version, STRICTIFIED content | The counts, the digests, the closure, the schema and the status are now RECOMPUTED from the bundle instead of being written by the caller. The four digests are `artifactSha256`, `evidenceCatalogSha256`, `bundleSha256` and `reviewBindingSha256`; the four closure flags are always the four booleans. A receipt that does not match the recomputation is refused. The receipt stays content-free: no text, no byte, no file name, no private path, no Provider identity. |
| `v3-5.10-b6-seek-map/v1` (the seek map) | UNCHANGED version, STRICTIFIED content | One row per derivative chapter, with the exact chapter id, order, window and evidence set, an in-chapter seek time and a PNG-backed same-task representative. |
| `v3-5.10-b6-candidate-authority/v1` | NEW, INTERNAL | The candidate authority of the B-6 aggregate. It is an internal acceptance-harness object; nothing outside `scripts/stage_b_b5_3/` reads it. |
| `v3-5.10-b6-semantic-aggregate/v1` | UNCHANGED version | The aggregate now REQUIRES the candidate authority and deletes every permissive default. |
| `v3-5.10-b5-3-source-receipt/v2` (the B-5 machine receipt) | UNCHANGED version, one inner field strictified | The `reviewCapture` field is an acceptance-harness-only marker that the submitted B6A package introduced. Its inner shape is now exact (the four digests, the four closure booleans, the counts, the status). The only readers are the sequencer of this harness (updated in this batch) and the B-5 aggregate (which never reads it). The durable B-5 receipt semantics (the explicit merge, the disposition precedence, the cleanup convergence) are unchanged. |

## The blind review binding has exactly one definition

`lib/review_bundle.mjs :: reviewBindingSha256` is the single definition. The
blind projection imports it and the capture receipt uses it, so the two can
never bind different values. It is the SHA-256 of the canonical serialization
of the published derivative's Provider receipt: irreversible, and it never
exposes the Provider identity.

## No denominator, no fixture and no historical evidence was lowered

The six source identities, the four reserves, the active registry digest, the
rubric and prompt hashes of the acceptance plan and the 54 fixed obligations
are unchanged. The sentinel claim sets are not relaxed: they must be
IDENTICAL and NON-EMPTY.
