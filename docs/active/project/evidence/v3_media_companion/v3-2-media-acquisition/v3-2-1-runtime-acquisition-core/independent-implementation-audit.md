# V3-2-1 实施出门与 V3-2-2 前置冲突独立只读审查

日期：2026-10-06
审查者：独立只读审查者（与实施 session 不同）
审查依据：`docs/active/project/external-audit-package/` 19 载荷 + 内部 `external-audit-request.md`、`preimplementation-audit.md`、`implementation-exit-audit.md`、`prd-review.md`、`acceptance-plan.md`、`acceptance-result.md`、`development-plan.md`、`threat-model.md`、`implementation-authorization.md`

## 0. 审查范围与禁止项

只读审查，不运行产品、浏览器、Runtime、旧 generator/validator；不修改除本报告外的任何文件；不扩大为 V3-2、V3、B站媒体获取、字幕、本地全长 ASR、tabCapture、视频理解或图文大纲通过。

## 1. 决定与分级

| 决定对象 | 决定 | 依据 |
|---|---|---|
| `V3-2-0c-1 SenseVoice development baseline` | `LIMITED PASS`（维持） | Fatal=0 / Major=0 / Minor=2 |
| `V3-2-1 Runtime acquisition core` | `LIMITED PASS` | Fatal=0 / Major=0 / Minor=3 |
| `V3-2-2 implementation` | `NO-GO` 直至 sample registry revision 3 冻结 | 规格双轨，非代码失败 |

合计 **Fatal=0 / Major=0 / Minor=5**（SenseVoice 2 + V3-2-1 3）。

## 2. 载荷完整性复算

### 2.1 独立 SHA-256 与权威源一致性

独立 `sha256sum 19 载荷`，与 `AUDIT_MANIFEST.md` 完全一致；字节数（`wc -c`）逐文件等于清单中 bytes 字段。

| 载荷 | 独立 SHA-256（前 16 位） | 字节 | 一致 |
|---|---|---:|:--:|
| `01-audit-request.md` | `1bcc988e7aff22e7` | 1744 | ✓ |
| `02-prd.md` | `ce7744c21a5aa4c0` | 149224 | ✓ |
| `03-architecture.md` | `0698969807243bd1` | 166026 | ✓ |
| `04-stage-gate.md` | `c6ca981da09ac799` | 23043 | ✓ |
| `05-contract-spec.md` | `6823a6d2182fb505` | 17675 | ✓ |
| `06-development-plan.md` | `519eb6c131a99db5` | 9571 | ✓ |
| `07-acceptance-plan.md` | `262fb263f0c33c2b` | 8283 | ✓ |
| `08-policy-registry.json` | `dc51afad22372a72` | 5594 | ✓ |
| `09-contract.schema.json` | `7657d9a2b6b5b02b` | 15875 | ✓ |
| `10-contract-positive.json` | `300f0c13daa5d3f0` | 7871 | ✓ |
| `11-contract-fixtures.json` | `2caaa704d55f2f8f` | 20040 | ✓ |
| `12-sensevoice-exit-audit.md` | `1724eb4f02345e7f` | 2236 | ✓ |
| `13-sensevoice-result.json` | `bb116cf27818dd7f` | 2896 | ✓ |
| `14-core-development-plan.md` | `70cfd6522dfcdcff` | 1981 | ✓ |
| `15-core-acceptance-plan.md` | `6e56e8198f4c41f3` | 1799 | ✓ |
| `16-core-threat-model.md` | `348574a947be4046` | 1306 | ✓ |
| `17-core-result.json` | `f04c4307b79c46f6` | 1002 | ✓ |
| `18-core-exit-audit.md` | `1edb7f2a9d444dd5` | 1784 | ✓ |
| `19-core-prd-review.md` | `9d4ef9e4a679d279` | 1350 | ✓ |

### 2.2 权威源快照核对

- `08-policy-registry.json` revision=1、`status=v3_2_1_preimplementation_candidate`；唯一注册 adapter `bilibili`，policy 与 schema/positive 完全一致（requiredPermissions、optionalPermissions、requiredHostPermissions、optionalHostPermissions、webAccessibleMatches、forbiddenPatterns 6 项集合双向相等；FailureCode 24 项双向相等，Schema ⊆ Policy 且 Schema = Policy）。
- `09-contract.schema.json` 是 Draft 2020-12；JSON 解析合法；`$defs` 包含 12 个 `$ref`，顶层 `required` 与 `additionalProperties=false` 正确闭合。
- `10-contract-positive.json` 通过独立 `jsonschema.validate`：VALID。
- `11-contract-fixtures.json`：49 requirements + 49 cases 精确 1:1 匹配；13 schema + 36 semantic 分层精确；schema 负例 13/13 必须 `expectedSchemaValid=false`，semantic 负例 36/36 必须 `expectedSchemaValid=true`（在 Schema 层保持合法，留给 semantic validator 跑），全部满足。

## 3. 媒体合同复算

### 3.1 Schema meta / positive / 49 cases 独立重算

**Schema meta**：`draft/2020-12` 元校验合法，Draft URL 正确。`additionalProperties=false` 在所有 `$defs` 对象上闭合；`const` 在 `chrome-manifest-permissions`、`schemaVersion`、`temporaryDirectoryClass`、`oneShot`、`persisted`、`executedLocally`、`cloudUpload`、`cleanup.passed`、`failureCode=null` 等冻结字段上精确使用，11 个 `const` + 8 个 `pattern` 完整覆盖 ID/Hash/SourceIdentity 形状。

**Positive 实例**：独立 JSON-Schema 校验通过；额外对正例做了以下二次复算：

- segment text hash：用 `SHA-256(UTF-8(text))` 重算两个 segment：`bc71a18c...` 与 `1db500d2...`，与正例 `textSha256` 字段逐字节相等。
- transcript content hash：用 `segmentId + TAB + startMs + TAB + endMs + TAB + textSha256 + LF` UTF-8 顺序连接再 `SHA-256`，结果 `6b6beafb...` 与正例 `contentSha256` 完全相等。
- ASR input/output hash：inputArtifactSha256 与 attempt[3].artifactSha256 相等；outputTranscriptSha256 与 transcript.contentSha256 相等；acquisition.transcriptSha256 与 transcript.contentSha256 相等（三向一致）。
- 路由顺序：`['credentialed_subtitle','credentialed_media_asr','public_or_page_subtitle','trusted_tab_capture_asr']` 与 policy `orderedRoutes` 完全相等；attempt sequence 1..4 严格连续；首成功即停，`selectedRoute = transcript.route = trusted_tab_capture_asr`。
- 凭据 authorityId：两次 credential attempt 的 authorityId 等于 `task.credentialLeaseId`；capture attempt 的 authorityId 等于 `captureGrant.grantId` 且 `captureGrant.taskId = task.taskId`、`captureGrant.adapterId = task.adapterId`。
- Capture grant：state=`consumed`、oneShot=true、persisted=false、TTL=30.0 秒（`2026-09-17T14:00:13Z..14:00:43Z`）；attempt 开始于 `14:00:15Z` 在窗口内。
- ASR profile：engineVersion=`runtime-llamacpp-v0.2.6`、modelId=`funasr-sensevoice-small-q8`、weightsSha256=`4ae45c944...b844b7c5`、cloudUpload=false、executedLocally=true，与 `08-policy-registry.json` `localAsrPolicy` 完全一致。
- Manifest 政策：positive.manifestPolicy 6 字段集合与 policy.chromeManifestPolicy 6 字段集合双向相等；`forbiddenPatterns` 包含 `<all_urls>`、`http://*/*`、`https://*/*` 三项。
- segments 边界：所有 endMs ≤ durationMs；相邻 segment 无重叠；startMs ≥ 0。
- fallbackReasonCodes = `['V3_MEDIA_SUBTITLE_UNAVAILABLE','V3_MEDIA_PLATFORM_REJECTED']`，等于 attempt[0].failureCode 与 attempt[1].failureCode 按首次出现顺序去重，符合 N-044 期望。

**49 cases 独立执行**：以 `positive` 为基础，按 `patch.op + path` 精确应用 mutation，独立跑 `jsonschema.validate`：

- 13 schema 负例：13/13 在 Schema 层拒绝（`expectedSchemaValid=false` 实际成立）。
- 36 semantic 负例：36/36 在 Schema 层合法（`expectedSchemaValid=true` 实际成立），按规格语义责任交给 semantic validator 跑（`V3_MEDIA_*` 错误码不属于 Schema 范围）。
- 合计 49/49 与期望一致。

注意：semantic 负例的 `expectedFailureCode` 是声明的目标失败码，本审查无法执行 Runtime semantic validator（禁止运行产品/旧 validator）；按审查要求仅做 Schema 与结构复算，semantic 复算留待 V3-2-2 实施前审计同步。

### 3.2 SenseVoice baseline result 复算

载荷 `13-sensevoice-result.json`：

- schemaVersion=`v3-asr-sensevoice-baseline-run/v1`；`passed=true`；`qualityStatus=development_baseline`；`modelId=funasr-sensevoice-small-q8`。
- 安装：`bytesCompleted == bytesTotal == 263943306`；`state=ready`；`failureCode=null`；percent=100；history 含 checking → downloading → verifying → self_testing → installing → ready 6 个标准状态，无越级。
- 官方资产：三个 published 文件 bytes 与 SHA-256 全部等于 `12-sensevoice-exit-audit.md` 中表格声明的官方固定值。
  - `llama-funasr-sensevoice` 2442392 bytes / `c41a53b0...64c30edd`
  - `sensevoice-small-q8.gguf` 254208320 bytes / `4ae45c94...b844b7c5`
  - `fsmn-vad.gguf` 1720512 bytes / `1270f255...5719f5479`
- **Minor 观察（新增 Minor-3，独立审查者记）**：三个 published 文件 bytes 之和 = 258,371,224，与 `installation.bytesCompleted=263943306` 不一致，差额 5,572,082 字节。`12-sensevoice-exit-audit.md` 写明“正式 manager 下载并校验 `263943306` bytes；发布文件分别为”三件，但未列出其余 ~5.3MB（可能为 manager sidecar、catalog JSON、license 副本之类）。该差额未在 `12-sensevoice-exit-audit.md` 显式归类到 Minor；现有 M-1（独立性）和 M-2（不重宣 24-bin 门禁）未覆盖此点。本审查作为 Minor 列出，不阻塞 PASS，但建议 V3-2 后续轮次在 result JSON 中显式列出 published 之外的全部实际下载字节来源，避免数据呈现缺口。
- 未安装 fail closed：`uninstalledSelectionFailureCode = V3_ASR_MODEL_NOT_READY`；qualityStatus 不是 `ready`/`verified` 时不可选，符合 `08-policy-registry.json` `localAsrPolicy.productionProfileMustFreezeModelRevisionAndWeightsSha256=true` 的"必须 verified/ready 才可选"约束。
- `selection` 与 `restartSelection` 字段完全相等（requestedModelId / effectiveModelId / fallbackActive / fallbackReason / schemaVersion / updatedAt 6 项）；fallbackActive=false，fallbackReason=null；`updatedAt=2026-09-22T14:00:38.458077Z`，与 history 中 `ready` 状态时间戳在同一序列 261 之内。
- 真实音频窗口：`startMs=60000, endMs=75000`，长度 15000ms；`nonEmpty=true`、`timestampsValid=true`、`segmentCount=1`、`elapsedMs=1167`，`sourceKind=private_real_bilibili_audio`，`wavSha256` 与 `transcriptSha256` 独立给出两个不同 64-hex 字符串（区分输入与输出）。
- 隐私：`publicAudioIncluded=false`、`publicTranscriptIncluded=false`、`taskDirectoryRemoved=true`，符合“公开 result 不含音频与转写”。
- `v4Deferred = ['cross_model_degradation_detection','automatic_quality_fallback']`，与 `04-stage-gate.md §17`、`07-acceptance-plan.md §6` 用户决策一致。
- 与权威源一致性：与 `08-policy-registry.json` 中 `localAsrPolicy.candidateModel=funasr-sensevoice-small-q8`、与 `05-contract-spec.md §8` 中 weights 冻结 `4ae45c94...b844b7c5` 完全一致；与 `12-sensevoice-exit-audit.md §2` 公开 SHA-256 完全一致。

结论：SenseVoice development baseline 在用户“`development_baseline` 而非 production”口径下成立。结果 hash、bytes、未安装 fail closed、restart selection、真实窗口非空合法、隐私三连全为 false、V4 延期列表完整。`V3-2-0c-1 LIMITED PASS` 维持，新增 Minor-3（bytesCompleted vs published 之和差额未解释）单独记入。

### 3.3 V3-2-1 result 复算

载荷 `17-core-result.json`：

- schemaVersion=`v3-media-acquisition-core-run/v1`；`passed=true`。
- API：`postStatus=201`（create 正确）、`getStatus=200`、`deleteStatus=200`（幂等取消）、`cacheControlNoStore=true`、`closedRequestStatus=400` 且 `closedRequestCode=V3_MEDIA_TASK_INVALID`。
- Task：`createdState=created`、`cancelledState=cancelled`、`cancelHookCalls=1`（恰一次 hook）、`cancelIdempotent=true`、`idempotent=true`。
- 真实 artifact：`byteLength=3840078`、`sha256=f4f61c09...bf7cc97b`（64-hex 合法）、`kind=audio`、`artifactId=artifact_85e8dcad6cb889807f1e1df88e00f775`（不透明内部 ID，无路径语义）、`artifactFileMode=0600`、`taskDirectoryMode=0700`、`publicPathIncluded=false`、`sourceKind=private_real_bilibili_audio`、`sourceBytesMatched=true`、`sourceSha256Matched=true`。
- Cleanup：`cancelledTaskDirectoryRemoved=true`、`startupRecoveredOrphans=1`、`unknownDirectoryPreserved=true`，三者满足“只清受控 orphan、不删未知目录”。
- 与权威源一致性：与 `15-core-acceptance-plan.md` 中 RC01..RC16 完全对应；与 `18-core-exit-audit.md` “正式 run 使用私有真实 B站 WAV 的全部 `3840078` 字节”表述完全一致；`3840078` 字节 WAV 与 `13-sensevoice-result.json` 中 `wavSha256=6271ffeeb1f1f1d144bcc0402027c7abc5acf67b1b72c49064094511360c090b` 是不同 hash（V3-2-1 复用同一受控副本但 SHA 不同，说明本次是 fresh 重写或子采样；`sourceBytesMatched/sourceSha256Matched=true` 表明与源哈希在 RUNTIME 端校验通过，但本审查无法独立复算 3840078 字节私源哈希——禁止运行 Runtime/产品）。

结论：0700/0600 模式、真实 WAV 字节与 hash、create/cancel 幂等、orphan recovery 与未知目录保留、API no-store 与 closed request 全部按 V3-2-1 范围证据齐备。V3-2-1 LIMITED PASS 成立。

## 4. TaskArtifactSandbox / MediaAcquisitionCoordinator 假绿评估

### 4.1 Sandbox 路径/link/quota/owner cleanup

载荷未直接给出 sandbox 源代码，仅给出 `17-core-result.json` 字段与 `18-core-exit-audit.md` 描述：

- 路径：`artifactFileMode=0600`、`taskDirectoryMode=0700`，与 `08-policy-registry.json.temporaryArtifactPolicy` `taskDirectoryMode=0700`、`fileMode=0600` 精确一致；publicPathIncluded=false 与 `publicAbsolutePathAllowed=false` 一致。
- link / symlink / hardlink：`unknownDirectoryPreserved=true` 与 `16-core-threat-model.md` “未知/链接目录保留”控制项一致；该威胁要求 owner manifest schema+owner marker+directory token 全匹配，未匹配目录保留——这是 owner cleanup 的关键控制，`17-core-result.json` 用 `unknownDirectoryPreserved=true` 直接给出证据，符合“拒绝 symlink/hardlink 误删”边界。
- 配额：V3-2-1 范围内不下载，仅 sandbox 写入 3840078 字节音频；结果不含超额证据，但 `startupRecoveredOrphans=1` 表明清理扫描能跨越重启保留 owner manifest 标记。配额控制不在 V3-2-1 验收分母 RC01..RC16 中（RC09 配额属于 V3-2-2/3），故本阶段无配额正例属预期。
- owner cleanup：另建 orphan 后重启恢复 1 个，未知目录保留，与 `04-stage-gate.md §18`、`16-core-threat-model.md` “重启幽灵文件”行一致；`startupRecoveredOrphans=1` 是显式字段而非自由叙述文本。

未见假绿。

### 4.2 Coordinator identity / policy / cancel barrier

- identity：RC02..RC04 验证 task/source/adapter/part 精确；`17-core-result.json` 用 `cancelIdempotent=true`、`idempotent=true`、`closedRequestCode=V3_MEDIA_TASK_INVALID` 表明跨 task 身份冲突拒绝；不同 identity 的 taskId 冲突返回 `V3_MEDIA_TASK_INVALID`（与 `05-contract-spec.md §5.1` 一致）。
- policy：`08-policy-registry.json` B站 adapter 已注册，唯一 `adapterId=bilibili`；`05-contract-spec.md §3` 要求新门户必须独立权限、secret policy 与生产矩阵，符合“未注册 fail closed”。`17-core-result.json` 无 policy 漂移证据（无额外未注册 adapter 出现）。
- cancel barrier：`cancelHookCalls=1`、`cancelIdempotent=true`、`cancelledState=cancelled`、`cancelledTaskDirectoryRemoved=true`；该四元组精确对应 `05-contract-spec.md §5.2` “先设 cancel token、终止子进程、再进入 cleaning、cleanup receipt 通过后才返回 cancelled”。`18-core-exit-audit.md` M-2 显式记录“任务事实当前只在进程内；重启只保证私有 orphan cleanup，不保证任务恢复”——这是诚实承认而非掩盖限制，未冒进。

未见假绿。

### 4.3 假绿边界提醒

- `17-core-result.json` 是 V3-2-1 核心层证据，不含 production transcript / ASR route；`18-core-exit-audit.md` 写明“正式 run 使用私有真实 B站 WAV 的全部 `3840078` 字节…不计字幕/ASR production 成功”——本审查验证该边界声明未被冒进。
- `15-core-acceptance-plan.md` RC16 要求 ASR/credential/全 Runtime 通过 + Fatal=0/Major=0；`18-core-exit-audit.md` 报告 Runtime 全量 346 passed，定向 14 passed，前一子阶段前端全量 293 passed。本审查不运行测试，仅做证据可信度评估；上述数字未与外部证据交叉冲突。
- “false-green”结论：本审查在 V3-2-1 范围内未发现假绿证据；M-1（实施与审计同 session）与 M-2（任务事实仅进程内）已由实施方自陈，并被本独立审查独立复核。

## 5. 公开材料泄漏扫描

对 19 载荷做完整文本搜索，未发现：

- 绝对路径泄漏（Unix/Windows/Mac 风格均无；fixture 中 `/tmp/fixture.cookies`、`/tmp/fixture.wav` 是 schema 负例的预期字符串，独立成对、不与真实路径混用）。
- Cookie 值或 Cookie hash 字段（`08-policy-registry.json` 中 `cookieFilePathMayEnterPublicEvidence=false`；`17-core-result.json` 无 cookie 字段；`13-sensevoice-result.json` 无 cookie 字段）。
- 真实音频内容（仅有 `wavSha256`、`byteLength`、`sha256` 等元数据；`sourceKind=private_real_bilibili_audio` 是分类标签非音频本体）。
- 真实转写文本（仅有 `transcriptSha256`、`textSha256` 等哈希；fixture 中“合同正例中的本地转写片段一/二”是 schema 演示文本）。
- 账号 / 资料路径（无 `DedeUserID`、`BUVID`、`SESSDATA`、`bili_jct` 等真值；无 `/home/...` `/Users/...` `C:\\...` 等真实机器路径）。
- 公开 secret hit（grep `cookieValue`、`cookieFilePath`、`rawAudioPath` 等敏感字段名仅在 schema/fixtures 自身出现，且 fixtures 是负例的输入，不属于 production evidence）。

公开材料泄漏扫描结论：**0 hit**。隐私护栏维持。

## 6. 规格冲突问题判断

### 6.1 事实陈述

- 用户决策（2026-09-22）：跨模型退化检测、失败后智能质量回退移入 V4；SenseVoice 为 V3 development baseline。
- `04-stage-gate.md §4`：V3-2 revision 2 必须经过“120 秒 24 bin x 2 reviewer 双模型盲评、分歧复核、独立审计和用户批准”；`05-contract-spec.md §2` 进一步把 `productionReady=true` 固定在 schema 层。
- `19-core-prd-review.md` 与 `18-core-exit-audit.md` 均自陈“直接编码会导致规格双轨，必须先冻结 revision 3 或显式修订 v2 并独立审计”。

### 6.2 三项子问题逐项答复

**Q1：是否应新增 revision 3（推荐）而非静默放宽 v2？**

答：**是，必须新增 revision 3，禁止静默放宽 v2**。理由：

- v2 schema 的语义负载包含“cross-model 双 reviewer + adjudication”，这是 V3 旧决策产物；用户已显式将跨模型检测移入 V4。继续把 v2 的 productionReady=true 前置绑死在 V3 acquisition core 上，等于把 V4 决策强行用 V3 契约承担，构成规格双轨。
- “静默放宽 v2”指删除 v2 某字段但不增 revision，会破坏不可变历史、丢失审计可追溯链（V3-1P revision 1 已通过 SHA-256 锚定；V3-2 revision 2 也必须不可变）。新增 revision 3 是保留历史、显式变更、强制独立审计的最小破坏路径。
- 已有先例：`evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0b-fixed-window-adr.md` 即采用“新增子阶段编号 + 重新冻结合同 + 独立文档审计 + 用户新授权”模式，与 revision 3 思路一致。

**Q2：revision 3 是否应保留 12 URL、6+3+1+1+1 分类、identity/part/hash/真实授权探测，只移除 cross-model review/adjudication？**

答：**是，必须按此最小变更原则**。理由：

- 12 URL、6+3+1+1+1 分类、`mediaId/playbackUnitId/partId/partIndex` 与 page context、server probe 相等是样本分母与来源真相绑定，不属于 V4 决策影响范围，保留。
- identity / part / hash 绑定与真实授权探测是底线护栏，是 V3-2-2 实施时的最简门禁，保留。
- 唯一移除项：cross-model review 与 adjudication 字段（24 bin、双 reviewer、comparisonWindow 等），因为它们是 V4 能力的前置；移除后 productionReady=true 仍可由 schema 在 audit 与 hash 验证通过后给定。
- 任何其他字段都不应在 revision 3 中静默变更；如必须变更，按“显式修订 + revision 编号递增”原则处理。

**Q3：在该修订完成前，V3-2-2 implementation 是否必须 NO-GO？**

答：**是，必须 NO-GO**。理由：

- V3-2-2（`14-core-development-plan.md §4` “V3-2-2 B站字幕与媒体 acquirer”）必须基于 sample registry revision 才能注册 production 目标 part 与真实授权探测；如果 revision 3 未冻结，则 V3-2-2 实施无法满足“production 目标分 P、预期路线、三个 120s comparison window 及 bundle/review/adjudication hash 完整”中的 production 部分。
- V3-2-2 实施一旦发生，就会把“productionReady=true 的旧 v2 语义”与“实际不再跑 cross-model review”并存，制造假绿；这是 V3-2-1 范围已被显式排除的失败模式（`16-core-threat-model.md` “取消假成功”行）。
- 风险代价高于等待代价：等待 revision 3 冻结（约 1-2 个工作日量级的文档/审计）远小于“带着双轨规格进入实施后被迫回滚”的代价。

下一允许动作（按 `18-core-exit-audit.md §4`）：仅允许 V3-2 sample registry revision 3 文档冻结、内部/外部审查和 V3-2-2 详细计划。不得提前进入 V3-2-2 代码或扩大 productReadiness 解读。

## 7. Minor 合并清单（独立审查者记录）

- **SenseVoice baseline Minor-3**（本审查新增）：`installation.bytesCompleted=263943306` 与三个 `published` 文件 bytes 之和 258,371,224 差 5,572,082 字节未在 `12-sensevoice-exit-audit.md` 中归类解释；建议后续在 result JSON 中显式列出全部 published 文件清单，或在审计中加注 sidecar / catalog JSON 等辅助字节来源。不阻塞 PASS。
- **V3-2-1 M-1**（沿用 `18-core-exit-audit.md`）：实施与审计在同一 session，本独立审查作为外部复审提升独立性。
- **V3-2-1 M-2**（沿用）：任务事实仅进程内，重启只保证 orphan cleanup，不保证任务恢复；该行为符合 V3-2-1 范围，durable task 必须另立合同，不允许静默加入。
- **V3-2-1 Minor-3**（本审查新增，与 SenseVoice 同号无关）：`17-core-result.json` 未列出 49 cases 之外、media contract schema meta/positive 的可复算 evidence（如 Schema 文件名、SHA-256），仅在审计文本中引用；为符合 V3-1.3 复算闭环义务，建议在 V3-2-7 单 run evidence 中将合同文件的 SHA-256 写进 result 旁注或 evidence-manifest.json。本阶段不阻塞。

## 8. 门禁与禁止扩大声明

- `V3-2-0c-1 SenseVoice development baseline`：`LIMITED PASS` 维持，仅代表“可在真实链路中产生合法非空 SRT”，不声称 24-bin 跨模型质量门禁通过，不声称 production-ready。
- `V3-2-1 Runtime acquisition core`：`LIMITED PASS`，只覆盖 task 创建、取消、清理、API no-store、closed request、owner orphan recovery；不涉及字幕、ASR production、tabCapture、媒体下载、VideoOutline、Mindmap、Ask、持久任务恢复或导出。
- `V3-2-2 implementation`：`NO-GO`，直至 sample registry revision 3 冻结、内外审查完成、用户重新授权。
- `V3-2` 整体：`NOT PASSED`；`V3` 整体：`NOT PASSED`；`V2 / PX-6 / RKM` 继续 `PAUSED / INCOMPLETE`，不因本次审查改变。
- 本审查不构成 V3-2-0 旧候选失败（`04-stage-gate.md §12`）的改写；V3-2-0 仍 `FAIL / REOPENED`，历史盲评 critical / neither-acceptable 记录保留。
- 本审查未对外审包之外的任何产品代码、Registry、Schema 做出修改；未运行任何产品、浏览器、Runtime、旧 generator/validator。

## 9. 一句话结论

载荷完整、合同可复算、隐私不漏；SenseVoice baseline 与 V3-2-1 Runtime acquisition core 在各自限定范围内可取得 `LIMITED PASS`，V3-2-2 必须 NO-GO 直至 sample registry revision 3 冻结与独立审计完成。
