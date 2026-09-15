# PX-6 自动化开发停止与人类交接

日期：2026-09-15  
状态：`PX6-0..5 LIMITED PASS / PX6-6 HUMAN-ONLY / PX6-7 FAIL-CLOSED`

## 1. 已完成的自动化范围

- 候选：`px6-machine-exit-20260914t164500z`。
- T04.1 raw/content/public/audit 单一绑定通过。
- raw -> facts、TypeScript AST、17/12/20/12/4/4/0/0/5、63/109/42、T04 14/25、T04.1 14/8 全部重算。
- PX6-N-001..020 为 20/20。
- A01..A14 passed；A15/A16 pending。
- 5 份候选时点文档原始字节以 Base64 快照冻结并可恢复。
- machine-only tar 为 22 成员，SHA-256 `ae3e1cf59adb77906a13873e2a0ffc6b835bdd8a49e1a57567a0d0645baa2925`。
- 独立实施审计 Fatal 0 / Major 0 / Minor 0，SHA-256 `d43f8f98b46e1813d95894830032074572b4fd6834e642e7ec4447217ac42f50`。

## 2. 人类操作入口

```text
docs/active/project/evidence/v2_external_brain_productization/px-6/
  runs/px6-machine-exit-20260914t164500z/
    final-review.html
    human-review-checklist.md
    review-request.json
    evidence-index.json
```

真实人类必须在可见 Chrome 逐项执行 H01..H07，并形成受合同约束的 ReviewSubmission。自动化不得填写 reviewer、reviewedAt、通过状态或成功声明。

## 3. 自动化开发停止原因

1. PX6-6 是 PRD 明确的人类体验与有限声明签署门槛，不可由代理或 headless 自动化替代。
2. PX6-7 的现有合同无法在 FinalDisposition 生成前绑定“最终独立审计 Fatal=0/Major=0”，存在审计对象循环。
3. production finalizer 已对该路径返回 `PX6_CLAIM_OR_FINAL_AUDIT_OVERREACH`，因此不存在静默假绿。

## 4. 恢复条件

- 人类完成 H01..H07，并提供 ReviewSubmission 或失败 blocker。
- 用户明确批准 `FinalizationCandidate -> IndependentFinalAudit ArtifactRef -> FinalDisposition` 两步合同路线。
- PX6-7 先回到文档阶段，完成 Schema、CLI、负例、开发计划、验收计划、Draw.io 和独立文档审查，再进入实现。

恢复前禁止声明 PX-6、PX-5、V2、RAG 或 RKM 通过，也禁止开始 RKM-0..5 产品实现。
