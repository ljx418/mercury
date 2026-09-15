# T02.1 R2 Production Positive 输入全量重采验收计划

日期：2026-09-11  
状态：`FROZEN / HISTORICAL RUN COMPLETE / T03 INPUT ELIGIBILITY REOPENED`

> 2026-09-12 实施后审计补充：T02.1-A09 只要求“同源四类重开”，未明确要求每次重开在 raw 中同时出现 `SOURCE_NOT_FOUND + recovered_to_library`。已封存 run 的 12 条观察均缺少该错误/恢复结果，因此其 raw/schema/collection 结论保留，但不得继续作为 T03 production-positive base。修复与重采边界见 `../t03-r3-semantic-reporting/t03-implementation-risk-stop-durable-forget-2026-09-12.md`。

## 1. 固定验收分母

| ID | 必须结果 |
|---|---|
| T02.1-A01 | 新 run 独立命名、独立 snapshot/build/profile/runtime/database/seal；旧 `143100` raw 与 seal SHA-256 不变；无跨 run 引用或拼接 |
| T02.1-A02 | 原 T02-A01..A12 全部重新执行并通过，Fatal=0/Major=0；不得继承旧 run 的 PASS 布尔 |
| T02.1-A03 | `open_workspace >=2`、`open_in_workspace >=2`、`view_source >=3`，全部来自 trusted native Side Panel click 且 Background/Runtime 因果链完整 |
| T02.1-A04 | 单 run source manifest 恰为 12 个唯一 sample：6 real_web、3 explicit_local_document、3 note_markdown；raw bytes/hash、Runtime sourceId/operationId 和成功响应可重算 |
| T02.1-A05 | 五 route × direct-open/reload/Back/reopen 保持 20 组合全覆盖，workspace/source ID 与同 navigation Runtime authority 一致 |
| T02.1-A06 | 至少 2 个 canonical invalid/forbidden 错误样本；每个包含错误 route observation、canonical `errorCode`、真实恢复动作和 Source Library recovery observation |
| T02.1-A07 | AxeResult 来自实际 axe-core 扫描，Serious=0、Critical=0；完整 violations JSON 以 artifact/hash 留存 |
| T02.1-A08 | KeyboardResult 来自真实 keyboard interaction，关键断言全部通过；至少覆盖 Escape、焦点返回、Tab 可达/无 trap、reduced motion |
| T02.1-A09 | Permission >=3、Forget >=3、四 fault、Side Panel 360/420 与 Workspace 768/1280 均保持通过；每个 Forget source 的 direct-open/reload/Back/reopen 必须记录 `SOURCE_NOT_FOUND`、同一 `workspaceId + sourceId`、`recovered_to_library` 和最终 Source Library route，仅记录 Runtime `status=forgotten` 不通过 |
| T02.1-A10 | raw event/artifact Schema、seal、exact-one terminal、segment/navigation authority、截图 metadata、公开/私有隔离全部通过 |
| T02.1-A11 | `audit-t03-input-readiness.py --run-root <newRun>` 退出 0，`major=0`、`readyForPositiveProductionValidation=true`；该结果只证明 T03 输入充分，不等于 T03/PX-5 PASS |
| T02.1-A12 | PRD、架构、范围和 false-green 检视通过；独立 Claude Code CLI 审查 Fatal=0/Major=0 后才允许恢复 T03 实施前审计 |

固定分母 12，无 N/A。任一 failed/pending/deferred 阻止 T02.1 出门。

## 2. 防假绿

- source corpus 只从同 run 的 source registry artifact、原始 source bytes 和成功 Runtime save/import response 重算。
- typed result 必须是 `command_result.structuredResult` 指向的真实 JSON artifact；不能从普通日志字符串或旧 report 推断。
- route error 必须有错误 observation 与后续 recovery observation；只出现错误页面或只出现回库页面均不计数。
- 同一 source、entry 或 route 的重复报告字段不能扩充分母；以唯一 event/action/source sample 为准。
- Review-only prototype、contract fixture、旧 generator/validator 输出和旧 T02 run 均不得补 production 分母。
- Axe 自动扫描和 keyboard 自动交互只支持冻结的 G6 机器分母，不宣称屏幕阅读器人工验收。

## 3. 独立复审边界

独立审查者需重算：新 run seal、所有 artifact path/hash/length、T02-A01..A12、三入口计数、12-source registry、route error/recovery 配对、typed Axe/Keyboard、四视口、四 fault、Permission/Forget、公开证据扫描和 cleanup。只读审查不得运行旧生成器覆盖证据。
