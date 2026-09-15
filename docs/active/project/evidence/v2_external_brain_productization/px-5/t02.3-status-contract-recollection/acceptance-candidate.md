# T02.3 故障状态合同重采验收候选

日期：2026-09-14
状态：`LOCAL CANDIDATE PASS / INDEPENDENT REVIEW PENDING`

## 1. 候选身份

```text
runId: t02-r2-status-contract-production-input-20260914T001017
snapshotCommit: 98d3a8be12cd168d10993e996a95e1e11e59c184
raw SHA-256: 7fd641697f508c9e9fb81ab2d3af8a1248b1df61e90c83346617f9b2596266a1
seal contentSha256: 430207668675497c9a9d5b22f8539ae66537c72a172ed35d18fafe8e28ba8270
events: 1375
artifacts: 1158 (1152 public + 6 private_local_only)
Status responses checked: 203
Status schema errors: 0
```

该 run 是唯一 T02.3 候选。此前四个失败 run 均无 sealed raw，不得与本候选拼接。

## 2. 固定分母结果

| 门槛 | 本地结果 |
|---|---|
| T02.3-A01 范围 | PASS：仅 R2 runner/helper/test/verifier 与证据文档；产品、Runtime、API、Schema 0 修改 |
| T02.3-A02 独立性 | PASS：新 snapshot/run/build/profile/runtime/database/raw/seal；旧三轮 raw/seal hash 未变 |
| T02.3-A03 故障动作 | PASS：blocked/configure_adapter、unreachable/reconnect、failed/retry_source_build |
| T02.3-A04 Status 原始字节 | PASS：203/203 通过冻结 Draft 2020-12 Schema，0 error |
| T02.3-A05 seal 前校验 | PASS：校验 artifact 已纳入 sealed raw；错误分支在 `seal()` 前退出 |
| T02.3-A06 旧基线 fail closed | PASS：旧 T02.2 为 178 checked / 7 retry errors；未归一化 |
| T02.3-A07 入口/来源/路由 | PASS：2/2/3 三入口；12 source；5 route x 4 mode；2 route recovery |
| T02.3-A08 durable Forget | PASS：12 trigger + 12 trusted recovery + 12 authority absence |
| T02.3-A09 UX/故障 | PASS：Permission 3、fault 4、四视口、Axe 0 serious/critical、Keyboard 5/5 |
| T02.3-A10 全量前置 | PASS：build/typecheck、collector 15、frontend 169、Runtime 307、T01 Chrome 36 |
| T02.3-A11 完整性 | PASS：557 Runtime requests = 540 responses + 17 failures；0 orphan；hash/seal/privacy PASS |
| T02.3-A12 清理/隔离 | PASS：候选及四个失败 run 均 cleanup 4/4；失败 run 全部 unsealed |
| T02.3-A13 独立审查 | PENDING：外部 Fatal 0 / Major 0 尚未落盘 |

本地完整目录 verifier 与公开归档 verifier 均为 `34/34`。公开归档共 2401 个成员、0 private file；最终归档 SHA-256 见审计清单。

## 3. 门禁结论

```text
T02/T02.1/T02.2 limited PASS: preserved
T02.3: CANDIDATE PASS, pending independent Fatal 0 / Major 0
T03 implementation: NO-GO
T04 / PX-6 / RKM: BLOCKED
PX-5: FAIL / REOPENED
```

本候选不得被解释为 T03、PX-5、PX-6、V2、RAG 或自动知识维护通过。
