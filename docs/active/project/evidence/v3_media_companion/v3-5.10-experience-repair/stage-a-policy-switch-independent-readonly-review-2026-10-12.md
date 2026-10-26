# Stage A policy-switch independent read-only review

Date: 2026-10-12. Reviewer: separate Claude Code CLI invocation with only
Read/Glob/Grep allowed; no product, test, browser or secret files were run or
opened. This file records the first review's findings, not a post-fix exit
approval. The implementation session independently checked an additional
historical-write boundary after receiving the review.

## Initial independent judgment

Fatal 0; Major 3; Minor 10. **Stage A not closed.** The reviewer called the
policy-switch path a bounded GO, conditional on closing these Majors:

1. M-1: repeated identical switch POST after Runtime restart hit the new
   task primary key and returned 500, not idempotent `replayed` 200. The
   original test covered only in-memory replay.
2. M-2: the response-drop run's 360px screenshot was only 26,477 bytes vs.
   116,601/146,162 in ordinary runs. A 20KB screenshot threshold could not
   prove the same content rendered; no DOM chapter count was asserted.
3. M-3: keyboard chapter routing was exercised with wait-on-open but was not
   recorded as a typed result or included explicitly in `passed`.

The reviewer also noted no post-switch old-policy resolve negative,
coordinator cold-start source lookup 404 vs. persisted pending task,
post-switch crash not specifically fault-injected, prefix-only secret scan,
and minor UX/diagnostic details. Those remain bounded residuals unless a
follow-up review elevates them. The review did not inspect the full set of
mutating historical-task endpoints.

## Implementation-session supplemental finding

S-1 (Major): the old task was labelled `historical` in the Workspace but its
Ask, synthesis and Export commands remained usable by direct route or API.
This contradicted the user's choice to retain the old result as **isolated
read-only history**. The implementation now hides these commands on
historical routes and rejects new work with
`V3_MEDIA_HISTORICAL_READ_ONLY` at the authenticated Runtime write endpoints.
TaskStore creation/transition/terminal commit also reject a task after its
source authority moves to another task. Focused API/store/UI tests were
added. A possible in-flight derivative started before the policy switch is
not separately fault-injected; its output remains bound to the historical
task ID and cannot become source-default evidence, but any policy-lifecycle
implication needs explicit review.

## Fix verification status

M-1: receipt lookup now handles post-Runtime-restart exact replay without
creating another sandbox/task. Focused test passed.

M-2/M-3: the E2E runner now requires a nonempty chapter list and more than
200 rendered chapter characters at each viewport, and records/asserts
`keyboardRouteOutcome`. A fresh ordinary Chrome run passed with 12 chapters
and 830 chapter characters at all four widths; its record is the policy
switch result after `20261012T090549421Z`. The response-drop rerun on this
stronger runner is pending at the time of this entry.

S-1: 112 related Runtime tests and 7 Workspace tests passed after the
read-only guard. The first stricter response-drop run passed, then an
intermittent run failed. Its diagnostic is
`first-use-runs/20261012T094222824Z-policy-switch-failure.json`: v2 authority
`active`, new task `created`, old product preserved. The runner had changed
focus to an ordinary extension tab for confirmation, which may invalidate
the video-tab epoch. A corrected in-page confirmation produced a fresh
passing record, `first-use-runs/20261012T094651278Z-policy-switch-result.json`.
This is evidence of a test-harness focus mismatch, not a license to discard
the failure. Full independent post-fix exit review remains required. No
Stage B code starts from this initial review.
