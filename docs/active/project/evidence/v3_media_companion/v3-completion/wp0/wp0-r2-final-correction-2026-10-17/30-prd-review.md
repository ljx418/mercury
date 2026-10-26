# WP0 R2 最终合并纠偏 PRD / 架构不变量检视（2026-10-17）

Candidate: `wp0-r2-final-correction-2026-10-17`
状态：**R2 FINAL CORRECTION AWAITING CODEX CHECKPOINT**

## 1. `61-codex-r2-final-consolidated-correction.md` 逐条关闭

| 编号 | 门禁要求 | 本轮实现 | 判定 |
|---|---|---|---|
| **M-R2-C1** | producer abort 必须有**唯一 owner**，冻结 `abort` 每 capture **至多一次**；不得「Transport 已 fail-closed 后 Port 再发一次」 | `OffscreenAudioPort.notifyProducerAbortOnce()` 成为唯一 once-guard；Transport-owned / Port-owned(no-credit) / `capture_error` / 非法 Port message 四类路径全部收口；背景端 `onCaptureAbort` 由裸 `sendAbort` 改为走 once-guard | ✅ |
| **M-R2-C2** | `maxCaptureMs` 判定必须用**同一共享谓词**，且**打中目标边界本身**（exact boundary + one-over），不得先撞更小的队列/背压上限 | timer body **实际调用** `exceedsCaptureDurationBound()`，边界处重武装不 abort；`+1 ms` 才失败；静态门禁从「全文件调用次数」改为**定位 `#armCaptureDeadline()` 函数体**（原门禁把函数声明误算为 timer 使用，属 false green） | ✅ |
| **C3** | 终态不可被迟到事件改写；`abort()` 与 `#settle()` 不得无条件改状态 | `abort()` 改为只走带守卫的 `#failClosed()`；`#settle()` 改为 `if (!this.#terminalSettled)`；全部 Transport-owned 失败统一为单次 `#failClosed()`（`#armAckTimeout`、start 失败、start timer、`validateChunkMessage` 拒绝、`admitChunk` 拒绝） | ✅ |

## 2. Codex 追加约束逐条落实

| 约束 | 落实 |
|---|---|
| 测试必须驱动**生产类**；不得用 Transport 直调冒充 composition | 关键用例改由 **`producer.postMessage(chunk)` → 真实 `OffscreenAudioPort` CHUNK 分支**驱动；harness 镜像生产接线（`onCaptureAbort → notifyProducerAbortOnce`，`onFailure → transport.abort`） |
| 「测试名称 / 常量存在 / 字符串搜索 / exit 0 不得单独作为证明」 | 原 C2 静态门禁（出现次数 ≥2）已判定为 false green 并**作废重写**为函数体定位 + 行为断言 |
| 「上报失败一次」与「Port→Transport abort 请求」是两个通道 | harness 拆为 `failures`（公开上报）与 `portRequests`（请求）两个数组，避免计数混淆 |
| 假时钟 timer 不得在同刻重排死循环 | `remaining = Math.max(1, …)`，并加静态门禁锁定 |
| 无第二 control plane | producer abort 仍走**同一条冻结 `abort` Port 消息**，未新增协议 / endpoint / API |
| 未修改冻结材料 | v10 baseline **50/50**、mutations **15/15** 保持绿；未触发重冻结 |

## 3. 三条新增生产 composition 用例（Codex 复核范围）

| # | 用例 | 生产路径 | 判定 |
|---|---|---|---|
| 1 | `cumulative byte overflow via producer.postMessage performs one full closeout` | 真实 Port CHUNK → 真实 Transport → 真实 marker | ✅ |
| 2 | `no-credit is PORT-owned: the producer is still aborted exactly once` | 真实 Port CHUNK（无 start/ready） | ✅ |
| 3 | `a deadline that wins the race keeps aborted against a late finalize` | 真实 `cleanup_pending` + `#finalizeRuntime()` 等待中 | ✅ |

另附 3 条辅助用例（deadline exact boundary / timer 重武装 / 迟到 `abort()` 不改写 `finalized`）。

## 4. 架构不变量对照（`02-target-architecture-and-boundaries.md §3`）

| 不变量 | 本轮结果 | 判定 |
|---|---|---|
| Runtime capture WebSocket owner = Background | 不变；fail-closed 与 deadline 同属该 owner | ✅ |
| Offscreen 直接联网（不允许） | 不变 | ✅ |
| 音频生产 / downsample 归 Offscreen | 不变 | ✅ |
| 同步 staging barrier 归 Runtime handler | 不变；6 项 barrier 全绿 | ✅ |
| barrier 后 cleanup 归 transcript service | 不变 | ✅ |
| streamId 仅一次性 | 不变 | ✅ |
| 正常停止顺序 quiesce → drain → stopped → finalize | 不变 | ✅ |
| 超限 enqueue 前 abort，禁止静默丢块 | 字节 / 时长均在 enqueue、sequence、counter **之前**拒绝 | ✅ |
| 单一 capture control plane | **强化**：producer abort 唯一 owner + once-guard | ✅ |
| restart 不恢复旧音频 / 票据 / 序列 | 不变 | ✅ |
| restart 通过真实 authenticated Runtime | 不变（R1-C3-01 已闭合） | ✅ |
| 采集时长 / 字节上限由 owner 强制执行 | **强化**：timer 与 enqueue 共用同一谓词 | ✅ |

## 5. 四类上限在证据中的区分（不得互相冒充）

| 上限 | 冻结值 | 判定位置 | 失败码 |
|---|---|---|---|
| outstanding queue chunk cap | 32 | `admitChunk()` 入队前 | `BACKPRESSURE` |
| outstanding queue raw-byte cap | 1,572,864 | `admitChunk()` 入队前 | `BACKPRESSURE` |
| whole-capture cumulative byte cap | 536,870,912 | `offerChunkMessage()`，enqueue / sequence / counter 之前 | `BYTE_LIMIT` |
| whole-capture wall-clock deadline | 900,000 | owner timer **自触发** + enqueue 守卫（共用谓词） | `DURATION_LIMIT` |

C1 的 `no-credit` 用例打的是 **Port-owned backpressure**，
C1 的字节用例打的是 **cumulative byte cap**；两者在证据中分列，
**没有任何一条用背压冒充累计字节或时长上限**。

## 6. 冻结材料与阈值

未修改：v10 schema、fixture、FailureCode registry、九消息集合、20/40
inventory、`maxCaptureBytes` / `maxCaptureMs` / 各项 timeout / PCM 参数 /
marker TTL。`maxCaptureBytes` 仅作为**测试用注入 seam** 存在于
Transport 依赖中，production 默认仍为 `RELAY_V10.maxCaptureBytes`。

## 7. 严重度

| 级别 | 数量 |
|---|---:|
| Fatal | 0 |
| Major | 0（M-R2-C1、M-R2-C2 含 C3 全部关闭） |
| Minor | 0 |
| 待重冻结 | 0 |
