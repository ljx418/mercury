# WP0 R3 PRD / 架构不变量检视（2026-10-17）

Candidate: `wp0-r3-2026-10-17`
状态：**R3 AWAITING CODEX CHECKPOINT**

## 1. `61-codex-r3-development-and-acceptance.md` §2 逐条落实

| 工作包 | 要求 | 本轮结果 | 判定 |
|---|---|---|---|
| **R3-1** 单一编排入口 | 追踪 router/client → Controller 的 start/status/stop；删除或拒绝任何绕过 Controller 的 producer start / Runtime finalize / Offscreen close；同一 grant/capture 只能有一个 active owner，重复 start 返回冻结错误且**不创建第二 socket、Port 或 Offscreen document** | 修复了启动窗口内的第二 owner（`#starting` 守卫 + `#failStart` 单一收口）；Background 静态门禁锁定「恰好 1 个 Controller / 1 个 router / 1 个 relay facade」且所有入口经由它；重复 start 断言 1 socket / 1 document / 1 次 producer `start` | ✅（但需重冻结一个文件摘要，见 §4） |
| **R3-2** 启动顺序 | Runtime `started` 之前不得获取/下发 streamId、不得发送 producer `start`、不得接收 chunk；start 的每个失败点都 fail-closed 并关闭本轮可证明 ownership 的 socket、Port、marker、Offscreen document | `started` 之前 `getMediaStreamId` 0 次、producer 收到 0 条消息、credit 0、提前 chunk 被真实 `offerChunkMessage` 拒绝；6 个失败点逐一断言 socket closed / Port 断开 / document 关闭 / marker 清一次 / 公开 failure 恰好一次 | ✅ |
| **R3-3** 两阶段停止 | 固定 stop reason 后才发 `quiesce`；producer 停止新增音频、**已有队列按单信用 drain**；backlog/in-flight 为零后才接受 `stopped` 并发送 finalize；Runtime stop 后拒绝新 chunk；terminal settle 后清 marker、断 Port、关 document；navigation/tab_closed/cancelled 不得被改写为 completed | 顺序与 reason 全部冻结；Runtime `stop` 发出瞬间快照 `{chunks:0, rawBytes:0, inFlight:0}`；`draining` 接受已缓冲 chunk、`#offscreenStopped` 起拒绝且不污染 counters；四种 reason 逐一验证；重复 stop 与迟到事件幂等 | ✅ |
| **R3-4** idle/error 清理与双轮隔离 | 所有 start 失败、capture_error、disconnect、timeout、abort、stop terminal 和**无 active stop** 都必须回到可解释状态并关闭 Offscreen；新增至少一个双轮 production composition；**明确选择并锁定 `每 capture 新 Port accept`** | 选择并锁定「每 capture 新 Port accept」，且复位同时落在 `accept()` 与 `disconnect()`/`#onDisconnect()`，两种策略下「每 capture 至多一次 abort」都成立；双轮 composition 断言新 session / 新 Port / 新 document、旧 session 四类事件全被拒且不污染 counters、**每轮 abort 恰好一次**、两轮 marker 各清一次；idle stop 与 capture_error 均关闭 document | ✅ |
| **R3-5** phase marker 与可观测主链 | 用生产类驱动 v10 fixture 的 **24 步 positive trace**，逐步证明五阶段 marker、顺序、credit、stop/finalize 和三项 cleanup，而不是只比较固定 JSON；terminal 后不得重新发布 marker；phase 更新不得刷新 expiry；新 worker 不续传旧 PCM/ticket/sequence/bearer | 直接 import 冻结 fixture 的 `positiveTrace`，逐 `step` / `requiredState` 驱动并断言；五相位按序发布、每条 6 字段、终态后零新增发布、`#markerExpiry` 每 capture 恰写一次；三项 cleanup 计数为 0 | ✅（顺带修正 `capturing` 相位时机） |

## 2. `61` §3 十项行为 oracle 逐条落实

| # | oracle | 落点 | 判定 |
|---:|---|---|---|
| 1 | Runtime started 前 producer start/chunk 均为 `0` | `R3-2` | ✅ |
| 2 | 正常链顺序严格 start Runtime → start producer → quiesce → drain → stopped → finalize | 24 步 composition 逐步 | ✅ |
| 3 | 重复 start 不产生第二 owner；重复 stop / 迟到事件幂等 | `R3-1` + `R3-3` | ✅ |
| 4 | start 每个失败点关闭本轮 socket/Port/Offscreen，marker 最多清一次 | `R3-2/R3-4`（6 个失败点） | ✅ |
| 5 | cancel/navigation/tab_closed 保留原 stop reason | `R3-3`（4 种 reason） | ✅ |
| 6 | Runtime finalize 之前 backlog 和 in-flight 必须为零 | Runtime `stop` 发出瞬间快照 | ✅ |
| 7 | Runtime stop 后的新 chunk 被拒绝且不污染 sequence/counters | `R3-3` | ✅ |
| 8 | 双轮 capture 隔离：新 session/new Port；旧 session 事件不能进入第二轮；每轮 abort 恰好一次 | `R3-4` | ✅ |
| 9 | 24 步主链由生产 Controller、Transport、Port owner 和 router/client composition 驱动 | `R3-5` | ✅ |
| 10 | 静态补充门禁证明 Offscreen 仍零网络、无 ticket/Runtime URL，Background 只有一个 Controller/Transport/Port owner 装配点 | 42 条静态门禁（原 32 + 新 10） | ✅ |

## 3. 架构不变量对照（`02-target-architecture-and-boundaries.md` §3）

| 不变量 | 本轮结果 | 判定 |
|---|---|---|
| Runtime capture WebSocket owner = Background | 不变；本轮所有新逻辑（cleanup 上界、迟到 stop、单次失败）都在该 owner 内 | ✅ |
| Offscreen 直接联网（不允许） | 不变；静态门禁仍断言零 WebSocket / 零 Runtime URL / 零 ticket / 零 binding / 零 sourceIdentity / 零 acquisitionRecordId | ✅ |
| 音频生产 / downsample 归 Offscreen | 不变 | ✅ |
| 同步 staging barrier 归 Runtime handler | 不变；6 项 barrier 全绿 | ✅ |
| barrier 后 cleanup 归 transcript service | 不变 | ✅ |
| streamId 仅一次性 | 不变；24 步断言 `getMediaStreamId` 只解析一次、producer `start` 只发一次 | ✅ |
| 正常停止顺序 quiesce → drain → stopped → finalize | **强化**：drain 阶段现在真正可排空（与冻结 trace 一致） | ✅ |
| 超限 enqueue 前 abort，禁止静默丢块 | 不变；拒绝路径在入队 / sequence / counter 之前 | ✅ |
| 单一 capture control plane | **强化**：唯一 Controller + 唯一 relay facade + 唯一 Port owner；producer abort 全部经 `notifyProducerAbortOnce` | ✅ |
| restart 不恢复旧音频 / ticket / 序列 | 不变；本轮进一步证明新 worker 的空序列/空 credit 只能来自新的 captureSessionId | ✅ |
| restart 通过真实 authenticated Runtime | 不变（R1-C3-01 已闭合） | ✅ |
| 采集时长 / 字节上限由 owner 强制执行 | 不变（R2 出口） | ✅ |
| **每一个 idle/error 关闭 Offscreen** | **强化**：补上「producer 永不发 `stopped`」与「已结算后的迟到 stop」两条此前会永久挂起、从而永不关闭 document 的路径 | ✅ |
| **旧 session 事件不得影响当前 capture** | **强化**：此前只有 `ready`/`chunk` 校验 session；`quiesced`/`stopped`/`capture_error` 可提前 finalize 当前 capture，现已统一门禁 | ✅ |

## 4. 冻结材料判定

| 项 | 状态 |
|---|---|
| v10 schema | 未修改 |
| v10 fixture（`positiveTrace` / `negativeCases` / `sourceInventoryEvidence` …） | **未修改** |
| FailureCode registry（20 码） | 未修改；本轮新增的失败全部复用既有冻结码 |
| 20 / 40 inventory | 未修改（verifier 报 inventory 本身 20/20、40/40 一致） |
| 固定阈值（`maxCaptureBytes` / `maxCaptureMs` / 各 timeout / PCM / marker TTL） | 未修改；`#armCleanupTimeout` 复用**已冻结**的 `RELAY_V10.cleanupTimeoutMs`，未引入新阈值 |
| 公共 API / Runtime endpoint / Origin / ticket TTL / Cookie/provider 合同 | 未修改 |

**唯一触碰**：`MediaCaptureController.ts` 的**字节**被 fixture 的
`sourceInventoryEvidence.scopes[].sha256` 冻结，R3 为关闭 R3-1 缺陷必须改它。
本轮**未**修改 fixture 来自行重冻结；按用户常设规则立即停止并报告 Codex。

## 5. 与冻结 fixture 冲突的一处旧实现（已按冻结材料判定）

`RuntimeCaptureTransport` 旧实现在 `draining` 即拒绝 chunk，
`RuntimeCaptureTransport.test.ts` 旧用例名为「rejects a chunk after the stop
boundary」。冻结 fixture 第 15/16 步与 61 §R3-3 都要求 post-quiesce 队列能按单信用
drain，故判定旧边界与冻结材料冲突，按冻结材料修正为：

- `draining` 接受 chunk；
- `#offscreenStopped` 起（含 `cleanup_pending` 与终态）拒绝，且在入队 / sequence /
  counter 之前。

R2 / R1 的两处旧用例已按新边界**改写**（保留断言意图并强化），非删除。

## 6. 严重度

| 级别 | 数量 |
|---|---:|
| Fatal | 0 |
| Major（已修复） | 0（9 个生产缺陷，见 receipt §1） |
| Minor | 0 |
| 待重冻结 | **1**（`MediaCaptureController.ts` 摘要，待 Codex 决策） |
