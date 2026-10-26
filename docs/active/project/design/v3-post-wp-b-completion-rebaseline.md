# V3 Post-WP-B Completion Rebaseline

Status: **GC-B5R OFFLINE IMPLEMENTATION MAY START**  
Date: 2026-10-23

## 1. Decision and current coordinate

This document is the current execution authority after completion of the media
input workpacks. It does not rewrite historical evidence or change a public
contract.

| Area | Current state | Decision |
|---|---|---|
| WP0 media input safety and relay | PASS | preserve; regression gate only |
| WP-A media dependency readiness | PASS | preserve; use its verified snapshot |
| WP-B explicit local media import | PASS, B01-B30 30/30 | preserve; use as the user-controlled fallback |
| WP-C tabCapture requalification | not started | defer; experimental/default-off |
| V3-5.10 Stage B B-5 | FAIL/REPLAN historically | resume as GC-B5R |
| V3-5.10 B-6/B-7 | not complete | wait for B-5 candidate |
| Stage C/D/E, V3-6/V3-7 | not complete | execute sequentially after Stage B exit |

`WP-B` means explicit local media import. `Stage B` means grounded
comprehension quality. New work must use the `GC-B5R` name so reports cannot
confuse these scopes.

## 2. Product route decision

The product keeps the ordered acquisition routes already defined by the PRD.
WP-A makes the controlled download toolchain observable and repairable. WP-B
adds an explicit user-selected local file after automatic routes are exhausted.
The local file must be the user's copy of the current source video and remains
bound to the original task/source identity.

WP-C is not a prerequisite. tabCapture remains experimental/default-off and
must not be silently enabled by GC-B5R. Requalification requires a new product
decision only if a concrete user scenario remains uncovered after WP-A/WP-B.

## 3. Remaining delivery sequence

### 3.1 GC-B5R-OFFLINE: implementation and preflight

Goal: produce one stable offline candidate without Provider calls, visible
Chrome, audio, or the fresh six-video run.

Required work:

1. Audit current Stage B production code, runner, fixtures, and current WP-A/B
   integration before editing. Reuse existing B-1..B-4, Route 2, Provider, and
   V2.1 implementations where valid.
2. Establish one source-authority adapter for Stage B input. Automatic routes
   and explicit local import may feed the same task, but a local asset is valid
   only when it is explicitly selected for that exact current source identity.
3. Preserve the six frozen BVID denominator and order. Never substitute a
   normal video, reuse a generic seed, or attach one video's bytes to another
   BVID. Restricted or unavailable videos remain `blocked` in the denominator.
4. Keep one Provider per task. No best-of-N, cross-Provider stitching, implicit
   fallback, threshold reduction, claim fabrication, transcript truncation, or
   post-hoc artifact reuse.
5. Preserve V2/V1 bytes and atomically publish only valid V2.1 derivatives.
   Fail closed on task/revision/catalog/source-identity drift.
6. Keep raw video, audio, frames, cookies, keys, bearer tokens, and private
   paths out of Provider requests and public evidence. Only already-authorized
   derived transcript/OCR/vision-caption text may cross the Provider boundary.
7. Add production-driven tests for route ordering, exact source binding,
   no-substitution, one-Provider locking, cancellation/restart cleanup, atomic
   publication, old-reader compatibility, and default-off tabCapture.
8. Run a non-invasive preflight over all six BVID identities. Record only
   availability and whether a matching authorized local asset is explicitly
   configured. Do not download, import, call a Provider, or start Chrome.

Exit: `GC-B5R OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT`, with no Fatal or
Major implementation finding. This exit does not pass B-5.

### 3.2 GC-B5R-RUN: fresh six-video B-5 run

Starts only after Codex accepts the offline candidate and the user is notified
about Provider/network/browser impact. Each frozen BVID gets a fresh Runtime,
database, profile, task, and evidence namespace. A matching local asset can be
used only through the real WP-B visible user path and only for its own BVID.

Machine exit:

- six `attempt_fresh` entries, no substitution, no cross-run artifact reuse;
- one Provider receipt per task and no cross-Provider composition;
- zero raw-media/secret/private-path upload;
- independent V2.1 artifact and durable receipt per successful task;
- all contract, grounding, temporal coverage, cleanup, and resource gates pass;
- at most one `blocked`; no `limited` or `failed` positive result;
- every real Chrome process has `--mute-audio`, is owned by the run, and is
  cleaned in `finally` without touching user Chrome or focus outside the one
  announced visible batch.

### 3.3 B-6 host semantic review

An evaluator independent of the implementation session reviews the six fresh
artifacts blind to Provider identity. Per video: accuracy, whole-span coverage,
content value/fit, and chapter boundary quality must each score at least 4/5;
critical errors are zero. Repeat one frozen sentinel and treat a changed thesis
or material claim reversal as Major. Model, prompt hash, session, inputs, and
rubric results are recorded without transcript or media content leakage.

### 3.4 B-7 independent implementation exit

Independently recompute the fixed denominator, production call path, upload
boundary, artifact hashes, cleanup, and B-6 rubric. Exit requires Fatal=0 and
Major=0. Only then may Stage C planning move from draft to implementation.

### 3.5 Stage C: visual workspace

Deliver stable frame preview, video-relative timeline, wheel/pointer/keyboard
navigation, screenshot-linked moments, seek receipts, and an evidence-backed
concept relation graph with movable persisted layout. Preserve old task
rendering. Plan and audit this stage separately after B-7.

### 3.6 Stage D: exports

Move long-form outputs out of Outline. Deliver at least five prompt-distinct
styles with coverage, length, real-frame selection, preview, cancellation,
recovery, repeatable hashes, and evidence closure. Generated imagery must never
be presented as a source frame.

### 3.7 Stage E, V3-6, and V3-7

Stage E combines six-video content review with interaction review of outline,
timeline, graph, seek, screenshot match, and user value. V3-6 runs the complete
12-page/media/web/Know matrix and replays signed human results without
substitution. V3-7 is the final independent audit. H01-H10 and the minimal
V3-5.1 interaction review remain human-signed items and are requested once on
the final stable candidate, not after each correction.

## 4. Validation and review cadence

- Each edit: targeted tests only.
- End of GC-B5R-OFFLINE: one affected Runtime suite, runner/static contract
  suite, extension media subtree only if changed, typecheck/build, relay v11
  baseline 50/50 and mutations 16/16.
- No full external audit during implementation corrections. Codex issues one
  consolidated checkpoint and one bounded corrective batch if needed.
- The six-video run, host semantic review, and independent B-7 audit happen
  once on the stable candidate.
- Visible Chrome is reserved for one announced batch. All other work is
  headless/no-window/no-audio/no-focus.

## 5. Change-control boundaries

GC-B5R-OFFLINE may change internal production code, tests, and runner assets
needed to close the defined production path. It may not change public API,
schemas, FailureCode inventories, fixed BVID denominator, thresholds, Provider
authorization, Origin/auth ordering, upload policy, WP-A/B acceptance records,
or relay inventories. A necessary public/security change is an immediate stop
and Codex decision, not an implementation convenience.

Frozen source hash drift caused solely by an authorized implementation is
reported once. ClaudeCode must not self-refreeze. Codex may perform one limited
refreeze after the candidate is stable and the semantic inventory is unchanged.

## 6. Evidence and status language

Every workpack reports changed files, contract changes or `none`, tests and
exit codes, production call-path mapping, real-data use count, Chrome/Provider/
audio count, secret and cleanup scans, PRD coverage, risks, and exact stop
reason. `PASS` is reserved for Codex after checkpoint. ClaudeCode uses
`AWAITING CODEX CHECKPOINT` and never enters the next phase on its own.
