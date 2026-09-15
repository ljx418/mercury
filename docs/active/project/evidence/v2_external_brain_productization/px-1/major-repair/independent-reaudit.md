# V2-PX PX-1 Major Repair Independent Re-audit

## Disposition

```text
Audit date: 2026-09-08
Method: independent read-only code, evidence, PRD and architecture re-audit
Fatal: 0
Major: 0
Minor: 0
PX-1: PASS
PX-2: CONDITIONAL GO after its own document gate
PX-3+: NO-GO
```

## Original Major Closure

| Original finding | Independent result |
|---|---|
| Missing workspace recovery loop and unexercised Forbidden | CLOSED. Recovery target is selected from Runtime-observed workspaces; empty lists cannot navigate. Forbidden is injectable and explicitly not claimed as real authority evidence. |
| Concurrent open race | CLOSED. Unit and real Chrome concurrency evidence show one creation, seven focuses and one tab ID for eight simultaneous requests. |
| Incomplete Back/reopen evidence | CLOSED. The report contains and the audit recomputed all 20 cells for five routes x four recovery modes. |

## Independent Checks

- Read the implementation rather than inheriting the automated report conclusion.
- Recomputed route matrix and concurrent result counts from `route-e2e.json`.
- Compared the implementation with PRD route, authority, CSP/permission and no-ingest boundaries.
- Compared code entities with Drawio P1/P2b/P3 and updated only status labels, not target architecture.
- Confirmed no Runtime API/schema or data_service implementation was changed by the repair.
- Confirmed old failed `px-1/independent-audit.md` remains present.

## Residual Boundaries

The process-local coordinator does not claim Service Worker restart durability or complete multi-window policy; these remain PX-3. Ask, Graph, Permission and Forget are still route shells, not PX-4 product components. PX-1 cannot support the final V2-PX completion claim.
