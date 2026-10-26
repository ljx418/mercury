# WP0 R1 纠偏交接（交给实现终端）

## 目标

继续 R1，不进入 R2。修复双端 v10 relay，使真实
Background↔Offscreen 协议满足冻结 schema。不得修改冻结 schema、fixture、
FailureCode registry、验收阈值或公共 API。

## 实施顺序

### R1-F1：统一 Port 消息合同

- 精确实现 9 个冻结消息类型与字段；
- 每个消息携带同一 captureSessionId；
- 删除 Offscreen→Background `start` 和 `failed`；改为 `capture_error`；
- 增加 Background→Offscreen `chunk_credit`；
- 不在两端内联协议字面量。

### R1-F2：让 Offscreen 成为受 credit 约束的纯 producer

- Port listener 处理 start/chunk_credit/quiesce/abort；
- 收到 start 后才调用 getUserMedia；
- 初始 credit=1；每发送一个 chunk 消耗一个 credit；无 credit 时不得发送；
- Runtime ACK 后 Background 才返回下一个 credit；
- quiesce 后停止音频源、拒绝新 chunk、报告 quiesced，再完成资源清理并报告
  stopped；
- 删除 runtime.onMessage start/stop 控制路径，仅保留无状态 ping（如仍需要预热）。

### R1-F3：修复 Background stop/finalize 状态机

- 新增原子 `beginStop(reason)` 或等价操作：先冻结 stop reason，再发 quiesce；
- finalize 前同时要求 stop requested、producer quiesced/stopped、queue=0、inFlight=0；
- producer 自发 stopped 或 disconnect 不得默认解释为 completed；
- 正常 disconnect 不得再次 abort 已 finalized transport；异常 disconnect 必须 fail closed；
- 实现 chunk ACK timeout、connect/start/cleanup/finalize timeout 与冻结常量。

### R1-F4：实现可恢复 marker

- schemaVersion 固定 `v3-media-capture-restart-marker/v10`；
- captureSessionId 为 `cap_` + 32 位 base64url（192 random bits）；
- 写入 `chrome.storage.session`，访问级别 `TRUSTED_CONTEXTS`；
- startedAt/expiresAt 只初始化一次，phase 更新不刷新 expiresAt；
- service worker 启动读取 marker，按 phase 调用既有 authenticated DELETE/GET/recover，
  永不恢复旧 PCM/ticket/sequence；
- owner receipt 与 cleanup grace 后清理 marker；过期/非法 marker fail closed 清理。

### R1-F5：收紧 sender 与握手

- URL 精确等于 `runtime.getURL("media-capture-offscreen.html")`；
- tab 必须 absent；frameId 必须 absent 或 0；documentId 非空并首次绑定；
- getContexts 必须恰好一个 OFFSCREEN_DOCUMENT，documentId/incognito 全匹配；
- 先注册两端 listener，再进行 ready/ack 握手，消除 ready 丢失窗口；
- replacement Port 与第二 producer 必须拒绝。

### R1-F6：诊断和证据闭环

- Offscreen AudioContext 未 running 时发内部
  `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED`；Background 归一化为
  `V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID`；
- 新增真实双端协议 harness 和 restart harness；
- 补充错误 stop reason、ACK timeout、正常/异常 disconnect、marker clear 用例；
- 完整列出所有 changed files，包括内部 message contract 变化；
- 重建 R1 receipt/test/PRD/handoff/manifest，不覆盖旧证据。

## 禁止

- 不修改 frozen schema/fixture/40-source/20-target registry；
- 不为通过静态 verifier 删除必要实现或隐藏 boundary code；
- 不恢复 Offscreen WebSocket 或直连 Runtime fallback；
- 不进入 R2，不跑六视频，不发 Provider 请求；
- 不播放声音；任何 Chrome 命令必须带 `--mute-audio`；
- 不 reset/clean/revert 既有工作树。

## 交付格式

修复完成后报告：状态、changed files、内部/公共合同变化、全部命令及退出码、
真实 run/build/task/candidate ID、PRD 覆盖、cleanup/secret scan、剩余风险、证据目录、
自动化停止原因。此时仍标记 `R1 AWAITING CODEX REFREEZE`，不得自行声明 PASS。

