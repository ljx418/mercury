# V3 P0 Background Capture Relay v7 External Audit Manifest

日期：2026-10-15。候选状态：`V7 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

目录必须平铺，18 个 payload + 本 manifest，共 19 个文件。审查期间 payload immutable；所有哈希均为文件原始字节 SHA-256。

| SHA-256 | 载荷 | 权威源 |
|---|---|---|
| `42adbbc393c66a181503d35d61f1ebb201d50695dce5b02640d9cc42d4f8d1eb` | `01-audit-request.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-external-audit-request-v7-2026-10-15.md` |
| `38a2471d969873405f6a0e332e786ef5a4b292fb95e74e77aa956e627ca73cec` | `02-prd.md` | `docs/active/project/01-prd.md` |
| `514bc366f8223884969486ead924975746e5bbc83f94a682dd1fcd70dd85e46c` | `03-architecture.md` | `docs/active/project/02-architecture.md` |
| `db72a15470a72a737be224793ba6c0f36e36af3e09d5e2559c6c080e2837ed7b` | `04-development-plan.md` | `docs/active/project/03-development-plan.md` |
| `d8d97b973944252c365aa14214b5f65a7666103b54e3d67560bad2126fb77b63` | `05-acceptance-plan.md` | `docs/active/project/04-acceptance-plan.md` |
| `12cc84ef70f1bdb019ff58c824d4865b40fa8cf8290a5960160f03776fbe6442` | `06-stage-gate.md` | `docs/active/project/stage-gates/v3-media-companion.md` |
| `5d3498e515aac39f5a90aa17691d688b425dcb85a626da13c4d0466a1e440613` | `07-relay-architecture.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-architecture-2026-10-15.md` |
| `5dbaa73eb4df60e186817758de8c33f44638b5788e72bd842332f6373d9f2579` | `08-relay-development-plan.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-development-plan-2026-10-15.md` |
| `60fc84ad167fd9381c4268d6398e4f0b27aa97ee4005a5ef4b5eb1f9dbf07d95` | `09-relay-acceptance-plan.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-acceptance-plan-2026-10-15.md` |
| `87b783e37f974bb7e4786f1f97a6c26d8fbfdc5b6742539e73c9e415040dfd4d` | `10-relay-preimplementation-audit.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-preimplementation-audit-2026-10-15.md` |
| `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | `11-phase0-test-results.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-test-results-2026-10-15.md` |
| `ae102caecb7a029b530c9b6ce9af99c3c1f36cd86991dcdcdb0738fef81860dc` | `12-v7-replan-closure.md` | `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/20-p0-relay-v7-replan-closure.md` |
| `3ed7274ec8c4df42ba58620b54d0e26c3e7d07ea6ad2f6e3bba307ea19cf5c73` | `13-current-checkpoint.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-checkpoint-2026-10-15.md` |
| `f62f3767683708e099dea4b63b9883698827795fbd3f578690dc2fcee35d508b` | `14-relay-architecture.json` | `docs/active/project/design/v3-p0-background-capture-relay-architecture.json` |
| `e7b8d1e2dc5bfe76db6210cf037499b60344afe937d6ce4a5cc33383a20c8913` | `15-internal-relay-v7.schema.json` | `docs/active/project/contracts/v3_media_capture_internal_relay_v7.schema.json` |
| `c6301cdf24688c1cb9fa57200f758ef12f78d950be1cd5f7fc6136f43b39b319` | `16-internal-relay-v7-fixtures.json` | `docs/active/project/fixtures/v3-media-capture-internal-relay-v7-fixtures.json` |
| `9b27f284ad6e685723e8a977ca2cac55876c9271de8e57627f3ba4dd7b2bcd1f` | `17-internal-relay-v7-verifier.py` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v7-contract.py` |
| `761929913359844b95ae731a281c0acab4c82ab6bb8a0633b5c15c6ac7116fe3` | `18-main-implementation-prompt.md` | `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/14-claudecode-p0-relay-goal-prompt.md` |

## 审查边界

- 只审 v7 文档、机器合同、计划和假绿拒绝；不得运行产品代码、Chrome、Runtime、Provider 或真实媒体。
- `v3-p0-background-capture-relay-architecture.html` 未纳入包以控制文件数；`14-relay-architecture.json` 是机器源，HTML hash/交付收据写入冻结文档并可从权威源复算。
- v1-v6、历史失败 run、产品构建输出和私有 Cookie/API key/raw media 均故意排除。
- 文档 PASS 仍需用户另行明确授权 R0-R7；P1 六视频保持 BLOCKED。
