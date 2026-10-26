# WP0 R1 Background Transport 缺口判定

日期：2026-10-16  
判定者：Codex  
状态：`R1 IMPLEMENTATION CONTINUE`  
授权边界：仅 `R1 Background transport`，不得进入 R2。

## 1. 判定

选择路线 1：继续把 Runtime capture WebSocket 的所有权从 Offscreen 迁移到 Background。

这不是新增架构范围，也不是等待下一轮设计裁决的候选需求。它是冻结文档
`02-target-architecture-and-boundaries.md`、v10 relay 合同以及
`stage-b-b5-3-background-capture-relay-development-plan-2026-10-15.md` 已明确授权的 R1 实现内容。

不得采用“只记录缺口、保留 Offscreen 直连、等待后续阶段再修”的路线。该路线会让 R1 在核心所有权
不变量未实现时产生虚假通过，并阻断后续 R2 Offscreen producer 与 R3 Controller integration。

## 2. 事实依据

当前 `apps/chrome-extension/entrypoints/media-capture-offscreen/main.ts`：

- 定义并持有 `RUNTIME_WS_URL`；
- 直接创建 `new WebSocket(...)`；
- 将 ticket、binding、sourceIdentity、acquisitionRecordId 发送给 Runtime；
- 直接向 Runtime 发送 PCM 二进制 chunk；
- 负责 Runtime stop、终态等待和 socket cleanup。

仓库内未发现 Background capture WebSocket transport 或 Offscreen-to-Background PCM relay。现状因此是
Offscreen 同时承担音频 producer、Runtime transport 和终态协议 owner，不符合冻结边界。

Runtime 侧的 staging、owner manifest、FULL receipt、worker-start barrier 已有实现基础，但这些实现不能
替代扩展侧 Background transport，也不能作为 R1 完成证明。

## 3. R1 必须形成的实现

### Background

- `RuntimeCaptureTransport` 是 Runtime capture WebSocket 的唯一 owner；同一时刻只允许一个 active task。
- Background 负责 open、start JSON、`started`、binary chunk、Runtime ACK、stop、final receipt、close、timeout
  和公共边界 FailureCode 归一化。
- Background 维护 sequence、单信用窗口、队列/字节上限、ACK 后返还 credit、quiesce/drain、abort-before-enqueue。
- Background 维护 v10 restart marker 与 phase；marker 不得包含 ticket、streamId、PCM、Cookie、API key、
  sourceIdentity 或绝对路径。
- Background 必须精确验证 Offscreen Port sender，包括 extension ID、URL、tab、frameId、documentId，且使用
  `runtime.getContexts(documentId)` 验证唯一 OFFSCREEN_DOCUMENT 与 incognito 一致。

### Offscreen

- 只保留 `getUserMedia`、AudioContext、downsample、PCM16 编码和 producer cleanup。
- 通过长连接 Port `navia.mediaCapture.audio/v10` 与 Background 通信。
- 不得持有 Runtime URL、ticket、binding、sourceIdentity、acquisitionRecordId 或 WebSocket。
- `streamId` 只允许出现在 Background 到 Offscreen 的一次性 `start` 消息中，并在 getUserMedia settle 或 abort
  后释放；不得进入 chunk、credit、日志、storage、restart marker 或公开证据。

### 冻结参数

- PCM：`pcm_s16le`、16 kHz、单声道、2 bytes/sample、Base64 JSON transport。
- raw chunk 上限 49,152 bytes；encoded chunk 上限 65,536 chars。
- credit window 1；Runtime in-flight 1。
- outstanding 上限 32 chunks / 1,572,864 raw bytes。
- 超限必须在 enqueue 前 abort，禁止静默丢块。
- 正常停止：quiesce audio source -> drain existing queue -> Offscreen stopped -> Runtime finalize。

## 4. 实施顺序

1. 先落盘 R1 gap analysis、详细开发计划和独立验收标准，不改冻结 schema/fixture/registry/阈值。
2. 实现 Background transport、Port sender validation、credit/queue/restart state machine。
3. 把 Offscreen 收敛为纯 PCM producer，删除全部 Runtime 网络和终态协议职责；禁止保留直连 fallback。
4. 调整 Controller，使其先获得 Runtime `started`，再一次性把 streamId 交给 Offscreen。
5. 完成 R1 单元、集成、静态与 Runtime ownership barrier 证明。
6. 落盘 changed files、合同变化（预期为 `none`）、命令/退出码、PRD coverage、风险和 cleanup/secret scan。
7. 在 R1 checkpoint 停止，等待 Codex 验收；不得自动启动 R2。

## 5. R1 出门门槛

- Offscreen 源码中 `WebSocket`、Runtime URL、ticket/binding 传输和直接网络调用均为 0。
- Background capture transport 恰好一个，且单 active task、start/stop/abort 幂等。
- sender 五字段与 `runtime.getContexts` 校验具备正负例。
- sequence 从 0 严格递增；duplicate/out-of-order/length mismatch/invalid Base64 均 fail closed。
- credit 仅在 Runtime `chunkAccepted` 后返还；queue/bytes 超限在 enqueue 前 abort；无 drop。
- quiesce/drain/stop/finalize 顺序有测试证明，Runtime stop 后新增 chunk 为 0。
- restart marker 五阶段、connecting DELETE、Runtime-alive GET/finally、GET 404 停轮询与 existing recover 具备测试。
- Runtime staging barrier、owner manifest/receipt、worker 不早启和唯一 cleanup owner 有确定性测试。
- typecheck、extension tests、相关 Runtime pytest、v10 verifier/mutations 全绿。
- 自动化测试不得播放声音；若必须运行 Chrome，使用 `--mute-audio`。R1 原则上不要求六视频真实 run。
- 公开证据 secret/raw-media/private-path 0 hit，owned process/port/temp resource 清理为 0。

## 6. 禁止事项

- 不得回退或删除当前工作树中既有 V3-2/V3-3 实现以恢复旧哈希。
- 不得修改公共 API、Runtime endpoint、Origin、ticket TTL、Cookie/provider、BVID 分母、grounded
  comprehension、SourceAuthority 或 Side Panel materialize ownership。
- 不得让 Offscreen 保留第二条 WebSocket 或“失败时直连 Runtime”的 fallback。
- 不得降低 sender validation、backpressure、restart、cleanup 或 secret scan 门槛。
- 不得把 R1 单元测试通过扩大解释为 R5 单视频 canary、R7 immutable candidate 或 V3 完成。

## 7. 当前门禁

`R0 PASS` 保持。`R1 IMPLEMENTATION CONTINUE`。R2-R7 仍未授权启动。

