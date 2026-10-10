
# V3-3..V3-7 文档包独立只读审计报告

**审计者**：独立只读 reviewer（与历轮内审无关）
**日期**：2026-10-06
**对象**：`docs/active/project/external-audit-package/`（平铺 20 文件）
**方法**：先读 `AUDIT_MANIFEST.md` + `01-audit-request.md`；独立重算 19 载荷 SHA-256；实跑 `19-semantic-verifier.py`；独立检查 5 份 Schema meta、6 个正例，并独立构造 4 个语义负例；阅读 PRD/架构/stage gate/V3-3..V3-7 计划。
**边界**：未修改任何仓库文件；未运行产品/Chrome/Provider；未读取包外文件、未读取秘密；正例只用作 Schema 绑定证据，不当作生产事实。

---

## 0. 执行摘要

- 19/19 载荷 SHA-256 与 `AUDIT_MANIFEST.md` 完全一致。
- 5/5 Schema meta 通过 Draft 2020-12 元校验；6/6 positive instance 通过 schema + 语义校验。
- 19-semantic-verifier.py 在审计包目录实跑通过：10/10 内置负例被拒绝。
- 独立构造 4 个负例（dispatch sequence gap / CAS replay / seek 超 mediaDurationMs / sample identity reuse）全部 fail-closed。
- V3-3..V3-7 文档保留 B 站首版规格（锚点 BV1ZpYd66ELP、`mediaDurationMs=792000`、12 页 `6+3+1+1+1`、24 候选 / 12 证据 / 8 云端 / 1280 px、最长边限制、`knowledgeImportStatus=deferred_to_v4`）。
- 每份 V3-N 计划均在第 1–2 节显式声明"前置门禁"且将 V3-2 PASS / RapidOCR + VLM 冻结 / V3-N-1 PASS / 真实 sealed run / 用户明确高风险授权 列为可实施前置——前序关闭后文档足以指导自动化实现。
- 文档拒绝缩分母（A01..A20 固定 12 页、`Sample ID v3-sample-01..12` 唯一、`sourceIdentity`/`canonicalUrlSha256` 唯一）、跨 run/mock（V3-6 §3 单一 run、§6 private/public 分类）、代签（`reviewerRole=independent_human_reviewer`、`overallDecision` 优先级 BLOCKED > FAIL > PASS）、泄密（`secretHitCount=0`、`publicPackageSha256`、`relativeArtifactRef` 不允许 `..` 或 `/` 开头）。
- V3-0 umbrella `v3_media_companion_contracts.schema.json` **未**进入审计包；只有 stage-specific 合同（07/11/14/15/18）。Stage gate §21、计划 §2 显式禁止旧 umbrella 覆盖新阶段语义。
- **表 A（本次文档包缺陷）**：Fatal=0 / Major=0 / Minor=2。
- **表 B（真实实现前置阻塞）**：7 项，全部继承自 stage gate §11–§24，非本包文档缺陷。

---

## 1. 范围与方法

| 步骤 | 命令 / 文件:行 | 结果 |
|---|---|---|
| 文件计数 | `find . -maxdepth 1 -type f \| wc -l` | 20 |
| 读取入口 | `AUDIT_MANIFEST.md:1-25`、`01-audit-request.md:1-34` | 已读 |
| 重算 19 载荷 SHA-256 | `sha256sum 01..19` | 19/19 匹配 |
| 元校验 5 Schema | `Draft202012Validator.check_schema`（由 verifier 调用） | 5/5 通过 |
| 正例 schema 校验 | verifier 内部 `Draft202012Validator(...).validate(...)` | 6/6 通过 |
| 跨字段语义 | verifier `validate_vision/outline/product/human/final` | 6/6 通过 |
| 工具内置负例 | verifier 自身 10 项 | 10/10 被拒绝 |
| 独立负例 4 项 | python3 inline 复用 `validate_*` 函数 + 自构造 mutation | 4/4 被拒绝 |
| 文本阅读 | PRD §18.2–§18.9 (02-prd.md:2260–2396)、架构 §22 (03-architecture.md:2256–2568)、stage gate §11–§24 (04-stage-gate.md:104–230)、5 份 V3-N 计划 | 已读 |

---

## 2. 19 载荷 SHA-256 重算表

| 文件 | 字节 | 重算 SHA-256 | AUDIT_MANIFEST 期望 | 一致 |
|---|---:|---|---|:-:|
| 01-audit-request.md | 2940 | `43e170cec1ffec95de660d58938a3e04ce71c6879ce5a37799d310ae8acc8f2a` | 同 | ✓ |
| 02-prd.md | 150441 | `87416b59bd595d9e2e9ee7d57da591c3063f115e7cbe0cfd6dcdb2cf6bc18ce0` | 同 | ✓ |
| 03-architecture.md | 168413 | `dd74d85c86a488fd6eedd08f8433f13f4a90b94cd3db9316abbcbdfb8c98031f` | 同 | ✓ |
| 04-stage-gate.md | 29439 | `b2568d518cd43d773e63e281d15e338a0bb637bbd2ddba95c86ed04f222f69a5` | 同 | ✓ |
| 05-v3-3-development-plan.md | 8017 | `f010eb761fe948672629572ab54e28d4ccebc40243a49dd99b71589b47d4d336` | 同 | ✓ |
| 06-v3-3-acceptance-plan.md | 4454 | `3882c3d4b26cded0af3ac713c7ebd1e3a68be5413af5f01591cc6211ee4942a8` | 同 | ✓ |
| 07-vision-evidence.schema.json | 9165 | `570485e0e41edafa5d2ad89acbcc6495293daf57ee930638cc9e54d2c25a9128` | 同 | ✓ |
| 08-vision-outline-positive.json | 7723 | `c75be851c1e86b6ad6b6b2a0a6a4c8a1ed7bb47be4a2136f1fc161d08a1c6061` | 同 | ✓ |
| 09-v3-4-development-plan.md | 7524 | `67c7449d4757f74ac10de6862bc358518d6276b9e18a177dc322c84103310474` | 同 | ✓ |
| 10-v3-4-acceptance-plan.md | 4105 | `a5cbf8947a378bd85ab81d3e673b71731e1622f4d67e2e804cda4f069d499ebe` | 同 | ✓ |
| 11-outline-taskstore.schema.json | 7834 | `75f88ea0c366132ba9a2008038062c6984a19295b048698a32746140153438f4` | 同 | ✓ |
| 12-v3-5-development-plan.md | 6921 | `470b4b485f2d52c89a0c7bbcc74ff203a7968933335a3d2fbd8f17f9b74a26dd` | 同 | ✓ |
| 13-v3-5-acceptance-plan.md | 4387 | `83af19e3b9553b2ec9a2a04352e479c8700da2f2c6272c1a6f7e26bd1110b88d` | 同 | ✓ |
| 14-product-acceptance.schema.json | 7159 | `0b62165c8b9257218ac6f21ac826e8bc1259ddb0d92510184583b4d08dbee65f` | 同 | ✓ |
| 15-human-review.schema.json | 2743 | `f880b637a9ab217658ae771567c85574ebd50bc2ebc69be236e7aee03bdcba8a` | 同 | ✓ |
| 16-product-final-positive.json | 17624 | `fd4b5ab833e62f4bf68534defd2ddeeea810b3dad06c37f11dfd38e94bacaee4` | 同 | ✓ |
| 17-v3-6-7-plan.md | 5535 | `bb540de21958fccddf9cb1b91f03b1cace76beaec0c67bef47d47c776586589b` | 同 | ✓ |
| 18-finalization.schema.json | 4550 | `eeba093fd673ff4dead309c7ff71171d5a9e510066d05987c4e21c1fa94424e1` | 同 | ✓ |
| 19-semantic-verifier.py | 15410 | `71ce488a2d66e0ab738662d4b3431dbad420d4164f4ac1c5cd74d8c2f7f36332` | 同 | ✓ |

总计 19 行 payload + 1 行 AUDIT_MANIFEST.md = 20 文件。

---

## 3. 5 份 Schema meta 独立检查

### 3.1 `07-vision-evidence.schema.json:1-258`

| 字段 | 值 | 含义 |
|---|---|---|
| `$id` | `navia.local/contracts/v3-media-vision-evidence/v1` | V3-3 stage-specific |
| 必填 top-level | `schemaVersion, taskId, sourceIdentity, samplingPolicy, consent, frames, ocrObservations, visionObservations, cleanup` | 8 项全部必填，缺一即拒 |
| `additionalProperties: false` | ✓ | 拒绝未声明字段 |
| `SamplingPolicy.policyVersion` | `const "v3-frame-sampling/v1"` | 策略版本固定 |
| `candidateFrameLimit / selectedEvidenceLimit / cloudVisionFrameLimit / maxDimensionPx` | `const 24 / 12 / 8 / 1280` | 三层预算 + 长边死硬 |
| `rawVideoUploadAllowed` | `const false` | 原视频上传死硬关闭 |
| `ConsentReceipt.state` | `enum ["granted","revoked","not_granted"]` | 仅三种状态 |
| `postRevocationDispatchCount` | `const 0` | 撤销后零 dispatch 机器硬约束 |
| `consentCheckedPerDispatch` | `const true` | 每次必检 |
| `authorizedDispatchCount` | `integer, maximum: 8` | 与 cloud 预算对齐 |
| `FrameEvidence.retention` | `enum evidence_until_task_delete \| delete_at_terminal` | 证据帧 vs 候选帧分类 |
| `FrameEvidence.relativeArtifactRef` | regex 禁止 `..`、禁止以 `/` 开头 | 防路径穿越 |
| `VisionObservation.consentDecisionId` | `pattern ^consent_[a-f0-9]{32}$` | 必须与 receipt 一致 |
| `VisionObservation.dispatchSequence` | `integer, 0 ≤ x ≤ 7` | 与 8 帧上限对齐 |
| `VisionObservation.usage.estimatedCostUsd` | `null` 合法 | 未知 cost 显式 null |
| `CleanupReceipt.residualNonEvidenceFrameCount / pendingOutboundRequestCount` | `const 0` | 清理闭环硬约束 |

✓ 该 Schema 完整保留 B 站 V3-3 vision 治理语义，独立 `Draft202012Validator.check_schema` 通过。

### 3.2 `11-outline-taskstore.schema.json:1-215`

| 字段 | 值 | 含义 |
|---|---|---|
| `$id` | `navia.local/contracts/v3-media-outline-taskstore/v1` | V3-4 stage-specific |
| `Task.state` | 11 种 enum（created…cancelled） | 闭集状态机 |
| `Task.knowledgeImportStatus` | `const "deferred_to_v4"` | V4 边界硬约束 |
| `Task.revision` | `integer ≥ 1` | CAS 单调递增基础 |
| `EvidenceRef.kind` | `transcript \| frame \| ocr_block \| vision_caption` | 证据分型闭合 |
| `Outline.sections` | `minItems: 1`，每段 `evidenceIds minItems: 1` | 章节必须挂证据 |
| `Mindmap.nodes` | `minItems: 2`（含根），唯一根 | 唯一根硬约束 |
| `TransactionReceipt.expectedRevision + 1 = committedRevision` | 强制 + 1 推进 | CAS 不允许跳跃/倒退 |
| `duplicateWriteCount / unresolvedEvidenceReferenceCount / crossTaskEvidenceReferenceCount` | `const 0` | 三项零计数硬约束 |
| `projectionEvidenceClosurePassed` | `const true` | 三视图同源投影 |

✓ Schema 强制 transaction 原子提交、CAS 单步推进、三项零计数、projection 闭合。

### 3.3 `14-product-acceptance.schema.json:1-147`

| 字段 | 值 | 含义 |
|---|---|---|
| `$id` | `navia.local/contracts/v3-media-product-acceptance/v1` | V3-5 stage-specific |
| `runId` | `pattern ^v3-5-product-[0-9]{8}T[0-9]{6}Z$` | 唯一时间戳 run |
| `TaskBinding.mediaDurationMs` | `integer ≥ 1` | 当前分 P 时长绑定 |
| `surfaces` | `minItems: 4, maxItems: 4` | 强制 360/420/768/1280 四视口 |
| `Surface` | enum side_panel/workspace + viewport 4 选 | 与 RKM-REQ-13 对齐（02-prd.md:2123） |
| `routes` | `minItems: 8`，routeId 8 选 | 与 V3-5 plan §3 路由表完全一致 |
| `RouteObservation.mode` | enum `direct/reload/back/reopen/invalid/forbidden` | 6 模式闭集 |
| `AskResult` | 含 `allOf`：answered → 有 answer + ≥1 evidenceId；insufficient_evidence → answer 空 + 0 evidence | 双条件互斥 |
| `SeekObservation.outcome` | enum `located/fallback/blocked`；`located` 强制 `pageIdentityMatched: true` | Schema 层 placed condition |
| `SeekObservation.deltaMs` | `0 ≤ x ≤ 2000` | ≤2 秒硬约束 |
| `exports` | `min/max: 2`，`format` enum markdown_zip/json_bundle | 两格式必齐 |
| `ExportReceipt.knowledgeImportStatus` | `const deferred_to_v4` | 导出不等于导入 |
| `requirements` | `min/max: 18`，`requirementId pattern ^V3-5-A(?:0[1-9]\|1[0-8])$` | V3-5-A01..A18 精确分母 |
| `machinePassed` | `const true` | 自动化门槛过线 |

✓ V3-5 product acceptance 完整保留四视口、5 seek origin、2 export、18 requirement 分母、knowledgeImport deferred。

### 3.4 `15-human-review.schema.json:1-55`

| 字段 | 值 | 含义 |
|---|---|---|
| `$id` | `navia.local/contracts/v3-media-human-review/v1` | V3-5 human review stage-specific |
| `reviewerRole` | `const "independent_human_reviewer"` | 拒绝自动化代签 |
| `judgments` | `min/max: 10`，`requirementId pattern ^H(?:0[1-9]\|10)$` | H01..H10 精确分母 |
| `allOf` 块 | PASS → 全部 PASS；FAIL → 含 FAIL 且不含 BLOCKED；BLOCKED → 含 BLOCKED | 优先级 BLOCKED > FAIL > PASS，机器硬约束 |
| `screenshotRefs` | `minItems: 1` | 必须有证据图 |
| `overallDecision` | enum PASS/FAIL/BLOCKED | 三态 |

✓ Human schema 强约束 human 不补写机器证据（人类只填 `decision + screenshotRefs + note`），且 BLOCKED 优先级覆盖 PASS。

### 3.5 `18-finalization.schema.json:1-85`

| 字段 | 值 | 含义 |
|---|---|---|
| `$id` | `navia.local/contracts/v3-media-finalization/v1` | V3-6/7 stage-specific |
| `oneOf` | FinalizationCandidate \| FinalDisposition | 二选一，杜绝一阶段越权 |
| `FinalizationCandidate.auditStatus` | `const "pending_independent_audit"` | 候选必 pending |
| `FinalizationCandidate.finalPassed` | `const false` | 候选必未通过 |
| `FinalizationCandidate.classificationCounts` | subtitle=6, asr=3, multipart=1, restricted=1, lowSignal=1 | `6+3+1+1+1` 硬约束 |
| `FinalizationCandidate.sampleCount` | `const 12`，`samples` 12 项 | 12 页固定分母 |
| `SampleResult.sampleId` | `pattern ^v3-sample-(?:0[1-9]\|1[0-2])$` | 12 个样本 ID 唯一顺序 |
| `FinalizationCandidate.secretHitCount / residualCount` | `const 0` | 秘密与残留零 |
| `FinalDisposition.fatalCount / majorCount` | `const 0` | 双零硬约束 |
| `FinalDisposition.decision` | `const "PASS"` | 单态 |
| `FinalDisposition.allowedClaim` | `const "V3 Bilibili-first media companion passed the frozen subtitle/local-ASR/keyframe/OCR/authorized-cloud-VLM acceptance matrix."` | **精确字符串固定，禁止扩大声明** |

✓ Finalization schema 把"候选 vs 终审"两阶段结构 + 12 页 `6+3+1+1+1` + allowedClaim 固定为机器层硬约束。

---

## 4. 6 个正例独立检查

### 4.1 `08-vision-outline-positive.json:1-214` — visionEvidence

- 2 帧，1 selected + 1 not（对应 cleanup `candidateFrameCount=2 / retainedEvidenceFrameCount=1 / deletedNonEvidenceFrameCount=1`，三项精确自洽，`07:64-66` 强制）。
- 1 OCR，`providerId="rapidocr_local"`、`localOnly=true`、`engineVersion="pinned-at-v3-3-freeze"`，符合 V3-3 §3 实体职责（`05:28-32`）。
- 1 vision observation，consent state=granted、`authorizedDispatchCount=1`（与 observations 数量对齐）、`dispatchSequence=0`、`consentValidAtDispatch=true`、`consentDecisionId` 与 receipt 一致；`uploadedAt (14:01:00Z) > grantedAt (14:00:00Z)`；`revokedAt=null`，所以撤销后零 dispatch 不需要再校验。
- usage `inputImageCount=1`、`inputTokens/outputTokens/estimatedCostUsd` 均为 `null`（schema 允许 null，符合 V3-3 §3 "未知 cost 为 null"）。
- ✓ Schema-valid；语义 verifier `validate_vision` 通过。

### 4.2 `08-vision-outline-positive.json:110-213` — outlineTaskStore

- task revision=7，`state=ready`、`knowledgeImportStatus="deferred_to_v4"`。
- evidenceCatalog：1 transcript (`mtr_88..`) + 1 frame (`mev_33..`)，ID 唯一。
- outline 1 section，时间 `startMs=90000 < endMs=150000`，`evidenceIds` 含 catalog 中两项，闭合。
- timeline 1 段，`sequence=0`，与 outline `outlineId` 一致，闭合。
- mindmap 2 节点（根 + 子），唯一根，子节点 `sectionId` 对应 section，`evidenceIds` 闭合。
- transactionReceipt：`expectedRevision=6`、`committedRevision=7`（恰好 +1）；`aggregateCommitted|eventCommitted|outboxCommitted=true`；`duplicateWriteCount=0 / unresolvedEvidenceReferenceCount=0 / crossTaskEvidenceReferenceCount=0`；`projectionEvidenceClosurePassed=true`。
- ✓ Schema-valid；语义 `validate_outline` 通过。

### 4.3 `16-product-final-positive.json:1-67` — productAcceptance

- 4 surfaces 精确覆盖 360/420/768/1280；`rootOverflow=false / axeSerious=0 / axeCritical=0 / keyboardPassed=true`。
- 8 routes 含 6 成功 + invalid (`/evidence/:evidenceId`) + forbidden (`/export`)；mode 集合 `{direct, reload, back, reopen, invalid, forbidden}` 完整；`runtimeRead=true`。
- 2 askResults：1 grounded answered（有 evidenceId）+ 1 unsupported insufficient_evidence（answer=""、evidenceIds=[]），分别命中 schema `allOf` 两支。
- 5 seekObservations：origins `{outline, timeline, mindmap, ask_citation, evidence_drawer}` 完整；5/5 `outcome=located`、`deltaMs=500`、`pageIdentityMatched=true`；`requestedMs/observedMs ≤ mediaDurationMs=792000`。
- 2 exports：markdown_zip + json_bundle，`knowledgeImportStatus="deferred_to_v4"`。
- 18 requirements `V3-5-A01..A18` 全部 `passed=true`。
- `machinePassed=true`。
- ✓ Schema-valid；`validate_product` 通过。

### 4.4 `16-product-final-positive.json:68-89` — humanReview

- `bundleSha256` 非空、`runId=v3-5-product-20261006T150000Z`、`buildTreeSha256` 引用与 product 同 build。
- `reviewerRole="independent_human_reviewer"`、`reviewerId="fixture-reviewer"`（fixture 占位，notes 标 `fixture only`，且 final disposition 在 V3-6 才产生，所以此为 schema-valid 模板而非真实人类签署）。
- 10 judgments `H01..H10` 全 PASS、`screenshotRefs` 各 1 张。
- `overallDecision=PASS` 与 10 PASS 一致（命中 schema PASS 分支）。
- ✓ Schema-valid；`validate_human` 通过。

### 4.5 `16-product-final-positive.json:90-144` — finalizationCandidate

- `auditStatus="pending_independent_audit"`、`finalPassed=false`、`machinePassed=true`。
- `classificationCounts={subtitle:6, asr:3, multipart:1, restricted:1, lowSignal:1}` 与 `sampleCount=12` 完全一致；总和 12 = sampleCount。
- 12 samples `v3-sample-01..12`，`sourceIdentity` 12 个全部不同（BV01..BV12 各异）、`canonicalUrlSha256` 12 个全部不同、`expectedClass` 与 counts 精确对齐。
- `restricted` → `terminalStatus="blocked"`、`low_signal` → `terminalStatus="degraded"`（命中 `validate_final` 两条强制）。
- 20 requirements `V3-6-A01..A20` 全部 `passed=true`。
- `humanReviewSha256` 引用 V3-5 候选（绑定）、`publicPackageSha256`、`sealSha256`、`secretHitCount=0`、`residualCount=0`。
- ✓ Schema-valid；`validate_final(candidate, …)` 通过。

### 4.6 `16-product-final-positive.json:145-159` — finalDisposition

- `recordType="final_disposition"`、`candidateId` 与 candidate 一致、`candidateSha256` 占位。
- `fatalCount=0`、`majorCount=0`、`minorCount=0`、`decision="PASS"`、`finalPassed=true`、`allowedClaim` 为 V3-7 精确固定字符串。
- ✓ Schema-valid；`validate_final(…, disposition)` 通过 `candidateId` 一致性 + `candidate.finalPassed=false / disposition.finalPassed=true` 翻转校验。

---

## 5. `19-semantic-verifier.py` 实跑

命令：`python3 19-semantic-verifier.py --package .`

输出：

```json
{
  "schemaVersion": "v3-3-7-semantic-verifier-result/v1",
  "package": "...",
  "schemaMetaPassed": 5,
  "positiveInstancesPassed": 6,
  "semanticNegativeCases": [
    {"case": "vision-dispatch-gap",          "rejected": true},
    {"case": "vision-without-consent",       "rejected": true},
    {"case": "outline-cas-replay",           "rejected": true},
    {"case": "outline-reversed-time",        "rejected": true},
    {"case": "timeline-unresolved-section", "rejected": true},
    {"case": "product-route-shrink",         "rejected": true},
    {"case": "product-seek-arithmetic",      "rejected": true},
    {"case": "product-seek-over-duration",   "rejected": true},
    {"case": "human-false-overall",          "rejected": true},
    {"case": "final-source-reuse",           "rejected": true}
  ],
  "summary": {"total": 10, "rejected": 10, "passed": true}
}
```

- `schemaMetaPassed=5` ⇒ Draft 2020-12 元校验 5/5。
- `positiveInstancesPassed=6` ⇒ 6 个 instance schema + 跨字段语义校验全过。
- 10/10 内置负例被 fail-closed 拒绝。
- 工具规则我已独立读过（`19-semantic-verifier.py:33-217`），关键不变量：
  - vision: `dispatchSequence == range(len(observations))`、`postRevocationDispatchCount == 0`、`cleanup.candidateFrameCount == len(frames)`、selected frame 才被 dispatch、request/response hash 不为空。
  - outline: `expectedRevision + 1 == committedRevision`、outline/timeline/mindmap evidence 全部闭合、唯一根、时间非逆序、timeline 段不重叠。
  - product: `4 视口精确`、`8 route 精确`、`18 requirement 精确`、`5 seek origin 闭集`、`deltaMs = |observed - requested|`、`requested/observed ≤ mediaDurationMs`、`located → pageIdentityMatched=true && deltaMs ≤ 2000`。
  - human: BLOCKED 优先 FAIL 优先 PASS。
  - final: 20 requirement、12 样本、`6+3+1+1+1`、restricted↔blocked、low_signal↔degraded、`sourceIdentity` 与 `canonicalUrlSha256` 各 12 唯一、`finalPassed` 由 false 翻 true。

---

## 6. 4 个独立负例（与 verifier 内置角度不同）

我未复用 verifier 自带的 mutation，重新构造 4 个独立角度：

| # | 角度 | 字段:行 | mutation | 期望 fail-closed 原因 | 实测 |
|---|---|---|---|---|:-:|
| 1 | dispatch sequence gap | `08-vision-outline-positive.json:73-99` 的 `visionObservations[0]` | `dispatchSequence: 2`（保留 0 在范围内但跳过 1） | `19-semantic-verifier.py:50` 强制 `dispatchSequence == list(range(len(observations)))`；现序列 `[2] ≠ [0]` | rejected=true ✓ |
| 2 | CAS replay（陈旧 commit） | `08-vision-outline-positive.json:199-211` 的 `transactionReceipt` | `expectedRevision=8, committedRevision=5`（`< expectedRevision`） | `19-semantic-verifier.py:103` 强制 `committedRevision == expectedRevision + 1` 且 `== task.revision=7` | rejected=true ✓ |
| 3 | seek observed 超 mediaDurationMs | `16-product-final-positive.json:34-40` `seekObservations[2]` | `requestedMs = duration - 1000, observedMs = duration + 5000, deltaMs = 6000, outcome = located, pageIdentityMatched=true` | `19-semantic-verifier.py:126` 强制 `observedMs ≤ mediaDurationMs`；并且 `deltaMs=6000 > 2000` 同时破坏 located 约束 | rejected=true ✓ |
| 4 | sample identity reuse via canonicalUrlSha256 | `16-product-final-positive.json:99-112` `samples` | `samples[7].canonicalUrlSha256 = samples[3].canonicalUrlSha256`（`sourceIdentity` 仍各自不同） | `19-semantic-verifier.py:144` 强制 `len({canonicalUrlSha256}) == 12` | rejected=true ✓ |

实测命令（一次性脚本，注入 verifier 模块，未修改任何文件）：
- 4/4 `rejected=True`。说明 schema + 语义 verifier 对 **不同类型** 的绕过尝试也 fail-closed，不依赖 verifier 内置的 mutation。

---

## 7. V3-3..V3-7 文档独立审查

### 7.1 是否保留 B 站首版规格？

| 元素 | 文档位置 | 是否保留 |
|---|---|:-:|
| 锚点 `BV1ZpYd66ELP` | stage gate §4 (04:42)、PRD §18.1 (02:2219–2253) | ✓ |
| 单 P / 792 秒 | stage gate §4 (04:43)、PRD (02:2219、2246)、product positive `mediaDurationMs=792000` (16:12) | ✓ |
| 12 页 `6+3+1+1+1` 固定分母 | stage gate §4 (04:45)、V3-3 plan (05:79-81)、V3-4 plan (09:67-72)、V3-6 plan §3 (17:21)、PRD (02:2323、2384) | ✓ |
| 24 候选 / 12 证据 / 8 云端 VLM / 1280 px / rawVideoUploadAllowed=false | V3-3 plan §4 (05:39-46)、schema `SamplingPolicy` 全部 const (07:60-68) | ✓ |
| `selected_frame_cloud_vision` 五项 scope | V3-3 plan §3 (05:30)、V3-5 plan §2 (12:18)、schema `ConsentReceipt.scope` (07:84) | ✓ |
| 路线顺序 `credentialed_subtitle → credentialed_media_asr → public_or_page_subtitle → trusted_tab_capture_asr` | V3-2 plan（stage gate §12:124）、PRD §18.4 (02:2306-2312) | ✓ |
| `knowledgeImportStatus = deferred_to_v4` | schema `Task` (11:74)、`ExportReceipt` (14:121)、`Positive` outlineTaskStore (08:119) | ✓ |
| V3 不新增 YouTube/小红书/直播/V4 全量 | PRD §22.1 (03:2318-2320)、stage gate §6 (04:62)、§8 (04:81) | ✓ |
| Bilibili 优先（B 站不进 V3 VLM 升级、不进 RAG） | PRD §22.2–§22.5、stage gate §6 | ✓ |

**结论**：B 站首版规格完整保留，无任何 YouTube/小红书/直播/V4 扩大。

### 7.2 在前序关闭后能否指导自动化实现？

| 计划 | 前置门禁 | 文档具体度 |
|---|---|---|
| V3-3 (05) | V3-2-7 PASS + RapidOCR 冻结 + 真实 VLM provider/model capability probe + 用户授权（05:14-22） | 实体表（05:23-32）、FailureCode 闭集 16 项（05:113-115）、子阶段 V3-3-0..-7（05:50-110）全部含验收与出门条件；不再是大纲 |
| V3-4 (09) | V3-3 PASS + schema 外部审查通过 + Python sqlite3 + 合成 Provider 经 D Adapter（09:13-18） | SQLite 表 + 主键（09:36-44）、事务原子性（09:45-46）、状态机（09:50-63）、FailureCode 闭集 15 项（09:108-111）、子阶段 V3-4-0..-7 |
| V3-5 (12) | V3-4 PASS + product/human schema 外部审查 + 自动 UI/Axe/键盘/seek/Ask/export 全 PASS（12:18-22） | 组件+路由表、Ask/jumpback/export 详细规则（12:51-73）、子阶段 V3-5-0..-7（12:77-114） |
| V3-6 (17) | V3-1..V3-5 全 PASS + H submission Schema-valid + Revision 3 registry + 工具链冻结（17:13-17） | A01..A20 精确 20 项（17:27-49）、故障矩阵 17 类（17:50-53）、子阶段 V3-6-0..-7（17:62-71） |
| V3-7 (17:73-83) | V3-6 candidate | 独立 reviewer 复算 hash/seal + 12 页分类 + 允许声明约束；Fatal/Major=0 才允许最终声明 |

**结论**：每份计划都在前置关闭条件下提供足够具体的实体路径、文件位置、FailureCode、固定分母与出门条件，可直接驱动自动化实施。但任何阶段前置未关闭时，文档自身就阻止实施进入（见 7.3）。

### 7.3 是否拒绝缩分母 / 跨 run / mock / 代签 / 泄密？

| 风险 | 文档拒绝机制 |
|---|---|
| **缩分母** | A01..A20 固定（17:27-49）；`requirementId pattern ^V3-6-A(?:0[1-9]\|1[0-9]\|20)$` schema 硬约束（18:16）；`SampleResult.sampleId` 12 唯一（18:26）；`classificationCounts` `const 6/3/1/1/1`（18:49）；`sampleCount const 12`（18:51）；`sourceIdentity` 12 唯一、`canonicalUrlSha256` 12 唯一（schema + verifier） |
| **跨 run / mock** | V3-6 §3 "12 个唯一 URL…同一 run 中…blocked/degraded 是预期终态，不从分母删除"（17:21-23）；§4 A02 "全新 build/profile/runtime/db/task/evidence root"（17:30）；§4 A17 "H01..H10 只引用 V3-5 已签署 submission，0 自动修改"（17:45）；V3-7 "V3-7 不代签或改写 H01..H10"（17:9）；allowedClaim const 固定（18:81） |
| **代签** | `reviewerRole const "independent_human_reviewer"`（15:14）；`judgments min/maxItems 10`（15:16）；schema `allOf` BLOCKED > FAIL > PASS（15:19-39）；final disposition `finalPassed=true` 必须 0 fatal + 0 major；`minorCount` 可变但 ≠ 0 即不算 perfect PASS |
| **泄密** | `FrameEvidence.relativeArtifactRef` regex 禁止 `..` 与 `/` 开头（07:122-125）；`secretHitCount const 0`（18:57）；`residualCount const 0`（18:58）；`publicPackageSha256` 必填（18:56）；V3-4 §3 "task 删除/导出清理由 V3-5 最终冻结；本阶段不得声称 Durable Forget 或 V4 知识删除已实现"（10:54-56）；V3-6 §6 "公开 tar 禁止 Cookie/API key/token、profile、绝对路径、原始私有媒体和 DB/WAL"（17:58） |

**结论**：5 类违规均有文档级硬约束 + Schema/verifier 双重机器把关。

### 7.4 旧 V3-0 umbrella schema 是否会覆盖新 stage contracts？

- 审计包内 **不存在** `v3_media_companion_contracts.schema.json`；包内只有 stage-specific 合同（07/11/14/15/18）。验证命令：
  - `grep -l "v3_media_companion_contracts" ./*` ⇒ 仅 `04-stage-gate.md`（条件 2 引用）与 `12-v3-5-development-plan.md`（声明禁止覆盖），无 schema 文件。
- stage gate §21 显式声明："旧 V3-0 umbrella fixture schema 不得覆盖最新阶段合同"（04:211）。
- V3-5 plan §2 显式要求："V3-5 必须新建 stage-specific product acceptance schema，并逐项引用 V3-1.3/V3-2/V3-3/V3-4 最新合同，禁止旧字段覆盖新语义"（12:19）。

**结论**：V3-0 umbrella 不会覆盖新合同，文档已显式禁止。

### 7.5 继承 Major 是否保留？是否存在"文档通过即越过 V3-2/Provider/用户授权"的路径？

| 阶段 | 文档是否继承前置 Major |
|---|:-:|
| V3-3 | 状态行 "DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / V3-2 PASS REQUIRED / PROVIDER FREEZE REQUIRED"（05:3）；§2 实施前必须满足 V3-2-7 sealed run + RapidOCR 冻结 + VLM provider/model capability probe + 用户授权（05:14-22） |
| V3-4 | 状态行 "DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / V3-3 PASS REQUIRED"（09:3）；§2 前置 V3-3 限定 PASS + schema 外部审查 + 用户明确批准（09:13-18） |
| V3-5 | 状态行 "DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / V3-4 PASS REQUIRED / ONLY HUMAN ACCEPTANCE STAGE"（12:3）；§2 前置 V3-4 PASS + 自动 UI 门槛全 PASS（12:17-21） |
| V3-6/7 | 状态行 "DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / V3-5 PASS REQUIRED"（17:3）；§2 V3-1..V3-5 全 PASS + H submission Schema-valid + 工具链冻结 + 用户授权（17:13-17） |
| Final disposition | `fatalCount=0, majorCount=0, decision=PASS` 才能 `finalPassed=true`（18:76-80）；allowedClaim const 限定单句 |

**结论**：无"文档通过即越过前置"的路径；每个阶段都把 V3-2 PASS、Provider 冻结、V3-N-1 PASS、用户高风险授权列为硬前置。

---

## 8. 表 A — 本次文档包缺陷严重度

| # | 缺陷 | 严重度 | 文件:行 | 说明 |
|---|---|---|---|---|
| 1 | 正例 `08-vision-outline-positive.json` 的 `sourceIdentity` 使用占位 `cid=987654`（与 stage gate §4 记录的真实 cid `41828944992` 不同） | **Minor** | 08-vision-outline-positive.json:5, 113 | 仅为 fixture 占位，不影响 schema 通过；PRD/stage gate 已明确锚点 cid=41828944992。**不**属于"缩分母/伪造事实"，因为正例 schema 字段绑定正确、verifier 通过。整改建议：fixture 标注 `fixture-cid` 提示性 comment，不强制改值 |
| 2 | 正例所有 SHA-256 字段使用占位字符（`aaaa…`、`bbbb…` 等），未在 fixture 元数据中显式标注 `fixture-only` | **Minor** | 16-product-final-positive.json 多处；08-vision-outline-positive.json 多处 | 同样为 fixture 占位，schema 不强制"必须真实"，但 verifier 也未校验 placeholder。整改建议：在正例顶层加 `"_fixtureOnly": true` 元数据，并让 verifier 跳过 placeholder 校验 |

**统计**：Fatal = **0** / Major = **0** / Minor = **2**。

注：以下"问题"已确认 **不是**本包文档缺陷，而是 §9 真实实现前置阻塞：
- Schema 未覆盖 GoLive 真实 run —— 本包为 DOCUMENT CANDIDATE 阶段，目的就是等真实 run 落地。
- 文档未自带"真实 bilibili cid 与真实验证证据" —— 与 §9 项 1 重叠。
- 缺 V4 知识持久化实现 —— V4 范围外，且 schema 已固定 `deferred_to_v4`。

---

## 9. 表 B — 真实实现前置阻塞（继承自 stage gate，非本包缺陷）

> 严格区分：本表是 stage gate §11–§24 已记录的真实实现阻塞，**不计入本包文档 Major**；本包文档已显式拒绝"绕过"路径。

| # | 阻塞 | 来源 | 影响阶段 |
|---|---|---|---|
| 1 | V3-2-2 真实授权会话 `code=-101 / isLogin=false` 仍未关闭 | 04-stage-gate.md:185-188 | V3-3 实施前置 |
| 2 | RapidOCR 引擎/模型/revision/资产 SHA-256/许可未冻结 | 05-v3-3-development-plan.md:14-21 | V3-3 实施前置 |
| 3 | 真实 VLM provider/model/API base/凭据注入/usage mapping 未冻结且无 capability probe | 05-v3-3-development-plan.md:16-19 | V3-3 实施前置 |
| 4 | V3-3 实施前文档审查未完成（stage gate §21 记 Major=3/Minor=1） | 04-stage-gate.md:201-204 | V3-3 实施前置 |
| 5 | V3-4 外部文档审查未执行（stage gate §21 记 Major=2/Minor=1） | 04-stage-gate.md:204-205 | V3-4 实施前置 |
| 6 | V3-5 product/human 合同外部审查未完成 + 真实 build 未生成 + 截图验收页未冻结（stage gate §22 记 Major=2/Minor=1） | 04-stage-gate.md:210-211 | V3-5 实施前置 |
| 7 | V3-6/7 collector/verifier/final schema 工具链未冻结 + 尚无 V3-1..5 同一可追溯生产 build + H submission 未生成（stage gate §22 记 Major=3/Minor=0） | 04-stage-gate.md:212-213 | V3-6/7 实施前置 |
| 8 | V3-1.2 后续需要用户单独高风险授权后才允许 V3-2 代码 | 04-stage-gate.md:117 | V3-2 代码前置 |
| 9 | 2026-10-06 独立 Claude CLI 审查尝试持续约 11 分钟无输出后终止，不得将进程启动记录当作外审 PASS | 04-stage-gate.md:220 | 当前本审计报告的独立性背景 |

**结论**：9 项均非本包文档缺陷，stage gate 已显式声明。

---

## 10. 允许 / 禁止

### 10.1 允许

- 在 V3-2 通过且 RapidOCR/VLM 冻结的前提下，进入 V3-3 详细代码与 fixture 生成（沿用 V3-3-0..-7）。
- 在 V3-3 限定 PASS 后进入 V3-4 实施（沿用 V3-4-0..-7）。
- 在 V3-4 限定 PASS 后进入 V3-5 实施，**必须先完成自动 UI 门槛 A01..A18 后才生成 H submission bundle**。
- 在 V3-5 LIMITED PASS 后由 V3-6 生成单一 sealed candidate（`auditStatus=pending_independent_audit`、`finalPassed=false`）。
- 在 V3-7 独立审计确认 Fatal=0/Major=0 后输出 `allowedClaim` 精确单句：
  > "V3 Bilibili-first media companion passed the frozen subtitle/local-ASR/keyframe/OCR/authorized-cloud-VLM acceptance matrix."

### 10.2 禁止

- 把 fixture 当作生产事实（所有 fixture SHA/cid 仅为占位）。
- 用 11 个样本替代 12 页；用 mock provider/model/usage 替代真实 provider；用 placeholder response 替代真实 VLM/ASR。
- 把 H submission 由自动化代签或补写；把 BLOCKED 静默改写为 PASS。
- 跨 run 拼接候选：V3-6 必须是全新 build/profile/runtime/db/evidence root。
- 扩大 `allowedClaim` 到 YouTube/小红书/直播/V4。
- 在 V3-2 NO-GO 状态下进入 V3-3 代码；任何"文档通过即可越过 V3-2/Provider/用户授权"的解读。
- 把 `minorCount > 0` 的 final disposition 标成 `finalPassed=true` 之前宣称"完美通过"（schema 允许 minorCount 可变，但 final 必须 0 fatal + 0 major）。
- 把本地导出声明为 V4 知识持久化（`knowledgeImportStatus` 强制 `deferred_to_v4`）。

---

## 11. 结论

1. **包完整性**：20 文件平铺、19/19 SHA-256 匹配、5/5 Schema meta、6/6 positive instances、10/10 内置负例 fail-closed，4/4 独立负例 fail-closed。
2. **B 站首版规格保留**：锚点、单 P / 792 秒、12 页 `6+3+1+1+1`、24/12/8/1280 预算、五项 scope、V4 deferred、不可扩到 YouTube/小红书/直播，全部由 schema + plan + PRD + stage gate 多层固定。
3. **前序关闭后可指导自动化**：每份 V3-N 计划前置门禁明确，实体路径、文件位置、FailureCode、固定分母、子阶段出门条件均具体；前置未关闭时文档本身阻止实施进入，无绕过路径。
4. **拒绝 5 类违规**：缩分母、跨 run/mock、代签、泄密、扩大声明均有 schema + 语义 verifier + 计划规则三重把关。
5. **V3-0 umbrella 不会覆盖新合同**：审计包内仅 stage-specific schema；stage gate 与 V3-5 plan 显式禁止。
6. **本次文档包缺陷严重度**：Fatal=0 / Major=0 / Minor=2（fixture 占位 vs 真实 cid；fixture SHA 未显式标注 `_fixtureOnly`，均为 schema-valid fixture，非语义缺陷）。
7. **真实实现前置阻塞**：9 项，均继承自 stage gate §11–§24，**不计入本包文档 Major**。
8. **当前 NO-GO 诚实**：所有 5 份 V3-N 计划与 stage gate 一致声明 `DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`，未隐瞒任何前置阻塞。
9. **建议落盘位置**：`docs/active/project/evidence/v3_media_companion/v3-3-7-independent-document-audit.md`（与 §33 中 01-audit-request.md 提议一致）。本审计为只读，未写入文件。

---

## 附录 A：所有引用文件行号索引

| 主题 | 文件:行 |
|---|---|
| 锚点 / 792 秒 / 12 页分母 | 02-prd.md:2219, 2246, 2284, 2323, 2384 / 04-stage-gate.md:42-45 |
| 24/12/8/1280 采样预算 | 05-v3-3-development-plan.md:39-46 / 07-vision-evidence.schema.json:60-68 |
| 五项 scope | 02-prd.md:2278 / 12-v3-5-development-plan.md:18 |
| CAS 单步推进 | 09-v3-4-development-plan.md:45 / 11-outline-taskstore.schema.json:198-211 |
| 三项零计数 + projection closure | 09-v3-4-development-plan.md:68 / 10-v3-4-acceptance-plan.md:43-46 / 11-outline-taskstore.schema.json:204-211 |
| 12 页 `6+3+1+1+1` 硬约束 | 17-v3-6-7-plan.md:21-23 / 18-finalization.schema.json:45-51 |
| seek delta ≤2s + mediaDuration 边界 | 12-v3-5-development-plan.md:63 / 13-v3-5-acceptance-plan.md:7 / 19-semantic-verifier.py:121-128 |
| BLOCKED 优先级 | 15-human-review.schema.json:36-39 / 19-semantic-verifier.py:134 |
| final 双阶段 + allowedClaim 固定 | 18-finalization.schema.json:65-83 / 17-v3-6-7-plan.md:80-82 |
| V3-0 umbrella 禁止覆盖 | 04-stage-gate.md:211 / 12-v3-5-development-plan.md:19 |
| 真实实现前置 | 04-stage-gate.md:104-230 |

## 附录 B：独立负例测试代码（仅作记录，未污染仓库）

```python
import sys, copy
from pathlib import Path
sys.path.insert(0, '<package>')
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('v', '<package>/19-semantic-verifier.py')
v = module_from_spec(spec); spec.loader.exec_module(v)
package = Path('<package>')
vision_outline = v.load_json(package / '08-vision-outline-positive.json')
product_final = v.load_json(package / '16-product-final-positive.json')
positives = {
    'vision': vision_outline['visionEvidence'],
    'outline': vision_outline['outlineTaskStore'],
    'product': product_final['productAcceptance'],
    'finalCandidate': product_final['finalizationCandidate'],
    'finalDisposition': product_final['finalDisposition'],
}
# 1) dispatch gap
c1 = copy.deepcopy(positives['vision']); c1['visionObservations'][0]['dispatchSequence'] = 2
# 2) CAS stale commit
c2 = copy.deepcopy(positives['outline']); c2['transactionReceipt'].update(expectedRevision=8, committedRevision=5)
# 3) seek observed overflow
c3 = copy.deepcopy(positives['product']); d=c3['taskBinding']['mediaDurationMs']
c3['seekObservations'][2].update(requestedMs=d-1000, observedMs=d+5000,
                                 deltaMs=6000, outcome='located', pageIdentityMatched=True)
# 4) canonical url reuse
c4 = copy.deepcopy(positives['finalCandidate'])
c4['samples'][7]['canonicalUrlSha256'] = c4['samples'][3]['canonicalUrlSha256']
# run
for name, fn, val in [('dispatch-gap', v.validate_vision, c1),
                      ('cas-stale', v.validate_outline, c2),
                      ('seek-overflow', v.validate_product, c3),
                      ('canonical-reuse', lambda x: v.validate_final(x, positives['finalDisposition']), c4)]:
    print(name, v.expect_rejected(name, fn, val)['rejected'])
```

实测 4/4 = True。

---

**报告结束**。本次只读审查未修改任何仓库文件，未读取包外文件或秘密，未运行产品/Chrome/Provider，所有论断可由上述命令与文件:行复现。
