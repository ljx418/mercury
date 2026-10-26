# ClaudeCode CLI Goal：WP0 R5 Fresh Visible Muted Canary

```text
你在 /mnt/c/workspace/navia 继续 Navia V3 completion / WP0 / R5。

当前门禁已经由 Codex 冻结为：R0-R4 PASS / R5 MAY START。当前只授权 R5；R6/R7 不授权。
你负责实现、真实 canary、自验证和实施 handoff；不得修改阶段目标、降低验收分母、承担独立
外审或自行宣布 R5 PASS。

一、必读与启动核验

1. /mnt/c/workspace/navia/AGENTS.md
2. docs/active/project/design/project-stage-workflow.md，重点 §2.1、§4.1、§5.1
3. docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
   wp0-r4-2026-10-17/60-codex-r4-checkpoint.md
4. 同目录 61-codex-r5-development-and-acceptance.md
5. 同目录 64-r5-asr-model-installation-ux.md
6. docs/active/project/handoffs/v3-claudecode-implementation-2026-10-15/
   05-wp0-relay-acceptance.md
7. docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/
   04-development-and-acceptance-plan.md 的 P0 v10/R5 段
8. 当前 v10 schema、fixture、baseline/mutation verifier、R1-R4 生产实现与最新测试。

先验证 R4 证据 manifest、baseline 50/50、mutations 15/15。报告 HEAD、范围内 dirty 状态、
计划修改文件、公共合同影响、R5 命令和停止条件。保护整个 dirty worktree；不得 reset、clean、
checkout、revert，不得删除历史失败证据，不得 commit/push。

二、先执行 R5-0 离线预检

严格按 61 文件检查 production build、Runtime、17861 端口和模型能力。必须通过产品 API 证明
funasr-sensevoice-small-q8 的 fixed revision、binary/model/VAD hash、installation=ready、
verified/self-test 通过并且 effective model 正是它。

禁止用 R4 deterministic/in-process provider、fixture transcript、bundled Tiny、历史 artifact
或旧 receipt 冒充 SenseVoice。若模型没有 ready：不要启动 Chrome，不要静默下载，不要自行
添加任意 URL；只报告产品 Settings 既有“下载并安装/导入离线包”路径、下载/磁盘/内存需求与
精确阻塞，状态写 R5 NO-GO 并停止。若安装需要网络或长时资源动作，先向用户说明并等待指示。

catalog 冻结的三个文件已下载到 Windows 暂存目录
C:\workspace\navia\.navia\downloads\funasr-sensevoice-small-q8，并已经 exact size/SHA-256、
产品受控离线导入和 self-test。最终模型位于
C:\workspace\navia\.navia\asr\models\funasr-sensevoice-small-q8；继续前仍须通过 Runtime API
重新证明 ready、verified、effective。不得把模型或缓存放入 WSL 虚拟磁盘或 Git。

同时按 64 文件完成安装 UX 的最小纠偏：主动作改为一次“下载、安装并使用”；ready/self-test
后自动选择并以 effectiveModelId 确认；披露 Windows 目录；分类展示网络/空间/hash/自检错误；
手动路径只接受三项冻结文件并由本机伴侣验证/组包；删除不存在的 Navia 发布包提示。只允许
内部 UI/编排调整，不改变公共 API、catalog、hash、来源白名单或安全边界。先补定向测试。

离线预检可运行受影响模块测试、typecheck、Runtime focused、build、relay static 与 v10
verifier；不要重复 R4 的 62-process 故障矩阵。

三、可见 Chrome 硬门禁

只有离线预检全绿后，先在聊天中通知用户：你将启动本轮 owned 的可见 Chrome，可能弹出站点
权限/tabCapture 原生窗口并短暂抢焦点；所有 Chrome 命令显式带 --mute-audio；结束会关闭
本轮实例。等待用户明确回复继续后才启动。不得用 headless 或 UIAutomation 绕过确认。

四、只执行一次 R5 fresh canary

固定 URL：https://www.bilibili.com/video/BV1pohR6rEEh

- 使用 fresh Runtime/database/private root、fresh Chrome profile、fresh task 和本轮 production
  extension build；产品端口固定 17861，启动前 bind preflight。
- runner 只能点击/输入/观察用户可达 UI。成功路径直接调用 Controller、materialize endpoint、
  database、store、grant/transcript/terminal 的次数必须为 0。
- 从扩展图标或 Side Panel 启动分析，按真实用户动作完成一次性站点/capture 授权。
- 证明 Background relay -> Offscreen 非空 PCM -> Runtime sink -> frozen SenseVoiceSmall Q8
  -> 非空带时间戳 transcript -> acquisition succeeded -> 产品 Side Panel materialize effect
  -> SQLite ready|degraded -> Side Panel/Workspace 退出 busy。
- Runtime started 前必须 0 chunk；随后 PCM bytes/chunks/duration >0，ACK/sequence/length 正确。
- taskId/sourceIdentity 跨层一致；consent/transcript/product revision 分别单调；outline/workspace
  product revision/fence 一致；acquisition succeeded 必须先于 materialize。
- 默认不调用任何云 Provider，不上传原始视频/音频/帧/Cookie/key/ticket/私有路径。无视觉
  Provider 时只接受冻结合同允许的明确 degraded，不得补造截图、静默切 Provider 或写 ready。
- 全程禁止播放声音；Chrome 必须 --mute-audio。只关闭本轮 owned Chrome/Runtime/PID/port/
  profile/scratch。canary 最多一次；条件未改变禁止重跑。

五、收口验证与证据

完成后集中运行一次：extension typecheck、media 子树、全量 unit（低并发可避免 ENOMEM）、
build、Runtime focused capture/transcript/outline/fault/product、relay static、v10 baseline 50/50、
mutations 15/15、secret/raw-media/private-path scan、owned cleanup scan。

创建：
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r5-2026-10-17/

包含 10-receipt.md、20-test-results.md、30-prd-review.md、40-handoff.md、
50-payload-manifest.sha256。记录 changed files、合同变化或 none、全部命令/退出码、build hash、
脱敏 Runtime/Chrome PID 与端口/profile owner、run/task/capture/model identity、真实 UI 步骤、
PCM/ASR/acquisition/materialize/product terminal、revision/fence、截图索引、secret/cleanup、
Fatal/Major/Minor、剩余风险和自动化开发停止原因。不得把 Cookie、API key、ticket、原始媒体、
transcript 全文或私有绝对路径写进公开证据。

六、停止条件

若模型未 ready、真实路径失败、出现声音、runner 越权、需要公共合同/固定分母/安全边界变化、
需要未授权云调用、secret/raw-media 泄露或 cleanup 不完整，写 R5 NO-GO 并停止；不要重复 canary。

若全部通过，最终状态写 R5 AWAITING CODEX CHECKPOINT 并停止。不得自行宣布 R5 PASS，不得
进入 R6，不发起独立文档外审或阶段 closeout。
```

