# ADR: V2-PX Workspace Hosting Strategy

## Status

Accepted for V2-PX documentation baseline. Production implementation remains pending explicit user approval.

## Context

V2-PX needs a wide Knowledge Workspace that is discoverable from the existing Chrome companion Side Panel. The host choice affects routing, permissions, service startup, authentication, state recovery, browser E2E and the boundary between Navia UI and the external `data_service` candidate.

## Decision

V2-PX chooses Route A: an extension-origin `Extension Workspace Page` opened in a new Chrome tab.

The Route A public entrypoint filename is frozen as `workspace.html`. WXT configuration must emit this filename from `apps/chrome-extension/entrypoints/workspace/index.html`; PX-1 may validate the build mapping but may not rename the public entrypoint. If the mapping is infeasible under Manifest V3 or CSP constraints, PX-1 stops and returns to PX-0 instead of inventing a different URL.

```text
Host page
-> Navia Launcher / Side Panel
-> OpenWorkspaceAction
-> background/index.ts
-> chrome.runtime.getURL(workspace entrypoint)
-> focus existing tab or create new tab
-> WorkspaceRouter restores stable IDs
-> shared runtimeClient.ts reloads Runtime authority
```

The page receives only `workspaceId`, optional `sourceId / operationId`, and route intent. It must not receive page text, answers, graph facts or credentials through the URL or Chrome message.

## Route A Exit Criteria

PX-1 starts with an entrypoint spike. Route A passes only when all criteria are proven:

1. WXT builds a stable Workspace page addressable with `chrome.runtime.getURL`.
2. A real production Side Panel action opens or focuses the page without manual URL entry.
3. Direct open, reload, Browser Back and reopen preserve or explicitly recover route state.
4. Manifest V3 permissions remain limited to the existing extension boundary; no remote-script CSP relaxation or broad host permission is introduced for the page shell.
5. Runtime offline does not prevent the page shell from opening; `runtimeClient.ts` derives offline locally and renders recovery guidance.
6. Repeated requests obey `focus_existing_or_create` and do not trigger duplicate source ingest.

Failure caused by an implementation bug does not justify Route B. Route B is considered only when a reproducible WXT, Manifest V3, CSP, browser capability or required deployment constraint makes one of these criteria infeasible without violating PRD boundaries.

## Route B Fallback

Route B is a Runtime-served localhost Web Workspace, for example `http://127.0.0.1:17861/workspace`. It is not part of the current target architecture.

Switching to Route B requires returning to PX-0 and updating PRD, architecture, drawio, prototype, contracts and acceptance. The new design must explicitly add:

- Web host lifecycle and static asset versioning.
- Origin, CORS and CSRF policy.
- Extension-to-localhost authentication and session expiry.
- Runtime / Web UI version and capability negotiation.
- Offline startup behavior and user-visible recovery.
- E2E coverage for service startup, port conflict and stale UI assets.

## Options And Trade-offs

| Option | Benefits | Costs / Risks | Decision |
|---|---|---|---|
| A Extension Workspace Page | Same extension origin, reuses Chrome identity and runtime messaging, can open while Runtime is offline, least deployment change | Requires multi-entrypoint, tab reuse and route-recovery proof | Selected |
| B Localhost Web Workspace | Conventional Web routing and independent wide-page iteration | Adds server lifecycle, cross-origin auth, version skew and a heavier user entry | Controlled fallback only |
| C Side Panel only | Lowest code change | Cannot satisfy wide management, durable routes or graph / permission workflows | Rejected |
| D data_service Console | Existing external UI | Breaks Navia ownership, governance and product consistency | Rejected |

## Consequences

- P2 gains a new extension page but P3-P6 remain the single Runtime / Adapter authority.
- Route A does not require a new Runtime public API merely to host UI.
- PX-1 must stop and return to PX-0 if the spike cannot satisfy the exit criteria.
- No implementation may silently fall back to localhost or use `data_service` Console as the Navia Workspace.

## Review Evidence

The route decision is reflected in:

```text
docs/active/project/01-prd.md
docs/active/project/02-architecture.md
docs/active/project/03-development-plan.md
docs/active/project/04-acceptance-plan.md
docs/active/project/stage-gates/v2-external-brain-productization.md
docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio
```
