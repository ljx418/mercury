# P0 Background Capture Relay 文档冻结检查点

日期：2026-10-15。状态：`V6 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

## 1. 最新事实

最新静音 visible Chrome run：`/tmp/navia-b5-3-canary-1792062210940`。它到达真实 extension action 与 Offscreen start，但以 `capture-start-rejected / V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` 非零结束；Chrome 命令包含 `--mute-audio`，cleanup failure=0，secret leak hit=0。

同一 run 的 Background Service Worker WebSocket probe 为 `opened`，Runtime capture diagnostics 为空。Windows `.NET ClientWebSocket` 也可连接同一 Uvicorn endpoint。结论只支持“Offscreen 网络上下文未把请求送达 Runtime”，不支持 CSP 是根因、Runtime 不可达或 ticket 失效。

离线候选：P0 Node 138/138、Runtime capture pytest 13/13、typecheck/build PASS。它们不证明真实 PCM、SenseVoice 或 product terminal。

## 2. 冻结路线

Background 持有 Runtime WebSocket；Offscreen 只采集/降采样，经精确 sender 的内部 Port 发送有序 PCM。公共 API、30 秒 ticket、可信 action、SourceAuthority、Side Panel materialize ownership、隐私范围和用户步骤保持不变。

文档：

- `stage-b-b5-3-background-capture-relay-architecture-2026-10-15.md`
- `stage-b-b5-3-background-capture-relay-development-plan-2026-10-15.md`
- `stage-b-b5-3-background-capture-relay-acceptance-plan-2026-10-15.md`
- `stage-b-b5-3-background-capture-relay-preimplementation-audit-2026-10-15.md`
- `design/v3-p0-background-capture-relay-architecture.{json,html}`
- `contracts/v3_media_capture_internal_relay_v6.schema.json`
- `fixtures/v3-media-capture-internal-relay-v6-fixtures.json`
- `verify-stage-b-b5-3-background-capture-relay-v6-contract.py`

Archify v6 deliver：showcase 9/9，composition 0 error/0 warning；spec SHA-256 `f1bb393e05bc75c67e8e64ba55d08203937d44f74d3d9ab550cee0d339eb0789`，HTML SHA-256 `c8d707477a143a802272db1a81d3d90ba80b2b43e1bb9adf03608bcb38e18972`。自动 browser visual-check 因当前 WSL 未发现 Chrome executable 而 skipped，视觉审阅 pending；不得把 deterministic deliver 外推为浏览器视觉 PASS。

v1-v4 的拒绝原因保持；v5 严格复核又发现 schema 放宽假绿、sink finalize 误作 terminal、connecting/hard-crash owner 缺失和内部/公开错误码未分层，因此 v1-v5 均禁止实现。v6 固定九类严格消息、Base64/单信用、producer 32 chunks/1.5 MiB、quiesce/drain、RLY6-N01..N30、24 步主链、8 步 Runtime-alive restart 链、6 步 terminal failure 链、五个 terminal 注入点、七类 phase recovery owner 和 Schema/protocol canonical digest；权威 verifier 为 34/34 PASS。Port sender 由五个 MessageSender 字段 + 唯一 Offscreen ExtensionContext 验证；Chrome 116+ 与 WXT `minimum_chrome_version: "116"` 不得弱化。协议终态只在权威 task 迁移和 terminal frame 发送均成功后提交；sink finalize 不是 terminal。

## 3. 下一门禁

先由独立 Claude 与另一独立 reviewer 复核 v6 PRD、架构、实际消息 schema、24+8+6 trace、phase recovery、terminal boundary、sender context、错误码分层、隐私、A01-A18 和假绿拒绝。两者均 Fatal=0/Major=0 后仍须用户明确授权 R0-R7，才能修改实现。未授权时主干只能修订文档和 fixture 设计。

实施完成后必须先单视频真实静音 canary，再真实故障矩阵，再 immutable candidate 外审。三者未完成前不得启动六视频。

## 3.1 Claude 外审尝试

旧 429 已恢复。v5 Claude 审查曾给出 PASS，但严格 reviewer 给出 Fatal=0/Major=5，按更严格结论 v5 已归档 rejected。当前只接受重新构建的 v6 平铺审计包和 v6 双重独立审查结果。

## 4. 恢复规则

Claude 429/529：保存 checkpoint 并停止重复请求。422：区分工具输入与 Provider，保存脱敏 hash/schema/error 后修复，不原样重试。任何部分 run 不得拼接；所有 Chrome 必须 `--mute-audio`；visible UIAutomation 先通知用户。

