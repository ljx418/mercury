# T02.2 Durable Forget 恢复证据修复与全量重采开发计划

日期：2026-09-12  
状态：`IMPLEMENTATION COMPLETE / LOCAL CANDIDATE PASS / INDEPENDENT REVIEW PENDING`

## 1. 目标与重新定性

T03 实施期发现 T02.1 的 12 条 Forget 后重开 route observation 没有 `SOURCE_NOT_FOUND`，也没有 Source Library recovery。进一步对照冻结 snapshot `9205336cc8ae11024bd9a98e2896dfe37edbdb1e` 后确认：

- `workspaceAuthority.ts` 已把 Runtime `source.status=forgotten` 映射为 `authority_error/SOURCE_NOT_FOUND`；
- Workspace 已渲染 `data-testid=workspace-route-error` 和“返回来源库”恢复按钮；
- R2 runner 已真实等待错误页并检查正文包含 `SOURCE_NOT_FOUND`；
- 缺陷位于采集链：`observeRoute()` 未读取错误页 DOM，且 Forget loop 未点击恢复按钮、未记录 recovery route。

所以 T02.2 是生产证据采集和验收防假绿修复，不修改产品交互、Runtime API、Adapter、Schema 版本、63 RuleId、109 contract requirements 或 G1-G7 分母。

## 2. 冻结基线

```text
source snapshot: 9205336cc8ae11024bd9a98e2896dfe37edbdb1e
source runId: t02-r2-raw-production-input-20260912T053500
source rawSha256: 711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2
source seal: acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0
source status: raw/schema/collection historical limited PASS; T03 positive-base eligibility FAIL
```

旧 run、seal、artifact 和独立审查保持只读。T02.2 必须使用新 detached snapshot、新 runId、新 build/profile/runtime/database/raw/seal，禁止复制或拼接旧事件。

## 3. 允许修改的实体

| 实体 | 修改目的 |
|---|---|
| `apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs` | 从实际 RouteError DOM 提取 canonical errorCode；四类 Forget 重开后点击真实“返回来源库”按钮并记录 recovery observation |
| `apps/chrome-extension/e2e/lib/v2PxRouteEvidence.mjs` | 只接受 DOM 实测 canonical error code，拒绝缺值、未知值和 expected/observed 不一致 |
| `apps/chrome-extension/e2e/lib/v2PxRawCollector.node-test.mjs` | 增加 `SOURCE_NOT_FOUND` trigger + Source Library recovery 的 Schema/invariant 回归 |
| `t02.2-durable-forget-recovery/verify-t02.2-candidate.py` | 对 3 source x 4 mode 的错误、同源身份、authority、顺序和回库结果执行确定性验证 |
| `t03-r3-semantic-reporting/audit-t03-input-readiness.py` | 把相同 durable Forget 分母加入 T03 input readiness，确保旧 T02.1 run 非零失败 |
| 本目录文档和新 `runs/<runId>/` | 保存计划、测试、PRD检视、候选结果、handoff 与不可变真实证据 |

真实 Chrome 失败执行进一步定位到临时 `reopen` 页生命周期：页面完成路由观察后被立即关闭，页面发出的 Runtime observation 尚未从既有 E2E message bridge 排空，随后在下一场景被读成跨场景 orphan。runner 必须继续以既有 bridge 为唯一终态来源，并在每个 route 场景结束及每次 Forget recovery 完成后调用 `drainR2ObservationsUntilSettled()`；临时页只能在 settle 成功后关闭。Playwright 网络监听、后续探测请求、按 URL 猜测、超时伪造和跨 requestId 替代均禁止。

明确禁止修改：

```text
apps/chrome-extension/entrypoints/workspace/**
apps/chrome-extension/src/modules/knowledge_workspace/**
services/local-runtime/**
docs/active/project/contracts/**
旧 T02/T02.1 runs 与独立审查
T03 隔离实现
```

## 4. 采集算法

### 4.1 错误观察

`observeRoute(page)` 必须从当前 DOM 查询 `[data-testid='workspace-route-error'] .route-error-code`：

- 元素不存在：route payload 不写 `errorCode`；
- 元素存在：文本必须精确属于 `INVALID_ROUTE/WORKSPACE_NOT_FOUND/SOURCE_NOT_FOUND/FORBIDDEN`；
- 调用者可声明 `expectedErrorCode` 作为断言，但 payload 的值必须来自 DOM，不得直接复制期望值；
- DOM 值与期望不等时立即使 run 失败且不得 seal。

### 4.2 Forget 重开链

每个 source、每种 `direct_open/reload/back/reopen` 均按以下顺序采集：

```text
navigation_start(mode, forgotten source URL)
Runtime source authority -> source.status=forgotten
RouteError DOM -> SOURCE_NOT_FOUND
route_observation(mode, source detail URL, same workspaceId/sourceId, errorCode)
真实点击“返回来源库”
等待 canonical Source Library route
Runtime source-list authority -> forgotten source absent
route_observation(recovery, Source Library URL, same workspaceId, no sourceId)
```

trigger 与 recovery 必须处于同一 `scenarioId/navigationId`，且 trigger sequence 小于 recovery sequence。`reopen` 页面只能在 recovery observation 完成后关闭。

## 5. 验收器算法

对 `scenario_forget_1..3`：

1. 唯一 `/forget` request 具有唯一成功终态，返回四面 absent 验证；
2. 从 Forget request 提取权威 `sourceId` 和 `workspaceId`；
3. 四个子场景各恰有一个对应 mode 的 trigger route 和一个 `mode=recovery` route；
4. trigger 必须 `errorCode=SOURCE_NOT_FOUND`、ID 与被 Forget source 相同，authority response 为同源 `status=forgotten`；
5. recovery 必须在 trigger 之后，URL 为 canonical Source Library，workspace 相同、不得携带 sourceId；
6. recovery authority 必须是 source list，且列表不含被 Forget source；
7. 三条链合计必须恰为 12 个 trigger + 12 个 recovery，无 N/A。
8. 每个 Runtime request 仍须由同一页面的 E2E message bridge 给出恰好一个终态；页面关闭前必须 settle，终态缺失时继续 fail closed。

旧 T02.1 run 必须稳定返回 12 个 errorCode 缺失和 12 个 recovery 缺失，不能继续 `ready=true`。

## 6. 实施与验收顺序

1. 在 `/mnt/c/workspace/` 下从冻结 snapshot 创建独立 worktree；不在脏主工作树开发。
2. 先增加 collector test 与旧 run 失败回归，再修改 runner/readiness。
3. 执行 typecheck、collector tests、前端全量、Runtime 全量、T01 真实 Chrome 36 项。
4. 证明旧 T02.1 raw 在新 durable checker 下 fail closed。
5. 创建新的 `t02-r2-durable-forget-production-input-<timestamp>` 完整真实 Chrome run；禁止 `NAVIA_T02_SKIP_PREREQUISITES`。
6. 新 run 必须独立通过原 T02.1-A01..A12 和本阶段 T02.2-A01..A12；失败 run 不封存、不补写。
7. 输出 changed-files、contract-changes、test-results、PRD/架构/false-green review、acceptance-result 和 handoff。
8. 重建不超过 20 文件的平铺审计包，独立审查 Fatal=0/Major=0 后才恢复 T03 实施前审计。

## 7. 停止条件

- 需要修改 Workspace 产品代码、Runtime/API 或冻结合同；
- DOM 没有真实 `SOURCE_NOT_FOUND`，只能从预期参数补写；
- 恢复按钮不能真实返回 canonical Source Library；
- 新 run 需要引用旧 run 才能满足分母；
- 任何 prerequisite、Axe、Keyboard、真实 Chrome、privacy、seal 或 cleanup 失败；
- 新 readiness 不能稳定拒绝旧 T02.1 run；
- 发现新的 Fatal/Major PRD 或架构偏差。

命中时立即停止并回到计划，不生成 T02.2 PASS 或 T03 production candidate。
