# GC-B5R B-5 — Artifact Integrity Correction

Batch: **GC-B5R B-5 ARTIFACT INTEGRITY CORRECTION**
Date: 2026-10-24
Stop state: `GC-B5R B-5 ARTIFACT INTEGRITY CORRECTION AWAITING CODEX CHECKPOINT`

## What this batch is

ONE bounded offline correction. It closes the two findings of the Codex
review of the aggregate-integrity batch
(`gc-b5r-b5-artifact-integrity-codex-review-2026-10-24/00-codex-review.md`):

* **AI1** — the aggregate had no artifact-byte oracle: two mutually
  consistent JSON claims could be accepted as publication evidence even when
  no published derivative existed.
* **AI2** — a complete publication with ZERO Provider requests and a mirror
  with the WRONG schema could pass.

**No external action happened.** Every external action counter of this batch
is zero:

| external action | count |
|---|---|
| Chrome launches | 0 |
| visible windows | 0 |
| real media Runtime starts | 0 |
| Provider requests | 0 |
| downloads | 0 |
| imports | 0 |
| media tasks | 0 |
| Cookie reads / injections | 0 |
| audio outputs | 0 |
| tabCapture actions | 0 |
| focus events | 0 |
| real BVID executions | 0 |

Every test used a temporary root and synthetic values. The only HTTP traffic
of the batch is a loopback double inside the test process; the Provider
adapter's transport is faked with `httpx.MockTransport`.

## What this batch is NOT

* It is **not** a Stage B, WP-B or V3 acceptance. No gate was closed and no
  gate is claimed; B-5 is not complete.
* It does **not** run the visible six-video batch and it does **not** consume
  a new visible-run authorization.
* It does **not** re-freeze the relay contract and it does **not** change any
  public API, schema, FailureCode inventory, threshold, message, Provider
  registry, Origin/auth order, frozen denominator or historical evidence.
* It does **not** enter B-6, B-7, WP-C, Stage C/D/E, V3-6 or V3-7.

## The two closures

| id | closure | where it lives | proof |
|---|---|---|---|
| AI1 | the published artifact BYTES are the oracle: a contracted file name, the exact bytes, the frozen V2.1 contract, the byte hashes and the identity cross-bindings | `scripts/stage_b_b5_3/lib/v21_artifact.mjs`, `scripts/stage_b_b5_3/lib/artifact_integrity.mjs`, `scripts/stage_b_b5_3/lib/aggregate.mjs`, `scripts/stage_b_b5_3/run_one_bvid.mjs`, `scripts/stage_b_b5_3/sequencer.mjs` | `03-ai1-artifact-byte-oracle-proof.md` |
| AI2 | the request count and the mirror are closed: `requestCount >= 1`, the exact ledger sums, the exact mirror schema version, the exact mirror wrapper key set and the REQUIRED locked selection | `scripts/stage_b_b5_3/lib/aggregate.mjs` | `04-ai2-request-mirror-proof.md` |

## The contract statement

**No public contract changed.**

* The frozen V2.1 candidate schema, the frozen V2.1 derivative schema and
  the frozen Stage B contract are byte-identical. The batch READS the frozen
  derivative contract; it does not touch it.
* The FailureCode inventories are unchanged. The new aggregate failure codes
  (`AGG_ARTIFACT_MISSING`, `AGG_ARTIFACT_MALFORMED`, `AGG_ARTIFACT_INVALID`,
  `AGG_ARTIFACT_HASH_MISMATCH`, `AGG_RECEIPT_HASH_MISMATCH`,
  `AGG_RECEIPT_MISMATCH`, `AGG_ARTIFACT_IDENTITY_MISMATCH`,
  `AGG_REQUEST_COUNT_INVALID`) belong to the INTERNAL aggregate evaluator.
* The aggregate thresholds, the fixed BVID denominator, the Provider
  selection, the upload policy and the Origin/auth ordering are unchanged.
* No public endpoint was added and no public error envelope changed.
* The durable action ledger gained no event and no enum value.
* The machine receipt of a source is an INTERNAL evidence artefact: its
  `provider.published` block and its `receiptSha256` now describe the
  CONTRACTED artifact and the PRODUCTION canonical serialization. No field
  was removed.

## The production Python was not touched; a shared Python validator was

The batch changed no production Python file. It added ONE Python TEST that
proves the shared JavaScript validator is EXACT: it runs the PRODUCTION
`jsonschema` library against the frozen contract file and asserts that both
validators return the SAME verdict on 22 fixtures. Because a Python test
was added, the focused Python tests and the consolidated Runtime suite were
run.

## The relay scope was not touched

The relay v11 gate was NOT re-run: the relay scope is provably byte-identical
(the 12 frozen relay hashes match and the newest modification of any file
under the four discovery roots is 2026-10-20). The proof is in
`02-commands-and-exits.md`.

## The historical evidence

No historical evidence directory was edited. This batch created ONE new
package:

`docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-artifact-integrity-correction-2026-10-24/`
