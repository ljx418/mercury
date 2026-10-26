# Stage B B-5.3 P0 Background Capture Relay 架构冻结候选

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

- 名称固定为 `navia.mediaCapture.audio/v5`；v1-v4 不得实现。v4 因 sender 来源与 restart terminal 所有权不可实现而被独立审查拒绝。
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

Chrome extension messaging 使用 JSON serialization，`Port.postMessage` 没有 transfer list，因此 v1 transferable 被拒绝；v2 因 stop/drain 不可达被拒绝；v3 因消息/trace/restart verifier 假绿被拒绝；v4 因读取不存在的 `MessageSender.incognito` 与未定义 restart task terminal owner 被拒绝。v5 固定严格 canonical `pcmBase64`，解码后为 PCM16LE/16 kHz/mono；九类消息均由 JSON Schema 定义 discriminant、必填字段、范围、闭集 FailureCode 与 `additionalProperties:false`，语义 verifier 再校验解码长度、padding 与全量 trace。

技术依据：[Chrome Extension message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#serialization) 明确采用 JSON serialization；[Chrome MessageSender](https://developer.chrome.com/docs/extensions/reference/api/runtime/#type-MessageSender) 不含 `incognito`；同页 `ExtensionContext` 才含 `incognito`；[chrome.storage session](https://developer.chrome.com/docs/extensions/reference/api/storage#property-session) 为内存态并默认不暴露给 content scripts，v5 仍显式固定 `TRUSTED_CONTEXTS`。

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

## 5. 取消、重启与故障语义

- 用户取消、页签关闭、导航改变、权限撤销：停止 track/context，关闭 Port，向 Runtime abort，关闭 WS 和 Offscreen。
- Offscreen Port disconnect：Background 立即 abort；不能等待 UI 轮询修复。
- Runtime WS loss/Runtime crash：停止本地 capture，返回 typed failure，不保留可恢复的活跃 ticket。
- Service Worker 重启：不持久化 PCM、ticket、grantId、streamId 或可续传 session。Background 在连接 Runtime 前向 `chrome.storage.session`（`TRUSTED_CONTEXTS`）写 v5 非秘密恢复标记：schemaVersion、192-bit 随机 captureSessionId、taskId、startedAt、phase、expiresAt。五个 phase 各有同 identity/time 的实例 fixture；expiresAt 固定为 startedAt+1,080,000 ms，phase 更新不刷新期限。
- 旧任务终结由 Runtime 所有：WebSocket 在合法 start 后、terminal 前发生意外断线时，`finally` 先 `RuntimeCaptureSink.abort()` 并要求 activeCaptureCount/residualRawAudioCount/privateTempAudioCount 三项为 0，再用 start 中已验证的 taskId 调用进程内 `MediaAcquisitionCoordinator.fail_capture_stream(taskId, V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED)`。该调用不新增 HTTP/WS 公共接口，必须幂等；已终态返回原任务，cleanup 失败由 `V3_MEDIA_CLEANUP_INCOMPLETE` 覆盖。新 worker 只读 marker，并通过既有 `GET /v1/media/acquisitions/{taskId}` 轮询到 terminal，等待 10 秒 cleanup grace 后清 marker；它不得写任务、恢复旧 sequence/session 或自证 sink=0。`V3_MEDIA_CAPTURE_WORKER_RESTARTED` 只作为本地重启诊断，不冒充 Runtime 权威 task failureCode。
- 浏览器关闭：所有 extension 上下文终止，Runtime sink 由 socket close/timeout 清理。
- cleanup 任一失败：不得发布 `succeeded`；保留脱敏 cleanup receipt。

“重启恢复”不是继续传输旧音频，而是借助非秘密 tombstone 恢复旧 task 的可解释失败状态、等待清理宽限，并允许用户创建全新一次性 grant 重试。Runtime sink 是否归零是跨进程验收事实，不由墓碑或新 worker 自证。

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
- 不以 mock WebSocket、TestClient 或测试总数替代真实 Chrome + Uvicorn。

## 9. 可视化

- 机器源：`docs/active/project/design/v3-p0-background-capture-relay-architecture.json`
- HTML：`docs/active/project/design/v3-p0-background-capture-relay-architecture.html`

内部机器合同：`docs/active/project/contracts/v3_media_capture_internal_relay_v5.schema.json`；24 步正例、8 步重启恢复链和 30 负例：`docs/active/project/fixtures/v3-media-capture-internal-relay-v5-fixtures.json`。

## 10. 决策

架构方向：`READY FOR DOCUMENT AUDIT`。代码实施：`NO-GO`，直至开发计划、验收计划、fixture/error 闭集和独立文档审查完成，并获得明确实施授权。

