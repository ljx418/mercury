# Stage A Route A / NJ-03 bounded exit audit

Date: 2026-10-12. Scope: the user-approved cross-surface cancellation
read-path repair only. **NJ-03 conditional close; full Stage A NO-GO.**
Stage B-D remain NO-GO. No V3 final acceptance or human gate is claimed.

## Authorization and implementation

The user approved limited Route A. Workspace now reads the existing
authoritative transcript projection when no outline task has been published;
the raw acquisition state is no longer used for this handoff. Chat continues
polling a terminal `succeeded` projection only while `canCancel=true`, and
stops on a non-cancellable success or cancelled/failed/blocked result.
No public API, persistence, permission, provider, or task identity contract
changed. The isolated browser runner was strengthened to assert all three
surfaces and the Runtime authority, and to wait for held visual HTTP requests
to finish before checking for revival.

## Verification

| Evidence | Result |
|---|---|
| Focused Workspace + Chat hook tests | 19/19 passed |
| Media product + acquisition frontend tests | 43/43 passed across 6 files |
| Extension typecheck and production build | Passed |
| Runtime transcript projection + materializer concurrency tests | 13/13 passed (`PYTHONPATH=.`); one dependency deprecation warning |
| Real isolated Chrome NJ-03 | `BV1hMpE6FEXG`, run `20261012T124406632Z`, `outcome=cancelled` |
| Runtime source authority | One row, `media_task_39c774c2b2934a6497cf39bb3ddc35c6`, `cancelled` |
| Embedded Chat, standalone Chat, Workspace | Same task ID; each shows `cancelled`; Workspace has no outline |
| Delayed visual HTTP requests | 2/2 released and completed as HTTP 409 `TASK_INPUT_NOT_READY` for that task |
| After HTTP completion | Authority still `cancelled`; outline rows `[]`; private residuals `[]` |
| Pending Workspace at 360/420/768/1280 | Zero horizontal overflow and zero serious/critical Axe violations |
| Public evidence secret-pattern scan | Zero hits for Cookie identifiers, Authorization/Bearer, and key pattern |

Fresh raw result:
`first-use-runs/20261012T124406632Z-cancel-result.json`, SHA-256
`38cc10d331ad5122de8f587af9258f56d6916bf1b5627ea6febdabcb4ea65935`.
Earlier failed or incomplete cancel runs remain separate and are not spliced
into this result. The runner used an isolated Chrome profile, copied SQLite
database, Runtime, media scratch, and pinned local `yt-dlp`; all were closed
or removed by its `finally` path.

## Independent read-only judgment

An independent reviewer first identified two Major evidence gaps: standalone
Chat identity was absent, and release of a delayed request was not proof of
server completion. After two fresh evidence iterations, the reviewer found
Fatal 0 / Major 0 for the **bounded NJ-03 cancellation fix**, conditional on
the explicit split of coverage below. No files were changed or product code
run by the reviewer.

The browser run proves a *late arriving* visual request was rejected after
cancellation. It does not claim that a visual worker was already executing
inside the server in that same run. The separate Runtime concurrency tests
cover cancellation during download and after thumbnail persistence; both
assert no revival and cleanup. Combining these two scopes is acceptable for
this bounded NJ-03 closure, not for a full Stage A or visual-quality PASS.

The cancel run's generic `identityClosed=false` is a ready-path metric that
requires a published task row and a second video tab. In a cancelled run,
both are intentionally absent. The explicit three-surface task IDs and
Runtime source authority are the NJ-03 identity evidence.

## Remaining gates

NJ-01, NJ-02, and NJ-04..NJ-10 still require their own fixed-denominator
real-browser evidence and PRD review. This result does not validate video
content quality, first-use permission prompt, full four-viewport coverage
of all states, or V3 human acceptance. Do not advance Stage B-D on this
bounded result alone.
