# PX6-0..5 独立只读出门实施审计

- 候选：`px6-machine-exit-20260914t164500z`（旧 `…163000z` 候选本轮不复用，已弃）
- 审计人：自动化独立审查（read-only，无代码改动）
- 日期：2026-09-15
- 范围：PX6-0..5 机器出门候选 LIMITED PASS / FAIL 二选一；PX6-6 Human Review 与 PX6-7 production finalizer 不在本审计权限内
- 工具：`sha256sum`、`tar -tzvf`、`python3` 标准库、`jsonschema` 4.26、静态源码阅读

## 复算方法

仅依赖：(a) `docs/active/project/external-audit-package/AUDIT_MANIFEST.md` 平铺的 19 个载荷；(b) `git rev-parse 275a7bc` 公开 commit；(c) `tar -xzf` 解包 `19-px6-public-evidence.tar.gz` 到 `/tmp/px6-evidence`。所有 SHA-256/byteLength/contentSha256 由 `python3 + hashlib` 重算；`ExitManifest` canonical JSON 用递归 sorted-key + `(',', ':')` separators，与 `apps/chrome-extension/e2e/lib/v2PxSnapshotReplay.mjs::canonicalJson` 一致。Schema 用 `jsonschema.Draft202012Validator` 对 `$defs/CandidateBinding|MachineExitAudit|ReviewRequest` 做 full-schema 校验；fixture/negative 结果的 `expectedPrimaryFailure` 必须落在 `FailureCode` enum 内（20 个），且 `observed==expected` 且 `passed==true`。

## 11 项复核结果

1. **19 载荷 SHA-256 一致**：`01..19` 全部 sha256 + byteLength 与 `AUDIT_MANIFEST.md` 完全一致（`02-prd 41e7…f00331c1 / 125655`、`03-architecture 216e…6ac651c / 141122`、`15-machine-exit-audit 821d…0e50cd2 / 6454`、`19-public-evidence ae3e…baa2925 / 235032` 等）。
2. **PX-6 Schema meta + 7 positive + 20 registry**：`$id=v2-px6-exit-contracts/v1`、`x-navia-contract-version=v1`、`x-navia-canonical-json=navia_canonical_json_v1`；`positiveInstances` 7（PX6-P-001..007）；`cases` 20；`FailureCode` enum 20；`AcceptanceResult.acceptanceId` pattern `^PX6-A(0[1-9]|1[0-6])$`；`MachineWaitingAcceptanceResults` minItems=maxItems=16。`CandidateBinding|MachineExitAudit|ReviewRequest` 三个实例对 full schema 全部 VALID。
3. **T04.1 ExitManifest binding**：raw `1e37f5ed…ed1f4186` = `exit-manifest.json` sha256（4646 bytes）；canonical content sha256 重算 `618c9c17…8cefff66` == `binding.exitManifestContentSha256`；`implementation-authorization.candidateExitManifestRawSha256` 与 binding 一致；`t041ImplementationAuditSha256` 与 `t04.1-independent-implementation-exit-audit.md` 一致（27197 bytes，`5f48071e…1f0e3dc`）。
4. **Git bundle acceptance commit + 1152 + R4-P/R4-E**：`snapshotCommit 275a7bc8a1ece67a60b1762ef7e295d6f13dab2a`（commit message "T04 isolated acceptance snapshot"）；`dependencyClosure.files=1152`、`importEdges=38`、`missingEdges=0`、`undeclaredReads=0`、`unexpectedFiles=0`、`closureSha256=0bb85171…827ff`；`false-green-audit.md` 自报 `R4-P exact=10 / normalized=1 / logs=8`、`R4-E 单 run 单 seal`、`T04 negatives=25/25`、`T04.1 root negatives=8/8`。
5. **17/12/20/12/4/4/0/0/5 分母**：candidate-binding 全部命中；`derived-facts.summary` 自带 `sourceCount=12`、`sourceDistribution=web6+note3+local3`、`routeMatrix` 五类 5×4=20、`durableForgetRecoveries=12`、`faultTypes=4`、`screenshotWidths={360,420,768,1280}` 4 视口、`axe.serious=0 / critical=0`、`keyboard.assertionsPassed=5/5`。
6. **63/109/42 + T04 14/25 + T04.1 14/8**：`production-validation.ruleResults=63`（61 passed / 2 human-pending）；`contractRegression.total=109 passed=109`；`productionMutationResults.total=42 passed=42`；`t04-0-result.json` `acceptanceIds=14 requirements=25 failureCodes=22`，与 `false-green-audit.md` 的 `T04 14/25` 一致；`px6-4-result.json` `negativeRequirements=20 passed=20`。
7. **PX6-N-001..020 真实执行**：20 个负例在 `10-v2-px6-exit-audit.mjs` 行 398..423 各自绑定到真实 mutation executor（`semanticCheck`/`validateContentSha256`/`validateLegacyInvocation`/`validateDenominators`/`validateRecomputedFacts`/`validateProductionDenominators`/`validateActiveDocuments`/`validateReviewSubmissionSemantics`/`validateFinalState`），mutation 类型 7 种（`raw_byte`/`artifact_graph`/`invocation`/`json_patch`/`provenance`/`repository_snapshot`/`downstream_artifact`），非简单回显；`observedPrimaryFailure == expectedPrimaryFailure` 且全部 `passed=true`。
8. **A01..A14 passed / A15-A16 pending**：`machine-exit-audit.json` `acceptanceResults` 16 项，A01..A14 全 passed 且 `evidenceRefs` 单元素指向 `px6_run` 内部引用；A15/A16 `status=pending`、`evidenceRefs=[]`；`status=waiting_for_human_review`、`humanReviewStatus=pending`、`g7Status=pending`、`finalPassed=false`、`machinePassed=true`、`issues=[]`。
9. **机器公开包 22 成员 + 无 human/final/identity/success**：tar 列出 22 个 member（17 顶层 + 5 base64）；`machine-package-member-index.json` 列 21 file 路径（不含自指），全部 sha256/byteLength 与解包后字节一致；policy `machine_only_excludes_human_identity_final_artifacts_and_self_manifest`；`machine-boundary.json` 显式 `reviewerFieldsGenerated=false / reviewSubmissionGenerated=false / finalDispositionGenerated=false / finalPassed=false`；`machine-exit-audit.json` claim 仅为 `PX-6 machine review package is ready for human review.`，未触发 PX-6/V2/RAG/RKM 通过字样；`human-review-checklist.md` 顶部明文 `本文件不构成签署`；`final-review.html` 文末 `本页只读，不提供自动通过按钮`。
10. **5 个 base64 snapshot 可恢复 + sourceSha256/sourceByteLength 一致**：strict base64 解码后 SHA-256/byteLength 全部 == `document-drawio-audit.json` 中 `sourceSha256/sourceByteLength`，且与权威源 `01-prd.md (41e7…f00331c1/125655)`、`02-architecture.md (216e…6ac651c/141122)`、`04-acceptance-plan.md (59e0…5a10bc95/131796)`、`stage-gates/v2-external-brain-productization.md (0c44…890e121/18140)`、`design/v2-memory-personal-knowledge-base-gap.drawio (b532…e514222e/68721)` 全部一致；`document-drawio-audit.json` 自身 `activeDocuments=4`、`drawioPages=8`、`duplicateIds=0`、`outOfBounds=0`、`brokenReferences=0`。
11. **PX6-7 fail-closed 且不属于 PX6-0..5**：`px6-7-final-audit-handshake-risk-stop.md` 显式 `MAJOR / PRODUCTION FINALIZER FAIL-CLOSED`；`buildFinalDisposition` 对 `production_acceptance` 默认抛 `PX6_CLAIM_OR_FINAL_AUDIT_OVERREACH`；`candidate-binding` 仅覆盖 `px6_run` 中 `px6-0..px6-5`，`px6-7` 不在 machine-package-member-index；machine-exit-audit `G7=pending`、`finalPassed=false`，未被误扩张为 PX6-0..5 失败。

## Fatal / Major / Minor 分类

- **Fatal: 0**。19 载荷与权威源 SHA-256/byteLength 完全一致；ExitManifest raw/content/audit binding 全部闭环；5 个 base64 snapshot 严格解码回原始字节并等于 `sourceSha256/sourceByteLength`；member index 21 file 与 tarball 一致；schema 实例 VALID；分母与规则数与 `px6-2-result.json`、`px6-4-result.json`、`t04-0-result.json` 自报一致；负例非回显。
- **Major: 0**。PX6-7 已独立 fail-closed，未渗入 PX6-0..5；machine-boundary 三个 boolean 全 false；无 reviewerFields/reviewSubmission/finalDisposition 生成；claim 仅限 "ready for human review"；无 H01..H07 签署代签。
- **Minor: 0**（本审计仅观察 11 项；`human-review-checklist.md` 中 6 处 `由人类填写 passed/failed` 属预期空位，非缺陷）。

## 允许 / 禁止声明

- 允许授予：`PX6-0..5 machine candidate LIMITED PASS`；`PX6-6 human review pending`；`PX6-7 production finalizer blocked`。
- 禁止授予：PX-6 / PX-5 / V2 / RAG / RKM 通过；H01..H07 任一项签署；`finalPassed=true`；`automatedApprovalAllowed=true`；任何 `final-report.json` / `final-report.html` / `review-submission.json` 落地。

## 残余风险

1. **未独立重启 generator/validator**。本审计只读 + jsonschema + canonical-JSON 复算；未调用 `run-v2-px-6-exit-audit.mjs` 重新跑端到端流水线。若用户后续要求双跑，需在同一 commit `275a7bc8` 与同一 t04RunId 下重放并交叉对账。
2. **依赖 T04.1 历史独立审查结论**。`t04.1-independent-implementation-exit-audit.md` 的 Fatal=0/Major=0 由先前轮次给出，本审计未逐行复核其 R4-P/R4-E 推导链；结论以其 sha256/byteLength 与本轮 evidence 一致为前提。
3. **public 公开包不包含 px6-5-result.json**。`px6-5` 是 px6_run 内部 stage（22 成员策略），未进 19-tar；本审计仅按 member index 验证其不在公开包内符合 `machine_only_excludes_…_self_manifest` 政策，但若用户要求把 `px6-5-result.json` 也公开化，须新增路径并重算 index。
4. **RAG/RKM/PX-5 链路未独立复算**。PX-5 当前为 FAIL / REOPENED，本审计未触及；不允许借此报告复活 PX-5、V2、RAG、RKM 任一项。
5. **Schema 校验模式注意**。`fixtures/08-px6-contract-fixtures.json` 因 `claim` 字段不属于 `MachineExitAudit.claim` 的 enum，对 full schema VALID 失败（属预期：fixtures 是 generator 输入，不是 contract 输出）。已用 `FailureCode` enum 子校验替代，20/20 覆盖。

## 结论

- `PX6-0..5 machine candidate: LIMITED PASS`（independentAuditFatal=0 / independentAuditMajor=0 / artifactRootConsistency=closed；A01..A14 passed、A15/A16 pending；PX6-7 fail-closed 且未渗入本候选；机器公开包 22 成员可重建且无 human/final/identity claim）。
- `PX6-6 Human Review / H01..H07: pending`，仅真实人类可签。
- `PX6-7 production finalizer: blocked`，待两步握手 contract freeze。
- `PX-6 / PX-5 / V2 / RAG / RKM: NOT PASSED`，本审计不代签。