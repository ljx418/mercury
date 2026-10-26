# V3 P0 Background Capture Relay v6 外部审计包 Manifest

日期：2026-10-15。载荷数：18；本 manifest 不计算自身 SHA-256。审查者必须先逐项复算，再运行 `17-internal-relay-v6-verifier.py`。本目录在审查期间保持不可变。

| SHA-256 | 平铺文件 | 权威来源 | 审查用途 |
|---|---|---|---|
| `cdc983c3ea9f04c95c8e67ad500140c2b04db0372be83aea7143306dc3f06dbd` | `01-audit-request.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-external-audit-request-v6-2026-10-15.md` | 审计入口与上轮 Major 关闭问题 |
| `562178ae8a5c38e6057d975f9912bc7662eca0c31ae28774ab5144bd84cf907a` | `02-prd.md` | `docs/active/project/01-prd.md` | V3 用户体验、隐私与 P0 产品边界 |
| `304a1de633ceac5857bcbd38cba160ff146aa23318de4311f02d97198bc2666c` | `03-architecture.md` | `docs/active/project/02-architecture.md` | P0 分层、所有权和恢复架构 |
| `d3cdff5b7bff188262d6aaa97152a3c60ff527a2a933c3f6308432c8e2d6dbbd` | `04-development-plan.md` | `docs/active/project/03-development-plan.md` | R0-R7 开发顺序与停止条件 |
| `99348115a5c17b805130ccae8723364afd54b55362fc6bd944bf081d80288c85` | `05-acceptance-plan.md` | `docs/active/project/04-acceptance-plan.md` | P0 固定验收门槛 |
| `0ab8b9a37a1da8b764a7ac002bc771ddf30f81421a8197cf73d07059bcab4864` | `06-stage-gate.md` | `docs/active/project/stage-gates/v3-media-companion.md` | 当前 NO-GO 与下一门禁 |
| `11e5e2c326f584a0184e76fb16e914cac47c6d0e95bf2959a79281b517137a30` | `07-relay-architecture.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-architecture-2026-10-15.md` | 专项代码实体、终态与恢复所有权 |
| `9133284ed375318177a6bf66c8f1018b6d407acfd204621f7127c6627b2ab9f4` | `08-relay-development-plan.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-development-plan-2026-10-15.md` | 专项 R0-R7 详细开发计划 |
| `fea8101f564f1be5342eaec1dc5bb2a1960224d12039fa3013437cfc72c42f3f` | `09-relay-acceptance-plan.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-acceptance-plan-2026-10-15.md` | 专项 A01-A18 与故障矩阵 |
| `62227e0917c422aad86b2d98012a395a24f2544491a885ea06b7ad1325240e19` | `10-relay-preimplementation-audit.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-preimplementation-audit-2026-10-15.md` | 内部风险闭环与授权边界 |
| `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | `11-phase0-test-results.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-test-results-2026-10-15.md` | 历史真实阻塞与离线基线事实 |
| `701d506bc5f0d34ad410273e69e575af88995dcd94c1795f6ea030a98d59370c` | `12-v6-replan-closure.md` | `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/19-p0-relay-v6-replan-closure.md` | v5 Major 到 v6 的逐项关闭 |
| `f4728904a77257207244dfb43eb50c11aa4ab8145f046980e384b28cb941c933` | `13-current-checkpoint.md` | `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/13-p0-background-capture-relay-document-freeze.md` | 跨会话恢复点和当前状态 |
| `f1bb393e05bc75c67e8e64ba55d08203937d44f74d3d9ab550cee0d339eb0789` | `14-relay-architecture.json` | `docs/active/project/design/v3-p0-background-capture-relay-architecture.json` | Archify 机器源 |
| `584ff420c6c179429576fc0cb33916852de663c711b5366ca1279a74dcf3064f` | `15-internal-relay-v6.schema.json` | `docs/active/project/contracts/v3_media_capture_internal_relay_v6.schema.json` | v6 JSON Schema 机器权威 |
| `11c63cfb806348a2ceaa507cd621bcbfb9b8d3d236e05312afa0c723c502523b` | `16-internal-relay-v6-fixtures.json` | `docs/active/project/fixtures/v3-media-capture-internal-relay-v6-fixtures.json` | v6 trace/case 机器权威 |
| `9d0cd344ffc6ecb19b78ee6e493d210f4097be21d97d90776a51933eb8fcf63f` | `17-internal-relay-v6-verifier.py` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v6-contract.py` | 34 项反假绿 verifier |
| `16ec469f7d6b6a10bd3689bfa4208f9977837524f4aa1384a9dc46501d9038b2` | `18-main-implementation-prompt.md` | `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/16-claudecode-v3-completion-goal-v2.md` | P0-P9 持续 goal 与授权边界 |

复算命令：`sha256sum 0[1-9]-* 1[0-8]-*`。任何不一致均为 Fatal，禁止继续审查或实施。

## 有意省略

- 旧 v1-v5 schema/fixture/verifier 和旧审计报告仅保留在历史归档，不进入当前候选，避免版本混用。
- 产品源码、私有 run、Cookie/API key、原始媒体、截图和临时 profile 不属于本次文档审查输入。
- Archify HTML 体积较大且由 `14-relay-architecture.json` 可确定性重建；本包只纳入机器源与 checkpoint 中的 deliver hash。
- 实施候选、真实 Chrome canary 和实现出门证据尚不存在；文档 PASS 只能用于请求明确实施授权。
