# P0 Background Capture Relay 第三轮独立架构审查与修订记录

日期：2026-10-15。审查者：独立只读 subagent。历史状态：v2 随后被第四轮独立审查拒绝；当前以 round4 修订记录与 v3 合同为准，实施仍 NO-GO。

## 1. 独立审查原始结论

v1 候选为 `DOCUMENT REPLAN`，Fatal=2、Major=6、Minor=2：

- Fatal：Chrome `runtime.Port` 使用 JSON serialization，不能实现 transfer-list `ArrayBuffer` 合同。
- Fatal：新 Service Worker 没有旧 socket/ticket 或 Runtime 查询 API，不能自行验证 active sink=0。
- Major：streamId 既被禁止又出现在 start；正例缺 stop/drain/finalize；verifier 只核 step 编号；producer 背压未闭合；marker 缺 phase/expiry；FailureCode 映射不唯一。
- Minor：sender frame/document/incognito 未冻结；captureSessionId 熵、保留期和 storage access level 未冻结。

审查期间包发生修订，因此该轮只作为问题发现记录，不是 immutable candidate 外审证据。

## 2. v2 修订

- 数据面改为 Base64 JSON；raw <=49,152 bytes，encoded <=65,536 chars。
- credit window=1、Runtime in-flight=1；Offscreen local + Port unacked + Runtime in-flight 总计 <=32 chunks/1,572,864 raw bytes。
- streamId 只允许出现在 Background -> Offscreen 的一次性 start；禁止进入 chunk、日志、storage、marker、公开证据。
- sender 同时冻结 extension ID、exact URL、tab absent、frame absent/0、documentId 首次绑定、incognito 一致。
- positive trace 扩展为 15 步，明确 marker write、Runtime start、Port start/ready/credit、chunk/decode/ACK、stop、drain、Runtime finalize/cleanup、marker clear。
- 负例改为 RLY2-N01..N24；sequence、chunk、protocol、backpressure、disconnect、cleanup 均唯一映射 FailureCode。
- marker 改为 `TRUSTED_CONTEXTS`，字段闭集为 schemaVersion/captureSessionId/taskId/startedAt/phase/expiresAt；captureSessionId 由 192-bit 随机数生成，最长保留 1,020,000 ms。
- 新 worker 只终结旧 task、等待 cleanup grace、清 marker并允许 fresh grant。sink=0 的证据所有者为 Runtime WebSocket finally + 真实集成观察者；后续 fresh capture 必须收到 `started`。

## 3. 机器复算

v2 权威：

- `contracts/v3_media_capture_internal_relay_v2.schema.json`
- `fixtures/v3-media-capture-internal-relay-v2-fixtures.json`
- `verify-stage-b-b5-3-background-capture-relay-v2-contract.py`

当前 verifier 19/19 PASS。它只证明 schema、常量、映射和 trace 静态一致，不证明 Chrome capability、真实 PCM、Runtime cleanup 或产品终态。

## 4. 剩余门禁

1. 重建 immutable 平铺审计包后不得在审查期间修改。
2. ClaudeCode 独立文档审查必须逐项复算 v2，不得只采信 19/19 summary。
3. Fatal=0/Major=0 后仍需用户明确授权 R0-R7。
4. 实施首步必须用真实 Chrome capability test 证明 Base64 Port、sender fields 和单信用链；失败返回文档阶段。
5. P0 单视频真实静音 canary、故障矩阵和实施外审通过前，P1 六视频继续 NO-GO。
