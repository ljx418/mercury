# ClaudeCode CLI 一键 Goal：WP0 R5-B

```text
你在 /mnt/c/workspace/navia 继续 Navia V3 WP0/P0 Background Capture Relay v10。

当前门禁由 Codex 判定为：R0-R4 PASS；R5-A USER-PATH PASS；R5-B RELAY POSITIVE
UNVERIFIED；P0 NO-GO。当前只授权 R5-B，不授权 R6/R7/P1。你负责实际实现和开发自验证；
Codex 负责 checkpoint、阶段验收和后续授权。不得自行宣布 R5/P0 PASS。

一、启动必读

1. AGENTS.md
2. docs/active/project/design/project-stage-workflow.md，特别是 §5.1 验收分层、防假绿和防重复返工
3. docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
   wp0-r5-checkpoint-2026-10-18/60-codex-r5-checkpoint.md
4. 同目录 61-codex-r5b-development-and-acceptance.md
5. docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
   wp0-r5-cookie-canary-2026-10-18/ 的 receipt/test-results/PRD-review/handoff/manifest
6. docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/
   02-target-architecture-and-ownership.md、04-development-and-acceptance-plan.md、
   05-execution-and-recovery-protocol.md、13-p0-background-capture-relay-document-freeze.md、
   14-claudecode-p0-relay-goal-prompt.md、16-claudecode-v3-completion-goal-v2.md
7. 当前 v10 schema/fixture/baseline/mutation verifier，R1-R4 最新实现与证据。

先输出 HEAD/branch、范围内 dirty 状态、前置门禁、计划修改文件、公共合同影响、R5B-01..12
映射、验证命令和停止条件。保护当前大量既有 dirty worktree 内容，不得
reset/clean/checkout/revert，不得覆盖历史失败证据，不得 commit/push。

二、固定输入与真实回退条件

只使用：
- URL https://www.bilibili.com/video/BV1Bb411w741
- BVID BV1Bb411w741
- CID/playbackUnitId 61744125
- part p1
- duration 258s
- 2026-10-18 authenticated subtitle count 0

Cookie 只使用已经由产品 Settings 保存到 OS credential store 的用户授权 B站 Cookie。不得读取、
打印或复制 Cookie 值。Runtime 使用 fresh database/task roots；SenseVoice 必须
ready/verified/effective。把 NAVIA_MEDIA_YT_DLP_PATH 指向本轮 owned 且确认不存在的路径，使产品
既有 build_media_downloader() 返回 None。这只是隔离环境中的真实 downloader unavailable 边界，
不是 route override；不得进入普通用户默认配置，不得新增测试 UI/API。

打开 Chrome 前，重新执行只读 metadata probe，确认 BVID/CID/p1/duration/subtitle count 未漂移；
执行 v10 50/50、15/15、typecheck、受影响 media、Runtime focused、relay static、production build，
并通过产品 API 证明 SenseVoice frozen revision/hash ready/verified/effective。runner 静态审计必须
证明对 recordMediaCaptureRouteFailure、Controller、grant、materialize、database/store 的直调为 0。
任一前置不符立即写 R5-B NO-GO 并停止。

三、单次真实 visible muted Chrome canary

启动可见 Chrome、原生权限、焦点或 UIAutomation 前，先在聊天中通知用户并等待继续。所有 Chrome
命令显式 --mute-audio，整个测试不得播放声音。使用 fresh owned profile、production unpacked build、
fresh owned Runtime/database/task。

只从真实页面内 Navia 入口点击分析。必须在同 task 观察以下精确 route trace：
1. credentialed_subtitle -> V3_MEDIA_SUBTITLE_UNAVAILABLE
2. credentialed_media_asr -> V3_MEDIA_RUNTIME_OFFLINE
3. public_or_page_subtitle -> V3_MEDIA_SUBTITLE_UNAVAILABLE

三路失败必须由 production route 自己观察/记录；runner 不得写失败记录。只有真实
TrustedTabCaptureCard 出现后才点击用户可见 capture 动作；不得注入 grant。通过真实 extension
action/command 启动，证明 Background 是唯一 Runtime WebSocket owner、Offscreen 网络调用 0、
Runtime started 早于首 chunk、PCM bytes/chunks 均 >0、captured duration >=15,000ms、
sequence/length/ACK 正确。达到 15,000ms 后点击用户可见“完成并转写”。

必须继续证明 frozen verified SenseVoice 产生非空带时间戳 transcript；acquisition succeeded 先于
产品 Side Panel effect materialize；最终 SQLite/UI ready|degraded；taskId/sourceIdentity 一致，三个
revision 域分别单调，product fence 一致，UI 退出 busy。视觉失败只能走冻结 degraded，不补造截图，
默认不调用云 Provider，不上传任何音视频/帧/文本。

公开证据 Cookie/API key/token/PCM/WAV/raw media/private path 0 命中；结束时
track/context/Port/WS/offscreen/sink/profile/runtime/port/scratch 全归零。只清理本轮 owned 资源，
不得触碰用户 Chrome。

四、验证预算与交付

实现内循环只跑受影响测试。正控后集中回归一次：typecheck、media 子树、全量 unit、build、Runtime
focused、relay static、v10 baseline 50/50、mutations 15/15、secret/cleanup scan。不要重复 R4 的
62-process 故障矩阵，不启动 R6，不发起 Claude 文档外审。

证据目录先确认不存在。默认：
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r5b-2026-10-18/
若已存在，使用带 UTC run ID 的新目录，禁止覆盖。必须交付：10-receipt.md、20-test-results.md、
30-prd-review.md、40-route-and-relay-oracle.json、50-handoff.md、60-payload-manifest.sha256。

最终报告列出状态、changed files、合同变化或 none、全部命令及退出码、真实
run/build/task/capture/model ID、R5B-01..12、Chrome/Provider/声音计数、secret/cleanup、
Fatal/Major/Minor、剩余风险和自动化开发停止原因。

全部满足时状态只能写 R5-B AWAITING CODEX CHECKPOINT 并停止。不宣布 R5/P0 PASS，不进入
R6/R7/P1。任一项失败写 R5-B NO-GO，保留证据并停止，不改输入、不缩分母、不重复碰运气。
```
