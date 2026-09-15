# T02.4 Runtime offline 边界修复验收计划

日期：2026-09-14。状态：`EXECUTED / 14 OF 14 PASS`。

## 固定分母

| ID | 必须结果 |
|---|---|
| T02.4-A01 | 仅修改批准的 P7 runner/helper/test/verifier/evidence；产品、Runtime、API、Schema 0 修改 |
| T02.4-A02 | 新 snapshot/run/build/profile/runtime/database/raw/seal 独立；旧四轮 raw/seal 字节不变，跨 run 引用 0 |
| T02.4-A03 | fault start 发生在 Runtime exit 和关闭前观察 drain 完成之后 |
| T02.4-A04 | 每个 offline interval Runtime request 恰有一个 transport_failure，runtime_response=0 |
| T02.4-A05 | 边界校验在 seal 前执行；失败 run 无 seal |
| T02.4-A06 | 旧 T02.3 在同一 checker 下精确失败：sequence 1331 request 对应 1332 response |
| T02.4-A07 | Knowledge Status 成功响应全部通过冻结 Schema，错误=0；旧 T02.2 仍为 178/7 |
| T02.4-A08 | 三入口、12 source、五 route x 四恢复、两类普通错误恢复全部通过 |
| T02.4-A09 | 三来源 durable Forget 为 12 trigger + 12 trusted recovery + 12 absence |
| T02.4-A10 | Permission、四 fault、四视口、Axe 0/0、Keyboard 5/5 全部通过 |
| T02.4-A11 | build/typecheck、collector、frontend、Runtime、T01 Chrome 全量通过且未跳过 |
| T02.4-A12 | raw/invariant、request terminal、artifact、seal、privacy 全部通过 |
| T02.4-A13 | cleanup 4/4；失败执行隔离 |
| T02.4-A14 | T03 readiness Fatal 0/Major 0；PRD/架构/false-green 审计 Fatal 0/Major 0 |

固定 14 项，无 N/A。任一 failed/pending/deferred 阻止 T02.4 limited PASS。

## 防假绿

- 不把 Runtime 退出意图当作已离线；fault interval 从可观察的退出完成与 event drain 后开始。
- 不允许 interval 内成功 response 因 Schema-valid 而通过。
- 不删除、重排或改写旧 raw event；旧 T02.3 必须作为稳定负例。
- 不跨 run 拼接 source、route、Forget、Status、Axe 或 screenshot。
- T02.4 通过最多允许恢复 T03-1，不等于 T03/PX-5/V2 通过。
