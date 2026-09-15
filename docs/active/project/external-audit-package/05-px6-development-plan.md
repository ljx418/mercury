# V2-PX-6 人工出门与最终声明开发计划

日期：2026-09-14  
状态：`FROZEN / PX6-0..5 LOCAL MACHINE CANDIDATE / INDEPENDENT AUDIT + HUMAN REVIEW PENDING`

> 2026-09-15 实施注记：PX6-0..5 固定本地 machine-only 审计候选为 `px6-machine-exit-20260914t164500z`；不同 reviewer 的实施出门审计尚未完成。PX6-6 仍只能由人类执行。实现期发现 PX6-7 在 FinalDisposition 生成前后存在最终独立审计绑定循环，production finalizer 已 fail-closed，需在 H01..H07 后返回文档阶段冻结两步终审握手。

## 1. 阶段目标

PX-6 不新增产品功能。它读取通过独立审计的单一 T04.1 候选，生成可重复验证的机器审查包，等待真实人类完成双容器体验，再验证人类提交并重算 G7 与最终有限声明。

PX-6 不修改 T04.1 的 raw、Report、ProductionValidation、SnapshotRevalidation、ExitManifest 或 public archive。所有 PX-6 产物进入新的 `px-6/runs/<px6RunId>/`。

## 2. 强制前置

```text
T04.1 independent implementation audit: Fatal=0 / Major=0
T04.1 artifactRoot inconsistency: closed
T04.1 ExitManifest: signed=false, Human/G7/final=pending/pending/false
PX-6 external document audit: Fatal=0 / Major=0
PX-6 implementation authorization: explicit user instruction required
```

任一前置不满足时只生成 `PX6CollectionDiagnostic`，退出码 2，不创建等待人审或最终候选。

## 3. 代码实体与边界

未来授权后的目标实体：

| 状态 | 实体 | 职责 |
|---|---|---|
| 待新增 | `e2e/run-v2-px-6-exit-audit.mjs` | 唯一 orchestrator；顺序执行 PX6-0..5 或 PX6-7 |
| 待新增 | `e2e/lib/v2PxExitAudit.mjs` | 纯 reader/validator；从 ArtifactRef 原始字节重算机器事实 |
| 待新增 | `e2e/lib/v2PxHumanReviewSubmission.mjs` | 只验证人类已提交的 ReviewSubmission，不产生 reviewer/时间/结论 |
| 待新增 | 对应 `*.node-test.mjs` | 合同、状态机、hash、跨 run、自动代签和 claim 负例 |
| 禁止使用 | `e2e/audit-v2-external-brain-exit.mjs` | 旧 PX-6 脚本；读取旧 PX-5 根目录并调用旧 validator，必须 fail closed |

产品入口、Workspace、Runtime、Adapter、data_service 与公共知识 API 不在允许修改范围。

## 4. 实施阶段

### PX6-0 合同冻结

冻结 `v2_px6_exit_contracts.schema.json`、20 条 requirement/failure registry、正例和 RFC 6902/semantic 负例。合同通过 Draft 2020-12 元校验和实例校验后才进入 PX6-1。

### PX6-1 单一候选 Reader

只接受实施授权摘要中指定的 T04.1 runId、ExitManifest 原始 SHA-256、contentSha256、public archive SHA-256 和独立审计 SHA-256。读取所有引用原始字节并重算；禁止目录搜索后选择“最新候选”。R4-P 的原始 `invocation-record.json` 只用于确定性比较；PX-6 的 `actualInvocation` 必须解析到 `resolved-invocation-record.json`，并按 `v2-px-replay-invocation-record/v1` 验证所有内部引用均为 `replay_validation`。

### PX6-2 Machine Exit Audit

重算 T04.1 的 A01..A14、N001..N025、63 rules、109 contract fixtures、42 mutations及完整生产分母。Report/Gate 自报布尔值不是输入。成功输出状态最多为 `waiting_for_human_review`。

### PX6-3 Review Request

生成 `review-request.json`、`evidence-index.json`、`human-review-checklist.md` 和 `final-review.html`。每个 G1..G7 项含前置、用户操作、预期观察、阈值、ArtifactRef 和失败回退；HTML 只读，不提供自动“通过”按钮。

### PX6-4 False-Green Regression

执行 PX6-N-001..020。任何 stale candidate、hash 漂移、跨 run、缩小分母、旧 validator、自动 reviewer、部分 Gate、错误 claim 或最终状态越权都必须返回 canonical failure code。

### PX6-5 Machine Package

生成 machine-only package，状态固定：

```text
machinePassed=true
status=waiting_for_human_review
humanReviewStatus=pending
g7Status=pending
finalPassed=false
```

然后强制停止并等待人类，不继续执行 PX6-6/7。

### PX6-6 Human Review

人类从 Side Panel 真实入口开始，在可见 Chrome 中执行验收计划 H01..H07。人类通过独立输入文件提交 reviewer、reviewedAt、逐 Gate 状态/证据、blockingIssues 和明确确认文本；自动化不得创建、补齐或推断这些字段。

### PX6-7 Finalization

仅在存在有效 ReviewSubmission 时运行。重新读取 machine package、T04.1 候选和人类证据，验证用户确认文本 SHA-256，重算两个 pending human rules、G7 和 final。生成 FinalDisposition、最终 JSON/HTML 和独立审计请求；不得回写 T04.1。

## 5. 状态机与退出码

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

CLI 参数固定为 `--candidate-binding <absolute-json> --output-root <new-empty-dir>`；PX6-7 额外要求 `--review-submission <absolute-json>`。相对路径、非空 output root、symlink escape 或未注册环境变量一律拒绝。

## 6. 产物

```text
px-6/runs/<px6RunId>/
  candidate-binding.json
  machine-exit-audit.json
  evidence-index.json
  review-request.json
  human-review-checklist.md
  final-review.html
  contract-fixture-results.json
  logs/
  review-submission.json             # 仅人类提交后存在
  final-disposition.json             # 仅 PX6-7 后存在
  final-report.json/html             # 仅 PX6-7 后存在
  public/px6-public-evidence.tar.gz
```

Machine package 不得包含 `review-submission.json` 或 success claim。最终包必须排除本包自身 manifest 与后续独立审计，避免自引用。

## 7. 允许声明与停止条件

机器阶段最多声明：`PX-6 machine review package is ready for human review.`

只有 Human Review passed、G7 passed、finalPassed=true 且最终独立审计 Fatal=0/Major=0 后，才允许：`V2-PX External Brain Productization passed dual-container real-Chrome acceptance.`

不得声明完整外脑、RAG ready、自动遗忘、Knowledge Dream Cycle、默认本地文件读取、真实 data_service 已产品化或 V2 全部完成。
