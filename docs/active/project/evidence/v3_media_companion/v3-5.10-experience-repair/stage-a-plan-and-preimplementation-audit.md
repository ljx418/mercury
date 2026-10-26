# V3-5.10 Stage A: status and navigation

Date: 2026-10-12. Status: limited navigation/restoration acceptance; full Stage A exit pending.

## PRD scenario and implementation

On a supported video, the user opens Chat, starts analysis, sees the current
stage and an honest elapsed timer, then sees a transcript preview as soon as
transcription succeeds. Once the same task's outline is published, the top
status must become ready; the user can open Overview, select any chapter,
inspect evidence and jump back to the correct player position. On Runtime
disconnect or task change, stale content cannot be represented as current.

The implementation uses `MediaTranscriptProjection` task ID/revision/state as
the visible authority and treats local launch state only as pre-projection
fallback. A completed transcript plus materializing outline is a distinct
step, not a terminal ready claim. A second `#` is forbidden in Media routes;
chapter selection travels as a query parameter and is validated against the
loaded task. Seek receipts are visible for success, fallback and failure.

## Acceptance and negative cases

1. Task A moves from transcribing to succeeded to outline ready; top status
   never remains yellow after same-task outline ready. A terminal failure is
   displayed as failure, and a long-running task only reports elapsed time and
   last update, never a guessed percent or false failure.
2. A completed transcript exposes actual preview text before outline creation;
   it is labelled as transcription, not a full-video conclusion.
3. All chapter links preserve `#/media/tasks/<id>/outline` and select the
   intended chapter. Invalid/mismatched chapter IDs recover visibly without
   navigating outside Media. Timeline/mindmap/Ask seek reports blocked/fallback.
4. Switching task, changing revision, disconnecting Runtime, and cancelling an
   in-flight synthesis cannot publish old data as a new task's result.
5. Real Chrome acceptance is required at four viewports with keyboard/scroll,
   one real video, and no severe Axe failures. Unit tests alone are not exit.

## Internal audit before editing code

Fatal=0, Major=0 at design level. No new service API or secret scope is needed.
Observed code defect: double-hash chapter links fail the anchored route regex.
Likely defect: Chat activity uses local acquisition state even when the
authoritative projection has advanced. Seek receipts are discarded in visual
timeline. Real-browser behavior and timing remain unverified; these are
acceptance obligations, not a claim of PASS.

## Implementation audit and real-browser result

Changed behavior: task-authoritative Chat status, honest local wait clock,
labelled transcript preview, single-hash chapter selection, seek receipts,
stale-task guard, and restored product-task detail when the temporary transcript
projection has expired. No API or media schema changed. A missing restored
detail now releases the auto-start readiness gate instead of waiting forever.

`pnpm typecheck` and `pnpm build` passed. Targeted Vitest passed 27/27 across
router, Workspace shell, and media activity. In a headed isolated Chrome with
an isolated Runtime and SQLite backup, the real published task
`media_task_3ba52fcf398b42ebb3030d82c2ea24bb` on `BV1pohR6rEEh`
showed 12 chapters. Overview-to-chapter routing preserved one hash route and
selected the intended chapter; keyboard chapter navigation passed. At widths
360, 420, 768 and 1280, document overflow was 0 px, screenshots were nonblank,
and Axe serious/critical findings were 0. Opening the same real Bilibili page
in the isolated browser restored the published outline; the Chat top state
became `视频内容已就绪` rather than remaining yellow.

The first E2E attempts exposed a real restoration defect (list summaries have
no `projections`) and then an E2E-only visibility selector error (the detail
panel is intentionally collapsed). Both were corrected and the same real-task
E2E reran to exit 0. The script creates and cleans its own browser profile,
database backup and Runtime; it does not mutate an earlier sealed task.

**Exit boundary:** the ready-task run proves restoration and navigation, not
the full fresh transition. A subsequent isolated fresh Bilibili probe, using
a temporary test-extension manifest with Bilibili/Cookie permission pregranted,
did observe transcript preview followed by a published outline and a ready
top status. It does **not** verify Chrome's first-use permission dialog. The
probe also exposed a cross-surface duplicate-task Major: the page's in-page
Navia iframe and a separately opened side panel each POSTed to
`/v1/media/acquisitions` for the same BVID. On a failing run the first
side-panel task ID differed from the task ID shown as ready. A single-container
run can therefore be falsely green. See `stage-a-cross-surface-risk-stop.md`.

Stage A remains FAIL / REPLAN. Fatal=0; Major=2 open (cross-surface task
identity and unverified terminal/retry path). Stage B content implementation
must not start; its document-only plan is separate. No earlier sealed run or
the user's Runtime was modified by the isolated probes.

An additional separate read-only UX Agent review is archived as
`independent-ux-readonly-review.md`. It found eight code-grounded issues beyond
the original 13 UX complaints. Four have local code changes but lack full
browser exit evidence; four remain open. These do not reduce the cross-surface
Major gate.
