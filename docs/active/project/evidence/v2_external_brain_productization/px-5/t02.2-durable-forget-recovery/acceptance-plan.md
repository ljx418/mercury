# T02.2 Durable Forget 恢复证据验收计划

日期：2026-09-12  
状态：`FROZEN / PREIMPLEMENTATION LOCAL PASS / USER APPROVED FOR IMPLEMENTATION`

## 1. 固定分母

| ID | 必须结果 |
|---|---|
| T02.2-A01 | 仅修改冻结清单中的 runner、collector test、readiness/verifier 和证据文档；产品组件、Runtime 和合同 0 修改 |
| T02.2-A02 | 新 detached snapshot、runId、build/profile/runtime/database/raw/seal 全部独立；T02/T02.1 raw 与 seal 字节不变，跨 run 引用 0 |
| T02.2-A03 | RouteError `errorCode` 从真实 DOM 提取；缺元素、未知码或与 `expectedErrorCode` 不同均在 seal 前失败 |
| T02.2-A04 | 三个真实 Forget source 各有 direct-open/reload/Back/reopen 四类 trigger，12/12 均显式 `SOURCE_NOT_FOUND` |
| T02.2-A05 | 12/12 trigger 的 Runtime authority 均返回同一 `workspaceId + sourceId` 且 `source.status=forgotten` |
| T02.2-A06 | 12/12 trigger 后均发生真实“返回来源库”点击，并记录同 scenario/navigation 的 `mode=recovery` Source Library route |
| T02.2-A07 | 12/12 recovery authority 的 source list 均不含被 Forget source；recovery route 不携带 sourceId，顺序严格晚于 trigger |
| T02.2-A08 | 新 verifier 对旧 T02.1 run 非零失败并报告 12 个 errorCode 缺失 + 12 个 recovery 缺失；对新 run 退出 0 |
| T02.2-A09 | 原 T02.1-A01..A12 全部从新 run 重算通过；三入口、12 source、5x4 一般 route、2 error recovery、Axe/Keyboard、Permission、四 fault、四视口不回退 |
| T02.2-A10 | build/typecheck、collector、前端、Runtime、T01 Chrome 全量通过；不得跳过 prerequisite |
| T02.2-A11 | raw Schema/invariant、artifact path/hash/length、canonical seal、公开/私有隔离、cleanup 全部通过；成功 run 无 orphan/multi-terminal |
| T02.2-A12 | PRD/架构/false-green 检视和独立审查 Fatal=0/Major=0；只放行 T03 实施前审计更新，不放行 T03/T04/PX-5/PX-6/RKM |

固定分母 12，无 N/A。任一 failed/pending/deferred 阻止 T02.2 PASS。

## 2. 真实数据和用户路径

- 使用完整新 R2 run 的 6 web + 3 explicit local + 3 note/markdown，不使用 contract fixture 补数；
- Forget 来源必须由真实 Permission/import 流程创建，真实点击二次确认；
- direct-open、reload、Back、reopen 均由真实 Chrome 导航执行；
- `SOURCE_NOT_FOUND` 由实际 Workspace RouteError DOM 读取；
- `recovered_to_library` 由真实点击“返回来源库”及随后 canonical route/Runtime source list 共同证明。

## 3. 防假绿

- 不能把 Runtime `status=forgotten` 单独当作用户恢复成功；
- 不能把页面正文 includes 检查直接写成 raw `errorCode`；必须读取专用 DOM 节点；
- 不能在报告层补 `routeRecoveryResult`；必须先有 trigger/recovery 原始事件链；
- 不能复用同一个 recovery 扩充多个 mode；按唯一 scenario/navigation/sequence 计数；
- 不能修改旧 run、放宽错误枚举、减少三个 source 或四种 mode；
- 不能以本地 verifier PASS 替代真实 Chrome、独立审查或 Human Review。

## 4. PRD 体验检视

验收者需要逐条确认：用户重开已遗忘来源时先看到可恢复的 `SOURCE_NOT_FOUND`，稳定 source ID 没有被替换成其他来源；点击“返回来源库”后进入同一 Runtime workspace 的 Source Library，已遗忘来源不在列表中。四种导航模式均满足，且一般成功 route 恢复矩阵不受影响。

## 5. 出门状态

```text
T02.2 PASS（限定 durable Forget production-positive R2 input）
T03 implementation: NO-GO pending updated preimplementation audit and independent review
T04 / PX-6 / RKM: BLOCKED
PX-5: FAIL / REOPENED
```
