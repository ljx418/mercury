# T02.3 故障状态合同与全量重采验收计划

日期：2026-09-13
状态：`FROZEN / USER APPROVED`

## 1. 固定分母

| ID | 必须结果 |
|---|---|
| T02.3-A01 | 仅修改批准的 R2 runner/helper/test/verifier/证据文档；产品、Runtime、API、Schema 0 修改 |
| T02.3-A02 | 新 snapshot/runId/build/profile/runtime/database/raw/seal 独立；旧三轮 raw/seal 字节不变，跨 run 引用 0 |
| T02.3-A03 | 三类 faultType 与 canonical userAction 精确一一映射；未知值和通用 `retry` 均 fail closed |
| T02.3-A04 | 每个成功 `/v1/knowledge/status` 响应均从真实 artifact 原始字节解析并通过冻结 Schema；errors=0 |
| T02.3-A05 | Status 校验在 `seal()` 之前执行；失败 run 不得存在 sealed raw |
| T02.3-A06 | 旧 T02.2 raw 的成功响应在同一 checker 下稳定得到 `178 checked / 7 errors`；T03 派生层加入 offline 推断后为 179 条，均不得静默归一化 |
| T02.3-A07 | 三入口、12 source、`view_source>=3`、5 route x 4 恢复、2 个普通错误恢复全部通过 |
| T02.3-A08 | 三个真实来源的 durable Forget：12 trigger + 12 trusted recovery + 12 absent authority 全部通过 |
| T02.3-A09 | Permission、四 fault、四视口、真实 Axe serious/critical=0、Keyboard 全部通过 |
| T02.3-A10 | build/typecheck、collector、前端、Runtime、T01 真实 Chrome 全量通过且未跳过前置 |
| T02.3-A11 | raw Schema/invariant、request 唯一终态、artifact path/hash/length、seal 和 privacy 全部通过 |
| T02.3-A12 | browser/runtime/fixture/profile 清理 4/4；失败执行隔离且不可进入候选 |
| T02.3-A13 | PRD/架构/false-green 检视及外部独立审查 Fatal=0/Major=0；仅放行 T03 基线更新 |

固定分母 13，无 N/A。任一 failed、pending 或 deferred 均阻止 T02.3 PASS。

## 2. 防假绿

- 不修改 Status Schema 接受 `retry`，不在 DerivedFacts/Report 中归一化旧值。
- 不把 UI 文本或 faultType 当作 Status Schema 通过证据；必须读取 response artifact 原始字节。
- 不在 seal 后才发现错误；校验失败必须阻止 raw seal。
- 不复用 T02.2 的 12 source、Forget、Axe 或截图补充新 run。
- 不用本地 checker PASS 代替真实 Chrome、独立审查或 Human Review。

## 3. 出门状态

```text
T02.2 limited PASS: preserved for reviewed scope
T02.3: PASS only after independent Fatal 0 / Major 0
T03: resumes at baseline refresh and T03-1..4 replay
T04 / PX-6 / RKM: BLOCKED
PX-5: FAIL / REOPENED
```
