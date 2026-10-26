# ClaudeCode CLI 持续 Goal：Navia V3 完成与可用化 v2

日期：2026-10-15。用途：作为后续 ClaudeCode CLI 持续 goal。当前实际入口已更新为 P0 Background Capture Relay v9；v1-v8 及历史 `06`、`08`、`17`、`18`、`19`、`20`、`21`、`22` 只用于追溯，不得覆盖本文件的当前事实。

```text
你在 /mnt/c/workspace/navia 工作。持续目标是按 Navia V3 权威 PRD、架构、阶段门禁和真实数据验收，完成当前 P0 后依次推进 P1-P9，直到 V3 达到可人工验收状态。完整 goal 不等于未来阶段已获代码授权；每次只实现一个已冻结、Fatal=0/Major=0 且用户明确批准的子阶段。

一、角色和硬边界

1. `navia-主干开发`：承担高 token 的跨目录源码追踪、实现、长测试矩阵、真实 Runtime/Chrome、故障注入、六视频/12 页 run、证据封包和 checkpoint；不得签署自己的独立 PASS。
2. `navia-审查`：等待 immutable candidate 后只读复算 diff、schema、fixture、原始 run、hash、seal、秘密和 cleanup；除指定 independent audit 外不得改实现。
3. Codex：维护 PRD/架构/计划权威，纠偏范围，抽查原始事实，决定子阶段出门；Claude 的总结和测试总数不能自动授予 PASS。
4. 用户：只负责高风险实施授权和最终人类体验签署。Agent 不得代签 H/CX 项。
5. 禁止 reset --hard、checkout --、clean、删除历史失败 run、覆盖用户差异、擅自 commit/push。工作树很脏，所有修改必须与当前授权范围一一对应。
6. 所有浏览器自动化必须显式 `--mute-audio`；测试不得播放声音。可见 Chrome/焦点操作前先在聊天通知。

二、启动时必读

- AGENTS.md
- docs/active/project/design/project-stage-workflow.md
- docs/active/project/01-prd.md
- docs/active/project/02-architecture.md
- docs/active/project/03-development-plan.md
- docs/active/project/04-acceptance-plan.md
- docs/active/project/stage-gates/v3-media-companion.md
- docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/00-README.md
- 同目录 01..05、09、12、13、14、15、16、20 与 HANDOFF_MANIFEST.md；06、08、17、18、19 仅作历史追溯
- 当前子阶段最新 development-plan、acceptance-plan、preimplementation-audit、checkpoint、test-results、PRD review 和 handoff。

启动后先输出：HEAD、范围内 dirty 状态、当前门禁、精确授权文本、准备修改的文件、禁止范围、验证命令和停止条件。若缺独立文档审查 Fatal=0/Major=0 或明确实施授权，只能修文档/fixture，禁止改产品代码。

三、当前唯一入口：P0 Background Capture Relay v9

已验证事实：visible muted Chrome 的真实 extension action 可达；Offscreen Document 的 Runtime WebSocket 请求未抵达 Runtime；同一浏览器 Background Service Worker 与 Windows ClientWebSocket 可连接。不得再把 CSP、Runtime 不可达、ticket 失效或 Headless action 当作已证根因。

冻结路线：Background 持有 Runtime WebSocket，Offscreen 只采集、降采样并通过 Chrome runtime.Port 发送 PCM；公共 Runtime API、30 秒 one-shot ticket、可信用户动作、SourceAuthority、Side Panel materialize ownership、隐私范围和用户步骤不变。

当前权威合同：
- contracts/v3_media_capture_internal_relay_v9.schema.json
- fixtures/v3-media-capture-internal-relay-v9-fixtures.json
- evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v9-contract.py
- evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v9-mutations.py
- 专项 architecture/development-plan/acceptance-plan/preimplementation-audit
- design/v3-p0-background-capture-relay-architecture.{json,html}

v1-v8 已作废，禁止实现。v9 固定：九类严格 JSON 消息；canonical Base64；raw <=49,152 bytes、encoded <=65,536 chars；Runtime in-flight=1；producer outstanding <=32 chunks/1,572,864 raw bytes；quiesce -> drain -> stopped -> Runtime stop/finalize；11 个精确源码 scope 的 semantic AST boundary set 推导 40 个 source code、20 个 relay target code 与 shared/rename/public-only 三类完备互斥映射；中央 registry；四递归 discovery roots + non-relay allowlist；RLY9-N01..N30；OM9-N01..N08；24+8+6+13 trace；五阶段 marker；七类 phase recovery；六类 handoff/product failure；startedAt+1,080,000ms 固定 expiry；Runtime 全局单 sink。sender 为五个 MessageSender 字段加 `runtime.getContexts(documentId)` 的唯一 Offscreen ExtensionContext；WXT manifest 固定 `minimum_chrome_version: "116"`。同步 staging copy/fsync/hash/length/WAV-shape 屏障必须先于 daemon worker；barrier 前 handler、barrier 后 transcript service 各自独占 cleanup。stage owner manifest 必须经 temp O_EXCL write/file fsync/atomic replace/parent-directory fsync 后发布 receipt；recover 只凭 authoritativeTaskId 定位，八类损坏 fail-closed。hard crash 后 existing recover composite callback 清 acquisition/ASR stage/unpublished product 并验证 active sink，四项残留全零才允许 fresh begin；`completed` frame 只通知 handoff。唯一 durable 产品终态为现有 SQLite ready/degraded；重启后据此 published，否则 abandoned+cleanup+fresh analysis。taskId/sourceIdentity 跨层一致，consent/transcript/product 三个 revision 域独立单调，只有 outline/workspace 共享 product revision/fence。

P0 R0-R7：
R0 合同：先保持 v9 verifier 50/50，并独立验证 Schema 放宽、旧 port、未知 FailureCode、第十消息、decoded length、noncanonical padding、sender context、manifest publish/八类损坏、staging/ownership/persistent terminal、source scope/boundary/registry/sibling/nested/imported-emitter 增删、三个 revision 域和所有 trace/case 任意字段变异均稳定结构化 exit 2；再实现 TypeScript/Python 内部合同、中央 registry/semantic AST scan、composite crash cleanup、30 relay negative tests 和 8 manifest negative tests。
R1 transport：实现 Background RuntimeCaptureTransport，单任务/单 socket/单 ticket；open -> start -> Runtime started -> ordered chunks -> stop/finalize，任何异常统一 abort。
R2 producer：Offscreen 只做 getUserMedia、AudioContext、downsample、PCM16、exact sender Port、Base64、单信用和有限队列；静态证明 Offscreen 网络调用为 0，不持有 ticket/Runtime URL/WebSocket。
R3 integration：Controller 是唯一 capture 编排者；Runtime started 后才启动 producer；正常停止 quiesce -> drain -> Offscreen stopped -> Runtime finalize -> cleanup；idle/error 都关闭 offscreen。
R4 回归：Runtime capture pytest、真实 Uvicorn WebSocket、CSP/sender/ticket/replay/sequence/length/backpressure/restart/cancel/SIGTERM/cleanup/secret；TestClient 不替代 Uvicorn。
R5 canary：仅离线全绿且条件改变后，固定 BV1pohR6rEEh 做一次 fresh visible muted Chrome；runner 只能执行用户可达动作与观察，不直调 controller/materialize/database，不伪造 grant/transcript/terminal。证明非空 PCM -> Runtime sink -> SenseVoice -> acquisition succeeded -> 产品 effect materialize -> ready|degraded；taskId/sourceIdentity 一致，各 revision 域单调且 product fence 一致，UI 停止 busy，secret/cleanup=0。
R6 故障：真实关闭 permission missing、ticket replay/binding、fake sender、Port disconnect、sequence/length、overflow、Runtime crash、WS loss、Service Worker restart、tab close/navigation、cancel、SIGTERM 和 cleanup failure；stub/summary 不算。
R7 封存：test-results、PRD review、false-green audit、handoff、structured verification、secret/cleanup receipts、candidate ID/hashes；主干停止，审查会话只读复算。Fatal=0/Major=0 才允许冻结 P1。

P0 的详细执行提示词是 14-claudecode-p0-relay-goal-prompt.md，独立审查提示词是 15-claudecode-p0-relay-review-prompt.md，当前重规划依据是 23-p0-relay-v9-replan-closure.md。若冲突，以更严格门禁和最新 v9 权威文档为准。

四、P1-P9 顺序和目标体验

P1 六视频 fresh run：固定 BV1pohR6rEEh、BV1hMpE6FEXG、BV1VHHe6kEH3、BV1SDHy6aEiB、BV1vSHD6tEsM、BV1FCps68EGf。每视频 fresh Runtime/database/profile/task，单任务单 Provider，静音；两个 blocked、跨 run、泄密、原始媒体公开命中、缺 seal 或 cleanup 不全立即 NO-GO。

P2 Stage B 收口：B-5-4 cleanup、B-5-5 无秘密 closure、B-5-6 implementation handoff、B-5-7 <=20 文件不可变外审包和独立实施出门。

P3 内容质量：B-6 宿主 LLM 独立检查事实、相关性、概括性、全片覆盖、章节平衡、claim-evidence、截图匹配和 seek；B-7 人类只判断内容价值、视觉层级和操作负担。schema PASS 不替代内容正确。

P4 Stage C 状态恢复：先冻结 MediaTaskActivityProjection 和 fixture，再实现 Runtime 权威状态、Side Panel 顶层状态卡、计时器、当前步骤、停滞说明、取消/重试、Workspace 同步、刷新/Runtime 重启恢复、revision fence。Runtime terminal 与 UI 一致率 100%，终态立即停止 busy。

P5 Stage D 内容工作台，分四次冻结与出门：D1 <=100 中文字符 brief、全片章节、claims/grounds；D2 真实帧图文大纲和视频秒数时间线，支持 wheel/drag/keyboard/seek；D3 concept/entity/claim/relation/evidence 概念关系图，支持拖动/缩放/布局保存；D4 至少五种 prompt-distinct 导出，支持范围/图片/密度、取消、重试和独立 artifact。

P6 V3-4.1 Chat/Know：ContextEnvelope -> KnowledgeDraft -> 显式确认 -> KnowledgeItem；Chat 实时反馈、新聊天/单删/全清、Provider 凭据持久；Know 查看/编辑/排序/归档/删除/来源反跳；取消 0 写入、重复确认幂等、冲突可见、重启一致、0 Mock success。V4 Query/Graph/Durable Forget 不纳入。

P7 Stage E 综合交互：同一 production build 覆盖六视频、普通网页、Chat/Know、Side Panel/Workspace 同 revision、四视口、键盘、滚动、Axe serious/critical=0、性能、恢复、cleanup，生成中文 HTML 候选报告。

P8 V3-6 单一 12 页 production run：保留 6+3+1+1+1 原分母，追加普通网页、Runtime 手动生命周期、Chat/Know 和五种导出；真实 OCR/VLM/ASR/截图/故障/资源/隐私/cleanup/seal，禁止跨 run 拼接。

P9 V3-7 收口：独立复算 V3-6；完成人类 H01..H10、B-7、CX-H01..CX-H06；同步 Draw.io/HTML 与实际代码；输出中文可视化报告和最小人工路径。Fatal=0/Major=0 且人工签署完成后才可限定声明 V3 PASS，再进行范围内 Git 提交与项目进展同步。

五、每阶段强制循环和证据

详细 development-plan -> acceptance-plan -> preimplementation-audit Fatal=0/Major=0 -> 用户明确授权 -> 实现 -> 自动/真实数据验收 -> PRD review -> cleanup/secret scan/handoff -> immutable candidate -> 独立审查。

每阶段必须落盘：输入基线和代码所有权；合同变化或 none；用户场景和操作；固定正负分母和 FailureCode；命令/退出码/build/run/task/provider 版本；真实数据来源；PRD 逐项映射；cleanup/secret/raw-media/path 扫描；candidate ID 与 payload hash；剩余风险和下一门禁。测试总数、mock、旧 run、截图文字或实施者自报均不能替代分支事实。

产品不变量：Chat/Know 是一级域，Agent 后置；Runtime 由用户手动启动的本机伴侣提供，扩展不静默拉进程；同一 sourceIdentity 只有一个 authority task/revision；UI 只渲染 Runtime projection；runner/renderer/Provider 不写成功状态或 KnowledgeItem；MiniMax 默认但首用不诱导供应商，DeepSeek 仅手动选择/研究；单任务锁定单 Provider；只允许经授权派生文本上云，原始视频/音频/帧/Cookie/API key/ticket/streamId/私有路径不得上传或进入公开证据。

六、错误、中断和恢复

429/529：立即停止重复请求，写 checkpoint，记录最后完整动作、changed files、命令/退出码、run/PID/端口/profile、cleanup 和 nextSafeAction；部分 run 不算 PASS，不得以后拼接。恢复后先做无私有数据 capability probe。

422：区分 Claude 工具输入和产品 Provider。工具输入缩短/修正；产品错误只保存脱敏 endpoint class/model/schema/request hash/status/error code，返回 adapter/合同修复；禁止原样重试或降低 schema。

任何失败先清理由本轮创建且可证明 ownership 的 Chrome/Runtime/profile/port/scratch/private media；不得终止非 owned 进程。条件未改变禁止重复真实 run。每完成 R/P 子阶段立即更新 checkpoint，不等最后补写。

七、每次报告格式与停止条件

只报告：状态；changed files；合同变化或 none；测试命令/退出码；真实 run；PRD 覆盖；Fatal/Major/Minor；evidence path；secret/cleanup；下一门禁；自动化开发停止原因。不得打印秘密、大段日志、Cookie/key 或私有绝对路径。

遇到文档不足、缺授权、真实验收失败、Fatal/Major、假绿风险、公共合同变更、两个 blocked、泄密、缺 seal 或 cleanup 不完整时，停止实现，说明最近事实、证据、根因、备选路线和所需用户决定。否则仅持续推进当前已授权且文档完整的子阶段，直到该子阶段独立出门；不得因本 goal 列出 P1-P9 就越权连续编码。
```
