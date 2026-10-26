# The handoff — GC-B5R B-5 Aggregate Integrity Correction

## Module

```text
Module:        GC-B5R B-5 (V3-5.10 Stage B, the aggregate integrity correction)
Owner Agent:   ClaudeCode (implementation agent)
Date:          2026-10-24
Stage Gate:    docs/active/project/design/v3-post-wp-b-completion-rebaseline.md (GC-B5R)
```

## Change summary

```text
Changed files:  10 modified, 1 new, 0 removed.
                The FULL final source set of the workpack area (50 files) is
                listed with its SHA-256 in 01-changed-file-hashes.json, so
                nothing is omitted and every carried file is marked as such.

Behavior added:
  CI1  Every owned-process leak SIGHTING is preserved for the whole
       candidate. The source row is bound to the REAL processAuditBefore /
       processAuditAfter fields, the leak count of a row is the number of
       the LATCHED sightings of THAT source, and a sighting is never cleared
       by a later exit of the process. The batch stops after the FIRST owned
       leak and cleans ONLY the owned descendants; an unrelated process is
       never counted, never signalled and never terminated.
  CI2  A COMPLETE source requires a REAL publication: a nested
       provider.published with the full internal shape, a PARSED receipt
       mirror with the complete frozen V2.1 receipt identity, and a
       cross-binding to the mirror, the task, the run, the source, the
       artifact hashes, the locked Provider/endpoint and the hard-zero
       upload counters. The candidate ledger totals are fed into the
       aggregate and must equal the sum of the per-source attempted facts.
       The permitted pre-synthesis blocked case is explicit, and an
       attempted synthesis with an UNKNOWN Provider HTTP count is never a
       positive candidate.
  +    The defensive typo in mergeMachineReceipt() is fixed (the second type
       check now tests `next`), and isRealPublication() is strengthened to
       the full internal publication shape the runner writes.

Behavior intentionally not added:
  * no visible Chrome run, no Provider call, no download, no import, no
    media task, no Cookie read, no audio, no tabCapture, no focus event;
  * no change to the frozen V2.1 candidate schema, to the frozen V2.1
    derivative schema, to the frozen contract, to the FailureCode
    inventory, to the aggregate thresholds, to the fixed BVID denominator,
    to the Provider selection, to the upload policy or to the relay
    inventories;
  * no new public API, event or data model;
  * no acceptance of a candidate by the adapter: the independent validator
    stays authoritative;
  * no relaxation of any frozen rule;
  * the oracle was NOT weakened: the positive stubs were made STRICTER.
```

## Contract status

```text
Public API changed:       no
Adapter contract changed: no
Data model changed:       no
Event type changed:       no
Frozen schema changed:    no
Relay inventory changed:  no
If yes, V1.2-0 review path: NOT APPLICABLE — nothing public changed, so no
                            review path is required. If the checkpoint finds
                            that a public or security boundary must change,
                            the batch stops and the decision goes to Codex.
```

## Evidence

```text
Unit/contract tests run:
  node --test scripts/stage_b_b5_3/test/sequencer.node-test.mjs        exit 0  (31 cases)
  node --test scripts/stage_b_b5_3/test/audit_finalizer.node-test.mjs  exit 0  (12 cases)
  node --test scripts/stage_b_b5_3/test/provider_attempt_accounting…    exit 0  (5 cases)
  node --test scripts/stage_b_b5_3/test/real_branches.node-test.mjs    exit 0  (8 cases)
  node --test <the three files of the Codex command>                   exit 0  (30 cases)
  node scripts/stage_b_b5_3/test/run_offline_suite.mjs                 exit 0  (317 cases)
  python3 .../verify-stage-b-b5-3-background-capture-relay-v11-contract.py  exit 0  (50/50)
  python3 .../verify-stage-b-b5-3-background-capture-relay-v11-mutations.py exit 0  (16/16)

Targeted Python tests: NOT RUN — the batch touched NO production Python
                       file (the inventory lists JavaScript only), and the
                       goal conditions that run on a production Python
                       change.

Fixture evidence path:
  docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-aggregate-integrity-correction-2026-10-24/

Real data evidence path:
  NONE. This batch is strictly offline: it used temporary roots and synthetic
  values only. The real-data evidence of the earlier visible run stays in
  gc-b5r-b5-real-run-2026-10-24/ and was NOT re-run and NOT edited.

Chrome evidence path, if applicable:
  NONE. Chrome launch count: 0.

Trace evidence path, if applicable:
  The durable action ledger of the production runs is
  <stageRoot>/stage-actions.jsonl. This batch wrote no external ledger line;
  the ledgers of the offline tests live in temporary roots that are removed
  when the test process exits.
```

## PRD coverage

```text
Covered PRD IDs:
  The two closures CI1 and CI2 of the GC-B5R B-5 aggregate integrity
  correction, mapped case by case to a production oracle in
  05-case-to-production-oracle-map.md.

Not covered:
  * The visible six-video B-5 run itself (R1). It needs the separate
    real-run checkpoint and a NEW visible-run authorization.
  * The host semantic review and the independent B-7 audit. They happen once
    on the stable candidate.

Reason:
  The corrective goal is explicitly offline: "No Chrome, Runtime media task,
  Provider call, Cookie read/injection, download, import, audio output,
  tabCapture, focus action, or real BVID run is authorized."
```

## Integration handoff

```text
Inputs Integration must provide:
  * ONE batch authorization identifier in the sequencer's environment
    (NAVIA_B5_AUTHORIZATION_ID) and ONE owned stage root
    (NAVIA_B5_STAGE_ROOT), for the visible run.
  * The canonical v2 registry (unchanged) and its digest
    9c2da2f4c4c16fc94e1e0d7dfc9362ab1177d2db53f63d4af5a81a44795c9454.
  * The locked Provider selection: minimax-cn-openai-vision /
    minimax_chat_completions, through the supported bootstrap.

Outputs Integration should consume:
  * sequencer-summary.json — including actionLedger.candidateTotals,
    actionLedger.stageTotals, actionLedger.historicalLowerBound (34),
    actionLedger.combinedLowerBound, the LATCHED processAudit (with its
    sightings and the killed owned pids) and the per-source
    attemptedFacts.
  * The per-source audit set of every source, now with the truthful
    failure evidence, the null publication when nothing was published, the
    CONVERGED cleanup booleans, the separated Provider attempt counts and the
    COMPLETE publication shape.
  * The durable stage ledger of the stage root: the providerCall total is
    the ACTUAL number of outbound Provider HTTP attempts and the
    runtimeSynthesize total is the number of endpoint invocations. The
    aggregate now REQUIRES that they equal the per-source attempted facts.

Known assumptions:
  * The stage root is on a filesystem with an atomic exclusive create.
  * The ownership tracker reads the Linux process filesystem.
  * The historical lower bound stays scoped to the B-5 stage packages.

Known risks:
  * R1..R8 in 09-prd-coverage-and-risks.md. R1 (the visible run has not been
    re-run with the corrected code) is the one that matters for the next
    checkpoint.

Stop conditions:
  * Any refusal of the authorization, of a child grant or of the ledger
    integrity stops the batch BEFORE any external action.
  * The FIRST owned process leak stops the batch, and only the owned
    descendants are cleaned.
  * A first unexpected failure in the visible run stops the batch after ONE
    redacted diagnostic, with the owned resources cleaned up.
```

## No-Go self check

- [x] I did not edit another module's implementation directory. The batch
      touches the B-5 runner scripts and the B-5 tests only; the production
      Python was NOT touched.
- [x] I did not bypass the D Adapter Layer or governance. The adapter
      refuses a malformed candidate; it never accepts one, and the
      independent validator stays authoritative.
- [x] I did not create ad-hoc event strings. The ledger events, the detail
      enums and the failure codes are frozen vocabularies; this batch added
      no ledger event and no enum value.
- [x] I did not use mock-only evidence as real E2E evidence. This batch
      produced NO real evidence and says so: the external action counters
      are zero and the real-data evidence path is NONE.
- [x] I did not introduce any out-of-scope feature.
- [x] I did not announce a pass. The stop state is
      `GC-B5R B-5 AGGREGATE INTEGRITY CORRECTION AWAITING CODEX CHECKPOINT`.
- [x] I did not enter B-6 and I did not consume a visible-run authorization.

```text
GC-B5R B-5 AGGREGATE INTEGRITY CORRECTION AWAITING CODEX CHECKPOINT
```
