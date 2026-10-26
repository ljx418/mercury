# WP0 R2 最终合并纠偏 测试结果（2026-10-17）

Candidate: `wp0-r2-final-correction-2026-10-17`
状态：**R2 FINAL CORRECTION AWAITING CODEX CHECKPOINT**

## 1. 验收分层执行记录（§5.1A）

本轮严格按分层执行，未重复跑全量：

| 层 | 动作 | 次数 |
|---|---|---:|
| 实现内循环 | 仅跑受影响定向 Vitest | 多次（每次修改只跑受影响文件） |
| 子阶段 checkpoint | 一次集中回归（§1.2） | **1** |
| 阶段 closeout | **未执行**（纠偏轮不触发） | 0 |

无文档外审、无阶段 closeout、无 immutable candidate 重打。

## 2. 集中回归（`61-…-correction.md` §3）— 全部命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | 0 | PASS |
| 2 | `npx vitest run src/modules/media_companion/tests/ --maxWorkers=2` | 0 | **212 / 212**（22 files） |
| 3 | `npx vitest run --maxWorkers=2` | 0 | **545 / 545**（66 files） |
| 4 | `npm run build` | 0 | PASS（Σ 4.66 MB） |
| 5 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | 0 | **32 / 32** |
| 6 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | **6 / 6** |
| 7 | `pytest -k "capture or transcript or outline or fault or product" -q` | 0 | **180 passed** / 537 deselected |
| 8 | `python3 -B …/verify-…-v10-contract.py` | **0** | **50 / 50**（inventory 40/40，unlisted `{}`） |
| 9 | `python3 -B …/verify-…-v10-mutations.py` | **0** | **15 / 15** |

**门槛满足：全部 exit 0，baseline 50/50，mutations 15/15。**

## 3. M-R2-C1 证据：单一 producer-abort owner

| 用例 | 驱动 | 断言 | 结果 |
|---|---|---|---|
| `cumulative byte overflow via producer.postMessage performs one full closeout` | **`producer.postMessage(chunk)` → 真实 `OffscreenAudioPort` CHUNK 分支**（seam 640） | abort **恰好 1**（`BYTE_LIMIT`）· 公开 failure **恰好 1** · `socket.readyState === 3` · terminal `{ok:false,BYTE_LIMIT}` · `markerClears === [SESSION]` | PASS |
| `no-credit is PORT-owned: the producer is still aborted exactly once` | 真实 Port CHUNK 分支（无 start/ready） | abort **恰好 1**（`BACKPRESSURE`） | PASS |

**关键**：上述两条**不再**直接调用 `transport.offerChunkMessage()`，而是
`producer.postMessage(chunk)` 进入真实 Port 入站分支 —— 修复 Codex 指出的
「Transport 直调冒充 composition」。

harness 同步镜像生产接线：Transport 的 `onCaptureAbort` 走
`port.notifyProducerAbortOnce`（once-guard），Port owner 的 `onFailure`
调 `transport.abort()`；`reportFailure`（公开失败报告）与 Port `onFailure`
（Port→Transport 请求）**分列为两个通道**，只有前者计入「失败上报一次」。

## 4. M-R2-C2 证据：deadline exact boundary

| 用例 | 断言 | 结果 |
|---|---|---|
| `elapsed === maxCaptureMs stays ACTIVE; +1 ms aborts` | 推进到 `maxCaptureMs` → 无 `DURATION_LIMIT`、state active；再推进 1 ms → `DURATION_LIMIT` + `aborted` | PASS |
| `the timer body re-arms at the exact boundary instead of aborting` | 连续三次推进：max−1 空 · max 空 · max+1 失败 | PASS |
| 静态门禁 | `#armCaptureDeadline()` **函数体内**必须含 `exceedsCaptureDurationBound(`、`#armCaptureDeadline(); return;`、`Math.max(1,` | PASS |

**实现过程中发现并修复的真实 hang**：重新武装时若允许 `remaining = 0`，
fake clock 会在同一瞬间反复重排 timer 而死循环（`RelayR2Invariants` 当时
表现为 vitest pool worker 无响应 / 测试挂起）。已改为
`Math.max(1, …)` 保证前进，并由静态门禁锁定。

## 5. C3 证据：终态与 timer 竞争

| 用例 | 断言 | 结果 |
|---|---|---|
| `a deadline that wins the race keeps aborted against a late finalize` | 进入**真实 `cleanup_pending`**（stop + markQuiesced + markOffscreenStopped）→ 令 `#finalizeRuntime()` 等待 → 推进 clock 使 deadline 结算 `aborted` → 随后**迟到** socket close / completed frame / timer×3：state 仍 `aborted`，failure / abort / marker clear **四项计数全部不变** | PASS |
| `a late abort() after a successful finalize cannot rewrite finalized` | 成功 finalize 后调用 `abort()` → state 仍 `finalized` | PASS |
| 静态门禁 | `abort()` 必须走 `#failClosed` 且不得无条件 `#setState("aborted")`；`#settle()` 必须 `if (!this.#terminalSettled)`；全文件不得有 `#fail(...)` 后紧跟 `abort(...)` | PASS |

**实现过程中由 C3 守卫暴露的真实回归**：`#armAckTimeout` 原先
`#fail(PROTOCOL_INVALID)` 后再 `abort(...)`；守卫使第二次调用短路，capture
停留在 `capturing` 且 socket 未关。已统一为单次
`#failClosed(PROTOCOL_INVALID)`，并同样修正 start 失败、start timer、
`validateChunkMessage` 拒绝、`admitChunk` 拒绝共 5 处双收口。

## 6. 计数汇总

| 类别 | 计数 |
|---|---:|
| `RelayR2Invariants.test.ts` | **46**（原 40，增 6） |
| 静态所有权合同 | **32**（原 30，增 2：C1 / C3；另改写 C2 timer-body 门禁） |
| media_companion 子树 | **212**（22 files） |
| 扩展全量 | **545**（66 files） |
| Runtime barrier | 6 |
| Runtime focused | 180 |
| v10 baseline / mutation | **50 / 50** · **15 / 15** |

## 7. Chrome / Provider / 六视频 / 声音

| 项 | 次数 |
|---|---:|
| Chrome 启动 | **0** |
| Provider 请求 | **0** |
| 六视频 fresh run | **0** |
| 真实产品 run | **0** |
| 声音播放 | **0** |
| 可见 Chrome / 原生弹窗 / 焦点抢占 / UIAutomation | **0** |

本轮不需浏览器，未触发通知前置条件。

## 8. secret scan 与遗留进程

- 无 Cookie / API key / token / 原始媒体 / 绝对私有路径进入源码或证据。
- `notifyProducerAbortOnce` 只传固定归一化码，不传原始异常文本。
- 全部测试使用 `os.tmpdir()` / `tmp_path` 沙箱并在结束时清理。
- navia 自身遗留测试进程：**0**。

## 9. 资源事实

本轮未出现 ENOMEM / pool-runner 超时导致的产品失败；所有失败均为行为断言
失败并已定位修复（`ackTimer` 收口、deadline 重武装死循环、abort 双重上报）。
