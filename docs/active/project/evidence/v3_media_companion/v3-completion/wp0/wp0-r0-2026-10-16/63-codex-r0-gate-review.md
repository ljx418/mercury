# WP0 R0 Codex Gate Review

日期：2026-10-16

## 1. 结论

**R0 PASS。Fatal=0，Major=0，Minor=0。允许 ClaudeCode 进入 R1；R2-R7 仍未启动。**

本结论只接受 WP0 relay v10 的 R0 合同/工作树一致性 checkpoint，不表示 relay 产品实现、
真实 Chrome、真实音频、SenseVoice、持久产品终态、WP0 或 V3 已通过。

## 2. 问题处置

历史 R0 候选发现 `M-R0-01`：两个已纳入 source inventory 的产品文件相对冻结 SHA-256
发生漂移，verifier 因 fail-closed 跳过 AST 抽取，连锁产生 46/50 与 14/15。

Codex 独立核验确认：

- 6 个缺失 boundary code 和 7 个冻结抽取 symbol 均存在；
- 漂移包含既有 V3-2/V3-3 媒体门户设置、缓存、来源权威、恢复和 Provider 路由；
- 回滚会删除两个文件合计 `+756/-68` 的既有工作树内容，不能接受；
- 采用 `60-codex-r0-hash-refreeze-decision.md` 的受限重冻结，只更新两个文件内容地址及
  `sourceEvidence` canonical digest；产品代码、schema、registry、FailureCode、抽取范围、
  固定分母与阈值均未改变。

## 3. Fresh 权威复跑

| 门槛 | 结果 | 退出码 | 证据 |
|---|---:|---:|---|
| relay v10 baseline | 50/50 | 0 | `61-r0-refreeze-contract-baseline.json` |
| relay v10 mutations | 15/15 | 0 | `62-r0-refreeze-mutations.json` |
| source emit inventory | 40/40，missing/extra 空 | 0 | baseline JSON |
| unlisted boundary emit | 0 | 0 | baseline JSON |
| non-boundary lexical control | expected 0 / actual 0 | 0 | mutation JSON |

Fresh baseline 与 mutation 都在当前工作树和当前 fixture 上执行。旧的
`r0-relay-v10-contract-baseline.json`（46/50）与 `r0-relay-v10-mutations.json`（14/15）
继续保留，作为问题发现与处置前的历史证据。

## 4. 独立 Agent 复核

隔离只读 Agent 确认受限重冻结没有修改 schema、40/20 registry、11 个 authoritative scope、
7 个 symbol、50 项 baseline 或 15 项 mutation，也确认回滚会不当删除既有 V3-2/V3-3 实现。
该 Agent 初次结论中的唯一 Major 是 fresh mutation 15/15 尚未落盘；现已由
`62-r0-refreeze-mutations.json` 关闭。

## 5. R1 约束

ClaudeCode 可继续 `05-wp0-relay-acceptance.md` 的 R1：Background transport、同步 stage、
cleanup owner。必须：

- 不修改公共 API、Origin、ticket、Cookie/provider 或产品终态合同；
- 完成 worker 不早启、owner 唯一的测试与 checkpoint；
- 发现 Fatal/Major 立即停止；
- 自动化测试禁止播放声音，任何 Chrome 必须显式 `--mute-audio`；
- 如需可见 Chrome、原生弹窗、焦点抢占或 UIAutomation，先通知用户；
- R1 完成后落盘 phase receipt、测试结果、PRD 检视、handoff，再继续 R2。

## 6. 下一门禁

`R1 checkpoint PASS`。在此之前不得进入 R2，不得把 R0 PASS 扩大为 WP0、Stage A、Stage B
或 V3 PASS。
