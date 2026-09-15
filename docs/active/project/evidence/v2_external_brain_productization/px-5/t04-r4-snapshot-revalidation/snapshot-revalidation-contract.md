# T04 Snapshot Revalidation 机器合同

日期：2026-09-14  
状态：`T04 LIMITED PASS / T04.1 REMEDIATION DOCUMENT CANDIDATE`

对应机器文件：

```text
docs/active/project/contracts/v2_px_snapshot_input_manifest.schema.json
docs/active/project/contracts/v2_px_snapshot_revalidation.schema.json
docs/active/project/contracts/v2_px_exit_manifest.schema.json
```

三份文件已由 `Draft202012Validator.check_schema` 独立元校验通过。T04-0 仍须物化根正例、缺必填负例、25 项 semantic negative runner；元校验通过不等于 T04 实现通过。

## 1. 公共定义

三个根合同均采用 JSON Schema Draft 2020-12、`additionalProperties=false`、UTF-8 无 BOM。SHA-256 对文件原始字节计算；canonical JSON 只在字段明确写 `canonicalJsonSha256` 时使用：对象键按 Unicode code point 升序，数组保持原序，无多余空格、无尾随换行。

`ArtifactRef` 复用 T03 定义：

```text
artifactRoot = source_run | baseline_validation | replay_validation |
               fresh_source_run | fresh_validation | repository_snapshot | t04_run
path          = relative POSIX path; no absolute, .., NUL or symlink escape
sha256        = 64 lowercase hex over raw bytes
byteLength    = integer >= 0
mediaType     = non-empty string
```

每个引用必须由 root map 唯一解析。相同 path 位于不同 root 时不得省略 `artifactRoot`。T04.1 保留 T03 原始 `invocation-record.json` 的 `validation_run` 引用，仅用于确定性比较；另以 `artifact_root_rebase_validation_to_replay_v1` 派生 `resolved-invocation-record.json`。新候选的 `actualInvocation` 必须引用该派生文件，派生文件内 sourceInvocation、productionPackage 及 `steps[*].implementation/stdout/stderr` 必须全部精确为 `replay_validation`；`validation_run` 不得作为派生记录的 alias 或兼容值。

## 2. SnapshotInputManifest v1

权威 `$id`：`https://navia.local/schemas/v2-px-snapshot-input-manifest/v1`。

必填根字段：

```text
schemaVersion = v2-px-snapshot-input-manifest/v1
evidenceClass = production_acceptance
t04RunId
createdAt
baseline
governance
snapshot
dependencyClosure
environment
replayPolicy
freshLanePolicy
humanBoundary
```

### 2.1 baseline

```text
sourceRunId
sealedRawRun: ArtifactRef(source_run)
sealSha256
sourceSnapshotCommit = 430cddcb7ff618978851af1f3b9a3c48f2370d36
t03ValidationRunId = t03-r3-production-exit-candidate-20260914T134804
t03CandidateRoot: ArtifactRef(baseline_validation)
t03IndependentAudit: ArtifactRef
forbiddenCandidateIds = [t03-r3-production-exit-candidate-20260914T132413]
```

`forbiddenCandidateIds` 是精确非空集合，不能仅靠命名前缀推断。

### 2.2 governance

```text
externalDocumentAudit: ArtifactRef(repository_snapshot)
externalDocumentAuditFatal = 0
externalDocumentAuditMajor = 0
implementationAuthorization: ArtifactRef(repository_snapshot)
authorizationRecord: frozen object parsed from implementationAuthorization
approvedScope = T04-0..T04-7 implementation
```

两个 ArtifactRef 的路径固定为：

```text
externalDocumentAudit.path = docs/active/project/evidence/v2_external_brain_productization/
  px-5/t04-r4-snapshot-revalidation/independent-document-audit.md
implementationAuthorization.path = docs/active/project/evidence/v2_external_brain_productization/
  px-5/t04-r4-snapshot-revalidation/implementation-authorization.json
```

T04-0 启动前必须同时解析外部文档审查原始字节和用户批准后生成的实施授权摘要，重算 ArtifactRef。授权 JSON 使用 UTF-8、无 BOM、canonical JSON，必填字段固定为：

```text
schemaVersion = v2-px-t04-implementation-authorization/v1
stage = T04
decision = approved
approvedScope = T04-0..T04-7 implementation
userInstructionText
userInstructionSha256
externalDocumentAuditSha256
authorizedAt
recordedBy
```

`authorizationRecord` 必须与授权 JSON 解析结果逐字段相等。`userInstructionSha256` 对 `userInstructionText` UTF-8 原始字节计算；`externalDocumentAuditSha256` 必须等于 governance 外审 ArtifactRef 的 hash；对象内外 `approvedScope` 必须相等。不得把本次“进入下一阶段”或文档审查批准自动扩大成代码实施授权。`sourceDisposition=t04_authorized_implementation` 的每个新增实现文件必须以该授权摘要 SHA-256 作为 `sourceReferenceSha256`。

### 2.3 snapshot

```text
baseCommit
acceptanceCommit
snapshotBundle: ArtifactRef
treeSha256
pathIndex: ArtifactRef
sourceIndex: ArtifactRef
buildIndex: ArtifactRef
workingTreePolicy = detached_local_commit_main_tree_read_only
mainStateAlgorithm = git_status_porcelain_v2_z_sha256_v1
mainHeadBefore
mainHeadAfter
mainIndexBeforeSha256
mainIndexAfterSha256
```

`mainHeadBefore==mainHeadAfter` 且 index hash 相等。这里的 main index hash 精确定义为对主工作树执行 `git status --porcelain=v2 -z --untracked-files=all` 的 stdout 原始字节做 SHA-256；命令前后 cwd、Git executable 与 exitCode 必须记录。acceptance commit 必须由 Git 可读取，禁止只写一个不存在的 40 hex。`snapshotBundle` 是包含 acceptance commit 及所需父对象的 Git bundle，外部审查者必须能在空 bare repository 中导入并 checkout；不能只依赖可能被 GC 的本地悬空 commit。三个 index ArtifactRef 必须能解析到原始字节，不能只提供裸 hash。

### 2.4 dependencyClosure

```text
algorithm = esm_relative_import_graph_plus_declared_artifacts_v1
entrypoints[]
files[] = {path, mode, sha256, byteLength, role,
           sourceDisposition, sourceReferenceSha256}
importEdges[] = {from, specifier, resolvedPath}
declaredArtifacts[]
lockfiles[]
missingEdges=[]
undeclaredReads=[]
unexpectedFiles=[]
closureSha256
```

`closureSha256` 输入是按 path Unicode code point 排序的 `mode SP sha256 SP byteLength SP path LF` UTF-8 字节。symlink 条目 hash 链接目标 UTF-8 字节，不跟随到闭包外。

`sourceDisposition` 的封闭值为 `product_base_commit | t03_independent_audit | t04_authorized_implementation | frozen_contract`。`sourceReferenceSha256` 分别绑定 base commit materialization manifest、T03 独立审查、T04 实施授权摘要或冻结合同审计请求；T04 新代码不得虚构尚未发生的实现出门审计 hash。

### 2.5 environment

```text
os
architecture
nodeVersion
npmVersion
pnpmVersion
pythonVersion
chromeVersion
chromeExecutableSha256
playwrightBrowserRevision
packageManagerInstallMode = pnpm_install_frozen_lockfile
packageLock: ArtifactRef
resolvedPackages: ArtifactRef
pythonInstallMode = offline_wheelhouse_require_hashes
runtimeRequirements: ArtifactRef
runtimeLockedRequirements: ArtifactRef
runtimeWheelhouseIndex: ArtifactRef
timezone
locale
```

`packageLock` 固定为 `apps/chrome-extension/pnpm-lock.yaml`，隔离安装必须使用精确 pnpm 版本与 `--frozen-lockfile`；仓库没有 extension `package-lock.json`，禁止使用 `npm ci`。`resolvedPackages` 是按 package name/version/integrity 排序的实际安装索引。

根 `requirements.txt` 只含范围约束，不足以重建 Python 环境。T04-0 必须生成带 exact version 与 `--hash=sha256:` 的 `runtimeLockedRequirements`，并将实际 wheel 原始字节及 name/version/tag/hash 写入 `runtimeWheelhouseIndex`；隔离环境只允许 `--no-index --require-hashes` 安装。Chrome 记录版本、可执行文件原始字节 SHA-256 和 Playwright browser revision。R4-P 的比较不得依赖 timezone/locale；R4-E 必须记录实际值。版本不符不允许静默继续。

### 2.6 replayPolicy 与 freshLanePolicy

```text
replayPolicy.outputRoot = fresh_empty_isolated_namespace
replayPolicy.validationRunId = baseline_same_id_isolated_root
replayPolicy.exactArtifactPaths = 固定十项
replayPolicy.normalizedArtifacts = [{path: invocation-record.json,
                                      ignoredJsonPointers: [/recordedAt]}]
freshLanePolicy.newRunRequired = true
freshLanePolicy.crossRunReuseAllowed = false
freshLanePolicy.requiredT02Checks = T02-A01..A12
freshLanePolicy.requiredT03Checks = T03-A01..A14
```

`ignoredJsonPointers` 的唯一允许集合为 `[/recordedAt]`。

### 2.7 humanBoundary

```text
humanReviewStatus = pending
g7Status = pending
finalPassed = false
signingAllowed = false
nextSigningStage = PX-6
```

## 3. SnapshotRevalidation v1

权威 `$id`：`https://navia.local/schemas/v2-px-snapshot-revalidation/v1`。

必填根字段：

```text
schemaVersion = v2-px-snapshot-revalidation/v1
evidenceClass = production_acceptance
t04RunId
generatedAt
inputManifest: ArtifactRef(t04_run)
replayLane
freshLane
t04AcceptanceResults[14]
negativeResults[25]
gateResults
machinePassed
humanReviewStatus
finalPassed
issues[]
```

### 3.1 replayLane

```text
baselineValidationRunId
replayValidationRunId
actualInvocation: ArtifactRef
stepResults[4] // derive, validate, report, package exactly once
exactComparisons[10]
normalizedComparisons[1]
stdoutStderrComparisons[]
passed
```

`stepResults` 的数组顺序必须精确为 `derive -> validate -> report -> package`，并与解析后的 `actualInvocation.steps` 逐项对应；只存在四个 `exitCode=0` 自报对象而没有真实 argv/cwd/stdout/stderr 原始字节不能通过。派生前后原始 `invocation-record.json` SHA-256 必须一致；派生记录还必须通过 `v2_px_replay_invocation_record.schema.json`。

十个 exact comparison path 精确等于验收计划 §2 的封闭集合；八个 stdout/stderr path 精确等于四步骤各自的 `logs/invocation/<step>.(stdout|stderr).log`。每个 comparison 必须满足 `comparison.path == baseline.path == replay.path`，validator 重新读取两个 ArtifactRef 的原始字节、byteLength 和 SHA-256。`equal=true` 只是输出结果，不是判断输入。InvocationRecord 的唯一 normalized comparison 还必须满足 path 为 `invocation-record.json`、算法为 `canonical_json_remove_registered_pointers_v1`、忽略集合精确为 `[/recordedAt]`。`passed=true` 仅在上述比较全部重算相等且四步确实被子进程执行时成立。

### 3.2 freshLane

```text
sourceRunId
sealedRawRun: ArtifactRef(fresh_source_run)
sealSha256
validationRunId
productionPackage: ArtifactRef(fresh_validation)
t02AcceptanceResults[12]
t03AcceptanceResults[14]
ruleCounts = {total:63,machinePassed:61,humanPending:2,failed:0,notApplicable:0}
contractCases = {expected:109,passed:109}
productionMutations = {expected:42,passed:42}
sourceCorpus = {web:6,local:3,note:3,total:12}
routeMatrix = {routeIntents:5,recoveryModes:4,covered:20}
forgetRecovery = {sources:3,modes:4,triggers:12,trustedClicks:12,recoveries:12}
axe = {serious:0,critical:0}
keyboard = {expected:5,passed:5}
passed
```

计数必须由引用的 raw/validation 重算，不信任本对象自报。

### 3.3 gate 与结论

```text
gateResults.G1..G6 = passed
gateResults.G7 = pending
machinePassed = true
humanReviewStatus = pending
finalPassed = false
```

任何 machine rule/acceptance/negative comparison 失败使 `machinePassed=false`。T04 不允许 `finalPassed=true`。A01..A14 是候选生成时可重算的机器与实现方审计结果；候选生成后的独立实现出门审查是外层 Stage Gate，不得预写进本对象。

## 4. ExitManifest v1

权威 `$id`：`https://navia.local/schemas/v2-px-exit-manifest/v1`。

必填根字段：

```text
schemaVersion = v2-px-exit-manifest/v1
evidenceClass = production_acceptance
t04RunId
createdAt
snapshotInputManifest
snapshotRevalidation
freshProductionPackage
freshInvocationRecord
chineseAcceptanceHtml
drawio
testArtifacts[]
auditArtifacts[]
publicEvidenceArchive
publicArchivePolicy = payload_only_excludes_exit_manifest_and_independent_audit
contentSha256
signed = false
humanReviewStatus = pending
g7Status = pending
finalPassed = false
claim
```

`contentSha256` 对删除根字段 `contentSha256` 后的 canonical JSON 计算，避免自引用。所有 ArtifactRef 在计算 content hash 前已固定。

`publicEvidenceArchive` 明确是 **payload-only archive**，且 `publicArchivePolicy` 必须精确等于 `payload_only_excludes_exit_manifest_and_independent_audit`：归档包含两泳道公开证据、合同、中文 HTML、Drawio、测试和内部审计请求，但排除 `exit-manifest.json` 自身及后续独立实现审查。先生成并 hash payload archive，再生成旁挂的 ExitManifest。外部分发同时携带二者，禁止把 ExitManifest 放回其引用的 archive 形成自引用。validator 必须读取 tar member index 重算该策略，不能只信常量。

固定 claim：

```text
T04 isolated snapshot revalidation candidate passed; Human Review, G7, PX-5 final disposition and PX-6 remain pending.
```

T04 Schema 不提供 `signed=true` 或 `finalPassed=true` 分支。PX-6 必须使用独立的人类签署合同引用 ExitManifest 原始字节 hash，不得回写本文件。

## 5. 失败码 registry

T04 failure code 为封闭枚举：

```text
T04_DEPENDENCY_CLOSURE_INVALID
T04_ENVIRONMENT_NOT_REPRODUCIBLE
T04_PRODUCT_SNAPSHOT_DRIFT
T04_BASELINE_CANDIDATE_INVALID
T04_BASELINE_INPUT_MODIFIED
T04_ISOLATION_BOUNDARY_FAILED
T04_OUTPUT_IMMUTABILITY_FAILED
T04_REPLAY_MISMATCH
T04_REPLAY_NORMALIZATION_INVALID
T04_INVOCATION_EVIDENCE_INVALID
T04_FRESH_E2E_REQUIRED
T04_CROSS_RUN_EVIDENCE_MIXED
T04_FRESH_RAW_INVALID
T04_T03_REGRESSION_FAILED
T04_VALIDATION_DENOMINATOR_MISMATCH
T04_ARCHITECTURE_REPLAY_FAILED
T04_PUBLIC_EVIDENCE_LEAK
T04_EXIT_MANIFEST_INVALID
T04_HUMAN_BOUNDARY_VIOLATION
T04_CLAIM_OVERREACH
T04_LEGACY_PIPELINE_FORBIDDEN
T04_INDEPENDENT_AUDIT_REQUIRED
```

25 个 negative case 的 `expectedLayer` 固定为 `semantic`。每个 case 只能有一个 primary failure；其他发现只能列为 warning，且 warning 不得替代 primary。Schema 内嵌的 `x-navia-requirement-registry`、`x-navia-failure-code-registry` 与 `x-navia-negative-enforcement-layer` 是 runner 的机器权威；fixture 集合必须与 registry 逐字段相等。N-023 必须在保持自报 `equal=true` 时制造 comparison/baseline/replay path 身份不一致；N-024 必须让真实 tar member index 包含 ExitManifest 或后续独立审计，同时保持策略常量不变；N-025 必须令授权记录中的用户指令或外审 hash 与 ArtifactRef 不一致。三例证明 validator 会读取原始引用、归档成员和治理记录，而不是只信结果字段。

## 6. 生成顺序

```text
dependency-index + environment-index
-> snapshot-input-manifest
-> R4-P actual replay + comparison
-> R4-E fresh raw + seal
-> R4-E T03 candidate
-> 25 negative results
-> snapshot-revalidation
-> Chinese HTML + Drawio hash + test/internal-audit/request records
-> deterministic payload-only public archive（排除 ExitManifest）
-> unsigned exit-manifest（引用 payload archive）
-> independent implementation audit
```

Report、HTML、SnapshotRevalidation 和 ExitManifest 不得成为上游 reader/validator 的输入。任何失败路径只生成 diagnostic 和日志，不生成貌似成功的 ExitManifest。
