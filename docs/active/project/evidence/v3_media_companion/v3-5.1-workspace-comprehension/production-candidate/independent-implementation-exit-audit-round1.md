# V3-5.1 生产机器候选独立实施审查（Independent Implementation Exit Audit）

日期：2026-10-10
审计者：本轮独立只读审查
决策对象：`v3-5.1-production-candidate-20261010T210000Z`
入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md` + `01-audit-request.md`

## 1. 总判定

| 维度 | 判定 |
|---|---|
| Fatal | **0** |
| Major | **0** |
| Minor | **1**（与内部 exit audit 一致；详见 §7） |
| 机器候选是否 PASS | **PASS**（`machinePassed=true`，三候选 schema/semantic/browser/cross-iso 全绿） |
| 人类 pending 是否 fail-closed | **是**（`humanQualityReviewPresent=false`，`passed=false`，`status=HUMAN_REVIEW_PENDING`，`exitCode=3`） |
| 是否允许进入 V3-6 | **否**（V3-5.1 LIMITED PASS 未达成，V3-6/V3-7 仍 BLOCKED；human 36 问 + UX 五步 + 旧 V3-5 H01..H10 三项正式 submission 均不存在） |

本轮严格按请求复核；候选结论只允许为 `MACHINE CANDIDATE PASS / HUMAN REVIEW PENDING`，未将其扩大为 V3-5.1 LIMITED PASS、V3-6 GO 或 V3 PASS。

---

## 2. 19 载荷字节一致性与权威源（请求项 1）

执行命令（只读 hash）：

```
sha256sum docs/active/project/external-audit-package/*.md \
          docs/active/project/external-audit-package/*.json \
          docs/active/project/external-audit-package/*.py
```

并对 19 条权威源路径分别 `sha256sum` 复算：

| # | 文件 | 声称 SHA-256（前 12 位） | 实际包内 | 实际权威源 | 一致 |
|---|---|---|---|---|---|
| 01 | `01-audit-request.md` | `ea2e87244234` | ✓ | ✓ | ✓ |
| 02 | `02-prd.md` | `9659408581ca` | ✓ | ✓ | ✓ |
| 03 | `03-v3-5.1-optimization-plan.md` | `744e316e7c0f` | ✓ | ✓ | ✓ |
| 04 | `04-acceptance-plan.md` | `a83df416c8a1` | ✓ | ✓ | ✓ |
| 05 | `05-stage-gate.md` | `12b42e0f3363` | ✓ | ✓ | ✓ |
| 06 | `06-workspace.schema.json` | `7e7b91ece12c` | ✓ | ✓ | ✓ |
| 07 | `07-semantic-verifier.py` | `7b7ce83656ff` | ✓ | ✓ | ✓ |
| 08 | `08-production-verifier.py` | `36d20ef02f87` | ✓ | ✓ | ✓ |
| 09 | `09-artifact-index.json` | `f9f3b11142c0` | ✓ | ✓ | ✓ |
| 10 | `10-workspace-core-manifest.json` | `b7a08834f7ce` | ✓ | ✓ | ✓ |
| 11 | `11-browser-verification.json` | `42d5e06c9bab` | ✓ | ✓ | ✓ |
| 12 | `12-production-verification.json` | `e05157aac2a8` | ✓ | ✓ | ✓ |
| 13 | `13-negative-contract.json` | `86465f552a29` | ✓ | ✓ | ✓ |
| 14 | `14-regression.json` | `78450d9ef73d` | ✓ | ✓ | ✓ |
| 15 | `15-cleanup.json` | `94522b5b6cd7` | ✓ | ✓ | ✓ |
| 16 | `16-secret-scan.json` | `0e2fd5e47187` | ✓ | ✓ | ✓ |
| 17 | `17-prd-review.md` | `37bcfb28b623` | ✓ | ✓ | ✓ |
| 18 | `18-false-green-audit.md` | `393ca3ca55d9` | ✓ | ✓ | ✓ |
| 19 | `19-human-review.schema.json` | `10302410c537` | ✓ | ✓ | ✓ |

包结构：`find . -type d` 只返回 `.`（无子目录）；`find . -type f | wc -l` = 20 = 19 载荷 + 本 manifest，满足 ≤ 20。

**结论：载荷 19/19 字节一致，权威源 19/19 字节一致，包内无子目录。**

---

## 3. Schema 与 semantic verifier（请求项 2）

### 3.1 Draft 2020-12 Schema meta

`06-workspace.schema.json` 顶部：

```
"$schema": "https://json-schema.org/draft/2020-12/schema"
```

`jsonschema.Draft202012Validator.check_schema(schema)` 通过。

### 3.2 通用 semantic verifier

```
python3 docs/active/project/evidence/v3_media_companion/v3-5.1-workspace-comprehension/v3-5.1-semantic-verifier.py
```

结果（从原始输出复算）：

- `schemaMetaPassed: true`
- `positiveSchemaPassed: true`
- `positiveSemanticErrors: []`
- `negativeTotal: 20`
- `negativePassed: 20`
- `failed: []`

> 备注：审计包内 `07-semantic-verifier.py` 在 `docs/active/project/external-audit-package/` 平铺位置执行时，`parents[3]` 解析到 `docs/contracts/...`（不存在）；其回退路径只在原 `v3-5.1-workspace-comprehension/` 深度生效。因此从原始 evidence 路径运行；两端 SHA-256 一致（`7b7ce836…`），无篡改风险。审计包文档未声明提前 schema 版本。

### 3.3 三候选自身

用 `jsonschema.Draft202012Validator` + 同名 `semantic_errors()` 复算三候选：

| candidate | schema_errors | semantic_errors |
|---|---|---|
| 1 | 0 | [] |
| 2 | 0 | [] |
| 3 | 0 | [] |

### 3.4 跨候选隔离（task / outline / evidence）

| 维度 | candidate-1 | candidate-2 | candidate-3 | 两两重叠 |
|---|---|---|---|---|
| taskId | `media_task_a60e14706b9464a68033a55bd240adb7` | `media_task_572068b315fe473b0a7a2f06719ad931` | `media_task_b387c85cd26fed76e494363f51463361` | 0 |
| outlineId | `outline_18cf2ed8bee3839af7450a6e544dd77b` | `outline_1aff3abb9bc432327f87935bfd6a04a2` | `outline_7a0b2fd4722ef61ee049a1a296157bb4` | 0 |
| timeline.projectionId | `timeline_660c18d57e42bb7fdfbd3d07e085dbe7` | `timeline_2a45f77ccd6d2dc2342e7252ffeed1da` | `timeline_d1403feb36b83541cbf66ed525a6a768` | 0 |
| mindmap.projectionId | `mindmap_16a330f6bf41231bbd1241cdf3b364b0` | `mindmap_09298ce71d0c29a932ff67cbd55f0469` | `mindmap_fe2662a5b1b02b08a587d2ec68970caf` | 0 |
| evidenceCatalog size | 158 | 38 | 57 | pairwise = 0 |

**结论：Schema meta、正负 20 例、三候选 schema/semantic/隔离 全部闭合。**

---

## 4. 三条 B站视频结构与零云上传（请求项 3）

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

**结论：3 视频 × {12 chapters / 12 ask / 8 frames}，0 raw media/audio/transcript/OCR 云上传，固定为 selectedFrame 三批共 24 上传。**

---

## 5. 浏览器验证（请求项 4）

### 5.1 `11-browser-verification.json` 顶层：

- `candidateCount: 3`
- `selectedFrameCloudUploadCount: 24`
- `rawMediaCloudUploadCount: 0`
- `groundedTextCloudUploadCount: 0`
- `screenshotPersistedCount: 0`
- `passed: true`

### 5.2 每个候选的 playbackObservations（在 candidate 文件中复算）

| candidate | playbackObservationCount | 5 origin 各 2 | deltaMs 范围 | `pageIdentityMatched` | delta==\|obs-req\| |
|---|---|---|---|---|---|
| 1 | 10 | chapter 2 / moment 2 / frame 2 / mindmap_node 2 / ask_citation 2 ✓ | min=0, max=0 ≤ 2000 ✓ | all true ✓ | all true ✓ |
| 2 | 10 | 同上 ✓ | min=0, max=0 ✓ | all true ✓ | all true ✓ |
| 3 | 10 | 同上 ✓ | min=0, max=0 ✓ | all true ✓ | all true ✓ |

共 30 次真实 B站 player seek，全部 `deltaMs <= 2000`（实为 0），无仅点击不回读。

### 5.3 UI verification / 视口 / Axe / 性能

| candidate | UI 9 项 | viewportWidths | axeSerious/Critical | interactiveMs | maxMainThreadBlockMs | remoteScript/eval |
|---|---|---|---|---|---|---|
| 1 | 全 true ✓ | [360, 420, 768, 1280] ✓ overflowFree=true × 4 | 0 / 0 ✓ | 171 | 176 (<200) ✓ | 0 / 0 ✓ |
| 2 | 全 true ✓ | 同上 ✓ | 0 / 0 ✓ | 90 | 151 ✓ | 0 / 0 ✓ |
| 3 | 全 true ✓ | 同上 ✓ | 0 / 0 ✓ | 85 | 181 ✓ | 0 / 0 ✓ |

CSP 通过（`remoteScriptCount: 0`、`evalCount: 0`、`gpuRequired: false`、`baselineRamGiB: 8`）。

### 5.4 候选文件 hash 与 browser-recorded hash 一致（c7f1fdb9… / bdc09e1c… / 0bfe92ad…）。

**结论：5 origin × 2、real readback deltaMs=0、4 视口/Axe 0/0/键盘/性能/CSP 全部闭合。**

---

## 6. 测试与运维记录（请求项 5）

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

`16-secret-scan.json`：

- 35 files / 836801 bytes
- `exactSecretHitCount: 0`
- `absolutePrivatePathHitCount: 0`
- `passed: true`
- `authorizedSecretValueCount: 10`（schema 测试 fixture 中的明示 token，未命中 secret pattern）

**结论：679/351/19/6 测试计数与 typecheck/build 自洽；cleanup 与 secret scan 均 passed。**

---

## 7. Ask 假绿与篡改 fail-closed（请求项 6）

### 7.1 三候选 `criticalMeaningError=false` / `citationSupported=true` 来自 build_ask_benchmark

| candidate | criticalMeaningError | citationSupported |
|---|---|---|
| 1 | 全部 12 false | 全部 12 true |
| 2 | 全部 12 false | 全部 12 true |
| 3 | 全部 12 false | 全部 12 true |

（这是 producer 写入字段，仅证明引用存在 / 类型闭合，无法证明语义正确——与 `18-false-green-audit.md` 描述一致。）

### 7.2 production verifier 强制 fail-closed

读 `08-production-verifier.py`：

- `human_review_present = args.human_review is not None and args.human_review.is_file()`
- 未传 `--human-review` 或文件不存在 → `human_review_present=False`、`human_review_valid=False`
- `passed = machine_passed and human_review_valid` → 必须 `human_review_valid=True`
- `status = "PASS" if passed else "HUMAN_REVIEW_PENDING" if machine_passed and not human_review_present else "FAIL"`
- 退出码：`return 0 if passed else 3 if machine_passed and not human_review_present else 2`

实测在审计读 `12-production-verification.json` 中（同时用原 production-verifier 模块复算）：

```
machinePassed: True
humanQualityReviewPresent: False
humanQualityReviewValid: False
status: HUMAN_REVIEW_PENDING
passed: False
exit_code: 3
```

即便 semanticErrors=[]、schema_errors=0、browser passed=true，缺独立 human submission 时仍固定 `passed=false`、`status=HUMAN_REVIEW_PENDING`、`exitCode=3`——**Ask 假绿不会自动 PASS。**

### 7.3 篡改候选 hash 闭合

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

## 8. 人类审查合同（请求项 7）

`19-human-review.schema.json` 关键锁定：

| 项 | 强制值 | 实测 |
|---|---|---|
| `$schema` | `https://json-schema.org/draft/2020-12/schema` | ✓ |
| `schemaVersion` | `const: "v3-5.1-human-quality-review/v1"` | ✓ |
| `runId` | `const: "v3-5.1-production-candidate-20261010T210000Z"` | ✓ |
| `candidateSha256` | `prefixItems` 中 3 个 const = 实际文件 hash（c7f1fdb9… / bdc09e1c… / 0bfe92ad…） | 锁死 ✓ |
| `reviewerRole` | `const: "independent_human_reviewer"` | ✓ |
| `askJudgments` | minItems=3×6, maxItems=36，pattern `^question_[a-f0-9]{8}$`，candidateIndex∈[1,3] | 锁死 36 个 ✓ |
| `experienceJudgments` | minItems=5, maxItems=5，requirementId∈{UX01..UX05} | 锁死 ✓ |
| `overallDecision` | enum: [PASS / FAIL / BLOCKED] | ✓ |
| `additionalProperties: false` | 全字段 | ✓ |
| meta-schema 自检 | `Draft202012Validator.check_schema` 通过 | ✓ |

约束的强度：

1. 候选 SHA-256 在 schema 内 `const` 化，任何替换会被 schema 直接拒绝。
2. questionId 由 `human_review_errors()` 反向比对三候选 `askBenchmark`，每个 questionId 必须属于 `expected_questions` 集合。
4. `overallDecision` 由 verifier 推导，错填即 fail。
5. `human-review/README.md` 第 3、4 行明确「自动化不得填写或提交判断」「如实填写审查者 ID，下载 JSON，不要手工改 JSON」；第 20 行明确「AUTOMATED_SCHEMA_TEST_ONLY 只存 `/tmp`，不得作为人类结论」。

唯一限制：schema 未引入密码学签名；reviewerRole 仅是声明串。原则上的保护是结构性的（36+5 锁定、hash const、overallDecision 推导、临时自动提交不入仓），生产 verifier 不接受 schema 测试 submission 作为人类证据。

**结论：人类合同 3×12 问 + UX01..UX05 + 3 hash const + overallDecision 派生 + 无签名机制，与 `01-audit-request.md` 第 6 项要求一致；自动化代签需伪造 36+5 判断并绕过 `/tmp` 不入仓约束，结构上闭合。**

---

## 9. Stage Gate 与 PRD review 边界（请求项 8）

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

## 10. 重新执行 production verifier 关键路径（独立复算）

把 production verifier 模块载入并对当前 run 重放（不修改任何文件），输出：

```
machine_passed: True
human_review_present: False
human_review_valid: False
overall passed: False
status: HUMAN_REVIEW_PENDING
exit_code: 3
Per-candidate:
  candidate-1: passed=True (schema_errors=0, semantic_errors=0, browserHashMatches=True,
             playbackObs=10, origins={'ask_citation': 2, 'chapter': 2, 'frame': 2,
             'mindmap_node': 2, 'moment': 2})
  candidate-2: passed=True (同上)
  candidate-3: passed=True (同上)
Cross-candidate isolation: True
```

与 `12-production-verification.json` 字段一致。

---

## 11. 实际执行的只读命令与限制

### 11.1 实际执行的只读命令

```
ls docs/active/project/external-audit-package/      # 列举 19 载荷 + manifest
find docs/active/project/external-audit-package -type f | wc -l
find docs/active/project/external-audit-package -type d
sha256sum docs/active/project/external-audit-package/*.{md,json,py}        # 19 载荷
sha256sum <19 个权威源相对路径>                                              # 19 权威源
python3 -c "import jsonschema, json; jsonschema.Draft202012Validator.check_schema(json.load(open('06-workspace.schema.json')))"
python3 docs/active/project/evidence/v3_media_companion/v3-5.1-workspace-comprehension/v3-5.1-semantic-verifier.py   # 复算正负例
python3 -c "<载入 production verifier 模块，对三候选 + browser + 篡改场景 + dry-queried human review 错误码复算>"
python3 -c "<读取 candidates / browser-verification / production-verification / artifact-index / workspace-core-manifest 复算隔离、计数、hash 一致性>"
grep -n "V3-6|V3-7|BLOCKED|YouTube|小红书|BiliNote|V4|parity" 05-stage-gate.md 17-prd-review.md 02-prd.md
cat human-review/README.md
ls -la production-candidate/__pycache__/       # 复核 artifact-index
```

### 11.2 限制（未执行）

- 未运行 Chrome / 真实浏览器回放 / 截图脚本 / Selenium 驱动
- 未运行 Runtime（uvicorn server）、ASR、Provider
- 未运行旧 `v3-5.1-*-generator` / fixture 生成器
- 未修改产品代码、候选、manifest、审计包或其他现有文件
- 未在仓库内落任何文件（除本审计外）
- 未调用 cloud Provider / Network egress
- 未对 `production-verification-result.json` 进行二次重写（仅读）

唯一新增落盘文件：本审计 `independent-implementation-exit-audit.md`。

---

## 12. 结论

| 项 | 结论 |
|---|---|
| 19 载荷 + 权威源字节一致 | PASS |
| Draft 2020-12 schema + 三候选 schema/semantic/隔离 | PASS |
| 三 B站视频 × {12 chapters / 12 ask / 8 frames} / 0 raw media 云上传 | PASS |
| browser verification（5 origin × 2, delta=0, 视口/Axe/键盘/性能/CSP） | PASS |
| Runtime 679 / Extension 351 / targeted 19/6 / typecheck/build | PASS |
| cleanup / secret-scan | PASS |
| Ask 假绿闭环（缺 submission → exit 3 / status HUMAN_REVIEW_PENDING） | PASS |
| 候选 hash 篡改 → exit 2 | PASS |
| Human review schema（3×12 + UX01..UX05 + 3 hash const + overallDecision 派生） | PASS（无密码学签名，已在结构层闭合；README 声明自动化代签不入仓） |
| Stage gate / PRD review（V3-6/V3-7 BLOCKED，无 YouTube/小红书/V4/BiliNote parity 越界） | PASS |

**最终判定：**
- Fatal = 0
- Major = 0
- Minor = 1（producer-shape semantic 与通用 verifier 仍可被脱离 production verifier 误读——与 `v3-5.1-production-internal-exit-audit.md`、`17-prd-review.md`、`18-false-green-audit.md`、`human-review/README.md` 一致声明）
- **机器候选：PASS**
- **人类 pending：fail-closed**（已实测：`passed=false`、`status=HUMAN_REVIEW_PENDING`、`exitCode=3`）
- **是否允许进入 V3-6：否**（V3-6/V3-7 仍 BLOCKED；V3-5.1 LIMITED PASS 未达成；旧 V3-5 H01..H10 与固定候选 36 问 / UX 五步正式 submission 均不存在）

本审计不构成 V3-5.1 LIMITED PASS、V3-6 GO 或 V3 PASS。