# Stage B B-5.3 P0 Background Capture Relay v8 架构冻结候选

日期：2026-10-15。状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`。本文件是 P0 可信捕获的增量架构，不废弃 V3-2、V3-5 或 B-5 既有计划，不授权 P1 六视频。

## 1. 决策摘要

真实静音 canary 已证明：同一 Chrome 的 Background Service Worker 可以打开本机 Runtime WebSocket，Windows 也可直接连接；Offscreen Document 的 WebSocket 请求没有抵达 Runtime。继续在 Offscreen 内调整超时、票据或重试不能消除这个上下文差异。

采用限定路线 A：

```text
Side Panel arm
  -> Background MediaCaptureController
  -> Background RuntimeCaptureTransport 打开 Runtime WebSocket
  -> Offscreen 只执行 tab audio capture + downsample
  -> 受信 chrome.runtime.Port 传有序 PCM chunk
  -> Background 写入 Runtime WebSocket
  -> Runtime 私有 sink -> SenseVoice -> acquisition terminal
  -> Side Panel 唯一 materialize effect -> ready|degraded
```

用户动作、30 秒一次性 ticket、Runtime WebSocket endpoint、source authority、ASR、materialize 和隐私边界保持不变。变化只发生在扩展内部：WebSocket ownership 从 Offscreen 移到 Background。

## 2. 已验证事实与推断边界

已验证：

- visible Chrome 使用 `--mute-audio`，可完成真实 extension action、capture arm 和 action count 增量。
- Background Service Worker probe 能连接 `ws://127.0.0.1:17861`。
- Windows `.NET ClientWebSocket` 能连接同一 Uvicorn endpoint。
- Offscreen 返回 `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED`；Runtime 的脱敏 Origin 拒绝日志为空，请求未到 Runtime。
- 离线 P0 Node suite 138/138、Runtime capture pytest 13/13、typecheck/build 均通过候选验证。

尚未验证：Background 中继真实 PCM 后能否完成 Runtime sink、SenseVoice、acquisition terminal 和 materialize。故 P0 仍 NO-GO。

## 3. 代码实体与职责

| 实体 | 所在层 | 状态 | 冻结职责 |
|---|---|---|---|
| `MediaCaptureController` | Background | 需修改 | 唯一 capture 编排者；校验 arm/binding；先建 transport，再启 Offscreen；统一 stop/abort/cleanup |
| `RuntimeCaptureTransport` | Background capture module | 待新增 | 唯一 Runtime WS owner；消费 ticket；等待 `started`；有序写 chunk；terminal/abort |
| `MediaCaptureMessageRouter` | Background | 需修改 | 区分 Side Panel command 与 Offscreen Port；精确验证 sender ID/URL/frame/tab |
| `media-capture-offscreen` | Offscreen | 需修改 | 仅 `getUserMedia`、AudioContext、downsample、PCM16 编码和 Port 发送；不得持有 ticket/Runtime URL |
| `CaptureAudioPort` | Extension internal | 待新增 | JSON 消息；一次性 `start(streamId)` 控制面；Base64 PCM 数据面；单信用窗口、严格 sequence/length 与有界缓冲 |
| Runtime `/v1/media/capture-stream` | Local Runtime | 保持 | ticket/binding 校验、私有 WAV sink、SenseVoice、typed terminal |
| `SourceAuthority` | Runtime | 保持 | sourceIdentity 对应唯一 taskId/revision；所有投影同权威 |
| Side Panel materialize effect | UI | 保持 | acquisition 成功后的唯一产品 materialize 编排者 |
| `CleanupBarrier` | Background + Runtime | 补强 | Port/WS/track/context/offscreen/ticket/sink 一并清理；失败不能发布成功 |

## 4. 内部合同

### 4.1 Port 身份

- 名称固定为 `navia.mediaCapture.audio/v8`；v1-v7 不得实现。v7 宽口径审查通过，但严格复核发现“进程内 acquisition succeeded”被误写为 durable、异步转写在 staging 前即可返回导致 cleanup 竞态，以及现行源码错误码 inventory 漏项，故已归档 rejected。
- 只接受当前扩展 ID、精确 Offscreen URL、无外部 tab 的 sender。
- 任何 content script、Side Panel、网页或其他 extension sender 均拒绝。
- Port 不传 Cookie、API key、ticket、Runtime URL 或私有路径。`streamId` 仅允许出现在 Background 发给 Offscreen 的一次性 `start` 控制消息中，`getUserMedia` settle/abort 后立即释放；不得进入 chunk、ACK、日志、storage、墓碑或公开证据。
- `MessageSender` 只提供五项可直接验证值：`id === runtime.id`、`url === runtime.getURL(offscreen)`、`tab` 缺失、`frameId` 缺失或 0、`documentId` 存在且非空。Background 再以该 `documentId` 调用 `chrome.runtime.getContexts`，必须恰好得到一个 `contextType=OFFSCREEN_DOCUMENT`、同 URL 的 `ExtensionContext`，并要求 `context.incognito === chrome.extension.inIncognitoContext`。首次 Port 绑定 documentId，活跃捕获期间替换 document 的重连必须拒绝；不信任消息 payload 自报。`MessageSender` 本身没有 `incognito` 字段。
- `chrome.runtime.getContexts` 从 Chrome 116 起可用，因此 V3 P0 把 Chrome 116 冻结为最低版本，并在 WXT manifest 输出 `minimum_chrome_version: "116"`。不支持该能力的浏览器不得安装/更新此候选，也不得退化为只看 sender URL 或信任 payload 的弱校验。

### 4.2 消息闭集

```text
offscreen -> background: ready | chunk(sequence, rawByteLength, pcmBase64) | quiesced(queue) | stopped | capture_error(code)
background -> offscreen: start(streamId, audioConfig) | chunk_credit(sequence, credit=1) | quiesce(reason) | abort(code)
```

Chrome extension messaging 使用 JSON serialization，`Port.postMessage` 没有 transfer list，因此 v1 transferable 被拒绝；v2 因 stop/drain 不可达被拒绝；v3 因消息/trace/restart verifier 假绿被拒绝；v4 因读取不存在的 `MessageSender.incognito` 与未定义 restart task terminal owner 被拒绝；v5 因 Schema/terminal/recovery/code 边界被拒绝；v6 因成功提交/通知事务、recover 观察面、code inventory、权威链接与 revision 域被拒绝；v7 因持久性假设与 staging 所有权竞态被拒绝。v8 固定严格 canonical `pcmBase64`，解码后为 PCM16LE/16 kHz/mono；九类消息均由 JSON Schema 定义 discriminant、必填字段、范围、闭集 FailureCode 与 `additionalProperties:false`，verifier 同时冻结 Schema 和 protocol 全对象 digest，再校验解码长度、padding 与全量 trace。

技术依据：[Chrome Extension message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#serialization) 明确采用 JSON serialization；[Chrome MessageSender](https://developer.chrome.com/docs/extensions/reference/api/runtime/#type-MessageSender) 不含 `incognito`；同页 `ExtensionContext` 才含 `incognito`；[chrome.storage session](https://developer.chrome.com/docs/extensions/reference/api/storage#property-session) 为内存态并默认不暴露给 content scripts，v8 仍显式固定 `TRUSTED_CONTEXTS`。

### 4.3 背压

- 原始 chunk 最大 49,152 bytes，对应 Base64 最多 65,536 字符；Background 对 Runtime 同时只允许 1 个未确认 chunk。
- 信用窗口固定为 1：只有 Runtime `chunkAccepted` 后 Background 才归还下一信用。每个 chunk 在 `local_queued`、`credit_consumed/runtime_inflight` 两种所有权中恰居其一；Offscreen 用 `local queued + credit consumed` 计总 outstanding，最多 32 chunks / 1,572,864 raw bytes，不能把同一 chunk 重复计数。Port 不可观测排队最多 1 条，Background 不另建队列。
- 音频持续产生而信用耗尽时，Offscreen 只能放入上述有界本地队列；下一次 enqueue 将导致 `>32` 或 `>1,572,864` 时，在入队前停止 track/context、发送 capture_error 并 abort，不能丢帧后继续，也不能无限增长。
- Port connect 5 秒、Runtime started 10 秒、chunk ACK 10 秒、cleanup 10 秒、finalize 120 秒；总采集仍为 900 秒/512 MiB 上限。

### 4.4 状态机

```text
idle -> connecting -> runtime_started -> capturing -> draining -> cleanup_pending -> finalized
  \        \             \              \          \                 -> aborted
   -----------------------------------------------------------------> failed
```

只有收到 Runtime `started` 后才允许 Offscreen 发送 chunk。正常结束必须依次执行：Background 发 `quiesce`；Offscreen 立即停止新音频产生并回 `quiesced`；既有队列继续在单信用下 drain；队列与 credit consumed 均为 0 后 Offscreen 回 `stopped`；Background 才向 Runtime 发 stop/finalize。禁止 chunk 的边界是 `runtime_stop_sent`，不是 `quiesce`。只有 Runtime terminal receipt、Offscreen stopped 和 cleanup 全绿后才返回 capture success。

## 5. 取消、终态、重启与故障语义

- 用户取消、页签关闭、导航改变、权限撤销：停止 track/context，关闭 Port，向 Runtime abort，关闭 WS 和 Offscreen。
- Offscreen Port disconnect：Background 立即 abort；不能等待 UI 轮询修复。
- Runtime WS loss/Runtime crash：停止本地 capture，返回 typed failure，不保留可恢复的活跃 ticket。
- Service Worker 重启：不持久化 PCM、ticket、grantId、streamId 或可续传 session。Background 在连接 Runtime 前向 `chrome.storage.session`（`TRUSTED_CONTEXTS`）写 v8 非秘密恢复标记：schemaVersion、192-bit 随机 captureSessionId、taskId、startedAt、phase、expiresAt。五个 phase 各有同 identity/time 的实例 fixture；expiresAt 固定为 startedAt+1,080,000 ms，phase 更新不刷新期限。
- capture stream 只负责把原始音频安全交给转写生命周期，不产生产品成功终态。顺序固定为 sink finalize -> transcript create -> **同步** `TaskAudioStager.stage()`；该屏障必须完成私有复制、fsync、SHA-256、byte length 与 WAV shape 一致性验证，发布内存 ownership receipt 后才允许启动异步 worker。屏障前由 Runtime handler 独占 acquisition sandbox 清理权；屏障后由 transcript service 独占 staged audio 与 acquisition sandbox，handler 禁止再 cleanup。`completed` frame 只是最佳努力的 handoff 通知，不能表示产品成功。
- 唯一 durable 产品终态是现有 SQLite `MediaTaskStore.commit_terminal(ready|degraded)`。若 Runtime 在该提交前重启，现有 recover 必须返回 `abandoned`、清理私有原件并要求 fresh analysis；提交后才允许返回 `published`。不得新增第二套 acquisition 数据库，也不得把进程内 coordinator `succeeded` 扩大为跨重启持久成功。
- Runtime 存活且已接受合法 start：WebSocket handler 的任何退出都进入 `finally` 幂等 abort sink；只有 task 仍非终态时才调用内部 fail。意外断线映射 `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED`，finalize/transcript/complete 映射 `V3_MEDIA_CAPTURE_FINALIZE_FAILED`，cleanup failure 映射内部 `V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE`。`fail_capture_stream` 对已终态任务原样返回且不改写 terminalAt/failureCode，非终态只转换一次。
- marker=`connecting` 且 Runtime 尚未接受 start：新 worker 只能调用既有、已认证的 `DELETE /v1/media/acquisitions/{taskId}`，再用既有 GET 观察 cancelled terminal；不得新增 API。其余 Runtime-alive phase 由 Runtime finally 终结，新 worker只 GET。
- Runtime graceful SIGTERM 或 hard crash/restart：进程内 finally 不被假定可运行。产品重新附着时使用现有 `POST /v1/media/acquisitions/recover` 和当前页面 sourceIdentity；公开可观察证据仅为 HTTP 成功、`disposition=published|abandoned`、authoritativeTaskId 与 marker 一致、`published` 对应 SQLite ready/degraded 终态，或 `abandoned` 对应未发布清理，及随后 fresh begin 成功。现有 recover 内部只有 sandbox residualCount=0 才返回成功，否则公开 `V3_MEDIA_CLEANUP_INCOMPLETE`；不虚构响应中的 cleanup receipt。GET 404 必须停止轮询并显示 recovery pending，不能无限等待或宣称成功；marker 过期只清非秘密标记，不删除持久 authority、不把任务标成功。
- 浏览器关闭：所有 extension 上下文终止，Runtime sink 由 socket close/timeout 清理。
- cleanup 任一失败：不得发布 `succeeded`；保留脱敏 cleanup receipt。

“重启恢复”不是继续传输旧音频，而是按 marker phase 分派到既有 DELETE、Runtime finally/GET 或既有 recover，恢复旧 task 的可解释终态、等待清理宽限，并允许用户创建全新一次性 grant 重试。Runtime sink 是否归零是跨进程验收事实，不由墓碑或新 worker 自证。

v8 冻结 capture/grant/sink/controller/recovery 边界的 36 个现行 source code 和 20 个 relay target code。每个 source code 必须恰好属于 identity-shared、rename mapping 或 public-only 三类之一；R0 必须建立 `captureRelaySourceFailureCodes` 中央注册表，并用 AST/source scan 证明所有 emit site、注册表与冻结 inventory 精确相等。四个既有 relay code 纳入 identity-shared；`V3_MEDIA_CROSS_TASK_REUSE -> V3_MEDIA_CAPTURE_BINDING_MISMATCH`、`V3_MEDIA_TEMP_FILE_MODE_INVALID -> V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID` 显式归一化。公共响应码、HTTP/WS 状态与恢复动作保持原合同。

## 6. 安全与隐私

- Runtime 只绑定 loopback；extension CSP 只允许确切本机 HTTP/WS origin，不开放 wildcard。
- 原始音频不上传云端、不进入 public evidence、不进入日志；Runtime 私有 task staging 仅服务本地 ASR并受 cleanup barrier 管理。
- 日志只记录 task hash、固定 FailureCode、sequence count、byte count、状态和脱敏 endpoint 类别。
- 公开 tar、审计包、Trace 必须扫描 Cookie、ticket、streamId、PCM、WAV、私有路径和 API key，命中数均为 0。

## 7. 用户体验影响

没有新增用户步骤。无字幕回退仍表现为：用户点击“捕获当前标签页”并完成浏览器要求的可信扩展动作，随后 UI 显示真实阶段、计时和停止按钮。内部中继不出现在产品界面。

正向影响：避免 Offscreen 网络上下文差异导致“已确认但一直断连”。负向风险：Background 重启会中断本轮捕获，因此必须显示精确重试动作，不能伪装自动续传。

## 8. 非目标与禁止项

- 不延长 30 秒 ticket；不把 ticket 改成 bearer；不新增公共媒体 API/schema。
- 不让 runner 直接调用 controller、materialize、数据库或写成功状态。
- 不上传原始音视频、transcript 或 OCR 给云端视觉 Provider。
- 不启动 P1 六视频；不把单视频 canary 扩大为 V3 PASS。
- 不把 sink finalize 当作 protocol terminal；不让 GET 404 无限轮询；不假定 Runtime hard crash 会执行 finally。
- 不以 mock WebSocket、TestClient 或测试总数替代真实 Chrome + Uvicorn。

## 9. 可视化

- 机器源：`docs/active/project/design/v3-p0-background-capture-relay-architecture.json`
- HTML：`docs/active/project/design/v3-p0-background-capture-relay-architecture.html`

内部机器合同：`docs/active/project/contracts/v3_media_capture_internal_relay_v8.schema.json`；24 步正例、8 步重启恢复链、6 步 handoff 失败链和 30 负例：`docs/active/project/fixtures/v3-media-capture-internal-relay-v8-fixtures.json`；机器复核：`verify-stage-b-b5-3-background-capture-relay-v8-contract.py`（39/39）。

## 10. 决策

架构方向：`READY FOR DOCUMENT AUDIT`。代码实施：`NO-GO`，直至开发计划、验收计划、fixture/error 闭集和独立文档审查完成，并获得明确实施授权。

