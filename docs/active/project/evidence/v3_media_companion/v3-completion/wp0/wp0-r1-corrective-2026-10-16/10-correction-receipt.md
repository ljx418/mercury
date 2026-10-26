# WP0 R1 纠偏 Phase Receipt（2026-10-16）

Candidate: `wp0-r1-corrective-2026-10-16`
状态：**R1 AWAITING CODEX REFREEZE**
依据：`wp0-r1-2026-10-16/80-codex-r1-gate-review.md`（SHA-256 `ee070e9cbd2a22104dd4807090ae053f61b215bfabea4aab256d63b48cbd5d91`）、
`wp0-r1-2026-10-16/81-codex-r1-corrective-handoff.md`（SHA-256 `fce2d3c28b00b14678cf6a42621d35412175f3dce5651637da519cf15d6df1dc`）
R2 未启动。

## 1. R1-F1..F6 关闭情况

| 项 | 内容 | 状态 |
|---|---|---|
| R1-F1 | 9 个冻结 Port 消息统一 + 全部携带同一 captureSessionId | ✅ |
| R1-F2 | Offscreen 为受 credit 约束的纯 producer，无 Runtime 连接、无 ticket | ✅ |
| R1-F3 | Background 唯一 WS owner；Runtime ACK 后才返还下一个 credit | ✅ |
| R1-F4 | 原子 beginStop(reason) 闭合 quiesce→drain→stopped→finalize | ✅ |
| R1-F5 | 正常 disconnect 不误判 completed；异常 disconnect fail closed | ✅ |
| R1-F6 | marker 用 chrome.storage.session + TRUSTED_CONTEXTS；schemaVersion/TTL/五阶段/clear 严格按 schema | ✅ |
| — | sender URL 精确匹配；frameId 仅 absent 或 0；documentId 首次绑定 | ✅ |
| — | 修复 ready/ack 竞态；拒绝 replacement Port 与第二 producer | ✅ |
| — | AudioContext suspended 保留为 Offscreen 内部诊断，Background 归一化为 `V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID` | ✅ |
| — | 双端协议 harness、restart harness、错误 stop reason、ACK timeout、正常/异常 disconnect、marker clear 测试 | ✅ |

## 2. R1-F1：Port 消息合同

以 `v3_media_capture_internal_relay_v10.schema.json` 的 `$defs` 为唯一依据，
`relayContracts.ts` 精确实现 9 个消息：

- Background→Offscreen：`start` / `chunk_credit` / `quiesce` / `abort`
- Offscreen→Background：`ready` / `chunk` / `quiesced` / `stopped` / `capture_error`

纠偏点：
- 补回缺失的 `chunk_credit`；
- `failed` → `capture_error`；
- 移除误列为 producer 方向的 `start`；
- 每个消息都带 `captureSessionId`（`cap_` + 32 base64url），chunk 额外校验
  `captureSessionId` 绑定，不匹配即 `BINDING_MISMATCH`；
- 两端均不内联协议字面量，统一引用 `PORT_MESSAGE`。

## 3. R1-F2：Offscreen 是受 credit 约束的纯 producer

`media-capture-offscreen/main.ts` 重写为：

- Port listener 处理 `start` / `chunk_credit` / `quiesce` / `abort`；
- 仅在 `start` 之后调用 `getUserMedia`；streamId 在 `getUserMedia` settle 后释放；
- credit 初始 1；每发一个 chunk 消耗 1；**无 credit 绝不发送**（`credit <= 0`
  时直接静音丢弃，不发 Port 消息）；
- `quiesce` 顺序：停音频源 → 发 `quiesced` → 完成资源清理 → 发 `stopped`；
- **删除** `runtime.onMessage` 的 `start` / `stop` 控制路径，仅保留无状态
  `ping` 预热；
- **无** `fetch` / `XMLHttpRequest` / `sendBeacon` / 第二条 WebSocket。

## 4. R1-F3：credit 端到端

- `RuntimeCaptureTransport` 新增 `onRuntimeAck` 依赖，由 Background 装配时
  连到 `OffscreenAudioPort.noteRuntimeAck()`；
- `chunk_credit` **只**在 Runtime `chunkAccepted` 后产生；`start` 只授予
  冻结的首个 credit=1；
- 队列上限 32 chunks / 1,572,864 raw bytes，超限在 **enqueue 前** abort，
  无静默丢块；
- Runtime in-flight 恒为 1；ACK 超时 10s 后 fail closed。

本轮修正的两个真实缺陷：
1. `sendStart` 先置 `credit=1` 再调用 `grantCredit`，导致首帧 credit 被自我
   取消（永远不发 `chunk_credit`）；
2. transport 收到最后一个 ACK 后从不复检 finalize 门，导致 stop 永不
   发往 Runtime。

## 5. R1-F4：可恢复 marker

- `schemaVersion` 固定 `v3-media-capture-restart-marker/v10`（原为
  `navia-media-capture-relay-marker/v10`，已纠正）；
- `captureSessionId` 为 `cap_` + 32 base64url（192 random bits，原为 48 hex）；
- 写入 `chrome.storage.session`，访问级别 `TRUSTED_CONTEXTS`；
- 字段严格 6 个，禁止 ticket / grantId / streamId / pcm / sourceIdentity /
  absolutePath / cookie / apiKey；
- `expiresAt` 在 `startedAt` 时一次性确定（+1,080,000 ms），phase 更新不刷新；
- 合法相变：`connecting→runtime_started→capturing→draining→cleanup_pending`；
- clear 规则：owner receipt + cleanup grace 后清除，且**只清除本次 session
  的 marker**（他 session 的 marker 必须存活）；
- 过期的 marker 视为 fail-closed 清理信号；被污染的 marker 因多出禁止字段
  而不合法。

本轮修正的第三个真实缺陷：终态（`finalized`/`aborted`/`failed`）会调用
`#setState` 再次落盘 marker，而 `currentMarker()` 对非五阶段的 state 回退成
`connecting`，等于在收口瞬间把 phase 改写成 `connecting` 再清除。已改为
只有五个冻结阶段才落盘。

## 6. R1-F5：sender 与握手

- URL **精确等于** `runtime.getURL("media-capture-offscreen.html")`（原为
  prefix 判断）；
- `sender.tab` 必须 absent；
- `frameId` 必须是 **absent 或 0**（原为任意 number）；
- `documentId` 非空且**首次绑定**；后续来自不同 document 的 Port 以
  `BINDING_MISMATCH` 拒绝；
- `runtime.getContexts` 必须恰好一个 `OFFSCREEN_DOCUMENT`，documentId 与
  incognito 全匹配；
- 两侧 listener 在任何 await / 握手之前**同步注册**，消除 `ready` 丢失窗口；
- replacement Port 与第二 producer 拒绝（`ALREADY_ACTIVE`）。

## 7. R1-F6：诊断与证据闭环

- Offscreen 在 AudioContext 未 running 时发内部
  `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED`；Background 经
  `normalizeRelayFailureCode` 归一化为公开
  `V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID`；内部码**不**出现在公开 20 码集合
  中，也不跨越边界（m-R1-01 关闭）。
- 新增 `RelayTwoEndHarness.test.ts`：把真实 `OffscreenAudioPort` 与真实
  `RuntimeCaptureTransport` 接在 fake Port 对上，验证
  `ready → start → credit → chunk → ACK → credit → quiesce → quiesced →
  stopped → finalize` 全序列，以及无 credit 拒发、replacement Port 拒绝、
  内部码归一化、正常 disconnect 不 abort。
- 新增 `RelayRestartHarness.test.ts`：验证五阶段落盘、重启后读回、
  TTL 不刷新、禁止字段污染、过期判定、clear 规则与 session 作用域。

## 8. 合同变化

- **内部合同变化**：有（Port 消息集合、marker 身份、sender 规则、stop
  顺序、credit 语义）。
- **公共合同变化**：**none**。未修改冻结 schema、fixture、FailureCode
  registry、验收阈值、公共 API、Runtime endpoint、Origin、ticket TTL、
  Cookie/provider 合同、BVID 分母、grounded comprehension、SourceAuthority、
  Side Panel materialize ownership。

## 9. 严重度

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | R1-F1..F6 全部关闭 |
| Minor | 0 | — |
| 待重冻结 | 1 | v10 verifier 45/50 + 14/15，根因见 §10 |

## 10. v10 verifier 现状（预期失败，等待 Codex 重冻结）

```
verify-...-v10-contract.py  → exit 2, 45/50
  failed: sourceEvidenceHashesCurrent, sourceScopeExtractorsValid,
          sourceEmitSetEqualsFrozenInventory,
          unlistedSourceFilesEmitNoBoundaryCodes,
          discoveredCodeUniverseClosed
  sourceInventoryDiff: actual 32 vs frozen 40
verify-...-v10-mutations.py → exit 2, 14/15
```

**逐项核验：8 个「缺失」code 全部仍存在于工作树**（每个至少 1 个非测试
文件），因此本轮**零真实删除**：

| code | 存在于非测试文件数 |
|---|---:|
| `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED` | 1（已按 m-R1-01 恢复） |
| `V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE` | 1 |
| `V3_MEDIA_CAPTURE_PERMISSION_REQUIRED` | 1 |
| `V3_MEDIA_CAPTURE_PREPARE_FAILED` | 2 |
| `V3_MEDIA_CAPTURE_PREPARE_REQUIRED` | 1 |
| `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` | 1 |
| `V3_MEDIA_CAPTURE_START_FAILED` | 3 |
| `V3_MEDIA_CAPTURE_TAB_INVALID` | 3 |

「缺失」完全是 verifier 在哈希漂移时跳过整文件 AST 抽取的假象。

**冻结 scope 漂移文件（2 个，均为 R1 必然要改的）**：

| 文件 | 原因 |
|---|---|
| `capture/MediaCaptureController.ts` | 增加 `beginStop` 原子 stop 边界 |
| `entrypoints/media-capture-offscreen/main.ts` | 按 R1-F2 收敛为纯 producer |

**unlisted emit**：4 个新 relay 模块不在冻结 11-scope 内，
`relayContracts.ts` 发出 5 个 boundary code。

以上全部属 Codex 冻结权限（`81-codex-r1-corrective-handoff.md` 禁止事项、
`00-codex-r1-transport-gap-decision.md` §6）。ClaudeCode 未修改任何冻结证据。

## 11. 下一门禁

Codex 检查实现事实 → 更新冻结 scope/hash → 重跑 contract verifier 50/50 与
mutation verifier 15/15。在此之前不进入 R2。
