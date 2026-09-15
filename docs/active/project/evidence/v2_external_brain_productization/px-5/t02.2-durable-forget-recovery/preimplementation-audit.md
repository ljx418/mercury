# T02.2 实施前审计

日期：2026-09-12  
状态：`LOCAL PASS / IMPLEMENTATION GO WITH FROZEN SCOPE`

## 1. 审计对象

对照 `01-prd.md`、`02-architecture.md`、`04-acceptance-plan.md`、Execution Observation v6、semantic validator、T02.1 sealed raw、T03 风险停止报告、冻结 snapshot 的 Workspace authority/UI 与 R2 runner，审查 T02.2 是否需要产品或合同变更、是否存在缩小分母及能否真实采集。

## 2. 独立事实复核

| 检查 | 结果 |
|---|---|
| Workspace authority 对 forgotten source 返回 `SOURCE_NOT_FOUND` | PASS：`workspaceAuthority.ts` 明确分支 |
| 用户可见错误来自实际 DOM | PASS：`workspace-route-error` 与 `.route-error-code` 已存在 |
| 用户有明确 recovery action | PASS：“返回来源库”调用 `recoverToLibrary()` |
| canonical recovery route | PASS：`WorkspaceRouter` 构造 Source Library hash |
| T02.1 runner 已观察错误页 | PASS：四类模式均等待 RouteError 并检查正文 |
| raw 缺失点 | PASS：`observeRoute()` 不读取错误码；Forget loop 不点击/记录 recovery |
| raw Schema 是否需变更 | PASS：现有 route observation 已允许 canonical `errorCode` 和 `mode=recovery` |
| 产品/Runtime 是否需变更 | PASS：无需修改 |
| 旧 run fail-closed 可复现 | PASS：12 个 errorCode 缺失 + 12 个 recovery 缺失 |

## 3. 风险闭环

- **硬编码错误码风险**：必须从 `.route-error-code` 读取，expected 值只做比较。
- **只点按钮不记录权威风险**：recovery 后重新执行 `observeRoute()`，绑定 Source Library list Runtime response。
- **跨 scenario 复用风险**：trigger/recovery 同一 scenario/navigation，严格按 sequence 配对。
- **同源假绿风险**：trigger authority、被 Forget source 和 scenario sourceId 三方相等；recovery list 必须 absent。
- **产品改动扩散风险**：允许列表明确排除 Workspace/Runtime/contract；若实际行为不符立即停止。
- **旧基线回归风险**：旧 T02.1 raw 必须由新 verifier 非零拒绝，新 run 还需重跑完整 T02.1 分母。
- **阶段越权风险**：T02.2 PASS 只允许重新审计 T03，不直接恢复 T03 Go。

## 4. 审计结论

```text
Fatal: 0
Major: 0
Minor: 0

PRD alignment: PASS
Architecture alignment: PASS
Contract change: none
Implementation scope: collector/readiness/evidence only
T02.2 implementation: GO WITH FROZEN SCOPE
T03 / T04 / PX-6 / RKM: BLOCKED
PX-5: FAIL / REOPENED
```

用户已经批准推荐 T02.2 路线。允许在独立 worktree 中按 `development-plan.md` 实施；命中任一停止条件时本 GO 自动失效。
