# WP0 R2 最终 Codex Checkpoint

日期：2026-10-17  
候选：`wp0-r2-final-correction-2026-10-17`  
决定：**R2 PASS / R3 MAY START**

## 1. 审查边界

本次仅按 `project-stage-workflow.md` §5.1 执行一次最终 checkpoint，复核上一轮要求的
三个生产行为，不重复 R2 文档外审、全量回归或阶段 closeout：

1. `OffscreenAudioPort` 是 producer abort 的唯一发送 owner；
2. deadline 使用共享 duration predicate，精确边界允许、one-over 拒绝；
3. 已结算 terminal 不被迟到 finalize/abort 改写。

未运行 Chrome、Provider、六视频或真实产品链路，未播放声音。

## 2. 独立复核结果

- 证据 manifest：`4/4` SHA-256 一致。
- 变更文件 SHA-256 与 `40-handoff.md` 一致：`5/5`。
- 定向行为测试：`RelayR2Invariants.test.ts`，`46/46 PASS`，exit `0`。
- 静态补充门禁：`relay_ownership_contract.node-test.mjs`，`32/32 PASS`，exit `0`。
- M-R2-C1：真实 `producer.postMessage(chunk)` 进入 Port CHUNK 分支；Transport-owned
  overflow 只经 `notifyProducerAbortOnce()` 发送一次 abort，并断言单 failure、socket close、
  failure terminal、marker 单次清理。
- M-R2-C2：timer body 直接调用 `exceedsCaptureDurationBound()`；`elapsed === max` 重武装，
  `elapsed === max + 1` 才 fail-closed。
- C3：`abort()` 统一进入 `#failClosed()`；`#settle()` 只在 terminal 未结算时写
  `finalized`，真实 `cleanup_pending` 竞争用例保持先到的 `aborted`。

ClaudeCode 报告的一次集中回归结果及 v10 `50/50 + 15/15` 已在候选证据中落盘；本次
checkpoint 不再次运行这些已覆盖命令。

## 3. Findings

### Fatal / Major

无。

### Minor M-R2-FINAL-01：abort once 复位说明与代码位置不一致

`40-handoff.md` 写 `#abortNotified` 依赖 `sendStart()` 重置；实际代码只在
`OffscreenAudioPort.accept()` 成功时重置。当前 Controller 的 `stop()` finally 会调用
`relay.disconnect()` 并关闭 Offscreen document，因此现行主链以“每轮新 Port accept”实现
每 capture 复位，不影响 R2 出门。

该事实必须在 R3 的双轮生命周期 composition 中锁定：每轮 idle/error 均关闭旧 Port 和
Offscreen；第二轮建立新 Port 后仍能恰好发送一次 abort。若 R3 决定复用 Port，则必须在
新的 capture start 边界显式复位，并证明旧 session 消息不能进入新 capture。

## 4. 门禁决定

- Fatal：`0`
- Major：`0`
- Minor：`1`
- 待重冻结：`0`
- 公共合同变化：`none`
- **R2：PASS**
- **R3：可以按 `61-codex-r3-development-and-acceptance.md` 开始实施**

R2 到此关闭，不再进行 R2 文档外审或重复回归。R3 完成后只执行一次 R3 checkpoint；
R4、真实 Chrome、Provider、六视频仍未获本文件放行。

