# GC-B5R B-5 — Aggregate Integrity Correction

Batch: **GC-B5R B-5 AGGREGATE INTEGRITY CORRECTION**
Date: 2026-10-24
Stop state: `GC-B5R B-5 AGGREGATE INTEGRITY CORRECTION AWAITING CODEX CHECKPOINT`

## What this batch is

ONE strictly offline corrective batch. It closes the two findings of the
Codex review of the runner-closure batch
(`gc-b5r-b5-runner-closure-codex-review-2026-10-24/00-codex-review.md`):

* **CI1** — a per-source owned-process leak could disappear before closeout;
* **CI2** — a `complete` source did not require a real publication, and the
  candidate ledger totals did not participate in the positive verdict.

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
  gate is claimed.
* It does **not** run the visible six-video batch and it does **not** consume
  a new visible-run authorization.
* It does **not** re-freeze the relay contract and it does **not** change any
  public contract, schema, FailureCode inventory, threshold or denominator.
* It does **not** enter B-6, B-7, WP-C, Stage C/D/E, V3-6 or V3-7.

## The two closures

| id | closure | where it lives | proof |
|---|---|---|---|
| CI1 | every owned-process leak sighting is preserved, bound to its source, and fails the batch | `scripts/stage_b_b5_3/lib/process_ownership.mjs`, `scripts/stage_b_b5_3/sequencer.mjs`, `scripts/stage_b_b5_3/lib/aggregate.mjs` | `03-ci1-process-leak-proof.md` |
| CI2 | a complete source requires a real, cross-bound publication, and the candidate ledger totals must equal the per-source attempted facts | `scripts/stage_b_b5_3/lib/aggregate.mjs`, `scripts/stage_b_b5_3/lib/audit_finalizer.mjs`, `scripts/stage_b_b5_3/run_one_bvid.mjs`, `scripts/stage_b_b5_3/sequencer.mjs` | `04-ci2-publication-accounting-proof.md` |

## The contract statement

**No public contract changed.**

* The frozen V2.1 candidate schema, the frozen V2.1 derivative schema and
  the frozen Stage B contract are unchanged.
* The FailureCode inventories are unchanged: the batch CONSUMES the frozen
  codes and adds none. The new aggregate failure codes
  (`AGG_PUBLICATION_MISSING`, `AGG_PUBLICATION_INVALID`, `AGG_MIRROR_INVALID`,
  `AGG_LEDGER_ACCOUNTING`) belong to the INTERNAL aggregate evaluator, which
  is not a public contract.
* The aggregate thresholds, the fixed BVID denominator, the Provider
  selection, the upload policy, the Origin/auth ordering and the relay
  inventories are unchanged.
* No public endpoint was added and no public error envelope changed.
* The machine receipt of a source is an INTERNAL evidence artefact. Its
  `provider.published` block now carries the COMPLETE frozen receipt identity
  (`structureMode` and `outboundDerivedTextSha256` were missing); no field
  was removed and no public shape changed.
* The durable action ledger gained no event and no enum value in this batch:
  `runtimeSynthesize` and the two detail stages were introduced by the
  previous (runner-closure) batch.

## The production Python was NOT touched

The batch changed JavaScript only. The targeted GC-B5R/comprehension Python
tests were therefore NOT re-run, as the corrective goal conditions them on a
production Python change. The relay v11 baseline and mutations were re-run
anyway, as a cheap proof that the relay scope is untouched: 50/50 and 16/16.

## The historical evidence

No historical evidence directory was edited. This batch created ONE new
package:

`docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-aggregate-integrity-correction-2026-10-24/`

The prior packages (`gc-b5r-b5-real-run-2026-10-24/`,
`gc-b5r-b5-offline-corrective-2026-10-24/`,
`gc-b5r-b5-final-offline-correction-2026-10-24/`,
`gc-b5r-b5-runner-closure-correction-2026-10-24/` and the Codex review
packages) were not touched.
