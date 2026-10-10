# V3-5.1 生产机器候选独立实施审查（Round 2 / artifact-index 修正轮）

日期：2026-10-10
审计者：本轮独立只读审查
决策对象：`v3-5.1-production-candidate-20261010T210000Z`
入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md` + `01-audit-request.md`
轮次说明：round 1 报告 `independent-implementation-exit-audit-round1.md` 因 artifact-index 把
`__pycache__/*.pyc`（被 gitignore 忽略的临时编译产物）错误列入被发现。本轮已：
1. 删除临时 `__pycache__` / `.pyc`；
2. 重建 `09-artifact-index.json`（现 36 条，0 pyc）；
3. 重建 `16-secret-scan.json`（重新扫描重建后的目录）；
4. 重建 `AUDIT_MANIFEST.md`（19 载荷 SHA-256 全部重算）；
5. round 1 报告只作历史保留；本轮为权威只读审查。
本轮严格只读、不得修改产品/候选/审计包/现有证据；本文件为本轮唯一新增落盘文件。

## 1. 总判定

| 维度 | 判定 |
|---|---|
| Fatal | **0** |
| Major | **0** |
| Minor | **1**（与 round 1 一致；详见 §12） |
| 机器候选是否 PASS | **PASS**（`machinePassed=true`，三候选 schema/semantic/browser/cross-iso 全绿） |
| 人类 pending 是否 fail-closed | **是**（`humanQualityReviewPresent=false`，`passed=false`，`status=HUMAN_REVIEW_PENDING`，`exitCode=3`） |
| 是否允许进入 V3-6 | **否**（V3-5.1 LIMITED PASS 未达成，V3-6/V3-7 仍 BLOCKED；固定候选 36 问 + UX 五步 + 旧 V3-5 H01..H10 三项正式 submission 均不存在） |

本轮严格按请求复核；候选结论只允许为 `MACHINE CANDIDATE PASS / HUMAN REVIEW PENDING`，未将其扩大为 V3-5.1 LIMITED PASS、V3-6 GO 或 V3 PASS。

---

## 2. 19 载荷字节一致性与权威源（请求项 1）

执行命令（只读 hash）：

```
sha256sum docs/active/project/external-audit-package/*.md \
          docs/active/project/external-audit-package/*.json \
          docs/active/project/external-audit-package/*.py
```

复算 `AUDIT_MANIFEST.md` 全部 19 行 SHA-256：

| # | 文件 | 声称 SHA-256 | 包内实测 | 权威源实测 | 一致 |
|---|---|---|---|---|---|
| 01 | `01-audit-request.md` | `ea2e87244234181093abd13602939b0d28c3a47fe03b570726eab7fe70f8270a` | ✓ | ✓ | ✓ |
| 02 | `02-prd.md` | `9659408581ca0c6eda7b74fa552b04986b133b51aec0b2f8f3772423ef54405f` | ✓ | ✓ | ✓ |
| 03 | `03-v3-5.1-optimization-plan.md` | `744e316e7c0fe318d14906ca9f8388ff599b1b956625d930d1afc6eac76130b5` | ✓ | ✓ | ✓ |
| 04 | `04-acceptance-plan.md` | `a83df416c8a111f2e845f06c7801a9027e3e82ab3e1cec93fc7b7f6d023245c0` | ✓ | ✓ | ✓ |
| 05 | `05-stage-gate.md` | `12b42e0f3363e28f57c575161f9af1732f347dcb61b82f5596a0a422a786a9f4` | ✓ | ✓ | ✓ |
| 06 | `06-workspace.schema.json` | `7e7b91ece12c854f26408747f63f38c166073e96b351c175e860fbc7187af117` | ✓ | ✓ | ✓ |
| 07 | `07-semantic-verifier.py` | `7b7ce83656ffe3b886c0013eca786e30259a4785d71fbf6a697cf0ef57795883` | ✓ | ✓ | ✓ |
| 08 | `08-production-verifier.py` | `36d20ef02f875b991e8bdf308b148d4e0bd9cb1f9adc04d04911a925ddebce62` | ✓ | ✓ | ✓ |
| 09 | `09-artifact-index.json` | `bb6f002c8bcd1ee35ba3800fe8be9c248cf5b328a8cd3db027db71c4dbdb4f6e` | ✓ | ✓ | ✓（本轮重建） |
| 10 | `10-workspace-core-manifest.json` | `b7a08834f7ce4622786a0f3a81a1c4b83a816a65563b0dd97f33a04a8449f987` | ✓ | ✓ | ✓ |
| 11 | `11-browser-verification.json` | `42d5e06c9bab752350db762663f33c3ad80cb277d13c66c8d4dfa84de8a85590` | ✓ | ✓ | ✓ |
| 12 | `12-production-verification.json` | `e05157aac2a8f191aa413b5a250c9ff420b971cc3998b155608c14b756c87550` | ✓ | ✓ | ✓ |
| 13 | `13-negative-contract.json` | `86465f552a293916797d9edd38897b84de8df96d63414b2eb0e17e26c4160b88` | ✓ | ✓ | ✓ |
| 14 | `14-regression.json` | `78450d9ef73db755cfb65773210f29e1c9b740491ec721871bf78d94938674d3` | ✓ | ✓ | ✓ |
| 15 | `15-cleanup.json` | `94522b5b6cd773c74ddc58273d319f2a8e05cc4abc96a3c9c59553778bd9e816` | ✓ | ✓ | ✓ |
| 16 | `16-secret-scan.json` | `daa3b38de4536de171003ab6962be796b0e75a36684c77358f82fe1eb1808f21` | ✓ | ✓ | ✓（本轮重建） |
| 17 | `17-prd-review.md` | `37bcfb28b62320e4fa378993d810ae3ecfbe41797975f9a48eef6d7afb165420` | ✓ | ✓ | ✓ |
| 18 | `18-false-green-audit.md` | `393ca3ca55d947a32e7ba259926177fabdaae35a0031e5ea93e852f2c3199dae` | ✓ | ✓ | ✓ |
| 19 | `19-human-review.schema.json` | `10302410c53761874ddd6006d3260b6bfc53a274888c360c5bcac7813a31f7dd` | ✓ | ✓ | ✓ |

包结构：

```
find docs/active/project/external-audit-package -type d
  → 只返回 `.`（无子目录）
find docs/active/project/external-audit-package -type f | wc -l
  → 20（19 载荷 + 1 manifest，满足 ≤ 20）
```

注意：本轮 `09-artifact-index.json` 与 `16-secret-scan.json` 的 SHA-256 与 round 1 报告中的值不同
（round 1: 09 = `f9f3b111…`, 16 = `0e2fd5e47187…`；round 2: 09 = `bb6f002c…`, 16 = `daa3b38d…`）。
差异由临时 pyc 清理与索引/扫描重建解释，权威源实测在两个时间点都匹配其各自 manifest 声称值。

**结论：载荷 19/19 字节一致，权威源 19/19 字节一致，包内无子目录，总文件数 20 满足 ≤ 20。**

---

## 3. artifact-index 修正验证（本轮 round 2 专项）

### 3.1 临时 pyc 物理状态

```
find docs/active/project/evidence/v3_media_companion/v3-5.1-workspace-comprehension/production-candidate \
     -name __pycache__ -o -name "*.pyc"
  → 无输出
```

### 3.2 artifact-index 内容不出现 pyc

复算 `09-artifact-index.json`：

```
schemaVersion : v3-5.1-production-artifact-index/v1
runId         : v3-5.1-production-candidate-20261010T210000Z
artifactCount : 36（与 len(artifacts) 一致）
```

对 `artifacts[].path` 全部 36 项扫描：

```
[path for path in artifacts if "__pycache__" in path or path.endswith(".pyc")]
  → []（无命中）
```

### 3.3 索引每项实际存在 / 字节 / 哈希

用 `09-artifact-index.json` 实际路径为基址，对 36 条逐条 `os.path.exists` + `os.path.getsize` + `hashlib.sha256` 复算：

```
Total : 36
Missing      : 0
SizeMM       : 0
HashMM       : 0
```

每条索引项的 `bytes` / `sha256` 与磁盘实际完全一致；与 round 1 不同，**round 1 因 pyc 入索引导致"索引有 35 项对应 31 文件"的非闭合态；round 2 闭合为 36 项全存在、全哈希匹配**。

### 3.4 16-secret-scan 重建核对

```
schemaVersion                  : v3-5.1-public-secret-scan/v2
runId                          : v3-5.1-production-candidate-20261010T210000Z
fileCount                      : 35
byteCount                      : 844576
authorizedSecretValueCount     : 10
exactSecretHitCount            : 0
absolutePrivatePathHitCount    : 0
exactSecretHits                : []
absolutePrivatePathHits        : []
passed                         : true
```

`fileCount=35` 与本轮 artifact-index 中 36 项的差 = 1（即 `artifact-index.json` 自身不入扫描；这是常规排除）。重建后的扫描基于 35 个公开文件、844576 字节、0 命中。

**结论：临时 pyc 已删除；artifact-index 不含 `__pycache__` / `*.pyc`；36 项索引每条都存在且字节/哈希匹配；secret-scan 0 命中。round 1 报告的 artifact-index 不闭合问题已修复。**

---

## 4. Schema 与 semantic verifier（请求项 2）

### 4.1 Draft 2020-12 Schema meta

`06-workspace.schema.json` 顶部声明 `"$schema": "https://json-schema.org/draft/2020-12/schema"`，
`jsonschema.Draft202012Validator.check_schema(schema)` 通过。

### 4.2 通用 semantic verifier

复算 `07-semantic-verifier.py` / `v3-5.1-semantic-verifier.py`（两文件 SHA-256 一致 = `7b7ce836…`，
均指向同一权威源 `docs/active/project/evidence/v3_media_companion/v3-5.1-workspace-comprehension/v3-5.1-semantic-verifier.py`）：

- `schemaMetaPassed: true`
- `positiveSchemaPassed: true`
- `positiveSemanticErrors: []`
- `negativeTotal: 20`
- `negativePassed: 20`
- `failed: []`

### 4.3 三候选自身

用 `jsonschema.Draft202012Validator` + 同名 `semantic_errors()` 复算三候选：

| candidate | schema_errors | semantic_errors | playbackObs | origin 分布 |
|---|---|---|---|---|
| 1 | 0 | [] | 10 | chapter 2 / moment 2 / frame 2 / mindmap_node 2 / ask_citation 2 ✓ |
| 2 | 0 | [] | 10 | 同上 ✓ |
| 3 | 0 | [] | 10 | 同上 ✓ |

### 4.4 跨候选隔离（task / outline / evidence）

| 维度 | candidate-1 | candidate-2 | candidate-3 | 两两重叠 |
|---|---|---|---|---|
| taskId | `media_task_a60e14706b9464a68033a55bd240adb7` | `media_task_572068b315fe473b0a7a2f06719ad931` | `media_task_b387c85cd26fed76e494363f51463361` | 0 |
| outlineId | `outline_18cf2ed8bee3839af7450a6e544dd77b` | `outline_1aff3abb9bc432327f87935bfd6a04a2` | `outline_7a0b2fd4722ef61ee049a1a296157bb4` | 0 |
| timeline.projectionId | `timeline_660c18d57e42bb7fdfbd3d07e085dbe7` | `timeline_2a45f77ccd6d2dc2342e7252ffeed1da` | `timeline_d1403feb36b83541cbf66ed525a6a768` | 0 |
| mindmap.projectionId | `mindmap_16a330f6bf41231bbd1241cdf3b364b0` | `mindmap_09298ce71d0c29a932ff67cbd55f0469` | `mindmap_fe2662a5b1b02b08a587d2ec68970caf` | 0 |
| evidenceCatalog size | 158 | 38 | 57 | pairwise = 0 |

`12-production-verification.json` 中 `crossCandidateIsolation: true` 与代码复算一致。

**结论：Schema meta、正负 20 例、三候选 schema/semantic/隔离 全部闭合。**

---

## 5. 三条 B站视频结构与零云上传（请求项 3）

| 项 | candidate-1 | candidate-2 | candidate-3 |
|---|---|---|---|
| sourceIdentity | `portal:bilibili:BV1sMNtzJE5B:30592600559:1` | `portal:bilibili:BV1PA4m1w7ya:1491078608:1` | `portal:bilibili:BV1ZpYd66ELP:41828944992:1` |
| chapterCount | 12 ✓ | 12 ✓ | 12 ✓ |
| askBenchmark count | 12 ✓ | 12 ✓ | 12 ✓ |
| ask category 分销 | factual 6 / visual 2 / cross_chapter 2 / insufficient 2 | 6/2/2/2 | 6/2/2/2 |
| frame evidence count | 8 ✓ | 8 ✓ | 8 ✓ |
| `authorization.groundedTextCloudStatus` | `disabled` ✓ | `disabled` ✓ | `disabled` ✓ |
| `authorization.rawMediaUploadCount` | 0 ✓ | 0 ✓ | 0 ✓ |
| `authorization.selectedFrameUploadCount` | 8 ✓ | 8 ✓ | 8 ✓ |
| `authorization.providerId` / `modelId` / `outboundDerivedTextSha256` | None / None / None ✓ | None / None / None ✓ | None / None / None ✓ |
| ask executionMode 分销 | local_deterministic × 12 | local_deterministic × 12 | local_deterministic × 12 |

B站 BV ID 全部符合 `portal:bilibili:BV[0-9A-Za-z]{10}:aid:p` 正则；audio/transcript/OCR/raw media 无云上传（provider 维度 disabled、selected frame upload 数量限定 8）。

`11-browser-verification.json` 顶层汇总：

```
selectedFrameCloudUploadCount : 24（= 3 × 8）
rawMediaCloudUploadCount     : 0
groundedTextCloudUploadCount : 0
screenshotPersistedCount     : 0
passed                       : true
```

**结论：3 视频 × {12 chapters / 12 ask / 8 frames}，0 raw media/audio/transcript/OCR 云上传，固定为 selectedFrame 三批共 24 上传。**

---

## 6. 浏览器验证（请求项 4）

### 6.1 `11-browser-verification.json` 顶层：

- `candidateCount: 3`
- `selectedFrameCloudUploadCount: 24`
- `rawMediaCloudUploadCount: 0`
- `groundedTextCloudUploadCount: 0`
- `screenshotPersistedCount: 0`
- `passed: true`

### 6.2 每个候选的 playbackObservations（在 candidate 文件中复算）

| candidate | playbackObservationCount | 5 origin 各 2 | deltaMs 范围 | `pageIdentityMatched` | delta==\|obs-req\| |
|---|---|---|---|---|---|
| 1 | 10 | chapter 2 / moment 2 / frame 2 / mindmap_node 2 / ask_citation 2 ✓ | min=0, max=0 ≤ 2000 ✓ | all true ✓ | all true ✓ |
| 2 | 10 | 同上 ✓ | min=0, max=0 ✓ | all true ✓ | all true ✓ |
| 3 | 10 | 同上 ✓ | min=0, max=0 ✓ | all true ✓ | all true ✓ |

共 30 次真实 B站 player seek，全部 `deltaMs <= 2000`（实为 0），无仅点击不回读。

### 6.3 UI verification / 视口 / Axe / 性能

| candidate | UI 9 项 | viewportWidths | axeSerious/Critical | interactiveMs | maxMainThreadBlockMs | remoteScript/eval |
|---|---|---|---|---|---|---|
| 1 | 全 true ✓ | [360, 420, 768, 1280] ✓ overflowFree=true × 4 | 0 / 0 ✓ | 171 | 176 (<200) ✓ | 0 / 0 ✓ |
| 2 | 全 true ✓ | 同上 ✓ | 0 / 0 ✓ | 90 | 151 ✓ | 0 / 0 ✓ |
| 3 | 全 true ✓ | 同上 ✓ | 0 / 0 ✓ | 85 | 181 ✓ | 0 / 0 ✓ |

CSP 通过（`remoteScriptCount: 0`、`evalCount: 0`、`gpuRequired: false`、`baselineRamGiB: 8`）。

### 6.4 候选文件 hash 与 browser-recorded hash 一致（c7f1fdb9… / bdc09e1c… / 0bfe92ad…）。

**结论：5 origin × 2、real readback deltaMs=0、4 视口/Axe 0/0/键盘/性能/CSP 全部闭合。**

---

## 7. 测试与运维记录（请求项 5）

`14-regression.json`：

| 项 | 期望 | 实际 | 备注 |
|---|---|---|---|
| Runtime | 679 passed / 0 failed / exit 0 | 679 / 0 / 0 ✓ | `services/local-runtime/.venv/bin/pytest -q` |
| Extension | 52 files / 351 tests / 0 failed / exit 0 | 52 / 351 / 0 / 0 ✓ | `npm test -- --run` |
| targetedWorkspace | 1 file / 6 tests / 0 failed / exit 0 | 1 / 6 / 0 / 0 ✓ | |
| targetedRuntime | 19 passed / 0 failed / exit 0 | 19 / 0 / 0 ✓ | PYTHONPATH 已设置 |
| invalidRuntimeCommandAttempts | 2 次（ModuleNotFoundError） | count=2, productResult=not_applicable ✓ | 已被发现并修正 |
| typecheck | exit 0 | 0 ✓ | |
| productionBuild | exit 0 | 0 ✓ | warning only（chunk size） |
| humanReviewPage | 36 questionJudgment / 5 experienceJudgment / 0 pageError / rootOverflow=false | 全闭合 ✓ | desktop 1440, mobile 390 |
| fixedCandidateRuntimeLauncher | 200 / bootstrap=true / 401 / cleanly / exit 0 | 全闭合 ✓ | |

`15-cleanup.json`：

- `runtimeListenerCount: 0`
- `chromeProfileProcessCount: 0`
- `temporaryMediaFileCount: 0`
- `persistedAutomationScreenshotCount: 0`
- `privateReviewArtifact`: 280 files / 10955416 bytes / selectedFrameCount=24 / purpose="fixed-candidate human review only" / public=false
- `passed: true`

`16-secret-scan.json`（本轮重建）：

- 35 files / 844576 bytes
- `exactSecretHitCount: 0`
- `absolutePrivatePathHitCount: 0`
- `passed: true`
- `authorizedSecretValueCount: 10`（schema 测试 fixture 中的明示 token，未命中 secret pattern）

**结论：679/351/19/6 测试计数与 typecheck/build 自洽；cleanup 与 secret scan 均 passed。**

---

## 8. Ask 假绿与篡改 fail-closed（请求项 6）

### 8.1 三候选 `criticalMeaningError=false` / `citationSupported=true` 来自 build_ask_benchmark

| candidate | criticalMeaningError | citationSupported |
|---|---|---|
| 1 | 全部 12 false | 全部 12 true |
| 2 | 全部 12 false | 全部 12 true |
| 3 | 全部 12 false | 全部 12 true |

（这是 producer 写入字段，仅证明引用存在 / 类型闭合，无法证明语义正确——与 `18-false-green-audit.md` 描述一致。）

### 8.2 production verifier 强制 fail-closed

读 `08-production-verifier.py`：

- `human_review_present = args.human_review is not None and args.human_review.is_file()`
- 未传 `--human-review` 或文件不存在 → `human_review_present=False`、`human_review_valid=False`
- `passed = machine_passed and human_review_valid` → 必须 `human_review_valid=True`
- `status = "PASS" if passed else "HUMAN_REVIEW_PENDING" if machine_passed and not human_review_present else "FAIL"`
- 退出码：`return 0 if passed else 3 if machine_passed and not human_review_present else 2`

实测在审计读 `12-production-verification.json` 中（同时用原 production-verifier 模块复算）：

```
machinePassed             : True
humanQualityReviewPresent : False
humanQualityReviewValid   : False
status                    : HUMAN_REVIEW_PENDING
passed                    : False
exit_code                 : 3
```

即便 semanticErrors=[]、schema_errors=0、browser passed=true，缺独立 human submission 时仍固定 `passed=false`、`status=HUMAN_REVIEW_PENDING`、`exitCode=3`——**Ask 假绿不会自动 PASS。**

### 8.3 篡改候选 hash 闭合

`08-production-verifier.py` line 90：

```python
hash_matches = browser_row is not None and browser_row["candidateSha256"] == sha256(target)
```

任意候选文件被改动 → `hash_matches=False` → 该候选 `passed=False` → `machine_passed=False` → `status=FAIL`、`exit=2`。`18-false-green-audit.md` 第 19 行亦声明「篡改任一候选 hash 实测 exit 2」——与代码一致。

补充测试（在本审计内只读调用 verifier 的 `human_review_errors()`）：

| 篡改形态 | 触发错误码 | 判定 |
|---|---|---|
| 候选 SHA-256 与文件不一致 | `V351_HUMAN_CANDIDATE_BINDING_INVALID` | fail-closed |
| `askJudgments` 不足 36 | `V351_HUMAN_ASK_DENOMINATOR_INVALID` | fail-closed |
| `experienceJudgments` 缺失 | `V351_HUMAN_EXPERIENCE_DENOMINATOR_INVALID` | fail-closed |
| `askJudgments` 中 questionId 与候选不符 | `V351_HUMAN_ASK_DENOMINATOR_INVALID` | fail-closed |

`overallDecision` 还由 verifier 推导：`FAIL`（任一 ask 失败或任一体验 FAIL）/ `BLOCKED`（任一体验 BLOCKED）/ `PASS`（否则）。任何不一致 → `V351_HUMAN_OVERALL_DECISION_INVALID`。

**结论：Ask 假绿已闭环；缺 submission → exit 3 / status HUMAN_REVIEW_PENDING / passed=false；篡改候选 hash → exit 2；不一致 submission → exit 2。**

---

## 9. 人类审查合同（请求项 7）

`19-human-review.schema.json` 关键锁定：

| 项 | 强制值 | 实测 |
|---|---|---|
| `$schema` | `https://json-schema.org/draft/2020-12/schema` | ✓ |
| `schemaVersion` | `const: "v3-5.1-human-quality-review/v1"` | ✓ |
| `runId` | `const: "v3-5.1-production-candidate-20261010T210000Z"` | ✓ |
| `candidateSha256` | `prefixItems` 中 3 个 const = 实际文件 hash（c7f1fdb9… / bdc09e1c… / 0bfe92ad…） | 锁死 ✓ |
| `reviewerRole` | `const: "independent_human_reviewer"` | ✓ |
| `askJudgments` | minItems=36, maxItems=36，pattern `^question_[a-f0-9]{8}$`，candidateIndex∈[1,3] | 锁死 36 个 ✓ |
| `experienceJudgments` | minItems=5, maxItems=5，requirementId∈{UX01..UX05} | 锁死 ✓ |
| `overallDecision` | enum: [PASS / FAIL / BLOCKED] | ✓ |
| `additionalProperties: false` | 全字段 | ✓ |
| meta-schema 自检 | `Draft202012Validator.check_schema` 通过 | ✓ |

约束的强度：

1. 候选 SHA-256 在 schema 内 `const` 化，任何替换会被 schema 直接拒绝。
2. questionId 由 `human_review_errors()` 反向比对三候选 `askBenchmark`，每个 questionId 必须属于 `expected_questions` 集合。
3. `overallDecision` 由 verifier 推导，错填即 fail。
4. `human-review/README.md` 第 3、4 行明确「自动化不得填写或提交判断」「如实填写审查者 ID，下载 JSON，不要手工改 JSON」；第 20 行明确「AUTOMATED_SCHEMA_TEST_ONLY 只存 `/tmp`，不得作为人类结论」。

唯一限制：schema 未引入密码学签名；reviewerRole 仅是声明串。原则上的保护是结构性的（36+5 锁定、hash const、overallDecision 推导、临时自动提交不入仓），生产 verifier 不接受 schema 测试 submission 作为人类证据。

**结论：人类合同 3×12 问 + UX01..UX05 + 3 hash const + overallDecision 派生 + 无签名机制，与 `01-audit-request.md` 第 6 项要求一致；自动化代签需伪造 36+5 判断并绕过 `/tmp` 不入仓约束，结构上闭合。**

---

## 10. Stage Gate 与 PRD review 边界（请求项 8）

`05-stage-gate.md` 关键行：

- 第 5 行：`V3-5.1 MACHINE CANDIDATE PASS + HUMAN QUALITY REVIEW PENDING / V3-6..V3-7 BLOCKED`
- 第 86 行：`禁止扩大为全平台、直播、无限期/跨任务下载、绕过平台限制、跨视频 RAG、V4 或完整 BiliNote/Monica parity`
- 第 94 行：`B站只是策略 plugin；未来 YouTube/小红书需独立权限、secret policy 和真实矩阵`
- 第 150 行：`未来 YouTube/小红书不得控制 provider，也不能继承 B站权限或 PASS`
- 第 244 行：V3-6/7 当前 `DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`
- 第 279 行：`因此 V3-5.1 未 LIMITED PASS，V3-6/V3-7 不得启动`

`17-prd-review.md`：

- 第 7 行：`当前只允许声明 MACHINE CANDIDATE PASS / HUMAN REVIEW PENDING，不得声明 V3-5.1、V3-6 或 V3 完成`
- 第 22 行：`YouTube、小红书、直播、V4 Query/Graph/Memory/Durable Forget、完整 BiliNote parity 均不在本候选声明内`
- 第 26 行：`V3-6 输入门禁未满足`

`18-false-green-audit.md` 第 19 行：`临时自动生成的 Schema 测试 submission 不入仓、不作为人类证据`。

**结论：V3-6/V3-7 明确 BLOCKED；本候选未越界承诺 YouTube/小红书/V4/BiliNote parity；唯一允许结论为 MACHINE CANDIDATE PASS / HUMAN REVIEW PENDING。**

---

## 11. 实际执行的只读命令与限制

### 11.1 实际执行的只读命令

```
ls docs/active/project/external-audit-package/                                  # 列举 19 载荷 + manifest
find docs/active/project/external-audit-package -type d                         # 验证无子目录
find docs/active/project/external-audit-package -type f | wc -l                 # 20 文件
find docs/active/project/.../production-candidate -name __pycache__ -o -name "*.pyc"   # 0 命中
sha256sum docs/active/project/external-audit-package/*.{md,json,py}              # 19 载荷
sha256sum <19 个权威源相对路径>                                                    # 19 权威源
python3 -c "<载入 artifact-index.json，扫描 36 路径无 pyc、复算每项 size/sha256>"
python3 -c "<载入 schema、jsonschema.Draft202012Validator.check_schema + 三候选复算>"
python3 -c "<载入 semantic_errors()，对三候选复算>"
python3 -c "<载入 production-verifier 模块，复算 machine_passed / human_review_valid / exit_code>"
python3 -c "<读取 candidates / browser-verification / production-verification / artifact-index / workspace-core-manifest 复算隔离、计数、hash 一致性>"
grep -n "V3-5.1|V3-6|V3-7|BLOCKED|fixed-candidate" docs/active/project/external-audit-package/05-stage-gate.md
cat docs/active/project/.../production-candidate/human-review/README.md
```

### 11.2 限制（未执行）

- 未运行 Chrome / 真实浏览器回放 / 截图脚本 / Selenium 驱动
- 未运行 Runtime（uvicorn server）、ASR、Provider
- 未运行旧 `v3-5.1-*-generator` / fixture 生成器
- 未调用 cloud Provider / Network egress
- 未对 `production-verification-result.json` 进行二次重写（仅读）
- 未修改产品代码、候选、manifest、审计包、`09-artifact-index.json`、`16-secret-scan.json`、`AUDIT_MANIFEST.md` 或任何现有证据
- round 1 报告 `independent-implementation-exit-audit-round1.md` 不动，仅作历史

唯一新增落盘文件：本审计 `independent-implementation-exit-audit.md`。

---

## 12. Round 1 → Round 2 变化摘要与最终结论

### 12.1 变化摘要

| 项 | round 1 状态 | round 2 状态 | 备注 |
|---|---|---|---|
| 临时 `__pycache__/*.pyc` | 存在并被列入 artifact-index | 已删除 | `find` 0 命中 |
| `09-artifact-index.json` 长度 | 35 项（含 pyc），但磁盘只有 31 文件能匹配 | 36 项全部存在，0 pyc，全部 size/hash 匹配 | 闭合 |
| `16-secret-scan.json` | 35 文件 / 836801 字节（与索引不一致） | 35 文件 / 844576 字节（重建后） | 重建 |
| `AUDIT_MANIFEST.md` 09 / 16 行 | 旧 hash | 新 hash（已对齐当前文件） | 重建 |
| 其它 17 个载荷 | 19/19 一致 | 19/19 一致 | 无变化 |
| 候选 / browser / production / negative / regression / cleanup / prd-review / false-green / human-review schema / stage-gate / acceptance | 不动 | 不动 | 仍闭合 |

### 12.2 最终判定

| 项 | 结论 |
|---|---|
| 19 载荷 + 权威源字节一致 | PASS |
| artifact-index 不含 pyc、36 项全部存在并 size/hash 匹配（本轮 round 2 修正） | PASS |
| Draft 2020-12 schema + 三候选 schema/semantic/隔离 | PASS |
| 三 B站视频 × {12 chapters / 12 ask / 8 frames} / 0 raw media 云上传 | PASS |
| browser verification（5 origin × 2, delta=0, 视口/Axe/键盘/性能/CSP） | PASS |
| Runtime 679 / Extension 351 / targeted 19/6 / typecheck/build | PASS |
| cleanup / secret-scan（本轮重建后 0 命中） | PASS |
| Ask 假绿闭环（缺 submission → exit 3 / status HUMAN_REVIEW_PENDING） | PASS |
| 候选 hash 篡改 → exit 2 | PASS |
| Human review schema（3×12 + UX01..UX05 + 3 hash const + overallDecision 派生） | PASS（无密码学签名，已在结构层闭合；README 声明自动化代签不入仓） |
| Stage gate / PRD review（V3-6/V3-7 BLOCKED，无 YouTube/小红书/V4/BiliNote parity 越界） | PASS |

**最终判定：**
- Fatal = 0
- Major = 0
- Minor = 1（producer-shape semantic 与通用 verifier 仍可被脱离 production verifier 误读——与
  `v3-5.1-production-internal-exit-audit.md`、`17-prd-review.md`、`18-false-green-audit.md`、
  `human-review/README.md` 一致声明；本轮未新增、亦未消除该 Minor）
- **机器候选：PASS**
- **人类 pending：fail-closed**（已实测：`passed=false`、`status=HUMAN_REVIEW_PENDING`、`exitCode=3`）
- **是否允许进入 V3-6：否**（V3-6/V3-7 仍 BLOCKED；V3-5.1 LIMITED PASS 未达成；旧 V3-5 H01..H10
  与固定候选 36 问 / UX 五步正式 submission 均不存在）

本审计不构成 V3-5.1 LIMITED PASS、V3-6 GO 或 V3 PASS。Round 1 artifact-index 错把 ignored pyc 列入的
问题在本轮通过删除 pyc、重建 09 / 16 / manifest 并重算所有 19 载荷与权威源 SHA-256 闭合。
