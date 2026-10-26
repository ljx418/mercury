# WP0 R1 第二轮纠偏 PRD / 架构不变量检视（2026-10-16）

Candidate: `wp0-r1-corrective-round2-2026-10-16`
状态：**R1 AWAITING CODEX REFREEZE**

## 1. Codex 第二轮 Major / Minor 逐项关闭

| 编号 | 门禁要求 | 本轮实现 | 判定 |
|---|---|---|---|
| M-R1-C2-01 | 真实 Port 启动链路无循环，首次采集可达 | 抽出可注入 `OffscreenProducerBootstrap`（listener 同步注册）；entrypoint 加载即 `ensurePort()`；两阶段绑定 start→ready→credit，只用冻结 9 消息；修正 `sendStart` 的 credit 复位顺序与 ready 前置依赖 | ✅ |
| M-R1-C2-02 | Controller 无第二控制面，relay 必需 | `relay?:` → `relay:`；删除 start/stop 的 `sendOffscreenMessage` 分支；删除依赖旧 fallback 的测试并新增「零 onMessage 调用」断言 | ✅ |
| M-R1-C2-03 | restart marker 有 TRUSTED_CONTEXTS 与启动恢复 | 新增 `RelayRestartReconciler`：显式 `setAccessLevel(TRUSTED_CONTEXTS)`；worker 启动 `void reconcile()`；五阶段 dispatch 到既有 authenticated DELETE/GET；terminal+grace 后按 session 清理；永不恢复旧 PCM/ticket/sequence | ✅ |
| M-R1-C2-04 | producer START 失败必发归一化 `capture_error` | START 分支统一 catch → teardown → 恰好一个带 session 的 `capture_error`；Background 归一化到固定 20-code 并回 `abort` | ✅ |
| m-R1-C2-01 | 绿测覆盖真实 entrypoint composition | 新增 `OffscreenEntrypointComposition.test.ts`（3 例，调用真实 bootstrap+port+transport）与 `RelayRestartReconciliation.test.ts`（16 例，新实例读旧 store） | ✅ |

## 2. 架构不变量对照（`02-target-architecture-and-boundaries.md §3`）

| 不变量 | 本轮结果 | 判定 |
|---|---|---|
| Runtime capture WebSocket owner = Background | Background 唯一 `new WebSocket`；Offscreen 0 | ✅ |
| Offscreen 直接联网（不允许） | 无 WS / fetch / XHR / sendBeacon | ✅ |
| 音频生产/downsample 归 Offscreen | getUserMedia + AudioContext + downsample + PCM16 + teardown 保留 | ✅ |
| 同步 staging barrier 归 Runtime handler | 未改动；6 项 barrier 测试仍全绿 | ✅ |
| barrier 后 cleanup 归 transcript service，handler 禁止再 cleanup | 未改动；幂等 + fail-closed 测试证明 | ✅ |
| streamId 仅一次性、不入 chunk/credit/log/marker/storage/evidence | 仅在 `start` 消息出现，`getUserMedia` settle 后释放；静态测试断言无 `resumeTicket` 等恢复入口 | ✅ |
| 正常停止顺序 quiesce → drain → stopped → finalize | 原子 `beginStop` + drain 门 + 双端 harness 全序列 | ✅ |
| 超限 enqueue 前 abort，禁止静默丢块 | `admitChunk` 在入队前；两项上限各一例 | ✅ |
| **单一 capture control plane** | Controller 无 onMessage start/stop；Offscreen 仅接受 ping；Port 是唯一控制面 | ✅ |
| **restart 不恢复旧音频/票据/序列** | reconciler 只调既有 DELETE/GET；`recover` 从不用于恢复 PCM/ticket/sequence | ✅ |

## 3. 冻结 v10 schema 一致性

| schema 常量 | 实现 | 判定 |
|---|---|---|
| `portName` | `MEDIA_CAPTURE_AUDIO_PORT_NAME`，两端均不内联 | ✅ |
| `messageTypes` 4+5 | `PORT_MESSAGE` 精确 9 个 | ✅ |
| `sessionId ^cap_[A-Za-z0-9_-]{32}$` | `SESSION_ID_PATTERN` + `newCaptureSessionId()` | ✅ |
| `limits` 13 项 | `RELAY_V10` 逐项 pin | ✅ |
| `audioConfig` 16000/1/2 | `RELAY_AUDIO_CONFIG` | ✅ |
| `chunk` rawByteLength 2..49152 & multipleOf 2 | `validateChunkMessage` | ✅ |
| `chunk` pcmBase64 4..65536 + canonical pattern | `decodeChunkBase64` | ✅ |
| `quiesced` / `stopped` 常量约束 | 契约测试锁定 | ✅ |
| `restartMarker.schemaVersion` | `v3-media-capture-restart-marker/v10` | ✅ |
| `restartMarker.fields` 6 项 / 禁止字段 8 项 | `RESTART_MARKER_FIELDS` + `validateStoredMarker` | ✅ |
| `restartMarker.phaseTransitions` | `RESTART_MARKER_TRANSITIONS` 逐项 pin | ✅ |
| `restartMarker.maxRetentionMs` / `clearRule` | `markerTtlMs` / session 作用域 clear | ✅ |
| `restartBehavior` / `restartTermination` | 五阶段 dispatch 到既有 DELETE/GET；新 worker 仅观察 | ✅ |
| `boundaryFailureNormalization` 20 码 | `RELAY_FAILURE_CODES` 未增未减 | ✅ |
| `renameMapping` AudioContext→AUDIO_SHAPE | `PRODUCER_CODE_NORMALIZATION` | ✅ |
| `streamIdPolicy` | allowedMessage=`background_to_offscreen_start_exactly_once`；memoryLifetime=until getUserMedia settles；禁止位置由静态测试覆盖 | ✅ |

## 4. 合同不变性

| 合同面 | 本轮动作 | 判定 |
|---|---|---|
| 冻结 schema / fixture / 40-source / 20-target registry | **未修改** | ✅ |
| 验收阈值 | 未修改 | ✅ |
| 公共 API / Runtime endpoint / Origin / ticket TTL | 未修改 | ✅ |
| Cookie / provider 合同 | 未修改 | ✅ |
| BVID 分母 / grounded comprehension / SourceAuthority / Side Panel materialize | 未修改 | ✅ |
| 单一 Port 控制面（新增不变量） | 满足 | ✅ |

**内部合同变化**：有（两阶段 Port 绑定、`relay` 改必需、producer
`capture_error` 边界、restart reconciler + access level）。
**公共合同变化：none**。

## 5. 严重度与状态

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | 第二轮 4 项 Major 全部关闭 |
| Minor | 0 | m-R1-C2-01 关闭 |
| 待重冻结 | 1 | v10 verifier 45/50 + 14/15；8 个「缺失」code 全部仍在工作树，零真实删除；根因为 2 个 R1 必须改的冻结 scope 文件漂移 + 新增模块未入 scope |

## 6. 未启动事项声明

- R2–R7 未启动；WP1–WP7 未启动
- Chrome 0 次；Provider 0 次；六视频 fresh run 0 次；真实产品 run 0 次
- 可见 Chrome / 原生权限弹窗 / 焦点抢占 / UIAutomation 均未执行
- 未播放任何声音
- 未修改任何冻结证据；未宣布 R1 PASS
