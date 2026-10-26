# Stage A policy switch implementation exit candidate

Date: 2026-10-12. Reviewer: implementation session. Decision:
**Stage A policy-switch LIMITED PASS for task authority only; full Stage A
exit remains pending**. The first independent review's three Majors were
closed and a post-fix read-only review found no new Fatal/Major. The
intermediate E2E failure remains archived; its tab-focus explanation is
consistent with code and evidence, not conclusively proven.
This is not a content-quality, Stage B-D, or V3 final
pass. The user selected retention of the old result as isolated history.

## Implemented boundary

- Runtime: authenticated `/v1/media/acquisitions/replace-policy`; exact
  request fields and literal confirmation; SQLite `BEGIN IMMEDIATE` CAS
  creating one new task, one switch receipt, and one new source authority;
  rollback cleans the candidate sandbox. Ordinary `resolve` still rejects a
  cross-policy attach.
- Source reads: both persisted outline and in-memory acquisition follow the
  single durable authority, including when old/new task timestamps sort in
  the wrong order. Old task-ID reads and history list are labelled
  `historical`; old product bytes and revision are unchanged.
- UI: visible conflict and user confirmation; active old work uses explicit
  cancellation barrier; published old work uses the CAS endpoint. A current
  `created` task can be resumed by explicit retry after response loss or
  interrupted UI, with source, policy and task-state checks. No automatic
  policy switch occurs on tab restore or polling.

## Evidence against PS-01..PS-12

| Gate | Evidence and limit |
|---|---|
| PS-01/02 | Runtime conflict negative test and real Chrome pre-click `conflictVisibleBeforeClick=true`; authority still v1. Ordinary attach does not proceed. |
| PS-03 | Real Chrome after confirmation: one v2 authority, one switch receipt, old product revision/hash unchanged. |
| PS-04/05 | Two SQLite connection race test selects one winner; same request replay and stale/missing/extra-field/auth negatives. |
| PS-06 | Earlier real Chrome cancel probe `20261012T072550497Z-cancel-result.json` and cancellation core tests; this policy-switch run did not interrupt active old work. |
| PS-07/08 | Source-default store/coordinator tests return new pending task; real Chrome shows new task ID in standalone panel, second tab and Workspace, with old history banner. |
| PS-09 | SQLite failure injection verifies rollback and sandbox cleanup. A real Chrome test forwarded the switch POST, dropped its 201 response, and still published the same new authority. A Runtime crash specifically between switch commit and first execution is not separately injected; the existing interruption cleanup contract applies and is a residual review item. |
| PS-10 | Real `BV1hMpE6FEXG` browser runs; native confirmation exercised via keyboard in the response-drop run. Widths 360/420/768/1280 showed 0 overflow and 0 serious/critical Axe violations, chapter keyboard route exercised. Screenshots were checked for nonblank bytes but not retained. |
| PS-11 | Public policy-switch JSON files scanned for `SESSDATA=`, `bili_jct=`, `DedeUserID=`, and bearer header prefixes: zero file hits. This is a prefix scan, not a proof over every private byte. Request contract excludes Cookie/lease/media/path fields. |
| PS-12 | Met for the policy-switch substage by `stage-a-policy-switch-postfix-independent-audit-2026-10-12.md`: Fatal 0/new Major 0, task-authority-only GO. Old tracked V3 evidence has no Git diff; no old sealed bytes were edited by this substage. Full Stage A still needs its own combined exit review. |

Three fresh run records, never spliced: `first-use-runs/20261012T085037223Z-policy-switch-result.json`,
`first-use-runs/20261012T085832259Z-policy-switch-result.json`, and
`first-use-runs/20261012T090549421Z-policy-switch-result.json`.
The third used `NAVIA_STAGE_A_DROP_SWITCH_RESPONSE=1`; it forwarded the real
POST to Runtime, verified 201, then discarded only the browser response.
All three report `passed=true`. The product is `degraded`, so these runs prove
authority, navigation and recovery only. They do not demonstrate complete
frames, high-quality brief, graph, or six-video coverage.

Targeted Runtime regression: 112 passed, one Starlette dependency deprecation
warning. Frontend relevant tests: 14 passed; typecheck and build passed.
`git diff --check` on edited source/test files passed. The temporary test
profile, media task roots and cloned SQLite DB were cleaned after each run.

## PRD and remaining risk

This implements the V3 requirement that one exact source has one Runtime
authority across tabs and surfaces. It does not expand Cookie consent,
upload policy, or V4 knowledge. The policy-v2 tuple is a **test-only conflict
fixture**; no production consent policy revision was changed. The old product
remains directly viewable as labelled history, never used as new-policy
source-default evidence.

An independent reviewer has verified the policy-switch PS mapping and bounded
task-authority conclusion. A combined Stage A review is still needed before
the full Stage A exit decision. Stage B still needs
detailed PRD-based planning and an entry audit before implementation. No
Stage B-D code or V3 quality claim is authorized by this candidate.

## Post-review addendum

The first independent read-only audit is archived as
`stage-a-policy-switch-independent-readonly-review-2026-10-12.md`: Fatal 0,
Major 3, Minor 10. M-1 now has durable receipt replay coverage after a fresh
coordinator instance. M-2/M-3 now have explicit `chapterCount`,
`contentChars`, and `keyboardRouteOutcome` gates. S-1, found by the
implementation session, closed historical write actions in the UI and
authenticated Runtime endpoints and added store/service checks. Relevant
Runtime tests passed 112/112, Workspace tests 7/7, typecheck/build passed.

Two later fresh real-Chrome runs use the stronger gate:
`first-use-runs/20261012T092205846Z-policy-switch-result.json` (ordinary)
and `first-use-runs/20261012T093409350Z-policy-switch-result.json`
(response dropped after Runtime 201). Both report one new authority, old
bytes unchanged, `keyboardRouteOutcome=true`, and 12 chapters / 830 chapter
characters on each viewport with no serious/critical Axe violations. An
intermediate response-drop attempt failed to publish the new task within its
180-second wait and did not write a result file. A diagnostic-preserving
repeat reproduced that failure as
`first-use-runs/20261012T094222824Z-policy-switch-failure.json`: the v2
authority was `active`, its task remained `created`, and the old product was
still `degraded`. The original runner pressed Enter in an ordinary Chrome tab
used to emulate a standalone panel; that may activate the extension tab and
invalidate the active-video epoch before recovery. The runner was corrected
to confirm in the in-page sidebar while keeping the video tab active, and
the fresh response-drop run
`first-use-runs/20261012T094651278Z-policy-switch-result.json` passed the
same strict gates. This supports, but does not by itself prove, the
tab-activation explanation. The product's explicit pending-task retry path
remains a separate recovery guarantee and needs reviewer attention.
