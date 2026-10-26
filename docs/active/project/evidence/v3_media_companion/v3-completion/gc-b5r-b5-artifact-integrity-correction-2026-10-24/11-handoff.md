# The handoff — GC-B5R B-5 Artifact Integrity Correction

## Module

```text
Module:        GC-B5R B-5 (V3-5.10 Stage B, the artifact integrity correction)
Owner Agent:   ClaudeCode (implementation agent)
Date:          2026-10-24
Stage Gate:    docs/active/project/design/v3-post-wp-b-completion-rebaseline.md (GC-B5R)
```

## Change summary

```text
Changed files:  5 modified, 4 new, 0 removed.
                The FULL final source set of the workpack area (54 files) is
                listed with its SHA-256 in 01-changed-file-hashes.json, so
                nothing is omitted and every carried file is marked as such.

Behavior added:
  AI1  The published artifact BYTES are the oracle of a publication:
       * ONE contracted artifact name, `derivative-v2.1.json`, replaces the
         literal `<bvid>-evidence.json`; the name is resolved EXACTLY, with
         no directory search and no ambiguity;
       * the runner writes the EXACT durable bytes of the published
         derivative under that name and computes the receipt hash with the
         PRODUCTION canonical serialization
         (json.dumps(..., ensure_ascii=False, sort_keys=True,
          separators=(",", ":")));
       * the aggregate READS the bytes, PARSES them and validates them
         against the FROZEN v3-media-grounded-comprehension/v2.1 contract
         with a SHARED, EXACT validator that READS the frozen contract file
         (there is no reduced duplicate schema in the runner). Its exactness
         is proven against the production `jsonschema` library on 22
         fixtures;
       * the SHA-256 of the exact bytes is compared with EVERY declared
         derivative/evidence hash, the receipt hash is recomputed from the
         artifact bytes, and the task id, revision, source identity, run,
         receipt, Provider and endpoint identities are cross-bound;
       * missing or malformed evidence fails closed.
  AI2  The request and mirror false greens are closed:
       * a COMPLETE publication must have an integer requestCount >= 1, and
         any row with attemptCount > 0 must have an integer
         requestCount >= 1;
       * the candidate ledger runtimeSynthesize and providerCall totals must
         EXACTLY match the sums of the per-source attempted facts;
       * the mirror schema version must be exactly
         v3-5.10-b5-3-receipt-mirror/v2 and the mirror must have the EXACT
         required wrapper key set (ten keys, nothing missing, nothing
         extra);
       * the locked Provider id, endpoint class, provider lock and
         derived-text scope are REQUIRED and EXACT, not optional
         conditional checks.
  AI3  The CI1 leak-sighting behavior is UNCHANGED and its process-level
       regression still proves that a sighting stays fatal after the child
       exits, that only the first source runs, that the owned descendant is
       cleaned and that an unrelated process stays alive.

Behavior intentionally not added:
  * no visible Chrome run, no Provider call, no download, no import, no
    media task, no Cookie read, no audio, no tabCapture, no focus event;
  * no change to the public API, to any frozen schema, to the FailureCode
    inventory, to a threshold, to a message, to the Provider registry, to
    the Origin/auth order or to the frozen denominator;
  * no new public API, event or data model;
  * no weakening of a validator and no rewriting of an expected output to
    fit the implementation: the positive stubs were made STRICTER;
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
  node --test scripts/stage_b_b5_3/test/artifact_integrity.node-test.mjs   exit 0  (12 cases)
  node --test scripts/stage_b_b5_3/test/sequencer.node-test.mjs             exit 0  (45 cases)
  node --test <the three files of the Codex command>                        exit 0  (30 cases)
  node scripts/stage_b_b5_3/test/run_offline_suite.mjs                      exit 0  (343 cases)
  python3 -m pytest <the 9 focused GC-B5R/comprehension files> -q            exit 0  (164 passed)
  python3 -m pytest tests/ -q                    (services/local-runtime)   exit 0  (1237 passed, 3 skipped)

Relay v11 baseline/mutations: NOT re-run — the relay scope is provably
  byte-identical (12 frozen hashes match; the newest modification of any
  file under the four discovery roots is 2026-10-20).

Fixture evidence path:
  docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-artifact-integrity-correction-2026-10-24/

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
  The two closures AI1 and AI2 of the GC-B5R B-5 artifact integrity
  correction, mapped case by case to a production oracle in
  06-case-to-production-oracle-map.md.

Not covered:
  * The visible six-video B-5 run itself (R1). It needs the separate
    real-run checkpoint and a NEW visible-run authorization.
  * The host semantic review and the independent B-7 audit. They happen once
    on the stable candidate.

Reason:
  The corrective goal is explicitly offline: "Not authorized: Chrome launch,
  Cookie read/injection, Provider/network call, media download/import, Runtime
  media task, visible action, new BVID execution, authorization
  consumption…".
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
    separated Provider attempt counts and the COMPLETE publication shape.
  * The durable stage ledger of the stage root: the providerCall total is
    the ACTUAL number of outbound Provider HTTP attempts and the
    runtimeSynthesize total is the number of endpoint invocations. The
    aggregate REQUIRES that they equal the per-source attempted facts.

Known assumptions:
  * The stage root is on a filesystem with an atomic exclusive create.
  * The ownership tracker reads the Linux process filesystem.
  * The shared JavaScript validator stays equivalent to the production
    `jsonschema` for the frozen contract file (the equivalence test proves
    it on every run).

Known risks:
  * R1..R7 in 10-prd-coverage-and-risks.md. R1 (the visible run has not been
    re-run with the corrected code) is the one that matters for the next
    checkpoint.

Stop conditions:
  * Any refusal of the authorization, of a child grant or of the ledger
    integrity stops the batch BEFORE any external action.
  * The FIRST owned process leak stops the batch, and only the owned
    descendants are cleaned.
  * A complete source whose artifact is missing, malformed, invalid,
    mismatched or stale fails closed and can never make the candidate
    positive.
  * A first unexpected failure in the visible run stops the batch after ONE
    redacted diagnostic, with the owned resources cleaned up.
```

## No-Go self check

- [x] I did not edit another module's implementation directory. The batch
      touches the B-5 runner scripts, the B-5 tests and one new Python
      TEST; the production Python was NOT touched.
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
      implementation. The positive stubs were made STRICTER and the frozen
      receipt identity got stricter.
- [x] I did not introduce any out-of-scope feature.
- [x] I did not announce a pass and I did not claim B-5 or V3 complete. The
      stop state is
      `GC-B5R B-5 ARTIFACT INTEGRITY CORRECTION AWAITING CODEX CHECKPOINT`.
- [x] I did not enter B-6, I did not consume a visible-run authorization
      and I did not re-freeze the relay contract.

```text
GC-B5R B-5 ARTIFACT INTEGRITY CORRECTION AWAITING CODEX CHECKPOINT
```
