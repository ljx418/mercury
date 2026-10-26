# V3-5.10 Stage A NJ-02 reload and reconnect exit

Date: 2026-10-12. Decision: **NJ-02 bounded implementation-session PASS for one real in-progress Bilibili task; Stage A remains NO-GO.** This is not the independent combined Stage A exit audit.

## Defect and repair

The Workspace's `LocalRuntimeAccess.disconnect()` revoked and cleared its local token but did not notify the parent `MediaWorkspaceShell`. A focused test first failed: after disconnect, the component rendered `本机伴侣需要重新配置` while its last parent notification remained `connected`. The repair sends an `authentication_required` notification with the new session generation after local clearing. If remote revocation fails, the UI says that server-side revocation was not confirmed; it still hides local task content. No Runtime API or credential protocol changed.

## Real browser evidence

- Page: `https://www.bilibili.com/video/BV1hMpE6FEXG`; isolated Chrome under Xvfb, Runtime, profile, database copy and private media roots. The temporary extension had Bilibili/cookie permissions pregranted; native first-use permission UX is outside this run.
- Runner: `apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs` with `NAVIA_STAGE_A_CHECK_WORKSPACE=1` and `NAVIA_STAGE_A_RECONNECT_CHECK=1`. The visual request was deliberately held so the checks occurred while the task was active and before outline publication.
- Passed artifact: `first-use-runs/20261012T134703684Z-reconnect-result.json`, SHA-256 `75e01fbca940407b0b936648156e5b74385430d1c0052b0caae8ce232c3ca395`.
- Chat timer used the authoritative start: 32 seconds before reload, 33 seconds after. Last-progress age advanced from 1 to 3 seconds after reload, rather than resetting to a false zero.
- Workspace disconnect immediately yielded an empty `data-task-id`, zero task-content nodes and the explicit hidden-content notice. Reconnect restored the same `media_task_41be63919f474d07908319c9f09cccfa` after a Workspace-initiated HTTP 200 Runtime projection read with revision 3; UI reported the local companion connected.
- Public evidence had zero hits for the bounded Cookie/Bearer secret-keyword scan. The test process exited 0 and removed its isolated scratch directory.

## Failed attempts retained

- `first-use-runs/20261012T134144643Z-stage-a-failure.json`: runner waited for a visible card inside the dock that reload had collapsed. The card was attached but hidden; this is not evidence of a product failure. Runner now opens the dock after reload.
- A later failed probe required a Runtime projection response but filtered Workspace initiator URLs with `endsWith("/workspace.html")`; real routes include a hash. The strict requirement stayed in place; only the initiator match changed to include `/workspace.html`.
- An earlier successful UI-only probe (`20261012T134300056Z-reconnect-result.json`) is not used for NJ-02 exit because it could not prove a fresh Runtime revision read.

## Verification and boundary

`LocalRuntimeAccess.test.tsx` and `MediaWorkspaceShell.test.tsx`: 19/19 passed. `pnpm typecheck` and `pnpm build` passed. `git diff --check` passed. The in-progress task was not claimed as completed; the isolated harness stopped Runtime and deleted scratch at test end. This run does not prove Chrome process restart, post-publication reconnect, four-viewport negative-state visuals or six-video quality. Stage A's fixed ten-item denominator still needs the remaining journeys and independent combined review before Stage B begins.
