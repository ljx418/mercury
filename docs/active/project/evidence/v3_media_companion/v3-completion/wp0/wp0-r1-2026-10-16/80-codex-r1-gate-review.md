# WP0 R1 Codex 门禁复核（2026-10-16）

## 1. 决定

**R1 NO-GO。Fatal 0 / Major 5 / Minor 2。R2 不得启动。**

本轮不批准重冻结 v10 fixture、source scope、40-code inventory 或 FailureCode
分类。当前 `45/50` 与 `14/15` 不只是文件哈希漂移：实现尚未满足已经冻结的
v10 双端协议。现在重冻结会把局部单元测试通过、但真实 Background↔Offscreen
链路不可闭环的状态错误认证为合同基线。

独立复算结果：

| 项目 | 结果 |
|---|---|
| v10 contract verifier | exit 2，45/50 |
| v10 mutation verifier | exit 2，14/15 |
| Chrome / Provider / 六视频 | 本轮未执行 |

## 2. Major

### M-R1-01：Port 协议与冻结 v10 不一致，控制面仍绕过 Port

冻结协议要求：

- Background→Offscreen：`start`、`chunk_credit`、`quiesce`、`abort`
- Offscreen→Background：`ready`、`chunk`、`quiesced`、`stopped`、`capture_error`

当前实现：

- `relayContracts.ts` 缺少 `chunk_credit`，使用 `failed` 而不是
  `capture_error`，并把 `start` 错列入 Offscreen→Background；
- `media-capture-offscreen/main.ts` 的 Port listener 只处理 `abort`；
  Background 通过 Port 发送的 `start` 与 `quiesce` 均不会启动或停止 producer；
- Offscreen 仍通过 `chrome.runtime.onMessage` 接受一次性 `start/stop`，Controller
  也仍调用该路径，形成第二套控制面。

因此 `RuntimeCaptureTransport`、`OffscreenAudioPort` 与真实 Offscreen entrypoint
没有形成可工作的单一协议。

### M-R1-02：credit/backpressure 未端到端实现

Runtime transport 内部限制了一个 Runtime in-flight chunk，但没有把 Runtime
`chunkAccepted` 转换为 `chunk_credit` 返回 Offscreen。Offscreen producer 也没有
credit 计数或无 credit 禁止发送的逻辑，会持续产生并发送 chunk。

冻结不变量 `creditReturn=after_runtime_ack_only`、`creditWindowChunks=1` 尚未满足。
现有测试只验证 Background 内部队列，不证明 producer 侧受 credit 约束。

### M-R1-03：restart marker 未持久化，标识格式与恢复流程不合约

当前 Background 仅把 marker 写入
`globalThis.__naviaRelayRestartMarker`，没有写入 `chrome.storage.session`，也没有
设置 `TRUSTED_CONTEXTS`。此外：

- schemaVersion 使用 `navia-media-capture-relay-marker/v10`，冻结值为
  `v3-media-capture-restart-marker/v10`；
- captureSessionId 是 48 位 hex，冻结格式是 `cap_` + 32 位 base64url；
- 未实现 service worker 启动时按五阶段 dispatch cleanup/recovery；
- 未证明 owner receipt + cleanup grace 后清理 marker。

内存变量不能证明 Chrome service worker 重启后的恢复行为。

### M-R1-04：停止原因存在竞态，可能以 `completed` 错误 finalize

当前 Controller 先发送 quiesce、等待一次性 Offscreen stop，最后才调用
`relay.stop(reason)` 设置 stop reason。与此同时，Offscreen 的 `quiesced/stopped`
消息可先触发 `RuntimeCaptureTransport.#maybeFinalize()`；该方法允许在
`quiesceRequested=false` 时仅凭 `quiesced=true` 进入 finalize。这样
navigation、cancel、tab_close 等流程可能使用默认 `completed` 向 Runtime stop。

终态必须由 Background 先原子记录 stop reason，再发 quiesce；只有收到匹配
captureSessionId 的 stopped、队列与 in-flight 均为 0 后才可 finalize。

### M-R1-05：Port 建连和 sender 校验不满足 fail-closed 要求

- Offscreen 在注册 `onMessage` 前立即发送 ready；Background 的 `accept()` 在
  `await getContexts()` 后才注册 listener，ready 可丢失；
- sender URL 使用 prefix 判断，冻结要求精确等于
  `runtime.getURL("media-capture-offscreen.html")`；
- frameId 当前要求“任意 number”，冻结要求 absent-or-zero；
- 正常关闭 Port 仍可走 `onFailure → abort`，缺少预期 disconnect 与异常
  disconnect 的区分。

这些问题会让真实 Chrome 环境出现偶发启动失败、错误 abort，或扩大可信 sender
范围。

## 3. Minor

### m-R1-01：`V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED` 不应从 source inventory 删除

该 code 是 producer 内部精确诊断；冻结 mapping 已明确将它归一化为公开 relay
code `V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID`。应恢复内部 source diagnostic，并在
Background 边界归一化，不修改 20-code target inventory。

### m-R1-02：R1 交接证据的 changed-files 清单不完整

工作树还包含 `resolveCaptureGrantBinding.ts`，以及
`MediaCaptureMessageClient.ts`、`MediaCaptureMessageRouter.ts`、`contracts.ts`
的变更，但 `60-r1-handoff.md` 未完整列出。修复后必须重建 changed-files、合同
变化说明和 payload manifest，不能仅追加哈希。

## 4. 冻结裁定

1. **不更新**当前两个权威文件哈希。
2. **不把**四个新 relay 模块加入冻结 source scope。
3. **不重算**40-code inventory。
4. **保留** `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED` 为 source code，并继续映射到
   `V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID`。
5. Controller 旧测试中“ticket 下发 Offscreen”的断言可以删除；该行为本身违反
   R1 所有权目标。此项不是阻塞。

只有纠偏完成并通过第 5 节门槛后，Codex 才会执行一次限定重冻结。

## 5. 重新申请重冻结的必要条件

以下条件必须同时满足：

1. 双端只使用冻结 v10 Port 消息，删除 Offscreen 一次性 start/stop 控制路径；
2. `chunk_credit` 由 Runtime ACK 唯一产生，producer 无 credit 时不发送；
3. 所有 Port 消息携带并校验同一 `captureSessionId`；
4. Background 先记录 stop reason，再执行 quiesce→drain→stopped→finalize；
5. restart marker 使用 `chrome.storage.session` + `TRUSTED_CONTEXTS`，格式、TTL、
   五阶段、启动恢复和 clear rule 与 schema 一致；
6. sender URL 精确匹配、frameId absent-or-zero、documentId/getContexts/incognito
   全部 fail closed；
7. 添加一个真实双端协议 harness：连接 Background Port owner 与 Offscreen producer，
   证明 start、首 credit、chunk、ACK→credit、quiesce、stopped、finalize 的完整顺序；
8. 添加 restart harness：至少覆盖五阶段中断、过期 marker、成功 cleanup 后清理；
9. 更新 R1 changed-files、合同说明、测试结果、PRD 检视、handoff、manifest；
10. 所有测试禁止播放声音；如进入 Chrome，必须使用 `--mute-audio`。

满足后先运行 R1 自验证。Codex 随后检查实现事实，再更新冻结 scope/hash，并要求
contract verifier `50/50`、mutation verifier `15/15`。在此之前不得进入 R2。

## 6. 当前自动化开发停止原因

R1 的 Background WebSocket owner 方向正确，但真实 Offscreen Port 控制、credit、
restart、stop-reason 和 sender handshake 尚未闭环。继续 R2 会把不可恢复且可能错误
终态化的 capture transport 带入更大范围，因此按 Major 门禁停止。

