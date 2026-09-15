# T04.1 / PX-6 外部独立文档审查请求

日期：2026-09-14  
审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`  
建议审查结果路径：`docs/active/project/evidence/v2_external_brain_productization/px-6/document-freeze/independent-document-audit.md`

## 1. 审查对象与边界

本轮是文档、Schema、合同夹具和 Draw.io 审查，不是 T04.1/PX-6 实现审查。禁止运行或修改产品代码、Runtime、Chrome、T04 runner、旧 PX generator/validator、PX-6 runner 或 Human Review。

请只读取本轮平铺包；先独立重算 manifest 中 18 个载荷的 SHA-256 和字节数，再开展内容审查。不得用仓库中历史 external package、历史 PASS 报告或目录 newest run 替代本轮载荷。

## 2. 当前事实

```text
T03: LIMITED PASS
T04: LIMITED PASS, Fatal 0 / Major 0 / Minor 1
T04 accepted run: t04-r4-snapshot-revalidation-20260914t105407z
T04 ExitManifest raw SHA-256: 5e492bd50a7dc3a1be5c5d57b7b694601b9563f4c6f79871b72093b3e56316cd
T04 independent audit raw SHA-256: cd64f8dbe685be7e252f65b1226a248885eb7b1a642651cd58c79ba752090c9b
T04.1: DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO
PX-5: FAIL / REOPENED
PX-6: DOCUMENT CANDIDATE / IMPLEMENTATION BLOCKED
Human Review / G7 / final: pending / pending / false
RKM: NOT IMPLEMENTED
```

T04.1 只能在未来授权后统一 replay root，并用全新空目录完整重跑 R4-P、R4-E、T02、T03、T04；旧 T04 候选不可修改。PX-6 只能在 T04.1 新候选独立审计 Fatal 0/Major 0 后进入实现。

## 3. 必审问题

请至少回答：

1. active PRD、架构、开发、验收、stage gate 与 8 页 Draw.io 是否使用同一状态和顺序。
2. T04.1 是否能无歧义关闭根 `replay_validation` 与 step `validation_run` 不一致，且拒绝局部补证据或复用旧 R4-E。
3. PX-6 是否只绑定单一明确 T04.1 candidate，能拒绝 newest-run、hash 漂移、跨 run 和候选回写。
4. `CandidateBinding -> MachineExitAudit -> ReviewRequest -> ReviewSubmission -> FinalDisposition` 是否单向无环、无自引用。
5. 17 scenario、12 source、20 route cell、12 Forget chain、4 fault、4 viewport、63/109/42、14/25 是否保持独立固定分母。
6. A01..A16、H01..H07、N001..N020 是否精确、无 N/A、有人类前置/操作/观察/阈值/失败处置。
7. Schema 是否通过 Draft 2020-12 元校验；7 个根正例是否通过；20 requirement/key/layer/failure/case 是否一一相等。
8. 重复 A01 或 G1、blocked ready claim、自动 reviewer、Human pending + final true、fixture success claim 提升是否会被拒绝。
9. Human Review v3 与外层 ReviewSubmission 的职责是否清楚；自动化是否仍有路径制造 reviewer、reviewedAt 或 passed。
10. 旧 `apps/chrome-extension/e2e/audit-v2-external-brain-exit.mjs` 是否已明确禁用，而不是作为 fallback。
11. Draw.io 是否不超过 8 页、中文、无重复 ID/越界/断裂，并足以评估架构风险、PRD 偏移和出门风险。
12. 是否存在任何把文档候选、contract fixture、machine package 或 T04 LIMITED PASS 扩大为 PX-5/PX-6/V2/RAG/RKM PASS 的表述。

## 4. 独立复算要求

- 使用 Draft 2020-12 meta-validator 校验 PX-6 Schema。
- 校验 7 个 `positiveInstances[].instance`。
- 比较 Schema requirement registry 与 fixture cases 的 requirementId、requirementKey、enforcementLayer 和 failureCode。
- 定向变异重复 acceptanceId、重复 gateId、自动提交、G7/final 冲突，确认 Schema 或 semantic contract fail closed。
- 解析 Draw.io XML，统计 page/vertex/edge、每页 ID 唯一性、边引用和 1600x900 几何边界。
- 对照 T04 独立实现审计，只接受其 LIMITED PASS 与 Minor 1，不重新解释为 PX-5 PASS。

## 5. 严重度与决定

```text
Fatal: 会污染历史候选、授权边界、人类身份或允许最终成功声明伪造。
Major: 会导致 T04.1/PX-6 实现分歧、缩小固定分母、跨 run、证据不可重算或 PRD/架构偏移。
Minor: 不改变实现语义且有唯一明确修法的可审性问题。
```

仅当 `Fatal=0 / Major=0` 时，可给出：

```text
T04.1/PX-6 document candidate: CONDITIONAL GO for explicit user implementation authorization.
```

即使文档外审通过，也不得给出 T04.1、PX-5、PX-6、V2 或 RKM 产品 PASS。若有 Fatal/Major，请给出精确文件/行号、复现、影响、最小修复和门禁状态。
