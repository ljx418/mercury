# WP0 R1 Gap Analysis — Background Capture Transport（2026-10-16）

依据：`00-codex-r1-transport-gap-decision.md`（SHA-256 `ed9b42b2aef4e3374eaeb2d6a14bcab34d99d93f97e6e5e84b37bcea7cdedbf2`）

## 1. 当前实现事实

### 1.1 Offscreen 越权持有 Runtime 传输（违反冻结不变量）

`apps/chrome-extension/entrypoints/media-capture-offscreen/main.ts`：

| 行 | 事实 | 违反项 |
|---|---|---|
| 3 | 持有 `RUNTIME_WS_URL = "ws://127.0.0.1:17861/v1/media/capture-stream"` | Offscreen 不得持有 Runtime URL |
| 70 | `const socket = new WebSocket(RUNTIME_WS_URL)` | Offscreen 直接联网 |
| 84-91 | 向 Runtime 发送 `ticket` / `binding` / `sourceIdentity` / `acquisitionRecordId` | Offscreen 不得持有 ticket/binding |
| 139 | `active.socket.send(pcm)` 直发 PCM 二进制 | Background 未持有 sequence/credit/queue |
| 46-57 | 负责 Runtime stop、终态等待 | Background 应为终态协议 owner |
| 133 | `MAX_CAPTURE_MS = 900_000` 本地超时 | 应由 Background 持有 |

### 1.2 Background 无 capture transport

`apps/chrome-extension/entrypoints/background/index.ts`：

- 无 `RuntimeCaptureTransport` 或等价物；
- `proxyRuntimeFetch` / `proxyRuntimeStream`（:505 / :522）对
  `/v1/media/capture-` 前缀直接抛 `V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED`，
  即 Background 明确拒绝承担 capture 传输；
- `MediaCaptureController`（:88）只在 Offscreen 与 Runtime 之间转发
  `start` / `stop` 消息，本身不接触 Runtime capture 通道。

### 1.3 Controller 把 ticket/binding 交给 Offscreen

`src/modules/media_companion/capture/MediaCaptureController.ts:112-127`：
`startArmed()` 把 `streamId` + `ticket` + `binding` + `sourceIdentity` +
`acquisitionRecordId` 一并 `sendOffscreenMessage` 给 Offscreen。

### 1.4 无 Port、无 sequence/credit/queue、无 restart marker

- 固定 Port `navia.mediaCapture.audio/v10` 不存在；
- 无 Offsender 五字段校验、无 `runtime.getContexts(documentId)`；
- 无 sequence 递增、credit 窗口、队列/字节上限、ACK 返还 credit；
- 无 v10 restart marker 五阶段。

## 2. 与冻结合同的差距

| 冻结要求（`02-target-architecture-and-boundaries.md §3` / v10 架构 §4） | 现状 | 差距 |
|---|---|---|
| Runtime capture WebSocket owner = Background service worker | Offscreen | **Fatal 级所有权倒置** |
| Offscreen 直接联网 | Offscreen 开 WS 并直发 PCM | **不允许** |
| Background 持有 sequence / 单信用窗口 / 队列与字节上限 / ACK 返还 credit | 无 | 全部缺失 |
| Background 持有 quiesce/drain/abort-before-enqueue | 无（Offscreen 直接 send） | 全部缺失 |
| Background 持有 v10 restart marker 五阶段 | 无 | 全部缺失 |
| Background 精确校验 Offscreen sender 五字段 + `runtime.getContexts` | 无 Port | 全部缺失 |
| Offscreen 仅生产 PCM | Offscreen 还做传输/终态 | 需收敛 |
| streamId 仅一次性下发，不入 chunk/credit/日志/storage/marker | Offscreen 全程持有 | 需收敛 |
| 固定参数（49152 / 65536 / credit 1 / 32 chunks / 1572864 bytes） | 无 | 全部缺失 |

## 3. Runtime 侧已具备（不需 R1 改动）

- `audio_ref.py:191-211` owner manifest：O_EXCL 临时文件 → fsync → 原子 replace → 父目录 fsync
- `audio_ref.py:259-279` ownership receipt：`BEGIN IMMEDIATE` + `synchronous=FULL` + COMMIT
- `transcript_service.py:86` `create()` 内**同步** `stage()`；`start()`（:118-126）才起 worker 线程
- `app.py:1045` `terminal = True` 设在 `sink.finalize()` 之后、`create()` 之前

→ 「worker 不早启」「cleanup owner 唯一」在 Runtime 侧代码已满足，R1 需补**证明测试**，
并新增扩展侧 Background transport。

## 4. R1 实施范围

新增（Background 侧）：
1. `RuntimeCaptureTransport` — WS 唯一 owner；start/started/chunk/ACK/stop/final/close/timeout；
   sequence、单信用窗口、队列与字节上限、ACK 返还 credit、quiesce/drain、abort-before-enqueue；
   FailureCode 归一化；restart marker 五阶段。
2. `OffscreenAudioPort` — 固定 Port 名、五字段 sender 校验、`runtime.getContexts` 校验。
3. 共享 chunk 编解码与长度/序列校验。

修改：
4. `contracts.ts` — Port 名与消息类型、冻结参数常量（**不**改既有公共合同字段）
5. `MediaCaptureController.ts` — 先取得 Runtime `started`，再一次性下发 streamId；stop 走 quiesce/drain
6. `background/index.ts` — 装配 transport + port
7. `media-capture-offscreen/main.ts` — 收敛为纯 PCM producer（**删除** WS/URL/ticket/binding/终态）

不修改：冻结 schema、fixture、FailureCode registry、验收阈值、公共 API、
Runtime endpoint、Origin、ticket TTL、Cookie/provider、BVID 分母、
grounded comprehension、SourceAuthority、Side Panel materialize ownership。

## 5. 明确禁止

- 不保留 Offscreen 直连 Runtime 的 fallback；
- 不降低 sender validation / backpressure / restart / cleanup / secret scan 门槛；
- 不回退既有 V3-2/V3-3 实现；
- 不进入 R2。
