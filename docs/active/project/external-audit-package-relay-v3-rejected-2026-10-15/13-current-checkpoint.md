# P0 Background Capture Relay 文档冻结检查点

日期：2026-10-15。状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

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
- `contracts/v3_media_capture_internal_relay_v3.schema.json`
- `fixtures/v3-media-capture-internal-relay-v3-fixtures.json`
- `verify-stage-b-b5-3-background-capture-relay-v3-contract.py`

Archify v3 deliver：showcase 9/9，composition 0 error/0 warning；spec SHA-256 `90e3ae86ed4ca5ec0ef9390420fb389ca8bead306c5e763e6c98a6c839d62d42`，HTML SHA-256 `1df99e27a38331f924c6cbe9ed0de00ad02d3a8ccd53c7cffd57e491b9958d72`。自动 browser visual-check 尚未形成新 v3 证据，视觉审阅 pending。

v1 因 Chrome Port 不支持 transferable `ArrayBuffer` 被拒绝；v2 因 stop/drain 不可达、消息 schema 与 verifier 覆盖不足被拒绝。v3 固定九类严格消息、Base64 JSON、raw 48 KiB/encoded 64 KiB、单信用、producer 32 chunks/1.5 MiB raw outstanding、quiesce/drain、RLY3-N01..N30 和 FailureCode 唯一映射；权威 verifier 为 24/24 PASS。Service Worker tombstone 为六字段 `TRUSTED_CONTEXTS`、18 分钟固定 expiry；重启只 fail old task、等待 cleanup grace、清 marker，绝不续传。sink=0 由 Runtime 全局单 sink + finally + 旧 task cleanup/private-temp 归零 + fresh `started` 共同证明。

## 3. 下一门禁

先由独立 Claude 文档审查复核 v3 PRD、架构、实际消息 schema、状态机、隐私、A01-A14 和假绿拒绝。Fatal=0/Major=0 后仍须用户明确授权 R0-R7，才能修改实现。未授权时主干只能修订文档和 fixture 设计。

实施完成后必须先单视频真实静音 canary，再真实故障矩阵，再 immutable candidate 外审。三者未完成前不得启动六视频。

## 3.1 Claude 外审尝试

19:20 CST 只读外审请求返回 Token Plan 429，exit=1，未产生报告或代码变化。停止记录为 stage-b-b5-3-background-capture-relay-external-audit-risk-stop-2026-10-15.md。外审状态保持 pending；quota 恢复后先 capability probe，再使用 handoff 15，禁止重复当前长请求。

## 4. 恢复规则

Claude 429/529：保存 checkpoint 并停止重复请求。422：区分工具输入与 Provider，保存脱敏 hash/schema/error 后修复，不原样重试。任何部分 run 不得拼接；所有 Chrome 必须 `--mute-audio`；visible UIAutomation 先通知用户。

