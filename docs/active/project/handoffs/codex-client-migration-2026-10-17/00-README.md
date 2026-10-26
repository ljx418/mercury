# Navia Codex 客户端迁移包

快照日期：2026-10-17  
适用仓库：`/mnt/c/workspace/navia`  
用途：让新的 Codex 窗口恢复项目流程、职责边界、V3 当前坐标和下一工作包。

## 1. 五分钟恢复顺序

1. `01-AGENTS.md`：仓库硬规则和模块边界。
2. `02-project-stage-workflow.md`：跨会话、文档、实施、验收、人工验收和 Git 收口流程。
3. `03-project-method-and-lessons.md`：本项目已验证有效的开发方式与反复返工教训。
4. `04-v3-current-coordinate.md`：当前阶段、已完成/未完成项和下一门禁。
5. `05-v3-master-development-and-acceptance-plan.md`：V3 全局工作包与验收顺序。
6. `06-v3-completion-goal.md`：V3 长期目标和 P0-P9 边界。
7. `07-r2-final-checkpoint.md`、`08-r3-development-and-acceptance.md`：R3 的前置历史。
8. `11-r3-checkpoint.md`：最近一个已通过门禁。
9. `12-r4-development-and-acceptance.md`：当前唯一可实施工作包。
10. `13-claudecode-r4-r7-continuation-goal.md`：当前可执行的完整 ClaudeCode goal。
11. `09-new-codex-window-bootstrap-prompt.md`：交给新 Codex 窗口的完整启动提示词。

## 2. 当前结论

```text
V3 -> WP0/P0 Background Capture Relay v10
R0 PASS -> R1 PASS -> R2 PASS -> R3 PASS -> R4 MAY START
R5-R7 未开始；P1-P9 仍被 R7 阻塞；V3 未完成。
```

当前职责分工：Codex 负责 PRD、架构、计划、门禁和验收；ClaudeCode CLI 负责一个冻结工作包
内的实现与自验证；用户负责高风险授权和人类体验签署。

## 3. 快照与权威源

本目录是便于迁移的只读快照。继续开发前，新窗口必须比较 `10-MANIFEST.sha256`，并核对
以下权威源是否比快照更新：

- `AGENTS.md`
- `docs/active/project/design/project-stage-workflow.md`
- `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/04-development-and-acceptance-plan.md`
- `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/16-claudecode-v3-completion-goal-v2.md`
- `docs/active/project/evidence/v3_media_companion/v3-completion/wp0/` 下最新 checkpoint

若快照与更新后的权威源冲突，以更新后的权威源、更新日期更晚且门禁更严格的文件为准；
不得用本快照覆盖主文档。

## 4. 一键复制新窗口提示词

在 WSL 中执行：

```bash
cat docs/active/project/handoffs/codex-client-migration-2026-10-17/09-new-codex-window-bootstrap-prompt.md | clip.exe
```

