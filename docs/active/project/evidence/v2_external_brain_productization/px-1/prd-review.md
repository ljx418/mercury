# V2-PX PX-1 PRD Review

## Result

```text
PX-1 PRD scope: PASS
Fatal deviations: 0
Major deviations: 0
Overclaims: 0
```

## Coverage

| PRD requirement | Implementation / evidence | Result |
|---|---|---|
| Route A Extension Workspace Page | WXT `workspace.html`; extension-origin screenshot | PASS |
| `open_workspace -> source_library` | Side Panel button -> background -> canonical library URL | PASS |
| 五类 canonical route | `workspaceRoutes.ts` + 5 route E2E | PASS |
| direct-open / reload | 5/5 routes E2E | PASS |
| Browser Back / reopen | Graph Back、Source Detail reopen | PASS for PX-1 representative routes |
| stable workspace/source identity | URL、Runtime source 和详情 DOM 使用同一 ID | PASS |
| invalid ID recovery | INVALID_ROUTE / WORKSPACE_NOT_FOUND / SOURCE_NOT_FOUND | PASS |
| Runtime offline shell | headless transport fault + offline screenshot | PASS |
| 不扩大 CSP / permissions | build manifest diff and spike JSON | PASS |
| 重复打开不重复 ingest | 1 -> 1 Workspace page；网络 POST count = 0 | PASS for minimal entry |

## Stage Boundary

PRD 的最终三个入口、所有 route action 的跨容器交接、多窗口复用和 reconnect 属于 PX-2/PX-3。本阶段只用一个最小真实 `打开工作台` 入口证明 Route A 六项 spike 可行；没有把 PX-1 的代表性 Back/reopen 样本冒充 PX-5 的五类完整产品矩阵。

Ask 和 Permissions route 当前是带 Runtime 状态的明确阶段壳，不是交付级业务组件。完整 Source/Ask/Trace/Graph/Permission/Forget 由 PX-4 实现，不从当前页面文案推导成功声明。

## No-Go Check

- 没有 localhost Workspace。
- 没有 URL 事实 payload。
- 没有前端直连 data_service。
- 没有前端创建 KnowledgeItem、EvidenceRef 或 graph relation。
- 没有自动保存、自动遗忘或默认本地文件读取。
- 没有使用原型/合同 fixture 作为产品截图。

