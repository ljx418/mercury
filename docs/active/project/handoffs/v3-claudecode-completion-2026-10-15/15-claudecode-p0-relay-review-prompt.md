# ClaudeCode CLI 独立审查提示词：P0 Background Capture Relay

```text
你是 /mnt/c/workspace/navia 的独立只读 reviewer。不要修改产品代码、测试、既有证据或 candidate；只允许落盘独立审查报告。先读 AGENTS.md、项目工作流、PRD §18.11、架构 §22.15、验收 §28、Stage Gate 补丁、handoff 13，以及四份 stage-b-b5-3-background-capture-relay 文档。

若当前仅为文档候选：审查 PRD、架构所有权、用户动作、30 秒 ticket、Chrome JSON Port、九类消息 Schema、Base64、credit/ownership、quiesce/drain、MessageSender/ExtensionContext 来源、Chrome 116/getContexts 版本边界、streamId、marker、handoff、phase recovery owner、内部/公开 FailureCode 边界、单 sink与隐私。重点反证 v8 第二轮两个 Major是否真的关闭：`TaskAudioStager.stage()` 的 copy/fsync/hash/length/WAV-shape 与 owner manifest temp O_EXCL write/file fsync/atomic replace/parent-directory fsync/receipt 必须在 daemon worker 前同步完成；recover 只凭 authoritativeTaskId 确定性发现 manifest，八类缺失/损坏全部 fail-closed；after-stage hard crash 必须由 existing recover composite cleanup 清 acquisition/ASR/product 并验证 active sink，四项全零后才 fresh begin；frame send 只能通知 handoff；唯一 durable 产品成功必须来自 SQLite ready/degraded；11 个精确 scope 的 semantic AST boundary set、40 source、中央 registry 与 frozen inventory 必须相等，四个递归 discovery roots 的 universe 必须等于 inventory + non-relay allowlist。任何旧 Chrome 弱 sender 校验、sink finalize/进程内 succeeded 即 durable、GET 404 无限轮询、双 cleanup owner、跨域 revision 强制相等或 worker 写旧 task 均为阻断项。独立运行 v9 verifier，要求 50/50，并亲自执行 Schema-only 放宽、旧 port、manifest publish/损坏、stage/ownership/SQLite terminal、source scope/boundary/registry/sibling/nested/imported-emitter 增删、handoff case 删除和 revision 域变异，确认全部结构化 exit 2；逐字段检查 24+8+6+13 步 trace、八类 manifest failure、七类 recovery case、六类 handoff/product case、RLY9-N01..N30 与 OM9-N01..N08。确认未新增公共 API。独立复算 Archify hash/validation。输出 Fatal/Major/Minor 和 `DOCUMENT PASS` 或 `REPLAN`；不得授权代码。

若存在 immutable implementation candidate：另行逐文件复算源码清单、tests、真实 Uvicorn、visible muted Chrome、真实非空 PCM、same taskId/sourceIdentity、各 revision 域单调与 product fence、SenseVoice/acquisition/materialize terminal、故障矩阵、secret/raw-media/path 0、cleanup 0、runner purity 和 candidate seal。不得只抽 summary，不得把测试数量视为功能事实。任何 Chrome 证据必须证明 `--mute-audio`。

明确拒绝：Offscreen 仍直接连 Runtime；transferable ArrayBuffer；ticket 延长；runner 直调 controller/materialize/database；mock/空 PCM；跨 run；Runtime started 前 chunk；stop 后 chunk；无限 queue；worker restart 续传旧 ticket/PCM；worker 无依据宣称 sink=0；cleanup failure 仍 success；秘密/原始媒体进入公开证据。

报告落盘到当前 evidence 目录的独立文件，并列出审查入口、输入 hashes、复算命令、分母、发现、限制和门禁原话。实现候选只有 Fatal=0/Major=0 才可建议 P1；文档候选通过仍只表示可请求用户实施授权。
```

