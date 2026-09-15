# V2-PX PX-1 Major Repair Preimplementation Audit

## Result

```text
Date: 2026-09-08
Audit mode: read-only specification and code-boundary audit
Fatal: 0
Major: 0 after closure decisions below
Minor: 0
Disposition: GO for bounded PX-1 Major repair only
PX-2+: NO-GO
```

## Findings closed before code

### PX1R-AUD-001 Missing-workspace fallback authority

Static `ws_default` fallback could create a second error when that workspace does not exist. The repair freezes a Runtime-validated fallback: existing `ws_default`, otherwise the first workspace returned by Runtime. An empty list has no navigation recovery. The missing route ID is never reused.

### PX1R-AUD-002 Forbidden ownership

The current Runtime client does not expose a stable Forbidden path. Changing the Runtime contract would exceed PX-1. The UI branch is tested through an injected authority resolver and explicitly labelled contract/component evidence. Production and E2E reports may not claim a real Forbidden response.

### PX1R-AUD-003 Concurrency ownership

The independent audit requires same-window concurrent-open safety, while PX-3 owns the complete multi-window lifecycle. PX-1R therefore adds a process-local serialized coordinator and real simultaneous-message evidence. Sender-aware multi-window selection, tab-close recovery and reconnect remain PX-3.

### PX1R-AUD-004 Route matrix interpretation

The Stage Gate requires all five routes to have direct-open, reload, Back and reopen evidence. The repair freezes 20 independent cells; representative samples are no longer accepted.

### PX1R-AUD-005 Dirty worktree safety

The repository contains prior V2 work and unrelated untracked directories. The repair may edit only its allowlist and generated PX-1 repair evidence. It must not reset, clean or stage unrelated paths.

## Contract and architecture audit

- Runtime API/schema changes: none.
- Workspace JSON Schema changes: none.
- Manifest permission/CSP changes: none.
- data_service changes: none.
- P2b/P1 implementation boundaries remain unchanged.
- The original independent audit remains immutable evidence.

## Go conditions

- Development and acceptance plans are separately recorded: satisfied.
- All three Major findings have deterministic implementation and negative-test closure: satisfied.
- No unresolved Fatal/Major specification risk remains inside the bounded repair: satisfied.
- Any new Fatal/Major discovered during implementation immediately reopens this gate.
