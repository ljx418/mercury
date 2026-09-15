# PX6-7 最终独立审计握手风险停止

日期：2026-09-15  
状态：`MAJOR / PRODUCTION FINALIZER FAIL-CLOSED`

> 2026-09-15 状态更新：PX6-0..5 候选 `px6-machine-exit-20260914t164500z` 已通过独立实施出门审计（Fatal 0 / Major 0 / Minor 0），审计 SHA-256 为 `d43f8f98b46e1813d95894830032074572b4fd6834e642e7ec4447217ac42f50`。本 Major 仍只阻塞 PX6-7；PX6-6 H01..H07 尚未由真实人类执行。

## 问题

冻结计划要求最终成功同时满足“最终独立审计 Fatal=0/Major=0”，但当前 CLI 只有：

```text
--candidate-binding
--output-root
--review-submission
```

`FinalDisposition v1` 也没有独立终审 ArtifactRef。若 PX6-7 在生成待审 FinalDisposition 时直接填写 `PX6-A16=passed`、`finalPassed=true` 和生产成功 claim，会先于外部终审产生假绿；若等待终审，审查者又没有 FinalDisposition 可审，形成循环。

## 当前处置

- PX6-0..5 不受影响，继续停在 waiting/pending/pending/false。
- `buildFinalDisposition` 对 `production_acceptance` 默认返回 `PX6_CLAIM_OR_FINAL_AUDIT_OVERREACH`。
- contract fixture 仍可用于状态机单测，但不能提升为产品证据。
- 不生成生产 ReviewSubmission、FinalDisposition 或成功 claim。

## 文档阶段候选修复

在真实人类 H01..H07 后返回 PX6-7 文档/合同阶段，冻结两步握手：

```text
PX6-7a HumanReview validated -> FinalizationCandidate(finalPassed=false)
independent reviewer audits candidate -> IndependentFinalAudit ArtifactRef
PX6-7b consumes exact audit raw hash -> FinalDisposition(finalPassed=true|false)
```

需要同步升级 Schema、CLI、20 项 registry 中的 A16/claim 负例、开发计划、验收计划和 Draw.io。未经用户批准不得自行选择弱化路线。

## 当前自动化停止门槛

```text
PX6-0..5: LIMITED PASS
PX6-6: PENDING / HUMAN-ONLY
PX6-7: BLOCKED / DOCUMENT-CONTRACT DECISION REQUIRED
PX-6 final: NOT PASSED
```

恢复条件：真实人类先依据 `px6-machine-exit-20260914t164500z/human-review-checklist.md` 在可见 Chrome 完成 H01..H07；随后用户明确批准上述两步握手合同路线，才能进入 PX6-7 文档冻结、独立文档审查和实现。
