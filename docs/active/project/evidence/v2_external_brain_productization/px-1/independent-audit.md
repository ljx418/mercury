# V2-PX PX-1 Independent Audit

## Verdict

```text
Date: 2026-09-01
Audit mode: independent read-only adversarial review
Run: run_0626476ec650
Task: task_f415eaa73b98
Dispatch: ctx_f683946e1fa4
Fatal: 0
Major: 3
Minor: 1
PX-1: FAIL / REOPENED
PX-2+: NO-GO
```

## Major Findings

### Major 1: recovery semantics are incomplete

- `WORKSPACE_NOT_FOUND` uses `recoverToLibrary(route.workspaceId)`, so recovery keeps the missing workspace ID and reopens the same error.
- `FORBIDDEN` is declared by the UI contract but no Runtime or injectable authority path can currently produce and verify it.
- Affected implementation: `entrypoints/workspace/main.tsx:145-152` and `src/modules/knowledge_workspace/WorkspaceRouter.tsx:43-45`.

### Major 2: tab reuse has a concurrent-open race

- `openOrFocusWorkspace()` performs `tabs.query()` and `tabs.create()` without serializing concurrent requests.
- Two same-window open requests can both observe no existing tab and create duplicates.
- Current E2E only verifies one serial retry, not concurrent requests.
- Affected implementation: `entrypoints/background/workspaceOpen.ts:56-73`; evidence gap: `e2e/chrome-v2-px-workspace-router.mjs:360-365`.

### Major 3: route recovery evidence does not meet the frozen matrix

- All five routes have direct-open and reload evidence.
- Browser Back is exercised only for Graph.
- Reopen is exercised only for Source Detail.
- The stage gate requires general successful direct-open, reload, Back and reopen evidence for all five routes.
- Affected evidence: `e2e/chrome-v2-px-workspace-router.mjs:303-333`; requirement: `stage-gates/v2-external-brain-productization.md:96`.

## Minor Finding

The Drawio contains a stale status contradiction between its early summary and later PX-1 implementation-status entries. This must be reconciled when the Major repair is documented.

## Independent Checks

- Focused Vitest: PASS, 17/17.
- TypeScript typecheck: PASS.
- Current PRD SHA-256 matches the real source fingerprint in the E2E report.
- Generated `workspace.html` and manifest hashes match the inspected evidence.
- No new manifest permission or CSP expansion was found.
- No direct Workspace-to-`data_service` call was found.

## Disposition

The automated run is useful evidence but is not sufficient for PX-1 acceptance. PX-1 remains open. Per the development protocol, implementation stops pending human confirmation before a bounded Major-repair cycle begins.
