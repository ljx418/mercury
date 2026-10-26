# WP0 R2 Codex Checkpoint Review

日期：2026-10-17  
审查对象：`wp0-r2-2026-10-17`  
决定：**R2 NO-GO / R3 MUST NOT START**

## 1. 结论

R2 的 sender、PCM/Base64、sequence、credit/ACK、bounded queue、disconnect、
stop boundary 与 session 隔离实现未发现新增 Fatal。R1 的 v10 冻结证据仍为
`50/50`，R2 定向测试与静态门禁也能通过。

但本轮新增的“采集总时长/总字节上限已完整强制并验证”结论不能成立：

- Fatal：0
- Major：2
- Minor：0

在两个 Major 关闭前，不接受 `R2 PASS`，不得进入 R3。

## 2. Findings

### M-R2-01：`maxCaptureMs` 不是主动截止，只在下一音频块到达时检查

`RuntimeCaptureTransport.offerChunkMessage()` 才读取
`now() - startedAt > maxCaptureMs`。Transport 没有采集总时长 timer；如果音频源静默、
producer 卡住或不再发送 chunk，任务可以在 900,000 ms 后继续保持 active，直到另一个
chunk 或其他外部事件到达。

这不是“最大采集时长由 owner 强制执行”，也不能满足 timeout 后确定收口、关闭 Runtime
socket、通知 producer、settle terminal 和清理 restart marker 的要求。

定位：

- `apps/chrome-extension/src/modules/media_companion/capture/RuntimeCaptureTransport.ts:413`
- `apps/chrome-extension/src/modules/media_companion/capture/RuntimeCaptureTransport.ts:322`
- `apps/chrome-extension/src/modules/media_companion/tests/RelayR2Invariants.test.ts:538`

现有测试必须先发送“超时后的下一块”才得到 `DURATION_LIMIT`，因此没有覆盖静默超时。

### M-R2-02：累计 512 MiB 测试未触达累计上限，证据属于 false green

名为 `enforces the frozen capture byte bound at the owner` 的测试只循环 40 次。由于没有
Runtime ACK，第 33 个 chunk 已先触发 outstanding queue 的 `BACKPRESSURE`；测试随后只断言
`maxCaptureBytes === 536_870_912` 和返回值是 object，并未断言：

- 累计值等于上限时仍允许；
- 再多一个 sample 时返回 `V3_MEDIA_CAPTURE_BYTE_LIMIT`；
- 被拒 chunk 未进入 queue、未增加 sequence/byte counters；
- producer 收到 abort；
- Runtime socket/terminal/restart marker 完成失败收口。

定位：

- `apps/chrome-extension/src/modules/media_companion/tests/RelayR2Invariants.test.ts:519`
- `apps/chrome-extension/src/modules/media_companion/capture/RuntimeCaptureTransport.ts:408`
- `scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs:278`

产品代码中的累计加法表面上合理，但静态字符串检查不能替代行为测试；R2 receipt 中“单元
测试 + 静态门禁双重锁定”的声明需要撤回并重做。

## 3. 已独立复算

| 检查 | 结果 |
|---|---|
| R2 evidence manifest | 4/4 SHA-256 一致 |
| `RelayR2Invariants.test.ts` | 28/28，exit 0 |
| relay ownership static gate | 28/28，exit 0 |
| v10 baseline verifier | 50/50，exit 0 |

这些通过结果证明当前测试可重复，不证明两个缺失场景已覆盖。

## 4. 接受的实现事实

1. `#totalRawBytes` 在 accepted chunk 入队前检查，并仅在接受后累加。
2. production Port 路径在 `offerChunkMessage()` 返回失败后发送 producer abort，随后由
   Background `onFailure` 调用 `RuntimeCaptureTransport.abort()`。
3. 因此不把 `#fail()` 本身不关闭 socket 单独列为缺陷；需要补的是主动 deadline 和真实
   composition 证据。
4. 本轮未改变 v10 inventory、公共 API、Runtime endpoint、Cookie/provider 或用户体验合同。

## 5. 冻结与边界

当前不需要重冻结 v10 schema、fixture、FailureCode registry 或 source scope。纠偏应复用：

- `V3_MEDIA_CAPTURE_DURATION_LIMIT`
- `V3_MEDIA_CAPTURE_BYTE_LIMIT`
- `maxCaptureMs: 900_000`
- `maxCaptureBytes: 536_870_912`

若纠偏必须改变这些固定值、公共 API、消息集合或 inventory，立即停止并返回 Codex。

## 6. 下一门禁

执行 `61-codex-r2-corrective-development-and-acceptance.md`。只有在：

1. 静默状态到达 deadline 能主动 fail closed；
2. 累计字节 exact-boundary / one-sample-over 行为被低资源动态测试证明；
3. producer abort、Runtime close、terminal settle、marker cleanup 被 composition test 证明；
4. 全部固定回归与 v10 `50/50 + 15/15` 继续通过；

之后，Codex 才可重新判定 `R2 PASS / R3 may start`。

