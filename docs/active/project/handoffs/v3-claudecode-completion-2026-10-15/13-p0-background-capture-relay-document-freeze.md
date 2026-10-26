# P0 Background Capture Relay 文档冻结检查点

日期：2026-10-15。状态：`V8 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

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
- `contracts/v3_media_capture_internal_relay_v9.schema.json`
- `fixtures/v3-media-capture-internal-relay-v9-fixtures.json`
- `verify-stage-b-b5-3-background-capture-relay-v9-contract.py`
- `verify-stage-b-b5-3-background-capture-relay-v9-mutations.py`

Archify v9 已重新交付：showcase validation 9/9，composition 0 error/0 warning；spec SHA-256 `bb3c2fe18352b0b0f5374c882221459e2e1b016ac814f0d6bdd02bc59b5d56f7`，HTML SHA-256 `22502d6f296c1f9a474b0d15e25291953f554beaea3f4eac0a67f8e77255c044`。本轮未执行 browser visual-check；视觉审阅仍 pending，不得把 deterministic deliver 外推为浏览器视觉 PASS。

v1-v8 均禁止实现。v8 第二轮严格复核继续发现 owner manifest 不具备原子 durable publish/父目录 fsync/损坏 fail-closed，且 offscreen sibling 可逃逸 discovery root。v9 固定九类严格消息、Base64/单信用、producer 32 chunks/1.5 MiB、quiesce/drain、RLY9-N01..N30、OM9-N01..N08、24+8+6+13 步 trace、六个 handoff/product 注入点、七类 phase recovery owner 和 Schema/protocol canonical digest；权威 verifier 为 50/50 PASS。同步 staging/fsync/hash/shape 和 owner-manifest temp O_EXCL/file-fsync/atomic-replace/parent-dir-fsync/receipt 屏障必须先于 worker；existing recover composite cleanup 使 acquisition/ASR/product/sink 四类残留全零；唯一持久成功是 SQLite ready/degraded；11 个精确 scope 推导的 40 source 与 20 target 由中央 registry、semantic AST、四递归 roots 和 non-relay allowlist 闭合。

## 3. 下一门禁

先由独立 Claude 与另一独立 reviewer 从零复核 v9 PRD、架构、实际消息 schema、24+8+6+13 trace、八类 manifest 负例、phase recovery、hard-crash composite cleanup、handoff/ownership boundary、SQLite terminal、sender context、11-scope 40/20 错误码分层、递归 discovery 闭包、隐私、A01-A18 和假绿拒绝。两者均 Fatal=0/Major=0 后仍须用户明确授权 R0-R7，才能修改实现。未授权时主干只能修订文档和 fixture 设计。

实施完成后必须先单视频真实静音 canary，再真实故障矩阵，再 immutable candidate 外审。三者未完成前不得启动六视频。

## 3.1 Claude 外审尝试

旧 429 已恢复。v7、v8 首轮与 v8 第二轮均因严格 reviewer 的 Major 被拒绝。当前只接受从修订权威源重新构建的 v9 平铺审计包和新一轮双重独立审查结果，不得复用旧审查结论。

## 4. 恢复规则

Claude 429/529：保存 checkpoint 并停止重复请求。422：区分工具输入与 Provider，保存脱敏 hash/schema/error 后修复，不原样重试。任何部分 run 不得拼接；所有 Chrome 必须 `--mute-audio`；visible UIAutomation 先通知用户。

