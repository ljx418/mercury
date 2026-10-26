# The handoff — GC-B5R B-5 Runner Closure Correction

## Module

```text
Module:        GC-B5R B-5 (V3-5.10 Stage B, the runner closure correction)
Owner Agent:   ClaudeCode (implementation agent)
Date:          2026-10-24
Stage Gate:    docs/active/project/design/v3-post-wp-b-completion-rebaseline.md (GC-B5R)
```

## Change summary

```text
Changed files:  22 modified, 3 removed, 0 new-in-the-source-tree fixture.
                The FULL final source set of the workpack area (49 files) is
                listed with its SHA-256 in 01-changed-file-hashes.json, so
                nothing is omitted and every carried file is marked as such.

Behavior added:
  RC1  The child grants are AUTHORITATIVE and ONE-USE. The trust anchor is
       the CONSUMPTION MARKER: it is created once, atomically (O_EXCL), and
       it holds the authoritative copy of every child grant's id and digest.
       A grant's own digest is a self-computed, unkeyed digest and is never
       an authority on its own: an entirely forged, self-signed grant is
       refused. The child verifies the marker, the supplied digest, the
       recomputed grant id, the registry digest, the exact ordered six
       identities, and it CONSUMES the grant atomically once, so a replay is
       refused. The superseded authorization implementation (which PERSISTED
       THE RAW AUTHORIZATION VALUE) was removed from action_ledger.mjs: there
       is ONE authorization owner and ONE API.
  RC2  The finalizer merges with EXPLICIT field semantics: the cleanup
       booleans converge false -> true, the cleanup failure is never erased,
       a published receipt may replace an earlier null but is never
       fabricated, the terminal pair (disposition + failure code) follows an
       explicit precedence, the timestamps and the attempt counts follow the
       final run state, and the evidence of a different run or source is
       never combined.
  RC3  The ACTUAL outbound Provider HTTP attempts are counted and separated
       from the Runtime synthesize endpoint invocation and from the
       publication. The count is owned by the production adapter (counted at
       the request boundary) and travels through the published receipt and
       the Runtime's INTERNAL diagnostic. No public endpoint was added.
  RC4  The process audit is OWNERSHIP-based: only the descendants of the
       sequencer's own child can be a leak. An unrelated run_one_bvid.mjs is
       neither counted nor killed. Every generated artefact (the patched
       sequencer copies, the sleeping runner, the stub runner) lives in a
       unique owned temporary directory and is deleted with it; the
       repository holds no generated file any more. The offline suite runs
       EVERY file concurrently.
  RC5  The path detector covers POSIX (including the one-segment form),
       Windows (the backslash AND the forward-slash drive form) and UNC
       paths, with a narrow STRUCTURED allowlist of the public routes. The
       changed-file inventory is built from the actual final source set.

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
  node scripts/stage_b_b5_3/test/run_offline_suite.mjs                       exit 0  (307 cases)
  node --test <the three files of the Codex command>                         exit 0  (30 cases)
  python3 -m pytest <the 8 GC-B5R/comprehension files> -q                     exit 0  (145 passed)
  python3 -m pytest tests/ -q                        (services/local-runtime) exit 0  (1218 passed, 3 skipped)
  python3 .../verify-stage-b-b5-3-background-capture-relay-v11-contract.py   exit 0  (50/50)
  python3 .../verify-stage-b-b5-3-background-capture-relay-v11-mutations.py  exit 0  (16/16)

Fixture evidence path:
  docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-runner-closure-correction-2026-10-24/

Real data evidence path:
  NONE. This batch is strictly offline: it used temporary roots and synthetic
  values only. The real-data evidence of the earlier visible run stays in
  gc-b5r-b5-real-run-2026-10-24/ and was NOT re-run and NOT edited.

Chrome evidence path, if applicable:
  NONE. Chrome launch count: 0.

Trace evidence path, if applicable:
  The durable action ledger of the production runs is
  <stageRoot>/stage-actions.jsonl; its schema and its integrity receipt are in
  the previous package. This batch wrote no external ledger line.
```

## PRD coverage

```text
Covered PRD IDs:
  The five closures RC1..RC5 of the GC-B5R B-5 runner closure correction,
  mapped case by case to a production oracle in
  08-case-to-production-oracle-map.md.

Not covered:
  * The visible six-video B-5 run itself (R1). It needs the separate
    real-run checkpoint.
  * The host semantic review and the independent B-7 audit. They happen once
    on the stable candidate.

Reason:
  The corrective goal is explicitly offline: "Use temporary roots and
  synthetic inputs only" and the external action counters must stay at zero.
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
    actionLedger.combinedLowerBound, and the ownership-based processAudit.
  * The per-source audit set of every source, now with the truthful failure
    evidence, the null publication when nothing was published, the CONVERGED
    cleanup booleans and the separated Provider attempt counts.
  * The durable stage ledger of the stage root: the providerCall total is
    the ACTUAL number of outbound Provider HTTP attempts, and the
    runtimeSynthesize total is the number of endpoint invocations.

Known assumptions:
  * The stage root is on a filesystem with an atomic exclusive create.
  * The ownership tracker reads the Linux process filesystem.
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
      enums and the failure codes are frozen vocabularies; the batch added
      ONE ledger event (`runtimeSynthesize`) and TWO detail stages to the
      INTERNAL, owned ledger.
- [x] I did not use mock-only evidence as real E2E evidence. This batch
      produced NO real evidence and says so: the external action counters are
      zero and the real-data evidence path is NONE.
- [x] I did not introduce any out-of-scope feature. No RAG, no memory, no
      orchestration, no browser automation, no file access, no network search,
      no voice, no desktop pet, no deep research, no PPT generation.
- [x] I did not announce a pass. The stop state is
      `GC-B5R B-5 RUNNER CLOSURE CORRECTION AWAITING CODEX CHECKPOINT`.
- [x] I did not enter B-6.

```text
GC-B5R B-5 RUNNER CLOSURE CORRECTION AWAITING CODEX CHECKPOINT
```
