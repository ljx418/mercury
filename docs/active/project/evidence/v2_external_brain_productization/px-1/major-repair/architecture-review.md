# V2-PX PX-1 Major Repair Architecture Review

## Result

`PASS for P1/P2b/P3 boundaries.`

- `workspaceAuthority.ts` is the single injectable authority resolver and continues to use shared `runtimeClient.ts`.
- `WorkspacePage` renders only Runtime-returned source/workspace/graph facts; it does not create knowledge facts.
- `workspaceOpen.ts` owns tab coordination in Background and serializes query/focus/create operations.
- The coordinator re-queries tabs after each prior task and remains usable after a failed task.
- The Workspace entry remains `chrome.runtime.getURL("workspace.html")`; localhost Route B was not enabled.
- Runtime APIs, JSON Schemas, Manifest permissions and CSP were unchanged by this repair.

Residual ownership is unchanged: sender-aware multi-window behavior and reconnect belong to PX-3; complete Sources/Ask/Trace/Graph/Permission/Forget UI belongs to PX-4.
