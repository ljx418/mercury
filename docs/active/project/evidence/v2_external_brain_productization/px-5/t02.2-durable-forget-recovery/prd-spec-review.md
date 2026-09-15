# T02.2 PRD、架构与体验规格检视

日期：2026-09-12
状态：`LOCAL PASS / EXTERNAL REVIEW PENDING`

## 1. 对照范围

本轮对照 `01-prd.md` 第 18.3、18.6、18.8 节，`02-architecture.md` 第 20.5、20.7 节和 `04-acceptance-plan.md` 的 G2/G3。T02.2 只修复生产证据采集，不改变产品行为或合同。

## 2. 规格覆盖

| PRD/架构要求 | 新 run 证据 | 结论 |
|---|---|---|
| Forget 必须由用户主动发起并二次确认 | 三个真实 Permission/import source 均经“遗忘来源”与确认文本交互 | PASS |
| Library/Ask/Graph/Trace 四面 absent | 每个 `/forget` 成功响应含同 source 四面 `true` verification，随后真实查询再次确认 | PASS |
| 同一 `workspaceId + sourceId` | 三条链分别冻结 `src_...21/23/25`，四种重开均使用原 ID | PASS |
| direct-open/reload/Back/reopen 不复活 | 3×4 trigger 均显示 `SOURCE_NOT_FOUND` | PASS |
| 错误可恢复而非死页 | 每个 trigger 后真实点击“返回来源库”，共 12 个 `isTrusted=true` action | PASS |
| recovery 回到同一 Runtime workspace | 12 个 recovery URL/IDs 均为 `ws_default` Source Library 且无 sourceId | PASS |
| 回库后 source 不在列表 | 每个 recovery route 都绑定 source-list Runtime authority，原 source absent | PASS |
| Runtime 是生命周期权威 | trigger 的 `forgotten` 与 recovery 的列表均来自 Runtime response；不使用前端 tombstone 作为证据 | PASS |
| 一般成功 route 不因 Forget 证据被替代 | 五类 route 的 direct-open/reload/Back/reopen 20 组合仍独立覆盖 | PASS |
| exact-one terminal | 530 个 Runtime request 各恰有一个 response/transport failure；0 orphan/0 multi-terminal | PASS |

## 3. 偏移审计

- 产品源文件修改：0。
- Runtime、Adapter、data_service、API、JSON Schema 修改：0。
- Permission/Forget 语义修改：0。
- 验收分母缩小：0；公共 artifact 从旧基线 947 增至 1099，逐文件字节和 hash 均验证。
- 期望值补写：0；`errorCode` 由 RouteError DOM 读取，预期值只用于不一致时使 run 失败。
- 网络旁路终态：0；试验性 Playwright network fallback 已从候选树删除，E2E message bridge 是唯一 observation 来源。

## 4. 用户体验判断

真实 Chrome 中，用户重开已遗忘来源时会看到可恢复的 `SOURCE_NOT_FOUND`，不会显示其他来源或恢复旧内容；点击“返回来源库”后回到同一 Workspace，列表中不再出现该来源。四种导航模式均有原始事件链，符合 PRD 的 durable Forget 体验。

本轮不证明 PX-5 全部用户体验，也不证明完整 V2、RAG、自动维护或 RKM。Axe 只对本 run 覆盖的双容器 surface 得出 serious/critical 为 0；其他页面后续仍应继续真实扫描。

## 5. 结论

```text
PRD scope drift: 0
Architecture boundary drift: 0
False-green Major found in candidate: 0
T02.2 local PRD/spec review: PASS
External independent review: PENDING
```
