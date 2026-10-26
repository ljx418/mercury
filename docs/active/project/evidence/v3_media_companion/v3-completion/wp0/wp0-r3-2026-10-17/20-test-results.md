# WP0 R3 测试结果（2026-10-17）

Candidate: `wp0-r3-2026-10-17`
状态：**R3 AWAITING CODEX CHECKPOINT**

## 1. 验收分层执行记录（§5.1A）

| 层 | 动作 | 次数 |
|---|---|---:|
| 实现内循环 | 仅跑受影响定向 Vitest / 单个静态门禁 | 多次（每次修改只跑受影响文件） |
| 子阶段 checkpoint | 一次集中回归（61 §4，共 9 项） | **1** |
| 阶段 closeout | **未执行** | 0 |

无文档外审、无阶段 closeout、无 immutable candidate 重打。

## 2. 集中回归（61 §4）— 全部命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | **0** | PASS |
| 2 | `npx vitest run src/modules/media_companion/tests/ --maxWorkers=2` | **0** | **229 / 229**（23 files） |
| 3 | `npx vitest run --maxWorkers=2` | **0** | **562 / 562**（67 files） |
| 4 | `npm run build` | **0** | PASS（Σ 4.66 MB） |
| 5 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | **0** | **42 / 42** |
| 6 | `python3 -m pytest tests/test_wp0_r1_relay_barrier.py -q` | **0** | **6 / 6** |
| 7 | `python3 -m pytest -k "capture or transcript or outline or fault or product" -q` | **0** | **180 passed** / 605 deselected |
| 8 | `python3 -B …/verify-…-v10-contract.py` | **2** | **46 / 50** ← 阻塞 |
| 9 | `python3 -B …/verify-…-v10-mutations.py` | **2** | 随第 8 项级联 |

**门槛未满足：第 8/9 项 exit 非 0。**

### 2.1 第 8 项失败的可归类性（61 §5 要求「verifier 退化必须能归类」）

失败检查四项：

```
sourceEvidenceHashesCurrent          ← 唯一真实失败
sourceScopeExtractorsValid           ┐
sourceEmitSetEqualsFrozenInventory   ├ 全部由第 1 项级联
discoveredCodeUniverseClosed         ┘
```

`sourceInventoryDiff.missing` 报告 5 个 Controller 失败码「消失」，但这是 verifier
在摘要不匹配时 `continue` 跳过该文件抽取造成的**假象**。用冻结抽取器
（`typescript_compiler_ast_boundary_values`，逐字取自 verifier）单独跑本轮修改后的
`MediaCaptureController.ts`，仍得到全部 8 个码：

```
V3_MEDIA_CAPTURE_ALREADY_ACTIVE / BACKGROUND_FORBIDDEN / BINDING_MISMATCH
V3_MEDIA_CAPTURE_PERMISSION_REQUIRED / PREPARE_FAILED / PREPARE_REQUIRED
V3_MEDIA_CAPTURE_START_FAILED / TAB_INVALID
```

即：**失败码集合未变，变的只有文件字节**。

根因：fixture 的 `sourceInventoryEvidence.scopes[]` 以 SHA-256 冻结了
`MediaCaptureController.ts`：

| | 摘要 |
|---|---|
| 冻结 | `b344caf3be26a2264867ce0453d6dddbffed06adb02746d58136429600d71888` |
| 当前 | `325d0b59fbd20072689c2cb7bcd46cb53ad1564c4cd6f36a6edbc4acb7f8991c` |

R3 为关闭 R3-1 的「第二 owner」缺陷必须修改该文件（见 `10-receipt.md` §1.1）。
本轮**未**修改 fixture / schema / inventory / 阈值 / 公共合同，是否重冻结由 Codex 决策。

## 3. R3 新增生产 composition（17 例，全绿）

驱动链为真实生产类：`MediaCaptureController` · `MediaCaptureMessageRouter` ·
`RuntimeCaptureTransport` · `OffscreenAudioPort` · `bootstrapOffscreenProducerPort`，
relay facade 与 `entrypoints/background/index.ts` 逐行一致。仅替换浏览器/网络原语。

| 组 | 用例 | 关键 oracle |
|---|---|---|
| **R3-5** | 冻结 24 步 positive trace 逐步复现（直接 import fixture JSON，按 `step`/`requiredState` 逐条驱动） | 5 个相位按序发布；每条 marker 恰好 6 个冻结字段；终态后不再发布；marker 只清一次；`streamId` 只解析一次；producer `start` 只发一次；first credit 只在 `ready` 之后且 `acknowledgedSequence = -1`；ACK 是唯一的 credit 来源；Runtime `stop` 发出瞬间 backlog `{chunks:0, rawBytes:0, inFlight:0}` 且 `sequence = 2`；三项 cleanup 计数为 0；Port 断开、Offscreen document 关闭 |
| **R3-2** | `started` 之前不放行任何东西 | `streamIdCalls = 0`；producer 收到 **0** 条消息；`producerReady = false`；`credit = 0`；state = `connecting`；提前到达的 chunk 被真实 `offerChunkMessage` 拒绝为 `PROTOCOL_INVALID` |
| **R3-1** | 一个 grant 只有一个 owner | 启动进行中二次 `startArmed` / `arm` / `prepare` 全部返回冻结 `ALREADY_ACTIVE`；最终 **1** 个 socket、**1** 个 document、**1** 次 producer `start`；capture 活跃后仍拒绝 |
| **R3-2/R3-4** | 6 个 start 失败点各自收口 | 每个失败点：Runtime start 失败 → 返回归一化码、socket closed、document closed、marker 清一次、公开 failure 恰好一次；streamId 失败 → 同上；Port 被拒 → 同上；缺权限 → **不创建 socket**、关闭 document；tab 非法 → **不创建 socket**、关闭 document、`reportDiagnostic.stage = tab_validation` |
| **R3-3** | 四种 reason 的两阶段停止 | `beginStop → sendQuiesce → stop` 顺序冻结；Runtime `stop.reason` 恒等于原始 reason；`cancelled` 不会变成 `completed` |
| **R3-3** | in-flight 非零不得 finalize | producer 已报 `stopped` 但仍有 1 个 chunk 在飞 → Runtime 只发过 `start`；ACK 后才发 `stop`，且发出时 backlog 全零 |
| **R3-3** | `stopped` 之后的 chunk | 在入队/sequence/counter 之前被拒；counters 与 backlog 逐字段不变；因 producer 自相矛盾破坏 drain 保证，capture 以 `PROTOCOL_INVALID` fail-closed，marker 仍只清一次 |
| **R3-3** | producer 永不发 `stopped` | 推进假时钟过 `cleanupTimeoutMs + 1` → 终态 `{ok:false, PORT_DISCONNECTED}`、state `aborted`、socket closed、marker 清一次、Offscreen document 关闭 |
| **R3-3** | 重复 stop 与迟到事件幂等 | 第二次 stop 返回 `stopped`；迟到 socket close / completed frame / chunk **不新增** marker、不新增 failure、不重复清 marker；state 保持 `finalized` |
| **R3-4** | idle 与 error 都回到可解释状态 | 无 active capture 的 stop → 关闭 document、`status()` = `stopped`；producer `capture_error` → 终态 `AUDIO_SHAPE_INVALID`、producer abort **恰好 1** 次、随后 `stop()` 立即返回已结算终态并关闭 document |
| **R3-4** | **双轮 capture 隔离** | 第二轮拿到**新** `captureSessionId`（符合 `cap_+32`）、**新** documentId、**新** Port、**新** socket；两轮 marker 按 session 边界分区；旧 session 的 `ready`/`chunk`/`quiesced`/`stopped` 全部被拒为 `BINDING_MISMATCH`，且 **未触碰** 队列/sequence/counter；突发旧事件下 owner 仍只记录**一次**归一化失败；**每轮 producer abort 恰好一次**；两轮 marker 各清一次；两轮 document 均已关闭 |
| **R3-4** | 旧 Port 无法顶替新 Port | 旧 Port `accept` 返回 `ALREADY_ACTIVE` 并被断开；第二轮 credit 仍为 1 |

## 4. 静态所有权合同（32 → 42）

新增 10 条：

| 组 | 断言 |
|---|---|
| R3-1 | Background 恰好 1 个 Controller / 1 个 router / 1 个 relay facade，且所有 capture 入口都经由它；Offscreen 文档不自建 Port owner |
| R3-1 | `relayFacade.abort` 必须走 `notifyProducerAbortOnce`，**不得**出现裸 `offscreenAudioPort.sendAbort(` |
| R3-1 | Controller 必须有 `#starting` 守卫；`#failStart` **恰有 6 个调用点**；收口必须 `relay.disconnect()` + `#closePreparedDocument()` + 清 `#activeGrantId` |
| R3-3 | `stop()` 内 `beginStop` → `sendQuiesce` → `stop` 的位置顺序；`finally` 必须断 Port 并关 document |
| R3-3 | `draining` 必须接受 chunk；`#offscreenStopped` 起必须拒绝；拒绝段内不得出现 `#expectedSequence` / `#queue.push` / `#totalRawBytes` |
| R3-3 | `#armCleanupTimeout` 必须复用 `RELAY_V10.cleanupTimeoutMs`、必须走 `#failClosed`、只在等待 `stopped` 时生效；`#settleTerminal` 必须清该 timer；`stop()` 必须武装它 |
| R3-4 | `#onMessage` 的 session 门禁必须位于 `switch` **之前**，且 `markQuiesced()` / `markOffscreenStopped()` 都在其之后 |
| R3-4 | `disconnect()` 与 `#onDisconnect()` 都必须清 `#boundDocumentId` 并复位 `#abortNotified`；`accept()` 必须复位 once-guard / readiness / credit |
| R3-5 | `markProducerReady` 必须单调（只从 `runtime_started` 出）；Port 的 `READY` 分支必须调用它；终态不得重发 marker；`#markerExpiry` 每 capture 恰好写一次 |
| R3-4（迟到 stop） | `stop()` 必须在创建新 waiter **之前**检查 `#terminalSettled` 并返回 `#settledTerminal`；`#reset()` 必须清空它；`awaitTerminal()` 同样必须返回它 |

## 5. 计数汇总

| 类别 | R2 出口 | R3 出口 |
|---|---:|---:|
| `RelayR3ControllerComposition.test.ts`（新增） | — | **17** |
| `RelayR2Invariants.test.ts` | 46 | 46（1 例按新 drain 边界改写） |
| `RuntimeCaptureTransport.test.ts` | 30 | 30（1 例按新 drain 边界改写） |
| media_companion 子树 | 212 / 22 files | **229 / 23 files** |
| 扩展全量 | 545 / 66 files | **562 / 67 files** |
| 静态所有权合同 | 32 | **42** |
| Runtime barrier | 6 | 6 |
| Runtime focused | 180 | 180 |
| v10 baseline | 50 / 50 | **46 / 50** ← 阻塞 |
| v10 mutation | 15 / 15 | exit 2（随 baseline 级联） |

## 6. Chrome / Provider / 六视频 / 声音

| 项 | 次数 |
|---|---:|
| Chrome 启动 | **0** |
| Provider 请求 | **0** |
| 六视频 fresh run | **0** |
| 真实产品 run | **0** |
| 声音播放 | **0** |
| 可见 Chrome / 原生弹窗 / 焦点抢占 / UIAutomation | **0** |

本轮不需要浏览器，未触发 `--mute-audio` 前置条件。

## 7. secret scan 与遗留进程

- 变更源文件扫描 `cookie` / `api[_-]?key` / `bearer ` / `authorization:` / `sk-…`
  → **0 命中**。
- 测试数据全部为固定占位（`"t".repeat(43)`、`bilibili/video/BV1TEST`、
  `cap_a…`/`cap_b…`、`doc-1`/`doc-2`）；不写真实域名、token、原始媒体或绝对私有路径。
- 假时钟 / 假 socket，无外部网络访问。
- navia 自身遗留测试进程：**0**；无 Chrome 进程。
- 主机上另有其他仓库的 vitest 进程在跑，与 navia 无关。

## 8. 资源事实

第 3 项全量回归耗时 1048 s（环境 `environment 1747.94 s`），明显慢于 R2 的同一命令。
经核查为**主机 CPU 争用**（同时存在多个 `claude` 与一个 `codex` 进程），非死锁：
该进程 10 分钟内累计 4 分 26 秒 CPU 时间，持续在推进。无产品失败。
