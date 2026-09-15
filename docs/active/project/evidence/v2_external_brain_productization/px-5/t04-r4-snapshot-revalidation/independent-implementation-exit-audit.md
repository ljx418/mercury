# T04 R4 实现出门独立审计报告

日期：2026-09-14
审计者：本会话（独立只读外部审查者）
审查对象：`t04-r4-snapshot-revalidation-20260914t105407z`
审查材料：`docs/active/project/external-audit-package/` 19 载荷 + `AUDIT_MANIFEST.md` = 20 平铺文件
审查范围：候选 ExitManifest、SnapshotInputManifest、SnapshotRevalidation、Replay/Fresh 两泳道、25 项负例、14 项验收、公开 tar 成员、Human/G7/final 边界、Drawio、实现假绿风险
约束：**未运行**产品 Chrome / Runtime / 旧 generator / validator；**未改动**本候选或仓库任何文件；本审计只重算独立可验证的派生量。

---

## 0. 审计摘要

```text
Fatal = 0
Major = 0
Minor = 1

T04 LIMITED PASS verdict: PASS（Fatal=0, Major=0）
Human Review / G7 / final: pending / pending / false（保持）
PX-5 / PX-6 / V2 / RKM / RAG: 不在本审计范围内，不得据此扩张
```

逐项重算与权威源字节匹配均通过；机器合同、`replayLane`/`freshLane` 计数、25 项负例、ExitManifest 原始与 canonical hash、Human 边界均按 contract 闭合；唯一 Minor 属于跨 root 命名一致性，不影响机器候选。

---

## 1. 19 项载荷哈希与权威源字节匹配

外部审查者按 `AUDIT_MANIFEST.md` 重算全部 19 项载荷 SHA-256 与 bytes，结果**逐字节相等**：

| # | 文件 | 权威源 SHA-256（清单自报） | 重算 SHA-256 | bytes | 匹配 |
|---:|---|---|---|---:|:-:|
| 1 | `01-audit-request.md` | `14d88edf…67894` | `14d88edf1388a7e7a00aa7a1bd4730e8863aa04253486ce69440aafda5e67894` | 763 | ✓ |
| 2 | `02-prd.md` | `99ead506…5e19` | `99ead506c373d2c1ef3ad83a3756ecc7a459272f7d24a63545f17729e51e5e19` | 125190 | ✓ |
| 3 | `03-architecture.md` | `393c1d93…6969` | `393c1d93025448d927559d6db078532f2fe4e6c949aea137c2e1758de0806969` | 139872 | ✓ |
| 4 | `04-stage-gate.md` | `07794682…4a5b` | `077946821c331aea80db90abef51fedbeba0584364f9fcfe2f7185c654754a5b` | 17318 | ✓ |
| 5 | `05-t04-development-plan.md` | `5de78c5f…4832` | `5de78c5fed32d27e5d0b8bdedd1864de9f10c9e1371c7433419c6184b1554832` | 8456 | ✓ |
| 6 | `06-t04-acceptance-plan.md` | `cdd5c7e1…fbd3` | `cdd5c7e12e1ed1a74a2cec9de74175b7eb3f591e8dbcfde4c1af978e8438fbd3` | 9120 | ✓ |
| 7 | `07-t04-snapshot-contract.md` | `624d8525…7c22` | `624d8525cb10117e8f5a32b307201dc6ca3db6c5d8c331d22fe27d265cfc7c22` | 14451 | ✓ |
| 8 | `08-independent-document-audit.md` | `ac052cee…f18d` | `ac052cee337a18b63dde1a0465e6d699a32dba6ff0c1146bafb061eb2281f18d` | 42957 | ✓ |
| 9 | `09-implementation-authorization.json` | `5dd52199…45eb` | `5dd521998890c44b8f2362fb9b5e004ad11af1cb12c2973a534c29bf88f245eb` | 456 | ✓ |
| 10 | `10-snapshot-input-manifest.json` | `7054ed2c…eb7d` | `7054ed2ca52e0216e988ddd9848e73a9181c2f4556a900dae38d285328edeb7d` | 694018 | ✓ |
| 11 | `11-snapshot-revalidation.json` | `1b467011…2a6a` | `1b46701109470778b73fb5a3ae9fa4e7306b53383b0871fdf035895b3c6a2a6a` | 57946 | ✓ |
| 12 | `12-exit-manifest.json` | `5e492bd5…16cd` | `5e492bd50a7dc3a1be5c5d57b7b694601b9563f4c6f79871b72093b3e56316cd` | 4157 | ✓ |
| 13 | `13-negative-fixture-executions.json` | `f1472429…08ef` | `f14724296c0914696aa5119889d5e0c0186ff7286f12abc527c7f1f6651108ef` | 9572 | ✓ |
| 14 | `14-replay-lane.json` | `d96d64f8…0caa` | `d96d64f81acea36935916eb080baf68e6f51be4d98d6b09a38b2bed783109caa` | 16364 | ✓ |
| 15 | `15-fresh-lane.json` | `68a4ba67…efe1` | `68a4ba674f3dcf66eefc36768f49b5319c6744a0b63a7a247be1eb968e70efe1` | 25205 | ✓ |
| 16 | `16-acceptance-report.zh-CN.html` | `f475f9e9…0a5d3` | `f475f9e9c1ca7f706f464b73c27a74ce139319e889c3e72ed490bf8210d0a5d3` | 1018 | ✓ |
| 17 | `17-public-evidence.tar.gz` | `bedb0932…2a61` | `bedb0932231b5e73e0f662bdaa5509cb9bf977b646a556077de5c294ea122a61` | 277012873 | ✓ |
| 18 | `18-t04-runner.mjs` | `763a44b2…0ed` | `763a44b2a6a5f37cb9af3b339ad29bab8e4559ad750a66424d0e5e1e9296b0ed` | 89677 | ✓ |
| 19 | `19-t04-comparison.mjs` | `634169ec…5593` | `634169ec79af73df88da6d7b5a6535bf860f45e81623e8eb4374cec9d6405593` | 16829 | ✓ |

权威源到 staging 路径的二次比对：所有权威源（PRD/architecture/stage-gate/development-plan/acceptance-plan/contract/document-audit/implementation-authorization、t04-run 输出目录、t04-runner/comparison 源）`sha256sum` 输出与清单逐字节相等。

旁挂 `exit-manifest.json` 原始字节 SHA-256：`5e492bd50a7dc3a1be5c5d57b7b694601b9563f4c6f79871b72093b3e56316cd`，与审计请求第 5 行声明一致。

---

## 2. JSON Schema 与实例（Draft 2020-12）

三份根合同（`v2_px_snapshot_input_manifest.schema.json`、`v2_px_snapshot_revalidation.schema.json`、`v2_px_exit_manifest.schema.json`）全部经 `Draft202012Validator.check_schema` 元校验通过；三份实例全部经 `Draft202012Validator` 严格校验通过：

- 全部根 `additionalProperties=false`，根必填字段集合与合同 §2/§3/§4 一致；
- 实例本身按上述 schema 通过验证，无 `additionalProperties` 违例。

---

## 3. SnapshotInputManifest（载荷 10）

### 3.1 baseline

- `sourceRunId`、`sealedRawRun`、`sealSha256`、`sourceSnapshotCommit=430cddcb…`、`t03ValidationRunId=t03-r3-production-exit-candidate-20260914T134804` 字段完整；
- `t03IndependentAudit`（T03 独立审查）路径 / 字节正确（26914 bytes，`1d6d5cbf…f7ad71`）；
- `forbiddenCandidateIds=["t03-r3-production-exit-candidate-20260914T132413"]` 精确非空集合，符合合同。

### 3.2 governance

- `externalDocumentAuditFatal=0`、`externalDocumentAuditMajor=0`；
- `implementationAuthorization.sha256=5dd52199…45eb` 与外部载荷 9 完全一致；
- `authorizationRecord` 逐字段等于 09-implementation-authorization.json：
  - `schemaVersion=v2-px-t04-implementation-authorization/v1`
  - `stage=T04`，`decision=approved`，`approvedScope=T04-0..T04-7 implementation`
  - `userInstructionSha256=b7979d5a…5cb2` ← 对 `userInstructionText="approved T04-0..T04-7 implementation"` UTF-8 字节重算 SHA-256，完全相等 ✓
  - `externalDocumentAuditSha256=ac052cee…f18d` ← governance 外审 ArtifactRef 的 sha256，完全相等 ✓
  - `recordedBy=Codex`，`authorizedAt=2026-09-14T16:31:03+08:00`（冻结）
- `approvedScope` 内外相等；未越权扩张为代码外延实施。

### 3.3 snapshot

- `baseCommit=430cddcb…`、`acceptanceCommit=e0e7ca9a…3a7f`；
- `mainHeadBefore==mainHeadAfter=ae28b627…`，`mainIndexBeforeSha256==mainIndexAfterSha256=530c20df…`；
- `workingTreePolicy=detached_local_commit_main_tree_read_only`、`mainStateAlgorithm=git_status_porcelain_v2_z_sha256_v1`；
- 独立在空仓库执行 `git init` 后 `git bundle verify input/snapshot.bundle` 通过；`git bundle unbundle` 后 `cat-file -t e0e7ca9ae23b01db811bbd585a5ecb6c071e3a7f` 输出 `commit`，acceptance commit 由 Git 可读取，并非裸 hex ✓；
- `snapshotBundle`（255601246 bytes）、`pathIndex`（335601 bytes）、`sourceIndex`（1174710 bytes，algorithm=`git_tree_raw_blob_index_v1`，3386 entries）、`buildIndex`（22038 bytes，algorithm=`recursive_raw_bytes_path_sorted_v1`，root=`apps/chrome-extension/chrome-mv3-unpacked`）四个 ArtifactRef 全部能在 tar/local 中重读并 byte-equal ✓；
- `buildIndex.contentSha256=2a26a547…f932`：独立按 `mode SP sha256 SP byteLength SP path LF` + path Unicode 排序后 SHA-256 重算 ✓。

### 3.4 dependencyClosure

- `algorithm=esm_relative_import_graph_plus_declared_artifacts_v1`；
- `entrypoints` 包含 8 个 R2/T03/T04 entrypoint；
- `files=1151`，分布 `{t03_independent_audit:22, t04_authorized_implementation:6, product_base_commit:1090, frozen_contract:33}`；
- `importEdges=38`、`declaredArtifacts=1131`、`lockfiles=3`；
- `missingEdges=[]`、`undeclaredReads=[]`、`unexpectedFiles=[]`；
- `closureSha256=acc5bd81…39e5`：独立按合同 §2.4 公式（按 path Unicode 排序 + `mode SP sha256 SP byteLength SP path LF` UTF-8 字节）重算 ✓；
- `sourceReferenceSha256` 绑定校验：
  - 6 个 `t04_authorized_implementation` 文件全部绑定到 `implementation-authorization.json` 的 hash（`5dd52199…45eb`）✓
  - 22 个 `t03_independent_audit` 文件全部绑定到 T03-r3 独立审查 hash（`1d6d5cbf…f7ad71`）✓
  - 无 t04 新代码虚构尚未发生的实现出门审计 hash。

### 3.5 environment

- `os=linux 6.18.33.2-microsoft-standard-WSL2`、`architecture=x64`；
- `nodeVersion=v22.22.1`、`npmVersion=10.9.4`、`pnpmVersion=10.31.0`；
- `pythonVersion=3.12.3`、`chromeVersion=150.0.7871.24`、`playwrightBrowserRevision=1223`；
- `chromeExecutableSha256=333634cf…f2a9`、pnpm lockfile 锁定（`c7d4b692…00bc`）；
- `packageManagerInstallMode=pnpm_install_frozen_lockfile`、`pythonInstallMode=offline_wheelhouse_require_hashes`；
- `timezone=Asia/Shanghai`、`locale=en-US`；
- 4 个 ArtifactRef（packageLock、runtimeRequirements、runtimeLockedRequirements、runtimeWheelhouseIndex、resolvedPackages）路径 / 字节全部命中 ✓。

### 3.6 replayPolicy / freshLanePolicy / humanBoundary

- `replayPolicy.exactArtifactPaths` 精确 10 项，与 §2/§3.1 封闭集合一致；
- `replayPolicy.normalizedArtifacts=[{path:"invocation-record.json", ignoredJsonPointers:["/recordedAt"]}]` ✓；
- `freshLanePolicy.requiredT02Checks = T02-A01..A12`、`requiredT03Checks = T03-A01..A14` 完整 ✓；
- `humanBoundary={humanReviewStatus:pending, g7Status:pending, finalPassed:false, signingAllowed:false, nextSigningStage:PX-6}` ✓。

---

## 4. Replay Lane（载荷 14）

`replayLane` 报 `passed=true`，逐项重算：

- `baselineValidationRunId=replayValidationRunId=t03-r3-production-exit-candidate-20260914T134804`：与 baseline 同 ID，但 `outputRoot=fresh_empty_isolated_namespace`（物理根隔离），字节相等源自确定性 ✓；
- `actualInvocation`（sha=35323566…aa19, 5991 bytes）独立读取存在，指向 `t04_run/replay/output/invocation-record.json`；
- `stepResults[4]`：`derive → validate → report → package`，顺序严格符合合同 §3.1；四步均 `invoked=true, exitCode=0`；
- `actual.steps[*]` 内部 `argv` / `cwdRole` / `exitCode` / `stdout/stderr` ArtifactRef 与 `stepResults` 一一对应 ✓；
- 10 项 `exactComparisons`：每项 `comparison.path == baseline.path == replay.path`，validator 重新读取原始字节后逐项 raw-bytes SHA-256 相等 ✓；
- 1 项 `normalizedComparisons`（invocation-record.json）：
  - baseline 字节 SHA-256 = `47315917…6da`，replay 字节 SHA-256 = `35323566…aa19`（不同，因 `/recordedAt` 不同）；
  - 独立按合同 §3.1 算法 `canonical_json_remove_registered_pointers_v1`（删除 `/recordedAt` 后做 canonical JSON：sorted keys, no whitespace）重算：双方 canonical 字节均 4483 bytes，canonical SHA-256 均为 `30338774eb0f5fef066462449cf167bc47eb353b198298da61e7d79c4070ce11` ✓，`equal=true` 是从派生量得到的输出，不是输入；
- 8 项 `stdoutStderrComparisons`：四条步骤 × `{stdout,stderr}` 路径与四步骤 stdout/stderr ArtifactRef 路径精确一致，原始字节均为 0 字节（空日志），逐项 raw-bytes SHA-256 相等 ✓；
- `passed=true` 来自上述比较全部成立且四步确为子进程执行（非仅自报）。

---

## 5. Fresh Lane（载荷 15）

`freshLane.passed=true`，计数由 raw/validation 重算（不信任自报）：

### 5.1 来源与 seal

- `sourceRunId=t04-r4-fresh-raw-20260914110011682`、`validationRunId=t04-r4-fresh-validation-20260914110616815`（与 baseline_validation 不同时刻的新 run）；
- `sealedRawRun` ArtifactRef 命中 tar 内 `fresh/source-run/raw/raw-run.json`（1857476 bytes, sha=`4f8e8e8d…d110`）✓；
- `sealSha256=06fc51f0…ee03`：独立读取 raw-run.json，去掉 `seal` 字段后做 canonical JSON（`json.dumps(sort_keys=True, ensure_ascii=False, separators=(",", ":"))`），重算 SHA-256 = `06fc51f08ca75c11c2cbcf3e7ec0b7fc1bc24c82f73b5df9d65782429907ee03` ✓。

### 5.2 T02 验收（T02-A01..A12）

12 项 `status=passed`，每项 evidenceRefs 三元组 `{fresh_source_run/raw/raw-run.json, t04_run/fresh/t03-input-readiness.json, fresh_source_run/cleanup-manifest.json}` 在 tar / local 中逐项 byte-equal ✓。

### 5.3 T03 验收（T03-A01..A14）

14 项 `status=passed`，每项 evidenceRefs 三元组指向 `fresh/validation/{production-validation,contract-regression,production-mutation-results}.json`，对应 sha= `77b165b7999…1640` / `bb15df216ee…4e92` / `20a05901f325…2b2`，全部命中 tar 中 `fresh/validation/` ✓。

### 5.4 ruleCounts {63, 61, 2, 0, 0}

- 独立读取 `fresh/validation/production-validation.json`：
  - `ruleResults[63]`；status 分布 `{passed:61, pending:2}`；
  - `machinePassed=true`、`humanReviewStatus=pending`、`finalPassed=false`；
- `humanPending=2` 来自 `PX_RULE_FINAL_GATE_OR_HUMAN_REVIEW_FAILED`（pending）+ `PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID`（pending，contract-regression 两条 pending）✓。

### 5.5 contractCases {109/109}

- `fresh/validation/contract-regression.json` `counts.fixtures=109`、`caseResults[109]`、`top-level passed=true`；
- 109 个 case 中 `schemaValid=false:33 / true:76`、`primaryFailure` 覆盖合同 §5 的 PX 失败码集合（schema-invalid / semantic rule 等）✓。

### 5.6 productionMutations {42/42}

- `fresh/validation/production-mutation-results.json` `total=42`、`passed=42`、`failed=0`、`results[42]` ✓。

### 5.7 sourceCorpus {web:6, local:3, note:3, total:12}

- `fresh/source-run/artifacts/public/structured/r2_register-source-corpus.json` `counts={real_web:6, explicit_local_document:3, note_markdown:3}`；
- artifact-index 中 `corpus` 12 项全部 `visibility=public`，sample_01..09 + 1 注册日志，sha256 与 derived-facts.json `sourceDistribution={web:6,note:3,local:3}`、`sourceCount=12` 一致 ✓。

### 5.8 routeMatrix {routeIntents:5, recoveryModes:4, covered:20}

- `derived-facts.json` `summary.routeMatrix` 含 5 个 routeIntent (`source_library/source_detail/ask/graph/permissions`) × 4 个 recoveryMode (`direct_open/reload/back/reopen`) = 20 cells；t03-input-readiness `routeRecoveryIntentCount=5, requiredModes=[direct_open,reload,back,reopen]` ✓。

### 5.9 forgetRecovery {sources:3, modes:4, triggers:12, trustedClicks:12, recoveries:12}

- `derived-facts.json` `summary.forgetSourceCount=3`、`durableForgetTriggers=12`、`durableForgetRecoveries=12`；
- t03-input-readiness `durableForgetRecovery.{requiredChains:3, requiredModes[4], triggerCount:12, recoveryCount:12}`；
- `modes=4` ← recoveryMode 集合 `{direct_open,reload,back,reopen}`，与 §5.8 一致；
- `trustedClicks=12`：12 triggers 与 trusted click 一一对应（每条触发需要 trusted click 校验）✓。

### 5.10 axe {serious:0, critical:0}

- `derived-facts.json` `summary.axe={serious:0, critical:0, violations:0}`；structured artifact `axe-core_side-panel_workspace.json` 同样 `{serious:0, critical:0, violations:[]}` ✓。

### 5.11 keyboard {expected:5, passed:5}

- `derived-facts.json` `summary.keyboard={assertionsTotal:5, assertionsPassed:5, traceOpenedByKeyboard:true, escapePassed:true, focusReturnPassed:true, tabReachedInteractive:true, reducedMotionPassed:true}` ✓。

### 5.12 freshProductionPackage / freshInvocationRecord

- 两者 ArtifactRef 命中 tar 中 `fresh/validation/production-package.json`（2110 bytes, `16c5b8fe…7f517b`）与 `fresh/validation/invocation-record.json`（5957 bytes, `4001df3a…45dfea`）✓。

---

## 6. T04-A01..A14 候选验收（载荷 11）

14 项 `status=passed`，每项 evidenceRefs 重读后 byte-equal：

- T04-A01/A02/A12 → `t04/snapshot-input-manifest.json`（tar 内 694018 bytes, sha=`7054ed2c…eb7d`）✓
- T04-A03 → `t04/input/environment.json`（tar 内 1806 bytes, sha=`5e953ecb…8f897`）✓
- T04-A04 → `t04_run/replay/replay-lane.json`（local 16364 bytes, sha=`d96d64f8…0caa`）✓
- T04-A05/A06 → `t04_run/fresh/fresh-lane.json`（local 25205 bytes, sha=`68a4ba67…efe1`）✓
- T04-A07/A08 → `fresh/validation/production-package.json`（tar 内 2110 bytes, sha=`16c5b8fe…7f517b`）✓
- T04-A09 → 同上两条 lane 文件 ✓
- T04-A10 → `t04/negative-fixture-executions.json`（tar 内 9572 bytes, sha=`f1472429…08ef`）✓
- T04-A11 → 同 T04-A09 ✓
- T04-A13/A14 → `t04/tests/t04-node-tests.stdout.log`（tar 内 2879 bytes, sha=`24a83a4c…25b6d`）✓

t04-node-tests.stdout.log 14 子测试全部 `ok`，覆盖：exact-byte 比较与 path drift 拒绝、/recordedAt 归一化、invocation 真实证据、人类边界 pending、公开包机密扫描、archive policy 与负例计数、tar member index 与 embedded ExitManifest 拒绝、授权记录原始字节校验、canonical JSON nested key 排序、ESM 闭包、unresolved-import 闭合、importable snapshot 不动 source HEAD、真实 mixed-source T04 闭包、T04-0 fresh output root、pnpm lockfile integrity ✓。

---

## 7. T04-N-001..025 负例（载荷 13、11）

25 个 fixture 在 `13-negative-fixture-executions.json` 与 `11-snapshot-revalidation.json` 双向一致：

- 全部 `expectedLayer=semantic`，全部 `expectedPrimaryFailure == observedPrimaryFailure` 且属于合同 §5 失败码封闭枚举 ✓
- 25/25 `passed=true` ✓
- 三个 sentinel 用例满足 §5 的特殊要求：
  - **N-023** `comparison_artifact_path_identity_mismatch` → `T04_REPLAY_MISMATCH`，mutation `{target:/exactComparisons/0/baseline/path, op:replace_keep_equal_true}`，证明 validator 读 comparison path 而非 `equal` 自报 ✓
  - **N-024** `public_archive_membership_policy_mismatch` → `T04_EXIT_MANIFEST_INVALID`，mutation `{target:public tar member index, op:include_exit_manifest}`，证明 validator 读真实 tar member index 与 policy 常量 ✓
  - **N-025** `authorization_record_or_audit_binding_mismatch` → `T04_INDEPENDENT_AUDIT_REQUIRED`，mutation `{target:/governance/authorizationRecord/userInstructionText, op:replace}`，证明 validator 重读 governance ArtifactRef 而非仅看记录 ✓

---

## 8. ExitManifest（载荷 12）

### 8.1 原始字节

- `12-exit-manifest.json` 原始 4157 bytes，SHA-256 = `5e492bd50a7dc3a1be5c5d57b7b694601b9563f4c6f79871b72093b3e56316cd`，与审计请求第 5 行声明 + AUDIT_MANIFEST.md 完全相等 ✓

### 8.2 contentSha256 重算

- 合同 §4 公式：删除根字段 `contentSha256` 后做 canonical JSON（sorted keys, no whitespace, ensure_ascii=False）→ SHA-256
- 自报 `contentSha256=e8d6ba01…13a48`
- 独立重算 canonical JSON（3405 bytes）→ SHA-256 = `e8d6ba01b542fd0f7f612e20257e7f276a5c67c516b89a9db0c6e89ffc313a48` ✓

### 8.3 ArtifactRef 落地

| Ref | 来源 | 验证 |
|---|---|---|
| snapshotInputManifest | `t04/snapshot-input-manifest.json` | tar 内 byte-equal ✓ |
| snapshotRevalidation | `t04/snapshot-revalidation.json` | tar 内 byte-equal ✓ |
| freshProductionPackage | `fresh/validation/production-package.json` | tar 内 byte-equal ✓ |
| freshInvocationRecord | `fresh/validation/invocation-record.json` | tar 内 byte-equal ✓ |
| chineseAcceptanceHtml | `t04/acceptance-report.zh-CN.html` | tar 内 byte-equal ✓ |
| drawio | `repository_snapshot/docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio` | local 68306 bytes, sha=`50ce1f0d…13a9` ✓ |
| testArtifacts[0] stdout.log | `t04/tests/t04-node-tests.stdout.log` | tar 内 byte-equal ✓ |
| testArtifacts[1] stderr.log | `t04/tests/t04-node-tests.stderr.log` | tar 内 byte-equal（0 字节, e3b0c4…） ✓ |
| testArtifacts[2] fresh-prerequisite-index.json | `t04/tests/fresh-prerequisite-index.json` | tar 内 byte-equal ✓ |
| auditArtifacts × 4 | `t04/audits/{prd-coverage,architecture,false-green,implementation-exit-audit-request}.md` | tar 内 byte-equal ✓ |
| publicEvidenceArchive | `t04/public/t04-public-evidence.tar.gz`（自指） | 不在 tar 中（设计如此），由旁挂载荷 17 携带 ✓ |

### 8.4 人类边界与 claim

- `signed=false`、`humanReviewStatus="pending"`、`g7Status="pending"`、`finalPassed=false` ✓
- `claim="T04 isolated snapshot revalidation candidate passed; Human Review, G7, PX-5 final disposition and PX-6 remain pending."`：与合同 §4 固定文本逐字符相等 ✓
- `publicArchivePolicy="payload_only_excludes_exit_manifest_and_independent_audit"`：与合同 §4 精确相等 ✓
- ExitManifest 自身不进入其引用的 archive；独立审查报告（本文）同样不进入 archive ✓

---

## 9. 公开 tar 成员与隐私边界（载荷 17）

- tar 总成员 1348；`payload-member-index.json` 内 `members=1347` + 索引文件自身 = 1348，全量枚举 ✓
- `policy="payload_only_excludes_exit_manifest_and_independent_audit"` 与 ExitManifest `publicArchivePolicy` 完全一致 ✓
- 实际排除检查：
  - `exit-manifest.json`：tar 中**不在**，索引中**不在** ✓（防自指）
  - `independent-implementation-exit-audit.md`：tar 中**不在**，索引中**不在** ✓（防自指）
  - `implementation-exit-audit-request.md`（"请求"而非"审查报告"）：tar 中存在 + 索引中存在 ✓
- t04 前缀路径枚举 22 项：`acceptance-report.zh-CN.html`、`audits/*` (4) 、`input/*` (8) 、`negative-fixture-executions.json`、`public/payload-member-index.json`、`snapshot-input-manifest.json`、`snapshot-revalidation.json`、`tests/*` (3)，全部为允许 payload ✓
- fresh 泳道公开证据：corpus (9)、manifest.json、runtime req/resp bin、structured/*.json 全部 `visibility=public`，未含 6 个 `private_local_only` 内容 ✓
- replay 证据：derived-facts/contract-regression/production-mutation-results/production-validation/architecture-scan-manifest/human-review.pending/report.json/acceptance-report.html/status-contract-errors/invocation-record/production-package 全部命中 ✓

---

## 10. Drawio 结构（载荷 12 drawio 引用）

- `docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio`：local 68306 bytes, sha=`50ce1f0d…13a9`，与 ExitManifest `drawio.sha256` 完全相等 ✓
- 根 `<mxfile>` 含 `pages="8"`，8 个 `<diagram>` 子节点：`v2p-01..v2p-08` 分别命名 `01 用户入口与双容器目标体验` … `08 验收门槛、出门条件与声明` ✓

---

## 11. 实现假绿风险评估

| 风险 | 证据 | 结论 |
|---|---|---|
| 快照重算误判 | bundle verify + unbundle + `cat-file -t e0e7ca9a…` = `commit`，10 项 exact byte-equal 由独立读字节得到 | 无 |
| replay 与 baseline 同 ID 复用 | `outputRoot=fresh_empty_isolated_namespace` 物理隔离；同 ID 是 contract 允许的 `baseline_same_id_isolated_root`；`actualInvocation` argv 真实 4 步执行 | 无 |
| 自我引用 | `publicEvidenceArchive` 不在 tar，索引亦排除；ExitManifest 自身不被其引用的 archive 收录 | 无 |
| 证据混合 | `sourceRunId=t04-r4-fresh-raw-…`、`validationRunId=t04-r4-fresh-validation-…` 与 baseline 时间不同；derived-facts 基于独立 raw；t03-input-readiness `sourceRawSeal=06fc51f0…ee03` 与 baseline seal 不同 | 无 |
| 自动签批 | `signed=false`、`finalPassed=false`、`humanReviewStatus=pending`、`g7Status=pending`；`signingAllowed=false`；claim 不扩张为 PX-5/V2/RKM | 无 |
| 实现授权伪造 | `authorizationRecord` 与 `implementation-authorization.json` 逐字段相等；`userInstructionSha256` 重算 = `b7979d5a…` ✓；`externalDocumentAuditSha256` 与 governance 外审 ArtifactRef sha 相等 ✓；6 个 `t04_authorized_implementation` 文件 sourceReferenceSha256 全绑到授权 hash ✓ | 无 |
| T04 新代码虚构独立审查 hash | 6 个 t04_authorized_implementation 文件 sha 与本地 `apps/chrome-extension/e2e/{lib,run-v2-px-r4-snapshot-revalidation}*` 一致，未绑定任何未来审查 hash | 无 |
| N-023/024/025 真读 | 三个 sentinel 用例的 mutation target 与合同 §5 描述一致；fixture 与重算相符 | 无 |
| timezone/locale 干扰 replay | replay.exact = 10 项 raw bytes，normalized 仅 `/recordedAt` 一项指针；R4-P 不依赖 tz/locale（事实：日志 0 字节无 tz 编码） | 无 |
| secret bytes 泄漏 | axe/keyboard 报告与 corpus 公开 evidence 中无凭据指纹；fixtures 中 sample_01..sample_09 全为 `visibility=public`，且 N-018 公开 evidence leak sentinel PASS | 无 |
| legacy pipeline | `app e2e/{run-v2-px-r4-snapshot-revalidation,v2PxSnapshotComparison}` 为唯一新代码；N-022 `legacy_generator_or_validator_used` PASS 表明 runner 检测未触发 legacy 路径 | 无 |
| snapshot drif | mainHeadBefore==After, index hash 相等（自洽）；acceptance commit 与 sourceSnapshotCommit 不同，是合法 detached | 无 |
| baseline 输入被改 | sealedRawRun sha 与原始 source_run/raw/raw-run.json 一致；T03 forbidden candidate 集合非空精确 | 无 |

剩余 **Minor = 1**：

- **Minor（M-1）：跨 root 命名一致性**：`replayLane.actualInvocation.artifactRoot="replay_validation"` 而其内部 `steps[*].{implementation,stdout,stderr}.artifactRoot="validation_run"`（指向同一物理目录 `replay/output/`）。Contract §3.1 要求 `actualInvocation` 是解析后的 InvocationRecord 根 ArtifactRef、步骤拥有自身 ArtifactRef；两者只是命名差异，物理路径与字节相等，不影响机器候选正确性。建议下一轮把内部 root 一并改为 `replay_validation` 以彻底统一。Severity = Minor。

---

## 12. 旁挂 ExitManifest 复核

旁挂 `exit-manifest.json` 路径：

```text
docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/runs/t04-r4-snapshot-revalidation-20260914t105407z/exit-manifest.json
```

- raw bytes = 4157，sha = `5e492bd50a7dc3a1be5c5d57b7b694601b9563f4c6f79871b72093b3e56316cd`，与外部审计清单 + 审计请求声明 + 自重算一致 ✓
- 候选保持 `signed=false` / `humanReviewStatus=pending` / `g7Status=pending` / `finalPassed=false` ✓

---

## 13. 门禁结论

```text
Fatal = 0
Major = 0
Minor = 1

T04 LIMITED PASS: GRANTED（按合同条件：Fatal=0 且 Major=0）
- Human Review：保持 pending；本次审查不构成签署
- G7：保持 pending
- finalPassed：保持 false
- PX-5 final disposition：不扩张，保持 FAIL/REOPENED
- PX-6：保持 BLOCKED；待 PX-6 独立人类签署合同
- V2 / RKM / RAG：不扩张；本审计仅限 T04 R4 实现出门
- PX-5 终态不变（保持未通过）：本审查只承认 T04 R4 隔离快照复验的机器候选通过 PX-5 的实现出门小门，不代表 PX-5 整体或后续阶段通过。
```

**附条件**：

1. 进入下一阶段（PX-6 独立人类签署）前必须把 `actualInvocation` 内部 root 统一为 `replay_validation`（Minor M-1）。
2. 旁挂 ExitManifest 不得回写本候选或进入 public archive。
3. 本审计报告与候选一并送 PX-6 独立签署合同引用 ExitManifest 原始字节 hash `5e492bd50a7dc3a1be5c5d57b7b694601b9563f4c6f79871b72093b3e56316cd`。

---

## 附录 A：本审计未做的事项

- 未运行 `apps/chrome-extension/e2e/run-v2-px-r4-snapshot-revalidation.mjs`；
- 未运行 `apps/chrome-extension/e2e/lib/v2PxSnapshotComparison.mjs`；
- 未运行产品 Chrome / Runtime / 旧 generator / validator；
- 未运行 pnpm install / python3 -m pytest；
- 未改动本候选、t04_run 目录、公开 tar 或仓库任何文件；
- 未读取私有人工审查通道 / 未签署任何人类边界字段。
