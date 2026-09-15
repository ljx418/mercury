# V2-PX PX-2 Side Panel Quick Surface Development Plan

## Status

`Approved for implementation only after the matching preimplementation audit returns Fatal 0 / Major 0.`

## User Outcome

The narrow Side Panel becomes the current-page and current-workspace quick surface. It keeps explicit save, four-domain service status and current source build/trace state, while long-term Source Library, Graph, Permission and Forget management move to the existing Extension Workspace Page.

## Scope

1. Add a delivery-style `KnowledgeQuickSurface` for 360/420px Side Panel use.
2. Keep `SaveToKnowledgeCard` in Chat and expose the saved source identity in Knowledge Quick Surface.
3. Implement three production Workspace entries through the existing Background action:
   - `查看来源`: visible only for a real `trace_ready` source; `view_source -> source_detail + workspaceId + sourceId`.
   - `打开工作台`: `open_workspace -> source_library + workspaceId`, never carries sourceId.
   - `在工作台中打开`: `open_in_workspace`; preserve the selected valid source detail context, otherwise Source Library.
4. Add `问当前空间` as `open_in_workspace -> ask`.
5. Add an inline Trace quick view using only Runtime-returned `EvidenceRef` values; it never claims source jumpback or located state beyond the returned locator fields.
6. Remove the full `KnowledgeWorkspaceShell` from Side Panel rendering. Do not remove the component yet because PX-4 will derive wide Workspace components from it.
7. Add real Chrome 360/420 evidence and verify the three entries open/focus extension-origin Workspace routes with stable IDs and zero new ingest.

## Code Entities

```text
apps/chrome-extension/src/modules/knowledge_workspace/KnowledgeQuickSurface.tsx       new
apps/chrome-extension/src/modules/knowledge_workspace/KnowledgeQuickSurface.test.tsx  new
apps/chrome-extension/entrypoints/sidepanel/main.tsx                                   modify
apps/chrome-extension/entrypoints/sidepanel/style.css                                  modify
apps/chrome-extension/e2e/chrome-v2-px-sidepanel-quick-surface.mjs                     new
apps/chrome-extension/package.json                                                     add PX-2 E2E command
docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio                 status only after acceptance
```

## Boundaries

- No Runtime API, Schema, Manifest permission, CSP or data_service changes.
- No automatic save and no duplicate ingest on any entry.
- Side Panel does not render Source Library management, Graph canvas, PermissionRoot manager or Forget UI.
- Frontend does not create source, answer, graph or trace facts.
- Ask quick action opens the Workspace Ask route; it does not execute a hidden query.
- PX-3 still owns sender-aware multi-window policy, reconnect/poll and complete tab lifecycle.
- PX-4 still owns delivery-grade wide Workspace components.

## Implementation Order

1. Implement and component-test Quick Surface action visibility and canonical payloads.
2. Generalize Side Panel action dispatch without changing the frozen action contract.
3. Replace the Side Panel full management shell with Quick Surface.
4. Add responsive CSS with stable controls at 360/420px.
5. Build and run real Chrome entry, identity, no-ingest and viewport acceptance.
6. Run full regressions and write acceptance, PRD review, architecture review, false-green audit, handoff and independent audit.

## Stop Conditions

- Any action/route combination differs from the frozen Workspace contract.
- A button opens localhost, changes permissions/CSP or calls Runtime/data_service directly.
- `查看来源` appears for non-`trace_ready`, missing or forgotten source.
- Side Panel still exposes the full management surface.
- 360/420 has blocker overflow, overlap, clipping or unreachable actions.
- Independent audit finds a Fatal or Major issue.
