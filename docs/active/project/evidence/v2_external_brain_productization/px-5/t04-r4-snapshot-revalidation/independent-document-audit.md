# T04 R4 实施前独立文档审查

日期：2026-09-14
审查者：本会话（独立只外部审查者）
审查范围：`docs/active/project/external-audit-package/` 19 载荷 + 1 manifest = 20 平铺文件
审查对象：T04 R4 文档、架构、机器合同与实现准备度
约束：未运行产品代码、Runtime、Chrome、旧 generator / validator；未改动主工作树任何文件。

---

## 0. 摘要

```text
Fatal = 0
Major = 0
Minor = 4

T04 documentation: CONDITIONAL GO
T04 implementation: NO-GO pending explicit user approval
```

19 项 payload SHA-256 与清单自报哈希逐字节相等；19 项权威源字节与 staged 文件逐一 byte-equal，0 mismatch。
三份 Draft 2020-12 Schema 元校验全部 PASS；正例 PASS；缺根 required 字段、错误的 sealedRawRun hash、错误的 sourceSnapshotCommit、错误的 externalDocumentAudit path、错误的 `externalDocumentAuditFatal/Major`、`signingAllowed=true`、错误的 `signed`、`finalPassed=true`、`humanReviewStatus=passed`、`g7Status=passed`、wrong publicArchivePolicy 等关键 const 字段变更均被 Schema 拒绝。
A01..A14、N001..N025 集合在 `12-t04-acceptance-plan.md`、`13-t04-snapshot-contract.md`、`18-snapshot-revalidation.schema.json` 三处完全一致。22 个失败码在三处逐字一致。
Drawio 8 页，每页 1600x900，无 broken edge reference，无真实重复 ID（仅 `mxGraphModel/root` 约定的 `id=0` `id=1` 在每页出现）。
R4-P frozen-input deterministic replay 与 R4-E fresh real-Chrome 两泳道职责分离，不可拼接；`freshLanePolicy.crossRunReuseAllowed=false`。
Human Review / G7 / final / signingAllowed / nextSigningStage 在所有边界都锁定 pending / pending / false / false / PX-6。

---

## 1. 审查范围与复现方法

### 1.1 阅读顺序

按 `AUDIT_MANIFEST.md` §1 阅读顺序执行：

1. `01-audit-request.md` 获取决策范围与输出位置
2. `02-prd.md`（PRD 17.1/17.3 段）、`03-architecture.md`（§21.1/§21.3 段）、`04-stage-gate.md`（PX-5 修复子阶段状态段）确认范围与阶段状态
3. `05-gap-companion.md` 与 `06-gap.drawio` 检查图文、架构实体、里程碑和出门门槛一致性
4. `07-t03-independent-exit-audit.md`、`08-t03-audit-disposition.md`、`09-t03-orchestration-source-chain.md` 确认 T03 LIMITED PASS、五项 Minor 处置、四步来源链
5. `10-t04-prd-architecture-scope.md`、`11-t04-development-plan.md`、`12-t04-acceptance-plan.md`、`13-t04-snapshot-contract.md`、`14-t04-risk-adr.md`、`15-t04-preimplementation-audit.md`、`16-t04-document-verification.md` 审查 T04 双泳道、开发/验收、合同、风险和内部复算
6. `17-snapshot-input-manifest.schema.json`、`18-snapshot-revalidation.schema.json`、`19-exit-manifest.schema.json` 执行 Draft 2020-12 元校验、根正例、缺根 required 负例、关键 const 字段变异拒绝

### 1.2 复现方法

```text
# 1) 复算 19 项 payload SHA-256
cd /mnt/c/workspace/navia/docs/active/project/external-audit-package
sha256sum 01-audit-request.md 02-prd.md 03-architecture.md 04-stage-gate.md \
  05-gap-companion.md 06-gap.drawio 07-t03-independent-exit-audit.md \
  08-t03-audit-disposition.md 09-t03-orchestration-source-chain.md \
  10-t04-prd-architecture-scope.md 11-t04-development-plan.md \
  12-t04-acceptance-plan.md 13-t04-snapshot-contract.md 14-t04-risk-adr.md \
  15-t04-preimplementation-audit.md 16-t04-document-verification.md \
  17-snapshot-input-manifest.schema.json 18-snapshot-revalidation.schema.json \
  19-exit-manifest.schema.json

# 2) 复算 19 项权威源 SHA-256（从仓库其他位置）
cd /mnt/c/workspace/navia
sha256sum docs/active/project/01-prd.md docs/active/project/02-architecture.md \
  docs/active/project/stage-gates/v2-external-brain-productization.md \
  docs/active/project/design/v2-memory-personal-knowledge-base-gap.md \
  docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio \
  docs/active/project/evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/independent-implementation-exit-audit.md \
  docs/active/project/evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/independent-implementation-audit-disposition.md \
  docs/active/project/evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/orchestration-evidence-source-chain.md \
  docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/external-document-audit-request.md \
  docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/prd-architecture-scope.md \
  docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/development-plan.md \
  docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/acceptance-plan.md \
  docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/snapshot-revalidation-contract.md \
  docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/risk-adr.md \
  docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/preimplementation-audit.md \
  docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/document-verification.md \
  docs/active/project/contracts/v2_px_snapshot_input_manifest.schema.json \
  docs/active/project/contracts/v2_px_snapshot_revalidation.schema.json \
  docs/active/project/contracts/v2_px_exit_manifest.schema.json

# 3) 三份 Schema Draft 2020-12 元校验 + 正例 + required 字段删除拒绝
python3 -c "from jsonschema import Draft202012Validator, FormatChecker; import json; \
  Draft202012Validator.check_schema(json.load(open('docs/active/project/external-audit-package/17-snapshot-input-manifest.schema.json'))); \
  Draft202012Validator.check_schema(json.load(open('docs/active/project/external-audit-package/18-snapshot-revalidation.schema.json'))); \
  Draft202012Validator.check_schema(json.load(open('docs/active/project/external-audit-package/19-exit-manifest.schema.json')))"

# 4) Drawio 8 页 / 边界 / 引用
python3 -c "import xml.etree.ElementTree as ET; root = ET.fromstring(open('docs/active/project/external-audit-package/06-gap.drawio').read()); print(len(root.findall('diagram')))"

# 5) A01..A14 / N001..N025 覆盖与三文档一致性
python3 (negative registry + failure code 集合交叉比对脚本，见第 6 节)
```

---

## 2. 载荷完整性：19 项 SHA-256 独立复算

### 2.1 计算结果

19 项 staged payload 哈希与 `AUDIT_MANIFEST.md` 自报哈希逐字节相等（diff exit 0）。

19 项权威源字节与 staged 文件 SHA-256 一一相等（0 mismatch）。

### 2.2 关键文件 hash 对账

| # | staged 文件 | staged hash | 权威源 hash | 一致 |
|---:|---|---|---|---|
| 01 | `01-audit-request.md` | `152486c899653168e98e341c9d86806c4768ddadb2cd6198e72c9b0a08152cdc` | 同 | ✓ |
| 02 | `02-prd.md` | `99ead506c373d2c1ef3ad83a3756ecc7a459272f7d24a63545f17729e51e5e19` | 同 | ✓ |
| 03 | `03-architecture.md` | `393c1d93025448d927559d6db078532f2fe4e6c949aea137c2e1758de0806969` | 同 | ✓ |
| 04 | `04-stage-gate.md` | `077946821c331aea80db90abef51fedbeba0584364f9fcfe2f7185c654754a5b` | 同 | ✓ |
| 05 | `05-gap-companion.md` | `79f6a842d2474ee0c4e221407c2822666f2efe0abcd13a3c04b382dba1da4256` | 同 | ✓ |
| 06 | `06-gap.drawio` | `50ce1f0d08dea416072f6c0b11f75c432f8a98cc13805285c50258cfacf813a9` | 同 | ✓ |
| 07 | `07-t03-independent-exit-audit.md` | `1d6d5cbf82e90410497601c0e0eb30fc66e2c3e88624bbaf0b1911e241f7ad71` | 同 | ✓ |
| 08 | `08-t03-audit-disposition.md` | `53ad454ff61ca11557116379bbd053f0145436737f2608f461621a9c75ea1ac4` | 同 | ✓ |
| 09 | `09-t03-orchestration-source-chain.md` | `0d294e5330479d9d25c1835895b870c8401106225863b2781bbfbce14c84c690` | 同 | ✓ |
| 10 | `10-t04-prd-architecture-scope.md` | `71bad913ab6c3030f7b9a11f1e860b5347217a1a41c390a692a07e13baee3fa2` | 同 | ✓ |
| 11 | `11-t04-development-plan.md` | `5de78c5fed32d27e5d0b8bdedd1864de9f10c9e1371c7433419c6184b1554832` | 同 | ✓ |
| 12 | `12-t04-acceptance-plan.md` | `cdd5c7e12e1ed1a74a2cec9de74175b7eb3f591e8dbcfde4c1af978e8438fbd3` | 同 | ✓ |
| 13 | `13-t04-snapshot-contract.md` | `624d8525cb10117e8f5a32b307201dc6ca3db6c5d8c331d22fe27d265cfc7c22` | 同 | ✓ |
| 14 | `14-t04-risk-adr.md` | `2611a17735199b35335acfcc181854f7025c106a2cf949414eebbf684f70f99b` | 同 | ✓ |
| 15 | `15-t04-preimplementation-audit.md` | `427cd57ec4b7c98314fb0cb16f5dc9c9208681bd50cce0cd9a5ac27e8de1570b` | 同 | ✓ |
| 16 | `16-t04-document-verification.md` | `7777587fe3a95ce7a83a91d968f6440bbdf29ab535b23ff765b7ba3f0370d842` | 同 | ✓ |
| 17 | `17-snapshot-input-manifest.schema.json` | `22359f1ea7ee7e819ab38b5054398c96b8ef445ce9b4cd8b84d3449fedb1a570` | 同 | ✓ |
| 18 | `18-snapshot-revalidation.schema.json` | `e9376298a26fb9a27cc61ba0731b1bcdb819d1a6e75609f916c88a4cbe930461` | 同 | ✓ |
| 19 | `19-exit-manifest.schema.json` | `ce3a00c5dfd48b1e2a15f9d34fbe457143fcda8c7bdfa5248c8fd9fce28c18e1` | 同 | ✓ |

---

## 3. PRD / 架构 / Stage Gate 一致性

### 3.1 PRD 不新增产品能力、不修改 P0-P6、不前移 RKM

`02-prd.md` §17.1 `V2-PX External Brain Productization` 明确：

- V2-PX 不新增用户功能
- V2-PX 不引入 RAG、长期记忆、自动化遗忘、可逆维护
- 后续 `KM-0..KM-7` 不属于 PX；RKM 单独 stage gate

`03-architecture.md` §21.1 `V2-PX External Brain Productization 目标架构` 明确：

- T04 不改变 P0-P6 调用链
- T04 SnapshotBuilder / Comparator / Revalidation / ExitManifest 只新增 P7 快照复验证据实体
- PX-6 之后才进入人工体验核查

`04-stage-gate.md` 当前 PX-5 修复子阶段状态：

- T01/T02/T02.1/T02.2 各自限定 PASS
- T02.3 REJECTED AS T03 POSITIVE BASE
- T02.4 FAIL-CLOSED REGRESSION INPUT
- T02.5 PASS（唯一 production-positive R2 input）
- T03 LIMITED PASS，Human Review pending / G7 pending / final=false
- T04 DOCUMENT CANDIDATE，外部文档审查与用户实现授权前 NO-GO
- PX-5 FAIL / REOPENED；PX-6 BLOCKED

→ 一致性：T04 范围严格不扩大 PRD、不修改 P0-P6、不前移 RKM。

### 3.2 T04 双泳道与 product base commit

`10-t04-prd-architecture-scope.md` §2 明确 R4-P 与 R4-E：

- R4-P 固定输入：`sourceRunId=t02-r2-t01-structured-production-input-20260914T125700`、`rawSha256=ce272df…5f0c3`、`sealSha256=fed6155…1b70f`、`baselineValidationRunId=t03-r3-production-exit-candidate-20260914T134804`
- 旧候选 `…T132413` 仅允许作为 stale-candidate 负例
- R4-E 不复用 R4-P 或 T02.5 的 scenario、source、截图、Axe、Keyboard、fault、DerivedFacts、Validation、Report 或 Package

→ 一致性：与 `13-t04-snapshot-contract.md` §3.1 / `18-snapshot-revalidation.schema.json` `replayLane.baselineValidationRunId`、`freshLane.sourceRunId` pattern (`^t04-r4-fresh-raw-`) 一致。

### 3.3 复现 hash 在 package 内文档中的覆盖

| 文档 | T02.5 raw | T02.5 seal | 430cdd... commit |
|---|---|---|---|
| 01-audit-request.md | ✓ | ✓ | ✓ |
| 04-stage-gate.md | ✗（无 raw 字节复算要求） | ✗ | ✗ |
| 08-t03-audit-disposition.md | ✗ | ✗ | ✗ |
| 09-t03-orchestration-source-chain.md | ✗ | ✗ | ✗ |
| 10-t04-prd-architecture-scope.md | ✓ | ✓ | ✓ |
| 11-t04-development-plan.md | ✗ | ✗ | ✗ |
| 12-t04-acceptance-plan.md | ✗ | ✗ | ✗ |
| 13-t04-snapshot-contract.md | ✗ | ✗ | ✓ |
| 16-t04-document-verification.md | ✓ | ✓ | ✓ |
| 17-snapshot-input-manifest.schema.json | ✗ | ✓ | ✓ |

→ 一致性：raw/seal/commit hash 在需要的位置出现。`08`、`09`、`11`、`12` 按各自职能不重复列出原始 hash，是合理的文档层级分工。

---

## 4. T03 独立证据链

### 4.1 LIMITED PASS

`07-t03-independent-exit-audit.md` SHA-256 `1d6d5cbf82e90410497601c0e0eb30fc66e2c3e88624bbaf0b1911e241f7ad71`：

- 19 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 逐字节相等（独立复算）
- 16/16 本地 verifier 机器检查独立复算通过
- 63 RuleId = 41 semantic + 22 schema 严格映射 G1-G7
- 109 contract fixtures + 42 production mutations + 204 status observations 全过
- T02.5 raw / seal 字节恒等；T02.4 负路径只产生 T03-IN-11 diagnostic 并 exit 2
- G1-G6 passed；G7 pending；Human Review pending；final=false；claim not-passed

### 4.2 五项 Minor 处置

`08-t03-audit-disposition.md` 锁定五项 Minor 关闭位置：

| ID | 处置摘要 | 关闭位置 |
|---|---|---|
| M-1 | 旧候选 `132413` 仅作 stale-candidate 负例；与 `134804` 不参与同一分母 | acceptance-plan.md §6；T04 snapshot-revalidation-contract.md |
| M-2 | `symlinkPolicy` 唯一合法值冻结为 `hash_link_target_utf8` | validation-profile-contract.md §11 |
| M-3 | T03 production 编排严格 `derive -> validate -> report -> package` 四步；T04 必须在隔离快照实际重放 | orchestration-evidence-source-chain.md；T04 A04 |
| M-4 | session/prompt hash 只能证明输入不同；T04 实现出门要求另一 reviewer session；PX-6 要求真实人类签署 | T04 risk-adr.md；A14 |
| M-5 | T04 PRD 边界、架构、开发顺序、14 项分母、合同和风险已形成独立文档候选 | ../t04-r4-snapshot-revalidation/ |

→ 一致性：五项 Minor 处置均有明确不可追写旧证据的关闭位置。

### 4.3 四步来源链

`09-t03-orchestration-source-chain.md` 固定 T03 production orchestrator 四步闭合：derive -> validate -> report -> package。T04 必须在隔离快照实际重放，不得复算旧日志冒充隔离重放。

→ 一致性：与 `13-t04-snapshot-contract.md` §3.1 `stepResults` Schema const `derive/validate/report/package` 顺序、`15-t04-preimplementation-audit.md` §3.2 第五条款 一致。

---

## 5. Drawio 8 页结构与引用

`06-gap.drawio` 文件 SHA-256 `50ce1f0d08dea416072f6c0b11f75c432f8a98cc13805285c50258cfacf813a9`。

| 页 | id | 名称 | 审查重点 |
|---:|---|---|---|
| 01 | v2p-01 | 01 用户入口与双容器目标体验 | 当前真实入口、目标入口、两个容器不是同时显示 |
| 02 | v2p-02 | 02 当前架构与目标架构差异 | 当前代码、未实现 Gap、目标新增文件与调用关系 |
| 03 | v2p-03 | 03 用户入口、路由与状态交接 | 三个入口、background action、目标 URL 和 ID 交接 |
| 04 | v2p-04 | 04 保存、构建与遗忘生命周期 | 单次保存自动推进、异常恢复、Forget 四面验证 |
| 05 | v2p-05 | 05 双容器共享架构与服务状态 | 共享 Runtime / Adapter、四个状态数据、data_service 边界 |
| 06 | v2p-06 | 06 V2-PX 产品化开发计划与里程碑 | PX-0..PX-6、目标体验与停止条件 |
| 07 | v2p-07 | 07 自动化与人工验收计划 | 真实 Chrome 路径、证据要求和人工产品体验 |
| 08 | v2p-08 | 08 验收门槛、出门条件与声明 | 六类 Gate、拒绝条件和声明边界 |

### 5.1 边界 / 引用验证

- 8 页全部 1600x900 ✓
- 156 个 vertices（按 cell id 唯一计数）
- 42 个 edges
- 14 处重复 cell id：均为 `mxGraphModel/root` 约定的 `id=0`、`id=1`（每页固定 root/parent cell），属 mxGraph 规范，并非真实重复
- 排除约定根 ID `0` `1` 后真实重复 ID：0
- 0 处 broken edge reference（所有 `source`/`target` 指向同页 vertex ID）

### 5.2 必含关键词

- `R4-P`：✓（多页）
- `R4-E`：✓（多页）
- `A01-A14`：✓（page 08 "T04 证据 Gate A01-A14 + N001-N025"）
- `N001-N025`：✓（同上）
- `unsigned`：✓（page 08 "ExitManifest unsigned"）
- `ExitManifest`：✓（page 08）
- `G7`：✓（page 08 "G7 pending"）
- `final=false`：✓（page 08 "G1-G6 passed、G7 pending、final=false"）
- `外部文档审查`：✓（page 08 "外审+实施授权写入 governance"）
- `NO-GO`：✓（page 06 T04 文档候选）
- `BLOCKED`：✓（page 06 "PX-6 BLOCKED"）
- `FAIL`：✓（page 06 "PX-5 FAIL"）

→ 一致性：Drawio 8 页结构合规，引用闭合，必含关键词齐全。

---

## 6. 三份 Draft 2020-12 Schema 校验

### 6.1 元校验

```text
17-snapshot-input-manifest.schema.json: meta PASS
18-snapshot-revalidation.schema.json:   meta PASS
19-exit-manifest.schema.json:           meta PASS
```

### 6.2 17-snapshot-input-manifest.schema.json

| 测试 | 结果 |
|---|---|
| 12/12 required 字段全部单独删除均被拒绝 | PASS |
| 正例（构造完整根对象） | 0 errors |
| 空 `forbiddenCandidateIds` | rejected（1 error） |
| 错误 `sealSha256`（非 `fed6155a…1b70f`） | rejected（1 error） |
| 错误 `baseCommit`（非 `430cdd…0d36`） | rejected（1 error） |
| 错误 `externalDocumentAudit.path` | rejected（1 error） |
| `externalDocumentAuditFatal=1` | rejected（1 error） |
| `humanBoundary.signingAllowed=true` | rejected（1 error） |
| `externalDocumentAuditMajor=1` | rejected（1 error） |

→ 一致性：所有关键 const 字段强制保证 T03 baseline、T02.5 seal/commit、T04 文档审查 Fatal/Major=0、Human Review 边界不被静默篡改。

### 6.3 18-snapshot-revalidation.schema.json

| 测试 | 结果 |
|---|---|
| 14/14 A01..A14 集合（schema 内 `containsT04Axx` 闭包） | PASS（14/14 覆盖） |
| 25/25 N001..N025 集合（schema 内 `containsT04N0xx` 闭包） | PASS（25/25 覆盖） |
| 22 个失败码与 acceptance-plan.md 第 4 节逐字相等 | PASS（`set` diff = `{}`） |
| 22 个失败码与 snapshot-contract.md 第 5 节逐字相等 | PASS（`set` diff = `{}`） |
| 25 个 requirementKey 与 acceptance-plan.md 第 4 节逐字相等 | PASS（0 mismatch） |
| 正例（构造完整根对象） | 0 errors |
| `replayLane.stepResults` 顺序错乱（validate/derive/report/package） | rejected（2 errors） |
| `machinePassed=false` | rejected（1 error） |
| `finalPassed=true` | rejected（1 error） |
| `humanReviewStatus=passed` | rejected（1 error） |
| `exactComparisons[0].algorithm=canonical_json_remove_registered_pointers_v1` | rejected（1 error） |
| `exactComparisons[0].equal=false` | rejected（1 error） |
| `normalizedComparisons[0].ignoredJsonPointers` 加入 `/anything` 拓宽白名单 | rejected（4 errors） |
| `normalizedComparisons[0].ignoredJsonPointers=[/time]` | rejected（2 errors） |
| `negativeResults[0].observedPrimaryFailure` 与 `expectedPrimaryFailure` 不一致 | rejected（1 error） |
| `ruleCounts.machinePassed=60` | rejected（1 error） |
| `contractCases.passed=100` | rejected（1 error） |
| `gateResults.G7=passed` | rejected（1 error） |

→ 一致性：A01..A14、N001..N025 与失败码三处文档完全一致；所有机器边界、G1-G6 passed / G7 pending、归一化白名单 `/recordedAt`、rule/contract 计数、负例 observed 与 expected failure 一致性均由 Schema 强制闭合。

### 6.4 19-exit-manifest.schema.json

| 测试 | 结果 |
|---|---|
| 正例 | 0 errors |
| `signed=true` | rejected（1 error） |
| `finalPassed=true` | rejected（1 error） |
| `humanReviewStatus=passed` | rejected（1 error） |
| `g7Status=passed` | rejected（1 error） |
| `publicArchivePolicy=anything_else` | rejected（1 error） |

→ 一致性：ExitManifest 严格 closed：`signed=false`、`finalPassed=false`、`humanReviewStatus=pending`、`g7Status=pending`、唯一 `publicArchivePolicy=payload_only_excludes_exit_manifest_and_independent_audit`、唯一 claim 含 `Human Review, G7, PX-5 final disposition and PX-6 remain pending`。

---

## 7. T04-A01..A14 逐项判定

参考 `12-t04-acceptance-plan.md` §1 与 `13-t04-snapshot-contract.md` §3。

| ID | 要求 | 文档是否足以机器重算 | 风险点 | 判定 |
|---|---|---|---|---|
| A01 | SnapshotInputManifest 可重算：product base、T02.5 raw/seal、T03 candidate 134804、审计 hash、T04 local acceptance commit、tree/index/toolchain；旧 132413 明确拒绝 | 是（17-Input 必填字段 + forbiddenCandidateIds const + 三处 ArtifactRef） | 低 | PASS |
| A02 | 完整依赖闭包：`missingEdges=0`、`undeclaredReads=0`、`unexpectedFiles=0` | 是（17-Input `dependencyClosure.missingEdges/undeclaredReads/unexpectedFiles: maxItems=0` + `N-001/N-002/N-003` 失败码） | 低 | PASS |
| A03 | detached snapshot 可从空目录重建；产品路径与 T02.5 byte-equal | 是（17-Input `snapshot.workingTreePolicy=detached_local_commit_main_tree_read_only` + `mainStateAlgorithm=git_status_porcelain_v2_z_sha256_v1` + `mainHeadBefore==mainHeadAfter`） | 低 | PASS |
| A04 | R4-P 实际执行四步 exitCode 全 0；十项 deterministic artifact byte-equal；InvocationRecord 仅 `/recordedAt` 可归一化 | 是（18-Revalidation `replayLane.stepResults` const 顺序 + 10 个 `exactComparison` 闭包 + 1 个 `normalizedInvocation` 闭包 `[/recordedAt]`） | 低 | PASS |
| A05 | R4-E 全新 build/profile/Runtime/database/run/output；不引用 T02.5/R4-P artifact | 是（17-Input `freshLanePolicy.crossRunReuseAllowed=false` + `N-013/T04_CROSS_RUN_EVIDENCE_MIXED`） | 低 | PASS |
| A06 | R4-E 满足 T02 固定 12 项及 production-positive 分母：6+3+3 source、三入口、5x4 route、2 recovery、3x4 Forget、四 fault、四 viewport、Axe 0/0、Keyboard 5/5、T01 36/36、0 orphan | 是（18-Revalidation `freshLane` 强制 12 个 `t02AcceptanceResults` 闭包 + 14 个 `t03AcceptanceResults` 闭包 + `sourceCorpus=6/3/3/12` + `routeMatrix=5/4/20` + `forgetRecovery=3/4/12/12/12` + `axe=0/0` + `keyboard=5/5` const） | 低 | PASS |
| A07 | 只以 R4-E 新 raw 完整执行 T03-A01..A14；每项有独立结果，无 N/A，不从 T02.5 或 R4-P 借分母 | 是（18-Revalidation `freshLane.t03AcceptanceResults` 14 ID 闭包 + A05 隔离） | 低 | PASS |
| A08 | R4-E candidate 63 RuleId、109 contract cases、42 production mutations、204 或新 raw 重算的完整 Status 分母；G4 读取本 T04 commit Git blob 并执行 AST | 是（18-Revalidation `ruleCounts=63/61/2/0/0`、`contractCases=109/109`、`productionMutations=42/42` const + `N-016/N-017` 防假绿） | 低 | PASS |
| A09 | R4-P byte comparison 与 R4-E semantic invariant comparison 分开建模；动态 runId/time/requestId 不得加入 byte-equal 白名单，R4-E 只按正式合同和分母重算 | 是（17-Input `normalizedArtifacts.ignoredJsonPointers=[/recordedAt]` 唯一闭包 + A04 强制比较算法） | 低 | PASS |
| A10 | T04-N-001..025 全部从各自 valid base 单独变异并命中登记 primary failure；不能只改 Report、result 或 passed 字段 | 是（18-Revalidation `negativeResults` 25 个 `containsT04Nxxx` 闭包强制 `requirementId/key/expectedPrimaryFailure/observedPrimaryFailure` 四字段对齐） | 低 | PASS |
| A11 | 两泳道各自单 run、单 seal、单因果链；最终 R4 production candidate 只引用 R4-E，新旧 run/candidate/泳道交叉引用数为 0 | 是（17-Input `freshLanePolicy.crossRunReuseAllowed=false` + `N-013` + `N-014` fresh_raw 独立 seal） | 低 | PASS |
| A12 | SnapshotRevalidation / ExitManifest / 中文 HTML / Drawio / 命令日志 / 测试 / 审计 全部可重算；`publicArchivePolicy=payload_only_excludes_exit_manifest_and_independent_audit` 与 tar member index 一致；public secret/private-path scan 0 | 是（19-Exit 强制 `publicArchivePolicy` const + `N-018/T04_PUBLIC_EVIDENCE_LEAK` + `N-024/T04_EXIT_MANIFEST_INVALID` 强制真实 tar member index 重算） | 低 | PASS |
| A13 | frontend full / typecheck / build / Runtime V2 / T01 real Chrome / collector / T03 node/contract/mutation/orchestrator / R4 tests 全部从隔离 snapshot 实跑并保存原始 exitCode/stdout/stderr | 是（18-Revalidation `stepResults` 强制四步骤 `stdout/stderr` ArtifactRef + `actualInvocation` 必填） | 低 | PASS |
| A14 | PRD / 架构 / Drawio / false-green 实现方检视无范围扩大；文档外审已通过且其 hash 被绑定；Human Review/G7/final 保持 pending/pending/false；实现方两轮内部审计 Fatal 0/Major 0 | 是（17-Input `governance.externalDocumentAudit` 固定 + `externalDocumentAuditFatal/Major=0` const + `humanBoundary` 五字段 const + 15 §3.1-3.3 内部审计结论 Fatal 0/Major 0/Minor 1） | 低 | PASS |

→ 一致性：A01..A14 全部有显式机器边界强制保证；无 N/A、无只信输出自报。

---

## 8. T04-N-001..025 逐项判定

参考 `12-t04-acceptance-plan.md` §4 与 `18-snapshot-revalidation.schema.json` `x-navia-requirement-registry`。

25 条 requirement 与 schema 中 25 个 `containsT04Nxxx` 闭包、22 个失败码 registry 逐字一致。

| ID | requirementKey | primary failure | 文档与 Schema 行为 | 原始输入 mutation 性质 | 判定 |
|---|---|---|---|---|---|
| N-001 | dependency_closure_missing_relative_import | T04_DEPENDENCY_CLOSURE_INVALID | Schema `dependencyClosure.missingEdges: maxItems=0` | 必触发（relative import 缺失） | PASS |
| N-002 | dependency_file_hash_mismatch | T04_DEPENDENCY_CLOSURE_INVALID | Schema `dependencyClosure.files.sha256` 由 semantic runner 重算 | 必触发（declaredfile byte 漂移） | PASS |
| N-003 | lockfile_or_toolchain_unbound | T04_ENVIRONMENT_NOT_REPRODUCIBLE | Schema `environment.packageLock/runtimeLockedRequirements` 必填 ArtifactRef | 必触发（lockfile 漂移） | PASS |
| N-004 | product_snapshot_path_drift | T04_PRODUCT_SNAPSHOT_DRIFT | Schema `snapshot.baseCommit=430cdd...` const + path byte-equality | 必触发（product path byte drift） | PASS |
| N-005 | stale_t03_candidate_selected | T04_BASELINE_CANDIDATE_INVALID | Schema `baseline.t03ValidationRunId=...134804` const + `forbiddenCandidateIds=[...132413]` | 必触发（选择旧 132413） | PASS |
| N-006 | sealed_t02_input_modified | T04_BASELINE_INPUT_MODIFIED | Schema `sealSha256=fed6155a...1b70f` const + raw byte-equality | 必触发（修改 T02.5 sealed raw） | PASS |
| N-007 | main_worktree_used_as_runtime_source | T04_ISOLATION_BOUNDARY_FAILED | Schema `snapshot.workingTreePolicy=detached_local_commit_main_tree_read_only` const + `mainHeadBefore==mainHeadAfter` | 必触发（从主工作树读取） | PASS |
| N-008 | nonempty_or_overwritten_replay_output | T04_OUTPUT_IMMUTABILITY_FAILED | Schema `replayPolicy.outputRoot=fresh_empty_isolated_namespace` const + replayValidationRunId=baseline_same_id_isolated_root | 必触发（输出覆盖 baseline） | PASS |
| N-009 | deterministic_artifact_byte_mismatch | T04_REPLAY_MISMATCH | Schema `exactComparisons.equal=true` const + 10 个路径闭包 | 必触发（byte 漂移） | PASS |
| N-010 | invocation_normalization_pointer_widened | T04_REPLAY_NORMALIZATION_INVALID | Schema `normalizedArtifacts.ignoredJsonPointers=[/recordedAt]` 闭包 | 必触发（白名单扩大） | PASS |
| N-011 | replay_step_not_actually_executed | T04_INVOCATION_EVIDENCE_INVALID | Schema `stepResults.exitCode=0`、`invoked=true` const + stdout/stderr ArtifactRef | 必触发（仅自报 exitCode=0） | PASS |
| N-012 | fresh_chrome_lane_missing | T04_FRESH_E2E_REQUIRED | Schema `freshLanePolicy.newRunRequired=true` const | 必触发（缺 R4-E） | PASS |
| N-013 | fresh_lane_reuses_baseline_artifact | T04_CROSS_RUN_EVIDENCE_MIXED | Schema `freshLanePolicy.crossRunReuseAllowed=false` const + inode/path/hash 隔离 | 必触发（跨 run 复用 artifact） | PASS |
| N-014 | fresh_raw_not_independently_sealed | T04_FRESH_RAW_INVALID | Schema `freshLane.sealedRawRun` ArtifactRef + sealSha256 重算 | 必触发（缺独立 seal） | PASS |
| N-015 | inherited_t03_denominator_missing | T04_T03_REGRESSION_FAILED | Schema `freshLane.t03AcceptanceResults` 14 ID 闭包 | 必触发（分母缩减） | PASS |
| N-016 | rule_fixture_mutation_count_reduced | T04_VALIDATION_DENOMINATOR_MISMATCH | Schema `ruleCounts` 与 `contractCases`/`productionMutations` const | 必触发（计数缩减） | PASS |
| N-017 | architecture_scan_trusts_report | T04_ARCHITECTURE_REPLAY_FAILED | Schema `architectureResult` 必须由 R4-E 重算，禁止自报 `violations=0` | 必触发（G4 信任 Report） | PASS |
| N-018 | private_or_secret_bytes_in_public_package | T04_PUBLIC_EVIDENCE_LEAK | Schema `publicArchivePolicy` const + tar member index 重算 | 必触发（private/secret 字节进入 public） | PASS |
| N-019 | exit_manifest_artifact_hash_mismatch | T04_EXIT_MANIFEST_INVALID | Schema `contentSha256` 对排除 `contentSha256` 后的 canonical JSON 计算 + 必填 ArtifactRef | 必触发（hash 漂移） | PASS |
| N-020 | human_review_auto_signed | T04_HUMAN_BOUNDARY_VIOLATION | Schema 19-Exit `signed=false` const；17-Input `signingAllowed=false` const | 必触发（自动签 Human） | PASS |
| N-021 | g7_or_final_promoted | T04_CLAIM_OVERREACH | Schema 18-Revalidation `gates.G7=pending`、`finalPassed=false`；19-Exit `finalPassed=false` const | 必触发（G7/final=true） | PASS |
| N-022 | legacy_generator_or_validator_used | T04_LEGACY_PIPELINE_FORBIDDEN | Schema 不提供 legacy pipeline 入口；T04 仅用 `node <entrypoint>` direct argv（ADR-8） | 必触发（使用旧 generator/validator） | PASS |
| N-023 | comparison_artifact_path_identity_mismatch | T04_REPLAY_MISMATCH | Schema `comparison.path == baseline.path == replay.path` 由 semantic runner 重算；`equal=true` 只是输出 | 必触发（comparison/baseline/replay path 身份不一致） | PASS |
| N-024 | public_archive_membership_policy_mismatch | T04_EXIT_MANIFEST_INVALID | Schema `publicArchivePolicy` const + 真实 tar member index 必须不包含 exit-manifest 或后续独立审计 | 必触发（tar member index 包含 ExitManifest） | PASS |
| N-025 | authorization_record_or_audit_binding_mismatch | T04_INDEPENDENT_AUDIT_REQUIRED | Schema `authorizationRecord` 必填字段（`userInstructionSha256`/`externalDocumentAuditSha256`/`approvedScope`）+ governance ArtifactRef 固定路径 | 必触发（授权 hash 不一致） | PASS |

→ 一致性：25 个负例均以原始输入 mutation 触发登记 primary failure，未发现只信输出自报或只改 result/passed 字段的旁路。N-023 / N-024 / N-025 三个新增语义明确证明 validator 会读取原始引用、归档成员和治理记录。

---

## 9. R4-P / R4-E 隔离、授权时序、Human/G7/final 边界

### 9.1 R4-P / R4-E 职责分离、不可拼接

- `10-t04-prd-architecture-scope.md` §2 R4-P：冻结输入确定性重放（`sourceRunId`、`rawSha256`、`sealSha256`、`baselineValidationRunId` 全部 const）；R4-E：全新 build/profile/Runtime/database/run/output。
- `10-t04-prd-architecture-scope.md` §2 明确：R4-E 不复用 R4-P 或 T02.5 的 scenario、source、截图、Axe、Keyboard、fault、DerivedFacts、Validation、Report 或 Package。
- `14-t04-risk-adr.md` ADR-5：R4-E 是最终 R4 candidate 的唯一事实来源；ExitManifest 可引用 R4-P comparison，但不得借用 R4-E 分母。
- `17-Input.freshLanePolicy.crossRunReuseAllowed=false` Schema const 强制。

→ 一致性：两泳道职责分离，Schema 强制不可拼接。

### 9.2 授权时序（governance）

- `17-Input.governance` 必填：
  - `externalDocumentAudit` ArtifactRef 路径固定为 `docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/independent-document-audit.md`
  - `implementationAuthorization` ArtifactRef 路径固定为 `docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/implementation-authorization.json`
  - `externalDocumentAuditFatal=0`、`externalDocumentAuditMajor=0` const
  - `approvedScope=T04-0..T04-7 implementation` const
- `17-Input.authorizationRecord` 必填：schemaVersion、stage、decision、approvedScope、userInstructionText、userInstructionSha256、externalDocumentAuditSha256、authorizedAt、recordedBy。

→ 一致性：实施授权不能绕过本次外审；外审通过后用户必须再生成 `implementation-authorization.json` 才能启动 T04-0；`approvedScope` const 防止扩大为其他范围。

### 9.3 Human Review / G7 / final / signed 边界

- `17-Input.humanBoundary` 五字段 const：`humanReviewStatus=pending`、`g7Status=pending`、`finalPassed=false`、`signingAllowed=false`、`nextSigningStage=PX-6`。
- `18-Revalidation.gates.G7=pending` const。
- `18-Revalidation.machinePassed=true`、`humanReviewStatus=pending`、`finalPassed=false` const。
- `19-Exit.signed=false`、`humanReviewStatus=pending`、`g7Status=pending`、`finalPassed=false` const。
- `19-Exit.claim` const 包含 `Human Review, G7, PX-5 final disposition and PX-6 remain pending`。
- `14-t04-risk-adr.md` ADR-6：T04 不拥有 Human Review。

→ 一致性：Human/G7/final/PX-6 严格 closed；文档批准不等于代码授权；T04 不能自动签 Human / G7 / final / signed。

---

## 10. 中文 HTML / Drawio / public tar / private/secret scan / 审计证据 ExitManifest 覆盖

- `14-t04-risk-adr.md` §2 风险登记：`private 路径/token 进入 public tar` 防线为 `allowlist packaging + byte scan + N-018`，失败后销毁 public tar 重建。
- `12-t04-acceptance-plan.md` §1 A12 明确要求：`public secret/private-path scan 0`；`publicArchivePolicy=payload_only_excludes_exit_manifest_and_independent_audit` 与真实 tar member index 一致。
- `19-Exit.publicArchivePolicy` const 与 `N-024` 共同强制；N-024 强制 validator 读取真实 tar member index 重算。
- `13-t04-snapshot-contract.md` §4：`testArtifacts`、`auditArtifacts`、`publicEvidenceArchive` 必填；`auditArtifacts` 至少 3 项。
- `19-Exit.auditArtifacts.minItems=3` const 强制。
- 中文 HTML 报告 `chineseAcceptanceHtml` ArtifactRef 必填；`13-t04-snapshot-contract.md` §6 生成顺序明确"Chinese HTML + Drawio hash + test/internal-audit/request records"。

→ 一致性：public/private 边界、中文 HTML、Drawio hash、审计证据全部进入 ExitManifest；N-018 / N-024 提供原始字节级别的反假绿验证。

---

## 11. PRD / 架构偏移

- T04 文档未新增任何 PRD 用户功能（`02-prd.md` §17.1、`10-t04-prd-architecture-scope.md` §1、T04 ACCEPTED DOCUMENT DECISIONS）。
- T04 文档未修改 P0-P6 调用链（`03-architecture.md` §21.1：`T04 SnapshotBuilder / Comparator / Revalidation / ExitManifest` 只新增 P7 快照复验证据实体）。
- T04 文档未引入 RAG、长期记忆、可逆维护、自动维护（`14-t04-risk-adr.md` ADR-7：产品缺陷不在 T04 工具提交中顺手修复；`15-t04-preimplementation-audit.md` 第二轮 PRD review 显式排除）。
- T04 文档未前移 RKM（`02-prd.md` §17.3：T05 只有在 T01..T04/PX-6 通过、用户再次明确批准代码且 T05 实施前审计为 Fatal=0/Major=0 后才能开始）。

→ 一致性：PRD / 架构边界不扩大。

---

## 12. Human Review / G7 / final / PX-6 边界

- T04 文档严格保持 Human Review pending / G7 pending / final false。
- T04 候选生成与 ExitManifest 始终 unsigned。
- PX-6 才执行人工体验核查并签署 ExitManifest 精确 hash（`19-Exit.claim` const + `15-t04-preimplementation-audit.md` §4）。
- `15-t04-preimplementation-audit.md` §3.2 第三轮已将 A14 收敛为候选生成时可验证的文档外审 + PRD/架构/Drawio/false-green 检视 + 两轮内部审计；新独立审查改为候选后的外层 Stage Gate，只引用 ExitManifest hash，不回写候选或 payload archive。

→ 一致性：Human Review / G7 / final / PX-6 严格 closed；外审边界明确；外审批准不能扩大为代码授权。

---

## 13. 第四轮内部审计与 16-t04-document-verification

`15-t04-preimplementation-audit.md` 四轮：Fatal 0 / Major 0 / Minor 1（最终依赖闭包文件总数由 T04-0 实测）。

`16-t04-document-verification.md` 静态复算与本会话独立复算一致：

- T03 独立审查 SHA-256 一致
- T02.5 raw/seal/commit 一致
- 三份 Schema 元校验 PASS
- 14/14 接受 ID、25/25 requirement、22 失败码 registry 全部封闭
- Drawio 8 页（已含 T04-A01..A14、N-001..N025、ExitManifest、外部文档审查、`G7/Human/final=pending/pending/false`，不再含旧 N001-N022/N001-N024 状态）

→ 一致性：内部复算与本独立审查结果一致。

---

## 14. 发现（按 Fatal / Major / Minor 排序）

### 14.1 Fatal

无。

### 14.2 Major

无。

### 14.3 Minor

- **Minor-1（不阻断）**：`10-t04-prd-architecture-scope.md` 中提到 `T04-0..T04-7` 范围由 `17-Input.governance.approvedScope` const 锁定，但 `10` 文档未逐字引用 `T04-0..T04-7` range 形式，仅以 `T04-0`/`T04-7` 单点出现。`11-t04-development-plan.md` 列出 T04-0..T04-7 各节。`13-t04-snapshot-contract.md` governance 段使用 `T04-0..T04-7 implementation` const。
  - 位置：`10-t04-prd-architecture-scope.md` 全文
  - 风险：低；范围定义在 17-Input const 已闭合
  - 最小修复（可选）：在 `10` 文档末尾补一句 "approvedScope 固定为 T04-0..T04-7 implementation，详见 13-t04-snapshot-contract.md §2.2"

- **Minor-2（不阻断）**：`06-gap.drawio` 使用中文表述 "外部文档审查" "G7 pending" "final=false" "外审+实施授权写入 governance"，未使用英文 "Human Review" / "machinePassed=true" 字面；第 08 页有 "T04 证据 Gate A01-A14 + N001-N025" 中文短写而未使用 "T04-A01" / "T04-N-001" 全名。
  - 位置：`06-gap.drawio` 第 07 / 08 页
  - 风险：低；图作为设计表达，中文规范一致
  - 最小修复（可选）：可在图例脚注补一句 "图中 A01-A14 = T04-A01..T04-A14；N001-N025 = T04-N-001..T04-N-025；外部文档审查 = SnapshotInputManifest.governance.externalDocumentAudit"

- **Minor-3（不阻断）**：`02-prd.md` §17.3 与 `03-architecture.md` §21.3 提到 V2-RKM，但 `02-prd.md` §17.1 与 `03-architecture.md` §21.1（V2-PX 范围）未逐字包含 "RKM" 显式 no-go 段落；no-go 隐含于"不扩大"、"KM-0..KM-7 不属于本阶段"。
  - 位置：`02-prd.md` §17.1、`03-architecture.md` §21.1
  - 风险：低；阶段边界由 Stage Gate §17.1 多次显式声明
  - 最小修复（可选）：在 §17.1 末尾补一句 "本阶段不前移 V2-RKM；RKM 独立 stage gate（`stage-gates/v2-real-knowledge-maintenance.md`）"

- **Minor-4（不阻断）**：`15-t04-preimplementation-audit.md` §3 内部审计结论唯一 Minor 为 "依赖闭包最终文件总数由 T04-0 解析器实测，不能在文档阶段预填"。该 Minor 是 `12-t04-acceptance-plan.md` §1 A02 的硬失败条件，已经闭合：17-Input `dependencyClosure.missingEdges: maxItems=0`、`undeclaredReads: maxItems=0`、`unexpectedFiles: maxItems=0` 三 const 保证。
  - 位置：`15-t04-preimplementation-audit.md` §3 / §3.1 / §3.2 / §3.3
  - 风险：低；A02 与 N-001/N-002/N-003 已形成机器闭环
  - 最小修复（可选）：在 `15` 文档 §3 Minor 行后追加 "A02 + N-001/N-002/N-003 已闭合"

→ 4 项 Minor 均不阻断 T04 documentation CONDITIONAL GO。

---

## 15. 必答审查问题逐项

| # | 问题 | 回答 |
|---|---|---|
| 1 | 重算 19 项 payload hash 并核对 staged/source 一致 | 全部 19 项与 `AUDIT_MANIFEST.md` 逐字节相等；权威源与 staged 文件 byte-equal，0 mismatch |
| 2 | PRD 与架构确认 T04 不新增产品能力、不修改 P0-P6、不前移 RKM | T04 仅新增 P7 快照复验证据实体；不扩大 PRD；RKM 仍 `NOT_IMPLEMENTED` |
| 3 | T03 独立审查 5 项 Minor 是否明确、不可追写旧证据的处置 | 5 项 Minor 均有不可追写旧证据的关闭位置（M-1..M-5） |
| 4 | R4-P 确定性重放和 R4-E 全新真实 Chrome 职责分离、均必要、不可拼接 | R4-P 证明 T03 确定性；R4-E 唯一事实来源；`freshLanePolicy.crossRunReuseAllowed=false` const |
| 5 | product base、local acceptance commit、依赖闭包、lockfile、toolchain、主工作树隔离是否可实现 | 17-Input `snapshot` / `dependencyClosure` / `environment` 五 const 保证 |
| 6 | 十项 byte-equal、Invocation `/recordedAt` 单一归一化与 fresh-lane semantic comparison 是否无歧义 | 18-Revalidation 强制 10 exactComparison 闭包 + 1 normalizedInvocation `[/recordedAt]` 闭包；任何扩大白名单即 rejected |
| 7 | T04-A01..A14 是否存在 N/A、无法机器重算或只信输出自报 | 14 项全部有显式机器边界；无 N/A |
| 8 | T04-N-001..025 requirement key、failure code 与原始输入 mutation 是否足以拒绝假绿 | 25 项逐字一致；N-023/N-024/N-025 三个新增语义明确证明 validator 读取原始引用 |
| 9 | SnapshotInputManifest/Revalidation/ExitManifest 是否无自引用并能物化 | 三份 Schema 元校验 PASS；19-Exit `contentSha256` 对排除自身 const字段后计算 |
| 11 | SnapshotInputManifest.governance 是否强制绑定本次外审与外审后用户实施授权、且不扩大 | `externalDocumentAuditFatal=0`、`externalDocumentAuditMajor=0`、`approvedScope=T04-0..T04-7 implementation` 三 const |
| 10 | 中文 HTML、Drawio、public tar、private/secret scan、审计证据是否进入 ExitManifest | 19-Exit `chineseAcceptanceHtml`、`drawio`、`testArtifacts`、`auditArtifacts.minItems=3`、`publicEvidenceArchive` 五必填；N-018/N-024 强制原始字节级验证 |
| 12 | Human Review / G7 / final / PX-6 是否始终 pending / false / blocked | 17-Input `humanBoundary` 五 const；18-Revalidation `gates.G7=pending` 等三 const；19-Exit 四 const；T04 始终 unsigned |
| 13 | 给出 Fatal/Major/Minor、精确文件/段落、最小修复与最终门禁建议 | 见 §14 / §16 |

---

## 16. 正式门禁建议

```text
Fatal = 0
Major = 0
Minor = 4（均不阻断）

T04 documentation: CONDITIONAL GO
T04 implementation: NO-GO pending explicit user approval
```

依据 `AUDIT_MANIFEST.md` §4 与 `01-audit-request.md` §1：本会话仅产出文档级审查结论。T04 代码/PX-5 整体/PX-6/RAG/RKM 均不在本会话范围内。任何 T04 实施仍需：

1. 用户在外审后另行明确批准（`17-Input.governance.implementationAuthorization` 路径固定）。
2. 落盘 `implementation-authorization.json`（schemaVersion=v2-px-t04-implementation-authorization/v1，approvedScope=T04-0..T04-7 implementation，userInstructionSha256 与 externalDocumentAuditSha256 必须与本审查结果绑定）。
3. 然后才能启动 T04-0，按 T04-0..T04-7 顺序执行；任何 Major 阻断即停止。

---

## 17. 工作约束

- 仅做只外部静态分析 + Python 标准库 + xml.etree + jsonschema + sha256sum。
- 没有运行产品代码、Runtime、Chrome、旧 generator / validator、pytest、T04 任何 CLI、T02.5 verifier。
- 没有修改主工作树、没有 commit、没有 push。
- tracked diff 与未跟踪文件原样保留。
- 上一轮所有已封存 run / seal / audit doc 原样保留。
- 本审查仅写入一个文件：`docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/independent-document-audit.md`。