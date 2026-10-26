# Stage A combined negative-journey acceptance plan

Date: 2026-10-12. Status: preimplementation audit candidate. Full Stage A
remains NO-GO; Stage B-D remain NO-GO. Source: approved
`design/v3-5.10-media-experience-repair-plan.md` and independent fixed-
denominator Stage A review. This substage does not change the V3 content
contract or authorize grounded-text upload.

## User scenarios and fixed denominator

Use isolated Runtime/database/Chrome/profile per run, real Bilibili page,
same-source task ID, real media route, and no cross-run artifact splicing.
The normal production flow must remain untouched; fault injection is
limited to delaying a request, disconnecting/restarting an isolated Runtime,
or closing a video tab. A failed run remains failed.

| ID | Operation | Required observable result |
|---|---|---|
| NJ-01 | Open embedded Chat, standalone Chat and Workspace before publication; wait for transcript preview | Nonempty timestamped transcript text is visibly labelled preview; no whole-video ready claim; all surfaces agree on task ID. |
| NJ-02 | Read elapsed/last-progress, reload Chat while same task is running, then reconnect | Timer derives from authoritative start, never resets to false zero; last-progress age advances; Workspace hides task content while disconnected and rereads ID/revision after reconnect. |
| NJ-03 | While all surfaces are open, cancel after real transcription and held visual materialization | Runtime authority and Chat/Workspace reach cancelled; no published stale outline, no private task residue; late materializer cannot revive task. |
| NJ-04 | Delay old-task read, navigate Workspace to another valid task-shaped ID and back | Wrong task never appears under new route; unknown ID is an error, not fabricated pending. |
| NJ-05 | Open absent/mismatched chapter ID, use recovery and keyboard | Visible route error, back to a valid task-scoped route, focus restored to a meaningful target. |
| NJ-06 | Seek a chapter/moment/frame with matching video tab, then close matching tab and seek again | First action has a truthful located/fallback receipt with observed time; second has blocked receipt and no silent navigation to a different video. |
| NJ-07 | Open evidence from a later chapter, use Escape/back | Returns to the exact chapter and focuses the originating evidence control; direct-open evidence route does not invent a return binding. |
| NJ-08 | Open synthesis/permission dialog and use keyboard only | Initial focus, Tab containment, Escape/cancel restoration, no hidden background activation; consent remains explicit. |
| NJ-09 | Run four widths (360/420/768/1280) on all newly touched states | Zero horizontal overflow and zero serious/critical Axe findings, nonblank pixel signal, controls reachable without overlap. |
| NJ-10 | Reconcile evidence and PRD | Exact run ID/source/revision bindings, failure artifacts retained, no mock/API-key/Cookie leak, no Stage B-D or final V3 PASS claim. |

## Design and risk gates

First reuse existing Stage A runners and typed Runtime APIs. Add a new
isolated browser runner only where existing scripts cannot represent a
negative journey without mutating earlier sealed evidence. Test assertions
must inspect raw DOM state, task IDs/revisions, Runtime authority and
observable seek receipts, not just button presence or screenshot byte size.
Product code changes, if any, require a same-scope addendum identifying the
failed case and a focused test before implementation. Do not lower Axe,
timeout or denominator gates to turn a run green.

Preimplementation audit: Fatal 0. Major 0 in the proposed test architecture;
the Stage A acceptance **itself** still has the unclosed NJ-01..NJ-10
evidence gaps. Any failure to achieve an item returns to this plan; it is
not permission to widen scope or claim a limited success as a full exit.

## NJ-03 risk stop

The first cross-surface real-Chrome cancel attempt failed; the diagnostic
rerun showed Runtime authority `cancelled` while an already-open Workspace
and embedded Chat displayed `succeeded`. See
`stage-a-cross-surface-cancel-risk-stop-2026-10-12.md`. This is a Major
false-green risk. Stage A remains NO-GO and product-code repair is paused
for the user's explicit choice among the documented routes. The planned
NJ-03 assertion was not weakened.

## NJ-03 limited Route A implementation and exit gate

User approved Route A on 2026-10-12. Workspace may replace only its
outline-store-404 acquisition read with the existing transcript projection
read. Chat may continue polling only while a transcript projection reports
`state=succeeded` and `canCancel=true`; published, blocked, failed and
cancelled terminal states must stop. No public API, persistence, permission,
provider, or task identity contract changes are authorized.

Focused tests must show the same unpublished task changing from succeeded
to cancelled on both surfaces, without stale published content; a final
non-cancellable success must stop Chat polling. A fresh isolated real-Chrome
run on one Bilibili video must prove embedded Chat, standalone Chat,
Workspace and Runtime source authority all agree on the same task ID and
cancelled state after a held materializer is released. It must also prove
no outline publication and no private task residue. Failure remains a
failed run, with no seal or full Stage A PASS claim. A separate read-only
exit audit must inspect raw observations before NJ-03 can close.

The bounded Route A repair and split-scope NJ-03 evidence are recorded in
`stage-a-route-a-nj03-exit-audit-2026-10-12.md`. The independent reviewer
found Fatal 0 / Major 0 for this *single* journey. Full Stage A remains
NO-GO until the other fixed-denominator journeys close.

## NJ-01 evidence addendum

Before an outline is published in a fresh isolated real-Chrome run, inspect
both visible Chat surfaces and the already-open Workspace. The Chat preview
must be expanded, labelled as preview rather than whole-video brief, and
contain at least one visible list item with a nonempty timestamp and
nonempty transcript text. Record only text lengths and SHA-256 hashes in
the public result, not transcript content. Embedded Chat, standalone Chat,
Workspace and Runtime authority must share one task ID; Workspace must not
claim a published outline at the observation point. A boolean element-
presence check alone is a false green. This is an evidence-only change to
the isolated runner; a product defect returns to this plan before code edits.

## NJ-02 disconnect/reconnect repair addendum

Code inspection found that `LocalRuntimeAccess.disconnect()` updates its own
status but does not notify `MediaWorkspaceShell` through `onChange`. The
shell therefore may retain a `currentScope` and show previously loaded task
content after explicit disconnect. This is a candidate product defect, not
an accepted finding until a focused test fails. Repair is limited to making
the existing disconnect transition notify the parent after revocation; no
Runtime/API/credential contract or automatic reconnection policy changes.

Acceptance: on a connected Workspace with visible task content, clicking
`断开会话` must immediately remove the task ID and content and show the
disconnected status. Clicking `重新连接` must authenticate and read the same
task ID/revision from Runtime before content returns. While a task is still
running, a Chat reload must restore elapsed time from authoritative
`startedAt` rather than report a new zero, and the last-progress age must
advance from the authoritative update time. Focused component tests and a
fresh isolated real-Chrome/Runtime run are both required. Do not use a
preloaded DOM snapshot or a mock timer to close NJ-02.

## NJ-04 delayed old-task read addendum

Use a fresh isolated real task and open its Workspace before publication.
Delay only the first Workspace transcript-projection GET for that task;
leave the production Runtime and responses unchanged. While that request is
held, navigate to a different valid-shaped but nonexistent task ID. The
new route must show a task-read error and an empty rendered task ID. After
the old response is released, the new route must still show the error and
must not render the old source or outline. Browser Back must reread the
original task ID from Runtime and show its task-scoped state. Record the
two requested IDs, response statuses, and visible shell state only. A
route string check without the delayed response is not acceptance.

## NJ-05 chapter recovery addendum

After a fresh task publishes a real outline and comprehension projection,
open a syntactically valid chapter ID absent from that task. The outline
must show a task-scoped recovery alert, never `无效媒体路由` or another task's
chapter. Focus the recovery link and activate it with Enter. The chapter
query must clear, the same task ID must remain, and keyboard focus must
land on a meaningful outline control (chapter index or heading), not the
document body. The test must inspect the actual focused element after
navigation. If focus is lost, retain the failed run and repair only this
route-recovery focus behavior before rerunning; a link-presence assertion
alone is a false green.

## NJ-06 truthful seek addendum

After a fresh real task has a published outline, use a later chapter's
actual timestamp (at least 10 seconds) and a matching Bilibili video tab.
Click the chapter's
seek control and read the DOM receipt's requested, observed and delta
milliseconds. `located` is valid only with a matched source and delta <=
2000 ms; a larger observed delta must be `fallback`, not success. Then
close every matching video tab and repeat the same seek from Workspace.
The second receipt must be `blocked`, with an explicit failure code and
no new video page opened. Record only timing, outcome, failure code and
task/tab identity metadata. A seek click without a receipt is failure.

## Active-created status repair addendum

The real NJ-06 probe `20261012T141542048Z` showed standalone Chat's
`分析受阻` while Runtime source authority was still `active` and the newly
created task's execute request was deliberately delayed. This is a
user-visible false terminal state. On reconnect, `active + created` must
initially display an attached/waiting state, not failure. If the same
authoritative task remains `created` for 45 seconds, a scoped watchdog
may expose the existing `V3_MEDIA_TASK_AWAITING_START` same-task retry.
Before that warning, it must re-read both source authority and task
state; a changed owner or advancing state cancels the warning. The
watchdog must stop on component cleanup. A real Chrome run with the
30-second test-only execute delay must not show `分析受阻` during normal
startup, and a stuck-created focused test must still expose retry.

## Active-created watchdog result (implementation-session, bounded)

`first-use-runs/20261012T142906269Z-watchdog-result.json` failed: the
diagnostic code appeared, but the UI stayed busy because the transcript
projection was still `created`. The next run,
`first-use-runs/20261012T143310181Z-watchdog-result.json`, exposed the
visible error at 46 seconds; that runner incorrectly joined the source
authority to `media_tasks`, which is not populated until outline publication.
The probe was corrected to bind the Runtime transcript projection task ID
and `created` state to the SQLite source authority's active task ID.

The fresh isolated Chrome run
`first-use-runs/20261012T143540249Z-watchdog-result.json` exited zero:
at 45 seconds the authority was `active`, the matching transcript task was
`created`, the UI displayed `V3_MEDIA_TASK_AWAITING_START`, and the same-task
retry button was visible. SHA-256:
`7a39d3fd9a54f51b64c2831f1b500abd892afd5891cb2b43e4748588faac6318`.
This is a watchdog-path check, not a completed-task or Stage A exit claim.
The timed-out request was held only in the isolated browser probe; the task
and temporary profile were cleaned when the probe exited.

## NJ-07/08 navigation and dialog result (implementation-session, bounded)

The fresh isolated Chrome run
`first-use-runs/20261012T150728291Z-navigation-result.json` exited zero
against real Bilibili task `BV1hMpE6FEXG`. SHA-256:
`8e2ea09d40d12ccf86241b78460aef4edceea3158bace4185b86c1529cc9ff4a`.
From a later outline chapter, the evidence link opened its task-scoped
detail; Escape returned to the exact outline hash, expanded the collapsed
source chapter, and focused the originating evidence link. Direct-open
evidence Escape left the route unchanged. The synthesis dialog initially
focused its style control, contained Tab in both directions, and restored
opener focus after Escape and Cancel. The same run recorded four Workspace
width checks in each of its pending, overview, outline, and mindmap states.
Focused component tests were 20/20; the extension build passed. This is
not NJ-09 or Stage A exit: the newly touched negative states still need
their own four-width/axe/pixel pass and NJ-10 remains open.

All subsequent real-browser tests must launch Chrome with `--mute-audio`;
Xvfb alone is not an audio mute. The four Stage A browser entrypoints now
include that flag. The earlier unmuted diagnostic runs must not be repeated
without this explicit mute control.

## NJ-09 negative-state viewport matrix

Use one fresh real task in the isolated, muted Chrome runner. In addition
to the four published-state width sets already recorded, inspect these
newly touched states at 360/420/768/1280 CSS px: direct-open evidence
detail, open synthesis consent dialog, invalid chapter recovery, and a
valid-shaped but nonexistent task route. For every state/width, require
zero document horizontal overflow, zero serious/critical Axe findings,
nonblank screenshot pixel signal, and a visible state-specific control or
message. The dialog must remain reachable and its controls must not
overlap. A failed state/width returns to this plan; a pass for the regular
outline cannot stand in for a negative-state pass. Source-specific
permission denial, cancellation, disconnect, and blocked seek retain
their own real-flow evidence and are not silently covered by this matrix.

## Pause handoff (2026-10-12)

User explicitly paused the active V3 development goal. Do not resume
implementation or run tests until the user requests continuation. The
first fresh NJ-09 matrix run failed and remains unaccepted:
`first-use-runs/20261012T151327702Z-stage-a-failure.json` records a
20-second timeout waiting for `.media-quality-control > button` after
direct evidence-detail viewport scans and navigation back to the outline.
The earlier `20261012T150728291Z-navigation-result.json` proves NJ-07/08
without the new negative-state matrix; it cannot close NJ-09.

The Stage A fresh runner now collects 360/420/768/1280 px checks for direct
evidence detail, synthesis dialog, invalid chapter, and missing task. A
safe DOM diagnostic was added around the unavailable quality-control
button but has not yet been run. On resumption, first inspect current
worktree and this failure record, then run only the muted isolated
navigation check with `NAVIA_STAGE_A_NAVIGATION_CHECK=1`,
`NAVIA_STAGE_A_CHECK_WORKSPACE=1`, and `NAVIA_STAGE_A_EVIDENCE_ROOT` set
to this stage's `first-use-runs/`. Diagnose the missing button without
raising timeout or weakening the fixed Axe/overflow/pixel denominator.
All real Chrome tests must use `--mute-audio`. NJ-09 and NJ-10 remain open;
Stage A and the full V3 goal are not complete. No test process was left
running at pause; `node --check` and `git diff --check` passed. Existing
dirty worktree and generated build changes were intentionally preserved.

## Pause handoff supersession (2026-10-13)

The user explicitly paused the resumed work again. The authoritative current
handoff is `pause-handoff-2026-10-13.md` in this directory. It supersedes the
resume instructions above where they differ, records the retained 2026-10-13
failure runs, and identifies the latest unexecuted HTTP lifecycle instrumentation.
No implementation, browser test, Runtime, or cleanup may resume without a new
user continuation instruction. NJ-09 and NJ-10 remain open.

## NJ-09 negative-state matrix result (2026-10-13)

After the user resumed the goal, the isolated real-Chrome navigation run
`first-use-runs/20261013T101717864Z-navigation-result.json` exited zero for
real Bilibili source `BV1hMpE6FEXG`, task
`media_task_fa72cbae16614f88923a7b34b8fb5eb8`, terminal state `ready` and
revision `7`. SHA-256:
`4ec4ad2083092d86bde18ebab9b9633922935e4039551078b6e3421b97d2877b`.

The run checked direct-open evidence detail, the open synthesis-consent dialog,
invalid chapter recovery, and a valid-shaped missing-task route at each of
360/420/768/1280 CSS pixels. All 16 observations had zero document horizontal
overflow, zero Axe serious/critical findings, a nonblank pixel signal, and the
required state-specific control. The same run retained the NJ-07 exact-return
and direct-open boundary plus NJ-08 initial focus, Tab containment, Escape and
Cancel focus restoration. Chrome was launched with `--mute-audio` in an
isolated profile and the isolated Runtime/database were removed after exit.

Six preceding 2026-10-13 failures remain in `first-use-runs/` and must not be
deleted. They intermittently timed out on a second outline/comprehension read
or the missing-task read after earlier successful requests. A subsequent run
completed without changing the fixed 20-second waits or the 4x4 denominator,
so NJ-09 has one valid positive run but the intermittent Runtime request stall
remains a stability risk for NJ-10 and later repeated-run review. No credential,
Cookie, API key, transcript text, raw audio/video or screenshot binary was added
to the structured result. Automated Axe evidence is not a claim of complete
WCAG 2.2 AA or screen-reader conformance.

## NJ-10 independent reconciliation risk stop and repeat gate

Orca run `run_95a580fa2783`, dispatch `ctx_6d7f1a749370`, completed a
separate read-only NJ-10 review on 2026-10-13. Decision: **Stage A NO-GO;
Fatal 0 / Major 1 / Minor 2**. The Major is repeated-read stability: six
retained 2026-10-13 attempts timed out on a second outline/comprehension read
or the missing-task read before one unchanged run passed. The positive NJ-09
run closes the fixed visual denominator once, but does not by itself prove a
stable user journey. Minor limits are the single-video evidence used for the
bounded negative journeys and the temporary extension's pregranted site/Cookie
permission (not a native first-use permission prompt proof).

Before NJ-10 may be resubmitted, execute three consecutive fresh runs of the
same navigation check with a new isolated Runtime, database, Chrome profile and
task on every run. Each run must retain `--mute-audio`, the 20-second request/UI
waits, all four negative states, all four widths, Axe serious/critical zero,
zero horizontal overflow, nonblank pixels, NJ-07 evidence return and NJ-08
dialog focus checks. Do not retry inside a failed run, delete failures, splice
artifacts, or count `20261013T101717864Z` toward the new consecutive sequence.
Any failure stops the sequence and must retain the HTTP lifecycle, outstanding
request, Runtime access-log tail and `py-spy` thread dump when available. Only
three new consecutive exits of zero permit a fresh independent NJ-10 review;
they do not authorize Stage B without that review.

## NJ-09 repeated stability result

The required consecutive sequence completed without an inner retry or changed
wait/denominator. Each run used a fresh isolated Runtime, database, Chrome
profile and task for `BV1hMpE6FEXG`, launched Chrome with `--mute-audio`, exited
zero, closed source/task identity at published revision 7, and passed the same
four negative states x four widths:

| Run | Task | SHA-256 |
|---|---|---|
| `20261013T102458577Z` | `media_task_b8603abea7014605acfcdd9906c30fe1` | `9d9babd37961768d7974ed916de74a28b3dbc081961125bd555f14416b52b459` |
| `20261013T102715827Z` | `media_task_7b2766fee6cb4c388054f40161494be0` | `2bf441e8a6299fd1c6ca64ea05a997dda421c8a484a52f196838e31344ce6d24` |
| `20261013T102930405Z` | `media_task_dd3a605cbc7f429ba6fe9eea3a1ea112` | `9071b2d28a3f72abdb1d5eb3fa03bafb7f8982aec977b93e39203fdf224f1cb2` |

For each run, direct evidence, synthesis dialog, invalid chapter and missing
task produced exactly widths 360/420/768/1280, aggregate overflow 0, aggregate
serious/critical Axe findings 0 and nonblank pixel checks true. Evidence-return
and dialog task IDs matched the sole published authority task; Workspace ended
on revision 7 with an outline. A bounded secret-value scan across these three
JSONs found zero files containing Cookie identifiers, Bearer values or API-key
patterns. No test/Runtime process remained after the sequence. Earlier failures
remain retained and still bound the claim: this sequence supports resubmitting
NJ-10, not erasing the historical intermittent-stall risk.
