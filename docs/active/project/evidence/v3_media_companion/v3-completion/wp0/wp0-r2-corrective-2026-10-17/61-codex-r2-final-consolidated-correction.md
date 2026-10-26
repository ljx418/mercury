# WP0 R2 最终合并纠偏交接

日期：2026-10-17  
授权边界：仅关闭 `M-R2-C1`、`M-R2-C2`；不得进入 R3

## 1. 实施目标

### C1：单一 producer-abort owner

统一 Transport-owned 与 Port-owned failure 的收口职责：

- Transport 检测到 schema/sequence/capture bound/admission failure 时，走唯一 fail-closed
  路径，producer abort、Runtime close、failure report、terminal、marker 各至多一次。
- Port 在 Transport 已完成 fail-closed 后不得再次发送 abort。
- Port 自己检测到的 no-credit、非法 Port message、producer `capture_error` 仍必须通过一个
  明确的 Port-owned helper 通知 producer 一次并要求 Transport abort，不得静默。
- 不新增第二 control plane，不改变九消息集合。

### C2：统一 deadline boundary

保留当前文档定义：`elapsed === maxCaptureMs` 仍允许，`elapsed > maxCaptureMs` 才失败。
timer callback 必须实际调用 `exceedsCaptureDurationBound()`；如果回调发生在 exact max，
应重新武装最小剩余时间，而不是直接 abort。enqueue guard 与 timer 使用同一谓词。

静态门禁必须检查 `#armCaptureDeadline()` 函数体内存在谓词调用，不能再用全文件调用次数
把函数声明误算为 timer 使用。

### C3：终态与 timer 收口

- deadline 与 `cleanup_pending/#finalizeRuntime` 竞争时，较早结算的 terminal 胜出。
- 迟到的 socket close、Runtime frame 或 finalize timer 不得改写 `aborted/failed/finalized`
  终态，不得重发 failure、abort 或 marker clear。
- fail-closed 必须同步或确定性清除 deadline、ACK、start、finalize timer；异步 close event
  不能成为唯一清理保证。

## 2. 必须新增/修正的三组生产测试

1. **真实 Port byte overflow**：通过 `producer.postMessage(chunk)` 进入
   `OffscreenAudioPort` CHUNK 分支，填满测试 seam 后 one-sample-over；断言 producer abort
   恰好 1、failure 恰好 1、socket close、terminal 固定 code、marker clear 恰好 1。
2. **deadline exact boundary**：fake clock 到 `maxCaptureMs` 时仍 active；再推进 1 ms 才
   `DURATION_LIMIT`。同时断言 timer body 与 enqueue guard 实际共用谓词。
3. **deadline vs finalize**：进入真实 `cleanup_pending` 并令 `#finalizeRuntime()` 等待，随后
   deadline 失败；再触发迟到 close/frame/finalize timer，状态必须保持首次终态，所有副作用
   各至多一次。

不得再用 Transport 直调测试冒充 Port composition。纯函数测试可以保留，但只能证明数值
算法，不能单独证明生产接线。

## 3. 验收分层

实现内循环只跑上述受影响测试。实现完成后只集中执行一次：

```text
cd /mnt/c/workspace/navia/apps/chrome-extension
npm run typecheck
npx vitest run src/modules/media_companion/tests/ --maxWorkers=2
npx vitest run --maxWorkers=2
npm run build

cd /mnt/c/workspace/navia
node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs
cd services/local-runtime
.venv/bin/pytest tests/test_wp0_r1_relay_barrier.py -q
.venv/bin/pytest -k "capture or transcript or outline or fault or product" -q

cd /mnt/c/workspace/navia
python3 -B docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v10-contract.py
python3 -B docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v10-mutations.py
```

门槛：全部 exit 0，baseline `50/50`，mutations `15/15`。

## 4. 禁止范围

- 不进入 R3，不做文档外审或阶段 closeout。
- 不修改公共 API、Runtime endpoint、九消息集合、20/40 inventory、固定阈值。
- 不修改或重冻结 schema/fixture/registry；如确有必要立即停止。
- 不启动 Chrome、Provider、六视频；不得播放声音。
- 不 commit/push/reset/clean/checkout/revert，不覆盖 dirty worktree。
- 不写入 Cookie、API key、token、原始媒体或绝对私有路径。

## 5. 交付与停止

新建：

```text
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
  wp0-r2-final-correction-2026-10-17/
```

落盘 receipt、test results、PRD review、handoff、manifest。状态写：

```text
R2 FINAL CORRECTION AWAITING CODEX CHECKPOINT
```

完成后停止。不得宣布 R2 PASS，不得进入 R3。

## 6. ClaudeCode 提示词

```text
在 /mnt/c/workspace/navia 执行 WP0 R2 最终合并纠偏，仅关闭 M-R2-C1、
M-R2-C2，不进入 R3。

先读 AGENTS.md、project-stage-workflow.md §5.1，以及：
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
wp0-r2-corrective-2026-10-17/60-codex-r2-corrective-checkpoint.md
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
wp0-r2-corrective-2026-10-17/61-codex-r2-final-consolidated-correction.md

修复真实 Port 入站重复 producer abort：确定单一 abort owner，Transport-owned 与
Port-owned failure 都必须 producer abort/report/terminal/marker 各至多一次。新增通过
producer.postMessage(chunk) 驱动真实 OffscreenAudioPort CHUNK 分支的累计字节越界测试，
不得再用 Transport 直调冒充 composition。

统一 deadline exact boundary：elapsed == max 允许，max+1 才失败；timer body 必须实际调用
exceedsCaptureDurationBound，静态门禁不得以全文件调用次数误算函数声明。补 deadline 与真实
cleanup_pending/#finalizeRuntime 竞争测试，迟到 close/frame/timer 不得把 aborted 改写为
finalized，全部 timer 和副作用各至多一次。

实现内循环只跑定向测试；完成后按交接文档 §3 只执行一次集中回归。不得外审、不得启动
Chrome/Provider/六视频、不得播放声音、不得改冻结材料或公共合同、不得
commit/push/reset/clean。证据写入 wp0-r2-final-correction-2026-10-17，最终状态写
R2 FINAL CORRECTION AWAITING CODEX CHECKPOINT，然后停止，不得进入 R3。
```

