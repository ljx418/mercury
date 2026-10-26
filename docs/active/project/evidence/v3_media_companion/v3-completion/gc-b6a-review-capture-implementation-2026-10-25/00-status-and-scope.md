# GC-B6A — Review Capture Implementation

Batch: **GC-B6A REVIEW-CAPTURE IMPLEMENTATION**
Date: 2026-10-25
Stop state: `GC-B6A REVIEW-CAPTURE IMPLEMENTED AWAITING CODEX CHECKPOINT`

## The coordinate

```text
V3 Chat + Know
-> V3-5.10 Stage B
-> GC-B5R B-5 machine gate: CLOSED (R8, 6/6 complete)
-> GC-B6A private review-capture tooling: IMPLEMENTED
-> GC-B6B fresh candidate + blind host semantic review: NOT AUTHORIZED YET
-> B-7 independent implementation exit: NOT STARTED
```

This batch implements ONLY the offline review-capture tooling. It does NOT
run the visible six-video batch, it does NOT consume a visible-run
authorization, and it does NOT enter B6B.

## What was built

```text
scripts/stage_b_b5_3/lib/review_bundle.mjs    the private bundle contract + the pure validator
scripts/stage_b_b5_3/lib/review_capture.mjs   the read-only capture adapter
scripts/stage_b_b5_3/lib/blind_projection.mjs  the blind evaluator projection
scripts/stage_b_b5_3/lib/b6_aggregate.mjs      the B-6 semantic aggregate + the sentinel
scripts/stage_b_b5_3/run_one_bvid.mjs          the capture point (after the publication, before the cleanup)
```

and the five offline test files that carry the 54 fixed obligations:

```text
scripts/stage_b_b5_3/test/b6_review_bundle.node-test.mjs      the identity/hash (12) and the evidence/text (10) closures
scripts/stage_b_b5_3/test/b6_thumbnail_seek.node-test.mjs      the thumbnail/seek (8) closures + the REAL route composition
scripts/stage_b_b5_3/test/b6_blind_projection.node-test.mjs   the blind/privacy (8) closures
scripts/stage_b_b5_3/test/b6_lifecycle.node-test.mjs         the lifecycle/cleanup (6) closures
scripts/stage_b_b5_3/test/b6_aggregate.node-test.mjs          the aggregate/sentinel (10) closures
```

## The capture point

The capture runs in the REAL runner, AFTER the durable V2.1 publication has
been validated and BEFORE the runner owner cleanup:

```text
run_one_bvid.mjs
  ... the derivative is read and validated (the frozen V2.1 contract) ...
  ledger.record("sourceCompletion", { stage: "synthesis_published" })
  finalizeAuditEvidence()
  >>> THE B-6 REVIEW CAPTURE (only with an explicit NAVIA_B6_PRIVATE_ROOT) <<<
  ... the finally path: the Runtime, the profile and the scratch are cleaned ...
```

* The workspace metadata comes from the PUBLIC workspace route
  (`GET /v1/media/tasks/<taskId>/comprehension`).
* The PNG comes from the AUTHENTICATED thumbnail route
  (`GET /v1/media/tasks/<taskId>/evidence/<evidenceId>/thumbnail`).
* The derived transcript/OCR/vision-caption text is read from the
  runner-owned Runtime private root, EXACTLY by the relative ref the
  workspace declares. There is no directory search.
* A capture FAILURE fails the candidate closed (a non-zero exit) and the
  owner cleanup in the finally path still runs.

## The private bundle

The private bundle may contain ONLY: the exact durable V2.1 derivative bytes,
the workspace metadata, the derived transcript/OCR/vision-caption text, the
PNG thumbnails, the seek map, the capture receipt and the manifest. It may
NEVER contain raw video or audio, a Cookie, a key, a bearer, a Provider
response or an absolute path. The validator refuses a bundle that carries
any of them.

The public capture receipt carries ONLY the bundle hash, the counts, the
status, the closure and the schema version: never a text, never an image
byte, never a file name and never a private path.

## The blind projection

The evaluator projection removes the Provider/model/endpoint/receipt text and
the runtime paths, and replaces the Provider receipt with an IRREVERSIBLE
review binding hash. The semantic content (brief, claims, chapters, quality),
the derived evidence text, the timestamps, the evidence ids, the thumbnails
and the seek map stay.

## The external action counters

Every external action counter of this batch is ZERO:

| external action | count |
|---|---|
| Chrome launches | 0 |
| visible windows | 0 |
| real media Runtime starts (a media TASK) | 0 |
| Provider requests | 0 |
| downloads | 0 |
| imports | 0 |
| media tasks | 0 |
| Cookie reads / injections | 0 |
| audio outputs | 0 |
| tabCapture actions | 0 |
| focus events | 0 |
| real BVID executions | 0 |

The receipt is `09-zero-action-receipt.json`. The composition case boots the
LOCAL product application (uvicorn) to drive the two REAL routes; it starts no
media task, it downloads nothing and it calls no Provider.

## The contract changes

**none.** No public API, schema, FailureCode, threshold, message, Provider
registry, Origin/auth order, frozen denominator or relay fixture was changed.
The private bundle, the blind projection and the B-6 aggregate are INTERNAL
acceptance-harness artefacts.

## The dirty worktree

The worktree was dirty before this batch and it stayed dirty. The changed-file
inventory separates the files THIS batch wrote (17) from the pre-existing
dirty changes (12), which are preserved untouched. Nothing was committed,
pushed, reset, cleaned, checked out or reverted, and no historical evidence
directory was edited.
