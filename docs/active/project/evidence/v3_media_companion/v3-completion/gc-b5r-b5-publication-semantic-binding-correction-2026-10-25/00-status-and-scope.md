# GC-B5R B-5 — Publication Semantic Binding Correction

Batch: **GC-B5R B-5 PUBLICATION SEMANTIC BINDING CORRECTION**
Date: 2026-10-25
Stop state: `GC-B5R B-5 PUBLICATION SEMANTIC BINDING CORRECTION AWAITING CODEX CHECKPOINT`

## What this batch is

ONE bounded offline correction. It closes the three findings of the Codex
review of the artifact-integrity batch
(`gc-b5r-b5-publication-semantic-binding-codex-review-2026-10-24/00-codex-review.md`):

* **SB1** — a missing machine identity field disabled the cross-binding:
  absence was treated as permission to skip the comparison.
* **SB2** — the artifact quality was not bound to the final disposition: a
  `limited` artifact could be claimed as a `complete` row.
* **SB3** — the shared schema validator silently ignored an unsupported
  keyword instead of failing closed.

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
  gate is claimed; B-5, Stage B and V3 are NOT complete.
* It does **not** run the visible six-video batch and it does **not** consume
  a visible-run authorization.
* It does **not** re-freeze the relay contract and it does **not** change any
  public API, schema, FailureCode inventory, threshold, message, Provider
  registry, Origin/auth order, frozen denominator, relay fixture or
  historical evidence.
* It does **not** enter B-6, B-7, WP-C, Stage C/D/E, V3-6 or V3-7.

## The three closures

| id | closure | where it lives | proof |
|---|---|---|---|
| SB1 | the machine-receipt identity is MANDATORY and the artifact comparison is UNCONDITIONAL | `scripts/stage_b_b5_3/lib/machine_identity.mjs`, `scripts/stage_b_b5_3/lib/artifact_integrity.mjs`, `scripts/stage_b_b5_3/lib/aggregate.mjs` | `03-sb1-machine-identity-proof.md` |
| SB2 | the artifact quality is bound to the disposition by the PRODUCTION mapping | `scripts/stage_b_b5_3/lib/contracts.mjs`, `scripts/stage_b_b5_3/lib/aggregate.mjs`, `scripts/stage_b_b5_3/run_one_bvid.mjs` | `04-sb2-quality-disposition-proof.md` |
| SB3 | the schema keyword handling is FAIL-CLOSED, and the canonical serialization claim is scoped and proven byte by byte | `scripts/stage_b_b5_3/lib/v21_artifact.mjs`, `services/local-runtime/tests/test_v3_gc_b5r_v21_artifact_validator_equivalence.py` | `05-sb3-schema-keyword-proof.md` |

## The contract statement

**No public contract changed.**

* The frozen V2.1 candidate schema, the frozen V2.1 derivative schema and
  the frozen Stage B contract are byte-identical. The batch READS the frozen
  derivative contract; it does not touch it.
* The FailureCode inventories are unchanged. The new aggregate failure codes
  (`AGG_MACHINE_IDENTITY_INVALID`, `AGG_QUALITY_DISPOSITION_MISMATCH`)
  belong to the INTERNAL aggregate evaluator.
* The aggregate thresholds, the fixed BVID denominator, the Provider
  selection, the upload policy and the Origin/auth ordering are unchanged.
* No public endpoint was added and no public error envelope changed.
* The durable action ledger gained no event and no enum value.
* The PRODUCTION quality-to-disposition mapping moved from the runner into the
  shared contracts module and is now used by BOTH the runner and the
  aggregate: the rule is unchanged, it is only shared.

## The production Python was not touched; a shared Python validator was

The batch changed no production Python file. It extended ONE Python TEST
(the validator equivalence proof) with the structural keyword inventory and
the byte-for-byte canonical serialization comparison. The focused Python
tests were run; the broader Runtime suite was not required, because neither
production nor shared Python code changed.

## The relay scope was not touched

The relay v11 gate was NOT re-run: the relay scope is provably
byte-identical (the 12 frozen relay hashes match and the newest modification
of any file under the four discovery roots is 2026-10-20). The proof is in
`02-commands-and-exits.md`.

## The historical evidence

No historical evidence directory was edited. This batch created ONE new
package:

`docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-publication-semantic-binding-correction-2026-10-25/`
