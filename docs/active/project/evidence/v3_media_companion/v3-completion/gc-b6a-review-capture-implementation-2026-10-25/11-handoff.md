# The handoff — GC-B6A Review Capture Implementation

## Module

```text
Module:        GC-B6A (V3-5.10 Stage B, the private review-capture tooling)
Owner Agent:   ClaudeCode (implementation agent)
Date:          2026-10-25
Stage Gate:    GC-B6A REVIEW-CAPTURE IMPLEMENTATION (the preimplementation package)
```

## Change summary

```text
Changed files:  17 written by this batch (4 new lib modules, 5 new test files,
                2 new test fixtures, the runner capture point and the five
                modules it touches). The FULL final source set of the
                workpack area (71 files) is listed with its SHA-256 in
                01-changed-file-hashes.json, and it separates this batch's
                files from the pre-existing dirty-worktree changes, which
                are preserved untouched.

Behavior added:
  * The PRIVATE review bundle contract and a fail-closed pure validator
    (`lib/review_bundle.mjs`): the exact file set, the exact wrapper key
    set, the identity closure, the FROZEN evidence catalog hash, the
    evidence text digests, the real PNG thumbnails, the seek window, the
    manifest, and the refusals of a secret, a private path, a raw media
    file, a Provider identity and a duplicate file.
  * The READ-ONLY capture adapter (`lib/review_capture.mjs`): the workspace
    metadata from the PUBLIC workspace route, the PNG from the
    AUTHENTICATED thumbnail route, the derived text from the runner-owned
    private root by the EXACT relative ref, the seek map, the atomic private
    write, the re-read and the re-validation.
  * The runner capture point: AFTER the durable V2.1 publication and BEFORE
    the owner cleanup, gated by an explicit private root, with a capture
    failure failing the candidate closed while the cleanup still runs.
  * The BLIND evaluator projection (`lib/blind_projection.mjs`): the
    Provider/model/endpoint/receipt text and the runtime paths are removed
    and the Provider receipt is replaced by an irreversible review binding
    hash.
  * The B-6 semantic aggregate (`lib/b6_aggregate.mjs`): the six rows and
    the repeated sentinel, the four frozen axes with a minimum of four, the
    critical errors, the rubric/prompt hashes, the visible Provider identity
    and the machine gate.
  * 54 fixed anti-false-green obligations, group by group, plus the REAL
    route composition, the private ref resolution, the capture boundary and
    the sentinel position/machine-gate cases.

Behavior intentionally not added:
  * no visible Chrome run, no Provider call, no download, no import, no
    Runtime media task, no Cookie read, no audio, no tabCapture, no focus
    action, no real BVID execution, no authorization consumption;
  * no change to the public API, to any schema, to the FailureCode
    inventory, to a threshold, to a message, to the Provider registry, to
    the Origin/auth order, to the frozen denominator or to the relay
    fixtures;
  * no new public API, event or data model;
  * no relaxation of an existing validator.
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
  node --test scripts/stage_b_b5_3/test/b6_review_bundle.node-test.mjs    exit 0  (24 cases)
  node --test scripts/stage_b_b5_3/test/b6_thumbnail_seek.node-test.mjs    exit 0  (10 cases)
  node --test scripts/stage_b_b5_3/test/b6_blind_projection.node-test.mjs exit 0  (8 cases)
  node --test scripts/stage_b_b5_3/test/b6_lifecycle.node-test.mjs       exit 0  (7 cases)
  node --test scripts/stage_b_b5_3/test/b6_aggregate.node-test.mjs        exit 0  (11 cases)
  node --test <the three files of the previous Codex command>                exit 0  (30 cases)
  node scripts/stage_b_b5_3/test/run_offline_suite.mjs                    exit 0  (517 cases)
  python3 -m pytest <the 9 focused GC-B5R/comprehension files> -q           exit 0  (183 passed)
  python3 -m pytest tests/ -q                    (services/local-runtime) exit 0  (1256 passed, 3 skipped)
  relay v11 contract verifier                                             exit 0  (50/50)
  relay v11 mutation verifier                                            exit 0  (16/16)

Fixture evidence path:
  docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6a-review-capture-implementation-2026-10-25/

Real data evidence path:
  NONE. This batch is strictly offline: temporary roots and synthetic values
  only. The composition case drives the REAL product routes of a SEEDED
  SYNTHETIC task; it downloads nothing and it calls no Provider.

Chrome evidence path, if applicable:
  NONE. Chrome launch count: 0.

Trace evidence path, if applicable:
  The durable action ledger of the production runs is
  <stageRoot>/stage-actions.jsonl. This batch wrote no external ledger line;
  the ledgers of the offline tests live in temporary roots that are removed
  with them. The zero-action receipt is 09-zero-action-receipt.json.
```

## PRD coverage

```text
Covered PRD IDs:
  The B6A implementation and the 54 fixed obligations of the acceptance
  plan, mapped case by case to a production oracle in
  03-case-to-production-oracle-map.md and grouped in 05-obligation-map.json.

Not covered:
  * The fresh six-video candidate with the capture tool (R1). It is GC-B6B and
    it is NOT authorized yet.
  * The blind host semantic review and the independent B-7 audit. They happen
    once on the stable candidate, in another session.

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
  * ONE explicit PRIVATE review root (NAVIA_B6_PRIVATE_ROOT), outside the
    repository and at 0700, for GC-B6B.

Outputs Integration should consume:
  * The PRIVATE per-source review bundles of the fresh candidate.
  * The six BLIND evaluator projections (one per source).
  * The six per-source rubric receipts and the repeated sentinel receipt.
  * The B-6 aggregate verdict: the scores, the stable critical error codes,
    the object indexes, the hashes, the counts and the cleanup proof.
  * The public machine receipts: the bundle hash, the counts, the status and
    the closure ONLY.

Known assumptions:
  * The stage root is on a filesystem with an atomic exclusive create.
  * The private root is outside the repository and at 0700.
  * The shared JavaScript validator stays equivalent to the production
    `jsonschema` for the frozen contract file.
  * The workspace projection and the thumbnail route are the product's own
    routes; the capture reads them and never writes into the product.

Known risks:
  * R1..R8 in 10-prd-coverage-and-risks.md. R1 (no fresh candidate yet)
    and R2 (a concurrent change writes the derivative bytes into the public
    evidence set) are the two that matter for the checkpoint.

Stop conditions:
  * Any refusal of the authorization, of a child grant or of the ledger
    integrity stops the batch BEFORE any external action.
  * A capture failure fails the candidate closed and the owner cleanup still
    runs.
  * The FIRST owned process leak stops the batch, and only the owned
    descendants are cleaned.
  * The visible six-video batch is NOT authorized here: the batch must not
    consume a new visible-run authorization.
```

## No-Go self check

- [x] I did not edit another module's implementation directory. The batch
      touches the B-5 runner scripts, the B-5 tests and the comprehension
      test area only; the production Python was NOT changed by this batch.
- [x] I did not bypass the D Adapter Layer or governance. The capture is
      READ ONLY; it never writes into the product, never re-generates
      evidence and never mutates the Runtime or the task store.
- [x] I did not create ad-hoc event strings. The capture failure uses an
      INTERNAL runner code, not a product FailureCode.
- [x] I did not use mock-only evidence as real E2E evidence. The
      composition case drives the REAL product routes; this batch produced
      NO real evidence and says so: the external action counters are zero.
- [x] I did not weaken any validator. The bundle validator, the projection
      privacy scanner and the aggregate are all fail-closed.
- [x] I did not introduce any out-of-scope feature.
- [x] I did not announce a pass. B-6, Stage B and V3 are NOT complete. The
      stop state is
      `GC-B6A REVIEW-CAPTURE IMPLEMENTED AWAITING CODEX CHECKPOINT`.
- [x] I did not enter B6B, B7 or Stage C, I did not consume a visible-run
      authorization, I did not re-freeze the relay contract, and I did not
      commit, push, reset, clean, check out or revert anything. Every
      historical evidence directory is untouched.

```text
GC-B6A REVIEW-CAPTURE IMPLEMENTED AWAITING CODEX CHECKPOINT
```
