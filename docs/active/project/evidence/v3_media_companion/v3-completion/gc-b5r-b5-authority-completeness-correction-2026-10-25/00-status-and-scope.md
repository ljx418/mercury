# GC-B5R B-5 — Authority Completeness Correction

Batch: **GC-B5R B-5 AUTHORITY COMPLETENESS CORRECTION**
Date: 2026-10-25
Stop state: `GC-B5R B-5 AUTHORITY COMPLETENESS CORRECTION AWAITING CODEX CHECKPOINT`

## What this batch is

ONE bounded offline correction. It closes the three findings of the Codex
review of the publication-semantic-binding batch
(`gc-b5r-b5-authority-completeness-codex-review-2026-10-25/00-codex-review.md`
and its `01-independent-reproductions.json`):

* **AC1** — the PRESENT machine fields were not fully bound to the frozen
  authority: the source adapter was free, the task namespace was only a
  non-empty string, `task_namespace.json` was never parsed, and the
  timestamps were regex-only.
* **AC2** — the machine disposition was still OPTIONAL: deleting it from the
  six receipts disabled the comparison.
* **AC3** — the exported schema-validation entry point still failed OPEN on
  an unsupported keyword.

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
  gate is claimed; **B-5, Stage B and V3 are NOT complete**.
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
| AC1 | every machine identity field is bound to the FROZEN authority: the literal portal/adapter, the frozen namespace shape, the PARSED namespace receipt and finite UTC instants | `scripts/stage_b_b5_3/lib/machine_identity.mjs`, `scripts/stage_b_b5_3/lib/aggregate.mjs`, `scripts/stage_b_b5_3/sequencer.mjs` | `03-ac1-identity-authority-proof.md` |
| AC2 | the machine disposition is a MANDATORY, typed terminal field compared unconditionally | `scripts/stage_b_b5_3/lib/machine_identity.mjs`, `scripts/stage_b_b5_3/lib/aggregate.mjs` | `04-ac2-machine-disposition-proof.md` |
| AC3 | the public schema-validation entry point enforces the keyword support ITSELF | `scripts/stage_b_b5_3/lib/v21_artifact.mjs` | `05-ac3-schema-entry-proof.md` |

## The contract statement

**No public contract changed.**

* The frozen V2.1 candidate schema, the frozen V2.1 derivative schema and
  the frozen Stage B contract are byte-identical. The batch READS the frozen
  derivative contract; it does not touch it.
* The FailureCode inventories are unchanged. The two new aggregate failure
  codes (`AGG_MACHINE_TERMINAL_INVALID`, `AGG_NAMESPACE_RECEIPT_INVALID`)
  belong to the INTERNAL aggregate evaluator.
* The aggregate thresholds, the fixed BVID denominator, the Provider
  selection, the upload policy and the Origin/auth ordering are unchanged.
* No public endpoint was added and no public error envelope changed.
* The durable action ledger gained no event and no enum value.
* The task namespace receipt, the machine receipt and the source identity now
  carry the SAME shapes the product already uses
  (`media_task_<32 hex>`, `portal:bilibili:<bvid>:<unit>:<part>`); nothing
  new was invented.

## The production Python was not touched

The batch changed no production Python file and no shared Python code. The
focused Python schema/canonical equivalence tests were run; the broader
Runtime suite was not required.

## The relay scope was not touched

The relay v11 gate was NOT re-run: the relay scope is provably
byte-identical (the 12 frozen relay hashes match and the newest modification
of any file under the four discovery roots is 2026-10-20). The proof is in
`02-commands-and-exits.md`.

## The historical evidence

No historical evidence directory was edited. This batch created ONE new
package:

`docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-authority-completeness-correction-2026-10-25/`
