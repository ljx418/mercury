# PX-6 机器出门与人类审查合同

日期：2026-09-14  
状态：`FROZEN v1 / DOCUMENT AUDIT PASSED / MACHINE CANDIDATE GENERATED / HUMAN PENDING`

> 2026-09-15 实现边界：v1 已支撑 PX6-0..5 machine candidate。PX6-7 production success 还缺少最终独立审计 ArtifactRef 的无环绑定；当前实现对此 fail-closed，后续通过两步终审握手升级合同，不回写本 v1 机器候选。

对应机器文件：

```text
docs/active/project/contracts/v2_px6_exit_contracts.schema.json
docs/active/project/contracts/fixtures/v2_external_brain/px6-exit-contract-fixtures.json
```

## 1. 设计决定

PX-6 使用独立证据合同，不修改 Human Review v3。Human Review v3 继续描述 G1..G7 的人工判断；`ReviewSubmission v1` 作为外层信封，额外绑定 T04.1 ExitManifest、MachineExitAudit 和用户明确确认文本。

不引入 PKI。当前可信边界是：人类在对话或审查渠道给出明确文本，实施代理把原文、UTF-8 SHA-256、reviewer、reviewedAt 和证据引用落盘；机器只能验证，不得产生或补齐这些值。组织级密码学签名属于后续独立安全阶段。

## 2. 根对象

`v2_px6_exit_contracts.schema.json` 的 root `oneOf` 支持：

```text
CandidateBinding v1
MachineExitAudit v1
EvidenceIndex v1
ReviewRequest v1
ReviewSubmission v1
FinalDisposition v1
PX6CollectionDiagnostic v1
```

所有根对象 `additionalProperties=false`，JSON 为 UTF-8 无 BOM。ArtifactRef 使用 POSIX 相对路径、原始字节 SHA-256、byteLength、mediaType 和封闭 artifactRoot。

## 3. CandidateBinding

只允许绑定一条 T04.1 候选：

```text
t04RunId
exitManifestRawSha256
exitManifestContentSha256
exitManifest: ArtifactRef(t04_candidate)
publicEvidenceArchive: ArtifactRef(t04_candidate)
independentImplementationAudit: ArtifactRef(t04_external_audit)
independentAuditFatal = 0
independentAuditMajor = 0
artifactRootConsistency = closed
```

Runner 必须由实施授权摘要读取精确 binding，不得扫描目录并自动挑选 newest run。T04 原 LIMITED PASS 候选只能作历史输入，不得伪装成已关闭 Minor 的 T04.1 候选。

T04.1 必须同时保留原始 `invocation-record.json` 与 `resolved-invocation-record.json`。前者继续满足 T03 InvocationRecord 合同和重放比较；后者满足 `v2-px-replay-invocation-record/v1`，并由 `replayLane.actualInvocation` 引用。PX-6 只把后者作为可解析执行证据，不接受 alias map 或直接改写原始记录。

## 4. MachineExitAudit 与 EvidenceIndex

MachineExitAudit 固定 PX6-A01..A16。机器阶段成功时 A01..A14 为 passed，A15/A16 为 pending；status=`waiting_for_human_review`，Human/G7/final=`pending/pending/false`。任何 failed 都必须 status=`blocked` 并至少一个 canonical failure code。

EvidenceIndex 完整列举 candidate、machine、review 和 final artifact。`waiting_for_human_review` 时 human/final 集合必须为空；不能预写未来路径或 hash。

## 5. ReviewRequest 与 ReviewSubmission

ReviewRequest 固定 G1..G7，每项必须提供：

```text
precondition
actions[]
expectedObservations[]
threshold
evidenceRefs[]
failureDisposition
```

ReviewSubmission 只允许 `passed|failed`，不允许 pending。它必须绑定 candidate ExitManifest raw hash、MachineExitAudit raw hash 与一份通过既有 `v2-external-brain-human-review/v3` Schema 的 `humanReview` ArtifactRef，并携带 reviewAuthorization 原文/hash、reviewer、reviewedAt、G1..G7 逐项状态、证据和 notes。外层字段与 Human Review v3 内容必须逐项一致；不一致时 fail closed，不选择任一侧覆盖另一侧。

`passed` 要求所有 Gate passed、每 Gate 至少一个 ArtifactRef、blockingIssues 为空；`failed` 要求至少一个 Gate failed、blockingIssues 非空、使用 failure claim。

## 6. FinalDisposition

Finalizer 重新读取 CandidateBinding、MachineExitAudit、ReviewSubmission 和所有 evidence refs。只有 production acceptance、Human passed、G7 passed、A01..A16 passed、blockingIssues 为空时，才允许 `finalPassed=true` 和有限成功声明。

Contract fixture 只能使用：

```text
PX-6 contract fixture passed; not product acceptance evidence.
```

Production 通过只能使用：

```text
V2-PX External Brain Productization passed dual-container real-Chrome acceptance.
```

其他产品能力声明一律 `PX6_CLAIM_OR_FINAL_AUDIT_OVERREACH`。

## 7. Hash 与不可变性

- ArtifactRef SHA-256 对路径解析后的原始字节计算。
- `contentSha256` 对删除自身字段后的 `navia_canonical_json_v1` 计算。
- canonical JSON：对象键按 Unicode code point 升序，数组保序，无空白、UTF-8、无 BOM、无尾随换行。
- T04.1 候选及独立审计一旦绑定，不得由 PX-6 修改。
- public archive 排除自身 manifest、ReviewSubmission、FinalDisposition 和后续独立审计，避免自引用与公开人类身份。

## 8. 失败码与负例

FailureCode 和 PX6-N-001..020 requirement registry 以 Schema 的 `x-navia-*` 字段为机器权威。Fixture requirementId、requirementKey、failureCode 和 case 集合必须逐项相等。

Semantic runner 必须执行 raw-byte mutation 或结构化 JSON Patch；不能只读取 case 中的 `expectedFailureCode`。缺观察只生成 PX6CollectionDiagnostic，不得生成 machinePassed 或 finalPassed 候选。

## 9. 兼容与范围

本合同只属于 Evidence Plane，不改变 Extension、Runtime 或 data_service API。现有 Human Review v3 保持兼容；旧 PX-6 `audit-v2-external-brain-exit.mjs` 不兼容本合同并被显式禁止。
