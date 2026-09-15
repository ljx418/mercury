# V2-PX PX-1 Major Repair Development Plan

## Status

`Approved for bounded implementation only after the matching preimplementation audit passes.`

PX-1 的首轮候选实现已被 2026-09-01 独立审计打回。本修复包只关闭该审计记录的 3 个 Major 和 1 个 Drawio Minor，不提前实现 PX-2 至 PX-6。

## Inputs

- `docs/active/project/evidence/v2_external_brain_productization/px-1/independent-audit.md`
- `docs/active/project/design/v2-px-1-development-plan.md`
- `docs/active/project/design/v2-px-1-acceptance-plan.md`
- `docs/active/project/design/v2-external-brain-workspace-hosting-adr.md`
- `docs/active/project/contracts/v2_external_brain_workspace_contracts.schema.json`
- 当前 `workspace.html`、Workspace Router、background open/focus 和真实 Chrome E2E。

## Repair Scope

### R1 Authority recovery

- 将 Workspace 权威读取拆成可注入 resolver，使生产实现继续只调用共享 `runtimeClient.ts`。
- `WORKSPACE_NOT_FOUND` 不得把缺失的 route workspaceId 再传给 Source Library。恢复 workspace 必须来自本次 Runtime `listKnowledgeWorkspaces()` 返回值：优先真实存在的 `ws_default`，否则使用返回顺序中的首个 workspace。
- Runtime 返回空 workspace 列表时不导航；错误页只提供重试和“暂无可恢复 Workspace”的解释。
- `SOURCE_NOT_FOUND` 和注入式 `FORBIDDEN` 只能回到已经验证存在的当前 workspace。
- 当前 Runtime 没有稳定 Forbidden 权威错误路径。PX-1 只通过注入 resolver 的组件测试验证 UI 分支，不增加 Runtime API，不生成真实 Forbidden 截图或产品声明。

### R2 Concurrent open serialization

- 将 `openOrFocusWorkspace()` 背后的 Chrome tab 操作封装为可注入、可测试的单例 coordinator。
- 同一 Service Worker 生命周期内的有效请求通过 Promise 队列串行执行；每个任务在前序任务完成后重新执行 `tabs.query()`，再 focus/update 或 create。
- 前一个任务失败不得毒化队列。后续请求仍必须执行。
- 本修复只关闭同时到达请求创建重复标签的 PX-1 缺口。PX-3 仍拥有 sender-aware 多窗口策略、标签关闭恢复、Service Worker 生命周期恢复和完整 reconnect。

### R3 Five-route recovery matrix

- 五类 route：Source Library、Source Detail、Ask、Graph、Permissions。
- 每类 route 分别执行 direct-open、reload、Browser Back、reopen，形成 20 个独立成功单元。
- 每个单元核对 canonical URL、route test id、DOM workspaceId；Source Detail 还必须核对 URL、Runtime source 和 DOM sourceId 三方一致。
- Browser Back 使用“目标 route -> 另一合法 route -> Back -> 目标 route”；reopen 使用关闭后重新打开同一 extension-origin URL，不读取前端事实缓存。
- 增加真实 Side Panel 同时发送至少 8 个打开请求的 Chrome 场景，最终只允许一个 Workspace tab，且观察到的 save/ingest POST 数为 0。

### R4 Documentation state

- 保留首轮 `independent-audit.md` 为不可覆盖的历史失败记录。
- 修复完成后新增 `major-repair` 证据，不把旧自动全绿报告改写成独立审计通过。
- 同步 Stage Gate 和 Drawio 中“自动全绿/等待审计”与“PX-1 FAIL/REOPENED”的冲突状态。

## Allowed Files

```text
apps/chrome-extension/entrypoints/background/workspaceOpen.ts
apps/chrome-extension/entrypoints/background/workspaceOpen.test.ts
apps/chrome-extension/entrypoints/workspace/main.tsx
apps/chrome-extension/src/modules/knowledge_workspace/WorkspaceRouter.tsx
apps/chrome-extension/src/modules/knowledge_workspace/WorkspaceRouter.test.tsx
apps/chrome-extension/src/modules/knowledge_workspace/workspaceAuthority.ts
apps/chrome-extension/src/modules/knowledge_workspace/workspaceAuthority.test.ts
apps/chrome-extension/e2e/chrome-v2-px-workspace-router.mjs
docs/active/project/stage-gates/v2-external-brain-productization.md
docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio
docs/active/project/evidence/v2_external_brain_productization/px-1/major-repair/
```

## Contract Impact

```text
Runtime public API: none
JSON Schema: none
data_service: none
Manifest permissions/CSP: none
Frontend internal test seams: WorkspaceAuthorityResolver and WorkspaceTabCoordinator
```

Any need to change `/v1/knowledge/*`, Workspace JSON Schema, permissions, CSP or the public `workspace.html` filename stops this repair and returns to PX-0.

## Implementation Order

1. Add authority resolver and negative component tests.
2. Replace missing-workspace recovery with Runtime-validated fallback.
3. Add serialized tab coordinator and deterministic concurrency tests.
4. Expand real Chrome route and concurrency evidence.
5. Run focused tests, full frontend regression, Runtime V2 regression, build, PX-0.2 validator and headless Chrome.
6. Write acceptance, PRD review, architecture review, false-green audit, handoff and independent read-only re-audit.

## Stop Conditions

- Any original Major remains reproducible.
- Forbidden evidence is represented as a real Runtime/product response.
- Concurrent requests can create more than one new Workspace tab.
- Any route lacks one of the four recovery modes.
- A repair requires Runtime/public schema/permission/CSP changes.
- Independent re-audit reports any Fatal or Major.
