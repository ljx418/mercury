# WP0 R2 限定纠偏 测试结果（2026-10-17）

Candidate: `wp0-r2-corrective-2026-10-17`
状态：**R2 CORRECTIVE AWAITING CODEX CHECKPOINT**

## 1. 固定回归：全部命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | 0 | PASS |
| 2 | `npx vitest run src/modules/media_companion/tests/ --maxWorkers=2` | 0 | **206 / 206**（22 files） |
| 3 | `npx vitest run --maxWorkers=2` | 0 | **539 / 539**（66 files） |
| 4 | `npm run build` | 0 | PASS（Σ 4.66 MB） |
| 5 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | 0 | **30 / 30** |
| 6 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | **6 / 6** |
| 7 | `pytest -k "capture or transcript or outline or fault or product" -q` | 0 | **180 passed** / 537 deselected |
| 8 | `python3 -B …/verify-…-v10-contract.py` | **0** | **50 / 50**（sourceInventoryDiff 40/40，unlisted `{}`） |
| 9 | `python3 -B …/verify-…-v10-mutations.py` | **0** | **15 / 15** |

**门槛满足：所有命令 exit 0，v10 baseline 50/50，mutation 15/15。**

## 2. M-R2-01 主动 deadline 验证（fake clock，零后续 chunk）

| 用例 | 断言 | 结果 |
|---|---|---|
| `the owner deadline self-fires with NO further chunk` | 推进至 `maxCaptureMs - 1` 仍 `runtime_started`（无 DURATION_LIMIT）；再推进 2ms → **主动** `DURATION_LIMIT` + state `aborted` | PASS |
| `the deadline notifies the producer and closes the Runtime socket` | producer 收到**恰好 1 个** `abort`，`failureCode = DURATION_LIMIT`；socket `readyState === 3` | PASS |
| `the deadline races a user stop and still settles once` | 竞争后 `DURATION_LIMIT` 失败计数**恰好 1** | PASS |
| `the deadline races a Runtime disconnect and still settles once` | disconnect 已失败关闭后，deadline **不再产生** 第二次 `DURATION_LIMIT`（计数 0） | PASS |
| `the deadline timer is cleared on success, cancel and abort` | 三条路径后推进 `maxCaptureMs × 2`，`failures` 均为空（无二次失败） | PASS |
| `the duration boundary has a single definition` | `maxCaptureMs - 1` / `maxCaptureMs` 允许，`maxCaptureMs + 1` 拒绝 | PASS |
| `the deadline origin equals startedAt and the marker expiry origin` | marker `startedAt === clock.now`；`expiresAt - startedAt === markerTtlMs` | PASS |

## 3. M-R2-02 累计字节边界验证（低资源，无 512 MiB 分配）

| 用例 | 断言 | 结果 |
|---|---|---|
| 冻结值 | `maxCaptureBytes === 536_870_912` | PASS |
| `ALLOWS current + next === maxCaptureBytes exactly` | `current = max-1000, next = 1000` 允许；`next + 2` 拒绝 | PASS |
| `ALLOWS 0 + max and REFUSES 0 + max + 1` | `0 + max` 允许；`0 + max + 1` 拒绝 | PASS |
| `uses the frozen default and never widens it` | 默认走 `RELAY_V10`；显式 override 证明 seam 真实生效 | PASS |
| `refuses before enqueue, sequence and counters change` | seam = 640：两 chunk 累计恰为 640；第三块 322 字节 → `BYTE_LIMIT`；拒绝后 `backlog.sequence` / `totalRawBytes` / `backlog.chunks` / `capturedMs` **四项全部不变**；`BYTE_LIMIT` 失败**恰好 1 次** | PASS |

## 3.1 强制要求 §四.7 / §三.5-3.7：完整 fail-closed 收口

| 用例 | producer abort | Runtime close | terminal | marker clear | 失败次数 |
|---|---|---|---|---|---|
| `M-R2-01: the deadline notifies the producer and closes the Runtime socket` | 恰好 1 个 `abort` | `readyState === 3` | `{ok:false, DURATION_LIMIT}` | `markerClears === [SESSION]` | 1 |
| **`M-R2-02: cumulative byte cap performs the full fail-closed closeout`** | 恰好 1 个 `abort`（`BYTE_LIMIT`） | `readyState === 3` | `{ok:false, BYTE_LIMIT}` | `markerClears === [SESSION]` | 1 |
| `M-R2-01: no second callback after the terminal settles` | 快照后推进 clock × 10，`failures` / abort 数 / `markerClears` / `readyState` **四项全部不变** | | | | |

harness 已把 `onMarker` / `clearMarker` 变为**可观测**，并镜像生产接线
（Port owner 的 `onFailure` → `transport.abort()`），因此这些断言是
**行为证明**而非字符串搜索。

## 4. 三类上限的独立证明（不混用）

| 上限 | 冻结值 | 证明用例 | 结果 |
|---|---|---|---|
| outstanding queue **chunk** cap | 32 | `aborts at the 33rd outstanding chunk` / `admitChunk admits the exact boundary and refuses one past it`（32 允许、33 拒绝） | PASS |
| outstanding queue **raw-byte** cap | 1,572,864 | `aborts at the byte cap, before enqueue`（`admitChunk` 小对象） | PASS |
| whole-capture **cumulative byte** cap | 536,870,912 | §3 四个 exact-boundary 用例 + 污染证明 | PASS |
| whole-capture **wall-clock deadline** | 900,000 | §2 主动 deadline 用例（无需后续 chunk） | PASS |

**false-green 用例 `enforces the frozen capture byte bound at the owner` 已删除**，
不再用 32-chunk 背压冒充累计字节证明。

## 5. 静态门禁（30 例）

| 组 | 断言 |
|---|---|
| R2-5（更新） | 累计字节与时长边界必须是**纯谓词** `exceedsCaptureByteBound` / `exceedsCaptureDurationBound`；两个谓词各被**至少 2 处**调用（timer 与 enqueue 守卫共享）；两个检查均早于 `#queue.push`；使用冻结 `BYTE_LIMIT` / `DURATION_LIMIT` 码 |
| **R2 corrective C1（新增）** | owner 必须持有 `#deadlineTimer` / `#armCaptureDeadline` / `#clearCaptureDeadline`；deadline 必须由 `#startedAt` 派生；自触发回调必须依次执行 `DURATION_LIMIT` → `onCaptureAbort` → `#closeSocket()` → `#settleTerminal`；已有失败时不得二次上报（`if (this.#failure) return;`）；`#clearCaptureDeadline()` 至少 4 处（arm / close / settle / reset） |
| **R2 corrective C2（新增）** | outstanding 上限（`maxOutstandingChunks` / `maxOutstandingRawBytes`）在 `audioChunk.ts`；累计上限用 **running total**（`#totalRawBytes`）而非 queue length；测试 seam 默认值必须为 `RELAY_V10.maxCaptureBytes` |

## 6. Chrome / Provider / 六视频 / 声音

| 项 | 次数 |
|---|---:|
| Chrome 启动 | **0** |
| Provider 请求 | **0** |
| 六视频 fresh run | **0** |
| 真实产品 run | **0** |
| 声音播放 | **0** |

本轮纠偏不需要浏览器，因此未触发「先通知用户并强制 `--mute-audio`」
的前置条件。

## 7. secret / raw-media / private-path scan

- 无 Cookie / API key / 凭据 / 原始音视频 / 绝对私有路径进入源码或证据。
- `onCaptureAbort` 只传固定归一化失败码（`DURATION_LIMIT` /
  `BYTE_LIMIT`），不传任何原始异常文本。
- 测试 seam 仅接受数值，不接受任何字符串或凭据。
- 全部测试使用 `os.tmpdir()` / `tmp_path` 沙箱并在结束时清理。
- 结束前无遗留测试进程。
