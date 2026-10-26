# ClaudeCode 逐工作包提示词

每次只粘贴一个提示词。完成后必须停止并交给 Codex；没有 Codex `WORKPACK PASS / NEXT WORKPACK MAY START` 不得继续。

## 通用前缀

```text
你在 /mnt/c/workspace/navia 工作。你是实际实现代理，不是规格、架构或独立审查代理。

先读取 AGENTS.md、docs/active/project/design/project-stage-workflow.md，以及
docs/active/project/handoffs/v3-claudecode-implementation-2026-10-15/ 下的
00、01、02、03、04 和当前工作包验收文档。

先运行 git status --short --untracked-files=all，读取相关 diff 和当前代码。禁止 reset --hard、checkout、clean、覆盖用户改动、删除历史失败证据或清理非本轮资源。所有 Chrome 必须显式 --mute-audio，任何测试不得播放声音。Cookie、API Key、凭据、原始音视频、未授权帧和绝对私有路径不得写入公开材料。

只执行当前工作包。不得修改 PRD、目标架构、固定分母或验收阈值；若必须变化，立即停止并交回 Codex。不得自行冻结合同、宣布 PASS、进入下一包或承担独立外审。

执行可见 Chrome、原生权限弹窗、焦点抢占或 UIAutomation 前，先在对话框明确通知用户影响、持续时间和静音措施，等待用户安排后再执行。

结束时必须落盘并回复：changed files；合同变化或 none；所有测试命令与退出码；真实 run/build/task/candidate ID；PRD 覆盖；cleanup/secret scan；剩余风险；证据目录；自动化开发停止原因。即使全部通过也必须停止等待 Codex。
```

## WP0：Relay R0-R7

```text
执行 WP0，权威文档为 05-wp0-relay-acceptance.md。relay v10 文档已通过。

按 R0->R7 实现。每个 R 完成后写 phase receipt、测试结果、PRD 检视和下一 R prerequisite；发现 Fatal/Major 立即停止。R0 先证明 50/50、15/15 和 Schema；R1/R2/R3 实现 Background transport、同步 staging、Offscreen producer、exact sender/bounded queue、单 controller；R4 做真实恢复；R5 仅对 BV1pohR6rEEh 做条件已改变的 fresh muted canary；R6 做真实故障矩阵；R7 生成 immutable candidate。

不改公共 API/schema，不启动六视频。R7 完成后停止，交给 Codex。
```

## WP1：Stage A 完整收口

```text
前提：Codex 已明确 WP0 PASS；否则停止。执行 WP1，权威文档为 06-wp1-stage-a-closure-acceptance.md。

用 WP0 新 relay 对 BV1pohR6rEEh 完成 fresh 正向日常路径；用 BV1hMpE6FEXG 按原合同重建/绑定 NJ-01..NJ-10，同 build 证明状态、计时、终态同步、取消、重连、路由、seek、焦点和 policy switch。NJ-09 保持四状态 x 四视口和三次 fresh repeat；历史失败不删除。

生成完整 Stage A candidate、verification、NJ mapping、PRD review 和 handoff 后停止。bounded NJ LIMITED PASS 不足以自行进入 Stage B。
```

## WP2：Stage B 六视频

```text
前提：Codex 已明确 FULL STAGE A PASS；否则停止。执行 WP2，权威文档为 07-wp2-stage-b-quality-acceptance.md。

按 stage-b-six-video-registry.json 顺序对六 BVID 逐个 fresh Runtime/database/profile/task、--mute-audio、单任务单 Provider。不得替换、拼接或把 strict schema/composer 当内容正确。记录 authority、route、派生输入 hash、<=100 字 brief、全片章节、claim-evidence、帧/seek、资源、cleanup 和公开扫描；完成无秘密 package 和宿主 LLM 内容 rubric。

完成 B-5/B-6 后只生成 Stage B IMPLEMENTATION CANDIDATE。B-7 由未参与实现/B-6 的 Codex 独立 Agent 执行，不是人类签署；你不得自审或进入 WP3。两个 blocked、内容 Major、scan hit 或 cleanup 非零立即停止。完成后交给 Codex。
```

## WP3：Stage C 图文工作台

```text
前提：Codex 已明确 WP2 B-7 Fatal=0/Major=0 且完整 STAGE B PASS，并已落盘 MediaWorkspaceVisualProjection schema/fixtures/FailureCode/组件路由矩阵/实施前审计；缺任一项立即停止。

执行 WP3，权威文档为 08-wp3-stage-c-workspace-acceptance.md。依次 C1 图文大纲、C2 视频秒数时间线、C3 概念关系图；每个子包独立 candidate/handoff 并等待 Codex 子包验收后再继续。开发 smoke 用六视频 registry 前三项，总出门覆盖六项。renderer 不得成为事实源，生成图不得冒充视频帧。
```

## WP4：Stage D 导出

```text
前提：Codex 已明确 WP3 PASS，且已冻结 export schema、五风格 registry、fixtures、FailureCode 和实施前审计；缺任一项停止。

执行 WP4，权威文档为 09-wp4-stage-d-export-acceptance.md。把长文/笔记/专栏移入导出，实现五种 prompt-distinct profile、范围/篇幅/截图/引用控制、独立 artifact、预览/取消/重试/下载和失败恢复。前三固定视频各五风格=15 输出，六视频各默认导出=6。禁止跨 Provider 拼接和污染 grounded projection。

生成 candidate 后停止，交给 Codex。
```

## WP5：Chat/Know 与人工候选

```text
前提：Codex 已明确 WP4 PASS、已解除 Chat/Know IMPLEMENTATION NO-GO，并冻结 ContextEnvelope/Draft/Item transaction fixtures、FailureCode、G1-G6 分母和实施前审计；缺任一项停止。

执行 WP5，权威文档为 10-wp5-chat-know-human-acceptance.md。完成 G1-G6：手动 Runtime/配对/Settings；三固定普通网页 Chat；六视频 Chat；Draft 显式确认；Know 真实 CRUD；生产导航收敛。完成 300ms 状态、增量聊天、滚动、新聊天、单删/全清和密钥凭据库。

使用同一 production build 完成自动验收并生成 machine candidate，随后停止。不要填写 H01-H10、V3-5.1 human review 或 CX-H01..06；由 Codex审查后交给用户签署。
```

## WP6：V3-6 生产 Run

```text
前提：Codex 已明确 WP5 自动门槛通过，H01-H10/V3-5.1/CX-H01..06 submission 全部有效并绑定 WP5 build/run/hash，当前 Revision 5 Route B3 12页 registry、collector/verifier/final schema、Revision 5 amendment 和授权摘要已冻结；否则停止。

执行 WP6，权威文档为 11-wp6-v3-6-production-acceptance.md 和既有 v3-6-7-final-development-acceptance-plan.md。用单一 fresh production run 完成 12页 6+3+1+1+1、A01-A20、完整故障矩阵、四视口/Axe/键盘、隐私/cleanup/seal。H submission 只读引用，禁止修改。

只生成 sealed machine candidate/package、verification、manifest、PRD review、handoff；不要独立审查、宣布 V3 PASS、修改人类签署或 Git 提交。完成后停止交给 Codex。
```

WP7 不提供 ClaudeCode 实施提示词；按 `12-wp7-v3-7-final-acceptance.md` 由 Codex执行。
