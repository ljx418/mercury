# WP0 R2 Phase Receipt（2026-10-17）

Candidate: `wp0-r2-2026-10-17`
前置：`R1 PASS`（Codex 受限重冻结：baseline 50/50、mutation 15/15）
状态：**R2 AWAITING CODEX CHECKPOINT**
R3 未启动。

## 1. R2-0 现状盘点：8 项不变量 → 源码 → 测试

| # | 不变量 | 源码 | 已有覆盖 | 缺口 |
|---|---|---|---|---|
| 1 | Offscreen 纯 PCM producer | `OffscreenProducerBootstrap.ts`、`media-capture-offscreen/main.ts` | R1 静态门禁 | 无 |
| 2 | exact sender + document 首绑 | `OffscreenAudioPort.ts:71-82`（`!==` 精确比较；`frameId !== undefined && !== 0`；`boundDocumentId`） | R1 合同测试 6 例 | 无 |
| 3 | PCM 16k/mono/s16le + Base64 canonical | `audioChunk.ts:26,42-45,96-104` | R1 合同测试 | 无 |
| 4 | sequence 严格 +1 | `RuntimeCaptureTransport.ts:403`（`+= 1`）、`audioChunk.ts:84` | R1 transport 30 例 | 无 |
| 5 | credit 仅 ACK 后返还 | `OffscreenAudioPort.ts:258-268`、`RuntimeCaptureTransport.ts` `onRuntimeAck` | R1 双端 5 例 | 无 |
| 6 | queue 32 / 1,572,864 bytes，enqueue 前 abort | `audioChunk.ts:115-127`、`RuntimeCaptureTransport.ts` `admitChunk` | R1 transport 2 例 | 无 |
| 7 | disconnect / ACK timeout / stop 边界 | `RuntimeCaptureTransport.ts:486,602`、`#armAckTimeout` | R1 transport 4 例 | **见 §2** |
| 8 | 不恢复旧 session 状态 | reconciler 无 `sourceIdentity`；transport 每次 `start()` 重置 sequence | R1 restart 22 例 | 无 |

## 2. R2 唯一真实缺口与修复

### 2.1 缺口

`relayContracts.ts` 冻结了 `maxCaptureMs: 900_000` 与
`maxCaptureBytes: 536_870_912`，但：

- `RuntimeCaptureTransport` 累计了 `#capturedMs` 与 `#chunkCount` 却**从未**
  与这两个冻结值比较；
- R1-C2-1 的 entrypoint 重写**移除了** Offscreen 侧的 `MAX_CAPTURE_MS`
  本地计时器。

结果：**采集时长与总字节上限在产品中没有任何位置强制执行**。这违反
R2 不变量 7（timeout）与固定验收「超限必须 enqueue 前 abort，禁止 drop」。

### 2.2 最小修复（`RuntimeCaptureTransport.ts`）

在 `offerChunkMessage()` 的 `admitChunk` 之前、`#queue.push` 之前新增两个
owner 侧检查：

```
#totalRawBytes + chunk.rawByteLength > RELAY_V10.maxCaptureBytes
  -> RELAY_FAILURE_CODES.BYTE_LIMIT
#now() - #startedAt > RELAY_V10.maxCaptureMs
  -> RELAY_FAILURE_CODES.DURATION_LIMIT
```

两者都 `#fail()`（固定码、单次上报）并 `return { ok:false }`，**在任何
入队之前**，因此不存在静默截断或 drop。新增 `#totalRawBytes` 计数与
`totalRawBytes` / `capturedMs` getter 供可观测与测试。

未改动任何其他模块；未改动冻结常量、registry、阈值或分母。

## 3. R2-1..R2-5 验证矩阵

新增 `tests/RelayR2Invariants.test.ts`（**28 例**），全部驱动**生产类**
（真实 `RuntimeCaptureTransport` + `OffscreenAudioPort` +
`bootstrapOffscreenProducerPort`），仅替换 chrome Port 与 Runtime WebSocket
原语。

### R2-1 exact sender / document binding

| 用例 | 断言 |
|---|---|
| canonical sender | 通过 |
| absent frameId | 通过 |
| 错误 extension / 带 tab / URL 非精确 / frameId≠0 | `PORT_FORBIDDEN` |
| documentId 不符 / 0 个 context / 2 个 context / incognito 不符 | `PORT_FORBIDDEN` |
| document 首绑 + 拒绝第二 producer | `ALREADY_ACTIVE` |

### R2-2 PCM / Base64 canonicalization

| 用例 | 断言 |
|---|---|
| canonical Base64 + 精确往返字节数 | 通过 |
| 非 canonical 字符 / 声明长度不符 / 奇数字节 / 超 raw 上限 | fail closed |
| 0 长度 chunk | `EMPTY` |
| 外来 session 的 chunk | `BINDING_MISMATCH` |

### R2-3 credit / ACK / sequence

| 用例 | 断言 |
|---|---|
| sequence 0,1,2 顺序接受；重复拒绝 | `CHUNK_SEQUENCE_INVALID` |
| gap / ahead 拒绝 | `CHUNK_SEQUENCE_INVALID` |
| 首 credit 由 `ready` 授予（非 `start`） | `credit:1, acknowledgedSequence:-1` |
| 无 credit 的 chunk 拒绝 | `BACKPRESSURE` |
| 每 chunk 消耗 1 credit，仅 Runtime ACK 后返还 | ACK 前 1 次、ACK 后 2 次 |

### R2-4 bounded queue / overflow-before-enqueue

| 用例 | 断言 |
|---|---|
| 第 33 个 outstanding chunk 拒绝 | `BACKPRESSURE` |
| 字节上限拒绝 | `BACKPRESSURE` |
| 边界：32 允许、33 拒绝 | 精确边界 |
| ACK 前 in-flight ≤ 1 | 3 chunk 只发 1 |

### R2-5 disconnect / timeout / stop 边界

| 用例 | 断言 |
|---|---|
| ACK timeout | `PROTOCOL_INVALID` + state `aborted` |
| stop 边界后 chunk | `PROTOCOL_INVALID` |
| producer stopped 后 chunk | `PROTOCOL_INVALID` |
| 异常 producer disconnect | `aborted:true` + `PORT_DISCONNECTED` |
| 已 finalize 的正常 disconnect | `aborted:false`，无失败 |
| **owner 时长上限**（R2 修复） | 超 `maxCaptureMs` → `DURATION_LIMIT` |
| **owner 字节上限**（R2 修复） | 冻结值断言 + 静态门禁锁定检查位置 |

### R2-8 不恢复旧状态

| 用例 | 断言 |
|---|---|
| 新 transport 从 sequence 0 起 | 不继承旧 sequence |
| Offscreen 消息不含 ticket / sourceIdentity / acquisitionRecordId | 序列化断言 |

## 4. 静态门禁扩展

`relay_ownership_contract.node-test.mjs` 25 → **28 例**，新增 3 组：

| 组 | 断言 |
|---|---|
| R2-5 | transport 必须引用 `RELAY_V10.maxCaptureBytes` 与 `RELAY_V10.maxCaptureMs`，且两个检查位置都**早于** `this.#queue.push`；使用冻结 `BYTE_LIMIT` / `DURATION_LIMIT` 码 |
| R2-1 | sender URL 必须用 `!==` 精确比较，**禁止** `startsWith`；frameId 仅 absent 或 0 |
| R2-3/R2-4 | credit 由 `onRuntimeAck` / `noteRuntimeAck` 驱动；`admitChunk(` 位置早于 `#queue.push` |

## 5. 冻结合同核验（重要）

Codex 已完成 R1 受限重冻结，采用 source / target scope 分离。R2 修改的
`RuntimeCaptureTransport.ts` 属于**目标实现（target）**而非冻结 **source
scope**，因此：

```
verify-...-v10-contract.py  → exit 0, 50/50, sourceInventoryDiff 40/40, unlisted {}
verify-...-v10-mutations.py → exit 0, 15/15
```

**R2 未触发重冻结需求**：无冻结 scope 文件被修改，无需等待 Codex 再次
重冻结。

## 6. 合同变化

- **内部合同变化**：有 —— owner 侧新增 `maxCaptureMs` / `maxCaptureBytes`
  强制执行（使用既有冻结 `DURATION_LIMIT` / `BYTE_LIMIT` 码）。
- **公共合同变化**：**none**。未修改冻结 schema、fixture、
  40/20 inventory、FailureCode registry、固定阈值、验收分母、公共 API、
  Runtime endpoint、Origin、ticket TTL、Cookie/provider 合同、BVID 分母、
  grounded comprehension、SourceAuthority、Side Panel materialize ownership。

## 7. 严重度

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | 8 项不变量全部验证；1 项真实缺口已修复 |
| Minor | 0 | — |
| 待重冻结 | **0** | 50/50 + 15/15 保持绿；未修改冻结 scope |

## 8. 停止点

R2-0..R2-7 全部完成。状态 **R2 AWAITING CODEX CHECKPOINT**，停止等待
Codex；不进入 R3。
