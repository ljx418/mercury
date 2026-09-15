# T02.2 Durable Forget 恢复证据验收候选

日期：2026-09-12
状态：`LOCAL CANDIDATE PASS / INDEPENDENT REVIEW PENDING`

## 1. 候选身份

```text
runId: t02-r2-durable-forget-production-input-20260912T165535
snapshotCommit: fce3aaec9e8c8b7d88b29f60f3a94e63f9390699
rawSha256: d0309d8bc946229fcef3862508648cef295cf3f124a758be9d3636b8e2eb107d
seal.contentSha256: 50489670ce76462105bb923b8b90044f9e3075f225941af5103911208b560624
events: 1321
artifacts: 1105 = 1099 public + 6 private_local_only
```

旧 T02.1 run `t02-r2-raw-production-input-20260912T053500` 的 raw SHA-256 `711d2f2c...b0f2` 与 seal `acdc1343...abcb0` 保持不变；新 raw 中旧 runId 出现次数为 0。

## 2. 固定分母结果

| 验收项 | 本地结果 | 底层事实 |
|---|---|---|
| T02.2-A01 范围 | PASS | T02.2 只修改 E2E runner/helper/test、readiness/verifier 和证据文档；产品组件、Runtime、API、Schema 0 修改 |
| T02.2-A02 隔离 | PASS | 新 snapshot/build/profile/runtime/database/raw/seal；旧 run 字节不变且无跨 run 引用 |
| T02.2-A03 DOM 错误码 | PASS | 12 个 `SOURCE_NOT_FOUND` 均来自专用 RouteError DOM；缺失/未知/不一致单测 fail closed |
| T02.2-A04 四种重开 | PASS | 3 个 source × direct-open/reload/Back/reopen = 12/12 trigger |
| T02.2-A05 Runtime 权威 | PASS | 12/12 trigger 均绑定同 workspace/source 的 `status=forgotten` Runtime response |
| T02.2-A06 可信恢复 | PASS | 12/12 均有真实 `isTrusted=true` “返回来源库”点击和同 navigation recovery route |
| T02.2-A07 回库 absent | PASS | 12/12 source-list authority 不含被遗忘 source；recovery route 不携带 sourceId |
| T02.2-A08 旧 run 防假绿 | PASS | 旧 run 仅以 `T03-IN-09` 失败：12 个错误码缺失 + 12 个 recovery 缺失 |
| T02.2-A09 原分母无回退 | PASS | 三入口、12 source、5×4 route、2 error recovery、Axe/Keyboard、Permission、四 fault、四视口均通过 |
| T02.2-A10 全量回归 | PASS | build/typecheck、collector 12、frontend 169、Runtime 307、T01 real Chrome 36 全通过 |
| T02.2-A11 完整性 | PASS | Schema、collector invariant、530 个 Runtime request exact-one terminal、artifact 字节、seal、privacy、cleanup 全通过 |
| T02.2-A12 审计与门禁 | PENDING | 本地 PRD/架构/false-green 双轮审计为 Fatal 0/Major 0；仍等待外部独立审查 |

固定 12 项中 A01-A11 已通过，A12 的外部独立审查未完成。因此本文件不是 T02.2 正式 PASS。

## 3. 真实执行摘要

```text
collector: 12/12
frontend: 169/169
Runtime: 307 passed
T01 real Chrome: 36/36
Axe: serious=0, critical=0, violations=[]
Keyboard: 5/5
Runtime terminal: 530 requests = 515 responses + 15 transport failures; orphan=0
Background terminal: 7 requests = 7 responses; orphan=0
cleanup: browser/runtime/fixture server/profile = closed
local verifier: 33/33
T03 input readiness: Fatal=0, Major=0, ready=true
```

## 4. 失败执行隔离

`T160946`、`T161500`、`T163000`、`T170000`、`T173000` 均未生成成功 raw/seal，且已在 `failed-attempts-2026-09-12.md` 记录。它们不得拼接、补写或替代本候选。

## 5. 门禁

```text
T02 original limited PASS: unchanged
T02.1 limited PASS: unchanged
T02.2: LOCAL CANDIDATE PASS / INDEPENDENT REVIEW PENDING
T03 implementation: NO-GO
T04 / PX-6 / RKM: BLOCKED
PX-5: FAIL / REOPENED
```

只有外部独立审查确认 `Fatal=0 / Major=0`，才允许将 T02.2 标为限定 PASS，并进入 T03 实施前审计更新；不得直接进入 T03 代码实现。
