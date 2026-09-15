# V2-PX-3 Action、Stable ID 与 Reconnect 开发计划

日期：2026-09-08

## 1. 目标

在不修改 Runtime public contract 的前提下，补强 Background `OpenWorkspaceAction`、跨窗口标签页复用和共享 Runtime 状态重连，使 Side Panel 与 Workspace 只凭稳定 `workspaceId/sourceId/operationId` 恢复权威状态。

## 2. 冻结决策

1. 标签选择顺序：优先 sender 所在窗口中的既有 Workspace；否则优先当前聚焦窗口；否则选择 tabId 最小的既有 Workspace。
2. 同一 Service Worker 生命周期内使用串行 coordinator 防并发重复创建；Service Worker 重启后不恢复内存队列，而是重新 `tabs.query`，既有 Workspace 标签页仍可复用。
3. 关闭最后一个 Workspace 标签页后，下次显式入口创建新标签页；不自动重开。
4. Background 只传稳定 ID 和 route intent，不传网页正文、EvidenceRef 或知识事实；打开/聚焦不得触发 ingest。
5. Runtime 状态轮询立即执行；在线默认 5 秒，失败采用 1/2/4/8 秒封顶退避；重新 online 时恢复 5 秒。停止函数必须取消 timer，in-flight 请求不得重叠。
6. transport failure 只能推导 Runtime offline；Adapter/data_service 为 `unchecked`，source build 为 `unknown`。成功响应后才发布 Runtime 权威值。
7. reconnect 后按 route 中稳定 ID 重新查询；不得从浏览器缓存直接恢复 `trace_ready`。

## 3. 修改范围

- `entrypoints/background/workspaceOpen.ts`：sender window context、确定性 tab 选择、restart/close 语义测试。
- `entrypoints/background/index.ts`：传入 `sender.tab.windowId`。
- `src/runtimeClient.ts`：可取消、非重叠、退避的 knowledge status poller。
- `entrypoints/workspace/main.tsx`：接入 poll/reconnect 触发 Runtime authority reload。
- `entrypoints/sidepanel/main.tsx`：复用 poller 更新四域状态和 source，而非缓存权威结果。
- 测试和 `e2e/chrome-v2-px-workspace-router.mjs`：多窗口、关闭、restart-equivalent、offline/reconnect、ID 与零 ingest。

不修改：Runtime API/Schema、data_service、CSP/permissions、PX-4 管理组件。

## 4. 顺序

1. 扩展 Background coordinator 单元测试并实现 sender-aware selection。
2. 增加 runtime poller 单元测试并实现。
3. 接入 Workspace 和 Side Panel。
4. 执行 focused tests、全量 tests、typecheck、build、Runtime API、PX-0.2 validator。
5. 运行真实 Runtime + Headless Chrome PX-3 E2E。
6. PRD、架构、false-green 和独立审计；任一 Fatal/Major 打回本计划。
