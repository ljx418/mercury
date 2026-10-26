# V3 P0 Background Capture Relay v8 Revised External Audit Manifest

日期：2026-10-15。候选状态：`V8 REVISED DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

目录必须平铺，18 个 payload + 本 manifest，共 19 个文件。审查期间 payload immutable；所有哈希均为文件原始字节 SHA-256。

| SHA-256 | 载荷 | 权威源 |
|---|---|---|
| `5624899d04e6c42927b3e0cd182b59ccd02402b9a74f270e2f2ab150610c6d85` | `01-audit-request.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-external-audit-request-v8-2026-10-15.md` |
| `6328845d4f5682a1de100042f263d43da8012d220c15f99b7523cb8e2225ce40` | `02-prd.md` | `docs/active/project/01-prd.md` |
| `c24e645468390271e27a487e3080745b63650708fd7f2ec82d9a81b61d9fe7c4` | `03-architecture.md` | `docs/active/project/02-architecture.md` |
| `91c7704305fa386f9cbdd8b3e2147011098a6c0190aabc42c3669c82b3669dcb` | `04-development-plan.md` | `docs/active/project/03-development-plan.md` |
| `7983e12751fa8f68a438a6b989698692e944a6d5385d41d750c4f485ac748918` | `05-acceptance-plan.md` | `docs/active/project/04-acceptance-plan.md` |
| `ff217a518909baeb20be1d8d83e35d1b7deb559ff492215194a8c8f78d7087d7` | `06-stage-gate.md` | `docs/active/project/stage-gates/v3-media-companion.md` |
| `3b68a6a4ce43c38cca74709d3e3c4f4ed9a527e9bc11059aac48e7cc4ae08eac` | `07-relay-architecture.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-architecture-2026-10-15.md` |
| `a88426a91f04fa46a1995f40daefbbbe004f7f4824f9e7e2e866836dccb86928` | `08-relay-development-plan.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-development-plan-2026-10-15.md` |
| `5dfac6a3821cafdbdd0fd990a9b52bbd266d1dc4384927fcebc11ade494b18e6` | `09-relay-acceptance-plan.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-acceptance-plan-2026-10-15.md` |
| `d85c9e7c022d9c8a29372927c4b0321e3a411a8a2855b10a3bc9ddef0cecfa38` | `10-relay-preimplementation-audit.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-preimplementation-audit-2026-10-15.md` |
| `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | `11-phase0-test-results.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-test-results-2026-10-15.md` |
| `c256c1b9161d5f481485b1f80fbd20dbb571fd6754e84a6e4ace577f505713ba` | `12-v8-reaudit-closure.md` | `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/22-p0-relay-v8-reaudit-closure.md` |
| `3ed7274ec8c4df42ba58620b54d0e26c3e7d07ea6ad2f6e3bba307ea19cf5c73` | `13-current-checkpoint.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-checkpoint-2026-10-15.md` |
| `4b8b2bd9d998fd675e48186ce0c73769b03e4ef53d48d04da783814e9383b968` | `14-relay-architecture.json` | `docs/active/project/design/v3-p0-background-capture-relay-architecture.json` |
| `a3385cef1185ee723945dbc867753a03e8606024110c4eb28a2f324da521e847` | `15-internal-relay-v8.schema.json` | `docs/active/project/contracts/v3_media_capture_internal_relay_v8.schema.json` |
| `e9bd0c0cd93c67136109c268309c5ff72b213e8bd6ded5cbfdc1cb511cfc90c0` | `16-internal-relay-v8-fixtures.json` | `docs/active/project/fixtures/v3-media-capture-internal-relay-v8-fixtures.json` |
| `a0677f83df7692e39d39514c95457c7c9c91fbf66729cd0a4301906866518aac` | `17-internal-relay-v8-verifier.py` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v8-contract.py` |
| `7dee59f87ab891b7dc2c03e88297e64ba284cbef58e9de38bf4295a286e6a6d2` | `18-main-implementation-prompt.md` | `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/14-claudecode-p0-relay-goal-prompt.md` |

## 审查边界

- 从零审查修订 v8；首轮 v8 的 PASS/REPLAN 报告只作历史，不可复用结论。
- 只审文档、机器合同、计划和假绿拒绝；不得运行产品代码、Chrome、Runtime、Provider 或真实媒体。
- `v3-p0-background-capture-relay-architecture.html` 未纳入包；机器源与交付 hash 已在闭环文档记录。
- v1-v7、历史失败 run、产品构建输出和私有 Cookie/API key/raw media 均故意排除。
- 文档 PASS 仍需用户另行明确授权 R0-R7；P1 六视频保持 BLOCKED。
