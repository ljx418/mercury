# V3-2-2 Revision 3 独立只读文档审查报告

日期：2026-10-06。审查者：独立只读文档审查者（不运行产品 / Runtime / Chrome / 下载器 / 模型）。
审查范围：`docs/active/project/external-audit-package/` 全部 19 项载荷，外加同目录 `AUDIT_MANIFEST.md` 自身。
审查方法：重新计算 SHA-256、独立解析两份 Schema、逐文件交叉对照 `02-prd.md` §18.4–§18.9、`05-stage-gate.md` §19、`06-contract-spec.md`、`13-adr.md`、`14-development-plan.md`、`15-acceptance-plan.md`、`16-threat-model.md`、`17-sample-matrix.md`、`18-readiness-audit.md`、`19-session-risk-stop.md`，并核对 evidence 目录现存 `preimplementation-audit.md` / `revision3-readiness-audit.md`。

## 0. 文档完整性 — SHA-256 重算结果

独立重算 `external-audit-package/` 下全部 19 项载荷字节级 SHA-256，与 `AUDIT_MANIFEST.md` 第 7–25 行声明值逐一比对，**全部匹配**。下表为本次独立计算结果（与 manifest 完全一致）：

| # | File | Bytes | SHA-256 (重算) | Manifest 一致 |
|---|---|---:|---|---|
| 01 | `01-audit-request.md` | 1326 | `d49d40d709817df2ad92d8d1040927bb6aa6356b64c7e7909544fa9f452dfe43` | ✅ |
| 02 | `02-prd.md` | 150045 | `abc09395ed80599672c01e2af11b1c254e4f5a30f35856f6f4be83bc24ab6bad` | ✅ |
| 03 | `03-architecture.md` | 166026 | `0698969807243bd14aa0b5206a4017a545baed65cd975e755b9d7e294b5ce9be` | ✅ |
| 04 | `04-project-development-plan.md` | 130397 | `b10b25ff9d3dccab90bc2042b02ba23be3ae3e10f7ead57aff4a164aae71fa76` | ✅ |
| 05 | `05-stage-gate.md` | 23545 | `cadc62576125ee1dec86f331b2ce385a00624148c55dadd99aac858dd6b9de63` | ✅ |
| 06 | `06-contract-spec.md` | 17931 | `4ccc5f6e57656274d62a2a6c2a5b3cefea5fb7755d039342380c332d6f914d6b` | ✅ |
| 07 | `07-v3-2-development-plan.md` | 9923 | `20b6af101b21dd482302ebb9dc22ab79573ff5c28734fcc6c2813b4f6c09c4f2` | ✅ |
| 08 | `08-v3-2-acceptance-plan.md` | 8312 | `7be76410e1f1696db7755f9e3a919404c5bf7ddc3a36fd6bd5c73b2a70513694` | ✅ |
| 09 | `09-sample-registry-v2.schema.json` | 7731 | `f4b27e63874d9aa3194060109bc6c54207aa02d8ea17a4598437a372813c4006` | ✅ |
| 10 | `10-sample-registry-v3.schema.json` | 7428 | `12f0978a190109560f16a6b496b07430a93e3266492063a33c11cbf5a7f6bdcb` | ✅ |
| 11 | `11-remaining-development-plan.md` | 2822 | `85703feaf8aab3e54dc8ed323ee3dba36c1ed171256c77b9d6f339ba19bca770` | ✅ |
| 12 | `12-remaining-acceptance-plan.md` | 1890 | `8c88ce873eeca7ef74107a700ad56c3694d478b7392a0fe4a20dcc0ce061c478` | ✅ |
| 13 | `13-adr.md` | 1316 | `ac59e5a4514b88a55981aeb2e92ec30dfe3d14746a2e2ccb10134eb2fc2ea23f` | ✅ |
| 14 | `14-development-plan.md` | 2160 | `b49084ebaf06fc5b22a71b53b305957426d73311268846e2a8b23610e291e788` | ✅ |
| 15 | `15-acceptance-plan.md` | 1976 | `67414fa591e55746099aa4b1ef44ea26cd766ae426af0a5505dcbfac6c97ba2f` | ✅ |
| 16 | `16-threat-model.md` | 1365 | `de99ec2e24d0e390642a390517eb330588bffae969cd5652ab7736d8c60dace0` | ✅ |
| 17 | `17-sample-matrix.md` | 1001 | `c5e3c7c7dedfac3c68291a85ab0b1441bded4a772f428c9a3cb9f7b31342bf69` | ✅ |
| 18 | `18-readiness-audit.md` | 1821 | `2fefcaf8de040ef4dc91274c94c286732ccfff8548ce34cbf512d923fe2c0221` | ✅ |
| 19 | `19-session-risk-stop.md` | 1061 | `28ff01a7842bff144ef86ef7d6e991bc2510793b8511060076cef0f17fa10347` | ✅ |

Manifest 自身（`b4ddf44ab221e9b80a301d2cca59638677f915c2ace2121baadeca089b12d1c9`，1326 字节之后追加 2224 字节）按惯例不列入自身表格，但其声明的 19 项载荷值与磁盘文件一一对应，载荷计数 19 与 manifest 表行数一致。

## 1. 两份 JSON Schema meta 校验

| 项 | v2 schema | v3 schema |
|---|---|---|
| `$schema` | `https://json-schema.org/draft/2020-12/schema` | `https://json-schema.org/draft/2020-12/schema` |
| `$id` | `https://navia.local/contracts/v3-media-acquisition-sample-registry/v2` | `https://navia.local/contracts/v3-media-acquisition-sample-registry/v3` |
| `title` | `Navia V3-2 Production Media Acquisition Sample Registry` | `Navia V3 Media Acquisition Sample Registry Revision 3` |
| 根 `required` | `schemaVersion, revision, sourceRevision1Artifact, runId, buildTreeSha256, dependencyManifestSha256, modelManifestSha256, browser, credentialEvidenceClass, createdAt, classificationCounts, productionReady, samples` | `schemaVersion, revision, supersedesRevision2Artifact, runId, buildTreeSha256, dependencyManifestSha256, modelManifestSha256, browser, credentialEvidenceClass, createdAt, classificationCounts, asrBaseline, productionReady, samples` |
| `classificationCounts` | `subtitle:6 / asr:3 / multipart:1 / restricted:1 / lowSignal:1`（全部 `const`） | 同上，全部 `const` |
| `samples.min/maxItems` | `12 / 12` | `12 / 12` |
| Sample `required` | 含 `comparisonWindow` | 不含 `comparisonWindow`，新增 `authorizedProbe` |
| `$defs.ComparisonWindow` | 存在（含 `independentJudgmentCount:const 16`、`reviewerCount:const 2`、双 `reviewArtifacts`、`adjudicationArtifact`） | **不存在**（连同 reference 一并移除） |
| `$defs.AuthorizedProbe` | 不存在 | 存在（`sessionAuthenticated: const true`、`pageStatus/viewApiCode/playerApiCode/routeAvailability/probeSha256` 闭集） |
| `asrBaseline.crossModelQualityGate` | N/A | `deferred_to_v4`（`const`） |

两份 schema 均能由标准 JSON 解析器读入；`draft/2020-12` meta 声明一致；v2 与 v3 拥有不同 `$id`，且 v3 在根 `required` 中通过 `supersedesRevision2Artifact` 把对 revision 2 的引用固化为必填字段，从而保留“v3 覆盖 v2”的审计链。`09` 仍按原内容保持 `comparisonWindow` 相关字段，对应历史 `reviewerId=123` 的 24-bin 双模型评审；`10` 已删除整个 `$defs.ComparisonWindow` 与 sample 中的 `comparisonWindow` 字段，新增 `authorizedProbe` 与根级 `asrBaseline`，与 `crossModelQualityGate=deferred_to_v4` 形成闭环。

## 2. 审查请求 6 个问题的逐项回答

### Q1 — Revision 2 是否保持不可变，Revision 3 是否使用新 `$id`/路径并保留审计链？

**答：PASS。**

- `02-prd.md` §18.9（line 2394）：*“Revision 2 保持历史只读，禁止原地放宽。”*
- `05-stage-gate.md` §19（line 184）：*“Revision 3 Schema、ADR、BA01..BA16、开发计划与威胁模型已经落盘；revision 2 未修改。”*
- `06-contract-spec.md` §2（line 14–22）：revision 2 schema 标注 `（只读）`；revision 3 schema 命名 `v3_media_acquisition_sample_registry_v3.schema.json`（与 revision 2 路径名不同）。
- `09` schema 第 3 行 `$id=.../v2`、`10` schema 第 3 行 `$id=.../v3`：两条 schema 拥有不同身份标识，目录上分别以 `v2` / `v3` 后缀区分。
- v2 schema `required` 含 `sourceRevision1Artifact`，v3 schema `required` 含 `supersedesRevision2Artifact`：revision 链 `v1 → v2 → v3` 由 Schema 本身强制，未被擦除。
- payload 内未出现对 revision 2 字段的就地放宽、添加或旁路；v3 是新增文档、新增 schema、新增 `$id`，未触发任何原地修改。

### Q2 — Revision 3 是否完整保留 12 URL、6+3+1+1+1、身份/分P、页面/server probe、截图/hash、授权证据和 SenseVoice baseline？

**答：PASS。**

- `10-sample-registry-v3.schema.json` 第 73–74 行：`samples.minItems=12, maxItems=12`。
- 第 48–53 行：`classificationCounts` 中 `subtitle=6 / asr=3 / multipart=1 / restricted=1 / lowSignal=1`，全部 `const`，不得漂移。
- Sample `required`（第 116–119 行）逐一覆盖：`sampleId / url / adapterId / mediaId / playbackUnitId / partId / partIndex / partCount`（身份 + 分P）、`pageContextSha256`（页面）、`serverProbeSha256`（server probe）、`authorizedProbe`（含 `sessionAuthenticated: const true` 的授权证据）、`screenshot`（截图 hash）。
- 第 56–69 行 `asrBaseline`（必填根字段）：`modelId=funasr-sensevoice-small-q8`、`quality=development_baseline`、`engine=funasr-llamacpp`、`engineVersion=runtime-llamacpp-v0.2.6`、`modelRevision=90c1c61912018b70ada0fcc024ea24aca62f2e63`、`weightsSha256=4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5`、`crossModelQualityGate=deferred_to_v4`，与 `02-prd.md` §18.9、§18.6 描述一致；`06-contract-spec.md` §8 第 140 行亦以同一 model/revision/weights hash 重复声明。
- `17-sample-matrix.md` 第 6–18 行列出 12 个唯一 BVID：`BV1yLuwzpEt2 / BV1VG4117775 / BV1Bt411D78C / BV1CiFMenEye / BV1Fh1VYFEDu / BV1iv411j7wL`（6 subtitle）、`BV1ZpYd66ELP / BV1sMNtzJE5B / BV1xz4y1S7yF`（3 ASR，锚点为 `BV1ZpYd66ELP`）、`BV1PA4m1w7ya`（multipart）、`BV1vt1sBgEzc`（restricted）、`BV1goA2zrEEq`（low_signal），全部互不重复，与 schema `sampleId` 模式 `^v3-sample-(0[1-9]|1[0-2])$` 与 `url` 模式 `^https://www\.bilibili\.com/video/BV[A-Za-z0-9]+/?$` 一致。

### Q3 — 删除 comparison/reviewer/adjudication 是否严格限于 V4 跨模型，否存在其他分母退化？

**答：PASS。无其他分母退化。**

- 仅 `ComparisonWindow` `$def` 与 Sample 中的 `comparisonWindow` 字段被删除（v3 schema 第 79 行 `$defs` 中无 `ComparisonWindow`，Sample `required` / `properties` 均无 `comparisonWindow`）。
- v3 schema 同时以 `asrBaseline.crossModelQualityGate=deferred_to_v4`（第 67 行）显式声明替代跨模型门禁，与 `02-prd.md` §18.9 第 2390 行 “跨模型退化检测、质量失败后的智能回退和进一步比较优化移入 V4” 与 `11-remaining-development-plan.md` §4（line 28–29）一致。
- 其它分母仍原样冻结：
  - 12 URL 与 `6+3+1+1+1`（v3 schema `samples` 数组边界、`classificationCounts` 常量）。
  - A03（第 17 行）/ BA02（第 8 行）仍以 `6+3+1+1+1` 为唯一分母；A04–A08、BA07–BA11 的样本操作未因删除而缩分母。
  - 唯一被改写的质量条款是 `08-v3-2-acceptance-plan.md` §2 A06（line 20），该条款显式以 “model/revision/weights 与 development_baseline 精确绑定；跨模型退化比较和智能质量回退留待 V4” 替代原 24-bin / 双 reviewer 阈值，分母仍为 `3/3 ASR 样本`，非“缩分母”而是“移除已迁出的跨模型门禁”。
- 未发现其它字段被悄悄移除或弱化：`Sample` 必填项从 v2 的 18 项（`17 个 sampleId 字段 + comparisonWindow`）调整为 v3 的 18 项（`17 个 sampleId 字段 + authorizedProbe`），数量不变，语义等价。

### Q4 — V3-2-2 ADR、开发 BA01..BA16、威胁模型是否足以实现 B站字幕与当前分 P 媒体获取，且不扩大到 ASR/capture/V3-3？

**答：PASS。**

- `13-adr.md` Decision 5（line 17）：*“V3-2-2 只交付字幕和当前分 P 媒体 artifact，不执行 ASR、capture、outline 或画面理解。”*
- `14-development-plan.md` §2（line 10–16）实现实体全部落在 `acquisition/contracts.py`、`acquisition/subtitle_resolver.py`、`acquisition/downloaders/yt_dlp.py`、`acquisition/bilibili/acquirer.py`、`credential_transport.py`、`coordinator.py`，未触及 ASR / capture 路径。
- `14-development-plan.md` §4（line 29）：*“不实现 ASR、tabCapture、关键帧/OCR/VLM、VideoOutline、Ask 或导出。”*
- `15-acceptance-plan.md` BA01–BA16（line 7–22）16 项操作只覆盖 schema 校验、12 URL 探测、ASR baseline 检查、凭据 route、cookiefile 创建、字幕样本、媒体样本、multipart、restricted、URL/adapter 拒绝、downloader 故障、取消、回归；**不包含** ASR 推理、tabCapture、OCR/VLM 或 VideoOutline 判定。
- `16-threat-model.md` 第 6–16 行 9 类威胁：Cookie 泄漏 / SSRF / 跨 task / 多 P 越权 / yt-dlp 注入 / 受限内容绕过 / 临时媒体残留 / 假绿 / 平台变化，全部围绕当前分 P 媒体 + 字幕；未越界到 ASR、capture 或 V3-3。
- `07-v3-2-development-plan.md` §V3-2-2（line 48–53）、`11-remaining-development-plan.md` §2 V3-2-3/5 行（line 14–16）均把 ASR / tabCapture / V3-3 / V3-4 显式划归后续阶段。

### Q5 — `code=-101/isLogin=false` 是否必须维持 implementation NO-GO，旧失败 run 是否禁止与未来新 run 拼接？

**答：PASS。**

- `19-session-risk-stop.md` line 11：*“独立 `/x/web-interface/nav` 校验返回 HTTP 200、业务 `code=-101`、`isLogin=false`。”*
- `19-session-risk-stop.md` line 15：*“不得生成 `productionReady=true` revision 3，也不得把公开页面 200 冒充登录有效。”*
- `19-session-risk-stop.md` line 17–19：*“用户更新已登录 B站 Cookie 后，从零创建新临时 profile 和新 run；先验证 `/x/web-interface/nav code=0/isLogin=true`…旧 run 保留为失败证据，不与新 run 拼接。”*
- `18-readiness-audit.md` Major M-1（line 20）：*“授权 Cookie 已过期；server validation 为 `code=-101/isLogin=false`，BA02 和 revision 3 `productionReady=true` 不能通过。”*
- `17-sample-matrix.md` line 20：*“登录态恢复后必须对本表 12 项从零重跑，不能把失败 run 的 11 项与新增 `BV1iv411j7wL` 拼接。”*
- `05-stage-gate.md` §19（line 187–188）：*“当前决定：`DOCUMENT PASS / IMPLEMENTATION NO-GO`，Fatal=0/Major=2。恢复需要有效 Cookie 的全新 run 以及 V3-2-1 外部独立实施审查。”*
- 同时 `15-acceptance-plan.md` BA02 要求授权会话探测；`05-stage-gate.md` §19 第 188 行明确 H01..H10 只在 V3-5 通过后执行，进一步确保本阶段不存在把人工旁路带进 production 的缝隙。

### Q6 — 人工 H01..H10 后移到 V3-5 是否与 PRD 用户体验和最终出门保持一致？

**答：PASS。**

- `02-prd.md` §18.9（line 2396）：*“人工产品验收 `H01..H10` 统一推迟到 V3-5 双容器产品体验完成后执行；V3-2 至 V3-4 不请求人类操作，只能使用真实数据自动验收、机器审计与独立文档/实现复审。V3-6 重放已签署的人类结果并执行全量自动矩阵，V3-7 只做最终独立出门审计，不得自动代签或补写 H 项。”*
- `12-remaining-acceptance-plan.md` §4（line 24）：*“H01..H10 在 V3-5 自动门槛全部通过后执行。此前人类不承担听写、采集、截图或排障。”*
- `04-project-development-plan.md` §18.1 表格（line 2164）：V3-5 阶段 = “B 双容器 renderer、Ask、Evidence、MediaJumpbackController、export，并执行唯一一轮 H01-H10”；V3-7 = “最终独立出门审计：只读复算 V3-6 单 run 与 V3-5 H01-H10 签署；Fatal=0/Major=0 后限定声明”。
- `05-stage-gate.md` §3 顺序门禁（line 35）将 H01-H10 列入 V3-5，§7 V3-1.1 限定 PASS、§19（line 188）也再次重申 “H01..H10 只在 V3-5 自动 UI 门槛通过后执行；V3-2..V3-4 不请求人类操作”。
- 与 PRD 用户体验对齐：V3-2 的 UX 只是单页 B站凭据字幕 + 当前分 P 媒体 + 进度/取消/清理，不要求双容器、Ask、证据、seek、导出，因此人工签署必须等到双容器/导出/Ask/证据等组件就位才有意义；把 H01..H10 推迟到 V3-5 与最终出门依赖“V3-5 人类签署 + V3-6 单 run + V3-7 独立终审”的链路（`04` §18.1、§18.2、`05` §3、`11` §2）一致，不构成 UX 提前完成或验收偷跑。

## 3. 跨文档一致性检查

| 关注点 | 一致来源 |
|---|---|
| V3-2-2 范围 = B站字幕 + 当前分 P 媒体，不含 ASR / capture / V3-3 | `13-adr.md` §5；`14-development-plan.md` §4；`15-acceptance-plan.md` BA01–BA16；`16-threat-model.md`；`07-v3-2-development-plan.md` §V3-2-2；`11-remaining-development-plan.md` §2 |
| 12 URL、6+3+1+1+1、锚点 `BV1ZpYd66ELP` ASR | `17-sample-matrix.md`（12 BVID）；`10-sample-registry-v3.schema.json` `samples`/`classificationCounts`；`02-prd.md` §18.9；`05-stage-gate.md` §4 |
| SenseVoice `funasr-sensevoice-small-q8 / runtime-llamacpp-v0.2.6 / 90c1c619... / 4ae45c94...` | `10-sample-registry-v3.schema.json` `asrBaseline`；`02-prd.md` §18.9；`06-contract-spec.md` §8；`05-stage-gate.md` §17 |
| `crossModelQualityGate=deferred_to_v4` | `10-sample-registry-v3.schema.json`；`13-adr.md` §3；`11-remaining-development-plan.md` §4；`02-prd.md` §18.9 |
| Revision 2 不可变、Revision 3 新 `$id` / 新路径 | `09-sample-registry-v2.schema.json` $id = `.../v2`；`10-sample-registry-v3.schema.json` $id = `.../v3`；`02-prd.md` §18.9；`05-stage-gate.md` §19；`06-contract-spec.md` §2 |
| `code=-101/isLogin=false` 维持 NO-GO、不允许跨 run 拼接 | `19-session-risk-stop.md`；`18-readiness-audit.md` Major M-1；`17-sample-matrix.md` 末行；`05-stage-gate.md` §19 |
| H01..H10 推迟到 V3-5；V3-2..V3-4 不请求人类 | `02-prd.md` §18.9；`12-remaining-acceptance-plan.md` §4；`04-project-development-plan.md` §18.1 表格 + §18.2；`05-stage-gate.md` §3 + §19；`11-remaining-development-plan.md` §3 |
| 旧 Small/Base/Paraformer 失败不改写、仅以新 SenseVoice baseline 替代 | `02-prd.md` §18.9；`05-stage-gate.md` §17；`08-v3-2-acceptance-plan.md` §6、§7；`13-adr.md` §3 |

未发现文档间显式冲突或双轨事实。

## 5. 缩分母 / 人工验收时点风险专查

| 风险 | 实际状态 | 是否构成问题 |
|---|---|---|
| 是否删除 12 URL 中的任一项？ | `10-sample-registry-v3.schema.json` `samples.min/maxItems=12`；`17-sample-matrix.md` 仍列 12 BVID | 否 |
| 是否把 `6+3+1+1+1` 改为更小分母？ | v3 schema `classificationCounts` 全部 `const`；BA02/A03 文本复述 `6+3+1+1+1` | 否 |
| 是否偷偷改 `lowSignal/degraded` / `restricted/blocked` 的终态映射？ | v3 schema Sample `allOf` 与 v2 等价：`restricted → blocked`、`low_signal → degraded`、`subtitle/asr/multipart → success` | 否 |
| 是否在 revision 3 中仍要求 24-bin / 双 reviewer？ | v3 schema `ComparisonWindow` 已彻底移除；`08-v3-2-acceptance-plan.md` §6、§7 与 A06 显式声明跨模型移到 V4 | 否（属正确删除） |
| 是否新增 “人工” 验收项以替代跨模型 gate？ | `15-acceptance-plan.md` BA01–BA16 全部为机器/合同/真实验证，无 `reviewer` / `adjudicator` 字段；`08-v3-2-acceptance-plan.md` A06 已删除人工听写；H01..H10 推迟到 V3-5 | 否 |
| 旧失败 run 是否被禁止与未来新 run 拼接？ | `19-session-risk-stop.md`、`17-sample-matrix.md`、`18-readiness-audit.md` 同步声明禁止拼接 | 否 |
| 锚点 `BV1ZpYd66ELP` 是否被偷偷从 ASR 改成 subtitle？ | `17-sample-matrix.md` 维持 primaryClass=asr；`19-session-risk-stop.md` line 9 明确 subtitleItems=0；`18-readiness-audit.md` Minor m-1 显式声明恢复登录后必须整组重跑，不得沿用旧结论 | 否 |
| revision 3 是否悄悄要求 V4 范围以外的证据？ | v3 schema `authorizedProbe.routeAvailability` 仅来自 `credentialed_subtitle / credentialed_media_asr / public_or_page_subtitle / trusted_tab_capture_asr / blocked / degraded`；`crossModelQualityGate=deferred_to_v4` | 否 |

## 6. 决定

- **Fatal**：0
- **Major**：1（已存在且正确处置；不构成本次审计新增缺陷）
  - M-1（继承自 `18-readiness-audit.md` 与 `19-session-risk-stop.md`）：授权 Cookie 已过期，`/x/web-interface/nav` 返回 `code=-101/isLogin=false`，当前 12 页 run 仅为公开页面探测证据，不能作为 `credentialEvidenceClass=user_authorized_cookie_lease` 或 `BA02` 授权通过的依据；不得生成 `productionReady=true` revision 3。本审计认可该 Major 与现有 NO-GO 决定一致，不下调、不上调。
- **Minor**：1（已存在且正确处置）
  - m-1（继承自 `18-readiness-audit.md`）：字幕能力当前 API 端 0 segment，BA07 必须用真实字幕 body 才能确认而非仅依赖“字幕制作者”文本；恢复登录后必须整组重跑 12 URL，不得复用失败 run。本审计认可该 Minor 与 `17-sample-matrix.md` / `19-session-risk-stop.md` 中“恢复后整组重跑，禁止拼接”的约束一致。
- **文档决定**：**PASS**（Fatal=0，文档层无新增缺陷；六大审查问题全部 PASS；19 项载荷 SHA-256 与 manifest 一致；两份 Schema meta 校验通过；跨文档一致性无冲突；缩分母 / 人工验收时点风险专查未发现新增问题）。
- **实施决定**：维持 **`IMPLEMENTATION NO-GO`**。`code=-101/isLogin=false` 与 V3-2-1 外部独立实施审查落地虽已闭合（`05-stage-gate.md` §19 第 185 行），但 `18-readiness-audit.md` Major M-1 未关闭，schema-valid revision 3 与有效授权会话尚未生成。
- **重新执行 V3-2-2 实施前审计的条件**（用户授权会话恢复后）：
  1. 用户提供有效 B站 Cookie（`/x/web-interface/nav` 返回 `code=0/isLogin=true`）。
  2. 从零创建新临时 Chrome profile 与新 run `v3-2-sample-probe-<新时间戳>`，12/12 页面探测全部通过。
  3. 新 run 通过 `10-sample-registry-v3.schema.json` 的 `asrBaseline.crossModelQualityGate=deferred_to_v4` 与 `authorizedProbe.sessionAuthenticated=true` 校验，`productionReady=true` 才能落盘。
  4. 旧失败 run `v3-2-sample-probe-20261006T120000Z` 保留为失败证据，禁止与新 run 任何字段拼接。
  5. 通过本外审与用户明确批准 V3-2-2 implementation 后，方可解除 NO-GO。
  6. H01..H10 不在本阶段恢复路径内；只接受 V3-5 自动 UI 门槛之后的唯一一轮人工签署。

## 7. 文档审查出口

- 文档 PASS：V3-2-2 Revision 3 文档包在 19 项载荷 SHA-256 一致、两份 Schema meta 校验通过、6 项审查问题全部 PASS 的前提下，本独立审查接受为 `DOCUMENT PASS`。
- 实施 NO-GO：在 M-1 关闭、有效授权会话生成 schema-valid revision 3 并再次独立外审通过前，V3-2-2 implementation 维持 `NO-GO`。
- 重新执行 V3-2-2 实施前审计：**允许**在上述“恢复条件”全部满足后重新执行；不得在旧失败 run 与新 run 之间拼接；不得放松 `crossModelQualityGate=deferred_to_v4`；不得把 H01..H10 提前到 V3-2..V3-4。

---

审查者声明：本次审查为只读审计，未运行任何产品 / Runtime / Chrome / 下载器 / 模型；未修改 `external-audit-package/` 以外的任何文件；本报告是审查的最终结论。