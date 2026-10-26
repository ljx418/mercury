# GC-B6B Review Decision

Batch: `GC-B6B FRESH SIX-SOURCE CANDIDATE + BLIND SEMANTIC REVIEW`
Run id: `gc-b6b-20261025T175243Z`

## The machine gate is NEGATIVE, so the blind review was NOT performed

```text
machine gate positive: false
counts: complete 2 / limited 3 / blocked 1 / failed 0 / total 6
```

The frozen B-6 policy requires six fresh COMPLETE rows and a positive
machine authority BEFORE any blind projection is generated. This candidate
has two complete rows, so:

- **no blind projection was generated** for any source;
- **no review row** and **no sentinel receipt** exist;
- **no semantic review was performed** and no score was produced;
- the precommitted review order, the two session ids and the sentinel
  positions stay UNUSED (they are recorded in `00-review-precommit.json` and
  they were frozen before the first external action).

The precommitment is deliberately NOT re-opened: the order was drawn before
the run and it is never changed after a result.

## The six source dispositions

| Order | BVID | Disposition | The stable cause |
|---|---|---|---|
| 1 | BV11t8w6oEtP | `limited` | `V3510B_EVIDENCE_CONFLICT_UNRESOLVED` (the candidate's own conflict disclosure) |
| 2 | BV1QcYx6VEAj | `blocked` | the Stage A authority did not converge within the frozen 7 minutes; no Provider call, no derivative and no bundle |
| 3 | BV1v58B6GEan | `limited` | `V3510B_BRIEF_COVERAGE_INSUFFICIENT` |
| 4 | BV1M5tJ6kEvw | `limited` | `V3510B_EVIDENCE_CONFLICT_UNRESOLVED` |
| 5 | BV1HTbi6LERi | `complete` | — |
| 6 | BV1qM9fB8Eb2 | `complete` | — |

The aggregate failures are `AGG_LIMITED_SOURCE` for the sources 1, 3 and 4
and `AGG_FAILED_SOURCE` ("only 2 sources are complete, at least 5 are
required").

## What DID close on the real data

The B-6 CAPTURE layer is healthy for the first time on real sources:

| Order | The capture | The bundle (production re-read + validation) | The manifest | Evidence / thumbnails / chapters |
|---|---|---|---|---|
| 1 | closed | valid | verified (14 files) | 107 / 8 / 6 |
| 2 | no capture (blocked before the synthesis) | — | — | — |
| 3 | closed | valid | verified (14 files) | 90 / 8 / 6 |
| 4 | closed | valid | verified (14 files) | 64 / 8 / 6 |
| 5 | closed | valid | verified (11 files) | 28 / 5 / 8 |
| 6 | closed | valid | verified (14 files) | 80 / 8 / 6 |

Every captured bundle closes the four capture closures (identity, catalog,
thumbnails, seek) and the real chapter-balance metrics of every published
derivative are INSIDE the frozen rules (the start concentration 0.33..0.50
and the span ratio 0.19..0.41). The GC-B6D balance owner and the GC-B6F
invariant block are confirmed on real data.

## The blockers, in order of what they cost

1. **The order-2 source never reached the synthesis.** The Stage A
   authority row did not converge within the frozen 7 minutes, so the source
   is `blocked` with NO Provider call, NO derivative and NO bundle. The
   same source produced a `degraded` task with no PNG-backed frame in the
   consumed GC-B6E confirmation, and a capture refusal in the consumed
   GC-B6B batch. It is a product/platform condition, not a capture defect.
2. **Three sources are `limited`** — two because the candidate disclosed an
   unresolved evidence conflict and one because the brief did not cover
   every region. These are honest product outcomes, not harness refusals:
   the capture closed and the bundle validated for every one of them.

## The decision

The candidate is NOT reviewable, the machine gate is negative and the blind
review is NOT performed. The batch stops here and returns to Codex.
