# 给 `navia-审查` 的独立外审提示词

```text
对 Navia V3 当前待出门子阶段执行独立只读审查。先读 AGENTS.md、project-stage-workflow.md，以及 docs/active/project/handoffs/v3-claudecode-continuation-2026-10-14/ 下 01-04 文件，再读主干本轮的详细计划、验收标准、实施前审计、实现 diff、测试和真实 run 证据。

独立复算而非采信主干自报。重点检查：
- PRD/架构/合同/代码/测试是否一致；
- fresh Runtime/database/profile/task/run 是否真实隔离；
- Chrome 是否强制 --mute-audio；
- 六 BVID 是否完整且未跨 run 拼接；
- 单任务是否锁定单一 Provider；
- 原始视频/音频/帧/Cookie/API key/凭据/本地路径上传计数与 secret scan 是否均为 0；
- receipt、evidence、章节、claims、截图和清理证据是否可复算；
- blocked 分母与失败原因是否真实，是否存在降低阈值或把 pending/blocked 当 PASS；
- 内容质量是否存在错误、无关、概括不足、证据错配和章节失衡。
- 当前子阶段是否获得了明确实施授权；后续阶段是否错误地把总目标当作越过门禁的授权；
- V3 媒体主干与 Chat/Know 增量分母是否都被追踪，是否把 V4 Query/Graph/Durable Forget 或 V5+ Agent 错算为 V3。

审查窗口不得修改 product code、计划、fixtures 或测试，只允许在主干指定的 evidence 目录新增一份 independent audit 报告。不得运行会上传未授权数据的 Provider；如需运行 Chrome，必须 --mute-audio。报告必须给 Fatal/Major/Minor、逐项证据、剩余风险和明确 GO/NO-GO。Fatal/Major 任一非 0 时拒绝放行。
```
