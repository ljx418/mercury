# V3 P0 Background Capture Relay v9 External Audit Manifest

日期：2026-10-15。候选状态：`V9 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

目录必须平铺，19 个 payload + 本 manifest，共 20 个文件。审查期间 payload immutable；所有哈希均为文件原始字节 SHA-256。

| SHA-256 | 载荷 | 权威源 |
|---|---|---|
| `4b095352603197067b6b28fd0c2b64cc4fd7588e080a2f16174398c6ad0e30e0` | `01-audit-request.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-external-audit-request-v9-2026-10-15.md` |
| `7ae031958be689f9b129f6b8333e27a8ce7e389b6406f79113db86c945b345b3` | `02-prd.md` | `docs/active/project/01-prd.md` |
| `1818b8f0d8801ded021ff53a94acaef3516c2a756b5e53b3277d82a5084d6b67` | `03-architecture.md` | `docs/active/project/02-architecture.md` |
| `00a90fbee1f58b9e733f9055f920d1f11f3fb28609b324dc6c1c94ee2d70b151` | `04-development-plan.md` | `docs/active/project/03-development-plan.md` |
| `164b2e5d771af92a637cc0f65b5238b850de2463effb78d34c21a08c4b446e19` | `05-acceptance-plan.md` | `docs/active/project/04-acceptance-plan.md` |
| `a0e539eb2092944cab53b68a7aade728e02aed2fa219ceaa3f9b7ced2daddd49` | `06-stage-gate.md` | `docs/active/project/stage-gates/v3-media-companion.md` |
| `e2531e8a47154a5ffc0aebe92b2ba160653f2953446cf843a4a6c24d436b35e9` | `07-relay-architecture.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-architecture-2026-10-15.md` |
| `e5188694714cd924700320dfb1db90ce829e98c83c08595f3ea9d081ff2090b8` | `08-relay-development-plan.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-development-plan-2026-10-15.md` |
| `4c003c77ff9a22fb075594cdf3cc3d7d75dedaf682c612ed61756050186668a7` | `09-relay-acceptance-plan.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-acceptance-plan-2026-10-15.md` |
| `09419ee8e26cef221b621d2e0513e0819600f82144005df684fefd61e364cdd4` | `10-relay-preimplementation-audit.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-preimplementation-audit-2026-10-15.md` |
| `6e8f11f655a814b505c3eb21f46a6d481aacef7f153e335fcf0c6b9bad72885b` | `11-phase0-test-results.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-test-results-2026-10-15.md` |
| `e42c5c5011fe800245ad29edee0594291f7e133a71c086ae93257321284f8062` | `12-v9-replan-closure.md` | `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/23-p0-relay-v9-replan-closure.md` |
| `c7bfdfe359b4e8dd4ecc11486e840dd54500fb46b5030e066c8297ec878527ff` | `13-current-checkpoint.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-checkpoint-2026-10-15.md` |
| `bb3c2fe18352b0b0f5374c882221459e2e1b016ac814f0d6bdd02bc59b5d56f7` | `14-relay-architecture.json` | `docs/active/project/design/v3-p0-background-capture-relay-architecture.json` |
| `25239411ab44d46c66da391bf17c92f900a5f4700e870eee9792bf6eb03fea97` | `15-internal-relay-v9.schema.json` | `docs/active/project/contracts/v3_media_capture_internal_relay_v9.schema.json` |
| `4630716df47be737c83c550bcf9f10fce2fb91270cd6ec05c954f56019a39723` | `16-internal-relay-v9-fixtures.json` | `docs/active/project/fixtures/v3-media-capture-internal-relay-v9-fixtures.json` |
| `1e39d7c9d107fd97f54155c618fae8bd65ffec644df1317b887a8dca6722d28a` | `17-internal-relay-v9-verifier.py` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v9-contract.py` |
| `0a3e2a4c20a344437d3dee5002923315ca289b5c30cb42f0978c8b3b399ddb54` | `18-internal-relay-v9-mutations.py` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v9-mutations.py` |
| `71d18915a131a3b9e0876776137bf73333ce9cbe02d41f10d006c372d5564bc4` | `19-main-implementation-prompt.md` | `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/14-claudecode-p0-relay-goal-prompt.md` |

## 审查边界

- 从零审查 v9；v1-v8 的 PASS/REPLAN 报告只作历史，不可复用结论。
- 只审文档、机器合同、计划和假绿拒绝；不得运行产品代码、Chrome、Runtime、Provider 或真实媒体。
- `v3-p0-background-capture-relay-architecture.html` 未纳入包；机器源、交付 hash 与 Archify receipt 已在请求和闭环文档记录。
- 历史失败 run、产品构建输出和私有 Cookie/API key/raw media 均故意排除。
- 文档 PASS 仍需用户另行明确授权 R0-R7；P1 六视频保持 BLOCKED。
