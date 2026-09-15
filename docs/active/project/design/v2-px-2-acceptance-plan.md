# V2-PX PX-2 Side Panel Quick Surface Acceptance Plan

## Gate

PX-2 passes only after component tests, real Runtime/headless Chrome evidence, PRD review and independent re-audit all pass with Fatal 0 / Major 0. PX-3 remains No-Go until then.

## A. Product Responsibilities

- [ ] Side Panel Knowledge view renders Save/status/build/current-context quick information and quick actions.
- [ ] Source Library table, wide Graph, PermissionRoot form and Forget management are absent from Side Panel.
- [ ] Runtime, Adapter, data_service and source build states remain independently visible.
- [ ] Runtime offline keeps Workspace entry available for diagnostics but disables fact-dependent source/trace actions.

## B. Three Production Entries

- [ ] `查看来源` exists only when source status is `trace_ready`; payload is `view_source + source_detail + workspaceId + sourceId`.
- [ ] `打开工作台` always sends `open_workspace + source_library + workspaceId` and no sourceId.
- [ ] `在工作台中打开` sends `open_in_workspace + source_detail` for a selected valid source; otherwise `source_library`.
- [ ] `问当前空间` sends `open_in_workspace + ask + workspaceId` and no sourceId.
- [ ] Every successful action resolves to extension-origin `workspace.html` and the expected canonical hash.
- [ ] Repeated actions focus the existing tab and do not ingest.

## C. Trace Quick View

- [ ] Trace quick action is enabled only for a real source with evidence refs.
- [ ] Expanded content uses source ID and EvidenceRef fields returned by Runtime.
- [ ] No evidence is labelled `located` merely because a ref is non-empty.
- [ ] Collapse/expand is keyboard-operable and has an accessible name/state.

## D. Narrow UX

- [ ] Real headless Chrome captures product Side Panel at 360x900 and 420x900.
- [ ] `scrollWidth <= clientWidth`; no blocker overlap or clipped action text.
- [ ] All primary actions remain reachable by keyboard and visible without nested horizontal scrolling.
- [ ] Existing Chat, Agent, Debug, Settings and tool rail remain reachable.

## E. Required Verification

```text
npm --prefix apps/chrome-extension test -- KnowledgeQuickSurface workspaceOpen
npm --prefix apps/chrome-extension test
npm --prefix apps/chrome-extension run typecheck
npm --prefix apps/chrome-extension run build
PYTHONPATH=services/local-runtime python3 -m pytest -q services/local-runtime/tests/test_v2_memory_knowledge_api.py
npm --prefix apps/chrome-extension run validate:v2-external-brain-productization
npm --prefix apps/chrome-extension run e2e:chrome:v2-px-sidepanel-quick-surface
```

The E2E must create/read a source from real PRD bytes through the real local Runtime. Only service fault states may be injected deterministically.

## F. Evidence

```text
docs/active/project/evidence/v2_external_brain_productization/px-2/
  quick-surface-e2e.json
  screenshots/sidepanel-360.png
  screenshots/sidepanel-420.png
  logs/
  acceptance.md
  prd-review.md
  architecture-review.md
  false-green-audit.md
  handoff.md
  independent-audit.md
```

## Rejection Rules

- Visual buttons without Background responses are not production entries.
- A 1280px extension page resized to 360px is not Side Panel evidence.
- A selected source in frontend memory without Runtime identity is not valid source context.
- Existing PX-1 screenshots cannot be reused as PX-2 viewport evidence.
- Passing component tests cannot replace real Chrome action and no-ingest evidence.
