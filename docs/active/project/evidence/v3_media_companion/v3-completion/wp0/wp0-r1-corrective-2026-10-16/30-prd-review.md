# WP0 R1 纠偏 PRD / 架构不变量检视（2026-10-16）

Candidate: `wp0-r1-corrective-2026-10-16`
状态：**R1 AWAITING CODEX REFREEZE**

## 1. Codex 门禁 Major 逐项关闭

| Major | 门禁要求 | 本轮实现 | 判定 |
|---|---|---|---|
| M-R1-01 | Port 协议与冻结 v10 一致，控制面不绕过 Port | 9 消息精确实现；补 `chunk_credit`；`failed`→`capture_error`；`start` 归 Background→Offscreen；Offscreen Port listener 处理全部 4 个控制消息；删除 onMessage start/stop | ✅ |
| M-R1-02 | credit/backpressure 端到端 | `onRuntimeAck` → `noteRuntimeAck` → 唯一 `chunk_credit`；producer 无 credit 不发送；in-flight ≤ 1；上限 enqueue 前 abort | ✅ |
| M-R1-03 | restart marker 可持久化且合合约 | `chrome.storage.session` + `TRUSTED_CONTEXTS`；`v3-media-capture-restart-marker/v10`；`cap_`+32 base64url；五阶段 + TTL 不刷新 + clear 规则 + session 作用域 | ✅ |
| M-R1-04 | stop reason 原子、不得误判 completed | `beginStop(reason)` 先冻结；finalize 要求 stopRequested + offscreenStopped + queue 0 + inFlight 0；producer 自发 stopped 不得 finalize；首个 reason 不可被覆盖 | ✅ |
| M-R1-05 | Port 建连与 sender fail closed | 两侧 listener 同步注册（消除 ready 丢失）；URL 精确相等；tab absent；frameId absent-or-0；documentId 首次绑定；getContexts 恰好 1 个 OFFSCREEN_DOCUMENT + incognito 匹配；replacement Port / 第二 producer 拒绝 | ✅ |

## 2. Codex Minor 逐项关闭

| Minor | 门禁要求 | 本轮实现 | 判定 |
|---|---|---|---|
| m-R1-01 | `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED` 保留为 source diagnostic，Background 归一化 | `PRODUCER_INTERNAL_CODES` 保留；`PRODUCER_CODE_NORMALIZATION` 映射到 `V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID`；`isProducerInternalCode` 区分；harness 断言内部码不越界 | ✅ |
| m-R1-02 | changed-files 完整 | 见 `40-handoff.md` §1（含首轮遗留的 `resolveCaptureGrantBinding.ts`、`MediaCaptureMessageClient.ts`、`MediaCaptureMessageRouter.ts`、`contracts.ts`） | ✅ |

## 3. 架构不变量对照（`02-target-architecture-and-boundaries.md §3`）

| 不变量 | 本轮结果 | 判定 |
|---|---|---|
| Runtime capture WebSocket owner = Background service worker | Background 唯一 `new WebSocket`；Offscreen 0 | ✅ |
| Offscreen 直接联网（不允许） | 无 WS / fetch / XHR / sendBeacon | ✅ |
| 音频生产/downsample 归 Offscreen | getUserMedia + AudioContext + downsample + PCM16 保留 | ✅ |
| 同步 staging barrier 归 Runtime handler | 未改动，6 项 barrier 测试仍全绿 | ✅ |
| barrier 后 cleanup 归 transcript service，handler 禁止再 cleanup | 未改动，幂等 + fail-closed 测试证明 | ✅ |
| 唯一 durable 产品终态为 SQLite `commit_terminal` | 本轮未触及 | 未到 |
| streamId 仅一次性、不得入 chunk/credit/log/marker/storage/evidence | 仅在 `start` 消息出现，`getUserMedia` settle 后释放 | ✅ |
| 正常停止顺序 quiesce → drain → stopped → finalize | 原子 `beginStop` + drain 门 + harness 全序列 | ✅ |
| 超限 enqueue 前 abort，禁止静默丢块 | `admitChunk` 在入队前；两项上限各一例 | ✅ |

## 4. 冻结 schema 一致性（`v3_media_capture_internal_relay_v10.schema.json`）

| schema 常量 | 实现 | 判定 |
|---|---|---|
| `portName = navia.mediaCapture.audio/v10` | 两侧一致 | ✅ |
| `messageTypes` 4 + 5 | `PORT_MESSAGE` 精确 | ✅ |
| `sessionId ^cap_[A-Za-z0-9_-]{32}$` | `SESSION_ID_PATTERN` | ✅ |
| `limits` 13 项 | `RELAY_V10` 逐项 pin（静态合同测试） | ✅ |
| `audioConfig` 16000/1/2 | `RELAY_AUDIO_CONFIG` | ✅ |
| `chunk.rawByteLength` 2..49152 & multipleOf 2 | `validateChunkMessage` | ✅ |
| `chunk.pcmBase64` 4..65536 + canonical pattern | `decodeChunkBase64` | ✅ |
| `quiesced` 32 / 1572864 上限 | `RELAY_V10` + 测试 | ✅ |
| `stopped` queuedChunks 0 / creditConsumed 0 / tracks / context | 契约测试锁定 | ✅ |
| `restartMarker.schemaVersion` | `v3-media-capture-restart-marker/v10` | ✅ |
| `restartMarker.fields` 6 项 | `RESTART_MARKER_FIELDS` | ✅ |
| `restartMarker.phaseTransitions` | `RESTART_MARKER_TRANSITIONS` 逐项 pin | ✅ |
| `restartMarker.maxRetentionMs = 1080000` | `markerTtlMs` | ✅ |
| `restartMarker.clearRule` | session 作用域 + terminal 后清除 | ✅ |
| `boundaryFailureNormalization` 20 码 | `RELAY_FAILURE_CODES` 未增未减 | ✅ |
| `renameMapping` AudioContext→AUDIO_SHAPE | `PRODUCER_CODE_NORMALIZATION` | ✅ |

## 5. 合同不变性

| 合同面 | 本轮动作 | 判定 |
|---|---|---|
| 冻结 schema / fixture / 40-source / 20-target registry | **未修改** | ✅ |
| 验收阈值 | 未修改 | ✅ |
| 公共 API | 未修改 | ✅ |
| Runtime endpoint / Origin / ticket TTL | 未修改 | ✅ |
| Cookie / provider 合同 | 未修改 | ✅ |
| BVID 分母 | 未修改 | ✅ |
| grounded comprehension / SourceAuthority | 未修改 | ✅ |
| Side Panel materialize ownership | 未修改 | ✅ |

**内部合同变化**：有（Port 消息集合、marker 身份、sender 规则、stop 顺序、
credit 语义）。**公共合同变化：none**。

## 6. 严重度与状态

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | Codex 5 项 Major 全部关闭 |
| Minor | 0 | Codex 2 项 Minor 全部关闭 |
| 待重冻结 | 1 | v10 verifier 45/50 + 14/15；8 个「缺失」code 全部仍在工作树，零真实删除；漂移来自 2 个 R1 必然要改的冻结 scope 文件 + 4 个新 relay 模块未入 scope |

## 7. 未启动事项声明

- R2–R7 未启动；WP1–WP7 未启动
- Provider 请求 0 次；六视频 fresh run 未启动；真实产品 run 未启动
- 可见 Chrome / 原生权限弹窗 / 焦点抢占 / UIAutomation 均未执行
- 未修改任何冻结证据；未宣布 R1 PASS
