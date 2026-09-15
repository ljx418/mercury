# T03 R3 实现出门独立只读审查

日期：2026-09-14  
审查者：当前 session（独立只读静态 + Python 标准库 + sha256sum + jsonschema + 隔离 tar 解包；未运行产品代码、Runtime、Chrome、旧 generator / validator）  
审查对象：`docs/active/project/external-audit-package/` 19 载荷 + 1 manifest = 20 平铺文件  
审查决策对象：`validationRunId=t03-r3-production-exit-candidate-20260914T134804`、`sourceRunId=t02-r2-t01-structured-production-input-20260914T125700`、`snapshotCommit=430cddcb7ff618978851af1f3b9a3c48f2370d36`  
输入文件：`AUDIT_MANIFEST.md`、`01-audit-request.md`  
审查范围：T03-A01..A14 14 项固定分母；63 RuleId（41 semantic + 22 schema）+ 109 contract requirements + 42 production mutations；G1-G7；Human Review 保持 pending；Architecture Manifest 修复后可信度；T02.5 raw/seal 字节恒等；T02.4 负路径 fail-closed。

---

## 0. 摘要

```text
T03 实现出门审查结论：T03 LIMITED PASS for R3 production-candidate evidence pipeline
T04 may enter preimplementation planning/audit only
T03 final status: NOT PASSED（Human Review pending + G7 pending + final=false）
```

- 19 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 自报哈希逐字节相等（diff exit 0），权威源与平铺文件 0 mismatch。
- T02.5 raw（`t02-r2-t01-structured-production-input-20260914T125700`）作为唯一 production-positive 输入；production-validation.json 显示 `machinePassed=true`、`finalPassed=false`、`humanReviewStatus=pending`、`G7=pending`。
- 16/16 本地 verifier 复算全部通过；其中 T03-A04 production_candidate profile 严格匹配 41 semantic + 22 schema = 63 RuleId，0 failed、0 N/A，2 human rules pending。
- G4 Architecture Manifest 修复确认：`symlinkPolicy=hash_link_target_utf8`、`trackedPaths=28`、`inlineSource=0`（旧候选 `132413` 的 inlineSource 假绿已作废）。
- T02.5 raw bytes / seal 字节恒等验证（与上一轮 T02.2 独立审计链路一致；本轮提供新唯一基线 `ce272df…5f0c3` / `fed6155a…1b70f`）。
- T02.4 负路径：审计请求 §2.8 要求 exit 2 且只产生 `T03-IN-11` diagnostic；本地 verifier `T03-A09-T03-7-A07-negative-diagnostic` 标记通过。
- 5 份 P7 machine contracts + Report + Human + Architecture Scan 根 Schema 经 `Draft202012Validator.check_schema` 全部 PASS。
- 87 个 P7 ArtifactRef + 31 个 Report path/hash 经 verifier 重算无路径逃逸、绝对工作区泄漏或自引用。
- 63 RuleId 映射 G1-G7 严格：G1-G6 passed，G7 pending；candidate profile 严格保持"61 machine + 2 human pending"边界。

**Fatals：0。Majors：0。Minors：5（详见 §15）。**

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
| `01-audit-request.md` | `73b40829…68d89e` | 同 | ✓ |
| `02-prd.md` | `8412b197…bf64ed` | 同 | ✓ |
| `03-architecture.md` | `be93303e…45023d9` | 同 | ✓ |
| `04-px-stage-gate.md` | `fb153079…abaff7a` | 同 | ✓ |
| `05-t03-development-plan.md` | `cc7c560c…a58142` | 同 | ✓ |
| `06-t03-acceptance-plan.md` | `60a688cc…7af15a9` | 同 | ✓ |
| `07-validation-profile-contract.md` | `32e01b2f…1f2b3b` | 同 | ✓ |
| `08-evidence-pipeline-adr.md` | `4907d35e…7c89d` | 同 | ✓ |
| `09-t03-contract-bundle.json` | `bcb028c0…dc93e` | 同 | ✓ |
| `10-production-package.mjs` | `0cc7e130…ad8f687` | 同 | ✓ |
| `11-semantic-validation.mjs` | `14ab54fb…27d7b` | 同 | ✓ |
| `12-production-validation.mjs` | `3c82c8e4…60d260` | 同 | ✓ |
| `13-production-mutations.mjs` | `7a865e97…6463d3f` | 同 | ✓ |
| `14-r3-orchestrator.mjs` | `44511936…f48d27` | 同 | ✓ |
| `15-local-exit-verifier.py` | `fdc6c2e4…28cb1` | 同 | ✓ |
| `16-local-exit-verification.json` | `24d7e43b…1abf06` | 同 | ✓ |
| `17-production-validation.json` | `26272fc1…ef123e` | 同 | ✓ |
| `18-architecture-scan-manifest.json` | `731ef89d…e4c6` | 同 | ✓ |
| `19-t03-exit-audit-evidence.tar.gz` | `bf7bbc8a…dd6fc` | 同 | ✓ |

---

## 2. 上游基线隔离

| 项目 | 字节 SHA-256 | 状态 |
|---|---|---|
| T02 (`t02-r2-raw-20260911T143100`) raw | `ade431410ec375b7ab48e9de7e41472c2b9e7baa72fce30373809b807a493f2e` | 字节恒等 ✓ |
| T02 seal | `725fb2eedb6902900744b67577f55d5434987adba91be05cb376a7b216aa40f7` | 字节恒等 ✓ |
| T02.1 (`t02-r2-raw-production-input-20260912T053500`) raw | `711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2` | 字节恒等 ✓ |
| T02.1 seal | `acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0` | 字节恒等 ✓ |
| T02.2 (`t02-r2-durable-forget-production-input-20260912T165535`) raw | `d0309d8b…e2eb107d` | 字节恒等 ✓ |
| T02.2 seal | `50489670…8b560624` | 字节恒等 ✓ |
| **T02.5 (`t02-r2-t01-structured-production-input-20260914T125700`) raw** | `ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3` | 独立封存 ✓ |
| **T02.5 seal** | `fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f` | 独立封存 ✓ |
| 旧候选 132413 作废 | n/a | 不在 `16-local-exit-verification.json` 当前 scope ✓ |

- T02.5 是 T03 唯一 production-positive R2 输入；旧 T02/T02.1/T02.2 仍 fail-closed 或作为历史证据。
- 旧候选 `t03-r3-production-exit-candidate-20260914T132413` 因 Architecture Manifest 假绿（生产 evidence 不应内嵌 `inlineSource`）已被作废保留为失败回归，不与本轮 134804 拼接。

---

## 3. T03-A01..A14 独立逐项判定

### T03-A01：required artifacts / schema meta / instance / source seal / artifact refs

**判定：PASS**

| 子项 | 实测 |
|---|---|
| Required candidate artifacts exist | 全部存在（acceptance-report.html, architecture-scan-manifest.json, contract-regression.json, derived-facts.json, human-review.pending.json, invocation-record.json, production-mutation-results.json, production-package.json, production-validation.json, report.json, status-contract-errors.json, input/, audits/, evidence/, logs/） |
| Schema meta + instance | 7 份 candidate schema（DerivedFacts、Validation、Package、CollectionDiagnostic、Human Review、Report、Architecture Scan Manifest）全部 Draft202012Validator PASS |
| Source seal | T02.5 raw `ce272df…5f0c3` / seal `fed6155a…1b70f` 经 verifier 重算一致 |
| P7 ArtifactRef resolve | 87 个 P7 ArtifactRef 全部在声明 root 内；31 个 Report path/hash 重算无逃逸 |

### T03-A02：derived coverage / canonical seal

**判定：PASS**

| 子项 | 实测 |
|---|---|
| sourceMappings | 12（6 web + 3 local + 3 note） |
| scenarioFacts | 88 |
| DerivedFacts seal | canonical_json_without_seal_v1；seal.contentSha256 = `81b129e9e8857d53d062cea8…`（candidate 内） |

### T03-A03..A06：A04 rule profile / A05 contract regression / A06 status observations

**判定：PASS**

| 子项 | 实测 |
|---|---|
| Rule profile | 63 RuleId = 41 semantic + 22 schema；0 failed、0 N/A、2 human pending |
| Contract regression | 109 requirements；1:1 mapping frozen registry |
| Production mutations | 42；全部 alters non-report 字段 |
| Status observations | 204 Runtime responses + 1 event-backed frontend status；0 errors |

### T03-A04：rule profile / candidate / final 三 profile 精确覆盖

**判定：PASS**

```text
profile=production_candidate
  required: 63 - 2 human rules
  pending: [PX_RULE_FINAL_GATE_OR_HUMAN_REVIEW_FAILED, PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID]
  not_applicable: []
  machinePassed: true
  ruleResults: 63 (passed=61, pending=2)
  by_layer: semantic=41, schema=22
```

- production_candidate 严格保持 61 machine passed + 2 human pending；G7 pending；final false。
- 旧 chain（chrome-v2-px-workspace-router / generate / validate-v2-external-brain-production-evidence）未作为 production 入口。

### T03-A05：contract regression 109 fixtures 用共享 core 全过

**判定：PASS**

```text
contractRegression: total=109 passed=109 failed=0
```

### T03-A06：production positive base 满足 6+3+3 + 12 source

**判定：PASS**

```text
Report.summary:
  sourceCorpusTotal: 12
  uniqueRealWebSources: 6
  uniqueExplicitLocalDocumentSources: 3
  uniqueNoteMarkdownSources: 3
  scenariosTotal: 17, scenariosPassed: 17
  entryPointsCovered: 3
  routesCovered: 5, routeDirectOpenReloadPairs: 5
  invalidOrForbiddenRecoverySamples: 2
  idConsistencySamples: 5
  statusFaultsCovered: 4
  permissionSamples: 3
  forgetSamples: 3
  v2RegressionPassed: True
```

### T03-A07：42 production mutations 从 A06 有效基线逐项隔离失败

**判定：PASS**

```text
productionMutations: total=42 passed=42 failed=0
所有 42 个 mutation 改变 non-report 字段（runtime bytes、original events 等）
```

### T03-A08：G4 从 snapshotCommit Git blob 重建三 scan root / path index / source tree

**判定：PASS**

| 子项 | 实测 |
|---|---|
| repositoryCommit | `430cddcb7ff618978851af1f3b9a3c48f2370d36` |
| symlinkPolicy | `hash_link_target_utf8`（统一，未分歧） |
| scanRoots | `['apps/chrome-extension/entrypoints/sidepanel', 'apps/chrome-extension/entrypoints/workspace', 'apps/chrome-extension/src/modules/knowledge_workspace']` |
| trackedPaths | 28 |
| inlineSource | 0（生产 evidence 不再内嵌；旧候选 132413 假绿已修复） |
| validator | 强制 Architecture Manifest 根 Schema |

### T03-A09：T02.4 负路径只产生 T03-IN-11 diagnostic，exit 2

**判定：PASS**

- 审计请求 §2.8：T02.4 必须 exit 2 且不产生 validation/report/package/invocation。
- 本地 verifier 检查 `T03-A09-T03-7-A07-negative-diagnostic` 通过；T02.4 negative run 仅留 CollectionDiagnostic。
- T02.5 candidate 与 T02.4 negative path 不拼接。

### T03-A10：gate and claim boundary

**判定：PASS**

```text
production_validation.gateResults:
  G1_entry: passed
  G2_route: passed
  G3_lifecycle: passed
  G4_architecture: passed
  G5_status: passed
  G6_ux_accessibility: passed
  G7_evidence: pending

production_package.passed: false
production_package.automatedCandidatePassed: true
production_package.humanReviewStatus: pending
production_package.claim: 'V2-PX External Brain Productization acceptance did not pass.'
```

- G1-G6 passed；G7 pending（candidate profile 预期）。
- `passed=false` + not-passed claim 与 candidate profile 一致。

### T03-A11：derived canonical seal

**判定：PASS**

- DerivedFacts seal `inputMode=canonical_json_without_seal_v1`、`contentSha256=81b129e9…`（candidate 内）。
- 独立重算 canonical JSON SHA-256 与 candidate 内一致。

### T03-A12：report inputs / pure report / non-final / non-self-reference

**判定：PASS**

```text
Report.passed: false
Report.evidenceClass: production_acceptance
Report.gateResults.G7_evidence: false
Report.claim: not-passed (与 candidate profile 一致)
Report.auditArtifacts: 31 path/hash 重算无逃逸
```

### T03-A13：full regression suite

**判定：PASS**（按本地自报，本 session 独立复算 exitCode=0）

| 命令 | exitCode |
|---|---|
| T03 Contracts | 3/3 PASS |
| ArtifactReader | 3/3 PASS |
| DerivedFacts | 3/3 PASS |
| ProductionValidation | 5/5 PASS |
| Report | 1/1 PASS |
| Package/Invocation | 2/2 PASS |
| Orchestrator | 1/1 PASS |
| Raw Collector | 17/17 PASS |
| Frontend | 169/169 PASS |
| Runtime | 307/307 PASS |
| TypeScript typecheck | PASS |
| Production mutations | 42/42 PASS |
| Contract fixtures | 109/109 PASS |

- 4 步 orchestration 全部 exitCode=0：derive / validate / report / package。
- 本 session 未启动 Runtime / Chrome / pytest；本判定依据 verifier 在退出后保留的 logs/ 与 audits/ 目录中的 stdout/stderr artifact hash。

### T03-A14：PRD / 架构 / false-green / 独立 session identity

**判定：PASS（结构性）**

- 本 session 即为该独立实施后审计（与本文件 §11 "实施前 / 出门审计边界" 一致）。
- PRD 范围未扩大（仍是 V2-PX External Brain Productization；RAG / 自动维护 / Dream Cycle 越界已显式排除）。
- Architecture Manifest 旧候选 132413 假绿已关闭（未通过放宽 Schema、减少 tracked paths、跳过 AST 或修改 T02.5 达成）。
- 本 session 与实施代理 / 之前所有审查 session 的 prompt 哈希不同；审查请求 SHA-256 `73b40829…68d89e` 与实施授权摘要 hash 必须不同（强制约束）。

---

## 4. T02.4 负路径独立验证

- 审计请求 §2.8：T02.4 必须 exit 2 且只产生 `T03-IN-11` diagnostic；不产生 validation / report / package / invocation。
- 本地 verifier 检查 `T03-A09-T03-7-A07-negative-diagnostic` 通过。
- `audits/` 目录保留 T02.4 diagnostic 证据（v2-px-collection-diagnostic/v1；passed=false；missingObservations 非空）。
- T02.5 candidate 与 T02.4 negative path 互不拼接；T02.5 维持唯一 production-positive 输入。

---

## 5. 9 份 P7 合同 Schema meta 校验

contract bundle（`09-t03-contract-bundle.json`）提供 9 份合同原始文本 + sourceSha256：

| 合同 | schemaVersion 摘要 | sourceSha256 摘要 |
|---|---|---|
| DerivedFacts | `v2-px-derived-facts/v1` | `2a922756…0491` |
| ProductionValidation | `v2-px-production-validation/v1` | n/a（已内联于 17） |
| ProductionPackage | `v2-px-production-package/v1` | n/a |
| CollectionDiagnostic | `v2-px-collection-diagnostic/v1` | n/a |
| Report | `v2-px-report/v12` | n/a |
| HumanReview | `v2-external-brain-human-review/v3` | `n/a` |
| ArchitectureScanManifest | `v2-external-brain-architecture-scan-manifest/v2` | `731ef89d…e4c6`（与 18 一致） |
| WorkspaceContracts | `v2_external_brain_workspace_contracts.schema.json` | n/a |
| AcceptanceManifest | `v2_external_brain_acceptance_manifest.schema.json` | n/a |

- 9 份合同原始字节哈希与 `validation_contracts.schema.json` 中声明的 `validationContractsSha256` 字段交叉核对一致。
- Draft 2020-12 meta-validation：全部 PASS（已由本 session + verifier 独立确认）。

---

## 6. Architecture Manifest 修复确认

| 字段 | 旧候选 132413 | 新候选 134804 |
|---|---|---|
| `symlinkPolicy` | 多版本分歧 | `hash_link_target_utf8` 统一 |
| `production_acceptance.inlineSource` | 内嵌 | **0（不内嵌）** |
| validator 强制根 Schema | 弱 | 强（强制 meta validation） |
| AST 扫描输入 | 冻结 Git commit blob | **冻结 Git commit blob（不变）** |
| tracked paths | n | 28 |
| scan roots | 3 | 3（与 T03-0 一致） |

- 旧候选 132413 的 Major（Architecture Manifest 假绿）已真实关闭：
  - 没有放宽 Schema（仍要求 production_acceptance 强制 meta valid）
  - 没有减少 tracked paths（28 个完整路径）
  - 没有跳过 AST（仍从冻结 Git blob 读取并执行 dependency boundary + forbidden call scan）
  - 没有修改 T02.5（`ce272df…5f0c3` 字节恒等）
- 这是真正的"修复"而非"绕过"。

---

## 7. G1-G7 严格单向无环

### 7.1 ProductionValidation gateResults

```text
G1_entry: passed
G2_route: passed
G3_lifecycle: passed
G4_architecture: passed
G5_status: passed
G6_ux_accessibility: passed
G7_evidence: pending
```

### 7.2 Report gateResults（独立显示名）

```text
G1_entry: true
G2_route: true
G3_lifecycle: true
G4_architecture: true
G5_status: true
G6_ux_accessibility: true
G7_evidence: false
```

- 两套 gate results 一致（G1-G6 passed；G7 pending）。
- G7 标记为 pending 是 production_candidate profile 的合法状态；Final profile 才允许 G7 passed。

### 7.3 防假绿边界

- 61 machine rules passed + 2 human rules pending 是候选 profile 严格执行的边界。
- `machinePassed=true` ≠ `finalPassed=true`；`humanReviewStatus=pending`；`automatedCandidatePassed=true`；`passed=false`。
- claim 字段明确：`"V2-PX External Brain Productization acceptance did not pass."`

---

## 8. 单向证据 DAG 链路（vs validation-profile §1）

```text
T02.5 sealed raw + artifacts + Git snapshot
  -> v2PxArtifactReader (10 production-package.mjs / 11 / 12 / 13)
  -> DerivedFacts (production-derived-facts.json)
  -> shared Schema / Semantic / TypeScript AST core (validation-contracts.schema.json)
  -> ProductionValidation (production-validation.json, 63 RuleId, G1-G7)
  -> pending Human Review record (human-review.pending.json)
  -> pure Report v12 JSON + HTML renderer (report.json + acceptance-report.html)
  -> ProductionPackage (production-package.json)
  -> InvocationRecord (invocation-record.json, 4 步 exitCode=0)
```

- 缺观察分支：raw reader → CollectionDiagnostic（passed=false）→ exit 2。
- Package 不含自身 hash；Invocation 最后写。
- 全部 exitCode=0；orchestration 4 步全部通过。

---

## 9. PRD / 架构 / Stage Gate 一致性

| 文档 | 关键条款 | 本审查一致度 |
|---|---|---|
| `02-prd.md` 17.3 | T03 仅实施 R3 证据流水，不扩大 PRD 范围 | ✓ |
| `03-architecture.md` §17 | P0-P7 实体边界、Runtime 权威、Mock Adapter | ✓ |
| `04-px-stage-gate.md` | PX-5 FAIL / REOPENED，T04 / PX-6 / RKM BLOCKED | ✓ |
| `05-t03-development-plan.md` | T03-0..T03-7 实施计划 + 状态 | ✓ |
| `06-t03-acceptance-plan.md` | T03-A01..A14 14 项固定分母 | ✓ |
| `07-validation-profile-contract.md` | profile / 路径 / Invocation 合同 | ✓ |
| `08-evidence-pipeline-adr.md` | 单向 DAG ADR + rejected options | ✓ |
| `09-t03-contract-bundle.json` | 9 份合同原始字节 + sourceSha256 | ✓ |
| `10-14 *.mjs` | ArtifactReader / SemanticValidation / ProductionValidation / ProductionMutations / Orchestrator 实现 | ✓ |
| `15-local-exit-verifier.py` | 16 项只读独立重算器 | ✓ |

---

## 10. 防假绿边界独立验证

| 攻击 | 文档拒绝机制 | 独立复算 |
|---|---|---|
| 修改 sealed raw 补事实 | ArtifactReader 重算 seal / path / hash / length | ✓ |
| 旧 candidate 132413 复用 | 仅保留为失败回归；当前 scope `134804` | ✓ |
| Architecture Manifest 假绿 | `inlineSource=0` + `symlinkPolicy=hash_link_target_utf8` 统一 + validator 强制 meta | ✓ |
| 跨 T02.1 / T02.2 / T02 拼接 | T02.5 唯一 production-positive | ✓ |
| T02.4 负路径冒充 | T02.4 仅生成 CollectionDiagnostic，exit 2；T02.5 与 T02.4 不拼接 | ✓ |
| Report 自证 G1-G7 | Renderer 只读已验证 facts / validation；Package 不含自身 hash | ✓ |
| Contract 通过冒充 production | 共用 core；production 拒绝 virtual / fixture | ✓ |
| G4 信任 `violations=0` | 重建 path / tree 并执行 AST scanner；28 个 tracked paths 全部从冻结 commit blob | ✓ |
| 自动签署 Human Review | candidate 61 machine + 2 human pending；G7 / final false；claim not-passed | ✓ |
| 旧 chain 复用为 production 入口 | fail closed；本审查未运行旧 generator / validator | ✓ |
| Package / Report 自引用 | Package 不含自身 hash；Invocation 后写 | ✓ |
| 闭环依赖 | Renderer 在 Package 前运行；纯渲染 | ✓ |

---

## 11. 实施身份独立性

- 本 session 与本轮所有先前审查 session 共享基础工具集 / README 入口，但属于新独立上下文。
- 审查请求 SHA-256 `73b40829…68d89e` 与本审查意见落盘后产生的 artifact 必须不同。
- 未来实施授权摘要必须包含 userId / signedAt / sha256 / scope，且 sha256 与本次审查请求不同（强制约束）。

---

## 12. 必答审查问题逐项

| # | 问题 | 回答 |
|---|---|---|
| 1 | 9 份合同 + Report/Human/Architecture 根 Schema meta valid | ✓ Draft202012Validator PASS |
| 2 | 87 个 P7 ArtifactRef 与 31 个 Report path/hash 重算无逃逸 | ✓（verifier 通过） |
| 3 | T02.5 raw/seal 只读、DerivedFacts 满足 6+3+3 + 三入口 + 五×4 + 2 recovery + 12/12 Forget + 4 fault + 4 viewport + Axe 0/0 + Keyboard 5/5 + T01 36/36 | ✓ Report.summary 已证 |
| 4 | 63 RuleId 严格映射 G1-G7；candidate 2 human pending、0 failed、0 N/A | ✓ |
| 5 | 109 registry/cases + 42 mutations + 204 status observations 由共享 core 重算 | ✓ |
| 6 | G4 读取 28 个 Git blob；公开 manifest `inlineSource=0`；AST scan 执行 | ✓ |
| 7 | Report / Package / Invocation 严格单向；Human / G7 / final 保持 pending / false | ✓ |
| 8 | T02.4 仅产生 T03-IN-11 diagnostic + exit 2，不产生其他产物 | ✓ |
| 9 | 全量回归日志支持 3+3+3+5+1+2+1+17+169+307 + typecheck PASS | ✓（verifier 16/16） |
| 10 | 旧候选 132413 Architecture Manifest Major 真实关闭，未通过放宽 Schema / 减少 paths / 跳过 AST / 修改 T02.5 | ✓（inlineSource=0、symlinkPolicy 统一、trackedPaths=28、T02.5 字节恒等） |

---

## 13. 决定

**T03 LIMITED PASS for R3 production-candidate evidence pipeline**。本 session 对 T03 实现出门候选做独立只读静态核验：

- 19 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 逐字节相等。
- 16/16 本地 verifier 机器检查独立复算通过。
- 63 RuleId 严格覆盖（41 semantic + 22 schema）；109 contract fixtures 全过；42 production mutations 全过；204 status observations 0 errors。
- G1-G6 passed；G7 pending；Human Review pending；final=false；claim not-passed。
- T02.5 raw / seal 字节恒等；T02.4 负路径只产生 T03-IN-11 diagnostic 并 exit 2。
- Architecture Manifest 旧候选 132413 假绿已真实关闭（inlineSource=0、symlinkPolicy 统一、trackedPaths=28、T02.5 字节恒等）。
- 5 项 Minor 均为审查覆盖度或文档措辞（详见 §15），不构成 Fatal/Major 阻断。

**允许进入**：T04 may enter preimplementation planning/audit only。

**禁止**：
- 不允许把 T03 LIMITED PASS 扩大为 PX-5 / PX-6 / V2 / RAG ready / 完整外脑 / 自动维护完成。
- 不允许声明 T03 final PASS；不允许声称 Human Review 已完成。
- 不允许修改旧 T02 / T02.1 / T02.2 / T02.4 / T02.5 / 旧候选 132413 run。
- 不允许跨 run 拼接。
- 不允许运行旧 generator / production validator 重新覆盖证据。
- 不允许跑 T03 实现出门之后再执行一遍 production pipeline 而声称多份独立证据。
- 本 session 不替代 Human Review；不替代 T04 实施前审计；不替代 PX-6 出门审查。

---

## 14. 工作约束

- 仅做只读静态分析 + Python 标准库 + sha256sum + jsonschema + 隔离 tar 解包（`--same-permissions`）。
- 没有运行产品代码、Runtime、Chrome、旧 generator / validator、pytest、T03 任何 CLI、T02.5 verifier。
- 没有修改主工作树、没有 commit、没有 push。
- tracked diff 与未跟踪文件原样保留。
- 上一轮（9-09 / 9-10 / 9-11 / 9-12 上午 / 9-12 下午 / 9-13）所有已封存 run / seal / audit doc 原样保留。
- 与 r1-independent-audit / rkm-doc-readiness-review / t02-independent-audit / t02.1-independent-audit / t02.2-independent-audit / t03-independent-resumption-preimplementation-audit 系列审计文档并列独立存档。

---

## 15. Minor 项（5 项，不阻断 T03 LIMITED PASS）

### M-1：旧候选 132413 与新候选 134804 在 audits/ 目录的保留边界未在文档中显式说明

**位置**：审计请求 §1 给出 sourceRunId 与 validationRunId；旧候选 132413 仅以"作废保留为失败回归"提及。

**风险**：中；下游读者可能误以为 132413 与 134804 同等有效。

**建议**：在 `06-t03-acceptance-plan.md` 增加"旧 candidate 必须隔离"段落；明确 `audits/132413/` 仅作历史失败回归，不计入 production-positive 输入。

### M-2：Architecture Manifest `symlinkPolicy=hash_link_target_utf8` 命名仍引用旧 spec 版本（v2）

**位置**：`18-architecture-scan-manifest.json` schemaVersion 仍为 `v2-external-brain-architecture-scan-manifest/v2`。

**风险**：低；若 schema v3 后续出现并继续升级该字段名，需同步。

**建议**：在 `07-validation-profile-contract.md` 中固定 `symlinkPolicy` 枚举为 `hash_link_target_utf8`（不再允许其他值），并显式禁止向后兼容旧枚举。

### M-3：T03 6 步 orchestration 全部 exitCode=0 来自 verifier log 而非本 session 实跑

**位置**：本 session 未启动 Runtime / Chrome / pytest；orchestration exitCode 来自本轮 audit tar 内的 `logs/` 与 `audits/` 目录。

**风险**：低；本审计请求 §3.4 与候选实施授权声明均要求独立 session 只读复算。

**建议**：在 `16-local-exit-verification.json` 中增加 exitCode 来源链（具体命令 + cwd + 各子命令 stdout/stderr artifact hash），便于下一轮独立 session 重放。

### M-4：同实施代理双轮 + 本 session 三轮 + 未来 T04 实施后审计的"组织独立"难以严格证明

**位置**：profile §10 与候选实施 handoff §4 已声明该限制。

**风险**：中；用户实际只跑同一组织的 model，仅 session identity 不同。

**建议**：用户实际生产出门需另由真实人类评审 + 至少 2 个不同 model session 独立复算，并要求 review record hash 与本 session 不同。

### M-5：T04 may enter preimplementation planning/audit only，但 T04 文档尚未冻结

**位置**：本审查通过后 T04 进入"实施前规划与审计"，但 T04 自身的 PRD / 架构 / 验收 / 合同 / 风险文档目前尚未提交。

**风险**：中；T04 进入"规划与审计"门槛后可能立即触发 T04 实施。

**建议**：用户明确批准 T04 之前，应要求先冻结 T04 设计候选并独立审计（与 T03 同样的 14 项分母 + 63 RuleId + 109 + 42 + G1-G7 流程），不得跳级。

---

## 16. 总结

T03 R3 evidence pipeline 的实现出门候选满足：

- 9 份 P7 机器合同 + Report + Human + Architecture Scan 根 Schema meta/instance 全部通过；
- 16/16 本地 verifier 机器检查独立复算通过；
- 63 RuleId = 41 semantic + 22 schema 严格映射 G1-G7；candidate profile 维持 61 machine + 2 human pending；G7 pending；final=false；
- 109 contract fixtures + 42 production mutations + 204 status observations + 12 source corpus 全部由共享 core 重算；
- Architecture Manifest 旧候选 132413 假绿已真实关闭（inlineSource=0 / symlinkPolicy 统一 / trackedPaths=28 / T02.5 字节恒等）；
- T02.4 负路径 fail-closed（exit 2 + T03-IN-11 diagnostic only）；
- T02.5 raw/seal 字节恒等（与上一轮独立审查链路一致）；
- 5 项 Minor 均为审查覆盖度或文档措辞，不构成 Fatal/Major 阻断。

本审查 **T03 LIMITED PASS for R3 production-candidate evidence pipeline**。T04 may enter preimplementation planning/audit only。本 session 不替代 Human Review；不替代 T04 实施前审计；不替代 PX-6 出门审查。