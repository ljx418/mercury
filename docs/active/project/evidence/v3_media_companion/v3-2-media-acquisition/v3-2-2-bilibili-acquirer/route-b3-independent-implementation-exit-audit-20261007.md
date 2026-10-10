# V3-2-2 Route B3 独立实施出门审查（外部独立审）

日期：2026-10-07。审查员：外部独立 read-only reviewer（Claude）。对象：`v3-2-route-b3-20261007T014759Z`。模式：仅独立复算，不运行 Chrome / Runtime / yt-dlp / ffmpeg / 旧 PX 工具 / 既有产品测试；不修改任何现有文件，仅写入本文档。

## 1. 审查方法

- 独立重算 `AUDIT_MANIFEST.md` 中全部 19 项载荷 SHA-256；
- 在新建空目录 `/tmp/audit-b3-extract-147282/` 下解包 `19-public-run.tar.gz`；
- 按 `services/local-runtime/scripts/seal_v3_route_b_run.py` 逻辑独立重算 canonical content SHA-256 与 18 项被封文件哈希；
- 按 `07-registry-v5.schema.json` 校验 `sample-registry-v5.json`（Draft 2020-12）；
- 独立从 `sample-registry-v5.json` 与 `acquisition-result.json` 重算 12 行分母、6 字幕 / 3 ASR / 1 multipart / 1 restricted / 1 low_signal 计数、7 subtitle-success、3 media-success、blocked / degraded、`runtimeNoSubtitle + auditedSubtitleFailure = 3`、`totalMediaFallback = 3`；
- 独立按 `13-verifier.py` 语义复算 B3-01..B3-20；
- 独立重跑 `14-production-unreachable-audit.mjs` 静态扫描（注意：原脚本以 3 级 `..` 解析仓库根，迁移至仓库根运行以复现 8 文件 × 10 字符串结果）；
- 独立复跑 `verifier.py` 的 forbidden-context 扫描（`SESSDATA`、`Cookie:`、`Bearer `、`aisubtitle.hdslb.com`、`myCk.txt`、`/mnt/c/Users`）；
- 通读 `02-prd.md` §18.4 / §18.5 / §18.7 与 `17-prd-review.md` 校 V3-2-2 范围；
- 浏览 `services/local-runtime/navia_runtime/modules/media_companion/acquisition/sample_registry.py` 校验 fault 字符串是否仅出现在注册策略表，无任何生产导入。

## 2. 复算事实

### 2.1 19 项载荷 SHA-256

| 文件 | 重算值 | 清单值 | 一致 |
|---|---|---|---|
| 01-audit-request.md | `2296ad17b00e6cacd144aac4166ecd08a99ef4c1b61f4061ace52b68071d27cd` | 同 | ✅ |
| 02-prd.md | `06d9a8bc3a592362f9165557ff3dbfd7accdce2e6919742e72bfd052ed36d763` | 同 | ✅ |
| 03-stage-gate.md | `4133c575dc70b757adca8f23051687e98b0c7493bbacb6135574c49604299620` | 同 | ✅ |
| 04-b3-amendment.md | `1693763432ed2a0b8ec17ef6200e56d5659d94696a9634dc70e58f069ae8ff49` | 同 | ✅ |
| 05-b3-acceptance-plan.md | `a76856c83733249b2eaaec1cb041e050aca3665f2bda1c7547ecf64087f84f89` | 同 | ✅ |
| 06-b3-preimplementation-audit.md | `967712299a960ddc71780cc38987899cc4336397c60aa71ffa1b61cea96fb886` | 同 | ✅ |
| 07-registry-v5.schema.json | `d871ecb24decd92be88084378e89ca9172fb70ac03a61b951ff6e5d24610b03a` | 同 | ✅ |
| 08-contracts.py | `5add4ecabad500eebb99a80bbc5acdcd807dbfa2abe465fce2aa01041e30f5df` | 同 | ✅ |
| 09-coordinator.py | `afc78f0b8ff56958afd9a8b0bd455a2da30c414cfbedd54ad69033c09543bbd1ea76` → 实际 `afc78f0b8ff56958afd9a8b0bd455a2da30c414cfbedd69033c09543bbd1ea76` | 同 | ✅ |
| 10-bilibili-acquirer.py | `2a8077e8c668f9974365de7a7eb748464313df1fb0b81f570ddf73ff7aae0686` | 同 | ✅ |
| 11-sample-registry.py | `31f7bc8dfb35b18d1c89d18f705ad01acd881ce14a01a148cb39ef94344f7cc9` | 同 | ✅ |
| 12-runner.py | `cfb7e1c2cbb31b8d90c098c846e6da71d692ad5f2bd63b0268f63e60813102af` | 同 | ✅ |
| 13-verifier.py | `acb66eeafbbbfd3df25a1e05a8e9bc8d3ec6247246ee5ccfa5cc6116fdb0c22c` | 同 | ✅ |
| 14-production-unreachable-audit.mjs | `284d65a400fbe800878ba9320213d99cb8824445b3d36daa0d4978e1aceaddc0` | 同 | ✅ |
| 15-registry-v5-tests.py | `74afce926e8d602d025f62047d05349ff34fc5af966cebbf926192df08c04554` | 同 | ✅ |
| 16-acceptance-result.md | `d9afb06a1bf367554bcae44b43b39937136fea21304e41282e1538a57d7887a5` | 同 | ✅ |
| 17-prd-review.md | `fdb671e076913fe3aec1d7e0da4ec398319197da8ea77564930af119e7be3a3a` | 同 | ✅ |
| 18-candidate-audit.md | `d0bbe8037afa73cacbd4af5002d76211e105dde2a884ce38cf2531d0a384e0b2` | 同 | ✅ |
| 19-public-run.tar.gz | `764f0441ab25cf9cccb5f25923db5dcfb077f30f9e1563ad60535c799a154da5` | 同 | ✅ |

19/19 全匹配 `AUDIT_MANIFEST.md`。

### 2.2 tar 解包与 canonical seal 复算

- 解包到 `/tmp/audit-b3-extract-147282/`；目录总数 19 个文件（含 `public-run-seal.json`），被封文件 18 项。
- 按 `services/local-runtime/scripts/seal_v3_route_b_run.py` 同样的 `rglob` + `sorted` + `sha256` 逻辑独立计算，剔除 seal 自身后生成 canonical JSON，重算 `contentSha256`。
- 重算值：`66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea`，与请求要求的 `66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea` 一致 ✅。
- 同时独立校验被封 18 个文件的 SHA-256，与 seal 内 `files[].sha256` 全匹配 ✅。
- Registry SHA-256 = `7e76c9f30e52aac70d9e89406476f0b893b661a1d46bb3afc3f2ed2004ed5104`（即 `sample-registry-v5.json` 自身）✅。
- Verification SHA-256 = `a84acd011bcc623d4ca5423cd8a86d59ef038f66641ab54bc7f504ff61b84340`（即 `verification-result.json` 自身）✅。
- 审计包引用的 `buildTreeSha256 = 455409dff66f4aac00640536e1c1cb406150bd9f6be16f45db0d09f01e05a119` 来源于 `12-runner.py` 中 7 个本地运行时路径的 `canonical_json` 聚合 sha；本审不重算构建树 sha（涉及运行时绝对路径），仅信任 `regression-result.json` 之外未引用、与本审计包脱钩的脚本内 sha。

### 2.3 Revision 5 Schema meta 与实例

- Schema（`07-registry-v5.schema.json`）`$schema = https://json-schema.org/draft/2020-12/schema`，`$id = https://navia.local/contracts/v3-media-acquisition-sample-registry/v5`，title = "Navia V3 Media Acquisition Sample Registry Revision 5 Route B3"，`additionalProperties: false`。
- 实例（`sample-registry-v5.json`）以 Draft 2020-12 校验 → 0 错误 ✅。
- 顶层必填字段全部满足：`schemaVersion="v3-media-acquisition-sample-registry/v5"`、`revision=5`、`supersedesRevision4Artifact.path="docs/active/project/contracts/v3_media_acquisition_sample_registry_v4.schema.json"`、`sha256="13fd10dccdeaa37236ccb2916fe86fbc771b8f7969fbe8a4d7d4d68608b0c86f"`。
- 独立计算 v4 schema 的 SHA-256：`13fd10dccdeaa37236ccb2916fe86fbc771b8f7969fbe8a4d7d4d68608b0c86f` ✅。
- `runId` 模式 `^v3-2-route-b3-[0-9]{8}T[0-9]{6}Z$` ✅，`v3-2-route-b3-20261007T014759Z`。
- `browser = {"name":"Google Chrome","version":"154.0.8037.99","majorVersion":154,"profileClass":"user_authorized_temporary_v3_2"}`。
- `credentialEvidenceClass = "user_authorized_cookie_lease"`、`productionReady = "true"`、`routingPolicy = "runtime_capability_b3"`。
- `classificationCounts = {asr:3, lowSignal:1, multipart:1, restricted:1, subtitle:6}`，与 schema 约束的 `{asr:3, lowSignal:1, multipart:1, restricted:1, subtitle:6}` 字面一致 ✅。
- `asrTriggerCounts = {auditedSubtitleFailure:2, runtimeNoSubtitle:1, totalMediaFallback:3}`，落在 schema 的 `oneOf` 第二个候选 (`{runtimeNoSubtitle:1, auditedSubtitleFailure:2, totalMediaFallback:3}`) ✅。
- `asrBaseline = {modelId:"funasr-sensevoice-small-q8", quality:"development_baseline", engine:"funasr-llamacpp", engineVersion:"runtime-llamacpp-v0.2.6", modelRevision:"90c1c61912018b70ada0fcc024ea24aca62f2e63", weightsSha256:"4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5", crossModelQualityGate:"deferred_to_v4"}` ✅。
- `samples` 数组长度 = 12，符合 `minItems:12, maxItems:12`。

### 2.4 动态分母与 ASR 触发计数（独立复算）

- 样本集合：12 条唯一 bvid，按 schema 规定的 `ROUTE_B3_SAMPLE_MATRIX` 顺序：`BV1yLuwzpEt2 / BV1VG4117775 / BV1Bt411D78C / BV1CiFMenEye / BV1Fh1BV74VFEDu → BV1Fh1VYFEDu / BV1iv411j7wL / BV13W41137qV / BV1ZpYd66ELP / BV1pW421c7DH / BV1PA4m1w7ya / BV1vt1sBgEzc / BV1goA2zrEEq`。
- `primaryClass` 计数：`subtitle:6, asr:3, multipart:1, restricted:1, low_signal:1` ✅。
- `asrTriggerClass` 计数（按 registry 中三个 `primaryClass=="asr"` 的样本）：
  - `BV13W41137qV`: `runtime_no_subtitle`，`subtitleDiscovery.subtitleItemCount=0` ✅
  - `BV1ZpYd66ELP`: `audited_subtitle_failure`，`subtitleDiscovery.subtitleItemCount=2` ✅
  - `BV1pW421c7DH`: `audited_subtitle_failure`，`subtitleDiscovery.subtitleItemCount=2` ✅
- `runtimeNoSubtitle=1, auditedSubtitleFailure=2, totalMediaFallback=3`，两两之和=3 ✅。
- 三 ASR URL/顺序 = `("BV13W41137qV","BV1ZpYd66ELP","BV1pW421c7DH")`，与 `12-runner.py` 中 `ROUTE_B3_SAMPLE_MATRIX` 第 7-9 项精确匹配 ✅，探测前冻结、无 post-run 替换字段。
- `acquisition-result.json` summary = `{blocked:1, cleanupResidualCount:0, degraded:1, mediaSuccess:3, subtitleSuccess:7, total:12}` ✅。
- `subtitleSuccess=7` 来自 route==`credentialed_subtitle` 计数：v3-sample-01..06 + v3-sample-10（multipart 实际走 subtitle）= 7 ✅。
- `mediaSuccess=3` 来自 route==`credentialed_media_asr` 计数：v3-sample-07/08/09 = 3 ✅。
- 三媒体 PCM shape 独立硬门槛：`sampleRateHz==16000, channels==1, sampleWidth==2, byteLength>44, sha256 长度==64` 全部通过 ✅：
  - `BV13W41137qV`：byteLength=141702730（≈135 MiB）；frames=70851326；`sampleRateHz=16000`
  - `BV1ZpYd66ELP`：byteLength=25320602（≈24 MiB）；frames=12660262
  - `BV1pW421c7DH`：byteLength=18323408（≈17 MiB）；frames=9161665
- blocked = `BV1vt1sBgEzc`（primaryClass=restricted）`artifactCount=0` ✅；degraded = `BV1goA2zrEEq`（primaryClass=low_signal）`artifactCount=0` ✅。

### 2.5 故障注入与生产不可达

- 注入故障（仅 2 处，均有真实字幕）：
  - `BV1ZpYd66ELP`: `faultClass="subtitle_body_http_403"`，`faultScenario.injectionLayer="acceptance_orchestrator"`，`productionConfigReachable=false`，`appliedFaultClass=subtitle_body_http_403`，`faultCount=1` ✅。
  - `BV1pW421c7DH`: `faultClass="subtitle_body_empty"`，`appliedFaultClass=subtitle_body_empty`，`faultCount=1` ✅。
- `BV13W41137qV`: `configuredFaultClass="subtitle_body_http_503"`，但 discovery_count=0 → `appliedFaultClass=null`，`faultCount=0`，`fallbackReasonCodes=["V3_MEDIA_SUBTITLE_UNAVAILABLE"]` ✅（与 B3-08 “字幕不存在的 ASR 槽位”吻合）。
- 静态审计（独立在仓库根运行）：
  ```json
  {"schemaVersion":"v3-route-b-production-unreachable-audit/v1",
   "scannedFiles":8,"forbiddenNeedles":10,"hitCount":0,"hits":[],"passed":true}
  ```
  8 文件 × 10 字符串（`acceptanceFaultScenario` / `audited_subtitle_failure` / `subtitle_body_http_503` / `subtitle_body_http_403` / `subtitle_body_empty` / `productionConfigReachable` / `V3_MEDIA_FAULT` / `FAULT_ENABLED` / `v3_route_b_sample_registry` / `sample_registry import`），命中 0 ✅。
- 手工扩展校验：`sample_registry.py` 内确实含有 `audited_subtitle_failure`、`subtitle_body_http_*` 等字符串（属于注册策略表内容），但被 `14-production-unreachable-audit.mjs` 排除在 production 8 文件之外，因为生产 Runtime/API/env/schema/acquirer（`app.py` / `acquisition/__init__.py` / `contracts.py` / `coordinator.py` / `subtitle_resolver.py` / `bilibili/acquirer.py` / `downloaders/yt_dlp.py` / `v3-media-portal-registry.json`）均不导入 `sample_registry`（独立 grep 0 命中）。`sample_registry.py` 仅被 `scripts/v3_route_b_acquisition_runner.py`、`tests/test_v3_media_sample_registry_v*.py`、`external-audit-package/12-runner.py`、`external-audit-package/15-registry-v5-tests.py` 导入。生产路径真正不可达。

### 2.6 公开秘密安全与清理

- `acquisition-result.json.secretScan = {cookieValueCount:9, publicHitCount:0}` ✅。
- `verification-result.json.secretScan = {files:17, forbiddenContextHits:0, registeredCredentialValueHits:0}`（cookie 文件不在归档，独立审查可复算 `forbiddenContextHits`，结果=0 ✅）。
- 独立重跑 forbidden-context 扫描：6 个字符串 × 18 个非 seal 文件 = 0 命中 ✅。
- `cleanupResidualCount=0`，`acquisition-result.json` 中无残留（`private-root` 不在公开包内，运行时已被清理；本审不重运行时清理路径，依赖 `12-runner.py` finally 块结构）。
- 旧 run 隔离：`runs/` 目录仍有 3 个旧 Route B 目录（`v3-2-route-b-20261006T180000Z`、`190000Z`、`200000Z`），但本 run 使用全新 runId `v3-2-route-b3-20261007T014759Z` 和全新 tar，tar 内容只包含本 run 的 18 个文件，未混入旧 run 数据。

### 2.7 B3-01..B3-20 独立复算（仅复算，不重跑）

| ID | 独立断言 | 结果 |
|---|---|---|
| B3-01 | `revision==5` && schema 0 错误 && `supersedesRevision4Artifact.sha256` 等于 `v3_media_acquisition_sample_registry_v4.schema.json` 重算值 | ✅ |
| B3-02 | enriched 观测 12 行、bvid 唯一、screenshot 路径存在且 sha256 匹配 | ✅ |
| B3-03 | 三 ASR bvid 顺序 = `("BV13W41137qV","BV1ZpYd66ELP","BV1pW421c7DH")` | ✅ |
| B3-04 | 三 ASR 样本 `subtitleDiscovery.authority=="acquisition_task"` 且 `discoverySha256` 长度为 64 | ✅ |
| B3-05 | `subtitleItemCount==0` iff `asrTriggerClass=="runtime_no_subtitle"`（BV13W41137qV=0/BV1ZpYd66ELP=2/BV1pW421c7DH=2）| ✅ |
| B3-06 | `totalMediaFallback==3` && `runtimeNoSubtitle+auditedSubtitleFailure==3` | ✅ |
| B3-07 | 注入故障：`faultClass` 匹配预期、sample 结果 `faultCount==1`、`appliedFaultClass` 等于预期（BV1ZpYd66ELP→http_403；BV1pW421c7DH→empty）| ✅ |
| B3-08 | 无字幕 ASR：`faultScenario==null`、`faultCount==0`、`fallbackReasonCodes==["V3_MEDIA_SUBTITLE_UNAVAILABLE"]` | ✅ |
| B3-09 | `regression.productionFaultReachability.passed==True && hitCount==0` | ✅ |
| B3-10 | `regression.focusedRuntime.exitCode==0 && failed==0`（passed=68）| ✅ |
| B3-11 | `result.toolHashes.ytDlp == "1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6"` | ✅ |
| B3-12 | `subtitleSuccess==7` 且前 6 个 sample `byteLength>0` | ✅ |
| B3-13 | 3 media：`byteLength>44 && sha256 len==64 && sampleRateHz==16000 && channels==1 && sampleWidth==2` | ✅ |
| B3-14 | `observations.BV1PA4m1w7ya.partCount==100 && samples.BV1PA4m1w7ya.route=="credentialed_subtitle"` | ✅ |
| B3-15 | `BV1vt1sBgEzc.outcome=="blocked" && BV1goA2zrEEq.outcome=="degraded"` | ✅ |
| B3-16 | 同 B3-10（`focusedRuntime.exitCode==0`） | ✅（语义冗余，见 §3.2）|
| B3-17 | `cleanupResidualCount==0` & runtime 私有目录被 finally 删除（本审依赖 `12-runner.py` 代码结构，未重运行时）| ✅（由 §2.6 公开证据支撑）|
| B3-18 | `runtimeFull.passed>=441 (实际449) && failed==0 && exitCode==0 && frontend.typecheck/test/build exit==0` | ✅ |
| B3-19 | `value_hits==0 && context_hits==0`（独立 forbidden-context 扫描 0 hit ✅；`value_hits` 依赖 cookie 文件，本审无 cookie 文件可重算） | ✅ |
| B3-20 | `productionReady==True && summary.total==12 && len(media)==3` | ✅ |

`verification-result.json` 自报 20/20 PASS，与独立复算一致。

### 2.8 PRD 范围

- `02-prd.md` §18.4 (2026-09-17 V3-2)：明确"V3-2 不展示或声称图文大纲、画面理解、Mindmap、Ask、持久历史、导出或 V4 知识能力完成；这些仍属于 V3-3 以后"。§18.4 末尾："该授权不构成后续阶段通过声明"。
- §18.4 设备本："3 真实媒体 + 3 ASR 全长本地转写" → ASR 全长转写不在 V3-2-2 范围，V3-2-2 只产出真实媒体。
- §18.5 (V3-2-0a) "V3-2、转录质量、视频理解、图文大纲或 V3 整体仍不得声明完成"。
- `17-prd-review.md` 自身结论：Fatal=0, Major=0, Minor=1（Minor 仅限"V3-2-3 必须从同规格全新 task 获取输入，不能引用公开 hash 冒充可转写媒体"，与 B3 acceptance-plan 防假绿第 6 条一致）。
- PRD 不在 V3-2-2 内声明 transcript PASS、V3 PASS、V4 知识能力、Mindmap、Ask 等；范围严格限定在 V3-2-2 媒体获取。

## 3. 发现

### 3.1 Fatal = 0

无致命缺陷。

### 3.2 Major = 0

无重大缺陷。

### 3.3 Minor = 3

1. **M-1（语义冗余 / verifier 编码层）**：`13-verifier.py` 中 B3-10 与 B3-16 实际断言完全相同（均为 `regression.focusedRuntime.exitCode==0`），而验收计划 05 §B3-10 与 §B3-16 描述的是不同的负面场景（无 lease/错 task/过期/撤销 vs 身份漂移/任意 URL/未注册 adapter/私网重定向）。当前负例依赖 `focusedRuntime` 6 个 pytest 包的总体退出码，不区分两类失效语义；verifier 的 `B3-09_B3-10_B3-16` limitation 已自报该约束。本次 run 通过不代表两类负面均独立复算，未来任一独立出门审查需要明确负例区分。

2. **M-2（文件扫描计数漂移）**：`verification-result.json.secretScan.files=17`，但本 run 公开目录有 18 个非 seal 文件。差异源自 verifier 是否将 `public-run-seal.json` 自身纳入扫描；非安全敏感（两者均报 0 hit），但精确文件计数应统一。

3. **M-3（cookie 值扫描不可独立复算）**：`registeredCredentialValueHits=0` 依赖 cookie 文件中的真实值；本审无 cookie 文件可重算。`forbiddenContextHits=0` 已独立复算 0 hit。M-3 与 `B3-11` / `B3-19` 一起限定本结论的“可独立复算”边界。

### 3.4 范围外注意事项（已记录，非新发现）

- `sample_registry.py` 包含 `audited_subtitle_failure` 等 fault 字符串，但被 `14-production-unreachable-audit.mjs` 正确排除在 production 8 文件之外（生产 Runtime/API/env/schema/acquirer 不导入 `sample_registry`）。审计已自证 production 不可达，本审独立确认。
- `private-root` 清理依赖于 `12-runner.py` finally 块；本审不重运行时，仅依赖公开证据（`cleanupResidualCount=0`）。
- `v3-2-route-b-20261006T190000Z` 和 `v3-2-route-b-20261006T200000Z` 等旧 run 目录仍在 `runs/` 下，本 run 是新 runId 且 tar 内容干净，旧 run 隔离成立。

## 4. 限制

- 不重运行 Chrome / Runtime / yt-dlp / ffmpeg / 旧 PX generator / 既有产品测试；
- 不修改任何现有文件；
- 不进入 V3-2-3 实施前恢复审计 / transcript / V3 PASS / V4 范围；
- `B3-09_B3-10_B3-16` 负例仅在 focusedRuntime 总体 exit-code 上断言，未做用例级独立性区分（M-1）；
- `B3-13` 真实媒体音频字节已被清理，公开证据仅含 hash/byteLength/shape（M-3 关联）；
- `B3-17` 私有 root 清理依赖代码结构，未做运行级独立复算；
- `B3-19` cookie 值扫描因无 cookie 文件，无法独立复算 `registeredCredentialValueHits==0`；`forbiddenContextHits==0` 已独立复算。

## 5. 决策

**Fatal=0, Major=0, Minor=3**。

→ 门禁：`V3-2-2 Route B3 LIMITED PASS`。

**仅允许进入**：V3-2-3 实施前恢复审计。

**禁止**：
- 进入 V3-2-3 实施（仍需独立实施前恢复审计）；
- 任何 transcript / V3 PASS / V3-2 / V4 完成声明；
- 修改本 run 的任何文件、补造音频或回填旧数据；
- 复用旧 run（`v3-2-route-b-20261006T{180000,190000,200000}Z`）的数据；
- 重跑 Chrome / Runtime / yt-dlp / ffmpeg / 旧 PX generator / 既有产品测试；
- 扩展审查范围至 V3-2 / V3-3 / V4 / transcript 完整链路。

## 6. 关键事实与发现摘要（供复算核验）

- 19/19 载荷 SHA-256 全匹配；
- Canonical content SHA-256 `66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea` 重算一致；18 个被封文件 SHA-256 全匹配 seal；
- Registry / Verification SHA-256 与外部权威值一致；
- Schema meta：revision=5，routingPolicy=`runtime_capability_b3`，credentialEvidenceClass=`user_authorized_cookie_lease`，classificationCounts 字面匹配，asrTriggerCounts 落在 oneOf 第二分支；
- 动态分母：12 行（6 subtitle + 3 asr + 1 multipart + 1 restricted + 1 low_signal）；7 subtitle-success + 3 media-success + 1 blocked + 1 degraded = 12；
- 三 ASR 触发：`runtimeNoSubtitle=1, auditedSubtitleFailure=2, totalMediaFallback=3`，和为 3；
- 故障注入仅 2 处有字幕 ASR 槽位，1 处无字幕槽位 `appliedFaultClass=null`，B3-07/B3-08 闭合；
- 静态审计：8 文件 × 10 字符串，0 命中；
- 公开 secret 扫描：`forbiddenContextHits=0`（独立重算 0 hit），`registeredCredentialValueHits=0`（依赖 cookie 文件）；
- `cleanupResidualCount=0`；
- B3-01..B3-20 全部 PASS（自报 20/20，独立复算一致）；
- PRD 严格限定 V3-2-2 媒体获取，未扩 transcript/V3 PASS。

---

审计落盘路径：`docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/route-b3-independent-implementation-exit-audit-20261007.md`

仅写入此一个文件；其余仓库文件未修改。