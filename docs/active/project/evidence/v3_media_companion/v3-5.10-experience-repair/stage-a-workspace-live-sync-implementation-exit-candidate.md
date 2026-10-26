# Stage A Workspace live sync: implementation exit candidate

Date: 2026-10-12. Decision: **candidate REOPENED** after independent read-only
review. Its two Major findings must close before bounded PASS. Full Stage A
remains **NO-GO**. Stage B-D implementation is not authorized by this document.

## PRD operation and result

The user opens the same video in Chat and Media Workspace while Runtime is
still acquiring it. Workspace now reads the acquisition task through the
existing authenticated endpoint when the outline store returns typed 404,
shows its real state and task ID, then polls the outline store. It does not
show an outline before publication. It switches to the same ID's published
outline without page navigation, and stops polling on a terminal outline.
Cancelled/failed/blocked acquisition is shown as stopped. Disconnect hides
task content; reconnect re-reads Runtime. A late response from another route
is discarded. No public API, persistence contract, provider or permission
change was made.

The first real Chrome attempt failed because an acquisition record precedes
the outline record. The second reached the real `created` state but the
test's task-ID selector was still bound only to the outline record. Both
attempts are failures, not passing evidence; the code and test were revised.

## Acceptance evidence

| ID | Result | Evidence and limit |
|---|---|---|
| LS-01 | PASS | Real Chrome initial `created`, no outline; same task ID exposed. |
| LS-02 | PASS | Same Workspace page, task `media_task_c6e2f40c75d84ecfabeb56434b994c97`, revision empty to 6, outline appears; one source authority/task. |
| LS-03 | PASS in focused test | Cancelled terminal shown, no stale outline; no new Chrome cancellation run in this substage. |
| LS-04 | PASS in focused test | Delayed old-task response discarded after navigation. |
| LS-05 | PASS in focused test | Disconnect hides task content, reconnect refetches. |
| LS-06 | PASS for real Chrome happy path | Bilibili `BV1hMpE6FEXG`; 360/420/768/1280 px: zero horizontal overflow, zero serious/critical Axe, nonblank screenshot byte counts; keyboard chapter navigation passed. |

Primary evidence:
`first-use-runs/20261012T102041690Z-first-use-result.json`, SHA-256
`0c138b1e585943b4399026734f500eb3601af82de63478e2aec2377de907db44`.
The run used a temporary extension profile with pregranted permission in that
profile only, isolated Runtime/database and real Bilibili content. Its
reported product state was `degraded`; it does not prove visual-evidence
quality or the full V3 experience. Temporary browser and Runtime were closed.

`MediaWorkspaceShell.test.tsx`: 12/12. Product module tests: 31/31 across
four files. `pnpm typecheck`, `pnpm build`, `node --check` and
`git diff --check`: PASS. Public JSON scan for Cookie/Bearer markers: zero
hits. The real run did not exercise disconnect, cancellation, or stale-route
cases; those remain unit-level coverage.

## Independent read-only review and residual risk

The first independent reviewer found Fatal 0, Major 2, Moderate 2. Major:
the old task can render under a new route before effect cleanup, and task
identity/navigation remain visible during Runtime disconnect. Moderate:
transient comprehension failure becomes false legacy fallback, and the
four-width evidence covers only the outline after navigation, not pending
or overview. The candidate PASS above was withdrawn; the passing run is
valid only for its measured happy path. Follow-up repair and a new review
are required.

The 404 cross-store handoff was a
real Major during the first run and is closed by typed fallback to the
existing acquisition read. The test-selector mismatch was closed by exposing
the same authoritative ID in both stages. A generic or unknown 404 is still
an error, never a fabricated pending task.

Residual: a succeeded/degraded acquisition whose outline handoff never
publishes will keep a visible pending state and retry. There is no absolute
handoff timeout or manual retry control in this repair. Full Stage A still
requires itemized independent review of all UX findings; this document
cannot upgrade the six-video content-quality denominator, visual-frame
availability, or Stage B-D gates.

## Post-review repair candidate

The two Major findings were addressed in code: rendered task, acquisition,
navigation, attributes and historical notice now require the current route,
task ID and live Runtime read scope. Disconnect clears the scope before
reconnect, so old identity is hidden. A transient comprehension error is
visible and retried; only typed 404 permits the genuine legacy reader.
Focused tests cover the stale response, disconnect/reconnect and transient
projection retry. Product module tests: 32/32. Typecheck/build: PASS.

The revised real-Chrome run is
`first-use-runs/20261012T104527849Z-first-use-result.json`, SHA-256
`5b4d8ecb7ef005fff19e5346bac6ba167ee084140b0190bb53a22de1e21af28e`.
It shows `created` without outline changing on the same Workspace page and
same task ID to revision 6 with outline. Pending, overview, outline and
mindmap each passed 360/420/768/1280 px: zero horizontal overflow, zero
serious/critical Axe, pixel diversity and nonwhite-sample thresholds.
Chapter keyboard route and mindmap keyboard/seek action fired. The run still
reports a `degraded` product, and the visual checks are pixel statistics plus
DOM/ARIA assertions, not a human review of saved screenshots. The earlier
candidate run remains historical, not spliced into this one.

**Decision remains pending independent post-fix review.** No claim that all
Stage A findings, six-video quality, or V3 final acceptance are closed.
