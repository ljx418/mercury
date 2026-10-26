# Navia V3 完成阶段执行交接包

> **已被新执行包替代（2026-10-15）**：本目录保留历史事实和 v1-v10 追溯，不再作为明日 ClaudeCode 实施入口。当前执行入口为 `../v3-claudecode-implementation-2026-10-15/00-README.md`。新分工是 ClaudeCode 仅实现、自验证和提交 handoff；Codex 负责文档、架构、独立审查和阶段验收。

日期：2026-10-15。性质：文档候选与跨 Agent 执行合同。它不撤销历史失败证据，不把 LIMITED PASS 扩大为 V3 PASS，也不为尚未明确授权的阶段授予代码实施权限。

## 使用方式

1. Codex 先读取本目录 `00..23`；以 `16-claudecode-v3-completion-goal-v2.md` 为完整 P0-P9 范围，以 `13-p0-background-capture-relay-document-freeze.md` 为历史恢复点，并应用当前 v10 合同。`06`、`08`、`14`、`15`、`17`..`23` 仅保留历史追溯。
2. 文档外审只拉起 Codex 独立 Agent；不再交给 Claude Code，也不再要求双重文档外审。
3. Codex 负责源码实现、自验证、权威文档、功能验收和子阶段出门判断；独立 Agent 只读复算，不得代签人类验收。
4. 任一窗口遇到 `429/422/529`，按 `05-execution-and-recovery-protocol.md` 保存可恢复状态，不得把中断视为 PASS 或产品失败。

## 文件

- `01-current-state-and-gap.md`：事实基线、当前门禁和未完成范围。
- `02-target-architecture-and-ownership.md`：完成态架构、代码实体、状态与边界。
- `03-user-experience-and-spec.md`：V3 用户体验、视图职责和反退化要求。
- `04-development-and-acceptance-plan.md`：全部剩余阶段、验收分母及顺序。
- `05-execution-and-recovery-protocol.md`：Claude 双窗口分工、限流恢复和证据协议。
- `06-main-development-prompt.md`：可直接交给 `navia-主干开发` 的完整提示词。
- `07-independent-review-prompt.md`：可直接交给 `navia-审查` 的提示词。
- `08-goal-continuation-prompt.md`：可直接设置为持续 goal 的完整 P0-P9 提示词。
- `09-document-readiness-audit.md`：文档覆盖度、编码许可和残余风险。
- `10-p0-orchestration-correction.md`：最新真实 canary、唯一编排者决策与下一实现切片。
- `11-p0-daily-use-capture-checkpoint.md`：最新日常授权恢复、可信捕获 action 阻塞与 Claude 接续点。
- `12-document-development-closure.md`：架构、用户体验、开发/验收矩阵、文档交付物和高 token 调度边界。
- `13-p0-background-capture-relay-document-freeze.md`：Offscreen 失败事实、Background relay 路线和当前门禁。
- `14-claudecode-p0-relay-goal-prompt.md`：交给主干 Claude 的完整持续 goal。
- `15-claudecode-p0-relay-review-prompt.md`：交给独立审查 Claude 的只读提示词。
- `16-claudecode-v3-completion-goal-v2.md`：更新到 Background Relay v9 的完整 P0-P9 持续 goal。
- `17-p0-relay-v4-audit-minor-disposition.md`：已被第二独立审查推翻的 v4 历史处置。
- `18-p0-relay-v5-replan-closure.md`：历史 v5 候选，已被严格复核拒绝。
- `19-p0-relay-v6-replan-closure.md`：v5 五项 Major 的 v6 架构闭环与当前门禁。
- `20-p0-relay-v7-replan-closure.md`：v6 五项 Major 的 v7 逐项闭环与当前门禁。
- `21-p0-relay-v8-replan-closure.md`：v7 严格复核两个 Major 与三个 Minor 的 v8 闭环及当前门禁。
- `22-p0-relay-v8-reaudit-closure.md`：v8 首轮严格外审两项 Major 的修订、47/47 机器证据与重新外审门禁。
- `23-p0-relay-v9-replan-closure.md`：v8 第二轮严格外审两项 Major 的 v9 闭环、50/50 机器证据与重新外审门禁。

## 关联架构图

- 机器源：`docs/active/project/design/v3-completion-execution-architecture.json`
- 可视化：`docs/active/project/design/v3-completion-execution-architecture.html`
- JSON SHA-256：`4340d81f5a61b879bc0c464c8c092f12b1191713261c83b3a25635ee61d0d80d`
- HTML SHA-256：`417792d4bbd0bad56dee68da0462bbde5704b2a6ff782a6932a0fab303f1cf27`
- Archify：showcase validation 9/9，composition 0 error / 0 warning。

## 当前第一动作

不要启动六视频 Chrome run。visible muted Chrome 已证明真实 extension action 可达，但 Offscreen Document 的 Runtime WebSocket 请求未抵达 Runtime；同一浏览器 Background probe 与 Windows probe 均可连接。最新 run `/tmp/navia-b5-3-canary-1792062210940` 以 `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` 非零结束，cleanup/secret 均为 0；P0 Node 138/138、Runtime capture pytest 13/13、typecheck/build 仅为离线候选。

v10 Schema/instance、baseline 50/50 与隔离 mutation 15/15 已完成。当前第一动作是单次 Codex 独立 Agent 文档复核；Fatal=0/Major=0 后按用户既有授权直接实施 R0-R7，不再生成新的纯文档版本。P0 immutable candidate、真实故障矩阵和独立实施审查完成前，P1 六视频保持 BLOCKED。

完整续跑提示词见 `16-claudecode-v3-completion-goal-v2.md`；`08` 仅为旧事实历史。文档准备度与各阶段编码许可边界见 `09-document-readiness-audit.md`；完成态架构、体验、开发及验收映射见 `12-document-development-closure.md`。

