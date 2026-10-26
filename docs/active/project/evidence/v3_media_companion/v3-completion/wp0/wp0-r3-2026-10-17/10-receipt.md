# WP0 R3 Controller Integration Phase Receipt（2026-10-17）

Candidate: `wp0-r3-2026-10-17`
前置：`60-codex-r2-final-checkpoint.md` 判定 `R2 PASS / R3 MAY START`
授权边界：**仅 R3；不得进入 R4；不运行 Chrome / Provider / 六视频；不播放声音**
状态：**R3 AWAITING CODEX CHECKPOINT — 命中 61 §5 停止条件（冻结文件摘要退化）**

R4 未启动。

## 0. 停止摘要（先读这一段）

R3-1..R3-5 的实现与测试**全部完成并通过**，但集中回归第 8/9 项失败：

```
verify-…-v10-contract.py   → exit 2, 46/50
verify-…-v10-mutations.py  → exit 2
```

四个失败检查中，**根因只有一个**：

```
sourceEvidenceHashesCurrent  ← 唯一真实失败
```

`docs/active/project/fixtures/v3-media-capture-internal-relay-v10-fixtures.json`
的 `sourceInventoryEvidence.scopes[]` 以 **SHA-256 冻结了
`apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureController.ts`
的字节**。R3 为关闭 R3-1 的单一启动 owner 缺陷修改了该文件，摘要随之改变：

| 文件 | 冻结摘要 | 当前摘要 |
|---|---|---|
| `MediaCaptureController.ts` | `b344caf3be26…d71888` | `325d0b59fbd2…f7b8991c` |

另外三项（`sourceScopeExtractorsValid`、`sourceEmitSetEqualsFrozenInventory`、
`discoveredCodeUniverseClosed`）是**级联**，不是独立缺陷。verifier 在摘要不匹配时
`continue`，直接跳过该文件的 AST 抽取，于是 5 个 Controller 失败码「消失」：

```python
current = path.is_file() and file_digest(path) == item.get("sha256")
if not current:
    source_extractors_valid = False
    continue        # ← 跳过抽取，级联出另外三项失败
```

已独立验证：**抽取器对本轮修改后的 Controller 仍能取出全部 8 个失败码**，说明
Controller 的失败码集合没有变，变的只是文件字节：

```
["V3_MEDIA_CAPTURE_ALREADY_ACTIVE","V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN",
 "V3_MEDIA_CAPTURE_BINDING_MISMATCH","V3_MEDIA_CAPTURE_PERMISSION_REQUIRED",
 "V3_MEDIA_CAPTURE_PREPARE_FAILED","V3_MEDIA_CAPTURE_PREPARE_REQUIRED",
 "V3_MEDIA_CAPTURE_START_FAILED","V3_MEDIA_CAPTURE_TAB_INVALID"]
```

**已按用户常设规则立即停止，未修改冻结材料**（未改 schema、fixture、FailureCode
registry、20/40 inventory、固定阈值、公共 API、Runtime endpoint、Origin、ticket TTL、
Cookie/provider 合同）。是否重冻结该摘要属于 Codex 决策，本轮不越权。

## 1. 本轮修复的真实生产缺陷

### 1.1 R3-1 — 单一启动 owner（唯一需要改冻结文件的缺陷）

`MediaCaptureController.startArmed()` 在多个 await 之间没有「正在启动」守卫：
`#armedMessage` 被同步清空，但 `#activeGrantId` 要到 tab 校验、digest、权限检查
之后才写入。在这段窗口里：

- 第二次 `startArmed()` 返回 `V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN`（虽是冻结码，
  但语义不是 ALREADY_ACTIVE）；
- `arm()` 反而会**成功**武装第二条 grant，随后第二次 `startArmed()` 会创建**第二个
  Runtime socket、第二个 Port、第二个 Offscreen document**。

这正是 61 §2 R3-1 禁止的「第二编排者 / 第二 owner」。修复：

- 新增 `#starting` 守卫，`startArmed()` 在守卫命中时返回冻结码
  `V3_MEDIA_CAPTURE_ALREADY_ACTIVE`，且在任何浏览器/Runtime 原语之前返回；
- `prepare()` / `arm()` 同样把 `#starting` 计入占用判定；
- 启动过程中 `status()` 报告 `starting`（`MediaCaptureResponse` 已有的冻结状态）。

### 1.2 R3-2 / R3-4 — 唯一的 start fail-closed 收口

原实现在 7 处重复 `closePreparedDocument()`，且 start 失败时**从不** `relay.disconnect()`。
新增单一 `#failStart(failureCode, relayOwnsTerminal)`：tab 非法、binding 不匹配、
缺权限、Runtime start 失败、streamId 失败、Port 未连接、producer start 失败
**全部**经由它收口，统一归还 `#activeGrantId`、断开 Port、关闭 Offscreen document。
静态门禁断言 `#failStart` 恰有 6 个调用点。

### 1.3 R3-3 — 生产接线里的第二次 producer abort（Codex Minor M-R2-FINAL-01 的真正落点）

`entrypoints/background/index.ts` 的 `relayFacade.abort` 原本是：

```ts
abort: (failureCode) => {
  offscreenAudioPort.sendAbort(failureCode);      // 裸 sendAbort，绕过 once-guard
  runtimeCaptureTransport.abort(failureCode);     // → #failClosed → onCaptureAbort
};                                                 //   → notifyProducerAbortOnce → 再发一次
```

`transport.abort()` 内部必然路由到 `onCaptureAbort → notifyProducerAbortOnce()`，
因此该 facade **每 capture 必然发出两次冻结 `abort`**。R2 修的是 `onCaptureAbort`
本身，`60-codex-r2-final-checkpoint.md` 的 Minor 正是指向「abort once 复位说明与代码
位置不一致」。修复：facade 改走 `notifyProducerAbortOnce`，不新增任何控制面。

### 1.4 R3-3 — 停止一定会终止（此前会永久挂起）

quiesce→drain→`stopped`→finalize 由 producer 驱动。若 producer 永远不发 `stopped`，
`#maybeFinalize()` 会永远等在一个不会翻转的标志上：`relay.stop()` 永不 resolve，
`Controller.stop()` 的 `finally` 永不执行，**Offscreen document 永不关闭**，
capture 停留在任何可解释状态之外。

修复：新增 `#armCleanupTimeout()`，用**已冻结**的 `RELAY_V10.cleanupTimeoutMs`
（10 000 ms）限制「等待 `stopped`」这一段，到点走唯一的 `#failClosed(PORT_DISCONNECTED)`。
未引入任何新阈值或新失败码；`#settleTerminal` 负责清除该 timer。

### 1.5 R3-4 — 已结算终态后的迟到 `stop()` 会永久挂起

`transport.stop()` 无条件 `new Promise(...)`。若该 capture 早已结算（producer
`capture_error`、字节/时长上限、异常断连），这个新 waiter 没有任何终态能 resolve。
后果：`Controller.stop()` 挂死 → Offscreen document 不关闭。修复：

- 新增 `#settledTerminal`，`#settleTerminal()` 保存、每次 `#reset()` 清空；
- `stop()` 与 `awaitTerminal()` 在已结算时直接返回它。

### 1.6 R3-4 — 每 capture 释放 Port 的 capture-local 绑定

`OffscreenAudioPort.disconnect()` / `#onDisconnect()` 原先**不清** `#boundDocumentId`。
第一轮 capture 关闭 Offscreen document 后，第二轮创建的是**新 documentId**，
`accept()` 会因 `boundDocumentId` 不匹配而返回 `B3_MEDIA_CAPTURE_BINDING_MISMATCH`
—— 第二轮 capture 永远无法开始。同时 `#abortNotified` 也会残留，抑制第二轮的
producer abort。

本轮选择 **每 capture 新 Port accept**（61 允许的两种策略中的第一种），并把
`boundDocumentId` / `abortNotified` / `producerReady` / `credit` 的复位同时放在
`accept()`（新 capture 开始）与 `disconnect()` / `#onDisconnect()`（capture 结束）
两处，使「每 capture 至多一次 abort」在两种策略下都成立。

### 1.7 R3-4 — 五条入站消息都必须属于本 capture

`READY` 与 `CHUNK` 会校验 `captureSessionId`，但 `quiesced`、`stopped`、
`capture_error` **不会**。旧 session（或误投的 Port 消息）的 `stopped` 可以把
**当前** capture 标记为已停止并提前 finalize。修复：`#onMessage` 在 `switch`
之前统一做一次 session 门禁，规则与 `validateChunkMessage` 完全一致（缺失/畸形 →
`PROTOCOL_INVALID`，合法但不匹配 → `BINDING_MISMATCH`），任何分支都不得绕过。

### 1.8 R3-5 — `capturing` 相位在 `ready` 发布

冻结 24 步 positive trace 的第 6/7 步要求 `offscreen ready` 之后即进入 `capturing`
并发布该相位，而生产实现要等到**第一个 chunk**（第 9 步）才切换。worker 在握手期间
重启时无法区分「已 ready 但静默的 producer」与「从未启动的 producer」。

修复：新增单调的 `RuntimeCaptureTransport.markProducerReady()`，由 Port 的 `READY`
分支调用；`#setState` 仍拒绝发布终态相位，`#markerExpiry` 仍每 capture 只写一次。

### 1.9 R3-3 — quiesce 之后必须还能排空已缓冲的音频

**冻结 fixture 与既有 R1 实现相冲突**：fixture 第 15 步 `quiesced` 上报
`queuedChunks: 1`，第 16 步在 `draining` 状态下发送**那一个**已缓冲 chunk；
61 §2 R3-3 也写明「producer 停止新增音频，**已有队列按单信用 drain**；backlog 与
in-flight 为零后才接受 `stopped` 并发送 finalize」。而 R1 实现与
`RuntimeCaptureTransport.test.ts` 的旧用例「rejects a chunk after the stop boundary」
在 `draining` 就直接拒绝。

按冻结材料（fixture 是权威）与 61 的显式要求，判定 **R1 的旧边界是错的**，改为：

- `draining` **接受** chunk（仍受同一单信用、同一 sequence 纪律、同一 outstanding
  上限、同一整轮 capture 上限约束，不会无界）；
- `#offscreenStopped` 起（含 `cleanup_pending` / 终态）**拒绝**，且在入队、
  sequence 递增、counter 累加**之前**拒绝。

对应的 R1/R2 旧用例已按新边界改写，不是删除。

## 2. 测试

新增 `RelayR3ControllerComposition.test.ts`（17 例），由**真实**的
`MediaCaptureController` + `MediaCaptureMessageRouter` +
`RuntimeCaptureTransport` + `OffscreenAudioPort` + `bootstrapOffscreenProducerPort`
驱动，relay facade 与 `entrypoints/background/index.ts` 逐行一致；只替换浏览器与
网络原语（`WebSocket` → FakeSocket、`setTimeout` → FakeClock、`chrome.offscreen` →
随文档生死 Port 的文档注册表、`chrome.tabCapture` → streamId 桩、
`chrome.runtime.getContexts` → context 桩）。**不播放声音，不打开浏览器。**

静态所有权合同由 32 增至 **42** 条，新增 R3-1/R3-3/R3-4/R3-5 共 10 条。

详见 `20-test-results.md` 与 `40-handoff.md`。

## 3. 合同变化

- **内部合同变化**：有 —— 见 §1.1..§1.8，共 8 项。
- **公共合同变化**：**none**。九消息集合、20 码 FailureCode registry、
  `maxCaptureBytes` / `maxCaptureMs` / 全部 timeout / PCM 参数 / marker TTL、
  公共 API、Runtime endpoint、Origin、ticket TTL、Cookie/provider 合同全部未改。
- **冻结材料**：**未修改**。schema、fixture、20/40 inventory 均未改。
  唯一触碰的是 fixture 所**冻结**的一个实现文件的字节（`MediaCaptureController.ts`），
  这正是停止原因。

## 4. 严重度

| 级别 | 数量 | 说明 |
|---|---:|---|
| Fatal | 0 | — |
| Major（已修复） | 0 | §1.1..§1.9 共 9 个生产缺陷 |
| Minor | 0 | — |
| **阻塞项** | **1** | **冻结文件 `MediaCaptureController.ts` 摘要需要 Codex 决策** |

## 5. 停止点

状态 **R3 AWAITING CODEX CHECKPOINT**。命中 61 §5「需要改变…固定分母」与用户常设
规则「若确实必须修改冻结材料，立即停止并报告 Codex」。不进入 R4，不宣布 R3 PASS，
不进行独立文档外审或阶段 closeout。
