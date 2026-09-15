# T01 R1 前端与真实 Chrome 变更清单

日期：2026-09-11  
隔离验收提交：`5a34e5aef0ad493ef4374ad0ead6ea3a1c27fcbd`  
状态：T01 结果记录，不扩大为 PX-5 或 PX-6 完成声明。

## 产品实现

- `apps/chrome-extension/src/runtimeClient.ts`：增加页面私有 Runtime 凭据代际、请求中止、类型化 transport/authentication/api/stale 错误和 `X-Request-ID` 对齐。
- `apps/chrome-extension/entrypoints/sidepanel/main.tsx`：Knowledge 容器认证、断开和晚到结果清理；仅 E2E 构建启用受控 bridge。
- `apps/chrome-extension/entrypoints/background/index.ts`：仅 E2E 构建启用原生 Side Panel 用户动作桥接；生产构建不暴露该入口。
- `apps/chrome-extension/src/modules/knowledge_workspace/LocalRuntimeAccess.tsx`：四态连接 UX 与稳定定位符。
- `apps/chrome-extension/src/modules/knowledge_workspace/PermissionRootManager.tsx`：单 active root、POSIX 路径预检、异步撤销后清理。
- `apps/chrome-extension/src/modules/knowledge_workspace/ForgetSourceDialog.tsx`：只接受 succeeded 且四面严格为 true 的成功结果。
- `apps/chrome-extension/src/modules/knowledge_workspace/KnowledgeWorkspaceShell.tsx`：Workspace 容器会话与敏感状态清理。
- `apps/chrome-extension/src/modules/knowledge_workspace/SaveToKnowledgeCard.tsx`：增加真实 Chrome 稳定定位符。
- `apps/chrome-extension/src/modules/knowledge_workspace/SourceLibraryPanel.tsx`：增加精确 source 行定位符。

## 测试与验收工具

- `apps/chrome-extension/src/runtimeClient.test.ts`
- `apps/chrome-extension/src/modules/knowledge_workspace/LocalRuntimeAccess.test.tsx`
- `apps/chrome-extension/src/modules/knowledge_workspace/PermissionRootManager.test.tsx`
- `apps/chrome-extension/src/modules/knowledge_workspace/WorkspaceProductComponents.test.tsx`
- `apps/chrome-extension/src/modules/knowledge_workspace/SourceLibraryPanel.test.tsx`
- `apps/chrome-extension/e2e/chrome-v2-t01-r1-frontend.mjs`

## 明确未修改的边界

- 未修改 Runtime HTTP/OpenAPI、Memory schema、事件类型或 Adapter 公共合同。
- 未接入真实 `data_service`，未实现 RKM、自动扫描、自动遗忘或 PX-6 人工验收。
- 未回退主工作树中用户或前序 Agent 的其他改动；主仓库 HEAD 和 index 未被隔离验收提交改变。
