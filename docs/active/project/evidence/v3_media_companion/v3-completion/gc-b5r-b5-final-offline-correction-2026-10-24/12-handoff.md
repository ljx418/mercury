# The handoff — GC-B5R B-5 Final Offline Correction

## Module

```text
Module:        GC-B5R B-5 (V3-5.10 Stage B, grounded comprehension, six-video candidate)
Owner Agent:   ClaudeCode (implementation agent)
Date:          2026-10-24
Stage Gate:    docs/active/project/design/v3-post-wp-b-completion-rebaseline.md (GC-B5R)
```

## Change summary

```text
Changed files:  10 new, 14 modified, 3 removed debug artifacts.
                The full list with the SHA-256 of every file is in
                01-changed-file-hashes.json.

                NEW
                  scripts/stage_b_b5_3/lib/authorization.mjs       the one-shot authorization
                  scripts/stage_b_b5_3/lib/aggregate.mjs           the pure aggregate evaluator
                  scripts/stage_b_b5_3/lib/privacy.mjs             the path / secret / code helpers
                  scripts/stage_b_b5_3/lib/retained_logs.mjs       the retained-log collector
                  scripts/stage_b_b5_3/lib/temp_roots.mjs          the owned temporary roots
                  scripts/stage_b_b5_3/test/authorization_composition.node-test.mjs
                  scripts/stage_b_b5_3/test/privacy_scan.node-test.mjs
                  scripts/stage_b_b5_3/test/structured_failure_evidence.node-test.mjs
                  services/local-runtime/navia_runtime/modules/media_companion/comprehension/diagnostics.py
                  services/local-runtime/tests/test_v3_gc_b5r_final_offline_correction.py

                MODIFIED
                  scripts/stage_b_b5_3/lib/action_ledger.mjs       the strict ledger + the reconciliation
                  scripts/stage_b_b5_3/sequencer.mjs                the authorization owner + the ledger report
                  scripts/stage_b_b5_3/run_one_bvid.mjs            the grant gate + the truthful evidence
                  seven offline test files                        the owned temporary roots

                REMOVED
                  scripts/stage_b_b5_3/test/_fixtures/dbg_sequencer.mjs
                  scripts/stage_b_b5_3/test/_fixtures/dbg_stub.mjs
                  scripts/stage_b_b5_3/test/_fixtures/sequencer_dbg.mjs
                  (unused debug artifacts of this workpack; never referenced by a test)

Behavior added:
  FC1  The sequencer owns a batch authorization. It is consumed EXACTLY ONCE,
       atomically (O_EXCL), keyed by a one-way digest, BEFORE any external
       action, and it issues a durable child grant per source. A child only
       VERIFIES its grant; it never consumes the identifier. The raw
       authorization value is never persisted. Corrupt state fails closed.
  FC2  A strict, append-only production action ledger with an exact record
       schema, an integrity flag that prevents a positive aggregate verdict,
       and a summary that reports the candidate totals, the stage lifetime
       totals, the retained-log historical lower bound (34) and a labelled
       combined lower bound — with no double counting and no guessed value.
  FC3  The failure evidence records the exact safe failure code of a
       structured Runtime response, the attempted Provider facts, a null
       publication, an accurate ledger count, and no path and no secret
       sample. The finalization is a durable MONOTONIC merge: a known
       non-null fact never becomes null after a retry or a restart.
  FC4  The adapter enforces the EXACT key sets of the top level, of the
       brief, of EVERY claim and of EVERY chapter, requires a real boolean
       conflict flag, and applies the SAME temporal validation and the SAME
       bounded same-Provider regeneration to the initial route AND to
       repair_v2() through ONE shared function.
  FC5  A real global Provider request cap of 8 per adapter instance, enforced
       immediately before every outbound HTTP attempt in the lowest common
       send path, shared by the extraction, the candidate generation, the
       shape repair, the temporal repair and repair_v2().

Behavior intentionally not added:
  * no visible Chrome run, no Provider call, no download, no import, no media
    task, no Cookie read, no audio, no tabCapture, no focus event;
  * no change to the frozen V2.1 candidate schema, to the frozen V2.1
    derivative schema, to the frozen contract, to the FailureCode
    inventory, to the aggregate thresholds, to the fixed BVID denominator,
    to the Provider selection, to the upload policy or to the relay
    inventories;
  * no new public API, event or data model;
  * no acceptance of a candidate by the adapter: the independent validator
    stays authoritative;
  * no relaxation of any frozen rule.
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
  node scripts/stage_b_b5_3/test/run_offline_suite.mjs                       exit 0  (279 cases)
  python3 -m pytest <the 8 GC-B5R/comprehension files> -q                     exit 0  (142 passed)
  python3 -m pytest tests/ -q                        (services/local-runtime) exit 0  (1215 passed, 3 skipped)
  python3 .../verify-stage-b-b5-3-background-capture-relay-v11-contract.py   exit 0  (50/50)
  python3 .../verify-stage-b-b5-3-background-capture-relay-v11-mutations.py  exit 0  (16/16)

Fixture evidence path:
  docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-final-offline-correction-2026-10-24/

Real data evidence path:
  NONE. This batch is strictly offline: it used temporary roots and synthetic
  values only. The real-data evidence of the earlier visible run stays in
  gc-b5r-b5-real-run-2026-10-24/ and was NOT re-run and NOT edited.

Chrome evidence path, if applicable:
  NONE. Chrome launch count: 0.

Trace evidence path, if applicable:
  The durable action ledger of the production runs is
  <stageRoot>/stage-actions.jsonl; its schema and its integrity receipt are in
  04-fc2-action-ledger-proof.md. This batch wrote no external ledger line.
```

## PRD coverage

```text
Covered PRD IDs:
  The five corrections FC1..FC5 of the GC-B5R B-5 final offline correction,
  mapped case by case to a production oracle in
  08-case-to-production-oracle-map.md.

Not covered:
  * The visible six-video B-5 run itself (R1). It needs the separate
    real-run checkpoint.
  * The host semantic review and the independent B-7 audit. They happen once
    on the stable candidate.

Reason:
  The corrective goal is explicitly offline: "All tests in this batch must
  use temporary roots and synthetic values" and "External action counts must
  remain zero".
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
    actionLedger.stageTotals, actionLedger.historicalLowerBound (34) and
    actionLedger.combinedLowerBound.
  * The per-source audit set of every source, now with the truthful failure
    evidence and the null publication when nothing was published.
  * The durable stage ledger of the stage root.

Known assumptions:
  * The stage root is on a filesystem with an atomic exclusive create.
  * The adapter instance is created per synthesis, so the request cap of 8
    is per synthesis.
  * The historical lower bound stays scoped to the B-5 stage packages.

Known risks:
  * R1..R8 in 11-prd-coverage-and-risks.md. R1 (the visible run has not been
    re-run with the corrected code) is the one that matters for the next
    checkpoint.

Stop conditions:
  * Any refusal of the authorization, of a child grant or of the ledger
    integrity stops the batch BEFORE any external action.
  * A first unexpected failure in the visible run stops the batch after ONE
    redacted diagnostic, with the owned resources cleaned up.
```

## No-Go self check

- [x] I did not edit another module's implementation directory. The batch
      touches the media_companion comprehension package and the B-5 runner
      scripts only.
- [x] I did not bypass the D Adapter Layer or governance. The adapter
      refuses a malformed candidate; it never accepts one, and the
      independent validator stays authoritative.
- [x] I did not create ad-hoc event strings. The ledger events, the detail
      enums and the failure codes are frozen vocabularies.
- [x] I did not use mock-only evidence as real E2E evidence. This batch
      produced NO real evidence and says so: the external action counts are
      zero and the real-data evidence path is NONE.
- [x] I did not introduce any out-of-scope feature. No RAG, no memory, no
      orchestration, no browser automation, no file access, no network search,
      no voice, no desktop pet, no deep research, no PPT generation.
- [x] I did not announce a pass. The stop state is
      `GC-B5R B-5 FINAL OFFLINE CORRECTION AWAITING CODEX CHECKPOINT`.
- [x] I did not enter the next workpack.

```text
GC-B5R B-5 FINAL OFFLINE CORRECTION AWAITING CODEX CHECKPOINT
```
