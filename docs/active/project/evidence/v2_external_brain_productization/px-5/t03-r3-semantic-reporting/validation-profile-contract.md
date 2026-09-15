# T03 Validation Profile 与数据流合同

日期：2026-09-13  
状态：`FROZEN / T03 LIMITED PASS / T04 REPLAY INPUT`。T02.5 为唯一 production-positive source，T03 候选 `134804` 已取得限定独立通过；本合同不得因 T04 重放而弱化。

## 1. 数据流

```text
sealed v2-px-raw-run/v2 + artifacts + Git snapshot
  -> production artifact reader
  -> v2-px-derived-facts/v1
  -> shared schema/semantic/AST core
  -> v2-px-production-validation/v1
  -> pending Human Review record
  -> pure report.json + acceptance-report.html renderer
  -> v2-px-production-package/v1
  -> invocation record
```

缺必需观察时改走：

```text
raw reader
  -> v2-px-collection-diagnostic/v1 (passed=false)
  -> exit 2
```

不得在 diagnostic 后继续生成带默认事实的成功 package。

## 2. ArtifactRef

所有引用为相对 package/run root 的 POSIX 路径：

```json
{
  "artifactRoot": "source_run | validation_run | repository_snapshot",
  "path": "raw/raw-run.json",
  "sha256": "64 lowercase hex",
  "byteLength": 123,
  "mediaType": "application/json"
}
```

`artifactRoot` 为必填解析根：`source_run` 指 sealed T02.2 根，`validation_run` 指本次 T03 输出根，`repository_snapshot` 只允许 Git blob reader 以冻结 commit 解析。拒绝绝对路径、`..`、NUL、symlink escape、缺文件、hash/length 不符。Production 拒绝 `virtual/*`；private artifact 只能在本机 reader 使用，不能复制进 public report。缺少或猜测解析根视为 Major。

CLI 参数中的 run、snapshot、output、schema、spec 和 fixture 路径不属于 ArtifactRef。父进程必须在解析参数后立即将它们转成绝对路径，子进程不得依赖继承 cwd。相同输入分别从仓库根、脚本目录和临时目录启动时，除显式 output root 外必须产生相同结果。

## 3. DerivedFacts v1

根字段固定：

```text
schemaVersion=v2-px-derived-facts/v1
evidenceClass=production_acceptance
runId
generatedAt
sealedRawRun: ArtifactRef
generatorImplementation: ArtifactRef
sourceMappings[]
scenarioFacts[]
summary
seal.inputMode=canonical_json_without_seal_v1
seal.contentSha256
```

`sourceMappings[]` 必须包含 `sourceSampleId`、`sourceId`、`workspaceId`、`sourceType`、`contentFingerprint`、`registrationArtifactRef`、`importRequestEventId`、`importResponseEventId`；可选 `operationId`。同一 sourceSampleId/sourceId 不得映射到多个 hash。

`scenarioFacts[]` 复用 Report v12 的 ScenarioResult、Execution Observation v6、Screenshot Metadata v6 事实形状，并增加：

```text
provenance.domActionEventIds[]
provenance.backgroundRequestEventIds[]
provenance.backgroundResponseEventIds[]
provenance.runtimeRequestEventIds[]
provenance.runtimeTerminalEventIds[]
provenance.routeObservationEventIds[]
provenance.containerObservationEventIds[]
provenance.screenshotEventIds[]
provenance.commandResultEventIds[]
provenance.faultEventIds[]
```

每个 ID 必须存在于同 run，符合 kind、segment/navigation/action 顺序和 request terminal 关系；空数组只在该场景明确不适用时允许。Derived facts 的 `passed` 不能由输入布尔继承，必须由实际观察完整性计算。

## 4. ProductionValidation v1

根字段固定：

```text
schemaVersion=v2-px-production-validation/v1
profile=contract_fixture|production_candidate|production_final
validationRunId
sourceRunId
validatedAt
inputs.raw/derived/validator/semanticSpec/registry/fixtureSuite: ArtifactRef
ruleResults[63]
gateResults.G1..G7=passed|failed|pending
contractRegression
productionMutationResults
machinePassed
humanReviewStatus
finalPassed
issues[]
```

每个 rule result：

```text
ruleId
enforcementLayer=schema|semantic
status=passed|failed|pending|not_applicable
failureCode
evidenceRefs[]
notes
```

RuleId、layer、failureCode 必须来自 Validation Contracts v4；`ruleResults` 的唯一 RuleId 集合精确等于 63。当前三个 profile 的 `not_applicable` 集合均为空。Candidate 仅两条 Human 规则可 pending；任何其他 pending/缺记录均使 machinePassed=false。Candidate 的 G1-G6 必须为 passed，G7 为 pending；Final 不允许 pending。

## 5. ProductionPackage v1

根字段固定：

```text
schemaVersion=v2-px-production-package/v1
evidenceClass=production_acceptance
acceptanceProfile=production_candidate|production_final
runId
createdAt
sealedRawRun: ArtifactRef
derivedFacts: ArtifactRef
productionValidation: ArtifactRef
contractRegression: ArtifactRef
humanReview: ArtifactRef
renderedReport: ArtifactRef
acceptanceHtml: ArtifactRef
automatedCandidatePassed
humanReviewStatus
passed
claim
```

`renderedReport` 固定指向 Report v12 JSON，`acceptanceHtml` 指向其只读 HTML 表达。Candidate 无论机器结果如何都必须 `humanReviewStatus=pending`、`passed=false`、使用 not-passed claim；Report v12 的布尔 G7 固定为 false。Final 只有 63 rules、G1-G7、contract regression、production mutations、artifact hashes 和 signed Human Review 全通过才允许 `passed=true`。

ProductionPackage 不包含自己的 hash，避免自引用。父进程在文件落盘后写 `invocation-record.json`；R4 再生成 exit manifest 并由人类签署其 hash。

### 5.1 InvocationRecord v1（P7 内部合同）

`v2-px-invocation-record/v1` 固定记录 `derive -> validate -> report -> package` 四个唯一步骤。每步包含 portable implementation ArtifactRef、`cwdRole`、portable argv、exitCode/signal、stdout/stderr ArtifactRef；公开记录禁止绝对工作区路径。根记录绑定 `validationRunId`、`sourceRunId` 与最终 ProductionPackage ArtifactRef，且固定 `profile=production_candidate`、`exitCode=0`、`passed=true`。InvocationRecord 只能由父编排器在 Package 落盘后写；Package 不得反向引用 InvocationRecord。

## 6. CollectionDiagnostic v1

必填：`schemaVersion`、`runId`、`sourceRawRun`、`generatedAt`、`passed=false`、`missingObservations[]`、`issues[]`、`generatorImplementation`。每个 missing observation 必须记录 requirementId、需要的 numerator/denominator、observed、required、相关 event kinds/scenario IDs。数组至少一项，进程退出码固定 2。

## 7. Profile 精确覆盖

63 RuleId 从 `v2_external_brain_validation_contracts.schema.json` 的 registry 读取。Profile 不是输入报告可修改的字段表：

```text
contract_fixture:
  required = all 63
  pending = []
  notApplicable = []

production_candidate:
  required = all 63 except two human rules
  pending = [
    PX_RULE_FINAL_GATE_OR_HUMAN_REVIEW_FAILED,
    PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID
  ]
  notApplicable = []

production_final:
  required = all 63
  pending = []
  notApplicable = []
```

`PX_RULE_SEMANTIC_POSITIVE_BASE_INVALID` 在 production profile 读取本次 `contractRegression`。`PX_RULE_FIXTURE_EVIDENCE_PROMOTION_INVALID` 拒绝 production 中任何 `virtual/*` 或 contract claim。`PX_RULE_SOURCE_FIXTURE_UNIQUENESS_INVALID` 对 production 执行同等 sourceSampleId 与 originRef+fingerprint 唯一性，不因名称含 fixture 而跳过。

## 8. 纯生成约束

Report renderer 只能读取已经落盘并通过 hash 的 DerivedFacts、ProductionValidation 和 Human Review record。它不得读取尚未生成的 Package、浏览器、Runtime、Git 工作树或当前 source 状态，不得生成 rule/gate/human 结果。相同输入字节必须输出相同事实内容；显示时间只来自输入 `createdAt/validatedAt`。Package 在 renderer 完成后生成并绑定 JSON/HTML，避免自引用。

## 9. CLI 与退出码

计划入口固定为：

```text
derive-v2-px-production-facts.mjs
validate-v2-px-production-package.mjs
generate-v2-px-production-report.mjs
run-v2-px-r3-validation.mjs
```

共同规则：

- `0`：当前 profile 的机器要求满足；candidate 仍必须 final=false。
- `1`：Schema、semantic、AST、hash、mutation、profile 或 package 完整性失败。
- `2`：缺少 production-positive 必需观察，只允许输出 CollectionDiagnostic。
- CLI 未识别参数、路径逃逸或输入不可读视为 `1`，不得回退到默认 fixture。
- 父编排器记录每个子命令的绝对 implementation path、cwd、argv、exitCode、stdout/stderr artifact hash。

## 10. 审查与实施身份

T03 外部实施前审查必须记录审查请求 artifact 和 SHA-256，并声明使用独立 reviewer session。未来代码实施开始前，用户授权摘要另行落盘；其 SHA-256 必须与审查请求不同。该检查只证明输入提示工件不同，不将同一组织或同一模型伪装为完全独立的人类审计。

## 11. Architecture Manifest v2 枚举冻结

`v2-external-brain-architecture-scan-manifest/v2` 的 `symlinkPolicy` 唯一合法值为：

```text
hash_link_target_utf8
```

该值表示符号链接条目的 blob hash 输入是链接目标的 UTF-8 字节。production manifest 禁止 `inlineSource`；实际源码必须由冻结 commit 的 Git blob reader 读取。不得为兼容历史候选接受 `reject` 或其他未注册枚举。未来若修改语义，必须发布新 Schema 版本、迁移文档和负向夹具，不能在 v2 reader 中宽松兼容。
