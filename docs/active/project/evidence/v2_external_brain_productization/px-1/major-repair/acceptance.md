# V2-PX PX-1 Major Repair Acceptance

## Result

```text
Date: 2026-09-08
Result: PASS
Fatal: 0
Major: 0
Minor: 0
Scope: PX-1 Workspace Entry / Router Major repair only
```

## Acceptance Results

| Check | Result | Evidence |
|---|---|---|
| Missing workspace authority recovery | PASS | `workspaceAuthority.test.ts`; real Chrome recovered `workspace_missing` to Runtime-observed `ws_default` |
| Empty workspace list | PASS | No recovery ID is invented; retry remains available |
| Injected Forbidden branch | PASS | Resolver contract test only; not represented as real Runtime or Chrome evidence |
| Concurrent open | PASS | 8 simultaneous messages: 1 `created_new`, 7 `focused_existing`, one shared tab ID |
| Route recovery | PASS | Five routes x direct-open/reload/Browser Back/reopen = 20/20 |
| Source identity | PASS | URL, DOM and Runtime all use `src_00000000000000000000000002` |
| Runtime offline authority | PASS | `offline / unchecked / unchecked / unknown` |
| No duplicate ingest | PASS | 0 observed `POST /v1/knowledge/sources` during open/recovery/concurrency |
| Permission/CSP boundary | PASS | Existing permissions retained; no remote script CSP relaxation |

## Commands

```text
Frontend: 16 files / 140 tests passed
TypeScript: passed
WXT production build: passed; workspace.html generated
Runtime V2 knowledge API: 4 passed
PX-0.2 regression: 9 schemas / 65 positives / 109 negatives; G1-G7 true
Headless Chrome PX-1 E2E: 37 checks; report passed=true
```

Primary machine report: `route-e2e.json`. Command logs and hashed screenshots are in adjacent `logs/` and `screenshots/` directories.

## Claim Boundary

This result closes the three recorded PX-1 Major findings. It does not claim PX-2 Quick Surface, PX-3 reconnect/multi-window lifecycle, PX-4 delivery-grade Workspace components, PX-5 product acceptance, or PX-6 human exit review.
