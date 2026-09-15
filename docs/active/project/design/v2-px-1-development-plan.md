# V2-PX PX-1 Workspace Entry And Router Development Plan

## Status

`Approved for implementation after the matching preimplementation audit passes.`

PX-0.2 已于 2026-09-01 通过第五轮独立复审。PX-1 只实现 Route A 的可构建 Workspace 页面、canonical Router、Runtime offline 壳层和最小真实打开入口，不提前声明 PX-2 至 PX-6 完成。

## Inputs

- `docs/active/project/01-prd.md` 17.1。
- `docs/active/project/02-architecture.md` 21.1。
- `docs/active/project/design/v2-external-brain-workspace-hosting-adr.md`。
- `docs/active/project/contracts/v2_external_brain_workspace_contracts.schema.json`。
- `docs/active/project/stage-gates/v2-external-brain-productization.md`。
- 当前 WXT 0.20.11 / Manifest V3 配置、`runtimeClient.ts` 和 Side Panel Knowledge Shell。

## Scope And Ownership

新增：

```text
apps/chrome-extension/entrypoints/workspace/index.html
apps/chrome-extension/entrypoints/workspace/main.tsx
apps/chrome-extension/entrypoints/workspace/style.css
apps/chrome-extension/src/modules/knowledge_workspace/WorkspaceRouter.tsx
apps/chrome-extension/src/modules/knowledge_workspace/WorkspaceRouter.test.tsx
```

为完成 Route A 六项 spike，允许最小修改：

```text
apps/chrome-extension/entrypoints/background/index.ts
apps/chrome-extension/entrypoints/sidepanel/main.tsx
apps/chrome-extension/src/modules/knowledge_workspace/KnowledgeWorkspaceShell.tsx
apps/chrome-extension/wxt.config.ts
```

最小修改只提供 `open_workspace -> source_library` 生产入口和单一 Workspace 标签复用证明。`查看来源`、`在工作台中打开`、完整多窗口复用、poll/reconnect 仍分别由 PX-2、PX-3 拥有。

## Implementation Order

1. 冻结纯函数 route parser/builder，覆盖五类 route、稳定 ID、canonical encoding 和错误恢复。
2. 创建 `workspace.html` WXT entrypoint，挂载 `WorkspaceRouter` 和 route-specific shell。
3. 通过共享 `runtimeClient.ts` 读取 Runtime、Workspace 和 Source 权威状态；离线时只显示前端推导的 `offline / unchecked / unknown`，不伪造下游状态。
4. 增加最小 background 打开/聚焦处理和 Side Panel “打开工作台”入口；消息只传 requestId、route intent 和稳定 ID。
5. 构建并验证 `workspace.html`、Manifest/CSP/permissions 不扩张、`chrome.runtime.getURL("workspace.html")` 路径成立。
6. 执行 Router 单元测试、真实 Runtime API 检查、headless extension-page E2E、全量前端回归和独立只读审计。

## Explicit Deferrals

- PX-2：三个入口的最终位置、状态条件、420/360px Quick Surface。
- PX-3：五类目标 route 的 action 交接、多窗口 tab reuse、operation reconnect 和完整幂等矩阵。
- PX-4：Source/Ask/Graph/Permission/Forget 交付级宽屏组件拆分。
- PX-5：12 个真实 source、完整真实 Chrome 双容器证据和 HTML 报告。
- PX-6：人工产品验收与最终有限声明。

## Stop Conditions

- WXT 不能稳定产出 `workspace.html`。
- 需要 localhost Workspace、远程脚本 CSP 放宽或新增宽泛权限。
- Router 只能依赖 fixture 或 URL 中的事实 payload。
- Runtime offline 阻止页面壳打开，或 UI 伪造 Adapter/data_service/source 状态。
- 真实生产入口无法打开 extension-origin Workspace。

