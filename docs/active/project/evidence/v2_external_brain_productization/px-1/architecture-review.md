# V2-PX PX-1 Architecture Review

## Result

```text
Route A hosting: PASS
P0-P7 boundary: PASS
Target entities reached for PX-1: PASS
Fatal: 0
Major: 0
```

## Current Flow

```text
Side Panel KnowledgeWorkspaceShell
  -> OPEN_NAVIA_KNOWLEDGE_WORKSPACE stable-ID message
  -> background/workspaceOpen.ts
  -> chrome.runtime.getURL("workspace.html")
  -> focus existing tab or create tab
  -> entrypoints/workspace/main.tsx
  -> WorkspaceRouter.tsx / workspaceRoutes.ts
  -> shared runtimeClient.ts
  -> Local Runtime /v1/knowledge/*
  -> V2 Adapter / Governance
```

## Entity Status

| Entity | Before | PX-1 state |
|---|---|---|
| `entrypoints/workspace/index.html` | missing | implemented |
| `entrypoints/workspace/main.tsx` | missing | implemented route-specific shell |
| `entrypoints/workspace/style.css` | missing | implemented 1280/768-capable wide layout |
| `WorkspaceRouter.tsx` | missing | implemented |
| `workspaceRoutes.ts` | missing | implemented canonical parser/builder |
| `background/workspaceOpen.ts` | missing | minimal Route A spike implemented |
| `background/index.ts` | existing | controlled action dispatch added |
| `KnowledgeWorkspaceShell.tsx` | existing Side Panel aggregate | minimal open entry added; PX-2 modification remains |
| `runtimeClient.ts` | existing authority client | reused without public contract change |
| P4-P6 Runtime / Adapter / data_service | existing | unchanged |

## Boundary Checks

- Workspace 页面只调用 `runtimeClient.ts`，没有 `fetch`、WebSocket、EventSource 或 data_service endpoint。
- background 拥有 `chrome.tabs`；Workspace/Side Panel 不自行管理标签页。
- URL 仅包含 `workspaceId/sourceId` 和 route intent，不包含正文、答案、图事实或凭据。
- Offline 状态由前端 transport failure 推导；Adapter/data_service/source 下游状态标记 unchecked/unknown。
- Manifest 权限保持 `activeTab/scripting/sidePanel/storage/tabs`，未增加 CSP 或 host。

## Drawio Comparison

P2b Workspace entrypoint 与 Router 已从“待新增”进入“PX-1 已实现”；P1 OpenWorkspaceAction 只有最小 spike，仍标为 PX-3 待补强；P2a 仍为 PX-2 待修改；P2b 业务组件拆分仍为 PX-4 待新增。Drawio 只能同步上述局部状态，不能全绿 V2-PX。

