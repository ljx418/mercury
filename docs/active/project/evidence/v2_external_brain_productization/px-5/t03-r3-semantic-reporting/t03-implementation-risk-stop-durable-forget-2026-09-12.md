# T03 实施期风险停止：Durable Forget 恢复证据不满足冻结合同

日期：2026-09-12  
状态：`MAJOR / IMPLEMENTATION STOPPED / REPLAN REQUIRED`

## 0. 决定

T03 在把 T02.1 sealed raw evidence 转换为 Execution Observation v6 和 Report v12 时发现：T02.1 的 12 条 Forget 后重开观察没有证明冻结 PRD 要求的 `SOURCE_NOT_FOUND + recovered_to_library`。这些记录只证明 Runtime 重新查询后返回同一 source 的 `status=forgotten`，浏览器仍停留在该 source detail URL。

```text
Fatal: 0
Major: 1

T02 original limited PASS: unchanged
T02.1 raw/schema/collection limited PASS: archived and unchanged
T02.1 eligibility as a T03 production-positive base: FAIL / REOPENED
T03 implementation: STOPPED / REPLAN
T04 / PX-6 / RKM implementation: BLOCKED
PX-5: FAIL / REOPENED
```

不得由 T03 推导器补写 raw 中不存在的错误码或恢复结果，不得降低 G3 分母，不得把隔离实现的局部测试结果升级为 T03 PASS。

## 1. 冻结权威

以下 active authority 对同一行为给出一致要求：

| 权威 | 要求 |
|---|---|
| `01-prd.md` PX-0.1b 证据语义 | Forget 后 direct-open、reload、Back、reopen 均保持 `SOURCE_NOT_FOUND`；生产 Workspace 必须重新查询 Runtime 权威状态 |
| `04-acceptance-plan.md` G3 | 同一 forgotten source 四类重开均返回 `SOURCE_NOT_FOUND + recovered_to_library` |
| `02-architecture.md` | 重开成功或缺少 `SOURCE_NOT_FOUND` 均为 durable Forget 失败 |
| `v2_external_brain_execution_observation.schema.json` v6 | `ForgetReopenCheck.errorCode=SOURCE_NOT_FOUND` 且 `routeRecoveryResult=recovered_to_library` |
| `v2-external-brain-productization-semantic-validator.md` | 四类重开任一路径仍成功即返回 `PX_FORGET_DURABLE_RECOVERY_INVALID` |

这些要求不是 T03 新增规格，也不能在 T03 阶段改写。

## 2. 冻结输入

```text
runId: t02-r2-raw-production-input-20260912T053500
snapshotCommit: 9205336cc8ae11024bd9a98e2896dfe37edbdb1e
rawSha256: 711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2
seal.contentSha256: acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0
T02.1 independent audit sha256: 06afe77ed83c557bd9f4a3725eb135547aa56b2b2e40a9a32f9a69baabd3b020
```

本风险记录不修改上述 raw、seal 或独立审查原文。

## 3. 12 条可复现事实

三条 Forget 链分别使用 source `...21`、`...23`、`...25`。每个 source 的四种重开都存在 route observation 和 Runtime authority response，但结果相同：route observation 无 `errorCode`，`ids.status=observed`，URL 仍为 forgotten source detail；Runtime HTTP 200 返回同一 source 的 `status=forgotten`。

| 场景 | route seq | `errorCode` | ID 状态 | Runtime source 状态 |
|---|---:|---|---|---|
| `scenario_forget_1_direct_open` | 765 | 缺失 | `observed` | `forgotten` |
| `scenario_forget_1_reload` | 770 | 缺失 | `observed` | `forgotten` |
| `scenario_forget_1_back` | 776 | 缺失 | `observed` | `forgotten` |
| `scenario_forget_1_reopen` | 781 | 缺失 | `observed` | `forgotten` |
| `scenario_forget_2_direct_open` | 865 | 缺失 | `observed` | `forgotten` |
| `scenario_forget_2_reload` | 870 | 缺失 | `observed` | `forgotten` |
| `scenario_forget_2_back` | 876 | 缺失 | `observed` | `forgotten` |
| `scenario_forget_2_reopen` | 881 | 缺失 | `observed` | `forgotten` |
| `scenario_forget_3_direct_open` | 961 | 缺失 | `observed` | `forgotten` |
| `scenario_forget_3_reload` | 966 | 缺失 | `observed` | `forgotten` |
| `scenario_forget_3_back` | 972 | 缺失 | `observed` | `forgotten` |
| `scenario_forget_3_reopen` | 977 | 缺失 | `observed` | `forgotten` |

代表样本 `scenario_forget_1_direct_open`：

```text
route URL:
chrome-extension://<extension-id>/workspace.html#/knowledge/sources/
src_00000000000000000000000021?workspaceId=ws_default

route payload:
  mode=direct_open
  ids.status=observed
  errorCode=<absent>

authority response:
  HTTP 200
  ok=true
  data.source.sourceId=src_00000000000000000000000021
  data.source.workspaceId=ws_default
  data.source.status=forgotten
```

这足以证明 Runtime tombstone 被重新查询，但不足以证明用户进入 recoverable error 并回到 Source Library。

只读复现器为 `audit-t02.1-durable-forget-input.py`。对冻结 run 执行时退出码为 `1`，读取到 12 条目标 observation，并确定性返回 24 个缺口：12 个 `SOURCE_NOT_FOUND missing` 和 12 个 `Source Library recovery missing`；`eligibleAsT03ProductionPositiveBase=false`。

## 4. 根因与 false-green

T02.1-A09 和对应 readiness 检查只计算了：

- 三个 Forget source；
- 每个 source 存在 direct-open/reload/Back/reopen route observation；
- 重开检查使用同一 source/workspace；
- Runtime 最终返回 `forgotten`。

它们没有把 `route.errorCode=SOURCE_NOT_FOUND`、恢复到 Source Library、`routeRecoveryResult=recovered_to_library` 纳入固定分母。T02.1 独立审查据此确认了一个比 PRD/G3 更弱的集合，属于验收覆盖缺口，不是 raw 字节损坏或 seal 失败。

因此：

- T02.1 的 raw Schema、seal、source corpus、Axe、Keyboard 等既有结论不撤销；
- “可作为 T03 production-positive base”的结论撤回；
- T03 必须 fail closed，不能从这些观察生成 passed G3。

## 5. 本轮隔离实现处置

T03 共享 reader、derived facts、semantic/AST core 和四份候选 Schema 只存在于隔离 worktree，未复制到主工作树。局部开发已达到 contract regression `109` 与 production mutation `42/42 detected` 的探索结果，但该结果依赖不合格 positive base，不能构成 T03-A01..A14 验收，也不得生成 production candidate report/package。

隔离 worktree 只用于后续经批准的恢复，不得在本门禁关闭前合入或作为 PASS 证据。

## 6. 推荐修复路线：T02.2

后续源码复核确认产品已真实显示 `SOURCE_NOT_FOUND` 并提供“返回来源库”动作，缺口集中在采集器没有把这两个已发生行为写入 raw。因此推荐创建 `T02.2 Durable Forget Recovery Repair`，范围收窄为采集器、验收器和全新真实 Chrome 证据，不修改产品或 Runtime：

1. runner 从实际 RouteError DOM 读取 `SOURCE_NOT_FOUND`，调用者期望值只能用于比较，不得直接写入 raw。
2. direct-open、reload、Back、reopen 四种模式均从 Runtime authority 重新查询；记录同一 `workspaceId + sourceId` 的 error route，真实点击“返回来源库”，再记录最终 Source Library recovery route 和 source-list authority。
3. 增加至少三条独立 source 的完整链：`trace_ready -> Forget -> forgotten -> 四种重开均失败并恢复`，即 3 x 4 = 12 条行为断言。
4. 更新 T02 readiness 和候选验证，使旧 T02.1 run 必须稳定失败 `PX_FORGET_DURABLE_RECOVERY_INVALID`，不能只按事件数量通过。
5. 创建全新独立 R2 run；从 build/profile/runtime/db/raw/seal 全部重新执行，不与 T02/T02.1 artifact 拼接。
6. 新 run 仍须完整通过 T02.1-A01..A12 的其他分母、真实 Chrome、Axe、Keyboard、cleanup、seal 和独立审查。
7. 独立审查 Fatal=0/Major=0 后，更新 T03 frozen source run，再从隔离实现重新执行 T03-A01..A14。

## 7. 备选路线与决定边界

备选路线是修改 PRD、架构、Execution v6 和 semantic validator，允许 forgotten source detail 保持可打开但标记 `forgotten`。该路线不推荐：它削弱“Forget 后不可重开”的既定用户体验，并要求回退 V2-PX 合同门禁、更新 109 个 contract fixtures 及相关 Drawio/验收文档。

用户已于 2026-09-12 批准推荐 T02.2 路线；不得通过改报告、改 Schema 或改失败码绕开采集缺陷。若真实 Chrome 证明产品错误页或恢复动作实际不存在，T02.2 必须再次停止，不能擅自扩大到产品修改。

## 8. 恢复条件

只有以下条件全部满足才允许恢复 T03：

- T02.2 开发与验收计划完成实施前审计，Fatal=0/Major=0；
- 产品与 collector 回归证明 3 source x 4 reopen 的 `SOURCE_NOT_FOUND + recovered_to_library`；
- 全新 sealed raw 的 12 条 route observation 和 Runtime authority 可逐项重算；
- 旧 T02.1 run 被新的 readiness checker 稳定拒绝；
- 全新 run 独立审查 Fatal=0/Major=0；
- T03 文档绑定新 runId/raw/seal/snapshot，且再次实施前审计通过。

当前自动化开发停止原因：冻结 production-positive 输入与 PRD/G3 durable Forget 合同冲突，继续生成 passed report 会构成 semantic false-green。
