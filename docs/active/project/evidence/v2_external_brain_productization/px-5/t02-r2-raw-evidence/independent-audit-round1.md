# T02 R2 实施后独立审查 Round 1 处置

日期：2026-09-11  
对象：已作废 run `t02-r2-raw-20260911T052000`  
状态：审查意见已复核；该 run 因真实终态缺口被拒绝。

## 1. 外部审查意见复核

Claude Code CLI 首轮提出三个 Major：A04 应按 DOM testId 计数、A05 只有四个 URL 第一段、Schema 元校验失败。三项均不成立：

1. A04 权威口径是 Background message `origin`。原始事件中 `open_workspace`、`view_source`、`open_in_workspace` 各 2 次；DOM testId 仅是同一产品入口下的触发控件，不是验收分母。
2. A05 权威口径是五个 canonical routeIntent：Source Library 与 Source Detail 是两个独立 intent，不能按 `/knowledge/sources` 第一段合并。五类均有 direct-open/reload/Back/reopen。
3. 正确元校验命令 `Draft202012Validator.check_schema(schema)` 通过，完整实例校验 0 错误。把 Schema 当作自身实例验证不是元校验。

## 2. 被采纳并升级的真实问题

该审查同时指出两个 Runtime request 没有 terminal outcome。独立复核确认：一个是 V1 `/v1/pi/sidecar/health`，一个是 V2 `/v1/knowledge/status`。虽然当时 collector 未拒绝，证据因果链并不完整，因此将其从 Minor 升级为 T02 blocker，拒绝该 run。

闭环措施：

- collector 要求每个被采集 Background/Runtime request 恰好一个合法终态；
- E2E Background/Runtime 观察增加 ACK、去重和 30 秒有界 drain；
- R2 transport 边界固定为 `/v1/knowledge/*`，V1 sidecar/health 由 T01 回归承担；
- 增加孤儿和重复终态负例；
- 全部修复进入新隔离提交后完整重跑，不复用旧 run 产物。

本文件不构成最终独立 PASS。最终门禁只认 `t02-r2-raw-20260911T143100` 的后续独立审查。
