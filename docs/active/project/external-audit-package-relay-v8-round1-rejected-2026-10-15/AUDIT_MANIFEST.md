# V3 P0 Background Capture Relay v8 External Audit Manifest

日期：2026-10-15。候选状态：`V8 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

目录必须平铺，18 个 payload + 本 manifest，共 19 个文件。审查期间 payload immutable；所有哈希均为文件原始字节 SHA-256。

| SHA-256 | 载荷 | 权威源 |
|---|---|---|
| `d2de08016f3a6311ae71e2e44a67895c2c5d829b286b11518bbb2d80317ed02b` | `01-audit-request.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-external-audit-request-v8-2026-10-15.md` |
| `247cfa66a3e687915b62b8d3bea2bc26e2e081a8c82b3da1926570db04a163cb` | `02-prd.md` | `docs/active/project/01-prd.md` |
| `6332f54d84d2c89154294490fe1d0290dab97cc46ae195d02fa994313f497870` | `03-architecture.md` | `docs/active/project/02-architecture.md` |
| `be79ca14e975712312b425e0e5ad01f93cdc7179ee3654f57167c6ba270b7b47` | `04-development-plan.md` | `docs/active/project/03-development-plan.md` |
| `1194fd7189fdc2f0b6987dfc13985e3150354107b9cd5bec3f947daa0e3792c9` | `05-acceptance-plan.md` | `docs/active/project/04-acceptance-plan.md` |
| `a876ea6b01184e81e0fa3d437372aa70363f3d331b101e52d8d7afc257494ed4` | `06-stage-gate.md` | `docs/active/project/stage-gates/v3-media-companion.md` |
| `89c41b7c329bb284defbcb932d197d156cf029f32e57d3583b9f0b06006bf4b0` | `07-relay-architecture.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-architecture-2026-10-15.md` |
| `cc85b048a5362e09ee937ef426fa25f0e30379f9a94332fa96be2634fdfa5297` | `08-relay-development-plan.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-development-plan-2026-10-15.md` |
| `e4fede4860bdd70f39707c646dbf8f4086d87ac7b5c284fbb3b256cd9ceae096` | `09-relay-acceptance-plan.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-acceptance-plan-2026-10-15.md` |
| `4e222ba852795e50d9bd1647a89b9842ab8ab02ae51f7884128eceb4c040b98d` | `10-relay-preimplementation-audit.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-preimplementation-audit-2026-10-15.md` |
| `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | `11-phase0-test-results.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-test-results-2026-10-15.md` |
| `38ef1d523a7a500396b2c6972f7b0e1298a17805ca4d2c382515fa96771e4407` | `12-v8-replan-closure.md` | `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/21-p0-relay-v8-replan-closure.md` |
| `3ed7274ec8c4df42ba58620b54d0e26c3e7d07ea6ad2f6e3bba307ea19cf5c73` | `13-current-checkpoint.md` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-checkpoint-2026-10-15.md` |
| `435befea1d473241feea3368ab3b7ad5d4e2f80827656104b8371d5155ee387d` | `14-relay-architecture.json` | `docs/active/project/design/v3-p0-background-capture-relay-architecture.json` |
| `96c0c324ca2875509ffa9db4d223ece56f6380cd6071c7d3d1d1ea3ac26fda8d` | `15-internal-relay-v8.schema.json` | `docs/active/project/contracts/v3_media_capture_internal_relay_v8.schema.json` |
| `6dcc63194b9667fe1ad435bfb557e33dff286f25bd307f32d1f28ca30f922c83` | `16-internal-relay-v8-fixtures.json` | `docs/active/project/fixtures/v3-media-capture-internal-relay-v8-fixtures.json` |
| `c414eedf2b59ccaa9948df84edcc9c009af9ccb8d82744aec4ab79dbf9213e08` | `17-internal-relay-v8-verifier.py` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v8-contract.py` |
| `d415c9a8d4e2cf1eedecc085ab1de2624448be1f07fda8f3531d4648888a333a` | `18-main-implementation-prompt.md` | `docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/14-claudecode-p0-relay-goal-prompt.md` |

## 审查边界

- 只审 v8 文档、机器合同、计划和假绿拒绝；不得运行产品代码、Chrome、Runtime、Provider 或真实媒体。
- `v3-p0-background-capture-relay-architecture.html` 未纳入包；机器源与交付 hash 已在冻结文档记录。
- v1-v7、历史失败 run、产品构建输出和私有 Cookie/API key/raw media 均故意排除。
- 文档 PASS 仍需用户另行明确授权 R0-R7；P1 六视频保持 BLOCKED。
