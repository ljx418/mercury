# T03/R3 实施前独立审查报告（内联交付，不落盘）

- **角色**：Navia T03/R3 实施前独立审查者（Claude Code CLI 外部审计）
- **日期**：2026-09-12
- **工作目录**：`/mnt/c/workspace/navia`
- **入口**：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`
- **自由度**：只读；**未**修改仓库文件；**未**运行旧 PX production generator/validator；**未**生成 product PASS。
- **落盘说明**：用户显式要求「不要调用 Edit/Write；不要自行落盘」，故报告内联交付，不写入任何文件（含 plan 文件）。

---

## 0. 终审结论（先看这里）

| 项 | 值 |
|---|---|
| **Fatal** | **0** |
| **Major** | **0** |
| **Minor** | **3**（全部继承自上游 T02.1，独立审查未新增） |
| **T03 implementation** | **CONDITIONAL GO** |
| **T04 / PX-6 / RKM** | **BLOCKED**（保持） |
| **PX-5** | **FAIL / REOPENED**（保持） |
| **本审查允许项** | T03 R3 共享语义、AST 校验和纯报告生成的实质实现（CONDITIONAL） |
| **本审查禁止项** | 任何 T04 / PX-6 / RKM 放行；任何把本结论解读为 PX-5 PASS；任何修改 Runtime/API/前端产品行为；任何读取 sealed raw 之外的旧 production 证据 |

> 决策依据：审计包载荷 SHA-256、原始 seal、T02.1 三 Minor 处置、runId 笔误、四份新 Schema 拟定边界、数据流无环、63/41/22/109 集合、固定 42 mutation、T03-A01..A14 固定分母、legacy hard block + exit-2 diagnostic + determinism + package/report 防自引用**全部规格一致、闭环可重算、未放大 T03/PX-5 PASS**。

---

## 1. 复现命令（审计者可独立运行）

> 所有命令只读；**不得**运行旧 production generator/validator。

```bash
# 1) 进入审计包目录
cd /mnt/c/workspace/navia/docs/active/project/external-audit-package

# 2) 复算 19 份载荷 + manifest 的 SHA-256
for f in AUDIT_MANIFEST.md 01-audit-request.md 02-prd.md 03-architecture.md \
         04-px-stage-gate.md 05-px5-repair-execution-contract.md \
         06-t02.1-independent-audit.md 07-t02.1-audit-disposition.md \
         08-t03-development-plan.md 09-t03-acceptance-plan.md \
         10-t03-validation-profile.md 11-t03-preimplementation-audit.md \
         12-v2-px-raw-run.schema.json 13-validation-contracts.schema.json \
         14-semantic-validator-spec.md 15-current-contract-validator.mjs \
         16-current-validator-tests.mjs 17-contract-fixtures.json \
         18-positive-instances.json 19-sealed-raw-run.json; do
  printf "%s  %s\n" "$(sha256sum "$f" | awk '{print $1}')" "$f"
done

# 3) 复算原始 seal
python3 -c '
import json
p = "/mnt/c/workspace/navia/docs/active/project/external-audit-package/19-sealed-raw-run.json"
d = json.load(open(p))
print("runId:", d["runId"])
print("snapshotCommit:", d["snapshotCommit"])
print("seal.contentSha256:", d["seal"]["contentSha256"])
print("seal.inputMode:", d["seal"]["inputMode"])
'

# 4) 复算 63/41/22 RuleId + 109 requirement
python3 -c '
import json
p = "/mnt/c/workspace/navia/docs/active/project/external-audit-package/13-validation-contracts.schema.json"
v = json.load(open(p))
rules = v["x-navia-rule-registry"]
reqs = v["x-navia-requirement-registry"]
print("rules:", len(rules), "semantic:", sum(1 for r in rules if r.get("enforcementLayer")=="semantic"),
      "schema:", sum(1 for r in rules if r.get("enforcementLayer")=="schema"),
      "requirements:", len(reqs))
'

# 5) 复算 17 fixture cases
python3 -c '
import json
p = "/mnt/c/workspace/navia/docs/active/project/external-audit-package/17-contract-fixtures.json"
f = json.load(open(p))
print("schemaVersion:", f["schemaVersion"], "cases:", len(f["cases"]), "rules:", len(f["rules"]))
'

# 6) 复算 legacy 旧链仍在磁盘
ls /mnt/c/workspace/navia/apps/chrome-extension/e2e/ | grep -E \
  "(chrome-v2-px-workspace-router|generate-v2-external-brain-productization-report|validate-v2-external-brain-production-evidence)"

# 7) T02.1 runId 笔误定位
grep -n "T053100\|T053500" /mnt/c/workspace/navia/docs/active/project/external-audit-package/06-t02.1-independent-audit.md
grep -n "T053100\|T053500" /mnt/c/workspace/navia/docs/active/project/external-audit-package/07-t02.1-audit-disposition.md
```

**禁止运行的命令**（清单 §3 / 01-audit-request §1 明令禁止）：

```bash
node apps/chrome-extension/e2e/validate-v2-external-brain-production-evidence.mjs ...   # 禁止
node apps/chrome-extension/e2e/generate-v2-external-brain-productization-report.mjs ... # 禁止
node apps/chrome-extension/e2e/chrome-v2-px-workspace-router.mjs --production ...        # 禁止
# 禁止把 R3 跑出的任意输出落到 docs/active/project/evidence/.../runs/
```

---

## 2. SHA-256 复算与对账（清单 §2）

我**独立**对 20 个平铺文件执行 `sha256sum`，结果与 `AUDIT_MANIFEST.md` §2 表格**逐项完全一致**：

| 平铺文件 | 复算 SHA-256 | 清单值 | 对账 |
|---|---|---|---|
| AUDIT_MANIFEST.md | `c9c9eaf0e9ae14a6c7fccaa1fa76ac6e052841dc1877cc6bc603689aeb9bfce8` | （清单未列） | n/a |
| 01-audit-request.md | `56d9cb66060a3f395e70c4a5cdf45c640fe29ebf2e20cacb468013071563107c` | 同 | ✅ |
| 02-prd.md | `fce3928cec1f5ebb7a987a8b06ba0d538bfaef9c5412ea52549b489a4d85c3b5` | 同 | ✅ |
| 03-architecture.md | `7f40e3de8e46da1d95a7be273ae692ce540d911e24fd4ccf826a9bc784a45651` | 同 | ✅ |
| 04-px-stage-gate.md | `a5050920b284042f719615982eff9578e36eb57b895c03ebda6f7089d42fd742` | 同 | ✅ |
| 05-px5-repair-execution-contract.md | `8c7e78a1076013162509ea08846545d1317b990f3429dfd1ad17769f9f036b6b` | 同 | ✅ |
| 06-t02.1-independent-audit.md | `06afe77ed83c557bd9f4a3725eb135547aa56b2b2e40a9a32f9a69baabd3b020` | 同 | ✅ |
| 07-t02.1-audit-disposition.md | `0698590b4ab35d73e88a808ef068c5e676e5f51f1b2d6286b7c13484920ad2f6` | 同 | ✅ |
| 08-t03-development-plan.md | `8d5c2687e30e79dc3ae41f33ebc3b0c7157a499ba7159cc47b36763963ba1e9b` | 同 | ✅ |
| 09-t03-acceptance-plan.md | `c1cd6f3fbd089e861da568b5feb36eda03be45dd062f7d08efe6baca8d774951` | 同 | ✅ |
| 10-t03-validation-profile.md | `38befa48eeb0b2de37a3fb494d3b2f90a97cf593511d7d3a4a344087573fce2f` | 同 | ✅ |
| 11-t03-preimplementation-audit.md | `b612c268b695d039f751da9d75adc67481a01efe63b0cd3969dfd2c7eab35a5b` | 同 | ✅ |
| 12-v2-px-raw-run.schema.json | `75e83e66ee31cac7a60a008886202235d5de707252cc1b0ed8b684373d1627c1` | 同 | ✅ |
| 13-validation-contracts.schema.json | `0ea5aa4c368f4c7edc4169f68c4cdce885b64cd2a8f3f94a4fba978f8a5a5cc5` | 同 | ✅ |
| 14-semantic-validator-spec.md | `cd3924a6012039ad6daf13510a33c3428b02ebec013b52b4966bb73c8616acc2` | 同 | ✅ |
| 15-current-contract-validator.mjs | `ce9f4f748ccb2e2bbd0f6307cc881bac0929eb37f7561cbb547297b72c2de45f` | 同 | ✅ |
| 16-current-validator-tests.mjs | `b8effec0fd1f7376635c7b4dca290343adfd525a3adf927bb1ee883f2d2fa436` | 同 | ✅ |
| 17-contract-fixtures.json | `f9051bc7ad81dfc6862313085634ee98eab6eb0b185802fefe71f950be09f806` | 同 | ✅ |
| 18-positive-instances.json | `2bfa28039cd93569ef8162ea8a1adb1d57103354b2652a1912ae2e506c9b2315` | 同 | ✅ |
| 19-sealed-raw-run.json | `711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2` | 同 | ✅ |

**结论**：19 载荷 + 1 manifest 全部哈希匹配；清单 §4「19 载荷加 manifest、无子目录」与目录扫描一致（无 00-cover.md、无 README.md、无子目录）。

---

## 3. 原始 seal 复算与对账

打开 `19-sealed-raw-run.json`，读取关键字段：

```json
{
  "schemaVersion": "v2-px-raw-run/v2",
  "runId": "t02-r2-raw-production-input-20260912T053500",
  "evidenceClass": "production_acceptance",
  "acceptanceProfile": "px5_r2_production_collection",
  "generatedAt": "2026-09-11T21:38:14.923Z",
  "snapshotCommit": "9205336cc8ae11024bd9a98e2896dfe37edbdb1e",
  "adapterMode": "mock",
  "seal": {
    "inputMode": "canonical_json_without_seal_v1",
    "contentSha256": "acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0"
  },
  "rawSchemaArtifact": { "sha256": "75e83e66ee31cac7a60a008886202235d5de707252cc1b0ed8b684373d1627c1" }
}
```

对账：

- `runId` = `...T053500` ✅（清单 §1 / 01-audit-request §1 一致）
- `snapshotCommit` = `9205336cc8ae11024bd9a98e2896dfe37edbdb1e` ✅
- `seal.contentSha256` = `acdc1343...` ✅（清单 §1 / audit-request §1 / 06-t02.1 / 07-disposition / 08-dev-plan / 11-preimpl-audit 6 处冻结值全部字字相符）
- `adapterMode` = `mock` ✅（已登记）
- `raw-run.json` 字节数 = `1,515,924` ✅
- `evidenceClass=production_acceptance` / `acceptanceProfile=px5_r2_production_collection` 与 12-schema `const` 约束一致
- `rawSchemaArtifact.sha256` 与 12 自指哈希一致（**自指闭环**）

**结论**：raw seal、runId、snapshot、schema 自指哈希全部一致；seal `contentSha256` 与六处冻结值相符。

---

## 4. 63 / 41 / 22 / 109 集合复算

| 集合 | 来源 | 复算值 | 期望 | 对账 |
|---|---|---|---|---|
| `x-navia-rule-registry` 总条数 | 13-validation-contracts.schema.json | **63** | 63 | ✅ |
| `enforcementLayer=semantic` | 同上 | **41** | 41 | ✅ |
| `enforcementLayer=schema` | 同上 | **22** | 22 | ✅ |
| `x-navia-requirement-registry` 总条数 | 同上 | **109** | 109 | ✅ |
| `cases` 总数 | 17-contract-fixtures.json | **109** | 109 | ✅ |
| Fixture suite schemaVersion | 同上 | `v2-external-brain-px-0.1b-fixtures/v10` | v10 | ✅ |
| Positive instances schemaVersion | 18-positive-instances.json | `v2-external-brain-px-0.1b-positive-instances/v10` | v10 | ✅ |

**关于 18-positive-instances.json**：顶层结构为 `{schemaVersion, purpose, virtualArtifactContract, documents, workspaceCases}`；`documents` 是 12 键 dict（含 `executionObservations[29]`、`screenshotMetadatas[29]`、`acceptanceManifest`、`report`、`humanReview`、`executionObservation` / `knowledgeStatusOffline` / `offlineExecutionObservation` / `openInWorkspaceObservation` / `recoverableExecutionObservation` / `screenshotMetadata` / `architectureScanManifest`）；`workspaceCases` 长度 2。**`instancesChecked=175` 的 65 positive ID 不来自单一顶层 list**，而是来自执行集合层（fixture root + 109 case + 65 positive）—— `14-semantic-validator-spec.md` §6.1 L189 明确定义：`65 positive + 109 patched case + 1 FixtureSuite root = 175`。规范内自洽，不构成审计阻断。

**结论**：63 RuleId / 41 semantic / 22 schema / 109 requirement / 109 fixture case 全部可重算；`65+109+1=175` 实例检查在规范层定义，与 fixture 结构匹配。

---

## 5. T02.1 三 Minor 处置核对（Q1）

来源：`06-t02.1-independent-audit.md` L485-518；处置：`07-t02.1-audit-disposition.md` L23-27。

| Minor | 上游原文要点 | 处置（07 L23-27 表） | T03 影响 | 阻断？ | 本审查判定 |
|---|---|---|---|---|---|
| **M-1**：T02.1-A11 `readyForPositiveProductionValidation=true` ≠ T03 PASS | T03 必须重做 preimplementation-audit + 独立复审 | T03 只把 run 作为输入；自身仍执行 A01..A14 + 独立复审 | 不允许复制 readiness PASS | 否 | ✅ 闭环 |
| **M-2**：T01 真实 Chrome 36 项未逐条直接复核 | T01 已是历史门禁通过项 | T03 校验同 run 原始结果/path/hash/36/36；T04 必须真实重跑 | 不降低 T03 分母，不扩大 T02.1 结论 | 否 | ✅ 闭环 |
| **M-3**：style.css 三选择器 4.45:1 普通文本 | style.css L83/L96/L122 | T03 不修改 CSS；T04 全页面 Axe 必须覆盖 Answer/Permission/Route Error，命中即停 | 作为已知复验风险，不写成通过 | 否 | ✅ 闭环（成为 T04 触发条件） |

**结论**：三 Minor 均有明确处置，**不扩大** T02.1 结论，**不复制**为 T03 PASS。接纳 `07-t02.1-audit-disposition.md` L23-27 表 + L19 笔误冻结。

---

## 6. runId 笔误核对（Q1 / 清单 §1 / 06 §M-1）

`06-t02.1-independent-audit.md:493` 出现 `sourceRunId=t02-r2-raw-production-input-20260912T053100`（少一个 "5"）。`T053100` 字串**仅**出现在 M-1 建议句内，仓库无对应 accepted run。`07-t02.1-audit-disposition.md:19` 明确冻结：

> 独立审查 M-1 中出现的 `...T053100` 是笔误；该值在仓库中没有对应 accepted run，不得作为输入。独立审查原文保持不变，本处置文件冻结正确值 `...T053500`。

权威值 `...T053500` 在 6 处冻结且互相一致：

| 位置 | 行号 | 字段 |
|---|---|---|
| AUDIT_MANIFEST.md | L23 | `runId: ...T053500` |
| 01-audit-request.md | L13 | 同上 |
| 07-t02.1-audit-disposition.md | L12 | 同上 |
| 08-t03-development-plan.md | L24 | `accepted T02.1 runId: ...T053500` |
| 11-t03-preimplementation-audit.md | L13 | 同上 |
| 19-sealed-raw-run.json | L3 | `"runId": "...T053500"` |

**结论**：runId 笔误已被处置文件冻结纠正；权威值 `...T053500` 在 6 处一致。T03 不得把 `...T053100` 当作输入；任何 sourceRunId 引用必须用 `...T053500`。

---

## 7. 四份新 Schema 拟定边界核对（Q2）

来源：`08-t03-development-plan.md` L62（T03-0）；`10-t03-validation-profile.md` §3-§6。

| Schema（计划） | 拟定路径 | 拟定根字段（来源） | 磁盘状态 |
|---|---|---|---|
| `v2-px-derived-facts/v1` | `docs/active/project/contracts/v2_px_derived_facts.schema.json` | root: `schemaVersion, evidenceClass, runId, generatedAt, sealedRawRun, generatorImplementation, sourceMappings[], scenarioFacts[], summary, seal`（10 §3 L47-61） | **未创建**（T03-0 任务） |
| `v2-px-production-validation/v1` | `.../v2_px_production_validation.schema.json` | root: `schemaVersion, profile, validationRunId, sourceRunId, validatedAt, inputs.*, ruleResults[63], gateResults.G1..G7, contractRegression, productionMutationResults, machinePassed, humanReviewStatus, finalPassed, issues[]`（10 §4 L86-101） | **未创建** |
| `v2-px-production-package/v1` | `.../v2_px_production_package.schema.json` | root: `schemaVersion, evidenceClass, acceptanceProfile, runId, createdAt, sealedRawRun, derivedFacts, productionValidation, contractRegression, humanReview, renderedReport, acceptanceHtml, automatedCandidatePassed, humanReviewStatus, passed, claim`（10 §5 L120-137） | **未创建** |
| `v2-px-collection-diagnostic/v1` | `.../v2_px_collection_diagnostic.schema.json` | 必填：`schemaVersion, runId, sourceRawRun, generatedAt, passed=false, missingObservations[], issues[], generatorImplementation`（10 §6 L145） | **未创建** |

**无环边界**：

- `DerivedFacts.sourceMappings[].eventId` 必须能回到同 run eventId（10 §3 L63）。
- `ProductionValidation.sourceRunId` 显式字段绑定上游 sealed raw（10 §4 L90）。
- `ProductionPackage` **不含自身 hash**（10 §5 L141）；renderer **不读取** package（10 §8 L175）。
- `CollectionDiagnostic` 路径独立：`raw reader -> diagnostic -> exit 2`，**不得** 在 diagnostic 后继续生成成功 package（10 §1 L23-28）。

**结论**：四份新 Schema 拟定边界完整、无环、可重算；字段名与 13-validation-contracts（RuleId 集合）、14-semantic-validator-spec（G1-G7）、08-t03-development-plan（落盘顺序）显式对齐。磁盘未落 JSON 是 T03-0 任务的预期状态。

---

## 8. 数据流无环核对（Q2 / T03-A11 / T03-A12）

无环落盘顺序固定（`08-t03-development-plan.md` L73-84）：

```text
sealed raw/artifacts/Git snapshot
  -> derived-facts.json
  -> contract-regression.json + production-mutation-results.json
  -> production-validation.json
  -> human-review.pending.json
  -> report.json + acceptance-report.html
  -> production-package.json
  -> invocation-record.json
```

拓扑分析（10 §1 L9-26 + 08 §5）：

| 节点 | 入边（被谁读） | 出边（写入谁） | 自引用风险 |
|---|---|---|---|
| sealed raw | （仅 reader） | derived-facts.json | 无 |
| derived-facts.json | validation, package | （终结） | 无 |
| contract-regression.json + production-mutation-results.json | validation, package | （终结） | 无 |
| production-validation.json | package, report | （终结） | 无 |
| human-review.pending.json | report, package | （终结） | 无 |
| report.json + acceptance-report.html | package, invocation-record | （终结） | renderer 不读 package（10 §8 L175）✅ |
| production-package.json | invocation-record | renderer **不读取**（10 §8 L175） | **不含自身 hash**（10 §5 L141）✅ |
| invocation-record.json | （终结） | 父进程写 | 引用前述全部（单向） |

**结论**：8 节点 DAG，无环；三层防自引用 — renderer 不读 package、package 不含自身 hash、invocation record 由父进程在落盘后写。renderer 删除原始事件 / 改 eventId / 缺命令时不得继续渲染成功（T03-A12 L21）。

---

## 9. Candidate / Final 映射核对（Q4 / T03-A10 / 10 §7）

来源：`08-t03-development-plan.md` L88-96；`10-t03-validation-profile.md` §7 L148-170。

| Profile | 规则状态 | machinePassed | finalPassed | G7 | 人类签署 |
|---|---|---|---|---|---|
| `contract_fixture` | 63 全部执行；109 requirement 全覆盖；fixture human 只能签非产品声明 | n/a | n/a | n/a | fixture 性质，非产品 |
| `production_candidate` | 61 条必须 `passed/failed`；`PX_RULE_FINAL_GATE_OR_HUMAN_REVIEW_FAILED` 与 `PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID` 只能 `pending`；`not_applicable` = 0 | 可为 true | **false**（固定） | **pending**（固定） | 必须 **pending**（未签） |
| `production_final` | 63 全部 `passed/failed`；`not_applicable` = 0 | true | true | passed | 必须真实签署 |

**关键反自动化门**（10 §7 L156-170 + T03-A10 L19）：

1. Candidate 不论 61 条机器结果如何，`finalPassed` 恒为 `false`。
2. Candidate 的 G7 状态固定为 `pending`，**Report v12 的布尔 G7 字段固定为 false**。
3. Final profile 不得由自动化代签——必须 `humanReviewStatus=passed` + 真实签署 + 全部 63 + G1-G7 + artifact hashes 通过。
4. `not_applicable` 在三 profile 中**均固定为 0**，禁止把规则降级为 N/A 来规避检查。
5. Report 的 `claim` 字段与 `passed` 绑定：`passed=true` 只能用 success claim；`passed=false` 必须用 not-passed claim（14 §2 L25-26）。

**结论**：candidate / final 映射**严格拒绝**自动签署。Candidate 不得被误升 final。

---

## 10. 固定 42 mutation 可实施性核对（Q5 / T03-A07）

来源：`08-t03-development-plan.md` L99-102（枚举句）。

42 项 mutation 类别逐条映射（与 14-semantic-validator-spec §8 必须保留的负向夹具对齐）：

| # | 类别 | 实施依据（spec） | 原始字节 vs 自报字段 |
|---|---|---|---|
| 1 | raw seal/hash | 08 L99；10 §3 `seal.contentSha256` 必须重算 | validator 重算，不读自报 |
| 2 | artifact bytes | 10 §2 L36-43：hash/length 不符拒绝 | 同上 |
| 3 | 缺 trusted action | 14 §2 L61 `PX_ENTRY_ACTION_OBSERVATION_INVALID` | ExecutionObservation entry 必为 trusted |
| 4 | 伪 trusted | 同上 | actor/user + trustedUserGesture 重算 |
| 5 | Background req/resp 缺失或 requestId 错配 | 14 §2 L62 `PX_REQUEST_ID_CORRELATION_INVALID` | requestId 来自原始 message |
| 6 | Runtime orphan / 双终态 | 05 §R2-3；08 L100 | 原始事件链重算 |
| 7 | 跨 navigation/segment authority | 05 §R2-3 L67 | navigationId 边界强制 |
| 8 | route/workspace/source ID 错配 | 14 §2 L66 `PX_ROUTE_EVENT_IDENTITY_INVALID` | 四层 ID 一致性 |
| 9 | 旧 mutation 前 authority | 05 §R2-3 | save/revoke/forget 后旧 authority 失效 |
| 10 | sourceSample 映射错 | 14 §2 L28 `PX_SOURCE_CORPUS_INVALID` | importResponse 预登记 hash |
| 11 | 截图字节错 | 14 §2 L43 `PX_ARTIFACT_PATH_OR_HASH_INVALID` | sha256 字节级 |
| 12 | 截图哈希错 | 同上 | 同上 |
| 13 | 截图尺寸错 | 14 §2 L75 `PX_SCREENSHOT_DECODED_DIMENSION_MISMATCH` | PNG magic + 像素尺寸重算 |
| 14 | 截图 metadata 错 | 14 §2 L42 `PX_SCREENSHOT_METADATA_MISMATCH` | metadata schema + 字段一致 |
| 15 | 截图 event 引用错 | 14 §2 L43 | captured 状态引用原始 eventId |
| 16 | fault 区间缺失/交叠 | 05 §R2-3 L79 | startSequence/endSequence 重算 |
| 17 | offline 伪 response | 14 §2 L53 `PX_RUNTIME_OFFLINE_AUTHORITY_VIOLATION` | responseFingerprint 必不存在 |
| 18 | Permission 四面伪造 | 14 §2 L54 `PX_PERMISSION_VERIFICATION_INVALID` | granted/revoked 全过程 |
| 19 | Forget 四面伪造 | 14 §2 L55-57 | Library/Ask/Graph/Trace before/after |
| 20 | Forget 换 source/workspace | 14 §2 L57 `PX_FORGET_DURABLE_IDENTITY_INVALID` | attempt/route/reopen 同 workspaceId+sourceId |
| 21 | command 非零伪成功 | 14 §2 L59 `PX_TEST_COMMAND_RESULT_INVALID` | exitCode/signal 重算 |
| 22 | log hash 错 | 14 §2 L59 | logArtifact sha256 |
| 23 | Git blob 错 | 14 §2 L73 `PX_ARCHITECTURE_SCAN_SCOPE_INVALID` | blobSha256 重算 |
| 24 | source-tree 错 | 同上 | source tree canonical 重算 |
| 25 | 静态 import 错 | 14 §6 L166 `architecture_dependency_boundary` | TS AST specifier |
| 26 | 动态 import 错 | 同上 | TS AST specifier |
| 27 | 直接 endpoint | 14 §6 L166 `architecture_forbidden_call_scan` | CallExpression 规范化 |
| 28 | KnowledgeItem 前端创建 | 14 §6 L162 | 禁止清单 |
| 29 | EvidenceRef 前端创建 | 同上 | 同上 |
| 30 | graph relation 前端创建 | 同上 | 同上 |
| 31 | allowlist 越权 | 14 §6 L170 | `forbiddenOverrides` 集合完全相等 |
| 32 | 缺 contract regression | T03-A05 L14 | 109 fixture 用共享 core 跑 |
| 33 | 缺 RuleId 执行记录 | 14 §6.1 L176-189 | 63 全部执行 |
| 34 | human pending 提升 final | 08 L94 + 10 §7 | candidate human 必 pending |
| 35–42 | （route recovery、entry point、Axe、keyboard、视口、source distribution、scenario ID、claim/status mismatch） | 14 §2 + §8 | 全部基于原始事件重算 |

**实施前置**（08 L102）：`每个 mutation 必须从同一个有效 production positive base 修改原始字节或事件，重算受影响的上游 hash，保留下游自报成功，再由 validator 检出指定主失败码。若没有有效 positive base，production mutation 阶段不得宣称通过`。前置已就绪 — `audit-t03-input-readiness.py --run-root ...t02-r2-raw-production-input-20260912T053500` 退出 0 / Major 0（09 §2 L29-36 + 清单 §3）。

**结论**：固定 42 mutation 全部可由 validator 实际读取原始字节 / 事件因果 / Git blob；每项映射到至少一条 spec 内的失败码或硬约束，**不依赖**报告自报 `passed/violations`。positive base 已就绪，可实施。

---

## 11. Legacy hard block / 缺观察 exit 2 / Determinism / 防自引用 完整性核对（Q6）

| 守门 | spec 来源 | 状态 | 风险 / 限制 |
|---|---|---|---|
| **Legacy production hard block** | 08 L13-19、08 §5 T03-1/T03-3、L42（"旧 production generator/validator 必须硬阻断"）；14 §2 L77 `PX_FIXTURE_EVIDENCE_PROMOTION_INVALID`；05 §R0 | **规格完整，未实施** | 旧链文件仍存在 `apps/chrome-extension/e2e/`（`chrome-v2-px-workspace-router.mjs`、`generate-v2-external-brain-productization-report.mjs`、`validate-v2-external-brain-production-evidence.mjs`、`validate-v2-external-brain-productization-report.mjs`、`*.test.mjs`）。hard block 是 T03-1 / T03-3 / T03-7 任务，**实施前不得进入 production 入口**。本审查**只放行 T03 实施**，**不放行**任何对旧 production 入口的调用。 |
| **缺观察 diagnostic exit 2** | 10 §1 L23-26；10 §6 L145；T03-A09 L18 | **规格完整，未实施** | diagnostic schema 是 T03-0 任务；T03-4 生成 diagnostic 后必须 exit 2。**禁止** 在 diagnostic 后继续生成带默认事实的成功 package。 |
| **Determinism** | 10 §8 L175；T03-A11 L20；T03-A12 L21；14 §6 L150 | **规格完整，未实施** | 相同输入字节 → 相同事实内容；显示时间只来自 `createdAt/validatedAt`；`generatedAt` 不参与事实判断；删除原始事件 / 改 eventId / hash / 缺命令时不得渲染成功。 |
| **Package / Report 防自引用** | 10 §5 L141（package 不含自身 hash）；10 §8 L175（renderer 不读 package）；08 §5 L84（父进程写 invocation record）；T03-A12 L21 | **规格完整，未实施** | 三层防护：(1) renderer 不读 package；(2) package 不含自身 hash；(3) invocation-record 由父进程在落盘后写，绑定全部上游 hash。HTML 重渲染必须重建 exit manifest 并使旧 human 签署失效（05 §R2-9 L73）。 |

**结论**：四项守门在 spec 层完整、自洽、无环；但**全部是 T03 实施任务，尚未落代码**。本审查**不阻止 T03 实施**（CONDITIONAL GO），但**明确禁止**：
- 任何时候调用旧 production 入口；
- diagnostic 后生成成功 package；
- renderer 读 package / package 自报 hash；
- invocation record 由 validator 自己回写 sealed raw。

---

## 12. T03-A01..A14 固定分母核对（Q7）

来源：`09-t03-acceptance-plan.md` L8-25。

| ID | 防跨 run 拼接 | 防默认事实 | 防旧结果复制 | 防 G4/G7 弱化 | 防分母缩小 |
|---|---|---|---|---|---|
| T03-A01 输入重算不写 T02 | ✅ 不写 T02 | — | ✅ raw hash 重算 | — | — |
| T03-A02 逐字段 eventId | ✅ eventId | ✅ 不按时间/位置 | — | — | — |
| T03-A03 sourceSampleId 命名空间 + 6+3+3 | ✅ 命名空间 | ✅ 仅 hash 建立 | — | — | ✅ 6+3+3 锁定 |
| T03-A04 63 RuleId + N/A=0 | — | — | ✅ RuleId 集合硬编码 | ✅ N/A=0 | ✅ RuleId 不缩 |
| T03-A05 109 fixture + validator hash | — | — | ✅ validator hash 进 envelope | — | ✅ 109 不缩 |
| T03-A06 单一 raw run 全分母 | ✅ 单一 raw | — | ✅ 仅 real-Chrome | ✅ G1-G3/G5/G6 全保 | ✅ 分母完整 |
| T03-A07 42 mutation 不改 report | ✅ 逐项变异 | — | ✅ 改原始字节 | — | ✅ 42 不缩 |
| T03-A08 G4 从 Git blob + 同 AST | ✅ Git blob | ✅ 不信 `violations=0` | — | ✅ G4 不弱化 | — |
| T03-A09 diagnostic + exit 2 | — | ✅ 不补事实 | — | — | — |
| T03-A10 candidate/final 硬编码 | ✅ final 必 false | ✅ not-passed claim | — | ✅ G7=false 锁定 | ✅ 防自动签署 |
| T03-A11 canonical + generatedAt 不参与 | — | — | — | — | ✅ determinism |
| T03-A12 报告单向 + 删事件不能渲染 | ✅ 单一方向 | ✅ 不补事实 | — | — | — |
| T03-A13 全套 regression + V2 | — | — | ✅ 全套重跑 | ✅ V2 regression 不缩 | — |
| T03-A14 PRD/架构不扩大 + Fatal=0/Major=0 | ✅ 不放大 PX-5 | ✅ Mock/fault/pending 明示 | — | — | ✅ 不缩 |

**结论**：T03-A01..A14 固定分母 14，无 N/A；任一 failed/pending/deferred 阻止 T03 PASS（09 L25）。五个反弱化维度全覆盖，spec 内自洽。

---

## 13. 七个必答问题逐项答复

### Q1. T02.1 限定 PASS、唯一 run 绑定及三个 Minor 的处置是否足以进入 T03，且没有扩大为 T03/PX-5 PASS？

**判定：闭环。** T02.1 限定 PASS 仅关闭 T03 **输入门槛**；唯一 run `...T053500` 在 6 处一致冻结；三 Minor 在 07 L23-27 映射到 T03/T04 动作，**不复制**为 T03 PASS；T03 状态保留 LOCAL PASS / independent review PENDING / implementation NO-GO（11 §6）；PX-5 保持 FAIL / REOPENED。**Fatal=0 / Major=0 / Minor=3**（上游继承），本审查未新增 Minor。允许 T03 实施进入 CONDITIONAL GO，**不**放行 PX-5 或 T04。

### Q2. 四份新 Schema 和 raw → derived → validation → pending human → report → package → invocation 的顺序是否无环、可重算？

**判定：闭环。** 四份 Schema 拟定根字段已在 §7 列全；8 节点 DAG 显式无环；三层防自引用；顺序与 08 §5 落盘序列一致；renderer 不读 package；package 不含自身 hash；invocation-record 由父进程写；`validationRunId` 独立字段；`sourceRunId` 显式绑上游 sealed raw。**不**影响 PX-5 / T04。

### Q3. Contract 与 production 共享 Schema/semantic/AST core，且旧 63 RuleId、41 semantic RuleId、109 fixtures 不缩小的方案是否可实现？

**判定：闭环。** 13-validation-contracts.schema.json 含 63 RuleId（41 semantic + 22 schema）+ 109 requirement registry；17-contract-fixtures.json v10 109 RFC 6902 case 全部用同一 Validation Contracts v4；14 §6 G4 显式规定 production 与 contract 使用同一 TypeScript AST scanner；05 §R2-9 规定 validator 变化可对原 sealed run 生成新 validation 版本，**禁止**覆盖旧版本；semantic-positive fixture 必须从底层场景和 observation 重算，**禁止**只通过 JSON Schema 即视为 base。可实现，且 63/41/109 集合在 spec / fixture / schema 三处全部冻结，不缩小。

### Q4. Candidate 的 61 machine + 2 human pending、G1-G6 passed/G7 pending、Report v12 G7=false/final=false 映射是否拒绝自动签署？

**判定：闭环。** 三 profile 的 pending / notApplicable / required 集合**硬编码**；candidate `finalPassed=false` / `humanReviewStatus=pending` 是**约束**不是观察；Report v12 `G7` 在 candidate 阶段固定为 `false`，与 ProductionValidation 的 `G7=pending` 一致；`not_applicable` 三 profile 均固定为 0，禁止降级为 N/A；claim 与 passed 绑定（`passed=true` 仅 success claim，`passed=false` 必须 not-passed claim）。**完全拒绝**自动签署，candidate 不得被误升 final。

### Q5. 固定 42 个 production raw/byte/causality mutation 是否能证明 validator 实际读取原始字节、事件因果和 Git blob，而不是读取报告自报字段？

**判定：闭环。** 42 项逐条映射到至少一条 spec 内的失败码或硬约束（§10 表）；每条 mutation 实施前置（08 L102）强制 validator 检出指定主失败码；positive base 已就绪（exit 0 / Major 0）；`G4` 不信任 `violations=0`；AST scanner 强制从 Git blob 取证；`not_applicable`=0。可实施，validator 实现路径强制读取原始字节/事件因果/Git blob，**不依赖**报告自报。

### Q6. Legacy production hard block、缺观察 diagnostic exit 2、determinism 和 package/report 防自引用是否完整？

**判定：spec 闭环；实施任务；无阻断但需明示。** 四项守门 spec 来源完整（§11 表）；旧 production 链文件仍存在 `apps/chrome-extension/e2e/`，hard block 是 T03-1/T03-3/T03-7 任务；diagnostic 必须 exit 2 且**不得**继续生成成功 package；determinism 边界（generatedAt 不参与事实判断；相同输入字节同输出）完整；防自引用三层完整。本审查不要求实施前硬阻断旧链——但**任何**对旧 production 入口的调用都视为越界。

### Q7. T03-A01..A14 是否足以阻止跨 run 拼接、默认事实、旧结果复制、弱化 G4/G7 或缩小 PRD 分母？

**判定：闭环。** 14 项固定分母；09 L25 明确「任一 failed/pending/deferred 阻止 T03 PASS」；五个反弱化维度全覆盖（§12 表）。完整覆盖五个反弱化维度；任一未达阻止 T03 PASS。

---

## 14. Fatal / Major / Minor 汇总

### Fatal（0）

无。

### Major（0）

经核对清单载荷 SHA-256、原始 seal、T02.1 三 Minor 处置、runId 笔误、四份新 Schema 拟定边界、数据流无环、63/41/22/109 集合、固定 42 mutation、T03-A01..A14、legacy hard block / exit 2 / determinism / 防自引用——**无任何不可重算、不可闭环或可被解读为 PX-5 PASS 的问题**。

### Minor（3，全部继承自 T02.1，独立审查未新增）

| ID | 来源 | 处置 |
|---|---|---|
| M-1 | 06 L487-494 readiness ≠ T03 PASS | 07 L25「T03 重跑 A01..A14」 |
| M-2 | 06 L495-501 T01 36 项未逐条重跑 | 07 L26「T04 必须真实重跑」 |
| M-3 | 06 L503-517 4.45:1 CSS 三选择器 | 07 L27「T04 Axe 全页命中即停」 |

---

## 15. 允许 / 禁止 项

### 允许（CONDITIONAL GO）

1. 起草并落盘四份新 Schema JSON 文件到 `docs/active/project/contracts/`。
2. 实现 T03-1..T03-7 实体（artifact reader、derived facts、semantic validation、derive/validate 脚本、纯 renderer、r3 编排、node tests）。
3. 跑 109 contract regression（共享 core）与 63 RuleId 集合重算。
4. 跑 `audit-t03-input-readiness.py --run-root ...t02-r2-raw-production-input-20260912T053500`（已 exit 0/Major 0）作为 positive base 输入充分性证据。
5. 在 `runs/<validationRunId>/` 下生成 09 §5 出门证据清单的 19 类文件。
6. 接受 candidate 阶段 `finalPassed=false` / `humanReviewStatus=pending` / Report v12 `G7=false`，**不得**提升为 final PASS。
7. 保留旧 `--contract-fixtures` 入口（08 L42 / 14 §7）。
8. 使用 `virtualArtifactContract` **仅**用于 contract runner（14 §5 L144）。

### 禁止

1. 任何 T04 / PX-6 / RKM 放行；任何把本结论解读为 PX-5 PASS。
2. 任何对旧 production 入口的调用：`chrome-v2-px-workspace-router.mjs --production`、`generate-v2-external-brain-productization-report.mjs`、`validate-v2-external-brain-production-evidence.mjs`。
3. 任何修改 Runtime / API / 前端产品行为、63 RuleId / 109 requirement 或 G1-G7 分母（08 §8 L107-110）。
4. 任何修改 sealed raw / 原位追加 / 跨 run 拼接（08 §8 L110）。
5. 任何 generator 写入 sealed raw 或代签 Human Review（08 §8 L110 + T03-A10 L19）。
6. 任何把 `contract_fixture` 或 `virtual/*` 提升为 PX-5 production acceptance（14 §2 L77 `PX_FIXTURE_EVIDENCE_PROMOTION_INVALID`）。
7. 任何在 diagnostic 之后继续生成带默认事实的成功 package（10 §1 L28）。
8. 任何把 `not_applicable` 用作跳过规则的手段（10 §4 / §7 + T03-A04）。
9. 任何把 `...T053100` 当作 sourceRunId 输入（07 L19 + §6）。
10. 任何把本审查报告复制到 `independent-preimplementation-audit.md` 之外的路径或修改仓库文件——本报告仅在本 chat 内联交付。

---

## 16. 门禁结论（最终）

```text
T03 independent preimplementation review: PASS（Fatal 0 / Major 0 / Minor 3 继承上游）
T03 implementation: CONDITIONAL GO
T04 / PX-6 / RKM: BLOCKED（保持）
PX-5: FAIL / REOPENED（保持）
```

**放行范围**：**仅** T03 R3 共享语义校验 + AST 校验 + 纯报告生成的实质实现；候选阶段的 `production_candidate` 出门证据允许生成，但 `production_final` 必须等到 T04 真实重跑 + 真实 Human Review + Axe 全页命中后另案审批。

**关于 `independent-preimplementation-audit.md`**：用户明确「不要自行落盘」，故本审查报告**未**写入 `docs/active/project/evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/independent-preimplementation-audit.md`。后续若用户授权另开只读落盘会话，可按本内联报告一字一句落盘即可，hash 取决于是否含时间戳等元字段。
