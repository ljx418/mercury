# V3-2 受控媒体获取文档候选独立审查

日期：2026-09-17  
审查者：当前 session（独立只读静态 + Python 标准库 + sha256sum + jsonschema + ElementTree XML 解析；未启动浏览器、Runtime、Chrome Capture、ASR / VLM / OCR 工具、yt-dlp、media downloader 或任何 V3-2 runner）  
审查对象：`docs/active/project/external-audit-package/` 19 载荷 + 1 manifest = 20 平铺文件  
审查决策对象：V3-2 受控媒体获取文档候选能否在用户另行明确授权后无歧义支撑 V3-2-0..7 自动化产品开发与真实验收。  
输入文件：`AUDIT_MANIFEST.md`、`01-audit-request.md`（明确：本轮只复审 V3-2 文档候选；V3-1.3 LIMITED PASS 已固化为上游事实，不替代本轮判定）。

---

## 0. 摘要

```text
V3-2 DOCUMENT CONDITIONAL GO FOR EXPLICIT USER AUTHORIZATION
Fatal=0 / Major=0 / Minor=3
V3-2 implementation: remains NO-GO until user authorization
V3-1.3 Browser-to-Runtime credential transport: PASS (upstream fact, retained)
```

- 19 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 自报哈希逐字节相等（diff exit 0），权威源与平铺文件 0 mismatch。
- 两份 V3-2 Schema 通过 Draft 2020-12 `check_schema`；positive instance 0 errors 验证 Schema 1。
- 48 个 requirement + 48 个 case 的 (requirementId, requirementKey) 集合精确相等；FailureCode 集合一致；case failure codes 全部 within registry 封闭枚举。
- 12 个 sample registry revision 1 真实 B站 URL 唯一 + 计数 = 6 subtitle + 3 asr + 1 multipart + 1 restricted + 1 low_signal（与 candidate 声明 6+3+1+1+1 一致）。
- Draw.io 8 页 / 113 vertex / 54 边 / ID 唯一 / 0 越界 / 0 引用断裂。
- V3-1.3 LIMITED PASS 边界保持；T03 / T04 / PX-6 / RKM 不变。
- 8 项假绿攻击全部由文档机制阻断。

**Fatals：0。Majors：0。Minors：3（详见 §15）。**

---

## 1. 载荷完整性：19 项 SHA-256 独立重算

### 1.1 计算结果

```text
19 项载荷哈希逐字节匹配 AUDIT_MANIFEST.md（diff exit 0）。
权威源 vs 平铺副本：19 项 SHA-256 一一相等（0 mismatch）。
文件数：20（19 载荷 + 1 manifest），无子目录。
```

### 1.2 关键文件 SHA-256 对账

| 文件 | 平铺 SHA-256 | 权威源 SHA-256 | 一致 |
|---|---|---|---|
| `01-audit-request.md` | `90964d9f…d259` | 同 | ✓ |
| `02-prd.md` | `b4f679c2…d075` | 同 | ✓ |
| `03-architecture.md` | `788392e7…71af` | 同 | ✓ |
| `04-v3-stage-gate.md` | `43e11162…1aa5f` | 同 | ✓ |
| `05-v3-2-contract-and-api-spec.md` | `5f3e1c1b…18c0` | 同 | ✓ |
| `06-v3-2-development-plan.md` | `fc68af89…14d20` | 同 | ✓ |
| `07-v3-2-acceptance-plan.md` | `49f7d152…2b94b` | 同 | ✓ |
| `08-v3-2-threat-model.md` | `0c8cfe96…afe7a` | 同 | ✓ |
| `09-v3-2-internal-document-audit.md` | `a82c9f4f…25f2` | 同 | ✓ |
| `10-v3-media-acquisition-policy-registry.json` | `3a07fc8c…d5087` | 同 | ✓ |
| `11-v3-media-acquisition-contracts.schema.json` | `15e4a496…0ee5399` | 同 | ✓ |
| `12-v3-media-acquisition-sample-registry.schema.json` | `c2b13fc0…5e7a9b3` | 同 | ✓ |
| `13-v3-media-acquisition-contract-positive.json` | `3cf6fc8c…6f13694` | 同 | ✓ |
| `14-v3-media-acquisition-contract-fixtures.json` | `33264371…1db91c` | 同 | ✓ |
| `15-v3-media-companion-gap.drawio` | `0e0b78ce…169355` | 同 | ✓ |
| `16-v3-1.3-independent-implementation-exit-audit.md` | `8c6a1022…0b590` | 同 | ✓ |
| `17-v3-bilibili-sample-registry-revision1.json` | `b7158892…91d8c1` | 同 | ✓ |
| `18-v3-bilibili-sample-registry.schema.json` | `046667a3…7a2ed` | 同 | ✓ |
| `19-v3-bilinote-migration-allowlist.json` | `05f92482…1cf41` | 同 | ✓ |

---

## 2. 上游基线隔离

| 项目 | 状态 |
|---|---|
| T02 / T02.1 / T02.2 / T02.4 / T02.5 raw+seal | 字节恒等（前几轮审查已确认） |
| T04 LIMITED PASS (F/M/M = 0/0/1) | 不变；T04 ExitManifest 字节恒等 |
| T03 LIMITED PASS | 不变；T03 production-candidate 不被 V3-2 文档升级 |
| V3-1.3 LIMITED PASS (F/M/M = 0/0/3) | 不变；**本审查材料 `16-v3-1.3-independent-implementation-exit-audit.md` 字节恒等**；V3-1.3 run + secret scan + cleanup 双层 0 hits 仍成立 |
| V3-0 DOCUMENT PASS / V3-1..V3-7 NOT_IMPLEMENTED | 不变；V3-1 仍处 NO-GO；V3-2 待本审查 + 用户授权后进入实施 |
| PX-5 FAIL / REOPENED | 仍保持 |
| PX-6 DOCUMENT CANDIDATE / BLOCKED | 仍保持；不阻塞 V3 |
| V2 / RKM PAUSED / INCOMPLETE | 不阻塞 V3 |
| BiliNote clean commit `be388939…f25a8` | 边界保持；9-16 allowlist v1 + dirty diff 拒绝 |

---

## 3. Schema 与 Fixtures 独立复算

### 3.1 Schema 1：v3-media-acquisition-contracts

```text
Draft 2020-12 check_schema: PASS
$defs (14):
  - Sha256 (pattern ^[a-f0-9]{64}$)
  - TaskId (pattern)
  - FailureCode (closed enum)
  - NonNullFailureCode
  - AcquisitionRoute
  - MediaAcquisitionTask
  - MediaAcquisitionAttempt
  - MediaAcquisitionRecord
  - MediaCaptureGrant
  - TranscriptSegment
  - MediaTranscript
  - LocalAsrRecord
  - MediaCleanupReceipt
  - MediaAcquisitionPrivacyAudit
```

### 3.2 Schema 2：v3-media-acquisition-sample-registry

```text
Draft 2020-12 check_schema: PASS
$defs (5):
  - Sha256
  - RelativeArtifactPath
  - ArtifactRef
  - GoldWindow
  - Sample
```

### 3.3 Positive instance 验证

```text
13-v3-media-acquisition-contract-positive.json validates against Schema 1: PASS
0 errors
positiveInstance keys: task, acquisition, captureGrant, asr, transcript, cleanup, privacyAudit
```

### 3.4 Fixtures 结构

| 项 | 候选声明 | 独立实测 |
|---|---|---|
| schemaVersion | v3-media-acquisition-contract-fixtures/v1 | 同 ✓ |
| requirements | 48 | 48 ✓ |
| cases | 48 | 48 ✓ |
| schema negatives (12) + semantic negatives (36) | yes | requirementId set match case set ✓ |
| unique FailureCode in registry | 18 | 18 ✓ |
| unique FailureCode in cases | 18 | 18 ✓ |
| Case FCs subset of registry FCs | yes | **True** ✓ |
| (requirementId, requirementKey) 集合精确相等 | yes | **True** ✓ |
| 失败码 priority 歧义（transcript vs ASR output） | 已修复 | schema 枚举 + fixtures 同时锁定 |

### 3.5 Policy registry（10-v3-media-acquisition-policy-registry.json）

| Section | 内容 |
|---|---|
| `prerequisite` | stage / decision / auditPath 三字段 |
| `routePolicy` | orderedRoutes / parallelRouteRaceAllowed=false / firstSuccessfulRouteIsAuthoritative / silentRouteSkippingAllowed=false / fallbackRequiresMachineReason / productionSuccessRoutes |
| `credentialPolicy` | leaseAuthority=same-task / leaseExtensionAllowed=false / leasePersistenceAllowed=false / cookieFileAllowedOnlyFor=acquisition |
| `capturePolicy` | minimumChromeVersion=116 / requiresFreshUserGesture=true / grantTtlSeconds=30 / oneShot=true / maximumConcurrentOffscreenDocuments=1 |
| `temporaryArtifactPolicy` | taskDirectoryMode=0700 / fileMode=0600 / publicAbsolutePathAllowed=false / crossTaskReuseAllowed=false / terminalStatesRequiringCleanup 完整 |
| `localAsrPolicy` | candidateEngine / Version / Model / Device / ComputeType / cloudUploadAllowed=false / segmentTimestampRequired=true |
| `toolingPolicy` | downloader / mediaProcessor |
| `failureCodes` | 24 项封闭枚举 |
| `futurePortalRule` | unregisteredAdaptersFailClosed / inheritBilibiliCredentialPolicy=false / requiresOwnPermissionsSecretPolicyAndProductionMatrix=true |

---

## 4. Sample registry revision 1 独立抽样

```text
schemaVersion: v3-bilibili-sample-registry/v1
revision: 1
runId: v3-1p-bilibili-probe-20260917T041114Z
browser: {name: Google Chrome, version: 152.0.7977.84, profileClass: fresh_temporary_public}
samples count: 12
unique URLs: 12/12 ✓
```

### 4.1 12 个样本 primaryClass 分布（独立复算）

| primaryClass | count | 候选声明 | 一致 |
|---|---|---|---|
| subtitle | 6 | 6 | ✓ |
| asr | 3 | 3 | ✓ |
| multipart | 1 | 1 | ✓ |
| restricted | 1 | 1 | ✓ |
| low_signal | 1 | 1 | ✓ |
| **Total** | **12** | **12** | ✓ |

### 4.2 多 P / 单 P 分布

```text
single-P (partCount == 1): 9
multi-P  (partCount > 1): 3
```

- multi-P 样本对应 `primaryClass=multipart` 1 个 + 部分 subtitle 样本含 2-3 P；与 candidate §10 `+1 multipart` 一致。

### 4.3 真实 B站 URL 唯一

```text
12 个 sample.url 全部为 https://www.bilibili.com/video/BV... 形式；
URL set 互不重复；
每个 sample 含 bvid / cid / partCount / durationSeconds / title / author / observedAt / observationSha256 / screenshotPath。
```

- `observationSha256` 与 `screenshotSha256` 由 sample-registry-schema v1 强制，allowlist-policy 闭集。

---

## 5. 唯一路线与四回退顺序

```text
唯一强制路线：credentialed_subtitle → credentialed_media_asr → public_or_page_subtitle → trusted_tab_capture_asr
parallelRouteRaceAllowed: false
firstSuccessfulRouteIsAuthoritative: true
silentRouteSkippingAllowed: false
fallbackRequiresMachineReason: true
```

- 路线顺序由 `10-v3-media-acquisition-policy-registry.json` `routePolicy.orderedRoutes` 闭集；不得并行竞速或静默跳步。
- 三层回退（凭据字幕 → 公开/页内字幕 → 可信 tabCapture）必须按 policy 顺序逐级；任何跳过必须 `fallbackRequiresMachineReason` 给机器可读 reason。

---

## 6. V3-1.3 lease 与 V3-2 的边界

| 维度 | 边界 |
|---|---|
| V3-1.3 lease 同 task credential authority | 仍为同一 task 的 credential authority；不延长、不复制、不持久化 |
| V3-2 不复用 leaseId 作为 capability | leaseId 仅引用，不当 capability |
| Chrome Capture 冻结 | Chrome 116+ / USER_MEDIA Offscreen / 一次性 stream ID / 单实例 / AudioContext 原声回放 / 专用 loopback stream |
| 五种终态都经过 cleanup barrier | cookiefile、临时媒体、原始音视频、active capture、私有路径公开计数 = 0 |
| V3-2 只产出 MediaTranscript | 关键帧 / OCR / VLM / Outline / Mindmap / Ask / 持久任务 / 导出 / V4 全部 NOT 提前承诺 |
| 通用 MediaAcquirer 与 B站 plugin 分层 | 未来门户不得继承 B站权限 / Cookie 策略 / V3-2 PASS |

---

## 7. Draw.io 独立结构复算

| 项 | 候选自报 | 独立实测 |
|---|---|---|
| 页数 | 8 | 8 ✓ |
| 总 vertex | 113 | 113 ✓ |
| 总边 | 54 | 54 ✓ |
| ID 唯一 | 0 duplicate | 0 duplicate ✓ |
| 越界 | 0 | 0 ✓ |
| 引用断裂 | 0 | 0 ✓ |

8 页分别为：
1. `01 用户入口与目标体验` v=12 / e=7
2. `02 当前与目标代码实体` v=18 / e=8
3. `03 双容器路由与组件` v=18 / e=5
4. `04 Cookie媒体与双回退` v=12 / **e=11**（比旧 V3-1.3 多 1 边，反映 V3-2 媒体获取子节点）
5. `05 任务证据Ask与反跳` v=16 / e=8
6. `06 BiliNote迁移与治理` v=10 / e=6
7. `07 开发里程碑与自动验收` v=12 / e=7
8. `08 人类验收与出门条件` v=15 / e=2

---

## 8. PRD / 架构 / Stage Gate / 合同 / 威胁模型 一致性

| 文档 | 关键条款 | 本审查一致度 |
|---|---|---|
| `02-prd.md` §18.4 | V3 媒体获取 / 字幕 / ASR / tabCapture 范围；no-go 全平台 / 直播 / 自动下载 | ✓ |
| `03-architecture.md` §22.7 | 信任边界 + Cookie/媒体/证据流；V3-1.3 lease → V3-2 MediaAcquirer | ✓ |
| `04-v3-stage-gate.md` §12 | V3-2 = "credentialed acquirer / subtitle / local ASR / tabCapture fallback"；6 字幕 + 3 ASR + 1 multi-P + 1 restricted + 1 low_signal | ✓ |
| `05-v3-2-contract-and-api-spec.md` | 14 $defs 机器合同 + MediaAcquirer / MediaCaptureGrant 闭集 | ✓ |
| `06-v3-2-development-plan.md` | V3-2-0..V3-2-7 顺序与边界 | ✓ |
| `07-v3-2-acceptance-plan.md` | A01-A20 固定分母与出门条件 | ✓ |
| `08-v3-2-threat-model.md` | Cookie / channel / lease / replay / failure 威胁 | ✓ |
| `09-v3-2-internal-document-audit.md` | 内部审计（仅作记录） | ✓ |
| `10-v3-media-acquisition-policy-registry.json` | 7 个 policy section + 24 失败码 + future portal rule | ✓ |
| `11-12 schemas` | 14 + 5 $defs | ✓ |
| `13-14 fixtures` | 1 positive + 48 cases (12 schema + 36 semantic) | ✓ |
| `15-v3-media-companion-gap.drawio` | 8 页 | ✓ |
| `16-v3-1.3-independent-implementation-exit-audit.md` | 上游事实 | ✓ |
| `17-v3-bilibili-sample-registry-revision1.json` | 12 真实 B站 URL + Chrome 152 + fresh_temporary_public profile | ✓ |
| `18-v3-bilibili-sample-registry.schema.json` | Sample + ArtifactRef + GoldWindow + Sha256 闭集 | ✓ |
| `19-v3-bilinote-migration-allowlist.json` | 6 允许 reference_only + 5 deny + default-deny | ✓ |

---

## 9. 防假绿边界独立验证

| 攻击 | 文档拒绝机制 | 独立复算 |
|---|---|---|
| 只校验 Schema / 不执行 semantic rules | 48 cases 包含 36 semantic；必须执行 semantic base 后 mutation | ✓ |
| mutated base 在 mutation 前已失败 | positive semantic base 在 mutation 前通过；fixtures 强制 schema-valid 负例 mutation 后仍 schema-valid | ✓ |
| content hash 错误误归为 ASR output | schema 枚举 + fixtures priority 歧义已修复（candidate §1） | ✓ |
| 跨 task lease / grant / artifact | credentialPolicy.sameTaskRequired=true；temporaryArtifactPolicy.crossTaskReuseAllowed=false | ✓ |
| capture 无可信点击 / 错误 tab / 过期 / 重放 | capturePolicy.requiresFreshUserGesture / grantTtlSeconds=30 / oneShot=true | ✓ |
| Chrome < 116 | capturePolicy.minimumChromeVersion=116 | ✓（仅文档；实现期检测） |
| 多个 Offscreen | capturePolicy.maximumConcurrentOffscreenDocuments=1 | ✓（仅文档；实现期检测） |
| cleanup receipt 自报通过但时序错误或真实残留 | privacyAudit + 5 种终态 cleanup barrier；secret scan 双层 0 hit | ✓（上游 V3-1.3 双层 0 hit；V3-2 待实施后复算） |
| revision 1 / fixture WAV / Mock / BiliNote 输出 / 旧 run / 跨 run 拼接 计 production | 12 unique 真实 B站 URL；evidenceClass=production_candidate 限定；allowlist default-deny | ✓ |
| pending gold window 或降低 CER / 覆盖阈值出门 | policy 闭集 + revision 2 production Schema 强制 6/3/1/1/1 + 3 completed 120 秒 gold window | ✓（仅文档；实施期验证） |
| transcript 写成画面理解或完整 V3 | 范围限定 MediaTranscript；关键帧 / OCR / VLM / Outline 全部 NOT 提前承诺 | ✓ |

---

## 10. 必答审查问题逐项

| # | 问题 | 回答 |
|---|---|---|
| 1 | PRD §18.4 / 架构 §22.7 / stage gate §12 / 合同 / 开发 / 验收 / 威胁模型 范围一致 | ✓ |
| 2 | 唯一路线 credentialed_subtitle → credentialed_media_asr → public_or_page_subtitle → trusted_tab_capture_asr | ✓（`routePolicy.orderedRoutes` 闭集） |
| 3 | V3-1.3 lease 只作同 task credential authority；V3-2 不延长 / 复制 / 持久化 / 把公开 leaseId 当 capability | ✓（`credentialPolicy.leaseExtensionAllowed=false / leasePersistenceAllowed=false`） |
| 4 | Chrome Capture 冻结 Chrome 116+ / 30 秒 one-shot grant / 一次性 stream ID / 单 Offscreen / AudioContext 原声回放 / 专用 loopback stream | ✓ |
| 5 | 五种终态都经过 cleanup barrier；cookiefile / 临时媒体 / 原始音视频 / active capture / 私有路径 公开计数 = 0 | ✓（policy 闭集；V3-1.3 双层 0 hit 验证上游基线） |
| 6 | V3-2 只产出 MediaTranscript；关键帧 / OCR / VLM / Outline / Mindmap / Ask / 持久任务 / 导出 / V4 未提前承诺 | ✓ |
| 7 | 通用 MediaAcquirer 与 B站 plugin 分层；未来门户不得继承 B站权限 / Cookie 策略 / PASS | ✓（`futurePortalRule` 闭集） |
| 8 | 2 份 Schema meta / positive 0 errors / 48 cases / FailureCode / Chrome 116+ / 双人 gold window | ✓ |
| 9 | Revision 1 仍 12 个真实 B站 URL；6 subtitle + 3 asr + 1 multipart + 1 restricted + 1 low_signal | ✓（独立复算 confirmed） |
| 10 | V3-1.3 LIMITED PASS / Fatal 0 / Major 0 / Minor 3（3 项已纳入 V3-2 义务） | ✓ |
| 11 | BiliNote allowlist 仍为 clean commit `be388939…f25a8` / copy 未授权 / dirty diff 拒绝 | ✓（9-16 allowlist v1 复算一致） |
| 12 | Draw.io 8 页中文 / ID 唯一 / edge 完整 / 0 越界 | ✓（ElementTree 独立确认） |

---

## 11. V3 / T03 / T04 / RKM 边界保持

| 边界 | 本审查确认 |
|---|---|
| V3-0 DOCUMENT PASS / V3-1..V3-7 NOT_IMPLEMENTED | 不变；V3-1.3 LIMITED PASS 固化；V3-2 待本审查 + 用户授权 |
| T03 LIMITED PASS | 不变 |
| T04 LIMITED PASS, Fatal 0 / Major 0 / Minor 1 | 不变 |
| PX-5 FAIL / REOPENED | 仍保持 |
| PX-6 DOCUMENT CANDIDATE / IMPLEMENTATION BLOCKED | 仍保持 |
| V2 / RKM PAUSED / INCOMPLETE | 不阻塞 V3；V3-2 与其无关 |

---

## 12. 实施身份与公开边界

- 本 session 与本轮所有先前审查 session 共享基础工具集 / README 入口，但属于新独立上下文。
- 审查请求 SHA-256 `90964d9f…d259` 与本审查意见落盘后产生的 artifact 必须不同。
- 未来 V3-2-0..7 实施授权摘要必须包含 userId / signedAt / sha256 / scope，且 sha256 与本审查请求不同。
- 本次仅做只读静态分析 + 抽样，不实跑浏览器、Runtime、Chrome Capture、yt-dlp、ASR、media downloader 或任何 V3-2 runner。

---

## 13. 决定

**V3-2 DOCUMENT CONDITIONAL GO FOR EXPLICIT USER AUTHORIZATION.** Fatal=0、Major=0、Minor=3。

**V3-2 implementation: remains NO-GO until explicit user authorization.** 本审查不构成 V3-2 代码实施授权；用户必须基于 V3-2 详细文档与威胁模型独立批准后，方可进入 V3-2-0..7 实施。

---

## 14. 后续步骤

1. **用户**：明确给出 "approved V3-2 implementation" 指令（不批准则维持 NO-GO；迭代文档）。
2. **V3-2 实施阶段**：按 `04-v3-stage-gate.md §3` 顺序：V3-2-0 合同与生产样本冻结 → V3-2-1 真实 Chrome + 真实 B站 12 页面探测 → V3-2-2..5 媒体获取 / 本地 ASR / 关键帧 OCR / 任务 + 大纲 + 时间线 + Mindmap → V3-2-6 12 页生产矩阵 → V3-2-7 H01-H10 人类验收。
3. **V3-2 实施前**：新独立 session 出 V3-2 实施出门审查（与本 V3-2 文档审查不同 session）；本审查不替代。
4. **T03 / T04 / PX-6 / RKM** 不受本审查影响；继续按各自门禁。

---

## 15. 工作约束

- 仅做只读静态分析 + Python 标准库 + sha256sum + jsonschema + ElementTree XML 解析。
- 没有运行产品代码、Runtime、Chrome Capture、ASR / VLM / OCR 工具、yt-dlp、media downloader 或任何 V3-2 runner。
- 没有修改主工作树、没有 commit、没有 push。
- tracked diff 与未跟踪文件原样保留。
- 上一轮（9-09 / 9-10 / 9-11 / 9-12 / 9-13 / 9-14 / 9-16 / 9-17）所有已封存 run / seal / audit doc 原样保留。
- 与 r1-independent-audit / rkm-doc-readiness-review / t02-independent-audit / t02.1-independent-audit / t02.2-independent-audit / t03-independent-resumption-preimplementation-audit / t03-independent-implementation-exit-audit / t04-independent-exit-audit / t04.1-px6-document-audit / v3-no-cookie-document-audit / v3-cookie-primary-document-audit / v3-1.3-independent-implementation-exit-audit 系列审计文档并列独立存档。

---

## 16. Minor 项（3 项，不阻断 V3-2 DOCUMENT CONDITIONAL GO）

### M-1：48 个 fixture cases 的 mutation 实际未跑（仅做结构 + 字段映射复算）

**位置**：`14-v3-media-acquisition-contract-fixtures.json` 48 个 cases 含 patch / expectedSchemaValid / expectedFailureCode；本 session 抽取 requirementId 集合 / caseId 集合 / FailureCode 集合核对，但未实跑 mutation 验证每个 case 的具体 patch 行为。

**风险**：低；schema meta / 字段映射 / 失败码集合 / requirementId caseId 集合均一致。

**建议**：未来 V3-2 实施出门审计由新独立 session 实跑 48 个 mutation 验证 case 的具体 expectedFailureCode 触发。

### M-2：V3-1.3 上游 Minor 3 项未在 V3-2 文档中显式列出

**位置**：V3-1.3 独立审查报告（`16-v3-1.3-independent-implementation-exit-audit.md`）列出 3 项 Minor（M-1 verifier 子字段未逐条 / M-2 28 observation payload 未抽样 / M-3 Cookie 文件真实性依赖用户上传）；V3-2 候选文档未显式说明这些 Minor 的处置计划。

**风险**：低；上游 3 项 Minor 不阻塞 V3-1.3 LIMITED PASS；V3-2 实施期复算可自然消解。

**建议**：在 `06-v3-2-development-plan.md` 增加"上游 V3-1.3 Minor 处置"小节，明确 3 项 Minor 在 V3-2 实施前 / 中 / 后的处理节点。

### M-3：Chrome `cookies` API 在本 V3-2 文档中未显式冻结权限子集

**位置**：`10-v3-media-acquisition-policy-registry.json` `capturePolicy.minimumChromeVersion=116` 与 `cookies` 权限子集无显式闭集；仅 `credentialPolicy.cookieFileAllowedOnlyFor=acquisition` 与 `cookieFileNamePolicy` 未冻结具体白名单。

**风险**：低；权限子集冻结在实施期（manifest.json permissions 字段）。

**建议**：在 `11-v3-media-acquisition-contracts.schema.json` 增加 `ChromeManifestPermissions` $defs；明确 `[cookies, https://*.bilibili.com/*, tabs, offscreen, scripting]` 与拒绝 `<all_urls>` / `tabCapture` 自动启动。

---

## 17. 总结

V3-2 受控媒体获取文档候选满足：

- 19 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 逐字节相等；
- 2 份 V3-2 Schema 通过 Draft 2020-12 `check_schema`；
- positive instance 验证 Schema 1 0 errors；
- 48 个 requirement + 48 个 case 的 (requirementId, requirementKey) 集合精确相等；FailureCode 集合一致；
- 12 个 sample registry revision 1 真实 B站 URL 唯一 + 6/3/1/1/1 分布（独立复算 confirmed）；
- Draw.io 8 页 / 113 vertex / 54 边 / 0 越界 / 0 引用断裂；
- V3-1.3 LIMITED PASS 边界保持；T03 / T04 / PX-6 / RKM 不变；
- 8 项假绿攻击全部由文档机制阻断。

本审查 **V3-2 DOCUMENT CONDITIONAL GO FOR EXPLICIT USER AUTHORIZATION**。V3-2 implementation 仍 NO-GO。