# The handoff — GC-B5R B-5 Authority Completeness Correction

## Module

```text
Module:        GC-B5R B-5 (V3-5.10 Stage B, the authority completeness correction)
Owner Agent:   ClaudeCode (implementation agent)
Date:          2026-10-25
Stage Gate:    docs/active/project/design/v3-post-wp-b-completion-rebaseline.md (GC-B5R)
```

## Change summary

```text
Changed files:  9 modified, 0 new, 0 removed.
                The FULL final source set of the workpack area (58 files) is
                listed with its SHA-256 in 01-changed-file-hashes.json, so
                nothing is omitted and every carried file is marked as such.

Behavior added:
  AC1  Every machine identity field is bound to the FROZEN authority:
       * the source identity must PARSE and EQUAL the frozen authority: the
         literal portal `portal`, the literal adapter `bilibili`, the exact
         registry row BVID, and a non-empty playback unit and part;
       * the task namespace must satisfy the frozen task-namespace shape
         (`media_task_<32 hex>`) — an arbitrary non-empty string is a defect;
       * the sequencer PARSES `task_namespace.json` (its presence is not
         proof) and the aggregate requires the EXACT wrapper key set and
         binds the namespace, the run id, the order and the BVID to the
         machine receipt, the current run and the registry row;
       * the timestamps must denote FINITE, REAL UTC instants: an impossible
         calendar value (`2026-99-99…`, `2026-02-30…`, `T24:00:00`) is a
         defect and the input is never silently normalized, and
         `finish >= start` is required.
  AC2  The machine disposition is a MANDATORY, typed terminal field:
       * `disposition` joins the explicit machine terminal shape with the
         frozen vocabulary (complete, limited, blocked, failed);
       * it is compared UNCONDITIONALLY with the parsed final disposition: a
         missing disposition never disables the comparison;
       * missing, null, wrong type, unknown value and mismatch all fail
         closed with a stable internal code.
  AC3  The public schema-validation entry point is SELF-PROTECTING:
       * `validateAgainstSchema()` is the CHECKED public entry: it
         inventories the schema's keywords and refuses an unsupported one
         BEFORE the value is evaluated;
       * the recursive evaluator is PRIVATE and assumes the check passed, so
         the inventory runs exactly once per call;
       * the frozen-schema cache validation is retained.

Behavior intentionally not added:
  * no visible Chrome run, no Provider call, no download, no import, no
    media task, no Cookie read, no audio, no tabCapture, no focus event;
  * no change to the public API, to any frozen schema, to the FailureCode
    inventory, to a threshold, to a message, to the Provider registry, to
    the Origin/auth order, to the frozen denominator, to the relay fixtures
    or to the historical evidence;
  * no new public API, event or data model;
  * no weakening of a validator and no rewriting of an expected output to
    fit the implementation;
  * no relay refreeze, no visible-run authorization consumption, no B-6.
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
  node --test scripts/stage_b_b5_3/test/machine_identity.node-test.mjs    exit 0  (17 cases)
  node --test scripts/stage_b_b5_3/test/aggregate_identity.node-test.mjs exit 0  (30 cases)
  node --test scripts/stage_b_b5_3/test/schema_keywords.node-test.mjs    exit 0  (12 cases)
  node --test scripts/stage_b_b5_3/test/sequencer.node-test.mjs          exit 0  (73 cases)
  node --test scripts/stage_b_b5_3/test/artifact_integrity.node-test.mjs  exit 0  (20 cases)
  node --test scripts/stage_b_b5_3/test/real_branches.node-test.mjs      exit 0  (8 cases)
  node --test <the three files of the previous Codex command>            exit 0  (30 cases)
  node scripts/stage_b_b5_3/test/run_offline_suite.mjs                  exit 0  (438 cases)
  python3 -m pytest tests/test_v3_gc_b5r_v21_artifact_validator_equivalence.py -q
                                                                          exit 0  (22 passed)
  python3 -m pytest <the 9 focused GC-B5R/comprehension files> -q         exit 0  (167 passed)

Relay v11 baseline/mutations: NOT re-run — the relay scope is provably
  byte-identical (12 frozen hashes match; the newest modification of any
  file under the four discovery roots is 2026-10-20).

Broader Runtime suite: NOT run — neither production nor shared Python code
  changed in this batch.

Fixture evidence path:
  docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-authority-completeness-correction-2026-10-25/

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
  The three closures AC1, AC2 and AC3 of the GC-B5R B-5 authority
  completeness correction, mapped case by case to a production oracle in
  07-case-to-production-oracle-map.md.

Not covered:
  * The visible six-video B-5 run itself (R1). It needs the separate
    real-run checkpoint and a NEW visible-run authorization.
  * The host semantic review and the independent B-7 audit. They happen once
    on the stable candidate.

Reason:
  The corrective goal is explicitly offline: "Not authorized: Chrome, Cookie
  access/injection, Provider/network calls, media download/import, Runtime
  media tasks, visible actions, authorization consumption, real BVID
  execution…".
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
    sightings and the killed owned pids) and the per-source attemptedFacts.
  * The per-source audit set of every source, now with the CONTRACTED
    derivative artifact (`derivative-v2.1.json`) whose bytes are the
    published ones, the truthful failure evidence, the null publication
    when nothing was published, the CONVERGED cleanup booleans, the
    separated Provider attempt counts, the COMPLETE machine identity
    (including the namespace and the terminal disposition) and the COMPLETE
    publication shape.
  * The durable stage ledger of the stage root: the providerCall total is
    the ACTUAL number of outbound Provider HTTP attempts and the
    runtimeSynthesize total is the number of endpoint invocations. The
    aggregate REQUIRES that they equal the per-source attempted facts.

Known assumptions:
  * The stage root is on a filesystem with an atomic exclusive create.
  * The ownership tracker reads the Linux process filesystem.
  * The shared JavaScript validator stays equivalent to the production
    `jsonschema` for the frozen contract file (the inventory comparison
    proves it on every run).

Known risks:
  * R1..R8 in 11-prd-coverage-and-risks.md. R1 (the visible run has not been
    re-run with the corrected code) is the one that matters for the next
    checkpoint.

Stop conditions:
  * Any refusal of the authorization, of a child grant or of the ledger
    integrity stops the batch BEFORE any external action.
  * The FIRST owned process leak stops the batch, and only the owned
    descendants are cleaned.
  * A complete source whose artifact, identity, namespace receipt, terminal
    disposition or quality is missing, malformed, invalid, mismatched or
    stale fails closed and can never make the candidate positive.
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
- [x] I did not weaken a validator or rewrite an expected output to fit the
      implementation. The identity, the namespace receipt, the terminal
      disposition and the schema entry point are all STRICTER than before.
- [x] I did not introduce any out-of-scope feature.
- [x] I did not announce a pass and I did not claim B-5, Stage B or V3
      complete. The stop state is
      `GC-B5R B-5 AUTHORITY COMPLETENESS CORRECTION AWAITING CODEX CHECKPOINT`.
- [x] I did not enter B-6, I did not consume a visible-run authorization
      and I did not re-freeze the relay contract.

```text
GC-B5R B-5 AUTHORITY COMPLETENESS CORRECTION AWAITING CODEX CHECKPOINT
```
