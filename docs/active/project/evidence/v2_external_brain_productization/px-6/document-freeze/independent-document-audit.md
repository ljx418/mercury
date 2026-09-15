# T04.1 / PX-6 文档冻结独立只读审查

日期：2026-09-14  
审查者：当前 session（独立只读静态 + Python 标准库 + sha256sum + jsonschema + ElementTree Draw.io XML 解析）  
审查对象：`docs/active/project/external-audit-package/` 18 载荷 + 1 manifest = 19 平铺文件  
审查决策对象：T04.1 / PX-6 文档候选是否可获得 CONDITIONAL GO（仅文档方向，等用户明确批准实施授权）；不扩大为 T04.1 / PX-5 / PX-6 / V2 / RAG / RKM 产品 PASS。  
输入文件：`AUDIT_MANIFEST.md`、`01-audit-request.md`。

---

## 0. 摘要

```text
T04.1 / PX-6 文档候选审查结论：T04.1/PX-6 document candidate CONDITIONAL GO for explicit user implementation authorization.
```

- 18 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 自报哈希逐字节相等（diff exit 0），权威源与平铺文件 0 mismatch。
- PX-6 Schema `v2_px6_exit_contracts/v1` Draft 2020-12 meta-validation：PASS。
- 7 个 `positiveInstances[].instance` 全部通过 schema 严格校验：7/7 PASS。
- requirement registry 20 项 vs fixture cases 20 项：`requirementId / requirementKey` 集合**精确相等**（set match = True）；`enforcementLayer` 全部 semantic；`failureCode` 集合全部匹配 registry。
- 20 个 fixture case 的 `expectedPrimaryFailure` 全部位于 registry 闭合枚举内，且每个 case 对应一个独立 failureCode（无双 case 共用 primary failure）。
- Draw.io 8 页 / 112 vertex / 42 边 / 0 重复 ID / 0 越界 / 0 引用断裂。
- T04 LIMITED PASS 边界保持：Minor 1（跨 root 命名一致性 `replay_validation` vs `validation_run`，仅命名差异，物理路径与字节相等）属 T04 实施后审计历史结论，本轮不动。
- T03 / T04 历史 ExitManifest 与独立审计 hash 在新审计包边界内保持不变（T04 独立审计 raw SHA-256 `cd64f8db…090c9b` 与本轮 `12-t04-independent-exit-audit.md` 一致）。
- 20 条 false-green 负例（PX6-N-001..N020）与 14 条 T04 负例 + 8 条 T04.1 负例设计互不冲突；新增 PX6-N-014（自动化代签 reviewer/reviewedAt）、PX6-N-015（授权文本/hash 不一致）、PX6-N-019（G7 pending 但 finalPassed=true）三条高风险闭环。
- 旧 `e2e/audit-v2-external-brain-exit.mjs` 在 PX-6 开发计划 §3 明确**禁止使用**（应 fail closed），不作为 fallback。

**Fatals：0。Majors：0。Minors：3（详见 §15）。**

---

## 1. 载荷完整性：18 项 SHA-256 独立重算

### 1.1 计算结果

```text
18 项载荷哈希逐字节匹配 AUDIT_MANIFEST.md（diff exit 0）。
权威源 vs 平铺副本：18 项 SHA-256 一一相等（0 mismatch）。
文件数：19（18 载荷 + 1 manifest），无子目录。
```

### 1.2 关键文件 SHA-256 对账

| 文件 | 平铺 SHA-256 | 权威源 SHA-256 | 一致 |
|---|---|---|---|
| `01-audit-request.md` | `36ee948c…800707` | 同 | ✓ |
| `02-prd.md` | `ec8aba28…fe82d5a` | 同 | ✓ |
| `03-architecture.md` | `440aa989…cfeb4c` | 同 | ✓ |
| `04-development-plan.md` | `535a7362…86b03b07` | 同 | ✓ |
| `05-acceptance-plan.md` | `8fc647f4…c69d4d8` | 同 | ✓ |
| `06-stage-gate.md` | `7149e351…1af069f` | 同 | ✓ |
| `07-gap.drawio` | `c29f1132…fb9a2a05` | 同 | ✓ |
| `08-px5-development-plan.md` | `ebdbf6be…09f0fc0e` | 同 | ✓ |
| `09-t04.1-development-plan.md` | `f04cd480…03615` | 同 | ✓ |
| `10-t04.1-acceptance-plan.md` | `5ded5860…280b4b` | 同 | ✓ |
| `11-t04-snapshot-contract.md` | `6885d5dc…dc78c5` | 同 | ✓ |
| `12-t04-independent-exit-audit.md` | `cd64f8db…2090c9b` | 同 | ✓ |
| `13-px6-development-plan.md` | `82304f6f…60b35baf` | 同 | ✓ |
| `14-px6-acceptance-plan.md` | `5f90dfac…f726a0df` | 同 | ✓ |
| `15-px6-exit-contracts.schema.json` | `c8710676…e8e80e0` | 同 | ✓ |
| `16-px6-contract-fixtures.json` | `4f9f55ec…442a007` | 同 | ✓ |
| `17-internal-audit-round1.md` | `b98883b6…3aef67` | 同 | ✓ |
| `18-internal-audit-round2.md` | `495bae71…6ffdc5b` | 同 | ✓ |

---

## 2. T04 LIMITED PASS 边界保持

| 项 | T04 独立审计原文（本包 `12-`） | 本轮确认 |
|---|---|---|
| T04 LIMITED PASS verdict | PASS（Fatal 0 / Major 0 / Minor 1） | ✓ |
| Human Review / G7 / final | pending / pending / false | ✓（保持未变） |
| PX-5 / PX-6 / V2 / RKM / RAG | 不在本审计范围，不得扩张 | ✓ |
| ExitManifest raw sha256 | `5e492bd50a7dc3a1be5c5d57b7b694601b9563f4c6f79871b72093b3e56316cd` | ✓ |
| 独立审计 raw sha256 | `cd64f8dbe685be7e252f65b1226a248885eb7b1a642651cd58c79ba752090c9b` | ✓ |
| 25 项负例 | 25/25 通过 | ✓（已在 T04 独立审计中验证） |
| T04 Minor 1（跨 root 命名一致性） | 仅命名差异，物理路径与字节相等 | ✓（属历史结论，本轮不动） |

---

## 3. PX-6 Schema 独立校验

### 3.1 Schema meta-validation

```python
Draft202012Validator.check_schema(schema) → PASS
```

### 3.2 根 schema 关键字段

| 字段 | 值 |
|---|---|
| `$id` | `https://navia.local/schemas/v2-px6-exit-contracts/v1` |
| `$schema` | `https://json-schema.org/draft/2020-12/schema` |
| `x-navia-contract-version` | `v1` |
| `x-navia-canonical-json` | `navia_canonical_json_v1` |
| `x-navia-failure-code-registry` | list of 20 unique FailureCode |
| `x-navia-requirement-registry` | list of 20 requirement entries |
| `$defs` 数量 | 22（Sha256、DateTime、RelativePath、EvidenceClass、ArtifactRef、FailureCode、Issue、AcceptanceResult、GateStatus、Denominators 等） |

### 3.3 FailureCode 枚举（20 项，闭合）

| 序号 | FailureCode |
|---|---|
| 1 | `PX6_T04_EXIT_MANIFEST_HASH_MISMATCH` |
| 2 | `PX6_T04_EXIT_MANIFEST_CONTENT_MISMATCH` |
| 3 | `PX6_T04_INDEPENDENT_AUDIT_MISMATCH` |
| 4 | `PX6_T04_ARTIFACT_ROOT_UNRESOLVED` |
| 5 | `PX6_LEGACY_PIPELINE_FORBIDDEN` |
| 6 | `PX6_SOURCE_SCENARIO_DENOMINATOR_MISMATCH` |
| 7 | `PX6_ROUTE_MATRIX_INCOMPLETE` |
| 8 | `PX6_FORGET_RECOVERY_INCOMPLETE` |
| 9 | `PX6_UX_OR_FAULT_EVIDENCE_INCOMPLETE` |
| 10 | `PX6_VALIDATION_DENOMINATOR_MISMATCH` |
| 11 | `PX6_CROSS_RUN_EVIDENCE_MIXED` |
| 12 | `PX6_T04_EVIDENCE_MUTATED_AFTER_AUDIT` |
| 13 | `PX6_DOCUMENT_OR_DRAWIO_STALE` |
| 14 | `PX6_AUTOMATION_WROTE_REVIEWER` |
| 15 | `PX6_REVIEW_AUTHORIZATION_MISMATCH` |
| 16 | `PX6_HUMAN_GATE_FAILED_BUT_NOT_BLOCKED` |
| 17 | `PX6_HUMAN_FAILED_WITHOUT_BLOCKING_ISSUE` |
| 18 | `PX6_REPORT_PROMOTED_BEFORE_HUMAN` |
| 19 | `PX6_G7_PENDING_WITH_FINAL_PASSED` |
| 20 | `PX6_SUCCESS_CLAIM_OR_FINAL_AUDIT_OVERREACH` |

- 全部 20 个 FailureCode 与 PX-6 验收计划 §4 的 20 条负例 PX6-N-001..N020 一一对应。
- FailureCode 集合在 `x-navia-failure-code-registry` 与 fixture cases 中精确匹配（set match = True）。

---

## 4. requirement / fixture 严格映射

### 4.1 Requirement registry（20 项）

```text
每项含: requirementId, requirementKey, failureCode, enforcementLayer
layers: 全部 semantic (20/20)
unique failure codes: 20
```

### 4.2 Fixture cases（20 项）

```text
layers: 全部 semantic (20/20)
unique primary failures: 20 (与 registry 1:1 对应)
```

### 4.3 独立比对结果

| 检查 | 结果 |
|---|---|
| Keys `(requirementId, requirementKey)` 集合精确相等 | **True** ✓ |
| Failure codes 集合精确相等 | **True** ✓ |
| All cases within registry failure codes | **True** ✓ |
| 所有 case `enforcementLayer == semantic` 与 registry 一致 | ✓ |
| 没有任何 case 复用 primary failure | ✓（1:1 对应） |

---

## 5. 7 个 Positive Instance 校验

| positiveId | instance 关键字段 |
|---|---|
| `PX6-P-001-candidate-binding` | schemaVersion / evidenceClass / px6RunId / t04RunId / snapshotCommit / exitManifestRawSha256 |
| `PX6-P-002-machine-exit-audit` | schemaVersion / evidenceClass / px6RunId / candidateBinding / status / machinePassed |
| `PX6-P-003-evidence-index` | schemaVersion / evidenceClass / px6RunId / status / candidateArtifacts / machineArtifacts |
| `PX6-P-004-review-request` | schemaVersion / evidenceClass / px6RunId / candidateBinding / machineExitAudit / status |
| `PX6-P-005-review-submission` | schemaVersion / evidenceClass / px6RunId / candidateExitManifestRawSha256 / machineExitAuditRawSha256 / humanReview |
| `PX6-P-006-final-disposition` | schemaVersion / evidenceClass / px6RunId / candidateBinding / machineExitAudit / reviewSubmission |
| `PX6-P-007-collection-diagnostic` | schemaVersion / px6RunId / status / createdAt / issues / candidateGenerated |

- 全部 7 个 instance 通过 `Draft202012Validator(schema).validate(instance)` 严格校验：7/7 PASS。

---

## 6. Draw.io 独立结构复算

| 项 | 候选自报 | 独立实测 |
|---|---|---|
| 页数 | 8 | 8 ✓ |
| 总 vertex | 112 | 112（15+17+14+18+13+13+11+11） |
| 总边 | 42 | 42（7+10+7+10+5+0+3+0） |
| 每页 ID 唯一 | 0 duplicate | 0 duplicate ✓ |
| 边 source/target 引用 | n/a | 0 broken ✓ |
| 1600×900 几何边界 | 0 overflow | 0 overflow ✓ |
| 矩形重叠 | 0 | 0（dev-plan §2 claim） |

- 八页职责：01 用户入口与双容器目标体验 / 02 当前与目标架构差异 / 03 用户入口、路由与状态交接 / 04 保存、构建与遗忘生命周期 / 05 双容器共享架构与服务状态 / 06 V2-PX 产品化开发计划与里程碑 / 07 自动化与人工验收计划 / 08 验收门槛、出门条件与声明。
- 颜色语义与上一轮一致（绿=已实现/限定通过、黄=待复验、红=待新增/阻塞、蓝=目标边界、紫=外部候选）。
- WSL Draw.io AppImage 不能导出位图；XML / 几何 / 文字已自动检查，最终视觉方向需用户在桌面 Draw.io 中人工确认。

---

## 7. PX-6 机器状态机与 Human Review 边界（vs dev-plan §5）

```text
machine_validating
  -> blocked                         exit 2
  -> waiting_for_human_review        exit 0, mandatory stop
waiting_for_human_review
  -> human_failed                    exit 3
  -> human_passed                    continue to final validation
human_passed
  -> final_failed                    exit 2
  -> final_passed                    exit 0
```

### 7.1 边界关键约束

| 约束 | 来源 | 一致性 |
|---|---|---|
| machine_package 不允许 `review-submission.json` | dev-plan §6 | ✓ |
| machine_package 不允许 success claim | dev-plan §7 + acceptance-plan §4 N018 | ✓ |
| 自动化不得创建 reviewer / reviewedAt / blockingIssues | dev-plan §4 PX6-6 + acceptance-plan §3 H01..H07 | ✓ |
| Human Review v3 由人类独立提交 | dev-plan §4 PX6-6 + contracts §13 | ✓ |
| Finalization 不回写 T04.1 candidate | dev-plan §4 PX6-7 | ✓ |
| 公开包排除人类身份、自身 manifest 与后续独立审计 | dev-plan §6 + contracts | ✓ |
| `submittedByAutomation=false` 强制 | dev-plan + 内部审计 R1-04 / N014 | ✓ |

### 7.2 单向无环链

```text
immutable T04.1 candidate + independent audit
  -> CandidateBinding (PX6-P-001)
  -> raw-byte Reader / shared validation core
  -> MachineExitAudit (PX6-P-002, A01..A14)
  -> EvidenceIndex (PX6-P-003) + ReviewRequest (PX6-P-004)
  -> mandatory stop: waiting_for_human_review
  -> human-authored Human Review v3 + ReviewSubmission (PX6-P-005)
  -> FinalDisposition (PX6-P-006, A15/A16 + G7/final)
  -> independent implementation exit audit
  -> CollectionDiagnostic (PX6-P-007) on failure
```

- 4 个 final 产物根 schema + CollectionDiagnostic + Human Review v3 均经 schema meta-validation + instance validation 闭环。
- 不存在循环引用：Package 不含自身 hash；InvocationRecord 由 orchestrator 最后写。

---

## 8. T04.1 修复项的文档边界

T04.1 修复包目标：`artifactRoot` 不一致（已在 T04 独立审计中标记 Minor 1）。

| 关闭方式 | 文档位置 | 状态 |
|---|---|---|
| `replay_validation` 作为 `actualInvocation` 的解析根 ArtifactRef | 11-t04-snapshot-contract.md | 已冻结 |
| PX-6 仍必须从单一明确 T04.1 candidate 读取，禁止 newest-run / 跨 run | 13-px6-development-plan.md §3 PX6-1 | ✓ |
| T04.1 candidate 一旦生成即 immutable；不再允许修改 | dev-plan §2 + 14-px6-acceptance-plan.md §5 | ✓ |
| 旧 T04 candidate 不允许作为入口 | dev-plan §3 (禁止使用) | ✓ |

---

## 9. 20 条 false-green 负例（PX6-N-001..N020）

```text
PX6-N-001 ExitManifest raw hash mismatch
PX6-N-002 ExitManifest content hash mismatch
PX6-N-003 independent audit hash mismatch
PX6-N-004 T04 artifactRoot Minor unresolved
PX6-N-005 legacy validator or generator invoked
PX6-N-006 scenario/source denominator reduced
PX6-N-007 route matrix partial
PX6-N-008 Forget chain cross-source or partial
PX6-N-009 fault/viewport/Axe/keyboard partial
PX6-N-010 63/109/42 denominator mismatch
PX6-N-011 cross-run evidence mixed
PX6-N-012 T04 evidence mutated after audit
PX6-N-013 document or Draw.io status stale
PX6-N-014 automation writes reviewer/reviewedAt
PX6-N-015 review authorization text/hash mismatch
PX6-N-016 Human passed with pending/failed gate
PX6-N-017 Human failed without blocking issue
PX6-N-018 Report promoted before Human Review
PX6-N-019 G7 pending while finalPassed=true
PX6-N-020 success claim or final audit overreach
```

- 全部 20 条负例的 `requirementId` / `requirementKey` / `expectedPrimaryFailure` 与 requirement registry 一一对应。
- 关键 3 条（PX6-N-014、N-019、N-020）专门防止自动化代签、G7/final 不一致、过度声明，是 PX-6 实施阶段必须 100% 命中的硬性关卡。

---

## 10. 旧 `e2e/audit-v2-external-brain-exit.mjs` 禁用确认

| 项 | 文档支撑 | 状态 |
|---|---|---|
| 显式列入"禁止使用"清单 | 13-px6-development-plan.md §3 | ✓ |
| 必须 fail closed（旧 PX-5 根目录 + 旧 validator 入口） | 13-px6-development-plan.md §3 + acceptance-plan §4 N005 | ✓ |
| 没有作为 fallback | 内部审计 round 1 R1-05 + round 2 §2 同步 active 文档 | ✓ |
| T04 已通过 acceptance plan 也明确不再使用 | 12-t04-independent-exit-audit.md 引用 N005 | ✓ |

---

## 11. PRD / 架构 / 阶段门禁一致性

| 文档 | 关键条款 | 本审查一致度 |
|---|---|---|
| `02-prd.md` §17.3 | T04 / PX-6 阶段状态与边界 | ✓ |
| `03-architecture.md` §17 | P0-P7 实体、Runtime 权威、Mock Adapter、Evidence Plane | ✓ |
| `04-development-plan.md` | T04 阶段进入与出门条件 | ✓ |
| `05-acceptance-plan.md` | T04 A01..A14 / N001..N025 | ✓ |
| `06-stage-gate.md` | PX-5 FAIL/REOPENED，PX-6 BLOCKED | ✓ |
| `07-gap.drawio` | 8 页 / 112 节点 / 42 边 | ✓ |
| `08-px5-development-plan.md` | 历史 PX-5 范围；不再作为当前阶段 | ✓ |
| `09-t04.1-development-plan.md` | T04.1 修复包范围与状态 | ✓ |
| `10-t04.1-acceptance-plan.md` | T04.1 14 项 + 8 负例 | ✓ |
| `11-t04-snapshot-contract.md` | replay_validation / validation_run 路径语义 | ✓ |
| `12-t04-independent-exit-audit.md` | T04 LIMITED PASS 边界 | ✓ |
| `13-px6-development-plan.md` | PX6-0..5 + PX6-7 实施阶段 + 状态机 + 退出码 | ✓ |
| `14-px6-acceptance-plan.md` | A01..A16 + H01..H07 + N001..N020 | ✓ |
| `15-px6-exit-contracts.schema.json` | 22 defs + 20 failure-code + 20 requirement + 7 positive | ✓ |
| `16-px6-contract-fixtures.json` | 7 positive + 20 cases | ✓ |
| `17-internal-audit-round1.md` | Round 1 内部审计（PASS / Fatal 0） | ✓ |
| `18-internal-audit-round2.md` | Round 2 内部审计（PASS / Fatal 0） | ✓ |

---

## 12. 必答审查问题逐项

| # | 问题 | 回答 |
|---|---|---|
| 1 | active PRD / 架构 / 开发 / 验收 / stage gate / Draw.io 使用同一状态和顺序 | ✓ 全部统一为 T03 LIMITED PASS / T04 LIMITED PASS / T04.1 DOC CANDIDATE / PX-6 DOC CANDIDATE |
| 2 | T04.1 关闭 root `replay_validation` 与 step `validation_run` 不一致 | ✓ `actualInvocation` 解析根为 `replay_validation`，步骤保留自身 ArtifactRef；T04 独立审计已确认物理路径与字节相等 |
| 3 | PX-6 只绑定单一明确 T04.1 candidate，拒绝 newest-run / 跨 run / 候选回写 | ✓ dev-plan §4 PX6-1 显式禁止 |
| 4 | `CandidateBinding -> MachineExitAudit -> ReviewRequest -> ReviewSubmission -> FinalDisposition` 单向无环、无自引用 | ✓ 7 个 positive 实例 + 5 个 final 产物根 schema 全闭合 |
| 5 | 17 scenario / 12 source / 20 route cell / 12 Forget / 4 fault / 4 viewport / 63/109/42 / 14/25 保持独立固定分母 | ✓ acceptance-plan §1 + §2 + dev-plan §5 全部对齐 |
| 6 | A01..A16 / H01..H07 / N001..N020 精确无 N/A，有人/操作/观察/阈值/失败处置 | ✓ acceptance-plan §2 / §3 / §4 全部满足 |
| 7 | Schema meta + 7 个正例 + 20 requirement/key/layer/failure/case 一一相等 | ✓ §3 + §4 + §5 全部 PASS |
| 8 | 重复 A01 / G1 / blocked ready claim / 自动 reviewer / Human pending + final true / fixture success claim 提升被拒绝 | ✓ 内部审计 round 1 R1-01..R1-05 + acceptance-plan §4 N014..N020 |
| 9 | Human Review v3 与外层 ReviewSubmission 职责清楚；自动化能否制造 reviewer / reviewedAt / passed | ✓ dev-plan §4 PX6-6 + contracts §13 + acceptance-plan §3 H01..H07 |
| 10 | 旧 `apps/chrome-extension/e2e/audit-v2-external-brain-exit.mjs` 已明确禁用，不是 fallback | ✓ dev-plan §3 + acceptance-plan §4 N005 |
| 11 | Draw.io 不超过 8 页、中文、0 重 ID/越界/断裂，足以评估风险 | ✓ 8 页 / 112 节点 / 42 边 / 0 异常 |
| 12 | 是否存在把文档候选 / contract fixture / machine package / T04 LIMITED PASS 扩大为 PX-5 / PX-6 / V2 / RAG / RKM PASS | ✓ 全部文档边界保持 not-passed claim |

---

## 13. 决定

**T04.1/PX-6 document candidate CONDITIONAL GO for explicit user implementation authorization.** 本 session 对 18 项平铺文件做独立只读静态核验：

- 18 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 逐字节相等。
- PX-6 Schema Draft 2020-12 meta-validation PASS；7 个 positive instance 7/7 PASS；20 requirement registry 与 20 fixture cases 精确一一相等；20 failureCode 集合闭合。
- Draw.io 8 页 / 112 节点 / 42 边 / 0 异常。
- T04 LIMITED PASS 边界（T03 LIMITED PASS / Human/G7/final pending/false）保持不变。
- 20 条 false-green 负例与 acceptance plan §4 一一对应；旧 `e2e/audit-v2-external-brain-exit.mjs` 显式禁止使用。
- 3 项 Minor 均为审查覆盖度或文档措辞（详见 §15），不构成 Fatal/Major 阻断。

**允许进入**：用户**另行明确批准**后开始 T04.1 代码实施（PX6-0..5 顺序执行）或 PX-6 代码实施。

**禁止**：
- 不允许把本审查扩大为 T04.1 / PX-5 / PX-6 / V2 / RAG ready / 完整外脑 / 自动维护完成 / Knowledge Dream Cycle。
- 不允许把 T04 LIMITED PASS / 文档候选通过 / contract fixture 通过误读为产品 PASS。
- 不允许把 20 条 fixture 误读为已实际执行的负例（fixture 只证明 shape / registry / mutation 指令完整；尚未实跑）。
- 不允许把 Human Review pending 状态下声称"最终通过"。
- 不允许修改旧 T02 / T02.1 / T02.2 / T02.5 / T03 / T04 run。
- 不允许跨 run 拼接 / 复用 / newest-run 选取。
- 不允许运行旧 PX generator / validator / `e2e/audit-v2-external-brain-exit.mjs`。
- 本 session 不替代 Human Review；不替代 T04.1 / PX-6 实施后独立审计。

---

## 14. 工作约束

- 仅做只读静态分析 + Python 标准库 + sha256sum + jsonschema + ElementTree XML 解析。
- 没有运行产品代码、Runtime、Chrome、旧 generator / validator、pytest、任何 T04.1 / PX-6 runner。
- 没有修改主工作树、没有 commit、没有 push。
- tracked diff 与未跟踪文件原样保留。
- 上一轮（9-09 / 9-10 / 9-11 / 9-12 上午 / 9-12 下午 / 9-13 / 9-14 上午 / 9-14 下午）所有已封存 run / seal / audit doc 原样保留。
- 与 r1-independent-audit / rkm-doc-readiness-review / t02-independent-audit / t02.1 / t02.2 / t03-independent-resumption-preimplementation / t03-independent-implementation-exit-audit 系列审计文档并列独立存档。

---

## 15. Minor 项（3 项，不阻断 CONDITIONAL GO）

### M-1：T04.1 artifactRoot 命名一致性（历史 T04 Minor 1 跨轮次延续）

**位置**：`12-t04-independent-exit-audit.md §318` 已标记；`replayLane.actualInvocation.artifactRoot="replay_validation"` 与 `steps[*].{implementation,stdout,stderr}.artifactRoot="validation_run"` 指向同一物理目录 `replay/output/`，仅命名差异。

**风险**：低；物理路径与字节相等。

**建议**：T04.1 实施时统一 `validation_run` 为 `replay_validation`，或在 contracts §3.1 显式说明 `actualInvocation` 与 `steps[*]` 故意使用不同 root 别名。

### M-2：20 个 fixture case 的语义验证尚未实跑

**位置**：`16-px6-contract-fixtures.json` 提供 20 个 mutation case + 7 个 positive instance；`18-internal-audit-round2.md §4` 与 `18 §5.2` 明确指出"夹具状态严格限定为 contract_only；当前只证明 Schema shape、registry 映射和变异指令完整，不宣称尚未实现的 PX-6 semantic runner 已经执行 20/20"。

**风险**：中；未来 PX6-0 必须让每个 case 实际修改原始字节或结构化对象并验证 primary failure，不能读取 `expectedPrimaryFailure` 后直接回显。

**建议**：PX6-0 实施前在 contracts/fixtures/ 增加 "raw mutation helper" 实现文档；PX-6-4 实施时通过 stderr / sha256 / schema 三通道独立验证 primary failure，不依赖 case 内部声明的 `expectedPrimaryFailure`。

### M-3：WSL Draw.io AppImage 不能导出位图，桌面视觉审阅未签署

**位置**：与上一轮 T03 独立审计 Minor M-1 一致。

**风险**：低；XML / 几何 / 文字层已确认。

**建议**：用户桌面 Draw.io 视觉审阅需与本审查同时落盘签署记录（reviewer ID + 签字 hash + 审阅时间）。

---

## 16. 总结

T04.1 / PX-6 文档冻结包满足：

- 18 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 逐字节相等；
- PX-6 Schema meta + 7 个 positive instance + 20 requirement / 20 fixture case / 20 failureCode 全部精确闭合；
- Draw.io 8 页 / 112 节点 / 42 边 / 0 异常；
- T04 LIMITED PASS 边界保持（T03 / Human / G7 / final 全部 pending / false）；
- 旧 `e2e/audit-v2-external-brain-exit.mjs` 显式禁用；
- 3 项 Minor 均为审查覆盖度或文档措辞，不构成 Fatal/Major 阻断。

本审查 **T04.1/PX-6 document candidate CONDITIONAL GO for explicit user implementation authorization**。仅当用户另行明确批准实施授权后，T04.1 与 PX-6 才能进入实质代码阶段；本审查不替代 Human Review、不替代实施后独立出门审计、不替代 T04.1 与 PX-6 实施前 R4-P/R4-E/T02/T03/T04 全量 replay。