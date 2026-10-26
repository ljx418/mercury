# WP0 R1 纠偏后 Codex 重冻结门禁复核（2026-10-16）

## 1. 决定

**R1 NO-GO。Fatal 0 / Major 4 / Minor 1。拒绝重冻结，R2 不得启动。**

ClaudeCode 已关闭上一轮大量协议、credit、stop ordering 与 sender validation
问题，相关单元测试和静态测试均通过。但本轮 Codex 直接检查真实扩展 entrypoint 后，
确认当前状态并非“仅差冻结 source scope/hash”：真实 Background↔Offscreen 启动链路
仍不可达，旧控制面仍存在，service worker restart recovery 未实现，producer 启动错误
也不会按冻结协议回传。

因此不得用更新 fixture hash/source scope 的方式把当前实现认证为 v10 基线。

本轮未启动 Chrome、Runtime、Provider 或六视频，未播放声音，未修改产品代码、冻结
schema、fixture、FailureCode registry、验收阈值或公共 API。

## 2. 已确认成立的改进

- Runtime WebSocket 已从 Offscreen 移到 Background，Offscreen 源码中无 Runtime URL / ticket / binding。
- 9 个 Port 消息类型、credit=1、Runtime ACK 后返 credit、原子 stop reason、sender 五字段校验已有模块实现与测试。
- Runtime ownership barrier、typecheck、扩展测试、build 与 focused pytest 的既有自验证结果可保留。
- `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED` 已作为内部诊断恢复，并映射到公开固定码。

这些改进不足以越过 R1 门禁，因为下列问题位于真实入口与恢复边界。

## 3. Major

### M-R1-C2-01：真实 Port 启动链路形成循环依赖，首次采集必然在 `sendStart` 前失败

事实链：

1. Offscreen 只在 `startCapture()` 内调用 `ensurePort()`：
   `media-capture-offscreen/main.ts:165-169`；
2. `startCapture()` 只会在已存在 Port 收到 Background `start` 后执行：
   `media-capture-offscreen/main.ts:141-148`；
3. Background `OffscreenAudioPort.sendStart()` 要求 Port 已连接且
   `producerReady=true`，否则返回 `V3_MEDIA_CAPTURE_PORT_DISCONNECTED`：
   `OffscreenAudioPort.ts:198-202`；
4. Offscreen 文件加载、ping 与尾部初始化均未主动调用 `ensurePort()`。

即：需要 Port 才能收到 start，而 Port 只在收到 start 后创建。现有双端 harness 手工
构造 `PortPair` 并手工发送 `ready`，没有执行真实 entrypoint，因而无法发现该问题。

**要求修复：** Offscreen 文档创建后必须主动建立固定 Port，监听器先注册；同时明确
不增加第十种协议消息的启动握手。建议使用冻结 9 消息内的两阶段绑定：Port 连接表示
producer transport ready；Background 可发送携带 captureSessionId 的 `start`；Offscreen
绑定 session 后回 `ready`，Background 再发首个 `chunk_credit`。若采用其他顺序，必须
证明无循环、无丢 ready、所有消息 captureSessionId 一致。

### M-R1-C2-02：Controller 仍保留旧 `runtime.onMessage start/stop` 第二控制面

`MediaCaptureControllerDependencies.relay` 仍为 optional，且保留
`sendOffscreenMessage()`；`startArmed()` 与 `stop()` 在 relay 缺失时仍分别发送
`command: "start"` / `command: "stop"`：

- `MediaCaptureController.ts:55-65`
- `MediaCaptureController.ts:158-205`
- `MediaCaptureController.ts:225-269`

真实 Offscreen 已明确只接受 `ping`，其他 command 返回
`V3_MEDIA_CAPTURE_MESSAGE_INVALID`（`media-capture-offscreen/main.ts:286-298`）。因此该
fallback 既违反“单一 Port 控制面”，又是不可工作的死路径。现有 Controller 测试仍
以该旧路径作为默认，并在 `MediaCaptureController.test.ts:193-224` 验证旧 stop result。

**要求修复：** relay 改为必需依赖；删除 Controller 的 start/stop
`sendOffscreenMessage` 分支和对应旧测试。`sendOffscreenMessage` 若仍需保留，只能由
Background 的 offscreen prewarm ping 使用，不得成为 Controller capture control。

### M-R1-C2-03：restart marker 只写/删，没有 `TRUSTED_CONTEXTS` 配置和启动恢复

冻结 v10 要求：

- `chrome.storage.session` + `TRUSTED_CONTEXTS`；
- 新 worker 启动读取 marker；
- 按 phase 调用现有 authenticated DELETE / GET / recover；
- 永不恢复旧 PCM/ticket/sequence；
- 观察 owner receipt / terminal 与 cleanup grace 后清 marker。

当前 Background 仅在 transport callback 中 `storage.session.set/get/remove`
（`background/index.ts:95-118`）。仓库中没有
`chrome.storage.session.setAccessLevel(...)`，`onStartup` 仅调用
`configureSidePanel()`（`background/index.ts:257-263`），也没有 marker read/validate/
phase dispatch/reconciliation 实现。

`RelayRestartHarness.test.ts` 只验证 `RuntimeCaptureTransport` 向一个
`FakeSessionStore` 写入和删除 marker；它不导入 Background entrypoint，也没有创建新
worker/reconciler。纠偏证据中“TRUSTED_CONTEXTS + startup recovery 已闭合”的声明与
代码事实不符。

**要求修复：** 新增可单测的 `RelayRestartReconciler`（或等价模块）并在 service worker
初始化时执行；显式调用 `setAccessLevel({accessLevel:"TRUSTED_CONTEXTS"})`；覆盖五阶段、
过期/非法 marker、Runtime unavailable、terminal/cleanup grace、幂等重复启动和他 session
marker 不误删。

### M-R1-C2-04：Offscreen producer 启动失败不会发 `capture_error`

`handleBackgroundMessage()` 以 `void handleBackgroundMessage(message)` 调用 async handler，
`startCapture()` 对 getUserMedia、AudioContext、shape 等错误清理后重新抛出，但调用边界
没有 catch 并发送冻结的 `capture_error`：

- `media-capture-offscreen/main.ts:100-104`
- `media-capture-offscreen/main.ts:141-162`
- `media-capture-offscreen/main.ts:165-193`
- `media-capture-offscreen/main.ts:249-252`

结果是用户拒绝/Chrome capture 失败/AudioContext 未 running 时产生未处理 Promise，
Background 只能等 timeout，无法得到固定码。这违反冻结的 Offscreen→Background
`capture_error` 边界和 fail-closed 可观测性。

**要求修复：** 统一捕获 START handler 错误，清理资源，并发送带当前
captureSessionId 的 `capture_error`；内部诊断必须在 Background 归一化为 20-code 闭集，
不得把异常文本、路径或私密值送出边界。

## 4. Minor

### m-R1-C2-01：现有绿测未覆盖真实 entrypoint composition

461/461、17/17、双端 harness 与 restart harness 证明类级逻辑，但没有执行
“创建 Offscreen 文档 → Offscreen 主动连 Port → Background accept → start → ready → 首
credit”的真实装配，也没有执行 Background worker restart reconciliation。下一轮必须
增加 entrypoint composition 测试，不能只增加类级 mock。

## 5. 冻结裁定

1. 不更新 v10 fixture 中两个旧文件的 hash。
2. 不把新增 relay 文件加入冻结 source scope。
3. 不重算 40-code inventory。
4. 不修改 20-code target registry。
5. 不接受当前 `45/50`、`14/15` 为“纯证据漂移”。

只有 M-R1-C2-01..04 全部关闭，且新增真实 composition/restart 测试通过后，Codex 才会
重新检查 source inventory 并执行重冻结。

## 6. 下一轮最低验收

- 无 Chrome/声音要求的 deterministic entrypoint composition test：证明首次 Port 建连无循环；
- Controller 不存在 start/stop onMessage fallback；relay 为 capture 必需依赖；
- Offscreen START 失败必发一个归一化 `capture_error`；
- Background 显式 `TRUSTED_CONTEXTS`，启动读取 marker 并执行 phase dispatch；
- restart 测试必须覆盖“新实例读取旧 store”，而不是只验证旧 transport 写 marker；
- 原有 typecheck、461 tests（或新增后的全量）、build、17 ownership、6 barrier、180 focused 全绿；
- 所有测试不得播放声音；若后续需要 Chrome，必须显式 `--mute-audio`；
- 状态仍写 `R1 AWAITING CODEX REFREEZE`，不得进入 R2。

## 7. 自动化开发停止原因

R1 类级状态机已经显著改善，但真实 Offscreen entrypoint 无法先建立 Port，restart recovery
也尚不存在。此时重冻结会把“单测可运行、产品入口不可运行”的状态固化为权威合同，构成
虚假验收风险。因此 Codex 拒绝重冻结并保持 R1 NO-GO。

