# V3-2-3 / V3-2-4 独立只读文档审查报告

日期：2026-10-06。审查性质：Claude Code CLI 独立只读审查（与 19-internal-readiness-audit.md 平行），审查对象仅为 `docs/active/project/external-audit-package/` 的 19 项载荷与 `AUDIT_MANIFEST.md`。未触发任何产品 / Runtime / Chrome / 下载器 / ASR / 旧 generator / validator；未修改目标报告之外的任何文件。

---

## 0. 入口核对

- 已先读 `AUDIT_MANIFEST.md`（20 项，含本 manifest）与 `01-audit-request.md`（1995 字节，SHA-256 `02a277dd…cc03`），再展开其余 18 项载荷。
- 19 项载荷按 `01..19` 编号一一核对；19 字节长度 / 19 SHA-256 全部独立重算并与 manifest 公开值逐项比对。

---

## 1. 19 项载荷 SHA-256 独立重算与比对

`sha256sum` 直接读取字节流；19/19 完全一致：

| File | Bytes | 重算 SHA-256 | manifest 公布 | 一致 |
|---|---:|---|---|:-:|
| `01-audit-request.md` | 1995 | `02a277ddd3c3374e52d7393dad0e320afc7944bfaad9af10c310405e44d7cc03` | 同 | ✓ |
| `02-prd.md` | 150441 | `87416b59bd595d9e2e9ee7d57da591c3063f115e7cbe0cfd6dcdb2cf6bc18ce0` | 同 | ✓ |
| `03-architecture.md` | 166026 | `0698969807243bd14aa0b5206a4017a545baed65cd975e755b9d7e294b5ce9be` | 同 | ✓ |
| `04-stage-gate.md` | 23922 | `695c59077174bc56f1374d09fce231711f708630ad605d598060efc6b3a36c43` | 同 | ✓ |
| `05-contract-spec.md` | 18204 | `3837684cf4c32a7766d9192899bdcd1e5892399f57c3fa61138f5dc08f9999ed` | 同 | ✓ |
| `06-remaining-development-plan.md` | 2986 | `51fa22910b2667b984959f6b640d94fc1918a3b240663bafedd1904bbcea955c` | 同 | ✓ |
| `07-remaining-acceptance-plan.md` | 1890 | `8c88ce873eeca7ef74107a700ad56c3694d478b7392a0fe4a20dcc0ce061c478` | 同 | ✓ |
| `08-media-acquisition.schema.json` | 15875 | `7657d9a2b6b5b02b2b794b27252583413e02c7949380481c40df48caa392516e` | 同 | ✓ |
| `09-policy-registry.json` | 5594 | `dc51afad22372a7224bbb41ff391b69e3088e214fc7f83c9a0dfb588da79c93f` | 同 | ✓ |
| `10-transcript-execution-v2.schema.json` | 4836 | `1f72a17e0a815f80aa9ea4001b8398f7564fea5305fcd790c8e733051e0c1513` | 同 | ✓ |
| `11-capture-stream-v1.schema.json` | 3908 | `bfa2b136d8956b7ad0eeda37db7d5ab3464ebd9dc5ffb72d438657353caf897f` | 同 | ✓ |
| `12-positive-fixture.json` | 3466 | `f898cac134a92e90f48e5fc7db4db0cd262fd6b402549834b172494092b5fa22` | 同 | ✓ |
| `13-v3-2-3-development-plan.md` | 3998 | `559b2149158d21ea5870d876c177b285545c95970987b9dada28a04f4451c615` | 同 | ✓ |
| `14-v3-2-3-acceptance-plan.md` | 2570 | `4a5ce8114a7d62a60b6d35e1df5eef693cda8ac295e1ab4c1cafdcfd5fb78a17` | 同 | ✓ |
| `15-v3-2-3-threat-model.md` | 1239 | `8bbce65e2413c58d4a2a8e73c27ceb7adb687cab9270a098a600629253e584fd` | 同 | ✓ |
| `16-v3-2-4-development-plan.md` | 4096 | `99bf5ac0cba84b136aed932db2e46b57816d2d6f058c7b1c6968c8f8d3c9cbdc` | 同 | ✓ |
| `17-v3-2-4-acceptance-plan.md` | 2888 | `1e7e2b48bd338466fdf9376f44879b7119ec15a638b8decdb0c06fb738a20a9a` | 同 | ✓ |
| `18-v3-2-4-threat-model.md` | 1359 | `cb4fa578ca1f5eba031a3978f53c658e0b84ecf4772d7c91212d6c60b59c2be0` | 同 | ✓ |
| `19-internal-readiness-audit.md` | 2749 | `d41bdd0b36de06284a03b29660871f2d6ce645ff0d8dde4086b0eb5ac096afb8` | 同 | ✓ |

合计：19/19 全匹配。载荷计数、字节计数与 hash 范围一致，未观察到重排、增删或字段挪移。

---

## 2. 三份 JSON Schema meta 与 positive fixture 校验

`python3 jsonschema Draft 2020-12 Validator` 复算：

- `08-media-acquisition.schema.json`：`$schema = https://json-schema.org/draft/2020-12/schema`，`$id = https://navia.local/contracts/v3_media_acquisition_contracts.schema.json`，`required = [manifestPolicy, task, acquisition, captureGrant, asr, transcript, cleanup, privacyAudit]`，`additionalProperties = false`。Draft 2020-12 META 通过；`ChromeManifestPermissions` 全字段 `const`（`minimumChromeVersion=116`，权限子集、`forbiddenPatterns` 包含 `<all_urls>` 等）；`FailureCode` 闭集 24 项；`MediaAcquisitionAttempt` 严格枚举 `authorityClass / route / status / requestedKind`。
- `10-transcript-execution-v2.schema.json`：`$schema` 正确、`$id = https://navia.local/contracts/v3-media-transcript-execution/v2`。`required = [schemaVersion, taskId, sourceIdentity, acquisitionRecordId, audioBinding, modelProfile, progress, coverage, result]`，全部 `additionalProperties = false`。Draft 2020-12 META 通过。
- `11-capture-stream-v1.schema.json`：`$schema` 正确、`$id = https://navia.local/contracts/v3-media-capture-stream/v1`。`required = [schemaVersion, taskId, grant, chunks, progress, stop]`，全部 `additionalProperties = false`。Draft 2020-12 META 通过。
- `12-positive-fixture.json`：`transcriptExecution` 与 `captureStream` 双顶层键，**整体被两套 schema 独立 validate 全部 PASS**（无 `ValidationError`）。fixture 中 `modelProfile` 的 10 个字段全部等于 schema `const`；`audioBinding.currentPart = true`、`sampleRateHz=16000`、`channels=1`、`sampleWidthBytes=2`、`durationMs=792000` 与锚点时长一致；`relativeArtifactRef = "audio/current-part.wav"` 是相对路径、`artifactSha256` 全 64-hex；`progress` 至少 2 项，`coverage.coverageRatio = 0.95` 通过；`result.status = "succeeded"`、`failureCode = null`、`segmentCount = 120`；`grant` 的 `oneShot = true`、`persisted = false`、`state = "consumed"`、`expiresAt - issuedAt = 30s`；`stop` 五项 `const true`、`activeCaptureCount = 0`、`residualRawAudioCount = 0`、`terminalStatus = "succeeded"`、`failureCode = null`；`chunks` 至少 1 项、`byteLength = 32000 <= 1048576`、`payloadSha256` 全 64-hex。
- `09-policy-registry.json`：顶层 9 个键齐全；`prerequisite` 指向 V3-1.3 PASS、`registeredAdapters` 仅 `bilibili`、`chromeManifestPolicy` 与 schema 08 一致（`backgroundCaptureAutostartAllowed = false`、`forbiddenPatterns` 含 `<all_urls>`）、`capturePolicy.grantTtlSeconds = 30`、`maximumConcurrentOffscreenDocuments = 1`、`maximumCaptureSeconds = 900`、`preserveTabAudioPlaybackRequired = true`、`rawAudioPersistenceAllowed = false`、`oneShot = true`、`crossTabReuseAllowed = false`、`stopOnTabClose / stopOnNavigation / stopOnConsentRevocation = true`；`temporaryArtifactPolicy` 全部清理入口（`completion / failure / cancel / page_close / runtime_offline / lease_expiry / consent_revocation`）；`localAsrPolicy.candidateEngine / candidateModel / candidateDevice / candidateComputeType` 与 schema 10 `ModelProfile` 一致；`failureCodes` 闭集与 schema 08 `FailureCode` 完全相同（24 项）；`futurePortalRule` 强制 `inheritBilibiliCredentialPolicy = false`、`requiresOwnPermissionsSecretPolicyAndProductionMatrix = true`、`unregisteredAdaptersFailClosed = true`。

schema meta 与 fixture 校验结果：**0 错误、0 警告**。

---

## 3. 审查请求 7 项决策问题逐项答复

### Q1：V3-2-3 是否只消费 V3-2-2 当前 task / current part 的权威音频，且未提前实现下载、capture、视觉或大纲？

**是（文档方向 PASS）**。

- `13-v3-2-3-development-plan.md` §1 明确 V3-2-3 "不下载媒体、不启动 `tabCapture`、不抽帧、不生成大纲，也不执行跨模型比较或智能质量回退"；唯一数据流锁定 `MediaAcquisitionTask + task-private AcquisitionAudioRef -> TaskAudioRefResolver -> FunAsrLlamaCppProviderAdapter -> strict SRT parser -> TranscriptSemanticValidator -> LocalAsrRecord + MediaTranscript -> cleanup barrier`；§2 `TaskAudioRefResolver` 在 `TaskArtifactSandbox` 内解析、symlink/hardlink/traversal/cross-task 全部拒绝。
- `14-v3-2-3-acceptance-plan.md` ST02 要求三个 `AcquisitionAudioRef` 的 `task/source/current part/hash/时长/PCM shape` 与 V3-2-2 完全相等；ST03 拒绝 traversal/absolute/symlink/hardlink/cross-task；ST05 三个真实全长任务、3/3 非空、不复用旧结果。
- schema 10 `AudioBinding` 强约束 `taskId`、`sourceIdentity`、`artifactSha256`、`durationMs`、`sampleRateHz = const 16000`、`channels = const 1`、`sampleWidthBytes = const 2`、`currentPart = const true`、`relativeArtifactRef` 严格正则（拒绝绝对路径与 `..`），构成对当前 task / current part 的机器级绑定；`privatePreset = "currentPart: true"` 与上一句一致。
- schema 10 顶层完全不出现 capture ticket / streamId / tabId / capture grant / video frame / VideoOutline / Mindmap / VLM 等字段；`ModelProfile.cloudUpload = const false`。
- 04-stage-gate §4 与 05-contract-spec §1 重复明确 V3-2 范围不含关键帧/OCR/VLM/VideoOutline/Mindmap/Ask/MediaTaskStore；§6 路由顺序与执行状态严格。
- 19-internal-readiness-audit §2 第一行也明确"V3-2-3 只消费 V3-2-2 当前分 P artifact，不承担下载/capture/V3-3"。

### Q2：SenseVoice provider/engine/version/model/revision/weights、`development_baseline`、3/3 全长与 ≥90% 覆盖率是否和 PRD / 合同一致；是否存在 Tiny / 字幕 / 窗口 / 跨 run 假绿？

**完全一致；防假绿在 schema 与验收双层闭锁**。

- schema 10 `ModelProfile` 全部字段均为 `const`：`providerId = "funasr_edge_local"`、`engine = "funasr-llamacpp"`、`engineVersion = "runtime-llamacpp-v0.2.6"`、`modelId = "funasr-sensevoice-small-q8"`、`modelRevision = "90c1c61912018b70ada0fcc024ea24aca62f2e63"`、`weightsSha256 = "4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5"`、`deviceClass = "cpu"`、`computeType = "q8"`、`qualityStatus = "development_baseline"`、`cloudUpload = false`。`qualityStatus` 仅 `development_baseline`、不可改写为 `production_qualified`。
- `09-policy-registry.json` `localAsrPolicy.candidate*` 与 schema 10 逐项一致；`productionProfileMustFreezeModelRevisionAndWeightsSha256 = true`、`emptyTranscriptMaySucceed = false`、`segmentTimestampRequired / segmentHashRequired / confidenceRequired = true`、`cloudUploadAllowed = false`。
- `05-contract-spec.md` §8、V3-2-0c-1 §16/17 已写入 `90c1c6…2e63` 与 `4ae45c…b7c5`；与 schema 10 / registry 09 全部相等。
- `13-v3-2-3-development-plan.md` §3 冻结 profile 同样六字段与上完全相同；§4 `2-3-5` 出门要求"3/3 非空、可转写区间覆盖率 ≥90%、固定 profile"。
- 防假绿覆盖：
  - `14-v3-2-3-acceptance-plan.md` §3 明令禁止"三段窗口替代全长、用字幕替代 ASR、用 Tiny 替代 SenseVoice、用非空字符串替代时间覆盖率、跨 run 拼接、自动清洗或补写转写文本、保留音频后声称 cleanup、把 `development_baseline` 改写为 `production_qualified`"。
  - ST05（3/3 全长真实任务，segments 非空，不复用旧结果）、ST06（≥90% 可转写区间覆盖，算法 `speech_interval_overlap/v1`、计算输入留存）、ST07（`0 <= start < end <= duration`、有序不重叠）、ST08（textSha256 / contentSha256 / 音频 hash 逐字节复算）、ST09（三方 provenance 闭合：acquisition / ASR record / transcript 的 task/source/route/hash 精确相等）、ST13（cleanup 终态 0 残留）、ST14（public artifact 0 路径 / 原始音频 / Cookie / token / stderr 命中）。
  - schema 10 `CoverageReceipt.algorithm = const "speech_interval_overlap/v1"`、`coverageRatio` 0..1、`passed = { boolean}`、`speechIntervalCount >= 1`；任何常数漂移会被 Draft 2020-12 validator 直接拒绝。
  - schema 10 `progress` 至少 2 项，sequence 从 0 起，`phase` 含 `loading_model/transcribing/validating/cleaning/completed/failed/cancelled`，`percent` 0..100 闭区间，超出即 schema-fail。
  - schema 10 `Result.failureCode = "string|null"`，`maxLength = 96`；任何任意用户字符串都不得伪装为系统失败码。

### Q3：Transcript Execution v2 是否关闭输入绑定、进度、覆盖率、终态与公开 receipt，同时保持历史 `MediaTranscript` v1 不变？

**是**。

- schema 10 把"输入绑定（AudioBinding）/ 进度（progress[]）/ 覆盖率（CoverageReceipt）/ 终态（result）/ 公开 receipt"全部纳入 top-level required；新增子阶段只在此合同上报。
- schema 08 中 `MediaTranscript` 定义 `schemaVersion = const "media-transcript/v1"`，未在本包中修改；`v3-media-transcript-execution/v2` 与 `media-transcript/v1` 是两个独立 schemaVersion，分别承担"执行 v2 receipt"与"媒体 transcript 实体"。
- `additionalProperties = false` 闭合所有外部字段；schema 10 不暴露 capture ticket、streamId、tabId、tab 音频私有路径等。
- 12-positive-fixture 中 `transcriptExecution.transcriptId = mtr_…`、`contentSha256` 与 `MediaTranscript.contentSha256` 应一致；schema 不允许把 transcript v1 字段任意改名或新加属性。
- schema 08 `LocalAsrRecord` 仍按 v1 冻结（`engineId / engineVersion / modelId / modelRevisionSha256 / weightsSha256 / deviceClass / computeType / executedLocally = const true / cloudUpload = const false / inputArtifactSha256 / outputTranscriptSha256 / segmentCount`），未在本包新增约束、也未删除字段；即历史 `MediaTranscript` v1 与 `LocalAsrRecord` v1 未变。

### Q4：V3-2-4 是否只有前三 route 机器失败后的真实可信点击才能启动，且 task / tab / page / adapter / surface / 30 秒 one-shot / Offscreen 单例 / 900 秒 / 原声回放 / 停止清理均明确？

**是**。

- `16-v3-2-4-development-plan.md` §1 明确"仅当 `credentialed_subtitle -> credentialed_media_asr -> public_or_page_subtitle` 均以机器原因失败后，UI 才显示'捕获当前标签页'"，用户 Side Panel / Workspace 的新鲜可信点击是唯一启动入口；Background / content script / 定时器 / 页面脚本 / 恢复逻辑均不得自动开始。
- `17-v3-2-4-acceptance-plan.md` TC02（前三条 route 全部机器失败才显示 capture）、TC03（Side Panel 真实点击 `isTrusted = true`，grant 绑定 task/tab/page/adapter/surface）、TC04（Workspace 同上、两个入口共享 Runtime task 事实）、TC05（TTL ≤ 30 秒、one-shot、ticket 256-bit、public grant 不含 ticket / tabId / streamId）、TC06（重复 / 过期 ticket 拒绝且不生成第二 stream）、TC07（错 task/tab/page/adapter/surface 全部拒绝，状态不前进）、TC08（content script / page / 后台 sender 全部 `V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN` 或等价固定码）、TC09（streamId 获取后立即由唯一 Offscreen 消费、不持久化、不公开）、TC10（Offscreen 单例，并发第二 capture 拒绝，结束后 0）、TC11（捕获期间用户仍听原视频、连接失败则停止）、TC12（chunk 序号从 0 连续、缺包 / 重复 / 乱序 / 超限 fail closed）、TC13（至少 1 个真实 capture + SenseVoice transcript）、TC14（WebSocket / Runtime 断线立即停止、旧 ticket 不重放）、TC15（导航 / 关页 / reload 全部停止）、TC16（撤销 / 取消 / 900 秒上限全停止，无后续 chunk / segment）、TC17（raw audio / 私有 WAV / active capture / Offscreen / 句柄 / task temp 终态为 0）。
- `16` §3 明确 Chrome ≥ 116、grant TTL ≤ 30 秒、one-shot、不可持久化、不可跨 task / tab / page / adapter / surface、streamId 立即消费、不进入 Redux / storage / log / evidence、capture 最长 900 秒、单一 Offscreen、原始 chunk 不写 EventStore / Trace / IndexedDB / Cache / Downloads / OPFS。
- schema 11 `PublicGrant`：`oneShot = const true`、`persisted = const false`、`taskId + adapterId` required；`pageIdentitySha256 / tabIdSha256` 哈希形式而非原值；不出现 raw ticket / streamId / tabId / page identity。`ChunkObservation`：`sequence ≥ 0`、`byteLength 1..1048576`、`payloadSha256` 强制、`receivedAt` 强制；超过 1 MiB chunk 直接 fail closed。`ProgressObservation.capturedMs` 上限 `900000`（=900 秒）。`StopReceipt`：`tracksStopped / socketClosed / offscreenClosed / sinkClosed = const true`、`activeCaptureCount = const 0`、`residualRawAudioCount = const 0`、`failureCode = string|null` 且 `maxLength = 96`；任何残留均失败。
- `09-policy-registry.json` `capturePolicy.grantTtlSeconds = 30`、`oneShot = true`、`offscreenReason = "USER_MEDIA"`、`maximumConcurrentOffscreenDocuments = 1`、`streamIdMustBeConsumedImmediately = true`、`preserveTabAudioPlaybackRequired = true`、`backgroundAutostartAllowed = false`、`crossTabReuseAllowed = false`、`maximumCaptureSeconds = 900`、`stopOnTabClose = true`、`stopOnNavigation = true`、`stopOnConsentRevocation = true`、`rawAudioPersistenceAllowed = false`、`requiresFreshUserGesture = true`、`trustedSurfaces = [side_panel, workspace]`。
- schema 08 `MediaCaptureGrant`：`state ∈ {issued, consumed, expired, revoked, failed}`，`oneShot = const true`、`persisted = const false`，`failureCode` 强制。`tabIdSha256` 与 `userGestureEventSha256` 都是 SHA-256 哈希。

### Q5：Capture Stream v1 是否拒绝 ticket / streamId / tabId / raw path 等私有字段，并能支撑 chunk 顺序与零残留停止回执的后续 semantic validator？

**是**。

- schema 11 顶层 required 仅 `[schemaVersion, taskId, grant, chunks, progress, stop]`；所有 `$defs` 都设 `additionalProperties = false`。`PublicGrant` 不含 ticket、streamId、tabId 原值，仅 `grantId / taskId / adapterId / pageIdentitySha256 / tabIdSha256 / surface / issuedAt / expiresAt / oneShot / persisted / state`。`ChunkObservation` 仅含 `sequence / byteLength / payloadSha256 / receivedAt`。`ProgressObservation` 仅含 `sequence / phase / capturedMs / byteLength / observedAt`，`capturedMs` 上限 900 秒。`StopReceipt` 强制 0 残留。
- `12-positive-fixture.json` captureStream 段同时证明 5 项 `const true`、`activeCaptureCount = 0`、`residualRawAudioCount = 0`，可被 `v3_media_capture_stream` schema validator 直接校验。
- 为后续 semantic validator 预留：`chunks.sequence` 必须从 0 连续（schema 强制 `minimum: 0`，但不强制单调连续——连续性需 semantic validator 复算）；`StopReceipt` 五项 `const true` 与 `activeCaptureCount = 0` / `residualRawAudioCount = 0` 共同构成 zero-residual stop receipt 闭集；`state = "consumed"` 表明已消费，不可再放任何 chunk；后续 semantic validator 只需在 schema-valid 闭集之上继续检查 sequence 单调、payloadSha256 与任务内 binding、以及 stop receipt 与 cleanup 一致性。

### Q7：当前是否应维持 V3-2-3 / V3-2-4 implementation NO-GO？

**是，必须维持 NO-GO**。

- 04-stage-gate §4 / §6 / §7 明确当前 V3-2-2 仍为 `DOCUMENT PASS / IMPLEMENTATION NO-GO`（`code=-101 / isLogin=false` 未消解），V3-2-2 实施 NO-GO。
- 13 / 16 第 1 行分别写明 `IMPLEMENTATION NO-GO / V3-2-2 PASS REQUIRED` 与 `IMPLEMENTATION NO-GO / V3-2-3 PASS REQUIRED / HIGH-RISK PERMISSION BOUNDARY`。
- 06-remaining-development-plan §1 表中"自动出门条件"列：V3-2-2 / V3-2-3 / V3-2-4 各自要求前序 PASS；V3-2-4 还要求高风险授权。
- 19-internal-readiness-audit §4 明确"DOCUMENT DIRECTION PASS / IMPLEMENTATION NO-GO"，并要求"V3-2-4 需用户针对冻结权限边界作明确高风险实施授权"。
- 01-audit-request.md 明确"不得把前序尚未通过误判为本包文档缺陷，也不得因此放行实施"。

### Q6：ST01..ST16 / TC01..TC20 是否固定、无 N/A、无人工提前、无权限 / 平台范围扩大，能否完整支撑后续自动化实施？

**是**。

- ST01..ST16（`14-v3-2-3-acceptance-plan.md` §2）：16 项无 `N/A`、`TBD`、`optional`、`passed-by-default`；每行均由"操作 / 必须结果"两列组成；范围全部在 Runtime + extension 内含执行、无 AI/人工。
- TC01..TC20（`17-v3-2-4-acceptance-plan.md` §1）：20 项无 `N/A`、`TBD`、`optional`、`passed-by-default`；每行均由"操作 / 必须结果"两列组成；TC18 包含四视口 + 键盘 + Axe serious/critical=0，仍为自动化。
- `17` §3 重复声明"本阶段机器自动验证原声回放、按钮状态和真实 capture；不执行 H01..H10，不要求人类听写或构造证据"。
- 06 / 07 / 19 全部声明 H01..H10 仅在 V3-5 自动门槛通过后执行，本阶段不提前。
- 权限与平台范围：schema 08 `ChromeManifestPermissions` 7 字段 `const`（requiredPermissions、optionalPermissions、requiredHostPermissions、optionalHostPermissions、webAccessibleMatches、forbiddenPatterns、minimumChromeVersion=116）；schema 11 / 09 `capturePolicy` 13 项不开放后台 / 跨 tab / 持久化；schema 10 / 09 `localAsrPolicy.cloudUploadAllowed = false`、`crossModelQualityGate=deferred_to_v4`、`futurePortalRule.inheritBilibiliCredentialPolicy = false`、`requiresOwnPermissionsSecretPolicyAndProductionMatrix = true`。
- 19 个 V3-2-3 / V3-2-4 子阶段（`13` / `16` §4）均以"自动出门"列为条件；未见任何超出 12 页固定分母 / Schema / policy registry / fixture / 跨 run 拼接的扩展项。

---

## 4. 重点再核

- **V3-2-3 严格依赖 V3-2-2 当前 task / current part**：schema 10 `AudioBinding.currentPart = const true`、`taskId`、`sourceIdentity`、`artifactSha256`、`durationMs` 必须与 acquisition 严格一致（ST02 / ST09 / ST13）；`relativeArtifactRef` 严格正则拒绝绝对路径与 traversal；`TaskAudioRefResolver` 只在 `TaskArtifactSandbox` 内解析。`development_baseline` 不可改写。
- **SenseVoice identity**：schema 10 `ModelProfile` 10 字段全 `const`；registry 09 / 13 / 05-contract-spec §8 / V3-2-0c-1 §17 全部出现相同 5 元组（provider / engine / version / model / revision / weights）；唯一不可改写 `development_baseline`。
- **3/3 全长与 ≥90% 防假绿**：ST05（3/3 真实全长、非复用）、ST06（≥90%、算法与输入留存）、ST07（segment 顺序与边界）、ST08（hash 复算）、ST09（三方 provenance）、ST10（进度观察单调 ≤100% 且终态后无新事件）、ST12（坏 SRT / 空输出 / 超限 / 非零退出 → 固定失败码）、ST14（公开 0 命中）。
- **V3-2-4 严格可信点击与全部闭锁**：TC02 前三路机器失败、TC03/TC04 真实 Side Panel / Workspace `isTrusted=true`、TC05 30 秒 one-shot、TC06 重放拒绝、TC07 task/tab/page/adapter/surface binding、TC08 content script / 后台 sender 拒绝、TC09 streamId 立即消费、TC10 Offscreen 单例、TC11 原声回放、TC12 chunk 顺序、TC14 断线终止、TC15 导航 / 关页、TC16 撤销 / 取消 / 900 秒上限、TC17 cleanup 全 0。
- **ST01..ST16 / TC01..TC20 / H01..10**：完全固定、无 N/A、无平台越界；H01..H10 仅 V3-5 执行，本阶段不调用人工。

---

## 5. 文档决定

`DOCUMENT DIRECTION PASS`（针对本 19 项载荷）。

依据：

1. 19/19 SHA-256 全部匹配 manifest。
2. 三份 schema `Draft 2020-12` meta 校验全通过，闭集、约束、`const` 与 `additionalProperties:false` 一致。
3. `12-positive-fixture.json` 的 `transcriptExecution` 与 `captureStream` 同时通过 schema 10 与 schema 11。
4. V3-2-3 严格依赖 V3-2-2 当前 task / current part；SenseVoice identity 全字段闭锁；3/3 全长 + ≥90% 覆盖率在 schema 与验收双层闭锁；V3-2-4 严格依赖真实可信点击 + 30 秒 one-shot + task/tab/page/adapter/surface binding + Offscreen 单例 + 900 秒 + 原声回放 + 停止清理。
5. ST01..ST16 / TC01..TC20 固定无 N/A；H01..H10 仅 V3-5 触发，本阶段不调用人工；权限与平台范围未越界。

---

## 6. 实施决定

**维持 `IMPLEMENTATION NO-GO`**。

依据：

1. V3-2-2 仍 `DOCUMENT PASS / IMPLEMENTATION NO-GO`（`code=-101 / isLogin=false` 未消解）；V3-2-3 明确写明"IMPLEMENTATION NO-GO / V3-2-2 PASS REQUIRED"。
2. V3-2-3 自身 `development_baseline` 仅作为质量标签、不等于生产质量认证；V3-2-3 未通过前 V3-2-4 不得实施。
3. V3-2-4 包含高风险权限边界（`tabCapture` / `offscreen` / `<all_urls>` 拒绝 / Offscreen 单例 / 用户高风险授权）；当前 19-internal-readiness-audit §4 / 06-remaining-development-plan §1 / 16-v3-2-4-development-plan §1 行均明确"V3-2-4 还需用户针对冻结权限边界作明确高风险实施授权"。
4. 任何前序独立出门 / 各阶段外审 / V3-2-4 高风险授权未满足前，不得实施 V3-2-3 / V3-2-4。

---

## 7. 重新审查 / 实施的前置条件

A. V3-2-2 在有效授权会话的全新 12/12 run、schema-valid `productionReady=true` Revision 3 出现，且 `/x/web-interface/nav` 不再返回 `code=-101/isLogin=false` 之前，不得进入 V3-2-3 实施。

B. V3-2-3 需在真实 Chrome + 真实 B站 + 三个 `primaryClass=asr` 当前分 P 任务上取得 3/3 全长非空、≥90% 可转写区间覆盖、SenseVoice 全字段冻结 profile 命中、`development_baseline` 不被改写；本机低资源 8 cores/8 GiB/no-GPU 真实峰值留痕；并在独立实施出门审计中达到 Fatal=0 / Major=0 之前，不得进入 V3-2-4 实施。

C. V3-2-4 需新增 `tabCapture` / `offscreen` 但不得新增 `<all_urls>`；grant TTL ≤ 30 秒、one-shot、Offscreen 单例、900 秒、原声回放、停止条件六项硬性闭锁；并先由用户对冻结权限边界作明确高风险授权；独立实施出门审计 Fatal=0 / Major=0 之前，不得进入 V3-2-5。

D. H01..H10 仅 V3-5 自动门槛通过后由人类执行；V3-2-3 / V3-2-4 / V3-2-5..7 任何子阶段不得提前调用人工。

E. 任一实施前外审出现 Fatal / Major 立即回到文档阶段，禁止用诊断 run、跨 run 拼接或降级分母恢复。

F. 跨 run 拼接 / 跨模型智能回退 / Tiny 冒充 SenseVoice / V2 / V4 持久化 / 直播 / 全平台 / OCR / VLM / RAG / 多 Agent / 浏览器自动操作 / 跨视频 RAG / 全 BiliNote parity 等扩张均不得在本两阶段内引入。

---

## 8. 文档决定 / 实施决定 / Fatal / Major / Minor

- 文档决定：`DOCUMENT DIRECTION PASS`。
- 实施决定：`IMPLEMENTATION NO-GO`（维持 NO-GO）。
- Fatal：0。
- Major：0。
- Minor：0。

附注：本审计不替换 `19-internal-readiness-audit.md` 的内部审计结论；与该报告并行。审查请求明确"不得把前序尚未通过误判为本包文档缺陷，也不得因此放行实施"，故 V3-2-2 实施 NO-GO 仅记录于事实层，不计为本包文档缺陷。

---

## 9. 审查边界

仅读 19 项载荷与 manifest；未运行产品、Runtime、Chrome、下载器、ASR 或旧 generator / validator；未修改 `docs/active/project/external-audit-package/` 之外的文件；未访问任何网络端点；未创建任何持久状态。