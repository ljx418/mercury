# GC-B5R B-5 — Runner Closure Correction

Batch: **GC-B5R B-5 RUNNER CLOSURE CORRECTION**
Date: 2026-10-24
Stop state: `GC-B5R B-5 RUNNER CLOSURE CORRECTION AWAITING CODEX CHECKPOINT`

## What this batch is

ONE strictly offline closure batch for the V3-5.10 Stage B B-5 runner. It
closes the five corrections RC1..RC5 that the Codex review asked for.

**No external action happened.** The external action counters of this batch
are all zero:

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
adapter's transport is faked with `httpx.MockTransport`, so no Provider
request ever left the machine.

## The five closures

| id | closure | where it lives | proof |
|---|---|---|---|
| RC1 | the child grants are AUTHORITATIVE and ONE-USE | `scripts/stage_b_b5_3/lib/authorization.mjs`, `scripts/stage_b_b5_3/run_one_bvid.mjs` | `03-rc1-authorization-proof.md` |
| RC2 | the finalizer merges with EXPLICIT field semantics | `scripts/stage_b_b5_3/lib/audit_finalizer.mjs`, `scripts/stage_b_b5_3/run_one_bvid.mjs` | `04-rc2-finalizer-semantics-proof.md` |
| RC3 | the ACTUAL outbound Provider HTTP attempts are counted | `scripts/stage_b_b5_3/lib/action_ledger.mjs`, `scripts/stage_b_b5_3/run_one_bvid.mjs`, `.../comprehension/synthesis.py`, `.../comprehension/service.py` | `05-rc3-provider-attempt-accounting-proof.md` |
| RC4 | the process ownership is scoped and the generated fixtures are isolated | `scripts/stage_b_b5_3/lib/process_ownership.mjs`, `scripts/stage_b_b5_3/lib/sequencer_copy.mjs`, `scripts/stage_b_b5_3/sequencer.mjs` | `06-rc4-process-ownership-proof.md` |
| RC5 | the privacy detector covers POSIX / Windows / UNC with a narrow structured allowlist | `scripts/stage_b_b5_3/lib/privacy.mjs` | `07-rc5-privacy-proof.md` |

## The previously failing Codex command

```text
node --test \
  scripts/stage_b_b5_3/test/authorization_composition.node-test.mjs \
  scripts/stage_b_b5_3/test/structured_failure_evidence.node-test.mjs \
  scripts/stage_b_b5_3/test/privacy_scan.node-test.mjs
```

It failed with 2..4 failures. It now passes with **30/30** and exit 0. The
cause was the NAME-BASED process audit of the sequencer: it counted the
`run_one_bvid.mjs` of ANOTHER test as a leak of its own run. The audit is
now OWNERSHIP-based.

## The contract statement

**No public contract changed.**

* The frozen V2.1 candidate schema and the frozen V2.1 derivative schema are
  unchanged; the frozen Stage B contract is unchanged.
* The FailureCode inventories are unchanged: the batch CONSUMES the frozen
  codes and adds none.
* The aggregate thresholds, the fixed BVID denominator, the Provider
  selection, the upload policy, the Origin/auth ordering and the relay
  inventories are unchanged.
* No public endpoint was added. The Provider attempt count travels through
  the receipt that already existed and through the Runtime's INTERNAL
  diagnostic, which is a private file.
* The durable action ledger gained ONE event (`runtimeSynthesize`) and TWO
  detail stages. The ledger is an internal, owned, append-only file of the
  runner; it is not a public contract.
* The machine receipt of a source is an internal evidence artefact. Its
  `provider.attempted` block now separates the endpoint invocation count
  from the outbound attempt count; no field was removed.

## What this batch is NOT

* It is **not** a Stage B, WP-B or V3 acceptance. No gate was closed and no
  gate is claimed.
* It does **not** re-run the visible six-video batch. That still needs the
  separate GC-B5R real-run checkpoint.
* It does **not** re-freeze the relay contract. The relay scope was not
  touched: the v11 baseline is still 50/50 and the mutation set is still
  16/16.
* It does **not** enter B-6, B-7, WP-C, Stage C/D/E, V3-6 or V3-7.

## The historical evidence

No historical evidence directory was edited. This batch created ONE new
package:

`docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-runner-closure-correction-2026-10-24/`

The prior packages (`gc-b5r-b5-real-run-2026-10-24/`,
`gc-b5r-b5-offline-corrective-2026-10-24/`,
`gc-b5r-b5-final-offline-correction-2026-10-24/`) verify against their own
manifests and were not touched.
