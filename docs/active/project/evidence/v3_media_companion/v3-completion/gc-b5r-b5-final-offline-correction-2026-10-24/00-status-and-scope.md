# GC-B5R B-5 — Final Offline Correction

Batch: **GC-B5R B-5 FINAL OFFLINE CORRECTION**
Date: 2026-10-24
Stop state: `GC-B5R B-5 FINAL OFFLINE CORRECTION AWAITING CODEX CHECKPOINT`

## What this batch is

ONE strictly offline corrective batch for the V3-5.10 Stage B B-5 grounded
comprehension workpack. It implements the five corrections FC1..FC5 that the
Codex checkpoint asked for, proves each of them against a production oracle
(the real runner, the real sequencer, the real adapter), and produces this
evidence package.

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
of the batch is a local loopback double inside the test process; the
Provider adapter's transport is faked with `httpx.MockTransport`, so no
Provider request ever left the machine.

## What this batch is NOT

* It is **not** a Stage B, WP-B or V3 acceptance. No stage gate was closed
  and no gate is claimed.
* It does **not** re-run the visible six-video batch. The B-5 real run stays
  as it was recorded in
  `gc-b5r-b5-real-run-2026-10-24/`; this batch did not touch that evidence.
* It does **not** re-freeze the relay contract, change a public API, a public
  event, a public data model or an adapter contract. The relay v11 baseline
  and its mutation set were re-run and still pass; the relay scope was not
  touched.
* It does **not** enter B-6, B-7, WP-C, Stage C/D/E, V3-6 or V3-7.

## The five corrections

| id | correction | where it lives | proof |
|---|---|---|---|
| FC1 | the batch-owned, atomic, one-shot visible authorization | `scripts/stage_b_b5_3/lib/authorization.mjs`, `scripts/stage_b_b5_3/sequencer.mjs`, `scripts/stage_b_b5_3/run_one_bvid.mjs` | `03-fc1-authorization-proof.md` |
| FC2 | the strict production action ledger | `scripts/stage_b_b5_3/lib/action_ledger.mjs`, `scripts/stage_b_b5_3/lib/retained_logs.mjs` | `04-fc2-action-ledger-proof.md` |
| FC3 | truthful failure evidence and monotonic finalization | `scripts/stage_b_b5_3/run_one_bvid.mjs`, `scripts/stage_b_b5_3/lib/privacy.mjs` | `05-fc3-failure-evidence-proof.md` |
| FC4 | the exact candidate shape and the temporal enforcement | `services/local-runtime/navia_runtime/modules/media_companion/comprehension/diagnostics.py`, `.../synthesis.py` | `06-fc4-candidate-shape-proof.md` |
| FC5 | the real global Provider request cap | `services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py` | `07-fc5-request-cap-proof.md` |

## Contract statement

**No public contract changed.** The batch adds INTERNAL modules and INTERNAL
helpers:

* the frozen V2.1 candidate schema
  (`docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json`)
  is unchanged, and the frozen contract
  `stage-b-grounded-comprehension-contract.md`
  (SHA-256 `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8`)
  is unchanged;
* the adapter's candidate shape enforcement is STRICTER than before, not
  looser: the exact key sets of the top level, of the brief, of EVERY claim
  and of EVERY chapter are now enforced, and the conflict flag must be a real
  boolean. No candidate that the independent validator would refuse is now
  accepted, and no frozen rule was relaxed;
* the independent validator stays authoritative: the adapter never accepts a
  candidate, it only refuses a malformed one earlier;
* the new Python and JavaScript modules are internal: they change no public
  endpoint, no public error envelope, no public event and no stored data
  model;
* the relay v11 scope was NOT touched: the baseline is still 50/50 and the
  mutation set is still 16/16.

## The boundary of the acceptance

This batch proves the five corrections against the production code paths. It
does **not** prove that the six-video visible batch succeeds: that remains a
separate real-run checkpoint, and the visible batch was not run here.

## The historical evidence

No historical evidence was edited. The batch READ the retained logs of the
earlier attempts (read-only) to compute the historical lower bound, and it
created ONE new evidence package:

`docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-final-offline-correction-2026-10-24/`

The prior packages (`gc-b5r-b5-real-run-2026-10-24/`,
`gc-b5r-b5-offline-corrective-2026-10-24/`) are byte-identical to their state
before this batch.
