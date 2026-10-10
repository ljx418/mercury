# V3-3..V3-7 首轮外部文档审查反馈闭环

日期：2026-10-06。性质：针对首轮独立只读审查 `Fatal=0 / Major=0 / Minor=3` 的候选修订记录；本文件不替代复审结论，不放行任何产品实现。

## 1. 首轮反馈

| ID | 外审问题 | 风险 |
|---|---|---|
| M-1 | 云端画面 consent 与每次 dispatch、撤销屏障之间主要依赖语义 verifier，Schema 未固定逐请求回执 | 撤销后请求或未绑定授权请求可能通过结构校验 |
| M-2 | seek 的 `<=2s` 与页面 identity、Human judgment 与 overall decision 主要依赖语义 verifier | 假 located 或人工总判定假绿可能通过结构校验 |
| M-3 | evidenceId 只受格式约束，引用闭合和跨 task 拒绝主要依赖语义 verifier | 未闭合引用可能被错误发布 |

## 2. 修订

### M-1 逐 dispatch 授权

- `ConsentReceipt` 新增并强制 `authorizedDispatchCount`、`postRevocationDispatchCount=0`、`consentCheckedPerDispatch=true`。
- `VisionObservation` 新增 `consentDecisionId`、`dispatchSequence`、`consentValidAtDispatch=true`。
- 正例、V3-3 开发/验收/威胁模型和负例测试同步；Schema 拒绝撤销后 dispatch、未逐次复查和无效 dispatch consent。

### M-2 seek 与人工总判定

- `SeekObservation` 新增必填 `deltaMs`，Schema 固定 `0..2000`；`outcome=located` 时 `pageIdentityMatched=true`。
- semantic verifier 继续独立复算 `deltaMs=abs(observedMs-requestedMs)`，避免客户端伪造差值。
- Human Review Schema 强制：overall PASS 时十项必须全 PASS；overall FAIL 至少一项 FAIL 且不得含 BLOCKED；overall BLOCKED 至少一项 BLOCKED。
- 正例、V3-5 开发/验收/威胁模型和负例测试同步。

### M-3 evidence 闭合

- `TransactionReceipt` 新增并强制 `unresolvedEvidenceReferenceCount=0`、`crossTaskEvidenceReferenceCount=0`、`projectionEvidenceClosurePassed=true`。
- 语义 verifier 仍逐 ID 对照 catalog/task，Schema receipt 负责拒绝非零闭合计数和未通过 projection closure。
- 正例、V3-4 开发/验收/威胁模型和负例测试同步。

## 3. 复算结果

- `test_v3_media_pipeline_contracts.py` + `test_v3_media_product_contracts.py`：`43 passed`。
- 4 份变更 Schema 均由上述测试执行 Draft 2020-12 meta-validation。
- vision/outline/product/human 四类正例均通过。
- 新增负例覆盖 3 类 consent dispatch、3 类 evidence closure、seek delta、located identity、false overall PASS 和 BLOCKED precedence。

## 4. 决定

`READY FOR EXTERNAL DOCUMENT RE-AUDIT / ALL IMPLEMENTATION NO-GO`。

复审必须独立重算源码 hash、Schema/positive/negative，并明确首轮 M-1..M-3 是否关闭。V3-2 未出门、RapidOCR/VLM 精确依赖未冻结及后续真实 build/tooling 不存在等实施前置继续保留。
