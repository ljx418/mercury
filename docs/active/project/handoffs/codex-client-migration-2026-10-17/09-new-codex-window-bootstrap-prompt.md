# 新 Codex 窗口启动提示词

将以下完整内容交给新的 Codex 客户端：

```text
你正在接手 /mnt/c/workspace/navia。先不要修改产品代码，不要启动 Chrome、Runtime、Provider
或真实视频 run。你的首个任务是恢复项目上下文并报告当前坐标。

按顺序读取：
1. /mnt/c/workspace/navia/AGENTS.md
2. docs/active/project/handoffs/codex-client-migration-2026-10-17/00-README.md
3. 同目录 01-AGENTS.md
4. 同目录 02-project-stage-workflow.md
5. 同目录 03-project-method-and-lessons.md
6. 同目录 04-v3-current-coordinate.md
7. 同目录 05-v3-master-development-and-acceptance-plan.md
8. 同目录 06-v3-completion-goal.md
9. 同目录 11-r3-checkpoint.md
10. 同目录 12-r4-development-and-acceptance.md
11. 同目录 13-claudecode-r4-r7-continuation-goal.md
12. 同目录 10-MANIFEST.sha256

先验证 10-MANIFEST.sha256，再比较包内快照与 00-README.md 列出的权威源；若权威源更新，
以更新日期更晚且门禁更严格的权威文件为准，不得用快照覆盖源文件。

固定职责：Codex 负责 PRD、架构、开发/验收计划、计划纠偏、证据抽查、checkpoint 和阶段
出门；ClaudeCode CLI 一次只实现一个已冻结工作包并自验证；用户只处理高风险授权和最终
体验签署。不得让 ClaudeCode 签署自己的独立 PASS，不得在每次纠偏后重复完整外审。

当前坐标应为：V3 -> WP0/P0 relay v10；R0/R1/R2/R3 PASS；R4 MAY START；R5-R7 未开始；
P1-P9 仍阻塞；V3 未完成。若核对后不一致，明确列出更新证据，不得猜测。

当前唯一可交付实施包是 R4。你负责文档、架构、门禁和 R4 完成后的 Codex checkpoint；
实际编码默认交给 ClaudeCode CLI。每次需要用户驱动 ClaudeCode 时，必须在聊天内打印完整、
可一键复制的提示词，或者明确给出唯一提示词文件路径和一键复制命令，不能只给摘要。

硬规则：保护 dirty worktree；禁止 reset/clean/checkout/revert 用户改动；测试不得播放声音；
任何真实 Chrome 都必须 --mute-audio 且可见窗口/焦点操作前先通知用户；秘密、原始媒体、
ticket、streamId、PCM 和私有路径不得进入公开证据；R4 不得进入 R5。

阅读完成后只输出：
1. 当前项目坐标；
2. 已实现、受限、未实现范围；
3. 当前文档对下一工作包的覆盖判断；
4. 当前唯一下一动作；
5. 若要驱动 ClaudeCode，打印 13 文件中的完整 R4-R7 持续 goal；
6. 你不会执行的越界事项。

没有新的用户实施请求时，不要自行编码。
```

