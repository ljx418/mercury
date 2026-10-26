# WP0 R2 最终合并纠偏 Phase Receipt（2026-10-17）

Candidate: `wp0-r2-final-correction-2026-10-17`
前置：`R2 NO-GO`（Codex `60-codex-r2-corrective-checkpoint.md`：Fatal 0 / Major 2 / Minor 0）
授权边界：仅关闭 **M-R2-C1**、**M-R2-C2**（含 C3 终态竞争）
状态：**R2 FINAL CORRECTION AWAITING CODEX CHECKPOINT**
R3 未启动。

## 1. M-R2-C1 关闭：单一 producer-abort owner

### 1.1 原缺陷（生产真实路径）

`RuntimeCaptureTransport.offerChunkMessage()` 越界时调用 `#failClosed()`，
经 `onCaptureAbort` 发一次 `abort`；随后真实 `OffscreenAudioPort` 的 CHUNK
分支收到 `{ok:false}` 又执行 `sendAbort()`，再 `onFailure → transport.abort()`：

```
producer Port chunk
  -> transport.offerChunkMessage
  -> transport.#failClosed -> onCaptureAbort -> abort #1
  -> OffscreenAudioPort offered !ok -> sendAbort -> abort #2
```

且原 byte-cap 测试直接调 `transport.offerChunkMessage()`，**没有**经过真实
Port 入站分支，因此「producer 恰好收到一次 abort」无法证明生产行为。

### 1.2 修复：Port 成为唯一 abort owner

`OffscreenAudioPort` 暴露**唯一**的 once-guard：

```
notifyProducerAbortOnce(failureCode) {
  if (this.#abortNotified) return;
  this.#abortNotified = true;
  this.sendAbort(failureCode);
}
```

所有必须通知 producer 停止的路径都收口到它：

| 触发源 | 路径 |
|---|---|
| Transport-owned（schema / sequence / capture bound / admission） | `#failClosed()` → `onCaptureAbort` → **`notifyProducerAbortOnce`** |
| Port-owned（no credit） | CHUNK 分支 `credit <= 0` → `notifyProducerAbortOnce` |
| Port-owned（`capture_error`） | CAPTURE_ERROR 分支 → `notifyProducerAbortOnce` |
| Port-owned（非法 Port message） | default 分支 → `notifyProducerAbortOnce` |

**背景端接线同步修正**：`onCaptureAbort` 原本调用裸 `sendAbort`，绕过了
once-guard —— 那正是 Codex 指出的第二次 abort 来源。现改为
`relayPortRef.current?.notifyProducerAbortOnce(failureCode)`。

**Port CHUNK 分支的分工**：

```
const offered = this.#transport.offerChunkMessage(message);
if (!offered.ok) {
  // Transport-owned 失败：Transport 已完成单次 fail-closed（含一次 abort）
  if (!this.#transport.terminalReached) {
    this.notifyProducerAbortOnce(offered.failureCode);
  }
  this.#deps.onFailure?.(offered.failureCode);
  return;
}
```

新增 `RuntimeCaptureTransport.terminalReached` 只读属性供该判断使用。

`#abortNotified` 每次 `sendStart()`（新 capture）重置，保证「每 capture 至多
一次」而非全局一次。

## 2. M-R2-C2 关闭：统一 deadline 边界

### 2.1 原缺陷

纯谓词定义 `elapsedMs === maxCaptureMs` 允许、只有 `>` 才失败；但 timer 用
`remaining = maxCaptureMs - elapsed`，在 elapsed 正好等于 max 时**直接**
`#failClosed()`，**没有调用共享谓词**。

静态门禁以 `exceedsCaptureDurationBound(` 全文件出现次数 `>= 2` 作为证明，
但两次分别是**函数声明**与 enqueue guard，timer body 根本没调用。

### 2.2 修复

- **timer body 实际调用谓词**：

```
this.#deadlineTimer = this.#setTimer(() => {
  this.#deadlineTimer = null;
  if (this.#terminalSettled) return;
  if (this.#state === "finalized" || ... ) return;
  // C2: 与 enqueue guard 共用同一谓词
  if (!exceedsCaptureDurationBound(this.#now() - this.#startedAt)) {
    this.#armCaptureDeadline();   // 边界处重新武装，不 abort
    return;
  }
  this.#failClosed(RELAY_FAILURE_CODES.DURATION_LIMIT);
}, remaining);
```

- **重新武装必须前进**：`remaining = Math.max(1, ...)`。若允许 0，fake clock
  会在同一瞬间反复重排 timer 而**死循环**（这是实现过程中实际触发的一个
  hang，已修复并加静态门禁锁定）。
- **enqueue guard 与 timer 共用谓词**：两者都调用
  `exceedsCaptureDurationBound()`，deadline 起点与判定不会漂移。

### 2.3 静态门禁修正

原门禁用全文件调用次数，会把函数声明误算为 timer 使用。现改为**定位
`#armCaptureDeadline()` 函数体**并断言：

- 函数体内存在 `exceedsCaptureDurationBound(` 调用；
- 函数体内存在 `#armCaptureDeadline(); return;`（边界处重武装而非 abort）；
- 函数体内 `Math.max(1,`（保证前进）。

## 3. C3 关闭：终态与 timer 竞争

### 3.1 原缺陷（两处状态改写）

1. `abort()` **无条件** `#setState("aborted")`；`#settleTerminal()` 虽幂等，
   但状态可被迟到 abort 从 `finalized` 改写为 `aborted`。
2. `#settle()` **无条件** `#setState("finalized")` 才调用幂等的
   `#settleTerminal()`；deadline 在 `cleanup_pending` 结算 `aborted` 后，
   已在等待的 `#finalizeRuntime()` 继续执行 `#settle(null)` 会把状态
   改写为 `finalized`。

### 3.2 修复

- `abort()` 改为**只**走 `#failClosed()`（带全部幂等守卫），
  不再无条件改状态。
- `#settle()` 改为 `if (!this.#terminalSettled) this.#setState("finalized");`
  —— 已被结算的终态不会被迟到 finalize 改写。
- 统一所有 Transport-owned 失败为**单一** `#failClosed()`：
  `#armAckTimeout`、start 失败、start timer、`validateChunkMessage` 拒绝、
  `admitChunk` 拒绝均不再 `#fail()` + `abort/settle` 双调用。

  实现内循环中由 C3 守卫暴露的一个真实回归已修复：
  `#armAckTimeout` 原先 `#fail(PROTOCOL_INVALID)` 后再 `abort(...)`，
  守卫使第二次调用短路，capture 停留在 `capturing` 且 socket 未关 ——
  现改为单次 `#failClosed(PROTOCOL_INVALID)`。

## 4. 三条新增生产 composition 用例

| # | 用例 | 驱动路径 | 断言 |
|---|---|---|---|
| 1 | `cumulative byte overflow via producer.postMessage performs one full closeout` | **`producer.postMessage(chunk)` → 真实 `OffscreenAudioPort` CHUNK 分支** | abort 恰好 1 · 公开 failure 恰好 1 · socket close · terminal `{ok:false,BYTE_LIMIT}` · `markerClears === [SESSION]` |
| 2 | `no-credit is PORT-owned: the producer is still aborted exactly once` | 真实 Port CHUNK 分支（无 start/ready） | abort 恰好 1（`BACKPRESSURE`） |
| 3 | `elapsed === maxCaptureMs stays ACTIVE; +1 ms aborts` | fake clock + 真实 timer | 边界处 `failures` 为空且 state 为 active；+1 ms 后 `DURATION_LIMIT` + `aborted` |
| 4 | `the timer body re-arms at the exact boundary instead of aborting` | 真实 timer 连续三次推进 | max-1 空 · max 空 · max+1 失败 |
| 5 | `a deadline that wins the race keeps aborted against a late finalize` | **真实 `cleanup_pending` + `#finalizeRuntime()` 等待中** | 首次终态 `aborted`；随后迟到 close / completed frame / timer×3 均不改变 state、failure、abort、marker clear |
| 6 | `a late abort() after a successful finalize cannot rewrite finalized` | 成功 finalize 后迟到 abort | state 保持 `finalized` |

用例 1 是 Codex 明确要求的「不得再用 Transport 直调冒充 composition」的替代；
用例 5 覆盖原测试缺失的真实 `cleanup_pending` 竞争。

## 5. 静态门禁（30 → 32）

| 组 | 断言 |
|---|---|
| **M-R2-C1（新增）** | Port 必须暴露 once-guarded `notifyProducerAbortOnce`；含 `if (this.#abortNotified) return;`；Background `onCaptureAbort` **不得**调用裸 `sendAbort` 而必须走 once-guard；Port CHUNK 分支必须在 `!transport.terminalReached` 时才自己 abort |
| **M-R2-C3（新增）** | `abort()` 必须走 `#failClosed` 且不得无条件 `#setState("aborted")`；`#settle()` 必须 `if (!this.#terminalSettled)` 才 setState；全文件不得存在 `#fail(...)` 后紧跟 `abort(...)` 的双收口 |
| R2-5 / C2（更新） | timer **函数体**内必须调用谓词 + 边界重武装 + `Math.max(1,`；enqueue guard 同样使用谓词 |

## 6. 合同变化

- **内部合同变化**：有 ——
  1. `OffscreenAudioPort.notifyProducerAbortOnce()` 成为唯一 producer-abort owner；
  2. `RuntimeCaptureTransport.terminalReached` 只读属性；
  3. `abort()` 改为单一守卫收口；`#settle()` 不再改写已结算终态；
  4. deadline timer body 实际调用共享谓词并以 `Math.max(1, …)` 重武装；
  5. 全部 Transport-owned 失败统一为单一 `#failClosed()`。
- **公共合同变化**：**none**。未修改九消息集合、20/40 inventory、FailureCode
  registry、固定阈值、公共 API、Runtime endpoint、Origin、ticket、Cookie/provider。

## 7. 冻结合同核验

R2 最终纠偏只修改 **target（relay 实现）** 文件
（`RuntimeCaptureTransport.ts`、`OffscreenAudioPort.ts`、`background/index.ts`）
与测试 / 静态门禁，**未修改任何冻结 source scope 文件**：

```
verify-…-v10-contract.py  → exit 0, 50/50, inventory 40/40, unlisted {}
verify-…-v10-mutations.py → exit 0, 15/15
```

**未触发重冻结需求。**

## 8. 严重度

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | M-R2-C1 与 M-R2-C2（含 C3 终态竞争）关闭 |
| Minor | 0 | — |
| 待重冻结 | **0** | 50/50 + 15/15 保持绿 |

## 9. 停止点

R2 最终合并纠偏完成。状态 **R2 FINAL CORRECTION AWAITING CODEX CHECKPOINT**，
停止等待 Codex；不进入 R3，不宣布 R2 PASS。
