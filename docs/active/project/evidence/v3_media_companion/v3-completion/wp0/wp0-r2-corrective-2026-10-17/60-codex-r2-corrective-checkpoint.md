# WP0 R2 Corrective Codex Checkpoint

日期：2026-10-17  
候选：`wp0-r2-corrective-2026-10-17`  
决定：**R2 NO-GO / FINAL CONSOLIDATED CORRECTION REQUIRED**

## 1. 单次 checkpoint 结论

本次按 `project-stage-workflow.md` §5.1 只执行一次实现 checkpoint，没有重新进行文档
外审或阶段 closeout。证据 manifest 4/4 一致，变更文件哈希与 handoff 一致；既有定向测试
`40/40`、静态门禁 `30/30` 可重复通过。

M-R2-01 的主动 timer 和 M-R2-02 的低资源数值边界已经进入产品代码，但现有测试仍绕过
真实 Port 入站分支，并且 deadline 的 exact-boundary 与 finalize 竞争没有闭合。因此：

- Fatal：0
- Major：2
- Minor：0
- R3：不得启动

## 2. 本次汇总的全部 Findings

### M-R2-C1：真实 Port 入站会重复发送 producer abort

`RuntimeCaptureTransport.offerChunkMessage()` 在累计字节/时长越界时调用
`#failClosed()`；该方法通过 `onCaptureAbort` 已发送一次 `abort`。随后真实
`OffscreenAudioPort` 的 CHUNK 分支收到 `{ok:false}`，再次执行 `sendAbort()`，再调用
`onFailure -> transport.abort()`。

所以真实生产路径是：

```text
producer Port chunk
  -> transport.offerChunkMessage
  -> transport.#failClosed -> onCaptureAbort -> abort #1
  -> OffscreenAudioPort offered !ok -> sendAbort -> abort #2
```

当前 byte-cap 测试直接调用 `relay.transport.offerChunkMessage()`，没有通过
`relay.producer().postMessage()` 进入真实 Port CHUNK 分支，因此“producer 恰好收到一次
abort”的断言不能证明生产行为。

定位：

- `RuntimeCaptureTransport.ts:414-426`
- `OffscreenAudioPort.ts:294-304`
- `RelayR2Invariants.test.ts:789-819`

这是 owner 分工和 composition 证据缺口，必须确定单一 abort owner。Transport-owned
failure 与 Port-owned failure 都必须恰好通知 producer 一次、报告一次、settle 一次。

### M-R2-C2：deadline 的“单一定义”与终态竞争仍是假绿

#### A. exact boundary 不一致

纯谓词规定 `elapsedMs === maxCaptureMs` 允许、只有 `>` 才失败；但 deadline timer 使用
`remaining = maxCaptureMs - elapsed`，在 elapsed 正好等于 max 时直接调用 `#failClosed()`，
没有调用共享谓词。

静态门禁以 `exceedsCaptureDurationBound(` 出现次数 `>= 2` 作为“timer 和 enqueue 共用”
证明，但两次分别是函数声明和 enqueue guard；timer body 没有调用该谓词。

#### B. finalize 竞争可覆盖已结算终态

deadline 在 `cleanup_pending` 时仍可调用 `#failClosed()` 并 settle `aborted`。与此同时已经
等待中的 `#finalizeRuntime()` 在 socket close 或 finalize timer 完成后继续执行
`#settle(null)`；`#settle()` 会先无条件 `#setState("finalized")`，才调用已具幂等守卫的
`#settleTerminal()`。结果是 terminal 不重复，但状态可从 `aborted` 被迟到 finalize 改写为
`finalized`。

现有竞争测试只调用 `beginStop()`，没有 `markQuiesced()`、`markOffscreenStopped()` 并进入
真实 `cleanup_pending`/`#finalizeRuntime()`，所以没有覆盖该竞态。

定位：

- `RuntimeCaptureTransport.ts:390-398`
- `RuntimeCaptureTransport.ts:685-731`
- `RuntimeCaptureTransport.ts:800-836`
- `relay_ownership_contract.node-test.mjs:289-294`
- `RelayR2Invariants.test.ts:604-628`

## 3. 已接受的事实

以下内容不再要求重做：

1. `#deadlineTimer` 为 Background owner 单一 timer，起点与 marker `startedAt` 同源。
2. `exceedsCaptureByteBound()` 的数值算法满足 equal allowed / one-over rejected。
3. 拒绝发生在 enqueue、sequence 和 counters 之前。
4. v10 冻结材料无需重冻结；公共 API、消息集合、FailureCode 和阈值未变化。
5. R1、R2 其余 sender/PCM/sequence/credit/backpressure/restart 结论保持，不重复验收。

## 4. 下一门禁

执行 `61-codex-r2-final-consolidated-correction.md`。只需完成一次定向实现和一次集中回归。
完成后 Codex 复核新增的三条关键生产 composition 用例；若通过且无新 Fatal/Major，直接
判定 `R2 PASS / R3 may enter planning`，不再发起 R2 文档外审。

