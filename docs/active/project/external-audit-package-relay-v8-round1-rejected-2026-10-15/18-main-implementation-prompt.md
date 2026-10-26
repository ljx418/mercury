# ClaudeCode CLI Goal：V3 P0 Background Capture Relay

将以下完整文本交给同工作目录的 `navia-主干开发`。它是持续 goal，不是跳过门禁的一次性编码指令。

```text
你在 /mnt/c/workspace/navia 工作。目标是关闭 Navia V3 Stage B B-5.3 P0 的真实 trusted tabCapture 阻塞，并在 P0 独立出门后严格按 P1-P9 继续；当前首先执行 P0 Background Capture Relay。不得重置、清理、checkout 或覆盖 dirty worktree，不得修改用户既有无关差异。

一、先读且按权威顺序执行

1. AGENTS.md
2. docs/active/project/design/project-stage-workflow.md
3. docs/active/project/01-prd.md §18.11
4. docs/active/project/02-architecture.md §22.15
5. docs/active/project/03-development-plan.md §19.1
6. docs/active/project/04-acceptance-plan.md §28
7. docs/active/project/stage-gates/v3-media-companion.md 最后的 P0 门禁补丁
8. docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/00-README.md、05-execution-and-recovery-protocol.md、08-goal-continuation-prompt.md、13-p0-background-capture-relay-document-freeze.md
9. docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-architecture-2026-10-15.md
10. 同目录 background-capture-relay-development-plan、acceptance-plan、preimplementation-audit
11. docs/active/project/design/v3-p0-background-capture-relay-architecture.html

先输出当前门禁、dirty worktree 保护、明确授权范围、计划修改文件和停止条件。若没有独立文档审查 Fatal=0/Major=0 与用户明确 `approved P0 Background Capture Relay R0-R7 implementation`，只做文档/fixture 纠偏并停止，不得编码。

二、P0 唯一路线

保持用户流程、30 秒 one-shot ticket、Runtime /v1/media/capture-stream、SourceAuthority、Side Panel materialize effect 和本地隐私边界不变。把 Runtime WebSocket ownership 从 Offscreen 移到 Background：

- MediaCaptureController 是唯一 capture 编排者。
- 新增 RuntimeCaptureTransport：单任务、单 socket、单 ticket；open -> start -> Runtime started -> ordered binary chunks -> stop/finalize，失败统一 abort。
- Offscreen 只执行 getUserMedia、AudioContext、downsample、PCM16 和内部 Port 发送，不得持有 ticket、Runtime URL 或 WebSocket。
- Port 名 `navia.mediaCapture.audio/v8`。只从 Chrome MessageSender 读取 id=runtime.id、URL=runtime.getURL(offscreen)、tab absent、frame absent/0、documentId 必有且首次绑定；MessageSender 没有 incognito。Background 再以 documentId 调用 runtime.getContexts，必须恰好返回一个 URL 匹配的 OFFSCREEN_DOCUMENT，其 ExtensionContext.incognito 与当前 extension context 一致。R0 同时在 WXT manifest 固定 `minimum_chrome_version: "116"`；不得为旧浏览器实现弱校验降级。
- 消息闭集：ready/chunk/quiesced/stopped/capture_error 与 start/chunk_credit/quiesce/abort；九类消息均按 internal relay v8 JSON Schema 拒绝多余字段。streamId 只允许在恰好一次 start 中，getUserMedia settle/abort 后释放，禁止进入 chunk/credit/log/storage/marker/evidence。
- sequence 从 0 严格递增；重复、跳号、倒序、长度错误拒绝。
- Chrome Port 仅支持 JSON serialization；不得使用 transferable ArrayBuffer。PCM 固定 s16le/16 kHz/mono，使用 Base64 JSON；raw chunk <=49,152 bytes，encoded <=65,536 chars。
- 信用窗口和 Runtime in-flight 均为 1；producer 用 local queued + credit consumed 计数，<=32 chunks / 1,572,864 raw bytes；同一 chunk 在 local_queued 与 credit_consumed/runtime_inflight 中恰居其一。下一 enqueue 将超限时先 abort，禁止静默丢帧或无限缓存。
- timeout 固定为 Port connect 5 秒、Runtime start 10 秒、chunk ACK 10 秒、cleanup 10 秒、finalize 120 秒；不得扩大 Runtime 既有 900 秒/512 MiB capture 限制。
- Runtime started 前 0 chunk。正常完成必须 quiesce 新音频产生 -> 单信用 drain 既有队列 -> Offscreen stopped -> Runtime finalize；Runtime stop 发出后 0 chunk。
- Port/WS disconnect、worker restart、tab close/navigation、permission revoke、Runtime crash、用户取消、SIGTERM、cleanup failure 均中止；不持久化 PCM/ticket，不续传旧 session。
- Service Worker 重启识别只允许 `chrome.storage.session` + `TRUSTED_CONTEXTS` 六字段 v8 tombstone；expiry 固定为 startedAt+1,080,000ms且 phase 更新不续期。禁止写入 ticket/grantId/streamId/PCM/sourceIdentity/path/Cookie/API key。capture handoff 必须按 sink finalize -> transcript create -> 同步 `TaskAudioStager.stage(copy/fsync/hash/length/WAV-shape)` -> worker start 执行。stage receipt 前 handler 独占 cleanup，receipt 后 transcript service 独占 cleanup；`completed` frame 只通知 handoff，不代表产品成功。唯一 durable 产品终态是现有 SQLite `MediaTaskStore.commit_terminal(ready|degraded)`。
- 恢复 owner 必须逐 phase/ownership 实现：connecting-before-start 用既有已认证 DELETE+GET；valid-start/runtime-alive 由唯一 artifact owner 清理；graceful/hard crash 调用既有 recover；只有持久产品终态存在才 published，否则 abandoned+cleanup+fresh analysis；GET 404 停止轮询并显示 recovery pending；marker expiry 只清 marker。recover 只验真实存在的 HTTP/disposition/authoritativeTaskId/product-terminal/fresh-begin 观察面。新 worker 不写旧 task。36 个现行 source code、20 个 relay target code 与 shared/rename/public-only 三类必须完备互斥；建立中央 registry 并以 AST/source scan 验证 emit sites 精确相等；既有公共 Runtime/UI code 不变。taskId/sourceIdentity 跨层一致，consent/transcript/product 三个 revision 域各自单调，只有 outline/workspace 共享 product revision/fence。
- CSP 只能保留确切 loopback；不得把 CSP 宣称为既有故障根因，除非新证据证明。

三、R0-R7 执行顺序

R0：先运行 `verify-stage-b-b5-3-background-capture-relay-v8-contract.py`，保持 39/39，并单独执行 Schema 放宽、旧 port 回退、未知 FailureCode、第十消息、decoded length、padding、stage barrier、ownership、SQLite terminal、source hash/inventory/mapping、三个 revision 域与全 trace 变异；再按 v8 schema/fixture 实现内部 TypeScript schema/types、完整 FailureCode registry/AST scan、RLY8-N01..N30、24+8+6 trace、七类 recovery case 和六类 handoff/product failure case。v1-v7 不得实现。若需公共 API/schema 变化，停止回文档。

R1：实现 Background RuntimeCaptureTransport 和完整状态机测试。

R2：把 Offscreen 改成纯 PCM producer，加入 exact Port、Base64 JSON、单信用/背压/stop；静态断言 Offscreen 网络调用为 0。

R3：Controller/router/client 集成；先 Runtime started 后 producer start；停止顺序 quiesce producer -> drain -> Offscreen stopped -> Runtime finalize -> cleanup；所有 idle/error 关闭 offscreen。

R4：运行 Runtime capture pytest、真实 Uvicorn WS integration、CSP/sender/ticket/replay/cleanup/secret 回归；在 finalize、transcript create/start、coordinator complete 四个注入点证明 task failed、typed code 和 cleanup 0，在 completed frame send 注入点证明 task 仍 succeeded 且 GET 可恢复；覆盖 connecting、graceful/hard crash、GET 404/marker expiry owner。TestClient 不能替代真实 Uvicorn。

R5：只有离线全绿且条件改变后执行固定 BV1pohR6rEEh 的一次 fresh visible Chrome canary。运行前先在聊天通知会显示窗口/抢焦点；Chrome 必须 `--mute-audio`，不得播放声音。runner 只做用户可达动作与观察，不直调 controller/materialize/database，不伪造 grant/transcript/terminal。必须证明真实非空 PCM -> Runtime sink -> SenseVoice -> acquisition succeeded -> 产品 effect materialize -> ready|degraded；taskId/sourceIdentity 一致，各 revision 域单调且 product fence 一致，UI 停止 busy，secret/cleanup 0。

R6：真实关闭 permission missing、ticket replay/binding、fake sender、Port disconnect、sequence/length、backpressure、Runtime crash、WS loss、Service Worker restart、tab close/navigation、cancel、SIGTERM、cleanup failure。纯 stub/summary 不算。

R7：落盘 test-results、PRD review、false-green audit、handoff、structured verification、secret/cleanup receipts，封存 immutable candidate ID 和 hashes。主干停止实现，交 `navia-审查` 只读复算。Fatal=0/Major=0 才允许 P1 六视频。

四、硬性禁止

- 不延长 ticket，不绕过 trusted user action，不新增权限/Origin wildcard。
- 不让 runner、UI、renderer、Provider 写成功状态或 KnowledgeItem。
- 不上传原始视频、音频、帧、Cookie、API key、ticket、streamId 或私有路径。
- 不跨 run 拼接，不用旧失败 run，不用 mock PCM、空包或测试总数冒充真实链路。
- P0 未出门不得启动六视频；P1-P9 列在总 goal 中不等于已经授权编码。
- 所有自动化浏览器强制 `--mute-audio`；没有例外。

五、token 与错误恢复

优先由本 Claude 主干承担高 token 工作：跨目录调用链、长 diff、Node/Python 矩阵、真实 Chrome/Runtime、故障注入、长日志、evidence/seal/package。每完成 R0..R7 任一阶段立即更新 checkpoint，不要等最后一起写。

429/529：立即停止重复请求，写 checkpoint，记录最后完整动作、changed files、命令与退出码、run/PID/端口、cleanup、未完成项和 nextSafeAction；不得把中断记 PASS，不得拼接部分 run。恢复后先做无私有数据 capability probe，再从 checkpoint 继续。

422：先区分 Claude 工具输入错误和产品 Provider 错误；工具输入缩小/修正，产品错误只保存脱敏 request hash/schema/version/fixed error code，返回 adapter/合同修复；禁止原样重试。

任何运行失败先清理本轮 owned Chrome/Runtime/profile/port/scratch/private media，再诊断。条件未改变禁止重复真实 run。

六、每阶段报告

只报告：状态；changed files；合同变化或 none；测试命令/退出码；真实 run；PRD 覆盖；Fatal/Major/Minor；evidence path；secret/cleanup；下一门禁；自动化开发停止原因。不得打印秘密、大段日志或私有绝对路径。

P0 独立出门后，回到 08-goal-continuation-prompt.md 严格执行 P1 -> P9；每个阶段仍须详细计划、验收计划、preaudit、明确授权、真实数据验收、PRD review、immutable candidate 和独立审查，不能一次性越权。
```

