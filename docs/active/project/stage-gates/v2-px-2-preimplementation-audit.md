# V2-PX PX-2 Preimplementation Audit

## Result

```text
Date: 2026-09-08
Mode: read-only PRD, architecture, prototype and current-code audit
Fatal: 0
Major: 0 after closure decisions below
Minor: 0
Disposition: GO for PX-2 bounded implementation
PX-3+: NO-GO
```

## Current Gaps

### PX2-AUD-001 Side Panel responsibility conflict

Current `KnowledgeWorkspaceShell` renders Source Library, Ask, Graph, Permission and Forget in the narrow Side Panel. The PRD assigns these management surfaces to the Extension Workspace Page. Closure: PX-2 replaces the rendered shell with a compact Quick Surface but retains the existing component source for PX-4 migration.

### PX2-AUD-002 Incomplete entry set

Only `open_workspace -> source_library` is wired. Closure: one typed Side Panel dispatcher will emit the three frozen origin/route combinations plus Ask quick action; Background remains the only tab owner.

### PX2-AUD-003 Trace semantics

The Side Panel needs a Trace shortcut, but no separate Workspace trace route exists in the frozen five-route contract. Closure: Trace is a local compact disclosure backed by the currently selected Runtime source EvidenceRefs. It does not add a route or claim source jumpback success.

### PX2-AUD-004 Offline identity

The Workspace page must remain openable while Runtime is offline, but source-specific actions cannot use unverified identity. Closure: general Workspace entry stays enabled; `查看来源` and Trace require a Runtime-returned `trace_ready` source.

### PX2-AUD-005 Real viewport evidence

The existing PX-1 sidepanel page was used only as an entry trigger at the default viewport. Closure: PX-2 records new 360 and 420 product-surface screenshots and measures overflow in the loaded extension Side Panel page.

## Contract Audit

- Workspace action schema: unchanged and sufficient.
- Runtime API/schema: unchanged and sufficient for workspace/source/status/evidence reads.
- Manifest permissions/CSP: no change required.
- New public route: none.
- data_service call: none.

The development and acceptance plans cover every PRD PX-2 item and define deterministic rejection conditions. No unresolved Fatal/Major specification issue remains in the bounded scope.
