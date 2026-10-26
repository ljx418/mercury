# WP0 R2 限定纠偏 Phase Receipt（2026-10-17）

Candidate: `wp0-r2-corrective-2026-10-17`
前置：`R2 NO-GO`（Codex `60-codex-r2-checkpoint-review.md`：Fatal 0 / Major 2 / Minor 0）
授权边界：仅关闭 **M-R2-01**、**M-R2-02**
状态：**R2 CORRECTIVE AWAITING CODEX CHECKPOINT**
R3 未启动。

## 1. M-R2-01 关闭：Background owner 主动采集 deadline

### 1.1 原缺陷

`offerChunkMessage()` 才读取 `now() - startedAt > maxCaptureMs`。Transport
没有总时长 timer；音频源静默、producer 卡住或不再发 chunk 时，任务可在
900,000 ms 后继续保持 `active`，直到另一 chunk 或外部事件到达。因此
「超时后确定收口 / 关闭 socket / 通知 producer / settle terminal / 清理
marker」全部不成立。

### 1.2 修复：单一 owner deadline handle

`RuntimeCaptureTransport` 新增**单一** deadline handle
（`#deadlineTimer` + `#armCaptureDeadline()` / `#clearCaptureDeadline()`）：

- **起点唯一**：`#armCaptureDeadline()` 在 `start()` 中与
  `#markerExpiry` 同一处、从**同一个 `#startedAt`** 计算
  （`remaining = RELAY_V10.maxCaptureMs - (now() - #startedAt)`），
  与 restart marker 的 `startedAt` / `expiresAt` 严格同源。
- **自触发**：timer 到达时**不需要任何后续 chunk**。回调按固定顺序执行
  一次性收口：
  1. `if (this.#failure) return;` —— 已有失败时**不再产生第二次失败**
  2. `#fail(DURATION_LIMIT)` —— 归一化固定码，**至多一次**
  3. `onCaptureAbort(failureCode)` —— 通过**既有冻结 Port**
     `OffscreenAudioPort.sendAbort()` 通知 producer（**非第二控制面**）
  4. `#closeSocket()` —— 关闭 Runtime WebSocket
  5. `#setState("aborted")` + `#settleTerminal({ok:false, failureCode})`
  6. `#settleTerminal()` 内部 `#clearCaptureDeadline()` → 清理 marker
- **timer 清理**：`#clearCaptureDeadline()` 在
  `#armCaptureDeadline()`（重入）、`#closeSocket()`、
  `#settleTerminal()`（success / cancel / failure / deadline 全部终态的唯一
  汇聚点）、`#reset()` 四处幂等调用，因此不残留异步回调。
- **与 enqueue 守卫同源**：timer 与 enqueue 守卫都调用同一个纯函数
  `exceedsCaptureDurationBound()`，deadline 起点与判定不会漂移。

### 1.3 Background 接线

`entrypoints/background/index.ts` 新增

```
onCaptureAbort: (failureCode) => {
  relayPortRef.current?.sendAbort(failureCode);
}
```

复用同一个 `OffscreenAudioPort` 实例与同一条冻结 `abort` 消息路径，
**不构成第二 capture control plane**。

## 2. M-R2-02 关闭：累计字节真实边界

### 2.1 原缺陷（false green）

名为 `enforces the frozen capture byte bound at the owner` 的用例只循环
40 次；因为没有 Runtime ACK，第 33 个 chunk 已被 outstanding queue 的
`BACKPRESSURE` 拒绝，**从未触达** 512 MiB 累计上限。该用例只断言
`maxCaptureBytes === 536_870_912` 与「返回值是 object」，不构成任何行为
证明。R2 receipt 中「单元测试 + 静态门禁双重锁定」的声明据此撤回。

### 2.2 修复：纯边界判定 + 低资源行为测试

**纯函数（无副作用、无分配、无编码）**：

```
exceedsCaptureByteBound(current, next, max = RELAY_V10.maxCaptureBytes)
  → current + next > max
exceedsCaptureDurationBound(elapsed, max = RELAY_V10.maxCaptureMs)
  → elapsed > max
```

- `current + next === max` **允许**；`>` 才拒绝；
- transport 在 **enqueue / sequence 递增 / counter 累加之前** 调用它们。

**测试专用 limits seam**（`dependencies.maxCaptureBytes`）：

- 仅用于让测试在小数值上证明 512 MiB 的**同一判定逻辑**；
- production 不设置该值，有效上限永远是 `RELAY_V10.maxCaptureBytes`；
- **不暴露**给 UI、Port 消息或任何公共 API（静态门禁断言默认值来源）。

**512 MiB 边界的低资源证明**（不做 512 MiB 分配/循环）：

| 用例 | 断言 |
|---|---|
| 冻结值 | `maxCaptureBytes === 536_870_912` |
| `current + next === max` | 允许（`current = max - 1000`, `next = 1000`） |
| `current + next === max + 2` | 拒绝 |
| `0 + max` | 允许 |
| `0 + max + 1` | 拒绝 |
| 显式 override | 证明 seam 真实生效，且默认不宽化 |

**污染证明**（seam = 640，chunk = 320）：

- 两个 chunk 精确累计到 640（`totalRawBytes === 640`）；
- 第 3 个 322 字节 chunk → `BYTE_LIMIT`；
- 拒绝后 `backlog.sequence` / `totalRawBytes` / `backlog.chunks` /
  `capturedMs` **四项全部不变**；
- `BYTE_LIMIT` 失败**恰好上报一次**。

**composition 收口证明**（真实 `OffscreenAudioPort` +
`RuntimeCaptureTransport` + `bootstrapOffscreenProducerPort`）：

- producer 收到**恰好一个** `abort`，`failureCode = DURATION_LIMIT`；
- Runtime socket `readyState === 3`（已关闭）；
- transport `state === "aborted"`；
- 失败上报**至多一次**。

### 2.3 保留原 backpressure 测试

32 / 33 chunks 与 outstanding raw-byte 背压测试**全部保留**，并在证据中
明确区分三类上限（见 §5）。

## 2.4 复核中新发现并修复的收口缺陷（强制要求 §3.5-3.7）

在按 §3.5-3.7 补「完整 fail-closed」断言时，发现一个**生产真实缺陷**：

`offerChunkMessage()` 的累计字节 / 时长边界此前只调用 `#fail()`，而生产
`reportFailure` 接线仅记录（`globalThis.__naviaRelayLastFailure = code;`），
**不 abort**。因此累计字节越界在生产中只上报一个错误码，却：

- **不**通知 Offscreen producer abort
- **不**关闭 Runtime WebSocket
- **不**settle 失败 terminal
- **不**清理 restart marker

即：Codex M-R2-02 §3.5-3.7 要求的收口在生产中并不存在。

**修复**：把「主动 deadline」与「enqueue 边界」统一到**单一**私有收口
`#failClosed(failureCode)`，它按固定顺序执行：

1. 幂等守卫（已 terminal / 已失败 / 已 aborted → 直接返回，保证至多一次）
2. `#fail(failureCode)` —— 仅一次归一化失败码
3. `onCaptureAbort(failureCode)` —— 通过既有冻结 Port 通知 producer
4. `#closeSocket()` —— 关闭 Runtime WebSocket
5. `#setState("aborted")` + `#settleTerminal({ok:false, failureCode})`
   —— settle 失败 terminal，并在内部清理 marker 与全部 timer

现在**任何 owner 检测到的越界**（wall-clock 或累计字节）都走同一条收口，
保证 failure / terminal / marker clear **至多一次**且四件套齐全。

## 3. 三类上限的明确区分（修正证据）

| 上限 | 冻结值 | 判定位置 | 失败码 | 证明方式 |
|---|---|---|---|---|
| **outstanding queue chunk cap** | `maxOutstandingChunks = 32` | `admitChunk()`，入队前 | `BACKPRESSURE` | 32 允许 / 33 拒绝（精确边界） |
| **outstanding queue raw-byte cap** | `maxOutstandingRawBytes = 1_572_864` | `admitChunk()`，入队前 | `BACKPRESSURE` | `admitChunk` 小对象直接验证 |
| **whole-capture cumulative byte cap** | `maxCaptureBytes = 536_870_912` | `offerChunkMessage()`，enqueue / sequence / counter **之前** | `BYTE_LIMIT` | 纯谓词 exact-boundary + seam 行为 + 污染证明 |
| **whole-capture wall-clock deadline** | `maxCaptureMs = 900_000` | owner timer **自触发**（无需新 chunk）+ enqueue 守卫 | `DURATION_LIMIT` | fake clock 无后续 chunk 到点 abort |

## 4. 新增 / 修正测试

| 文件 | 变化 | 用例 |
|---|---|---|
| `tests/RelayR2Invariants.test.ts` | 28 → **38** | 删除 1 个 false-green 用例；新增 C1 主动 deadline 5 例、C2 累计字节 4+1 例、单一来源 2 例 |
| `scripts/…/relay_ownership_contract.node-test.mjs` | 28 → **30** | 更新 R2-5 门禁为「纯谓词 + 共享调用」；新增 C1 主动 deadline 门禁、C2 累计上限非队列上限门禁 |

C1 新增用例：

1. fake clock **无任何后续 chunk**：deadline 前 active，到点**主动** aborted
2. deadline 通知 producer 且关闭 Runtime socket
3. deadline 与用户 stop 竞争：失败/terminal/marker clear **均一次**
4. deadline 与 Runtime disconnect 竞争：**不再产生第二次 DURATION_LIMIT**
5. success / cancel / abort 后 timer 均清除；推进 clock 不产生二次失败

## 5. 合同变化

- **内部合同变化**：有 — owner 新增主动 wall-clock deadline handle 与
  `onCaptureAbort` hook；新增两个纯边界谓词；新增仅内部测试用
  `maxCaptureBytes` seam（production 默认仍为 `RELAY_V10`）。
- **公共合同变化**：**none**。未修改冻结 schema、fixture、40/20
  inventory、FailureCode registry、固定阈值、公共 API、Runtime endpoint、
  Origin、ticket、Cookie/provider 合同、消息集合。

## 6. 冻结合同核验

R2 corrective 只修改 **target（relay 实现）** 文件
（`RuntimeCaptureTransport.ts`、`background/index.ts`）与测试 / 静态门禁，
**未修改任何冻结 source scope 文件**：

```
verify-...-v10-contract.py  → exit 0, 50/50, sourceInventoryDiff 40/40, unlisted {}
verify-...-v10-mutations.py → exit 0, 15/15
```

**未触发重冻结需求。**

## 7. 严重度

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | M-R2-01 与 M-R2-02 关闭；R2 receipt 的 false-green 声明已撤回并重做 |
| Minor | 0 | — |
| 待重冻结 | **0** | 50/50 + 15/15 保持绿 |

## 8. 停止点

R2 限定纠偏完成。状态 **R2 CORRECTIVE AWAITING CODEX CHECKPOINT**，
停止等待 Codex；不进入 R3，不自行宣布 R2 PASS。
